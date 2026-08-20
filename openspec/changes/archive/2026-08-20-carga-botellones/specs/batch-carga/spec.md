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

## Testability

The page MUST be covered by component tests (`tests/component/carga-page.test.tsx`) with a mocked `useQrScanner`, a mocked `registrarCarga` action, and mocked db lookups. An optional Playwright suite (`tests/e2e/carga.spec.ts`) may use a chromium camera stub.
