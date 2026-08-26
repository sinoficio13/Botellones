# central-operaciones-schema Specification

## Purpose

FIFO state-age foundation for the Central de Operaciones: `estado_desde` + backfill, `movimientos` audit + trigger, `mover_botellones` transactional batch RPC (SQL machine mirror + role guard), `GrupoCliente`/`agrupar()` grouping util, and DB type updates. No UI. Old writers (`moverBotellon`/`updateBotellon`) stay untouched; the trigger retrofits them.

## Requirements

### Requirement: REQ-COS-1 — estado_desde column and FIFO backfill

`botellones.estado_desde` MUST be `timestamptz NOT NULL DEFAULT now()`; bottle age in current estado MUST be `now() - estado_desde`. Migration 0011 MUST backfill existing rows: `entregado` → `COALESCE(fecha_entrega, fecha_creacion, created_at, now())`; all other estados → `COALESCE(fecha_creacion, created_at, now())`. `fecha_creacion` is app-consistent; `created_at` is the defensive fallback. Backfilled ages are approximations; exact ages accrue from deployment onward.

#### Scenario: Column applied and NOT NULL

- GIVEN migration 0011 applied
- WHEN the `botellones` schema is inspected
- THEN `estado_desde` exists, NOT NULL, with `DEFAULT now()`

#### Scenario: Backfill picks per-estado source

- GIVEN an existing `entregado` row with `fecha_entrega` set, and an existing `recarga` row with `fecha_creacion` set
- WHEN migration 0011 backfills
- THEN `estado_desde` equals `fecha_entrega` for the first and `fecha_creacion` for the second

#### Scenario: Fallback when no source exists

- GIVEN a row whose `fecha_entrega`, `fecha_creacion`, and `created_at` are all NULL
- WHEN migration 0011 backfills
- THEN `estado_desde` is set to `now()`

### Requirement: REQ-COS-2 — movimientos audit table

Table `movimientos` MUST record every estado change: `botellon_id` FK → botellones, `estado_previo`, `estado_nuevo`, `usuario_id` (nullable FK → auth.users), `created_at` DEFAULT now(). It MUST have an index on `botellon_id`. RLS MUST mirror the admin/repartidor policy style: admins full access, repartidores SELECT-only, service-role writes unaffected. No historical `movimientos` backfill exists (documented limitation).

#### Scenario: RLS mirrors admin/repartidor roles

- GIVEN `movimientos` rows exist
- WHEN an admin writes and a repartidor reads
- THEN the admin has full access and the repartidor is SELECT-only

#### Scenario: No synthesized history

- GIVEN estado changes made before this migration
- WHEN 0011/0012 are applied
- THEN no `movimientos` rows are synthesized for past changes

### Requirement: REQ-COS-3 — Trigger contract (stamp + audit on estado change)

`BEFORE UPDATE` trigger `trg_estado_desde` MUST fire only when `NEW.estado IS DISTINCT FROM OLD.estado`; MUST set `NEW.estado_desde := now()`; MUST insert `movimientos(botellon_id, estado_previo, estado_nuevo, usuario_id = auth.uid())`. `usuario_id` MUST be NULL when no session uid exists (service-role writes). The trigger MUST NOT insert when the estado is unchanged. The trigger function MUST be SECURITY DEFINER with pinned `search_path` and MUST be idempotent (`CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS`).

#### Scenario: Estado change stamps and audits

- GIVEN a botellon in `recibido`
- WHEN any writer (form, kanban action, batch RPC) sets estado `recarga`
- THEN `estado_desde` is stamped `now()` and one `movimientos` row records `recibido → recarga`

#### Scenario: No-op update inserts nothing

- GIVEN a botellon
- WHEN an UPDATE sets the estado to its current value
- THEN `estado_desde` is untouched and zero `movimientos` rows are inserted

#### Scenario: Service-role write has null user

- GIVEN an UPDATE without a session uid
- WHEN the estado changes
- THEN the appended `movimientos.usuario_id` is NULL

### Requirement: REQ-COS-4 — mover_botellones batch RPC

RPC `mover_botellones(p_ids uuid[], p_estado text)` MUST be SECURITY DEFINER and MUST run in a single transaction (all-or-nothing). It MUST reject unauthenticated callers and non-admin/repartidor roles via `auth.jwt() -> 'app_metadata' ->> 'role'` (definer bypasses RLS). It MUST update only rows matching `id = ANY(p_ids) AND p_estado = ANY(permitidos(estado))` — validation inside the UPDATE WHERE, TOCTOU-free — then MUST compare the affected row count against `cardinality(DISTINCT p_ids)`; on mismatch it MUST raise an exception and roll back (zero writes). Identity moves MUST be permitted. The RPC MUST NOT touch `cliente_id`, and `entregado` via RPC MUST NOT require a client (machine-only validation).

#### Scenario: Valid batch moves in one transaction

- GIVEN 3 botellones in `recarga`
- WHEN `mover_botellones(ids, 'listo')` runs
- THEN one UPDATE moves all 3 and the trigger appends one `movimientos` row per bottle

#### Scenario: Partial-invalid batch rolls back entirely

- GIVEN a batch of 3 ids where one row is not in a permitted estado
- WHEN the RPC runs
- THEN an exception is raised and NOTHING is written — zero rows updated

#### Scenario: Rejected jump mirrors the manual rule

- GIVEN a botellon in `recibido`
- WHEN `mover_botellones(ids, 'listo')` runs
- THEN the exception rejects the jump with zero writes (mirrors botellon-ciclo-estados S5)

#### Scenario: Unauthenticated or wrong role rejected

- GIVEN no session, or a session whose role is neither admin nor repartidor
- WHEN the RPC is called
- THEN it is rejected before any UPDATE executes

#### Scenario: Identity move permitted without audit row

- GIVEN a botellon in `listo`
- WHEN `mover_botellones(ids, 'listo')` runs
- THEN the update succeeds and no `movimientos` row is inserted (estado unchanged)

### Requirement: REQ-COS-5 — SQL machine mirror

A SQL helper MUST mirror `getEstadosPermitidos(estado)` for all five estados — dedup union of forward transitions, reversions, and the identity estado, returned as `text[]`. Its output MUST equal the TS `getEstadosPermitidos` output for every estado; drift is guarded by the verify diff, and CASE comments MUST cite the `estados.ts` lines they mirror.

#### Scenario: Mirror equals the TS machine

- GIVEN all five estados
- WHEN the SQL helper output is compared with `getEstadosPermitidos(estado)`
- THEN the permitted sets are identical

#### Scenario: Reversion and identity included

- GIVEN estado `recibido`
- WHEN the SQL helper runs
- THEN it includes reversion `entregado` and identity `recibido`

### Requirement: REQ-COS-6 — GrupoCliente grouping util

Pure `agrupar()` in `src/lib/utils/grupos.ts` MUST group rows by `cliente_id` into `GrupoCliente`; a NULL `cliente_id` MUST be a valid (stock) group key. Group age MUST be `min(estado_desde)` of the members; groups MUST sort oldest-first by group age; member codes MUST sort oldest-first by `estado_desde` with `codigo` as tiebreak. The function MUST be total (no row dropped) and UI-agnostic. Vitest MUST cover grouping, ordering, tiebreak, and the null key.

#### Scenario: Groups sort oldest-first

- GIVEN two groups whose oldest members entered yesterday and today
- WHEN `agrupar()` runs
- THEN the yesterday group sorts first

#### Scenario: Group age is the min, codes oldest-first

- GIVEN a client's 3 bottles of different ages
- WHEN `agrupar()` runs
- THEN group age equals the oldest bottle's `estado_desde` and codes sort oldest-first inside the group

#### Scenario: Null key is a stock group

- GIVEN rows with `cliente_id IS NULL`
- WHEN `agrupar()` runs
- THEN they form one stock group and are never dropped

#### Scenario: Tiebreak by codigo

- GIVEN two codes with equal `estado_desde`
- WHEN ordered inside the group
- THEN `codigo` breaks the tie

### Requirement: REQ-COS-7 — DB type updates

`src/types/database.ts` MUST add `estado_desde` to the `botellones` Row/Insert/Update types, MUST add the `movimientos` table types, and MUST add the `mover_botellones` RPC signature — hand-updated per the existing generated-file convention. Existing writer tests MUST remain untouched and passing.

#### Scenario: Types reflect the new schema

- GIVEN the updated `database.ts`
- WHEN the TypeScript project compiles
- THEN `estado_desde`, `movimientos`, and the RPC signature type-check

#### Scenario: Existing writers unaffected

- GIVEN the existing test suite
- WHEN it runs
- THEN `moverBotellon`/`updateBotellon` tests pass unchanged