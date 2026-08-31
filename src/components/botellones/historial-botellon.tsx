'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ESTADOS, ESTADO_LABELS, ESTADO_DOT_COLORS } from '@/lib/utils/estados';
import { formatHora12Str, formatFechaLocal, formatFechaZona, formatHoraZona } from '@/lib/utils/hora';

/** Deterministic operation label for a transition (the batch ops + kanban moves). */
export const OPERACION_POR_TRANSICION: Record<string, string> = {
  'entregado→recibido': 'Recibir',
  'recibido→recarga': 'Recargar',
  'recarga→listo': 'Listo',
  'recarga→delivery': 'En delivery',
  'delivery→entregado': 'Entregar',
  'listo→delivery': 'En delivery',
  'listo→entregado': 'Entregar',
};

type EventoHistorial = {
  id: string;
  /** 'YYYY-MM-DD' in the business zone. */
  fechaStr: string;
  /** 'HH:MM:SS' in the business zone. */
  horaStr: string;
  de: string;
  a: string;
};

const PAGE_SIZE = 20;

/**
 * HistorialBotellon — server-paginated bottle state history (good DB
 * practices): COUNT + RANGE per page instead of loading everything, scoped to
 * `movimientos` so the timeline never becomes an endless scroll.
 */
export function HistorialBotellon({ botellonId }: { botellonId: string }) {
  const [eventos, setEventos] = useState<EventoHistorial[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const cargar = useCallback(
    async (p: number, reemplazar = false) => {
      setLoading(true);
      const supabase = createClient();
      const from = (p - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('movimientos')
        .select('id, estado_previo, estado_nuevo, created_at', { count: 'exact' })
        .eq('botellon_id', botellonId);
      if (desde) query = query.gte('created_at', desde);
      // created_at is timestamptz: lte with a bare date would exclude the
      // whole `hasta` day, so cap it at end-of-day for an inclusive filter.
      if (hasta) query = query.lte('created_at', `${hasta}T23:59:59`);
      if (filtroEstado) query = query.eq('estado_nuevo', filtroEstado);
      const { data, count: c } = await query
        .order('created_at', { ascending: false })
        .range(from, to);
      const filas = ((data as unknown as { id: string; estado_previo: string | null; estado_nuevo: string | null; created_at: string }[]) || []).map(
        (m) => {
          const d = new Date(m.created_at);
          return {
            id: m.id,
            fechaStr: formatFechaZona(d),
            horaStr: formatHoraZona(d),
            de: m.estado_previo ?? '',
            a: m.estado_nuevo ?? '',
          };
        }
      );
      const count = c ?? 0;

      // `reemplazar` lets the realtime refresh swap the CURRENT page instead of
      // appending to it (append would duplicate rows/keys).
      setEventos((prev) => (p === 1 || reemplazar ? filas : [...prev, ...filas]));
      setTotal(count);
      setPage(p);
      setLoading(false);
    },
    [botellonId, desde, hasta, filtroEstado]
  );

  useEffect(() => {
    void cargar(1);
  }, [cargar]);

  // Latest-value refs so the realtime channel callback (subscribed once) always
  // sees the current page/cargar and whether anything has loaded.
  const pageRef = useRef(page);
  const cargarRef = useRef(cargar);
  const hayDatosRef = useRef(eventos.length > 0);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    cargarRef.current = cargar;
  }, [cargar]);
  useEffect(() => {
    hayDatosRef.current = eventos.length > 0;
  }, [eventos]);

  // Realtime insert refresh (EstadoEnVivo pattern): a new movimiento row for
  // this botellon reloads the current page (or page 1 when empty). Degrades
  // silently on CHANNEL_ERROR/TIMED_OUT; channel removed on unmount.
  useEffect(() => {
    const supabase = createClient();
    const recargar = () => {
      const p = hayDatosRef.current ? pageRef.current : 1;
      void cargarRef.current(p, true);
    };
    const channel = supabase
      .channel(`historial-botellon-${botellonId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'movimientos', filter: `botellon_id=eq.${botellonId}` },
        recargar
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Silent degradation: keep the last rendered page.
          console.warn('Realtime historial channel error:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [botellonId]);

  const hayMas = eventos.length < total;
  const hayFiltro = desde !== '' || hasta !== '' || filtroEstado !== '';

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Card header: title + filters */}
      <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Historial</h2>

        {/* Date range filter — resets to page 1 on any change. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Desde
            <input
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Hasta
            <input
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Estado
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {ESTADO_LABELS[estado]}
                </option>
              ))}
            </select>
          </label>
          {hayFiltro ? (
            <button
              type="button"
              onClick={() => {
                setDesde('');
                setHasta('');
                setFiltroEstado('');
              }}
              className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-100 text-left text-[10px] uppercase tracking-[0.08em] text-zinc-400 dark:border-zinc-800">
            <th className="px-5 py-2 font-medium">Fecha</th>
            <th className="px-4 py-2 font-medium">Operación</th>
            <th className="px-4 py-2 font-medium">Cambio</th>
          </tr>
        </thead>
        {loading && eventos.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={3} className="px-5 py-4 text-center text-zinc-400">Cargando…</td>
            </tr>
          </tbody>
        ) : eventos.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={3} className="px-5 py-4 text-center text-zinc-400">No hay registros.</td>
            </tr>
          </tbody>
        ) : (
          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {eventos.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-5 py-2 text-zinc-500">
                  {formatFechaLocal(e.fechaStr)} · {formatHora12Str(e.horaStr)}
                </td>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                  {OPERACION_POR_TRANSICION[`${e.de}→${e.a}`] ?? 'Cambio de estado'}
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                  <span
                    aria-hidden
                    className={`mr-1.5 inline-block size-2 rounded-full align-middle ${
                      ESTADO_DOT_COLORS[e.a] || 'bg-zinc-300'
                    }`}
                  />
                  {`${(ESTADO_LABELS[e.de] ?? e.de) || '—'} → ${ESTADO_LABELS[e.a] ?? e.a}`}
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>

      {hayMas ? (
        <div className="border-t border-zinc-100 px-5 py-2.5 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => void cargar(page + 1)}
            disabled={loading}
            className="w-full rounded-md border border-zinc-200 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {loading ? 'Cargando…' : `Cargar más (${eventos.length} de ${total})`}
          </button>
        </div>
      ) : null}
    </div>
  );
}