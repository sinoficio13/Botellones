'use client';

import { useEffect, useMemo, useState } from 'react';
import { agrupar, type GrupoCliente } from '@/lib/utils/grupos';
import { ESTADOS_KANBAN, type Estado } from '@/lib/utils/estados';
import { getColaOperaciones, type ColaBotellon } from '@/lib/db/botellones';

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

/**
 * useColaOperaciones — client-grouped FIFO queue state (REQ-COS-16/17).
 * Fetches the queue once on mount (design D5: the hook owns the fetch so the
 * skeleton is real), partitions rows per estado and runs fase-1 `agrupar()`
 * per partition (D12: a client with bottles in two estados appears in two
 * tabs as two groups). Rows with NULL cliente_id are excluded pre-agrupar
 * (defense in depth; the server already filters). Selection state is NOT
 * hook-owned (D6) — the group card owns its marked chips.
 */
export function useColaOperaciones(): {
  cargando: boolean;
  porEstado: PorEstado;
  totales: { clientes: number; botellones: number };
} {
  const [cargando, setCargando] = useState(true);
  const [botellones, setBotellones] = useState<ColaBotellon[]>([]);

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

  return { cargando, porEstado, totales };
}