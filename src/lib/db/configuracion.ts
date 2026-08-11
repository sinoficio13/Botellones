'use server';

// ── Types ──

export type ConfiguracionRow = {
  nombre_negocio: string | null;
  logo_url: string | null;
};

// ── Defaults ──

const DEFAULT_BUSINESS_NAME = 'Botellón';

// ── Helpers ──

function getSupabase() {
  return import('@supabase/supabase-js').then(({ createClient }) => {
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      '';
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  });
}

// ── Query ──

export async function getConfiguracion(): Promise<ConfiguracionRow> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('configuracion')
      .select('nombre_negocio, logo_url')
      .maybeSingle();

    if (!data) {
      return { nombre_negocio: DEFAULT_BUSINESS_NAME, logo_url: null };
    }

    return {
      nombre_negocio: data.nombre_negocio || DEFAULT_BUSINESS_NAME,
      logo_url: data.logo_url || null,
    };
  } catch {
    return { nombre_negocio: DEFAULT_BUSINESS_NAME, logo_url: null };
  }
}
