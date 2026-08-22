import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperacionesDashboard } from '@/components/dashboard/operaciones-dashboard';
import type { BotellonOperativo } from '@/lib/db/botellones';

// ── Mocks ──
// Fake browser supabase client (mock the client module itself, same pattern as
// estado-en-vivo.test.tsx) so the kanban subscriber can be driven with
// synthetic postgres_changes payloads. Server actions and the router are
// stubbed: realtime reconciliation must not depend on them.

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));
const { getClientesForSelectMock } = vi.hoisted(() => ({
  getClientesForSelectMock: vi.fn(),
}));
const { moverBotellonMock } = vi.hoisted(() => ({
  moverBotellonMock: vi.fn(),
}));
const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: createClientMock,
}));
vi.mock('@/lib/db/botellones', () => ({
  getClientesForSelect: getClientesForSelectMock,
  moverBotellon: moverBotellonMock,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

type FakeChannel = {
  name: string;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  payloadHandler: ((payload: unknown) => void) | null;
  statusHandler: ((status: string) => void) | null;
};

function makeFakeSupabase() {
  const channels: FakeChannel[] = [];
  const supabase = {
    channel: vi.fn((name: string) => {
      const ch: FakeChannel = {
        name,
        on: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        payloadHandler: null,
        statusHandler: null,
      };
      ch.on.mockImplementation(
        (_event: string, _config: unknown, cb: (payload: unknown) => void) => {
          ch.payloadHandler = cb;
          return ch;
        }
      );
      ch.subscribe.mockImplementation((cb?: (status: string) => void) => {
        ch.statusHandler = cb ?? null;
        return ch;
      });
      channels.push(ch);
      return ch;
    }),
    removeChannel: vi.fn(),
  };
  return { supabase, channels };
}

const fake = makeFakeSupabase();

function emit(channel: FakeChannel, payload: unknown) {
  act(() => {
    channel.payloadHandler?.(payload);
  });
}

function makePayload(estado: string, extra: Record<string, unknown> = {}) {
  return {
    eventType: 'UPDATE',
    new: { id: 'b1', estado, cliente_id: null, fecha_entrega: null, ...extra },
    old: {},
  };
}

/** The kanban column root for a given header label (header span → column div). */
function kanbanColumn(label: string): HTMLElement {
  const header = screen
    .getAllByText(label)
    .find((el) => el.tagName !== 'OPTION');
  if (!header) throw new Error(`Kanban column header "${label}" not found`);
  return header.closest('div')!.parentElement as HTMLElement;
}

const B1_RECIBIDO: BotellonOperativo = {
  id: 'b1',
  codigo: 'B-001',
  estado: 'recibido',
  cliente_id: null,
  fecha_entrega: null,
  clientes: null,
};

const B1_ENTREGADO: BotellonOperativo = {
  id: 'b1',
  codigo: 'B-001',
  estado: 'entregado',
  cliente_id: 'c1',
  fecha_entrega: '2026-08-01T00:00:00.000Z',
  clientes: { nombre: 'Ana' },
};

beforeEach(() => {
  fake.supabase.channel.mockClear();
  fake.supabase.removeChannel.mockClear();
  fake.channels.length = 0;
  createClientMock.mockReturnValue(fake.supabase);
  getClientesForSelectMock.mockReset();
  moverBotellonMock.mockReset();
  refreshMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('OperacionesDashboard — kanban realtime (RT R3)', () => {
  it('subscribes to UPDATE changes on botellones with no filter (spec R3/S6)', () => {
    render(<OperacionesDashboard botellones={[B1_RECIBIDO]} recargasHoy={0} />);

    const channel = fake.channels[0];
    expect(fake.supabase.channel).toHaveBeenCalledWith('kanban-botellones');
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'botellones' },
      expect.any(Function)
    );
  });

  it('moves the matching card column when another operator updates the estado (spec S6)', () => {
    render(<OperacionesDashboard botellones={[B1_RECIBIDO]} recargasHoy={0} />);

    expect(screen.getByRole('combobox')).toHaveValue('recibido');
    expect(within(kanbanColumn('Recibido')).getByText('B-001')).toBeInTheDocument();

    emit(fake.channels[0], makePayload('listo'));

    expect(screen.getByRole('combobox')).toHaveValue('listo');
    expect(within(kanbanColumn('Listo')).getByText('B-001')).toBeInTheDocument();
    expect(within(kanbanColumn('Recibido')).queryByText('B-001')).not.toBeInTheDocument();
    // Patch-always: a realtime patch must not trigger the refresh fallback.
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('is idempotent: the echo of the operator own optimistic write leaves the UI unchanged (spec S7)', async () => {
    const user = userEvent.setup();
    moverBotellonMock.mockResolvedValue({ success: true, id: 'b1' });
    render(<OperacionesDashboard botellones={[B1_RECIBIDO]} recargasHoy={0} />);

    // Operator moves the card locally (optimistic) and the server confirms.
    await user.selectOptions(screen.getByRole('combobox'), 'listo');
    expect(screen.getByRole('combobox')).toHaveValue('listo');
    expect(moverBotellonMock).toHaveBeenCalledWith('b1', 'listo');

    // The realtime echo of that same write arrives (twice — belt and braces).
    emit(fake.channels[0], makePayload('listo'));
    emit(fake.channels[0], makePayload('listo'));

    expect(screen.getByRole('combobox')).toHaveValue('listo');
    expect(moverBotellonMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('keeps the client join when cliente_id is unchanged (no-clobber patch, design D5)', () => {
    render(<OperacionesDashboard botellones={[B1_ENTREGADO]} recargasHoy={0} />);
    expect(screen.getByText(/Ana/)).toBeInTheDocument();

    // Echo carrying an updated fecha_entrega but the SAME cliente_id must not
    // wipe the locally-known client name with the generic fallback.
    emit(
      fake.channels[0],
      makePayload('entregado', { cliente_id: 'c1', fecha_entrega: '2026-08-02T00:00:00.000Z' })
    );

    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.queryByText(/Cliente asignado/)).not.toBeInTheDocument();
  });

  it('falls back to "Cliente asignado" when another operator assigns without a name (design R3)', () => {
    render(<OperacionesDashboard botellones={[B1_RECIBIDO]} recargasHoy={0} />);
    expect(screen.getByRole('combobox')).toHaveValue('recibido');

    // Remote sale: the card leaves the kanban and enters circulation, but the
    // realtime payload has no clientes join — only the id.
    emit(
      fake.channels[0],
      makePayload('entregado', { cliente_id: 'c2', fecha_entrega: '2026-08-22T09:00:00.000Z' })
    );

    expect(screen.getByText(/Cliente asignado/)).toBeInTheDocument();
    expect(screen.queryByText(/Sin cliente/)).not.toBeInTheDocument();
    // Card left the kanban entirely (no combobox left).
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('calls removeChannel on unmount (spec R3)', () => {
    const { unmount } = render(
      <OperacionesDashboard botellones={[B1_RECIBIDO]} recargasHoy={0} />
    );

    const channel = fake.channels[0];
    unmount();

    expect(fake.supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});