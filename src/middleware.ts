import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Auth middleware: validates session via getUser() and enforces role-based routing.
 *
 * - No session → 302 /login (protected routes only)
 * - Non-admin on /configuracion → 302 /dashboard
 */
export async function middleware(request: NextRequest) {
  // Let updateSession handle cookie refresh first
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

  // getUser() revalidates the JWT server-side — immune to cookie tampering
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // No session → redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Role check: /configuracion and sub-routes require admin
  if (pathname.startsWith('/configuracion')) {
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
