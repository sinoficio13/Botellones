'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, MessageCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatAntiguedad, nivelUrgencia } from '@/lib/utils/cola';
import { ESTADO_LABELS } from '@/lib/utils/estados';
import { Chip } from '@/components/operaciones/chip';
import { ActionButton } from '@/components/operaciones/action-button';
import type { DestinoAccion, EstadoOperativo, GrupoCola } from '@/hooks/useColaOperaciones';

export type GrupoCardProps = {
  grupo: GrupoCola;
  estado: EstadoOperativo;
  enAccion?: boolean;
  /** Card nueva por realtime (REQ-COS-27 D9): outline --marca 2px 1.2s → fade. */
  entrando?: boolean;
  onAccion: (ids: string[]) => void | Promise<unknown>;
  /** REQ-COS-28: WhatsApp tap → shell opens the sheet (D8). Always fires —
   * the shell decides toast (no phone) vs sheet (D7). */
  onWhatsApp?: () => void;
  /** REQ-COS-29: name/cédula tap → shell opens the client ficha sheet (D8). */
  onAbrirFicha?: () => void;
};

/** Chips visibles antes del expansor +N (REQ-COS-18: "show 6 plus a +N expansion"). */
const CHIPS_VISIBLES = 6;

/** Intervalo del reloj de edad (D10): re-setea `ahora` cada 30s. */
export const EDAD_TICK_MS = 30_000;

/**
 * useEdadAhora — carried R1-001 (SSR/hydration) + D10 (frozen clock). Age/urgency
 * depend on the real clock: `new Date()` on the server (T1) and on the client
 * (T2) can cross the 6h/24h boundary between render and hydration → mismatch.
 * The clock is only available AFTER mount (null on server + first client
 * render, so both sides render the identical server-safe placeholder); the
 * effect then sets the real `ahora` and the card re-renders with the true
 * age/urgency. D10 (carried): `ahora` re-sets every 30s (setInterval) so
 * realtime re-renders show fresh ages/urgency — a mount-only clock would go
 * stale on a long-lived queue screen. Reused by the ficha list (REQ-COS-29).
 */
export function useEdadAhora(): Date | null {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    // setState deferred out of the synchronous effect body (react-hooks/
    // set-state-in-effect): the clock becomes available right after mount.
    const timer = setTimeout(() => setAhora(new Date()), 0);
    // D10: 30s tick so ages stay fresh without a remount.
    const tick = setInterval(() => setAhora(new Date()), EDAD_TICK_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, []);
  return ahora;
}

/**
 * Destino por estado (máquina forward, REQ-COS-19):
 * recibido→recarga, recarga→listo, listo→delivery, delivery→entregado.
 * Exportado para que el cableado onAccion→mover (harness/shell) use la misma
 * tabla sin duplicarla.
 */
export const DESTINO_ACCION: Record<EstadoOperativo, DestinoAccion> = {
  recibido: 'recarga',
  recarga: 'listo',
  listo: 'delivery',
  delivery: 'entregado',
};

/**
 * Copy de la acción por estado (REQ-COS-19, renderizado desde PR-B):
 * "→ Pasar N a En recarga|Listo|En delivery" / "✓ Entregar N a {PrimerNombre}".
 * El envío real (RPC + optimistic + undo) se cablea en PR-C; acá el card
 * entrega los ids marcados vía `onAccion`.
 */
export function copiaAccion(estado: EstadoOperativo, n: number, primerNombre: string): string {
  return estado === 'delivery'
    ? `✓ Entregar ${n} a ${primerNombre}`
    : `→ Pasar ${n} a ${ESTADO_LABELS[DESTINO_ACCION[estado]]}`;
}

/**
 * GrupoCard — card de grupo cliente (REQ-COS-18). Bloque cliente (nombre +
 * cédula mono, "—" si NULL) con 3 targets ≥44px independientes: nombre
 * (ficha = placeholder FASE 5, inerte), WhatsApp (disabled sin teléfono con
 * opacity-40; inerte con teléfono — sheet FASE 5) y grilla de chips.
 * Chips todas marcadas por defecto, toggle individual, 6 visibles + expansor
 * "+N" si el grupo supera 6. Urgencia 2 niveles: 6–24h texto --urgencia;
 * >24h ▲ AlertTriangle + fondo ámbar 7% vía token; <6h normal. Edad con
 * `formatAntiguedad`. Solo tokens — sin hex (REQ-18).
 */
export function GrupoCard({ grupo, estado, enAccion = false, entrando = false, onAccion, onWhatsApp, onAbrirFicha }: GrupoCardProps) {
  // R1-001: the real clock only exists after mount — server render and the
  // first client render share the null clock (no hydration mismatch).
  const ahora = useEdadAhora();
  // Selección local al card (design D6): todas marcadas al montar; el hook no
  // expone API de selección. Sobrevive a movimientos de subconjuntos.
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(grupo.botellones.map((b) => b.id))
  );
  const [expandido, setExpandido] = useState(false);
  // Estado en-vuelo propio del card (R2-001 carried fix): deshabilita la acción
  // mientras onAccion (async) corre, además del prop controlado `enAccion`.
  const [enVuelo, setEnVuelo] = useState(false);

  // R2-001 carried fix (DERIVED, no effect): cuando el grupo se encoge
  // (movimiento de subconjunto), el conteo/copy/ids deben descartar los ids
  // que ya no pertenecen al grupo, aunque `marcados` (selección local, D6)
  // conserve su estado para los chips restantes.
  const marcadosValidos = useMemo(
    () => new Set([...marcados].filter((id) => grupo.botellones.some((b) => b.id === id))),
    [marcados, grupo.botellones]
  );

  const cliente = grupo.botellones[0]?.clientes;
  const nombre = cliente?.nombre ?? '';
  const primerNombre = nombre.split(/\s+/)[0] ?? '';
  const cedula = cliente?.cedula ?? '—';
  // R1-001: null clock (server + first client render) → server-safe placeholder
  // ('0m' / normal); the effect's setAhora triggers the re-render with the real
  // age/urgency right after mount.
  const urgencia = ahora ? nivelUrgencia(grupo.estado_desde, ahora) : 'normal';
  const antiguedad = ahora ? formatAntiguedad(grupo.estado_desde, ahora) : '0m';

  const visibles = expandido ? grupo.botellones : grupo.botellones.slice(0, CHIPS_VISIBLES);
  const ocultos = grupo.botellones.length - visibles.length;
  const sinMarcados = marcadosValidos.size === 0;
  const deshabilitada = sinMarcados || enAccion || enVuelo;

  function toggle(id: string, siguiente: boolean) {
    setMarcados((prev) => {
      const proximo = new Set(prev);
      if (siguiente) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  async function ejecutarAccion() {
    setEnVuelo(true);
    try {
      await onAccion([...marcadosValidos]);
    } finally {
      setEnVuelo(false);
    }
  }

  return (
    <article
      data-testid="grupo-card"
      data-entrada={entrando || undefined}
      className={cn(
        'rounded-lg border border-border-strong bg-surface-1 p-3',
        urgencia === 'critica' && 'bg-urgencia/7',
        // REQ-COS-27 D9: card nueva por realtime → outline 2px --marca que
        // fadea (el hook limpia `entrando` a los 1.2s; sin slide ni salto).
        entrando && 'outline outline-2 outline-marca'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {/* REQ-COS-29: ficha del cliente. El tap abre el sheet (D8) — el
              shell decide el estado del sheet; el card solo dispara. */}
          <button
            type="button"
            onClick={onAbrirFicha}
            className="flex min-h-11 max-w-full items-center gap-0.5 text-left text-sm font-medium text-text-primary"
          >
            <span className="truncate">{nombre}</span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-text-muted" />
          </button>
          <span
            className={cn(
              'font-mono text-xs',
              cedula === '—' ? 'text-text-muted' : 'text-text-secondary'
            )}
          >
            {cedula}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* WhatsApp — REQ-COS-28 (D7): aria-disabled (NOT disabled) sin teléfono
              para que el tap SIEMPRE dispare onWhatsApp y el shell decida (toast
              "Este cliente no tiene teléfono cargado" vs abrir el sheet). */}
          <button
            type="button"
            aria-label={`WhatsApp de ${nombre}`}
            aria-disabled={!cliente?.whatsapp || undefined}
            onClick={onWhatsApp}
            className={cn(
              'grid size-11 place-items-center rounded-md text-text-secondary',
              !cliente?.whatsapp && 'opacity-40'
            )}
          >
            <MessageCircle aria-hidden className="size-5" />
          </button>
          {urgencia === 'critica' ? (
            <AlertTriangle aria-hidden className="size-4 text-urgencia" />
          ) : null}
          <span
            className={cn(
              'text-xs tabular-nums',
              // R4-001: texto de urgencia usa --urgencia-texto (AA en claro);
              // --urgencia queda para tintes (bg 7%) e íconos.
              urgencia === 'normal' ? 'text-text-muted' : 'text-urgencia-texto'
            )}
          >
            {antiguedad}
          </span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1.5">
        {visibles.map((b) => (
          <Chip
            key={b.id}
            label={b.codigo}
            pressed={marcadosValidos.has(b.id)}
            onToggle={(siguiente) => toggle(b.id, siguiente)}
          />
        ))}
        {ocultos > 0 ? (
          <button
            type="button"
            aria-label={`Mostrar ${ocultos} botellones más`}
            onClick={() => setExpandido(true)}
            className="min-h-11 rounded-md border border-border-strong px-2.5 text-sm text-text-secondary"
          >
            +{ocultos}
          </button>
        ) : null}
      </div>

      <ActionButton
        disabled={deshabilitada}
        onClick={() => {
          void ejecutarAccion();
        }}
        className="mt-3 w-full"
      >
        {sinMarcados
          ? 'Elegí al menos un botellón'
          : copiaAccion(estado, marcadosValidos.size, primerNombre)}
      </ActionButton>
    </article>
  );
}