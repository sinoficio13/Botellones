# batch-carga Specification

## Purpose

The `/recargas/carga` dashboard page (`src/app/(dashboard)/recargas/carga/page.tsx`) provides a batch QR session: scan botellón QRs, accumulate them into a session list, confirm ONE uniform recarga for the whole lot via the committed `registrarCarga` server action, and render per-item results plus premios. The page is `'use client'`, consumes `useQrScanner` and the `CargaState` / `CargaItemResult` / `registrarCarga` contracts from `src/lib/db/cargas.ts`, and uses `useActionState`.

## Requirements

### Requirement: Session accumulation with in-session dedupe

The page MUST accumulate decoded botellones into a session `items[]` list and MUST ignore a code already present in the list (in-session dedupe) so a repeated scan cannot double-count in the confirm payload. Accumulation SHALL be handler-driven (in `onDecode`), NOT via `setState` inside `useEffect`, per `react-patterns`.

#### Scenario: First scan adds a botellón

- GIVEN the session is empty
- WHEN a valid botellón code is decoded
- THEN the botellón (codigo, id, cliente id) is appended to `items[]`

#### Scenario: Duplicate scan is ignored

- GIVEN a botellón code is already in `items[]`
- WHEN the same code is decoded again
- THEN no duplicate entry is added and the count is unchanged

#### Scenario: Accumulation is handler-driven

- GIVEN the page renders
- WHEN a decode occurs
- THEN `items[]` is updated directly in the decode handler
- AND no `useEffect` body calls the accumulator setter

### Requirement: Uniform fecha and hora input

The page MUST expose a single shared fecha and hora input that applies to the entire batch, and MUST require both before confirm can submit.

#### Scenario: Shared date/time for the batch

- GIVEN items are accumulated
- WHEN the user sets a fecha and hora
- THEN the single fecha/hora is used for every item in the batch on confirm

#### Scenario: Missing date/time blocks confirm

- GIVEN items are accumulated but fecha or hora is empty
- WHEN the user attempts to confirm
- THEN confirm is disabled or prevented and an error is shown

### Requirement: Confirm disabled when session empty

The single Confirm action MUST be disabled when `items[]` is empty.

#### Scenario: Empty session disables confirm

- GIVEN no botellones have been scanned
- WHEN the page renders
- THEN the Confirm button is disabled and cannot be submitted

### Requirement: Batch confirm via registrarCarga

On confirm, the page MUST call `registrarCarga({ botellonIds, fecha, hora })` via `useActionState` and render the resulting `CargaState`.

#### Scenario: Confirm submits accumulated ids

- GIVEN items are accumulated with valid fecha/hora
- WHEN the user confirms
- THEN `registrarCarga` is called with the accumulated `botellonIds`, the shared fecha, and hora
- AND the returned `CargaState` is rendered

#### Scenario: Server validation error surfaced

- GIVEN `registrarCarga` returns `success: false` with `error`
- WHEN the state renders
- THEN the `error` message is shown and the session remains editable

### Requirement: Per-item result rendering

After a confirm attempt, the page MUST render each `CargaItemResult`: ok items show their REC#; rejected items show their per-item reason (`sin-cliente`, `estado-<estado>`, or `error`).

#### Scenario: Mixed success and rejection

- GIVEN the batch contains both valid and rejected botellones
- WHEN `registrarCarga` returns the results
- THEN ok items render their REC# and rejected items render their reason

#### Scenario: No-client item shows assign action

- GIVEN a rejected item has reason `sin-cliente`
- WHEN results render
- THEN the item shows an "Asignar cliente" action linking to `/botellones/[id]`

### Requirement: Success screen with count, list, and premios

On `success: true`, the page MUST show a success screen with the count of ok items, the list of REC#s, and any returned premios plus `loyaltyWarning`.

#### Scenario: Success screen surfaces premios

- GIVEN `registrarCarga` returns `success: true` with `premios`
- WHEN the success screen renders
- THEN the item count, REC# list, and premio levels are displayed

#### Scenario: Loyalty warning surfaced without failing

- GIVEN `registrarCarga` returns `success: true` with `loyaltyWarning`
- WHEN the success screen renders
- THEN the warning is shown but the batch is treated as successful

#### Scenario: "Ver ficha" links to client

- GIVEN an ok item belongs to a client
- WHEN the item row renders
- THEN a "Ver ficha" link navigates to `/clientes/[id]`

### Requirement: No-client overlay routing

When a decoded botellón has no client, the page MUST present the `no-client` state with a route to `/botellones/[id]` so the staff member can assign a client.

#### Scenario: No-client decode routes to botellón

- GIVEN a decoded botellón has no `cliente_id`
- WHEN the page handles it
- THEN the `no-client` state is shown with an action linking to `/botellones/[id]`

### Requirement: Unchanged single flow

The existing `/recargas/nueva` single-botellón wizard MUST remain untouched by this capability.

#### Scenario: Single flow unaffected

- GIVEN the batch page exists
- WHEN `/recargas/nueva` is exercised
- THEN its existing behavior is unchanged

### Requirement: Scan-time client name and botellon status on each session item

When a botellon is decoded and accumulated, the page MUST store, on the corresponding `SessionItem`, the botellon's `clienteNombre` and its current `estado`. `getBotellonByCodigo` SHALL remain **public-safe**: it MUST return only `id, codigo, estado, cliente_id` and MUST NOT include any `clientes(nombre)` join or client PII, because it is consumed by the anonymous `/b/[codigo]` QR page whose force-dynamic RSC payload is reachable by any browser (codes are sequentially enumerable). The authenticated `/recargas/carga` page SHALL resolve the owner's display name via a separate `getCliente(cliente_id)` call inside `onDecode`, and SHALL populate `clienteNombre` and `estado` when building the item.

#### Scenario: Valid scan carries client name and status

- GIVEN a decoded botellon has `cliente_id` and `estado`, and `getBotellonByCodigo` returns no client PII
- WHEN the item is accumulated in `onDecode` and the page calls `getCliente(cliente_id)`
- THEN the `SessionItem` stores the resolved `clienteNombre` and `estado`

#### Scenario: Client name lookup returns null

- GIVEN a decoded botellon has `cliente_id` but `getCliente(cliente_id)` returns `null` (no client row)
- WHEN the item is accumulated
- THEN `clienteNombre` is stored as empty/undefined without failing the scan

### Requirement: Session list renders client name and status badge

The session list MUST render, for each scanned botellon, the client display name and a status badge using the existing `ESTADO_LABELS`/`ESTADO_COLORS` convention, in addition to the codigo.

#### Scenario: Item with client and status renders both

- GIVEN an accumulated item has a `clienteNombre` and an `estado`
- WHEN the session list renders
- THEN the client name is shown and a status badge with the matching label/color for `estado` is shown

#### Scenario: Unknown estado falls back gracefully

- GIVEN an accumulated item has an `estado` with no matching label/color
- WHEN the status badge renders
- THEN it shows the raw estado value without erroring

### Requirement: Graceful fallback when client name is missing

The session list MUST degrade gracefully when `clienteNombre` is absent: it SHALL show the raw `cliente_id` or nothing in place of the name. The existing `no-client` overlay SHALL continue to govern only the `cliente_id === null` case, which is unchanged.

#### Scenario: Missing client name falls back to id or nothing

- GIVEN an accumulated item has no `clienteNombre` but does have a `cliente_id`
- WHEN the session list renders
- THEN the name area shows the raw `cliente_id` or nothing (no empty/crash)

#### Scenario: No-client overlay still governs null client

- GIVEN a decoded botellon has `cliente_id === null`
- WHEN the page handles it
- THEN the `no-client` overlay is shown and the item is NOT accumulated, unchanged from before

### Requirement: Handler-driven enrichment (no setState in effect)

Client-name/status enrichment of `SessionItem` SHALL occur inside the `onDecode` handler; no `useEffect` body SHALL call the accumulator setter or otherwise enrich items after render.

#### Scenario: Accumulation remains in the decode handler

- GIVEN the page renders
- WHEN a decode occurs
- THEN `clienteNombre` and `estado` are populated within `onDecode`
- AND no `useEffect` body updates the session

### Requirement: Confirm transition is recibido to recarga

The confirm flow MUST keep the botellon state transition `recibido -> recarga`: the batch recarga operation SHALL accept only botellones in estado `recibido` (sources `{recibido}`). An `entregado` botellon MUST NOT be accepted in a recarga batch — it must be received first via Recibir (the one-pass `entregado -> recarga` shortcut is removed). This change MUST NOT introduce a new botellon state, and `registrarCarga` / the single-flow `/recargas/nueva` MUST remain unchanged.

#### Scenario: Batch recarga accepts a recibido botellon

- GIVEN items are accumulated and at least one item is in estado `recibido`
- WHEN the user confirms with valid fecha/hora
- THEN `registrarCarga` is called with the same `botellonIds`, fecha, and hora
- AND the item transitions `recibido -> recarga`

#### Scenario: Entregado item is rejected as invalid source

- GIVEN an accumulated item is in estado `entregado`
- WHEN the user confirms the batch
- THEN that item is rejected with reason `estado-entregado` and must be scanned through Recibir before it can be recargado

#### Scenario: Display-field flow unchanged by the new source

- GIVEN items are accumulated with the new client/status fields
- WHEN the user confirms with valid fecha/hora
- THEN `registrarCarga` is called with the same `botellonIds`, fecha, and hora
- AND the `recibido -> recarga` transition and `CargaItemResult` contract are unchanged

## Testability

The page MUST be covered by component tests (`tests/component/carga-page.test.tsx`) with a mocked `useQrScanner`, a mocked `registrarCarga` action, and mocked db lookups. For the scan-time client/status display, `getBotellonByCodigo` is mocked to return `estado`/`cliente_id` (no client PII) and `getCliente` is mocked to return the client name. Unit tests (`tests/unit/botellon-by-codigo.test.ts`) MUST assert that `getBotellonByCodigo` does NOT expose `clienteNombre` and that its select never contains `clientes`. An optional Playwright suite (`tests/e2e/carga.spec.ts`) may use a chromium camera stub.
