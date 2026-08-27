'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEstadosPermitidos, ESTADOS_KANBAN, type Estado } from '@/lib/utils/estados';
import type { BotellonAgrupable } from '@/lib/utils/grupos';
import { normalizarCedula } from '@/lib/utils/cola';

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

// ── Cola operativa (REQ-COS-16) ──
// Queue feed: client-owned rows only (stock excluded), the 4 queue estados,
// FIFO order by estado_desde ASC. Consumed by the fase-3 client-grouped queue:
// the hook feeds these rows through fase-1 `agrupar()` so each estado tab shows
// FIFO groups (group age = min(estado_desde), members oldest-first).

export type ColaCliente = {
  nombre: string;
  cedula: string | null;
  telefono_1: string | null;
  whatsapp: string | null;
};

export type ColaBotellon = BotellonAgrupable & { cliente_id: string; clientes: ColaCliente };

const SELECT_COLA =
  'id, codigo, estado, estado_desde, cliente_id, clientes(nombre, cedula, telefono_1, whatsapp)';

// Nombre-search variant of SELECT_COLA: `!inner` on the embedded client forces
// inner-join semantics so the embedded ilike filter REDUCES top-level rows
// (PostgREST embedded-resource filters never reduce rows without it). The hint
// belongs in the SELECT — the filter path (`clientes!inner.nombre`) is not
// supported and errors 42703 on the project's PostgREST (verified live).
const SELECT_COLA_NOMBRE =
  'id, codigo, estado, estado_desde, cliente_id, clientes!inner(nombre, cedula, telefono_1, whatsapp)';

/**
 * Queue feed (REQ-COS-16). Client-owned rows in the 4 queue estados, FIFO by
 * `estado_desde` ASC.
 *
 * Error semantics (carried R4-004): returns `null` when the fetch failed
 * (transport rejection OR PostgREST error — supabase-js resolves errors as
 * `{ data: null, error }`, so the resolved `error` is checked explicitly) so
 * the hook can show a distinct fetch-error state; returns `[]` ONLY for a
 * genuine empty queue. The hook maps null → error, [] → empty.
 */
export async function getColaOperaciones(): Promise<ColaBotellon[] | null> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('botellones')
      .select(SELECT_COLA)
      .not('cliente_id', 'is', null)
      .in('estado', ESTADOS_KANBAN)
      .order('estado_desde', { ascending: true });
    if (error) return null;
    return (data as unknown as ColaBotellon[]) || [];
  } catch {
    return null;
  }
}

// ── Buscador (REQ-COS-20) ──
// Parallel server-side search over the same 4 queue estados the queue shows
// (client-owned): nombre ilike and código ilike via PostgREST, plus a cédula
// candidates fetch filtered in JS with digits-only normalization (design D7 —
// PostgREST cannot regexp-normalize). Results grouped by match type; a row may
// appear in more than one bucket when it matches several criteria.

export type ResultadoBusqueda = {
  porNombre: ColaBotellon[];
  porCedula: ColaBotellon[];
  porCodigo: ColaBotellon[];
};

/** Rows the cédula filter inspects — the client join may be null on orphan rows. */
type FilaCandidata = ColaBotellon & { clientes: ColaCliente | null };

const SIN_RESULTADOS: ResultadoBusqueda = { porNombre: [], porCedula: [], porCodigo: [] };

/** Shape of the resolved supabase-js responses the search chains produce. */
type RespuestaCola = { data: unknown[] | null; error?: { message: string } | null };

export async function buscarColaOperaciones(q: string): Promise<ResultadoBusqueda> {
  const termino = q.trim();
  if (termino.length < 2) return SIN_RESULTADOS;

  let porNombre: RespuestaCola;
  let porCodigo: RespuestaCola;
  let candidatos: RespuestaCola;

  try {
    const supabase = await getSupabase();
    // Shared prefix: client-owned rows in the 4 queue estados (matches the queue).
    const base = () =>
      supabase.from('botellones').select(SELECT_COLA).not('cliente_id', 'is', null).in('estado', ESTADOS_KANBAN);
    // Nombre chain: inner-join select (`clientes!inner(...)`) so the embedded
    // ilike filter excludes non-matching rows and the join is always present.
    const baseNombre = () =>
      supabase.from('botellones').select(SELECT_COLA_NOMBRE).not('cliente_id', 'is', null).in('estado', ESTADOS_KANBAN);

    [porNombre, porCodigo, candidatos] = await Promise.all([
      baseNombre().ilike('clientes.nombre', `%${termino}%`).order('estado_desde', { ascending: true }),
      base().ilike('codigo', `%${termino}%`).order('estado_desde', { ascending: true }),
      base().order('estado_desde', { ascending: true }),
    ]);
  } catch {
    // Transport-level failures (supabase import, chain rejection): last-resort
    // empty buckets. The PostgREST error check below lives OUTSIDE this try so
    // its throw is NOT swallowed here — see the comment at the check.
    return SIN_RESULTADOS;
  }

  // supabase-js RESOLVES PostgREST errors as `{ data: null, error }` — it does
  // NOT reject, so an unchecked `error` here used to flow into the empty
  // buckets below and render a false 'Sin resultados' state (the Buscador's
  // error alert only fires on a rejected promise). Throw on ANY chain error so
  // the server-action promise rejects and the client `.catch` shows the alert.
  const errorPostgrest = [porNombre, porCodigo, candidatos].find((r) => r.error)?.error;
  if (errorPostgrest) throw new Error(errorPostgrest.message);

  // Cédula: digits-only on BOTH sides; contains-semantics mirrors ilike.
  const cedulaQ = normalizarCedula(termino);
  const porCedula = cedulaQ
    ? ((candidatos.data ?? []) as unknown as FilaCandidata[]).filter((b) =>
        normalizarCedula(b.clientes?.cedula ?? null).includes(cedulaQ)
      )
    : [];

  return {
    porNombre: (porNombre.data as unknown as ColaBotellon[]) ?? [],
    porCedula: porCedula as unknown as ColaBotellon[],
    porCodigo: (porCodigo.data as unknown as ColaBotellon[]) ?? [],
  };
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
