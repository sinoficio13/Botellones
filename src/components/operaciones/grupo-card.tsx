'use client';

import { useMemo, useState } from 'react';
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
  onAccion: (ids: string[]) => void | Promise<unknown>;
};

/** Chips visibles antes del expansor +N (REQ-COS-18: "show 6 plus a +N expansion"). */
const CHIPS_VISIBLES = 6;

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
function copiaAccion(estado: EstadoOperativo, n: number, primerNombre: string): string {
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
export function GrupoCard({ grupo, estado, enAccion = false, onAccion }: GrupoCardProps) {
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
  const urgencia = nivelUrgencia(grupo.estado_desde);
  const antiguedad = formatAntiguedad(grupo.estado_desde);

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
      className={cn(
        'rounded-lg border border-border-strong bg-surface-1 p-3',
        urgencia === 'critica' && 'bg-urgencia/7'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {/* FASE 5 placeholder: ficha del cliente. Target inerte por diseño (spec §7.3). */}
          <button
            type="button"
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
          {/* WhatsApp — FASE 5 placeholder (bottom sheet). Disabled sin teléfono (§7.3); inerte con teléfono. */}
          <button
            type="button"
            aria-label={`WhatsApp de ${nombre}`}
            disabled={!cliente?.whatsapp}
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