'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export type LoginState = {
  error?: string;
  success?: boolean;
};

const DEV_USERS: Record<string, { password: string; role: string; name: string }> = {
  'admin@botellon.com': { password: 'Admin123!', role: 'admin', name: 'Administrador' },
  'repartidor@botellon.com': { password: 'Repartidor123!', role: 'repartidor', name: 'Repartidor' },
};

/**
 * Server action: authenticates user.
 *
 * Dev mode (NEXT_PUBLIC_AUTH_MODE=dev):
 *   Hardcoded credentials, sets a dev session cookie.
 *   Middleware reads the same cookie to authorize routes.
 *
 * Production:
 *   Supabase Auth via signInWithPassword → session cookie → getUser().
 */
export async function login(
  _prevState: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  // ── Dev mode: hardcoded auth ──
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'dev') {
    const user = DEV_USERS[email];
    if (!user || user.password !== password) {
      return { error: 'Invalid email or password' };
    }

    const cookieStore = await cookies();

    // Dev session cookie — read by middleware in dev mode
    cookieStore.set('botellon_dev_session', JSON.stringify({
      email,
      role: user.role,
      name: user.name,
    }), {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });

    revalidatePath('/', 'layout');
    redirect('/clientes');
  }

  // ── Production: Supabase Auth ──
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: 'Invalid email or password' };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/**
 * Dev-only server action: signs in as a hardcoded dev user with a single tap.
 *
 * Only available when NEXT_PUBLIC_AUTH_MODE=dev. In production it redirects
 * back to /login and never exposes the dev credentials.
 */
export async function quickLogin(role: 'admin' | 'repartidor'): Promise<void> {
  if (process.env.NEXT_PUBLIC_AUTH_MODE !== 'dev') {
    redirect('/login');
  }

  const email = role === 'admin' ? 'admin@botellon.com' : 'repartidor@botellon.com';
  const user = DEV_USERS[email];

  const cookieStore = await cookies();

  // Dev session cookie — read by middleware in dev mode
  cookieStore.set('botellon_dev_session', JSON.stringify({
    email,
    role: user.role,
    name: user.name,
  }), {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
  });

  revalidatePath('/', 'layout');
  redirect('/clientes');
}
