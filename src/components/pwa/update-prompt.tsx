"use client";

import { useEffect, useState, useCallback } from "react";
import { Serwist } from "@serwist/window";

/**
 * UpdatePrompt listens for a new service worker version and displays
 * a toast notification with a refresh button. The user must explicitly
 * accept the update to activate the new SW and reload the page.
 */
export function UpdatePrompt() {
  const [show, setShow] = useState(false);

  const acceptUpdate = useCallback(() => {
    setShow(false);
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
    // Reload after the new SW takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const dismiss = useCallback(() => {
    setShow(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const serwist = new Serwist("/sw.js", { scope: "/", type: "classic" });

    void serwist.register().then(() => {
      serwist.addEventListener("waiting", () => {
        setShow(true);
      });
    }).catch((err: unknown) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[SW] dev mode — skipping', err instanceof Error ? err.message : String(err));
      }
    });
  }, []);

  if (!show) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 md:bottom-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Nueva versión disponible
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={acceptUpdate}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
