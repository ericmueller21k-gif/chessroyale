import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KING_REACH, SIDE_FEEL, SIDE_REACH, sideSizes, type SideRoom } from "../src/characters/side-size.ts";
import { GOD_KING } from "../src/characters/god-king.ts";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { BOSS_INTROS, CHALLENGE_FEEL, bubbleSize, drawnTop } from "../src/town/shops/challenge.ts";
import { BOSS_ART } from "../src/town/render.ts";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { renderFrame } from "../src/characters/sprite.ts";
import type { HomeId } from "../src/town/world.ts";

/** docs/decisions/2026-11-04-battle-desktop-fixes.md: a boss battle on a computer (the cast in place, the figures' size) and the cave's bubble. */

describe("a computer's corner casts", () => {
  it("every cast at the board's corner goes through Cast, so on a computer every boss casts where it stands (Eric, Nov 4: Hollow's darkness drew him half off the window)", () => {
    const dir = new URL("../src/components/", import.meta.url);
    const own = readdirSync(dir).filter((f) => f.endsWith(".tsx") && f !== "PowerParts.tsx" && !f.startsWith("WipPreview"));
    const drawn = own.filter((f) => /class=["{`][^"]*pm-caster/.test(readFileSync(new URL(f, dir), "utf8")));
    expect(drawn, "a figure at the corner drawn on its own").toEqual([]);
    expect(readFileSync(new URL("PowerParts.tsx", dir), "utf8")).toMatch(/if \(onComputer\(\)\) return <InPlace/);
  });
});

describe("the figures beside the board on a computer (sideSizes)", () => {
  const reachOf = (ch: { w: number; h: number; foot: readonly number[]; anims: Record<string, { loop?: boolean; frames: unknown[] }> }) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const a of Object.values(ch.anims))
      for (const f of a.loop ? a.frames : a.frames.slice(-1)) {
        const { w, h, data } = renderFrame(ch as never, f as never);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            if (data[(y * w + x) * 4 + 3]! > 0) {
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
            }
      }
    return [ch.foot[0]! - x0, ch.foot[1]! - y0, x1 + 1 - ch.foot[0]!, y1 + 1 - ch.foot[1]!];
  };
  it("SIDE_REACH and KING_REACH are each figure's drawing's reach from its feet (left, up, right, down), at rest and where each beat ends", () => {
    for (const kit of Object.values(BOSS_KITS)) expect(SIDE_REACH[kit.ch.id], kit.ch.id).toEqual(reachOf(kit.ch));
    expect([...KING_REACH]).toEqual(reachOf(GOD_KING));
  });
  // Rooms as measured at 2× (scripts/stills-battle-desktop.mjs sides, Boss alone, no eval bar): the board, the empty column's left edge;
  // Hollow and Folio (Folio's drawing the widest), his box's middle 86 px left of the board; your pawn's middle 86 px right of it, its
  // drawing 57 px either side, the God King's drawing's right edge 188 px past its middle.
  const rooms: Record<string, { board: number; left: number; bottom: number; limit: number; win: number }> = {
    "1280x800": { board: 600, left: 346, bottom: 663, limit: 90, win: 1280 },
    "1440x900": { board: 760, left: 346, bottom: 823, limit: 90, win: 1440 },
    "1920x1080": { board: 952, left: 536, bottom: 1015, limit: 256, win: 1920 },
    "2000x1250": { board: 1120, left: 522, bottom: 1183, limit: 242, win: 2000 },
  };
  const bosses = { hollow: SIDE_REACH.hollow, folio: SIDE_REACH.folio, recluse: SIDE_REACH.recluse } as const;
  const roomOf = (r: (typeof rooms)[string], [l, u, rr]: readonly number[]): SideRoom => {
    const mid = r.left - 86;
    const right = r.left + r.board;
    return {
      board: r.board, boardLeft: r.left, boardRight: right, boardBottom: r.bottom, leftLimit: r.limit, rightLimit: r.win,
      s: 2, bossMid: mid, bossLeft: mid - l! * 2, bossRight: mid + rr! * 2, bossTop: r.bottom - u! * 2,
      k: 1, right: { mid: right + 86, inner: right + 86 - 57, outer: right + 86 + 188, over: true },
    };
  };
  for (const [size, r] of Object.entries(rooms))
    it(`${size}: toward twice as big, each in its room, over the board's edge by at most ${SIDE_FEEL.over} of its side, whole in the window`, () => {
      const over = r.board * SIDE_FEEL.over;
      for (const [id, reach] of Object.entries(bosses)) {
        const room = roomOf(r, reach);
        const p = sideSizes(room, SIDE_FEEL, id);
        expect(p.s, id).toBeGreaterThanOrEqual(3);
        expect(p.s).toBeLessThanOrEqual(SIDE_FEEL.max);
        expect(p.k, "the God King and your pawn").toBeGreaterThanOrEqual(1.4);
        // His drawing: in his room, under the window's top, and over the board's edge by at most `over`.
        const lc = reach[0]!, rc = reach[2]!;
        expect(p.bossMid! - lc * p.s, `${id}: in his room`).toBeGreaterThanOrEqual(r.limit + SIDE_FEEL.margin - 0.2);
        expect(p.bossMid! + rc * p.s, `${id}: over the board by at most ${over}`).toBeLessThanOrEqual(r.left + over + 0.2);
        expect(r.bottom - reach[1]! * p.s, `${id}: under the window's top`).toBeGreaterThanOrEqual(SIDE_FEEL.margin - 0.2);
        // Your pawn over the board by at most `over`, the God King's drawing inside the window.
        expect(p.firstMid! - 57 * p.k, "your pawn").toBeGreaterThanOrEqual(r.left + r.board - over - 0.2);
        expect(p.firstMid! + 188 * p.k, "the God King").toBeLessThanOrEqual(r.win - SIDE_FEEL.margin + 0.2);
      }
      // Babur keeps his size and place (his pump's room beside him), and a party's battle too (its figures stacked by the corner).
      expect(sideSizes(roomOf(r, SIDE_REACH.tiger!), SIDE_FEEL, "tiger")).toEqual({ s: 2, k: 1, bossMid: null, firstMid: null });
      expect(sideSizes({ ...roomOf(r, bosses.hollow), fixed: true }, SIDE_FEEL, "hollow")).toEqual({ s: 2, k: 1, bossMid: null, firstMid: null });
      // A raid's boss keeps his size and place (over its scoreboard's edge); the God King still grows.
      const raid = sideSizes({ ...roomOf(r, bosses.hollow), bossFixed: true }, SIDE_FEEL, "hollow");
      expect([raid.s, raid.bossMid]).toEqual([2, null]);
      expect(raid.k).toBeGreaterThanOrEqual(1.4);
    });
  it("where there's room the figures stand a small gap off the board, not over it", () => {
    const r = rooms["1920x1080"]!;
    const p = sideSizes({ ...roomOf(r, bosses.hollow), leftLimit: 0, rightLimit: 4000 }, SIDE_FEEL, "hollow");
    expect(p.s).toBe(SIDE_FEEL.max);
    expect(p.bossMid! + SIDE_REACH.hollow![2] * p.s).toBeCloseTo(r.left - SIDE_FEEL.gap, 0);
    expect(p.firstMid! - 57 * p.k).toBeCloseTo(r.left + r.board + SIDE_FEEL.gap, 0);
  });
});

describe("the cave's intro bubble (Eric, Nov 4: a name tag's size, far above his head)", () => {
  it("about three times the old 11 px on a computer, never smaller than it (a phone, the far camera), never past 32", () => {
    expect(bubbleSize(300).font).toBe(32);
    expect(bubbleSize(200).font).toBe(22);
    expect(bubbleSize(110).font).toBe(12);
    expect(bubbleSize(40).font).toBe(CHALLENGE_FEEL.bubble.min);
    expect(bubbleSize(200).s).toBe(2);
  });
  it("just over every intro boss's drawn head, not over his frame's head room", () => {
    for (const home of Object.keys(BOSS_INTROS) as HomeId[]) {
      const ch = BOSS_ART[home];
      if (!ch) continue;
      const idle = ch.anims.idle!.frames;
      const top = drawnTop(idle.map((f) => renderFrame(ch, f).data), ch.w, ch.h);
      // (His drawn head is in the frame's top half, and under the frame's top edge where the frame has head room.)
      expect(top, home).toBeGreaterThanOrEqual(0);
      expect(top, home).toBeLessThan(0.5);
      // The tail's tip just over it: a few px at his town size.
      const px = TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale[home] ?? 1) * 60;
      expect(bubbleSize(px).gap, home).toBeLessThanOrEqual(8);
    }
  });
});
