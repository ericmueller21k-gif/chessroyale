import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { CUT, SAWYER } from "../src/characters/sawyer.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { frameKeys } from "../src/characters/sprite.ts";

const top = (keys: (string | null)[][]) => keys.findIndex((r) => r.some(Boolean));
const idle = SAWYER.anims.idle!;

describe("Sawyer (a sprite preview)", () => {
  it("is a kit for the test link only: no boss uses him yet", () => {
    expect(BOSS_KITS["Sawyer"]?.ch).toBe(SAWYER);
    expect(BOSS_ROSTER.some((b) => b.kit === "Sawyer")).toBe(false);
  });

  it("never rises above his hard hat at rest, so on a phone he stays under the boss bar's heading", () => {
    const highest = Math.min(...idle.frames.map((f) => top(frameKeys(SAWYER, f))));
    for (const [name, anim] of Object.entries(SAWYER.anims))
      anim.frames.forEach((f, i) => expect(top(frameKeys(SAWYER, f)), `${name} frame ${i + 1}`).toBeGreaterThanOrEqual(highest));
  });

  it("has no goggles: a bold black bandit mask with his eyes inside it, glinting (Eric, Oct 10)", () => {
    for (const k of ["G", "H", "I", "Z"]) expect(SAWYER.palette, k).not.toHaveProperty(k);
    const keys = frameKeys(SAWYER, idle.frames[0]!);
    const mask = keys.flat().filter((c) => c === "m").length;
    expect(mask).toBeGreaterThan(80);
    // Each eye: white with a glint, inside the mask's rows.
    const rows = keys.map((r) => r.join(""));
    const eyeRows = rows.filter((r) => r.includes("v"));
    expect(eyeRows.length).toBeGreaterThan(0);
    for (const r of eyeRows) expect(r.match(/v/g)!.length).toBe(2);
  });

  it("idles silently: the blade buzzes in and out, the tail swishes, he blinks and smirks", () => {
    const part = (prefix: string) => idle.frames.map((f) => f.layers.find((l) => l.part.startsWith(prefix))!.part);
    const saws = part("saw:");
    expect(saws.filter((s, i) => s !== saws[(i + 1) % saws.length]).length).toBeGreaterThan(idle.frames.length / 2);
    expect(new Set(part("tail:")).size).toBeGreaterThanOrEqual(4);
    const heads = part("head:");
    expect(heads).toContain("head:blink");
    expect(heads).toContain("head:smirk");
    expect(idle.frames.some((f) => f.cue)).toBe(false);
  });

  it("revs with a cue and a shake, and drives the saw down to bite the ground in front of him", () => {
    const rev = SAWYER.anims.rev!.frames;
    expect(rev.some((f) => f.cue === "rev")).toBe(true);
    expect(rev.some((f) => f.shake)).toBe(true);
    const down = SAWYER.anims.sawDown!.frames;
    const swing = down.findIndex((f) => f.cue === "swing");
    const cut = down.findIndex((f) => f.cue === "cut");
    expect(swing).toBeGreaterThan(0);
    expect(cut).toBeGreaterThan(swing);
    // The blade's tip at the cut: down at the ground (y 64 in his drawing space), out in front (our left of his feet).
    expect(CUT[1]).toBeGreaterThan(58);
    expect(CUT[0]).toBeLessThan(15);
  });

  it("has a portrait inside his frame that shows his hard hat, bandit mask, eyes and grin", () => {
    const p = BOSS_KITS["Sawyer"]!.portrait;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(SAWYER.w);
    expect(p.y + p.h).toBeLessThanOrEqual(SAWYER.h);
    const keys = frameKeys(SAWYER, SAWYER.anims[p.anim]!.frames[p.frame]!);
    const inside = keys.slice(p.y, p.y + p.h).flatMap((r) => r.slice(p.x, p.x + p.w));
    for (const k of ["Y", "m", "w", "v", "x"]) expect(inside, k).toContain(k);
    // The whole hat, mask and nose.
    const all = (k: string) => keys.flat().filter((c) => c === k).length;
    for (const k of ["Y", "m"]) expect(inside.filter((c) => c === k).length, k).toBe(all(k));
  });
});
