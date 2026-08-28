import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CargaPage from '@/app/(dashboard)/recargas/carga/page';

const useQrScannerMock = vi.hoisted(() => vi.fn());
const getBotellonByCodigoMock = vi.hoisted(() => vi.fn());
const getClienteMock = vi.hoisted(() => vi.fn());
const registrarOperacionMock = vi.hoisted(() => vi.fn());
const playBeepMock = vi.hoisted(() => vi.fn());
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
  registrarOperacion: registrarOperacionMock,
}));
vi.mock('@/lib/scanner/beep', () => ({
  playBeep: playBeepMock,
}));

const QR1 = 'https://app.example.com/b/BOT-00001';
const QR2 = 'https://app.example.com/b/BOT-00002';
const BOT1 = { id: 'b1', codigo: 'BOT-00001', cliente_id: 'c1', estado: 'entregado' };
const BOT2 = { id: 'b2', codigo: 'BOT-00002', cliente_id: 'c2', estado: 'recarga' };
const BOT_RECIBIDO = { id: 'b3', codigo: 'BOT-00003', cliente_id: 'c3', estado: 'recibido' };

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

/** Select an operation from the segmented selector (Recibir | Recargar | Listo). */
async function selectOperation(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name }));
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
  registrarOperacionMock.mockReset();
  playBeepMock.mockReset();
  setDecodeErrorMock.mockReset();
  stopMock.mockReset();
  onDecode = () => undefined;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('CargaPage - operation selector', () => {
  it('exposes Recibir, Recargar and Listo with Recargar selected by default', async () => {
    await renderPage();

    const recibir = screen.getByRole('button', { name: 'Recibir' });
    const recargar = screen.getByRole('button', { name: 'Recargar' });
    const listo = screen.getByRole('button', { name: 'Listo' });

    expect(recibir).toBeInTheDocument();
    expect(recargar).toBeInTheDocument();
    expect(listo).toBeInTheDocument();
    // Default operation is Recargar (aria-pressed).
    expect(recargar).toHaveAttribute('aria-pressed', 'true');
    expect(recibir).toHaveAttribute('aria-pressed', 'false');
    expect(listo).toHaveAttribute('aria-pressed', 'false');
  });

  it('uses operacion recargar by default without any explicit selection', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await user.click(getConfirmButton());

    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b1'],
      operacion: 'recargar',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      hora: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
  });

  it('switching the operation to recibir updates the confirm payload', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    await renderPage();

    await selectOperation(user, 'Recibir');
    await decode(QR1);
    await user.click(getConfirmButton());

    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b1'],
      operacion: 'recibir',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      hora: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
  });
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

  it('dedupes the same code even when decoded twice in rapid succession (stale closure)', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    await renderPage();

    // Fire BOTH decodes against the SAME captured onDecode closure before any
    // React re-render. A ref-backed id set must prevent double-counting.
    await act(async () => {
      const p1 = onDecode(QR1);
      const p2 = onDecode(QR1);
      await Promise.all([p1, p2]);
    });

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

describe('CargaPage - client name rendering', () => {
  it('resolves the client name via getCliente and renders it', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    getClienteMock.mockResolvedValue({ id: 'c1', nombre: 'Juan Pérez' });
    await renderPage();

    await decode(QR1);

    expect(getClienteMock).toHaveBeenCalledWith('c1');
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
  });

  it('renders different client names for distinct scans', async () => {
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
    expect(screen.getByText('María Gómez')).toBeInTheDocument();
  });

  it('falls back to the raw client id when getCliente returns no name', async () => {
    getBotellonByCodigoMock.mockResolvedValue({
      id: 'b4',
      codigo: 'BOT-00004',
      cliente_id: 'c4',
      estado: 'recibido',
    });
    getClienteMock.mockResolvedValue(null);
    await renderPage();

    await decode('https://app.example.com/b/BOT-00004');

    expect(screen.getByText('c4')).toBeInTheDocument();
  });

  it('renders a "Ver ficha" link to the client for each item in the live session list', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00001' ? BOT1 : BOT2)
    );
    getClienteMock.mockImplementation((id: string) =>
      Promise.resolve(id === 'c1' ? { id: 'c1', nombre: 'Juan Pérez' } : { id: 'c2', nombre: 'María Gómez' })
    );
    await renderPage();

    await decode(QR1);
    await decode(QR2);

    const links = screen.getAllByRole('link', { name: 'Ver ficha' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/clientes/c1');
    expect(links[1]).toHaveAttribute('href', '/clientes/c2');
  });
});

describe('CargaPage - per-item transition badges', () => {
  it('shows a valid (green) badge with the target estado for a valid source under the selected op', async () => {
    // BOT_RECIBIDO is recibido — the ONLY valid source for the default recargar op (→ recarga).
    getBotellonByCodigoMock.mockResolvedValue(BOT_RECIBIDO);
    await renderPage();

    await decode(QR1);

    const badge = screen.getByTestId('transition-badge-b3');
    expect(badge).toHaveAttribute('data-valid', 'true');
    // Green badge shows the operation target label (recargar → "En recarga").
    expect(badge).toHaveTextContent('En recarga');
  });

  it('rejects entregado under recargar with an invalid (red) badge showing the current estado', async () => {
    // BOT1 is entregado — NOT a source of recargar (the cycle must not skip recibido).
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    await renderPage();

    await decode(QR1);

    const badge = screen.getByTestId('transition-badge-b1');
    expect(badge).toHaveAttribute('data-valid', 'false');
    // Red badge shows the current estado label.
    expect(badge).toHaveTextContent('Entregado');
  });

  it('shows an invalid (red) badge with the current estado when the source is not valid', async () => {
    // BOT2 is already recarga — NOT a valid source for recargar.
    getBotellonByCodigoMock.mockResolvedValue(BOT2);
    await renderPage();

    await decode(QR2);

    const badge = screen.getByTestId('transition-badge-b2');
    expect(badge).toHaveAttribute('data-valid', 'false');
    // Red badge shows the current estado label.
    expect(badge).toHaveTextContent('En recarga');
  });

  it('re-validates badges live when the operation switches mid-session', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1); // entregado
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);

    // Under recargar, entregado is NOT a valid source (pure cycle: recibir first) → red badge.
    let badge = screen.getByTestId('transition-badge-b1');
    expect(badge).toHaveAttribute('data-valid', 'false');
    expect(badge).toHaveTextContent('Entregado');

    // Switch to recibir: entregado IS a source → green for target recibido.
    await selectOperation(user, 'Recibir');
    badge = screen.getByTestId('transition-badge-b1');
    expect(badge).toHaveAttribute('data-valid', 'true');
    expect(badge).toHaveTextContent('Recibido');

    // Switch to listo: entregado is NOT a source of listo → red badge.
    await selectOperation(user, 'Listo');
    badge = screen.getByTestId('transition-badge-b1');
    expect(badge).toHaveAttribute('data-valid', 'false');
    expect(badge).toHaveTextContent('Entregado');
  });
});

describe('CargaPage - duplicate scan beep and transient ring', () => {
  it('beeps, flashes the existing row, keeps the session unchanged, and leaves the scanner open on a duplicate', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    await renderPage();

    await decode(QR1);
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(playBeepMock).not.toHaveBeenCalled();

    // Second scan of the same code is a duplicate.
    let outcome: unknown;
    await act(async () => {
      outcome = await onDecode(QR1);
    });

    // Beep fired and the duplicate row got the transient ring flash.
    expect(playBeepMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('session-row-b1')).toHaveAttribute('data-flash', 'true');

    // Session count and payload unchanged — no duplicate entry added.
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText('BOT-00001')).toHaveLength(1);

    // The scanner stays open (failure outcome → hook resumes scanning).
    expect(outcome).toEqual({ outcome: 'failure' });
  });

  it('does not ring an unrelated row when a different botellon is scanned', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00001' ? BOT1 : BOT2)
    );
    await renderPage();

    await decode(QR1);
    await decode(QR2);

    expect(screen.getByTestId('session-row-b1')).not.toHaveAttribute('data-flash');
    expect(playBeepMock).not.toHaveBeenCalled();
  });
});

describe('CargaPage - confirm gating', () => {
  it('disables confirm when the session is empty', async () => {
    await renderPage();
    expect(getConfirmButton()).toBeDisabled();
  });

  it('enables confirm as soon as the session has at least one botellon (no fecha/hora gating)', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    await renderPage();
    await decode(QR1);

    expect(getConfirmButton()).toBeEnabled();
  });
});

describe('CargaPage - batch confirm', () => {
  it('posts the accumulated ids with the current timestamp for the selected op', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00001' ? BOT1 : BOT2)
    );
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await decode(QR2);

    await user.click(getConfirmButton());

    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b1', 'b2'],
      operacion: 'recargar',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      hora: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
  });

  it('records the exact current date/time (frozen clock) computed at submit time', async () => {
    // Freeze only `Date` (not timers) so React's scheduler and userEvent keep
    // working on real time while `new Date()` in the action stays deterministic.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-20T14:30:45'));
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await user.click(getConfirmButton());

    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b1'],
      operacion: 'recargar',
      fecha: '2026-08-20',
      hora: '14:30',
    });
  });

  it('surfaces a server validation error and keeps the session editable', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarOperacionMock.mockResolvedValue({
      success: false,
      items: [],
      error: 'Fecha y hora requeridas',
    });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await user.click(getConfirmButton());

    expect(await screen.findByText('Fecha y hora requeridas')).toBeInTheDocument();
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
  });
});

describe('CargaPage - per-item results', () => {
  it('renders REC numbers for ok items and reasons for rejected items (recargar)', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00001' ? BOT1 : BOT2)
    );
    registrarOperacionMock.mockResolvedValue({
      success: false,
      items: [
        { botellonId: 'b1', codigo: 'BOT-00001', ok: true, recargaId: 'r1', numeroRegistro: 'REC-000101' },
        { botellonId: 'b2', codigo: 'BOT-00002', ok: false, reason: 'estado-recarga' },
      ],
    });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await decode(QR2);
    await user.click(getConfirmButton());

    expect(await screen.findByText('Registrado: REC-000101')).toBeInTheDocument();
    expect(screen.getByText('Rechazado: estado-recarga')).toBeInTheDocument();
  });

  it('shows an "Asignar cliente" link for a sin-cliente rejected item', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarOperacionMock.mockResolvedValue({
      success: false,
      items: [
        { botellonId: 'b1', codigo: 'BOT-00001', ok: false, reason: 'sin-cliente' },
      ],
    });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
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

    expect(screen.queryByText('Botellón no encontrado')).not.toBeInTheDocument();
    expect(screen.getByText('BOT-00002')).toBeInTheDocument();
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(setDecodeErrorMock).toHaveBeenLastCalledWith(null);
  });
});

describe('CargaPage - success screen', () => {
  it('calls stop() when the success screen mounts so the camera stream is released', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    await renderPage();

    await decode(QR1);
    await user.click(getConfirmButton());

    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('shows REC list, premios, and loyaltyWarning for recargar with Ver ficha links', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarOperacionMock.mockResolvedValue({
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
    await user.click(getConfirmButton());

    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();
    expect(screen.getByText('REC-000101')).toBeInTheDocument();
    expect(screen.getByText('Nivel 100')).toBeInTheDocument();
    expect(screen.getByText('Error al procesar fidelidad')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver ficha' })).toHaveAttribute(
      'href',
      '/clientes/c1'
    );
  });

  it('does not show REC numbers for a non-recarga success', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    registrarOperacionMock.mockResolvedValue({
      success: true,
      items: [{ botellonId: 'b1', codigo: 'BOT-00001', ok: true }],
    });
    const user = userEvent.setup();
    await renderPage();

    await selectOperation(user, 'Recibir');
    await decode(QR1);
    await user.click(getConfirmButton());

    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();
    // A pure recibir operation has no REC number to display.
    expect(screen.queryByText(/REC-/)).not.toBeInTheDocument();
  });
});

describe('CargaPage - operation-scoped no-client handling', () => {
  const CLIENTLESS = {
    id: 'b9',
    codigo: 'BOT-00009',
    cliente_id: null,
    estado: 'entregado',
  };

  it('blocks a clientless botellon in Recargar with an Asignar cliente link', async () => {
    getBotellonByCodigoMock.mockResolvedValue(CLIENTLESS);
    await renderPage(); // default operation is recargar

    await decode('https://app.example.com/b/BOT-00009');

    expect(screen.getByText('Sin cliente asignado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Asignar cliente' })).toHaveAttribute(
      'href',
      '/botellones/b9'
    );
    // Not accumulated.
    expect(screen.queryByText(/Sesión \(1\)/)).not.toBeInTheDocument();
  });

  it('accumulates a clientless botellon in Recibir without showing the no-client overlay', async () => {
    getBotellonByCodigoMock.mockResolvedValue(CLIENTLESS);
    const user = userEvent.setup();
    await renderPage();

    await selectOperation(user, 'Recibir');
    await decode('https://app.example.com/b/BOT-00009');

    expect(screen.queryByText('Sin cliente asignado')).not.toBeInTheDocument();
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('BOT-00009')).toBeInTheDocument();
  });

  it('lets the staff dismiss the Recargar overlay and continue scanning', async () => {
    getBotellonByCodigoMock.mockResolvedValue(CLIENTLESS);
    const user = userEvent.setup();
    await renderPage();

    await decode('https://app.example.com/b/BOT-00009');
    expect(screen.getByText('Sin cliente asignado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continuar escaneando' }));
    expect(screen.queryByText('Sin cliente asignado')).not.toBeInTheDocument();
  });
});

describe('CargaPage - manual code entry (camera-less PC fallback)', () => {
  const MANUAL_LABEL = '¿Sin cámara? Ingresá el código manualmente';

  it('adds a manually typed code to the session', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText(MANUAL_LABEL), 'BOT-00001');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00001');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('BOT-00001')).toBeInTheDocument();
  });

  it('shows "Botellón no encontrado" for an unknown manual code and does not accumulate it', async () => {
    getBotellonByCodigoMock.mockResolvedValue(null);
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText(MANUAL_LABEL), 'BOT-99999');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(screen.getByText('Botellón no encontrado')).toBeInTheDocument();
    expect(screen.queryByText(/Sesión \(1\)/)).not.toBeInTheDocument();
  });

  it('does not double-row a duplicate manually entered code (beeps + flashes instead)', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    const user = userEvent.setup();
    await renderPage();

    const input = screen.getByLabelText(MANUAL_LABEL);
    await user.type(input, 'BOT-00001');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));
    await user.clear(input);
    await user.type(input, 'BOT-00001');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText('BOT-00001')).toHaveLength(1);
    expect(playBeepMock).toHaveBeenCalledTimes(1);
  });

  it('blocks a clientless manually entered bottle under Recargar with the no-client overlay', async () => {
    getBotellonByCodigoMock.mockResolvedValue({
      id: 'b9',
      codigo: 'BOT-00009',
      cliente_id: null,
      estado: 'entregado',
    });
    const user = userEvent.setup();
    await renderPage(); // default operation is recargar

    await user.type(screen.getByLabelText(MANUAL_LABEL), 'BOT-00009');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(screen.getByText('Sin cliente asignado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Asignar cliente' })).toHaveAttribute(
      'href',
      '/botellones/b9'
    );
    expect(screen.queryByText(/Sesión \(1\)/)).not.toBeInTheDocument();
  });
});
