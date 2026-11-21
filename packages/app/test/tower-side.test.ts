import { describe, expect, it } from "vitest";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
import { REFUSED, REFUSED_OTHER, refusedLine } from "../src/refused.ts";
import { moverOf, onSide, partOf, partsOf, plyMoverOf, sideOf } from "../src/boss-side.ts";
import { speakerOf } from "../src/screens/TowerBar.tsx";
import type { BossView } from "../src/game.ts";
import { KIT_OPENING, runBattle } from "../../chess/test/boss-kit-lib.ts";

/**
 * Audit 2's finding 1 (docs/decisions/2026-11-19-battle-tower-audit-2.md): on a floor of several bosses the screens draw each boss from
 * his own part of the view (boss-side.ts), the refusal's words ask every boss on the side, and a line shows by the boss who says it.
 */

const board = { fen: START_FEN, history: [], bases: [], ply: 0 } as unknown as BossView["board"];
// (Ginger to move, the view's top level hers; Sawyer's cut a3-a4 is in his own part only.)
const ginger = { id: "gingerbread", name: "Ginger", crowdSide: "w", powers: { turn: 3, iced: [] } };
const sawyer = { id: "sawyer", name: "Sawyer", crowdSide: "w", powers: { turn: 3, iced: [], cut: { a: "a3", b: "a4", at: 3, until: 4 } } };
const floor = { ...ginger, board, side: { bosses: [ginger, sawyer], toMove: 0, moved: 1, movers: [-1, 0, -1, 1, -1, 0] } } as unknown as BossView;
const alone = { ...ginger, board } as unknown as BossView;

describe("a floor of several bosses, each from his own part (audit 2, finding 1)", () => {
  it("the refusal's words ask every boss on the side: Sawyer's cut on Ginger's turn says so", () => {
    expect(refusedLine(floor, START_FEN, "a2a4")).toBe(REFUSED.cut);
    // (Before: only the boss in focus was asked, and the catch-all answered.)
    expect(refusedLine({ ...floor, side: undefined }, START_FEN, "a2a4")).toBe(REFUSED_OTHER);
    expect(refusedLine(alone, START_FEN, "a2a4")).toBe(REFUSED_OTHER);
  });

  it("each boss's own part, with the battle's board; one boss is himself", () => {
    expect(partsOf(floor).map((b) => b.id)).toEqual(["gingerbread", "sawyer"]);
    expect(partsOf(floor).every((b) => b.board === board)).toBe(true);
    expect(partOf(floor, "sawyer").powers?.cut).toEqual(sawyer.powers.cut);
    expect(partOf(floor, "clown")).toBe(floor);
    expect(partsOf(alone)).toEqual([alone]);
    expect(sideOf(alone)).toBeNull();
    expect(onSide(floor, (b) => b.powers?.cut)).toEqual(sawyer.powers.cut);
    // (One view, one side: the screens ask many times a frame.)
    expect(sideOf(floor)).toBe(sideOf(floor));
  });

  it("who made each of the side's moves (the move list's faces), and the last (the dock's plays line)", () => {
    expect(plyMoverOf(floor, 1).id).toBe("gingerbread");
    expect(plyMoverOf(floor, 3).id).toBe("sawyer");
    expect(plyMoverOf(floor, 5).id).toBe("gingerbread");
    // (A ply the view hasn't noted, an older game's: the last to move.)
    expect(plyMoverOf(floor, 7).id).toBe("sawyer");
    expect(moverOf(floor).id).toBe("sawyer");
    expect(plyMoverOf(alone, 1)).toBe(alone);
  });

  it("a line shows by the boss who says it: a moment's, keyed by his id, by his own part; any other by the boss to move", () => {
    const side = sideOf(floor)!;
    expect(speakerOf(side, "sawyer:1:sawyer:cut:3")).toBe(1);
    expect(speakerOf(side, "gingerbread:1:gingerbread:freeze:3")).toBe(0);
    expect(speakerOf(side, "test:123:Hello")).toBe(0);
  });
});

describe("Hollow's dark on a shared floor (Nov 21, beside Smudgy's mask: docs/decisions/2026-11-21-smudgy-shared-mask.md)", () => {
  // (The screens draw the board layer of every part (Play, Boss, and the reveal since Nov 21: Crowd.tsx), so his dark covers its
  // squares on every turn, not only while he's in focus. His part carries it whoever is.)
  for (const [bosses, seed] of [[["gingerbread", "hollow"], 11], [["hollow", "gingerbread", "moo"], 11]] as const) {
    it(`${bosses.join(" + ")}: his part has the dark on every turn, his, the others', the crowd's`, async () => {
      const away: string[] = [];
      await runBattle({ boss: bosses[0], bosses, seed, side: "w", test: "", triggerFrom: 99, strikes: [], maxMoves: 30, opening: KIT_OPENING }, null, (r, _fen, who) => {
        const truth = (r.sideBosses().find((b) => b.id === "hollow")!.powers!.dark ?? []).map((d) => d.square);
        const view = JSON.parse(JSON.stringify(r.bossView())) as BossView;
        const at = `${who === "crowd" ? `the crowd (next: ${view.id})` : `${view.id}'s turn`} at crowd move ${view.crowdMoves}`;
        expect((partOf(view, "hollow").powers?.dark ?? []).map((d) => d.square), at).toEqual(truth);
        expect(partsOf(view).some((b) => b.id === "hollow" && (b.powers?.dark ?? []).length === truth.length), at).toBe(true);
        if (truth.length && view.id !== "hollow") away.push(at);
      });
      // (The dark stood while another boss was in focus: where the view's top level alone would have dropped it.)
      expect(away.length).toBeGreaterThan(2);
    }, 120_000);
  }
});
