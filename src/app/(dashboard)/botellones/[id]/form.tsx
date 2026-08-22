'use client';

import { useActionState, useState, useEffect } from 'react';
import { updateBotellon, type BotellonWithCliente } from '@/lib/db/botellones';
import {
  type Estado,
  ESTADO_LABELS,
  getTransiciones,
  getReversiones,
} from '@/lib/utils/estados';
import { EstadoEnVivo, type EstadoLive } from '@/components/dashboard/estado-en-vivo';

interface Props {
  botellon: BotellonWithCliente;
  clientes: Array<{ id: string; nombre: string; codigo: string }>;
}

/**
 * Detail form with live realtime reconciliation (design D3/D8): the canonical
 * badge comes from <EstadoEnVivo> (realtime subscriber) and the selects are
 * controlled-until-dirty — `value = draft ?? live`. The operator's in-progress
 * selection is never clobbered by another operator's UPDATE, while an untouched
 * select follows the live estado and its Avanzar/Deshacer option groups derive
 * from it (nothing is terminal anymore).
 */
export function BotellonForm({ botellon, clientes }: Props) {
  const [state, formAction, pending] = useActionState(updateBotellon, null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [live, setLive] = useState<EstadoLive>({
    estado: botellon.estado as Estado,
    clienteId: botellon.cliente_id,
    fechaEntrega: null,
  });
  const [draftEstado, setDraftEstado] = useState<string | null>(null);
  const [draftCliente, setDraftCliente] = useState<string | null>(null);

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

  // Option groups derive from the LIVE estado (not the initial render):
  // identity option first, then Avanzar (forward) and Deshacer (reversion).
  const identity = live.estado;
  const avanzar = getTransiciones(live.estado).filter((e) => e !== identity);
  const deshacer = getReversiones(live.estado).filter((e) => e !== identity);

  return (
    <form action={formAction} className="mt-8 space-y-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Configuración</h2>
      <input type="hidden" name="id" value={botellon.id} />

      {/* Estado actual — canonical live badge (realtime subscriber) */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Estado actual</label>
        <EstadoEnVivo
          botellonId={botellon.id}
          estado={live.estado}
          clienteId={live.clienteId}
          fechaEntrega={live.fechaEntrega}
          onLiveChange={setLive}
        />
      </div>

      {/* Cambiar estado */}
      <div>
        <label htmlFor="estado" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Cambiar estado
        </label>
        <select id="estado" name="estado" value={draftEstado ?? live.estado}
          onChange={(e) => setDraftEstado(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:max-w-xs">
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

      {/* Asignar cliente */}
      <div>
        <label htmlFor="cliente_id" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Cliente asignado
        </label>
        <select id="cliente_id" name="cliente_id" value={draftCliente ?? live.clienteId ?? ''}
          onChange={(e) => setDraftCliente(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:max-w-xs">
          <option value="">Sin asignar</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({c.codigo})
            </option>
          ))}
        </select>
        {botellon.clientes && (
          <p className="mt-1 text-xs text-zinc-500">
            Actual: {botellon.clientes.nombre}
            {botellon.clientes.telefono_1 && ` · ${botellon.clientes.telefono_1}`}
          </p>
        )}
      </div>

      {showSuccess && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Cambios guardados.
        </div>
      )}
      {state?.error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </div>
      )}

      <button type="submit" disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}