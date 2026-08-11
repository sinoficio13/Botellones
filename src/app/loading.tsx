/**
 * Root-level loading state. Used by auth routes and any page
 * outside the dashboard route group.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-400" />
    </div>
  );
}
