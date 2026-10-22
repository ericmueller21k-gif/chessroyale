import { describe, expect, it } from "vitest";
import { AUTOCHESS_SOUNDS, autochessSound, type AutochessSound } from "../src/autochess/sounds.ts";
import { makeBossSound } from "../src/characters/boss-sounds.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";

// Auto chess's sounds (v6, Eric Oct 20: "sounds that feel good"): reroll, place, hold, sell, XP, level up, lock in, a reveal and a
// pawn's cash-in in the fight (the HunChess engine, Oct 21), and a star-up (v8, Eric Oct 22: "a cool level up sound", a bigger one for the third star),
// synthesized, each under a piece's move in peak and loudness (as every synthesized sound here is) and each clearly its own.

const RATE = 44100;
const NAMES: AutochessSound[] = ["reroll", "place", "hold", "sell", "xp", "level", "lock", "reveal", "cash", "star2", "star3"];

/** What a sound measures: its peak, its loudness (mean level over the whole sample, dBFS), how long it sounds (s) and how bright (zero crossings a second). */
function measure(s: Float32Array) {
  let peak = 0;
  let sum = 0;
  let crossings = 0;
  let last = 0;
  let lastLoud = 0;
  s.forEach((v, i) => {
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
    if (v * last < 0) crossings++;
    last = v;
    if (Math.abs(v) > 0.01) lastLoud = i;
  });
  return { peak, db: 10 * Math.log10(sum / s.length), length: s.length / RATE, sounds: lastLoud / RATE, zcr: crossings / (s.length / RATE) };
}

describe("auto chess: the sounds (v6)", () => {
  it("there is one for each thing: reroll, place, hold, sell, XP, level up, lock in, a reveal, a cash-in, a second star, a third star", () => {
    expect([...AUTOCHESS_SOUNDS].sort()).toEqual([...NAMES].sort());
  });

  it("each is finite, the same every time, audible, and made by the boss sounds' table too (so it can be made ahead in the sound worker)", () => {
    for (const name of NAMES) {
      const s = autochessSound(name, RATE);
      for (const v of s) expect(Number.isFinite(v)).toBe(true);
      expect(measure(s).peak, `${name} is audible`).toBeGreaterThan(0.1);
      expect(s.length / RATE, name).toBeGreaterThan(0.1);
      expect(s.length / RATE, name).toBeLessThan(1.3);
      expect(makeBossSound(["autochess", name], RATE), `${name} through the table`).toEqual(s);
      // (The cache holds the one made: asking again is the same array.)
      expect(autochessSound(name, RATE)).toBe(s);
    }
    // Another rate makes another sample, with the same length in seconds.
    expect(autochessSound("place", 22050).length).toBeCloseTo(autochessSound("place", RATE).length / 2, -1);
  });

  it("sounds no louder than a piece's move: its peak under half the move's, its loudness 2 dB under the move's (as the other synthesized sounds)", () => {
    for (const name of NAMES) {
      const m = measure(autochessSound(name, RATE));
      expect(m.peak, `${name} peak`).toBeLessThan(MOVE_PEAK / 2);
      expect(m.db, `${name} loudness`).toBeLessThan(MOVE_MEAN_DB - 2);
    }
  });

  it("each is clearly different from the others: its length, its brightness or its shape sets it apart", () => {
    const m = Object.fromEntries(NAMES.map((n) => [n, measure(autochessSound(n, RATE))])) as Record<AutochessSound, ReturnType<typeof measure>>;
    for (let i = 0; i < NAMES.length; i++) {
      for (let j = i + 1; j < NAMES.length; j++) {
        const [a, b] = [m[NAMES[i]!], m[NAMES[j]!]];
        const longer = Math.max(a.sounds, b.sounds) / Math.min(a.sounds, b.sounds);
        const brighter = Math.max(a.zcr, b.zcr) / Math.min(a.zcr, b.zcr);
        expect(longer >= 1.25 || brighter >= 1.35, `${NAMES[i]} and ${NAMES[j]} differ (length x${longer.toFixed(2)}, brightness x${brighter.toFixed(2)})`).toBe(true);
      }
    }
    // The ones that are about gold sound nothing like the thunk: sell is bright and long, place is low and short.
    expect(m.sell.zcr).toBeGreaterThan(m.place.zcr * 10);
    expect(m.level.sounds).toBeGreaterThan(m.xp.sounds * 2);
    expect(m.place.zcr).toBeLessThan(500);
  });

  it("is made quickly enough to be made ahead of its cue without a stall (under 120 ms each, the longest, the level-up's chime, included)", () => {
    for (const name of NAMES) {
      const t0 = performance.now();
      autochessSound(name, 48000);
      expect(performance.now() - t0, name).toBeLessThan(120);
    }
  });

  it("the star-up sounds (v8): the second star's is about 0.6 s, the third's is bigger and about a second, and both are brighter and longer than a level-up's chime is quick", () => {
    const two = measure(autochessSound("star2", RATE));
    const three = measure(autochessSound("star3", RATE));
    expect(two.length).toBeGreaterThan(0.5);
    expect(two.length).toBeLessThan(0.75);
    expect(three.length).toBeGreaterThan(0.9);
    expect(three.length).toBeLessThan(1.2);
    // Bigger: longer, and more of it (louder on average) than the second star's.
    expect(three.sounds).toBeGreaterThan(two.sounds * 1.4);
    expect(three.db).toBeGreaterThan(two.db);
    // Both ring in the highs (a bell tail, sparkle), well above a thump.
    expect(two.zcr).toBeGreaterThan(2000);
    expect(three.zcr).toBeGreaterThan(two.zcr);
  });
});
