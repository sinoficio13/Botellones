'use client';

import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { buscarColaOperaciones, type ResultadoBusqueda } from '@/lib/db/botellones';
import type { ColaBotellon } from '@/lib/db/botellones';

/**
 * Buscador — REQ-COS-20. Queue header search: 250ms debounce reusing
 * `use-debounce` (never forked), min-2 gate (a single character never
 * searches), server-side parallel search grouped by Nombre / Cédula / Código.
 *
 * State is keyed by the query that produced it: while a newer query is in
 * flight (or below the minimum), the previous bucket set is render-gated out —
 * no stale flash, no synchronous setState in the effect
 * (react-hooks/set-state-in-effect). Clearing the input clears the results.
 */

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

type EstadoBusqueda =
  | { q: string; datos: ResultadoBusqueda }
  | { q: string; error: string };

export function Buscador() {
  const [termino, setTermino] = useState('');
  const [estado, setEstado] = useState<EstadoBusqueda | null>(null);

  const debounced = useDebounce(termino, DEBOUNCE_MS);
  const terminoLimpio = debounced.trim();
  const valido = terminoLimpio.length >= MIN_QUERY;

  // Render-gated (derived): below the minimum the results disappear at once;
  // while the search for the CURRENT term hasn't resolved, the old buckets
  // stay hidden instead of flashing stale data.
  const actual = valido && estado?.q === terminoLimpio ? estado : null;
  const buscando = valido && estado?.q !== terminoLimpio;

  useEffect(() => {
    if (!valido) return;
    let activo = true;
    buscarColaOperaciones(terminoLimpio)
      .then((datos) => {
        if (activo) setEstado({ q: terminoLimpio, datos });
      })
      .catch(() => {
        if (activo) setEstado({ q: terminoLimpio, error: 'Error al buscar. Reintentá.' });
      });
    return () => {
      activo = false;
    };
  }, [terminoLimpio, valido]);

  return (
    <div className="border-b border-border-strong bg-surface-1 px-4 py-3">
      <input
        type="search"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder="Buscar por nombre, cédula o código"
        aria-label="Buscar en la cola"
        className="min-h-11 w-full rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-marca"
      />
      {buscando ? (
        <p role="status" className="mt-2 text-sm text-text-muted">
          Buscando…
        </p>
      ) : actual && 'error' in actual ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {actual.error}
        </p>
      ) : actual && 'datos' in actual ? (
        <Resultados datos={actual.datos} q={terminoLimpio} />
      ) : null}
    </div>
  );
}

function Resultados({ datos, q }: { datos: ResultadoBusqueda; q: string }) {
  const { porNombre, porCedula, porCodigo } = datos;
  const total = porNombre.length + porCedula.length + porCodigo.length;

  if (total === 0) {
    return <p className="mt-2 text-sm text-text-muted">Sin resultados para «{q}»</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {porNombre.length > 0 ? (
        <SeccionResultados titulo="Nombre" ariaLabel="Resultados por nombre" items={porNombre} />
      ) : null}
      {porCedula.length > 0 ? (
        <SeccionResultados titulo="Cédula" ariaLabel="Resultados por cédula" items={porCedula} conCedula />
      ) : null}
      {porCodigo.length > 0 ? (
        <SeccionResultados titulo="Código" ariaLabel="Resultados por código" items={porCodigo} />
      ) : null}
    </div>
  );
}

function SeccionResultados({
  titulo,
  ariaLabel,
  items,
  conCedula,
}: {
  titulo: string;
  ariaLabel: string;
  items: ColaBotellon[];
  conCedula?: boolean;
}) {
  return (
    <section aria-label={ariaLabel}>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{titulo}</h3>
      <ul className="divide-y divide-border-strong rounded-md border border-border-strong bg-surface-1">
        {items.map((b) => (
          <Item key={b.id} b={b} conCedula={conCedula} />
        ))}
      </ul>
    </section>
  );
}

function Item({ b, conCedula }: { b: ColaBotellon; conCedula?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="min-w-0">
        <span className="block truncate text-sm text-text-primary">{b.clientes?.nombre ?? 'Cliente'}</span>
        {conCedula ? (
          <span className="block font-mono text-xs text-text-muted">{b.clientes.cedula ?? '—'}</span>
        ) : null}
      </span>
      <span className="shrink-0 font-mono text-xs text-text-muted">{b.codigo}</span>
    </li>
  );
}