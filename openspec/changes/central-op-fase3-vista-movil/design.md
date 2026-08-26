# Design: Central de Operaciones — Fase 3: Vista móvil (cola agrupada por cliente)

## Technical Approach

Replace the old kanban `/dashboard` with a mobile-first client-grouped FIFO queue. Server data fn `getColaOperaciones()` (client-owned rows, 4 queue estados, `estado_desde` ASC) feeds fase-1 `agrupar()` per estado; client hook owns grouping, totals, and the optimistic move/undo engine; pure urgency/age helpers in `cola.ts`; 6 components in `src/components/operaciones/`. Undo restores estado **and** original `estado_desde` (locked decision 1) by extending `mover_botellones` with an optional third param — the RPC's first consumer is this queue. Buscador = server helper with digits-only cédula + `useDebounce` reuse (verified: `src/hooks/use-debounce.ts` exists, generic). Tablet 768–1023 = CSS-only 2-col sections without tabs (spec §6.2). Carries R3-001 toast fix, W-1 `prefer-const`, R2-001/2 comments.

Deviations from proposal (both mandated): (1) **RPC gets one additive param** — proposal's "zero schema change" is superseded by locked decision 1; (2) `getClientesForSelect`/`estado-en-vivo.tsx` are **not** orphaned (used by `botellones/[id]/page.tsx` and `form.tsx`) — PR-G must not delete them.

## Architecture Decisions

| # | Decision | Options | Tradeoff | Decision |
|---|---|---|---|---|
| D1 | Undo RPC surface | (a) extend `mover_botellones(p_ids, p_estado, p_estado_desde jsonb DEFAULT NULL)`; (b) new `deshacer_movimiento()` | (a) one function, additive param, idempotent re-grants, undo *is* a reverse move (same validation + transaction); (b) clearer name but duplicates role guard/validation/grants | **(a)** — minimal change; migration `0013` |
| D2 | Undo two-step | (a) 2nd `UPDATE estado_desde` in same txn; (b) separate call | (a) atomic; trigger `fn_trg_estado_desde` checks `IS DISTINCT FROM` in body (verified 0011:96) → estado-unchanged UPDATE takes silent branch: no re-stamp, no audit row | **(a)** — exactly the locked mechanism |
| D3 | Undo validation | reuse RPC's `WHERE p_estado = ANY(estados_permitidos(estado))` + row-count check | concurrent advance to a non-revertible estado fails the whole batch atomically (red toast) — desired; no new CAS | **reuse as-is** |
| D4 | Queue feed filter | (a) 4 queue estados; (b) all estados | (a) matches the 4 tabs + REQ-COS-20 "4 queue estados"; `entregado` leaves the queue | **(a)** — `.in('estado', ESTADOS_KANBAN)` + `.not('cliente_id','is',null)` + `.order('estado_desde')` |
| D5 | Fetch location | (a) RSC page fetches → props; (b) hook fetches server action on mount | (b) makes the skeleton real (spec REQ-COS-21 "loading is a skeleton", testable) and matches proposal "hook fetches once"; (a) would make skeleton dead code | **(b)** — page renders `<ColaOperaciones />`; hook calls `getColaOperaciones()` on mount |
| D6 | Selection state | (a) local to `GrupoCard`; (b) hook-owned | (a) card self-contained: chips all-marked on mount, unmount when group empties, remaining chips keep their state; (b) unnecessary global state | **(a)** — hook exposes no selection API; contract documented |
| D7 | Cédula search | (a) fetch candidates + JS digits-only filter both sides; (b) SQL regexp RPC | PostgREST cannot regexp-normalize; (a) correct by construction over bounded queue set, no extra migration; (b) more SQL surface, cross-slice coupling | **(a)** — hybrid: nombre/código via parallel `ilike` (spec letter), cédula fetch+filter |
| D8 | Age/urgency | pure fns with injectable `ahora` | deterministic tests, mirrors `grupos.ts` convention | **`src/lib/utils/cola.ts`** |
| D9 | Tablet layout | CSS-only vs JS breakpoint | spec §6.2 locks no-tabs 2-col sections | **CSS-only** (`md:grid-cols-2`, tabs `md:hidden`) |
| D10 | Success reconciliation | apply RPC RETURNED rows vs `router.refresh()` | RPC returns `SETOF botellones`; applying keeps UI==DB for the acting operator; refresh adds nothing (realtime is fase 5) | **apply returned rows; no refresh** (proposal's refresh mitigation retired — local state is canonical) |
| D11 | Undo optimism | (a) non-optimistic (await RPC, then apply); (b) optimistic revert | (a) no flicker; on failure rows stay in post-move estado (correct — the move succeeded); (b) needs revert dance on failure | **(a)** — undo awaits RPC; error → red toast, rows unchanged |
| D12 | Grouping scope | (a) partition by estado then `agrupar`; (b) `agrupar` all rows then split | (a) a client with bottles in 2 estados appears in 2 tabs as 2 groups (correct); (b) would merge across estados | **(a)** — 4 `agrupar` calls, one per estado |

## Data Flow

```
Move:  Operator → GrupoCard.onAccion(ids) → useColaOperaciones.mover(ids, destino)
        1. snapshot { estadoAnterior, [id → estado_desde] }  2. optimistic removal
        3. showToast('N botellones a {destino}', Deshacer)    4. rpc(ids, destino)
        5. ok → apply returned rows (grupo lands in destino tab, age now())
           err → revert snapshot + red toast 'No se pudo mover. Reintentá.' (no undo)

Undo (tap Deshacer → onAction → resultado.deshacer()):
        await enVuelo (serialize) → rpc(ids, estadoAnterior, {id → estado_desde ORIGINAL})
          (a) UPDATE estado=estadoAnterior        → trigger stamps now() + audit row
          (b) UPDATE estado_desde=<original>      → trigger silent (estado unchanged), no audit
        ok → apply returned rows (group returns with ORIGINAL age)
        err → red toast; rows stay in post-move estado
        R3-001: deshacer() shows a new toast inside onAction → dismiss-by-captured-id keeps it alive
```

## RPC contract — migration `0013_undo_mover_botellones.sql` (additive, idempotent)

```sql
CREATE OR REPLACE FUNCTION public.mover_botellones(
  p_ids uuid[], p_estado text, p_estado_desde jsonb DEFAULT NULL)
RETURNS SETOF public.botellones ... AS $$
  -- existing: role guard, DISTINCT UNNEST dedupe, UPDATE estado (TOCTOU-free WHERE),
  -- GET DIAGNOSTICS vs cardinality, RAISE → rollback (zero writes)
  IF p_estado_desde IS NOT NULL THEN
    UPDATE public.botellones b
    SET estado_desde = (p_estado_desde ->> b.id::text)::timestamptz
    WHERE b.id = ANY(v_ids) AND p_estado_desde ? b.id::text;  -- keys missing → keep now()
  END IF;
  RETURN QUERY SELECT b.* FROM public.botellones b WHERE b.id = ANY(v_ids);
$$;
-- REVOKE/GRANT re-run (idempotent, same as 0012)
```

Key facts verified: trigger body checks `NEW.estado IS DISTINCT FROM OLD.estado` (0011:96) → step (b) never re-stamps nor audits; `estados_permitidos` includes reversions → the reverse move passes validation; undo of a batch where one bottle was concurrently advanced to a non-revertible estado fails atomically (red toast, no partial undo). Types: extend `src/types/database.ts` RPC Args (hand-updated, REQ-COS-7 convention).

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/0013_undo_mover_botellones.sql` | Create | `mover_botellones` + optional `p_estado_desde jsonb` + re-grants |
| `src/types/database.ts` | Modify | RPC Args `+ p_estado_desde?: Record<string,string> \| null` |
| `src/lib/db/botellones.ts` | Modify | `+ SELECT_COLA`, `ColaBotellon`, `getColaOperaciones()`, `buscarColaOperaciones()` + `ResultadoBusqueda` |
| `src/hooks/useColaOperaciones.ts` | Create | fetch server action → partition+`agrupar` → `porEstado`/`totales` + `mover`/`deshacer` (snapshot, serialize via `enVueloRef`) |
| `src/lib/utils/cola.ts` | Create | `formatAntiguedad`, `nivelUrgencia`, `normalizarCedula` |
| `src/components/operaciones/tabs-estados.tsx` | Create | tablist/tab, `aria-selected`, sticky, 2px `--estado-*` underline, group counters |
| `src/components/operaciones/barra-contexto.tsx` | Create | "N clientes · N botellones · más antiguo arriba" |
| `src/components/operaciones/grupo-card.tsx` | Create | client block (cédula mono/"—"), 3 ≥44px targets (name inert, WhatsApp inert/disabled, chips), `+N`, urgency, ActionButton |
| `src/components/operaciones/buscador.tsx` | Create | input + `useDebounce` 250ms + min-2 gate + grouped results |
| `src/components/operaciones/cola-operaciones.tsx` | Create | shell: tabs/cards/search/skeleton/empties/ScannerModal/tablet grid/action-toast orchestration |
| `src/components/operaciones/copy-vacios.tsx` | Create | 4 per-tab + first-use empty copy constants |
| `src/components/operaciones/lista-skeleton.tsx` | Create | skeleton card list (reuses Skeleton, REQ-COS-13) |
| `src/components/operaciones/toast.tsx` | Modify | R3-001 dismiss-by-id + W-1 `const` |
| `src/app/globals.css` | Modify | R2-001/2 token-namespace intent comments only |
| `src/app/(dashboard)/dashboard/page.tsx` | Modify | render `<ColaOperaciones />` (drop `getOperaciones`) |
| `src/components/dashboard/operaciones-dashboard.tsx` | Delete (PR-F) | old kanban + assign modal + realtime |
| `tests/component/operaciones-realtime.test.tsx` | Delete (PR-G) | tests deleted component |

## Interfaces / Contracts

```ts
// botellones.ts
export type ColaCliente = { nombre: string; cedula: string | null; telefono_1: string | null; whatsapp: string | null };
export type ColaBotellon = BotellonAgrupable & { cliente_id: string; clientes: ColaCliente };
export async function getColaOperaciones(): Promise<ColaBotellon[]>;
// select: id, codigo, estado, estado_desde, cliente_id, clientes(nombre, cedula, telefono_1, whatsapp)
//   .not('cliente_id','is',null).in('estado', ESTADOS_KANBAN).order('estado_desde', asc)
export type ResultadoBusqueda = { porNombre: ColaBotellon[]; porCedula: ColaBotellon[]; porCodigo: ColaBotellon[] };
export async function buscarColaOperaciones(q: string): Promise<ResultadoBusqueda>;

// useColaOperaciones.ts  ('use client')
export type EstadoOperativo = 'recibido' | 'recarga' | 'listo' | 'delivery';
export type GrupoCola = Omit<GrupoCliente, 'botellones'> & { botellones: ColaBotellon[] }; // narrows agrupar output
export type ResultadoAccion =
  | { ok: true; deshacer: () => Promise<ResultadoAccion> }
  | { ok: false; error: string };
export function useColaOperaciones(): {
  cargando: boolean;
  porEstado: Record<EstadoOperativo, GrupoCola[]>;
  totales: { clientes: number; botellones: number };
  mover: (ids: string[], destino: EstadoOperativo) => Promise<ResultadoAccion>;
};
// Selection contract: NO hook state — GrupoCard owns `marcados: Set<id>` (all-marked on mount,
// toggled per chip, survives subset moves, resets on remount).

// cola.ts (pure)
export type NivelUrgencia = 'normal' | 'urgencia' | 'critica';
export function formatAntiguedad(estadoDesde: string, ahora?: Date): string;  // 45m / 3h / 3d
export function nivelUrgencia(estadoDesde: string, ahora?: Date): NivelUrgencia; // <6h / 6–24h / >24h
export function normalizarCedula(s: string | null): string;                    // digits-only

// grupo-card.tsx
type Props = { grupo: GrupoCola; estado: EstadoOperativo; enAccion?: boolean; onAccion: (ids: string[]) => void };
// destino per estado (forward machine): recibido→recarga, recarga→listo, listo→delivery, delivery→entregado
// copy: "→ Pasar {N} a En recarga|Listo|En delivery" / "✓ Entregar {N} a {PrimerNombre}";
// 0 marked → disabled "Elegí al menos un botellón"; WhatsApp: no-phone → disabled opacity-40;
// with-phone → inert no-op tap (fase 5 sheet); name target inert (fase 5 ficha).
// tabs-estados.tsx: { activo, onCambio, contadores: Record<EstadoOperativo, number> }  // counters = groups
// barra-contexto.tsx: { clientes: number; botellones: number }
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `cola.ts` | matrix below; fixed ISO + injected `ahora` |
| Component | `useColaOperaciones` | fixture rows: partition/agrupar, totals, optimistic move + reconcile, undo restores estado+ts, error revert (mock supabase rpc) |
| Component | tabs a11y | `role=tablist/tab`, `aria-selected`, sticky, underline token, counters |
| Component | grupo-card | chips all-marked/+N/`aria-pressed`, 0-marked disabled, urgency classes, null cédula "—", per-estado copy |
| Component | undo flow | harness card→hook→ToastHost: action→optimistic→Deshacer→RPC reverse→restored; error→red toast no undo |
| Component | toast R3-001 | fake timers: toast shown inside `onAction` survives the original dismiss |
| Component | buscador | fake timers 250ms, min-2 gate, grouped rendering |
| Component | cola-operaciones | skeleton on load, per-tab empties, first-use empty + Escanear/Cargar manual, tablet grid classes |
| E2E | 375px | Playwright: viewport 375, `scrollWidth ≤ 375` |

`cola.ts` matrix — `formatAntiguedad`: 45m→`45m`; 59m→`59m`; 60m→`1h`; 3h→`3h`; 23h→`23h`; 24h→`1d`; 3d→`3d`; 0m→`0m`; future ts→`0m` (clamp). `nivelUrgencia`: 5h→`normal`; 6h→`urgencia`; 24h→`urgencia`; 24h+1m→`critica`; 30h→`critica`; future→`normal`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. (The RPC role guard is a data-layer authorization boundary already covered by REQ-COS-4 scenarios; no new boundary is introduced.)

## Migration / Rollout

Migration `0013` only — additive `CREATE OR REPLACE` + idempotent REVOKE/GRANT re-run; no data migration, no feature flags. Rollback: revert the file (0012's 2-arg signature is untouched in git history; 0013 is safe to keep applied since the param defaults NULL). No migration in PR-A/B — `0013` ships in PR-C (its only consumer), keeping earlier slices DB-free. Delivery: 7 chained PRs A→G, each ≤400 changed lines, ask-always.

## Chained-PR slice plan

| Slice | Files (exact) | Est. lines | REQs |
|---|---|---|---|
| PR-A Frame | `botellones.ts` (+`SELECT_COLA`/`ColaBotellon`/`getColaOperaciones` ~30); `useColaOperaciones.ts` seed+grouping ~90; `tabs-estados.tsx` ~65; `barra-contexto.tsx` ~22; `copy-vacios.tsx` ~22; `lista-skeleton.tsx` ~28; `tests/component/cola-tabs.test.tsx` ~55; `tests/component/use-cola-operaciones.test.tsx` ~70; `globals.css` R2-001/2 ~6 | ~388 ⚠ borderline | 16, 17, 21 (skeleton+empty building blocks) |
| PR-B Card | `cola.ts` ~45; `grupo-card.tsx` ~190; `tests/unit/cola.test.ts` ~65; `tests/component/grupo-card.test.tsx` ~90 | ~390 | 18 |
| PR-C Acción+undo | `migrations/0013` ~45; `types/database.ts` ~6; `useColaOperaciones.ts` mover/deshacer ~115; `toast.tsx` R3-001+W-1 ~12; `toast.test.tsx` mod ~25; undo-flow test ~110 | ~313 | 19, MOD 12 |
| PR-D Buscador | `botellones.ts` +`buscarColaOperaciones`/`ResultadoBusqueda` ~80; `buscador.tsx` ~110; `tests/component/buscador.test.tsx` ~85; `normalizarCedula` cases in `cola.test.ts` ~15 | ~290 | 20 |
| PR-E Reemplazo | `cola-operaciones.tsx` ~230; `dashboard/page.tsx` swap ~8; `tests/component/cola-operaciones.test.tsx` ~80 | ~318 | 21 |
| PR-F Cleanup | delete `src/components/dashboard/operaciones-dashboard.tsx` (365) | ~365 del | 21 |
| PR-G Cleanup | delete `tests/component/operaciones-realtime.test.tsx` (222) + `getOperaciones`/`BotellonOperativo` (~26) | ~248 del | 21 |

Commit units: 1–2 conventional commits per PR, tests committed with their code, deletions standalone. PR-F/G do **not** touch `getClientesForSelect` (live: `botellones/[id]/page.tsx:1`) nor `estado-en-vivo.tsx` (live: `botellones/[id]/form.tsx:11`). Optional: merge F+G under explicit ask-always exception (pure deletions).

## Verification matrix

| REQ | Design element | Verify |
|---|---|---|
| 16 | `getColaOperaciones` select/filter/order + partition-`agrupar` | unit/component tests + verify diff |
| 17 | `tabs-estados` + `barra-contexto` | component a11y + counters |
| 18 | `grupo-card` + `cola.ts` | component + unit matrix |
| 19 | hook mover/deshacer + `0013` + toast | undo-flow test + R3-001 regression + RPC integration |
| 20 | `buscarColaOperaciones` + `buscador` | normalization unit + debounce component |
| 21 | shell + page swap + tablet CSS + empties | component + E2E 375px |
| MOD 12 | `toast.tsx` dismiss-by-id | `toast.test.tsx` R3-001 scenario |

## Open Questions / Risks

- **R1 — Entregar no stamps `fecha_entrega`**: the RPC only sets estado (locked REQ-COS-4); the old `moverBotellon` stamped it. The queue doesn't need it, but `botellones/[id]` detail may show a null entrega date. Needs a verify-time check; out of scope to change the locked RPC behavior.
- **R2 — Batch undo with a concurrently moved bottle**: atomic whole-batch failure → red toast, no partial undo (D3). Acceptable, document in UI copy? No copy change — red toast suffices.
- **R3 — Realtime regression**: no live updates until fase 5; own actions reconcile via RPC returned rows (D10); other operators' views stay stale; counters static.
- **R4 — Skeleton flash on every visit** (client fetch, D5): acceptable per spec; fast local query.
- **R5 — `ilike` on embedded `clientes.nombre`**: PostgREST embedded-resource filtering; low risk, confirm live in PR-D.
- **R6 — Slice coupling**: chain order is fixed A→G; each PR green independently (tests never import later slices); PR-E composes A–D components.
- **R7 — Dark mode**: urgency amber 7% bg (`bg-urgencia/7`) and chips checked states must be verified in both modes (tokens are mode-independent).
- **R8 — Cédula null**: card shows "—"; search bucket simply has no match (normalize null → "").