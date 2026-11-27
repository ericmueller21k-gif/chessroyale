import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings, type TurfState } from "@chessroyale/core";
import {
  MatchRunner,
  START_FEN,
  applyMove,
  bossRules,
  claimTurf,
  fenAtPly,
  fuseClock,
  holdOn,
  holdsFor,
  hopperStepKind,
  legalMoves,
  legsFen,
  legsFrom,
  legsOptions,
  legsPlay,
  newTurf,
  pieceAt,
  powerTurn,
  sanLineToUci,
  stockfishRefuses,
  turfCount,
  turfHopPick,
  turfSquares,
  type EngineLike,
  type Opening,
} from "../src/index.ts";

/**
 * Chub & Chirp's Turf (Eric, Nov 22 and 27; docs/decisions/2026-11-27-hopper-turf.md): the squares (16 each to start, a square a
 * side's when one of its pieces ends a move there), the hop-around every turfHopEvery of his turns, and his three holds (Long legs,
 * Short fuse, Double hop) while he holds turfHolds squares as his turn begins. Not in the Battle Tower.
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
/** A stand-in engine: every legal move scored by a hash (or `score`), best first; the boss plays a hashed legal move. */
function fakeEngine(score: (fen: string, m: string) => number = (fen, m) => 0.3 + 0.4 * hash(fen + m)): EngineLike {
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    playAtElo: async (fen) => {
      const l = legalMoves(fen).sort();
      return l[Math.floor(hash(fen) * l.length)]!;
    },
  };
}
const LINE = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const opening: Opening = { id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves: LINE, namedPlies: LINE.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } };
const SETTINGS = (patch: Partial<Settings> = {}) => ({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "hopper", lastStandFrom: 999, ...patch }) as Settings;
function raid(o: { patch?: Partial<Settings>; seed?: number; engine?: EngineLike; side?: "w" | "b" } = {}) {
  return new MatchRunner({ settings: SETTINGS(o.patch), rng: mulberry32(o.seed ?? 5), engines: [o.engine ?? fakeEngine()], library: [opening], entrants: [{ id: "h0", name: "H", isBot: false }], ...(o.side ? { raidSide: o.side } : {}) });
}
const fenOf = (r: MatchRunner) => r.boards.get(0)!.fen;
const turfOf = (r: MatchRunner): TurfState => r.boss!.powers!.turf!;
const mark = (r: MatchRunner, sq: string) => turfOf(r).owner[sq.charCodeAt(0) - 97 + 8 * (Number(sq[1]) - 1)];
async function crowd(r: MatchRunner, move: string) {
  r.deal();
  await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
}
/** His turn: his step at its start if one is due, then his move (`move`, or the engine's). */
async function his(r: MatchRunner, move?: string) {
  const step = r.hopDue() ? await r.playHop() : null;
  if (move) r.applyBossMove(move);
  else await r.playBoss();
  return step;
}
/** His holds set for the turn under way (as his turn began after this crowd move), the rest as it is. */
function setHolds(r: MatchRunner, holds: number) {
  const b = r.boss!;
  r.state = { ...r.state, boss: { ...b, powers: { ...b.powers!, turf: { ...b.powers!.turf!, holds, holdsAt: b.crowdMoves } } } };
}
const sound = (fen: string) => {
  expect(stockfishRefuses(fen)).toBeNull();
  expect(legalMoves(fen).length).toBeGreaterThan(0);
};

describe("Turf: the squares", () => {
  it("each side starts with its own first two ranks (16 each, 32 open), from either side", () => {
    for (const side of ["w", "b"] as const) {
      const t = turfOf(raid({ side }));
      expect(turfCount(t.owner, "b")).toBe(16);
      expect(turfCount(t.owner, "c")).toBe(16);
      expect(turfCount(t.owner, ".")).toBe(32);
      const yours = turfSquares(t.owner, "c");
      expect(yours.every((sq) => (side === "w" ? Number(sq[1]) <= 2 : Number(sq[1]) >= 7))).toBe(true);
    }
  });

  it("is off on a Battle Tower floor: no squares, no hop-around, no holds", () => {
    const r = raid({ patch: { towerFloor: 1 } });
    expect(r.boss!.powers!.turf ?? null).toBeNull();
    expect(bossRules(r.boss!)!.view!(r.boss!.powers!).turf).toBeNull();
  });

  it("a piece ending a move claims its square for its side: a capture flips it, a promotion and en passant too; one leaving keeps it", () => {
    let fen = START_FEN;
    let t = newTurf(fen, "w");
    const play = (m: string) => {
      fen = applyMove(fen, m);
      t = claimTurf(t, fen, "w");
    };
    for (const m of sanLineToUci(["e4", "d5", "exd5", "c5"])) play(m);
    const at = (sq: string) => t.owner[sq.charCodeAt(0) - 97 + 8 * (Number(sq[1]) - 1)];
    expect(at("e4")).toBe("c");
    expect(at("e2")).toBe("c");
    // (Your capture on d5 flips his square: d5 was his from his move.)
    expect(at("d5")).toBe("c");
    expect(at("c5")).toBe("b");
    // (En passant: the landing square is the capturer's; the taken pawn's square keeps its owner.)
    play(sanLineToUci(["e4", "d5", "exd5", "c5", "dxc6"])[4]!);
    expect(at("c6")).toBe("c");
    expect(at("c5")).toBe("b");
    // (A promotion: the square it lands on.)
    const promo = "4k3/1P6/8/8/8/8/8/4K3 w - - 0 1";
    let t2 = claimTurf(newTurf(promo, "w"), promo, "w");
    t2 = claimTurf(t2, applyMove(promo, "b7b8q"), "w");
    expect(t2.owner[1 + 56]).toBe("c");
    // (His castling: his king's and rook's squares; nothing changes when the pieces are the same.)
    const castle = "r3k3/8/8/8/8/8/8/4K3 b q - 0 1";
    let t3 = newTurf(castle, "w");
    t3 = { ...t3, owner: t3.owner.slice(0, 56) + "........" };
    t3 = claimTurf(t3, applyMove(castle, "e8c8"), "w");
    expect(t3.owner.slice(56)).toBe("..bb....");
    expect(claimTurf(t3, applyMove(castle, "e8c8"), "w")).toBe(t3);
  });

  it("in a battle: your move's square is yours, his move's his, his hop-around's landing his; the count adds to 64", async () => {
    const r = raid({ side: "w" });
    await crowd(r, "g1f3");
    expect(mark(r, "f3")).toBe("c");
    await his(r, "g8f6");
    expect(mark(r, "f6")).toBe("b");
    const t = turfOf(r);
    expect(turfCount(t.owner, "b") + turfCount(t.owner, "c") + turfCount(t.owner, ".")).toBe(64);
  });
});

describe("Turf: the hop-around", () => {
  it("picks where he lands: an open empty square, else one of yours; his empty squares nearest it first, the farthest first; seeded", () => {
    const t = newTurf(START_FEN, "w");
    const pick = turfHopPick(t, START_FEN, 7, 4)!;
    expect(Number(pick.to[1])).toBeGreaterThanOrEqual(3);
    expect(Number(pick.to[1])).toBeLessThanOrEqual(6);
    expect(turfHopPick(t, START_FEN, 7, 4)).toEqual(pick);
    // (At the start all his squares have a piece: nowhere to hop on first.)
    expect(pick.hops).toEqual([]);
    // (None open: one of yours that's empty.)
    const fen = "4k3/8/8/8/8/8/8/R3K3 w - - 0 1";
    const full = { owner: [...newTurf(fen, "w").owner].map((c) => (c === "." ? "b" : c)).join("") };
    const alt = turfHopPick(full, fen, 7, 4)!;
    expect(["b1", "c1", "d1", "f1", "g1", "h1", ...["a", "b", "c", "d", "e", "f", "g", "h"].map((f) => `${f}2`)]).toContain(alt.to);
    expect(alt.hops).toHaveLength(BOSS_POWERS.turfHops);
    const far = (sq: string) => Math.max(Math.abs(sq.charCodeAt(0) - alt.to.charCodeAt(0)), Math.abs(Number(sq[1]) - Number(alt.to[1])));
    expect(alt.hops.map(far)).toEqual([...alt.hops.map(far)].sort((a, b) => b - a));
    expect(alt.hops.every((sq) => !pieceAt(fen, sq) && full.owner[sq.charCodeAt(0) - 97 + 8 * (Number(sq[1]) - 1)] === "b")).toBe(true);
    // (Nowhere to land: none.)
    expect(turfHopPick({ owner: "b".repeat(64) }, fen, 7, 4)).toBeNull();
  });

  it(`comes every ${BOSS_POWERS.turfHopEvery} of his turns, free, before his move: nothing on the board moves, the square he lands on is his`, async () => {
    const r = raid({ side: "w" });
    // (Quiet moves, single steps: no hop or bounce comes first, and no position repeats.)
    const knights = ["g1f3", "b1c3", "a2a3", "h2h3", "b2b3", "g2g3", "c1b2", "f1g2"];
    const his = ["g8f6", "b8c6", "a7a6", "h7h6", "b7b6", "g7g6", "c8b7", "f8g7"];
    const at: number[] = [];
    for (let k = 0; k < knights.length; k++) {
      await crowd(r, knights[k]!);
      if (r.hopDue()) {
        const before = r.boards.get(0)!;
        const owner = turfOf(r).owner;
        const step = (await r.playHop())!;
        expect(hopperStepKind(step)).toBe("turfHop");
        const board = r.boards.get(0)!;
        expect(board.fen).toBe(before.fen);
        expect(board.bases ?? []).toEqual(before.bases ?? []);
        expect(mark(r, (step as { to: string }).to)).toBe("b");
        expect(owner[(step as { to: string }).to.charCodeAt(0) - 97 + 8 * (Number((step as { to: string }).to[1]) - 1)]).not.toBe("b");
        expect(r.boss!.powers!.events.at(-1)?.kind).toBe("turfHop");
        expect(r.hopDue()).toBe(false);
        expect(r.bossToMove()).toBe(true);
        at.push(r.boss!.crowdMoves);
      }
      r.applyBossMove(his[k]!);
    }
    expect(at).toEqual([BOSS_POWERS.turfHopEvery, 2 * BOSS_POWERS.turfHopEvery]);
  });

  it("one step a turn: the Pawn Bounce first, the hop-around on his next turn (?power=turf: due on his first)", async () => {
    const r = raid({ side: "w", patch: { bossPowerTest: "turf" } });
    expect(turfCount(turfOf(r).owner, "b")).toBe(32);
    await crowd(r, "e2e4");
    expect(hopperStepKind((await his(r, "b8c6"))!)).toBe("pawnBounce");
    await crowd(r, "g1f3");
    expect(hopperStepKind((await his(r))!)).toBe("turfHop");
  });
});

describe("Turf: his holds", () => {
  it(`are worked out as his turn begins from his count: ${BOSS_POWERS.turfHolds.join(" / ")} squares; on for his turn and your turn after it`, async () => {
    expect([0, 31, 32, 35, 36, 39, 40, 64].map((n) => holdsFor(n))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    const r = raid({ side: "w", patch: { bossPowerTest: "turf" } });
    expect(holdOn(r.boss, 1)).toBe(false);
    await crowd(r, "g1f3");
    expect(turfOf(r).holds).toBe(1);
    expect(holdOn(r.boss, 1)).toBe(true);
    expect(holdOn(r.boss, 2)).toBe(false);
    await his(r);
    // (Your turn after his: still on.)
    expect(holdOn(r.boss, 1)).toBe(true);
  });

  it("Long legs: his pawns step 2 from any square, 3 from their start, the way empty; never onto your back rank, never check", () => {
    const fen = "4k3/p7/8/3p4/8/8/8/4K3 b - - 0 1";
    expect(legsOptions(fen, "b")).toEqual(["a7a4", "d5d3"]);
    // (The way blocked: no capture that way.)
    expect(legsOptions("4k3/p7/8/P2p4/8/8/8/4K3 b - - 0 1", "b")).toEqual(["d5d3"]);
    // (Never a promotion, never check: d4 to d2 would check your king on e1; c3 to c1 would queen.)
    expect(legsOptions("4k3/8/8/8/3p4/2p5/8/4K3 b - - 0 1", "b")).toEqual([]);
    // (Never in check; only the side to move.)
    expect(legsOptions("4k3/p7/8/8/8/8/8/4K2R b - - 0 1".replace("4K2R", "4R1K1"), "b")).toEqual([]);
    expect(legsOptions(fen, "w")).toEqual([]);
    expect(legsPlay("a7a4")).toBe("a7a5");
    expect(legsPlay("d5d3")).toBe("d5d4");
    expect(legsPlay("c3c5")).toBe("c3c4");
    const after = legsFen(fen, "a7a4")!;
    expect(pieceAt(after, "a4")).toEqual({ color: "b", type: "p" });
    expect(pieceAt(after, "a5")).toBeNull();
    expect(after.split(" ")[1]).toBe("w");
    // (No en passant from it, and the fifty-move count from zero.)
    expect(after.split(" ")[3]).toBe("-");
    expect(after.split(" ")[4]).toBe("0");
    sound(after);
  });

  it("Long legs in a battle: asked of his engine with his move, played as its first step, the pawn on to its square (a base; its square his)", async () => {
    const r = raid({ side: "w", patch: { bossPowerTest: "turf" } });
    await crowd(r, "g1f3");
    if (r.hopDue()) await r.playHop();
    const asks = r.bossAsks()!;
    expect(asks.legs).toEqual(legsOptions(fenOf(r), "b"));
    expect(asks.legs).toContain("e7e4");
    // (Not his rules' move without the hold: the first allowed move instead.)
    const ply = r.boards.get(0)!.history.length;
    r.applyBossMove("e7e4");
    const board = r.boards.get(0)!;
    expect(pieceAt(board.fen, "e4")).toEqual({ color: "b", type: "p" });
    expect(pieceAt(board.fen, "e5")).toBeNull();
    expect(board.history.at(-1)).toBe("e7e5");
    expect(board.lastMove).toBe("e7e4");
    expect(board.bases?.some((x) => x.ply === ply + 1)).toBe(true);
    expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
    expect(board.fen.split(" ")[3]).toBe("-");
    expect(r.bossView()!.lastMove).toMatchObject({ move: "e7e4", san: "e4" });
    expect(mark(r, "e4")).toBe("b");
    sound(board.fen);
    // (Without the hold: refused, as any move he may not play.)
    const plain = raid({ side: "w" });
    await crowd(plain, "g1f3");
    expect(plain.bossAsks()).toBeNull();
    plain.applyBossMove("e7e4");
    expect(pieceAt(fenOf(plain), "e4")).toBeNull();
  });

  it("Long legs' pick: the long step best for him, only when it costs at most turfLegsMaxLoss pawns against his best move", async () => {
    const fen = "4k3/p7/8/3p4/8/8/8/4K3 b - - 0 1";
    const good = fakeEngine((f) => (pieceAt(f, "d3") ? 0.2 : 0.55));
    expect(await legsFrom([good], fen, ["a7a4", "d5d3"])).toBe("d5d3");
    const bad = fakeEngine((f) => (sideToMoveOf(f) === "w" ? 0.9 : 0.5));
    expect(await legsFrom([bad], fen, ["a7a4", "d5d3"])).toBeNull();
    // (Only moves of his rules: anything else is dropped.)
    expect(await legsFrom([good], fen, ["d5d4"])).toBeNull();
  });

  it("Short fuse: your move's clock a third shorter (never under turfFuseMin), and the time it adds to the bank too; off otherwise", async () => {
    const r = raid({ side: "w" });
    await crowd(r, "g1f3");
    await his(r);
    const base = r.moveClock();
    const inc = r.incrementNow();
    setHolds(r, 1);
    expect(r.moveClock()).toBe(base);
    setHolds(r, 2);
    expect(r.moveClock()).toBe(Math.max(BOSS_POWERS.turfFuseMin, Math.round(base * (1 - BOSS_POWERS.turfFuseCut))));
    expect(r.incrementNow()).toBe(Math.round(inc * (1 - BOSS_POWERS.turfFuseCut) * 10) / 10);
    expect(fuseClock(r.boss, 6)).toBe(BOSS_POWERS.turfFuseMin);
    expect(fuseClock(r.boss, 3)).toBe(3);
  });

  it("Double hop: after his move the turn passes back and he plays a quiet second move (a base; unscored); none after a check", async () => {
    const r = raid({ side: "w" });
    await crowd(r, "g1f3");
    setHolds(r, 3);
    r.applyBossMove("g8f6");
    expect(r.extraMoveDue()).toBe(true);
    expect(r.extraMoveKind()).toBe("doubleHop");
    const before = r.boards.get(0)!;
    const played = r.applyExtraMove("zzzz")!;
    expect(played).toBeTruthy();
    const board = r.boards.get(0)!;
    expect(board.history.length).toBe(before.history.length + 1);
    expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
    expect(pieceAt(board.fen, played.slice(2, 4))?.color).toBe("b");
    expect(r.boss!.powers!.events.at(-1)?.kind).toBe("doubleHop");
    expect(turfOf(r).double).toEqual({ at: r.boss!.crowdMoves, state: "played" });
    expect(powerTurn(r.boss!)).toBe(true);
    expect(r.extraMoveDue()).toBe(false);
    sound(board.fen);
    // (His first move gives check: no second move that turn.)
    const c = raid({ side: "w" });
    await crowd(c, "d2d3");
    c.applyBossMove("e7e5");
    await crowd(c, "g1f3");
    setHolds(c, 3);
    c.applyBossMove("f8b4");
    expect(c.extraMoveDue()).toBe(false);
    expect(turfOf(c).double?.state).toBe("skipped");
    // (Nor while the Carrot Patch race is on: a free second move could pull his winning carrot. Review of #1024.)
    const q = raid({ side: "w" });
    await crowd(q, "g1f3");
    setHolds(q, 3);
    const qb = q.boss!;
    q.state = { ...q.state, boss: { ...qb, powers: { ...qb.powers!, carrots: { at: qb.crowdMoves, squares: ["a4", "h4", "a5", "h5", "c4"], pulls: [], crowdMoves: 0, bossMoves: 0 } } } };
    q.applyBossMove("g8f6");
    expect(q.extraMoveDue()).toBe(false);
    expect(turfOf(q).double?.state).toBe("skipped");
  });
});

const sideToMoveOf = (fen: string) => fen.split(" ")[1];
