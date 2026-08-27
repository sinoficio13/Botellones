# Design: Central de Operaciones — Fase 5 (Realtime + WhatsApp + Ficha cliente)

## Technical Approach

All client-side over existing primitives, 3 chained PRs (each ≤400 lines). Realtime = `postgres_changes` on `botellones` (publication 0010, no migration) via the existing browser client, mirroring `estado-en-vivo` (channel → handler → removeChannel, silent degradation on CHANNEL_ERROR/TIMED_OUT). The queue state lives in `useColaOperaciones` (extended) with a **two-layer row model**: `botellones` (live rows, patched on every event — drives `porEstado`/`totales`/counters, always live) and a **gated render snapshot** (`visibles: ColaBotellon[] | null`; `null` = render live, else render frozen snapshot) so the active list never reorders under the finger. Queue gate is a pure function; queued events surface as `chip-realtime.tsx` under the tabs; chip tap applies. WhatsApp + ficha are controlled bottom sheets (`ui/sheet.tsx` `side="bottom"`, base-ui Dialog gives focus trap + Escape) composed in the shell. `getBotellonesCliente` is a new server helper (all estados incl. `entregado` + direcciones join). No new deps, no `ui/*` edits, tokens only.

## Architecture Decisions

| # | Decision | Options | Choice / Rationale |
|---|---|---|---|
| D1 | Realtime transport | polling vs postgres_changes | Spec-locked: `channel('cola-realtime').on('postgres_changes', {event:'*', schema:'public', table:'botellones'})`; no poll (REQ-COS-27). |
| D2 | Where realtime lives | separate `useRealtimeCola(onEvento)` subscription hook consumed inside `useColaOperaciones` | `useRealtimeCola` owns ONLY the channel lifecycle + payload mapping (testable with the `estado-en-vivo` fake-channel mock); the gate/queue/two-layer state stays with `botellones` state. Hook signature becomes `useColaOperaciones({ tab })` (sole consumer is the shell — safe). |
| D3 | Gate semantics | literal `scrolleando \|\| afectaVisible(tab)` with `afectaVisible = (estadoAnterior === tab \|\| estadoNuevo === tab)` | Pure function `decidirGate(evento, tab, scrolleando)`; satisfies both REQ-COS-27 scenarios verbatim (scrolling → queue; reorder-affecting → queue; non-visible → direct + counter bump). Desktop/tablet inherit the mobile `tab` (defaults `recibido`): at rest, non-active-tab column changes apply directly (multi-device kanban stays live); scrolling gates all layouts. One-line change if reviewers want layout-aware gating. |
| D4 | Two-layer state | one list (gate by not patching) vs live list + snapshot | `botellones` patched by EVERY event (idempotent merge-by-id); `visibles` snapshot frozen on gate, `null` otherwise. Counters/totals derive from `botellones` → always live regardless of gate (REQ-COS-17 S2). Chip tap: `visibles = null` + entrando diff. |
| D5 | Realtime payload has no `clientes` join | per-event fetch vs drop vs one-shot refetch | Rows entering the queue with unknown `cliente_id` (INSERT / UPDATE from `entregado`/stock) trigger ONE `getColaOperaciones()` refetch (not polling — only on unknown-client events). Known rows merge by id keeping their join. |
| D6 | Echo suppression | none vs in-flight-id skip | `idsEnMovimientoRef` (set in `mover`, cleared when the RPC settles) — the handler skips events for this client's in-flight ids, preventing phantom re-adds/double counter patches racing the optimistic move. |
| D7 | No-phone target | `disabled` attr vs `aria-disabled` + handler | A `disabled` button swallows clicks → toast can't fire. Both cards switch to `aria-disabled` + opacity-40; onClick always fires; shell handler shows toast "Este cliente no tiene teléfono cargado" and returns (REQ-COS-28 S4). |
| D8 | Sheets | `SheetTrigger` vs controlled `Sheet open onOpenChange` | Controlled (mobile-nav pattern). Ficha→WhatsApp must swap sheets (only one open); state in shell: `sheetWhatsApp: {grupo, estado} \| null`, `sheetFicha: {grupo, estado} \| null`. |
| D9 | New-card outline | slide vs `--marca` outline | Spec: 2px solid `--marca` outline 1.2s then fade, no slide. `entrando: Set<cliente_id>` diffed on apply; `GrupoCard` gains `entrando` prop → `outline outline-2 outline-marca` + `transition-[outline-color] duration-700`; keys cleared by setTimeout 1200ms. |
| D10 | Frozen clock (carried) | none vs tick | `useEdadAhora` re-sets `ahora` every 30s (setInterval) so realtime re-renders show fresh ages/urgency; reused by ficha list. |
| D11 | Stale totals (carried) | none vs predicate fix | `totales` filters `ESTADOS_KANBAN` (same predicate as `getColaOperaciones`) — delivered rows no longer counted (mover re-adds them via `aplicarFilas`). |
| D12 | Transport catch (carried, PR-C) | rethrow vs convert | Wrap the `mover` RPC await in try/catch → rejection converts to the existing error path (revert + red toast + `{ok:false}`) instead of an unhandled throw escaping `ResultadoAccion`. |
| D13 | `mensajeWhatsApp` + link | inline vs `src/lib/utils/whatsapp.ts` | Pure functions in the existing whatsapp util: locked literal + `buildWaLink(digitos, mensaje)` = `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`. |
| D14 | Ficha data | client-side fetch vs server helper | `getBotellonesCliente(clienteId)` in `botellones.ts` (`'use server'`): `clientes.select('id, nombre, cedula, telefono_1, whatsapp, direcciones(*)')` + `botellones.select('id, codigo, estado, estado_desde').eq('cliente_id', id)` (ALL estados — no estado filter → incl. `entregado`); null-safe try/catch per repo convention. Age computed client-side with `formatAntiguedad`. |

## Data Flow

```
postgres_changes (botellones, publication 0010)
        │
        ▼
useRealtimeCola(onEvento)  ── payload ──►  useColaOperaciones.reducerAplicarEvento
        │                                   ├─ skip: id ∈ idsEnMovimientoRef (D6)
        │                                   ├─ skip: cliente_id null (stock) / row outside queue
        │                                   ├─ mergeEvento(botellones) → siguiente      [LIVE]
        │                                   │    UPDATE: merge by id (estado/estado_desde/cliente_id, keep join);
        │                                   │            row leaves queue (entregado/unassign) → remove
        │                                   │    INSERT/DELETE: add (if client known) / remove
        │                                   │    unknown client → one-shot getColaOperaciones() refetch (D5)
        │                                   ├─ decidirGate(evento, tab, scrolleando)    [GATE]
        │                                   │    direct: setBotellones(siguiente); visibles=null; entrando diff
        │                                   │    queued: visibles = snapshot pre-patch; pendientes++  → ChipRealtime
        │                                   └─ aplicarPendientes() (chip tap): visibles=null; entrando diff; pendientes=0
        ▼
porEstado (memo) ──► TabsEstados contadores (LIVE) + BarraContexto totales (LIVE, D11)
visibles ?? botellones ──► lista activa / tablet sections / KanbanDesktop (gated render)
```

### Sequence: realtime event while scrolling vs at top

```
Device B moves a bottle               Device A (this client)
──────────────────────────            ───────────────────────
mover_botellones RPC ──► DB commit
                        │            scrolleando=true (listener + 150ms debounce)
                        ▼
              postgres_changes broadcast
                                       │  useRealtimeCola handler
                                       │  id ∉ idsEnMovimiento (other device) → proceed
                                       │  mergeEvento → botellones patched      → tab counter bumps NOW
                                       │  decidirGate: scrolleando=true → QUEUED
                                       │  visibles frozen (pre-patch) → list does NOT move
                                       │  ChipRealtime "↑ 1 botellones nuevos" appears
                                       │  operator taps chip → aplicarPendientes
                                       │  visibles=null; list re-renders; entrando diff → outline 1.2s
```

```
Device B moves a bottle               Device A at top, not scrolling
                                       │  decidirGate: !scrolleando && !afectaVisible → DIRECT
                                       │  botellones patched; visibles=null → list updates in place
                                       │  reorder-affecting (same tab) → QUEUED even at rest (spec S2)
                                       │  non-visible estado → applies directly + counter bump (spec S2)
```

## File Changes

| File | Action | PR | Description |
|---|---|---|---|
| `src/hooks/useRealtimeCola.ts` | Create | A | Channel lifecycle + payload mapping; `onEvento` stable ref (estado-en-vivo pattern) |
| `src/hooks/useColaOperaciones.ts` | Modify | A | Signature `({tab})`; two-layer state, gate, `pendientes`, `aplicarPendientes`, `entrando`, `setScrolleando`, echo skip, totals predicate fix (D11), refetch path (D5) |
| `src/components/operaciones/chip-realtime.tsx` | Create | A | Sticky chip "↑ N botellones nuevos" (copy per spec, plural kept for N=1), tap → `aplicarPendientes`; null when 0 |
| `src/components/operaciones/cola-operaciones.tsx` | Modify | A/B/C | Scroll listener (container ref + debounce) → `setScrolleando`; pass `tab`; render chip; sheet state + handlers (B/C) |
| `src/components/operaciones/grupo-card.tsx` | Modify | A/B/C | `entrando` prop + outline class (A); `onWhatsApp` prop + `aria-disabled` (B); `onAbrirFicha` on name button (C) |
| `src/components/operaciones/grupo-card-kanban.tsx` | Modify | B/C | WhatsApp `aria-disabled` + onClick (B); name `<span>` → button `onAbrirFicha` (C) |
| `src/components/operaciones/kanban-desktop.tsx` | Modify | B/C | Pass `onWhatsApp`/`onAbrirFicha` through (B/C); `setDragId(null)` in drop handler (C) |
| `src/lib/utils/whatsapp.ts` | Modify | B | `mensajeWhatsApp` (locked literal) + `buildWaLink` |
| `src/components/operaciones/sheet-whatsapp.tsx` | Create | B | Controlled bottom sheet: textarea editable, note, "Abrir WhatsApp" (`--whatsapp`), Cancelar |
| `src/lib/db/botellones.ts` | Modify | C | `getBotellonesCliente(clienteId)` (all estados + join) |
| `src/components/operaciones/ficha-cliente.tsx` | Create | C | Nombre/cédula mono/dirección + 3 actions + "Sus botellones (N)" all estados |
| `tests/component/use-realtime-cola.test.tsx` | Create | A | Channel config, gate, queue, chip, outline, echo skip, refetch |
| `tests/component/cola-operaciones.test.tsx` | Modify | A | Chip render/tap, live counters, scroll listener |
| `tests/component/sheet-whatsapp.test.tsx` | Create | B | Copy, edit, deeplink, no-phone toast |
| `tests/component/ficha-cliente.test.tsx` | Create | C | Data, actions, all-estados, Escape |
| `tests/unit/botellones-cliente.test.ts` | Create | C | Helper contract |
| `tests/unit/whatsapp.test.ts` | Modify | B | Literal branches + encoding |
| `tests/component/undo-flow.test.tsx` | Modify | C | S2 honesty fix |
| `tests/component/kanban-desktop.test.tsx` | Modify | C | dragId clear, name/WhatsApp wiring |

## Interfaces / Contracts

```ts
// src/lib/utils/whatsapp.ts — LOCKED literal (spec §7.3 verbatim)
export function mensajeWhatsApp(estado: string, nombre: string, cantidad: number): string {
  const p = nombre.split(' ')[0];
  const u = cantidad > 1 ? `${cantidad} botellones` : 'tu botellón';
  switch (estado) {
    case 'recibido': return `Hola ${p}, recibimos ${u}. Te aviso apenas ${cantidad > 1 ? 'estén' : 'esté'} listo${cantidad > 1 ? 's' : ''}.`;
    case 'recarga':  return `Hola ${p}, ya estamos recargando ${u}.`;
    case 'listo':    return `Hola ${p}, ${cantidad > 1 ? `tus ${cantidad} botellones están listos` : 'tu botellón está listo'}. ¿Te lo llevo hoy?`;
    case 'delivery': return `Hola ${p}, vamos en camino con ${u}.`;
    default:         return `Hola ${p}, `;
  }
}
export function buildWaLink(digitos: string, mensaje: string): string {
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`; // digits via normalizeWhatsAppPhone
}

// src/hooks/useRealtimeCola.ts
export function useRealtimeCola(onEvento: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void): void;
// src/hooks/useColaOperaciones.ts — extended return
export function useColaOperaciones(opts: { tab: EstadoOperativo }): {
  cargando; error; porEstado; totales; mover; reintentar;
  pendientes: number; aplicarPendientes: () => void;
  entrando: Set<string>; setScrolleando: (b: boolean) => void;
};

// Gate (D3) — pure, trivially testable
function decidirGate(estadoAnterior: string | undefined, estadoNuevo: string | undefined,
                     tab: EstadoOperativo, scrolleando: boolean): boolean {
  const afectaVisible = estadoAnterior === tab || estadoNuevo === tab;
  return scrolleando || afectaVisible;
}

// src/lib/db/botellones.ts
export type BotellonesClienteResult = {
  cliente: { id: string; nombre: string; cedula: string | null; telefono_1: string | null; whatsapp: string | null } | null;
  direccion: Record<string, string | null> | null; // direcciones(*) row
  botellones: { id: string; codigo: string; estado: string; estado_desde: string }[]; // ALL estados incl. entregado
};
export async function getBotellonesCliente(clienteId: string): Promise<BotellonesClienteResult>;
```

Cédula note (carried, PR-C): stored cédulas are digits-only (searched via `normalizarCedula`); the ficha renders the stored value as-is in mono — comment documents that a future `V-`/`E-` prefix is display-only and out of scope.

## Testing Strategy

| PR | Layer | What | Approach |
|---|---|---|---|
| A | Component | `useRealtimeCola` + gate/queue | Fake-channel mock (estado-en-vivo pattern): subscription config (event `*`, table `botellones`), removeChannel on unmount, CHANNEL_ERROR/TIMED_OUT silent (console.warn only), echo skip, queued-while-scrolling, queued-when-`afectaTabActivo`, direct-apply when neither, live counters while queued, chip tap applies + entrando diff, outline class present → gone after 1200ms (fake timers), unknown-client INSERT triggers one refetch, DELETE removes |
| A | Component | Shell | Chip renders "↑ N botellones nuevos", tap applies; scroll listener sets `scrolleando`; tab counters live during queue |
| B | Component | `sheet-whatsapp` | Per-estado literal (listo/3/"Gimnasio Ríos" → "Hola Gimnasio, tus 3 botellones están listos. ¿Te lo llevo hoy?"), editable textarea, note, "Abrir WhatsApp" href `wa.me/<digitos>?text=<encoded>` (spaces+accents), Cancelar closes without navigation, no auto-send on estado change |
| B | Unit | whatsapp util | All 5 literal branches + singular/plural + `buildWaLink` encoding |
| B | Component | Cards | `onWhatsApp` fires with phone; no-phone → `aria-disabled` (not `disabled`) + toast, sheet not opened |
| C | Component | `ficha-cliente` | nombre/cédula mono/dirección join; WhatsApp→sheet swap, Llamar `tel:`, Ficha `/clientes/[id]`; "Sus botellones (N)" all estados incl. entregado with `ESTADO_COLORS` badge + age; Escape closes (base-ui), focus returns |
| C | Unit | `getBotellonesCliente` | All 5 estados incl. entregado + join + null-safe |
| C | Component | carried | undo S2 honesty (mock restores original `estado_desde`, assert pre-undo age), dragId cleared after drop |

Threat Matrix: `N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary` (wa.me/tel: are anchor hrefs, not process execution).

## Migration / Rollout

No migration (publication 0010 already exposes `botellones`). Rollout = chained PRs on `redesign/central-operaciones` (PR-A→B→C). Rollback per proposal: unwire per slice (A: remove subscription/chip → static fetch; B: unwire `onWhatsApp`; C: unwire ficha + drop helper).

## Chained-PR Slice Plan (each ≤400 changed lines)

| Slice | Files (est. lines) | Reqs |
|---|---|---|
| **PR-A** Realtime (~350) | `useRealtimeCola.ts` (70) + `useColaOperaciones.ts` (120) + `chip-realtime.tsx` (40) + `cola-operaciones.tsx` (70) + `grupo-card.tsx` entrando (20) + `use-realtime-cola.test.tsx` (100) + `cola-operaciones.test.tsx` (+40) | REQ-COS-27, MOD-17, REQ-COS-30 (realtime) |
| **PR-B** WhatsApp (~340) | `whatsapp.ts` (30) + `sheet-whatsapp.tsx` (90) + `grupo-card.tsx` (15) + `grupo-card-kanban.tsx` (10) + `kanban-desktop.tsx` (10) + `cola-operaciones.tsx` (+60) + `sheet-whatsapp.test.tsx` (120) + `whatsapp.test.ts` (+25) | REQ-COS-28, MOD-18/23 (WhatsApp), REQ-COS-30 (sheet) |
| **PR-C** Ficha + carried (~380) | `botellones.ts` (45) + `ficha-cliente.tsx` (120) + `grupo-card.tsx` (10) + `grupo-card-kanban.tsx` (10) + `kanban-desktop.tsx` (13) + `cola-operaciones.tsx` (+40) + `useColaOperaciones.ts` catch (10) + `ficha-cliente.test.tsx` (110) + `botellones-cliente.test.ts` (40) + `undo-flow.test.tsx` (10) + `kanban-desktop.test.tsx` (+15) | REQ-COS-29, MOD-18/23 (ficha), carried fixes (D12, dragId, S2), REQ-COS-30 (ficha/helper) |

## Verification Matrix

| Requirement | Design mechanism | Test | PR |
|---|---|---|---|
| REQ-COS-27 subscribe/removeChannel/silent/no-poll | `useRealtimeCola` (D1/D2) | use-realtime-cola channel config + status tests | A |
| REQ-COS-27 gate + chip + live counters + outline | D3/D4/D9 + `chip-realtime` | gate/queue/chip/outline tests | A |
| REQ-COS-28 sheet literal/editable/wa.me/no-phone/wired | D7/D13/D8 + sheet-whatsapp | sheet-whatsapp + card tests | B |
| REQ-COS-29 ficha data/actions/all-estados/focus | D14/D8 + ficha-cliente | ficha-cliente + helper tests | C |
| REQ-COS-30 test contract | All | Matrix above | A/B/C |
| MOD-17 counters live | D4 (live `botellones`) | counters-live-while-queued test | A |
| MOD-18/23 targets wired | D7 + shell handlers | card wiring tests | B/C |

## Open Questions

- [ ] Desktop gate interpretation (D3): literal `afectaVisible` uses the mobile `tab` on tablet/kanban (active-tab changes queue, others direct at rest). If reviewers prefer scrolling-only gating on ≥768px, `decidirGate` is a one-line change. Blocking? No — verifiable either way.
- [ ] Playwright chip spec (REQ-COS-30 MAY): dropped if PR-A exceeds 400 lines (spec permits).