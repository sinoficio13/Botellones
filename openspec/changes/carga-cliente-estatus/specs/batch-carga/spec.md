# Delta for batch-carga

Delta extending the existing `batch-carga` specification with scan-time client + botellon status display.

## ADDED Requirements

### Requirement: Scan-time client name and botellon status on each session item

When a botellon is decoded and accumulated, the page MUST store, on the corresponding `SessionItem`, the botellon's `clienteNombre` and its current `estado`. `getBotellonByCodigo` SHALL return `clienteNombre` via a `clientes(nombre)` join in a single lookup (no extra round-trip), alongside the already-returned `estado` and `cliente_id`. `onDecode` SHALL populate these fields from that single lookup result when building the item.

#### Scenario: Valid scan carries client name and status

- GIVEN a decoded botellon has `cliente_id`, a joined `clientes(nombre)`, and `estado`
- WHEN the item is accumulated in `onDecode`
- THEN the `SessionItem` stores the resolved `clienteNombre` and `estado`

#### Scenario: Client name join returns null

- GIVEN a decoded botellon has `cliente_id` but the `clientes` join returns `null`
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

### Requirement: Confirm transition remains entregado to recarga

The confirm flow MUST keep the botellon state transition `entregado -> recarga` exactly as-is. This change MUST NOT introduce a new botellon state, and `registrarCarga` / the single-flow `/recargas/nueva` MUST remain unchanged.

#### Scenario: Transition unchanged after adding display fields

- GIVEN items are accumulated with the new client/status fields
- WHEN the user confirms with valid fecha/hora
- THEN `registrarCarga` is called with the same `botellonIds`, fecha, and hora
- AND the `entregado -> recarga` transition and `CargaItemResult` contract are unchanged

## Testability

The page MUST be covered by component tests (`tests/component/carga-page.test.tsx`) asserting the new stored fields and rendered client name/status, with `getBotellonByCodigo` mocked to return `clienteNombre` and `estado`. Unit tests (`tests/unit/botellon-by-codigo.test.ts`) MUST assert the additive `clienteNombre` field and join shape.
