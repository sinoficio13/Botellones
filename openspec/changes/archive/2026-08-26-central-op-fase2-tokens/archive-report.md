# Archive Report — central-op-fase2-tokens

**Change**: central-op-fase2-tokens
**Archived to**: `openspec/changes/archive/2026-08-26-central-op-fase2-tokens/`
**Date**: 2026-08-26
**Verdict**: pass_with_warnings (0 CRITICAL, 0 blockers, 8/8 requirements, 20/20 scenarios; 3 WARNING carried — R3-001 fase-3 fix, W-1 lint, R2-001/R2-002 spec-faithful)
**Artifact store**: hybrid (openspec file + Engram topic `sdd/central-op-fase2-tokens/archive-report`)

## Summary

Fase 2 of the Central de Operaciones visual system: additive design tokens (17 CSS custom properties appended to `:root`/`.dark` + `@theme inline` mappings, shadcn baseline byte-identical), Inter + JetBrains Mono font loading (Geist removed, `--font-mono` self-reference flip), and five UI primitives in `src/components/operaciones/` — Chip, ActionButton, Toast singleton, Skeleton, EmptyState — each with a strict-TDD component test contract. Delivered as two chained PRs (PR #4 = PR-A, PR #5 = PR-B) on `redesign/central-operaciones`. Verified PASS WITH WARNINGS: 256/256 tests (25 files), `tsc --noEmit` clean, `npm run build` green, zero hex literals in new components, zero Geist references, compiled CSS proves all new utilities resolve. Both gentle-ai review receipts `approved`. The only actionable review WARNING (R4-001 reduced-motion) was fixed by `971efa2` with test coverage. Nothing blocks archive.

## Commits

| Commit | Content |
|---|---|
| `6738a23` | PR-A: operaciones design tokens, fonts, and base primitives (Chip/Skeleton/EmptyState + tests) |
| `32ff05b` | chore: ignore local codegraph index (supporting repo chore) |
| `fb809bd` | docs(openspec): central-op-fase2-tokens audit artifacts |
| `2faf7c5` | PR-B: ActionButton and Toast primitives (+ tests) |
| `971efa2` | fix(a11y): respect prefers-reduced-motion in Skeleton (closes review R4-001) |
| `da9acd3` | docs(openspec): mark fase2 PR-B tasks complete |

PRs: **#4** (PR-A — tokens/fonts/Chip/Skeleton/EmptyState), **#5** (PR-B — ActionButton/Toast).

## What was archived

- proposal.md, design.md (D1–D10, 2 documented non-blocking deviations), tasks.md (**14/14 `[x]`** — 1.1–1.8, 2.1–2.5, R4-001 bonus; no stale unchecked tasks), verify-report.md (`pass_with_warnings`, 8/8 req, 20/20 scenarios)
- Delta spec: specs/central-operaciones-schema/spec.md (8 ADDED requirements: REQ-COS-8..15, 20 scenarios)
- Review lineage `review-b8e3ce7cc5de60d0` (PR-A, high risk, 4 lenses) and `review-076ecb0727252f1a` (PR-B, medium, reliability) — both `terminal_state: "approved"`, state `"approved"`; receipts verified at `.git/gentle-ai/review-transactions/v2/{lineage}/review-receipt.json`
- Engram traceability: proposal #637, spec #638, design #639, tasks #640, apply-progress #641, verify-report #642 (project `botellones`). Review receipts are not persisted as Engram topics — authoritative copies live under `.git/gentle-ai/review-transactions/v2/`

## Canonical specs synced

- `openspec/specs/central-operaciones-schema/spec.md` — **CREATED** (file absent from working tree). Merged content = fase-1 canonical (REQ-COS-1..7, read via `git show chore/central-op-fase1-registro`, preserved verbatim) + fase-2 ADDED requirements (REQ-COS-8..15, verbatim from the delta). Final: **15 requirements, 41 scenarios** (21 fase-1 + 20 fase-2); delta header/`## ADDED Requirements` wrapper stripped; a one-paragraph Purpose extension notes the fase-2 scope. No MODIFIED/REMOVED/RENAMED sections in this delta — nothing replaced or deleted.

## Verification evidence

- Envelope: `gentle-ai.verify-result/v1`, verdict `pass_with_warnings`, 0 blockers, 0 critical, 8/8 requirements, 20/20 scenarios, test exit 0 (256/256, 25 files), build exit 0 (22 routes), `tsc --noEmit` exit 0.
- Shadcn baseline: `git diff 6738a23^ HEAD -- src/app/globals.css` = 65 insertions + 1 deletion only (the deletion is the designed `--font-mono` flip); every pre-existing token byte-identical.
- Verify report cross-checked both review receipts (`approved`) and the R4-001 fix (`971efa2` + test assert + compiled `@media (prefers-reduced-motion:reduce)` rule).

## Carried findings (WARNING — do NOT block archive)

| ID | Severity | Disposition | Summary |
|---|---|---|---|
| R3-001 / W-2 | WARNING | **fix in fase 3** | `toast.tsx:102-105`: activating Deshacer runs `onAction()` then `dismissToast()` unconditionally, so a toast shown inside `onAction` via `showToast()` is cleared in the same tick and never displays its 4.5s. Latent — no consumers exist yet; fase 3 wires call sites and must fix |
| W-1 | WARNING | **fix in fase 3** | `toast.tsx:23`: `let listeners = new Set<...>()` never reassigned → eslint `prefer-const` error (auto-fixable one-char); quality metric only |
| R2-001 | WARNING | spec-faithful — **do NOT change** | Light-mode `--text-muted` equals `--text-disabled` (#A1A1AA) while dark differentiates them; values match the user's locked spec §5.1 exactly. Document intent in fase 3 |
| R2-002 | WARNING | spec-faithful — **do NOT change** | Mixed Spanish/English token namespace (`--marca`, `--estado-*`, `--urgencia`, `--whatsapp`); `--marca` duplicates `--estado-recarga`. Matches the locked §5.1 domain vocabulary; document in fase 3 rather than rename |

## Carried findings (SUGGESTION — backlog)

S-1 (R3-002) direct `dismissToast()` contract assertion · S-2 (R2-006) Skeleton tests hidden in `empty-state.test.tsx` (spec-mandated fold) · S-3 (R2-005) Skeleton raw `var()` shimmer gradient bypasses `--color-*` mapping · S-4 (R2-007) EmptyState internal spacing contract · S-5 (R2-004) `text-white` on pressed Chip not a project token (design D10: deliberate, AA-passing) · S-6 (R4-003) dark mode dormant — confirm when fase 3 consumes tokens · R4-002 font vendor only if offline builds required · R3-003 Chip disabled contract in fase 3 if needed.

## Notes

- Intentional-with-warnings: standard archive of a PASS WITH WARNINGS verdict — not a partial archive; all artifacts present, tasks 14/14 complete.
- `openspec/config.yaml` absent from the working tree (lives on `chore/central-op-fase1-registro`); `rules.archive` ("Warn before merging destructive deltas") not triggered — delta is purely ADDED, merge non-destructive.
- Merge-ordering satisfied: PR-A landed before archive; canonical fase-1 spec remains on `chore/central-op-fase1-registro` (fase-1 change not yet archived — its archive must merge REQ-COS-1..7 against this now-canonical 15-requirement file).
- Fase 3 next: wire primitives into screens, fix R3-001 + W-1, document token-namespace intent (R2-001/R2-002), resolve SUGGESTION backlog opportunistically.