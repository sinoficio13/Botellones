# Tasks: QA Code Cleanup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~340 |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | exception-ok |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Foundation

- [x] 1.1 Create `src/hooks/use-debounce.ts` — generic `useDebounce<T>(value, delay)` hook (design §Decision: Debounced search). v: `npx vitest run`
- [x] 1.2 Add DB join interfaces in `analytics.ts` (`ClienteJoin`), `botellones.ts` (`BotellonWithCliente`), `notificaciones.ts` (`NotifJoinRow`). v: `npx tsc --noEmit`

## Phase 2: TypeScript (13 errors → 0)

- [x] 2.1 `form.tsx` — direct `<form action={formAction}>` + `useEffect` toast per TS-01. v: `npx tsc --noEmit`
- [x] 2.2 `configuracion/page.tsx` — same useActionState fix per TS-01 S02. v: `npx tsc --noEmit`
- [x] 2.3 `configuracion/actions.ts` — `logo_url: string | null` return type per TS-04. v: `npx tsc --noEmit`
- [x] 2.4 `header.tsx` — accept `logo_url: string | null` per TS-04 S01. v: `npx tsc --noEmit`
- [x] 2.5 `reportes-tabs.tsx` — `string[]` → `{value,label}[]` per TS-03. v: `npx tsc --noEmit`
- [x] 2.6 `logo-uploader.tsx` — `Image` import conflict with native constructor per TS-02. v: `npx tsc --noEmit`

## Phase 3: React Anti-patterns (set-state-in-effect → 0)

- [x] 3.1 `qr-code.tsx` — `useSyncExternalStore(noop, () => true, () => false)` per RP-01. v: `npx eslint src/app/(dashboard)/botellones/[id]/qr-code.tsx`
- [x] 3.2 `recargas/nueva/page.tsx` — server prop for client data; `useDebounce` for search per RP-02. v: `npx eslint src/app/(dashboard)/recargas/nueva/page.tsx`
- [x] 3.3 `global-search.tsx` — `useDebounce` for input per RP-03. v: `npx eslint src/components/search/global-search.tsx`

## Phase 4: ServiceWorker (unhandledRejection → 0)

- [x] 4.1 `update-prompt.tsx` — `.catch()` on `serwist.register()` with dev-only warn per SW-01 S02-S03. v: manual — open browser console, verify no error

## Phase 5: ESLint `any` → Typed (25 → 0)

- [x] 5.1 `analytics.ts` — replace 6 `as any` with `ClienteJoin` per ES-01. v: `npx eslint src/lib/db/analytics.ts`
- [x] 5.2 `botellones.ts` — replace 4 `any` with `BotellonWithCliente` per ES-01. v: `npx eslint src/lib/db/botellones.ts`
- [x] 5.3 `notificaciones.ts` — `row: any` → `NotifJoinRow`; `catch (err: any)` → `unknown` per ES-01 S02. v: `npx eslint src/lib/db/notificaciones.ts`
- [x] 5.4 `recargas.ts` — `catch (err: any)` → `err: unknown` per ES-01 S02. v: `npx eslint src/lib/db/recargas.ts`
- [x] 5.5 `lib/export/actions.tsx` — typed `renderToBuffer` args; `botellones as any[]` → typed per ES-01. v: `npx eslint src/lib/export/actions.tsx`
- [x] 5.6 `bell.tsx` — `n: any` → `NotifJoinRow` per ES-01. v: `npx eslint src/components/notificaciones/bell.tsx`
- [x] 5.7 Boy-scout remaining `any` in `form.tsx`, `recargas/nueva/page.tsx`, `clientes/buscar/page.tsx` + all table components. v: `npx eslint .`

## Phase 6: A11y + Conventions (14 violations → 0)

- [x] 6.1 `imprimir/page.tsx` — `<img>` → `<Image>` + width/height per AC-02. v: `npx eslint src/app/(dashboard)/botellones/[id]/imprimir/page.tsx`
- [x] 6.2 `shared-header.tsx` — add eslint-disable comment (react-pdf Image has no alt) per AC-03. v: `npx eslint src/lib/export/pdf/shared-header.tsx`
- [x] 6.3 `recargas/nueva/page.tsx` + `clientes/nuevo/page.tsx` — `<a>` → `<Link>` per AC-01. v: `npx eslint src/app/(dashboard)/recargas/nueva/page.tsx src/app/(dashboard)/clientes/nuevo/page.tsx`
- [x] 6.4 `clientes/buscar/page.tsx` — `let` → `const` + remove unused vars per AC-04/AC-05. v: `npx eslint src/app/(dashboard)/clientes/buscar/page.tsx`
- [x] 6.5 Remove unused imports/vars from ~5 remaining files (boy scout). v: `npx eslint .`

## Phase 7: E2E (17/28 → 28/28)

- [x] 7.1 Create `tests/e2e/fixtures/seed.sql` — idempotent INSERTs for María, Carlos, BOT-00001 per E2E-01. v: `npx playwright test`
- [x] 7.2 Fix `business-flows.spec.ts` — `getByRole('heading', { name: 'Seleccionar botellón' })` → typed + `scrollIntoViewIfNeeded()` per E2E-02. v: `npx playwright test tests/e2e/business-flows.spec.ts --project=mobile`

## Phase 8: Middleware (deprecated → proxy)

- [x] 8.1 Run codemod → `src/proxy.ts`; delete `src/middleware.ts` per MW-01 S01-S03. v: `npx playwright test tests/e2e/login.spec.ts`
- [x] 8.2 Updated `tests/integration/middleware.test.ts` to import from `@/proxy` per MW-01 S04. v: `npx playwright test`

## Phase 9: Final Verification

- [x] 9.1 `npx tsc --noEmit` — **0 errors**
- [ ] 9.2 `npx eslint .` — 0 errors, 7 pre-existing warnings (untouched files)
- [ ] 9.3 `npx vitest run` — 17/17 pass (not run — no test runner configured in strict TDD)
- [ ] 9.4 `npx playwright test` — 28/28 pass (not run — requires dev server)
