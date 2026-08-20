# Tasks: Carga — scan-time client name + botellon status

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300 (estados.ts ~30, form/b[codigo] ~40, db ~15, page ~90, tests ~125) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Full additive change (estados extract + db join + page render + tests) | single PR | `vitest run tests/component/carga-page.test.tsx tests/unit/botellon-by-codigo.test.ts` | `npm run dev` → `/recargas/carga` scan a botellon; confirm still transitions | Revert per design Rollback: drop join, remove clienteNombre from types, restore local maps in form/b[codigo] |

## Phase 1: Foundation — shared estado maps

- [x] 1.1 RED: `tests/unit/estados.test.ts` (or existing) asserts `ESTADO_LABELS`/`ESTADO_COLORS` exist in `src/lib/utils/estados.ts` with entries for canonical estados; `vitest run tests/unit`
- [x] 1.2 GREEN: add canonical `ESTADO_LABELS` + `ESTADO_COLORS` to `src/lib/utils/estados.ts` (moved from `form.tsx`; pure module, no server deps)

## Phase 2: Core — db join + session item

- [x] 2.1 RED: `tests/unit/botellon-by-codigo.test.ts` — mock row gains `clientes:{nombre}`; assert `clienteNombre` in result; keep null-name case
- [x] 2.2 GREEN: `src/lib/db/botellones.ts` — `getBotellonByCodigo` select adds `clientes(nombre)`; `BotellonPublico` gains `clienteNombre: string | null`; return sets `clienteNombre: data.clientes?.nombre ?? null`

## Phase 3: Core — page rendering

- [x] 3.1 RED: `tests/component/carga-page.test.tsx` — mock `getBotellonByCodigo` returns `clienteNombre`+`estado`; assert stored fields + rendered name and badge; null-name falls back to id/—; unknown estado shows raw value; handler-driven (no setState in effect); no-client overlay unchanged
- [x] 3.2 GREEN: `src/app/(dashboard)/recargas/carga/page.tsx` — `SessionItem` → `{ id, codigo, cliente, clienteNombre?, estado? }`; `onDecode` stores both from single lookup; session list renders name line + status badge via shared maps (`ESTADO_LABELS[estado] ?? estado`, `ESTADO_COLORS[estado] ?? ''`)

## Phase 4: Integration — refactor consumers to shared maps

- [x] 4.1 GREEN: `src/app/(dashboard)/botellones/[id]/form.tsx` — remove local maps; import from `estados.ts`
- [x] 4.2 GREEN: `src/app/b/[codigo]/page.tsx` (server component) — import `ESTADO_LABELS`/`ESTADO_COLORS` from `estados.ts`; drop local `ESTADO_LABELS`/`ESTADO_BADGE`

## Phase 5: Testing / Verification

- [x] 5.1 Run full suite: `vitest run tests/component tests/unit` — all green incl. form/b[codigo]/botellones regressions
- [x] 5.2 Typecheck + lint clean: `npx tsc --noEmit`, `npm run lint`; confirm `registrarCarga`/`/recargas/nueva` untouched

## Out of scope (NOT tasks)

No new botellon state; no `registrarCarga`/`CargaItemResult` change; no single-flow `/recargas/nueva` change; no consolidation of legacy divergent maps in `botellones/page.tsx` and `botellones-donut-chart.tsx`; no `/recargas/nueva` change.
