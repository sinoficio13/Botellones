'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBotellon } from '@/lib/db/botellones';

export default function NuevoBotellonPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createBotellon, null);

  // Redirect on success — useActionState doesn't propagate server-side redirect()
  useEffect(() => {
    if (state?.id) {
      router.push(`/botellones/${state.id}`);
    }
  }, [state?.id, router]);

  return (
    <div className="mx-auto max-w-md px-4 py-8 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Nuevo Botellón</h1>
      <p className="mt-2 text-sm text-zinc-500">El código BOT-XXXXX se asigna automáticamente.</p>
      <form action={formAction} className="mt-6">
        <button type="submit" disabled={pending}
          className="rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
          {pending ? 'Creando…' : 'Crear botellón'}
        </button>
      </form>
      {state?.error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </div>
      )}
    </div>
  );
}
