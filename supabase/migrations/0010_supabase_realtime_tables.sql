-- =============================================================================
-- Realtime: expose state-tracking tables to postgres_changes.
-- Adds public.botellones, public.recargas, public.premios and
-- public.notificaciones to the supabase_realtime publication so the detail
-- page and kanban subscribers receive UPDATE events (spec realtime R1).
-- Idempotent: ALTER PUBLICATION ... ADD TABLE on an already-member table is a
-- no-op, so re-running (e.g. after toggling membership in the dashboard)
-- never errors.
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.botellones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recargas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.premios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;