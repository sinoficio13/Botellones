import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Factory producing a jsdom-safe mock AudioContext. Each instance exposes the
// Web Audio surface playBeep touches: state, resume, createOscillator,
// createGain, and a currentTime. The oscillator/gain are recorded so we can
// assert the beep envelope (start/stop/connect) without real audio.
function createAudioContextMock() {
  const nodes: Array<Record<string, unknown>> = [];
  const ctx = {
    state: 'suspended' as string,
    currentTime: 0,
    resume: vi.fn().mockImplementation(function (this: { state: string }) {
      this.state = 'running';
      return Promise.resolve();
    }),
    createOscillator: vi.fn(() => {
      const node = {
        type: '',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      nodes.push(node);
      return node;
    }),
    createGain: vi.fn(() => {
      const node = { gain: { value: 0 }, connect: vi.fn() };
      nodes.push(node);
      return node;
    }),
    destination: {},
  };
  return { ctx, nodes };
}

describe('playBeep', () => {
  let ctxMock: ReturnType<typeof createAudioContextMock>['ctx'];
  let nodes: ReturnType<typeof createAudioContextMock>['nodes'];

  beforeEach(() => {
    // Reset module state between tests: re-import fresh so the lazy singleton
    // AudioContext is created anew for each scenario.
    vi.resetModules();
    const mock = createAudioContextMock();
    ctxMock = mock.ctx;
    nodes = mock.nodes;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lazily creates and resumes an AudioContext on the first call', async () => {
    const ctorSpy = vi.fn(function AudioContext() {
      return ctxMock;
    });
    vi.stubGlobal('AudioContext', ctorSpy);
    const { playBeep } = await import('@/lib/scanner/beep');

    // Before any call the AudioContext must NOT be constructed (lazy).
    expect(ctorSpy).not.toHaveBeenCalled();

    playBeep();

    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(ctxMock.resume).toHaveBeenCalled();
    expect(ctxMock.state).toBe('running');
  });

  it('sounds a short oscillator envelope via a gain node', async () => {
    const ctorSpy = vi.fn(function AudioContext() {
      return ctxMock;
    });
    vi.stubGlobal('AudioContext', ctorSpy);
    const { playBeep } = await import('@/lib/scanner/beep');

    playBeep();

    const osc = nodes.find((n) => typeof n.start === 'function') as {
      type: string;
      frequency: { value: number };
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    };
    const gain = nodes.find((n) => 'gain' in n && 'connect' in n) as {
      gain: { value: number };
      connect: ReturnType<typeof vi.fn>;
    };

    // A single oscillator + gain pair are created.
    expect(osc).toBeDefined();
    expect(gain).toBeDefined();
    // The oscillator is shaped (sine, ~880Hz) and routed into the gain node.
    expect(osc.type).toBe('sine');
    expect(osc.frequency.value).toBeGreaterThan(0);
    expect(osc.connect).toHaveBeenCalledWith(gain);
    // The gain node routes to the destination and the oscillator plays a short
    // burst (~0.12s), stopping shortly after it starts.
    expect(gain.connect).toHaveBeenCalledWith(ctxMock.destination);
    expect(osc.start).toHaveBeenCalledTimes(1);
    expect(osc.stop).toHaveBeenCalledTimes(1);
    const stopAt = osc.stop.mock.calls[0][0] as number;
    const startAt = osc.start.mock.calls[0][0] as number;
    expect(stopAt - startAt).toBeGreaterThan(0);
    expect(stopAt - startAt).toBeLessThanOrEqual(0.2);
  });

  it('reuses the same AudioContext across multiple calls', async () => {
    const ctorSpy = vi.fn(function AudioContext() {
      return ctxMock;
    });
    vi.stubGlobal('AudioContext', ctorSpy);
    const { playBeep } = await import('@/lib/scanner/beep');

    playBeep();
    playBeep();

    // Lazy singleton: constructed once, reused for the second beep.
    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(nodes.length).toBe(4); // 2 oscillators + 2 gains across 2 beeps
  });

  it('is a silent no-op when no Web Audio context is available', async () => {
    // Neither AudioContext nor webkitAudioContext is defined.
    const { playBeep } = await import('@/lib/scanner/beep');

    // Must not throw and must not produce any audio nodes.
    expect(() => playBeep()).not.toThrow();
    expect(nodes).toHaveLength(0);
  });
});
