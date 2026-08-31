'use server';

import { hoyZona } from '@/lib/utils/hora';

// ── Types ──

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
      .select('id, nombre, codigo, cedula, telefono_1')
      .or(`nombre.ilike.%${query}%,codigo.ilike.%${query}%,cedula.ilike.%${query}%,telefono_1.ilike.%${query}%`)
      .limit(10);
    return data || [];
  } catch {
    return [];
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
    const hoy = hoyZona();
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
