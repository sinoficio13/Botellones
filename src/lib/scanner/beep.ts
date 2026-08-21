'use client';

/**
 * Web Audio beep utility for scan feedback.
 *
 * Browsers suspend the AudioContext until a user gesture, so the context is
 * created lazily and resumed on the first call — the scan decode loop runs
 * only after the user grants camera access (a user gesture), which unlocks
 * audio. Subsequent calls reuse the same singleton. When no Web Audio API is
 * available (old browser, jsdom without a stub) `playBeep` is a silent no-op.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AudioContextCtor = new () => any;

let audioContext: {
  state: string;
  resume: () => Promise<void>;
  currentTime: number;
  createOscillator: () => {
    type: string;
    frequency: { value: number };
    connect: (n: unknown) => void;
    start: (t: number) => void;
    stop: (t: number) => void;
  };
  createGain: () => { gain: { value: number }; connect: (n: unknown) => void };
  destination: unknown;
} | null = null;
let AudioContextCtor: AudioContextCtor | undefined;

function resolveCtor(): AudioContextCtor | undefined {
  if (typeof AudioContextCtor === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AudioContextCtor = (globalThis as any).AudioContext;
    if (!AudioContextCtor) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      AudioContextCtor = (globalThis as any).webkitAudioContext;
    }
  }
  return AudioContextCtor;
}

/** Play a short ~0.12s sine beep. No-op when Web Audio is unavailable. */
export function playBeep(): void {
  const Ctor = resolveCtor();
  if (!Ctor) return;

  if (!audioContext) {
    audioContext = new Ctor();
  }
  // Local const: TS cannot narrow a mutable module-scoped `let` past the null
  // check, so bind the (now guaranteed non-null) singleton to a local.
  const ctx = audioContext ?? new Ctor();
  audioContext = ctx;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.value = 0.15;

  osc.connect(gain);
  gain.connect(ctx.destination);

  const startAt = ctx.currentTime;
  const stopAt = startAt + 0.12;
  osc.start(startAt);
  osc.stop(stopAt);
}
