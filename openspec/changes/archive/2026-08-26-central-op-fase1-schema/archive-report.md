# Archive Report — central-op-fase1-schema

**Change**: central-op-fase1-schema
**Archived to**: `openspec/changes/archive/2026-08-26-central-op-fase1-schema/`
**Date**: 2026-08-26
**Verdict**: pass_with_warnings (0 CRITICAL, 0 blockers, 9/9 requirements, 34/34 scenarios)
**Artifact store**: hybrid (openspec files + Engram topic `sdd/central-op-fase1-schema/archive-report`)

## Summary

Central de Operaciones Fase 1 — the FIFO state-age data foundation: `botellones.estado_desde` with per-estado backfill (migration 0011), `movimientos` audit table + `trg_estado_desde` stamp/audit trigger, `mover_botellones` transactional batch RPC with SQL machine mirror + JWT role guard (migration 0012), `GrupoCliente`/`agrupar()` grouping util, and hand-updated DB types. No UI. Old writers (`moverBotellon`/`updateBotellon`) stay untouched; the trigger retrofits them. Verified **PASS WITH WARNINGS** — full suite 239/239 (21 files), `tsc --noEmit` clean, `npm run build` green, live Supabase checks match the migrations exactly. Both warnings are pre-existing/out-of-scope and do not block archive.

## Commits

| Commit | Content |
|---|---|
| `ef162b7` | Migration 0011 — fifo `estado_desde` + `movimientos` audit + trigger |
| `1e9d86e` | Migration 0012 — `mover_botellones` batch RPC + `estados_permitidos` mirror |
| `bc74e46` | `grupos.ts`/`grupos.test.ts` — agrupar grouping util with FIFO ordering |
| `46a4782` | `database.ts` types + `rls-policies.test.ts` movimientos expectations |

Branch `redesign/central-operaciones`, **not pushed** (delivery: ask-always — PRs are the orchestrator's ask-always step).

## What was archived

- proposal.md, design.md, tasks.md (11/11 `[x]` — T1.1–T5.1 complete), verify-report.md (pass_with_warnings, 9/9 req, 34/34 scenarios)
- Delta specs: `specs/central-operaciones-schema/spec.md` (full spec, 7 ADDED requirements / 21 scenarios), `specs/botellon-ciclo-estados/spec.md` (2 MODIFIED full-block requirements / 13 scenarios)

## Canonical specs synced

| Domain | Action | Details |
|--------|--------|---------|
| `openspec/specs/central-operaciones-schema/spec.md` | **Created** (NEW) | From delta ADDED requirements REQ-COS-1..7 (7 requirements, 21 scenarios); change-reference header note stripped, canonical `# Specification` + `## Purpose` + `## Requirements` structure |
| `openspec/specs/botellon-ciclo-estados/spec.md` | **Updated** (2 MODIFIED) | Full-block replacement per openspec convention — "Reversion set and getEstadosPermitidos" now includes the SQL-mirror rule + S-M1/S-M2; "Server-side validation with CAS guard" now includes the stamp/audit side-effect contract + S-A1/S-A2/S-A3. All other requirements and scenarios preserved (S1–S8 kept) |

## Verification evidence

- Envelope: `gentle-ai.verify-result/v1`, verdict `pass_with_warnings`, 0 blockers, 9/9 requirements, 34/34 scenarios, test exit 0 (`npm run test` → 239/239, 21 files), build exit 0 (`npx tsc --noEmit` clean, `npm run build` green).
- Live Supabase (read-only, this pass): `estado_desde` timestamptz NOT NULL DEFAULT now() with 0 NULLs; 5 RLS policies on `movimientos` (admin CRUD / repartidor SELECT); trigger present and firing (10 audit rows); `mover_botellones`/`estados_permitidos` present with SECURITY DEFINER + pinned `search_path`; SQL mirror order-identical to the TS machine for all 5 estados; backfill spot-check consistent on 15 real rows.

## Warnings carried forward (non-blocking, pre-existing / out of scope)

1. **W-1** — Remote `botellones_estado_check` still permits **9 estados** (recibido, planta, recarga, listo, delivery, entregado, danado, perdido, mantenimiento); migration 0009 was never applied to the live project. The 5-estado machine, the SQL mirror, and `estados_permitidos`' `ELSE ARRAY[p_estado]` fallback assume only the 5 canonical estados. Latent inconsistency: a row carrying a legacy estado (e.g. `planta`) can be moved to itself via the RPC, and manual writers reject it. This change is correct against the spec'd 5-estado model; the constraint swap is tracked elsewhere and **should be applied before fase-3 UI depends on strict 5-estado data**.
2. **W-2** — Local `src/types/database.ts` is the 14.15-format generated file and is already stale re `fecha_entrega` (migration 0005). The live 14.17 generator emits `fecha_entrega` in the `botellones` Row and a different `mover_botellones` `Returns` shape (`{...}[]` + `SetofOptions`). The hand-edit follows the file's own 14.15 convention (D12) and type-checks; a future `supabase gen types` regeneration would reconcile both.

## Engram traceability

| Artifact | Engram observation |
|---|---|
| proposal | #630 |
| spec | #631 |
| design | #632 |
| tasks | #633 |
| apply-progress | #634 |
| verify-report | #635 |
| archive-report | #636 (this report, `sdd/central-op-fase1-schema/archive-report`) |

## Next steps

1. **Orchestrator / user**: PRs for branch `redesign/central-operaciones` (ask-always step) — PR-A (SQL 0011+0012, ~220 lines) → PR-B (TS layer, ~270 lines, chained on PR-A).
2. **Tracked elsewhere, apply before fase-3**: W-1 — apply migration 0009's 5-estado constraint swap to the live Supabase project.
3. **Optional cleanup**: W-2 — regenerate `src/types/database.ts` via `supabase gen types` (14.17) once convenient; S-1 — drop unused `table` destructuring in `rls-policies.test.ts` L68/L78.
4. **Fase 2 of EPIC-15** (5-phase Central de Operaciones plan per docs/epics/15-Central-Operaciones.md) can proceed on top of this data foundation.

## SDD cycle complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.