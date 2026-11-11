/**
 * Don Dough's sounds, synthesized (no files, no licenses, no real voice; docs/decisions/2026-11-11-don-dough.md), from the art's cue
 * list (scripts/boss-art/out/zebra-nov10.md on claude/boss-art, "Cues for the sound round"): a zebra kingpin with a bread rifle in a
 * bakery. The roll's little cork-like pop with a puff of flour (never a gunshot), a rattle of four for his volley; a crusty fwip as
 * he pulls it, a crust squeezed as he "cocks" it; his belly laugh, a chuckle, a "tsk-tsk", an "ehh, relax"; a hoof on a table, a
 * belly-flop thud, a hat brim's tick, an "oof", the roll snapping. His dough: a lob, a wet plop, the oven timer's fast tick-roll
 * and its ding, the swell and the oven's pop, a squishy splat. Gold Plate: the glaze stirred with a hum, a shimmer of chimes, a
 * bright shing, a chef's kiss, and the clink of a pawn bouncing off gold. Each is a pure function of the sample rate (its noise
 * is seeded), so a test measures it: every one stays quieter than a piece's move (peak and loudness), as the other bosses' do.
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, soundCache, type Voice } from "./synth.ts";

export type ZebraSound =
  | "pop"
  | "volley"
  | "laugh"
  | "chuckle"
  | "draw"
  | "cock"
  | "relax"
  | "tsk"
  | "tap"
  | "thud"
  | "tip"
  | "hm"
  | "oof"
  | "snap"
  | "lob"
  | "plop"
  | "roll"
  | "ding"
  | "rise"
  | "ovenPop"
  | "squash"
  | "stir"
  | "gild"
  | "shine"
  | "kiss"
  | "clink";

/** Noise with its highs rolled off twice: a soft breath or rumble, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** A smooth bump from 0 up to 1 and back over `len` seconds from `at` (0 outside it; never below 0: see dash-sounds.ts). */
const bump = (t: number, at: number, len: number, power = 1) => (t < at || t > at + len ? 0 : Math.max(0, Math.sin((Math.PI * (t - at)) / len)) ** power);

const mix = (vs: readonly Voice[]): Voice => (t) => vs.reduce((s, v) => s + v(t), 0);

/**
 * His voice: a deep, rounded buzz at `pitch(t)` through two formants (`f1`, `f2`: the vowel), a breath on top. Its level is the
 * caller's envelope.
 */
function voice(rate: number, pitch: (t: number) => number, f1: (t: number) => number, f2: (t: number) => number, seed: number, breath = 0.3): Voice {
  const buzz = lowpass(rate, 1800, osc(rate, pitch, (p) => 1 - 2 * p));
  const air = noise(seed);
  let src = 0;
  const v1 = bandpass(rate, f1, 4, () => src);
  const v2 = bandpass(rate, f2, 6, () => src);
  return (t) => {
    src = buzz(t) + breath * air(t);
    return v1(t) + 0.5 * v2(t);
  };
}

/** A cork-like pop at `at`: a short tonal knock dropping in pitch, a burst of floury air after it. Silent before it. */
function cork(rate: number, at: number, seed: number, pitch = 520): Voice {
  const knock = osc(rate, (t) => pitch * (0.7 + 0.6 * Math.exp(-(t - at) / 0.01)), sine);
  const puff = bandpass(rate, () => 900, 0.8, murk(rate, 4000, seed));
  return (t) => {
    const age = t - at;
    if (age < 0 || age > 0.25) return 0;
    return Math.min(1, age / 0.001) * (1.1 * Math.exp(-age / 0.012) * knock(t) + 1.6 * bump(age, 0.004, 0.16, 1.4) * puff(t));
  };
}

/** A small bell struck at `at`: a partial at `f` and a softer one above it, ringing out over `decay` s. */
function bell(rate: number, at: number, f: number, decay: number): Voice {
  const a = osc(rate, () => f, sine);
  const b = osc(rate, () => f * 2.76, sine);
  return (t) => {
    const age = t - at;
    if (age < 0) return 0;
    return Math.min(1, age / 0.002) * (Math.exp(-age / decay) * a(t) + 0.3 * Math.exp(-age / (decay * 0.35)) * b(t));
  };
}

/** One "hah" of his laugh at `at`: a deep syllable, open vowel, falling a little. */
function hah(rate: number, at: number, pitch: number, seed: number): Voice {
  const v = voice(rate, (t) => pitch - 30 * Math.min(1, Math.max(0, t - at) / 0.12), () => 700, () => 1150, seed, 0.5);
  return (t) => bump(t, at, 0.13, 0.7) * v(t);
}

const SOUNDS: Record<ZebraSound, (rate: number) => Float32Array> = {
  // The roll "fires": a little cork-like pop, a soft puff of flour and crumbs. Toy-like, never a gunshot.
  pop: (rate) => {
    const c = cork(rate, 0, 1301);
    return render(rate, 0.26, (t) => c(t));
  },
  // His volley (the God King's save): four quick soft pops in a rattle, the same voice as `pop`.
  volley: (rate) => {
    const pops = [0, 0.15, 0.3, 0.45].map((a, i) => cork(rate, a, 1307 + i, 500 + 40 * (i % 2)));
    return render(rate, 0.62, mix(pops));
  },
  // His big belly laugh, "hah-hah-hah-hah": deep and pleased with himself.
  laugh: (rate) => {
    const hs = [0, 0.16, 0.32, 0.48].map((a, i) => hah(rate, a, 150 - 6 * i, 1319 + i));
    return render(rate, 0.64, mix(hs));
  },
  // A short "heh-heh".
  chuckle: (rate) => {
    const hs = [0, 0.13].map((a, i) => {
      const v = voice(rate, () => 175 - 10 * i, () => 520, () => 1800, 1327 + i, 0.6);
      return (t: number) => bump(t, a, 0.1, 0.8) * v(t);
    });
    return render(rate, 0.26, mix(hs));
  },
  // The roll pulled fast: a crusty fwip of air, a little crackle of crust.
  draw: (rate) => {
    const air = bandpass(rate, (t) => 700 + 2200 * Math.min(1, t / 0.12), 1.2, murk(rate, 6000, 1331));
    const r = rng(1337);
    const cr: Voice[] = [];
    for (let i = 0; i < 6; i++) {
      const at = 0.02 + r() * 0.1;
      const crack = bandpass(rate, () => 2600 + r() * 1200, 3, noise(1339 + i));
      cr.push((t) => (t < at ? 0 : Math.exp(-(t - at) / 0.004) * crack(t)));
    }
    return render(rate, 0.18, (t) => bump(t, 0, 0.16, 1.2) * 2 * air(t) + 0.8 * cr.reduce((s, v) => s + v(t), 0));
  },
  // The crust squeezed as if cocking it: a dry crunch in two.
  cock: (rate) => {
    const crunch = bandpass(rate, () => 1500, 1.2, noise(1347));
    return render(rate, 0.22, (t) => (bump(t, 0, 0.07, 0.6) + 0.8 * bump(t, 0.1, 0.08, 0.6)) * 1.8 * crunch(t));
  },
  // "Ehh, relax": a calm, low grumble falling.
  relax: (rate) => {
    const v = voice(rate, (t) => 140 - 30 * Math.min(1, t / 0.5), (t) => 600 - 120 * Math.min(1, t / 0.5), () => 1300, 1349, 0.45);
    return render(rate, 0.56, (t) => bump(t, 0, 0.56, 0.6) * v(t));
  },
  // "Tsk-tsk": two dry tongue clicks.
  tsk: (rate) => {
    const k = (at: number, seed: number) => {
      const c = bandpass(rate, () => 3200, 2.5, noise(seed));
      return (t: number) => (t < at ? 0 : Math.exp(-(t - at) / 0.006) * c(t));
    };
    const a = k(0, 1361);
    const b = k(0.16, 1367);
    return render(rate, 0.24, (t) => 2.2 * (a(t) + b(t)));
  },
  // A hoof knocking a wooden table.
  tap: (rate) => {
    const knock = osc(rate, (t) => 240 + 160 * Math.exp(-t / 0.006), sine);
    const wood = bandpass(rate, () => 900, 2.2, noise(1373));
    return render(rate, 0.12, (t) => Math.min(1, t / 0.001) * (Math.exp(-t / 0.025) * knock(t) + 1.2 * Math.exp(-t / 0.012) * wood(t)));
  },
  // A belly-flop thud as he lands.
  thud: (rate) => {
    const low = osc(rate, (t) => 70 + 60 * Math.exp(-t / 0.03), sine);
    const flesh = murk(rate, 500, 1381);
    return render(rate, 0.3, (t) => Math.min(1, t / 0.002) * Math.exp(-t / 0.07) * (low(t) + 1.4 * flesh(t)));
  },
  // His hat brim's soft tick as he tips it.
  tip: (rate) => {
    const c = bandpass(rate, () => 2000, 2, noise(1399));
    return render(rate, 0.06, (t) => Math.exp(-t / 0.008) * 1.5 * c(t));
  },
  // A little "hm" as he points at the board.
  hm: (rate) => {
    const v = voice(rate, (t) => 165 + 15 * Math.min(1, t / 0.15), () => 300, () => 900, 1409, 0.2);
    return render(rate, 0.2, (t) => bump(t, 0, 0.2, 0.7) * v(t));
  },
  // An "oof" (hurt, beaten), short and falling.
  oof: (rate) => {
    const v = voice(rate, (t) => 190 - 70 * Math.min(1, t / 0.18), () => 480, () => 1000, 1423, 0.45);
    return render(rate, 0.22, (t) => Math.min(1, t / 0.01) * Math.max(0, 1 - t / 0.22) ** 1.3 * v(t));
  },
  // The roll snapping in two: a crusty crack.
  snap: (rate) => {
    const crack = bandpass(rate, () => 1900, 1.1, noise(1427));
    const body = bandpass(rate, () => 600, 1.6, noise(1429));
    return render(rate, 0.16, (t) => 2.2 * Math.exp(-t / 0.01) * crack(t) + 0.9 * Math.exp(-t / 0.03) * body(t));
  },
  // A lump of dough lobbed: a soft whup of air.
  lob: (rate) => {
    const air = bandpass(rate, (t) => 400 + 600 * Math.sin(Math.PI * Math.min(1, t / 0.18)), 1.3, murk(rate, 3000, 1433));
    return render(rate, 0.2, (t) => bump(t, 0, 0.2, 1.2) * 2.4 * air(t));
  },
  // The dough landing on the board: a wet, doughy plop.
  plop: (rate) => {
    const body = osc(rate, (t) => 180 + 220 * Math.exp(-t / 0.02), sine);
    const wet = bandpass(rate, (t) => 700 - 300 * Math.min(1, t / 0.05), 2, noise(1439));
    return render(rate, 0.16, (t) => Math.min(1, t / 0.002) * (Math.exp(-t / 0.04) * body(t) + 1.2 * Math.exp(-t / 0.02) * wet(t)));
  },
  // The oven timer's minute dropping: a quick trill of beeps falling (quiet: it plays every move).
  roll: (rate) => {
    const at = [0, 0.03, 0.06, 0.09, 0.12, 0.15];
    const beeps = at.map((a, i) => {
      const o = osc(rate, () => 2600 - 160 * i, (p) => (p < 0.5 ? 0.6 : -0.6));
      return (t: number) => (t < a || t > a + 0.022 ? 0 : bump(t, a, 0.022, 0.5) * o(t));
    });
    const all = lowpass(rate, 5000, mix(beeps));
    return render(rate, 0.2, all);
  },
  // The timer at 00:00: a kitchen timer's ding-ding, bright and short, not an alarm.
  ding: (rate) => {
    const a = bell(rate, 0, 1760, 0.12);
    const b = bell(rate, 0.18, 1760, 0.16);
    return render(rate, 0.6, (t) => a(t) + b(t));
  },
  // The dough swelling: a soft rising fwoomp.
  rise: (rate) => {
    const air = bandpass(rate, (t) => 200 + 500 * Math.min(1, t / 0.3), 1.4, murk(rate, 2000, 1447));
    const tone = osc(rate, (t) => 90 + 70 * Math.min(1, t / 0.3), sine);
    return render(rate, 0.36, (t) => bump(t, 0, 0.36, 0.8) * (2 * air(t) + 0.5 * tone(t)));
  },
  // The oven's light pop as the dough becomes his piece, a puff with it.
  ovenPop: (rate) => {
    const c = cork(rate, 0, 1451, 640);
    return render(rate, 0.26, (t) => c(t));
  },
  // A squishy splat as your piece squashes it, a flour puff.
  squash: (rate) => {
    const wet = bandpass(rate, (t) => 600 - 250 * Math.min(1, t / 0.08), 1.3, noise(1453));
    const low = osc(rate, (t) => 120 + 80 * Math.exp(-t / 0.02), sine);
    const puff = bandpass(rate, () => 1200, 0.8, murk(rate, 5000, 1459));
    return render(rate, 0.3, (t) => Math.min(1, t / 0.002) * (1.6 * Math.exp(-t / 0.05) * wet(t) + 0.6 * Math.exp(-t / 0.04) * low(t)) + bump(t, 0.03, 0.22, 1.2) * puff(t));
  },
  // Gold Plate's glaze stirred, with his pleased hum, "mm-mm-mmm".
  stir: (rate) => {
    const hum = voice(rate, (t) => 150 + 12 * Math.sin(2 * Math.PI * 1.6 * t) + (t > 0.4 ? 20 : 0), () => 280, () => 800, 1471, 0.15);
    const glaze = bandpass(rate, () => 500, 1.5, murk(rate, 1500, 1481));
    const env = (t: number) => bump(t, 0, 0.2, 0.6) + bump(t, 0.22, 0.2, 0.6) + bump(t, 0.44, 0.36, 0.6);
    return render(rate, 0.82, (t) => env(t) * hum(t) + 0.6 * bump(t, 0, 0.8, 0.5) * glaze(t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t)));
  },
  // The gilding: a rising shimmer, a soft run of chimes.
  gild: (rate) => {
    const notes = [1047, 1319, 1568, 2093, 2637].map((f, i) => bell(rate, i * 0.07, f, 0.18));
    const air = bandpass(rate, (t) => 3000 + 2000 * Math.min(1, t / 0.4), 2, murk(rate, 9000, 1489));
    return render(rate, 0.7, (t) => 0.6 * notes.reduce((s, v) => s + v(t), 0) + 0.8 * bump(t, 0, 0.6, 1) * air(t));
  },
  // The shine: a bright "shing".
  shine: (rate) => {
    const b = bell(rate, 0, 2794, 0.25);
    const c = bell(rate, 0.01, 3729, 0.18);
    const air = bandpass(rate, () => 6000, 2, noise(1493));
    return render(rate, 0.5, (t) => b(t) + 0.6 * c(t) + 0.8 * Math.exp(-t / 0.05) * air(t));
  },
  // The chef's kiss: a "mwah".
  kiss: (rate) => {
    const smack = bandpass(rate, () => 1800, 2, noise(1499));
    const v = voice(rate, (t) => 210 - 50 * Math.min(1, Math.max(0, t - 0.03) / 0.2), (t) => 300 + 500 * Math.min(1, Math.max(0, t - 0.03) / 0.1), () => 1200, 1511, 0.4);
    return render(rate, 0.3, (t) => 1.6 * Math.exp(-t / 0.01) * smack(t) + bump(t, 0.03, 0.24, 0.8) * v(t));
  },
  // A pawn bouncing off gold: a bright metallic clink.
  clink: (rate) => {
    const a = bell(rate, 0, 2349, 0.09);
    const b = bell(rate, 0.003, 3520, 0.06);
    const tap = bandpass(rate, () => 4000, 2, noise(1523));
    return render(rate, 0.32, (t) => a(t) + 0.7 * b(t) + 0.8 * Math.exp(-t / 0.004) * tap(t));
  },
};

/** Trims each to sit a little under a move's loudness (about 4 dB under its mean, as the other bosses'); a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<ZebraSound, number> = {
  pop: 0.451,
  volley: 0.325,
  laugh: 0.169,
  chuckle: 0.127,
  draw: 0.213,
  cock: 0.254,
  relax: 0.132,
  tsk: 0.623,
  tap: 0.282,
  thud: 0.259,
  tip: 0.694,
  hm: 0.1,
  oof: 0.173,
  snap: 0.905,
  lob: 0.269,
  plop: 0.247,
  // (Quieter than the rest: it plays on every move.)
  roll: 0.145,
  ding: 0.161,
  rise: 0.186,
  ovenPop: 0.448,
  squash: 0.435,
  stir: 0.0952,
  gild: 0.144,
  shine: 0.14,
  kiss: 0.147,
  clink: 0.197,
};

const cache = soundCache("zebra");
/** The samples for one of his sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function zebraSound(name: ZebraSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const ZEBRA_SOUNDS = Object.keys(SOUNDS) as ZebraSound[];
