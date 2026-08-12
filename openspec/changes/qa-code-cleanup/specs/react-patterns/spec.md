# React Patterns Specification

## Purpose

Eliminate `set-state-in-effect` anti-patterns causing cascading re-renders in 4 components. State SHALL be derived from props or computed during event handlers — not set inside `useEffect`.

## Requirements

### Requirement: Derived State Over Effect-Driven State

Components SHALL NOT call `setState` inside `useEffect` to synchronize derived values. Computed values that depend solely on props or other state MUST be derived inline or via `useMemo`.

#### Scenario: QR code component handles mount state

- GIVEN `botellones/[id]/qr-code.tsx` needs a `mounted` flag for client-only rendering
- WHEN the component mounts on the client
- THEN `mounted` is set via a layout effect or is derived from a `useSyncExternalStore` hydration check
- AND no `useEffect` body calls `setMounted`
- AND the component renders exactly once on hydration, not twice

#### Scenario: Recarga form loads client options without effect

- GIVEN `recargas/nueva/page.tsx` fetches client data for a combobox
- WHEN the component renders
- THEN client data is loaded via a query hook (e.g., `useQuery`) or passed as a server component prop
- AND no `useEffect` calls `setClientes`
- AND the combobox renders with options on the first paint

#### Scenario: Global search manages open state predictably

- GIVEN `components/search/global-search.tsx` toggles a search dialog
- WHEN the user clicks the search trigger
- THEN `setOpen` is called directly in the click handler or via a state reducer
- AND no `useEffect` synchronizes `open` state from external inputs
- AND the dialog opens/closes without extra render cycles
