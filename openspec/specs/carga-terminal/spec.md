# carga-terminal Specification

## Purpose

The `/recargas/carga` dashboard page (`src/app/(dashboard)/recargas/carga/page.tsx`) operates as a multi-state scanning terminal for the botellon rotation lifecycle. In one scanning session staff select an operation — Recibir, Recargar (default), or Listo — scan botellon QRs, and advance each botellon's estado by the selected operation, with per-item transition feedback (green/red badges) and duplicate-scan feedback (beep + ring). Client-side badges derive from the same state machine (`src/lib/utils/estados.ts`) that the `registrarOperacion` server action validates against; `useQrScanner` remains unchanged.

## Requirements

### Requirement: Operation selector with Recargar default

The terminal MUST expose three operations — Recibir (`→recibido`, sources `{entregado}`), Recargar (`→recarga`, sources `{entregado, recibido}`), and Listo (`→listo`, sources `{recarga}`) — and MUST default the selection to Recargar. The selected operation MUST drive the confirm payload (`operacion`), the confirm button label, and the success screen content.

#### Scenario: Default operation is Recargar

- GIVEN the terminal renders and a botellon is scanned
- WHEN the user confirms
- THEN the payload uses `operacion: 'recargar'` without any explicit selection

#### Scenario: Switching operation updates the confirm payload

- GIVEN the user selects `recibir`
- WHEN the user confirms
- THEN the payload is `registrarOperacion({ botellonIds, operacion: 'recibir', fecha, hora })`

### Requirement: Per-item transition badges from the state machine

Each session item MUST render a transition badge derived live from `getTransiciones(item.estado)` and the selected operation: a green badge showing the target estado when the item's estado is a valid source for the operation, and a red badge when it is not. Invalid transitions MUST be marked red, never silently accepted. Badges MUST re-validate when the operation switches mid-session.

#### Scenario: Valid source shows green target badge

- GIVEN an item in estado `entregado` and operation `recargar`
- WHEN the session list renders
- THEN the item shows a green badge for the target `recarga`

#### Scenario: Invalid source shows red badge

- GIVEN an item in estado `recarga` and operation `recibir`
- WHEN the session list renders
- THEN the item shows a red badge and cannot confirm validly for `recibir`

#### Scenario: Operation switch re-validates badges live

- GIVEN an item in estado `entregado` with a green badge under `recargar`
- WHEN the user switches the operation to `recibir`
- THEN the badge re-derives and shows green for `recibido` without re-scanning

### Requirement: Duplicate scan beep and transient ring

When a code already in the session is decoded again, the terminal MUST emit a Web Audio beep, apply a transient ring highlight to the existing row for ~600–800ms, MUST NOT add a duplicate entry, and MUST keep the scanner open. `useQrScanner` MUST remain unchanged; the duplicate path uses the hook's `failure` outcome.

#### Scenario: Duplicate scan beeps and rings

- GIVEN a botellon code is already in the session
- WHEN the same code is decoded again
- THEN a Web Audio beep plays and the existing row shows a transient ring highlight
- AND the session count and confirm payload are unchanged

#### Scenario: Scanner stays open after duplicate

- GIVEN a duplicate scan just occurred
- WHEN the decode loop continues
- THEN the scanner remains active and no duplicate entry is added

### Requirement: One-pass scan advance

A botellon MUST advance directly from its current estado to the selected operation's target on a single confirm — no intermediate estados. The lifecycle `entregado → recibido → recarga → listo` MUST be achievable across sequential single scans.

#### Scenario: Entregado to recarga in one pass

- GIVEN an item in estado `entregado` and operation `recargar`
- WHEN the user confirms
- THEN the botellon's estado becomes `recarga` without passing through any intermediate estado

#### Scenario: Recibido to recarga to listo in sequential scans

- GIVEN an item in estado `recibido`
- WHEN confirmed once with `recargar` and later with `listo`
- THEN the estado advances `recibido → recarga → listo`, one transition per confirm

### Requirement: Operation-scoped no-client handling

Clientless botellones (`cliente_id === null`) MUST be accepted and accumulated when the selected operation is `recibir` or `listo` (pure estado updates need no client). Only `recargar` MUST require `cliente_id`, presenting the no-client route to `/botellones/[id]`. The server gate in `registrarOperacion` remains the source of truth.

#### Scenario: Clientless accepted in Recibir

- GIVEN a decoded botellon has no `cliente_id` and operation `recibir` is selected
- WHEN the page handles the decode
- THEN the item is accumulated and the no-client overlay is not shown

#### Scenario: Clientless still blocked in Recargar

- GIVEN a decoded botellon has no `cliente_id` and operation `recargar` is selected
- WHEN the page handles the decode
- THEN the no-client state is shown with an action linking to `/botellones/[id]`

### Requirement: Partial failure keeps the session editable

After a confirm with mixed results, the terminal MUST render per-item outcomes — ok items succeed per operation (REC# only for `recargar`), invalid items show their reason — and MUST keep the session editable so staff can fix and retry.

#### Scenario: Mixed batch reports per-item outcomes

- GIVEN a session with a valid `entregado` item and an invalid `recarga` item, operation `recargar`
- WHEN the confirm returns mixed results
- THEN the valid item reports ok and the invalid item shows reason `estado-recarga`

#### Scenario: Session remains editable after partial failure

- GIVEN a confirm returned rejected items
- WHEN the results render
- THEN the session list remains editable and confirm can be re-submitted

## Testability

The terminal MUST be covered by component tests (`tests/component/carga-page.test.tsx`) with mocked `useQrScanner`, `registrarOperacion`, and db lookups: operation selector default and switch, green/red badge derivation and live re-validation, duplicate beep (mocked Web Audio util) plus transient ring, op-scoped no-client handling, and mixed-result rendering. Unit tests MUST cover the state-machine helpers (`OPERACIONES`, `esTransicionValida`) and the Web Audio beep util (`src/lib/scanner/beep.ts`) with a mocked AudioContext.
