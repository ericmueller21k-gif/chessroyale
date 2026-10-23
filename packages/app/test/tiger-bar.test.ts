import { describe, expect, it } from "vitest";
import { frameKeys, renderFrame, type Character } from "../src/characters/sprite.ts";
import { BALLOON_COLOR_NAMES, BALLOON_PIECES, BALLOON_SHAPES, PUMP_H, PUMP_REST_H, TIGER_PUMP, pumpAnim } from "../src/characters/tiger-bar.ts";
import { BALLOON_FLY, BALLOON_LAND } from "../src/characters/effects/tiger.ts";

/** The rows (from the top) a frame draws in. */
const rows = (ch: Character, anim: string, i = 0) => {
  const k = frameKeys(ch, ch.anims[anim]!.frames[i]!);
  const used = k.map((r) => r.some(Boolean));
  return { top: used.indexOf(true), k };
};
/** What a frame draws on its edges (the pump stands on its bottom edge, its ground: `ground` leaves that out). */
const edge = (ch: Character, k: (string | null)[][], ground = false) => [...k[0]!, ...(ground ? [] : k[ch.h - 1]!), ...k.map((r) => r[0]), ...k.map((r) => r[ch.w - 1])].filter(Boolean);

describe("the circus tiger's pump and balloons", () => {
  it("draws every frame in every color, from palette keys only, with nothing cut off at the frame's edge (the pump stands on its bottom)", () => {
    for (const ch of [TIGER_PUMP, BALLOON_FLY, BALLOON_LAND]) {
      for (const [name, part] of Object.entries(ch.parts))
        for (const row of part.grid) for (const k of row) if (k !== ".") expect(ch.palette, `${ch.id} ${name}: "${k}"`).toHaveProperty(k);
      for (const [name, a] of Object.entries(ch.anims))
        a.frames.forEach((f, i) => expect(edge(ch, frameKeys(ch, f), ch === TIGER_PUMP), `${ch.id} ${name} ${i}`).toEqual([]));
      for (const look of BALLOON_COLOR_NAMES) expect(renderFrame(ch, Object.values(ch.anims)[0]!.frames[0]!, { look }).data.length).toBe(ch.w * ch.h * 4);
    }
  });

  it("keeps the pump and a finished balloon inside 30 px, the over-swell inside 34", () => {
    for (const p of BALLOON_PIECES) {
      expect(rows(TIGER_PUMP, pumpAnim("stage", p, 4)).top, p).toBeGreaterThanOrEqual(PUMP_H - PUMP_REST_H);
      const pop = TIGER_PUMP.anims[pumpAnim("pop", p, 4)]!;
      for (let i = 0; i < pop.frames.length; i++) expect(rows(TIGER_PUMP, pumpAnim("pop", p, 4), i).top, `${p} pop ${i}`).toBeGreaterThanOrEqual(PUMP_H - PUMP_REST_H - 4);
    }
  });

  it("grows a balloon stage by stage, each bigger than the last, and every step, pop and release has its cue and its end", () => {
    for (const p of BALLOON_PIECES) {
      const area = BALLOON_SHAPES[p].map((s) => s.sil.join("").split("#").length);
      expect(area[1]! > area[0]! && area[2]! > area[1]! && area[3]! > area[2]!, p).toBe(true);
      for (const s of [2, 3, 4] as const) {
        expect(TIGER_PUMP.anims[pumpAnim("grow", p, s)]!.frames.map((f) => f.cue).filter(Boolean)).toEqual(["pump", "squeak"]);
        const grow = TIGER_PUMP.anims[pumpAnim("grow", p, s)]!.frames;
        expect(grow[grow.length - 1]!.layers).toEqual(TIGER_PUMP.anims[pumpAnim("stage", p, s)]!.frames[0]!.layers);
        const pop = TIGER_PUMP.anims[pumpAnim("pop", p, s)]!.frames;
        expect(pop.some((f) => f.cue === "pop")).toBe(true);
        expect(pop[pop.length - 1]!.layers).toEqual(TIGER_PUMP.anims.bare!.frames[0]!.layers);
        const ms = pop.slice(0, -1).reduce((t, f) => t + f.ms, 0);
        expect(ms).toBeGreaterThanOrEqual(350);
        expect(ms).toBeLessThanOrEqual(450);
      }
      const rel = TIGER_PUMP.anims[pumpAnim("release", p)]!.frames;
      expect(rel[0]!.cue).toBe("whoosh");
      expect(rel[rel.length - 1]!.layers).toEqual(TIGER_PUMP.anims.bare!.frames[0]!.layers);
    }
  });

  it("lands a balloon with a thump and hides the swap under its puff, ending empty", () => {
    for (const p of BALLOON_PIECES) {
      const f = BALLOON_LAND.anims[`land${p[0]!.toUpperCase()}${p.slice(1)}`]!.frames;
      const poof = f.findIndex((x) => x.cue === "poof");
      expect(f.some((x) => x.cue === "thump")).toBe(true);
      expect(poof).toBeGreaterThan(0);
      expect(f[poof]!.layers.every((l) => l.part.startsWith("puff:"))).toBe(true);
      expect(f[f.length - 1]!.layers).toEqual([]);
      // The flight's look is the landing's first: the balloon at the same place.
      const fly = BALLOON_FLY.anims[`fly${p[0]!.toUpperCase()}${p.slice(1)}`]!.frames[0]!.layers.find((l) => l.part.startsWith("balloon:"));
      const land = f[0]!.layers.find((l) => l.part.startsWith("balloon:"));
      expect(Math.abs(land!.y - fly!.y)).toBeLessThanOrEqual(1);
      expect(land!.x).toBe(fly!.x);
    }
  });
});
