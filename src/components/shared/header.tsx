import { cookies } from 'next/headers';
import Link from 'next/link';
import { Store } from 'lucide-react';

/**
 * Header component: shows business logo (or fallback text) and name.
 * Visible on all authenticated pages inside the dashboard layout.
 */
export async function Header() {
  const config = await getConfig();

  const nombre = config?.nombre_negocio || 'Botellón';
  const logoUrl = config?.logo_url;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Logo + name */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
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

        {/* Navigation */}
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/clientes"
            className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Clientes
          </Link>
          <Link
            href="/configuracion"
            className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Configuración
          </Link>
        </nav>
      </div>
    </header>
  );
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
