# Tasks: Central de Operaciones — Fase 2: Design tokens + UI primitives

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~270 (PR-A) + ~250 (PR-B) ≈ 520 total; each slice < 400 |
| 400-line budget risk | Low per slice (whole change sliced) |
| Chained PRs recommended | Yes |
| Suggested split | PR-A (tokens+fonts+Chip+Skeleton+EmptyState) → PR-B (ActionButton+Toast) |
| Delivery strategy | ask-on-risk (ask-always) |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

Whole change (~520) exceeds the 400-line budget → chained PRs. Delivery is ask-always, so the orchestrator confirms the chain strategy before apply (recommended: **stacked-to-main** — PR-A lands first, PR-B second; design requires PR-A to land before archive for merge ordering).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Tokens + fonts + Chip + Skeleton + EmptyState | PR-A | `npx vitest run tests/component/chip.test.tsx tests/component/empty-state.test.tsx` | `npm run build` — token utilities + `font-sans`/`font-mono` resolve | Revert layout swap + delete appended CSS vars/`@theme inline` lines + chip/skeleton/empty-state + 2 test files — no consumers |
| 2 | ActionButton + Toast | PR-B | `npx vitest run tests/component/action-button.test.tsx tests/component/toast.test.tsx` | `npm run test` + `npm run build` green | Delete action-button.tsx/toast.tsx + 2 test files — no consumers |

## PR-A — Tokens, fonts, Chip, Skeleton, EmptyState (~270 lines)

### A1 Foundation (no unit test — verified by build/grep/diff)

- [x] 1.1 `src/app/globals.css`: append 9 surface/text/fill vars + 8 semantic vars to `:root` and `.dark` (REQ-COS-8 locked values; semantic identical both modes; `--border` untouched) + 17 `--color-*` mappings + `--animate-shimmer`/`@keyframes shimmer` in `@theme inline`; flip L11 `--font-mono: var(--font-geist-mono)` → `var(--font-mono)` (design D4). Acceptance: vars match REQ-COS-8; no `--color-*` collision. Verify: `npm run build`; shadcn tokens byte-identical diff check.
- [x] 1.2 `src/app/layout.tsx`: swap `Geist`/`Geist_Mono` → `Inter` (`--font-sans`) + `JetBrains_Mono` (`--font-mono`) (REQ-COS-9). Acceptance: no Geist references; `font-sans`/`font-mono` resolve app-wide. Verify: `npm run build`; grep layout.tsx.

### A2 Primitives (strict TDD — RED then GREEN)

- [x] 1.3 RED `tests/component/chip.test.tsx`: aria-pressed flips + onToggle callback; two chips independent; classes `font-mono`/`min-h-11`/`bg-marca` (REQ-COS-10 S1/S2, REQ-COS-15). Verify: `npx vitest run tests/component/chip.test.tsx` fails. **Evidence**: RED confirmed — failed with `Failed to resolve import "@/components/operaciones/chip"` (file did not exist). 5 tests written first.
- [x] 1.4 GREEN `src/components/operaciones/chip.tsx` (create folder + file): toggle `<button aria-pressed>` `min-h-11 rounded-md font-mono`, tokens only (`bg-marca`/`border-border-strong`/`text-white`), `cn` from `@/lib/utils` (D9/D10). Verify: 1.3 passes. **Evidence**: `npx vitest run tests/component/chip.test.tsx` → 5/5 passed (stateful aria-pressed flip, callback with next state, individual toggle, selected/unselected token classes).
- [x] 1.5 RED `tests/component/empty-state.test.tsx` (Skeleton folded, REQ-COS-15): icon→title→desc→action order + size/tone classes; action optional; Skeleton `animate-shimmer` 1.5s + no spinner (REQ-COS-13/14). Verify: `npx vitest run tests/component/empty-state.test.tsx` fails. **Evidence**: RED confirmed — failed with `Failed to resolve import "@/components/operaciones/empty-state"` + `skeleton`. 4 tests written first.
- [x] 1.6 GREEN `src/components/operaciones/skeleton.tsx`: `<div aria-hidden className="animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-2),var(--surface-3),var(--surface-2))] bg-[length:200%_100%]">` (D5). Verify: 1.5 passes. **Evidence**: compiled CSS shows `.animate-shimmer{animation:shimmer 1.5s linear infinite}` + `@keyframes shimmer` emitted.
- [x] 1.7 GREEN `src/components/operaciones/empty-state.tsx`: CircleDashed `size-10 text-text-muted` → h3 15px/500 `text-text-primary` → p text-xs muted → optional action (REQ-COS-14). Verify: 1.5 passes. **Evidence**: `npx vitest run tests/component/empty-state.test.tsx` → 4/4 passed.
- [x] 1.8 PR-A gate: `npm run test` full suite + `npm run build` green; grep no `#` hex literal in `src/components/operaciones/*` (REQ-COS-8 no-hardcode). Verify: `npm run test`. **Evidence**: full suite 23 files / 248 tests passed (baseline was 21/239); `npx tsc --noEmit` exit 0; `npm run build` green (Compiled successfully, 12 routes); hex grep in `operaciones/*` = 0 matches; compiled CSS `.bg-marca{background-color:var(--marca)}`, `.bg-surface-2{background-color:var(--surface-2)}`; shadcn tokens byte-identical (git diff shows 65 insertions + 1 deletion only).

## PR-B — ActionButton + Toast (~250 lines)

- [x] 2.1 RED `tests/component/action-button.test.tsx`: `bg-marca`; disabled → `bg-fill-disabled`+`text-text-disabled`, `disabled` attr, ≥44px, click ignored; aria-label present (REQ-COS-11 S1–S3, REQ-COS-15). Verify: `npx vitest run tests/component/action-button.test.tsx` fails. **Evidence**: RED confirmed — failed with `Failed to resolve import "@/components/operaciones/action-button"` (file did not exist). 3 tests written first (S1 marca+44px+type, S2 disabled tokens+non-interactive, S3 aria-label).
- [x] 2.2 GREEN `src/components/operaciones/action-button.tsx`: standalone cva `bg-marca text-white min-h-11 rounded-md ... disabled:bg-fill-disabled disabled:text-text-disabled` (D7/D10). Verify: 2.1 passes. **Evidence**: `npx vitest run tests/component/action-button.test.tsx` → 3/3 passed. NOTE (deviation from design sketch): disabled tokens implemented as a cva `disabled` variant (`true: bg-fill-disabled text-text-disabled / false: bg-marca text-white`) instead of `disabled:`-prefixed Tailwind variants — the `disabled:` prefix stays literal in jsdom (no CSS evaluation), so REQ-COS-15's class assertions could never see the bare token classes; the variant approach lands literal classes while keeping D7 (standalone cva) and the disabled-tokens semantics.
- [x] 2.3 RED `tests/component/toast.test.tsx`: `vi.useFakeTimers()` — 4500ms dismiss; new showToast replaces + resets timer; Deshacer → onAction (success only; error renders no action label); container `aria-live="polite"` (REQ-COS-12 S1–S4, REQ-COS-15). Verify: `npx vitest run tests/component/toast.test.tsx` fails. **Evidence**: RED confirmed — failed with `Failed to resolve import "@/components/operaciones/toast"` (file did not exist). 5 tests written first; all timing via fake timers + `act()` (REQ-COS-15), module state reset in `afterEach` via `dismissToast()`.
- [x] 2.4 GREEN `src/components/operaciones/toast.tsx`: module singleton `showToast()` + `<ToastHost/>` via `useSyncExternalStore`; `TOAST_DURATION_MS = 4500`; fixed `inset-x-3 bottom-[66px] z-50`, `aria-live="polite"` `role="status"`; action only when `tone==='success'` (D6). Verify: 2.3 passes. **Evidence**: `npx vitest run tests/component/toast.test.tsx` → 5/5 passed. Bonus: exported `dismissToast()` (clears timer + state) — used by tests for isolation and by the Deshacer action after `onAction`.
- [x] 2.5 PR-B gate: `npm run test` + `npm run build` green; grep no hex in new files. Verify: `npm run test`. **Evidence**: full suite 25 files / 256 tests passed (baseline after PR-A was 23/248; +8 = 3 ActionButton + 5 Toast); `npx tsc --noEmit` exit 0; `npm run build` green (Compiled successfully, 22 routes); hex grep in `operaciones/*` = 0 matches; compiled CSS proves `.bg-marca{background-color:var(--marca)}`, `.bg-fill-disabled{background-color:var(--fill-disabled)}`, `.text-text-disabled{color:var(--text-disabled)}`, `.text-marca{color:var(--marca)}`, and `@media (prefers-reduced-motion:reduce){.motion-reduce\:animate-none{animation:none}}` all emitted.

### Bonus (4R R4-001): Skeleton reduced-motion guard

- [x] Skeleton shimmer now stops under `prefers-reduced-motion`: `motion-reduce:animate-none` added to `skeleton.tsx` (Tailwind v4 built-in variant; no globals.css change needed). RED: `empty-state.test.tsx` extended with `expect(shimmer).toHaveClass('motion-reduce:animate-none')` → failed (class absent). GREEN: class added → 4/4 passed. Compiled CSS confirms the rule inside `@media (prefers-reduced-motion:reduce)`.

## Requirement Traceability (REQ-COS-8..15)

| Req | Tasks |
|-----|-------|
| REQ-COS-8 tokens | 1.1, 1.8 |
| REQ-COS-9 fonts | 1.2 (+ 1.3/1.4 `font-mono` assert) |
| REQ-COS-10 Chip | 1.3, 1.4 |
| REQ-COS-11 ActionButton | 2.1, 2.2 |
| REQ-COS-12 Toast | 2.3, 2.4 |
| REQ-COS-13 Skeleton | 1.5, 1.6 |
| REQ-COS-14 EmptyState | 1.5, 1.7 |
| REQ-COS-15 test contract | 1.3, 1.5, 2.1, 2.3 (+ gates 1.8/2.5) |

## Dependencies & Rollback

- 1.4 ← 1.3; 1.6/1.7 ← 1.5; 2.2 ← 2.1; 2.4 ← 2.3; PR-B ← PR-A (independent, but design requires PR-A to land before archive — merge ordering).
- Rollback per PR: delete additive files/lines only; no consumers exist (fase 3), trivially safe.
- Note: `openspec/config.yaml` absent from working tree (lives on `chore/central-op-fase1-registro`); tasks rules applied per orchestrator brief — strict TDD pairing, `test_command: "npm run test"`.