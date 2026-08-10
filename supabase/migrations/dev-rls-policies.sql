-- =============================================================================
-- Dev mode RLS policies — temporary write access for anon key
-- 
-- These policies allow the NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (anon)
-- to read and write clientes + recargas without requiring a JWT.
-- 
-- ⚠️ REMOVE THESE when switching to production Supabase Auth.
--    Production uses authenticated JWT + service_role for admin ops.
-- =============================================================================

-- Client read/write for dev mode
CREATE POLICY "dev_anon_select_clientes" ON public.clientes
  FOR SELECT TO anon USING (true);

CREATE POLICY "dev_anon_insert_clientes" ON public.clientes
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "dev_anon_update_clientes" ON public.clientes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Recargas read for client list stats (total_recargas, ultima_recarga)
CREATE POLICY "dev_anon_select_recargas" ON public.recargas
  FOR SELECT TO anon USING (true);
