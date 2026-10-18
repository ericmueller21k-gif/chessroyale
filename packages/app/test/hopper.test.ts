import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, HOPPER_NAME, isPlayable, type PowerEvent } from "@chessroyale/core";
import { POWER_FX } from "@chessroyale/chess";
import { momentsOf } from "../src/components/BossPowers.tsx";
import { CAST_LINE, HOPPER_UI } from "../src/components/Hopper.tsx";
import { noMoveLine } from "../src/components/BossPowers.tsx";
import { bossKit } from "../src/characters/kits.ts";
import { POWER_WORDS, powersLine } from "../src/power-words.ts";
import type { BossView } from "../src/game.ts";

/**
 * Chub & Chirp (id hopper) on screen before their art (a later build): the rules' state comes in the boss view, the hop's
 * moment holds its time and draws nothing yet, and nothing breaks on the way (docs/decisions/2026-10-18-hopper-leapfrog.md).
 */
const view = (events: PowerEvent[], powers: Record<string, unknown> = {}, crowdMoves = 4): BossView =>
  ({ id: "hopper", name: HOPPER_NAME, crowdSide: "w", crowdMoves, board: { fen: "", history: [] }, powers: { events, turn: 4, ...powers } }) as unknown as BossView;

describe("Chub & Chirp before their art", () => {
  it("have no character kit yet (so they're hidden from players), their name, and their power words for when they ship", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "hopper")!;
    expect(def.name).toBe("Chub & Chirp");
    expect(isPlayable(def)).toBe(false);
    expect(bossKit(def.name)).toBeNull();
    expect(powersLine(def)).toBe("hops pawns over yours · Carrot Patch");
    expect(HOPPER_UI.ultimate.name).toBe("Carrot Patch");
  });

  it("the hop at the start of his turn plays on a screen of its own (before his move), for its full time, and draws nothing yet", () => {
    const hop = { at: 4, from: "e5", over: "e4", to: "e3" };
    const list = momentsOf(view([{ kind: "hop", turn: 4, square: "e3", squares: ["e5", "e4", "e3"] }], { hop }), 10_000);
    expect(list.map((m) => [m.kind, m.ms, m.square, m.squares])).toEqual([["hop", POWER_FX.hop, "e3", ["e5", "e4", "e3"]]]);
    expect(list[0]!.at).toBe(10_000 - POWER_FX.hop);
    // (After his move, a new turn's events: no hop there, so it doesn't play again.)
    expect(momentsOf(view([], { hop }, 5), 10_000)).toEqual([]);
    expect(HOPPER_UI.moments.hop.view({} as never)).toBeNull();
  });

  it("the Carrot Patch's moments come as a crowd turn begins, each for its full time (the cast, his move's carrot, his spin, his last carrot), drawing nothing yet", () => {
    const carrots = { at: 4, squares: ["a5", "c3", "h5", "e6", "g2"], by: [null, null, null, null, null], crowd: 0, boss: 0, crowdLeft: 12, bossLeft: 12, over: null, tier: 0, spin: null };
    const cast = momentsOf(view([{ kind: "carrots", turn: 5, squares: carrots.squares }], { carrots }, 4), 10_000);
    expect(cast.map((m) => [m.kind, m.ms, m.squares])).toEqual([["carrots", POWER_FX.carrots, carrots.squares]]);
    const spin = { kind: "carrotSpin" as const, turn: 9, tier: 3, prize: ["r"], squares: ["d8"] };
    const list = momentsOf(view([{ kind: "carrot", turn: 9, square: "e6", by: "boss" }, spin, { kind: "carrotWin", turn: 9, square: "e6" }], { carrots }, 8), 20_000);
    expect(list.map((m) => [m.kind, m.ms])).toEqual([
      ["carrot", POWER_FX.carrot],
      ["carrotSpin", POWER_FX.carrotSpin],
      ["carrotWin", POWER_FX.carrotWin],
    ]);
    expect(list[1]).toMatchObject({ tier: 3, prize: ["r"], squares: ["d8"] });
    expect(list.at(-1)!.at + list.at(-1)!.ms).toBe(20_000);
    // (A carrot each side pulled in one turn: two moments, two keys.)
    const two = momentsOf(view([{ kind: "carrot", turn: 9, square: "e6", by: "crowd" }, { kind: "carrot", turn: 9, square: "a5", by: "boss" }], { carrots }, 8), 20_000);
    expect(new Set(two.map((m) => m.key)).size).toBe(2);
    for (const k of ["carrots", "carrot", "carrotSpin", "carrotWin"] as const) expect(HOPPER_UI.moments[k].view({} as never)).toBeNull();
  });

  it("the dock's line for the cast (his whole turn: no move to show), only on that turn", () => {
    const carrots = { at: 4, squares: ["a5"], by: [null], crowd: 0, boss: 0, crowdLeft: 12, bossLeft: 12, over: null, tier: 0, spin: null };
    expect(noMoveLine({ ...view([], { carrots }, 4), lastMove: null } as BossView)).toBe(CAST_LINE);
    expect(CAST_LINE).toBe("Chub & Chirp spent their turn planting carrots.");
    expect(noMoveLine({ ...view([], { carrots }, 5), lastMove: null } as BossView)).toBeNull();
  });

  it("an older server's view (no `hop` field) shows nothing new and breaks nothing", () => {
    expect(momentsOf(view([{ kind: "pie", turn: 4, square: "d4" }]), 10_000).map((m) => m.kind)).toEqual(["pie"]);
  });
});
