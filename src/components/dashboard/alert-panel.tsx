import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { AlertTriangle, Gift, UserX, Wrench } from 'lucide-react';
import type { AlertasPanel } from '@/lib/db/analytics';

type AlertPanelProps = {
  data: AlertasPanel;
};

/**
 * Smart alert panel surfacing business risks with deep links.
 * Four sections: premios pendientes, inactivos 30d, inactivos 60d, dañados.
 */
export function AlertPanel({ data }: AlertPanelProps) {
  const { premiosPendientes, clientesInactivos30, clientesInactivos60, botellonesDanados } = data;

  const hasAlerts =
    premiosPendientes.length > 0 ||
    clientesInactivos30.length > 0 ||
    clientesInactivos60.length > 0 ||
    botellonesDanados.length > 0;

  if (!hasAlerts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-24 items-center justify-center text-muted-foreground text-sm">
          Sin alertas pendientes
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {premiosPendientes.length > 0 && (
          <Section
            icon={<Gift className="h-4 w-4" />}
            title="Premios pendientes"
            badge={premiosPendientes.length}
          >
            {premiosPendientes.map((a) => (
              <AlertRow key={a.id} item={a} />
            ))}
          </Section>
        )}

        {clientesInactivos30.length > 0 && (
          <Section
            icon={<UserX className="h-4 w-4" />}
            title="Inactivos 30+ días"
            badge={clientesInactivos30.length}
          >
            {clientesInactivos30.map((a) => (
              <AlertRow key={a.id} item={a} />
            ))}
          </Section>
        )}

        {clientesInactivos60.length > 0 && (
          <Section
            icon={<UserX className="h-4 w-4" />}
            title="Inactivos 60+ días"
            badge={clientesInactivos60.length}
            variant="destructive"
          >
            {clientesInactivos60.map((a) => (
              <AlertRow key={a.id} item={a} />
            ))}
          </Section>
        )}

        {botellonesDanados.length > 0 && (
          <Section
            icon={<Wrench className="h-4 w-4" />}
            title="Botellones dañados"
            badge={botellonesDanados.length}
            variant="destructive"
          >
            {botellonesDanados.map((a) => (
              <AlertRow key={a.id} item={a} />
            ))}
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  icon,
  title,
  badge,
  variant,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge: number;
  variant?: 'destructive';
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
        <Badge variant={variant === 'destructive' ? 'destructive' : 'secondary'}>
          {badge}
        </Badge>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function AlertRow({ item }: { item: { titulo: string; descripcion: string; href: string } }) {
  return (
    <Link
      href={item.href}
      className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm hover:bg-muted transition-colors"
    >
      <span className="font-medium text-foreground">{item.titulo}</span>
      <span className="text-muted-foreground text-xs">{item.descripcion}</span>
    </Link>
  );
}
