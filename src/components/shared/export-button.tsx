'use client';

import { useState, useCallback, useTransition } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import type { ExportResult } from '@/lib/export/types';

type ExportButtonProps = {
  onClick: () => Promise<ExportResult>;
  label?: string;
  icon?: 'pdf' | 'excel';
};

export function ExportButton({ onClick, label, icon = 'pdf' }: ExportButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const busy = isPending || isLoading;

  const handleClick = useCallback(() => {
    if (busy) return;

    setIsLoading(true);
    startTransition(async () => {
      try {
        const result = await onClick();

        // Convert base64 to Blob and trigger download
        const mime =
          result.filename.endsWith('.xlsx')
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf';
        const byteChars = atob(result.base64);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNums[i] = byteChars.charCodeAt(i);
        }
        const byteArr = new Uint8Array(byteNums);
        const blob = new Blob([byteArr], { type: mime });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export failed:', err);
      } finally {
        setIsLoading(false);
      }
    });
  }, [busy, onClick]);

  const displayLabel = label || (icon === 'excel' ? 'Excel' : 'PDF');

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <FileDown size={14} />
      )}
      {displayLabel}
    </button>
  );
}
