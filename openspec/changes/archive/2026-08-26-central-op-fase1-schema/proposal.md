# Proposal: Central de Operaciones — Fase 1: FIFO schema, audit trail, batch mover RPC

## Intent

EPIC-15 redesigns `/dashboard` into a client-grouped, mobile-first operations queue with strict FIFO by time-in-current-state. Nothing in the DB supports that today: `botellones` has no `estado_desde`, no state-change history exists, and the only mover is the per-row TS `moverBotellon`. The future queue advances whole client groups in one tap, which needs a single-transaction batch move. This fase builds ONLY the data foundation (no UI): FIFO column + backfill, audit table + trigger, a transactional batch RPC mirroring the existing TS machine, and the pure grouping types/util fase 3 consumes.

## Scope

### In Scope
- `estado_desde` (timestamptz NOT NULL DEFAULT now()) on `botellones` + backfill of existing rows + trigger `trg_estado_desde` (estado change → stamp `estado_desde = now()` + insert `movimientos` row).
- Table `movimientos` (audit trail) + index on `botellon_id` + RLS mirroring the admin/repartidor policy style.
- RPC `mover_botellones(p_ids uuid[], p_estado text)` — SECURITY DEFINER, single transactional UPDATE, role guard, SQL mirror of `getEstadosPermitidos` (forward + reversion + identity).
- `GrupoCliente` type + pure `agrupar()` in `src/lib/utils/grupos.ts` + vitest tests.
- `src/types/database.ts`: add `estado_desde`, `movimientos`, RPC signature.

### Out of Scope
- All UI (fase 3), design tokens (fase 2), kanban (fase 4), realtime/WhatsApp/ficha (fase 5).
- Changes to `moverBotellon`/`updateBotellon`, `operaciones-dashboard.tsx`, `estados.ts`, or realtime publication 0010 — old writers keep working; the trigger retrofits them.
- `cliente_id` changes via RPC (sale-assignment exception); stock bottles stay out of the grouped queue (fase 3 filters client-owned).
- No new estados; states stay `text` + CHECK (no enum); codes stay `BOT-XXXXX`.
- No `movimientos` backfill (no historical state data — documented limitation).
- No dev seed migration (real remote data, 15 botellones, serves as dev data — decision documented below).

## Business Rules (locked)

1. **FIFO basis**: bottle age = time in CURRENT estado = `now() - estado_desde`. Backfill: `entregado` → `COALESCE(fecha_entrega, fecha_creacion, created_at, now())`; all other estados → `COALESCE(fecha_creacion, created_at, now())`. Source decision: `fecha_creacion` is app-consistent (`getBotellones` orders by it, botellones.ts L42); `created_at` is the defensive fallback. Known limitation: no historical state-change data exists → backfilled age is an approximation; exact ages accrue from deployment onward.
2. **Trigger** (`BEFORE UPDATE`, SECURITY DEFINER, search_path pinned): fires only when `NEW.estado IS DISTINCT FROM OLD.estado`; sets `NEW.estado_desde := now()` and inserts `movimientos(botellon_id, estado_previo, estado_nuevo, usuario_id = auth.uid())`. `usuario_id` nullable (service-role writes have no uid). No insert when estado unchanged. Idempotent (`CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS`).
3. **Machine**: RPC destino MUST be in `getEstadosPermitidos(actual)` — forward + reversion + identity, mirrored in SQL. Identity move permitted. Invalid batch → exception with zero writes (all-or-nothing, single transaction).
4. **Role guard**: RPC rejects unauthenticated and non-admin/repartidor (`auth.jwt() -> 'app_metadata' ->> 'role'`), because SECURITY DEFINER bypasses RLS.
5. **Entregado via RPC does not require/assign a client** — machine-only validation (owner semantics are UI-enforced in fase 3); the RPC never touches `cliente_id`.
6. **Grouping**: group = `cliente_id`; group age = `min(estado_desde)`; groups sorted oldest-first; codes sorted oldest-first inside group (tiebreak: `codigo`). `agrupar()` is total — null `cliente_id` is a valid (stock) group key; fase 3 passes only client-owned rows.

## User Stories / Scenarios

- **FIFO queue basis**: a bottle that entered `recarga` yesterday sorts ahead of one that entered today — `estado_desde` drives it.
- **Audit trail**: every estado change (form, kanban action, batch RPC) appends a `movimientos` row with prev/new estado + user; a no-op update inserts nothing.
- **Batch move in one transaction**: "Pasar 3 a Listo" moves 3 bottles in ONE UPDATE; if one was concurrently moved and the batch is now invalid, NOTHING is written and the caller gets an error.
- **Rejected jump**: `recibido → listo` via RPC → exception, zero writes (mirrors botellon-ciclo-estados S5).
- **Grouped queue data**: `agrupar()` returns client groups oldest-first, codes oldest-first inside; a client's 3 bottles of different ages group under the oldest.

## Capabilities

### New Capabilities
- `central-operaciones-schema`: FIFO state-age foundation for the Central de Operaciones — `estado_desde` + backfill, `movimientos` audit + trigger, `mover_botellones` transactional batch RPC (SQL machine mirror + role guard), `GrupoCliente`/`agrupar()` grouping util, DB type updates.

### Modified Capabilities
- `botellon-ciclo-estados` (delta): every estado write path now stamps `estado_desde` and appends `movimientos` (trigger side-effect contract); the manual-move rule gains a SQL-side mirror — the batch mover MUST validate against the same permitted sets as `getEstadosPermitidos`.

## Approach

Migration 0011 adds the column, backfills, creates `movimientos` + RLS, then installs the SECURITY DEFINER trigger (definer rights avoid the RLS-on-trigger footgun for authenticated-admin AND service-role writers). Migration 0012 adds a small SQL helper mirroring TRANSICIONES/REVERSIONES/identity as `text[]` and the RPC: role guard → single `UPDATE ... SET estado = p_estado WHERE id = ANY(p_ids) AND p_estado = ANY(permitidos(estado)) RETURNING *` → `GET DIAGNOSTICS` row-count check vs `cardinality(p_ids)` → mismatch raises (rollback → zero writes). TOCTOU is impossible because validation lives INSIDE the UPDATE's WHERE. Pure TS: `grupos.ts` + vitest; `database.ts` hand-updated (existing generated-file convention).

## Approach Comparison

| Decision | Chosen | Why |
|---|---|---|
| Validation locus | Inside UPDATE WHERE + row-count check | Atomic, TOCTOU-free; one statement satisfies the AC; mismatch → exception → zero writes |
| Trigger security | SECURITY DEFINER trigger fn | Authenticated-admin direct UPDATEs would otherwise fail the movimientos INSERT under RLS; service-role unaffected |
| Backfill source | `fecha_creacion` primary (`created_at`/`now()` fallback; `fecha_entrega` only for `entregado`) | App-consistent (`getBotellones` orders by it) |
| Machine mirror | SQL helper returning `text[]` (CASE) | No new table; locked 5-state maps are small; drift guarded by verify diff |
| Dev data | No seed migration | 15 real bottles in remote project; minimal optional seed deferred to fase 3 if a fresh env is ever needed |
| Grouping util | New `grupos.ts`, total fn (null key = stock group) | Pure, testable, UI-agnostic |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `supabase/migrations/0011_fifo_estado_desde.sql` | New | `estado_desde` + backfill + trigger fn/trigger + `movimientos` + index + RLS |
| `supabase/migrations/0012_rpc_mover_botellones.sql` | New | permitted-states helper + `mover_botellones` RPC (definer, role guard, batch UPDATE) |
| `src/lib/utils/grupos.ts` | New | `BotellonAgrupable`, `GrupoCliente`, pure `agrupar()` |
| `tests/unit/grupos.test.ts` | New | grouping/sorting/ordering/tiebreak/null-key tests |
| `src/types/database.ts` | Modified | +`estado_desde` (Row/Insert/Update), +`movimientos` table, +RPC signature |
| `tests/integration/rls-policies.test.ts` | Modified | +`movimientos` expectation (admin full, repartidor SELECT) |
| `src/lib/utils/estados.ts`, `src/lib/db/botellones.ts`, UI components | Untouched | Machine and old writers unchanged; trigger retrofits them |

## Risks

| Risk | Tier | Mitigation |
|---|---|---|
| TS↔SQL machine drift (`estados.ts` maps vs SQL CASE) | WARNING | Small locked sets; CASE comments cite estados.ts lines; verify step diffs both; unit tests pin the TS side |
| New code ~390–450 lines vs 400-line review budget | WARNING | Slice into chained PRs: PR-A SQL migrations (~200 lines), PR-B TS layer (~200 lines); each under budget |
| Trigger RLS footgun on authenticated-admin writes | WARNING | SECURITY DEFINER trigger fn (approach lock) |
| `entregado` via RPC without client (stock bottle) | NOTE | Fase 3 UI only advances delivery→entregado (client-owned); RPC is machine-only by locked scope |
| Backfilled ages are approximations (no history) | NOTE | Documented limitation; exact ages begin at deployment |
| Duplicate `p_ids` / null-estado rows | NOTE | Row-count check rejects mismatch; design dedupes via `DISTINCT UNNEST` |

## Non-goals / Constraints

- No UI, no tokens, no realtime changes (publication 0010 untouched); no enum conversion; no `cliente_id` writes via RPC; no changes to old writers, `operaciones-dashboard.tsx`, or `estados.ts`.
- No `movimientos` backfill; no PWA/e2e; RPC caller/server action deferred to fase 3.
- anon column-level grant on `botellones` (codigo, estado) unchanged — `estado_desde` stays invisible to anon.

## Rollback Plan

- Reverse order: (1) `DROP FUNCTION IF EXISTS public.mover_botellones` (+ helper) — revert 0012; (2) `DROP TRIGGER trg_estado_desde` + `DROP FUNCTION` + `DROP TABLE movimientos` + `ALTER TABLE botellones DROP COLUMN estado_desde` — revert 0011. Data-safe: backfill is derived, no original data destroyed; `movimientos` is additive.
- TS layer: revert `grupos.ts` + tests + `database.ts` edits (additive — safe to keep or drop).
- If the trigger misbehaves, drop it alone: old writers keep working unchanged (state writes revert to trigger-less behavior).

## Dependencies

- Connected Supabase project (MCP/CLI) to apply 0011/0012 and verify backfill + RPC + RLS.
- No new packages; vitest already present. No realtime/publication dependency.

## Proposal question round

Locked decisions from the orchestrator were respected (nullable `cliente_id`, text+CHECK estados, publication 0010 untouched, old writers untouched). Three assumptions need user sign-off before spec: (1) backfill source = `fecha_creacion` primary (not `created_at`); (2) NO dev seed migration (real remote data suffices); (3) capability mapping = new `central-operaciones-schema` + narrow delta on `botellon-ciclo-estados`.

## Success Criteria

- [ ] `estado_desde` NOT NULL DEFAULT now() applied; backfill leaves zero null/generic-now() rows (verified against the 15 real rows)
- [ ] Trigger stamps `estado_desde` and inserts `movimientos` only when estado changes; no-op updates insert nothing
- [ ] `movimientos` has index, FKs (botellones, auth.users), RLS admin full / repartidor SELECT; rls-policies test updated
- [ ] `mover_botellones` moves a valid batch in ONE UPDATE; invalid batch → exception with zero writes; unauthenticated/non-admin/repartidor rejected
- [ ] SQL permitted-sets equal `getEstadosPermitidos` for all 5 estados (verify diff)
- [ ] `agrupar()` tests green: group age = min(estado_desde), groups oldest-first, codes oldest-first, tiebreak, null-key
- [ ] `database.ts` reflects `estado_desde` + `movimientos` + RPC; full suite green; existing writer tests untouched and passing