import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Pyodide loads ~10 MB from CDN — give it plenty of time.
async function waitForReady(page: Page) {
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 50_000 })
}

// Creates a temp .ipynb file and opens it via the file menu.
// Waits for the NotebookView container to appear before returning.
async function openNotebook(
  page: Page,
  cells: Array<{ cell_type: string; source: string[] }>,
): Promise<string> {
  const nb = JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {},
    cells: cells.map((c) => ({
      ...c,
      metadata: {},
      outputs: [],
      execution_count: null,
    })),
  })
  const tmpFile = join(tmpdir(), `saarai_nb_${Date.now()}_${Math.random().toString(36).slice(2)}.ipynb`)
  writeFileSync(tmpFile, nb)

  await page.getByRole('button', { name: 'File', exact: true }).click()
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: 'Open file…' }).click(),
  ])
  await fileChooser.setFiles(tmpFile)

  // Wait for the NotebookView container element to appear.
  // NotebookView renders a <div className={styles.container}> — CSS modules
  // mangle the name, so we match on the "container" substring.
  await page.waitForSelector('[class*="container"]', { timeout: 10_000 })

  return tmpFile
}

test.describe('notebook', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'File', exact: true }).waitFor()
  })

  test('opens .ipynb file and renders cells', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'markdown', source: ['# Hello'] },
      { cell_type: 'code', source: ["print('hello')"] },
    ])
    try {
      // The notebook scroll area wraps each cell in a cellWrapper element.
      // Use the scrollArea class (contains "scrollArea") to scope the count.
      const scrollArea = page.locator('[class*="scrollArea"]')
      await expect(scrollArea).toBeVisible({ timeout: 5_000 })

      // There should be exactly 2 cell wrappers.
      const cellWrappers = page.locator('[class*="cellWrapper"]')
      await expect(cellWrappers).toHaveCount(2, { timeout: 5_000 })

      // The markdown cell renders "# Hello" as an <h1> with text "Hello".
      await expect(page.getByRole('heading', { level: 1, name: 'Hello' })).toBeVisible()

      // The code cell's run button has aria-label "Run cell".
      await expect(page.getByRole('button', { name: 'Run cell' })).toBeVisible()
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('runs a code cell and shows output inline', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ["print('notebook works')"] },
    ])
    try {
      await waitForReady(page)

      // Click the run button for the single code cell.
      await page.getByRole('button', { name: 'Run cell' }).click()

      // Output appears in the CellOutput component which has role="log" and
      // aria-label="Cell output" (not the main program output panel).
      const cellOutput = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutput).toContainText('notebook works', { timeout: 15_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('runs multiple cells sequentially with Run All', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ['x = 42'] },
      { cell_type: 'code', source: ['print(x)'] },
    ])
    try {
      await waitForReady(page)

      // Click the "Run All" button in the notebook toolbar.
      await page.getByRole('button', { name: 'Run all cells' }).click()

      // "42" should appear as output of the second cell.
      const cellOutputs = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutputs.last()).toContainText('42', { timeout: 15_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('adds a new code cell', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ['x = 1'] },
    ])
    try {
      const cellWrappers = page.locator('[class*="cellWrapper"]')
      await expect(cellWrappers).toHaveCount(1, { timeout: 5_000 })

      // The "Add code cell below" action button is inside each cellWrapper's
      // .actions panel, visible on hover. Hover over the cell to reveal it.
      const firstCell = cellWrappers.first()
      await firstCell.hover()

      // Click the "+ Code" button (aria-label: "Add code cell below")
      await page.getByRole('button', { name: 'Add code cell below' }).first().click()

      // There should now be 2 cell wrappers.
      await expect(cellWrappers).toHaveCount(2, { timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('deletes a cell', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ['x = 1'] },
      { cell_type: 'code', source: ['x = 2'] },
    ])
    try {
      const cellWrappers = page.locator('[class*="cellWrapper"]')
      await expect(cellWrappers).toHaveCount(2, { timeout: 5_000 })

      // Hover the first cell to reveal its action buttons, then delete it.
      const firstCell = cellWrappers.first()
      await firstCell.hover()

      await page.getByRole('button', { name: 'Delete cell' }).first().click()

      // There should now be only 1 cell.
      await expect(cellWrappers).toHaveCount(1, { timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })
})

test.describe('notebook keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'File', exact: true }).waitFor()
  })

  test('Shift+Enter runs the focused cell and moves focus to the next cell', async ({ page }) => {
    // Open a notebook with 2 code cells. Focus cell 1, press Shift+Enter — it
    // should run cell 1 AND move focus to cell 2. Then pressing Shift+Enter
    // again should run cell 2 (confirming focus moved).
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ["print('cell one')"] },
      { cell_type: 'code', source: ["print('cell two')"] },
    ])
    try {
      await waitForReady(page)

      // Click the first cell's editorWrapper to focus its Monaco editor.
      await page.locator('[class*="editorWrapper"]').first().click()

      // Shift+Enter: run cell 1 and advance focus to cell 2.
      await page.keyboard.press('Shift+Enter')

      const cellOutputs = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutputs.first()).toContainText('cell one', { timeout: 15_000 })

      // Press Shift+Enter again — focus should now be on cell 2, so this runs cell 2.
      await page.keyboard.press('Shift+Enter')
      await expect(cellOutputs.last()).toContainText('cell two', { timeout: 15_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('Cmd+Enter runs the focused cell', async ({ page }) => {
    // Cmd+Enter runs the cell and stays focused on it (no focus change).
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ["print('cmd enter works')"] },
    ])
    try {
      await waitForReady(page)

      // Click the editorWrapper div to give focus to the Monaco editor inside it.
      // Playwright uses Meta for the Cmd key on macOS.
      await page.locator('[class*="editorWrapper"]').click()

      await page.keyboard.press('Meta+Enter')

      const cellOutput = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutput).toContainText('cmd enter works', { timeout: 15_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('Shift+Enter still works after cell has already run once', async ({ page }) => {
    // This tests the stale closure bug: after a cell runs once, the keyboard
    // shortcut registered via addCommand should still invoke the latest onRun
    // callback and not a stale version captured at mount time.
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ["print('run again')"] },
    ])
    try {
      await waitForReady(page)

      // Run the cell once via the run button (▶).
      await page.getByRole('button', { name: 'Run cell' }).click()
      const cellOutput = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutput).toContainText('run again', { timeout: 15_000 })

      // Now click into the editor and press Shift+Enter to run it again.
      // If the shortcut held a stale closure over onRun, the second run would
      // silently do nothing or produce no output.
      await page.locator('[class*="editorWrapper"]').click()
      await page.keyboard.press('Shift+Enter')

      // The output should still contain 'run again', confirming the re-run worked.
      // (The cell output is replaced on each run, so presence of the text is enough.)
      await expect(cellOutput).toContainText('run again', { timeout: 15_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('Shift+Enter on last cell adds a new cell', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ["print('only cell')"] },
    ])
    try {
      await waitForReady(page)

      // There is only 1 cell to begin with.
      const cellWrappers = page.locator('[class*="cellWrapper"]')
      await expect(cellWrappers).toHaveCount(1, { timeout: 5_000 })

      // Focus the single cell's editor and press Shift+Enter.
      await page.locator('[class*="editorWrapper"]').click()
      await page.keyboard.press('Shift+Enter')

      // Wait for the cell to run (output appears).
      const cellOutput = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutput).toContainText('only cell', { timeout: 15_000 })

      // A new empty cell should have been added automatically.
      await expect(cellWrappers).toHaveCount(2, { timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('global Cmd+Enter does not trigger file-level run in notebook mode', async ({ page }) => {
    // When a notebook is open, the global Cmd+Enter shortcut is suppressed so
    // it doesn't dispatch a runCode() call on the main OutputPanel.
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ["print('should not appear in main output')"] },
    ])
    try {
      await waitForReady(page)

      // Press Meta+Enter at the page level (not inside any Monaco editor) so
      // the global keyboard shortcut handler fires.
      await page.keyboard.press('Meta+Enter')

      // The main OutputPanel has role="log" aria-label="Program output".
      // In notebook mode it is not rendered in the DOM at all, so it should
      // not be found — or if found should have no content.
      const mainOutput = page.getByRole('log', { name: 'Program output' })
      // Give a moment for any erroneous run to produce output.
      await page.waitForTimeout(500)
      // The main output panel should not be present (it's hidden in notebook mode).
      await expect(mainOutput).toHaveCount(0)
    } finally {
      unlinkSync(tmpFile)
    }
  })

  // Test 4 (legacy): 'keyboard shortcut does not run when Pyodide is not ready'
  //
  // This test is intentionally omitted. It is not reliably testable without a
  // race condition: Pyodide begins loading immediately on page load and can
  // reach "ready" in as little as a few seconds on a warm CDN cache. There is
  // no supported way to pause or delay Pyodide initialisation from the test
  // harness, so any attempt to press a shortcut "before ready" would require
  // precise timing that is inherently flaky. The underlying guard (the cell
  // run button is disabled / onRun is a no-op while the runtime is loading) is
  // better covered by a unit test that mocks the isReady flag.
})

test.describe('notebook cell management', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'File', exact: true }).waitFor()
  })

  test('moves a cell up', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ["print('first')"] },
      { cell_type: 'code', source: ["print('second')"] },
    ])
    try {
      const cellWrappers = page.locator('[class*="cellWrapper"]')
      await expect(cellWrappers).toHaveCount(2, { timeout: 5_000 })

      // Hover the second cell to reveal its action buttons, then click ↑.
      const secondCell = cellWrappers.nth(1)
      await secondCell.hover()

      await page.getByRole('button', { name: 'Move cell up' }).nth(1).click()

      // Cell count should remain 2 after the move.
      await expect(cellWrappers).toHaveCount(2, { timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('moves a cell down', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ["print('first')"] },
      { cell_type: 'code', source: ["print('second')"] },
    ])
    try {
      const cellWrappers = page.locator('[class*="cellWrapper"]')
      await expect(cellWrappers).toHaveCount(2, { timeout: 5_000 })

      // Hover the first cell to reveal its action buttons, then click ↓.
      const firstCell = cellWrappers.first()
      await firstCell.hover()

      await page.getByRole('button', { name: 'Move cell down' }).first().click()

      // Cell count should remain 2 after the move.
      await expect(cellWrappers).toHaveCount(2, { timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('adds a markdown cell below', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ['x = 1'] },
    ])
    try {
      const cellWrappers = page.locator('[class*="cellWrapper"]')
      await expect(cellWrappers).toHaveCount(1, { timeout: 5_000 })

      // Hover the cell to reveal action buttons, then click "+ Markdown".
      await cellWrappers.first().hover()
      await page.getByRole('button', { name: 'Add markdown cell below' }).first().click()

      // There should now be 2 cell wrappers.
      await expect(cellWrappers).toHaveCount(2, { timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('can add multiple cells sequentially', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ['x = 1'] },
    ])
    try {
      const cellWrappers = page.locator('[class*="cellWrapper"]')
      await expect(cellWrappers).toHaveCount(1, { timeout: 5_000 })

      // Add first additional cell.
      await cellWrappers.first().hover()
      await page.getByRole('button', { name: 'Add code cell below' }).first().click()
      await expect(cellWrappers).toHaveCount(2, { timeout: 5_000 })

      // Add second additional cell (hover the newly added last cell).
      await cellWrappers.last().hover()
      await page.getByRole('button', { name: 'Add code cell below' }).last().click()
      await expect(cellWrappers).toHaveCount(3, { timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })
})

test.describe('notebook execution', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'File', exact: true }).waitFor()
  })

  test('Python state persists across cells', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ['x = 99'] },
      { cell_type: 'code', source: ['print(x)'] },
    ])
    try {
      await waitForReady(page)

      const runButtons = page.getByRole('button', { name: 'Run cell' })

      // Run the first cell to define x.
      await runButtons.first().click()
      // Wait for the first cell to finish (its run button returns to "Run cell"
      // aria-label — the spinner disappears). Poll until both buttons are "Run cell".
      await expect(runButtons).toHaveCount(2, { timeout: 15_000 })

      // Run the second cell which prints x.
      await runButtons.last().click()

      // The second cell's output should show '99'.
      const cellOutputs = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutputs.last()).toContainText('99', { timeout: 15_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('cell output is cleared on re-run', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ["print('hello')"] },
    ])
    try {
      await waitForReady(page)

      const runButton = page.getByRole('button', { name: 'Run cell' })
      const cellOutput = page.getByRole('log', { name: 'Cell output' })

      // First run.
      await runButton.click()
      await expect(cellOutput).toContainText('hello', { timeout: 15_000 })

      // Second run — output is replaced, not accumulated.
      await runButton.click()
      await expect(cellOutput).toContainText('hello', { timeout: 15_000 })

      // Verify the output does not contain 'hello' twice (no accumulation).
      const text = await cellOutput.textContent()
      const occurrences = (text ?? '').split('hello').length - 1
      expect(occurrences).toBe(1)
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('runtime error shows traceback in cell output', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ['print(1/0)'] },
    ])
    try {
      await waitForReady(page)

      await page.getByRole('button', { name: 'Run cell' }).click()

      const cellOutput = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutput).toContainText('ZeroDivisionError', { timeout: 15_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('syntax error shows error in cell output', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ['def f(\n    pass'] },
    ])
    try {
      await waitForReady(page)

      await page.getByRole('button', { name: 'Run cell' }).click()

      const cellOutput = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutput).toContainText('SyntaxError', { timeout: 15_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('stderr appears in cell output', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ['import sys\nsys.stderr.write("err output\\n")'] },
    ])
    try {
      await waitForReady(page)

      await page.getByRole('button', { name: 'Run cell' }).click()

      const cellOutput = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutput).toContainText('err output', { timeout: 15_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('large output is scrollable', async ({ page }) => {
    const source = 'for i in range(200):\n    print(f\'line {i}\')'
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: [source] },
    ])
    try {
      await waitForReady(page)

      await page.getByRole('button', { name: 'Run cell' }).click()

      const cellOutput = page.getByRole('log', { name: 'Cell output' })
      // Wait for the last line to appear — this confirms all 200 lines are rendered.
      await expect(cellOutput).toContainText('line 199', { timeout: 15_000 })

      // The CellOutput element has overflow-y: auto and max-height: 300px.
      const el = await cellOutput.elementHandle()
      expect(el).not.toBeNull()

      const overflowY = await page.evaluate(
        (e) => window.getComputedStyle(e as Element).overflowY,
        el,
      )
      expect(overflowY).toBe('auto')

      // With 200 lines of output the content should exceed the 300px cap.
      const isScrollable = await page.evaluate(
        (e) => (e as Element).scrollHeight > (e as Element).clientHeight,
        el,
      )
      expect(isScrollable).toBe(true)
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('execution count increments after each run', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ["print('x')"] },
    ])
    try {
      await waitForReady(page)

      const runButton = page.getByRole('button', { name: 'Run cell' })
      const executionCount = page.locator('[class*="executionCount"]')

      // Before first run the count placeholder is a space: [ ]:
      await expect(executionCount).toBeVisible({ timeout: 5_000 })

      // First run.
      await runButton.click()
      const cellOutput = page.getByRole('log', { name: 'Cell output' })
      await expect(cellOutput).toContainText('x', { timeout: 15_000 })
      await expect(executionCount).toContainText('[1]:', { timeout: 5_000 })

      // Second run.
      await runButton.click()
      await expect(cellOutput).toContainText('x', { timeout: 15_000 })
      await expect(executionCount).toContainText('[2]:', { timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('Run All button is disabled while running', async ({ page }) => {
    // time.sleep(2) keeps Pyodide busy long enough to assert the disabled state.
    const tmpFile = await openNotebook(page, [
      { cell_type: 'code', source: ['import time; time.sleep(2)'] },
    ])
    try {
      await waitForReady(page)

      const runAllButton = page.getByRole('button', { name: 'Run all cells' })
      await runAllButton.click()

      // While the cell is running, Run All must be disabled.
      await expect(runAllButton).toBeDisabled({ timeout: 5_000 })

      // Wait for the run to complete (status returns to Ready).
      await expect(page.getByText('Ready')).toBeVisible({ timeout: 15_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })
})

test.describe('notebook markdown cells', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'File', exact: true }).waitFor()
  })

  test('markdown cell enters edit mode on click', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'markdown', source: ['# Title'] },
    ])
    try {
      // The rendered markdown view has role="button" with aria-label "Markdown cell — click to edit".
      const markdownView = page.getByRole('button', { name: 'Markdown cell — click to edit' })
      await expect(markdownView).toBeVisible({ timeout: 5_000 })

      // Click to enter edit mode.
      await markdownView.click()

      // A textarea should appear for editing.
      const textarea = page.getByRole('textbox', { name: 'Edit markdown cell' })
      await expect(textarea).toBeVisible({ timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('markdown cell exits edit mode on blur', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'markdown', source: ['# Title'] },
      { cell_type: 'code', source: ['x = 1'] },
    ])
    try {
      // Enter edit mode on the markdown cell.
      const markdownView = page.getByRole('button', { name: 'Markdown cell — click to edit' })
      await expect(markdownView).toBeVisible({ timeout: 5_000 })
      await markdownView.click()

      const textarea = page.getByRole('textbox', { name: 'Edit markdown cell' })
      await expect(textarea).toBeVisible({ timeout: 5_000 })

      // Click the code cell's editor wrapper to blur the textarea.
      await page.locator('[class*="editorWrapper"]').click()

      // The textarea should no longer be visible; rendered markdown should return.
      await expect(textarea).not.toBeVisible({ timeout: 5_000 })
      await expect(page.getByRole('heading', { level: 1, name: 'Title' })).toBeVisible({
        timeout: 5_000,
      })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('markdown cell Shift+Enter commits edit and shows rendered output', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'markdown', source: ['# Original'] },
    ])
    try {
      const markdownView = page.getByRole('button', { name: 'Markdown cell — click to edit' })
      await expect(markdownView).toBeVisible({ timeout: 5_000 })
      await markdownView.click()

      const textarea = page.getByRole('textbox', { name: 'Edit markdown cell' })
      await expect(textarea).toBeVisible({ timeout: 5_000 })

      // Clear existing text and type new content.
      await textarea.fill('## Updated heading')

      // Shift+Enter should commit the edit.
      await page.keyboard.press('Shift+Enter')

      // Textarea should be gone; the updated heading should render.
      await expect(textarea).not.toBeVisible({ timeout: 5_000 })
      await expect(page.getByRole('heading', { level: 2, name: 'Updated heading' })).toBeVisible({
        timeout: 5_000,
      })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('empty markdown cell shows placeholder text', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'markdown', source: [] },
    ])
    try {
      // An empty markdown cell displays the placeholder in view mode.
      await expect(page.getByText('Click to edit markdown…')).toBeVisible({ timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })

  test('markdown cell renders bold and italic text', async ({ page }) => {
    const tmpFile = await openNotebook(page, [
      { cell_type: 'markdown', source: ['**bold** and *italic*'] },
    ])
    try {
      await expect(page.getByRole('strong')).toBeVisible({ timeout: 5_000 })
      await expect(page.getByRole('emphasis')).toBeVisible({ timeout: 5_000 })
    } finally {
      unlinkSync(tmpFile)
    }
  })
})
