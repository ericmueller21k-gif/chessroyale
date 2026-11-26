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
  const { CHANDY_MATE, MATE_ANIMS, MATE_NEAR, MATE_NEAR_UP, MATE_PX, REACH_DIRS, boardPoint, mateAim, reachSuffix } = await import("../src/characters/chandy-mate.ts");
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

  it("stands on its foot point", () => {
    const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
    const [fx, fy] = ch.foot;
    expect(keys[fy - 1]!.slice(fx - 6, fx + 6).some(Boolean)).toBe(true);
  });

  // (The review, Nov 26: a king near the center or up the board had the bolt leave his claws up to 133° off his arm, under his own
  // figure. Now: reaches from straight up to straight down, picked from each reach's own hand, and off the center for a king near it.)
  it("for a king on any square, either crowd: the bolt runs along his arm, clear of him, and he never stands over the king", () => {
    const [fx, fy] = ch.foot;
    // His figure's box on the board while he's there (from the buckle on: the collapse, the reach, the zap, holding it; the zap's bolt specks
    // left out: they run to the king), in board sizes from his feet, facing our right. (Not the landing's squash, 100 ms as he comes down:
    // at the full rifle its muzzle, up over his shoulder, pokes 13 px into the square two up from the center.)
    const boxOf = (frames: readonly Parameters<typeof frameKeys>[1][]) => {
      let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
      for (const f of frames)
        frameKeys(ch, { ...f, specks: undefined }).forEach((r, y) =>
          r.forEach((k, x) => {
            if (!k) return;
            [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x + 1), Math.min(y0, y), Math.max(y1, y + 1)];
          }),
        );
      return [(x0 - fx) / MATE_PX, (x1 - fx) / MATE_PX, (y0 - fy) / MATE_PX, (y1 - fy) / MATE_PX] as const;
    };
    const boxes = new Map<number, readonly [number, number, number, number]>();
    for (const d of REACH_DIRS) {
      const frames = STAGES.flatMap((st) => ["slumped", `reach${reachSuffix(d)}`, `reaching${reachSuffix(d)}`, `zap${reachSuffix(d)}`].flatMap((a) => ch.anims[chandyAnim(a, st)]!.frames).concat(ch.anims[chandyAnim("land", st)]!.frames.slice(1)));
      boxes.set(d, boxOf(frames));
    }
    let worst = 0;
    for (const side of ["white", "black"] as const)
      for (const f of "abcdefgh")
        for (let r = 1; r <= 8; r++) {
          const sq = `${f}${r}`;
          const k = boardPoint(sq, side);
          const a = mateAim(sq, side);
          const m = a.mirror ? -1 : 1;
          // Facing the king; off the center just when the king is near it, and on the board.
          expect(Math.sign(k[0] - a.feet[0]), sq).toBe(m);
          const near = Math.abs(k[0]) <= MATE_NEAR / 8 && k[1] <= MATE_NEAR / 8 && k[1] >= -MATE_NEAR_UP / 8;
          expect(a.feet[0] !== 0, `${side} ${sq}`).toBe(near);
          expect(Math.abs(a.feet[0])).toBeLessThanOrEqual(0.25);
          // The bolt: from his hand to the king's middle, at most about 15° off his arm (whole pixels: 15.5), and a square long or more.
          expect(a.hand[0] + a.to[0]).toBeCloseTo(k[0], 9);
          expect(a.hand[1] + a.to[1]).toBeCloseTo(k[1], 9);
          const off = Math.abs((Math.atan2(a.to[1], m * a.to[0]) * 180) / Math.PI - a.dir);
          worst = Math.max(worst, off);
          expect(off, `${side} ${sq}: reach ${a.dir}`).toBeLessThanOrEqual(15.5);
          expect(Math.hypot(...a.to), `${side} ${sq}`).toBeGreaterThanOrEqual(1.5 / 8);
          // His figure's box (mirrored about his feet toward a king on his left) never over the king's square.
          const [bx0, bx1, by0, by1] = boxes.get(a.dir)!;
          const [x0, x1] = m > 0 ? [a.feet[0] + bx0, a.feet[0] + bx1] : [a.feet[0] - bx1, a.feet[0] - bx0];
          const [y0, y1] = [a.feet[1] + by0, a.feet[1] + by1];
          const over = x0 < k[0] + 1 / 16 && x1 > k[0] - 1 / 16 && y0 < k[1] + 1 / 16 && y1 > k[1] - 1 / 16;
          expect(over, `${side} ${sq}: his figure over the king`).toBe(false);
        }
    expect(worst).toBeGreaterThan(0);
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
