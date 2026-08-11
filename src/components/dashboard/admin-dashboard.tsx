import { KpiCard } from '@/components/dashboard/kpi-card';
import { RecargasBarChart } from '@/components/dashboard/recargas-bar-chart';
import { BotellonesDonutChart } from '@/components/dashboard/botellones-donut-chart';
import { TopClientesTable } from '@/components/dashboard/top-clientes-table';
import { AlertPanel } from '@/components/dashboard/alert-panel';
import { Users, Building2, Droplets, Gift, Truck, Package } from 'lucide-react';
import type {
  DashboardKpis,
  RecargaPorDia,
  BotellonPorEstado,
  TopCliente,
  AlertasPanel,
  ResumenesNegocio,
} from '@/lib/db/analytics';

type AdminDashboardProps = {
  kpis: DashboardKpis;
  recargasPorDia: RecargaPorDia[];
  botellonesPorEstado: BotellonPorEstado[];
  topClientes: TopCliente[];
  alertas: AlertasPanel;
  resumenes: ResumenesNegocio;
};

/**
 * Admin dashboard — full KPI cards, charts, alerts, and business summaries.
 * Server component receiving all data as props.
 */
export function AdminDashboard({
  kpis,
  recargasPorDia,
  botellonesPorEstado,
  topClientes,
  alertas,
  resumenes,
}: AdminDashboardProps) {
  const resumenItems = [
    { label: 'Cliente del mes', value: resumenes.clienteDelMes?.nombre ?? '—', sub: resumenes.clienteDelMes ? `${resumenes.clienteDelMes.total} recargas` : undefined },
    { label: 'Tasa de retorno', value: `${resumenes.tasaRetorno}%`, sub: 'Clientes con recarga repetida este mes' },
    { label: 'Zonas activas', value: resumenes.zonasActivas.length.toString(), sub: resumenes.zonasActivas.slice(0, 3).map((z) => z.sector).join(', ') || undefined },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <KpiCard
          label="Total clientes"
          value={kpis.totalClientes}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Nuevos este mes"
          value={kpis.nuevosEsteMes}
          icon={<Building2 className="h-4 w-4" />}
        />
        <KpiCard
          label="Botellones activos"
          value={kpis.botellonesActivos}
          icon={<Droplets className="h-4 w-4" />}
        />
        <KpiCard
          label="En planta"
          value={kpis.botellonesEnPlanta}
          icon={<Package className="h-4 w-4" />}
        />
        <KpiCard
          label="Recargas hoy"
          value={kpis.recargasHoy}
          icon={<Truck className="h-4 w-4" />}
        />
        <KpiCard
          label="Recargas este mes"
          value={kpis.recargasMes}
          delta={kpis.variacionPorcentaje}
          icon={<Truck className="h-4 w-4" />}
        />
        <KpiCard
          label="Premios pendientes"
          value={kpis.premiosPendientes}
          variant={kpis.premiosPendientes > 0 ? 'warning' : 'default'}
          icon={<Gift className="h-4 w-4" />}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecargasBarChart data={recargasPorDia} />
        </div>
        <div>
          <BotellonesDonutChart data={botellonesPorEstado} />
        </div>
      </div>

      {/* Ranking + Alertas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopClientesTable data={topClientes} />
        <AlertPanel data={alertas} />
      </div>

      {/* Business Summaries */}
      {resumenes.clienteDelMes && (
        <div className="grid gap-4 md:grid-cols-3">
          {resumenItems.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold">{item.value}</p>
              {item.sub && (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.sub}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
