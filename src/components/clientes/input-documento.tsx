'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const INPUT_CLASS =
  'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50';

/**
 * Campo de cédula/RIF con selector de tipo de documento. Es un combobox custom
 * (como InputWhatsapp): el trigger muestra la letra del tipo (V, E, J, G, P) y
 * la lista desplegable una fila por tipo. Es no-controlado (funciona dentro
 * del form nativo): expone `cedula` (solo dígitos) y un hidden `tipo_documento`
 * con la letra del tipo elegido. La composición "V-12345678" la hace el server.
 */
export function InputDocumento() {
  const [tipo, setTipo] = useState<TipoDocumento>('V');
  const [abierto, setAbierto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [abierto]);

  const seleccionado = TIPOS_DOCUMENTO.find((t) => t.letra === tipo) ?? TIPOS_DOCUMENTO[0];

  return (
    <div>
      <label htmlFor="cedula" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Tipo de documento
      </label>
      <div className="mt-1 flex gap-2">
        <div ref={rootRef} className="relative w-24 shrink-0">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={abierto}
            aria-controls="tipo-documento-listbox"
            onClick={() => setAbierto((v) => !v)}
            className={`${INPUT_CLASS} flex w-full items-center justify-between gap-1.5 text-left`}
          >
            <span className="font-mono text-sm font-semibold">{seleccionado.letra}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
            />
          </button>

          {abierto && (
            <ul
              id="tipo-documento-listbox"
              role="listbox"
              aria-label="Tipo de documento"
              className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <li
                  key={t.letra}
                  role="option"
                  aria-selected={t.letra === tipo}
                  onClick={() => {
                    setTipo(t.letra);
                    setAbierto(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  title={t.nombre}
                >
                  <span className="font-mono font-semibold">{t.letra}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          id="cedula"
          name="cedula"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="12345678"
          minLength={6}
          maxLength={12}
          pattern="[0-9]{6,12}"
          title="Solo dígitos, entre 6 y 12"
          className={`${INPUT_CLASS} min-w-0 flex-1`}
        />
      </div>

      <input type="hidden" name="tipo_documento" value={tipo} />
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{AYUDA_POR_TIPO[tipo]}</p>
    </div>
  );
}

const TIPOS_DOCUMENTO = [
  { letra: 'V', nombre: 'Venezolano' },
  { letra: 'E', nombre: 'Extranjero' },
  { letra: 'J', nombre: 'Jurídico' },
  { letra: 'G', nombre: 'Gobierno' },
  { letra: 'P', nombre: 'Pasaporte' },
] as const;

type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]['letra'];

const AYUDA_POR_TIPO: Record<TipoDocumento, string> = {
  V: 'Cédula: entre 6 y 8 dígitos',
  E: 'Cédula: entre 6 y 8 dígitos',
  J: 'RIF: entre 8 y 10 dígitos',
  G: 'Entre 6 y 12 dígitos',
  P: 'Entre 6 y 12 dígitos',
};