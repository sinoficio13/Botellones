import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Search, Truck, Users } from 'lucide-react';
import type { RepartidorDashboard as RepartidorDashboardData } from '@/lib/db/analytics';

type RepartidorDashboardProps = {
  data: RepartidorDashboardData;
};

/**
 * Simplified dashboard for delivery personnel.
 * Shows today's recarga count, assigned clients, and quick-action buttons.
 */
export function RepartidorDashboard({ data }: RepartidorDashboardProps) {
  const { recargasHoy, clientesAsignados } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">Mi Panel</h1>

      {/* Today count card */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Truck className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-4xl font-bold tabular-nums">{recargasHoy}</p>
            <p className="mt-1 text-sm text-muted-foreground">Recargas hoy</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link href="/recargas" className="flex-1">
          <Button className="w-full">
            <Truck className="mr-2 h-4 w-4" />
            Registrar recarga
          </Button>
        </Link>
        <Link href="/clientes" className="flex-1">
          <Button variant="outline" className="w-full">
            <Search className="mr-2 h-4 w-4" />
            Buscar cliente
          </Button>
        </Link>
      </div>

      {/* Assigned clients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes asignados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clientesAsignados.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No tenés clientes asignados
            </p>
          ) : (
            <ul className="divide-y">
              {clientesAsignados.map((c) => (
                <li key={c.id} className="py-2.5">
                  <Link
                    href={`/clientes/${c.id}`}
                    className="flex items-center justify-between hover:text-primary transition-colors"
                  >
                    <span className="font-medium">{c.nombre}</span>
                    {c.negocio && (
                      <span className="text-xs text-muted-foreground">{c.negocio}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
