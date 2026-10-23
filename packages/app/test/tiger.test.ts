import { describe, expect, it } from "vitest";
import { PIECES, TIGER, TIGER_PORTRAIT, balloon, tigerLayers, type TigerPose } from "../src/characters/tiger.ts";
import { frameKeys, renderFrame } from "../src/characters/sprite.ts";

/** The select stage draws every boss at one pixel size, up to this many sprite px from the top of its drawing to its feet (BossSelect's TALLEST / PX). */
const STAGE_TALLEST = 70;
/** The phone bar's `wide` box holds this many sprite px either side of a boss's feet (halo included). */
const WIDE_REACH = 29;

describe("the circus tiger's still", () => {
  const still = TIGER.anims.idle!.frames[0]!;
  const keys = frameKeys(TIGER, still);

  it("starts its idle on one still, in a palette that holds every color it uses", () => {
    expect(Object.keys(TIGER.anims)).toEqual(["idle"]);
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
      { paw: [14, 46], balloons: { king: [0, -1], pawn: [0, 1] }, gone: ["bishop"], eyes: "half" },
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
    expect(tigerLayers({ gone: ["king"] }).some((l) => l.part === "balloon:king")).toBe(false);
  });
});
