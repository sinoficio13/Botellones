# Exploration: Carga Cliente + Estatus (scan-time client & botellon status)

## Current State

The batch QR page `/recargas/carga` (`src/app/(dashboard)/recargas/carga/page.tsx`) scans botellon QRs, accumulates them into a transient client-side session, and confirms ONE uniform `registrarCarga` batch.

**What the page stores per scanned item** (`SessionItem`):
```ts
type SessionItem = { id: string; codigo: string; cliente: string };
```
- `cliente` holds the `cliente_id` (misleadingly named — it is an ID, not a display name).
- `estado` is NOT stored.

**What the page renders in the session list** (lines 243-250): only the `codigo` in a `<span className="font-mono text-sm">`. No client name, no botellon status.

**What is available at scan time**: `onDecode` calls `getBotellonByCodigo(parsed.codigo)`, which returns `BotellonPublico`:
```ts
{ id, codigo, estado, cliente_id, total_recargas, ultima_recarga }
```
- `estado` IS already fetched but discarded when building the `SessionItem`.
- `cliente_id` IS stored (as the raw ID).
- Client NAME is NOT returned (no `clientes(nombre)` join in `getBotellonByCodigo`).

**Backend contract** (`src/lib/db/cargas.ts`): `CargaItemResult` carries only `{ botellonId, codigo, ok }` plus `recargaId`/`numeroRegistro` (ok) or `reason` (rejected). It does NOT carry `cliente_id` or `estado`.

**Botellon estados** are defined in `src/lib/utils/estados.ts`: `recibido, planta, recarga, listo, delivery, entregado, danado, perdido, mantenimiento`. Display labels/colors live in `src/app/(dashboard)/botellones/[id]/form.tsx` (`ESTADO_LABELS`, `ESTADO_COLORS`).

**Reference UI** (`/recargas/nueva`, single flow): the confirm step shows a label/value card — "Cliente → nombre" and "Botellón → codigo" rows. The botellon picker also shows `b.estado` under the code. This is the visual convention to mirror for showing client name + status.

## The Gap

| Aspect | Today | Mockup wants |
|--------|-------|--------------|
| Client name at scan | Not shown; only the `cliente_id` is stored internally | Show the client the botellon belongs to at scan time |
| Botellon status at scan | Not stored/rendered (though `estado` is fetched and discarded) | Show current status (`entregado`/`recarga`/`disponible`/etc.) at scan time |
| Transition on confirm | `entregado → recarga` | Unchanged (no new state) |

## Data Availability

- **Already available at scan**: `estado` (returned by `getBotellonByCodigo`, currently discarded) and `cliente_id`.
- **Needs a lookup to display**: client NAME. `getBotellonByCodigo` does not join `clientes(nombre)`. Options:
  - (a) Fetch client name via `getCliente(cliente_id)` from `src/lib/db/clientes.ts` (already used in `/recargas/nueva`), or
  - (b) Extend `getBotellonByCodigo` to join `clientes(nombre)` so one lookup returns both name and estado.
- **Status label**: map the raw `estado` string to a label/color using the existing `ESTADO_LABELS`/`ESTADO_COLORS` convention.

## Affected Areas

- `src/app/(dashboard)/recargas/carga/page.tsx` — extend `SessionItem` to carry `estado` (and optionally `clienteNombre`); render client name + status badge in the session list. Possibly fetch the client name at scan time.
- `src/lib/db/botellones.ts` (optional) — extend `getBotellonByCodigo` to join `clientes(nombre)` so a single scan lookup yields name + estado. Avoids an extra per-scan `getCliente` call.
- `tests/component/carga-page.test.tsx` — update mocks/assertions for the new stored fields and rendered name/status.
- `openspec/specs/batch-carga/spec.md` — new requirement for scan-time client + status display (delta).

## Approaches

1. **Store `estado` from the existing lookup + fetch client name via `getCliente`**
   - Extend `SessionItem` to `{ id, codigo, cliente, clienteNombre, estado }`.
   - In `onDecode`, keep `estado` (already returned) and call `getCliente(cliente_id)` for the name.
   - Render a name line + a status badge (reusing `ESTADO_LABELS`/`ESTADO_COLORS`) in the session list.
   - Pros: no backend change; isolated to the page.
   - Cons: an extra `getCliente` round-trip per scan; two code paths for data.
   - Effort: Low-Medium.

2. **Join client name into `getBotellonByCodigo`** (recommended)
   - Change `getBotellonByCodigo` to `select('id, codigo, estado, cliente_id, clientes(nombre)')` and add `clientes`/`clienteNombre` to `BotellonPublico`.
   - `onDecode` stores `{ id, codigo, cliente: cliente_id, clienteNombre, estado }` from the single lookup.
   - Render name + status badge in the session list using the existing `ESTADO_LABELS`/`ESTADO_COLORS` convention.
   - Pros: ONE lookup returns everything; no extra round-trip; matches how `getBotellones`/`getOperaciones` already join `clientes(nombre)`.
   - Cons: touches `botellones.ts` + its type; `botellon-by-codigo.test.ts` may need updating.
   - Effort: Low.

3. **Post-confirm server enriches results** (not recommended for this gap)
   - Add `cliente_id`/`estado` to `CargaItemResult` so post-confirm rows can show name/status.
   - Pros: authoritative server data.
   - Cons: solves the wrong screen — the mockup wants it AT SCAN TIME, before confirm. Out of scope for this change.
   - Effort: Medium.

## Recommendation

**Approach 2** — extend `getBotellonByCodigo` to join `clientes(nombre)` and carry the joined name into `BotellonPublico`; extend the page's `SessionItem` to `{ id, codigo, cliente, clienteNombre, estado }`; render the client name and a status badge in the session list. Reuse the existing `ESTADO_LABELS`/`ESTADO_COLORS` convention for the status badge (consolidate/extract them if desired). Keep the confirm transition `entregado → recarga` exactly as-is — no new state, no backend `registrarCarga` change.

Rationale: the data the mockup wants is already fetched at scan time except the client name; a single-join lookup avoids an extra round-trip and mirrors the established `clientes(nombre)` join pattern used elsewhere.

## Risks

- **`getBotellonByCodigo` consumers**: it is used by the page and tests (`tests/unit/botellon-by-codigo.test.ts`, and `scanner-modal` paths). Adding a field is additive and non-breaking, but the unit test may assert the exact shape.
- **Client name can be stale/missing**: if a botellon's `cliente_id` is set but the client row is absent, the join returns `clientes: null`; the UI must fall back to showing the raw id or nothing, and the existing `no-client` overlay still governs the `cliente_id === null` case.
- **SetState-in-effect rule**: client-name enrichment must stay handler-driven inside `onDecode` (per `react-patterns`), not in a `useEffect`.
- **Label/color duplication**: `ESTADO_LABELS`/`ESTADO_COLORS` currently live in `form.tsx`; reusing them in the page either duplicates the maps or requires a small extraction. Decide in design.

## Ready for Proposal

Yes. The gap is well-defined, the data path is small, and Approach 2 is low-effort with no backend/state-model change. Tell the user: client + status display at scan time, transition stays `entregado → recarga`, implementation touches the page + a small `getBotellonByCodigo` join + tests.
