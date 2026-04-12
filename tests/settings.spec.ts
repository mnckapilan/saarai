import { test, expect } from '@playwright/test'

test.describe('settings modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
      localStorage.removeItem('saarai:theme')
      localStorage.removeItem('saarai:bracketColorization')
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('dialog').waitFor()
  })

  test('shows expected setting rows', async ({ page }) => {
    await expect(page.getByText('Light mode')).toBeVisible()
    await expect(page.getByText('Bracket colors')).toBeVisible()
  })

  test('light mode toggle starts off (dark theme is default)', async ({ page }) => {
    await expect(page.getByRole('switch', { name: /Light mode/ })).toHaveAttribute('aria-checked', 'false')
  })

  test('light mode toggle switches the theme to light', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: /Light mode/ })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(theme).toBe('light')
  })

  test('light mode toggle can be turned back off', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: /Light mode/ })
    await toggle.click()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(theme).toBe('dark')
  })

  test('bracket colors toggle starts on by default', async ({ page }) => {
    await expect(page.getByRole('switch', { name: /Bracket colors/ })).toHaveAttribute('aria-checked', 'true')
  })

  test('bracket colors toggle can be switched off', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: /Bracket colors/ })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  test('closes when Escape is pressed', async ({ page }) => {
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('theme change in settings is reflected in the toolbar button label', async ({ page }) => {
    await page.getByRole('switch', { name: /Light mode/ }).click()
    // Toolbar button should now offer to switch back to dark
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible()
  })
})
