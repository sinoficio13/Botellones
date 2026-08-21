# Proposal: Botellon Pure 5-Estado Cycle

## Intent

Simplify the botellon lifecycle from 9 estados to a pure 5-estado rotation cycle: `entregado → recibido → recarga → listo → entregado` (+ `listo → delivery → entregado`). The business does not receive/repair damaged bottles, does not track lost as a state, and never uses planta/mantenimiento. QR scanning and the carga terminal must reflect the true cycle.

## User Problem

The 9-estado machine has dead states (planta, mantenimiento) and exception states (danado, perdido) that do not match the business. They add UI noise, kanban columns, alerts (dañados/perdidos), forms, and charts nobody uses, plus complexity in every transition guard. The QR flow must enforce the pure cycle — including removing the `entregado → recarga` one-pass shortcut so staff scan twice (recibir, then recargar).

## Scope

### In Scope
- `estados.ts`: 5-estado `ESTADOS`/`TRANSICIONES`; `OPERACIONES.recargar.sources → ['recibido']`; delete `ESTADOS_EXCEPCION`; trim LABELS/COLORS (−4 each)
- `botellones.ts` + `analytics.ts` + `api/alertas`: remove danado/perdido notification + alert KPIs (`botellonesEnPlanta`, `botellonesDanados`); reintegro rules (unassign keeps estado, assign → entregado; old planta auto-assign removed)
- Remove dañados/perdidos alert feature: alert-panel category, notification-icon entry, notificaciones-list filter tab
- Dashboards/kanban/forms/charts: drop planta/mantenimiento/danado/perdido; fix stale color maps (`botellones/page.tsx`, donut-chart)
- Carga page: replace `ESTADO_COLORS['danado']` fallback with explicit red badge
- Migration `0009_botellon_estados_puros.sql`: remap `planta`→`recibido` (BOT-00048) + defensive `danado/perdido/mantenimiento`→`recibido`; constraint 9→5
- Tests (unit/component/e2e) + docs/epics update (04, 07, 08, 13, epics.md, MAPA-SISTEMA, MANUAL-USUARIO, plan.md)

### Out of Scope
- No new stock/inventario estado — clientless botellones are stock in `recibido`/`listo`, sell/assign → `entregado`
- `registrarOperacion` REC/loyalty logic unchanged (recarga branch only)
- `useQrScanner` hook unchanged
- No new delivery/pickup estados — pickup = `listo → entregado` direct

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `carga-terminal`: recargar sources `{entregado, recibido}` → `{recibido}`; remove "Entregado to recarga in one pass" scenario; badge re-validation + op-scoped no-client behavior unchanged

## Approach

Pure-cycle rewrite (locked Approach 1). Two sequential commits **direct to main, no PRs** (user strategy):
1. **Backend/DB (~190 lines)**: `estados.ts`, `botellones.ts`, `analytics.ts`, `api/alertas`, migration 0009, `estados.test.ts`, `carga-registrar.test.ts` — verifiable via tsc + vitest
2. **Frontend + docs (~195 lines)**: 8 dashboard components/pages, carga page red badge, e2e + carga-page/botellon-by-codigo tests, epic docs — verifiable via component/e2e + UI

Each slice is independently verifiable and reversible.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/lib/utils/estados.ts` | Modified | 5 estados; recargar sources `['recibido']` |
| `src/lib/db/botellones.ts` | Modified | remove danado notification block; reintegro rules |
| `src/lib/db/analytics.ts` | Modified | remove enPlanta + botellonesDanados KPIs |
| `src/app/api/alertas/route.ts` | Modified | drop `botellonesDanados: []` fallback |
| `supabase/migrations/0009_botellon_estados_puros.sql` | New | data remap + constraint 9→5 |
| 8 frontend components/pages | Modified | kanban, KPIs, alert panel, color maps, red badge |
| `tests/*` (4 files) | Modified | 5-estado assertions; fixture flips |
| `docs/epics/*` + `docs/*.md` (8 files) | Modified | 5-estado cycle model |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| e2e asserts `'planta'`/`'mantenimiento'` → breaks | High | fix both assertions in frontend slice (surviving estado text; valid selectOption) |
| `ESTADO_COLORS['danado']` → `''` (badge loses red) | Med | explicit red classes on carga page L393 |
| Stale color maps (`disponible/asignado/...`) render colorless | Med | replace in same slice |
| Migration ordering (UPDATE must precede constraint swap) | Med | UPDATE → DROP/ADD constraint; verify live counts (planta=1, exceptions=0) pre-apply |
| Docs carry older 6/9-estado models | Med | one doc commit, all listed files updated |
| Recargar source narrowing = staff flow change | Med | flagged: staff must scan twice (recibir → recargar) |

## Rollback Plan

No schema change is destructive. Revert commit 2 (UI/docs), then commit 1 (backend/migration) via `git revert` in reverse order. The 0005 constraint SQL plus migration 0009's remap are the restore path; keep pre-change counts (planta=1, exceptions=0) to validate.

## Dependencies

- Live-data counts verified before apply (BOT-00048 in `planta`; 0 rows in exceptions).
- No external packages.

## Success Criteria

- [ ] 5-estado cycle enforced: TRANSICIONES/OPERACIONES/tests match the locked table
- [ ] Recargar rejects `entregado` (only `recibido`); staff flow = recibir → recargar
- [ ] No planta/danado/perdido/mantenimiento in UI, server actions, alerts, or KPIs
- [ ] Migration 0009 applied: BOT-00048 → `recibido`; constraint = 5 estados; default stays `'recibido'`
- [ ] All suites green after each commit; ~385 total changed lines across 2 commits
- [ ] Epic docs match the 5-estado cycle model