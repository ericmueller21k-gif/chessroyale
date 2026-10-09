/**
 * G-REX's sounds, synthesised (no files, no licences, no voice): a fire crackle, a whoosh, a sparkler's fizz, the poof
 * of a piece burning up, the pop of a Roman candle shot, and a comically big roar (a growl that ends in a squeak). Each
 * is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays quieter than a
 * piece's move sound (peak and loudness; see test/grex.test.ts).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, type Voice } from "./synth.ts";

export type GrexSound = "crackle" | "whoosh" | "fizz" | "poof" | "pop" | "roar";

/** Short bursts at the given times, each shaped by `burst(age, i)`. */
function grains(times: readonly number[], burst: (age: number, i: number) => number): Voice {
  return (t) => {
    let v = 0;
    times.forEach((t0, i) => {
      if (t >= t0) v += burst(t - t0, i);
    });
    return v;
  };
}

const SOUNDS: Record<GrexSound, (rate: number) => Float32Array> = {
  // Fire crackling: sharp pops scattered over the soft roar of flames.
  crackle: (rate) => {
    const r = rng(41);
    const pops = Array.from({ length: 14 }, () => ({ t: r() * 0.5, a: 0.4 + r() * 0.6 }));
    const n = noise(43);
    const snap = bandpass(rate, () => 2600, 1.1, (t) => grains(pops.map((p) => p.t), (age, i) => pops[i]!.a * Math.exp(-age / 0.006))(t) * n(t));
    const flames = lowpass(rate, 500, noise(47));
    return render(rate, 0.6, (t) => 1.2 * snap(t) + 0.45 * Math.sin(Math.PI * Math.min(1, t / 0.6)) * flames(t));
  },
  // A whoosh: a gust of noise whose band sweeps up and back down as it swells and fades.
  whoosh: (rate) => {
    const air = bandpass(rate, (t) => 500 + 2200 * Math.sin(Math.PI * Math.min(1, t / 0.45)), 2.2, noise(53));
    return render(rate, 0.45, (t) => Math.sin(Math.PI * Math.min(1, t / 0.45)) ** 1.6 * air(t));
  },
  // A sparkler: a bright hiss that crackles in tiny random bursts.
  fizz: (rate) => {
    const hiss = bandpass(rate, () => 6200, 1.6, noise(59));
    const r = rng(61);
    const spits = Array.from({ length: 30 }, () => r() * 0.5);
    const spit = grains(spits, (age) => Math.exp(-age / 0.004));
    return render(rate, 0.55, (t) => (t < 0.45 ? 1 : Math.max(0, 1 - (t - 0.45) / 0.1)) * hiss(t) * (0.35 + 0.9 * Math.min(1, spit(t))));
  },
  // A piece burning up: a soft low thump and a puff of air.
  poof: (rate) => {
    const thump = osc(rate, (t) => 60 + 120 * Math.exp(-t / 0.05), sine);
    const puff = lowpass(rate, 900, noise(67));
    return render(rate, 0.38, (t) => Math.exp(-t / 0.09) * (0.9 * thump(t) + 0.8 * puff(t)));
  },
  // A Roman candle shot: a quick "thoomp" with a little whistle as the rocket climbs.
  pop: (rate) => {
    const thoomp = osc(rate, (t) => 90 + 160 * Math.exp(-t / 0.025), sine);
    const whistle = osc(rate, (t) => 1300 + 1600 * Math.min(1, t / 0.2), sine);
    const hiss = bandpass(rate, () => 3000, 1.2, noise(71));
    return render(rate, 0.24, (t) => Math.exp(-t / 0.04) * (thoomp(t) + 0.5 * hiss(t)) + 0.12 * Math.sin(Math.PI * Math.min(1, t / 0.24)) * whistle(t));
  },
  // The roar: a huge wobbling growl (a buzzy low tone and a rumble), pitch climbing then sagging, that ends in a tiny squeak.
  roar: (rate) => {
    const growl = lowpass(rate, 900, osc(rate, (t) => 85 + 40 * Math.sin(Math.PI * Math.min(1, t / 0.85)) + 6 * Math.sin(2 * Math.PI * 9 * t), saw));
    const rumble = lowpass(rate, 300, noise(73));
    const squeak = osc(rate, (t) => 1500 + 900 * Math.min(1, Math.max(0, t - 0.95) / 0.12), sine);
    return render(rate, 1.15, (t) => {
      const body = t < 0.9 ? Math.min(1, t / 0.08) * (1 - 0.3 * (t / 0.9)) : Math.max(0, 1 - (t - 0.9) / 0.06);
      const eep = t > 0.95 ? Math.sin(Math.PI * Math.min(1, (t - 0.95) / 0.18)) : 0;
      return body * (growl(t) + 0.7 * rumble(t)) + 0.35 * eep * squeak(t);
    });
  },
};

/** Trims each to sit a little under a move's loudness (as Ginger's and Boingo's do); a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<GrexSound, number> = { crackle: 0.9, whoosh: 0.27, fizz: 0.18, poof: 0.33, pop: 0.31, roar: 0.15 };

const cache = new Map<string, Float32Array>();
/** The samples for one of his sounds at a sample rate (made once, then reused). */
export function grexSound(name: GrexSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const GREX_SOUNDS = Object.keys(SOUNDS) as GrexSound[];
