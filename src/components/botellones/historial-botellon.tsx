'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { ESTADO_LABELS } from '@/lib/utils/estados';
import { formatHora12, formatFechaLocal } from '@/lib/utils/hora';

/** Deterministic operation label for a transition (the batch ops + kanban moves). */
const OPERACION_POR_TRANSICION: Record<string, string> = {
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
  fecha: Date;
  tipo: 'movimiento' | 'recarga';
  de?: string;
  a?: string;
  numero?: string;
};

const PAGE_SIZE = 20;

/**
 * HistorialBotellon — tabbed, server-paginated bottle history (good DB
 * practices): COUNT + RANGE per page instead of loading everything, and tabs
 * (Estados / Recargas) so the timeline never becomes an endless scroll.
 */
export function HistorialBotellon({ botellonId }: { botellonId: string }) {
  const [tab, setTab] = useState<'estados' | 'recargas'>('estados');
  const [eventos, setEventos] = useState<EventoHistorial[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(
    async (t: 'estados' | 'recargas', p: number) => {
      setLoading(true);
      const supabase = createClient();
      const from = (p - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let filas: EventoHistorial[] = [];
      let count = 0;

      if (t === 'estados') {
        const { data, count: c } = await supabase
          .from('movimientos')
          .select('id, estado_previo, estado_nuevo, created_at', { count: 'exact' })
          .eq('botellon_id', botellonId)
          .order('created_at', { ascending: false })
          .range(from, to);
        filas = ((data as unknown as { id: string; estado_previo: string | null; estado_nuevo: string | null; created_at: string }[]) || []).map(
          (m) => ({ id: m.id, fecha: new Date(m.created_at), tipo: 'movimiento' as const, de: m.estado_previo ?? '', a: m.estado_nuevo ?? '' })
        );
        count = c ?? 0;
      } else {
        const { data, count: c } = await supabase
          .from('recargas')
          .select('id, fecha, hora, numero_registro', { count: 'exact' })
          .eq('botellon_id', botellonId)
          .order('fecha', { ascending: false })
          .order('hora', { ascending: false })
          .range(from, to);
        filas = ((data as unknown as { id: string; fecha: string; hora: string; numero_registro: string }[]) || []).map(
          (r) => ({ id: r.id, fecha: new Date(`${r.fecha}T${r.hora ?? '00:00'}`), tipo: 'recarga' as const, numero: r.numero_registro })
        );
        count = c ?? 0;
      }

      setEventos((prev) => (p === 1 ? filas : [...prev, ...filas]));
      setTotal(count);
      setPage(p);
      setLoading(false);
    },
    [botellonId]
  );

  useEffect(() => {
    void cargar(tab, 1);
  }, [tab, cargar]);

  const hayMas = eventos.length < total;

  const contador = (t: 'estados' | 'recargas') =>
    t === tab ? total : null;

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Historial</h2>

      {/* Tabs: keep the list short — one event type at a time. */}
      <div
        role="tablist"
        aria-label="Tipo de historial"
        className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {(
          [
            ['estados', 'Estados'],
            ['recargas', 'Recargas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              tab === id
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            )}
          >
            {label}
            {tab === id ? <span className="ml-1 opacity-70">({total})</span> : null}
          </button>
        ))}
      </div>

      {loading && eventos.length === 0 ? (
        <p className="text-sm text-zinc-400">Cargando…</p>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay registros.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-zinc-200 pl-4 dark:border-zinc-800">
          {eventos.map((e) => (
            <li key={`${e.tipo}-${e.id}`} className="relative">
              <span
                aria-hidden
                className={cn(
                  'absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white dark:border-zinc-900',
                  e.tipo === 'recarga' ? 'bg-green-500' : 'bg-zinc-400'
                )}
              />
              <p className="text-xs text-zinc-500">
                {formatFechaLocal(e.fecha.toISOString().slice(0, 10))} · {formatHora12(e.fecha)}
              </p>
              {e.tipo === 'recarga' ? (
                <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                  Recarga · <span className="font-mono text-xs font-medium">{e.numero}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(ESTADO_LABELS[e.de ?? ''] ?? e.de) || '—'} → {ESTADO_LABELS[e.a ?? ''] ?? e.a}
                  <span className="ml-2 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                    {OPERACION_POR_TRANSICION[`${e.de}→${e.a}`] ?? 'Cambio de estado'}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {hayMas ? (
        <button
          type="button"
          onClick={() => void cargar(tab, page + 1)}
          disabled={loading}
          className="w-full rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {loading ? 'Cargando…' : `Cargar más (${eventos.length} de ${total})`}
        </button>
      ) : null}
    </div>
  );
}