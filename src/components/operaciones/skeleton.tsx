import { cn } from '@/lib/utils';

export type SkeletonProps = {
  className?: string;
};

/**
 * Skeleton — shimmer placeholder (REQ-COS-13).
 * Loops the `shimmer` animation (1.5s, defined in globals.css `--animate-shimmer`)
 * over a surface-2 → surface-3 gradient. Never a spinner, text, or icon.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer motion-reduce:animate-none rounded-md bg-[linear-gradient(90deg,var(--surface-2),var(--surface-3),var(--surface-2))] bg-[length:200%_100%]',
        className
      )}
    />
  );
}