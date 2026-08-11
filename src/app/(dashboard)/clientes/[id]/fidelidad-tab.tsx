'use client';

import { useState, useEffect } from 'react';
import { LoyaltyBadge } from '@/components/fidelidad/loyalty-badge';
import { getPremiosByCliente } from '@/lib/db/premios';
import type { PremioRow } from '@/lib/db/premios';
import { Award, CheckCircle } from 'lucide-react';

interface Props {
  clienteId: string;
  totalRecargas: number;
}

export function FidelidadTab({ clienteId, totalRecargas }: Props) {
  const [premios, setPremios] = useState<PremioRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPremiosByCliente(clienteId).then((data) => {
      setPremios(data);
      setLoading(false);
    });
  }, [clienteId]);

  const pendientes = premios.filter((p) => p.estado === 'pendiente');
  const entregados = premios.filter((p) => p.estado === 'entregado');

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Fidelidad</h2>

      {/* Loyalty badge */}
      <div className="flex justify-center">
        <LoyaltyBadge total={totalRecargas} />
      </div>

      {/* Pending premio badge */}
      {pendientes.length > 0 && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {pendientes.length === 1
                ? '1 premio pendiente'
                : `${pendientes.length} premios pendientes`}
            </p>
          </div>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {pendientes.map((p) => `Nivel ${p.nivel_recargas} recargas`).join(' · ')}
          </p>
        </div>
      )}

      {/* Delivered premios history */}
      {loading ? (
        <p className="text-sm text-zinc-400">Cargando…</p>
      ) : entregados.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Premios entregados</h3>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-500">Nivel</th>
                  <th className="px-3 py-2 font-medium text-zinc-500">Tipo</th>
                  <th className="px-3 py-2 font-medium text-zinc-500">Alcanzado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {entregados.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-mono text-xs">{p.nivel_recargas}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                        <CheckCircle size={12} className="text-green-500" />
                        {p.tipo_premio || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {p.fecha_alcanzado ? new Date(p.fecha_alcanzado).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : premios.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay premios registrados todavía.</p>
      ) : null}
    </div>
  );
}
