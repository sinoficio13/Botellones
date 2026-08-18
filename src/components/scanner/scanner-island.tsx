'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { ScanLine } from 'lucide-react';

// Modal (and the jsqr chunk it imports) is fetched only when the scanner opens.
const ScannerModal = dynamic(
  () => import('./scanner-modal').then((m) => m.ScannerModal),
  { ssr: false }
);

/**
 * Header island: one-tap camera scanner entry point. No role check here —
 * the dashboard proxy gate already restricts access to staff.
 */
export function ScannerIsland() {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label="Escanear QR"
        title="Escanear QR"
      >
        <ScanLine className="h-5 w-5" />
        <span className="hidden md:inline">Escanear QR</span>
      </button>
      {open && <ScannerModal onClose={handleClose} />}
    </>
  );
}