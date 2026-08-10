'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { updateCliente } from '@/lib/db/clientes';
import type { ClienteRow } from '@/lib/db/clientes';

const TABS = ['Datos', 'Dirección', 'Fotos', 'Botellones', 'Historial'] as const;
type Tab = (typeof TABS)[number];

export function ClienteTabs({ cliente }: { cliente: ClienteRow }) {
  const [activeTab, setActiveTab] = useState<Tab>('Datos');

  return (
    <div className="mt-6">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'Datos' && <DatosTab cliente={cliente} />}
        {activeTab === 'Dirección' && <PlaceholderTab title="Dirección" />}
        {activeTab === 'Fotos' && <PlaceholderTab title="Fotos" />}
        {activeTab === 'Botellones' && <PlaceholderTab title="Botellones" />}
        {activeTab === 'Historial' && <PlaceholderTab title="Historial" />}
      </div>
    </div>
  );
}

/** HIST-3.3: Editable data tab */
function DatosTab({ cliente }: { cliente: ClienteRow }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateCliente, null);

  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Datos del cliente</h2>
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
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

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Editar datos</h2>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={cliente.id} />
        <Grid2>
          <InputField label="Nombre *" name="nombre" defaultValue={cliente.nombre} />
          <InputField label="Negocio" name="negocio" defaultValue={cliente.negocio || ''} />
        </Grid2>
        <InputField label="Cédula" name="cedula" defaultValue={cliente.cedula || ''} className="max-w-sm" />
        <Grid2>
          <InputField label="Teléfono 1 *" name="telefono_1" defaultValue={cliente.telefono_1 || ''} type="tel" />
          <InputField label="Teléfono 2" name="telefono_2" defaultValue={cliente.telefono_2 || ''} type="tel" />
        </Grid2>
        <InputField label="WhatsApp" name="whatsapp" defaultValue={cliente.whatsapp || ''} type="tel" className="max-w-sm" />
        <Grid2>
          <InputField label="Tipo" name="tipo_cliente" defaultValue={cliente.tipo_cliente || ''} />
          <InputField label="Horario" name="horario_preferido" defaultValue={cliente.horario_preferido || ''} />
        </Grid2>
        <InputField label="Días preferidos" name="dias_preferidos" defaultValue={cliente.dias_preferidos || ''} className="max-w-sm" />
        <InputField label="Contacto preferido" name="contacto_preferido" defaultValue={cliente.contacto_preferido || ''} className="max-w-sm" />
        <InputField label="Observaciones" name="observaciones" defaultValue={cliente.observaciones || ''} textarea />

        {state?.error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
            Cambios guardados.
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setEditing(false)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        {title} — próximamente
      </p>
    </div>
  );
}

/** Read-only field */
function Field({ label, value, span }: { label: string; value: string | null; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">{value || '—'}</dd>
    </div>
  );
}

/** Editable input field */
function InputField({
  label,
  name,
  defaultValue,
  type = 'text',
  className = '',
  textarea,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  className?: string;
  textarea?: boolean;
}) {
  const baseClass =
    'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50';
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {textarea ? (
        <textarea id={name} name={name} defaultValue={defaultValue} rows={3} className={baseClass} />
      ) : (
        <input id={name} name={name} type={type} defaultValue={defaultValue} className={baseClass} />
      )}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
