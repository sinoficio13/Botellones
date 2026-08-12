import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  // Check if user has a dev session cookie (authenticated)
  const cookieStore = await cookies();
  const session = cookieStore.get('botellon_dev_session')?.value;

  if (session) {
    redirect('/dashboard');
  }

  // Not authenticated — show landing
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-8 px-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Botellón
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Gestión de recargas de agua
        </p>
      </main>
    </div>
  );
}
