import { NextResponse, type NextRequest } from 'next/server';

/**
 * Auth middleware: validates session and enforces role-based routing.
 *
 * Dev mode (NEXT_PUBLIC_AUTH_MODE=dev):
 *   Reads botellon_dev_session cookie set by login action.
 *   No Supabase required for local testing.
 *
 * Production:
 *   Uses Supabase getUser() for server-verified JWT validation.
 *
 * - No session → 302 /login (protected routes only)
 * - Non-admin on /configuracion → 302 /dashboard
 * - Non-admin on /reportes → 302 /dashboard
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Already on /login — let the page render (prevents redirect loops)
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // ── Dev mode: cookie-based auth ──
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'dev') {
    const devSession = request.cookies.get('botellon_dev_session')?.value;

    if (!devSession) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const session = JSON.parse(devSession) as { email: string; role: string };

      // Role check: /configuracion and /reportes require admin
      if (
        (pathname.startsWith('/configuracion') || pathname.startsWith('/reportes')) &&
        session.role !== 'admin'
      ) {
        const dashboardUrl = new URL('/dashboard', request.url);
        return NextResponse.redirect(dashboardUrl);
      }

      return NextResponse.next();
    } catch {
      // Corrupted cookie — redirect to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Production: Supabase Auth ──
  const { createServerClient } = await import('@supabase/ssr');

  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/configuracion') || pathname.startsWith('/reportes')) {
    const role = user.app_metadata?.role;
    if (role !== 'admin') {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return supabaseResponse;
}

/**
 * Matcher: runs middleware on protected routes only.
 * Excludes static assets, login, public API, PWA files, and favicon.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|api/public|qr|sw\\.js|manifest|icon-.*\\.png).*)',
  ],
};
