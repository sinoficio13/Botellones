'use server';

import { revalidatePath } from 'next/cache';

type DireccionState = { success?: boolean; error?: string };

function getSupabase() {
  return import('@supabase/supabase-js').then(({ createClient }) => {
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      '';
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  });
}

export async function getDireccion(clienteId: string) {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('direcciones')
      .select('*')
      .eq('cliente_id', clienteId)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export async function saveDireccion(
  _prev: DireccionState | null,
  formData: FormData
): Promise<DireccionState> {
  const cliente_id = formData.get('cliente_id') as string;
  if (!cliente_id) return { error: 'ID de cliente requerido' };

  const values = {
    cliente_id,
    calle: (formData.get('calle') as string)?.trim() || null,
    avenida: (formData.get('avenida') as string)?.trim() || null,
    sector: (formData.get('sector') as string)?.trim() || null,
    urbanizacion: (formData.get('urbanizacion') as string)?.trim() || null,
    ciudad: (formData.get('ciudad') as string)?.trim() || null,
    estado: (formData.get('estado') as string)?.trim() || null,
    referencia: (formData.get('referencia') as string)?.trim() || null,
    latitud: parseFloatOrNull(formData.get('latitud') as string),
    longitud: parseFloatOrNull(formData.get('longitud') as string),
    link_mapa: (formData.get('link_mapa') as string)?.trim() || null,
    gps_origen: (formData.get('gps_origen') as string)?.trim() || null,
  };

  try {
    const supabase = await getSupabase();

    // Check if address exists → upsert
    const { data: existing } = await supabase
      .from('direcciones')
      .select('id')
      .eq('cliente_id', cliente_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('direcciones')
        .update(values)
        .eq('cliente_id', cliente_id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from('direcciones').insert(values);
      if (error) return { error: error.message };
    }

    revalidatePath(`/clientes/${cliente_id}`);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al guardar dirección' };
  }
}

function parseFloatOrNull(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
