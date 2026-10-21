import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { buyOffer, emptyArmy, inHalf, kingSquares, usableSquares } from "../src/autochess/army.ts";
import {
  adjustBlock,
  adjustMarks,
  adjustMove,
  adjustWords,
  botMoveSeed,
  legalTargets,
  movablePieces,
  movePick,
  movesUsed,
  pickTargets,
  startAdjust,
  startMove,
  undoAction,
  undoBlock,
  youMoveSeed,
} from "../src/autochess/adjust.ts";
import { botMove } from "../src/autochess/bot.ts";
import { fightStart } from "../src/autochess/position.ts";
import type { Army, Kind } from "../src/autochess/types.ts";

/**
 * The move step (v7, Eric Oct 21: "it highlights one piece at random of yours and you get 7 seconds to do a LEGAL move on your half
 * of the board"): the piece picked at random (seeded; never the king; only one with a legal chess move that stays on your half), the
 * moves it may make, skipping, no piece qualifying, and the bot's own pick and best move. The old step (teleport) is in
 * autochess-rules.test.ts.
 */

const army = (color: "w" | "b", king: string, board: Record<string, Kind> = {}): Army => ({ color, king, board, bench: [] });
const them = (board: Record<string, Kind> = {}) => army("b", "g8", board);
const TELE: AutoChessSettings = { ...AUTOCHESS, adjustMode: "teleport" };

describe("auto chess: the move step's numbers (v7)", () => {
  it("is the legal mode with 7 seconds, one move, and the old step kept behind the setting", () => {
    expect(AUTOCHESS.adjustMode).toBe("legal");
    expect(AUTOCHESS.adjustSeconds).toBe(7);
    expect(AUTOCHESS.adjustMoves).toBe(1);
    expect(AUTOCHESS.adjustStep).toBe(true);
    expect(TELE.adjustMode).toBe("teleport");
  });
});

describe("auto chess: the legal moves of a piece that stay on your half", () => {
  const w = army("w", "e1", { d2: "n", a2: "p", b3: "p", c4: "p", a1: "r", f1: "b", d1: "q" });

  it("follow chess: a knight jumps, a pawn steps one (two from its start rank), the pieces in the way block a slider", () => {
    // The knight on d2: b1, e4, f3 (b3 and c4 hold pawns of ours, f1 a bishop; the others are off the half or off the board).
    expect(legalTargets(w, them(), "d2")).toEqual(["b1", "e4", "f3"]);
    // Pawns: a2 one or two steps (a3, a4), b3 one step to b4, c4 none (b5... c5 is their half).
    expect(legalTargets(w, them(), "a2")).toEqual(["a3", "a4"]);
    expect(legalTargets(w, them(), "b3")).toEqual(["b4"]);
    expect(legalTargets(w, them(), "c4")).toEqual([]);
    // The rook on a1 is shut in by its own pawn on a2 and the queen on d1: it has b1 and c1.
    expect(legalTargets(w, them(), "a1")).toEqual(["b1", "c1"]);
    // The bishop on f1 slides up both diagonals as far as the half goes: e2 (d3, c4 is a pawn of ours) and g2 (h3).
    expect(legalTargets(w, them(), "f1")).toEqual(["d3", "e2", "g2", "h3"]);
    // Nothing for a piece that isn't there.
    expect(legalTargets(w, them(), "h4")).toEqual([]);
  });

  it("never leave your half or capture (nothing of theirs stands on your half), whatever the piece, over many random armies of both colors", () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = mulberry32(seed);
      const color = seed % 2 ? "w" : "b";
      const kings = kingSquares(seed);
      let mine = emptyArmy(color, kings[color]);
      let theirs = emptyArmy(color === "w" ? "b" : "w", kings[color === "w" ? "b" : "w"]);
      const kinds: Kind[] = ["p", "p", "n", "b", "r", "q", "p", "n"];
      for (const kind of kinds) {
        const freeMine = usableSquares(mine, kind);
        if (freeMine.length && rng() < 0.8) mine = buyOffer(mine, { kind, square: freeMine[Math.floor(rng() * freeMine.length)]! });
        const freeTheirs = usableSquares(theirs, kind);
        if (freeTheirs.length && rng() < 0.8) theirs = buyOffer(theirs, { kind, square: freeTheirs[Math.floor(rng() * freeTheirs.length)]! });
      }
      for (const piece of movablePieces(mine, theirs)) {
        expect(piece.targets.length).toBeGreaterThan(0);
        expect(piece.square).not.toBe(mine.king);
        for (const to of piece.targets) {
          expect(inHalf(to, mine.color), `${piece.kind} ${piece.square} to ${to}`).toBe(true);
          expect(mine.board[to], `${piece.square} to ${to}`).toBeUndefined();
          expect(to).not.toBe(mine.king);
          expect(to).not.toBe(piece.square);
        }
      }
    }
  });

  it("a pinned piece may not leave its line, and a king in check leaves only the moves that answer it", () => {
    // A bishop on e2 between our king (e1) and their rook (e8) is pinned: any bishop move opens the file. The knight on b1 is free.
    const pinned = army("w", "e1", { e2: "b", b1: "n" });
    expect(legalTargets(pinned, them({ e8: "r" }), "e2")).toEqual([]);
    expect(movablePieces(pinned, them({ e8: "r" })).map((p) => p.square)).toEqual(["b1"]);
    // Without the rook the bishop moves (d1... f3, as far as the half goes).
    expect(legalTargets(pinned, them(), "e2").length).toBeGreaterThan(0);
    // In check from that rook (nothing between): only a piece that can step into the file moves, and only there.
    const checked = army("w", "e1", { c3: "n", h2: "p" });
    expect(legalTargets(checked, them({ e8: "r" }), "c3")).toEqual(["e2", "e4"]);
    expect(legalTargets(checked, them({ e8: "r" }), "h2")).toEqual([]);
    expect(movablePieces(checked, them({ e8: "r" })).map((p) => p.square)).toEqual(["c3"]);
  });

  it("works when your own pieces give check to their king (the position isn't one the fight would start from, but the step still plays)", () => {
    const mine = army("w", "e1", { e4: "r", c3: "n" });
    expect(() => movablePieces(mine, them())).not.toThrow();
    expect(movablePieces(mine, army("b", "e8")).length).toBeGreaterThan(0);
  });
});

describe("auto chess: the piece picked for the move step", () => {
  const w = army("w", "e1", { d2: "n", a2: "p", b3: "p", c4: "p", a1: "r", f1: "b", d1: "q", h4: "p" });

  it("is one of your pieces with a legal move that stays on your half: never the king, never a pawn at the half's edge or a shut-in piece", () => {
    const movable = movablePieces(w, them()).map((p) => p.square);
    // c4 and h4 are pawns on the half's last rank (their next step is their half); and the king never is one.
    expect(movable).not.toContain("e1");
    expect(movable).not.toContain("c4");
    expect(movable).not.toContain("h4");
    expect(movable).toContain("d2");
    for (let seed = 0; seed < 500; seed++) {
      const pick = movePick(w, them(), seed)!;
      expect(pick).not.toBeNull();
      expect(movable).toContain(pick.square);
      expect(pick.kind).toBe(w.board[pick.square]);
      expect(pick.targets).toEqual(legalTargets(w, them(), pick.square));
    }
  });

  it("is seeded: the same seed, the same piece; and over seeds every movable piece gets picked, about as often as each other", () => {
    expect(movePick(w, them(), 123)).toEqual(movePick(w, them(), 123));
    const movable = movablePieces(w, them()).map((p) => p.square);
    const counts = new Map<string, number>();
    const N = 6000;
    for (let seed = 0; seed < N; seed++) {
      const sq = movePick(w, them(), seed * 2654435761)!.square;
      counts.set(sq, (counts.get(sq) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...movable].sort());
    for (const [sq, n] of counts) expect(Math.abs(n - N / movable.length), sq).toBeLessThan(N / movable.length / 4);
  });

  it("is null when no piece qualifies (only a king, or every piece shut in or pinned or at the edge): no move step for you that round", () => {
    expect(movePick(army("w", "e1"), them(), 1)).toBeNull();
    // A lone pawn on the half's last rank can only step into their half.
    expect(movePick(army("w", "e1", { c4: "p" }), them(), 1)).toBeNull();
    // A lone pinned bishop.
    expect(movePick(army("w", "e1", { e2: "b" }), them({ e8: "r" }), 1)).toBeNull();
    const none = startMove(army("w", "e1"), them(), 1);
    expect(none.pick).toBeNull();
    // Whatever is tapped, the reason is "no piece can move" (the king's own reason first).
    expect(adjustBlock(startMove(army("w", "e1", { c4: "p" }), them(), 1), "c4", "c5")).toBe("nomove");
    expect(adjustBlock(none, "e1", "e2")).toBe("kingfixed");
    expect(adjustWords("nomove")).toBe("No piece can move");
    expect(pickTargets(none)).toEqual([]);
  });

  it("yours and the bot's come from different draws of the round's seed", () => {
    for (let seed = 0; seed < 100; seed++) expect(youMoveSeed(seed * 7919)).not.toBe(botMoveSeed(seed * 7919));
  });

  it("works for Black too (its half is ranks 5 to 8; its pawns step down the board)", () => {
    const black = army("b", "e8", { a7: "p", g8: "n", d7: "b" });
    const pick = movablePieces(black, army("w", "e1"));
    expect(pick.map((p) => p.square)).toEqual(["a7", "d7", "g8"]);
    expect(legalTargets(black, army("w", "e1"), "a7")).toEqual(["a5", "a6"]);
    for (const p of pick) for (const to of p.targets) expect(inHalf(to, "b")).toBe(true);
  });
});

describe("auto chess: playing the move (legal mode)", () => {
  const w = army("w", "e1", { d2: "n", a2: "p", b3: "p", c4: "p" });
  const start = () => startMove(w, them(), 5);
  /** The pick for seed 5 is whichever it is: tests read it, so they hold whatever the seed gives. */
  const pick = () => start().pick!;

  it("lights the picked piece's squares until it has moved; any other piece is 'not the lit one', a square it can't reach 'not legal', and the half's and square's own reasons come first", () => {
    const s = start();
    const p = s.pick!;
    expect(pickTargets(s)).toEqual(p.targets);
    expect(adjustBlock(s, p.square, p.targets[0]!)).toBeNull();
    // Another piece of yours (any of the others that has a move, or none).
    const other = Object.keys(w.board).find((sq) => sq !== p.square)!;
    expect(adjustBlock(s, other, "h2")).toBe("notpicked");
    // The picked piece: off your half, onto a piece, onto your king, or a square it can't reach.
    expect(adjustBlock(s, p.square, "e5")).toBe("half");
    expect(adjustBlock(s, p.square, "a2")).toBe(p.square === "a2" ? null : "taken");
    expect(adjustBlock(s, p.square, "e1")).toBe("king");
    const unreachable = ["h1", "h2", "h3", "g1", "g2", "g3", "f2", "f4", "e3", "h4"].find((sq) => !p.targets.includes(sq) && !w.board[sq] && sq !== w.king)!;
    expect(adjustBlock(s, p.square, unreachable)).toBe("illegal");
    expect(adjustBlock(s, "h3", "h4")).toBe("none");
    expect(adjustBlock(s, "e1", "e2")).toBe("kingfixed");
    expect(adjustWords("notpicked")).toBe("Only the lit piece");
    expect(adjustWords("illegal")).toBe("Not a legal move");
  });

  it("one legal move, and then it is used: nothing more, nothing lit; it can be taken back (the lit piece may go again) and skipping is simply not moving", () => {
    let s = start();
    const p = s.pick!;
    const to = p.targets[0]!;
    s = adjustMove(s, p.square, to);
    expect(s.army.board[to]).toBe(p.kind);
    expect(s.army.board[p.square]).toBeUndefined();
    expect(movesUsed(s)).toBe(1);
    expect(adjustMarks(s)).toEqual([{ square: to, action: "move" }]);
    expect(pickTargets(s)).toEqual([]);
    expect(adjustBlock(s, to, p.targets[1] ?? "h3")).toBe("used");
    expect(adjustBlock(s, "a2", "a3")).toBe("used");
    // (The square the piece left is empty now: still "used", not "no piece there", for a tap on it.)
    expect(adjustBlock(s, p.square, p.targets[1] ?? "h2")).toBe("used");
    expect(undoBlock(s, to)).toBeNull();
    const undone = undoAction(s, to);
    expect(undone.army).toEqual(w);
    expect(pickTargets(undone)).toEqual(p.targets);
    expect(adjustBlock(undone, p.square, p.targets[1] ?? p.targets[0]!)).toBeNull();
    // Skipping: nothing played, the army is as it was.
    expect(start().army).toEqual(w);
    expect(start().actions).toEqual([]);
  });

  it("the legal mode's moves are always teleport moves too, so taking back and replaying one never refuses it (a fuzz over random armies)", () => {
    for (let seed = 0; seed < 150; seed++) {
      const rng = mulberry32(seed);
      const color = seed % 2 ? "w" : "b";
      const kings = kingSquares(seed);
      let mine = emptyArmy(color, kings[color]);
      for (const kind of ["p", "p", "p", "n", "b", "r", "q", "p"] as Kind[]) {
        const free = usableSquares(mine, kind);
        if (free.length) mine = buyOffer(mine, { kind, square: free[Math.floor(rng() * free.length)]! });
      }
      const theirs = emptyArmy(color === "w" ? "b" : "w", kings[color === "w" ? "b" : "w"]);
      const s = startMove(mine, theirs, seed);
      if (!s.pick) continue;
      for (const to of s.pick.targets) {
        expect(adjustBlock(s, s.pick.square, to), `${s.pick.square} to ${to}`).toBeNull();
        const moved = adjustMove(s, s.pick.square, to);
        expect(undoAction(moved, to).army).toEqual(mine);
      }
    }
  });

  it("the position after both sides' moves is one the fight accepts (a legal move never leaves your own king in check; check on theirs is the start-in-check rule's)", () => {
    for (let seed = 0; seed < 100; seed++) {
      const kings = kingSquares(seed);
      let a = emptyArmy("w", kings.w);
      let b = emptyArmy("b", kings.b);
      const rng = mulberry32(seed + 77);
      for (const kind of ["p", "n", "b", "r", "q", "p"] as Kind[]) {
        const fa = usableSquares(a, kind);
        const fb = usableSquares(b, kind);
        if (fa.length) a = buyOffer(a, { kind, square: fa[Math.floor(rng() * fa.length)]! });
        if (fb.length) b = buyOffer(b, { kind, square: fb[Math.floor(rng() * fb.length)]! });
      }
      const sa = startMove(a, b, seed);
      const sb = startMove(b, a, seed + 1);
      const na = sa.pick ? adjustMove(sa, sa.pick.square, sa.pick.targets[0]!).army : a;
      const nb = sb.pick ? adjustMove(sb, sb.pick.square, sb.pick.targets[0]!).army : b;
      // Each moved only its own piece: the fight starts, or is the drawn round of two kings in check.
      expect(() => fightStart(na, nb)).not.toThrow();
    }
  });
});

describe("auto chess: the bot's move step (v7: its own random piece, and the engine's best move with it)", () => {
  const mine = army("b", "e8", { d7: "n", a7: "p", b6: "p", c5: "p", a8: "r", f8: "b" });
  const you = army("w", "e1", { d2: "n", a2: "p" });

  it("plays only its picked piece (the one `startMove` picks for the same seed), the move the evaluator likes best among that piece's legal ones, and only if it beats standing still", async () => {
    const seed = botMoveSeed(777);
    const pick = startMove(mine, you, seed).pick!;
    expect(pick).not.toBeNull();
    // An evaluator that likes one particular target the best.
    const favorite = pick.targets[pick.targets.length - 1]!;
    const calls: Army[] = [];
    const evaluate = async (a: Army) => {
      calls.push(a);
      return a.board[favorite] === pick.kind ? 0.9 : 0.5;
    };
    let told: Army | null = null;
    const out = await botMove(mine, you, seed, evaluate, () => false, AUTOCHESS, (a) => (told = a));
    expect(out.board[favorite]).toBe(pick.kind);
    expect(out.board[pick.square]).toBeUndefined();
    expect(told).toEqual(out);
    // Everything else stands where it did: one piece, one move.
    const rest = Object.entries(mine.board).filter(([sq]) => sq !== pick.square);
    for (const [sq, k] of rest) expect(out.board[sq]).toBe(k);
    expect(Object.keys(out.board)).toHaveLength(Object.keys(mine.board).length);
    // It looked at standing still and at that piece's moves only (up to the tries setting).
    expect(calls.length).toBe(1 + Math.min(AUTOCHESS.bot.adjustTries, pick.targets.length));
    // An evaluator that likes standing still best: it skips.
    const stay = await botMove(mine, you, seed, async (a) => (a === mine ? 0.9 : 0.4), () => false);
    expect(stay).toBe(mine);
    // Better, but by less than the margin: it skips too.
    const small = await botMove(mine, you, seed, async (a) => (a === mine ? 0.5 : 0.5 + AUTOCHESS.bot.adjustMargin / 2), () => false);
    expect(small).toBe(mine);
  });

  it("does nothing when no piece of its own can move, and stops when told the step is over", async () => {
    const lone = army("b", "e8");
    const calls: Army[] = [];
    expect(await botMove(lone, you, 1, async (a) => (calls.push(a), 0.5), () => false)).toBe(lone);
    expect(calls).toHaveLength(0);
    // Stopped at once: nothing but the look at standing still, and no move.
    const out = await botMove(mine, you, 1, async () => 0.5, () => true);
    expect(out).toBe(mine);
  });

  it("over many seeds its pick and move stay legal and on its half, whatever the evaluator says", async () => {
    for (let seed = 0; seed < 60; seed++) {
      const rng = mulberry32(seed);
      const kings = kingSquares(seed);
      let b = emptyArmy("b", kings.b);
      let a = emptyArmy("w", kings.w);
      for (const kind of ["p", "p", "n", "b", "r", "q"] as Kind[]) {
        const fb = usableSquares(b, kind);
        const fa = usableSquares(a, kind);
        if (fb.length) b = buyOffer(b, { kind, square: fb[Math.floor(rng() * fb.length)]! });
        if (fa.length) a = buyOffer(a, { kind, square: fa[Math.floor(rng() * fa.length)]! });
      }
      const out = await botMove(b, a, botMoveSeed(seed), async () => rng(), () => false);
      const before = Object.entries(b.board).sort().join();
      if (Object.entries(out.board).sort().join() !== before) {
        const gone = Object.keys(b.board).filter((sq) => out.board[sq] !== b.board[sq]);
        const came = Object.keys(out.board).filter((sq) => out.board[sq] !== b.board[sq]);
        expect(gone).toHaveLength(1);
        expect(came).toHaveLength(1);
        expect(legalTargets(b, a, gone[0]!)).toContain(came[0]);
        expect(inHalf(came[0]!, "b")).toBe(true);
      }
    }
  });
});
