import { getSupabase } from '@/lib/db/clientes';

export type FotoClienteRow = {
  id: string;
  tipo: string;
  ruta_storage: string;
  created_at: string | null;
};

/**
 * Fotos de un cliente (tipo 'fachada'), más antiguas primero.
 * Se usa en la ficha del cliente para mostrar las fotos del repartidor.
 */
export async function getFotosCliente(clienteId: string): Promise<FotoClienteRow[]> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('fotos_clientes')
      .select('id, tipo, ruta_storage, created_at')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: true });
    return (data as FotoClienteRow[]) || [];
  } catch {
    return [];
  }
}

/**
 * URL pública de una foto en el bucket 'fotos-clientes' (bucket público, sin
 * URLs firmadas). Devuelve '' si falta NEXT_PUBLIC_SUPABASE_URL.
 */
export function fotoFachadaPublicUrl(ruta: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return '';
  return `${base}/storage/v1/object/public/fotos-clientes/${ruta}`;
}