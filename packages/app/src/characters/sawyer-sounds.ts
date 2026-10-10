/**
 * Sawyer's sounds, synthesised (no files, no licences): his reciprocating saw (a motor's buzz pulsing with the blade's
 * strokes, the rasp of its teeth in wood), its rev, a swing, the wood cracking as his pawn splits, duct tape pulled
 * over a cut, the big board saw running up the board, a landing thump and the halves knocking back together. Nothing
 * bright: no chimes, no dings (the saw's whine is filtered down to a buzz). Each is a pure function of the sample rate
 * (its noise is seeded), so a test can measure it: every one stays quieter than a piece's move (peak and loudness).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, type Voice } from "./synth.ts";

export type SawyerSound = "rev" | "swing" | "cut" | "crack" | "tape" | "bigsaw" | "hop" | "rejoin";

/** Noise with its highs rolled off twice: a soft rumble or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/**
 * The saw running: a motor's buzz (a rounded saw wave at `motor(t)` Hz) and the rasp of its teeth (noise around
 * `rasp` Hz), both pulsing with the blade's strokes (`strokes` a second). Its level is the caller's envelope.
 */
function sawing(rate: number, motor: (t: number) => number, strokes: (t: number) => number, rasp: number, seed: number, bite = 1): Voice {
  const buzz = lowpass(rate, 900, lowpass(rate, 1400, osc(rate, motor, saw)));
  const teeth = bandpass(rate, (t) => rasp * (0.85 + 0.3 * Math.sin(2 * Math.PI * strokes(t) * t)), 2.2, murk(rate, 3200, seed));
  const stroke = osc(rate, strokes, (p) => 0.5 - 0.5 * Math.cos(2 * Math.PI * p));
  return (t) => {
    const s = stroke(t);
    return (0.55 + 0.45 * s) * buzz(t) + bite * (0.25 + 0.75 * s * s) * 2.2 * teeth(t);
  };
}

/** A knock on wood: a hollow body ringing down fast, a tap of noise on top. */
function knock(rate: number, at: number, f: number, decay: number, seed: number): Voice {
  const tap = bandpass(rate, () => f * 2.2, 1.6, noise(seed));
  const life = decay * 9 + 0.02;
  return (t) => {
    const age = t - at;
    if (age < 0 || age > life) return 0;
    return Math.exp(-age / decay) * (Math.sin(2 * Math.PI * f * age) + 0.3 * Math.sin(2 * Math.PI * f * 2.7 * age)) + 1.1 * Math.exp(-age / 0.005) * tap(t);
  };
}

const SOUNDS: Record<SawyerSound, (rate: number) => Float32Array> = {
  // The rev: the trigger squeezed, the motor spinning up from a grumble to a fierce buzz, held, then let go.
  rev: (rate) => {
    const v = sawing(rate, (t) => 55 + 95 * Math.min(1, t / 0.35) - 30 * Math.max(0, t - 0.62) / 0.2, (t) => 14 + 22 * Math.min(1, t / 0.35), 1300, 301, 0.45);
    return render(rate, 0.82, (t) => Math.min(1, t / 0.05) * (t < 0.62 ? 1 : Math.max(0, 1 - (t - 0.62) / 0.2)) * v(t));
  },
  // The saw lifted and swung down: a quick whoosh of air.
  swing: (rate) => {
    const air = bandpass(rate, (t) => 600 + 1000 * Math.min(1, t / 0.18), 1.6, murk(rate, 4200, 307));
    return render(rate, 0.22, (t) => Math.sin(Math.PI * Math.min(1, t / 0.22)) ** 1.3 * 2.4 * air(t));
  },
  // The blade biting: a few rough strokes of the teeth in wood over the motor.
  cut: (rate) => {
    const v = sawing(rate, () => 130, () => 15, 1100, 311, 1.3);
    return render(rate, 0.5, (t) => Math.min(1, t / 0.02) * Math.max(0, 1 - Math.max(0, t - 0.38) / 0.12) * v(t));
  },
  // The pawn splitting: a sharp crack, the wood's knock, and a splinter or two after it.
  crack: (rate) => {
    const snap = lowpass(rate, 2600, noise(313));
    const a = knock(rate, 0.004, 210, 0.05, 317);
    const r = rng(331);
    const bits = Array.from({ length: 3 }, (_, i) => knock(rate, 0.07 + i * 0.06 + r() * 0.03, 520 + r() * 260, 0.012, 337 + i));
    return render(rate, 0.38, (t) => 1.6 * Math.exp(-t / 0.012) * snap(t) + a(t) + 0.35 * bits.reduce((s, b) => s + b(t), 0));
  },
  // Duct tape pulled off the roll and pressed down over a cut: a crackly rip rising in pitch, a pat.
  tape: (rate) => {
    const r = rng(347);
    const crackle = Array.from({ length: 64 }, () => r());
    const rip = bandpass(rate, (t) => 700 + 900 * Math.min(1, t / 0.3), 2, murk(rate, 3600, 349));
    const pat = knock(rate, 0.36, 160, 0.03, 353);
    return render(rate, 0.46, (t) => {
      const grain = t < 0.32 ? 0.45 + 0.55 * crackle[Math.floor(t * 200) % 64]! : 0;
      return Math.sin(Math.PI * Math.min(1, t / 0.32)) * grain * 2.4 * rip(t) + 0.5 * pat(t);
    });
  },
  // The board saw running up the board: the motor buzzing hard, the teeth ripping through, the pitch climbing.
  bigsaw: (rate) => {
    const v = sawing(rate, (t) => 95 + 40 * Math.min(1, t / 1.6), (t) => 17 + 5 * Math.min(1, t / 1.6), 950, 359, 1.5);
    const rumble = murk(rate, 300, 367);
    return render(rate, 1.8, (t) => Math.min(1, t / 0.08) * Math.max(0, 1 - Math.max(0, t - 1.6) / 0.2) * (v(t) + 1.4 * rumble(t)));
  },
  // A hop landing: a soft thump of his feet.
  hop: (rate) => {
    const thump = osc(rate, (t) => 70 + 80 * Math.exp(-t / 0.025), sine);
    const pat = murk(rate, 600, 373);
    return render(rate, 0.2, (t) => Math.exp(-t / 0.05) * (thump(t) + 1.2 * pat(t)));
  },
  // The two halves of the board knocking back together: a deep wooden clunk and a short scrape.
  rejoin: (rate) => {
    const a = knock(rate, 0.12, 120, 0.07, 379);
    const scrape = bandpass(rate, () => 520, 1.8, murk(rate, 2200, 383));
    return render(rate, 0.5, (t) => (t < 0.12 ? Math.sin((Math.PI * t) / 0.12) * 2 * scrape(t) : 0) + 1.2 * a(t));
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<SawyerSound, number> = { rev: 0.148, swing: 0.195, cut: 0.126, crack: 0.28, tape: 0.24, bigsaw: 0.116, hop: 0.22, rejoin: 0.23 };

const cache = new Map<string, Float32Array>();
/** The samples for one of his sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function sawyerSound(name: SawyerSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const SAWYER_SOUNDS = Object.keys(SOUNDS) as SawyerSound[];
