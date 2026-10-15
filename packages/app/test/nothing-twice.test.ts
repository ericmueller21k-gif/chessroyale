import { describe, expect, it } from "vitest";
import { RECLUSE_PHASE2, type PowerEventKind } from "@chessroyale/core";
import { dockLine } from "../src/components/BossPowers.tsx";
import { SPIN_LINES } from "../src/components/Boingo.tsx";
import { GINGER_LINES } from "../src/characters/gingerbread.ts";
import { GREX_LINES } from "../src/characters/grex.ts";
import { PIG_LINES } from "../src/characters/pig.ts";
import { BIGBOY_LINES } from "../src/characters/bigboy.ts";
import { RECLUSE_LINES } from "../src/characters/recluse-lines.ts";
import { DESK } from "../src/screens/Recluse2.tsx";

/**
 * Nothing said twice at once during a boss's power (DECISIONS.md, "Nothing said twice"): the banner names the power, the
 * dock says what it means for you (only where no banner says it), the boss's bubble is his character, never the power's
 * name.
 */
describe("a power's words: banner, dock and bubble each say their own", () => {
  // Every moment whose banner names it and says what it does (its line under the name), or that has words of its own.
  const BANNERED: PowerEventKind[] = ["warn", "freeze", "blizzard", "thaw", "pie", "funhouse", "spin", "spark", "candle", "dark", "extra", "block", "split", "cut", "boardsaw", "pull", "drag", "showdown", "bullet", "bulletPlus"];

  it("the dock keeps the turn's own line through a moment its banner (or the board) says", () => {
    for (const kind of BANNERED) expect(dockLine({ kind }), kind).toBeNull();
  });

  it("the dock says what it means for you where no banner does", () => {
    // (The Big Bounce's banner is its name alone; the fireballs and the fireproof laugh have none.)
    expect(dockLine({ kind: "bounce" })).toBe("Your pieces land on new squares.");
    expect(dockLine({ kind: "fireball", squares: ["e4", "f5", "g2"], fizzled: ["g2"] })).toBe("Fire on e4 and f5");
    expect(dockLine({ kind: "fireball", squares: ["e4", "f5", "g2"] })).toBe("Fire on 3 squares");
    expect(dockLine({ kind: "fireball", squares: ["g1"], fizzled: ["g1"] })).toBe("Your king is fireproof.");
    expect(dockLine({ kind: "fireproof" })).toBe("Fire burns only your pieces.");
    // (Never the power's name.)
    for (const kind of ["bounce", "fireball", "fireproof"] as const) expect(dockLine({ kind, squares: ["e4"] }) ?? "", kind).not.toMatch(/bounce|fireball|fireproof!/i);
  });

  it("a boss's bubble never says the power's name (Eric's own lines kept)", () => {
    const has = (lines: readonly string[] | undefined, word: RegExp) => (lines ?? []).filter((l) => word.test(l));
    expect(has(GINGER_LINES.power, /freeze/i)).toEqual([]);
    expect(has(GINGER_LINES.ultimate, /blizzard/i)).toEqual([]);
    expect(has(GREX_LINES.ultimate, /roman candle/i)).toEqual([]);
    expect(has(PIG_LINES.pull, /long pull/i)).toEqual([]);
    expect(has(PIG_LINES.ultimate, /duel|showdown/i)).toEqual([]);
    expect(has(SPIN_LINES, /spin/i)).toEqual([]);
    expect(has(BIGBOY_LINES.ultimateWarn, /bounce/i)).toEqual([]);
    // (Eric's "Big boy BOUNCE!" stays: his line, Oct 10.)
    expect(BIGBOY_LINES.ultimate).toContain("Big boy BOUNCE!");
    // The Hidden Boss's phase 2 ultimate: the banner says the seconds (from the setting), the dock what they mean.
    for (const l of RECLUSE_LINES.ult2) expect(l).not.toMatch(/\d|seconds|five/i);
    expect(RECLUSE_PHASE2.ultMoveSeconds).toBeGreaterThan(0);
  });
});

describe("the Hidden Boss's phase 2 on a computer: a tag's row above each board", () => {
  it("fits two boards and two rows in the square's height, with a gap between them", () => {
    const cross = 100 - 2 * DESK.tag - 2 * DESK.cell * 100;
    expect(cross).toBeGreaterThan(1);
    // (Between the columns: the rest of the width, room for the slow moves beside your board.)
    expect(100 - 2 * DESK.cell * 100).toBeGreaterThan(cross);
  });
});
