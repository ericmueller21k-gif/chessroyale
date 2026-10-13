/**
 * Wrangler's sounds, synthesized (no files, no licenses): the rope whirling over his head, a throw, the loop slapping
 * down on its catch, the rope snapping taut and dragging, a hop's thump, his snort and his snorting laugh (a pig's
 * grunt through the nose: no real voice), a spur stomp, the double lasso winding up, and the quick-draw sting for
 * "DRAW!" (a low twang, a slide and a knock, like a western's). Nothing bright: no chimes, no dings (the spur is a dull
 * clink, the twang low and damped). Each is a pure function of the sample rate (its noise is seeded), so a test can
 * measure it: every one stays quieter than a piece's move (peak and loudness).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, type Voice } from "./synth.ts";

export type PigSound = "whirl" | "throw" | "catch" | "tug" | "tip" | "laugh" | "snort" | "stomp" | "windup" | "hop" | "draw" | "yank";

/** Noise with its highs rolled off twice: a soft rumble or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** A rope swishing round: breathy noise whose pitch and level rise and fall `turns` times a second. */
function swish(rate: number, turns: (t: number) => number, centre: number, seed: number): Voice {
  const air = bandpass(rate, (t) => centre * (0.75 + 0.5 * (0.5 + 0.5 * Math.sin(2 * Math.PI * turns(t) * t))), 1.8, murk(rate, 3800, seed));
  return (t) => (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(2 * Math.PI * turns(t) * t)) ** 2) * 2.6 * air(t);
}

/** A thump: a low body falling in pitch, a pat of noise on top. */
function thump(rate: number, at: number, f: number, decay: number, seed: number): Voice {
  const body = osc(rate, (t) => f * (1 + 1.2 * Math.exp(-Math.max(0, t - at) / 0.02)), sine);
  const pat = murk(rate, 900, seed);
  return (t) => {
    const age = t - at;
    if (age < 0) return 0;
    return Math.exp(-age / decay) * (body(t) + 1.1 * pat(t));
  };
}

/** One snort: a burst of breath through a pig's nose (nasal formants) over a short grunt that drops in pitch. */
function snortAt(rate: number, at: number, len: number, seed: number, pitch = 120): Voice {
  const nose = bandpass(rate, () => 520, 2.4, murk(rate, 2600, seed));
  const nose2 = bandpass(rate, () => 1050, 3, murk(rate, 3000, seed + 1));
  const grunt = lowpass(rate, 700, osc(rate, (t) => pitch * (1.15 - 0.3 * Math.min(1, Math.max(0, t - at) / len)), saw));
  return (t) => {
    const age = t - at;
    if (age < 0 || age > len) return 0;
    const env = Math.sin((Math.PI * age) / len) ** 0.8;
    // (A rattle in it: the breath flutters.)
    const flutter = 0.6 + 0.4 * Math.sign(Math.sin(2 * Math.PI * 38 * age));
    return env * (flutter * (2.4 * nose(t) + 1.4 * nose2(t)) + 0.35 * grunt(t));
  };
}

/** A plucked low string (a damped twang, Karplus-Strong), starting at `at`, gliding down by `slide` (a ratio) over its life. */
function twang(rate: number, at: number, f: number, slide: number, decay: number, seed: number): Voice {
  const r = rng(seed);
  const n0 = Math.round(rate / f);
  const buf = Float32Array.from({ length: n0 * 2 }, () => r() * 2 - 1);
  let pos = 0;
  let started = false;
  return (t) => {
    const age = t - at;
    if (age < 0) return 0;
    if (!started) started = true;
    // (The string's length grows as it slides: the period stretches.)
    const period = Math.min(buf.length - 1, Math.round(n0 * (1 + (slide - 1) * Math.min(1, age / 0.5))));
    const i = pos % period;
    const j = (pos + 1) % period;
    const v = buf[i]!;
    buf[i] = 0.996 * 0.5 * (buf[i]! + buf[j]!);
    pos++;
    return Math.exp(-age / decay) * v;
  };
}

const SOUNDS: Record<PigSound, (rate: number) => Float32Array> = {
  // The loop whirling faster over his head before a throw.
  whirl: (rate) => {
    const v = swish(rate, (t) => 3 + 5 * Math.min(1, t / 0.4), 900, 401);
    return render(rate, 0.46, (t) => Math.min(1, t / 0.06) * Math.max(0, 1 - Math.max(0, t - 0.36) / 0.1) * v(t));
  },
  // The throw: a long whoosh of rope paying out.
  throw: (rate) => {
    const air = bandpass(rate, (t) => 1300 - 700 * Math.min(1, t / 0.3), 1.6, murk(rate, 4000, 409));
    return render(rate, 0.34, (t) => Math.sin(Math.PI * Math.min(1, t / 0.34)) ** 1.4 * 2.6 * air(t));
  },
  // The loop slapping down over its catch: a soft thwap of rope on wood.
  catch: (rate) => {
    const slap = bandpass(rate, () => 700, 1.4, murk(rate, 3000, 419));
    const knock = thump(rate, 0.005, 150, 0.04, 421);
    return render(rate, 0.2, (t) => 2.2 * Math.exp(-t / 0.02) * slap(t) + 0.8 * knock(t));
  },
  // The rope snapping taut and the catch dragged a little way: a creak rising, a scrape.
  tug: (rate) => {
    const creak = bandpass(rate, (t) => 260 + 260 * Math.min(1, t / 0.2), 6, murk(rate, 2000, 431));
    const scrape = bandpass(rate, () => 600, 1.6, murk(rate, 2600, 433));
    return render(rate, 0.42, (t) => Math.min(1, t / 0.02) * Math.max(0, 1 - Math.max(0, t - 0.3) / 0.12) * (2.6 * creak(t) * (t < 0.12 ? 1 : 0.5) + 1.5 * scrape(t) * Math.min(1, t / 0.08)));
  },
  // The hat tipped down: a soft brush of felt.
  tip: (rate) => {
    const brush = bandpass(rate, () => 800, 1.5, murk(rate, 3000, 439));
    return render(rate, 0.2, (t) => Math.sin(Math.PI * Math.min(1, t / 0.2)) * 1.6 * brush(t));
  },
  // His snorting laugh: four snorts, each a little lower and longer.
  laugh: (rate) => {
    const parts = [0, 0.17, 0.33, 0.52].map((at, i) => snortAt(rate, at, 0.12 + i * 0.015, 443 + i * 7, 130 - i * 8));
    return render(rate, 0.72, (t) => parts.reduce((s, p) => s + p(t), 0));
  },
  // One big snort.
  snort: (rate) => {
    const p = snortAt(rate, 0, 0.24, 461, 105);
    return render(rate, 0.26, p);
  },
  // A spur stomp: his boot hitting the ground and a dull clink of the spur.
  stomp: (rate) => {
    const boot = thump(rate, 0.004, 70, 0.07, 467);
    const clink = bandpass(rate, () => 1500, 8, noise(479));
    return render(rate, 0.3, (t) => boot(t) + (t > 0.03 ? 1.6 * Math.exp(-(t - 0.03) / 0.03) * clink(t) : 0));
  },
  // The double lasso winding up: two ropes whirling, faster and louder.
  windup: (rate) => {
    const a = swish(rate, (t) => 3 + 6 * Math.min(1, t / 1.1), 800, 487);
    const b = swish(rate, (t) => 3.4 + 6 * Math.min(1, t / 1.1), 1100, 491);
    return render(rate, 1.3, (t) => Math.min(1, t / 0.2) * Math.max(0, 1 - Math.max(0, t - 1.15) / 0.15) * (0.4 + 0.6 * Math.min(1, t / 1)) * (a(t) + 0.8 * b(t)));
  },
  // A hop landing: the thump of his boots.
  hop: (rate) => {
    const v = thump(rate, 0, 75, 0.05, 499);
    return render(rate, 0.22, v);
  },
  // "DRAW!": the quick-draw sting: a low twang that slides down, a knock, the twang ringing on.
  draw: (rate) => {
    const string = twang(rate, 0, 98, 1.12, 0.55, 503);
    const knock = thump(rate, 0.0, 60, 0.09, 509);
    const tone = lowpass(rate, 1400, string);
    return render(rate, 1.1, (t) => 1.6 * tone(t) + 0.7 * knock(t));
  },
  // A pair yanked in: the rope snapping taut (a quick fwip) and the piece's thud as it lands.
  yank: (rate) => {
    const fwip = bandpass(rate, (t) => 500 + 1400 * Math.min(1, t / 0.08), 2, murk(rate, 3600, 521));
    const land = thump(rate, 0.16, 120, 0.04, 523);
    return render(rate, 0.3, (t) => (t < 0.12 ? Math.sin((Math.PI * t) / 0.12) * 2.4 * fwip(t) : 0) + 0.9 * land(t));
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<PigSound, number> = { whirl: 0.206, throw: 0.204, catch: 0.284, tug: 0.148, tip: 0.29, laugh: 0.212, snort: 0.186, stomp: 0.213, windup: 0.19, hop: 0.25, draw: 0.33, yank: 0.207 };

const cache = new Map<string, Float32Array>();
/** The samples for one of his sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function pigSound(name: PigSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const PIG_SOUNDS = Object.keys(SOUNDS) as PigSound[];
