import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { BOSS_KITS } from "../src/characters/kits.ts";

/**
 * Every boss's line fits the boss bar's bubble in two rows at 320 px (Eric and the coordinator, Nov 6: the bar stays 99 px, the
 * board where it was, so a line is shortened rather than clamped). The bubble at 320 px: the name column's room (211 px), less its
 * frame (padding 10 px each side, border 3 px each side): 185 px of text. Press Start 2P is monospace: every character is one
 * 9 px advance (the speech font, styles.css .bc-bubble). So a row holds 20 characters; words wrap whole, as the browser wraps them.
 * e2e/boss-bar-same.spec.ts measures the rows the page draws, at every width, against the same rule.
 */
const CHARS_PER_ROW_320 = 20;

/** The rows a line takes when its words wrap whole at `perRow` characters (a word longer than a row takes a row of its own). */
export function rowsOf(text: string, perRow = CHARS_PER_ROW_320): number {
  let rows = 1;
  let len = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (len === 0) len = word.length;
    else if (len + 1 + word.length <= perRow) len += 1 + word.length;
    else {
      rows++;
      len = word.length;
    }
  }
  return rows;
}

/** Every line a playable-or-not boss has in the bar: its kit's lines and its fall. */
export function barLines(): { boss: string; text: string }[] {
  const out: { boss: string; text: string }[] = [];
  for (const def of BOSS_ROSTER) {
    if (!def.kit) continue;
    const k = BOSS_KITS[def.kit];
    if (!k) continue;
    const all = [...Object.values(k.lines).flatMap((v) => [...(v ?? [])]), ...(k.fall ?? [])];
    // (An icon, Moo's {heart}, is one character: it draws one picture the width of a letter, speech-icons.ts.)
    for (const text of new Set(all)) out.push({ boss: def.name, text: text.replace(/\{\w+\}/g, "x") });
  }
  return out;
}

describe("the boss bar's lines fit two rows at 320 px", () => {
  it("counts a row as 20 characters, words whole", () => {
    expect(rowsOf("one two three")).toBe(1);
    expect(rowsOf("aaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbb")).toBe(2);
    expect(rowsOf("aaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbb cccc")).toBe(3);
  });

  it("every boss line is two rows or fewer", () => {
    const long = barLines().filter((l) => rowsOf(l.text) > 2);
    expect(long.map((l) => `${l.boss}: "${l.text}" (${rowsOf(l.text)} rows)`)).toEqual([]);
  });
});
