# Proposal: Batch QR "carga" for botellones

## Intent

Staff return full truckloads of botellones; today each one needs an individual scan through the single-flow wizard (`/recargas/nueva`). This change ships a batch session: scan QRs, accumulate bottles, confirm ONE uniform recarga for the whole lot. Backend (Commit 1, `e85bbcf`: `registrarCarga` + `procesarLoyalty`, 27 tests) is done and audited; this proposal locks the remaining frontend work (Commit 2).

## Scope

### In Scope
- `useQrScanner` hook — extract camera/decode loop from `scanner-modal.tsx`
- `/recargas/carga` batch page — scan, accumulate, shared fecha/hora, confirm, results + premios
- Scanner modal mode toggle (`Recarga` | `Carga`) with Carga handoff
- Component tests (hook + page); optional e2e

### Out of Scope
- ingreso flow, per-bottle mixing (uniform recarga locked), fidelity changes, USB scanners, real `realizada_por` auth (placeholder), admin notifs, RPC, REC sequence, planta, `/b/[codigo]` add-to-carga, all backend changes (Commit 1 complete, no deviations)

## Capabilities

### New Capabilities
- `batch-carga`: scan→accumulate→confirm batch session; consumes `registrarCarga`/`CargaState`/`CargaItemResult`; uniform fecha/hora; assign-client-first; in-session dedupe
- `qr-scanner-hook`: shared `useQrScanner` (`videoRef`, `cameraError`, `decodeError`, `stop`; options `onDecode`, `onInvalidCode?`, `lockoutMs?`)
- `scanner-mode-toggle`: Recarga|Carga toggle in modal; Carga hands off to `/recargas/carga`

### Modified Capabilities
- None (existing specs unchanged; new code complies with `react-patterns`, `middleware-routing`)

## Approach

Approach 1 (locked): transient client-side batch session — `items[]`, `fecha`, `hora` in React state; confirm posts `{botellonIds, fecha, hora}` to server action `registrarCarga`; server re-derives `cliente_id` and rejects invalid items per-bottle. Extract the decode loop into `useQrScanner`; modal and page both consume it. Zero schema/migration.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/scanner/use-qr-scanner.ts` | New | Hook extracted from scanner-modal |
| `src/app/(dashboard)/recargas/carga/page.tsx` | New | Batch session UI, `useActionState` |
| `src/components/scanner/scanner-modal.tsx` | Modified | Mode toggle + refactor onto hook; preserve decode/lockout/StrictMode |
| `src/components/scanner/scanner-island.tsx`, `src/components/navigation/mobile-nav.tsx` | Modified | Pass-through entry (regression suites exist) |
| `tests/component/use-qr-scanner.test.tsx`, `tests/component/carga-page.test.tsx` | New | Hook lifecycle; page with mocked hook/action |
| `tests/e2e/carga.spec.ts` | New (optional) | Chromium camera stub |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Camera-loop refactor regression | Med | Keep scanner-modal (17), island (3), mobile-nav (7) suites green |
| Partial-failure window | Med | Commit 1 compensating delete; surface per-item results |
| `setState`-in-effect copy | Low-Med | Handler-driven accumulation per `react-patterns` spec |
| Duplicate scans double-count | Low | Dedupe accumulated codes in-session |

## Rollback Plan

Frontend-only revert: restore `scanner-modal.tsx` from `main` if the refactor regresses (hook extraction is additive); delete new files. Backend untouched — `registrarCarga` stays callable. `/recargas/nueva` single flow unchanged throughout.

## Dependencies

- Commit 1 backend (`e85bbcf`): `src/lib/db/cargas.ts`, `src/lib/db/loyalty.ts` — present in `main`
- Existing specs: `react-patterns`, `middleware-routing`

## Success Criteria

- [ ] Existing scanner-modal / island / mobile-nav suites pass post-refactor
- [ ] `/recargas/carga` scans, accumulates, confirms a batch; results render REC# + premios
- [ ] Toggle sends Carga mode to `/recargas/carga`; Recarga mode unchanged
- [ ] New component tests green; typecheck + lint clean
- [ ] `/recargas/nueva` untouched