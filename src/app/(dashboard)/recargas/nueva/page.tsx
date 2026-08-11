'use client';

import { useState, useEffect } from 'react';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getClientesForSearch, getBotellonesDelCliente, registrarRecarga } from '@/lib/db/recargas';
import { PremioAlertCard } from '@/components/fidelidad/premio-alert-card';

type Step = 'cliente' | 'botellon' | 'confirmar';

interface Cliente { id: string; nombre: string; codigo: string; telefono_1: string | null }
interface Botellon { id: string; codigo: string; estado: string }

export default function NuevaRecargaPage() {
  const sp = useSearchParams();
  const preselectCliente = sp.get('cliente_id');

  const [step, setStep] = useState<Step>(preselectCliente ? 'botellon' : 'cliente');
  const [search, setSearch] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [botellones, setBotellones] = useState<Botellon[]>([]);
  const [selectedBotellon, setSelectedBotellon] = useState<Botellon | null>(null);
  const [state, formAction, pending] = useActionState(registrarRecarga, null);
  const [showToast, setShowToast] = useState(false);

  // Search clients with debounce
  useEffect(() => {
    if (search.length < 2) { setClientes([]); return; }
    const t = setTimeout(() => { getClientesForSearch(search).then(setClientes); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Pre-select client if coming from client list
  useEffect(() => {
    if (preselectCliente) {
      getClientesForSearch(preselectCliente).then((c) => {
        const found = c.find((x: any) => x.id === preselectCliente);
        if (found) { setSelectedCliente(found); setStep('botellon'); }
      });
    }
  }, [preselectCliente]);

  useEffect(() => {
    if (selectedCliente) {
      getBotellonesDelCliente(selectedCliente.id).then(setBotellones);
    }
  }, [selectedCliente]);

  function handleConfirm() {
    if (state?.success) {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }

  if (showToast || state?.success) {
    // If a premio was generated, show the loyalty alert card
    if (state?.premioGenerado && selectedCliente) {
      return (
        <div className="mx-auto max-w-md px-4 py-16">
          <PremioAlertCard
            nombre={selectedCliente.nombre}
            telefono={selectedCliente.telefono_1}
            nivel={state.premioGenerado.nivel}
            clienteId={selectedCliente.id}
          />
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => {
                setStep('cliente');
                setSelectedCliente(null);
                setSelectedBotellon(null);
                setSearch('');
              }}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Registrar otra
            </button>
            <a
              href="/clientes"
              className="rounded-md border px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Ir a clientes
            </a>
          </div>
        </div>
      );
    }

    // Normal success view (no premio generated)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-lg bg-green-50 p-8 dark:bg-green-950">
          <p className="text-lg font-medium text-green-800 dark:text-green-300">✅ Recarga registrada</p>
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            {selectedCliente?.nombre} · {selectedBotellon?.codigo}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => { setStep('cliente'); setSelectedCliente(null); setSelectedBotellon(null); setSearch(''); }}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
              Registrar otra
            </button>
            <a href="/clientes"
              className="rounded-md border px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300">
              Ir a clientes
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {(['cliente', 'botellon', 'confirmar'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
              step === s ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900' :
              step > s || (step === 'confirmar' && s === 'botellon') ? 'bg-green-500 text-white' :
              'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'
            }`}>
              {step > s ? '✓' : i + 1}
            </div>
            <span className="text-xs text-zinc-400 hidden sm:inline">{s === 'cliente' ? 'Cliente' : s === 'botellon' ? 'Botellón' : 'Confirmar'}</span>
          </div>
        ))}
      </div>

      {/* Step 1: Search client */}
      {step === 'cliente' && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Buscar cliente</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, código o teléfono…"
            autoFocus
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          {clientes.length > 0 && (
            <div className="divide-y divide-zinc-200 rounded-lg border dark:divide-zinc-800 dark:border-zinc-700">
              {clientes.map((c) => (
                <button key={c.id} onClick={() => { setSelectedCliente(c); setStep('botellon'); }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{c.nombre}</p>
                    <p className="text-xs text-zinc-500">{c.codigo}</p>
                  </div>
                  <span className="text-xs text-zinc-400">{c.telefono_1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Pick bottle */}
      {step === 'botellon' && selectedCliente && (
        <div className="space-y-4">
          <button onClick={() => setStep('cliente')} className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400">
            ← Cambiar cliente
          </button>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <p className="text-sm font-medium">{selectedCliente.nombre}</p>
            <p className="text-xs text-zinc-500">{selectedCliente.codigo}</p>
          </div>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Seleccionar botellón</h2>
          {botellones.length === 0 ? (
            <p className="text-sm text-zinc-400">Este cliente no tiene botellones asignados.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {botellones.map((b) => (
                <button key={b.id} onClick={() => { setSelectedBotellon(b); setStep('confirmar'); }}
                  className={`rounded-lg border p-4 text-center transition-colors ${
                    selectedBotellon?.id === b.id
                      ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-800'
                      : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700'
                  }`}>
                  <p className="font-mono text-sm font-medium">{b.codigo}</p>
                  <p className="mt-1 text-xs text-zinc-500">{b.estado}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirmar' && selectedCliente && selectedBotellon && (
        <div className="space-y-4">
          <button onClick={() => setStep('botellon')} className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400">
            ← Cambiar botellón
          </button>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Confirmar recarga</h2>
          <div className="rounded-lg border p-4 space-y-3 dark:border-zinc-700">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Cliente</span>
              <span className="font-medium">{selectedCliente.nombre}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Botellón</span>
              <span className="font-mono font-medium">{selectedBotellon.codigo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Fecha</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <form action={formAction} onSubmit={handleConfirm}>
            <input type="hidden" name="cliente_id" value={selectedCliente.id} />
            <input type="hidden" name="botellon_id" value={selectedBotellon.id} />
            {state?.error && (
              <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{state.error}</div>
            )}
            <button type="submit" disabled={pending}
              className="mt-4 w-full rounded-md bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {pending ? 'Registrando…' : '✅ Confirmar recarga'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
