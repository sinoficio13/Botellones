# Design: Carga Terminal Multi-Estado

## Technical Approach

Generalize the batch `registrarCarga` action into a single multi-state `registrarOperacion` driven by a new pure `OPERACIONES` map in the state machine, then turn the `/recargas/carga` page into a three-operation scanning terminal. Server-side strict `.in('estado', sources)` guards stay the source of truth; the UI mirrors them via `esTransicionValida` for live green/red badges. REC + loyalty run ONLY in the `recarga` branch; `recibido`/`listo` are pure `botellones.estado` updates. Delivery is 2 sequential work-unit commits to main (no PRs): backend first, then frontend.

## Architecture Decisions

| # | Decision | Option (tradeoff) | Choice |
|---|---|---|---|
| D1 | One action vs per-op | One generalized action reuses dedupe/reject/compensate scaffold once; per-op = 4× duplication | **One `registrarOperacion`** (explore A1) |
| D2 | Recarga sources | Strict machine `{planta}` (breaks current behavior) vs pragmatic `{entregado,recibido}` | **`{entregado, recibido}`** + add edges `entregado→recarga`, `recibido→recarga` to `TRANSICIONES` (proposal's chosen scope) |
| D3 | Wrapper | Keep `registrarCarga` thin delegating wrapper in commit 1 so page+tests stay green; drop in commit 2 | **Wrapper in commit 1, dropped commit 2** |
| D4 | Loyalty helper | Inline vs extract | **Extract `procesarLoyaltyConCompensacion`** (shared by `registrarRecarga`) |
| D5 | Badge derivation | `esTransicionValida(item.estado, op)` vs server round-trip | **Pure client mirror via `esTransicionValida`**, re-validates live on op switch |

## Data Flow

```
Scanner onDecode → parse → getBotellonByCodigo
   → clientless? (op==recargar → noClient overlay; else accumulate)
   → dup? (scannedIdsRef.has → beep + flashId ring, return failure, scanner open)
   → accumulate SessionItem{estado}
Confirm → registrarOperacion({botellonIds, operacion, fecha, hora})
   → re-derive rows → per-op sources → .in guard → recarga branch (REC+loyalty) | pure update
   → CargaState{items:[{ok, reason}]} → per-item badges + success screen
```

## File Changes

| File | Action | Commit | Description |
|------|--------|--------|-------------|
| `src/lib/utils/estados.ts` | Modify | 1 | Add `OPERACIONES`, `esTransicionValida`; edges `entregado→recarga`, `recibido→recarga` |
| `src/lib/db/loyalty.ts` | Modify | 1 | Extract `procesarLoyaltyConCompensacion` |
| `src/lib/db/cargas.ts` | Modify | 1 | `registrarOperacion` + `registrarCarga` wrapper; `CargaState` with per-item reason incl `estado-<estado>` |
| `tests/unit/carga-registrar.test.ts` | Modify | 1 | Migrate to `registrarOperacion`, per-op scenarios |
| `tests/unit/estados.test.ts` | Modify | 1 | `OPERACIONES` / `esTransicionValida` cases |
| `src/lib/scanner/beep.ts` | Create | 2 | Web Audio beep util (mockable) |
| `src/app/(dashboard)/recargas/carga/page.tsx` | Modify | 2 | Terminal UI; point to `registrarOperacion`; drop wrapper |
| `tests/component/carga-page.test.tsx` | Modify | 2 | Selector, badges, beep/ring, op-gate, generalized results/success |

Unchanged: `src/lib/scanner/use-qr-scanner.ts`, `src/lib/db/recargas.ts` (single flow), `src/lib/db/botellones.ts`.

## Interfaces / Contracts

```ts
// estados.ts
export type OperacionId = 'recibir' | 'recargar' | 'listo';
export const OPERACIONES: Record<OperacionId, {
  target: Estado; requiresCliente: boolean; createsRec: boolean; sources: Estado[];
}> = {
  recibir:  { target: 'recibido', requiresCliente: false, createsRec: false, sources: ['entregado'] },
  recargar: { target: 'recarga',  requiresCliente: true,  createsRec: true,  sources: ['entregado','recibido'] },
  listo:    { target: 'listo',    requiresCliente: false, createsRec: false, sources: ['recarga'] },
};
export function esTransicionValida(estadoActual: Estado, op: OperacionId): boolean;
// strict: OPERACIONES[op].sources.includes(estadoActual)
```

```ts
// cargas.ts
export type CargaItemResult =
  | { botellonId: string; codigo: string; ok: true; recargaId?: string; numeroRegistro?: string }
  | { botellonId: string; codigo: string; ok: false; reason: 'sin-cliente' | `estado-${string}` | 'error' };
export type CargaState = { success: boolean; items: CargaItemResult[]; premios?; loyaltyWarning?; error? };
export async function registrarOperacion(input: {
  botellonIds: string[]; operacion: OperacionId; fecha: string; hora: string;
}): Promise<CargaState>;
// registrarCarga → delegates registrarOperacion({..., operacion:'recargar'}) [commit 1 only]
```

```ts
// loyalty.ts
export async function procesarLoyaltyConCompensacion(
  distinctClientIds: string[], addedByClient: Map<string, number>, realizadaPor: string
): Promise<{ premios: PremioGenerado[]; loyaltyWarning?: string }>;
```

```ts
// beep.ts ('use client')
export function playBeep(): void;
// lazy-create + resume a module-scoped AudioContext; OSC on/off ~0.12s; no-op if unavailable
```

**UI badge**: `const valid = esTransicionValida(item.estado as Estado, operacion)`. Green = `OPERACIONES[op].target` label; red = current estado label (reuse `ESTADO_COLORS['danado']` red classes).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `OPERACIONES`, `esTransicionValida` strict | pure cases in `estados.test.ts` |
| Unit | `registrarOperacion` | migrate 16 `registrarCarga` scenarios + per-op: pure-op no-REC/no-loyalty, multi-source guard, op-scoped no-client, compensating delete, dedupe, mixed results |
| Unit | `procesarLoyaltyConCompensacion` | reuse existing loyalty+compensation cases |
| Unit | `beep.ts` | mocked `AudioContext` in jsdom: lazy create/resume, no-op on unavailable |
| Component | `carga-page` | selector default/switch, live badge re-validate, dup beep+ring (mocked `playBeep`) + scanner open, op-scoped no-client, generalized results/success |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No DB/schema migration. Commit 1 is backward-compatible (wrapper keeps page green). Commit 2 swaps page to `registrarOperacion` and drops the wrapper. Both commits direct to main per the delivery split; sequential to keep each independently green.

## Commit 1 (backend, green) / Commit 2 (frontend) boundaries

- **Commit 1**: `estados.ts`, `cargas.ts` (+ wrapper), `loyalty.ts`, `tests/unit/{carga-registrar,estados}.test.*`. Page untouched → green.
- **Commit 2**: `beep.ts`, `page.tsx` (point to `registrarOperacion`, drop wrapper), `tests/component/carga-page.test.tsx`, new `tests/unit/beep.test.ts`.

## Risks & Edge Cases + Mitigations

| Risk | Mitigation |
|------|-----------|
| Web Audio autoplay (suspended context) | lazy create/resume on first beep; jsdom `AudioContext` mock; `playBeep` no-op when unavailable |
| Race with other operators (item moved between scan & confirm) | server `.in('estado', sources)` remains source of truth; per-item `estado-<estado>` reason |
| Clientless in non-recarga ops | op-scoped `requiresCliente` gate; update no-client tests (they change behavior) |
| Mixed batch keeps session editable | per-item results render; items stay in session for retry |
| Test churn (769+501-line suites) | migrate per commit, Strict TDD |
| Badge drift vs server on op switch | both derive from same `esTransicionValida`; server guard authoritative |

## Open Questions

- [ ] None blocking. (Pure estado moves leave no audit history — accepted out-of-scope per proposal.)
