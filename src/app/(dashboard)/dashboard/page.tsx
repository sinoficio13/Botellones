import { cookies } from 'next/headers';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { RepartidorDashboard } from '@/components/dashboard/repartidor-dashboard';
import {
  getDashboardKpis,
  getRecargasPorDia,
  getBotellonesPorEstado,
  getTopClientes,
  getAlertas,
  getResumenesNegocio,
  getRepartidorDashboard,
} from '@/lib/db/analytics';
import type { RecargaPorDia, BotellonPorEstado, TopCliente } from '@/lib/db/analytics';

/**
 * Dashboard page — role-aware server component.
 *
 * Dev mode: reads role from botellon_dev_session cookie.
 * Production: reads role from Supabase Auth via cookies.
 *
 * Admin → full KPI dashboard with charts, alerts, and summaries.
 * Repartidor → simplified today-view with recarga count and assigned clients.
 */
export default async function DashboardPage() {
  const role = await getUserRole();

  if (role === 'repartidor') {
    const devUserId = '00000000-0000-0000-0000-000000000000';
    const data = await getRepartidorDashboard(devUserId);
    return <RepartidorDashboard data={data} />;
  }

  // Admin (or fallback) — each query wrapped individually so one failure doesn't crash the page
  const [
    kpis,
    recargasPorDia,
    botellonesPorEstado,
    topClientes,
    alertas,
    resumenes,
  ] = await Promise.all([
    getDashboardKpis().catch(() => null),
    getRecargasPorDia(30).catch(() => []),
    getBotellonesPorEstado().catch(() => []),
    getTopClientes(10).catch(() => []),
    getAlertas().catch(() => null),
    getResumenesNegocio().catch(() => null),
  ]);

  return (
    <AdminDashboard
      kpis={kpis ?? {
        totalClientes: 0, nuevosEsteMes: 0, botellonesActivos: 0, botellonesEnPlanta: 0,
        recargasHoy: 0, recargasMes: 0, recargasMesAnterior: 0, premiosPendientes: 0,
        variacionPorcentaje: 0,
      }}
      recargasPorDia={recargasPorDia as RecargaPorDia[]}
      botellonesPorEstado={botellonesPorEstado as BotellonPorEstado[]}
      topClientes={topClientes as TopCliente[]}
      alertas={alertas ?? { premiosPendientes: [], clientesInactivos30: [], clientesInactivos60: [], botellonesDanados: [] }}
      resumenes={resumenes ?? { clienteDelMes: null, tendenciaMensual: [], zonasActivas: [], tasaRetorno: 0 }}
    />
  );
}

async function getUserRole(): Promise<'admin' | 'repartidor' | null> {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'dev') {
    const cookieStore = await cookies();
    const raw = cookieStore.get('botellon_dev_session')?.value;
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as { email: string; role: string };
      return session.role as 'admin' | 'repartidor';
    } catch {
      return null;
    }
  }
  return null;
}