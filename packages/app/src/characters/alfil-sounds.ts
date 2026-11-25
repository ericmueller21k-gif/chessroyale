/**
 * Alfil's sounds, synthesized (no files, no licenses), as the other bosses' are: a mammoth's trumpet (a short one, and
 * the big one on his Slam's leap), the ground-shaking thud as he lands it, the grinding crunch of two pawns fusing, a
 * whoosh (his ankus swung, the pieces flying up), a snort, a low rumble as he comes on, a stomp, the ankus clattering
 * down, an oof, a heavy landing, a soft glow as his pawns light up, the ankus's jab, and a soft thump as each of the
 * Slam's pieces lands. Each is a pure function of the sample rate (its noise is seeded), so a test can measure it: every
 * one stays quieter than a piece's move (peak and loudness).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, type Voice, soundCache } from "./synth.ts";

export type AlfilSound = "trumpet" | "leap" | "thud" | "crunch" | "whoosh" | "snort" | "rumble" | "stomp" | "clatter" | "oof" | "land" | "glow" | "jab" | "thump";

/** Noise with its highs rolled off twice: a soft rumble or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/**
 * A trunk's trumpet: a brassy, buzzing reed (a saw wave) whose pitch follows `pitch(t)`, shaped by the trunk (two
 * resonances), rough with a growl and a little breath. Its level is the caller's envelope.
 */
function trumpet(rate: number, pitch: (t: number) => number, seed: number): Voice {
  const reed = osc(rate, pitch, saw);
  const growl = osc(rate, () => 31, sine);
  const breath = murk(rate, 2600, seed);
  // (The reed is read once a sample; both resonances filter that one value.)
  let x = 0;
  const now: Voice = () => x;
  const horn = bandpass(rate, () => 1150, 1.4, now);
  const mid = bandpass(rate, () => 520, 1.2, lowpass(rate, 2400, now));
  return (t) => {
    x = reed(t);
    const g = 0.75 + 0.25 * growl(t);
    return g * (0.8 * horn(t) + 0.6 * mid(t)) + 0.35 * breath(t);
  };
}

/** A thump in the ground: a low sine dropping in pitch, ringing down over `decay`, with a puff of low noise. */
function thump(rate: number, from: number, to: number, decay: number, seed: number, dirt = 1): Voice {
  const body = osc(rate, (t) => to + (from - to) * Math.exp(-t / 0.03), sine);
  const dust = murk(rate, 500, seed);
  return (t) => Math.exp(-t / decay) * (body(t) + dirt * 1.4 * dust(t));
}

/** A knock on metal: a few inharmonic partials ringing down fast, a click of noise on top. */
function clink(rate: number, at: number, f: number, decay: number, seed: number): Voice {
  const tap = bandpass(rate, () => f * 1.6, 2, noise(seed));
  const life = decay * 8 + 0.02;
  return (t) => {
    const age = t - at;
    if (age < 0 || age > life) return 0;
    const e = Math.exp(-age / decay);
    return e * (Math.sin(2 * Math.PI * f * age) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * age) + 0.25 * Math.sin(2 * Math.PI * f * 5.4 * age)) + 0.8 * Math.exp(-age / 0.004) * tap(t);
  };
}

const SOUNDS: Record<AlfilSound, (rate: number) => Float32Array> = {
  // A short trumpet: the trunk's blast up, a wobble, and off.
  trumpet: (rate) => {
    const v = trumpet(rate, (t) => 380 + 260 * Math.min(1, t / 0.07) + 22 * Math.sin(2 * Math.PI * 9 * t) - 120 * Math.max(0, t - 0.38) / 0.17, 401);
    return render(rate, 0.55, (t) => Math.min(1, t / 0.04) * (t < 0.36 ? 1 : Math.max(0, 1 - (t - 0.36) / 0.19)) * v(t));
  },
  // The big one, as he leaps for the Slam: longer, climbing, rougher.
  leap: (rate) => {
    const v = trumpet(rate, (t) => 300 + 520 * Math.min(1, t / 0.32) + 30 * Math.sin(2 * Math.PI * 7 * t) - 160 * Math.max(0, t - 0.7) / 0.2, 409);
    return render(rate, 0.9, (t) => Math.min(1, t / 0.06) * (t < 0.66 ? 1 : Math.max(0, 1 - (t - 0.66) / 0.24)) * v(t));
  },
  // The Slam landing: a ground-shaking thud, the floor still rumbling after it.
  thud: (rate) => {
    const hit = thump(rate, 90, 34, 0.22, 419, 1.2);
    const after = murk(rate, 140, 421);
    return render(rate, 0.7, (t) => 1.5 * hit(t) + 2.2 * Math.exp(-t / 0.3) * after(t));
  },
  // Two pawns fusing: a grinding crunch, stone on stone, in uneven bites.
  crunch: (rate) => {
    const r = rng(431);
    const bites = Array.from({ length: 48 }, () => 0.25 + 0.75 * r());
    const grind = bandpass(rate, (t) => 700 + 300 * Math.sin(2 * Math.PI * 6 * t), 1.6, murk(rate, 3000, 433));
    const low = murk(rate, 260, 439);
    return render(rate, 0.46, (t) => {
      const bite = bites[Math.floor(t * 100) % 48]!;
      const env = Math.min(1, t / 0.02) * Math.max(0, 1 - Math.max(0, t - 0.32) / 0.14);
      return env * (2.6 * bite * grind(t) + 1.6 * low(t));
    });
  },
  // A whoosh of air: the ankus swung, the pieces flying up.
  whoosh: (rate) => {
    const air = bandpass(rate, (t) => 420 + 1200 * Math.min(1, t / 0.26), 1.5, murk(rate, 4000, 443));
    return render(rate, 0.3, (t) => Math.sin(Math.PI * Math.min(1, t / 0.3)) ** 1.4 * 2.6 * air(t));
  },
  // A snort: two short puffs out of the trunk.
  snort: (rate) => {
    const puff = bandpass(rate, () => 650, 1.3, murk(rate, 3000, 449));
    const env = (t: number) => (t < 0.12 ? Math.sin((Math.PI * t) / 0.12) : t > 0.17 && t < 0.33 ? 0.85 * Math.sin((Math.PI * (t - 0.17)) / 0.16) : 0);
    return render(rate, 0.35, (t) => env(t) * 2.8 * puff(t));
  },
  // A low rumble, as he comes on: the ground grumbling, swelling and fading.
  rumble: (rate) => {
    const v = murk(rate, 110, 457);
    const beat = osc(rate, () => 41, sine);
    return render(rate, 0.7, (t) => Math.sin(Math.PI * Math.min(1, t / 0.7)) * (3 * v(t) + 0.35 * beat(t)));
  },
  // A stomp: one heavy foot down.
  stomp: (rate) => {
    const v = thump(rate, 75, 42, 0.07, 461);
    return render(rate, 0.26, (t) => v(t));
  },
  // The ankus dropped: a gold staff clattering on the floor, a few knocks settling.
  clatter: (rate) => {
    const r = rng(467);
    const hits = [0, 0.09, 0.15, 0.24].map((at, i) => clink(rate, at + r() * 0.015, 380 + r() * 220 - i * 30, 0.035 - i * 0.004, 469 + i));
    return render(rate, 0.45, (t) => hits.reduce((s, h, i) => s + (1 - i * 0.2) * h(t), 0));
  },
  // An oof: a short, low grunt.
  oof: (rate) => {
    const v = lowpass(rate, 600, lowpass(rate, 900, osc(rate, (t) => 150 - 50 * Math.min(1, t / 0.2), saw)));
    const breath = murk(rate, 1200, 479);
    return render(rate, 0.24, (t) => Math.sin(Math.PI * Math.min(1, t / 0.24)) ** 0.7 * (1.4 * v(t) + 0.5 * breath(t)));
  },
  // A heavy landing (his hop down beside a king, his entrance's step): a thump with a skid of dust.
  land: (rate) => {
    const v = thump(rate, 85, 38, 0.1, 487);
    const skid = bandpass(rate, () => 480, 1.5, murk(rate, 2000, 491));
    return render(rate, 0.32, (t) => v(t) + (t < 0.18 ? Math.sin((Math.PI * t) / 0.18) * 0.9 * skid(t) : 0));
  },
  // His pawns lighting up: a soft, low shimmer, swelling and fading.
  glow: (rate) => {
    const a = osc(rate, () => 330, sine);
    const b = osc(rate, () => 495, sine);
    const c = osc(rate, () => 660, sine);
    const shimmer = osc(rate, () => 7, sine);
    return render(rate, 0.6, (t) => Math.sin(Math.PI * Math.min(1, t / 0.6)) * (0.75 + 0.25 * shimmer(t)) * (a(t) + 0.6 * b(t) + 0.3 * c(t)));
  },
  // The ankus jabbing a king: a quick poke, a dull clink.
  jab: (rate) => {
    const v = clink(rate, 0.004, 520, 0.03, 499);
    const air = bandpass(rate, () => 900, 1.5, murk(rate, 3000, 503));
    return render(rate, 0.16, (t) => v(t) + (t < 0.05 ? Math.sin((Math.PI * t) / 0.05) * 1.2 * air(t) : 0));
  },
  // One of the Slam's pieces landing back on the board: a soft thump.
  thump: (rate) => {
    const v = thump(rate, 120, 70, 0.04, 509, 0.6);
    return render(rate, 0.16, (t) => v(t));
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<AlfilSound, number> = {
  trumpet: 0.16,
  leap: 0.15,
  thud: 0.14,
  crunch: 0.17,
  whoosh: 0.19,
  snort: 0.2,
  rumble: 0.24,
  stomp: 0.22,
  clatter: 0.2,
  oof: 0.1,
  land: 0.22,
  glow: 0.09,
  jab: 0.2,
  thump: 0.2,
};

const cache = soundCache("alfil");
/** The samples for one of his sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function alfilSound(name: AlfilSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const ALFIL_SOUNDS = Object.keys(SOUNDS) as AlfilSound[];
