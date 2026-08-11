'use client';

import { useActionState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { markAsRead, markAllAsRead } from '@/lib/db/notificaciones';
import type { NotificacionRow } from '@/lib/db/notificaciones';
import { NotificationIcon } from '@/components/notificaciones/notification-icon';
import { timeAgo } from '@/lib/utils';
import { MessageCircle, CheckCheck } from 'lucide-react';

const FILTER_TABS = [
  { key: 'todas', label: 'Todas' },
  { key: 'premio', label: 'Premio' },
  { key: 'premio_cerca', label: 'Premio Cerca' },
  { key: 'botellon_danado', label: 'Botellón' },
  { key: 'inactividad', label: 'Inactividad' },
] as const;

const PAGE_SIZE = 20;

interface Props {
  items: NotificacionRow[];
  total: number;
  page: number;
  userId: string;
}

export function NotificacionesList({ items, total, page, userId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get('tipo') || 'todas';

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Actions
  const [readState, readAction] = useActionState(markAsRead, null);
  const [allReadState, allReadAction] = useActionState(markAllAsRead, null);

  const switchTab = useCallback(
    (tipo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tipo === 'todas') {
        params.delete('tipo');
      } else {
        params.set('tipo', tipo);
      }
      params.delete('page');
      router.push(`/notificaciones?${params.toString()}`);
    },
    [router, searchParams]
  );

  const goToPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(p));
      router.push(`/notificaciones?${params.toString()}`);
    },
    [router, searchParams]
  );

  // WhatsApp link
  const waLink = (telefono: string) => {
    const digits = telefono.replace(/\D/g, '');
    return `https://wa.me/${digits}`;
  };

  return (
    <div>
      {/* Header + Mark all read */}
      <div className="flex items-center justify-between">
        <form action={allReadAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas como leídas
          </button>
          {allReadState?.error && (
            <span className="text-xs text-red-500">{allReadState.error}</span>
          )}
          {allReadState?.success && (
            <span className="text-xs text-green-600">Todas marcadas</span>
          )}
        </form>
      </div>

      {/* Filter tabs */}
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`shrink-0 px-3 py-2 text-sm font-medium transition-colors ${
              currentFilter === tab.key
                ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="mt-4">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-400">No hay notificaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {items.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${
                  !n.leida ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  <NotificationIcon tipo={n.tipo} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {n.titulo}
                    </p>
                    {!n.leida && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>

                  {n.mensaje && (
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {n.mensaje}
                    </p>
                  )}

                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-zinc-400">
                      {timeAgo(n.creada_en)}
                    </span>

                    {/* Navigate to cliente */}
                    {n.cliente_id && n.cliente_nombre && (
                      <Link
                        href={`/clientes/${n.cliente_id}`}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {n.cliente_nombre}
                      </Link>
                    )}

                    {/* Navigate to botellon */}
                    {n.botellon_id && n.botellon_codigo && (
                      <Link
                        href={`/botellones/${n.botellon_id}`}
                        className="text-xs font-mono text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {n.botellon_codigo}
                      </Link>
                    )}
                  </div>

                  {/* WhatsApp button */}
                  {n.cliente_id && n.cliente_telefono && (
                    <a
                      href={waLink(n.cliente_telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </a>
                  )}
                </div>

                {/* Mark as read button */}
                {!n.leida && (
                  <form action={readAction} className="shrink-0">
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      className="rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      title="Marcar como leída"
                    >
                      ✓
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rounded px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            ← Anterior
          </button>
          <span className="text-sm text-zinc-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
