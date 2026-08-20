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

export type BotellonPublico = {
  id: string;
  codigo: string;
  estado: string;
  cliente_id: string | null;
  clienteNombre: string | null;
  total_recargas: number;
  ultima_recarga: string | null;
};

export async function getBotellonByCodigo(codigo: string): Promise<BotellonPublico | null> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('botellones')
      .select('id, codigo, estado, cliente_id, clientes(nombre)')
      .eq('codigo', codigo)
      .single();
    if (!data) return null;

    // Supabase types a nested to-one join as an array; `.single()` returns a
    // single object at runtime, so normalize both shapes before reading.
    const row = data as {
      id: string;
      codigo: string;
      estado: string;
      cliente_id: string | null;
      clientes?: { nombre: string } | { nombre: string }[] | null;
    };

    // If id is available (service_role or authenticated), fetch recarga stats
    let total_recargas = 0;
    let ultima_recarga: string | null = null;
    if (row.id) {
      const { count } = await supabase.from('recargas').select('*', { count: 'exact', head: true }).eq('botellon_id', row.id);
      total_recargas = count || 0;
      const { data: ultima } = await supabase.from('recargas').select('fecha').eq('botellon_id', row.id).order('fecha', { ascending: false }).limit(1).maybeSingle();
      ultima_recarga = ultima?.fecha || null;
    }

    const clientes = Array.isArray(row.clientes) ? row.clientes[0] : row.clientes;

    return {
      id: row.id,
      codigo: row.codigo,
      estado: row.estado,
      cliente_id: row.cliente_id ?? null,
      clienteNombre: clientes?.nombre ?? null,
      total_recargas,
      ultima_recarga,
    };
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

    // If assigning a client, set estado to 'entregado'
    const update: Record<string, string | null> = {};
    if (estado) update.estado = estado;
    if (cliente_id !== undefined) {
      update.cliente_id = cliente_id || null;
      if (cliente_id && (!estado || estado === 'planta')) {
        update.estado = 'entregado';
      }
      if (!cliente_id && estado === 'entregado') {
        update.estado = 'planta';
      }
    }

    const { error } = await supabase.from('botellones').update(update).eq('id', id);
    if (error) return { error: error.message };

    // ── Damage/loss notification: alert admins when botellón breaks ──
    const newEstado = update.estado;
    if (newEstado === 'danado' || newEstado === 'perdido') {
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

export type BotellonOperativo = {
  id: string;
  codigo: string;
  estado: string;
  cliente_id: string | null;
  fecha_entrega: string | null;
  clientes: { nombre: string } | null;
};

/**
 * Operaciones dashboard: all botellones with client join, plus today's recarga count.
 */
export async function getOperaciones(): Promise<{ botellones: BotellonOperativo[]; recargasHoy: number }> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('botellones')
      .select('id, codigo, estado, cliente_id, fecha_entrega, clientes(nombre)')
      .order('codigo');
    const hoy = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from('recargas')
      .select('*', { count: 'exact', head: true })
      .eq('fecha', hoy);
    return { botellones: (data as unknown as BotellonOperativo[]) || [], recargasHoy: count || 0 };
  } catch {
    return { botellones: [], recargasHoy: 0 };
  }
}

/**
 * Move a botellón to a new estado (kanban). If moving to "entregado",
 * a cliente_id must be provided. Returns success or error.
 */
export async function moverBotellon(
  id: string,
  nuevoEstado: string,
  clienteId: string | null = null
): Promise<BotellonState> {
  if (!id) return { error: 'ID requerido' };
  try {
    const supabase = await getSupabase();
    const update: Record<string, string | null> = { estado: nuevoEstado };

    if (nuevoEstado === 'entregado') {
      if (!clienteId) return { error: 'Cliente requerido para entregar' };
      update.cliente_id = clienteId;
      update.fecha_entrega = new Date().toISOString();
    }
    if (nuevoEstado === 'planta' || nuevoEstado === 'recibido') {
      update.cliente_id = null;
      update.fecha_entrega = null;
    }

    const { error } = await supabase.from('botellones').update(update).eq('id', id);
    if (error) return { error: error.message };

    revalidatePath('/dashboard');
    revalidatePath('/botellones');
    return { success: true, id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al mover botellón' };
  }
}
