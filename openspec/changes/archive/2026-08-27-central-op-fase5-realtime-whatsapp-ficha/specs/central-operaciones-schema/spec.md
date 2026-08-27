# Delta for central-operaciones-schema

## ADDED Requirements

### Requirement: REQ-COS-27 — Cola realtime + chip flotante

The system MUST subscribe to `postgres_changes` on `botellones` via the existing browser client: `channel('cola-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'botellones' })`, and MUST `removeChannel` on unmount. Realtime events MUST degrade silently on `CHANNEL_ERROR`/`TIMED_OUT` (keep last rendered state). A change MUST apply directly to the list UNLESS the user is scrolling OR the change would reorder the visible list; in either case the change MUST be queued behind a floating chip under the tabs showing "↑ N botellones nuevos", and tapping the chip MUST apply all queued changes. Tab counters MUST update live on every event regardless of the gate. New cards MUST animate with a 2px solid `--marca` outline for 1.2s then fade — no slide, no layout jump, no reorder under the finger. The system MUST NOT poll.

#### Scenario: Change while scrolling is queued, counters stay live

- GIVEN the operator is scrolling the list on one device and another device moves a bottle
- WHEN the `postgres_changes` event arrives
- THEN the visible list does NOT reorder, a chip "↑ 1 botellones nuevos" appears under the tabs, and the tab counters update immediately

#### Scenario: Reorder-affecting change queued; non-visible change applies

- GIVEN a change that would reorder the active visible list and a change to a non-visible estado
- WHEN both events arrive
- THEN the reorder-affecting change is queued behind the chip and the non-visible change applies directly while its tab counter bumps

#### Scenario: Chip tap applies the queue

- GIVEN a queued chip showing "↑ N botellones nuevos"
- WHEN the operator taps it
- THEN all queued changes apply at once and the chip disappears

#### Scenario: New card outline fades, no slide

- GIVEN a bottle newly entering the current estado
- WHEN it renders
- THEN it animates a 2px solid `--marca` outline for 1.2s that fades, with no slide and no layout jump

#### Scenario: Channel error degrades silently

- GIVEN a `CHANNEL_ERROR` or `TIMED_OUT` subscription status
- WHEN the channel reports it
- THEN the queue keeps its last rendered state and no error UI is shown

### Requirement: REQ-COS-28 — Sheet WhatsApp

Tapping the WhatsApp target on a group card MUST open a bottom sheet (`side="bottom"`, shadcn `ui/sheet`) with the message pre-loaded for the CURRENT tab/estado from the locked `mensajeWhatsApp` literal below, an editable textarea, the note "Tocá para editar antes de enviar", a green button using the `--whatsapp` token labeled "Abrir WhatsApp", and "Cancelar". "Abrir WhatsApp" MUST open `https://wa.me/<digitos>?text=<encodeURIComponent(mensaje)>` in a new tab. There MUST be NO automatic send on estado change. A client without a phone MUST render the WhatsApp target disabled (opacity 40%) and tapping it MUST show the toast "Este cliente no tiene teléfono cargado" without opening the sheet. The currently-inert WhatsApp targets in `GrupoCard` and `GrupoCardKanban` MUST become wired. New components MUST use tokens only, no hex.

Locked `mensajeWhatsApp` literal (user spec §7.3 verbatim; `{p}` = client FIRST name, `{u}` = "N botellones" or "tu botellón" by count):

```
function mensajeWhatsApp(estado, nombre, cantidad) {
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
```

#### Scenario: Per-estado message pre-loaded and editable

- GIVEN the operator taps the WhatsApp target on a group in `listo` with 3 bottles for "Gimnasio Ríos"
- WHEN the sheet opens
- THEN the textarea contains "Hola Gimnasio, tus 3 botellones están listos. ¿Te lo llevo hoy?" and the operator can edit it before sending

#### Scenario: Deep link opens encoded message in new tab

- GIVEN an edited message with spaces and accents
- WHEN "Abrir WhatsApp" is tapped
- THEN a new tab opens `https://wa.me/<digitos>?text=<encoded>` where the text is `encodeURIComponent`-encoded

#### Scenario: Cancelar closes without navigation

- GIVEN an open WhatsApp sheet
- WHEN "Cancelar" is tapped
- THEN the sheet closes and no navigation occurs

#### Scenario: No phone disabled with toast

- GIVEN a client with no phone
- WHEN the WhatsApp target is tapped
- THEN the sheet does not open, the target renders at opacity 40%, and the toast "Este cliente no tiene teléfono cargado" shows

#### Scenario: No automatic send on estado change

- GIVEN the active tab changes
- WHEN the queue re-renders
- THEN no message is sent and no sheet opens

### Requirement: REQ-COS-29 — Ficha del cliente (bottom sheet)

Tapping the name+cédula block on a group card MUST open a bottom sheet showing the client's nombre, cédula (mono font), and dirección (join of `direcciones`), three actions — WhatsApp (opens the REQ-COS-28 sheet pre-filled for this client), Llamar (`tel:` with the client's phone), and Ficha (navigates to `/clientes/[id]`) — and a "Sus botellones (N)" list covering ALL estados INCLUDING `entregado`, each with a per-estado badge and its age. The sheet MUST trap focus and close on Escape (base-ui Dialog semantics). The server helper `getBotellonesCliente(clienteId)` MUST return all botellones of the client in any estado (incl. `entregado`) with `estado_desde` and the client/direcciones join; age is computed client-side with `formatAntiguedad`. The name/cédula targets in both `GrupoCard` and `GrupoCardKanban` MUST become wired.

#### Scenario: Ficha shows data and all-estados list

- GIVEN a client with bottles in `recibido` and `entregado`
- WHEN the name+cédula block is tapped
- THEN the sheet shows nombre, cédula in mono, the joined dirección, and "Sus botellones (N)" with both bottles, each with a per-estado badge and age, including the `entregado` one

#### Scenario: Three actions behave

- GIVEN an open ficha for a client with a phone
- WHEN WhatsApp / Llamar / Ficha are tapped
- THEN WhatsApp opens the pre-filled sheet, Llamar dials `tel:<telefono>`, and Ficha navigates to `/clientes/[id]`

#### Scenario: Focus trap and Escape close

- GIVEN an open ficha sheet
- WHEN Escape is pressed or focus leaves the sheet
- THEN the sheet closes and focus returns to the trigger

### Requirement: REQ-COS-30 — Fase-5 test contract

Component tests MUST cover: the realtime queue/chip (`useRealtimeCola`/`chip-realtime`: gate on scroll, live counters, chip tap applies, outline animation), the WhatsApp sheet (`sheet-whatsapp.test.tsx`: per-estado message, encoded `?text=`, no-phone toast), the client ficha (`ficha-cliente.test.tsx`: all-estados list incl. entregado, focus/Escape), and the server helper (`getBotellonesCliente`: returns all estados incl. entregado). A Playwright spec for the realtime chip MAY be added; it MAY be dropped to keep its PR within the 400-line budget.

#### Scenario: Files cover the contract

- GIVEN the fase-5 components
- WHEN the suite runs
- THEN the realtime/chip, sheet-whatsapp, ficha-cliente, and helper tests pass and the fase-3/4 suites stay green

#### Scenario: Deep-link encoding asserted

- GIVEN a message with spaces and accents in the WhatsApp sheet test
- WHEN "Abrir WhatsApp" fires
- THEN the asserted href contains the `encodeURIComponent`-encoded text

#### Scenario: Helper returns entregado

- GIVEN a client with bottles across all five estados
- WHEN `getBotellonesCliente(clienteId)` runs
- THEN it returns all bottles incl. `entregado` with `estado_desde` and the client join

## MODIFIED Requirements

### Requirement: REQ-COS-17 — Tabs de estado + barra de contexto

The system MUST render 4 estado tabs (`recibido`, `recarga`, `listo`, `delivery`) as `role="tablist"`/`role="tab"` with `aria-selected` reflecting the active tab, sticky at the top, each with a 2px underline in its `--estado-*` token and a counter of groups updated LIVE by realtime (REQ-COS-27), independent of the chip queue. A context bar MUST show "N clientes · N botellones · más antiguo arriba".
(Previously: counters were static this fase.)

#### Scenario: Accessible sticky tabs with estado underline

- GIVEN groups in all 4 estados
- WHEN the queue renders on mobile
- THEN 4 tabs show with per-estado group counters, `aria-selected` on the active tab, and a 2px underline resolved to the tab's `--estado-*` token

#### Scenario: Counters live while a change is queued

- GIVEN a realtime change queued behind the chip because the user is scrolling
- WHEN the event arrives
- THEN the affected tab counter updates immediately, before the chip is tapped

#### Scenario: Context totals

- GIVEN a loaded queue
- WHEN the context bar renders
- THEN it shows client and botellón totals with the "más antiguo arriba" hint

### Requirement: REQ-COS-18 — Card de grupo + chips + urgencia

Each client group MUST render as one card: name and cédula (mono font; "—" when cédula is NULL) plus 3 independent touch targets of at least 44px — name (opens the ficha, REQ-COS-29), WhatsApp icon (opens the WhatsApp sheet, REQ-COS-28; disabled with opacity 40% + toast when no phone), and a chips grid. Chips MUST be all-marked by default, toggle individually, show 6 plus a "+N" expansion when the group exceeds 6 bottles. Urgency MUST be 2-level: 6–24h amber `--urgencia` text; >24h a `▲ AlertTriangle` icon plus amber 7% card background; <6h normal. Age MUST format as `45m`/`3h`/`3d`. No hardcoded hex MAY appear.
(Previously: the name target and the WhatsApp target (when a phone exists) were inert placeholders.)

#### Scenario: Chips all-marked with +N expansion

- GIVEN a group of 8 bottles
- WHEN the card renders
- THEN 6 chips show all-marked plus a "+2" expansion control

#### Scenario: Urgency levels

- GIVEN a group aged 30h and another aged 10h
- WHEN cards render
- THEN the 30h card shows `▲` with amber 7% background and the 10h card shows amber text only

#### Scenario: Null cédula

- GIVEN a client without cédula
- WHEN the card renders
- THEN the cédula block shows "—" in mono font

#### Scenario: Name and WhatsApp targets wired

- GIVEN a group with a phone
- WHEN the name block or the WhatsApp icon is tapped
- THEN the ficha sheet (REQ-COS-29) or the WhatsApp sheet (REQ-COS-28) opens respectively

### Requirement: REQ-COS-23 — Compact desktop group card

Each group on the desktop kanban MUST render as one compact card: client name, cédula in mono font ("—" when NULL), age plus 2-level urgency (6–24h amber text via `--urgencia-texto`; >24h a `▲` icon and amber tint via `--urgencia`; <6h normal), and bottle codes on ONE line separated by `·`, truncated with a "+N" suffix when the group exceeds 6 codes. The ActionButton MUST act on the WHOLE group (no chip selection on desktop), MUST use per-estado Spanish copy via `DESTINO_ACCION`/`copiaAccion`, MUST be at least 44px tall (`min-h-11`), and MUST apply the action to all group ids. A WhatsApp icon target MUST be present and wired to the WhatsApp sheet (REQ-COS-28); it MUST be disabled with opacity 40% and trigger the no-phone toast when the client has no phone. The client name MUST open the ficha (REQ-COS-29). New components MUST NOT hardcode hex colors.
(Previously: the WhatsApp target was inert and the name was not a target.)

#### Scenario: Whole-group action, no chips

- GIVEN a group of 3 bottles in `recibido`
- WHEN the compact card renders
- THEN a single ActionButton ≥44px shows "→ Pasar 3 a En recarga", targets the whole group, and no chips render

#### Scenario: Codes one line with +N overflow

- GIVEN a group of 8 bottles
- WHEN the card renders
- THEN codes appear on one line separated by `·` with a "+2" suffix and no chips

#### Scenario: Urgency uses tokens

- GIVEN a group aged 30h and a group aged 10h
- WHEN cards render
- THEN the 30h card shows `▲` with `--urgencia` tint and the 10h card shows `--urgencia-texto` amber text

#### Scenario: WhatsApp wired, no phone disabled with toast

- GIVEN a client with a phone and a client without
- WHEN the WhatsApp targets are tapped
- THEN the phone-holder's opens the sheet; the other renders at opacity 40%, does not open the sheet, and shows the toast "Este cliente no tiene teléfono cargado"

#### Scenario: Name opens the ficha

- GIVEN a compact card
- WHEN the client name is tapped
- THEN the ficha sheet (REQ-COS-29) opens