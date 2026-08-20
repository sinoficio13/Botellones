# Design: Carga — Scan-time client + botellon status

## Technical Approach

Additive frontend + one additive DB field. Extend `getBotellonByCodigo` to join
`clientes(nombre)` so the single scan lookup already in `onDecode` returns the
client name alongside `estado` and `cliente_id`. Extend the page's `SessionItem`
to carry `clienteNombre` + `estado`; the session list renders a client-name line
and a status badge using the existing `ESTADO_LABELS`/`ESTADO_COLORS` badge
convention. Confirm transition stays `entregado -> recarga`; `registrarCarga`,
`CargaItemResult`, and `/recargas/nueva` are untouched. Accumulation stays
handler-driven inside `onDecode` (no `setState` in effect). Maps to proposal
Approach 2 and spec `batch-carga` ADDED requirements.

## Architecture Decisions

### Decision: Extract canonical estado badge maps to a shared module

| Option | Tradeoff | Decision |
|--------|----------|----------|
| 4th duplicate in `carga/page.tsx` | Fastest, but perpetuates the copy sprawl | Reject |
| Extract `ESTADO_LABELS`/`ESTADO_COLORS` to `src/lib/utils/estados.ts` | One source of truth; small refactor of consistent copies | **Choose** |

**Rationale**: The status badge must reuse the canonical maps that match the
`estados.ts` state-machine vocabulary. Those live only in `form.tsx` (labels +
badge classes) and a light-only duplicate in `b/[codigo]/page.tsx` (server
component can't import the `'use client'` form module). `estados.ts` is already
a pure, server-free module — ideal for a `'use client'` page to import. Extract
the canonical `ESTADO_LABELS` + `ESTADO_COLORS` there, refactor `form.tsx` and
`b/[codigo]/page.tsx` to import them, and have `carga/page.tsx` import them too.
This avoids a 4th copy and consolidates the two consistent badge sources.

**Explicitly out of scope**: `botellones/page.tsx` and
`botellones-donut-chart.tsx` define `ESTADO_COLORS` with a **legacy, divergent
vocabulary** (`disponible, asignado, en_recarga, en_planta`); the donut variant
is chart HSL colors, not badge classes. They are not interchangeable with the
canonical maps and are left unchanged (separate concern). Only the canonical
badge maps are extracted.

### Decision: Keep `getBotellonByCodigo` public-safe; resolve name via `getCliente`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Join `clientes(nombre)` in `getBotellonByCodigo` | Leaks owner PII into the anonymous `/b/[codigo]` RSC payload; one lookup | **Reject** (revised) |
| `getCliente(cliente_id)` per scan on the authenticated page | One extra lookup only on the authenticated page; public endpoint stays PII-free | **Choose** (security-corrected) |

> **Revision note (security fix `1458c87`, review `review-e236765a4dee14d4` APPROVED):**
> The original design chose the `clientes(nombre)` join in `getBotellonByCodigo`.
> That was **reversed** during review: `getBotellonByCodigo` is consumed by the
> anonymous `/b/[codigo]` QR page, whose force-dynamic RSC payload is reachable
> by any browser and whose codes are sequentially enumerable. Serializing the
> owner's name there would expose client PII without authentication. The fix
> keeps `getBotellonByCodigo` public-safe (select only `id, codigo, estado,
> cliente_id`, no `clienteNombre`) and resolves the display name via a separate
> `getCliente(cliente_id)` call inside the authenticated `/recargas/carga` page's
> `onDecode`. This is the option the original design rejected, adopted for
> security reasons. `estado` and `cliente_id` are still returned by the single
> public-safe lookup; only the name resolution moves to the authenticated side.

## Data Flow

```
onDecode(parsed.codigo)
  └─▶ getBotellonByCodigo(codigo)            // public-safe: no client PII
        select('id, codigo, estado, cliente_id')
        └─▶ { id, codigo, estado, cliente_id, total_recargas, ultima_recarga }
  └─▶ getCliente(botellon.cliente_id)        // authenticated page resolves name
        └─▶ { id, ..., nombre } → cliente?.nombre ?? undefined
  └─▶ setItems → SessionItem { id, codigo, cliente: cliente_id, clienteNombre, estado }
        └─▶ render: codigo + clienteNombre (or cliente_id/—) + status badge
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/db/botellones.ts` | Modify | `getBotellonByCodigo` stays public-safe: select remains `id, codigo, estado, cliente_id`, NO `clientes(nombre)` join, NO `clienteNombre` in `BotellonPublico` (PII kept out of the anonymous `/b/[codigo]` payload) |
| `src/lib/utils/estados.ts` | Modify | Add canonical `ESTADO_LABELS` + `ESTADO_COLORS` (moved from `form.tsx`) |
| `src/app/(dashboard)/botellones/[id]/form.tsx` | Modify | Remove local maps; import from `estados.ts` |
| `src/app/b/[codigo]/page.tsx` | Modify | Import `ESTADO_LABELS`/`ESTADO_COLORS` from `estados.ts`; drop local `ESTADO_LABELS`/`ESTADO_BADGE` |
| `src/app/(dashboard)/recargas/carga/page.tsx` | Modify | `SessionItem` → `{ id, codigo, cliente, clienteNombre, estado }`; `onDecode` resolves name via `getCliente(cliente_id)` and stores `clienteNombre` + `estado`; session list renders name + badge via shared maps |
| `tests/unit/botellon-by-codigo.test.ts` | Modify | Assert `getBotellonByCodigo` does NOT expose `clienteNombre` and its select never contains `clientes` |
| `tests/component/carga-page.test.tsx` | Modify | Mocks gain `getCliente` (returns name) + `estado`; assert name + badge rendering, null-name fallback |

## Interfaces / Contracts

```ts
export type BotellonPublico = {
  id: string;
  codigo: string;
  estado: string;
  cliente_id: string | null;
  // NOTE: no clienteNombre by design - public-safe, see Decision #2
  total_recargas: number;
  ultima_recarga: string | null;
};

// page.tsx
type SessionItem = {
  id: string; codigo: string; cliente: string;
  clienteNombre?: string;        // ADDED
  estado?: string;               // ADDED
};
```

Badge render uses `ESTADO_LABELS[estado] ?? estado` and
`ESTADO_COLORS[estado] ?? ''` (spec: unknown estado falls back to raw value).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getBotellonByCodigo` does NOT expose `clienteNombre` | Mock `getBotellonByCodigo`; assert result `not.toHaveProperty('clienteNombre')` and the select never contains `clientes` (public-safe) |
| Component | Stored fields + rendered name/badge | Handler-driven: decode via captured `onDecode`, assert `getBotellonByCodigo` returns estado + cliente_id, `getCliente` returns the name, and the list shows name + badge; assert null-name falls back to id/—; assert unknown estado shows raw value. No setState-in-effect — enrichment asserted inside handler |

RTL approach: mock `useQrScanner`/`getBotellonByCodigo`/`getCliente`/`registrarCarga` as today;
drive decode through the captured `onDecode` inside `act`. No `useEffect` body
updates the session.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary.

## Migration / Rollout

No migration required. Additive UI + additive page-side `getCliente` call; the
public `getBotellonByCodigo` contract is unchanged (already public-safe). Reuse of
`estados.ts` exports is a pure refactor.

## Rollback

The security-corrected approach is additive and low-risk: revert the page's
`getCliente` name resolution and restore the session-list render to codigo-only
and remove `clienteNombre`/`estado` from `SessionItem`; revert `form.tsx`/
`b/[codigo]` imports to local maps. `getBotellonByCodigo` requires no revert
(no PII was ever added to it). No schema, backend, or state-model change, so no
data migration.

## Open Questions

- [ ] None — decision on extraction is firm; legacy maps (`botellones/page.tsx`,
      donut-chart) intentionally left out of scope.
