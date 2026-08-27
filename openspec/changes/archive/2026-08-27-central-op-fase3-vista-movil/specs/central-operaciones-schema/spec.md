# Delta for central-operaciones-schema

## ADDED Requirements

### Requirement: REQ-COS-16 — Cola operativa data layer

The system MUST provide `getColaOperaciones()` returning only client-owned botellones (`cliente_id IS NOT NULL`), each row joined with `clientes(nombre, cedula, telefono_1, whatsapp)` and selecting `estado_desde`, ordered by `estado_desde` ASC. Rows with NULL `cliente_id` MUST be excluded before grouping. The result MUST feed fase-1 `agrupar()` so each estado tab shows FIFO groups — oldest group first, group age = `min(estado_desde)`, member codes oldest-first.

#### Scenario: Client-owned rows only, FIFO ordered

- GIVEN botellones with and without `cliente_id` across the 4 queue estados
- WHEN `getColaOperaciones()` runs
- THEN only client-owned rows return with client join fields, ordered by `estado_desde` ASC

#### Scenario: Groups feed FIFO tabs

- GIVEN the returned rows fed through `agrupar()`
- WHEN per-estado lists are computed
- THEN groups sort oldest-first by `min(estado_desde)` and codes sort oldest-first inside each group

### Requirement: REQ-COS-17 — Tabs de estado + barra de contexto

The system MUST render 4 estado tabs (`recibido`, `recarga`, `listo`, `delivery`) as `role="tablist"`/`role="tab"` with `aria-selected` reflecting the active tab, sticky at the top, each with a 2px underline in its `--estado-*` token and a counter of groups (static this fase). A context bar MUST show "N clientes · N botellones · más antiguo arriba".

#### Scenario: Accessible sticky tabs with estado underline

- GIVEN groups in all 4 estados
- WHEN the queue renders on mobile
- THEN 4 tabs show with per-estado group counters, `aria-selected` on the active tab, and a 2px underline resolved to the tab's `--estado-*` token

#### Scenario: Context totals

- GIVEN a loaded queue
- WHEN the context bar renders
- THEN it shows client and botellón totals with the "más antiguo arriba" hint

### Requirement: REQ-COS-18 — Card de grupo + chips + urgencia

Each client group MUST render as one card: name and cédula (mono font; "—" when cédula is NULL) plus 3 independent touch targets of at least 44px — name (inert placeholder), WhatsApp icon (disabled when no phone; inert when phone present), and a chips grid. Chips MUST be all-marked by default, toggle individually, show 6 plus a "+N" expansion when the group exceeds 6 bottles. Urgency MUST be 2-level: 6–24h amber `--urgencia` text; >24h a `▲ AlertTriangle` icon plus amber 7% card background; <6h normal. Age MUST format as `45m`/`3h`/`3d`. No hardcoded hex MAY appear.

#### Scenario: Chips all-marked with +N expansion

- GIVEN a group of 8 bottles
- WHEN the card renders
- THEN 6 chips show all-marked plus a "+2" expansion control

#### Scenario: Urgency levels

- GIVEN a group aged 30h and another aged 10h
- WHEN cards render
- THEN the 30h card shows `▲` with amber 7% background and the 10h card shows amber text only

#### Scenario: Null cédula

- GIVEN a client without cédula
- WHEN the card renders
- THEN the cédula block shows "—" in mono font

### Requirement: REQ-COS-19 — Acción avance/entrega + optimistic + undo

Each group's ActionButton MUST use per-estado Spanish copy — "→ Pasar N a En recarga", "→ Pasar N a Listo", "→ Pasar N a En delivery", "✓ Entregar N a {PrimerNombre}" — ALWAYS with `--marca` background, and MUST be disabled with "Elegí al menos un botellón" when 0 chips are marked. The action MUST apply optimistically (bottles leave the list instantly), then show a success Toast with "Deshacer" (4.5s) and call `mover_botellones`. Undo MUST restore each moved bottle's prior estado AND its original `estado_desde` value. On RPC error the system MUST revert the UI and show a red toast "No se pudo mover. Reintentá." without undo. Entregar MUST NOT open a client selector.

#### Scenario: Optimistic move with undo

- GIVEN 3 marked chips on a group in `recibido`
- WHEN "→ Pasar 3 a En recarga" is tapped
- THEN the group leaves instantly, a Deshacer toast shows, and the RPC fires

#### Scenario: Undo restores estado and original estado_desde

- GIVEN a successful move and "Deshacer" tapped
- WHEN the undo completes
- THEN each bottle returns to its prior estado with its original `estado_desde` restored

#### Scenario: Failure reverts without undo

- GIVEN an RPC failure
- WHEN the action completes
- THEN the list reverts to pre-action state and a red toast without "Deshacer" shows

#### Scenario: Zero marked disabled

- GIVEN a group with no marked chips
- WHEN inspected
- THEN the ActionButton is disabled and shows "Elegí al menos un botellón"

#### Scenario: Entregar has no client selector

- GIVEN "✓ Entregar N a {PrimerNombre}" tapped
- WHEN the confirm-return flow runs
- THEN no client selector appears and the RPC confirms the return directly

### Requirement: REQ-COS-20 — Buscador

The queue header input MUST debounce searches 250ms (reusing `use-debounce`), MUST ignore input under 2 characters, and MUST search in parallel over the 4 queue estados by nombre (`ilike`), cédula (normalized digits-only), and código (`ilike`) via a server helper. Results MUST be grouped by match type (Nombre / Cédula / Código).

#### Scenario: Debounced parallel grouped search

- GIVEN "ma" typed in the search input
- WHEN 250ms elapse
- THEN a parallel search runs across the 4 estados and results render grouped by Nombre / Cédula / Código

#### Scenario: Minimum length gate

- GIVEN a single character typed
- WHEN the debounce elapses
- THEN no search runs

### Requirement: REQ-COS-21 — Reemplazo del dashboard

`/dashboard` MUST render the queue: tabs + cards on mobile; on tablet 768–1023 a 2-column grid of sections per estado WITHOUT tabs, each with a sticky section header. Loading MUST use the skeleton shimmer, never a spinner. Each tab MUST have its own empty-state copy; a fully empty queue MUST show a first-use empty state with [📷 Escanear] (opens `ScannerModal`) and [Cargar manual] (navigates to `/recargas/carga`). At 375px width the page MUST NOT scroll horizontally.

#### Scenario: Tablet sections without tabs

- GIVEN a 768–1023px viewport with groups
- WHEN `/dashboard` renders
- THEN 2-column sections per estado appear with sticky headers and no tabs

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

## MODIFIED Requirements

### Requirement: REQ-COS-12 — Toast single-instance primitive

The system MUST provide a module-level `showToast({message, actionLabel?, onAction?, tone})` singleton rendering at most one Toast instance, bottom-positioned (12px lateral inset, 66px above bottom nav). A new toast MUST replace the previous instance and reset the timer. A toast MUST auto-dismiss 4.5s after the most recent show. An optional "Deshacer" action MAY be shown for success tone only and MUST NOT appear for error tone; activating it MUST invoke `onAction`. Activating an action MUST dismiss only the toast instance that carried it (by captured identity); a new toast shown inside `onAction` MUST NOT be dismissed by that same dismiss. The toast container MUST have `aria-live="polite"`.
(Previously: no guarantee that a toast shown inside an action's `onAction` survives the same handler's dismiss.)

#### Scenario: New toast replaces previous

- GIVEN a visible toast
- WHEN `showToast` is called again
- THEN only the new message renders and the 4.5s timer restarts

#### Scenario: Auto-dismiss after 4.5s

- GIVEN a shown toast with fake timers
- WHEN 4500ms elapse
- THEN the toast is removed from the DOM

#### Scenario: Undo only for success

- GIVEN a success toast with `onAction`
- WHEN "Deshacer" is clicked
- THEN `onAction` fires; an error-tone toast renders no action label

#### Scenario: Action-shown toast survives (R3-001)

- GIVEN a toast whose `onAction` calls `showToast` again
- WHEN the action is activated
- THEN the dismiss of the original toast does not remove the new toast, whose 4.5s timer runs

#### Scenario: Polite live region

- GIVEN a rendered toast
- WHEN its container is inspected
- THEN it exposes `aria-live="polite"`