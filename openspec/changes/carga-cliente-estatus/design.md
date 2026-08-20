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

### Decision: Join name into `getBotellonByCodigo` (no extra round-trip)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `getCliente(cliente_id)` per scan | Extra round-trip; two data paths | Reject |
| Join `clientes(nombre)` in the one lookup | One lookup; mirrors `getBotellones`/`getOperaciones` | **Choose** |

**Rationale**: `estado` and `cliente_id` are already returned; only the name is
missing. A single `clientes(nombre)` join returns everything in one call, and
matches the established join pattern. `clienteNombre` is additive/optional, so
the other consumers (`b/[codigo]`, `scanner-modal`) are unaffected.

## Data Flow

```
onDecode(parsed.codigo)
  └─▶ getBotellonByCodigo(codigo)
        select('id, codigo, estado, cliente_id, clientes(nombre)')
        └─▶ { id, codigo, estado, cliente_id, clienteNombre, total_recargas, ultima_recarga }
  └─▶ setItems → SessionItem { id, codigo, cliente: cliente_id, clienteNombre, estado }
        └─▶ render: codigo + clienteNombre (or cliente_id/—) + status badge
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/db/botellones.ts` | Modify | `getBotellonByCodigo` select adds `clientes(nombre)`; `BotellonPublico` gains `clienteNombre: string \| null`; return sets `clienteNombre: data.clientes?.nombre ?? null` |
| `src/lib/utils/estados.ts` | Modify | Add canonical `ESTADO_LABELS` + `ESTADO_COLORS` (moved from `form.tsx`) |
| `src/app/(dashboard)/botellones/[id]/form.tsx` | Modify | Remove local maps; import from `estados.ts` |
| `src/app/b/[codigo]/page.tsx` | Modify | Import `ESTADO_LABELS`/`ESTADO_COLORS` from `estados.ts`; drop local `ESTADO_LABELS`/`ESTADO_BADGE` |
| `src/app/(dashboard)/recargas/carga/page.tsx` | Modify | `SessionItem` → `{ id, codigo, cliente, clienteNombre, estado }`; `onDecode` stores `clienteNombre` + `estado`; session list renders name + badge via shared maps |
| `tests/unit/botellon-by-codigo.test.ts` | Modify | Mock row gains `clientes`; assert `clienteNombre` in result |
| `tests/component/carga-page.test.tsx` | Modify | Mocks gain `clienteNombre`/`estado`; assert name + badge rendering, null-name fallback |

## Interfaces / Contracts

```ts
export type BotellonPublico = {
  id: string;
  codigo: string;
  estado: string;
  cliente_id: string | null;
  clienteNombre: string | null;   // ADDED — from clientes(nombre) join
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
| Unit | `getBotellonByCodigo` returns `clienteNombre` from join | Extend mock chain with `clientes`; assert `toEqual` includes `clienteNombre`; keep null-name case |
| Component | Stored fields + rendered name/badge | Handler-driven: decode via captured `onDecode`, assert `getBotellonByCodigo` returns name+estado and list shows them; assert null-name falls back to id/—; assert unknown estado shows raw value. No setState-in-effect — enrichment asserted inside handler |

RTL approach: mock `useQrScanner`/`getBotellonByCodigo`/`registrarCarga` as today;
drive decode through the captured `onDecode` inside `act`. No `useEffect` body
updates the session.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary.

## Migration / Rollout

No migration required. Additive DB select + additive optional field. Reuse of
`estados.ts` exports is a pure refactor.

## Rollback

Drop `clientes(nombre)` from the select, remove `clienteNombre` from
`BotellonPublico`/`SessionItem`, restore session-list render to codigo-only, and
revert `form.tsx`/`b/[codigo]` imports to local maps. No schema, backend, or
state-model change, so no data migration.

## Open Questions

- [ ] None — decision on extraction is firm; legacy maps (`botellones/page.tsx`,
      donut-chart) intentionally left out of scope.
