# Proposal: Carga — Scan-time client + botellon status

## Intent

The `/recargas/carga` batch page shows only the botellon codigo in the session list at scan time. The mockup requires showing the CLIENT the botellon belongs to and the botellon's current STATUS (entregado/recarga/etc.) for each scanned item, before confirm. The data is mostly already fetched: `getBotellonByCodigo` returns `estado` (currently discarded) and `cliente_id`; only the client NAME needs a join. The confirm transition stays `entregado -> recarga` (no new state).

## Scope

### In Scope
- Extend `getBotellonByCodigo` to join `clientes(nombre)`; add `clienteNombre` to `BotellonPublico`.
- Extend the page's `SessionItem` to `{ id, codigo, cliente, clienteNombre, estado }`.
- Render client name + status badge (existing `ESTADO_LABELS`/`ESTADO_COLORS` convention) in the session list.
- Keep accumulation handler-driven in `onDecode` (no `setState` in effect).
- Update component + unit tests.

### Out of Scope
- No new botellon state, no change to the `entregado -> recarga` transition.
- No change to `registrarCarga` backend or `CargaItemResult`.
- No change to the single-flow `/recargas/nueva`.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `batch-carga`: session list now shows the client name and the botellon's current status at scan time.

> Decision (defer to design/spec): `ESTADO_LABELS`/`ESTADO_COLORS` are duplicated across `form.tsx`, `botellones/page.tsx`, and `botellones-donut-chart.tsx`. Recommend extracting to a shared `src/lib/utils/estados.ts` (near the estados list) and reusing, rather than a 4th duplicate.

## Approach

Additive frontend + one additive DB field. Join `clientes(nombre)` into `getBotellonByCodigo`'s select (`id, codigo, estado, cliente_id, clientes(nombre)`), mirroring the existing `getBotellones`/`getOperaciones` join pattern. `onDecode` stores `clienteNombre` + `estado` from the single lookup and pushes them into `SessionItem`; the session list renders a name line and a status badge using the shared label/color convention. `clientes: null` falls back to the raw id / nothing. No setState-in-effect; accumulation stays in the decode handler.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/db/botellones.ts` | Modified | `getBotellonByCodigo` select adds `clientes(nombre)`; `BotellonPublico` gains `clienteNombre` |
| `src/app/(dashboard)/recargas/carga/page.tsx` | Modified | `SessionItem` extends; session list renders client name + status badge |
| `src/lib/utils/estados.ts` | Modified | (if extraction chosen) home for shared `ESTADO_LABELS`/`ESTADO_COLORS` |
| `tests/unit/botellon-by-codigo.test.ts` | Modified | Assert added `clienteNombre` field / join shape |
| `tests/component/carga-page.test.tsx` | Modified | New stored fields + rendered name/status |
| `openspec/specs/batch-carga/spec.md` | Modified | Delta for scan-time client + status requirement |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `clientes` join returns `null` (missing client row) | Low | Fall back to raw id / nothing in UI; existing `no-client` overlay still guards `cliente_id === null` |
| `botellon-by-codigo.test.ts` asserts exact shape | Med | Update test to expect additive `clienteNombre`; join is non-breaking for existing consumers |
| SetState-in-effect on enrichment | Low | Keep enrichment handler-driven in `onDecode` (react-patterns) |
| Label/color duplication (4th copy) | Med | Extract shared maps to `estados.ts`; if not, reuse via import in design |

## Rollback Plan

Revert is additive and low-risk: drop the `clientes(nombre)` join from `getBotellonByCodigo`'s select, remove `clienteNombre` from `BotellonPublico`/`SessionItem`, and restore the session-list render to codigo-only. No schema, backend, or state-model change, so no data migration.

## Dependencies

- None external. Uses existing `clientes(nombre)` join pattern and existing estados labels/colors.

## Success Criteria

- [ ] Scanned botellon rows in `/recargas/carga` show the client name and current status badge.
- [ ] `getBotellonByCodigo` returns `clienteNombre` via a single `clientes(nombre)` join (no extra round-trip).
- [ ] Confirm still transitions `entregado -> recarga`; `registrarCarga` and single-flow `/recargas/nueva` unchanged.
- [ ] Component + unit tests updated and passing; accumulation remains handler-driven.
