-- =============================================================================
-- EPIC-15 (change central-op-fase3-vista-movil, PR-C): undo-aware mover RPC
--
--   * mover_botellones(p_ids, p_estado, p_restaurar boolean DEFAULT false) —
--     undo-aware batch mover (REQ-COS-19). The client NEVER supplies
--     timestamps (R1-001): BEFORE the move UPDATE the function snapshots the
--     DB's own estado_desde per id (same row set validated by the move).
--     The move UPDATE fires the trigger stamping estado_desde = now() + one
--     movimientos audit row (0011:96). When p_restaurar is true, a SECOND
--     UPDATE restores each id's ORIGINAL estado_desde from that snapshot;
--     estado is unchanged, so the trigger takes the silent branch: no
--     re-stamp, no audit row. Both UPDATEs run in the same transaction —
--     the undo is atomic with the reverse move.
--
--   * Signature change: the 0012 two-argument overload and the 0013 jsonb
--     variant are DROPPED; the defaulted 3-arg boolean signature is the
--     single function. 2-arg calls (existing callers / PostgREST payloads
--     omitting p_restaurar) resolve via the DEFAULT false and behave exactly
--     as before — no restore branch. The RPC's first consumer is this queue
--     (design D1), so nothing depends on the dropped overload identities.
--     A client that tries to forge estado_desde via a jsonb arg now gets
--     "function does not exist" — the injection vector is closed.
--
--   * Role guard, DISTINCT UNNEST dedupe, TOCTOU-free WHERE validation,
--     GET DIAGNOSTICS vs cardinality, RAISE -> rollback (zero writes):
--     preserved verbatim from 0012.
--
-- Idempotent: DROP FUNCTION IF EXISTS (2-arg + jsonb 3-arg) + CREATE OR
-- REPLACE (boolean 3-arg); REVOKE/GRANT re-runs are no-ops.
-- =============================================================================

-- Drop the 0012 two-argument overload and the 0013 jsonb variant so the
-- defaulted boolean 3-arg signature is the single function (Postgres resolves
-- 2-arg calls via the DEFAULT; forged jsonb args no longer resolve).
DROP FUNCTION IF EXISTS public.mover_botellones(uuid[], text);
DROP FUNCTION IF EXISTS public.mover_botellones(uuid[], text, jsonb);

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
    RAISE EXCEPTION 'Permiso denegado: rol no autorizado para mover botellones';
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
REVOKE ALL ON FUNCTION public.mover_botellones(uuid[], text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.mover_botellones(uuid[], text, boolean) TO authenticated;