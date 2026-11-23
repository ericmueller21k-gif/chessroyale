import { describe, expect, it } from "vitest";
import { applyMove, legalMoves, START_FEN } from "@chessroyale/chess";
import {
  NO_MARKS,
  USER_ARROW,
  arrowColor,
  boardInputs,
  highlightColor,
  knightApart,
  marksEmpty,
  premoveDests,
  premovePieces,
  premoveQueueTurn,
  premoveSquares,
  premoveTurn,
  readPieces,
  toggleArrow,
  toggleSquare,
  userArrowShape,
  type Premove,
} from "../src/board/logic.ts";
import { addPremove, clearAllPremoves, dropYours, gameKey, onYours, seatKey, setMarks, setQueue, yours } from "../src/board/yours.ts";

/**
 * chess.com's board habits on our board (docs/decisions/2026-10-28-arrows-and-premoves.md): your own arrows and square
 * highlights (colors by the key held, toggling, clearing) and premoves (where a piece may be moved ahead, how the pieces
 * stand with them, what happens when your turn comes: the queue playing, a premove made illegal cancelling it and those
 * after, a power's refusal, the phone's one).
 */

const play = (fen: string, ...moves: string[]) => moves.reduce((f, m) => applyMove(f, m), fen);

describe("your arrows and highlights: colors by the key held (chess.com's)", () => {
  it("arrows: plain yellow-orange, Ctrl (or ⌘) red, Alt blue, Shift green", () => {
    expect(arrowColor({})).toBe("orange");
    expect(arrowColor({ ctrlKey: true })).toBe("red");
    expect(arrowColor({ metaKey: true })).toBe("red");
    expect(arrowColor({ altKey: true })).toBe("blue");
    expect(arrowColor({ shiftKey: true })).toBe("green");
  });

  it("squares: plain red, Ctrl (or ⌘) yellow, Alt blue, Shift green", () => {
    expect(highlightColor({})).toBe("red");
    expect(highlightColor({ ctrlKey: true })).toBe("yellow");
    expect(highlightColor({ metaKey: true })).toBe("yellow");
    expect(highlightColor({ altKey: true })).toBe("blue");
    expect(highlightColor({ shiftKey: true })).toBe("green");
  });
});

describe("your arrows and highlights: drawing and taking away", () => {
  it("draws as many arrows as you like; the same arrow again takes it away; another color recolors it", () => {
    let m = toggleArrow(NO_MARKS, { from: "e2", to: "e4", color: "orange" });
    m = toggleArrow(m, { from: "g1", to: "f3", color: "green" });
    m = toggleArrow(m, { from: "d2", to: "d4", color: "red" });
    expect(m.arrows.map((a) => `${a.from}${a.to}:${a.color}`)).toEqual(["e2e4:orange", "g1f3:green", "d2d4:red"]);
    m = toggleArrow(m, { from: "g1", to: "f3", color: "green" });
    expect(m.arrows.map((a) => `${a.from}${a.to}`)).toEqual(["e2e4", "d2d4"]);
    m = toggleArrow(m, { from: "e2", to: "e4", color: "blue" });
    expect(m.arrows.map((a) => `${a.from}${a.to}:${a.color}`)).toEqual(["d2d4:red", "e2e4:blue"]);
    // (The reverse arrow is another arrow.)
    m = toggleArrow(m, { from: "e4", to: "e2", color: "blue" });
    expect(m.arrows).toHaveLength(3);
  });

  it("colors a square; the same again clears it; another color recolors it", () => {
    let m = toggleSquare(NO_MARKS, "e4", "red");
    m = toggleSquare(m, "d5", "green");
    expect(m.squares).toEqual({ e4: "red", d5: "green" });
    m = toggleSquare(m, "e4", "red");
    expect(m.squares).toEqual({ d5: "green" });
    m = toggleSquare(m, "d5", "yellow");
    expect(m.squares).toEqual({ d5: "yellow" });
    expect(marksEmpty(m)).toBe(false);
    expect(marksEmpty(toggleSquare(m, "d5", "yellow"))).toBe(true);
    expect(marksEmpty(NO_MARKS)).toBe(true);
  });

  it("an arrow runs from just out of its square's center to the target's center, either way up", () => {
    const a = userArrowShape({ from: "e2", to: "e4", color: "orange" }, "white");
    // (e2's center is (0.5, 2.5) from the board's center; e4's (0.5, 0.5); up the screen is -y.)
    expect(a.shaft).toBe(`0.5,${2.5 - USER_ARROW.tail} 0.5,${Math.round((0.5 + USER_ARROW.headLength - 0.02) * 1000) / 1000}`);
    expect(a.head.split(" ")[1]).toBe("0.5,0.5");
    const b = userArrowShape({ from: "e2", to: "e4", color: "orange" }, "black");
    expect(b.head.split(" ")[1]).toBe("-0.5,-0.5");
    // Turned a quarter (Boingo's funhouse): drawn where the turned board shows the squares.
    const c = userArrowShape({ from: "e2", to: "e4", color: "orange" }, "white", 90);
    expect(c.head).not.toBe(a.head);
  });

  it("a knight's arrow is an L, along its longer leg first (chess.com's)", () => {
    expect(knightApart("g1", "f3")).toBe(true);
    expect(knightApart("b1", "d2")).toBe(true);
    expect(knightApart("e2", "e4")).toBe(false);
    expect(knightApart("a1", "c3")).toBe(false);
    // g1-f3: up two squares (g1 to g3), then one to the left (g3's center is (2.5, 1.5) from the board's center).
    const up = userArrowShape({ from: "g1", to: "f3", color: "green" }, "white");
    const pts = up.shaft.split(" ");
    expect(pts).toHaveLength(4);
    expect(pts[2]).toBe("2.5,1.5");
    // b1-d2: two to the right first (b1 to d1), then one up.
    const across = userArrowShape({ from: "b1", to: "d2", color: "green" }, "white");
    expect(across.shaft.split(" ")[2]).toBe("-0.5,3.5");
    expect(across.head.split(" ")[1]).toBe("-0.5,2.5");
    // A straight arrow has no corner.
    expect(userArrowShape({ from: "a1", to: "h8", color: "red" }, "white").shaft.split(" ")).toHaveLength(2);
  });
});

describe("premove destinations (chessground's, as chess.com allows)", () => {
  const start = readPieces(START_FEN);
  const sorted = (xs: string[]) => [...xs].sort();

  it("a pawn: one forward or either diagonal, two from its start; whatever stands there", () => {
    expect(sorted(premoveDests(start, "e2"))).toEqual(["d3", "e3", "e4", "f3"]);
    expect(sorted(premoveDests(start, "e7"))).toEqual(["d6", "e5", "e6", "f6"]);
    const p = readPieces(play(START_FEN, "e2e4", "e7e5"));
    expect(sorted(premoveDests(p, "e4"))).toEqual(["d5", "e5", "f5"]);
    expect(sorted(premoveDests(start, "a2"))).toEqual(["a3", "a4", "b3"]);
  });

  it("a slider goes through pieces, onto your own pieces' squares too (they may be taken by then)", () => {
    // The c1 bishop from the start: both diagonals, through its own pawns.
    expect(sorted(premoveDests(start, "c1"))).toEqual(["a3", "b2", "d2", "e3", "f4", "g5", "h6"]);
    expect(premoveDests(start, "a1")).toContain("a8");
    expect(premoveDests(start, "a1")).toContain("h1");
    expect(premoveDests(start, "d1")).toHaveLength(21);
    expect(sorted(premoveDests(start, "g1"))).toEqual(["e2", "f3", "h3"]);
  });

  it("a king: a step any way, and to its castling squares while the right holds and its rook is home", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const p = readPieces(fen);
    expect(sorted(premoveDests(p, "e1", "KQkq"))).toEqual(["c1", "d1", "d2", "e2", "f1", "f2", "g1"]);
    expect(premoveDests(p, "e1", "Qkq")).not.toContain("g1");
    expect(premoveDests(p, "e8", "KQkq")).toContain("c8");
    expect(premoveDests(p, "e8", "KQkq")).toContain("g8");
    // No rook home, no castling; a Chess960 position passes no rights.
    const noRook = readPieces("r3k2r/8/8/8/8/8/8/R3K3 w KQkq - 0 1");
    expect(premoveDests(noRook, "e1", "KQkq")).not.toContain("g1");
    expect(premoveDests(p, "e1", "")).not.toContain("g1");
  });

  it("an empty square has none", () => {
    expect(premoveDests(start, "e4")).toEqual([]);
  });
});

describe("how the pieces stand with premoves made", () => {
  it("each moved piece on its new square, one after another; whatever stood there gone", () => {
    const after = premovePieces(readPieces(START_FEN), [
      { from: "e2", to: "e4" },
      { from: "e4", to: "e5" },
      { from: "d1", to: "d7" },
    ]);
    expect(after.get("e5")).toBe("wp");
    expect(after.has("e2")).toBe(false);
    expect(after.has("e4")).toBe(false);
    expect(after.get("d7")).toBe("wq");
    expect(after.size).toBe(31);
  });

  it("a promotion becomes its piece; castling takes its rook beside the king", () => {
    const fen = "4k3/P7/8/8/8/8/8/R3K2R w KQ - 0 1";
    const promo = premovePieces(readPieces(fen), [{ from: "a7", to: "a8", promo: "n" }]);
    expect(promo.get("a8")).toBe("wn");
    const short = premovePieces(readPieces(fen), [{ from: "e1", to: "g1" }]);
    expect([short.get("g1"), short.get("f1"), short.has("h1")]).toEqual(["wk", "wr", false]);
    const long = premovePieces(readPieces(fen), [{ from: "e1", to: "c1" }]);
    expect([long.get("c1"), long.get("d1"), long.has("a1")]).toEqual(["wk", "wr", false]);
  });

  it("colors each premove's from and to squares", () => {
    expect(premoveSquares([{ from: "e2", to: "e4" }, { from: "e4", to: "e5" }])).toEqual(["e2", "e4", "e5"]);
    expect(premoveSquares([])).toEqual([]);
  });
});

describe("your turn comes with premoves waiting", () => {
  // White has played 1. e4 and lined up two premoves while Black thinks: Nf3, then Bc4.
  const afterE4 = play(START_FEN, "e2e4");
  const queue: Premove[] = [
    { from: "g1", to: "f3" },
    { from: "f1", to: "c4" },
  ];

  it("the queue plays out: the first at once, the next on your next turn", () => {
    const turn1 = play(afterE4, "e7e5");
    const r1 = premoveQueueTurn(turn1, undefined, queue);
    expect(r1.play).toBe("g1f3");
    expect(r1.rest).toEqual([queue[1]]);
    const turn2 = play(turn1, "g1f3", "b8c6");
    const r2 = premoveQueueTurn(turn2, undefined, r1.rest);
    expect(r2.play).toBe("f1c4");
    expect(r2.rest).toEqual([]);
  });

  it("a reply that makes the first illegal cancels it and every one after it", () => {
    // Black's bishop checks from b4: Nf3 doesn't answer the check, so it goes, and Bc4 with it.
    const check = play(START_FEN, "d2d4", "e7e6", "e2e4", "f8b4");
    const r = premoveQueueTurn(check, undefined, [
      { from: "g1", to: "f3" },
      { from: "f1", to: "c4" },
    ]);
    expect(r).toEqual({ play: null, rest: [] });
    // And one whose square was blocked: a pawn premoved forward onto a piece that came there.
    const blocked = play(START_FEN, "e2e4", "e7e5");
    expect(premoveQueueTurn(play(blocked, "d2d3", "d8h4"), undefined, [{ from: "h2", to: "h4" }, { from: "g1", to: "f3" }])).toEqual({ play: null, rest: [] });
  });

  it("a capture premoved onto an empty square plays once something stands there", () => {
    // White premoves exd5 before Black has played ...d5.
    const fen = play(afterE4, "d7d5");
    expect(premoveTurn(fen, undefined, { from: "e4", to: "d5" })).toEqual({ play: "e4d5" });
    // Not there: cancelled.
    expect(premoveTurn(play(afterE4, "c7c5"), undefined, { from: "e4", to: "d5" })).toEqual({ cancel: true });
  });

  it("a move a boss power refuses now is cancelled like an illegal one, and the screen is told which", () => {
    const fen = play(afterE4, "e7e5");
    // (A power allows only the king's moves, say: Nf3 is legal in chess, not now.)
    const allowed = legalMoves(fen).filter((m) => m.startsWith("e1"));
    expect(premoveQueueTurn(fen, allowed, queue)).toEqual({ play: null, rest: [], refused: "g1f3" });
    // Smudgy's painted piece: offered, then stopped.
    expect(premoveTurn(fen, undefined, queue[0]!, { stopped: (m) => m === "g1f3" })).toEqual({ cancel: true, refused: "g1f3" });
    // Hollow's dark: anything touching it is cancelled, unsent.
    expect(premoveTurn(fen, undefined, queue[0]!, { dark: ["f3"] })).toEqual({ cancel: true });
  });

  it("a premoved promotion plays the piece picked", () => {
    const fen = "8/P6k/8/8/8/8/8/K7 w - - 0 1";
    expect(premoveTurn(fen, undefined, { from: "a7", to: "a8", promo: "n" })).toEqual({ play: "a7a8n" });
    expect(premoveTurn(fen, undefined, { from: "a7", to: "a8", promo: "q" })).toEqual({ play: "a7a8q" });
  });

  it("castling premoved plays as castling", () => {
    const fen = play(START_FEN, "e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6");
    expect(premoveTurn(fen, undefined, { from: "e1", to: "g1" })).toEqual({ play: "e1g1" });
  });

  it("nothing waiting: nothing to play", () => {
    expect(premoveQueueTurn(afterE4, undefined, [])).toEqual({ play: null, rest: [] });
  });
});

describe("what you draw and premove is kept by the game's key (board/yours.ts)", () => {
  it("a computer lines premoves up; a phone holds one (a new one takes its place)", () => {
    const key = "test:queue";
    addPremove(key, { from: "e2", to: "e4" }, true);
    addPremove(key, { from: "g1", to: "f3" }, true);
    expect(yours(key).queue.map((p) => p.from + p.to)).toEqual(["e2e4", "g1f3"]);
    addPremove(key, { from: "d2", to: "d4" }, false);
    expect(yours(key).queue.map((p) => p.from + p.to)).toEqual(["d2d4"]);
    setQueue(key, []);
    expect(yours(key).queue).toEqual([]);
  });

  it("tells whoever listens which key changed; Premoves switched off cancels every one", () => {
    const heard: string[] = [];
    const off = onYours((k) => heard.push(k));
    addPremove("test:a", { from: "e2", to: "e4" }, true);
    setMarks("test:b", toggleSquare(NO_MARKS, "e4", "red"));
    clearAllPremoves();
    off();
    addPremove("test:a", { from: "d2", to: "d4" }, true);
    expect(heard).toEqual(["test:a", "test:b", "test:a"]);
    expect(yours("test:a").queue).toHaveLength(1);
    // (Marks stay when premoves are switched off.)
    expect(yours("test:b").marks.squares).toEqual({ e4: "red" });
    dropYours("test:a");
    dropYours("test:b");
    expect(yours("test:a").queue).toEqual([]);
  });

  it("keeps only a few games' worth, the oldest going first", () => {
    for (let i = 0; i < 12; i++) addPremove(`test:many${i}`, { from: "e2", to: "e4" }, true);
    expect(yours("test:many0").queue).toEqual([]);
    expect(yours("test:many11").queue).toHaveLength(1);
  });

  it("a game's key is its own and stays the same; a seat is the game, the board and your side", () => {
    const a = {};
    const b = {};
    expect(gameKey(a)).toBe(gameKey(a));
    expect(gameKey(a)).not.toBe(gameKey(b));
    expect(seatKey(a, 3, "w")).toBe(`${gameKey(a)}:3:w`);
    expect(seatKey(a, 3, "w")).not.toBe(seatKey(a, 3, "b"));
  });
});

describe("the board draws again when its premove seat changes (boardInputs)", () => {
  it("a new key or side is a new board to draw; the same seat from a fresh object isn't", () => {
    const base = { fen: START_FEN, orientation: "white" as const, premove: { key: "g1:0:w", side: "w" as const } };
    expect(boardInputs({ ...base, premove: { ...base.premove } })).toEqual(boardInputs(base));
    expect(boardInputs({ ...base, premove: { key: "g2:0:w", side: "w" } })).not.toEqual(boardInputs(base));
    expect(boardInputs({ ...base, premove: { key: "g1:0:w", side: "b" } })).not.toEqual(boardInputs(base));
    expect(boardInputs({ ...base, premove: undefined })).not.toEqual(boardInputs(base));
  });
});
