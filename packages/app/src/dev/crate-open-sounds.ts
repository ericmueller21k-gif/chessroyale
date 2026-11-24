/**
 * MOCKUP (claude/crate-open-mockup, Nov 24): three sound options for the crate opening, made in code the game's way (no files,
 * no licenses; the bosses' sounds are made the same way: characters/synth.ts). Each is a pure function of the sample rate and
 * a seed, so the clips rendered to MP3/WAV (scripts/crate-open-sounds.ts) are exactly what the mockup page plays.
 *
 * Eric (Nov 24): "sound more like ... a playing card being moved through the spoke of a wheel ... right now it's like that marimba
 * ... a little too silly sounding."
 *   A "spokes":  a stiff card flapping against bicycle spokes: a papery snap with a little body, buzzing at speed, fluttering as it
 *                slows, a rattle at the stop; then a clean glassy reveal.
 *   B "ratchet": a prize wheel's plastic clicker on pegs: a sharp hollow click, the clicker dragging up each peg as it slows, a
 *                final thunk as it drops between two; then a warm bell.
 *   C "reel":    a slot machine's heavier metal tick, a low swell rising under the slowdown, a clunk as it locks; then a fuller pad.
 * After the strip stops, all three share the box: its drop, the thud as it lands, the shake rising to the burst, and the sting
 * (its chord climbs with the tier; Legendary and Mythic get the bigger ending).
 */
import type { ItemTier } from "@chessroyale/core";
import { bandpass, noise, rng } from "../characters/synth.ts";
import { EASE_POWER, LAND_JITTER, OVERSHOOT, clickTimes, isBig, timeline, type Timeline } from "./crate-open-timeline.ts";

export type CrateSoundOption = "spokes" | "ratchet" | "reel";
export const CRATE_SOUND_OPTIONS: readonly { id: CrateSoundOption; letter: string; name: string; blurb: string }[] = [
  { id: "spokes", letter: "A", name: "Card in the spokes", blurb: "A stiff card flapping on spokes, then a clean glassy sting" },
  { id: "ratchet", letter: "B", name: "Prize-wheel ratchet", blurb: "A plastic clicker on pegs, a final thunk, then a warm bell" },
  { id: "reel", letter: "C", name: "Slot reel", blurb: "A heavier metal tick over a rising swell, then a fuller sting" },
];

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

/** A: one flap of a stiff card on a spoke. `fast` (0 to 1): at speed the card never settles, so each flap is shorter, brighter, no flutter. */
function cardFlap(rate: number, seed: number, fast: number, flutter: number): Float32Array {
  const r = rng(seed);
  const len = 0.05 + 0.09 * flutter;
  const out = new Float32Array(Math.ceil(rate * len));
  // The snap: paper slapping the spoke (a noisy crack, band-passed high and wide).
  const snap = shape(biquad(whiteNoise(rate, 0.02, seed), rate, "bp", 2600 + 900 * fast + 300 * r(), 0.9), rate, ad(0.0004, 0.0032));
  mix(out, rate, snap, 0, 1.0);
  // The card's own stiff body ringing for a moment (a little different each time it's bent).
  mix(out, rate, partials(rate, 0.04, 1050 + 220 * r(), [[1, 0.5, 0.009], [1.83, 0.22, 0.005]]), 0, 0.45);
  // The spoke itself, a dull knock under it.
  mix(out, rate, partials(rate, 0.04, 240 + 40 * r(), [[1, 1, 0.012]]), 0, 0.22 * (1 - 0.5 * fast));
  // The card springing back (a second, softer slap) once it has room to.
  if (fast < 0.85) mix(out, rate, shape(biquad(whiteNoise(rate, 0.012, seed + 7), rate, "bp", 2000, 1.2), rate, ad(0.0005, 0.0025)), 0.008 + 0.004 * r(), 0.35 * (1 - fast));
  // Slow: it flutters, a few quicker, fainter flaps as it settles (the rattle).
  for (let k = 1; k <= Math.round(4 * flutter); k++) {
    const at = 0.018 * k + 0.004 * r();
    mix(out, rate, shape(biquad(whiteNoise(rate, 0.01, seed + 11 * k), rate, "bp", 2300 - 150 * k, 1.4), rate, ad(0.0004, 0.002)), at, 0.32 * flutter * Math.pow(0.62, k));
  }
  return out;
}

/** B: the clicker snapping off a peg; `drag` (0 to 1) adds the scrape of it riding up the peg first (heard only when slow). */
function pegClick(rate: number, seed: number, drag: number): { buf: Float32Array; lead: number } {
  const r = rng(seed);
  const lead = 0.045 * drag;
  const out = new Float32Array(Math.ceil(rate * (0.07 + lead)));
  if (drag > 0.05) {
    // Riding up the peg: a faint rising plastic scrape.
    const scrape = biquad(whiteNoise(rate, lead, seed + 3), rate, "bp", 3300, 2.5);
    mix(out, rate, shape(scrape, rate, (t) => (t / lead) ** 2), 0, 0.12 * drag);
  }
  // The snap: a sharp, hollow plastic click.
  const click = shape(biquad(whiteNoise(rate, 0.01, seed), rate, "bp", 4300 + 300 * r(), 2.2), rate, ad(0.0002, 0.0014));
  mix(out, rate, click, lead, 1.1);
  mix(out, rate, partials(rate, 0.05, 1880 + 60 * r(), [[1, 0.6, 0.006], [1.62, 0.35, 0.004], [2.9, 0.15, 0.003]]), lead, 0.55);
  // The clicker's arm springing.
  mix(out, rate, partials(rate, 0.06, 510, [[1, 1, 0.014]]), lead, 0.16);
  return { buf: out, lead };
}

/** B's last: the clicker dropping between two pegs with the wheel's weight behind it, and the little bounce after. */
function wheelThunk(rate: number): Float32Array {
  const out = new Float32Array(Math.ceil(rate * 0.3));
  mix(out, rate, sweep(rate, 0.2, 190, 115, 0.06, ad(0.001, 0.05)), 0, 0.7);
  mix(out, rate, shape(biquad(whiteNoise(rate, 0.06, 41), rate, "lp", 900, 0.7), rate, ad(0.0005, 0.012)), 0, 0.9);
  mix(out, rate, pegClick(rate, 77, 0).buf, 0, 0.6);
  mix(out, rate, pegClick(rate, 78, 0).buf, 0.07, 0.18);
  return out;
}

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

/** The shake: the box knocking about faster and faster, and the light's charge rising under it to the burst. */
function boxShake(rate: number, T: Timeline, out: Float32Array, tier: ItemTier, big: boolean, from: number) {
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
  // The charge: a rising band of noise and a rising tone, swelling into the burst.
  const n = noise(21);
  const charge = new Float32Array(Math.ceil(rate * len));
  const bp = bandpass(rate, (x) => 350 * Math.pow(12, x / len), 2.2, () => n(0));
  const top = big ? 2 : 1.5;
  const root = stingRoot(tier) / 4;
  let ph = 0;
  for (let i = 0; i < charge.length; i++) {
    const x = i / rate;
    const u = x / len;
    ph += (root * Math.pow(top, u)) / rate;
    charge[i] = (bp(x) * 0.9 + Math.sin(TAU * ph) * 0.18 + Math.sin(TAU * ph * 2.003) * 0.08) * u ** 2.2;
  }
  mix(out, rate, charge, s0, big ? 0.55 : 0.4);
}

/** The sting's root: it climbs with the tier, so a better item sounds brighter before you've read it. */
function stingRoot(tier: ItemTier): number {
  const steps: Record<ItemTier, number> = { common: -3, uncommon: -1, rare: 1, epic: 4, legendary: 0, mythic: 3 };
  return 523.25 * Math.pow(2, steps[tier] / 12);
}

/** The chord's notes over a root: a bright major add-9 (not a jingle). */
const CHORD = [1, 1.2599, 1.4983, 2, 2.2449];

type StingVoice = "glass" | "bell" | "pad";
const VOICE_OF: Record<CrateSoundOption, StingVoice> = { spokes: "glass", ratchet: "bell", reel: "pad" };

/** One note of the sting in a voice. */
function stingNote(rate: number, voice: StingVoice, f: number, sec: number, big: boolean): Float32Array {
  if (voice === "glass") {
    const a = partials(rate, sec, f, [[1, 1, 0.9], [2.76, 0.22, 0.22], [5.4, 0.08, 0.08]], 0.003);
    const b = partials(rate, sec, f, [[1, 0.6, 1.0]], 0.003, 0.0022); // a hair sharp: the shimmer
    for (let i = 0; i < a.length; i++) a[i]! += b[i]!;
    return a;
  }
  if (voice === "bell") {
    return partials(rate, sec, f, [[0.5, 0.25, 1.4], [1, 1, 1.1], [2, 0.38, 0.6], [2.98, 0.18, 0.3], [4.1, 0.09, 0.15]], 0.002);
  }
  // A pad: three detuned saws through a soft low-pass (opened by the hit), a bell on top.
  const env = (t: number) => Math.min(1, t / 0.012) * Math.exp(-t / (big ? 1.1 : 0.7));
  const out = new Float32Array(Math.ceil(rate * sec));
  for (const d of [-0.004, 0, 0.0045]) mix(out, rate, saw(rate, sec, f * (1 + d), env, 3600), 0, 0.33);
  const soft = biquad(out, rate, "lp", 2600, 0.7);
  mix(soft, rate, partials(rate, sec, f * 2, [[1, 0.35, 0.5]]), 0, 1);
  return soft;
}

/** The burst and the reveal's sting (the bigger one for Legendary and Mythic). */
function sting(rate: number, option: CrateSoundOption, tier: ItemTier, out: Float32Array, at: number) {
  const big = isBig(tier);
  const voice = VOICE_OF[option];
  const root = stingRoot(tier);
  const sec = big ? 2.0 : 1.5;
  const dry = new Float32Array(Math.ceil(rate * (sec + 0.3)));
  // The lid cracking off: a short bright crack, and a low boom under it.
  mix(dry, rate, shape(biquad(whiteNoise(rate, 0.05, 61), rate, "hp", 900, 0.7), rate, ad(0.0003, 0.009)), 0, 0.6);
  mix(dry, rate, sweep(rate, big ? 0.9 : 0.5, big ? 70 : 90, big ? 32 : 48, big ? 0.35 : 0.2, ad(0.002, big ? 0.28 : 0.14)), 0, big ? 1.0 : 0.6);
  // The beam shooting up: a rising whoosh.
  const wl = big ? 0.7 : 0.45;
  const n = noise(62);
  const bp = bandpass(rate, (t) => 500 * Math.pow(big ? 14 : 9, t / wl), 1.6, () => n(0));
  const whoosh = new Float32Array(Math.ceil(rate * wl));
  for (let i = 0; i < whoosh.length; i++) {
    const t = i / rate;
    whoosh[i] = bp(t) * Math.sin((Math.PI * t) / wl) ** 1.5;
  }
  mix(dry, rate, whoosh, 0, big ? 0.45 : 0.3);
  // The chord, strummed upward quickly.
  const notes = big ? [0.5, ...CHORD, 3] : CHORD;
  notes.forEach((m, i) => mix(dry, rate, stingNote(rate, voice, root * m, sec, big), 0.012 + i * (big ? 0.022 : 0.016), (big ? 0.2 : 0.22) * (m < 1 ? 0.8 : 1)));
  if (big) {
    // Legendary: a rising sparkle run over the chord, and a held choir of the chord an octave down.
    [2, 2.52, 3, 4, 5.04, 6, 8].forEach((m, i) => mix(dry, rate, partials(rate, 0.5, root * m, [[1, 1, 0.16], [2.76, 0.2, 0.05]], 0.002), 0.09 + i * 0.045, 0.09));
    const choir = (t: number) => Math.min(1, t / 0.12) * Math.exp(-t / 1.3);
    const pad = new Float32Array(Math.ceil(rate * sec));
    for (const m of [0.5, 0.63, 0.75, 1]) for (const d of [-0.006, 0.006]) mix(pad, rate, saw(rate, sec, root * m * (1 + d), choir, 2400), 0, 0.12);
    mix(dry, rate, biquad(pad, rate, "lp", 1700, 0.7), 0.03, 1);
  }
  // A few glints high up, as the light catches.
  const r = rng(71);
  for (let i = 0; i < (big ? 12 : 6); i++) {
    mix(dry, rate, partials(rate, 0.25, 2600 + 4200 * r(), [[1, 1, 0.07 + 0.08 * r()]], 0.001), 0.05 + r() * (big ? 0.9 : 0.5), 0.035);
  }
  mix(out, rate, room(dry, rate, big ? 0.85 : 0.65, big ? 0.55 : 0.4), at, 1);
}

// ---------------- The whole sequence ----------------

export interface CrateClip {
  option: CrateSoundOption;
  tier: ItemTier;
  /** The strip's length (ms; the game's is 6200). */
  spinMs?: number;
  /** The strip's width in px (where the clicks fall). */
  width?: number;
  /** Where it lands in the winning tile (-0.3 to 0.3 of a tile) and how far it overshoots before settling back (px). */
  jitter?: number;
  overshoot?: number;
}

/** The sounds, as events (ms), for the mockup page to check against its picture: the clicks and the beats. */
export function clipEvents(c: CrateClip) {
  const T = timeline(c.spinMs);
  return { T, clicks: clickTimes(T.spinMs, c.width ?? 360, c.jitter ?? LAND_JITTER, c.overshoot ?? OVERSHOOT) };
}

/**
 * The whole opening, spin to sting, as samples at `rate` (mono, peak at about -1 dBFS): the clips' and the mockup page's sound.
 * `from`/`to` (ms) cut a part out (the Legendary ending's clip).
 */
export function renderCrateClip(rate: number, c: CrateClip, from = 0, to?: number): Float32Array {
  const { T, clicks } = clipEvents(c);
  const endMs = to ?? T.end;
  const out = new Float32Array(Math.ceil((rate * (T.end + 400)) / 1000));
  const spin = T.spinMs / 1000;
  // The strip's own whirr under the clicks, as loud as it's fast.
  const hum = c.option === "spokes" ? [700, 0.05] : c.option === "ratchet" ? [450, 0.025] : [320, 0.045];
  const n = noise(3);
  const bp = bandpass(rate, () => hum[0]!, 0.8, () => n(0));
  for (let i = 0; i < Math.ceil(rate * spin); i++) {
    const u = i / rate / spin;
    out[i]! += bp(i / rate) * hum[1]! * 6 * (1 - u) ** (EASE_POWER - 1) * Math.min(1, (i / rate) * 20);
  }
  // The clicks.
  clicks.forEach((ms, i) => {
    const next = clicks[i + 1] ?? ms + 400;
    const prev = i > 0 ? clicks[i - 1]! : ms - 20;
    const gap = Math.min(next - ms, 400);
    const fast = Math.max(0, Math.min(1, (60 - (ms - prev)) / 40)); // 1 at 20 ms apart, 0 from 60 ms
    const at = ms / 1000;
    const loud = 2.2 * (0.6 + 0.4 * (1 - fast));
    if (c.option === "spokes") {
      const flutter = Math.max(0, Math.min(1, (gap - 70) / 200));
      mix(out, rate, cardFlap(rate, 100 + i, fast, flutter), at, loud * 0.8);
    } else if (c.option === "ratchet") {
      const drag = Math.max(0, Math.min(1, (gap - 90) / 220));
      const { buf, lead } = pegClick(rate, 100 + i, drag);
      mix(out, rate, buf, at - lead, loud * 0.75);
    } else {
      mix(out, rate, reelClack(rate, 100 + i, 1 - fast), at, loud * 0.62);
    }
  });
  // The stop: the strip settles back onto the winner.
  const stop = T.stop / 1000;
  if (c.option === "spokes") {
    // The card comes to rest against a spoke: one soft flap and its flutter dying away.
    mix(out, rate, cardFlap(rate, 500, 0, 1), stop - 0.05, 1.2);
  } else if (c.option === "ratchet") {
    mix(out, rate, wheelThunk(rate), stop - 0.04, 1.6);
  } else {
    // C: the swell under the slowdown, from a third of the way in up to the lock, and the lock.
    const s0 = spin * 0.3;
    const len = stop - 0.03 - s0;
    const sw = new Float32Array(Math.ceil(rate * len));
    let ph = 0;
    let ph2 = 0;
    for (let i = 0; i < sw.length; i++) {
      const u = i / rate / len;
      const f = 98 * Math.pow(2, u);
      ph += f / rate;
      ph2 += (f * 1.5) / rate;
      const sawish = (p: number) => 2 * (p % 1) - 1;
      sw[i] = (sawish(ph) * 0.6 + sawish(ph2) * 0.35 + sawish(ph * 1.004) * 0.5) * u ** 1.8;
    }
    // (Its low-pass opens as it rises.)
    const lowAt = biquad(sw, rate, "lp", 500, 0.8);
    const highAt = biquad(sw, rate, "lp", 2400, 0.8);
    for (let i = 0; i < sw.length; i++) {
      const u = i / sw.length;
      sw[i] = lowAt[i]! * (1 - u) + highAt[i]! * u;
    }
    mix(out, rate, sw, s0, 0.3);
    mix(out, rate, reelLock(rate), stop - 0.04, 1.6);
  }
  boxLand(rate, T, out, T.dropAt / 1000);
  boxShake(rate, T, out, c.tier, isBig(c.tier), T.landAt / 1000 + 0.06);
  sting(rate, c.option, c.tier, out, T.burstAt / 1000);
  // Cut, fade the cut's ends, ceiling and level.
  const a = Math.round((rate * from) / 1000);
  const b = Math.min(out.length, Math.round((rate * endMs) / 1000));
  const clip = out.slice(a, b);
  const fadeIn = from > 0 ? Math.round(rate * 0.06) : Math.round(rate * 0.003);
  const fadeOut = Math.round(rate * 0.35);
  for (let i = 0; i < clip.length; i++) {
    const e = Math.min(1, i / fadeIn, (clip.length - 1 - i) / fadeOut);
    clip[i] = Math.tanh(clip[i]! * 1.2) * e;
  }
  let peak = 0;
  for (const v of clip) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 0.89 / peak : 1; console.log("g", c.tier, g.toFixed(3));
  for (let i = 0; i < clip.length; i++) clip[i]! *= g;
  return clip;
}

/** The Legendary ending on its own (the brief's 1 to 2 s clip): from just before the burst to the sting's tail. */
export function renderLegendaryEnding(rate: number, option: CrateSoundOption, tier: ItemTier = "legendary"): Float32Array {
  const T = timeline();
  return renderCrateClip(rate, { option, tier }, T.burstAt - 280, T.burstAt + 1700);
}
