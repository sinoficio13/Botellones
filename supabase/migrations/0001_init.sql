-- =============================================================================
-- EPIC-1: Database Foundation — Full Schema, Sequences, RLS, and Storage
-- Single migration: all 9 tables are co-dependent via foreign keys.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions (pgcrypto needed for seed user password hashing)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Sequences for unique codes
-- ---------------------------------------------------------------------------
CREATE SEQUENCE cliente_codigo_seq START 1;
CREATE SEQUENCE botellon_codigo_seq START 1;

-- ---------------------------------------------------------------------------
-- Table: perfiles
-- Maps auth.users to application profile data.
-- ---------------------------------------------------------------------------
CREATE TABLE public.perfiles (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre    text NOT NULL,
  telefono  text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table: clientes
-- Core customer entity with full demographic/contact data.
-- ---------------------------------------------------------------------------
CREATE TABLE public.clientes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            text NOT NULL UNIQUE
                    DEFAULT 'CL-' || lpad(nextval('cliente_codigo_seq')::text, 4, '0'),
  nombre            text NOT NULL,
  negocio           text,
  cedula            text,
  telefono_1        text,
  telefono_2        text,
  whatsapp          text,
  tipo_cliente      text,
  horario_preferido text,
  dias_preferidos   text,
  contacto_preferido text,
  observaciones     text,
  fecha_registro    timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_clientes_nombre_telefono ON public.clientes (nombre, telefono);
CREATE INDEX idx_clientes_codigo ON public.clientes (codigo);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table: direcciones
-- Address and GPS data per customer.
-- ---------------------------------------------------------------------------
CREATE TABLE public.direcciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  calle        text,
  avenida      text,
  sector       text,
  urbanizacion text,
  ciudad       text,
  estado       text,
  referencia   text,
  latitud      double precision,
  longitud     double precision,
  link_mapa    text,
  gps_origen   text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_direcciones_cliente ON public.direcciones (cliente_id);

ALTER TABLE public.direcciones ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table: fotos_clientes
-- Photos per customer with type classification.
-- ---------------------------------------------------------------------------
CREATE TABLE public.fotos_clientes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo         text NOT NULL,
  ruta_storage text NOT NULL,
  descripcion  text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_fotos_cliente ON public.fotos_clientes (cliente_id);

ALTER TABLE public.fotos_clientes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table: botellones
-- Water dispenser bottles with unique code and status tracking.
-- ---------------------------------------------------------------------------
CREATE TABLE public.botellones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         text NOT NULL UNIQUE
                 DEFAULT 'BOT-' || lpad(nextval('botellon_codigo_seq')::text, 5, '0'),
  fecha_creacion timestamptz DEFAULT now(),
  estado         text DEFAULT 'activo',
  cliente_id     uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_botellones_cliente ON public.botellones (cliente_id);
CREATE INDEX idx_botellones_codigo ON public.botellones (codigo);

ALTER TABLE public.botellones ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table: recargas
-- Each water refill event recorded per bottle.
-- ---------------------------------------------------------------------------
CREATE TABLE public.recargas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_registro  text NOT NULL,
  cliente_id       uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  botellon_id      uuid NOT NULL REFERENCES public.botellones(id) ON DELETE RESTRICT,
  fecha            date NOT NULL DEFAULT CURRENT_DATE,
  hora             time NOT NULL DEFAULT CURRENT_TIME,
  realizada_por    uuid NOT NULL,
  observaciones    text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_recargas_cliente_fecha ON public.recargas (cliente_id, fecha);
CREATE INDEX idx_recargas_botellon ON public.recargas (botellon_id);

ALTER TABLE public.recargas ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table: premios
-- Loyalty rewards earned by customers.
-- ---------------------------------------------------------------------------
CREATE TABLE public.premios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nivel_recargas   integer NOT NULL,
  fecha_alcanzado  date NOT NULL DEFAULT CURRENT_DATE,
  estado           text DEFAULT 'pendiente',
  tipo_premio      text,
  entregado_por    uuid,
  observaciones    text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_premios_cliente ON public.premios (cliente_id);

ALTER TABLE public.premios ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table: configuracion
-- Business settings — single-row table enforced by CHECK constraint.
-- ---------------------------------------------------------------------------
CREATE TABLE public.configuracion (
  id              integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nombre_negocio  text NOT NULL,
  logo_url        text,
  telefono        text,
  direccion       text,
  email           text,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table: notificaciones
-- User notifications with optional links to clientes/botellones.
-- ---------------------------------------------------------------------------
CREATE TABLE public.notificaciones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo        text NOT NULL,
  titulo      text NOT NULL,
  mensaje     text,
  cliente_id  uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  botellon_id uuid REFERENCES public.botellones(id) ON DELETE SET NULL,
  leida       boolean DEFAULT false,
  creada_en   timestamptz DEFAULT now()
);

CREATE INDEX idx_notificaciones_usuario ON public.notificaciones (usuario_id);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- Role model: app_metadata.role ∈ {admin, repartidor}
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: admin check (used inline in all admin policies)
-- ---------------------------------------------------------------------------
-- ADMIN: full CRUD on all 9 tables
-- ---------------------------------------------------------------------------

-- perfiles
CREATE POLICY "admin_select_perfiles" ON public.perfiles
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_insert_perfiles" ON public.perfiles
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_update_perfiles" ON public.perfiles
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_delete_perfiles" ON public.perfiles
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- clientes
CREATE POLICY "admin_select_clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_insert_clientes" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_update_clientes" ON public.clientes
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_delete_clientes" ON public.clientes
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- direcciones
CREATE POLICY "admin_select_direcciones" ON public.direcciones
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_insert_direcciones" ON public.direcciones
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_update_direcciones" ON public.direcciones
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_delete_direcciones" ON public.direcciones
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- fotos_clientes
CREATE POLICY "admin_select_fotos_clientes" ON public.fotos_clientes
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_insert_fotos_clientes" ON public.fotos_clientes
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_update_fotos_clientes" ON public.fotos_clientes
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_delete_fotos_clientes" ON public.fotos_clientes
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- botellones
CREATE POLICY "admin_select_botellones" ON public.botellones
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_insert_botellones" ON public.botellones
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_update_botellones" ON public.botellones
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_delete_botellones" ON public.botellones
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- recargas
CREATE POLICY "admin_select_recargas" ON public.recargas
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_insert_recargas" ON public.recargas
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_update_recargas" ON public.recargas
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_delete_recargas" ON public.recargas
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- premios
CREATE POLICY "admin_select_premios" ON public.premios
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_insert_premios" ON public.premios
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_update_premios" ON public.premios
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_delete_premios" ON public.premios
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- configuracion
CREATE POLICY "admin_select_configuracion" ON public.configuracion
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_insert_configuracion" ON public.configuracion
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_update_configuracion" ON public.configuracion
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_delete_configuracion" ON public.configuracion
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- notificaciones
CREATE POLICY "admin_select_notificaciones" ON public.notificaciones
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_insert_notificaciones" ON public.notificaciones
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_update_notificaciones" ON public.notificaciones
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "admin_delete_notificaciones" ON public.notificaciones
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- REPARTIDOR: SELECT on all tables
-- ---------------------------------------------------------------------------
CREATE POLICY "repartidor_select_perfiles" ON public.perfiles
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

CREATE POLICY "repartidor_select_clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

CREATE POLICY "repartidor_select_direcciones" ON public.direcciones
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

CREATE POLICY "repartidor_select_fotos_clientes" ON public.fotos_clientes
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

CREATE POLICY "repartidor_select_botellones" ON public.botellones
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

CREATE POLICY "repartidor_select_recargas" ON public.recargas
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

CREATE POLICY "repartidor_select_premios" ON public.premios
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

CREATE POLICY "repartidor_select_configuracion" ON public.configuracion
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

CREATE POLICY "repartidor_select_notificaciones" ON public.notificaciones
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

-- ---------------------------------------------------------------------------
-- REPARTIDOR: INSERT on clientes, recargas, fotos_clientes
-- ---------------------------------------------------------------------------
CREATE POLICY "repartidor_insert_clientes" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

CREATE POLICY "repartidor_insert_recargas" ON public.recargas
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

CREATE POLICY "repartidor_insert_fotos_clientes" ON public.fotos_clientes
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor');

-- ---------------------------------------------------------------------------
-- REPARTIDOR: UPDATE/DELETE own recargas (today only)
-- ---------------------------------------------------------------------------
CREATE POLICY "repartidor_update_recargas" ON public.recargas
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor'
    AND realizada_por = auth.uid()
    AND fecha = CURRENT_DATE
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor'
    AND realizada_por = auth.uid()
    AND fecha = CURRENT_DATE
  );

CREATE POLICY "repartidor_delete_recargas" ON public.recargas
  FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'repartidor'
    AND realizada_por = auth.uid()
    AND fecha = CURRENT_DATE
  );

-- ---------------------------------------------------------------------------
-- PUBLIC (unauthenticated): SELECT on botellones for QR scanning
-- Column-level restriction: anon only sees codigo + estado (not client data)
-- total_recargas and last_recarga are computed via recargas join, not columns
-- ---------------------------------------------------------------------------
CREATE POLICY "public_select_botellones" ON public.botellones
  FOR SELECT TO anon
  USING (true);

-- Revoke full SELECT and grant only QR-visible columns
REVOKE ALL ON public.botellones FROM anon;
GRANT SELECT (codigo, estado) ON public.botellones TO anon;

-- =============================================================================
-- STORAGE BUCKET POLICIES
-- =============================================================================

-- fotos-clientes: authenticated read/write
CREATE POLICY "auth_access_fotos_clientes"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'fotos-clientes')
  WITH CHECK (bucket_id = 'fotos-clientes');

-- logos: authenticated read
CREATE POLICY "auth_read_logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'logos');

-- logos: admin insert/update/delete
CREATE POLICY "admin_write_logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_update_logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_delete_logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
