# Proposal: Central de Operaciones â€” Fase 3: Vista mÃ³vil (cola agrupada por cliente)

## Intent

EPIC-15 fase 3 is THE VISIBLE ONE: it replaces the old `/dashboard` (kanban per-bottle, `operaciones-dashboard.tsx`) with the mobile-first **client-grouped operations queue** â€” the 80% of the epic's value. The unit of work becomes the **client** (3 bottles returned â†’ recargados juntos â†’ devueltos juntos): 4 estado tabs (FIFO oldest-first), group cards with chip selection, one-tap advance/entregar with Deshacer via the fase-1 RPC, a search box, skeleton/empty states, and a tablet 2-column layout. Spec Â§9 exclusions are honored: NO client selector on Entregar, NO KPIs/"Necesita tu atenciÃ³n"/"En circulaciÃ³n" on mobile, NO realtime (fase 5 â€” temporary documented regression), NO WhatsApp/ficha sheets (fase 5 placeholders). Also carries the fase-2 review findings: R3-001 (toast Deshacer dismiss bug), W-1 (prefer-const lint), R2-001/2 (token-namespace intent documented).

## Scope

### In Scope
- **Data layer**: new `getColaOperaciones()` in `src/lib/db/botellones.ts` â€” client-owned rows only (`cliente_id IS NOT NULL`, stock excluded), selecting `estado_desde` + `clientes(nombre, cedula, telefono_1, whatsapp)`, FIFO feed into fase-1 `agrupar()`. Client hook `useColaOperaciones` (fetch + agrupar + per-estado memo). NOT realtime (fase 5).
- **Tabs + context bar (HIST-15.3.1)**: 4 estado tabs (`role=tablist`/`tab`, `aria-selected`, sticky, 2px underline in `--estado-*` token, live counters â€” STATIC this fase, realtime in fase 5), context bar "N clientes Â· N botellones Â· mÃ¡s antiguo arriba".
- **Card grupo (HIST-15.3.2)**: client name + cÃ©dula block (mono cÃ©dula) with 3 independent â‰¥44px touch targets (nameâ†’ficha sheet = FASE 5 placeholder, inert; WhatsApp icon = FASE 5 placeholder, disabled if no phone per Â§7.3; chips toggle). Chips all-marked default, individual toggle, `+N` expansion when >6. Urgency 2 levels: <6h normal, 6-24h amber `--urgencia` #B07515, >24h `â–² AlertTriangle` + amber 7% card bg. Age format `45m`/`3h`/`3d`.
- **Action + undo (HIST-15.3.3)**: ActionButton per estado ("â†’ Pasar N a En recarga" / "â†’ Pasar N a Listo" / "â†’ Pasar N a En delivery" / "âœ“ Entregar N a {PrimerNombre}"), ALWAYS `--marca` #0C7C92; 0 marked â†’ disabled "ElegÃ­ al menos un botellÃ³n". Optimistic update â†’ Toast with Deshacer (4.5s) â†’ RPC `mover_botellones(ids, estado)`. Deshacer reverts via RPC reverse transition (estado_desde=now() â€” acceptable, documented). Error â†’ revert + red toast "No se pudo mover. ReintentÃ¡." (no undo). **Entregar = confirm return, NO client selector (spec Â§9)**.
- **Buscador (HIST-15.3.4)**: input in queue header, debounce 250ms (reuse `src/hooks/use-debounce.ts`), min 2 chars, parallel search nombre ilike / cÃ©dula normalized (digits-only) / cÃ³digo ilike, results grouped by type. Server helper in `src/lib/db/botellones.ts`.
- **Replace dashboard (HIST-15.3.5)**: `/dashboard` renders the new queue (mobile tabs+cards; tablet 768-1023 = 2-col grid sections per estado WITHOUT tabs, spec Â§6.2). Skeleton loading (never spinner). Empty states per tab (Â§8.2 copy) + total empty first-use (Â§8.3) with [ðŸ“· Escanear] (opens existing `ScannerModal`) / [Cargar manual] (â†’ `/recargas/carga`). 375px no horizontal scroll.
- **Carried fixes (MUST ship)**: R3-001 (toast Deshacer must not dismiss a toast shown inside `onAction` â€” fix primitive while wiring undo), W-1 (`toast.tsx:23` prefer-const), R2-001/2 (token naming â€” DOCUMENT intent comment in `globals.css`, no value change).

### Out of Scope
- Realtime queue + floating chip, realtime tab counters (fase 5); WhatsApp bottom sheet (fase 5); ficha cliente bottom sheet (fase 5) â€” card targets render as inert/disabled placeholders.
- Desktop kanban â‰¥1024px + drag & drop (fase 4). "Necesita tu atenciÃ³n", "En circulaciÃ³n", KPIs on mobile (spec Â§9). Client-assign modal (REMOVED, spec Â§9). Third urgency level; estado color as card background (spec Â§9).
- DB schema changes (RPC `mover_botellones` reused as-is); new packages; `sonner`.

## Business Rules (locked)

1. Queue shows ONLY client-owned botellones (`cliente_id NOT NULL`); stock excluded. `cliente_id` stays nullable (stock managed elsewhere).
2. **Entregar = confirmar devoluciÃ³n** in one tap via RPC â€” machine-only, NO client selector ever.
3. FIFO strict: group age = `min(estado_desde)`; groups oldest-first; codes oldest-first inside group (fase-1 `agrupar()`).
4. ActionButton ALWAYS `--marca` #0C7C92 in all 4 estados; estado color lives on tab underline + chips only, never card bg.
5. Chips: all marked by default; individual toggle; 6 visible + `+N` expansion when group >6.
6. Urgency: <6h normal Â· 6-24h amber `--urgencia` #B07515 Â· >24h `â–²` + amber 7% card bg. Age format `45m`/`3h`/`3d`.
7. Toast: single instance, 4.5s, "Deshacer" success-only (never error); error â†’ revert + red toast without undo.
8. Tabs sticky, 2px underline in `--estado-*`; counters static this fase (realtime fase 5).
9. Tokens only â€” no hardcoded hex in new components; Inter/JetBrains Mono (cÃ©dula `font-mono`).
10. Loading = skeleton shimmer, never spinner; 375px no horizontal scroll.

## User Stories / Scenarios

- **FIFO clarity**: an operator opens `/dashboard` on their phone and sees each estado tab's oldest client first â€” "mÃ¡s antiguo arriba" is literally true, no sorting guesswork.
- **Batch advance**: a client's 3 bottles appear as one card with all chips marked; one tap "â†’ Pasar 3 a En recarga" removes them instantly; a single Toast offers Deshacer.
- **Entregar sin fricciÃ³n**: on the Delivery tab, "âœ“ Entregar 3 a MarÃ­a" confirms the return in one tap â€” no modal, no selector (spec Â§9).
- **Mistake recovery**: an operator advances the wrong group â†’ taps Deshacer â†’ the bottles return to their estado (age resets to now, documented); a network failure shows the red toast and restores the list.
- **Urgency at a glance**: bottles stuck >24h show `â–²` + amber 7% card background; 6-24h show amber text â€” an operator prioritizes without opening anything.
- **Finding a client**: typing "ma" (2+ chars) after 250ms debounce returns matches grouped by Nombre / CÃ©dula / CÃ³digo.
- **First use**: an empty queue shows the first-use empty state with [ðŸ“· Escanear] and [Cargar manual]; a tab with no groups shows its own empty copy.

## Capabilities

### New Capabilities
None â€” extend the existing `central-operaciones-schema` capability (one capability per change, matching fase-1/2).

### Modified Capabilities
- `central-operaciones-schema` (delta): **ADDED** REQ-COS-16..21 â€” REQ-COS-16 cola operativa (server query + client-owned filter + FIFO feed), REQ-COS-17 tabs de estado + barra de contexto, REQ-COS-18 card de grupo + chips + urgencia, REQ-COS-19 acciÃ³n avance/entrega + optimistic + undo (incl. botÃ³n copy + disabled + revert), REQ-COS-20 buscador (debounce/paralelo/agrupado), REQ-COS-21 reemplazo del dashboard (skeleton/vacÃ­os/tablet/375px). **MODIFIED** REQ-COS-12 (Toast): Deshacer must not dismiss a toast shown inside `onAction` (R3-001) + W-1 `prefer-const` â€” full requirement block replaced including preserved scenarios.

## Approach

New `getColaOperaciones()` (NOT extending `getOperaciones` â€” that function + `BotellonOperativo` die with the old dashboard in the cleanup slice): one select with `estado_desde` + `clientes(nombre, cedula, telefono_1, whatsapp)` + `.not('cliente_id','is',null)`, ordered by `estado_desde` asc. Client hook in `src/hooks/useColaOperaciones.ts` (project hook convention) fetches once, runs fase-1 `agrupar()`, and memoizes per-estado lists + tab counts (static). Pure helpers `formatAntiguedad`/`nivelUrgencia` in `src/lib/utils/cola.ts` (mirrors `grupos.ts` convention, unit-tested). Components in `src/components/operaciones/` (domain folder): `cola-tabs.tsx`, `grupo-card.tsx`, `cola-operaciones.tsx` (screen shell). Undo = call the RPC again with the reverse transition (per `getReversiones`) â€” zero schema change; the trigger stamps `estado_desde=now()` (documented acceptable). R3-001 fix: dismiss the OLD toast by captured id before/independently of `onAction` so a new `showToast()` inside `onAction` survives. Buscador = server helper (authoritative, digits-only cÃ©dula) + client debounce. Tablet = pure CSS (`md:grid-cols-2`, tabs `md:hidden`), no JS breakpoint.

## Approach Comparison

| Decision | Chosen | Why |
|---|---|---|
| Server query | New `getColaOperaciones()` | `getOperaciones` carries KPI/recargasHoy baggage and dies with the old dashboard; new function is queue-shaped |
| Client data | `useColaOperaciones` hook in `src/hooks/` | Project hook convention (`use-debounce.ts`); testable; one fetch |
| Urgencia/age | Pure `src/lib/utils/cola.ts` helpers | Matches `grupos.ts` pure-util convention; unit-testable |
| Buscador | Server helper in `botellones.ts` + `use-debounce` | Authoritative + cÃ©dula normalization in SQL; client filter would only see loaded rows |
| Undo | RPC reverse transition | Zero schema change; age reset (now()) documented â€” alternative (restore original `estado_desde`) needs new RPC param, rejected |
| Tablet layout | CSS only (`md:grid-cols-2`, tabs `md:hidden`) | Spec Â§6.2: sections per estado without tabs; no JS breakpoint |
| Fase-5 placeholders | Inert/disabled targets (chevron inert, WhatsApp disabled if no phone) | Â§7.3 no-phone rule honored; sheet behavior fase 5 |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/lib/db/botellones.ts` | Modified | + `getColaOperaciones()` + `ColaBotellon` type; + `buscarColaOperaciones()` (parallel search) |
| `src/hooks/useColaOperaciones.ts` | New | Fetch â†’ `agrupar()` â†’ per-estado memo + static counters |
| `src/lib/utils/cola.ts` | New | `formatAntiguedad` (45m/3h/3d), `nivelUrgencia` (<6h/6-24h/>24h) â€” pure, tested |
| `src/components/operaciones/cola-tabs.tsx` | New | tablist/tab/aria-selected, sticky, 2px estado underline, counters, context bar |
| `src/components/operaciones/grupo-card.tsx` | New | client block + 3 targets, chips grid (+N), urgency bg, ActionButton |
| `src/components/operaciones/cola-operaciones.tsx` | New | Screen shell: tabs + cards + search + skeleton + empty states (per-tab + first-use) |
| `src/components/operaciones/toast.tsx` | Modified | R3-001 undo-dismiss fix + W-1 prefer-const |
| `src/app/globals.css` | Modified (comment only) | R2-001/2 token-namespace intent comments; NO value change |
| `src/app/(dashboard)/dashboard/page.tsx` | Modified | Renders new queue (replaces `OperacionesDashboard` import) |
| `src/components/dashboard/operaciones-dashboard.tsx` | Removed (cleanup slice) | Old kanban + assign modal + realtime subscription (spec Â§9) |
| `tests/component/operaciones-realtime.test.tsx` | Removed (cleanup slice) | Tests deleted component |
| `tests/component/cola-*.test.tsx` | New | hook/selectCola, tabs a11y, card/chips, undo flow, buscador, toast R3-001 regression |
| `src/components/scanner/scanner-modal.tsx`, `/recargas/carga` | Untouched | Reused by first-use empty state |

## Risks

| Risk | Tier | Mitigation |
|---|---|---|
| Realtime regression: no live updates until fase 5; multi-operator stale views | WARNING | Documented; counters static; `router.refresh()` after own action; fase 5 restores |
| Undo resets age â€” reverted bottle re-enters FIFO at bottom (`estado_desde=now()`) | WARNING | Documented acceptable (question round 1); alternative needs RPC change, out of scope |
| ~1,540 authored + ~580 deleted lines â‰« 400-line budget | WARNING | 7 chained PRs (slice plan below); PR-A flagged borderline; deletion grouping = ask-always decision |
| R3-001 fix regression (toast races) | WARNING | Capture toast id; fake-timer regression test in PR-C |
| RPC role guard: unauthenticated/non-admin call rejected | NOTE | Surfaced as error revert + red toast (same path as network failure) |
| Dark mode dormant until fase 3 consumes tokens (S-6) | NOTE | Verify both modes in fase 3 (tabs underline, chips, urgency bg) |
| CÃ©dula nullable / malformed | NOTE | Card renders `â€”` when null; search normalizes digits-only (spaces/leading zeros) |
| `agrupar()` stock (null) key unused by queue | NOTE | Queue filters `cliente_id NOT NULL` pre-agrupar; null-key path stays for other consumers/tests |

## Non-goals / Constraints

- No realtime, no WhatsApp sheet, no ficha sheet (all fase 5); placeholders inert/disabled only.
- No client selector on Entregar; no KPIs/"Necesita tu atenciÃ³n"/"En circulaciÃ³n"; no third urgency level; no estado color as card bg (spec Â§9).
- No desktop kanban/drag (fase 4); no DB schema changes; no new packages; no `sonner`.
- Do NOT modify shadcn `src/components/ui/*`; tokens additive-only (fase-2 rule).

## Rollback Plan

- **PR-E (page swap) is the risky point**: `operaciones-dashboard.tsx` stays in the tree until the final cleanup PR â†’ reverting `page.tsx` to the old import restores the old dashboard instantly (zero-loss rollback).
- Every slice is independently revertible (no cross-slice coupling beyond imports; RPC/schema untouched â†’ no DB migration rollback needed).
- Buscador regression â†’ revert PR-D only; queue degrades to no-search, still fully usable.
- R3-001 fix regression â†’ revert PR-C's toast hunk; undo still works, only the nested-toast edge case regresses to fase-2 behavior.

## Dependencies

- Fase-1 (archived): `mover_botellones` RPC, `estado_desde`, `agrupar()`/`GrupoCliente` â€” canonical spec REQ-COS-1..7 in tree.
- Fase-2 (archived): tokens + Chip/ActionButton/Toast/Skeleton/EmptyState primitives + tests â€” REQ-COS-8..15 in tree.
- Reuse: `src/hooks/use-debounce.ts` (buscador), `ScannerModal`, `/recargas/carga` route (first-use actions), `getReversiones` (undo).
- `openspec/config.yaml` absent from working tree (lives on `chore/central-op-fase1-registro`) â€” `rules.proposal` N/A; merge ordering same as fase-2.
- Delivery: ask-always; chained PRs (below).

## Proposal question round

Assumptions needing sign-off (locked orchestrator decisions respected):

1. **Undo age reset**: Deshacer reverts estado via RPC; the trigger stamps `estado_desde=now()`, so the undone bottle loses its original age and re-enters FIFO at the bottom. Accept? (Restoring the original timestamp would require a new RPC param â€” rejected as scope creep.)
2. **Buscador scope + normalization (LOCKED)**: server-side search over the 4 queue estados (client-owned, matches what the queue shows) with cÃ©dula normalized digits-only â€” or should search also cover `entregado`/stock? LOCKED: 4 estados only.
3. **WhatsApp icon, fase 3, clients WITH phone**: locked no-phone behavior is disabled-icon (opacity 40%); the sheet opens in fase 5. For clients WITH phone: (a) inert placeholder tap (no-op, documented) â€” recommended, or (b) hide the icon entirely until fase 5?
4. **Old dashboard deletion**: 2 dedicated low-risk deletion PRs in this change (~580 deleted lines, each <400) â€” recommended â€” vs deferring deletion to fase 4's desktop rewrite (dead code temporarily in tree)?
5. **Tablet UX (768-1023)**: spec Â§6.2 locks 2-col sections per estado WITHOUT tabs. LOCKED per spec §6.2: no tabs on tablet, 2-col sections per estado with sticky section headers.

## Chained-PR slice plan (each â‰¤400 changed lines)

| Slice | Content | Est. lines |
|---|---|---|
| PR-A Frame | `getColaOperaciones` + type, `useColaOperaciones` + `selectCola`, tabs/context bar, skeleton wiring, per-tab EmptyState copy, hook/tabs tests, R2-001/2 comment in `globals.css` | ~400 âš  borderline (trim: leaner tests) |
| PR-B Card | `grupo-card.tsx` (client block + 3 targets + chips grid + `+N`), `cola.ts` urgency/age helpers + tests | ~355 |
| PR-C AcciÃ³n | ActionButton wiring per estado, optimistic + RPC + Deshacer + revert + error path, **R3-001 toast fix + W-1**, toast regression test, undo-flow test | ~270 |
| PR-D Buscador | `buscarColaOperaciones` (parallel, digits-only cÃ©dula), debounce wiring, grouped results + tests | ~260 |
| PR-E Reemplazo | `cola-operaciones.tsx` shell composition, `page.tsx` swap, tablet 2-col grid, first-use empty + ScannerModal/Cargar manual wiring | ~260 |
| PR-F Cleanup (deletions) | Remove `operaciones-dashboard.tsx` (~360 del) | ~360 |
| PR-G Cleanup (deletions) | Remove `operaciones-realtime.test.tsx` + orphaned `getOperaciones`/`BotellonOperativo`/`getClientesForSelect` (~262 del) | ~262 |

Optional: merge PR-F+G into one deletion PR (~622) â€” needs explicit exception under ask-always (pure deletions are the cheapest review load).

## Success Criteria

- [ ] `/dashboard` renders the client-grouped queue: tabs+cards on mobile, 2-col sections per estado on tablet 768-1023 (no tabs), no horizontal scroll at 375px
- [ ] FIFO verified: oldest group first per estado; group age = min `estado_desde`; codes oldest-first
- [ ] Chips all-marked default, individual toggle, `+N` >6; 0 marked â†’ disabled button "ElegÃ­ al menos un botellÃ³n"
- [ ] Action optimistic (bottles vanish instantly) â†’ Toast Deshacer 4.5s â†’ RPC; Deshacer reverts estado+`estado_desde`; error â†’ revert + red toast "No se pudo mover. ReintentÃ¡." without undo
- [ ] Entregar opens NO client selector; RPC machine-only; botÃ³n copy per estado in Spanish
- [ ] Buscador: 250ms debounce, min 2 chars, results grouped by Nombre/CÃ©dula/CÃ³digo
- [ ] Skeleton shimmer on load (never spinner); 4 per-tab empty states + first-use empty with [ðŸ“· Escanear]/[Cargar manual]
- [ ] Urgency: <6h normal, 6-24h `--urgencia`, >24h `â–²` + amber 7% bg; age `45m`/`3h`/`3d`
- [ ] R3-001 fixed with regression test (toast shown inside `onAction` survives); W-1 lint clean; R2-001/2 intent comments present, token values unchanged
- [ ] No hardcoded hex in new components (grep); tokens only; cÃ©dula mono
- [ ] Full suite green (`npm run test`), `tsc --noEmit`, `npm run build`; each PR â‰¤400 changed lines