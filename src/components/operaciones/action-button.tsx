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
 * and stays non-interactive. Standalone cva: shadcn `buttonVariants`
 * disables with opacity-50, which conflicts with the locked disabled tokens.
 * Tokens only — no hex literals.
 */
const actionButtonVariants = cva(
  'inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors',
  {
    variants: {
      disabled: {
        true: 'bg-fill-disabled text-text-disabled',
        false: 'bg-marca text-white',
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