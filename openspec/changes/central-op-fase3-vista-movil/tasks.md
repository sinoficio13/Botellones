# Tasks: Central de Operaciones — Fase 3: Vista móvil (cola agrupada por cliente)

## Review Workload Forecast

Estimated changed lines (total): ~2,300 (7 slices, each ≤400).

| Slice | Content | Est. lines | 400-line risk |
|---|---|---|---|
| PR-A Frame | data layer + hook seed + tabs/context/empties/skeleton + R2 comments | ~388 ⚠ | High (borderline) |
| PR-B Card | `cola.ts` + `grupo-card.tsx` + tests | ~390 ⚠ | High (borderline) |
| PR-C Acción+undo | migration 0013 + mover/deshacer + R3-001/W-1 + tests | ~313 | Medium |
| PR-D Buscador | `buscarColaOperaciones` + `buscador.tsx` + tests | ~290 | Low |
| PR-E Reemplazo | shell + page swap + tablet + empties + E2E 375px | ~318 | Medium |
| PR-F Cleanup | delete `operaciones-dashboard.tsx` (pure deletions) | ~365 del | Medium |
| PR-G Cleanup | delete realtime test + orphaned helpers | ~248 del | Low |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

**Decision note**: user pre-approved the chained feature-branch-chain for this project — the decision is REUSED, not re-asked. `Decision needed before apply: Yes` reflects ask-always delivery: orchestrator confirms the reused strategy per slice before apply. Recommended slice order A→G (fixed, R6). Tracker base = `redesign/central-operaciones`; PR #2 base = PR #1 branch, PR #3 base = PR #2 branch, etc.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A | Queue frame (data+hook+tabs) | PR-A | `npm test -- tests/component/cola-tabs.test.tsx tests/component/use-cola-operaciones.test.tsx` | N/A — no route composes these until PR-E; component tests only | Revert `botellones.ts` additions; delete new files |
| B | Group card + urgency | PR-B | `npm test -- tests/unit/cola.test.ts tests/component/grupo-card.test.tsx` | N/A — card unwired until PR-E | Revert `cola.ts`/`grupo-card.tsx` (nothing consumes yet) |
| C | Move/undo + toast fix | PR-C | `npm test -- tests/component/toast.test.tsx tests/component/undo-flow.test.tsx` | Dev server: temporary page renders card→hook→ToastHost; move + Deshacer | Revert 0013 file; revert toast hunk |
| D | Search | PR-D | `npm test -- tests/component/buscador.test.tsx tests/unit/cola.test.ts` | N/A — search unwired until PR-E | Revert `buscador.tsx` + helper (queue degrades to no-search) |
| E | Dashboard replacement | PR-E | `npm test -- tests/component/cola-operaciones.test.tsx; npx playwright test` | `npm run dev` → `/dashboard` at 375px + 768px | Revert `page.tsx` swap (old dashboard returns, zero-loss) |
| F | Delete old kanban | PR-F | `npm test; npm run build` | `npm run dev` → `/dashboard` sanity | Restore deleted file from git history |
| G | Delete realtime tests + orphans | PR-G | `npm test; npx tsc --noEmit` | `npm run dev` → `/dashboard` + `botellones/[id]` | Restore deleted file/hunks |

## Slice 1 — PR-A Frame (REQ-16, 17, 21-blocks)

- [x] 1.1 RED `tests/component/use-cola-operaciones.test.tsx` — fixture rows: client-owned filter, per-estado partition+`agrupar`, totals (REQ-16). Accept: NULL `cliente_id` excluded pre-agrupar; FIFO oldest-first. — **EVIDENCE**: 4 tests (null-cliente exclusion, partition+D12, totals, cargando lifecycle); RED confirmed via transform failure (module missing); GREEN 4/4 `npx vitest run tests/component/use-cola-operaciones.test.tsx`.
- [x] 1.2 GREEN `src/lib/db/botellones.ts` — `SELECT_COLA`, `ColaBotellon`, `getColaOperaciones()`: `.not('cliente_id','is',null)`, `.in('estado', ESTADOS_KANBAN)`, `.order('estado_desde', asc)`, join `clientes(nombre,cedula,telefono_1,whatsapp)` (REQ-16). Accept: scenario "Client-owned rows only, FIFO ordered". — **EVIDENCE**: additive only (`+36/-1`); RED via compile gate (missing export referenced by hook test); server query shape verified by diff (design matrix); full suite green.
- [x] 1.3 GREEN `src/hooks/useColaOperaciones.ts` — fetch → 4 `agrupar` partitions (D12) → `porEstado`/`totales` memo; NO selection API (D6) (REQ-16/17). Accept: scenario "Groups feed FIFO tabs". — **EVIDENCE**: hook test 4/4 green; `src/hooks/useColaOperaciones.ts` (project hook convention per proposal).
- [x] 1.4 RED `tests/component/cola-tabs.test.tsx` — tablist/tab/`aria-selected`, sticky, 2px `--estado-*` underline, group counters, context totals (REQ-17). Accept: scenarios "Accessible sticky tabs" + "Context totals". — **EVIDENCE**: 6 tests (tabs roles+counters, aria-selected+change, underline token+sticky, context bar plural/singular, per-tab empty copy+icon+action, skeleton no-spinner); RED via transform failure; GREEN 6/6.
- [x] 1.5 GREEN `tabs-estados.tsx` + `barra-contexto.tsx` + `copy-vacios.tsx` (4 per-tab copy) + `lista-skeleton.tsx` (reuses Skeleton, REQ-13) (REQ-17/21). Accept: counters static; no spinner element. — **EVIDENCE**: 4 components created; `VacioPorEstado` renders §8.2 copy via EmptyState primitive with inert action buttons (wiring = Slice E); `ListaSkeleton` composes Skeleton (no spinner, asserted).
- [x] 1.6 GREEN `src/app/globals.css` — R2-001/2 token-namespace intent comments only (REQ-21). Accept: comment-only diff, token values unchanged. — **EVIDENCE**: `git diff` shows +21/-3 comment-only; R2-001 (text-muted==text-disabled light, §5.1 locked) and R2-002 (Spanish domain namespace, --marca duplicates --estado-recarga by design) documented; zero value changes.

## Slice 2 — PR-B Card (REQ-18)

- [x] 2.1 RED `tests/unit/cola.test.ts` — `formatAntiguedad` matrix (45m/59m/1h/3h/23h/1d/3d/0m/future→0m), `nivelUrgencia` (5h normal/6h urgencia/24h urgencia/24h+1m critica/30h critica/future normal), fixed ISO + injected `ahora` (REQ-18). — **EVIDENCE**: 16 tests (design matrix 8+2 + urgency matrix 5+1, `hace()` helper + injectable `ahora`, D8); RED via unresolved import `@/lib/utils/cola`; GREEN 16/16 `npx vitest run tests/unit/cola.test.ts`.
- [x] 2.2 GREEN `src/lib/utils/cola.ts` — `formatAntiguedad`, `nivelUrgencia` (REQ-18). Accept: full matrix green. — **EVIDENCE**: pure helpers with named MS constants; `<60min→"Nm"`, `1–23h→"Nh"` (round), `≥24h→"Nd"` (round), future clamped to 0; `NivelUrgencia` type; 16/16 green.
- [x] 2.3 RED `tests/component/grupo-card.test.tsx` — chips all-marked/`+N`>6/`aria-pressed`, 0-marked disabled "Elegí al menos un botellón", urgency classes, null cédula "—" mono, per-estado ActionButton copy (REQ-18/19). Accept: scenarios "Chips all-marked", "Urgency levels", "Null cédula". — **EVIDENCE**: 14 tests (client block + 3 targets, null cédula, all-marked + individual toggle, count in copy + `onAccion` ids, +N expansion 6→8, 0-marked disabled, `enAccion` disabled, WhatsApp disabled+opacity-40 / enabled-inert, urgency normal/urgencia/critica classes, per-estado copy ×4); RED via unresolved import; GREEN 14/14. Test-side fixes during cycle: `unmount` destructure; 30h→"1d" per design matrix (≥24h shows days); icon class `lucide-triangle-alert` (lucide rename).
- [x] 2.4 GREEN `src/components/operaciones/grupo-card.tsx` — client block + 3 ≥44px targets (name inert; WhatsApp disabled no-phone/inert with-phone), chips grid `+N`, `--urgencia` amber text / `▲ AlertTriangle` + amber 7% bg, ActionButton ALWAYS `--marca`, cédula `font-mono` (REQ-18). Accept: grep — no hardcoded hex in new components. — **EVIDENCE**: tokens only (grep: zero hex); D6 card-local selection (all-marked on mount, survives subset moves); chips grid 6 visibles + expansor; `copiaAccion` per estado via `ESTADO_LABELS`; 30h card renders `bg-urgencia/7` + `lucide-triangle-alert` (verified in DOM); `bg-surface-1` merged away by tailwind-merge on critica (intended — amber tint replaces surface).
- **Carried fix (review R2-001)**: `ESTADOS_OPERATIVOS` ahora deriva de `ESTADOS_KANBAN` en `src/hooks/useColaOperaciones.ts` (`Exclude<Estado,'entregado'>` + filter con type guard) — única fuente de verdad; approval test añadido en `use-cola-operaciones.test.tsx` (invariante: kanban sin entregado == 4 estados); suite verde antes y después (11/11 → 11/11).

## Slice 3 — PR-C Acción+undo (REQ-19, MOD-12)

- [ ] 3.1 RED `tests/component/toast.test.tsx` — R3-001: toast shown inside `onAction` survives original dismiss; fake timers (MOD-12). Accept: scenario "Action-shown toast survives".
- [ ] 3.2 GREEN `src/components/operaciones/toast.tsx` — dismiss-by-captured-id + W-1 `const` (MOD-12). Accept: R3-001 green; `npm run lint` clean.
- [ ] 3.3 GREEN `supabase/migrations/0013_undo_mover_botellones.sql` — `mover_botellones(p_ids, p_estado, p_estado_desde jsonb DEFAULT NULL)` + conditional `estado_desde` UPDATE + idempotent REVOKE/GRANT; extend `src/types/database.ts` RPC Args `p_estado_desde?: Record<string,string> | null` (REQ-19). Accept: 2-arg calls unaffected; migration idempotent.
- [ ] 3.4 RED `tests/component/undo-flow.test.tsx` — card→hook→ToastHost: optimistic move; Deshacer→RPC reverse→estado + original `estado_desde` restored; error→revert + red toast no undo; zero-marked disabled; Entregar opens NO selector (REQ-19). Accept: scenarios "Optimistic move", "Undo restores", "Failure reverts", "Zero marked", "Entregar".
- [ ] 3.5 GREEN `src/hooks/useColaOperaciones.ts` — `mover` (snapshot, optimistic removal, Toast Deshacer 4.5s, RPC, apply RETURNED rows per D10, error revert + red toast), `deshacer` (serialize via `enVueloRef`, await RPC per D11) (REQ-19). Accept: D10 — no `router.refresh()`.

## Slice 4 — PR-D Buscador (REQ-20)

- [ ] 4.1 RED `tests/unit/cola.test.ts` — `normalizarCedula`: digits-only, spaces/leading zeros stripped, null→"" (REQ-20). Accept: "12 345"→"12345".
- [ ] 4.2 GREEN `src/lib/db/botellones.ts` — `buscarColaOperaciones(q)` parallel: nombre ilike / código ilike + cédula fetch+digits-only filter; `ResultadoBusqueda` grouped (REQ-20). Accept: scenario "Debounced parallel grouped search" (server side).
- [ ] 4.3 RED `tests/component/buscador.test.tsx` — fake timers 250ms debounce, min-2 gate, grouped rendering (REQ-20). Accept: scenario "Minimum length gate" — 1 char never searches.
- [ ] 4.4 GREEN `src/components/operaciones/buscador.tsx` — input + `useDebounce` 250ms + min-2 gate + grouped results (REQ-20). Accept: debounce test green; `use-debounce.ts` reused, not forked.

## Slice 5 — PR-E Reemplazo (REQ-21)

- [ ] 5.1 RED `tests/component/cola-operaciones.test.tsx` — skeleton on load (never spinner), per-tab empties, first-use empty + [📷 Escanear]→`ScannerModal` + [Cargar manual]→`/recargas/carga`, tablet `md:grid-cols-2` classes (REQ-21). Accept: scenarios "Loading is a skeleton", "First-use empty".
- [ ] 5.2 GREEN `src/components/operaciones/cola-operaciones.tsx` — shell: tabs+cards mobile / 2-col sections per estado, tabs `md:hidden` (D9), search slot, skeleton, empties, ScannerModal, action-toast orchestration (REQ-21). Accept: scenario "Tablet sections without tabs".
- [ ] 5.3 GREEN `src/app/(dashboard)/dashboard/page.tsx` — drop `getOperaciones`, render `<ColaOperaciones />` (REQ-21). Accept: old `operaciones-dashboard.tsx` stays in tree until PR-F (zero-loss rollback).
- [ ] 5.4 RED `tests/e2e/cola-375px.spec.ts` — Playwright viewport 375px: `scrollWidth ≤ 375` (REQ-21). Accept: scenario "No horizontal scroll at 375px".

## Slice 6 — PR-F Cleanup deletions (REQ-21)

- [ ] 6.1 Delete `src/components/dashboard/operaciones-dashboard.tsx` (~365 del) (REQ-21). Accept: `npm test` + `npm run build` green; no remaining imports.

## Slice 7 — PR-G Cleanup deletions (REQ-21)

- [ ] 7.1 Delete `tests/component/operaciones-realtime.test.tsx` (~222 del) + orphaned `getOperaciones`/`BotellonOperativo` from `src/lib/db/botellones.ts` (~26 del) (REQ-21). Accept: `npm test` + `npx tsc --noEmit` green; grep — zero references.

## REQ → Task traceability

| REQ | Tasks |
|---|---|
| REQ-COS-16 | 1.1–1.3 |
| REQ-COS-17 | 1.4–1.5 |
| REQ-COS-18 | 2.1–2.4 |
| REQ-COS-19 | 3.3–3.5 (card copy/disabled covered in 2.3–2.4) |
| REQ-COS-20 | 4.1–4.4 |
| REQ-COS-21 | 1.5–1.6 (blocks), 5.1–5.4, 6.1, 7.1 |
| MOD REQ-COS-12 | 3.1–3.2 |

## Slice-coupling guard (design R6)

- **Acceptance rule, every slice**: a slice's tests MUST NOT import files from later slices; each PR must be green independently. Chain order A→G is fixed; PR-E composes A–D components.
- PR-A/B/D components ship unwired (no route imports them until PR-E) — their tests exercise them standalone, which is the R6-safe pattern.
- PR-C ships migration `0013` (its only consumer); no migration in PR-A/B.
- PR-F/G delete ONLY listed files: `getClientesForSelect` (live: `botellones/[id]/page.tsx:1`) and `estado-en-vivo.tsx` (live: `botellones/[id]/form.tsx:11`) MUST NOT be deleted.