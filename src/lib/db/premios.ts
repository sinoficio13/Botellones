'use server';

// ── Types ──

export type PremioRow = {
  id: string;
  cliente_id: string;
  nivel_recargas: number;
  fecha_alcanzado: string;
  estado: string | null;
  tipo_premio: string | null;
  entregado_por: string | null;
  observaciones: string | null;
  created_at: string | null;
  clientes?: {
    nombre: string;
    telefono_1: string | null;
    id: string;
  } | null;
};

// ── Helpers ──

function getSupabase() {
  // Dynamic import so it only runs on server
  return import('@supabase/supabase-js').then(async ({ createClient }) => {
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      '';
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  });
}

// ── Read (list) ──

export async function getPremios(
  estado: 'pendiente' | 'entregado',
  page = 1
): Promise<{ premios: PremioRow[]; total: number }> {
  try {
    const supabase = await getSupabase();
    const pageSize = 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count } = await supabase
      .from('premios')
      .select('*, clientes(nombre, telefono_1, id)', { count: 'exact' })
      .eq('estado', estado)
      .order('fecha_alcanzado', { ascending: false })
      .range(from, to);

    return { premios: (data as PremioRow[]) || [], total: count || 0 };
  } catch {
    return { premios: [], total: 0 };
  }
}

// ── Read (by cliente) ──

export async function getPremiosByCliente(clienteId: string): Promise<PremioRow[]> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('premios')
      .select('*, clientes(nombre, telefono_1, id)')
      .eq('cliente_id', clienteId)
      .order('fecha_alcanzado', { ascending: false });

    return (data as PremioRow[]) || [];
  } catch {
    return [];
  }
}
