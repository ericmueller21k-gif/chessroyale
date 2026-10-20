import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { stockfishRefuses } from "@chessroyale/chess";
import {
  boardCount,
  boardPieces,
  buyBlock,
  buyOffer,
  buyWords,
  carryBench,
  emptyArmy,
  extras,
  halfSquares,
  heldBlock,
  heldWords,
  holdBlock,
  holdOffer,
  inHalf,
  kindBlock,
  kingSquares,
  legalCounts,
  offerLabel,
  owned,
  placeBlock,
  placeHeld,
  placeWords,
  sellHeld,
  sellPiece,
  sellValue,
  squareBlock,
  usableSquares,
} from "../src/autochess/army.ts";
import { adjustBlock, adjustMarks, adjustMove, adjustTargets, adjustWords, movesUsed, startAdjust, undoAction, undoBlock, undoWords } from "../src/autochess/adjust.ts";
import { armiesFen, fightStart, material, piecesOn } from "../src/autochess/position.ts";
import type { Army, Kind, Offer } from "../src/autochess/types.ts";

const army = (color: "w" | "b", king: string, board: Record<string, Kind> = {}, bench: Offer[] = []): Army => ({ color, king, board, bench });
const offer = (kind: Kind, square: string): Offer => ({ kind, square });

describe("auto chess: buying an offer", () => {
  it("sells for 75% of the price, rounded down, from the board or the bench", () => {
    expect(AUTOCHESS.sellBack).toBe(0.75);
    expect(["p", "n", "b", "r", "q"].map((k) => sellValue(k as Kind))).toEqual([7, 22, 24, 37, 67]);
    const placed = buyOffer(emptyArmy("w", "e1"), offer("n", "c3"));
    expect(sellPiece(placed, "c3")).toEqual({ army: emptyArmy("w", "e1"), gold: 22 });
    const held = holdOffer(holdOffer(emptyArmy("w", "e1"), offer("r", "a1")), offer("q", "d1"));
    expect(sellHeld(held, 1)).toEqual({ army: holdOffer(emptyArmy("w", "e1"), offer("r", "a1")), gold: 67 });
    expect(sellHeld(held, 0).army.bench).toEqual([offer("q", "d1")]);
  });

  it("the prices are pawn 10, knight 30, bishop 32, rook 50, queen 90", () => {
    expect(AUTOCHESS.prices).toEqual({ p: 10, n: 30, b: 32, r: 50, q: 90 });
  });

  it("a bought offer lands on its square, and nowhere else", () => {
    const a = buyOffer(emptyArmy("w", "e1"), offer("b", "c2"));
    expect(a).toEqual({ color: "w", king: "e1", board: { c2: "b" }, bench: [] });
    expect(boardPieces(buyOffer(a, offer("p", "a3")))).toEqual([{ square: "a3", kind: "p" }, { square: "c2", kind: "b" }]);
  });

  it("says why an offer can't be bought: a limit, the square, the board, then gold", () => {
    const a = emptyArmy("w", "e1");
    expect(buyBlock(a, 100, offer("p", "a3"))).toBeNull();
    expect(buyBlock(a, 9, offer("p", "a3"))).toBe("gold");
    expect(buyBlock(a, 89, offer("q", "d1"))).toBe("gold");
    expect(buyBlock(a, 90, offer("q", "d1"))).toBeNull();
    // One queen at most, whatever the gold.
    expect(buyBlock(buyOffer(a, offer("q", "d1")), 500, offer("q", "d2"))).toBe("queen");
    // A square a piece stands on now (the offer is stale), the king's, or off the half: taken.
    expect(buyBlock(buyOffer(a, offer("n", "c3")), 500, offer("p", "c3"))).toBe("taken");
    expect(buyBlock(a, 500, offer("p", "e1"))).toBe("taken");
    // The limits come before the board's, and gold is last.
    expect(buyBlock(army("w", "e1", ten()), 0, offer("b", "c1"))).toBe("limit");
    expect(buyBlock(army("w", "e1", { a3: "p" }), 0, offer("q", "d1"))).toBe("gold");
  });

  it("limits pawns to 8, and extra pieces to 8 minus the pawns (the engine refuses more)", () => {
    const eight = army("w", "e1", { a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", h3: "p" });
    expect(buyBlock(eight, 500, offer("p", "a2"))).toBe("pawns");
    expect(kindBlock(eight, "p")).toBe("pawns");
    const sevenPawnsOneExtra: Army = army("w", "e1", { a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", a1: "n", b1: "n", c1: "n" });
    expect(extras(owned(sevenPawnsOneExtra))).toBe(1);
    expect(legalCounts(owned(sevenPawnsOneExtra))).toBe(true);
    expect(kindBlock(sevenPawnsOneExtra, "p")).toBe("extras");
    expect(kindBlock(sevenPawnsOneExtra, "n")).toBe("extras");
    // The starting set itself is free: 1 queen, 2 rooks, 2 bishops, 2 knights with 8 pawns.
    expect(legalCounts({ p: 8, n: 2, b: 2, r: 2, q: 1 })).toBe(true);
    expect(legalCounts({ p: 8, n: 3, b: 2, r: 2, q: 1 })).toBe(false);
    expect(legalCounts({ p: 4, n: 4, b: 4, r: 2, q: 1 })).toBe(true);
    expect(legalCounts({ p: 4, n: 5, b: 4, r: 2, q: 1 })).toBe(false);
    expect(buyWords("extras", offer("n", "c1"), 0).line).toContain("can't pass 8");
  });

  it("has words for every reason, and a label under each offer: the piece and its square", () => {
    for (const block of ["gold", "limit", "taken", "queen", "pawns", "extras", "bench"] as const) {
      const w = buyWords(block, offer("q", "d1"), 10);
      expect(w.short.length).toBeGreaterThan(0);
      expect(w.line.endsWith(".")).toBe(true);
    }
    expect(buyWords("gold", offer("q", "d1"), 10).line).toBe("Not enough gold: a queen costs 90 and you have 10.");
    expect(buyWords("queen", offer("q", "d1"), 100).line).toBe("One queen at most.");
    expect(buyWords("bench", offer("n", "c3"), 100)).toEqual({ short: "Bench full", line: "Your bench is full: 4 pieces at most. Place or sell one first." });
    expect(buyWords("taken", offer("b", "c2"), 100).line).toBe("c2 is taken.");
    expect([offer("b", "c2"), offer("n", "g1"), offer("p", "h4"), offer("q", "d1"), offer("r", "a1")].map(offerLabel)).toEqual(["Bishop c2", "Knight g1", "Pawn h4", "Queen d1", "Rook a1"]);
  });

  it("the squares an offer may land on: empty ones of your half, not the king's; a pawn on your 2nd to 4th rank only", () => {
    const a = army("w", "e2", { c3: "p", d1: "r" });
    const rook = usableSquares(a, "r");
    expect(rook).toHaveLength(32 - 3);
    expect(rook).not.toContain("e2");
    expect(rook).not.toContain("c3");
    expect(rook).not.toContain("d1");
    expect(rook.every((s) => inHalf(s, "w"))).toBe(true);
    const pawn = usableSquares(a, "p");
    expect(pawn.every((s) => ["2", "3", "4"].includes(s[1]!))).toBe(true);
    expect(pawn).toHaveLength(24 - 2);
    // Black's: ranks 7 to 5 for a pawn, its back rank is the eighth.
    const black = usableSquares(army("b", "e7"), "p");
    expect(black.every((s) => ["7", "6", "5"].includes(s[1]!))).toBe(true);
    expect(usableSquares(army("b", "e7"), "n")).toContain("a8");
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
});

/** Ten pieces on White's half: eight pawns on rank 3 and two knights on b1 and g1 (the king on e1). */
const ten = (): Record<string, Kind> => ({ a3: "p", b3: "p", c3: "p", d3: "p", e3: "p", f3: "p", g3: "p", h3: "p", b1: "n", g1: "n" });

describe("auto chess: the bench (v6)", () => {
  const held = (...o: Offer[]) => army("w", "e1", {}, o);

  it("holds 4 pieces, each keeping the square it was offered on, and what is held counts as owned for the limits", () => {
    expect(AUTOCHESS.benchSlots).toBe(4);
    const a = holdOffer(emptyArmy("w", "e1"), offer("b", "c2"));
    expect(a.bench).toEqual([offer("b", "c2")]);
    expect(a.board).toEqual({});
    expect(owned(held(offer("q", "d1"), offer("p", "a2")))).toEqual({ p: 1, n: 0, b: 0, r: 0, q: 1 });
    // A queen held is the one queen: another can't be bought, onto the board or to hold.
    const queen = held(offer("q", "d1"));
    expect(buyBlock(queen, 500, offer("q", "d2"))).toBe("queen");
    expect(holdBlock(queen, 500, offer("q", "d2"))).toBe("queen");
    // Eight pawns owned, bench and board together, is the pawn limit.
    const pawns = army("w", "e1", { a3: "p", b3: "p", c3: "p", d3: "p" }, [offer("p", "e3"), offer("p", "f3"), offer("p", "g3"), offer("p", "h3")]);
    expect(kindBlock(pawns, "p")).toBe("pawns");
  });

  it("says why an offer can't be held: the limits, then the bench's room, then gold", () => {
    const a = emptyArmy("w", "e1");
    expect(holdBlock(a, 100, offer("n", "c3"))).toBeNull();
    expect(holdBlock(a, 29, offer("n", "c3"))).toBe("gold");
    // A full board doesn't stop a hold (that is what the bench is for), but a full bench does.
    expect(holdBlock(army("w", "e1", ten()), 500, offer("b", "c1"))).toBeNull();
    const four = held(offer("p", "a2"), offer("p", "b2"), offer("p", "c2"), offer("p", "d2"));
    expect(holdBlock(four, 500, offer("n", "c3"))).toBe("bench");
    // The limits come first, then the bench, then gold.
    expect(holdBlock({ ...four, bench: [offer("q", "d1"), ...four.bench.slice(1)] }, 0, offer("q", "d2"))).toBe("queen");
    expect(holdBlock(four, 0, offer("n", "c3"))).toBe("bench");
  });

  it("a held piece is placed on its own square when that is free and the board has room, and nowhere else", () => {
    const a = held(offer("n", "c3"), offer("r", "a1"));
    expect(heldBlock(a, 0)).toBeNull();
    const placed = placeHeld(a, 0);
    expect(placed.board).toEqual({ c3: "n" });
    expect(placed.bench).toEqual([offer("r", "a1")]);
    // The square taken (by a piece bought onto it), or this round's king's square: refused, with the square named.
    expect(heldBlock(army("w", "e1", { c3: "p" }, [offer("n", "c3")]), 0)).toBe("taken");
    expect(heldBlock(army("w", "c3", {}, [offer("n", "c3")]), 0)).toBe("king");
    expect(heldWords("taken", "c3")).toBe("c3 is taken.");
    expect(heldWords("king", "c3")).toBe("c3 is your king's square.");
    expect(heldWords("limit", "c3", AUTOCHESS, 4)).toBe("Your level allows 4 pieces on the board. Buy XP to level up.");
    // The board's room: a full board refuses it (the limit is how many pieces it may hold), and a bigger limit lets it in.
    const full = army("w", "e1", ten(), [offer("b", "c2")]);
    expect(heldBlock(full, 0)).toBe("limit");
    expect(heldBlock(full, 0, AUTOCHESS, 11)).toBeNull();
  });

  it("a bench carries into the next round on squares turned with the colors: the same file, the rank mirrored", () => {
    expect(carryBench([offer("n", "c3"), offer("q", "d1"), offer("p", "h4")])).toEqual([offer("n", "c6"), offer("q", "d8"), offer("p", "h5")]);
    expect(carryBench(carryBench([offer("n", "c3")]))).toEqual([offer("n", "c3")]);
    expect(carryBench([])).toEqual([]);
    // A white half square becomes a black half square, and back.
    for (const sq of halfSquares("w")) expect(inHalf(carryBench([offer("n", sq)])[0]!.square, "b")).toBe(true);
  });
});

describe("auto chess: the board's room (the level)", () => {
  it("holds as many pieces (the king not counted) as it is told: your level; a piece already on the board doesn't count against it", () => {
    const nine = army("w", "e1", Object.fromEntries(Object.entries(ten()).slice(0, 9)));
    expect(boardCount(nine)).toBe(9);
    expect(placeBlock(nine, "b", "c1", undefined, AUTOCHESS, 10)).toBeNull();
    expect(placeBlock(nine, "b", "c1", undefined, AUTOCHESS, 9)).toBe("limit");
    const full = army("w", "e1", ten());
    expect(boardCount(full)).toBe(10);
    // (No limit given: the top level's.)
    expect(placeBlock(full, "b", "c1")).toBe("limit");
    expect(placeBlock(full, "p", "a2")).toBe("limit");
    expect(placeBlock(full, "b", "c1", undefined, AUTOCHESS, 11)).toBeNull();
    // A taken square or someone's half is named first; a piece already on the board doesn't count against it.
    expect(placeBlock(full, "b", "a3")).toBe("taken");
    expect(placeBlock(full, "b", "a5")).toBe("half");
    expect(placeBlock(full, "n", "c1", "b1")).toBeNull();
    expect(squareBlock(full, "b", "c1")).toBeNull();
    expect(placeWords("limit", AUTOCHESS, 4)).toBe("Your level allows 4 pieces on the board. Buy XP to level up.");
    expect(buyWords("limit", offer("b", "c1"), 100, AUTOCHESS, 4)).toEqual({ short: "Level full", line: "Your level allows 4 pieces on the board. Buy XP to level up." });
  });
});

describe("auto chess: the adjust step (v6): one change, any legal empty square of your half", () => {
  const w = army("w", "e1", { a2: "p", a3: "p", b2: "p", c3: "n", d1: "q", a1: "r", f1: "b" });

  it("a piece may go to any empty square of its half where it may stand: not a chess move (a knight to the far corner), never the king's or a taken square", () => {
    // The knight: every empty square of the half but its own, the king's and the six taken ones: 32 - 1 (e1) - 7 (all seven of yours) = 24.
    const knight = adjustTargets(w, "c3");
    expect(knight).toHaveLength(24);
    expect(knight).toEqual(expect.arrayContaining(["h4", "h1", "a4", "g2"]));
    for (const sq of ["e1", "c3", "a2", "a3", "b2", "d1", "a1", "f1"]) expect(knight).not.toContain(sq);
    expect(knight.every((sq) => inHalf(sq, "w"))).toBe(true);
    // The rook and queen and bishop are not shut in or held to their lines either.
    expect(adjustTargets(w, "a1")).toHaveLength(24);
    expect(adjustTargets(w, "d1")).toContain("h4");
    expect(adjustTargets(w, "f1")).toContain("b4");
    // Black's half is ranks 5 to 8.
    const black = adjustTargets(army("b", "e8", { c7: "n" }), "c7");
    expect(black).toHaveLength(32 - 1 - 1);
    expect(black.every((sq) => inHalf(sq, "b"))).toBe(true);
    expect(black).toContain("a8");
    expect(black).not.toContain("e8");
  });

  it("a pawn goes to your 2nd to 4th rank, never your back rank, and not onto a file of three", () => {
    const pawn = adjustTargets(w, "b2");
    expect(pawn.every((sq) => ["2", "3", "4"].includes(sq[1]!))).toBe(true);
    expect(pawn).toEqual(expect.arrayContaining(["h4", "b3", "b4", "e3"]));
    expect(pawn).not.toContain("b1");
    // (Ranks 2 to 4 are 24 squares; a2, a3, b2 (itself), c3 are taken: 24 - 4 = 20; b2 itself is excluded: 20.)
    expect(pawn).toHaveLength(20);
    // A black pawn: ranks 5 to 7.
    expect(adjustTargets(army("b", "e8", { c7: "p" }), "c7").every((sq) => ["5", "6", "7"].includes(sq[1]!))).toBe(true);
    // The file limit (a setting of two a file for this check): a pawn can't join a full file, but may move within its own.
    const two = { ...AUTOCHESS, pawnsPerFile: 2 };
    const pair = army("w", "e1", { a2: "p", a3: "p", b2: "p" });
    expect(adjustTargets(pair, "b2", two).some((sq) => sq[0] === "a")).toBe(false);
    expect(adjustTargets(pair, "b2").some((sq) => sq[0] === "a")).toBe(true);
    expect(adjustBlock(startAdjust(pair), "b2", "a4", two)).toBe("file");
    expect(adjustBlock(startAdjust(pair), "a2", "a4", two)).toBeNull();
  });

  it("the king stays where the game put it: it has no targets and can't be moved", () => {
    expect(adjustTargets(w, "e1")).toEqual([]);
    expect(adjustBlock(startAdjust(w), "e1", "e2")).toBe("kingfixed");
    expect(adjustWords("kingfixed")).toBe("Your king stays where the game put it.");
    expect(adjustTargets(w, "h3")).toEqual([]);
  });

  it("one change in all: after it every other move, and a second move of the same piece, is refused; it can be taken back, and then any piece may go", () => {
    expect(AUTOCHESS.adjustMoves).toBe(1);
    let s = startAdjust(w);
    expect(adjustBlock(s, "c3", "h4")).toBeNull();
    expect(adjustBlock(s, "h3", "h4")).toBe("none");
    // Refused with the square's own reason: their half, the king's square, a taken square, a pawn on your back rank.
    expect(adjustBlock(s, "c3", "e5")).toBe("half");
    expect(adjustBlock(s, "c3", "e1")).toBe("king");
    expect(adjustBlock(s, "c3", "a2")).toBe("taken");
    expect(adjustBlock(s, "b2", "c1")).toBe("backrank");
    expect(adjustWords("half")).toBe("Pieces go on your half of the board.");
    expect(adjustWords("king")).toBe("That's your king's square.");
    expect(adjustWords("taken")).toBe("That square is taken.");
    expect(adjustWords("backrank")).toBe("Pawns can't stand on your back rank.");
    s = adjustMove(s, "c3", "h4");
    expect(s.army.board.h4).toBe("n");
    expect(s.army.board.c3).toBeUndefined();
    expect(s.army.king).toBe("e1");
    expect(s.actions).toEqual([{ type: "move", from: "c3", to: "h4" }]);
    expect(adjustMarks(s)).toEqual([{ square: "h4", action: "move" }]);
    expect(movesUsed(s)).toBe(1);
    // No second change: not by another piece, not by the same one.
    expect(adjustBlock(s, "b2", "b4")).toBe("used");
    expect(adjustBlock(s, "h4", "h3")).toBe("used");
    expect(adjustWords("used")).toBe("You've made your move. Tap the piece you moved (↩) to take it back.");
    // Taken back, the change is free again, for any piece.
    expect(undoBlock(s, "h4")).toBeNull();
    const undone = undoAction(s, "h4");
    expect(undone.army).toEqual(w);
    expect(undone.actions).toEqual([]);
    expect(adjustBlock(undone, "b2", "b4")).toBeNull();
    expect(undoBlock(s, "h3")).toBe("none");
    // The number is a setting.
    const two = { ...AUTOCHESS, adjustMoves: 2 };
    expect(adjustBlock(adjustMove(startAdjust(w), "c3", "h4"), "b2", "b4", two)).toBeNull();
    expect(adjustBlock(adjustMove(adjustMove(startAdjust(w), "c3", "h4"), "b2", "b4"), "d1", "d2", two)).toBe("used");
    // Two changes, the first taken back needs a later change that stands on its square to come first.
    const chain = adjustMove(adjustMove(startAdjust(army("w", "e1", { a2: "p" })), "a2", "a3"), "a3", "a4");
    expect(adjustMarks(chain)).toEqual([{ square: "a4", action: "move" }]);
    expect(undoBlock(chain, "a3")).toBe("none");
    expect(undoWords("needed")).toBe("Take back your other move first.");
  });

  it("the position after the change is always a legal army: the pawn and piece limits hold, whatever is moved where (a fuzz of a few hundred changes)", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      const kingAt = kingSquares(seed).w;
      let a = emptyArmy("w", kingAt);
      const kinds: Kind[] = ["p", "p", "p", "n", "b", "r", "q", "p"];
      for (const kind of kinds) {
        const free = usableSquares(a, kind);
        if (free.length) a = buyOffer(a, { kind, square: free[Math.floor(rng() * free.length)]! });
      }
      const pieces = Object.keys(a.board);
      const from = pieces[Math.floor(rng() * pieces.length)]!;
      const targets = adjustTargets(a, from);
      expect(targets.length).toBeGreaterThan(0);
      const to = targets[Math.floor(rng() * targets.length)]!;
      const after = adjustMove(startAdjust(a), from, to).army;
      expect(Object.values(after.board).sort()).toEqual(Object.values(a.board).sort());
      expect(after.board).not.toHaveProperty(kingAt);
      expect(legalCounts(owned(after))).toBe(true);
      for (const [sq, kind] of Object.entries(after.board)) expect(squareBlock({ ...after, board: Object.fromEntries(Object.entries(after.board).filter(([s]) => s !== sq)) }, kind, sq)).toBeNull();
    }
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
