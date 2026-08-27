import { ColaOperaciones } from '@/components/operaciones/cola-operaciones';

export const dynamic = 'force-dynamic';

/**
 * Central de Operaciones — cola operativa agrupada por cliente (fase 3):
 * tabs + cards en mobile, secciones por estado en tablet, buscador, skeleton
 * y vacíos. El kanban viejo (operaciones-dashboard) queda en el árbol hasta
 * el slice de limpieza (rollback zero-loss: revertir este swap lo restaura).
 */
export default async function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Central de Operaciones</h1>
      <ColaOperaciones />
    </div>
  );
}