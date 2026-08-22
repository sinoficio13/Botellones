import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { EstadoEnVivo } from '@/components/dashboard/estado-en-vivo';

// ── Supabase browser client mock ──
// The component subscribes through `@/lib/supabase/client` (singleton backed by
// @supabase/ssr's createBrowserClient). We mock the client module itself with
// an in-memory channel object so tests can dispatch synthetic postgres_changes
// payloads and drive channel status without any real WebSocket transport.

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: createClientMock,
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

// One shared fake client per file: the mocked createClient returns it on every
// call. Channel mocks are cleared per test to capture fresh handlers.
const fake = makeFakeSupabase();

function emit(channel: FakeChannel, payload: unknown) {
  act(() => {
    channel.payloadHandler?.(payload);
  });
}

function setStatus(channel: FakeChannel, status: string) {
  act(() => {
    channel.statusHandler?.(status);
  });
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fake.supabase.channel.mockClear();
  fake.supabase.removeChannel.mockClear();
  fake.channels.length = 0;
  createClientMock.mockReturnValue(fake.supabase);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.clearAllMocks();
});

function makePayload(estado: string, extra: Record<string, unknown> = {}) {
  return { eventType: 'UPDATE', new: { estado, ...extra }, old: {} };
}

describe('EstadoEnVivo — detail-page live updates (RT R2)', () => {
  it('subscribes to UPDATE changes on botellones filtered by id (spec R2)', () => {
    render(
      <EstadoEnVivo
        botellonId="b1"
        estado="recibido"
        clienteId={null}
        fechaEntrega={null}
      />
    );

    const channel = fake.channels[0];
    expect(fake.supabase.channel).toHaveBeenCalledWith('estado-botellon-b1');
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'botellones', filter: 'id=eq.b1' },
      expect.any(Function)
    );
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('updates the badge text and fires onLiveChange when a valid payload arrives (spec S3)', () => {
    const onLiveChange = vi.fn();
    render(
      <EstadoEnVivo
        botellonId="b1"
        estado="recibido"
        clienteId={null}
        fechaEntrega={null}
        onLiveChange={onLiveChange}
      />
    );

    expect(screen.getByText('Recibido')).toBeInTheDocument();

    emit(fake.channels[0], makePayload('recarga', { cliente_id: 'c9', fecha_entrega: '2026-08-22T10:00:00.000Z' }));

    expect(screen.getByText('En recarga')).toBeInTheDocument();
    expect(screen.queryByText('Recibido')).not.toBeInTheDocument();
    expect(onLiveChange).toHaveBeenCalledWith({
      estado: 'recarga',
      clienteId: 'c9',
      fechaEntrega: '2026-08-22T10:00:00.000Z',
    });
  });

  it('keeps the last rendered state on CHANNEL_ERROR and TIMED_OUT, only warning (spec S4)', () => {
    render(
      <EstadoEnVivo
        botellonId="b1"
        estado="recibido"
        clienteId={null}
        fechaEntrega={null}
      />
    );

    emit(fake.channels[0], makePayload('recarga'));
    expect(screen.getByText('En recarga')).toBeInTheDocument();

    setStatus(fake.channels[0], 'CHANNEL_ERROR');
    setStatus(fake.channels[0], 'TIMED_OUT');

    expect(screen.getByText('En recarga')).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('drops a payload whose estado is not in the canonical set (future estados never crash)', () => {
    const onLiveChange = vi.fn();
    render(
      <EstadoEnVivo
        botellonId="b1"
        estado="recibido"
        clienteId={null}
        fechaEntrega={null}
        onLiveChange={onLiveChange}
      />
    );

    emit(fake.channels[0], makePayload('estado-futuro'));

    expect(screen.getByText('Recibido')).toBeInTheDocument();
    expect(onLiveChange).not.toHaveBeenCalled();
  });

  it('calls removeChannel on unmount (spec S5)', () => {
    const { unmount } = render(
      <EstadoEnVivo
        botellonId="b1"
        estado="recibido"
        clienteId={null}
        fechaEntrega={null}
      />
    );

    const channel = fake.channels[0];
    unmount();

    expect(fake.supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});