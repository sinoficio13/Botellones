/**
 * Dashboard route group loading state. Renders a skeleton shell
 * matching the dashboard layout (header + content area).
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header skeleton */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <div className="h-8 w-40 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          <div className="ml-auto h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </header>

      {/* Content skeleton */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
