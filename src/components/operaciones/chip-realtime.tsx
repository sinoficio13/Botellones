'use client';

export type ChipRealtimeProps = {
  cantidad: number;
  onAplicar: () => void;
};

/**
 * ChipRealtime — chip flotante "↑ N botellones nuevos" (REQ-COS-27, design
 * D4). Sticky bajo las tabs; el copy mantiene el plural para N=1 (contrato
 * §7.5). Tapping it applies the queued changes (`aplicarPendientes`); renders
 * nothing when there is nothing queued. Tokens only, no hex.
 */
export function ChipRealtime({ cantidad, onAplicar }: ChipRealtimeProps) {
  if (cantidad <= 0) return null;
  return (
    <button
      type="button"
      data-testid="chip-realtime"
      onClick={onAplicar}
      className="sticky top-11 z-10 mx-auto mt-2 flex min-h-11 items-center gap-1 rounded-full bg-marca px-4 text-sm font-medium text-white shadow-md"
    >
      ↑ {cantidad} botellones nuevos
    </button>
  );
}