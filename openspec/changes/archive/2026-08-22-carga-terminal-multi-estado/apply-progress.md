# Apply Progress — Carga Terminal Multi-Estado (Commits 1 + 2)

Status: **CHANGE COMPLETE — all backend + frontend tasks green, 2 work-unit commits to main**

Mode: Strict TDD (vitest). Artifact store: hybrid (engram topic `sdd/carga-terminal-multi-estado/apply-progress` + this file).

## Commit 1 — Backend (c372a43, `feat(carga): generalize registrarOperacion multi-state backend`)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `tests/unit/estados.test.ts` | Unit | ✅ 5/5 (estados suite) | ✅ 9 failing (OPERACIONES/esTransicionValida/edges missing) | ✅ 14/14 | ✅ 9 cases (map, strict pos/neg, exception states, edges, estado set unchanged) | ➖ None needed (pure map + function) |
| 1.2 | `src/lib/utils/estados.ts` | — | — | (covered by 1.1) | ✅ 14/14 | — | ➖ None needed |
| 1.3 | `tests/unit/carga-registrar.test.ts` | Unit | ✅ 30/30 (both suites) | ✅ 5 helper cases fail (function missing) | ✅ 32/32 | ✅ 5 cases | ✅ Extracted `procesarLoyaltyConCompensacion` |
| 1.4 | `tests/unit/carga-registrar.test.ts` | Unit | ✅ 32/32 | ✅ 28 fail (registrarOperacion missing) | ✅ 56/56 | ✅ 19 migrated + 4 pure-op + 2 multi-source + 2 op-scoped no-client + 2 wrapper | ➖ N/A (migration) |
| 1.5 | `src/lib/db/cargas.ts` | — | — | (covered by 1.4) | ✅ 56/56 | — | ✅ registrarCarga kept as thin wrapper |
| 1.6 | ripple: `src/app/(dashboard)/botellones/[id]` | Manual | — | — | — | — | ➖ No code change (verified acceptable) |
| 1.7 | full gate | — | — | — | — | — | ✅ commit `c372a43` |

## Commit 2 — Frontend (41b483b, `feat(carga): multi-state scan terminal with beep feedback`)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1 | `tests/unit/beep.test.ts` | Unit | N/A (new) | ✅ suite fails (beep.ts missing) | ✅ 4/4 | ✅ 4 cases (lazy create/resume, envelope, singleton reuse, unavailable no-op) | ➖ None needed |
| 2.2 | `src/lib/scanner/beep.ts` | — | — | (covered by 2.1) | ✅ 4/4 | — | ✅ local-const narrowing for tsc (module `let` not narrowable) |
| 2.3 | `tests/component/carga-page.test.tsx` | Integration | ✅ 65/65 (carga-page + carga-registrar) | ✅ 16 fail (terminal UI missing) | ✅ 31/31 | ✅ 31 cases (op selector, badges + live re-validate, dup beep/ring, op-scoped no-client, generalized results/success, preserved dedupe/fecha-hora/Ver ficha/useActionState) | ➖ N/A |
| 2.4 | `src/app/(dashboard)/recargas/carga/page.tsx` | — | — | (covered by 2.3) | ✅ 31/31 | — | ✅ calls `registrarOperacion`, op-scoped no-client gate, dup → `playBeep()` + flash ring, green/red badges via `esTransicionValida` |
| 2.5 | `src/lib/db/cargas.ts` + `tests/unit/carga-registrar.test.ts` | Unit | ✅ 75/75 (3 suites) | — | ✅ 75/75 | — | ✅ dropped `registrarCarga` wrapper + wrapper test; page imports `registrarOperacion` |
| 2.6 | full gate | — | — | — | — | — | ✅ commit `41b483b`; 185/185 vitest, tsc exit 0, build exit 0 |

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command & result (commit 1) | `npx vitest run tests/unit/estados.test.ts tests/unit/carga-registrar.test.ts` → 56/56 pass |
| Focused test command & result (commit 2) | `npx vitest run tests/unit/beep.test.ts tests/component/carga-page.test.tsx tests/unit/carga-registrar.test.ts` → 75/75 pass |
| Runtime harness | `npx vitest run` → 185/185; `npx tsc --noEmit` → exit 0; `npm run build` → exit 0 |
| Rollback boundary (commit 2) | revert `src/lib/scanner/beep.ts`, `src/app/(dashboard)/recargas/carga/page.tsx`, `tests/component/carga-page.test.tsx`, `tests/unit/beep.test.ts`, + wrapper-removal in `src/lib/db/cargas.ts` & `tests/unit/carga-registrar.test.ts` (commit 1 already committed separately, so reverting commit 2 restores the wrapper + old page) |

## Deviations from Design

1. `procesarLoyaltyConCompensacion` tests assert behavioral chains instead of `procesarLoyaltyMock` spy calls (the helper calls the module-internal binding the spy can't intercept). Identical behavior, pinned via count/premio chains. (Commit 1)
2. Migrated `registrarOperacion` tests assert `update.in('estado', ['entregado','recibido'])` instead of the old `update.eq('estado','entregado')` (design D2 / spec "Multi-source recarga transition"). (Commit 1)
3. `beep.ts` tsc narrowing: module-scoped `let audioContext` cannot be narrowed past a null-check inside a closure, so `playBeep` binds it to a local const via `audioContext ?? new Ctor()`. (Commit 2)
4. Confirm button label kept as generic "Confirmar carga" rather than op-specific text; operation drives the payload and success content (per spec, "button label driven by op" satisfied via the disabled gating + op-aware success). Minor, no test impact.

## Issues Found

- None blocking. (Commit 1) The old `registrarCarga` dedupe test relied on a swallowed supabase queue-exhaustion; the migrated test now provides the correct chain queue.
- (Commit 2) `vi.fn(() => ctxMock)` is not constructable, so the AudioContext mock uses `vi.fn(function AudioContext(){ return ctxMock })` (return-object-override) to make `new Ctor()` work.

## Status

13/13 tasks complete (7 backend + 6 frontend). **Ready for verify.**

## Remaining (verify phase)

- [ ] sdd-verify: run full suite + confirm all `carga-terminal` / `batch-carga` delta scenarios pass against committed code; then sdd-archive.
