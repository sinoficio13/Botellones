# Tasks: Central de Operaciones — Fase 4: Kanban desktop (≥1024px)

## Review Workload Forecast

Estimated changed lines (total): ~615–655 across 2 PRs.

| Slice | Content | Est. lines | 400-line risk |
|---|---|---|---|
| PR-A | Breakpoint fix + `grupo-card.tsx` exports + `kanban-desktop.tsx` + `grupo-card-kanban.tsx` + card/breakpoint tests | ~399 ⚠ | High (borderline) |
| PR-B | Drag wiring + `kanban-desktop.test.tsx` + e2e (droppable) | ~215 (~255 w/ e2e) | Low (Medium w/ e2e) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

**Decision note**: user pre-approved the chained feature-branch-chain for this project (fase 3) — the decision is REUSED, not re-asked. `Decision needed before apply: Yes` reflects ask-always delivery: the orchestrator confirms the reused strategy per slice before apply. Tracker base = `redesign/central-operaciones` (current branch); PR-A base = tracker; PR-B base = PR-A branch. PR-A trim plan: if actual >400, move card-test blocks `1.2b` (SSR-safe + WhatsApp, ~25 lines) to PR-B (2.1) — the trim is pre-approved by the design, no re-ask needed.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Desktop frame + compact card (REQ 22/23/24, MOD 21) | PR-A | `npx vitest run tests/component/grupo-card-kanban.test.tsx tests/component/cola-operaciones.test.tsx` | `npm run dev` → `/dashboard` at 1024/1440 (4 columns) + 768/1023 (tablet unchanged) | Revert `cola-operaciones.tsx` class hunks + delete `kanban-desktop.tsx`/`grupo-card-kanban.tsx` + revert `grupo-card.tsx` exports (zero DB impact) |
| 2 | Drag & drop + column tests (REQ 25/26) | PR-B | `npx vitest run tests/component/kanban-desktop.test.tsx` (+ `npx playwright test tests/e2e/cola-1024px.spec.ts --project=chromium` if kept) | `npm run dev` → `/dashboard` at 1024: drag card across columns → Deshacer undo; invalid drop → red toast (dev auth cookie, real RPC) | Revert drag handlers in `kanban-desktop.tsx`/`grupo-card-kanban.tsx` (cards fully operable via ActionButton) + revert tests |

## Slice 1 — PR-A Desktop frame + compact card (MOD 21, REQ 22, 23, 24) ~399 ⚠

- [x] 1.1 RED `tests/component/grupo-card-kanban.test.tsx` (REQ-23) — core: name + mono cédula/"—"; `·`-codes 6 visible + static "+2" for 8, no chips (`aria-pressed` absent); per-estado copy ×4 (`→ Pasar N a …`/`✓ Entregar N a …`); whole-group ids → `onAccion`; ActionButton `min-h-11`; `enAccion` disables. RED via missing module/exports (transform failure). — DONE (RED: transform failure; GREEN: 11 tests)
- [x] 1.2 GREEN `grupo-card.tsx` +2 additive exports `copiaAccion`/`useEdadAhora` (D2, no behavior change) + `grupo-card-kanban.tsx` compact card (D3/D12): tokens only, WhatsApp inert target (disabled+`opacity-40` sin teléfono), `data-testid="grupo-card-kanban"`. Accept: no chips, grep zero hex. — DONE (grep NO_HEX_OK; grupo-card.test.tsx 20/20 still green)
- [x] 1.2b (TRIM → 2.1 if >400) same-file RED blocks: SSR-safe `renderToString` (server HTML free of critica/`▲` for a 30h group) + WhatsApp disabled/inert pair (REQ-23 S4) — ~25 lines. — KEPT in PR-A (final diff 390 ≤ 400, no trim needed)
- [x] 1.3 RED `tests/component/cola-operaciones.test.tsx` +1 breakpoint it (MOD-21/REQ-22): `cola-movil` has `md:hidden`, `cola-tablet` has `hidden md:grid-cols-2 lg:hidden`, `cola-kanban` has `hidden lg:grid lg:grid-cols-4`; existing 375/768/1023 assertions stay green (no `role="region"` collision — D7). RED via missing `cola-kanban` testid. — DONE (RED: 1 failed/8 passed; GREEN: 9/9)
- [x] 1.4 GREEN `kanban-desktop.tsx` (REQ-22/24, NO drag): 4 columns from `ESTADOS_OPERATIVOS`, `role="group"` + `data-testid="kanban-columna"`, sticky header (2px `ESTADO_DOT`, `ESTADO_LABELS`+counter, `SUBTITULO_ESTADO`), body = `ListaSkeleton cantidad={1}` (cargando, D11) / cards (FIFO `porEstado`, no re-sort) / dashed `min-h-[120px]` "Vacío" via `EmptyState` (D9); props `{ porEstado, cargando, onMover }`. — DONE (inert onDragOver/onDrop stubs for Slice B; no dragId/draggable)
- [x] 1.5 GREEN `cola-operaciones.tsx`: tablet grid `md:grid md:grid-cols-2 lg:hidden` (line ~146) + new branch `<div data-testid="cola-kanban" className="hidden gap-4 px-4 py-4 lg:grid lg:grid-cols-4">` rendering `<KanbanDesktop porEstado={porEstado} cargando={cargando} onMover={mover} />`; mobile/tablet markup untouched. — DONE
- [x] 1.6 Slice gate: `npm run test` (fase-3 suite green) + `npx tsc --noEmit` + `npm run build` + grep no hex + `git diff --stat` ≤400 (trim 1.2b if over). — DONE: 33 files/342 tests; tsc exit 0; build OK; NO_HEX_OK; diff 390 ≤ 400 (1.2b kept)

## Slice 2 — PR-B Drag & drop + column tests (REQ 25, 26) ~215 (~255 w/ e2e)

- [x] 2.1 RED `tests/component/kanban-desktop.test.tsx` (REQ-22/24/25/26): column/placeholder blocks (dot/label/counter/subtitle within `getAllByTestId('kanban-columna')`; dashed + `min-h-[120px]` + "Vacío" + subtitle; 2 empty + 2 populated → 4 columns intact) — green vs shipped PR-A impl, lock the contract; drag blocks RED: `fireEvent.dragStart` (dataTransfer setData spy) → `dragOver` (preventDefault spy) → `drop` `getData: () => 'b-1,b-2'` → `onMover(['b-1','b-2'], 'recarga')`; fallback empty-getData drop → `dragId` path; `dragEnd` → next empty-getData drop → no `onMover`; invalid (delivery→Recarga, with `<ToastHost />`) → no `onMover` + red toast; same-column drop → no-op no toast. Plus 1.2b blocks if trimmed. — DONE (RED: 5 drag failed/4 contract passed; GREEN: 9/9)
- [x] 2.2 GREEN drag wiring: `kanban-desktop.tsx` (+~45) — parent `dragId` state (D10), `onDragOver` preventDefault, drop guard = same-column early return + `getEstadosPermitidos(origen)` pre-guard → zero `mover` calls + `showToast('No se pudo mover. Reintentá.', 'error')` (D5, locked decision 3), drop resolves `getData('text/plain') || dragId` → `buscarGrupo` → `onMover(ids, destino)`, `dragEnd` clears `dragId`; `grupo-card-kanban.tsx` (+~20) — root `draggable`, `onDragStart` `setData('text/plain', ids.join(','))` + `effectAllowed='move'` + `onDragStart?.(idsStr)`, `onDragEnd?.()`. Accept: no drag <1024 (CSS-only — kanban branch hidden below `lg`); REQ-25 S2 undo = fase-3 `undo-flow.test.tsx` (reuses `mover` wholesale, zero new logic). — DONE (see TDD table; plus carried fix R4-001: `+N` moved OUTSIDE the truncate line into a shrink-0 span — narrow-container test added in grupo-card-kanban.test.tsx)
- [x] 2.3 e2e (DROPPABLE): RED `tests/e2e/cola-1024px.spec.ts` — viewport 1024, dev-mode cookie login (mirror `cola-375px.spec.ts`), `/dashboard` → `data-testid="cola-kanban"` visible (REQ-26). Drop if PR-B >400; component tests carry coverage. — KEPT (PR-B final diff ~340 ≤ 400, budget allows)
- [x] 2.4 Slice gate: `npm run test` + `npx tsc --noEmit` + `npm run build` + `git diff --stat` ≤400. — DONE: 34 files/352 tests green; tsc exit 0; build exit 0; diff ~340 ≤ 400; no-hex grep clean; lint 0 new problems (4 pre-existing errors on HEAD untouched)

## REQ → Task traceability

| REQ | Tasks |
|---|---|
| MOD REQ-COS-21 | 1.3, 1.5 |
| REQ-COS-22 | 1.3–1.5 (branch+impl), 2.1 (column contract) |
| REQ-COS-23 | 1.1–1.2 (+1.2b trim) |
| REQ-COS-24 | 1.4 (impl), 2.1 (contract) |
| REQ-COS-25 | 2.1–2.2; S2 undo = fase-3 3.4/3.5 (reused, zero new logic) |
| REQ-COS-26 | 1.1, 1.3, 2.1, 2.3 |

## Slice-coupling guard

- PR-A tests MUST NOT exercise drag (no `fireEvent` drag in 1.1/1.3); `kanban-desktop.tsx` ships without `draggable`/`dragId`/handlers.
- PR-B `kanban-desktop.test.tsx` locks PR-A column/placeholder contract (green vs shipped impl); drag blocks are the RED.
- `grupo-card.tsx` modified ONLY by +2 exports (D2) — no other hunks; fase-3 suite must stay green.
- e2e droppable; threat matrix N/A (no new boundary — pre-guard is a pure client mirror of `estados_permitidos`).