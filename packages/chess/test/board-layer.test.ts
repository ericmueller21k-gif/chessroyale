import { describe, expect, it } from "vitest";
import {
  START_FEN,
  emptyLayer,
  edgeOf,
  followLayer,
  heldIn,
  layerMoves,
  layerStop,
  legalMoves,
  mergeLayers,
  moveEdges,
  movePaths,
  moveSquares,
  pieceAt,
  wearLayer,
  type BoardLayer,
  type EdgeMark,
  type LayerMarks,
  type PieceMark,
  type SquareMark,
} from "../src/index.ts";

// The board layer (board-layer.ts): every mark, overlaps, the lift, castling, promotion, en passant.

const CASTLE = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
const CASTLE_B = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1";
const EP = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2";
const PROMO = "3r3k/4P3/8/8/8/8/8/4K3 w - - 0 1";
const ROOK = "4k3/8/8/8/8/8/8/R3K3 w - - 0 1";
const ROOK_B = "r3k3/8/8/8/8/8/8/4K3 b - - 0 1";
const KNIGHT = "4k3/8/8/8/3N4/8/8/4K3 w - - 0 1";
const CHECK = "4k3/8/8/8/8/8/4q3/4K3 w - - 0 1";
const MATE = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
// (Chess960: king g1 between rooks b1 and h1; castling is the king onto its rook.)
const C960 = "1r4kr/8/8/8/8/8/8/1R4KR w HBhb - 0 1";

const layer = (marks: LayerMarks, crowd: "w" | "b" = "w"): BoardLayer => mergeLayers(crowd, [marks]);
const sq = (square: string, m: Partial<SquareMark> = {}): SquareMark => ({ square, kind: "pie", binds: "both", by: "test", noLand: true, ...m });
const wall = (square: string, m: Partial<SquareMark> = {}): SquareMark => sq(square, { kind: "block", noPass: true, ...m });
const edge = (a: string, b: string, m: Partial<EdgeMark> = {}): EdgeMark => ({ a, b, across: "straight", kind: "cut", binds: "both", by: "test", ...m });
const piece = (square: string, m: Partial<PieceMark> = {}): PieceMark => ({ square, kind: "frozen", binds: "crowd", by: "test", held: true, ...m });
/** The d|e line, all eight edges (the board saw's). */
const line = (files: [string, string], m: Partial<EdgeMark> = {}): EdgeMark[] =>
  [1, 2, 3, 4, 5, 6, 7, 8].map((r) => edge(`${files[0]}${r}`, `${files[1]}${r}`, { across: "all", kind: "boardsaw", ...m }));
const stopped = (l: BoardLayer, fen: string) => legalMoves(fen).filter((m) => layerStop(l, fen, m));

describe("the board layer: no marks", () => {
  it("stops nothing and lifts nothing", () => {
    for (const fen of [START_FEN, CASTLE, EP, PROMO]) {
      expect(layerMoves(emptyLayer("w"), fen)).toEqual({ moves: legalMoves(fen), lifted: false });
      for (const m of legalMoves(fen)) expect(layerStop(emptyLayer("w"), fen, m)).toBeNull();
    }
  });
});

describe("movePaths: the pieces a move moves", () => {
  it("one piece, or castling's king and rook (a normal board's and Chess960's)", () => {
    expect(movePaths("a1a8", ROOK)).toEqual([{ from: "a1", to: "a8" }]);
    expect(movePaths("e1g1", CASTLE)).toEqual([{ from: "e1", to: "g1" }, { from: "h1", to: "f1" }]);
    expect(movePaths("e1c1", CASTLE)).toEqual([{ from: "e1", to: "c1" }, { from: "a1", to: "d1" }]);
    expect(movePaths("e8g8", CASTLE_B)).toEqual([{ from: "e8", to: "g8" }, { from: "h8", to: "f8" }]);
    expect(movePaths("e1f1", CASTLE)).toEqual([{ from: "e1", to: "f1" }]);
    expect(legalMoves(C960)).toEqual(expect.arrayContaining(["g1h1", "g1b1"]));
    // (The king already on g1: only the rook moves.)
    expect(movePaths("g1h1", C960)).toEqual([{ from: "h1", to: "f1" }]);
    expect(movePaths("g1b1", C960)).toEqual([{ from: "g1", to: "c1" }, { from: "b1", to: "d1" }]);
  });
});

describe("square marks", () => {
  it("no landing (a pie): nothing lands on it, captures included; slides pass over it; either side", () => {
    expect(layerStop(layer({ squares: [sq("e4")] }), START_FEN, "e2e4")?.kind).toBe("pie");
    expect(layerStop(layer({ squares: [sq("e4")] }), START_FEN, "e2e3")).toBeNull();
    expect(stopped(layer({ squares: [sq("a4")] }), ROOK)).toEqual(["a1a4"]);
    expect(stopped(layer({ squares: [sq("e6")] }), KNIGHT)).toEqual(["d4e6"]);
    expect(stopped(layer({ squares: [sq("f5")] }), KNIGHT)).toEqual(["d4f5"]);
    expect(stopped(layer({ squares: [sq("a5")] }), "4k3/8/8/p7/8/8/8/R3K3 w - - 0 1")).toEqual(["a1a5"]);
    // (Binding both: the boss's moves too.)
    expect(stopped(layer({ squares: [sq("a4")] }), ROOK_B)).toEqual(["a8a4"]);
  });

  it("a wall (a toy block, a plant, the beam): nothing lands on it or passes over it; a knight jumps it", () => {
    expect(stopped(layer({ squares: [wall("a4")] }), ROOK)).toEqual(["a1a4", "a1a5", "a1a6", "a1a7", "a1a8"]);
    expect(layerStop(layer({ squares: [wall("e3")] }), START_FEN, "e2e4")?.kind).toBe("block");
    expect(layerStop(layer({ squares: [wall("c3")] }), START_FEN, "b1a3")).toBeNull();
    expect(layerStop(layer({ squares: [wall("d2"), wall("e2")] }), "4k3/8/8/8/8/8/3PP3/3QK1N1 w - - 0 1", "g1f3")).toBeNull();
    // (The same squares as Big Boy's toy block, a slide's way and landing, wherever the square is empty.)
    for (const fen of [START_FEN, CASTLE, EP, PROMO, ROOK, KNIGHT])
      for (const f of "abcdefgh")
        for (let r = 1; r <= 8; r++) {
          const s = `${f}${r}`;
          if (pieceAt(fen, s)) continue;
          const l = layer({ squares: [wall(s)] });
          for (const m of legalMoves(fen)) expect(!!layerStop(l, fen, m), `${fen} ${s} ${m}`).toBe(moveSquares(m, fen).slice(1).includes(s));
        }
  });

  it("no passing, landing allowed (Big Boy's tower): onto it, yes; over it, no", () => {
    const tower = (s: string) => sq(s, { kind: "block", noLand: false, noPass: true });
    expect(stopped(layer({ squares: [tower("a4")] }), ROOK)).toEqual(["a1a5", "a1a6", "a1a7", "a1a8"]);
    expect(layerStop(layer({ squares: [tower("e3")] }), START_FEN, "e2e3")).toBeNull();
    expect(layerStop(layer({ squares: [tower("e3")] }), START_FEN, "e2e4")?.kind).toBe("block");
  });

  it("fire: drawn, stops nothing", () => {
    const fire = sq("e4", { kind: "fire", noLand: false, stage: 2 });
    expect(layerMoves(layer({ squares: [fire] }), START_FEN)).toEqual({ moves: legalMoves(START_FEN), lifted: false });
  });

  it("castling: the king's and the rook's landing and way", () => {
    // (A pie: where the king or the rook lands; the rook passes b1 on the queen's side.)
    expect(stopped(layer({ squares: [sq("g1")] }), CASTLE)).toEqual(["h1g1", "e1g1"]);
    expect(stopped(layer({ squares: [sq("f1")] }), CASTLE)).toEqual(["e1f1", "h1f1", "e1g1"]);
    expect(stopped(layer({ squares: [sq("b1")] }), CASTLE)).toEqual(["a1b1"]);
    expect(stopped(layer({ squares: [sq("d1")] }), CASTLE)).toEqual(["a1d1", "e1d1", "e1c1"]);
    // (A wall on b1: the rook can't pass it.)
    expect(stopped(layer({ squares: [wall("b1")] }), CASTLE)).toEqual(["a1b1", "a1c1", "a1d1", "e1c1"]);
    // (The tower: the king may not land on it as he castles: the rook passes it; nor pass it.)
    const tower = (s: string) => sq(s, { kind: "block", noLand: false, noPass: true });
    expect(stopped(layer({ squares: [tower("g1")] }), CASTLE)).toEqual(["h1f1", "e1g1"]);
    expect(stopped(layer({ squares: [tower("f1")] }), CASTLE)).toEqual(["e1g1"]);
    expect(stopped(layer({ squares: [tower("c1")] }), CASTLE)).toEqual(["a1d1", "e1c1"]);
    // (Chess960: the king onto his rook lands him on c1 and the rook on d1.)
    expect(stopped(layer({ squares: [sq("c1")] }), C960)).toEqual(["b1c1", "g1b1"]);
    expect(stopped(layer({ squares: [sq("f1")] }), C960)).toEqual(["b1f1", "g1f1", "g1h1"]);
  });

  it("binds: the crowd's moves, the bosses' (Don Dough's lump: his side only)", () => {
    const lump = sq("a4", { kind: "dough", binds: "bosses" });
    expect(stopped(layer({ squares: [lump] }, "w"), ROOK)).toEqual([]);
    expect(stopped(layer({ squares: [lump] }, "b"), ROOK)).toEqual(["a1a4"]);
    expect(stopped(layer({ squares: [lump] }, "w"), ROOK_B)).toEqual(["a8a4"]);
    expect(stopped(layer({ squares: [sq("a4", { binds: "crowd" })] }, "w"), ROOK_B)).toEqual([]);
  });
});

describe("edge marks", () => {
  it("straight (Sawyer's cut): no rank or file move crosses; diagonals pass at the corners; knights jump", () => {
    const cut = layer({ edges: [edge("e3", "e4")] });
    expect(layerStop(cut, START_FEN, "e2e4")?.kind).toBe("cut");
    expect(layerStop(cut, START_FEN, "e2e3")).toBeNull();
    expect(stopped(layer({ edges: [edge("a4", "a5")] }), ROOK)).toEqual(["a1a5", "a1a6", "a1a7", "a1a8"]);
    expect(stopped(layer({ edges: [edge("e4", "d4")] }), KNIGHT)).toEqual([]);
    expect(stopped(layer({ edges: [edge("d4", "d5")] }), KNIGHT)).toEqual([]);
    expect(stopped(layer({ edges: [edge("g1", "h1")] }), CASTLE)).toEqual(["h1g1", "h1f1", "e1g1"]);
    expect(stopped(layer({ edges: [edge("a1", "b1")] }), CASTLE)).toEqual(["a1b1", "a1c1", "a1d1", "e1c1"]);
    expect(stopped(layer({ edges: [edge("e1", "e2")] }), CASTLE)).toEqual([]);
    // (Either side.)
    expect(stopped(layer({ edges: [edge("a4", "a5")] }), ROOK_B)).toEqual(["a8a4", "a8a3", "a8a2", "a8a1"]);
  });

  it("straight: the same moves as Sawyer's moveEdges, every edge, every legal move", () => {
    const edges: { a: string; b: string }[] = [];
    for (const f of "abcdefgh")
      for (let r = 1; r <= 8; r++) {
        if (f !== "h") edges.push(edgeOf(`${f}${r}`, `${String.fromCharCode(f.charCodeAt(0) + 1)}${r}`));
        if (r < 8) edges.push(edgeOf(`${f}${r}`, `${f}${r + 1}`));
      }
    for (const fen of [START_FEN, CASTLE, CASTLE_B, EP, PROMO, ROOK, KNIGHT])
      for (const e of edges) {
        const l = layer({ edges: [edge(e.a, e.b)] });
        for (const m of legalMoves(fen)) expect(!!layerStop(l, fen, m), `${fen} ${e.a}|${e.b} ${m}`).toBe(moveEdges(m, fen).some((x) => x.a === e.a && x.b === e.b));
      }
  });

  it("all (the board saw's line): nothing crosses, knights and diagonals included", () => {
    const saw = layer({ edges: line(["d", "e"]) });
    for (const fen of [START_FEN, CASTLE, CASTLE_B, EP, PROMO, ROOK, KNIGHT, "4k3/8/8/8/3B4/8/8/4K3 w - - 0 1"])
      for (const m of legalMoves(fen)) expect(!!layerStop(saw, fen, m), `${fen} ${m}`).toBe(m.charCodeAt(0) - 97 <= 3 !== m.charCodeAt(2) - 97 <= 3);
    expect(layerStop(saw, KNIGHT, "d4f5")?.kind).toBe("boardsaw");
    expect(layerStop(saw, CASTLE, "e1c1")?.kind).toBe("boardsaw");
  });

  it("all, one edge: a knight's jump across it counts", () => {
    const one = layer({ edges: [edge("g1", "g2", { across: "all" })] });
    expect(stopped(one, START_FEN)).toEqual(["g1f3", "g1h3"]);
  });

  it("all, binding the crowd only (Folio's crease): castling's rook alone crosses it; his pieces cross freely", () => {
    const crease = layer({ edges: line(["g", "h"], { kind: "crease", binds: "crowd" }) });
    expect(stopped(crease, CASTLE)).toEqual(["h1g1", "h1f1", "e1g1"]);
    expect(stopped(crease, CASTLE_B)).toEqual([]);
    expect(stopped(layer({ edges: line(["g", "h"], { kind: "crease", binds: "crowd" }) }, "b"), CASTLE_B)).toEqual(["h8g8", "h8f8", "e8g8"]);
  });
});

describe("piece marks", () => {
  it("held: its piece doesn't move, nor castles as the rook; the rest move", () => {
    expect(stopped(layer({ pieces: [piece("h1")] }), CASTLE)).toEqual(["h1g1", "h1f1", "e1g1"]);
    expect(layerStop(layer({ pieces: [piece("e2")] }), START_FEN, "e2e4")?.kind).toBe("frozen");
    // (The same moves as heldIn, the held pieces' one rule today, every square.)
    for (const fen of [START_FEN, CASTLE, CASTLE_B, EP, PROMO])
      for (const f of "abcdefgh")
        for (let r = 1; r <= 8; r++) {
          const s = `${f}${r}`;
          const l = layer({ pieces: [piece(s, { binds: "both" })] });
          for (const m of legalMoves(fen)) expect(!!layerStop(l, fen, m), `${fen} ${s} ${m}`).toBe(heldIn(fen, m, [s]));
        }
    // (Chess960: castling with a held rook.)
    expect(stopped(layer({ pieces: [piece("b1")] }), C960)).toEqual(legalMoves(C960).filter((m) => m.startsWith("b1") || m === "g1b1"));
  });

  it("shielded from pawns (Don Dough's gold): a pawn can't take it, other pieces can; en passant too", () => {
    const gold = piece("d8", { kind: "gold", held: false, shieldFrom: "pawns" });
    expect(stopped(layer({ pieces: [gold] }), PROMO)).toEqual(["e7d8n", "e7d8b", "e7d8r", "e7d8q"]);
    expect(layerStop(layer({ pieces: [gold] }), "3r3k/4P3/8/8/8/8/8/3RK3 w - - 0 1", "d1d8")).toBeNull();
    expect(stopped(layer({ pieces: [piece("d5", { kind: "gold", held: false, shieldFrom: "pawns" })] }), EP)).toEqual(["e5d6"]);
  });

  it("shielded from all (Chandy's shields): nothing takes it; binding the crowd, his captures go on", () => {
    const shield = piece("d8", { kind: "shield", held: false, shieldFrom: "all" });
    const fen = "3r3k/4P3/8/8/8/8/8/3RK3 w - - 0 1";
    expect(stopped(layer({ pieces: [shield] }), fen)).toEqual(["e7d8n", "e7d8b", "e7d8r", "e7d8q", "d1d8"]);
    const his = "3r3k/4P3/8/8/8/8/8/3RK3 b - - 0 1";
    expect(stopped(layer({ pieces: [piece("d1", { kind: "shield", held: false, shieldFrom: "all" })] }), his)).toEqual([]);
  });

  it("marked (a splat, a draft, a lock): drawn, stops nothing", () => {
    const drawn = layer({ pieces: [piece("e2", { kind: "splat", held: false }), piece("g1", { kind: "draft", held: false }), piece("d8", { kind: "lock", held: false })] });
    expect(stopped(drawn, START_FEN)).toEqual([]);
  });
});

describe("overlaps: the most restrictive wins", () => {
  it("a pie inside a beam is a wall; a pie on the tower is a block", () => {
    const pie = sq("a4");
    expect(stopped(layer({ squares: [pie, wall("a4", { kind: "beam", binds: "crowd" })] }), ROOK)).toEqual(["a1a4", "a1a5", "a1a6", "a1a7", "a1a8"]);
    expect(stopped(layer({ squares: [pie, sq("a4", { kind: "block", noLand: false, noPass: true })] }), ROOK)).toEqual(["a1a4", "a1a5", "a1a6", "a1a7", "a1a8"]);
  });

  it("a held piece behind a saw cut stays held; the cut still stops the others", () => {
    const l = layer({ pieces: [piece("a1")], edges: [edge("d1", "e1")] });
    expect(stopped(l, ROOK)).toEqual(["a1a2", "a1a3", "a1a4", "a1a5", "a1a6", "a1a7", "a1a8", "a1b1", "a1c1", "a1d1", "e1d1"]);
    // (The held piece is named first.)
    expect(layerStop(l, ROOK, "a1b1")?.kind).toBe("frozen");
  });

  it("several bosses' marks: a move is allowed only if none stops it; the first boss's mark is named", () => {
    const pies: LayerMarks = { squares: [sq("e4", { by: "boingo" })] };
    const cut: LayerMarks = { edges: [edge("e3", "e4", { by: "sawyer" })] };
    const frozen: LayerMarks = { pieces: [piece("g1", { by: "ginger" })] };
    const all = mergeLayers("w", [pies, cut, frozen]);
    expect(all.squares).toHaveLength(1);
    expect(all.edges).toHaveLength(1);
    expect(all.pieces).toHaveLength(1);
    const each = [pies, cut, frozen].map((p) => new Set(layerMoves(layer(p), START_FEN).moves));
    expect(layerMoves(all, START_FEN).moves).toEqual(legalMoves(START_FEN).filter((m) => each.every((s) => s.has(m))));
    expect(layerStop(all, START_FEN, "e2e4")?.by).toBe("boingo");
    expect(layerStop(mergeLayers("w", [cut, pies]), START_FEN, "e2e4")?.by).toBe("boingo");
    expect(layerStop(mergeLayers("w", [{ squares: [wall("e3", { by: "bigboy" })] }, pies]), START_FEN, "e2e4")?.by).toBe("bigboy");
  });
});

describe("the lift: never without a move", () => {
  it("every legal move stopped: every legal move, lifted", () => {
    const boxed = layer({ squares: ["d1", "d2", "e2", "f2", "f1"].map((s) => wall(s)) });
    expect(layerMoves(boxed, "4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toEqual({ moves: legalMoves("4k3/8/8/8/8/8/8/4K3 w - - 0 1"), lifted: true });
  });

  it("in check: the only way out goes through; nothing illegal is ever let in", () => {
    expect(legalMoves(CHECK)).toEqual(["e1e2"]);
    expect(layerMoves(layer({ pieces: [piece("e1", { kind: "frozen" })] }), CHECK)).toEqual({ moves: ["e1e2"], lifted: true });
    expect(layerMoves(layer({ squares: [sq("e2")] }), CHECK)).toEqual({ moves: ["e1e2"], lifted: true });
    expect(layerMoves(layer({ squares: [sq("d1"), sq("f1")] }), CHECK)).toEqual({ moves: ["e1e2"], lifted: false });
  });

  it("some moves left: those, not lifted; no legal move: none", () => {
    const l = layer({ squares: [sq("e4")] });
    const out = layerMoves(l, START_FEN);
    expect(out.lifted).toBe(false);
    expect(out.moves).toEqual(legalMoves(START_FEN).filter((m) => m !== "e2e4"));
    expect(layerMoves(l, MATE)).toEqual({ moves: [], lifted: false });
  });

  it("takes the legal moves given", () => {
    expect(layerMoves(layer({ squares: [sq("e4")] }), START_FEN, ["e2e4", "d2d4"])).toEqual({ moves: ["d2d4"], lifted: false });
    expect(layerMoves(layer({ squares: [sq("e4")] }), START_FEN, ["e2e4"])).toEqual({ moves: ["e2e4"], lifted: true });
  });
});

describe("promotion", () => {
  it("a pie or a wall on the square stops every promotion onto it; the capture beside goes on", () => {
    for (const mark of [sq("e8"), wall("e8")]) expect(stopped(layer({ squares: [mark] }), PROMO)).toEqual(["e7e8n", "e7e8b", "e7e8r", "e7e8q"]);
    expect(stopped(layer({ edges: [edge("e7", "e8")] }), PROMO)).toEqual(["e7e8n", "e7e8b", "e7e8r", "e7e8q"]);
    expect(stopped(layer({ pieces: [piece("e7")] }), PROMO)).toEqual(["e7e8n", "e7e8b", "e7e8r", "e7e8q", "e7d8n", "e7d8b", "e7d8r", "e7d8q"]);
  });

  it("the pawn's marks go on to the piece it becomes", () => {
    const l = layer({ pieces: [piece("e7", { kind: "splat", held: false })] });
    expect(followLayer(l, "e7e8q", PROMO).pieces.map((m) => m.square)).toEqual(["e8"]);
    expect(followLayer(l, "e7d8n", PROMO).pieces.map((m) => m.square)).toEqual(["d8"]);
  });
});

describe("en passant", () => {
  it("lands on the square behind the pawn, not on the pawn's", () => {
    expect(stopped(layer({ squares: [sq("d6")] }), EP)).toEqual(["e5d6"]);
    expect(stopped(layer({ squares: [sq("d5")] }), EP)).toEqual([]);
    expect(stopped(layer({ squares: [wall("d5")] }), EP)).toEqual([]);
  });

  it("the taken pawn's marks go; the taker's follow it", () => {
    const l = layer({ pieces: [piece("d5", { kind: "gold", held: false, shieldFrom: "pawns", binds: "both" }), piece("e5", { kind: "splat", held: false })] });
    const after = followLayer(l, "e5d6", EP);
    expect(after.pieces.map((m) => [m.kind, m.square])).toEqual([["splat", "d6"]]);
  });
});

describe("followLayer", () => {
  it("piece marks follow their piece; a taken piece's go; square and edge marks stay", () => {
    const l = layer({ squares: [sq("e4")], edges: [edge("e3", "e4")], pieces: [piece("g1"), piece("b8", { binds: "bosses" }), piece("e2", { kind: "splat", held: false })] });
    const after = followLayer(l, "g1f3", START_FEN);
    expect(after.pieces.map((m) => m.square)).toEqual(["f3", "b8", "e2"]);
    expect(after.squares).toBe(l.squares);
    expect(after.edges).toBe(l.edges);
    expect(l.pieces.map((m) => m.square)).toEqual(["g1", "b8", "e2"]);
    // (A capture: the taker's mark goes on, the taken piece's goes.)
    const take = "4k3/8/8/8/p7/8/8/R3K3 w - - 0 1";
    expect(followLayer(layer({ pieces: [piece("a1"), piece("a4", { binds: "bosses" })] }), "a1a4", take).pieces.map((m) => m.square)).toEqual(["a4"]);
  });

  it("castling: the king's and the rook's marks both move (Chess960 too)", () => {
    const l = layer({ pieces: [piece("e1", { kind: "splat", held: false }), piece("h1"), piece("a1", { kind: "lock", held: false })] });
    expect(followLayer(l, "e1g1", CASTLE).pieces.map((m) => m.square)).toEqual(["g1", "f1", "a1"]);
    expect(followLayer(l, "e1c1", CASTLE).pieces.map((m) => m.square)).toEqual(["c1", "h1", "d1"]);
    const c = layer({ pieces: [piece("g1", { kind: "splat", held: false }), piece("h1", { kind: "splat", held: false }), piece("b1", { kind: "splat", held: false })] });
    expect(followLayer(c, "g1h1", C960).pieces.map((m) => m.square)).toEqual(["g1", "f1", "b1"]);
    expect(followLayer(c, "g1b1", C960).pieces.map((m) => m.square)).toEqual(["c1", "h1", "d1"]);
  });

  it("no piece marks: the same layer", () => {
    const l = layer({ squares: [sq("e4")] });
    expect(followLayer(l, "e2e4", START_FEN)).toBe(l);
  });
});

describe("wearLayer", () => {
  it("a mark stands through its last crowd turn (`until`) and wears off after; one without stays", () => {
    const l = layer({
      squares: [sq("e4", { until: 3 }), sq("d4", { until: 4 }), sq("c4")],
      edges: [edge("e3", "e4", { until: 3 }), edge("d3", "d4")],
      pieces: [piece("g1", { until: 3 }), piece("b1", { until: 5 })],
    });
    expect(wearLayer(l, 3)).toEqual(l);
    const at4 = wearLayer(l, 4);
    expect(at4.squares.map((m) => m.square)).toEqual(["d4", "c4"]);
    expect(at4.edges.map((m) => m.a)).toEqual(["d3"]);
    expect(at4.pieces.map((m) => m.square)).toEqual(["b1"]);
    expect(at4.crowd).toBe("w");
  });
});
