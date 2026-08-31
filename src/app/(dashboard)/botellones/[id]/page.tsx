import { getBotellon } from '@/lib/db/botellones';
import { getConfiguracion } from '@/lib/db/configuracion';
import { getRecargasBotellon } from '@/lib/db/recargas';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { ESTADO_LABELS, ESTADO_COLORS, ESTADO_DOT_COLORS } from '@/lib/utils/estados';
import { formatFechaLocal, formatFechaZona, formatHora12Str } from '@/lib/utils/hora';
import { BotellonForm } from './form';
import { QrCodeDisplay } from './qr-code';
import { HistorialBotellon } from '@/components/botellones/historial-botellon';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BotellonDetailPage({ params }: Props) {
  const { id } = await params;
  const botellon = await getBotellon(id);
  if (!botellon) notFound();

  const config = await getConfiguracion();
  // Latest recarga for the summary card (recargas are ordered fecha DESC).
  const { recargas } = await getRecargasBotellon(botellon.id);
  const ultimaRecarga = recargas[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/botellones"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
        <ArrowLeft size={14} /> Botellones
      </Link>

      {/* Header: title + estado badge, subtitle line, print action */}
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {botellon.codigo}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                ESTADO_COLORS[botellon.estado] || 'bg-zinc-100 text-zinc-600'
              }`}
            >
              <span aria-hidden className={`size-1.5 rounded-full ${ESTADO_DOT_COLORS[botellon.estado] || 'bg-zinc-400'}`} />
              {ESTADO_LABELS[botellon.estado] ?? botellon.estado}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Creado {formatFechaZona(new Date(botellon.fecha_creacion))} · {botellon.total_recargas} recargas
            · Cliente: {botellon.clientes?.nombre || '—'}
          </p>
        </div>
        <Link href={`/botellones/${id}/imprimir`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900">
          <Printer size={14} /> Imprimir
        </Link>
      </div>

      {/* Two-column layout: QR + summary rail (260px) | form + history */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <QrCodeDisplay codigo={botellon.codigo} logoUrl={config.logo_url} />
            <p className="mt-2 text-center font-mono text-[11px] text-zinc-400">/b/{botellon.codigo}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400">Resumen</p>
            <dl className="mt-2 space-y-2 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-zinc-500">Total recargas</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">{botellon.total_recargas}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-zinc-500">Última recarga</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                  {ultimaRecarga ? `${formatFechaLocal(ultimaRecarga.fecha)} · ${formatHora12Str(ultimaRecarga.hora)}` : '—'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-zinc-500">Cliente</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">{botellon.clientes?.nombre || '—'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-zinc-500">Teléfono</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">{botellon.clientes?.telefono_1 || '—'}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <div className="space-y-4">
          <BotellonForm botellon={botellon} />
          <HistorialBotellon botellonId={botellon.id} />
        </div>
      </div>
    </div>
  );
}
