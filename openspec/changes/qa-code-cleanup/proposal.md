# Proposal: QA Code Cleanup

## Intent

Fix 50+ issues found in a full QA scan of Botellón (Next.js 16.3 + React 19 + Supabase + Serwist). Issues range from runtime errors on every page to TypeScript compilation failures, ESLint violations, failing E2E tests, and deprecated middleware.

## Scope

### In Scope
- Fix 13 TypeScript errors blocking compilation (useActionState API, Supabase client, type mismatches)
- Fix ServiceWorker 404 runtime error (unhandled rejection on every page)
- Fix 39 ESLint errors (no-explicit-any, set-state-in-effect, no-html-link-for-pages, prefer-const)
- Fix 19 ESLint warnings (no-unused-vars, no-img-element, jsx-a11y/alt-text)
- Fix 11 failing Playwright E2E tests (seed data, selectors, overlay)
- Migrate middleware.ts from deprecated Next.js 16 API to `proxy`
- Apply boy scout rule to every touched file

### Out of Scope
- New features or UI changes
- Performance optimization beyond fixing cascading renders
- Test coverage expansion (vitest already at 17/17)
- PWA offline strategy beyond fixing the ServiceWorker registration

## Capabilities

### New Capabilities
- `service-worker`: ServiceWorker lifecycle management via Serwist for PWA support

### Modified Capabilities
None — this is a cleanup change. No spec-level behavior is changing.

## Approach

Fix in priority batches:

1. **TypeScript compilation** — Fix useActionState signatures (React 19 API), Supabase client instantiation, and type mismatches. Unblocks all other work.
2. **ServiceWorker** — Configure Serwist to generate `/sw.js` in dev or suppress registration gracefully when unavailable.
3. **React anti-patterns** — Eliminate `set-state-in-effect` (cascading renders in qr-code, recargas/nueva, global-search) by deriving state instead.
4. **ESLint cleanup** — Replace `any` with proper types, swap `<a>` for `<Link>`, fix const/let, remove unused imports, replace `<img>` with `<Image>`, add alt text.
5. **E2E seed data** — Add test fixtures for María Rodríguez, Carlos Pérez, BOT-00001, and fix mobile overlay selector.
6. **Middleware migration** — Replace deprecated middleware with Next.js 16 `proxy` convention.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/botellones/[id]/form.tsx` | Fixed | useActionState API, any types |
| `src/app/configuracion/logo-uploader.tsx` | Fixed | Supabase client, any types |
| `src/app/configuracion/page.tsx` | Fixed | useActionState API |
| `src/components/reportes/reportes-tabs.tsx` | Fixed | Type mismatch (string vs {value,label}) |
| `src/components/shared/header.tsx` | Fixed | logo_url type (string\|null vs undefined) |
| `src/components/shared/qr-code.tsx` | Fixed | set-state-in-effect |
| `src/app/recargas/nueva/page.tsx` | Fixed | set-state-in-effect, any types |
| `src/app/recargas/listado/...` | Fixed | any types |
| `src/components/shared/global-search.tsx` | Fixed | set-state-in-effect |
| `src/app/clientes/buscar/page.tsx` | Fixed | prefer-const, any types |
| `src/app/clientes/nuevo/...` | Fixed | no-html-link-for-pages |
| `src/app/botellones/[id]/imprimir/...` | Fixed | no-img-element |
| `src/components/pdf/shared-header.tsx` | Fixed | jsx-a11y/alt-text |
| `~12 other files` | Fixed | no-explicit-any, unused vars |
| `sw.ts` / serwist config | Fixed | ServiceWorker 404 |
| `src/middleware.ts` | Migrated | Deprecated API → proxy |
| `e2e/` test fixtures | Added | Seed data for 11 failing tests |
| `e2e/` selectors | Fixed | Mobile overlay + heading selectors |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| useActionState fix changes form behavior | Low | Confirm against React 19 docs; vitest 17/17 as safety net |
| Serwist config may need build verification | Med | Test in dev + production build before closing |
| Middleware migration may affect auth flow | Med | Validate all 8 login E2E tests still pass |
| "any" replacements may expose deeper type issues | Low | Replace incrementally, run tsc after each file |

## Rollback Plan

- Git revert the change branch. Each batch is a separate commit — revert by batch.
- TypeScript fixes are mechanical — revert is a single command.
- ServiceWorker change: restore previous sw.ts and next.config if registration issues surface.

## Dependencies

- React 19 `useActionState` documentation for correct API signature
- Serwist dev-mode configuration reference
- Next.js 16 middleware → proxy migration guide

## Success Criteria

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npx eslint .` passes with zero errors and zero warnings
- [ ] No `unhandledRejection` in browser console on any page
- [ ] `npx playwright test` — 28/28 pass (up from 17/28)
- [ ] vitest 17/17 still pass
- [ ] Login + botellones E2E tests still pass (12/12 regression)
