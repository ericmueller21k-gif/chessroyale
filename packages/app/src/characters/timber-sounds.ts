/**
 * Timber's sounds, synthesized (no files, no licenses, no real voice): a beaver builder's, all wood (Eric, Nov 2: "a gnawing
 * wood sound… Wood knocking, cutting, saw, thumping"). His teeth gnawing wood (a rasp of incisors and chips flying), a big
 * chomp, his teeth clacking; a knuckle's knock, a paw's pat on his hard hat, his hammer's tap and its whack, a hand saw's
 * strokes (by hand: Sawyer owns the motor saw), a heavy plank's thump, planks clattering down, his flat tail slapping the
 * boards, a plank swung and slid out of its strap; and his little beaver voice (a happy chitter, a gruff "oof", a proud
 * "hup!", a burp of sawdust). Nothing bright: no chimes, no dings (every knock rings down fast, the rasps are filtered).
 * Each is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays quieter
 * than a piece's move (peak and loudness).
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, type Voice, soundCache } from "./synth.ts";

export type TimberSound =
  | "gnaw"
  | "chomp"
  | "clack"
  | "knock"
  | "pat"
  | "tap"
  | "whack"
  | "saw"
  | "thump"
  | "clatter"
  | "slap"
  | "swoosh"
  | "slide"
  | "chitter"
  | "oof"
  | "hup"
  | "burp";

/** Noise with its highs rolled off twice: a soft rumble or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/**
 * Wood struck at `at`: a few of a board's modes (`modes`, Hz, inharmonic) ringing down fast (`decay` s), a tap of noise
 * on top (the strike itself). Silent before it's struck and once rung out.
 */
function wood(rate: number, at: number, modes: readonly number[], decay: number, seed: number, tapLevel = 1.1): Voice {
  const tap = bandpass(rate, () => modes[0]! * 2.4, 1.5, noise(seed));
  const life = decay * 9 + 0.02;
  return (t) => {
    const age = t - at;
    // (Silent before it's struck and once rung out: a clatter's handful stays quick to make.)
    if (age < 0 || age > life) return 0;
    let body = 0;
    for (let i = 0; i < modes.length; i++) body += (Math.exp((-age * (1 + 0.6 * i)) / decay) * Math.sin(2 * Math.PI * modes[i]! * age)) / (1 + i);
    return body + tapLevel * Math.exp(-age / 0.005) * tap(t);
  };
}

/** The sum of a handful of voices. */
const mix = (vs: readonly Voice[]): Voice => (t) => vs.reduce((s, v) => s + v(t), 0);

/**
 * Teeth on wood: a rasp of noise around `centre(t)` Hz that catches on the grain `grain(t)` times a second (a ratchet,
 * not a hiss). Its level is the caller's envelope.
 */
function rasp(rate: number, centre: (t: number) => number, grain: (t: number) => number, seed: number, q = 2.4): Voice {
  const band = bandpass(rate, centre, q, murk(rate, 4200, seed));
  const catches = osc(rate, grain, (p) => (1 - p) ** 3);
  return (t) => (0.3 + 0.7 * catches(t)) * band(t);
}

/**
 * His little voice: a soft, rounded buzz at `pitch(t)` through two formants (`f1`, `f2`: the vowel), a breath on top,
 * `grit` roughening it (a creak, for the burp). Its level is the caller's envelope.
 */
function voice(rate: number, pitch: (t: number) => number, f1: (t: number) => number, f2: (t: number) => number, seed: number, breath = 0.3, grit = 0): Voice {
  const buzz = lowpass(rate, 1800, osc(rate, pitch, (p) => 1 - 2 * p));
  const creak = osc(rate, (t) => pitch(t) / 2, (p) => (p < 0.5 ? 1 : 1 - grit));
  const air = noise(seed);
  let src = 0;
  const v1 = bandpass(rate, f1, 4, () => src);
  const v2 = bandpass(rate, f2, 6, () => src);
  return (t) => {
    src = buzz(t) * creak(t) + breath * air(t);
    return v1(t) + 0.5 * v2(t);
  };
}

/**
 * A smooth bump from 0 up to 1 and back over `len` seconds from `at` (0 outside it). Never below 0: at its last sample rounding can
 * put the sine a hair under 0, and a fractional power of that is NaN (Timber's chitter at 48 kHz, Nov 3: one NaN sample broke the
 * sound's filter for good, on Eric's iPhone and his computer).
 */
const bump = (t: number, at: number, len: number, power = 1) => (t < at || t > at + len ? 0 : Math.max(0, Math.sin((Math.PI * (t - at)) / len)) ** power);

const SOUNDS: Record<TimberSound, (rate: number) => Float32Array> = {
  // The gnaw (his select sound): his buck teeth rasping at a log, stroke after stroke, each catching on the grain, the log's
  // hollow body under them and little chips flicking off.
  gnaw: (rate) => {
    const strokes = 9;
    const len = 0.082;
    const teeth = rasp(rate, (t) => 1500 + 400 * Math.sin((Math.PI * t) / len), (t) => 95 + 40 * Math.sin(2 * Math.PI * 6 * t), 401);
    const log = bandpass(rate, () => 420, 3, murk(rate, 1500, 409));
    const r = rng(419);
    const chips = Array.from({ length: 7 }, (_, i) => wood(rate, 0.06 + i * 0.1 + r() * 0.05, [900 + r() * 700, 2300 + r() * 400], 0.008, 421 + i, 0.6));
    return render(rate, 0.86, (t) => {
      let env = 0;
      for (let i = 0; i < strokes; i++) env = Math.max(env, (i % 2 ? 0.75 : 1) * bump(t, i * len, len * 0.92, 0.7));
      const fade = Math.min(1, t / 0.04) * Math.max(0, 1 - Math.max(0, t - 0.66) / 0.2);
      return fade * (env * (2.4 * teeth(t) + 1.3 * log(t)) + 0.35 * chips.reduce((s, c) => s + c(t), 0));
    });
  },
  // One big chomp into the wood: his teeth meeting through it (a crunch), the wood cracking, splinters after.
  chomp: (rate) => {
    const crunch = bandpass(rate, (t) => 1300 - 500 * Math.min(1, t / 0.08), 1.6, noise(431));
    const crack = wood(rate, 0.012, [190, 470], 0.04, 433);
    const r = rng(439);
    const bits = Array.from({ length: 3 }, (_, i) => wood(rate, 0.07 + i * 0.05 + r() * 0.03, [700 + r() * 500], 0.01, 443 + i, 0.5));
    return render(rate, 0.3, (t) => {
      const grain = 0.55 + 0.45 * Math.sin(2 * Math.PI * 70 * t) ** 2;
      return 1.8 * Math.exp(-t / 0.03) * grain * crunch(t) + crack(t) + 0.35 * bits.reduce((s, b) => s + b(t), 0);
    });
  },
  // His teeth clacked together: two quick little clicks.
  clack: (rate) => {
    const a = wood(rate, 0, [1100, 2650], 0.009, 449, 0.7);
    const b = wood(rate, 0.055, [1180, 2800], 0.007, 457, 0.6);
    return render(rate, 0.16, (t) => a(t) + 0.7 * b(t));
  },
  // A knuckle's knock-knock on a board: two hollow knocks.
  knock: (rate) => {
    const a = wood(rate, 0, [230, 545, 1010], 0.03, 461);
    const b = wood(rate, 0.14, [236, 560, 1030], 0.028, 463);
    return render(rate, 0.36, (t) => a(t) + 0.85 * b(t));
  },
  // A paw's pat on his hard hat: a soft, muffled knock.
  pat: (rate) => {
    const body = wood(rate, 0, [170, 410], 0.022, 467, 0.4);
    const paw = murk(rate, 900, 479);
    return render(rate, 0.16, (t) => body(t) + 1.4 * Math.exp(-t / 0.015) * paw(t));
  },
  // His hammer tapping a peg in: a sharp wooden tok and a little bounce.
  tap: (rate) => {
    const a = wood(rate, 0, [520, 1240], 0.032, 487);
    const b = wood(rate, 0.065, [540, 1290], 0.016, 491, 0.6);
    return render(rate, 0.22, (t) => a(t) + 0.3 * b(t));
  },
  // A big hammer whack into wood: a deep thud, the wood's crack, chips flying off after it.
  whack: (rate) => {
    const thud = osc(rate, (t) => 80 + 90 * Math.exp(-t / 0.02), sine);
    const board = wood(rate, 0.003, [240, 610, 1150], 0.06, 499, 1.4);
    const r = rng(503);
    const chips = Array.from({ length: 5 }, (_, i) => wood(rate, 0.06 + i * 0.045 + r() * 0.03, [800 + r() * 700], 0.009, 509 + i, 0.5));
    return render(rate, 0.42, (t) => 1.1 * Math.exp(-t / 0.05) * thud(t) + board(t) + 0.4 * chips.reduce((s, c) => s + c(t), 0));
  },
  // A hand saw: three strokes through a board, the push biting harder than the pull, its teeth's rasp quickening with the
  // stroke's speed, the board humming under it. (By hand: no motor, Sawyer's.)
  saw: (rate) => {
    const stroke = 0.3;
    // How fast the blade moves (0 at each end of a stroke): its teeth catch the grain faster as it moves faster.
    const speed = (t: number) => Math.abs(Math.sin((Math.PI * t) / stroke));
    const teeth = rasp(rate, (t) => 1150 + 450 * speed(t), (t) => 40 + 160 * speed(t), 521, 2);
    const board = bandpass(rate, () => 330, 4, murk(rate, 1200, 523));
    return render(rate, 0.92, (t) => {
      const n = Math.floor(t / stroke);
      const push = n % 2 === 0 ? 1 : 0.6;
      const env = n < 3 ? push * speed(t) ** 0.6 : 0;
      return env * (2.6 * teeth(t) + 1.2 * board(t));
    });
  },
  // A heavy plank set down hard (or a beaver landing on the boards): a deep, wooden thump.
  thump: (rate) => {
    const low = osc(rate, (t) => 58 + 70 * Math.exp(-t / 0.03), sine);
    const board = wood(rate, 0.002, [128, 300], 0.05, 541, 0.6);
    const dust = murk(rate, 600, 547);
    return render(rate, 0.36, (t) => 1.1 * Math.exp(-t / 0.07) * low(t) + 0.8 * board(t) + 0.9 * Math.exp(-t / 0.06) * dust(t));
  },
  // Planks and tools spilling: a run of knocks of every size, tumbling and settling.
  clatter: (rate) => {
    const r = rng(557);
    const at = [0, 0.07, 0.12, 0.2, 0.26, 0.35, 0.43, 0.55];
    const knocks = at.map((a, i) => wood(rate, a + r() * 0.02, [180 + r() * 380, 520 + r() * 600], 0.025 + r() * 0.02, 563 + i));
    return render(rate, 0.72, (t) => knocks.reduce((s, k, i) => s + (1 - 0.08 * i) * k(t), 0));
  },
  // His flat tail slapping the boards: a broad, flat smack and the board's thud under it.
  slap: (rate) => {
    const smack = bandpass(rate, () => 900, 0.9, lowpass(rate, 3200, noise(571)));
    const board = wood(rate, 0.004, [120, 290], 0.045, 577, 0.4);
    return render(rate, 0.26, (t) => 2.4 * Math.exp(-t / 0.012) * smack(t) + 0.9 * board(t));
  },
  // A plank (or his hammer) swung through the air: a broad, low whoosh.
  swoosh: (rate) => {
    const air = bandpass(rate, (t) => 380 + 700 * Math.sin(Math.PI * Math.min(1, t / 0.26)), 1.3, murk(rate, 3200, 587));
    return render(rate, 0.26, (t) => bump(t, 0, 0.26, 1.4) * 2.6 * air(t));
  },
  // A plank slid up out of its strap: a short, grainy scrape of wood, rising.
  slide: (rate) => {
    const scrape = rasp(rate, (t) => 600 + 500 * Math.min(1, t / 0.2), () => 55, 593, 2.2);
    return render(rate, 0.22, (t) => bump(t, 0, 0.22, 0.8) * 2.4 * scrape(t));
  },
  // His happy chitter: a quick run of little squeaky "chk"s, tumbling down.
  chitter: (rate) => {
    const syl = [0, 0.07, 0.14, 0.21, 0.28, 0.36];
    const pitch = (t: number) => 760 - 200 * Math.min(1, t / 0.45) + 40 * Math.sin(2 * Math.PI * 14 * t);
    const v = voice(rate, pitch, () => 800, () => 1900, 601, 0.5);
    return render(rate, 0.46, (t) => {
      let env = 0;
      for (const [i, t0] of syl.entries()) env = Math.max(env, (1 - 0.1 * i) * bump(t, t0, 0.055, 0.7));
      return env * v(t);
    });
  },
  // A gruff "oof": short, low, falling, a puff of breath.
  oof: (rate) => {
    const pitch = (t: number) => 250 - 90 * Math.min(1, t / 0.18);
    const v = voice(rate, pitch, () => 480, () => 1050, 607, 0.5);
    return render(rate, 0.22, (t) => Math.min(1, t / 0.012) * Math.max(0, 1 - t / 0.22) ** 1.3 * v(t));
  },
  // A proud "hup!": short and rising, as he shows a plank off overhead.
  hup: (rate) => {
    const pitch = (t: number) => 300 + 140 * Math.min(1, t / 0.12);
    const open = (t: number) => Math.min(1, t / 0.06);
    const v = voice(rate, pitch, (t) => 420 + 280 * open(t), (t) => 1000 + 300 * open(t), 613, 0.35);
    return render(rate, 0.2, (t) => Math.min(1, t / 0.015) * (t < 0.12 ? 1 : Math.max(0, 1 - (t - 0.12) / 0.08)) * v(t));
  },
  // A little burp of sawdust: a low, creaky "brp" and a puff of dust.
  burp: (rate) => {
    const v = voice(rate, (t) => 125 - 25 * Math.min(1, t / 0.25), () => 520, () => 1150, 617, 0.2, 0.7);
    const puff = bandpass(rate, (t) => 800 - 350 * Math.min(1, t / 0.3), 1.2, murk(rate, 2500, 619));
    return render(rate, 0.36, (t) => bump(t, 0, 0.24, 0.6) * 1.2 * v(t) + Math.min(1, Math.max(0, t - 0.14) / 0.02) * Math.exp(-Math.max(0, t - 0.14) / 0.07) * 1.6 * puff(t));
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do (about 4 dB under its mean, as Big Boy's and Sawyer's); a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<TimberSound, number> = {
  gnaw: 0.281,
  chomp: 0.301,
  clack: 0.552,
  knock: 0.326,
  pat: 0.363,
  tap: 0.336,
  whack: 0.243,
  saw: 0.251,
  thump: 0.207,
  clatter: 0.248,
  slap: 0.315,
  swoosh: 0.247,
  slide: 0.368,
  chitter: 0.0894,
  oof: 0.141,
  hup: 0.0929,
  burp: 0.233,
};

const cache = soundCache("timber");
/** The samples for one of his sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function timberSound(name: TimberSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const TIMBER_SOUNDS = Object.keys(SOUNDS) as TimberSound[];

