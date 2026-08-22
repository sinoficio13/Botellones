'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getClientesForSelect,
  moverBotellon,
  type BotellonOperativo,
} from '@/lib/db/botellones';
import { ESTADOS_KANBAN } from '@/lib/utils/estados';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ── Colores y etiquetas por estado ──
const ESTADO_META: Record<string, { label: string; sub: string; dot: string }> = {
  recibido: { label: 'Recibido', sub: 'Sucio · esperando lavado', dot: '#64748B' },
  recarga: { label: 'En recarga', sub: 'Llenando ahora', dot: '#0C7C92' },
  listo: { label: 'Listo', sub: 'Recargado · listo p/ despacho', dot: '#1A9150' },
  delivery: { label: 'En delivery', sub: 'En camino al cliente', dot: '#DB9A2E' },
  entregado: { label: 'Entregado', sub: 'En manos del cliente', dot: '#6D42C7' },
};

const TODOS_ESTADOS = [...ESTADOS_KANBAN, 'entregado'];

type Props = {
  botellones: BotellonOperativo[];
  recargasHoy: number;
};

export function OperacionesDashboard({ botellones: initial, recargasHoy: initialHoy }: Props) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [botellones, setBotellones] = useState(initial);
  const [recargasHoy, setRecargasHoy] = useState(initialHoy);
  const [dragId, setDragId] = useState<string | null>(null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string; codigo: string }>>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const flashToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2400);
  };

  // Realtime reconciliation (spec RT R3): every botellones UPDATE from any
  // operator patches the matching row. Patch-always + refresh-error-only
  // (design D5): an echo of the operator's own optimistic write is a semantic
  // no-op because the payload carries no `clientes` join, so the existing join
  // object is preserved when `cliente_id` is unchanged. router.refresh() stays
  // only in the server-rejection path below — both converge to canonical data.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('kanban-botellones')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'botellones' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const nuevo = payload.new as Record<string, unknown> | undefined;
          if (!nuevo?.id) return;
          setBotellones((prev) =>
            prev.map((b) => {
              if (b.id !== nuevo.id) return b;
              const clienteId = (nuevo.cliente_id as string | null) ?? null;
              // Idempotent patch: keep the join when cliente_id is unchanged;
              // a client assigned by another operator arrives without the name.
              const clientes =
                clienteId === b.cliente_id
                  ? b.clientes
                  : clienteId
                    ? { nombre: '' }
                    : null;
              return {
                ...b,
                estado: nuevo.estado as string,
                cliente_id: clienteId,
                fecha_entrega: (nuevo.fecha_entrega as string | null) ?? null,
                clientes,
              };
            })
          );
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Silent degradation: keep the last rendered state.
          console.warn('Realtime kanban channel error:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const byEstado = useCallback(
    (estado: string) => botellones.filter((b) => b.estado === estado),
    [botellones]
  );

  const move = async (id: string, target: string) => {
    const b = botellones.find((x) => x.id === id);
    if (!b || b.estado === target) return;

    if (target === 'entregado') {
      setAssignId(id);
      const cs = await getClientesForSelect();
      setClientes(cs);
      return;
    }

    // Optimistic update
    setBotellones((prev) =>
      prev.map((x) => (x.id === id ? { ...x, estado: target, cliente_id: null, clientes: null } : x))
    );
    const res = await moverBotellon(id, target);
    if (res.error) {
      flashToast(res.error);
      router.refresh();
    } else {
      flashToast(`${b.codigo} → ${ESTADO_META[target]?.label || target}`);
    }
  };

  const confirmAssign = async (clienteId: string) => {
    if (!assignId) return;
    const b = botellones.find((x) => x.id === assignId);
    const c = clientes.find((x) => x.id === clienteId);
    setBotellones((prev) =>
      prev.map((x) =>
        x.id === assignId
          ? { ...x, estado: 'entregado', cliente_id: clienteId, clientes: { nombre: c?.nombre || '' }, fecha_entrega: new Date().toISOString() }
          : x
      )
    );
    setRecargasHoy((n) => n + 1);
    const res = await moverBotellon(assignId, 'entregado', clienteId);
    if (res.error) flashToast(res.error);
    else flashToast(`${b?.codigo} entregado a ${c?.nombre}`);
    setAssignId(null);
  };

  const kanban = ESTADOS_KANBAN.map((estado) => byEstado(estado));
  const entregados = byEstado('entregado');

  // KPIs
  const esperandoRecarga = byEstado('recibido').length + byEstado('recarga').length;
  const enRuta = byEstado('delivery').length;
  const enCirculacion = entregados.length;
  const listos = byEstado('listo').length;

  // Alertas
  const vencidos = entregados.filter((b) => {
    if (!b.fecha_entrega) return false;
    const dias = Math.round((now - new Date(b.fecha_entrega).getTime()) / 86400000);
    return dias > 25;
  }).length;

  return (
    <div className="space-y-6">
      {/* ── Alertas ── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Necesita tu atención</h2>
        <div className="flex flex-wrap gap-2">
          {vencidos > 0 && (
            <AlertChip color="amber" num={vencidos} label="botellones con clientes hace >25 días — ofrecer recarga" />
          )}
          {vencidos === 0 && (
            <AlertChip color="green" num="✓" label="Todo al día. Sin pendientes urgentes." />
          )}
        </div>
      </section>

      {/* ── KPIs ── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Estado del negocio, ahora mismo</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <KpiCard label="En circulación" value={enCirculacion} sub="Con clientes ahora" color="text-purple-600" />
          <KpiCard label="Esperando recarga" value={esperandoRecarga} sub="Recibidos + llenando" color="text-cyan-600" />
          <KpiCard label="Listos" value={listos} sub="Para despachar" color="text-green-600" />
          <KpiCard label="En ruta" value={enRuta} sub="Saliendo a entrega" color="text-amber-600" />
          <KpiCard label="Recargas hoy" value={recargasHoy} sub="Completadas hoy" color="text-green-600" />
        </div>
      </section>

      {/* ── Kanban ── */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Ciclo de vida de los botellones</h2>
          <p className="text-xs text-zinc-400">Arrastra o usa el selector para mover</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ESTADOS_KANBAN.map((estado, i) => {
            const meta = ESTADO_META[estado];
            const items = kanban[i];
            const nextEstado = TODOS_ESTADOS[TODOS_ESTADOS.indexOf(estado) + 1];
            return (
              <div
                key={estado}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain') || dragId;
                  if (id) move(id, estado);
                }}
                className="flex min-h-[120px] flex-col rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase">
                    <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
                    {meta.label}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-mono text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
                    {items.length}
                  </span>
                </div>
                <p className="px-3 py-1.5 text-[10px] text-zinc-400">{meta.sub}</p>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {items.map((b) => (
                    <BotellonCard
                      key={b.id}
                      b={b}
                      onDragStart={(id) => setDragId(id)}
                      onMove={(target) => move(b.id, target)}
                      onAdvance={nextEstado && nextEstado !== 'entregado' ? () => move(b.id, nextEstado) : undefined}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="py-3 text-center text-[11px] text-zinc-300 dark:text-zinc-600">Sin botellones</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── En circulación ── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">En circulación — con clientes</h2>
        {entregados.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-400 dark:border-zinc-800">
            Ningún botellón está con clientes en este momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entregados.map((b) => {
              const dias = b.fecha_entrega
                ? Math.round((now - new Date(b.fecha_entrega).getTime()) / 86400000)
                : 0;
              const overdue = dias > 25;
              return (
                <div key={b.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{b.codigo}</span>
                    <button onClick={() => move(b.id, 'recibido')} className="text-xs text-blue-600 hover:underline">
                      ↩ Devolver
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    👤 {b.clientes?.nombre || (b.cliente_id ? 'Cliente asignado' : 'Sin cliente')}
                  </p>
                  <p className={`mt-0.5 text-[11px] ${overdue ? 'font-semibold text-amber-600' : 'text-zinc-400'}`}>
                    hace {dias} día{dias === 1 ? '' : 's'} {overdue && '· sugerir recarga'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Modal asignar cliente ── */}
      {assignId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAssignId(null)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-5 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold uppercase">Asignar a cliente</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {botellones.find((b) => b.id === assignId)?.codigo} se entrega a:
            </p>
            <select
              className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              onChange={(e) => confirmAssign(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Seleccionar cliente…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

function BotellonCard({
  b,
  onDragStart,
  onMove,
  onAdvance,
}: {
  b: BotellonOperativo;
  onDragStart: (id: string) => void;
  onMove: (target: string) => void;
  onAdvance?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', b.id);
        onDragStart(b.id);
      }}
      className="cursor-grab rounded-lg border border-zinc-200 bg-white p-2.5 shadow-sm transition-shadow hover:shadow dark:border-zinc-700 dark:bg-zinc-800"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold">{b.codigo}</span>
        {onAdvance && (
          <button onClick={onAdvance} title="Avanzar" className="ml-auto rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700">
            →
          </button>
        )}
      </div>
      <select
        onChange={(e) => onMove(e.target.value)}
        value={b.estado}
        className="mt-1.5 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        {TODOS_ESTADOS.map((s) => (
          <option key={s} value={s}>{ESTADO_META[s].label}</option>
        ))}
      </select>
    </div>
  );
}

function AlertChip({ color, num, label }: { color: 'red' | 'amber' | 'green'; num: string | number; label: string }) {
  const border = color === 'red' ? 'border-l-red-500' : color === 'amber' ? 'border-l-amber-500' : 'border-l-green-500';
  const numColor = color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : 'text-green-600';
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border border-l-4 border-zinc-200 bg-white px-3.5 py-2.5 dark:border-zinc-800 ${border}`}>
      <span className={`font-mono text-lg font-semibold ${numColor}`}>{num}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: number; sub: string; color?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <span className={`font-mono text-2xl font-semibold ${color || ''}`}>{value}</span>
      <span className="mt-0.5 block text-[11px] text-zinc-400">{sub}</span>
    </div>
  );
}