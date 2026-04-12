import { test, expect } from '@playwright/test'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const IMPORTED_CODE = 'print("hello from imported file")\n'

// Helper to get the active Monaco editor's current value
async function getEditorValue(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors: () => { getModel: () => { getValue: () => string } | null }[] } } }).monaco
    return monaco?.editor?.getEditors()[0]?.getModel()?.getValue()
  })
}

test.describe('file import', () => {
  test.beforeEach(async ({ page }) => {
    // Skip the welcome modal so it doesn't block tests
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    await page.goto('/')
    // Wait for the toolbar to be ready
    await page.getByRole('button', { name: 'File', exact: true }).waitFor()
  })

  test('Open file button triggers system file picker', async ({ page }) => {
    await page.getByRole('button', { name: 'File', exact: true }).click()
    const openFileItem = page.getByRole('menuitem', { name: 'Open file…' })
    await expect(openFileItem).toBeVisible()

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      openFileItem.click(),
    ])
    expect(fileChooser).toBeTruthy()
    await fileChooser.setFiles([])
  })

  test('importing a .py file replaces editor content', async ({ page }) => {
    const tmpFile = join(tmpdir(), 'saarai_test_import.py')
    writeFileSync(tmpFile, IMPORTED_CODE)

    try {
      await page.getByRole('button', { name: 'File', exact: true }).click()
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('menuitem', { name: 'Open file…' }).click(),
      ])
      await fileChooser.setFiles(tmpFile)

      // Monaco mounts once a file is open
      await page.waitForSelector('.monaco-editor', { timeout: 30_000 })

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
      await page.getByRole('button', { name: 'File', exact: true }).click()
      const [chooser1] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('menuitem', { name: 'Open file…' }).click(),
      ])
      await chooser1.setFiles(file1)
      await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
      await expect
        .poll(() => getEditorValue(page), { timeout: 5_000 })
        .toContain('file one')

      await page.getByRole('button', { name: 'File', exact: true }).click()
      const [chooser2] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('menuitem', { name: 'Open file…' }).click(),
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
