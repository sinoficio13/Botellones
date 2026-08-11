'use server';

// ── Types ──

export type DashboardKpis = {
  totalClientes: number;
  nuevosEsteMes: number;
  botellonesActivos: number;
  botellonesEnPlanta: number;
  recargasHoy: number;
  recargasMes: number;
  recargasMesAnterior: number;
  premiosPendientes: number;
  variacionPorcentaje: number;
};

export type RecargaPorDia = {
  fecha: string;
  count: number;
};

export type BotellonPorEstado = {
  estado: string;
  count: number;
};

export type TopCliente = {
  cliente_id: string;
  nombre: string;
  total_recargas: number;
};

export type AlertaItem = {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  href: string;
  entidadId: string;
};

export type AlertasPanel = {
  premiosPendientes: AlertaItem[];
  clientesInactivos30: AlertaItem[];
  clientesInactivos60: AlertaItem[];
  botellonesDanados: AlertaItem[];
};

export type ResumenesNegocio = {
  clienteDelMes: { nombre: string; total: number } | null;
  tendenciaMensual: { mes: string; count: number }[];
  zonasActivas: { sector: string; count: number }[];
  tasaRetorno: number;
};

export type RepartidorDashboard = {
  recargasHoy: number;
  clientesAsignados: { id: string; nombre: string; negocio: string | null }[];
};

// ── Helpers ──

function getSupabase() {
  return import('@supabase/supabase-js').then(({ createClient }) => {
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      '';
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function firstDayOfPrevMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return firstDayOfMonth(d);
}

// ── KPI Aggregation ──

export async function getDashboardKpis(): Promise<DashboardKpis> {
  try {
    const supabase = await getSupabase();
    const hoy = today();
    const mesInicio = firstDayOfMonth();
    const mesAnteriorInicio = firstDayOfPrevMonth();

    // Run all count queries in parallel
    const [
      { count: totalClientes },
      { count: nuevosEsteMes },
      { count: botellonesActivos },
      { count: botellonesEnPlanta },
      { count: recargasHoy },
      { count: recargasMes },
      { count: recargasMesAnterior },
      { count: premiosPendientes },
    ] = await Promise.all([
      supabase.from('clientes').select('*', { count: 'exact', head: true }),
      supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .gte('fecha_registro', mesInicio),
      supabase
        .from('botellones')
        .select('*', { count: 'exact', head: true })
        .in('estado', ['asignado', 'en_recarga']),
      supabase
        .from('botellones')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'disponible'),
      supabase
        .from('recargas')
        .select('*', { count: 'exact', head: true })
        .eq('fecha', hoy),
      supabase
        .from('recargas')
        .select('*', { count: 'exact', head: true })
        .gte('fecha', mesInicio)
        .lte('fecha', hoy),
      supabase
        .from('recargas')
        .select('*', { count: 'exact', head: true })
        .gte('fecha', mesAnteriorInicio)
        .lt('fecha', mesInicio),
      supabase
        .from('premios')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'pendiente'),
    ]);

    const rMes = recargasMes ?? 0;
    const rMesAnt = recargasMesAnterior ?? 0;
    const variacionPorcentaje =
      rMesAnt === 0 ? (rMes > 0 ? 100 : 0) : Math.round(((rMes - rMesAnt) / rMesAnt) * 100);

    return {
      totalClientes: totalClientes ?? 0,
      nuevosEsteMes: nuevosEsteMes ?? 0,
      botellonesActivos: botellonesActivos ?? 0,
      botellonesEnPlanta: botellonesEnPlanta ?? 0,
      recargasHoy: recargasHoy ?? 0,
      recargasMes: rMes,
      recargasMesAnterior: rMesAnt,
      premiosPendientes: premiosPendientes ?? 0,
      variacionPorcentaje,
    };
  } catch {
    return {
      totalClientes: 0,
      nuevosEsteMes: 0,
      botellonesActivos: 0,
      botellonesEnPlanta: 0,
      recargasHoy: 0,
      recargasMes: 0,
      recargasMesAnterior: 0,
      premiosPendientes: 0,
      variacionPorcentaje: 0,
    };
  }
}

// ── Recargas per day (last N days) ──

export async function getRecargasPorDia(days = 30): Promise<RecargaPorDia[]> {
  try {
    const supabase = await getSupabase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const desde = startDate.toISOString().slice(0, 10);

    const { data } = await supabase
      .from('recargas')
      .select('fecha')
      .gte('fecha', desde)
      .order('fecha');

    if (!data) return [];

    // Aggregate count by date in JS (Supabase doesn't support GROUP BY via supabase-js directly for raw aggregates)
    const counts = new Map<string, number>();
    for (const row of data) {
      counts.set(row.fecha, (counts.get(row.fecha) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([fecha, count]) => ({ fecha, count }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  } catch {
    return [];
  }
}

// ── Botellones by estado ──

export async function getBotellonesPorEstado(): Promise<BotellonPorEstado[]> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.from('botellones').select('estado');

    if (!data) return [];

    const counts = new Map<string, number>();
    for (const row of data) {
      counts.set(row.estado, (counts.get(row.estado) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([estado, count]) => ({
      estado,
      count,
    }));
  } catch {
    return [];
  }
}

// ── Top 10 clientes by recargas ──

export async function getTopClientes(limit = 10): Promise<TopCliente[]> {
  try {
    const supabase = await getSupabase();

    // Get all recargas grouped by cliente
    const { data: recargas } = await supabase
      .from('recargas')
      .select('cliente_id, clientes(nombre)');

    if (!recargas) return [];

    // Aggregate in JS
    const map = new Map<
      string,
      { cliente_id: string; nombre: string; total_recargas: number }
    >();
    for (const r of recargas) {
      const existing = map.get(r.cliente_id);
      const nombre = (r.clientes as any)?.nombre ?? 'Desconocido';
      if (existing) {
        existing.total_recargas++;
      } else {
        map.set(r.cliente_id, { cliente_id: r.cliente_id, nombre, total_recargas: 1 });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.total_recargas - a.total_recargas)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// ── Alertas ──

export async function getAlertas(): Promise<AlertasPanel> {
  try {
    const supabase = await getSupabase();

    // premios pendientes — join clientes
    const { data: premios } = await supabase
      .from('premios')
      .select('id, cliente_id, nivel_recargas, clientes(nombre)')
      .eq('estado', 'pendiente')
      .order('fecha_alcanzado', { ascending: false })
      .limit(20);

    // botellones dañados/perdidos — join clientes
    const { data: danados } = await supabase
      .from('botellones')
      .select('id, codigo, estado, cliente_id, clientes(nombre)')
      .in('estado', ['dañado', 'perdido'])
      .order('fecha_creacion', { ascending: false })
      .limit(20);

    // Inactive clients (30+ days since last recarga)
    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const since60 = new Date();
    since60.setDate(since60.getDate() - 60);
    const fecha30 = since30.toISOString().slice(0, 10);
    const fecha60 = since60.toISOString().slice(0, 10);

    // Get all clientes and their last recarga date
    const { data: clientes } = await supabase.from('clientes').select('id, nombre');
    if (!clientes) {
      return {
        premiosPendientes: [],
        clientesInactivos30: [],
        clientesInactivos60: [],
        botellonesDanados: [],
      };
    }

    const inactivos30: AlertaItem[] = [];
    const inactivos60: AlertaItem[] = [];

    for (const c of clientes) {
      const { data: lastRecarga } = await supabase
        .from('recargas')
        .select('fecha')
        .eq('cliente_id', c.id)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastFecha = lastRecarga?.fecha ?? null;

      if (!lastFecha || lastFecha < fecha60) {
        inactivos60.push({
          id: c.id,
          tipo: 'inactivo_60',
          titulo: c.nombre,
          descripcion: lastFecha
            ? `Última recarga: ${lastFecha}`
            : 'Sin recargas registradas',
          href: `/clientes/${c.id}`,
          entidadId: c.id,
        });
      } else if (lastFecha < fecha30) {
        inactivos30.push({
          id: c.id,
          tipo: 'inactivo_30',
          titulo: c.nombre,
          descripcion: `Última recarga: ${lastFecha}`,
          href: `/clientes/${c.id}`,
          entidadId: c.id,
        });
      }
    }

    return {
      premiosPendientes: (premios ?? []).map((p) => ({
        id: p.id,
        tipo: 'premio',
        titulo: (p.clientes as any)?.nombre ?? 'Cliente',
        descripcion: `Nivel ${p.nivel_recargas} recargas`,
        href: `/clientes/${p.cliente_id}`,
        entidadId: p.cliente_id,
      })),
      clientesInactivos30: inactivos30,
      clientesInactivos60: inactivos60,
      botellonesDanados: (danados ?? []).map((b) => ({
        id: b.id,
        tipo: 'danado',
        titulo: `Botellón ${b.codigo}`,
        descripcion: `Estado: ${b.estado}${(b.clientes as any)?.nombre ? ` — ${(b.clientes as any).nombre}` : ''}`,
        href: `/botellones/${b.id}`,
        entidadId: b.id,
      })),
    };
  } catch {
    return {
      premiosPendientes: [],
      clientesInactivos30: [],
      clientesInactivos60: [],
      botellonesDanados: [],
    };
  }
}

// ── Business summaries ──

export async function getResumenesNegocio(): Promise<ResumenesNegocio> {
  try {
    const supabase = await getSupabase();
    const mesInicio = firstDayOfMonth();

    // cliente del mes
    const { data: top } = await supabase
      .from('recargas')
      .select('cliente_id, clientes(nombre)')
      .gte('fecha', mesInicio);

    let clienteDelMes: { nombre: string; total: number } | null = null;
    if (top) {
      const map = new Map<string, { nombre: string; total: number }>();
      for (const r of top) {
        const existing = map.get(r.cliente_id);
        if (existing) {
          existing.total++;
        } else {
          map.set(r.cliente_id, {
            nombre: (r.clientes as any)?.nombre ?? 'Desconocido',
            total: 1,
          });
        }
      }
      const sorted = Array.from(map.values()).sort((a, b) => b.total - a.total);
      if (sorted.length > 0) clienteDelMes = sorted[0];
    }

    // tendencia mensual — last 6 months
    const tendenciaMensual: { mes: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mesInicio = firstDayOfMonth(d);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const mesFin = new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10);
      const mesLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const { count } = await supabase
        .from('recargas')
        .select('*', { count: 'exact', head: true })
        .gte('fecha', mesInicio)
        .lte('fecha', mesFin);

      tendenciaMensual.push({ mes: mesLabel, count: count ?? 0 });
    }

    // zonas activas — by sector
    const { data: clientes } = await supabase.from('clientes').select('sector');
    const sectorMap = new Map<string, number>();
    if (clientes) {
      for (const c of clientes) {
        const sector = c.sector ?? 'Sin sector';
        sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + 1);
      }
    }
    const zonasActivas = Array.from(sectorMap.entries())
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count);

    // tasa de retorno: % of clients with >1 recarga this month
    const { data: recargasMes } = await supabase
      .from('recargas')
      .select('cliente_id')
      .gte('fecha', mesInicio);

    let tasaRetorno = 0;
    if (recargasMes) {
      const clientCounts = new Map<string, number>();
      for (const r of recargasMes) {
        clientCounts.set(r.cliente_id, (clientCounts.get(r.cliente_id) ?? 0) + 1);
      }
      const returning = Array.from(clientCounts.values()).filter((c) => c > 1).length;
      const total = clientCounts.size;
      tasaRetorno = total > 0 ? Math.round((returning / total) * 100) : 0;
    }

    return { clienteDelMes, tendenciaMensual, zonasActivas, tasaRetorno };
  } catch {
    return {
      clienteDelMes: null,
      tendenciaMensual: [],
      zonasActivas: [],
      tasaRetorno: 0,
    };
  }
}

// ── Repartidor dashboard ──

export async function getRepartidorDashboard(
  userId: string
): Promise<RepartidorDashboard> {
  try {
    const supabase = await getSupabase();
    const hoy = today();

    // Recargas hoy for this repartidor
    const { count: recargasHoy } = await supabase
      .from('recargas')
      .select('*', { count: 'exact', head: true })
      .eq('fecha', hoy)
      .eq('realizada_por', userId);

    // Assigned clients — join through botellones
    const { data: botellones } = await supabase
      .from('botellones')
      .select('cliente_id, clientes(id, nombre, negocio)')
      .in('estado', ['asignado', 'en_recarga']);

    const seen = new Set<string>();
    const clientesAsignados: { id: string; nombre: string; negocio: string | null }[] = [];

    if (botellones) {
      for (const b of botellones) {
        const cliente = (b.clientes as any) ?? null;
        if (cliente && !seen.has(cliente.id)) {
          seen.add(cliente.id);
          clientesAsignados.push({
            id: cliente.id,
            nombre: cliente.nombre,
            negocio: cliente.negocio ?? null,
          });
        }
      }
    }

    return { recargasHoy: recargasHoy ?? 0, clientesAsignados };
  } catch {
    return { recargasHoy: 0, clientesAsignados: [] };
  }
}
