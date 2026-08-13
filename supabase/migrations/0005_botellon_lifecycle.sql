-- =============================================================================
-- EPIC-11: Ciclo de vida físico del botellón (Opción A — reemplazo de estados)
-- Reemplaza los estados antiguos por el ciclo físico completo:
--   recibido → planta → recarga → listo → delivery → entregado
--   + excepciones: danado, perdido, mantenimiento
-- =============================================================================

-- 1. Migrar estados existentes
UPDATE public.botellones SET estado = 'planta'        WHERE estado IN ('disponible', 'activo');
UPDATE public.botellones SET estado = 'entregado'     WHERE estado = 'asignado';
UPDATE public.botellones SET estado = 'recarga'       WHERE estado = 'en_recarga';
UPDATE public.botellones SET estado = 'danado'        WHERE estado = 'dañado';
-- mantenimiento y perdido se mantienen igual

-- 2. Cambiar el DEFAULT del estado a 'recibido' (nuevo botellón entra sucio)
ALTER TABLE public.botellones ALTER COLUMN estado SET DEFAULT 'recibido';

-- 2b. Columna para trackear cuándo se entregó (para "hace X días con el cliente")
ALTER TABLE public.botellones ADD COLUMN IF NOT EXISTS fecha_entrega timestamptz;

-- 3. (Opcional) CHECK constraint para garantizar estados válidos
ALTER TABLE public.botellones DROP CONSTRAINT IF EXISTS botellones_estado_check;
ALTER TABLE public.botellones ADD CONSTRAINT botellones_estado_check
  CHECK (estado IN ('recibido','planta','recarga','listo','delivery','entregado','danado','perdido','mantenimiento'));
