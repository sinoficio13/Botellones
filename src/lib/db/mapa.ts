'use server';

export type ClienteMapa = {
  id: string;
  nombre: string;
  negocio: string | null;
  telefono_1: string | null;
  latitud: number;
  longitud: number;
  sector: string | null;
};

/**
 * Returns all clientes that have at least one direccion with coordinates.
 * If a cliente has multiple addresses with coordinates, each address
 * produces a separate row (one marker per address).
 */
export async function getClientesConCoordenadas(): Promise<ClienteMapa[]> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      '';
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);

    const { data } = await supabase
      .from('direcciones')
      .select(
        'latitud, longitud, sector, clientes!inner(id, nombre, negocio, telefono_1)'
      )
      .not('latitud', 'is', null)
      .not('longitud', 'is', null);

    if (!data) return [];

    // Flatten the JOIN result: each direccion row → one ClienteMapa row
    return data
      .filter((d) => d.clientes !== null && d.latitud !== null && d.longitud !== null)
      .map((d) => {
        const c = d.clientes as unknown as {
          id: string;
          nombre: string;
          negocio: string | null;
          telefono_1: string | null;
        };
        return {
          id: c.id,
          nombre: c.nombre,
          negocio: c.negocio,
          telefono_1: c.telefono_1,
          latitud: d.latitud as number,
          longitud: d.longitud as number,
          sector: d.sector ?? null,
        };
      });
  } catch {
    return [];
  }
}
