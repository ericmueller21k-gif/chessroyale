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
 * - cash (a pawn cashing in at the far end of the fight): a short double clink, two coins, the second higher;
 * - star2 (a piece gains its second star, v8; Eric Oct 22: "a cool level up sound", not cheesy or cheap, "TFT does a good job of this"): a quick rising shimmer over
 *   a soft low thump, ending in a bright bell tail, about 0.6 s;
 * - star3 (its third star): a bigger one, about a second: a longer shimmer up into a swelling major chord with a bright bell-like hit and a sparkle of small
 *   high bells falling away.
 *
 * (The play names in sound.ts: acReroll, acPlace, acHold, sell, acXp, acLevel, acLock, acReveal, acCash, acStar2, acStar3.)
 */
import { bandpass, lowpass, noise, osc, render, sine, soft, soundCache, type Voice } from "../characters/synth.ts";

export type AutochessSound = "reroll" | "place" | "hold" | "sell" | "xp" | "level" | "lock" | "reveal" | "cash" | "star2" | "star3";

/** An exponential decay with a quick attack (a struck thing): 0 before `at`, then rising over `attack` s and falling with time constant `tau`. */
const strike = (t: number, at: number, tau: number, attack = 0.002) => (t < at ? 0 : Math.min(1, (t - at) / attack) * Math.exp(-(t - at) / tau));

/** A bell-like note: a fundamental with inharmonic partials, each ringing less long, struck at `at`. */
function bell(rate: number, freq: number, partials: readonly (readonly [number, number, number])[], reach = 9) {
  const voices = partials.map(([mult, amp, tau]) => ({ amp, tau, o: osc(rate, () => freq * mult, sine) }));
  return (t: number, at: number, level = 1) => {
    if (t < at) return 0;
    let sum = 0;
    // (A partial that has rung out for `reach` time constants (nine: under a thousandth of its start) is skipped. Each starts at zero phase when struck.)
    for (const v of voices) if (t - at < v.tau * reach) sum += level * v.amp * strike(t, at, v.tau) * v.o(t);
    return sum;
  };
}

/**
 * Renders a sound at half the sample rate and doubles it (linear interpolation): the star-ups' partials all sit under about 6 kHz, so they lose at most 1.5 dB at the top
 * and cost half as much to make, which matters for the longest of them (a sound is made ahead of its cue, within 120 ms: test/autochess-sounds.test.ts).
 */
function renderHalf(rate: number, dur: number, make: (rate: number) => Voice): Float32Array {
  const lo = render(rate / 2, dur, make(rate / 2));
  const out = new Float32Array(Math.ceil(rate * dur));
  const last = lo.length - 1;
  for (let i = 0; i < out.length; i++) {
    const k = i >> 1;
    out[i] = i & 1 ? (lo[k]! + lo[Math.min(last, k + 1)]!) / 2 : lo[k]!;
  }
  return out;
}

/**
 * A rising shimmer: a few slightly detuned sines gliding up (exponentially) from `from` to `to` Hz over `dur` s, swelling and fading, with a breath of band-passed noise
 * riding the same glide. 0 before `at`.
 */
function shimmer(rate: number, from: number, to: number, dur: number, seedNoise: number) {
  const voices = [1, 1.004, 0.997, 1.5].map((m, i) => ({ amp: i === 3 ? 0.22 : 0.5, o: osc(rate, (t) => m * from * Math.pow(to / from, Math.min(1, t / dur)), sine) }));
  const air = bandpass(rate, (t) => from * 2 * Math.pow(to / from, Math.min(1, t / dur)), 3, noise(seedNoise));
  return (t: number, at = 0) => {
    const x = t - at;
    if (x < 0 || x > dur * 1.25) return 0;
    // (Swells in over the glide's first half and falls away in the last quarter beyond it.)
    const env = Math.min(1, x / (dur * 0.55)) * (x < dur ? 1 : Math.max(0, 1 - (x - dur) / (dur * 0.25)));
    let sum = 0;
    for (const v of voices) sum += v.amp * v.o(x);
    return env * (sum * 0.3 + 0.1 * air(x));
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
  // A star-up: a soft low thump underneath, a quick shimmer rising from 500 Hz to 2 kHz, and at its top a bright two-note bell tail (a fifth apart) that rings out.
  star2: (rate) => {
    const thump = osc(rate, (t) => 52 + 60 * Math.exp(-t / 0.05), sine);
    const rise = shimmer(rate, 500, 2000, 0.2, 31);
    const tail = [1568, 2349].map((f) => bell(rate, f, [[1, 1, 0.22], [2.01, 0.3, 0.12], [3.97, 0.1, 0.06]]));
    return render(rate, 0.62, (t) => 0.5 * strike(t, 0, 0.1, 0.004) * thump(t) + rise(t) + tail[0]!(t, 0.19, 0.2) + tail[1]!(t, 0.235, 0.16));
  },
  // The third star: a deeper thump, a longer shimmer up into a major chord (C, E, G, C, D) that swells in, a bright bell-like hit, and a sparkle of small high bells falling away.
  star3: (rate) =>
    renderHalf(rate, 1.0, (r) => {
      const thump = osc(r, (t) => 44 + 80 * Math.exp(-t / 0.07), sine);
      const rise = shimmer(r, 420, 2600, 0.3, 77);
      // (The chord is one pad: every note a sine and its octave under one ring-out each, so it costs a few sines a sample, not a bell's worth of them.)
      const chordLow = [261.63, 329.63, 392, 523.25, 587.33].map((f) => osc(r, () => f, sine));
      const chordHigh = [523.25, 784].map((f) => osc(r, () => f, sine));
      const hit = bell(r, 2093, [[1, 1, 0.22], [2.76, 0.4, 0.1]], 4);
      const hit2 = bell(r, 3136, [[1, 1, 0.12]], 5);
      const sparkleAt = [0.4, 0.47, 0.54, 0.6, 0.67, 0.74, 0.82];
      const sparklePitch = [4186, 3136, 5274, 3951, 4699, 3520, 5588];
      const sparkle = sparklePitch.map((f) => bell(r, f, [[1, 1, 0.08]], 5));
      const sparkleLevel = sparkleAt.map((_, i) => 0.2 * Math.pow(0.88, i));
      return (t) => {
        let v = 0.55 * strike(t, 0, 0.16, 0.004) * thump(t) + rise(t);
        // The chord swells in over the shimmer's climb (slow attack, then it rings and falls away).
        if (t >= 0.14) {
          const x = t - 0.14;
          const ring = Math.exp(-x / 0.5);
          const ringHigh = 0.3 * Math.exp(-x / 0.3);
          for (let i = 0; i < chordLow.length; i++) {
            // (Each note swells in over 0.18 s, a hair after the one below it.)
            const swell = Math.min(1, Math.max(0, (x - i * 0.012) / 0.18));
            v += 0.11 * swell * ring * chordLow[i]!(t);
          }
          for (let i = 0; i < chordHigh.length; i++) v += 0.11 * Math.min(1, x / 0.18) * ringHigh * chordHigh[i]!(t);
        }
        v += hit(t, 0.3, 0.2) + hit2(t, 0.32, 0.12);
        for (let i = 0; i < sparkle.length; i++) v += sparkle[i]!(t, sparkleAt[i]!, sparkleLevel[i]!);
        return soft(v, 0.34);
      };
    }),

};

/** Trims each so it sits a little under a move's loudness (peak well under the move's; mean a few dB under it). */
const LEVEL: Record<AutochessSound, number> = { reroll: 0.55, place: 0.38, hold: 0.8, sell: 0.9, xp: 0.85, level: 0.68, lock: 0.8, reveal: 0.85, cash: 0.62, star2: 0.42, star3: 0.46 };

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
