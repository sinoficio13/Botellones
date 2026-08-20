# scanner-mode-toggle Specification

## Purpose

The `scanner-modal.tsx` hosts a session mode toggle (`Recarga` | `Carga`). In `Carga` mode the modal hands off to the batch page by closing itself and `router.push('/recargas/carga')`; in `Recarga` (individual) mode the existing single-flow behavior is unchanged. The toggle is a small state surface that MUST NOT alter the decode/lockout/StrictMode behavior already extracted into `useQrScanner`.

## Requirements

### Requirement: Mode toggle in scanner modal

The scanner modal MUST render a `Recarga` | `Carga` toggle. The modal SHALL be opened in `Recarga` mode by default.

#### Scenario: Default mode is Recarga

- GIVEN the modal opens from the scanner island or mobile-nav FAB
- WHEN the modal renders
- THEN the toggle shows `Recarga` as the active mode

#### Scenario: Toggle switches mode

- GIVEN the modal is open
- WHEN the user selects `Carga`
- THEN the toggle reflects the selected mode

### Requirement: Carga mode handoff

In `Carga` mode, the modal MUST close itself and `router.push('/recargas/carga')` when the user initiates the scan action (or confirms the mode), handing off to the batch page.

#### Scenario: Carga hands off to batch page

- GIVEN the modal is in `Carga` mode
- WHEN the user initiates the Carga action
- THEN the modal calls `onClose` and `router.push('/recargas/carga')`

#### Scenario: No decode processing in Carga handoff

- GIVEN the modal is in `Carga` mode and hands off
- WHEN the handoff happens
- THEN no single-flow redirect to `/recargas/nueva` occurs for that action

### Requirement: Individual mode unchanged

In `Recarga` mode the modal MUST behave exactly as before: decode via `useQrScanner`, and on a valid botellón with a client, stop the stream, close, and `router.push('/recargas/nueva?botellon_id=...')`.

#### Scenario: Recarga mode preserves single flow

- GIVEN the modal is in `Recarga` mode
- WHEN a valid botellón with a client is decoded
- THEN the modal stops the stream, closes, and pushes `/recargas/nueva?botellon_id=...`

#### Scenario: Recarga mode preserves no-client overlay

- GIVEN the modal is in `Recarga` mode and a botellón has no client
- WHEN the code is decoded
- THEN the `no-client` overlay renders and scanning continues

### Requirement: Toggle does not affect decode lifecycle

The mode toggle MUST NOT change camera acquisition, lockout, or StrictMode-safe cleanup; it only selects the destination flow.

#### Scenario: Cleanup unchanged across modes

- GIVEN the modal is in either mode
- WHEN the modal unmounts or closes
- THEN the stream is stopped and the rAF loop is cancelled exactly as in the current modal

## Testability

The toggle behavior MUST be covered by the existing `scanner-modal.test.tsx` suite (which MUST remain green, 17 tests), extended with mode-toggle and handoff scenarios. `scanner-island.test.tsx` (3) and `mobile-nav.test.tsx` (7) MUST remain green.
