/**
 * Puddles', the hippo gardener's, sounds, synthesized (no files, no licenses), as the other bosses' are. He is a big, patient,
 * friendly hippo: a deep warm grunt and a bigger bellow (each a pulse train, low, through two formants that open from "mm" to
 * "uh", a little rough and breathy; warm and never scary), heavy footstep thumps, an oof, a flop. His garden has a soft "plip"
 * for each seed landing, a quiet whiff for the toss (the 30 s seed must never wear on you: no grunt, nothing but a whiff), and the
 * hose: a rubbery creak as he hauls it, a hiss that starts, swells for the sweep and dies away to drips. The plants have a killer
 * plant's snap and gulp, a bud's bright little pop, a sparkly chime for the queen's, and the wilt, a soft deflating sigh. His
 * attack on a king is ten short squirts. His select sound is a happy grunt and a splash.
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

/** A grunt's shape: how long, the pitch (Hz) at its start, peak and end, its two formants (Hz) closed and open, and how rough and breathy. */
interface Grunt {
  dur: number;
  pitch: [number, number, number];
  f1: [number, number];
  f2: [number, number];
  vibrato: [number, number];
  rough: number;
  breath: number;
  open: number;
  attack: number;
  release: number;
  seed: number;
}

function grunt(rate: number, m: Grunt): Float32Array {
  const source = shared(
    osc(
      rate,
      (t) => {
        const u = t / m.dur;
        const f = u < 0.35 ? lerp(m.pitch[0], m.pitch[1], u / 0.35) : lerp(m.pitch[1], m.pitch[2], (u - 0.35) / 0.65);
        return f * (1 + m.vibrato[1] * Math.sin(2 * Math.PI * m.vibrato[0] * t));
      },
      saw,
    ),
  );
  const rolled = lowpass(rate, 2200, source);
  const a = bandpass(rate, (t) => lerp(m.f1[0], m.f1[1], t / m.open), 6, rolled);
  const b = bandpass(rate, (t) => lerp(m.f2[0], m.f2[1], t / m.open), 7, rolled);
  const air = bandpass(rate, () => 900, 1.2, murk(rate, 2400, m.seed));
  return render(rate, m.dur, (t) => {
    const env = Math.min(1, t / m.attack) * Math.min(1, (m.dur - t) / m.release);
    const grr = 1 - m.rough * (0.5 + 0.5 * Math.sin(2 * Math.PI * 26 * t));
    return env * (grr * (2.2 * a(t) + 1.2 * b(t) + 0.2 * rolled(t)) + m.breath * air(t));
  });
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
  // A deep, friendly grunt: low, two syllables of one breath, the mouth opening a little.
  grunt: (rate) => grunt(rate, { dur: 0.38, pitch: [104, 120, 90], f1: [300, 520], f2: [640, 980], vibrato: [5, 0.02], rough: 0.2, breath: 0.25, open: 0.14, attack: 0.05, release: 0.16, seed: 2001 }),
  // A bigger bellow: lower, longer, the mouth wide, a growl in it and a fall at the end (warm: no snarl).
  bellow: (rate) => grunt(rate, { dur: 0.85, pitch: [76, 112, 64], f1: [380, 650], f2: [780, 1060], vibrato: [4.2, 0.022], rough: 0.28, breath: 0.2, open: 0.22, attack: 0.05, release: 0.3, seed: 2003 }),
  // A happy cheer: two short rising grunts, "hoo-hoo".
  cheer: (rate) =>
    mix(rate, 0.55, [
      [0, grunt(rate, { dur: 0.22, pitch: [112, 150, 138], f1: [330, 560], f2: [700, 1080], vibrato: [6, 0.02], rough: 0.1, breath: 0.2, open: 0.08, attack: 0.03, release: 0.09, seed: 2005 })],
      [0.2, grunt(rate, { dur: 0.3, pitch: [120, 168, 124], f1: [340, 590], f2: [720, 1120], vibrato: [6, 0.025], rough: 0.12, breath: 0.2, open: 0.1, attack: 0.03, release: 0.14, seed: 2007 })],
    ]),
  // His select sound: a happy grunt, and a splash after it.
  hello: (rate) =>
    mix(rate, 0.8, [
      [0, grunt(rate, { dur: 0.34, pitch: [110, 148, 118], f1: [330, 560], f2: [700, 1080], vibrato: [6, 0.02], rough: 0.1, breath: 0.2, open: 0.12, attack: 0.04, release: 0.14, seed: 2009 })],
      [0.3, splash(rate, 0.46, 3800, 1800, 2011, (t) => Math.min(1, t / 0.02) * Math.exp(-t / 0.13), 0.7)],
    ]),
  // A heavy footstep: a low sine dropping in pitch under a puff of dust.
  thump: (rate) => {
    const body = osc(rate, (t) => 46 + 80 * Math.exp(-t / 0.03), sine);
    const dust = murk(rate, 520, 2013);
    return render(rate, 0.3, (t) => Math.exp(-t / 0.08) * (1.2 * body(t) + 0.9 * dust(t)));
  },
  // An oof: a short grunt knocked out of him, breathy, falling.
  oof: (rate) => {
    const v = lowpass(rate, 900, osc(rate, (t) => 150 - 60 * Math.min(1, t / 0.2), saw));
    const breath = murk(rate, 1400, 2015);
    return render(rate, 0.24, (t) => Math.sin(Math.PI * Math.min(1, t / 0.24)) ** 0.7 * (1.5 * v(t) + 0.5 * breath(t)));
  },
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
  // A shrug: "hm", a breathy hum falling off.
  sigh: (rate) => grunt(rate, { dur: 0.55, pitch: [112, 104, 84], f1: [300, 400], f2: [640, 800], vibrato: [3.6, 0.03], rough: 0.1, breath: 0.55, open: 0.25, attack: 0.1, release: 0.3, seed: 2045 }),
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
  oof: 0.1,
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
