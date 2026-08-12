-- Idempotent E2E seed data for Playwright tests.
-- Ensures María Rodríguez, Carlos Pérez, and BOT-00001 exist.
-- Uses ON CONFLICT DO NOTHING on natural keys.

-- María Rodríguez (CL-0001)
INSERT INTO clientes (id, codigo, nombre, telefono_1, negocio, fecha_registro)
VALUES (
  '5e9297bc-91a9-4e4f-a11d-9c74bddd26aa',
  'CL-0001',
  'María Rodríguez',
  '584141234567',
  'Casa',
  '2024-01-15'
)
ON CONFLICT (codigo) DO NOTHING;

-- Carlos Pérez (CL-0002)
INSERT INTO clientes (id, codigo, nombre, telefono_1, negocio, fecha_registro)
VALUES (
  '2f458b53-85bb-4324-af72-09c00baebb11',
  'CL-0002',
  'Carlos Pérez',
  '584142345678',
  'Ferretería Pérez',
  '2024-01-16'
)
ON CONFLICT (codigo) DO NOTHING;

-- BOT-00001 (assigned to María)
INSERT INTO botellones (id, codigo, estado, cliente_id, fecha_creacion)
VALUES (
  '8b80b9b7-505b-4030-9652-8167b096b7c5',
  'BOT-00001',
  'asignado',
  '5e9297bc-91a9-4e4f-a11d-9c74bddd26aa',
  '2024-01-10'
)
ON CONFLICT (codigo) DO NOTHING;
