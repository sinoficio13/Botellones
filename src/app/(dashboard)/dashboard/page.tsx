import { getOperaciones } from '@/lib/db/botellones';
import { OperacionesDashboard } from '@/components/dashboard/operaciones-dashboard';

export const dynamic = 'force-dynamic';

/**
 * Central de Operaciones — kanban del ciclo de vida de botellones,
 * circulación, alertas y KPIs en tiempo real.
 */
export default async function DashboardPage() {
  const { botellones, recargasHoy } = await getOperaciones();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Central de Operaciones</h1>
      <OperacionesDashboard botellones={botellones} recargasHoy={recargasHoy} />
    </div>
  );
}