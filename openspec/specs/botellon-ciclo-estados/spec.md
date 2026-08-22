# botellon-ciclo-estados Specification

## Purpose

The canonical botellon lifecycle is a pure 5-estado rotation cycle — `entregado → recibido → recarga → listo → entregado`, plus `listo → delivery → entregado`. Defined in `src/lib/utils/estados.ts` (pure TS), mirrored by server guards, UI, and the DB check constraint. No `planta` or exception estados (`danado`, `perdido`, `mantenimiento`); clientless botellones in `recibido`/`listo` are stock. Every estado has reversions (immediate-previous inverse) so no estado is terminal; the server validates manual moves against the permitted set with a compare-and-set guard.

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

Stock/inventario MUST NOT be a new estado — clientless botellones in `recibido`/`listo` are stock. `moverBotellon`/`updateBotellon` MUST NOT route any botellon to `planta`: unassign clears `cliente_id` and keeps the current estado. Assigning a client to a clientless botellon is a machine-exempt sale that MUST accept destino `entregado` OR `recarga`; when no valid destino is submitted it MUST default to `entregado`.
(Previously: assigning a client unconditionally forced `estado = 'entregado'`)

#### Scenario: Clientless botellon counts as stock

- GIVEN `cliente_id IS NULL` in `recibido` or `listo`
- WHEN inventory is computed
- THEN it counts as stock in its current estado

#### Scenario: S9 — Sell stock direct to entregado

- GIVEN a clientless botellon in `listo`
- WHEN a client is assigned with destino `entregado`
- THEN the botellon transitions to `entregado` with `cliente_id` set

#### Scenario: S10 — Sell stock direct to recarga

- GIVEN a clientless botellon in `listo`
- WHEN a client is assigned with destino `recarga`
- THEN the botellon transitions to `recarga` (machine-exempt)

#### Scenario: S11 — Non-sale moves still validate strictly

- GIVEN a clientless botellon in `listo` and NO client assignment
- WHEN a manual move to `recibido` is submitted
- THEN the server rejects it with "Transición no permitida: listo → recibido"

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

### Requirement: Reversion set and getEstadosPermitidos (single manual-move rule)

`REVERSIONES` MUST equal exactly: `entregado: ['listo','delivery']`, `recibido: ['entregado']`, `recarga: ['recibido']`, `listo: ['recarga']`, `delivery: ['listo']`. `getEstadosPermitidos(estado)` MUST return the dedup union of `getTransiciones(estado)` and `getReversiones(estado)`, MUST always include the identity estado, and no estado MAY be terminal (every estado has at least one reversion).

#### Scenario: S1 — Undo an error via Deshacer

- GIVEN a botellon mis-advanced to `recibido` (previous estado `entregado`)
- WHEN the operator opens the selector
- THEN `getEstadosPermitidos('recibido')` includes `entregado` under "Deshacer"
- AND selecting it reverts the move in one step

#### Scenario: S2 — Entregado reversal set matches the user pick

- GIVEN estado `entregado`
- WHEN `getReversiones('entregado')` runs
- THEN it returns exactly `['listo', 'delivery']`

#### Scenario: S3 — Permitted union is deduped and identity-permitted

- GIVEN estado `entregado`
- WHEN `getEstadosPermitidos('entregado')` runs
- THEN it returns the forward `['recibido']`, reversions `['listo','delivery']`, and the identity `entregado` itself, with no duplicates

#### Scenario: S4 — Inversion invariant guards map drift

- GIVEN any estados a, b in ESTADOS
- WHEN both maps are evaluated
- THEN `b ∈ getTransiciones(a)` iff `a ∈ getReversiones(b)`

### Requirement: Server-side validation with CAS guard

`updateBotellon` and `moverBotellon` MUST read the current estado, MUST validate `nuevoEstado ∈ getEstadosPermitidos(current)` (or the sale exception), then MUST write with a compare-and-set guard `.eq('id', id).eq('estado', current)`. On validation failure the server MUST return `'Transición no permitida: <actual> → <destino>'` and MUST NOT write to the database.

#### Scenario: S5 — Invalid manual move rejected with zero writes

- GIVEN a botellon in `recibido`
- WHEN `moverBotellon(id, 'listo')` is called
- THEN the server returns "Transición no permitida: recibido → listo"
- AND no UPDATE statement reaches the database

#### Scenario: S6 — Forward move and reversal both accepted

- GIVEN a botellon in `recibido`
- WHEN it moves forward to `recarga` and later reverses to `recibido`
- THEN both writes succeed

#### Scenario: S7 — Concurrent moves: CAS loser aborts

- GIVEN two operators read the same botellon in `recibido`
- WHEN operator A writes `recarga` first and operator B writes `listo` second
- THEN A succeeds and B's conditional `.eq('estado', 'recibido')` guard matches zero rows
- AND B receives "Transición no permitida: recibido → listo"

#### Scenario: S8 — Identity move permitted

- GIVEN a botellon in `listo`
- WHEN `nuevoEstado == 'listo'` is submitted
- THEN validation passes (identity is always permitted) and the write succeeds