'use server';

import { revalidatePath } from 'next/cache';

import { procesarLoyalty, REALIZADA_POR_PLACEHOLDER } from '@/lib/db/loyalty';

// ── Types ──

export type RecargaState = {
  success?: boolean;
  error?: string;
  recargaId?: string;
  premioGenerado?: { nivel: number; id: string };
};

export type RecargaConBotellon = {
  id: string;
  fecha: string;
  hora: string;
  numero_registro: string;
  botellones: { codigo: string } | null;
};

export type RecargaConCliente = {
  id: string;
  fecha: string;
  hora: string;
  numero_registro: string;
  clientes: { nombre: string } | null;
};

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
      .in('estado', ['entregado'])
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

    // Get next registro number (created_at DESC, id DESC so ties break deterministically)
    const { data: lastRecarga } = await supabase
      .from('recargas')
      .select('numero_registro')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastRecarga?.numero_registro
      ? parseInt(lastRecarga.numero_registro.replace('REC-', ''))
      : 0;
    const numero_registro = `REC-${String(lastNum + 1).padStart(6, '0')}`;

    // dev placeholder — will be replaced with auth.uid() after EPIC-1 auth hardening
    const realizada_por = REALIZADA_POR_PLACEHOLDER;

    // Insert recarga
    const { error } = await supabase.from('recargas').insert({
      numero_registro,
      cliente_id,
      botellon_id,
      fecha: new Date().toISOString().slice(0, 10),
      hora: new Date().toTimeString().slice(0, 8),
      realizada_por,
    });

    if (error) return { error: error.message };

    // Update botellon estado to 'recarga' if it was 'entregado'
    await supabase
      .from('botellones')
      .update({ estado: 'recarga' })
      .eq('id', botellon_id)
      .eq('estado', 'entregado');

    // ── Loyalty detection ──
    // Shared helper: premio (every 100 recargas) + premio_cerca (5 before next level)
    const { premios } = await procesarLoyalty([cliente_id], realizada_por);
    const premioGenerado = premios[0];

    revalidatePath('/clientes');
    revalidatePath('/recargas');
    revalidatePath('/botellones');

    const result: RecargaState = { success: true };
    if (premioGenerado) {
      result.premioGenerado = premioGenerado;
    }
    return result;
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al registrar recarga' };
  }
}

export async function getRecargasCliente(clienteId: string, desde?: string, hasta?: string): Promise<{ recargas: RecargaConBotellon[]; total: number }> {
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
    return { recargas: (data as unknown as RecargaConBotellon[]) || [], total: count || 0 };
  } catch {
    return { recargas: [], total: 0 };
  }
}

export async function getRecargasBotellon(botellonId: string): Promise<{ recargas: RecargaConCliente[]; total: number }> {
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
    return { recargas: (data as unknown as RecargaConCliente[]) || [], total: count || 0 };
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
