/**
 * Moo & Moon's sounds, synthesized (no files, no licenses), as the other bosses' are. He's a cow, so he moos: a soft one
 * (his moonbeam), a happy one (a capture, a check, a win, his entrance and his select sound), a big MOO (the Full Moon)
 * and a sleepy one (dazed), each a voice made of a pulse train through two formants that glide from "mm" to "oo", a slow
 * vibrato and a breath of noise. Around them his thump, his oof, a flop onto the moon and the slip and plop of sitting
 * down on it. The Moon has a hum (a rising charge: the moonbeam gathering) and a swell (it fills to full). The beam is an
 * energy beam, like a Kamehameha made of moonlight and not a UFO's: a rising charge, then a bright whoosh with a soft
 * shimmer, and a short bright zap for each beam of the flurry; the aura going out is a fizz.
 * Each is a pure function of the sample rate (its noise is seeded), so a test can measure it: every one stays quieter
 * than a piece's move (peak and loudness), and the ten little beams of his attack on a king together too.
 *
 * Which cue plays which: kit.sounds in kits.ts (his animations' cues).
 */
import { bandpass, lowpass, noise, osc, render, rng, saw, sine, soft, soundCache, type Voice } from "./synth.ts";

export type MooSound = "mooSoft" | "mooHappy" | "mooBig" | "mooSleepy" | "thump" | "oof" | "flop" | "slip" | "plop" | "hum" | "charge" | "swell" | "flare" | "beam" | "zap" | "shimmer" | "fizz";

/** A voice read once a sample however many filters share it (a source feeding two formants). */
const shared = (v: Voice): Voice => {
  let at = NaN;
  let value = 0;
  return (t) => {
    if (t !== at) {
      at = t;
      value = v(t);
    }
    return value;
  };
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * Math.max(0, Math.min(1, u));
/** Noise with its highs rolled off twice: a soft puff or breath, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));

/** A moo's shape: how long, the pitch (Hz) at its start, peak and end, its two formants (Hz) closed ("mm") and open ("oo"), and how rough and breathy. */
interface Moo {
  dur: number;
  pitch: [number, number, number];
  f1: [number, number];
  f2: [number, number];
  vibrato: [number, number];
  /** Growl: depth of an amplitude wobble at 28 Hz. */
  rough: number;
  breath: number;
  /** Seconds the mouth takes to open, and the attack and release of the whole. */
  open: number;
  attack: number;
  release: number;
  seed: number;
}

function moo(rate: number, m: Moo): Float32Array {
  const source = shared(
    osc(
      rate,
      (t) => {
        const u = t / m.dur;
        const f = u < 0.35 ? lerp(m.pitch[0], m.pitch[1], u / 0.35) : lerp(m.pitch[1], m.pitch[2], (u - 0.35) / 0.65);
        return f * (1 + m.vibrato[1] * Math.sin(2 * Math.PI * m.vibrato[0] * t));
      },
      saw,
    ),
  );
  const rolled = lowpass(rate, 2600, source);
  const a = bandpass(rate, (t) => lerp(m.f1[0], m.f1[1], t / m.open), 6, rolled);
  const b = bandpass(rate, (t) => lerp(m.f2[0], m.f2[1], t / m.open), 7, rolled);
  const air = bandpass(rate, () => 1400, 1.2, murk(rate, 3000, m.seed));
  return render(rate, m.dur, (t) => {
    const env = Math.min(1, t / m.attack) * Math.min(1, (m.dur - t) / m.release);
    const grr = 1 - m.rough * (0.5 + 0.5 * Math.sin(2 * Math.PI * 28 * t));
    return env * (grr * (2.2 * a(t) + 1.2 * b(t) + 0.15 * rolled(t)) + m.breath * air(t));
  });
}

const SOUNDS: Record<MooSound, (rate: number) => Float32Array> = {
  // A soft moo: short, low, closed lips opening a little (the moonbeam's).
  mooSoft: (rate) => moo(rate, { dur: 0.4, pitch: [150, 158, 128], f1: [330, 470], f2: [700, 900], vibrato: [5, 0.015], rough: 0, breath: 0.25, open: 0.12, attack: 0.07, release: 0.16, seed: 1001 }),
  // A happy moo: higher, lilting up, a little longer.
  mooHappy: (rate) => moo(rate, { dur: 0.55, pitch: [165, 235, 190], f1: [360, 560], f2: [760, 1150], vibrato: [6, 0.025], rough: 0, breath: 0.15, open: 0.16, attack: 0.06, release: 0.18, seed: 1003 }),
  // A big MOO: low, loud, long, the mouth wide, a growl in it, a fall at the end.
  mooBig: (rate) => moo(rate, { dur: 1.05, pitch: [88, 128, 80], f1: [420, 640], f2: [780, 1000], vibrato: [4.5, 0.02], rough: 0.3, breath: 0.2, open: 0.22, attack: 0.05, release: 0.3, seed: 1005 }),
  // A sleepy moo: slow, falling, breathy, the vibrato lazy.
  mooSleepy: (rate) => moo(rate, { dur: 0.75, pitch: [135, 125, 88], f1: [320, 430], f2: [660, 840], vibrato: [3.4, 0.03], rough: 0.1, breath: 0.45, open: 0.25, attack: 0.12, release: 0.34, seed: 1007 }),
  // A thump of his hooves landing: a low sine dropping in pitch, a puff of dust.
  thump: (rate) => {
    const body = osc(rate, (t) => 58 + 85 * Math.exp(-t / 0.026), sine);
    const dust = murk(rate, 650, 1011);
    return render(rate, 0.22, (t) => Math.exp(-t / 0.06) * (body(t) + 1.0 * dust(t)));
  },
  // An oof: a small grunt, breathy, falling.
  oof: (rate) => {
    const v = lowpass(rate, 1100, osc(rate, (t) => 190 - 70 * Math.min(1, t / 0.2), saw));
    const breath = murk(rate, 1500, 1013);
    return render(rate, 0.22, (t) => Math.sin(Math.PI * Math.min(1, t / 0.22)) ** 0.7 * (1.5 * v(t) + 0.5 * breath(t)));
  },
  // A flop: him dropping onto the moon, a soft thud with a bounce under it.
  flop: (rate) => {
    const body = osc(rate, (t) => 80 + 60 * Math.exp(-t / 0.03), sine);
    const bounce = osc(rate, (t) => 190 - 80 * Math.min(1, (t - 0.07) / 0.12), sine);
    const cloth = murk(rate, 900, 1017);
    return render(rate, 0.34, (t) => Math.exp(-t / 0.07) * (1.1 * body(t) + 0.8 * cloth(t)) + (t > 0.07 ? Math.exp(-(t - 0.07) / 0.06) * 0.7 * bounce(t) : 0));
  },
  // The moon slipping out of his arms: a quick soft slide down, a breath of air.
  slip: (rate) => {
    const air = bandpass(rate, (t) => 2200 - 1500 * Math.min(1, t / 0.14), 1.5, murk(rate, 5000, 1019));
    const slide = osc(rate, (t) => 620 - 380 * Math.min(1, t / 0.14), sine);
    return render(rate, 0.17, (t) => Math.sin(Math.PI * Math.min(1, t / 0.17)) ** 1.2 * (2.4 * air(t) + 0.35 * slide(t)));
  },
  // Dropping onto the boat: a round plop, the little bounce of something floating.
  plop: (rate) => {
    const a = osc(rate, (t) => 280 + 260 * (1 - Math.exp(-t / 0.018)), sine);
    const b = osc(rate, (t) => 340 + 200 * (1 - Math.exp(-Math.max(0, t - 0.11) / 0.018)), sine);
    return render(rate, 0.3, (t) => Math.exp(-t / 0.05) * a(t) + (t >= 0.11 ? 0.55 * Math.exp(-(t - 0.11) / 0.05) * b(t) : 0));
  },
  // The moon starts to hum, gathering light: a rising charge, bright and soft, a shimmer of air above it.
  hum: (rate) => {
    const tone = osc(rate, (t) => 220 * 2 ** (2.2 * Math.min(1, t / 0.27)), sine);
    const octave = osc(rate, (t) => 440 * 2 ** (2.2 * Math.min(1, t / 0.27)), sine);
    const air = bandpass(rate, (t) => 1800 + 2600 * Math.min(1, t / 0.27), 2, murk(rate, 6000, 1021));
    return render(rate, 0.3, (t) => {
      const rise = Math.min(1, t / 0.27) ** 1.6;
      const tremble = 0.85 + 0.15 * Math.sin(2 * Math.PI * 24 * t);
      return rise * (1 - Math.max(0, (t - 0.27) / 0.03)) * tremble * (1.2 * tone(t) + 0.45 * octave(t) + 0.9 * air(t));
    });
  },
  // The flurry's charge: the same, bigger, brighter and a little longer, a second voice a fifth above.
  charge: (rate) => {
    const tone = osc(rate, (t) => 200 * 2 ** (2.6 * Math.min(1, t / 0.36)), sine);
    const fifth = osc(rate, (t) => 300 * 2 ** (2.6 * Math.min(1, t / 0.36)), sine);
    const air = bandpass(rate, (t) => 1500 + 3500 * Math.min(1, t / 0.36), 2, murk(rate, 6500, 1023));
    return render(rate, 0.4, (t) => {
      const rise = Math.min(1, t / 0.36) ** 1.5;
      return rise * (1 - Math.max(0, (t - 0.36) / 0.04)) * (0.85 + 0.15 * Math.sin(2 * Math.PI * 30 * t)) * (1.1 * tone(t) + 0.7 * fifth(t) + 1.0 * air(t));
    });
  },
  // The moon filling out to full: a pad of three soft voices swelling together, sparkles climbing over it.
  swell: (rate) => {
    const notes = [330, 495, 660].map((f) => osc(rate, (t) => f * (1 + 0.004 * Math.sin(2 * Math.PI * 5 * t)) * (1 + 0.1 * Math.min(1, t / 0.6)), sine));
    const r = rng(1027);
    const sparkles = Array.from({ length: 7 }, (_, i) => ({ at: 0.12 + 0.08 * i + 0.03 * r(), f: 1800 + 320 * i + 200 * r() }));
    const pings = sparkles.map((s) => osc(rate, () => s.f, sine));
    return render(rate, 0.8, (t) => {
      const env = Math.min(1, t / 0.55) ** 1.4 * Math.min(1, (0.8 - t) / 0.2);
      let v = env * (notes[0]!(t) + 0.8 * notes[1]!(t) + 0.55 * notes[2]!(t));
      sparkles.forEach((s, i) => {
        const p = pings[i]!(t);
        if (t >= s.at && t < s.at + 0.12) v += 0.2 * Math.exp(-(t - s.at) / 0.03) * p;
      });
      return v;
    });
  },
  // The aura flaring on as he turns powered: a whump, a roar of flame rising, crackles.
  flare: (rate) => {
    const whump = osc(rate, (t) => 66 + 90 * Math.exp(-t / 0.05), sine);
    const roar = bandpass(rate, (t) => 450 + 2600 * Math.min(1, t / 0.28), 0.9, murk(rate, 6500, 1043));
    const r = rng(1045);
    const pops = Array.from({ length: 8 }, (_, i) => ({ at: 0.08 + 0.045 * i + 0.03 * r(), f: 700 + 1600 * r() }));
    const tones = pops.map((p) => osc(rate, () => p.f, sine));
    return render(rate, 0.55, (t) => {
      let v = Math.min(1, t / 0.05) * Math.exp(-Math.max(0, t - 0.14) / 0.14) * 2.0 * roar(t) + Math.exp(-t / 0.08) * 1.2 * whump(t);
      pops.forEach((p, i) => {
        const x = tones[i]!(t);
        if (t >= p.at && t < p.at + 0.03) v += 0.4 * Math.exp(-(t - p.at) / 0.01) * x;
      });
      return v;
    });
  },
  // The moonbeam: a bright whoosh falling out of the sky (a tone sweeping down through a rush of air, a white core under it),
  // a soft shimmer after.
  beam: (rate) => {
    const rush = bandpass(rate, (t) => 4200 - 2800 * Math.min(1, t / 0.24), 1.3, murk(rate, 7000, 1029));
    const core = osc(rate, (t) => 2400 - 1500 * Math.min(1, t / 0.22), sine);
    const thin = osc(rate, (t) => 3600 - 2200 * Math.min(1, t / 0.22), sine);
    const glint = (rng2 => osc(rate, () => 5200 + 300 * rng2(), sine))(rng(1031));
    return render(rate, 0.42, (t) => {
      const body = Math.min(1, t / 0.03) * Math.exp(-Math.max(0, t - 0.1) / 0.09);
      const tail = Math.max(0, 1 - t / 0.42) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 18 * t)) * 0.18;
      return body * (2.2 * rush(t) + 0.6 * core(t) + 0.3 * thin(t)) + tail * glint(t);
    });
  },
  // One of the flurry's beams, or a hit of the small one at the king: short, bright, a flash of white and a ping.
  zap: (rate) => {
    const flash = bandpass(rate, (t) => 3800 - 2400 * Math.min(1, t / 0.08), 1.6, murk(rate, 7000, 1033));
    const ping = osc(rate, (t) => 2300 - 1100 * Math.min(1, t / 0.09), sine);
    return render(rate, 0.14, (t) => Math.min(1, t / 0.008) * Math.exp(-t / 0.045) * (2.0 * flash(t) + 0.75 * ping(t)));
  },
  // The beam landing: a soft shimmer, high bell-like sparkles with a slow tremble, fading.
  shimmer: (rate) => {
    const r = rng(1037);
    const parts = [2400, 3100, 3900, 4700].map((f) => ({ f, ph: r(), speed: 7 + 6 * r(), osc: osc(rate, () => f, sine) }));
    return render(rate, 0.5, (t) => {
      const env = Math.min(1, t / 0.015) * Math.exp(-t / 0.16);
      return env * parts.reduce((sum, p, i) => sum + (0.25 / (1 + 0.3 * i)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * p.speed * t + p.ph * 6)) * p.osc(t), 0);
    });
  },
  // The aura going out: a crackle of flame dying, a hiss falling away with a few pops.
  fizz: (rate) => {
    const hiss = bandpass(rate, (t) => 3600 - 2600 * Math.min(1, t / 0.45), 1.1, murk(rate, 7500, 1039));
    const r = rng(1041);
    const pops = Array.from({ length: 9 }, (_, i) => ({ at: 0.03 + 0.04 * i + 0.025 * r(), f: 900 + 1800 * r(), amp: 0.5 + 0.5 * r() }));
    const tones = pops.map((p) => osc(rate, () => p.f, sine));
    return render(rate, 0.5, (t) => {
      let v = Math.min(1, t / 0.02) * Math.max(0, 1 - t / 0.45) ** 1.4 * 1.5 * hiss(t);
      pops.forEach((p, i) => {
        const x = tones[i]!(t);
        if (t >= p.at && t < p.at + 0.03) v += p.amp * 0.5 * Math.exp(-(t - p.at) / 0.008) * x;
      });
      return v;
    });
  },
};

/** Trims each to sit a little under a move's loudness, as the other bosses' do; a soft ceiling keeps the peaks well under its. */
const LEVEL: Record<MooSound, number> = {
  mooSoft: 0.041,
  mooHappy: 0.043,
  mooBig: 0.062,
  mooSleepy: 0.052,
  thump: 0.22,
  oof: 0.1,
  flop: 0.2,
  slip: 0.14,
  plop: 0.17,
  hum: 0.11,
  charge: 0.12,
  swell: 0.11,
  flare: 0.13,
  beam: 0.16,
  zap: 0.2,
  shimmer: 0.35,
  fizz: 0.2,
};

const cache = soundCache("moo");
/** The samples for one of his sounds at a sample rate (made once, then reused). Each sits under a move's mean loudness, its peaks under half a move's. */
export function mooSound(name: MooSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const MOO_SOUNDS = Object.keys(SOUNDS) as MooSound[];
