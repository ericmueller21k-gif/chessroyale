import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, isPlayable } from "@chessroyale/core";
import { BOUNCE, SNACK, START_FEN, applyMove, bounceCandidates, bounceResult, pieceAt, withoutPiece } from "@chessroyale/chess";
import { BIGBOY, bounceShape } from "../src/characters/bigboy.ts";
import { BIGBOY_SOUNDS, bigBoySound } from "../src/characters/bigboy-sounds.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { EFFECTS, POWER_MOMENTS, animLength, blockItem, blockLetter, cueAt } from "../src/characters/power-art.ts";
import { MOVE_MEAN_DB, MOVE_PEAK } from "../src/characters/synth.ts";
import { frameKeys } from "../src/characters/sprite.ts";
import { bounceFen, bounceFlyers, spotSquares } from "../src/components/BigBoy.tsx";

const RAINBOW = ["1", "2", "3", "4", "5", "6"];
const top = (keys: (string | null)[][]) => keys.findIndex((r) => r.some(Boolean));
const kit = BOSS_KITS["Big Boy"]!;

describe("Big Boy, the baby boss", () => {
  it("is the roster's bigboy (🍭), playable, his kit under his name", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "bigboy")!;
    expect(def.kit).toBe("Big Boy");
    expect(isPlayable(def)).toBe(true);
    expect(kit.ch).toBe(BIGBOY);
  });

  it("never rises above his wave in the boss bar (his moments there), so on a phone he stays under its heading", () => {
    const highest = Math.min(...BIGBOY.anims.idle!.frames.map((f) => top(frameKeys(BIGBOY, f))));
    // (His powers' moments play on the board: the snack, the toss from its corner, the bounce.)
    const bar = new Set(Object.values(kit.anims).filter((a) => !["snack", "toss", "bigBounce"].includes(a!)));
    for (const name of bar) {
      BIGBOY.anims[name!]!.frames.forEach((f, i) => expect(top(frameKeys(BIGBOY, f)), `${name} frame ${i + 1}`).toBeGreaterThanOrEqual(highest));
    }
  });

  it("keeps the approved idle, swing and tantrum: the wail is the tantrum with its sound", () => {
    expect(BIGBOY.anims.idle!.frames).toHaveLength(40);
    expect(BIGBOY.anims.swing!.frames).toHaveLength(10);
    expect(BIGBOY.anims.wail!.frames.map((f) => f.layers)).toEqual(BIGBOY.anims.tantrum!.frames.map((f) => f.layers));
    expect(BIGBOY.anims.wail!.frames.filter((f) => f.cue === "wail")).toHaveLength(1);
  });

  it("shows every colour of the lollipop's swirl at rest, enough of each to read at phone size", () => {
    const keys = frameKeys(BIGBOY, BIGBOY.anims.idle!.frames[0]!).flat();
    for (const k of RAINBOW) expect(keys.filter((c) => c === k).length, k).toBeGreaterThanOrEqual(20);
  });

  it("has a portrait inside his frame that shows his lips and the whole candy", () => {
    const p = kit.portrait;
    expect(p.x + p.w).toBeLessThanOrEqual(BIGBOY.w);
    expect(p.y + p.h).toBeLessThanOrEqual(BIGBOY.h);
    const keys = frameKeys(BIGBOY, BIGBOY.anims[p.anim]!.frames[p.frame]!);
    const inside = keys.slice(p.y, p.y + p.h).flatMap((r) => r.slice(p.x, p.x + p.w));
    expect(inside).toContain("L");
    const all = (k: string) => keys.flat().filter((c) => c === k).length;
    for (const k of RAINBOW) expect(inside.filter((c) => c === k).length, k).toBe(all(k));
  });
});

describe("his snack", () => {
  const snack = BIGBOY.anims.snack!;
  it("lasts the snack's beats: he waddles over by grabAt, the pawn in his hand after, two noms from nomAt", () => {
    expect(animLength(snack)).toBeCloseTo(SNACK.ms, 0);
    expect(cueAt(snack, "nom")).toBe(SNACK.nomAt);
    expect(snack.frames.filter((f) => f.cue === "nom")).toHaveLength(2);
    // The pawn shows in his hand from the grab until he's eaten it, and never before.
    let t = 0;
    const pawnAt: number[] = [];
    for (const f of snack.frames) {
      if (frameKeys(BIGBOY, f).flat().includes("x")) pawnAt.push(t);
      t += f.ms;
    }
    expect(Math.min(...pawnAt)).toBeGreaterThanOrEqual(SNACK.grabAt);
    expect(Math.max(...pawnAt)).toBeLessThan(SNACK.ms - 500);
  });

  it("eats the crowd's black pawn when it plays Black (his look)", () => {
    expect(BIGBOY.looks!.blackPawn!.x).not.toBe(BIGBOY.palette.x);
    expect(kit.lookOf!({ crowdSide: "b" } as never)).toBe("blackPawn");
    expect(kit.lookOf!({ crowdSide: "w" } as never)).toBeUndefined();
  });
});

describe("his Big Bounce", () => {
  const a = BIGBOY.anims.bigBounce!;
  it("plays from the leap to the end of the moment, a boing on each landing, the crash on the crash, a giggle as they settle", () => {
    expect(animLength(a)).toBe(BOUNCE.total - BOUNCE.leapAt);
    let t = 0;
    const cues: [string, number][] = [];
    for (const f of a.frames) {
      if (f.cue) cues.push([f.cue, t + BOUNCE.leapAt]);
      t += f.ms;
    }
    expect(cues.filter(([c]) => c === "boing").map(([, at]) => at).slice(0, 3)).toEqual([...BOUNCE.lands]);
    expect(cues.find(([c]) => c === "crash")![1]).toBe(BOUNCE.crashAt);
    const giggle = cues.find(([c]) => c === "giggle")![1];
    expect(giggle).toBeGreaterThan(BOUNCE.crashAt);
    expect(giggle).toBeLessThan(BOUNCE.backAt);
    expect(POWER_MOMENTS["Big Boy"]!.ultimate).toMatchObject({ anim: "bigBounce", hit: "crash", onBoard: true });
  });

  it("squashes as he lands and at the crash, stretches as he springs", () => {
    const L = BOUNCE.leapAt;
    for (const land of BOUNCE.lands) {
      expect(bounceShape(land - L + 50)).toBe("squash");
      expect(bounceShape(land - L - 50)).toBe("stretch");
    }
    expect(bounceShape(BOUNCE.crashAt - L + 50)).toBe("crash");
    expect(bounceShape(BOUNCE.settledAt - L)).toBeNull();
  });

  it("knocks up every piece on his spots and the middle; the moved ones land on their new squares before the board settles", () => {
    let fen = withoutPiece(START_FEN, "e2");
    for (const m of ["g1f3", "d7d5", "b1c3", "g8f6", "d2d4", "c8f5"]) fen = applyMove(fen, m);
    for (let seed = 0; seed < 20; seed++) {
      const c = bounceCandidates(fen, "w", seed, 4)[0]!;
      const b = bounceResult(fen, "w", seed, 4, c, 1);
      const after = c.fen;
      const flyers = bounceFlyers(b);
      for (const m of b.moves) {
        const f = flyers.find((x) => x.from === m.from)!;
        expect(f.hop).toBe(false);
        expect(f.to).toBe(m.to);
        expect(f.up).toBeLessThan(BOUNCE.settleAt);
        expect(f.land).toBeLessThanOrEqual(BOUNCE.settledAt);
      }
      // Everything under a spot goes up as he lands there.
      b.spots.forEach((sp, k) =>
        spotSquares(sp).forEach((sq) => pieceAt(fen, sq) && expect(flyers.find((x) => x.from === sq)!.up).toBeLessThanOrEqual(BOUNCE.lands[k]!)),
      );
      // The board: the position before; less what's in the air; then the new one.
      const m = { kind: "bounce" as const, at: 1000 };
      expect(bounceFen(b, m, 1000, after)).toBe(fen);
      expect(bounceFen(b, m, 1000 + BOUNCE.settledAt, after)).toBe(after);
      const mid = bounceFen(b, m, 1000 + BOUNCE.crashAt + 10, after)!;
      for (const f of flyers) if (!f.hop) expect(pieceAt(mid, f.from)).toBeNull();
      // Just before it settles, every moved piece is on its new square already, and nothing stands on another.
      const late = bounceFen(b, m, 1000 + BOUNCE.settledAt - 1, after)!;
      expect(late.split(" ")[0]).toBe(after.split(" ")[0]);
    }
  });
});

describe("his toy block", () => {
  it("is an ABC block: A, B or C by its square, landing (a clack), sitting, puffing away (ends empty)", () => {
    expect(new Set(["a1", "b1", "c1", "a2", "b2", "c2"].map(blockLetter))).toEqual(new Set(["A", "B", "C"]));
    const fx = EFFECTS.toyBlock;
    for (const l of ["A", "B", "C"]) {
      expect(fx.ch.anims[`land${l}`]!.frames.some((f) => f.cue === "clack")).toBe(true);
      expect(fx.ch.anims[`sit${l}`]!.loop).toBe(true);
      expect(fx.ch.anims[`poof${l}`]!.frames.at(-1)!.layers).toEqual([]);
      expect(EFFECTS.blockFly.ch.anims[`fly${l}`]!.loop).toBe(true);
    }
    expect(fx.sounds).toEqual({ clack: "bigboyClack", poof: "bigboyPoof" });
    expect(blockItem("c3", "land", 5)).toEqual({ square: "c3", name: "toyBlock", anim: `land${blockLetter("c3")}`, then: `sit${blockLetter("c3")}`, since: 5 });
    expect(POWER_MOMENTS["Big Boy"]!.power).toMatchObject({ anim: "toss", hit: "toss" });
    expect(cueAt(BIGBOY.anims.toss!, "toss")).not.toBeNull();
  });

  it("fills the middle of its square, a little shadow under it", () => {
    const keys = frameKeys(EFFECTS.toyBlock.ch, EFFECTS.toyBlock.ch.anims.sitA!.frames[0]!);
    expect(keys[18]![14]).toBeTruthy();
    expect(keys.flat().filter(Boolean).length).toBeGreaterThan(32 * 32 * 0.4);
  });
});

describe("his sounds", () => {
  it("are all his own (no borrowed ones), one for every cue", () => {
    for (const [cue, sound] of Object.entries(kit.sounds)) expect(sound, cue).toMatch(/^bigboy/);
    for (const [name, an] of Object.entries(BIGBOY.anims)) for (const f of an.frames) if (f.cue) expect(kit.sounds[f.cue], `${name}: ${f.cue}`).toBeTruthy();
  });

  it("sound no louder than a piece's move, and the same every time", () => {
    for (const name of BIGBOY_SOUNDS) {
      const s = bigBoySound(name, 44100);
      let peak = 0;
      let sum = 0;
      for (const v of s) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      expect(peak, name).toBeLessThan(MOVE_PEAK / 2);
      expect(10 * Math.log10(sum / s.length), name).toBeLessThan(MOVE_MEAN_DB - 2);
      expect(s, `${name} is the same every time`).toEqual(bigBoySound(name, 44100));
    }
  });

  it("have no chimes or bright dings: baby noises and toys, their energy low and soft", () => {
    for (const name of BIGBOY_SOUNDS) {
      const s = bigBoySound(name, 44100);
      let e = 0;
      let d = 0;
      for (let i = 1; i < s.length; i++) {
        e += s[i]! ** 2;
        d += (s[i]! - s[i - 1]!) ** 2;
      }
      expect((Math.sqrt(d / e) * 44100) / (2 * Math.PI), name).toBeLessThan(2500);
    }
  });
});
