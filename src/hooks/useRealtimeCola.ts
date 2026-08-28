'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Normalized realtime event for a botellon row — the fields the queue reducer
 * needs (id + new estado/client). The raw postgres_changes payload carries the
 * `botellones` columns but NOT the `clientes` join; unknown rows trigger a
 * one-shot refetch (design D5) rather than building a partial row here.
 */
export type EventoRealtime = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  id: string;
  estadoNuevo: string | undefined;
  clienteIdNuevo: string | null;
  /** Fresh `estado_desde` stamped by the DB trigger on estado change — lets the
   *  queue patch FIFO order + card age so the live view matches a fresh read. */
  estadoDesdeNuevo: string | undefined;
};

/**
 * Pure payload → event mapping (REQ-COS-27). Returns null for unknown event
 * types or a payload without a usable row id (the handler drops it — future
 * event types must never crash the queue).
 */
export function normalizarEvento(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
): EventoRealtime | null {
  if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE' && payload.eventType !== 'DELETE') {
    return null;
  }
  const nuevo = payload.new as Record<string, unknown> | undefined;
  const id = payload.eventType === 'DELETE' ? (payload.old?.id as string) : (nuevo?.id as string);
  if (!id) return null;
  return {
    eventType: payload.eventType,
    id,
    estadoNuevo: nuevo?.estado as string | undefined,
    clienteIdNuevo: (nuevo?.cliente_id as string | null | undefined) ?? null,
    estadoDesdeNuevo: nuevo?.estado_desde as string | undefined,
  };
}

/**
 * useRealtimeCola — postgres_changes subscription on `botellones` (REQ-COS-27,
 * design D1/D2). Owns ONLY the channel lifecycle + payload mapping; the caller
 * (useColaOperaciones) decides gate/queue. Mirrors the estado-en-vivo pattern:
 * channel `cola-realtime`, event `*`/public/botellones, removeChannel on
 * unmount, silent CHANNEL_ERROR/TIMED_OUT (warn only, keep last state).
 * `onEvento` is held in a ref so callers can pass an inline handler without
 * resubscribing on every render.
 */
export function useRealtimeCola(onEvento: (evento: EventoRealtime) => void): void {
  const onEventoRef = useRef(onEvento);

  useEffect(() => {
    onEventoRef.current = onEvento;
  }, [onEvento]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('cola-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'botellones' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const evento = normalizarEvento(payload);
          if (evento) onEventoRef.current(evento);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Silent degradation: keep the last rendered state.
          console.warn('Realtime cola channel error:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
