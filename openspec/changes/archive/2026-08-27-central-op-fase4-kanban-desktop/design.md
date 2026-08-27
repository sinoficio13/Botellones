# Design: Central de Operaciones — Fase 4: Kanban desktop (≥1024px)

## Technical Approach

Fix the tablet-breakpoint leak (`cola-operaciones.tsx:146` — `md:grid md:grid-cols-2` applies at every width ≥768px) with the CSS-only convention (fase-3 D9): tablet grid gains `lg:hidden`, new kanban branch `hidden lg:grid lg:grid-cols-4` renders `KanbanDesktop`. Two new components in `src/components/operaciones/`: `kanban-desktop.tsx` (4 columns from `ESTADOS_OPERATIVOS` + `--estado-*` dot headers + empty placeholders + native HTML5 drag) and `grupo-card-kanban.tsx` (compact whole-group card, `·`-codes +N, no chips). Drag reuses fase-3 `mover` wholesale (optimistic + Deshacer toast + error path). Verified deviation from proposal: `copiaAccion`/`useEdadAhora` are NOT exported from `grupo-card.tsx` — two additive `export` keywords required (D2). Zero new data logic, zero schema/RPC changes.

## Architecture Decisions

| # | Decision | Options | Tradeoff | Decision |
|---|---|---|---|---|
| D1 | Component names | proposal `kanban-columnas.tsx`/`grupo-card-desktop.tsx` vs orchestrator `kanban-desktop.tsx`/`grupo-card-kanban.tsx` | Orchestrator instruction binds; "kanban" names are precise (desktop is the only consumer today, but the card is kanban-shaped) | **`kanban-desktop.tsx` + `grupo-card-kanban.tsx`** — REQ-COS-26's test filenames are illustrative; verify maps scenarios to these files |
| D2 | Reuse of `copiaAccion`/`useEdadAhora` | (a) export both from `grupo-card.tsx` (+2 keywords); (b) duplicate in kanban card; (c) move to shared module | (a) DRY, zero behavior change, fase-3 suite stays green; (b) logic duplication (copy strings, SSR clock); (c) touches more imports | **(a)** — `grupo-card.tsx` is "modified" not "untouched": 2 additive exports, nothing else |
| D3 | Compact card vs `variante="kanban"` on GrupoCard | (a) new component; (b) variant prop | (a) GrupoCard's chips/selection state (`marcados`, `expandido`, `enVuelo`, "Elegí al menos un botellón") stays untouched — no conditional threads through mobile code, no mobile regression risk | **(a) new `grupo-card-kanban.tsx`** — proposal-locked |
| D4 | Drag payload | (a) `cliente_id` in dataTransfer; (b) comma-joined bottle ids | (a) AMBIGUOUS: same client can appear in 2 estados as 2 groups (fase-3 D12 partition-by-estado) — column lookup by cliente_id is wrong; (b) exact, UUIDs never contain commas, `split(',')` safe | **(b) comma-joined ids** in `dataTransfer` AND `dragId` fallback (old-kanban `d7ccb3b^` pattern) |
| D5 | Invalid drop | (a) call mover → RPC rejects → hook red toast; (b) client pre-guard via `getEstadosPermitidos` → zero mover calls + red toast | (a) zero new code but doomed optimistic flicker (group leaves then reverts) + wasted RPC; (b) ~6 lines, no new copy (generic toast, locked decision 3), satisfies REQ-COS-26's literal "zero `mover` calls", avoids flicker | **(b) pre-guard** — `getEstadosPermitidos(estadoOrigen)` (estados.ts, mirrors DB `estados_permitidos` invariant) + same-column drop early-return |
| D6 | Estado dot map | (a) export `ESTADO_TOKEN` from tabs-estados.tsx; (b) local `ESTADO_DOT` const | codebase convention (tabs-estados comment) is component-local presentation maps; (a) touches a 2nd fase-3 file for 6 lines | **(b) local `ESTADO_DOT: Record<EstadoOperativo, string>`** (`bg-estado-*`, Tailwind v4 `--color-estado-*` tokens) |
| D7 | Column a11y role | (a) `<section aria-label>` (implicit region); (b) `role="group"` + `aria-label` | CRITICAL: jsdom renders ALL breakpoint branches (no media queries) — `role="region"` would break the existing tablet test `getByRole('region', { name })` (multiple matches) | **(b) `role="group"`** + `data-testid="kanban-columna"` |
| D8 | Subtitles per estado | new `SUBTITULO_ESTADO` const vs reuse `VacioPorEstado` copy | `VacioPorEstado` copy is action-oriented (titles like "Nada esperando lavado"); headers need short state subtitles; REQ-COS-24 requires the SAME subtitle in header and placeholder | **local `SUBTITULO_ESTADO`** in kanban-desktop.tsx (recibido 'Esperando lavado' · recarga 'Llenando ahora' · listo 'Listos para salir' · delivery 'En camino al cliente') |
| D9 | Empty placeholder | EmptyState primitive inside dashed wrapper vs hand-rolled div | Locked decision 6 names EmptyState; its icon→title→description order fits "Vacío" + subtitle | **dashed wrapper + `<EmptyState title="Vacío" description={SUBTITULO_ESTADO[estado]} />`**, `min-h-[120px]` |
| D10 | dragId state location | kanban-desktop.tsx parent vs per-card | old-kanban pattern: state in parent, card gets `onDragStart`/`onDragEnd` callbacks (verified `d7ccb3b^`) | **parent-owned `dragId`** in kanban-desktop.tsx |
| D11 | Loading in kanban branch | skeleton per column vs nothing | REQ-COS-21 "loading is a skeleton, never a spinner" applies at all widths | **`cargando` prop → each column renders `<ListaSkeleton cantidad={1} />`** under its header |
| D12 | Codes overflow | truncate 6 + static "+N" text vs wrap | spec REQ-COS-23: "+N suffix", one line, no chips, no expansion on desktop | **`CODIGOS_VISIBLES = 6`, static `+{ocultos}` span** (not a button — no expander on desktop) |

## Data Flow

```
Drag & drop (REQ-COS-25):
Operador ──dragstart──► GrupoCardKanban: setData('text/plain', ids.join(',')) + effectAllowed='move'
                        onDragStart?.(idsStr) ──► KanbanDesktop: setDragId(idsStr)
Operador ──dragend───► GrupoCardKanban: onDragEnd?.() ──► KanbanDesktop: setDragId(null)
Operador ──drop(col)─► Columna onDrop: preventDefault
                        raw = dataTransfer.getData('text/plain') || dragId; if (!raw) return
                        ids = raw.split(','); buscarGrupo(ids) → { grupo, origen } (search porEstado)
                        origen === destino → return (no-op)
                        !getEstadosPermitidos(origen).includes(destino) → showToast('No se pudo mover. Reintentá.', error) → return
                        onMover(ids, destino) ──► useColaOperaciones.mover(ids, destino)
                          1. snapshot { estadoAnterior, rows }  2. optimistic removal
                          3. showToast('N botellones a {label}', Deshacer)
                          4. rpc('mover_botellones', { p_ids, p_estado })
                          5a. ok → apply RETURNED rows (group lands in destino, age now())
                          5b. err → revert snapshot + red toast 'No se pudo mover. Reintentá.' (no undo)
                        (undo = fase-3 deshacerMovimiento — unchanged, restores estado + original estado_desde)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/operaciones/cola-operaciones.tsx` | Modify | `:146` tablet grid `+ lg:hidden`; new branch `<div data-testid="cola-kanban" className="hidden gap-4 px-4 py-4 lg:grid lg:grid-cols-4">` rendering `<KanbanDesktop porEstado cargando onMover={mover} />`; mobile/tablet markup untouched |
| `src/components/operaciones/grupo-card.tsx` | Modify | +2 exports: `export function copiaAccion`, `export function useEdadAhora` (no behavior change) |
| `src/components/operaciones/grupo-card-kanban.tsx` | Create | Compact card: name + cédula mono ("—" null), age+urgency via `useEdadAhora`/`formatAntiguedad`/`nivelUrgencia` (`--urgencia-texto` text / `--urgencia` tint+▲), `·`-codes line + `+N` (no chips), whole-group `ActionButton` (`min-h-11` via cva, `copiaAccion(estado, grupo.botellones.length, primerNombre)`), WhatsApp inert (`disabled`+`opacity-40` sin teléfono; `onClick={onWhatsApp}` optional fase-5), `draggable`+drag handlers (PR-B) |
| `src/components/operaciones/kanban-desktop.tsx` | Create | 4 columns from `ESTADOS_OPERATIVOS`; `role="group"` column; sticky header (`sticky top-0 z-10 bg-surface-1`): 2px `ESTADO_DOT` dot, `ESTADO_LABELS` + counter (`porEstado[estado].length`), `SUBTITULO_ESTADO`; body = `ListaSkeleton` (cargando) / compact cards / dashed 120px "Vacío" placeholder; `dragId` state + guard + drop handlers (PR-B) |
| `tests/component/grupo-card-kanban.test.tsx` | Create | REQ-COS-23 contract (below) |
| `tests/component/kanban-desktop.test.tsx` | Create | REQ-COS-24/25/26 contract (below) |
| `tests/component/cola-operaciones.test.tsx` | Modify | +1 it: breakpoint classes on all 3 branches (375/768/1023 vs 1024/1440 semantics via class presence — jsdom cannot apply media queries, documented convention) |
| `tests/e2e/cola-1024px.spec.ts` | Create (optional) | mirror `cola-375px.spec.ts` at viewport 1024: `cola-kanban` visible; DROPPABLE (PR-B budget) |

## Interfaces / Contracts

```ts
// grupo-card.tsx (additive exports — PR-A)
export function copiaAccion(estado: EstadoOperativo, n: number, primerNombre: string): string;
export function useEdadAhora(): Date | null;   // SSR-safe: null clock server+first client render

// grupo-card-kanban.tsx  ('use client')
export type GrupoCardKanbanProps = {
  grupo: GrupoCola;
  estado: EstadoOperativo;
  enAccion?: boolean;                                   // disables ActionButton
  onAccion: (ids: string[]) => void | Promise<unknown>; // whole group: ids = botellones.map(b => b.id)
  onWhatsApp?: () => void;                              // fase-5 placeholder, currently inert
  onDragStart?: (idsStr: string) => void;               // PR-B: ids.join(',')
  onDragEnd?: () => void;                               // PR-B: clear dragId
};
// root: <article data-testid="grupo-card-kanban" draggable (PR-B)>; CODIGOS_VISIBLES = 6;
// codes line: codigos.slice(0,6).join(' · ') + <span>+{n-6}</span> when n>6 — STATIC text, no button.

// kanban-desktop.tsx  ('use client')
export type KanbanDesktopProps = {
  porEstado: PorEstado;                       // from useColaOperaciones (oldest-first FIFO)
  cargando: boolean;
  onMover: (ids: string[], destino: EstadoOperativo) => void | Promise<unknown>; // = mover
};
// internal: SUBTITULO_ESTADO, ESTADO_DOT: Record<EstadoOperativo, string>;
// dragId: useState<string | null>(null); drop guard uses getEstadosPermitidos (estados.ts).
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Component | `grupo-card-kanban.test.tsx` | name + mono cédula/"—"; `·`-codes 6 visible + static "+2" for 8, no chips (`aria-pressed` absent); per-estado copy ×4 (`→ Pasar N a …` / `✓ Entregar N a …`); whole-group ids passed to onAccion; ActionButton has `min-h-11`; urgency 10h→`text-urgencia-texto`, 30h→`bg-urgencia/7`+`▲` (waitFor real clock); SSR-safe `renderToString` (no critica/▲ in HTML); WhatsApp disabled+`opacity-40` sin teléfono / enabled-inert con teléfono; `enAccion` disables action |
| Component | `kanban-desktop.test.tsx` | 4 columns in order, dot/label/counter/subtitle (within `getAllByTestId('kanban-columna')`); placeholder dashed + `min-h-[120px]` + "Vacío" + subtitle; 2 empty + 2 populated → grid intact (4 columns render); `fireEvent.dragStart`(card, mock dataTransfer setData spy) → `dragOver`(column) preventDefault spy → `drop` with `getData: () => 'b-1,b-2'` → onMover called with (['b-1','b-2'], 'recarga'); fallback: drop with `getData: () => ''` after dragStart → onMover called (dragId path); `dragEnd` → subsequent empty-getData drop → onMover NOT called; invalid drop (delivery card → Recarga column, harness includes `<ToastHost />`) → onMover NOT called + red toast text; same-column drop → no onMover, no toast |
| Component | `cola-operaciones.test.tsx` | +breakpoint it: `cola-movil` has `md:hidden`, `cola-tablet` has `hidden`+`md:grid-cols-2`+`lg:hidden`, `cola-kanban` has `hidden`+`lg:grid`+`lg:grid-cols-4`; existing 375/768/1023 assertions stay green (no `role="region"` collision — D7) |
| E2E (optional) | `cola-1024px.spec.ts` | viewport 1024, login, `/dashboard` → `cola-kanban` visible; droppable |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The RPC role guard is a data-layer authorization boundary already covered by REQ-COS-4/19 tests; this change adds no new boundary (the drop pre-guard is a pure client mirror of `estados_permitidos`, invariant-tested in fase-1/2).

## Migration / Rollout

No migration, no feature flags, no new packages. PR-A rollback: revert the class change + delete 2 unreferenced components (zero risk). PR-B rollback: revert drag handlers (cards fully operable via ActionButton). Realtime stays fase 5 — same accepted staleness as fase 3 (own actions reconcile via RPC returned rows).

## Chained-PR Slice Plan (each ≤400 changed lines)

| Slice | Files (exact) | Est. lines | REQs |
|---|---|---|---|
| PR-A Desktop frame + compact card | `cola-operaciones.tsx` (+28: lg:hidden + kanban branch); `grupo-card.tsx` (+2 exports); `grupo-card-kanban.tsx` (new ~125); `kanban-desktop.tsx` (new ~112, NO drag); `grupo-card-kanban.test.tsx` (new ~110); `cola-operaciones.test.tsx` (+22 breakpoint it) | ~399 ⚠ borderline | MOD 21, 22, 23, 24 |
| PR-B Drag & drop + column tests | `kanban-desktop.tsx` (+~45: dragId state, guard, dragover/drop/dragend); `grupo-card-kanban.tsx` (+~20: draggable, dragstart/dragend); `kanban-desktop.test.tsx` (new ~150); `tests/e2e/cola-1024px.spec.ts` (new ~40, **droppable**) | ~215 (~255 w/ e2e) | 25, 26 |

PR-A borderline: if actual >400, move 1–2 card-test blocks (~25 lines, e.g. SSR-safe + WhatsApp) to PR-B. PR-B safe even with e2e.

## Verification Matrix

| REQ | Design element | Verify |
|---|---|---|
| MOD 21 | `lg:hidden` on tablet grid + kanban branch, mobile/tablet untouched | breakpoint it + existing suite green |
| 22 | kanban branch classes, 4 columns dot/label/counter/subtitle, FIFO `porEstado` | kanban-desktop test + breakpoint it |
| 23 | compact card: `·`-codes +N, whole-group action ≥44px, urgencia-texto/urgencia, WhatsApp inert, no hex | grupo-card-kanban test (grep no-hex) |
| 24 | dashed 120px "Vacío" + subtitle, grid intact | kanban-desktop test |
| 25 | draggable, dataTransfer+dragId, dragend cleanup, mover all ids, invalid→zero-write+red toast, no drag <1024 (CSS-only) | kanban-desktop drag tests + hook error path (existing) |
| 26 | both test files + fireEvent drag events + breakpoint assertions (+optional e2e) | suite green; e2e droppable |

## Open Questions

- [ ] Include `cola-1024px.spec.ts`? Decide at sdd-tasks: include only if PR-B stays ≤400 (component tests carry the coverage).
- [ ] Drag-over column highlight (visual feedback) — intentionally out of scope; candidate for fase-5 polish alongside realtime.