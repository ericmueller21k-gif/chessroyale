/**
 * Boingo's sounds, synthesised (no files, no licences): a pogo boing, a bulb-horn honk, a rubber squeak, a slide
 * whistle up and down, a kazoo laugh (a clown's laugh with no voice), and for his powers a pie's splat and the
 * funhouse's boing-flip. Each is a pure function of the sample rate,
 * so a test can measure it: every one stays quieter than a piece's move sound (peak and loudness; see
 * test/boss-character.test.ts).
 */
import { bandpass, lowpass, noise, osc, render, saw, sine, soft, square } from "./synth.ts";

export type ClownSound = "boing" | "honk" | "squeak" | "slideUp" | "slideDown" | "laugh" | "splat" | "flip";

export { MOVE_MEAN_DB, MOVE_PEAK } from "./synth.ts";

const SOUNDS: Record<ClownSound, (rate: number) => Float32Array> = {
  // A spring: a sine whose pitch wobbles fast and settles, dying away.
  boing: (rate) => {
    const o = osc(rate, (t) => 260 + 140 * Math.sin(2 * Math.PI * 16 * t) * Math.exp(-t / 0.2) + 160 * Math.exp(-t / 0.05), sine);
    return render(rate, 0.42, (t) => 0.3 * Math.exp(-t / 0.13) * o(t));
  },
  // A bulb horn: two slightly detuned buzzes an octave over a square, through a low-pass; a quick dip in pitch.
  honk: (rate) => {
    const f = (t: number) => 330 * (1 - 0.06 * Math.min(1, t / 0.25));
    const a = osc(rate, f, saw);
    const b = osc(rate, (t) => f(t) * 1.012, saw);
    const c = osc(rate, (t) => f(t) / 2, square);
    const v = lowpass(rate, 1400, (t) => 0.5 * a(t) + 0.5 * b(t) + 0.35 * c(t));
    return render(rate, 0.3, (t) => 0.22 * Math.min(1, t / 0.012) * (t > 0.22 ? Math.max(0, 1 - (t - 0.22) / 0.08) : 1) * v(t));
  },
  // A rubber toy: a quick squeal up and back down with a fast flutter.
  squeak: (rate) => {
    const o = osc(rate, (t) => 1100 + 700 * Math.sin(Math.PI * Math.min(1, t / 0.16)) + 60 * Math.sin(2 * Math.PI * 38 * t), sine);
    return render(rate, 0.18, (t) => 0.2 * Math.sin(Math.PI * Math.min(1, t / 0.18)) * o(t));
  },
  // A slide whistle, up (he pops in) and down (he's beaten), with a little vibrato.
  slideUp: (rate) => {
    const o = osc(rate, (t) => 420 * Math.pow(3.2, t / 0.5) * (1 + 0.012 * Math.sin(2 * Math.PI * 6 * t)), sine);
    return render(rate, 0.5, (t) => 0.18 * Math.min(1, t / 0.05) * o(t));
  },
  slideDown: (rate) => {
    const o = osc(rate, (t) => 1300 * Math.pow(0.24, t / 0.8) * (1 + 0.015 * Math.sin(2 * Math.PI * 5.5 * t)), sine);
    return render(rate, 0.8, (t) => 0.18 * Math.min(1, t / 0.04) * (t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.15) : 1) * o(t));
  },
  // A kazoo laugh: five buzzy "ha"s stepping down in pitch.
  laugh: (rate) => {
    const note = (t: number) => Math.floor(t / 0.13);
    const o = osc(rate, (t) => 520 * Math.pow(0.93, note(t)) * (1 + 0.02 * Math.sin(2 * Math.PI * 9 * t)), saw);
    const v = lowpass(rate, 1800, o);
    return render(rate, 0.65, (t) => {
      const inNote = (t % 0.13) / 0.13;
      const env = note(t) < 5 ? Math.sin(Math.PI * Math.min(1, inNote / 0.75)) * (inNote < 0.75 ? 1 : 0) : 0;
      return 0.2 * env * v(t);
    });
  },
  // A pie landing: a soft low thump that drops in pitch, under a wet, squelchy burst of noise.
  splat: (rate) => {
    const thump = osc(rate, (t) => 150 * Math.exp(-t / 0.08) + 55, sine);
    const wet = bandpass(rate, (t) => 900 * Math.exp(-t / 0.12) + 250, 1.6, noise(7));
    return render(rate, 0.42, (t) => 0.32 * Math.exp(-t / 0.07) * thump(t) + 0.55 * Math.exp(-t / 0.1) * Math.min(1, t / 0.006) * wet(t));
  },
  // The funhouse: a big spring boing as he lands, then a whoosh that sweeps up and over as the board flips.
  flip: (rate) => {
    const spring = osc(rate, (t) => 200 + 120 * Math.sin(2 * Math.PI * 12 * t) * Math.exp(-t / 0.25) + 140 * Math.exp(-t / 0.05), sine);
    const air = bandpass(rate, (t) => 500 + 2200 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.18) / 0.5))), 2.2, noise(11));
    return render(rate, 0.75, (t) => {
      const whoosh = t < 0.18 ? 0 : Math.sin(Math.PI * Math.min(1, (t - 0.18) / 0.55));
      return 0.26 * Math.exp(-t / 0.16) * spring(t) + 0.5 * whoosh * whoosh * air(t);
    });
  },
};

/** Trims each to sit a little under a move's loudness (mean about -24 dBFS, peaks well under the move's). */
const LEVEL: Record<ClownSound, number> = { boing: 0.78, honk: 0.66, squeak: 0.63, slideUp: 0.51, slideDown: 0.54, laugh: 1, splat: 0.98, flip: 0.55 };

const cache = new Map<string, Float32Array>();
/** The samples for one of his sounds at a sample rate (made once, then reused). */
export function clownSound(name: ClownSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    // His power sounds (a splat, the boing-flip) are loud transients: a soft ceiling keeps their peaks down.
    s = SOUNDS[name](rate).map((v) => (name === "splat" || name === "flip" ? soft(v * LEVEL[name]) : v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const CLOWN_SOUNDS = Object.keys(SOUNDS) as ClownSound[];
