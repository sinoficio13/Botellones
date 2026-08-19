# TypeScript Compilation Specification

## Purpose

Ensure the Botellón codebase compiles cleanly under React 19 + Next.js 16.3 by fixing 13 type errors across 5 files, establishing zero-tolerance for `tsc --noEmit` failures.

## Requirements

### Requirement: React 19 useActionState Hook API Compliance

All form components SHALL use the React 19 `useActionState` API with the correct 3-argument signature: `(action, initialState, permalink?)`.

#### Scenario: Botellón form saves state correctly

- GIVEN a botellón form at `botellones/[id]/form.tsx`
- WHEN the component calls `useActionState` with an async action handler, initial state object, and optional permalink string
- THEN the hook returns `[state, formAction, isPending]` as a 3-tuple
- AND TypeScript infers state type from the initialState parameter without explicit generics

#### Scenario: Configuración page persists settings

- GIVEN the configuración page at `configuracion/page.tsx`
- WHEN `useActionState` is called with saveSettings handler, form state, and permalink
- THEN the 3-argument signature compiles without type errors
- AND the returned `isPending` boolean drives form submission UI state

### Requirement: Supabase Client Constructor Compatibility

The Supabase client SHALL be instantiated with a constructor call compatible with the installed `@supabase/supabase-js` version, using environment variables directly — no deprecated options.

#### Scenario: Logo uploader creates Supabase client

- GIVEN the logo uploader component at `configuracion/logo-uploader.tsx` needs a Supabase client
- WHEN `createClient(supabaseUrl, supabaseAnonKey)` is called with string arguments from environment variables
- THEN the client is created without type errors
- AND no deprecated constructor options are passed

### Requirement: Component Prop Type Consistency

Component prop interfaces SHALL match the data shapes passed by callers, eliminating `string` vs `{ value, label }` mismatches.

#### Scenario: Reportes tabs render option labels

- GIVEN `reportes-tabs.tsx` receives an options array where each item has `{ value: string, label: string }`
- WHEN the component accesses `option.label` for display
- THEN TypeScript validates that `option` has a `label` property
- AND no `string` vs `{ value, label }` type error occurs

### Requirement: Nullable Logo URL Handling

The header component SHALL accept `logo_url` typed as `string | null` — not `string | undefined` — matching the database schema.

#### Scenario: Header renders without logo

- GIVEN a company record whose `logo_url` is `null` in the database
- WHEN `header.tsx` renders the company branding
- THEN the component handles `null` gracefully without type errors
- AND no `undefined` is assigned where `null` is expected
