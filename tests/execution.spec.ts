import { test, expect } from '@playwright/test'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Opens a temporary .py file in the editor and returns the path so the
// caller can clean it up.
async function openPyFile(page: import('@playwright/test').Page, code: string): Promise<string> {
  const tmpFile = join(tmpdir(), `saarai_exec_${Date.now()}_${Math.random().toString(36).slice(2)}.py`)
  writeFileSync(tmpFile, code)
  await page.getByRole('button', { name: 'File', exact: true }).click()
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: 'Open file…' }).click(),
  ])
  await fileChooser.setFiles(tmpFile)
  // Monaco only mounts once a file is open
  await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
  return tmpFile
}

// Pyodide loads ~10 MB from CDN — give it plenty of time.
async function waitForReady(page: import('@playwright/test').Page) {
  await expect(page.getByText('● Ready')).toBeVisible({ timeout: 50_000 })
}

test.describe('code execution', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'File', exact: true }).waitFor()
  })

  test('runtime reaches ready state after loading', async ({ page }) => {
    await waitForReady(page)
    await expect(page.getByText('● Ready')).toBeVisible()
  })

  test('run button becomes enabled once a .py file is open and runtime is ready', async ({ page }) => {
    const tmpFile = await openPyFile(page, 'print("hello")\n')
    try {
      await waitForReady(page)
      await expect(page.getByRole('button', { name: 'Run code' })).toBeEnabled()
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('running print() shows the output in the output panel', async ({ page }) => {
    const tmpFile = await openPyFile(page, 'print("hello from saarai")\n')
    try {
      await waitForReady(page)
      await page.getByRole('button', { name: 'Run code' }).click()
      await expect(page.getByRole('log', { name: 'Program output' })).toContainText(
        'hello from saarai',
        { timeout: 15_000 },
      )
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('multiple print statements each appear as separate output lines', async ({ page }) => {
    const tmpFile = await openPyFile(page, 'print("line one")\nprint("line two")\nprint("line three")\n')
    try {
      await waitForReady(page)
      await page.getByRole('button', { name: 'Run code' }).click()
      const output = page.getByRole('log', { name: 'Program output' })
      await expect(output).toContainText('line one', { timeout: 15_000 })
      await expect(output).toContainText('line two')
      await expect(output).toContainText('line three')
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('Ctrl+Enter keyboard shortcut runs code', async ({ page }) => {
    const tmpFile = await openPyFile(page, 'print("shortcut works")\n')
    try {
      await waitForReady(page)
      // Click editor to ensure it has keyboard focus
      await page.locator('.monaco-editor').click()
      await page.keyboard.press('Control+Enter')
      await expect(page.getByRole('log', { name: 'Program output' })).toContainText(
        'shortcut works',
        { timeout: 15_000 },
      )
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('Python syntax error appears in the output panel', async ({ page }) => {
    const tmpFile = await openPyFile(page, 'def broken(\n')
    try {
      await waitForReady(page)
      await page.getByRole('button', { name: 'Run code' }).click()
      await expect(page.getByRole('log', { name: 'Program output' })).toContainText(
        'SyntaxError',
        { timeout: 15_000 },
      )
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('Python runtime error appears in the output panel', async ({ page }) => {
    const tmpFile = await openPyFile(page, 'x = 1 / 0\n')
    try {
      await waitForReady(page)
      await page.getByRole('button', { name: 'Run code' }).click()
      await expect(page.getByRole('log', { name: 'Program output' })).toContainText(
        'ZeroDivisionError',
        { timeout: 15_000 },
      )
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('clear button removes output and restores placeholder', async ({ page }) => {
    const tmpFile = await openPyFile(page, 'print("to be cleared")\n')
    try {
      await waitForReady(page)
      await page.getByRole('button', { name: 'Run code' }).click()
      const output = page.getByRole('log', { name: 'Program output' })
      await expect(output).toContainText('to be cleared', { timeout: 15_000 })

      await page.getByRole('button', { name: 'Clear output' }).click()
      await expect(page.getByText('Run your code to see output here…')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Clear output' })).not.toBeVisible()
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('running code a second time clears the previous output', async ({ page }) => {
    const tmpFile = await openPyFile(page, 'print("first run")\n')
    try {
      await waitForReady(page)
      await page.getByRole('button', { name: 'Run code' }).click()
      const output = page.getByRole('log', { name: 'Program output' })
      await expect(output).toContainText('first run', { timeout: 15_000 })

      // Modify the code and run again — previous output should be gone
      const secondFile = join(tmpdir(), `saarai_exec_second_${Date.now()}_${Math.random().toString(36).slice(2)}.py`)
      writeFileSync(secondFile, 'print("second run")\n')
      try {
        await page.getByRole('button', { name: 'File', exact: true }).click()
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          page.getByRole('menuitem', { name: 'Open file…' }).click(),
        ])
        await chooser.setFiles(secondFile)
        await page.getByRole('button', { name: 'Run code' }).click()
        await expect(output).toContainText('second run', { timeout: 15_000 })
        await expect(output).not.toContainText('first run')
      } finally {
        unlinkSync(secondFile)
      }
    } finally {
      unlinkSync(tmpFile)
    }
  })
})
