import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SIDE_FEEL, SIDE_REACH, sideSizes, type SideRoom } from "../src/characters/side-size.ts";
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
  it("SIDE_REACH is every boss's drawing's reach from its feet, at rest and where each beat ends (its loops' frames, each animation's last)", () => {
    for (const kit of Object.values(BOSS_KITS)) {
      const ch = kit.ch;
      let x0 = Infinity;
      let y0 = Infinity;
      for (const a of Object.values(ch.anims))
        for (const f of a.loop ? a.frames : a.frames.slice(-1)) {
          const { w, h, data } = renderFrame(ch, f);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++)
              if (data[(y * w + x) * 4 + 3]! > 0) {
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
              }
        }
      expect(SIDE_REACH[ch.id], ch.id).toEqual([ch.foot[0] - x0, ch.foot[1] - y0]);
    }
  });
  // The rooms measured on main at 2× (scripts/stills-battle-desktop.mjs sides): the board, Hollow's and Folio's drawings (Folio's reaches
  // furthest left), the God King's box, the empty column's left edge (90 px at 1280 and 1440, 256 at 1920, 242 at 2000).
  const rooms: Record<string, Omit<SideRoom, "bossLeft" | "bossTop">> = {
    "1280x800": { board: 600, boardLeft: 346, boardRight: 946, boardBottom: 663, leftLimit: 90, winW: 1280, s: 2, k: 1, kingRight: 1228 },
    "1440x900": { board: 760, boardLeft: 346, boardRight: 1106, boardBottom: 823, leftLimit: 90, winW: 1440, s: 2, k: 1, kingRight: 1388 },
    "1920x1080": { board: 952, boardLeft: 536, boardRight: 1488, boardBottom: 1015, leftLimit: 256, winW: 1920, s: 2, k: 1, kingRight: 1770 },
    "2000x1250": { board: 1120, boardLeft: 522, boardRight: 1642, boardBottom: 1183, leftLimit: 242, winW: 2000, s: 2, k: 1, kingRight: 1924 },
  };
  const reach = { hollow: [132, 156], folio: [188, 160], recluse: [130, 264] } as const;
  for (const [size, r] of Object.entries(rooms))
    it(`${size}: bigger where there's room, never past it or the window's top, never smaller than before`, () => {
      for (const [id, [left, up]] of Object.entries(reach)) {
        const { s, k } = sideSizes({ ...r, bossLeft: r.boardLeft - left, bossTop: r.boardBottom - up }, SIDE_FEEL, id);
        expect(s, `${id}`).toBeGreaterThan(2);
        expect(s).toBeLessThanOrEqual(SIDE_FEEL.max);
        expect(r.boardLeft - (left / 2) * s, `${id}: his drawing in his room`).toBeGreaterThanOrEqual(r.leftLimit + SIDE_FEEL.margin - 0.01);
        expect(r.boardBottom - (up / 2) * s, `${id}: under the window's top`).toBeGreaterThanOrEqual(SIDE_FEEL.margin - 0.01);
        expect(k, "the God King no smaller").toBeGreaterThanOrEqual(1);
        expect(r.boardRight + (r.kingRight - r.boardRight) * k, "the God King inside the window").toBeLessThanOrEqual(r.winW - SIDE_FEEL.margin + 0.01);
      }
      // Babur keeps his size (his pump's room beside him).
      expect(sideSizes({ ...r, bossLeft: r.boardLeft - 144, bossTop: r.boardBottom - 146 }, SIDE_FEEL, "tiger").s).toBe(2);
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
