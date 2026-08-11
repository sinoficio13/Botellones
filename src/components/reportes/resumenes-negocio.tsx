import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Trophy, MapPin, Repeat } from 'lucide-react';
import type { ResumenesNegocio } from '@/lib/db/analytics';

type ResumenesNegocioProps = {
  data: ResumenesNegocio;
};

/**
 * Business summary cards: cliente del mes, tendencia, zonas activas, tasa retorno.
 * Server component with empty states per spec RP-05, RP-06.
 */
export function ResumenesNegocio({ data }: ResumenesNegocioProps) {
  const { clienteDelMes, tendenciaMensual, zonasActivas, tasaRetorno } = data;

  const totalTendencia = tendenciaMensual.reduce((s, m) => s + m.count, 0);

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <SummaryCard
        icon={<Trophy className="h-5 w-5 text-amber-500" />}
        label="Cliente del mes"
        value={clienteDelMes?.nombre ?? 'Sin datos'}
        sub={clienteDelMes ? `${clienteDelMes.total} recargas` : undefined}
      />

      <SummaryCard
        icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
        label="Tendencia 6 meses"
        value={totalTendencia.toString()}
        sub="Total recargas"
      />

      <SummaryCard
        icon={<MapPin className="h-5 w-5 text-blue-500" />}
        label="Zonas activas"
        value={zonasActivas.length.toString()}
        sub={zonasActivas.length > 0 ? zonasActivas.slice(0, 2).map((z) => z.sector).join(', ') : undefined}
      />

      <SummaryCard
        icon={<Repeat className="h-5 w-5 text-purple-500" />}
        label="Tasa de retorno"
        value={`${tasaRetorno}%`}
        sub="Clientes que repitieron este mes"
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2">{icon}</div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
