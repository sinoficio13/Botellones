import 'server-only';

import { cookies } from 'next/headers';

/**
 * Session role resolved server-side for authorization checks.
 *
 * Dev mode (`NEXT_PUBLIC_AUTH_MODE=dev`): reads the `botellon_dev_session`
 * cookie set by the login action (shape `{ email, role, name }`).
 *
 * Production: verifies the Supabase session via `auth.getUser()` and reads
 * the role from `app_metadata.role` (same source as `src/proxy.ts`).
 *
 * Returns `null` on missing cookie, corrupt JSON, no user, or unknown role,
 * so callers treat the viewer as anonymous.
 */
export async function getSessionRole(): Promise<'admin' | 'repartidor' | null> {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'dev') {
    const cookieStore = await cookies();
    const raw = cookieStore.get('botellon_dev_session')?.value;
    if (!raw) return null;

    try {
      const session = JSON.parse(raw) as { email: string; role: string; name?: string };
      return session.role === 'admin' || session.role === 'repartidor'
        ? session.role
        : null;
    } catch {
      return null;
    }
  }

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const role = user.app_metadata?.role;
    return role === 'admin' || role === 'repartidor' ? role : null;
  } catch {
    return null;
  }
}
