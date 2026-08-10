import { getBotellon, getTransiciones, getClientesForSelect } from '@/lib/db/botellones';
import { notFound } from 'next/navigation';
import { ArrowLeft, QrCode, Printer } from 'lucide-react';
import Link from 'next/link';
import { BotellonForm } from './form';
import { QrCodeDisplay } from './qr-code';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BotellonDetailPage({ params }: Props) {
  const { id } = await params;
  const botellon = await getBotellon(id);
  if (!botellon) notFound();

  const transiciones = getTransiciones(botellon.estado);
  const clientes = await getClientesForSelect();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/botellones"
        className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
        <ArrowLeft size={14} /> Botellones
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {botellon.codigo}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Creado {new Date(botellon.fecha_creacion).toLocaleDateString()} · {botellon.total_recargas} recargas
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/botellones/${id}/imprimir`}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900">
            <Printer size={14} /> Imprimir
          </Link>
        </div>
      </div>

      {/* QR Code */}
      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <QrCodeDisplay codigo={botellon.codigo} />
        </div>
        <div className="text-sm">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Código QR</p>
          <p className="mt-1 text-zinc-500">Escanear para ver información pública del botellón.</p>
          <p className="mt-1 font-mono text-xs text-zinc-400">/b/{botellon.codigo}</p>
        </div>
      </div>

      {/* Form: state + client assignment */}
      <BotellonForm botellon={botellon} transiciones={transiciones} clientes={clientes} />

      {/* Recarga history */}
      <RecargasHistorial botellonId={botellon.id} />
    </div>
  );
}

async function RecargasHistorial({ botellonId }: { botellonId: string }) {
  const { getRecargasBotellon } = await import('@/lib/db/recargas');
  const { recargas, total } = await getRecargasBotellon(botellonId);

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Historial de recargas <span className="text-sm font-normal text-zinc-400">({total})</span>
      </h2>
      {recargas.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay recargas registradas.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-500">Fecha</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Hora</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Registro</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Cliente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {recargas.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{new Date(r.fecha).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-zinc-500">{r.hora?.slice(0, 5)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.numero_registro}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.clientes?.nombre || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
