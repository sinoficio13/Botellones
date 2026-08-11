"use client";

import { useEffect } from "react";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root-level error boundary for pages outside route groups
 * (e.g., auth pages).
 */
export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error("Root error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="max-w-md space-y-4 text-center">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Something went wrong
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {error.message || "An unexpected error occurred."}
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
