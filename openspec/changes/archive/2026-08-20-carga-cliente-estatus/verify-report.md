```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:4018794dd50c2409a4d1c83f51b5706d82cacefe2dd2a83f2a91e95b855b2b1a
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 8/8
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:4018794dd50c2409a4d1c83f51b5706d82cacefe2dd2a83f2a91e95b855b2b1a
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:dbc59bbb26ed067c67b33116b53dce009216cf07c8dbc4544e26848efc7d0b27
```

## Verification Report

**Change**: carga-cliente-estatus
**Version**: batch-carga delta (ADDED requirements)
**Mode**: Standard

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 10 (5 phases) |
| Tasks complete | 10 |
| Tasks incomplete | 0 |

All 10 tasks across the 5 phases are checked `[x]`. Full verification is unblocked.

### Build & Tests Execution

**Build**: ✅ Passed (exit 0)
```text
npx tsc --noEmit        -> exit 0, no output (clean)
npm run build           -> exit 0, "Compiled successfully in 6.9s", TypeScript clean, 12 static pages generated
```

**Tests**: ✅ 145 passed (15 files), 0 failed, 0 skipped
```text
npx vitest run
Test Files  15 passed (15)
     Tests  145 passed (145)
```
(Output SHA-256 `4018794d...`, build SHA-256 `dbc59bbb...` — both exit 0.)

**Coverage**: ➖ Not available (no coverage threshold configured; not required by this change).

### Spec Compliance Matrix

Counted from the retrieved `batch-carga` delta spec: **5 ADDED requirements, 8 scenarios.**

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Scan-time client name + botellon status on SessionItem | Valid scan carries client name and status | `tests/component/carga-page.test.tsx > "resolves the client name via getCliente and renders it with a status badge"` | ⚠️ PARTIAL (behavioral pass; mechanism differs from spec — see notes) |
| R1 | Client name join returns null | `tests/component/carga-page.test.tsx > "falls back to the raw client id when getCliente returns no name"` | ⚠️ PARTIAL (behavioral pass via `getCliente` null, not join null) |
| R2 Session list renders client name + status badge | Item with client and status renders both | `tests/component/carga-page.test.tsx > "resolves the client name..."` + `"renders different client names and statuses..."` | ✅ COMPLIANT |
| R2 | Unknown estado falls back gracefully | `tests/component/carga-page.test.tsx > "shows the raw estado value..."` + `tests/unit/estados.test.ts > "falls back to the raw estado value..."` | ✅ COMPLIANT |
| R3 Graceful fallback when client name missing | Missing client name falls back to id or nothing | `tests/component/carga-page.test.tsx > "falls back to the raw client id..."` | ✅ COMPLIANT |
| R3 | No-client overlay still governs null client | `tests/component/carga-page.test.tsx > "shows the no-client overlay..."` | ✅ COMPLIANT |
| R4 Handler-driven enrichment (no setState in effect) | Accumulation remains in the decode handler | `tests/component/carga-page.test.tsx > "enriches the item inside onDecode, not via a useEffect body"` + source `page.tsx:109-111` (only effect is `stop()` on success) | ✅ COMPLIANT |
| R5 Confirm transition remains entregado → recarga | Transition unchanged after adding display fields | `tests/component/carga-page.test.tsx > "posts the accumulated ids with the shared fecha/hora"` + `cargas.ts` absent from both commits' diffs (untouched) | ✅ COMPLIANT |

**Compliance summary**: 6/8 scenarios fully COMPLIANT, 2/8 PARTIAL (R1's two scenarios — behavioral outcomes pass, but the spec-stated mechanism is not what the code does). 0 FAILING, 0 UNTESTED.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| R1 Store `clienteNombre` + `estado` on `SessionItem` | ⚠️ Implemented (different mechanism) | `page.tsx:89-98` stores `clienteNombre` (via `getCliente`) + `estado`. `getBotellonByCodigo` (`botellones.ts:74-112`) does NOT return `clienteNombre` nor join `clientes` — it is deliberately public-safe (no PII). |
| R2 Render client name + status badge | ✅ Implemented | `page.tsx:262-276`; badge uses `ESTADO_COLORS[estado] ?? ''` and `ESTADO_LABELS[estado] ?? estado` (`estados.ts:51-78`). |
| R3 Graceful fallback when name missing | ✅ Implemented | `page.tsx:265` `{item.clienteNombre || item.cliente}`; no-client overlay unchanged (`page.tsx:73-76, 211-231`). |
| R4 Handler-driven enrichment | ✅ Implemented | Enrichment in `onDecode`; no effect body calls the accumulator setter. |
| R5 Confirm transition unchanged | ✅ Implemented | `registrarCarga`/`CargaItemResult`/`/recargas/nueva` not in either commit's diff. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Extract canonical `ESTADO_LABELS`/`ESTADO_COLORS` to `src/lib/utils/estados.ts` | ✅ Yes | `estados.ts:51-78`; `form.tsx` and `b/[codigo]/page.tsx` import from it. |
| Join `clientes(nombre)` into `getBotellonByCodigo` (no extra round-trip) | ❌ No | **Reversed** by security fix `1458c87`: the join was removed to keep client PII out of the public `/b/[codigo]` RSC payload; the carga page now resolves the name via a separate `getCliente(cliente_id)` call (`page.tsx:85`). This is exactly the option the design rejected. |

### Issues Found

**CRITICAL**: None.

**WARNING**:
1. **Spec/design drift on R1 mechanism (spec contradiction).** The `batch-carga` spec R1 states `getBotellonByCodigo` "SHALL return `clienteNombre` via a `clientes(nombre)` join in a single lookup (no extra round-trip)", and its Testability section requires unit tests to "assert the additive `clienteNombre` field and join shape". The current implementation (and its unit tests) assert the **opposite**: `getBotellonByCodigo` carries no client PII by design (`botellones.ts:67-73`), and `botellon-by-codigo.test.ts:85` asserts `result).not.toHaveProperty('clienteNombre')` and `:102` asserts the select never contains `clientes`. The design's Architecture Decision #2 was also not followed. **Cause**: intentional, security-approved follow-up (`1458c87`, review `review-e236765a4dee14d4` APPROVED). All 8 behavioral scenarios still pass. Action: the archive phase should sync `spec.md` (R1 mechanism + Testability wording) and `design.md` (Decision #2) to the security-corrected `getCliente` approach.

**SUGGESTION**:
1. Update `spec.md` R1 and Testability section and `design.md` Decision #2 during archive so the canonical spec/design match the committed code — this prevents future verifiers from flagging the same drift.

### Review Receipts
- `review-21f3c548dfea20e2` — APPROVED (feat `5569d7d`; gate pre-commit allow).
- `review-e236765a4dee14d4` — APPROVED (security fix `1458c87`; risk lens, gate allow).

### Verdict
**PASS WITH WARNINGS**

All runtime evidence is green (`vitest` 145/145, `tsc` clean, `build` clean — all exit 0) and all 8 behavioral scenarios are covered by passing tests. The single WARNING is a documented spec/design drift (R1 join mechanism vs. security-corrected `getCliente` approach) that carries no runtime or behavioral failure and should be reconciled during the archive phase.
