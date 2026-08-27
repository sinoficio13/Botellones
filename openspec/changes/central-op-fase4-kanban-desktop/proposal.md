# Proposal: Central de Operaciones — Fase 4: Vista desktop (kanban agrupado)

## Intent

EPIC-15 fase 4 fixes a **user-reported defect**: on desktop (≥1024px) `/dashboard` renders the TABLET layout — a 2-col grid of large touch cards with 44px buttons and chips. The tablet breakpoint `md:grid md:grid-cols-2` at `src/components/operaciones/cola-operaciones.tsx:146` applies at ALL widths ≥768px, so PC shows "todo muy grande". FASE-3 deliberately deferred desktop to this fase. This change delivers the spec §6.3 desktop kanban for ≥1024px ONLY: 4 estado columns (Recibido/Recarga/Listo/Delivery) of the SAME client-grouped FIFO data, compact whole-group cards, native HTML5 drag & drop reusing the fase-3 `mover` + toast undo, and empty-column placeholders. Mobile/tablet stay exactly as fase 3 (beyond the breakpoint fix).

## Scope

### In Scope
- **Breakpoint fix**: `cola-operaciones.tsx` tablet grid becomes `md:grid md:grid-cols-2 lg:hidden`; new kanban branch `hidden lg:grid lg:grid-cols-4` (≥1024px).
- **Kanban 4 columns (HIST-15.4.1)**: per-estado column with color-estado dot + counter + subtitle (existing per-estado meta), sticky-ish column headers. Same data: `porEstado` from `useColaOperaciones` (FIFO preserved).
- **Compact group card (desktop variant of GrupoCard)**: client name + cédula (mono, muted), age + urgency (same 2-level rules — amber TEXT uses `--urgencia-texto`, tint/`▲` uses `--urgencia`, R4-001), **codes on ONE line separated by `·` (NOT chips)**, ActionButton compact but still ≥44px (`min-h-11`) acting on the WHOLE group (no chip selection on desktop — partial selection is the client ficha/fase 5), per-estado copy reusing `DESTINO_ACCION`/`copiaAccion` exports, WhatsApp icon target present (inert, fase-5 placeholder).
- **Empty column placeholder (spec §8.4)**: dashed border, min-height 120px, "Vacío" + estado subtitle.
- **Native drag & drop (HIST-15.4.2)**: HTML5 pattern from the old kanban (git `d7ccb3b^`): group card `draggable`, `dragstart` sets `dataTransfer` + `dragId` fallback state, column `dragover preventDefault` + `drop` → `mover(todosLosIds, estadoDestino)` (reuse fase-3 hook mover → optimistic + toast undo + error path). Invalid drop → zero writes + red toast (RPC machine guard). Only ≥1024px.
- **Tests**: component tests for compact card + kanban columns + drag handlers (fire HTML5 drag events via `fireEvent`); component-level 1024px layout assertions; optional e2e `cola-1024px.spec.ts` mirroring `cola-375px.spec.ts`.

### Out of Scope
- Realtime (fase 5), WhatsApp sheet (fase 5), client ficha sheet (fase 5) — WhatsApp target renders inert.
- Partial/selection-based action on desktop; chips on desktop (mobile-only); drag on mobile/tablet (spec §9).
- "Entregado" column (drag moves within the 4 column estados only; Entregar stays button-only via `DESTINO_ACCION`).
- New schema, migration, realtime, new packages (`@dnd-kit` rejected — native HTML5).
- Mobile/tablet rendering changes beyond the breakpoint fix; KPI/"Necesita tu atención"/"En circulación" (spec §9).

## Business Rules (locked)

1. Desktop = ≥1024px ONLY; <1024px renders fase-3 mobile (tabs) / tablet (2-col sections) byte-for-byte unchanged.
2. Group card acts on the WHOLE group; no chip selection on desktop (partial selection lives in the client ficha/fase 5).
3. Codes render inline, `·`-separated, one line; NOT chips.
4. Drag moves ALL bottles of the group via `mover_botellones` (batch, transactional). Entregar = button-only, never via drag (no Entregado column).
5. Undo (toast "Deshacer") restores estado AND original `estado_desde` (fase-3 R1-001, `p_restaurar`).
6. Invalid drop → zero writes + red toast "No se pudo mover. Reintentá." (RPC machine guard; same path as fase-3 failure).
7. Urgency text = `--urgencia-texto`; tint/icon = `--urgencia` (R4-001). Tokens only, no hex. UI copy Spanish.
8. FIFO preserved: same `porEstado` groups (oldest first, group age = `min(estado_desde)`).

## User Stories / Scenarios

- **Operador de escritorio**: opens `/dashboard` on a PC and sees 4 columns at a glance — Recibido/Recarga/Listo/Delivery — each with its estado dot, group counter and subtitle, oldest client first.
- **Avance por arrastre**: drags a client's group card from Recibido to Recarga → ALL bottles move instantly, toast "Deshacer" appears; wrong column → taps Deshacer → bottles return with their original age.
- **Salto inválido**: drops a Delivery group onto Recarga → nothing is written, red toast explains the move failed; no data corruption.
- **Cola vacía por columna**: an empty column keeps the grid intact with a dashed "Vacío" placeholder — no layout jump.
- **Urgencia compacta**: bottles >24h show `▲` + amber tint; 6–24h show amber text (`--urgencia-texto`) — visible without opening the card.

## Capabilities

### New Capabilities
None — extend the existing `central-operaciones-schema` capability (one capability per change, matching fase-1/2/3).

### Modified Capabilities
- `central-operaciones-schema` (delta): **ADDED** REQ-COS-22 (kanban desktop layout: ≥1024px 4-col grid, tablet grid hidden ≥1024, column header dot+counter+subtitle), REQ-COS-23 (compact desktop group card: `·`-codes, whole-group action ≥44px, urgencia-texto, WhatsApp inert), REQ-COS-24 (empty column placeholder: dashed border, min-height 120px, "Vacío" + estado subtitle), REQ-COS-25 (native drag & drop: group drag → `mover` all ids, invalid drop zero-write + error toast, ≥1024 only), REQ-COS-26 (desktop test contract: compact card + kanban columns + drag handlers via HTML5 drag events + 1024px layout). **MODIFIED** REQ-COS-21: added scenario "Tablet grid hidden at ≥1024px" (the leak fix) — full block replaced with preserved existing scenarios.

## Approach

CSS-only breakpoint fix + two new components in `src/components/operaciones/`:

- `cola-operaciones.tsx`: tablet grid gains `lg:hidden`; new `data-testid="cola-kanban"` branch `hidden lg:grid lg:grid-cols-4` rendering `KanbanColumnas` with the same `porEstado`/`mover`/`cargando` from the hook. BarraContexto/Buscador stay shared above both layouts. No JS breakpoint (matches fase-3 D9).
- `kanban-columnas.tsx` (NEW): 4 columns; sticky-ish header = estado dot (2px `--estado-*`), `ESTADO_LABELS`, group counter, subtitle (per-estado meta); body = compact cards or empty placeholder. Column handlers `onDragOver={preventDefault}` / `onDrop` read `dataTransfer.getData('text/plain') || dragId` → `mover(grupo.ids, estado)`.
- `grupo-card-desktop.tsx` (NEW): compact card reusing exported `DESTINO_ACCION`/`copiaAccion` from `grupo-card.tsx` (file untouched), `formatAntiguedad`/`nivelUrgencia` from `cola.ts`, `ActionButton` (≥44px, whole group), `draggable` + `dragstart` setData/dragId.
- Drag reuses the fase-3 `mover(ids, destino)` wholesale: optimistic removal, toast undo, revert on error — zero new data logic. Invalid transitions are rejected by the RPC guard (zero writes) and surface via the existing red-toast path; optional client-side pre-guard via `getEstadosPermitidos` for a specific drop message (question 1).
- Codes overflow: truncate with `+N` hint (question 3), mirroring the fase-3 `+N` chip pattern.

## Approach Comparison

| Decision | Chosen | Why |
|---|---|---|
| Breakpoint | CSS classes (`md:grid lg:hidden` + `hidden lg:grid lg:grid-cols-4`) | Matches fase-3 D9 CSS-only convention; no JS breakpoint |
| Drag library | Native HTML5 (no `@dnd-kit`) | Spec §6.3; old kanban pattern in git `d7ccb3b^`; zero deps |
| Group action | Whole-group `mover(ids, destino)` reuse | Same RPC/hook as fase 3 → optimistic + undo + error paths free |
| Compact card | New `grupo-card-desktop.tsx` reusing exports | GrupoCard carries chips/selection state — a variant keeps desktop free of chip logic |
| Invalid drop | RPC machine guard (zero-write) + red toast | Already-built failure path; optional client pre-guard for copy |
| Codes overflow | `·` line + `+N` truncation | Mirrors fase-3 `+N` chip expansion; avoids line-wrap chaos |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/components/operaciones/cola-operaciones.tsx` | Modified | Tablet grid `lg:hidden` (line ~146) + new `hidden lg:grid lg:grid-cols-4` kanban branch |
| `src/components/operaciones/kanban-columnas.tsx` | New | 4 columns: dot/counter/subtitle header, compact cards, empty placeholders, drag handlers |
| `src/components/operaciones/grupo-card-desktop.tsx` | New | Compact card: name+cédula mono, age+urgency, `·`-codes +N, whole-group ActionButton, WhatsApp inert |
| `src/components/operaciones/grupo-card.tsx` | Untouched | Exports `DESTINO_ACCION`/`copiaAccion` reused (already exported) |
| `src/hooks/useColaOperaciones.ts`, `src/lib/utils/cola.ts`, `estados.ts` | Untouched | `mover`/undo, urgency/age helpers, machine — all reused |
| `tests/component/grupo-card-desktop.test.tsx` | New | Compact card contract (codes line, +N, whole-group action, urgencia-texto, ≥44px) |
| `tests/component/kanban-columnas.test.tsx` | New | Columns, empty placeholder, drag events (`fireEvent.dragStart`/`dragOver`/`drop`), invalid-drop toast |
| `tests/e2e/cola-1024px.spec.ts` | New (optional) | Viewport 1024 kanban render; mirrors `cola-375px.spec.ts` harness |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Breakpoint leak regression (tablet grid or kanban showing at wrong widths) | Med | Exact class fix (`md:grid lg:hidden` + `hidden lg:grid`); component test asserts classes; existing `cola-operaciones.test.tsx` must stay green |
| HTML5 drag quirks (Firefox empty `getData`, ghost image, dragend cleanup) | Med | `dragId` fallback state (old kanban pattern); `dragover preventDefault` only on columns; `fireEvent` drag tests; `dragend` cleanup |
| Touchscreens at desktop widths don't fire HTML5 drag | Low-Med | Cards remain fully operable via ActionButton (drag is a convenience, not the only path) |
| RPC rejects non-adjacent drops → red toast on a "legitimate-feeling" drop | Low | Expected per machine; question 1 decides specific client-side copy |
| Lines budget: PR-B borderline with e2e | Med | e2e marked droppable; component tests are the guaranteed coverage |
| Mobile/tablet regression from touching shared shell | Med | Only `lg:` classes added; existing mobile/tablet tests + visual pass at 375/768/1023 |
| No realtime until fase 5 (stale desktop columns) | Warning | Documented; same regression already accepted in fase 3; `router.refresh()` after own action |

## Non-goals / Constraints

- No realtime, no WhatsApp sheet, no ficha sheet (fase 5); WhatsApp target inert.
- No chip selection on desktop; no drag <1024px; no Entregado column; Entregar button-only.
- No DB schema/migration/RPC changes; no new packages; no `@dnd-kit`; no `sonner`.
- Do NOT modify shadcn `src/components/ui/*`; tokens additive-only; no hardcoded hex.

## Rollback Plan

- **PR-A (breakpoint + columns + card)**: revert `cola-operaciones.tsx` classes → desktop falls back to the fase-3 tablet grid (pre-fase-4 state); deleting the two new components is zero-risk (unreferenced after class revert). No DB impact.
- **PR-B (drag + tests)**: revert drag handlers → cards fully operable via ActionButton; tests revert with the slice.
- No schema/migration in this change → no DB rollback path needed.

## Dependencies

- Fase-1 (archived): `mover_botellones` (+ `p_restaurar` undo), `estado_desde`, `agrupar()` — REQ-COS-1..7.
- Fase-2 (archived): tokens incl. `--urgencia-texto` (R4-001) + ActionButton — REQ-COS-8..15.
- Fase-3 (landed on `redesign/central-operaciones`): `useColaOperaciones` (`porEstado`, `mover`/undo, `totales`), `GrupoCard` exports (`DESTINO_ACCION`, `copiaAccion`), `cola.ts` helpers, `ESTADOS_OPERATIVOS`, ToastHost — REQ-COS-16..21 in tree.
- Old kanban native drag pattern: git `d7ccb3b^` (`operaciones-dashboard.tsx`) — pattern reference only.
- Delivery: ask-always; chained PRs (below).

## Proposal question round

Assumptions needing sign-off (locked orchestrator decisions respected):

1. **Invalid-drop copy**: dropping a group on a non-adjacent column (e.g., Delivery → Recarga) is rejected by the RPC with zero writes. Options: (a) reuse the generic red toast "No se pudo mover. Reintentá." (zero new code — recommended), or (b) client-side pre-guard via `getEstadosPermitidos` with a specific copy like "Ese salto no está permitido" (small extra code, avoids a doomed RPC round-trip).
2. **Drag never delivers (LOCKED)**: the kanban has no Entregado column; dropping on Delivery only moves to `delivery`. "✓ Entregar N a {PrimerNombre}" remains button-only. Confirmed — no drag-to-deliver.
3. **Codes overflow**: a client with >6 bottles would overflow a single `·`-line. Recommended: truncate + `+N` hint (mirrors fase-3 `+N` chips). Alternative: wrap to a second line.
4. **WhatsApp target on desktop**: present and inert (fase-5 placeholder), consistent with mobile behavior (disabled at 40% opacity when the client has no phone). Confirmed — no hidden icon.

## Chained-PR slice plan (each ≤400 changed lines)

| Slice | Content | Est. lines |
|---|---|---|
| PR-A Desktop frame + compact card | `cola-operaciones.tsx` breakpoint fix (`md:grid lg:hidden` + `hidden lg:grid lg:grid-cols-4` kanban branch), `kanban-columnas.tsx` (4 columns, dot/counter/subtitle headers, empty placeholders dashed 120px "Vacío"), `grupo-card-desktop.tsx` (compact card, `·`-codes +N, whole-group ActionButton, urgencia-texto, WhatsApp inert) | ~345 |
| PR-B Drag & drop + tests | drag wiring (`draggable`, dragstart setData + `dragId` fallback, column dragover/drop → `mover(grupo.ids, destino)`), `grupo-card-desktop.test.tsx`, `kanban-columnas.test.tsx` (columns + placeholder + `fireEvent` drag + invalid-drop toast), optional `tests/e2e/cola-1024px.spec.ts` (~40, **droppable** to stay ≤400) | ~330 (370 with e2e) |

Both slices ≤400; PR-B flagged borderline only if the e2e spec is included — drop it if needed (component tests carry the coverage).

## Success Criteria

- [ ] ≥1024px renders the 4-col kanban (`data-testid="cola-kanban"`); 768–1023 unchanged tablet 2-col grid; <768 unchanged mobile — verified at 375/768/1023/1024/1440
- [ ] Column headers: estado dot (2px `--estado-*`), label, group counter, subtitle; sticky-ish; same `porEstado` FIFO data (oldest first)
- [ ] Compact card: name + cédula mono; codes on one `·`-line with `+N` overflow; whole-group ActionButton ≥44px with per-estado copy; WhatsApp inert target; amber urgency text = `--urgencia-texto`, tint/`▲` = `--urgencia`
- [ ] Empty column: dashed border, min-height 120px, "Vacío" + estado subtitle; grid intact
- [ ] Drag group card → column moves ALL bottles (batch RPC, optimistic + toast Deshacer; undo restores estado + original `estado_desde`); invalid drop → zero writes + red toast; no drag <1024px
- [ ] Tests: compact card + kanban columns + drag handlers (`fireEvent` HTML5 drag events) green; 1024px layout asserted in component tests; optional e2e `cola-1024px.spec.ts` green
- [ ] Existing fase-3 suite untouched and green (`npm run test`), `tsc --noEmit`, `npm run build`; no hardcoded hex in new components (grep); each PR ≤400 changed lines
