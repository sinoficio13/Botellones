import { getCliente } from '@/lib/db/clientes';
import { getFotosCliente, fotoFachadaPublicUrl } from '@/lib/db/fotos';
import { normalizeWhatsAppPhone } from '@/lib/utils/whatsapp';
import { notFound } from 'next/navigation';
import { ClienteTabs } from './tabs';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ExportButton } from '@/components/shared/export-button';
import { exportClienteFichaPDF } from '@/lib/export/actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params;
  const [cliente, fotos] = await Promise.all([getCliente(id), getFotosCliente(id)]);

  if (!cliente) notFound();

  const whatsapp = normalizeWhatsAppPhone(cliente.whatsapp ?? cliente.telefono_1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
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
            {cliente.total_recargas > 0 && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Nivel {Math.floor(cliente.total_recargas / 10) + 1}
              </span>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-green-600 hover:underline dark:text-green-400"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
            <ExportButton
              onClick={exportClienteFichaPDF.bind(null, id)}
              label="Exportar ficha"
            />
          </div>
        </div>
      </div>

      <ClienteTabs cliente={cliente} />

      {fotos.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Fotos de fachada
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {fotos.map((f) => {
              const url = fotoFachadaPublicUrl(f.ruta_storage);
              if (!url) return null;
              return (
                <img
                  key={f.id}
                  src={url}
                  alt="Foto de fachada del cliente"
                  className="aspect-square w-full rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}