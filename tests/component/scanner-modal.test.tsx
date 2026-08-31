import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState, type ReactNode } from 'react';
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
// next/link renders a plain anchor in jsdom so the modal's "Asignar/Crear
// cliente" links can be clicked without pulling in the app router.
vi.mock('next/link', () => ({
  default: ({
    href,
    onClick,
    children,
    ...rest
  }: {
    href: string;
    onClick?: () => void;
    children: ReactNode;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

const QR1 = 'https://app.example.com/b/BOT-00001';
const QR7 = 'https://app.example.com/b/BOT-00007';
const QR9 = 'https://app.example.com/b/BOT-00009';
// Each bottle's CURRENT estado drives its pre-filled destination.
const BOT_ENTREGADO = { id: 'b1', codigo: 'BOT-00001', cliente_id: 'c1', estado: 'entregado' };
const BOT_RECIBIDO = { id: 'b7', codigo: 'BOT-00007', cliente_id: 'c7', estado: 'recibido' };
const BOT_LISTO = { id: 'b9', codigo: 'BOT-00009', cliente_id: 'c9', estado: 'listo' };
// Clientless 'recibido' bottle → pre-filled destino 'recargar' (requiresCliente),
// so its row shows the "Sin cliente asignado" warning with the assign links.
const BOT_CLIENTELESS_RECIBIDO = { id: 'b3', codigo: 'BOT-00003', cliente_id: null, estado: 'recibido' };
const QR3 = 'https://app.example.com/b/BOT-00003';

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

  // R4-001 — closing a session with unconfirmed bottles must ask first.
  it('does not close from the backdrop while a session is unconfirmed and the discard is cancelled', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const onClose = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ScannerModal onClose={onClose} />);

    await decode(QR1);
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();

    const backdrop = screen.getByRole('dialog');
    await act(async () => {
      backdrop.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(
      'La sesión tiene 1 botellón sin confirmar. ¿Cerrar y descartarlos?'
    );
    expect(onClose).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('does not close on Escape while a session is unconfirmed and the discard is cancelled', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const onClose = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ScannerModal onClose={onClose} />);

    await decode(QR1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('closes from the X only after the operator accepts the discard of an unconfirmed session', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const onClose = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ScannerModal onClose={onClose} />);

    await decode(QR1);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('closes WITHOUT a discard prompt when the session is empty', async () => {
    const onClose = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<ScannerModal onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  // R4-001 — closing while confirmar() is in flight would discard a batch
  // mid-commit: backdrop, Escape and the X must all be ignored (no prompt, no
  // onClose).
  it('does not close (backdrop/Escape/X) while confirmar() is pending', async () => {
    const onClose = vi.fn();
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    registrarOperacionMock.mockReturnValue(new Promise(() => {})); // never settles
    const confirmSpy = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<ScannerModal onClose={onClose} />);

    await decode(QR1);
    await user.click(confirmButton(1));
    expect(screen.getByRole('button', { name: 'Confirmando…' })).toBeInTheDocument();

    // Backdrop.
    const backdrop = screen.getByRole('dialog');
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();

    // Escape.
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();

    // Header X.
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
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

  it('offers the listo destination chooser (En delivery / Entregar) defaulting to Entregar', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_LISTO);
    getClienteMock.mockResolvedValue({ id: 'c9', nombre: 'Ana López' });
    render(<ScannerModal onClose={vi.fn()} />);

    await decode(QR9);

    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    const enDelivery = screen.getByRole('button', { name: 'En delivery' });
    const entregar = screen.getByRole('button', { name: 'Entregar' });
    expect(enDelivery).toBeInTheDocument();
    expect(entregar).toBeInTheDocument();
    // prefillDestino('listo') → 'entregar': the chooser defaults to Entregar.
    expect(entregar).toHaveAttribute('aria-pressed', 'true');
    expect(enDelivery).toHaveAttribute('aria-pressed', 'false');
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

  // R4-001 — closing on a full-success result view discards nothing, so the
  // discard guard (unconfirmed items) must NOT prompt.
  it('closes WITHOUT a discard prompt on the full-success result view', async () => {
    const onClose = vi.fn();
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    registrarOperacionMock.mockResolvedValue({
      success: true,
      items: [{ botellonId: 'b1', codigo: 'BOT-00001', ok: true }],
    });
    const confirmSpy = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<ScannerModal onClose={onClose} />);

    await decode(QR1);
    await user.click(confirmButton(1));
    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  // R3-002 — a bottle scanned while confirmar() is in flight would be missing
  // from the snapshot and silently discarded by limpiar(); the entry gate must
  // block it.
  it('does not accumulate a scan while confirmar() is in flight', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00007' ? BOT_RECIBIDO : BOT_ENTREGADO)
    );
    registrarOperacionMock.mockReturnValue(new Promise(() => {})); // never settles
    const user = userEvent.setup();
    render(<ScannerModal onClose={vi.fn()} />);

    await decode(QR1);
    await user.click(confirmButton(1));
    expect(screen.getByRole('button', { name: 'Confirmando…' })).toBeInTheDocument();

    await decode(QR7); // scanned while confirmar() is pending

    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.queryByText('BOT-00007')).not.toBeInTheDocument();
    expect(screen.getAllByText('BOT-00001')).toHaveLength(1);
  });

  // R4-003 — the camera <video> must NEVER be unmounted across the result
  // toggle: useQrScanner attaches the stream to videoRef once on mount, so a
  // recreated element would be black. It stays in the DOM (hidden) instead.
  it('keeps the <video> mounted across a partial-failure result and Seguir editando', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_RECIBIDO);
    registrarOperacionMock.mockResolvedValue({
      success: false,
      items: [{ botellonId: 'b7', codigo: 'BOT-00007', ok: false, reason: 'error' }],
      error: 'update exploded',
    });
    const user = userEvent.setup();
    const { container } = render(<ScannerModal onClose={vi.fn()} />);

    const videoInicial = container.querySelector('video');
    expect(videoInicial).toBeInTheDocument();

    await decode(QR7);
    await user.click(confirmButton(1));
    expect(await screen.findByText('update exploded')).toBeInTheDocument();

    // Result view: the SAME video element stays in the DOM (hidden by CSS).
    expect(container.querySelector('video')).toBe(videoInicial);

    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    // Back to the session: still the same element, no remount (no black camera).
    expect(container.querySelector('video')).toBe(videoInicial);
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
  });

  // R4-003 — while the result view is visible the camera keeps decoding (only a
  // full success stops it), but the handler must short-circuit BEFORE resolving
  // the botellón so nothing accumulates behind the result.
  it('ignores a decode while the result view is visible', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00007' ? BOT_RECIBIDO : BOT_ENTREGADO)
    );
    registrarOperacionMock.mockResolvedValue({
      success: false,
      items: [{ botellonId: 'b1', codigo: 'BOT-00001', ok: false, reason: 'error' }],
      error: 'update exploded',
    });
    const user = userEvent.setup();
    render(<ScannerModal onClose={vi.fn()} />);

    await decode(QR1);
    await user.click(confirmButton(1));
    expect(await screen.findByText('update exploded')).toBeInTheDocument();

    await decode(QR7);
    expect(getBotellonByCodigoMock).not.toHaveBeenCalledWith('BOT-00007');
  });

  // R1-003/R3-001 — on a partial-failure result the discard prompt must count
  // only the bottles NOT yet successfully registered, not the whole session.
  it('discard prompt counts only unconfirmed bottles on a partial-failure result', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00007' ? BOT_RECIBIDO : BOT_ENTREGADO)
    );
    registrarOperacionMock
      .mockResolvedValueOnce({
        success: true,
        items: [{ botellonId: 'b1', codigo: 'BOT-00001', ok: true }],
      })
      .mockResolvedValueOnce({
        success: false,
        items: [{ botellonId: 'b7', codigo: 'BOT-00007', ok: false, reason: 'sin-cliente' }],
      });
    const onClose = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<ScannerModal onClose={onClose} />);

    await decode(QR1);
    await decode(QR7);
    await user.click(confirmButton(2));
    expect(await screen.findByText('Rechazado: sin-cliente')).toBeInTheDocument();

    const backdrop = screen.getByRole('dialog');
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(
      'La sesión tiene 1 botellón sin confirmar. ¿Cerrar y descartarlos?'
    );
    expect(onClose).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  // R2-001/R4-002 — an entry while confirmar() is in flight is blocked with a
  // transient aviso and must NOT beep (the old behavior beeped like a duplicate).
  it('shows the transient aviso and does NOT beep when a scan arrives while confirmar() is in flight', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00007' ? BOT_RECIBIDO : BOT_ENTREGADO)
    );
    registrarOperacionMock.mockReturnValue(new Promise(() => {})); // never settles
    const user = userEvent.setup();
    render(<ScannerModal onClose={vi.fn()} />);

    await decode(QR1);
    await user.click(confirmButton(1));
    expect(screen.getByRole('button', { name: 'Confirmando…' })).toBeInTheDocument();

    await decode(QR7); // blocked entry while confirming

    expect(screen.getByText('Confirmando… esperá un momento')).toBeInTheDocument();
    expect(playBeepMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.queryByText('BOT-00007')).not.toBeInTheDocument();
  });
});

describe('ScannerModal — client search', () => {
  it('renders the client search as an alternative to camera/manual entry', () => {
    render(<ScannerModal onClose={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Buscar por cliente' })).toBeInTheDocument();
    expect(screen.getByText('o buscá por cliente:')).toBeInTheDocument();
  });
});

describe('ScannerModal — "Asignar/Crear cliente" links close the modal', () => {
  it('closes on click of the links of a clientless actionable session row', async () => {
    const onClose = vi.fn();
    getBotellonByCodigoMock.mockResolvedValue(BOT_CLIENTELESS_RECIBIDO);
    render(<ScannerModal onClose={onClose} />);

    await decode(QR3);
    expect(screen.getByText('Sin cliente asignado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Asignar cliente' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('link', { name: 'Crear cliente' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes on click of the links of a sin-cliente rejected result row', async () => {
    const onClose = vi.fn();
    getBotellonByCodigoMock.mockResolvedValue(BOT_CLIENTELESS_RECIBIDO);
    registrarOperacionMock.mockResolvedValue({
      success: false,
      items: [{ botellonId: 'b3', codigo: 'BOT-00003', ok: false, reason: 'sin-cliente' }],
    });
    const user = userEvent.setup();
    render(<ScannerModal onClose={onClose} />);

    await decode(QR3);
    await user.click(confirmButton(1));
    expect(await screen.findByText('Rechazado: sin-cliente')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Asignar cliente' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
