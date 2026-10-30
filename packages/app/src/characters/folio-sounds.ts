/**
 * Folio's, the paper crane's, sounds, synthesized (no files, no licenses), as the other bosses' are. A crane folded from a page:
 * everything it does sounds like paper. A rustle as it drifts or flutters, a crisp fold (a sharp crease pressed flat), a soft
 * unfold, a gentle wing flap, a pen's scratch for its ink (and a shorter dab), a page turning for its Revision, a crumple when
 * hurt, and its gilt's small glint (a soft high chime). Its select sound: a page turn and a flap.
 *
 * Its voice, for its lines (Eric, Oct 27, from three he heard): a little crane's chirp, two quick soft rising bird notes after a
 * paper crinkle, the same short sound for every line, played as a line of its starts (speech.tsx, `lineSounds`). (Its first
 * voice, a whispered babble as long as the line, stood out from every other boss's sounds.) In the town square, a tap on it
 * says a low, slow murmur or a soft "mm-hm", in turn (`murmur`, `hum`: boss-select.ts, TOWN_SOUNDS).
 *
 * Each is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays quieter than a
 * piece's move (peak and loudness), and the ten strokes of its attack on a king together too.
 *
 * Which cue plays which: kit.sounds in kits.ts (its animations' cues), and the board art's in power-art.ts (EFFECTS).
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, soundCache, type Voice } from "./synth.ts";

export type FolioSound = "rustle" | "fold" | "unfold" | "flap" | "scratch" | "dab" | "page" | "crumple" | "glint" | "hello" | "voice" | "murmur" | "hum";

const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
const lerp = (a: number, b: number, u: number) => a + (b - a) * clamp01(u);
/** Noise with its highs rolled off twice: a breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** Scaled to a loudness of 1 (its RMS), so each sound's LEVEL sets it. */
function unit(s: Float32Array): Float32Array {
  const loud = Math.sqrt(s.reduce((a, v) => a + v * v, 0) / Math.max(1, s.length)) || 1;
  return s.map((v) => v / loud);
}

/** Sums sounds, each starting at its own time (seconds), into one of `dur` seconds. */
function mix(rate: number, dur: number, parts: readonly (readonly [number, Float32Array, number?])[]): Float32Array {
  const out = new Float32Array(Math.ceil(rate * dur));
  for (const [at, w, gain = 1] of parts) {
    const start = Math.round(at * rate);
    for (let i = 0; i < w.length && start + i < out.length; i++) out[start + i]! += gain * w[i]!;
  }
  return out;
}

/**
 * Paper crackling: `clicks` tiny bright snaps scattered over `dur` seconds (densest where `shape` is), each a few ms of noise
 * through a band round `centre` Hz, over a soft hiss of paper sliding on paper.
 */
function crackle(rate: number, dur: number, clicks: number, centre: number, seed: number, shape: (u: number) => number, hiss = 0.35): Float32Array {
  const r = rng(seed);
  const at: { t: number; a: number; w: number }[] = [];
  while (at.length < clicks) {
    const u = r();
    if (r() < shape(u)) at.push({ t: u * dur, a: 0.4 + 0.6 * r(), w: 0.002 + 0.004 * r() });
  }
  at.sort((a, b) => a.t - b.t);
  const snap = bandpass(rate, () => centre, 1.3, noise(seed + 1));
  const slide = bandpass(rate, () => centre * 0.55, 0.8, murk(rate, 9000, seed + 2));
  let k = 0;
  return render(rate, dur, (t) => {
    while (k < at.length - 1 && at[k + 1]!.t <= t) k++;
    let v = 0;
    for (let j = Math.max(0, k - 2); j <= Math.min(at.length - 1, k + 1); j++) {
      const c = at[j]!;
      if (t >= c.t && t < c.t + c.w * 4) v += c.a * Math.exp(-(t - c.t) / c.w);
    }
    const s = snap(t);
    const sl = slide(t);
    return v * s * 3 + hiss * shape(t / dur) * sl;
  });
}

/**
 * A short, soft bird note (it's a crane): a sine gliding from `f0` to `f1` Hz over `d` seconds, a quick start and a fall
 * away after it.
 */
function note(rate: number, f0: number, f1: number, d: number): Float32Array {
  const o = osc(rate, (t) => lerp(f0, f1, t / d), sine);
  return render(rate, d + 0.02, (t) => Math.min(1, t / 0.008) * Math.exp(-Math.max(0, t - 0.02) / (d * 0.5)) * o(t));
}

/**
 * Hummed syllables (its town sounds): each a round voiced tone (a sine with a little of its second and third harmonics, never
 * buzzy) through a vowel's two formants, its pitch gliding from `p0` to `p1` Hz, a faint paper crinkle as it starts.
 */
function hum(rate: number, syllables: readonly { at: number; d: number; p0: number; p1: number; v: readonly [number, number] }[], seed: number): Float32Array {
  const out = new Float32Array(Math.ceil((Math.max(...syllables.map((s) => s.at + s.d)) + 0.05) * rate));
  syllables.forEach((s, k) => {
    const src = osc(rate, (t) => lerp(s.p0, s.p1, t / s.d), (ph) => Math.sin(ph) + 0.25 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph));
    const f1 = bandpass(rate, () => s.v[0], 3, src);
    const f2 = bandpass(rate, () => s.v[1], 5, src);
    const crinkle = bandpass(rate, () => 5000, 1.6, noise(seed + k));
    const start = Math.round(s.at * rate);
    const len = Math.ceil((s.d + 0.03) * rate);
    for (let i = 0; i < len && start + i < out.length; i++) {
      const t = i / rate;
      const env = Math.min(1, t / 0.015) * Math.max(0, Math.min(1, (s.d + 0.02 - t) / 0.06));
      const c = t < 0.012 ? 0.25 * crinkle(t) * (1 - t / 0.012) : 0;
      out[start + i]! += env * (f1(t) + 0.5 * f2(t) + 0.35 * src(t)) + c;
    }
  });
  return unit(out);
}

const SOUNDS: Record<FolioSound, (rate: number) => Float32Array> = {
  // Paper rustling as it drifts, settles or flutters: a soft shower of crackles that swells and fades.
  rustle: (rate) => unit(crackle(rate, 0.28, 26, 4200, 4101, (u) => Math.sin(Math.PI * clamp01(u)) ** 0.7)),
  // A crisp fold: a quick slide of paper on paper, then the crease pressed flat, a sharp dry snap with a little body under it.
  fold: (rate) => {
    const slide = crackle(rate, 0.09, 8, 3600, 4103, (u) => u, 0.6);
    const snap = bandpass(rate, () => 3000, 1.1, noise(4105));
    const body = bandpass(rate, () => 700, 1, murk(rate, 3000, 4107));
    const press = render(rate, 0.12, (t) => Math.min(1, t / 0.0015) * (Math.exp(-t / 0.012) * 2.2 * snap(t) + Math.exp(-t / 0.03) * 0.8 * body(t)));
    return unit(mix(rate, 0.22, [[0, slide, 0.6], [0.08, press, 1]]));
  },
  // A soft unfold: paper opening slowly, a long low rustle that rises and settles.
  unfold: (rate) => unit(crackle(rate, 0.5, 22, 2600, 4109, (u) => Math.sin(Math.PI * clamp01(u)) ** 1.2, 0.55)),
  // A gentle wing flap: a soft whoosh of air, a paper wing's give at its end.
  flap: (rate) => {
    const air = bandpass(rate, (t) => lerp(900, 1600, t / 0.18), 0.7, murk(rate, 4000, 4111));
    const whoosh = render(rate, 0.22, (t) => Math.sin(Math.PI * clamp01(t / 0.22)) ** 1.5 * air(t));
    const give = crackle(rate, 0.06, 4, 4400, 4113, () => 1, 0.2);
    return unit(mix(rate, 0.26, [[0, whoosh, 1], [0.15, give, 0.35]]));
  },
  // A pen's scratch: a nib dragged over paper, a narrow band of noise that judders as the nib catches the grain, in a short stroke.
  scratch: (rate) => {
    const nib = bandpass(rate, (t) => lerp(3400, 4300, t / 0.22), 3, noise(4115));
    return unit(render(rate, 0.24, (t) => Math.sin(Math.PI * clamp01(t / 0.24)) ** 0.6 * (0.55 + 0.45 * Math.sin(2 * Math.PI * 46 * t)) * nib(t)));
  },
  // A shorter stroke: the pen's dab and flick (its attack's other stroke, so the two never sound the same twice running).
  dab: (rate) => {
    const nib = bandpass(rate, (t) => lerp(4600, 3600, t / 0.1), 2.6, noise(4117));
    const tap = bandpass(rate, () => 1800, 1.2, noise(4119));
    return unit(render(rate, 0.12, (t) => Math.min(1, t / 0.002) * (Math.exp(-t / 0.05) * nib(t) + Math.exp(-t / 0.006) * 0.8 * tap(t))));
  },
  // A page turning (its Revision): the page lifted with a crinkle, swept over with a soft whoosh, laid down with a light flap.
  page: (rate) => {
    const lift = crackle(rate, 0.12, 10, 4600, 4121, (u) => 1 - u * 0.5, 0.4);
    const air = bandpass(rate, (t) => lerp(1200, 2400, t / 0.3), 0.6, murk(rate, 6000, 4123));
    const sweep = render(rate, 0.3, (t) => Math.sin(Math.PI * clamp01(t / 0.3)) * air(t));
    const lay = crackle(rate, 0.08, 6, 3000, 4125, (u) => 1 - u, 0.5);
    return unit(mix(rate, 0.5, [[0, lift, 0.7], [0.08, sweep, 1], [0.38, lay, 0.6]]));
  },
  // Hurt: the paper crumpling, a dense burst of crackles.
  crumple: (rate) => unit(crackle(rate, 0.26, 48, 3400, 4127, (u) => Math.exp(-3 * u), 0.5)),
  // The gilt's small glint: two soft, high bell tones, the second a little later and quieter.
  glint: (rate) => {
    const a = osc(rate, () => 2637, sine);
    const b = osc(rate, () => 3520, sine);
    const ta = osc(rate, () => 2637 * 2.76, sine);
    return unit(render(rate, 0.5, (t) => Math.min(1, t / 0.003) * (Math.exp(-t / 0.12) * (a(t) + 0.15 * ta(t)) + (t > 0.07 ? 0.6 * Math.exp(-(t - 0.07) / 0.12) * b(t) : 0))));
  },
  // Its select sound: a page turning, then its wing's flap.
  hello: (rate) => unit(mix(rate, 0.8, [[0, SOUNDS.page(rate), 1], [0.46, SOUNDS.flap(rate), 0.9]])),
  // Its voice, for every line: a paper crinkle, then two quick soft rising chirps.
  voice: (rate) =>
    unit(mix(rate, 0.32, [[0, render(rate, 0.03, (t) => (1 - t / 0.03) * bandpass(rate, () => 4800, 1.4, noise(4131))(t)), 0.35], [0.02, note(rate, 1100, 1450, 0.07), 1], [0.14, note(rate, 1250, 1650, 0.09), 0.85]])),
  // Its town sounds: a low, slow three-syllable murmur, and a soft "mm-hm".
  murmur: (rate) =>
    hum(rate, [
      { at: 0.01, d: 0.1, p0: 330, p1: 350, v: [580, 1900] },
      { at: 0.15, d: 0.1, p0: 360, p1: 340, v: [400, 900] },
      { at: 0.29, d: 0.14, p0: 320, p1: 270, v: [500, 950] },
    ], 4133),
  hum: (rate) =>
    hum(rate, [
      { at: 0.01, d: 0.13, p0: 300, p1: 320, v: [400, 900] },
      { at: 0.18, d: 0.16, p0: 290, p1: 245, v: [500, 950] },
    ], 4135),
};

/** Each sound's level: all soft (a calm paper crane), every one under a move's loudness; a soft ceiling keeps the peaks well under. */
const LEVEL: Record<FolioSound, number> = {
  rustle: 0.035,
  fold: 0.045,
  unfold: 0.03,
  flap: 0.04,
  scratch: 0.035,
  dab: 0.035,
  page: 0.04,
  crumple: 0.04,
  glint: 0.035,
  hello: 0.045,
  voice: 0.04,
  murmur: 0.04,
  hum: 0.04,
};

const cache = soundCache("folio");
/** The samples for one of its sounds at a sample rate (made once, then reused). */
export function folioSound(name: FolioSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const FOLIO_SOUNDS = Object.keys(SOUNDS) as FolioSound[];

