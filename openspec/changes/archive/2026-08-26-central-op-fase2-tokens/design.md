# Design: Central de Operaciones — Fase 2: Design tokens + UI primitives

## Technical Approach

Additive visual foundation consumed by fase 3: append 17 CSS custom properties to `:root`/`.dark` in `src/app/globals.css` (exact values from REQ-COS-8), map them through `@theme inline` `--color-*` entries so Tailwind v4 generates utilities (`bg-marca`, `text-text-secondary`, `border-border-strong`, …), swap Geist→Inter/JetBrains Mono in `layout.tsx` (REQ-COS-9), and ship five token-only primitives under `src/components/operaciones/` (REQ-COS-10..14) with strict-TDD component tests (REQ-COS-15). Existing shadcn tokens stay byte-identical; no new packages; no screens.

## Architecture Decisions

| # | Decision | Choice | Alternatives | Rationale |
|---|---|---|---|---|
| D1 | Token mechanism | CSS vars + `@theme inline` `--color-*` mapping | Plain classes; TS export | Project's existing Tailwind v4 mechanism; utilities generated for free; additive, no clobber |
| D2 | `--border-strong` | New var (light `#D4D4D8` / dark `#3F3F46`) | Redefine `--border` | Spec locks values; `--border` is reused untouched (REQ-COS-8). `border-strong` = emphasis border, chips/emphasis use it |
| D3 | Dark mode | Class strategy `dark` (existing `@custom-variant dark (&:is(.dark *))`) | media query | Already wired; tokens append to `.dark`; no ThemeProvider toggles `.dark` yet — dormant, additive-safe |
| D4 | Fonts | `Inter` → `variable: '--font-sans'`, `JetBrains_Mono` → `variable: '--font-mono'` | Keep Geist | Locked decision #1. Also FIXES latent bug: line 10 maps `--font-sans: var(--font-sans)` but Geist sets `--font-geist-sans` → sans never resolved; line 11 must flip `var(--font-geist-mono)` → `var(--font-mono)` |
| D5 | Skeleton shimmer | Additive `@keyframes shimmer` + `--animate-shimmer` | tw-animate-css; shadcn `shimmer` utility | tw-animate-css has no shimmer keyframes (verified); shadcn `shimmer` is `background-clip: text` — invisible on blocks |
| D6 | Toast state | Module singleton + `useSyncExternalStore` + `<ToastHost/>` | Context/provider | No plumbing; fase 3 call sites call `showToast()`; singleton state lives at module scope |
| D7 | ActionButton | Standalone cva, NOT `buttonVariants` | Reuse shadcn variants | Disabled = fill/text tokens, shadcn uses `opacity-50`; composition would fight the variant system |
| D8 | Primitives location | `src/components/operaciones/` | `ui/` | Domain-folder convention (dashboard/, scanner/, reportes/); `ui/` is generated shadcn — pristine |
| D9 | Chip radius/height | `rounded-md` (=8px via `--radius-md`), `min-h-11` (44px) | 32px proposal | Locked decision #4 (44px); proposal's 8px radius maps to `rounded-md` in this theme |
| D10 | Foreground on marca | `text-white` utility | `--primary-foreground` | White on `#0C7C92` AA-passing; utility, not a hex literal — satisfies no-hardcode rule |

## Data Flow

    Caller (fase 3) ──showToast({message, actionLabel?, onAction?, tone})──▶ toast.tsx module
         │  sets module state + restarts 4.5s timer (clearTimeout + setTimeout)
         ▼
    ToastHost (useSyncExternalStore) ──re-renders──▶ single fixed toast (bottom, aria-live=polite)
         │                                                    │
         └────────── new showToast() replaces state ───────────┘  (timer reset)

## File Changes

| File | Action | Description |
|---|---|---|
| `src/app/globals.css` | Modify | Append 9 surface/text/fill vars + 8 semantic vars to `:root` and `.dark`; add 17 `--color-*` entries + `--animate-shimmer` + `@keyframes shimmer` to `@theme inline`; flip line 11 `--font-mono` to `var(--font-mono)` |
| `src/app/layout.tsx` | Modify | Replace `Geist`/`Geist_Mono` with `Inter` (`--font-sans`) + `JetBrains_Mono` (`--font-mono`) |
| `src/components/operaciones/chip.tsx` | Create | Toggle button, `aria-pressed`, mono, 44px |
| `src/components/operaciones/action-button.tsx` | Create | Always-marca primary action, disabled fill/text |
| `src/components/operaciones/toast.tsx` | Create | `showToast()` singleton + `ToastHost`, 4.5s, Deshacer, `aria-live` |
| `src/components/operaciones/skeleton.tsx` | Create | Shimmer 1.5s loop |
| `src/components/operaciones/empty-state.tsx` | Create | CircleDashed → title → description → action |
| `tests/component/chip.test.tsx` | Create | aria-pressed toggle, callback, mono, 44px |
| `tests/component/action-button.test.tsx` | Create | marca/disabled classes, aria-label |
| `tests/component/toast.test.tsx` | Create | fake timers, replace, Deshacer, aria-live |
| `tests/component/empty-state.test.tsx` | Create | order + Skeleton folded (REQ-COS-15) |

## Interfaces / Contracts

```css
/* globals.css — appended to :root and .dark (values per REQ-COS-8) */
--surface-1 --surface-2 --surface-3 --border-strong --text-primary
--text-secondary --text-muted --fill-disabled --text-disabled   /* per-mode */
--estado-recibido --estado-recarga --estado-listo --estado-delivery
--estado-entregado --marca --urgencia --whatsapp                 /* identical both modes */

/* @theme inline additions */
--color-surface-1: var(--surface-1);  --color-surface-2: var(--surface-2);
--color-surface-3: var(--surface-3);  --color-border-strong: var(--border-strong);
--color-text-primary: var(--text-primary); --color-text-secondary: var(--text-secondary);
--color-text-muted: var(--text-muted); --color-fill-disabled: var(--fill-disabled);
--color-text-disabled: var(--text-disabled); --color-estado-recibido: var(--estado-recibido);
--color-estado-recarga: var(--estado-recarga); --color-estado-listo: var(--estado-listo);
--color-estado-delivery: var(--estado-delivery); --color-estado-entregado: var(--estado-entregado);
--color-marca: var(--marca); --color-urgencia: var(--urgencia); --color-whatsapp: var(--whatsapp);
--animate-shimmer: shimmer 1.5s linear infinite;
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
```

Collision check vs existing `--color-*` (background, foreground, primary, secondary, muted, border, …): `text-text-primary` ≠ `text-primary`, `bg-fill-disabled`/`border-border-strong`/`bg-marca` all novel — no clobber. Utility names match spec REQ-COS-8 verbatim.

```tsx
// layout.tsx swap (REQ-COS-9)
import { Inter, JetBrains_Mono } from 'next/font/google';
const inter = Inter({ variable: '--font-sans', subsets: ['latin'] });
const jetbrainsMono = JetBrains_Mono({ variable: '--font-mono', subsets: ['latin'] });
// <html className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
```

```tsx
// Chip — src/components/operaciones/chip.tsx
type ChipProps = { label: string; pressed: boolean; onToggle: (next: boolean) => void; className?: string };
// <button type="button" aria-pressed={pressed} onClick={() => onToggle(!pressed)}
//   className={cn('font-mono min-h-11 rounded-md border px-2.5 text-sm transition-colors',
//     pressed ? 'border-marca bg-marca text-white' : 'border-border-strong bg-surface-2 text-text-secondary hover:bg-surface-3', className)}>

// ActionButton — src/components/operaciones/action-button.tsx
type ActionButtonProps = { children: ReactNode; disabled?: boolean; 'aria-label'?: string; onClick?: () => void; className?: string };
// cva base: 'inline-flex min-h-11 items-center justify-center rounded-md bg-marca px-4 text-sm font-medium
//   text-white transition-colors disabled:bg-fill-disabled disabled:text-text-disabled'
// <button type="button" disabled={disabled} aria-label={ariaLabel} ...>

// Toast — src/components/operaciones/toast.tsx
export const TOAST_DURATION_MS = 4500;
type ToastInput = { message: string; actionLabel?: string; onAction?: () => void; tone: 'success' | 'error' };
export function showToast(input: ToastInput): void;   // module singleton; replaces; resets 4.5s timer
export function ToastHost(): ReactNode;               // useSyncExternalStore; null when no toast
// container: fixed inset-x-3 bottom-[66px] z-50, aria-live="polite" role="status";
// action button rendered only when tone==='success' && actionLabel; onClick → onAction() then dismiss

// Skeleton — src/components/operaciones/skeleton.tsx
// <div aria-hidden className={cn('animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-2),var(--surface-3),var(--surface-2))] bg-[length:200%_100%]', className)} />

// EmptyState — src/components/operaciones/empty-state.tsx
type EmptyStateProps = { title: string; description?: string; action?: ReactNode; className?: string };
// <CircleDashed className="size-10 text-text-muted" /> → <h3 className="text-[15px] font-medium text-text-primary">
// → <p className="text-xs text-text-muted"> → {action}   (fixed order; no hex literals)
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Component | Chip toggle/aria-pressed/mono/44px | `chip.test.tsx`: assert `aria-pressed` flips + callback; two chips independent; class assertions `font-mono`, `min-h-11`, `bg-marca` |
| Component | ActionButton marca/disabled/aria-label | `action-button.test.tsx`: `bg-marca` class; disabled → `bg-fill-disabled`+`text-text-disabled` classes, `disabled` attr, ≥44px, click ignored |
| Component | Toast lifecycle | `toast.test.tsx`: `vi.useFakeTimers()`; advance 4500 → removed; second `showToast` replaces + resets; Deshacer → `onAction`; error tone → no action label; container `aria-live="polite"` |
| Component | EmptyState order + Skeleton | `empty-state.test.tsx`: icon→title→desc→action order + size/tone classes; no action → absent; Skeleton folded: `animate-shimmer` class, no spinner/icon |
| Static | No hardcoded hex in `operaciones/*` | Verify-phase grep: no `#` color literal |
| Build | Token utilities resolve | `npm run build`; `npm run test` full suite green; shadcn vars byte-identical (diff check) |

Fake timers mandatory for toast timing (REQ-COS-15) — no real waits; wrap timer advance in `act()`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Chained-PR Slice Plan (delivery strategy: ask-always → 2 chained PRs)

| Slice | Commits (work units) | Est. lines |
|---|---|---|
| **PR-A** (~270) | 1. `feat(tokens): additive design tokens + @theme inline mappings` (globals.css) · 2. `feat(fonts): swap Geist for Inter + JetBrains Mono` (layout.tsx + `--font-mono` line) · 3. `feat(ui): Chip toggle primitive + tests` · 4. `feat(ui): Skeleton + EmptyState primitives + tests` (shared test file, REQ-COS-15) | < 400 |
| **PR-B** (~250) | 5. `feat(ui): ActionButton primary action + tests` · 6. `feat(ui): Toast singleton + host + tests` | < 400 |

Each slice: autonomous scope, own verification (`npm run test`), trivial rollback (delete additive files/lines). PR #1 must land before archive (merge-ordering risk below).

## Per-Requirement Verification Matrix

| Req | Verification |
|---|---|
| REQ-COS-8 | Spec values in `:root`/`.dark`; semantic identical both modes; `@theme inline` mappings; grep no hex in components; shadcn diff check |
| REQ-COS-9 | layout.tsx uses Inter/JetBrains_Mono only; `--font-sans`/`--font-mono` resolve app-wide (build + font-mono class on Chip) |
| REQ-COS-10 | `chip.test.tsx` (toggle, individual, ≥44px, mono) |
| REQ-COS-11 | `action-button.test.tsx` (marca both modes via class, disabled tokens ≥44px non-interactive, aria-label) |
| REQ-COS-12 | `toast.test.tsx` (replace+reset, 4.5s fake timers, Deshacer success-only, aria-live) |
| REQ-COS-13 | `empty-state.test.tsx` folded: `animate-shimmer` + 1.5s, no spinner |
| REQ-COS-14 | `empty-state.test.tsx` (order, sizes/tones classes, action optional) |
| REQ-COS-15 | All 4 test files present, fake timers for toast, suite green |

## Migration / Rollout

No migration. Purely additive: fonts swap is the only app-wide visual change (documented, locked decision #1). Rollback = delete appended CSS/lines + 5 component files + 4 test files; no consumers exist yet (fase 3).

## Open Questions

- [ ] Toast host mount point: not mounted this fase (no screens); fase 3 decides (root layout vs PwaShell). Tests mount `<ToastHost/>` directly.
- [ ] `--border-strong` usage: locked interpretation = emphasis border (light `#D4D4D8` zinc-300 / dark `#3F3F46` zinc-700); Chip unselected + any strong dividers use it. Confirm at review.
- [ ] Merge ordering (risk): canonical `central-operaciones-schema` spec lives on `chore/central-op-fase1-registro` — PR #1 must land before archive so the delta merges onto the real canonical spec; if registro lags, archive blocks.