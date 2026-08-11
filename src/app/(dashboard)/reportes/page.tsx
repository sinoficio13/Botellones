import { ReportesTabs } from '@/components/reportes/reportes-tabs';
import { ResumenesNegocio } from '@/components/reportes/resumenes-negocio';
import { getResumenesNegocio } from '@/lib/db/analytics';

/**
 * Reportes page — admin-only (middleware guard).
 *
 * Renders tabbed reports (Clientes, Recargas, Botellones, Fidelidad, Operaciones)
 * with shared date filter, plus business summaries at the bottom.
 */
export default async function ReportesPage() {
  const resumenes = await getResumenesNegocio();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>

      <ReportesTabs />

      <ResumenesNegocio data={resumenes} />
    </div>
  );
}
