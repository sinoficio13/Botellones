'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEstadosPermitidos, type Estado } from '@/lib/utils/estados';

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
  total_recargas: number;
  ultima_recarga: string | null;
};

/**
 * Public-safe lookup consumed by the anonymous QR page (`/b/[codigo]`).
 * Deliberately excludes the `clientes` join: the owner's name is personal
 * data that must never be serialized into a force-dynamic RSC payload
 * reachable by any anonymous browser. Codes are sequentially enumerable, so
 * this function carries NO client PII by design.
 */
export async function getBotellonByCodigo(codigo: string): Promise<BotellonPublico | null> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('botellones')
      .select('id, codigo, estado, cliente_id')
      .eq('codigo', codigo)
      .single();
    if (!data) return null;

    const row = data as {
      id: string;
      codigo: string;
      estado: string;
      cliente_id: string | null;
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

    return {
      id: row.id,
      codigo: row.codigo,
      estado: row.estado,
      cliente_id: row.cliente_id ?? null,
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

// ── Shared read-validate-write helpers (server validation + CAS, spec R2) ──

/** Reads the current estado + cliente_id of a botellon. */
async function leerActual(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('botellones')
    .select('estado, cliente_id')
    .eq('id', id)
    .single();
  return {
    actual: data?.estado as Estado | undefined,
    clienteActual: data?.cliente_id ?? null,
    error,
  };
}

/**
 * Strict machine check (GAP-1: no `asignando` branch — the sale exception
 * lives in the writers where the clientless→assigned boundary is known).
 * Returns null when the move is valid, else the exact error string.
 * Identity is always permitted via `getEstadosPermitidos`.
 */
function validarDestino(actual: Estado, destino: string): string | null {
  const permitidos = getEstadosPermitidos(actual);
  return permitidos.includes(destino as Estado)
    ? null
    : `Transición no permitida: ${actual} → ${destino}`;
}

/**
 * Shared sale-destino resolver for clientless→assigned writes (GAP-2):
 * identity keeps the current estado, {entregado, recarga} are machine-exempt,
 * anything else defaults to 'entregado' (locked decision 3).
 */
function resolverDestinoAsignacion(actual: Estado, destino: string | null): string {
  if (destino === actual) return actual;
  if (destino === 'entregado' || destino === 'recarga') return destino;
  return 'entregado';
}

export async function updateBotellon(_prev: BotellonState | null, formData: FormData): Promise<BotellonState> {
  const id = formData.get('id') as string;
  const estado = formData.get('estado') as string;
  const cliente_id = (formData.get('cliente_id') as string) || null;

  if (!id) return { error: 'ID requerido' };

  try {
    const supabase = await getSupabase();

    const { actual, clienteActual, error: readError } = await leerActual(supabase, id);
    if (readError) return { error: readError.message };
    if (!actual) return { error: 'Botellón no encontrado' };

    // Sale exception (D7): clientless → assigned only. Both-set → strict.
    const asignando = cliente_id !== null && clienteActual === null;

    const update: Record<string, string | null> = {};
    if (asignando) {
      update.estado = resolverDestinoAsignacion(actual, estado || null);
      update.cliente_id = cliente_id;
    } else {
      if (estado) {
        const error = validarDestino(actual, estado);
        if (error) return { error }; // zero writes
        update.estado = estado;
      }
      // Unassign keeps the current estado — clientless botellones in
      // 'recibido'/'listo' are stock, not 'planta'.
      update.cliente_id = cliente_id || null;
    }

    // CAS guard: conditional write on the estado we just read.
    const { data, error } = await supabase
      .from('botellones')
      .update(update)
      .eq('id', id)
      .eq('estado', actual)
      .select();
    if (error) return { error: error.message };
    if (!data || data.length === 0) {
      // Concurrent loser (spec S7): same error string as a validation reject.
      return { error: `Transición no permitida: ${actual} → ${update.estado ?? actual}` };
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
 * Reads the current row, validates against the machine (or the sale
 * exception), and writes with a CAS guard on the read estado.
 */
export async function moverBotellon(
  id: string,
  nuevoEstado: string,
  clienteId: string | null = null
): Promise<BotellonState> {
  if (!id) return { error: 'ID requerido' };
  if (nuevoEstado === 'entregado' && !clienteId) return { error: 'Cliente requerido para entregar' };
  try {
    const supabase = await getSupabase();

    const { actual, clienteActual, error: readError } = await leerActual(supabase, id);
    if (readError) return { error: readError.message };
    if (!actual) return { error: 'Botellón no encontrado' };

    // Sale exception (D7): clientless → assigned only.
    const asignando = clienteId !== null && clienteActual === null;
    const update: Record<string, string | null> = { estado: nuevoEstado };
    let destino = nuevoEstado;

    if (asignando) {
      destino = resolverDestinoAsignacion(actual, nuevoEstado);
      update.estado = destino;
      update.cliente_id = clienteId;
      if (destino === 'entregado') {
        update.fecha_entrega = new Date().toISOString();
      }
    } else {
      const error = validarDestino(actual, nuevoEstado);
      if (error) return { error }; // zero writes

      // Side effects, orthogonal to validation: entregado stamps
      // fecha_entrega; recibido clears cliente/fecha (reintegro).
      if (nuevoEstado === 'entregado') {
        update.cliente_id = clienteId;
        update.fecha_entrega = new Date().toISOString();
      }
      if (nuevoEstado === 'recibido') {
        update.cliente_id = null;
        update.fecha_entrega = null;
      }
    }

    // CAS guard: conditional write on the estado we just read.
    const { data, error } = await supabase
      .from('botellones')
      .update(update)
      .eq('id', id)
      .eq('estado', actual)
      .select();
    if (error) return { error: error.message };
    if (!data || data.length === 0) {
      // Concurrent loser (spec S7): same error string as a validation reject.
      return { error: `Transición no permitida: ${actual} → ${destino}` };
    }

    revalidatePath('/dashboard');
    revalidatePath('/botellones');
    return { success: true, id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al mover botellón' };
  }
}
