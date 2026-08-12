'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCliente } from '@/lib/db/clientes';

const TIPOS_CLIENTE = ['casa', 'negocio', 'oficina', 'otro'];
const HORARIOS = ['mañana', 'tarde', 'noche'];
const CONTACTOS = ['telefono_1', 'telefono_2', 'whatsapp'];

export default function NuevoClientePage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createCliente, null);

  // Redirect on success — useActionState doesn't propagate server-side redirect()
  useEffect(() => {
    if (state?.clienteId) {
      router.push(`/clientes/${state.clienteId}`);
    }
  }, [state?.clienteId, router]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Nuevo Cliente
      </h1>

      <form action={formAction} className="mt-6 space-y-6">
        {/* Nombre + Negocio */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nombre *
            </label>
            <input id="nombre" name="nombre" type="text" required
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
          </div>
          <div>
            <label htmlFor="negocio" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Negocio
            </label>
            <input id="negocio" name="negocio" type="text"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
          </div>
        </div>

        {/* Cédula */}
        <div>
          <label htmlFor="cedula" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Cédula
          </label>
          <input id="cedula" name="cedula" type="text"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 md:max-w-sm" />
        </div>

        {/* Teléfonos */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="telefono_1" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Teléfono 1 *
            </label>
            <input id="telefono_1" name="telefono_1" type="tel" required
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
          </div>
          <div>
            <label htmlFor="telefono_2" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Teléfono 2
            </label>
            <input id="telefono_2" name="telefono_2" type="tel"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
          </div>
          <div>
            <label htmlFor="whatsapp" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              WhatsApp
            </label>
            <input id="whatsapp" name="whatsapp" type="tel"
              placeholder="584141234567"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
          </div>
        </div>

        {/* Tipo + Horario + Contacto */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="tipo_cliente" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tipo de cliente
            </label>
            <select id="tipo_cliente" name="tipo_cliente"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
              <option value="">Seleccionar</option>
              {TIPOS_CLIENTE.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="horario_preferido" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Horario preferido
            </label>
            <select id="horario_preferido" name="horario_preferido"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
              <option value="">Seleccionar</option>
              {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="contacto_preferido" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Contacto preferido
            </label>
            <select id="contacto_preferido" name="contacto_preferido"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
              <option value="">Seleccionar</option>
              {CONTACTOS.map(c => <option key={c} value={c}>{c === 'telefono_1' ? 'Teléfono 1' : c === 'telefono_2' ? 'Teléfono 2' : 'WhatsApp'}</option>)}
            </select>
          </div>
        </div>

        {/* Días preferidos */}
        <div>
          <label htmlFor="dias_preferidos" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Días preferidos
          </label>
          <input id="dias_preferidos" name="dias_preferidos" type="text" placeholder="Lunes, Miércoles, Viernes"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 md:max-w-sm" />
        </div>

        {/* Observaciones */}
        <div>
          <label htmlFor="observaciones" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Observaciones
          </label>
          <textarea id="observaciones" name="observaciones" rows={3}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
        </div>

        {state?.error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
            ✅ Cliente creado. Redirigiendo…
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
