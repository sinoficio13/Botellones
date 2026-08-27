/**
 * E2E — REQ-COS-22: at ≥1024px /dashboard renders the desktop kanban
 * (`data-testid="cola-kanban"`), and the tablet 2-column grid is hidden.
 *
 * Requires: NEXT_PUBLIC_AUTH_MODE=dev (dev-mode login cookie), dev server
 * running, hosted Supabase reachable for the queue fetch. Mirrors
 * cola-375px.spec.ts's harness at a 1024px viewport.
 *
 * DROPPABLE per design (REQ-COS-26): component tests in kanban-desktop.test.tsx
 * carry the layout/drag coverage; this file is kept because PR-B stayed well
 * under the 400-line budget.
 */
import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@botellon.com');
  await page.getByLabel('Password').fill('Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/clientes/, { timeout: 15000 });
}

test.describe('Cola 1024px — REQ-COS-22/25', () => {
  test('renders the 4-column kanban at 1024px and hides the tablet grid', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await login(page);
    await page.goto('/dashboard');

    // Desktop kanban branch visible (queue with data or first-use empty — the
    // kanban grid container is present in both once the shell settles).
    await expect(page.getByTestId('cola-kanban')).toBeVisible({ timeout: 15000 });

    // The tablet 2-col grid is hidden at ≥1024px (MOD-21: the leak fix).
    await expect(page.getByTestId('cola-tablet')).toBeHidden();

    // 4 kanban columns render.
    await expect(page.getByTestId('kanban-columna')).toHaveCount(4);
  });
});
