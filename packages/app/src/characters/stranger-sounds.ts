/**
 * The Stranger's sounds, synthesized (no files, no licenses), as the other bosses' are: his own, never another boss's. A swordsman
 * of fire and ice: steel ringing as both swords leave his back, a slide and a clack as they go home, two whooshes for his double slash
 * (one with a crackle of fire, one with a glassy tinkle of ice), a bright ping as his blades' tips touch, and his cast: a low roar of
 * fire under a rising shimmer of ice. Hurt, a low thump; beaten, a sword's clatter and his knee on the ground. His voice for his lines
 * is a low, calm "hm" (`voice`), his entrance a longer hum (`hum`). The board art's: a crackle of ice forming (`freeze`) and a burst
 * of flame (`burn`).
 *
 * Each is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays quieter than a piece's
 * move (peak and loudness). Which cue plays which: STRANGER_SOUNDS (stranger-lines.ts's kit wiring, kits.ts ART_KITS).
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, soundCache } from "./synth.ts";

export type StrangerSound = "draw" | "sheathe" | "slash" | "tips" | "cast" | "hit" | "fall" | "kneel" | "hum" | "voice" | "freeze" | "burn";

const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
const lerp = (a: number, b: number, u: number) => a + (b - a) * clamp01(u);

/** Scaled to a loudness of 1 (its RMS), so each sound's LEVEL sets it. */
function unit(s: Float32Array): Float32Array {
  const loud = Math.sqrt(s.reduce((a, v) => a + v * v, 0) / Math.max(1, s.length)) || 1;
  return s.map((v) => v / loud);
}

/** Sums sounds, each starting at its own time (seconds), into one of `dur` seconds. */
function mix(rate: number, dur: number, parts: readonly (readonly [number, Float32Array, number?])[]): Float32Array {
  const out = new Float32Array(Math.ceil(rate * dur));
  for (const [at, w, gain = 1] of parts) {
    const start = Math.round(at * rate);
    for (let i = 0; i < w.length && start + i < out.length; i++) out[start + i]! += gain * w[i]!;
  }
  return out;
}

/** Steel ringing: a few inharmonic partials round `f` Hz, struck, decaying over `d` seconds. */
function ring(rate: number, f: number, d: number): Float32Array {
  const parts = [1, 1.51, 2.37, 3.1].map((m, i) => ({ o: osc(rate, () => f * m, sine), a: [1, 0.55, 0.35, 0.2][i]! }));
  return render(rate, d, (t) => Math.min(1, t / 0.002) * Math.exp(-t / (d * 0.35)) * parts.reduce((s, p) => s + p.a * p.o(t), 0));
}

/** A blade's whoosh: noise through a band sweeping from `f0` to `f1` Hz, swelling and gone in `d` seconds. */
function whoosh(rate: number, f0: number, f1: number, d: number, seed: number): Float32Array {
  const v = bandpass(rate, (t) => lerp(f0, f1, t / d), 2.2, noise(seed));
  return render(rate, d, (t) => Math.sin(Math.PI * clamp01(t / d)) ** 2 * v(t));
}

/** A crackle of fire: tiny bright snaps scattered over `d` seconds, over a low rumble. */
function crackle(rate: number, d: number, snaps: number, seed: number, rumble = 0.5): Float32Array {
  const r = rng(seed);
  const at = Array.from({ length: snaps }, () => ({ t: r() * d * 0.9, a: 0.4 + 0.6 * r() })).sort((a, b) => a.t - b.t);
  const snap = bandpass(rate, () => 3200, 1.4, noise(seed + 1));
  const low = lowpass(rate, 300, lowpass(rate, 300, noise(seed + 2)));
  return render(rate, d, (t) => {
    let v = 0;
    for (const c of at) if (t >= c.t && t < c.t + 0.012) v += c.a * Math.exp(-(t - c.t) / 0.003);
    return v * snap(t) * 3 + rumble * Math.sin(Math.PI * clamp01(t / d)) * low(t) * 4;
  });
}

/** Ice: a glassy tinkle, a run of short high pings rising (`up`) or scattered. */
function tinkle(rate: number, d: number, n: number, seed: number, up = true): Float32Array {
  const r = rng(seed);
  return mix(
    rate,
    d,
    Array.from({ length: n }, (_, i) => [((i + r() * 0.5) / n) * d * 0.8, ring(rate, (up ? 2400 + i * 260 : 2600 + r() * 1400), 0.12), 0.4 + 0.3 * r()] as const),
  );
}

/** A low thump: a sine dropping in pitch, quick. */
function thump(rate: number, f0: number, d: number): Float32Array {
  const o = osc(rate, (t) => lerp(f0, f0 * 0.5, t / d), sine);
  return render(rate, d, (t) => Math.exp(-t / (d * 0.3)) * o(t));
}

/** A calm hummed "hm": a round voiced tone through a closed vowel's formant, gliding from `p0` to `p1` Hz. */
function hm(rate: number, d: number, p0: number, p1: number): Float32Array {
  const src = osc(rate, (t) => lerp(p0, p1, t / d), (ph) => Math.sin(2 * Math.PI * ph) + 0.3 * Math.sin(4 * Math.PI * ph) + 0.12 * Math.sin(6 * Math.PI * ph));
  const f = lowpass(rate, 700, src);
  return render(rate, d, (t) => Math.min(1, t / 0.03) * Math.min(1, (d - t) / 0.08) * f(t));
}

const SOUNDS: Record<StrangerSound, (rate: number) => Float32Array> = {
  // Both swords out: a slide off his back, then two rings, warm and cold.
  draw: (rate) => unit(mix(rate, 0.7, [[0, whoosh(rate, 1800, 5200, 0.16, 11), 0.8], [0.1, ring(rate, 1180, 0.55)], [0.13, ring(rate, 1560, 0.55), 0.8]])),
  // Home again: a slide down and a double clack.
  sheathe: (rate) => unit(mix(rate, 0.4, [[0, whoosh(rate, 4200, 1600, 0.16, 12), 0.7], [0.15, thump(rate, 240, 0.06)], [0.15, ring(rate, 900, 0.12), 0.5], [0.2, ring(rate, 1100, 0.12), 0.5]])),
  // The double slash: fire's whoosh with a crackle, then ice's with a tinkle, crossing.
  slash: (rate) =>
    unit(
      mix(rate, 0.6, [
        [0, whoosh(rate, 900, 3200, 0.2, 13)],
        [0.03, crackle(rate, 0.25, 14, 14, 0.2), 0.5],
        [0.08, whoosh(rate, 1400, 4400, 0.2, 15)],
        [0.12, tinkle(rate, 0.3, 5, 16, false), 0.4],
      ]),
    ),
  // The tips touching: a bright ping, two close tones beating.
  tips: (rate) => unit(mix(rate, 0.6, [[0, ring(rate, 2620, 0.55)], [0, ring(rate, 2665, 0.55), 0.9]])),
  // The cast: a low roar of fire under a rising shimmer of ice, swelling and let go.
  cast: (rate) => unit(mix(rate, 0.9, [[0, crackle(rate, 0.8, 22, 17, 1.2), 0.8], [0.05, tinkle(rate, 0.7, 8, 18, true), 0.6], [0.55, thump(rate, 110, 0.3), 0.8]])),
  hit: (rate) => unit(mix(rate, 0.3, [[0, thump(rate, 140, 0.18)], [0, whoosh(rate, 2400, 900, 0.1, 19), 0.4]])),
  // Beaten: a sword's clatter on the ground.
  fall: (rate) => unit(mix(rate, 0.6, [[0, ring(rate, 980, 0.3), 0.7], [0.09, ring(rate, 1240, 0.25), 0.5], [0.16, ring(rate, 860, 0.3), 0.4]])),
  kneel: (rate) => unit(mix(rate, 0.3, [[0, thump(rate, 110, 0.22)], [0, whoosh(rate, 600, 300, 0.08, 21), 0.4]])),
  hum: (rate) => unit(mix(rate, 0.7, [[0, hm(rate, 0.6, 120, 104)]])),
  voice: (rate) => unit(hm(rate, 0.22, 128, 116)),
  // The board's: ice forming (a crackle, high), and flame bursting up.
  freeze: (rate) => unit(mix(rate, 0.5, [[0, tinkle(rate, 0.35, 7, 22, false), 0.8], [0, whoosh(rate, 6000, 3000, 0.3, 23), 0.5]])),
  burn: (rate) => unit(mix(rate, 0.6, [[0, whoosh(rate, 300, 1400, 0.3, 24)], [0.05, crackle(rate, 0.5, 18, 25, 0.8), 0.8]])),
};

/** Each sound's level: every one under a move's loudness; a soft ceiling keeps the peaks well under. */
const LEVEL: Record<StrangerSound, number> = {
  draw: 0.045,
  sheathe: 0.04,
  slash: 0.05,
  tips: 0.035,
  cast: 0.05,
  hit: 0.05,
  fall: 0.04,
  kneel: 0.05,
  hum: 0.045,
  voice: 0.045,
  freeze: 0.04,
  burn: 0.045,
};

const cache = soundCache("stranger");
/** The samples for one of his sounds at a sample rate (made once, then reused). */
export function strangerSound(name: StrangerSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const STRANGER_SOUND_NAMES = Object.keys(SOUNDS) as StrangerSound[];
