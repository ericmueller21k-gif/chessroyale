/**
 * G-REX's sounds, synthesised (no files, no licences, no voice): a fire crackle, a whoosh, a sparkler's fizz, the poof
 * of a piece burning up, the pop of a Roman candle shot, a comically big roar (a growl that ends in a squeak), the
 * wood-smack of the candle slammed down on the board, and the candle's shots: a firework's shrill sliding whistle in
 * three variants, now and then ending in a crackle high up. Each is a pure function of the sample rate (its noise is seeded),
 * so a test can measure it: every one stays quieter than a piece's move sound (peak and loudness), and so does the
 * whole volley of 24 whistles at once (see test/grex.test.ts).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, type Voice } from "./synth.ts";

export type GrexSound = "crackle" | "whoosh" | "fizz" | "poof" | "pop" | "roar" | "smack" | "whistle1" | "whistle2" | "whistle3" | "sparkle";

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
 * A whistling firework (Eric, Oct 9, 2026: higher and shriller, like the real thing): a soft "thoomp" as it leaves the
 * tube, then a shrill tone sliding from `f0` to `f1` Hz over `dur` seconds (`curve` shapes the slide; up or down), its
 * overtones making it screech, a quick wobble (`warble` Hz at `wobble` a second) and a slight unsteady drift, and a
 * little rasp: the tone roughened by a low buzz of noise (`rasp`), with a hiss on its pitch. It fades out at the end.
 */
function whistle(rate: number, o: { f0: number; f1: number; dur: number; curve: number; warble: number; wobble: number; rasp: number; seed: number }): Float32Array {
  const drift = lowpass(rate, 12, noise(o.seed + 2));
  // Worked out once per sample (the tone and the hiss both follow it; the drift is a stream).
  let at = -1;
  let hz = o.f0;
  const pitch = (t: number) => {
    if (t !== at) {
      at = t;
      const x = Math.min(1, t / o.dur);
      hz = (o.f0 + (o.f1 - o.f0) * x ** o.curve + o.warble * Math.sin(2 * Math.PI * o.wobble * t)) * (1 + 1.2 * drift(t));
    }
    return hz;
  };
  // A shrill tone: the pitch with its 2nd and 3rd overtones.
  const tone = osc(rate, pitch, (p) => Math.sin(2 * Math.PI * p) + 0.38 * Math.sin(4 * Math.PI * p) + 0.16 * Math.sin(6 * Math.PI * p));
  const buzz = lowpass(rate, 240, noise(o.seed + 1));
  const hiss = bandpass(rate, pitch, 9, noise(o.seed));
  const thoomp = osc(rate, (t) => 80 + 140 * Math.exp(-t / 0.02), sine);
  const fadeAt = o.dur * 0.75;
  return render(rate, o.dur, (t) => {
    const env = Math.min(1, t / 0.03) * (t < fadeAt ? 1 : Math.max(0, 1 - (t - fadeAt) / (o.dur - fadeAt))) ** 1.4;
    const rough = 1 + o.rasp * Math.max(-1, Math.min(1, 9 * buzz(t)));
    return env * (0.8 + 0.2 * (t / o.dur)) * (0.62 * tone(t) * rough + 1.5 * hiss(t)) + 1.2 * Math.exp(-t / 0.035) * thoomp(t);
  });
}

/** How long each of the candle's whistles lasts (s). */
const WHISTLE_DUR = { whistle1: 0.85, whistle2: 1.05, whistle3: 0.72 } as const;

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
  // The Roman candle slammed down on the board: a hard wooden smack (the crack of contact, the board's hollow knock
  // ringing for a moment in a few wooden modes, and a dull thud under it).
  smack: (rate) => {
    const crack = bandpass(rate, () => 2800, 0.8, noise(83));
    const modes = [
      [182, 0.07, 1],
      [410, 0.05, 0.75],
      [745, 0.034, 0.55],
      [1230, 0.022, 0.4],
      [2050, 0.013, 0.3],
    ].map(([f, d, a]) => ({ v: osc(rate, () => f!, sine), d: d!, a: a! }));
    const thud = osc(rate, (t) => 62 + 70 * Math.exp(-t / 0.015), sine);
    return render(rate, 0.32, (t) => {
      let ring = 0;
      for (const m of modes) ring += m.a * Math.exp(-t / m.d) * m.v(t);
      return 2.4 * Math.exp(-t / 0.0035) * crack(t) + 0.8 * ring + 0.9 * Math.exp(-t / 0.045) * thud(t);
    });
  },
  // The candle's shots: three shrill whistles, told apart by ear: one shrieking up, one sliding down (a tube burning
  // empty), one screeching on a fast wobble.
  whistle1: (rate) => whistle(rate, { f0: 2300, f1: 4600, dur: WHISTLE_DUR.whistle1, curve: 0.6, warble: 45, wobble: 7, rasp: 0.35, seed: 89 }),
  whistle2: (rate) => whistle(rate, { f0: 4400, f1: 2400, dur: WHISTLE_DUR.whistle2, curve: 0.85, warble: 30, wobble: 5.5, rasp: 0.45, seed: 97 }),
  whistle3: (rate) => whistle(rate, { f0: 2600, f1: 4300, dur: WHISTLE_DUR.whistle3, curve: 0.5, warble: 170, wobble: 11, rasp: 0.55, seed: 101 }),
  // A shot bursting high up: a soft bang, then a spray of tiny crackles dying away.
  sparkle: (rate) => {
    const r = rng(103);
    const cracks = Array.from({ length: 46 }, () => ({ t: 0.03 + r() ** 1.4 * 0.62, a: 0.35 + r() * 0.65 }));
    const n = noise(107);
    const pops = grains(cracks.map((c) => c.t), (age, i) => (age < 0.03 ? cracks[i]!.a * Math.exp(-age / 0.0025) : 0));
    const snap = bandpass(rate, () => 3600, 0.9, (t) => pops(t) * n(t));
    const bang = lowpass(rate, 700, noise(109));
    return render(rate, 0.75, (t) => 1.4 * snap(t) * (1 - 0.6 * (t / 0.75)) + 0.9 * Math.exp(-t / 0.03) * bang(t));
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
const LEVEL: Record<GrexSound, number> = { crackle: 0.9, whoosh: 0.27, fizz: 0.18, poof: 0.33, pop: 0.31, roar: 0.15, smack: 0.3, whistle1: 0.018, whistle2: 0.02, whistle3: 0.017, sparkle: 0.2 };

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

/** The three whistles a shot can make. */
export const WHISTLES = ["whistle1", "whistle2", "whistle3"] as const;
/** How far a shot's pitch may stray, up or down (its whistle played a little faster or slower). */
export const WHISTLE_SPREAD = 0.07;
/** About one shot in this many ends in a crackle high up. */
export const CRACKLE_EVERY = 3;

/**
 * One shot's sound, from three random numbers in [0, 1): which whistle, a little pitch either way (played at `rate`, so
 * a higher one is a touch shorter), and now and then a crackle as it bursts, `crackleAt` seconds in (its whistle's end).
 */
export function whistlePick(a: number, b: number, c: number): { name: (typeof WHISTLES)[number]; rate: number; crackleAt: number | null } {
  const name = WHISTLES[Math.min(WHISTLES.length - 1, Math.floor(a * WHISTLES.length))]!;
  const rate = 1 + (b * 2 - 1) * WHISTLE_SPREAD;
  const dur = WHISTLE_DUR[name];
  return { name, rate, crackleAt: c < 1 / CRACKLE_EVERY ? (dur * 0.92) / rate : null };
}
