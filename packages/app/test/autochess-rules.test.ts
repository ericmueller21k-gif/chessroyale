import { describe, expect, it } from "vitest";
import { AUTOCHESS } from "@chessroyale/core";
import { stockfishRefuses } from "@chessroyale/chess";
import {
  autoDrop,
  benchFixed,
  boardCount,
  boardPieces,
  buy,
  buyBlock,
  buyWords,
  emptyArmy,
  extras,
  firstGoodSquare,
  halfSquares,
  inHalf,
  kingSquares,
  legalCounts,
  moveOnBoard,
  owned,
  pawnFixed,
  placeBlock,
  placeFromBench,
  placeWords,
  sellPiece,
  sellValue,
  toBench,
} from "../src/autochess/army.ts";
import {
  adjustBlock,
  adjustDrop,
  adjustMarks,
  adjustMove,
  adjustTargets,
  adjustWords,
  dropBlock,
  dropSquareBlock,
  dropsUsed,
  dropWords,
  movesUsed,
  startAdjust,
  undoAction,
  undoBlock,
  undoWords,
} from "../src/autochess/adjust.ts";
import { armiesFen, fightStart, material, piecesOn } from "../src/autochess/position.ts";
import type { Army, Kind } from "../src/autochess/types.ts";

const army = (color: "w" | "b", king: string, board: Record<string, Kind> = {}, bench: Kind[] = []): Army => ({ color, king, board, bench });

describe("auto chess: the shop", () => {
  it("sells for 90%, rounded down (P9 N27 B28 R45 Q81)", () => {
    expect(["p", "n", "b", "r", "q"].map((k) => sellValue(k as Kind))).toEqual([9, 27, 28, 45, 81]);
    const a = buy(emptyArmy("w", "e1"), "n");
    expect(sellPiece(a, { bench: 0 })).toEqual({ army: emptyArmy("w", "e1"), gold: 27 });
    const placed = placeFromBench(a, 0, "c3");
    expect(sellPiece(placed, { square: "c3" })).toEqual({ army: emptyArmy("w", "e1"), gold: 27 });
  });

  it("the prices are pawn 10, knight 30, bishop 32, rook 50, queen 90", () => {
    expect(AUTOCHESS.prices).toEqual({ p: 10, n: 30, b: 32, r: 50, q: 90 });
  });

  it("says why a piece can't be bought: a limit, the bench, then gold", () => {
    const a = emptyArmy("w", "e1");
    expect(buyBlock(a, 100, "p")).toBeNull();
    expect(buyBlock(a, 9, "p")).toBe("gold");
    expect(buyBlock(a, 89, "q")).toBe("gold");
    expect(buyBlock(a, 90, "q")).toBeNull();
    // One queen a round, whatever the gold.
    expect(buyBlock(buy(a, "q"), 500, "q")).toBe("queen");
    // The bench: eight slots.
    const eightKnightsAndRooks: Kind[] = ["n", "n", "b", "b", "r", "r", "q"];
    expect(buyBlock({ ...a, bench: eightKnightsAndRooks }, 500, "p")).toBeNull();
    expect(buyBlock({ ...a, bench: [...eightKnightsAndRooks, "p"] }, 500, "p")).toBe("bench");
    // Gold is last: with a full bench and no gold, the bench is named.
    expect(buyBlock({ ...a, bench: [...eightKnightsAndRooks, "p"] }, 0, "p")).toBe("bench");
  });

  it("limits pawns to 8, and extra pieces to 8 minus the pawns (the engine refuses more)", () => {
    const a = emptyArmy("w", "e1");
    const eightPawns = { ...a, bench: Array.from({ length: 8 }, () => "p" as Kind) };
    expect(buyBlock(eightPawns, 500, "p")).toBe("pawns");
    // 7 pawns + the starting set + 1 extra knight = 8 beyond... a ninth piece past the set needs a pawn fewer.
    const sevenPawnsOneExtra: Army = { ...a, board: { a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", a1: "n", b1: "n", c1: "n" } };
    expect(extras(owned(sevenPawnsOneExtra))).toBe(1);
    expect(legalCounts(owned(sevenPawnsOneExtra))).toBe(true);
    expect(buyBlock(sevenPawnsOneExtra, 500, "p")).toBe("extras");
    expect(buyBlock(sevenPawnsOneExtra, 500, "n")).toBe("extras");
    // The starting set itself is free: 1 queen, 2 rooks, 2 bishops, 2 knights with 8 pawns.
    expect(legalCounts({ p: 8, n: 2, b: 2, r: 2, q: 1 })).toBe(true);
    expect(legalCounts({ p: 8, n: 3, b: 2, r: 2, q: 1 })).toBe(false);
    expect(legalCounts({ p: 4, n: 4, b: 4, r: 2, q: 1 })).toBe(true);
    expect(legalCounts({ p: 4, n: 5, b: 4, r: 2, q: 1 })).toBe(false);
    expect(buyWords("extras", "n", 0).line).toContain("can't pass 8");
  });

  it("has words for every reason", () => {
    for (const block of ["gold", "bench", "queen", "pawns", "extras"] as const) {
      const w = buyWords(block, "q", 10);
      expect(w.short.length).toBeGreaterThan(0);
      expect(w.line.endsWith(".")).toBe(true);
    }
    expect(buyWords("gold", "q", 10).line).toBe("Not enough gold: a queen costs 90 and you have 10.");
    expect(buyWords("queen", "q", 100).line).toBe("One queen a round.");
  });
});

describe("auto chess: the kings", () => {
  it("stand on mirrored squares (the same file), on the back two ranks of each side, and vary with the seed", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const k = kingSquares(seed);
      expect(k.w[0]).toBe(k.b[0]);
      expect(Number(k.w[1]) + Number(k.b[1])).toBe(9);
      expect([1, 2]).toContain(Number(k.w[1]));
      expect([7, 8]).toContain(Number(k.b[1]));
      seen.add(k.w);
    }
    // Any file, either rank: 16 squares, and a few hundred seeds see most of them.
    expect(seen.size).toBeGreaterThan(12);
    expect(kingSquares(42)).toEqual(kingSquares(42));
  });

  it("the back ranks count is a setting", () => {
    for (let seed = 0; seed < 100; seed++) expect(Number(kingSquares(seed, { ...AUTOCHESS, kingRanks: 1 }).w[1])).toBe(1);
  });
});

describe("auto chess: placing", () => {
  const a = army("w", "e1", { a3: "p", b3: "p", c3: "p", c1: "r" });
  it("only your own half, never the king's square or a taken one", () => {
    expect(halfSquares("w")).toHaveLength(32);
    expect(halfSquares("b").every((s) => inHalf(s, "b"))).toBe(true);
    expect(placeBlock(a, "n", "e4")).toBeNull();
    expect(placeBlock(a, "n", "e5")).toBe("half");
    expect(placeBlock(a, "n", "e1")).toBe("king");
    expect(placeBlock(a, "n", "c1")).toBe("taken");
    const black = army("b", "e8");
    expect(placeBlock(black, "n", "e5")).toBeNull();
    expect(placeBlock(black, "n", "e4")).toBe("half");
  });

  it("a pawn can't stand on your back rank, or be a fourth in its file", () => {
    expect(placeBlock(a, "p", "d1")).toBe("backrank");
    expect(placeBlock(army("b", "e8"), "p", "d8")).toBe("backrank");
    expect(placeBlock(army("b", "e8"), "p", "d1")).toBe("half");
    const stack = army("w", "e1", { a2: "p", a3: "p", a4: "p" });
    expect(placeBlock(stack, "p", "a2", undefined)).toBe("taken");
    // (A half has only three squares in a file for a pawn, ranks 2 to 4, so three a file holds by itself; the setting is for trying two.)
    const two = { ...AUTOCHESS, pawnsPerFile: 2 };
    const pair = army("w", "e1", { a2: "p", a3: "p", b4: "p" });
    expect(placeBlock(pair, "p", "a4", undefined, two)).toBe("file");
    expect(placeBlock(pair, "p", "a4")).toBeNull();
    expect(placeBlock(pair, "p", "b3", undefined, two)).toBeNull();
    // A pawn moving along its own file isn't counted twice.
    const full = army("w", "e1", { a2: "p", a3: "p", a4: "p" });
    expect(placeBlock(full, "p", "a4", "a3")).toBe("taken");
    expect(placeBlock({ ...full, board: { a2: "p", a3: "p" } }, "p", "a4", "a3")).toBeNull();
    // A rook in that file doesn't count.
    expect(placeBlock(army("w", "e1", { a2: "r", a3: "p" }), "p", "a4", undefined, { ...AUTOCHESS, pawnsPerFile: 2 })).toBeNull();
    for (const b of ["half", "king", "taken", "backrank", "file"] as const) expect(placeWords(b).endsWith(".")).toBe(true);
  });

  it("the bench: pieces go on, come off onto the board, and back", () => {
    let x = emptyArmy("w", "e1");
    x = buy(buy(x, "n"), "p");
    expect(x.bench).toEqual(["n", "p"]);
    x = placeFromBench(x, 0, "c3");
    expect(x).toEqual({ color: "w", king: "e1", board: { c3: "n" }, bench: ["p"] });
    x = moveOnBoard(x, "c3", "d4");
    expect(x.board).toEqual({ d4: "n" });
    x = toBench(x, "d4");
    expect(x).toEqual({ color: "w", king: "e1", board: {}, bench: ["p", "n"] });
    expect(boardPieces(placeFromBench(x, 0, "a3"))).toEqual([{ square: "a3", kind: "p" }]);
  });
});

describe("auto chess: the board limit and the bench's auto-drop (v5)", () => {
  /** Ten pieces on White's half: eight pawns on rank 3 and two knights on b1 and g1 (the king on e1). */
  const ten: Record<string, Kind> = { a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", h3: "p", b1: "n", g1: "n" };

  it("holds at most 10 pieces and the king on a side's board, and says why", () => {
    expect(AUTOCHESS.boardLimit).toBe(10);
    expect(AUTOCHESS.benchSlots).toBe(8);
    const nine = army("w", "e1", Object.fromEntries(Object.entries(ten).slice(0, 9)), ["b"]);
    expect(boardCount(nine)).toBe(9);
    expect(placeBlock(nine, "b", "c1")).toBeNull();
    const full = army("w", "e1", ten, ["b"]);
    expect(boardCount(full)).toBe(10);
    expect(placeBlock(full, "b", "c1")).toBe("limit");
    expect(placeBlock(full, "p", "a2")).toBe("limit");
    expect(placeBlock(full, "b", "c1", undefined, { ...AUTOCHESS, boardLimit: 11 })).toBeNull();
    // A taken square or someone's half is named first; a piece already on the board may still move about.
    expect(placeBlock(full, "b", "a3")).toBe("taken");
    expect(placeBlock(full, "b", "a5")).toBe("half");
    expect(placeBlock(full, "n", "c1", "b1")).toBeNull();
    expect(placeWords("limit")).toBe("Your board is full: 10 pieces and your king at most.");
    // Black's board is limited the same way.
    expect(placeBlock(army("b", "e8", Object.fromEntries(Object.keys(ten).map((_, i) => [`${"abcdefgh"[i % 8]}${6 - Math.floor(i / 8)}`, "p" as Kind]))), "n", "c8")).toBe("limit");
  });

  it("when buying ends, bench pieces drop left to right in bench order, each on its first good square: pawns in front, pieces behind", () => {
    const a = army("w", "e1", {}, ["n", "p", "p", "r", "p"]);
    const { army: out, dropped } = autoDrop(a);
    expect(dropped).toBe(5);
    expect(out.bench).toEqual([]);
    // The knight first: the back rank from the left; then pawns on the third rank from the left, then the rook next on the back rank.
    expect(out.board).toEqual({ a1: "n", a3: "p", b3: "p", b1: "r", c3: "p" });
    expect(out.king).toBe("e1");
    // Black's half is at the bottom of its screen, turned: its files run h to a, its home is the eighth rank.
    const black = autoDrop(army("b", "e8", {}, ["p", "q", "p"])).army;
    expect(black.board).toEqual({ h6: "p", h8: "q", g6: "p" });
    expect(firstGoodSquare(army("b", "e8"), "n")).toBe("h8");
  });

  it("skips the king's square, taken squares and the pawn rules; a full third rank sends pawns to the fourth", () => {
    const a = army("w", "a3", { b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", h3: "p" }, ["p", "n", "r"]);
    // (The king stands on a3, so the third rank has no square left: the pawn goes to the fourth rank's a4.)
    const out = autoDrop(a, { ...AUTOCHESS, autoDropTo: 10 }).army;
    expect(out.board.a4).toBe("p");
    expect(out.board.a1).toBe("n");
    expect(out.board.b1).toBe("r");
    expect(autoDrop(army("w", "a1", {}, ["n"])).army.board).toEqual({ b1: "n" });
    // Three pawns in a file at most: with a2, a3 and a4 taken a pawn finds another file.
    expect(firstGoodSquare(army("w", "e1", { a2: "p", a3: "p", a4: "p" }), "p")).toBe("b3");
  });

  it("stops when the board has 8: 8 on the board and 2 on the bench, they won't drop in; with 6 on the board only two do", () => {
    const eight: Record<string, Kind> = { a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", a1: "r", h1: "r" };
    const stay = autoDrop(army("w", "e1", eight, ["n", "b"]));
    expect(stay.dropped).toBe(0);
    expect(stay.army.bench).toEqual(["n", "b"]);
    expect(stay.army.board).toEqual(eight);
    const six = Object.fromEntries(Object.entries(eight).slice(0, 6));
    const two = autoDrop(army("w", "e1", six, ["n", "b", "r", "q"]));
    expect(two.dropped).toBe(2);
    expect(boardCount(two.army)).toBe(8);
    // The first two in bench order dropped; the others wait, in order.
    expect(two.army.bench).toEqual(["r", "q"]);
    expect(Object.values(two.army.board).filter((k) => k === "n" || k === "b")).toHaveLength(2);
    // The number is a setting.
    expect(AUTOCHESS.autoDropTo).toBe(8);
    expect(autoDrop(army("w", "e1", eight, ["n", "b"]), { ...AUTOCHESS, autoDropTo: 9 }).dropped).toBe(1);
    // Nothing on the bench: nothing happens.
    expect(autoDrop(army("w", "e1", eight)).army).toEqual(army("w", "e1", eight));
  });

  it("never passes the board's own limit, whatever the auto-drop number is", () => {
    const nine: Record<string, Kind> = { a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", a1: "r", h1: "r" };
    const out = autoDrop(army("w", "e1", nine, ["n", "b", "q"]), { ...AUTOCHESS, autoDropTo: 20 });
    expect(boardCount(out.army)).toBe(10);
    expect(out.army.bench).toEqual(["b", "q"]);
  });
});

describe("auto chess: a pawn is picked up once (v5)", () => {
  it("a placed pawn may be picked up once: wherever it goes (another square, or the bench and later a square) its next placement is final", () => {
    // Placed from the bench the first time: free to be picked up.
    let a = placeFromBench(army("w", "e1", {}, ["p"]), 0, "a3");
    expect(a).toEqual({ color: "w", king: "e1", board: { a3: "p" }, bench: [] });
    expect(pawnFixed(a, "a3")).toBe(false);
    expect(placeBlock(a, "p", "b3", "a3")).toBeNull();
    // Moved to another square: final there.
    a = moveOnBoard(a, "a3", "b3");
    expect(pawnFixed(a, "b3")).toBe(true);
    expect(a.fixed).toEqual(["b3"]);
    expect(placeBlock(a, "p", "c3", "b3")).toBe("fixed");
    expect(placeBlock(a, "p", "b4", "b3")).toBe("fixed");
    // The other way: picked up to the bench, its next placement is final.
    let b = placeFromBench(army("w", "e1", {}, ["p", "n"]), 0, "a3");
    b = toBench(b, "a3");
    expect(b.bench).toEqual(["n", "p"]);
    expect(b.benchFixed).toEqual([1]);
    expect(benchFixed(b, 1)).toBe(true);
    expect(benchFixed(b, 0)).toBe(false);
    b = placeFromBench(b, 1, "c3");
    expect(b.board.c3).toBe("p");
    expect(pawnFixed(b, "c3")).toBe(true);
    expect(b.benchFixed).toBeUndefined();
    expect(placeBlock(b, "p", "d3", "c3")).toBe("fixed");
    // Slots that move up keep their mark: two pawns used their pick-up, the first leaves the bench.
    let c = army("w", "e1", {}, ["p", "p"]);
    c = placeFromBench(placeFromBench(c, 0, "a3"), 0, "b3");
    c = toBench(toBench(c, "a3"), "b3");
    expect(c.benchFixed).toEqual([0, 1]);
    c = placeFromBench(c, 0, "d3");
    expect(c.benchFixed).toEqual([0]);
    expect(pawnFixed(c, "d3")).toBe(true);
    expect(benchFixed(c, 0)).toBe(true);
    // A pawn bought later is fresh.
    expect(benchFixed(buy(c, "p"), 1)).toBe(false);
  });

  it("a fixed pawn can still be sold (on the board or on the bench), and a sold pawn's mark goes with it", () => {
    let a = moveOnBoard(placeFromBench(army("w", "e1", {}, ["p"]), 0, "a3"), "a3", "b3");
    const sold = sellPiece(a, { square: "b3" });
    expect(sold.gold).toBe(9);
    expect(sold.army).toEqual(army("w", "e1"));
    expect(sold.army.fixed).toBeUndefined();
    // On the bench: the mark of the slot leaves with the pawn; another slot's mark moves up.
    a = army("w", "e1", {}, ["p", "p"]);
    a = toBench(toBench(placeFromBench(placeFromBench(a, 0, "a3"), 0, "b3"), "b3"), "a3");
    expect(a.benchFixed).toEqual([0, 1]);
    const out = sellPiece(a, { bench: 0 }).army;
    expect(out.bench).toEqual(["p"]);
    expect(out.benchFixed).toEqual([0]);
    // Selling a pawn on the board that isn't fixed leaves the other fixed pawns' marks.
    const two = placeFromBench(moveOnBoard(placeFromBench(army("w", "e1", {}, ["p", "p"]), 0, "a3"), "a3", "c3"), 0, "d3");
    expect(two.fixed).toEqual(["c3"]);
    expect(sellPiece(two, { square: "d3" }).army.fixed).toEqual(["c3"]);
  });

  it("other pieces move freely, as often as you like", () => {
    let a = placeFromBench(army("w", "e1", {}, ["n", "r"]), 0, "b3");
    for (const to of ["c3", "d3", "e3", "b3", "f3"]) {
      expect(placeBlock(a, "n", to, Object.keys(a.board).find((sq) => a.board[sq] === "n"))).toBeNull();
      a = moveOnBoard(a, Object.keys(a.board).find((sq) => a.board[sq] === "n")!, to);
    }
    a = toBench(a, "f3");
    a = placeFromBench(a, 1, "a1");
    expect(a.fixed).toBeUndefined();
    expect(a.benchFixed).toBeUndefined();
    expect(a.board).toEqual({ a1: "n" });
  });

  it("a moved-then-final pawn still counts for the file rule; the auto-drop places a bench-fixed pawn for good", () => {
    const a = army("w", "e1", {}, ["p", "p"]);
    const used = toBench(moveOnBoard(placeFromBench(a, 0, "a3"), "a3", "b3"), "b3");
    expect(used.benchFixed).toEqual([1]);
    const out = autoDrop(used).army;
    expect(Object.keys(out.board).sort()).toEqual(["a3", "b3"]);
    expect(out.fixed).toHaveLength(1);
    expect(pawnFixed(out, "b3") || pawnFixed(out, "a3")).toBe(true);
    expect(placeWords("fixed")).toBe("This pawn can't move again. You can still sell it.");
  });
});

describe("auto chess: the adjust step", () => {
  const w = army("w", "e1", { a2: "p", a3: "p", b2: "p", c3: "n", d1: "q", a1: "r", f1: "b" });
  it("a pawn pushes one, or two from its start rank when both are empty; a blocked pawn can't", () => {
    expect(adjustTargets(w, "b2").sort()).toEqual(["b3", "b4"]);
    // a2 is blocked by a3; a3 can step to a4.
    expect(adjustTargets(w, "a2")).toEqual([]);
    expect(adjustTargets(w, "a3")).toEqual(["a4"]);
    // The last square of the half: the next is theirs.
    expect(adjustTargets(army("w", "e1", { a4: "p" }), "a4")).toEqual([]);
    expect(adjustTargets(army("w", "e1", { a3: "p" }), "a3")).toEqual(["a4"]);
    // Black's go the other way: two from the seventh rank.
    expect(adjustTargets(army("b", "e8", { c7: "p" }), "c7").sort()).toEqual(["c5", "c6"]);
    expect(adjustTargets(army("b", "e8", { c5: "p" }), "c5")).toEqual([]);
    // A pawn two from its start square isn't blocked by the king.
    expect(adjustTargets(army("w", "b3", { b2: "p" }), "b2")).toEqual([]);
  });

  it("in a stack of pawns only the front one has a push (and a full file of three, ranks 2 to 4, has none: the next square is theirs)", () => {
    const stack = army("w", "e1", { f2: "p", f3: "p" });
    expect(adjustTargets(stack, "f2")).toEqual([]);
    expect(adjustTargets(stack, "f3")).toEqual(["f4"]);
    const full = army("w", "e1", { f2: "p", f3: "p", f4: "p" });
    for (const sq of ["f2", "f3", "f4"]) expect(adjustTargets(full, sq)).toEqual([]);
  });

  it("a knight jumps, a bishop and a rook slide until something stands in the way, nothing leaves the half or captures", () => {
    // The knight on c3: a4, b1, d5(off: rank 5), e4, e2, a2(taken), b5(off), d1(taken).
    expect(adjustTargets(w, "c3").sort()).toEqual(["a4", "b1", "e2", "e4"]);
    // The bishop on f1: g2, h3 and e2, d3 (c4 is the last in the half), nothing past it.
    expect(adjustTargets(w, "f1").sort()).toEqual(["c4", "d3", "e2", "g2", "h3"]);
    // The rook on a1 is shut in by a2 and (b1 empty) c1... b1, c1 free, d1 has the queen.
    expect(adjustTargets(w, "a1").sort()).toEqual(["b1", "c1"]);
    // The queen on d1: along the rank to e1? that's the king: blocked; c1, b1; up the file to d4; diagonals.
    expect(adjustTargets(w, "d1")).toEqual(expect.arrayContaining(["c1", "b1", "d2", "d3", "d4", "e2", "f3", "g4"]));
    expect(adjustTargets(w, "d1")).not.toContain("e1");
    expect(adjustTargets(w, "d1")).not.toContain("d5");
    for (const sq of ["c3", "f1", "a1", "d1"]) for (const t of adjustTargets(w, sq)) expect(inHalf(t, "w")).toBe(true);
  });

  it("the king may step once, onto an empty square of its half", () => {
    expect(adjustTargets(army("w", "e4"), "e4").sort()).toEqual(["d3", "d4", "e3", "f3", "f4"]);
    expect(adjustTargets(army("b", "h8"), "h8").sort()).toEqual(["g7", "g8", "h7"]);
  });

  it("one chess move in all (any piece): after it every other move, and a second move of the same piece, is refused; it can be taken back", () => {
    expect(AUTOCHESS.adjustMoves).toBe(1);
    let s = startAdjust(w);
    expect(adjustBlock(s, "b2", "b4")).toBeNull();
    expect(adjustBlock(s, "h3", "h4")).toBe("none");
    expect(adjustBlock(s, "c3", "c4")).toBe("illegal");
    expect(adjustBlock(s, "c3", "e5")).toBe("illegal");
    s = adjustMove(s, "b2", "b4");
    expect(s.army.board.b4).toBe("p");
    expect(s.army.board.b2).toBeUndefined();
    expect(s.actions).toEqual([{ type: "move", from: "b2", to: "b4" }]);
    expect(movesUsed(s)).toBe(1);
    // No second move: not by another piece, not by the same one, not by the king.
    expect(adjustBlock(s, "c3", "e4")).toBe("used");
    expect(adjustBlock(s, "b4", "b5")).toBe("used");
    expect(adjustBlock(s, "e1", "e2")).toBe("used");
    expect(adjustWords("used")).toBe("You've made your move. Tap the piece you moved (↩) to take it back.");
    // Taken back, the move is free again, for any piece.
    expect(undoBlock(s, "b4")).toBeNull();
    const undone = undoAction(s, "b4");
    expect(undone.gives).toBe(0);
    expect(undone.state.army).toEqual(w);
    expect(undone.state.actions).toEqual([]);
    expect(adjustBlock(undone.state, "c3", "e4")).toBeNull();
    expect(undoBlock(s, "h4")).toBe("none");
    // The king is a piece: it may take the one move (a step onto an empty square of its half).
    const k = adjustMove(startAdjust(army("w", "e1", { a3: "p" })), "e1", "e2");
    expect(k.army.king).toBe("e2");
    expect(adjustBlock(k, "a3", "a4")).toBe("used");
    expect(undoAction(k, "e2").state.army.king).toBe("e1");
    // The number is a setting.
    const two = { ...AUTOCHESS, adjustMoves: 2 };
    expect(adjustBlock(adjustMove(startAdjust(w), "b2", "b4", two), "c3", "e4", two)).toBeNull();
    expect(adjustBlock(adjustMove(adjustMove(startAdjust(w), "b2", "b4", two), "c3", "e4", two), "d1", "c1", two)).toBe("used");
  });

  const benched = army("w", "e1", { a3: "p", b3: "p", c3: "p" }, ["n", "p", "r"]);

  it("one drop of a bench piece onto an empty square of your half, for 25 gold; taking it back puts the piece on its bench slot and gives the gold back", () => {
    expect([AUTOCHESS.adjustDrops, AUTOCHESS.adjustDropCost]).toEqual([1, 25]);
    let s = startAdjust(benched);
    expect(dropBlock(s, 25)).toBeNull();
    expect(dropBlock(s, 24)).toBe("gold");
    expect(dropSquareBlock(s, 0, "d1", 25)).toBeNull();
    s = adjustDrop(s, 1, "d3");
    expect(s.army.board.d3).toBe("p");
    expect(s.army.bench).toEqual(["n", "r"]);
    expect(dropsUsed(s)).toBe(1);
    // A second drop is refused, whatever the gold.
    expect(dropBlock(s, 500)).toBe("used");
    expect(dropSquareBlock(s, 0, "d1", 500)).toBe("used");
    expect(dropWords("used")).toBe("You've made your drop. Tap the piece you dropped (↩) to take it back.");
    expect(dropWords("gold", 10)).toBe("Not enough gold: a drop costs 25 and you have 10.");
    // Taken back: the pawn is on the bench in its old slot, and the 25 comes back.
    expect(undoBlock(s, "d3")).toBeNull();
    const undone = undoAction(s, "d3");
    expect(undone.gives).toBe(25);
    expect(undone.state.army).toEqual(benched);
    expect(dropBlock(undone.state, 25)).toBeNull();
    expect(dropSquareBlock(startAdjust(benched), 5, "d1", 99)).toBe("none");
  });

  it("a drop follows the placement rules and the board's limit, each with its reason", () => {
    const s = startAdjust(benched);
    expect(dropSquareBlock(s, 0, "a3", 99)).toBe("taken");
    expect(dropSquareBlock(s, 0, "e1", 99)).toBe("king");
    expect(dropSquareBlock(s, 0, "e5", 99)).toBe("half");
    expect(dropSquareBlock(s, 1, "d1", 99)).toBe("backrank");
    expect(dropSquareBlock(s, 1, "a2", 99)).toBeNull();
    const four = startAdjust(army("w", "e1", { a2: "p", a3: "p", a4: "p" }, ["p"]), );
    expect(dropSquareBlock(four, 0, "b2", 99)).toBeNull();
    // 10 on the board already: the bench pieces can't drop (the greyed reason).
    const ten = startAdjust(army("w", "e1", { a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", h3: "p", b1: "n", g1: "n" }, ["b"]));
    expect(dropBlock(ten, 99)).toBe("limit");
    expect(dropSquareBlock(ten, 0, "c1", 99)).toBe("limit");
    expect(dropWords("limit", 99)).toBe("Your board is full: 10 pieces and your king at most.");
    expect(dropWords("taken", 99)).toBe("That square is taken.");
    expect(dropWords("half", 99)).toBe("Pieces go on your half of the board.");
    expect(dropWords("backrank", 99)).toBe("Pawns can't stand on your back rank.");
    expect(dropWords("king", 99)).toBe("That's your king's square.");
    // The reasons come in the order used, gold, limit.
    expect(dropBlock(adjustDrop(startAdjust(benched), 0, "d2"), 0)).toBe("used");
    expect(dropBlock(ten, 0)).toBe("gold");
  });

  it("a move and a drop, in either order: the dropped piece may be the one that moves; a change that another stands on can't be taken back first", () => {
    // Move, then drop onto the square the piece left.
    let s = adjustMove(startAdjust(benched), "c3", "c4");
    s = adjustDrop(s, 0, "c3");
    expect(s.army.board).toMatchObject({ c4: "p", c3: "n" });
    expect(adjustMarks(s)).toEqual([{ square: "c4", action: "move" }, { square: "c3", action: "drop" }]);
    // The move can't be taken back while the knight stands on the square it left; the drop can.
    expect(undoBlock(s, "c4")).toBe("needed");
    expect(undoWords("needed")).toBe("Take back your other change first.");
    expect(undoBlock(s, "c3")).toBeNull();
    const noKnight = undoAction(s, "c3").state;
    expect(undoBlock(noKnight, "c4")).toBeNull();
    // Drop, then move the dropped piece: the drop can't be taken back until the move is.
    let t = adjustDrop(startAdjust(benched), 0, "d1");
    t = adjustMove(t, "d1", "e3");
    expect(t.army.board).toMatchObject({ e3: "n" });
    expect(t.army.board.d1).toBeUndefined();
    expect(adjustMarks(t)).toEqual([{ square: "e3", action: "move" }]);
    expect(undoBlock(t, "d1")).toBe("none");
    const back = undoAction(t, "e3").state;
    expect(back.army.board.d1).toBe("n");
    expect(adjustMarks(back)).toEqual([{ square: "d1", action: "drop" }]);
    expect(undoAction(back, "d1").state.army).toEqual(benched);
    // Either, both or neither: neither is the army as it was.
    expect(startAdjust(benched).army).toBe(benched);
    // The move's undo can break a later drop only when it stands on the move's square; any other order is free.
    const u = adjustDrop(adjustMove(startAdjust(benched), "c3", "c4"), 2, "h2");
    expect(undoBlock(u, "c4")).toBeNull();
    expect(undoBlock(u, "h2")).toBeNull();
  });
});

describe("auto chess: who moves first", () => {
  const cases = (w: Army, b: Army) => fightStart(w, b);
  it("White moves first, unless a king is attacked as the fight starts", () => {
    expect(cases(army("w", "e1", { a3: "p" }), army("b", "e8", { a6: "p" }))).toMatchObject({ mover: "w", draw: false });
    // Black's rook on e5 attacks the white king on e1: White moves first anyway; mirror it with White's rook on e4 and the black king on e8 and Black moves first.
    expect(cases(army("w", "e1", { a3: "p" }), army("b", "d8", { e5: "r" }))).toMatchObject({ mover: "w", draw: false });
    const blackFirst = cases(army("w", "d1", { e4: "r" }), army("b", "e8", { a6: "p" }));
    expect(blackFirst).toMatchObject({ mover: "b", draw: false });
    expect(blackFirst.fen.split(" ")[1]).toBe("b");
  });

  it("with both kings attacked the round is a draw, no fight", () => {
    const both = cases(army("w", "e1", { d4: "r" }), army("b", "d8", { e5: "r" }));
    expect(both.draw).toBe(true);
  });

  it("starts with no castling and no en passant square, and the engine accepts the position", () => {
    const s = cases(army("w", "e1", { a2: "p", b1: "n", c1: "b" }), army("b", "e8", { a7: "p", g8: "n" }));
    expect(s.fen.split(" ").slice(2)).toEqual(["-", "-", "0", "1"]);
    expect(stockfishRefuses(s.fen)).toBeNull();
    expect(armiesFen(army("w", "e1"), army("b", "e8"), "b")).toBe("4k3/8/8/8/8/8/8/4K3 b - - 0 1");
  });

  it("counts what's on the board (kings left out) and its material", () => {
    const fen = armiesFen(army("w", "e1", { a2: "p", d1: "q", a1: "r" }), army("b", "e8", { c6: "n", c8: "b", h7: "p" }));
    expect(piecesOn(fen)).toEqual({ w: expect.arrayContaining(["p", "q", "r"]), b: expect.arrayContaining(["n", "b", "p"]) });
    expect(piecesOn(fen).w).toHaveLength(3);
    expect(material(fen)).toEqual({ w: 15, b: 7 });
  });
});
