# Archive Report — carga-terminal-multi-estado

**Change**: carga-terminal-multi-estado
**Archived to**: `openspec/changes/archive/2026-08-22-carga-terminal-multi-estado/`
**Date**: 2026-08-22
**Verdict**: pass (0 CRITICAL, 0 blockers, 1 WARNING, 1 SUGGESTION)
**Artifact store**: hybrid (openspec file + Engram topic `sdd/carga-terminal-multi-estado/archive-report`)

## Summary

Turned the `/recargas/carga` batch page into a multi-state procedure terminal: 3 operations (Recibir, Recargar default, Listo), per-item green/red transition badges derived live from the state machine, duplicate-scan beep + transient ring, operation-scoped no-client gate, and generalized `registrarOperacion` server action (REC/loyalty only in the recarga branch).

## Commits

| Commit | Content |
|---|---|
| `c372a43` | Backend: OPERACIONES/esTransicionValida, registrarOperacion multi-state server action, loyalty compensation helper (work-unit 1) |
| `41b483b` | Frontend: beep util + multi-state terminal page + component tests (work-unit 2) |
| `e98e676` | (prior, same feature line) dedupe double scans, auto fecha/hora, session "Ver ficha" |
| (this archive) | docs(sdd): archive + sync canonical specs |

## What was archived

- proposal.md, explore.md, design.md, tasks.md (13 tasks done), apply-progress.md, verify-report.md (pass, 20/20 req, 31/31 scenarios)
- Delta spec: specs/batch-carga/spec.md (6 MODIFIED + 1 ADDED)
- `terminal-carga.png` — untracked testing artifact from this change's runtime check, moved into the archive folder to keep the working tree clean

## Canonical specs synced

- `openspec/specs/batch-carga/spec.md` — applied the delta's MODIFIED requirements that hold at HEAD: `Batch confirm via registrarOperacion`, `Operation-scoped no-client gate`, `Per-item result rendering per operation`, `Success screen per operation`, `Graceful fallback when client name is missing` (op-scoped), plus the ADDED `Generalized registrarOperacion server action`. Purpose and Testability updated to the registrarOperacion contract (the `registrarCarga` wrapper was dropped in commit 2).

## Superseded delta requirement (NOT merged — documented)

The delta's MODIFIED `Multi-source recarga transition` (sources `{entregado, recibido}`, one-pass `entregado → recarga`) was implemented by this change's commits BUT reverted by the subsequent `estados-botellon-ciclo-puro` change (`f5abb78`, archived 2026-08-21 in `cb7335e`), which restored strict single-source `recargar sources ['recibido']`. HEAD code confirms `OPERACIONES.recargar.sources === ['recibido']` and tests assert `.in('estado', ['recibido'])`. The canonical `Confirm transition is recibido to recarga` requirement (synced by cb7335e) therefore stays unchanged — merging the delta's multi-source text would have regressed the canonical spec against the actual code. The verify-report's scenario matrix rows for multi-source recarga refer to the intermediate state and are historical evidence only.

## Verification evidence

- Envelope: `gentle-ai.verify-result/v1`, verdict `pass`, 0 blockers, 20/20 requirements, 31/31 scenarios, test exit 0, build exit 0.
- Re-run at archive time: `npx vitest run` → 225/225 passed (19 files), exit 0. The suite grew from 185 (16 files) at verify time because `estados-reversion-realtime` added 40 tests afterward; Change 1's own counts and exit code still hold, so the envelope was not rewritten.

## Findings (from verify-report)

- **WARNING-1**: stale `next dev` server (PID 3032) returned connection-reset during runtime spot-check — environment artifact, not a code defect; fix = restart dev server.
- **SUGGESTION-1**: confirm button label is fixed "Confirmar carga" for all operations — cosmetic; payload and success screen are op-driven.

## Pending action items (non-blocking)

- None for this change. (WARNING-1 is an environment note; migration 0009 constraint swap remains tracked under the estados-botellon-ciclo-puro archive.)