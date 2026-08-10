'use client';

import { useActionState } from 'react';
import { login } from './actions';
import type { LoginState } from './actions';

/**
 * Login form with client-side validation and server action.
 *
 * - Email required
 * - Password ≥ 6 characters
 * - Error state from server action displayed inline
 * - Responsive: usable at 320px viewport
 *
 * React 19 note: useActionState's action prop takes precedence over
 * onSubmit. Client-side validation runs inside the action wrapper, not
 * via onSubmit, so it fires consistently in both test and production.
 */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginWithValidation, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Botellón
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to your account
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              placeholder="admin@botellon.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              placeholder="••••••"
            />
          </div>

          {state?.error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Wrapper action: runs client-side validation before delegating to the
 * server action. This ensures validation fires even though React 19
 * useActionState bypasses the onSubmit handler.
 */
async function loginWithValidation(
  prevState: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const email = (formData.get('email') as string) || '';
  const password = (formData.get('password') as string) || '';

  // Client-side validation
  if (!email.trim()) {
    return { error: 'Email is required' };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  // Delegate to server action
  return login(prevState, formData);
}
