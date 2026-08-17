import { getBotellonByCodigo } from '@/lib/db/botellones';
import { getConfiguracion } from '@/lib/db/configuracion';
import { normalizeWhatsAppPhone } from '@/lib/utils/whatsapp';
import { QrCodeDisplay } from '@/app/(dashboard)/botellones/[id]/qr-code';
import { notFound } from 'next/navigation';
import { Droplets } from 'lucide-react';

export const dynamic = 'force-dynamic';

// Local estado maps — a server component cannot import the 'use client' form module.
const ESTADO_LABELS: Record<string, string> = {
  recibido: 'Recibido',
  planta: 'En planta',
  recarga: 'En recarga',
  listo: 'Listo',
  delivery: 'En delivery',
  entregado: 'Entregado',
  danado: 'Dañado',
  perdido: 'Perdido',
  mantenimiento: 'Mantenimiento',
};

const ESTADO_BADGE: Record<string, string> = {
  recibido: 'bg-slate-100 text-slate-800',
  planta: 'bg-blue-100 text-blue-800',
  recarga: 'bg-cyan-100 text-cyan-800',
  listo: 'bg-green-100 text-green-800',
  delivery: 'bg-amber-100 text-amber-800',
  entregado: 'bg-purple-100 text-purple-800',
  danado: 'bg-red-100 text-red-800',
  perdido: 'bg-red-100 text-red-800',
  mantenimiento: 'bg-gray-100 text-gray-800',
};

const ESTADO_BADGE_FALLBACK = 'bg-zinc-100 text-zinc-600';

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface Props {
  params: Promise<{ codigo: string }>;
}

export default async function BotellonPublicPage({ params }: Props) {
  const { codigo } = await params;
  const botellon = await getBotellonByCodigo(codigo);

  if (!botellon) notFound();

  const config = await getConfiguracion();

  const estadoLabel = ESTADO_LABELS[botellon.estado] ?? botellon.estado;
  const estadoBadge = ESTADO_BADGE[botellon.estado] ?? ESTADO_BADGE_FALLBACK;
  const whatsappHref = config.telefono
    ? `https://wa.me/${normalizeWhatsAppPhone(config.telefono)}`
    : null;

  return (
    <div className="min-h-screen bg-[#f0f9ff] px-4 py-8">
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-[#cbd5e1] bg-white shadow-[0_6px_24px_rgba(2,132,199,0.14)]">
        <header className="bg-gradient-to-br from-[#0c4a6e] via-[#0e7490] to-[#06b6d4] px-6 py-8 text-center">
          {config.logo_url ? (
            <img
              src={config.logo_url}
              alt={config.nombre_negocio}
              className="mx-auto h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <Droplets className="mx-auto h-12 w-12 text-white" aria-hidden="true" />
          )}
          <h1 className="mt-3 text-2xl font-extrabold tracking-[-0.02em] text-white">
            {config.nombre_negocio}
          </h1>
          {config.eslogan && (
            <p className="mt-1 text-sm italic text-cyan-50">{config.eslogan}</p>
          )}
        </header>

        <div className="space-y-5 px-6 py-6 text-center">
          <p className="font-mono text-sm font-semibold tracking-widest text-[#0e7490]">
            {botellon.codigo}
          </p>

          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${estadoBadge}`}
          >
            {estadoLabel}
          </span>

          <div className="flex justify-center">
            <QrCodeDisplay codigo={botellon.codigo} logoUrl={config.logo_url} />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#cbd5e1] bg-white p-4">
            <div>
              <p className="text-xs text-[#64748b]">Total recargas</p>
              <p className="mt-0.5 text-2xl font-bold text-[#0f172a]">
                {botellon.total_recargas}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64748b]">Última recarga</p>
              <p className="mt-0.5 text-lg font-medium text-[#0f172a]">
                {botellon.ultima_recarga
                  ? new Date(botellon.ultima_recarga).toLocaleDateString('es-VE')
                  : '—'}
              </p>
            </div>
          </div>

          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#f0fdf4] px-5 py-2.5 text-sm font-semibold text-[#15803d]"
            >
              <WhatsAppIcon />
              Contactar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
