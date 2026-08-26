# Proposal: Central de Operaciones — Fase 2: Design tokens + UI primitives

## Intent

EPIC-15 fase 2 builds the visual system and reusable primitives fase 3 (mobile grouped queue) consumes — still no screens. Today `/dashboard` hardcodes hex colors (`operaciones-dashboard.tsx` L17: `recarga: { dot: '#0C7C92' }`) and there are no shared tokens, no chip/toast/skeleton/empty-state primitives anywhere. This fase makes spec §5 real: additive CSS design tokens mapped into Tailwind v4 utilities, five primitives with strict-TDD tests, and a documented typography/spacing basis — WITHOUT touching the existing shadcn token set (other pages keep `bg-background`/`text-foreground` untouched) and without screens.

## Scope

### In Scope
- **Design tokens** in `src/app/globals.css` (`:root`/`.dark`, additive): `--surface-1/2/3`, `--border-strong` (reuse existing `--border`), `--text-primary/secondary/muted`, `--fill-disabled`, `--text-disabled`; semantic estado colors `--estado-recibido #64748B`, `--estado-recarga #0C7C92`, `--estado-listo #1A9150`, `--estado-delivery #DB9A2E`, `--estado-entregado #6D42C7`; `--marca #0C7C92`, `--urgencia #B07515`, `--whatsapp #1A9150`. Same values both modes. Mapped into `@theme inline` → utilities `bg-surface-1`, `text-text-secondary`, `bg-marca`, `bg-estado-recarga`, etc.
- **Primitives** in new `src/components/operaciones/` (domain-folder convention): `Chip` (button + `aria-pressed`, mono, ~32px, 6px/10px padding, radius 8px, toggle individual), `ActionButton` (always `--marca`, min-h 44px, text-sm/500, disabled → `--fill-disabled`/`--text-disabled`, children + disabled + aria-label), `Toast` (single bottom instance, 12px lateral / 66px over nav, ~44px, 4.5s auto-dismiss, optional "Deshacer", `aria-live="polite"`, new replaces previous; API `showToast({message, actionLabel?, onAction?, tone})`), `Skeleton` (shimmer 1.5s loop, never spinner), `EmptyState` (CircleDashed 40px muted → title 15px/500 → description 12px muted → secondary action; generic copy).
- **Tests** (strict TDD) in `tests/component/`: chip, action-button, toast (fake timers, replace-previous, aria-live), empty-state.
- **Typography/spacing guidance** (spec §5.2/5.3): minimal basis documented in the delta spec — Tailwind's 4px spacing scale + type scale suffice; 44px min touch target = `min-h-11`; mono = Geist Mono. Full token system deferred.

### Out of Scope
- Screens, kanban, realtime, WhatsApp/ficha (fases 3–5); no changes to `operaciones-dashboard.tsx` or any `/dashboard` page.
- Modifying existing `src/components/ui/*` shadcn components or their tokens (additive only).
- Font loading changes (Inter/JetBrains Mono absent — WARNING, see question round 2).
- Full typography token system (type-scale/spacing CSS vars) — fase 3+ if needed.
- `sonner` or any new toast dependency; no new packages at all.

## Business Rules (locked)

1. **Primary action button is ALWAYS `--marca` (#0C7C92)** in all four estados; estado color lives in the tab + dot, NEVER as card background (spec §5.1 / epic Notas).
2. **Semantic estado colors are identical in light and dark mode**; only surfaces/borders/text vary per mode.
3. **No hardcoded hex in new components** — colors come from CSS vars only (`operaciones-dashboard.tsx` keeps its hardcodes until fase 3 replaces it).
4. **Toast**: single instance; new toast replaces previous (timer reset); auto-dismiss 4.5s; "Deshacer" action ONLY for success tones, never error; `aria-live="polite"`.
5. **Skeleton**: shimmer animation loop, never a spinner.
6. **EmptyState** order: icon → title → description → secondary action; variant copy is fase 3's job.
7. **Chip**: `<button>` with `aria-pressed`, mono, ~32px tall, toggle individual.
8. **Disabled ActionButton** uses `--fill-disabled`/`--text-disabled` (NOT opacity) and stays 44px.

## User Stories / Scenarios

- **Consistent brand**: an operator sees the same `#0C7C92` primary action in light and dark mode; the estado color appears only on the tab and the dot.
- **Selecting bottles**: an operator taps a Chip to toggle one bottle on/off; screen readers hear the pressed state (`aria-pressed`) immediately.
- **Advancing a group**: fase 3's "Pasar N a Listo" renders as a 44px `#0C7C92` button; when 0 bottles are selected it is visibly disabled (fill-disabled) and unclickable.
- **Undo safety**: after advancing, a single toast appears bottom-center with "Deshacer"; a second action replaces it; after 4.5s it dismisses itself.
- **Loading without spinner**: cards/tabs load with shimmer skeletons; an empty tab shows a CircleDashed empty state with title/description/action.

## Capabilities

### New Capabilities
None — decision: extend the existing `central-operaciones-schema` capability (see question round 3 for the alternative).

### Modified Capabilities
- `central-operaciones-schema` (delta): **ADDED** requirements REQ-COS-8..12 — design tokens (vars + Tailwind mapping + no-hardcode rule), Chip primitive, ActionButton primitive, Toast primitive (single-instance + `showToast` + a11y + timing), Skeleton/EmptyState primitives, and the component-test contract. Main spec on branch `chore/central-op-fase1-registro` (see Risks).

## Approach

Additive tokens in `globals.css`: append new vars to `:root` and `.dark` (existing shadcn vars untouched), then map them in `@theme inline` as `--color-*` so Tailwind v4 generates utilities (`bg-surface-1`, `text-text-secondary`, `bg-marca`, `bg-estado-listo`, `text-urgencia`, `border-border-strong`, `bg-fill-disabled`). `--border` is NOT redefined (already exists as shadcn token, same neutral intent). New `src/components/operaciones/` folder (matches `dashboard/`, `scanner/`, `reportes/` convention) holds the five primitives; they are standalone (Chip/Toast/EmptyState use base elements + tokens; ActionButton does NOT reuse `buttonVariants` because disabled semantics differ from shadcn's opacity-50). Toast is a module-level singleton (`showToast()` sets state; one `<ToastHost/>` mounts it) — simplest for fase 3 call sites, no context plumbing. Skeleton shimmer: use `tw-animate-css` `animate-shimmer` if shipped, else ~8-line additive `@keyframes shimmer` in globals.css. Strict TDD: each component lands with its `tests/component/` vitest file (jsdom + testing-library, fake timers for Toast).

## Approach Comparison

| Decision | Chosen | Why |
|---|---|---|
| Token mechanism | CSS vars + `@theme inline` mapping | Project's existing Tailwind v4 mechanism; utilities generated for free; additive, no clobber |
| `--border` | Reuse existing shadcn var | Same neutral intent; redefining would break other pages |
| Primitives location | `src/components/operaciones/` | Domain-folder convention (dashboard/, scanner/, reportes/); `ui/` is generated shadcn — keep pristine |
| ActionButton base | Standalone, not `buttonVariants` | Disabled = fill-disabled/text-disabled, differs from shadcn opacity-50; composition would fight the variant system |
| Toast state | Module-level singleton + host | No context/provider; fase 3 call sites just `showToast()` |
| Typography scope | Minimal (Tailwind defaults + `min-h-11` + Geist Mono) | Fase 3 needs nothing more; full token system = scope creep under 400-line budget |
| Capability mapping | Extend `central-operaciones-schema` (ADDED) | One capability per change (config rule); alternative = new `central-operaciones-ui` capability — question round 3 |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/app/globals.css` | Modified (additive) | +9 vars × 2 modes (surface/text/fill/border-strong) + 8 semantic vars + ~14 `@theme inline` mappings (+ shimmer keyframes if needed) |
| `src/components/operaciones/chip.tsx` | New | Toggle button, aria-pressed, mono, 32px |
| `src/components/operaciones/action-button.tsx` | New | Primary action, always `--marca`, min-h-11, disabled fill/text |
| `src/components/operaciones/toast.tsx` | New | `showToast()` singleton + single-instance host, 4.5s, Deshacer, aria-live |
| `src/components/operaciones/skeleton.tsx` | New | Shimmer 1.5s loop |
| `src/components/operaciones/empty-state.tsx` | New | CircleDashed → title → description → action |
| `tests/component/chip.test.tsx` | New | aria-pressed toggle, mono, onClick |
| `tests/component/action-button.test.tsx` | New | marca class, disabled state/classes, aria-label |
| `tests/component/toast.test.tsx` | New | fake-timer dismiss, replace-previous, Deshacer, aria-live |
| `tests/component/empty-state.test.tsx` | New | icon/title/description/action render (+ skeleton test folded) |
| `src/components/ui/*`, `src/app/layout.tsx`, fonts | Untouched | Additive-only constraint |

## Risks

| Risk | Tier | Mitigation |
|---|---|---|
| ~510 authored lines vs 400-line review budget | WARNING | Slice into 2 chained PRs: PR-A tokens + Chip + Skeleton + EmptyState + tests (~260), PR-B ActionButton + Toast + tests (~265); each under budget |
| Token value assumptions (surface/text/fill hexes) are proposal guesses — spec §5.1 names vars but the values live in the user spec, not in the repo | WARNING | Question round 1; spec phase pins exact values after sign-off |
| Inter/JetBrains Mono NOT loaded (layout uses Geist/Geist_Mono) — spec §5.2 wants them | WARNING | No new packages without sign-off; mono = Geist Mono for Chip; question round 2 |
| Main spec `central-operaciones-schema` not in working tree (lives on `chore/central-op-fase1-registro`) | NOTE | Delta spec written against canonical capability name; merge ordering: fase-1 registro branch lands before archive |
| Toast timing flakiness in tests | NOTE | vitest fake timers + `act`; 4.5s constant exported for test reference |
| `@theme inline` name collision (`text-primary` vs `text-text-primary`) | NOTE | Mapped names verified against existing `--color-*` set before spec; collision check in verify |

## Non-goals / Constraints

- No screens, no kanban, no realtime, no WhatsApp/ficha; no `/dashboard` changes; no `operaciones-dashboard.tsx` edits (its hardcoded dot colors are replaced by fase 3, not here).
- Do NOT modify existing `src/components/ui/*` shadcn components or their tokens; additive only.
- No new packages (no sonner, no fonts); no `@dnd-kit`; no CSS-in-JS.
- No full typography token system; no design-token export to TS (CSS vars only, read via `getComputedStyle` if ever needed).

## Rollback Plan

- Revert `globals.css` additions (delete appended vars + `@theme inline` lines): purely additive, no existing token touched — zero impact on other pages.
- Delete `src/components/operaciones/*` (5 files) + the 4 test files. No consumers exist yet (fase 3), so removal is trivially safe.
- If a token name collides at build time: remove only that mapping, keep the rest; verify suite + `npm run build`.

## Dependencies

- Fase-1 change archived (Engram #636); canonical spec `central-operaciones-schema` + `openspec/config.yaml` currently on branch `chore/central-op-fase1-registro` — merge/land before or alongside this change's archive.
- No new packages; vitest + testing-library + tw-animate-css + lucide-react already present (`CircleDashed` is a lucide icon).
- Delivery strategy: ask-always; 2 chained PRs planned (budget guard).

## Proposal question round

Assumptions needing user sign-off (all locked decisions from the orchestrator respected):

1. **Token VALUES** for surfaces/borders/text (spec §5.1 defines names + estado hexes only). Proposed light: surface-1 `#FFFFFF`, surface-2 `#F5F6F8`, surface-3 `#ECEEF2`, border-strong `#C6CCD4`, text-primary `#171A1F`, secondary `#4B5563`, muted `#8A94A3`, fill-disabled `#E5E7EB`, text-disabled `#9CA3AF`; dark: `#14161B`/`#1B1E25`/`#232731`/`#3B4250`/`#F3F4F6`/`#C6CBD4`/`#7C8494`/`#2A2F39`/`#5F6773`. Approve or provide the spec's real values.
2. **FONTS (WARNING)**: Inter + JetBrains Mono are NOT loaded; layout uses Geist + Geist_Mono via `next/font`. Keep Geist (Chip mono = Geist Mono, no new packages) vs add Inter/JetBrains Mono in a later fase. No font work in this fase either way.
3. **Capability mapping**: extend `central-operaciones-schema` (ADDED REQ-COS-8..12) vs new capability `central-operaciones-ui`. Chosen: extend (one capability per change).
4. **Primitives location + naming**: `src/components/operaciones/` (chosen) vs `src/components/ui/`; `ActionButton` (chosen) vs `PrimaryActionButton`/`OperacionButton`.
5. **Typography scope**: minimal (chosen — Tailwind defaults + `min-h-11` + Geist Mono) vs full token system now (adds ~60 lines, pushes PR-A over budget).

## Success Criteria

- [ ] New CSS vars present in `:root` + `.dark`; semantic colors identical across modes; all mapped to working Tailwind utilities (build compiles, `bg-marca` etc. resolve)
- [ ] Existing shadcn tokens byte-identical (diff check) — no clobber
- [ ] Chip: button + aria-pressed toggles; ActionButton: `#0C7C92` + disabled fill/text; Toast: single instance, 4.5s dismiss (fake-timer test), replaces previous, aria-live polite, Deshacer fires onAction; EmptyState renders icon/title/description/action — all `tests/component/` green
- [ ] No hardcoded hex in new components (grep check)
- [ ] Full suite green (`npm run test`); `npm run build` passes
- [ ] Authored lines split into 2 chained PRs, each under the 400-line budget