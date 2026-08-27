# Proposal: Central de Operaciones — Fase 5: Realtime + WhatsApp + Ficha cliente (FINAL del EPIC-15)

## Intent

Fase 5 (última del EPIC-15) makes the queue **multi-device-safe and client-communicating**. Without it the cola is stale (static fetch on mount, no cross-device updates) and the two touch targets that fase-3/4 deliberately left **inert** — the WhatsApp icon and the client name/cédula block — do nothing. This change delivers: (1) `postgres_changes` realtime on `botellones` that **never reorders under the finger** — if the user is scrolling or the change would reorder the visible list, the change is queued behind a floating chip ("↑ N botellones nuevos", tap applies), while tab counters always update live and new cards animate with a 1.2s `--marca` outline; (2) a WhatsApp **bottom sheet** with per-estado pre-loaded message (spec §7.3 copy), editable, `wa.me` deep link; (3) a client **ficha bottom sheet** (nombre/cédula/dirección + 3 actions + full bottle list across ALL estados incl. entregado). Realtime also folds in carried regressions: stale totals after delivery, frozen urgency clock (cards re-render on realtime), and the transport catch path. No new schema — publication 0010 already exposes `botellones`.

## Scope

### In Scope
- **Realtime cola + chip flotante (HIST-15.5.1 / §7.5)**: `channel('cola-realtime').on('postgres_changes', { event:'*', schema:'public', table:'botellones' })` via the existing browser client. Scroll state (`scrolleando` + scroll listener on the main list container) + reorder-detection gate: if scrolling OR the change reorders the visible list → queue + floating chip under the tabs; else apply directly. Tab counters ALWAYS live (no chip wait). New-card entry animation: `outline: 2px solid` `--marca` 1.2s → fade; no slide.
- **Sheet WhatsApp (HIST-15.5.2 / §7.3)**: tap WhatsApp icon → bottom sheet, message pre-loaded per CURRENT tab/estado via spec's `mensajeWhatsApp`, editable, note "Tocá para editar antes de enviar", green button `--whatsapp` (#1A9150) "Abrir WhatsApp" → `https://wa.me/<digitos>?text=<encode>` (new tab), Cancelar. No phone → disabled icon (opacity 40%) + toast "Este cliente no tiene teléfono cargado". Wire the currently-inert WhatsApp targets in `GrupoCard` + `GrupoCardKanban`.
- **Ficha cliente (HIST-15.5.3 / §7.4)**: tap name+cédula block → bottom sheet: nombre, cédula (mono), dirección (join `direcciones`), 3 actions (WhatsApp → same sheet or direct; Llamar → `tel:`; Ficha → `/clientes/[id]`), "Sus botellones (N)" list of ALL estados incl. entregado with per-estado badge + age. Focus trap + Escape close (Sheet primitive provides both). New server helper `getBotellonesCliente(clienteId)` (all estados + age + estado labels). Wire the name/chevron targets in both cards.
- **Tests**: component tests for realtime queue/chip, WhatsApp sheet (per-estado message, no-phone toast), ficha sheet (all-estados list, focus/Escape), server helper.

### Out of Scope
- New schema/migration/realtime publication (0010 already includes `botellones`). No polling.
- Envío automático de WhatsApp; cédula obligatoria; drag en móvil/tablet; tercer nivel de urgencia; KPI/Necesita tu atención/En circulación (spec §9).
- Auto-reorder during scroll (explicitly NOT — the chip gate is the whole point).
- Refactor of `mover` to server actions (KI-001 root fix) — flagged as dependency/risk, deferred.
- No new packages; do not modify shadcn `src/components/ui/*`; tokens only, no hex.

## Business Rules (locked)

1. Realtime = `postgres_changes` on `botellones` (publication 0010, already member). No polling.
2. A realtime change applies DIRECTLY unless the user is scrolling OR the change would reorder the visible list; then it is queued behind the chip ("↑ N botellones nuevos"). Tab counters ALWAYS update live regardless.
3. New cards animate `outline: 2px solid --marca` for 1.2s then fade — NO slide, NO reorder under the finger.
4. WhatsApp message = spec §7.3 `mensajeWhatsApp` per CURRENT tab/estado; editable before send; deep link `wa.me` + encoded text, new tab. No phone → icon disabled (opacity 40%) + toast.
5. Ficha "Sus botellones" lists ALL estados incl. `entregado`, per-estado badge + age; address = join of `direcciones`; actions: WhatsApp / `tel:` Llamar / `/clientes/[id]` Ficha.
6. UI copy Spanish; tokens only; no hex; no new deps; `src/components/ui/*` untouched.

## User Stories / Scenarios

- **Operador móvil scrolleando**: another device moves a bottle; the list does NOT jump — a chip "↑ N botellones nuevos" appears under the tabs; tapping it applies the queued changes; tab counters were live all along.
- **Reordenamiento fuera de vista**: a change that would reorder the active (visible) list is queued behind the chip; a change to a non-visible estado applies immediately + tab counter bumps.
- **Card nueva**: a bottle newly in the current estado animates in with a 1.2s `--marca` outline that fades — no slide, no layout jump.
- **WhatsApp**: operator taps the WhatsApp icon → sheet pre-filled per estado; edits; "Abrir WhatsApp" opens `wa.me` with encoded text in a new tab. Client with no phone → icon dimmed, toast explains.
- **Ficha**: operator taps name+cédula → sheet shows client data + full bottle list (all estados, incl. entregado, with badges + age); Llamar dials `tel:`, Ficha goes to `/clientes/[id]`; Escape/focus-trap behaves.

## Capabilities

> CONTRACT with sdd-spec. One capability per change (matches fase-1..4). Continue REQ-COS numbering at **27+**.

### New Capabilities
None — extend the existing `central-operaciones-schema` capability.

### Modified Capabilities
- `central-operaciones-schema` (delta): **ADDED** REQ-COS-27 (realtime cola + chip flotante: `postgres_changes` subscription, scroll/reorder gate → queue + floating chip under tabs, tab counters always live, new-card outline 1.2s no-slide), REQ-COS-28 (WhatsApp bottom sheet: per-estado `mensajeWhatsApp` editable + `wa.me` deep link + no-phone disabled/toast + wired targets in both cards), REQ-COS-29 (ficha cliente bottom sheet: nombre/cédula/dirección + 3 actions + "Sus botellones" ALL estados incl. entregado + focus trap/Escape + `getBotellonesCliente` helper), REQ-COS-30 (fase-5 test contract: realtime queue/chip + WhatsApp sheet + ficha sheet + helper component tests). **MODIFIED** REQ-COS-18/REQ-COS-23 (WhatsApp + name targets leave inert placeholder and become wired) and REQ-COS-17 (tab counters become live — realtime). Full blocks replaced preserving existing scenarios.

## Approach

All client-side, reusing existing primitives and the fase-3 hook:

- **Realtime**: new `useRealtimeCola()` in `src/hooks/` subscribing via the repo's existing browser-client pattern (`channel()` + `postgres_changes` + `removeChannel`, as in `estado-en-vivo.tsx`/`alert-panel.tsx`). It maps UPDATE/INSERT/DELETE rows to the same `ColaBotellon[]` shape and feeds a reducer in `useColaOperaciones` (or a sibling `useRealtime` consumed by the shell). Scroll state + reorder check live in `cola-operaciones.tsx`; a floating chip component under `TabsEstados` renders the queued count; tap applies. New-card outline via a temporary `data-entrada` class / inline state that clears after 1.2s.
- **Sheets**: reuse `src/components/ui/sheet.tsx` (`side="bottom"`; base-ui Dialog gives focus trap + Escape for free). `sheet-whatsapp.tsx` (new) holds the editable message + `mensajeWhatsApp` switch + `wa.me` build (reusing `normalizeWhatsAppPhone`). `ficha-cliente.tsx` (new) renders client data + actions + the all-estados bottle list from `getBotellonesCliente`.
- **Wiring**: `grupo-card.tsx` (currently-inert name button + WhatsApp button) and `grupo-card-kanban.tsx` (`onWhatsApp` prop already exists; name `<span>` becomes a target) gain `onAbrirFicha`/`onWhatsApp` handlers hoisted to the shell; `kanban-desktop.tsx` passes them through. No-phone toast reuses `showToast`.
- **Server helper**: `getBotellonesCliente(clienteId)` in `src/lib/db/botellones.ts` returns ALL botellones (any estado incl. `entregado`) + `estado_desde` + join clientes/direcciones; edad computed client-side with `formatAntiguedad`.

## Approach Comparison

| Decision | Chosen | Why |
|---|---|---|
| Realtime transport | `postgres_changes` (publication 0010) | Spec-locked; no migration, no polling |
| Sheet | Reuse `ui/sheet.tsx` `side="bottom"` | base-ui Dialog = focus trap + Escape built-in; no new component/deps |
| Queue gate | `scrolleando` + reorder-detection | Matches §7.5: never reorder under the finger |
| New-card entry | 1.2s `--marca` outline → fade | Spec §7.5; no slide, no layout jump |
| All-estados list | Server helper `getBotellonesCliente` | Single source; edad computed client-side; join direcciones |
| Realtime state | Reducer in/reuse of `useColaOperaciones` | Keeps FIFO grouping/urgency path identical |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/hooks/useColaOperaciones.ts` | Modified | Realtime subscription + queued-change reducer feeding `porEstado`/`totales`; tab counters live |
| `src/hooks/useRealtimeCola.ts` | New | `postgres_changes` subscription + row→state mapping (repo client pattern) |
| `src/components/operaciones/cola-operaciones.tsx` | Modified | Scroll listener, reorder gate, chip under tabs, wire ficha/WhatsApp handlers |
| `src/components/operaciones/chip-realtime.tsx` | New | Floating chip "↑ N botellones nuevos", tap applies |
| `src/components/operaciones/sheet-whatsapp.tsx` | New | Bottom sheet, `mensajeWhatsApp`, editable, `wa.me` + encode, Cancelar |
| `src/components/operaciones/ficha-cliente.tsx` | New | Client data + 3 actions + all-estados bottle list (badge + age) |
| `src/components/operaciones/grupo-card.tsx` | Modified | Wire name → `onAbrirFicha`, WhatsApp → `onWhatsApp` (inert → active) |
| `src/components/operaciones/grupo-card-kanban.tsx` | Modified | Wire WhatsApp (`onWhatsApp` exists); name `<span>` → ficha target |
| `src/components/operaciones/kanban-desktop.tsx` | Modified | Pass ficha/WhatsApp handlers through to cards |
| `src/lib/db/botellones.ts` | Modified | Add `getBotellonesCliente(clienteId)` (all estados + age) |
| `src/lib/utils/whatsapp.ts` | Modified (or leaf util) | `wa.me` deep-link builder + `encodeURIComponent` text |
| `tests/component/*` | New/Modified | realtime queue/chip, sheet-whatsapp, ficha-cliente, helper tests |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| KI-001: browser-client RPC/writes fail in dev (no real JWT) — realtime reads share this path | Med | Realtime is read-only (OK without JWT for public publication); mover/deshacer already use the browser client (existing KI-001). Log as dependency; do NOT expand browser-write scope in this change. |
| Realtime storms re-rendering the whole queue | Med | Gate/queue + per-visible-list reorder check; only touched tabs re-render; counters cheap |
| Scroll detection edge cases (chip shown during inertial scroll) | Low-Med | `scrolleando` listener + debounce; queued (never dropped) — user taps to apply |
| Deep-link encoding (spaces/accents in Spanish copy) | Low | `encodeURIComponent` on the message; component test asserts encoded `?text=` |
| Focus trap/Escape already handled by base-ui Dialog | Low | No custom code; test asserts Escape closes |
| Lines budget: 3 slices, each ≤400 | Med | Chained PR slices (below); sheets/ficha are self-contained components |
| No realtime publication if 0010 not applied to target env | Low | 0010 is archived/landed; verify advisor + no migration added here |

## Rollback Plan

- **PR-A (realtime queue + chip)**: remove the realtime subscription/chip → queue returns to static fase-3/4 fetch (pre-fase-5). No DB impact.
- **PR-B (WhatsApp sheet)**: unwire `onWhatsApp` → icons return to inert placeholder (fase-4 state). Delete `sheet-whatsapp.tsx` (unreferenced).
- **PR-C (ficha + wiring + carried fixes)**: unwire name/ficha handlers → name target returns to inert; delete `ficha-cliente.tsx`; drop `getBotellonesCliente`.
- No schema/migration in this change → no DB rollback path needed.

## Dependencies

- Fase-1 (archived): `botellones` in publication 0010 (realtime ready), `mover_botellones`+`p_restaurar`, `estado_desde`, `agrupar()` — REQ-COS-1..7.
- Fase-2 (archived): tokens incl. `--marca`, `--whatsapp`, `--estado-*`; primitives incl. `showToast` — REQ-COS-8..15.
- Fase-3 (landed): `useColaOperaciones` (`porEstado`, `totales`, `mover`/undo), `GrupoCard` (inert name/WhatsApp targets), `TabsEstados` (counters), `cola.ts` helpers, `formatAntiguedad` — REQ-COS-16..21.
- Fase-4 (landed): `GrupoCardKanban` (`onWhatsApp` prop), `KanbanDesktop` — REQ-COS-22..26.
- `supabase-js` browser client (`src/lib/supabase/client.ts`); existing `channel()`/`postgres_changes` pattern (`estado-en-vivo.tsx`, `alert-panel.tsx`).
- `src/components/ui/sheet.tsx` (base-ui Dialog, `side="bottom"`).
- KI-001: `mover`/`deshacer` still browser-client; dev-mode write failure remains a known issue (not fixed here).
- Delivery: ask-always, chained feature-branch chain (PR-A→B→C on `redesign/central-operaciones`).

## Proposal question round

Assumptions needing sign-off (locked orchestrator decisions respected; copy per §7.3 is a spec-phase input):

1. **`mensajeWhatsApp` exact copy** (§7.3): the spec defines per-estado Spanish copy but the literal text is not in the repo. Drafted in spec phase; assumed to reference the client name + bottle count + estado (e.g., "Hola {nombre}, tus {N} botellones están {ESTADO_LABELS[estado]}"). Confirm exact wording in sdd-spec.
2. **Ficha WhatsApp action**: opens the SAME WhatsApp sheet (pre-filled for the client) rather than an independent direct link — keeps one editable-message path. Recommend shared sheet.
3. **Chip placement**: sticky directly under `TabsEstados` (mobile) — confirmed per §7.5; tablet/desktop show the chip too (single floating component, top of the queue area).
4. **Carried fixes folded in**: S2 test honesty (undo restores pre-undo stamp), transport catch rethrow, cédula prefix note, `dragId` clear in drop handler, +N/e2e fixes — decide which ride into PR-C vs. a follow-up list. Recommend the four realtime-driven fixes (stale totals, frozen clock, transport catch, re-render) ride in PR-A/C; test-honesty and dragId-clear as small add-ons in PR-C if ≤400 lines, else follow-up.
5. **Realtime update semantics for moved/entregado bottles**: a bottle that moves out of the current estado disappears via realtime (matches optimistic behavior); a bottle entering `entregado` leaves the queue → counters update, no ghost rows.

## Chained-PR slice plan (each ≤400 changed lines)

| Slice | Content | Est. lines |
|---|---|---|
| PR-A Realtime queue + chip | `useRealtimeCola.ts` (subscription + row→state), `chip-realtime.tsx`, `cola-operaciones.tsx` scroll listener + reorder gate + chip under tabs + live counters, new-card outline animation | ~350 |
| PR-B WhatsApp sheet | `sheet-whatsapp.tsx` (mensajeWhatsApp switch, editable, `wa.me`+encode, Cancelar), wire WhatsApp in `GrupoCard` + `GrupoCardKanban`/`KanbanDesktop`, no-phone disabled/toast, `sheet-whatsapp.test.tsx` | ~340 |
| PR-C Ficha cliente + wiring + carried fixes | `getBotellonesCliente` helper, `ficha-cliente.tsx` (data + 3 actions + all-estados list + focus/Escape), wire name/chevron targets in both cards, carried fixes (S2 honesty, transport catch, dragId clear, +N/e2e) + tests | ~380 |

All slices ≤400. PR-C is the widest (three targets + carried fixes); if it exceeds 400, split carried fixes into a small PR-D follow-up. Component tests carry coverage; optional e2e for the realtime chip droppable.

## Success Criteria

- [ ] `postgres_changes` realtime: a change from another device updates counters live; visible-list reorder while scrolling is queued behind the chip; tapping the chip applies; no reorder under the finger
- [ ] New cards animate with a 1.2s `--marca` outline that fades — no slide, no layout jump
- [ ] WhatsApp sheet: per-estado message via `mensajeWhatsApp`, editable, "Abrir WhatsApp" opens `wa.me/<digits>?text=<encoded>` in a new tab, Cancelar; no phone → disabled icon (opacity 40%) + toast "Este cliente no tiene teléfono cargado"
- [ ] Ficha sheet: nombre + cédula mono + dirección (join) + WhatsApp/Llamar(`tel:`)/Ficha(`/clientes/[id]`) + "Sus botellones (N)" with ALL estados incl. entregado, per-estado badge + age; focus trap + Escape close
- [ ] `getBotellonesCliente` returns all estados incl. entregado with age + labels
- [ ] Carried fixes: stale totals after delivery resolved (realtime), frozen urgency clock resolved (re-render on realtime), transport catch rethrow, S2 undo honesty, `dragId` clear in drop handler
- [ ] Tests green: `npm run test`, `tsc --noEmit`, `npm run build`; no hardcoded hex (grep) in new components; no shadcn `ui/*` edits; each PR ≤400 changed lines
