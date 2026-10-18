import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, HOPPER_NAME, isPlayable, type PowerEvent } from "@chessroyale/core";
import { POWER_FX } from "@chessroyale/chess";
import { momentsOf } from "../src/components/BossPowers.tsx";
import { HOPPER_UI } from "../src/components/Hopper.tsx";
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
    expect(powersLine(def)).toBe("hops pawns over yours · ultimate to come");
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

  it("an older server's view (no `hop` field) shows nothing new and breaks nothing", () => {
    expect(momentsOf(view([{ kind: "pie", turn: 4, square: "d4" }]), 10_000).map((m) => m.kind)).toEqual(["pie"]);
  });
});
