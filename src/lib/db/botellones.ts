'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type BotellonState = { success?: boolean; error?: string; id?: string };

function getSupabase() {
  return import('@supabase/supabase-js').then(({ createClient }) => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  });
}

export async function getBotellones(page = 1, pageSize = 12, search?: string) {
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

export async function getBotellon(id: string) {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.from('botellones').select('*, clientes(nombre, telefono_1)').eq('id', id).single();
    const { count } = await supabase.from('recargas').select('*', { count: 'exact', head: true }).eq('botellon_id', id);
    return { ...data, total_recargas: count || 0 } as any;
  } catch {
    return null;
  }
}

export async function getBotellonByCodigo(codigo: string) {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.from('botellones').select('*').eq('codigo', codigo).single();
    if (!data) return null;
    const { count } = await supabase.from('recargas').select('*', { count: 'exact', head: true }).eq('botellon_id', data.id);
    const { data: ultima } = await supabase.from('recargas').select('fecha').eq('botellon_id', data.id).order('fecha', { ascending: false }).limit(1).maybeSingle();
    return { ...data, total_recargas: count || 0, ultima_recarga: ultima?.fecha || null };
  } catch {
    return null;
  }
}

export async function createBotellon(_prev: BotellonState | null, formData: FormData): Promise<BotellonState> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('botellones').insert({}).select('id').single();
    if (error) return { error: error.message };
    revalidatePath('/botellones');
    redirect(`/botellones/${data.id}`);
  } catch (err: any) {
    return { error: err?.message || 'Error al crear' };
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
    const update: any = {};
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
  } catch (err: any) {
    return { error: err?.message || 'Error al actualizar' };
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
