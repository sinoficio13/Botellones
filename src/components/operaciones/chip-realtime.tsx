'use client';

export type ChipRealtimeProps = {
  cantidad: number;
  onAplicar: () => void;
};

/**
 * ChipRealtime — chip flotante de cambios pendientes (REQ-COS-27, design D4).
 * Aparece SOLO mientras el operador scrollea (gate scroll-only): los cambios
 * realtime se encolan para no reordenar la lista bajo el dedo. El copy explica
 * el significado y la acción: "↑ N cambios nuevos — tocar para actualizar".
 * Singular/plural correcto para N=1. Renders nothing when nothing is queued.
 * Tokens only, no hex.
 */
export function ChipRealtime({ cantidad, onAplicar }: ChipRealtimeProps) {
  if (cantidad <= 0) return null;
  const texto = cantidad === 1 ? '1 cambio nuevo' : `${cantidad} cambios nuevos`;
  return (
    <button
      type="button"
      data-testid="chip-realtime"
      onClick={onAplicar}
      className="sticky top-11 z-10 mx-auto mt-2 flex min-h-11 items-center gap-1 rounded-full bg-marca px-4 text-sm font-medium text-white shadow-md"
    >
      ↑ {texto} — tocar para actualizar
    </button>
  );
}