/**
 * Birdie's sounds, synthesized (no files, no licenses), his own as every boss's are (Eric, Nov 18: never another boss's): a toy diesel
 * and a dove. A soft coo (a mourning dove's "hoo-OO-oo"), a toy horn's toot, the conductor's whistle (his signal), the crossing's
 * bell, the train rolling and braking, a puff of wings, a little hop, a hit, the train's smash on a piece, his fall's whoosh and an
 * armor's clank. Each is a pure function of the sample rate (its noise seeded), so a test can measure it: every one stays quieter than a
 * piece's move (peak and loudness).
 *
 * Which cue plays which: kit.sounds in kits.ts (his animations' cues) and his board art's (characters/effects/birdie.ts).
 */
import { bandpass, lowpass, noise, osc, render, sine, soft, soundCache, square, type Voice } from "./synth.ts";

export type BirdieSound = "coo" | "toot" | "whistle" | "bell" | "roll" | "brake" | "flutter" | "hop" | "oof" | "smash" | "whoosh" | "clank";

/** Noise with its highs rolled off twice: a soft puff or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** A note's swell and fall over `len` seconds from `at` (0 outside it). */
const swell = (t: number, at: number, len: number) => (t < at || t > at + len ? 0 : Math.max(0, Math.sin((Math.PI * (t - at)) / len)) ** 1.5);

const SOUNDS = {
  // A mourning dove's coo: a soft rising "hoo", a longer "OO", two low "oo"s after, breathy.
  coo: (rate) => {
    const notes = [
      { at: 0, len: 0.16, f0: 480, f1: 560 },
      { at: 0.18, len: 0.3, f0: 600, f1: 520 },
      { at: 0.52, len: 0.16, f0: 470, f1: 450 },
      { at: 0.72, len: 0.16, f0: 460, f1: 440 },
    ];
    const at = (t: number) => notes.reduce((k, n, j) => (t >= n.at ? j : k), 0);
    const v = osc(rate, (t) => {
      const n = notes[at(t)]!;
      const u = Math.min(1, Math.max(0, (t - n.at) / n.len));
      return n.f0 + (n.f1 - n.f0) * u;
    }, sine);
    const breath = bandpass(rate, () => 900, 1.2, murk(rate, 3000, 1201));
    return render(rate, 0.92, (t) => {
      const n = notes[at(t)]!;
      const e = swell(t, n.at, n.len);
      return e * (v(t) + 0.35 * breath(t));
    });
  },
  // A toy train's horn: two short bright toots of a reedy chord.
  toot: (rate) => {
    const a = osc(rate, () => 660, square);
    const b = osc(rate, () => 830, square);
    const reed = (t: number) => 0.5 * (a(t) + b(t));
    const tone = lowpass(rate, 2400, reed);
    return render(rate, 0.36, (t) => (swell(t, 0, 0.13) + swell(t, 0.17, 0.17)) * 0.6 * tone(t));
  },
  // The conductor's whistle: a pea whistle's trill, rising at its start.
  whistle: (rate) => {
    const v = osc(rate, (t) => 2300 + 300 * Math.min(1, t / 0.05) + 140 * Math.sin(2 * Math.PI * 28 * t), sine);
    const air = bandpass(rate, () => 2600, 2, noise(1211));
    return render(rate, 0.42, (t) => Math.max(0, swell(t, 0, 0.42)) ** 0.6 * (v(t) + 0.25 * air(t)));
  },
  // The crossing's bell: two dings, a bright bell's partials ringing down.
  bell: (rate) => {
    const parts = [1, 2.76, 5.4].map((k) => osc(rate, () => 980 * k, sine));
    const ding = (t: number, at: number) => (t < at ? 0 : Math.exp(-(t - at) / 0.12));
    return render(rate, 0.62, (t) => {
      const p = parts.map((o) => o(t));
      const e = ding(t, 0) + ding(t, 0.3);
      return e * (p[0]! + 0.4 * p[1]! + 0.15 * p[2]!);
    });
  },
  // The train rolling in: a soft low rumble with the clack of its wheels, four beats.
  roll: (rate) => {
    const rumble = murk(rate, 260, 1221);
    const clack = bandpass(rate, () => 1400, 2, noise(1223));
    return render(rate, 0.62, (t) => {
      const beat = (t % 0.15) / 0.15;
      return Math.sin(Math.PI * Math.min(1, t / 0.62)) * (1.6 * rumble(t) + (beat < 0.12 ? 0.8 * Math.exp(-beat / 0.04) : 0) * clack(t));
    });
  },
  // The brakes: a short squeal, then a hiss of air.
  brake: (rate) => {
    const squeal = osc(rate, (t) => 1900 - 300 * Math.min(1, t / 0.18), sine);
    const hiss = bandpass(rate, () => 3200, 1.1, noise(1231));
    return render(rate, 0.44, (t) => swell(t, 0, 0.2) * 0.5 * squeal(t) + (t > 0.12 ? Math.exp(-(t - 0.12) / 0.12) * 0.9 * hiss(t) : 0));
  },
  // A puff of wings: three soft beats of air.
  flutter: (rate) => {
    const air = bandpass(rate, () => 700, 1.3, murk(rate, 4000, 1241));
    return render(rate, 0.36, (t) => (swell(t, 0, 0.09) + swell(t, 0.12, 0.09) + swell(t, 0.24, 0.1)) * 2.2 * air(t));
  },
  // A little hop: a light tap and a chirp up.
  hop: (rate) => {
    const v = osc(rate, (t) => 900 + 900 * Math.min(1, t / 0.08), sine);
    return render(rate, 0.12, (t) => Math.exp(-t / 0.04) * v(t));
  },
  // An oof: a small falling squawk.
  oof: (rate) => {
    const v = osc(rate, (t) => 720 - 300 * Math.min(1, t / 0.14), (p) => 0.7 * sine(p) + 0.3 * square(p));
    const tone = lowpass(rate, 2000, v);
    return render(rate, 0.2, (t) => swell(t, 0, 0.2) * tone(t));
  },
  // The train's smash on a piece: a thud, a crack, and a spray of grit.
  smash: (rate) => {
    const thud = osc(rate, (t) => 70 + 120 * Math.exp(-t / 0.03), sine);
    const crack = bandpass(rate, (t) => 2200 - 1200 * Math.min(1, t / 0.1), 1.2, noise(1251));
    const grit = murk(rate, 1800, 1253);
    return render(rate, 0.42, (t) => Math.exp(-t / 0.07) * (1.2 * thud(t) + 1.1 * crack(t)) + Math.exp(-t / 0.16) * 0.6 * grit(t));
  },
  // His fall: wind rushing, falling in pitch.
  whoosh: (rate) => {
    const air = bandpass(rate, (t) => 1800 - 1200 * Math.min(1, t / 0.6), 1.4, murk(rate, 6000, 1261));
    return render(rate, 0.62, (t) => Math.sin(Math.PI * Math.min(1, t / 0.62)) * 2.4 * air(t));
  },
  // Armor: a bright metal clank, ringing a moment.
  clank: (rate) => {
    const parts = [1, 2.3, 3.9].map((k) => osc(rate, () => 520 * k, sine));
    const hit = bandpass(rate, () => 3000, 1.5, noise(1271));
    return render(rate, 0.34, (t) => Math.exp(-t / 0.08) * (parts[0]!(t) + 0.5 * parts[1]!(t) + 0.25 * parts[2]!(t)) + Math.exp(-t / 0.015) * hit(t));
  },
} satisfies Record<BirdieSound, (rate: number) => Float32Array>;

/** Each sound's level (its peak and loudness stay under a move's: boss-sounds-level tests). */
const LEVEL: Record<BirdieSound, number> = {
  coo: 0.16,
  toot: 0.14,
  whistle: 0.09,
  bell: 0.1,
  roll: 0.16,
  brake: 0.12,
  flutter: 0.15,
  hop: 0.14,
  oof: 0.12,
  smash: 0.18,
  whoosh: 0.14,
  clank: 0.12,
};

const cache = soundCache("birdie");
/** The samples for one of his sounds at a sample rate (made once, then reused). */
export function birdieSound(name: BirdieSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const BIRDIE_SOUNDS = Object.keys(SOUNDS) as BirdieSound[];
