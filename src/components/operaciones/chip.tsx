'use client';

import { cn } from '@/lib/utils';

export type ChipProps = {
  label: string;
  pressed: boolean;
  onToggle: (next: boolean) => void;
  className?: string;
};

/**
 * Chip — individual toggle button (REQ-COS-10).
 * Controlled: the caller owns the pressed state and receives the next value
 * through `onToggle`. Mono font for bottle codes / cédulas, 44px touch target,
 * tokens only (no hex).
 */
export function Chip({ label, pressed, onToggle, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onToggle(!pressed)}
      className={cn(
        'font-mono min-h-11 rounded-md border px-2.5 text-sm tabular-nums transition-colors',
        pressed
          ? 'border-marca bg-marca text-white'
          : 'border-border-strong bg-surface-2 text-text-secondary hover:bg-surface-3',
        className
      )}
    >
      {label}
    </button>
  );
}