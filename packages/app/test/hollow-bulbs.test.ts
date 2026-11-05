import { describe, expect, it } from "vitest";
import { HOLLOW_LINES } from "../src/characters/hollow.ts";
import { EFFECTS } from "../src/characters/power-art.ts";
import { BLACKOUT, DARK_FORCED, HOLLOW_BULB_LINES, blockBanner, nextTaunt } from "../src/components/Hollow.tsx";

/**
 * Hollow's taunts on a misplay, Boss alone's ten bulbs on screen and his blocks' banners (Eric, Nov 5, 2026;
 * docs/decisions/2026-11-05-hollow-bulbs.md).
 */
describe("his taunts on a misplay (Eric, Nov 5)", () => {
  const lines = HOLLOW_LINES.misplay!;

  it("Eric's two and six more of his, no emoji, no real people", () => {
    expect(lines).toHaveLength(8);
    expect(lines).toContain("Nice try.");
    expect(lines).toContain("What, can't play in the dark?");
    expect(new Set(lines).size).toBe(lines.length);
    for (const l of lines) expect(l).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("at random, never the same twice running", () => {
    let last: string | null = null;
    const seen = new Set<string>();
    let seed = 7;
    for (let i = 0; i < 2000; i++) {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      const t = nextTaunt(lines, last, seed / 2 ** 31)!;
      expect(t).not.toBe(last);
      seen.add(t);
      last = t;
    }
    // Every one of them comes up.
    expect(seen.size).toBe(lines.length);
    // Even at the ends of the draw.
    expect(nextTaunt(lines, lines[0]!, 0)).toBe(lines[1]);
    expect(nextTaunt(lines, lines.at(-1)!, 0.99999)).toBe(lines.at(-2));
    expect(nextTaunt(["only"], "only", 0.5)).toBe("only");
    expect(nextTaunt([], null, 0.5)).toBeNull();
  });
});

describe("Boss alone's ten bulbs on screen", () => {
  const strand = EFFECTS.lifeStrand;

  it("his strand of ten, lit for each wrong move left: lit10 … lit0, and a bulb going out (its fizz) ending one fewer", () => {
    expect(strand.ch.w).toBe(95);
    for (let n = 0; n <= 10; n++) expect(strand.ch.anims[`lit${n}`]).toBeDefined();
    for (let n = 1; n <= 10; n++) {
      const out = strand.ch.anims[`out${n}`]!;
      expect(out.loop).toBe(false);
      expect(out.frames[0]!.cue).toBe("fizz");
      // Ends with one fewer lit: the last frame's lit bulbs.
      const lit = out.frames.at(-1)!.layers.filter((l) => /^on\d$/.test(l.part)).length;
      expect(lit).toBe(n - 1);
    }
    expect(strand.sounds.fizz).toBe("hollowFizz");
    // Every frame draws all ten (lit or out) on the wire.
    for (const a of Object.values(strand.ch.anims)) for (const f of a.frames) expect(f.layers.filter((l) => /^(on|off)\d$/.test(l.part))).toHaveLength(10);
  });

  it("the dark's move and the blackout: his lines, and the blackout long enough to read them", () => {
    expect(HOLLOW_BULB_LINES.forced).toBe("The dark moves for you.");
    expect(HOLLOW_BULB_LINES.blackout).toBe("Lights out. Forever.");
    expect(DARK_FORCED.ms).toBeGreaterThanOrEqual(DARK_FORCED.flashMs);
    expect(BLACKOUT.ms).toBeGreaterThan(BLACKOUT.whyAt + 1500);
    expect(BLACKOUT.lineAt).toBeGreaterThanOrEqual(BLACKOUT.fadeMs);
  });

  it("the blocks' banners", () => {
    expect(blockBanner(2)).toEqual(["DEEPER DARK!", "2×2 dark for 4 turns"]);
    expect(blockBanner(3)).toEqual(["PITCH BLACK!", "3×3 dark for 2 turns"]);
  });
});
