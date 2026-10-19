/**
 * Smudgy's sounds, synthesized (no files, no licenses), as the other bosses' are: paint slapping wet (his splash, which
 * is also his select sound), a drip, a brush swishing through the air, a giggle, a soft dab, a thump on the ground and an
 * oof. Each is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays
 * quieter than a piece's move (peak and loudness).
 *
 * Which cue plays which: kit.sounds in kits.ts (his animations' cues: drop, swish, flick, stroke1, stroke2 and the
 * brush stroke's swoosh the swish; splat, splash and the splash on the board the splash; giggle and cheer the giggle;
 * thump, land and flop the thump; dab, oof and drip theirs).
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, soundCache, type Voice } from "./synth.ts";

export type SmudgySound = "splash" | "drip" | "swish" | "giggle" | "dab" | "thump" | "oof";

/** Noise with its highs rolled off twice: a soft puff or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

const SOUNDS: Record<SmudgySound, (rate: number) => Float32Array> = {
  // A glob of paint slapping a wall: a wet smack, a squelch under it, a few drops pattering after.
  splash: (rate) => {
    const slap = bandpass(rate, (t) => 1500 - 900 * Math.min(1, t / 0.08), 1.3, noise(901));
    const squelch = osc(rate, (t) => 240 - 120 * Math.min(1, t / 0.12) + 40 * Math.sin(2 * Math.PI * 38 * t), sine);
    const body = murk(rate, 900, 907);
    const r = rng(911);
    const drops = Array.from({ length: 4 }, () => ({ at: 0.1 + 0.2 * r(), f: 1700 + 900 * r() }));
    const plinks = drops.map((d) => osc(rate, (t) => d.f * (1 + 0.5 * Math.exp(-(t - d.at) / 0.01)), sine));
    return render(rate, 0.42, (t) => {
      let v = Math.exp(-t / 0.05) * (1.5 * slap(t) + 0.8 * squelch(t)) + Math.exp(-t / 0.1) * 0.9 * body(t);
      drops.forEach((d, i) => {
        const p = plinks[i]!(t);
        if (t >= d.at && t < d.at + 0.06) v += 0.3 * Math.exp(-(t - d.at) / 0.015) * p;
      });
      return v;
    });
  },
  // A drip: one round "plink" of a drop falling into a puddle, a smaller one after it.
  drip: (rate) => {
    const plink = (f: number, at: number) => osc(rate, (t) => f * (1 + 0.9 * Math.exp(-Math.max(0, t - at) / 0.022)), sine);
    const a = plink(620, 0);
    const b = plink(880, 0.16);
    return render(rate, 0.34, (t) => Math.exp(-t / 0.05) * a(t) + (t >= 0.16 ? 0.6 * Math.exp(-(t - 0.16) / 0.045) * b(t) : 0));
  },
  // A brush swished through the air: a rush of air that rises and falls, with a faint rasp of bristle.
  swish: (rate) => {
    const air = bandpass(rate, (t) => 500 + 2100 * Math.sin(Math.PI * Math.min(1, t / 0.2)), 1.4, murk(rate, 6000, 919));
    const bristle = bandpass(rate, () => 4200, 2, noise(929));
    return render(rate, 0.22, (t) => Math.sin(Math.PI * Math.min(1, t / 0.22)) ** 1.4 * (2.6 * air(t) + 0.5 * bristle(t)));
  },
  // A giggle: four quick hiccups of a light voice, each a little higher, the last longer.
  giggle: (rate) => {
    const notes = [0, 0.085, 0.17, 0.255];
    const pitch = [620, 700, 650, 760];
    const noteAt = (t: number) => notes.reduce((k, n, j) => (t >= n ? j : k), 0);
    const v = osc(rate, (t) => {
      const i = noteAt(t);
      return pitch[i]! * (1 + 0.04 * Math.sin(2 * Math.PI * 9 * t)) * (1 + 0.5 * Math.exp(-(t - notes[i]!) / 0.015));
    }, sine);
    const breath = bandpass(rate, () => 2600, 1.5, murk(rate, 5000, 937));
    return render(rate, 0.42, (t) => {
      const i = noteAt(t);
      const u = t - notes[i]!;
      const len = i === 3 ? 0.14 : 0.06;
      const env = u < len ? Math.sin((Math.PI * u) / len) ** 1.2 : 0;
      return env * (1.2 * v(t) + 0.3 * breath(t));
    });
  },
  // A dab: a damp little tap of the brush on the palette, with a squish.
  dab: (rate) => {
    const tap = osc(rate, (t) => 420 - 220 * Math.min(1, t / 0.05), sine);
    const wet = bandpass(rate, () => 1100, 2, noise(941));
    return render(rate, 0.13, (t) => Math.exp(-t / 0.03) * (tap(t) + 0.7 * Math.exp(-t / 0.015) * wet(t)));
  },
  // A thump on the ground: a low sine dropping in pitch, a puff of dust.
  thump: (rate) => {
    const body = osc(rate, (t) => 62 + 80 * Math.exp(-t / 0.025), sine);
    const dust = murk(rate, 600, 947);
    return render(rate, 0.2, (t) => Math.exp(-t / 0.055) * (body(t) + 1.1 * dust(t)));
  },
  // An oof: a small grunt, breathy, falling.
  oof: (rate) => {
    const v = lowpass(rate, 1200, osc(rate, (t) => 330 - 120 * Math.min(1, t / 0.18), (p) => 2 * p - 1));
    const breath = murk(rate, 1600, 953);
    return render(rate, 0.2, (t) => Math.sin(Math.PI * Math.min(1, t / 0.2)) ** 0.7 * (1.5 * v(t) + 0.5 * breath(t)));
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<SmudgySound, number> = {
  splash: 0.16,
  drip: 0.2,
  swish: 0.15,
  giggle: 0.12,
  dab: 0.2,
  thump: 0.22,
  oof: 0.1,
};

const cache = soundCache("smudgy");
/** The samples for one of his sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function smudgySound(name: SmudgySound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const SMUDGY_SOUNDS = Object.keys(SOUNDS) as SmudgySound[];
