/**
 * Hollow's sounds, synthesised (no files, no licences, no voice), all low and dark (Eric, Oct 9, 2026: no chimes, ever;
 * nothing bright, nothing major-key): the low hum of the void, the darkness pouring out of it, the hush of smoke
 * settling on a square (and lifting off it), a bulb going out (a dull fizzle), a bulb smashed in his claw (kept: Eric
 * loves it), the void's pulse in the dark (a low heartbeat, the test's countdown), a piece found (a low swell) or missed
 * (a dull thud), the lights coming back (a deep rising swell), and his strand knocking. Each is a pure function of the sample rate (its
 * noise is seeded), so a test can measure it: every one stays quieter than a piece's move sound (peak and loudness).
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, type Voice } from "./synth.ts";

export type HollowSound = "hum" | "cast" | "whisper" | "pop" | "smash" | "tick" | "found" | "miss" | "relight" | "clink" | "lash";

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

/** Noise with its highs rolled off twice (12 dB an octave above `cut`): a dark rumble or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

const SOUNDS: Record<HollowSound, (rate: number) => Float32Array> = {
  // The void: a low hum (two close tones beating slowly, a sub under them) that swells and fades.
  hum: (rate) => {
    const a = osc(rate, () => 55, sine);
    const b = osc(rate, () => 57.5, sine);
    const sub = osc(rate, () => 110, sine);
    const air = lowpass(rate, 260, noise(131));
    return render(rate, 0.9, (t) => Math.sin(Math.PI * Math.min(1, t / 0.9)) ** 1.4 * (a(t) + b(t) + 0.35 * sub(t) + 0.6 * air(t)));
  },
  // The dark pouring out: a low swell, a dark breath whose band sinks as it pours, over a falling sub.
  cast: (rate) => {
    const gush = bandpass(rate, (t) => 520 - 360 * Math.min(1, t / 0.7), 1.6, murk(rate, 900, 137));
    const low = osc(rate, (t) => 72 - 30 * Math.min(1, t / 0.7), sine);
    return render(rate, 0.75, (t) => {
      const env = Math.min(1, t / 0.18) ** 1.5 * Math.max(0, 1 - t / 0.75) ** 1.2;
      return env * (1.6 * gush(t) + 0.9 * low(t));
    });
  },
  // Smoke settling on a square (or lifting off it): a low, soft hush that swells and sinks.
  whisper: (rate) => {
    const hush = bandpass(rate, (t) => 260 + 300 * Math.sin(Math.PI * Math.min(1, t / 0.5)), 1.3, murk(rate, 800, 139));
    const breath = murk(rate, 160, 141);
    return render(rate, 0.5, (t) => Math.sin(Math.PI * Math.min(1, t / 0.5)) ** 2 * (hush(t) + 2.2 * breath(t)));
  },
  // A bulb going out: a dull fizzle, the filament sputtering low and dying, and a soft thup.
  pop: (rate) => {
    const r = rng(151);
    const spits = Array.from({ length: 12 }, () => 0.01 + r() ** 1.3 * 0.24);
    const spit = grains(spits, (age) => Math.exp(-age / 0.006));
    const fizz = lowpass(rate, 900, lowpass(rate, 1400, noise(149)));
    const thup = osc(rate, (t) => 50 + 40 * Math.exp(-t / 0.03), sine);
    return render(rate, 0.3, (t) => 2.6 * fizz(t) * Math.min(1, spit(t)) * Math.max(0, 1 - t / 0.28) + 0.7 * Math.exp(-t / 0.05) * thup(t));
  },
  // A bulb smashed: a sharp crack, glass tinkling down, a fizz, and a dull thump under it. (Eric loves it: kept.)
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
  // The void's pulse in the dark (the test's countdown): a low heartbeat, lub-dub, felt more than heard.
  tick: (rate) => {
    const beat = (at: number, level: number) => {
      const body = osc(rate, (t) => 44 + 34 * Math.exp(-Math.max(0, t - at) / 0.025), sine);
      const thud = murk(rate, 220, 171 + at * 100);
      return (t: number) => (t < at ? (body(t), 0) : level * Math.exp(-(t - at) / 0.07) * (body(t) + 0.8 * thud(t) * Math.exp(-(t - at) / 0.02)));
    };
    const lub = beat(0, 1);
    const dub = beat(0.18, 0.65);
    return render(rate, 0.42, (t) => Math.min(1, t / 0.008) * (lub(t) + dub(t)));
  },
  // A piece found: a low swell giving way, two dark tones a minor third apart, rising a little, and a breath.
  found: (rate) => {
    const a = osc(rate, (t) => 98 + 6 * Math.min(1, t / 0.4), sine);
    const b = osc(rate, (t) => 116.5 + 7 * Math.min(1, t / 0.4), sine);
    const breath = bandpass(rate, (t) => 300 + 200 * Math.min(1, t / 0.4), 1.4, murk(rate, 700, 173));
    return render(rate, 0.55, (t) => {
      const env = Math.min(1, t / 0.08) * Math.max(0, 1 - t / 0.55) ** 1.5;
      return env * (0.8 * a(t) + 0.6 * b(t) + 0.9 * breath(t));
    });
  },
  // A miss: a dull, low thud that sinks into a short growl.
  miss: (rate) => {
    const body = osc(rate, (t) => 82 - 36 * Math.min(1, t / 0.3), sine);
    const growl = murk(rate, 240, 177);
    const rough = lowpass(rate, 30, noise(179));
    return render(rate, 0.34, (t) => Math.min(1, t / 0.008) * Math.exp(-t / 0.12) * (body(t) * (1 + 3 * rough(t)) + 1.8 * growl(t)));
  },
  // The lights coming back: a deep swell rising out of the dark (two low tones a minor third apart, a breath opening
  // up), no plinks.
  relight: (rate) => {
    const a = osc(rate, (t) => 46 + 12 * Math.min(1, t / 0.9), sine);
    const b = osc(rate, (t) => 54.7 + 14 * Math.min(1, t / 0.9), sine);
    const breath = bandpass(rate, (t) => 150 + 380 * Math.min(1, t / 0.9), 1.2, murk(rate, 700, 167));
    return render(rate, 1.1, (t) => {
      const env = Math.sin(Math.PI * Math.min(1, t / 1.1)) ** 1.2;
      return env * (0.8 * a(t) + 0.7 * b(t) + 1.1 * breath(t));
    });
  },
  // His strand knocking on its wire: two dull, muffled clacks.
  clink: (rate) => {
    const knock = (at: number) => {
      const body = osc(rate, (t) => 170 - 50 * Math.min(1, Math.max(0, t - at) / 0.04), sine);
      const tap = murk(rate, 600, 181 + at * 1000);
      return (t: number) => (t < at ? (body(t), tap(t), 0) : Math.exp(-(t - at) / 0.025) * (body(t) + 1.5 * tap(t)));
    };
    const a = knock(0);
    const b = knock(0.08);
    return render(rate, 0.22, (t) => a(t) + 0.8 * b(t));
  },
  // A lash of his strand (his attack on a king): a low whoosh sinking as it swings, a dull snap as it lands, and the
  // wire's dull rattle. No crack of a whip, nothing bright.
  lash: (rate) => {
    const whoosh = bandpass(rate, (t) => 620 - 470 * Math.min(1, t / 0.11), 1.4, murk(rate, 1100, 191));
    const snap = osc(rate, (t) => 60 + 70 * Math.exp(-Math.max(0, t - 0.085) / 0.025), sine);
    const thud = murk(rate, 260, 193);
    const r = rng(197);
    const rattle = grains(Array.from({ length: 5 }, () => 0.09 + r() * 0.08), (age) => Math.exp(-age / 0.012));
    const wire = lowpass(rate, 500, lowpass(rate, 800, noise(199)));
    return render(rate, 0.26, (t) => {
      const swing = Math.min(1, t / 0.05) * Math.max(0, 1 - t / 0.1) ** 1.2;
      const hit = t < 0.085 ? 0 : Math.exp(-(t - 0.085) / 0.05);
      return 1.6 * swing * whoosh(t) + hit * (0.9 * snap(t) + 1.4 * thud(t)) + 1.2 * wire(t) * Math.min(1, rattle(t));
    });
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<HollowSound, number> = { hum: 0.095, cast: 0.22, whisper: 0.75, pop: 0.32, smash: 0.26, tick: 0.255, found: 0.21, miss: 0.185, relight: 0.116, clink: 0.25, lash: 0.22 };

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
