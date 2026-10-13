import { describe, expect, it } from "vitest";
import { SQUADS, mulberry32, type SquadsSettings } from "@chessroyale/core";
import { START_FEN, legalMoves, type MoveScore } from "../src/index.ts";
import {
  NO_INPUTS,
  allowedMoves,
  blockBankNow,
  blockCost,
  blockLift,
  blockTargets,
  botBlock,
  botPairPick,
  candidatesFrom,
  checkBlock,
  choose,
  createSquadsMatch,
  halfDuties,
  isOnlyMove,
  judgeTokenUse,
  lockIn,
  movesAllowed,
  newSquadsBoard,
  liftBlocks,
  piecesOf,
  placeBlock,
  placedBlocks,
  resolveHalf,
  settleTokenUse,
  startArmageddon,
  topAllowed,
  type HalfInputs,
  type Lineup,
  type MatchSetup,
  type Side,
  type SquadsEvent,
  type SquadsMatch,
} from "../src/squads/index.ts";

/** Squads v2 (Eric, Oct 12): Pairs' same-move tokens and their refunds, move blocks in every round, and their bots. */

const sides: [Lineup, Lineup] = [
  { squadId: 0, seats: ["a0", "a1", "a2", "a3"] },
  { squadId: 1, seats: ["b0", "b1", "b2", "b3"] },
];
const BANK = 240_000;
const DELAY = 3_000;
/** White's only legal move is Kxb2. */
const ONE_MOVE = "k7/8/8/8/8/8/1q6/K7 w - - 0 1";
/** After 1.d4 Nf6 2.Bg5: White can take the knight. */
const BG5 = "rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR w KQkq - 2 3";
const CASTLING = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";

function match(format: "relay" | "pairs" | "final", starts: string[], o: Partial<MatchSetup> = {}, s?: SquadsSettings): SquadsMatch {
  return createSquadsMatch(
    {
      key: format === "relay" ? "r0m0" : format === "pairs" ? "r1m0" : "r2m0",
      seed: 7,
      round: format === "relay" ? 0 : format === "pairs" ? 1 : 2,
      format,
      sides,
      starts: starts.map((fen) => ({ fen, openingId: null })),
      whites: starts.map((_, k) => (k % 2) as Side),
      banksMs: [BANK, BANK],
      delayMs: DELAY,
      incrementMs: 0,
      capMs: 20_000,
      ...o,
    },
    s,
  );
}
const relay = (starts = Array(4).fill(START_FEN)) => match("relay", starts);
const pairs = (starts = Array(2).fill(START_FEN)) => match("pairs", starts);
const final = (fen = START_FEN) => match("final", [fen]);

function inputs(m: SquadsMatch, moves: Record<string, string>, base: HalfInputs = NO_INPUTS): HalfInputs {
  let inp = base;
  for (const [id, mv] of Object.entries(moves)) {
    const r = choose(m, inp, id, mv);
    if ("error" in r) throw new Error(`${id} ${mv}: ${r.error}`);
    inp = lockIn(r.inputs, id);
  }
  return inp;
}
function block(m: SquadsMatch, inp: HalfInputs, id: string, board: number, move: string, at = 0): HalfInputs {
  const r = placeBlock(m, inp, id, board, move, at);
  if ("error" in r) throw new Error(`${id} block ${move}: ${r.error}`);
  return r.inputs;
}
const ofKind = <K extends SquadsEvent["kind"]>(events: SquadsEvent[], kind: K) => events.filter((e): e is Extract<SquadsEvent, { kind: K }> => e.kind === kind);
/** Every other duty on the match's boards played with its first legal move (so a half can resolve). */
function rest(m: SquadsMatch, moves: Record<string, string>): Record<string, string> {
  const all: Record<string, string> = { ...moves };
  for (const d of halfDuties(m).duties) {
    const allowed = movesAllowed(m, d.board);
    d.players.forEach((p, i) => (all[p] ??= allowed[i % allowed.length]!));
  }
  return all;
}

describe("Squads v2: same-move tokens (Pairs)", () => {
  it("each squad has its tokens in Pairs only (none in Relay or the final)", () => {
    expect(pairs().tokens).toEqual([SQUADS.tokens.perMatch, SQUADS.tokens.perMatch]);
    expect(relay().tokens).toBeNull();
    expect(final().tokens).toBeNull();
  });

  it("both partners pick the same move: it plays (no coin) and a token burns automatically, logged for the judge", () => {
    const m = pairs();
    const out = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "e2e4", b2: "g1f3", b3: "b1c3" }));
    const e = ofKind(out.events, "pair").find((x) => x.board === 0)!;
    expect(e).toMatchObject({ same: true, coin: null, token: 0, picks: ["e2e4", "e2e4"], missed: [false, false], move: "e2e4" });
    expect(out.match.boards[0]!.moves).toEqual(["e2e4"]);
    expect(out.match.tokens).toEqual([SQUADS.tokens.perMatch - 1, SQUADS.tokens.perMatch]);
    expect(out.tokensUsed).toEqual([0]);
    expect(out.match.tokenLog).toEqual([{ turn: 0, half: "w", board: 0, side: 0, players: ["a0", "a1"], move: "e2e4", fen: START_FEN, blocked: [], verdict: null }]);
    // The other pair picked differently: a coin, no token.
    expect(ofKind(out.events, "pair").find((x) => x.board === 1)).toMatchObject({ same: false, token: null });
    expect(out.acted).toEqual(expect.arrayContaining(["a0", "a1"]));
  });

  it("at 0 tokens picks must differ: the partner's move is refused; equal picks never stand (the second slot is a miss)", () => {
    const m = { ...pairs(), tokens: [0, 5] as const };
    let inp = inputs(m, { a0: "e2e4" });
    expect(choose(m, inp, "a1", "e2e4")).toEqual({ error: "no_tokens" });
    // (Should equal picks ever reach the half with no token, they can't both stand.)
    inp = { ...inp, choices: { ...inp.choices, a1: "e2e4" }, locked: { ...inp.locked, a1: true } };
    const out = resolveHalf(m, inputs(m, { b2: "g1f3", b3: "b1c3" }, inp));
    const e = ofKind(out.events, "pair").find((x) => x.board === 0)!;
    expect(e.same).toBe(false);
    expect(e.picks[0]).toBe("e2e4");
    expect(e.picks[1]).not.toBe("e2e4");
    expect(out.match.tokens).toEqual([0, 5]);
  });

  it("five burns use them up; a missed pick is never the partner's (no token); one legal move plays itself with no token", () => {
    let m = pairs();
    for (let i = 0; i < SQUADS.tokens.perMatch; i++) {
      // (Each half: squad 0's pair on its board picks the same move.)
      const d = halfDuties(m).duties.find((x) => x.side === 0)!;
      const mv = movesAllowed(m, d.board)[0]!;
      const out = resolveHalf(m, inputs(m, rest(m, { [d.players[0]!]: mv, [d.players[1]!]: mv })));
      expect(out.tokensUsed).toHaveLength(1);
      m = out.match;
    }
    expect(m.tokens![0]).toBe(0);
    const d = halfDuties(m).duties.find((x) => x.side === 0)!;
    const mv = movesAllowed(m, d.board)[0]!;
    const r = choose(m, inputs(m, { [d.players[0]!]: mv }), d.players[1]!, mv);
    expect(r).toEqual({ error: "no_tokens" });
    // A miss: a random move other than the partner's.
    for (let seed = 1; seed < 20; seed++) {
      const x = { ...pairs(), seed };
      const out = resolveHalf(x, inputs(x, { a0: "e2e4", b2: "g1f3", b3: "b1c3" }));
      const e = ofKind(out.events, "pair").find((y) => y.board === 0)!;
      expect(e.same).toBe(false);
      expect(e.picks[1]).not.toBe("e2e4");
      expect(out.match.tokens![0]).toBe(SQUADS.tokens.perMatch);
    }
    const forced = pairs([ONE_MOVE, START_FEN]);
    const out = resolveHalf(forced, inputs(forced, { b2: "g1f3", b3: "g1f3" }));
    expect(ofKind(out.events, "forced")).toHaveLength(1);
    expect(out.match.tokens).toEqual([5, 4]);
    expect(out.tokensUsed).toEqual([0]);
  });

  describe("the refund: the judge's verdict", () => {
    const gap = SQUADS.tokens.refundGap;
    const use = { fen: START_FEN, move: "e2e4", blocked: [] as string[] };
    const top = (second: number): MoveScore[] => [
      { move: "e2e4", expected: 0.6 },
      { move: "d2d4", expected: 0.6 - second },
      { move: "g1f3", expected: 0.1 },
    ];

    it("refunded when the move was the best and every other move was worse by at least refundGap (about two pawns' worth)", () => {
      expect(judgeTokenUse(use, top(gap))).toEqual({ refunded: true, why: "only_move", rival: "d2d4", pawns: Math.round((gap / SQUADS.tokens.pawnWorth) * 10) / 10 });
      expect(judgeTokenUse(use, top(gap)).pawns).toBe(2);
      expect(judgeTokenUse(use, top(0.5))).toMatchObject({ refunded: true, pawns: 2.7 });
      // Just under the gap: kept, and the breakdown says how close the next move was.
      expect(judgeTokenUse(use, top(gap - 0.02))).toEqual({ refunded: false, why: "close", rival: "d2d4", pawns: 1.9 });
      expect(judgeTokenUse(use, top(0.05))).toMatchObject({ refunded: false, why: "close", rival: "d2d4", pawns: 0.3 });
    });

    it("kept when another move was better (by how much; at least, if the move wasn't among the judge's lines)", () => {
      expect(judgeTokenUse({ ...use, move: "d2d4" }, top(0.1))).toEqual({ refunded: false, why: "better", rival: "e2e4", pawns: 0.5 });
      expect(judgeTokenUse({ ...use, move: "a2a3" }, top(0.1))).toEqual({ refunded: false, why: "better", rival: "e2e4", pawns: 2.7, atLeast: true });
    });

    it("the best line is the one with the highest score, not the first; a mating rival is said to mate too", () => {
      const shuffled = [top(0.4)[2]!, top(0.4)[1]!, top(0.4)[0]!];
      expect(judgeTokenUse(use, shuffled)).toMatchObject({ refunded: true, rival: "d2d4" });
      const mates: MoveScore[] = [
        { move: "e2e4", expected: 1, mate: 2 },
        { move: "d2d4", expected: 1, mate: 3 },
      ];
      expect(judgeTokenUse(use, mates)).toEqual({ refunded: false, why: "close", rival: "d2d4", pawns: 0, mate: true });
    });

    it("a move a block took away doesn't count against it", () => {
      const lines: MoveScore[] = [
        { move: "d2d4", expected: 0.7 },
        { move: "e2e4", expected: 0.6 },
        { move: "g1f3", expected: 0.2 },
      ];
      expect(judgeTokenUse(use, lines)).toMatchObject({ refunded: false, why: "better", rival: "d2d4" });
      expect(judgeTokenUse({ ...use, blocked: ["d2d4"] }, lines)).toMatchObject({ refunded: true, why: "only_move", rival: "g1f3" });
      // No other move in the lines: compared with the judge's last line (every other move ranks below it).
      expect(judgeTokenUse({ ...use, blocked: ["d2d4"] }, lines.slice(0, 2))).toMatchObject({ refunded: false, why: "unranked" });
    });

    it("no judge, no refund (the breakdown says why)", () => {
      expect(judgeTokenUse(use, null)).toEqual({ refunded: false, why: "no_judge" });
      expect(judgeTokenUse(use, [])).toEqual({ refunded: false, why: "no_judge" });
    });

    it("a refund gives the squad its token back; the verdict goes on the log (the post-match breakdown); once only", () => {
      const m = pairs();
      const out = resolveHalf(m, inputs(m, { a0: "e2e4", a1: "e2e4", b2: "g1f3", b3: "g1f3" }));
      expect(out.match.tokens).toEqual([4, 4]);
      const refunded = settleTokenUse(out.match, 0, judgeTokenUse(out.match.tokenLog[0]!, top(0.5)));
      expect(refunded.tokens).toEqual([5, 4]);
      expect(refunded.tokenLog[0]!.verdict).toMatchObject({ refunded: true });
      expect(settleTokenUse(refunded, 0, { refunded: true, why: "only_move" })).toBe(refunded);
      const kept = settleTokenUse(refunded, 1, { refunded: false, why: "no_judge" });
      expect(kept.tokens).toEqual([5, 4]);
      expect(kept.tokenLog.map((u) => [u.side, u.move, u.verdict?.why])).toEqual([
        [0, "e2e4", "only_move"],
        [1, "g1f3", "no_judge"],
      ]);
      // A finished match still takes its verdicts (for the breakdown).
      const over = { ...out.match, result: { winner: 0 as const, points: [2, 0] as const, how: "boards" as const } };
      expect(settleTokenUse(over, 0, { refunded: true, why: "only_move" }).tokenLog[0]!.verdict).toMatchObject({ refunded: true });
    });
  });
});

describe("Squads v2: move blocks", () => {
  it("cost by the piece making the move: pawn 1; knight, bishop or rook 2; queen 3; castling 2; the king's ordinary moves never", () => {
    expect(blockCost("p")).toBe(1);
    expect(["n", "b", "r"].map((p) => blockCost(p as "n"))).toEqual([2, 2, 2]);
    expect(blockCost("q")).toBe(3);
    expect(blockCost("k")).toBe(2);
    expect(checkBlock(START_FEN, "b", "e7e5")).toEqual({ piece: "p", cost: 1 });
    expect(checkBlock(START_FEN, "b", "g8f6")).toEqual({ piece: "n", cost: 2 });
    expect(checkBlock(START_FEN, "b", "e8e7")).toEqual({ error: "king" });
    expect(checkBlock(CASTLING, "b", "e8g8")).toEqual({ piece: "k", cost: 2 });
    expect(checkBlock(CASTLING, "b", "e8f8")).toEqual({ error: "king" });
    // Only the other squad's pieces, and only a move the piece makes.
    expect(checkBlock(START_FEN, "b", "e2e4")).toEqual({ error: "no_piece" });
    expect(checkBlock(START_FEN, "b", "g8g6")).toEqual({ error: "not_a_move" });
    // Castling off (a setting): the king can't be blocked at all.
    const off: SquadsSettings = { ...SQUADS, blocks: { ...SQUADS.blocks, castlingCost: null } };
    expect(checkBlock(CASTLING, "b", "e8g8", off)).toEqual({ error: "king" });
  });

  it("the moves a block can name: as the piece moves, up to and onto the first piece in its way; castling with the right", () => {
    expect(blockTargets(START_FEN, "g8", "b").sort()).toEqual(["e7", "f6", "h6"]);
    expect(blockTargets(START_FEN, "e7", "b").sort()).toEqual(["d6", "e5", "e6", "f6"]);
    // A rook along its rank up to the first piece, either colour (your move may take it).
    expect(blockTargets("4k3/8/8/8/r2P3n/8/8/4K3 w - - 0 1", "a4", "b").sort()).toEqual(["a1", "a2", "a3", "a5", "a6", "a7", "a8", "b4", "c4", "d4"]);
    expect(blockTargets(CASTLING, "e8", "b").sort()).toEqual(["c8", "g8"]);
    expect(blockTargets("r3k2r/8/8/8/8/8/8/R3K2R w KQ - 0 1", "e8", "b")).toEqual([]);
  });

  it("placed by a player with a duty on that board, before their move (Relay); paid at once from the squad's bank", () => {
    const m = relay();
    expect(halfDuties(m).duties.map((d) => [d.board, d.players[0]])).toEqual([
      [0, "a0"],
      [1, "b1"],
      [2, "a2"],
      [3, "b3"],
    ]);
    expect(placeBlock(m, NO_INPUTS, "a0", 1, "g1f3", 0)).toEqual({ error: "no_duty" });
    expect(placeBlock(m, NO_INPUTS, "b0", 0, "e2e4", 0)).toEqual({ error: "no_duty" });
    const r = placeBlock(m, NO_INPUTS, "a0", 0, "g8f6", 2_000);
    expect(r).toMatchObject({ block: { board: 0, side: 0, by: "a0", move: "g8f6", piece: "n", cost: 2 } });
    const inp = "inputs" in r ? r.inputs : NO_INPUTS;
    expect(blockBankNow(m, inp, 0)).toBe(SQUADS.blocks.bankPerMatch - 2);
    expect(blockBankNow(m, inp, 1)).toBe(SQUADS.blocks.bankPerMatch);
    // As many a turn as the bank allows (Eric: "one big blocking play"), each a different move.
    expect(placeBlock(m, inp, "a0", 0, "g8f6", 2_100)).toEqual({ error: "block_taken" });
    const two = placeBlock(m, inp, "a0", 0, "e7e5", 2_100);
    expect(two).toMatchObject({ block: { move: "e7e5", cost: 1 } });
    expect(blockBankNow(m, "inputs" in two ? two.inputs : inp, 0)).toBe(SQUADS.blocks.bankPerMatch - 3);
    // A limit a turn is a setting.
    const one: SquadsSettings = { ...SQUADS, blocks: { ...SQUADS.blocks, maxPerTurn: 1 } };
    expect(placeBlock(m, inp, "a0", 0, "e7e5", 2_100, one)).toEqual({ error: "block_taken" });
    // Another board, another block (squad 0's mover there).
    expect("inputs" in placeBlock(m, inp, "a2", 2, "e7e5", 0)).toBe(true);
    // Moved: too late to block.
    const moved = inputs(m, { a2: "d2d4" }, inp);
    expect(placeBlock(m, moved, "a2", 2, "e7e5", 3_000)).toEqual({ error: "already_moved" });
    // Blocks are public: everyone sees the same list.
    expect(placedBlocks(m, inp)).toEqual([{ board: 0, side: 0, by: "a0", move: "g8f6", piece: "n", cost: 2 }]);
  });

  it("the bank is per match: a block it can't afford is refused", () => {
    const m = { ...relay(), blockBanks: [2, 5] as const };
    expect(placeBlock(m, NO_INPUTS, "a0", 0, "d8h4", 0)).toEqual({ error: "not_a_move" });
    expect(placeBlock(m, NO_INPUTS, "a0", 0, "g8f6", 0)).toMatchObject({ block: { cost: 2 } });
    const two = block(m, NO_INPUTS, "a0", 0, "g8f6");
    expect(placeBlock(m, two, "a2", 2, "e7e5", 0)).toEqual({ error: "bank" });
    expect(relay().blockBanks).toEqual([SQUADS.blocks.bankPerMatch, SQUADS.blocks.bankPerMatch]);
    expect(pairs().blockBanks).toEqual([SQUADS.blocks.bankPerMatch, SQUADS.blocks.bankPerMatch]);
    expect(final().blockBanks).toEqual([SQUADS.blocks.bankPerMatch, SQUADS.blocks.bankPerMatch]);
  });

  it("Pairs and the final: any of the squad's players on the board, until they've all locked in", () => {
    const p = pairs();
    let inp = inputs(p, { a0: "e2e4" });
    expect("inputs" in placeBlock(p, inp, "a0", 0, "g8f6", 0)).toBe(true);
    inp = inputs(p, { a1: "d2d4" }, inp);
    expect(placeBlock(p, inp, "a1", 0, "g8f6", 0)).toEqual({ error: "locked" });
    const f = final();
    const three = inputs(f, { a0: "e2e4", a1: "e2e4", a2: "d2d4" });
    expect(placeBlock(f, three, "a1", 0, "b8c6", 0)).toMatchObject({ block: { by: "a1", cost: 2 } });
    expect(placeBlock(f, NO_INPUTS, "b0", 0, "e2e4", 0)).toEqual({ error: "no_duty" });
  });

  it("in effect on the other squad's next turn there: that move can't be played (the piece's others can), then it's gone", () => {
    const m = relay();
    const inp = block(m, NO_INPUTS, "a0", 0, "g8f6", 1_000);
    const out = resolveHalf(m, inputs(m, rest(m, { a0: "e2e4" }), inp));
    expect(ofKind(out.events, "block")).toEqual([{ kind: "block", turn: 0, half: "w", board: 0, side: 0, by: "a0", move: "g8f6", piece: "n", cost: 2, outcome: "on" }]);
    const next = out.match;
    expect(next.blockBanks).toEqual([3, 5]);
    expect(next.blocks).toEqual([{ board: 0, side: 0, by: "a0", move: "g8f6", piece: "n", cost: 2 }]);
    // Board 0, Black to move: b0.
    expect(halfDuties(next).duties.find((d) => d.board === 0)!.players).toEqual(["b0"]);
    expect(choose(next, NO_INPUTS, "b0", "g8f6")).toEqual({ error: "blocked" });
    expect("inputs" in choose(next, NO_INPUTS, "b0", "g8h6")).toBe(true);
    expect(movesAllowed(next, 0)).not.toContain("g8f6");
    expect(movesAllowed(next, 0)).toHaveLength(legalMoves(next.boards[0]!.fen).length - 1);
    // Other boards are free.
    expect(movesAllowed(next, 2)).toContain("g8f6");
    // A miss never plays it.
    for (let seed = 1; seed < 40; seed++) {
      const x = { ...next, seed };
      const o = resolveHalf(x, inputs(x, rest(x, {})));
      expect(o.match.boards[0]!.moves[1]).not.toBe("g8f6");
      const missed = resolveHalf(x, NO_INPUTS);
      expect(missed.match.boards[0]!.moves[1]).not.toBe("g8f6");
    }
    // After their turn it's gone.
    const after = resolveHalf(next, inputs(next, rest(next, {}))).match;
    expect(after.blocks).toEqual([]);
    expect(after.blockBanks).toEqual([3, 5]);
  });

  it("several blocks in one turn all take effect; the mercy rules weigh them together, lifting the most recent first", () => {
    // Black's king can't move (the queen), so its knight's three moves are all it has.
    const fen = "1n5k/5Q2/8/8/8/8/P7/K7 w - - 0 1";
    const m: SquadsMatch = { ...relay([fen, START_FEN, START_FEN, START_FEN]), blockBanks: [9, 5] };
    let inp = block(m, NO_INPUTS, "a0", 0, "b8a6", 100);
    inp = block(m, inp, "a0", 0, "b8c6", 200);
    inp = block(m, inp, "a0", 0, "b8d7", 300);
    expect(blockBankNow(m, inp, 0)).toBe(3);
    const out = resolveHalf(m, inputs(m, rest(m, { a0: "a2a3" }), inp));
    // Every knight move blocked would leave Black no move: the last (b8d7) is lifted and refunded; the other two stand.
    expect(ofKind(out.events, "block").map((e) => [e.move, e.outcome])).toEqual([
      ["b8a6", "on"],
      ["b8c6", "on"],
      ["b8d7", "no_move"],
    ]);
    expect(out.match.blockBanks).toEqual([5, 5]);
    expect(movesAllowed(out.match, 0)).toEqual(["b8d7"]);
    expect(halfDuties(out.match).duties.find((d) => d.board === 0)).toBeTruthy();
    // The combined rule, directly: blocks lifted from the most recent until a move is left that doesn't allow mate.
    expect(liftBlocks("1n5k/5Q2/8/8/8/8/P7/K7 b - - 0 1", ["b8a6", "b8c6", "b8d7"])).toEqual([null, null, "no_move"]);
    expect(liftBlocks("1n5k/5Q2/8/8/8/8/P7/K7 b - - 0 1", ["b8a6", "e2e4", "b8c6"])).toEqual([null, "impossible", null]);
  });

  it("a promotion block covers every promotion piece; castling can be blocked (a rook's own moves stay legal)", () => {
    expect(allowedMoves("8/4P3/8/8/8/8/k7/4K3 w - - 0 1", "e7e8")).toEqual(legalMoves("8/4P3/8/8/8/8/k7/4K3 w - - 0 1").filter((m) => !m.startsWith("e7e8")));
    const castle = allowedMoves(CASTLING, "e1g1");
    expect(castle).not.toContain("e1g1");
    expect(castle).toContain("e1c1");
    expect(castle).toContain("h1g1");
  });

  it("a block that would leave them no move is lifted (refunded); one that leaves them one move: it plays itself", () => {
    // Black's king can't move (the queen), so its pawn's promotions are its only moves.
    const none = "7k/5Q2/8/8/8/8/P6p/K7 w - - 0 1";
    const m = relay([none, START_FEN, START_FEN, START_FEN]);
    const inp = block(m, NO_INPUTS, "a0", 0, "h2h1", 0);
    const out = resolveHalf(m, inputs(m, rest(m, { a0: "a2a3" }), inp));
    expect(ofKind(out.events, "block")[0]).toMatchObject({ move: "h2h1", outcome: "no_move" });
    expect(out.match.blocks).toEqual([]);
    expect(out.match.blockBanks).toEqual([5, 5]);
    // With a second pawn, the block takes effect and the push is all that's left (Pairs: it plays itself).
    const one = "7k/5Q2/8/8/1p6/8/7p/K7 w - - 0 1";
    const p = pairs([one, START_FEN]);
    const pin = block(p, NO_INPUTS, "a0", 0, "h2h1", 0);
    const pout = resolveHalf(p, inputs(p, { a0: "a1b1", a1: "a1a2", b2: "g1f3", b3: "b1c3" }, pin));
    expect(ofKind(pout.events, "block")[0]).toMatchObject({ outcome: "on" });
    expect(halfDuties(pout.match).forced).toEqual([0]);
    const forced = resolveHalf(pout.match, inputs(pout.match, rest(pout.match, {})));
    expect(ofKind(forced.events, "forced")).toEqual([{ kind: "forced", turn: 0, half: "b", board: 0, side: 1, move: "b4b3" }]);
  });

  describe("lifted and refunded when it wouldn't take effect", () => {
    it("your own move makes it impossible (the piece taken, the way shut, the game over)", () => {
      const m = relay([BG5, BG5, BG5, BG5]);
      const inp = block(m, NO_INPUTS, "a0", 0, "f6e4", 500);
      const out = resolveHalf(m, inputs(m, rest(m, { a0: "g5f6" }), inp));
      expect(ofKind(out.events, "block")[0]).toMatchObject({ move: "f6e4", outcome: "impossible", cost: 2 });
      expect(out.match.blockBanks).toEqual([5, 5]);
      expect(out.match.blocks).toEqual([]);
      // Shut off: the bishop's way to b4 closed by your pawn on c5.
      expect(blockLift("rnbqkbnr/pppp1ppp/8/2P1p3/8/8/PP1PPPPP/RNBQKBNR b KQkq - 0 3", "f8b4")).toBe("impossible");
      expect(blockLift("rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 2", "f8b4")).toBeNull();
    });

    it("in check (every move answers it); no move left; every move left allows mate in one", () => {
      // Black in check from the queen; the rook can step in between.
      expect(blockLift("3k4/8/8/8/8/r7/3Q4/4K3 b - - 1 1", "a3d3")).toBe("check");
      expect(blockLift("7k/5Q2/8/8/8/8/P6p/1K6 b - - 1 1", "h2h1")).toBe("no_move");
      // Every White move but Nc2 allows mate in one (Re1#): blocking Nc2 is lifted.
      const mercy = "4r1k1/1b3ppp/3q4/2b5/8/N7/3n1PPP/6K1 w - - 0 1";
      expect(blockLift(mercy, "a3c2")).toBe("mate");
      expect(blockLift(mercy, "h2h3")).toBeNull();
      // A quiet block in a quiet position: it takes effect.
      expect(blockLift("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "g8f6")).toBeNull();
      const off: SquadsSettings = { ...SQUADS, blocks: { ...SQUADS.blocks, liftInCheck: false, liftBeforeMate: false } };
      expect(blockLift("3k4/8/8/8/8/r7/3Q4/4K3 b - - 1 1", "a3d3", off)).toBeNull();
      expect(blockLift(mercy, "a3c2", off)).toBeNull();
    });
  });

  it("block time is thinking time: the move's time runs to the block when that came later", () => {
    const p = pairs();
    let inp = inputs(p, { a0: "e2e4", a1: "d2d4", b2: "g1f3", b3: "b1c3" });
    inp = { ...inp, locked: { ...inp.locked, a1: false } };
    inp = block(p, inp, "a1", 0, "g8f6", DELAY + 9_000);
    const out = resolveHalf(p, inp, { a0: 1_000, a1: DELAY + 2_000, b2: 1_000, b3: 1_000 });
    expect(out.match.banks).toEqual([BANK - 9_000, BANK]);
  });

  it("Armageddon carries on with the block bank the final left", () => {
    const f = final("7k/8/6Q1/8/8/8/8/K7 w - - 0 1");
    const out = resolveHalf(f, inputs(f, { a0: "g6f7" }));
    const arm = startArmageddon({ ...out.match, blockBanks: [1, 3] }, 0, { fen: START_FEN, openingId: null });
    expect(arm.blockBanks).toEqual([1, 3]);
  });

  it("a whole Relay match with blocks replays exactly", () => {
    const play = () => {
      let m = relay();
      const rng = mulberry32(9);
      const log: SquadsEvent[] = [];
      for (let i = 0; i < 30 && !m.result; i++) {
        let inp = NO_INPUTS;
        for (const d of halfDuties(m).duties) {
          if (rng() < 0.3) {
            const them = m.half === "w" ? "b" : "w";
            const fen = m.boards[d.board]!.fen;
            const froms = [...piecesOf(fen)].filter(([, p]) => (p === p.toUpperCase() ? "w" : "b") === them && p.toLowerCase() !== "k").map(([sq]) => sq);
            const from = froms[Math.floor(rng() * froms.length)];
            const to = from ? blockTargets(fen, from, them)[0] : undefined;
            if (from && to) {
              const r = placeBlock(m, inp, d.players[0]!, d.board, from + to, 100);
              if ("inputs" in r) inp = r.inputs;
            }
          }
          const allowed = movesAllowed(m, d.board);
          const r = choose(m, inp, d.players[0]!, allowed[Math.floor(rng() * allowed.length)]!);
          if ("inputs" in r) inp = r.inputs;
        }
        const out = resolveHalf(m, inp);
        log.push(...out.events);
        m = out.match;
      }
      return { m, log };
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(a.log.some((e) => e.kind === "block" && e.outcome === "on")).toBe(true);
  });
});

describe("Squads v2: bots", () => {
  const top: MoveScore[] = [
    { move: "e2e4", expected: 0.55, reply: "e7e5" },
    { move: "d2d4", expected: 0.54, reply: "d7d5" },
    { move: "g1f3", expected: 0.52 },
  ];

  it("a pair bot matches its partner only on an only move with a token left; otherwise picks differ", () => {
    const only: MoveScore[] = [
      { move: "d1d8", expected: 0.9 },
      { move: "e2e4", expected: 0.9 - SQUADS.bots.sameMoveGap },
    ];
    expect(isOnlyMove(only, "d1d8")).toBe(true);
    expect(isOnlyMove(only, "e2e4")).toBe(false);
    expect(isOnlyMove(top, "e2e4")).toBe(false);
    expect(isOnlyMove([{ move: "d1d8", expected: 0.5 }], "d1d8")).toBe(true);
    const rng = mulberry32(4);
    const legal = legalMoves(START_FEN);
    expect(botPairPick(rng, candidatesFrom(top), 4, legal, "e2e4", isOnlyMove(top, "e2e4"))).not.toBe("e2e4");
    expect(botPairPick(rng, candidatesFrom(top), 4, legal, "e2e4", true)).toBe("e2e4");
  });

  it("the moves a block takes away are out of a bot's choice", () => {
    expect(topAllowed(top, ["e2e4"]).map((t) => t.move)).toEqual(["d2d4", "g1f3"]);
    expect(topAllowed(top, ["e2e4", "g1f3"]).map((t) => t.move)).toEqual(["d2d4"]);
    expect(topAllowed(top, [])).toEqual(top);
  });

  it("blocks sparingly: the other squad's likely reply, by chance; a sharp reply (a capture or a check) likelier", () => {
    const always: SquadsSettings = { ...SQUADS, bots: { ...SQUADS.bots, blockChance: 1, sharpChance: 1, blockReserve: 0 } };
    const never: SquadsSettings = { ...SQUADS, bots: { ...SQUADS.bots, blockChance: 0, sharpChance: 0 } };
    const rng = mulberry32(5);
    expect(botBlock(rng, { fen: START_FEN, ownMove: "e2e4", reply: "e7e5", bank: 5 }, always)).toBe("e7e5");
    expect(botBlock(rng, { fen: START_FEN, ownMove: "e2e4", reply: "e7e5", bank: 5 }, never)).toBeNull();
    // A capture after the bot's move is sharp: with only the sharp chance on, it blocks that but not a quiet one.
    const sharpOnly: SquadsSettings = { ...SQUADS, bots: { ...SQUADS.bots, blockChance: 0, sharpChance: 1, blockReserve: 0 } };
    const scandi = "rnbqkbnr/ppp1pppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 2";
    expect(botBlock(rng, { fen: scandi, ownMove: "e2e4", reply: "d5e4", bank: 5 }, sharpOnly)).toBe("d5e4");
    expect(botBlock(rng, { fen: START_FEN, ownMove: "e2e4", reply: "e7e5", bank: 5 }, sharpOnly)).toBeNull();
    // At the default chances, rarely.
    const share = Array.from({ length: 400 }, () => botBlock(rng, { fen: START_FEN, ownMove: "e2e4", reply: "e7e5", bank: 5 })).filter(Boolean).length / 400;
    expect(share).toBeGreaterThan(SQUADS.bots.blockChance - 0.07);
    expect(share).toBeLessThan(SQUADS.bots.blockChance + 0.07);
  });

  it("never the king's ordinary moves, never one it can't afford or that would leave less than its reserve, never one a mercy rule would lift", () => {
    const always: SquadsSettings = { ...SQUADS, bots: { ...SQUADS.bots, blockChance: 1, sharpChance: 1 } };
    const rng = mulberry32(6);
    expect(botBlock(rng, { fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", ownMove: "e2e3", reply: "e8d7", bank: 5 }, always)).toBeNull();
    expect(botBlock(rng, { fen: START_FEN, ownMove: "e2e4", reply: "g8f6", bank: 1 }, always)).toBeNull();
    expect(botBlock(rng, { fen: START_FEN, ownMove: "e2e4", reply: "g8f6", bank: 2 + SQUADS.bots.blockReserve - 1 }, always)).toBeNull();
    expect(botBlock(rng, { fen: START_FEN, ownMove: "e2e4", reply: "g8f6", bank: 2 + SQUADS.bots.blockReserve }, always)).toBe("g8f6");
    // Its own move takes the piece: the block would be lifted.
    expect(botBlock(rng, { fen: BG5, ownMove: "g5f6", reply: "f6e4", bank: 5 }, always)).toBeNull();
    expect(botBlock(rng, { fen: START_FEN, ownMove: "e2e4", reply: undefined, bank: 5 }, always)).toBeNull();
  });

  it("a forced board (one allowed move) asks nothing, block or not", () => {
    const b = newSquadsBoard(0, { fen: ONE_MOVE, openingId: null }, 0);
    const m = { ...pairs(), boards: [b, pairs().boards[1]!] };
    expect(halfDuties(m).forced).toEqual([0]);
  });
});
