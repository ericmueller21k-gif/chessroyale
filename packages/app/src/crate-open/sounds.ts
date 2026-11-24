/**
 * The crate opening's sounds (Nov 24; docs/decisions/2026-11-24-crate-open-build.md), made in code like the bosses' (no files, no
 * licenses; characters/synth.ts), each a pure function of the sample rate, cached by name (`soundCache("crate")`) and made ahead in the
 * sound worker (sound.ts `warmCrateSounds`), so nothing is made on the opening's frames.
 *
 * Eric (Nov 24, his first ask): not "that marimba ... a little too silly sounding". Of the mockup's three, his pick (Nov 24, ~18:55):
 * "the spinning sound of number 3 a bit better, but the number 4 ending sound and everything else about number 4": the spin is C's, the
 * slot reel (a heavier metal tick at each tile edge, `tick0` to `tick5` by speed, two takes each; the reel's hum under it, `whirr`; the
 * reel locking with a clunk, `lock`); the ending is A's (the box dropping in and
 * landing, `land`; shaking, `shake-<tier>`; the lid bursting off with a clean glassy chord that climbs with the
 * tier, `sting-<tier>`, Legendary and Mythic the bigger ending). timeline.ts `cues` says when each plays; sound.ts `playCrateCues` lays
 * them on the audio clock. No charge-up (Eric, Nov 24: "I don't want like build up right at the end"; "it kind of sounds like a
 * charge"): no swell under the slowdown and no rising charge under the shake, only its knocks.
 */
import { TIERS, type ItemTier } from "@chessroyale/core";
import { bandpass, noise, rng, soundCache } from "../characters/synth.ts";
import { EASE_POWER, timeline, type Timeline } from "./timeline.ts";

const TAU = Math.PI * 2;

// ---------------- Small building blocks on whole buffers ----------------

/** RBJ biquad over a buffer (a new one): "bp" (0 dB peak), "lp", "hp". */
function biquad(x: Float32Array, rate: number, type: "bp" | "lp" | "hp", f: number, q: number): Float32Array {
  const w = (TAU * Math.min(f, rate * 0.45)) / rate;
  const al = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  let b0: number, b1: number, b2: number;
  if (type === "bp") [b0, b1, b2] = [al, 0, -al];
  else if (type === "lp") [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
  else [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const a0 = 1 + al;
  const a1 = -2 * c;
  const a2 = 1 - al;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i]! + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x[i]!;
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** `sec` of seeded white noise. */
function whiteNoise(rate: number, sec: number, seed: number): Float32Array {
  const n = noise(seed);
  const out = new Float32Array(Math.max(1, Math.ceil(rate * sec)));
  for (let i = 0; i < out.length; i++) out[i] = n(0);
  return out;
}

/** Multiplies a buffer by an envelope of time (in place) and returns it. */
function shape(x: Float32Array, rate: number, env: (t: number) => number): Float32Array {
  for (let i = 0; i < x.length; i++) x[i]! *= env(i / rate);
  return x;
}

/** A fast attack (`a` s) and an exponential decay (time constant `d` s). */
const ad = (a: number, d: number) => (t: number) => (t < a ? t / a : Math.exp(-(t - a) / d));

/** A sine (or a sum of partials) with its own decay per partial: [ratio, level, decay s]. */
function partials(rate: number, sec: number, f: number, list: readonly (readonly [number, number, number])[], attack = 0.002, detune = 0): Float32Array {
  const out = new Float32Array(Math.ceil(rate * sec));
  for (const [r, l, d] of list) {
    const w = (TAU * f * r * (1 + detune)) / rate;
    const k = Math.exp(-1 / (d * rate));
    let e = 1;
    for (let i = 0; i < out.length; i++) {
      const a = i < attack * rate ? i / (attack * rate) : 1;
      out[i]! += Math.sin(w * i) * l * e * a;
      e *= k;
    }
  }
  return out;
}

/** A sine whose pitch glides from `f0` to `f1` (exponentially, over `glide` s), with an envelope. */
function sweep(rate: number, sec: number, f0: number, f1: number, glide: number, env: (t: number) => number): Float32Array {
  const out = new Float32Array(Math.ceil(rate * sec));
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    const f = f0 * Math.pow(f1 / f0, Math.min(1, t / glide));
    ph += f / rate;
    out[i] = Math.sin(TAU * ph) * env(t);
  }
  return out;
}

/** A band-limited saw (additive, up to `top` Hz), with an envelope. */
function saw(rate: number, sec: number, f: number, env: (t: number) => number, top = 5000): Float32Array {
  const out = new Float32Array(Math.ceil(rate * sec));
  const n = Math.max(1, Math.floor(top / f));
  for (let k = 1; k <= n; k++) {
    const w = (TAU * f * k) / rate;
    const l = 1 / k;
    for (let i = 0; i < out.length; i++) out[i]! += Math.sin(w * i) * l;
  }
  for (let i = 0; i < out.length; i++) out[i]! *= 0.55 * env(i / rate);
  return out;
}

/** A small mono room (Freeverb's combs and all-passes): `size` 0 to 1, `wet` its level. Returns a new, longer buffer. */
function room(x: Float32Array, rate: number, size: number, wet: number, damp = 0.3): Float32Array {
  const tail = Math.ceil(rate * (0.6 + 1.6 * size));
  const out = new Float32Array(x.length + tail);
  const s = rate / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({ buf: new Float32Array(Math.round(d * s)), i: 0, low: 0 }));
  const alls = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(Math.round(d * s)), i: 0 }));
  const fb = 0.7 + 0.26 * size;
  for (let n = 0; n < out.length; n++) {
    const inp = (n < x.length ? x[n]! : 0) * 0.03;
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i]!;
      c.low = y * (1 - damp) + c.low * damp;
      c.buf[c.i] = inp + c.low * fb;
      c.i = (c.i + 1) % c.buf.length;
      acc += y;
    }
    for (const a of alls) {
      const b = a.buf[a.i]!;
      a.buf[a.i] = acc + b * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      acc = b - acc;
    }
    out[n] = (n < x.length ? x[n]! : 0) + acc * wet;
  }
  return out;
}

/** Adds `src` into `out` at `at` seconds, times `gain`. */
function mix(out: Float32Array, rate: number, src: Float32Array, at: number, gain = 1) {
  const o = Math.round(at * rate);
  for (let i = 0; i < src.length; i++) {
    const j = o + i;
    if (j >= 0 && j < out.length) out[j]! += src[i]! * gain;
  }
}

// ---------------- The clicks ----------------

/** C: one heavier metal tick of a slot reel (a clack with an inharmonic ring and the reel's mass under it). */
function reelClack(rate: number, seed: number, heavy: number): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(Math.ceil(rate * 0.09));
  const f = 1380 + 90 * r();
  mix(out, rate, partials(rate, 0.09, f, [[1, 0.5, 0.012], [2.32, 0.4, 0.009], [3.87, 0.25, 0.006], [5.1, 0.15, 0.004]]), 0, 0.5);
  mix(out, rate, shape(biquad(whiteNoise(rate, 0.02, seed), rate, "bp", 2600, 1.3), rate, ad(0.0003, 0.0028)), 0, 0.95);
  mix(out, rate, sweep(rate, 0.08, 165, 120, 0.04, ad(0.001, 0.022)), 0, 0.42 + 0.3 * heavy);
  return out;
}

/** C's last: the reel locking (a big clack and a low clunk). */
function reelLock(rate: number): Float32Array {
  const out = new Float32Array(Math.ceil(rate * 0.3));
  mix(out, rate, reelClack(rate, 99, 1), 0, 1.1);
  mix(out, rate, sweep(rate, 0.25, 130, 70, 0.08, ad(0.001, 0.07)), 0.004, 0.8);
  mix(out, rate, shape(biquad(whiteNoise(rate, 0.05, 98), rate, "lp", 700, 0.7), rate, ad(0.0005, 0.015)), 0.004, 0.6);
  return out;
}

// ---------------- The box: drop, land, shake, burst ----------------

/** The box dropping in (a short falling whoosh) and landing (a thud with a wooden knock). */
function boxLand(rate: number, T: Timeline, out: Float32Array, at: number) {
  const dropS = T.dropMs / 1000;
  const n = noise(5);
  const whoosh = new Float32Array(Math.ceil(rate * dropS));
  const bp = bandpass(rate, (t) => 2400 - 1800 * (t / dropS), 1.4, () => n(0));
  for (let i = 0; i < whoosh.length; i++) {
    const t = i / rate;
    whoosh[i] = bp(t) * Math.sin((Math.PI * t) / dropS) ** 2;
  }
  mix(out, rate, whoosh, at, 0.12);
  const land = at + dropS;
  mix(out, rate, sweep(rate, 0.3, 100, 46, 0.12, ad(0.002, 0.09)), land, 0.75);
  mix(out, rate, shape(biquad(whiteNoise(rate, 0.08, 6), rate, "lp", 500, 0.7), rate, ad(0.001, 0.02)), land, 0.7);
  mix(out, rate, shape(biquad(whiteNoise(rate, 0.04, 7), rate, "bp", 750, 2), rate, ad(0.0005, 0.008)), land, 0.35);
}

/** The shake: the box knocking about faster and faster (no charge under it: Eric, Nov 24). */
function boxShake(rate: number, T: Timeline, out: Float32Array, from: number) {
  const s0 = from;
  const s1 = T.burstAt / 1000;
  const len = s1 - s0;
  let t = s0;
  let gap = 0.11;
  let k = 0;
  while (t < s1 - 0.02) {
    const u = (t - s0) / len;
    const knock = new Float32Array(Math.ceil(rate * 0.06));
    mix(knock, rate, shape(biquad(whiteNoise(rate, 0.02, 30 + k), rate, "bp", 850 + 250 * (k % 2), 2.5), rate, ad(0.0004, 0.005)), 0, 0.7);
    mix(knock, rate, partials(rate, 0.06, 150 + 20 * (k % 3), [[1, 1, 0.02]]), 0, 0.35);
    mix(out, rate, knock, t, 0.3 + 0.5 * u);
    t += gap;
    gap = Math.max(0.032, gap * 0.8);
    k++;
  }
}

/**
 * Each tier's own ending (Eric, Nov 24: "keep like common and uncommon the same, but like rare and whatever goes up should each have
 * their own"), all in the family of A's glassy chord and climbing in excitement; no build-up before the burst (the burst itself grows):
 * - Common and Uncommon: one shared sting, today's (the chord strummed over a small crack, boom and whoosh; a few glints).
 * - Rare: brighter (a step up), with a shimmer: the chord's upper notes held an octave up, trembling.
 * - Epic: fuller (a bass octave under the chord), and a rising arpeggio after the burst.
 * - Legendary: the big chord with a choir under it and a bell tolling.
 * - Mythic: the biggest, its own color: a fanfare's chord change (the flat sixth, the flat seventh, home), the choir and the bell on
 *   home, and a sparkle cascade falling over it.
 */
type StingSpec = { root: number; sec: number; size: number; roomSize: number; wet: number; glints: number; spread: number };
const STINGS: Record<ItemTier, StingSpec> = {
  common: { root: -3, sec: 1.5, size: 0, roomSize: 0.65, wet: 0.4, glints: 6, spread: 0.5 },
  uncommon: { root: -3, sec: 1.5, size: 0, roomSize: 0.65, wet: 0.4, glints: 6, spread: 0.5 },
  rare: { root: 1, sec: 1.7, size: 0.25, roomSize: 0.72, wet: 0.45, glints: 9, spread: 0.8 },
  epic: { root: 4, sec: 1.9, size: 0.5, roomSize: 0.78, wet: 0.48, glints: 9, spread: 0.9 },
  legendary: { root: 0, sec: 2.4, size: 1, roomSize: 0.85, wet: 0.55, glints: 12, spread: 1.0 },
  mythic: { root: 3, sec: 3.2, size: 1, roomSize: 0.9, wet: 0.6, glints: 16, spread: 1.6 },
};
const semis = (n: number) => Math.pow(2, n / 12);

/** The chord's notes over a root: a bright major add-9 (not a jingle). */
const CHORD = [1, 1.2599, 1.4983, 2, 2.2449];

/** Fades a buffer's last `sec` out (in place) so a held note that's cut doesn't click; returns it. */
function fadeOut(x: Float32Array, rate: number, sec = 0.15): Float32Array {
  const n = Math.min(x.length, Math.round(rate * sec));
  for (let i = 0; i < n; i++) x[x.length - 1 - i]! *= i / n;
  return x;
}

/** One note of the sting: glassy (a hair-sharp second partial for the shimmer). `d` scales its ring (a short stab under 1). */
function stingNote(rate: number, f: number, sec: number, d = 1): Float32Array {
  const a = partials(rate, sec, f, [[1, 1, 0.9 * d], [2.76, 0.22, 0.22 * d], [5.4, 0.08, 0.08 * d]], 0.003);
  const b = partials(rate, sec, f, [[1, 0.6, 1.0 * d]], 0.003, 0.0022);
  for (let i = 0; i < a.length; i++) a[i]! += b[i]!;
  return fadeOut(a, rate);
}

/** A chord strummed upward quickly from `at`. */
function strum(dry: Float32Array, rate: number, root: number, notes: readonly number[], at: number, step: number, gain: number, sec: number, d = 1) {
  notes.forEach((m, i) => mix(dry, rate, stingNote(rate, root * m, sec, d), at + 0.012 + i * step, gain * (m < 1 ? 0.8 : 1)));
}

/** The lid cracking off, a low boom under it and the beam's rising whoosh: `size` 0 (today's small) to 1 (today's big). */
function burst(dry: Float32Array, rate: number, size: number) {
  const z = (a: number, b: number) => a + (b - a) * size;
  mix(dry, rate, shape(biquad(whiteNoise(rate, 0.05, 61), rate, "hp", 900, 0.7), rate, ad(0.0003, 0.009)), 0, 0.6);
  mix(dry, rate, sweep(rate, z(0.5, 0.9), z(90, 70), z(48, 32), z(0.2, 0.35), ad(0.002, z(0.14, 0.28))), 0, z(0.6, 1.0));
  const wl = z(0.45, 0.7);
  const n = noise(62);
  const bp = bandpass(rate, (t) => 500 * Math.pow(z(9, 14), t / wl), 1.6, () => n(0));
  const whoosh = new Float32Array(Math.ceil(rate * wl));
  for (let i = 0; i < whoosh.length; i++) {
    const t = i / rate;
    whoosh[i] = bp(t) * Math.sin((Math.PI * t) / wl) ** 1.5;
  }
  mix(dry, rate, whoosh, 0, z(0.3, 0.45));
}

/** A held, trembling note (two voices a hair apart, a 5.5 Hz tremolo): the shimmer. */
function shimmer(rate: number, f: number, sec: number, attack = 0.06, decay = 0.9): Float32Array {
  const out = new Float32Array(Math.ceil(rate * sec));
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    const env = Math.min(1, t / attack) * Math.exp(-t / decay) * (0.65 + 0.35 * Math.sin(TAU * 5.5 * t));
    out[i] = (Math.sin(TAU * f * t) + 0.8 * Math.sin(TAU * f * 1.004 * t)) * env;
  }
  return fadeOut(out, rate);
}

/** A held choir of `ratios` over `root` (detuned saws, softened), swelling in over 0.12 s and fading. */
function choir(dry: Float32Array, rate: number, root: number, ratios: readonly number[], at: number, sec: number) {
  const env = (t: number) => Math.min(1, t / 0.12) * Math.exp(-t / 1.3);
  const pad = new Float32Array(Math.ceil(rate * sec));
  for (const m of ratios) for (const d of [-0.006, 0.006]) mix(pad, rate, saw(rate, sec, root * m * (1 + d), env, 2400), 0, 0.12);
  mix(dry, rate, fadeOut(biquad(pad, rate, "lp", 1700, 0.7), rate, 0.3), at, 1);
}

/** A bell struck once (a church bell's partials: the hum an octave down, the minor-third tierce, the quint, the nominal). */
function bell(rate: number, f: number, sec: number): Float32Array {
  return fadeOut(partials(rate, sec, f, [[0.5, 0.55, 2.6], [1, 1, 1.9], [1.19, 0.4, 1.2], [1.5, 0.3, 0.9], [2, 0.38, 0.8], [2.52, 0.2, 0.45], [3, 0.16, 0.3], [4.07, 0.1, 0.18]], 0.001), rate, 0.3);
}

/** A few glints high up, as the light catches. */
function glints(dry: Float32Array, rate: number, count: number, spread: number) {
  const r = rng(71);
  for (let i = 0; i < count; i++) mix(dry, rate, partials(rate, 0.25, 2600 + 4200 * r(), [[1, 1, 0.07 + 0.08 * r()]], 0.001), 0.05 + r() * spread, 0.035);
}

/** The burst and the reveal's sting, each tier its own (STINGS). */
function sting(rate: number, tier: ItemTier, out: Float32Array, at: number) {
  const s = STINGS[tier];
  const root = 523.25 * semis(s.root);
  const dry = new Float32Array(Math.ceil(rate * (s.sec + 0.3)));
  burst(dry, rate, s.size);
  if (tier === "common" || tier === "uncommon") {
    strum(dry, rate, root, CHORD, 0, 0.016, 0.22, s.sec);
  } else if (tier === "rare") {
    strum(dry, rate, root, CHORD, 0, 0.016, 0.22, s.sec);
    for (const m of [2, 2.52, 3]) mix(dry, rate, shimmer(rate, root * m, s.sec - 0.1), 0.05, 0.05);
  } else if (tier === "epic") {
    strum(dry, rate, root, [0.5, ...CHORD], 0, 0.018, 0.2, s.sec);
    [1, 1.26, 1.5, 2, 2.52, 3, 4, 5.04].forEach((m, i) => mix(dry, rate, stingNote(rate, root * m, 0.8, 0.45), 0.16 + i * 0.06, 0.09 + 0.006 * i));
  } else if (tier === "legendary") {
    strum(dry, rate, root, [0.5, ...CHORD, 3], 0, 0.022, 0.2, s.sec);
    choir(dry, rate, root, [0.5, 0.63, 0.75, 1], 0.03, s.sec);
    mix(dry, rate, bell(rate, root, s.sec), 0.01, 0.2);
  } else {
    // Mythic: the fanfare's change (bVI, bVII, then home), the choir and the bell on home, the sparkles falling over it.
    const home = 0.46;
    strum(dry, rate, root * semis(-4), [0.5, 1, 1.26, 1.5, 2], 0, 0.014, 0.17, 0.6, 0.35);
    strum(dry, rate, root * semis(-2), [0.5, 1, 1.26, 1.5, 2], 0.23, 0.014, 0.17, 0.6, 0.35);
    strum(dry, rate, root, [0.5, ...CHORD, 3], home, 0.02, 0.2, s.sec - home);
    choir(dry, rate, root, [0.5, 0.63, 0.75, 1], home + 0.02, s.sec - home);
    mix(dry, rate, bell(rate, root, s.sec - home), home, 0.2);
    const fall = [8, 6, 5.04, 4, 3, 2.52, 2, 1.5, 6, 5.04, 4, 3, 2.52, 2];
    fall.forEach((m, i) => mix(dry, rate, partials(rate, 0.5, root * m, [[1, 1, 0.18], [2.76, 0.2, 0.05]], 0.002), home + 0.08 + i * 0.07, 0.08 - 0.002 * i));
  }
  glints(dry, rate, s.glints, s.spread);
  mix(out, rate, room(dry, rate, s.roomSize, s.wet), at, 1);
}

/**
 * The Transcendent moment (Eric, Nov 24: "Fischer Random" renamed after the highest rank): the strip lands on its tile. Its own
 * color, apart from the stings: a harp's quick sweep up a Lydian scale onto a held, trembling Lydian chord (major 7, raised 4), a
 * soft deep gong under it and a crystal ting on top. No build-up after it: the banner's moment, then the second strip.
 */
function transcendent(rate: number): Float32Array {
  const root = 587.33;
  const sec = 2.2;
  const dry = new Float32Array(Math.ceil(rate * (sec + 0.3)));
  // The gong under it: a low inharmonic strike, soft.
  mix(dry, rate, fadeOut(partials(rate, 1.8, 73.4, [[1, 1, 0.8], [1.47, 0.5, 0.55], [2.09, 0.35, 0.45], [2.56, 0.25, 0.3], [3.31, 0.15, 0.2]], 0.006), rate, 0.4), 0, 0.32);
  // The harp: two octaves of the Lydian scale up from an octave under the root in 0.34 s.
  const lydian = [0, 2, 4, 6, 7, 9, 11];
  const steps = Array.from({ length: 15 }, (_, i) => lydian[i % 7]! + 12 * Math.floor(i / 7) - 12);
  steps.forEach((n, i) => mix(dry, rate, partials(rate, 0.7, root * semis(n), [[1, 1, 0.35], [2, 0.3, 0.14], [3, 0.12, 0.07]], 0.002), i * 0.024, 0.1));
  // The chord it lands on, held and trembling.
  const land = 0.36;
  for (const n of [-12, 0, 4, 6, 11, 14]) mix(dry, rate, shimmer(rate, root * semis(n), sec - land, 0.04, 0.85), land, n < 0 ? 0.1 : 0.075);
  // The crystal ting on the landing.
  mix(dry, rate, partials(rate, 1.2, root * 4, [[1, 1, 0.5], [2.76, 0.3, 0.16], [5.4, 0.1, 0.06]], 0.001), land, 0.14);
  return room(dry, rate, 0.88, 0.6);
}

// ---------------- The pieces, by name ----------------

/** A tick's level (timeline.ts `tickLevel`): how fast the strip is (1 at full speed: a lighter tick; 0 slow: the reel's full weight). */
const TICKS: readonly number[] = [1, 0.6, 0.2, 0, 0, 0];

/** The reel's own hum under the ticks, as loud as it's fast, over a spin of `spinMs`. */
function whirr(rate: number, spinMs: number): Float32Array {
  const spin = spinMs / 1000;
  const out = new Float32Array(Math.ceil(rate * spin));
  const n = noise(3);
  const bp = bandpass(rate, () => 320, 0.8, () => n(0));
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    out[i] = bp(t) * 0.27 * (1 - t / spin) ** (EASE_POWER - 1) * Math.min(1, t * 20);
  }
  return out;
}

/** The box dropping in and landing, from the drop's start. */
function land(rate: number, T: Timeline): Float32Array {
  const out = new Float32Array(Math.ceil(rate * (T.dropMs / 1000 + 0.35)));
  boxLand(rate, T, out, 0);
  return out;
}

/** The shake's knocks, from just after the landing to the burst. */
function shake(rate: number, T: Timeline, tier: ItemTier): Float32Array {
  const from = T.landAt / 1000 + 0.06;
  const out = new Float32Array(Math.ceil(rate * (T.burstAt / 1000 - from + 0.1)));
  // (boxShake works in the whole sequence's seconds: a timeline shifted so the shake starts at 0 here.)
  boxShake(rate, { ...T, burstAt: T.burstAt - from * 1000 }, out, 0);
  return out;
}

/** Trims a buffer's silent end (the room's). */
function trim(out: Float32Array): Float32Array {
  let end = out.length;
  while (end > 0 && Math.abs(out[end - 1]!) < 1e-4) end--;
  return out.slice(0, end);
}

/** The burst and the sting, with its room's tail. */
function stingAlone(rate: number, tier: ItemTier): Float32Array {
  const s = STINGS[tier];
  const out = new Float32Array(Math.ceil(rate * (s.sec + 0.6 + 1.6 * s.roomSize + 0.1)));
  sting(rate, tier, out, 0);
  return trim(out);
}

function make(name: string, rate: number): Float32Array {
  const T = timeline();
  if (name === "whirr") return whirr(rate, T.spinMs);
  if (name === "lock") return reelLock(rate).map((v) => v * 1.6);
  if (name === "land") return land(rate, T);
  if (name === "transcendent") return trim(transcendent(rate));
  const tick = /^tick(\d)([ab])$/.exec(name);
  if (tick) {
    const fast = TICKS[Number(tick[1])]!;
    const loud = 2.2 * (0.6 + 0.4 * (1 - fast)) * 0.62;
    return reelClack(rate, tick[2] === "a" ? 100 : 101, 1 - fast).map((v) => v * loud);
  }
  const [kind, tier] = name.split("-") as [string, ItemTier];
  if (kind === "shake") return shake(rate, T, tier);
  if (kind === "sting") return stingAlone(rate, tier);
  throw new Error(`no crate sound ${name}`);
}

/**
 * The level: the mockup's clips were leveled as a whole (about 0.92 × tanh(1.2 x)); here each piece the same way, then 4 dB under
 * (the clicks about a move's loudness, the sting about 7 dB over it: a moment, not a jingle).
 */
const LEVEL = 0.92 * 10 ** (-4 / 20);

/** Every piece but the tiers' (the worker makes them ahead as an Open is tapped; a tier's shake and sting once the roll is in). */
export const CRATE_SOUNDS: readonly string[] = [
  "whirr",
  "lock",
  "land",
  ...TICKS.flatMap((_, i) => [`tick${i}a`, `tick${i}b`]),
];
/** Every tier's own: its shake and its sting. */
export const TIER_SOUNDS: readonly string[] = TIERS.flatMap((t) => [`shake-${t.id}`, `sting-${t.id}`]);

const cache = soundCache("crate");
/** The samples of one piece at a sample rate (made once, then reused). */
export function crateSound(name: string, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = make(name, rate).map((v) => LEVEL * Math.tanh(1.2 * v));
    cache.set(key, s);
  }
  return s;
}

/**
 * The whole opening's sound offline (the clip script's MP4): every cue mixed at its time, as the live opening schedules them. `cues`
 * from timeline.ts; `lengthMs` the clip's length.
 */
export function renderCues(rate: number, list: readonly { at: number; sound: string }[], lengthMs: number): Float32Array {
  const out = new Float32Array(Math.ceil((rate * lengthMs) / 1000));
  for (const c of list) mix(out, rate, crateSound(c.sound, rate), c.at / 1000);
  return out;
}
