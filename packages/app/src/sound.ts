/**
 * Game sounds, synthesised with Web Audio (no sound files to load or license).
 * Browsers only allow audio after a tap, so call unlockAudio() from one. The
 * mute choice is remembered on the device.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
const MUTE_KEY = "brc.muted";
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

/** Call from a tap so browsers allow sound later. */
export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    void ctx.resume();
  } catch {
    // No audio on this device: the game works silently.
  }
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}
export function onMuteChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A wooden "thock": a short filtered noise burst for the click plus a low body. */
function thock(at: number, pitch = 1, level = 1) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1800 * pitch;
  band.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.5 * level, at + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  src.connect(band).connect(g).connect(master!);
  src.start(at);
  src.stop(at + 0.08);

  const body = c.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(240 * pitch, at);
  body.frequency.exponentialRampToValueAtTime(110 * pitch, at + 0.09);
  const bg = c.createGain();
  bg.gain.setValueAtTime(0.0001, at);
  bg.gain.exponentialRampToValueAtTime(0.45 * level, at + 0.004);
  bg.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
  body.connect(bg).connect(master!);
  body.start(at);
  body.stop(at + 0.13);
}

/** A soft bell-like note. */
function bell(at: number, freq: number, length = 0.5, level = 0.18, type: OscillatorType = "sine") {
  const c = ctx!;
  for (const [mult, amp] of [
    [1, 1],
    [2, 0.25],
    [3, 0.08],
  ] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq * mult;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level * amp, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    o.connect(g).connect(master!);
    o.start(at);
    o.stop(at + length + 0.02);
  }
}

export type SoundName = "move" | "capture" | "roundStart" | "allIn" | "powerUp" | "safe" | "out" | "win" | "tick" | "tickLast";

const SOUNDS: Record<SoundName, (t: number) => void> = {
  move: (t) => thock(t, 1, 1),
  capture: (t) => {
    thock(t, 1.2, 1.1);
    thock(t + 0.05, 0.85, 0.9);
  },
  roundStart: (t) => {
    bell(t, 659, 0.35, 0.12);
    bell(t + 0.09, 988, 0.5, 0.12);
  },
  allIn: (t) => bell(t, 1319, 0.45, 0.1),
  powerUp: (t) => [784, 988, 1175, 1568].forEach((f, i) => bell(t + i * 0.055, f, 0.35, 0.1, "triangle")),
  safe: (t) => {
    [523, 659, 784].forEach((f) => bell(t, f, 0.7, 0.09));
    bell(t + 0.18, 1047, 0.8, 0.11);
  },
  out: (t) => [392, 330, 262].forEach((f, i) => bell(t + i * 0.16, f, 0.6, 0.13, "triangle")),
  win: (t) => {
    [523, 659, 784, 1047].forEach((f, i) => bell(t + i * 0.12, f, 0.5, 0.12, "triangle"));
    [523, 659, 784, 1047].forEach((f) => bell(t + 0.55, f, 1.4, 0.08));
  },
  tick: (t) => bell(t, 660, 0.15, 0.2, "square"),
  tickLast: (t) => bell(t, 880, 0.2, 0.2, "square"),
};

export function play(name: SoundName) {
  // Tests read this log (set window.__soundLog = [] to start one).
  (globalThis as { __soundLog?: string[] }).__soundLog?.push(`${name}:${ctx?.state ?? "none"}${muted ? ":muted" : ""}`);
  if (muted || !ctx || !master || ctx.state !== "running") return;
  try {
    SOUNDS[name](ctx.currentTime + 0.005);
  } catch {
    // Ignore audio errors.
  }
}
