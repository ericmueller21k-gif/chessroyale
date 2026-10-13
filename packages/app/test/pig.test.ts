import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { CHARACTERS } from "../src/characters/index.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { CATCH, PIG, PIG_PORTRAIT } from "../src/characters/pig.ts";
import { frameKeys, renderFrame } from "../src/characters/sprite.ts";

// Wrangler (code id `pig`), art only: the same checks characters.test.ts makes of every character in the game, made
// here because he isn't in it yet, and that he shows nowhere in the game.
const top = (keys: (string | null)[][]) => keys.findIndex((r) => r.some(Boolean));
const idle = PIG.anims.idle!;

describe("Wrangler, the cowboy pig (art only)", () => {
  it("is in no roster, kit or character list, so the game never shows him", () => {
    expect(PIG.name).toBe("Wrangler");
    expect(CHARACTERS).not.toContain(PIG);
    expect(Object.values(BOSS_KITS).some((k) => k.ch === PIG)).toBe(false);
    expect(BOSS_ROSTER.some((b) => b.id === "pig" || b.name === "Wrangler")).toBe(false);
  });

  it("draws every part only with colours in his palette", () => {
    for (const [name, part] of Object.entries(PIG.parts))
      for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(PIG.palette, `${name}: "${k}"`).toHaveProperty(k);
  });

  it("idles silently in a loop; his one-shots fire cues", () => {
    expect(idle.loop).toBe(true);
    expect(idle.frames.some((f) => f.cue)).toBe(false);
    for (const name of ["lasso", "taunt", "windup"]) {
      const a = PIG.anims[name]!;
      expect(a.loop, name).toBe(false);
      expect(a.frames.some((f) => f.cue), name).toBe(true);
    }
    const cues = (name: string) => PIG.anims[name]!.frames.map((f) => f.cue).filter(Boolean);
    expect(cues("lasso")).toEqual(["whirl", "throw", "catch", "tug"]);
    expect(cues("taunt")).toEqual(["tip", "laugh", "snort", "stomp"]);
  });

  it("renders every frame without anything cut off at the frame's edge", () => {
    for (const [name, anim] of Object.entries(PIG.anims))
      anim.frames.forEach((f, i) => {
        expect(renderFrame(PIG, f).data.length).toBe(PIG.w * PIG.h * 4);
        const keys = frameKeys(PIG, f);
        const edge = [...keys[0]!, ...keys[PIG.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[PIG.w - 1])];
        expect(edge.filter(Boolean), `${name} frame ${i + 1}`).toEqual([]);
      });
  });

  it("never rises above his spinning loop at rest, so on a phone he stays under the boss bar's heading", () => {
    const highest = Math.min(...idle.frames.map((f) => top(frameKeys(PIG, f))));
    for (const [name, anim] of Object.entries(PIG.anims))
      anim.frames.forEach((f, i) => expect(top(frameKeys(PIG, f)), `${name} frame ${i + 1}`).toBeGreaterThanOrEqual(highest));
    // No taller than the other bosses stand (Sawyer 67 px, Big Boy 69, Hollow 75 above their feet).
    expect(PIG.foot[1] - highest).toBeLessThanOrEqual(70);
  });

  it("stands his feet on the ground point", () => {
    const keys = frameKeys(PIG, idle.frames[0]!);
    const [fx, fy] = PIG.foot;
    expect(keys[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
  });

  it("spins his loop the whole idle: the loop changes every frame", () => {
    const loops = idle.frames.map((f) => f.layers.find((l) => l.part.startsWith("loop:"))!.part);
    expect(loops.every((l, i) => l !== loops[(i + 1) % loops.length])).toBe(true);
  });

  it("throws his loop out to our right and it lands on the ground at CATCH", () => {
    const land = PIG.anims.lasso!.frames.find((f) => f.cue === "catch")!;
    const keys = frameKeys(PIG, land);
    const [ox, oy] = [PIG.foot[0] - 40, PIG.foot[1] - 70];
    expect(keys[oy + CATCH[1]]![ox + CATCH[0] - 9]).toBeTruthy();
    expect(CATCH[0]).toBeGreaterThan(80);
  });

  it("has a portrait inside his frame that shows his hat, eyes, snout and teeth", () => {
    const p = PIG_PORTRAIT;
    expect(p.x + p.w).toBeLessThanOrEqual(PIG.w);
    expect(p.y + p.h).toBeLessThanOrEqual(PIG.h);
    const keys = frameKeys(PIG, idle.frames[0]!);
    const inside = keys.slice(p.y, p.y + p.h).flatMap((r) => r.slice(p.x, p.x + p.w));
    for (const k of ["j", "y", "w", "x", "n", "e"]) expect(inside, k).toContain(k);
  });
});
