'use server';

import { revalidatePath } from 'next/cache';

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

    // dev placeholder — will be replaced with auth.uid() after EPIC-1 auth hardening
    const realizada_por = '00000000-0000-0000-0000-000000000000';

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

    let premioGenerado: { nivel: number; id: string } | undefined;

    const { count } = await supabase
      .from('recargas')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', cliente_id);

    const totalRecargas = count ?? 0;

    if (totalRecargas > 0 && totalRecargas % 100 === 0) {
      const { data: premioData, error: premioError } = await supabase
        .from('premios')
        .insert({
          cliente_id,
          nivel_recargas: totalRecargas,
          estado: 'pendiente',
          fecha_alcanzado: new Date().toISOString().slice(0, 10),
        })
        .select('id')
        .single();

      if (premioError) {
        if (premioError.code === '23505') {
          // Duplicate — already handled in another request, do nothing
        } else {
          console.error('Error inserting premio:', premioError);
        }
      } else if (premioData) {
        premioGenerado = { nivel: totalRecargas, id: premioData.id };

        const { data: clienteData } = await supabase
          .from('clientes')
          .select('nombre')
          .eq('id', cliente_id)
          .single();

        const clienteName = clienteData?.nombre || 'Cliente';

        await supabase.from('notificaciones').insert({
          tipo: 'premio',
          titulo: `¡${clienteName} alcanzó ${totalRecargas} recargas!`,
          mensaje: `Premio pendiente — nivel ${totalRecargas}`,
          usuario_id: realizada_por,
          cliente_id,
        });
      }
    }

    // ── premio_cerca: notify when client is 5 recargas away from next prize ──
    // Triggered at 95, 195, 295, 395, etc. (not at exact multiples of 100)
    if (totalRecargas > 0 && (totalRecargas + 5) % 100 === 0 && totalRecargas % 100 !== 0) {
      const nextLevel = Math.ceil(totalRecargas / 100) * 100;
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nombre')
        .eq('id', cliente_id)
        .single();

      const clienteNombre = clienteData?.nombre || 'Cliente';

      // Query all profiles — small user base (EPIC-1 will add role filtering)
      const { data: perfiles } = await supabase
        .from('perfiles')
        .select('id');

      if (perfiles?.length) {
        const inserts = perfiles.map((p) =>
          supabase.from('notificaciones').insert({
            tipo: 'premio_cerca',
            titulo: `¡${clienteNombre} está a 5 recargas del premio!`,
            mensaje: `${clienteNombre} tiene ${totalRecargas} recargas. Le faltan 5 para el nivel ${nextLevel}.`,
            usuario_id: p.id,
            cliente_id,
          })
        );
        await Promise.all(inserts);
      }
    }

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
