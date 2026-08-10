/**
 * E2E Login Flow (task 3.5)
 *
 * Full end-to-end test: visit / → redirected to /login → authenticate → /dashboard
 * Requires: Supabase project running, admin seed applied, valid .env.local
 */
import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test('redirects from / to /login when unauthenticated', async ({ page }) => {
    await page.goto('/')

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Botellón' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('shows validation error for empty email', async ({ page }) => {
    await page.goto('/login')

    // Submit with empty email but valid password
    await page.getByLabel('Password').fill('validPassword123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Email is required')).toBeVisible()
  })

  test('shows validation error for short password', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('12345')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(
      page.getByText('Password must be at least 6 characters')
    ).toBeVisible()
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login')

    // Seed credentials: admin@botellon.com / Admin123!
    await page.getByLabel('Email').fill('admin@botellon.com')
    await page.getByLabel('Password').fill('Admin123!')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('wrong@email.com')
    await page.getByLabel('Password').fill('WrongPass1')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid email or password')).toBeVisible()
    // Should still be on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('login form is usable at 320px viewport (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/login')

    const form = page.getByRole('button', { name: 'Sign in' })
    await expect(form).toBeVisible()

    // Check no horizontal overflow on the form container
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(320)
  })
})
