import { describe, expect, it } from "vitest";
import { BIRDIE_FIGURE } from "../src/characters/birdie-figure.ts";
import { BIRDIE_SOUNDS, birdieSound, birdieWhistle, type BirdieSound } from "../src/characters/birdie-sounds.ts";
import { BOSS_KITS, birdieCue } from "../src/characters/kits.ts";
import { SELECT_SOUND } from "../src/characters/boss-select.ts";
import { cueAt } from "../src/characters/power-art.ts";
import { MOVE_MEAN_DB, MOVE_PEAK, soundCache } from "../src/characters/synth.ts";

/**
 * Birdie's voice and his train (Eric, Nov 23; docs/decisions/2026-11-23-birdie-sounds.md, 2026-11-23-birdie-whistles.md): seven chirps,
 * three train runs and five whistles built in code from the music helper's recipes (`stills/trailer-v2`: birdie-chirps/, birdie-train/),
 * each under a piece's move, a chirp over a move's whistle still under it and reading over it; his move's whistle picked by how far his
 * piece goes, a capture or a check, and now and then the peeps.
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
/** A steep high-pass (the second difference: +12 dB an octave), to weigh what's up where his chirps sing. */
const high = (s: ArrayLike<number>) => Float32Array.from({ length: Math.max(0, s.length - 2) }, (_, i) => s[i + 2]! - 2 * s[i + 1]! + s[i]!);
/** `b` laid over `a` from `at` seconds. */
const mix = (a: Float32Array, b: Float32Array, at: number) => {
  const i0 = Math.round(at * RATE);
  const out = new Float32Array(Math.max(a.length, i0 + b.length));
  out.set(a);
  for (let i = 0; i < b.length; i++) out[i0 + i]! += b[i]!;
  return out;
};

describe("Birdie's sounds", () => {
  it("are the recipes' lengths (the music helper's files: hello 0.91 s ... the long run 1.78 s, the toot-long whistle 1.05 s)", () => {
    const LEN: Partial<Record<BirdieSound, number>> = {
      ...{ hello: 0.91, tsip: 0.41, teeoo: 0.39, trill: 0.42, cheer: 0.19, ask: 0.33, scold: 0.45, trainMedium: 0.9, trainLong: 1.78, trainToot: 0.9 },
      ...{ whistleToot: 0.28, whistleTootToot: 0.58, whistleLong: 0.9, whistleTootLong: 1.05, whistlePeepPeep: 0.4 },
    };
    for (const [name, secs] of Object.entries(LEN)) expect(Math.abs(birdieSound(name as BirdieSound, RATE).length / RATE - secs!), name).toBeLessThan(0.02);
  });

  it("each is under a piece's move (peak and loudness), heard, finite and the same every time", () => {
    for (const name of BIRDIE_SOUNDS)
      for (const rate of [44100, 48000]) {
        const s = birdieSound(name, rate);
        for (const v of s) expect(Number.isFinite(v)).toBe(true);
        expect(peak(s), name).toBeLessThan(MOVE_PEAK / 2);
        expect(db(s), name).toBeLessThan(MOVE_MEAN_DB - 2);
        // (His voice and his train heard over a move; his move's whistles too, a little lighter (one gain for the five, so a chirp over
        // one stays under a move: the peeps, short and higher, the quietest by loudness); the rest of his pack kept at its first levels.)
        if (/^(hello|tsip|teeoo|trill|cheer|ask|scold|train)/.test(name)) expect(db(s), name).toBeGreaterThan(MOVE_MEAN_DB - 9);
        if (/^whistle[A-Z]/.test(name)) expect(db(s), name).toBeGreaterThan(MOVE_MEAN_DB - 11);
        expect(s.length / rate, name).toBeLessThan(1.9);
      }
    // (Made twice from its seed, the cache cleared between: the same samples, so every device hears the same run.)
    const first = birdieSound("trainLong", 48000).slice();
    soundCache("birdie").clear();
    const again = birdieSound("trainLong", 48000);
    expect(again).not.toBe(first);
    expect(again).toEqual(first);
  });

  it("a chirp over a whistle's start, as his moves play them, is still under a move, and reads over the whistle", () => {
    // (Each move's whistle and its chirp, at the chirp's cue: young Birdie's, and Armored Birdie's 320 ms in.)
    const MOVES = ["whistleToot", "whistleTootToot", "whistleLong", "whistlePeepPeep"] as const;
    const pairs: [BirdieSound, BirdieSound, number][] = [
      ...MOVES.flatMap((w) => (["cheer", "tsip"] as const).map((c) => [w, c, cueAt(BIRDIE_FIGURE.anims.move!, "nod") / 1000] as [BirdieSound, BirdieSound, number])),
      ...MOVES.flatMap((w) => (["cheer", "tsip"] as const).map((c) => [w, c, cueAt(BIRDIE_FIGURE.anims.p_move!, "nod") / 1000] as [BirdieSound, BirdieSound, number])),
      ["whistleTootLong", "trill", cueAt(BIRDIE_FIGURE.anims.capture!, "trill") / 1000],
      ["whistleTootLong", "teeoo", cueAt(BIRDIE_FIGURE.anims.check!, "flash") / 1000],
      ["whistleTootLong", "trill", cueAt(BIRDIE_FIGURE.anims.p_capture!, "trill") / 1000],
      ["whistleTootLong", "teeoo", cueAt(BIRDIE_FIGURE.anims.p_check!, "flash") / 1000],
    ];
    for (const [run, chirp, at] of pairs) {
      const r = birdieSound(run, RATE);
      const c = birdieSound(chirp, RATE);
      const both = mix(r, c, at);
      expect(peak(both), `${run} + ${chirp}`).toBeLessThan(MOVE_PEAK);
      expect(db(both), `${run} + ${chirp}`).toBeLessThan(MOVE_MEAN_DB - 2);
      // (Over the chirp's span, up where the chirp sings (a steep high-pass: the second difference), the chirp is 12 dB the louder: it reads,
      // high over the whistle's pipes (494 to 988 Hz, their overtones fading to 4 kHz). Old: the whole band, 0.5 dB, against the train's low puffs.)
      const i0 = Math.round(at * RATE);
      const under = r.subarray(i0, Math.min(r.length, i0 + c.length));
      // (Armored Birdie's chirp 320 ms in comes after a lone toot's end: nothing under it.)
      if (under.length < 0.02 * RATE) continue;
      expect(db(high(c)), `${run} + ${chirp}`).toBeGreaterThan(db(high(under)) + 12);
    }
  });

  it("his move's whistle: one square a toot, two to four the double toot, five or more the long blast; a capture or a check, toot-long; about one in five the peeps, the same on every device", () => {
    // (Each move at the first of his move numbers the peeps don't take.)
    const by = (uci: string) => {
      for (let k = 0; k < 20; k++) if (birdieWhistle(uci, false, k) !== "whistlePeepPeep") return birdieWhistle(uci, false, k);
    };
    expect(by("e7e6")).toBe("whistleToot");
    expect(by("e8f7")).toBe("whistleToot");
    expect(by("b2b1q")).toBe("whistleToot");
    expect(by("e7e5")).toBe("whistleTootToot");
    expect(by("g8f6")).toBe("whistleTootToot");
    expect(by("e8g8")).toBe("whistleTootToot");
    expect(by("d8h4")).toBe("whistleTootToot");
    expect(by("a8a3")).toBe("whistleLong");
    expect(by("h1a8")).toBe("whistleLong");
    expect(birdieWhistle(undefined, false)).toBe("whistleTootToot");
    expect(birdieWhistle("a8a3", true, 1)).toBe("whistleTootLong");
    expect(birdieWhistle("e7e6", true, 1)).toBe("whistleTootLong");
    // (The peeps: picked from the move and his move's number, about one move in five, never for a capture or a check.)
    let peeps = 0;
    let n = 0;
    for (const a of "abcdefgh") for (const b of "1234") for (const c of "abcdefgh") for (const d of "5678") for (let k = 0; k < 2; k++) {
      n++;
      const w = birdieWhistle(a + b + c + d, false, k);
      if (w === "whistlePeepPeep") peeps++;
      expect(birdieWhistle(a + b + c + d, false, k)).toBe(w);
      expect(birdieWhistle(a + b + c + d, true, k)).toBe("whistleTootLong");
    }
    expect(peeps / n).toBeGreaterThan(0.15);
    expect(peeps / n).toBeLessThan(0.25);
  });

  it("his cues from the battle: the whistle his move's, his chirps in turn by his move's number; each made ahead in his kit", () => {
    const at = (...history: string[]) => ({ board: { history } }) as Parameters<typeof birdieCue>[1];
    // (His move's whistle from his last move and his move's number: 1 after one move each, 2 after two.)
    expect(birdieCue("run", at("e2e4", "e7e6"))).toBe(own(birdieWhistle("e7e6", false, 1)));
    expect(birdieCue("run", at("e2e4", "a7a6", "d2d4", "a8a3"))).toBe(own(birdieWhistle("a8a3", false, 2)));
    const heard = new Set(Array.from({ length: 40 }, (_, k) => birdieCue("run", at(...Array.from({ length: 2 * k + 1 }, () => "e2e4"), "g8f6"))));
    expect([...heard].sort()).toEqual(["birdieWhistlePeepPeep", "birdieWhistleTootToot"]);
    expect(birdieCue("nod", at("e2e4", "e7e5"))).not.toBe(birdieCue("nod", at("e2e4", "e7e5", "g1f3", "b8c6")));
    expect(birdieCue("chatter", at("e2e4", "e7e5"))).toBeTruthy();
    expect(birdieCue("tootRun", at("e2e4", "e7e5"))).toBeUndefined();
    // (His chatter and his smug teeoo only on your turn: as your move lands and is judged, only the board's knock.)
    expect(birdieCue("chatter", at("e2e4", "e7e5"), false)).toBeNull();
    expect(birdieCue("coo", at("e2e4", "e7e5"), false)).toBeNull();
    expect(birdieCue("coo", at("e2e4", "e7e5"), true)).toBeUndefined();
    const sounds = new Set(Object.values(kit.sounds));
    for (let n = 0; n < 6; n++)
      for (const [cue, last] of [["run", "a1a2"], ["run", "a1a4"], ["run", "a1a8"], ["nod", "a1a2"], ["chatter", "a1a2"]] as const) {
        const h = [...Array.from({ length: 2 * n + 1 }, () => "e2e4"), last];
        expect(sounds.has(birdieCue(cue, at(...h))!), `${cue} ${n}`).toBe(true);
      }
  });

  it("every cue of his figure has a sound of his; every sound of his is used; the challenge is his hello", () => {
    for (const [name, a] of Object.entries(BIRDIE_FIGURE.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toBeTruthy();
    // (His spot empty while his train rides and while he falls: silent, the train's long run and the cutscene's whoosh already playing;
    // both whooshes at once doubled it.)
    const board = { board: { history: ["e2e4", "e7e5"] } } as Parameters<typeof birdieCue>[1];
    for (const cue of ["gone", "away"]) expect(birdieCue(cue, board), cue).toBeNull();
    // (His toot run: his challenge's wipe in his station, town/shops/challenge.ts.)
    const used = new Set<string>([...Object.values(kit.sounds), SELECT_SOUND.birdie!, "birdieBell", "birdieSmash", "birdieTrainToot"]);
    for (const n of BIRDIE_SOUNDS) expect(used.has(own(n)), n).toBe(true);
    expect(SELECT_SOUND.birdie).toBe("birdieHello");
    // (His moves: the whistle first, a chirp over its start; thinking stays silent: only the board's knock as your move lands.)
    expect(BIRDIE_FIGURE.anims.move!.frames[0]!.cue).toBe("run");
    expect(BIRDIE_FIGURE.anims.capture!.frames[0]!.cue).toBe("tootRun");
    expect(BIRDIE_FIGURE.anims.check!.frames[0]!.cue).toBe("tootRun");
    expect(BIRDIE_FIGURE.anims.p_move!.frames.map((f) => f.cue)).toEqual(["run", "nod"]);
    expect(BIRDIE_FIGURE.anims.thinking!.frames.some((f) => f.cue)).toBe(false);
  });
});
