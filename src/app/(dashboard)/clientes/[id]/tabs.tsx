'use client';

import { useState, useEffect } from 'react';
import { useActionState } from 'react';
import { updateCliente } from '@/lib/db/clientes';
import type { ClienteRow } from '@/lib/db/clientes';
import { FidelidadTab } from './fidelidad-tab';

const TABS = ['Datos', 'Historial', 'Fidelidad'] as const;
type Tab = (typeof TABS)[number];

export function ClienteTabs({ cliente }: { cliente: ClienteRow }) {
  const [activeTab, setActiveTab] = useState<Tab>('Datos');

  return (
    <div className="mt-6">
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
      <div className="mt-6">
        {activeTab === 'Datos' && <DatosTab cliente={cliente} />}
        {activeTab === 'Historial' && <HistorialTab clienteId={cliente.id} />}
        {activeTab === 'Fidelidad' && (
          <FidelidadTab clienteId={cliente.id} totalRecargas={cliente.total_recargas} />
        )}
      </div>
    </div>
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

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Editar datos</h2>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={cliente.id} />
        <Grid2>
          <IField label="Nombre *" name="nombre" def={cliente.nombre} />
          <IField label="Negocio" name="negocio" def={cliente.negocio || ''} />
        </Grid2>
        <IField label="Cédula" name="cedula" def={cliente.cedula || ''} cls="max-w-sm" />
        <Grid2>
          <IField label="Teléfono 1 *" name="telefono_1" def={cliente.telefono_1 || ''} type="tel" />
          <IField label="Teléfono 2" name="telefono_2" def={cliente.telefono_2 || ''} type="tel" />
        </Grid2>
        <IField label="WhatsApp" name="whatsapp" def={cliente.whatsapp || ''} type="tel" cls="max-w-sm" />
        <Grid2>
          <IField label="Tipo" name="tipo_cliente" def={cliente.tipo_cliente || ''} />
          <IField label="Horario" name="horario_preferido" def={cliente.horario_preferido || ''} />
        </Grid2>
        <IField label="Días preferidos" name="dias_preferidos" def={cliente.dias_preferidos || ''} cls="max-w-sm" />
        <IField label="Contacto preferido" name="contacto_preferido" def={cliente.contacto_preferido || ''} cls="max-w-sm" />
        <IField label="Observaciones" name="observaciones" def={cliente.observaciones || ''} ta />

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

// ── HISTORIAL TAB ──

function HistorialTab({ clienteId }: { clienteId: string }) {
  const [recargas, setRecargas] = useState<Array<{ id: string; fecha: string; hora: string; botellones: { codigo: string } | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );
      supabase.from('recargas')
        .select('id, fecha, hora, botellon_id, botellones(codigo), realizada_por')
        .eq('cliente_id', clienteId)
        .order('fecha', { ascending: false })
        .order('hora', { ascending: false })
        .limit(50)
        .then(({ data }) => { setRecargas((data as unknown as typeof recargas) || []); setLoading(false); });
    });
  }, [clienteId]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Historial de recargas {!loading && <span className="text-sm font-normal text-zinc-400">({recargas.length})</span>}
      </h2>
      {loading ? (
        <p className="text-sm text-zinc-400">Cargando…</p>
      ) : recargas.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay recargas registradas para este cliente.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-500">Fecha</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Hora</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Botellón</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {recargas.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{new Date(r.fecha).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-zinc-500">{r.hora?.slice(0, 5)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.botellones?.codigo || '—'}</td>
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