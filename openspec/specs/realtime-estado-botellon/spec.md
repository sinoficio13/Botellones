# realtime-estado-botellon Specification

## Purpose

The botellon detail page (`/botellones/[id]`) and the operaciones kanban must reflect estado, cliente_id, and fecha_entrega changes made by other operators within seconds, without F5. Supabase Realtime `postgres_changes` delivers UPDATE events for `botellones` rows to authenticated browser clients (RLS-filtered); migration 0010 makes publication membership declarative and idempotent.

## Requirements

### Requirement: R1 — Publication membership for state tables

Migration 0010 MUST add `public.botellones`, `public.recargas`, `public.premios`, and `public.notificaciones` to the `supabase_realtime` publication via `ALTER PUBLICATION ... ADD TABLE`, and MUST be idempotent: adding an already-member table MUST be a no-op that does not error.

#### Scenario: S1 — Migration 0010 applies once

- GIVEN a fresh database where no table is a publication member
- WHEN migration 0010 runs
- THEN all four tables are members of `supabase_realtime`

#### Scenario: S2 — Migration 0010 is idempotent

- GIVEN the four tables already added to the publication (e.g., via the dashboard toggle)
- WHEN migration 0010 runs again
- THEN it succeeds without error and membership is unchanged

### Requirement: R2 — Detail-page live updates

The botellon detail page MUST subscribe to `postgres_changes` with `{ event: 'UPDATE', schema: 'public', table: 'botellones', filter: 'id=eq.<id>' }` and MUST reflect payload changes to `estado`, `cliente_id`, and `fecha_entrega` in the rendered badge/selector. The subscription MUST degrade silently on `CHANNEL_ERROR` and `TIMED_OUT`, and MUST call `removeChannel` on unmount.

#### Scenario: S3 — Live update across devices (detail)

- GIVEN two operators viewing the same botellon detail page
- WHEN one changes the estado
- THEN the other's badge and selector update within seconds without refresh

#### Scenario: S4 — Channel error degrades silently

- GIVEN a subscription whose channel enters `CHANNEL_ERROR` or `TIMED_OUT`
- WHEN the channel status changes
- THEN the page keeps its last rendered state and no error is shown to the user

#### Scenario: S5 — Cleanup on unmount

- GIVEN the detail page is unmounted
- WHEN the effect cleanup runs
- THEN `removeChannel` is called and no further payloads are processed

### Requirement: R3 — Kanban live updates

The operaciones dashboard MUST subscribe to `postgres_changes` with `{ event: 'UPDATE', schema: 'public', table: 'botellones' }` (no filter) and MUST patch the matching row's `estado`, `cliente_id`, and `fecha_entrega` in client state. The patch MUST be idempotent (echoes of the operator's own optimistic writes MUST be harmless); `router.refresh()` MUST remain only the server-rejection fallback; cleanup MUST call `removeChannel`.

#### Scenario: S6 — Live update across devices (kanban)

- GIVEN two operators watching the kanban
- WHEN one moves a card
- THEN the other's card moves column within seconds without refresh

#### Scenario: S7 — Echo of own optimistic move is harmless

- GIVEN an operator optimistically moved a card
- WHEN the realtime echo of that same write arrives
- THEN patching the row to the same estado leaves the UI unchanged (idempotent)

#### Scenario: S8 — Rejected optimistic move converges via realtime

- GIVEN an optimistic move the server rejects
- WHEN the realtime payload carrying the canonical estado arrives
- THEN the card snaps back to the canonical estado and the refresh fallback does not fight the patch

### Requirement: R4 — Role coverage for authenticated users

Authenticated `admin` and `repartidor` browser clients MUST receive `botellones` UPDATE change events for rows their SELECT policies permit. `repartidor` MUST receive realtime updates even though it has no botellones UPDATE policy, because writes flow through service-role server actions that bypass RLS.

#### Scenario: S9 — Repartidor receives realtime updates

- GIVEN a repartidor session on the kanban
- WHEN an admin moves a botellon
- THEN the repartidor sees the card move without refresh

#### Scenario: S10 — RLS filters the change stream

- GIVEN an authenticated role without a SELECT policy on a row
- WHEN a change to that row occurs
- THEN no payload is delivered to that client