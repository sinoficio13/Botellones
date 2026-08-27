# Tasks: Central de Operaciones — Fase 5 (Realtime + WhatsApp + Ficha cliente)

## Review Workload Forecast

Estimated changed lines: PR-A ~350 · PR-B ~340 · PR-C ~380 (total ~1070)
Suggested split: PR-A → PR-B → PR-C on `redesign/central-operaciones` (base: tracker / PR-A / PR-B)
Delivery strategy: ask-on-risk (feature-branch chain reused)

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

Work units (test cmd = `npx vitest run` + that phase's test files):
- **A** Realtime+chip (base tracker): harness 2-device dev (scroll+move→chip, live counters, tap applies); rollback remove sub/chip → static fetch (no DB).
- **B** WhatsApp sheet (base PR-A): harness dev tap icon→sheet, edit, wa.me new tab; rollback unwire `onWhatsApp`, delete `sheet-whatsapp.tsx`.
- **C** Ficha+carried (base PR-B): harness dev tap name→ficha, actions, all-estados; rollback unwire ficha, delete `ficha-cliente.tsx`, drop helper.

Req map: P1⇄REQ-COS-27,MOD-17,30 · P2⇄REQ-COS-28,MOD-18/23,30 · P3⇄REQ-COS-29,MOD-18/23,30.

## Phase 1 — PR-A: Realtime queue + chip

- [x] 1.1 RED `use-realtime-cola.test.tsx` (27): fake-channel mock (estado-en-vivo pattern) — channel `cola-realtime`, event `*`/table `botellones`, removeChannel on unmount, silent CHANNEL_ERROR/TIMED_OUT
  - Evidence: wrote test first → failed "Failed to resolve import @/hooks/useRealtimeCola" (RED). 4 channel-lifecycle tests (subscribe config, removeChannel, silent warn ×2, `normalizarEvento` 4 cases).
- [x] 1.2 GREEN `src/hooks/useRealtimeCola.ts`: channel lifecycle + payload mapping + stable `onEvento` ref
  - Evidence: `npx vitest run tests/component/use-realtime-cola.test.tsx` → 12/12 pass (GREEN). `normalizarEvento` pure helper exported for unit tests.
- [x] 1.3 RED (27): gate — queued while scrolling, queued when `afectaTabActivo`, direct otherwise; echo skip; unknown-client INSERT → one refetch; DELETE removes
  - Evidence: 8 hook-level behavior tests in the same file: queued-while-scrolling (S1), queued-afectaTabActivo + direct-non-visible (S2), chip-apply (S3), live counters (MOD-17 S2), DELETE, refetch-one-shot (D5), echo skip (D6), entrando lifecycle (D9).
- [x] 1.4 GREEN `src/hooks/useColaOperaciones.ts` (MOD-17): `({tab})`; two-layer state (`botellones` live + `visibles` snapshot); `decidirGate`; `pendientes`/`aplicarPendientes`; `entrando`; `setScrolleando`; totals predicate fix (D11)
  - Evidence: hook exports pure `decidirGate`/`mergeEvento`/`calcularEntrando`/`necesitaRefetch`; two-layer memos `porEstado` (live) + `porEstadoVisibles` (gated). Full suite 352→369 with D11 totals fix — existing totals test still green (fixture rows all in ESTADOS_KANBAN).
- [x] 1.5 RED `cola-operaciones.test.tsx` (+): chip "↑ N botellones nuevos" renders, tap applies; scroll debounce; counters live while queued (MOD-17 S2)
  - Evidence: wrote tests first → failed on missing `chip-realtime` testid (RED). 4 shell tests: chip render+tap (S1/S3), scroll-debounce wiring, live counters (MOD-17 S2), outline lifecycle (D9).
- [x] 1.6 GREEN `src/components/operaciones/chip-realtime.tsx`: sticky chip under tabs, plural-safe copy, tap → `aplicarPendientes`, null when 0
  - Evidence: `npx vitest run tests/component/cola-operaciones.test.tsx` → 13/13 pass (GREEN). Copy "↑ N botellones nuevos" (plural for N=1 per §7.5), tokens only.
- [x] 1.7 RED (27): outline — `entrando` diff → outline class present, gone after 1200ms (fake timers)
  - Evidence: card-level test (`grupo-card.test.tsx`): `data-entrada="true"` present when `entrando`, absent otherwise; shell pipeline test: realtime→chip tap→outlined card (BOT-001) → cleared after 1200ms fake timers. NOTE (order deviation): written after 1.8 GREEN — the shell chip tests required the `entrando` prop wired first; tests verify real behavior and fail without the implementation.
- [x] 1.8 GREEN `cola-operaciones.tsx` + `grupo-card.tsx`: scroll listener → `setScrolleando`; chip render; `entrando` prop + `outline outline-2 outline-marca` (D9)
  - Evidence: window scroll listener + 150ms debounce (`FIN_SCROLL_MS`); gated render branches (`porEstadoVisibles`) for mobile/tablet/kanban; counters stay live from `porEstado`; `data-entrada` + `outline outline-2 outline-marca` token (no hex). D6 echo suppression also applied to the undo RPC path.
- [x] 1.9 REFACTOR + verify (30): `npm run test`, `tsc --noEmit`; if PR-A >400, DROP droppable e2e chip spec (REQ-COS-30 MAY) — never add `tests/e2e/cola-realtime.spec.ts`
  - Evidence: `npm run test` → 369/369 pass (35 files); `npx tsc --noEmit` → exit 0. E2E chip spec NOT added (dropped). LINE BUDGET: total ≈933 changed lines > 400 — see apply report (size-exception recommendation).

## Phase 2 — PR-B: WhatsApp sheet

- [x] 2.1 RED `whatsapp.test.ts` (+): 5 literal branches + singular/plural + `buildWaLink` encoding (spaces+accents)
  - Evidence: 11 new tests written first → `mensajeWhatsApp is not a function` (RED). Covers all 5 §7.3 branches (recibido/recarga/listo/delivery/default) × singular/plural + first-name extraction + buildWaLink encoding (1 test fixed typo in expected encoded literal after node -e check).
- [x] 2.2 GREEN `src/lib/utils/whatsapp.ts` (28): `mensajeWhatsApp` locked literal (§7.3) + `buildWaLink` (D13)
  - Evidence: `npx vitest run tests/unit/whatsapp.test.ts` → 17/17 pass (GREEN). Literal copied verbatim from spec §7.3 (tested with exact accented copy).
- [x] 2.3 RED `sheet-whatsapp.test.tsx`: pre-loaded literal ("Hola Gimnasio, tus 3 botellones están listos. ¿Te lo llevo hoy?"), editable, note, no auto-send on estado change
  - Evidence: new file → "Failed to resolve import @/components/operaciones/sheet-whatsapp" (RED). 7 tests: spec S1 literal, recibido-singular triangulation, name+mono phone+note, editable, encoded deeplink, Cancelar, S5 no-auto-send.
- [x] 2.4 RED (28): deeplink href `wa.me/<digitos>?text=<encoded>`; Cancelar closes without navigation
  - Evidence: same test file — asserts href `https://wa.me/581144445555?text=<encodeURIComponent(...)>` + target `_blank` + rel; Cancelar asserted as `<button>` without href + onClose called.
- [x] 2.5 GREEN `src/components/operaciones/sheet-whatsapp.tsx`: controlled bottom sheet (`ui/sheet` side=bottom), editable textarea, note, `--whatsapp` "Abrir WhatsApp" new tab, Cancelar (D8)
  - Evidence: `npx vitest run tests/component/sheet-whatsapp.test.tsx` → 7/7 pass (GREEN). Controlled via shell mount (open always true + onOpenChange→onClose); avatar `bg-whatsapp` + mono phone; tokens only.
- [x] 2.6 RED (28, MOD-18/23): `onWhatsApp` fires with phone; no-phone → `aria-disabled` + opacity-40 + toast "Este cliente no tiene teléfono cargado", sheet not opened (D7)
  - Evidence: updated 2 approval tests in `grupo-card.test.tsx` + 1 in `grupo-card-kanban.test.tsx` (disabled→aria-disabled, click fires) + new kanban passthrough test + 4 shell tests in `cola-operaciones.test.tsx` (sheet opens w/ message, no-phone toast, Cancelar closes, S5 tab change). 8 RED failures confirmed before wiring.
- [x] 2.7 GREEN wire: `grupo-card.tsx` + `grupo-card-kanban.tsx` (`aria-disabled`, not `disabled`) + `kanban-desktop.tsx` passthrough + shell handlers in `cola-operaciones.tsx`
  - Evidence: D7 switch in both cards (aria-disabled + onClick always fires); `KanbanDesktopProps.onWhatsApp?: (grupo, estado)` passthrough; shell `sheetWhatsApp` state + `abrirWhatsApp` (no-phone → showToast error, else setSheetWhatsApp); `<SheetWhatsApp>` rendered conditionally. 6 files → 81/81 pass.
- [x] 2.8 REFACTOR + verify (30): `npm run test`, `tsc --noEmit`, `npm run build`
  - Evidence: `npm run test` → 392/392 pass (36 files); `npx tsc --noEmit` → exit 0 (fixed missing `GrupoCola` import in kanban-desktop.tsx); `npm run build` → Compiled successfully. No hex in new components; no ui/* edits; no migrations; mover path untouched. LINE BUDGET: tracked diff 297 + 2 new untracked files (218) ≈ 515 changed lines > 400 — see apply report (size-exception recommendation, same as PR-A).

## Phase 3 — PR-C: Ficha + carried fixes

- [x] 3.1 RED `botellones-cliente.test.ts` (29): `getBotellonesCliente` returns all 5 estados incl. `entregado` + join + null-safe
  - Evidence: new file → 4 RED failures (function missing). 4 tests: query contract (direcciones(*) join + no estado filter), all 5 estados incl. entregado + first direccion row, unknown client → empty shape, transport rejection → empty shape (null-safe).
- [x] 3.2 GREEN `src/lib/db/botellones.ts`: `getBotellonesCliente(clienteId)` (`'use server'`, no estado filter, `direcciones(*)` join, null-safe try/catch, D14)
  - Evidence: `npx vitest run tests/unit/botellones-cliente.test.ts` → 4/4 pass (GREEN). Mock fixed once: supabase-js query builders are THENABLE (await builder.eq(...) resolves) — mock chain needed a `then` to mirror that. Test-name only; production code unchanged.
- [x] 3.3 RED `ficha-cliente.test.tsx`: nombre/cédula mono/dirección join; WhatsApp→sheet swap, Llamar `tel:`, Ficha `/clientes/[id]`; all-estados incl. entregado with badge + age; Escape closes, focus returns
  - Evidence: new file → "Failed to resolve import @/components/operaciones/ficha-cliente" (RED). 7 tests: data render (nombre SheetTitle 16/500, mono cédula, dirección join), "Sus botellones (2)" with badge + age incl. entregado, WhatsApp action fires onWhatsApp (D8 swap), Llamar `tel:` anchor, Ficha router.push('/clientes/cliente-1'), Cerrar closes, Escape closes + NULL cédula "—" mono.
- [x] 3.4 GREEN `src/components/operaciones/ficha-cliente.tsx`: data + 3 actions + all-estados list (`formatAntiguedad`); cédula mono, "—" when NULL; prefix display-only comment
  - Evidence: `npx vitest run tests/component/ficha-cliente.test.tsx` → 7/7 pass (GREEN). Controlled bottom sheet (ui/sheet side=bottom, D8); fetches getBotellonesCliente per open; ESTADO_COLORS badge + age (client clock); tokens only, no hex; cédula prefix note comment.
- [x] 3.5 GREEN wire name targets (MOD-18/23): `grupo-card.tsx` + `grupo-card-kanban.tsx` (span→button `onAbrirFicha`) + `kanban-desktop.tsx` + shell `sheetFicha` state (D8)
  - Evidence: 5 RED wiring tests (grupo-card onAbrirFicha, grupo-card-kanban span→button, kanban passthrough, shell ficha-open + D8 swap) → GREEN 69/69 in 5 files. Shell guard `abrirFicha` (null cliente_id → no-op) + `abrirFichaWhatsApp` swap; tsc caught `cliente_id: string | null` → guard + `!` at render site.
- [x] 3.6 Carried RED: `undo-flow.test.tsx` S2 honesty (mock restores original `estado_desde`, assert pre-undo age); `kanban-desktop.test.tsx` dragId cleared after drop
  - Evidence: S2 honesty ALREADY in tree (committed 6962a8e/6f00bc1 — title "restores estado AND the original estado_desde via p_restaurar", mock restores original timestamps, asserts pre-undo "1d"); verified 5/5. dragId RED: true RED (2 calls — stale fallback fired again) then GREEN with setDragId(null) in drop.
- [x] 3.7 Carried GREEN: `useColaOperaciones.ts` `mover` try/catch → error path (D12); `kanban-desktop.tsx` `setDragId(null)` in drop; `useEdadAhora` 30s tick (D10)
  - Evidence: D12 RED (unhandled rejection escaping mover) → GREEN try/catch → revert + red toast + `{ok:false}`, no unhandled errors (6/6). dragId: RED→GREEN (12/12). D10: RED (fake timers, 59m30s→"59m", +30s must show "1h" — failed frozen) → GREEN setInterval EDAD_TICK_MS=30000 (40/40 across 3 card/ficha files).
- [x] 3.8 REFACTOR + verify (30): `npm run test`, `tsc --noEmit`, `npm run build`; grep no-hex in new components; each PR ≤400 lines
  - Evidence: `npm run test` → 411/411 pass (38 files); `npx tsc --noEmit` → exit 0; `npm run build` → Compiled successfully. No hex in ficha-cliente.tsx (grep). LINE BUDGET: total ≈788 changed lines > 400 — ficha core ≈745 + carried fixes ≈43. Same size-exception pattern as PR-A (933) and PR-B (515): design estimates miss ~2x on test lines. Carried fixes are small and in-scope; if the maintainer wants them isolated they split cleanly to PR-D (~43 lines: D12, dragId, D10 + tests), but the ficha core alone exceeds 400 regardless.
