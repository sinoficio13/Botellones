import { getBotellonByCodigo } from '@/lib/db/botellones';
import { notFound } from 'next/navigation';
import { QrCodeDisplay } from '@/app/(dashboard)/botellones/[id]/qr-code';
import { Droplets } from 'lucide-react';
import { getConfiguracion } from '@/lib/db/configuracion';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ codigo: string }>;
}

export default async function BotellonPublicPage({ params }: Props) {
  const { codigo } = await params;
  const botellon = await getBotellonByCodigo(codigo);

  if (!botellon) notFound();

  const config = await getConfiguracion();
  const negocio = config.nombre_negocio || 'Botellón';

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Droplets className="mx-auto h-10 w-10 text-blue-600 dark:text-blue-400" />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {negocio}
          </h1>
          <p className="mt-1 font-mono text-lg text-zinc-600 dark:text-zinc-400">
            {botellon.codigo}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex justify-center">
            <QrCodeDisplay codigo={botellon.codigo} logoUrl={config.logo_url} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Total recargas</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {botellon.total_recargas}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Última recarga</p>
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              {botellon.ultima_recarga
                ? new Date(botellon.ultima_recarga).toLocaleDateString()
                : '—'}
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-400">
          Escaneá este QR para ver el historial del botellón.
        </p>
      </div>
    </div>
  );
}
