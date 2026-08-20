# Archive Report: carga-botellones

**Change**: carga-botellones — Batch QR "carga" for botellones (Commit 2 frontend; Commit 1 backend pre-existing)
**Archived**: 2026-08-20
**Archived to**: `openspec/changes/archive/2026-08-20-carga-botellones/`
**Verdict**: PASS WITH WARNINGS (from `verify-report.md`)
**Archive type**: intentional-with-warnings

## Change Summary

Staff return full truckloads of botellones; previously each one required an individual scan through the single-flow wizard (`/recargas/nueva`). This change shipped a batch session: scan QRs, accumulate bottles, confirm ONE uniform recarga for the whole lot via the `registrarCarga` server action.

- **Commit 1 (backend, `e85bbcf`)**: `registrarCarga` server action + `procesarLoyalty` helper (pre-existing on `main`, audited in exploration, no deviations).
- **Commit 2 (frontend, `03e8fef`)**: the actual change archived here — `useQrScanner` hook extraction, `/recargas/carga` batch page, scanner-modal `Recarga`|`Carga` mode toggle, and component tests.

Three new capabilities shipped as full specs: `batch-carga`, `qr-scanner-hook`, `scanner-mode-toggle`. All promoted to canonical `openspec/specs/`.

## Artifact Traceability

| Artifact | Path (archived) | Notes |
|----------|-----------------|-------|
| Exploration | `archive/2026-08-20-carga-botellones/exploration.md` | Audited Commit 1 backend; mapped Commit 2 frontend surface. |
| Proposal | `archive/2026-08-20-carga-botellones/proposal.md` | Locked scope: hook + batch page + modal toggle. |
| Specs | `archive/2026-08-20-carga-botellones/specs/{batch-carga,qr-scanner-hook,scanner-mode-toggle}/spec.md` | 3 delta specs (8+5+4 = 17 requirements, 34 scenarios). |
| Design | `archive/2026-08-20-carga-botellones/design.md` | Approach 1: transient client-side session; handler-driven accumulation. |
| Tasks | `archive/2026-08-20-carga-botellones/tasks.md` | 10 tasks; 7 core implementation (1.1–3.2) all `[x]`. |
| Verify report | `archive/2026-08-20-carga-botellones/verify-report.md` | `pass_with_warnings`, 0 blockers, 0 critical, 17/17 reqs, 34/34 scenarios. |
| Archive report | `archive/2026-08-20-carga-botellones/archive-report.md` | This file. |

### Canonical Specs Promoted

| Domain | Action | Details |
|--------|--------|---------|
| `batch-carga` | Created | 8 requirements / 15 scenarios → `openspec/specs/batch-carga/spec.md` |
| `qr-scanner-hook` | Created | 5 requirements / 12 scenarios → `openspec/specs/qr-scanner-hook/spec.md` |
| `scanner-mode-toggle` | Created | 4 requirements / 7 scenarios → `openspec/specs/scanner-mode-toggle/spec.md` |

No existing canonical spec needed modification. `react-patterns` and `middleware-routing` were referenced as compliance baselines and remain unchanged.

## Task Completion Gate

Core implementation tasks (1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2) were all `[x]` in `tasks.md`. Phase 4 (verification/integration) contained the only unchecked items (4.1, 4.2, 4.3). These were reconciled at archive as follows, backed by `verify-report.md`:

- **4.1** (full component suite) — reconciled to `[x]`: verify-report proves `npx vitest run` = 136 passed / 0 failed / 0 skipped, exit 0.
- **4.3** (typecheck + lint) — reconciled to `[x]`: verify-report proves `tsc --noEmit` exit 0 and `next build` exit 0; `npm run lint` exit 1 is solely 4 pre-existing errors in files untouched by this change (out of scope).
- **4.2** (optional e2e `tests/e2e/carga.spec.ts`) — **left unchecked** deliberately. It is explicitly optional and deferrable per the spec's Testability note and `design.md`; it was not implemented and is recorded honestly as a follow-up, not as complete.

**Reconciliation reason (recorded)**: These are verification/integration tasks, not implementation tasks. The three core phases (1–3) were fully implemented and verified. The orchestrator explicitly directed archive; `verify-report.md` proves 4.1/4.3 complete and 4.2 optional-deferred. The archive is therefore intentional-with-warnings.

## Review Gate Status

> **HONEST NOTE — REVIEW RECEIPT DID NOT MECHANICALLY CLOSE.**

Per the orchestrator, the native facade review receipt for this change did NOT close due to a tooling schema issue on **gentle-ai 2.0.2** (a platform/schema defect, not a genuine review rejection). No persisted review transaction/ledger/receipt artifacts exist in the change folder.

This is recorded transparently so the audit trail is honest. The archive proceeded on the strength of the independent verification evidence in `verify-report.md` (0 blockers, 0 critical findings, 17/17 requirements, 34/34 scenarios, 136/136 tests passing, build exit 0) plus explicit orchestrator direction to archive. A full native review-gate closure could not be asserted by tooling; the substantive review signal (independent verification) is present and positive.

## Verdict

**PASS WITH WARNINGS** — the change is complete and archived.

Warnings (from verify-report), all non-blocking:
1. `npm run lint` exits 1 — 4 pre-existing errors in files untouched by this change (`alert-panel.tsx`, `mobile-nav.tsx`, `sw.js`). Out of scope; pre-existing debt.
2. Task 4.2 (optional e2e) not implemented — deferred per spec/design; not a blocker.
3. Suggestions: design open question on default `fecha` prefill unresolved (non-blocking); unused-variable warning in a test file (trivial).

## Next Steps / Follow-ups

- 🔲 **Optional**: implement `tests/e2e/carga.spec.ts` (chromium camera stub) if e2e coverage of the batch flow is desired — explicitly deferred, not required.
- 🔲 **Enhancement**: prefill today's date in the `fecha` input (design open question, non-blocking convenience).
- 🔲 **Cleanup**: remove unused-variable warning in `tests/component/carga-page.test.tsx:29`.
- 🔲 **Tech debt (unrelated)**: address the 4 pre-existing lint errors in `alert-panel.tsx`, `mobile-nav.tsx`, `sw.js` so `npm run lint` is clean project-wide.
- 🔲 **Process**: the gentle-ai 2.0.2 native review-facade schema issue that prevented mechanical receipt closure should be tracked/fixed by the tooling owner.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.
