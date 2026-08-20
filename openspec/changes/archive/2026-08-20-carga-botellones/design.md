# Design: Batch QR "carga" for botellones (Commit 2 — frontend)

## Technical Approach

Approach 1 (locked): transient client-side batch session. Extract the camera/decode loop from `scanner-modal.tsx` into a shared `useQrScanner` hook; build `/recargas/carga` that scans → accumulates → confirms ONE uniform recarga via the committed `registrarCarga` server action; add a `Recarga`|`Carga` toggle to the modal. Zero schema/migration. `/recargas/nueva` stays untouched.

Consumes the committed contracts from `src/lib/db/cargas.ts`: `registrarCarga({botellonIds, fecha, hora}) → Promise<CargaState>`, `CargaState`, `CargaItemResult`. Reuses `parseQrCode` and `getBotellonByCodigo`.

## Architecture Decisions

### Decision: Extract `useQrScanner` as shared hook
**Choice**: New `src/lib/scanner/use-qr-scanner.ts` owning getUserMedia + rAF decode loop; modal + page both consume it.
**Alternatives**: Duplicate the loop in the page (rejected: ~100-line drift, two camera paths).
**Rationale**: Single proven decode path; existing 17-modal / 3-island / 7-mobile-nav suites guard the refactor; additive.

### Decision: Transient client-side session (React state)
**Choice**: `items[]`, `fecha`, `hora` in `useState`; confirm posts ids to `registrarCarga`.
**Alternatives**: Extend `/recargas/nueva` wizard (rejected — it is cliente-centric, batch is multi-client); server-persisted draft session (rejected — needs schema, contradicts zero-migration).
**Rationale**: Matches the server action's array contract; matches the project's transient session patterns; no DB.

### Decision: Handler-driven accumulation (no setState-in-effect)
**Choice**: `items[]` mutated in `onDecode`/handlers only.
**Rationale**: Complies with `react-patterns` spec (the current `/recargas/nueva` uses eslint-disabled effect-setState; do NOT copy that). Lockout handles dedupe at hook level; in-session dedupe checked in the page handler.

### Decision: Toggle lives in modal; island/mobile-nav pass through
**Choice**: `scanner-modal.tsx` owns the mode toggle; island + mobile-nav unchanged (only import the modal).
**Rationale**: Both entries open the same modal; keeps their regression suites untouched. `Carga` mode is a pure handoff: `onClose()` + `router.push('/recargas/carga')`, no decode processing.

### Decision: New route under `(dashboard)` is auto-protected
**Choice**: `src/app/(dashboard)/recargas/carga/page.tsx`; no proxy change.
**Rationale**: `src/proxy.ts` gates the whole `(dashboard)` group; confirmed by exploration. `getSessionRole` not needed by this client component.

## Data Flow

```
useQrScanner: getUserMedia → rAF(≤15fps, ≤640px) → jsQR → onDecode(raw)
   onDecode: parseQrCode(raw) ─invalid→ decodeError=invalid-code (keep scanning)
            getBotellonByCodigo(codigo) ─null→ not-found (keep scanning)
                        ─no cliente_id→ no-client overlay → link /botellones/[id]
                        ─ok→ handler: dedupe → append {id,codigo,cliente} to items[]
Confirm: registrarCarga({botellonIds, fecha, hora}) → CargaState
   success:true → success screen (count, REC# list, premios, loyaltyWarning)
   success:false → per-item CargaItemResult (ok→REC#; rejected→reason + sin-cliente→"Asignar cliente" →/botellones/[id])
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/scanner/use-qr-scanner.ts` | Create | Hook: `{ videoRef, cameraError, decodeError, setDecodeError, stop }`, options `{ onDecode, onInvalidCode?, lockoutMs? }`. Preserve decode/lockout/StrictMode cleanup exactly. |
| `src/app/(dashboard)/recargas/carga/page.tsx` | Create | `'use client'` batch page; `useActionState(registrarCarga, null)`; session state; camera + items list + fecha/hora + per-item results + success screen. |
| `src/components/scanner/scanner-modal.tsx` | Modify | Refactor onto `useQrScanner`; add `Recarga`\|`Carga` toggle; `Carga` handoff; preserve single-flow redirect + no-client overlay + ERROR_COPY. |
| `src/components/scanner/scanner-island.tsx` | Modify (no-op) | Unchanged behavior; still opens modal. |
| `src/components/navigation/mobile-nav.tsx` | Modify (no-op) | Unchanged behavior; still opens modal. |
| `tests/component/use-qr-scanner.test.tsx` | Create | Hook lifecycle (fake rAF/perf, jsQR mock). |
| `tests/component/carga-page.test.tsx` | Create | Page with mocked hook/action/db. |
| `tests/e2e/carga.spec.ts` | Create (optional) | Chromium camera stub. |

## Interfaces / Contracts

```ts
// use-qr-scanner.ts
type QrScanError = 'permission-denied' | 'camera-unavailable' | 'invalid-code' | 'not-found';
type UseQrScannerOptions = {
  onDecode: (raw: string) => Promise<{ outcome: 'ok' } | { outcome: 'failure' }> | void;
  onInvalidCode?: () => void;
  lockoutMs?: number; // default 1000
};
type UseQrScanner = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraError: 'permission-denied' | 'camera-unavailable' | null;
  decodeError: QrScanError | null;
  /** Lets the caller surface not-found / no-client while scanning continues. */
  setDecodeError: (error: QrScanError | null) => void;
  stop: () => void;
};
```
`onDecode` returns an outcome so the hook pauses the loop during async resolution and resumes on failure (spec `qr-scanner-hook`). `no-client` is a caller-side outcome, not a hook error type.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (component) | `useQrScanner` lifecycle | RTL `renderHook` + user-event; fake rAF/perf timers, `jsQR` mock, `getUserMedia` mock (pattern: `scanner-modal.test.tsx`) |
| Unit (component) | `/recargas/carga` page | Mock `useQrScanner` (camera lifecycle passthrough) + mock `registrarCarga` + mock db lookups; assert accumulation, dedupe, uniform fecha/hora, confirm disabled states, per-item results, success screen, no-client link |
| Regression | scanner-modal (17) / island (3) / mobile-nav (7) / carga-registrar (27) | Must stay green post-refactor; extend scanner-modal with toggle + handoff scenarios |
| E2E (optional) | batch scan | Playwright chromium camera stub (mirror `scanner.spec.ts`) |

## Threat Matrix

N/A — the change adds a route under the existing protected `(dashboard)` group; it does not change routing logic, shell commands, subprocesses, VCS/PR automation, or executable-file classification. Proxy file untouched.

## Migration / Rollout

No migration required. Frontend-only additive change. `/recargas/nueva` single flow untouched.

## Rollback Boundary

Frontend-only revert: restore `scanner-modal.tsx` from `main` if the hook refactor regresses (extraction is additive); delete `use-qr-scanner.ts`, `carga/page.tsx`, and new tests. Backend (`registrarCarga`) stays callable and is unaffected.

## Open Questions

- [ ] Confirm default fecha/hora: prefill today's date in the `fecha` input for convenience (non-blocking).
- [ ] Whether the optional `tests/e2e/carga.spec.ts` lands in Commit 2 or is deferred.
