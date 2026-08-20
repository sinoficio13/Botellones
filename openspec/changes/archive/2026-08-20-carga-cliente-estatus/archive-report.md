# Archive Report — carga-cliente-estatus

**Change**: carga-cliente-estatus
**Archived to**: `openspec/changes/archive/2026-08-20-carga-cliente-estatus/`
**Date**: 2026-08-20
**Verdict**: pass-with-warnings (0 CRITICAL, 0 blockers)
**Archive type**: standard (openspec/hybrid)

## Summary

The `/recargas/carga` batch page now shows, at scan time, the client the botellon
belongs to and the botellon's current status badge for each accumulated session
item, before confirm. The confirm transition stays `entregado -> recarga` (no new
state). The change was implemented, verified (145 tests passing, build clean), and
reviewed with two APPROVED receipts.

## Gate Checks

### Task Completion Gate
- `tasks.md`: **10/10 implementation tasks checked `[x]`** across 5 phases. No
  stale unchecked tasks. `sdd-apply` marked them complete; `verify-report`
  confirms 10/10 complete. Passed.

### Review Receipt Gate
Two APPROVED native review receipts noted:
- `review-21f3c548dfea20e2` — APPROVED (feat `5569d7d`; pre-commit gate allow).
- `review-e236765a4dee14d4` — APPROVED (security fix `1458c87`; risk lens, gate allow).

### Verification Gate
`verify-report.md` verdict: **pass-with-warnings**; 0 CRITICAL findings, 0
blockers; requirements 5/5, scenarios 8/8. All runtime evidence green
(`vitest` 145/145, `tsc` clean, `build` clean).

## Spec/Design Drift — CORRECTED (security fix)

The verify report flagged a SPEC/DESIGN DRIFT that this archive phase reconciled
as a real documentation correction (no application code changed):

- **Was**: delta spec R1 and design Decision #2 stated `getBotellonByCodigo`
  returns `clienteNombre` via a `clientes(nombre)` join in a single lookup.
- **Actual (security-corrected)**: the implemented, review-approved security fix
  `1458c87` keeps `getBotellonByCodigo` **public-safe** — select only
  `id, codigo, estado, cliente_id`, NO `clientes(nombre)` join, NO `clienteNombre`
  (avoids leaking owner PII into the anonymous `/b/[codigo]` force-dynamic RSC
  payload, whose codes are sequentially enumerable). The authenticated
  `/recargas/carga` page resolves the display name via a separate
  `getCliente(cliente_id)` call inside `onDecode`.

### Files corrected during archive (docs only, no code)
- `specs/batch-carga/spec.md` — R1 rewritten to the public-safe + `getCliente`
  mechanism; R1 scenarios updated; Testability section updated to assert
  `getBotellonByCodigo` does NOT expose `clienteNombre` and its select never
  contains `clientes`.
- `design.md` — Decision #2 rewritten (revision note for `1458c87`), Data Flow
  updated, File Changes table updated, `BotellonPublico` interface no longer
  carries `clienteNombre`, Testing Strategy and Rollback/Migration updated to
  the `getCliente` approach.

## Specs Synced (Delta → Canonical)

| Domain | Action | Details |
|--------|--------|---------|
| `batch-carga` | Updated (ADDED) | Merged **5 ADDED requirements** into `openspec/specs/batch-carga/spec.md`: (1) Scan-time client name + botellon status on each session item, (2) Session list renders client name and status badge, (3) Graceful fallback when client name is missing, (4) Handler-driven enrichment (no setState in effect), (5) Confirm transition remains entregado → recarga. Testability updated for the `getCliente` mechanism. Existing requirements preserved unchanged. |

Source of truth updated: `openspec/specs/batch-carga/spec.md`.

## Archive Contents

- proposal.md ✅
- exploration.md ✅
- specs/batch-carga/spec.md ✅ (corrected delta)
- design.md ✅ (corrected)
- tasks.md ✅ (10/10 tasks complete)
- verify-report.md ✅
- archive-report.md ✅ (this file)

## Docs Updated

- `docs/plan.md` — added `carga-cliente-estatus` → Completado row in the
  "Cambios SDD adicionales" execution-status table, pointing to the archive path.

## Risks

- None outstanding. The drift was a documentation-only correction; all 8
  behavioral scenarios remain covered by passing tests and match the committed,
  review-approved code.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, reviewed, and archived.
Ready for the next change.
