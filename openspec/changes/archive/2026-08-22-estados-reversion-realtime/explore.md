# Explore: estados-reversion-realtime

Change: `estados-reversion-realtime` — repo D:\Github\Botellon (Next.js 16 App Router, React 19, TS, Tailwind 4, Supabase @supabase/ssr + supabase-js 2.49.4, vitest).
Date: 2026-08-22. Status: success.

## Executive Summary

The app has a strict 5-estado forward machine defined in `src/lib/utils/estados.ts` (TRANSICIONES) but it is enforced ONLY in the client UI: `updateBotellon` (src/lib/db/botellones.ts L131-162) and `moverBotellon` (L210-238) write any estado with zero server-side validation. The detail page (`/botellones/[id]`) offers no undo path because the selector only shows forward transitions, and neither the detail page nor the kanban (`operaciones-dashboard.tsx`) receives live updates — both rely on RSC revalidation, so other browsers stay frozen until F5. Recommended approach: (1) add a `REVERSIONES` map (immediate-previous inverse of TRANSICIONES) plus a combined `getEstadosPermitidos()` in estados.ts, with `entregado → [listo, delivery]` per the locked decision; (2) validate in the db layer (read current estado, check membership, then conditional `.eq('estado', current)` update — the same CAS pattern `registrarOperacion` already uses); (3) wire `postgres_changes` on the detail page (filter `id=eq.X`, event UPDATE) and kanban (event UPDATE on botellones), mirroring the existing alert-panel/bell subscribers, and add an idempotent migration 0010 putting botellones/recargas/premios/notificaciones into `supabase_realtime` (no migration does this today — verified). Key risks: the client-assignment override in `updateBotellon` (assigning a client forces `entregado` from any estado) conflicts with strict validation and must be carved out as a documented exception; the detail-page form is defaultValue-driven and needs a reconciliation decision for realtime state.

## Current State

- Pure state machine: `src/lib/utils/estados.ts` L18-28 — `TRANSICIONES: Record<Estado, Estado[]>`: entregado→[recibido], recibido→[recarga], recarga→[listo], listo→[entregado, delivery], delivery→[entregado]; `getTransiciones()` returns the forward list. 5 estados only (migration 0009 collapsed planta/danado/perdido/mantenimiento; L13-14 CHECK constraint).
- Server writes with NO validation: `updateBotellon` (botellones.ts L131-162) writes `update.estado` verbatim at L153; `moverBotellon` (L210-238) writes `nuevoEstado` at L230. Neither reads the current row first. Only client guards exist: detail selector (form.tsx L46-52) and kanban select (operaciones-dashboard.tsx L278-286).
- Reference server-side validation pattern: `registrarOperacion` (src/lib/db/cargas.ts) validates against `OPERACIONES[op].sources` and updates with a conditional `.in('estado', sources)` guard (L159, L240) — the CAS pattern to mirror.
- Realtime exists in two components today: `alert-panel.tsx` L88-99 (`postgres_changes` on premios *, botellones UPDATE, recargas INSERT → refetch /api/alertas) and `bell.tsx` L113-147 (notificaciones INSERT with `usuario_id=eq.${userId}` filter; silent degradation on CHANNEL_ERROR/TIMED_OUT at L142-147). Browser client: `src/lib/supabase/client.ts` (createBrowserClient with publishable key + user session).
- No migration touches the publication: grep for `ALTER PUBLICATION|supabase_realtime` across supabase/ returned zero matches.
- RLS for botellones: `admin_select_botellones` (0001_init.sql L280-282) and `repartidor_select_botellones` (L388-390), both `FOR SELECT TO authenticated USING (role claim = 'admin'|'repartidor')`; plus anon column-restricted `public_select_botellones` (L452-454, SELECT codigo/estado only).

## Exploration Questions

### 1. State machine + reversal design

**Modeling — recommend Option (a): separate `REVERSIONES` map + helpers.**

- (a) Separate map: explicit `Record<Estado, Estado[]>` mirroring TRANSICIONES shape; zero impact on existing consumers of `getTransiciones` (page.tsx L21, tests/unit/estados.test.ts L57-74); reversal is semantically distinct from the forward cycle ("undo the previous move") so a unified structure with a direction flag obscures intent and forces touching every consumer.
- (b) Unified TRANSICIONES with direction flag: single structure but a breaking shape change to a widely imported module, more complex reads, no real benefit.

**Full reversal set (immediate-previous only — verified as the exact inverse relation of TRANSICIONES):**

```
entregado: ['listo', 'delivery']   ← user picks (locked decision)
recibido:  ['entregado']           ← unambiguous: only forward source is entregado
recarga:   ['recibido']
listo:     ['recarga']
delivery:  ['listo']
```

Invariant check (for every forward edge a→b, a ∈ REVERSIONES[b]): entregado→recibido ✓, recibido→recarga ✓, recarga→listo ✓, listo→entregado ✓, listo→delivery ✓, delivery→entregado ✓. `recibido` has no ambiguity: its only predecessor in the pure machine is `entregado` (the planta/danado/perdido/mantenimiento remap in 0009 L8-9 was a one-time data migration; those estados no longer exist in the CHECK constraint, 0009 L13-14).

**API surface to add in estados.ts:**
- `REVERSIONES: Record<Estado, Estado[]>` (explicit map above).
- `getReversiones(estado: Estado): Estado[]` — mirrors `getTransiciones` (L26-28).
- `getEstadosPermitidos(estado: Estado): Estado[]` — dedup union of forward + reversal; single source for BOTH the selector UI and the server validation rule (avoids drift between client and server).

**Selector UI — recommend a single `<select>` with `<optgroup label="Avanzar">` / `<optgroup label="Deshacer">`** (current estado as first plain option). Native, accessible, minimal diff to form.tsx L46-52, and the form action stays unchanged. Alternative (two separate controls) is more explicit but a larger diff and breaks the existing single-select form pattern. Note the current "terminal state" hint (form.tsx L53-55) becomes obsolete: with reversals, no estado is terminal (every estado has ≥1 reversal), so that branch should be removed.

### 2. Server validation

**Exact rule:** before writing, read the current row; valid iff `nuevoEstado ∈ getEstadosPermitidos(currentEstado)`. Apply the same rule in `updateBotellon` and `moverBotellon`. Additionally, make the UPDATE conditional: `.eq('id', id).eq('estado', currentEstado)` — a compare-and-set that aborts the write if another client moved the botellon concurrently (mirrors `registrarOperacion` L159/L240 and closes the TOCTOU window between the SELECT and the UPDATE). On validation failure return `{ error: 'Transición no permitida: <actual> → <destino>' }` and do not touch the DB.

**Where it lives:** pure functions (`getReversiones`, `getEstadosPermitidos`) belong in `estados.ts` (already the pure state-machine module, no server deps); the read-validate-write orchestration belongs in `botellones.ts` db layer (it already owns the supabase client). Do NOT put the check in SQL: the machine is TS-owned domain logic and the CHECK constraint (0009 L13-14) only pins the enum, not transitions.

**CRITICAL edge case — client-assignment override:** `updateBotellon` L146-151 forces `estado = 'entregado'` whenever a cliente_id is submitted ("assigning a client sells the stock", tested at botellones-estado.test.ts L105-141; kanban assign modal at operaciones-dashboard.tsx L72-88 assigns from ANY column). Under strict validation, `entregado` is only reachable forward from listo/delivery, so this override would be rejected from recibido/recarga. Recommendation: carve the override out as a **documented exception** — when `cliente_id` transitions null→non-null, the forced `entregado` is exempt from the machine check (it is a business sale, not a state-machine move); the user-submitted `estado` field is validated only when no client assignment occurs. This preserves the existing sell-stock flow and the existing tests. Flag this explicitly in the proposal for user confirmation.

`moverBotellon`'s side-effects stay: entregado requires clienteId (L220-224), recibido clears cliente/fecha_entrega (L225-228). Both are orthogonal to the validation rule.

### 3. Realtime

**Publication status:** no migration does `ALTER PUBLICATION supabase_realtime ADD TABLE` (grep across supabase/ = zero matches). The existing alert-panel/bell subscribers therefore depend on the publication having been configured out-of-band (dashboard toggle) — which is exactly why coverage is unreliable. **Recommend a new migration `0010_supabase_realtime_tables.sql`:**

```sql
-- 0010: expose state-tracking tables to Realtime (postgres_changes)
ALTER PUBLICATION supabase_realtime ADD TABLE public.botellones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recargas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.premios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
```

`ALTER PUBLICATION ... ADD TABLE` on an already-member table is a no-op, so this is safe even where the dashboard already added them.

**Subscription shapes:**
- Detail page: `postgres_changes`, `{ event: 'UPDATE', schema: 'public', table: 'botellones', filter: 'id=eq.' + botellon.id }` — the exact filter pattern bell.tsx L118-121 uses for `usuario_id=eq.${userId}`. Host it in a client component: `page.tsx` is a server component (force-dynamic, L10), so the subscription must live in `form.tsx` (already 'use client', receives botellon) or a small dedicated `estado-en-vivo.tsx` badge component. On payload, update the rendered estado badge + selector options.
- Kanban: `OperacionesDashboard` is already 'use client' and holds `botellones` in useState (L31). Subscribe to `{ event: 'UPDATE', schema: 'public', table: 'botellones' }` (no filter — needs all rows) and patch the matching row's `estado`/`cliente_id`/`fecha_entrega` in state. Cleanup via `supabase.removeChannel` in the effect return (mirror alert-panel L101-105).
- `recargasHoy` KPI (L32, L83) is not covered by botellones UPDATE events — optional extra: a recargas INSERT subscription; default scope = skip (note in design).

**Optimistic-UI conflict (kanban):** kanban already optimistically moves cards (L60-62, L76-82). The realtime echo of your own write is harmless because the patch is idempotent (setting estado to the same value). Two real conflicts to handle: (1) an optimistic move that the server rejects currently calls `router.refresh()` (L66) — with realtime the canonical state may arrive before/after the refresh; apply the realtime patch on every payload regardless, and keep refresh only as the error fallback; (2) two operators moving the same card is last-write-wins — realtime converges both screens, and the `.eq('estado', current)` CAS guard makes the loser's write fail cleanly with a visible error.

**RLS confirm — YES, browser client will receive postgres_changes:** the browser client (client.ts L24) authenticates with the user's session JWT (role=authenticated, app_metadata.role claim present in the token). Realtime applies RLS policies to the change stream, and `admin_select_botellones` (0001 L280-282) / `repartidor_select_botellones` (0001 L388-390) pass for both roles. Non-blocking caveat: `repartidor` has NO UPDATE policy on botellones (0001 — only recargas update/delete, L426-445), but writes go through server actions that use `SUPABASE_SERVICE_ROLE_KEY || publishable key` (botellones.ts L27), which bypasses RLS — so realtime RECEIVE works for both roles regardless. Also note the anon `public_select_botellones` (L452-458) is column-restricted and irrelevant to the authenticated pages.

### 4. Tests

Realtime transport is NOT unit-testable (needs a live Supabase project). Test boundary: pure functions + component behavior with a mocked channel.

- **tests/unit/estados.test.ts** — new describe blocks:
  - `getReversiones` exact sets per estado, including `entregado → ['listo', 'delivery']` (user choice) and `recibido → ['entregado']`.
  - Invariant test: for all `a, b ∈ ESTADOS`: `b ∈ getTransiciones(a) ⟺ a ∈ getReversiones(b)` (relation is a perfect inverse — guards against drift between the two maps).
  - `getEstadosPermitidos`: union + dedup (e.g. entregado → ['recibido','listo','delivery'], no duplicates; no estado is terminal).
- **tests/unit/botellones-estado.test.ts** — new describe blocks for server validation:
  - rejects a non-permitted estado with an error and NO DB write (e.g. moverBotellon from entregado → 'recarga');
  - accepts a forward move (recibido → recarga) and a reversal (recarga → recibido);
  - accepts both entregado reversals (listo and delivery);
  - asserts the conditional guard: update called with `.eq('estado', currentEstado)` after the id filter;
  - client-assignment override still forces entregado (existing tests L105-141 must keep passing — the exception is part of the design);
  - updateBotellon validates the submitted estado when NO client is assigned.
  - Note for implementer: the chain mock (makeChain L46-55) queues one chain per `from()` call; validation adds a SELECT, so tests must queue TWO chains (select returning current estado, then update).
- **Component-level (optional but recommended):** mock `@supabase/ssr`/createClient (pattern: tests/mocks, chain mocks) and assert that dispatching a fake `RealtimePostgresChangesPayload` through the channel callback updates the detail badge / moves the kanban card. No real WS transport involved.

## Files Likely to Change

- `src/lib/utils/estados.ts` — add REVERSIONES, getReversiones, getEstadosPermitidos (pure machine additions).
- `src/lib/db/botellones.ts` — updateBotellon + moverBotellon: read current estado, validate via getEstadosPermitidos, conditional `.eq('estado', current)` update; document the client-assignment exception.
- `src/app/(dashboard)/botellones/[id]/page.tsx` — pass reversiones/permitidos into the form (replace/augment the `transiciones` prop at L21-23, L62).
- `src/app/(dashboard)/botellones/[id]/form.tsx` — optgroup UI (Avanzar/Deshacer), remove terminal-state branch (L53-55), reconcile realtime estado (controlled select or dedicated badge component).
- `src/components/dashboard/operaciones-dashboard.tsx` — realtime UPDATE subscription + idempotent state patch; keep optimistic updates; error path unchanged.
- NEW `src/components/.../estado-realtime.tsx` (or inline in form.tsx) — detail-page postgres_changes subscriber.
- `supabase/migrations/0010_supabase_realtime_tables.sql` — ALTER PUBLICATION ADD TABLE × 4.
- `tests/unit/estados.test.ts`, `tests/unit/botellones-estado.test.ts` — reversal + validation tests.
- Optional: `tests/component/` realtime payload tests.

## Risks

- CRITICAL — client-assignment override vs strict machine: forcing `entregado` on client assignment (botellones.ts L146-151) conflicts with validation; must be a documented exception or the sell-stock flow (and existing tests) break. Needs explicit user confirmation in proposal.
- WARNING — publication state unverifiable locally: no Supabase MCP/CLI connected this session; migration 0010's idempotent ADD TABLE is the safe fix regardless of whether the dashboard already configured tables.
- WARNING — detail form is defaultValue-driven (form.tsx L46, L64) + useActionState; realtime state needs a reconciliation decision (controlled select vs dedicated live badge) to avoid the badge/selector disagreeing with server revalidation.
- WARNING — kanban optimistic updates echo via realtime; patch must be idempotent and realtime must not fight `router.refresh()` on rejected moves (operaciones-dashboard.tsx L64-67).
- WARNING — TOCTOU between SELECT current and UPDATE; closed by the `.eq('estado', current)` CAS guard.
- WARNING — repartidor has no UPDATE policy on botellones; fine today (service-role server actions) but any future browser-client write will fail — note for the design.
- NOTE — `recargasHoy` KPI won't go live without an extra recargas INSERT subscription; default out of scope.

## Ready for Proposal

Yes. Two design decisions to surface to the user in the proposal: (a) confirm the client-assignment (sell-stock) exception to the strict machine; (b) choose the detail-page realtime UI shape (dedicated live badge component vs controlled select). Everything else is settled by this exploration.