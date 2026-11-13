// The Hidden Boss's room (Nov 12, a mockup): the game the child plays on his floor is his real one, every move legal, to the mate; the
// room plays it from its stored squares without any rules, and they agree; his loop and the summoning's beats run in order.
import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { KID_SPOTS, LOOP_MS, PLY_AT, RECLUSE_GAME, RECLUSE_GAME_SAN, RECLUSE_GAME_UCI, kidAt, sideOf, startBoard, stepsOf, walkPath } from "../src/town/shops/recluse-game.ts";
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
    for (let t = F.first; t < PLY_AT[82]!; t += 400) {
      const n = kidAt(t);
      expect(n.ply).toBeGreaterThanOrEqual(last);
      last = n.ply;
    }
    expect(last).toBe(81);
    // The piece is down from the step after the carry: the board after the move.
    const carryEnd = (i: number) => PLY_AT[i]! + stepsOf(i).slice(0, stepsOf(i).findIndex(([s]) => s === "carry") + 1).reduce((n, [, ms]) => n + ms, 0);
    for (const i of [0, 1, 40, 81]) {
      expect(kidAt(carryEnd(i) - 1).board, `ply ${i}`).toBe(RECLUSE_GAME.boards[i]);
      const back = kidAt(carryEnd(i) + 1);
      expect(back.step).toBe("back");
      expect(back.board).toBe(RECLUSE_GAME.boards[i + 1]);
    }
    const end = kidAt(PLY_AT[82]! + 10);
    expect(end.step).toBe("end");
    expect(end.board).toBe(RECLUSE_GAME.boards[82]);
    const fadeOut = kidAt(PLY_AT[82]! + F.end + F.fade * 0.25);
    expect(fadeOut.fade).toBeGreaterThan(0);
    expect(kidAt(LOOP_MS - 1).board).toBe(RECLUSE_GAME.boards[0]);
    expect(kidAt(LOOP_MS + 5).ply).toBe(-1);
  });
});

describe("how he plays (Eric, Nov 13; round 3: the board sideways, he plays from beside it)", () => {
  it("for every half-move gets up, walks round to that side, sits, thinks, leans in and plays, and looks up", () => {
    for (let i = 0; i < 82; i++) expect(stepsOf(i).map(([s]) => s), `ply ${i}`).toEqual(["rise", "walk", "sit", "think", "reach", "carry", "back", "look"]);
  });

  it("sits centered on White's side (our left) for White's moves and Black's (our right) for Black's, and walks round behind the board, never between us and it", () => {
    const half = HIDDEN_ROOM_FEEL.kid.board / 2;
    for (let i = 0; i < 82; i++) {
      const path = walkPath(i);
      const s = i % 2 ? 1 : -1;
      expect(sideOf(i)).toBe(s);
      expect(path[0]).toEqual([-s * KID_SPOTS.seat, 0]);
      expect(path[path.length - 1]).toEqual([s * KID_SPOTS.seat, 0]);
      // (Beside the board, just off its edge: his drawing's knees reach it.)
      expect(KID_SPOTS.seat).toBeGreaterThan(half);
      expect(KID_SPOTS.seat).toBeLessThan(half + 0.3);
      for (let k = 1; k < path.length; k++) {
        const [x0, y0] = path[k - 1]!;
        const [x1, y1] = path[k]!;
        for (let u = 0; u <= 1; u += 0.05) {
          const x = x0 + (x1 - x0) * u;
          const y = y0 + (y1 - y0) * u;
          // (Off the board, and anywhere in line with it, behind it; never nearer us than the board's middle.)
          expect(Math.abs(x) > half || y < -half, `ply ${i}`).toBe(true);
          expect(y).toBeLessThanOrEqual(0);
          if (Math.abs(x) < half + 0.15) expect(y, `ply ${i}`).toBeLessThan(-half);
        }
      }
    }
  });

  it("leans in so his reach is short: every move's squares within his arm (never more than half again its length), and every square on the board within reach from either side", async () => {
    const { leanFor, reachOf, scootFor, SCOOT_MAX } = await import("../src/town/shops/recluse-scene.ts");
    let worst = 0;
    RECLUSE_GAME.plies.forEach((p, i) => {
      const pose = leanFor(i);
      const r = Math.max(reachOf(pose, sideOf(i), p.from, scootFor(i)), reachOf(pose, sideOf(i), p.to, scootFor(i)));
      expect(r, `ply ${i + 1}: ${RECLUSE_GAME_SAN[i]}`).toBeLessThan(1.5);
      worst = Math.max(worst, r);
    });
    // (Nov 13: the worst of his 82 moves about 1.07 of his arm: an arm straight, not stretched.)
    expect(worst).toBeLessThan(1.15);
    for (const side of [-1, 1] as const)
      for (let sq = 0; sq < 64; sq++) {
        const scoot = Math.max(-SCOOT_MAX, Math.min(SCOOT_MAX, ((sq % 8) - 3.5) * (HIDDEN_ROOM_FEEL.kid.board / 8) * 0.9));
        let best = Infinity;
        for (const lean of [1, 2, 3, 4, 5] as const) for (const dip of [0, 1, 2, 3] as const) best = Math.min(best, reachOf({ stance: "knees", step: -1, lean, dip, reach: true, eyes: "down", mouth: "stern" }, side, sq, scoot));
        expect(best, `side ${side} square ${sq}`).toBeLessThan(1.5);
      }
  });

  it("takes a while: the whole game about 14 minutes (Eric: 'that's the point')", () => {
    expect(LOOP_MS).toBeGreaterThan(12 * 60_000);
    expect(LOOP_MS).toBeLessThan(16 * 60_000);
  });

  it("the room is about half round 1's floor (12 x 12), and its side walls are one surface each unless the cards are asked for", async () => {
    const art = await import("../src/town/shops/recluse-art.ts");
    expect(art.SHOP_RECLUSE_N ** 2 / 144).toBeGreaterThan(0.45);
    expect(art.SHOP_RECLUSE_N ** 2 / 144).toBeLessThan(0.6);
    const side = (l: readonly { name: string; col: number; row: number }[]) => l.filter((p) => (p.col === 0 || p.col === art.SHOP_RECLUSE_N - 1) && p.row > 0 && p.row < art.SHOP_RECLUSE_N - 1 && !p.name.startsWith("floor"));
    expect(side(art.SHOP_RECLUSE_LAYOUT).every((p) => p.name === "wall-none")).toBe(true);
    expect(side(art.SHOP_RECLUSE_LAYOUT_CARDS).every((p) => p.name.startsWith("wall-") && p.name !== "wall-none")).toBe(true);
    const wall = art.sideWallGrid(true, art.SHOP_RECLUSE_N + 2);
    expect(wall.grid.length).toBe(art.SHOP_RECLUSE_WALL_H);
    expect(wall.grid[0]!.length).toBe((art.SHOP_RECLUSE_N + 2) * 37);
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
