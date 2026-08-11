'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// ── Types ──

export type ClienteState = {
  success?: boolean;
  error?: string;
  clienteId?: string;
};

export type ClienteRow = {
  id: string;
  codigo: string;
  nombre: string;
  negocio: string | null;
  cedula: string | null;
  telefono_1: string | null;
  telefono_2: string | null;
  whatsapp: string | null;
  tipo_cliente: string | null;
  horario_preferido: string | null;
  dias_preferidos: string | null;
  contacto_preferido: string | null;
  observaciones: string | null;
  fecha_registro: string | null;
  total_recargas: number;
};

export type ClienteListRow = {
  id: string;
  codigo: string;
  nombre: string;
  negocio: string | null;
  telefono_1: string | null;
  tipo_cliente: string | null;
  fecha_registro: string | null;
  ultima_recarga: string | null;
  total_recargas: number;
};

// ── Helpers ──

function getSupabase() {
  // Dynamic import so it only runs on server
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return import('@supabase/supabase-js').then(async ({ createClient }) => {
    // In dev mode without service_role, fall back to anon key
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      '';
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  });
}

// ── Create ──

export async function createCliente(
  _prevState: ClienteState | null,
  formData: FormData
): Promise<ClienteState> {
  const nombre = (formData.get('nombre') as string)?.trim();
  const telefono_1 = (formData.get('telefono_1') as string)?.trim();
  const negocio = (formData.get('negocio') as string)?.trim() || null;
  const cedula = (formData.get('cedula') as string)?.trim() || null;
  const telefono_2 = (formData.get('telefono_2') as string)?.trim() || null;
  const whatsapp = (formData.get('whatsapp') as string)?.trim() || telefono_1;
  const tipo_cliente = (formData.get('tipo_cliente') as string) || null;
  const horario_preferido = (formData.get('horario_preferido') as string) || null;
  const dias_preferidos = (formData.get('dias_preferidos') as string)?.trim() || null;
  const contacto_preferido = (formData.get('contacto_preferido') as string) || null;
  const observaciones = (formData.get('observaciones') as string)?.trim() || null;

  if (!nombre) {
    return { error: 'El nombre es requerido' };
  }
  if (!telefono_1) {
    return { error: 'El teléfono es requerido' };
  }

  try {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre,
        telefono_1,
        negocio,
        cedula,
        telefono_2,
        whatsapp,
        tipo_cliente,
        horario_preferido,
        dias_preferidos,
        contacto_preferido,
        observaciones,
      })
      .select('id')
      .single();

    if (error) {
      return { error: `Error al crear cliente: ${error.message}` };
    }

    revalidatePath('/clientes');
    redirect(`/clientes/${data.id}`);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : 'Error desconocido. ¿Falta SUPABASE_SERVICE_ROLE_KEY en .env.local?',
    };
  }
}

// ── Read (list) ──

export async function getClientes(
  page = 1,
  pageSize = 20,
  search?: string,
  orderBy = 'fecha_registro',
  orderDir: 'asc' | 'desc' = 'desc'
): Promise<{ clientes: ClienteListRow[]; total: number }> {
  try {
    const supabase = await getSupabase();

    let query = supabase
      .from('clientes')
      .select('id, codigo, nombre, negocio, telefono_1, tipo_cliente, fecha_registro', {
        count: 'exact',
      });

    if (search) {
      query = query.or(`nombre.ilike.%${search}%,telefono_1.ilike.%${search}%,codigo.ilike.%${search}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count } = await query
      .order(orderBy, { ascending: orderDir === 'asc' })
      .range(from, to);

    // Get recarga stats for each client
    const clientes: ClienteListRow[] = [];
    if (data) {
      for (const c of data) {
        const { count: total_recargas } = await supabase
          .from('recargas')
          .select('*', { count: 'exact', head: true })
          .eq('cliente_id', c.id);

        const { data: ultima } = await supabase
          .from('recargas')
          .select('fecha')
          .eq('cliente_id', c.id)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle();

        clientes.push({
          ...c,
          total_recargas: total_recargas || 0,
          ultima_recarga: ultima?.fecha || null,
        });
      }
    }

    return { clientes, total: count || 0 };
  } catch {
    return { clientes: [], total: 0 };
  }
}

// ── Read (single) ──

export async function getCliente(id: string): Promise<ClienteRow | null> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (!data) return null;

    const { count } = await supabase
      .from('recargas')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', id);

    return { ...data, total_recargas: count || 0 };
  } catch {
    return null;
  }
}

// ── Update ──

export async function updateCliente(
  _prevState: ClienteState | null,
  formData: FormData
): Promise<ClienteState> {
  const id = formData.get('id') as string;
  const nombre = (formData.get('nombre') as string)?.trim();
  const telefono_1 = (formData.get('telefono_1') as string)?.trim();

  if (!id) return { error: 'ID de cliente no proporcionado' };
  if (!nombre) return { error: 'El nombre es requerido' };
  if (!telefono_1) return { error: 'El teléfono es requerido' };

  const updates: Record<string, unknown> = {
    nombre,
    telefono_1,
    negocio: (formData.get('negocio') as string)?.trim() || null,
    cedula: (formData.get('cedula') as string)?.trim() || null,
    telefono_2: (formData.get('telefono_2') as string)?.trim() || null,
    whatsapp: (formData.get('whatsapp') as string)?.trim() || telefono_1,
    tipo_cliente: (formData.get('tipo_cliente') as string) || null,
    horario_preferido: (formData.get('horario_preferido') as string) || null,
    dias_preferidos: (formData.get('dias_preferidos') as string)?.trim() || null,
    contacto_preferido: (formData.get('contacto_preferido') as string) || null,
    observaciones: (formData.get('observaciones') as string)?.trim() || null,
  };

  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from('clientes').update(updates).eq('id', id);

    if (error) {
      return { error: `Error al actualizar: ${error.message}` };
    }

    revalidatePath(`/clientes/${id}`);
    return { success: true, clienteId: id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Error al actualizar',
    };
  }
}
