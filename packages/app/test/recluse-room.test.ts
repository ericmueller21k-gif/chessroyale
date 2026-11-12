// The Hidden Boss's room (Nov 12, a mockup): the game the child plays on his floor is his real one, every move legal, to the mate; the
// room plays it from its stored squares without any rules, and they agree; his loop and the summoning's beats run in order.
import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { LOOP_MS, PLY_MS, RECLUSE_GAME, RECLUSE_GAME_SAN, RECLUSE_GAME_UCI, kidAt, startBoard } from "../src/town/shops/recluse-game.ts";
import { HIDDEN_ROOM_FEEL } from "../src/town/feel.ts";

/** A chess.js board as the room's 64 squares (a1 = 0). */
function squaresOf(c: Chess): (string | null)[] {
  const out: (string | null)[] = new Array(64).fill(null);
  c.board().forEach((row, i) =>
    row.forEach((p, f) => {
      if (p) out[(7 - i) * 8 + f] = `${p.color}${p.type.toUpperCase()}`;
    }),
  );
  return out;
}

describe("the child's game (his 1956 game, stored)", () => {
  it("is legal from the start to the end, a mate, the SAN and the squares the same moves", () => {
    expect(RECLUSE_GAME_SAN.length).toBe(82);
    expect(RECLUSE_GAME_UCI.length).toBe(82);
    const c = new Chess();
    RECLUSE_GAME_SAN.forEach((san, i) => {
      const m = c.move(san);
      expect(m.from + m.to + (m.promotion ?? ""), `move ${i + 1}: ${san}`).toBe(RECLUSE_GAME_UCI[i]);
    });
    expect(c.isCheckmate()).toBe(true);
    // (Black, his side, mates.)
    expect(c.turn()).toBe("w");
  });

  it("the room's boards (worked out from the squares alone) match the rules' after every move", () => {
    const c = new Chess();
    expect(RECLUSE_GAME.boards[0]).toEqual(squaresOf(c));
    expect(startBoard()).toEqual(squaresOf(c));
    RECLUSE_GAME_SAN.forEach((san, i) => {
      c.move(san);
      expect(RECLUSE_GAME.boards[i + 1], `after ${san}`).toEqual(squaresOf(c));
    });
  });

  it("plays each move in order on a loop, then fades back to the start", () => {
    const F = HIDDEN_ROOM_FEEL.play;
    expect(kidAt(0).ply).toBe(-1);
    let last = -1;
    for (let t = F.first; t < F.first + 82 * PLY_MS; t += PLY_MS / 5) {
      const n = kidAt(t);
      expect(n.ply).toBeGreaterThanOrEqual(last);
      last = n.ply;
    }
    expect(last).toBe(81);
    // The piece is down from the step after the carry: the board after the move.
    const back = kidAt(F.first + F.think + F.reach + F.carry + 1);
    expect(back.step).toBe("back");
    expect(back.board).toBe(RECLUSE_GAME.boards[1]);
    const end = kidAt(F.first + 82 * PLY_MS + 10);
    expect(end.step).toBe("end");
    expect(end.board).toBe(RECLUSE_GAME.boards[82]);
    const fadeOut = kidAt(F.first + 82 * PLY_MS + F.end + F.fade * 0.25);
    expect(fadeOut.fade).toBeGreaterThan(0);
    expect(kidAt(LOOP_MS - 1).board).toBe(RECLUSE_GAME.boards[0]);
    expect(kidAt(LOOP_MS + 5).ply).toBe(-1);
  });
});

describe("the summoning's beats", () => {
  it("run in the order Eric gave: freeze, rays, burst, draw back, fall, splash, wobble, quiet, the transition", async () => {
    const S = HIDDEN_ROOM_FEEL.summon;
    const order = [S.freeze, S.rays, S.burst, S.drawBack, S.fall, S.splash, S.splash + S.wobbleMs, S.quiet, S.iris, S.iris + S.irisMs, S.end];
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    const { summonAt, wobbleLift } = await import("../src/town/shops/recluse-scene.ts");
    expect(summonAt(S.burst - 1).burst).toBe(0);
    expect(summonAt(S.burst + 1).burst).toBeGreaterThan(0);
    expect(summonAt(S.end).iris).toBe(1);
    // The board settles: no lift once the wobble's done, and none before it.
    expect(wobbleLift(0)).toBe(0);
    expect(wobbleLift(1)).toBe(0);
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(wobbleLift(i / 50))))).toBeGreaterThan(2);
  });
});
