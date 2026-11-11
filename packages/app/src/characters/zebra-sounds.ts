/**
 * Rolling Dough's sounds (Nov 11), synthesized (no files, no licenses, no real voice), from the art's cues (shop-zebra-nov10.md, "Cues
 * for the sound round"), all quiet: the heavy back-room door (a creak, then its latch) as you go through it; the Big Mix's dough slapping
 * its bowl (`thump`, its frames 0 and 6) over a low motor; the TV's piece click as the stream's board moves; the back table's murmur
 * (low voices with no words) as a chatter line starts. Each is a pure function of the sample rate (its noise seeded), so a test can
 * measure it: every one stays well under a piece's move.
 */
import { bandpass, lowpass, noise, osc, render, sine, soft, type Voice, soundCache } from "./synth.ts";

export type ZebraSound = "door" | "thump" | "click" | "murmur";

/** Noise with its highs rolled off twice: a soft rumble, never a hiss. */
const murk = (rate: number, cut: number, seed: number): Voice => lowpass(rate, cut, lowpass(rate, cut, noise(seed)));
const env = (t: number, a: number, d: number) => (t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d));

const SOUNDS: Record<ZebraSound, (rate: number) => Float32Array> = {
  // A heavy door: a slow wooden creak (a band of noise sliding down, ratcheting on the hinge) and its latch's click.
  door: (rate) => {
    const creak = bandpass(rate, (t) => 620 - 260 * t, 7, murk(rate, 2600, 31));
    const latch = bandpass(rate, () => 2300, 3, noise(32));
    const thunk = osc(rate, () => 140, sine);
    return render(rate, 0.85, (t) => {
      const grain = 0.55 + 0.45 * Math.max(0, Math.sin(2 * Math.PI * 23 * t));
      const c = t < 0.55 ? creak(t) * grain * Math.sin((Math.PI * t) / 0.55) * 2.2 : 0;
      const at = t - 0.62;
      const l = at >= 0 ? latch(t) * Math.exp(-at / 0.012) * 1.6 + thunk(t) * Math.exp(-at / 0.05) * 0.5 : 0;
      return c + l;
    });
  },
  // The dough slapping the bowl: a soft low thud and a little wet slap, over the motor's hum.
  thump: (rate) => {
    const body = osc(rate, (t) => 90 - 30 * t, sine);
    const slap = bandpass(rate, () => 700, 1.2, murk(rate, 3000, 41));
    const hum = osc(rate, () => 60, sine);
    return render(rate, 0.32, (t) => body(t) * env(t, 0.006, 0.07) * 0.9 + slap(t) * env(t, 0.003, 0.03) * 0.8 + hum(t) * 0.12 * Math.sin((Math.PI * t) / 0.32));
  },
  // A piece set down on the stream's board: a small, dry wooden click.
  click: (rate) => {
    const tick = bandpass(rate, () => 1800, 4, noise(51));
    const knock = osc(rate, () => 820, sine);
    return render(rate, 0.08, (t) => tick(t) * Math.exp(-t / 0.006) * 1.4 + knock(t) * Math.exp(-t / 0.018) * 0.5);
  },
  // Low voices round the table, no words: a few vowels of filtered noise rising and falling, two speakers overlapping.
  murmur: (rate) => {
    const a = bandpass(rate, (t) => 420 + 120 * Math.sin(2 * Math.PI * 3.1 * t), 3, murk(rate, 1800, 61));
    const b = bandpass(rate, (t) => 300 + 90 * Math.sin(2 * Math.PI * 2.3 * t + 1), 3, murk(rate, 1500, 62));
    return render(rate, 1.2, (t) => {
      const sa = Math.max(0, Math.sin(2 * Math.PI * 4.2 * t)) ** 2;
      const sb = Math.max(0, Math.sin(2 * Math.PI * 3.3 * t + 2)) ** 2;
      const fade = Math.sin((Math.PI * t) / 1.2);
      return (a(t) * sa + b(t) * sb * 0.8) * fade * 2.4;
    });
  },
};

/** How loud each is (they're room sounds under everything: quiet). */
const LEVEL: Record<ZebraSound, number> = { door: 0.32, thump: 0.16, click: 0.18, murmur: 0.14 };

const cache = soundCache("zebra");
export function zebraSound(name: ZebraSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const ZEBRA_SOUNDS = Object.keys(SOUNDS) as ZebraSound[];
