# E2E Testing Specification

## Purpose

Restore the Playwright E2E test suite from 17/28 passing to 28/28 by seeding required test fixtures and fixing brittle selectors, including the mobile overlay and heading labels in quick-recarga flows.

## Requirements

### Requirement: E2E Test Data Seeding

The test database SHALL be seeded with canonical test entities — María Rodríguez (client), Carlos Pérez (client), and BOT-00001 (botellón) — before Playwright tests execute.

#### Scenario: Recarga flow finds test client

- GIVEN the Playwright test suite starts with an empty or reset database
- WHEN the seed script inserts María Rodríguez and Carlos Pérez into the `clientes` table
- THEN tests that search for "María" or "Carlos" find matching records
- AND recarga assignment tests pass without "client not found" errors

#### Scenario: Quick-recarga flow finds test botellón

- GIVEN the seed script inserts BOT-00001 into the `botellones` table with a valid QR code
- WHEN a test navigates the rapid-recarga flow
- THEN the botellón is selectable from the dropdown or search results
- AND tests complete without "botellón not found" errors

### Requirement: Reliable Mobile Overlay Selectors

The "Seleccionar botellón" heading SHALL be visible and selectable in mobile-viewport Playwright tests, even when a drawer or overlay is present.

#### Scenario: Heading is clickable in mobile viewport

- GIVEN a Playwright test sets viewport to mobile width (e.g., 375px)
- AND the quick-recarga flow opens a bottom sheet or drawer
- WHEN the test attempts to locate "Seleccionar botellón" heading
- THEN the heading is visible and not obscured by overlays or `pointer-events: none`
- AND `page.getByRole('heading', { name: 'Seleccionar botellón' })` resolves within the timeout

#### Scenario: Full suite passes after fixes

- GIVEN seed data is present and selectors are fixed
- WHEN `npx playwright test` runs
- THEN 28 of 28 tests pass (up from 17/28)
- AND all 12 login + botellones regression tests still pass
