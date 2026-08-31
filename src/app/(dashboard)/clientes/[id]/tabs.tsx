'use client';

import { useState, useEffect, startTransition } from 'react';
import { useActionState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { updateCliente } from '@/lib/db/clientes';
import { subirFotosCliente, eliminarFotoCliente } from '@/lib/db/fotos';
import { saveDireccion, getDireccion, resolveMapLink } from '@/lib/db/direcciones';
import { parseWhatsAppLocation } from '@/lib/utils/location';
import { comprimirImagen, validarImagen, MAX_LADO } from '@/lib/client/imagen';
import type { ClienteRow } from '@/lib/db/clientes';
import { ESTADO_LABELS, ESTADO_COLORS } from '@/lib/utils/estados';
import { linkWhatsApp } from '@/lib/utils/whatsapp';
import { FidelidadTab } from './fidelidad-tab';
import { HistorialCliente } from '@/components/clientes/historial-cliente';
import { GaleriaFotos, type FotoGaleria } from '@/components/clientes/galeria-fotos';
import { InputDocumento } from '@/components/clientes/input-documento';
import { InputWhatsapp } from '@/components/clientes/input-whatsapp';
import { createClient } from '@/lib/supabase/client';
import { MapPin, MessageCircle, ExternalLink, Droplets, CalendarDays, Award, Share2, X, Camera, Upload, ImagePlus } from 'lucide-react';
import dynamic from 'next/dynamic';

const MapaEditable = dynamic(() => import('./mapa-editable'), { ssr: false });
const MapaLeaflet = dynamic(() => import('./mapa'), { ssr: false });

const TABS = ['Resumen', 'Datos', 'Dirección', 'Fotos', 'Botellones', 'Historial', 'Fidelidad'] as const;
type Tab = (typeof TABS)[number];

export function ClienteTabs({
  cliente,
  fotos,
}: {
  cliente: ClienteRow;
  fotos: FotoGaleria[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');
  const [galeria, setGaleria] = useState<number | null>(null);

  return (
    <div className="mt-6">
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {activeTab === 'Resumen' && <ResumenTab cliente={cliente} fotos={fotos} onAbrirGaleria={setGaleria} />}
        {activeTab === 'Datos' && <DatosTab cliente={cliente} />}
        {activeTab === 'Dirección' && <DireccionTab clienteId={cliente.id} />}
        {activeTab === 'Fotos' && <FotosTab clienteId={cliente.id} fotos={fotos} onAbrirGaleria={setGaleria} />}
        {activeTab === 'Botellones' && <BotellonesTab clienteId={cliente.id} />}
        {activeTab === 'Historial' && <HistorialCliente clienteId={cliente.id} />}
        {activeTab === 'Fidelidad' && (
          <FidelidadTab clienteId={cliente.id} totalRecargas={cliente.total_recargas} />
        )}
      </div>
      {galeria !== null && (
        <GaleriaFotos fotos={fotos} indiceInicial={galeria} onClose={() => setGaleria(null)} />
      )}
    </div>
  );
}

// ── RESUMEN TAB ──

function ResumenTab({
  cliente,
  fotos,
  onAbrirGaleria,
}: {
  cliente: ClienteRow;
  fotos: FotoGaleria[];
  onAbrirGaleria: (i: number) => void;
}) {
  const [direccion, setDireccion] = useState<Record<string, string | null> | null>(null);
  const [botellones, setBotellones] = useState<Array<{ id: string; codigo: string; estado: string }>>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getDireccion(cliente.id).then((d) => setDireccion(d as unknown as Record<string, string | null>));
    const supabase = createClient();
    supabase.from('botellones')
      .select('id, codigo, estado')
      .eq('cliente_id', cliente.id)
      .order('fecha_creacion', { ascending: false })
      .limit(3)
      .then(({ data }) => setBotellones((data as unknown as typeof botellones) || []));
  }, [cliente.id]);

  const whatsappNum = linkWhatsApp(cliente.whatsapp || cliente.telefono_1);
  const dirCompuesta = direccion
    ? [direccion.calle, direccion.avenida, direccion.sector, direccion.urbanizacion, direccion.ciudad, direccion.estado]
        .filter(Boolean)
        .join(', ')
    : '';
  // Línea principal: la dirección libre del form de creación tiene prioridad;
  // la estructurada de la tab Dirección queda como secundaria.
  const direccionPrincipal = cliente.direccion_entrega || dirCompuesta;

  const mapsUrl = direccion?.link_mapa ||
    (direccion?.latitud != null && direccion?.longitud != null
      ? `https://www.google.com/maps?q=${Number(direccion.latitud)},${Number(direccion.longitud)}`
      : '');

  const handleShare = async () => {
    const shareData = {
      title: `Ubicación de ${cliente.nombre}`,
      text: dirCompuesta ? `${cliente.nombre}: ${dirCompuesta}` : `Ubicación de ${cliente.nombre}`,
      url: mapsUrl,
    };

    // Web Share API (mobile / modern browsers)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled — do nothing
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(mapsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Dirección + Contacto */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <MapPin size={14} /> Dirección de entrega
          </div>
          {direccionPrincipal ? (
            <div className="mt-2 space-y-1">
              {cliente.direccion_entrega && (
                <p className="text-sm text-zinc-900 dark:text-zinc-100">{cliente.direccion_entrega}</p>
              )}
              {dirCompuesta && (
                <p className={cliente.direccion_entrega ? 'text-xs text-zinc-500' : 'text-sm text-zinc-900 dark:text-zinc-100'}>
                  {dirCompuesta}
                </p>
              )}
              {direccion?.referencia && (
                <p className="text-xs text-zinc-500">{direccion.referencia}</p>
              )}
              {direccionPrincipal && (
                <a
                  href={direccion?.link_mapa || `https://www.google.com/maps/search/${encodeURIComponent(direccionPrincipal)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  <ExternalLink size={12} /> Ver en el mapa
                </a>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">Sin dirección registrada — completar en Dirección</p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <MessageCircle size={14} className="text-green-600" /> Contacto
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
            <p className="mt-2 text-sm text-zinc-400">Sin teléfono registrado</p>
          )}
        </div>
      </div>

      {/* Mapa de ubicación GPS (visible si hay coordenadas) */}
      {direccion?.latitud != null && direccion?.longitud != null && (
        <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-700">
          <div className="flex items-center justify-between px-4 pt-3 pb-0 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
              <MapPin size={12} /> Ubicación
            </span>
            <div className="flex items-center gap-1.5">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink size={12} /> Maps
              </a>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                {copied ? (
                  <>Copiado ✓</>
                ) : (
                  <><Share2 size={12} /> Compartir</>
                )}
              </button>
            </div>
          </div>
          <div className="mt-2 h-52 w-full">
            <MapaLeaflet lat={Number(direccion.latitud)} lng={Number(direccion.longitud)} />
          </div>
        </div>
      )}

      {/* Fotos de fachada (debajo del mapa, o tras Dirección+Contacto si no hay mapa) */}
      {fotos.length > 0 && (
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            <Camera size={12} /> Fotos de fachada
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {fotos.slice(0, 3).map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onAbrirGaleria(i)}
                className="block h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-md border border-zinc-200 transition-shadow hover:ring-2 hover:ring-zinc-400 dark:border-zinc-700 dark:hover:ring-zinc-500"
                aria-label={`Abrir foto de fachada ${i + 1}`}
              >
                <img
                  src={f.url}
                  alt={`Foto de fachada ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
            {fotos.length > 3 && (
              <button
                type="button"
                onClick={() => onAbrirGaleria(3)}
                className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-600 transition-shadow hover:ring-2 hover:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:ring-zinc-500"
                aria-label={`Ver ${fotos.length - 3} fotos más`}
              >
                +{fotos.length - 3}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mini-cards */}
      <div className="grid grid-cols-3 gap-3">
        <MiniCard
          icon={<Droplets size={16} />}
          label="Botellones"
          value={botellones.length > 0 ? (
            <div className="space-y-1">
              {botellones.map((b) => (
                <div key={b.id} className="flex items-center gap-2">
                  <span className="font-mono text-xs">{b.codigo}</span>
                  <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${ESTADO_COLORS[b.estado] || 'bg-zinc-100 text-zinc-600'}`}>
                    {ESTADO_LABELS[b.estado] ?? b.estado}
                  </span>
                </div>
              ))}
            </div>
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
    </div>
  );
}

function MiniCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {icon} {label}
      </div>
      <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100 text-sm">
        {value}
      </div>
    </div>
  );
}

// ── FOTOS TAB ──

function FotosTab({
  clienteId,
  fotos,
  onAbrirGaleria,
}: {
  clienteId: string;
  fotos: FotoGaleria[];
  onAbrirGaleria: (i: number) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-medium text-zinc-900 dark:text-zinc-50">
        <Camera size={18} className="text-zinc-400 dark:text-zinc-500" />
        Fotos de fachada ({fotos.length})
      </h2>

      <SubirFotos clienteId={clienteId} />

      {fotos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 py-10 text-center dark:border-zinc-700">
          <ImagePlus size={32} className="text-zinc-400 dark:text-zinc-500" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin fotos de fachada todavía.</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Subí la primera foto desde arriba.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {fotos.map((f, i) => (
              <div
                key={f.id}
                className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700"
              >
                <button
                  type="button"
                  onClick={() => onAbrirGaleria(i)}
                  className="block w-full cursor-pointer transition-transform hover:scale-[1.02]"
                  aria-label={`Abrir foto de fachada ${i + 1}`}
                >
                  <img
                    src={f.url}
                    alt={`Foto de fachada ${i + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                </button>
                <div className="flex items-center justify-between border-t border-zinc-100 px-2 py-1.5 dark:border-zinc-800">
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    Foto {i + 1}
                  </span>
                </div>
                <QuitarFoto clienteId={clienteId} foto={f} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubirFotos({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(subirFotosCliente.bind(null, clienteId), null);
  const [blobs, setBlobs] = useState<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comprimiendo, setComprimiendo] = useState(false);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      startTransition(() => {
        setBlobs([]);
        setError(null);
      });
    }
  }, [state, router]);

  async function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const nuevos: Blob[] = [];
    let algunError = false;

    for (const f of files) {
      const mensaje = validarImagen(f);
      if (mensaje) {
        setError(mensaje);
        algunError = true;
        continue;
      }
      try {
        setComprimiendo(true);
        const blob = await comprimirImagen(f);
        nuevos.push(blob);
      } catch {
        setError('No se pudo comprimir una de las fotos.');
        algunError = true;
      }
    }
    setComprimiendo(false);

    if (nuevos.length > 0) {
      setBlobs((prev) => [...prev, ...nuevos]);
      if (!algunError) setError(null);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete('fotos');
    blobs.forEach((b, i) => fd.append('fotos', b, `fachada-${i}.jpg`));
    // useActionState exige llamar la acción dentro de una transición (React
    // lo advierte y `pending` no se actualizaría correctamente).
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600">
        <Upload size={32} className="text-zinc-400 dark:text-zinc-500" />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Elegir fotos</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">JPG, PNG o WebP · hasta 2.5 MB c/u</span>
        <input
          type="file"
          name="fotos"
          multiple
          accept="image/*"
          onChange={handleFilesChange}
          className="sr-only"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || blobs.length === 0}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? 'Subiendo…' : blobs.length > 0 ? `Subir fotos (${blobs.length})` : 'Subir fotos'}
        </button>
      </div>
      {blobs.length > 0 && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          {blobs.length} foto(s) lista(s) para subir · se comprimen automáticamente (máx {MAX_LADO}px)
        </p>
      )}
      {comprimiendo && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Comprimiendo fotos…</p>
      )}
      {error && (
        <p className="w-full text-sm text-red-700 dark:text-red-400">{error}</p>
      )}
      {state?.error && (
        <p className="w-full text-sm text-red-700 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}

function QuitarFoto({ clienteId, foto }: { clienteId: string; foto: FotoGaleria }) {
  const router = useRouter();
  const [state, formAction] = useActionState(eliminarFotoCliente.bind(null, clienteId), null);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction}>
      <input type="hidden" name="foto_id" value={foto.id} />
      <input type="hidden" name="ruta" value={foto.url.split('/public/fotos-clientes/')[1] ?? ''} />
      <button
        type="submit"
        aria-label="Eliminar foto"
        title="Eliminar foto"
        onClick={(e) => {
          if (!window.confirm('¿Eliminar esta foto?')) e.preventDefault();
        }}
        className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/60 p-1.5 text-white shadow transition-colors hover:bg-red-600"
      >
        <X size={14} />
      </button>
    </form>
  );
}

// ── DATOS TAB ──

function DatosTab({ cliente }: { cliente: ClienteRow }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateCliente, null);

  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Datos del cliente</h2>
          <button onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
            Editar
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" value={cliente.nombre} />
          <Field label="Negocio" value={cliente.negocio} />
          <Field label="Cédula" value={cliente.cedula} />
          <Field label="Teléfono 1" value={cliente.telefono_1} />
          <Field label="Teléfono 2" value={cliente.telefono_2} />
          <Field label="WhatsApp" value={cliente.whatsapp} />
          <Field label="Tipo" value={cliente.tipo_cliente} />
          <Field label="Horario" value={cliente.horario_preferido} />
          <Field label="Días" value={cliente.dias_preferidos} />
          <Field label="Contacto pref." value={cliente.contacto_preferido} />
          <Field label="Observaciones" value={cliente.observaciones} span />
          <Field label="Registro" value={cliente.fecha_registro ? new Date(cliente.fecha_registro).toLocaleDateString() : null} />
        </dl>
      </div>
    );
  }

  const cedulaInicial = splitCedula(cliente.cedula);
  const whatsappInicial = splitWhatsApp(cliente.whatsapp);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Editar datos</h2>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={cliente.id} />

        {/* Datos básicos */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Datos básicos</p>
          <Grid2>
            <IField label="Nombre *" name="nombre" def={cliente.nombre} />
            <IField label="Negocio" name="negocio" def={cliente.negocio || ''} />
          </Grid2>
          <InputDocumento prefijoInicial={cedulaInicial.prefijo} numeroInicial={cedulaInicial.numero} />
        </div>

        {/* Contacto */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Contacto</p>
          <Grid2>
            <InputWhatsapp
              paisInicial={whatsappInicial.pais}
              numeroInicial={whatsappInicial.numero}
              codigoOtroInicial={whatsappInicial.codigoOtro}
            />
            <IField label="Teléfono (opcional)" name="telefono_1" def={cliente.telefono_1 || ''} type="tel" />
          </Grid2>
        </div>

        {/* Dirección de entrega */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Dirección de entrega</p>
          <div>
            <label htmlFor="direccion_entrega" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Dirección de entrega
            </label>
            <textarea
              id="direccion_entrega"
              name="direccion_entrega"
              rows={2}
              defaultValue={cliente.direccion_entrega ?? ''}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              La dirección que mandás por WhatsApp.
            </p>
          </div>
        </div>

        {/* Observaciones */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Observaciones</p>
          <IField label="Observaciones" name="observaciones" def={cliente.observaciones || ''} ta />
        </div>

        {/* Columnas legacy que el form ya no muestra pero NO se pueden pisar
            al guardar (updateCliente vuelca todo el update map): viajan ocultas
            con su valor actual. */}
        <input type="hidden" name="telefono_2" value={cliente.telefono_2 ?? ''} />
        <input type="hidden" name="tipo_cliente" value={cliente.tipo_cliente ?? ''} />
        <input type="hidden" name="horario_preferido" value={cliente.horario_preferido ?? ''} />
        <input type="hidden" name="dias_preferidos" value={cliente.dias_preferidos ?? ''} />
        <input type="hidden" name="contacto_preferido" value={cliente.contacto_preferido ?? ''} />

        {state?.error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{state.error}</div>}
        {state?.success && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">Cambios guardados.</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setEditing(false)}
            className="rounded-md border px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// ── DIRECCIÓN TAB ──

function DireccionTab({ clienteId }: { clienteId: string }) {
  const [state, formAction] = useActionState(saveDireccion, null);
  const [locationLink, setLocationLink] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    getDireccion(clienteId).then((d) => {
      if (d) {
        setData(d as unknown as Record<string, string>);
        setLocationLink(d.link_mapa || '');
        if (d.latitud && d.longitud) {
          setCoords({ lat: d.latitud, lng: d.longitud });
        }
      }
      setLoaded(true);
    });
  }, [clienteId]);

  const handlePasteLocation = async () => {
    const text = await navigator.clipboard.readText();
    setLocationLink(text);
    await applyLink(text);
  };

  // Apply a pasted/typed link: try direct parse, then server-side short-link resolution
  const applyLink = async (link: string) => {
    // Empty link → clear coordinates
    if (!link.trim()) {
      setCoords(null);
      return;
    }
    const parsed = parseWhatsAppLocation(link);
    if (parsed) {
      setCoords(parsed);
      return;
    }
    // Short link (maps.app.goo.gl) — resolve server-side
    if (/maps\.app\.goo\.gl|goo\.gl|g\.co\/maps/.test(link)) {
      const resolved = await resolveMapLink(link);
      if (resolved) {
        setCoords(resolved);
        reverseGeocode(resolved.lat, resolved.lng);
      }
    }
  };

  // Reverse geocode: fill address fields from coordinates
  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`
      );
      const geo = await res.json();
      const a = geo?.address;
      if (a) {
        setData((prev) => ({
          ...(prev || {}),
          calle: a.road || a.pedestrian || prev?.calle || '',
          avenida: a.avenue || prev?.avenida || '',
          sector: a.neighbourhood || a.suburb || prev?.sector || '',
          urbanizacion: a.residential || prev?.urbanizacion || '',
          ciudad: a.city || a.town || a.village || prev?.ciudad || '',
          estado: a.state || prev?.estado || '',
        }));
        setLocationLink(`https://www.google.com/maps?q=${lat},${lng}`);
      }
    } catch {
      // Reverse geocoding failed — keep existing fields
    } finally {
      setGeocoding(false);
    }
  };

  const handleMapMove = (lat: number, lng: number) => {
    setCoords({ lat, lng });
    reverseGeocode(lat, lng);
  };

  if (!loaded) return <p className="text-sm text-zinc-400">Cargando…</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Dirección</h2>

      {/* ── MAPA (lo más importante, arriba) ── */}
      <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-700">
        <div className="h-72 w-full">
          <MapaEditable
            lat={coords?.lat ?? 10.4806}
            lng={coords?.lng ?? -66.9036}
            onMove={handleMapMove}
          />
        </div>
        <div className="flex items-center justify-between bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {coords
              ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
              : 'Hacé click en el mapa para ubicar la dirección'}
          </span>
          {coords && (
            <a
              href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink size={10} /> Google Maps
            </a>
          )}
        </div>
      </div>

      {/* ── Formulario (debajo) ── */}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="cliente_id" value={clienteId} />
        {geocoding && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Rellenando dirección desde el mapa…</p>
        )}
        <Grid2>
          <IField label="Calle" name="calle" def={data?.calle || ''} />
          <IField label="Avenida" name="avenida" def={data?.avenida || ''} />
        </Grid2>
        <Grid2>
          <IField label="Sector" name="sector" def={data?.sector || ''} />
          <IField label="Urbanización" name="urbanizacion" def={data?.urbanizacion || ''} />
        </Grid2>
        <Grid2>
          <IField label="Ciudad" name="ciudad" def={data?.ciudad || ''} />
          <IField label="Estado" name="estado" def={data?.estado || ''} />
        </Grid2>
        <IField label="Referencia" name="referencia" def={data?.referencia || ''} ta />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Link de Google Maps</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={locationLink}
              onChange={(e) => {
                setLocationLink(e.target.value);
                applyLink(e.target.value);
              }}
              placeholder="Pega un link de Google Maps o WhatsApp"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button type="button" onClick={handlePasteLocation}
              className="rounded-md border px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400">
              Pegar
            </button>
          </div>
        </div>

        <input type="hidden" name="latitud" value={coords?.lat || ''} />
        <input type="hidden" name="longitud" value={coords?.lng || ''} />
        <input type="hidden" name="link_mapa" value={locationLink} />

        {state && 'error' in state && (state as { error: string }).error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</div>
        )}
        {state && 'success' in state && (state as { success: boolean }).success && (
          <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">Dirección guardada.</div>
        )}

        <button type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
          Guardar dirección
        </button>
      </form>
    </div>
  );
}

// ── BOTELLONES TAB ──

function BotellonesTab({ clienteId }: { clienteId: string }) {
  const [botellones, setBotellones] = useState<Array<{ id: string; codigo: string; estado: string; fecha_creacion: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('botellones')
      .select('id, codigo, estado, fecha_creacion')
      .eq('cliente_id', clienteId)
      .order('fecha_creacion', { ascending: false })
      .then(({ data }) => { setBotellones((data as unknown as typeof botellones) || []); setLoading(false); });
  }, [clienteId]);

  const estadoBadge = ESTADO_COLORS;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Botellones asignados {!loading && <span className="text-sm font-normal text-zinc-400">({botellones.length})</span>}
      </h2>
      {loading ? (
        <p className="text-sm text-zinc-400">Cargando…</p>
      ) : botellones.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay botellones asignados a este cliente.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-500">Código</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Estado</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Fecha creación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {botellones.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-mono text-xs">{b.codigo}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${estadoBadge[b.estado] || 'bg-zinc-100 text-zinc-600'}`}>
                      {b.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {b.fecha_creacion ? new Date(b.fecha_creacion).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SHARED ──

const TIPOS_DOCUMENTO_VALIDOS = ['V', 'E', 'J', 'G', 'P'];

/**
 * Divide la cédula almacenada ("V-12345678") en prefijo + dígitos para
 * precargar InputDocumento. Sin guión → todo el string son dígitos (prefijo V).
 * Best-effort: un prefijo inválido cae a 'V' y el operador puede corregirlo.
 */
function splitCedula(cedula?: string | null): { prefijo: string; numero: string } {
  const raw = cedula ?? '';
  const idx = raw.indexOf('-');
  if (idx === -1) return { prefijo: 'V', numero: raw };
  const prefijo = raw.slice(0, idx).trim();
  return {
    prefijo: TIPOS_DOCUMENTO_VALIDOS.includes(prefijo) ? prefijo : 'V',
    numero: raw.slice(idx + 1).trim(),
  };
}

/**
 * Divide el WhatsApp almacenado (formato internacional "584141234567") en
 * país + número nacional para precargar InputWhatsapp. Best-effort: un número
 * que no arranca con ningún código listado cae a "Otro" con el código de los
 * primeros 1-3 dígitos (si no se puede, '58'). El operador puede corregirlo.
 */
function splitWhatsApp(digitos?: string | null): { pais: string; numero: string; codigoOtro: string } {
  const d = (digitos ?? '').replace(/\D/g, '');
  if (!d) return { pais: '58', numero: '', codigoOtro: '' };
  for (const codigo of ['58', '57', '34', '1', '52', '54']) {
    if (d.startsWith(codigo)) {
      // Estados Unidos (+1) solo se reconoce con el formato completo (11 dígitos).
      if (codigo === '1' && d.length !== 11) break;
      return { pais: codigo, numero: d.slice(codigo.length), codigoOtro: '' };
    }
  }
  const codigoOtro = d.slice(0, 3) || '58';
  return { pais: 'otro', numero: d.slice(codigoOtro.length), codigoOtro };
}

function Field({ label, value, span }: { label: string; value: string | null; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">{value || '—'}</dd>
    </div>
  );
}

function IField({ label, name, def, type = 'text', cls = '', ta }: { label: string; name: string; def: string; type?: string; cls?: string; ta?: boolean }) {
  const inputClass = `mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${cls}`;
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      {ta ? (
        <textarea id={name} name={name} defaultValue={def} rows={3} className={inputClass} />
      ) : (
        <input id={name} name={name} type={type} defaultValue={def} className={inputClass} />
      )}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}