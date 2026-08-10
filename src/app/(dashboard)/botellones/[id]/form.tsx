'use client';

import { useActionState, useState } from 'react';
import { updateBotellon } from '@/lib/db/botellones';

const ESTADO_LABELS: Record<string, string> = {
  disponible: 'Disponible',
  asignado: 'Asignado',
  en_recarga: 'En recarga',
  mantenimiento: 'Mantenimiento',
  dañado: 'Dañado',
  perdido: 'Perdido',
};

const ESTADO_COLORS: Record<string, string> = {
  disponible: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  asignado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  en_recarga: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  mantenimiento: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  dañado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  perdido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

interface Props {
  botellon: any;
  transiciones: string[];
  clientes: Array<{ id: string; nombre: string; codigo: string }>;
}

export function BotellonForm({ botellon, transiciones, clientes }: Props) {
  const [state, formAction, pending] = useActionState(updateBotellon, null);
  const [showSuccess, setShowSuccess] = useState(false);

  async function handleAction(prev: any, fd: FormData) {
    const result = await formAction(prev, fd);
    if (result?.success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
    return result;
  }

  return (
    <form action={handleAction} className="mt-8 space-y-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Configuración</h2>
      <input type="hidden" name="id" value={botellon.id} />

      {/* Estado actual */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Estado actual</label>
        <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[botellon.estado] || ''}`}>
          {ESTADO_LABELS[botellon.estado] || botellon.estado}
        </span>
      </div>

      {/* Cambiar estado */}
      {transiciones.length > 0 && (
        <div>
          <label htmlFor="estado" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Cambiar estado
          </label>
          <select id="estado" name="estado" defaultValue={botellon.estado}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:max-w-xs">
            <option value={botellon.estado}>{ESTADO_LABELS[botellon.estado]} (actual)</option>
            {transiciones.map((e) => e !== botellon.estado && (
              <option key={e} value={e}>{ESTADO_LABELS[e] || e}</option>
            ))}
          </select>
          {transiciones.length === 1 && transiciones[0] === botellon.estado && (
            <p className="mt-1 text-xs text-zinc-400">Este estado es terminal. No hay transiciones disponibles.</p>
          )}
        </div>
      )}

      {/* Asignar cliente */}
      <div>
        <label htmlFor="cliente_id" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Cliente asignado
        </label>
        <select id="cliente_id" name="cliente_id" defaultValue={botellon.cliente_id || ''}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:max-w-xs">
          <option value="">Sin asignar (planta)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id} selected={c.id === botellon.cliente_id}>
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
