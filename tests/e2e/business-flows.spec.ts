/**
 * E2E Business Flow Tests — Critical Paths
 * Requires: NEXT_PUBLIC_AUTH_MODE=dev, dev server running.
 */
import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@botellon.com');
  await page.getByLabel('Password').fill('Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/clientes/, { timeout: 15000 });
}

test.describe('Recarga flow', () => {
  test('3-step wizard', async ({ page }) => {
    await login(page);
    await page.goto('/recargas/nueva');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Buscar cliente')).toBeVisible();
    await page.getByPlaceholder('Nombre, código o teléfono…').fill('María');
    // Wait for debounced search (useDebounce 300ms + network)
    await page.waitForTimeout(800);
    // Force-click to bypass Next.js dev overlay on mobile
    await page.locator('button:has-text("María Rodríguez")').first().click({ force: true });

    await expect(page.getByRole('heading', { name: 'Seleccionar botellón' })).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("BOT-")').first().click();

    await expect(page.getByRole('heading', { name: 'Confirmar recarga' })).toBeVisible();
    await page.getByRole('button', { name: /confirmar recarga/i }).click();
    await expect(page.getByText('Recarga registrada')).toBeVisible({ timeout: 10000 });
  });

  test('quick recarga from client list', async ({ page }) => {
    await login(page);
    await page.goto('/clientes');
    // Search for Carlos Pérez directly instead of relying on pagination
    await page.getByPlaceholder(/Buscar por nombre/).fill('Carlos');
    await page.getByPlaceholder(/Buscar por nombre/).press('Enter');
    await page.waitForLoadState('networkidle');
    const row = page.getByRole('row', { name: /Carlos Pérez/ });
    await row.getByText('+ Recarga').click();

    await expect(page).toHaveURL(/cliente_id=/);
    // Wait for async client lookup + botellones fetch to complete
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Seleccionar botellón')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("BOT-")').first().click();
    await page.getByRole('button', { name: /confirmar recarga/i }).click();
    await expect(page.getByText('Recarga registrada')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Client CRUD', () => {
  test('create and verify', async ({ page }) => {
    await login(page);
    await page.goto('/clientes/nuevo');
    await page.waitForLoadState('networkidle');
    const s = Date.now().toString().slice(-4);
    await page.getByLabel('Nombre *').fill(`T${s}`);
    await page.getByLabel('Teléfono 1 *').fill(`58414000${s}`);
    await page.getByRole('button', { name: 'Crear cliente' }).click();
    await page.waitForURL(/\/clientes\//, { timeout: 10000 });
    // Wait for streaming to deliver the actual page (not the skeleton)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`T${s}`)).toBeVisible({ timeout: 5000 });
  });

  test('edit from detail tab', async ({ page }) => {
    await login(page);
    await page.goto('/clientes');
    await page.waitForLoadState('networkidle');
    await page.locator('a[href*="/clientes/"]').first().click();
    await page.waitForURL(/\/clientes\//, { timeout: 10000 });
    // Wait for streaming to deliver the actual page (not the skeleton)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
    // Editar button is inside DatosTab client component
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Observaciones').fill('E2E OK');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Cambios guardados')).toBeVisible({ timeout: 5000 });
  });

  test('search filters results', async ({ page }) => {
    await login(page);
    await page.goto('/clientes');
    // Search: Ferretería (Carlos Pérez has negocio "Ferretería Pérez")
    const searchInput = page.getByPlaceholder(/Buscar por nombre/);
    await searchInput.fill('Ferretería');
    await searchInput.press('Enter'); // Submit the GET form
    await page.waitForLoadState('networkidle');
    // Carlos should appear in filtered results
    await expect(page.getByText('Carlos Pérez')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('María Rodríguez')).not.toBeVisible();
  });
});

test.describe('Public QR', () => {
  test('accessible without login', async ({ page }) => {
    await page.goto('/b/BOT-00001');
    // Wait for streaming to finish — the root loading spinner must disappear first
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });
    // The page should show the botellón code (server-rendered, no auth required)
    await expect(page.getByText('BOT-00001').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Total recargas')).toBeVisible();
    // Client name should NOT be visible to unauthenticated users
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
