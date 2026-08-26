-- =============================================================================
-- EPIC-15 (change central-op-fase1-schema): FIFO state-age foundation
--   * botellones.estado_desde (timestamptz NOT NULL DEFAULT now()) — the FIFO
--     basis for the Central de Operaciones queue: bottle age in current estado
--     = now() - estado_desde.
--   * Per-estado backfill of existing rows (Business Rule 1, REQ-COS-1):
--       entregado        -> COALESCE(fecha_entrega, fecha_creacion, created_at, now())
--       all other estados -> COALESCE(fecha_creacion, created_at, now())
--     fecha_creacion is the app-consistent source (getBotellones orders by it,
--     src/lib/db/botellones.ts:42); created_at is the defensive fallback;
--     fecha_entrega is entregado's meaningful time. Backfilled ages are
--     approximations — exact ages accrue from deployment onward.
--   * movimientos audit table + index + RLS mirroring the 0001 admin/repartidor
--     policy style (REQ-COS-2). No historical movimientos backfill exists.
--   * SECURITY DEFINER BEFORE UPDATE trigger trg_estado_desde: stamps
--     estado_desde = now() and appends one movimientos row on estado change
--     only; no-op updates insert nothing (REQ-COS-3).
--
-- Additive and idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT
-- EXISTS / CREATE OR REPLACE FUNCTION / DROP TRIGGER IF EXISTS. Re-running
-- never errors.
-- =============================================================================

-- 1. Column: NOT NULL satisfied immediately via DEFAULT; existing rows get
--    now() and are then overwritten by the backfill (design D4).
ALTER TABLE public.botellones ADD COLUMN IF NOT EXISTS estado_desde timestamptz NOT NULL DEFAULT now();

-- 2. Backfill (Business Rule 1; spec REQ-COS-1) — exact COALESCE chain.
UPDATE public.botellones
SET estado_desde = CASE
  WHEN estado = 'entregado' THEN COALESCE(fecha_entrega, fecha_creacion, created_at, now())
  ELSE COALESCE(fecha_creacion, created_at, now())
END;

-- 3. Audit table (REQ-COS-2). botellon_id FK CASCADE keeps the audit trail
--    from blocking future physical purges (design D8).
CREATE TABLE IF NOT EXISTS public.movimientos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  botellon_id   uuid NOT NULL REFERENCES public.botellones(id) ON DELETE CASCADE,
  estado_previo text,
  estado_nuevo  text NOT NULL,
  usuario_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_botellon ON public.movimientos (botellon_id);

ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

-- 4. RLS — mirrors the 0001 admin/repartidor policy style exactly: inline
--    (auth.jwt() -> 'app_metadata' ->> 'role') checks, per-op policies,
--    TO authenticated. Admin full CRUD; repartidor SELECT-only. Service-role
--    writes bypass RLS unaffected. movimientos is NOT added to
--    supabase_realtime (publication 0010 untouched).
--    CREATE POLICY has no IF NOT EXISTS, so each policy is drop-first for
--    full-file idempotency (re-run never errors).
DROP POLICY IF EXISTS "admin_select_movimientos" ON public.movimientos;
CREATE POLICY "admin_select_movimientos" ON public.movimientos
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_insert_movimientos" ON public.movimientos;
CREATE POLICY "admin_insert_movimientos" ON public.movimientos
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_update_movimientos" ON public.movimientos;
CREATE POLICY "admin_update_movimientos" ON public.movimientos
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_delete_movimientos" ON public.movimientos;
CREATE POLICY "admin_delete_movimientos" ON public.movimientos
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "repartidor_select_movimientos" ON public.movimientos;
CREATE POLICY "repartidor_select_movimientos" ON public.movimientos
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

-- 5. Trigger function — SECURITY DEFINER with pinned empty search_path
--    (design D2): the audit INSERT must never be rejected by RLS on
--    movimientos under any caller; fully-qualified identifiers close the
--    definer-function hijack vector. IS DISTINCT FROM is NULL-safe (a
--    NULL -> 'recibido' change still fires). auth.uid() returns NULL for
--    service-role writes (no JWT in request context) -> usuario_id NULL.
CREATE OR REPLACE FUNCTION public.fn_trg_estado_desde()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    NEW.estado_desde := now();
    INSERT INTO public.movimientos (botellon_id, estado_previo, estado_nuevo, usuario_id)
    VALUES (NEW.id, OLD.estado, NEW.estado, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger functions must not be callable via the Data API — the trigger fires
-- with table-owner privileges regardless of EXECUTE grants, so revoke from
-- PUBLIC (covers anon + authenticated). Supabase event triggers may re-grant
-- EXECUTE when functions are created through the SQL editor / MCP apply path,
-- so the revoke is also repeated explicitly for anon.
REVOKE ALL ON FUNCTION public.fn_trg_estado_desde() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_trg_estado_desde() FROM anon;

-- 6. Trigger — CREATE TRIGGER has no IF NOT EXISTS, so drop-first for
--    idempotency.
DROP TRIGGER IF EXISTS trg_estado_desde ON public.botellones;
CREATE TRIGGER trg_estado_desde
  BEFORE UPDATE ON public.botellones
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_estado_desde();