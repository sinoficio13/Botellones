'use server';

import { revalidatePath } from 'next/cache';

import {
  procesarLoyaltyConCompensacion,
  REALIZADA_POR_PLACEHOLDER,
} from '@/lib/db/loyalty';
import { OPERACIONES, type Estado, type OperacionId } from '@/lib/utils/estados';

// ── Types ──

export type CargaItemResult =
  | { botellonId: string; codigo: string; ok: true; recargaId?: string; numeroRegistro?: string }
  | { botellonId: string; codigo: string; ok: false; reason: 'sin-cliente' | `estado-${string}` | 'error' };

export type CargaState = {
  success: boolean;
  items: CargaItemResult[];
  premios?: { nivel: number; id: string }[];
  loyaltyWarning?: string;
  error?: string;
};

type BotellonRow = { id: string; codigo: string; estado: string; cliente_id: string | null };

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

/** Normalize a user-supplied hora to HH:MM:SS (existing rows use toTimeString slice 8). */
function normalizarHora(hora: string): string {
  const trimmed = hora.trim();
  return /^\d{1,2}:\d{2}$/.test(trimmed) ? `${trimmed}:00` : trimmed;
}

/** Strict HH:MM or HH:MM:SS validation with sane ranges (0-23 h, 0-59 min/sec). */
function esHoraValida(hora: string): boolean {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hora.trim());
  if (!match) return false;
  const h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const sec = match[3] !== undefined ? parseInt(match[3], 10) : 0;
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 && sec >= 0 && sec <= 59;
}

/**
 * Per-item rejection, scoped to the operation: `sin-cliente` only when the op
 * requires a client (recarga), `estado-<estado>` when the current estado is
 * not one of the op's source estados (mirrors the `.in('estado', sources)`
 * guard), `error` for unknown ids / fallback.
 */
function rejectItem(id: string, row: BotellonRow | undefined, operacion: OperacionId): CargaItemResult {
  if (!row) return { botellonId: id, codigo: id, ok: false, reason: 'error' };
  const op = OPERACIONES[operacion];
  if (op.requiresCliente && !row.cliente_id)
    return { botellonId: id, codigo: row.codigo, ok: false, reason: 'sin-cliente' };
  if (!op.sources.includes(row.estado as Estado))
    return { botellonId: id, codigo: row.codigo, ok: false, reason: `estado-${row.estado}` };
  return { botellonId: id, codigo: row.codigo, ok: false, reason: 'error' };
}

// ── Batch action ──

/**
 * Confirm a batch of scanned botellones for ONE terminal operation
 * (`recibir` | `recargar` | `listo`), driven by the OPERACIONES state machine.
 *
 * - Re-derives cliente_id per botellon server-side (never trusts the client).
 * - Dedupes the submitted botellonIds; per-item reasons are scoped to the op:
 *   `sin-cliente` only when the op requires a client, `estado-<estado>` when
 *   the item's estado is outside the op's source estados.
 * - The recarga branch (createsRec): N sequential REC numbers from ONE max+1
 *   read, single array insert, one `.in('estado', sources)` update
 *   entregado/recibido → recarga, loyalty once per distinct client plus
 *   milestone-crossing compensation, and a best-effort compensating delete of
 *   inserted rows when the estado update fails.
 * - Pure branches (recibir/listo): a single `.in('estado', sources)` estado
 *   update with no `recargas` write and no loyalty.
 */
export async function registrarOperacion(input: {
  botellonIds: string[];
  operacion: OperacionId;
  fecha: string;
  hora: string;
}): Promise<CargaState> {
  const { botellonIds, operacion, fecha, hora } = input;
  const op = OPERACIONES[operacion];

  if (!op) {
    return { success: false, items: [], error: 'Operación inválida' };
  }

  const uniqueBotellonIds = [...new Set(botellonIds)];

  if (uniqueBotellonIds.length === 0) {
    return { success: false, items: [], error: 'No hay botellones en la carga' };
  }
  if (!fecha || !hora) {
    return { success: false, items: [], error: 'Fecha y hora requeridas' };
  }
  if (!esHoraValida(hora)) {
    return { success: false, items: [], error: 'Hora inválida: use formato HH:MM o HH:MM:SS' };
  }

  const horaNormalizada = normalizarHora(hora);
  // dev placeholder — will be replaced with auth.uid() after EPIC-1 auth hardening
  const realizada_por = REALIZADA_POR_PLACEHOLDER;

  try {
    const supabase = await getSupabase();

    // 1. Re-derive cliente_id server-side for every submitted botellon
    const { data: rows, error: selectError } = await supabase
      .from('botellones')
      .select('id, codigo, estado, cliente_id')
      .in('id', uniqueBotellonIds);

    if (selectError) {
      return {
        success: false,
        items: uniqueBotellonIds.map((id) => rejectItem(id, undefined, operacion)),
        error: selectError.message,
      };
    }

    const rowsList = (rows || []) as BotellonRow[];
    const byId = new Map(rowsList.map((r) => [r.id, r]));
    // Op-scoped validity: client required only when the op needs it, and the
    // estado must be one of the op's declared sources.
    const valid = rowsList.filter(
      (r): r is BotellonRow & { cliente_id: string } =>
        (!op.requiresCliente || Boolean(r.cliente_id)) && op.sources.includes(r.estado as Estado)
    );

    if (valid.length === 0) {
      // Zero writes — surface the per-item rejection reasons
      return {
        success: false,
        items: uniqueBotellonIds.map((id) => rejectItem(id, byId.get(id), operacion)),
      };
    }

    // ── Pure operations (recibir / listo): estado update only ──
    if (!op.createsRec) {
      const validIds = valid.map((r) => r.id);
      const { error: updateError } = await supabase
        .from('botellones')
        .update({ estado: op.target })
        .in('id', validIds)
        .in('estado', op.sources);

      if (updateError) {
        return {
          success: false,
          items: uniqueBotellonIds.map((id) => rejectItem(id, byId.get(id), operacion)),
          error: updateError.message,
        };
      }

      revalidatePath('/clientes');
      revalidatePath('/recargas');
      revalidatePath('/botellones');

      const items: CargaItemResult[] = uniqueBotellonIds.map((id) => {
        const row = byId.get(id);
        if (
          !row ||
          (op.requiresCliente && !row.cliente_id) ||
          !op.sources.includes(row.estado as Estado)
        ) {
          return rejectItem(id, row, operacion);
        }
        return { botellonId: id, codigo: row.codigo, ok: true };
      });

      return { success: true, items };
    }

    // ── Recarga branch: REC + insert + loyalty + compensation ──

    // Recargas added in THIS batch per distinct client (used for milestone-crossing)
    const addedByClient = new Map<string, number>();
    for (const r of valid) {
      addedByClient.set(r.cliente_id, (addedByClient.get(r.cliente_id) ?? 0) + 1);
    }

    // 2. N sequential REC numbers from ONE max+1 read.
    //    Order by created_at DESC then id DESC: batch rows share a created_at,
    //    so id (unique) deterministically breaks the tie.
    const { data: lastRecarga } = await supabase
      .from('recargas')
      .select('numero_registro')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastRecarga?.numero_registro
      ? parseInt(String(lastRecarga.numero_registro).replace('REC-', ''), 10)
      : 0;

    const rowsToInsert = valid.map((row, i) => ({
      numero_registro: `REC-${String(lastNum + 1 + i).padStart(6, '0')}`,
      cliente_id: row.cliente_id!,
      botellon_id: row.id,
      fecha,
      hora: horaNormalizada,
      realizada_por,
    }));

    // 3. Single array insert
    const { data: inserted, error: insertError } = await supabase
      .from('recargas')
      .insert(rowsToInsert)
      .select('id, botellon_id');

    if (insertError || !inserted || inserted.length === 0) {
      return {
        success: false,
        items: uniqueBotellonIds.map((id) => rejectItem(id, byId.get(id), operacion)),
        error: insertError?.message ?? 'No se pudo insertar la carga',
      };
    }

    // 4. Single .in() estado update, guarded by the recarga sources
    const validIds = valid.map((r) => r.id);
    const { error: updateError } = await supabase
      .from('botellones')
      .update({ estado: 'recarga' })
      .in('id', validIds)
      .in('estado', op.sources);

    if (updateError) {
      // 5. Compensating delete of the inserted rows (best-effort).
      //    Log any delete failure so orphans are not silently left behind.
      const { error: deleteError } = await supabase
        .from('recargas')
        .delete()
        .in('id', inserted.map((r) => r.id));
      if (deleteError) {
        console.error('Compensating delete failed:', deleteError);
      }
      return {
        success: false,
        items: uniqueBotellonIds.map((id) => rejectItem(id, byId.get(id), operacion)),
        error: updateError.message,
      };
    }

    // 6. Loyalty + milestone-crossing compensation once per distinct client.
    //    A loyalty failure must NOT fail the batch — the recargas are already
    //    committed. Log it and surface a loyaltyWarning instead.
    const distinctClientIds = [...new Set(valid.map((r) => r.cliente_id))];

    const { premios, loyaltyWarning } = await procesarLoyaltyConCompensacion(
      distinctClientIds,
      addedByClient,
      realizada_por
    );

    revalidatePath('/clientes');
    revalidatePath('/recargas');
    revalidatePath('/botellones');

    const recargaIdByBotellon = new Map(inserted.map((r) => [r.botellon_id, r.id]));
    const numeroByBotellon = new Map(rowsToInsert.map((r) => [r.botellon_id, r.numero_registro]));

    const items: CargaItemResult[] = uniqueBotellonIds.map((id) => {
      const row = byId.get(id);
      if (
        !row ||
        (op.requiresCliente && !row.cliente_id) ||
        !op.sources.includes(row.estado as Estado)
      ) {
        return rejectItem(id, row, operacion);
      }
      const recargaId = recargaIdByBotellon.get(id);
      if (!recargaId) return rejectItem(id, row, operacion);
      return {
        botellonId: id,
        codigo: row.codigo,
        ok: true,
        recargaId,
        numeroRegistro: numeroByBotellon.get(id)!,
      };
    });

    const state: CargaState = { success: true, items };
    if (premios.length > 0) state.premios = premios;
    if (loyaltyWarning) state.loyaltyWarning = loyaltyWarning;
    return state;
  } catch (err: unknown) {
    return {
      success: false,
      items: uniqueBotellonIds.map((id) => rejectItem(id, undefined, operacion)),
      error: err instanceof Error ? err.message : 'Error al registrar carga',
    };
  }
}
