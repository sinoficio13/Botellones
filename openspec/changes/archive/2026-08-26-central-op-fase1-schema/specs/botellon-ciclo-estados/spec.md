# Delta for botellon-ciclo-estados

> Part of change `central-op-fase1-schema` — every estado write path now stamps `estado_desde` and appends a `movimientos` row (trigger side-effect contract), and the manual-move rule gains a SQL-side mirror that the batch mover `mover_botellones` validates against. Canonical machine and forward `TRANSICIONES`: `openspec/specs/botellon-ciclo-estados/spec.md`.

## MODIFIED Requirements

### Requirement: Reversion set and getEstadosPermitidos (single manual-move rule)

`REVERSIONES` MUST equal exactly: `entregado: ['listo','delivery']`, `recibido: ['entregado']`, `recarga: ['recibido']`, `listo: ['recarga']`, `delivery: ['listo']`. `getEstadosPermitidos(estado)` MUST return the dedup union of `getTransiciones(estado)` and `getReversiones(estado)`, MUST always include the identity estado, and no estado MAY be terminal (every estado has at least one reversion). The permitted-set rule MUST be mirrored in SQL: a SQL helper MUST return the same dedup union (transitions + reversions + identity) for all five estados, and the batch mover `mover_botellones` MUST validate its destino against exactly those sets.
(Previously: TS-only permitted-set rule; no SQL-side mirror and no batch mover.)

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

#### Scenario: S-M1 — SQL mirror equals the TS machine

- GIVEN all five estados
- WHEN the SQL helper output is compared with `getEstadosPermitidos(estado)`
- THEN the permitted sets are identical

#### Scenario: S-M2 — Batch mover validates against the mirror

- GIVEN the batch RPC `mover_botellones`
- WHEN a destino outside the mirrored permitted set is submitted
- THEN the batch is rejected with zero writes

### Requirement: Server-side validation with CAS guard

`updateBotellon` and `moverBotellon` MUST read the current estado, MUST validate `nuevoEstado ∈ getEstadosPermitidos(current)` (or the sale exception), then MUST write with a compare-and-set guard `.eq('id', id).eq('estado', current)`. On validation failure the server MUST return `'Transición no permitida: <actual> → <destino>'` and MUST NOT write to the database. Every estado write path — manual `moverBotellon`/`updateBotellon`, kanban action, and the batch RPC — MUST stamp `estado_desde = now()` and append a `movimientos` row whenever the estado actually changes; a no-op write MUST append nothing.
(Previously: writes had no timestamping or audit side-effect.)

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

#### Scenario: S-A1 — Successful write stamps and audits

- GIVEN `moverBotellon(id, 'recarga')` on a botellon in `recibido`
- WHEN the write succeeds
- THEN `estado_desde` is stamped `now()` and a `movimientos` row records `recibido → recarga` with the current user

#### Scenario: S-A2 — No-op write appends nothing

- GIVEN a write that keeps the current estado
- WHEN it executes
- THEN no `movimientos` row is inserted and `estado_desde` is untouched

#### Scenario: S-A3 — Batch RPC is audited per bottle

- GIVEN a successful `mover_botellones` batch
- WHEN it commits
- THEN every changed row has its own `movimientos` row (one per bottle)