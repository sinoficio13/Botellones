# Apply Progress — Carga Terminal Multi-Estado (Commit 1, Backend)

Status: **COMMIT 1 COMPLETE — all backend tasks green, committed to main**

Mode: Strict TDD (vitest). Artifact store: hybrid (engram topic `sdd/carga-terminal-multi-estado/apply-progress` + this file).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `tests/unit/estados.test.ts` | Unit | ✅ 5/5 (estados suite) | ✅ 9 failing (OPERACIONES/esTransicionValida/edges missing) | ✅ 14/14 | ✅ 9 cases (map, strict pos/neg, exception states, edges, estado set unchanged) | ➖ None needed (pure map + function) |
| 1.2 | `src/lib/utils/estados.ts` | — | — | (covered by 1.1) | ✅ 14/14 | — | ➖ None needed |
| 1.3 | `tests/unit/carga-registrar.test.ts` | Unit | ✅ 30/30 (both suites) | ✅ 5 helper cases fail (function missing) | ✅ 32/32 | ✅ 5 cases (crossed milestone, exact-milestone no-dup, loyalty throw, 23505 idempotency, no-client) | ✅ Extracted `procesarLoyaltyConCompensacion`; registrarRecarga cascade resolved at GREEN |
| 1.4 | `tests/unit/carga-registrar.test.ts` | Unit | ✅ 32/32 | ✅ 28 fail (registrarOperacion missing) | ✅ 56/56 | ✅ 19 migrated recarga scenarios + 4 pure-op + 2 multi-source + 2 op-scoped no-client + 2 wrapper | ➖ N/A (migration) |
| 1.5 | `src/lib/db/cargas.ts` | — | — | (covered by 1.4) | ✅ 56/56 | — | ✅ registrarCarga kept as thin wrapper |
| 1.6 | ripple: `src/app/(dashboard)/botellones/[id]` | Manual | — | — | — | — | ➖ No code change (verified acceptable) |
| 1.7 | full gate | — | — | — | — | — | ✅ commit `feat(carga): generalize registrarOperacion multi-state backend` |

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command & result | `npx vitest run tests/unit/estados.test.ts tests/unit/carga-registrar.test.ts` → 56/56 pass |
| Runtime harness | `npx vitest run` → 175/175; `npx tsc --noEmit` → exit 0; `npm run build` → exit 0 |
| Rollback boundary | revert `src/lib/utils/estados.ts`, `src/lib/db/cargas.ts`, `src/lib/db/loyalty.ts`, `tests/unit/{estados,carga-registrar}.test.ts` |

## Deviations from Design

1. `procesarLoyaltyConCompensacion` tests assert behavioral chains (recargas-count queries, premio inserts) instead of `procesarLoyaltyMock` spy calls: the helper calls the module-internal `procesarLoyalty` binding, which the `vi.mock` spy cannot intercept. Same for the "loyalty throws" scenario — the rejection is simulated via a rejecting supabase count chain, not `mockRejectedValueOnce`. Behavior is identical and covered; the direct helper tests pin the contract.
2. Migrated `registrarOperacion` tests assert `update.in('estado', ['entregado','recibido'])` instead of the old `update.eq('estado','entregado')` — the server guard is now the `.in()` sources filter (per design D2 / spec "Multi-source recarga transition").

## Issues Found

- None blocking. The old `registrarCarga` dedupe test relied on a swallowed supabase queue-exhaustion; the migrated test now provides the correct chain queue (loyalty count + compensation count).

## Remaining Tasks (Commit 2 — Frontend)

- [ ] 2.1 (RED) `tests/unit/beep.test.ts`
- [ ] 2.2 (GREEN) `src/lib/scanner/beep.ts`
- [ ] 2.3 (RED) `tests/component/carga-page.test.tsx` (re-mock registrarCarga→registrarOperacion)
- [ ] 2.4 (GREEN) `src/app/(dashboard)/recargas/carga/page.tsx`
- [ ] 2.5 (REFACTOR) drop `registrarCarga` wrapper + wrapper test
- [ ] 2.6 (COMMIT) frontend work-unit commit

Status: 7/7 commit-1 tasks complete. Ready for Commit 2.
