/**
 * Hollow's sounds, synthesised (no files, no licences, no voice): the low hum of the void, the darkness pouring out of
 * it, the whisper of smoke settling on a square (and lifting off it), a bulb going out, a bulb smashed in his claw, the
 * void's pulse in the dark (the test's countdown), a piece found (a bright chime) or missed (a dull buzz), the lights
 * coming back (three warm plinks, rising), and his bulbs clinking. Each is a pure function of the sample rate (its
 * noise is seeded), so a test can measure it: every one stays quieter than a piece's move sound (peak and loudness).
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, type Voice } from "./synth.ts";

export type HollowSound = "hum" | "cast" | "whisper" | "pop" | "smash" | "tick" | "found" | "miss" | "relight" | "clink";

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

/**
 * A small glass bell struck at age 0: a few inharmonic partials ringing down from `f`, in closed form (no running
 * oscillators) and silent once rung out, so a sound made of many is quick to make.
 */
function glass(f: number, decay: number): (age: number) => number {
  const parts = [
    [1, 1],
    [2.76, 0.45],
    [5.4, 0.25],
  ].map(([m, a]) => ({ w: 2 * Math.PI * f * m!, a: a!, d: decay / m! ** 0.5 }));
  const life = decay * 7;
  return (age) => (age < 0 || age > life ? 0 : parts.reduce((s, p) => s + p.a * Math.exp(-age / p.d) * Math.sin(p.w * age), 0));
}

const SOUNDS: Record<HollowSound, (rate: number) => Float32Array> = {
  // The void: a low hum (two close tones beating slowly, a sub under them) that swells and fades.
  hum: (rate) => {
    const a = osc(rate, () => 55, sine);
    const b = osc(rate, () => 57.5, sine);
    const sub = osc(rate, () => 110, sine);
    const air = lowpass(rate, 260, noise(131));
    return render(rate, 0.9, (t) => Math.sin(Math.PI * Math.min(1, t / 0.9)) ** 1.4 * (a(t) + b(t) + 0.35 * sub(t) + 0.6 * air(t)));
  },
  // The dark pouring out: a breathy gush whose band falls away, over a low swell.
  cast: (rate) => {
    const gush = bandpass(rate, (t) => 1400 - 1100 * Math.min(1, t / 0.6), 1.8, noise(137));
    const low = osc(rate, (t) => 90 - 35 * Math.min(1, t / 0.6), sine);
    return render(rate, 0.65, (t) => {
      const env = Math.min(1, t / 0.06) * Math.max(0, 1 - t / 0.65) ** 1.3;
      return env * (1.5 * gush(t) + 0.7 * low(t));
    });
  },
  // Smoke settling on a square (or lifting off it): a soft rising and falling hush.
  whisper: (rate) => {
    const hush = bandpass(rate, (t) => 600 + 900 * Math.sin(Math.PI * Math.min(1, t / 0.45)), 1.4, noise(139));
    return render(rate, 0.45, (t) => Math.sin(Math.PI * Math.min(1, t / 0.45)) ** 2 * hush(t));
  },
  // A bulb going out: a tiny glassy tink, then the fizz of the filament dying.
  pop: (rate) => {
    const tink = glass(2300, 0.05);
    const fizz = bandpass(rate, () => 5200, 1.5, noise(149));
    const r = rng(151);
    const spits = Array.from({ length: 10 }, () => 0.03 + r() * 0.16);
    const spit = grains(spits, (age) => Math.exp(-age / 0.004));
    return render(rate, 0.26, (t) => 0.8 * tink(t) + fizz(t) * Math.min(1, spit(t)) * Math.max(0, 1 - t / 0.22));
  },
  // A bulb smashed: a sharp crack, glass tinkling down, a fizz, and a dull thump under it.
  smash: (rate) => {
    const crack = bandpass(rate, () => 3600, 0.9, noise(157));
    const r = rng(163);
    const bits = Array.from({ length: 16 }, () => ({ t: 0.02 + r() ** 1.5 * 0.4, f: 3000 + r() * 4000 }));
    const tinkles = bits.map((b) => ({ t: b.t, v: glass(b.f, 0.025) }));
    const thump = osc(rate, (t) => 70 + 90 * Math.exp(-t / 0.03), sine);
    return render(rate, 0.55, (t) => {
      let tk = 0;
      for (const b of tinkles) tk += b.v(t - b.t) * 0.35;
      return 2.2 * Math.exp(-t / 0.006) * crack(t) + tk + 0.8 * Math.exp(-t / 0.08) * thump(t);
    });
  },
  // The void's pulse in the dark (the test's countdown): a soft, low double beat, like a heart.
  tick: (rate) => {
    const beat = osc(rate, (t) => 62 + 40 * Math.exp(-(t % 0.16) / 0.03), sine);
    return render(rate, 0.34, (t) => {
      const a = Math.exp(-t / 0.06);
      const b = t > 0.16 ? 0.6 * Math.exp(-(t - 0.16) / 0.06) : 0;
      return (a + b) * beat(t);
    });
  },
  // A piece found: a bright little chime, two notes rising.
  found: (rate) => {
    const n1 = glass(1320, 0.18);
    const n2 = glass(1760, 0.22);
    return render(rate, 0.6, (t) => 0.6 * n1(t) + 0.6 * n2(t - 0.09));
  },
  // A miss: a dull, low buzz that sags.
  miss: (rate) => {
    const buzz = lowpass(rate, 700, osc(rate, (t) => 110 - 30 * Math.min(1, t / 0.3), (p) => (p < 0.5 ? 1 : -1)));
    return render(rate, 0.32, (t) => Math.min(1, t / 0.01) * Math.exp(-t / 0.12) * buzz(t));
  },
  // The lights coming back: a rising shimmer and three warm plinks, one per bulb.
  relight: (rate) => {
    const shimmer = bandpass(rate, (t) => 2000 + 3000 * Math.min(1, t / 0.9), 4, noise(167));
    const notes = [880, 1108, 1318].map((f, i) => ({ at: 0.12 + i * 0.22, v: glass(f, 0.28) }));
    return render(rate, 1.1, (t) => {
      let p = 0;
      for (const n of notes) p += n.v(t - n.at);
      return 0.6 * Math.sin(Math.PI * Math.min(1, t / 1.1)) * shimmer(t) + 0.55 * p;
    });
  },
  // His bulbs clinking on their wire: two glassy tinks.
  clink: (rate) => {
    const a = glass(2900, 0.04);
    const b = glass(3400, 0.035);
    return render(rate, 0.22, (t) => a(t) + 0.8 * b(t - 0.07));
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<HollowSound, number> = { hum: 0.095, cast: 0.22, whisper: 0.5, pop: 0.27, smash: 0.26, tick: 0.255, found: 0.21, miss: 0.155, relight: 0.155, clink: 0.21 };

const cache = new Map<string, Float32Array>();
/** The samples for one of his sounds at a sample rate (made once, then reused). */
export function hollowSound(name: HollowSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const HOLLOW_SOUNDS = Object.keys(SOUNDS) as HollowSound[];
