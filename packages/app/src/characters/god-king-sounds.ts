/**
 * The God King's synthesized sounds (no files, no licenses; his others are files in public/sounds/god-king/). One so far:
 * `cant`, tapping him with no charges left (Eric, Oct 15: "a short, soft 'can't' sound"): two quick, muffled low notes
 * falling, like a soft "uh-uh", well under a move's loudness. A pure function of the sample rate, so a test can measure
 * it. Made ahead in the sound worker (warmSounds), as the bosses' are.
 */
import { lowpass, osc, render, sine, soft, soundCache } from "./synth.ts";

export type GodKingSound = "cant";

const SOUNDS: Record<GodKingSound, (rate: number) => Float32Array> = {
  // "Uh-uh": two short, round low notes, the second lower, each a soft swell that dies away (a little of its octave so
  // a phone's speaker carries it), muffled.
  cant: (rate) => {
    const note = (f: number) => {
      const o1 = osc(rate, () => f, sine);
      const o2 = osc(rate, () => 2 * f, sine);
      return (t: number) => o1(t) + 0.3 * o2(t);
    };
    const hi = note(233);
    const lo = note(175);
    const swell = (age: number, len: number) => (age < 0 || age > len ? 0 : Math.max(0, Math.sin((Math.PI * age) / len)) ** 0.8);
    return render(rate, 0.26, lowpass(rate, 1800, (t) => swell(t, 0.09) * hi(t) + swell(t - 0.11, 0.13) * lo(t)));
  },
};

/** Trims each to sit well under a move's loudness; a soft ceiling keeps the peaks under its. */
const LEVEL: Record<GodKingSound, number> = { cant: 0.13 };

const cache = soundCache("godKing");
/** The samples for one of his sounds at a sample rate (made once, then reused). */
export function godKingSound(name: GodKingSound, rate: number): Float32Array {
  const key = `${name}@${rate}`;
  let s = cache.get(key);
  if (!s) {
    s = SOUNDS[name](rate).map((v) => soft(v * LEVEL[name]));
    cache.set(key, s);
  }
  return s;
}

export const GOD_KING_SOUNDS = Object.keys(SOUNDS) as GodKingSound[];
