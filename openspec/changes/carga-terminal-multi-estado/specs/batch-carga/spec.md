# Delta for batch-carga

Delta transforming `batch-carga` into the backend of the multi-state terminal: `registrarCarga` generalizes to `registrarOperacion`, the recarga transition becomes multi-source (`{entregado, recibido}`), the no-client gate becomes operation-scoped, and results/success rendering become operation-scoped (REC/premios only for recarga). Terminal UI behavior lives in the new `carga-terminal` spec.

## MODIFIED Requirements

### Requirement: Batch confirm via registrarOperacion

On confirm, the page MUST call `registrarOperacion({ botellonIds, operacion, fecha, hora })` via `useActionState` and render the resulting state, where `operacion` is the selected operation.
(Previously: `Batch confirm via registrarCarga` — the page called `registrarCarga({ botellonIds, fecha, hora })` for a fixed recarga operation.)

#### Scenario: Confirm submits accumulated ids with the selected operation

- GIVEN items are accumulated with valid fecha/hora and operation `recargar`
- WHEN the user confirms
- THEN `registrarOperacion` is called with the accumulated `botellonIds`, `operacion: 'recargar'`, the shared fecha, and hora
- AND the returned state is rendered

#### Scenario: Server validation error surfaced

- GIVEN `registrarOperacion` returns `success: false` with `error`
- WHEN the state renders
- THEN the `error` message is shown and the session remains editable

### Requirement: Operation-scoped no-client gate

Only the `recarga` operation MUST require `cliente_id` (the `recargas` insert needs it). When a decoded botellón has no client and the selected operation is `recargar`, the page MUST present the `no-client` state with a route to `/botellones/[id]`. In `recibir`/`listo`, clientless botellones MUST be accumulated normally.
(Previously: `No-client overlay routing` — any decoded botellón without a client triggered the overlay regardless of operation.)

#### Scenario: No-client decode blocks recargar only

- GIVEN a decoded botellón has no `cliente_id` and operation `recargar`
- WHEN the page handles it
- THEN the `no-client` state is shown with an action linking to `/botellones/[id]`

#### Scenario: Clientless accepted in pure operations

- GIVEN a decoded botellón has no `cliente_id` and operation `recibir` or `listo`
- WHEN the page handles it
- THEN the item is accumulated without the no-client overlay

### Requirement: Per-item result rendering per operation

After a confirm attempt, the page MUST render each item result: ok items show their REC# when the operation was `recarga`; ok items in `recibir`/`listo` show no REC#. Rejected items show their per-item reason (`sin-cliente`, `estado-<estado>`, or `error`).
(Previously: `Per-item result rendering` — every ok item showed a REC# because recarga was the only operation.)

#### Scenario: Mixed success and rejection

- GIVEN the batch contains both valid and rejected botellones
- WHEN `registrarOperacion` returns the results
- THEN ok items render their REC# (recarga op) and rejected items render their reason

#### Scenario: No-client item shows assign action

- GIVEN a rejected item has reason `sin-cliente` and operation `recargar`
- WHEN results render
- THEN the item shows an "Asignar cliente" action linking to `/botellones/[id]`

#### Scenario: Pure-operation ok item shows no REC

- GIVEN operation `recibir` with an ok item
- WHEN results render
- THEN the item renders as ok without a REC#

### Requirement: Success screen per operation

On `success: true`, the page MUST show a success screen with the count of ok items and the target estado. The REC# list, premios, and `loyaltyWarning` MUST render only when the operation was `recarga`.
(Previously: `Success screen with count, list, and premios` — REC list, premios, and loyaltyWarning rendered on every success.)

#### Scenario: Recarga success surfaces premios

- GIVEN `registrarOperacion` returns `success: true` with `premios` for operation `recargar`
- WHEN the success screen renders
- THEN the item count, REC# list, and premio levels are displayed

#### Scenario: Loyalty warning surfaced without failing

- GIVEN `registrarOperacion` returns `success: true` with `loyaltyWarning`
- WHEN the success screen renders
- THEN the warning is shown but the operation is treated as successful

#### Scenario: Pure-operation success shows no REC or premios

- GIVEN operation `recibir` returns `success: true`
- WHEN the success screen renders
- THEN the count and target estado are shown
- AND no REC# list or premios are rendered

#### Scenario: "Ver ficha" links to client

- GIVEN an ok item belongs to a client
- WHEN the item row renders
- THEN a "Ver ficha" link navigates to `/clientes/[id]`

### Requirement: Multi-source recarga transition

The state machine MUST accept `entregado → recarga` and `recibido → recarga` as legal transitions so a returned botellon advances to `recarga` in one pass. The recarga operation MUST accept source estados `{entregado, recibido}`. This change MUST NOT introduce a new botellon state, and the single-flow `/recargas/nueva` MUST remain unchanged. `registrarCarga` MAY remain as a thin backward-compatible wrapper delegating with `operacion: 'recargar'`.
(Previously: `Confirm transition remains entregado to recarga` — the confirm flow kept `entregado -> recarga` exactly as-is, single-source, with `registrarCarga` unchanged.)

#### Scenario: Entregado source transitions to recarga

- GIVEN items are accumulated with the client/status fields and operation `recargar`
- WHEN the user confirms with valid fecha/hora
- THEN `registrarOperacion` is called with `operacion: 'recargar'`
- AND each valid item transitions `entregado -> recarga`

#### Scenario: Recibido source transitions to recarga

- GIVEN an item in estado `recibido` and operation `recargar`
- WHEN the user confirms
- THEN the item transitions `recibido -> recarga` in one pass

#### Scenario: Single flow unaffected

- GIVEN the terminal exists
- WHEN `/recargas/nueva` is exercised
- THEN its existing single-botellon behavior is unchanged

### Requirement: Graceful fallback when client name is missing

The session list MUST degrade gracefully when `clienteNombre` is absent: it SHALL show the raw `cliente_id` or nothing in place of the name. The no-client overlay SHALL govern only `cliente_id === null` within the `recargar` operation; clientless items in `recibir`/`listo` accumulate normally.
(Previously: the no-client overlay governed the `cliente_id === null` case unconditionally.)

#### Scenario: Missing client name falls back to id or nothing

- GIVEN an accumulated item has no `clienteNombre` but does have a `cliente_id`
- WHEN the session list renders
- THEN the name area shows the raw `cliente_id` or nothing (no empty/crash)

#### Scenario: No-client overlay governs null client in recargar

- GIVEN a decoded botellon has `cliente_id === null` and operation `recargar`
- WHEN the page handles it
- THEN the `no-client` overlay is shown and the item is NOT accumulated

## ADDED Requirements

### Requirement: Generalized registrarOperacion server action

`registrarOperacion({ botellonIds, operacion, fecha, hora })` MUST generalize `registrarCarga`'s proven scaffolding: server-side `cliente_id` re-derivation, dedupe, per-item reasons, zero-write short-circuit, partial-failure results, best-effort compensating delete of inserted rows, and the `revalidatePath` set. It MUST derive each operation's valid source estados from the state machine and guard the estado update with `.in('estado', sources)`. Only the `recarga` branch MUST write `recargas` rows (sequential REC numbers, array insert), run loyalty plus milestone compensation, and require `cliente_id`; `recibido`/`listo` MUST perform a pure `botellones.estado` update with no `recargas` write and no loyalty. `useQrScanner` MUST remain unchanged.

#### Scenario: Recarga branch preserves REC, loyalty, and compensation

- GIVEN a confirm with operation `recargar` and distinct clients
- WHEN the action runs
- THEN sequential REC numbers are inserted, loyalty runs once per distinct client, and milestone overshoot is compensated (existing scenarios migrate green)

#### Scenario: Pure operation performs estado update only

- GIVEN a confirm with operation `recibir` and valid `entregado` items
- WHEN the action runs
- THEN `botellones.estado` becomes `recibido`
- AND no `recargas` row is inserted and no loyalty runs

#### Scenario: Multi-source guard rejects raced items

- GIVEN an item validated green at scan time but moved by another operator before confirm
- WHEN the action runs the guarded update
- THEN the item is rejected with reason `estado-<estado>` and the batch remains successful for the rest

#### Scenario: Clientless gated only in recarga

- GIVEN a clientless botellon
- WHEN confirmed with `recargar`
- THEN it is rejected with reason `sin-cliente`
- AND the same item is accepted under `recibir`/`listo`

#### Scenario: Partial failure compensated

- GIVEN the estado update fails after REC rows were inserted
- WHEN the action runs
- THEN the inserted `recargas` rows are best-effort deleted and the batch reports the failure

## Testability

Unit tests (`tests/unit/carga-registrar.test.ts`) MUST migrate from `registrarCarga` to `registrarOperacion` and cover per-operation scenarios: recarga branch (REC + loyalty + compensation), pure-op estado-only update, multi-source guard, op-scoped no-client gate, and compensating delete. Component tests (`tests/component/carga-page.test.tsx`) MUST cover the operation selector, badges, duplicate beep/ring, op-scoped no-client, and generalized results/success screens per the `carga-terminal` spec.
