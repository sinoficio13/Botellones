-- =============================================================================
-- Realtime: expose state-tracking tables to postgres_changes.
-- Adds public.botellones, public.recargas, public.premios and
-- public.notificaciones to the supabase_realtime publication so the detail
-- page and kanban subscribers receive UPDATE events (spec realtime R1).
--
-- Idempotent by construction: ALTER PUBLICATION ... ADD TABLE on an
-- already-member table raises duplicate_object (SQLSTATE 42710), so each
-- statement is guarded by an existence check on pg_publication_tables.
-- Re-running (e.g. after toggling membership in the dashboard) never errors.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'botellones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.botellones;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'recargas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recargas;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'premios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.premios;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notificaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
END $$;