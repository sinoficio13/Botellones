'use client';

import { useActionState, useState, useEffect } from 'react';
import { updateBotellon, type BotellonWithCliente } from '@/lib/db/botellones';
import { getClientesForSearch } from '@/lib/db/recargas';
import { getCliente } from '@/lib/db/clientes';
import { useDebounce } from '@/hooks/use-debounce';
import {
  type Estado,
  ESTADO_LABELS,
  ESTADO_DOT_COLORS,
  getTransiciones,
  getReversiones,
} from '@/lib/utils/estados';
import { EstadoEnVivo, type EstadoLive } from '@/components/dashboard/estado-en-vivo';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

type ClienteBusqueda = {
  id: string;
  nombre: string;
  codigo: string;
  cedula: string | null;
  telefono_1: string | null;
};

/** Display identity of the assigned client (id + name, codigo when known). */
type ClienteAsignado = { id: string; nombre: string; codigo: string | null };

interface Props {
  botellon: BotellonWithCliente;
}

/**
 * Detail form with live realtime reconciliation (design D3/D8): the canonical
 * estado comes from the realtime subscriber (`EstadoEnVivo`) and the selects
 * are controlled-until-dirty — `value = draft ?? live`. The operator's
 * in-progress selection is never clobbered by another operator's UPDATE, while
 * an untouched select follows the live estado and its Avanzar/Deshacer option
 * groups derive from it (nothing is terminal anymore).
 */
export function BotellonForm({ botellon }: Props) {
  const [state, formAction, pending] = useActionState(updateBotellon, null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [live, setLive] = useState<EstadoLive>({
    estado: botellon.estado as Estado,
    clienteId: botellon.cliente_id,
    fechaEntrega: null,
  });
  const [draftEstado, setDraftEstado] = useState<string | null>(null);
  const [draftCliente, setDraftCliente] = useState<string | null>(null);

  // Searchable client combobox (replaces the "all clients" <select>): the
  // operator types to find a client via getClientesForSearch (debounced 250ms,
  // min 2 chars). Search state is render-gated by the query that produced it
  // (same pattern as BuscadorClienteCarga) so a newer in-flight query hides the
  // previous bucket set — no stale flash.
  const [terminoCliente, setTerminoCliente] = useState('');
  const [resultadoCliente, setResultadoCliente] = useState<{ q: string; clientes: ClienteBusqueda[] } | null>(null);
  // Display identity of the assigned client. Seeded from the initial botellon
  // join; refreshed via getCliente when the live cliente_id changes (realtime
  // from another operator) to an id we do not know yet.
  const [clienteAsignado, setClienteAsignado] = useState<ClienteAsignado | null>(() =>
    botellon.cliente_id && botellon.clientes?.nombre
      ? { id: botellon.cliente_id, nombre: botellon.clientes.nombre, codigo: null }
      : null
  );

  const debouncedCliente = useDebounce(terminoCliente, DEBOUNCE_MS);
  const terminoClienteLimpio = debouncedCliente.trim();
  const busquedaValida = terminoClienteLimpio.length >= MIN_QUERY;
  const clientesResultado =
    busquedaValida && resultadoCliente?.q === terminoClienteLimpio ? resultadoCliente.clientes : null;
  const buscandoClientes = busquedaValida && resultadoCliente?.q !== terminoClienteLimpio;

  // Success: toast + drafts reset so the selects snap back to live (server
  // revalidation and the realtime echo have already converged). On error the
  // drafts are kept — the operator sees the attempted value next to the
  // "Transición no permitida" message while the badge stays canonical.
  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowSuccess(true);
      setDraftEstado(null);
      setDraftCliente(null);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [state?.success]);

  // Client search fetch — render-gated (mirrors BuscadorClienteCarga).
  useEffect(() => {
    if (!busquedaValida) return;
    let activo = true;
    getClientesForSearch(terminoClienteLimpio).then((clientes) => {
      if (activo) setResultadoCliente({ q: terminoClienteLimpio, clientes });
    });
    return () => {
      activo = false;
    };
  }, [terminoClienteLimpio, busquedaValida]);

  // Resolve the assigned client's display name. A draft wins over the live
  // cliente_id; unknown live ids (changed by another operator via realtime)
  // are fetched through getCliente so the combobox follows the current client.
  // Display is derived (`clienteMostrado`), so "Sin asignar" needs no state
  // mutation here — the fetch happens only inside the async callback.
  useEffect(() => {
    const id = draftCliente ?? live.clienteId;
    if (!id) return;
    if (clienteAsignado?.id === id) return;
    let activo = true;
    getCliente(id).then((c) => {
      if (activo && c) setClienteAsignado({ id, nombre: c.nombre, codigo: c.codigo });
    });
    return () => {
      activo = false;
    };
  }, [draftCliente, live.clienteId, clienteAsignado]);

  const seleccionarCliente = (c: ClienteBusqueda) => {
    setDraftCliente(c.id);
    setClienteAsignado({ id: c.id, nombre: c.nombre, codigo: c.codigo });
    setTerminoCliente('');
    setResultadoCliente(null);
  };

  const desasignarCliente = () => setDraftCliente('');

  // Effective assigned id: the operator's draft wins over the live client; an
  // empty draft means "Sin asignar" (same semantics as the old <select>).
  const clienteEfectivoId = draftCliente ?? live.clienteId;
  const clienteMostrado = clienteEfectivoId
    ? clienteAsignado?.id === clienteEfectivoId
      ? clienteAsignado
      : { id: clienteEfectivoId, nombre: null, codigo: null }
    : null;

  // Option groups derive from the LIVE estado (not the initial render):
  // identity option first, then Avanzar (forward) and Deshacer (reversion).
  const identity = live.estado;
  const avanzar = getTransiciones(live.estado).filter((e) => e !== identity);
  const deshacer = getReversiones(live.estado).filter((e) => e !== identity);

  return (
    <form action={formAction} className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <input type="hidden" name="id" value={botellon.id} />
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Configuración</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {/* Estado actual — static box driven by the realtime `live` estado */}
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Estado actual</label>
          <div className="mt-1 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800">
            <span aria-hidden className={cn('size-2 rounded-full', ESTADO_DOT_COLORS[live.estado] || 'bg-zinc-400')} />
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{ESTADO_LABELS[live.estado] || live.estado}</span>
          </div>
          {/* Realtime subscriber: keeps `live` (and the box above) in sync with
              other operators' UPDATEs. Rendered hidden — the box is the badge. */}
          <div className="hidden">
            <EstadoEnVivo
              botellonId={botellon.id}
              estado={live.estado}
              clienteId={live.clienteId}
              fechaEntrega={live.fechaEntrega}
              onLiveChange={setLive}
            />
          </div>
        </div>

        {/* Cambiar estado */}
        <div>
          <label htmlFor="estado" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Cambiar estado
          </label>
          <select id="estado" name="estado" value={draftEstado ?? live.estado}
            onChange={(e) => setDraftEstado(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
            <option value={identity}>{ESTADO_LABELS[identity] || identity} (actual)</option>
            {avanzar.length > 0 && (
              <optgroup label="Avanzar">
                {avanzar.map((e) => (
                  <option key={e} value={e}>{ESTADO_LABELS[e] || e}</option>
                ))}
              </optgroup>
            )}
            {deshacer.length > 0 && (
              <optgroup label="Deshacer">
                {deshacer.map((e) => (
                  <option key={e} value={e}>{ESTADO_LABELS[e] || e}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Asignar cliente — searchable combobox (server action
            getClientesForSearch), debounced 250ms, min 2 chars. Selecting a
            result sets `draftCliente` so the hidden input below submits the
            operator's pick; the ✕ chip returns to "Sin asignar". */}
        <div>
          <label htmlFor="buscar-cliente" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Cliente asignado
          </label>
          <input
            id="buscar-cliente"
            type="search"
            autoComplete="off"
            placeholder="Buscar por nombre, código, cédula o teléfono"
            value={terminoCliente}
            onChange={(e) => setTerminoCliente(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />

          {buscandoClientes ? (
            <p role="status" className="mt-1 text-[11px] text-zinc-400">Buscando…</p>
          ) : clientesResultado ? (
            clientesResultado.length === 0 ? (
              <p className="mt-1 text-[11px] text-zinc-400">Sin resultados</p>
            ) : (
              <ul className="mt-1 divide-y divide-zinc-100 overflow-hidden rounded-md border border-zinc-200 bg-white text-xs dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
                {clientesResultado.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => seleccionarCliente(c)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900 dark:text-zinc-50">{c.nombre}</span>
                        <span className="block font-mono text-[11px] text-zinc-400">{c.codigo}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-zinc-400">
                        {c.cedula ?? c.telefono_1 ?? ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {clienteMostrado ? (
            <div className="mt-1 flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800">
              <span className="min-w-0 truncate">
                <span className="text-zinc-500 dark:text-zinc-400">Cliente asignado: </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {clienteMostrado.nombre ?? 'Cliente seleccionado'}
                </span>
                {clienteMostrado.codigo ? (
                  <span className="ml-1 font-mono text-[11px] text-zinc-400">({clienteMostrado.codigo})</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={desasignarCliente}
                title="Quitar cliente (Sin asignar)"
                aria-label="Quitar cliente"
                className="shrink-0 rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
          ) : null}

          <input type="hidden" name="cliente_id" value={draftCliente ?? live.clienteId ?? ''} />
        </div>
      </div>

      {showSuccess && (
        <div className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Cambios guardados.
        </div>
      )}
      {state?.error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </div>
      )}

      {/* Card footer */}
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <p className="text-[11px] text-zinc-400">Los cambios se sincronizan en tiempo real.</p>
        <button type="submit" disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
