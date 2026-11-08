import { describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { BOSS_KITS } from "../src/characters/kits.ts";
import { GOODBYE_LINES } from "../src/characters/boss-select.ts";

/**
 * Eric, Nov 7: every boss says a line on the result screen (its victory when it wins, its defeat when you do) and one goodbye
 * in the town after a battle it fought there. Each fits the speech bubble's two rows (about 30 characters a row).
 */
const MAX_CHARS = 60;
const EMOJI = /\p{Extended_Pictographic}/u;

// The bosses with a character: the roster entries whose kit is in BOSS_KITS.
const bosses = BOSS_ROSTER.filter((b) => b.kit && BOSS_KITS[b.kit]).map((b) => ({ id: b.id, name: b.name, kit: BOSS_KITS[b.kit!]! }));

describe("boss result lines and town goodbyes (Eric, Nov 7)", () => {
  it("every boss with a character is in the roster's kit list", () => {
    expect(bosses.length).toBe(Object.keys(BOSS_KITS).length);
  });

  for (const b of bosses) {
    it(`${b.name}: at least 2 victory and 2 defeat result lines, each within the bubble, and one goodbye`, () => {
      const victory = b.kit.lines.victory ?? [];
      // (The Hidden Boss has no defeat line of his own: beaten, he mumbles his fall lines on the result screen.)
      const defeat = b.kit.lines.defeat ?? b.kit.fall ?? [];
      expect(victory.length, "victory lines").toBeGreaterThanOrEqual(2);
      expect(defeat.length, "defeat lines").toBeGreaterThanOrEqual(2);
      for (const line of [...victory, ...defeat]) {
        expect(line.length, line).toBeLessThanOrEqual(MAX_CHARS);
        expect(EMOJI.test(line), `no emoji: ${line}`).toBe(false);
      }
      // The line is always said: its chance is 1 for each result moment.
      expect(b.kit.chance.victory ?? 0, "victory chance").toBe(1);
      if (b.kit.lines.defeat) expect(b.kit.chance.defeat ?? 0, "defeat chance").toBe(1);
      const bye = GOODBYE_LINES[b.id];
      expect(bye, "goodbye").toBeTruthy();
      expect(bye!.length, bye).toBeLessThanOrEqual(MAX_CHARS);
      expect(EMOJI.test(bye!), `no emoji: ${bye}`).toBe(false);
    });
  }
});
