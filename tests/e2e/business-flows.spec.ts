/**
 * E2E Business Flow Tests — Critical Paths
 * Requires: NEXT_PUBLIC_AUTH_MODE=dev, dev server running.
 */
import { test, expect } from '@playwright/test';

async function login(page: any) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@botellon.com');
  await page.getByLabel('Password').fill('Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Recarga flow', () => {
  test('3-step wizard', async ({ page }) => {
    await login(page);
    await page.goto('/recargas/nueva');

    await expect(page.getByText('Buscar cliente')).toBeVisible();
    await page.getByPlaceholder('Nombre, código o teléfono…').fill('María');
    await page.waitForTimeout(600);
    await page.locator('button:has-text("María Rodríguez")').first().click();

    await expect(page.getByRole('heading', { name: 'Seleccionar botellón' })).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("BOT-")').first().click();

    await expect(page.getByRole('heading', { name: 'Confirmar recarga' })).toBeVisible();
    await page.getByRole('button', { name: /confirmar recarga/i }).click();
    await expect(page.getByText('Recarga registrada')).toBeVisible({ timeout: 10000 });
  });

  test('quick recarga from client list', async ({ page }) => {
    await login(page);
    await page.goto('/clientes');
    const row = page.getByRole('row', { name: /Carlos Pérez/ });
    await row.getByText('+ Recarga').click();

    await expect(page).toHaveURL(/cliente_id=/);
    await expect(page.getByRole('heading', { name: 'Seleccionar botellón' })).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("BOT-")').first().click();
    await page.getByRole('button', { name: /confirmar recarga/i }).click();
    await expect(page.getByText('Recarga registrada')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Client CRUD', () => {
  test('create and verify', async ({ page }) => {
    await login(page);
    await page.goto('/clientes/nuevo');
    const s = Date.now().toString().slice(-4);
    await page.getByLabel('Nombre *').fill(`T${s}`);
    await page.getByLabel('Teléfono 1 *').fill(`58414000${s}`);
    await page.getByRole('button', { name: 'Crear cliente' }).click();
    await expect(page).toHaveURL(/\/clientes\//, { timeout: 10000 });
    await expect(page.getByText(`T${s}`)).toBeVisible();
  });

  test('edit from detail tab', async ({ page }) => {
    await login(page);
    await page.goto('/clientes');
    await page.locator('a[href*="/clientes/"]').first().click();
    await expect(page).toHaveURL(/\/clientes\//);
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Observaciones').fill('E2E OK');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cambios guardados')).toBeVisible({ timeout: 5000 });
  });

  test('search filters results', async ({ page }) => {
    await login(page);
    await page.goto('/clientes');
    await page.getByPlaceholder('Buscar por nombre').fill('Ferretería');
    await page.waitForTimeout(600);
    await expect(page.getByText('Carlos Pérez')).toBeVisible();
    await expect(page.getByText('María Rodríguez')).not.toBeVisible();
  });
});

test.describe('Public QR', () => {
  test('accessible without login', async ({ page }) => {
    await page.goto('/b/BOT-00001');
    await expect(page.locator('text=BOT-00001').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Total recargas')).toBeVisible();
    await expect(page.getByText('María Rodríguez')).not.toBeVisible();
  });
});

test.describe('Botellones', () => {
  test('list with states', async ({ page }) => {
    await login(page);
    await page.goto('/botellones');
    await expect(page.getByText('BOT-').first()).toBeVisible();
    await expect(page.getByText('disponible').first()).toBeVisible();
  });

  test('change state', async ({ page }) => {
    await login(page);
    await page.goto('/botellones');
    await page.locator('a[href*="/botellones/"]').first().click();
    await expect(page).toHaveURL(/\/botellones\//);
    const sel = page.getByLabel('Cambiar estado');
    if (await sel.isVisible()) {
      await sel.selectOption('mantenimiento');
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(page.getByText('Cambios guardados')).toBeVisible({ timeout: 5000 });
    }
  });
});
