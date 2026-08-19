# Design: QA Code Cleanup

## Technical Approach

Fix in priority-batched commits. Batch 1 (TypeScript) unblocks compilation; Batch 2 (SW) stops runtime crashes; Batch 3 (React) eliminates cascading renders; Batch 4 (ESLint any) hardened types; Batches 5-7 (a11y, E2E, middleware) polish the surface. Every batch ends with `tsc --noEmit && eslint .` green. Boy scout rule: each touched file also gets its `any`, `let→const`, and unused-import fixes in the same commit.

## Architecture Decisions

### Decision: useActionState fix strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Remove wrapper, use `formAction` directly + `useEffect(() => { if (state?.success) setShow(true) }, [state])` | Triggers 1 extra render on success; semantically correct for side-effect-driven UI | **Chosen** |
| Keep wrapper `handleAction(prev, fd)` calling internal `formAction` | Fails TS because `formAction` has `(FormData) => void` not `(prev, fd)` | Rejected |
| Use `startTransition` + manual state | Reinvents useActionState | Rejected |

**Rationale**: React 19's `useActionState` returns a `formAction` meant to be passed directly to `<form action>`. The old wrapper pattern `formAction(prev, fd)` no longer type-checks. Replacing with state-driven `useEffect` for the toast is a legitimate side-effect (not derived-state anti-pattern) — toasts ARE effects, not computed values.

Files: `form.tsx` + `configuracion/page.tsx` remove `handleAction`, use direct `<form action={formAction}>`, add `useEffect` reacting to `state?.success`.

### Decision: QR code mount detection

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `useSyncExternalStore(() => () => {}, () => true, () => false)` | Zero deps, no extra render, standard React 19 pattern | **Chosen** |
| `useEffect(() => setMounted(true), [])` | Triggers ESLint set-state-in-effect; extra render | Rejected |
| `suppressHydrationWarning` | Hides the symptom, doesn't fix the cause | Rejected |

**Rationale**: `useSyncExternalStore` with noop subscribe + static snapshots is the recommended React 19 hydration guard. No extra render, no ESLint violation.

### Decision: Debounced search in recargas + global-search

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extract `useDebounce<T>(value, delay)` custom hook | Clean separation, reusable; still has `useEffect` internally | **Chosen** |
| TanStack Query | Adds dependency for a simple debounce; overkill | Rejected |
| Remove debounce, fetch on every keystroke | Performance regression; wrong UX | Rejected |

**Rationale**: Debouncing IS async/side-effect logic — extracting it into a named hook (`useDebounce`) separates concerns. The component goes from `useEffect` with inline timeout → `const debouncedSearch = useDebounce(search, 300)`. The data-fetching `useEffect` then depends on `debouncedSearch` (a clean derived value), not raw `search`.

### Decision: Serwist dev-mode suppression

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `.catch()` on registration + `NODE_ENV` check | 2 lines; logs warn in dev, nothing in prod | **Chosen** |
| Generate `/sw.js` in dev via next.config | Heavy — requires `@serwist/next` integration in webpack/turbopack, slows dev startup | Rejected |
| `typeof window !== 'undefined'` guard only | Still rejects on 404 in dev | Rejected |

**Rationale**: `update-prompt.tsx` line 42: `serwist.register()` returns a promise that rejects when `/sw.js` returns 404. Adding `.catch(err => { if (process.env.NODE_ENV !== 'production') console.warn('[SW] dev mode — skipping', err.message) })` satisfies REQ-SW-01 and S02-S03.

### Decision: Middleware → Proxy migration

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `npx @next/codemod@canary middleware-to-proxy` + manual verify | Codemod handles rename/convention; manual verify of 8 login E2E tests | **Chosen** |
| Manual rewrite | Error-prone; no benefit | Rejected |

**Rationale**: Next.js 16 codemod automates the deprecated API migration. Manually verify all auth E2E tests (8 login + 12 business flows) still pass.

### Decision: `any` type replacement strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Define local join-result interfaces next to each DB module | Type-safe, no external dep, localized | **Chosen** |
| Full Database type generation via supabase CLI | Heavy setup; overkill for 25 `any` spots | Rejected |

**Rationale**: Most `any` occurrences are Supabase join results like `(b.clientes as any)?.nombre`. Define interfaces such as `type ClienteJoin = { nombre: string; telefono_1: string | null }` in each DB module. For `catch (err: any)` → `catch (err: unknown)` with `err instanceof Error` narrowing (already done in `clientes.ts`).

## Data Flow

```
useActionState fix:
  <form action={formAction}>  →  server action  →  returns BotellonState
         ↓                                              ↓
  useActionState returns [state, formAction, pending]
         ↓
  useEffect watches state?.success  →  setShowSuccess toast

QR code mount:
  useSyncExternalStore(noop, () => true, () => false)
         ↓
  mounted === true on client  →  render QRCodeSVG

Debounced search:
  user input  →  useDebounce(search, 300)  →  useEffect fetches data
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(dashboard)/botellones/[id]/form.tsx` | Modify | Remove handleAction wrapper; direct formAction; state-driven toast |
| `src/app/(dashboard)/configuracion/page.tsx` | Modify | Same useActionState pattern; remove handleAction |
| `src/app/(dashboard)/configuracion/actions.ts` | Modify | Fix `getConfig` return type: `logo_url: string \| null` |
| `src/components/shared/header.tsx` | Modify | `getConfig` return type `logo_url: string \| null`; coerce `undefined` from `logo_url \|\| undefined` |
| `src/components/reportes/reportes-tabs.tsx` | Modify | Map string[] tipos → `{value,label}[]`; fix `b: any` → typed join result |
| `src/app/(dashboard)/botellones/[id]/qr-code.tsx` | Modify | Replace useEffect-setMounted with useSyncExternalStore |
| `src/app/(dashboard)/recargas/nueva/page.tsx` | Modify | Extract useDebounce hook; fix useActionState toast pattern; `<a>` → `<Link>`; fix `x: any` |
| `src/components/search/global-search.tsx` | Modify | Extract useDebounce; keep outside-click listener as subscription |
| `src/components/pwa/update-prompt.tsx` | Modify | Add `.catch()` on SW registration |
| `src/lib/db/analytics.ts` | Modify | Type `ClienteJoin` interface; replace 6 `as any` |
| `src/lib/db/botellones.ts` | Modify | Type `BotellonWithCliente` for joined select; replace 4 `any` |
| `src/lib/db/clientes.ts` | Modify | `catch (err)` already uses `instanceof` — no change needed |
| `src/lib/db/notificaciones.ts` | Modify | Type `NotifJoinRow` interface; replace `row: any` and `catch (err: any)` |
| `src/lib/db/recargas.ts` | Modify | `catch (err: any)` → `err: unknown` |
| `src/lib/export/actions.tsx` | Modify | `renderToBuffer(document as any)` → proper ReactElement type; `r: any` → typed; `botellones as any[]` → typed |
| `src/components/notificaciones/bell.tsx` | Modify | `n: any` → `NotifRawRow` interface |
| `src/app/(dashboard)/botellones/[id]/imprimir/page.tsx` | Modify | `<img>` → `<Image>` + width/height |
| `src/components/pdf/shared-header.tsx` | Modify | Add `alt` to `<Image>` |
| `src/app/(dashboard)/clientes/buscar/page.tsx` | Modify | `let` → `const`; unused vars |
| Various page files (~5) | Modify | Remove unused imports/vars; `<a>` → `<Link>` |
| `src/middleware.ts` | **Delete** | Replaced by proxy.ts |
| `src/proxy.ts` | **Create** | Codemod output from middleware.ts; verify auth behavior |
| `e2e/seed.ts` or `e2e/fixtures/seed.sql` | **Create** | Seed María Rodríguez, Carlos Pérez, BOT-00001 |
| `tests/e2e/business-flows.spec.ts` | Modify | Fix mobile overlay selector for "Seleccionar botellón" heading |

## Interfaces / Contracts

```ts
// ── DB join types (new, per module) ──

// analytics.ts
type ClienteJoin = { nombre: string; telefono_1?: string | null };

// botellones.ts
type BotellonWithCliente = {
  id: string; codigo: string; estado: string;
  cliente_id: string | null; fecha_creacion: string;
  clientes: ClienteJoin | null;
};

// notificaciones.ts
type NotifJoinRow = {
  id: string; usuario_id: string; tipo: string; titulo: string;
  mensaje: string | null; cliente_id: string | null;
  botellon_id: string | null; leida: boolean; creada_en: string;
  clientes: ClienteJoin | null;
  botellones: { codigo: string } | null;
};

// ── useDebounce hook (new, src/hooks/use-debounce.ts) ──
function useDebounce<T>(value: T, delay: number): T;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `useDebounce` hook | vitest — debounce timing (fake timers) |
| Unit | DB join type guards | vitest — type narrowing assertions |
| TypeScript | All 25 `any` removed | `tsc --noEmit` zero errors |
| Lint | 39 errors + 19 warnings fixed | `eslint .` zero errors/warnings |
| E2E | Seed data loads | Playwright — `beforeAll` seed, verify María/Carlos/BOT-00001 |
| E2E | Auth after middleware migration | 8 login tests + 12 business flows all pass |
| Manual | SW registration in dev | Check console: no unhandledRejection, warn-level log only |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Middleware→proxy is a refactor of existing Next.js routing, not a new boundary.

## Migration / Rollout

- No database migration. Seed script is additive (idempotent — uses `ON CONFLICT DO NOTHING`).
- Middleware migration: run codemod, create `proxy.ts`, delete `middleware.ts`. No config changes needed.
- Rollback: `git revert` per batch commit.

## Open Questions

None — all technical unknowns resolved through codebase analysis and React 19 / @supabase/ssr documentation.
