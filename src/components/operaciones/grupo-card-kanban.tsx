'use client';

import { AlertTriangle, MessageCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatAntiguedad, nivelUrgencia } from '@/lib/utils/cola';
import { ActionButton } from '@/components/operaciones/action-button';
import { copiaAccion, useEdadAhora } from '@/components/operaciones/grupo-card';
import type { EstadoOperativo, GrupoCola } from '@/hooks/useColaOperaciones';

export type GrupoCardKanbanProps = {
  grupo: GrupoCola;
  estado: EstadoOperativo;
  enAccion?: boolean;
  /** Whole-group action: ids = grupo.botellones.map(b => b.id) (REQ-23). */
  onAccion: (ids: string[]) => void | Promise<unknown>;
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

/** Codes visibles en la línea `·` antes del sufijo +N (REQ-23, D12 — sin expansor en desktop). */
const CODIGOS_VISIBLES = 6;

/**
 * GrupoCardKanban — compact whole-group card for the desktop kanban (REQ-23,
 * D3: new component, GrupoCard's chips/selection stay untouched). Client name
 * + mono cédula ("—" NULL), age + 2-level urgency (6–24h text via
 * --urgencia-texto; >24h ▲ + amber tint via --urgencia; R4-001), bottle codes
 * on ONE ·-line truncated with a static "+N" (no chips), whole-group
 * ActionButton ≥44px with per-estado copy (DESTINO_ACCION/copiaAccion), and an
 * inert WhatsApp target (disabled + opacity-40 sin teléfono). R1-001: the
 * clock is client-only (useEdadAhora) — SSR-safe placeholder on the server.
 * Tokens only, no hex.
 */
export function GrupoCardKanban({
  grupo,
  estado,
  enAccion = false,
  onAccion,
  onWhatsApp,
  onAbrirFicha,
  onDragStart,
  onDragEnd,
}: GrupoCardKanbanProps) {
  // R1-001: the real clock only exists after mount — server render and the
  // first client render share the null clock (no hydration mismatch).
  const ahora = useEdadAhora();

  const cliente = grupo.botellones[0]?.clientes;
  const nombre = cliente?.nombre ?? '';
  const primerNombre = nombre.split(/\s+/)[0] ?? '';
  const cedula = cliente?.cedula ?? '—';

  const urgencia = ahora ? nivelUrgencia(grupo.estado_desde, ahora) : 'normal';
  const antiguedad = ahora ? formatAntiguedad(grupo.estado_desde, ahora) : '0m';

  const visibles = grupo.botellones.slice(0, CODIGOS_VISIBLES);
  const ocultos = grupo.botellones.length - visibles.length;
  const ids = grupo.botellones.map((b) => b.id);

  return (
    <article
      data-testid="grupo-card-kanban"
      draggable
      onDragStart={(e) => {
        // REQ-25: set dataTransfer with the whole group's ids + effectAllowed.
        e.dataTransfer.setData('text/plain', ids.join(','));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(ids.join(','));
      }}
      onDragEnd={() => {
        // REQ-25 S4: clear the parent dragId fallback.
        onDragEnd?.();
      }}
      className={cn(
        'rounded-lg border border-border-strong bg-surface-1 p-3',
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

      {/* Codes: ONE ·-line, 6 visibles + static +N (REQ-23, D12 — no chips, no
          expansor). R4-001 (carried): the +N suffix lives OUTSIDE the truncate
          element in its own shrink-0 span, so it stays visible even when the
          codes line is clipped in a narrow container. */}
      <div className="mt-2 flex min-w-0 items-center gap-1">
        <p className="truncate text-xs text-text-secondary">
          {visibles.map((b) => b.codigo).join(' · ')}
        </p>
        {ocultos > 0 ? (
          <span className="shrink-0 text-xs text-text-muted">+{ocultos}</span>
        ) : null}
      </div>

      <ActionButton
        disabled={enAccion}
        onClick={() => {
          void onAccion(ids);
        }}
        className="mt-3 w-full"
      >
        {copiaAccion(estado, ids.length, primerNombre)}
      </ActionButton>
    </article>
  );
}