'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Bell, BellRing } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NotificationIcon } from './notification-icon';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type NotifPreview = {
  id: string;
  tipo: string;
  titulo: string;
  creada_en: string;
  leida: boolean;
  cliente_id: string | null;
  cliente_telefono: string | null;
};

/**
 * Bell icon with badge and dropdown. Subscribes to Supabase Realtime
 * for live badge updates. Fetches its own count on mount (no prop needed).
 */
export function BellNotification() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotifPreview[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Fetch initial data on mount
  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // Fetch unread count
      const { count } = await supabase
        .from('notificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', user.id)
        .eq('leida', false);

      setUnreadCount(count ?? 0);

      // Fetch last 5 for dropdown
      const { data: notifs } = await supabase
        .from('notificaciones')
        .select(
          'id, tipo, titulo, creada_en, leida, cliente_id, clientes(telefono_1)'
        )
        .eq('usuario_id', user.id)
        .order('creada_en', { ascending: false })
        .limit(5);

      if (notifs) {
        setNotifications(
          notifs.map((n: any) => ({
            id: n.id,
            tipo: n.tipo,
            titulo: n.titulo,
            creada_en: n.creada_en,
            leida: n.leida ?? false,
            cliente_id: n.cliente_id,
            cliente_telefono: n.clientes?.telefono_1 ?? null,
          }))
        );
      }
    }

    init();
  }, []);

  // Subscribe to Realtime changes
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    const channel = supabase
      .channel('notificaciones-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const record = payload.new as Record<string, unknown> | undefined;
          if (!record) return;

          setUnreadCount((c) => c + 1);
          setNotifications((prev) => {
            const newNotif: NotifPreview = {
              id: record.id as string,
              tipo: record.tipo as string,
              titulo: record.titulo as string,
              creada_en: record.creada_en as string,
              leida: false,
              cliente_id: (record.cliente_id as string) ?? null,
              cliente_telefono: null,
            };
            return [newNotif, ...prev].slice(0, 5);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Silent degradation: badge stays stale until refresh
          console.warn('Realtime notification channel error:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Mark notification as read
  const handleMarkRead = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', id);

      if (!error) {
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
        );
      }
    },
    []
  );

  // Format relative time
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days}d`;
    return new Date(dateStr).toLocaleDateString('es-UY', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label={`${unreadCount} notificaciones sin leer`}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Notificaciones
            </span>
            <Link
              href="/notificaciones"
              onClick={() => setOpen(false)}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Ver todas
            </Link>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No hay notificaciones
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 border-b border-zinc-50 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                    !n.leida ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <NotificationIcon tipo={n.tipo} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {n.titulo}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {timeAgo(n.creada_en)}
                    </p>
                  </div>
                  {!n.leida && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(n.id);
                      }}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      title="Marcar como leída"
                    >
                      ✓
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
