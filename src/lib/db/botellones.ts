'use server';

import { revalidatePath } from 'next/cache';

// ── DB join result types ──

type ClienteJoin = {
  nombre: string;
  telefono_1?: string | null;
};

export type BotellonWithCliente = {
  id: string;
  codigo: string;
  estado: string;
  cliente_id: string | null;
  fecha_creacion: string;
  clientes: ClienteJoin | null;
};

export type BotellonDetail = BotellonWithCliente & { total_recargas: number; ultima_recarga?: string | null };

export type BotellonState = { success?: boolean; error?: string; id?: string };

function getSupabase() {
  return import('@supabase/supabase-js').then(({ createClient }) => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  });
}

export async function getBotellones(page = 1, pageSize = 12, search?: string): Promise<{ botellones: BotellonWithCliente[]; total: number }> {
  try {
    const supabase = await getSupabase();
    let query = supabase.from('botellones').select('*, clientes(nombre)', { count: 'exact' });
    if (search) {
      query = query.or(`codigo.ilike.%${search}%`);
    }
    const from = (page - 1) * pageSize;
    const { data, count } = await query.order('fecha_creacion', { ascending: false }).range(from, from + pageSize - 1);
    return { botellones: data || [], total: count || 0 };
  } catch {
    return { botellones: [], total: 0 };
  }
}

export async function getBotellon(id: string): Promise<BotellonDetail | null> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.from('botellones').select('*, clientes(nombre, telefono_1)').eq('id', id).single();
    const { count } = await supabase.from('recargas').select('*', { count: 'exact', head: true }).eq('botellon_id', id);
    return { ...data, total_recargas: count || 0 } as BotellonWithCliente & { total_recargas: number };
  } catch {
    return null;
  }
}

export async function getBotellonByCodigo(codigo: string): Promise<{ codigo: string; estado: string; total_recargas: number; ultima_recarga: string | null } | null> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.from('botellones').select('id, codigo, estado').eq('codigo', codigo).single();
    if (!data) return null;

    // If id is available (service_role or authenticated), fetch recarga stats
    let total_recargas = 0;
    let ultima_recarga: string | null = null;
    if (data.id) {
      const { count } = await supabase.from('recargas').select('*', { count: 'exact', head: true }).eq('botellon_id', data.id);
      total_recargas = count || 0;
      const { data: ultima } = await supabase.from('recargas').select('fecha').eq('botellon_id', data.id).order('fecha', { ascending: false }).limit(1).maybeSingle();
      ultima_recarga = ultima?.fecha || null;
    }

    return { codigo: data.codigo, estado: data.estado, total_recargas, ultima_recarga };
  } catch {
    return null;
  }
}

export async function createBotellon(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: BotellonState | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<BotellonState> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('botellones').insert({}).select('id').single();
    if (error) return { error: error.message };
    revalidatePath('/botellones');
    return { id: data.id, success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al crear' };
  }
}

export async function updateBotellon(_prev: BotellonState | null, formData: FormData): Promise<BotellonState> {
  const id = formData.get('id') as string;
  const estado = formData.get('estado') as string;
  const cliente_id = (formData.get('cliente_id') as string) || null;

  if (!id) return { error: 'ID requerido' };

  try {
    const supabase = await getSupabase();

    // If assigning a client, set estado to 'asignado'
    const update: Record<string, string | null> = {};
    if (estado) update.estado = estado;
    if (cliente_id !== undefined) {
      update.cliente_id = cliente_id || null;
      if (cliente_id && (!estado || estado === 'disponible')) {
        update.estado = 'asignado';
      }
      if (!cliente_id && estado === 'asignado') {
        update.estado = 'disponible';
      }
    }

    const { error } = await supabase.from('botellones').update(update).eq('id', id);
    if (error) return { error: error.message };

    // ── Damage/loss notification: alert admins when botellón breaks ──
    const newEstado = update.estado;
    if (newEstado === 'dañado' || newEstado === 'perdido') {
      const { data: botellon } = await supabase
        .from('botellones')
        .select('codigo')
        .eq('id', id)
        .single();

      const codigo = botellon?.codigo || 'Desconocido';

      const { data: perfiles } = await supabase
        .from('perfiles')
        .select('id');

      if (perfiles?.length) {
        const inserts = perfiles.map((p) =>
          supabase.from('notificaciones').insert({
            tipo: 'botellon_danado',
            titulo: `Botellón ${codigo} — ${newEstado}`,
            mensaje: `El botellón ${codigo} fue marcado como ${newEstado}.`,
            usuario_id: p.id,
            botellon_id: id,
          })
        );
        await Promise.all(inserts);
      }
    }

    revalidatePath(`/botellones/${id}`);
    revalidatePath('/botellones');
    return { success: true, id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al actualizar' };
  }
}

export async function getClientesForSelect(search?: string) {
  try {
    const supabase = await getSupabase();
    let query = supabase.from('clientes').select('id, nombre, codigo').order('nombre').limit(20);
    if (search) query = query.ilike('nombre', `%${search}%`);
    const { data } = await query;
    return data || [];
  } catch {
    return [];
  }
}
