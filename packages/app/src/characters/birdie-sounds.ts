/**
 * Birdie's sounds, synthesized (no files, no licenses), his own as every boss's are (Eric, Nov 18: never another boss's).
 *
 * - **His voice: seven chirps** (Eric, Nov 23: "he chirps throughout the game basically, and also when like you go to challenge him").
 *   The birds of his ult's piece, built from the music helper's recipe (`stills/trailer-v2` `birdie-chirps/README.md`; `BIRDS` and
 *   `tweet_wave` in `scripts/reel/music/song_aj.py` on `claude/trailer-v2`): a phrase is a few notes, each one whistle sliding from
 *   `f0` to `f1` Hz, a little of its octave in it, swelling and dying with no edge; some tremble.
 * - **His move: five whistles** (Eric, Nov 23: "more whistles than the other stuff ... like the double whistle, you know how the trains go
 *   like toot toot?"): his train's steam whistle (`birdie-train/README.md`, `whistle_wave`): a toot, the double toot, a long blast, a toot
 *   then a long one, and two peeps on a smaller, higher whistle. Picked per move by `birdieWhistle`.
 * - **His train: three runs** (the locomotive of the same piece: `chuff_wave`, `knock_wave`, `steam_wave` there and `birdie_train.py`):
 *   exhaust puffs an 8th of the song apart (162 bpm; his ride's long run a dotted 8th, as his train rides slower: RIDE_PACE), rail
 *   joints, steam at a long run's stop, the whistle's toot over the toot run's start. His entrance, his ride and its loop in the town
 *   (`BIRDIE_RIDE_LOOP`), his challenge's wipe; no longer his move.
 * - The rest are his first pack's: the conductor's whistle (his signal), the crossing's bell, the brakes, a little hop, the smash on a
 *   piece, his fall's whoosh and his armor's clank.
 *
 * Each is a pure function of the sample rate (its noise seeded), so every device makes the same sound and a test can measure it: every
 * one stays quieter than a piece's move (peak and loudness), and a chirp over a move's whistle too (test/birdie-sounds.test.ts).
 * Which cue plays which: kit.sounds and kit.cueSound in kits.ts (his animations' cues) and his board art's (characters/effects/birdie.ts).
 */
import { bandpass, lowpass, noise, osc, render, sine, soft, soundCache, type Voice } from "./synth.ts";

export type BirdieChirp = "hello" | "tsip" | "teeoo" | "trill" | "cheer" | "ask" | "scold";
export type BirdieRun = "trainMedium" | "trainLong" | "trainToot";
export type BirdieWhistle = "whistleToot" | "whistleTootToot" | "whistleLong" | "whistleTootLong" | "whistlePeepPeep";
export type BirdieSound = BirdieChirp | BirdieRun | BirdieWhistle | "toot" | "whistle" | "bell" | "brake" | "hop" | "smash" | "whoosh" | "clank";

const TAU = 2 * Math.PI;

// ---- His voice.

/** A note: (seconds into the phrase, Hz it starts on, Hz it ends on, how long, how loud, how fast it trembles: 0 steady). */
type Note = readonly [at: number, f0: number, f1: number, secs: number, loud: number, shake: number];
/** The phrases, the recipe's table word for word (`BIRDS`). */
const BIRDS: Record<Exclude<BirdieChirp, "hello">, readonly Note[]> = {
  tsip: [
    [0, 4600, 3300, 0.055, 0.8, 0],
    [0.11, 4600, 3300, 0.055, 1.0, 0],
    [0.22, 4600, 3300, 0.055, 0.9, 0],
    [0.36, 4600, 3300, 0.055, 0.7, 0],
  ],
  teeoo: [
    [0, 3800, 3950, 0.14, 1.0, 0],
    [0.19, 3000, 2750, 0.2, 0.9, 25],
  ],
  trill: [[0, 5200, 5000, 0.42, 0.8, 28]],
  cheer: [
    [0, 2800, 4200, 0.07, 1.0, 0],
    [0.12, 3000, 4500, 0.07, 1.0, 0],
  ],
  ask: [
    [0, 2900, 3050, 0.12, 0.9, 0],
    [0.17, 3700, 4300, 0.16, 1.0, 0],
  ],
  scold: [
    [0, 5000, 3900, 0.045, 1.0, 0],
    [0.075, 4400, 3500, 0.045, 0.9, 0],
    [0.15, 5000, 3900, 0.045, 1.0, 0],
    [0.225, 4400, 3500, 0.045, 0.9, 0],
    [0.3, 5000, 3900, 0.045, 1.0, 0],
    [0.375, 4200, 3200, 0.07, 0.85, 0],
  ],
};
/** The challenge's "hello": the tsip, then the teeoo 1.4 beats of 162 after it at 0.9 (the crossing's first bar). */
const HELLO: readonly (readonly [Exclude<BirdieChirp, "hello">, number, number])[] = [
  ["tsip", 0, 1],
  ["teeoo", (1.4 * 60) / 162, 0.9],
];

/** Adds `w` into `out` from `at` seconds (the samples past its end dropped). */
function lay(out: Float32Array, rate: number, at: number, w: ArrayLike<number>, gain = 1): void {
  const i0 = Math.round(at * rate);
  for (let i = 0; i < w.length && i0 + i < out.length; i++) out[i0 + i]! += w[i]! * gain;
}

/** One note of the bird (its loudest point about 1): `tweet_wave`. */
function tweet(rate: number, f0: number, f1: number, secs: number, shake: number): Float32Array {
  const k = Math.floor(secs * rate);
  const out = new Float32Array(k);
  let ph = 0;
  for (let i = 0; i < k; i++) {
    const t = i / rate;
    const u = t / secs;
    const f = f0 * (f1 / f0) ** u * (shake ? 1 + 0.06 * Math.sin(TAU * shake * t) : 1);
    ph += (TAU * f) / rate;
    const env = Math.sin(Math.PI * u) ** 1.3 * (shake ? 0.6 + 0.4 * Math.cos(TAU * shake * t) : 1);
    out[i] = (Math.sin(ph) + 0.15 * Math.sin(2 * ph)) * env;
  }
  return out;
}

/** A phrase (`birdie_chirps.py`'s `phrase`). */
function chirp(name: BirdieChirp, rate: number): Float32Array {
  const parts = name === "hello" ? HELLO : ([[name, 0, 1]] as const);
  let end = 0;
  for (const [p, at] of parts) for (const [late, , , secs] of BIRDS[p]) end = Math.max(end, at + late + secs);
  const out = new Float32Array(Math.ceil(end * rate) + 1);
  for (const [p, at, loud] of parts) for (const [late, f0, f1, secs, vol, shake] of BIRDS[p]) lay(out, rate, at + late, tweet(rate, f0, f1, secs, shake), vol * loud);
  return out;
}

// ---- His train.

/** Seeded uniform numbers in [-1, 1) (the recipe's `rng.uniform(-1, 1, n)`). */
const uniform = (next: Voice, n: number) => Float64Array.from({ length: n }, () => next(0));

/** Noise as bright as `hz` (each random level held that long), its lows thinned by `hp` (`hiss_noise`). */
function hiss(next: Voice, rate: number, k: number, hz: number, hp = 0): Float64Array {
  const hold = Math.max(1, Math.floor(rate / hz));
  let r = uniform(next, Math.floor(k / hold) + 2);
  if (hp) r = r.slice(1).map((v, i) => v - hp * r[i]!);
  return Float64Array.from({ length: k }, (_, i) => r[Math.floor(i / hold)]!);
}

/** Noise with its highs rolled off above about `cut` Hz (a running mean), its RMS 0.5 (`soft_noise`). */
function softNoise(next: Voice, rate: number, k: number, cut: number): Float64Array {
  const size = Math.max(2, Math.floor(rate / cut / 2));
  // (Each sample the mean of `size` running numbers: the recipe's box filter, its edges left off.)
  const r = uniform(next, k + size);
  const y = new Float64Array(k);
  let sum = 0;
  for (let j = 0; j < size; j++) sum += r[j]!;
  for (let i = 0; i < k; i++) {
    y[i] = sum / size;
    sum += r[i + size]! - r[i]!;
  }
  let ms = 0;
  for (const v of y) ms += v * v;
  const g = 0.5 / (Math.sqrt(ms / k) + 1e-9);
  return y.map((v) => v * g);
}

/** The last `secs` fading out, so nothing clicks (`fade_end`). */
const fadeEnd = (i: number, k: number, rate: number, secs = 0.01) => Math.min(1, (k - 1 - i) / (secs * rate));

/** One puff of the exhaust (`chuff_wave`): soft noise under 1.7 kHz (the strong one 1.1 kHz, longer) with a little hiss. */
function puff(next: Voice, rate: number, strong: boolean): Float64Array {
  const k = Math.floor((strong ? 0.16 : 0.11) * rate);
  const a = softNoise(next, rate, k, strong ? 1100 : 1700);
  const b = hiss(next, rate, k, 4500, 0.5);
  return a.map((v, i) => {
    const t = i / rate;
    return (v + 0.35 * b[i]!) * Math.min(1, t / 0.012) * Math.exp(-t / (strong ? 0.055 : 0.035)) * fadeEnd(i, k, rate);
  });
}

/** A wheel over a rail joint (`knock_wave`): 620 Hz, a thud at 170 Hz under it, a tick of noise. */
function knock(next: Voice, rate: number): Float64Array {
  const k = Math.floor(0.05 * rate);
  const n = hiss(next, rate, k, 6000, 0.5);
  return n.map((h, i) => {
    const t = i / rate;
    return (Math.sin(TAU * 620 * t) * Math.exp(-t / 0.008) + 0.6 * Math.sin(TAU * 170 * t) * Math.exp(-t / 0.02) + 0.5 * h * Math.exp(-t / 0.003)) * fadeEnd(i, k, rate);
  });
}

/** Steam let go (`steam_wave`): a bright hiss that opens in 30 ms and dies away over `secs`. */
function steam(next: Voice, rate: number, secs: number): Float64Array {
  const k = Math.floor(secs * rate);
  return hiss(next, rate, k, 9000, 0.8).map((v, i) => {
    const t = i / rate;
    return v * Math.min(1, t / 0.03) * Math.exp(-t / (secs / 3)) * fadeEnd(i, k, rate, 0.05);
  });
}

/** The whistle's chord in his song: B4, E5, G5. */
const PIPES = [493.88, 659.26, 783.99] as const;
/** The peeps' smaller whistle, a step up the chord: E5, G5, B5. */
const PEEPS = [659.26, 783.99, 987.77] as const;
/**
 * The steam whistle (`whistle_wave`, no fall): three pipes, each with three overtones; it slides up 0.7 of a half step into its note over
 * 50 ms, wavers (0.4% at 6.5 Hz, its level 8% at 11 Hz), sags 0.6 of one over its last fifth; in over 40 ms, let go over 120 ms.
 */
function whistleWave(rate: number, secs: number, pipes: readonly number[] = PIPES): Float64Array {
  const k = Math.floor(secs * rate);
  const last = (k - 1) / rate;
  const w = new Float64Array(k);
  pipes.forEach((hz, j) => {
    let ph = 0;
    for (let i = 0; i < k; i++) {
      const t = i / rate;
      const u = t / last;
      const sag = Math.min(1, Math.max(0, (u - 0.8) / 0.2)) ** 2;
      const f = hz * 2 ** ((-0.7 * Math.exp(-t / 0.05) - 0.6 * sag) / 12) * (1 + 0.004 * Math.sin(TAU * 6.5 * t + j));
      ph += (TAU * f) / rate;
      w[i]! += Math.sin(ph) + 0.5 * Math.sin(2 * ph + 1) + 0.33 * Math.sin(3 * ph + 2) + 0.15 * Math.sin(4 * ph);
    }
  });
  return w.map((v, i) => {
    const t = i / rate;
    return (v / 3) * Math.min(1, t / 0.04) * fadeEnd(i, k, rate, 0.12) * (1 + 0.08 * Math.sin(TAU * 11 * t));
  });
}

/** An 8th of his song (162 bpm): a puff every this many seconds. */
const STEP = 30 / 162;
/** How loud each is against a strong puff: a weak puff, a knock, steam, the whistle. */
const WEAK = 0.6;
const KNOCK = 0.41;
const STEAM = 0.32;
const WHISTLE = 0.4;
/**
 * His ride's run (`trainLong`, from his `depart`'s `pull` cue to the train's tail past the board) paced to his slower ride (Eric, Nov 23:
 * "slow the train a bit down": BOSS_POWERS.birdie.trainRideMs 1300 -> 1950): its puffs and joints this much further apart, so it still
 * ends with its steam as the train leaves the board (test/birdie-sounds.test.ts keeps the two together; this file stays free of the
 * settings, as the sound worker loads it).
 */
export const RIDE_PACE = 1.5;
/**
 * A run: each puff's level (one every STEP times its `pace`, the strong one first and every fourth), its rail joints (s, at pace 1),
 * steam at its stop, a toot over its start (s).
 */
const RUNS: Record<BirdieRun, { puffs: readonly number[]; joints: readonly number[]; steam: boolean; toot: number; pace?: number }> = {
  trainMedium: { puffs: [0.8, 1, 1, 0.9, 0.7], joints: [0.28, 0.65], steam: false, toot: 0 },
  trainLong: { puffs: [0.6, 0.8, 1, 1, 1, 0.9, 0.75, 0.6], joints: [0.28, 0.83, 1.2], steam: true, toot: 0, pace: RIDE_PACE },
  trainToot: { puffs: [0.8, 1, 1, 0.9, 0.7], joints: [0.28, 0.65], steam: false, toot: 0.32 },
};
/** Each run's seed, so each is the same on every device. The toot run shares the medium run's: it is the medium run with the whistle over it. */
const SEED: Record<BirdieRun, number> = { trainMedium: 1622, trainLong: 1623, trainToot: 1622 };

/** A run of his train (`birdie_train.py`'s `run`). */
function train(name: BirdieRun, rate: number): Float32Array {
  const r = RUNS[name];
  const pace = r.pace ?? 1;
  const next = noise(SEED[name]);
  const parts: [number, ArrayLike<number>, number][] = [];
  r.puffs.forEach((loud, i) => {
    const strong = i % 4 === 0;
    parts.push([i * STEP * pace, puff(next, rate, strong), loud * (strong ? 1 : WEAK)]);
  });
  for (const at of r.joints) for (const late of [0, 0.085]) parts.push([at * pace + late, knock(next, rate), KNOCK]);
  if (r.steam) parts.push([r.puffs.length * STEP * pace - 0.05, steam(next, rate, 0.35), STEAM]);
  if (r.toot) parts.push([0, whistleWave(rate, r.toot), WHISTLE]);
  const end = Math.max(...parts.map(([at, w]) => Math.round(at * rate) + w.length));
  const out = new Float32Array(end);
  for (const [at, w, g] of parts) lay(out, rate, at, w, g);
  return out;
}

/**
 * Birdie's Train's moving sound (the ride, Nov 23: ride-sound.ts, RIDE_SOUND's `synth`): his medium run, looped from its second puff
 * to where a sixth would start (STEP to 5 STEPs, an 8th of his song each): three weak puffs and a strong one, the rail joints between,
 * at his song's pace. Nothing sounds at either end (the first puff is over by STEP; the last is over before 5 STEPs, where the run is
 * silence), so it loops with no seam.
 */
export const BIRDIE_RIDE_LOOP: { readonly run: BirdieRun; readonly start: number; readonly end: number } = { run: "trainMedium", start: STEP, end: 5 * STEP };

// ---- His move's whistles.

/** A blast: (seconds in, how long, how loud). */
type Blast = readonly [at: number, secs: number, loud: number];
/** Each whistle's blasts and its pipes (the recipe's table, `birdie_train.py`). */
const WHISTLES: Record<BirdieWhistle, { blasts: readonly Blast[]; pipes: readonly number[] }> = {
  whistleToot: { blasts: [[0, 0.28, 1]], pipes: PIPES },
  whistleTootToot: { blasts: [[0, 0.24, 0.9], [0.34, 0.24, 1]], pipes: PIPES },
  whistleLong: { blasts: [[0, 0.9, 1]], pipes: PIPES },
  whistleTootLong: { blasts: [[0, 0.2, 0.9], [0.3, 0.75, 1]], pipes: PIPES },
  whistlePeepPeep: { blasts: [[0, 0.16, 0.9], [0.24, 0.16, 1]], pipes: PEEPS },
};

/** One of his move's whistles: its blasts laid end to end, each the one whistle (`whistleWave`). */
function whistle(name: BirdieWhistle, rate: number): Float32Array {
  const { blasts, pipes } = WHISTLES[name];
  const end = Math.max(...blasts.map(([at, secs]) => Math.round(at * rate) + Math.floor(secs * rate)));
  const out = new Float32Array(end);
  for (const [at, secs, loud] of blasts) lay(out, rate, at, whistleWave(rate, secs, pipes), loud);
  return out;
}

// ---- The rest of his pack.

/** Noise with its highs rolled off twice: a soft puff or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** A note's swell and fall over `len` seconds from `at` (0 outside it). */
const swell = (t: number, at: number, len: number) => (t < at || t > at + len ? 0 : Math.max(0, Math.sin((Math.PI * (t - at)) / len)) ** 1.5);

const SOUNDS = {
  hello: (rate) => chirp("hello", rate),
  tsip: (rate) => chirp("tsip", rate),
  teeoo: (rate) => chirp("teeoo", rate),
  trill: (rate) => chirp("trill", rate),
  cheer: (rate) => chirp("cheer", rate),
  ask: (rate) => chirp("ask", rate),
  scold: (rate) => chirp("scold", rate),
  trainMedium: (rate) => train("trainMedium", rate),
  trainLong: (rate) => train("trainLong", rate),
  trainToot: (rate) => train("trainToot", rate),
  whistleToot: (rate) => whistle("whistleToot", rate),
  whistleTootToot: (rate) => whistle("whistleTootToot", rate),
  whistleLong: (rate) => whistle("whistleLong", rate),
  whistleTootLong: (rate) => whistle("whistleTootLong", rate),
  whistlePeepPeep: (rate) => whistle("whistlePeepPeep", rate),
  // His train's whistle alone: the toot run's (as his train pulls away, and as it comes in his fall's cutscene).
  toot: (rate) => Float32Array.from(whistleWave(rate, 0.32)),
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
  // The brakes: a short squeal, then a hiss of air.
  brake: (rate) => {
    const squeal = osc(rate, (t) => 1900 - 300 * Math.min(1, t / 0.18), sine);
    const hiss = bandpass(rate, () => 3200, 1.1, noise(1231));
    return render(rate, 0.44, (t) => swell(t, 0, 0.2) * 0.5 * squeal(t) + (t > 0.12 ? Math.exp(-(t - 0.12) / 0.12) * 0.9 * hiss(t) : 0));
  },
  // A little hop: a light tap and a chirp up.
  hop: (rate) => {
    const v = osc(rate, (t) => 900 + 900 * Math.min(1, t / 0.08), sine);
    return render(rate, 0.12, (t) => Math.exp(-t / 0.04) * v(t));
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

/**
 * Each sound's level (its peak and loudness stay under a move's: test/birdie-sounds.test.ts). The chirps keep the recipe's levels against each
 * other (one gain for the seven); the train runs one gain for the three, set by loudness (short puffs of noise: quiet for their peaks),
 * under the chirps; his move's whistles one gain for the five, under the chirps, so a chirp over a whistle's start reads.
 */
const CHIRP = 0.16;
const TRAIN = 0.36;
const WHISTLE_SET = 0.12;
const LEVEL: Record<BirdieSound, number> = {
  hello: CHIRP,
  tsip: CHIRP,
  teeoo: CHIRP,
  trill: CHIRP,
  cheer: CHIRP,
  ask: CHIRP,
  scold: CHIRP,
  trainMedium: TRAIN,
  trainLong: TRAIN,
  trainToot: TRAIN,
  whistleToot: WHISTLE_SET,
  whistleTootToot: WHISTLE_SET,
  whistleLong: WHISTLE_SET,
  whistleTootLong: WHISTLE_SET,
  whistlePeepPeep: WHISTLE_SET,
  toot: 0.16,
  whistle: 0.09,
  bell: 0.1,
  brake: 0.12,
  hop: 0.14,
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

/**
 * Which whistle his train blows for a move of his (Eric, Nov 23: "more whistles than the other stuff ... like the double whistle, you know
 * how the trains go like toot toot?"). A capture or a check: a toot, then a long one. Otherwise about one move in five (picked from the
 * move and his move's number, so every device hears the same): the peep-peep, for variety. Else by how far the piece goes, in squares
 * (the longer of its files and ranks: a knight's is 2): one square, one toot; five or more, right across the board, the long blast; two
 * to four (most moves), the double toot.
 */
export function birdieWhistle(uci: string | undefined, toot: boolean, n = 0): BirdieWhistle {
  if (toot) return "whistleTootLong";
  if (!uci || uci.length < 4) return "whistleTootToot";
  let h = 2166136261 ^ n;
  for (let i = 0; i < uci.length; i++) h = Math.imul(h ^ uci.charCodeAt(i), 16777619);
  if ((h >>> 0) % 5 === 0) return "whistlePeepPeep";
  const d = Math.max(Math.abs(uci.charCodeAt(0) - uci.charCodeAt(2)), Math.abs(uci.charCodeAt(1) - uci.charCodeAt(3)));
  return d <= 1 ? "whistleToot" : d >= 5 ? "whistleLong" : "whistleTootToot";
}
