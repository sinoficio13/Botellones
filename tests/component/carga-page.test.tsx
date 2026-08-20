import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CargaPage from '@/app/(dashboard)/recargas/carga/page';

const useQrScannerMock = vi.hoisted(() => vi.fn());
const getBotellonByCodigoMock = vi.hoisted(() => vi.fn());
const getClienteMock = vi.hoisted(() => vi.fn());
const registrarCargaMock = vi.hoisted(() => vi.fn());
const setDecodeErrorMock = vi.hoisted(() => vi.fn());
const stopMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/scanner/use-qr-scanner', () => ({
  useQrScanner: useQrScannerMock,
}));
vi.mock('@/lib/db/botellones', () => ({
  getBotellonByCodigo: getBotellonByCodigoMock,
}));
vi.mock('@/lib/db/clientes', () => ({
  getCliente: getClienteMock,
}));
vi.mock('@/lib/db/cargas', () => ({
  registrarCarga: registrarCargaMock,
}));

const QR1 = 'https://app.example.com/b/BOT-00001';
const QR2 = 'https://app.example.com/b/BOT-00002';
const BOT1 = { id: 'b1', codigo: 'BOT-00001', cliente_id: 'c1', estado: 'entregado' };
const BOT2 = { id: 'b2', codigo: 'BOT-00002', cliente_id: 'c2', estado: 'recarga' };

let onDecode: (raw: string) => Promise<unknown> | void;
let currentDecodeError: string | null = null;

/** Simulate a QR decode flowing through the captured onDecode handler. */
async function decode(raw: string) {
  await act(async () => {
    await onDecode(raw);
  });
}

async function renderPage() {
  const utils = render(<CargaPage />);
  return utils;
}

function getConfirmButton() {
  return screen.getByRole('button', { name: 'Confirmar carga' });
}

beforeEach(() => {
  useQrScannerMock.mockReset();
  currentDecodeError = null;
  useQrScannerMock.mockImplementation((opts: {
    onDecode: (raw: string) => Promise<unknown> | void;
  }) => {
    onDecode = opts.onDecode;
    // Stateful mock: setDecodeError drives decodeError and triggers a
    // re-render, faithfully simulating the real hook so the overlay reflects
    // error/clear transitions.
    const [decodeError, setDecodeErrorState] = useState<string | null>(null);
    const setDecodeError = (err: string | null) => {
      currentDecodeError = err;
      setDecodeErrorMock(err);
      setDecodeErrorState(err);
    };
    return {
      videoRef: { current: null },
      cameraError: null,
      decodeError,
      setDecodeError,
      stop: stopMock,
    };
  });
  getBotellonByCodigoMock.mockReset();
  getClienteMock.mockReset();
  registrarCargaMock.mockReset();
  setDecodeErrorMock.mockReset();
  stopMock.mockReset();
  onDecode = () => undefined;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('CargaPage - session accumulation', () => {
  it('first scan appends a botellon to the session list', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    await renderPage();

    expect(screen.getByText('Aún no se escanearon botellones.')).toBeInTheDocument();

    await decode(QR1);

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00001');
    expect(screen.getByText('BOT-00001')).toBeInTheDocument();
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
  });

  it('ignores a duplicate scan of an already-accumulated code', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    await renderPage();

    await decode(QR1);
    await decode(QR1);

    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText('BOT-00001')).toHaveLength(1);
  });

  it('accumulates multiple distinct codes', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00001' ? BOT1 : BOT2)
    );
    await renderPage();

    await decode(QR1);
    await decode(QR2);

    expect(screen.getByText(/Sesión \(2\)/)).toBeInTheDocument();
    expect(screen.getByText('BOT-00001')).toBeInTheDocument();
    expect(screen.getByText('BOT-00002')).toBeInTheDocument();
  });
});

describe('CargaPage - client name and status badge rendering', () => {
  it('resolves the client name via getCliente and renders it with a status badge', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    getClienteMock.mockResolvedValue({ id: 'c1', nombre: 'Juan Pérez' });
    await renderPage();

    await decode(QR1);

    // The authenticated page resolves the owner name itself (the public-safe
    // botellon lookup no longer carries it) and shows it in the session list.
    expect(getClienteMock).toHaveBeenCalledWith('c1');
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    // Status badge uses the canonical label for `entregado`.
    expect(screen.getByText('Entregado')).toBeInTheDocument();
  });

  it('renders different client names and statuses for distinct scans', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00001' ? BOT1 : BOT2)
    );
    getClienteMock.mockImplementation((id: string) =>
      Promise.resolve(id === 'c1' ? { id: 'c1', nombre: 'Juan Pérez' } : { id: 'c2', nombre: 'María Gómez' })
    );
    await renderPage();

    await decode(QR1);
    await decode(QR2);

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Entregado')).toBeInTheDocument();
    expect(screen.getByText('María Gómez')).toBeInTheDocument();
    expect(screen.getByText('En recarga')).toBeInTheDocument();
  });

  it('falls back to the raw client id when getCliente returns no name', async () => {
    getBotellonByCodigoMock.mockResolvedValue({
      id: 'b4',
      codigo: 'BOT-00004',
      cliente_id: 'c4',
      estado: 'planta',
    });
    getClienteMock.mockResolvedValue(null);
    await renderPage();

    await decode('https://app.example.com/b/BOT-00004');

    // Name area degrades to the raw client id (no empty/crash).
    expect(screen.getByText('c4')).toBeInTheDocument();
    expect(screen.getByText('En planta')).toBeInTheDocument();
  });

  it('shows the raw estado value for an unknown estado without erroring', async () => {
    getBotellonByCodigoMock.mockResolvedValue({
      id: 'b5',
      codigo: 'BOT-00005',
      cliente_id: 'c5',
      estado: 'estado-futuro',
    });
    getClienteMock.mockResolvedValue({ id: 'c5', nombre: 'Ana' });
    await renderPage();

    await decode('https://app.example.com/b/BOT-00005');

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('estado-futuro')).toBeInTheDocument();
  });

  it('enriches the item inside onDecode, not via a useEffect body', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    getClienteMock.mockResolvedValue({ id: 'c1', nombre: 'Juan Pérez' });
    await renderPage();

    await decode(QR1);

    // The decoded client/status come from the handler-driven lookup and render
    // from the accumulated session item — not from an effect-driven state.
    expect(getBotellonByCodigoMock).toHaveBeenCalledTimes(1);
    expect(getClienteMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Entregado')).toBeInTheDocument();
  });
});

describe('CargaPage - confirm gating', () => {
  it('disables confirm when the session is empty', async () => {
    await renderPage();
    expect(getConfirmButton()).toBeDisabled();
  });

  it('disables confirm when fecha or hora is missing', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    const user = userEvent.setup();
    await renderPage();
    await decode(QR1);

    // Only fecha set, no hora -> still disabled.
    await user.type(screen.getByLabelText('Fecha'), '2026-08-20');
    expect(getConfirmButton()).toBeDisabled();

    await user.type(screen.getByLabelText('Hora'), '14:30');
    expect(getConfirmButton()).toBeEnabled();
  });
});

describe('CargaPage - batch confirm', () => {
  it('posts the accumulated ids with the shared fecha/hora', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00001' ? BOT1 : BOT2)
    );
    registrarCargaMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await decode(QR2);

    await user.type(screen.getByLabelText('Fecha'), '2026-08-20');
    await user.type(screen.getByLabelText('Hora'), '14:30');
    await user.click(getConfirmButton());

    expect(registrarCargaMock).toHaveBeenCalledWith({
      botellonIds: ['b1', 'b2'],
      fecha: '2026-08-20',
      hora: '14:30',
    });
  });

  it('surfaces a server validation error and keeps the session editable', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarCargaMock.mockResolvedValue({
      success: false,
      items: [],
      error: 'Fecha y hora requeridas',
    });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await user.type(screen.getByLabelText('Fecha'), '2026-08-20');
    await user.type(screen.getByLabelText('Hora'), '14:30');
    await user.click(getConfirmButton());

    expect(await screen.findByText('Fecha y hora requeridas')).toBeInTheDocument();
    // Session still rendered (editable) and the item is still listed.
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
  });
});

describe('CargaPage - per-item results', () => {
  it('renders REC numbers for ok items and reasons for rejected items', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00001' ? BOT1 : BOT2)
    );
    registrarCargaMock.mockResolvedValue({
      success: false,
      items: [
        { botellonId: 'b1', codigo: 'BOT-00001', ok: true, recargaId: 'r1', numeroRegistro: 'REC-000101' },
        { botellonId: 'b2', codigo: 'BOT-00002', ok: false, reason: 'estado-planta' },
      ],
    });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await decode(QR2);
    await user.type(screen.getByLabelText('Fecha'), '2026-08-20');
    await user.type(screen.getByLabelText('Hora'), '14:30');
    await user.click(getConfirmButton());

    expect(await screen.findByText('Registrado: REC-000101')).toBeInTheDocument();
    expect(screen.getByText('Rechazado: estado-planta')).toBeInTheDocument();
  });

  it('shows an "Asignar cliente" link for a sin-cliente rejected item', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarCargaMock.mockResolvedValue({
      success: false,
      items: [
        { botellonId: 'b1', codigo: 'BOT-00001', ok: false, reason: 'sin-cliente' },
      ],
    });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await user.type(screen.getByLabelText('Fecha'), '2026-08-20');
    await user.type(screen.getByLabelText('Hora'), '14:30');
    await user.click(getConfirmButton());

    const assign = await screen.findByRole('link', { name: 'Asignar cliente' });
    expect(assign).toHaveAttribute('href', '/botellones/b1');
  });
});

describe('CargaPage - error overlay lifecycle', () => {
  it('clears a stale not-found error and shows the item when a valid scan follows', async () => {
    getBotellonByCodigoMock.mockResolvedValueOnce(null);
    getBotellonByCodigoMock.mockResolvedValueOnce(BOT2);
    await renderPage();

    await decode(QR1);
    expect(screen.getByText('Botellón no encontrado')).toBeInTheDocument();
    expect(setDecodeErrorMock).toHaveBeenLastCalledWith('not-found');

    await decode(QR2);

    // Overlay cleared: the error no longer shows and the valid item is added.
    expect(screen.queryByText('Botellón no encontrado')).not.toBeInTheDocument();
    expect(screen.getByText('BOT-00002')).toBeInTheDocument();
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(setDecodeErrorMock).toHaveBeenLastCalledWith(null);
  });
});

describe('CargaPage - success screen', () => {
  it('calls stop() when the success screen mounts so the camera stream is released', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarCargaMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await user.type(screen.getByLabelText('Fecha'), '2026-08-20');
    await user.type(screen.getByLabelText('Hora'), '14:30');
    await user.click(getConfirmButton());

    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('shows count, REC list, premios, and loyaltyWarning with Ver ficha links', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarCargaMock.mockResolvedValue({
      success: true,
      items: [
        { botellonId: 'b1', codigo: 'BOT-00001', ok: true, recargaId: 'r1', numeroRegistro: 'REC-000101' },
      ],
      premios: [{ nivel: 100, id: 'p1' }],
      loyaltyWarning: 'Error al procesar fidelidad',
    });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await user.type(screen.getByLabelText('Fecha'), '2026-08-20');
    await user.type(screen.getByLabelText('Hora'), '14:30');
    await user.click(getConfirmButton());

    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();
    expect(screen.getByText(/1 botellones recargados/)).toBeInTheDocument();
    expect(screen.getByText('REC-000101')).toBeInTheDocument();
    expect(screen.getByText('Nivel 100')).toBeInTheDocument();
    expect(screen.getByText('Error al procesar fidelidad')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver ficha' })).toHaveAttribute(
      'href',
      '/clientes/c1'
    );
  });
});

describe('CargaPage - no-client overlay', () => {
  it('shows the no-client overlay with an Asignar cliente link to the botellon', async () => {
    getBotellonByCodigoMock.mockResolvedValue({
      id: 'b9',
      codigo: 'BOT-00009',
      cliente_id: null,
    });
    await renderPage();

    await decode('https://app.example.com/b/BOT-00009');

    expect(screen.getByText('Sin cliente asignado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Asignar cliente' })).toHaveAttribute(
      'href',
      '/botellones/b9'
    );
  });

  it('lets the staff dismiss the overlay and continue scanning', async () => {
    getBotellonByCodigoMock.mockResolvedValue({
      id: 'b9',
      codigo: 'BOT-00009',
      cliente_id: null,
    });
    const user = userEvent.setup();
    await renderPage();

    await decode('https://app.example.com/b/BOT-00009');
    expect(screen.getByText('Sin cliente asignado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continuar escaneando' }));
    expect(screen.queryByText('Sin cliente asignado')).not.toBeInTheDocument();
  });
});
