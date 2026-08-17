import { getConfiguracion } from '@/lib/db/configuracion';
import { ConfigForm } from './config-form';

export const dynamic = 'force-dynamic';

/**
 * Admin configuration page: business name, contact info, and logo.
 * Only accessible by admin (enforced by middleware).
 */
export default async function ConfiguracionPage() {
  const config = await getConfiguracion();

  return <ConfigForm initialConfig={config} />;
}
