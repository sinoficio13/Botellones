import Link from 'next/link';
import { Droplets } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-6 px-8 text-center">
        <Droplets className="h-12 w-12 text-blue-600 dark:text-blue-400" />
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Botellón
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400">
          Gestión de recargas de agua
        </p>
        <Link
          href="/login"
          className="rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Iniciar sesión
        </Link>
      </main>
    </div>
  );
}
