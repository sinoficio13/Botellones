import { getBotellones, type BotellonWithCliente } from '@/lib/db/botellones';
import { ESTADO_LABELS, ESTADO_COLORS } from '@/lib/utils/estados';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function BotellonesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1'));
  const q = sp.q || '';

  const { botellones, total } = await getBotellones(page, 12, q || undefined);
  const totalPages = Math.ceil(total / 12);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Botellones {total > 0 && <span className="text-base font-normal text-zinc-400">({total})</span>}
        </h1>
        <Link href="/botellones/nuevo"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
          + Nuevo
        </Link>
      </div>

      <form className="mt-4" method="GET">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por código BOT-XXXXX…"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:max-w-sm" />
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 font-medium text-zinc-500">Código</th>
              <th className="px-3 py-2 font-medium text-zinc-500">Estado</th>
              <th className="px-3 py-2 font-medium text-zinc-500">Cliente</th>
              <th className="px-3 py-2 font-medium text-zinc-500">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {botellones.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-zinc-400">No hay botellones todavía.</td></tr>
            )}
            {botellones.map((b: BotellonWithCliente) => (
              <tr key={b.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <td className="px-3 py-2.5 font-mono text-xs">
                  <Link href={`/botellones/${b.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {b.codigo}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTADO_COLORS[b.estado] || ''}`}>
                    {ESTADO_LABELS[b.estado] ?? b.estado}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                  {b.clientes?.nombre || '—'}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500">
                  {b.fecha_creacion ? new Date(b.fecha_creacion).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a key={p} href={`/botellones?page=${p}${q ? `&q=${q}` : ''}`}
              className={`rounded px-3 py-1.5 text-sm font-medium ${p === page ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
