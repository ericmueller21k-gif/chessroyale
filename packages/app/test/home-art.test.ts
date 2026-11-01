import { describe, expect, it } from "vitest";
import { frameKeys, renderFrame } from "../src/characters/sprite.ts";
import { ARENA_AUTO_CARD } from "../src/home-art/arena-auto-card.ts";
import { ARENA_TOWN_BADGE } from "../src/home-art/arena-town-badge.ts";
import { sceneLayout } from "../src/home-art/layout.ts";
import { starsFor, townLook, type Sky } from "../src/home-art/looks.ts";
import { TOWN_PICTURES, pickSky, pickTownPicture, skyAt } from "../src/home-art/town.ts";

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

/**
 * Chess Town's three skies (Eric, Nov 1; docs/decisions/2026-11-01-chess-town-skies.md): by the device's clock, day 06:00 to 17:00, dusk
 * 17:00 to 19:00 (the picture as it was drawn), night 19:00 to 06:00 with the lights on. The looks are palette swaps of the same drawings.
 */
describe("which sky the clock gives", () => {
  // (Mid-June, so no clock change falls near these hours; the device's own local time, as the page reads it.)
  const at = (h: number, m: number) => new Date(2026, 5, 15, h, m);

  it("night until 05:59, day from 06:00 to 16:59, dusk from 17:00 to 18:59, night from 19:00", () => {
    expect(skyAt(at(5, 59))).toBe("night");
    expect(skyAt(at(6, 0))).toBe("day");
    expect(skyAt(at(16, 59))).toBe("day");
    expect(skyAt(at(17, 0))).toBe("dusk");
    expect(skyAt(at(18, 59))).toBe("dusk");
    expect(skyAt(at(19, 0))).toBe("night");
  });

  it("covers the whole day: midnight and 23:59 are night, noon is day, 18:00 is dusk", () => {
    expect(skyAt(at(0, 0))).toBe("night");
    expect(skyAt(at(23, 59))).toBe("night");
    expect(skyAt(at(12, 0))).toBe("day");
    expect(skyAt(at(18, 0))).toBe("dusk");
    const seen = new Set<Sky>();
    for (let h = 0; h < 24; h++) seen.add(skyAt(at(h, 30)));
    expect([...seen].sort()).toEqual(["day", "dusk", "night"]);
  });

  it("is forced by ?sky=day, dusk or night (either case), then ?night=1 (night) and ?night=0 (the picture as drawn); anything else is the clock", () => {
    const noon = at(12, 0);
    expect(pickSky("", noon)).toBe("day");
    expect(pickSky("?sky=night", noon)).toBe("night");
    expect(pickSky("?x=1&sky=Dusk", noon)).toBe("dusk");
    expect(pickSky("?sky=DAY", at(20, 0))).toBe("day");
    expect(pickSky("?night=1", noon)).toBe("night");
    expect(pickSky("?night=0", at(20, 0))).toBe("dusk");
    expect(pickSky("?sky=dusk&night=1", noon)).toBe("dusk");
    expect(pickSky("?sky=midnight", at(20, 0))).toBe("night");
    expect(pickSky("?sky=", noon)).toBe("day");
    expect(pickSky("?night=yes", noon)).toBe("day");
  });
});

describe("the looks keep every pixel of the drawing where it was", () => {
  const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
  /** The mean brightness of what a frame paints (see-through halo pixels left out). */
  const brightness = (ch: Parameters<typeof renderFrame>[0], fr: Parameters<typeof renderFrame>[1]) => {
    const { data } = renderFrame(ch, fr);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i + 3] === 255) {
        sum += luma(data[i]!, data[i + 1]!, data[i + 2]!);
        n++;
      }
    return sum / n;
  };

  for (const pic of ["A", "B"] as const) {
    const dusk = TOWN_PICTURES[pic].ch;

    it(`${pic}: dusk is the drawing itself, untouched`, () => {
      expect(townLook(dusk, "dusk")).toBe(dusk);
    });

    for (const sky of ["day", "night"] as const) {
      const look = townLook(dusk, sky);

      it(`${pic} at ${sky}: the same parts, layers and frames; only colors differ, and the night's loose pixels land on empty ones`, () => {
        expect(look.id).not.toBe(dusk.id);
        expect([look.w, look.h, look.foot]).toEqual([dusk.w, dusk.h, dusk.foot]);
        expect(look.parts).toBe(dusk.parts);
        const was = dusk.anims.idle!.frames;
        const now = look.anims.idle!.frames;
        expect(now.length).toBe(was.length);
        let extras = 0;
        now.forEach((fr, f) => {
          expect(fr.layers, `frame ${f}`).toBe(was[f]!.layers);
          expect(fr.ms).toBe(was[f]!.ms);
          const a = frameKeys(dusk, was[f]!);
          const b = frameKeys(look, fr);
          const ra = renderFrame(dusk, was[f]!).data;
          const rb = renderFrame(look, fr).data;
          for (let y = 0; y < dusk.h; y++)
            for (let x = 0; x < dusk.w; x++) {
              const i = (y * dusk.w + x) * 4;
              if (a[y]![x]) {
                expect(b[y]![x], `${sky} frame ${f} (${x}, ${y}): the same key`).toBe(a[y]![x]);
                expect(rb[i + 3]! > 0, `${sky} frame ${f} (${x}, ${y}): still painted`).toBe(ra[i + 3]! > 0);
              } else if (b[y]![x]) {
                extras++;
                expect(sky, `a loose pixel at (${x}, ${y}) in the ${sky} look`).toBe("night");
              }
            }
        });
        if (sky === "day") expect(extras).toBe(0);
        else expect(extras).toBeGreaterThan(0);
      });
    }

    it(`${pic}: the stars and the lamp's glow sit on pixels that are empty in every frame of the loop, so they never cover or get covered`, () => {
      const night = townLook(dusk, "night");
      const painted = dusk.anims.idle!.frames.map((fr) => frameKeys(dusk, fr));
      const loose = night.anims.idle!.frames.map((fr, f) => (fr.specks ?? []).filter((s) => !(dusk.anims.idle!.frames[f]!.specks ?? []).includes(s)));
      // The same loose pixels in every frame (nothing twinkles or drifts: they are fixed).
      for (const l of loose) expect(l).toEqual(loose[0]);
      for (const [x, y] of loose[0]!) for (const keys of painted) expect(keys[y]![x], `(${x}, ${y})`).toBeNull();
      const stars = starsFor(dusk);
      expect(stars.length).toBeGreaterThanOrEqual(8);
      expect(stars.length).toBeLessThanOrEqual(14);
      expect(starsFor(dusk), "the same stars every time").toEqual(stars);
    });

    it(`${pic}: day is lighter than dusk and night much darker, the outline stays the darkest color`, () => {
      const day = townLook(dusk, "day");
      const night = townLook(dusk, "night");
      for (let f = 0; f < dusk.anims.idle!.frames.length; f++) {
        const d = brightness(dusk, dusk.anims.idle!.frames[f]!);
        expect(brightness(day, day.anims.idle!.frames[f]!), `day frame ${f}`).toBeGreaterThan(d);
        expect(brightness(night, night.anims.idle!.frames[f]!), `night frame ${f}`).toBeLessThan(d * 0.6);
      }
      expect(night.palette.k).not.toBe(dusk.palette.k);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(night.palette.k!.slice(i, i + 2), 16)) as [number, number, number];
      expect(luma(r, g, b)).toBeLessThan(25);
    });
  }

  it("night: every window is lit warm yellow in every frame (the loop only turns some down); day: the windows are unlit blue glass", () => {
    const warm = (c: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
      return r >= 160 && r > g && g > b && r - b >= 60;
    };
    const cool = (c: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
      return b > r && b > 150;
    };
    const skyline = TOWN_PICTURES.A.ch;
    const square = TOWN_PICTURES.B.ch;
    const night = townLook(skyline, "night");
    const day = townLook(skyline, "day");
    night.anims.idle!.frames.forEach((fr, f) => {
      for (const k of ["0", "1", "2", "3", "4"]) expect(warm(fr.pal?.[k] ?? night.palette[k]!), `night skyline frame ${f} window ${k}`).toBe(true);
    });
    day.anims.idle!.frames.forEach((fr, f) => {
      for (const k of ["0", "1", "2", "3", "4"]) expect(cool(fr.pal?.[k] ?? day.palette[k]!), `day skyline frame ${f} window ${k}`).toBe(true);
    });
    const nightSquare = townLook(square, "night");
    for (const k of ["a", "e", "y", "Y"]) expect(warm(nightSquare.palette[k]!), `night square ${k}`).toBe(true);
    // The loop still reads as the same loop: the windows the drawing switches between two colors still switch, in night and day.
    const colors = (ch: typeof night, k: string) => new Set(ch.anims.idle!.frames.map((fr) => fr.pal?.[k] ?? ch.palette[k]));
    expect(colors(night, "2").size).toBe(2);
    expect(colors(day, "2").size).toBe(2);
  });
});
