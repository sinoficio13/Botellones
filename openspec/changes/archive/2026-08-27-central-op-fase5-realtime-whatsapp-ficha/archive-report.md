# Archive Report — central-op-fase5-realtime-whatsapp-ficha

**Change**: Central de Operaciones — Fase 5: Realtime + WhatsApp + Ficha cliente (FINAL del EPIC-15)
**Archived**: 2026-08-27
**From**: `openspec/changes/central-op-fase5-realtime-whatsapp-ficha/`
**To**: `openspec/changes/archive/2026-08-27-central-op-fase5-realtime-whatsapp-ficha/`
**Branch**: `redesign/central-operaciones`
**Verify verdict**: PASS WITH WARNINGS (3 slices, PRs #15/#16/#17, receipt `approved`)
**Mode**: hybrid (openspec filesystem merge + archive folder move + Engram persistence)

---

## 1. Gate Checks

| Gate | Result | Evidence |
|---|---|---|
| Verify report present & non-CRITICAL | ✅ | `verify-report.md` — verdict PASS WITH WARNINGS; **0 CRITICAL**; 0 blockers; 28/28 scenarios compliant; 411/411 tests green; `tsc --noEmit` exit 0 |
| Task Completion Gate | ✅ | `tasks.md` — all 25 task rows `[x]` (1.1–1.9, 2.1–2.8, 3.1–3.8); 0 unchecked rows (verified on the archived copy) |
| Review Receipt Gate | ✅ | Lineage `review-04fa97efd80a6751` exists at `.git/gentle-ai/review-transactions/v2/` with `terminal_state: approved` (see §4) |
| Working tree | ✅ | No commits made by this archive; only the pre-existing fase-5 commits (`04864cf` realtime, `8a1a5d9` WhatsApp, `0a5d4ae` ficha + carried) and the now-moved change folder present |

No CRITICAL issues block archive. Per Strict-vs-OpenSpec policy, WARNING-level findings are carried forward (§5) and do not block closure. **W1 is recorded below as a verified false positive** (encoding-corrupt reading of `whatsapp.ts` during verify — the locked literal matches the archived delta spec verbatim); **W2 is the acknowledged `size:exception`** (process deviation, not correctness).

---

## 2. Spec Sync

Merged the delta from `specs/central-operaciones-schema/spec.md` into the canonical spec
`openspec/specs/central-operaciones-schema/spec.md` (now 30 requirements, 98 scenarios; was 26 / 79 at HEAD).

| Domain | Action | Details |
|---|---|---|
| central-operaciones-schema | Updated (ADDED + MODIFIED) | **4 ADDED** (REQ-COS-27..30, 16 scenarios) + **3 MODIFIED** (REQ-COS-17, REQ-COS-18, REQ-COS-23 — full block replacements, net +3 scenarios) |

**Merge fidelity** (delta semantics applied exactly):
- REQ-COS-27..30 appended verbatim from the delta (16 scenarios: 5+5+3+3).
- REQ-COS-17 full-block replacement: "counter of groups (static this fase)" → "updated LIVE by realtime (REQ-COS-27), independent of the chip queue" + new "Counters live while a change is queued" scenario, other scenarios preserved.
- REQ-COS-18 full-block replacement: name/WhatsApp targets inert → wired (ficha REQ-COS-29 / sheet REQ-COS-28, opacity-40 + toast no-phone) + new "Name and WhatsApp targets wired" scenario, other scenarios preserved.
- REQ-COS-23 full-block replacement: WhatsApp target inert → wired to the sheet (REQ-COS-28), name opens the ficha (REQ-COS-29); "WhatsApp inert target" scenario replaced by "WhatsApp wired, no phone disabled with toast" + new "Name opens the ficha" scenario.
- All pre-existing requirements (REQ-COS-1..16, 19..22, 24..26 and the untouched parts of 17/18/23) preserved.
- Purpose section updated with a Fase-5 paragraph, consistent with the Fase-2/Fase-3/Fase-4 convention already present.

**REQ-COS-28 literal note (W1 ground truth)**: the merged spec carries the **function-form locked literal** from the on-disk delta spec (`Hola ${p}, recibimos ${u}…`, `…¿Te lo llevo hoy?`, `…vamos en camino con ${u}.`, + `default` branch). This matches `src/lib/utils/whatsapp.ts:21-31` **byte-for-byte** (verified at archive time). The Engram spec observation #667 retains an earlier draft of the literal in table form (`Hola {nombre}, tus {N} botellones fueron recibidos.` etc.); that draft was superseded by the on-disk delta and is NOT what the implementation targets. The on-disk delta is authoritative for the merge.

---

## 3. Archive Contents

| Artifact | Present |
|---|---|
| proposal.md | ✅ |
| specs/central-operaciones-schema/spec.md | ✅ |
| design.md | ✅ |
| tasks.md | ✅ (25/25 tasks complete, 0 unchecked) |
| verify-report.md | ✅ |
| archive-report.md | ✅ (this file) |

Active `openspec/changes/` no longer contains this change (only `archive/` remains).

---

## 4. Review Receipts (cross-checked at archive time)

| Lineage | terminal_state | Location |
|---|---|---|
| `review-04fa97efd80a6751` (fase-5 4R review) | approved | `.git/gentle-ai/review-transactions/v2/review-04fa97efd80a6751/review-receipt.json` |

PRs #15/#16/#17 (slices A/B/C) created on the `redesign/central-operaciones` feature-branch chain; each ≤400-line budget was exceeded (see W2) and was carried with an explicit `size:exception` note per slice.

### Engram artifact traceability (mode: hybrid — observation IDs)

| Artifact | Engram obs | Topic key |
|---|---|---|
| proposal | #666 | `sdd/central-op-fase5-realtime-whatsapp-ficha/proposal` |
| spec | #667 (earlier draft — see §2 literal note; on-disk delta authoritative) | `sdd/central-op-fase5-realtime-whatsapp-ficha/spec` |
| design | #668 | `sdd/central-op-fase5-realtime-whatsapp-ficha/design` |
| tasks | #669 | `sdd/central-op-fase5-realtime-whatsapp-ficha/tasks` |
| apply (Slice C, PR-C complete) | #670 | — |
| verify-report | #674 | `sdd/central-op-fase5-realtime-whatsapp-ficha/verify-report` |
| archive-report | (this save) | `sdd/central-op-fase5-realtime-whatsapp-ficha/archive-report` |

No dedicated Engram topics exist for the review transaction/ledger/receipt — the review lineage lives filesystem-only under `.git/gentle-ai/review-transactions/v2/` (same as fase-4).

---

## 5. Follow-ups Carried (non-blocking — none block archive)

### Warnings (verify-report Section Issues)
- **W1 — REQ-COS-28 locked-literal deviation: FALSE POSITIVE, resolved.** The verify agent compared `whatsapp.ts` against the stale Engram spec draft (obs #667, table-form literal) instead of the on-disk delta spec. Direct comparison at archive time shows the implementation matches the archived delta spec verbatim (see §2). No spec change or code change required; the merged canonical spec now carries the correct locked literal.
- **W2 — Line budget exceeded in all 3 PRs** (PR-A ≈933, PR-B ≈515, PR-C ≈788 changed lines vs the 400 budget). Design estimates missed ~2× on test lines. Documented with a `size:exception` recommendation at each slice; carried fixes split cleanly (~43 lines: D12, dragId, D10 + tests) if the maintainer insists. Process deviation, not a correctness issue — 411/411 tests green, tsc clean, no dropped requirements.

### Suggestions (verify-report Section Issues)
- **S1 — Consolidated TDD evidence table.** TDD evidence lives as per-task "Evidence:" lines in `tasks.md` rather than a consolidated RED/GREEN/TRIANGULATE/SAFETY-NET table; content is present and cross-verified (24/25 checks passed). Consider the table format in future apply reports.

---

## 6. Reconciliation Note

No stale-checkbox reconciliation was required — the archived `tasks.md` is fully complete (25/25 `[x]`, 0 unchecked) as produced by `sdd-apply`.

---

## 7. Changelog Convention

No `openspec/CHANGELOG.md` exists and no per-capability changelog convention is present in this repo (checked via glob for `openspec/**/CHANGELOG*`). The canonical `openspec/specs/central-operaciones-schema/spec.md` Purpose section serves as the accumulated per-fase changelog (Fase-1..5 paragraphs). Noted as absent; no changelog artifact created.

---

## 8. SDD Cycle Status

The change has been fully planned, implemented, verified, and archived. The canonical spec now reflects Fase 5 behavior (REQ-COS-1..30). **EPIC-15 is COMPLETE** — fase 5 was the final phase of the epic (realtime multi-device cola, WhatsApp sheet, client ficha all delivered). **Next recommended: none for EPIC-15**; remaining work is non-blocking hygiene (W2 size-exception note for maintainers, S1 evidence-table suggestion) owned by future work.