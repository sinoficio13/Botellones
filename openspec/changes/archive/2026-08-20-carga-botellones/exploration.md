# Exploration: carga-botellones — Batch QR scan session ("carga") for botellones

Change status: split into two commits. **Commit 1 (backend)** is implemented and
committed (`e85bbcf`). **Commit 2 (frontend)** is pending. This exploration (a)
audits that Commit 1 is correctly designed/registered against the plan and
(b) maps the current frontend pieces needed to plan Commit 2.

Verified against real code on 2026-08-20 (repo `D:\Github\Botellon`, branch `main`).

## Current State

### Backend (Commit 1 — present in `main` at `e85bbcf`, verified)

- **`src/lib/db/cargas.ts`** (new, `'use server'`) — `registrarCarga({botellonIds, fecha, hora}): Promise<CargaState>`.
  - Server-side re-derives `cliente_id` per botellon (never trusts the client).
  - Dedupes `botellonIds`; rejects clientless / non-`entregado` items with per-item
    reasons (`sin-cliente` | `estado-${estado}` | `error`).
  - Computes N sequential `REC-######` numbers from ONE `max+1` read ordered
    `created_at DESC, id DESC` (deterministic tie-break).
  - Single array insert; single `.in()` update `entregado → recarga`; on update
    failure a best-effort compensating delete of inserted rows runs.
  - Loyalty once per distinct client (`procesarLoyalty`), plus milestone-overshoot
    compensation for multiples of 100 crossed within the batch.
  - Revalidates `/clientes`, `/recargas`, `/botellones`.
  - **Interfaces exported (the contracts Commit 2 must consume):**
    ```ts
    export type CargaItemResult =
      | { botellonId: string; codigo: string; ok: true; recargaId: string; numeroRegistro: string }
      | { botellonId: string; codigo: string; ok: false; reason: 'sin-cliente' | `estado-${string}` | 'error' };
    export type CargaState = {
      success: boolean;
      items: CargaItemResult[];
      premios?: { nivel: number; id: string }[];
      loyaltyWarning?: string;
      error?: string;
    };
    ```
- **`src/lib/db/loyalty.ts`** (new) — `procesarLoyalty(clientIds, realizadaPor)` shared helper
  (premio at exact 100-multiples via unique index `uq_premios_cliente_nivel` + `premio_cerca`
  fan-out to `perfiles`). `REALIZADA_POR_PLACEHOLDER` = `00000000-0000-0000-0000-000000000000`.
- **`src/lib/db/recargas.ts`** (modified) — `registrarRecarga` refactored to delegate loyalty
  to `procesarLoyalty`; single-flow behavior preserved. Single flow remains the OLD path
  (`botellon_id` + `cliente_id` from the form).
- **`tests/unit/carga-registrar.test.ts`** (new) — 27 unit tests (per task context), using a
  supabase chain-builder mock pattern; asserts batch numbering, validation, compensating
  delete, loyalty-once-per-client, delegation to `procesarLoyalty`.

**Audit verdict (Commit 1):** implementation matches the locked design (Approach 1) exactly:
new `cargas.ts`, shared `loyalty.ts`, `recargas.ts` delegating, `entregado`-only validation,
compensating delete, loyalty once per distinct client, zero schema/migration. Registered via
revalidatePath on the three canonical paths. No deviations found.

### Frontend pieces that exist today (base for Commit 2)

- **`src/components/scanner/scanner-modal.tsx`** — the ONLY camera decode loop in the app.
  - `'use client'`; one effect owns `getUserMedia({ video: { facingMode: 'environment' } })`
    + rAF loop; `DECODE_INTERVAL_MS = 66` (≤15fps), `MAX_CANVAS_SIZE = 640` downscale,
    `DECODE_LOCKOUT_MS = 1000` (1s lockout), `parseQrCode` → `getBotellonByCodigo`.
  - On successful decode: requires `cliente_id` (else `no-client` overlay, keeps scanning);
    on success `stopStream(); onClose(); router.push('/recargas/nueva?botellon_id=...')`.
  - `ScanError` union: `permission-denied | camera-unavailable | invalid-code | not-found | no-client`,
    each with `ERROR_COPY { title, hint }`. `no-client` overlay has NO action button today.
  - StrictMode-safe (per-effect `disposed` flag), idempotent `stop()`.
- **`src/components/scanner/scanner-island.tsx`** — header entry; `dynamic(() => import('./scanner-modal').then(m => m.ScannerModal), { ssr:false })`; opens modal. No mode concept.
- **`src/components/navigation/mobile-nav.tsx`** — mobile/tablet bottom bar; center FAB opens the
  same lazily-imported `ScannerModal`. No mode concept.
- **`src/lib/scanner/parse-qr.ts`** — pure validator: accepts `/b/BOT-XXXXX` (full URL or bare
  path; origin ignored). `QrParseResult = { codigo }`.
- **`src/lib/db/botellones.ts`** — `getBotellonByCodigo(codigo): Promise<BotellonPublico|null>`
  returning `{ id, codigo, estado, cliente_id, total_recargas, ultima_recarga }`. Enough to
  resolve a scanned code to `id` + `cliente_id` + `estado` client-side (for the session list).
- **`src/lib/auth/session.ts`** — `getSessionRole(): 'admin'|'repartidor'|null`. Not required by
  the carga page client component; the dashboard proxy gate already restricts staff.
- **`src/app/(dashboard)/recargas/nueva/page.tsx`** — the single-botellon 3-step wizard
  (cliente → botellon → confirmar), uses `useActionState(registrarRecarga, null)`, preselect via
  `?botellon_id=` / `?cliente_id=` search params, success toast + `PremioAlertCard`. **Stays
  untouched**; the new `/recargas/carga` route is a sibling.
- **Routing / preselect links** (verified):
  - `scanner-modal.tsx:98` → `/recargas/nueva?botellon_id=`
  - `src/app/b/[codigo]/page.tsx:136` → `/recargas/nueva?botellon_id=` (public page)
  - `src/app/(dashboard)/clientes/page.tsx:108` & `clientes/buscar/page.tsx:328` → `/recargas/nueva?cliente_id=`
  - `src/app/(dashboard)/recargas/page.tsx:16,42` → `/recargas/nueva` (list + CTA)
- **Route protection** — `src/proxy.ts` middleware gates all dashboard routes except
  `/login`, `/b/`, `/qr`, static, etc. A new `/recargas/carga` route under `(dashboard)` is
  automatically staff-protected; no proxy change needed.

### Commit 2 not yet started (verified absent)

The following Commit 2 targets do NOT exist yet:
`src/lib/scanner/use-qr-scanner.ts`, `src/app/(dashboard)/recargas/carga/page.tsx`,
`tests/component/use-qr-scanner.test.tsx`, `tests/component/carga-page.test.tsx`,
`tests/e2e/carga.spec.ts`. `scanner-modal.tsx` has no mode toggle (only the single
`/recargas/nueva?botellon_id=` redirect path).

## Affected Areas (Commit 2)

- `src/lib/scanner/use-qr-scanner.ts` — **Create**. Extract the camera/decode loop from
  `scanner-modal.tsx` into a shared `'use client'` hook: `{ videoRef, cameraError, decodeError, stop }`,
  options `{ onDecode, onInvalidCode?, lockoutMs? }`. Modal + new page both reuse it.
- `src/app/(dashboard)/recargas/carga/page.tsx` — **Create**. Batch session UI: camera
  (`useQrScanner`), accumulated botellon list (codigo, cliente nombre, "Ver ficha" →
  `/clientes/[id]`), shared fecha/hora, single uniform confirm → `registrarCarga`, per-item
  result rendering, success screen (count/list/REC#/premios). `'use client'`, `useActionState`.
- `src/components/scanner/scanner-modal.tsx` — **Modify**. Gain a session mode toggle
  (`Recarga` | `Carga`); Carga mode hands off to `/recargas/carga`; individual mode unchanged.
  Refactor onto `useQrScanner`. Must preserve existing decode/lockout/close/StrictMode behavior.
- `src/components/scanner/scanner-island.tsx` — **Modify**. Modal hosts the toggle; island just
  passes through. Regression surface: `tests/component/scanner-island.test.tsx` (mocks modal).
- `src/components/navigation/mobile-nav.tsx` — **Modify**. Same entry; regression surface:
  `tests/component/mobile-nav.test.tsx` (mocks modal).
- `tests/component/carga-page.test.tsx` — **Create** (mock hook + action + db lookups).
- `tests/component/use-qr-scanner.test.tsx` — **Create** (hook lifecycle; pattern:
  `scanner-modal.test.tsx` with fake rAF/perf timers + jsQR mock).
- `tests/e2e/carga.spec.ts` — **Optional** (chromium-only camera stub, mirroring
  `scanner.spec.ts`).
- **Regression suites to preserve**: `scanner-modal.test.tsx` (camera lifecycle, decode/resolve,
  close — 17 tests), `scanner-island.test.tsx` (3), `mobile-nav.test.tsx` (7), `carga-registrar.test.ts` (27).

## Approaches (Commit 2 — extraction and page shape)

1. **Extract `useQrScanner` hook, new `/recargas/carga` page, modal mode toggle** (RECOMMENDED, locked in design)
   - Reuses the single proven decode path; zero duplication of ~100 lines of getUserMedia/jsQR.
   - Refactor regression covered by the existing scanner-modal/island/mobile-nav suites.
   - Pros: single source of truth for camera; matches Commit 1 contract (`CargaState`); additive,
     leaves `/recargas/nueva` untouched; no schema/migration.
   - Cons: hook refactor touches the working scanner (mitigated by existing tests); toggle adds a
     small state surface.
   - Effort: Medium (~500–650 authored lines incl. tests, across Commit 2).

2. **Duplicate the decode loop in the page** (no hook)
   - Pros: no refactor of the working modal.
   - Cons: ~100 duplicated lines drift risk; two camera paths to test. Rejected.

3. **Extend `/recargas/nueva` wizard with multi-select** (rejected in design)
   - Wizard is cliente-centric; batch is inherently multi-client. Wrong fit.

## Recommendation

Proceed with **Approach 1** for Commit 2, exactly as the locked design specifies: extract
`useQrScanner` (from `scanner-modal.tsx`), create `/recargas/carga`, add the modal mode toggle,
consume the already-committed `registrarCarga` / `CargaState` / `CargaItemResult` contracts
from `src/lib/db/cargas.ts`. Commit 1 backend is verified correct and needs no change.
Guardrails: keep `/recargas/nueva` and the single flow untouched; only `entregado` bottles may be
accumulated (others rejected with a per-item reason); clientless bottles get an in-session
"Asignar cliente" action → `/botellones/[id]`; success screen surfaces premios + loyaltyWarning.

## Risks

- **MEDIUM — Camera-loop extraction regression**: refactor of `scanner-modal.tsx` could regress
  redirect/lockout/StrictMode behavior. Mitigated by the existing 17 scanner-modal tests +
  island/mobile-nav tests; keep those green.
- **MEDIUM — Partial-failure window** (recargas insert OK, botellones update fails): handled by
  Commit 1's compensating delete + per-item results. No frontend action beyond surfacing.
- **LOW-MEDIUM — `set-state-in-effect`**: the current `/recargas/nueva` uses `setState` in effects
  (with eslint-disable comments), which the `react-patterns` spec discourages. The new page SHOULD
  prefer handler-driven accumulation; avoid copy-pasting the pattern. Flag in design/apply.
- **LOW — duplicate/dead-code QRs**: dedupe repeated scans in the session list (ignore a code
  already accumulated) to avoid double-counting in the confirm payload.
- **LOW — No config.yaml in `openspec/`**: sdd-init did not write `openspec/config.yaml`; only
  `specs/` exist. Not blocking; note for consistency.

## Ready for Proposal

Yes — backend Commit 1 is audited and correct; Commit 2 frontend is fully mapped (extraction
target, new route, modal toggle, contracts, regression surface, tests). The `propose` phase can
confirm the already-locked scope and move to spec/design/tasks for Commit 2.
