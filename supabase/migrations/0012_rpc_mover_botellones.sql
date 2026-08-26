-- =============================================================================
-- EPIC-15 (change central-op-fase1-schema): batch mover RPC
--   * estados_permitidos(text) -> text[] — SQL mirror of getEstadosPermitidos
--     (REQ-COS-5, MOD botellon-ciclo-estados S-M1): dedup union of forward
--     transitions, reversions, and the identity estado, for all five estados.
--     Array order matches the TS Set insertion order so a direct `=`
--     comparison works in verify; expected arrays are pinned by
--     tests/unit/estados.test.ts:162-166.
--   * mover_botellones(uuid[], text) — SECURITY DEFINER transactional batch
--     mover (REQ-COS-4, MOD S-M2/S-A3): explicit JWT role guard (definer
--     bypasses RLS, design D10), DISTINCT UNNEST dedupe (D7), validation
--     inside the single UPDATE's WHERE (TOCTOU-free, D1), GET DIAGNOSTICS
--     row-count vs cardinality, mismatch -> RAISE -> rollback -> zero writes,
--     RETURN QUERY for the result set (D6). Never touches cliente_id.
--
-- Additive and idempotent: CREATE OR REPLACE on both functions; REVOKE/GRANT
-- re-runs are no-ops.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. SQL machine mirror (REQ-COS-5)
--    Mirror of src/lib/utils/estados.ts:
--      TRANSICIONES   — estados.ts:22-28
--      REVERSIONES    — estados.ts:36-42
--      identity + dedup union — estados.ts:57-59
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estados_permitidos(p_estado text)
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE p_estado
    WHEN 'entregado' THEN ARRAY['recibido','listo','delivery','entregado']   -- TS:22-28 + 36-42 + identity
    WHEN 'recibido' THEN ARRAY['recarga','entregado','recibido']
    WHEN 'recarga'  THEN ARRAY['listo','recibido','recarga']
    WHEN 'listo'    THEN ARRAY['entregado','delivery','recarga','listo']
    WHEN 'delivery' THEN ARRAY['entregado','listo','delivery']
    ELSE ARRAY[p_estado]  -- unknown estado: only itself (TS `|| []` + identity fallback)
  END;
$$;

REVOKE ALL ON FUNCTION public.estados_permitidos(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estados_permitidos(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.estados_permitidos(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. RPC mover_botellones (REQ-COS-4)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mover_botellones(p_ids uuid[], p_estado text)
RETURNS SETOF public.botellones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role     text;
  v_ids      uuid[];
  v_affected integer;
BEGIN
  -- Role guard: definer bypasses RLS, so authorization must be explicit.
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role') INTO v_role;
  IF v_role IS NULL OR v_role NOT IN ('admin', 'repartidor') THEN
    RAISE EXCEPTION 'Permiso denegado: rol no autorizado para mover botellones';
  END IF;

  -- Dedupe p_ids: the row-count check compares against DISTINCT ids.
  v_ids := ARRAY(SELECT DISTINCT UNNEST(p_ids));

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

  -- Same transaction: rows are already updated, return them to the caller.
  RETURN QUERY SELECT b.* FROM public.botellones b WHERE b.id = ANY(v_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.mover_botellones(uuid[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mover_botellones(uuid[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mover_botellones(uuid[], text) TO authenticated;