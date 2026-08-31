'use client';

import { Suspense, useState } from 'react';
import { useActionState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createCliente } from '@/lib/db/clientes';
import { resolveMapLink } from '@/lib/db/direcciones';
import { parseWhatsAppLocation } from '@/lib/utils/location';
import { FachadaUploader } from '@/components/clientes/fachada-uploader';
import { InputDocumento } from '@/components/clientes/input-documento';
import { InputWhatsapp } from '@/components/clientes/input-whatsapp';

const MapaPreview = dynamic(() => import('@/components/clientes/mapa-preview'), { ssr: false });

const INPUT_CLASS =
  'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50';

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function NuevoClienteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Opcional: ?botellon_id=… cuando el flujo viene de una sesión de carga sin
  // cliente asignado — tras crear el cliente se vuelve a la ficha del botellón.
  const botellonId = searchParams.get('botellon_id');
  const [state, formAction, pending] = useActionState(createCliente, null);
  const [fotosComprimidas, setFotosComprimidas] = useState<Blob[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Redirect on success — useActionState doesn't propagate server-side redirect()
  useEffect(() => {
    if (state?.clienteId) {
      if (botellonId) {
        router.push(`/botellones/${botellonId}`);
      } else {
        router.push(`/clientes/${state.clienteId}`);
      }
    }
  }, [state?.clienteId, botellonId, router]);

  // Link de Google Maps/WhatsApp → coordenadas (para el mapa preview y los
  // hidden latitud/longitud). Primero parseo directo; si es short link
  // (maps.app.goo.gl) se resuelve server-side.
  async function handleLinkChange(e: React.ChangeEvent<HTMLInputElement>) {
    const link = e.target.value;
    if (!link.trim()) {
      setCoords(null);
      return;
    }
    const parsed = parseWhatsAppLocation(link);
    if (parsed) {
      setCoords(parsed);
      return;
    }
    if (/maps\.app\.goo\.gl|goo\.gl|g\.co\/maps/.test(link)) {
      const resolved = await resolveMapLink(link);
      setCoords(resolved);
      return;
    }
    setCoords(null);
  }

  // Las fotos viajan COMPRIMIDAS (blobs del FachadaUploader), no los archivos
  // originales del input. Por eso interceptamos el submit y reconstruimos el
  // FormData con los blobs bajo `fotos`. Los demás campos (pais_whatsapp,
  // link_mapa, latitud, longitud) son inputs comunes y viajan intactos.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete('fotos');
    fotosComprimidas.forEach((blob, i) => {
      fd.append('fotos', blob, `fachada-${i}.jpg`);
    });
    formAction(fd);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Nuevo Cliente
      </h1>

      <form action={formAction} onSubmit={handleSubmit} className="mt-6 space-y-6">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">* obligatorio</p>

        {/* Datos básicos */}
        <Card titulo="Datos básicos">
          <Grid2>
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nombre *
              </label>
              <input id="nombre" name="nombre" type="text" required className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="negocio" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Negocio
              </label>
              <input id="negocio" name="negocio" type="text" className={INPUT_CLASS} />
            </div>
          </Grid2>

          <InputDocumento />
        </Card>

        {/* Contacto (WhatsApp primero) */}
        <Card titulo="Contacto">
          <Grid2>
            <InputWhatsapp />
            <div>
              <label htmlFor="telefono_1" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Teléfono (opcional)
              </label>
              <input
                id="telefono_1"
                name="telefono_1"
                type="tel"
                minLength={7}
                maxLength={15}
                pattern="\d{7,15}"
                title="Solo dígitos, entre 7 y 15"
                className={INPUT_CLASS}
              />
            </div>
          </Grid2>
        </Card>

        {/* Dirección de entrega */}
        <Card titulo="Dirección de entrega">
          <div>
            <label htmlFor="direccion_entrega" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Dirección de entrega
            </label>
            <textarea id="direccion_entrega" name="direccion_entrega" rows={2} className={INPUT_CLASS} />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              La dirección que mandás por WhatsApp para que el repartidor llegue.
            </p>
          </div>

          <div>
            <label htmlFor="link_mapa" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Link de Google Maps (opcional)
            </label>
            <input
              id="link_mapa"
              name="link_mapa"
              type="text"
              onChange={handleLinkChange}
              placeholder="Pega un link de Google Maps o WhatsApp"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Se muestra un mapa con la ubicación
            </p>
          </div>

          {coords && (
            <>
              <MapaPreview lat={coords.lat} lng={coords.lng} />
              <input type="hidden" name="latitud" value={coords.lat} />
              <input type="hidden" name="longitud" value={coords.lng} />
            </>
          )}
        </Card>

        {/* Fotos de fachada */}
        <Card titulo="Fotos de fachada · opcional">
          <FachadaUploader value={fotosComprimidas} onChange={setFotosComprimidas} />
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Fotos referenciales de la fachada/dirección para que el repartidor ubique el lugar.
          </p>
        </Card>

        {/* Observaciones */}
        <Card titulo="Observaciones · opcional">
          <div>
            <label htmlFor="observaciones" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Observaciones
            </label>
            <textarea id="observaciones" name="observaciones" rows={3} className={INPUT_CLASS} />
          </div>
        </Card>

        {/* Asignación en un solo paso: llega con ?botellon_id=… desde la sesión */}
        {botellonId && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <input type="hidden" name="botellon_id" value={botellonId} />
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                name="asignar_botellon"
                defaultChecked
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900"
              />
              Asignar este botellón a este cliente
            </label>
          </div>
        )}

        {state?.error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </div>
        )}
        {state?.avisoFotos && (
          <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {state.avisoFotos}
          </div>
        )}
        {state?.success && (
          <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
            ✅ Cliente creado. Redirigiendo…
            {botellonId && (
              <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                El cliente se creó; ahora asignalo al botellón.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
            {pending ? 'Creando…' : 'Crear cliente'}
          </button>
          <Link href="/clientes"
            className="rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NuevoClientePage() {
  // useSearchParams must live under a Suspense boundary in this Next version
  // or the static prerender of this client page fails the production build.
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-4xl px-4 py-8 text-sm text-zinc-400">Cargando…</div>}
    >
      <NuevoClienteForm />
    </Suspense>
  );
}