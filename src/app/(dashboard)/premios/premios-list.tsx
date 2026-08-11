'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { entregarPremio } from '@/lib/db/premios';
import type { PremioRow } from '@/lib/db/premios';
import { CheckCircle, Award } from 'lucide-react';

const TIPO_OPCIONES = [
  'Botellón gratis',
  'Descuento 50%',
  'Termo',
  'Otro',
] as const;

interface Props {
  premios: PremioRow[];
  total: number;
  estadoInicial: 'pendiente' | 'entregado';
  page: number;
}

export function PremiosList({ premios, total, estadoInicial, page }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pendiente' | 'entregado'>(estadoInicial);

  function switchTab(tab: 'pendiente' | 'entregado') {
    setActiveTab(tab);
    router.push(`/premios?estado=${tab}`);
  }

  return (
    <div className="mt-6">
      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => switchTab('pendiente')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'pendiente'
              ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
          }`}
        >
          Pendientes
        </button>
        <button
          onClick={() => switchTab('entregado')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'entregado'
              ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
          }`}
        >
          Entregados
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'pendiente' && <PendientesTab premios={premios} />}
        {activeTab === 'entregado' && <EntregadosTab premios={premios} />}
      </div>
    </div>
  );
}

// ── PENDIENTES TAB ──

function PendientesTab({ premios }: { premios: PremioRow[] }) {
  return (
    <div>
      {premios.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <Award className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-400">No hay premios pendientes.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-500">Cliente</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Nivel</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Alcanzado</th>
                <th className="px-3 py-2 font-medium text-zinc-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {premios.map((p) => (
                <PendienteRow key={p.id} premio={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PendienteRow({ premio }: { premio: PremioRow }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState(entregarPremio, null);

  const nombre = premio.clientes?.nombre || '—';
  const clienteId = premio.clientes?.id || '';
  const delivered = state?.success;

  return (
    <tr className={delivered ? 'bg-green-50 dark:bg-green-950/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}>
      {delivered ? (
        <td colSpan={4} className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
            <CheckCircle size={14} />
            Premio entregado
          </span>
        </td>
      ) : (
        <>
          <td className="px-3 py-2.5">
            <Link
              href={`/clientes/${clienteId}`}
              className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              {nombre}
            </Link>
          </td>
          <td className="px-3 py-2.5 font-mono text-xs">{premio.nivel_recargas}</td>
          <td className="px-3 py-2.5 text-xs text-zinc-500">
            {premio.fecha_alcanzado ? new Date(premio.fecha_alcanzado).toLocaleDateString() : '—'}
          </td>
          <td className="px-3 py-2.5">
            {showForm ? (
              <form action={formAction} className="flex items-center gap-2">
                <input type="hidden" name="premio_id" value={premio.id} />
                <select
                  name="tipo_premio"
                  required
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <option value="">Tipo…</option>
                  {TIPO_OPCIONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <textarea
                  name="observaciones"
                  rows={1}
                  placeholder="Obs."
                  className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {pending ? '…' : '✓'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded px-1 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
              >
                Entregar
              </button>
            )}
          </td>
        </>
      )}
    </tr>
  );
}

// ── ENTREGADOS TAB ──

function EntregadosTab({ premios }: { premios: PremioRow[] }) {
  return (
    <div>
      {premios.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <CheckCircle className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-400">No hay premios entregados todavía.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-500">Cliente</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Tipo</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Nivel</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Entregado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {premios.map((p) => {
                const nombre = p.clientes?.nombre || '—';
                const clienteId = p.clientes?.id || '';
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/clientes/${clienteId}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {nombre}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {p.tipo_premio || '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {p.nivel_recargas}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
