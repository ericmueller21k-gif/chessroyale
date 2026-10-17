import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, isPlayable, type PowerEvent } from "@chessroyale/core";
import { POWER_FX } from "@chessroyale/chess";
import { momentsOf } from "../src/components/BossPowers.tsx";
import { ALFIL_UI } from "../src/components/Alfil.tsx";
import { bossKit } from "../src/characters/kits.ts";
import { POWER_WORDS, powersLine } from "../src/power-words.ts";
import type { BossView } from "../src/game.ts";

/**
 * Alfil on screen before his art (a later build): his rules' state comes in the boss view, his moments hold their time
 * and draw nothing yet, and nothing breaks on the way (docs/decisions/2026-10-17-alfil-rules.md).
 */
const view = (events: PowerEvent[], powers: Record<string, unknown> = {}, id = "alfil", crowdMoves = 4): BossView =>
  ({ id, name: "Alfil", crowdSide: "w", crowdMoves, board: { fen: "", history: [] }, powers: { events, turn: 4, ...powers } }) as unknown as BossView;

describe("Alfil before his art", () => {
  it("has no character kit yet (so he's hidden from players), and his power words for when he ships", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "alfil")!;
    expect(isPlayable(def)).toBe(false);
    expect(bossKit(def.name)).toBeNull();
    expect(powersLine(def)).toBe(`${POWER_WORDS.tusks} · ${POWER_WORDS.slam}`);
  });

  it("each step at the start of his turn plays on a screen of its own, the last one only; the landing with the crowd turn's", () => {
    const cast = momentsOf(view([{ kind: "warn", turn: 4 }, { kind: "tusks", turn: 4, squares: ["a7", "b7"] }], { tusks: { turn: 4, at: 4, pawns: ["a7", "b7"] } }), 10_000);
    expect(cast.map((m) => [m.kind, m.ms])).toEqual([["tusks", POWER_FX.tusks]]);
    // A cast, then the Slam on the same turn: the Slam's screen.
    const slam = momentsOf(
      view([{ kind: "tusks", turn: 4 }, { kind: "slam", turn: 4, squares: ["a2"] }], { tusks: { turn: 4, at: 4, pawns: ["a7", "b7"] }, slam: { at: 4, pieces: [], lands: 8, loss: null } }),
      10_000,
    );
    expect(slam.map((m) => m.kind)).toEqual(["slam"]);
    const fuse = momentsOf(view([{ kind: "fuse", turn: 4, squares: ["a7", "b7"], square: "b7" }], { fusion: { at: 4, from: ["a7", "b7"], to: "b7" } }), 10_000);
    expect(fuse.map((m) => m.kind)).toEqual(["fuse"]);
    // As your turn begins after his move: the landing plays with the rest of the turn's moments.
    const land = momentsOf(view([{ kind: "warn", turn: 5 }, { kind: "land", turn: 5, squares: ["a2"] }], {}, "alfil", 4), 10_000);
    expect(land.map((m) => m.kind).sort()).toEqual(["land", "warn"]);
    for (const k of ["tusks", "fuse", "slam", "land"] as const) expect(ALFIL_UI.moments[k].view({} as never)).toBeNull();
    expect(ALFIL_UI.ultimate.name).toBe("the Mammoth Slam");
  });

  it("a moment this app doesn't know (a newer server's) is passed over, never read: the rest still play", () => {
    const events = [{ kind: "freeze", turn: 3, square: "e4" }, { kind: "somethingNew", turn: 3 }] as unknown as PowerEvent[];
    const list = momentsOf(view(events, {}, "gingerbread"), 10_000);
    expect(list.map((m) => m.kind)).toEqual(["freeze"]);
  });
});
