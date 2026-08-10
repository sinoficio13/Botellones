-- =============================================================================
-- EPIC-1: Admin Seed
-- Creates initial admin user and profile. Idempotent via ON CONFLICT.
-- Run with service_role key: supabase db push or MCP execute_sql.
-- =============================================================================

-- Use fixed UUID for deterministic seed references
DO $$
DECLARE
  admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  -- Insert admin user into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    admin_id,
    'authenticated',
    'authenticated',
    'admin@botellon.com',
    extensions.crypt('Admin123!', extensions.gen_salt('bf')),
    now(),
    '{"role":"admin","provider":"email"}'::jsonb,
    '{"nombre":"Administrador"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) ON CONFLICT (email) DO NOTHING;

  -- Insert corresponding profile
  INSERT INTO public.perfiles (id, nombre, telefono)
  VALUES (admin_id, 'Administrador', NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Insert default business configuration
  INSERT INTO public.configuracion (id, nombre_negocio)
  VALUES (1, 'Botellón')
  ON CONFLICT (id) DO NOTHING;
END $$;
