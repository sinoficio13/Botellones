'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

const INPUT_CLASS =
  'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50';

/**
 * Input de WhatsApp con selector de país. Es un combobox custom (el `<select>`
 * nativo no renderiza el SVG inline de la bandera en el dropdown): el trigger
 * muestra bandera + nombre + código, y la lista desplegable una fila por país.
 * La opción "Otro" revela un input para el código de país. El componente es
 * no-controlado (funciona dentro del form nativo): expone `whatsapp` (número
 * nacional) y un hidden `pais_whatsapp` con el código internacional (ej: "58",
 * "57", "1" o el código custom de "Otro").
 * Sin props se comporta como el form de creación; `paisInicial`/`numeroInicial`/
 * `codigoOtroInicial` permiten precargar un número existente (form de edición).
 */
export function InputWhatsapp({
  paisInicial,
  numeroInicial,
  codigoOtroInicial,
}: {
  paisInicial?: string;
  numeroInicial?: string;
  codigoOtroInicial?: string;
}) {
  const [pais, setPais] = useState(() =>
    PAISES.some((p) => p.codigo === (paisInicial ?? '')) ? (paisInicial as string) : '58'
  );
  const [codigoOtro, setCodigoOtro] = useState(codigoOtroInicial ?? '');
  const [abierto, setAbierto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const codigoPais = pais === 'otro' ? codigoOtro : pais;
  const seleccionado = PAISES.find((p) => p.codigo === pais) ?? PAISES[0];

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

  function seleccionar(codigo: string) {
    setPais(codigo);
    setAbierto(false);
  }

  return (
    <div>
      <label htmlFor="whatsapp" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        WhatsApp
      </label>
      <div className="mt-1 flex gap-2">
        <div ref={rootRef} className="relative w-40 shrink-0">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={abierto}
            aria-controls="pais-listbox"
            onClick={() => setAbierto((v) => !v)}
            className={`${INPUT_CLASS} flex w-full items-center justify-between gap-1.5 text-left`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {seleccionado.flag}
              <span className="truncate">
                {seleccionado.codigo === 'otro'
                  ? `Otro${codigoOtro ? ` +${codigoOtro}` : ''}`
                  : `${seleccionado.nombre} +${seleccionado.codigo}`}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
            />
          </button>

          {abierto && (
            <ul
              id="pais-listbox"
              role="listbox"
              aria-label="País del número de WhatsApp"
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              {PAISES.map((p) => (
                <li
                  key={p.codigo}
                  role="option"
                  aria-selected={p.codigo === pais}
                  onClick={() => seleccionar(p.codigo)}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {p.flag}
                  <span>
                    {p.nombre}
                    {p.codigo !== 'otro' && ` (+${p.codigo})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          placeholder={pais === '58' ? '0412…' : 'Número nacional'}
          minLength={7}
          maxLength={15}
          pattern="[0-9]{7,15}"
          title="Solo dígitos, entre 7 y 15"
          defaultValue={numeroInicial ?? ''}
          className={`${INPUT_CLASS} min-w-0 flex-1`}
        />
      </div>

      {pais === 'otro' && (
        <div className="mt-2">
          <input
            value={codigoOtro}
            onChange={(e) => setCodigoOtro(e.target.value.replace(/\D/g, ''))}
            placeholder="Código del país, ej: 44"
            inputMode="numeric"
            className={`${INPUT_CLASS} w-full max-w-xs`}
          />
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Código internacional sin el «+», ej: 44 para Reino Unido.
          </p>
        </div>
      )}

      <input type="hidden" name="pais_whatsapp" value={codigoPais} />
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        La comunicación es por WhatsApp. El número se guarda en formato internacional.
      </p>
    </div>
  );
}

// ── Banderas inline SVG (tricolor simplificado; Windows no renderiza emojis) ──

function FlagVE() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className="inline-block h-3 w-4 rounded-[1px]">
      <rect width="18" height="4" fill="#fcd116" />
      <rect y="4" width="18" height="4" fill="#003893" />
      <rect y="8" width="18" height="4" fill="#ce1126" />
    </svg>
  );
}

function FlagCO() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className="inline-block h-3 w-4 rounded-[1px]">
      <rect width="18" height="6" fill="#fcd116" />
      <rect y="6" width="18" height="3" fill="#003893" />
      <rect y="9" width="18" height="3" fill="#ce1126" />
    </svg>
  );
}

function FlagES() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className="inline-block h-3 w-4 rounded-[1px]">
      <rect width="18" height="2" fill="#aa151b" />
      <rect y="2" width="18" height="8" fill="#f1bf00" />
      <rect y="10" width="18" height="2" fill="#aa151b" />
    </svg>
  );
}

function FlagUS() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className="inline-block h-3 w-4 rounded-[1px]">
      <rect width="18" height="12" fill="#ffffff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 12) / 13} width="18" height="0.92" fill="#b22234" />
      ))}
      <rect width="7.2" height="6.5" fill="#3c3b6e" />
    </svg>
  );
}

function FlagMX() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className="inline-block h-3 w-4 rounded-[1px]">
      <rect width="6" height="12" fill="#006847" />
      <rect x="6" width="6" height="12" fill="#ffffff" />
      <rect x="12" width="6" height="12" fill="#ce1126" />
    </svg>
  );
}

function FlagAR() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className="inline-block h-3 w-4 rounded-[1px]">
      <rect width="18" height="4" fill="#74acdf" />
      <rect y="4" width="18" height="4" fill="#ffffff" />
      <rect y="8" width="18" height="4" fill="#74acdf" />
    </svg>
  );
}

function FlagOtro() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className="inline-block h-3 w-4 rounded-[1px]">
      <rect width="18" height="12" fill="#d4d4d8" />
    </svg>
  );
}

const PAISES: Array<{ codigo: string; nombre: string; flag: ReactNode }> = [
  { codigo: '58', nombre: 'Venezuela', flag: <FlagVE /> },
  { codigo: '57', nombre: 'Colombia', flag: <FlagCO /> },
  { codigo: '34', nombre: 'España', flag: <FlagES /> },
  { codigo: '1', nombre: 'Estados Unidos', flag: <FlagUS /> },
  { codigo: '52', nombre: 'México', flag: <FlagMX /> },
  { codigo: '54', nombre: 'Argentina', flag: <FlagAR /> },
  { codigo: 'otro', nombre: 'Otro', flag: <FlagOtro /> },
];