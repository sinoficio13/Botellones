# Exploration: Carga Terminal Multi-Estado

**Change**: `carga-terminal-multi-estado`
**Phase**: sdd-explore (hybrid artifact store)
**Date**: 2026-08-21

## Current State

The `/recargas/carga` batch QR screen (`src/app/(dashboard)/recargas/carga/page.tsx`, 428 lines, `'use client'`) scans botellon QRs through the shared `useQrScanner` hook, accumulates them into a transient client-side session (`items[]` + authoritative `scannedIdsRef` Set for stale-closure-safe dedupe), and confirms ONE uniform recarga via `registrarCarga({ botellonIds, fecha, hora })` through `useActionState`. Shared fecha/hora inputs auto-refresh every 30s until manually touched (touched refs). The session list shows codigo + `clienteNombre` + current-estado badge (from `ESTADO_LABELS`/`ESTADO_COLORS`) + "Ver ficha" link. Success renders a green screen with ok-count, REC# list, premios, `loyaltyWarning`.

Backend: `registrarCarga` (src/lib/db/cargas.ts, 298 lines, `'use server'`) re-derives `cliente_id` server-side, dedupes, rejects clientless / non-`entregado` items with per-item reasons, computes N sequential REC numbers from ONE max+1 read, does a single array insert into `recargas`, updates `botellones.estado = 'recarga'` with a single `.in()` guarded by `.eq('estado', 'entregado')`, runs `procesarLoyalty` once per distinct client (failure → `loyaltyWarning`, batch stays success), compensates for milestone overshoot (multiples of 100 crossed mid-batch, idempotent via `uq_premios_cliente_nivel`), and compensates with a best-effort delete of inserted rows if the estado update fails.

The single-flow `registrarRecarga` (src/lib/db/recargas.ts, FormData wizard at `/recargas/nueva`) does the same REC+loyalty for one botellon. `procesarLoyalty` (src/lib/db/loyalty.ts) is already shared by both. `getBotellonByCodigo` (src/lib/db/botellones.ts) is deliberately public-safe: returns only `id, codigo, estado, cliente_id` (no client PII) because the anonymous `/b/[codigo]` page consumes it; the carga page resolves the owner name via a separate `getCliente(cliente_id)` call in `onDecode`.

State machine (`src/lib/utils/estados.ts`, pure, no server deps — importable client-side):
- Linear cycle: `recibido → planta → recarga → listo → delivery → entregado`; exceptions `danado, perdido, mantenimiento` reachable from various points; all exceptions restore to `planta`.
- `TRANSICIONES` (source → targets): recibido → [planta, danado, perdido]; planta → [recarga, mantenimiento, danado, perdido]; recarga → [listo, danado, mantenimiento]; listo → [delivery, danado]; delivery → [entregado, perdido, danado]; entregado → [recibido, perdido]; danado/perdido/mantenimiento → [planta].
- `getTransiciones(estado)` returns `TRANSICIONES[estado]` (forward lookup only — no reverse map exists yet).
- `ESTADOS_KANBAN` = [recibido, planta, recarga, listo, delivery]; `ESTADOS_EXCEPCION` = [danado, perdido, mantenimiento].

DB schema: `botellones.estado` CHECK constraint (0005) allows the 9 estados. `recargas` (0001): `cliente_id uuid NOT NULL`, `botellon_id NOT NULL`, `numero_registro text NOT NULL`, fecha/hora/`realizada_por`. `premios` unique index `uq_premios_cliente_nivel` (0003). **There is no estado-change audit/movimientos table** — pure estado moves leave no history.

Tests: `tests/component/carga-page.test.tsx` (501 lines; mocks useQrScanner/getBotellonByCodigo/getCliente/registrarCarga; covers accumulation, stale-closure dedupe, badge rendering, confirm gating, fecha/hora auto-refresh with touched refs, per-item results, success screen, no-client overlay, error-overlay lifecycle). `tests/unit/carga-registrar.test.ts` (769 lines; chained supabase-js mocks; 16 registrarCarga scenarios + 7 procesarLoyalty + 2 registrarRecarga). Scanner tested in `tests/component/use-qr-scanner.test.tsx` (fake rAF/performance timers, jsQR mock).

`registrarCarga` / `CargaState` have exactly ONE production consumer (the carga page) — safe to generalize.

## Answers to Key Questions

### 1. `registrarCarga` vs `registrarRecarga` — can REC+loyalty be reused generically?

`registrarRecarga` = single-item, FormData-shaped, one REC number, one insert, one guarded estado update, loyalty for one client. `registrarCarga` = batch, object-shaped, per-item rejection, N sequential REC from one max+1 read, array insert, `.in()` update, loyalty once per distinct client + milestone-crossing compensation + compensating delete on partial failure. `registrarCarga` is strictly a superset of the recarga logic.

The REC-numbering + insert + loyalty + milestone-compensation cluster is inherently tied to the **recarga operation** (it writes `recargas` rows and counts them for loyalty). It cannot be reused for recibido/planta/listo (those create no recargas and must NOT bump loyalty). It CAN be reused generically as the "recarga branch" of a multi-state action. Recommendation: extract the loyalty+milestone-compensation block into a shared helper (e.g. `procesarLoyaltyConCompensacion(distinctClientIds, addedByClient, actor)`) reused by `registrarRecarga` and the new action; keep the REC insert inside the recarga branch only. The REC+loyalty logic does not need to stay coupled to "entregado → recarga" — it just needs to stay coupled to the target estado `recarga`.

### 2. Valid source estados per target (reverse of `getTransiciones`)

| Operation (target) | Valid sources (via `getTransiciones`) | Notes |
|---|---|---|
| `recibido` | `entregado` | entry point; `entregado → recibido` |
| `planta` | `recibido`, `danado`, `perdido`, `mantenimiento` | also the exception-restore path |
| `recarga` | `planta` (**per the machine**) | ⚠️ TODAY the page does `entregado → recarga`, which is NOT a legal transition. Strictly deriving sources gives `{planta}` — an open decision. |
| `listo` | `recarga` | — |

**CONFLICT TO SURFACE (decision for propose):** current batch flow (`registrarCarga`) moves `entregado → recarga`. `getTransiciones('entregado')` = `[recibido, perdido]` and `getTransiciones('planta')` = `[recarga, ...]` — i.e., per the machine, recarga only accepts `planta`, and an `entregado` botellon must first go `entregado → recibido → planta → recarga`. Options: (a) add `entregado → recarga` to TRANSICIONES (machine change, touches kanban semantics elsewhere), (b) define the terminal's recarga op as accepting `{planta, entregado}` as a pragmatic superset (documented exception, validated in code but not in the machine), or (c) strict machine compliance → the terminal becomes a 4-step pipeline and "carga" changes meaning (staff scans recibido first). The user decision #4 says "valid source estados per operation need defining from the state machine" — strict reading = (c); behavior-preserving reading = (b). Must be resolved in propose, not silently.

### 3. DB-record operations vs pure estado change

- **recarga → `recargas` row** (REC number + fecha/hora/realizada_por + cliente) **plus** `botellones.estado = 'recarga'` **plus** loyalty. Needed to keep REC history + premios (clientes pages, contadores, recargas lists all depend on it).
- **recibido / planta / listo → pure `botellones.estado` update**. No recargas row, no loyalty. (Note: no audit table exists; history of these moves is lost — flagging as out-of-scope observation unless the user wants a `movimientos` table.)
- `delivery`/`entregado` targets are NOT part of this terminal (repartidor/kanban domain; `moverBotellon` already handles entregado with cliente/fecha_entrega).

### 4. Server action shape

**Recommendation: ONE generalized action** `registrarOperacion({ botellonIds, operacion, fecha, hora })` returning the existing per-item result contract extended with the operation. Rationale:
- Reuses once the proven scaffolding: server-side cliente re-derivation, dedupe, per-item reasons (`sin-cliente`, `estado-<estado>`, `error`), zero-write short-circuit, partial failure, compensating delete, revalidatePath set.
- Server-side strict validation: derive valid sources per operation from `getTransiciones` (pure import, no server deps), filter valid items, guard the estado update with `.in('estado', sources)` (plural — planta has 4 sources; recarga branch keeps `.eq('estado','entregado')`-style guard adapted to its decided sources).
- recarga branch = existing registrarCarga logic (REC + loyalty + milestone compensation). Other branches = single `.in()` estado update + revalidate only.
- `registrarCarga` has one consumer; migrate the page to the new action and update tests (Strict TDD). No wrapper needed unless a compat shim is desired during chained delivery.

One-action-per-operation (4 near-identical actions) duplicates the scaffold 4×; rejected. Keeping `registrarCarga` untouched and adding a parallel action leaves two half-overlapping paths; rejected (debt).

### 5. Files touched + 400-line budget

| File | Why | Est. delta (add+del) |
|---|---|---|
| `src/lib/utils/estados.ts` | Add `OPERACIONES` map (operacion → valid sources derived from TRANSICIONES) + optional `esTransicionValida(from, to)` | ~+20 |
| `src/lib/db/cargas.ts` | Generalize `registrarCarga` → `registrarOperacion` (branch per operacion, multi-source guard, extract loyalty helper) | ~+80–120 net |
| `src/lib/db/loyalty.ts` | Extract milestone-compensation into shared helper (tiny, optional) | ~+20 |
| `src/app/(dashboard)/recargas/carga/page.tsx` | Operation selector, scan-time green/red badges, duplicate beep+highlight, operation-scoped no-client gate, generalized confirm/success screens | ~+130–170 |
| `src/lib/scanner/beep.ts` (new) | Tiny Web Audio beep util (mockable for tests) | ~+15 |
| `tests/unit/carga-registrar.test.ts` | Migrate to new action + add per-operation scenarios (recibido/planta/listo, multi-source guard, mixed valid/invalid) | ~+150–250 |
| `tests/component/carga-page.test.tsx` | Selector, badges, beep/highlight, operation-scoped no-client, generalized success screen | ~+120–180 |

**Total estimate: ~550–750 changed lines → EXCEEDS the 400-line budget (High risk).** Recommend 2 chained PR slices: (1) backend: estados.ts + cargas.ts (+ loyalty helper) + unit tests, (2) frontend: beep util + page + component tests. Guard lines for sdd-tasks: `Decision needed before apply: Yes`, `Chained PRs recommended: Yes`, `400-line budget risk: High`.

### 6. UI structure today vs needed changes

Today: camera viewport (overlays: cameraError / noClient / decodeError) → "Sesión (n)" list (codigo, clienteNombre, estado badge, Ver ficha) → fecha/hora grid (touched refs, 30s interval) → server-error block → per-item results after failed confirm → Confirm button → success screen (count, REC list, premios, loyaltyWarning).

Needed:
1. **Operation selector** at top (segmented control: Recibido / Planta / Recarga / Listo; default **Recarga** = backward-compatible default). Plain React state; confirm payload and labels depend on it.
2. **Green badge** per item showing the target estado ("→ En recarga"): derive at render from `(item.estado, operacionActual)` via `getTransiciones(item.estado).includes(operacion)` — client-side mirror of server validation, consistent with strict decision #3, and naturally re-validates if staff switches operation mid-session (items flip green/red live).
3. **Red badge** for items whose current estado is not a valid source for the selected operation (show current estado; reuse `ESTADO_COLORS` red classes for `danado`/`perdido` style).
4. **Duplicate scan → beep + highlight**: in `onDecode`, when `scannedIdsRef.current.has(id)`, call a Web Audio beep util and set a transient `flashId` state to ring/flash the existing row (e.g. `ring-2 ring-amber-500` + CSS keyframe, cleared ~600–800ms). Return `{outcome:'failure'}` so scanning continues (hook contract unchanged — no hook changes needed).
5. **Operation-scoped no-client gate**: only the `recarga` operation requires `cliente_id` (recargas NOT NULL). recibido/planta/listo must accept clientless botellones (estado update needs no client). The current unconditional no-client overlay/block must be removed for non-recarga ops.
6. **Generalized confirm + success screens**: button label per operation; success screen shows ok-count + target estado (+ REC list / premios / loyaltyWarning only for recarga). "Ver ficha" links: keep for items with a client.

## Affected Areas

- `src/lib/utils/estados.ts` — add OPERACIONES map / `esTransicionValida`.
- `src/lib/db/cargas.ts` — generalize to `registrarOperacion`; recarga branch keeps REC+loyalty.
- `src/lib/db/loyalty.ts` — extract milestone-compensation helper (shared).
- `src/app/(dashboard)/recargas/carga/page.tsx` — the terminal UI itself.
- `src/lib/scanner/beep.ts` — new tiny Web Audio util (no hook changes).
- `src/lib/scanner/use-qr-scanner.ts` — **unchanged** (onDecode lifecycle already supports continued scanning on `failure` outcomes).
- `tests/component/carga-page.test.tsx`, `tests/unit/carga-registrar.test.ts` — migrate + extend.
- `openspec/specs/batch-carga/spec.md` — will need delta-spec updates in sdd-spec (behavior extends batch-carga requirements: confirm transition requirement "entregado→recarga unchanged" is directly affected by the recarga-source decision).

## Approaches

1. **Single generalized action + one-page terminal (recommended)** — `registrarOperacion({botellonIds, operacion, fecha, hora})`; page becomes the multi-state terminal; strict server validation from `getTransiciones`; REC+loyalty only in the recarga branch.
   - Pros: one scaffold, one contract, server and client validate from the same pure machine; recarga behavior preserved (REC, loyalty, milestone compensation); existing tests migrate cleanly; `useQrScanner` untouched.
   - Cons: action signature changes (page + unit tests churn); requires the recarga-source decision before implementation; pure moves lack history (no audit table).
   - Effort: Medium–High (largest delta is tests + page).

2. **One action per operation** — `registrarRecibido`, `registrarPlanta`, `registrarRecarga` (existing, renamed), `registrarListo`.
   - Pros: per-op isolation; minimal change to registrarRecarga.
   - Cons: 4× duplication of dedupe/rejection/compensation/revalidate scaffolding; more surface to test; drift risk.
   - Effort: Medium (but higher long-term debt).

3. **Keep registrarCarga untouched; add parallel registrarOperacion; page switches** — two coexisting paths.
   - Pros: zero risk to existing behavior during migration.
   - Cons: two overlapping actions to maintain; orphaned code after page migrates; violates "no shortcuts" hygiene.
   - Effort: Low–Medium (debt).

## Recommendation

Approach 1, delivered in **2 chained PR slices** (backend first, then frontend) to respect the 400-line review budget. Before sdd-propose, resolve the **recarga source-estados decision** (strict `{planta}` vs pragmatic `{planta, entregado}`) with the user — it is the only decision that changes observable behavior of today's screen.

## Risks

- **Recarga source conflict (highest)**: today's screen moves `entregado → recarga`; the machine allows only `planta → recarga`. Resolving this changes what staff can scan in "Recarga" mode or requires a machine change. Must be a user-facing decision in propose.
- **Web Audio autoplay policy**: an AudioContext created from the camera decode loop may start `suspended` (no user gesture); beep may not sound. Mitigation: lazily create/resume the context on the first scanner mount interaction or the first beep attempt, and mock AudioContext in tests (jsdom has none).
- **Race with other operators**: an item validated green at scan time may be moved by another terminal before confirm; the server `.in('estado', sources)` guard + per-item `estado-<estado>` rejection must remain the source of truth (already the design).
- **Clientless items**: recarga requires `cliente_id`; other ops must not reject them. Changing the unconditional no-client gate is a visible behavior change — tests for the current overlay must be updated, not just extended.
- **No audit trail** for pure estado moves (no movimientos table). Acceptable if out of scope; flag if the user wants traceability.
- **Line budget**: ~550–750 estimated changed lines → High 400-line risk → chained PRs (backend / frontend).
- **Test churn**: 769-line unit + 501-line component suites are heavily coupled to `registrarCarga`/single-operation semantics; migration is the bulk of the work, not the feature itself.

## Ready for Proposal

Yes — with one user decision carried forward: the valid source estados for the `recarga` operation (strict machine `{planta}` vs pragmatic `{planta, entregado}`), and confirmation that pure estado moves need no history table in this change.
