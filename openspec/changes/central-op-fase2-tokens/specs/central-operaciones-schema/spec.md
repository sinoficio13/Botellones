# Delta for central-operaciones-schema

Extends the fase-1 spec with the fase-2 visual system: additive design tokens, Inter/JetBrains Mono font loading, and five UI primitives with a component-test contract. No screens; existing shadcn tokens and `src/components/ui/*` remain untouched.

## ADDED Requirements

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

The system MUST provide a module-level `showToast({message, actionLabel?, onAction?, tone})` singleton rendering at most one Toast instance, bottom-positioned (12px lateral inset, 66px above bottom nav). A new toast MUST replace the previous instance and reset the timer. A toast MUST auto-dismiss 4.5s after the most recent show. An optional "Deshacer" action MAY be shown for success tone only and MUST NOT appear for error tone; activating it MUST invoke `onAction`. The toast container MUST have `aria-live="polite"`.

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