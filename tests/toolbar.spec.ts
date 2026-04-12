import { test, expect } from '@playwright/test'

test.describe('toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
      // Clear persisted state so tests start from known defaults
      localStorage.removeItem('saarai:theme')
      localStorage.removeItem('python-ide:fontSize')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'File', exact: true }).waitFor()
  })

  test('run button is disabled when no file is open', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Run code' })).toBeDisabled()
  })

  test('starts in dark theme by default', async ({ page }) => {
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(theme).toBe('dark')
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
  })

  test('theme toggle switches to light mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible()
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(theme).toBe('light')
  })

  test('theme toggle switches back to dark mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(theme).toBe('dark')
  })

  test('font size defaults to 14', async ({ page }) => {
    await expect(page.getByLabel('Font size 14')).toBeVisible()
  })

  test('decrease font size button reduces the size', async ({ page }) => {
    await page.getByRole('button', { name: 'Decrease font size' }).click()
    await expect(page.getByLabel('Font size 13')).toBeVisible()
  })

  test('increase font size button increases the size', async ({ page }) => {
    await page.getByRole('button', { name: 'Increase font size' }).click()
    await expect(page.getByLabel('Font size 15')).toBeVisible()
  })

  test('font size can be changed multiple times', async ({ page }) => {
    await page.getByRole('button', { name: 'Increase font size' }).click()
    await page.getByRole('button', { name: 'Increase font size' }).click()
    await page.getByRole('button', { name: 'Decrease font size' }).click()
    await expect(page.getByLabel('Font size 15')).toBeVisible()
  })

  test('file menu opens and shows Open file and Open folder items', async ({ page }) => {
    await page.getByRole('button', { name: 'File', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Open file…' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Open folder…' })).toBeVisible()
  })

  test('file menu closes when clicking outside', async ({ page }) => {
    await page.getByRole('button', { name: 'File', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Open file…' })).toBeVisible()
    await page.mouse.click(0, 0)
    await expect(page.getByRole('menuitem', { name: 'Open file…' })).not.toBeVisible()
  })

  test('file menu closes when pressing Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'File', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Open file…' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menuitem', { name: 'Open file…' })).not.toBeVisible()
  })

  test('settings button opens the settings modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('output panel shows placeholder text initially', async ({ page }) => {
    await expect(page.getByText('Run your code to see output here…')).toBeVisible()
  })

  test('no file open state is shown in the editor area initially', async ({ page }) => {
    await expect(page.getByText('No file open')).toBeVisible()
  })
})
