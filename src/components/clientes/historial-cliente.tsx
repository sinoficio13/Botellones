'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { ESTADOS, ESTADO_LABELS, ESTADO_DOT_COLORS } from '@/lib/utils/estados';
import { OPERACION_POR_TRANSICION } from '@/components/botellones/historial-botellon';
import { formatHora12Str, formatFechaLocal, formatFechaZona, formatHoraZona } from '@/lib/utils/hora';

type BotellonChip = { id: string; codigo: string; estado: string };

type EventoHistorial = {
  id: string;
  /** 'YYYY-MM-DD' in the business zone. */
  fechaStr: string;
  /** 'HH:MM:SS' in the business zone. */
  horaStr: string;
  de: string;
  a: string;
  /** Bottle badge — the useful identifier of the botellon that moved. */
  codigo: string;
};

type MovimientoFila = {
  id: string;
  estado_previo: string | null;
  estado_nuevo: string | null;
  created_at: string;
  botellones: { codigo: string } | null;
};

const PAGE_SIZE = 20;

/**
 * HistorialCliente — client-wide estatal history (movimientos) across all of
 * the client's botellones, rendered with the same table + filters + pagination
 * as HistorialBotellon. Per-botellon chips scope the feed; movimientos is
 * scoped by the client's botellon ids because it has no cliente_id column.
 */
export function HistorialCliente({ clienteId }: { clienteId: string }) {
  const [botellones, setBotellones] = useState<BotellonChip[]>([]);
  const [botellonId, setBotellonId] = useState<string | null>(null);
  const [eventos, setEventos] = useState<EventoHistorial[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Bottle chips: the client's botellones drive both the filter and the
  // "Estados" query (movimientos has no cliente_id, so we scope by ids).
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('botellones')
      .select('id, codigo, estado')
      .eq('cliente_id', clienteId)
      .order('codigo')
      .then(({ data }) => setBotellones((data as unknown as BotellonChip[]) || []));
  }, [clienteId]);

  const cargar = useCallback(
    async (p: number, reemplazar = false) => {
      setLoading(true);
      let filas: EventoHistorial[] = [];
      let count = 0;
      try {
        const supabase = createClient();
        const from = (p - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const ids = botellones.map((b) => b.id);
        if (ids.length === 0) {
          filas = [];
          count = 0;
        } else {
          let query = supabase
            .from('movimientos')
            .select('id, estado_previo, estado_nuevo, created_at, botellones(codigo)', { count: 'exact' })
            .in('botellon_id', ids);
          if (botellonId) query = query.eq('botellon_id', botellonId);
          if (desde) query = query.gte('created_at', desde);
          // created_at is timestamptz: lte with a bare date would exclude the
          // whole `hasta` day, so cap it at end-of-day for an inclusive filter.
          if (hasta) query = query.lte('created_at', `${hasta}T23:59:59`);
          if (filtroEstado) query = query.eq('estado_nuevo', filtroEstado);
          const { data, count: c } = await query
            .order('created_at', { ascending: false })
            .range(from, to);
          filas = ((data as unknown as MovimientoFila[]) || []).map((m) => {
            const d = new Date(m.created_at);
            return {
              id: m.id,
              fechaStr: formatFechaZona(d),
              horaStr: formatHoraZona(d),
              de: m.estado_previo ?? '',
              a: m.estado_nuevo ?? '',
              codigo: m.botellones?.codigo ?? '',
            };
          });
          count = c ?? 0;
        }
      } catch (err) {
        // Keep the component usable if a query fails: render an empty page
        // instead of leaving the table stuck on "Cargando…" forever.
        console.error('HistorialCliente cargar:', err);
        filas = [];
        count = 0;
      } finally {
        setLoading(false);
      }

      // `reemplazar` lets the realtime refresh swap the CURRENT page instead of
      // appending to it (append would duplicate rows/keys).
      setEventos((prev) => (p === 1 || reemplazar ? filas : [...prev, ...filas]));
      setTotal(count);
      setPage(p);
    },
    [botellonId, botellones, desde, hasta, filtroEstado]
  );

  useEffect(() => {
    void cargar(1);
  }, [cargar]);

  // Latest-value refs so the realtime channel callback (subscribed once) always
  // sees the current page/cargar, whether anything has loaded, and the set
  // of botellon ids that belong to this client.
  const pageRef = useRef(page);
  const cargarRef = useRef(cargar);
  const hayDatosRef = useRef(eventos.length > 0);
  const idsRef = useRef<string[]>(botellones.map((b) => b.id));
  // Realtime coalescing state: only one reload in flight at a time, plus a
  // pending flag so bursts of events settle into a single trailing reload.
  const cargandoRef = useRef(false);
  const pendienteRef = useRef(false);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    cargarRef.current = cargar;
  }, [cargar]);
  useEffect(() => {
    hayDatosRef.current = eventos.length > 0;
  }, [eventos]);
  useEffect(() => {
    idsRef.current = botellones.map((b) => b.id);
  }, [botellones]);

  // Realtime insert refresh (EstadoEnVivo pattern): a new movimiento row for
  // this client reloads the current page (or page 1 when empty). movimientos
  // has no cliente_id, so realtime can't filter by client in one channel — with
  // "Todos los botellones" we subscribe without a filter and gate the reload on
  // the payload's botellon_id belonging to the client's bottles. Degrades
  // silently on CHANNEL_ERROR/TIMED_OUT; removed on unmount.
  useEffect(() => {
    const supabase = createClient();
    // Coalesce bursts: while a reload is in flight, further events only set a
    // pending flag; once the fetch settles, a single trailing reload picks up
    // the latest state instead of stacking concurrent COUNT+RANGE fetches.
    const recargar = () => {
      if (cargandoRef.current) {
        pendienteRef.current = true;
        return;
      }
      cargandoRef.current = true;
      const p = hayDatosRef.current ? pageRef.current : 1;
      void cargarRef.current(p, true).finally(() => {
        cargandoRef.current = false;
        if (pendienteRef.current) {
          pendienteRef.current = false;
          recargar();
        }
      });
    };
    const esDeCliente = (payload: unknown) => {
      const id = (payload as { new: { botellon_id?: string } }).new?.botellon_id;
      return botellonId ? id === botellonId : Boolean(id && idsRef.current.includes(id));
    };
    const config = botellonId
      ? { event: 'INSERT' as const, schema: 'public', table: 'movimientos' as const, filter: `botellon_id=eq.${botellonId}` }
      : { event: 'INSERT' as const, schema: 'public', table: 'movimientos' as const };
    const channel = supabase
      .channel(`historial-cliente-${clienteId}`)
      .on('postgres_changes', config, (payload) => {
        if (esDeCliente(payload)) recargar();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Silent degradation: keep the last rendered page.
          console.warn('Realtime historial channel error:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteId, botellonId]);

  const hayMas = eventos.length < total;
  const hayFiltro = desde !== '' || hasta !== '' || filtroEstado !== '';

  return (
    <div className="space-y-4">
      {/* Per-botellon filter — single row of chips, scrolls when crowded. */}
      <div role="group" aria-label="Filtrar por botellón" className="flex gap-1 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setBotellonId(null)}
          className={cn(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            botellonId === null
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
          )}
        >
          Todos los botellones
        </button>
        {botellones.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBotellonId(b.id)}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              botellonId === b.id
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            )}
          >
            <span className="font-mono">{b.codigo}</span>
          </button>
        ))}
      </div>

      {/* Card: same table + filters + pagination as HistorialBotellon. */}
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
                    {e.codigo ? (
                      <span className="ml-2 inline-block rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 dark:bg-zinc-800">
                        {e.codigo}
                      </span>
                    ) : null}
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
    </div>
  );
}
