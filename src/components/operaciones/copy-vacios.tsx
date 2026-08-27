import { EmptyState } from '@/components/operaciones/empty-state';
import type { EstadoOperativo } from '@/hooks/useColaOperaciones';

type CopiaVacio = { titulo: string; descripcion: string; accionLabel: string };

/**
 * Per-tab empty-state copy (REQ-COS-21, spec §8.2) — Spanish domain copy.
 * Titles/descriptions/action labels are constants so the Slice E shell can
 * wire the action buttons (Escanear → ScannerModal, Ver X → tab switch).
 * Rendered via the fase-2 EmptyState primitive: icon → title → description
 * → action. Buttons are inert until Slice E wires navigation.
 */
const COPIA: Record<EstadoOperativo, CopiaVacio> = {
  recibido: {
    titulo: 'Nada esperando lavado',
    descripcion: 'Escanéá un botellón para sumarlo a la cola de lavado.',
    accionLabel: '📷 Escanear',
  },
  recarga: {
    titulo: 'Nada llenándose',
    descripcion: 'Pasá botellones desde Recibido para empezar el llenado.',
    accionLabel: 'Ver Recibido',
  },
  listo: {
    titulo: 'Nada listo para salir',
    descripcion: 'Cuando termine la recarga, los botellones listos aparecen acá.',
    accionLabel: 'Ver En recarga',
  },
  delivery: {
    titulo: 'Nada en la calle',
    descripcion: 'Los botellones en delivery aparecen acá hasta que vuelvan entregados.',
    accionLabel: 'Ver Listo',
  },
};

export function VacioPorEstado({
  estado,
  onAccion,
}: {
  estado: EstadoOperativo;
  /** Slice E wiring: recibido → Escanear (scanner), "Ver X" → tab switch. */
  onAccion?: () => void;
}) {
  const { titulo, descripcion, accionLabel } = COPIA[estado];
  return (
    <EmptyState
      title={titulo}
      description={descripcion}
      action={
        <button type="button" onClick={onAccion} className="mt-2 text-sm font-medium text-marca">
          {accionLabel}
        </button>
      }
    />
  );
}

/** First-use total-empty copy (REQ-COS-21, spec §8.3) — actions wired by the shell. */
export const COPIA_VACIO_TOTAL = {
  titulo: 'La cola está vacía',
  descripcion: 'Escanéá un botellón o cargalo manualmente para empezar.',
} as const;