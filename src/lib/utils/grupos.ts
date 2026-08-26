/**
 * Central de Operaciones grouping — pure, UI-agnostic. Fase 3 consumes this
 * to render the client-grouped FIFO queue. Spec REQ-COS-6.
 * Group = cliente_id; group age = min(estado_desde); groups oldest-first;
 * codes oldest-first inside a group; tiebreak codigo asc; NULL key = stock group.
 */
export type BotellonAgrupable = {
  id: string;
  codigo: string;
  estado: string;
  cliente_id: string | null;
  estado_desde: string; // ISO timestamptz
};

export type GrupoCliente = {
  cliente_id: string | null; // null = stock group (valid key, never dropped)
  estado_desde: string;      // group age = min member estado_desde (oldest)
  botellones: BotellonAgrupable[]; // sorted oldest-first; tiebreak codigo asc
};

export function agrupar(botellones: BotellonAgrupable[]): GrupoCliente[] {
  const grupos = new Map<string | null, BotellonAgrupable[]>();
  for (const b of botellones) {
    const miembros = grupos.get(b.cliente_id) ?? [];
    miembros.push(b);
    grupos.set(b.cliente_id, miembros);
  }
  return [...grupos.entries()]
    .map(([cliente_id, miembros]) => {
      const ordenados = [...miembros].sort(
        (a, b) => a.estado_desde.localeCompare(b.estado_desde) || a.codigo.localeCompare(b.codigo)
      );
      return { cliente_id, estado_desde: ordenados[0].estado_desde, botellones: ordenados };
    })
    .sort(
      (a, b) =>
        a.estado_desde.localeCompare(b.estado_desde) || cmpCliente(a.cliente_id, b.cliente_id)
    );
}

/** Group tiebreak for equal ages: cliente_id asc, stock (null) last. */
function cmpCliente(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}