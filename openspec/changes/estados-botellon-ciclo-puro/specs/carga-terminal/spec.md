# Delta for carga-terminal

> Part of change `estados-botellon-ciclo-puro` — pure 5-estado cycle. Canonical machine: see `openspec/specs/botellon-ciclo-estados/spec.md`.

## MODIFIED Requirements

### Requirement: Operation selector with Recargar default

The terminal MUST expose three operations — Recibir (`→recibido`, sources `{entregado}`), Recargar (`→recarga`, sources `{recibido}`), and Listo (`→listo`, sources `{recarga}`) — and MUST default the selection to Recargar. The selected operation MUST drive the confirm payload (`operacion`), the confirm button label, and the success screen content.
(Previously: Recargar accepted sources `{entregado, recibido}` — the one-pass shortcut)

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
(Previously: the valid-source example used `entregado` under `recargar`)

#### Scenario: Valid source shows green target badge

- GIVEN an item in estado `recibido` and operation `recargar`
- WHEN the session list renders
- THEN the item shows a green badge for the target `recarga`

#### Scenario: Invalid source shows red badge

- GIVEN an item in estado `recarga` and operation `recibir`
- WHEN the session list renders
- THEN the item shows a red badge and cannot confirm validly for `recibir`

#### Scenario: Operation switch re-validates badges live

- GIVEN an item in estado `recibido` with a green badge under `recargar`
- WHEN the user switches the operation to `listo`
- THEN the badge re-derives to red for `listo` without re-scanning

### Requirement: Per-operation single-scan advance

A botellon MUST advance exactly one cycle edge per confirm — from its current estado to the selected operation's target — with no intermediate estados. The lifecycle `entregado → recibido → recarga → listo` MUST be achievable across sequential single scans, and MUST NOT skip `recibido`: the `entregado → recarga` one-pass is removed.
(Previously: "One-pass scan advance" allowed `entregado → recarga` in a single confirm)

#### Scenario: Entregado to recarga requires two scans

- GIVEN an item in estado `entregado` and operation `recargar`
- WHEN the user confirms
- THEN the transition is rejected and the badge stays red
- AND confirming `recibir` first moves the item to `recibido`, after which `recargar` becomes valid

#### Scenario: Recibido to recarga to listo in sequential scans

- GIVEN an item in estado `recibido`
- WHEN confirmed once with `recargar` and later with `listo`
- THEN the estado advances `recibido → recarga → listo`, one transition per confirm

### Requirement: Partial failure keeps the session editable

After a confirm with mixed results, the terminal MUST render per-item outcomes — ok items succeed per operation (REC# only for `recargar`), invalid items show their reason — and MUST keep the session editable so staff can fix and retry.
(Previously: the mixed-batch example used `entregado` as the valid item)

#### Scenario: Mixed batch reports per-item outcomes

- GIVEN a session with a valid `recibido` item and an invalid `recarga` item, operation `recargar`
- WHEN the confirm returns mixed results
- THEN the valid item reports ok and the invalid item shows reason `estado-recarga`

#### Scenario: Session remains editable after partial failure

- GIVEN a confirm returned rejected items
- WHEN the results render
- THEN the session list remains editable and confirm can be re-submitted