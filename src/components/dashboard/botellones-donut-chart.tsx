'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type BotellonesDonutChartProps = {
  data: { estado: string; count: number }[];
};

const ESTADO_COLORS: Record<string, string> = {
  disponible: 'hsl(142, 71%, 45%)',
  asignado: 'hsl(221, 83%, 53%)',
  en_recarga: 'hsl(38, 92%, 50%)',
  dañado: 'hsl(0, 84%, 60%)',
  perdido: 'hsl(0, 72%, 45%)',
  en_planta: 'hsl(262, 83%, 58%)',
};

const FALLBACK_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
];

/**
 * Donut chart showing botellón distribution by estado.
 * Thin 'use client' wrapper around recharts PieChart.
 */
export function BotellonesDonutChart({ data }: BotellonesDonutChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Botellones por estado</CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground text-sm">
          Sin botellones registrados
        </CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({
    name: d.estado.replace(/_/g, ' '),
    value: d.count,
    color: ESTADO_COLORS[d.estado] ?? FALLBACK_COLORS[0],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Botellones por estado</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={formatted}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {formatted.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                formatter={(value: string) => (
                  <span style={{ color: 'hsl(var(--foreground))', fontSize: '12px' }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
