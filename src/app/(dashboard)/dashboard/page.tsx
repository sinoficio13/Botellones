import { ColaOperaciones } from '@/components/operaciones/cola-operaciones';

export const dynamic = 'force-dynamic';

/**
 * Central de Operaciones — cola operativa agrupada por cliente (fase 3):
 * tabs + cards en mobile, secciones por estado en tablet, skeleton y vacíos.
 * El kanban viejo (operaciones-dashboard) se eliminó en el slice de limpieza;
 * rollback: restaurar el archivo desde git history. El h1 se quitó porque el
 * título ahora vive en la barra de navegación del shell del dashboard.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { scan } = await searchParams;
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <ColaOperaciones autoOpenScan={scan === '1'} />
    </div>
  );
}