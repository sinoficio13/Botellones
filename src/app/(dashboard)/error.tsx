"use client";

import { useEffect } from "react";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Dashboard route group error boundary. Catches errors in any
 * dashboard page and shows a recovery UI with a retry button.
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="max-w-md space-y-4 text-center">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Something went wrong
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
