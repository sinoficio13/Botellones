/**
 * E2E: scanner access from the mobile bottom-bar FAB.
 *
 * Full scan loop: FAB tap -> camera modal -> QR decode -> botellón resolve
 * -> redirect to the recarga flow with ?botellon_id=.
 *
 * Requires: NEXT_PUBLIC_AUTH_MODE=dev, dev server running, seed data applied
 * (BOT-00001 assigned to a client).
 *
 * Browser note: the `mobile` Playwright project runs WebKit, whose Windows
 * build exposes no media APIs (no navigator.mediaDevices, no
 * canvas.captureStream), so the camera stub cannot synthesize frames there.
 * This spec forces a mobile viewport and runs on Chromium; it self-skips on
 * WebKit. Run with: `npx playwright test --project=chromium tests/e2e/scanner.spec.ts`.
 */
import { test, expect, type Page } from '@playwright/test';
import QRCode from 'qrcode';

// Mobile viewport regardless of the project: the bottom bar is lg:hidden,
// so the FAB exists below 1024px.
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@botellon.com');
  await page.getByLabel('Password').fill('Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/clientes/, { timeout: 15000 });
}

test('scan FAB opens the camera modal and redirects to the recarga flow', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'WebKit build lacks canvas.captureStream for the camera stub'
  );

  // Precompute the QR for /b/BOT-00001 node-side and embed it in the page.
  const qrDataUrl = await QRCode.toDataURL('/b/BOT-00001', {
    errorCorrectionLevel: 'M',
    width: 640,
    margin: 2,
  });

  // Stub the camera: getUserMedia returns a canvas stream showing the
  // precomputed QR, so jsQR decodes a real frame and the flow redirects.
  // mediaDevices may be absent in the init-script context (about:blank is
  // not a secure context), so create it defensively first.
  await page.addInitScript(
    ({ qrDataUrl }: { qrDataUrl: string }) => {
      try {
        if (!navigator.mediaDevices) {
          Object.defineProperty(navigator, 'mediaDevices', {
            value: {},
            configurable: true,
          });
        }
      } catch {
        // Secure-context property is read-only; the real page still has it.
      }

      const loadImage = () =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = qrDataUrl;
        });

      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 640;
        const ctx = canvas.getContext('2d');
        const img = await loadImage();
        if (img && ctx) {
          ctx.drawImage(img, 0, 0, 640, 640);
        }
        return canvas.captureStream(15);
      };
    },
    { qrDataUrl }
  );

  await loginAsAdmin(page);
  await page.goto('/dashboard');

  // One tap on the center FAB of the bottom bar
  await page.getByRole('button', { name: 'Escanear QR' }).click();

  // Scan -> validate -> resolve -> redirect to the preselected recarga flow
  await expect(page).toHaveURL(/\/recargas\/nueva\?botellon_id=/, {
    timeout: 15000,
  });
});