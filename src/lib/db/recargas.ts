'use server';

import { revalidatePath } from 'next/cache';

export type RecargaState = { success?: boolean; error?: string; recargaId?: string };

function getSupabase() {
  return import('@supabase/supabase-js').then(({ createClient }) => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  });
}

export async function getClientesForSearch(query: string) {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, codigo, telefono_1')
      .or(`nombre.ilike.%${query}%,codigo.ilike.%${query}%,telefono_1.ilike.%${query}%`)
      .limit(10);
    return data || [];
  } catch {
    return [];
  }
}

export async function getBotellonesDelCliente(clienteId: string) {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('botellones')
      .select('id, codigo, estado')
      .eq('cliente_id', clienteId)
      .in('estado', ['asignado', 'en_recarga'])
      .order('codigo');
    return data || [];
  } catch {
    return [];
  }
}

export async function registrarRecarga(
  _prev: RecargaState | null,
  formData: FormData
): Promise<RecargaState> {
  const cliente_id = formData.get('cliente_id') as string;
  const botellon_id = formData.get('botellon_id') as string;

  if (!cliente_id || !botellon_id) {
    return { error: 'Cliente y botellón requeridos' };
  }

  try {
    const supabase = await getSupabase();

    // Get next registro number
    const { data: lastRecarga } = await supabase
      .from('recargas')
      .select('numero_registro')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastRecarga?.numero_registro
      ? parseInt(lastRecarga.numero_registro.replace('REC-', ''))
      : 0;
    const numero_registro = `REC-${String(lastNum + 1).padStart(6, '0')}`;

    // Insert recarga
    const { error } = await supabase.from('recargas').insert({
      numero_registro,
      cliente_id,
      botellon_id,
      fecha: new Date().toISOString().slice(0, 10),
      hora: new Date().toTimeString().slice(0, 8),
      realizada_por: '00000000-0000-0000-0000-000000000000', // dev placeholder
    });

    if (error) return { error: error.message };

    // Update botellon estado to 'en_recarga' if it was 'asignado'
    await supabase
      .from('botellones')
      .update({ estado: 'en_recarga' })
      .eq('id', botellon_id)
      .eq('estado', 'asignado');

    revalidatePath('/clientes');
    revalidatePath('/recargas');
    revalidatePath('/botellones');
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error al registrar recarga' };
  }
}

export async function getRecargasCliente(clienteId: string, desde?: string, hasta?: string) {
  try {
    const supabase = await getSupabase();
    let query = supabase
      .from('recargas')
      .select('id, fecha, hora, numero_registro, botellones(codigo)')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .limit(100);

    if (desde) query = query.gte('fecha', desde);
    if (hasta) query = query.lte('fecha', hasta);

    const { data, count } = await query;
    return { recargas: data || [], total: count || 0 };
  } catch {
    return { recargas: [], total: 0 };
  }
}

export async function getRecargasBotellon(botellonId: string) {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('recargas')
      .select('id, fecha, hora, numero_registro, clientes(nombre)')
      .eq('botellon_id', botellonId)
      .order('fecha', { ascending: false })
      .limit(100);
    const { count } = await supabase
      .from('recargas')
      .select('*', { count: 'exact', head: true })
      .eq('botellon_id', botellonId);
    return { recargas: data || [], total: count || 0 };
  } catch {
    return { recargas: [], total: 0 };
  }
}

export async function getContadores() {
  try {
    const supabase = await getSupabase();
    const hoy = new Date().toISOString().slice(0, 10);
    const mes = hoy.slice(0, 7);

    const { count: hoy_count } = await supabase
      .from('recargas')
      .select('*', { count: 'exact', head: true })
      .eq('fecha', hoy);

    const { count: mes_count } = await supabase
      .from('recargas')
      .select('*', { count: 'exact', head: true })
      .gte('fecha', `${mes}-01`)
      .lte('fecha', hoy);

    const { count: total } = await supabase
      .from('recargas')
      .select('*', { count: 'exact', head: true });

    return { recargas_hoy: hoy_count || 0, recargas_mes: mes_count || 0, recargas_total: total || 0 };
  } catch {
    return { recargas_hoy: 0, recargas_mes: 0, recargas_total: 0 };
  }
}
