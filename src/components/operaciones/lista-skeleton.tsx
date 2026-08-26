import { Skeleton } from '@/components/operaciones/skeleton';

/**
 * ListaSkeleton — queue loading placeholder (REQ-COS-21: loading is a
 * skeleton shimmer, never a spinner). Reuses the fase-2 Skeleton primitive
 * (REQ-COS-13) to compose `cantidad` card-shaped placeholders.
 */
export function ListaSkeleton({ cantidad = 3 }: { cantidad?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-md border border-border-strong p-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}