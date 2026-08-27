'use client';

import { useSyncExternalStore } from 'react';

export const TOAST_DURATION_MS = 4500;

export type ToastTone = 'success' | 'error';

export type ToastInput = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone: ToastTone;
};

type ToastState = ToastInput & { id: number };

// Module-level singleton state (design D6): showToast() mutates this store and
// <ToastHost/> observes it via useSyncExternalStore. No context plumbing —
// fase-3 call sites just call showToast().
let toast: ToastState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>(); // W-1: never reassigned -> const
let nextId = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ToastState | null {
  return toast;
}

/**
 * Server snapshot (carried fix, Slice E): the queue shell mounts `<ToastHost />`
 * server-side; without a server snapshot React errors "Missing getServerSnapshot"
 * during SSR. Toasts are client-only — the server always renders none, so the
 * server and the first client render agree (no hydration mismatch).
 */
function getServerSnapshot(): ToastState | null {
  return null;
}

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * showToast — single-instance toast (REQ-COS-12).
 * Replaces any visible toast and restarts the 4.5s auto-dismiss timer.
 * The "Deshacer" action is only rendered for the success tone.
 */
export function showToast(input: ToastInput): void {
  clearTimer();
  toast = { ...input, id: ++nextId };
  emit();
  timer = setTimeout(() => {
    toast = null;
    timer = null;
    emit();
  }, TOAST_DURATION_MS);
}

/**
 * dismissToast — removes the current toast. When an `id` is given it only
 * dismisses the instance carrying that id (R3-001, MOD REQ-COS-12): a toast
 * shown inside an action's `onAction` has a different id and survives the
 * original toast's dismiss. With no id it dismisses whatever is current
 * (module reset / callers without a captured identity).
 */
export function dismissToast(id?: number): void {
  if (toast !== null && (id === undefined || toast.id === id)) {
    clearTimer();
    toast = null;
    emit();
  }
}

/**
 * ToastHost — mounts the single toast instance (REQ-COS-12).
 * Bottom-positioned: 12px lateral inset (`inset-x-3`), 66px above the
 * bottom nav (`bottom-[66px]`, spec §7.2). Container is a polite live
 * region; the action button renders only for success tone.
 */
export function ToastHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (current === null) {
    return null;
  }

  const showAction =
    current.tone === 'success' &&
    current.actionLabel !== undefined &&
    current.onAction !== undefined;

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-3 bottom-[66px] z-50 flex justify-center"
    >
      <div className="pointer-events-auto flex min-h-11 items-center gap-3 rounded-md border border-border-strong bg-surface-1 px-4 py-2 text-sm text-text-primary shadow-lg">
        <span className="min-w-0 flex-1">{current.message}</span>
        {showAction ? (
          <button
            type="button"
            onClick={() => {
              // R3-001: capture the id BEFORE onAction — if onAction shows a
              // new toast, dismissToast(id) only removes the instance that
              // carried this action, leaving the new toast alive.
              const id = current.id;
              current.onAction?.();
              dismissToast(id);
            }}
            className="shrink-0 font-medium text-marca"
          >
            {current.actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}