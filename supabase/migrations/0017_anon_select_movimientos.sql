-- =============================================================================
-- EPIC-16 (bottle history): allow anon SELECT on movimientos
--
--   Dev mode (NEXT_PUBLIC_AUTH_MODE=dev) authenticates via a cookie and has NO
--   Supabase session, so the browser runs as `anon`. movimientos has RLS with
--   authenticated-only policies (0011), so the tabbed bottle history rendered
--   empty in dev (anon query blocked → count 0).
--
--   This is safe: the movement history (estado_previo/estado_nuevo/created_at)
--   is the same sensitivity as botellones.estado, which anon already reads via
--   RLS (0001). Production browsers carry a session (authenticated) and keep
--   the original policies.
--
-- Idempotent: CREATE POLICY is a no-op if a policy with the same name exists.
-- =============================================================================

CREATE POLICY "anon select movimientos" ON public.movimientos
  FOR SELECT TO anon USING (true);