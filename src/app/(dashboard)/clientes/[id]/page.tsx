import { getCliente } from '@/lib/db/clientes';
import { notFound } from 'next/navigation';
import { ClienteTabs } from './tabs';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params;
  const cliente = await getCliente(id);

  if (!cliente) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/clientes"
            className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            <ArrowLeft size={14} /> Clientes
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {cliente.nombre}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-mono text-xs">{cliente.codigo}</span>
            {cliente.tipo_cliente && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                {cliente.tipo_cliente}
              </span>
            )}
            {cliente.telefono_1 && (
              <a
                href={`https://wa.me/${cliente.telefono_1.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-green-600 hover:underline dark:text-green-400"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ClienteTabs cliente={cliente} />
    </div>
  );
}
