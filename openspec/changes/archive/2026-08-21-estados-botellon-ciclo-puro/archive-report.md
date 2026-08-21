# Archive Report — estados-botellon-ciclo-puro

**Change**: estados-botellon-ciclo-puro
**Archived to**: `openspec/changes/archive/2026-08-21-estados-botellon-ciclo-puro/`
**Date**: 2026-08-21
**Verdict**: pass-with-warnings (0 CRITICAL, 0 blockers, 2 WARNING, 2 SUGGESTION)

## Summary

Simplified the botellon state machine from 9 estados to a pure 5-estado rotation cycle, matching the real business (the business does not receive/repair damaged bottles, does not track "lost" as a state, and planta/mantenimiento were unused).

## New cycle

```
entregado → recibido → recarga → listo → entregado
                              └→ delivery → entregado
entregado → recibido (repeats)
```

**Removed (4):** `planta`, `mantenimiento`, `danado`, `perdido`.

**Terminal de carga operations (2-scan pure cycle):**
- Recibir: `entregado → recibido`
- Recargar: `recibido → recarga` (ONLY recibido — no entregado shortcut)
- Listo: `recarga → listo`

**Stock/inventario:** botellones without a client are NOT a cycle state — they are stock outside the cycle, in `recibido`/`listo` with no cliente_id. Assigning them to a client → `entregado`.

## Commits

| Commit | Content |
|---|---|
| `f5abb78` | Backend/db: estados.ts 5-estado contract, botellones.ts/analytics.ts removals, migration 0009 |
| `42644ec` | Frontend+docs: removed exception/planta UI, badge maps fixed, docs → 5-estado cycle |
| `4b395fac` | Remediation: R4 tests (stock/assign/unassign/create), 199/199 |

## What was archived

- proposal.md, design.md, explore.md, tasks.md (24 tasks done), apply-progress.md, verify-report.md (v2)
- Delta specs: specs/carga-terminal/spec.md, specs/batch-carga/spec.md

## Canonical specs synced

- `openspec/specs/carga-terminal/spec.md` — recargar sources {recibido}, 2-scan flow, one-pass removed
- `openspec/specs/batch-carga/spec.md` — recibido → recarga transition
- `openspec/specs/botellon-ciclo-estados/spec.md` — new canonical 5-estado cycle spec (5 reqs, 12 scenarios)

## Pending action item (non-blocking)

**Migration 0009 constraint swap** — data remap already applied (BOT-00048 planta → recibido; live DB is 5-estado-only: entregado 7, recibido 4, recarga 2, listo 1). The CHECK constraint still allows the old 9 estados in the DB. Run in Supabase SQL Editor:

```sql
ALTER TABLE public.botellones DROP CONSTRAINT IF EXISTS botellones_estado_check;
ALTER TABLE public.botellones ADD CONSTRAINT botellones_estado_check
  CHECK (estado IN ('entregado','recibido','recarga','listo','delivery'));
```

Verification query after applying:
```sql
SELECT estado, count(*) FROM public.botellones GROUP BY estado;
```

## Docs updated

- docs/epics/04-Botellones-QR.md, 07-Notificaciones.md, 08-Panel-Reportes.md, 13-Recarga-Rapida-QR.md, 03-Clientes.md
- docs/epics.md (6→5 estado model), docs/MAPA-SISTEMA.md, docs/MANUAL-USUARIO.md, docs/plan.md

## Findings

- **WARNING-1**: constraint swap applied-pending (documented above, data-safe).
- **WARNING-2**: `docs/propuesta/generar_documento.py` retains 9-estado model (out-of-scope historical one-off).
- **SUGGESTION-1**: server-layer literal `estado-entregado` reason test (batch-carga S2).
- **SUGGESTION-2**: add stock-count test if an inventory aggregation is ever introduced.