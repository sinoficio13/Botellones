import { createBotellon } from '@/lib/db/botellones';
import { redirect } from 'next/navigation';

export default function NuevoBotellonPage() {
  async function handleCreate() {
    'use server';
    await createBotellon(null, new FormData());
    // createBotellon already redirects
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Nuevo Botellón</h1>
      <p className="mt-2 text-sm text-zinc-500">El código BOT-XXXXX se asigna automáticamente.</p>
      <form action={handleCreate} className="mt-6">
        <button type="submit"
          className="rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
          Crear botellón
        </button>
      </form>
    </div>
  );
}
