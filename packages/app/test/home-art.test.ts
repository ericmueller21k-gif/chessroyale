import { describe, expect, it } from "vitest";
import { renderFrame } from "../src/characters/sprite.ts";
import { ARENA_AUTO_CARD } from "../src/home-art/arena-auto-card.ts";
import { ARENA_TOWN_BADGE } from "../src/home-art/arena-town-badge.ts";
import { sceneLayout } from "../src/home-art/layout.ts";
import { TOWN_PICTURES, pickTownPicture } from "../src/home-art/town.ts";

/**
 * Home's pictures (Eric, Oct 31 and Nov 1; docs/areas/hub.md): Chess Town's button has one of two scenes, picked 50/50 as the page
 * loads, filling the button at a whole-pixel scale with the ground running to its edges; the crest and the Auto chess army are
 * drawn from the same idle loops.
 */

describe("which scene Chess Town's button shows", () => {
  it("is A (the skyline) or B (the square), a fair coin: the lower half of the draws is A, the upper half B", () => {
    expect(pickTownPicture("", () => 0).id).toBe("A");
    expect(pickTownPicture("", () => 0.499).id).toBe("A");
    expect(pickTownPicture("", () => 0.5).id).toBe("B");
    expect(pickTownPicture("", () => 0.999).id).toBe("B");
  });

  it("is forced by ?town=A or ?town=B (either case) and a draw is ignored; anything else is the coin", () => {
    expect(pickTownPicture("?town=A", () => 0.9).id).toBe("A");
    expect(pickTownPicture("?x=1&town=B", () => 0.1).id).toBe("B");
    expect(pickTownPicture("?town=b", () => 0.1).id).toBe("B");
    expect(pickTownPicture("?town=C", () => 0.1).id).toBe("A");
    expect(pickTownPicture("?town=", () => 0.9).id).toBe("B");
  });

  it("keeps its 50/50 over a thousand loads", () => {
    let a = 0;
    for (let i = 0; i < 1000; i++) if (pickTownPicture("", () => (i + 0.5) / 1000).id === "A") a++;
    expect(a).toBe(500);
  });
});

describe("how a scene sits in its box (whole device pixels, sized to the height)", () => {
  const skyline = TOWN_PICTURES.A;
  const square = TOWN_PICTURES.B;
  const art = (p: typeof skyline) => ({ w: p.ch.w, h: p.ch.h });

  it("a phone (342 × 97 css px at 3×): 3 css px an art pixel (9 device px); the square loses its plain last rows, the skyline fits whole; a few pixels of ground fill each side", () => {
    const box = { w: 342 * 3, h: 97 * 3 };
    expect(sceneLayout(art(square), box, 3, square.dropBottom)).toEqual({ d: 9, x: 9, y: 291 - 33 * 9, drop: 3, sides: "ground" });
    expect(sceneLayout(art(skyline), box, 3, skyline.dropBottom)).toEqual({ d: 9, x: 9, y: 291 - 32 * 9, drop: 0, sides: "ground" });
  });

  it("a computer (360 × 76 at 1×): 2 px an art pixel, the whole picture in the box, its ends repeated to fill the width", () => {
    const box = { w: 360, h: 76 };
    expect(sceneLayout(art(square), box, 1, square.dropBottom)).toEqual({ d: 2, x: 68, y: 4, drop: 0, sides: "repeat" });
    expect(sceneLayout(art(skyline), box, 1, skyline.dropBottom)).toEqual({ d: 2, x: 68, y: 12, drop: 0, sides: "repeat" });
  });

  it("a short laptop (PLAY 60 px tall): the square's last 3 rows are cut to keep the scale", () => {
    expect(sceneLayout(art(square), { w: 360, h: 60 }, 1, square.dropBottom)).toMatchObject({ d: 2, drop: 3, y: 60 - 33 * 2 });
  });

  it("a 320 px phone (272 px wide): the picture is wider than the box and both ends are cut evenly", () => {
    const l = sceneLayout(art(square), { w: 272 * 3, h: 97 * 3 }, 3, square.dropBottom);
    expect(l.sides).toBe("none");
    expect(l.x).toBe(Math.floor((272 * 3 - 112 * 9) / 2));
  });

  it("an art pixel is always a whole number of device pixels, at every screen density, and never below one", () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3, 3.5])
      for (const h of [60, 76, 97])
        for (const p of [skyline, square]) {
          const l = sceneLayout(art(p), { w: 360 * dpr, h: h * dpr }, dpr, p.dropBottom);
          expect(Number.isInteger(l.d) && l.d >= 1, `${dpr}×, ${h} px: ${l.d}`).toBe(true);
        }
  });
});

describe("the drawings", () => {
  it("each has an idle loop of drawn frames that are not blank, at the size it says", () => {
    for (const ch of [TOWN_PICTURES.A.ch, TOWN_PICTURES.B.ch, ARENA_TOWN_BADGE, ARENA_AUTO_CARD]) {
      const frames = ch.anims.idle!.frames;
      expect(frames.length, ch.id).toBeGreaterThan(1);
      for (const fr of frames) {
        const { w, h, data } = renderFrame(ch, fr);
        expect([w, h], ch.id).toEqual([ch.w, ch.h]);
        expect(
          data.some((v, i) => i % 4 === 3 && v > 0),
          ch.id,
        ).toBe(true);
        expect(fr.ms, ch.id).toBeGreaterThan(0);
      }
    }
  });

  it("the two scenes are the same size across (112 art pixels) so either fills the button the same way", () => {
    expect(TOWN_PICTURES.A.ch.w).toBe(112);
    expect(TOWN_PICTURES.B.ch.w).toBe(112);
  });
});
