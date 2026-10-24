import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { KING_ATTACK, kingAttackHits } from "@chessroyale/chess";
import { PIECES, TIGER, TIGER_ANIMS, TIGER_ATTACK, TIGER_HOP_AIR, TIGER_PORTRAIT, TIGER_STILL_BOX, balloon, tigerLayers, type TigerPose } from "../src/characters/tiger.ts";
import { SMUDGY } from "../src/characters/smudgy.ts";
import { frameKeys, renderFrame, type Anim } from "../src/characters/sprite.ts";

const length = (a: Anim) => a.frames.reduce((t, f) => t + f.ms, 0);
function cues(anim: Anim): [number, string][] {
  const out: [number, string][] = [];
  let t = 0;
  for (const f of anim.frames) {
    if (f.cue) out.push([t, f.cue]);
    t += f.ms;
  }
  return out;
}

/** The select stage draws every boss at one pixel size, up to this many sprite px from the top of its drawing to its feet (BossSelect's TALLEST / PX). */
const STAGE_TALLEST = 70;
/** The phone bar's `wide` box holds this many sprite px either side of a boss's feet (halo included). */
const WIDE_REACH = 29;

describe("the circus tiger's still", () => {
  const still = TIGER.anims.idle!.frames[0]!;
  const keys = frameKeys(TIGER, still);

  it("starts its idle on the still, in a palette that holds every color it uses", () => {
    expect(Object.keys(TIGER.anims)).toEqual([...TIGER_ANIMS]);
    expect(TIGER.anims.idle!.loop).toBe(true);
    for (const [name, part] of Object.entries(TIGER.parts))
      for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(TIGER.palette, `${name}: "${k}"`).toHaveProperty(k);
    expect(renderFrame(TIGER, still).data.length).toBe(TIGER.w * TIGER.h * 4);
  });

  it("fits the select stage's 70 px, with nothing cut off at the frame's edge, and stands on its ground point", () => {
    const top = keys.findIndex((r) => r.some(Boolean));
    expect(TIGER.foot[1] - top).toBeLessThanOrEqual(STAGE_TALLEST);
    const edge = [...keys[0]!, ...keys[TIGER.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[TIGER.w - 1])];
    expect(edge.filter(Boolean)).toEqual([]);
    const [fx, fy] = TIGER.foot;
    expect(keys[fy - 1]!.slice(fx - 12, fx + 12).some(Boolean)).toBe(true);
  });

  it("reaches no farther than the phone bar's wide box either side of his feet", () => {
    const cols = keys[0]!.map((_, x) => keys.some((r) => r[x]));
    expect(TIGER.foot[0] - cols.indexOf(true)).toBeLessThanOrEqual(WIDE_REACH);
    expect(cols.lastIndexOf(true) - TIGER.foot[0]).toBeLessThanOrEqual(WIDE_REACH);
  });

  it("has a portrait inside the frame", () => {
    const p = TIGER_PORTRAIT;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(TIGER.w);
    expect(p.y + p.h).toBeLessThanOrEqual(TIGER.h);
  });

  it("moves by numbers: the jaw, hat, tail, paw, balloons and feet redraw without error and stay in the frame", () => {
    const poses: TigerPose[] = [
      { jaw: 28, eyes: "wide", head: [-1, 1], earN: -1, earF: 1 },
      { bob: 1, hat: [1, -3], hatTilt: 10, tail: 3, stepHN: 2, stepHF: 2, stepFF: 1 },
      { paw: [14, 46], balloons: { queen: [0, -1], pawn: [0, 1] }, gone: ["rook"], eyes: "half" },
    ];
    for (const pose of poses) {
      const k = frameKeys(TIGER, { layers: tigerLayers(pose), ms: 100 });
      const edge = [...k[0]!, ...k[TIGER.h - 1]!, ...k.map((r) => r[0]), ...k.map((r) => r[TIGER.w - 1])];
      expect(edge.filter(Boolean)).toEqual([]);
    }
  });

  it("draws every balloon with equal rows and palette keys, and four of them hang in his bunch, each a part of its own", () => {
    for (const piece of PIECES) {
      const { grid } = balloon(piece, [0, 0]).part;
      expect(new Set(grid.map((r) => r.length)).size, piece).toBe(1);
      for (const row of grid) for (const k of row) if (k !== ".") expect(TIGER.palette, `${piece}: "${k}"`).toHaveProperty(k);
    }
    expect(tigerLayers().filter((l) => l.part.startsWith("balloon:")).length).toBe(4);
    expect(tigerLayers({ gone: ["queen"] }).some((l) => l.part === "balloon:queen")).toBe(false);
  });

  it("keeps his approved figure: everything but the balloons and their strings is the pixels Eric approved (d570e8f)", () => {
    // (His frame has headroom above the still's now: the still's 76 x 78 is `TIGER_STILL_BOX` in it, and nothing is drawn outside it.)
    const layers = tigerLayers().filter((l) => !l.part.startsWith("balloon:") && !l.part.startsWith("strings:"));
    const img = renderFrame(TIGER, { layers, ms: 1 });
    const b = TIGER_STILL_BOX;
    const h = createHash("sha256");
    let outside = 0;
    for (let y = 0; y < TIGER.h; y++)
      for (let x = 0; x < TIGER.w; x++) {
        const px = img.data.subarray((y * TIGER.w + x) * 4, (y * TIGER.w + x) * 4 + 4);
        if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) h.update(px);
        else outside += px[3]! ? 1 : 0;
      }
    expect(outside).toBe(0);
    expect(h.digest("hex")).toBe("6cf6e3fe0c31c7f7eca6f9e0d7e5754e56814591748c1b4d753acae59c3648ce");
    // And his idle starts on that still, the balloons where the bunch hangs.
    expect(TIGER.anims.idle!.frames[0]!.layers).toEqual(tigerLayers());
  });

  it("holds four balloons, no king, with a clear gap between them (no two outlines touch)", () => {
    const bunch = tigerLayers().filter((l) => l.part.startsWith("balloon:"));
    expect(bunch.map((l) => l.part.slice(8)).sort()).toEqual(["knight", "pawn", "queen", "rook"]);
    // Each balloon's pixels with their outline, as a set of frame cells: no cell is shared, and none is next to another balloon's.
    const cells = bunch.map((l) => {
      const set = new Set<string>();
      for (const [y, row] of frameKeys(TIGER, { layers: [l], ms: 1 }).entries()) row.forEach((c, x) => c && c !== "@" && set.add(`${x},${y}`));
      return set;
    });
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++)
        for (const c of cells[i]!) {
          const [x, y] = c.split(",").map(Number) as [number, number];
          for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) expect(cells[j]!.has(`${x + dx},${y + dy}`), `${bunch[i]!.part} / ${bunch[j]!.part}`).toBe(false);
        }
  });
});

describe("the circus tiger's animations", () => {
  it("has every animation the other bosses have, with their frame counts and lengths, looping where theirs do", () => {
    for (const name of ["idle", "entrance", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory"]) {
      const mine = TIGER.anims[name]!;
      const theirs = SMUDGY.anims[name]!;
      expect([mine.frames.length, length(mine), mine.loop], name).toEqual([theirs.frames.length, length(theirs), theirs.loop]);
    }
  });

  it("has his own moments, one-shots, the hoops about as long as Alfil's Slam, with the cues the wiring starts from", () => {
    const a = TIGER.anims;
    for (const name of ["hop", "place", "cheer", "bigCheer", "wince", "hoops"]) expect(a[name]!.loop, name).toBe(false);
    expect(Math.abs(length(a.hoops!) - 1360)).toBeLessThanOrEqual(60);
    expect(cues(a.hoops!).filter(([, c]) => c.startsWith("throw")).map(([, c]) => c)).toEqual(["throw1", "throw2", "throw3"]);
    expect(cues(a.place!).map(([, c]) => c)).toContain("touch");
    expect(cues(a.hop!).map(([, c]) => c)).toEqual(["spring", "thump"]);
    // The hop's airborne frame: off the ground, so it can be held while he is moved.
    const air = frameKeys(TIGER, a.hop!.frames[TIGER_HOP_AIR]!);
    expect(air[TIGER.foot[1] - 1]!.slice(TIGER.foot[0] - 12, TIGER.foot[0] + 12).some((c) => c && c !== "z" && c !== "@")).toBe(false);
    // A hoop is in his paw before each throw and gone on the throw's frame.
    const hoopIn = (i: number) => a.hoops!.frames[i]!.layers.some((l) => l.part.startsWith("hoop:"));
    a.hoops!.frames.forEach((f, i) => {
      if (f.cue?.startsWith("throw")) expect([hoopIn(i - 1), hoopIn(i)], f.cue).toEqual([true, false]);
    });
  });

  it("draws every frame of every animation inside its frame, in its palette's colors", () => {
    for (const ch of [TIGER, TIGER_ATTACK])
      for (const [name, a] of Object.entries(ch.anims))
        a.frames.forEach((f, i) => {
          const k = frameKeys(ch, f);
          const edge = [...k[0]!, ...k[ch.h - 1]!, ...k.map((r) => r[0]), ...k.map((r) => r[ch.w - 1])];
          expect(edge.filter(Boolean), `${ch.id} ${name} ${i + 1}`).toEqual([]);
          for (const c of new Set(k.flat())) if (c) expect(ch.palette[c] ?? (c === "@" ? "halo" : undefined), `${ch.id} ${name}: "${c}"`).toBeDefined();
        });
  });

  it("attacks a king on the shared beats: ten balloons bonk on the hits' own times and pop, the last frame empty", () => {
    const attack = TIGER_ATTACK.anims.kingAttack!;
    expect(length(attack)).toBe(KING_ATTACK.ms);
    expect(cues(attack).filter(([, c]) => c === "bonk").map(([t]) => t)).toEqual(kingAttackHits());
    expect(cues(attack).filter(([, c]) => c === "pop").length).toBe(KING_ATTACK.lashes);
    expect(attack.frames[attack.frames.length - 1]!.layers).toEqual([]);
    expect(cues(attack).find(([, c]) => c === "land")![0]).toBe(KING_ATTACK.landAt - 110);
  });
});
