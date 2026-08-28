'use client';

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { getBotellonByCodigo } from '@/lib/db/botellones';
import type { CargaState } from '@/lib/db/cargas';
import { useSesionCarga } from '@/hooks/useSesionCarga';
import { SesionCarga } from '@/components/operaciones/sesion-carga';
import { ResultadoCarga } from '@/components/operaciones/resultado-carga';
import { BuscadorClienteCarga } from '@/components/operaciones/buscador-cliente-carga';
import { cn } from '@/lib/utils';

/** Primary flat button classes (φ-consistent: rounded-lg, one-step darker hover). */
const BTN_PRIMARY =
  'w-full rounded-lg bg-marca px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-marca/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-fill-disabled disabled:text-text-disabled';

/** Input classes for the manual code entry field. */
const INPUT_CLS =
  'rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-text-primary';

/**
 * ModalRecibirBotellon — the camera-less batch flow as a modal over the
 * Central de Operaciones queue (no navigation: the operator keeps working on
 * the dashboard; the queue updates via realtime behind the overlay).
 *
 * Shares the exact session logic with the /recargas/carga terminal via
 * `useSesionCarga` + `<SesionCarga/>`: digits-only manual entry (BOT- prefix
 * implied), per-row pre-filled destinations with the recarga chooser, a single
 * confirm that posts one `registrarOperacion` call PER destino group with
 * fecha/hora computed at submit time, and a shared `<ResultadoCarga/>` view.
 * The ONLY difference from the terminal is that the modal has no camera.
 *
 * Fixed overlay (scanner-modal pattern): `fixed inset-0 z-[60] bg-black/70`,
 * `max-w-md rounded-2xl`, click-outside + Escape close. Success renders the
 * shared result view with a "Listo" that closes; a failed attempt shows the
 * per-row reasons with a "Seguir editando" way back. Tokens only.
 */
export function ModalRecibirBotellon({ onClose }: { onClose: () => void }) {
  const { items, flashId, agregar, setDestino, quitar, confirmar } = useSesionCarga();
  // Manual digits-only entry (BOT- prefix implied).
  const [codigoManual, setCodigoManual] = useState('');
  const [errorManual, setErrorManual] = useState<string | null>(null);
  // Local pending state for the async confirm (one call per destino group).
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<CargaState[] | null>(null);

  // Escape closes the modal (keyboard affordance, same as the scanner modal).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function onManualChange(e: ChangeEvent<HTMLInputElement>) {
    // Digits only; tolerates pasted full codes like "BOT-00045".
    setCodigoManual(e.target.value.replace(/\D/g, ''));
  }

  async function manejarIngresoManual() {
    const digits = codigoManual.trim();
    if (digits === '') return;
    const botellon = await getBotellonByCodigo(`BOT-${digits}`);
    if (!botellon) {
      setErrorManual('Botellón no encontrado');
      return;
    }
    setErrorManual(null);
    setCodigoManual('');
    await agregar(botellon);
  }

  async function manejarConfirmar() {
    if (confirmando) return;
    setConfirmando(true);
    try {
      setResultado(await confirmar());
    } finally {
      setConfirmando(false);
    }
  }

  const accionables = items.filter((i) => i.destino !== null);
  const canConfirmar = accionables.length > 0 && !confirmando;
  const enSesion = new Set(items.map((i) => i.id));

  let cuerpo: ReactNode;

  if (resultado) {
    cuerpo = (
      <ResultadoCarga
        resultado={resultado}
        items={items}
        onListo={onClose}
        onSeguirEditando={() => setResultado(null)}
      />
    );
  } else {
    cuerpo = (
      <div className="space-y-4">
        {/* Manual code entry — camera-less fallback. Digits only; the BOT- prefix
            is implied and rendered as a visible label. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void manejarIngresoManual();
          }}
        >
          <label
            htmlFor="modal-recibir-codigo"
            className="text-sm font-medium text-text-primary"
          >
            ¿Sin cámara? Ingresá el código manualmente
          </label>
          <div className="mt-1 flex gap-2">
            <div
              className={cn('flex min-w-0 flex-1 items-center', INPUT_CLS)}
            >
              <span className="pr-1 font-mono text-sm text-text-muted">BOT-</span>
              <input
                id="modal-recibir-codigo"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="00000"
                value={codigoManual}
                onChange={onManualChange}
                className="w-full min-w-0 bg-transparent font-mono text-sm text-text-primary outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={codigoManual === '' || confirmando}
              className="shrink-0 rounded-lg bg-marca px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-marca/90 disabled:cursor-not-allowed disabled:bg-fill-disabled disabled:text-text-disabled"
            >
              Agregar a la sesión
            </button>
          </div>
          {errorManual && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorManual}</p>
          )}
        </form>

        {/* Client search — alternative path to the digits-only entry; adds the
            chosen client's bottles to the SAME session (dedupe + flash via
            the hook). */}
        <BuscadorClienteCarga onAgregar={agregar} enSesion={enSesion} />

        {/* Session */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Sesión ({items.length})
          </h3>
          <SesionCarga items={items} flashId={flashId} onSetDestino={setDestino} onQuitar={quitar} />
        </div>

        {/* Confirm */}
        <button
          type="button"
          onClick={() => void manejarConfirmar()}
          disabled={!canConfirmar}
          className={BTN_PRIMARY}
        >
          {confirmando ? 'Confirmando…' : `Confirmar (${accionables.length} botellones)`}
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recibir botellón"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface-1 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-strong px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Recibir botellón</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{cuerpo}</div>
      </div>
    </div>
  );
}