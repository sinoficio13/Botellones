'use server';

import { revalidatePath } from 'next/cache';
import { normalizeWhatsAppPhone, componerWhatsApp } from '@/lib/utils/whatsapp';
import { parseWhatsAppLocation } from '@/lib/utils/location';

// ── Types ──

export type ClienteState = {
  success?: boolean;
  error?: string;
  clienteId?: string;
  avisoFotos?: string;
};

export type ClienteRow = {
  id: string;
  codigo: string;
  nombre: string;
  negocio: string | null;
  cedula: string | null;
  telefono_1: string | null;
  telefono_2: string | null;
  whatsapp: string | null;
  direccion_entrega: string | null;
  tipo_cliente: string | null;
  horario_preferido: string | null;
  dias_preferidos: string | null;
  contacto_preferido: string | null;
  observaciones: string | null;
  fecha_registro: string | null;
  total_recargas: number;
};

export type ClienteListRow = {
  id: string;
  codigo: string;
  nombre: string;
  negocio: string | null;
  telefono_1: string | null;
  tipo_cliente: string | null;
  fecha_registro: string | null;
  ultima_recarga: string | null;
  total_recargas: number;
};

// ── Helpers ──

const FOTO_TIPOS_VALIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const FOTO_MAX_BYTES = 2.5 * 1024 * 1024; // ~2.5 MB por foto (ya comprimida en cliente)

function parseFloatOrNull(v: string | null): number | null {
  const n = parseFloat(v ?? '');
  return isNaN(n) ? null : n;
}

export async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  // In dev mode without service_role, fall back to anon key
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

// ── Create ──

export async function createCliente(
  _prevState: ClienteState | null,
  formData: FormData
): Promise<ClienteState> {
  const nombre = (formData.get('nombre') as string)?.trim();
  const telefono_1 = (formData.get('telefono_1') as string)?.trim();
  const negocio = (formData.get('negocio') as string)?.trim() || null;
  const cedula = (formData.get('cedula') as string)?.trim() || null;
  const telefono_2 = (formData.get('telefono_2') as string)?.trim() || null;
  // WhatsApp se guarda SIEMPRE en formato internacional, con el código de país
  // elegido en el form (`pais_whatsapp`, default 58 para Venezuela).
  const whatsappRaw = (formData.get('whatsapp') as string)?.trim() || telefono_1;
  const paisWhatsapp = (formData.get('pais_whatsapp') as string)?.trim() || '58';
  const whatsapp = componerWhatsApp(paisWhatsapp, whatsappRaw) || null;
  const direccion_entrega = (formData.get('direccion_entrega') as string)?.trim() || null;
  const tipo_cliente = (formData.get('tipo_cliente') as string) || null;
  const horario_preferido = (formData.get('horario_preferido') as string) || null;
  const dias_preferidos = (formData.get('dias_preferidos') as string)?.trim() || null;
  const contacto_preferido = (formData.get('contacto_preferido') as string) || null;
  const observaciones = (formData.get('observaciones') as string)?.trim() || null;
  // Flujo "Crear cliente" desde la sesión de carga: el checkbox solo envía
  // `botellon_id` (hidden) y `asignar_botellon=on` cuando vino de un botellón.
  const botellonId = (formData.get('botellon_id') as string)?.trim() || null;
  const asignarBotellon = formData.get('asignar_botellon') as string | null;

  if (!nombre) {
    return { error: 'El nombre es requerido' };
  }
  if (!telefono_1) {
    return { error: 'El teléfono es requerido' };
  }

  try {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre,
        telefono_1,
        negocio,
        cedula,
        telefono_2,
        whatsapp,
        direccion_entrega,
        tipo_cliente,
        horario_preferido,
        dias_preferidos,
        contacto_preferido,
        observaciones,
      })
      .select('id')
      .single();

    if (error) {
      return { error: `Error al crear cliente: ${error.message}` };
    }

    // Asignación opcional del botellón en un solo paso: SOLO si sigue sin
    // cliente (`.is('cliente_id', null)`), para nunca pisar un dueño existente.
    if (asignarBotellon === 'on' && botellonId) {
      await supabase
        .from('botellones')
        .update({ cliente_id: data.id })
        .eq('id', botellonId)
        .is('cliente_id', null);
      revalidatePath('/botellones');
    }

    // Fotos de fachada (opcional): subida best-effort al bucket público
    // 'fotos-clientes'. Una foto inválida o fallida se salta sin tumbar la
    // creación; si alguna falla se avisa vía `avisoFotos` (no bloqueante).
    const archivos = formData
      .getAll('fotos')
      .filter((f): f is File => f instanceof File && f.size > 0);

    let avisoFotos: string | undefined;
    if (archivos.length > 0) {
      let subidas = 0;
      let fallidas = 0;
      const storage = supabase.storage.from('fotos-clientes');
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
        const ruta = `fachadas/${data.id}/${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await storage.upload(ruta, archivo, {
          contentType: archivo.type,
        });
        if (uploadError) {
          fallidas++;
          continue;
        }
        const { error: insertError } = await supabase
          .from('fotos_clientes')
          .insert({ cliente_id: data.id, tipo: 'fachada', ruta_storage: ruta });
        if (insertError) {
          fallidas++;
        } else {
          subidas++;
        }
      }
      if (fallidas > 0) {
        avisoFotos =
          subidas > 0
            ? `El cliente se creó, pero ${fallidas} foto(s) no se pudieron subir.`
            : 'El cliente se creó, pero las fotos no se pudieron subir.';
      }
    }

    // Link de Google Maps + coordenadas → fila en `direcciones` (best-effort).
    // Solo cuando llega un link_mapa y hay coords (hidden latitud/longitud del
    // form, o parseadas del link acá en el server). Un fallo no tumba la
    // creación: la dirección se puede completar después desde la ficha.
    const linkMapa = (formData.get('link_mapa') as string)?.trim() || null;
    if (linkMapa) {
      let latitud: number | null = parseFloatOrNull(formData.get('latitud') as string);
      let longitud: number | null = parseFloatOrNull(formData.get('longitud') as string);
      if (latitud == null || longitud == null) {
        const parsed = parseWhatsAppLocation(linkMapa);
        if (parsed) {
          latitud = parsed.lat;
          longitud = parsed.lng;
        }
      }
      if (latitud != null && longitud != null) {
        try {
          await supabase.from('direcciones').insert({
            cliente_id: data.id,
            link_mapa: linkMapa,
            latitud,
            longitud,
          });
        } catch {
          // Best-effort: no falla la creación del cliente.
        }
      }
    }

    revalidatePath('/clientes');
    return {
      clienteId: data.id,
      success: true,
      ...(avisoFotos ? { avisoFotos } : {}),
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : 'Error desconocido. ¿Falta SUPABASE_SERVICE_ROLE_KEY en .env.local?',
    };
  }
}

// ── Read (list) ──

export async function getClientes(
  page = 1,
  pageSize = 20,
  search?: string,
  orderBy = 'fecha_registro',
  orderDir: 'asc' | 'desc' = 'desc'
): Promise<{ clientes: ClienteListRow[]; total: number }> {
  try {
    const supabase = await getSupabase();

    let query = supabase
      .from('clientes')
      .select('id, codigo, nombre, negocio, telefono_1, tipo_cliente, fecha_registro', {
        count: 'exact',
      });

    if (search) {
      query = query.or(
        `nombre.ilike.%${search}%,telefono_1.ilike.%${search}%,codigo.ilike.%${search}%,` +
          `cedula.ilike.%${search}%,negocio.ilike.%${search}%,telefono_2.ilike.%${search}%`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count } = await query
      .order(orderBy, { ascending: orderDir === 'asc' })
      .range(from, to);

    // Get recarga stats for all clients in batch (2 queries instead of N*2)
    const clientes: ClienteListRow[] = [];
    if (data && data.length > 0) {
      const ids = data.map((c: { id: string }) => c.id);

      // Batch 1: get recarga counts for all clients at once
      const { data: recargaCounts } = await supabase
        .from('recargas')
        .select('cliente_id')
        .in('cliente_id', ids);

      // Batch 2: get latest recarga date for all clients at once
      const { data: ultimasRecargas } = await supabase
        .from('recargas')
        .select('cliente_id, fecha')
        .in('cliente_id', ids)
        .order('fecha', { ascending: false });

      // Index results by cliente_id
      const countMap = new Map<string, number>();
      if (recargaCounts) {
        for (const r of recargaCounts) {
          countMap.set(r.cliente_id, (countMap.get(r.cliente_id) || 0) + 1);
        }
      }

      const ultimaMap = new Map<string, string>();
      if (ultimasRecargas) {
        for (const r of ultimasRecargas) {
          if (!ultimaMap.has(r.cliente_id)) {
            ultimaMap.set(r.cliente_id, r.fecha);
          }
        }
      }

      for (const c of data) {
        clientes.push({
          ...c,
          total_recargas: countMap.get(c.id) || 0,
          ultima_recarga: ultimaMap.get(c.id) || null,
        });
      }
    }

    return { clientes, total: count || 0 };
  } catch {
    return { clientes: [], total: 0 };
  }
}

// ── Read (single) ──

export async function getCliente(id: string): Promise<ClienteRow | null> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (!data) return null;

    const { count } = await supabase
      .from('recargas')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', id);

    return { ...data, total_recargas: count || 0 };
  } catch {
    return null;
  }
}

// ── Update ──

export async function updateCliente(
  _prevState: ClienteState | null,
  formData: FormData
): Promise<ClienteState> {
  const id = formData.get('id') as string;
  const nombre = (formData.get('nombre') as string)?.trim();
  const telefono_1 = (formData.get('telefono_1') as string)?.trim();

  if (!id) return { error: 'ID de cliente no proporcionado' };
  if (!nombre) return { error: 'El nombre es requerido' };
  if (!telefono_1) return { error: 'El teléfono es requerido' };

  const updates: Record<string, unknown> = {
    nombre,
    telefono_1,
    negocio: (formData.get('negocio') as string)?.trim() || null,
    cedula: (formData.get('cedula') as string)?.trim() || null,
    telefono_2: (formData.get('telefono_2') as string)?.trim() || null,
    whatsapp: normalizeWhatsAppPhone((formData.get('whatsapp') as string)?.trim() || telefono_1) || null,
    tipo_cliente: (formData.get('tipo_cliente') as string) || null,
    horario_preferido: (formData.get('horario_preferido') as string) || null,
    dias_preferidos: (formData.get('dias_preferidos') as string)?.trim() || null,
    contacto_preferido: (formData.get('contacto_preferido') as string) || null,
    observaciones: (formData.get('observaciones') as string)?.trim() || null,
  };

  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from('clientes').update(updates).eq('id', id);

    if (error) {
      return { error: `Error al actualizar: ${error.message}` };
    }

    revalidatePath(`/clientes/${id}`);
    return { success: true, clienteId: id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Error al actualizar',
    };
  }
}
