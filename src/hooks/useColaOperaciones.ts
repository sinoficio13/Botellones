'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { agrupar, type GrupoCliente } from '@/lib/utils/grupos';
import { ESTADOS_KANBAN, ESTADO_LABELS, type Estado } from '@/lib/utils/estados';
import { getColaOperaciones, type ColaBotellon } from '@/lib/db/botellones';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/components/operaciones/toast';

/** Estados de la cola = kanban sin `entregado` (que vive en circulación, fuera de la cola). */
export type EstadoOperativo = Exclude<Estado, 'entregado'>;

/**
 * Los 4 estados operativos de la cola — derivados de `ESTADOS_KANBAN` (única
 * fuente de verdad, review R2-001) en vez de una lista duplicada a mano.
 */
export const ESTADOS_OPERATIVOS: EstadoOperativo[] = ESTADOS_KANBAN.filter(
  (e): e is EstadoOperativo => e !== 'entregado'
);

/** `agrupar` output narrowed to queue rows (client-owned only). */
export type GrupoCola = Omit<GrupoCliente, 'botellones'> & { botellones: ColaBotellon[] };

export type PorEstado = Record<EstadoOperativo, GrupoCola[]>;

/** Destino de la acción forward (REQ-COS-19): delivery avanza a `entregado` (fuera de la cola). */
export type DestinoAccion = EstadoOperativo | 'entregado';

/**
 * Resultado de una acción: éxito con manija de deshacer, o error con mensaje.
 * El deshacer del deshacer es un no-op (la UI solo ofrece Deshacer sobre la
 * acción original; el toast que la portaba se descarta al activarla, R3-001).
 */
export type ResultadoAccion =
  | { ok: true; deshacer: () => Promise<ResultadoAccion> }
  | { ok: false; error: string };

/** Rows devueltas por el RPC (SETOF botellones, sin join de clientes). */
type FilaRpc = { id: string; estado: string | null; estado_desde: string };

/**
 * Reincorpora las filas devueltas por el RPC al estado local (D10): las que se
 * movieron se quitan y se vuelven a agregar con el estado/edad que devolvió la
 * DB, preservando el join `clientes` del snapshot (el RPC no lo trae).
 */
function aplicarFilas(
  prev: ColaBotellon[],
  movidos: Map<string, ColaBotellon>,
  filas: FilaRpc[]
): ColaBotellon[] {
  const sinMovidos = prev.filter((b) => !movidos.has(b.id));
  const reintegrados: ColaBotellon[] = [];
  for (const fila of filas) {
    const original = movidos.get(fila.id);
    if (original) {
      reintegrados.push({
        ...original,
        estado: fila.estado ?? original.estado,
        estado_desde: fila.estado_desde ?? original.estado_desde,
      });
    }
  }
  return [...sinMovidos, ...reintegrados];
}

/**
 * useColaOperaciones — client-grouped FIFO queue state (REQ-COS-16/17/19).
 * Fetches the queue once on mount (design D5), partitions rows per estado and
 * runs fase-1 `agrupar()` per partition (D12). Owns the optimistic move/undo
 * engine (REQ-COS-19, D10/D11):
 *
 *   mover(ids, destino) — snapshot {estadoAnterior, rows movidas},
 *   optimistic removal, success toast with Deshacer (4.5s), RPC
 *   mover_botellones(ids, destino); ok -> apply RETURNED rows (D10, no
 *   router.refresh()); error -> revert snapshot + red toast without undo.
 *
 *   deshacer — non-optimistic (D11): awaits any in-flight move (enVueloRef,
 *   serialize), then RPC mover_botellones(ids, estadoAnterior, true)
 *   (p_restaurar — R1-001: the DB restores the ORIGINAL estado_desde from its
 *   own pre-move snapshot; the client never sends timestamps); applies the
 *   returned rows so the group returns with its original age; error -> red
 *   toast, rows stay in the post-move estado.
 */
export function useColaOperaciones(): {
  cargando: boolean;
  porEstado: PorEstado;
  totales: { clientes: number; botellones: number };
  mover: (ids: string[], destino: DestinoAccion) => Promise<ResultadoAccion>;
} {
  const [cargando, setCargando] = useState(true);
  const [botellones, setBotellones] = useState<ColaBotellon[]>([]);
  const enVueloRef = useRef<PromiseLike<void> | null>(null);

  useEffect(() => {
    let activo = true;
    getColaOperaciones()
      .then((filas) => {
        if (activo) setBotellones(filas);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const porEstado = useMemo<PorEstado>(() => {
    const soloClientes = botellones.filter((b) => b.cliente_id !== null);
    const particion: PorEstado = { recibido: [], recarga: [], listo: [], delivery: [] };
    for (const estado of ESTADOS_OPERATIVOS) {
      particion[estado] = agrupar(soloClientes.filter((b) => b.estado === estado)) as GrupoCola[];
    }
    return particion;
  }, [botellones]);

  const totales = useMemo(() => {
    const conCliente = botellones.filter((b) => b.cliente_id !== null);
    return { clientes: new Set(conCliente.map((b) => b.cliente_id)).size, botellones: conCliente.length };
  }, [botellones]);

  /**
   * Deshacer no-optimista (D11): serializa esperando el mover en vuelo, llama
   * al RPC con el estado anterior + p_restaurar: true (la DB restaura el
   * estado_desde ORIGINAL desde su snapshot pre-movimiento, R1-001), y aplica
   * las filas devueltas (el grupo vuelve con su edad original). Ante error,
   * toast rojo y las filas quedan en el estado post-movimiento.
   */
  async function deshacerMovimiento(
    movidos: Map<string, ColaBotellon>,
    estadoAnterior: string,
    movimientoExitoso: () => boolean
  ): Promise<ResultadoAccion> {
    if (enVueloRef.current) await enVueloRef.current;
    if (!movimientoExitoso()) {
      return { ok: false, error: 'Movimiento fallido; nada que deshacer' };
    }
    const supabase = createClient();
    const { data, error } = await supabase.rpc('mover_botellones', {
      p_ids: [...movidos.keys()],
      p_estado: estadoAnterior,
      p_restaurar: true,
    });
    if (error) {
      showToast({ message: 'No se pudo deshacer. Reintentá.', tone: 'error' });
      return { ok: false, error: error.message };
    }
    setBotellones((prev) => aplicarFilas(prev, movidos, data ?? []));
    return { ok: true, deshacer: () => Promise.resolve({ ok: false, error: 'Nada que deshacer' }) };
  }

  async function mover(ids: string[], destino: DestinoAccion): Promise<ResultadoAccion> {
    // 1. Snapshot: estado anterior + rows movidas (REQ-COS-19 undo). El RPC
    //    restaura estado_desde desde su propia snapshot (R1-001): el cliente
    //    nunca envía timestamps; solo reconcilia con las filas devueltas.
    const movidos = new Map<string, ColaBotellon>();
    for (const b of botellones) {
      if (ids.includes(b.id)) movidos.set(b.id, b);
    }
    if (movidos.size === 0) return { ok: false, error: 'Botellones no encontrados' };
    const estadoAnterior = movidos.values().next().value!.estado;

    // 2. Optimistic removal: el grupo sale de la lista al instante.
    setBotellones((prev) => prev.filter((b) => !movidos.has(b.id)));

    // 3. Toast de éxito con Deshacer (antes de que resuelva el RPC).
    let movimientoExitoso = false;
    showToast({
      message: `${ids.length} ${ids.length === 1 ? 'botellón' : 'botellones'} a ${ESTADO_LABELS[destino]}`,
      actionLabel: 'Deshacer',
      tone: 'success',
      onAction: () => {
        void deshacerMovimiento(movidos, estadoAnterior, () => movimientoExitoso);
      },
    });

    // 4. RPC (2-arg call — p_restaurar queda para el undo).
    const supabase = createClient();
    const promesa = supabase.rpc('mover_botellones', { p_ids: ids, p_estado: destino });
    enVueloRef.current = promesa.then(
      () => undefined,
      () => undefined
    );
    const { data, error } = await promesa;

    // 5a. Error -> revertir snapshot + toast rojo sin undo (REQ-COS-19 S3).
    if (error) {
      setBotellones((prev) => [...prev, ...movidos.values()]);
      showToast({ message: 'No se pudo mover. Reintentá.', tone: 'error' });
      return { ok: false, error: error.message };
    }

    // 5b. Éxito -> aplicar filas devueltas (D10): el grupo aterriza en el
    //     destino con edad fresca (now() del trigger).
    movimientoExitoso = true;
    setBotellones((prev) => aplicarFilas(prev, movidos, data ?? []));
    return {
      ok: true,
      deshacer: () => deshacerMovimiento(movidos, estadoAnterior, () => movimientoExitoso),
    };
  }

  return { cargando, porEstado, totales, mover };
}