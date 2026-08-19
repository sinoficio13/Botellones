# ServiceWorker Specification

## Purpose

Manage the ServiceWorker lifecycle via Serwist to provide PWA capabilities (offline caching, installability) without throwing unhandled rejections when the SW script is unavailable in development.

## Requirements

### Requirement: Graceful ServiceWorker Registration

The application SHALL attempt to register the Serwist-generated ServiceWorker and MUST NOT throw an unhandled rejection when `/sw.js` returns a 404.

#### Scenario: ServiceWorker registers successfully in production

- GIVEN a production build where Serwist has generated `/sw.js`
- WHEN the browser navigates to any page
- THEN the Serwist registration call resolves with a `ServiceWorkerRegistration` object
- AND the PWA install prompt becomes available after the SW activates

#### Scenario: ServiceWorker 404 does not crash the page in development

- GIVEN a development server where Serwist does NOT generate `/sw.js`
- WHEN the browser navigates to any page
- THEN the registration attempt is silently caught or suppressed
- AND no `unhandledRejection` appears in the browser console
- AND the application continues to render and function normally

#### Scenario: ServiceWorker registration failure is recoverable

- GIVEN the browser blocks ServiceWorker registration (e.g., incognito mode or insecure context)
- WHEN the Serwist registration promise rejects
- THEN the error is caught and logged at `warn` level
- AND no user-facing error state is triggered

### Requirement: Serwist Dev-Mode Configuration

The Serwist integration SHALL detect the environment and skip SW generation in development, or SHALL generate `/sw.js` in dev mode so registration never hits a 404.

#### Scenario: Dev server does not serve a 404 for SW

- GIVEN `next dev` is running
- WHEN the browser requests `/sw.js`
- THEN either a valid ServiceWorker script is served (generated in dev), OR the Serwist registration call is disabled entirely in dev mode
- AND the chosen approach is documented in a code comment at the registration site
