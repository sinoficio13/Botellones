'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { mensajeWhatsApp, buildWaLink, linkWhatsApp } from '@/lib/utils/whatsapp';
import type { EstadoOperativo, GrupoCola } from '@/hooks/useColaOperaciones';

export type SheetWhatsAppProps = {
  grupo: GrupoCola;
  estado: EstadoOperativo;
  onClose: () => void;
};

/**
 * SheetWhatsApp — WhatsApp bottom sheet (REQ-COS-28). Controlled by the shell
 * (D8): mounted only while `sheetWhatsApp` is set, so the editable message
 * state is re-initialized from the locked §7.3 `mensajeWhatsApp` literal on
 * every open, for the CURRENT tab/estado. The operator edits before sending;
 * "Abrir WhatsApp" opens the `wa.me` deep link (normalized digits +
 * encodeURIComponent text, D13) in a new tab; Cancelar (or Escape/overlay via
 * the base-ui Dialog) closes. No automatic send on estado change — the sheet
 * never reacts to queue re-renders (S5).
 */
export function SheetWhatsApp({ grupo, estado, onClose }: SheetWhatsAppProps) {
  const cliente = grupo.botellones[0]?.clientes;
  const nombre = cliente?.nombre ?? '';
  const cantidad = grupo.botellones.length;
  // D8: the shell remounts this sheet per open (sheetWhatsApp !== null), so the
  // useState initializer re-runs with the CURRENT estado — pre-loaded per tab.
  const [mensaje, setMensaje] = useState(() => mensajeWhatsApp(estado, nombre, cantidad));
  const digitos = linkWhatsApp(cliente?.whatsapp);
  const href = buildWaLink(digitos, mensaje);

  return (
    <Sheet
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <SheetContent side="bottom" className="px-4 pb-4 sm:mx-auto sm:max-w-md">
        <SheetHeader className="flex-row items-center gap-3 p-0">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-whatsapp text-white">
            <MessageCircle aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <SheetTitle className="truncate">{nombre}</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {cliente?.whatsapp ?? ''}
            </SheetDescription>
          </div>
        </SheetHeader>

        <textarea
          aria-label="Mensaje de WhatsApp"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-md border border-border-strong bg-surface-2 p-3 text-sm text-text-primary"
        />
        <p className="text-xs text-text-muted">Tocá para editar antes de enviar</p>

        <div className="mt-1 flex gap-2">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 flex-1 items-center justify-center rounded-md bg-whatsapp px-4 text-sm font-medium text-white"
          >
            Abrir WhatsApp
          </a>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium text-text-primary"
          >
            Cancelar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}