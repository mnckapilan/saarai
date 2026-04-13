import { test, expect } from '@playwright/test'
import { writeFileSync, unlinkSync, mkdtempSync, mkdirSync, readdirSync, rmSync, readFileSync } from 'fs'
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
      const output = page.getByRole('log', { name: 'Program output' })
      await expect(output).toContainText('SyntaxError', { timeout: 15_000 })
      await expect(output).not.toContainText('PythonError:')
      await expect(output).not.toContainText('_pyodide')
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('Python runtime error appears in the output panel', async ({ page }) => {
    const tmpFile = await openPyFile(page, 'x = 1 / 0\n')
    try {
      await waitForReady(page)
      await page.getByRole('button', { name: 'Run code' }).click()
      const output = page.getByRole('log', { name: 'Program output' })
      await expect(output).toContainText('ZeroDivisionError', { timeout: 15_000 })
      await expect(output).not.toContainText('PythonError:')
      await expect(output).not.toContainText('_pyodide')
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('traceback shows the real filename instead of <exec>', async ({ page }) => {
    // The file is named with a known suffix so we can assert it appears in the traceback.
    const tmpFile = join(tmpdir(), `saarai_exec_${Date.now()}_traceback_test.py`)
    writeFileSync(tmpFile, 'raise ValueError("traceback filename test")\n')
    try {
      await page.getByRole('button', { name: 'File', exact: true }).click()
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('menuitem', { name: 'Open file…' }).click(),
      ])
      await fileChooser.setFiles(tmpFile)
      await page.waitForSelector('.monaco-editor', { timeout: 30_000 })

      await waitForReady(page)
      await page.getByRole('button', { name: 'Run code' }).click()
      const output = page.getByRole('log', { name: 'Program output' })
      await expect(output).toContainText('ValueError', { timeout: 15_000 })
      // Should show the actual filename, not the generic <exec> placeholder.
      await expect(output).toContainText('traceback_test.py')
      await expect(output).not.toContainText('<exec>')
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

  test('Python can write a file and read it back in the same run', async ({ page }) => {
    const code = [
      'with open("output.txt", "w") as f:',
      '    f.write("hello from python")',
      'with open("output.txt") as f:',
      '    print(f.read())',
    ].join('\n')
    const tmpFile = await openPyFile(page, code)
    try {
      await waitForReady(page)
      await page.getByRole('button', { name: 'Run code' }).click()
      await expect(page.getByRole('log', { name: 'Program output' })).toContainText(
        'hello from python',
        { timeout: 15_000 },
      )
    } finally {
      unlinkSync(tmpFile)
    }
  })


  test('Stop button appears while code is running and interrupts execution', async ({ page }) => {
    // An infinite loop keeps the runtime in 'running' state indefinitely.
    const tmpFile = await openPyFile(page, 'while True:\n    pass\n')
    try {
      await waitForReady(page)
      await page.getByRole('button', { name: 'Run code' }).click()

      // The Run button should be replaced by a Stop button while running.
      const stopButton = page.getByRole('button', { name: 'Stop execution' })
      await expect(stopButton).toBeVisible({ timeout: 5_000 })
      await expect(page.getByRole('button', { name: 'Run code' })).not.toBeVisible()

      await stopButton.click()

      // After stopping, the runtime should return to ready.
      await expect(page.getByText('● Ready')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('button', { name: 'Run code' })).toBeVisible()
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

// Installs a duck-typed showDirectoryPicker mock backed by a real directory on
// disk. Reads/writes go through Node.js fs functions exposed via exposeFunction,
// so the FSA layer in the IDE is exercised without a native OS file dialog.
// Must be called after page.goto() since it uses page.evaluate().
async function mockShowDirectoryPicker(
  page: import('@playwright/test').Page,
  dirPath: string,
  dirName: string,
) {
  await page.evaluate(({ dir, name }) => {
    function makeFileHandle(fp: string, fn: string): object {
      return {
        kind: 'file',
        name: fn,
        async getFile() {
          const content = await (window as any).__fsRead(fp)
          return new File([content], fn)
        },
        async createWritable() {
          const chunks: string[] = []
          return {
            async write(data: string) { chunks.push(typeof data === 'string' ? data : '') },
            async close() { await (window as any).__fsWrite(fp, chunks.join('')) },
          }
        },
      }
    }
    function makeDirHandle(dp: string, dn: string): object {
      return {
        kind: 'directory',
        name: dn,
        async *entries() {
          const es = await (window as any).__fsReadDir(dp) as { name: string; isDir: boolean }[]
          for (const e of es) {
            const fp = `${dp}/${e.name}`
            yield [e.name, e.isDir ? makeDirHandle(fp, e.name) : makeFileHandle(fp, e.name)]
          }
        },
        async getFileHandle(n: string, _o: { create?: boolean } = {}) { return makeFileHandle(`${dp}/${n}`, n) },
        async getDirectoryHandle(n: string, opts: { create?: boolean } = {}) {
          if (opts?.create) await (window as any).__fsMkdir(`${dp}/${n}`)
          return makeDirHandle(`${dp}/${n}`, n)
        },
        async removeEntry() {},
      }
    }
    ;(window as any).showDirectoryPicker = async () => makeDirHandle(dir, name)
  }, { dir: dirPath, name: dirName })
}

// Tests the full disk round-trip: Python writes → FSA syncs to real disk → external
// edit → Reload picks it up → second Python file reads the updated content.
// Uses a duck-typed showDirectoryPicker mock backed by a real temp directory so
// the File System Access API layer is exercised without a native OS file dialog.
test.describe('disk round-trip via FSA', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    // Expose Node.js fs operations to the browser context for the FSA mock.
    // These must be registered before page.goto().
    await page.exposeFunction('__fsRead', (p: string) => readFileSync(p, 'utf8'))
    await page.exposeFunction('__fsWrite', (p: string, c: string) => { writeFileSync(p, c) })
    await page.exposeFunction('__fsReadDir', (p: string) => {
      try {
        return readdirSync(p, { withFileTypes: true }).map(e => ({ name: e.name, isDir: e.isDirectory() }))
      } catch { return [] }
    })
    await page.exposeFunction('__fsMkdir', (p: string) => mkdirSync(p, { recursive: true }))
    await page.goto('/')
    await page.getByRole('button', { name: 'File', exact: true }).waitFor()
  })

  test('file written by Python can be edited in Monaco and the updated content is read by a second script without reloading', async ({ page }) => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'saarai_fsa_'))
    const projectDir = join(tmpDir, 'myproject')
    mkdirSync(projectDir)
    writeFileSync(join(projectDir, 'writer.py'), 'open("data.txt", "w").write("from python")\nprint("wrote")\n')
    writeFileSync(join(projectDir, 'reader.py'), 'print(open("data.txt").read())\n')

    try {
      await mockShowDirectoryPicker(page, projectDir, 'myproject')

      await page.getByRole('button', { name: 'File', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Open folder…' }).click()
      await waitForReady(page)
      await expect(page.getByText('writer.py', { exact: true })).toBeVisible({ timeout: 10_000 })

      // Run writer.py → data.txt is written to MEMFS and appears in the file tree.
      await page.getByText('writer.py', { exact: true }).click()
      await page.getByRole('button', { name: 'Run code' }).click()
      await expect(page.getByRole('log', { name: 'Program output' })).toContainText('wrote', { timeout: 15_000 })
      await expect(page.getByText('data.txt', { exact: true })).toBeVisible({ timeout: 5_000 })

      // Open data.txt in Monaco and replace its content.
      await page.getByText('data.txt', { exact: true }).click()
      await page.locator('.monaco-editor').click()
      await page.keyboard.press('Control+a')
      await page.keyboard.type('edited in monaco')

      // Save (patches MEMFS so the next Python run sees the updated content).
      await page.getByRole('button', { name: 'File', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Save' }).click()

      // Run reader.py — no reload needed; patchFile already updated MEMFS.
      await page.getByText('reader.py', { exact: true }).click()
      await page.getByRole('button', { name: 'Run code' }).click()
      await expect(page.getByRole('log', { name: 'Program output' })).toContainText(
        'edited in monaco',
        { timeout: 15_000 },
      )
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
