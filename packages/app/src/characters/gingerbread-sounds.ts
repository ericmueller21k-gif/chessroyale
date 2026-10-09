/**
 * Ginger's sounds, synthesised (no files, no licences, no voice): a cookie crunch, a sleigh-bell jingle, an ice
 * crackle and the blizzard's wind. Each is a pure function of the sample rate (its noise is seeded), so a test can
 * measure it: every one stays quieter than a piece's move sound (peak and loudness; see test/gingerbread.test.ts).
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, type Voice } from "./synth.ts";

export type GingerSound = "crunch" | "jingle" | "crackle" | "wind";

/** Short bursts of noise at the given times, each shaped by `burst(age)`. */
function grains(times: readonly number[], burst: (age: number, i: number) => number): Voice {
  return (t) => {
    let v = 0;
    times.forEach((t0, i) => {
      if (t >= t0) v += burst(t - t0, i);
    });
    return v;
  };
}

const SOUNDS: Record<GingerSound, (rate: number) => Float32Array> = {
  // A bite of gingerbread: four quick crunchy grains of mid-band noise, the first the loudest.
  crunch: (rate) => {
    const n = noise(3);
    const crumbs = noise(5);
    const hits = [0, 0.055, 0.12, 0.2];
    const body = bandpass(rate, () => 1500, 0.9, (t) => grains(hits, (age, i) => Math.exp(-age / 0.022) * [1, 0.7, 0.8, 0.5][i]!)(t) * n(t));
    const grit = bandpass(rate, () => 4200, 1.2, (t) => (t < 0.3 ? Math.exp(-t / 0.12) : 0) * (crumbs(t) > 0.92 ? 1 : 0));
    return render(rate, 0.34, (t) => 0.9 * body(t) + 0.35 * grit(t));
  },
  // Sleigh bells shaken: a dozen small metal strikes (bright, inharmonic partials) over half a second.
  jingle: (rate) => {
    const r = rng(17);
    const strikes = Array.from({ length: 12 }, (_, i) => ({ t: i * 0.04 + r() * 0.025, f: 2200 + r() * 900, a: 0.6 + r() * 0.4 }));
    const shimmer = bandpass(rate, () => 7000, 2, noise(19));
    return render(rate, 0.7, (t) => {
      let v = 0;
      for (const s of strikes) {
        if (t < s.t) continue;
        const age = t - s.t;
        const env = s.a * Math.exp(-age / 0.05);
        if (env < 0.002) continue;
        v += env * (Math.sin(2 * Math.PI * s.f * age) + 0.6 * Math.sin(2 * Math.PI * s.f * 1.51 * age) + 0.35 * Math.sin(2 * Math.PI * s.f * 2.37 * age));
      }
      const shake = t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) / 0.2);
      return 0.07 * v + 0.25 * shake * shimmer(t);
    });
  },
  // Ice crackling: sharp clicks scattered over a high glassy ring that fades.
  crackle: (rate) => {
    const r = rng(23);
    const clicks = Array.from({ length: 16 }, () => ({ t: r() * 0.4, a: 0.4 + r() * 0.6 }));
    const n = noise(29);
    const snap = bandpass(rate, () => 5200, 1.4, (t) => grains(clicks.map((c) => c.t), (age, i) => clicks[i]!.a * Math.exp(-age / 0.004))(t) * n(t));
    const ring = osc(rate, (t) => 3100 + 200 * Math.exp(-t / 0.1), sine);
    const ring2 = osc(rate, (t) => 4650 + 250 * Math.exp(-t / 0.1), sine);
    return render(rate, 0.5, (t) => 1.1 * snap(t) + 0.1 * Math.exp(-t / 0.14) * (ring(t) + 0.6 * ring2(t)));
  },
  // The blizzard: a gust of wind that swells and dies away, with a whistle drifting through it.
  wind: (rate) => {
    const gust = (t: number) => Math.sin(Math.PI * Math.min(1, t / 1.4)) ** 1.5 * (1 + 0.25 * Math.sin(2 * Math.PI * 2.3 * t));
    const roar = lowpass(rate, 700, noise(31));
    const whistle = bandpass(rate, (t) => 900 + 500 * Math.sin(2 * Math.PI * 0.8 * t + 1) + 300 * Math.sin(2 * Math.PI * 2.9 * t), 9, noise(37));
    return render(rate, 1.4, (t) => gust(t) * (0.55 * roar(t) + 0.5 * whistle(t)));
  },
};

/** Trims each to sit a little under a move's loudness (as Boingo's do); a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<GingerSound, number> = { crunch: 1.31, jingle: 0.35, crackle: 0.55, wind: 0.38 };

const cache = new Map<string, Float32Array>();
/** The samples for one of his sounds at a sample rate (made once, then reused). */
export function gingerSound(name: GingerSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const GINGER_SOUNDS = Object.keys(SOUNDS) as GingerSound[];
