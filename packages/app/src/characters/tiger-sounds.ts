/**
 * Babur's, the circus tiger's, sounds, synthesized (no files, no licenses), as the other bosses' are. A bored circus cat who hated the
 * roaring: his voice is a low, slow, purring grumble of made-up syllables (`grumble`: clearly not Puddles' quick high chatter or Moo's
 * moo), a "heh" for a cheer, a longer pleased run for a queen, an "ugh" for a wince or a knock. Where another boss roars he yawns (a big,
 * bored, breathy yawn), and his growl is a half-hearted one. Heavy paws thump, his hop springs, his vest pocket rustles, and he huffs.
 * His balloons: the pump's soft rubbery plunger stroke (one every 30 s, so it stays very quiet), the rubber's squeak, a sharp pop
 * (never louder than a capture), the whoosh of the release and the flight, the soft poof of a landing. His hoops: a fire whoosh and
 * crackle for each. His attack on a king: a rubbery bonk and a pop for each of ten balloons. His select sound: a bored yawn, then a
 * balloon squeak.
 * Each is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays quieter than a piece's
 * move (peak and loudness), and the ten bonks and pops of his attack on a king together too.
 *
 * Which cue plays which: kit.sounds in kits.ts (his animations' and the pump's cues), and the board art's in power-art.ts (EFFECTS).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, soundCache, type Voice } from "./synth.ts";

export type TigerSound = "pump" | "squeak" | "pop" | "whoosh" | "poof" | "thump" | "spring" | "rustle" | "yawn" | "growl" | "huff" | "flame" | "bonk" | "cheer" | "whoop" | "wince" | "hello";

const lerp = (a: number, b: number, u: number) => a + (b - a) * Math.max(0, Math.min(1, u));
/** Noise with its highs rolled off twice: a soft puff or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** A vowel's first two formants (Hz): a big cat's, lower than a person's (an adult's times 0.85), so it reads big and dark. */
type Vowel = "ah" | "uh" | "oh" | "eh" | "aw";
const VOWEL: Record<Vowel, readonly [number, number]> = { ah: [620, 1040], uh: [480, 1000], oh: [420, 760], eh: [480, 1500], aw: [520, 820] };
const DARK: readonly Vowel[] = ["uh", "ah", "oh", "aw", "uh", "eh"];
/** His speaking pitch (Hz): low, a big cat's grumble (Puddles' is 370). */
const VOICE = 118;

/** What he says: `syllables` of made-up talk at `pitch` times his voice, rising by `lift` in the middle and dropping by `fall` on the last, at `pace` (1 his usual slow drawl). */
interface Talk {
  syllables: number;
  pitch: number;
  lift: number;
  fall: number;
  vowels: readonly Vowel[];
  pace: number;
  seed: number;
}

/**
 * His voice: slow made-up syllables, each a low buzzy pulse through two dark formants, with a purr in it (its loudness fluttering
 * at about 24 Hz, a cat's purr) and a little breath; a few start with a soft "m/n" hum. Made at a loudness of 1 (its RMS).
 */
function grumble(rate: number, m: Talk): Float32Array {
  const r = rng(m.seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * r();
  const plan: { at: number; d: number; p0: number; p1: number; v: readonly [number, number]; hum: boolean }[] = [];
  let at = 0.015;
  for (let i = 0; i < m.syllables; i++) {
    const d = between(0.13, 0.19) * m.pace;
    const line = Math.sin((Math.PI * (i + 0.5)) / m.syllables) * m.lift - (i === m.syllables - 1 ? m.fall : 0);
    const centre = VOICE * m.pitch * (1 + line + (r() - 0.5) * 0.14);
    const bend = (r() - 0.6) * 0.16;
    plan.push({ at, d, p0: centre * (1 - bend / 2), p1: centre * (1 + bend / 2), v: VOWEL[m.vowels[Math.floor(r() * m.vowels.length)]!], hum: r() < 0.4 });
    at += d + between(0.03, 0.06) * m.pace;
  }
  const out = new Float32Array(Math.ceil((at + 0.06) * rate));
  plan.forEach((s, k) => {
    const len = Math.ceil((s.d + 0.05) * rate);
    const pulse = lowpass(rate, 2600, osc(rate, (t) => lerp(s.p0, s.p1, t / s.d), saw));
    const source = new Float32Array(len);
    for (let i = 0; i < len; i++) source[i] = pulse(i / rate);
    const read: Voice = (t) => source[Math.min(len - 1, Math.round(t * rate))]!;
    const f1 = bandpass(rate, () => s.v[0], 4, read);
    const f2 = bandpass(rate, () => s.v[1], 6, read);
    const nasal = bandpass(rate, () => 260, 5, read);
    const breath = bandpass(rate, () => 1400, 1.2, murk(rate, 4000, m.seed * 31 + k));
    const start = Math.round(s.at * rate);
    for (let i = 0; i < len && start + i < out.length; i++) {
      const t = i / rate;
      const env = Math.min(1, t / 0.025) * Math.max(0, Math.min(1, (s.d + 0.02 - t) / 0.06));
      const purr = 0.7 + 0.3 * Math.sin(2 * Math.PI * 24 * t + k);
      const hum = s.hum && t < 0.05 ? 1 - t / 0.05 : 0;
      out[start + i]! += env * purr * ((1 - 0.6 * hum) * (1.6 * f1(t) + 0.8 * f2(t)) + (0.3 + 1.6 * hum) * nasal(t) + 0.12 * read(t) + 0.25 * breath(t));
    }
  });
  const loud = Math.sqrt(out.reduce((a, v) => a + v * v, 0) / out.length);
  return out.map((v) => v / loud);
}

/** Sums sounds, each starting at its own time (seconds), into one of `dur` seconds. */
function mix(rate: number, dur: number, parts: readonly (readonly [number, Float32Array])[]): Float32Array {
  const out = new Float32Array(Math.ceil(rate * dur));
  for (const [at, w] of parts) {
    const start = Math.round(at * rate);
    for (let i = 0; i < w.length && start + i < out.length; i++) out[start + i]! += w[i]!;
  }
  return out;
}

/** A rush of air: noise through a band moving from `from` to `to` Hz, shaped by `env`. */
function air(rate: number, dur: number, from: number, to: number, seed: number, env: (t: number) => number, q = 1): Float32Array {
  const rush = bandpass(rate, (t) => lerp(from, to, t / dur), q, murk(rate, 7000, seed));
  return render(rate, dur, (t) => env(t) * 2 * rush(t));
}

/** Balloon rubber squeaking: a thin tone wobbling up, through a narrow band. */
function squeak(rate: number, dur: number, from: number, to: number, seed: number): Float32Array {
  const r = rng(seed);
  const wob = 14 + 6 * r();
  const tone = osc(rate, (t) => lerp(from, to, t / dur) * (1 + 0.05 * Math.sin(2 * Math.PI * wob * t)), saw);
  const band = bandpass(rate, (t) => lerp(from, to, t / dur) * 1.5, 3, tone);
  return render(rate, dur, (t) => Math.sin(Math.PI * Math.min(1, t / dur)) ** 0.7 * (1.4 * band(t) + 0.2 * tone(t)));
}

/** A big, bored, breathy yawn: the jaw opening on a long rising "aaah", then falling away into a sigh. */
function yawn(rate: number): Float32Array {
  const dur = 1.0;
  const pitch = (t: number) => (t < 0.45 ? lerp(92, 150, t / 0.45) : lerp(150, 70, (t - 0.45) / 0.55));
  const src = osc(rate, pitch, saw);
  const buf = new Float32Array(Math.ceil(dur * rate));
  for (let i = 0; i < buf.length; i++) buf[i] = src(i / rate);
  const read: Voice = (t) => buf[Math.min(buf.length - 1, Math.round(t * rate))]!;
  // (The mouth opening: "ah" widening, then closing to "oh".)
  const f1 = bandpass(rate, (t) => (t < 0.5 ? lerp(380, 700, t / 0.5) : lerp(700, 420, (t - 0.5) / 0.5)), 3.5, read);
  const f2 = bandpass(rate, (t) => (t < 0.5 ? lerp(900, 1150, t / 0.5) : lerp(1150, 760, (t - 0.5) / 0.5)), 5, read);
  const breath = bandpass(rate, (t) => lerp(1600, 900, t / dur), 0.9, murk(rate, 5000, 3101));
  return render(rate, dur, (t) => {
    const env = Math.min(1, t / 0.12) * Math.max(0, Math.min(1, (dur - t) / 0.3));
    const voiced = t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.2);
    return env * (voiced * (1.5 * f1(t) + 0.7 * f2(t)) + (0.9 + 0.8 * (1 - voiced)) * breath(t));
  });
}

const SOUNDS: Record<TigerSound, (rate: number) => Float32Array> = {
  // The pump's plunger: a soft rubbery "fwump" (one every 30 s: it stays very quiet), a little low thud of the plunger at its foot.
  pump: (rate) => {
    const puff = bandpass(rate, (t) => lerp(320, 700, t / 0.12), 1.4, murk(rate, 2400, 3001));
    const thud = osc(rate, (t) => 110 + 60 * Math.exp(-t / 0.02), sine);
    return render(rate, 0.14, (t) => Math.sin(Math.PI * Math.min(1, t / 0.14)) * (1.8 * puff(t) + 0.5 * Math.exp(-t / 0.04) * thud(t)));
  },
  // Balloon rubber: a short squeak up.
  squeak: (rate) => squeak(rate, 0.12, 880, 1350, 3003),
  // A balloon popping: a sharp crack of air with a quick snap of rubber after it.
  pop: (rate) => {
    const crack = bandpass(rate, () => 2400, 0.8, noise(3005));
    const snap = bandpass(rate, () => 900, 1.5, murk(rate, 6000, 3007));
    return render(rate, 0.18, (t) => Math.min(1, t / 0.001) * (Math.exp(-t / 0.012) * 2.2 * crack(t) + Math.exp(-t / 0.05) * 0.7 * snap(t)));
  },
  // The release and the flight: a light whoosh, falling a little.
  whoosh: (rate) => air(rate, 0.26, 1700, 650, 3009, (t) => Math.sin(Math.PI * Math.min(1, t / 0.26)) ** 1.3),
  // A balloon landing as a piece: a soft puff of smoke.
  poof: (rate) => air(rate, 0.3, 900, 450, 3011, (t) => Math.min(1, t / 0.02) * Math.exp(-t / 0.09), 0.7),
  // Heavy paws: a low sine dropping in pitch under a puff of dust.
  thump: (rate) => {
    const body = osc(rate, (t) => 50 + 70 * Math.exp(-t / 0.03), sine);
    const dust = murk(rate, 520, 3013);
    return render(rate, 0.28, (t) => Math.exp(-t / 0.07) * (1.2 * body(t) + 0.9 * dust(t)));
  },
  // The hop: a short springy "boing", rising, with a wobble.
  spring: (rate) => {
    const tone = osc(rate, (t) => (210 + 320 * Math.min(1, t / 0.16)) * (1 + 0.06 * Math.sin(2 * Math.PI * 28 * t)), sine);
    return render(rate, 0.24, (t) => Math.min(1, t / 0.005) * Math.exp(-t / 0.09) * tone(t));
  },
  // His vest pocket: a quick rustle of cloth.
  rustle: (rate) => {
    const cloth = bandpass(rate, (t) => 2200 - 800 * Math.min(1, t / 0.16), 1.0, murk(rate, 6500, 3015));
    return render(rate, 0.16, (t) => Math.sin(Math.PI * Math.min(1, t / 0.16)) * (0.65 + 0.35 * Math.sin(2 * Math.PI * 31 * t)) * 2.2 * cloth(t));
  },
  // A big, bored, breathy yawn (his entrance; his thinking now and then).
  yawn,
  // A growl he can't be bothered to make a roar: low, rough, short, trailing off.
  growl: (rate) => {
    const src = osc(rate, (t) => 82 - 14 * Math.min(1, t / 0.45), saw);
    const body = bandpass(rate, () => 420, 2.5, src);
    const rasp = bandpass(rate, () => 900, 2, murk(rate, 3000, 3017));
    return render(rate, 0.5, (t) => {
      const rough = 0.6 + 0.4 * Math.sin(2 * Math.PI * 31 * t) * Math.sin(2 * Math.PI * 7 * t);
      return Math.min(1, t / 0.05) * Math.max(0, 1 - t / 0.5) ** 1.2 * rough * (1.6 * body(t) + 0.5 * rasp(t));
    });
  },
  // A bored exhale through the nose.
  huff: (rate) => air(rate, 0.32, 1300, 600, 3019, (t) => Math.min(1, t / 0.03) * Math.exp(-t / 0.11), 0.8),
  // A burning hoop: a fire whoosh and a crackle.
  flame: (rate) => {
    const dur = 0.5;
    const roar = bandpass(rate, (t) => lerp(500, 1400, t / dur), 0.7, murk(rate, 5000, 3021));
    const r = rng(3023);
    const pops = Array.from({ length: 9 }, () => ({ at: 0.05 + 0.4 * r(), amp: 0.5 + 0.5 * r() }));
    const tick = bandpass(rate, () => 3200, 1.5, noise(3025));
    return render(rate, dur, (t) => {
      let c = 0;
      for (const p of pops) if (t >= p.at && t < p.at + 0.012) c += p.amp * Math.exp(-(t - p.at) / 0.003);
      return Math.sin(Math.PI * Math.min(1, t / dur)) ** 0.8 * 1.6 * roar(t) + c * 1.4 * tick(t);
    });
  },
  // His attack on a king: a balloon bonking on him, a rubbery boing down.
  bonk: (rate) => {
    const tone = osc(rate, (t) => 420 - 230 * Math.min(1, t / 0.08), sine);
    const rub = bandpass(rate, () => 700, 3, osc(rate, () => 160, saw));
    return render(rate, 0.14, (t) => Math.min(1, t / 0.003) * Math.exp(-t / 0.04) * (1.3 * tone(t) + 0.5 * rub(t)));
  },
  // A balloon landed: a pleased "heh-heh" in his grumble, ending up.
  cheer: (rate) => grumble(rate, { syllables: 3, pitch: 1.15, lift: 0.15, fall: -0.08, vowels: ["eh", "ah", "eh"], pace: 0.8, seed: 3027 }),
  // A real queen landed: a longer pleased run, higher, climbing.
  whoop: (rate) => grumble(rate, { syllables: 6, pitch: 1.3, lift: 0.3, fall: -0.1, vowels: DARK, pace: 0.85, seed: 3029 }),
  // A balloon popped, or a knock: an "ugh", two syllables falling.
  wince: (rate) => grumble(rate, { syllables: 2, pitch: 1.05, lift: 0, fall: 0.25, vowels: ["uh", "oh"], pace: 0.9, seed: 3031 }),
  // His select sound: a bored yawn, then a balloon squeak.
  hello: (rate) => mix(rate, 1.3, [[0, yawn(rate)], [1.0, squeak(rate, 0.14, 820, 1400, 3033)]]),
};

/** Trims each to sit under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. The pump is the quietest. */
const LEVEL: Record<TigerSound, number> = {
  pump: 0.05,
  squeak: 0.06,
  pop: 0.16,
  whoosh: 0.12,
  poof: 0.12,
  thump: 0.2,
  spring: 0.09,
  rustle: 0.08,
  yawn: 0.05,
  growl: 0.07,
  huff: 0.12,
  flame: 0.1,
  bonk: 0.12,
  cheer: 0.05,
  whoop: 0.055,
  wince: 0.05,
  hello: 0.05,
};

const cache = soundCache("tiger");
/** The samples for one of his sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function tigerSound(name: TigerSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

/**
 * His voice for a line of `syllables` (the samples for Eric: a short, a medium and a long line), at his usual pitch and drawl. Not
 * played in the game (no boss voices its lines; his cues' `cheer`, `whoop` and `wince` are this voice).
 */
export const tigerTalk = (syllables: number, rate: number, seed = 3101): Float32Array =>
  grumble(rate, { syllables, pitch: 1, lift: 0.12, fall: 0.15, vowels: DARK, pace: 1, seed }).map((v) => soft(v * 0.05));

export const TIGER_SOUNDS = Object.keys(SOUNDS) as TigerSound[];
