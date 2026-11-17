/**
 * The Hidden Boss's sounds, synthesized (no files, no licenses): the red book's pages fluttering as it opens, the book
 * slammed shut (a dull thump with a slap of paper), a soft rustle of cloth as he moves it or himself, his laugh as breath
 * through the nose (no real voice: a few huffs), a low swell under his stare, and for his phase change a thump as he
 * lands on the board and the light pouring out of the book (a soft chord swelling over the hum), his light as he's
 * revealed in his final form (a few sparks and a cold tone rising) and the arcs that split the board (a soft crackle, never a buzz),
 * and phase 2's slash as he cuts one of your hearts (a slow whoosh drawn back, then a fast swish and a ring of steel). Each is a pure function of the sample rate (its noise is seeded), so a test can measure
 * it: every one stays quieter than a piece's move (peak and loudness). Made ahead in the sound worker (warmSounds).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, type Voice, soundCache } from "./synth.ts";

export type RecluseSound = "flip" | "shut" | "rustle" | "huff" | "hum" | "thump" | "glow" | "slash" | "spark" | "arc";

/** When the slash's blade goes through (s from its start): the heart's cut on screen, RECLUSE_PHASE2.slash.windMs (a test keeps them equal). */
export const SLASH_CUT_S = 0.52;

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
  // Landing from his leap onto the board: a deep thump of his shoes, a scuff of dust.
  thump: (rate) => {
    const body = osc(rate, (t) => 52 + 70 * Math.exp(-t / 0.03), sine);
    const scuff = bandpass(rate, () => 700, 1.1, paper(rate, 2400, 619));
    return render(rate, 0.32, (t) => Math.exp(-t / 0.08) * body(t) + (t < 0.12 ? Math.exp(-t / 0.035) * 1.6 * scuff(t) : 0));
  },
  // The light pouring out of the book as he chants: three soft tones (a minor chord) swelling and shimmering, the
  // stare's low beating hum under them; it fades as the boards split.
  glow: (rate) => {
    const tones = [220, 261.6, 329.6].map((f) => osc(rate, () => f, sine));
    const a = osc(rate, () => 73, sine);
    const b = osc(rate, () => 75.5, sine);
    return render(rate, 2.6, (t) => {
      const env = Math.min(1, t / 0.7) ** 1.5 * Math.min(1, (2.6 - t) / 0.9);
      const shimmer = 0.75 + 0.25 * Math.sin(2 * Math.PI * 6 * t);
      return env * (shimmer * (tones[0]!(t) + 0.8 * tones[1]!(t) + 0.7 * tones[2]!(t)) + 0.8 * (a(t) + b(t)));
    });
  },
  // A heart cut in phase 2 (Eric, Nov 16; no harsh buzzer): the wind-up, a soft whoosh of air drawn back and rising, slow; then at
  // SLASH_CUT_S the follow-through, a fast swish falling through the band and a short ring of steel (a few high partials, not
  // in tune with each other, dying away).
  slash: (rate) => {
    const air = paper(rate, 5000, 661);
    const wind = bandpass(rate, (t) => 500 + 900 * Math.min(1, t / SLASH_CUT_S), 1.2, air);
    const swish = bandpass(rate, (t) => 4200 * Math.exp(-Math.max(0, t - SLASH_CUT_S) / 0.05) + 700, 1.4, paper(rate, 7000, 667));
    const ring = [2637, 3510, 4699].map((f) => osc(rate, () => f, sine));
    return render(rate, 0.95, (t) => {
      const a = t / SLASH_CUT_S;
      const up = t < SLASH_CUT_S ? 0.9 * a * a * Math.sin(Math.PI * Math.min(1, a) * 0.5) : 0;
      const age = t - SLASH_CUT_S;
      const fast = age >= 0 ? Math.min(1, age / 0.006) * Math.exp(-age / 0.06) : 0;
      const steel = age >= 0 ? Math.min(1, age / 0.004) * Math.exp(-age / 0.16) : 0;
      return up * wind(t) + 3 * fast * swish(t) + 0.45 * steel * (ring[0]!(t) + 0.6 * ring[1]!(t) + 0.35 * ring[2]!(t));
    });
  },
  // His light as he's revealed in his final form (0.6 s): three quick soft sparks, and a cold tone sweeping up and dying
  // away (its octave over it, faint).
  spark: (rate) => {
    const fizz = bandpass(rate, () => 3600, 1.4, lowpass(rate, 6500, noise(641)));
    const tone = osc(rate, (t) => 320 + 1100 * (1 - Math.exp(-t / 0.08)), sine);
    const high = osc(rate, (t) => 640 + 2200 * (1 - Math.exp(-t / 0.08)), sine);
    const at = [0, 0.045, 0.11];
    return render(rate, 0.6, (t) => {
      let snap = 0;
      for (const a of at) {
        const age = t - a;
        if (age >= 0 && age < 0.03) snap = Math.max(snap, Math.exp(-age / 0.006));
      }
      const env = Math.min(1, t / 0.01) * Math.exp(-t / 0.18);
      return 3 * snap * fizz(t) + env * (tone(t) + 0.25 * high(t));
    });
  },
  // The arcs striking the board as it splits (2.3 s, from just before the crack): soft crackling (short ticks of noise
  // in a high band, rolled off above, some louder), two bigger snaps where the big arcs strike (the crack at 0.2 s, the
  // quarters parting at 0.95 s: PHASE_CHANGE, a test checks), and a faint electric hum under it.
  arc: (rate) => {
    const dur = 2.3;
    const r = rng(653);
    const ticks: { at: number; len: number; amp: number }[] = [];
    for (let t = 0.01; t < dur - 0.15; t += 0.012 + r() * 0.05) ticks.push({ at: t, len: 0.002 + r() * 0.005, amp: 0.35 + r() * 0.65 });
    for (const at of [0.2, 0.95]) for (let i = 0; i < 4; i++) ticks.push({ at: at + i * 0.018, len: 0.006, amp: 1.6 - i * 0.25 });
    const crackle = bandpass(rate, () => 3000, 1.1, lowpass(rate, 6000, noise(659)));
    const buzz = lowpass(rate, 380, osc(rate, () => 118, saw));
    return render(rate, dur, (t) => {
      let env = 0;
      for (const k of ticks) {
        const age = t - k.at;
        if (age >= 0 && age < k.len * 3) env = Math.max(env, k.amp * Math.exp(-age / k.len));
      }
      const fade = Math.min(1, t / 0.1) * Math.min(1, (dur - t) / 0.4);
      return 3.2 * env * crackle(t) + fade * 0.35 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 7 * t)) * buzz(t);
    });
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<RecluseSound, number> = { flip: 0.11, shut: 0.26, rustle: 0.18, huff: 0.1, hum: 0.09, thump: 0.24, glow: 0.05, slash: 0.14, spark: 0.13, arc: 0.15 };

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
