# Design: Estado reversions, server-side validation, realtime updates

## Technical Approach

Three compounding gaps closed in one coherent slice: (1) **reversions** — a `REVERSIONES` map (immediate-previous inverse of `TRANSICIONES`) plus `getEstadosPermitidos()` as the single manual-move rule, so no estado is terminal and a mistake is undone in one click; (2) **server validation** — `updateBotellon`/`moverBotellon` read the current row, validate against `getEstadosPermitidos` (with a precise sale-exception carve-out), and write with a CAS guard `.eq('id', id).eq('estado', current)`, mirroring `registrarOperacion`'s conditional-guard pattern; (3) **realtime** — `postgres_changes` subscriptions on the detail page (filter `id=eq.X`, UPDATE) and kanban (UPDATE, no filter) following the proven alert-panel/bell subscriber patterns, with migration 0010 making publication membership declarative and idempotent.

Next.js API surface checked against `node_modules/next/dist/docs`: `useActionState` semantics are standard React 19 in this modified build — the form keeps its existing usage; the new reconciliation is plain React state (controlled selects), no new Next.js APIs introduced.

## Architecture Decisions

| # | Decision | Alternatives | Rationale |
|---|---|---|---|
| D1 | Separate `REVERSIONES` map + `getReversiones()`/`getEstadosPermitidos()` in `estados.ts` | Unified map with direction flag; SQL CHECK for transitions | Zero impact on `getTransiciones` consumers (page.tsx L21, estados.test.ts); machine stays TS-owned (0009 CHECK pins only the enum); inversion-invariant test guards drift |
| D2 | Validation orchestration in `botellones.ts`; pure helpers in `estados.ts` | Validation in SQL; validation inline in each writer | Pure machine stays dependency-free; both writers share one read-validate-write helper; SQL cannot express TS-owned domain logic cleanly |
| D3 | **Hybrid** detail UI: dedicated `estado-en-vivo.tsx` subscriber + **controlled-until-dirty** reconciliation (`value = draft ?? live`) | (a) fully controlled select; (b) badge-only live component | (a) clobbers an operator's in-progress selection when another operator's UPDATE arrives; (b) leaves selector options stale — spec R2 requires the selector to reflect live estado (Avanzar/Deshacer groups derive from live). Hybrid: badge always canonical, select follows live unless the operator holds an unsubmitted draft |
| D4 | CAS miss detected via `.select()` on the UPDATE chain: empty `data` ⇒ "Transición no permitida" | Rely on `error` only | supabase-js returns `{ data: [], error: null }` for a zero-row conditional UPDATE — without the count check, spec S7 (loser gets the error) fails silently |
| D5 | Kanban: **patch-always, refresh-error-only**; idempotent 3-column patch | Realtime-gated refresh; drop optimistic moves | Patch every payload (echo of own write is a semantic no-op); `router.refresh()` stays only in the server-rejection path (L64-67); both converge to canonical state |
| D6 | Card select becomes controlled `value={b.estado}` | Keep `defaultValue` | `BotellonCard` is keyed by `b.id`, so `defaultValue` never re-applies when realtime moves the card to another column — the internal select would show a stale estado. Controlled select makes state the single source of truth |
| D7 | Sale exception = **clientless→assigned only**; both-set→assigned validates strictly | Exception on any client assignment | Locked decision 3 ("assigning a client to a clientless botellon"); re-assigning a different client on an already-delivered botellon is not a sale-from-stock — it must not bypass the machine |
| D8 | `page.tsx` stops passing `transiciones`; form computes Avanzar/Deshacer groups client-side from **live** estado | Pass precomputed permitted arrays | Realtime changes the estado after RSC render; precomputed props would go stale. `estados.ts` is client-safe (already imported by form.tsx) |

## Module-by-Module Design

### `src/lib/utils/estados.ts` (Modify — additive, pure)

```ts
const REVERSIONES: Record<Estado, Estado[]> = {
  entregado: ['listo', 'delivery'],
  recibido:  ['entregado'],
  recarga:   ['recibido'],
  listo:     ['recarga'],
  delivery:  ['listo'],
};
export function getReversiones(estado: Estado): Estado[] {
  return REVERSIONES[estado] || [];
}
export function getEstadosPermitidos(estado: Estado): Estado[] {
  return [...new Set([...getTransiciones(estado), ...getReversiones(estado), estado])];
}
```

Every estado has ≥1 reversion → nothing is terminal; the identity term keeps the selector non-empty and satisfies spec R1/S8. Header doc comment updated to mention reversions.

### `src/lib/db/botellones.ts` (Modify — both writers + helpers)

New module-private helpers, shared by both writers:

```ts
async function leerActual(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from('botellones')
    .select('estado, cliente_id').eq('id', id).single();
  return { actual: data?.estado as Estado | undefined, clienteActual: data?.cliente_id ?? null, error };
}

/** Returns null when the move is valid, else the exact error string. */
function validarDestino(actual: Estado, destino: string, asignando: boolean): string | null {
  if (asignando) {
    // Sale exception: clientless→assigned allows {entregado, recarga}; identity too.
    const valido = destino === actual || destino === 'entregado' || destino === 'recarga';
    return valido ? null : `Transición no permitida: ${actual} → ${destino}`;
  }
  const permitidos = getEstadosPermitidos(actual);
  return permitidos.includes(destino as Estado) ? null : `Transición no permitida: ${actual} → ${destino}`;
}
```

CAS write shape (both writers, identical guard):

```ts
const { data, error } = await supabase.from('botellones')
  .update(update).eq('id', id).eq('estado', actual).select();
if (error) return { error: error.message };
if (!data || data.length === 0) return { error: `Transición no permitida: ${actual} → ${destino}` }; // CAS miss
```

**`updateBotellon` (L131-162)** — reads current row first, then:
- `asignando = cliente_id !== null && clienteActual === null` (D7 — clientless→assigned only).
- If `asignando`: `destino = (estado submitted ∈ {entregado, recarga}) ? estado : 'entregado'` (default per locked decision 3); update = `{ cliente_id, estado: destino }`; machine-exempt (skip strict check).
- If not asignando: validate the submitted `estado` strictly via `validarDestino(actual, estado, false)` (identity allowed); update carries `estado` and/or `cliente_id` as today (unassign keeps estado — existing R4 S3 semantics preserved).
- All writes go through the CAS shape; failure returns the error with zero writes.

**`moverBotellon` (L210-238)** — reads current row first; side effects stay (entregado requires clienteId + stamps `fecha_entrega` L220-224; recibido clears cliente/fecha L225-228 — orthogonal to validation):
- `asignando = clienteId !== null && clienteActual === null`.
- If `asignando` and `nuevoEstado ∈ {entregado, recarga}` → exception (no strict check).
- Otherwise strict validation via `validarDestino(actual, nuevoEstado, false)`.
- CAS write identical to above.

Both writers call `revalidatePath` only after a successful (non-empty) CAS result.

### `src/components/dashboard/estado-en-vivo.tsx` (New — detail-page subscriber)

```tsx
'use client';
type Props = {
  botellonId: string;
  estado: Estado;
  clienteId: string | null;
  fechaEntrega: string | null;
  onLiveChange: (live: { estado: Estado; clienteId: string | null; fechaEntrega: string | null }) => void;
};
```

- Uses the singleton browser client `createClient()` from `@/lib/supabase/client`.
- `useEffect` (mounted once): `supabase.channel('estado-botellon-' + botellonId).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'botellones', filter: \`id=eq.${botellonId}\` }, handler).subscribe(status => ...)` — the exact bell.tsx L113-147 shape.
- Handler: guards `payload.new.estado ∈ ESTADOS`, then `setLive` locally and calls `onLiveChange`.
- Silent degradation: `CHANNEL_ERROR`/`TIMED_OUT` → `console.warn` only (bell.tsx L142-147 pattern); last rendered state stays.
- Cleanup: `supabase.removeChannel(channel)` in the effect return (spec R2/S5).
- Renders the canonical live badge (`ESTADO_COLORS`/`ESTADO_LABELS`, replacing form.tsx L33-38) — always canonical even while the operator drafts.

### `src/app/(dashboard)/botellones/[id]/form.tsx` (Modify — reconciliation + optgroups)

- Props: drop `transiciones` (D8); keep `botellon`/`clientes`.
- State: `live` (from `useState` initial + `onLiveChange`), `draftEstado: string | null`, `draftCliente: string | null`.
- Selects become controlled-until-dirty: `value={draftEstado ?? live.estado}`, `onChange={e => setDraftEstado(e.target.value)}` (same for cliente_id with `?? live.clienteId ?? ''`).
- On `state?.success` (useActionState): `setDraftEstado(null); setDraftCliente(null)` — select snaps back to live, which the server revalidation + realtime echo have already converged.
- On `state?.error`: draft kept — operator sees the attempted value + the "Transición no permitida" message; badge still shows canonical.
- Option groups derived from **live** estado: identity option first `(actual)`, then `<optgroup label="Avanzar">` from `getTransiciones(live.estado)`, `<optgroup label="Deshacer">` from `getReversiones(live.estado)` (both exclude identity). Remove the terminal-state hint (L53-55) — nothing is terminal anymore.
- `estado`/`cliente_id` inputs keep their `name` attributes so the existing `updateBotellon` formData contract is unchanged.

### `src/app/(dashboard)/botellones/[id]/page.tsx` (Modify)

- L21-23: remove `getTransiciones`/`transiciones` prop (D8); pass `botellon` unchanged. Form derives groups itself.

### `src/components/dashboard/operaciones-dashboard.tsx` (Modify — realtime patch)

- New `useEffect` (mounted once): `supabase.channel('kanban-botellones').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'botellones' }, handler).subscribe(status => ...)`; no filter (needs all rows); silent degradation + `removeChannel` cleanup (alert-panel L88-105 pattern).
- Patch shape (idempotent):

```ts
const patch = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
  const nuevo = payload.new as Record<string, unknown> | undefined;
  if (!nuevo?.id) return;
  setBotellones(prev => prev.map(b => {
    if (b.id !== nuevo.id) return b;
    const clienteId = (nuevo.cliente_id as string | null) ?? null;
    const clientes = clienteId === b.cliente_id ? b.clientes : clienteId ? { nombre: '' } : null;
    return { ...b, estado: nuevo.estado as string, cliente_id: clienteId, fecha_entrega: (nuevo.fecha_entrega as string | null) ?? null, clientes };
  }));
};
```

  - **Idempotence**: realtime sends row columns only (no `clientes` join); when `cliente_id` is unchanged we keep the existing join object, so echoes of the operator's own optimistic writes (which carry `clientes.nombre` from the local list) are preserved and the patch is a semantic no-op; React reconciliation then bails out visually.
  - **Client-name degradation**: a client assigned by *another* operator arrives without the name → `{ nombre: '' }`; the "En circulación" render (L207) becomes `b.clientes?.nombre || (b.cliente_id ? 'Cliente asignado' : 'Sin cliente')`. Documented, acceptable.
- `router.refresh()` (L66) stays ONLY in the `res.error` path — patch-always means the realtime payload (when a concurrent writer succeeded) converges the card; refresh restores canonical when the rejection was a pure validation failure (no write → no event). Both converge to the same canonical data; a stale payload after refresh is a transient flicker, next event re-converges.
- `BotellonCard` select (L278-286) → controlled `value={b.estado}` (D6).
- `confirmAssign` increments `recargasHoy` locally (L83) — pre-existing, untouched (recargasHoy live count is out of scope).

### `supabase/migrations/0010_supabase_realtime_tables.sql` (New)

```sql
-- 0010: expose state-tracking tables to Realtime (postgres_changes).
-- Idempotent: ALTER PUBLICATION ... ADD TABLE on an already-member table is a no-op.
ALTER PUBLICATION supabase_realtime ADD TABLE public.botellones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recargas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.premios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
```

Covers the four tables the existing alert-panel/bell subscribers (and the new ones) consume. Verified: zero migrations configure the publication today.

## Data Flow

```
Operator (detail form / kanban)
   │  submit move (server action)
   ▼
botellones.ts writer ── leerActual(id) ──> SELECT estado, cliente_id
   │  validarDestino(actual, destino, asignando)   ← pure estados.ts helpers
   │  invalid → return "Transición no permitida: <actual> → <destino>"   (zero writes)
   ▼
UPDATE botellones SET ... WHERE id = ? AND estado = <actual>   (CAS)
   │  data.length === 0 → CAS miss → same error string (concurrent loser, spec S7)
   ▼
Postgres commit → supabase_realtime publication → postgres_changes broadcast (RLS-filtered)
   ├── detail page:   estado-en-vivo.tsx  → onLiveChange → form live state → badge + select + optgroups
   └── kanban:        operaciones-dashboard.tsx → setBotellones patch (idempotent) → card moves column
```

## Error Handling

| Failure | Where | Behavior |
|---|---|---|
| Validation failure | writer pre-write | `'Transición no permitida: <actual> → <destino>'`, zero DB writes; form shows error block + keeps draft; kanban flashToast + `router.refresh()` |
| CAS miss (concurrent move) | writer post-write | Same error string (spec S7); loser's screen converges via winner's realtime event |
| Channel `CHANNEL_ERROR`/`TIMED_OUT` | subscribers | `console.warn` only (bell.tsx pattern); last rendered state persists; next mount retries |
| Unmount | subscribers | `removeChannel` in effect cleanup (spec R2/S5, R3) |
| Unknown estado in payload | subscriber guard | `estado ∈ ESTADOS` check drops the payload — future estados never crash the UI |
| Client name missing (other-operator assign) | kanban patch | `{ nombre: '' }` → "Cliente asignado" fallback until refresh |

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit — estados.ts | `getReversiones` exact sets (incl. `entregado → ['listo','delivery']`, `recibido → ['entregado']`); `getEstadosPermitidos` dedup union + identity (`entregado → ['recibido','listo','delivery']`, no dupes); **inversion invariant** `b ∈ getTransiciones(a) ⟺ a ∈ getReversiones(b)` for all a,b; no terminal estado | Additive describes in `tests/unit/estados.test.ts` |
| Unit — writers | Validation: rejects `recibido → listo` with exact error and NO `update` call (queue only the SELECT chain; assert `supabase.from` called once); forward + reversal accepted (`recibido → recarga`, `recarga → recibido`); both entregado reversions; identity move; **CAS guard asserted**: `update(...)` then `.eq('id', id)` + `.eq('estado', current)`; **CAS-miss test**: SELECT chain returns current, UPDATE chain returns `{ data: [], error: null }` → error string; sale exception: clientless→assigned accepts `entregado` and `recarga`, defaults invalid submitted destino to `entregado`, both-set→assigned validates strictly | Rewrite `tests/unit/botellones-estado.test.ts`: **every existing update/move test queues TWO chains** (SELECT current → UPDATE result) via `makeSupabase([selectChain, updateChain])` (makeChain L46-55 supports the queue); L126-141 override test rewritten per D7 semantics; L105-124 keeps passing with the added SELECT chain |
| Component (recommended) | Mock `@supabase/ssr` `createBrowserClient` (pattern: `tests/mocks/server-only.ts`) with a fake channel object; dispatch a synthetic `RealtimePostgresChangesPayload` through the callback → assert badge text updates / kanban card moves column; assert `removeChannel` on unmount | New `tests/component/estado-en-vivo.test.tsx` + kanban realtime test (no real WS transport) |
| Untested | Realtime transport itself (needs a live Supabase project); publication membership | Manual: apply 0010, verify `ALTER PUBLICATION` membership, two-browser live check |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Migration 0010 is additive and idempotent (no data migration; `DROP TABLE` from the publication reverses membership). Rollback per proposal: (3) UI/realtime + 0010, (2) validation/CAS, (1) pure maps — each slice independently revertible; single-function revert of `updateBotellon` restores force-to-`entregado` if the carve-out misbehaves. Work-unit commits per `work-unit-commits`: machine+tests, writers+tests, realtime+migration+tests, UI — each with verification in the same unit.

## Risks / Edge Cases

- **R1 (CRITICAL)** Sale-exception precision (D7): clientless→assigned only. Both-set→assigned bypassing the machine would silently enable invalid estado writes — covered by dedicated tests.
- **R2** Existing `botellones-estado.test.ts` queues ONE chain; the added SELECT exhausts the queue → every writer test updated to two chains (mechanically identical to the makeChain pattern).
- **R3** Realtime payload lacks `clientes` join → kanban client-name degradation for other-operator assigns ("Cliente asignado" fallback); accepted, documented.
- **R4** Publication state unverifiable locally (no Supabase MCP/CLI this session): 0010's idempotent ADD TABLE is the safe fix regardless of out-of-band dashboard state; verify membership post-apply.
- **R5** Realtime echo vs `router.refresh()` race on rejected moves: patch-always + refresh-error-only converge to canonical; transient flicker if a stale payload lands after refresh — next event re-converges.
- **R6** `repartidor` has no botellones UPDATE policy (0001): writes flow via service-role server actions (RLS-bypass), realtime RECEIVE is SELECT-policy-gated and passes for both roles (spec R4). Any future browser-client write will fail — documented, out of scope.
- **R7** Filter injection in `id=eq.${botellonId}`: `id` is a route param (UUID) — safe; keeps bell.tsx's string-interpolation pattern.

## Open Questions

None blocking. D3 (detail UI shape), D7 (sale-exception boundary), and D4 (CAS-miss detection) resolve the explore/proposal flags.