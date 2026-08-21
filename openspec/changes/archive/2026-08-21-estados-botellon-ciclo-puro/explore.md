# Exploration: estados-botellon-ciclo-puro

> SDD phase: explore (READ-ONLY — no code was modified)
> Change: `estados-botellon-ciclo-puro` — simplify botellon lifecycle from 9 estados to a pure 5-estado cycle.
> Decisions already locked with the user (not re-litigated here): new cycle `entregado → recibido → recarga → listo → entregado` (+ `listo → delivery → entregado`), removal of `planta`/`mantenimiento`/`danado`/`perdido`, removal of the dañados/perdidos alert feature (analytics `botellonesDanados`, alert-panel category, notification tipo `botellon_danado`), migration of BOT-00048 (planta → recibido), DB check constraint 9→5, SDD + epic docs update.

---

## Current State

The botellon state machine lives in `src/lib/utils/estados.ts` (pure TS, no server deps):

- **9 estados**: `recibido, planta, recarga, listo, delivery, entregado, danado, perdido, mantenimiento`.
- **TRANSICIONES** include exception edges (`danado/perdido/mantenimiento → planta`) and multi-source shortcuts (`entregado → recarga` one-pass).
- **OPERACIONES** (terminal scanner ops): `recibir` (entregado→recibido), `recargar` (sources `['entregado','recibido']` → recarga, requiresCliente+createsRec), `listo` (recarga→listo). `esTransicionValida` mirrors the server `.in('estado', sources)` guard.
- **ESTADOS_KANBAN** = `['recibido','planta','recarga','listo','delivery']`; **ESTADOS_EXCEPCION** = `['danado','perdido','mantenimiento']`; ESTADO_LABELS/ESTADO_COLORS cover all 9.

Consumers: `operaciones-dashboard.tsx` (only importer of KANBAN/EXCEPCION), the botellon form, the QR public page `/b/[codigo]`, and the carga scanner page (uses `ESTADO_COLORS['danado']` as the generic invalid-badge red).

Server actions (`botellones.ts`, `analytics.ts`, `api/alertas/route.ts`) hardcode `'planta'`, `'danado'`, `'perdido'` and the `botellon_danado` notification. `cargas.ts` drives all writes off `OPERACIONES` — auto-adapts to any sources change (verified: no hardcoded estado besides `'recarga'` target).

DB: `supabase/migrations/0005_botellon_lifecycle.sql` sets the 9-estado `botellones_estado_check` constraint and default `'recibido'`. Live data per orchestrator: 1 botellón in `planta` (BOT-00048, Farmacia Vida Sana), remainder already in valid estados; 0 rows in danado/perdido/mantenimiento.

Tests: `tests/unit/estados.test.ts` asserts the 9-estado invariant and exception rejection; `tests/unit/carga-registrar.test.ts` exercises the multi-source recarga (`['entregado','recibido']`); `tests/e2e/business-flows.spec.ts` asserts `'planta'` text and a `'mantenimiento'` select option.

## Verified Impact Map (file-by-file)

### Backend / DB

| File | Lines | What changes | Est. ± lines |
|---|---|---|---|
| `src/lib/utils/estados.ts` | all | New 5-estado `ESTADOS`; TRANSICIONES per locked table (entregado→[recibido], recibido→[recarga], recarga→[listo], listo→[entregado, delivery], delivery→[entregado]); drop exception states; `ESTADOS_KANBAN` → `['recibido','recarga','listo','delivery']`; **delete `ESTADOS_EXCEPCION`** (only consumer is operaciones-dashboard, updated in same change); trim LABELS/COLORS (−4 each); doc comment. **Key semantic change: `OPERACIONES.recargar.sources` → `['recibido']`** (pure cycle: the `entregado → recarga` one-pass shortcut is removed; Recargar only accepts recibido per locked terminal ops) | ~45 |
| `src/lib/db/botellones.ts` | L146-150, 157-184, 255 | `updateBotellon`: replace `estado === 'planta'` auto-assign rule and `!cliente_id && estado==='entregado' → 'planta'` (→ `'recibido'`, the cycle start; see Open Decision D1); **delete the danado/perdido notification block (~28 lines: select codigo, perfiles, insert notificaciones tipo `botellon_danado`)**. `moverBotellon` L255: drop `'planta'` from the client-clearing branch (only `'recibido'`) | ~40 |
| `src/lib/db/analytics.ts` | L22, 59, 129-132, 162-163, 288-294, 311, 382-389, 396 | Remove `botellonesEnPlanta` KPI (type, parallel query `.eq('estado','planta')`, both return objects); remove `botellonesDanados` from `AlertasPanel` type, the `.in('estado',['danado','perdido'])` query, the mapping, and both empty-return fallbacks. `botellonesActivos` (`.in('estado',['entregado'])`, L128) and repartidor query (L512) stay — `entregado` survives | ~30 |
| `src/app/api/alertas/route.ts` | L12 | Drop `botellonesDanados: []` from the 500 fallback JSON | ~2 |
| `supabase/migrations/0009_botellon_estados_puros.sql` | new | See DB Migration Steps below | ~18 new |
| `src/lib/db/cargas.ts` | — | **No change needed** (verified). All validation/updates derive from `OPERACIONES`; with `recargar.sources=['recibido']` the `.in('estado', sources)` guards and per-item reasons adapt automatically | 0 |
| `src/lib/db/loyalty.ts` | — | **No change** (verified: zero botellon-estado references; only `premios.estado`) | 0 |
| `src/lib/db/recargas.ts`, `premios.ts`, `reportes-tabs.tsx`, `export/actions.tsx`, `premios` pages, `fidelidad-tab.tsx`, `cliente-ficha-pdf.tsx`, `scanner-modal.tsx` | — | **No change** (verified: their `'entregado'`/`'pendiente'` strings are premios-table estado, unrelated) | 0 |

### Frontend

| File | Lines | What changes | Est. ± lines |
|---|---|---|---|
| `src/components/dashboard/operaciones-dashboard.tsx` | L10, 13-25, 95-107, 120-128, 136-141, 197-234, 334 | Drop `ESTADOS_EXCEPCION` import; remove 4 exception entries from `ESTADO_META`; rebuild `TODOS_ESTADOS = [...ESTADOS_KANBAN, 'entregado']`; remove `enPlanta` KPI (L137); remove `danados` counter + red AlertChip (L107, 120-128 — the dañados/perdidos alert feature); **remove the whole Excepciones section incl. "↩ Restaurar a planta" (L197-234)**; kanban drops the planta column (4 columns); "Devolver" (entregado→recibido) stays valid | ~60 |
| `src/components/dashboard/admin-dashboard.tsx` | L6, 64-68 | Remove "En planta" KPI card + `Package` icon import | ~8 |
| `src/components/dashboard/botellones-donut-chart.tsx` | L10-17 | Replace stale local `ESTADO_COLORS` keys (`disponible/asignado/en_recarga/dañado/perdido/en_planta`) with the 5 real estados — fixes a pre-existing mismatch where no botellon ever matched a color | ~6 |
| `src/components/dashboard/alert-panel.tsx` | L23, 30, 40, 63, 225 | Remove `botellonesDanados` from both types, the merge, the `CATEGORIES` entry (icon `Wrench` import) and the pagination label ternary | ~15 |
| `src/components/notificaciones/notification-icon.tsx` | L16 | Remove `botellon_danado` icon entry | ~2 |
| `src/app/(dashboard)/notificaciones/notificaciones-list.tsx` | L16 | Remove `botellon_danado` filter tab (NEW FINDING vs orchestrator grep — same alert-feature family) | ~1 |
| `src/app/(dashboard)/botellones/[id]/form.tsx` | L66 | "Sin asignar (planta)" → "Sin asignar" (label tied to removed estado; see D1) | ~1 |
| `src/app/(dashboard)/botellones/page.tsx` | L10-17 | Replace stale local `ESTADO_COLORS` (`disponible/asignado/en_recarga/mantenimiento/dañado/perdido`) with the 5-estado map — pre-existing bug: badges rendered uncolored raw estado text for all current botellones | ~8 |
| `src/app/(dashboard)/clientes/[id]/tabs.tsx` | L220-223, 537-543 | Remove `mantenimiento/dañado/perdido` (and stale `activo/asignado`) from both `estadoBadge` maps; use shared `ESTADO_COLORS` or the 5 keys | ~8 |
| `src/app/(dashboard)/recargas/carga/page.tsx` | L393 | `ESTADO_COLORS['danado']` invalid-badge fallback → explicit red badge class (removed key would return `''`, breaking the red badge) | ~2 |
| `src/app/b/[codigo]/page.tsx` | — | **No change** (consumes LABELS/COLORS with `??` fallback — auto-benefits) | 0 |

### Tests

| File | Lines | What changes |
|---|---|---|
| `tests/unit/estados.test.ts` | L94-98, 114-117, +OPERACIONES block L52-59 | Assert 5 estados (`toHaveLength(5)`); delete the "rejects exception estados" test; `OPERACIONES.recargar` expectation → `sources: ['recibido']`; delete "entregado → recarga in one pass" test; new TRANSICIONES assertions for the locked table |
| `tests/unit/carga-registrar.test.ts` | many (recarga branch) | Recargar fixtures `estado:'entregado'` → `'recibido'`; `.in('estado', ['entregado','recibido'])` assertions → `['recibido']`; delete/replace multi-source describe block and any entregado→recarga one-pass tests (~5-6 tests affected) |
| `tests/component/carga-page.test.tsx` | L305-328 (re-validate badges), L249 | "Under recargar, entregado is valid" assertion must flip: entregado is NO LONGER a recargar source → red badge; fixture `estado:'planta'` (L249) → `'recibido'` (cosmetic) |
| `tests/unit/botellon-by-codigo.test.ts` | L90 | Fixture `estado:'planta'` → `'recibido'` (cosmetic — no semantic assertion) |
| `tests/e2e/business-flows.spec.ts` | L144, 154 | "list with states": `getByText('planta')` → assert a surviving estado (e.g. 'Recibido'); "change state": `selectOption('mantenimiento')` → a valid transition of the first botellon (option no longer exists; selectOption would throw) |

### Docs (epic documentation update)

| File | What changes |
|---|---|
| `docs/epics/04-Botellones-QR.md` | HIST-4.2 estados/transiciones block + HIST-4.3 assign/unassign rules + estados diagram → the 5-estado cycle |
| `docs/epics/08-Panel-Reportes.md` | HIST-8.1 "Botellones en planta", HIST-8.3 "en mantenimiento o danados", KPI query table |
| `docs/epics/07-Notificaciones.md` | Remove botellón dañado notification story/table row |
| `docs/epics/13-Recarga-Rapida-QR.md` | L57 "(botellon en planta)" note |
| `docs/plan.md` | Add this change to the "Cambios SDD adicionales" table |
| `docs/epics.md` | Master doc still documents the ORIGINAL 6-estado model (L352, 401-419, 589, 626, 650) — update to the 5-estado cycle |
| `docs/MAPA-SISTEMA.md` | L23/27/38 (KPI list, alertas list, updateBotellon notification note) |
| `docs/MANUAL-USUARIO.md` | L25-29, 78, 177, 281, 301 (KPI cards, donut legend, dañado flow, FAQ) |
| `docs/epics/05-Recargas.md` | **No estado references found** — no change needed (or a one-line cycle note only) |

## DB Migration Steps (`supabase/migrations/0009_botellon_estados_puros.sql`)

1. **Data first, then constraint** (ordering is mandatory — the UPDATE would fail once the new CHECK is in place):
   ```sql
   UPDATE public.botellones SET estado = 'recibido' WHERE estado = 'planta';               -- BOT-00048
   UPDATE public.botellones SET estado = 'recibido' WHERE estado IN ('danado','perdido','mantenimiento'); -- defensive; 0 rows today
   ```
2. Replace the check constraint:
   ```sql
   ALTER TABLE public.botellones DROP CONSTRAINT IF EXISTS botellones_estado_check;
   ALTER TABLE public.botellones ADD CONSTRAINT botellones_estado_check
     CHECK (estado IN ('entregado','recibido','recarga','listo','delivery'));
   ```
3. Default stays `'recibido'` (set by 0005) — `createBotellon` inserts `{}` and new botellones enter dirty, which is correct for the pure cycle.
4. Optional: verify with a pre/post count (`SELECT estado, count(*) FROM botellones GROUP BY estado`) — no RLS/trigger changes required.

## Line Budget Estimate (400-line guard)

- **Commit 1 — backend/DB** (estados.ts, botellones.ts, analytics.ts, api/alertas, migration, estados.test.ts, carga-registrar.test.ts): **~190** changed lines.
- **Commit 2 — frontend + docs** (8 components/pages, 2 e2e lines, carga-page test, 7-8 doc files): **~195** changed lines.
- **Total ≈ 385** — under budget but tight.

**Forecast guard lines** (for sdd-tasks): `Decision needed before apply: Yes` (delivery strategy must resolve to chained PRs) · `Chained PRs recommended: Yes` · `400-line budget risk: Medium`.

## Approaches

1. **Pure-cycle rewrite, recargar sources → `['recibido']` only** (recommended) — matches the user's locked terminal-ops table (Recargar = recibido→recarga) and the "ciclo puro" intent. Removes the one-pass `entregado → recarga` shortcut everywhere: OPERACIONES, TRANSICIONES, kanban advance order, and the tests that assert it. Cost: ~5 tests in carga-registrar/carga-page need their fixtures flipped.
2. **Keep the multi-source shortcut** (`['entregado','recibido']`) — fewer test changes, but violates the locked pure cycle (entregado would jump straight to recarga, skipping recibir) and contradicts the terminal-op table. Rejected per locked decisions.

## Recommendation

Approach 1. Two chained commits/PRs: **(1) backend/db** — estados.ts + server actions + migration + unit tests; **(2) frontend + docs** — dashboard components/pages + e2e + epic docs. Each slice is independently verifiable (tsc + vitest after slice 1; component/e2e + UI after slice 2) and independently reversible (slice 2 rolls back without schema changes).

## Risks / Open Decisions

- **D1 (open, for design phase)**: `updateBotellon` unassign/assign auto-rule semantics. Current: assign→`entregado` only when estado was `'planta'`; unassign from `entregado` → `'planta'`. Recommended default: assign auto-`entregado` when estado is `'listo'` (or empty); unassign → `'recibido'`. The form's "Sin asignar (planta)" label and `moverBotellon`'s client-clearing branch must pick the same target.
- **D2 (open)**: `listo → delivery` advance (kanban "→" button) stays per locked table (listo → entregado, delivery) — confirm delivery remains reachable only from listo and always requires a client at `entregado`.
- **R1 — e2e coupling to DB state**: business-flows "list with states" asserts literal `'planta'`; after migration the text disappears — test must assert a surviving estado. The "change state" test's `'mantenimiento'` option will throw on select. Both must be fixed in the frontend slice, not left to the known pre-existing 4 e2e failures.
- **R2 — `ESTADO_COLORS['danado']` fallback** (carga page L393): silently becomes `''` (no red badge) if missed — must be replaced with explicit red classes.
- **R3 — stale color maps**: botellones/page.tsx and donut-chart already carry keys (`disponible/asignado/en_recarga…`) that match NOTHING in the current data; leaving them means the new estados render colorless. Fix in the same slice.
- **R4 — migration ordering**: data UPDATE must precede the constraint swap; also verify live counts (`planta`=1, exceptions=0) before apply; the defensive exception-remap UPDATE covers drift.
- **R5 — scope creep**: MANUAL-USUARIO.md/epics.md/MAPA-SISTEMA.md carry the even-older 6-estado model; updating them is in scope (docs epic update) but should be one doc commit, not spread across both slices.
- **R6 — recargar source change is a behavior regression risk**: staff who previously scanned `entregado` botellones straight into recarga must now scan twice (recibir, then recargar). No UI action needed in code, but the operation flow changes — call this out in the proposal for the user to confirm.

## Ready for Proposal

**Yes.** The impact map is fully verified against source (no assumptions beyond the orchestrator-supplied live-data counts). Recommend the orchestrator surface R6 (recargar source narrowing) and D1 (unassign target) to the user before/at proposal time, then proceed to `propose`.