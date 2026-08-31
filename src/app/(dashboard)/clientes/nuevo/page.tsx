'use client';

import { Suspense, useState } from 'react';
import { useActionState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createCliente } from '@/lib/db/clientes';
import { FachadaUploader } from '@/components/clientes/fachada-uploader';

const TIPOS_CLIENTE = ['casa', 'negocio', 'oficina', 'otro'];
const HORARIOS = ['mañana', 'tarde', 'noche'];
const CONTACTOS = ['telefono_1', 'telefono_2', 'whatsapp'];

const INPUT_CLASS =
  'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50';

function NuevoClienteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Opcional: ?botellon_id=… cuando el flujo viene de una sesión de carga sin
  // cliente asignado — tras crear el cliente se vuelve a la ficha del botellón.
  const botellonId = searchParams.get('botellon_id');
  const [state, formAction, pending] = useActionState(createCliente, null);
  const [fotosComprimidas, setFotosComprimidas] = useState<Blob[]>([]);

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

  // Las fotos viajan COMPRIMIDAS (blobs del FachadaUploader), no los archivos
  // originales del input. Por eso interceptamos el submit y reconstruimos el
  // FormData con los blobs bajo `fotos`.
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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Nuevo Cliente
      </h1>

      <form action={formAction} onSubmit={handleSubmit} className="mt-6 space-y-6">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">* obligatorio</p>

        {/* Datos básicos */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Datos básicos</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>

          <div>
            <label htmlFor="cedula" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cédula
            </label>
            <input
              id="cedula"
              name="cedula"
              type="text"
              pattern="[VE]-?[0-9]{6,8}"
              title="Ej: V-12345678"
              className={`${INPUT_CLASS} md:max-w-sm`}
            />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Ej: V-12345678
            </p>
          </div>
        </section>

        {/* Contacto (WhatsApp primero) */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Contacto</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="whatsapp" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                WhatsApp
              </label>
              <input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                placeholder="0412… o 58414…"
                minLength={7}
                maxLength={15}
                pattern="[0-9]{7,15}"
                title="Solo dígitos, entre 7 y 15"
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                La comunicación es por WhatsApp. Se guarda en formato internacional 58…
              </p>
            </div>
            <div>
              <label htmlFor="telefono_1" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Teléfono 1 *
              </label>
              <input
                id="telefono_1"
                name="telefono_1"
                type="tel"
                required
                minLength={7}
                maxLength={15}
                pattern="\d{7,15}"
                title="Solo dígitos, entre 7 y 15"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="telefono_2" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Teléfono 2
              </label>
              <input
                id="telefono_2"
                name="telefono_2"
                type="tel"
                minLength={7}
                maxLength={15}
                pattern="\d{7,15}"
                title="Solo dígitos, entre 7 y 15"
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Dirección de entrega */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Dirección de entrega
          </h2>
          <div>
            <label htmlFor="direccion_entrega" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Dirección de entrega
            </label>
            <textarea id="direccion_entrega" name="direccion_entrega" rows={2} className={INPUT_CLASS} />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              La dirección que mandás por WhatsApp para que el repartidor llegue.
            </p>
          </div>
        </section>

        {/* Preferencias */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Preferencias</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="tipo_cliente" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tipo de cliente
              </label>
              <select id="tipo_cliente" name="tipo_cliente" className={INPUT_CLASS}>
                <option value="">Seleccionar</option>
                {TIPOS_CLIENTE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="horario_preferido" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Horario preferido
              </label>
              <select id="horario_preferido" name="horario_preferido" className={INPUT_CLASS}>
                <option value="">Seleccionar</option>
                {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="contacto_preferido" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Contacto preferido
              </label>
              <select id="contacto_preferido" name="contacto_preferido" className={INPUT_CLASS}>
                <option value="">Seleccionar</option>
                {CONTACTOS.map(c => <option key={c} value={c}>{c === 'telefono_1' ? 'Teléfono 1' : c === 'telefono_2' ? 'Teléfono 2' : 'WhatsApp'}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="dias_preferidos" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Días preferidos
            </label>
            <input id="dias_preferidos" name="dias_preferidos" type="text" placeholder="Lunes, Miércoles, Viernes"
              className={`${INPUT_CLASS} md:max-w-sm`} />
          </div>
        </section>

        {/* Fotos de fachada */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Fotos de fachada
          </h2>
          <FachadaUploader value={fotosComprimidas} onChange={setFotosComprimidas} />
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Fotos referenciales de la fachada/dirección para que el repartidor ubique el lugar.
          </p>
        </section>

        {/* Observaciones */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Observaciones</h2>
          <div>
            <label htmlFor="observaciones" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Observaciones
            </label>
            <textarea id="observaciones" name="observaciones" rows={3} className={INPUT_CLASS} />
          </div>
        </section>

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
      fallback={<div className="mx-auto max-w-2xl px-4 py-8 text-sm text-zinc-400">Cargando…</div>}
    >
      <NuevoClienteForm />
    </Suspense>
  );
}