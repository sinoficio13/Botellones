-- =============================================================================
-- Realtime: expose the movimientos table to postgres_changes.
-- The historial feed (HistorialBotellon) subscribes to INSERT events on
-- public.movimientos to refresh the current page live (spec realtime R1).
--
-- Idempotent by construction (same pattern as 0010): ALTER PUBLICATION ...
-- ADD TABLE on an already-member table raises duplicate_object (SQLSTATE
-- 42710), so the statement is guarded by an existence check on
-- pg_publication_tables. Re-running never errors.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'movimientos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos;
  END IF;
END $$;
