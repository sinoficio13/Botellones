import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useColaOperaciones, ESTADOS_OPERATIVOS } from '@/hooks/useColaOperaciones';
import { ESTADOS_KANBAN } from '@/lib/utils/estados';
import type { ColaBotellon } from '@/lib/db/botellones';

const { getColaOperacionesMock } = vi.hoisted(() => ({ getColaOperacionesMock: vi.fn() }));
vi.mock('@/lib/db/botellones', () => ({ getColaOperaciones: getColaOperacionesMock }));

/** REQ-COS-16 fixture row. ColaBotellon forces cliente_id non-null; stock rows pass null via cast. */
function botellon(o: Partial<Omit<ColaBotellon, 'cliente_id'>> & { cliente_id?: string | null }): ColaBotellon {
  return {
    id: 'b-1', codigo: 'BOT-001', estado: 'recibido', cliente_id: 'cliente-a',
    estado_desde: '2026-08-20T09:00:00.000Z',
    clientes: { nombre: 'María', cedula: '12345678', telefono_1: null, whatsapp: null },
    ...o,
  } as ColaBotellon;
}

async function cargar(filas: ColaBotellon[]) {
  getColaOperacionesMock.mockResolvedValue(filas);
  const { result } = renderHook(() => useColaOperaciones());
  await waitFor(() => expect(result.current.cargando).toBe(false));
  return result;
}

describe('useColaOperaciones — REQ-COS-16/17 (Slice A frame)', () => {
  it('ESTADOS_OPERATIVOS derives from ESTADOS_KANBAN minus entregado (approval, R2-001)', () => {
    expect(ESTADOS_OPERATIVOS).toEqual(ESTADOS_KANBAN.filter((e) => e !== 'entregado'));
    expect(ESTADOS_OPERATIVOS).toEqual(['recibido', 'recarga', 'listo', 'delivery']);
  });
  it('excludes NULL cliente_id rows before grouping (REQ-16 S1)', async () => {
    const result = await cargar([
      botellon({ id: 'a1', cliente_id: 'cliente-a' }),
      botellon({ id: 's1', cliente_id: null, codigo: 'BOT-STOCK' }),
    ]);
    expect(result.current.porEstado.recibido).toHaveLength(1);
    expect(result.current.porEstado.recibido[0].botellones.map((b) => b.id)).toEqual(['a1']);
    expect(result.current.porEstado.recarga).toEqual([]);
  });

  it('partitions per estado; FIFO groups and members; client split across tabs (D12)', async () => {
    const result = await cargar([
      botellon({ id: 'r1b', codigo: 'BOT-002', estado: 'recibido', cliente_id: 'cliente-a', estado_desde: '2026-08-21T09:00:00.000Z' }),
      botellon({ id: 'r1a', codigo: 'BOT-001', estado: 'recibido', cliente_id: 'cliente-a', estado_desde: '2026-08-20T09:00:00.000Z' }),
      botellon({ id: 'r2', codigo: 'BOT-003', estado: 'recibido', cliente_id: 'cliente-b', estado_desde: '2026-08-21T09:00:00.000Z' }),
      botellon({ id: 'c1', codigo: 'BOT-004', estado: 'recarga', cliente_id: 'cliente-a', estado_desde: '2026-08-22T09:00:00.000Z' }),
    ]);
    const { recibido, recarga, listo, delivery } = result.current.porEstado;
    expect(recibido.map((g) => g.cliente_id)).toEqual(['cliente-a', 'cliente-b']);
    expect(recibido[0].botellones.map((b) => b.id)).toEqual(['r1a', 'r1b']);
    expect(recarga.map((g) => g.cliente_id)).toEqual(['cliente-a']);
    expect(listo).toEqual([]);
    expect(delivery).toEqual([]);
  });

  it('totals: distinct clientes and total botellones (REQ-17 S2)', async () => {
    const result = await cargar([
      botellon({ id: 'a1', cliente_id: 'cliente-a', estado: 'recibido' }),
      botellon({ id: 'a2', cliente_id: 'cliente-a', estado: 'recarga' }),
      botellon({ id: 'b1', cliente_id: 'cliente-b', estado: 'listo' }),
      botellon({ id: 's1', cliente_id: null }),
    ]);
    expect(result.current.totales).toEqual({ clientes: 2, botellones: 3 });
  });

  it('cargando=true while fetching, false after resolution (REQ-21 skeleton)', async () => {
    let resolve!: (filas: ColaBotellon[]) => void;
    getColaOperacionesMock.mockReturnValue(new Promise<ColaBotellon[]>((r) => { resolve = r; }));
    const { result } = renderHook(() => useColaOperaciones());
    expect(result.current.cargando).toBe(true);
    await act(async () => { resolve([]); });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.porEstado.recibido).toEqual([]);
  });
});