# Proposal: Estado reversions, server-side validation, realtime updates

## Intent

Three compounding gaps today: (1) a mistaken estado move has **no undo** — the selector only offers forward transitions, so an operator who mis-advances `entregado → recibido` must click forward 4 more times; (2) **no server validation** — `updateBotellon`/`moverBotellon` (src/lib/db/botellones.ts L131-162, L210-238) write any estado verbatim, the machine lives only in the client UI; (3) **stale UI** — neither the detail page nor the kanban receives live updates, other browsers stay frozen until F5 (both rely on RSC revalidation alone).

## Scope

### In Scope
- `estados.ts`: add `REVERSIONES` map, `getReversiones()`, `getEstadosPermitidos()` (dedup union forward+reversal — single source for selector UI AND server rule).
- Server validation + CAS in `updateBotellon`/`moverBotellon`: read current estado → validate via `getEstadosPermitidos` → conditional `.eq('estado', current)` update (mirrors `registrarOperacion`'s `.in('estado', sources)` guard). No DB write on invalid.
- Client-assignment exception (locked): assigning a client to a **clientless** botellón allows destino `entregado` OR `recarga` (sale destinations, machine-exempt); replaces the old unconditional force-to-`entregado`.
- Realtime via `postgres_changes` (NOT webhooks): detail page (UPDATE, `id=eq.<id>` filter) + kanban (UPDATE, no filter) — mirroring alert-panel.tsx L88-99 / bell.tsx L113-147 patterns. Migration `0010_supabase_realtime_tables.sql`: add `botellones`, `recargas`, `premios`, `notificaciones` to `supabase_realtime` (verified: zero migrations configure it today).
- Selector UI: single `<select>` with `<optgroup label="Avanzar">` / `<optgroup label="Deshacer">` (current estado first, plain option); remove obsolete terminal-state hint (form.tsx L53-55).
- Tests: reversal/invariant/permitted unit tests; server-validation + CAS tests; optional component tests with mocked channel payloads.

### Out of Scope
- `recargasHoy` KPI live count (needs a separate recargas INSERT subscription — separate change).
- PWA / service-worker changes; e2e (realtime transport not unit-testable; needs a live Supabase project).
- `registrarOperacion`/carga-terminal guards unchanged (op-scoped `.in('estado', sources)` stays).
- No new estados, no schema data changes, no webhooks, no SQL-level transition check.

## Business Rules (locked)

1. **Strict forward machine unchanged**: `entregado → recibido → recarga → listo → entregado` + `listo → delivery → entregado`.
2. **Reversion set** (immediate-previous inverse, user picks for `entregado`): `entregado: ['listo','delivery']`, `recibido: ['entregado']`, `recarga: ['recibido']`, `listo: ['recarga']`, `delivery: ['listo']`.
3. **Exception (new)**: assigning a client to a stock (clientless) botellón may set destino `entregado` OR `recarga` — machine-exempt. All other manual estado changes validate strictly against `getEstadosPermitidos(current)`. Identity (destino == current) is always permitted.
4. **Server rule**: `nuevoEstado ∈ getEstadosPermitidos(currentEstado)` (or the assignment exception); write guarded by `.eq('id', id).eq('estado', current)` CAS. Failure returns `'Transición no permitida: <actual> → <destino>'` with zero DB writes.
5. **Realtime**: `postgres_changes` subscriptions; migration 0010 is idempotent (`ALTER PUBLICATION ... ADD TABLE` on a member is a no-op).
6. **Delivery**: auto mode, hybrid store, ask-always for PRs, 400-line review budget.

## User Stories / Scenarios

- **Undo an error**: an operator mis-advances `entregado → recibido` on the detail page; the selector now shows a "Deshacer" group with `listo`/`delivery` for `entregado`, so the mistake is undone in one click.
- **Live update across devices**: two operators watch the kanban; one moves a card, the other sees the card move within seconds — no F5.
- **Sell stock direct to entregado or recarga**: a clientless stock botellón in `listo` is assigned to a client; the form accepts `entregado` AND `recarga` as sale destinations; both persist.
- **Invalid manual move rejected**: `recibido → listo` is submitted; the server returns "Transición no permitida" and writes nothing (error surfaces in form/toast).
- **Concurrent moves (CAS)**: two operators move the same card to different columns; the loser's write aborts cleanly with a visible error and both screens converge via realtime.

## Capabilities

### New Capabilities
- `realtime-estado-botellon`: live estado/client/fecha_entrega updates on botellón detail + kanban via `postgres_changes` (publication 0010, subscription shapes, idempotent state patch, channel cleanup).

### Modified Capabilities
- `botellon-ciclo-estados`: machine gains `REVERSIONES`/`getEstadosPermitidos` as the single manual-move rule; `updateBotellon`/`moverBotellon` enforce it server-side with a CAS guard; stock-assign semantics broaden from force-`entregado` to `{entregado, recarga}` exception.

## Approach

Pure TS additions in `estados.ts` (REVERSIONES/getReversiones/getEstadosPermitidos); read-validate-write orchestration in `botellones.ts` (already owns the supabase client); realtime subscriptions in the two client components, following the existing alert-panel/bell subscriber patterns with `removeChannel` cleanup and silent degradation on CHANNEL_ERROR/TIMED_OUT. Migration 0010 makes publication membership declarative and idempotent.

## Approach Comparison

| Decision | Chosen | Why |
|---|---|---|
| Reversal modeling | Separate `REVERSIONES` map | Zero impact on `getTransiciones` consumers (page.tsx L21, estados.test.ts); undo is semantically distinct from advance; inversion invariant test guards drift |
| Server write | CAS `.eq('estado', current)` | Mirrors `registrarOperacion`'s `.in('estado', sources)`; closes the SELECT→UPDATE TOCTOU; loser of a concurrent move fails cleanly |
| Realtime transport | `postgres_changes` | Existing infra + patterns (alert-panel/bell); event-driven, RLS-filtered, no polling load/latency |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/lib/utils/estados.ts` | Modified | +REVERSIONES, getReversiones, getEstadosPermitidos |
| `src/lib/db/botellones.ts` | Modified | updateBotellon/moverBotellon: read current → validate → `.eq('estado', current)` CAS; assignment exception carve-out |
| `src/app/(dashboard)/botellones/[id]/page.tsx` | Modified | pass `getEstadosPermitidos(estado)` to form (replace/augment `transiciones` prop) |
| `src/app/(dashboard)/botellones/[id]/form.tsx` | Modified | Avanzar/Deshacer optgroups; drop terminal-state branch; realtime reconciliation |
| `src/components/dashboard/operaciones-dashboard.tsx` | Modified | postgres_changes UPDATE subscription + idempotent patch; keep optimistic moves; refresh stays error fallback |
| NEW `src/components/dashboard/estado-en-vivo.tsx` | New | detail-page subscriber (badge/selector live update) |
| `supabase/migrations/0010_supabase_realtime_tables.sql` | New | ALTER PUBLICATION supabase_realtime ADD TABLE public.botellones; ... public.recargas; ... public.premios; ... public.notificaciones (4 statements, idempotent) |
| `tests/unit/estados.test.ts` | Modified | additive: reversal sets, inverse invariant, permitted union |
| `tests/unit/botellones-estado.test.ts` | Modified | validation/CAS tests; existing tests gain a 2nd chain (SELECT + update); assignment-override test rewritten |

## Risks

| Risk | Tier | Mitigation |
|---|---|---|
| Client-assignment exception vs strict machine — carve-out must be precise or sell-stock flow/tests break | CRITICAL | Locked rule: clientless→assigned allows `{entregado, recarga}`; default `entregado` when no valid destino submitted. Existing test "estado=recibido + client → entregado wins" (L126-141) now contradicts the rule → rewrite; L105-124 keeps passing |
| Existing `botellones-estado.test.ts` tests queue ONE chain; validation SELECT adds a second → "queue exhausted" failures | WARNING | Update every updateBotellon/moverBotellon test to queue two chains (current row, then update result) |
| Publication state unverifiable locally (no Supabase MCP/CLI connected) | WARNING | 0010 idempotent ADD TABLE is the safe fix; verify membership post-apply |
| Detail form is defaultValue-driven + useActionState; realtime needs a reconciliation decision (controlled select vs dedicated live badge) | WARNING | Flag to design phase; badge component decouples live state from form state |
| Kanban optimistic echo must be idempotent; realtime vs `router.refresh()` on rejected moves | WARNING | Patch state on every payload (idempotent); keep refresh only as error fallback (operaciones-dashboard L64-67) |
| TOCTOU between SELECT current and UPDATE | WARNING | Closed by CAS guard |
| `repartidor` has no botellones UPDATE policy | NOTE | Writes go via service-role server actions (bypasses RLS); any future browser-client write will fail — document in design |

## Non-goals / Constraints

- No undo history/audit trail of moves; reversions are single-step (immediate-previous only).
- No PWA/service-worker offline sync; no e2e coverage for realtime.
- No RLS policy changes; no SQL-level transition enforcement (TS-owned domain logic; CHECK constraint only pins the enum).
- `getTransiciones`/`OPERACIONES`/`registrarOperacion` contract unchanged.

## Rollback Plan

- Code: revert in reverse order — (3) UI/realtime subscriptions + 0010 migration, (2) server validation/CAS, (1) pure maps (additive, safe to keep). Each slice is independently reversible.
- Migration 0010: `ALTER PUBLICATION supabase_realtime DROP TABLE ...` reverses membership; no data migration involved — non-destructive.
- If the exception carve-out misbehaves, restore force-to-`entregado` in `updateBotellon` alone (single-function revert).

## Dependencies

- Supabase project with Realtime enabled (dashboard toggle) — 0010 idempotent ADD TABLE works regardless of current out-of-band state.
- No new packages (supabase-js + @supabase/ssr already present).
- Live verification of publication membership post-apply.

## Success Criteria

- [ ] `REVERSIONES`/`getEstadosPermitidos` exact per locked sets; inversion invariant test green
- [ ] `updateBotellon`/`moverBotellon` reject non-permitted moves with "Transición no permitida" and zero DB writes
- [ ] CAS guard (`.eq('estado', current)`) present in both writers
- [ ] Client assignment to stock accepts `entregado` OR `recarga`; non-assignment writes validate strictly
- [ ] Migration 0010 applied and idempotent; publication membership verified post-apply
- [ ] Detail page + kanban live-update on UPDATE events from another device (no F5)
- [ ] Existing suites green after test updates (estados.test.ts additive; botellones-estado.test.ts 2-chain + rewritten override test)
- [ ] Selector renders Avanzar/Deshacer optgroups; no estado is terminal