import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScannerModal } from '@/components/scanner/scanner-modal';

const jsQrMock = vi.hoisted(() => vi.fn());
const getUserMediaMock = vi.hoisted(() => vi.fn());
const getBotellonByCodigoMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
// Stable router identity — the modal effect depends on it; a fresh object
// per render would re-run the effect (and restart the camera) every render.
const routerMock = vi.hoisted(() => ({ push: pushMock }));

vi.mock('jsqr', () => ({ default: jsQrMock }));
vi.mock('@/lib/db/botellones', () => ({
  getBotellonByCodigo: getBotellonByCodigoMock,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

const VALID_QR = 'https://app.example.com/b/BOT-00001';

type FakeTrack = { stop: ReturnType<typeof vi.fn> };
type FakeStream = { getTracks: () => FakeTrack[] };

function makeStream(): { stream: FakeStream; track: FakeTrack } {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] }, track };
}

/**
 * Advance past one throttled decode and flush the async chain.
 * Fake rAF ticks every 16ms; the 66ms throttle means the first decode lands
 * at ~80ms, and each subsequent 100ms advance produces exactly one decode.
 */
async function decodeFrame(ms = 100) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
  });

  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: getUserMediaMock },
    configurable: true,
  });

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    }),
  } as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error -- mediaDevices is not part of the jsdom Navigator type
  delete navigator.mediaDevices;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

/** Render, grant the camera, and mark the video element as having a frame. */
async function renderWithCamera(ui = <ScannerModal onClose={vi.fn()} />) {
  const utils = render(ui);
  await act(async () => {
    await Promise.resolve();
  });

  const video = utils.container.querySelector('video');
  if (video) {
    Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
  }
  return utils;
}

describe('ScannerModal — camera lifecycle', () => {
  it('requests a rear-facing stream on open', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);

    await renderWithCamera();

    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
      audio: false,
    });
  });

  it('shows permission-denied instructions when access is blocked', async () => {
    getUserMediaMock.mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError')
    );

    await renderWithCamera();

    expect(screen.getByText('Permiso de cámara denegado')).toBeInTheDocument();
    // Closable in the error state: header X + panel button.
    expect(
      screen.getAllByRole('button', { name: 'Cerrar' })
    ).toHaveLength(2);
  });

  it('shows camera-unavailable when no camera exists', async () => {
    getUserMediaMock.mockRejectedValue(
      new DOMException('No device', 'NotFoundError')
    );

    await renderWithCamera();

    expect(screen.getByText('Cámara no disponible')).toBeInTheDocument();
  });

  it('shows camera-unavailable when getUserMedia is unsupported', async () => {
    // @ts-expect-error -- simulating missing mediaDevices
    delete navigator.mediaDevices;

    await renderWithCamera();

    expect(screen.getByText('Cámara no disponible')).toBeInTheDocument();
  });

  it('stops all tracks and cancels the loop on unmount', async () => {
    const { stream, track } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);

    const { unmount } = await renderWithCamera();
    expect(track.stop).not.toHaveBeenCalled();

    unmount();

    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('is StrictMode-safe: first mount stream is stopped, no duplicate stream', async () => {
    const first = makeStream();
    const second = makeStream();
    getUserMediaMock
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream);

    const { unmount } = render(
      <StrictMode>
        <ScannerModal onClose={vi.fn()} />
      </StrictMode>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(getUserMediaMock).toHaveBeenCalledTimes(2);
    expect(first.track.stop).toHaveBeenCalledTimes(1);
    expect(second.track.stop).not.toHaveBeenCalled();

    // Unmount stops the surviving stream too.
    unmount();
    expect(second.track.stop).toHaveBeenCalledTimes(1);
  });
});

describe('ScannerModal — decode and resolution', () => {
  it('shows invalid-code error for a foreign QR and keeps scanning', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: 'https://example.com/not-a-botellon' });

    await renderWithCamera();
    await decodeFrame();

    expect(screen.getByText('Código no válido')).toBeInTheDocument();

    // Loop keeps running: a second frame still decodes.
    jsQrMock.mockReturnValue({ data: VALID_QR });
    getBotellonByCodigoMock.mockResolvedValue({
      id: 'b1',
      codigo: 'BOT-00001',
      estado: 'entregado',
      cliente_id: 'c1',
      total_recargas: 1,
      ultima_recarga: null,
    });
    await decodeFrame();

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00001');
    expect(pushMock).toHaveBeenCalledWith('/recargas/nueva?botellon_id=b1');
  });

  it('shows not-found error when no botellón matches the code', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });
    getBotellonByCodigoMock.mockResolvedValue(null);

    await renderWithCamera();
    await decodeFrame();

    expect(screen.getByText('Botellón no encontrado')).toBeInTheDocument();
  });

  it('shows sin-cliente error when the botellón has no client', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });
    getBotellonByCodigoMock.mockResolvedValue({
      id: 'b3',
      codigo: 'BOT-00003',
      estado: 'recibido',
      cliente_id: null,
      total_recargas: 0,
      ultima_recarga: null,
    });

    await renderWithCamera();
    await decodeFrame();

    expect(screen.getByText('Sin cliente asignado')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('redirects to the recarga confirm step on a valid botellón', async () => {
    const { stream, track } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });
    getBotellonByCodigoMock.mockResolvedValue({
      id: 'b1',
      codigo: 'BOT-00001',
      estado: 'entregado',
      cliente_id: 'c1',
      total_recargas: 1,
      ultima_recarga: null,
    });
    const onClose = vi.fn();

    await renderWithCamera(<ScannerModal onClose={onClose} />);
    await decodeFrame();

    expect(pushMock).toHaveBeenCalledWith('/recargas/nueva?botellon_id=b1');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('ignores re-decodes of the same code within the 1s lockout', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });
    // Not found → the loop resumes and the same QR stays in view.
    getBotellonByCodigoMock.mockResolvedValue(null);

    await renderWithCamera();
    await decodeFrame();
    expect(getBotellonByCodigoMock).toHaveBeenCalledTimes(1);

    // Same QR in view within the lockout window → ignored.
    await decodeFrame();
    expect(getBotellonByCodigoMock).toHaveBeenCalledTimes(1);

    // Once the window passes, decodes resolve again.
    await decodeFrame(1000 + 70);
    expect(getBotellonByCodigoMock).toHaveBeenCalledTimes(2);
  });
});

describe('ScannerModal — close behavior', () => {
  it('calls onClose from the header close button in the decode-error state', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: 'garbage' });

    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await renderWithCamera(<ScannerModal onClose={onClose} />);
    await decodeFrame();

    expect(screen.getByText('Código no válido')).toBeInTheDocument();
    // Decode errors overlay the video; the header X is the close affordance.
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the backdrop click', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);

    const onClose = vi.fn();
    await renderWithCamera(<ScannerModal onClose={onClose} />);

    const backdrop = screen.getByRole('dialog');
    await act(async () => {
      backdrop.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});