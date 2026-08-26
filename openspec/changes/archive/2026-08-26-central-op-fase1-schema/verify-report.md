```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:8f05f0e8d003ec1405e9e3d508383b357c9563519190ca87fa6b712358d54671
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 34/34
test_command: npm run test
test_exit_code: 0
test_output_hash: sha256:8f05f0e8d003ec1405e9e3d508383b357c9563519190ca87fa6b712358d54671
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verification Report — central-op-fase1-schema

- **Change**: `central-op-fase1-schema`
- **Mode**: Strict TDD (active — `npm run test`) · hybrid persistence (openspec file + Engram topic `sdd/central-op-fase1-schema/verify-report`)
- **Verdict**: **PASS WITH WARNINGS** — all 9 requirements / 34 scenarios compliant; full suite green; live DB matches the migrations. Warnings are pre-existing/out-of-scope items (remote 9-estado check constraint, local 14.15 type-file staleness) plus two apply-documented non-blocking deviations. Nothing blocks archive.
- **Next recommended**: `archive`
- **Verified against**: proposal.md, specs/central-operaciones-schema/spec.md (REQ-COS-1..7), specs/botellon-ciclo-estados/spec.md (2 MODIFIED), design.md, tasks.md (11/11 `[x]`), apply-progress (Engram #634).

## Completeness

| Check | Status | Details |
|---|---|---|
| Tasks (tasks.md) | ✅ 11/11 | All `[x]`; T1.1–T2.3 (PR-A SQL), T3.1–T5.1 (PR-B TS) |
| Commits (branch `redesign/central-operaciones`) | ✅ 4 | `ef162b7` 0011 · `1e9d86e` 0012 · `bc74e46` grupos util · `46a4782` types + rls test |
| Proposal | ✅ | Intent/scope/business rules match implementation |
| Specs | ✅ | 2 delta specs read; **9 requirements, 34 scenarios** counted from the files (COS: 7 req / 21 scenarios; MOD: 2 req / 13 scenarios) |
| Design | ✅ | D1–D12 all followed (see coherence table); 2 documented non-blocking deviations |
| Untouched-file guarantee | ✅ | `git diff --name-only HEAD~4` shows zero diffs on `estados.ts`, `botellones.ts`, `botellones-estado.test.ts`, `estados.test.ts`, migration 0010 — old writers and machine untouched |
| Apply evidence | ✅ | Engram #634 (TDD Cycle Evidence + per-task SQL verification evidence) |

## Runtime Evidence

| Command | Result | Evidence |
|---|---|---|
| `npm run test` | ✅ **239/239 passed (21 files)** — exit 0 | output hash `8F05F0E8D003EC1405E9E3D508383B357C9563519190CA87FA6B712358D54671` |
| `npx tsc --noEmit` | ✅ clean — exit 0, empty output | output hash `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` (sha256 of empty output) |
| `npm run build` | ✅ green — exit 0 | output hash `196EA7D47C2AE6226B9B8470CCCE8134544B1D9E5E71CC88EB2B885B290BF93F` |
| `npx eslint` (4 changed PR-B files) | ✅ 0 errors, 2 warnings | warnings pre-existing in modified `rls-policies.test.ts` (see S-1) |

All executed in this verify pass (2026-08-26). Expected totals matched exactly (239/239, 21 files). The Vite `configLoader: 'native'` notice is the same pre-existing config-style warning noted in the archived report, not an error.

## Live Database Verification (Supabase MCP, read-only)

| Check | Expected | Actual | Result |
|---|---|---|---|
| `pg_policies` on `movimientos` | 5 policies (admin SELECT/INSERT/UPDATE/DELETE + repartidor SELECT), `TO authenticated` | 5 policies, exact match | ✅ |
| `estado_desde` column | `timestamptz NOT NULL DEFAULT now()` | `timestamp with time zone`, `is_nullable: NO`, `column_default: now()` | ✅ |
| NULL `estado_desde` rows | 0 | 0 of 15 rows | ✅ |
| `movimientos` count | ~10 (audit of apply test activity) | 10 | ✅ |
| `mover_botellones` exists | `(p_ids uuid[], p_estado text)`, SECURITY DEFINER, `search_path=''` | present, SECURITY DEFINER, `search_path=""` | ✅ |
| `estados_permitidos` exists | `(p_estado text) → text[]`, STABLE, `search_path=''` | present, STABLE, `search_path=""` | ✅ |
| `fn_trg_estado_desde` exists | trigger fn, SECURITY DEFINER, `search_path=''` | present, SECURITY DEFINER, `search_path=""` | ✅ |
| Trigger on `botellones` | `BEFORE UPDATE ... FOR EACH ROW` → `fn_trg_estado_desde` | exact match | ✅ |
| Index | `idx_movimientos_botellon (botellon_id)` | present (plus PK) | ✅ |
| RLS enabled on `movimientos` | `relrowsecurity = true` | true | ✅ |
| Function ACLs | no `anon`/PUBLIC EXECUTE | `estados_permitidos`/`mover_botellones`: postgres+authenticated+service_role only; `fn_trg_estado_desde`: postgres+service_role only | ✅ |
| `estados_permitidos(e)` vs TS `getEstadosPermitidos(e)` | order-identical for all 5 estados | `entregado:[recibido,listo,delivery,entregado]` · `recibido:[recarga,entregado,recibido]` · `recarga:[listo,recibido,recarga]` · `listo:[entregado,delivery,recarga,listo]` · `delivery:[entregado,listo,delivery]` — all identical to `estados.ts` TRANSICIONES+REVERSIONES+identity | ✅ |
| Backfill spot-check (15 real rows) | `entregado`→`fecha_entrega` when set, else `fecha_creacion`; all others→`fecha_creacion` | BOT-00048 (entregado+fecha_entrega) → fecha_entrega; BOT-00037 (entregado, no fecha_entrega) → fecha_creacion; BOT-00047 (recarga + stale fecha_entrega) → fecha_creacion; all 15 consistent | ✅ |
| `botellones_estado_check` (remote) | — | still the **9-estado** constraint (recibido/planta/recarga/listo/delivery/entregado/danado/perdido/mantenimiento) — migration 0009 never applied remotely | ⚠️ W-1 (pre-existing, out of scope) |

## Spec Compliance Matrix

Counted from the spec files: **9 requirements, 34 scenarios**.

### central-operaciones-schema — 7 requirements, 21 scenarios

| Requirement | Status | Evidence |
|---|---|---|
| REQ-COS-1 — `estado_desde` + FIFO backfill | ✅ PASS | Live column DDL (timestamptz NOT NULL DEFAULT now()); 0 NULL; backfill spot-check matches COALESCE chain per estado |
| REQ-COS-2 — `movimientos` audit table | ✅ PASS | Live: table + index + RLS enabled + 5 policies (admin CRUD / repartidor SELECT); no synthesized history (migration has no INSERT..SELECT; post-migration count was 0, live 10 = audit of apply tests) |
| REQ-COS-3 — Trigger contract | ✅ PASS | Live trigger/fn present (SECURITY DEFINER, pinned search_path); `IS DISTINCT FROM` guard + stamp + audit + `auth.uid()` in source; behavior proven at apply T1.3 (stamp+1 row, no-op 0 rows, service-role NULL uid); 10 live audit rows are runtime proof the trigger fires |
| REQ-COS-4 — `mover_botellones` batch RPC | ✅ PASS | Live fn signature + SECURITY DEFINER + ACL; source: JWT role guard, DISTINCT UNNEST, validation inside UPDATE WHERE (TOCTOU-free), GET DIAGNOSTICS vs cardinality, RAISE→rollback; behavior proven at apply T2.3 (valid batch 3+3 audit, partial-invalid zero writes, recibido→listo rejected, no-JWT/cliente rejected pre-UPDATE, identity ok, `cliente_id` never touched) |
| REQ-COS-5 — SQL machine mirror | ✅ PASS | Live `estados_permitidos(e)` order-identical to TS for all 5 estados; CASE comments cite `estados.ts:22-28/36-42/57-59` |
| REQ-COS-6 — `GrupoCliente`/`agrupar()` | ✅ PASS | `tests/unit/grupos.test.ts` 8/8 green; implementation matches design snippet exactly |
| REQ-COS-7 — DB type updates | ✅ PASS | `database.ts` source: `estado_desde` in Row/Insert/Update, `movimientos` table + FK Relationship, `mover_botellones` signature; `tsc --noEmit` exit 0; `npm run build` exit 0; writers untouched & green |

| Scenario | Status | Covering test / evidence |
|---|---|---|
| COS-1·S1 — Column applied and NOT NULL | ✅ PASS | Live `information_schema.columns` (timestamptz, NO, `now()`) |
| COS-1·S2 — Backfill picks per-estado source | ✅ PASS | Live BOT-00048 (entregado→fecha_entrega), BOT-00047 (recarga→fecha_creacion despite fecha_entrega) |
| COS-1·S3 — Fallback when no source exists | ✅ PASS | Migration COALESCE chain ends in `now()` (source); no row left at migration-time default (apply audit) |
| COS-2·S1 — RLS mirrors admin/repartidor roles | ✅ PASS | Live `pg_policies`: admin 4 ops + repartidor SELECT, `TO authenticated` |
| COS-2·S2 — No synthesized history | ✅ PASS | Migration source (no backfill INSERT..SELECT); post-migration count 0 (apply); live 10 = test-activity audit only |
| COS-3·S1 — Estado change stamps and audits | ✅ PASS | Apply T1.3(a) (stamp + 1 audit row); trigger source; 10 live audit rows |
| COS-3·S2 — No-op update inserts nothing | ✅ PASS | Apply T1.3(b) (timestamp untouched + 0 rows); `IS DISTINCT FROM` guard in source |
| COS-3·S3 — Service-role write has null user | ✅ PASS | Apply T1.3(c) (`usuario_id` NULL); `auth.uid()` returns NULL without JWT |
| COS-4·S1 — Valid batch moves in one transaction | ✅ PASS | Apply T2.3: 3×`recarga→listo` = 3 updated + 3 audit rows |
| COS-4·S2 — Partial-invalid batch rolls back entirely | ✅ PASS | Apply T2.3: '2 de 3' → exception + zero writes (estados + movimientos unchanged) |
| COS-4·S3 — Rejected jump mirrors the manual rule | ✅ PASS | Apply T2.3: `recibido→listo` → '0 de 1' rejected, zero writes |
| COS-4·S4 — Unauthenticated or wrong role rejected | ✅ PASS | Apply T2.3: no-JWT and `cliente` role → 'Permiso denegado' pre-UPDATE; role guard in source |
| COS-4·S5 — Identity move permitted without audit row | ✅ PASS | Apply T2.3: identity + duplicate p_ids dedupe → success, no audit row; trigger guard in source |
| COS-5·S1 — Mirror equals the TS machine | ✅ PASS | Live: all 5 arrays order-identical (`=`-comparable) to `getEstadosPermitidos` |
| COS-5·S2 — Reversion and identity included | ✅ PASS | Live: `estados_permitidos('recibido')` = `[recarga, entregado, recibido]` (reversion + identity present) |
| COS-6·S1 — Groups sort oldest-first | ✅ PASS | grupos.test.ts L23-29 |
| COS-6·S2 — Group age is the min, codes oldest-first | ✅ PASS | grupos.test.ts L31-39 (min) + L41-48 (codes) |
| COS-6·S3 — Null key is a stock group | ✅ PASS | grupos.test.ts L58-68 (stock group, never dropped) |
| COS-6·S4 — Tiebreak by codigo | ✅ PASS | grupos.test.ts L50-56 |
| COS-7·S1 — Types reflect the new schema | ✅ PASS | `tsc --noEmit` exit 0; `database.ts` source (estado_desde, movimientos, RPC) |
| COS-7·S2 — Existing writers unaffected | ✅ PASS | Full suite green; `git diff` confirms `botellones.ts`/`botellones-estado.test.ts` byte-unchanged |

### botellon-ciclo-estados (delta) — 2 requirements, 13 scenarios

| Requirement | Status | Evidence |
|---|---|---|
| MOD-1 — Reversion set + `getEstadosPermitidos` (single manual-move rule) + SQL mirror | ✅ PASS | `REVERSIONES` exact `estados.ts:36-42`; dedup union + identity `estados.ts:57-59`; S-M1 proven by live SQL diff (all 5 estados); S-M2 proven by RPC source (`p_estado = ANY(estados_permitidos(estado))` inside WHERE) + apply rejection |
| MOD-2 — Server-side validation + CAS guard + stamp/audit side-effect on every write path | ✅ PASS | `botellones-estado.test.ts` untouched & green (S5–S8); S-A1/S-A2 proven by apply T1.3; S-A3 proven by apply T2.3 (one audit row per bottle) |

| Scenario | Status | Covering test / evidence |
|---|---|---|
| S1 — Undo an error via Deshacer | ✅ PASS | estados.test.ts (untouched, green; reversion set + reversal write accepted) |
| S2 — Entregado reversal set `['listo','delivery']` | ✅ PASS | estados.test.ts L148-151 |
| S3 — Permitted union deduped + identity | ✅ PASS | estados.test.ts L161-169 |
| S4 — Inversion invariant all pairs | ✅ PASS | estados.test.ts L171-177 |
| S-M1 — SQL mirror equals the TS machine | ✅ PASS | Live `estados_permitidos` vs `getEstadosPermitidos` — all 5 order-identical |
| S-M2 — Batch mover validates against the mirror | ✅ PASS | RPC source + apply T2.3 (`recibido→listo` rejected, zero writes) |
| S5 — Invalid manual move rejected with zero writes | ✅ PASS | botellones-estado.test.ts L315-324 (exact string, `from` called once) |
| S6 — Forward move and reversal both accepted | ✅ PASS | botellones-estado.test.ts L326-344 |
| S7 — Concurrent moves: CAS loser aborts | ✅ PASS | botellones-estado.test.ts L346-360 |
| S8 — Identity move permitted | ✅ PASS | botellones-estado.test.ts L362-372 |
| S-A1 — Successful write stamps and audits | ✅ PASS | Apply T1.3(a) (estado_desde stamped + movimientos row with current user) |
| S-A2 — No-op write appends nothing | ✅ PASS | Apply T1.3(b) (0 rows, timestamp untouched) |
| S-A3 — Batch RPC is audited per bottle | ✅ PASS | Apply T2.3 (3 updated → 3 movimientos rows, one per bottle) |

**Compliance summary**: 34/34 scenarios compliant (mix of live-SQL, unit/integration tests, and migration-source evidence; the two DB layers' behavioral scenarios were functionally proven at apply against the live project and re-confirmed structurally here).

## Design Coherence

| Decision | Followed? | Notes |
|---|---|---|
| D1 — Validation inside UPDATE WHERE (TOCTOU-free) | ✅ | `mover_botellones` L72-75: `AND p_estado = ANY(estados_permitidos(estado))` |
| D2 — Trigger SECURITY DEFINER + pinned `search_path=''` | ✅ | `fn_trg_estado_desde` live: SECURITY DEFINER, `search_path=""` |
| D3 — Backfill source (`fecha_creacion` primary, `fecha_entrega` only entregado) | ✅ | 0011 L29-33; live spot-check confirms |
| D4 — `ADD COLUMN NOT NULL DEFAULT now()` then UPDATE | ✅ | 0011 L26-33 |
| D5 — SQL CASE fn mirror | ✅ | `estados_permitidos` live; CASE comments cite estados.ts lines |
| D6 — `RETURN QUERY SELECT` (no temp table) | ✅ | 0012 L85 |
| D7 — `DISTINCT UNNEST` dedupe | ✅ | 0012 L68 |
| D8 — `movimientos.botellon_id` FK ON DELETE CASCADE | ✅ | 0011 L39 |
| D9 — Per-op RLS policies, 0001 style | ✅ | 5 live policies, `TO authenticated`, inline app_metadata role check |
| D10 — Explicit JWT role guard in RPC | ✅ | 0012 L62-65; apply T2.3 role scenarios |
| D11 — Pure `agrupar()` + `cmpCliente` private | ✅ | `grupos.ts` matches design; `cmpCliente` not exported |
| D12 — Hand-edit `database.ts` (14.15 convention) | ✅ (with note) | Followed local convention; live 14.17 generator diverges (see W-2) |

**Deviations** (all non-blocking, documented in apply-progress/tasks.md):
1. Design verification table says "6 `movimientos` policies"; the design's own named list sums to **5**, and the migration + live DB + `rls-policies.test.ts` all implement 5 (admin 4 + repartidor SELECT). The 5-policy set satisfies spec REQ-COS-2 exactly. Design-doc count nit only.
2. Design says rename "two" 9-table test names; there are **three** — all three renamed (apply T4.1).
3. `database.ts` RPC `Returns` kept as 14.15 SETOF shape (`undefined | { Row }`); live 14.17 generator emits `{...}[]` + `SetofOptions`. Follows the file's own convention (D12), documented.

## Strict TDD Compliance (mode active — vitest)

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ✅ | tasks.md RED/GREEN phases per task; apply-progress #634 explicit "TDD Cycle Evidence (PR-B, Strict TDD)" table |
| All tasks have tests | ✅ | T3.1/T3.2 → `grupos.test.ts` (8 tests); T4.1/T4.2 → `rls-policies.test.ts` (+movimientos entry); T1.x/T2.x → SQL functional verification (MCP harness per design testing strategy); T5.1 → full regression |
| RED confirmed (tests exist) | ✅ | 2/2 PR-B test files exist and were executed this pass (8 + 7 tests) |
| GREEN confirmed (tests pass) | ✅ | 239/239 pass on execution (focused grupos 8/8, rls 7/7) |
| Triangulation adequate | ✅ | grupos 8-case matrix covers all 4 REQ-COS-6 scenarios + totality + edges; rls matrix asserts admin CRUD + repartidor SELECT across all 10 tables |
| Safety Net for modified files | ✅ | T4.1 "safety net 7/7 baseline first"; T3.2/T5.1 full-suite green (20→21 files, 231→239 tests) |
| Assertion quality | ✅ | No tautologies, no ghost loops (rls loops iterate a fixed literal constant), no smoke-only tests, zero mocks; all assertions verify real behavior |

**TDD Compliance**: 7/7 checks passed

---

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit (this change) | 8 | 1 (`grupos.test.ts`) | vitest |
| Integration/expectation (this change) | 7 | 1 (`rls-policies.test.ts`, modified) | vitest |
| Pre-existing suites | 224 | 19 | vitest |
| **Total** | **239** | **21** | |

---

### Changed File Coverage

Coverage analysis skipped — no coverage provider configured in `vitest.config.ts` (informational per strict module, not a failure).

---

### Quality Metrics (changed files only)

- **Linter** (`npx eslint` on `grupos.ts`, `grupos.test.ts`, `database.ts`, `rls-policies.test.ts`): ✅ 0 errors, 2 warnings → SUGGESTION-1.
- **Type checker** (`npx tsc --noEmit`): ✅ clean, exit 0, empty output.

## Issues

### CRITICAL
None.

### WARNING (non-blocking — pre-existing / out-of-scope, do NOT block archive)
1. **W-1 (pre-existing, out of scope)** — Remote `botellones_estado_check` still permits **9 estados** (recibido, planta, recarga, listo, delivery, entregado, danado, perdido, mantenimiento); migration 0009 was never applied to the live project. The 5-estado machine (`estados.ts`), the SQL mirror, and `estados_permitidos`' `ELSE ARRAY[p_estado]` fallback assume only the 5 canonical estados. Latent inconsistency: a row carrying a legacy estado (e.g. `planta`) can be moved to itself via the RPC, and manual writers reject it. This change is correct against the spec'd 5-estado model; the constraint swap is tracked elsewhere and should be applied before fase-3 UI depends on strict 5-estado data.
2. **W-2 (pre-existing, out of scope, D12)** — Local `src/types/database.ts` is the 14.15-format generated file and is already stale re `fecha_entrega` (migration 0005). The live 14.17 generator emits `fecha_entrega` in the `botellones` Row and a different `mover_botellones` `Returns` shape (`{...}[]` + `SetofOptions`). The hand-edit follows the file's own 14.15 convention and type-checks; a future `supabase gen types` regeneration would reconcile both.

### SUGGESTION
1. **S-1** — `npx eslint` warnings in `tests/integration/rls-policies.test.ts` L68/L78: `table` destructured in the `for..of` loops but unused (pre-existing pattern in a modified file). Use `for (const [, roles] of ...)` or `Object.values`.
2. **S-2** — `rls-policies.test.ts` is an expectation-documentation test (no live DB query; actual RLS proof runs at verify via MCP SQL — done in this pass). This is the project's deliberate convention (same as archived change), but the file could optionally call `pg_policies` live when a DB session is available.
3. **S-3** — REQ-COS-4's "entregado via RPC without client" note has no live clientless-`entregado` row among the 15 to exercise; it is proven by source inspection (zero `cliente_id` references in the RPC) plus the apply cliente-preservation test. A live check on a future clientless row would close the gap.
4. **S-4** — Design verification table's "6 `movimientos` policies" count contradicts its own 5-policy named list (admin 4 + repartidor SELECT). Implementation is correct at 5; the design doc count should be corrected to 5 to avoid future confusion.

## Conclusion

Implementation matches the specs (9 requirements, 34 scenarios), the design (D1–D12, with 3 documented non-blocking deviations), and all 11 tasks are complete. Full suite 239/239 (21 files), `tsc --noEmit` clean, `npm run build` green — all executed fresh in this verify pass. Live Supabase checks confirm the 0011/0012 migrations exactly as specified: `estado_desde` timestamptz NOT NULL DEFAULT now() with 0 NULLs, 5 RLS policies on `movimientos` (admin CRUD / repartidor SELECT), trigger present and firing (10 audit rows), `mover_botellones`/`estados_permitidos` present with correct security and ACLs, and the SQL mirror order-identical to the TS machine for all 5 estados. The two warnings are pre-existing/out-of-scope items (remote 9-estado constraint, 14.15 type-file staleness) and do not block archive. Verdict: **PASS WITH WARNINGS**. Next recommended: `archive`.