import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
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
// Each bottle's CURRENT estado drives its pre-filled destination.
const BOT_ENTREGADO = { id: 'b1', codigo: 'BOT-00001', cliente_id: 'c1', estado: 'entregado' };
const BOT_RECARGA = { id: 'b2', codigo: 'BOT-00002', cliente_id: 'c2', estado: 'recarga' };
const BOT_LISTO = { id: 'b3', codigo: 'BOT-00003', cliente_id: 'c3', estado: 'listo' };

const MANUAL_LABEL = '¿Sin cámara? Ingresá el código manualmente';

let onDecode: (raw: string) => Promise<unknown> | void;

/** Simulate a QR decode flowing through the captured onDecode handler. */
async function decode(raw: string) {
  await act(async () => {
    await onDecode(raw);
  });
}

function confirmButton(count: number) {
  return screen.getByRole('button', { name: new RegExp(`Confirmar \\(${count} botellones\\)`) });
}

beforeEach(() => {
  useQrScannerMock.mockReset();
  useQrScannerMock.mockImplementation((opts: {
    onDecode: (raw: string) => Promise<unknown> | void;
  }) => {
    onDecode = opts.onDecode;
    // Stateful mock: setDecodeError drives decodeError and triggers a
    // re-render, faithfully simulating the real hook so the overlay reflects
    // error/clear transitions.
    const [decodeError, setDecodeErrorState] = useState<string | null>(null);
    const setDecodeError = (err: string | null) => {
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
  getClienteMock.mockResolvedValue(null);
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

describe('CargaPage — session accumulation', () => {
  it('shows the empty state and a disabled confirm on a fresh session', () => {
    render(<CargaPage />);
    expect(screen.getByText('Aún no se agregaron botellones.')).toBeInTheDocument();
    expect(confirmButton(0)).toBeDisabled();
  });

  it('a scan appends the bottle with its pre-filled destino', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    render(<CargaPage />);

    await decode(QR1);

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00001');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('BOT-00001')).toBeInTheDocument();
    // entregado → recibir: static arrow text, no chooser.
    expect(screen.getByText(/Entregado → Recibido/)).toBeInTheDocument();
    expect(confirmButton(1)).toBeEnabled();
  });

  it('a bottle already in listo is not actionable in this flow', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_LISTO);
    render(<CargaPage />);

    await decode('https://app.example.com/b/BOT-00003');

    expect(screen.getByText('Gestionar en el dashboard')).toBeInTheDocument();
    expect(confirmButton(0)).toBeDisabled();
  });

  it('beeps and flashes the existing row on a duplicate scan instead of double-adding', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    render(<CargaPage />);

    await decode(QR1);
    await decode(QR1);

    expect(playBeepMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('session-row-b1')).toHaveAttribute('data-flash', 'true');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText('BOT-00001')).toHaveLength(1);
  });

  it('removes a row with the ✕ button', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const user = userEvent.setup();
    render(<CargaPage />);

    await decode(QR1);
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar BOT-00001' }));
    expect(screen.getByText('Aún no se agregaron botellones.')).toBeInTheDocument();
    expect(confirmButton(0)).toBeDisabled();
  });
});

describe('CargaPage — recarga row destination chooser', () => {
  it('defaults a recarga bottle to Listo and switches to En delivery', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_RECARGA);
    const user = userEvent.setup();
    render(<CargaPage />);

    await decode(QR2);

    const listo = screen.getByRole('button', { name: 'Listo' });
    const delivery = screen.getByRole('button', { name: 'En delivery' });
    expect(listo).toHaveAttribute('aria-pressed', 'true');
    expect(delivery).toHaveAttribute('aria-pressed', 'false');

    await user.click(delivery);
    expect(listo).toHaveAttribute('aria-pressed', 'false');
    expect(delivery).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('CargaPage — manual code entry (camera-less PC fallback)', () => {
  it('adds a manually typed code to the session with its pre-filled destino', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const user = userEvent.setup();
    render(<CargaPage />);

    await user.type(screen.getByLabelText(MANUAL_LABEL), '00001');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00001');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Entregado → Recibido/)).toBeInTheDocument();
    expect(confirmButton(1)).toBeEnabled();
  });

  it('strips non-digits and normalizes pasted full codes to BOT-<digits>', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const user = userEvent.setup();
    render(<CargaPage />);

    // Simulate a paste of the full code: the input must normalize it to digits.
    fireEvent.change(screen.getByLabelText(MANUAL_LABEL), { target: { value: 'BOT-00045' } });
    expect((screen.getByLabelText(MANUAL_LABEL) as HTMLInputElement).value).toBe('00045');

    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00045');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
  });

  it('shows "Botellón no encontrado" for an unknown manual code and does not accumulate it', async () => {
    getBotellonByCodigoMock.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<CargaPage />);

    await user.type(screen.getByLabelText(MANUAL_LABEL), '99999');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-99999');
    expect(screen.getByText('Botellón no encontrado')).toBeInTheDocument();
    expect(screen.queryByText(/Sesión \(1\)/)).not.toBeInTheDocument();
  });
});

describe('CargaPage — confirm (per-destino groups)', () => {
  it('posts one registrarOperacion per destino group for a mixed batch', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(
        codigo === 'BOT-00001' ? BOT_ENTREGADO : codigo === 'BOT-00002' ? BOT_RECARGA : BOT_LISTO
      )
    );
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    render(<CargaPage />);

    // entregado → recibir, recarga → listo, listo → not actionable.
    await decode(QR1);
    await decode(QR2);
    await decode('https://app.example.com/b/BOT-00003');

    await user.click(confirmButton(2));
    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();

    expect(registrarOperacionMock).toHaveBeenCalledTimes(2);
    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b1'],
      operacion: 'recibir',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      hora: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b2'],
      operacion: 'listo',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      hora: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
  });

  it('sends a delivery group when the recarga row is switched to En delivery', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_RECARGA);
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    render(<CargaPage />);

    await decode(QR2);
    await user.click(screen.getByRole('button', { name: 'En delivery' }));

    await user.click(confirmButton(1));
    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();

    expect(registrarOperacionMock).toHaveBeenCalledTimes(1);
    expect(registrarOperacionMock).toHaveBeenCalledWith(
      expect.objectContaining({ botellonIds: ['b2'], operacion: 'delivery' })
    );
  });

  it('records the exact current date/time computed at submit time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-20T14:30:45'));
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    render(<CargaPage />);

    await decode(QR1);
    await user.click(confirmButton(1));
    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();

    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b1'],
      operacion: 'recibir',
      fecha: '2026-08-20',
      hora: '14:30',
    });
  });
});

describe('CargaPage — clientless recargar handling', () => {
  const CLIENTLESS_RECIBIDO = {
    id: 'b9',
    codigo: 'BOT-00009',
    cliente_id: null,
    estado: 'recibido',
  };

  it('shows the inline warning with an Asignar cliente link on a clientless recargar row', async () => {
    getBotellonByCodigoMock.mockResolvedValue(CLIENTLESS_RECIBIDO);
    render(<CargaPage />);

    await decode('https://app.example.com/b/BOT-00009');

    expect(screen.getByText(/Recibido → En recarga/)).toBeInTheDocument();
    expect(screen.getByText('Sin cliente asignado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Asignar cliente' })).toHaveAttribute(
      'href',
      '/botellones/b9'
    );
  });

  it('is rejected by the server and surfaces the per-row reason on confirm', async () => {
    getBotellonByCodigoMock.mockResolvedValue(CLIENTLESS_RECIBIDO);
    registrarOperacionMock.mockResolvedValue({
      success: true,
      items: [{ botellonId: 'b9', codigo: 'BOT-00009', ok: false, reason: 'sin-cliente' }],
    });
    const user = userEvent.setup();
    render(<CargaPage />);

    await decode('https://app.example.com/b/BOT-00009');
    await user.click(confirmButton(1));

    expect(await screen.findByText('Rechazado: sin-cliente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Asignar cliente' })).toHaveAttribute(
      'href',
      '/botellones/b9'
    );
  });
});

describe('CargaPage — result view', () => {
  it('shows REC numbers and premios for a recargar group success', async () => {
    getBotellonByCodigoMock.mockResolvedValue({
      id: 'b7',
      codigo: 'BOT-00007',
      cliente_id: 'c7',
      estado: 'recibido',
    });
    registrarOperacionMock.mockResolvedValue({
      success: true,
      items: [
        {
          botellonId: 'b7',
          codigo: 'BOT-00007',
          ok: true,
          recargaId: 'r7',
          numeroRegistro: 'REC-000101',
        },
      ],
      premios: [{ nivel: 100, id: 'p1' }],
    });
    const user = userEvent.setup();
    render(<CargaPage />);

    await decode('https://app.example.com/b/BOT-00007');
    await user.click(confirmButton(1));

    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();
    expect(screen.getByText('Registrado: REC-000101')).toBeInTheDocument();
    expect(screen.getByText('Nivel 100')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver ficha' })).toHaveAttribute('href', '/clientes/c7');
  });

  it('shows the server error and keeps the session editable via Seguir editando', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_RECARGA);
    registrarOperacionMock.mockResolvedValue({
      success: false,
      items: [{ botellonId: 'b2', codigo: 'BOT-00002', ok: false, reason: 'error' }],
      error: 'Fecha y hora requeridas',
    });
    const user = userEvent.setup();
    render(<CargaPage />);

    await decode(QR2);
    await user.click(confirmButton(1));

    expect(await screen.findByText('Fecha y hora requeridas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('BOT-00002')).toBeInTheDocument();
  });

  it('Listo resets the session for another batch and releases the camera', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    registrarOperacionMock.mockResolvedValue({
      success: true,
      items: [{ botellonId: 'b1', codigo: 'BOT-00001', ok: true }],
    });
    const user = userEvent.setup();
    render(<CargaPage />);

    await decode(QR1);
    await user.click(confirmButton(1));

    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();
    expect(stopMock).toHaveBeenCalledTimes(1); // camera released on success
    const rendersAntesDeListo = useQrScannerMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Listo' }));

    // Fresh batch: empty session, disabled confirm, scanner mounted again.
    expect(screen.getByText('Aún no se agregaron botellones.')).toBeInTheDocument();
    expect(confirmButton(0)).toBeDisabled();
    expect(useQrScannerMock.mock.calls.length).toBeGreaterThan(rendersAntesDeListo);
  });
});

describe('CargaPage — decode error overlays', () => {
  it('shows the not-found overlay for an unknown scan and clears it on a valid scan', async () => {
    getBotellonByCodigoMock.mockResolvedValueOnce(null);
    getBotellonByCodigoMock.mockResolvedValueOnce(BOT_ENTREGADO);
    render(<CargaPage />);

    await decode(QR1);
    expect(screen.getByText('Botellón no encontrado')).toBeInTheDocument();
    expect(setDecodeErrorMock).toHaveBeenLastCalledWith('not-found');

    await decode(QR1);
    expect(screen.queryByText('Botellón no encontrado')).not.toBeInTheDocument();
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(setDecodeErrorMock).toHaveBeenLastCalledWith(null);
  });
});