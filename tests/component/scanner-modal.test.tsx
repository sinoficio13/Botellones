import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScannerModal } from '@/components/scanner/scanner-modal';

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
// Minimal stub — the client search just needs to render in this suite.
vi.mock('@/components/operaciones/buscador-cliente-carga', () => ({
  BuscadorClienteCarga: () => (
    <section aria-label="Buscar por cliente">
      <span>o buscá por cliente:</span>
    </section>
  ),
}));

const QR1 = 'https://app.example.com/b/BOT-00001';
const QR7 = 'https://app.example.com/b/BOT-00007';
// Each bottle's CURRENT estado drives its pre-filled destination.
const BOT_ENTREGADO = { id: 'b1', codigo: 'BOT-00001', cliente_id: 'c1', estado: 'entregado' };
const BOT_RECIBIDO = { id: 'b7', codigo: 'BOT-00007', cliente_id: 'c7', estado: 'recibido' };

const MANUAL_LABEL = '¿Sin cámara? Ingresá el código manualmente';

let onDecode: (raw: string) => Promise<unknown> | void;
let cameraErrorValue: 'permission-denied' | 'camera-unavailable' | null = null;

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
  cameraErrorValue = null;
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
      cameraError: cameraErrorValue,
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

describe('ScannerModal — shell and close', () => {
  it('renders the fixed dialog with the camera, empty session and disabled confirm', () => {
    const { container } = render(<ScannerModal onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Escanear código QR' })).toBeInTheDocument();
    expect(container.querySelector('video')).toBeInTheDocument();
    expect(screen.getByText('Aún no se agregaron botellones.')).toBeInTheDocument();
    expect(confirmButton(0)).toBeDisabled();
  });

  it('closes from the header X button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ScannerModal onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the backdrop click', async () => {
    const onClose = vi.fn();
    render(<ScannerModal onClose={onClose} />);

    const backdrop = screen.getByRole('dialog');
    await act(async () => {
      backdrop.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<ScannerModal onClose={onClose} />);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ScannerModal — camera decode', () => {
  it('adds a valid scan to the session with its pre-filled destino and keeps scanning', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    getClienteMock.mockResolvedValue({ id: 'c1', nombre: 'Juan Pérez' });
    render(<ScannerModal onClose={vi.fn()} />);

    await decode(QR1);

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00001');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('BOT-00001')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    // entregado → recibir: static arrow text, no chooser.
    expect(screen.getByText(/Entregado → Recibido/)).toBeInTheDocument();
    expect(confirmButton(1)).toBeEnabled();
  });

  it('shows the invalid-code overlay for a foreign QR and keeps scanning', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    render(<ScannerModal onClose={vi.fn()} />);

    await decode('https://example.com/not-a-botellon');
    expect(screen.getByText('Código no válido')).toBeInTheDocument();
    expect(setDecodeErrorMock).toHaveBeenLastCalledWith('invalid-code');

    // A valid scan clears the overlay and accumulates into the session.
    await decode(QR1);
    expect(screen.queryByText('Código no válido')).not.toBeInTheDocument();
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(setDecodeErrorMock).toHaveBeenLastCalledWith(null);
  });

  it('shows the not-found overlay when no botellón matches the code', async () => {
    getBotellonByCodigoMock.mockResolvedValueOnce(null);
    getBotellonByCodigoMock.mockResolvedValueOnce(BOT_ENTREGADO);
    render(<ScannerModal onClose={vi.fn()} />);

    await decode(QR1);
    expect(screen.getByText('Botellón no encontrado')).toBeInTheDocument();
    expect(setDecodeErrorMock).toHaveBeenLastCalledWith('not-found');

    await decode(QR1);
    expect(screen.queryByText('Botellón no encontrado')).not.toBeInTheDocument();
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
  });

  it('beeps and flashes the existing row on a duplicate scan instead of double-adding', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    render(<ScannerModal onClose={vi.fn()} />);

    await decode(QR1);
    await decode(QR1);

    expect(playBeepMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('session-row-b1')).toHaveAttribute('data-flash', 'true');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText('BOT-00001')).toHaveLength(1);
  });
});

describe('ScannerModal — manual entry (camera-less fallback)', () => {
  it('shows the manual fallback with the camera-error copy when the camera fails', () => {
    cameraErrorValue = 'permission-denied';
    render(<ScannerModal onClose={vi.fn()} />);

    expect(screen.getByText('Permiso de cámara denegado')).toBeInTheDocument();
    expect(screen.getByLabelText(MANUAL_LABEL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar a la sesión' })).toBeInTheDocument();
  });

  it('adds a manually typed code to the session with its pre-filled destino', async () => {
    cameraErrorValue = 'camera-unavailable';
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const user = userEvent.setup();
    render(<ScannerModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(MANUAL_LABEL), '00001');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00001');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Entregado → Recibido/)).toBeInTheDocument();
    expect(confirmButton(1)).toBeEnabled();
  });

  it('strips non-digits and tolerates pasted full codes like BOT-00045', async () => {
    cameraErrorValue = 'camera-unavailable';
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const user = userEvent.setup();
    render(<ScannerModal onClose={vi.fn()} />);

    // Simulate a paste of the full code: the input must normalize it to digits.
    fireEvent.change(screen.getByLabelText(MANUAL_LABEL), { target: { value: 'BOT-00045' } });
    expect((screen.getByLabelText(MANUAL_LABEL) as HTMLInputElement).value).toBe('00045');

    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00045');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
  });

  it('shows "Botellón no encontrado" for an unknown code and does not accumulate it', async () => {
    cameraErrorValue = 'camera-unavailable';
    getBotellonByCodigoMock.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<ScannerModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(MANUAL_LABEL), '99999');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-99999');
    expect(screen.getByText('Botellón no encontrado')).toBeInTheDocument();
    expect(screen.getByText('Aún no se agregaron botellones.')).toBeInTheDocument();
  });

  it('beeps on a duplicate manual entry instead of double-adding', async () => {
    cameraErrorValue = 'camera-unavailable';
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const user = userEvent.setup();
    render(<ScannerModal onClose={vi.fn()} />);

    async function agregar(digits: string) {
      await user.type(screen.getByLabelText(MANUAL_LABEL), digits);
      await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));
    }

    await agregar('00001');
    await agregar('00001');

    expect(playBeepMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText('BOT-00001')).toHaveLength(1);
    expect(screen.getByTestId('session-row-b1')).toHaveAttribute('data-flash', 'true');
  });
});

describe('ScannerModal — confirm and result', () => {
  it('posts one registrarOperacion per destino group for a mixed batch and renders the result', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00001' ? BOT_ENTREGADO : BOT_RECIBIDO)
    );
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    render(<ScannerModal onClose={vi.fn()} />);

    // entregado → recibir, recibido → recargar (mixed batch).
    await decode(QR1);
    await decode(QR7);

    await user.click(confirmButton(2));
    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();

    expect(registrarOperacionMock).toHaveBeenCalledTimes(2);
    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b1'],
      operacion: 'recibir',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      hora: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
    });
    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b7'],
      operacion: 'recargar',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      hora: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
    });
  });

  it('Listo calls onClose and releases the camera on success', async () => {
    const onClose = vi.fn();
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    registrarOperacionMock.mockResolvedValue({
      success: true,
      items: [{ botellonId: 'b1', codigo: 'BOT-00001', ok: true }],
    });
    const user = userEvent.setup();
    render(<ScannerModal onClose={onClose} />);

    await decode(QR1);
    await user.click(confirmButton(1));

    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();
    expect(stopMock).toHaveBeenCalledTimes(1); // camera released on success

    await user.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Seguir editando returns to the live session after a failed attempt', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_RECIBIDO);
    registrarOperacionMock.mockResolvedValue({
      success: false,
      items: [{ botellonId: 'b7', codigo: 'BOT-00007', ok: false, reason: 'error' }],
      error: 'update exploded',
    });
    const user = userEvent.setup();
    render(<ScannerModal onClose={vi.fn()} />);

    await decode(QR7);
    await user.click(confirmButton(1));

    expect(await screen.findByText('update exploded')).toBeInTheDocument();
    // Failed attempt keeps the camera alive and the session editable.
    expect(stopMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('BOT-00007')).toBeInTheDocument();
  });
});

describe('ScannerModal — client search', () => {
  it('renders the client search as an alternative to camera/manual entry', () => {
    render(<ScannerModal onClose={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Buscar por cliente' })).toBeInTheDocument();
    expect(screen.getByText('o buscá por cliente:')).toBeInTheDocument();
  });
});
