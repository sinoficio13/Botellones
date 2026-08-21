# Apply Progress — estados-botellon-ciclo-puro (COMPLETE: Commit 1 + Commit 2 + Commit 3 remediation)

**Mode**: Strict TDD (vitest) · **Artifact store**: hybrid (engram + openspec)
**Scope**: Tasks 1.1–1.10 (commit 1 backend/db) + 2.1–2.14 (commit 2 frontend + docs) + R4 remediation (commit 3) — ALL DONE
**Delivery**: exception-ok, stacked-to-main, direct to main, NO PRs (user-locked 2 commits; commit 3 = verify remediation, direct to main)

## Commits

| Commit | SHA | Message | Scope |
|---|---|---|---|
| 1 | `f5abb788cb7c8dbe71a0f7aff7730eca1606ec16` | `refactor(botellones): pure 5-estado cycle backend + migration 0009` | Backend/db |
| 2 | `42644ec92e064e2b04c357a74a0e010b6200788f` | `refactor(ui): drop exception/planta UI, fix badge maps, docs → 5-estado cycle` | Frontend + docs |
| 3 | `17e9cf2c9aabdf1524ab7cbc96529443db7b004f` | `test(botellones): add R4 stock/assign/unassign/create coverage` | R4 runtime tests (verify remediation) |

## Work Unit Evidence (cumulative)

| Evidence | Required value |
|---|---|
| Focused test command and exact result (commit 1) | `npx vitest run tests/unit/estados.test.ts tests/unit/carga-registrar.test.ts tests/unit/botellon-by-codigo.test.ts` → **3 files, 60/60 green** (baseline 58 → +5 contract, −1 consolidated) |
| Focused test command and exact result (commit 2) | `npx vitest run tests/component/carga-page.test.tsx` → **32/32** (baseline 31: 2 old-contract fails → flipped; +1 new "rejects entregado under recargar"); `npx playwright test tests/e2e/business-flows.spec.ts -g "Botellones" --project=chromium` → **2 passed** (live dev server + DB) |
| Full gate (2.12) | `npx vitest run` → **16 files, 188/188 pass**; `npx tsc --noEmit` → **0 errors**; `npm run build` → **success** (R1 cleared, first full build since commit 1) |
| Runtime harness command/scenario and exact result | E2E business-flows Botellones tests ran against live `npm run dev` + Supabase: `list with states` now asserts `/Recibido|Listo|Entregado/` and `change state` selects `{index:1}` — both green. Dev-mode SW registration errors are benign noise. Migration 0009: file written in commit 1, NOT executed (no runner; apply via Supabase SQL editor after live-count check — planta=1, exceptions=0 verified read-only). |
| Rollback boundary | `git revert 42644ec` (commit 2, no schema impact) then `git revert f5abb78` (commit 1); restore path = 0005 constraint + 0009 remap. |

## TDD Cycle Evidence

### Commit 1 (backend/db)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `tests/unit/estados.test.ts` | Unit | ✅ 11/11 | ✅ 8 failed (16 tests, RED confirmed) | ✅ 16/16 | ✅ 3 cases per TRANSICIONES edge + KANBAN + maps | ✅ Clean — maps/ops extracted, no magic strings |
| 1.2 | `tests/unit/carga-registrar.test.ts` | Unit | ✅ 40/40 | ✅ 2 failed (`.in('estado',…)` assertions) | ✅ 40/40 | ➖ Single-source contract (spec defines one source) | ✅ Fixtures renamed `entregados`→`recibidos`; `registrarRecarga` describe untouched |
| 1.3 | `tests/unit/botellon-by-codigo.test.ts` | Unit | ✅ 4/4 | ➖ Cosmetic fixture flip (`planta`→`recibido`); no RED possible — noted | ✅ 4/4 | ➖ Single fixture | ➖ None needed |
| 1.4 | `src/lib/utils/estados.ts` | Unit (driven by 1.1) | ✅ | (covered by 1.1 RED) | ✅ 16/16 | ✅ | ✅ Header comment → 5-cycle; deleted `ESTADOS_EXCEPCION` |
| 1.5 | `src/lib/db/botellones.ts` | N/A (no direct test; contract via design D3/D4) | ✅ (scoped suite unaffected) | N/A | ✅ (suite green) | N/A | ✅ Removed danado/perdido notif block; `moverBotellon` clears client only on `'recibido'` |
| 1.6 | `src/lib/db/analytics.ts` | N/A (compile-guard only, red until commit 2) | N/A | N/A | N/A (structural removal; verified by grep, no `botellonesEnPlanta`/`botellonesDanados` remain) | N/A | ✅ |
| 1.7 | `src/app/api/alertas/route.ts` | N/A (compile-guard only) | N/A | N/A | N/A (fallback key dropped; `getAlertas` type no longer has it) | N/A | ✅ |
| 1.8 | `supabase/migrations/0009_botellon_estados_puros.sql` | N/A (migration, not executed) | N/A | N/A | N/A | N/A | ✅ Data-first (D8): UPDATE before DROP/ADD constraint; default untouched |
| 1.9 | — | — | ✅ baseline 58/58 | — | ✅ 60/60 | — | ✅ Live counts verified read-only: `planta`=1, exceptions=0 |
| 1.10 | — | — | — | — | — | — | ✅ Commit `f5abb78` |

### Commit 2 (frontend + docs)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1 | `tests/component/carga-page.test.tsx` | Component | ✅ 29/31 pass (2 old-contract fails = designed RED from commit 1) | ✅ Tests flipped to 5-estado contract FIRST (+1 new: entregado red under recargar; BOT_RECIBIDO fixture; `'planta'`→`'recibido'`; re-validates-live → red under recargar / green under recibir) | ✅ 32/32 (production code already satisfied via shared estados.ts from commit 1 — contract flip, per design) | ✅ 3 badge cases: recibido→green, entregado→red, recarga→red + live op switch | ➖ None needed (tests only) |
| 2.2 | `tests/e2e/business-flows.spec.ts` | E2E | N/A (needs live server) | ✅ L144 `'planta'`→`/Recibido\|Listo\|Entregado/`; L154 `selectOption('mantenimiento')`→`selectOption({index:1})` | ✅ 2 passed (live run, chromium) | ➖ Single flow per design | ➖ None needed |
| 2.3 | `operaciones-dashboard.tsx` | N/A (UI compile-guard; driven by 2.1/2.2) | ✅ suite green | N/A | ✅ tsc/build green | N/A | ✅ −4 ESTADO_META; TODOS_ESTADOS 5; removed enPlanta KPI + danados chip + Excepciones section; grid `lg:grid-cols-4` |
| 2.4 | `admin-dashboard.tsx` | N/A (compile-guard) | ✅ | N/A | ✅ | N/A | ✅ Removed "En planta" KPI + `Package`; grid `lg:grid-cols-6` |
| 2.5 | `botellones-donut-chart.tsx` | N/A (compile-guard) | ✅ | N/A | ✅ | N/A | ✅ 5-key map per design; fallback palette neutral (no removed-estado hues) |
| 2.6 | `alert-panel.tsx` | N/A (compile-guard) | ✅ | N/A | ✅ | N/A | ✅ Removed `botellonesDanados` types/merge/CATEGORIES + `Wrench`; ternary → `'inactivos' : 'premios'` |
| 2.7 | `notification-icon.tsx` + `notificaciones-list.tsx` | N/A (compile-guard) | ✅ | N/A | ✅ | N/A | ✅ Removed `botellon_danado` entry + filter tab |
| 2.8 | `botellones/[id]/form.tsx` | N/A | ✅ | N/A | ✅ | N/A | ✅ "Sin asignar (planta)" → "Sin asignar" |
| 2.9 | `botellones/page.tsx` | N/A (compile-guard) | ✅ | N/A | ✅ | N/A | ✅ Deleted stale local map → shared `ESTADO_LABELS`/`ESTADO_COLORS`; renders label + color |
| 2.10 | `clientes/[id]/tabs.tsx` | N/A (compile-guard) | ✅ | N/A | ✅ | N/A | ✅ MiniCard ternary + `estadoBadge` → shared `ESTADO_COLORS` (5 keys); labels rendered |
| 2.11 | `recargas/carga/page.tsx` | N/A (compile-guard) | ✅ | N/A | ✅ | N/A | ✅ `BADGE_INVALID` explicit red const; `ESTADO_COLORS` import dropped |
| 2.12 | Verify | Full gate | — | — | ✅ vitest 188/188 · tsc 0 · build ok · e2e Botellones 2/2 | — | ✅ R1 cleared |
| 2.13 | Docs | N/A | — | — | ✅ 9 doc files updated (see below) | — | ✅ 5-estado model everywhere |
| 2.14 | Commit | — | — | — | — | — | ✅ Commit `42644ec` (amended locally to fold the 2.14 checkbox) |

## Test Summary (cumulative)

- **Total tests passing**: 188/188 full suite (16 files) — unit 60, component 32, integration + others
- **New tests written in commit 2**: 1 (entregado→recargar reject badge) + 2 flipped + 1 e2e assertion replacement
- **Layers used**: Unit (60), Component (32), Integration (per suite), E2E (2 modified Botellones tests green live)
- **Approval tests** (refactoring): existing component/e2e tests updated to the new contract per strict-tdd approval flow
- **Pure functions created**: 0 (shared machine already pure; UI changes only)

## Files Changed (commit 2)

| File | Action | What Was Done |
|------|--------|---------------|
| `tests/component/carga-page.test.tsx` | Modified | `'planta'`→`'recibido'`; `BOT_RECIBIDO` fixture; valid-green → recibido under recargar; +1 entregado-reject test; re-validates-live → red under recargar / green under recibir |
| `tests/e2e/business-flows.spec.ts` | Modified | L144 → `/Recibido\|Listo\|Entregado/`; L154 → `selectOption({index:1})` |
| `src/components/dashboard/operaciones-dashboard.tsx` | Modified | Dropped `ESTADOS_EXCEPCION`; −4 ESTADO_META; TODOS_ESTADOS 5; removed enPlanta KPI, danados chip, Excepciones section; grid `lg:grid-cols-4` |
| `src/components/dashboard/admin-dashboard.tsx` | Modified | Removed "En planta" KPI + `Package` import; grid `lg:grid-cols-6` |
| `src/components/dashboard/botellones-donut-chart.tsx` | Modified | 5-key ESTADO_COLORS per design; neutral fallback palette |
| `src/components/dashboard/alert-panel.tsx` | Modified | Removed `botellonesDanados` (types/merge/CATEGORIES) + `Wrench`; ternary simplified |
| `src/components/notificaciones/notification-icon.tsx` | Modified | Removed `botellon_danado` icon entry |
| `src/app/(dashboard)/notificaciones/notificaciones-list.tsx` | Modified | Removed `botellon_danado` filter tab |
| `src/app/(dashboard)/botellones/[id]/form.tsx` | Modified | "Sin asignar (planta)" → "Sin asignar" |
| `src/app/(dashboard)/botellones/page.tsx` | Modified | Stale local map deleted → shared `ESTADO_LABELS`/`ESTADO_COLORS`; label + color rendered |
| `src/app/(dashboard)/clientes/[id]/tabs.tsx` | Modified | MiniCard + `estadoBadge` → shared `ESTADO_COLORS` (5 keys) |
| `src/app/(dashboard)/recargas/carga/page.tsx` | Modified | `BADGE_INVALID` explicit red const; dropped `ESTADO_COLORS` import |
| `src/lib/db/cargas.ts` | Modified | Stale doc comment "entregado/recibido → recarga" → "recibido → recarga" (only line; design mandated 0 logic changes) |
| `docs/epics/04-Botellones-QR.md` | Modified | 5-estado list + TRANSICIONES + assign/unassign semantics + diagram |
| `docs/epics/07-Notificaciones.md` | Modified | Removed danado/perdido notification + filter-type mention |
| `docs/epics/08-Panel-Reportes.md` | Modified | Removed planta KPI + mantenimiento/danados alert + stale query row |
| `docs/epics/13-Recarga-Rapida-QR.md` | Modified | "(botellon en planta)" → "(botellon sin cliente asignado)" |
| `docs/epics/03-Clientes.md` | Modified | L78 badge colors → 5-estado palette |
| `docs/epics.md` | Modified | 6→5 model: estados/transiciones/assign semantics/notif/alert lines + badge colors |
| `docs/MAPA-SISTEMA.md` | Modified | 8→7 KPIs (no planta), getAlertas desc, updateBotellon desc |
| `docs/MANUAL-USUARIO.md` | Modified | 7→6 KPI cards, donut estados, badge colors, recarga flow, notifications table, FAQ (dañado → estados del ciclo) |
| `docs/plan.md` | Modified | + change row `estados-botellon-ciclo-puro`; date 21/08/2026 |
| `openspec/changes/estados-botellon-ciclo-puro/tasks.md` | Modified | 2.1–2.14 marked `[x]` |

## Deviations from Design

None — implementation matches design.md (D2/D5/D6 all followed; commit 2 clears R1). Minor notes:
- E2E run limited to the modified `Botellones` describe (chromium) — full business-flows suite has 4 pre-existing failures tied to DB state/locators (documented in testing-capabilities), unrelated to this change.
- Commit message uses `->` instead of `→` (PowerShell encoding of the arrow on commit) — conventional-commit compliant, cosmetic.

---

# REMEDIATION BATCH (verify obs 594 → commit 3) — R4 runtime tests + constraint swap

**Trigger**: verify FAIL — 4 CRITICAL UNTESTED R4 scenarios (S1–S4) + 1 pending constraint swap (R5 S2).
**Result**: 4/4 scenarios now covered by runtime tests (11 new tests, 1 new file); constraint swap documented applied-pending with exact SQL (data verified safe read-only); full gate green.

## Work Unit Evidence (commit 3)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run tests/unit/botellones-estado.test.ts` → **1 file, 11/11 pass** (RED: `No test files found, exiting with code 1` on the pre-file run — coverage gap reproduced) |
| Full gate | `npx vitest run` → **17 files, 199/199 pass** (was 16/188 → +11); `npx tsc --noEmit` → **0 errors**; `npm run build` → **exit 0** |
| Runtime harness command/scenario and exact result | Live read-only DB check via service-role key (Node script, no writes): **14 rows, estado counts `{entregado:7, recibido:4, recarga:2, listo:1}`, rows outside 5-estado set: NONE** — constraint swap is safe to apply on all existing rows |
| Rollback boundary | `git revert` commit 3 (test-only + docs; no schema/production impact). Constraint swap itself is documented SQL, not executed |

## TDD Cycle Evidence (commit 3)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| R4 S1 stock (clientless in recibido/listo) | `tests/unit/botellones-estado.test.ts` | Unit | N/A (new file) | ✅ `No test files found` (exit 1) before file existed | ✅ 3/3 (updateBotellon listo no-client; moverBotellon listo no-client; moverBotellon recibido clears client) | ✅ 3 distinct paths | ➖ None needed |
| R4 S2 assign → entregado | `tests/unit/botellones-estado.test.ts` | Unit | N/A (new file) | ✅ (same RED run) | ✅ 2/2 (assign no estado; assign overrides explicit estado) | ✅ 2 inputs | ➖ None needed |
| R4 S3 unassign keeps estado | `tests/unit/botellones-estado.test.ts` | Unit | N/A (new file) | ✅ (same RED run) | ✅ 2/2 (unassign with estado='listo' keeps listo; unassign no estado leaves estado untouched) | ✅ 2 inputs | ➖ None needed |
| R4 S4 create default | `tests/unit/botellones-estado.test.ts` | Unit | N/A (new file) | ✅ (same RED run) | ✅ 2/2 (insert `{}` → DB default 'recibido', no estado/cliente_id keys; insert error surfaced) | ✅ happy + error | ➖ None needed |
| R4 assign path via moverBotellon (adjacent) | `tests/unit/botellones-estado.test.ts` | Unit | N/A (new file) | ✅ (same RED run) | ✅ 2/2 (entregado rejects no-client before DB; entregado with client sets cliente_id + fecha_entrega) | ✅ 2 inputs | ➖ None needed |

**Note**: GREEN passed on first run — the verify phase already confirmed the implementation statically matches spec/design D3/D4; the tests lock the behavior at runtime. No production code changed (no real bug revealed).

## Test Summary (cumulative, after commit 3)

- **Total tests passing**: 199/199 full suite (17 files) — was 188/188 (16 files); +11 tests, +1 file
- **New test file**: `tests/unit/botellones-estado.test.ts` (createBotellon / updateBotellon / moverBotellon, thenable chain-builder pattern per carga-registrar.test.ts)
- **Layers used**: Unit (+11)
- **Pure functions created**: 0 (server actions with mocks; behavior asserted via update/insert payloads)

## R4 Scenario Coverage (verify findings → resolved)

| Verify finding | Status | Evidence |
|---|---|---|
| R4 S1 "Clientless botellon counts as stock" UNTESTED | ✅ COVERED | 3 tests: updateBotellon listo w/o client; moverBotellon listo w/o client (payload `{estado:'listo'}` — cliente_id untouched); moverBotellon recibido clears client |
| R4 S2 "Assigning a client sells the stock" UNTESTED | ✅ COVERED | 2 tests: assign → `{cliente_id, estado:'entregado'}`; assign overrides explicit estado |
| R4 S3 "Unassign leaves estado unchanged" UNTESTED | ✅ COVERED | 2 tests: `{estado:'listo', cliente_id:null}` (no entregado/planta); unassign-only `{cliente_id:null}` |
| R4 S4 "No planta auto-assign on create" UNTESTED | ✅ COVERED | 2 tests: insert `{}` has no estado/cliente_id keys (DB default 'recibido' from 0005); error path |

## Constraint Swap Status (R5 S2) — APPLIED-PENDING, documented

**Cannot execute from this machine**: no supabase CLI, no `supabase/config.toml`, no Supabase MCP server, no `.mcp.json`; REST API cannot run DDL. **Live data verified read-only (service-role, no writes)**: 14 rows, `{entregado:7, recibido:4, recarga:2, listo:1}`, 0 rows outside the 5-estado set → the swap is safe (CHECK passes on all existing rows; remap already live).

**Exact SQL to run in Supabase SQL Editor** (project dashboard → SQL Editor → New query) — identical to migration `supabase/migrations/0009_botellon_estados_puros.sql`:

```sql
-- 1. Data first (BOT-00048 + defensive) — MUST precede the constraint swap
UPDATE public.botellones SET estado = 'recibido' WHERE estado = 'planta';
UPDATE public.botellones SET estado = 'recibido' WHERE estado IN ('danado','perdido','mantenimiento');
-- 2. Constraint 9 → 5
ALTER TABLE public.botellones DROP CONSTRAINT IF EXISTS botellones_estado_check;
ALTER TABLE public.botellones ADD CONSTRAINT botellones_estado_check
  CHECK (estado IN ('entregado','recibido','recarga','listo','delivery'));
-- default stays 'recibido' (set by 0005) — no change
```

Verification after apply: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'botellones_estado_check';` → expect the 5-estado CHECK. Then a manual sixth-estado insert in SQL Editor (`INSERT INTO public.botellones (estado) VALUES ('planta');`) must fail with a check-violation error. **Not CRITICAL**: data-safe, fully documented, single copy-paste.

## Files Changed (commit 3)

| File | Action | What Was Done |
|------|--------|---------------|
| `tests/unit/botellones-estado.test.ts` | Created | 11 tests covering R4 S1–S4 + moverBotellon assign path (thenable chain-builder, no production changes) |
| `openspec/changes/estados-botellon-ciclo-puro/apply-progress.md` | Modified | This remediation section merged (commit 3) |
| `openspec/changes/estados-botellon-ciclo-puro/tasks.md` | Modified | + Commit 3 section, marked `[x]` |

## Issues Found

- None new in production code. The libuv `Assertion failed` printed after the read-only Node check is a benign Node-on-Windows teardown quirk after `process.exit` — the query output itself was correct and complete.
- Pre-existing Vite `configLoader: 'native'` ESM warning on vitest runs — cosmetic, pre-existing, not blocking.

## Status

**24/24 tasks complete (1.1–1.10 + 2.1–2.14) + remediation commit 3 complete. Change fully applied + remediated — ready for verify re-run.**
Full gate green: vitest 199/199 (17 files), tsc 0 errors, `npm run build` exit 0. Constraint swap documented applied-pending (exact SQL above, data verified safe).

## Issues Found

- None new. The `cargas.ts` stale comment flagged in commit 1's apply-progress was cleaned here as instructed.
- Working tree retains PRE-EXISTING unrelated changes from `carga-terminal-multi-estado` (`openspec/changes/carga-terminal-multi-estado/*`, `.atl/skill-registry.md`, `terminal-carga.png`) — NOT part of this change, left untouched.

## Status

**24/24 tasks complete (1.1–1.10 + 2.1–2.14). Change fully applied — ready for verify.**
Full gate green: vitest 188/188, tsc 0 errors, `npm run build` success, e2e Botellones 2/2 live.