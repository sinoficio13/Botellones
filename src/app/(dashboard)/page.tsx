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
    // dev placeholder user ID — will be replaced with auth.uid() after EPIC-1 auth hardening
    const devUserId = '00000000-0000-0000-0000-000000000000';
    const data = await getRepartidorDashboard(devUserId);
    return <RepartidorDashboard data={data} />;
  }

  // Admin (or fallback)
  const [kpis, recargasPorDia, botellonesPorEstado, topClientes, alertas, resumenes] =
    await Promise.all([
      getDashboardKpis(),
      getRecargasPorDia(30),
      getBotellonesPorEstado(),
      getTopClientes(10),
      getAlertas(),
      getResumenesNegocio(),
    ]);

  return (
    <AdminDashboard
      kpis={kpis}
      recargasPorDia={recargasPorDia}
      botellonesPorEstado={botellonesPorEstado}
      topClientes={topClientes}
      alertas={alertas}
      resumenes={resumenes}
    />
  );
}

/**
 * Determine the current user's role.
 */
async function getUserRole(): Promise<'admin' | 'repartidor' | null> {
  // ── Dev mode: cookie-based role ──
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

  // ── Production: Supabase Auth ──
  try {
    const { createServerClient } = await import('@supabase/ssr');
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const role = user.app_metadata?.role;
    return role === 'admin' || role === 'repartidor' ? role : null;
  } catch {
    return null;
  }
}
