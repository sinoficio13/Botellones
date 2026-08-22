# Delta for botellon-ciclo-estados

> Part of change `estados-reversion-realtime` — reversions, `getEstadosPermitidos` as the single manual-move rule, server-side validation with CAS, sale exception. Canonical machine: see `openspec/specs/botellon-ciclo-estados/spec.md`. The forward `TRANSICIONES` map and `OPERACIONES` contract are unchanged.

## ADDED Requirements

### Requirement: R1 — Reversion set and getEstadosPermitidos (single manual-move rule) [New]

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

### Requirement: R2 — Server-side validation with CAS guard [New]

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

## MODIFIED Requirements

### Requirement: Stock and assign/unassign semantics [Changed]

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