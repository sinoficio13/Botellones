# Tasks: Carga Terminal Multi-Estado

## Review Workload Forecast

| Field | Commit 1 (backend) | Commit 2 (frontend) | Whole change |
|-------|--------------------|---------------------|--------------|
| Estimated changed lines | ~300–450 | ~300–400 | ~550–750 |
| 400-line budget risk | Medium (unit-test churn) | Medium | High |
| Chained PRs recommended | — | — | Yes (2 sequential work-unit commits to main, NO PRs) |
| Suggested split | estados+cargas+loyalty+unit tests | beep+page+component tests, drop wrapper | 2 commits |
| Delivery strategy | direct commits to main (pre-resolved, no PRs) | same | same |
| Chain strategy | stacked-to-main (commit 1 → commit 2, each independently green) | | |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Backend: OPERACIONES/esTransicionValida + registrarOperacion + wrapper + loyalty helper | commit 1 → main | `npx vitest run tests/unit/estados.test.ts tests/unit/carga-registrar.test.ts` | N/A — page untouched, behavior preserved via wrapper; existing component suite stays green | revert estados.ts, cargas.ts, loyalty.ts, tests/unit/* |
| 2 | Frontend: beep util + terminal page + drop wrapper | commit 2 → main | `npx vitest run tests/unit/beep.test.ts tests/component/carga-page.test.tsx` | `npm run dev` → `/recargas/carga`: op switch, badge flip, dup beep+ring, clientless in recibir | revert beep.ts, page.tsx, tests/component/carga-page.test.tsx, tests/unit/beep.test.ts (+ wrapper returns) |

## Commit 1 — Backend (independently green)

- [x] 1.1 (RED) `tests/unit/estados.test.ts`: add failing cases — `OPERACIONES` map (recibir→recibido/`{entregado}`/no-cliente/no-REC; recargar→recarga/`{entregado,recibido}`/cliente/REC; listo→listo/`{recarga}`/no-cliente/no-REC), `esTransicionValida` strict positives/negatives, new edges `entregado→recarga`, `recibido→recarga` in `getTransiciones`
- [x] 1.2 (GREEN) `src/lib/utils/estados.ts`: export `OperacionId`, `OPERACIONES`, `esTransicionValida` (strict `sources.includes(estado)`); add 2 edges to `TRANSICIONES`
- [x] 1.3 (REFACTOR) `src/lib/db/loyalty.ts`: extract `procesarLoyaltyConCompensacion(distinctClientIds, addedByClient, realizadaPor)` → `{premios, loyaltyWarning?}` (existing loyalty+compensation cases re-pointed, stay green)
- [x] 1.4 (RED) `tests/unit/carga-registrar.test.ts`: migrate 16 `registrarCarga` scenarios → `registrarOperacion` + per-op cases: pure op = estado-only (no recargas insert, no loyalty), multi-source guard rejects `estado-<estado>`, op-scoped clientless (`sin-cliente` only recarga; accepted recibir/listo), compensating delete, dedupe, mixed results, zero-write, wrapper test (`registrarCarga` delegates `operacion:'recargar'`)
- [x] 1.5 (GREEN) `src/lib/db/cargas.ts`: `registrarOperacion({botellonIds, operacion, fecha, hora})` — per-op sources/requiresCliente from `OPERACIONES`, `.in('estado', sources)` guard, recarga branch = REC+insert+loyalty+compensation+compensating delete, pure branches = estado update+revalidate only; `CargaItemResult.recargaId/numeroRegistro` optional; add `registrarCarga` thin wrapper
- [x] 1.6 (VERIFY) Ripple: `src/app/(dashboard)/botellones/[id]/page.tsx` renders `getTransiciones` — now shows Recarga from entregado/recibido; run BotellonForm-related component tests + manual render; expect no code change
- [x] 1.7 (COMMIT) Work-unit commit: backend files + unit tests; `npx vitest run` green

## Commit 2 — Frontend (after 1.7)

- [x] 2.1 (RED) `tests/unit/beep.test.ts`: mocked AudioContext — lazy create + resume on first call, no-op when `AudioContext`/`webkitAudioContext` unavailable
- [x] 2.2 (GREEN) `src/lib/scanner/beep.ts` (`'use client'`): `playBeep()` — module-scoped lazy AudioContext, OSC on/off ~0.12s, silent no-op if unavailable
- [x] 2.3 (RED) `tests/component/carga-page.test.tsx`: re-mock `registrarCarga`→`registrarOperacion`; add failing cases — selector defaults recargar + switch updates payload, green/red badge via `esTransicionValida` + live re-validate on op switch, dup beep (mocked `playBeep`) + transient ring + scanner open + count/payload unchanged, op-scoped no-client (clientless blocked recargar, accumulated recibir/listo), generalized results/success (REC#/premios/loyaltyWarning only recarga, "Asignar cliente" link), fecha/hora 30s auto-refresh preserved
- [x] 2.4 (GREEN) `src/app/(dashboard)/recargas/carga/page.tsx`: operation selector (segmented, default recargar; drives confirm payload/label/success), green badge = `ESTADO_LABELS[OPERACIONES[op].target]`, red = current estado with `ESTADO_COLORS['danado']` classes, dup → `playBeep()` + `flashId` ring ~600–800ms + `{outcome:'failure'}` (scanner stays open), no-client overlay only when `requiresCliente`, call `registrarOperacion`, generalize confirm/success screens
- [x] 2.5 (REFACTOR) `src/lib/db/cargas.ts`: drop `registrarCarga` wrapper; remove wrapper test from `tests/unit/carga-registrar.test.ts`
- [x] 2.6 (COMMIT) Work-unit commit: beep + page + tests; full `npx vitest run` green

## Dependencies

1.1→1.2; 1.2→1.4 (registrarOperacion uses OPERACIONES); 1.3→1.5; 1.4→1.5; 1.6 after 1.2, before 1.7; 1.7 gates ALL of commit 2 (sequential); 2.1→2.2; 2.3→2.4; 2.4→2.5 (page stops importing wrapper first); 2.5→2.6.
