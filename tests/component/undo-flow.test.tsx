import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  useColaOperaciones,
  ESTADOS_OPERATIVOS,
} from '@/hooks/useColaOperaciones';
import { GrupoCard, DESTINO_ACCION } from '@/components/operaciones/grupo-card';
import { ToastHost, dismissToast } from '@/components/operaciones/toast';
import type { ColaBotellon } from '@/lib/db/botellones';

const { rpcMock, getColaOperacionesMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  getColaOperacionesMock: vi.fn(),
}));

vi.mock('@/lib/db/botellones', () => ({ getColaOperaciones: getColaOperacionesMock }));
// The hook subscribes to realtime on mount (useRealtimeCola, REQ-COS-27), so
// the browser client mock needs the fake-channel surface next to `rpc`.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: rpcMock,
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn() })),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  }),
}));

/** Fixture row aged 30h (critica -> age "1d" per the cola.ts design matrix). */
function hace(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

function botellon(i: number, over: Partial<ColaBotellon> = {}): ColaBotellon {
  return {
    id: `b-${i}`,
    codigo: `BOT-00${i}`,
    estado: 'recibido',
    cliente_id: 'cliente-a',
    estado_desde: hace(30),
    clientes: { nombre: 'María González', cedula: '12345678', telefono_1: null, whatsapp: null },
    ...over,
  } as ColaBotellon;
}

/** Raw botellones row as the RPC returns it (SETOF botellones, no clientes join). */
function filaRpc(id: string, estado: string, estadoDesde: string) {
  return {
    id,
    codigo: `BOT-${id}`,
    estado,
    estado_desde: estadoDesde,
    cliente_id: 'cliente-a',
    created_at: null,
    fecha_creacion: null,
    fecha_entrega: null,
  };
}

/** Card -> hook -> ToastHost harness (R6: composes Slice A/B + this slice). */
function Harness() {
  const { porEstado, mover } = useColaOperaciones();
  return (
    <div>
      <ToastHost />
      {ESTADOS_OPERATIVOS.map((estado) =>
        porEstado[estado].map((grupo) => (
          <GrupoCard
            key={grupo.cliente_id}
            grupo={grupo}
            estado={estado}
            onAccion={(ids) => mover(ids, DESTINO_ACCION[estado])}
          />
        ))
      )}
    </div>
  );
}

async function montar(filas: ColaBotellon[], boton: string) {
  getColaOperacionesMock.mockResolvedValue(filas);
  render(<Harness />);
  await waitFor(() => expect(screen.getByRole('button', { name: boton })).toBeInTheDocument());
}

describe('Undo flow — REQ-COS-19 (Slice C)', () => {
  afterEach(() => {
    dismissToast();
    vi.clearAllMocks();
  });

  it('applies the move optimistically, then reconciles with the RPC rows (S1)', async () => {
    let resolver!: (v: { data: unknown; error: null }) => void;
    rpcMock.mockReturnValue(new Promise((r) => (resolver = r)));
    const filas = [botellon(1), botellon(2), botellon(3)];
    await montar(filas, '→ Pasar 3 a En recarga');

    fireEvent.click(screen.getByRole('button', { name: '→ Pasar 3 a En recarga' }));

    // Optimistic: the group leaves the list before the RPC resolves; the
    // success toast with Deshacer is already up; the RPC fired (2-arg move).
    expect(screen.queryByTestId('grupo-card')).not.toBeInTheDocument();
    expect(screen.getByText('3 botellones a En recarga')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('mover_botellones', {
      p_ids: ['b-1', 'b-2', 'b-3'],
      p_estado: 'recarga',
    });

    await act(async () => {
      resolver({
        data: filas.map((b) => filaRpc(b.id, 'recarga', new Date().toISOString())),
        error: null,
      });
    });

    // D10: the group lands in the destino estado (age = fresh now() stamp).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '→ Pasar 3 a Listo' })).toBeInTheDocument()
    );
  });

  it('undo restores estado AND the original estado_desde via p_restaurar (S2)', async () => {
    const filas = [botellon(1), botellon(2), botellon(3)];
    // The RPC returns the ORIGINAL timestamps — restored server-side from its
    // own pre-move snapshot (R1-001); the client never sends them.
    const original: Record<string, string> = {
      'b-1': filas[0].estado_desde,
      'b-2': filas[1].estado_desde,
      'b-3': filas[2].estado_desde,
    };
    rpcMock.mockResolvedValueOnce({
      data: filas.map((b) => filaRpc(b.id, 'recarga', new Date().toISOString())),
      error: null,
    });
    await montar(filas, '→ Pasar 3 a En recarga');

    fireEvent.click(screen.getByRole('button', { name: '→ Pasar 3 a En recarga' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '→ Pasar 3 a Listo' })).toBeInTheDocument()
    );

    rpcMock.mockResolvedValueOnce({
      data: filas.map((b) => filaRpc(b.id, 'recibido', original[b.id])),
      error: null,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '→ Pasar 3 a En recarga' })).toBeInTheDocument()
    );
    expect(rpcMock).toHaveBeenLastCalledWith('mover_botellones', {
      p_ids: ['b-1', 'b-2', 'b-3'],
      p_estado: 'recibido',
      p_restaurar: true,
    });

    // Original age restored (30h -> "1d"), NOT the fresh now() stamp. The age
    // renders after mount (R1-001: the clock is client-only, so a remounted
    // card first renders the server-safe placeholder then the real age).
    await waitFor(() => expect(screen.getByText('1d')).toBeInTheDocument());
  });

  it('reverts the optimistic removal and shows a red toast without undo on RPC error (S3)', async () => {
    const filas = [botellon(1), botellon(2), botellon(3)];
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Transición no permitida' } });
    await montar(filas, '→ Pasar 3 a En recarga');

    fireEvent.click(screen.getByRole('button', { name: '→ Pasar 3 a En recarga' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '→ Pasar 3 a En recarga' })).toBeInTheDocument()
    );
    expect(screen.getByText('No se pudo mover. Reintentá.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument();
  });

  it('disables the action with "Elegí al menos un botellón" when zero chips are marked (S4)', async () => {
    const filas = [botellon(1), botellon(2)];
    await montar(filas, '→ Pasar 2 a En recarga');

    fireEvent.click(screen.getByRole('button', { name: 'BOT-001' }));
    fireEvent.click(screen.getByRole('button', { name: 'BOT-002' }));

    expect(screen.getByRole('button', { name: 'Elegí al menos un botellón' })).toBeDisabled();
  });

  it('Entregar calls the RPC directly with entregado — no client selector (S5)', async () => {
    const filas = [botellon(1, { estado: 'delivery' })];
    rpcMock.mockResolvedValue({ data: [], error: null });
    await montar(filas, '✓ Entregar 1 a María');

    fireEvent.click(screen.getByRole('button', { name: '✓ Entregar 1 a María' }));

    expect(rpcMock).toHaveBeenCalledWith('mover_botellones', {
      p_ids: ['b-1'],
      p_estado: 'entregado',
    });
    // Machine-only confirm: no dialog/selector is ever rendered.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});