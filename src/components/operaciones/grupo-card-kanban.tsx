'use client';

import { useMemo, useState } from 'react';

import { AlertTriangle, MessageCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatAntiguedad, nivelUrgencia } from '@/lib/utils/cola';
import { ActionButton } from '@/components/operaciones/action-button';
import { Chip } from '@/components/operaciones/chip';
import { copiaAccion, useEdadAhora } from '@/components/operaciones/grupo-card';
import type { EstadoOperativo, GrupoCola } from '@/hooks/useColaOperaciones';

export type GrupoCardKanbanProps = {
  grupo: GrupoCola;
  estado: EstadoOperativo;
  enAccion?: boolean;
  /** Selection action: ids = currently marked bottles (all by default). */
  onAccion: (ids: string[]) => void | Promise<unknown>;
  /** Manual pickup for estado `listo` (listo → entregado): a second "✓ Entregar
   * N" selection button rendered ONLY when estado === 'listo'. Other estados
   * render exactly one action regardless of this prop. */
  onEntregar?: (ids: string[]) => void | Promise<unknown>;
  /** REQ-COS-28: WhatsApp tap → shell opens the sheet (D8). Always fires —
   * the shell decides toast (no phone) vs sheet (D7). */
  onWhatsApp?: () => void;
  /** REQ-COS-29: name tap → shell opens the client ficha sheet (D8). */
  onAbrirFicha?: () => void;
  /** REQ-25 (PR-B): the parent owns the dragId fallback — card reports its payload. */
  onDragStart?: (idsStr: string) => void;
  /** REQ-25 (PR-B): clears the parent dragId on dragend. */
  onDragEnd?: () => void;
};

/** Chips visibles antes del botón expansor +N (REQ-23, D12 — mirrored from GrupoCard's CHIPS_VISIBLES). */
const CODIGOS_VISIBLES = 6;

/**
 * GrupoCardKanban — compact per-bottle-selection card for the desktop kanban
 * (REQ-23, D3: new component, mirrors GrupoCard's chip/selection pattern so
 * every device moves the same way). Client name + mono cédula ("—" NULL), age +
 * 2-level urgency (6–24h text via --urgencia-texto; >24h ▲ + amber tint via
 * --urgencia; R4-001), per-bottle toggle Chips in a grid (ALL marked on mount;
 * subset moves only the marked bottles, same as GrupoCard), a +N expansion
 * button for hidden codes, subset-aware ActionButton ≥44px with per-estado copy
 * (DESTINO_ACCION/copiaAccion), the two `listo` buttons (forward + ✓ Entregar)
 * respecting the selection, drag & drop that moves the selection, and an inert
 * WhatsApp target (disabled + opacity-40 sin teléfono). R1-001: the clock is
 * client-only (useEdadAhora) — SSR-safe placeholder on the server.
 * Tokens only, no hex.
 */
export function GrupoCardKanban({
  grupo,
  estado,
  enAccion = false,
  onAccion,
  onEntregar,
  onWhatsApp,
  onAbrirFicha,
  onDragStart,
  onDragEnd,
}: GrupoCardKanbanProps) {
  // R1-001: the real clock only exists after mount — server render and the
  // first client render share the null clock (no hydration mismatch).
  const ahora = useEdadAhora();

  // Selección local al card (design D6, mirrored from GrupoCard): todas
  // marcadas al montar; el hook no expone API de selección. Sobrevive a
  // movimientos de subconjuntos.
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(grupo.botellones.map((b) => b.id))
  );
  const [expandido, setExpandido] = useState(false);

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

  const urgencia = ahora ? nivelUrgencia(grupo.estado_desde, ahora) : 'normal';
  const antiguedad = ahora ? formatAntiguedad(grupo.estado_desde, ahora) : '0m';

  const visibles = expandido ? grupo.botellones : grupo.botellones.slice(0, CODIGOS_VISIBLES);
  const ocultos = grupo.botellones.length - visibles.length;
  const sinMarcados = marcadosValidos.size === 0;
  const deshabilitada = sinMarcados || enAccion;

  function toggle(id: string, siguiente: boolean) {
    setMarcados((prev) => {
      const proximo = new Set(prev);
      if (siguiente) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  // All-selected → no count (UX rule): "✓ Entregar a María"; subset → count.
  const copiaEntregar = sinMarcados
    ? 'Elegí al menos un botellón'
    : marcadosValidos.size >= grupo.botellones.length
      ? primerNombre
        ? `✓ Entregar a ${primerNombre}`
        : `✓ Entregar`
      : primerNombre
        ? `✓ Entregar ${marcadosValidos.size} a ${primerNombre}`
        : `✓ Entregar ${marcadosValidos.size}`;

  return (
    <article
      data-testid="grupo-card-kanban"
      draggable
      onDragStart={(e) => {
        // REQ-25: the dragged payload is the SELECTION (consistent with the
        // buttons) — all ids by default, only the marked subset otherwise.
        const seleccion = [...marcadosValidos];
        if (seleccion.length === 0) return;
        e.dataTransfer.setData('text/plain', seleccion.join(','));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(seleccion.join(','));
      }}
      onDragEnd={() => {
        // REQ-25 S4: clear the parent dragId fallback.
        onDragEnd?.();
      }}
      className={cn(
        'rounded-lg border border-border-strong bg-surface-1 p-4',
        urgencia === 'critica' && 'bg-urgencia/7'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {/* REQ-COS-29: name tap opens the client ficha sheet (D8) — the span
              becomes a button so the target is keyboard-accessible and ≥44px. */}
          <button
            type="button"
            onClick={onAbrirFicha}
            className="min-h-11 max-w-full truncate text-left text-sm font-medium text-text-primary"
          >
            {nombre}
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

      {/* Codes: per-bottle toggle Chips in a grid, +N expansion (mirrors
          GrupoCard, REQ-23 D12 — all selected by default). */}
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

      {estado === 'listo' && onEntregar ? (
        <div className="mt-3 flex flex-col gap-2">
          <ActionButton
            disabled={deshabilitada}
            onClick={() => {
              void onAccion([...marcadosValidos]);
            }}
            className="w-full"
          >
            {sinMarcados
              ? 'Elegí al menos un botellón'
              : copiaAccion(estado, marcadosValidos.size, grupo.botellones.length, primerNombre)}
          </ActionButton>
          {/* Manual pickup: listo → entregado (direct delivery) as a distinct
              bordered/text button next to the forward action. Flat secondary:
              surface + border, one-step hover darkening. */}
          <button
            type="button"
            disabled={deshabilitada}
            onClick={() => {
              void onEntregar?.([...marcadosValidos]);
            }}
            className="min-h-11 w-full rounded-lg border border-border-strong bg-surface-1 px-3 text-sm font-medium text-text-primary transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/60 dark:hover:bg-zinc-800"
          >
            {copiaEntregar}
          </button>
        </div>
      ) : (
        <ActionButton
          disabled={deshabilitada}
          onClick={() => {
            void onAccion([...marcadosValidos]);
          }}
          className="mt-3 w-full"
        >
          {sinMarcados
            ? 'Elegí al menos un botellón'
            : copiaAccion(estado, marcadosValidos.size, grupo.botellones.length, primerNombre)}
        </ActionButton>
      )}
    </article>
  );
}