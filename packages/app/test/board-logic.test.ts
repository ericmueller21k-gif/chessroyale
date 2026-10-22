import { describe, expect, it } from "vitest";
import { applyMove, START_FEN } from "@chessroyale/chess";
import { realSquare, viewSquare, type QuarterTurn } from "../src/board-view.ts";
import { squareXY } from "../src/components/GodKing.tsx";
import {
  ALL_SQUARES,
  DRAG_DISTANCE_PX,
  SLIDE_MS,
  boardInputs,
  boardSize,
  cellOf,
  destsFor,
  dragStarted,
  drawArrows,
  follow,
  gestureMoves,
  pieceClass,
  pieceCloseTo,
  positionKey,
  pressDown,
  pressMove,
  pressUp,
  readPieces,
  slidePiece,
  squareAt,
  squareAtPoint,
  stillRunning,
  type BoardPiece,
  type PressBoard,
} from "../src/board/logic.ts";

const TURNS: QuarterTurn[] = [0, 90, 270];
const SIDES = ["white", "black"] as const;

describe("the board's squares: where each is drawn, either way up and turned", () => {
  it("every square has its own cell, and the cell gives the square back, at every orientation and turn", () => {
    for (const o of SIDES)
      for (const t of TURNS) {
        const cells = ALL_SQUARES.map((s) => cellOf(s, o, t));
        expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(64);
        for (const s of ALL_SQUARES) {
          const c = cellOf(s, o, t);
          expect(squareAt(c.col, c.row, o, t)).toBe(s);
        }
      }
  });

  it("is where everything drawn over the board puts the square (squareXY), and where the turned view shows it", () => {
    for (const o of SIDES)
      for (const t of TURNS)
        for (const s of ALL_SQUARES) {
          const { col, row } = cellOf(s, o, t);
          const xy = squareXY(s, o, t);
          expect({ col, row }).toEqual({ col: (xy.x - 50) / 100, row: (xy.y - 50) / 100 });
          // The view's square, drawn the plain way up.
          expect(cellOf(viewSquare(s, t), o, 0)).toEqual({ col, row });
        }
  });

  it("puts a1 bottom left for White, top right for Black, and turns a quarter clockwise at 90", () => {
    expect(cellOf("a1", "white")).toEqual({ col: 0, row: 7 });
    expect(cellOf("h8", "white")).toEqual({ col: 7, row: 0 });
    expect(cellOf("a1", "black")).toEqual({ col: 7, row: 0 });
    // Turned clockwise, the bottom-left corner goes to the top left.
    expect(cellOf("a1", "white", 90)).toEqual({ col: 0, row: 0 });
    expect(cellOf("a1", "white", 270)).toEqual({ col: 7, row: 7 });
  });

  it("finds the square under a point, a square's width at a time, and nothing off the board", () => {
    const box = { left: 10, top: 20, width: 400, height: 400 };
    for (const o of SIDES)
      for (const t of TURNS)
        for (const s of ALL_SQUARES) {
          const { col, row } = cellOf(s, o, t);
          // The center, and just inside each corner.
          for (const [dx, dy] of [
            [25, 25],
            [0.01, 0.01],
            [49.99, 49.99],
          ])
            expect(squareAtPoint(box.left + col * 50 + dx!, box.top + row * 50 + dy!, box, o, t)).toBe(s);
        }
    expect(squareAtPoint(9.9, 100, box, "white")).toBeNull();
    expect(squareAtPoint(410, 100, box, "white")).toBeNull();
    expect(squareAtPoint(100, 19.9, box, "white")).toBeNull();
    expect(squareAtPoint(100, 420, box, "white")).toBeNull();
    // (A taps' square turned back is the real one: board-view's inverse.)
    for (const s of ALL_SQUARES) for (const t of TURNS) expect(realSquare(viewSquare(s, t), t)).toBe(s);
  });

  it("is drawn a whole multiple of 8 device pixels, never wider than its box and at most 8 device pixels smaller", () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3])
      for (let w = 200; w < 900; w += 0.37) {
        const s = boardSize(w, dpr);
        const device = s * dpr;
        expect(Math.abs(device / 8 - Math.round(device / 8))).toBeLessThan(1e-6);
        expect(s).toBeLessThanOrEqual(w + 1e-9);
        expect(w * dpr - device).toBeLessThan(8 + 1e-6);
      }
    expect(boardSize(390, 3)).toBeCloseTo(389.3333, 3);
    expect(boardSize(630, 1)).toBe(624);
  });
});

describe("a press becomes a drag at 3 px", () => {
  it("not before, and at 3 px in any direction", () => {
    expect(DRAG_DISTANCE_PX).toBe(3);
    expect(dragStarted(2.99, 0)).toBe(false);
    expect(dragStarted(0, -2.9)).toBe(false);
    expect(dragStarted(2, 2)).toBe(false);
    expect(dragStarted(3, 0)).toBe(true);
    expect(dragStarted(0, -3)).toBe(true);
    expect(dragStarted(2.2, 2.2)).toBe(true);
  });

  it("slides take 220 ms", () => expect(SLIDE_MS).toBe(220));
});

describe("taps and drags", () => {
  // White to move from the start; e2 may go to e3 or e4.
  const fen = START_FEN;
  const pieces = readPieces(fen);
  const dests = destsFor(fen);
  const board = (interactive = true): PressBoard => ({
    piece: (sq) => pieces.get(sq),
    movable: (sq) => interactive && pieces.get(sq)?.[0] === "w",
    canMove: (a, b) => interactive && a !== b && pieces.get(a)?.[0] === "w" && !!dests.get(a)?.includes(b),
    interactive,
  });

  it("a tap selects a piece of the side to move; a tap on a dot moves it as the press goes down", () => {
    const a = pressDown(board(), null, "e2", 100, 100);
    expect(a.selected).toBe("e2");
    expect(a.press?.from).toBe("e2");
    const up = pressUp(board(), a.selected, a.press!, "e2");
    expect(up).toEqual({ selected: "e2", move: null });
    const b = pressDown(board(), "e2", "e4", 100, 50);
    expect(b).toEqual({ selected: null, move: ["e2", "e4"], press: null });
  });

  it("a second tap on the selected piece lets go of it; a tap on an empty square or the other side's piece does too", () => {
    const a = pressDown(board(), "e2", "e2", 100, 100);
    expect(a.selected).toBe("e2");
    expect(pressUp(board(), a.selected, a.press!, "e2").selected).toBeNull();
    expect(pressDown(board(), "e2", "e5", 0, 0).selected).toBeNull();
    expect(pressDown(board(), "e2", "e7", 0, 0)).toEqual({ selected: null, move: null, press: null });
  });

  it("a tap on another of your pieces selects that one instead", () => {
    const a = pressDown(board(), "e2", "g1", 0, 0);
    expect(a.selected).toBe("g1");
    expect(a.move).toBeNull();
  });

  it("a press follows the pointer only from 3 px, and a drop on a dot is the move", () => {
    const a = pressDown(board(), null, "e2", 100, 100);
    let p = pressMove(a.press!, 101, 98, "e2");
    expect(p.started).toBe(false);
    p = pressMove(p, 100, 97, "e2");
    expect(p.started).toBe(true);
    p = pressMove(p, 100, 20, "e4");
    expect(p.left).toBe(true);
    expect(pressUp(board(), a.selected, p, "e4")).toEqual({ selected: null, move: ["e2", "e4"] });
  });

  it("a drop on a square it can't go to puts it back and lets go of it; dropped back home after leaving, too", () => {
    const a = pressDown(board(), null, "e2", 100, 100);
    const away = pressMove(pressMove(a.press!, 100, 80, "e3"), 100, 10, "e5");
    expect(pressUp(board(), a.selected, away, "e5")).toEqual({ selected: null, move: null });
    expect(pressUp(board(), a.selected, pressMove(away, 100, 100, "e2"), "e2")).toEqual({ selected: null, move: null });
    // Off the board.
    expect(pressUp(board(), a.selected, away, null)).toEqual({ selected: null, move: null });
    // A wobble within its own square keeps it selected (the first press), as a tap does.
    const wobble = pressMove(a.press!, 104, 100, "e2");
    expect(pressUp(board(), a.selected, wobble, "e2")).toEqual({ selected: "e2", move: null });
  });

  it("after a dragged move, the next drag starts at once (as before)", () => {
    const a = pressDown(board(), null, "g1", 0, 0, true);
    expect(a.press?.started).toBe(true);
    expect(pressDown(board(), null, "g1", 0, 0, false).press?.started).toBe(false);
  });

  it("nothing is picked up or moved while moving is off", () => {
    expect(pressDown(board(false), null, "e2", 0, 0)).toEqual({ selected: null, move: null, press: null });
    // (A selection left from before stays until a press lets go of it.)
    expect(pressDown(board(false), "e2", "e4", 0, 0)).toEqual({ selected: "e2", move: null, press: null });
  });
});

describe("the move dots", () => {
  it("are every legal move's squares, once each, from each piece", () => {
    const d = destsFor(START_FEN);
    expect([...d.keys()].sort()).toEqual(["a2", "b1", "b2", "c2", "d2", "e2", "f2", "g1", "g2", "h2"]);
    expect(d.get("e2")!.sort()).toEqual(["e3", "e4"]);
    expect(d.get("g1")!.sort()).toEqual(["f3", "h3"]);
    // A promotion's four moves are one dot.
    const promo = "8/4P3/8/8/8/8/8/k6K w - - 0 1";
    expect(destsFor(promo).get("e7")).toEqual(["e8"]);
  });

  it("are only the moves allowed when a power limits them", () => {
    const d = destsFor(START_FEN, ["g1f3", "e2e4"]);
    expect([...d.entries()].sort()).toEqual([
      ["e2", ["e4"]],
      ["g1", ["f3"]],
    ]);
  });

  it("never come from, go to or pass through Hollow's dark", () => {
    // e2 dark: no dots from it; e3 dark: e2's push through it is gone too.
    expect(destsFor(START_FEN, undefined, ["e2"]).has("e2")).toBe(false);
    expect(destsFor(START_FEN, undefined, ["e3"]).get("e2") ?? []).toEqual([]);
    expect(destsFor(START_FEN, undefined, ["f3"]).get("g1")).toEqual(["h3"]);
  });
});

describe("Chess960 castling on the board", () => {
  // King b1 between rooks a1 and h1, the back rank otherwise empty, every right on (Shredder-FEN).
  const open = "r5kr/pppppppp/8/8/8/8/PPPPPPPP/RK5R w HAha - 0 1";

  it("the king's dots: onto either rook, and onto g1 (nothing else goes there); c1 stays an ordinary step", () => {
    expect(destsFor(open).get("b1")!.sort()).toEqual(["a1", "c1", "g1", "h1"]);
    expect(gestureMoves(open, undefined, "b1", "h1")).toEqual(["b1h1"]);
    expect(gestureMoves(open, undefined, "b1", "g1")).toEqual(["b1h1"]);
    expect(gestureMoves(open, undefined, "b1", "a1")).toEqual(["b1a1"]);
    expect(gestureMoves(open, undefined, "b1", "c1")).toEqual(["b1c1"]);
    expect(gestureMoves(open, undefined, "b1", "d1")).toEqual([]);
  });

  it("the edge cases: a swap, the king already on its square, and its rook standing on it", () => {
    // King f1 and rook g1 swap: the rook's square is the king's square, one dot.
    const swap = "6k1/8/8/8/8/8/8/5KR1 w G - 0 1";
    expect(gestureMoves(swap, undefined, "f1", "g1")).toEqual(["f1g1"]);
    expect(destsFor(swap).get("f1")!.filter((d) => d === "g1")).toEqual(["g1"]);
    // King already on g1: only onto the rook.
    const still = "6k1/8/8/8/8/8/8/6KR w H - 0 1";
    expect(destsFor(still).get("g1")).toContain("h1");
    expect(gestureMoves(still, undefined, "g1", "h1")).toEqual(["g1h1"]);
    // King f1, rook h1: g1 is the king's ordinary step, so dragging there steps; onto the rook castles.
    const step = "6k1/8/8/8/8/8/8/5K1R w H - 0 1";
    expect(gestureMoves(step, undefined, "f1", "g1")).toEqual(["f1g1"]);
    expect(gestureMoves(step, undefined, "f1", "h1")).toEqual(["f1h1"]);
  });

  it("only from the moves allowed: no castling dot when a screen leaves castling out", () => {
    expect(destsFor(open, ["b1c1", "a2a3"]).get("b1")).toEqual(["c1"]);
    expect(gestureMoves(open, ["b1c1", "a2a3"], "b1", "g1")).toEqual([]);
  });

  it("a tap on the king then its rook castles, and so does a drag onto the rook or onto g1", () => {
    const pieces = readPieces(open);
    const dests = destsFor(open);
    const board: PressBoard = {
      piece: (sq) => pieces.get(sq),
      movable: (sq) => pieces.get(sq)?.[0] === "w",
      canMove: (a, b) => a !== b && pieces.get(a)?.[0] === "w" && !!dests.get(a)?.includes(b),
      interactive: true,
    };
    const tap = pressDown(board, "b1", "h1", 0, 0);
    expect(tap.move).toEqual(["b1", "h1"]);
    for (const to of ["h1", "g1"]) {
      const down = pressDown(board, null, "b1", 0, 0, true);
      const up = pressUp(board, down.selected, pressMove(down.press!, 300, 0, to), to);
      expect(up.move).toEqual(["b1", to]);
      expect(gestureMoves(open, undefined, "b1", to)).toEqual(["b1h1"]);
    }
  });

  it("the king and the rook both slide, whichever way they go", () => {
    let id = 1000;
    const ids = () => id++;
    const by = (list: BoardPiece[], sq: string) => list.find((p) => p.square === sq)!;
    const a = follow([], readPieces(open), ids);
    const short = follow(a.pieces, readPieces(applyMove(open, "b1h1")), ids);
    expect(by(short.pieces, "g1").id).toBe(by(a.pieces, "b1").id);
    expect(by(short.pieces, "f1").id).toBe(by(a.pieces, "h1").id);
    const long = follow(a.pieces, readPieces(applyMove(open, "b1a1")), ids);
    expect(by(long.pieces, "c1").id).toBe(by(a.pieces, "b1").id);
    expect(by(long.pieces, "d1").id).toBe(by(a.pieces, "a1").id);
    // The swap: each takes the other's square.
    const swap = "6k1/8/8/8/8/8/8/5KR1 w G - 0 1";
    const s0 = follow([], readPieces(swap), ids);
    const s1 = follow(s0.pieces, readPieces(applyMove(swap, "f1g1")), ids);
    expect(by(s1.pieces, "g1").id).toBe(by(s0.pieces, "f1").id);
    expect(by(s1.pieces, "f1").id).toBe(by(s0.pieces, "g1").id);
  });

  it("a normal game's castling is untouched: e1g1, with no shortcuts", () => {
    const f = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(gestureMoves(f, undefined, "e1", "g1")).toEqual(["e1g1"]);
    expect(gestureMoves(f, undefined, "e1", "h1")).toEqual([]);
    expect(destsFor(f).get("e1")!.sort()).toEqual(["c1", "d1", "d2", "e2", "f1", "f2", "g1"]);
  });
});

describe("which piece went where", () => {
  let id = 1;
  const ids = () => id++;
  const start = follow([], readPieces(START_FEN), ids);
  const by = (list: BoardPiece[], sq: string) => list.find((p) => p.square === sq)!;

  it("a move slides the piece that moved; the others keep their places", () => {
    const after = follow(start.pieces, readPieces(applyMove(START_FEN, "e2e4")), ids);
    expect(after.moved.size).toBe(1);
    expect(by(after.pieces, "e4").id).toBe(by(start.pieces, "e2").id);
    expect(after.gone).toEqual([]);
    for (const p of start.pieces.filter((q) => q.square !== "e2")) expect(by(after.pieces, p.square).id).toBe(p.id);
  });

  it("a capture: the taker slides, the taken fades", () => {
    const f1 = applyMove(applyMove(START_FEN, "e2e4"), "d7d5");
    const a = follow(start.pieces, readPieces(f1), ids);
    const b = follow(a.pieces, readPieces(applyMove(f1, "e4d5")), ids);
    expect(by(b.pieces, "d5").id).toBe(by(a.pieces, "e4").id);
    expect(b.gone.map((g) => `${g.code}@${g.square}`)).toEqual(["bp@d5"]);
  });

  it("castling slides the king and the rook", () => {
    const f = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const a = follow([], readPieces(f), ids);
    const b = follow(a.pieces, readPieces(applyMove(f, "e1g1")), ids);
    expect(by(b.pieces, "g1").id).toBe(by(a.pieces, "e1").id);
    expect(by(b.pieces, "f1").id).toBe(by(a.pieces, "h1").id);
    expect(b.moved.size).toBe(2);
  });

  it("a promotion: the pawn fades and its new piece appears (as the old board did)", () => {
    const f = "8/4P3/8/8/8/8/8/k6K w - - 0 1";
    const a = follow([], readPieces(f), ids);
    const b = follow(a.pieces, readPieces(applyMove(f, "e7e8q")), ids);
    expect(b.gone.map((g) => g.code)).toEqual(["wp"]);
    expect(by(b.pieces, "e8").code).toBe("wq");
    expect(a.pieces.some((p) => p.id === by(b.pieces, "e8").id)).toBe(false);
  });

  it("each piece takes the nearest of its kind that left", () => {
    // Two white knights swap files in one jump: each goes to its nearest.
    const a = follow([], readPieces("4k3/8/8/8/8/8/8/1N2K1N1 w - - 0 1"), ids);
    const b = follow(a.pieces, readPieces("4k3/8/8/8/8/2N5/8/4K2N w - - 0 1"), ids);
    expect(by(b.pieces, "c3").id).toBe(by(a.pieces, "b1").id);
    expect(by(b.pieces, "h1").id).toBe(by(a.pieces, "g1").id);
  });

  it("keeps the pieces in id order, so a moved piece keeps its place in the page", () => {
    const b = follow(start.pieces, readPieces(applyMove(START_FEN, "g1f3")), ids);
    expect(b.pieces.map((p) => p.id)).toEqual([...b.pieces.map((p) => p.id)].sort((x, y) => x - y));
  });

  it("reads the position and its key", () => {
    expect(readPieces(START_FEN).size).toBe(32);
    expect(readPieces("8/8/8/8/8/8/8/8 w - - 0 1").size).toBe(0);
    expect(positionKey(readPieces(START_FEN))).toBe(positionKey(new Map([...readPieces(START_FEN)].reverse())));
    expect(positionKey(slidePiece(readPieces(START_FEN), "e2", "e4"))).toBe(positionKey(readPieces(applyMove(START_FEN, "e2e4"))));
    expect(pieceClass("wp")).toBe("white pawn");
    expect(pieceClass("bk")).toBe("black king");
  });

  it("a touch near a piece means the board, not a scroll", () => {
    const box = { left: 0, top: 0, width: 400, height: 400 };
    const p = readPieces("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    // e1's center is (225, 375).
    expect(pieceCloseTo(p, 225, 375, box, "white")).toBe(true);
    expect(pieceCloseTo(p, 225 + 49, 375, box, "white")).toBe(true);
    expect(pieceCloseTo(p, 225 + 60, 375, box, "white")).toBe(false);
    expect(pieceCloseTo(p, 25, 175, box, "white")).toBe(false);
  });
});

describe("arrows", () => {
  it("run between the squares' centers, stopping short for the head; shorter still with another arrow into the square", () => {
    const [a] = drawArrows([{ move: "e2e4", brush: "green" }], "white");
    expect(a).toMatchObject({ x1: 0.5, y1: 2.5, x2: 0.5 });
    expect(a!.y2).toBeCloseTo(0.5 + 10 / 64, 6);
    const two = drawArrows(
      [
        { move: "e2e4", brush: "green" },
        { move: "d2e4", brush: "blue" },
      ],
      "white",
    );
    expect(two[0]!.y2).toBeCloseTo(0.5 + 20 / 64, 6);
    // Black's way up, the same arrow points down the screen.
    const [b] = drawArrows([{ move: "e2e4", brush: "green" }], "black");
    expect(b).toMatchObject({ x1: -0.5, y1: -2.5 });
  });

  it("are turned with the board", () => {
    for (const t of TURNS) {
      const [a] = drawArrows([{ move: "b1c3", brush: "green" }], "white", t);
      const c = cellOf("b1", "white", t);
      expect({ x: a!.x1, y: a!.y1 }).toEqual({ x: c.col - 3.5, y: c.row - 3.5 });
    }
  });

  it("carry a label where the shaft meets the head", () => {
    const [a] = drawArrows([{ move: "e2e4", brush: "green", label: "52.1" }], "white");
    expect(a!.label!.text).toBe("52.1");
    expect(a!.label!.x).toBeCloseTo(0.5, 6);
    expect(a!.label!.y).toBeCloseTo(0.5 + 33 / 64, 6);
  });
});

describe("the fades and slides still running (stillRunning)", () => {
  it("keeps those still running and says when the next ends", () => {
    const r = stillRunning([{ until: 300, id: 1 }, { until: 150, id: 2 }], new Map([[5, 200]]), 100);
    expect(r.fading.map((f) => f.id)).toEqual([1, 2]);
    expect([...r.sliding.keys()]).toEqual([5]);
    expect(r.next).toBe(150);
  });

  it("lets go of those that are over: nothing left, the board doesn't draw again by itself", () => {
    const r = stillRunning([{ until: 100 }], new Map([[5, 90]]), 100 + SLIDE_MS);
    expect(r.fading).toEqual([]);
    expect(r.sliding.size).toBe(0);
    expect(r.next).toBeNull();
  });

  it("a fade over and a slide still going: only the slide is waited for", () => {
    const r = stillRunning([{ until: 100 }], new Map([[7, 400]]), 250);
    expect(r.fading).toEqual([]);
    expect(r.next).toBe(400);
  });
});

describe("when the board draws again (boardInputs)", () => {
  const base = {
    fen: START_FEN,
    orientation: "white" as const,
    lastMove: "e2e4",
    interactive: true,
    moves: ["e7e5", "d7d5"],
    arrows: [{ move: "e7e5", brush: "green" as const, label: "51.0" }],
    marks: { e4: "ls-blunder" },
    dark: ["e7"],
    onDarkTry: () => {},
    turn: 90 as const,
    // (What a screen draws on its pieces: the board draws again only when its key changes, not for a fresh `of` each frame.)
    decor: { key: "s", of: () => null },
  };

  it("the same board from fresh lists, objects and handlers, as a screen drawing a frame passes it: nothing to draw", () => {
    const again = { ...base, moves: [...base.moves], arrows: base.arrows.map((a) => ({ ...a })), marks: { ...base.marks }, dark: [...base.dark], onDarkTry: () => {}, decor: { key: base.decor.key, of: () => null } };
    expect(boardInputs(again)).toEqual(boardInputs(base));
    // (Plain values, so a hook's dependency list compares them one by one.)
    for (const v of boardInputs(base)) expect(["string", "number", "boolean"].includes(typeof v) || v === null).toBe(true);
  });

  it("anything the board shows, changed: drawn again", () => {
    const changes: Record<string, unknown>[] = [
      { fen: applyMove(START_FEN, "e2e4") },
      { orientation: "black" },
      { lastMove: "d2d4" },
      { lastMove: null },
      { interactive: false },
      { moves: ["e7e5"] },
      { moves: undefined },
      { moves: [] },
      { arrows: [{ move: "e7e5", brush: "blue", label: "51.0" }] },
      { arrows: [{ move: "e7e5", brush: "green", label: "52.0" }] },
      { arrows: [{ move: "d7d5", brush: "green", label: "51.0" }] },
      { arrows: undefined },
      { small: true },
      { animate: false },
      { marks: { d4: "ls-blunder" } },
      { marks: undefined },
      { dark: ["e7", "d7"] },
      { dark: undefined },
      { onDarkTry: undefined },
      { turn: 0 },
      { turn: 270 },
      { decor: { key: "o", of: () => null } },
    ];
    const before = JSON.stringify(boardInputs(base));
    for (const c of changes) expect(JSON.stringify(boardInputs({ ...base, ...c } as typeof base)), JSON.stringify(c)).not.toBe(before);
  });

  it("defaults and their spelled-out values are the same board", () => {
    const plain = { fen: START_FEN, orientation: "white" as const };
    expect(boardInputs({ ...plain, animate: true, interactive: false, small: false, turn: 0, lastMove: null })).toEqual(boardInputs(plain));
  });
});
