'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { comprimirImagen, validarImagen, MAX_LADO } from '@/lib/client/imagen';

interface Props {
  value: Blob[];
  onChange: (blobs: Blob[]) => void;
  initialFotos?: string[];
}

/**
 * Subida opcional de fotos de fachada con compresión CLIENT-SIDE.
 * Cada foto se comprime a JPEG (máx 1280px, calidad 0.7) para mantener el
 * storage del plan free bajo. Los blobs comprimidos se exponen vía `value`
 * (controlado por el padre) para que el form los envíe en lugar de los
 * originales del `<input type="file">`.
 *
 * `initialFotos` son URLs públicas de fotos ya subidas (uso futuro en edición);
 * se muestran como thumbnails pero no se re-suben.
 */
export function FachadaUploader({ value, onChange, initialFotos = [] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comprimiendo, setComprimiendo] = useState(false);

  useEffect(() => {
    return () => {
      for (const u of urlsRef.current) URL.revokeObjectURL(u);
    };
  }, []);

  async function handleFiles(files: File[]) {
    const nuevos: Blob[] = [];
    const nuevasUrls: string[] = [];
    let algunError = false;

    for (const f of files) {
      const mensaje = validarImagen(f);
      if (mensaje) {
        setError(mensaje);
        algunError = true;
        continue;
      }
      try {
        setComprimiendo(true);
        const blob = await comprimirImagen(f);
        nuevos.push(blob);
        nuevasUrls.push(URL.createObjectURL(blob));
      } catch {
        setError('No se pudo comprimir una de las fotos.');
        algunError = true;
      }
    }
    setComprimiendo(false);

    if (nuevos.length > 0) {
      const siguientes = [...urlsRef.current, ...nuevasUrls];
      urlsRef.current = siguientes;
      setUrls(siguientes);
      onChange([...value, ...nuevos]);
      if (!algunError) setError(null);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    handleFiles(files);
    e.target.value = '';
  }

  function quitar(i: number) {
    URL.revokeObjectURL(urlsRef.current[i]);
    const siguientes = urlsRef.current.filter((_, j) => j !== i);
    urlsRef.current = siguientes;
    setUrls(siguientes);
    onChange(value.filter((_, j) => j !== i));
  }

  function quitarTodas() {
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current = [];
    setUrls([]);
    onChange([]);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        name="fotos"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleChange}
        className="block w-full text-sm text-zinc-500 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
      />
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Las fotos se comprimen automáticamente (máx {MAX_LADO}px) para que no ocupen espacio de más.
      </p>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {comprimiendo && <p className="text-xs text-zinc-400">Comprimiendo fotos…</p>}

      {value.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500">
              Fotos a subir ({value.length})
            </p>
            <button
              type="button"
              onClick={quitarTodas}
              className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
            >
              Quitar todas
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {urls.map((u, i) => (
              <div
                key={u}
                className="relative overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
              >
                <img
                  src={u}
                  alt={`Fachada ${i + 1}`}
                  className="aspect-square w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  aria-label={`Quitar foto ${i + 1}`}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-zinc-900/70 text-xs text-white hover:bg-zinc-900"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {initialFotos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500">Fotos existentes</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {initialFotos.map((u) => (
              <div
                key={u}
                className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
              >
                <img src={u} alt="Foto existente" className="aspect-square w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}