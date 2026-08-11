import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';

type KpiCardProps = {
  label: string;
  value: number | string;
  delta?: number;
  icon?: React.ReactNode;
  variant?: 'default' | 'warning';
  href?: string;
};

/**
 * KPI metric card for the admin dashboard.
 * Shows a large value, label, optional percentage variation, and an icon.
 */
export function KpiCard({ label, value, delta, icon, variant, href }: KpiCardProps) {
  const deltaColor =
    delta === undefined
      ? ''
      : delta >= 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';

  const content = (
    <Card
      size="sm"
      className={cn(
        'transition-shadow hover:shadow-md',
        variant === 'warning' && 'ring-2 ring-amber-400 dark:ring-amber-500',
        href && 'cursor-pointer'
      )}
    >
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {delta !== undefined && (
              <div className={cn('flex items-center gap-0.5 text-xs font-medium', deltaColor)}>
                {delta >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(delta)}% vs mes anterior</span>
              </div>
            )}
          </div>
          {icon && (
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">{icon}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="block no-underline">
        {content}
      </a>
    );
  }

  return content;
}
