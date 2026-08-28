'use client';

import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

export type ActionButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
  onClick?: () => void;
  className?: string;
};

/**
 * ActionButton — primary action primitive (REQ-COS-11).
 * Always `--marca` in every estado and both modes; 44px touch target.
 * Disabled uses `--fill-disabled`/`--text-disabled` tokens (never opacity)
 * and stays non-interactive. Flat modern primary: rounded-lg, one-step darker
 * hover (bg-marca/90), 2px focus ring — no gradient/shadow/glow.
 * Standalone cva: shadcn `buttonVariants` disables with opacity-50, which
 * conflicts with the locked disabled tokens. Tokens only — no hex literals.
 */
const actionButtonVariants = cva(
  'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/60 focus-visible:ring-offset-2',
  {
    variants: {
      disabled: {
        true: 'cursor-not-allowed bg-fill-disabled text-text-disabled',
        false: 'bg-marca text-white hover:bg-marca/90',
      },
    },
    defaultVariants: {
      disabled: false,
    },
  }
);

export function ActionButton({
  children,
  disabled,
  onClick,
  className,
  'aria-label': ariaLabel,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(actionButtonVariants({ disabled: disabled ?? false }), className)}
    >
      {children}
    </button>
  );
}