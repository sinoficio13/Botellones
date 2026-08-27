# Archive Report — central-op-fase3-vista-movil

**Change**: Central de Operaciones — Fase 3: Vista móvil (cola agrupada por cliente)
**Archived**: 2026-08-27
**From**: `openspec/changes/central-op-fase3-vista-movil/`
**To**: `openspec/changes/archive/2026-08-27-central-op-fase3-vista-movil/`
**Branch**: `redesign/central-operaciones`
**Verify verdict**: PASS WITH WARNINGS (7/7 slices, PRs #6–#12, all receipts `approved`)
**Mode**: openspec (filesystem merge + archive folder move)

---

## 1. Gate Checks

| Gate | Result | Evidence |
|---|---|---|
| Verify report present & non-CRITICAL | ✅ | `verify-report.md` — verdict PASS WITH WARNINGS; **0 CRITICAL**; 1 documented PARTIAL (REQ-COS-19 S2, accepted deviation) |
| Task Completion Gate | ✅ | `tasks.md` — all 17 task rows `[x]`; 0 unchecked rows (verified on the archived copy) |
| Review Receipt Gate | ✅ | All 6 referenced lineages exist `approved` at `.git/gentle-ai/review-transactions/v2/` (see §5) |
| Working tree | ✅ | Only the phase-4 untracked `verify-report.md` present; this archive made no commits |

No CRITICAL issues block archive. Per Strict-vs-OpenSpec policy, WARNING-level findings are carried forward (§6) and do not block closure.

---

## 2. Spec Sync

Merged the delta from `specs/central-operaciones-schema/spec.md` into the canonical spec
`openspec/specs/central-operaciones-schema/spec.md` (now 21 requirements, 60 scenarios).

| Domain | Action | Details |
|---|---|---|
| central-operaciones-schema | Updated (ADDED + MODIFIED) | **6 ADDED** (REQ-COS-16..21, 18 scenarios) + **1 MODIFIED** (REQ-COS-12, full block replacement) |

**Merge fidelity** (`git diff` = 142 insertions / 1 deletion — all additive except the one replaced block):
- REQ-COS-16..21 appended verbatim (18 scenarios) — matches the delta byte-for-byte.
- REQ-COS-12 full-block replacement: added the action-dismiss-by-identity semantic + R3-001 scenario, and dropped the old standalone "The toast container MUST have `aria-live`" closing sentence (now folded into the opening paragraph) — exactly per the delta.
- All pre-existing requirements (REQ-COS-1..11, 13..15) preserved untouched.
- Purpose section updated with a Fase-3 paragraph, consistent with the Fase-2 convention already present.

---

## 3. Archive Contents

| Artifact | Present |
|---|---|
| proposal.md | ✅ |
| specs/central-operaciones-schema/spec.md | ✅ |
| design.md | ✅ |
| tasks.md | ✅ (17/17 tasks complete, 0 unchecked) |
| verify-report.md | ✅ |
| archive-report.md | ✅ (this file) |

Active `openspec/changes/` no longer contains this change.

---

## 4. Review Receipts (cross-checked at archive time)

All `terminal_state: approved` at `.git/gentle-ai/review-transactions/v2/`:

| PR / Slice | Lineage | terminal_state |
|---|---|---|
| PR-A Frame (#6) | `review-86d16cedc7e6629a` | approved |
| PR-B Card (#7) | `review-4adbbd55945b32f7` | approved |
| PR-C Acción+undo (#8, corrected) | `review-a459a63be2508b4b` | approved |
| PR-D Buscador (#9, final) | `review-ce58c24acc9bda88` | approved |
| PR-E Reemplazo (#10) | `review-23bd5131088c879b` | approved |
| PR-F+G Cleanup (#11+#12) | `review-da8d6599aba1e347` | approved |

---

## 5. Follow-ups Carried (non-blocking — none block archive; owned by fase 4 / later)

### Documented deviations (accepted, tracked)

- **REQ-COS-19 S2 — exact pre-forward restore is a follow-up.** Undo restores the pre-undo `estado_desde` (the forward move's `now()` stamp), not the original pre-forward value; the S2 test passes only because the undo RPC is mocked. Follow-up: persist `estado_desde_previo` in the `movimientos` audit row on the forward move and restore from it; fix the S2 mock/title. (review R3-001-verify, outcome `info`; orchestrator context.)
- **WARNING-2 — design/tasks artifacts are stale on the migration contract.** Migration `0013` ships `p_restaurar boolean` and drops the `p_estado_desde jsonb` variant documented in `design.md` D1 and `tasks.md` 3.3. Deliberate, security-motivated (closes client-forged-timestamp vector); `database.ts` correctly typed. Artifacts not updated before archive — flag for anyone tracing the undo design.

### Advisory follow-ups carried (verify-report Section 6)

- **Totales stale after Entregar** (R3-002): `aplicarFilas` re-adds `entregado` rows to `botellones`; `totales` inflates the context bar while no tab shows them.
- **E2E timing** (verify pass): `cola-375px.spec.ts` asserts `scrollWidth` before the skeleton settles — flake risk on slow loads; wait for the skeleton to disappear.
- **Frozen clock** (verify pass): `useEdadAhora` never ticks after mount — ages/urgency freeze on an open page (real-time refresh is fase 5 scope).
- **Transport catch** (verify pass): `buscarColaOperaciones` returns empty buckets on transport rejection → false "Sin resultados" instead of the error alert.
- **Cédula prefix semantics** (verify pass): digits-only normalization + `includes()` contains-match — confirm intended prefix-vs-contains.
- **R3-001-verify undo semantic** — see the REQ-COS-19 S2 deviation above.
- Also carried: `p_restaurar` constrained to reversal transitions (R1-001); undo-failure copy offering an unperformable retry (R4-001); undo lacks CAS on post-move estado (R4-002); error-revert re-appends rows at array end (R1-revert-reorder); WITH ORDINALITY invariant doc (R2-001); rename `movimientoExitoso` (R2-002); move `DESTINO_ACCION` beside the state machine (R2-003); extract duplicated fixtures (R2-004); make undo-flow S5 meaningful (R2-005); rollback-comment drift re: 0012 overload (verify pass); tablet grid ≥1024 also shows 2-col, no `lg` cap (verify pass); no standalone `apply-progress.md` in change dir (verify pass); update `design.md`/`tasks.md` to the boolean contract (verify pass).

---

## 6. Reconciliation Note

No stale-checkbox reconciliation was required — the archived `tasks.md` is fully complete (17/17 `[x]`, 0 unchecked) as produced by `sdd-apply`.

---

## 7. SDD Cycle Status

The change has been fully planned, implemented, verified, and archived. The canonical spec now reflects Fase 3 behavior. **Next recommended: `sdd-archive` for `central-op-fase4-kanban-desktop`** (already in active changes).
