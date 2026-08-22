'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ESTADOS,
  ESTADO_COLORS,
  ESTADO_LABELS,
  type Estado,
} from '@/lib/utils/estados';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type EstadoLive = {
  estado: Estado;
  clienteId: string | null;
  fechaEntrega: string | null;
};

type Props = {
  botellonId: string;
  estado: Estado;
  clienteId: string | null;
  fechaEntrega: string | null;
  onLiveChange?: (live: EstadoLive) => void;
};

/**
 * Canonical live estado badge for the botellon detail page. Subscribes to
 * postgres_changes UPDATE events filtered to this botellon and re-renders the
 * badge from the payload, notifying the parent form via `onLiveChange` so the
 * selector and its Avanzar/Deshacer groups follow the live estado.
 *
 * Degrades silently on CHANNEL_ERROR/TIMED_OUT (bell.tsx pattern) and removes
 * the channel on unmount (spec RT R2/S4/S5).
 */
export function EstadoEnVivo({
  botellonId,
  estado,
  clienteId,
  fechaEntrega,
  onLiveChange,
}: Props) {
  const [live, setLive] = useState<EstadoLive>({ estado, clienteId, fechaEntrega });
  const onLiveChangeRef = useRef(onLiveChange);

  useEffect(() => {
    onLiveChangeRef.current = onLiveChange;
  }, [onLiveChange]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`estado-botellon-${botellonId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'botellones',
          filter: `id=eq.${botellonId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const nuevo = payload.new as Record<string, unknown> | undefined;
          // Future estados must never crash the UI — drop unknown payloads.
          if (!nuevo || !ESTADOS.includes(nuevo.estado as Estado)) return;
          const next: EstadoLive = {
            estado: nuevo.estado as Estado,
            clienteId: (nuevo.cliente_id as string | null) ?? null,
            fechaEntrega: (nuevo.fecha_entrega as string | null) ?? null,
          };
          setLive(next);
          onLiveChangeRef.current?.(next);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Silent degradation: keep the last rendered state.
          console.warn('Realtime estado channel error:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [botellonId]);

  return (
    <span
      className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${
        ESTADO_COLORS[live.estado] || ''
      }`}
    >
      {ESTADO_LABELS[live.estado] || live.estado}
    </span>
  );
}