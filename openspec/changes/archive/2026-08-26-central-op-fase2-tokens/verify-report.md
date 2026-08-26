```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:9267a1ac7e1cde2c7ab55bc7dd082af7b204c04c59ead1c64a16f336f554732a
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 20/20
test_command: npm run test
test_exit_code: 0
test_output_hash: sha256:9267a1ac7e1cde2c7ab55bc7dd082af7b204c04c59ead1c64a16f336f554732a
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verification Report — central-op-fase2-tokens

- **Change**: `central-op-fase2-tokens`
- **Mode**: Strict TDD (active — `npm run test`) · hybrid persistence (openspec file + Engram topic `sdd/central-op-fase2-tokens/verify-report`)
- **Verdict**: **PASS WITH WARNINGS** — all 8 requirements / 20 scenarios compliant; full suite green; build + type-check green; shadcn tokens byte-identical. Warnings are one new auto-fixable lint error (`prefer-const`) plus the two carried review follow-ups (R3-001 toast-undo same-tick dismiss — no consumers yet, fase 3; R2-001/R2-002 token naming — spec-faithful). Nothing blocks archive.
- **Next recommended**: `archive`
- **Verified against**: proposal.md, specs/central-operaciones-schema/spec.md delta (REQ-COS-8..15), design.md (D1–D10), tasks.md (13/13 `[x]` + R4-001 bonus), apply-progress (Engram #641), canonical fase-1 spec via `git show chore/central-op-fase1-registro` (REQ-COS-1..7 baseline).

## Completeness

| Check | Status | Details |
|---|---|---|
| Tasks (tasks.md) | ✅ 14/14 | 1.1–1.8 (PR-A), 2.1–2.5 (PR-B), all `[x]`; plus R4-001 bonus (Skeleton reduced-motion) `[x]` |
| Commits (branch `redesign/central-operaciones`, HEAD `da9acd3`) | ✅ 5 | `6738a23` PR-A tokens/fonts/primitives · `2faf7c5` PR-B ActionButton/Toast · `971efa2` R4-001 motion-reduce fix · `fb809bd` audit artifacts · `da9acd3` tasks complete |
| Proposal | ✅ | Intent/scope match implementation |
| Specs | ✅ | 1 delta spec (all ADDED); **8 requirements, 20 scenarios** counted from the file |
| Design | ✅ | D1–D10 followed (see coherence table); 2 documented non-blocking deviations |
| Shadcn baseline | ✅ | `git diff 6738a23^ HEAD -- src/app/globals.css` = **65 insertions + 1 deletion only**; the single deletion is the `--font-mono: var(--font-geist-mono)` → `var(--font-mono)` flip (design D4 fix). Every pre-existing shadcn token and `--color-*` entry byte-identical — zero clobber |
| Apply evidence | ✅ | Engram #641 — explicit "TDD Cycle Evidence" table (RED import-fail per task, GREEN counts, triangulation, safety net) |
| Review receipts | ✅ | `review-b8e3ce7cc5de60d0` (PR-A, high risk, 4 lenses) and `review-076ecb0727252f1a` (PR-B, medium, reliability) both `terminal_state: "approved"`, state records `"state": "approved"`; R4-001 WARNING closed by fix `971efa2` |
| Working tree | ✅ | clean at HEAD `da9acd3` (PR-B committed; nothing pending) |

## Runtime Evidence

| Command | Result | Evidence |
|---|---|---|
| `npm run test` | ✅ **256/256 passed (25 files)** — exit 0 | Expected totals matched exactly (25 files / 256 tests); output hash `9267A1AC7E1CDE2C7AB55BC7DD082AF7B204C04C59EAD1C64A16F336F554732A`. The Vite `configLoader: 'native'` notice is the same pre-existing config-style warning noted in apply-progress, not an error |
| `npx tsc --noEmit` | ✅ clean — exit 0, empty output | output hash `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` (sha256 of empty output) |
| `npm run build` | ✅ green — exit 0 (22 routes) | output hash `C2A8A236407153CA7766C556FAA26B01DBF1E575E5C7490B0CBCFC5668D7B3A1` |
| Compiled CSS (fresh build) | ✅ utilities resolve | `.bg-marca{background-color:var(--marca)}`, `.bg-fill-disabled{background-color:var(--fill-disabled)}`, `.text-text-disabled{color:var(--text-disabled)}`, `.text-marca{color:var(--marca)}`, `.text-text-primary{color:var(--text-primary)}`, `.bg-surface-2{background-color:var(--surface-2)}`, `.animate-shimmer{animation:shimmer 1.5s linear infinite}`, `@keyframes shimmer`, and `@media (prefers-reduced-motion:reduce){.motion-reduce\:animate-none{animation:none}}` all emitted |
| Hex grep `src/components/operaciones/*` | ✅ 0 matches | no `#` color literal in any new component |
| Geist grep (`layout.tsx`, `globals.css`) | ✅ 0 matches | Inter/JetBrains Mono only |

All executed fresh in this verify pass (2026-08-26, 18:02).

## Spec Compliance Matrix

Counted from the delta spec file: **8 requirements, 20 scenarios**.

| Requirement | Status | Evidence |
|---|---|---|
| REQ-COS-8 — Additive design tokens | ✅ PASS | globals.css `:root`/`.dark` values match spec §5.1 exactly (9 per-mode + 8 semantic, semantic identical both modes); `--border` untouched; 17 `--color-*` mappings + `--animate-shimmer`/`@keyframes shimmer` in `@theme inline`; diff vs shadcn baseline = 65 insertions + 1 deletion only; 0 hex in components |
| REQ-COS-9 — Inter + JetBrains Mono | ✅ PASS | `layout.tsx` imports `Inter`/`JetBrains_Mono` from `next/font/google` with `variable: '--font-sans'`/`'--font-mono'`; zero Geist references; `@theme inline` L10-11 map both vars; `@layer base` `html { @apply font-sans }`; Chip test asserts `font-mono` |
| REQ-COS-10 — Chip toggle primitive | ✅ PASS | `chip.test.tsx` 5/5: aria-pressed flip via caller state, callback with next state, individual toggle (two chips), `font-mono`/`min-h-11` classes, token classes selected/unselected |
| REQ-COS-11 — ActionButton | ✅ PASS | `action-button.test.tsx` 3/3: `bg-marca` + `min-h-11` + `type="button"`; disabled → `bg-fill-disabled`/`text-text-disabled` + `min-h-11` + `toBeDisabled` + click ignored; `aria-label` exposed |
| REQ-COS-12 — Toast singleton | ✅ PASS | `toast.test.tsx` 5/5: replace + timer reset, fake-timer dismiss at exactly 4500ms, Deshacer fires `onAction` (success only), error tone renders no action, container `aria-live="polite"` `role="status"`; position `fixed inset-x-3 bottom-[66px] z-50` in source |
| REQ-COS-13 — Skeleton shimmer | ✅ PASS | `empty-state.test.tsx` (Skeleton describe) 2/2: `animate-shimmer` + `motion-reduce:animate-none` + `aria-hidden` + className merge; no spinner/icon/text; 1.5s duration proven by compiled CSS `.animate-shimmer{animation:shimmer 1.5s linear infinite}` |
| REQ-COS-14 — EmptyState | ✅ PASS | `empty-state.test.tsx` (EmptyState describe) 2/2: icon (`CircleDashed` `size-10`=40px `text-text-muted`) → h3 (`text-[15px] font-medium text-text-primary`) → p (`text-xs text-text-muted`) → action in document order; action optional |
| REQ-COS-15 — Component test contract | ✅ PASS | 4 files in `tests/component/` (`chip`, `action-button`, `toast`, `empty-state` incl. Skeleton folded per spec), 17 tests, all green; toast timing exclusively `vi.useFakeTimers()` + `act()` — no real waits |

| Scenario | Status | Covering test / evidence |
|---|---|---|
| COS-8·S1 — Locked values applied per mode | ✅ PASS | globals.css L113-129 / L165-181: all 17 values equal spec locked values; semantic 8 identical across modes (source; CSS vars not runtime-assertable in jsdom — design D1 verification via build/diff/grep) |
| COS-8·S2 — No shadcn clobber | ✅ PASS | `git diff 6738a23^ HEAD -- src/app/globals.css`: 65 insertions + 1 deletion; deletion = `--font-mono` flip only; all `--background`/`--border`/`--color-*` shadcn entries byte-identical |
| COS-8·S3 — Utilities resolve | ✅ PASS | Fresh build compiled CSS emits `.bg-marca`, `.text-text-primary`, `.bg-surface-2`, `.bg-fill-disabled`, `.text-text-disabled`, `.text-marca` → `var()` forms; suite green |
| COS-8·S4 — No hardcoded hex in new components | ✅ PASS | Grep `src/components/operaciones/*.tsx` for `#[0-9A-Fa-f]{3,8}` → 0 matches |
| COS-9·S1 — Layout swaps fonts | ✅ PASS | layout.tsx L2/L7-15: `next/font/google` Inter + JetBrains_Mono; Geist grep → 0 |
| COS-9·S2 — Font variables resolve app-wide | ✅ PASS | Build green; `@theme inline` `--font-sans`/`--font-mono` map; `html { @apply font-sans }`; Chip test asserts `font-mono` class |
| COS-10·S1 — Toggles on click | ✅ PASS | chip.test.tsx L32-41 (stateful flip) + L43-52 (callback with `true`) |
| COS-10·S2 — Individual toggle and target size | ✅ PASS | chip.test.tsx L74-92 (first clicked twice, only first flips; second never `bg-marca`) + L24-30 (`min-h-11`) |
| COS-11·S1 — Always marca | ✅ PASS | action-button.test.tsx L11-18 (`bg-marca` + `min-h-11`); source cva `false` variant `bg-marca text-white` (applies in both modes — class, not mode-scoped) |
| COS-11·S2 — Disabled uses fill/text tokens | ✅ PASS | action-button.test.tsx L20-36 (`bg-fill-disabled`/`text-text-disabled`, `min-h-11`, `toBeDisabled`, click ignored); cva `true` variant |
| COS-11·S3 — Accessible label | ✅ PASS | action-button.test.tsx L38-48 (accessible name) |
| COS-12·S1 — New toast replaces previous | ✅ PASS | toast.test.tsx L48-69 (first gone, second visible, timer reset proven at t+5000) |
| COS-12·S2 — Auto-dismiss after 4.5s | ✅ PASS | toast.test.tsx L34-46 (visible at 4499ms, removed at 4500ms, fake timers) |
| COS-12·S3 — Undo only for success | ✅ PASS | toast.test.tsx L71-88 (Deshacer → `onAction` once + dismiss) + L90-103 (error tone renders no action despite props) |
| COS-12·S4 — Polite live region | ✅ PASS | toast.test.tsx L24-32 (`role="status"` has `aria-live="polite"`); source L92-95 |
| COS-13·S1 — Shimmer placeholder | ✅ PASS | empty-state.test.tsx L44-63 (shimmer class, no spinner/icon/text); 1.5s via compiled CSS |
| COS-14·S1 — Elements in order | ✅ PASS | empty-state.test.tsx L7-30 (document-position ordering + `size-10`/`text-[15px]`/`font-medium`/`text-xs` tone classes) |
| COS-14·S2 — Action optional | ✅ PASS | empty-state.test.tsx L32-40 (no button rendered; title/description unchanged) |
| COS-15·S1 — Files cover all primitives | ✅ PASS | 4 test files present, 17 tests pass in the 256-test suite |
| COS-15·S2 — Timing via fake timers | ✅ PASS | toast.test.tsx uses `vi.useFakeTimers()` + `act()` throughout; `afterEach` restores real timers; no real waits |

**Compliance summary**: 20/20 scenarios compliant (component tests + build/compiled-CSS + git-diff evidence; CSS-var scenarios verified statically per design D1's verification strategy).

## Design Coherence

| Decision | Followed? | Notes |
|---|---|---|
| D1 — CSS vars + `@theme inline` `--color-*` | ✅ | 17 mappings; utilities compile and resolve |
| D2 — `--border-strong` new var, `--border` reused | ✅ | `--border` untouched; `border-border-strong` used by Chip unselected + Toast card |
| D3 — Class-strategy dark | ✅ | Tokens appended to `.dark`; `@custom-variant dark` unchanged |
| D4 — Inter/JetBrains Mono + `--font-mono` flip | ✅ | Flip at globals.css L11 (the only deletion in the whole change); layout swap correct |
| D5 — Skeleton additive shimmer | ✅ | `--animate-shimmer`/`@keyframes shimmer`; no tw-animate-css/shading reliance; + R4-001 `motion-reduce:animate-none` |
| D6 — Toast module singleton + `useSyncExternalStore` | ✅ | `showToast`/`ToastHost`/`dismissToast` at module scope; no context plumbing |
| D7 — Standalone cva, not `buttonVariants` | ✅ | `actionButtonVariants` local; shadcn `buttonVariants` untouched |
| D8 — Primitives in `src/components/operaciones/` | ✅ | All 5 primitives there; `ui/` pristine |
| D9 — `rounded-md` + `min-h-11` (44px) | ✅ | Chip, ActionButton, Toast card all `min-h-11` |
| D10 — `text-white` foreground on marca | ✅ | Utility (not hex) — satisfies no-hardcode rule; documented AA-passing choice |

**Deviations** (both non-blocking, documented in tasks.md/apply-progress):
1. **ActionButton disabled styling (design sketch → cva variant)** — sketch's `disabled:`-prefixed Tailwind variants stay literal in jsdom (no CSS evaluation), so REQ-COS-15's mandated class assertions could never match. Implemented as a cva `disabled` variant (`true/false`) producing literal `bg-fill-disabled`/`text-text-disabled` classes. Preserves D7 and the disabled-tokens semantics; same runtime result; testable per spec.
2. **Toast extras beyond sketch** — exported `dismissToast()` (test isolation + post-action dismiss), card styled with tokens (`bg-surface-1`/`border-border-strong`/`text-text-primary`/`shadow-lg`), `pointer-events-none` outer container + `pointer-events-auto` card so taps pass through around the toast. All token-only.

## Review Receipt Cross-Check

| Receipt | State | Risk | Carried findings |
|---|---|---|---|
| `review-b8e3ce7cc5de60d0` (PR-A) | ✅ `approved` | high | R4-001 WARNING → **fixed** (`971efa2` + test assert + compiled media query); R2-001/R2-002 WARNINGs → spec-faithful (carried); 7 SUGGESTIONs (R2-003..007, R4-002/003) → non-blocking |
| `review-076ecb0727252f1a` (PR-B) | ✅ `approved` | medium | R3-001 WARNING → no consumers yet, fase-3 fix (carried); R3-002 SUGGESTION (dismissToast not directly asserted) |

## Strict TDD Compliance (mode active — vitest)

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ✅ | apply-progress Engram #641 — explicit "TDD Cycle Evidence" table |
| All tasks have tests | ✅ | 4 test files cover all 5 primitives (Skeleton folded into `empty-state.test.tsx` per REQ-COS-15); tasks 1.1/1.2 (CSS/fonts) + gates verified by build/diff/grep per design |
| RED confirmed (tests exist) | ✅ | 4/4 test files exist; RED import-fail documented per task (1.3, 1.5, 2.1, 2.3) |
| GREEN confirmed (tests pass) | ✅ | 17/17 new tests pass on execution (5+3+5+4); full suite 256/256 |
| Triangulation adequate | ✅ | Chip 5 cases (state flip, callback arg, classes, independence), ActionButton 3 (S1/S2/S3), Toast 5 (live region, exact-4500ms boundary, replace+reset, undo fires, error no-undo), EmptyState+Skeleton 4; R4-001 single-case (one rule) documented |
| Safety Net for modified files | ✅ | All test files new (N/A); R4-001 ran against 23/248 suite baseline (documented) |
| Assertion quality | ✅ | No tautologies, no ghost loops, no smoke-only, no type-only-alone, no mock-heavy (vi.fn() only as controlled callbacks); class assertions are spec-mandated by REQ-COS-15 |

**TDD Compliance**: 7/7 checks passed

---

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Component (this change) | 17 | 4 (`chip`, `action-button`, `toast`, `empty-state`) | vitest + RTL + user-event, jsdom |
| Pre-existing suites | 239 | 21 | vitest |
| **Total** | **256** | **25** | |

(The 4 new files render components and assert behavior via RTL — integration-layer indicators per the strict module taxonomy; the project's `tests/component/` convention labels them component tests.)

---

### Changed File Coverage

Coverage analysis skipped — no coverage provider configured in `vitest.config.ts` (informational per strict module, not a failure).

---

### Assertion Quality

**Assertion quality**: ✅ All assertions verify real behavior (17/17 tests assert DOM behavior or spec-mandated classes; no trivial assertions found).

---

### Quality Metrics

**Linter** (`npx eslint` on the 10 changed files): ❌ 1 error → **W-1** (`toast.tsx:23` `prefer-const` — `let listeners` never reassigned; auto-fixable one-char). Whole-project `npm run lint` shows 5 errors total — the other 4 (`no-this-alias` at L1:3938 in a vendored file, 3× `react-hooks/set-state-in-effect` in pre-existing files) are pre-existing and unrelated.
**Type Checker** (`npx tsc --noEmit`): ✅ No errors, exit 0.

## Issues

### CRITICAL
None.

### WARNING
1. **W-1 (this change, non-blocking)** — `src/components/operaciones/toast.tsx:23`: `let listeners = new Set<...>()` is never reassigned → eslint `prefer-const` error, exit 1 on `npm run lint`. Auto-fixable (`let` → `const`); quality metric only, does not block archive. Recommend fixing in the fase-3 toast touch (R3-001) or immediately.
2. **W-2 (carried from review R3-001, fase-3 fix)** — `toast.tsx:102-105`: activating Deshacer runs `onAction()` then `dismissToast()` unconditionally, so a toast shown inside `onAction` via `showToast()` is cleared in the same tick and never displays its 4.5s. Violates the visible-duration contract for the natural undo-confirmation pattern. **No consumers exist yet** (fase 3 wires call sites) — latent, not live. Fix in fase 3.
3. **W-3 (carried from review R2-001/R2-002, spec-faithful — do NOT change)** — Token namespace: light-mode `--text-muted` equals `--text-disabled` (#A1A1AA) while dark differentiates them, and the token namespace mixes Spanish domain vocabulary (`--marca`, `--estado-*`, `--urgencia`, `--whatsapp`) with English. Both match the user's locked spec §5.1 exactly; `--marca` duplicating `--estado-recarga` is the locked domain vocabulary. Document intent in fase-3 work rather than renaming.

### SUGGESTION
1. **S-1** — `dismissToast()` exported contract (dismissed toast stays gone after the 4.5s window) has no direct focused assertion; the Deshacer test exercises it indirectly. Add a direct assertion when fase 3 touches the toast module (review R3-002).
2. **S-2** — Skeleton tests live inside `empty-state.test.tsx` — file name hides half its coverage (REQ-COS-15 mandates this exact folding, so it is spec-correct; a rename/comment could improve discoverability).
3. **S-3** — Skeleton uses raw `var()` arbitrary values for the shimmer gradient instead of mapped utilities (`bg-[linear-gradient(90deg,var(--surface-2),...)`); works and is token-driven, but bypasses the `--color-*` mapping layer (review R2-005).
4. **S-4** — EmptyState has no internal spacing contract (bare stacked blocks); every caller must re-implement spacing — decide a flex/gap contract in fase 3 (review R2-007).
5. **S-5** — `text-white` on pressed Chip is a Tailwind default, not a project token (review R2-004). Design D10 documents it as deliberate (AA-passing on `#0C7C92`, satisfies no-hex rule); a `--marca-foreground` token could be added in fase 3 if the "tokens only" contract is tightened.
6. **S-6** — Dark mode is dormant (no ThemeProvider toggles `.dark` today); tokens are additive and would switch coherently — confirm in fase 3 when screens consume them (review R4-003).

## Conclusion

Implementation matches the specs (8 requirements, 20 scenarios), the design (D1–D10, with 2 documented non-blocking deviations), and all 14 task rows (13 numbered + R4-001 bonus) are complete. Full suite **256/256 (25 files)** — exactly the expected totals — `tsc --noEmit` clean, `npm run build` green, fresh in this verify pass. Shadcn tokens are byte-identical (65 insertions + 1 deletion in globals.css; the deletion is the designed `--font-mono` fix), zero hex literals in the new components, zero Geist references, and the compiled CSS proves every new utility (`bg-marca`, `bg-fill-disabled`, `text-text-disabled`, `text-marca`, `text-text-primary`, `bg-surface-2`), the 1.5s shimmer loop with `@keyframes shimmer`, and the `prefers-reduced-motion` guard all resolve. Both gentle-ai review receipts are `approved`; the only WARNING the reviews raised that was actionable (R4-001 reduced-motion) is fixed and test-covered. Remaining warnings are one auto-fixable lint nit in this change and two carried spec-faithful/fase-3 follow-ups. Verdict: **PASS WITH WARNINGS**. Next recommended: `archive` (PR-A already landed; merge ordering satisfied).