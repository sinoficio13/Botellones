import { StrictMode, useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  useQrScanner,
  type UseQrScanner,
} from '@/lib/scanner/use-qr-scanner';

const jsQrMock = vi.hoisted(() => vi.fn());
const getUserMediaMock = vi.hoisted(() => vi.fn());
const onDecodeMock = vi.hoisted(() => vi.fn());
const onInvalidCodeMock = vi.hoisted(() => vi.fn());

vi.mock('jsqr', () => ({ default: jsQrMock }));

const VALID_QR = 'https://app.example.com/b/BOT-00001';
const INVALID_QR = 'https://example.com/not-a-botellon';

type FakeTrack = { stop: ReturnType<typeof vi.fn> };
type FakeStream = { getTracks: () => FakeTrack[] };

function makeStream(): { stream: FakeStream; track: FakeTrack } {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] }, track };
}

/** Captures the latest hook API so tests can assert state and call stop(). */
const apiRef: { current: UseQrScanner | null } = { current: null };

function VideoSink({
  videoRef,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  return <video ref={videoRef} data-testid="video" />;
}

function Harness() {
  const api = useQrScanner({
    onDecode: onDecodeMock,
    onInvalidCode: onInvalidCodeMock,
  });
  useEffect(() => {
    apiRef.current = api;
  });
  return <VideoSink videoRef={api.videoRef} />;
}

/** Render the harness, flush the async camera acquisition, and mark the video as having a frame. */
async function renderWithCamera(ui = <Harness />) {
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

  onDecodeMock.mockReset();
  onDecodeMock.mockReturnValue(undefined);
  onInvalidCodeMock.mockReset();
  apiRef.current = null;
});

afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error -- mediaDevices is not part of the jsdom Navigator type
  delete navigator.mediaDevices;
  vi.restoreAllMocks();
  vi.clearAllMocks();
  apiRef.current = null;
});

describe('useQrScanner — camera acquisition', () => {
  it('acquires a rear-facing stream and passes decoded frames to onDecode', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });

    await renderWithCamera();
    await decodeFrame();

    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
      audio: false,
    });
    expect(onDecodeMock).toHaveBeenCalledWith(VALID_QR);
  });

  it('sets cameraError to permission-denied when access is blocked', async () => {
    getUserMediaMock.mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError')
    );

    await renderWithCamera();

    expect(apiRef.current?.cameraError).toBe('permission-denied');
    expect(onDecodeMock).not.toHaveBeenCalled();
  });

  it('sets cameraError to camera-unavailable on a non-permission rejection', async () => {
    getUserMediaMock.mockRejectedValue(
      new DOMException('No device', 'NotFoundError')
    );

    await renderWithCamera();

    expect(apiRef.current?.cameraError).toBe('camera-unavailable');
  });

  it('sets cameraError to camera-unavailable without throwing when mediaDevices is missing', async () => {
    // @ts-expect-error -- simulating missing mediaDevices
    delete navigator.mediaDevices;

    await renderWithCamera();

    expect(apiRef.current?.cameraError).toBe('camera-unavailable');
    expect(getUserMediaMock).not.toHaveBeenCalled();
  });
});

describe('useQrScanner — decode lockout and resolution', () => {
  it('surfaces invalid-code and keeps scanning without locking out', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: INVALID_QR });

    await renderWithCamera();
    await decodeFrame();

    expect(apiRef.current?.decodeError).toBe('invalid-code');
    expect(onInvalidCodeMock).toHaveBeenCalledTimes(1);
    expect(onDecodeMock).not.toHaveBeenCalled();

    // Loop keeps running: a second invalid frame still surfaces.
    await decodeFrame();
    expect(onInvalidCodeMock).toHaveBeenCalledTimes(2);
  });

  it('ignores re-decodes of the same code within the 1s lockout', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });
    onDecodeMock.mockResolvedValue({ outcome: 'failure' });

    await renderWithCamera();
    await decodeFrame();
    expect(onDecodeMock).toHaveBeenCalledTimes(1);

    // Same QR in view within the lockout window -> suppressed.
    await decodeFrame();
    expect(onDecodeMock).toHaveBeenCalledTimes(1);

    // Once the window passes, decodes resolve again.
    await decodeFrame(1000 + 70);
    expect(onDecodeMock).toHaveBeenCalledTimes(2);
  });

  it('pauses the loop during async resolution and resumes on failure', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });

    let resolveDecode!: (outcome: { outcome: 'failure' }) => void;
    onDecodeMock.mockReturnValue(
      new Promise((resolve) => {
        resolveDecode = resolve;
      })
    );

    await renderWithCamera();
    await decodeFrame();
    expect(onDecodeMock).toHaveBeenCalledTimes(1);

    // Loop is paused while onDecode is pending: no new decode fires.
    await decodeFrame(500);
    expect(onDecodeMock).toHaveBeenCalledTimes(1);

    // Resolving to failure resumes the loop so scanning continues. Advance
    // past the 1s lockout (set on the first decode) before the next fire.
    await act(async () => {
      resolveDecode({ outcome: 'failure' });
      await Promise.resolve();
    });
    await decodeFrame(1000 + 100);
    expect(onDecodeMock).toHaveBeenCalledTimes(2);
  });

  it('stops scanning when onDecode resolves to ok', async () => {
    const { stream, track } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });
    onDecodeMock.mockResolvedValue({ outcome: 'ok' });

    await renderWithCamera();
    await decodeFrame();

    expect(onDecodeMock).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalledTimes(1);

    // No further decodes after the ok outcome.
    await decodeFrame();
    expect(onDecodeMock).toHaveBeenCalledTimes(1);
  });

  it('exposes setDecodeError so the caller surfaces not-found and scanning continues', async () => {
    const { stream } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });
    onDecodeMock.mockResolvedValue({ outcome: 'failure' });

    await renderWithCamera();
    await decodeFrame();

    act(() => {
      apiRef.current?.setDecodeError('not-found');
    });
    expect(apiRef.current?.decodeError).toBe('not-found');

    // Scanning continues after a failure outcome (advance past the 1s lockout).
    await decodeFrame(1000 + 70);
    expect(onDecodeMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the loop running when onDecode rejects instead of dying silently', async () => {
    const { stream, track } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    onDecodeMock.mockRejectedValue(new Error('network down'));

    await renderWithCamera();
    await decodeFrame();
    expect(onDecodeMock).toHaveBeenCalledTimes(1);

    // A rejected handler must not kill the scan loop: the next decode (past
    // the 1s lockout) is still processed and the camera is never stopped.
    await decodeFrame(1000 + 70);
    expect(onDecodeMock).toHaveBeenCalledTimes(2);
    expect(track.stop).not.toHaveBeenCalled();
  });
});

describe('useQrScanner — lifecycle and cleanup', () => {
  it('stops all tracks and cancels the loop on unmount', async () => {
    const { stream, track } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });

    const { unmount } = await renderWithCamera();
    await decodeFrame();
    expect(track.stop).not.toHaveBeenCalled();

    unmount();

    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('is StrictMode-safe: first mount stream stopped, no duplicate decode on surviving mount', async () => {
    const first = makeStream();
    const second = makeStream();
    getUserMediaMock
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream);
    jsQrMock.mockReturnValue({ data: VALID_QR });
    onDecodeMock.mockResolvedValue({ outcome: 'failure' });

    const { unmount } = render(
      <StrictMode>
        <Harness />
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

  it('is idempotent: calling stop twice stops each track once and throws no error', async () => {
    const { stream, track } = makeStream();
    getUserMediaMock.mockResolvedValue(stream);

    await renderWithCamera();

    expect(() => {
      apiRef.current?.stop();
      apiRef.current?.stop();
    }).not.toThrow();

    expect(track.stop).toHaveBeenCalledTimes(1);
  });
});
