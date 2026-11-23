import { describe, expect, it } from "vitest";
import { BIRDIE_FIGURE } from "../src/characters/birdie-figure.ts";
import { BIRDIE_SOUNDS, birdieRun, birdieSound, type BirdieSound } from "../src/characters/birdie-sounds.ts";
import { BOSS_KITS, birdieCue } from "../src/characters/kits.ts";
import { SELECT_SOUND } from "../src/characters/boss-select.ts";
import { cueAt } from "../src/characters/power-art.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";

/**
 * Birdie's voice and his train (Eric, Nov 23; docs/decisions/2026-11-23-birdie-sounds.md): seven chirps and four train runs built in
 * code from the music helper's recipes (`stills/trailer-v2`: birdie-chirps/, birdie-train/), each under a piece's move, a chirp over a
 * run's start still under it and reading over the run; his train's run picked by how far his piece goes.
 */

const RATE = 44100;
const own = (n: string) => `birdie${n[0]!.toUpperCase()}${n.slice(1)}`;
const kit = BOSS_KITS.Birdie!;
const db = (s: ArrayLike<number>) => {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s[i]! * s[i]!;
  return 10 * Math.log10(sum / s.length);
};
const peak = (s: ArrayLike<number>) => {
  let p = 0;
  for (let i = 0; i < s.length; i++) p = Math.max(p, Math.abs(s[i]!));
  return p;
};
/** `b` laid over `a` from `at` seconds. */
const mix = (a: Float32Array, b: Float32Array, at: number) => {
  const i0 = Math.round(at * RATE);
  const out = new Float32Array(Math.max(a.length, i0 + b.length));
  out.set(a);
  for (let i = 0; i < b.length; i++) out[i0 + i]! += b[i]!;
  return out;
};

describe("Birdie's sounds", () => {
  it("are the recipes' lengths (the music helper's files: hello 0.91 s ... the long run 1.78 s)", () => {
    const LEN: Partial<Record<BirdieSound, number>> = { hello: 0.91, tsip: 0.41, teeoo: 0.39, trill: 0.42, cheer: 0.19, ask: 0.33, scold: 0.45, trainShort: 0.59, trainMedium: 0.9, trainLong: 1.78, trainToot: 0.9 };
    for (const [name, secs] of Object.entries(LEN)) expect(Math.abs(birdieSound(name as BirdieSound, RATE).length / RATE - secs!), name).toBeLessThan(0.02);
  });

  it("each is under a piece's move (peak and loudness), heard, finite and the same every time", () => {
    for (const name of BIRDIE_SOUNDS)
      for (const rate of [44100, 48000]) {
        const s = birdieSound(name, rate);
        for (const v of s) expect(Number.isFinite(v)).toBe(true);
        expect(peak(s), name).toBeLessThan(MOVE_PEAK / 2);
        expect(db(s), name).toBeLessThan(MOVE_MEAN_DB - 2);
        // (His voice and his train heard over a move; the rest of his pack kept at its first levels.)
        if (/^(hello|tsip|teeoo|trill|cheer|ask|scold|train)/.test(name)) expect(db(s), name).toBeGreaterThan(MOVE_MEAN_DB - 9);
        expect(s.length / rate, name).toBeLessThan(1.9);
      }
    expect(birdieSound("trainLong", 48000)).toEqual(birdieSound("trainLong", 48000));
  });

  it("a chirp over a run's start, as his moves play them, is still under a move, and reads over the run", () => {
    // (Each one-shot's run and its chirp, at the chirp's cue: young Birdie's, and Armored Birdie's 320 ms in.)
    const pairs: [BirdieSound, BirdieSound, number][] = [
      ...(["trainShort", "trainMedium", "trainLong"] as const).flatMap((run) => (["cheer", "tsip"] as const).map((c) => [run, c, cueAt(BIRDIE_FIGURE.anims.move!, "nod") / 1000] as [BirdieSound, BirdieSound, number])),
      ["trainToot", "trill", cueAt(BIRDIE_FIGURE.anims.capture!, "trill") / 1000],
      ["trainToot", "teeoo", cueAt(BIRDIE_FIGURE.anims.check!, "flash") / 1000],
      ["trainMedium", "tsip", cueAt(BIRDIE_FIGURE.anims.p_move!, "nod") / 1000],
      ["trainToot", "trill", cueAt(BIRDIE_FIGURE.anims.p_capture!, "trill") / 1000],
    ];
    for (const [run, chirp, at] of pairs) {
      const r = birdieSound(run, RATE);
      const c = birdieSound(chirp, RATE);
      const both = mix(r, c, at);
      expect(peak(both), `${run} + ${chirp}`).toBeLessThan(MOVE_PEAK);
      expect(db(both), `${run} + ${chirp}`).toBeLessThan(MOVE_MEAN_DB - 2);
      // (Over the chirp's span the chirp is the louder: it reads, high over the train's low puffs.)
      const i0 = Math.round(at * RATE);
      const under = r.subarray(i0, Math.min(r.length, i0 + c.length));
      expect(db(c), `${run} + ${chirp}`).toBeGreaterThan(db(under) + 0.5);
    }
  });

  it("his train's run by how far his piece goes: one square short, two to four medium, five or more long; a capture or a check, the toot", () => {
    expect(birdieRun("e7e6", false)).toBe("trainShort");
    expect(birdieRun("e8f7", false)).toBe("trainShort");
    expect(birdieRun("e7e5", false)).toBe("trainMedium");
    expect(birdieRun("g8f6", false)).toBe("trainMedium");
    expect(birdieRun("e8g8", false)).toBe("trainMedium");
    expect(birdieRun("d8h4", false)).toBe("trainMedium");
    expect(birdieRun("a8a3", false)).toBe("trainLong");
    expect(birdieRun("h1a8", false)).toBe("trainLong");
    expect(birdieRun("b2b1q", false)).toBe("trainShort");
    expect(birdieRun(undefined, false)).toBe("trainMedium");
    expect(birdieRun("a8a3", true)).toBe("trainToot");
  });

  it("his cues from the battle: the run his move's, his chirps in turn by his move's number; each made ahead in his kit", () => {
    const at = (...history: string[]) => ({ board: { history } }) as Parameters<typeof birdieCue>[1];
    expect(birdieCue("run", at("e2e4", "e7e6"))).toBe("birdieTrainShort");
    expect(birdieCue("run", at("e2e4", "a7a6", "d2d4", "a8a3"))).toBe("birdieTrainLong");
    expect(birdieCue("nod", at("e2e4", "e7e5"))).not.toBe(birdieCue("nod", at("e2e4", "e7e5", "g1f3", "b8c6")));
    expect(birdieCue("chatter", at("e2e4", "e7e5"))).toBeTruthy();
    expect(birdieCue("tootRun", at("e2e4", "e7e5"))).toBeUndefined();
    const sounds = new Set(Object.values(kit.sounds));
    for (let n = 0; n < 6; n++)
      for (const [cue, last] of [["run", "a1a2"], ["run", "a1a4"], ["run", "a1a8"], ["nod", "a1a2"], ["chatter", "a1a2"]] as const) {
        const h = [...Array.from({ length: 2 * n + 1 }, () => "e2e4"), last];
        expect(sounds.has(birdieCue(cue, at(...h))!), `${cue} ${n}`).toBe(true);
      }
  });

  it("every cue of his figure has a sound of his; every sound of his is used; the challenge is his hello", () => {
    for (const [name, a] of Object.entries(BIRDIE_FIGURE.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toBeTruthy();
    const used = new Set<string>([...Object.values(kit.sounds), SELECT_SOUND.birdie!, "birdieBell", "birdieSmash"]);
    for (const n of BIRDIE_SOUNDS) expect(used.has(own(n)), n).toBe(true);
    expect(SELECT_SOUND.birdie).toBe("birdieHello");
    // (His moves: the run first, a chirp over its start; thinking stays silent: only the board's knock as your move lands.)
    expect(BIRDIE_FIGURE.anims.move!.frames[0]!.cue).toBe("run");
    expect(BIRDIE_FIGURE.anims.capture!.frames[0]!.cue).toBe("tootRun");
    expect(BIRDIE_FIGURE.anims.check!.frames[0]!.cue).toBe("tootRun");
    expect(BIRDIE_FIGURE.anims.p_move!.frames.map((f) => f.cue)).toEqual(["run", "nod"]);
    expect(BIRDIE_FIGURE.anims.thinking!.frames.some((f) => f.cue)).toBe(false);
  });
});
