import { getNotificaciones, checkInactividad } from '@/lib/db/notificaciones';
import { NotificacionesList } from './notificaciones-list';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ tipo?: string; page?: string }>;
}

export default async function NotificacionesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tipo = sp.tipo || undefined;
  const page = Math.max(1, parseInt(sp.page || '1'));

  // Lazy inactivity check on page load
  await checkInactividad();

  // Dev placeholder userId — follows existing codebase pattern
  // (EPIC-1 auth hardening will replace this with actual session)
  const userId = 'a0000000-0000-0000-0000-000000000001';

  const { items, total } = await getNotificaciones(userId, tipo, page);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Notificaciones{' '}
        {total > 0 && (
          <span className="text-base font-normal text-zinc-400">({total})</span>
        )}
      </h1>

      <NotificacionesList
        items={items}
        total={total}
        page={page}
        userId={userId}
      />
    </div>
  );
}
