-- =============================================================================
-- EPIC-6: Idempotency guard + repartidor INSERT grants for loyalty system
-- =============================================================================

-- Idempotency guard: prevent duplicate premios for same (cliente, nivel)
-- Both columns are NOT NULL (per init schema), so this is equivalent to a
-- UNIQUE constraint without creating an implicit index under a second name.
CREATE UNIQUE INDEX IF NOT EXISTS uq_premios_cliente_nivel ON premios(cliente_id, nivel_recargas);

-- Repartidor must insert premios when detecting loyalty milestones
CREATE POLICY "repartidor_insert_premios" ON premios FOR INSERT TO authenticated 
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

-- Repartidor must insert notificaciones for loyalty events
CREATE POLICY "repartidor_insert_notificaciones" ON notificaciones FOR INSERT TO authenticated 
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');
