/**
 * Puddles', the hippo gardener's, sounds, synthesized (no files, no licenses), as the other bosses' are. He is a big, patient,
 * friendly hippo who talks in quick, high, made-up syllables (Eric, Oct 23: "like in Pikmin"; his first deep grunt sounded like
 * Moo's moo): a few for most things, a happy run for a cheer, a long excited one for a queen, an "uh-oh" when hurt and a slow
 * falling "oh well" for a shrug. Heavy footstep thumps and a flop are his body's. His garden has a soft "plip"
 * for each seed landing, a quiet whiff for the toss (the 30 s seed must never wear on you: no grunt, nothing but a whiff), and the
 * hose: a rubbery creak as he hauls it, a hiss that starts, swells for the sweep and dies away to drips. The plants have a killer
 * plant's snap and gulp, a bud's bright little pop, a sparkly chime for the queen's, and the wilt, a soft deflating sigh. His
 * attack on a king is ten short squirts. His select sound is a hello in his talk and a splash.
 * Each is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays quieter than a piece's
 * move (peak and loudness), and the ten squirts of his attack on a king together too.
 *
 * Which cue plays which: kit.sounds in kits.ts (his animations' cues), and the board art's in power-art.ts (EFFECTS).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, soundCache, type Voice } from "./synth.ts";

export type GardenerSound = "grunt" | "bellow" | "cheer" | "hello" | "thump" | "oof" | "flop" | "whoosh" | "toss" | "plip" | "tug" | "spray" | "swell" | "drips" | "snap" | "gulp" | "pop" | "chime" | "wilt" | "sigh" | "jet" | "spurt" | "rustle";

/** A voice read once a sample however many filters share it (a source feeding two formants). */
const shared = (v: Voice): Voice => {
  let at = NaN;
  let value = 0;
  return (t) => {
    if (t !== at) {
      at = t;
      value = v(t);
    }
    return value;
  };
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * Math.max(0, Math.min(1, u));
/** Noise with its highs rolled off twice: a soft puff or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** A vowel: its first two formants (Hz), a small speaker's (an adult's times 1.22, so the voice reads small and bright). */
type Vowel = "ee" | "ih" | "eh" | "ah" | "uh" | "oh" | "oo";
const VOWEL: Record<Vowel, readonly [number, number]> = { ee: [366, 2806], ih: [512, 2379], eh: [683, 2196], ah: [927, 1586], uh: [683, 1403], oh: [586, 1098], oo: [415, 1000] };
const CHATTY: readonly Vowel[] = ["ee", "ih", "eh", "ah", "oo", "ee", "ah"];
/** His speaking pitch (Hz): the first sample Eric picked was 430, "just slightly too high pitched" (Oct 23). */
const VOICE = 370;

/**
 * What he says: `syllables` of made-up talk at `pitch` times his voice, on a sing-song line that rises by `lift` in the middle
 * and drops by `fall` on the last (shares of the pitch), from `vowels`, at `pace` (1 his usual quick chatter; more is slower).
 */
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
 * His voice (Eric, Oct 23: the deep grunt "sounds like the same as the cow"; "like in Pikmin... not real words, and they say it
 * kind of fast, like in higher pitch"): quick made-up syllables, each a bright pulse through the two formants of its vowel, most
 * with a little "p/t" click at the start, each bending its pitch a little. Made at a loudness of 1 (its RMS), so `LEVEL` sets it.
 */
function talk(rate: number, m: Talk): Float32Array {
  const r = rng(m.seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * r();
  const plan: { at: number; d: number; p0: number; p1: number; v: readonly [number, number]; click: boolean }[] = [];
  let at = 0.01;
  for (let i = 0; i < m.syllables; i++) {
    const d = between(0.055, 0.085) * m.pace;
    const line = Math.sin((Math.PI * (i + 0.5)) / m.syllables) * m.lift - (i === m.syllables - 1 ? m.fall : 0);
    const centre = VOICE * m.pitch * (1 + line + (r() - 0.5) * 0.32);
    const bend = (r() - 0.4) * 0.19;
    const v = VOWEL[m.vowels[Math.floor(r() * m.vowels.length)]!];
    plan.push({ at, d, p0: centre * (1 - bend / 2), p1: centre * (1 + bend / 2), v, click: r() < 0.55 });
    at += d + between(0.012, 0.03) * m.pace;
  }
  const out = new Float32Array(Math.ceil((at + 0.04) * rate));
  plan.forEach((s, k) => {
    // (The syllable's source made first, then read by both formants and the onset, each in time order.)
    const len = Math.ceil((s.d + 0.03) * rate);
    const pulse = lowpass(rate, 5000, osc(rate, (t) => lerp(s.p0, s.p1, t / s.d), saw));
    const source = new Float32Array(len);
    for (let i = 0; i < len; i++) source[i] = pulse(i / rate);
    const read: Voice = (t) => source[Math.min(len - 1, Math.round(t * rate))]!;
    const f1 = bandpass(rate, () => s.v[0], 5, read);
    const f2 = bandpass(rate, () => s.v[1], 7, read);
    const air = bandpass(rate, () => 3500, 1.4, noise(m.seed * 31 + k));
    const tick = bandpass(rate, () => 4200, 2, noise(m.seed * 17 + k));
    const start = Math.round(s.at * rate);
    for (let i = 0; i < len && start + i < out.length; i++) {
      const t = i / rate;
      const env = Math.min(1, t / 0.007) * Math.max(0, Math.min(1, (s.d + 0.012 - t) / 0.03));
      const click = s.click && t < 0.012 ? 1.6 * tick(t) * (1 - t / 0.012) : 0;
      out[start + i]! += env * (2.0 * f1(t) + 1.3 * f2(t) + 0.15 * read(t) + 0.08 * air(t)) + click;
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

/** A burst of water: noise through a band that moves from `from` to `to` Hz, with a soft low body under it, shaped by `env`. */
function splash(rate: number, dur: number, from: number, to: number, seed: number, env: (t: number) => number, low = 0.5): Float32Array {
  const rush = bandpass(rate, (t) => lerp(from, to, t / dur), 0.9, murk(rate, 8000, seed));
  const body = bandpass(rate, () => 700, 0.8, murk(rate, 2200, seed + 1));
  return render(rate, dur, (t) => env(t) * (2.0 * rush(t) + low * body(t)));
}

const SOUNDS: Record<GardenerSound, (rate: number) => Float32Array> = {
  // His word for most things (his entrance, a capture, a check, a win): four quick syllables, up a little and down at the end.
  grunt: (rate) => talk(rate, { syllables: 4, pitch: 1, lift: 0.18, fall: 0.12, vowels: CHATTY, pace: 1, seed: 2001 }),
  // A queen grew: a long, excited run, higher and climbing.
  bellow: (rate) => talk(rate, { syllables: 10, pitch: 1.12, lift: 0.32, fall: 0, vowels: CHATTY, pace: 0.95, seed: 2003 }),
  // A piece grew: a happy run, a little higher, ending up.
  cheer: (rate) => talk(rate, { syllables: 6, pitch: 1.08, lift: 0.28, fall: -0.06, vowels: CHATTY, pace: 1, seed: 2005 }),
  // His select sound: a friendly hello in his talk, and a splash after it.
  hello: (rate) =>
    mix(rate, 0.85, [
      [0, talk(rate, { syllables: 4, pitch: 1.04, lift: 0.22, fall: 0.06, vowels: CHATTY, pace: 1, seed: 2009 })],
      [0.36, splash(rate, 0.46, 3800, 1800, 2011, (t) => Math.min(1, t / 0.02) * Math.exp(-t / 0.13), 0.7)],
    ]),
  // A heavy footstep: a low sine dropping in pitch under a puff of dust.
  thump: (rate) => {
    const body = osc(rate, (t) => 46 + 80 * Math.exp(-t / 0.03), sine);
    const dust = murk(rate, 520, 2013);
    return render(rate, 0.3, (t) => Math.exp(-t / 0.08) * (1.2 * body(t) + 0.9 * dust(t)));
  },
  // Hurt: a quick "uh-oh" in his talk, falling.
  oof: (rate) => talk(rate, { syllables: 2, pitch: 1.06, lift: 0, fall: 0.3, vowels: ["uh", "oh"], pace: 0.9, seed: 2015 }),
  // A flop: him sinking onto his haunches, a big soft thud with a slow settle under it.
  flop: (rate) => {
    const body = osc(rate, (t) => 54 + 52 * Math.exp(-t / 0.04), sine);
    const settle = osc(rate, (t) => 150 - 60 * Math.min(1, Math.max(0, t - 0.08) / 0.2), sine);
    const cloth = murk(rate, 700, 2017);
    return render(rate, 0.42, (t) => Math.exp(-t / 0.09) * (1.2 * body(t) + 0.9 * cloth(t)) + (t > 0.08 ? Math.exp(-(t - 0.08) / 0.08) * 0.6 * settle(t) : 0));
  },
  // Dropping in from above: a soft whoosh falling in pitch.
  whoosh: (rate) => splash(rate, 0.26, 1500, 380, 2019, (t) => Math.sin(Math.PI * Math.min(1, t / 0.26)) ** 1.2, 0.2),
  // The toss: a quiet whiff of an arm, nothing more.
  toss: (rate) => {
    const air = bandpass(rate, (t) => 2600 - 1300 * Math.min(1, t / 0.12), 1.4, murk(rate, 6000, 2021));
    return render(rate, 0.14, (t) => Math.sin(Math.PI * Math.min(1, t / 0.14)) ** 1.5 * 2.4 * air(t));
  },
  // A seed landing: a soft "plip", a drop of water in a puddle (a pitch that rises, quickly fading), a tiny tick of soil.
  plip: (rate) => {
    const drop = osc(rate, (t) => 520 + 760 * (1 - Math.exp(-t / 0.014)), sine);
    const tick = bandpass(rate, () => 1800, 2, murk(rate, 5000, 2023));
    return render(rate, 0.16, (t) => Math.exp(-t / 0.035) * drop(t) + Math.exp(-t / 0.006) * 0.25 * tick(t));
  },
  // The hose hauled out: a rubbery creak, a stick-slip squeal on a low note that climbs a little.
  tug: (rate) => {
    const src = shared(osc(rate, (t) => 150 + 40 * Math.sin(2 * Math.PI * 9 * t) + 110 * Math.min(1, t / 0.3), saw));
    const squeal = bandpass(rate, (t) => 620 + 520 * Math.min(1, t / 0.3), 6, src);
    const thud = lowpass(rate, 300, src);
    return render(rate, 0.34, (t) => {
      const grip = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 21 * t));
      return Math.min(1, t / 0.03) * Math.min(1, (0.34 - t) / 0.08) * grip * (2.6 * squeal(t) + 0.5 * thud(t));
    });
  },
  // The water starts: a hiss coming up out of the nozzle.
  spray: (rate) => splash(rate, 0.22, 4800, 4200, 2025, (t) => Math.min(1, t / 0.16) ** 1.5 * (1 - Math.max(0, (t - 0.18) / 0.04)), 0.3),
  // The sweep across the board: the hiss swelling, brighter and louder, a whooshing body under it.
  swell: (rate) => splash(rate, 0.46, 3000, 5400, 2027, (t) => Math.min(1, t / 0.14) * (1 - Math.max(0, (t - 0.4) / 0.06)) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 7 * t)), 0.8),
  // The water stops: the hiss dying away, then drips.
  drips: (rate) => {
    const dur = 0.7;
    const hiss = splash(rate, 0.24, 4600, 3000, 2029, (t) => Math.max(0, 1 - t / 0.22) ** 1.4, 0.3);
    const r = rng(2031);
    const drops = Array.from({ length: 5 }, (_, i) => ({ at: 0.2 + 0.07 * i * (1 + 0.25 * i) + 0.02 * r(), f: 1100 + 700 * r(), amp: 0.7 - 0.1 * i }));
    const tones = drops.map((d) => osc(rate, (t) => d.f * (0.8 + 0.4 * (1 - Math.exp(-Math.max(0, t - d.at) / 0.012))), sine));
    const tail = render(rate, dur, (t) => {
      let v = 0;
      drops.forEach((d, i) => {
        const x = tones[i]!(t);
        if (t >= d.at && t < d.at + 0.12) v += d.amp * 0.45 * Math.exp(-(t - d.at) / 0.03) * x;
      });
      return v;
    });
    return mix(rate, dur, [[0, hiss], [0, tail]]);
  },
  // A killer plant snapping shut: a sharp clack of jaws and a wet crunch.
  snap: (rate) => {
    const clack = bandpass(rate, () => 3400, 1.2, murk(rate, 8000, 2033));
    const crunch = bandpass(rate, () => 900, 1.5, murk(rate, 3000, 2035));
    const thock = osc(rate, (t) => 210 * Math.exp(-t / 0.05) + 90, sine);
    return render(rate, 0.24, (t) => Math.exp(-t / 0.012) * 2.4 * clack(t) + Math.min(1, t / 0.004) * Math.exp(-t / 0.07) * (1.5 * crunch(t) + 0.8 * thock(t)));
  },
  // It swallows: a low glug, twice.
  gulp: (rate) => {
    const glug = osc(rate, (t) => 170 - 70 * Math.min(1, (t % 0.13) / 0.1), sine);
    const wet = bandpass(rate, () => 500, 2, murk(rate, 1800, 2037));
    return render(rate, 0.3, (t) => {
      const beat = (t % 0.13) / 0.13;
      return (t < 0.26 ? 1 : 0) * Math.sin(Math.PI * Math.min(1, beat * 1.4)) * (1.4 * glug(t) + 0.5 * wet(t)) * (1 - t / 0.4);
    });
  },
  // A bud opening: a bright little pop, a bubble breaking, with two sparkles after it.
  pop: (rate) => {
    const bubble = osc(rate, (t) => 640 + 1500 * Math.min(1, t / 0.028), sine);
    const click = bandpass(rate, () => 3000, 1.6, murk(rate, 8000, 2039));
    const s1 = osc(rate, () => 2600, sine);
    const s2 = osc(rate, () => 3300, sine);
    return render(rate, 0.26, (t) => {
      const sparkle = (t > 0.05 ? Math.exp(-(t - 0.05) / 0.03) * 0.3 * s1(t) : 0) + (t > 0.09 ? Math.exp(-(t - 0.09) / 0.03) * 0.22 * s2(t) : 0);
      return Math.min(1, t / 0.002) * Math.exp(-t / 0.03) * (1.4 * bubble(t) + 1.0 * click(t)) + sparkle;
    });
  },
  // The queen's bud: a sparkly chime, a rising arpeggio of bell tones over a shimmer.
  chime: (rate) => {
    const notes = [1047, 1319, 1568, 2093].map((f) => ({ f, osc: osc(rate, () => f, sine), top: osc(rate, () => f * 2.76, sine) }));
    const r = rng(2041);
    const glints = Array.from({ length: 6 }, (_, i) => ({ at: 0.08 + 0.07 * i + 0.02 * r(), f: 3200 + 500 * r() }));
    const gl = glints.map((g) => osc(rate, () => g.f, sine));
    return render(rate, 0.8, (t) => {
      let v = 0;
      notes.forEach((n, i) => {
        const at = 0.06 * i;
        if (t >= at) v += Math.exp(-(t - at) / 0.22) * (0.45 * n.osc(t) + 0.12 * n.top(t));
      });
      glints.forEach((g, i) => {
        const x = gl[i]!(t);
        if (t >= g.at && t < g.at + 0.1) v += 0.16 * Math.exp(-(t - g.at) / 0.025) * x;
      });
      return Math.min(1, t / 0.004) * v;
    });
  },
  // A seedling wilting: a soft deflating sigh, a breath falling away with a tired tone under it.
  wilt: (rate) => {
    const air = bandpass(rate, (t) => 1500 - 1000 * Math.min(1, t / 0.4), 1.1, murk(rate, 3500, 2043));
    const tone = osc(rate, (t) => 330 - 190 * Math.min(1, t / 0.4), sine);
    return render(rate, 0.5, (t) => Math.sin(Math.PI * Math.min(1, t / 0.5)) ** 0.8 * (1.8 * air(t) + 0.3 * tone(t)));
  },
  // A shrug (nothing came up): three slower syllables in his talk, lower and falling, "oh well".
  sigh: (rate) => talk(rate, { syllables: 3, pitch: 0.88, lift: 0, fall: 0.25, vowels: ["oh", "uh", "oo"], pace: 1.35, seed: 2045 }),
  // A plant coming up, leaves unfurling or a snapping plant's jaws opening: a very soft rustle of leaves.
  rustle: (rate) => {
    const leaves = bandpass(rate, (t) => 2600 - 900 * Math.min(1, t / 0.12), 1.0, murk(rate, 6500, 2051));
    return render(rate, 0.13, (t) => Math.sin(Math.PI * Math.min(1, t / 0.13)) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 38 * t)) * 2.2 * leaves(t));
  },
  // One jet of his hose at the king: a short squirt of water, a hiss with a splash on its end.
  jet: (rate) => splash(rate, 0.14, 4200, 2600, 2047, (t) => Math.min(1, t / 0.008) * Math.exp(-t / 0.07), 0.7),
  // A sputter between jets: shorter and softer.
  spurt: (rate) => splash(rate, 0.09, 3600, 2200, 2049, (t) => Math.min(1, t / 0.006) * Math.exp(-t / 0.04), 0.5),
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<GardenerSound, number> = {
  grunt: 0.05,
  bellow: 0.065,
  cheer: 0.05,
  hello: 0.05,
  thump: 0.2,
  oof: 0.05,
  flop: 0.2,
  whoosh: 0.18,
  toss: 0.07,
  plip: 0.12,
  tug: 0.05,
  spray: 0.12,
  swell: 0.14,
  drips: 0.16,
  snap: 0.16,
  gulp: 0.14,
  pop: 0.2,
  chime: 0.22,
  wilt: 0.12,
  sigh: 0.05,
  jet: 0.14,
  spurt: 0.12,
  rustle: 0.1,
};

const cache = soundCache("gardener");
/** The samples for one of his sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function gardenerSound(name: GardenerSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const GARDENER_SOUNDS = Object.keys(SOUNDS) as GardenerSound[];
