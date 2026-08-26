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

export function VacioPorEstado({ estado }: { estado: EstadoOperativo }) {
  const { titulo, descripcion, accionLabel } = COPIA[estado];
  return (
    <EmptyState
      title={titulo}
      description={descripcion}
      action={
        <button type="button" className="mt-2 text-sm font-medium text-marca">
          {accionLabel}
        </button>
      }
    />
  );
}