```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:0a5d4aefa4a582d3c6ebefd1f7e0de9d1e0cdd48
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 6/7 complete
scenarios: 28/28 compliant
test_command: npm run test
test_exit_code: 0
test_output_hash: sha256:18FFED19737213FE8DBF13A23A1D073ABA9AA2B0892F738E50E239E49B906AD6
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
```

## Verification Report

**Change**: central-op-fase5-realtime-whatsapp-ficha
**Version**: spec obs #667 (Engram `sdd/central-op-fase5-realtime-whatsapp-ficha/spec`) — no spec.md on disk (only proposal/design/tasks)
**Mode**: Strict TDD (vitest runner available, `npm run test`)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 25 (1.1–1.9, 2.1–2.8, 3.1–3.8) |
| Tasks complete | 25 |
| Tasks incomplete | 0 |

All checkboxes `[x]` in `tasks.md`. Slice-3 tasks (3.1–3.8) confirmed genuinely implemented in HEAD `0a5d4ae` (working tree clean, branch `redesign/central-operaciones`): `ficha-cliente.tsx` (new), `getBotellonesCliente` in `src/lib/db/botellones.ts:304-331`, name-target wiring in `grupo-card.tsx:167-174` / `grupo-card-kanban.tsx:91-97` / `kanban-desktop.tsx:129-138`, carried fixes D12 (`useColaOperaciones.ts:421-436`), dragId-clear-on-drop (`kanban-desktop.tsx:87-94`), D10 30s tick (`grupo-card.tsx:44-58`). Commits present: `04864cf` (realtime), `8a1a5d9` (WhatsApp), `0a5d4ae` (ficha + carried).

### Build & Tests Execution
**Build (type-check)**: ✅ Passed — `npx tsc --noEmit` exit 0 (hash `E3B0C442…855` = empty output)
**Tests**: ✅ 411 passed / 0 failed / 0 skipped — 38 files, `npm run test` exit 0 (hash `18FFED19…AD6`)
**Coverage**: ➖ Not available — vitest.config.ts defines no coverage provider (not a failure)

### Spec Compliance Matrix (7 requirements, 28 scenarios)
| Requirement | Scenarios | Test | Result |
|-------------|-----------|------|--------|
| REQ-COS-27 (realtime cola + chip) | 5 | `use-realtime-cola.test.tsx` (12: lifecycle×4, gate/queue×8) + `cola-operaciones.test.tsx` chip/scroll/outline | ✅ COMPLIANT 5/5 |
| REQ-COS-28 (sheet WhatsApp) | 5 | `sheet-whatsapp.test.tsx` (7) + `whatsapp.test.ts` (17) + card/shell wiring tests | ⚠️ PARTIAL 5/5 scenarios pass, locked-literal copy deviates (see W1) |
| REQ-COS-29 (ficha cliente) | 3 | `ficha-cliente.test.tsx` (7) + `botellones-cliente.test.ts` (4) + shell ficha tests | ✅ COMPLIANT 3/3 |
| REQ-COS-30 (test contract) | 3 | suite-wide (411 green incl. all listed files; e2e dropped per MAY) | ✅ COMPLIANT 3/3 |
| MOD-17 (REQ-COS-17 tabs + live counters) | 3 | `cola-tabs.test.tsx` + `cola-operaciones.test.tsx:314` (counters live while queued) | ✅ COMPLIANT 3/3 |
| MOD-18 (REQ-COS-18 card targets wired) | 4 | `grupo-card.test.tsx` (ficha/WhatsApp targets, D7 aria-disabled) | ✅ COMPLIANT 4/4 |
| MOD-23 (REQ-COS-23 kanban compact card) | 5 | `grupo-card-kanban.test.tsx` (9) + `kanban-desktop.test.tsx` passthrough | ✅ COMPLIANT 5/5 |

**Compliance summary**: 28/28 scenarios compliant (all have passing covering tests); 6/7 requirements fully met, REQ-COS-28 partial at requirement level (mechanism complete, exact copy deviates).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-COS-27 subscribe/removeChannel/silent/no-poll | ✅ Implemented | `useRealtimeCola.ts:60-79` — channel `cola-realtime`, event `*`/public/botellones, removeChannel on unmount, warn-only CHANNEL_ERROR/TIMED_OUT; one-shot refetch only on unknown-client events (`necesitaRefetch` D5), no polling |
| REQ-COS-27 gate + chip + live counters + outline | ✅ Implemented | `decidirGate` (`useColaOperaciones.ts:76-84`), two-layer state (`botellones` live / `visibles` snapshot, :196-198), chip `chip-realtime.tsx:14-25` "↑ N botellones nuevos" under tabs (`cola-operaciones.tsx:221`), counters from live `porEstado` (:96-101), `entrando` diff + `outline outline-2 outline-marca` 1.2s (`grupo-card.tsx:160`, `ENTRANDO_MS=1200`) |
| REQ-COS-28 sheet + wa.me + no-phone | ⚠️ Partial | Sheet/textarea/note/`--whatsapp` "Abrir WhatsApp" `_blank`/Cancelar/no-auto-send/no-phone toast all implemented (`sheet-whatsapp.tsx:31-90`, shell `abrirWhatsApp` `cola-operaciones.tsx:124-131`, `aria-disabled`+`opacity-40` in both cards). **Copy deviates from spec locked literal** (see W1) |
| REQ-COS-29 ficha + helper | ✅ Implemented | `ficha-cliente.tsx` (nombre SheetTitle, cédula mono/"—", dirección join, 3 actions incl. `tel:` and `router.push('/clientes/[id]')`, "Sus botellones (N)" all estados incl. entregado with ESTADO_COLORS badge + `formatAntiguedad` age, Escape via base-ui); `getBotellonesCliente` all estados no filter + `direcciones(*)` join + null-safe (`botellones.ts:304-331`) |
| REQ-COS-30 test contract | ✅ Implemented | All required files exist and pass; e2e chip spec dropped (REQ-COS-30 MAY) |
| MOD-17 counters live | ✅ Implemented | `porEstado` memo derives from live `botellones` even while queued (`useColaOperaciones.ts:327-335`); tab underline `h-0.5` + `ESTADO_TOKEN` per estado (`tabs-estados.tsx:14-19,50-53`); context bar "N clientes · N botellones · más antiguo arriba" (`barra-contexto.tsx:15`) |
| MOD-18/23 targets wired | ✅ Implemented | Name → ficha, WhatsApp → sheet in both cards; no-phone `aria-disabled` (not `disabled`) so the tap always reaches the shell toast |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 postgres_changes, no poll | ✅ Yes | `useRealtimeCola.ts:60-69` |
| D2 separate `useRealtimeCola` | ✅ Yes | Hook owns channel lifecycle only |
| D3 `decidirGate` pure fn | ✅ Yes | `useColaOperaciones.ts:76-84` |
| D4 two-layer row model | ✅ Yes | `botellones` live + `visibles` snapshot |
| D5 one-shot refetch unknown client | ✅ Yes | `necesitaRefetch` :141-147 |
| D6 echo suppression | ✅ Yes | `idsEnMovimientoRef` :206, :255, :366, :400 |
| D7 aria-disabled not disabled | ✅ Yes | Both cards + shell toast |
| D8 controlled sheets (ficha↔WhatsApp swap) | ✅ Yes | Shell state + `abrirFichaWhatsApp` `cola-operaciones.tsx:137-140` |
| D9 outline token 1.2s no slide | ✅ Yes | `outline outline-2 outline-marca` + 1200ms clear |
| D10 30s clock tick (carried) | ✅ Yes | `useEdadAhora` setInterval `EDAD_TICK_MS=30000` |
| D11 totals ESTADOS_KANBAN filter (carried) | ✅ Yes | `useColaOperaciones.ts:340-345` |
| D12 transport catch (carried) | ✅ Yes | try/catch around RPC await :421-436 → revert + red toast + `{ok:false}` |
| D13 whatsapp util | ⚠️ Deviation | `buildWaLink`/`normalizeWhatsAppPhone` implemented correctly; **`mensajeWhatsApp` literal ≠ spec locked literal** (see W1) |
| D14 `getBotellonesCliente` helper | ✅ Yes | `botellones.ts:304-331` — no estado filter, direcciones(*) join, null-safe |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Per-task "Evidence:" lines in tasks.md (RED→GREEN→REFACTOR), RED test-first with failing-import/assertion proof |
| All tasks have tests | ✅ | 25/25 — each task maps to a real test file (verified below) |
| RED confirmed (tests exist) | ✅ | 25/25 test files verified in tree: `use-realtime-cola` (12), `cola-operaciones` (chip/scroll/outline), `whatsapp` (17), `sheet-whatsapp` (7), `ficha-cliente` (7), `botellones-cliente` (4), `grupo-card`/`grupo-card-kanban`/`kanban-desktop`/`undo-flow` wiring + carried tests |
| GREEN confirmed (tests pass) | ✅ | 411/411 pass on fresh execution; per-file counts match apply claims (whatsapp 17/17, sheet-whatsapp 7/7, ficha-cliente 7/7, botellones-cliente 4/4, undo-flow 6, kanban-desktop 12) |
| Triangulation adequate | ✅ | Multiple distinct expectations per behavior (queued-vs-direct, live counters while frozen, entregado present, encoded deep link); note: 1.7 written after 1.8 GREEN (documented order deviation — tests still fail without implementation) |
| Safety Net for modified files | ⚠️ | Apply reports full suite green at each REFACTOR step (352→369→392→411); per-file safety-net table not in apply-progress, suite history consistent |

**TDD Compliance**: 24/25 checks passed (1 minor: evidence is per-task inline, not a consolidated table — content is present and cross-verified)

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 21 (whatsapp 17 + botellones-cliente 4) | 2 | vitest |
| Integration (component render) | ~390 | 36 | vitest + @testing-library/react + user-event |
| E2E | 0 (dropped, REQ-COS-30 MAY) | 0 | playwright installed but not used (allowed) |
| **Total** | **411** | **38** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (vitest.config.ts has no coverage provider). Not a failure per strict-TDD module.

### Assertion Quality
✅ All assertions verify real behavior. No tautologies, no orphan empty checks, no ghost loops, no type-only-only assertions, no pure smoke tests. Mock-heavy harnesses (fake supabase channels) are justified — they are the only way to drive realtime payloads in jsdom; assertions are behavioral (list contents, chip presence, href values, counter deltas). CSS-class assertions (font-mono, min-h-11, opacity-40, bg-urgencia/7, data-entrada) are spec-mandated observables (mono font, 44px, 40% opacity, urgency tint, outline), not incidental implementation details.

### Quality Metrics
**Linter**: ➖ Not run per-file (apply reports 4 pre-existing errors in untouched files; changed files clean)
**Type Checker**: ✅ No errors — `npx tsc --noEmit` exit 0

### Issues Found
**CRITICAL**: None

**WARNING**:
1. **W1 — REQ-COS-28 locked-literal copy deviation** (`src/lib/utils/whatsapp.ts:21-31`). The spec (obs 667) locks: recibido `Hola {nombre}, tus {N} botellones fueron recibidos.` / recarga `…están en recarga.` / listo `…están listos.` / delivery `…están en delivery.` The implementation uses different copy (recibido `Hola {p}, recibimos {u}. Te aviso apenas…`, recarga `ya estamos recargando {u}.`, listo `…están listos. ¿Te lo llevo hoy?`, delivery `vamos en camino con {u}.`, plus a `default` branch not in the spec). Spec scenario S1's asserted string ("Hola {nombre}, tus {N} botellones están listos.") IS contained verbatim in the implemented listo message, so the scenario passes, but the locked table for 3 of 4 estados is not met. `design.md:104-114` contains the same non-spec literal claiming "spec §7.3 verbatim" — the design itself deviates from the Engram spec. **Requires user/orchestrator decision**: accept the implemented (arguably richer) copy and update the spec, or revert the copy to the locked literal. No scenario fails either way.
2. **W2 — Line budget exceeded in all 3 PRs** (apply-progress): PR-A ≈933, PR-B ≈515, PR-C ≈788 changed lines vs 400 budget (design estimates missed ~2× on test lines). Documented with size-exception recommendation at each slice; carried fixes split cleanly if maintainer insists. Process deviation, not a correctness issue.

**SUGGESTION**: TDD evidence lives as per-task "Evidence:" lines in tasks.md rather than a consolidated RED/GREEN/TRIANGULATE/SAFETY-NET table; consider adding the table format in future apply reports.

### Verdict
**PASS WITH WARNINGS** — all 25 tasks implemented and committed (0a5d4ae HEAD, clean tree), 411/411 tests green, tsc exit 0, all 28 spec scenarios have passing covering tests, no dropped or invented requirements. W1 (locked WhatsApp literal copy vs spec) and W2 (PR line-budget overruns) need user/orchestrator adjudication before archive.