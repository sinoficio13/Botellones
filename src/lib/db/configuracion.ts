import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ──

export type BusinessConfig = {
  nombre_negocio: string;
  telefono: string;
  direccion: string;
  email: string;
  logo_url: string | null;
};

// ── Defaults ──

const DEFAULT_BUSINESS_NAME = 'Botellón';

// ── Query ──

/**
 * Read the full business configuration (single row, id=1).
 * Always returns a complete object with defaults so callers never get null.
 */
export async function getConfiguracion(): Promise<BusinessConfig> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('configuracion')
      .select('nombre_negocio, telefono, direccion, email, logo_url')
      .eq('id', 1)
      .maybeSingle();

    return {
      nombre_negocio: data?.nombre_negocio || DEFAULT_BUSINESS_NAME,
      telefono: data?.telefono || '',
      direccion: data?.direccion || '',
      email: data?.email || '',
      logo_url: data?.logo_url || null,
    };
  } catch {
    return {
      nombre_negocio: DEFAULT_BUSINESS_NAME,
      telefono: '',
      direccion: '',
      email: '',
      logo_url: null,
    };
  }
}

/**
 * Upsert the full business configuration (single row, id=1).
 */
export async function saveConfiguracion(
  input: BusinessConfig
): Promise<{ error?: string }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('configuracion')
      .upsert({ id: 1, ...input }, { onConflict: 'id' });

    if (error) {
      return { error: `Error al guardar: ${error.message}` };
    }

    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Error desconocido al guardar',
    };
  }
}
