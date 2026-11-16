/**
 * Ginger's sounds, synthesized (no files, no licenses, no voice): a cookie crunch, a sleigh-bell jingle, an ice
 * crackle and the blizzard's wind; and his challenge intro's (Nov 5, intro-ginger-nov5.md on claude/boss-art: every cue a sound):
 * the icy hum of his staff charging, the frosty zap of its blast, the glassy pop as it bursts, his whoosh, the icicle stabbing the
 * floor (a heavy crunch-crack), the elves' little steps on packed snow, their "hup!" as they toss the board (a soft two-note
 * bump, no voice), the board's clack on the ice, his cast's rising shimmer (no bell), the twinkle as the pieces appear, his cane's
 * thump, and a gust over the blizzard. Each is a pure function of the sample rate (its noise is seeded), so a test can
 * measure it: every one stays quieter than a piece's move sound (peak and loudness; see test/gingerbread.test.ts).
 */
import { bandpass, lowpass, noise, osc, render, rng, sine, soft, type Voice, soundCache } from "./synth.ts";

export type GingerSound = "crunch" | "jingle" | "crackle" | "wind" | "charge" | "blast" | "burst" | "whoosh" | "stab" | "step" | "heave" | "clack" | "cast" | "sparkle" | "thump" | "gust";

/** Short bursts of noise at the given times, each shaped by `burst(age)`. */
function grains(times: readonly number[], burst: (age: number, i: number) => number): Voice {
  return (t) => {
    let v = 0;
    times.forEach((t0, i) => {
      if (t >= t0) v += burst(t - t0, i);
    });
    return v;
  };
}

const SOUNDS: Record<GingerSound, (rate: number) => Float32Array> = {
  // A bite of gingerbread: four quick crunchy grains of mid-band noise, the first the loudest.
  crunch: (rate) => {
    const n = noise(3);
    const crumbs = noise(5);
    const hits = [0, 0.055, 0.12, 0.2];
    const body = bandpass(rate, () => 1500, 0.9, (t) => grains(hits, (age, i) => Math.exp(-age / 0.022) * [1, 0.7, 0.8, 0.5][i]!)(t) * n(t));
    const grit = bandpass(rate, () => 4200, 1.2, (t) => (t < 0.3 ? Math.exp(-t / 0.12) : 0) * (crumbs(t) > 0.92 ? 1 : 0));
    return render(rate, 0.34, (t) => 0.9 * body(t) + 0.35 * grit(t));
  },
  // Sleigh bells shaken: a dozen small metal strikes (bright, inharmonic partials) over half a second.
  jingle: (rate) => {
    const r = rng(17);
    const strikes = Array.from({ length: 12 }, (_, i) => ({ t: i * 0.04 + r() * 0.025, f: 2200 + r() * 900, a: 0.6 + r() * 0.4 }));
    const shimmer = bandpass(rate, () => 7000, 2, noise(19));
    return render(rate, 0.7, (t) => {
      let v = 0;
      for (const s of strikes) {
        if (t < s.t) continue;
        const age = t - s.t;
        const env = s.a * Math.exp(-age / 0.05);
        if (env < 0.002) continue;
        v += env * (Math.sin(2 * Math.PI * s.f * age) + 0.6 * Math.sin(2 * Math.PI * s.f * 1.51 * age) + 0.35 * Math.sin(2 * Math.PI * s.f * 2.37 * age));
      }
      const shake = t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) / 0.2);
      return 0.07 * v + 0.25 * shake * shimmer(t);
    });
  },
  // Ice crackling: sharp clicks scattered over a high glassy ring that fades.
  crackle: (rate) => {
    const r = rng(23);
    const clicks = Array.from({ length: 16 }, () => ({ t: r() * 0.4, a: 0.4 + r() * 0.6 }));
    const n = noise(29);
    const snap = bandpass(rate, () => 5200, 1.4, (t) => grains(clicks.map((c) => c.t), (age, i) => clicks[i]!.a * Math.exp(-age / 0.004))(t) * n(t));
    const ring = osc(rate, (t) => 3100 + 200 * Math.exp(-t / 0.1), sine);
    const ring2 = osc(rate, (t) => 4650 + 250 * Math.exp(-t / 0.1), sine);
    return render(rate, 0.5, (t) => 1.1 * snap(t) + 0.1 * Math.exp(-t / 0.14) * (ring(t) + 0.6 * ring2(t)));
  },
  // The blizzard: a gust of wind that swells and dies away, with a whistle drifting through it.
  wind: (rate) => {
    const gust = (t: number) => Math.sin(Math.PI * Math.min(1, t / 1.4)) ** 1.5 * (1 + 0.25 * Math.sin(2 * Math.PI * 2.3 * t));
    const roar = lowpass(rate, 700, noise(31));
    const whistle = bandpass(rate, (t) => 900 + 500 * Math.sin(2 * Math.PI * 0.8 * t + 1) + 300 * Math.sin(2 * Math.PI * 2.9 * t), 9, noise(37));
    return render(rate, 1.4, (t) => gust(t) * (0.55 * roar(t) + 0.5 * whistle(t)));
  },
  // His staff charging: an icy hum swelling (two detuned tones rising a little), a shimmer of frost on top.
  charge: (rate) => {
    const hum = osc(rate, (t) => 330 + 90 * t, sine);
    const hum2 = osc(rate, (t) => 333 + 92 * t, sine);
    const frost = bandpass(rate, (t) => 6000 + 2500 * t, 3, noise(41));
    return render(rate, 1.0, (t) => {
      const swell = Math.min(1, t / 0.8) * (t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1);
      return swell * (0.35 * (hum(t) + hum2(t)) + 0.5 * swell * frost(t));
    });
  },
  // The blast: a sharp frosty zap (a falling-then-rising sweep) and a whoosh of air going up.
  blast: (rate) => {
    const zap = osc(rate, (t) => 1800 * Math.exp(-t / 0.05) + 500 + 1400 * t, sine);
    const air = bandpass(rate, (t) => 900 + 3500 * t, 1.5, noise(43));
    return render(rate, 0.5, (t) => 0.5 * Math.exp(-t / 0.07) * zap(t) + 0.8 * Math.sin(Math.PI * Math.min(1, t / 0.5)) * air(t));
  },
  // The burst: a crisp glassy pop, a high ring dying fast.
  burst: (rate) => {
    const pop = bandpass(rate, () => 3000, 1, noise(47));
    const ring = osc(rate, () => 3900, sine);
    const ring2 = osc(rate, () => 5870, sine);
    return render(rate, 0.35, (t) => Math.exp(-t / 0.018) * pop(t) + 0.25 * Math.exp(-t / 0.09) * (ring(t) + 0.5 * ring2(t)));
  },
  // His whoosh: a soft sweep of air.
  whoosh: (rate) => {
    const air = bandpass(rate, (t) => 600 + 2400 * t, 1.2, noise(53));
    return render(rate, 0.4, (t) => Math.sin(Math.PI * (t / 0.4)) ** 2 * air(t));
  },
  // The icicle stabbing the floor: a deep thud, ice splintering over it, and the floor's ice cracking out after it.
  stab: (rate) => {
    const thud = osc(rate, (t) => 70 + 60 * Math.exp(-t / 0.05), sine);
    const r = rng(59);
    const cracks = Array.from({ length: 22 }, (_, i) => ({ t: 0.02 + i * 0.025 + r() * 0.03, a: (0.5 + r() * 0.5) * Math.exp(-i / 14) }));
    const n = noise(61);
    const splinter = bandpass(rate, () => 3600, 1.1, (t) => grains(cracks.map((c) => c.t), (age, i) => cracks[i]!.a * Math.exp(-age / 0.006))(t) * n(t));
    const body = lowpass(rate, 1200, noise(67));
    return render(rate, 0.9, (t) => 0.9 * Math.exp(-t / 0.12) * thud(t) + 0.7 * Math.exp(-t / 0.05) * body(t) + 0.9 * splinter(t));
  },
  // An elf's little step on packed snow: a soft squeaky crunch, now and then a tiny shoe bell.
  step: (rate) => {
    const n = noise(71);
    const crunch = bandpass(rate, () => 2200, 1.3, n);
    const bell = osc(rate, () => 4400, sine);
    return render(rate, 0.12, (t) => Math.exp(-t / 0.025) * crunch(t) + 0.12 * Math.exp(-t / 0.04) * bell(t));
  },
  // Their toss: a soft "hup" (no voice): two quick low bumps, the second higher.
  heave: (rate) => {
    const a = osc(rate, () => 220, sine);
    const b = osc(rate, () => 300, sine);
    return render(rate, 0.3, (t) => (t < 0.12 ? Math.sin((Math.PI * t) / 0.12) * a(t) : 0) + (t > 0.13 ? Math.sin((Math.PI * Math.min(1, (t - 0.13) / 0.15))) * 0.9 * b(t) : 0));
  },
  // The board landing on the table: a wooden clack on ice.
  clack: (rate) => {
    const wood = bandpass(rate, () => 900, 2.5, noise(73));
    const knock = osc(rate, () => 520, sine);
    return render(rate, 0.25, (t) => Math.exp(-t / 0.02) * (wood(t) + 0.6 * knock(t)) + 0.15 * Math.exp(-t / 0.08) * knock(t));
  },
  // His cast: a bright icy sweep rising (filtered noise and a rising tone, no bell).
  cast: (rate) => {
    const sweep = bandpass(rate, (t) => 1500 + 6000 * t, 4, noise(79));
    const rise = osc(rate, (t) => 500 + 900 * t, sine);
    return render(rate, 0.7, (t) => Math.sin(Math.PI * (t / 0.7)) * (0.8 * sweep(t) + 0.2 * rise(t)));
  },
  // The pieces appearing: a soft twinkle of high glints.
  sparkle: (rate) => {
    const r = rng(83);
    const glints = Array.from({ length: 9 }, (_, i) => ({ t: i * 0.05 + r() * 0.02, f: 3500 + r() * 2500 }));
    return render(rate, 0.6, (t) => {
      let v = 0;
      for (const g of glints) if (t >= g.t) v += Math.exp(-(t - g.t) / 0.04) * Math.sin(2 * Math.PI * g.f * (t - g.t));
      return 0.25 * v;
    });
  },
  // His cane's thump on the floor: a soft low knock in a puff of frost.
  thump: (rate) => {
    const knock = osc(rate, (t) => 110 + 80 * Math.exp(-t / 0.03), sine);
    const puff = bandpass(rate, () => 1800, 1, noise(89));
    return render(rate, 0.3, (t) => Math.exp(-t / 0.06) * knock(t) + 0.3 * Math.exp(-t / 0.05) * puff(t));
  },
  // A gust over the blizzard: a quick rush of wind.
  gust: (rate) => {
    const air = bandpass(rate, (t) => 500 + 700 * Math.sin(Math.PI * t / 0.6), 1.5, noise(97));
    return render(rate, 0.6, (t) => Math.sin(Math.PI * (t / 0.6)) ** 1.5 * air(t));
  },
};

/** Trims each to sit a little under a move's loudness (as Boingo's do); a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<GingerSound, number> = {
  crunch: 1.31,
  jingle: 0.35,
  crackle: 0.55,
  wind: 0.38,
  charge: 0.19,
  blast: 0.36,
  burst: 0.6,
  whoosh: 0.6,
  stab: 0.42,
  step: 0.5,
  heave: 0.12,
  clack: 0.6,
  cast: 0.16,
  sparkle: 0.6,
  thump: 0.3,
  gust: 0.5,
};

const cache = soundCache("ginger");
/** The samples for one of his sounds at a sample rate (made once, then reused). */
export function gingerSound(name: GingerSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const GINGER_SOUNDS = Object.keys(SOUNDS) as GingerSound[];
