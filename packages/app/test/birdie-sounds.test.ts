import { describe, expect, it } from "vitest";
import { BIRDIE_BEATS } from "@chessroyale/chess";
import { BIRDIE_SOUND_EVERY } from "@chessroyale/core";
import { BIRDIE_FIGURE } from "../src/characters/birdie-figure.ts";
import { BIRDIE_SOUNDS, RIDE_PACE, birdieSound, birdieWhistle, type BirdieSound } from "../src/characters/birdie-sounds.ts";
import { BOSS_KITS, birdieCue, birdieHeard } from "../src/characters/kits.ts";
import { SELECT_SOUND } from "../src/characters/boss-select.ts";
import { cueAt } from "../src/characters/power-art.ts";
import { MOVE_MEAN_DB, MOVE_PEAK, soundCache } from "../src/characters/synth.ts";

/**
 * Birdie's voice and his train (Eric, Nov 23; docs/decisions/2026-11-23-birdie-sounds.md, 2026-11-23-birdie-whistles.md): seven chirps,
 * three train runs and five whistles built in code from the music helper's recipes (`stills/trailer-v2`: birdie-chirps/, birdie-train/),
 * each under a piece's move, a chirp over a move's whistle still under it and reading over it; his move's whistle picked by how far his
 * piece goes, a capture or a check, and now and then the peeps; his ordinary move heard only every 3 or 4 of his moves (Nov 23,
 * BIRDIE_SOUND_EVERY), a capture or a check every time; his ride's run as long as his (slower) ride.
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
  it("are the recipes' lengths (the music helper's files: hello 0.91 s ... the toot-long whistle 1.05 s; the long run paced to his ride, 2.52 s)", () => {
    // (The long run: the recipe's 1.78 s, its puffs RIDE_PACE further apart since his ride is 1.5x as long (Nov 23): 2.52 s.)
    const LEN: Partial<Record<BirdieSound, number>> = {
      ...{ hello: 0.91, tsip: 0.41, teeoo: 0.39, trill: 0.42, cheer: 0.19, ask: 0.33, scold: 0.45, trainMedium: 0.9, trainLong: 2.52, trainToot: 0.9 },
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
        // (The long run's loudness as its puffs are: the same puffs RIDE_PACE further apart measure 10 log10(RIDE_PACE) dB lower as a mean.)
        const spread = name === "trainLong" ? 10 * Math.log10(RIDE_PACE) : 0;
        if (/^(hello|tsip|teeoo|trill|cheer|ask|scold|train)/.test(name)) expect(db(s) + spread, name).toBeGreaterThan(MOVE_MEAN_DB - 9);
        if (/^whistle[A-Z]/.test(name)) expect(db(s), name).toBeGreaterThan(MOVE_MEAN_DB - 11);
        // (Old: every one under 1.9 s. His ride's run lasts his ride, 2.52 s since Nov 23; the rest still under 1.9.)
        expect(s.length / rate, name).toBeLessThan(name === "trainLong" ? 2.6 : 1.9);
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
    // (After `n` moves each: his move's number n.)
    const after = (n: number, last = "g8f6") => at(...Array.from({ length: 2 * n - 1 }, () => "e2e4"), last);
    // (His move's whistle from his last move and his move's number: 1 after one move each, 4 after four; both heard moves.)
    expect(birdieCue("run", at("e2e4", "e7e6"))).toBe(own(birdieWhistle("e7e6", false, 1)));
    expect(birdieCue("run", after(4, "a8a3"))).toBe(own(birdieWhistle("a8a3", false, 4)));
    // (Old: his 2nd move's whistle too; Nov 23: his 2nd and 3rd are silent, BIRDIE_SOUND_EVERY.)
    expect(birdieCue("run", at("e2e4", "a7a6", "d2d4", "a8a3"))).toBeNull();
    const heard = new Set(Array.from({ length: 40 }, (_, k) => birdieCue("run", after(k + 1))).filter((x) => x !== null));
    expect([...heard].sort()).toEqual(["birdieWhistlePeepPeep", "birdieWhistleTootToot"]);
    // (Old: his 1st and 2nd nods' chirps; now his 1st and 4th, the next heard.)
    expect(birdieCue("nod", after(1, "e7e5"))).not.toBe(birdieCue("nod", after(4, "b8c6")));
    expect(birdieCue("chatter", at("e2e4", "e7e5"))).toBeTruthy();
    expect(birdieCue("tootRun", at("e2e4", "e7e5"))).toBeUndefined();
    // (His chatter and his smug teeoo only on your turn: as your move lands and is judged, only the board's knock.)
    expect(birdieCue("chatter", at("e2e4", "e7e5"), false)).toBeNull();
    expect(birdieCue("coo", at("e2e4", "e7e5"), false)).toBeNull();
    expect(birdieCue("coo", at("e2e4", "e7e5"), true)).toBeUndefined();
    // (Each sound a heard move can play is made ahead with the rest of his kit. Old: his moves 1 to 6, each heard; now the silent ones
    // are null, and of 1 to 6 his 1st and 4th are heard.)
    const sounds = new Set(Object.values(kit.sounds));
    for (let n = 1; n <= 6; n++)
      for (const [cue, last] of [["run", "a1a2"], ["run", "a1a4"], ["run", "a1a8"], ["nod", "a1a2"], ["chatter", "a1a2"]] as const) {
        const got = birdieCue(cue, after(n, last));
        expect(got === null ? null : sounds.has(got), `${cue} ${n}`).toBe(n === 1 || n === 4 ? true : null);
      }
  });

  it("his ordinary move heard only every 3 or 4 of his moves (Eric, Nov 23), the same on every device; a capture or a check every time", () => {
    expect(BIRDIE_SOUND_EVERY).toEqual([3, 4]);
    const at = (...history: string[]) => ({ board: { history } }) as Parameters<typeof birdieCue>[1];
    // (His move's number n: n moves each, his last a quiet one of two squares. With him White, his move's number is one less than his
    // count (his first is 0): his 2nd move is heard first, then the same gaps.)
    const after = (n: number) => at(...Array.from({ length: 2 * n - 1 }, () => "e2e4"), "g8f6");
    const heardAt = Array.from({ length: 30 }, (_, k) => k + 1).filter((n) => birdieHeard(n));
    // His 1st, then 3, 4, 3, 4 ... of his moves apart.
    expect(heardAt.slice(0, 7)).toEqual([1, 4, 8, 11, 15, 18, 22]);
    const gaps = heardAt.slice(1).map((n, i) => n - heardAt[i]!);
    expect(gaps.every((g, i) => g === (i % 2 ? 4 : 3)), `gaps ${gaps}`).toBe(true);
    // (A battle from the game so far: whatever his move's number, never more than 4 of his moves without a heard one.)
    for (let n = 0; n < 60; n++) expect([0, 1, 2, 3].some((d) => birdieHeard(n + d)), `from ${n}`).toBe(true);
    for (let n = 1; n <= 30; n++) {
      const heard = birdieHeard(n);
      // The whistle and the chirp over it on a heard move; on the others, nothing (only the board's own move sound).
      expect(birdieCue("run", after(n)) !== null, `run ${n}`).toBe(heard);
      expect(birdieCue("nod", after(n)) !== null, `nod ${n}`).toBe(heard);
      // His chirps at rest on your turn only after a heard move of his; never as your move lands.
      expect(birdieCue("chatter", after(n), true) !== null, `chatter ${n}`).toBe(heard);
      expect(birdieCue("coo", after(n), true) !== null, `coo ${n}`).toBe(heard);
      expect(birdieCue("chatter", after(n), false)).toBeNull();
      // A capture or a check: his kit's toot-long and chirp, on every move of his.
      for (const cue of ["tootRun", "trill", "flash"]) expect(birdieCue(cue, after(n)), `${cue} ${n}`).toBeUndefined();
      // (The same answer every time: from his move's number, never a random draw.)
      expect(birdieCue("run", after(n))).toBe(birdieCue("run", after(n)));
    }
    expect(kit.sounds.tootRun).toBe("birdieWhistleTootLong");
    expect(kit.sounds.trill).toBe("birdieTrill");
    expect(kit.sounds.flash).toBe("birdieTeeoo");
  });

  it("his ride's run lasts his (slower) ride: from its pull as he departs to the train's tail past the board, its steam as it leaves", () => {
    // (Nov 23: the ride 1.5x as long, BOSS_POWERS.birdie.trainRideMs; the run paced to it, RIDE_PACE. Either changed alone, this fails.)
    expect(kit.sounds.pull).toBe("birdieTrainLong");
    const pull = cueAt(BIRDIE_FIGURE.anims.depart!, "pull");
    const leaves = BIRDIE_BEATS.ride.rideAt + BIRDIE_BEATS.ride.rideMs;
    const run = (birdieSound("trainLong", RATE).length / RATE) * 1000;
    expect(Math.abs(pull + run - leaves), `the run ends ${Math.round(pull + run - leaves)} ms from the train's leaving`).toBeLessThan(120);
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
