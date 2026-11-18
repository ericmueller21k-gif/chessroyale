/**
 * Chandy's sounds, synthesized (no files, no licenses), his own (Eric, Nov 18: "I think I noticed a big boy sound reused in chandy,
 * can't do that"; "Should be pulse style sounds like predator too maybe"): a special-ops hunter's energy kit, pulsing. His scope's
 * targeting beeps and hums, his energy rifle's charging pulse and pulse shot, a cloak-like shimmer for his clones, the field's
 * shimmer and pop, glass-like shatters (no gore). In that spirit, not a copy: no creature's clicking call, no film's exact weapon.
 * Most are built on one idea, the pulse: a tone or a hiss whose level throbs (`throb`), fast for energy, slow for a winding down.
 * His intro's three are his swamp's: water streaming off the rising board, a plastic milk crate set down, a splash as the storm comes.
 *
 * Each is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays quieter than a piece's
 * move (peak and loudness).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, type Voice, soundCache } from "./synth.ts";

export type ChandySound =
  | "lock"
  | "unlock"
  | "unsling"
  | "charge"
  | "shot"
  | "stow"
  | "cloak"
  | "decloak"
  | "fade"
  | "spark"
  | "static"
  | "scatter"
  | "hum"
  | "humOff"
  | "shield"
  | "pop"
  | "zaps"
  | "clear"
  | "round"
  | "shatter"
  | "alarm"
  | "blast"
  | "upgrade"
  | "beam"
  | "crack"
  | "crackle"
  | "surface"
  | "crate"
  | "splash";

const TAU = 2 * Math.PI;

/** The pulse: 0 to 1 at `hz`, a rounded square (energy throbbing, never a hard click). */
const throb = (t: number, hz: number, depth = 1) => 1 - depth * (0.5 - 0.5 * Math.tanh(3 * Math.sin(TAU * hz * t)));

/** Noise with its highs rolled off twice: a soft rumble or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** A rounded pulse wave (a square through a low-pass): the scope's and the alarm's electronic voice, never buzzy. */
const pulseWave = (rate: number, freq: (t: number) => number, cut: number): Voice => lowpass(rate, cut, lowpass(rate, cut * 1.5, osc(rate, freq, (p) => (p < 0.5 ? 1 : -1))));

/** A clean electronic beep from `at` for `len` s, its pitch gliding from `f0` to `f1` (silent outside it). */
function beep(at: number, len: number, f0: number, f1: number): Voice {
  return (t) => {
    const a = t - at;
    if (a < 0 || a > len) return 0;
    const k = a / len;
    // (Phase of a linear glide: the integral of the pitch.)
    const ph = f0 * a + ((f1 - f0) * a * a) / (2 * len);
    const env = Math.min(1, a / 0.004) * Math.min(1, (len - a) / 0.012);
    return env * (Math.sin(TAU * ph) + 0.18 * Math.sin(TAU * 3 * ph)) * (1 - 0.15 * k);
  };
}

/** A metal tok: a small hard part knocked (two modes ringing down fast) with a tap of noise. */
function clink(rate: number, at: number, f: number, decay: number, seed: number): Voice {
  const tap = bandpass(rate, () => f * 1.3, 1.5, noise(seed));
  const life = decay * 9 + 0.01;
  return (t) => {
    const age = t - at;
    if (age < 0 || age > life) return 0;
    const e = Math.exp(-age / decay);
    return e * (Math.sin(TAU * f * age) + 0.5 * Math.sin(TAU * f * 2.76 * age)) + 1.4 * Math.exp(-age / 0.004) * tap(t);
  };
}

/** An energy zap from `at`: a falling pitch from `f0` to `f1` over `len`, pulsed, with a rasp of its own overtone (silent outside it). */
function zap(at: number, len: number, f0: number, f1: number, pulseHz = 60): Voice {
  return (t) => {
    const a = t - at;
    if (a < 0 || a > len * 1.6) return 0;
    const k = Math.min(1, a / len);
    // Exponential glide: phase = f0 * len / ln(r) * (r^(a/len) - 1), r = f1 / f0.
    const r = f1 / f0;
    const ph = a <= len ? (f0 * len * (r ** k - 1)) / Math.log(r) : (f0 * len * (r - 1)) / Math.log(r) + f1 * (a - len);
    const env = Math.min(1, a / 0.003) * Math.exp(-a / (len * 0.55));
    const s = Math.sin(TAU * ph);
    return env * throb(a, pulseHz, 0.6) * (s + 0.35 * Math.sign(s) * Math.abs(Math.sin(TAU * 2.01 * ph)));
  };
}

/** A low thump from `at`: a sine dropping from `f0` to `f1`. */
function thump(at: number, f0: number, f1: number, decay: number): Voice {
  return (t) => {
    const a = t - at;
    if (a < 0 || a > decay * 8) return 0;
    const ph = f1 * a + ((f0 - f1) * decay * (1 - Math.exp(-a / (decay * 0.5)))) * 0.5;
    return Math.min(1, a / 0.002) * Math.exp(-a / decay) * Math.sin(TAU * ph);
  };
}

/** A bright tick of noise at `at` (a spark, a crackle's grain). */
function tick(rate: number, at: number, centre: number, seed: number, decay = 0.004): Voice {
  const n = bandpass(rate, () => centre, 2, noise(seed));
  return (t) => {
    const a = t - at;
    // (The filter runs every sample so its state is ready; silent outside the tick.)
    const v = n(t);
    return a < 0 || a > decay * 8 ? 0 : Math.exp(-a / decay) * v;
  };
}

/** A handful of seeded ticks scattered over [from, to): crackling. */
function crackles(rate: number, count: number, from: number, to: number, seed: number, lo = 2500, hi = 6000): Voice {
  const r = rng(seed);
  const ts = Array.from({ length: count }, (_, i) => tick(rate, from + r() * (to - from), lo + r() * (hi - lo), seed + 7 * i + 1, 0.002 + r() * 0.004));
  const gains = ts.map(() => 0.4 + 0.6 * r());
  return (t) => ts.reduce((s, v, i) => s + gains[i]! * v(t), 0);
}

/** A glassy shimmer: a few bright partials beating slowly against each other. */
function shimmerTone(freqs: readonly number[]): Voice {
  return (t) => freqs.reduce((s, f, i) => s + Math.sin(TAU * f * t + i * 1.7) * (0.6 + 0.4 * Math.sin(TAU * (3 + i * 1.3) * t)), 0) / freqs.length;
}

const SOUNDS: Record<ChandySound, (rate: number) => Float32Array> = {
  // The scope's lock-on: two rising beeps, the second higher (a chirp up, then a firmer one).
  lock: (rate) => {
    const a = beep(0, 0.055, 1500, 1750);
    const b = beep(0.085, 0.075, 2000, 2250);
    return render(rate, 0.18, (t) => a(t) + b(t));
  },
  // The lock let go: one falling beep.
  unlock: (rate) => {
    const a = beep(0, 0.11, 1800, 1150);
    return render(rate, 0.13, (t) => a(t));
  },
  // The rifle off his back: the sling's strap sliding (a soft rising rasp), then the rifle clacking into his hands.
  unsling: (rate) => {
    const strap = bandpass(rate, (t) => 900 + 1500 * Math.min(1, t / 0.18), 2.2, murk(rate, 5000, 401));
    const clack = clink(rate, 0.2, 1350, 0.02, 403);
    const knock = clink(rate, 0.205, 520, 0.03, 407);
    return render(rate, 0.34, (t) => {
      const slide = t < 0.2 ? Math.sin((Math.PI * t) / 0.2) ** 1.4 : 0;
      return 2.4 * slide * strap(t) + 0.7 * clack(t) + 0.5 * knock(t);
    });
  },
  // The rifle charging (his aim): a pulse winding up, its pitch and its throb both climbing, a thin whine rising over it.
  charge: (rate) => {
    const D = 0.5;
    const body = lowpass(rate, 1800, osc(rate, (t) => 160 + 640 * (t / D) ** 1.4, saw));
    const whine = osc(rate, (t) => 1900 + 1900 * (t / D) ** 1.2, sine);
    return render(rate, D, (t) => {
      const k = t / D;
      const env = Math.min(1, t / 0.03) * (0.45 + 0.55 * k) * Math.min(1, (D - t) / 0.03);
      // (The throb's rate climbs from 7 to 34 a second: its phase is the integral.)
      const pulse = 1 - 0.75 * (0.5 - 0.5 * Math.tanh(3 * Math.sin(TAU * (7 * t + (27 * t * t) / (2 * D)))));
      return env * pulse * (body(t) + 0.22 * k * whine(t));
    });
  },
  // His pulse shot: a sharp crack of noise, a fast falling zap that throbs, a low thump under it, two fading pulses after.
  shot: (rate) => {
    const crack = bandpass(rate, () => 3200, 1.2, noise(409));
    const z = zap(0, 0.09, 2600, 280, 55);
    const low = thump(0, 110, 45, 0.07);
    const tail = osc(rate, () => 520, (p) => sine(p) + 0.3 * sine(3 * p));
    return render(rate, 0.42, (t) => {
      const c = Math.exp(-t / 0.006) * crack(t);
      const tv = tail(t);
      const echo = t > 0.1 ? Math.exp(-(t - 0.1) / 0.09) * throb(t - 0.1, 14, 1) * tv : 0;
      return 1.3 * c + z(t) + 1.2 * low(t) + 0.3 * echo;
    });
  },
  // The rifle back on the sling: its clack, and the scope's power dropping (a falling blip).
  stow: (rate) => {
    const clack = clink(rate, 0, 1250, 0.022, 411);
    const knock = clink(rate, 0.004, 480, 0.03, 413);
    const down = beep(0.06, 0.13, 900, 320);
    return render(rate, 0.24, (t) => 0.8 * clack(t) + 0.5 * knock(t) + 0.45 * down(t));
  },
  // A clone vanishing: a reversed whoosh (it swells, then cuts off) with a cloak's shimmer throbbing through it.
  cloak: (rate) => {
    const D = 0.32;
    const air = bandpass(rate, (t) => 700 + 3600 * (t / D) ** 2, 2.5, murk(rate, 7000, 419));
    const glass = shimmerTone([2350, 2960, 3720]);
    return render(rate, D, (t) => {
      const swell = (t / D) ** 2.4 * Math.min(1, (D - t) / 0.012);
      return swell * (2.6 * air(t) + 0.35 * throb(t, 38, 0.8) * glass(t));
    });
  },
  // A clone appearing: a quick upward pop and a shimmer settling.
  decloak: (rate) => {
    const glass = shimmerTone([2100, 2650, 3340]);
    return render(rate, 0.24, (t) => {
      // (Its pitch rising from 320 to 1500: phase is the integral.)
      const ph = 1500 * t - 1180 * 0.025 * (1 - Math.exp(-t / 0.025));
      const pop = Math.min(1, t / 0.002) * Math.exp(-t / 0.03) * Math.sin(TAU * ph);
      const sh = t > 0.02 ? Math.exp(-(t - 0.02) / 0.07) * throb(t, 30, 0.7) * glass(t) : 0;
      return pop + 0.45 * sh;
    });
  },
  // A clone fading: a soft fizz, pulsing as it thins away.
  fade: (rate) => {
    const fizz = bandpass(rate, (t) => 4200 - 1600 * Math.min(1, t / 0.35), 1.6, noise(421));
    return render(rate, 0.36, (t) => Math.min(1, t / 0.02) * Math.exp(-t / 0.11) * throb(t, 26, 0.75) * fizz(t));
  },
  // A spark landing: a bright tick, a blip ringing down, a few grains of crackle.
  spark: (rate) => {
    const hit = tick(rate, 0, 5200, 431, 0.003);
    const ring = beep(0, 0.07, 2600, 2100);
    const grains = crackles(rate, 5, 0.02, 0.14, 433, 3500, 7000);
    return render(rate, 0.18, (t) => 1.6 * hit(t) + 0.35 * ring(t) + 0.8 * grains(t));
  },
  // Static dying away: a crackling hiss gated in uneven bursts, thinning out.
  static: (rate) => {
    const hiss = bandpass(rate, () => 2800, 1.3, noise(439));
    const r = rng(443);
    const gates = Array.from({ length: 40 }, () => r());
    return render(rate, 0.46, (t) => {
      const g = gates[Math.floor(t * 85) % gates.length]! > 0.45 ? 1 : 0.15;
      return Math.min(1, t / 0.01) * Math.exp(-t / 0.13) * g * hiss(t);
    });
  },
  // The scatter shot bursting: an energy pop with a thump and crackle spraying out.
  scatter: (rate) => {
    const pop = zap(0, 0.07, 1800, 220, 70);
    const low = thump(0, 95, 50, 0.06);
    const grit = crackles(rate, 12, 0.02, 0.32, 449);
    const puff = bandpass(rate, () => 1600, 1, murk(rate, 6000, 457));
    return render(rate, 0.42, (t) => 0.9 * pop(t) + 1.0 * low(t) + 0.9 * grit(t) + 1.4 * Math.exp(-t / 0.04) * puff(t));
  },
  // A beam switching on: a click, then a low hum pulling up to pitch and throbbing.
  hum: (rate) => {
    const body = pulseWave(rate, (t) => 82 + 36 * Math.min(1, t / 0.08), 900);
    const click = tick(rate, 0, 3800, 461, 0.002);
    return render(rate, 0.4, (t) => {
      const env = Math.min(1, t / 0.04) * Math.min(1, (0.4 - t) / 0.12);
      return 0.8 * click(t) + env * throb(t, 12, 0.45) * body(t);
    });
  },
  // A beam (or the queen lock's aim) switching off: the hum winding down, its throb slowing.
  humOff: (rate) => {
    const D = 0.42;
    const body = pulseWave(rate, (t) => 118 - 78 * (t / D), 800);
    return render(rate, D, (t) => {
      const k = t / D;
      const pulse = 1 - 0.5 * (0.5 - 0.5 * Math.tanh(3 * Math.sin(TAU * (12 * t - (9 * t * t) / (2 * D)))));
      return (1 - k) ** 1.3 * Math.min(1, t / 0.01) * pulse * body(t);
    });
  },
  // An energy field going up: a glassy shimmer swelling and settling, throbbing softly.
  shield: (rate) => {
    const glass = shimmerTone([880, 1320, 1760, 2215]);
    return render(rate, 0.5, (t) => {
      const env = Math.min(1, t / 0.09) * Math.exp(-Math.max(0, t - 0.09) / 0.16);
      return env * throb(t, 16, 0.5) * glass(t);
    });
  },
  // The field popping: a quick upward bubble pop, a puff, the shimmer falling away.
  pop: (rate) => {
    const puff = bandpass(rate, () => 1400, 1.2, murk(rate, 5000, 467));
    const glass = shimmerTone([1760, 2215, 2790]);
    return render(rate, 0.26, (t) => {
      // (Its pitch rising from 500 to 1400, a bubble's.)
      const ph = 1400 * t - 900 * 0.012 * (1 - Math.exp(-t / 0.012));
      const bub = Math.min(1, t / 0.002) * Math.exp(-t / 0.025) * Math.sin(TAU * ph);
      const fall = Math.exp(-t / 0.07) * glass(t * (1 - 0.6 * t));
      return bub + 1.4 * Math.exp(-t / 0.03) * puff(t) + 0.35 * fall;
    });
  },
  // Rapid fire's hits: three quick zaps.
  zaps: (rate) => {
    const zs = [0, 0.085, 0.17].map((at, i) => zap(at, 0.055, 2300 - 150 * i, 520, 80));
    return render(rate, 0.28, (t) => zs.reduce((s, z) => s + z(t), 0));
  },
  // The dizziness gone: a little two-note chime, up a fourth, ringing like a scope's all-clear.
  clear: (rate) => {
    const bell = (at: number, f: number) => (t: number) => {
      const a = t - at;
      if (a < 0) return 0;
      return Math.min(1, a / 0.003) * Math.exp(-a / 0.12) * (Math.sin(TAU * f * a) + 0.25 * Math.sin(TAU * f * 2.01 * a));
    };
    const a = bell(0, 1320);
    const b = bell(0.08, 1760);
    return render(rate, 0.42, (t) => a(t) + 0.9 * b(t));
  },
  // A pulse round flying past: a throbbing tone bending down as it goes, in a rush of air.
  round: (rate) => {
    const D = 0.28;
    const tone = osc(rate, (t) => 980 - 380 * (t / D), (p) => sine(p) + 0.3 * sine(2 * p));
    const air = bandpass(rate, (t) => 2400 - 1200 * (t / D), 1.4, murk(rate, 7000, 479));
    return render(rate, D, (t) => {
      const env = Math.sin(Math.PI * Math.min(1, t / D)) ** 1.3;
      return env * (0.5 * throb(t, 42, 0.8) * tone(t) + 2.0 * air(t));
    });
  },
  // Glass-like shatter (a piece hit, your king in Dodge; no gore): a crack of noise, bright shards ringing at scattered moments, a dull knock.
  shatter: (rate) => {
    const r = rng(487);
    const shards = Array.from({ length: 14 }, () => ({ at: r() * 0.16, f: 2600 + r() * 4600, d: 0.02 + r() * 0.05, g: 0.4 + 0.6 * r() }));
    const burst = bandpass(rate, () => 5200, 0.9, noise(491));
    const low = thump(0, 160, 70, 0.04);
    return render(rate, 0.46, (t) => {
      let s = 0;
      for (const sh of shards) {
        const a = t - sh.at;
        if (a >= 0 && a < sh.d * 8) s += sh.g * Math.exp(-a / sh.d) * Math.sin(TAU * sh.f * a);
      }
      return 0.32 * s + 1.5 * Math.exp(-t / 0.035) * burst(t) + 0.6 * low(t);
    });
  },
  // Dodge's warning: three alarm blips, a rounded pulse tone.
  alarm: (rate) => {
    const tone = pulseWave(rate, () => 940, 2600);
    return render(rate, 0.36, (t) => {
      let env = 0;
      for (const at of [0, 0.12, 0.24]) {
        const a = t - at;
        if (a >= 0 && a < 0.075) env = Math.min(1, a / 0.004) * Math.min(1, (0.075 - a) / 0.01);
      }
      return env * tone(t);
    });
  },
  // A big energy pop: a deep thump, a long falling zap, a rush of noise, the throb fading.
  blast: (rate) => {
    const z = zap(0, 0.2, 1800, 120, 30);
    const low = thump(0, 90, 38, 0.14);
    const rush = murk(rate, 1800, 499);
    return render(rate, 0.62, (t) => {
      const air = Math.min(1, t / 0.005) * Math.exp(-t / 0.12) * throb(t, 20, 0.5) * rush(t);
      return 0.9 * z(t) + 1.4 * low(t) + 2.4 * air;
    });
  },
  // An upgrade: a part clicking onto the rifle, then a rising chord in pulse tones (each note a pulse, the last one held).
  upgrade: (rate) => {
    const click = clink(rate, 0, 1600, 0.015, 503);
    const notes = [440, 554.37, 659.25, 880].map((f, i) => ({ at: 0.08 + i * 0.075, v: pulseWave(rate, () => f, 2200) }));
    return render(rate, 0.72, (t) => {
      let s = 0;
      for (const [i, n] of notes.entries()) {
        const a = t - n.at;
        const v = n.v(t);
        if (a < 0) continue;
        const hold = i === notes.length - 1 ? 0.3 : 0.11;
        s += Math.min(1, a / 0.006) * Math.exp(-Math.max(0, a - hold) / 0.06) * throb(a, 24, 0.35) * v;
      }
      return 0.7 * click(t) + 0.5 * s;
    });
  },
  // Dodge's beams: a heavy laser firing and holding (a falling attack into a low, detuned buzz throbbing fast, a thin whine and a
  // crackle riding it), then cutting out.
  beam: (rate) => {
    const D = 0.95;
    const z = zap(0, 0.08, 2400, 300, 50);
    const lo1 = lowpass(rate, 1100, lowpass(rate, 1400, osc(rate, () => 138, saw)));
    const lo2 = lowpass(rate, 1100, lowpass(rate, 1400, osc(rate, () => 141.5, saw)));
    const whine = osc(rate, () => 2350, sine);
    const grit = bandpass(rate, () => 3200, 2, noise(509));
    return render(rate, D, (t) => {
      const env = Math.min(1, t / 0.03) * Math.min(1, (D - t) / 0.06);
      const hold = env * throb(t, 30, 0.4) * (lo1(t) + lo2(t) + 0.12 * whine(t) + 0.35 * grit(t));
      return 0.8 * z(t) + 0.6 * hold;
    });
  },
  // A Dodge hit on your king: a sharp crack, a snap of tone and a knock under it.
  crack: (rate) => {
    const burst = bandpass(rate, () => 4200, 1, noise(521));
    const snap = beep(0, 0.035, 2100, 1300);
    const low = thump(0, 140, 60, 0.04);
    return render(rate, 0.22, (t) => 2.0 * Math.exp(-t / 0.012) * burst(t) + 0.4 * snap(t) + 0.9 * low(t));
  },
  // The kill's crackle (a beat every half second): a short burst of crackling energy over a low buzz.
  crackle: (rate) => {
    const grit = crackles(rate, 9, 0, 0.22, 523, 2200, 6500);
    const buzz = lowpass(rate, 900, osc(rate, () => 92, saw));
    return render(rate, 0.26, (t) => {
      const env = Math.min(1, t / 0.01) * Math.exp(-t / 0.09);
      return 1.1 * grit(t) + 0.8 * env * throb(t, 40, 0.7) * buzz(t);
    });
  },
  // His intro: the board and platform rising out of the swamp, water streaming off them (a gushing hiss) over a low rumble, a few bubbles.
  surface: (rate) => {
    const D = 1.2;
    const water = bandpass(rate, () => 1100, 0.8, murk(rate, 3000, 541));
    const rumble = murk(rate, 160, 547);
    const r = rng(557);
    const bubbles = Array.from({ length: 7 }, () => ({ at: 0.1 + r() * 0.9, f: 280 + r() * 380 }));
    return render(rate, D, (t) => {
      const env = Math.min(1, t / 0.15) * Math.min(1, (D - t) / 0.35);
      let b = 0;
      for (const bu of bubbles) {
        const a = t - bu.at;
        if (a >= 0 && a < 0.06) b += Math.sin((Math.PI * a) / 0.06) * Math.sin(TAU * (bu.f * a + 2400 * a * a));
      }
      return env * (1.8 * water(t) + 3.2 * rumble(t)) + 0.25 * b;
    });
  },
  // His intro: the milk crates set down on the deck: a hollow plastic thunk and a little rattle.
  crate: (rate) => {
    const body = (t: number) => Math.exp(-t / 0.045) * (Math.sin(TAU * 210 * t) + 0.6 * Math.sin(TAU * 470 * t) + 0.25 * Math.sin(TAU * 1030 * t));
    const rattle = crackles(rate, 4, 0.03, 0.12, 563, 1200, 2600);
    const slap = bandpass(rate, () => 900, 1, noise(569));
    return render(rate, 0.24, (t) => body(t) + 0.8 * rattle(t) + 1.2 * Math.exp(-t / 0.008) * slap(t));
  },
  // His intro's storm coming in: a swamp splash, a rush of water falling from bright to dull, a low plunge.
  splash: (rate) => {
    const D = 0.5;
    const water = bandpass(rate, (t) => 2600 - 2000 * Math.min(1, t / D), 1, murk(rate, 7000, 571));
    const plunge = thump(0.02, 120, 50, 0.08);
    return render(rate, D, (t) => Math.min(1, t / 0.01) * Math.exp(-t / 0.14) * 2.6 * water(t) + 0.8 * plunge(t));
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<ChandySound, number> = {
  lock: 0.115,
  unlock: 0.102,
  unsling: 0.193,
  charge: 0.233,
  shot: 0.238,
  stow: 0.231,
  cloak: 0.186,
  decloak: 0.4,
  fade: 0.637,
  spark: 0.407,
  static: 0.848,
  scatter: 0.293,
  hum: 0.0919,
  humOff: 0.154,
  shield: 0.745,
  pop: 0.475,
  zaps: 0.239,
  clear: 0.17,
  round: 0.181,
  shatter: 0.326,
  alarm: 0.096,
  blast: 0.17,
  upgrade: 0.162,
  beam: 0.16,
  crack: 0.312,
  crackle: 0.435,
  surface: 0.288,
  crate: 0.27,
  splash: 0.28,
};

const cache = soundCache("chandy");
/** The samples for one of his sounds at a sample rate (made once, then reused). Each is about 3 to 4 dB under a move's mean, peaks under half a move's. */
export function chandySound(name: ChandySound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const CHANDY_SOUND_NAMES = Object.keys(SOUNDS) as ChandySound[];
