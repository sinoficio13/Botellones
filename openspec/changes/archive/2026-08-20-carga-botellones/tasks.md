# Tasks: Batch QR "carga" for botellones (Commit 2 — frontend)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~850 (hook ~150, page ~200, modal ~70, tests ~350, e2e ~80) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (hook) → PR 2 (modal refactor + toggle) → PR 3 (carga page) |
| Delivery strategy | auto-forecast (auto-chain) |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Extract `useQrScanner` hook + hook test | PR 1 (base=tracker branch) | `vitest run tests/component/use-qr-scanner.test.tsx` | `npm run dev` scan one QR via modal | Delete `use-qr-scanner.ts` + test; modal unaffected (additive) |
| 2 | Refactor scanner-modal onto hook + mode toggle | PR 2 (base=PR 1) | `vitest run tests/component/scanner-modal.test.tsx` | Open modal via island/FAB, toggle Carga | Restore `scanner-modal.tsx` from tracker main; hook stays usable |
| 3 | `/recargas/carga` batch page + page test | PR 3 (base=PR 2) | `vitest run tests/component/carga-page.test.tsx` | `/recargas/carga` scan batch, confirm | Delete `carga/page.tsx` + test; backend untouched |

## Phase 1: Foundation — useQrScanner hook

- [x] 1.1 RED: `tests/component/use-qr-scanner.test.tsx` — fake rAF/perf + jsQR mock + getUserMedia mock: happy-path decode, permission-denied → `camera-unavailable` absent API, lockout suppresses duplicate, async-failure pause/resume, StrictMode double-mount cleanup, idempotent `stop()`, invalid-code + not-found error surfacing
- [x] 1.2 GREEN: create `src/lib/scanner/use-qr-scanner.ts` — `{videoRef, cameraError, decodeError, stop}`; getUserMedia environment, rAF ≤15fps ≤640px, `onDecode` outcome pause/resume, `lockoutMs=1000`, per-effect `disposed` flag, track stop + rAF cancel, `parseQrCode` invalid → `invalid-code`

## Phase 2: Core — scanner-modal refactor + mode toggle

- [x] 2.1 RED: extend `tests/component/scanner-modal.test.tsx` — default mode Recarga, toggle to Carga, Carga handoff closes + `router.push('/recargas/carga')` with no `/recargas/nueva` redirect; existing 17 tests stay green
- [x] 2.2 GREEN: refactor `src/components/scanner/scanner-modal.tsx` onto `useQrScanner` — preserve single-flow redirect, no-client overlay, ERROR_COPY, close-on-backdrop/button; add `Recarga`\|`Carga` toggle; Carga mode = `onClose()` + push, no decode processing
- [x] 2.3 Verify: `scanner-island.test.tsx` (3) + `mobile-nav.test.tsx` (7) remain green (no-op entries unchanged)

## Phase 3: Core — /recargas/carga batch page

- [x] 3.1 RED: `tests/component/carga-page.test.tsx` — mock `useQrScanner` + `registrarCarga` + db: first-scan append, duplicate ignored, handler-driven (no effect setState), shared fecha/hora, empty-session + missing fecha/hora disable confirm, confirm posts ids, server error surfaced, per-item REC#/reason, sin-cliente → `/botellones/[id]`, success screen count/premios/loyaltyWarning/`/clientes/[id]`, no-client overlay
- [x] 3.2 GREEN: create `src/app/(dashboard)/recargas/carga/page.tsx` — `'use client'`, `useActionState(registrarCarga, null)`, session state, camera + items list + fecha/hora inputs + per-item results + success screen

## Phase 4: Testing / Integration

- [x] 4.1 Run full component suite: `vitest run tests/component` — all green incl. scanner-modal/island/mobile-nav regression (reconciled at archive: verify-report proves 136/136 tests passed, exit 0)
- [ ] 4.2 Optional: `tests/e2e/carga.spec.ts` chromium camera stub (mirror `scanner.spec.ts`); defer if size pushes PR 3 — NOT implemented. Explicitly optional and deferrable per spec/design Testability note; deferred at archive, not a blocker.
- [x] 4.3 Typecheck + lint clean (`tsc --noEmit`, `npm run lint`); `/recargas/nueva` untouched (reconciled at archive: verify-report proves `tsc --noEmit` exit 0 and build exit 0; `npm run lint` exit 1 is solely 4 pre-existing errors in files untouched by this change, out of scope)

## Out of scope (NOT tasks)

ingreso flow, per-bottle mixing (uniform recarga locked), fidelity changes, USB scanners, real `realizada_por` auth (placeholder), admin notifs, RPC, REC sequence, planta, `/b/[codigo]` add-to-carga, all backend (Commit 1 done).
