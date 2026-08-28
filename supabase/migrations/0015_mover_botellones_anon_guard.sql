-- =============================================================================
-- EPIC-15 (dev-mode RPC auth, KI-001): allow anon through mover_botellones guard
--
--   0014 granted EXECUTE to anon, but the function BODY still raised P0001
--   for non-authenticated callers: the role guard reads auth.jwt() app_metadata
--   and only accepts 'admin'/'repartidor'. In dev mode (NEXT_PUBLIC_AUTH_MODE=
--   dev, cookie auth) the browser has NO Supabase session — auth.jwt() is null
--   and the kanban action buttons failed with 400 "Permiso denegado".
--
--   This migration relaxes the guard: anon is allowed through. It is safe:
--   anon already holds UPDATE on botellones via RLS (0001), so executing this
--   SECURITY DEFINER RPC does NOT widen effective capability — and the RPC
--   validates every transition via estados_permitidos (stricter than a raw
--   UPDATE). Production browsers carry a real session (authenticated role with
--   admin/repartidor app_metadata) and keep the original path.
--
--   Function body identical to 0013 except the guard block; REVOKE/GRANT
--   re-runs are no-ops (idempotent).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mover_botellones(
  p_ids uuid[],
  p_estado text,
  p_restaurar boolean DEFAULT false
)
RETURNS SETOF public.botellones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role        text;
  v_ids         uuid[];
  v_affected    integer;
  v_snap_ids    uuid[] := '{}';
  v_snap_desde  timestamptz[] := '{}';
  v_row         record;
BEGIN
  -- Role guard: definer bypasses RLS, so authorization must be explicit.
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role') INTO v_role;
  IF v_role IS NULL OR v_role NOT IN ('admin', 'repartidor') THEN
    -- Dev-mode fallback (KI-001): with the publishable/anon key there is no
    -- JWT session (dev auth uses a cookie). anon already holds UPDATE on
    -- botellones via RLS (0001), so executing this RPC does not widen
    -- effective capability — the transition validation below is stricter
    -- than a raw UPDATE.
    IF auth.role() <> 'anon' THEN
      RAISE EXCEPTION 'Permiso denegado: rol no autorizado para mover botellones';
    END IF;
  END IF;

  -- Dedupe p_ids: the row-count check compares against DISTINCT ids.
  v_ids := ARRAY(SELECT DISTINCT UNNEST(p_ids));

  -- Snapshot the ORIGINAL estado_desde BEFORE the move (R1-001): the undo
  -- restores the DB's own pre-move values, never client-supplied timestamps.
  FOR v_row IN
    SELECT id, estado_desde FROM public.botellones WHERE id = ANY(v_ids)
  LOOP
    v_snap_ids   := v_snap_ids || v_row.id;
    v_snap_desde := v_snap_desde || v_row.estado_desde;
  END LOOP;

  -- Single transactional UPDATE; validation lives INSIDE the WHERE —
  -- TOCTOU-free: the estado tested is the one being updated, atomically.
  UPDATE public.botellones
  SET estado = p_estado
  WHERE id = ANY(v_ids)
    AND p_estado = ANY(public.estados_permitidos(estado));

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Transición no permitida: % de % botellones actualizados (destino %)',
      v_affected, cardinality(v_ids), p_estado;
  END IF;

  -- Undo restore (REQ-COS-19, design D2): the estado UPDATE above fired the
  -- trigger stamping estado_desde = now(); restore the pre-move snapshot.
  -- This UPDATE leaves estado unchanged -> fn_trg_estado_desde takes the
  -- silent branch (0011:96): no re-stamp, no movimientos row.
  IF p_restaurar THEN
    UPDATE public.botellones b
    SET estado_desde = d.estado_desde
    FROM unnest(v_snap_ids) WITH ORDINALITY AS i(id, ord)
    JOIN unnest(v_snap_desde) WITH ORDINALITY AS d(estado_desde, ord) USING (ord)
    WHERE b.id = i.id;
  END IF;

  -- Same transaction: rows are already updated, return them to the caller.
  RETURN QUERY SELECT b.* FROM public.botellones b WHERE b.id = ANY(v_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.mover_botellones(uuid[], text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mover_botellones(uuid[], text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mover_botellones(uuid[], text, boolean) TO anon;