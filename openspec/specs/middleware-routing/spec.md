# Middleware Routing Specification

## Purpose

Modernize the middleware layer from the deprecated Next.js middleware API to the Next.js 16 `proxy` convention, preserving all existing auth guards, route protections, and redirect behavior.

## Requirements

### Requirement: Proxy-Based Route Protection

Route protection logic SHALL be implemented via a Next.js 16 `proxy` export instead of the deprecated `middleware` function. The proxy SHALL preserve the same auth gating and redirect rules as the current middleware.

#### Scenario: Unauthenticated user is redirected to login

- GIVEN a user is not authenticated (no valid session cookie)
- WHEN the user requests a protected route (e.g., `/botellones`, `/recargas`)
- THEN the proxy redirects the request to `/login`
- AND the redirect preserves the intended destination as a query parameter for post-login return

#### Scenario: Authenticated user accesses protected routes

- GIVEN a user has a valid Supabase auth session
- WHEN the user requests `/botellones` or any other protected route
- THEN the proxy allows the request through without intervention
- AND the route renders normally

#### Scenario: Public routes are accessible without auth

- GIVEN a user is not authenticated
- WHEN the user requests `/login` or other public routes (e.g., static assets)
- THEN the proxy allows the request through without redirect
- AND no auth check is performed

#### Scenario: E2E auth tests still pass after migration

- GIVEN the middleware has been migrated from `middleware.ts` to `proxy.ts`
- WHEN the 8 login-related Playwright E2E tests run
- THEN all 8 tests pass
- AND no auth flow regressions are introduced
