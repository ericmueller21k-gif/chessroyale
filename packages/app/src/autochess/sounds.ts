/**
 * Auto chess's sounds (v6, Eric Oct 20: "sounds that feel good", as in TFT), synthesized like the bosses' (no files, no licenses):
 * each a pure function of the sample rate, so a test can render it and measure it. Each stays quieter than a piece's move (peak and
 * loudness: test/autochess-sounds.test.ts) and each is clearly its own:
 *
 * - reroll: a quick riffle (a few soft ticks like cards) and a coin's clink at the end;
 * - place (a piece bought onto its square, or a held one placed): a solid low thunk with a woody knock, as it lands;
 * - hold (an offer dragged to the bench): a soft pop, a little bubble;
 * - sell: a coin cascade, six clinks tumbling down in pitch and loudness (nothing like buying's thunk);
 * - xp (Buy XP): a small rising chime, three bell notes up;
 * - level (a level-up): a bigger chime, a rising arpeggio that ends in a ringing chord;
 * - lock (Lock in): a latch, a click and a clack;
 * - reveal (one of their pieces shown): a short high ping, a scoop up to a bell note;
 * - cash (a pawn cashing in at the far end of the fight): a short double clink, two coins, the second higher.
 *
 * (The play names in sound.ts: acReroll, acPlace, acHold, sell, acXp, acLevel, acLock, acReveal, acCash.)
 */
import { bandpass, lowpass, noise, osc, render, sine, soft, soundCache } from "../characters/synth.ts";

export type AutochessSound = "reroll" | "place" | "hold" | "sell" | "xp" | "level" | "lock" | "reveal" | "cash";

/** An exponential decay with a quick attack (a struck thing): 0 before `at`, then rising over `attack` s and falling with time constant `tau`. */
const strike = (t: number, at: number, tau: number, attack = 0.002) => (t < at ? 0 : Math.min(1, (t - at) / attack) * Math.exp(-(t - at) / tau));

/** A bell-like note: a fundamental with inharmonic partials, each ringing less long, struck at `at`. */
function bell(rate: number, freq: number, partials: readonly (readonly [number, number, number])[]) {
  const voices = partials.map(([mult, amp, tau]) => ({ amp, tau, o: osc(rate, () => freq * mult, sine) }));
  return (t: number, at: number, level = 1) => {
    if (t < at) return 0;
    let sum = 0;
    // (A partial that has rung out for nine time constants is skipped: it is under a thousandth of its start. Each starts at zero phase when struck.)
    for (const v of voices) if (t - at < v.tau * 9) sum += level * v.amp * strike(t, at, v.tau) * v.o(t);
    return sum;
  };
}

/** A coin's clink: two bright inharmonic partials with a very short ring. */
const COIN: readonly (readonly [number, number, number])[] = [[1, 1, 0.05], [1.51, 0.55, 0.035], [2.76, 0.3, 0.02]];

const SOUNDS: Record<AutochessSound, (rate: number) => Float32Array> = {
  // A riffle (four soft ticks of band-passed noise, each a bit lower, like cards) and then a coin's clink.
  reroll: (rate) => {
    const n = bandpass(rate, (t) => 4200 - 2200 * Math.min(1, t / 0.2), 3, noise(21));
    const coin = bell(rate, 2349, COIN);
    return render(rate, 0.42, (t) => {
      let ticks = 0;
      for (let i = 0; i < 4; i++) ticks += strike(t, i * 0.05, 0.008, 0.001) * (1 - i * 0.12);
      return 0.55 * ticks * n(t) + 0.2 * coin(t, 0.24);
    });
  },
  // A piece landing: a low thump that drops in pitch, under a short woody knock.
  place: (rate) => {
    const thump = osc(rate, (t) => 62 + 118 * Math.exp(-t / 0.035), sine);
    const knock = bandpass(rate, () => 950, 2.2, noise(5));
    return render(rate, 0.26, (t) => 0.5 * strike(t, 0, 0.07, 0.002) * thump(t) + 0.7 * strike(t, 0, 0.012, 0.0006) * knock(t));
  },
  // A bubble: a sine that falls quickly from a high start, soft, with no knock.
  hold: (rate) => {
    const o = osc(rate, (t) => 360 + 520 * Math.exp(-t / 0.03), sine);
    return render(rate, 0.14, (t) => 0.3 * strike(t, 0, 0.045, 0.004) * o(t));
  },
  // Six coins falling over each other: each a clink at its own pitch (high to lower), closer and softer as it goes.
  sell: (rate) => {
    const pitches = [3136, 2637, 3520, 2349, 2794, 2093];
    const coins = pitches.map((f) => bell(rate, f, COIN));
    const times = [0, 0.055, 0.1, 0.14, 0.175, 0.205];
    return render(rate, 0.5, (t) => coins.reduce((sum, c, i) => sum + c(t, times[i]!, 0.2 * Math.pow(0.82, i)), 0));
  },
  // Three bell notes climbing (C6, E6, G6), small.
  xp: (rate) => {
    const notes = [1046.5, 1318.5, 1568].map((f) => bell(rate, f, [[1, 1, 0.09], [2, 0.3, 0.05]]));
    return render(rate, 0.5, (t) => notes.reduce((sum, n, i) => sum + n(t, i * 0.075, 0.2), 0));
  },
  // A rising arpeggio (C5, E5, G5, C6) that ends in a ringing C major chord, with a soft shimmer: bigger and longer than the XP chime.
  level: (rate) => {
    const arp = [523.25, 659.25, 783.99, 1046.5].map((f) => bell(rate, f, [[1, 1, 0.16], [2.01, 0.35, 0.1], [3, 0.12, 0.06]]));
    const chord = [1046.5, 1318.5, 1568, 2093].map((f) => bell(rate, f, [[1, 1, 0.34], [2.76, 0.18, 0.12]]));
    return render(rate, 1.15, (t) => {
      let v = 0;
      arp.forEach((n, i) => (v += n(t, i * 0.09, 0.2)));
      chord.forEach((n) => (v += n(t, 0.4, 0.12)));
      return soft(v, 0.3);
    });
  },
  // A latch: a sharp click (a bright burst and a tick), then a lower clack a moment later.
  lock: (rate) => {
    const bright = bandpass(rate, () => 3000, 4, noise(8));
    const low = lowpass(rate, 1500, bandpass(rate, () => 1100, 2, noise(9)));
    const tick = osc(rate, () => 1900, sine);
    const clack = osc(rate, (t) => 330 - 120 * Math.min(1, (t - 0.07) / 0.03), sine);
    return render(rate, 0.2, (t) => 0.6 * strike(t, 0, 0.005, 0.0004) * bright(t) + 0.12 * strike(t, 0, 0.01, 0.0004) * tick(t) + 0.55 * strike(t, 0.07, 0.014, 0.0006) * low(t) + 0.22 * strike(t, 0.07, 0.03, 0.001) * clack(t));
  },
  // A ping: a short scoop up to a bell note (G6), with a faint octave, and a hint of shimmer.
  reveal: (rate) => {
    const o = osc(rate, (t) => 1568 * (1 - 0.18 * Math.exp(-t / 0.012)), sine);
    const o2 = osc(rate, (t) => 3136 * (1 - 0.18 * Math.exp(-t / 0.012)), sine);
    return render(rate, 0.34, (t) => 0.26 * strike(t, 0, 0.11, 0.002) * o(t) + 0.07 * strike(t, 0, 0.05, 0.002) * o2(t));
  },
  // Two coins, quick: a clink and a brighter one just after (short: it plays during a fight, between moves).
  cash: (rate) => {
    const a = bell(rate, 2637, COIN);
    const b = bell(rate, 3520, COIN);
    return render(rate, 0.22, (t) => a(t, 0, 0.3) + b(t, 0.06, 0.26));
  },
};

/** Trims each so it sits a little under a move's loudness (peak well under the move's; mean a few dB under it). */
const LEVEL: Record<AutochessSound, number> = { reroll: 0.55, place: 0.38, hold: 0.8, sell: 0.9, xp: 0.85, level: 0.68, lock: 0.8, reveal: 0.85, cash: 0.62 };

const cache = soundCache("autochess");
/** The samples for one of these sounds at a sample rate (made once, then reused). */
export function autochessSound(name: AutochessSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => v * LEVEL[name]);
    cache.set(key, s);
  }
  return s;
}

export const AUTOCHESS_SOUNDS = Object.keys(SOUNDS) as AutochessSound[];
