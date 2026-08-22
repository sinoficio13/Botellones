# Tasks: Estado reversions, server-side validation, realtime updates

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450 (180 + 270) |
| 400-line budget risk | **High** (whole change over budget) |
| Chained PRs recommended | **Yes** |
| Suggested split | Commit 1 backend/pure machine → Commit 2 realtime+UI, direct to main |
| Delivery strategy | auto-mode, hybrid store, ask-always PRs, 400-line budget |
| Chain strategy | stacked-to-main (two independent, sequential commits) |

Decision needed before apply: **YES — budget guard triggers.**
- Estimated whole change ~450 changed lines exceeds the 400-line review budget.
- Two commit slices are each independently revertible and reviewable (180 / 270 lines).
- Recommended: promote each commit to its own PR (stacked-to-main), OR accept a `size:exception` for a single combined PR. Both are legitimate; the orchestrator must choose before apply because delivery is `ask-always`. Default recommendation: **two chained PRs** (Commit 1 → Commit 2) to keep each slice under ~60 min review.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Pure machine + server validation/CAS + sale exception | Commit 1 | `npx vitest run tests/unit/estados.test.ts tests/unit/botellones-estado.test.ts` | N/A DB-write (server actions behind supabase-js mock); `npx vitest run` green at commit boundary | `git revert commit 1` — no schema/migration impact (pure TS + tests) |
| 2 | Realtime + migration 0010 + selector UI | Commit 2 | `npx vitest run tests/component/estado-en-vivo.test.tsx tests/component/operaciones-realtime.test.tsx` | `npm run build` green; manual two-browser live check + 0010 membership verify post-apply | `git revert commit 2`; `ALTER PUBLICATION ... DROP TABLE` reverses 0010 membership |

---

## GAP resolutions (design-validator, non-blocking)

### GAP-1 — dead `asignando` branch in `validarDestino` → REMOVE the parameter

The design's `validarDestino(actual, destino, asignando)` carries an `asignando` branch that is **never reached**: in both writers the sale exception is resolved *before* calling the helper (`updateBotellon` defaults an invalid submitted destino to `entregado`; `moverBotellon` skips strict validation when `asignando && nuevoEstado ∈ {entregado, recarga}`).

**Decision: remove the `asignando` parameter entirely.** `validarDestino(actual, destino)` becomes a pure strict-machine check (`getEstadosPermitidos(actual)` + identity), with no dead branch. The sale exception stays explicit in the writers where the `clientless→assigned` boundary is known. Tests assert the helper is strict-only; the exception is exercised through the writers.

### GAP-2 — identity-on-assign asymmetry → shared assignment resolver

Design's `updateBotellon` assign path (default-to-`entregado`) and `moverBotellon` assign path (skip check when `{entregado, recarga}`) differ on identity. Locked rule 3: on clientless→assigned, `{entregado, recarga}` OR **identity** are permitted; strict machine otherwise.

**Decision: one shared module-private helper resolves the assignment destino identically in both writers:**

```ts
// Returns the resolved sale destino or null (treat strictly).
function resolverDestinoAsignacion(actual: Estado, destino: string | null): string | null {
  if (destino === actual) return actual;                 // identity permitted on assign
  if (destino === 'entregado' || destino === 'recarga') return destino; // sale exception
  return 'entregado';                                    // locked default
}
```

Both `updateBotellon` and `moverBotellon` call it when `asignando` (clientless→assigned). Result: symmetric identity handling (assigning a client to an already-`entregado`/`recarga` botellon keeps that estado, not a force-to-`entregado`), and a single code path to test. Non-assignment writes validate strictly via `validarDestino(actual, destino)`.

---

## Commit 1 — Pure machine + server validation/CAS + sale exception (~180 lines) — Strict TDD, RED first

- [x] 1.1 RED `tests/unit/estados.test.ts` (additive): `getReversiones` exact sets — `entregado→['listo','delivery']`, `recibido→['entregado']`, `recarga→['recibido']`, `listo→['recarga']`, `delivery→['listo']`; `getEstadosPermitidos('entregado')` → `['recibido','listo','delivery','entregado']` dedup+identity (spec S2/S3); **inversion invariant** `b ∈ getTransiciones(a) ⟺ a ∈ getReversiones(b)` over all a,b (spec S4); **no terminal estado** (every estado has ≥1 reversion)
- [x] 1.2 RED `tests/unit/botellones-estado.test.ts` (rewrite, two-chain migration + new): migrate **every** existing update/move test to queue TWO chains via `makeSupabase([selectChain, updateChain])` (SELECT current → UPDATE result) — R2 fix for "queue exhausted". Rewrite L126-141 assign-override test per GAP-2/D7 semantics (clientless→assigned accepts `entregado`/`recarga`/identity). Add: validation reject `recibido→listo` with exact `'Transición no permitida: recibido → listo'` AND zero `update` calls (only SELECT chain queued; assert `supabase.from` called once) (spec S5); forward `recibido→recarga` + reversal `recarga→recibido` both accepted (spec S6); **CAS-miss test** — SELECT returns `{estado:'recibido'}`, UPDATE chain returns `{data:[], error:null}` → error string (spec S7, design D4); identity move `listo→listo` accepted (spec S8); sale exception: clientless→assigned accepts `entregado` (S9) and `recarga` (S10), defaults invalid submitted destino to `entregado`, both-set→assigned validates strictly (S11/R1-D7); unassign leaves estado (MOD scenario); keep R4 S4 create-default test passing (add SELECT chain is not applicable to createBotellon)
- [x] 1.3 GREEN `src/lib/utils/estados.ts`: add `REVERSIONES` map (exact locked set), `getReversiones()`, `getEstadosPermitidos()` = dedup union of transiciones + reversiones + identity; update header doc to mention reversions; export the new functions
- [x] 1.4 GREEN `src/lib/db/botellones.ts`: add `leerActual(supabase, id)` (SELECT `estado, cliente_id`) and `validarDestino(actual, destino)` (strict-only per GAP-1) + `resolverDestinoAsignacion(actual, destino)` (per GAP-2); rework `updateBotellon` (L131-162) and `moverBotellon` (L210-238) to: read current → compute `asignando = cliente_id !== null && clienteActual === null` (D7) → resolve/validate destino → CAS write `.eq('id', id).eq('estado', actual).select()` (design D4: empty `data` ⇒ CAS miss error) → `revalidatePath` only on non-empty CAS result. Side effects preserved (entregado stamps `fecha_entrega`, recibido clears cliente/fecha — orthogonal)
- [x] 1.5 Verify: `npx vitest run tests/unit/estados.test.ts tests/unit/botellones-estado.test.ts` green (42/42); full `npx vitest run` green (214/214, no other suite regressed by the two-chain rewrite); `npx tsc --noEmit` clean
- [x] 1.6 Commit: `refactor(botellones): strict machine validation + reversions` (locked session plan message, commit `87df6b0`; tasks.md originally said `feat(botellones): ...` — locked plan overrides)

## Commit 2 — Realtime subscriptions + migration 0010 + selector UI (~270 lines) — Strict TDD, RED first

- [x] 2.1 RED `tests/component/estado-en-vivo.test.tsx` (new): mock `@/lib/supabase/client` `createClient` (pattern: `tests/mocks/server-only.ts`) with a fake channel object; dispatch a synthetic `RealtimePostgresChangesPayload` (`estado ∈ ESTADOS`) through the callback → assert badge text updates and `onLiveChange` fires; assert `removeChannel` called on unmount (spec R2/S5); assert `CHANNEL_ERROR`/`TIMED_OUT` → no crash, last state kept (spec S4); unknown estado in payload dropped (design error-handling)
- [x] 2.2 RED `tests/component/operaciones-realtime.test.tsx` (new): mock browser client + fake channel; dispatch UPDATE payload → assert the matching kanban card moves column and patch is idempotent (echo of own optimistic write leaves UI unchanged, spec R3/S7); other-operator assign without name → "Cliente asignado" fallback; `removeChannel` on unmount
- [x] 2.3 GREEN NEW `supabase/migrations/0010_supabase_realtime_tables.sql`: `ALTER PUBLICATION supabase_realtime ADD TABLE public.botellones; public.recargas; public.premios; public.notificaciones;` (4 statements, idempotent — ADD TABLE on a member is a no-op, spec R1/S1/S2). Style-reference: 0009 header comment block
- [x] 2.4 GREEN NEW `src/components/dashboard/estado-en-vivo.tsx` ('use client'): singleton `createClient()` from `@/lib/supabase/client`; `useEffect` channel `estado-botellon-<id>` with `{ event:'UPDATE', schema:'public', table:'botellones', filter:'id=eq.<id>' }` (bell.tsx L113-147 shape); handler guards `payload.new.estado ∈ ESTADOS` then `setLive` + `onLiveChange`; silent degradation on `CHANNEL_ERROR`/`TIMED_OUT` (console.warn); `removeChannel` in effect cleanup (spec R2/S4/S5); renders canonical badge from `ESTADO_COLORS`/`ESTADO_LABELS`
- [x] 2.5 GREEN `src/app/(dashboard)/botellones/[id]/page.tsx`: remove `getTransiciones` import + `transiciones` prop (L21, L62) (design D8); pass `botellon` unchanged; live badge + selector live inside the form (EstadoEnVivo rendered by form.tsx which owns the live state — single subscriber)
- [x] 2.6 GREEN `src/app/(dashboard)/botellones/[id]/form.tsx`: drop `transiciones` prop; add `live` state + `draftEstado`/`draftCliente`; selects become controlled-until-dirty `value={draftEstado ?? live.estado}` / `value={draftCliente ?? live.clienteId ?? ''}`; option groups derived from **live** estado: identity option first `(actual)`, then `<optgroup label="Avanzar">` from `getTransiciones(live.estado)` and `<optgroup label="Deshacer">` from `getReversiones(live.estado)` (both exclude identity); remove terminal-state hint (L53-55); on `state?.success` reset drafts, on `state?.error` keep drafts (design D3); keep `name` attrs so formData contract unchanged
- [x] 2.7 GREEN `src/components/dashboard/operaciones-dashboard.tsx`: add `useEffect` channel `kanban-botellones` with `{ event:'UPDATE', schema:'public', table:'botellones' }` (no filter) (spec R3/S6); idempotent 3-column patch (design D5 — keep `clientes` join object when `cliente_id` unchanged, else `{ nombre:'' }` fallback); `router.refresh()` stays ONLY in `res.error` path (L66); `removeChannel` cleanup; `BotellonCard` select → controlled `value={b.estado}` (design D6); "En circulación" name render → `b.clientes?.nombre || (b.cliente_id ? 'Cliente asignado' : 'Sin cliente')`
- [x] 2.8 Verify: `npx vitest run tests/component/estado-en-vivo.test.tsx tests/component/operaciones-realtime.test.tsx` green (11/11); full `npx vitest run` green (225/225); `npm run build` green
- [x] 2.9 Manual (runtime, real Supabase required) — COMPLETE-CODE, manual-runtime deferred to user (user will run): apply 0010 → verify `ALTER PUBLICATION supabase_realtime` membership (S1/S2); two-browser live check on detail + kanban (S3/S6); repartidor receives updates despite no UPDATE policy (spec R4/S9 — service-role writes bypass RLS). Code-side evidence: migration 0010 rewritten idempotent (commit `8a7b92d`, review CRITICAL fix); component tests cover subscribe config/echo/fallback (2.1/2.2); real transport + publication membership require live Supabase (manual).
- [x] 2.10 Commit: `feat(botellones): realtime estado updates + migration 0010` (locked session plan message, commit `26041a7`; tasks.md originally said `feat(realtime): live estado updates on detail + kanban, migration 0010, Avanzar/Deshacer selector` — locked plan overrides)

## Dependencies

1.1 ← 1.2 (both RED, independent); 1.3/1.4 ← 1.1/1.2 (GREEN); Commit 1 ← all of batch 1. Commit 2 ← Commit 1 (realtime reconciles against validated server writers; but each is independently revertible). 2.4/2.6 ← 2.3-2.5 wiring; 2.1/2.2 RED before 2.4-2.7 GREEN. Migration 0010 (2.3) independent of all code (only publication membership).

## Spec coverage trace

| Spec req / scenario | Covered by task |
|---------------------|-----------------|
| R1 reversion sets + getEstadosPermitidos + no-terminal | 1.1, 1.3 |
| S1–S4 (undo, entregado set, dedup+identity, inversion) | 1.1, 1.3 |
| R2 server validation + CAS | 1.2, 1.4 |
| S5 invalid reject zero-writes | 1.2, 1.4 |
| S6 forward+reversal | 1.2, 1.4 |
| S7 CAS loser | 1.2 (CAS-miss test), 1.4 |
| S8 identity move | 1.2, 1.4 |
| MOD: sale exception S9/S10, S11 strict, unassign keeps estado, no-planta create | 1.2, 1.4 (unassign/create kept via migrated existing tests) |
| RT R1 publication membership + S1/S2 idempotent | 2.3, 2.9 |
| RT R2 detail live + S3/S4/S5 | 2.1, 2.4, 2.9 |
| RT R3 kanban live + S6/S7/S8 | 2.2, 2.7, 2.9 |
| RT R4 role coverage + S9/S10 | 2.9 (manual) |
| Selector Avanzar/Deshacer optgroups, no terminal | 2.6 |

## Rollback

- Reverse order: `git revert commit 2` (no schema impact beyond 0010 membership; `ALTER PUBLICATION supabase_realtime DROP TABLE public.botellones/recargas/premios/notificaciones` reverses 0010, non-destructive — no data migration) then `git revert commit 1` (pure TS + tests, additive; reverting restores unconditional assign→`entregado` behavior).
- Single-function emergency: if the sale-exception carve-out misbehaves in `updateBotellon` alone, restore force-to-`entregado` in that one function (proposal rollback plan).
