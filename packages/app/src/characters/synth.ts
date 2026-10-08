/**
 * Building blocks for the bosses' synthesised sounds (no files, no licences). Everything is a pure function of the
 * sample rate (noise comes from a seeded generator), so a test can render a sound and measure it.
 */

export type Voice = (t: number) => number;

/** The move sample's level (public/sounds/move.mp3, measured with ffmpeg): peak -3.9 dBFS, mean -21.3 dBFS. */
export const MOVE_PEAK = 0.64;
export const MOVE_MEAN_DB = -21.3;

/** Renders `dur` seconds of a voice, with a short fade at both ends so nothing clicks. */
export function render(rate: number, dur: number, voice: Voice): Float32Array {
  const n = Math.ceil(rate * dur);
  const out = new Float32Array(n);
  const fade = Math.floor(rate * 0.004);
  for (let i = 0; i < n; i++) {
    const edge = Math.min(1, i / fade, (n - 1 - i) / fade);
    out[i] = voice(i / rate) * edge;
  }
  return out;
}

/** An oscillator whose frequency follows `freq(t)` (phase accumulated, so sweeps stay smooth). Call once per sample, in order. */
export function osc(rate: number, freq: (t: number) => number, shape: (phase: number) => number): Voice {
  let phase = 0;
  return (t) => {
    phase += freq(t) / rate;
    return shape(phase % 1);
  };
}
export const sine = (p: number) => Math.sin(2 * Math.PI * p);
export const saw = (p: number) => 2 * p - 1;
export const square = (p: number) => (p < 0.5 ? 1 : -1);

/** A one-pole low-pass, to take the edge off buzzy waves. */
export function lowpass(rate: number, cutoff: number, v: Voice): Voice {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  let y = 0;
  return (t) => (y += a * (v(t) - y));
}

/** White noise from a seeded generator (xorshift), the same every time. */
export function noise(seed = 1): Voice {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

/** A seeded random number in [0, 1) for placing events (a bell's strikes, an ice crack's clicks). */
export function rng(seed: number): () => number {
  const n = noise(seed);
  return () => (n(0) + 1) / 2;
}

/** A resonant band-pass (state-variable filter) whose centre can move with time: wind, whistles, crunch. */
export function bandpass(rate: number, centre: (t: number) => number, q: number, v: Voice): Voice {
  let low = 0;
  let band = 0;
  return (t) => {
    const f = 2 * Math.sin((Math.PI * Math.min(centre(t), rate / 6)) / rate);
    const high = v(t) - low - band / q;
    band += f * high;
    low += f * band;
    return band;
  };
}

/** A soft ceiling: quiet samples pass unchanged, loud ones bend under `ceiling` (keeps a transient's peak down). */
export const soft = (v: number, ceiling = 0.3) => ceiling * Math.tanh(v / ceiling);
