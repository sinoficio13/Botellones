import { getCliente } from '@/lib/db/clientes';
import { getDireccion } from '@/lib/db/direcciones';
import { getBotellonesDelCliente } from '@/lib/db/recargas';
import { notFound } from 'next/navigation';
import { ClienteTabs } from './tabs';
import { MessageCircle, ArrowLeft, MapPin, Droplets, CalendarDays, Award } from 'lucide-react';
import Link from 'next/link';
import { ExportButton } from '@/components/shared/export-button';
import { exportClienteFichaPDF } from '@/lib/export/actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params;
  const [cliente, direccion, botellones] = await Promise.all([
    getCliente(id),
    getDireccion(id),
    getBotellonesDelCliente(id),
  ]);

  if (!cliente) notFound();

  const firstBotellon = botellones?.[0];
  const whatsappNum = (cliente.whatsapp || cliente.telefono_1 || '')?.replace(/\D/g, '');
  const dirCompuesta = direccion
    ? [direccion.calle, direccion.avenida, direccion.sector, direccion.urbanizacion, direccion.ciudad, direccion.estado]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* ── Header ── */}
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
            <ExportButton
              onClick={exportClienteFichaPDF.bind(null, id)}
              label="Exportar ficha"
            />
          </div>
        </div>
      </div>

      {/* ── Resumen: Dirección + Contacto ── */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Dirección */}
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <MapPin size={14} />
            Dirección de entrega
          </div>
          {dirCompuesta ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-zinc-900 dark:text-zinc-100">{dirCompuesta}</p>
              {direccion?.referencia && (
                <p className="text-xs text-zinc-500">{direccion.referencia}</p>
              )}
              {direccion?.link_mapa && (
                <a
                  href={direccion.link_mapa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  <MapPin size={12} /> Ver en el mapa
                </a>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">Sin dirección registrada</p>
          )}
        </div>

        {/* Contacto */}
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <MessageCircle size={14} className="text-green-600" />
            Contacto
          </div>
          {whatsappNum ? (
            <div className="mt-2 space-y-2">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {whatsappNum.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
              </p>
              {cliente.horario_preferido && (
                <p className="text-xs text-zinc-500">
                  🕐 {cliente.horario_preferido}
                  {cliente.contacto_preferido && ` · ${cliente.contacto_preferido}`}
                </p>
              )}
              <a
                href={`https://wa.me/${whatsappNum}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <MessageCircle size={12} /> Escribir por WhatsApp
              </a>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-zinc-400">Sin teléfono registrado</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mini-cards de estado ── */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <MiniCard
          icon={<Droplets size={16} />}
          label="Botellón activo"
          value={firstBotellon ? (
            <span className="flex items-center gap-2">
              <span className="font-mono text-sm">{firstBotellon.codigo}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                firstBotellon.estado === 'asignado' ? 'bg-blue-100 text-blue-700' :
                firstBotellon.estado === 'activo' ? 'bg-green-100 text-green-700' :
                'bg-zinc-100 text-zinc-600'
              }`}>
                {firstBotellon.estado}
              </span>
            </span>
          ) : 'Sin botellones'}
        />
        <MiniCard
          icon={<CalendarDays size={16} />}
          label="Última recarga"
          value={cliente.total_recargas > 0 ? `${cliente.total_recargas} total` : 'Sin recargas'}
        />
        <MiniCard
          icon={<Award size={16} />}
          label="Fidelidad"
          value={
            <span className="flex items-center gap-1.5">
              <span className="font-semibold">Nivel {Math.floor(cliente.total_recargas / 10) + 1}</span>
              <span className="text-xs text-zinc-400">({cliente.total_recargas % 10}/10)</span>
            </span>
          }
        />
      </div>

      {/* ── Pestañas ── */}
      <ClienteTabs cliente={cliente} />
    </div>
  );
}

function MiniCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {icon} {label}
      </div>
      <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}