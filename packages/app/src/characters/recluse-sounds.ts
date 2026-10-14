/**
 * The Hidden Boss's sounds, synthesized (no files, no licenses): the red book's pages fluttering as it opens, the book
 * slammed shut (a dull thump with a slap of paper), a soft rustle of cloth as he moves it or himself, his laugh as breath
 * through the nose (no real voice: a few huffs), and a low swell under his stare. Each is a pure function of the sample
 * rate (its noise is seeded), so a test can measure it: every one stays quieter than a piece's move (peak and loudness).
 * Made ahead in idle moments as his battle starts (warmSounds).
 */
import { bandpass, lowpass, noise, osc, render, sine, soft, type Voice, soundCache } from "./synth.ts";

export type RecluseSound = "flip" | "shut" | "rustle" | "huff" | "hum";

/** Noise with its highs rolled off: paper, never a hiss. */
const paper = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, noise(seed));

const SOUNDS: Record<RecluseSound, (rate: number) => Float32Array> = {
  // Pages fluttering: a quick run of soft paper ticks, each a short band of noise, closer together as they go.
  flip: (rate) => {
    const leaf = bandpass(rate, () => 2300, 1.6, paper(rate, 6000, 601));
    const ticks = [0, 0.05, 0.095, 0.135, 0.17, 0.2, 0.226, 0.25];
    return render(rate, 0.34, (t) => {
      let env = 0;
      for (const at of ticks) {
        const age = t - at;
        if (age >= 0 && age < 0.03) env = Math.max(env, Math.sin((Math.PI * age) / 0.03));
      }
      return env * 3 * leaf(t);
    });
  },
  // The book slammed shut: a low thump falling in pitch, under a slap of paper.
  shut: (rate) => {
    const body = osc(rate, (t) => 90 * (1 + Math.exp(-t / 0.015)), sine);
    const slap = bandpass(rate, () => 1200, 1.2, paper(rate, 5000, 607));
    return render(rate, 0.3, (t) => Math.exp(-t / 0.07) * body(t) + (t < 0.05 ? Math.exp(-t / 0.012) * 2.2 * slap(t) : 0));
  },
  // A rustle of cloth: a soft swell of low paper noise (the book lifted, a sleeve, a knee going down).
  rustle: (rate) => {
    const cloth = bandpass(rate, (t) => 900 + 500 * t, 0.9, paper(rate, 3000, 611));
    return render(rate, 0.22, (t) => Math.sin((Math.PI * t) / 0.22) ** 1.5 * 2.5 * cloth(t));
  },
  // His laugh, as breath: four quick huffs through the nose, a little faster and higher each.
  huff: (rate) => {
    const breath = paper(rate, 2600, 617);
    const nose = bandpass(rate, (t) => 600 + 300 * t, 2.2, breath);
    const at = [0, 0.13, 0.24, 0.34];
    return render(rate, 0.46, (t) => {
      let env = 0;
      for (const a of at) {
        const age = t - a;
        if (age >= 0 && age < 0.09) env = Math.max(env, Math.sin((Math.PI * age) / 0.09) ** 0.7);
      }
      return env * 3.2 * nose(t);
    });
  },
  // Under his stare: a low swell that rises and fades (two close low tones beating, no melody).
  hum: (rate) => {
    const a = osc(rate, () => 73, sine);
    const b = osc(rate, () => 75.5, sine);
    return render(rate, 1.2, (t) => Math.sin((Math.PI * t) / 1.2) ** 2 * (a(t) + b(t)));
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<RecluseSound, number> = { flip: 0.11, shut: 0.26, rustle: 0.18, huff: 0.1, hum: 0.09 };

const cache = soundCache("recluse");
/** The samples for one of his sounds at a sample rate (made once, then reused). */
export function recluseSound(name: RecluseSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const RECLUSE_SOUNDS = Object.keys(SOUNDS) as RecluseSound[];
