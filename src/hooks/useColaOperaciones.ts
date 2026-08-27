'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { agrupar, type GrupoCliente } from '@/lib/utils/grupos';
import { ESTADOS_KANBAN, ESTADO_LABELS, type Estado } from '@/lib/utils/estados';
import { getColaOperaciones, type ColaBotellon } from '@/lib/db/botellones';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeCola, type EventoRealtime } from '@/hooks/useRealtimeCola';
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

/** Duración del outline de card nueva (REQ-COS-27 D9): 2px --marca 1.2s → fade. */
export const ENTRANDO_MS = 1200;

/**
 * Gate de reordenamiento (REQ-COS-27, design D3) — puro y trivially testable.
 * Un cambio se encola (chip) si el operador está scrolleando O si el cambio
 * afecta el orden visible de la pestaña activa (el estado anterior o el nuevo
 * pertenecen al tab). En cualquier otro caso se aplica directo.
 */
export function decidirGate(
  estadoAnterior: string | undefined,
  estadoNuevo: string | undefined,
  tab: EstadoOperativo,
  scrolleando: boolean
): boolean {
  const afectaVisible = estadoAnterior === tab || estadoNuevo === tab;
  return scrolleando || afectaVisible;
}

/**
 * Merge un evento realtime de una fila YA conocida (ya en `botellones`, con su
 * join `clientes` preservado) contra la lista live (REQ-COS-27, D4). DELETE o
 * un UPDATE que saca la fila de la cola (entregado / cliente null) la elimina;
 * un UPDATE a un estado de cola la parchea por id conservando el join. La
 * cola es client-owned: las filas sin cliente (stock) no viven acá.
 */
export function mergeEvento(prev: ColaBotellon[], evento: EventoRealtime): ColaBotellon[] {
  if (evento.eventType === 'DELETE') return prev.filter((b) => b.id !== evento.id);

  const saleDeCola =
    evento.estadoNuevo === 'entregado' || evento.clienteIdNuevo === null;
  if (saleDeCola) return prev.filter((b) => b.id !== evento.id);

  return prev.map((b) =>
    b.id === evento.id
      ? {
          ...b,
          estado: evento.estadoNuevo ?? b.estado,
          cliente_id: evento.clienteIdNuevo ?? b.cliente_id,
        }
      : b
  );
}

/**
 * Diff de "card nueva" (D9): los cliente_id cuyo grupo aparece NUEVO en la
 * pestaña activa (`tab`) entre `anterior` y `siguiente` reciben el outline de
 * entrada. Compara por presencia de grupo en la lista visible del tab activo —
 * una botella que entra al estado activo de un cliente que ya estaba ahí no
 * re-anima; solo las cards realmente nuevas del tab lo hacen.
 */
export function calcularEntrando(
  anterior: ColaBotellon[],
  siguiente: ColaBotellon[],
  tab: EstadoOperativo
): Set<string> {
  const enAnterior = new Set(
    anterior.filter((b) => b.estado === tab && b.cliente_id !== null).map((b) => b.cliente_id) as string[]
  );
  const entrantes = new Set<string>();
  for (const b of siguiente) {
    if (b.estado === tab && b.cliente_id !== null && !enAnterior.has(b.cliente_id)) {
      entrantes.add(b.cliente_id);
    }
  }
  return entrantes;
}

/**
 * ¿Requiere un refetch one-shot? (D5) El payload realtime no trae el join
 * `clientes`; una fila desconocida (INSERT, o UPDATE que entra a la cola desde
 * entregado/stock) no puede reconstruirse parcial → refetch único de la cola.
 * Las filas conocidas se mergean por id preservando su join (sin refetch).
 */
export function necesitaRefetch(evento: EventoRealtime, conocido: boolean): boolean {
  if (conocido) return false;
  if (evento.eventType === 'DELETE') return false;
  if (evento.eventType === 'INSERT') return evento.clienteIdNuevo !== null;
  // UPDATE de una fila desconocida: solo interesa si entra a la cola (cliente no nulo, estado de cola).
  return evento.clienteIdNuevo !== null && evento.estadoNuevo !== 'entregado';
}

/** Agrupa filas por estado operativo (única fuente: `agrupar`, fase-1). */
function agruparPorEstado(filas: ColaBotellon[]): PorEstado {
  const soloClientes = filas.filter((b) => b.cliente_id !== null);
  const particion: PorEstado = { recibido: [], recarga: [], listo: [], delivery: [] };
  for (const estado of ESTADOS_OPERATIVOS) {
    particion[estado] = agrupar(soloClientes.filter((b) => b.estado === estado)) as GrupoCola[];
  }
  return particion;
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
export function useColaOperaciones(opts: { tab?: EstadoOperativo } = {}): {
  cargando: boolean;
  error: string | null;
  porEstado: PorEstado;
  porEstadoVisibles: PorEstado;
  totales: { clientes: number; botellones: number };
  mover: (ids: string[], destino: DestinoAccion) => Promise<ResultadoAccion>;
  reintentar: () => void;
  pendientes: number;
  aplicarPendientes: () => void;
  entrando: Set<string>;
  setScrolleando: (b: boolean) => void;
} {
  // D3: tab activa del shell (mobile; tablet/kanban heredan el default). Solo
  // el shell es consumidor — es seguro que la firma tome `{ tab }`.
  const tab = opts.tab ?? 'recibido';
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botellones, setBotellones] = useState<ColaBotellon[]>([]);
  // Two-layer row model (D4): `botellones` (live) siempre se parchea; `visibles`
  // (snapshot) congela el render de la lista activa cuando hay un cambio encolado.
  const [visibles, setVisibles] = useState<ColaBotellon[] | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [entrando, setEntrando] = useState<Set<string>>(new Set());
  const [scrolleando, setScrolleando] = useState(false);
  const [intento, setIntento] = useState(0);
  const enVueloRef = useRef<PromiseLike<void> | null>(null);
  // Echo suppression (D6): ids que este cliente está moviendo (optimistic) se
  // saltean en el handler realtime para evitar chips fantasma / dobles patches.
  const idsEnMovimientoRef = useRef<Set<string>>(new Set());
  const tabRef = useRef(tab);
  const scrolleandoRef = useRef(scrolleando);
  const estadoRef = useRef({ botellones, visibles, pendientes, entrando });
  const timerEntrandoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  useEffect(() => {
    scrolleandoRef.current = scrolleando;
  }, [scrolleando]);
  useEffect(() => {
    estadoRef.current = { botellones, visibles, pendientes, entrando };
  }, [botellones, visibles, pendientes, entrando]);

  /** Encola el diff de entrada y agenda el borrado tras 1.2s (D9). Solo usa setters estables + ref de timer. */
  const marcarEntrando = useCallback((nuevos: Set<string>) => {
    if (nuevos.size === 0) return;
    setEntrando((prev) => new Set([...prev, ...nuevos]));
    if (timerEntrandoRef.current) clearTimeout(timerEntrandoRef.current);
    timerEntrandoRef.current = setTimeout(() => setEntrando(new Set()), ENTRANDO_MS);
  }, []);

  /**
   * Refetch one-shot (D5): vuelve a pedir la cola para incorporar filas con
   * join desconocido (INSERT / entrada a la cola desde entregado/stock). Difiere
   * `entrando` contra la lista previa y libera cualquier snapshot congelado.
   */
  const refetchear = useCallback(() => {
    const previo = estadoRef.current.botellones;
    getColaOperaciones()
      .then((filas) => {
        if (filas === null) return;
        marcarEntrando(calcularEntrando(previo, filas, tabRef.current));
        setBotellones(filas);
        setVisibles(null);
      })
      .catch(() => {
        /* degradación silenciosa: se mantiene el último estado renderizado */
      });
  }, [marcarEntrando]);

  /** Maneja un evento realtime normalizado (REQ-COS-27, D4/D5/D6). */
  const manejarEvento = useCallback(
    (evento: EventoRealtime) => {
      const id = evento.id;
      if (!id) return;
      // Echo suppression: skip eventos de los ids que este cliente mueve.
      if (idsEnMovimientoRef.current.has(id)) return;

      const actual = estadoRef.current;
      const conocido = actual.botellones.some((b) => b.id === id);
      if (necesitaRefetch(evento, conocido)) {
        refetchear();
        return;
      }
      if (!conocido) return; // stock / fila irrelevante (no vive en la cola)

      const anterior = actual.botellones.find((b) => b.id === id)!.estado;
      const siguiente = mergeEvento(actual.botellones, evento);
      const gated = decidirGate(anterior, evento.estadoNuevo, tabRef.current, scrolleandoRef.current);

      if (gated) {
        // Congela la lista visible pre-parche; los contadores (derivados de
        // `botellones`) siguen live. El chip aplica al tocar.
        setVisibles(actual.botellones);
        setPendientes((p) => p + 1);
      } else {
        setVisibles(null);
        marcarEntrando(calcularEntrando(actual.botellones, siguiente, tabRef.current));
      }
      setBotellones(siguiente);
    },
    [refetchear, marcarEntrando]
  );

  useRealtimeCola(manejarEvento);

  useEffect(() => {
    let activo = true;
    // R4-004: getColaOperaciones resolves null on failure (distinguishable from
    // a genuine empty []); a transport rejection is caught here too. Both map
    // to the fetch-error state; the shell renders an error empty-state + retry.
    getColaOperaciones()
      .then((filas) => {
        if (!activo) return;
        if (filas === null) {
          setError('No se pudo cargar la cola. Reintentá.');
          setBotellones([]);
        } else {
          setBotellones(filas);
        }
      })
      .catch(() => {
        if (activo) {
          setError('No se pudo cargar la cola. Reintentá.');
          setBotellones([]);
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [intento]);

  /**
   * Retry (R4-004): resets the loading/error flags and bumps `intento` so the
   * effect refetches. State resets live in the handler (not the effect) —
   * react-hooks/set-state-in-effect safe.
   */
  function reintentar() {
    setCargando(true);
    setError(null);
    setIntento((n) => n + 1);
  }

  // porEstado (LIVE) alimenta contadores de tabs + barra de contexto: siempre
  // deriva de `botellones`, incluso con un cambio encolado (MOD-17 S2).
  const porEstado = useMemo<PorEstado>(() => agruparPorEstado(botellones), [botellones]);

  // porEstadoVisibles (GATED): la lista que se RENDERIZA. Cuando hay un cambio
  // encolado (`visibles !== null`) usa el snapshot congelado para que la lista
  // activa no se reordene bajo el dedo (REQ-COS-27, D4); si no, = live.
  const porEstadoVisibles = useMemo<PorEstado>(
    () => agruparPorEstado(visibles ?? botellones),
    [botellones, visibles]
  );

  // D11 (carried): `totales` filtra ESTADOS_KANBAN (mismo predicado que
  // getColaOperaciones) — las filas entregadas ya no se cuentan en la cola
  // (mover las re-agrega vía aplicarFilas con estado `entregado`).
  const totales = useMemo(() => {
    const enCola = botellones.filter(
      (b) => b.cliente_id !== null && ESTADOS_KANBAN.includes(b.estado as Estado)
    );
    return { clientes: new Set(enCola.map((b) => b.cliente_id)).size, botellones: enCola.length };
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
    // D6 echo suppression: el RPC de restauración también emite realtime — los
    // ids se saltean hasta que settle para evitar chips fantasma del propio undo.
    const idsUndo = [...movidos.keys()];
    for (const id of idsUndo) idsEnMovimientoRef.current.add(id);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('mover_botellones', {
      p_ids: idsUndo,
      p_estado: estadoAnterior,
      p_restaurar: true,
    });
    if (error) {
      for (const id of idsUndo) idsEnMovimientoRef.current.delete(id);
      showToast({ message: 'No se pudo deshacer. Reintentá.', tone: 'error' });
      return { ok: false, error: error.message };
    }
    setBotellones((prev) => aplicarFilas(prev, movidos, data ?? []));
    for (const id of idsUndo) idsEnMovimientoRef.current.delete(id);
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

    // D6 echo suppression: registra los ids en vuelo ANTES del RPC; el handler
    // realtime los saltea hasta que el RPC settle (evita chips fantasma/dobles
    // patches del eco de este propio movimiento).
    const idsMovidos = [...movidos.keys()];
    for (const id of idsMovidos) idsEnMovimientoRef.current.add(id);

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
    // D12 (carried): a TRANSPORT rejection (RPC promise rejects — network down)
    // must NOT throw out of mover() and escape ResultadoAccion; the try/catch
    // converts it to the same error path as a resolved {data, error} failure
    // (revert + red toast + {ok:false}).
    let data: FilaRpc[] | null;
    let error: { message: string } | null;
    try {
      const respuesta = await promesa;
      data = respuesta.data;
      error = respuesta.error;
    } catch (err) {
      for (const id of idsMovidos) idsEnMovimientoRef.current.delete(id);
      setBotellones((prev) => [...prev, ...movidos.values()]);
      showToast({ message: 'No se pudo mover. Reintentá.', tone: 'error' });
      return { ok: false, error: err instanceof Error ? err.message : 'Error de red' };
    }

    // 5a. Error -> revertir snapshot + toast rojo sin undo (REQ-COS-19 S3).
    if (error) {
      for (const id of idsMovidos) idsEnMovimientoRef.current.delete(id);
      setBotellones((prev) => [...prev, ...movidos.values()]);
      showToast({ message: 'No se pudo mover. Reintentá.', tone: 'error' });
      return { ok: false, error: error.message };
    }

    // 5b. Éxito -> aplicar filas devueltas (D10): el grupo aterriza en el
    //     destino con edad fresca (now() del trigger).
    movimientoExitoso = true;
    for (const id of idsMovidos) idsEnMovimientoRef.current.delete(id);
    setBotellones((prev) => aplicarFilas(prev, movidos, data ?? []));
    return {
      ok: true,
      deshacer: () => deshacerMovimiento(movidos, estadoAnterior, () => movimientoExitoso),
    };
  }

  /**
   * Aplica los cambios encolados (chip tap, REQ-COS-27 S3): libera el snapshot
   * congelado (visibles = null) y difiere `entrando` contra el estado live para
   * animar las cards nuevas. `botellones` ya estaba live — no re-mergea.
   */
  function aplicarPendientes() {
    const actual = estadoRef.current;
    const base = actual.visibles ?? actual.botellones;
    marcarEntrando(calcularEntrando(base, actual.botellones, tabRef.current));
    setVisibles(null);
    setPendientes(0);
  }

  return {
    cargando,
    error,
    porEstado,
    porEstadoVisibles,
    totales,
    mover,
    reintentar,
    pendientes,
    aplicarPendientes,
    entrando,
    setScrolleando,
  };
}