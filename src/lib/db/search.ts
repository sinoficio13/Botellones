'use server';

/**
 * Internal Supabase client factory — same pattern as clientes.ts.
 * Replicated here to keep search logic in its own module.
 */
async function getSupabaseClient() {
  const { createClient } = await import('@supabase/supabase-js');
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export type SearchResult = {
  id: string;
  codigo: string;
  nombre: string;
  negocio: string | null;
  telefono_1: string | null;
};

/**
 * Lightweight search across 6 clientes fields for the global header search bar.
 * Returns top 10 results (or fewer if limit is set). No recarga subqueries.
 */
export async function searchClientesLight(
  q: string,
  limit = 10
): Promise<SearchResult[]> {
  const trimmed = q.trim();
  if (!trimmed || trimmed.length < 1) return [];

  try {
    const supabase = await getSupabaseClient();

    const { data } = await supabase
      .from('clientes')
      .select('id, codigo, nombre, negocio, telefono_1')
      .or(
        `nombre.ilike.%${trimmed}%,codigo.ilike.%${trimmed}%,telefono_1.ilike.%${trimmed}%,` +
          `cedula.ilike.%${trimmed}%,negocio.ilike.%${trimmed}%,telefono_2.ilike.%${trimmed}%`
      )
      .order('nombre', { ascending: true })
      .limit(limit);

    return (data as SearchResult[]) || [];
  } catch {
    return [];
  }
}
