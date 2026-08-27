# Archive Report — central-op-fase4-kanban-desktop

**Change**: Central de Operaciones — Fase 4: Kanban desktop (≥1024px)
**Archived**: 2026-08-27
**From**: `openspec/changes/central-op-fase4-kanban-desktop/`
**To**: `openspec/changes/archive/2026-08-27-central-op-fase4-kanban-desktop/`
**Branch**: `redesign/central-operaciones`
**Verify verdict**: PASS WITH WARNINGS (2 slices, PRs #13–#14, receipts `approved`)
**Mode**: openspec (filesystem merge + archive folder move)

---

## 1. Gate Checks

| Gate | Result | Evidence |
|---|---|---|
| Verify report present & non-CRITICAL | ✅ | `verify-report.md` — verdict PASS WITH WARNINGS; **0 CRITICAL**; 0 blockers; 21/23 scenarios compliant (2 PARTIAL, both e2e-harness-dependent) |
| Task Completion Gate | ✅ | `tasks.md` — all 11 task rows `[x]`; 0 unchecked rows (verified on the archived copy) |
| Review Receipt Gate | ✅ | Both referenced lineages exist `approved` at `.git/gentle-ai/review-transactions/v2/` (see §4) |
| Working tree | ✅ | No commits made by this archive; only the pre-existing fase-3 staging + the now-moved fase-4 folder present |

No CRITICAL issues block archive. Per Strict-vs-OpenSpec policy, WARNING-level findings are carried forward (§5) and do not block closure.

---

## 2. Spec Sync

Merged the delta from `specs/central-operaciones-schema/spec.md` into the canonical spec
`openspec/specs/central-operaciones-schema/spec.md` (now 26 requirements, 80 scenarios).

| Domain | Action | Details |
|---|---|---|
| central-operaciones-schema | Updated (ADDED + MODIFIED) | **5 ADDED** (REQ-COS-22..26, 19 scenarios) + **1 MODIFIED** (REQ-COS-21, full block replacement) |

**Merge fidelity** (`git diff` = 279 insertions / 1 deletion — all additive except the one replaced block):
- REQ-COS-22..26 appended verbatim (19 scenarios) — matches the delta byte-for-byte.
- REQ-COS-21 full-block replacement: added the desktop ≥1024px sentence + the "(Previously: …)" note + the new "Tablet grid hidden at ≥1024px" scenario, preserving the other four scenarios unchanged — exactly per the delta.
- All pre-existing requirements (REQ-COS-1..20, 22..26 carried untouched except REQ-COS-21) preserved.
- Purpose section updated with a Fase-4 paragraph, consistent with the Fase-2/Fase-3 convention already present.

---

## 3. Archive Contents

| Artifact | Present |
|---|---|
| proposal.md | ✅ |
| specs/central-operaciones-schema/spec.md | ✅ |
| design.md | ✅ |
| tasks.md | ✅ (11/11 tasks complete, 0 unchecked) |
| verify-report.md | ✅ |
| archive-report.md | ✅ (this file) |

Active `openspec/changes/` no longer contains this change.

---

## 4. Review Receipts (cross-checked at archive time)

Both `terminal_state: approved` at `.git/gentle-ai/review-transactions/v2/`:

| PR / Slice | Lineage | terminal_state |
|---|---|---|
| PR-A Desktop frame + compact card (#13) | `review-98120340d1222141` | approved |
| PR-B Drag & drop + column tests (#14) | `review-45497cc1ee1e1d38` | approved |

---

## 5. Follow-ups Carried (non-blocking — none block archive)

### Warnings (verify-report Section Issues)
- **W1 — e2e specs not executed in this environment.** `cola-1024px.spec.ts` (new) and `cola-375px.spec.ts` (carried, MOD-21 S5) require a dev server + hosted Supabase; neither ran in this session (jsdom cannot apply media queries). MOD-21 S5 "No horizontal scroll at 375px" therefore has no runtime-passed covering test here. Mobile branch is untouched (PR-A diff), so risk is low — run the e2e harness before relying on these two specs.
- **W2 — `cola-1024px.spec.ts` empty-queue assumption.** The spec expects `cola-kanban` visible "in both" data and first-use-empty states, but `ColaOperaciones` short-circuits to the first-use empty state when `totales.botellones === 0` — the kanban branch is NOT rendered then. Against an empty dev DB this e2e would fail. Add an empty-branch assertion (kanban OR first-use state).

### Suggestions (verify-report Section Issues)
- **S1 — `dragId` cleared only on `dragEnd`, not in the drop handler.** A drop whose `dragend` never fires (drag cancelled/leaves window) leaves a stale fallback that a later empty-`getData` drop could consume. Clear `dragId` inside the drop handler after a successful move.
- **S2 — Header/placeholder subtitle duplication.** Empty columns render the subtitle twice (sticky header + `EmptyState` description); tests use `getAllByText`. a11y/copy smell, not a bug.
- **S3 — `DESTINO_ACCION` placement.** The constant lives in `grupo-card.tsx` and is now imported by `kanban-desktop.tsx`; a shared operaciones constants module would remove the cross-component import.
- **S4 — Fixture duplication.** `botellon()`/`grupo()` helpers are duplicated across `grupo-card.test.tsx`, `grupo-card-kanban.test.tsx`, `kanban-desktop.test.tsx`; extract to `tests/fixtures`.
- **S5 — `CODIGOS_VISIBLES` shared constant.** `CHIPS_VISIBLES` (grupo-card.tsx) and `CODIGOS_VISIBLES` (grupo-card-kanban.tsx) both hardcode 6; share one constant.
- **S6 — No literal 1440px assertion.** REQ-26 S3 names widths 375/768/1023/1024/1440; component tests assert the class contract (documented D9 jsdom convention) but no literal 1440-width check exists. Optional: a viewport-width assertion in `cola-1024px.spec.ts` (1440) would fully mirror the scenario wording.

---

## 6. Reconciliation Note

No stale-checkbox reconciliation was required — the archived `tasks.md` is fully complete (11/11 `[x]`, 0 unchecked) as produced by `sdd-apply`.

---

## 7. SDD Cycle Status

The change has been fully planned, implemented, verified, and archived. The canonical spec now reflects Fase 4 behavior (REQ-COS-1..26). **Next recommended: none** — fase 4 was the final planned kanban phase; remaining work is the follow-ups in §5 (mostly e2e/refactor hygiene) owned by later work.
