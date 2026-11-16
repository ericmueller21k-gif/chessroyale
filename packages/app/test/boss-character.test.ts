import { describe, expect, it } from "vitest";
import { fenAfter } from "@chessroyale/chess";
import { bossBeat, hash, material, mood, pickLine, type Beat, type BeatState } from "../src/characters/boss-beats.ts";
import { CLOWN_SOUNDS, MOVE_MEAN_DB, MOVE_PEAK, clownSound } from "../src/characters/clown-sounds.ts";
import { BOSS_KITS, bossKit } from "../src/characters/kits.ts";
import { showing } from "../src/components/BossCharacter.tsx";
import { bossInfo } from "@chessroyale/core";

const kit = bossKit("Boingo the Clown")!;
const state = (moves: string[], over: Partial<BeatState> = {}): BeatState => ({
  stage: "crowd",
  fen: fenAfter(moves),
  history: moves,
  crowdSide: "w",
  lastMove: null,
  ...over,
});

describe("Boingo the Clown: the raid boss at 1500", () => {
  it("takes the 1500 tier, with a character", () => {
    expect(bossInfo(1600).name).toBe("Boingo the Clown");
    expect(kit).not.toBeNull();
  });
});

describe("what the boss does, from the shared match state", () => {
  it("enters at the intro", () => {
    expect(bossBeat(kit, state(["e2e4", "e7e5"], { stage: "intro" }))).toMatchObject({ anim: "entrance", loop: "idle", key: "intro:2" });
  });

  it("thinks after the crowd's move, and is hurt first if the crowd took a piece", () => {
    expect(bossBeat(kit, state(["e2e4", "d7d5", "b1c3"], { stage: "thinking" }))).toMatchObject({ anim: "thinking", loop: "thinking" });
    // White (the crowd) takes the pawn on d5.
    expect(bossBeat(kit, state(["e2e4", "d7d5", "e4d5"], { stage: "thinking" }))).toMatchObject({ anim: "hurt", loop: "thinking", key: "hurt:3" });
    // The boss playing White: the crowd (Black) takes back.
    expect(bossBeat(kit, state(["e2e4", "d7d5", "e4d5", "d8d5"], { stage: "thinking", crowdSide: "b" }))).toMatchObject({ anim: "hurt" });
  });

  it("on its own move: check over a capture over a plain move", () => {
    // Fool's mate: Black (the boss) gives check, having taken nothing.
    const mate = ["f2f3", "e7e5", "g2g4", "d8h4"];
    expect(bossBeat(kit, state(mate, { stage: "bossMove", lastMove: {} })).anim).toBe("check");
    expect(bossBeat(kit, state(["e2e4", "d7d5", "e4d5", "d8d5"], { stage: "bossMove", lastMove: { captured: "p" } })).anim).toBe("capture");
    expect(bossBeat(kit, state(["e2e4", "e7e5"], { stage: "bossMove", lastMove: {} })).anim).toBe("move");
  });

  it("laughs when it strikes a player down", () => {
    const b = bossBeat(kit, state(["e2e4", "e7e5"], { stage: "strike", victim: "p3" }));
    expect(b.anim).toBe("strike");
    expect(kit.ch.anims[kit.anims.strike ?? "strike"]).toBeTruthy();
  });

  it("is smug 3 pawns ahead, rattled 3 behind, else idle (from the material, the same on every device)", () => {
    const start = fenAfter([]);
    expect(material(start, "w")).toBe(39);
    expect(mood(start, "w")).toBe("idle");
    // White without its queen: the boss (Black) is 9 ahead.
    const noQueen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1";
    expect(mood(noQueen, "w")).toBe("smug");
    expect(mood(noQueen, "b")).toBe("rattled");
    expect(bossBeat(kit, { ...state([]), fen: noQueen }).anim).toBe("smug");
  });

  it("bows out at the end: defeat when the crowd wins, victory when it does", () => {
    expect(bossBeat(kit, state(["e2e4"], { stage: "over", result: "crowd" }))).toMatchObject({ anim: "defeat", loop: "defeat" });
    expect(bossBeat(kit, state(["e2e4"], { stage: "over", result: "boss" }))).toMatchObject({ anim: "victory", loop: "victory" });
    expect(bossBeat(kit, state(["e2e4"], { stage: "bossMove", result: "boss", lastMove: {} })).anim).toBe("victory");
  });

  it("is the same on every device: the same state gives the same moment and line", () => {
    const s = state(["e2e4", "d7d5", "e4d5", "d8d5"], { stage: "bossMove", lastMove: { captured: "p" } });
    expect(bossBeat(kit, s)).toEqual(bossBeat(kit, { ...s, history: [...s.history] }));
    expect(bossBeat(kit, s).key).not.toBe(bossBeat(kit, state(["e2e4", "d7d5"], { stage: "bossMove", lastMove: {} })).key);
  });
});

describe("his lines", () => {
  it("are picked by the moment, as often as each moment's chance says", () => {
    const cfg = { lines: { move: ["a", "b", "c"] }, chance: { move: 0.25 } };
    let said = 0;
    const picked = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const l = pickLine(cfg, "move", `move:${i}`);
      if (l) {
        said++;
        picked.add(l);
      }
      expect(pickLine(cfg, "move", `move:${i}`)).toBe(l);
    }
    expect(said / 4000).toBeGreaterThan(0.21);
    expect(said / 4000).toBeLessThan(0.29);
    expect(picked).toEqual(new Set(["a", "b", "c"]));
    expect(pickLine({ ...cfg, chance: { move: 0 } }, "move", "x")).toBeNull();
    expect(pickLine({ ...cfg, chance: { move: 1 } }, "move", "x")).not.toBeNull();
    expect(hash("abc")).toBe(hash("abc"));
  });

  it("are short taunts, never instructions, for every moment he reacts to", () => {
    const moments: Beat[] = ["entrance", "move", "capture", "check", "hurt", "thinking", "smug", "rattled", "defeat", "victory", "strike"];
    for (const m of moments) {
      expect(kit.lines[m]?.length, m).toBeGreaterThan(0);
      for (const l of kit.lines[m]!) {
        expect(l.length, l).toBeLessThanOrEqual(28);
        expect(l, l).not.toMatch(/\b(tap|press|click|pick|play|move your|select)\b/i);
      }
    }
  });

  it("are rare: about one moment in four on his moves", () => {
    const moments: Beat[] = ["move", "thinking"];
    for (const m of moments) expect(kit.chance[m]!).toBeLessThanOrEqual(0.15);
  });
});

describe("his animations and sounds", () => {
  it("has an animation for every moment, and a sound for every cue", () => {
    for (const k of Object.values(BOSS_KITS)) {
      const beats: Beat[] = ["entrance", "idle", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "strike"];
      for (const b of beats) expect(k.ch.anims[k.anims[b] ?? b], b).toBeTruthy();
      for (const a of Object.values(k.ch.anims)) for (const f of a.frames) if (f.cue) expect(k.sounds[f.cue], f.cue).toBeTruthy();
    }
  });

  it("plays a moment's animation once from its start, then its loop by the clock; defeat holds its last frame", () => {
    const beat = { anim: "capture" as Beat, loop: "idle" as const, key: "capture:9" };
    const since = 1_000_000;
    expect(showing(kit, beat, since, since)).toMatchObject({ anim: "capture", frame: 0 });
    expect(showing(kit, beat, since + 10_000, since).anim).toBe("idle");
    const defeat = { anim: "defeat" as Beat, loop: "defeat" as const, key: "over:crowd" };
    const n = kit.ch.anims.defeat!.frames.length;
    expect(showing(kit, defeat, since + 60_000, since)).toMatchObject({ anim: "defeat", frame: n - 1 });
    // Two devices a moment apart in the loop are on the same frame at the same clock time.
    const idle = { anim: "idle" as Beat, loop: "idle" as const, key: "mood:idle:4" };
    expect(showing(kit, idle, 5_000_123, 0)).toEqual(showing(kit, idle, 5_000_123, 4_000_000));
  });

  it("never sounds louder than a piece's move", () => {
    for (const name of CLOWN_SOUNDS) {
      const s = clownSound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
    }
  });
});
