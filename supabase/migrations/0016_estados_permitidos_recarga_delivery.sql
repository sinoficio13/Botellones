-- =============================================================================
-- EPIC-16 (batch bottle flow redesign): `estados_permitidos` mirror update.
--
-- Two rows change, mirroring the state-machine edit in src/lib/utils/estados.ts
-- (batch flows): a bottle in `recarga` may now advance directly to `delivery`
-- (TRANSICIONES.recarga = ['listo','delivery']), and `delivery` may now revert
-- to `recarga` (REVERSIONES.delivery = ['listo','recarga']).
--
-- Only the two CASE branches differ from 0012; language/immutability/security
-- attributes and the REVOKE/GRANT set are preserved exactly. Array order still
-- matches the TS Set insertion order (forward transitions, reversions, then
-- the identity estado) so a direct `=` comparison keeps working in verify.
--
-- Additive and idempotent: CREATE OR REPLACE; REVOKE/GRANT re-runs are no-ops.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.estados_permitidos(p_estado text)
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE p_estado
    WHEN 'entregado' THEN ARRAY['recibido','listo','delivery','entregado']   -- TS:22-28 + 36-42 + identity
    WHEN 'recibido' THEN ARRAY['recarga','entregado','recibido']
    WHEN 'recarga'  THEN ARRAY['listo','delivery','recibido','recarga']
    WHEN 'listo'    THEN ARRAY['entregado','delivery','recarga','listo']
    WHEN 'delivery' THEN ARRAY['entregado','listo','recarga','delivery']
    ELSE ARRAY[p_estado]  -- unknown estado: only itself (TS `|| []` + identity fallback)
  END;
$$;

REVOKE ALL ON FUNCTION public.estados_permitidos(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.estados_permitidos(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.estados_permitidos(text) TO authenticated;