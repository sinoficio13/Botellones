'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

/**
 * Server action: ends the current session and redirects to /login.
 *
 * Dev mode (NEXT_PUBLIC_AUTH_MODE=dev):
 *   Deletes the botellon_dev_session cookie set by the login action.
 *
 * Production:
 *   Signs out of Supabase Auth, which clears the SSR session cookies.
 *
 * Logout never throws to the UI: any error still redirects to /login.
 */
export async function logout(): Promise<void> {
  try {
    if (process.env.NEXT_PUBLIC_AUTH_MODE === 'dev') {
      const cookieStore = await cookies();
      cookieStore.set('botellon_dev_session', '', {
        maxAge: 0,
        path: '/',
      });
    } else {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      await supabase.auth.signOut();
    }

    revalidatePath('/', 'layout');
  } catch {
    // Logout must never crash the UI — fall through to the redirect.
  }

  redirect('/login');
}