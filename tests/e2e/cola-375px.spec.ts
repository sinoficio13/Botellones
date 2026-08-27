/**
 * E2E — REQ-COS-21: no horizontal scroll at 375px (spec §6.3, scenario
 * "No horizontal scroll at 375px").
 *
 * Requires: NEXT_PUBLIC_AUTH_MODE=dev (dev-mode login cookie — no Supabase
 * auth call), dev server running, hosted Supabase reachable for the queue
 * fetch. Same environment dependency as login.spec.ts / business-flows.spec.ts.
 *
 * RED against the pre-swap page: the fase-3 queue signature (tablist or
 * first-use empty) does not exist on the old kanban, so this spec fails until
 * Slice E lands the page swap.
 */
import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@botellon.com');
  await page.getByLabel('Password').fill('Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/clientes/, { timeout: 15000 });
}

test.describe('Cola 375px — REQ-COS-21', () => {
  test('renders the new queue at 375px with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await page.goto('/dashboard');

    // New-queue signature: tabs (queue with data) OR the first-use empty with
    // [📷 Escanear] (empty queue) — either proves the shell replaced the kanban.
    await expect(
      page.getByRole('tablist').or(page.getByRole('button', { name: '📷 Escanear' }))
    ).toBeVisible({ timeout: 15000 });

    // Loading is a skeleton; once the shell settles, nothing overflows 375px.
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });
});