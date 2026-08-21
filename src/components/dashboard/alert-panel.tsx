'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { AlertTriangle, Gift, UserX, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type AlertaItem = {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  href: string;
  entidadId: string;
};

type AlertasPanel = {
  premiosPendientes: AlertaItem[];
  clientesInactivos30: AlertaItem[];
  clientesInactivos60: AlertaItem[];
};

// Merged view: combines both inactive arrays into one sorted list
type MergedAlerts = {
  premiosPendientes: AlertaItem[];
  clientesInactivos: AlertaItem[];
};

function mergeInactivos(raw: AlertasPanel): MergedAlerts {
  const merged = [...raw.clientesInactivos60, ...raw.clientesInactivos30];
  // Sort by days inactive (descending): extract number from "945d inactivo" format
  merged.sort((a, b) => daysFromText(b.descripcion) - daysFromText(a.descripcion));
  return {
    premiosPendientes: raw.premiosPendientes,
    clientesInactivos: merged,
  };
}

function daysFromText(text: string): number {
  const match = text.match(/^(\d+)d/);
  if (match) return parseInt(match[1], 10);
  if (text === 'Hoy') return 0;
  if (text === '1d inactivo') return 1;
  return -1; // "Sin recargas" → end of list
}

const PAGE_SIZE = 5;

type Category = {
  key: keyof MergedAlerts;
  label: string;
  icon: React.ReactNode;
};

const CATEGORIES: Category[] = [
  { key: 'premiosPendientes', label: 'Premios', icon: <Gift className="h-3.5 w-3.5" /> },
  { key: 'clientesInactivos', label: 'Inactivos', icon: <UserX className="h-3.5 w-3.5" /> },
];

/**
 * Alert panel: pill selector + paginated list (5 per page).
 * Subscribes to Supabase Realtime for live updates.
 */
export function AlertPanel({ data: initialData }: { data: AlertasPanel }) {
  const merged = mergeInactivos(initialData);
  const [data, setData] = useState<MergedAlerts>(merged);
  const [active, setActive] = useState<keyof MergedAlerts>(firstNonEmpty(merged));
  const [page, setPage] = useState(1);
  const supabase = createClient();

  // Reset page when switching categories
  const setCategory = useCallback((key: keyof MergedAlerts) => {
    setActive(key);
    setPage(1);
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const refresh = () => fetch('/api/alertas', { credentials: 'include' })
      .then((r) => r.ok && r.json())
      .then((d) => {
        if (d) setData(mergeInactivos(d));
      })
      .catch(() => {});

    const p = supabase
      .channel('alertas-premios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'premios' }, refresh)
      .subscribe();
    const b = supabase
      .channel('alertas-botellones')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'botellones' }, refresh)
      .subscribe();
    const r = supabase
      .channel('alertas-recargas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recargas' }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(p);
      supabase.removeChannel(b);
      supabase.removeChannel(r);
    };
  }, []);

  // Ensure active category still has data after refresh
  useEffect(() => {
    if (data[active].length === 0) {
      setActive(firstNonEmpty(data));
      setPage(1);
    }
  }, [data, active]);

  const items = data[active];
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Clamp page when total changes
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [total, totalPages, page]);

  const paged = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalAlerts = CATEGORIES.reduce((s, c) => s + data[c.key].length, 0);

  if (totalAlerts === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-24 items-center justify-center text-muted-foreground text-sm">
          Sin alertas pendientes
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pill selector */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const count = data[cat.key].length;
            const isActive = active === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                    : count > 0
                      ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                      : 'bg-zinc-50 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600'
                }`}
              >
                {cat.icon}
                {cat.label}
                {count > 0 && (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive
                      ? 'bg-white/20'
                      : 'bg-zinc-200 dark:bg-zinc-700'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Items */}
        <div className="min-h-[180px] space-y-0.5">
          {paged.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <span className="font-medium text-foreground truncate mr-2">{a.titulo}</span>
              <span className="text-muted-foreground text-xs shrink-0">{a.descripcion}</span>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded p-0.5 hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded p-0.5 hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <span className="tabular-nums">{total} {active === 'clientesInactivos' ? 'inactivos' : 'premios'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function firstNonEmpty(data: MergedAlerts): keyof MergedAlerts {
  for (const cat of CATEGORIES) {
    if (data[cat.key].length > 0) return cat.key;
  }
  return 'premiosPendientes';
}