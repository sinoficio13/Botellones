import { cookies } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { LogOut, MapPin, Store } from 'lucide-react';
import { logout } from '@/app/(auth)/logout/actions';
import { BellNotification } from '@/components/notificaciones/bell';
import { ScannerIsland } from '@/components/scanner/scanner-island';
import GlobalSearch from '@/components/search/global-search';
import { getConfiguracion } from '@/lib/db/configuracion';

/**
 * Header component: shows business logo (or fallback text) and name.
 * Visible on all authenticated pages inside the dashboard layout.
 */
export async function Header() {
  const config = await getConfiguracion();
  const role = await getUserRole();

  const nombre = config?.nombre_negocio || 'Botellón';
  const logoUrl = config?.logo_url;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-black/80">
      <div className="flex h-14 items-center justify-between gap-4 px-4">
        {/* Logo + search */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={nombre}
                width={160}
                height={40}
                unoptimized
                className="h-8 w-auto max-w-[160px] object-contain"
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
        <nav className="hidden items-center gap-4 text-sm lg:flex">
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

        {/* Bell notification + QR scanner islands + logout */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:inline-flex">
            <ScannerIsland />
          </div>
          <BellNotification />
          <form action={logout}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Cerrar sesión</span>
            </button>
          </form>
        </div>
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder for EPIC-1 auth
    const supabase = createAdminClient();
    // In production, role is read via createServerClient with cookies
    // For now fall back to admin client pattern
    return 'admin';
  } catch {
    return null;
  }
}
