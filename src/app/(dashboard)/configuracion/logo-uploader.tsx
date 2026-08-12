'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import NextImage from 'next/image';

type PreviewCtx = 'header' | 'pdf' | 'qr';

const PREVIEWS: { key: PreviewCtx; label: string; width: number; height: number }[] = [
  { key: 'header', label: 'Header (40px alto)', width: 160, height: 40 },
  { key: 'pdf', label: 'PDF (80px alto)', width: 320, height: 80 },
  { key: 'qr', label: 'Etiqueta QR (200px)', width: 200, height: 200 },
];

const MAX_SIZE_SVG = 200 * 1024; // 200KB
const MAX_SIZE_PNG = 500 * 1024; // 500KB
const MIN_PNG_DIM = 400; // min width for PNG

/**
 * Logo uploader with file validation and multi-context preview.
 * In dev mode, stores as data URL in the form.
 * In production, uploads to Supabase Storage (logos bucket).
 */
export function LogoUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<PreviewCtx>('header');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    setWarning(null);

    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }

    // Validate type
    if (!['image/svg+xml', 'image/png'].includes(f.type)) {
      setError('Solo se aceptan archivos SVG o PNG.');
      return;
    }

    // Validate size
    const maxSize = f.type === 'image/svg+xml' ? MAX_SIZE_SVG : MAX_SIZE_PNG;
    if (f.size > maxSize) {
      const kb = (maxSize / 1024).toFixed(0);
      setError(`El archivo excede el tamaño máximo (${kb} KB).`);
      return;
    }

    const url = URL.createObjectURL(f);

    // Validate PNG dimensions
    if (f.type === 'image/png') {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth < MIN_PNG_DIM || img.naturalHeight < MIN_PNG_DIM) {
          setError(`El PNG debe tener al menos ${MIN_PNG_DIM}px de ancho y alto.`);
          URL.revokeObjectURL(url);
          return;
        }
        // Check aspect ratio
        if (img.naturalWidth / img.naturalHeight < 1.5) {
          setWarning(
            'El logo no es horizontal. Se recomienda una relación de aspecto 4:1 o similar.'
          );
        }
        setFile(f);
        setPreview(url);
      };
      img.src = url;
    } else {
      setFile(f);
      setPreview(url);
    }
  }

  function removeLogo() {
    setFile(null);
    setPreview(null);
    setError(null);
    setWarning(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Logo del negocio
      </label>

      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        name="logo"
        accept="image/svg+xml,image/png"
        onChange={handleFileChange}
        className="block w-full text-sm text-zinc-500 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
      />

      {/* Validation messages */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {warning && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{warning}</p>
      )}

      {/* Preview tabs */}
      {preview && (
        <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {PREVIEWS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setActivePreview(p.key)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    activePreview === p.key
                      ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={removeLogo}
              className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
            >
              Quitar
            </button>
          </div>

          {/* Preview canvas */}
          {PREVIEWS.map(
            (p) =>
              activePreview === p.key && (
                <div
                  key={p.key}
                  className="relative flex items-center justify-center rounded border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                  style={{ height: p.height + 8 }}
                >
                  <NextImage
                    src={preview}
                    alt="Logo preview"
                    fill
                    unoptimized
                    className="object-contain"
                    style={{
                      maxWidth: p.width,
                      maxHeight: p.height,
                    }}
                  />
                </div>
              )
          )}
        </div>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        SVG (máx 200 KB) o PNG (máx 500 KB, min 400×400px). Recomendado: 400×100 horizontal.
      </p>

      {/* Hidden field: base64 logo data for form submission (dev mode) */}
      {file && (
        <input type="hidden" name="logo_data_url" value={preview || ''} />
      )}
    </div>
  );
}
