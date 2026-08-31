/**
 * E2E: session-aware public QR page (EPIC-13).
 *
 * - Anonymous viewer sees the summary only (no internal action).
 * - Staff (dev-mode admin) sees "Registrar recarga" deep-linking to the
 *   unified scanner (/dashboard?scan=1).
 * - An unassigned botellón shows "Sin cliente asignado" (and staff sees the assign link).
 *
 * Requires: NEXT_PUBLIC_AUTH_MODE=dev, dev server running, seed data applied.
 */
import { test, expect, type Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@botellon.com');
  await page.getByLabel('Password').fill('Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/clientes/, { timeout: 15000 });
}

test.describe('Public QR — anonymous viewer', () => {
  test('sees summary but no internal action', async ({ page }) => {
    await page.goto('/b/BOT-00001');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Total recargas')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Registrar recarga' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Asignar cliente' })).toHaveCount(0);
  });

  test('sees "Sin cliente asignado" notice for an unassigned botellón', async ({ page }) => {
    await page.goto('/b/BOT-00003');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Sin cliente asignado')).toBeVisible();
    // Anonymous must not see the internal assign link
    await expect(page.getByRole('link', { name: 'Asignar cliente' })).toHaveCount(0);
  });
});

test.describe('Public QR — staff viewer', () => {
  test('sees "Registrar recarga" deep-linking to the unified scanner', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/b/BOT-00001');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

    const action = page.getByRole('link', { name: 'Registrar recarga' });
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('href', '/dashboard?scan=1');
  });

  test('sees "Asignar cliente" link for an unassigned botellón', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/b/BOT-00003');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

    const assign = page.getByRole('link', { name: 'Asignar cliente' });
    await expect(assign).toBeVisible();
    await expect(assign).toHaveAttribute('href', /\/botellones\/[a-f0-9-]+/);
  });
});
// The old /recargas/nueva wizard (and its botellon_id preselect) was removed in
// the unified-scanner refactor; scanning now accumulates in-place via ScannerModal.
