import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (clientInstance) return clientInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL. Check your .env.local file.'
    );
  }
  if (!supabasePublishableKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Check your .env.local file.'
    );
  }

  clientInstance = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
  return clientInstance;
}
