/**
 * Dash's sounds, synthesized (no files, no licenses, no real voice; docs/decisions/2026-11-03-dash.md): a cocky cheetah's in
 * sneakers with a chess clock, quick and light (the brief: "sneaker-squeak and clock-tick flavoured"). His sneakers squeaking
 * as he skids, his zip-in, a finger snap, a whoosh of his arm; his chess clock's button clicked and slammed, its tick, its
 * flag falling, its spin in the air (a ratchet's whirr); the time he steals ticking away from you; his little voice (a "yeah!",
 * an "oof", a yawn, a slump's sigh); and Tick's, his tortoise's: a small clock ding, a slow chomp, a plodding step. Each is a
 * pure function of the sample rate (its noise is seeded), so a test measures it: every one stays quieter than a piece's move
 * (peak and loudness), as the other bosses' do.
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, soundCache, type Voice } from "./synth.ts";

export type DashSound =
  | "zip"
  | "squeak"
  | "click"
  | "tick"
  | "ticktock"
  | "snap"
  | "whoosh"
  | "slam"
  | "steal"
  | "whirr"
  | "flag"
  | "yeah"
  | "oof"
  | "yawn"
  | "slump"
  | "hello"
  | "ding"
  | "chomp"
  | "step";

/** Noise with its highs rolled off twice: a soft breath or rumble, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** A smooth bump from 0 up to 1 and back over `len` seconds from `at` (0 outside it). */
const bump = (t: number, at: number, len: number, power = 1) => (t < at || t > at + len ? 0 : Math.sin((Math.PI * (t - at)) / len) ** power);

/**
 * A hard plastic click at `at` (the clock's button, its tick): a couple of short-lived modes and a tap of noise. Silent before
 * it and once rung out.
 */
function clicker(rate: number, at: number, modes: readonly number[], decay: number, seed: number, tapLevel = 1): Voice {
  const tap = bandpass(rate, () => modes[0]! * 1.8, 2, noise(seed));
  const life = decay * 9 + 0.01;
  return (t) => {
    const age = t - at;
    if (age < 0 || age > life) return 0;
    let body = 0;
    for (let i = 0; i < modes.length; i++) body += (Math.exp(-age / (decay / (1 + 0.5 * i))) * Math.sin(2 * Math.PI * modes[i]! * age)) / (1 + i);
    return body + tapLevel * Math.exp(-age / 0.003) * tap(t);
  };
}

/** A sneaker's squeak on a hard floor: a narrow tone gliding `from` → `to` Hz with a rubbery flutter. */
function squeal(rate: number, from: number, to: number, len: number, seed: number): Voice {
  const tone = osc(rate, (t) => from + (to - from) * Math.min(1, t / len) + 60 * Math.sin(2 * Math.PI * 38 * t), (p) => Math.sin(2 * Math.PI * p) + 0.3 * Math.sin(4 * Math.PI * p));
  const rub = bandpass(rate, (t) => (from + (to - from) * Math.min(1, t / len)) * 1.5, 6, noise(seed));
  return (t) => tone(t) + 0.6 * rub(t);
}

/**
 * His little voice: a rounded buzz at `pitch(t)` through two formants (`f1`, `f2`: the vowel), a breath on top. Its level is
 * the caller's envelope.
 */
function voice(rate: number, pitch: (t: number) => number, f1: (t: number) => number, f2: (t: number) => number, seed: number, breath = 0.3): Voice {
  const buzz = lowpass(rate, 2200, osc(rate, pitch, (p) => 1 - 2 * p));
  const air = noise(seed);
  let src = 0;
  const v1 = bandpass(rate, f1, 4, () => src);
  const v2 = bandpass(rate, f2, 6, () => src);
  return (t) => {
    src = buzz(t) + breath * air(t);
    return v1(t) + 0.5 * v2(t);
  };
}

const mix = (vs: readonly Voice[]): Voice => (t) => vs.reduce((s, v) => s + v(t), 0);

const SOUNDS: Record<DashSound, (rate: number) => Float32Array> = {
  // His zip-in: air tearing past, rising fast, with a zipper's rasp in it.
  zip: (rate) => {
    const air = bandpass(rate, (t) => 600 + 3200 * Math.min(1, t / 0.2), 1.4, murk(rate, 6000, 701));
    const rasp = osc(rate, (t) => 90 + 260 * Math.min(1, t / 0.2), (p) => (p < 0.15 ? 1 : 0));
    return render(rate, 0.24, (t) => bump(t, 0, 0.24, 1.2) * (2.4 * air(t) * (0.6 + 0.4 * rasp(t))));
  },
  // His sneakers skidding to a stop: two squeaks, the second shorter.
  squeak: (rate) => {
    const a = squeal(rate, 1350, 1750, 0.12, 709);
    const b = squeal(rate, 1600, 1250, 0.07, 719);
    return render(rate, 0.24, (t) => bump(t, 0, 0.13, 0.5) * a(t) + 0.7 * bump(t, 0.15, 0.08, 0.5) * b(t));
  },
  // The clock's button pressed: a hard plastic click.
  click: (rate) => {
    const c = clicker(rate, 0, [1900, 3300], 0.006, 727);
    const back = clicker(rate, 0.035, [1500], 0.004, 733, 0.5);
    return render(rate, 0.1, (t) => c(t) + 0.5 * back(t));
  },
  // The clock ticking once: a small, dry tick.
  tick: (rate) => {
    const c = clicker(rate, 0, [2600, 4100], 0.003, 739, 0.8);
    return render(rate, 0.06, (t) => c(t));
  },
  // Tick-tock: his warning, tapping the clock's face (two ticks, the second lower).
  ticktock: (rate) => {
    const a = clicker(rate, 0, [2700, 4000], 0.004, 743, 0.8);
    const b = clicker(rate, 0.16, [1900, 3000], 0.005, 751, 0.8);
    return render(rate, 0.26, (t) => a(t) + b(t));
  },
  // A finger snap (his finger gun): a quick crack of noise.
  snap: (rate) => {
    const crack = bandpass(rate, () => 2300, 1.2, noise(757));
    const body = bandpass(rate, () => 700, 2, noise(761));
    return render(rate, 0.1, (t) => 2.6 * Math.exp(-t / 0.008) * crack(t) + 0.8 * Math.exp(-t / 0.02) * body(t));
  },
  // His arm winding up or swinging: a short whoosh.
  whoosh: (rate) => {
    const air = bandpass(rate, (t) => 500 + 1500 * Math.sin(Math.PI * Math.min(1, t / 0.2)), 1.3, murk(rate, 5000, 769));
    return render(rate, 0.2, (t) => bump(t, 0, 0.2, 1.3) * 2.6 * air(t));
  },
  // The clock slammed: his paw's slap, the button's click and the flag rattling, a little thud under it.
  slam: (rate) => {
    const slap = bandpass(rate, () => 1100, 0.9, lowpass(rate, 4200, noise(773)));
    const thud = osc(rate, (t) => 90 + 80 * Math.exp(-t / 0.02), sine);
    const button = clicker(rate, 0.004, [1700, 2900], 0.008, 787);
    const rattle = mix([0.05, 0.08, 0.11].map((a, i) => clicker(rate, a, [3000 + 300 * i], 0.003, 797 + i, 0.4)));
    return render(rate, 0.3, (t) => 2.2 * Math.exp(-t / 0.012) * slap(t) + 0.9 * Math.exp(-t / 0.05) * thud(t) + button(t) + 0.5 * rattle(t));
  },
  // Your time stolen: the clock's ticks racing away from you, then a zip of it into his pocket.
  steal: (rate) => {
    const at = [0, 0.07, 0.125, 0.17, 0.205, 0.235];
    const ticks = at.map((a, i) => clicker(rate, a, [2400 + 120 * i, 3800], 0.003, 809 + i, 0.7));
    const air = bandpass(rate, (t) => 900 + 2600 * Math.min(1, Math.max(0, t - 0.25) / 0.14), 1.6, murk(rate, 6000, 821));
    return render(rate, 0.42, (t) => ticks.reduce((s, k) => s + k(t), 0) + bump(t, 0.25, 0.16, 1.1) * 2.2 * air(t));
  },
  // The clock spinning in the air: a ratchet's clicks quickening, a whirr of air round it.
  whirr: (rate) => {
    const r = rng(827);
    const ticks: Voice[] = [];
    for (let a = 0, gap = 0.06; a < 0.5; a += gap, gap = Math.max(0.018, gap * 0.82)) ticks.push(clicker(rate, a + r() * 0.004, [2200 + r() * 600], 0.0025, 829 + ticks.length, 0.5));
    const air = bandpass(rate, (t) => 700 + 500 * Math.min(1, t / 0.5), 1.8, murk(rate, 3000, 839));
    return render(rate, 0.56, (t) => ticks.reduce((s, k) => s + k(t), 0) + bump(t, 0, 0.56, 0.8) * 1.4 * air(t));
  },
  // The flag falling: a little click as it drops, a soft clack as it lands.
  flag: (rate) => {
    const drop = clicker(rate, 0, [2100], 0.004, 841, 0.6);
    const land = clicker(rate, 0.09, [900, 1500], 0.012, 853, 0.6);
    return render(rate, 0.22, (t) => drop(t) + 1.2 * land(t));
  },
  // "Yeah!": short and rising, pleased with himself (his yes, his ta-da, his cheer).
  yeah: (rate) => {
    const pitch = (t: number) => 260 + 180 * Math.min(1, t / 0.14);
    const open = (t: number) => Math.min(1, t / 0.08);
    const v = voice(rate, pitch, (t) => 500 + 300 * open(t), (t) => 1600 + 300 * open(t), 857, 0.3);
    return render(rate, 0.26, (t) => Math.min(1, t / 0.015) * (t < 0.16 ? 1 : Math.max(0, 1 - (t - 0.16) / 0.1)) * v(t));
  },
  // A startled "oof", short and falling.
  oof: (rate) => {
    const v = voice(rate, (t) => 330 - 120 * Math.min(1, t / 0.16), () => 520, () => 1100, 863, 0.45);
    return render(rate, 0.2, (t) => Math.min(1, t / 0.01) * Math.max(0, 1 - t / 0.2) ** 1.3 * v(t));
  },
  // His big, bored yawn (he never thinks: he waits for you): rising, then sliding down.
  yawn: (rate) => {
    const pitch = (t: number) => (t < 0.25 ? 200 + 120 * (t / 0.25) : 320 - 170 * Math.min(1, (t - 0.25) / 0.35));
    const v = voice(rate, pitch, (t) => 600 + 250 * bump(t, 0, 0.6), () => 1200, 877, 0.5);
    return render(rate, 0.62, (t) => bump(t, 0, 0.62, 0.6) * v(t));
  },
  // A long, deflated sigh as he slumps (beaten).
  slump: (rate) => {
    const v = voice(rate, (t) => 210 - 80 * Math.min(1, t / 0.45), () => 480, () => 980, 881, 0.6);
    return render(rate, 0.5, (t) => bump(t, 0, 0.5, 0.7) * v(t));
  },
  // His select sound: a sneaker squeak, then a slap of the clock and his "yeah!".
  hello: (rate) => {
    const sq = squeal(rate, 1400, 1800, 0.1, 883);
    const c = clicker(rate, 0.14, [1900, 3300], 0.006, 887);
    const v = voice(rate, (t) => 270 + 170 * Math.min(1, Math.max(0, t - 0.22) / 0.12), () => 700, () => 1700, 889, 0.3);
    return render(rate, 0.5, (t) => bump(t, 0, 0.11, 0.5) * sq(t) + c(t) + (t > 0.22 ? Math.min(1, (t - 0.22) / 0.015) * Math.max(0, 1 - Math.max(0, t - 0.38) / 0.1) * v(t) : 0));
  },
  // Tick's ding: the clock on his shell, a small soft bell, quickly gone.
  ding: (rate) => {
    const bell = osc(rate, () => 1320, sine);
    const over = osc(rate, () => 3170, sine);
    return render(rate, 0.42, (t) => Math.min(1, t / 0.003) * (Math.exp(-t / 0.11) * bell(t) + 0.25 * Math.exp(-t / 0.04) * over(t)));
  },
  // Tick's slow chomp: a soft crunch, chewed twice.
  chomp: (rate) => {
    const crunch = bandpass(rate, () => 900, 1.4, noise(907));
    return render(rate, 0.42, (t) => (bump(t, 0, 0.12, 0.6) + 0.7 * bump(t, 0.24, 0.1, 0.6)) * 1.6 * crunch(t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 40 * t) ** 2));
  },
  // Tick's plodding step: a soft, low pat of a foot.
  step: (rate) => {
    const low = osc(rate, (t) => 110 + 60 * Math.exp(-t / 0.02), sine);
    const pat = murk(rate, 700, 911);
    return render(rate, 0.14, (t) => Math.exp(-t / 0.04) * (low(t) + 1.2 * pat(t)));
  },
};

/** Trims each to sit a little under a move's loudness (about 4 dB under its mean, as the other bosses'); a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<DashSound, number> = {
  zip: 0.231,
  squeak: 0.104,
  click: 0.625,
  tick: 1.17,
  ticktock: 1.23,
  snap: 0.615,
  whoosh: 0.184,
  slam: 0.314,
  steal: 0.237,
  whirr: 0.247,
  flag: 0.49,
  yeah: 0.0763,
  oof: 0.143,
  yawn: 0.101,
  slump: 0.108,
  hello: 0.103,
  ding: 0.231,
  chomp: 0.51,
  step: 0.226,
};

const cache = soundCache("dash");
/** The samples for one of his sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function dashSound(name: DashSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const DASH_SOUNDS = Object.keys(SOUNDS) as DashSound[];
