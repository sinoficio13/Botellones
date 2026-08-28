'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MessageCircle, Search, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type ClienteResult = {
  id: string;
  codigo: string;
  nombre: string;
  negocio: string | null;
  telefono_1: string | null;
  tipo_cliente: string | null;
  total_recargas: number;
  ultima_recarga: string | null;
};

export const dynamic = 'force-dynamic';

export default function BuscarPage() {
  const [tipos, setTipos] = useState<string[]>([]);
  const [tipoCliente, setTipoCliente] = useState('');
  const [recargaMin, setRecargaMin] = useState('');
  const [recargaMax, setRecargaMax] = useState('');
  const [activo30d, setActivo30d] = useState(false);
  const [sector, setSector] = useState('');
  const [results, setResults] = useState<ClienteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const supabase = createClient();

  // Fetch distinct tipo_cliente values on mount
  useEffect(() => {
    async function fetchTipos() {
      const { data } = await supabase
        .from('clientes')
        .select('tipo_cliente')
        .not('tipo_cliente', 'is', null);
      if (data) {
        const unique = [...new Set(data.map((d) => d.tipo_cliente as string))].sort();
        setTipos(unique);
      }
    }
    fetchTipos();
  }, [supabase]);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);

    // Build base query
    let query = supabase
      .from('clientes')
      .select('id, codigo, nombre, negocio, telefono_1, tipo_cliente', { count: 'exact' });

    if (tipoCliente) {
      query = query.eq('tipo_cliente', tipoCliente);
    }

    const { data: clientes, error } = await query.order('nombre').limit(100);

    if (error || !clientes) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Enrich with recarga stats and apply client-side filters
    const enriched: ClienteResult[] = [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    for (const c of clientes) {
      // Recarga count
      const recargaQuery = supabase
        .from('recargas')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', c.id);

      const { count: total_recargas } = await recargaQuery;

      // Filter by recarga range (client-side)
      const total = total_recargas || 0;
      const recMin = recargaMin ? parseInt(recargaMin) : null;
      const recMax = recargaMax ? parseInt(recargaMax) : null;
      if (recMin !== null && total < recMin) continue;
      if (recMax !== null && total > recMax) continue;

      // Get última recarga
      const { data: ultimaData } = await supabase
        .from('recargas')
        .select('fecha')
        .eq('cliente_id', c.id)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

      const ultima = ultimaData?.fecha || null;

      // Filter by activity (checkbox: last 30 days)
      if (activo30d) {
        if (!ultima || ultima < cutoffDate) continue;
      }

      // Filter by sector (client-side — we need direcciones for this)
      if (sector.trim()) {
        const { data: dirs } = await supabase
          .from('direcciones')
          .select('sector')
          .eq('cliente_id', c.id)
          .ilike('sector', `%${sector.trim()}%`)
          .limit(1);

        if (!dirs || dirs.length === 0) continue;
      }

      enriched.push({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        negocio: c.negocio,
        telefono_1: c.telefono_1,
        tipo_cliente: c.tipo_cliente,
        total_recargas: total,
        ultima_recarga: ultima,
      });
    }

    setResults(enriched);
    setLoading(false);
  }, [supabase, tipoCliente, recargaMin, recargaMax, activo30d, sector]);

  const handleClear = () => {
    setTipoCliente('');
    setRecargaMin('');
    setRecargaMax('');
    setActivo30d(false);
    setSector('');
    setResults([]);
    setSearched(false);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Búsqueda avanzada
        </h1>
      </div>

      {/* Filters form */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Tipo cliente */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Tipo de cliente
            </label>
            <select
              value={tipoCliente}
              onChange={(e) => setTipoCliente(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">Todos</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Recarga range */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Recargas (mín — máx)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min="0"
                placeholder="Mín"
                value={recargaMin}
                onChange={(e) => setRecargaMin(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                type="number"
                min="0"
                placeholder="Máx"
                value={recargaMax}
                onChange={(e) => setRecargaMax(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>

          {/* Active in last 30 days */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Actividad
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={activo30d}
                onChange={(e) => setActivo30d(e.target.checked)}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-700"
              />
              Recarga en últimos 30 días
            </label>
          </div>

          {/* Sector */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Sector
            </label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Filtrar por sector (ej. Centro, Norte)..."
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:max-w-md"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Search size={16} />
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <RotateCcw size={16} />
            Limpiar
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Código</th>
                <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Nombre</th>
                <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Negocio</th>
                <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Teléfono</th>
                <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Tipo</th>
                <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Última recarga</th>
                <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Total</th>
                <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">WA</th>
                <th className="px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {results.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-zinc-400">
                    Sin resultados con estos filtros
                  </td>
                </tr>
              )}
              {results.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">{c.codigo}</td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/clientes/${c.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {c.nombre}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                    {c.negocio || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                    {c.telefono_1 || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.tipo_cliente && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {c.tipo_cliente}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-zinc-500">
                    {c.ultima_recarga
                      ? new Date(c.ultima_recarga).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                    {c.total_recargas}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.telefono_1 && (
                      <a
                        href={`https://wa.me/${c.telefono_1.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded p-1 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                        title="Abrir WhatsApp"
                      >
                        <MessageCircle size={16} />
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <a
                      href={`/recargas/nueva?cliente_id=${c.id}`}
                      className="inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                    >
                      + Recarga
                    </a>
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
