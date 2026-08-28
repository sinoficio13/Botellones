-- =============================================================================
-- EPIC-15 (dev-mode RPC auth, KI-001): allow anon EXECUTE on mover_botellones
--
--   Dev mode (NEXT_PUBLIC_AUTH_MODE=dev) authenticates via a cookie and has NO
--   Supabase session, so the browser runs as `anon`. 0013 revoked anon EXECUTE
--   and granted only authenticated — the kanban action buttons (→ Pasar /
--   ✓ Entregar) returned 401 "No se pudo mover" in dev.
--
--   This is safe: anon already holds INSERT/UPDATE/SELECT RLS policies on
--   botellones (0001), so granting EXECUTE does not widen effective capability;
--   the RPC still validates every transition server-side and the 0011 trigger
--   stamps estado_desde. In production the browser is `authenticated` (real
--   Supabase session), which keeps the 0013 grant.
--
-- Idempotent: GRANT re-runs are no-ops.
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.mover_botellones(uuid[], text, boolean) TO anon;