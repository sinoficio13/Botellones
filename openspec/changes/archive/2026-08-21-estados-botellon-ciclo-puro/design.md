# Design: Botellon Pure 5-Estado Cycle

## Technical Approach

Pure-cycle rewrite (locked Approach 1 from explore): collapse the 9-estado machine to the exact 5-estado contract in `openspec/specs/botellon-ciclo-estados/spec.md` (R1 TRANSICIONES, R2 no removed estados, R3 terminal ops, R4 stock/assign, R5 migration). `recargar` narrows to `sources: ['recibido']`, removing the `entregado → recarga` one-pass shortcut (carga-terminal + batch-carga deltas). Backend/db slice first, frontend+docs second — 2 sequential commits direct to main, NO PRs, each slice independently verifiable.

## Architecture Decisions

| # | Decision | Alternatives | Rationale |
|---|---|---|---|
| D1 | `recargar.sources → ['recibido']` | keep `['entregado','recibido']` | Locked pure cycle; staff scan twice (recibir → recargar). Spec R3. |
| D2 | Delete `ESTADOS_EXCEPCION` outright | keep + ignore | Only consumer (operaciones-dashboard) is updated in this change; spec R2. |
| D3 | `updateBotellon`: assign client → `estado='entregado'` unconditionally; unassign → keep current estado | planta auto-branch; unassign→'recibido' | Canonical R4 "Assigning a client sells the stock"; no planta exists. Resolves explore D1. |
| D4 | `moverBotellon` clears client only on `'recibido'` | keep `'planta'` branch | Reintegro (Devolver) target = cycle start. |
| D5 | `botellones/page.tsx` + `tabs.tsx` import shared `ESTADO_LABELS`/`ESTADO_COLORS` | minimal key-replacement | Kills stale maps (`disponible/asignado/…` matched nothing — R3) and the raw-text badge bug; matches `form.tsx` pattern. |
| D6 | Carga badge: local `BADGE_INVALID` const | `ESTADO_COLORS['danado']` | Key removed → would return `''` (R2); explicit red classes keep the invalid-badge red. Drop `ESTADO_COLORS` import (only use was L393). |
| D7 | Commit 1 verified via scoped vitest only | per-commit `next build` | No `tsc` script in package.json; `next build` type-checks the whole tree and stays red until commit 2 (see Risks R1). |
| D8 | Migration: UPDATE rows BEFORE constraint swap | constraint first | New CHECK would reject the UPDATE (spec R5). |

## Data Flow

```
estados.ts (single source) ──> OPERACIONES ──> cargas.ts registrarOperacion (.in sources guard)
        │                         │
        └──> TRANSICIONES ──> botellones.ts/UI (getTransiciones) ──> DB CHECK (5 estados)
entregado → recibido → recarga → listo → entregado  (+ listo → delivery → entregado)
```

## File Changes

| File | Action | Exact changes |
|---|---|---|
| `src/lib/utils/estados.ts` | Modify | `ESTADOS` 9→5; TRANSICIONES exact contract; `OPERACIONES.recargar.sources→['recibido']`; delete `ESTADOS_EXCEPCION`; `ESTADOS_KANBAN=['recibido','recarga','listo','delivery']`; LABELS/COLORS −4 keys; header doc comment → 5-cycle |
| `src/lib/db/botellones.ts` | Modify | L146-151: replace planta auto-assign with `if (cliente_id) update.estado = 'entregado';` (unassign leaves estado); L157-184: delete danado/perdido notification block (`botellon_danado` inserts); L255: `nuevoEstado === 'recibido'` only |
| `src/lib/db/analytics.ts` | Modify | L22,162,174: `botellonesEnPlanta` type+returns; L114,132: parallel query; L59: `botellonesDanados` in `AlertasPanel`; L288-294: danados query; L311,382-389,396: mapping + both fallbacks. `botellonesActivos`/repartidor (`entregado`) stay |
| `src/app/api/alertas/route.ts` | Modify | L12: drop `botellonesDanados: []` from 500 fallback |
| `supabase/migrations/0009_botellon_estados_puros.sql` | Create | Migration SQL below |
| `src/lib/db/cargas.ts` | Verify | 0 changes (OPERACIONES-driven; `.in('estado', sources)` auto-adapts) |
| `operaciones-dashboard.tsx` | Modify | L10 drop `ESTADOS_EXCEPCION` import; L13-23 −4 `ESTADO_META` entries; L25 `TODOS_ESTADOS=[...ESTADOS_KANBAN,'entregado']`; L97 excepciones; L100 `enPlanta`; L107 `danados`; L120-128 dañados chip + green-fallback; L197-234 Excepciones section + "↩ Restaurar a planta"; L151 grid → `lg:grid-cols-4` |
| `admin-dashboard.tsx` | Modify | L64-68 "En planta" KPI; L6 `Package` import; grid `lg:grid-cols-7→6` |
| `botellones-donut-chart.tsx` | Modify | L10-17 map → 5 keys: entregado `hsl(262,83%,58%)`, recibido `hsl(215,20%,45%)`, recarga `hsl(190,90%,50%)`, listo `hsl(142,71%,45%)`, delivery `hsl(38,92%,50%)` |
| `alert-panel.tsx` | Modify | L23,30 `botellonesDanados` in both types; L40 merge; L63 CATEGORIES entry + `Wrench` import; L225 ternary → `active==='clientesInactivos'?'inactivos':'premios'` |
| `notification-icon.tsx` | Modify | L16 remove `botellon_danado` |
| `notificaciones-list.tsx` | Modify | L16 remove `botellon_danado` filter tab |
| `botellones/[id]/form.tsx` | Modify | L66 "Sin asignar (planta)" → "Sin asignar" |
| `botellones/page.tsx` | Modify | L10-17 delete local map → import shared `ESTADO_LABELS`,`ESTADO_COLORS`; render `ESTADO_LABELS[b.estado] ?? b.estado` + color |
| `clientes/[id]/tabs.tsx` | Modify | L220-223 MiniCard ternary → shared map lookup; L537-543 `estadoBadge` → shared `ESTADO_COLORS` (5 keys) |
| `recargas/carga/page.tsx` | Modify | L393 → `BADGE_INVALID` const (`bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`); remove `ESTADO_COLORS` from import (L13) |

## Interfaces / Contracts

`estados.ts` after change:

```ts
export const ESTADOS = ['entregado','recibido','recarga','listo','delivery'] as const;
const TRANSICIONES: Record<Estado, Estado[]> = {
  entregado: ['recibido'], recibido: ['recarga'], recarga: ['listo'],
  listo: ['entregado','delivery'], delivery: ['entregado'],
};
// OPERACIONES: recibir {target:'recibido',sources:['entregado'],requiresCliente:false,createsRec:false}
//              recargar {target:'recarga',sources:['recibido'],requiresCliente:true,createsRec:true}
//              listo    {target:'listo',sources:['recarga'],requiresCliente:false,createsRec:false}
```

Migration `0009_botellon_estados_puros.sql`:

```sql
-- 1. Data first (BOT-00048 + defensive) — MUST precede the constraint swap
UPDATE public.botellones SET estado = 'recibido' WHERE estado = 'planta';
UPDATE public.botellones SET estado = 'recibido' WHERE estado IN ('danado','perdido','mantenimiento');
-- 2. Constraint 9 → 5
ALTER TABLE public.botellones DROP CONSTRAINT IF EXISTS botellones_estado_check;
ALTER TABLE public.botellones ADD CONSTRAINT botellones_estado_check
  CHECK (estado IN ('entregado','recibido','recarga','listo','delivery'));
-- default stays 'recibido' (set by 0005) — no change
```

## Testing Strategy

| File | Changes |
|---|---|
| `tests/unit/estados.test.ts` | 5 estados (`toHaveLength(5)`); recargar `sources:['recibido']`; `esTransicionValida('entregado','recargar')→false`; delete "rejects exception estados"; delete one-pass test; new TRANSICIONES contract block (listo→[entregado,delivery], delivery→[entregado]) |
| `tests/unit/carga-registrar.test.ts` | `entregados` fixture → `estado:'recibido'` (flips ~10 recarga-branch tests); L424/L1020 `.in('estado',…)→['recibido']`; L631 ghost-id fixture→recibido; multi-source describe → single-source; `registrarRecarga` describe (legacy `/recargas/nueva`) UNCHANGED |
| `tests/unit/botellon-by-codigo.test.ts` | L90 fixture `'planta'→'recibido'` (cosmetic) |
| `tests/component/carga-page.test.tsx` | L249 `'planta'→'recibido'`; add `BOT_RECIBIDO` fixture; "valid green" test (L279-290) → recibido under recargar; "re-validates live" (L305-328) → entregado red under recargar / green under recibir |
| `tests/e2e/business-flows.spec.ts` | L144 `'planta'` → surviving estado label (e.g. `getByText(/Recibido|Listo|Entregado/)`); L154 `selectOption('mantenimiento')` → `selectOption({index:1})` (first valid transition; guarded by existing `isVisible()`) |

## Alert-Feature Removal Scope

Dañados/perdidos alert feature (spec R2 scenario 2) spans: `analytics.ts` (`AlertasPanel.botellonesDanados`, danados query, mapping, fallbacks), `api/alertas/route.ts` fallback, `alert-panel.tsx` (types/merge/CATEGORIES/ternary), `notification-icon.tsx` (`botellon_danado`), `notificaciones-list.tsx` (filter tab), `botellones.ts` L157-184 (notification generation). Notification `tipo: 'botellon_danado'` no longer produced; existing DB rows remain (no cleanup in 0009 — render under "Todas" with 🔔 fallback).

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Migration 0009 per SQL above; verify live counts pre-apply (`planta`=1, exceptions=0). Rollback: `git revert` commit 2, then commit 1; 0005 constraint + 0009 remap are the restore path. No destructive schema change.

## Risks / Edge Cases

- **R1 (build-gate)**: commit 1 leaves `next build` type-check red (operaciones-dashboard `ESTADOS_EXCEPCION`, admin-dashboard `botellonesEnPlanta`, alert-panel `botellonesDanados`). Mitigation: commit 1 green = `npx vitest run tests/unit/estados.test.ts tests/unit/carga-registrar.test.ts tests/unit/botellon-by-codigo.test.ts`; full build verified after commit 2. Alternative (if per-commit build required): pull the 3 compile-guard edits into commit 1 (~5 lines).
- R2 badge red → D6 const. R3 stale maps → D5. R4 ordering → D8.
- Recargar source narrowing is a staff-flow regression (scan twice) — flagged, accepted.
- Legacy `registrarRecarga` (entregado→recarga) intentionally unchanged per batch-carga delta — do not "fix".
- Docs: `docs/epics/03-Clientes.md` L78 also carries old badge colors (NEW FINDING) — include in the doc commit.

## Open Questions

None blocking. D1/D2 from explore resolved; delivery split locked by user (2 commits direct to main, no PRs).