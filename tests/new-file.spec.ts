import { test, expect, type Page } from '@playwright/test'

const SCRATCH_KEY = 'saarai:scratch'

async function waitForReady(page: Page) {
  await expect(page.getByText('● Ready')).toBeVisible({ timeout: 50_000 })
}

const editorValue = (page: Page) =>
  page.evaluate(() => (window as any).monaco?.editor?.getEditors()[0]?.getModel()?.getValue())

const scratchRaw = (page: Page) =>
  page.evaluate((k) => localStorage.getItem(k), SCRATCH_KEY)

async function menuNewFile(page: Page) {
  await page.getByRole('button', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: 'New file' }).click()
}

async function typeInEditor(page: Page, text: string) {
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(text)
}

const treeFile = (page: Page, name: string) =>
  page.getByRole('tree', { name: 'File explorer' }).getByText(name, { exact: true })

// Runs `fn` while recording dialogs; each is accepted or dismissed per `accept`.
function trackDialogs(page: Page, accept: boolean) {
  const messages: string[] = []
  page.on('dialog', (d) => {
    messages.push(d.message())
    void (accept ? d.accept() : d.dismiss())
  })
  return messages
}

test.describe('new file (scratch workspace)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'File', exact: true }).waitFor()
  })

  test('File menu → New file opens untitled.py in editor and tree', async ({ page }) => {
    await menuNewFile(page)
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
    await expect(treeFile(page, 'untitled.py')).toBeVisible()
    await expect.poll(() => editorValue(page)).toBe('')
    await expect(page.getByRole('tree', { name: 'File explorer' }).getByRole('button', { name: /untitled\.py/ }))
      .toHaveAttribute('aria-current', 'true')
  })

  test('empty-state "New file" button opens untitled.py', async ({ page }) => {
    await expect(page.getByText('No file open')).toBeVisible()
    await page.getByText('No file open').locator('xpath=..').getByRole('button', { name: 'New file' }).click()
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
    await expect(treeFile(page, 'untitled.py')).toBeVisible()
    await expect(page.getByText('No file open')).toHaveCount(0)
  })

  test('typing code and clicking Run executes it', async ({ page }) => {
    await menuNewFile(page)
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
    await typeInEditor(page, 'print("hi")')
    await waitForReady(page)
    await page.getByRole('button', { name: 'Run code' }).click()
    await expect(page.getByRole('log', { name: 'Program output' })).toContainText('hi', { timeout: 15_000 })
  })

  test('scratch content persists across reload', async ({ page }) => {
    await menuNewFile(page)
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
    await typeInEditor(page, 'x = 123')
    await expect.poll(() => scratchRaw(page)).toContain('x = 123')

    await page.reload()
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
    await expect(treeFile(page, 'untitled.py')).toBeVisible()
    await expect.poll(() => editorValue(page)).toBe('x = 123')
  })

  test('renaming untitled.py to main.py stays top-level, keeps content, persists', async ({ page }) => {
    await menuNewFile(page)
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
    await typeInEditor(page, 'y = 7')
    await expect.poll(() => scratchRaw(page)).toContain('y = 7')

    const row = page.getByRole('tree', { name: 'File explorer' }).getByRole('button', { name: /untitled\.py/ })
    await row.hover()
    await row.getByTitle('Rename').click()
    const input = page.getByRole('tree', { name: 'File explorer' }).locator('input')
    await input.fill('main.py')
    await input.press('Enter')

    await expect(treeFile(page, 'main.py')).toBeVisible()
    await expect(treeFile(page, 'untitled.py')).toHaveCount(0)
    await expect(treeFile(page, 'untitled.p')).toHaveCount(0)
    await expect.poll(() => editorValue(page)).toBe('y = 7')
    await expect.poll(async () => {
      const s = JSON.parse((await scratchRaw(page)) ?? 'null')
      return s && { files: s.files, active: s.active }
    }).toEqual({ files: [['main.py', 'y = 7']], active: 'main.py' })

    await page.reload()
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
    await expect(treeFile(page, 'main.py')).toBeVisible()
    await expect(treeFile(page, 'untitled.py')).toHaveCount(0)
    await expect.poll(() => editorValue(page)).toBe('y = 7')
  })

  // Regression: edits to a non-active scratch file must reach MEMFS before a run,
  // otherwise `import helper` sees an empty helper.py.
  test('second top-level file from explorer header is importable without running it first', async ({ page }) => {
    await menuNewFile(page)
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })

    // Make the active file top-level then use the header "New file" button.
    await page.getByRole('tree', { name: 'File explorer' }).locator('xpath=..').getByTitle('New file').first().click()
    const input = page.getByRole('tree', { name: 'File explorer' }).locator('input')
    await input.fill('helper.py')
    await input.press('Enter')
    await expect(treeFile(page, 'helper.py')).toBeVisible()

    // New file becomes active; fill it.
    await expect.poll(() => editorValue(page)).toBe('')
    await typeInEditor(page, 'X = 42')
    await expect.poll(() => scratchRaw(page)).toContain('X = 42')

    // Back to untitled.py.
    await treeFile(page, 'untitled.py').click()
    await expect.poll(() => editorValue(page)).toBe('')
    await typeInEditor(page, 'from helper import X; print(X)')

    await waitForReady(page)
    await page.getByRole('button', { name: 'Run code' }).click()
    await expect(page.getByRole('log', { name: 'Program output' })).toContainText('42', { timeout: 15_000 })
  })

  test('confirm on discard: dismiss keeps content, accept resets', async ({ page }) => {
    await menuNewFile(page)
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
    await typeInEditor(page, 'keep = 1')
    await expect.poll(() => scratchRaw(page)).toContain('keep = 1')

    const dismissed = trackDialogs(page, false)
    await menuNewFile(page)
    await expect.poll(() => dismissed.length).toBe(1)
    expect(dismissed[0]).toContain('Discard')
    expect(await editorValue(page)).toBe('keep = 1')
    expect(await scratchRaw(page)).toContain('keep = 1')

    page.removeAllListeners('dialog')
    const accepted = trackDialogs(page, true)
    await menuNewFile(page)
    await expect.poll(() => accepted.length).toBe(1)
    await expect.poll(() => editorValue(page)).toBe('')
    await expect(treeFile(page, 'untitled.py')).toBeVisible()
    await expect.poll(() => scratchRaw(page)).not.toContain('keep = 1')
  })

  test('no confirm dialog when scratch is empty', async ({ page }) => {
    await menuNewFile(page)
    await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
    const dialogs = trackDialogs(page, true)
    await menuNewFile(page)
    await expect(treeFile(page, 'untitled.py')).toBeVisible()
    await page.waitForTimeout(500)
    expect(dialogs).toEqual([])
  })
})
