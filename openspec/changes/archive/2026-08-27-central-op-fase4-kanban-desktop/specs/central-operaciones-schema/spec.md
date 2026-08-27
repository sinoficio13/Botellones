# Delta for central-operaciones-schema

## ADDED Requirements

### Requirement: REQ-COS-22 — Kanban desktop layout (≥1024px)

At viewport widths ≥1024px, `/dashboard` MUST render the queue as a 4-column kanban grid (recibido, recarga, listo, delivery) inside a branch identified by `data-testid="cola-kanban"` using `hidden lg:grid lg:grid-cols-4`. The tablet 2-column grid MUST be hidden at ≥1024px (`md:grid lg:hidden`). Each column MUST render a sticky header with a 2px estado dot resolved to its `--estado-*` token, the estado label, the group counter, and the per-estado subtitle. Columns MUST render the same `porEstado` FIFO groups from `useColaOperaciones`, oldest group first. Below 1024px, the fase-3 mobile tabs and tablet grid MUST render unchanged.

#### Scenario: Tablet grid hidden, kanban rendered

- GIVEN a ≥1024px viewport with groups
- WHEN `/dashboard` renders
- THEN the tablet grid branch is not displayed and the `data-testid="cola-kanban"` 4-column grid is displayed

#### Scenario: Four estado columns with meta headers

- GIVEN a ≥1024px viewport with groups in all 4 estados
- WHEN the kanban renders
- THEN 4 columns appear in order Recibido, Recarga, Listo, Delivery, each with its 2px `--estado-*` dot, label, group counter and subtitle, groups oldest-first

#### Scenario: Below 1024px unchanged

- GIVEN a 768–1023px or <768px viewport
- WHEN `/dashboard` renders
- THEN the fase-3 tablet 2-column grid (or mobile tabs) renders and no kanban branch is displayed

### Requirement: REQ-COS-23 — Compact desktop group card

Each group on the desktop kanban MUST render as one compact card: client name, cédula in mono font ("—" when NULL), age plus 2-level urgency (6–24h amber text via `--urgencia-texto`; >24h a `▲` icon and amber tint via `--urgencia`; <6h normal), and bottle codes on ONE line separated by `·`, truncated with a "+N" suffix when the group exceeds 6 codes. The ActionButton MUST act on the WHOLE group (no chip selection on desktop), MUST use per-estado Spanish copy via `DESTINO_ACCION`/`copiaAccion`, MUST be at least 44px tall (`min-h-11`), and MUST apply the action to all group ids. A WhatsApp icon target MUST be present but inert; it MUST be disabled when the client has no phone. New components MUST NOT hardcode hex colors.

#### Scenario: Whole-group action, no chips

- GIVEN a group of 3 bottles in `recibido`
- WHEN the compact card renders
- THEN a single ActionButton ≥44px shows "→ Pasar 3 a En recarga", targets the whole group, and no chips render

#### Scenario: Codes one line with +N overflow

- GIVEN a group of 8 bottles
- WHEN the card renders
- THEN codes appear on one line separated by `·` with a "+2" suffix and no chips

#### Scenario: Urgency uses tokens

- GIVEN a group aged 30h and a group aged 10h
- WHEN cards render
- THEN the 30h card shows `▲` with `--urgencia` tint and the 10h card shows `--urgencia-texto` amber text

#### Scenario: WhatsApp inert target

- GIVEN a client with a phone and a client without
- WHEN cards render
- THEN each WhatsApp target is present; the one without a phone is disabled, and neither performs an action

### Requirement: REQ-COS-24 — Empty column placeholder

Each kanban column with zero groups MUST render a placeholder with a dashed border, a minimum height of 120px, the text "Vacío", and the estado subtitle. Placeholders MUST keep the 4-column grid intact so no layout jump occurs.

#### Scenario: Empty column placeholder

- GIVEN a column with zero groups
- WHEN the kanban renders
- THEN that column shows a dashed-border placeholder at least 120px tall with "Vacío" and the estado subtitle

#### Scenario: Grid stays intact

- GIVEN 2 empty and 2 populated columns
- WHEN the kanban renders
- THEN all 4 columns remain in the grid and the placeholders do not change column sizing

### Requirement: REQ-COS-25 — Native drag & drop (whole group)

At ≥1024px, group cards MUST be `draggable`; `dragstart` MUST set `dataTransfer` with the group's bottle ids and MUST also set a fallback `dragId` state, and `dragend` MUST clear that state. Columns MUST `preventDefault` on `dragover` and on `drop` MUST move ALL the group's bottles to that column's estado via the fase-3 `mover` — optimistic removal, success toast "Deshacer", revert on error. A drop onto a non-permitted estado MUST cause zero writes and MUST show the error-tone toast "No se pudo mover. Reintentá." without undo. Drag MUST NOT be active below 1024px. Entregar MUST NOT be reachable by drag (no Entregado column).

#### Scenario: Valid drop moves the whole group

- GIVEN a `recibido` group card dragged onto the Recarga column
- WHEN the drop fires
- THEN all group ids move to `recarga` via `mover`, the group leaves optimistically, and a "Deshacer" toast shows

#### Scenario: Undo restores estado and original age

- GIVEN a successful drag-move and "Deshacer" tapped
- WHEN the undo completes
- THEN each bottle returns to its prior estado with its original `estado_desde`

#### Scenario: Invalid drop zero-write with error toast

- GIVEN a Delivery group dropped onto Recarga
- WHEN the drop fires
- THEN nothing is written, the group stays put, and the red toast "No se pudo mover. Reintentá." shows without undo

#### Scenario: dragend cleanup

- GIVEN a drag in progress
- WHEN `dragend` fires
- THEN the `dragId` fallback state is cleared

#### Scenario: No drag below 1024px

- GIVEN a <1024px viewport
- WHEN the queue renders
- THEN group cards are not draggable

### Requirement: REQ-COS-26 — Desktop test contract

Component tests MUST cover the compact card, the kanban columns, and the drag handlers by dispatching HTML5 drag events via `fireEvent` (`dragStart`, `dragOver`, `drop`, `dragEnd`), including the invalid-drop error toast. Component tests MUST assert the layout at 1024px (kanban visible, tablet grid hidden) and MUST keep the existing 375/768/1023 assertions green. A Playwright spec `cola-1024px.spec.ts` MAY mirror `cola-375px.spec.ts` at viewport 1024; it MAY be dropped to keep its PR within the 400-line budget.

#### Scenario: Files cover the contract

- GIVEN the desktop components
- WHEN the suite runs
- THEN `grupo-card-desktop.test.tsx` and `kanban-columnas.test.tsx` pass and the fase-3 suite stays green

#### Scenario: HTML5 drag events exercised

- GIVEN a rendered kanban in jsdom
- WHEN `fireEvent.dragStart`/`dragOver`/`drop`/`dragEnd` are dispatched
- THEN handlers fire, a valid drop calls `mover` with the whole group's ids, and an invalid drop asserts zero `mover` calls plus the red toast

#### Scenario: Breakpoint assertions

- GIVEN component tests
- WHEN widths 375, 768, 1023, 1024 and 1440 are asserted
- THEN <1024px renders the tablet/mobile branches and ≥1024px renders the kanban

#### Scenario: Optional e2e mirror

- GIVEN Playwright configured
- WHEN `cola-1024px.spec.ts` runs at viewport 1024
- THEN the kanban renders; the file is droppable if the PR would exceed the 400-line budget

## MODIFIED Requirements

### Requirement: REQ-COS-21 — Reemplazo del dashboard

`/dashboard` MUST render the queue: tabs + cards on mobile; on tablet 768–1023 a 2-column grid of sections per estado WITHOUT tabs, each with a sticky section header; on desktop ≥1024px the 4-column kanban grid (REQ-COS-22) MUST render instead of the tablet grid, which MUST be hidden at that width. Loading MUST use the skeleton shimmer, never a spinner. Each tab MUST have its own empty-state copy; a fully empty queue MUST show a first-use empty state with [📷 Escanear] (opens `ScannerModal`) and [Cargar manual] (navigates to `/recargas/carga`). At 375px width the page MUST NOT scroll horizontally.
(Previously: no desktop contract — the tablet grid applied at every width ≥768px, so ≥1024px showed the tablet layout.)

#### Scenario: Tablet sections without tabs

- GIVEN a 768–1023px viewport with groups
- WHEN `/dashboard` renders
- THEN 2-column sections per estado appear with sticky headers and no tabs

#### Scenario: Tablet grid hidden at ≥1024px

- GIVEN a ≥1024px viewport with groups
- WHEN `/dashboard` renders
- THEN the tablet 2-column grid is not rendered and the desktop kanban renders instead

#### Scenario: First-use empty state

- GIVEN a queue with zero client-owned bottles
- WHEN `/dashboard` renders
- THEN the first-use empty state shows with [📷 Escanear] and [Cargar manual]

#### Scenario: Loading is a skeleton

- GIVEN the queue is loading
- WHEN `/dashboard` renders
- THEN skeleton shimmer placeholders show and no spinner element exists

#### Scenario: No horizontal scroll at 375px

- GIVEN a 375px viewport
- WHEN the queue renders fully populated
- THEN no element overflows the viewport horizontally
