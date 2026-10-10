/**
 * Big Boy's sounds, synthesised (no files, no licences, no real voice): baby noises made from a little buzzing voice
 * shaped into vowels (a giggle, a wail, a "nom"), a lollipop slurp, the bounce's boing and the big crash, and his toys
 * (a toy block thrown and clacking down, puffing away; the lollipop's swish and bonk; a stomp). Nothing bright: no
 * chimes, no dings (the toy block's clack is a light wooden tok, the bonk's squeak a soft rubber one: baby toys). Each
 * is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays quieter than a
 * piece's move (peak and loudness).
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, type Voice } from "./synth.ts";

export type BigBoySound = "giggle" | "slurp" | "wail" | "boing" | "crash" | "nom" | "toss" | "clack" | "swish" | "bonk" | "stomp" | "poof";

/** Noise with its highs rolled off twice: a soft rumble or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/**
 * A little baby voice: a soft buzz at `pitch(t)` shaped by two formants (`f1(t)`, `f2(t)`: the vowel), a breath of
 * air on top. Its level is the caller's envelope.
 */
function babble(rate: number, pitch: (t: number) => number, f1: (t: number) => number, f2: (t: number) => number, seed: number, breath = 0.25): Voice {
  // A rounded pulse (a saw through a low-pass): rich enough for formants, never buzzy.
  const buzz = lowpass(rate, 2200, osc(rate, pitch, (p) => 1 - 2 * p));
  const air = noise(seed);
  let src = 0;
  const v1 = bandpass(rate, f1, 4, () => src);
  const v2 = bandpass(rate, f2, 6, () => src);
  return (t) => {
    src = buzz(t) + breath * air(t);
    return v1(t) + 0.55 * v2(t);
  };
}

/** A wooden tok: a hollow block knocked (two modes ringing down fast) with a tap of noise. */
function tok(rate: number, at: number, f: number, decay: number, seed: number): Voice {
  const tap = bandpass(rate, () => f * 1.6, 2, noise(seed));
  const life = decay * 9 + 0.01;
  return (t) => {
    const age = t - at;
    // (Silent before it's struck and once rung out: a crash's handful stays quick to make.)
    if (age < 0 || age > life) return 0;
    const n = tap(t);
    const e = Math.exp(-age / decay);
    return e * (Math.sin(2 * Math.PI * f * age) + 0.35 * Math.sin(2 * Math.PI * f * 2.43 * age)) + 1.2 * Math.exp(-age / 0.006) * n;
  };
}

const SOUNDS: Record<BigBoySound, (rate: number) => Float32Array> = {
  // A giggle: five quick "heh"s, each with its breath, the pitch tumbling down.
  giggle: (rate) => {
    const syl = [0, 0.13, 0.25, 0.36, 0.47];
    const pitch = (t: number) => 560 - 160 * Math.min(1, t / 0.6) + 18 * Math.sin(2 * Math.PI * 7 * t);
    const v = babble(rate, pitch, () => 650, () => 2100, 211, 0.6);
    return render(rate, 0.62, (t) => {
      let env = 0;
      for (const [i, t0] of syl.entries()) {
        const a = t - t0;
        if (a >= 0 && a < 0.1) env = Math.max(env, (1 - 0.12 * i) * Math.sin((Math.PI * a) / 0.1) ** 0.8);
      }
      return env * v(t);
    });
  },
  // A slurp of the lollipop: a wet, bubbly suck rising in pitch, then the lips smack.
  slurp: (rate) => {
    const wet = bandpass(rate, (t) => 450 + 1300 * Math.min(1, t / 0.28), 3, murk(rate, 3000, 223));
    const smack = osc(rate, (t) => 900 * Math.exp(-Math.max(0, t - 0.32) / 0.02) + 260, sine);
    return render(rate, 0.42, (t) => {
      const suck = t < 0.3 ? Math.sin((Math.PI * t) / 0.3) * (0.65 + 0.35 * Math.sin(2 * Math.PI * 28 * t)) : 0;
      const pop = t >= 0.32 ? Math.exp(-(t - 0.32) / 0.018) : 0;
      return 1.8 * suck * wet(t) + 0.7 * pop * smack(t);
    });
  },
  // A wail: "waaah", climbing then sinking, wobbling, the mouth opening from the "w" into the "ah".
  wail: (rate) => {
    const pitch = (t: number) => (t < 0.25 ? 420 + 150 * (t / 0.25) : 570 - 190 * Math.min(1, (t - 0.25) / 0.6)) * (1 + 0.035 * Math.sin(2 * Math.PI * 6 * t));
    const open = (t: number) => Math.min(1, t / 0.14);
    const v = babble(rate, pitch, (t) => 380 + 620 * open(t), (t) => 820 + 700 * open(t), 227, 0.35);
    return render(rate, 0.9, (t) => Math.min(1, t / 0.06) * Math.max(0, 1 - t / 0.9) ** 0.7 * v(t));
  },
  // A bounce: a soft thump as he lands and a rubbery boing, its spring wobbling out.
  boing: (rate) => {
    const thump = osc(rate, (t) => 60 + 90 * Math.exp(-t / 0.03), sine);
    const spring = osc(rate, (t) => 150 + 70 * Math.exp(-t / 0.12) + 22 * Math.exp(-t / 0.2) * Math.sin(2 * Math.PI * 17 * t), (p) => sine(p) + 0.25 * sine(2 * p));
    return render(rate, 0.42, (t) => 1.1 * Math.exp(-t / 0.06) * thump(t) + 0.9 * Math.min(1, t / 0.01) * Math.exp(-t / 0.14) * spring(t));
  },
  // The big crash: a deep thud, a rumble of dust, and toy blocks tumbling about after it.
  crash: (rate) => {
    const thud = osc(rate, (t) => 34 + 50 * Math.exp(-t / 0.06), sine);
    const rumble = murk(rate, 700, 229);
    const r = rng(233);
    const toks = Array.from({ length: 6 }, (_, i) => tok(rate, 0.12 + i * 0.08 + r() * 0.05, 520 + r() * 380, 0.03, 239 + i));
    return render(rate, 1.0, (t) => {
      const boom = Math.min(1, t / 0.004) * Math.exp(-t / 0.3) * thud(t);
      const dust = Math.min(1, t / 0.01) * Math.exp(-t / 0.35) * rumble(t);
      return 1.3 * boom + 2.2 * dust + 0.22 * toks.reduce((s, k) => s + k(t), 0);
    });
  },
  // A "nom": a hummed "n", an "o", closing on an "m".
  nom: (rate) => {
    const pitch = (t: number) => 380 - 70 * Math.min(1, t / 0.24);
    const open = (t: number) => (t < 0.05 ? 0 : t < 0.09 ? (t - 0.05) / 0.04 : t < 0.17 ? 1 : t < 0.21 ? 1 - (t - 0.17) / 0.04 : 0);
    const v = babble(rate, pitch, (t) => 300 + 300 * open(t), (t) => 900 + 300 * open(t), 241, 0.1);
    const hum = lowpass(rate, 420, osc(rate, pitch, sine));
    return render(rate, 0.26, (t) => {
      const env = Math.min(1, t / 0.02) * Math.max(0, 1 - Math.max(0, t - 0.2) / 0.06);
      return env * (open(t) * v(t) * 1.4 + (1 - open(t)) * 0.8 * hum(t));
    });
  },
  // A toy block thrown: a soft whoosh of air past.
  toss: (rate) => {
    const air = bandpass(rate, (t) => 500 + 1100 * Math.sin(Math.PI * Math.min(1, t / 0.3)), 1.4, murk(rate, 4000, 251));
    return render(rate, 0.3, (t) => Math.sin(Math.PI * Math.min(1, t / 0.3)) ** 1.5 * 2.2 * air(t));
  },
  // A toy block landing: a light wooden tok, a little bounce, a tiny rattle.
  clack: (rate) => {
    const a = tok(rate, 0, 760, 0.035, 257);
    const b = tok(rate, 0.11, 790, 0.025, 263);
    const c = tok(rate, 0.19, 820, 0.015, 269);
    return render(rate, 0.32, (t) => a(t) + 0.45 * b(t) + 0.2 * c(t));
  },
  // The lollipop swung: a quick swish.
  swish: (rate) => {
    const air = bandpass(rate, (t) => 900 + 1400 * Math.min(1, t / 0.16), 1.8, murk(rate, 5000, 271));
    return render(rate, 0.2, (t) => Math.sin(Math.PI * Math.min(1, t / 0.2)) ** 1.2 * 2.4 * air(t));
  },
  // The lollipop bonks the ground: a rubbery bonk and a soft squeak, like a squeaky toy hammer.
  bonk: (rate) => {
    const body = osc(rate, (t) => 120 + 200 * Math.exp(-t / 0.025), (p) => sine(p) + 0.2 * sine(3 * p));
    const squeak = osc(rate, (t) => 1050 + 250 * Math.min(1, Math.max(0, t - 0.03) / 0.06), sine);
    return render(rate, 0.26, (t) => {
      const sq = t > 0.03 && t < 0.13 ? Math.sin((Math.PI * (t - 0.03)) / 0.1) : 0;
      return 1.1 * Math.exp(-t / 0.07) * body(t) + 0.18 * sq * squeak(t);
    });
  },
  // A stomp of a little bare foot: a soft, low thump.
  stomp: (rate) => {
    const thump = osc(rate, (t) => 55 + 60 * Math.exp(-t / 0.025), sine);
    const pat = murk(rate, 500, 277);
    return render(rate, 0.18, (t) => Math.exp(-t / 0.05) * (thump(t) + 1.2 * pat(t)));
  },
  // The toy block goes: a soft puff of dust.
  poof: (rate) => {
    const puff = bandpass(rate, (t) => 700 - 350 * Math.min(1, t / 0.3), 1.2, murk(rate, 2500, 281));
    return render(rate, 0.32, (t) => Math.min(1, t / 0.02) * Math.exp(-t / 0.1) * 2.6 * puff(t));
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<BigBoySound, number> = { giggle: 0.117, slurp: 0.323, wail: 0.097, boing: 0.2, crash: 0.164, nom: 0.081, toss: 0.225, clack: 0.375, swish: 0.148, bonk: 0.213, stomp: 0.248, poof: 0.541 };

const cache = new Map<string, Float32Array>();
/** The samples for one of his sounds at a sample rate (made once, then reused). Each is 2.8 to 4.2 dB under a move's mean, peaks under half a move's. */
export function bigBoySound(name: BigBoySound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const BIGBOY_SOUNDS = Object.keys(SOUNDS) as BigBoySound[];
