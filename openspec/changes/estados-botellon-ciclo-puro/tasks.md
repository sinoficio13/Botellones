# Tasks: Botellon Pure 5-Estado Cycle

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~385 (190 + 195) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | Commit 1 backend/db → Commit 2 frontend+docs, direct to main |
| Delivery strategy | exception-ok (user-locked: 2 commits, NO PRs) |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes (2 commits to main)
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Backend/db + migration 0009 | Commit 1 | `npx vitest run tests/unit/estados.test.ts tests/unit/carga-registrar.test.ts tests/unit/botellon-by-codigo.test.ts` | N/A build (R1/D7 — `next build` red until commit 2); runtime = apply 0009 after live-count check | `git revert commit 1`; restore = 0005 constraint + 0009 remap |
| 2 | Frontend + docs | Commit 2 | `npx vitest run tests/component/carga-page.test.tsx`; `npx playwright test tests/e2e/business-flows.spec.ts` | `npm run build` clears R1; dev UI badge/KPI check | `git revert commit 2` (no schema impact) |

## Commit 1 — Backend/DB (~190 lines) — Strict TDD, RED first

- [x] 1.1 RED `tests/unit/estados.test.ts`: 5 estados (`toHaveLength(5)`); recargar `sources:['recibido']`; `esTransicionValida('entregado','recargar')→false`; delete L94-98 exception-reject + L101-104 one-pass tests; add TRANSICIONES block (listo→[entregado,delivery], delivery→[entregado])
- [x] 1.2 RED `tests/unit/carga-registrar.test.ts`: `entregados` fixture→`'recibido'`; `.in('estado',…)→['recibido']` (L424/L1020); ghost fixture→recibido (L631); multi-source describe→single; `registrarRecarga` describe UNCHANGED
- [x] 1.3 RED `tests/unit/botellon-by-codigo.test.ts`: L90 fixture `'planta'→'recibido'`
- [x] 1.4 GREEN `src/lib/utils/estados.ts`: ESTADOS 9→5; TRANSICIONES exact contract; `OPERACIONES.recargar.sources→['recibido']`; delete `ESTADOS_EXCEPCION`; `ESTADOS_KANBAN=['recibido','recarga','listo','delivery']`; LABELS/COLORS −4 keys; 5-cycle header comment
- [x] 1.5 GREEN `src/lib/db/botellones.ts`: L146-151 assign→`estado='entregado'` unconditional (unassign keeps estado); delete danado/perdido notif block (L157-184); L255 clear client only on `'recibido'`
- [x] 1.6 GREEN `src/lib/db/analytics.ts`: remove `botellonesEnPlanta` (type/query/returns) + `botellonesDanados` (type/query/mapping/fallbacks); `botellonesActivos`/repartidor stay
- [x] 1.7 GREEN `src/app/api/alertas/route.ts`: L12 drop `botellonesDanados: []` 500-fallback
- [x] 1.8 NEW `supabase/migrations/0009_botellon_estados_puros.sql`: UPDATE `planta`→`recibido` (BOT-00048) + `danado/perdido/mantenimiento`→`recibido` BEFORE DROP/ADD constraint (9→5); default stays `'recibido'`
- [x] 1.9 Verify: pre-apply live counts (`planta`=1, exceptions=0); scoped vitest all green; per-commit `next build` NOT expected green (R1/D7)
- [x] 1.10 Commit: `refactor(botellones): pure 5-estado cycle backend + migration 0009`

## Commit 2 — Frontend + Docs (~195 lines)

- [ ] 2.1 RED `tests/component/carga-page.test.tsx`: L249 `'planta'→'recibido'`; add `BOT_RECIBIDO` fixture; valid-green (L279-290)→recibido under recargar; re-validates-live (L305-328)→entregado red under recargar / green under recibir
- [ ] 2.2 RED `tests/e2e/business-flows.spec.ts`: L144 `'planta'`→`getByText(/Recibido|Listo|Entregado/)`; L154 `selectOption('mantenimiento')`→`selectOption({index:1})` (guarded by `isVisible()`)
- [ ] 2.3 GREEN `operaciones-dashboard.tsx`: drop `ESTADOS_EXCEPCION` import; −4 `ESTADO_META`; `TODOS_ESTADOS=[...ESTADOS_KANBAN,'entregado']`; remove enPlanta KPI + danados chip + Excepciones section ("↩ Restaurar a planta"); grid `lg:grid-cols-4`
- [ ] 2.4 GREEN `admin-dashboard.tsx`: remove "En planta" KPI + `Package` import; grid `lg:grid-cols-7→6`
- [ ] 2.5 GREEN `botellones-donut-chart.tsx`: 5-key map (entregado hsl(262,83%,58%), recibido hsl(215,20%,45%), recarga hsl(190,90%,50%), listo hsl(142,71%,45%), delivery hsl(38,92%,50%))
- [ ] 2.6 GREEN `alert-panel.tsx`: remove `botellonesDanados` types/merge/CATEGORIES + `Wrench` import; ternary→`active==='clientesInactivos'?'inactivos':'premios'`
- [ ] 2.7 GREEN `notification-icon.tsx` L16 + `notificaciones-list.tsx` L16: remove `botellon_danado` entries
- [ ] 2.8 GREEN `botellones/[id]/form.tsx` L66: "Sin asignar (planta)"→"Sin asignar"
- [ ] 2.9 GREEN `botellones/page.tsx`: delete stale local map → import shared `ESTADO_LABELS`/`ESTADO_COLORS`; render label + color
- [ ] 2.10 GREEN `clientes/[id]/tabs.tsx`: L220-223 MiniCard ternary + L537-543 `estadoBadge` → shared `ESTADO_COLORS` (5 keys)
- [ ] 2.11 GREEN `recargas/carga/page.tsx` L393: `BADGE_INVALID` red const; drop `ESTADO_COLORS` import
- [ ] 2.12 Verify: component + e2e business-flows green; full `npm run build` green (R1 cleared)
- [ ] 2.13 Docs: epics 04/07/08/13, `docs/epics.md` (6→5), `MAPA-SISTEMA.md`, `MANUAL-USUARIO.md`, `plan.md` (+change row), `03-Clientes.md` L78 badge colors
- [ ] 2.14 Commit: `refactor(ui): drop exception/planta UI, fix badge maps, docs → 5-estado cycle`

## Dependencies

1.4 ← 1.1-1.3 (RED first); 1.5-1.7 ← 1.4; 1.8 independent (migration); 2.3-2.11 ← 1.4 (5-key maps / KANBAN, clears R1 type-red); 2.1/2.2 ← 1.4; 2.13 ← 2.3-2.11; Commit 2 ← Commit 1.