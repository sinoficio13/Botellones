'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export type ConfigState = {
  success?: boolean;
  error?: string;
};

export type BusinessConfig = {
  nombre_negocio: string;
  telefono: string;
  direccion: string;
  email: string;
  logo_url: string | null;
};

/**
 * Read business configuration.
 * Dev mode: reads from cookie.
 * Production: reads from configuracion table.
 */
export async function getConfig(): Promise<BusinessConfig | null> {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'dev') {
    const cookieStore = await cookies();
    const raw = cookieStore.get('botellon_config')?.value;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('configuracion')
      .select('*')
      .eq('id', 1)
      .single();
    return data
      ? {
          nombre_negocio: data.nombre_negocio,
          telefono: data.telefono || '',
          direccion: data.direccion || '',
          email: data.email || '',
          logo_url: data.logo_url || null,
        }
      : null;
  } catch {
    return null;
  }
}

/**
 * Save business configuration to configuracion table (single row, id=1).
 * Dev mode: saves to cookie.
 * Production: upserts to configuracion via admin client.
 */
export async function saveConfig(
  _prevState: ConfigState | null,
  formData: FormData
): Promise<ConfigState> {
  const nombre_negocio = (formData.get('nombre_negocio') as string)?.trim();
  const telefono = (formData.get('telefono') as string)?.trim() || '';
  const direccion = (formData.get('direccion') as string)?.trim() || '';
  const email = (formData.get('email') as string)?.trim() || '';
  const logo_data_url = (formData.get('logo_data_url') as string) || undefined;

  if (!nombre_negocio) {
    return { error: 'El nombre del negocio es requerido' };
  }

  // ── Dev mode: store in cookie ──
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'dev') {
    const cookieStore = await cookies();

    // Use new logo if provided, otherwise keep existing
    let logo_url = logo_data_url;
    if (!logo_url) {
      const existing = cookieStore.get('botellon_config')?.value;
      if (existing) {
        try { logo_url = JSON.parse(existing).logo_url; } catch { /* keep undefined */ }
      }
    }

    cookieStore.set(
      'botellon_config',
      JSON.stringify({ nombre_negocio, telefono, direccion, email, logo_url }),
      { httpOnly: true, secure: false, sameSite: 'lax', path: '/' }
    );

    revalidatePath('/', 'layout');
    return { success: true };
  }

  // ── Production: Supabase ──
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    const { error } = await supabase.from('configuracion').upsert(
      { id: 1, nombre_negocio, telefono, direccion, email },
      { onConflict: 'id' }
    );

    if (error) {
      return { error: `Error al guardar: ${error.message}` };
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Error desconocido al guardar',
    };
  }
}
