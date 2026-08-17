/**
 * E2E: session-aware public QR page (EPIC-13).
 *
 * - Anonymous viewer sees the summary only (no internal action).
 * - Staff (dev-mode admin) sees "Registrar recarga" targeting ?botellon_id=.
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
  test('sees "Registrar recarga" targeting ?botellon_id=', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/b/BOT-00001');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

    const action = page.getByRole('link', { name: 'Registrar recarga' });
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('href', /\/recargas\/nueva\?botellon_id=[a-f0-9-]+/);
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

test.describe('Recarga preselect from QR', () => {
  test('botellon_id jumps straight to the confirm step', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/recargas/nueva?botellon_id=8b80b9b7-505b-4030-9652-8167b096b7c5');

    // Preselects the botellón and its client, skipping the search steps
    await expect(page.getByRole('heading', { name: 'Confirmar recarga' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('María Rodríguez')).toBeVisible();
    await expect(page.getByText('BOT-00001')).toBeVisible();
  });
});
