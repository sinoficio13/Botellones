'use client';

import { useActionState, useState, useEffect } from 'react';
import { saveConfig } from './actions';
import { LogoUploader } from './logo-uploader';

/**
 * Admin configuration page: business name, contact info, and logo.
 * Only accessible by admin (enforced by middleware).
 */
export default function ConfiguracionPage() {
  const [state, formAction, pending] = useActionState(saveConfig, null);
  const [showSuccess, setShowSuccess] = useState(false);

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
            defaultValue="Botellón"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {/* Teléfono + Email en grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="telefono"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Teléfono
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
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
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {/* Logo upload */}
        <LogoUploader />

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
