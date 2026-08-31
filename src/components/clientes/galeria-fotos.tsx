'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export type FotoGaleria = { id: string; url: string };

export function GaleriaFotos({
  fotos,
  indiceInicial,
  onClose,
}: {
  fotos: FotoGaleria[];
  indiceInicial: number;
  onClose: () => void;
}) {
  const [indice, setIndice] = useState(indiceInicial);
  const total = fotos.length;

  const navegar = useCallback(
    (paso: number) => {
      setIndice((i) => Math.min(total - 1, Math.max(0, i + paso)));
    },
    [total]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') navegar(-1);
      if (e.key === 'ArrowRight') navegar(1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navegar, onClose]);

  const actual = fotos[indice];
  if (!actual) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative flex max-w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={actual.url}
          alt={`Foto de fachada ${indice + 1}`}
          className="max-h-[80vh] max-w-full rounded-md object-contain"
        />

        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          {indice + 1} / {total}
        </span>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute -top-2 -right-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
        >
          <X size={20} />
        </button>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => navegar(-1)}
              disabled={indice === 0}
              aria-label="Anterior"
              className="absolute left-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80 disabled:cursor-default disabled:opacity-30"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              type="button"
              onClick={() => navegar(1)}
              disabled={indice === total - 1}
              aria-label="Siguiente"
              className="absolute right-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80 disabled:cursor-default disabled:opacity-30"
            >
              <ChevronRight size={28} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}