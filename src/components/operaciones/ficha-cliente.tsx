'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Phone, FileText } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { getBotellonesCliente, type BotellonesClienteResult } from '@/lib/db/botellones';
import { ESTADO_LABELS, ESTADO_COLORS } from '@/lib/utils/estados';
import { formatAntiguedad } from '@/lib/utils/cola';
import { useEdadAhora } from '@/components/operaciones/grupo-card';

export type FichaClienteProps = {
  clienteId: string;
  onClose: () => void;
  /** WhatsApp action → the shell swaps to the shared REQ-COS-28 sheet (D8). */
  onWhatsApp: () => void;
};

/**
 * FichaCliente — client ficha bottom sheet (REQ-COS-29, D14). Controlled by
 * the shell (D8: mounted only while `sheetFicha` is set), so the data fetch
 * re-runs per open with the CURRENT client. Shows nombre (16/500 via
 * SheetTitle), cédula in mono ("—" when NULL; stored cédulas are digits-only —
 * a future `V-`/`E-` prefix is display-only and out of scope), the joined
 * `direcciones(*)` row, three actions (WhatsApp → shared sheet swap, Llamar →
 * `tel:`, Ficha → `/clientes/[id]`), and "Sus botellones (N)" covering ALL
 * estados INCLUDING `entregado`, each with a per-estado `ESTADO_COLORS` badge
 * and its age (`formatAntiguedad`, client clock). Focus trap + Escape close
 * come from the base-ui Dialog (Sheet primitive). Cerrar (or Escape/overlay)
 * closes. Tokens only, no hex.
 */
export function FichaCliente({ clienteId, onClose, onWhatsApp }: FichaClienteProps) {
  const router = useRouter();
  const [datos, setDatos] = useState<BotellonesClienteResult | null>(null);
  // D10: the ficha list reuses the same client-only clock as the cards.
  const ahora = useEdadAhora();

  useEffect(() => {
    let activo = true;
    getBotellonesCliente(clienteId)
      .then((d) => {
        if (activo) setDatos(d);
      })
      .catch(() => {
        /* null-safe helper already resolves the empty shape */
      });
    return () => {
      activo = false;
    };
  }, [clienteId]);

  const cliente = datos?.cliente;
  const nombre = cliente?.nombre ?? '';
  const cedula = cliente?.cedula ?? null;
  const direccion = datos?.direccion ?? null;
  const dirCompuesta = direccion
    ? [direccion.calle, direccion.avenida, direccion.sector, direccion.urbanizacion, direccion.ciudad, direccion.estado]
        .filter(Boolean)
        .join(', ')
    : null;
  const botellones = datos?.botellones ?? [];
  const telefono = cliente?.telefono_1 ?? null;

  return (
    <Sheet
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <SheetContent side="bottom" className="px-4 pb-4 sm:mx-auto sm:max-w-md">
        <SheetHeader className="flex-row items-center gap-3 p-0">
          <div className="min-w-0">
            <SheetTitle className="truncate">{nombre}</SheetTitle>
            {/* Cédula stored digits-only; a future V-/E- prefix is display-only (D14). */}
            <SheetDescription className={cedula !== null ? 'font-mono text-xs' : 'font-mono text-xs text-text-muted'}>
              {cedula ?? '—'}
            </SheetDescription>
          </div>
        </SheetHeader>

        <p className="text-sm text-text-secondary">
          {dirCompuesta ?? 'Sin dirección cargada'}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onWhatsApp}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-whatsapp px-3 text-sm font-medium text-white"
          >
            <MessageCircle aria-hidden className="size-4" />
            WhatsApp
          </button>
          {telefono ? (
            <a
              href={`tel:${telefono}`}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-strong px-3 text-sm font-medium text-text-primary"
            >
              <Phone aria-hidden className="size-4" />
              Llamar
            </a>
          ) : (
            <button
              type="button"
              aria-disabled
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-strong px-3 text-sm font-medium text-text-primary opacity-40"
            >
              <Phone aria-hidden className="size-4" />
              Llamar
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push(`/clientes/${clienteId}`)}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-strong px-3 text-sm font-medium text-text-primary"
          >
            <FileText aria-hidden className="size-4" />
            Ficha
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Sus botellones ({botellones.length})
          </h3>
          {botellones.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">Sin botellones cargados</p>
          ) : (
            <ul className="mt-2 divide-y divide-border-strong rounded-md border border-border-strong bg-surface-1">
              {botellones.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs text-text-primary">{b.codigo}</span>
                    <span
                      className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${ESTADO_COLORS[b.estado] || ''}`}
                    >
                      {ESTADO_LABELS[b.estado] ?? b.estado}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-text-muted">
                    {ahora ? formatAntiguedad(b.estado_desde, ahora) : '0m'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium text-text-primary"
        >
          Cerrar
        </button>
      </SheetContent>
    </Sheet>
  );
}