# botellon-ciclo-estados Specification

## Purpose

The canonical botellon lifecycle is a pure 5-estado rotation cycle — `entregado → recibido → recarga → listo → entregado`, plus `listo → delivery → entregado`. Defined in `src/lib/utils/estados.ts` (pure TS), mirrored by server guards, UI, and the DB check constraint. No `planta` or exception estados (`danado`, `perdido`, `mantenimiento`); clientless botellones in `recibido`/`listo` are stock.

## Requirements

### Requirement: Five-estado cycle machine

The machine MUST define exactly five estados — `entregado`, `recibido`, `recarga`, `listo`, `delivery` — and TRANSICIONES MUST equal exactly:

| Current | Valid next |
|---|---|
| entregado | recibido |
| recibido | recarga |
| recarga | listo |
| listo | entregado, delivery |
| delivery | entregado |

No other transition MAY be valid.

#### Scenario: Cycle advances one edge per transition

- GIVEN a botellon in any estado
- WHEN it advances
- THEN the next estado is one of its valid next estados above, never skipping one

#### Scenario: Entregado to recarga is not a valid edge

- GIVEN estado `entregado`
- WHEN `esTransicionValida('entregado', 'recargar')` runs
- THEN it is false — the cycle MUST NOT skip `recibido`

### Requirement: No exception estados or planta anywhere

`planta`, `danado`, `perdido`, `mantenimiento` MUST NOT appear in `ESTADOS`, `TRANSICIONES`, `ESTADOS_KANBAN`, `ESTADO_LABELS`, `ESTADO_COLORS`, or the deleted `ESTADOS_EXCEPCION`, nor in UI, alerts, notifications, analytics KPIs, or docs.

#### Scenario: UI surfaces no removed estado

- GIVEN dashboards, kanban, forms, and charts render
- WHEN inspected
- THEN no `planta`/`danado`/`perdido`/`mantenimiento` column, label, color, or badge exists

#### Scenario: No dañados/perdidos alert feature

- GIVEN alert panel, notification icon, notifications list render
- WHEN inspected
- THEN no `botellonesDanados` KPI, alert category, or `botellon_danado` notification type exists

### Requirement: Terminal operations map one cycle edge each

`OPERACIONES` MUST map each terminal op to one edge: `recibir` (`entregado → recibido`, no client), `recargar` (`recibido → recarga`, requires client, creates REC), `listo` (`recarga → listo`, no client). `recargar` MUST reject `entregado`.

#### Scenario: Recargar rejects entregado — two-scan flow

- GIVEN estado `entregado`, op `recargar`
- WHEN validated
- THEN rejected — staff scan Recibir, then Recargar

#### Scenario: Operation guard mirrors the machine

- GIVEN `esTransicionValida` and the server `.in('estado', sources)` guard
- WHEN evaluated on any estado/operation pair
- THEN both accept exactly the `OPERACIONES.sources` pairs

### Requirement: Stock and assign/unassign semantics

Stock/inventario MUST NOT be a new estado — clientless botellones in `recibido`/`listo` are stock. `moverBotellon`/`updateBotellon` MUST NOT route any botellon to `planta`: unassign clears `cliente_id` and keeps the current estado; assigning a client to a clientless botellon sets `estado = 'entregado'`.

#### Scenario: Clientless botellon counts as stock

- GIVEN `cliente_id IS NULL` in `recibido` or `listo`
- WHEN inventory is computed
- THEN it counts as stock in its current estado

#### Scenario: Assigning a client sells the stock

- GIVEN a clientless botellon in `recibido`/`listo`
- WHEN a client is assigned
- THEN the botellon transitions to `entregado`

#### Scenario: Unassign leaves estado unchanged

- GIVEN estado `entregado` with a client
- WHEN the client is unassigned
- THEN `cliente_id` is cleared and estado remains `entregado`

#### Scenario: No planta auto-assign on create

- GIVEN a botellon created with no estado
- THEN the default estado is `recibido` and no `planta` branch exists

### Requirement: DB constraint enforces the five estados

`botellones_estado_check` MUST allow exactly `entregado, recibido, recarga, listo, delivery`; migration 0009 MUST remap `planta` → `recibido` (BOT-00048) and defensively `danado`/`perdido`/`mantenimiento` → `recibido` BEFORE the constraint swap.

#### Scenario: BOT-00048 remapped to recibido

- GIVEN BOT-00048 in estado `planta`
- WHEN migration 0009 runs
- THEN its estado is `recibido`

#### Scenario: Constraint rejects a sixth estado

- GIVEN migration 0009 applied
- WHEN a row sets estado `planta`
- THEN the check constraint rejects it