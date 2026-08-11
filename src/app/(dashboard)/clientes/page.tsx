import { getClientes } from '@/lib/db/clientes';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ page?: string; q?: string; order?: string; dir?: string }>;
}

export default async function ClientesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1'));
  const q = sp.q || '';
  const order = sp.order || 'fecha_registro';
  const dir = (sp.dir as 'asc' | 'desc') || 'desc';

  const { clientes, total } = await getClientes(page, 12, q || undefined, order, dir);
  const totalPages = Math.ceil(total / 12);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Clientes {total > 0 && <span className="text-base font-normal text-zinc-400">({total})</span>}
        </h1>
        <Link
          href="/clientes/nuevo"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + Nuevo
        </Link>
      </div>

      {/* Search */}
      <form className="mt-4" method="GET">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, teléfono, código, cédula o negocio…"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:max-w-sm"
        />
      </form>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <Th label="Código" field="codigo" {...{ order, dir }} />
              <Th label="Nombre" field="nombre" {...{ order, dir }} />
              <Th label="Negocio" field="negocio" {...{ order, dir }} />
              <Th label="Teléfono" field="telefono_1" {...{ order, dir }} />
              <Th label="Tipo" field="tipo_cliente" {...{ order, dir }} />
              <Th label="Última recarga" field="fecha_registro" {...{ order, dir }} />
              <Th label="Total" field="fecha_registro" {...{ order, dir }} />
              <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">WA</th>
              <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {clientes.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-zinc-400">
                  {q ? 'Sin resultados para esta búsqueda.' : 'No hay clientes todavía.'}
                </td>
              </tr>
            )}
            {clientes.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">{c.codigo}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/clientes/${c.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                    {c.nombre}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{c.negocio || '—'}</td>
                <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{c.telefono_1 || '—'}</td>
                <td className="px-3 py-2.5">
                  {c.tipo_cliente && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {c.tipo_cliente}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500">
                  {c.ultima_recarga ? new Date(c.ultima_recarga).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                  {c.total_recargas}
                </td>
                <td className="px-3 py-2.5">
                  {c.telefono_1 && (
                    <a
                      href={`https://wa.me/${c.telefono_1.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded p-1 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                      title="Abrir WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </a>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <a
                    href={`/recargas/nueva?cliente_id=${c.id}`}
                    className="inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                  >
                    + Recarga
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/clientes?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ''}&order=${order}&dir=${dir}`}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Sortable table header */
function Th({ label, field, order, dir }: { label: string; field: string; order: string; dir: string }) {
  const isActive = order === field;
  const nextDir = isActive && dir === 'asc' ? 'desc' : 'asc';
  return (
    <th className="px-3 py-2">
      <a
        href={`/clientes?order=${field}&dir=${nextDir}`}
        className="inline-flex items-center gap-1 font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        {label}
        {isActive && <span className="text-xs">{dir === 'asc' ? '↑' : '↓'}</span>}
      </a>
    </th>
  );
}
