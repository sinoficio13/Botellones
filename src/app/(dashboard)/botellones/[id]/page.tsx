import { getBotellon, getClientesForSelect } from '@/lib/db/botellones';
import { getConfiguracion } from '@/lib/db/configuracion';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { ESTADO_LABELS } from '@/lib/utils/estados';
import { cn } from '@/lib/utils';
import { BotellonForm } from './form';
import { QrCodeDisplay } from './qr-code';

export const dynamic = 'force-dynamic';

/** 12-hour clock display ("4:37 PM") — stored time stays 24h/ISO; only the UI converts. */
function formatHora12(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BotellonDetailPage({ params }: Props) {
  const { id } = await params;
  const botellon = await getBotellon(id);
  if (!botellon) notFound();

  const clientes = await getClientesForSelect();
  const config = await getConfiguracion();

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
          <QrCodeDisplay codigo={botellon.codigo} logoUrl={config.logo_url} />
        </div>
        <div className="text-sm">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Código QR</p>
          <p className="mt-1 text-zinc-500">Escanear para ver información pública del botellón.</p>
          <p className="mt-1 font-mono text-xs text-zinc-400">/b/{botellon.codigo}</p>
        </div>
      </div>

      {/* Form: state + client assignment. The live estado badge and the
          Avanzar/Deshacer selector derive from realtime state (form.tsx). */}
      <BotellonForm botellon={botellon} clientes={clientes} />

      {/* Unified history: state changes + recargas as one timeline */}
      <HistorialBotellon botellonId={botellon.id} />
    </div>
  );
}

/** Deterministic operation label for a transition (the batch ops + kanban moves). */
const OPERACION_POR_TRANSICION: Record<string, string> = {
  'entregado→recibido': 'Recibir',
  'recibido→recarga': 'Recargar',
  'recarga→listo': 'Listo',
  'recarga→delivery': 'En delivery',
  'delivery→entregado': 'Entregar',
  'listo→delivery': 'En delivery',
  'listo→entregado': 'Entregar',
};

type EventoHistorial =
  | { id: string; fecha: Date; tipo: 'movimiento'; de: string; a: string; operacion: string }
  | { id: string; fecha: Date; tipo: 'recarga'; numero: string; cliente: string };

/**
 * Unified bottle timeline: every estado change (movimientos, 0011 trigger) and
 * every recarga (with its REC number) merged into one chronological history,
 * so the process is visible as a story instead of two flat tables.
 */
async function HistorialBotellon({ botellonId }: { botellonId: string }) {
  const { getMovimientosBotellon } = await import('@/lib/db/botellones');
  const { getRecargasBotellon } = await import('@/lib/db/recargas');
  const [movimientos, recargasData] = await Promise.all([
    getMovimientosBotellon(botellonId),
    getRecargasBotellon(botellonId),
  ]);

  const eventos: EventoHistorial[] = [
    ...movimientos.map((m) => ({
      id: m.id,
      fecha: new Date(m.created_at),
      tipo: 'movimiento' as const,
      de: m.estado_previo ?? '',
      a: m.estado_nuevo ?? '',
      operacion:
        OPERACION_POR_TRANSICION[`${m.estado_previo}→${m.estado_nuevo}`] ?? 'Cambio de estado',
    })),
    ...recargasData.recargas.map((r) => ({
      id: r.id,
      fecha: new Date(`${r.fecha}T${r.hora ?? '00:00'}`),
      tipo: 'recarga' as const,
      numero: r.numero_registro,
      cliente: r.clientes?.nombre ?? '—',
    })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Historial <span className="text-sm font-normal text-zinc-400">({eventos.length})</span>
      </h2>
      {eventos.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay movimientos registrados.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-zinc-200 pl-4 dark:border-zinc-800">
          {eventos.map((e) => (
            <li key={`${e.tipo}-${e.id}`} className="relative">
              <span
                aria-hidden
                className={cn(
                  'absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white dark:border-zinc-900',
                  e.tipo === 'recarga' ? 'bg-green-500' : 'bg-zinc-400'
                )}
              />
              <p className="text-xs text-zinc-500">
                {e.fecha.toLocaleDateString()} · {formatHora12(e.fecha)}
              </p>
              {e.tipo === 'recarga' ? (
                <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                  Recarga · <span className="font-mono text-xs font-medium">{e.numero}</span>
                  <span className="text-zinc-500"> · {e.cliente}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(ESTADO_LABELS[e.de] ?? e.de) || '—'} → {ESTADO_LABELS[e.a] ?? e.a}
                  <span className="ml-2 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                    {e.operacion}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
