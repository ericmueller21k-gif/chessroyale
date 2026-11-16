// Chandy's art (Nov 16; docs/decisions/2026-11-16-chandy-art.md), drawn ahead of his rules: his figure at every rifle stage, his clones,
// his rifle alone, and his kit (in ART_KITS, not the roster's BOSS_KITS). The same checks characters.test.ts and boss-character.test.ts
// make of every boss, plus his own: the stages, the clone look, the clones' muzzles. His board art is walked with every boss's by
// gingerbread.test.ts ("the effect sprites").
import { describe, expect, it } from "vitest";
import { ART_KITS, BOSS_KITS } from "../src/characters/kits.ts";
import { CHANDY, CHANDY_CLONE, CHANDY_CLONE_HALO, CHANDY_CLONE_PALETTE, CHANDY_CUES, CHANDY_FOOT, CHANDY_PORTRAIT, CHANDY_RIFLE, CHANDY_SOUNDS, RIFLE_STAGES, STAGES, chandyAnim, cloneMuzzle } from "../src/characters/chandy.ts";
import { EFFECTS } from "../src/characters/power-art.ts";
import { frameKeys, renderFrame, type Character } from "../src/characters/sprite.ts";
import type { Beat } from "../src/characters/boss-beats.ts";

const whole = (ch: Character) => {
  for (const [name, anim] of Object.entries(ch.anims))
    anim.frames.forEach((f, i) => {
      for (const look of [undefined, ...Object.keys(ch.looks ?? {})]) expect(renderFrame(ch, f, { look }).data.length).toBe(ch.w * ch.h * 4);
      const keys = frameKeys(ch, f);
      const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
      expect(edge.filter(Boolean), `${ch.id} ${name} frame ${i + 1}`).toEqual([]);
    });
};

describe("Chandy's art", () => {
  for (const ch of [CHANDY, CHANDY_CLONE, CHANDY_RIFLE])
    it(`${ch.id}: draws only with its palette, every frame whole in its frame, in every look`, () => {
      for (const [name, part] of Object.entries(ch.parts)) for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${name}: "${k}"`).toHaveProperty(k);
      whole(ch);
    });

  it("has every animation at every rifle stage, a looping idle, and cues on the one-shots", () => {
    expect(STAGES.length).toBe(RIFLE_STAGES.length);
    for (const st of STAGES) for (const name of ["idle", "point", "fire", "aim", "stow"]) expect(CHANDY.anims[chandyAnim(name, st)], `${name} at ${st}`).toBeDefined();
    expect(CHANDY.anims.idle!.loop).toBe(true);
    for (const [name, a] of Object.entries(CHANDY.anims)) if (!a.loop) expect(a.frames.some((f) => f.cue), name).toBe(true);
    for (const [name, a] of Object.entries(CHANDY_CLONE.anims)) if (!a.loop) expect(a.frames.some((f) => f.cue), name).toBe(true);
  });

  it("stands his feet on the ground point, and the rifle grows with each stage", () => {
    const keys = frameKeys(CHANDY, CHANDY.anims.idle!.frames[0]!);
    expect(keys[CHANDY_FOOT[1] - 1]!.slice(CHANDY_FOOT[0] - 6, CHANDY_FOOT[0] + 6).some(Boolean)).toBe(true);
    const widths = STAGES.map((s) => {
      const k = frameKeys(CHANDY_RIFLE, CHANDY_RIFLE.anims[`stage${s}`]!.frames[0]!);
      let right = 0;
      k.forEach((row) => row.forEach((v, x) => v && (right = Math.max(right, x))));
      return right;
    });
    for (let i = 1; i < widths.length; i++) expect(widths[i]!, `stage ${i}`).toBeGreaterThanOrEqual(widths[i - 1]!);
    expect(widths[5]! - widths[0]!).toBeGreaterThan(30);
  });

  it("keeps the red-green clone look (round 1's scrambled GIF palette, Eric: 'I like that')", () => {
    expect(CHANDY.looks?.clone).toBe(CHANDY_CLONE_PALETTE);
    expect(CHANDY_CLONE.halo).toBe(CHANDY_CLONE_HALO);
    // A few keys as measured from that GIF: his skin's mid and light hot pink and neon green, his belly purple.
    expect(CHANDY_CLONE_PALETTE).toMatchObject({ c: "#ff3f5e", d: "#2bff56", e: "#ff2c43", g: "#994aff" });
    for (const [k, v] of Object.entries(CHANDY_CLONE_PALETTE)) expect(v, k).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("puts the clones' muzzles inside their frame: level on our right, down below the feet", () => {
    const [lx, ly] = cloneMuzzle("level");
    const [dx, dy] = cloneMuzzle("down");
    expect(lx).toBeGreaterThan(CHANDY_FOOT[0] + 60);
    expect(lx).toBeLessThan(CHANDY_CLONE.w);
    expect(ly).toBeLessThan(CHANDY_FOOT[1]);
    expect(dy).toBeGreaterThan(CHANDY_FOOT[1]);
    expect(dy).toBeLessThan(CHANDY_CLONE.h);
    expect(dx).toBeGreaterThan(0);
  });

  it("is a kit drawn ahead: every moment animated, a sound for every cue, its portrait inside the frame; not in the roster's kits", () => {
    const kit = ART_KITS.Chandy!;
    expect(BOSS_KITS.Chandy).toBeUndefined();
    const beats: Beat[] = ["entrance", "idle", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "strike", "power", "ultimateWarn", "ultimate"];
    for (const b of beats) expect(kit.ch.anims[kit.anims[b] ?? b], b).toBeTruthy();
    for (const ch of [CHANDY, CHANDY_CLONE]) for (const a of Object.values(ch.anims)) for (const f of a.frames) if (f.cue) expect(kit.sounds[f.cue], f.cue).toBeTruthy();
    for (const fx of Object.entries(EFFECTS).filter(([k]) => k.startsWith("chandy")))
      for (const a of Object.values(fx[1].ch.anims)) for (const f of a.frames) if (f.cue) expect(CHANDY_SOUNDS[f.cue], `${fx[0]}: ${f.cue}`).toBeTruthy();
    for (const cue of Object.keys(CHANDY_SOUNDS)) expect(CHANDY_CUES[cue], cue).toBeTruthy();
    const P = CHANDY_PORTRAIT;
    expect(P.x >= 0 && P.y >= 0 && P.x + P.w <= CHANDY.w && P.y + P.h <= CHANDY.h).toBe(true);
  });
});
