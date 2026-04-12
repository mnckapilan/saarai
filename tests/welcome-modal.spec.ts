import { test, expect } from '@playwright/test'

test.describe('welcome modal', () => {
  test('shows on first load', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Saarai' })).toBeVisible()
  })

  test('contains expected content', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Saarai', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What is this?' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Your files stay with you/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Things to know/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /View source on GitHub/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  })

  test('is dismissed by clicking Get started', async ({ page }) => {
    await page.goto('/')
    const dialog = page.getByRole('dialog', { name: 'Saarai' })
    await expect(dialog).toBeVisible()
    await page.getByRole('button', { name: 'Get started' }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('does not show again after being dismissed in the same session', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.reload()
    await expect(page.getByRole('dialog', { name: 'Saarai' })).not.toBeVisible()
  })

  test('does not show when already seen this session', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Saarai' })).not.toBeVisible()
  })

  test('can be reopened via the About Saarai toolbar button', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('saarai:welcomeSeen', '1')
    })
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Saarai' })).not.toBeVisible()
    await page.getByRole('button', { name: 'About Saarai' }).click()
    await expect(page.getByRole('dialog', { name: 'Saarai' })).toBeVisible()
  })
})
