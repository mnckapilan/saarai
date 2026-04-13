import { test, expect } from '@playwright/test'
import { writeFileSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

async function waitForReady(page: import('@playwright/test').Page) {
  await expect(page.getByText('● Ready')).toBeVisible({ timeout: 50_000 })
}

// Installs a duck-typed showDirectoryPicker mock backed by a real directory.
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

test.describe('reload from disk', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    // exposeFunction must be called before page.goto()
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

  test('single file: external edit is reflected in the editor after reload', async ({ page }) => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'saarai_reload_'))
    const projectDir = join(tmpDir, 'myproject')
    mkdirSync(projectDir)
    writeFileSync(join(projectDir, 'script.py'), 'print("original")\n')

    try {
      await mockShowDirectoryPicker(page, projectDir, 'myproject')

      await page.getByRole('button', { name: 'File', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Open folder…' }).click()
      await waitForReady(page)
      await expect(page.getByText('script.py', { exact: true })).toBeVisible({ timeout: 10_000 })

      // Open script.py so it becomes the active file in the editor.
      await page.getByText('script.py', { exact: true }).click()
      await expect.poll(
        () => page.evaluate(() => (window as any).monaco?.editor?.getEditors()[0]?.getModel()?.getValue()),
        { timeout: 5_000 },
      ).toBe('print("original")\n')

      // Externally overwrite the file on disk.
      writeFileSync(join(projectDir, 'script.py'), 'print("updated")\n')

      // Reload from disk — override confirm so no native dialog appears.
      await page.evaluate(() => { window.confirm = () => true })
      await page.getByRole('button', { name: 'File', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Reload from disk' }).click()

      // handleReload calls setCode with the fresh file content since script.py
      // is the active file. Poll Monaco until the editor reflects the update.
      await expect.poll(
        () => page.evaluate(() => (window as any).monaco?.editor?.getEditors()[0]?.getModel()?.getValue()),
        { timeout: 10_000 },
      ).toBe('print("updated")\n')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('folder: external edit to one file is reflected in the editor after reload; other files remain', async ({ page }) => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'saarai_reload_'))
    const projectDir = join(tmpDir, 'myproject')
    mkdirSync(projectDir)
    writeFileSync(join(projectDir, 'main.py'), 'print("main original")\n')
    writeFileSync(join(projectDir, 'helper.py'), 'def greet(): pass\n')

    try {
      await mockShowDirectoryPicker(page, projectDir, 'myproject')

      await page.getByRole('button', { name: 'File', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Open folder…' }).click()
      await waitForReady(page)
      await expect(page.getByText('main.py', { exact: true })).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('helper.py', { exact: true })).toBeVisible()

      // Open main.py as the active file.
      await page.getByText('main.py', { exact: true }).click()
      await expect.poll(
        () => page.evaluate(() => (window as any).monaco?.editor?.getEditors()[0]?.getModel()?.getValue()),
        { timeout: 5_000 },
      ).toBe('print("main original")\n')

      // Externally overwrite main.py on disk.
      writeFileSync(join(projectDir, 'main.py'), 'print("main updated")\n')

      // Reload from disk — override confirm so no native dialog appears.
      await page.evaluate(() => { window.confirm = () => true })
      await page.getByRole('button', { name: 'File', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Reload from disk' }).click()

      // Active file (main.py) should reflect the updated content.
      await expect.poll(
        () => page.evaluate(() => (window as any).monaco?.editor?.getEditors()[0]?.getModel()?.getValue()),
        { timeout: 10_000 },
      ).toBe('print("main updated")\n')

      // The untouched file (helper.py) should still be present in the file tree.
      await expect(page.getByText('helper.py', { exact: true })).toBeVisible()
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
