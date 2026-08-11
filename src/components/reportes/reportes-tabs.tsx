'use client';

import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FiltroFechas, type FiltroState } from '@/components/reportes/filtro-fechas';
import { RecargasBarChart } from '@/components/dashboard/recargas-bar-chart';
import { BotellonesDonutChart } from '@/components/dashboard/botellones-donut-chart';
import Link from 'next/link';
import { getClientes } from '@/lib/db/clientes';
import {
  getRecargasPorDia,
  getBotellonesPorEstado,
  getTopClientes,
  getResumenesNegocio,
  type RecargaPorDia,
  type BotellonPorEstado,
  type TopCliente,
  type ResumenesNegocio,
} from '@/lib/db/analytics';
import { getPremios } from '@/lib/db/premios';
import { getBotellones } from '@/lib/db/botellones';
import { getContadores } from '@/lib/db/recargas';

type TabData = {
  clientes: Awaited<ReturnType<typeof getClientes>> | null;
  recargas: RecargaPorDia[] | null;
  botellonesEstados: BotellonPorEstado[] | null;
  botellones: Awaited<ReturnType<typeof getBotellones>> | null;
  topClientes: TopCliente[] | null;
  contadores: Awaited<ReturnType<typeof getContadores>> | null;
  premiosPendientes: Awaited<ReturnType<typeof getPremios>> | null;
  premiosEntregados: Awaited<ReturnType<typeof getPremios>> | null;
  resumenes: ResumenesNegocio | null;
};

/**
 * Tabbed reportes view with per-tab data fetching and shared date filter.
 * 'use client' component managing tabs and filter state.
 */
export function ReportesTabs() {
  const [filtro, setFiltro] = useState<FiltroState>({ desde: '', hasta: '' });
  const [data, setData] = useState<TabData>({
    clientes: null,
    recargas: null,
    botellonesEstados: null,
    botellones: null,
    topClientes: null,
    contadores: null,
    premiosPendientes: null,
    premiosEntregados: null,
    resumenes: null,
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleFilterChange = useCallback((f: FiltroState) => {
    setFiltro(f);
    // Clear data to refetch on tab switch
    setData({
      clientes: null,
      recargas: null,
      botellonesEstados: null,
      botellones: null,
      topClientes: null,
      contadores: null,
      premiosPendientes: null,
      premiosEntregados: null,
      resumenes: null,
    });
  }, []);

  const loadTab = useCallback(
    async (tab: string) => {
      if (loading[tab]) return;
      setLoading((prev) => ({ ...prev, [tab]: true }));

      try {
        switch (tab) {
          case 'clientes': {
            const clientes = await getClientes(1, 50, filtro.tipo || undefined);
            setData((prev) => ({ ...prev, clientes }));
            break;
          }
          case 'recargas': {
            const days = filtro.desde && filtro.hasta ? calcDays(filtro.desde, filtro.hasta) : 30;
            const recargas = await getRecargasPorDia(days);
            const contadores = await getContadores();
            const topClientes = await getTopClientes(20);
            setData((prev) => ({ ...prev, recargas, contadores, topClientes }));
            break;
          }
          case 'botellones': {
            const [estados, botellones] = await Promise.all([
              getBotellonesPorEstado(),
              getBotellones(1, 50),
            ]);
            setData((prev) => ({
              ...prev,
              botellonesEstados: estados,
              botellones,
            }));
            break;
          }
          case 'fidelidad': {
            const [pendientes, entregados] = await Promise.all([
              getPremios('pendiente', 1),
              getPremios('entregado', 1),
            ]);
            setData((prev) => ({ ...prev, premiosPendientes: pendientes, premiosEntregados: entregados }));
            break;
          }
          case 'operaciones': {
            const resumenes = await getResumenesNegocio();
            setData((prev) => ({ ...prev, resumenes }));
            break;
          }
        }
      } finally {
        setLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [filtro, loading]
  );

  return (
    <div className="space-y-6">
      <FiltroFechas onFilterChange={handleFilterChange} />

      <Tabs
        defaultValue="clientes"
        onValueChange={(tab) => {
          if (
            (tab === 'clientes' && !data.clientes) ||
            (tab === 'recargas' && !data.recargas) ||
            (tab === 'botellones' && !data.botellonesEstados) ||
            (tab === 'fidelidad' && !data.premiosPendientes) ||
            (tab === 'operaciones' && !data.resumenes)
          ) {
            loadTab(tab);
          }
        }}
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="recargas">Recargas</TabsTrigger>
          <TabsTrigger value="botellones">Botellones</TabsTrigger>
          <TabsTrigger value="fidelidad">Fidelidad</TabsTrigger>
          <TabsTrigger value="operaciones">Operaciones</TabsTrigger>
        </TabsList>

        {/* Clientes tab */}
        <TabsContent value="clientes" className="mt-4">
          {loading.clientes ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : data.clientes ? (
            <Card>
              <CardHeader>
                <CardTitle>Clientes ({data.clientes.total})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Recargas</TableHead>
                      <TableHead className="pr-4">Última</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.clientes.clientes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="pl-4 font-mono text-xs">{c.codigo}</TableCell>
                        <TableCell>
                          <Link href={`/clientes/${c.id}`} className="text-primary hover:underline">
                            {c.nombre}
                          </Link>
                        </TableCell>
                        <TableCell>{c.telefono_1}</TableCell>
                        <TableCell>{c.tipo_cliente ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.total_recargas}
                        </TableCell>
                        <TableCell className="pr-4">{c.ultima_recarga ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* Recargas tab */}
        <TabsContent value="recargas" className="mt-4">
          {loading.recargas ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : data.recargas && data.contadores ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard label="Recargas hoy" value={data.contadores.recargas_hoy} />
                <StatCard label="Recargas este mes" value={data.contadores.recargas_mes} />
                <StatCard label="Total histórico" value={data.contadores.recargas_total} />
              </div>
              <RecargasBarChart data={data.recargas} />
              {data.topClientes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top 20 clientes</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 pl-4">#</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-right pr-4">Recargas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topClientes.map((c, i) => (
                          <TableRow key={c.cliente_id}>
                            <TableCell className="pl-4 text-muted-foreground">{i + 1}</TableCell>
                            <TableCell>
                              <Link href={`/clientes/${c.cliente_id}`} className="text-primary hover:underline">
                                {c.nombre}
                              </Link>
                            </TableCell>
                            <TableCell className="text-right pr-4 tabular-nums font-medium">
                              {c.total_recargas}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </TabsContent>

        {/* Botellones tab */}
        <TabsContent value="botellones" className="mt-4">
          {loading.botellones ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : data.botellonesEstados ? (
            <div className="space-y-6">
              <div className="mx-auto max-w-md">
                <BotellonesDonutChart data={data.botellonesEstados} />
              </div>
              {data.botellones && (
                <Card>
                  <CardHeader>
                    <CardTitle>Botellones ({data.botellones.total})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Código</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="pr-4">Creado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.botellones.botellones.map((b: any) => (
                          <TableRow key={b.id}>
                            <TableCell className="pl-4 font-mono text-xs">{b.codigo}</TableCell>
                            <TableCell>{b.estado}</TableCell>
                            <TableCell>
                              {b.clientes?.nombre ? (
                                <Link href={`/clientes/${b.cliente_id}`} className="text-primary hover:underline">
                                  {b.clientes.nombre}
                                </Link>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="pr-4">{b.fecha_creacion?.slice(0, 10) ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </TabsContent>

        {/* Fidelidad tab */}
        <TabsContent value="fidelidad" className="mt-4">
          {loading.fidelidad ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : data.premiosPendientes ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Premios pendientes ({data.premiosPendientes.total})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Cliente</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead className="pr-4">Alcanzado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.premiosPendientes.premios.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                            Sin premios pendientes
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.premiosPendientes.premios.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="pl-4">
                              <Link href={`/clientes/${p.cliente_id}`} className="text-primary hover:underline">
                                {p.clientes?.nombre ?? '—'}
                              </Link>
                            </TableCell>
                            <TableCell>{p.nivel_recargas}</TableCell>
                            <TableCell className="pr-4">{p.fecha_alcanzado}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Premios entregados ({data.premiosEntregados?.total ?? 0})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {data.premiosEntregados && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Cliente</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="pr-4">Nivel</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.premiosEntregados.premios.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                              Sin premios entregados
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.premiosEntregados.premios.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="pl-4">
                                <Link href={`/clientes/${p.cliente_id}`} className="text-primary hover:underline">
                                  {p.clientes?.nombre ?? '—'}
                                </Link>
                              </TableCell>
                              <TableCell>{p.tipo_premio ?? '—'}</TableCell>
                              <TableCell className="pr-4">{p.nivel_recargas}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* Operaciones tab */}
        <TabsContent value="operaciones" className="mt-4">
          {loading.operaciones ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : data.resumenes ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard
                  label="Cliente del mes"
                  value={data.resumenes.clienteDelMes?.nombre ?? 'Sin datos'}
                  sub={data.resumenes.clienteDelMes ? `${data.resumenes.clienteDelMes.total} recargas` : undefined}
                />
                <StatCard label="Tasa de retorno" value={`${data.resumenes.tasaRetorno}%`} />
                <StatCard label="Zonas activas" value={data.resumenes.zonasActivas.length.toString()} />
                <StatCard
                  label="Tendencia 6m"
                  value={
                    data.resumenes.tendenciaMensual.length > 0
                      ? data.resumenes.tendenciaMensual.reduce((s, m) => s + m.count, 0).toString()
                      : '0'
                  }
                  sub="Total recargas 6 meses"
                />
              </div>

              {/* Tendencia mensual */}
              {data.resumenes.tendenciaMensual.length > 0 && (
                <RecargasBarChart
                  data={data.resumenes.tendenciaMensual.map((m) => ({
                    fecha: m.mes,
                    count: m.count,
                  }))}
                />
              )}

              {/* Zonas activas */}
              {data.resumenes.zonasActivas.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Zonas activas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Sector</TableHead>
                          <TableHead className="text-right pr-4">Clientes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.resumenes.zonasActivas.map((z) => (
                          <TableRow key={z.sector}>
                            <TableCell className="pl-4">{z.sector}</TableCell>
                            <TableCell className="text-right pr-4 tabular-nums">{z.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function calcDays(desde: string, hasta: string): number {
  const d1 = new Date(desde);
  const d2 = new Date(hasta);
  return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1);
}
