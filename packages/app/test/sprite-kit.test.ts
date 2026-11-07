import { describe, expect, it } from "vitest";
import { BOARD_FACING, KIT, TEMPLATES, crisp, drawnFacing, facingAs, mirrorFor, toward, type Sprite } from "../src/characters/sprite-kit.ts";
import { SPRITES, artFacing } from "../src/characters/sprites.ts";
import { frameKeys, renderFrame, type Character } from "../src/characters/sprite.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { SMUDGY, SMUDGY_SPRITE } from "../src/characters/smudgy.ts";
import { BOSS_INTROS } from "../src/town/shops/challenge.ts";

/** The sprite kit (docs/decisions/2026-11-06-sprite-kit.md): its rules, checked on every sprite on it. */

const frames = (ch: Character) => Object.entries(ch.anims).flatMap(([a, an]) => an.frames.map((f, i) => ({ name: `${a}[${i}]`, f })));
const lum = (c: string) => {
  const n = parseInt(c.slice(1, 7), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

describe.each(Object.entries(SPRITES))("the sprite kit's rules: %s", (_id, s: Sprite) => {
  it("uses its palette only (every pixel of every frame a key it has; the halo its own)", () => {
    const keys = new Set([...Object.keys(s.ch.palette), ...(s.ch.halo ? ["@"] : [])]);
    for (const { name, f } of frames(s.ch)) {
      const used = new Set(frameKeys(s.ch, f).flat().filter((k): k is string => k !== null));
      expect([...used].filter((k) => !keys.has(k)), name).toEqual([]);
    }
  });
  it("has the 1-px ink outline: its silhouette's edge is ink (or its halo), but for the parts drawn without one", () => {
    expect(s.ch.palette[KIT.outline]).toBeDefined();
    const ok = new Set([KIT.outline, "@", ...(s.unlined ?? "")]);
    for (const { name, f } of frames(s.ch)) {
      const k = frameKeys(s.ch, f);
      const bad = new Set<string>();
      k.forEach((row, y) => row.forEach((c, x) => c && N4.some(([dx, dy]) => !k[y + dy]?.[x + dx]) && !ok.has(c) && bad.add(c)));
      expect([...bad], name).toEqual([]);
      // (A frame with the figure in it has its ink: an empty one, before his entrance's drop, or dust alone, has none.)
      const figure = k.flat().some((c) => c && !(s.unlined ?? "").includes(c));
      expect(!figure || k.flat().includes(KIT.outline), name).toBe(true);
    }
  });
  it("its ramps: at least 3 steps each, keys of its palette, dark to light", () => {
    for (const [hue, ramp] of Object.entries(s.ramps)) {
      expect(ramp.length, hue).toBeGreaterThanOrEqual(KIT.rampSteps);
      const l = [...ramp].map((k) => lum(s.ch.palette[k]!));
      expect(l.every((v, i) => i === 0 || v > l[i - 1]!), `${hue}: ${l.map(Math.round)}`).toBe(true);
    }
  });
  it("its anchors inside its frame, its feet its character's foot", () => {
    const inside = ([x, y]: readonly number[]) => x! >= 0 && x! <= s.ch.w && y! >= 0 && y! <= s.ch.h;
    expect(s.anchors.feet).toEqual(s.ch.foot);
    for (const p of [s.anchors.feet, s.anchors.head, ...Object.values(s.anchors.hands)]) expect(inside(p), String(p)).toBe(true);
  });
  it("every frame the same size, and its templates name its animations (idle a loop)", () => {
    for (const { name, f } of frames(s.ch)) {
      const r = renderFrame(s.ch, f);
      expect([r.w, r.h], name).toEqual([s.ch.w, s.ch.h]);
    }
    for (const [t, anim] of Object.entries(s.frames)) {
      expect(TEMPLATES as readonly string[], t).toContain(t);
      expect(s.ch.anims[anim!], `${t}: ${anim}`).toBeDefined();
    }
    expect(s.ch.anims[s.frames.idle]!.loop).toBe(true);
  });
  it("facing flips its anchors and its pixels: turned round, every frame is the art mirrored pixel for pixel", () => {
    const other = s.facing === "left" ? "right" : "left";
    const m = facingAs(s, other);
    expect(facingAs(s, s.facing)).toBe(s);
    expect(m.facing).toBe(other);
    expect(drawnFacing(s, m.ch)).toBe(other);
    expect(drawnFacing(s, s.ch)).toBe(s.facing);
    const flip = ([x, y]: readonly number[]) => [s.ch.w - x!, y];
    expect(m.anchors.feet).toEqual(flip(s.anchors.feet));
    expect(m.ch.foot).toEqual(flip(s.ch.foot));
    expect(m.anchors.head).toEqual(flip(s.anchors.head));
    for (const [k, p] of Object.entries(s.anchors.hands)) expect(m.anchors.hands[k], k).toEqual(flip(p));
    for (const { name, f } of frames(s.ch)) {
      const a = renderFrame(s.ch, f);
      const b = renderFrame(m.ch, f);
      let diff = 0;
      for (let y = 0; y < a.h; y++)
        for (let x = 0; x < a.w; x++)
          for (let c = 0; c < 4; c++) if (a.data[(y * a.w + x) * 4 + c] !== b.data[(y * a.w + (a.w - 1 - x)) * 4 + c]) diff++;
      expect(diff, name).toBe(0);
    }
  });
});

describe("the sprite kit's helpers", () => {
  it("crisp (nearest filtering) from 1.5x up; facing toward a point; mirrored only when the art faces the other way", () => {
    expect([crisp(150, 100), crisp(149, 100), crisp(400, 100)]).toEqual([true, false, true]);
    expect([toward(10, 20), toward(20, 10)]).toEqual(["right", "left"]);
    expect([mirrorFor("left", "right"), mirrorFor("left", "left"), mirrorFor("right", "left")]).toEqual([true, false, true]);
  });
});

describe("Smudgy, the sprite kit's pilot (Eric, Nov 6: \"in the battle intro he's facing the wrong way when the match starts\")", () => {
  it("his sprite is his drawing as it was (the same character); his art faces our left", () => {
    expect(SMUDGY_SPRITE.ch).toBe(SMUDGY);
    expect(artFacing("smudgy")).toBe("left");
  });
  it("his board figure (the bar, beside the board, the result) faces the board: our right, his art mirrored, his feet with it", () => {
    const kit = BOSS_KITS.Smudgy!;
    expect(BOARD_FACING).toBe("right");
    expect(drawnFacing(kit.sprite!, kit.ch)).toBe("right");
    expect(kit.ch.foot).toEqual([SMUDGY.w - SMUDGY.foot[0], SMUDGY.foot[1]]);
  });
  it("in his room's intro he stands west of the table (across), facing east: his drawing faces east, toward the table", () => {
    expect(BOSS_INTROS.smudgy.layout).toBe("across");
    // (The room turns his town figure by his art's facing: mirrored to face east, ShopRoom's drawBoss.)
    expect(mirrorFor(artFacing("smudgy")!, "right")).toBe(true);
  });
});
