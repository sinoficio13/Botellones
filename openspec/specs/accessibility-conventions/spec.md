# Accessibility & Next.js Conventions Specification

## Purpose

Fix 14 ESLint violations related to Next.js component usage and web accessibility, enforcing semantic HTML, proper image attributes, and immutable bindings.

## Requirements

### Requirement: Next.js `<Link>` for Internal Navigation

Internal page navigations SHALL use the Next.js `<Link>` component instead of raw `<a>` tags to enable client-side routing and prefetching.

#### Scenario: Recargas page links to internal routes

- GIVEN `recargas/nueva/page.tsx` contains `<a href="/...">` for internal navigation
- WHEN the anchor is replaced with `<Link href="/...">`
- THEN `eslint` reports zero `no-html-link-for-pages` errors
- AND navigation triggers client-side routing without full page reload

#### Scenario: Clientes page uses Link for navigation

- GIVEN `clientes/nuevo/` contains `<a>` tags pointing to internal app routes
- WHEN replaced with the `<Link>` component from `next/link`
- THEN no ESLint errors remain
- AND link prefetching works automatically

### Requirement: Next.js `<Image>` for Optimized Images

All static or dynamic images SHALL use the Next.js `<Image>` component instead of raw `<img>` tags for automatic optimization and layout stability.

#### Scenario: Botellón print page uses optimized image

- GIVEN `botellones/[id]/imprimir/` contains an `<img>` tag
- WHEN replaced with `<Image>` from `next/image` with explicit `width` and `height`
- THEN `eslint` reports zero `no-img-element` errors
- AND the image loads with proper Cumulative Layout Shift prevention

### Requirement: Accessible Images with Alt Text

All `<img>` and `<Image>` elements SHALL include a descriptive `alt` attribute. Decorative images MAY use `alt=""`.

#### Scenario: PDF shared header has alt text

- GIVEN `components/pdf/shared-header.tsx` renders an image without `alt`
- WHEN an `alt` attribute describing the logo or branding is added
- THEN `eslint` reports zero `jsx-a11y/alt-text` warnings
- AND screen readers announce the image purpose correctly

### Requirement: Immutable Bindings Prefer `const`

Variables that are never reassigned SHALL be declared with `const` instead of `let`.

#### Scenario: Search page uses const for stable reference

- GIVEN `clientes/buscar/page.tsx` declares a variable with `let` that is never reassigned
- WHEN changed to `const`
- THEN `eslint` reports zero `prefer-const` errors
- AND the code expresses immutability intent at the declaration site

### Requirement: No Unused Imports or Variables

Every import and variable declaration SHALL be referenced in the module. Unused identifiers MUST be removed.

#### Scenario: Clean imports across the codebase

- GIVEN 7 files contain unused imports or variable declarations
- WHEN unused identifiers are removed
- THEN `eslint` reports zero `no-unused-vars` warnings
- AND the bundle size may decrease due to tree-shaking
