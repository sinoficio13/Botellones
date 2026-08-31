'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { getClientesForSearch } from '@/lib/db/recargas';
import { getBotellonesCliente } from '@/lib/db/botellones';
import { ESTADO_LABELS } from '@/lib/utils/estados';

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;
/** Estados whose bottles can be added to the batch session in this flow. */
const ESTADOS_ACCIONABLES = new Set(['entregado', 'recibido', 'recarga', 'listo', 'delivery']);

/** A botellon the operator adds to the session from the client search. */
export type BotellonCargaBuscador = {
  id: string;
  codigo: string;
  cliente_id: string | null;
  estado: string | null;
};

export type BuscadorClienteCargaProps = {
  onAgregar: (b: BotellonCargaBuscador) => Promise<boolean> | void;
  /** Ids already in the session — those bottles render as "Agregado". */
  enSesion: Set<string>;
};

type ClienteBusqueda = {
  id: string;
  nombre: string;
  codigo: string;
  telefono_1: string | null;
};

type BotellonFila = { id: string; codigo: string; estado: string };

/**
 * BuscadorClienteCarga — alternative path to the digits-only manual entry of
 * the batch flows: search a client by name/code/phone and add THAT client's
 * bottles to the shared session (avoids typos; you pick the right bottle).
 *
 * Search state is render-gated by the query that produced it (same pattern as
 * the queue Buscador): while a newer query is in flight — or below the 2-char
 * minimum — the previous bucket set is hidden, so no stale flash and no
 * synchronous setState in the effect. Expanding a client fetches its bottles
 * (all estados) and filters client-side to the actionable ones for this flow.
 */
export function BuscadorClienteCarga({ onAgregar, enSesion }: BuscadorClienteCargaProps) {
  const [termino, setTermino] = useState('');
  const [resultado, setResultado] = useState<{ q: string; clientes: ClienteBusqueda[] } | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [botellones, setBotellones] = useState<{ clienteId: string; filas: BotellonFila[] } | null>(null);
  // Transient hint when an add is blocked (e.g. a confirm is in flight): the
  // "+ Agregar" click is swallowed by the modal gate, so the operator needs to
  // know the entry was NOT silently dropped.
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function mostrarAviso(msg: string) {
    setAviso(msg);
    if (avisoTimeoutRef.current) clearTimeout(avisoTimeoutRef.current);
    avisoTimeoutRef.current = setTimeout(() => setAviso(null), 1500);
  }

  const debounced = useDebounce(termino, DEBOUNCE_MS);
  const terminoLimpio = debounced.trim();
  const valido = terminoLimpio.length >= MIN_QUERY;

  // Render-gated (derived): below-min clears at once, in-flight keeps old
  // buckets hidden, and only the data for the current client is shown.
  const clientesActuales = valido && resultado?.q === terminoLimpio ? resultado.clientes : null;
  const buscandoClientes = valido && resultado?.q !== terminoLimpio;
  const botellonesActuales =
    expandido && botellones?.clienteId === expandido ? botellones.filas : null;
  const buscandoBotellones = expandido !== null && botellones?.clienteId !== expandido;

  useEffect(() => {
    if (!valido) return;
    let activo = true;
    getClientesForSearch(terminoLimpio).then((clientes) => {
      if (activo) setResultado({ q: terminoLimpio, clientes });
    });
    return () => {
      activo = false;
    };
  }, [terminoLimpio, valido]);

  useEffect(() => {
    if (!expandido) return;
    let activo = true;
    getBotellonesCliente(expandido).then((res) => {
      if (activo) setBotellones({ clienteId: expandido, filas: res.botellones });
    });
    return () => {
      activo = false;
    };
  }, [expandido]);

  // Clear the transient hint timeout on unmount.
  useEffect(() => {
    return () => {
      if (avisoTimeoutRef.current) clearTimeout(avisoTimeoutRef.current);
    };
  }, []);

  const accionables = botellonesActuales?.filter((b) => ESTADOS_ACCIONABLES.has(b.estado)) ?? [];

  return (
    <section aria-label="Buscar por cliente">
      <label htmlFor="buscar-cliente-carga" className="text-sm font-medium text-text-primary">
        o buscá por cliente:
      </label>
      <input
        id="buscar-cliente-carga"
        type="search"
        autoComplete="off"
        placeholder="Nombre, código o teléfono"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-marca"
      />

      {buscandoClientes ? (
        <p role="status" className="mt-2 text-sm text-text-muted">
          Buscando…
        </p>
      ) : clientesActuales ? (
        clientesActuales.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">Sin resultados</p>
        ) : (
          <ul className="mt-2 divide-y divide-border-strong rounded-lg border border-border-strong bg-surface-1">
            {clientesActuales.map((c) => {
              const esExpandido = expandido === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-expanded={esExpandido}
                    onClick={() => setExpandido((prev) => (prev === c.id ? null : c.id))}
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text-primary">{c.nombre}</span>
                      <span className="block font-mono text-xs text-text-muted">{c.codigo}</span>
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">{c.telefono_1 ?? ''}</span>
                  </button>
                  {esExpandido ? (
                    <div className="border-t border-border-strong bg-surface-2 px-3 py-2">
                      {buscandoBotellones ? (
                        <p role="status" className="text-sm text-text-muted">
                          Cargando botellones…
                        </p>
                      ) : accionables.length === 0 ? (
                        <p className="text-sm text-text-muted">Sin botellones accionables.</p>
                      ) : (
                        <ul className="divide-y divide-border-strong rounded-md border border-border-strong bg-surface-1">
                          {accionables.map((b) => {
                            const yaEnSesion = enSesion.has(b.id);
                            return (
                              <li
                                key={b.id}
                                className="flex min-h-11 items-center justify-between gap-3 px-3"
                              >
                                <span className="min-w-0">
                                  <span className="block font-mono text-sm tabular-nums text-text-primary">
                                    {b.codigo}
                                  </span>
                                  <span className="block text-xs text-text-muted">
                                    {ESTADO_LABELS[b.estado] ?? b.estado}
                                  </span>
                                </span>
                                {yaEnSesion ? (
                                  <span className="shrink-0 text-xs font-medium text-text-muted">
                                    Agregado
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const ok = await onAgregar({
                                        id: b.id,
                                        codigo: b.codigo,
                                        cliente_id: c.id,
                                        estado: b.estado,
                                      });
                                      if (ok === false) {
                                        mostrarAviso('Confirmando… esperá un momento');
                                      }
                                    }}
                                    className="shrink-0 rounded-md border border-border-strong bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-1"
                                  >
                                    + Agregar
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {aviso && (
                        <p role="status" className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                          {aviso}
                        </p>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </section>
  );
}