import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../src/characters/index.ts";
import { frameKeys, renderFrame } from "../src/characters/sprite.ts";

describe("boss characters (code-drawn pixel art)", () => {
  for (const ch of CHARACTERS) {
    describe(ch.name, () => {
      it("draws every part only with colors in its palette", () => {
        for (const [name, part] of Object.entries(ch.parts))
          for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${name}: "${k}"`).toHaveProperty(k);
      });

      it("has a looping idle and one-shot moves that fire cues", () => {
        expect(ch.anims.idle?.loop).toBe(true);
        const shots = Object.values(ch.anims).filter((a) => !a.loop);
        expect(shots.length).toBeGreaterThan(0);
        for (const a of shots) expect(a.frames.some((f) => f.cue)).toBe(true);
      });

      it("renders every frame, in every look, without anything cut off at the frame's edge", () => {
        for (const [name, anim] of Object.entries(ch.anims))
          anim.frames.forEach((f, i) => {
            for (const look of [undefined, ...Object.keys(ch.looks ?? {})]) expect(renderFrame(ch, f, { look }).data.length).toBe(ch.w * ch.h * 4);
            const keys = frameKeys(ch, f);
            const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
            expect(edge.filter(Boolean), `${name} frame ${i + 1}`).toEqual([]);
          });
      });

      it("stands its feet on the ground point", () => {
        const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
        const [fx, fy] = ch.foot;
        expect(keys[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
      });
    });
  }
});

// The Hidden Boss's younger ages (Nov 12): drawn for the preview; since Nov 13 also his child form's growing figure (RECLUSE_GROWING),
// in its own kit (RECLUSE_CHILD_KIT, kits.ts bossKitOf), never in a character list or BOSS_KITS.
describe("the Hidden Boss's ages (mockup)", async () => {
  const { RECLUSE_AGES_PREVIEW } = await import("../src/characters/recluse-ages.ts");
  const { BOSS_KITS } = await import("../src/characters/kits.ts");

  it("is in no character list or kit", () => {
    const ids = new Set(RECLUSE_AGES_PREVIEW.map((c) => c.id));
    expect(CHARACTERS.filter((c) => ids.has(c.id))).toEqual([]);
    for (const kit of Object.values(BOSS_KITS)) for (const c of [kit.ch, kit.bar]) expect(c && ids.has(c.id)).toBeFalsy();
  });

  for (const ch of RECLUSE_AGES_PREVIEW) {
    const bust = ch.id.endsWith("-bust");
    it(`${ch.id}: draws every frame in its palette, a looping idle, cues on its one-shots, nothing cut off`, () => {
      expect(ch.anims.idle?.loop).toBe(true);
      for (const [name, anim] of Object.entries(ch.anims)) {
        if (!anim.loop) expect(anim.frames.some((f) => f.cue), name).toBe(true);
        anim.frames.forEach((f, i) => {
          expect(renderFrame(ch, f).data.length).toBe(ch.w * ch.h * 4);
          const keys = frameKeys(ch, f);
          // (A bust is cut at its foot on purpose, as today's is.)
          const edge = [...keys[0]!, ...(bust ? [] : keys[ch.h - 1]!), ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
          expect(edge.filter(Boolean), `${name} frame ${i + 1}`).toEqual([]);
        });
      }
      if (!bust) {
        const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
        const [fx, fy] = ch.foot;
        expect(keys[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
      }
    });
  }
});

// Chandy's checkmate way into Dodge (Nov 26): the poses, drawn ahead of their wiring (chandy-mate.ts), in no character list yet.
describe("Chandy's checkmate figure", async () => {
  const { CHANDY_MATE, MATE_ANIMS, REACH_DIRS, nearestReach } = await import("../src/characters/chandy-mate.ts");
  const { chandyAnim, STAGES } = await import("../src/characters/chandy.ts");
  const ch = CHANDY_MATE;

  it("has every animation at every rifle stage, drawn in his palette, cues on its one-shots, nothing cut off", () => {
    for (const st of STAGES)
      for (const name of MATE_ANIMS) {
        const anim = ch.anims[chandyAnim(name, st)]!;
        expect(anim, `${name} ${st}`).toBeTruthy();
        if (!anim.loop) expect(anim.frames.some((f) => f.cue), name).toBe(true);
        anim.frames.forEach((f, i) => {
          expect(renderFrame(ch, f).data.length).toBe(ch.w * ch.h * 4);
          const keys = frameKeys(ch, f);
          const edge = [...keys[0]!, ...keys[ch.h - 1]!, ...keys.map((r) => r[0]), ...keys.map((r) => r[ch.w - 1])];
          expect(edge.filter(Boolean), `${name}_s${st} frame ${i + 1}`).toEqual([]);
        });
      }
    for (const [name, part] of Object.entries(ch.parts))
      for (const row of part.grid) for (const k of row) if (k !== "." && k !== " ") expect(ch.palette, `${name}: "${k}"`).toHaveProperty(k);
  });

  it("stands on its foot point and picks the nearest reach", () => {
    const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
    const [fx, fy] = ch.foot;
    expect(keys[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
    expect(REACH_DIRS.map((d) => nearestReach(d))).toEqual([...REACH_DIRS]);
    expect(nearestReach(85)).toBe(60);
    expect(nearestReach(-80)).toBe(-30);
  });

  // (The director, Nov 26: "the collapse must clearly read as collapsed": the kneel sat only a little lower than his stand.)
  it("collapses flat on the ground, his rifle off his back, and holds still a beat; the leap ends there", () => {
    const box = (f: Parameters<typeof frameKeys>[1]) => {
      const keys = frameKeys(ch, f);
      const rows = keys.map((r, y) => (r.some(Boolean) ? y : -1)).filter((y) => y >= 0);
      const cols = keys[0]!.map((_, x) => (keys.some((r) => r[x]) ? x : -1)).filter((x) => x >= 0);
      return { top: rows[0]!, bottom: rows.at(-1)!, w: cols.at(-1)! - cols[0]! };
    };
    for (const st of STAGES) {
      const stand = box(ch.anims[chandyAnim("idle", st)]!.frames[0]!);
      const slumped = ch.anims[chandyAnim("slumped", st)]!;
      const flat = slumped.frames[0]!;
      const down = box(flat);
      // Flat: no more than half his standing height (rifle and all), on the ground, and longer than tall.
      expect(down.bottom - down.top, `stage ${st}`).toBeLessThanOrEqual((stand.bottom - stand.top) / 2);
      expect(Math.abs(down.bottom - stand.bottom), `stage ${st}`).toBeLessThanOrEqual(2);
      expect(down.w).toBeGreaterThan(down.bottom - down.top);
      // His rifle lies on the ground (its part's bottom at his feet), not on his back.
      const gun = flat.layers.find((l) => l.part.startsWith("rifle:"))!;
      expect(gun.y + ch.parts[gun.part]!.grid.length, `stage ${st}`).toBeGreaterThanOrEqual(ch.foot[1] - 1);
      // A beat of stillness first; the leap's last frame is the flat one, the reach starts from his knees.
      expect(flat.ms).toBeGreaterThanOrEqual(1000);
      const leap = ch.anims[chandyAnim("leap", st)]!;
      expect(leap.frames.at(-1)!.layers).toEqual(flat.layers);
      expect(box(ch.anims[chandyAnim("reach0", st)]!.frames[0]!).top).toBeGreaterThan(stand.top);
    }
  });
});
