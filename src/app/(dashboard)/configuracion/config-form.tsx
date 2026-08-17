'use client';

import { useActionState, useState, useEffect } from 'react';
import { saveConfig } from './actions';
import { LogoUploader } from './logo-uploader';
import type { BusinessConfig } from '@/lib/db/configuracion';

interface Props {
  initialConfig: BusinessConfig;
}

/**
 * Client form for the admin configuration page.
 * Fields are controlled and initialized from the saved config so
 * previously-saved values are always shown on load.
 */
export function ConfigForm({ initialConfig }: Props) {
  const [state, formAction, pending] = useActionState(saveConfig, null);
  const [showSuccess, setShowSuccess] = useState(false);

  const [nombre, setNombre] = useState(initialConfig.nombre_negocio);
  const [telefono, setTelefono] = useState(initialConfig.telefono);
  const [direccion, setDireccion] = useState(initialConfig.direccion);
  const [eslogan, setEslogan] = useState(initialConfig.eslogan);
  const [ctaQr, setCtaQr] = useState(initialConfig.cta_qr);

  // Toast is a side-effect driven by useActionState result — legitimate pattern per design
  useEffect(() => {
    if (state?.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [state?.success]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Configuración del Negocio
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Estos datos aparecen en el header, PDFs y etiquetas QR.
      </p>

      {/* Success toast */}
      {showSuccess && (
        <div className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Configuración guardada correctamente.
        </div>
      )}

      <form action={formAction} className="mt-6 space-y-6">
        {/* Nombre del negocio */}
        <div>
          <label
            htmlFor="nombre_negocio"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Nombre del negocio *
          </label>
          <input
            id="nombre_negocio"
            name="nombre_negocio"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {/* Eslogan */}
        <div>
          <label
            htmlFor="eslogan"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Eslogan
          </label>
          <input
            id="eslogan"
            name="eslogan"
            type="text"
            value={eslogan}
            onChange={(e) => setEslogan(e.target.value)}
            placeholder="Agua pura, directo a tu puerta"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Aparece en la etiqueta de los botellones.
          </p>
        </div>

        {/* CTA del QR */}
        <div>
          <label
            htmlFor="cta_qr"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Texto bajo el QR (call-to-action)
          </label>
          <input
            id="cta_qr"
            name="cta_qr"
            type="text"
            value={ctaQr}
            onChange={(e) => setCtaQr(e.target.value)}
            placeholder="Escaneá para recargar"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label
            htmlFor="telefono"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Teléfono / WhatsApp
          </label>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {/* Dirección */}
        <div>
          <label
            htmlFor="direccion"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Dirección
          </label>
          <input
            id="direccion"
            name="direccion"
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {/* Logo upload */}
        <LogoUploader initialLogo={initialConfig.logo_url} />

        {/* Error */}
        {state?.error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </form>
    </div>
  );
}
