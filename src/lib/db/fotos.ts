'use server';

import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/db/clientes';

export type FotoClienteRow = {
  id: string;
  tipo: string;
  ruta_storage: string;
  created_at: string | null;
};

export type FotosClienteState = {
  success: boolean;
  error?: string;
};

const FOTO_TIPOS_VALIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const FOTO_MAX_BYTES = 2.5 * 1024 * 1024; // ~2.5 MB por foto (ya comprimida en cliente)

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
 * URLs firmadas). Devuelve '' si falta NEXT_PUBLIC_SUPABASE_URL. Async porque
 * todo export de un archivo 'use server' debe ser una función async.
 */
export async function fotoFachadaPublicUrl(ruta: string): Promise<string> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return '';
  return `${base}/storage/v1/object/public/fotos-clientes/${ruta}`;
}

/**
 * Sube fotos de fachada a un cliente existente (tab Fotos de la ficha).
 * Mismo patrón que createCliente: subida best-effort al bucket 'fotos-clientes'
 * y fila en `fotos_clientes`. Una foto inválida o fallida se salta; se devuelve
 * error solo si TODAS fallan. Compatible con useActionState (clienteId se liga).
 */
export async function subirFotosCliente(
  clienteId: string,
  _prev: FotosClienteState | null,
  formData: FormData
): Promise<FotosClienteState> {
  const archivos = formData
    .getAll('fotos')
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (archivos.length === 0) return { success: true };

  try {
    const supabase = await getSupabase();
    const storage = supabase.storage.from('fotos-clientes');

    let subidas = 0;
    let fallidas = 0;
    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i];
      if (!FOTO_TIPOS_VALIDOS.includes(archivo.type) || archivo.size > FOTO_MAX_BYTES) {
        fallidas++;
        continue;
      }
      const ext =
        archivo.type === 'image/png'
          ? 'png'
          : archivo.type === 'image/webp'
            ? 'webp'
            : 'jpg';
      const ruta = `fachadas/${clienteId}/${Date.now()}-${i}.${ext}`;
      const { error: uploadError } = await storage.upload(ruta, archivo, {
        contentType: archivo.type,
      });
      if (uploadError) {
        fallidas++;
        continue;
      }
      const { error: insertError } = await supabase
        .from('fotos_clientes')
        .insert({ cliente_id: clienteId, tipo: 'fachada', ruta_storage: ruta });
      if (insertError) {
        fallidas++;
      } else {
        subidas++;
      }
    }

    if (fallidas > 0 && subidas === 0) {
      return { success: false, error: 'Las fotos no se pudieron subir.' };
    }

    revalidatePath(`/clientes/${clienteId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al subir las fotos',
    };
  }
}

/**
 * Elimina una foto de fachada: borra el objeto del bucket (best-effort, si el
 * storage falla se ignora) y la fila de `fotos_clientes`. Compatible con
 * useActionState (clienteId se liga; el form manda foto_id y ruta ocultos).
 */
export async function eliminarFotoCliente(
  clienteId: string,
  _prev: FotosClienteState | null,
  formData: FormData
): Promise<FotosClienteState> {
  const fotoId = (formData.get('foto_id') as string)?.trim();
  const ruta = (formData.get('ruta') as string)?.trim();
  if (!fotoId) return { success: false, error: 'Falta el ID de la foto' };

  try {
    const supabase = await getSupabase();
    if (ruta) {
      try {
        await supabase.storage.from('fotos-clientes').remove([ruta]);
      } catch {
        // Best-effort: un fallo del storage no impide borrar la fila.
      }
    }
    const { error } = await supabase.from('fotos_clientes').delete().eq('id', fotoId);
    if (error) return { success: false, error: `Error al eliminar: ${error.message}` };

    revalidatePath(`/clientes/${clienteId}`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al eliminar la foto',
    };
  }
}