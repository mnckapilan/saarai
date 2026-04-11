import { test, expect } from '@playwright/test'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const IMPORTED_CODE = 'print("hello from imported file")\n'

// Helper to get the current Monaco editor value
async function getEditorValue(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    (window as unknown as { monaco?: { editor?: { getModels: () => { getValue: () => string }[] } } })
      .monaco?.editor?.getModels()[0]?.getValue(),
  )
}

test.describe('file import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for Monaco to mount
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
  })

  test('Open file button triggers system file picker', async ({ page }) => {
    const importButton = page.getByRole('button', { name: 'Import Python file' })
    await expect(importButton).toBeVisible()

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      importButton.click(),
    ])
    expect(fileChooser).toBeTruthy()
    await fileChooser.setFiles([])
  })

  test('importing a .py file replaces editor content', async ({ page }) => {
    const tmpFile = join(tmpdir(), 'saarai_test_import.py')
    writeFileSync(tmpFile, IMPORTED_CODE)

    try {
      const importButton = page.getByRole('button', { name: 'Import Python file' })
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        importButton.click(),
      ])
      await fileChooser.setFiles(tmpFile)

      await expect
        .poll(() => getEditorValue(page), { timeout: 5_000 })
        .toContain('hello from imported file')
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('importing a second file replaces the first', async ({ page }) => {
    const file1 = join(tmpdir(), 'saarai_test_file1.py')
    const file2 = join(tmpdir(), 'saarai_test_file2.py')
    writeFileSync(file1, '# file one\n')
    writeFileSync(file2, '# file two\n')

    try {
      const importButton = page.getByRole('button', { name: 'Import Python file' })

      const [chooser1] = await Promise.all([
        page.waitForEvent('filechooser'),
        importButton.click(),
      ])
      await chooser1.setFiles(file1)
      await expect
        .poll(() => getEditorValue(page), { timeout: 5_000 })
        .toContain('file one')

      const [chooser2] = await Promise.all([
        page.waitForEvent('filechooser'),
        importButton.click(),
      ])
      await chooser2.setFiles(file2)
      await expect
        .poll(() => getEditorValue(page), { timeout: 5_000 })
        .toContain('file two')
    } finally {
      unlinkSync(file1)
      unlinkSync(file2)
    }
  })
})
