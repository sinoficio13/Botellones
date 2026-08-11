import { cookies } from 'next/headers';
import Link from 'next/link';
import { MapPin, Store } from 'lucide-react';
import { BellNotification } from '@/components/notificaciones/bell';
import GlobalSearch from '@/components/search/global-search';

/**
 * Header component: shows business logo (or fallback text) and name.
 * Visible on all authenticated pages inside the dashboard layout.
 */
export async function Header() {
  const config = await getConfig();
  const role = await getUserRole();

  const nombre = config?.nombre_negocio || 'Botellón';
  const logoUrl = config?.logo_url;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        {/* Logo + search */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={nombre}
                className="h-8 w-auto max-w-[160px] object-contain"
                style={{ maxHeight: 40 }}
              />
            ) : (
              <>
                <Store className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
                <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {nombre}
                </span>
              </>
            )}
          </Link>
          <GlobalSearch />
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/dashboard"
            className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Dashboard
          </Link>
          <Link
            href="/recargas"
            className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Recargas
          </Link>
          <Link
            href="/botellones"
            className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Botellones
          </Link>
          <Link
            href="/premios"
            className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Premios
          </Link>
          <Link
            href="/mapa"
            className="inline-flex items-center gap-1 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            <MapPin size={14} />
            Mapa
          </Link>
          <Link
            href="/clientes"
            className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Clientes
          </Link>
          {role === 'admin' && (
            <Link
              href="/reportes"
              className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Reportes
            </Link>
          )}
          <Link
            href="/configuracion"
            className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Configuración
          </Link>
          <Link
            href="/notificaciones"
            className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Notificaciones
          </Link>
        </nav>

        {/* Bell notification island */}
        <BellNotification />
      </div>
    </header>
  );
}

/**
 * Determine the current user's role for navigation visibility.
 */
async function getUserRole(): Promise<'admin' | 'repartidor' | null> {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'dev') {
    const cookieStore = await cookies();
    const raw = cookieStore.get('botellon_dev_session')?.value;
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as { email: string; role: string };
      return session.role as 'admin' | 'repartidor';
    } catch {
      return null;
    }
  }

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    // In production, role is read via createServerClient with cookies
    // For now fall back to admin client pattern
    return 'admin';
  } catch {
    return null;
  }
}

/**
 * Read business config for the header.
 * Dev mode: reads from cookie.
 * Production: reads from configuracion table.
 */
async function getConfig(): Promise<{
  nombre_negocio: string;
  logo_url?: string;
} | null> {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'dev') {
    const cookieStore = await cookies();
    const raw = cookieStore.get('botellon_config')?.value;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('configuracion')
      .select('nombre_negocio, logo_url')
      .eq('id', 1)
      .single();
    return data ?? null;
  } catch {
    return null;
  }
}
