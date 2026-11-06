/**
 * Boingo's claw machine's sounds, synthesized like the bosses' (no files, no licenses; characters/synth.ts): a coin dropping into
 * the slot (a bright clink, a second bounce, a rattle down the chute), the claw's motor whir (a buzzing hum with a slow wobble), the
 * grab (a ratchet's clicks and a clunk as the prongs close) and the prize's thud into the chute. Each is a pure function of the
 * sample rate (its noise is seeded), so a test can measure it: each sits a little under a piece's move in loudness, its peaks under
 * half a move's.
 */
import { MOVE_MEAN_DB, bandpass, lowpass, noise, osc, render, sine, soft, soundCache, type Voice } from "../characters/synth.ts";

export type ClawSound = "coin" | "whir" | "grab" | "thud";

const env = (t: number, at: number, attack: number, decay: number) => (t < at ? 0 : Math.min(1, (t - at) / attack) * Math.exp(-(t - at) / decay));

/** A struck bit of metal at `at`: a few inharmonic partials ringing down. Silent before it's struck. */
function ping(rate: number, at: number, base: number, decay: number): Voice {
  const partials = [1, 2.76, 5.4];
  return (t) => {
    const age = t - at;
    if (age < 0 || age > decay * 10) return 0;
    let s = 0;
    for (let i = 0; i < partials.length; i++) s += (Math.exp(-age / (decay / (1 + i))) * Math.sin(2 * Math.PI * base * partials[i]! * age)) / (1 + i);
    return s;
  };
}

const SOUNDS: Record<ClawSound, (rate: number) => Float32Array> = {
  coin: (rate) => {
    const rattle = bandpass(rate, () => 3200, 2, noise(611));
    const a = ping(rate, 0, 2100, 0.09);
    const b = ping(rate, 0.11, 2350, 0.06);
    return render(rate, 0.5, (t) => a(t) + 0.7 * b(t) + 0.5 * env(t, 0.18, 0.02, 0.09) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 38 * t)) * rattle(t));
  },
  whir: (rate) => {
    const hum = lowpass(rate, 900, osc(rate, (t) => 110 + 6 * Math.sin(2 * Math.PI * 3 * t), (p) => 2 * p - 1));
    const hiss = bandpass(rate, () => 1400, 1.4, noise(612));
    return render(rate, 0.9, (t) => Math.min(1, t / 0.08) * Math.min(1, (0.9 - t) / 0.15) * (hum(t) + 0.25 * hiss(t)));
  },
  grab: (rate) => {
    const click = bandpass(rate, () => 2600, 3, noise(613));
    const clicks = osc(rate, () => 24, (p) => (1 - p) ** 6);
    const clunk = ping(rate, 0.26, 180, 0.07);
    return render(rate, 0.5, (t) => (t < 0.26 ? clicks(t) * click(t) * 1.4 : 0) + 1.1 * clunk(t));
  },
  thud: (rate) => {
    const body = osc(rate, (t) => 95 - 40 * Math.min(1, t / 0.2), sine);
    const knock = lowpass(rate, 700, noise(614));
    return render(rate, 0.45, (t) => env(t, 0, 0.004, 0.12) * (body(t) + 0.6 * knock(t)));
  },
};

/** Each at about 4 dB under a move's mean loudness (as the bosses' sit), its peaks under a soft ceiling well below a move's. */
const TARGET_DB = MOVE_MEAN_DB - 4;

const cache = soundCache("claw");
/** The samples for one of the claw machine's sounds at a sample rate (made once, then reused). */
export function clawSound(name: ClawSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    const raw = SOUNDS[name](rate);
    let sum = 0;
    for (const v of raw) sum += v * v;
    const db = sum > 0 ? 10 * Math.log10(sum / raw.length) : TARGET_DB;
    const gain = 10 ** ((TARGET_DB - db) / 20);
    s = raw.map((v) => soft(v * gain));
    cache.set(key, s);
  }
  return s;
}

export const CLAW_SOUNDS = Object.keys(SOUNDS) as ClawSound[];
