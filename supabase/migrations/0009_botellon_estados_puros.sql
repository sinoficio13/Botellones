-- =============================================================================
-- Pure 5-estado botellon cycle: collapse the 9-estado machine to 5 pure estados
--   entregado → recibido → recarga → listo → entregado (+ listo → delivery → entregado)
-- Removes planta/danado/perdido/mantenimiento (BOT-00048 remap included).
-- =============================================================================

-- 1. Data first (BOT-00048 + defensive) — MUST precede the constraint swap
UPDATE public.botellones SET estado = 'recibido' WHERE estado = 'planta';
UPDATE public.botellones SET estado = 'recibido' WHERE estado IN ('danado','perdido','mantenimiento');

-- 2. Constraint 9 → 5
ALTER TABLE public.botellones DROP CONSTRAINT IF EXISTS botellones_estado_check;
ALTER TABLE public.botellones ADD CONSTRAINT botellones_estado_check
  CHECK (estado IN ('entregado','recibido','recarga','listo','delivery'));
-- default stays 'recibido' (set by 0005) — no change