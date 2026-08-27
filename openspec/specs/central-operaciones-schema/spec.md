# central-operaciones-schema Specification

## Purpose

FIFO state-age foundation for the Central de Operaciones: `estado_desde` + backfill, `movimientos` audit + trigger, `mover_botellones` transactional batch RPC (SQL machine mirror + role guard), `GrupoCliente`/`agrupar()` grouping util, and DB type updates. No UI. Old writers (`moverBotellon`/`updateBotellon`) stay untouched; the trigger retrofits them.

Fase 2 extends this capability with the visual system: additive design tokens (REQ-COS-8), Inter + JetBrains Mono font loading (REQ-COS-9), and five UI primitives with a component-test contract (REQ-COS-10..REQ-COS-15). No screens; existing shadcn tokens and `src/components/ui/*` remain untouched.

Fase 3 replaces `/dashboard` with the mobile/tablet queue view: client-owned cola data layer feeding fase-1 `agrupar()` (REQ-COS-16), estado tabs + context bar (REQ-COS-17), group card with chips and urgency (REQ-COS-18), optimistic move/entregar with undo via the toast primitive (REQ-COS-19), grouped search (REQ-COS-20), and the responsive dashboard shell with tablet sections and first-use empty state (REQ-COS-21). REQ-COS-12 gains the action-dismiss-by-identity semantic (R3-001).

Fase 4 extends `/dashboard` to desktop (≥1024px): a 4-column kanban layout with sticky meta headers (REQ-COS-22), a compact whole-group card with urgency and code overflow (REQ-COS-23), empty-column placeholders (REQ-COS-24), native drag & drop that moves whole groups with optimistic undo and error toast (REQ-COS-25), and the desktop test contract (REQ-COS-26). REQ-COS-21 gains the desktop branch and the "tablet grid hidden at ≥1024px" scenario.

## Requirements

### Requirement: REQ-COS-1 — estado_desde column and FIFO backfill

`botellones.estado_desde` MUST be `timestamptz NOT NULL DEFAULT now()`; bottle age in current estado MUST be `now() - estado_desde`. Migration 0011 MUST backfill existing rows: `entregado` → `COALESCE(fecha_entrega, fecha_creacion, created_at, now())`; all other estados → `COALESCE(fecha_creacion, created_at, now())`. `fecha_creacion` is app-consistent; `created_at` is the defensive fallback. Backfilled ages are approximations; exact ages accrue from deployment onward.

#### Scenario: Column applied and NOT NULL

- GIVEN migration 0011 applied
- WHEN the `botellones` schema is inspected
- THEN `estado_desde` exists, NOT NULL, with `DEFAULT now()`

#### Scenario: Backfill picks per-estado source

- GIVEN an existing `entregado` row with `fecha_entrega` set, and an existing `recarga` row with `fecha_creacion` set
- WHEN migration 0011 backfills
- THEN `estado_desde` equals `fecha_entrega` for the first and `fecha_creacion` for the second

#### Scenario: Fallback when no source exists

- GIVEN a row whose `fecha_entrega`, `fecha_creacion`, and `created_at` are all NULL
- WHEN migration 0011 backfills
- THEN `estado_desde` is set to `now()`

### Requirement: REQ-COS-2 — movimientos audit table

Table `movimientos` MUST record every estado change: `botellon_id` FK → botellones, `estado_previo`, `estado_nuevo`, `usuario_id` (nullable FK → auth.users), `created_at` DEFAULT now(). It MUST have an index on `botellon_id`. RLS MUST mirror the admin/repartidor policy style: admins full access, repartidores SELECT-only, service-role writes unaffected. No historical `movimientos` backfill exists (documented limitation).

#### Scenario: RLS mirrors admin/repartidor roles

- GIVEN `movimientos` rows exist
- WHEN an admin writes and a repartidor reads
- THEN the admin has full access and the repartidor is SELECT-only

#### Scenario: No synthesized history

- GIVEN estado changes made before this migration
- WHEN 0011/0012 are applied
- THEN no `movimientos` rows are synthesized for past changes

### Requirement: REQ-COS-3 — Trigger contract (stamp + audit on estado change)

`BEFORE UPDATE` trigger `trg_estado_desde` MUST fire only when `NEW.estado IS DISTINCT FROM OLD.estado`; MUST set `NEW.estado_desde := now()`; MUST insert `movimientos(botellon_id, estado_previo, estado_nuevo, usuario_id = auth.uid())`. `usuario_id` MUST be NULL when no session uid exists (service-role writes). The trigger MUST NOT insert when the estado is unchanged. The trigger function MUST be SECURITY DEFINER with pinned `search_path` and MUST be idempotent (`CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS`).

#### Scenario: Estado change stamps and audits

- GIVEN a botellon in `recibido`
- WHEN any writer (form, kanban action, batch RPC) sets estado `recarga`
- THEN `estado_desde` is stamped `now()` and one `movimientos` row records `recibido → recarga`

#### Scenario: No-op update inserts nothing

- GIVEN a botellon
- WHEN an UPDATE sets the estado to its current value
- THEN `estado_desde` is untouched and zero `movimientos` rows are inserted

#### Scenario: Service-role write has null user

- GIVEN an UPDATE without a session uid
- WHEN the estado changes
- THEN the appended `movimientos.usuario_id` is NULL

### Requirement: REQ-COS-4 — mover_botellones batch RPC

RPC `mover_botellones(p_ids uuid[], p_estado text)` MUST be SECURITY DEFINER and MUST run in a single transaction (all-or-nothing). It MUST reject unauthenticated callers and non-admin/repartidor roles via `auth.jwt() -> 'app_metadata' ->> 'role'` (definer bypasses RLS). It MUST update only rows matching `id = ANY(p_ids) AND p_estado = ANY(permitidos(estado))` — validation inside the UPDATE WHERE, TOCTOU-free — then MUST compare the affected row count against `cardinality(DISTINCT p_ids)`; on mismatch it MUST raise an exception and roll back (zero writes). Identity moves MUST be permitted. The RPC MUST NOT touch `cliente_id`, and `entregado` via RPC MUST NOT require a client (machine-only validation).

#### Scenario: Valid batch moves in one transaction

- GIVEN 3 botellones in `recarga`
- WHEN `mover_botellones(ids, 'listo')` runs
- THEN one UPDATE moves all 3 and the trigger appends one `movimientos` row per bottle

#### Scenario: Partial-invalid batch rolls back entirely

- GIVEN a batch of 3 ids where one row is not in a permitted estado
- WHEN the RPC runs
- THEN an exception is raised and NOTHING is written — zero rows updated

#### Scenario: Rejected jump mirrors the manual rule

- GIVEN a botellon in `recibido`
- WHEN `mover_botellones(ids, 'listo')` runs
- THEN the exception rejects the jump with zero writes (mirrors botellon-ciclo-estados S5)

#### Scenario: Unauthenticated or wrong role rejected

- GIVEN no session, or a session whose role is neither admin nor repartidor
- WHEN the RPC is called
- THEN it is rejected before any UPDATE executes

#### Scenario: Identity move permitted without audit row

- GIVEN a botellon in `listo`
- WHEN `mover_botellones(ids, 'listo')` runs
- THEN the update succeeds and no `movimientos` row is inserted (estado unchanged)

### Requirement: REQ-COS-5 — SQL machine mirror

A SQL helper MUST mirror `getEstadosPermitidos(estado)` for all five estados — dedup union of forward transitions, reversions, and the identity estado, returned as `text[]`. Its output MUST equal the TS `getEstadosPermitidos` output for every estado; drift is guarded by the verify diff, and CASE comments MUST cite the `estados.ts` lines they mirror.

#### Scenario: Mirror equals the TS machine

- GIVEN all five estados
- WHEN the SQL helper output is compared with `getEstadosPermitidos(estado)`
- THEN the permitted sets are identical

#### Scenario: Reversion and identity included

- GIVEN estado `recibido`
- WHEN the SQL helper runs
- THEN it includes reversion `entregado` and identity `recibido`

### Requirement: REQ-COS-6 — GrupoCliente grouping util

Pure `agrupar()` in `src/lib/utils/grupos.ts` MUST group rows by `cliente_id` into `GrupoCliente`; a NULL `cliente_id` MUST be a valid (stock) group key. Group age MUST be `min(estado_desde)` of the members; groups MUST sort oldest-first by group age; member codes MUST sort oldest-first by `estado_desde` with `codigo` as tiebreak. The function MUST be total (no row dropped) and UI-agnostic. Vitest MUST cover grouping, ordering, tiebreak, and the null key.

#### Scenario: Groups sort oldest-first

- GIVEN two groups whose oldest members entered yesterday and today
- WHEN `agrupar()` runs
- THEN the yesterday group sorts first

#### Scenario: Group age is the min, codes oldest-first

- GIVEN a client's 3 bottles of different ages
- WHEN `agrupar()` runs
- THEN group age equals the oldest bottle's `estado_desde` and codes sort oldest-first inside the group

#### Scenario: Null key is a stock group

- GIVEN rows with `cliente_id IS NULL`
- WHEN `agrupar()` runs
- THEN they form one stock group and are never dropped

#### Scenario: Tiebreak by codigo

- GIVEN two codes with equal `estado_desde`
- WHEN ordered inside the group
- THEN `codigo` breaks the tie

### Requirement: REQ-COS-7 — DB type updates

`src/types/database.ts` MUST add `estado_desde` to the `botellones` Row/Insert/Update types, MUST add the `movimientos` table types, and MUST add the `mover_botellones` RPC signature — hand-updated per the existing generated-file convention. Existing writer tests MUST remain untouched and passing.

#### Scenario: Types reflect the new schema

- GIVEN the updated `database.ts`
- WHEN the TypeScript project compiles
- THEN `estado_desde`, `movimientos`, and the RPC signature type-check

#### Scenario: Existing writers unaffected

- GIVEN the existing test suite
- WHEN it runs
- THEN `moverBotellon`/`updateBotellon` tests pass unchanged

### Requirement: REQ-COS-8 — Additive design tokens (light/dark + semantic)

The system MUST add the following CSS custom properties to `src/app/globals.css`, appended to `:root` and `.dark` without modifying any existing token. Light: `--surface-1 #FAFAFA`, `--surface-2 #FFFFFF`, `--surface-3 #F4F4F5`, `--border-strong #D4D4D8`, `--text-primary #18181B`, `--text-secondary #52525B`, `--text-muted #A1A1AA`, `--fill-disabled #E4E4E7`, `--text-disabled #A1A1AA`. Dark: `--surface-1 #09090B`, `--surface-2 #18181B`, `--surface-3 #27272A`, `--border-strong #3F3F46`, `--text-primary #FAFAFA`, `--text-secondary #A1A1AA`, `--text-muted #71717A`, `--fill-disabled #27272A`, `--text-disabled #52525B`. The existing `--border` token MUST be reused, not redefined. Semantic tokens MUST be identical in both modes: `--estado-recibido #64748B`, `--estado-recarga #0C7C92`, `--estado-listo #1A9150`, `--estado-delivery #DB9A2E`, `--estado-entregado #6D42C7`, `--marca #0C7C92`, `--urgencia #B07515`, `--whatsapp #1A9150`. All tokens MUST be mapped through `@theme inline` `--color-*` entries so Tailwind v4 utilities resolve (`bg-surface-1`, `text-text-secondary`, `bg-marca`, `bg-estado-listo`, `text-urgencia`, `border-border-strong`, `bg-fill-disabled`) without colliding with existing shadcn `--color-*` names. New components in this change MUST NOT hardcode hex colors; they MUST consume tokens only. Existing shadcn tokens MUST remain byte-identical.

#### Scenario: Locked values applied per mode

- GIVEN `globals.css` with the new tokens
- WHEN `:root` and `.dark` are inspected
- THEN each new variable equals its locked value and semantic tokens are identical across modes

#### Scenario: No shadcn clobber

- GIVEN the pre-change shadcn token set
- WHEN the change is applied and diffed
- THEN every pre-existing token (`--background`, `--border`, etc.) is byte-identical

#### Scenario: Utilities resolve

- GIVEN the `@theme inline` mappings
- WHEN the project builds and a component uses `bg-marca`, `text-text-secondary`, `bg-fill-disabled`
- THEN the utilities compile and resolve to the locked values

#### Scenario: No hardcoded hex in new components

- GIVEN the new `src/components/operaciones/*` files
- WHEN they are scanned for hex color literals
- THEN no `#` color literal is found

### Requirement: REQ-COS-9 — Inter + JetBrains Mono font loading

The system MUST load Inter (base sans) and JetBrains Mono (mono) via `next/font/google` in the root layout, replacing Geist/Geist_Mono, and MUST point the CSS variables backing `--font-sans` and `--font-mono` at the new fonts so `font-sans`/`font-mono` utilities resolve app-wide. Botellon identifiers — bottle codes and cédulas — MUST render in the mono font (`font-mono`). No new npm packages MAY be added. Typography/spacing basis is minimal: Tailwind's 4px spacing scale and default type scale suffice; 44px touch targets map to `min-h-11`.

#### Scenario: Layout swaps fonts

- GIVEN the root layout
- WHEN it is inspected
- THEN Inter and JetBrains Mono are loaded via `next/font/google` and Geist/Geist_Mono are no longer referenced

#### Scenario: Font variables resolve app-wide

- GIVEN the updated layout and `@theme inline`
- WHEN the project builds and elements use `font-sans` / `font-mono`
- THEN Inter renders UI text and JetBrains Mono renders identifiers

### Requirement: REQ-COS-10 — Chip toggle primitive

The system MUST provide `Chip` in `src/components/operaciones/` rendering a `<button>` whose `aria-pressed` reflects its toggle state, using `font-mono`, with a minimum touch target of 44px height (`min-h-11`). Clicking a Chip MUST flip its pressed state and invoke the caller's toggle callback; chips toggle individually. `Chip` MUST NOT modify shadcn `ui/` components and MUST use tokens, not hex.

#### Scenario: Toggles on click

- GIVEN a Chip rendered with `aria-pressed="false"`
- WHEN it is clicked
- THEN `aria-pressed` becomes `true` and the toggle callback fires

#### Scenario: Individual toggle and target size

- GIVEN two Chips rendered together
- WHEN the first is clicked twice
- THEN only the first flips state and the rendered height is at least 44px

### Requirement: REQ-COS-11 — ActionButton primary action primitive

The system MUST provide `ActionButton` in `src/components/operaciones/` rendering the primary action with `--marca` (#0C7C92) background in every estado and both modes, minimum 44px height, accepting `children`, `disabled`, and `aria-label`. When disabled, it MUST use `--fill-disabled`/`--text-disabled` (not opacity), MUST remain at least 44px tall, and MUST be non-interactive (`disabled` attribute). It MUST NOT reuse shadcn `buttonVariants` and MUST NOT hardcode hex.

#### Scenario: Always marca

- GIVEN a rendered ActionButton in light and dark mode
- WHEN its background is inspected
- THEN it resolves to `--marca` (#0C7C92) in both modes

#### Scenario: Disabled uses fill/text tokens

- GIVEN an ActionButton with `disabled`
- WHEN inspected
- THEN it uses `--fill-disabled`/`--text-disabled`, stays ≥44px, and ignores clicks

#### Scenario: Accessible label

- GIVEN an ActionButton with `aria-label`
- WHEN inspected
- THEN the label is present on the rendered element

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

### Requirement: REQ-COS-13 — Skeleton shimmer primitive

The system MUST provide `Skeleton` in `src/components/operaciones/` rendering a shimmer placeholder with a 1.5s looping animation and MUST NOT render a spinner, text, or icon.

#### Scenario: Shimmer placeholder

- GIVEN a rendered Skeleton
- WHEN inspected
- THEN a shimmer animation of 1.5s duration is applied and no spinner element exists

### Requirement: REQ-COS-14 — EmptyState primitive

The system MUST provide `EmptyState` in `src/components/operaciones/` rendering, in fixed order: a CircleDashed icon at 40px in muted tone, a title at 15px/500 weight, a description at 12px in muted tone, and an optional secondary action. Copy is generic; variant copy is out of scope. It MUST use tokens, not hex.

#### Scenario: Elements in order

- GIVEN an EmptyState with title, description, and action
- WHEN rendered
- THEN icon, title, description, and action appear in that order with the specified sizes/tones

#### Scenario: Action optional

- GIVEN an EmptyState without an action
- WHEN rendered
- THEN no action element is present and the rest render unchanged

### Requirement: REQ-COS-15 — Component test contract

Each primitive MUST ship a component test in `tests/component/` using Vitest + React Testing Library (jsdom): `chip.test.tsx` (aria-pressed toggle + callback), `action-button.test.tsx` (marca class, disabled fill/text classes, aria-label), `toast.test.tsx` (fake timers for 4.5s dismiss, replace-previous, Deshacer `onAction`, `aria-live`), and `empty-state.test.tsx` (icon/title/description/action order plus Skeleton shimmer folded in). Toast timing tests MUST use fake timers and MUST NOT rely on real waits.

#### Scenario: Files cover all primitives

- GIVEN the five primitives
- WHEN the test suite runs
- THEN each has a matching `tests/component/` file and all assertions pass

#### Scenario: Timing via fake timers

- GIVEN the toast test
- WHEN it advances timers
- THEN dismissal is asserted without real-time waiting

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
