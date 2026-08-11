'use server';

import { revalidatePath } from 'next/cache';

// ── Types ──

export type NotificacionRow = {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  cliente_id: string | null;
  botellon_id: string | null;
  leida: boolean;
  creada_en: string;
  // joined fields for rendering
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  botellon_codigo?: string | null;
};

export type NotificacionState = {
  success?: boolean;
  error?: string;
};

export type NotificacionPage = {
  items: NotificacionRow[];
  total: number;
};

// ── Helpers ──

function getSupabase() {
  return import('@supabase/supabase-js').then(({ createClient }) => {
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      '';
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  });
}

// ── Read: unread count ──

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const supabase = await getSupabase();
    const { count } = await supabase
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId)
      .eq('leida', false);
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ── Read: paginated list ──

export async function getNotificaciones(
  userId: string,
  filter?: string,
  page = 1
): Promise<NotificacionPage> {
  try {
    const supabase = await getSupabase();
    const pageSize = 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('notificaciones')
      .select(
        `
        *,
        clientes(nombre, telefono_1),
        botellones(codigo)
      `,
        { count: 'exact' }
      )
      .eq('usuario_id', userId)
      .order('creada_en', { ascending: false });

    if (filter && filter !== 'todas') {
      query = query.eq('tipo', filter);
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error('Error fetching notificaciones:', error);
      return { items: [], total: 0 };
    }

    const items: NotificacionRow[] = (data || []).map((row: any) => ({
      id: row.id,
      usuario_id: row.usuario_id,
      tipo: row.tipo,
      titulo: row.titulo,
      mensaje: row.mensaje,
      cliente_id: row.cliente_id,
      botellon_id: row.botellon_id,
      leida: row.leida ?? false,
      creada_en: row.creada_en,
      cliente_nombre: row.clientes?.nombre ?? null,
      cliente_telefono: row.clientes?.telefono_1 ?? null,
      botellon_codigo: row.botellones?.codigo ?? null,
    }));

    return { items, total: count ?? 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

// ── Read: last N for dropdown ──

export async function getLastNotificaciones(
  userId: string,
  limit = 5
): Promise<NotificacionRow[]> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('notificaciones')
      .select(
        `
        *,
        clientes(nombre, telefono_1),
        botellones(codigo)
      `
      )
      .eq('usuario_id', userId)
      .order('creada_en', { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      usuario_id: row.usuario_id,
      tipo: row.tipo,
      titulo: row.titulo,
      mensaje: row.mensaje,
      cliente_id: row.cliente_id,
      botellon_id: row.botellon_id,
      leida: row.leida ?? false,
      creada_en: row.creada_en,
      cliente_nombre: row.clientes?.nombre ?? null,
      cliente_telefono: row.clientes?.telefono_1 ?? null,
      botellon_codigo: row.botellones?.codigo ?? null,
    }));
  } catch {
    return [];
  }
}

// ── Write: mark single as read ──

export async function markAsRead(
  _prev: NotificacionState | null,
  formData: FormData
): Promise<NotificacionState> {
  const id = formData.get('id') as string;
  if (!id) return { error: 'Notification ID required' };

  try {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id);

    if (error) return { error: error.message };

    revalidatePath('/notificaciones');
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error marking as read' };
  }
}

// ── Write: mark all as read ──

export async function markAllAsRead(
  _prev: NotificacionState | null,
  formData: FormData
): Promise<NotificacionState> {
  const userId = formData.get('userId') as string;
  if (!userId) return { error: 'User ID required' };

  try {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('usuario_id', userId)
      .eq('leida', false);

    if (error) return { error: error.message };

    revalidatePath('/notificaciones');
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'Error marking all as read' };
  }
}

// ── Write: insert single notification (internal use) ──

export async function insertNotificacion(data: {
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensaje?: string;
  cliente_id?: string;
  botellon_id?: string;
}): Promise<void> {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from('notificaciones').insert({
      usuario_id: data.usuario_id,
      tipo: data.tipo,
      titulo: data.titulo,
      mensaje: data.mensaje ?? null,
      cliente_id: data.cliente_id ?? null,
      botellon_id: data.botellon_id ?? null,
    });

    if (error) {
      console.error('Error inserting notification:', error);
    }
  } catch (err) {
    console.error('Error inserting notification:', err);
  }
}

// ── Write: insert to multiple recipients ──

export async function insertNotificacionMulti(
  usuarios: string[],
  data: {
    tipo: string;
    titulo: string;
    mensaje?: string;
    cliente_id?: string;
    botellon_id?: string;
  }
): Promise<void> {
  await Promise.all(
    usuarios.map((usuario_id) =>
      insertNotificacion({
        usuario_id,
        tipo: data.tipo,
        titulo: data.titulo,
        mensaje: data.mensaje,
        cliente_id: data.cliente_id,
        botellon_id: data.botellon_id,
      })
    )
  );
}

// ── Write: inactivity check (lazy, called on /notificaciones load) ──

export async function checkInactividad(): Promise<void> {
  try {
    const supabase = await getSupabase();
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Find clients with no recargas in the last 30 days
    const { data: inactiveClients } = await supabase
      .from('clientes')
      .select('id, nombre')
      .not(
        'id',
        'in',
        supabase
          .from('recargas')
          .select('cliente_id')
          .gte('fecha', thirtyDaysAgo.split('T')[0])
      );

    if (!inactiveClients?.length) return;

    // Dedup: skip clients that already have an inactividad notification in the last 7 days
    const { data: recentInactividad } = await supabase
      .from('notificaciones')
      .select('cliente_id')
      .eq('tipo', 'inactividad')
      .gte('creada_en', sevenDaysAgo);

    const recentClientIds = new Set(
      (recentInactividad || []).map((n) => n.cliente_id)
    );

    const toNotify = inactiveClients.filter(
      (c) => !recentClientIds.has(c.id)
    );

    if (!toNotify.length) return;

    // Get all user IDs from perfiles (small user base)
    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('id');

    if (!perfiles?.length) return;

    // Insert one notification per inactive client for each user
    for (const cliente of toNotify) {
      const inserts = perfiles.map((p) =>
        supabase.from('notificaciones').insert({
          usuario_id: p.id,
          tipo: 'inactividad',
          titulo: `${cliente.nombre} — sin recargas en 30 días`,
          mensaje: `${cliente.nombre} no ha registrado recargas en el último mes.`,
          cliente_id: cliente.id,
        })
      );
      await Promise.all(inserts);
    }
  } catch (err) {
    console.error('Error in checkInactividad:', err);
  }
}
