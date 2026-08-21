# Apply Progress — estados-botellon-ciclo-puro (Commit 1: Backend/DB)

**Mode**: Strict TDD (vitest) · **Artifact store**: hybrid (engram + openspec)
**Scope**: Tasks 1.1–1.10 (commit 1 backend/db only — commit 2 frontend/docs is a separate batch)
**Delivery**: exception-ok, stacked-to-main, direct to main, NO PRs (user-locked)

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run tests/unit/estados.test.ts tests/unit/carga-registrar.test.ts tests/unit/botellon-by-codigo.test.ts` → **3 files passed, 60/60 tests green** (baseline 58 → +5 contract tests, −1 consolidated) |
| Runtime harness command/scenario and exact result | `N/A` — R1/D7: `next build` type-checks the whole tree and stays red until commit 2 (frontend still imports `ESTADOS_EXCEPCION`/`botellonesEnPlanta`/`botellonesDanados`). No `tsc` script exists. Runtime DB path = apply migration 0009 after live-count check; migration file written, NOT executed (no runner/CLI). |
| Rollback boundary | `git revert` this commit restores 9-estado machine + 0005 constraint. Restore path for applied data: 0005 constraint + 0009 remap (documented in design). |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `tests/unit/estados.test.ts` | Unit | ✅ 11/11 | ✅ 8 failed (16 tests, RED confirmed) | ✅ 16/16 | ✅ 3 cases per TRANSICIONES edge + KANBAN + maps | ✅ Clean — maps/ops extracted, no magic strings |
| 1.2 | `tests/unit/carga-registrar.test.ts` | Unit | ✅ 40/40 | ✅ 2 failed (`.in('estado',…)` assertions) | ✅ 40/40 | ➖ Single-source contract (spec defines one source) | ✅ Fixtures renamed `entregados`→`recibidos`; `registrarRecarga` describe untouched |
| 1.3 | `tests/unit/botellon-by-codigo.test.ts` | Unit | ✅ 4/4 | ➖ Cosmetic fixture flip (`planta`→`recibido`); function never validates estado, so no RED possible — noted | ✅ 4/4 | ➖ Single fixture | ➖ None needed |
| 1.4 | `src/lib/utils/estados.ts` | Unit (driven by 1.1) | ✅ | (covered by 1.1 RED) | ✅ 16/16 | ✅ | ✅ Header comment → 5-cycle; deleted `ESTADOS_EXCEPCION` |
| 1.5 | `src/lib/db/botellones.ts` | N/A (no direct test; contract via design D3/D4) | ✅ (scoped suite unaffected) | N/A | ✅ (suite green) | N/A | ✅ Removed danado/perdido notif block; `moverBotellon` clears client only on `'recibido'` |
| 1.6 | `src/lib/db/analytics.ts` | N/A (compile-guard only, red until commit 2) | N/A | N/A | N/A (structural removal; verified by grep, no `botellonesEnPlanta`/`botellonesDanados` remain) | N/A | ✅ |
| 1.7 | `src/app/api/alertas/route.ts` | N/A (compile-guard only) | N/A | N/A | N/A (fallback key dropped; `getAlertas` type no longer has it) | N/A | ✅ |
| 1.8 | `supabase/migrations/0009_botellon_estados_puros.sql` | N/A (migration, not executed) | N/A | N/A | N/A | N/A | ✅ Data-first (D8): UPDATE before DROP/ADD constraint; default untouched |
| 1.9 | — | — | ✅ baseline 58/58 | — | ✅ 60/60 | — | ✅ Live counts verified read-only: `planta`=1, exceptions=0 |

## Test Summary

- **Total tests written**: 5 new (estados contract: exact-5, removed-estados maps, TRANSICIONES linear, TRANSICIONES split/loop, entregado→recargar reject, KANBAN, no-planta-edges) — 16 in estados.test.ts (was 11)
- **Total tests passing**: 60/60 (scoped)
- **Layers used**: Unit (60), Integration (0), E2E (0)
- **Approval tests** (refactoring): 0 — existing tests updated to new contract per strict-tdd approval flow
- **Pure functions created**: 0 (machine is pure constants/functions already; behavior narrowed)

## Files Changed (commit 1)

| File | Action | What Was Done |
|------|--------|---------------|
| `tests/unit/estados.test.ts` | Modified | 5-estado contract; TRANSICIONES exact; recargar single-source; entregado→recargar false; KANBAN 4 cols; deleted exception + one-pass tests |
| `tests/unit/carga-registrar.test.ts` | Modified | Fixtures `entregados`→`recibidos`; `.in('estado',['recibido'])`; ghost fixture recibido; single-source describe; legacy `registrarRecarga` UNCHANGED |
| `tests/unit/botellon-by-codigo.test.ts` | Modified | L90 fixture `'planta'`→`'recibido'` |
| `src/lib/utils/estados.ts` | Modified | ESTADOS 9→5; TRANSICIONES exact; `OPERACIONES.recargar.sources→['recibido']`; deleted `ESTADOS_EXCEPCION`; `ESTADOS_KANBAN` 4 cols; LABELS/COLORS −4 keys; 5-cycle header |
| `src/lib/db/botellones.ts` | Modified | `updateBotellon` assign→`'entregado'` unconditional, unassign keeps estado; deleted danado/perdido notif block; `moverBotellon` clears client only on `'recibido'` |
| `src/lib/db/analytics.ts` | Modified | Removed `botellonesEnPlanta` (type/query/returns/fallback) + `botellonesDanados` (type/query/mapping/fallbacks); `botellonesActivos`/repartidor stay |
| `src/app/api/alertas/route.ts` | Modified | Dropped `botellonesDanados: []` from 500 fallback |
| `supabase/migrations/0009_botellon_estados_puros.sql` | Created | Data-first remap `planta`/`danado`/`perdido`/`mantenimiento`→`recibido`, then CHECK constraint 9→5 |
| `openspec/changes/estados-botellon-ciclo-puro/tasks.md` | Modified | 1.1–1.10 marked `[x]` |
| `openspec/changes/estados-botellon-ciclo-puro/apply-progress.md` | Created | This artifact |

## Deviations from Design

None — implementation matches design.md (D1/D3/D4/D7/D8 all followed).

## Issues Found

- Stale doc comment in `src/lib/db/cargas.ts` L82-85 ("entregado/recibido → recarga") — design mandates 0 changes to cargas.ts (OPERACIONES-driven auto-adapt); comment now factually stale. Recommend cleaning it in commit 2.
- `cargas.ts` comment L83 `entregado/recibido` — same note.

## Commit

`refactor(botellones): pure 5-estado cycle backend + migration 0009` — direct to main (exception-ok, user-locked 2 commits, NO PRs).

## Status

10/10 commit-1 tasks complete. Ready for commit 2 (frontend + docs) which clears R1 (`next build` red until then).