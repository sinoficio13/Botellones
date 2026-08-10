import { getContadores } from '@/lib/db/recargas';
import Link from 'next/link';
import { Plus, Droplets, Calendar, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function RecargasPage() {
  const contadores = await getContadores();

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Recargas
        </h1>
        <Link href="/recargas/nueva"
          className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
          <Plus size={14} /> Nueva
        </Link>
      </div>

      {/* Counters */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-700">
          <Droplets className="mx-auto h-4 w-4 text-blue-500" />
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{contadores.recargas_hoy}</p>
          <p className="text-xs text-zinc-500">Hoy</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-700">
          <Calendar className="mx-auto h-4 w-4 text-green-500" />
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{contadores.recargas_mes}</p>
          <p className="text-xs text-zinc-500">Este mes</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-700">
          <TrendingUp className="mx-auto h-4 w-4 text-purple-500" />
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{contadores.recargas_total}</p>
          <p className="text-xs text-zinc-500">Total</p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/recargas/nueva"
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700">
          <Plus size={16} /> Registrar recarga
        </Link>
      </div>
    </div>
  );
}
