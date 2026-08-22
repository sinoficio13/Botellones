# Archive Report — estados-reversion-realtime

**Change**: estados-reversion-realtime
**Archived to**: `openspec/changes/archive/2026-08-22-estados-reversion-realtime/`
**Date**: 2026-08-22
**Verdict**: pass_with_warnings (0 CRITICAL, 0 blockers, 3 WARNING [2 review backlog + 1 manual-runtime], 4 SUGGESTION [2 review backlog + 2 verify])
**Artifact store**: hybrid (openspec file + Engram topic `sdd/estados-reversion-realtime/archive-report`)

## Summary

Three compounding gaps closed: (1) no undo for mistaken estado moves — added `REVERSIONES`/`getReversiones`/`getEstadosPermitidos` as the single manual-move rule; (2) no server validation — `updateBotellon`/`moverBotellon` now read current estado, validate against the permitted set (or the sale exception), and write with a CAS guard `.eq('estado', current)`; (3) stale UI — detail page + kanban now subscribe to Supabase Realtime `postgres_changes` with migration 0010 (idempotent publication membership).

## Commits

| Commit | Content |
|---|---|
| `87df6b0` | Backend: REVERSIONES/getReversiones/getEstadosPermitidos, server validation + CAS in both writers, sale exception (work-unit 1) |
| `26041a7` | Realtime: migration 0010, estado-en-vivo subscriber, kanban live patch, Avanzar/Deshacer selector (work-unit 2) |
| `8a7b92d` | Review CRITICAL fix: migration 0010 made idempotent (`IF NOT EXISTS pg_publication_tables` guards) |
| (this archive) | docs(sdd): archive + sync canonical specs |

## What was archived

- explore.md, proposal.md, design.md, tasks.md (16 tasks done), verify-report.md (pass_with_warnings, 7/7 req, 24/24 scenarios)
- Delta specs: specs/botellon-ciclo-estados/spec.md (2 ADDED + 1 MODIFIED), specs/realtime-estado-botellon/spec.md (full spec, 4 req / 10 scenarios)
- Review lineage `review-f58b30aa67cae759` — APPROVED (medium, review-reliability lens, 0 blockers, 4 findings all `info`); receipt verified at `.git/gentle-ai/review-transactions/v2/review-f58b30aa67cae759/review-receipt.json`

## Canonical specs synced

- `openspec/specs/botellon-ciclo-estados/spec.md` — MODIFIED: `Stock and assign/unassign semantics` now accepts the sale exception (`entregado` OR `recarga`, default `entregado`) instead of unconditional force-to-`entregado`; ADDED: `Reversion set and getEstadosPermitidos (single manual-move rule)` and `Server-side validation with CAS guard`. All other requirements preserved.
- `openspec/specs/realtime-estado-botellon/spec.md` — NEW canonical spec created from the delta (full spec: 4 requirements, 10 scenarios), change-reference header note stripped.

## Verification evidence

- Envelope: `gentle-ai.verify-result/v1`, verdict `pass_with_warnings`, 0 blockers, 7/7 requirements, 24/24 scenarios, test exit 0, build exit 0.
- Re-run at archive time: `npx vitest run` → **225/225 passed (19 files)**, exit 0 — exactly matches the envelope's test_output_hash source (225/225, 19 files). Envelope confirmed valid, no update needed.

## Review findings (all informational backlog, 0 blockers — approved lineage)

| ID | Severity | Disposition | Summary |
|---|---|---|---|
| R3-001 | WARNING | introduced | Kanban realtime patch lacks canonical-ESTADOS guard (`operaciones-dashboard.tsx:75`) — unknown-estado payload could drop a card until refresh |
| R3-002 | WARNING | pre-existing | `confirmAssign` rejection path is flashToast-only, no `router.refresh()` — optimistic state persists on CAS miss |
| R3-003 | SUGGESTION | introduced | `updateBotellon` CAS-miss error interpolates `update.estado ?? actual` — self-referential message on client-only updates |
| R3-004 | SUGGESTION | introduced | Kanban CHANNEL_ERROR/TIMED_OUT silent-degradation path untested |

## Manual runtime items (user-owned, task 2.9 — do NOT block archive)

1. Apply migration 0010 to real Supabase; verify `supabase_realtime` publication membership for `botellones`, `recargas`, `premios`, `notificaciones`.
2. Two-browser live check: detail badge/selector (RT R2/S3) and kanban card moves without F5 (RT R3/S6).
3. Repartidor session receives realtime updates despite no botellones UPDATE policy (service-role writes bypass RLS — RT R4/S9).
4. (Carried) Migration 0009 constraint swap in Supabase SQL Editor, if not yet applied.