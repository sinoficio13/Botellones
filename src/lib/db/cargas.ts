'use server';

import { revalidatePath } from 'next/cache';

import {
  procesarLoyalty,
  REALIZADA_POR_PLACEHOLDER,
  type PremioGenerado,
} from '@/lib/db/loyalty';

// ── Types ──

export type CargaItemResult =
  | { botellonId: string; codigo: string; ok: true; recargaId: string; numeroRegistro: string }
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

/** Per-item rejection: same reason resolution used on every failure path. */
function rejectItem(id: string, row: BotellonRow | undefined): CargaItemResult {
  if (!row) return { botellonId: id, codigo: id, ok: false, reason: 'error' };
  if (!row.cliente_id) return { botellonId: id, codigo: row.codigo, ok: false, reason: 'sin-cliente' };
  if (row.estado !== 'entregado')
    return { botellonId: id, codigo: row.codigo, ok: false, reason: `estado-${row.estado}` };
  return { botellonId: id, codigo: row.codigo, ok: false, reason: 'error' };
}

// ── Batch action ──

/**
 * Confirm a batch of scanned botellones as ONE uniform recarga.
 *
 * - Re-derives cliente_id per botellon server-side (never trusts the client).
 * - Dedupes the submitted botellonIds and rejects clientless / non-entregado
 *   items with per-item reasons.
 * - Computes N sequential REC numbers from ONE max+1 read, ordered
 *   deterministically (created_at DESC, id DESC) so batch rows sharing a
 *   created_at never tie-break arbitrarily.
 * - Inserts all rows in a single array insert (shared fecha/hora, placeholder actor).
 * - Updates entregado → recarga in one `.in()` statement.
 * - Runs loyalty once per distinct client; a loyalty failure is logged and the
 *   batch stays success:true because the data IS committed.
 * - Compensates for milestone overshoot: if the batch pushes a client past a
 *   multiple of 100 without landing exactly on it, the crossed premio is
 *   inserted idempotently (unique index uq_premios_cliente_nivel guards).
 * - On partial failure, compensates with a best-effort delete of inserted rows.
 */
export async function registrarCarga(input: {
  botellonIds: string[];
  fecha: string;
  hora: string;
}): Promise<CargaState> {
  const { botellonIds, fecha, hora } = input;
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
        items: uniqueBotellonIds.map((id) => rejectItem(id, undefined)),
        error: selectError.message,
      };
    }

    const rowsList = (rows || []) as BotellonRow[];
    const byId = new Map(rowsList.map((r) => [r.id, r]));
    const valid = rowsList.filter(
      (r): r is BotellonRow & { cliente_id: string } => Boolean(r.cliente_id) && r.estado === 'entregado'
    );

    if (valid.length === 0) {
      // Zero writes — surface the per-item rejection reasons
      return { success: false, items: uniqueBotellonIds.map((id) => rejectItem(id, byId.get(id))) };
    }

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
        items: uniqueBotellonIds.map((id) => rejectItem(id, byId.get(id))),
        error: insertError?.message ?? 'No se pudo insertar la carga',
      };
    }

    // 4. Single .in() estado update: entregado → recarga
    const validIds = valid.map((r) => r.id);
    const { error: updateError } = await supabase
      .from('botellones')
      .update({ estado: 'recarga' })
      .in('id', validIds)
      .eq('estado', 'entregado');

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
        items: uniqueBotellonIds.map((id) => rejectItem(id, byId.get(id))),
        error: updateError.message,
      };
    }

    // 6. Loyalty once per distinct client.
    //    A loyalty failure must NOT fail the batch — the recargas are already
    //    committed. Log it and surface a loyaltyWarning instead.
    const distinctClientIds = [...new Set(valid.map((r) => r.cliente_id))];

    let premios: PremioGenerado[] = [];
    let loyaltyWarning: string | undefined;

    try {
      const loyalty = await procesarLoyalty(distinctClientIds, realizada_por);
      premios = loyalty.premios;
    } catch (err) {
      loyaltyWarning = err instanceof Error ? err.message : 'Error al procesar fidelidad';
      console.error('Loyalty processing failed after batch commit:', err);
    }

    // 7. Milestone-crossing compensation.
    //    procesarLoyalty only fires when the post-batch total lands EXACTLY on
    //    a multiple of 100. A batch that OVERSHOOTS a milestone (e.g. 98 + 5 =
    //    103) would otherwise skip nivel-100. Detect every multiple of 100
    //    crossed by this batch within (before, after] and insert it
    //    idempotently (unique index uq_premios_cliente_nivel guards dupes).
    try {
      for (const clienteId of distinctClientIds) {
        const added = addedByClient.get(clienteId) ?? 0;
        const { count } = await supabase
          .from('recargas')
          .select('*', { count: 'exact', head: true })
          .eq('cliente_id', clienteId);
        const postCount = count ?? 0;
        const beforeCount = postCount - added;

        for (let nivel = 100; nivel <= postCount; nivel += 100) {
          if (nivel <= beforeCount) continue;
          const { data: premioData, error: premioError } = await supabase
            .from('premios')
            .insert({
              cliente_id: clienteId,
              nivel_recargas: nivel,
              estado: 'pendiente',
              fecha_alcanzado: new Date().toISOString().slice(0, 10),
            })
            .select('id')
            .single();

          if (premioError) {
            if (premioError.code !== '23505') {
              console.error('Error inserting crossed premio:', premioError);
            }
          } else if (premioData) {
            premios.push({ nivel, id: premioData.id });
          }
        }
      }
    } catch (err) {
      if (!loyaltyWarning) {
        loyaltyWarning = err instanceof Error ? err.message : 'Error al verificar niveles';
      }
      console.error('Milestone compensation failed after batch commit:', err);
    }

    revalidatePath('/clientes');
    revalidatePath('/recargas');
    revalidatePath('/botellones');

    const recargaIdByBotellon = new Map(inserted.map((r) => [r.botellon_id, r.id]));
    const numeroByBotellon = new Map(rowsToInsert.map((r) => [r.botellon_id, r.numero_registro]));

    const items: CargaItemResult[] = uniqueBotellonIds.map((id) => {
      const row = byId.get(id);
      if (!row || !row.cliente_id || row.estado !== 'entregado') {
        return rejectItem(id, row);
      }
      const recargaId = recargaIdByBotellon.get(id);
      if (!recargaId) return rejectItem(id, row);
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
      items: uniqueBotellonIds.map((id) => rejectItem(id, undefined)),
      error: err instanceof Error ? err.message : 'Error al registrar carga',
    };
  }
}
