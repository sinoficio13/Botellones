# Tasks: Central de Operaciones — Fase 1 (FIFO schema, audit trail, batch mover RPC)

**Change**: `central-op-fase1-schema` · **Delivery**: ask-always · **Strict TDD** (`tdd: true`, `test_command: "npm run test"` per `openspec/config.yaml`)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR-A ~220 · PR-B ~270 · total ~490 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR-A: SQL migrations 0011+0012 → PR-B: TS layer (chained on PR-A) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain (design-recommended; user confirms before apply) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| PR-A | SQL migrations 0011 + 0012 (REQ-COS-1..5 + MOD) | PR-A (base: feature branch) | Per-requirement SQL checks via supabase MCP/CLI | Supabase project — apply 0011→0012, run functional SQL (stamp/audit/RPC scenarios) | Reverse order: DROP `mover_botellones` + `estados_permitidos` (0012); DROP trigger/fn/`movimientos`/column (0011). Data-safe, additive |
| PR-B | TS layer: `grupos.ts` + tests, `database.ts` + rls test (REQ-COS-6/7) | PR-B (base: PR-A branch) | `npm run test` (vitest grupos + rls-policies); `npm run build` | N/A — pure TS/type-level, no runtime boundary; vitest is the harness | Revert `grupos.ts`, `grupos.test.ts`, `database.ts`, `rls-policies.test.ts` (additive) |

### Requirement → Task Traceability

REQ-COS-1→T1.1/T1.2 · REQ-COS-2→T1.1/T1.2 · REQ-COS-3→T1.1/T1.3 · REQ-COS-4→T2.1/T2.3 · REQ-COS-5→T2.1/T2.2 · MOD permitted-union (S-M1/S-M2)→T2.2/T2.3 · MOD stamp/audit + validation (S5–S8, S-A1–A3)→T1.3/T2.3/T5.1 · REQ-COS-6→T3.1/T3.2 · REQ-COS-7→T4.1/T4.2/T5.1

## Phase 1 — PR-A · Migration 0011 (REQ-COS-1/2/3)

- [x] **T1.1** Write `supabase/migrations/0011_fifo_estado_desde.sql`: `estado_desde` NOT NULL DEFAULT now() + per-estado backfill COALESCE chain; `movimientos` + index + RLS (6 policies, 0001 style); SECURITY DEFINER trigger fn (pinned `search_path=''`) + `DROP TRIGGER IF EXISTS`/CREATE (design §0011 steps 1–6, idempotent).
  **Accept**: file matches design §0011 exactly (backfill CASE, policy names, trigger contract). **Verify**: apply via supabase MCP, zero errors.
  **Evidence (applied 20260826200744)**: file per design; RLS = 5 policies (admin 4 + repartidor SELECT — design says "6", actual named list sums to 5; rls-policies.test.ts expects 5). Added `DROP POLICY IF EXISTS` guards so a full-file re-run never errors (CREATE POLICY has no IF NOT EXISTS — T1.3(d) criterion). Added `REVOKE ALL ... FROM PUBLIC/anon` on the trigger fn (advisors; trigger fires internally regardless of grants).
- [x] **T1.2** SQL-verify REQ-COS-1+2: `information_schema.columns` (timestamptz NOT NULL DEFAULT now()); backfill audit on 15 real rows (`entregado`→`fecha_entrega` when set, others→`fecha_creacion`, none left at migration-time default); `pg_policies` = 6 `movimientos` policies; `pg_indexes` = `idx_movimientos_botellon`; `count(*)` = 0 (no synthesized history).
  **Accept**: all queries pass. **Verify**: supabase MCP SQL (design verification table REQ-COS-1/2).
  **Evidence**: column = timestamptz NOT NULL DEFAULT now(); 0 NULL rows; BOT-00048 (entregado+fecha_entrega) → fecha_entrega, all others → fecha_creacion (BOT-00047 recarga kept fecha_creacion despite stale fecha_entrega); pg_policies = 5 (see T1.1 note); index present; movimientos count = 0.
- [x] **T1.3** SQL-verify REQ-COS-3 (MOD stamp/audit): (a) UPDATE estado → `estado_desde` stamped + 1 `movimientos` row; (b) no-op UPDATE → untouched + 0 rows; (c) service-role write → `usuario_id` NULL; (d) re-run 0011 → no error.
  **Accept**: (a)–(d) green. **Verify**: supabase MCP SQL (design REQ-COS-3).
  **Evidence**: (a) BOT-00041 recibido→recarga: estado_desde stamped now() + 1 audit row; (b) no-op received→received: timestamp + 0 rows; (c) audit row usuario_id NULL (service role); (d) full 0011 re-run OK after DROP POLICY guards. Test rows reverted; DB left at original distribution (7/2/5/1 = 15).

## Phase 2 — PR-A · Migration 0012 (REQ-COS-4/5, MOD)

- [x] **T2.1** Write `supabase/migrations/0012_rpc_mover_botellones.sql`: `estados_permitidos(text) → text[]` CASE mirror (comments cite `estados.ts:22-28/36-42/57-59`) + REVOKE/GRANT; `mover_botellones(uuid[], text)` SECURITY DEFINER: role guard (admin/repartidor), `DISTINCT UNNEST` dedupe, single UPDATE with validation in WHERE, `GET DIAGNOSTICS` vs `cardinality`, mismatch → RAISE, `RETURN QUERY` (design §0012; D5/D6/D7/D10).
  **Accept**: file matches design; grants restricted. **Verify**: apply via supabase MCP, zero errors.
  **Evidence (applied 20260826200754)**: file per design; added `SET search_path = ''` on estados_permitidos (advisor function_search_path_mutable) and explicit `REVOKE ... FROM anon` (MCP apply path lets Supabase event triggers re-grant anon EXECUTE). Final ACLs verified: EXECUTE only authenticated/postgres/service_role on both fns; trigger fn only postgres/service_role. Remaining advisor WARN is intentional (mover_botellones callable by authenticated, guard inside — D10).
- [x] **T2.2** SQL-verify REQ-COS-5 + MOD S-M1: `SELECT estados_permitidos(e)` for all 5 estados, set-identical to `getEstadosPermitidos` pinned at `tests/unit/estados.test.ts:162-166`.
  **Accept**: arrays equal for all 5 estados. **Verify**: supabase MCP SQL diff; `npm run test` (`estados.test.ts` untouched, green).
  **Evidence**: all 5 arrays order-identical to the TS output (entregado, recibido, recarga, listo, delivery); direct `=` comparison holds; estados.test.ts untouched & green.
- [x] **T2.3** SQL-verify REQ-COS-4 + MOD S-M2/S-A3 (as admin): valid batch (3×`recarga→listo`) → 3 updated + 3 `movimientos`; partial-invalid batch → exception + zero writes; `recibido→listo` rejected; unauthenticated/wrong role rejected pre-UPDATE; identity move ok + no audit row; `entregado` without client allowed.
  **Accept**: all scenarios pass. **Verify**: supabase MCP SQL (design REQ-COS-4).
  **Evidence** (JWT claims injected via request.jwt.claims GUC for role scenarios): valid batch 3×recarga→listo = 3 rows + 3 audit rows (S-A3, uid = admin); partial-invalid '2 de 3' → exception + zero writes (estados + movimientos unchanged); recibido→listo → '0 de 1' rejected; no-JWT and role=cliente → 'Permiso denegado' pre-UPDATE; repartidor accepted; identity + duplicate p_ids dedupe → success, no audit row; cliente_id never touched (preserved across entregado→listo→entregado cycle). NOTE: no clientless 'entregado' row exists among the 15, so "entregado without client" proven by code inspection (RPC body has zero cliente_id references) + cliente-preservation test. All test moves reverted; final distribution 7/2/5/1 = 15; movimientos = 10 (real audit of test activity).

## Phase 3 — PR-B · agrupar() grouping util (REQ-COS-6)

- [x] **T3.1** RED — write `tests/unit/grupos.test.ts` (8-test matrix: groups oldest-first, group age = min, codes oldest-first, codigo tiebreak, null-key stock group, totality, empty/single, group tiebreak).
  **Accept**: matrix matches design; suite fails (no `grupos.ts`). **Verify**: `npm run test`.
  **Evidence**: 8 tests written first per design matrix (REQ-COS-6 S1–S4 + total + edges); focused run RED — `Failed to resolve import "@/lib/utils/grupos"` (module absent). Matrix maps 1:1 to design §TS layer table.
- [x] **T3.2** GREEN — implement `src/lib/utils/grupos.ts` (`BotellonAgrupable`, `GrupoCliente`, total `agrupar()` + `cmpCliente`; design §TS layer).
  **Accept**: all 8 tests pass. **Verify**: `npm run test`.
  **Evidence**: implemented exactly per design snippet (null key valid via `Map<string | null, ...>`; `localeCompare` ISO sort; `cmpCliente` stock-last tiebreak, kept private per design). Focused run GREEN 8/8; full suite 21 files / 239 tests green (baseline 20/231 + 8 new). Commit `bc74e46`.

## Phase 4 — PR-B · DB types + RLS test (REQ-COS-7)

- [x] **T4.1** RED — extend `tests/integration/rls-policies.test.ts`: add `movimientos: { admin: ['SELECT','INSERT','UPDATE','DELETE'], repartidor: ['SELECT'] }` to `EXPECTED_POLICIES`; `toHaveLength(9)`→`toHaveLength(10)`; rename "all 9 tables" tests → "all 10 tables".
  **Accept**: suite fails on count (9≠10). **Verify**: `npm run test`.
  **Evidence**: safety net 7/7 baseline first; then count assertion bumped to 10 + 3 test names renamed ("all 9 tables"×3 → "all 10 tables" — design says "two", actual count is three). Focused run RED exactly on accept criterion: `expected ... length of 10 but got 9` (movimientos entry lands in T4.2, keeping the RED genuine). Migration 0011 read first — policy count confirmed **5** (admin 4 + repartidor SELECT), not 6, matching the expectation shape.
- [x] **T4.2** GREEN — hand-update `src/types/database.ts` (generated-file convention): `estado_desde` in botellones Row/Insert/Update; `movimientos` table + Relationships (botellon_id FK only, mirroring `perfiles`); `mover_botellones` RPC signature (design §TS layer; D12 — confirm `Returns` vs `supabase gen types` once 0012 is applied).
  **Accept**: tsc + suite green. **Verify**: `npm run build`; `npm run test`.
  **Evidence**: ground truth obtained via Supabase MCP `generate_typescript_types` against the live project — `movimientos` Row/Insert/Update/Relationships byte-identical to design (only `movimientos_botellon_id_fkey`, no auth.users FK); `estado_desde` shapes exact. RPC Returns kept as design's 14.15 SETOF shape (`undefined | { Row }`); live 14.17 generator emits `{...}[]` + `SetofOptions` and includes `fecha_entrega` in the Row (local file pre-stale re 0005 — D12; flagged, out of scope). Args order per design (`p_ids` then `p_estado`; generator emits alphabetical — cosmetic). Added `movimientos` expectation to rls test. Focused rls test GREEN 7/7; `npx tsc --noEmit` exit 0; full suite 21/239 green; `npm run build` compiled OK. Commit `46a4782`.

## Phase 5 — PR-B · Integration regression (MOD + REQ-COS-7 S2)

- [x] **T5.1** Regression sweep: full `npm run test`; confirm `tests/unit/botellones-estado.test.ts` (S5–S8) and `tests/unit/estados.test.ts` (S1–S4) untouched & green; `rls-policies.test.ts` green.
  **Accept**: full suite green, writer/machine tests untouched. **Verify**: `npm run test`; `npm run build`.
  **Evidence**: full suite 21 files / 239 tests green (baseline 20/231 — only the 8 new grupos tests added); `npm run build` (`next build --webpack`) compiled successfully, exit 0; `npx tsc --noEmit` exit 0. Byte-unchanged confirmed via `git diff --name-only`: `estados.ts`, `botellones.ts`, `botellones-estado.test.ts`, `estados.test.ts`, all migrations — zero diffs. rls-policies.test.ts green 7/7.

## Slice boundaries (PR-A → PR-B)

- **PR-A** (~220 lines): Phases 1–2 — `0011_fifo_estado_desde.sql` + `0012_rpc_mover_botellones.sql`. Self-verifiable against the DB; no TS dependency. Commits: `feat(db): fifo estado_desde + movimientos audit + trigger` → `feat(db): mover_botellones batch RPC`.
- **PR-B** (~270 lines, chained on PR-A): Phases 3–5 — `grupos.ts` + `grupos.test.ts` + `database.ts` + `rls-policies.test.ts`. Pure TS; RLS test documents expectations (DB queries run at verify). Commits (actual, 2026-08-26): `bc74e46 feat(utils): agrupar grouping util with FIFO ordering` → `46a4782 feat(types): estado_desde/movimientos/RPC db types + rls test`. Optional tighter split if reviewer prefers: B1 (grupos+tests, ~205) / B2 (types+rls, ~65).