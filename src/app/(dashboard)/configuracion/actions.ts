'use server';

import { revalidatePath } from 'next/cache';
import { getConfiguracion, saveConfiguracion } from '@/lib/db/configuracion';
import { createAdminClient } from '@/lib/supabase/admin';

export type ConfigState = {
  success?: boolean;
  error?: string;
};

/**
 * Save business configuration to the configuracion table (single row, id=1).
 * Logo is uploaded to Supabase Storage (public `logos` bucket) and its public
 * URL is stored in the `logo_url` column.
 */
export async function saveConfig(
  _prevState: ConfigState | null,
  formData: FormData
): Promise<ConfigState> {
  const nombre_negocio = (formData.get('nombre_negocio') as string)?.trim();
  const telefono = (formData.get('telefono') as string)?.trim() || '';
  const direccion = (formData.get('direccion') as string)?.trim() || '';
  const email = (formData.get('email') as string)?.trim() || '';
  const logoFile = formData.get('logo_file') as File | null;
  const remove_logo = formData.get('remove_logo') === 'true';

  if (!nombre_negocio) {
    return { error: 'El nombre del negocio es requerido' };
  }

  // Logo precedence: explicit removal > new upload > keep existing
  let logo_url: string | null;
  if (remove_logo) {
    logo_url = null;
  } else if (logoFile && logoFile.size > 0) {
    const ext =
      logoFile.type === 'image/png'
        ? 'png'
        : logoFile.type === 'image/svg+xml'
          ? 'svg'
          : 'png';

    const supabase = createAdminClient();

    const { error } = await supabase.storage
      .from('logos')
      .upload(`logo/logo.${ext}`, logoFile, {
        upsert: true,
        contentType: logoFile.type,
      });

    if (error) {
      return { error: 'Error al subir el logo: ' + error.message };
    }

    const { data } = supabase.storage
      .from('logos')
      .getPublicUrl(`logo/logo.${ext}`);
    logo_url = data.publicUrl;
  } else {
    const existing = await getConfiguracion();
    logo_url = existing.logo_url;
  }

  const result = await saveConfiguracion({
    nombre_negocio,
    telefono,
    direccion,
    email,
    logo_url,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
