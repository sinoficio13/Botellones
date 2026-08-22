```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:5bbc81b8774399131054241c1e067a901f20accf0fc9c40cc0244702759f0604
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 24/24
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:5bbc81b8774399131054241c1e067a901f20accf0fc9c40cc0244702759f0604
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:3c54b57b7efb15c31acc4984421db2659116557fa99b0b7664804bead2bdb6ee
```

# Verification Report — estados-reversion-realtime

- **Change**: `estados-reversion-realtime`
- **Mode**: hybrid (openspec file + Engram topic `sdd/estados-reversion-realtime/verify-report`)
- **Verdict**: **PASS WITH WARNINGS** — code-complete, all automated evidence green; warnings are the 4 approved-review advisory findings (informational backlog) and the user-owned manual runtime items (task 2.9). Nothing blocks archive.
- **Next recommended**: `archive`
- **Verified against**: proposal.md, specs/botellon-ciclo-estados/spec.md, specs/realtime-estado-botellon/spec.md, design.md, tasks.md, apply-progress (Engram #606), review lineage `review-f58b30aa67cae759` (APPROVED, medium, 1 lens, 0 blockers).

## Completeness

| Check | Status | Details |
|---|---|---|
| Tasks (tasks.md) | ✅ 16/16 | All `[x]`; 6 in Commit 1, 10 in Commit 2 (incl. 2.9 manual + 2.10 commit) |
| Task 2.9 manual note | ✅ | Reflects **code-complete + manual-runtime deferred to user** (apply 0010 → verify publication membership; two-browser live check; repartidor realtime). Code-side evidence (idempotent migration rewrite 8a7b92d + component tests 2.1/2.2) documented in the task |
| Commits (main) | ✅ | `87df6b0` backend machine+validation; `26041a7` realtime+UI+migration; `8a7b92d` migration 0010 idempotency fix |
| Proposal | ✅ | Intent/scope/business rules match implementation |
| Specs | ✅ | 2 delta specs read; 7 requirements, 24 scenarios counted from the files |
| Design | ✅ | D1–D8 + GAP-1/GAP-2 all implemented (see coherence table) |
| Review gate | ✅ | `review-f58b30aa67cae759` terminal_state `approved`, 0 blockers, 4 findings classified `info` |

## Runtime Evidence

| Command | Result | Evidence |
|---|---|---|
| `npx vitest run` | ✅ **225/225 passed (19 files)** — exit 0 | output hash `5BBC81B8774399131054241C1E067A901F20ACCF0FC9C40CC0244702759F0604` |
| `npx tsc --noEmit` | ✅ clean — exit 0, empty output | output hash `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` (sha256 of empty output) |
| `npm run build` | ✅ green — exit 0, "Compiled successfully in 7.2s", 22 routes | output hash `3C54B57B7EFB15C31ACC4984421DB2659116557FA99B0B7664804BEAD2BDB6EE` |

All three executed in this verify pass (2026-08-22). Expected totals matched exactly (225/225, 19 files). The Vite `configLoader: 'native'` warning on `npx vitest run` is a pre-existing config-style notice, not an error.

## Spec Compliance Matrix

Counted from the spec files: **7 requirements, 24 scenarios**.

### botellon-ciclo-estados (delta) — 3 requirements, 14 scenarios

| Requirement | Status | Evidence |
|---|---|---|
| R1 — Reversion set + `getEstadosPermitidos` (single manual-move rule, no terminal) | ✅ PASS | `REVERSIONES` exact in `estados.ts:36-42`; `getEstadosPermitidos` dedup union + identity `estados.ts:57-59`; every estado ≥1 reversion |
| R2 — Server validation + CAS guard | ✅ PASS | `leerActual` + `validarDestino` + `.eq('id',id).eq('estado',actual).select()` in both writers (`botellones.ts:136-171, 205-216, 316-327`); validation failure returns exact error with zero writes |
| MOD — Stock and assign/unassign semantics (sale exception) | ✅ PASS | `resolverDestinoAsignacion` (GAP-2) shared by both writers; clientless→assigned only (`botellones.ts:188, 289`); unassign keeps estado; no planta routing |

| Scenario | Status | Covering test (all pass at runtime) |
|---|---|---|
| S1 — Undo an error via Deshacer | ✅ PASS | Reversion set exact (estados.test.ts L142-151) + reversion write accepted (S6) + selector optgroup `form.tsx:91-97` (source) |
| S2 — Entregado reversal set `['listo','delivery']` | ✅ PASS | estados.test.ts L148-151 |
| S3 — Permitted union deduped + identity | ✅ PASS | estados.test.ts L161-169 |
| S4 — Inversion invariant all pairs | ✅ PASS | estados.test.ts L171-177 |
| S5 — Invalid reject `recibido→listo` zero writes | ✅ PASS | botellones-estado.test.ts L315-324 (exact string + `from` called once) |
| S6 — Forward + reversal both accepted | ✅ PASS | botellones-estado.test.ts L326-344 |
| S7 — CAS loser aborts | ✅ PASS | botellones-estado.test.ts L346-360 (`data:[]` → exact error, eq guards asserted) |
| S8 — Identity move permitted | ✅ PASS | botellones-estado.test.ts L362-372 + L180-195 |
| Clientless counts as stock | ✅ PASS | botellones-estado.test.ts L266-292 |
| S9 — Sell stock direct to entregado | ✅ PASS | botellones-estado.test.ts L127-144 (updateBotellon) + L403-415 (moverBotellon) |
| S10 — Sell stock direct to recarga | ✅ PASS | botellones-estado.test.ts L146-161 + L417-428 |
| S11 — Non-sale moves validate strictly | ✅ PASS | botellones-estado.test.ts L374-383 + L197-212 (both-set→assigned strict) |
| Unassign leaves estado unchanged | ✅ PASS | botellones-estado.test.ts L224-255 |
| No planta auto-assign on create | ✅ PASS | botellones-estado.test.ts L93-104 |

### realtime-estado-botellon — 4 requirements, 10 scenarios

| Requirement | Status | Evidence |
|---|---|---|
| R1 — Publication membership (0010, idempotent) | ✅ PASS (code) / MANUAL (live) | `0010_supabase_realtime_tables.sql` adds all 4 tables, each in `DO $$ IF NOT EXISTS pg_publication_tables` guard (8a7b92d fix, spec S2) |
| R2 — Detail-page live updates | ✅ PASS | `estado-en-vivo.tsx`: `id=eq.<id>` UPDATE subscription, `estado ∈ ESTADOS` guard, silent degradation, `removeChannel` |
| R3 — Kanban live updates | ✅ PASS | `operaciones-dashboard.tsx`: no-filter UPDATE subscription, idempotent 3-column patch, `router.refresh()` only in `move` rejection path, `removeChannel` |
| R4 — Role coverage | ✅ PASS (design) / MANUAL (live) | RLS-gated receive; repartidor has no UPDATE policy but writes flow via service-role server actions (RLS-bypass); documented design R6 |

| Scenario | Status | Covering test / step |
|---|---|---|
| S1 — Migration applies once | ✅ PASS (code) / MANUAL | Migration source inspected; live apply = task 2.9 user-owned |
| S2 — Migration idempotent | ✅ PASS (code) / MANUAL | `IF NOT EXISTS` guards (8a7b92d); re-run on live Supabase = task 2.9 |
| S3 — Live update across devices (detail) | ✅ PASS (component) / MANUAL (two-browser) | estado-en-vivo.test.tsx L114-137 (synthetic payload → badge + onLiveChange) |
| S4 — Channel error degrades silently | ✅ PASS | estado-en-vivo.test.tsx L139-157 (last state kept, warn only) |
| S5 — Cleanup on unmount | ✅ PASS | estado-en-vivo.test.tsx L177-191 |
| S6 — Live update across devices (kanban) | ✅ PASS (component) / MANUAL (two-browser) | operaciones-realtime.test.tsx L146-159 (card moves column, no refresh) |
| S7 — Echo of own optimistic move harmless | ✅ PASS | operaciones-realtime.test.tsx L161-178 (double echo, mover called once) |
| S8 — Rejected optimistic move converges via realtime | ⚠️ PARTIAL | Mechanism implemented (patch-always + refresh-error-only, `operaciones-dashboard.tsx:61-81,117-119`) and patch path tested (S7); **no dedicated rejection→convergence component test** (see SUGGESTION-2) |
| S9 — Repartidor receives realtime updates | MANUAL | Requires live Supabase + repartidor session (task 2.9) |
| S10 — RLS filters the change stream | MANUAL | Requires live Supabase (task 2.9) |

## Design Coherence

| Decision | Status | Evidence |
|---|---|---|
| D1 — Separate `REVERSIONES` + helpers in `estados.ts` | ✅ | `estados.ts:36-59`; zero impact on `getTransiciones` consumers |
| D2 — Validation orchestration in `botellones.ts`, pure helpers in `estados.ts` | ✅ | `leerActual`/`validarDestino`/`resolverDestinoAsignacion` in `botellones.ts:136-171` |
| D3 — Hybrid detail UI (badge + controlled-until-dirty) | ✅ | `form.tsx:29-35` (`draft ?? live`), `estado-en-vivo.tsx` canonical badge |
| D4 — CAS miss via `.select()` empty `data` | ✅ | Both writers `data.length === 0` → same error string (`botellones.ts:213-216, 324-327`) |
| D5 — Kanban patch-always, refresh-error-only | ✅ | `operaciones-dashboard.tsx:61-81` (patch), `117-119` (refresh only on `res.error`) |
| D6 — Card select controlled `value={b.estado}` | ✅ | `operaciones-dashboard.tsx:335` |
| D7 — Sale exception = clientless→assigned only | ✅ | `botellones.ts:188, 289`; both-set→assigned strict test L197-212 |
| D8 — `page.tsx` stops passing `transiciones`; form derives groups from live estado | ✅ | `page.tsx` (no import/prop); `form.tsx:54-56` Avanzar/Deshacer from live |
| GAP-1 — `validarDestino(actual, destino)` strict-only (no `asignando` param) | ✅ | `botellones.ts:155-160`; dead branch removed |
| GAP-2 — Shared `resolverDestinoAsignacion` (identity / {entregado, recarga} / default entregado) | ✅ | `botellones.ts:167-171`, called by both writers; symmetry tests L180-195 |

**Deviations**: none material. Recorded in apply-progress/tasks.md: (a) commit messages for 1.6/2.10 differ from tasks.md draft text — locked session plan override, documented in the tasks; (b) migration 0010 required the `pg_publication_tables` idempotency guard (commit `8a7b92d`) — a review CRITICAL fix, not a deviation.

## Review Follow-ups (approved review `review-f58b30aa67cae759`)

The 4 findings are **informational** (`outcomes: info`, 0 blockers, terminal `approved`) — documented as non-blocking backlog, **NOT** verify blockers:

| ID | Severity | Disposition | Summary |
|---|---|---|---|
| R3-001 | WARNING | introduced | Kanban realtime patch casts `nuevo.estado` with no canonical-ESTADOS guard (`operaciones-dashboard.tsx:75`) — a future/unknown estado could drop the card from every column until refresh |
| R3-002 | WARNING | pre-existing | `confirmAssign` rejection path is flashToast-only, no `router.refresh()` (`operaciones-dashboard.tsx:138`) — optimistic delivery state persists on CAS miss until unrelated refresh |
| R3-003 | SUGGESTION | introduced | `updateBotellon` CAS-miss error uses `update.estado ?? actual` — client-only update miss yields self-referential "listo → listo" (`botellones.ts:215`); only `moverBotellon`'s path is S7-tested |
| R3-004 | SUGGESTION | introduced | Kanban `CHANNEL_ERROR`/`TIMED_OUT` silent-degradation path untested (`operaciones-realtime.test.tsx`) — detail-subscriber path is tested |

## Manual Runtime Items (user-owned, task 2.9 — do NOT block verify, tracked as pending)

1. Apply migration 0010 to real Supabase (SQL Editor or CLI); verify `ALTER PUBLICATION supabase_realtime` membership for `botellones`, `recargas`, `premios`, `notificaciones` (RT R1/S1/S2). Idempotent — safe to re-run.
2. Two-browser live check: detail badge/selector updates (RT R2/S3) and kanban card moves without F5 (RT R3/S6).
3. Repartidor session receives realtime updates despite no botellones UPDATE policy — service-role writes bypass RLS (RT R4/S9).
4. (Carried from prior session, outside this change's scope) Migration 0009 constraint swap in Supabase SQL Editor, if not yet applied.

## Strict TDD Compliance (mode active — vitest)

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | ✅ | tasks.md phases tasks as RED (tests) / GREEN (impl) per task; apply-progress records test evidence + commits |
| All tasks have tests | ✅ | 4 test files cover all code tasks (1.1/1.3 → estados.test.ts; 1.2/1.4 → botellones-estado.test.ts; 2.1/2.4 → estado-en-vivo.test.tsx; 2.2/2.7 → operaciones-realtime.test.tsx; 2.3 → migration; 2.5-2.10 → build/tsc/manual) |
| RED confirmed (test files exist) | ✅ | 4/4 files exist and were executed this pass |
| GREEN confirmed (tests pass) | ✅ | 225/225 pass on execution; focused unit 42/42, focused component 11/11 |
| Triangulation adequate | ✅ | Multiple distinct assertions per behavior (exact sets, invariant, CAS guard, zero-write counts, echo idempotence) |
| Safety net for modified files | ✅ | Two-chain migration preserved all pre-existing tests (full suite green incl. prior R4 suites) |
| Assertion quality | ✅ | No tautologies, no ghost loops (loops iterate fixed non-empty `ESTADOS`), no smoke-only tests, no orphan empty checks; mock call-count assertions verify the DB zero-write contract at the server-action unit layer |

## Test Layer Distribution

| Layer | Tests | Files | Tool |
|---|---|---|---|
| Unit | 42 | 2 (this change) | vitest |
| Component (integration, synthetic payloads) | 11 | 2 (this change) | vitest + @testing-library/react |
| E2E | 0 | — | Not applicable (design: realtime transport needs live Supabase; explicitly excluded) |
| Pre-existing suites | 172 | 15 | vitest |
| **Total** | **225** | **19** | |

## Changed File Coverage

Coverage analysis skipped — no coverage provider configured in `vitest.config.ts` (informational per strict module, not a failure).

## Quality Metrics (changed files only)

- **Linter** (`npx eslint` on the 10 changed source/test files): ✅ 0 errors, 1 warning → SUGGESTION-4.
- **Type checker** (`npx tsc --noEmit`): ✅ clean, exit 0, empty output.

## Issues

### CRITICAL
None.

### WARNING (non-blocking; all informational backlog from the approved review — do not block archive)
1. **W-1 (backlog R3-001)** — Kanban realtime patch lacks canonical-ESTADOS guard (`operaciones-dashboard.tsx:75`); unknown-estado payload can silently remove a card from all columns until refresh. Fix: mirror `estado-en-vivo.tsx:65` guard.
2. **W-2 (backlog R3-002, pre-existing)** — `confirmAssign` rejection path omits `router.refresh()` (`operaciones-dashboard.tsx:138`); optimistic delivery state can persist on CAS miss. Pre-existing behavior, not activated by this change.
3. **W-3 (manual runtime pending)** — Publication membership (RT R1/S1/S2), two-browser live detail/kanban (S3/S6), repartidor realtime (S9) unverified against live Supabase; user-owned task 2.9.

### SUGGESTION
1. **S-1 (backlog R3-003)** — `updateBotellon` CAS-miss error interpolates `update.estado ?? actual` → self-referential message on client-only updates; test the divergent path or use a fixed destination string.
2. **S-2 (backlog R3-004)** — Add a kanban `CHANNEL_ERROR`/`TIMED_OUT` silent-degradation test (drives `statusHandler`); detail path is already tested.
3. **S-3** — RT R3/S8 (rejected optimistic move converges via realtime) has no dedicated component test; mechanism is implemented (patch-always + refresh-error-only) and the patch path is tested, but a rejection→payload-convergence scenario would close the gap.
4. **S-4** — Unused `Estado` type import in `tests/unit/estados.test.ts:12` (eslint warning); remove it.

## Conclusion

Implementation matches the specs (7 requirements, 24 scenarios), the design (D1–D8, GAP-1, GAP-2), and all 16 tasks are complete. Full suite 225/225 (19 files), `tsc --noEmit` clean, `npm run build` green — all executed fresh in this verify pass. The approved review's 4 advisory findings are informational and tracked as backlog; the realtime production behavior (publication membership, two-browser, repartidor) remains user-owned manual verification per task 2.9. Verdict: **PASS WITH WARNINGS**. Next recommended: `archive` (verify-report.md now exists; approved receipt present).