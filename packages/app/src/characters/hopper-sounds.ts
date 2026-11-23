/**
 * Chub & Chirp's sounds, synthesized (no files, no licenses), as the other bosses' are: Chirp's chirp (a grasshopper's
 * quick trill), a rabbit's foot thumping, Chub's squeak, an oof, a flop as they go down, a cheer, a sigh, a carrot
 * tossed (a little whoosh), a carrot bonking a king, a hop (a springy boing) and its landing; on the board, a carrot
 * thunking into the soil as it's planted and popping out as it's pulled; and the spin's reel, a tick per card and its
 * stop. Each is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays
 * quieter than a piece's move (peak and loudness).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, type Voice, soundCache } from "./synth.ts";

export type HopperSound = "chirp" | "thump" | "squeak" | "oof" | "flop" | "cheer" | "sigh" | "toss" | "bonk" | "hop" | "land" | "thunk" | "pop" | "tick" | "stop";

/** Noise with its highs rolled off twice: a soft puff or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** A thump on the ground: a low sine dropping in pitch, ringing down over `decay`, with a puff of low noise. */
function thump(rate: number, from: number, to: number, decay: number, seed: number, dirt = 1): Voice {
  const body = osc(rate, (t) => to + (from - to) * Math.exp(-t / 0.025), sine);
  const dust = murk(rate, 600, seed);
  return (t) => Math.exp(-t / decay) * (body(t) + dirt * 1.4 * dust(t));
}

/**
 * A grasshopper's trill: `bursts` short runs of clicks of a high, buzzy tone (`f` Hz), each click a few ms, the runs
 * `gap` s apart. The level is the caller's.
 */
function trill(rate: number, f: number, bursts: number, clicks: number, gap: number, seed: number): Voice {
  const tone = osc(rate, (t) => f + 180 * Math.sin(2 * Math.PI * 23 * t), sine);
  const hiss = bandpass(rate, () => f * 1.1, 4, noise(seed));
  const click = 0.011;
  const run = clicks * click;
  return (t) => {
    const b = Math.floor(t / gap);
    const u = t - b * gap;
    if (b >= bursts || u > run) {
      tone(t);
      hiss(t);
      return 0;
    }
    const c = (u % click) / click;
    const env = Math.sin(Math.PI * Math.min(1, c * 1.6)) ** 2 * (1 - (0.25 * b) / bursts);
    return env * (tone(t) + 0.5 * hiss(t));
  };
}

/** A little voice: a reedy tone whose pitch follows `pitch(t)`, softened, for Chub's squeak, oof and cheer. */
function voice(rate: number, pitch: (t: number) => number, cut = 1800): Voice {
  return lowpass(rate, cut, lowpass(rate, cut * 1.5, osc(rate, pitch, saw)));
}

const SOUNDS: Record<HopperSound, (rate: number) => Float32Array> = {
  // Chirp: three quick runs of clicks, high and buzzy.
  chirp: (rate) => {
    const v = trill(rate, 4300, 3, 5, 0.085, 601);
    return render(rate, 0.26, (t) => v(t));
  },
  // A rabbit's thump: his hind foot hitting the ground, once, hard.
  thump: (rate) => {
    const v = thump(rate, 140, 62, 0.05, 607, 0.8);
    return render(rate, 0.2, (t) => v(t));
  },
  // Chub's squeak: short, rising, a little wobble.
  squeak: (rate) => {
    const v = osc(rate, (t) => 1150 + 900 * Math.min(1, t / 0.09) + 60 * Math.sin(2 * Math.PI * 30 * t), sine);
    return render(rate, 0.13, (t) => Math.sin(Math.PI * Math.min(1, t / 0.13)) ** 0.8 * v(t));
  },
  // An oof: a small grunt (a rabbit's, higher than a mammoth's).
  oof: (rate) => {
    const v = voice(rate, (t) => 290 - 110 * Math.min(1, t / 0.18), 1100);
    const breath = murk(rate, 1500, 613);
    return render(rate, 0.2, (t) => Math.sin(Math.PI * Math.min(1, t / 0.2)) ** 0.7 * (1.5 * v(t) + 0.5 * breath(t)));
  },
  // Down they go: a soft flop onto the ground, a puff of dust.
  flop: (rate) => {
    const v = thump(rate, 100, 46, 0.12, 619, 1.3);
    return render(rate, 0.36, (t) => v(t));
  },
  // A cheer: Chub's "yay!" up two notes, and Chirp's trill under it.
  cheer: (rate) => {
    const v = voice(rate, (t) => (t < 0.14 ? 520 : 700) + 25 * Math.sin(2 * Math.PI * 7 * t), 2200);
    const bug = trill(rate, 4600, 2, 6, 0.16, 631);
    return render(rate, 0.42, (t) => Math.min(1, t / 0.02) * Math.max(0, 1 - Math.max(0, t - 0.3) / 0.12) * (1.4 * v(t) + 0.45 * bug(t)));
  },
  // A sigh: a long breath out, falling.
  sigh: (rate) => {
    const air = bandpass(rate, (t) => 950 - 450 * Math.min(1, t / 0.6), 1.3, murk(rate, 3500, 641));
    const hum = voice(rate, (t) => 230 - 60 * Math.min(1, t / 0.6), 700);
    return render(rate, 0.62, (t) => Math.sin(Math.PI * Math.min(1, t / 0.62)) ** 1.2 * (2.6 * air(t) + 0.5 * hum(t)));
  },
  // A carrot tossed: a short, light whoosh.
  toss: (rate) => {
    const air = bandpass(rate, (t) => 700 + 1600 * Math.min(1, t / 0.15), 1.6, murk(rate, 5000, 647));
    return render(rate, 0.16, (t) => Math.sin(Math.PI * Math.min(1, t / 0.16)) ** 1.3 * 2.4 * air(t));
  },
  // A carrot bonking a king on the head: a woody knock, the carrot bouncing off.
  bonk: (rate) => {
    const knock = osc(rate, (t) => 340 - 140 * Math.min(1, t / 0.06), sine);
    const wood = bandpass(rate, () => 1300, 3, noise(653));
    return render(rate, 0.14, (t) => Math.exp(-t / 0.035) * (knock(t) + 0.9 * Math.exp(-t / 0.006) * wood(t)));
  },
  // A hop: a springy little boing up.
  hop: (rate) => {
    const v = osc(rate, (t) => 260 + 520 * Math.min(1, t / 0.12) + 40 * Math.sin(2 * Math.PI * 28 * t), sine);
    const push = murk(rate, 900, 659);
    return render(rate, 0.17, (t) => Math.sin(Math.PI * Math.min(1, t / 0.17)) * (v(t) + 0.6 * push(t)));
  },
  // Landing: a light thump, a skid of dust.
  land: (rate) => {
    const v = thump(rate, 120, 58, 0.06, 661, 0.9);
    const skid = bandpass(rate, () => 600, 1.5, murk(rate, 2500, 673));
    return render(rate, 0.22, (t) => v(t) + (t < 0.12 ? Math.sin((Math.PI * t) / 0.12) * 0.7 * skid(t) : 0));
  },
  // A carrot planted: it thunks into the soil, which heaps up round it.
  thunk: (rate) => {
    const v = thump(rate, 170, 80, 0.04, 677, 0.7);
    const soil = bandpass(rate, () => 900, 1.2, murk(rate, 3000, 683));
    return render(rate, 0.18, (t) => v(t) + (t < 0.1 ? Math.exp(-t / 0.03) * 0.9 * soil(t) : 0));
  },
  // A carrot pulled: a cork-like pop, a crumble of soil after it.
  pop: (rate) => {
    const v = osc(rate, (t) => 950 - 600 * Math.min(1, t / 0.045), sine);
    const soil = bandpass(rate, () => 1100, 1.2, murk(rate, 3500, 691));
    return render(rate, 0.18, (t) => (t < 0.06 ? Math.sin((Math.PI * t) / 0.06) * v(t) : 0) + (t > 0.03 ? Math.exp(-(t - 0.03) / 0.05) * 0.8 * soil(t) : 0));
  },
  // The reel: a card passing the line, a light click.
  tick: (rate) => {
    const v = bandpass(rate, () => 2600, 3, noise(701));
    const knock = osc(rate, () => 900, sine);
    return render(rate, 0.035, (t) => Math.exp(-t / 0.005) * (v(t) + 0.6 * knock(t)));
  },
  // The reel stopping: a soft clunk, then a little bell.
  stop: (rate) => {
    const clunk = thump(rate, 200, 110, 0.03, 709, 0.5);
    const r = rng(719);
    const bell = (f: number) => osc(rate, () => f * (1 + 0.002 * r()), sine);
    const a = bell(988);
    const b = bell(1976);
    return render(rate, 0.55, (t) => {
      const ring = 0.9 * a(t) + 0.35 * b(t);
      return clunk(t) + (t > 0.03 ? Math.exp(-(t - 0.03) / 0.16) * ring : 0);
    });
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<HopperSound, number> = {
  chirp: 0.13,
  thump: 0.22,
  squeak: 0.1,
  oof: 0.1,
  flop: 0.2,
  cheer: 0.1,
  sigh: 0.14,
  toss: 0.18,
  bonk: 0.2,
  hop: 0.12,
  land: 0.2,
  thunk: 0.2,
  pop: 0.16,
  tick: 0.14,
  stop: 0.14,
};

const cache = soundCache("hopper");
/** The samples for one of their sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function hopperSound(name: HopperSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const HOPPER_SOUNDS = Object.keys(SOUNDS) as HopperSound[];
