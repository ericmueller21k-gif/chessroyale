import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, POWER_IDS, RAID_SETTINGS, isPlayable, mulberry32, type BossPowerState, type BossState, type FolioState, type MatchState, type Settings } from "@chessroyale/core";
import {
  BOSS_OPENING,
  CREASE_LINES,
  FOLIO,
  FOLIO_FRESH,
  FOLIO_FX,
  MatchRunner,
  POWER_FX,
  START_FEN,
  attackStands,
  bossAllowed,
  boardEnd,
  chooseDraft,
  creaseCheck,
  creaseGuard,
  creaseMoves,
  creaseScores,
  crossesCrease,
  crowdAllowed,
  fenAtPly,
  folioBattle,
  folioOf,
  folioTurnMs,
  initPowers,
  legalMoves,
  pickCrease,
  pieceAt,
  playOnBoard,
  powerTurn,
  prepareTurn,
  rageOf,
  ragePaused,
  revisionMeasure,
  sanLineToUci,
  sideToMove,
  stopReason,
  type Battle,
  type BoardState,
  type EngineLike,
  type Opening,
} from "../src/index.ts";

/**
 * Folio, the paper crane (docs/decisions/2026-10-27-folio-rules.md): Draft (an ink mark, two of your moves to answer it,
 * then the piece folded for three turns), Crease (a line nothing crosses for four turns, shown the turn before, the
 * engine's pick in a band) and Revision (once a battle, its own punished blunder and your reply crossed out, the
 * engine's best in their place).
 */

const S = BOSS_POWERS;

// ---------------- A battle for the rules alone ----------------

/**
 * A battle on one board for Folio's hooks alone: `fen` the position (a base at ply 0), the crowd White, `crowdMoves` played
 * so far, and the state's fields. The match runner's own moves (playOnBoard) are played with `crowd` and `his`.
 */
function stub(fen: string, opts: { crowdMoves?: number; powers?: Partial<BossPowerState>; settings?: Partial<Settings>; crowd?: "w" | "b" } = {}) {
  const crowd = opts.crowd ?? "w";
  const board: BoardState = { id: 0, opening: BOSS_OPENING, openingPlies: 0, history: [], fen, expected: 0.5, lastMove: null, generation: 0, evals: [0.5], bases: [{ ply: 0, fen }] };
  const boards = new Map([[0, board]]);
  const crowdMoves = opts.crowdMoves ?? 4;
  const boss = { id: "folio", crowdSide: crowd, crowdMoves, elo: 1500, tier: 1500, sinceKill: 0, kills: [], powers: { ...initPowers(1, fen, crowd), turn: crowdMoves + 1, nextPassive: 99, folio: FOLIO_FRESH, ...opts.powers } } as unknown as BossState;
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossMaxMoves: 60, bossPowerTest: "", ...opts.settings } as Settings;
  const b: Battle & { state: MatchState } = {
    state: { boards: [0], boss } as unknown as MatchState,
    boards,
    settings,
    bossLast: null,
    engines: [],
    alive: () => [],
    finalGameOver: () => boardEnd(boards.get(0)!) !== null,
    bossToMove: () => sideToMove(boards.get(0)!.fen) !== crowd,
    crowdAllowed: () => null,
    boardOf: () => null,
    afterCrowdMove: () => undefined,
    bossPassed: () => undefined,
    memo: new Map(),
    now: () => 0,
    random: () => 0.5,
  };
  return b;
}
const fenOf = (b: Battle) => b.boards.get(0)!.fen;
const bossOf = (b: Battle) => b.state.boss!;
const folio = (b: Battle): FolioState => folioOf(b.state.boss!.powers);
/** The crowd's move on a stub: played, counted, then Folio's after-move rules with the judge's numbers. */
function crowd(b: Battle, move: string, judged: { best: number; played: number; king?: boolean } | null = null) {
  const board = b.boards.get(0)!;
  b.boards.set(0, playOnBoard(board, move, judged?.played ?? 0.5));
  const boss = bossOf(b);
  b.state = { ...b.state, boss: { ...boss, crowdMoves: boss.crowdMoves + 1, powers: { ...boss.powers!, ...(judged ? { judged: judged.played } : {}) } } };
  FOLIO.afterCrowdMove!(b, move, judged);
}
/** Folio's move on a stub, then its after-move rules (`crease`: the line that came with it), then the crowd's turn set up. */
function his(b: Battle, move: string, crease: string | null = null, test = "") {
  const board = b.boards.get(0)!;
  b.boards.set(0, playOnBoard(board, move, 0.5));
  FOLIO.afterBossMove!(b, move, { crease });
  begin(b, test);
}
function begin(b: Battle, test = "") {
  b.state = { ...b.state, boss: prepareTurn(bossOf(b), fenOf(b), test) };
}

// A position (the crowd White to move) with Folio's pieces on the crowd's: its queen on a8 down the a-file at your rook
// (defended by your queen), its bishop on f6 at your knight on c3 (defended by b2), its knight on c4 at your bishop on e3
// (defended by f2), its queen at your g2 pawn too (defended by your king), and its rook d8 at your queen (a cheaper piece:
// it would just take it) and its knight at your b2 pawn (undefended: simply hanging).
const SPREAD = "q2r2k1/5ppp/5b2/8/2n5/2N1B2P/1P3PP1/R2Q1RK1 w - - 0 20";

describe("Folio: who it is", () => {
  it("is on the roster as folio (📜), Draft and Crease, its kit to come: not playable until the wiring lane", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "folio")!;
    expect(def).toMatchObject({ name: "Folio", icon: "📜", kit: null, offset: 150, powers: { passive: "draft", ultimate: "crease" } });
    expect(isPlayable(def)).toBe(false);
    for (const id of ["draft", "crease", "revision"] as const) expect(POWER_IDS).toContain(id);
  });

  it("its numbers are the sheet's, with the director's calls of Oct 27 (a fold of 4 turns, the crease's band 1 to 2.5, rageSpeed 1.3)", () => {
    expect([S.draftFirst, S.draftWindow, S.foldTurns]).toEqual([3, 2, 4]);
    expect([S.creaseTurns, S.creaseLossMin, S.creaseLossMax]).toEqual([4, 1, 2.5]);
    expect([S.revisionDrop, S.revisionMax, S.revisionFrom]).toEqual([1.5, 1, 5]);
    expect(S.rageSpeed.folio).toBe(1.3);
    expect(CREASE_LINES).toHaveLength(14);
  });

  it("its moments have their lengths; a fold and Revision play while it thinks (its move waits for them)", () => {
    for (const k of Object.keys(FOLIO_FX) as (keyof typeof FOLIO_FX)[]) expect(POWER_FX[k]).toBe(FOLIO_FX[k]);
    const boss = (kinds: string[]) => ({ powers: { events: kinds.map((kind) => ({ kind })) } });
    expect(folioTurnMs(boss(["draft"]))).toBe(0);
    expect(folioTurnMs(boss(["fold"]))).toBeGreaterThanOrEqual(FOLIO_FX.fold);
    expect(folioTurnMs(boss(["revision"]))).toBeGreaterThanOrEqual(FOLIO_FX.revision);
  });
});

describe("Folio's Draft: which piece", () => {
  it("a piece of yours its pieces attack and you defend, none of its attackers cheaper: the most valuable, seeded only among ties", () => {
    // (Your rook on a1 is worth most; then your knight c3 and bishop e3, a tie; the g2 pawn last; your queen is attacked by a
    // cheaper rook, the b2 pawn is undefended.)
    for (let seed = 0; seed < 40; seed++) expect(chooseDraft(SPREAD, "w", seed, 3)).toEqual({ square: "a1", piece: "r", attacker: "a8", by: "q", line: ["a7", "a6", "a5", "a4", "a3", "a2"] });
    // Without the rook (folded, skipped): the knight and the bishop tie, a seeded pick between them; never the pawn.
    const tie = Array.from({ length: 60 }, (_, s) => chooseDraft(SPREAD, "w", s, 3, "a1")!);
    for (let s = 0; s < 60; s++) expect(chooseDraft(SPREAD, "w", s, 3, "a1")).toEqual(tie[s]);
    expect([...new Set(tie.map((p) => p.square))].sort()).toEqual(["c3", "e3"]);
    expect(tie.find((p) => p.square === "c3")).toEqual({ square: "c3", piece: "n", attacker: "f6", by: "b", line: ["e5", "d4"] });
    expect(tie.find((p) => p.square === "e3")).toEqual({ square: "e3", piece: "b", attacker: "c4", by: "n", line: [] });
  });

  it("never a piece simply hanging, one a cheaper piece of its attacks, your king, or the piece folded now", () => {
    // Without b2, your knight on c3 is undefended: not marked (the rook skipped, only the bishop is left at that value).
    const hanging = SPREAD.replace("1P3PP1", "5PP1");
    for (let s = 0; s < 30; s++) expect(chooseDraft(hanging, "w", s, 3, "a1")!.square).toBe("e3");
    // A black pawn on b4 attacks the knight too (cheaper than it): not marked.
    const cheaper = SPREAD.replace("/8/2n5/", "/8/1pn5/");
    for (let s = 0; s < 30; s++) expect(chooseDraft(cheaper, "w", s, 3, "a1")!.square).toBe("e3");
    // A king attacked is check, never a mark; nothing attacked at the start: none.
    expect(chooseDraft(START_FEN, "w", 1, 3)).toBeNull();
  });

  it("comes from turn 3, every draftEvery turns; none that qualifies: no Draft, tried again next turn, and the try doesn't count", () => {
    const b = stub(START_FEN, { crowdMoves: 0, powers: { nextPassive: S.draftFirst } });
    begin(b);
    // Turns 1 and 2 at the start: nothing attacked, nothing to do; turn 3: none qualifies, so turn 4, and so on.
    for (const t of [2, 3]) {
      b.state = { ...b.state, boss: { ...bossOf(b), crowdMoves: t - 1 } };
      begin(b);
    }
    expect(bossOf(b).powers!.nextPassive).toBe(4);
    expect(folio(b).drafts).toBe(0);
    // Now a position with marks to make: turn 4 marks, the next comes draftEvery turns on.
    b.boards.set(0, { ...b.boards.get(0)!, fen: SPREAD, bases: [{ ply: 0, fen: SPREAD }] });
    b.state = { ...b.state, boss: { ...bossOf(b), crowdMoves: 3 } };
    begin(b);
    const p = bossOf(b).powers!;
    expect(folio(b).drafts).toBe(1);
    expect(folio(b).mark).toMatchObject({ at: 4, until: 4 + S.draftWindow - 1 });
    expect(p.events).toEqual([{ kind: "draft", turn: 4, square: folio(b).mark!.square, squares: [folio(b).mark!.attacker, ...folio(b).mark!.line, folio(b).mark!.square] }]);
    expect(p.nextPassive).toBe(4 + S.draftEvery);
  });

  it("one mark at a time: due with one still up, it waits a turn; ?power=draft: from turn 2, again every turn", () => {
    const b = stub(SPREAD, { crowdMoves: 1, powers: { turn: 1, nextPassive: 2, folio: { ...FOLIO_FRESH, mark: { square: "a1", piece: "r", attacker: "a8", by: "q", line: [], at: 1, until: 2 } } } });
    begin(b);
    expect(bossOf(b).powers!.events).toEqual([]);
    expect(bossOf(b).powers!.nextPassive).toBe(3);
    // The test switch: from turn 2 (the battle's start), then every turn once the mark's gone.
    const t = stub(SPREAD, { crowdMoves: 1, powers: { turn: 1, nextPassive: 2 } });
    begin(t, "draft");
    expect(folio(t).mark).not.toBeNull();
    expect(bossOf(t).powers!.nextPassive).toBe(3);
    const r = new MatchRunner({ settings: { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "folio", bossUnfinished: true, bossPowerTest: "draft" } as Settings, rng: mulberry32(3), engines: [], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    expect(r.boss!.powers!.nextPassive).toBe(2);
  });
});

describe("Folio's Draft: two of your moves to answer it, then the fold", () => {
  /** SPREAD with the mark on your rook (a1, Folio's queen on a8) set as turn 5 began. */
  const marked = () => {
    const b = stub(SPREAD, { crowdMoves: 4, powers: { folio: { ...FOLIO_FRESH, drafts: 1, mark: { square: "a1", piece: "r", attacker: "a8", by: "q", line: ["a7", "a6", "a5", "a4", "a3", "a2"], at: 5, until: 6 } } } });
    return b;
  };

  it("left standing after your second move, the piece is folded for foldTurns turns (its moment at the start of its turn)", () => {
    const b = marked();
    crowd(b, "h3h4");
    expect(folio(b).mark).not.toBeNull();
    his(b, "h7h6");
    expect(bossOf(b).powers!.events).toEqual([]);
    crowd(b, "g2g3");
    expect(folio(b).mark).toBeNull();
    expect(folio(b).folded).toEqual({ square: "a1", piece: "r", at: 7, until: 6 + S.foldTurns });
    expect(folio(b).folds).toBe(1);
    expect(bossOf(b).powers!.events.at(-1)).toEqual({ kind: "fold", turn: 6, square: "a1" });
    // Folded on your next foldTurns turns: the rook's moves aren't allowed, the turn doesn't count for fair play; then free.
    his(b, "h6h5");
    for (let t = 7; t <= 6 + S.foldTurns; t++) {
      expect(bossOf(b).powers!.turn).toBe(t);
      const allowed = crowdAllowed(bossOf(b), fenOf(b))!;
      expect(allowed.some((m) => m.startsWith("a1"))).toBe(false);
      expect(powerTurn(bossOf(b))).toBe(true);
      crowd(b, ["g1h2", "h2g1", "g1h2", "h2g1"][t - 7]!);
      his(b, ["g8h8", "h8g8", "g8h8", "h8g8"][t - 7]!);
    }
    expect(folio(b).folded).toBeNull();
    expect((crowdAllowed(bossOf(b), fenOf(b)) ?? legalMoves(fenOf(b))).some((m) => m.startsWith("a1"))).toBe(true);
  });

  it("every way of answering it in time clears it: move the piece, block the line, take the attacker, or anything that ends that attack", () => {
    // Move the piece.
    let b = marked();
    crowd(b, "a1b1");
    expect(folio(b)).toMatchObject({ mark: null, answered: 1, folded: null });
    // Block the line (your knight to a4).
    b = marked();
    crowd(b, "c3a4");
    expect(folio(b)).toMatchObject({ mark: null, answered: 1 });
    // Take the attacker: your queen on the a8 queen's file can't, so a position where it can (its queen on a4 instead).
    const near = SPREAD.replace("q2r2k1", "3r2k1").replace("2n5", "q1n5");
    b = stub(near, { crowdMoves: 4, powers: { folio: { ...FOLIO_FRESH, mark: { square: "a1", piece: "r", attacker: "a4", by: "q", line: ["a3", "a2"], at: 5, until: 6 } } } });
    expect(attackStands(near, folio(b).mark!, "w")).toBe(true);
    crowd(b, "c3a4");
    expect(folio(b)).toMatchObject({ mark: null, answered: 1 });
    // On the second move too: a quiet first, then the answer.
    b = marked();
    crowd(b, "h3h4");
    his(b, "h7h6");
    crowd(b, "a1a2");
    expect(folio(b)).toMatchObject({ mark: null, answered: 1, folded: null, folds: 0 });
  });

  it("clears as soon as its attacker moves away or is gone, and never obliges it to stay (its brain plays as usual)", () => {
    const b = marked();
    crowd(b, "h3h4");
    his(b, "a8b8");
    expect(folio(b)).toMatchObject({ mark: null, answered: 0 });
    // A fold whose piece it then takes is gone.
    const c = stub(SPREAD, { crowdMoves: 6, powers: { folio: { ...FOLIO_FRESH, folded: { square: "a1", piece: "r", at: 7, until: 9 } } } });
    crowd(c, "h3h4");
    his(c, "a8a1");
    expect(folio(c).folded).toBeNull();
  });

  it("a fold that would leave you no legal move (or no way out of check) lifts for that turn; never the king", () => {
    // Your king boxed in by its king, your knight the only piece that can move: folded, and lifted.
    const fen = "8/8/8/8/8/p7/P1k5/K6N w - - 0 50";
    const b = stub(fen, { crowdMoves: 6, powers: { turn: 7, folio: { ...FOLIO_FRESH, folded: { square: "h1", piece: "n", at: 7, until: 9 } } } });
    expect(legalMoves(fen).every((m) => m.startsWith("h1"))).toBe(true);
    expect(crowdAllowed(bossOf(b), fen)).toBeNull();
    // (A king is never marked, so never folded: chooseDraft skips it, above.)
  });

  it("one mark at a time; a fold in place doesn't block the next mark (on another piece)", () => {
    const b = stub(SPREAD, { crowdMoves: 7, powers: { turn: 7, nextPassive: 8, folio: { ...FOLIO_FRESH, folded: { square: "a1", piece: "r", at: 7, until: 9 } } } });
    begin(b);
    expect(folio(b).mark).not.toBeNull();
    expect(folio(b).mark!.square).not.toBe("a1");
  });
});

describe("Folio's Crease: the line", () => {
  it("a move crosses it whenever a piece it moves ends on the other side: knights too, castling's king and its rook; never an attack", () => {
    expect(crossesCrease("e2e4", "d|e")).toBe(false);
    expect(crossesCrease("d4e5", "d|e")).toBe(true);
    expect(crossesCrease("d2f3", "d|e")).toBe(true);
    expect(crossesCrease("e2e4", "4|5")).toBe(false);
    expect(crossesCrease("e4e5", "4|5")).toBe(true);
    expect(crossesCrease("g1f3", "4|5")).toBe(false);
    expect(crossesCrease("b8a6", "6|7")).toBe(true);
    // Castling short: the king crosses f|g; on g|h only its rook does (h1 to f1).
    const castle = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    expect(crossesCrease("e1g1", "f|g", castle)).toBe(true);
    expect(crossesCrease("e1g1", "g|h", castle)).toBe(true);
    expect(crossesCrease("e1g1", "g|h")).toBe(false);
    expect(crossesCrease("e1c1", "a|b", castle)).toBe(true);
    expect(crossesCrease("e1c1", "1|2", castle)).toBe(false);
    expect(creaseMoves(castle, "g|h")).not.toContain("e1g1");
  });

  it("the guard: never a line leaving you no move, or handing either side a mate in one", () => {
    // Your king's only move crosses a|b.
    const boxed = "8/8/8/8/8/p1k5/P7/K7 w - - 0 50";
    expect(legalMoves(boxed)).toEqual(["a1b1"]);
    expect(creaseGuard(boxed, "a|b")).toBe(false);
    expect(creaseGuard(boxed, "4|5")).toBe(true);
    // Your back-rank mate (Ra8#): a line between files leaves it, so it never counts; one between ranks stops it.
    const mate = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 30";
    expect(creaseGuard(mate, "d|e")).toBe(false);
    expect(creaseGuard(mate, "4|5")).toBe(true);
    // Its own mate in one, were you to pass, counts too: its pieces cross the crease, so no line stops it, and none counts.
    const his = "r5k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 30";
    for (const l of CREASE_LINES) expect(creaseGuard(his, l), l).toBe(false);
    expect(creaseCheck(mate, "4|5")).toBe("4|5");
    expect(creaseCheck(mate, "d|e")).toBeNull();
    expect(creaseCheck(mate, "z|q")).toBeNull();
  });

  it("the engine's pick: the cost nearest the band's middle; ties seeded; none in the band: nearest its bottom below it, never above its top", () => {
    const s = { creaseLossMin: 0.3, creaseLossMax: 1.5 };
    const scores = [
      { line: "a|b", loss: 0 },
      { line: "b|c", loss: 0.4 },
      { line: "c|d", loss: 0.88 },
      { line: "d|e", loss: 0.95 },
      { line: "e|f", loss: 2.3 },
    ];
    for (let o = 0; o < 20; o++) expect(pickCrease(scores, o, s)!.line).toBe("c|d");
    const ties = [
      { line: "a|b", loss: 0.9 },
      { line: "1|2", loss: 0.9 },
      { line: "e|f", loss: 0.1 },
    ];
    const got = new Set(Array.from({ length: 40 }, (_, o) => pickCrease(ties, o * 7919, s)!.line));
    expect([...got].sort()).toEqual(["1|2", "a|b"]);
    expect(pickCrease(ties, 5, s)).toEqual(pickCrease(ties, 5, s));
    // None in the band: the one nearest its bottom from below (0.2), never the one over the top (1.9).
    expect(pickCrease([{ line: "a|b", loss: -0.4 }, { line: "b|c", loss: 0.2 }, { line: "c|d", loss: 1.9 }], 1, s)!.line).toBe("b|c");
    expect(pickCrease([{ line: "c|d", loss: 1.9 }], 1, s)).toBeNull();
  });

  it("each line's cost: the crowd's best with its crossings taken away against its best, judged with the crowd to move; one search per set of moves taken", async () => {
    // A stand-in engine: a move's worth from the rank it lands on (the double steps best), searchmoves kept.
    const worth = (m: string) => 0.2 + 0.05 * Number(m[3]) + 0.001 * (m.charCodeAt(2) - 97);
    let searches = 0;
    const engine: EngineLike = {
      topMoves: async (fen, n) => legalMoves(fen).map((move) => ({ move, expected: worth(move) })).sort((a, b) => b.expected - a.expected).slice(0, n),
      scoreMoves: async (_fen, moves) => moves.map((move) => ({ move, expected: worth(move) })),
      topMovesAt: async (fen, n, _nodes, only) => {
        searches++;
        return (only ?? legalMoves(fen)).map((move) => ({ move, expected: worth(move) })).sort((a, b) => b.expected - a.expected).slice(0, n);
      },
    };
    const scores = (await creaseScores([engine], START_FEN))!;
    const loss = (l: string) => scores.find((x) => x.line === l)?.loss;
    // 2|3 leaves you no move at the start (every pawn and knight crosses it): never counts. (6|7 would stop every move of
    // its, but its moves are never stopped: it counts.)
    expect(loss("2|3")).toBeUndefined();
    expect(loss("6|7")).toBe(0);
    expect(scores).toHaveLength(13);
    expect(searches).toBeLessThanOrEqual(15);
    // 3|4 takes away the double steps (your best): it costs; 1|2 takes the knights' moves only, and nothing crosses 5|6: free.
    expect(loss("3|4")).toBeGreaterThan(0);
    expect(loss("3|4")).toBeCloseTo((Math.log(0.407 / 0.593) - Math.log(0.357 / 0.643)) / S.bouncePawnLogit, 6);
    expect(loss("1|2")).toBe(0);
    expect(loss("5|6")).toBe(0);
  });
});

describe("Folio's Crease: through a battle", () => {
  it("?power=crease: its line shown with the warning as turn 2 begins, then four turns none of your moves crosses it while its own may; then it unfolds", async () => {
    const r = raid({ test: "crease" });
    const kinds = new Map<number, string[]>();
    let line = "";
    for (let i = 0; i < 9 && !r.stageComplete(); i++) {
      const p = r.boss!.powers!;
      kinds.set(p.turn, p.events.map((e) => e.kind));
      if (p.turn === 2) {
        line = p.events.find((e) => e.kind === "creaseWarn")!.line!;
        expect(CREASE_LINES).toContain(line);
        expect(r.bossView()!.powers!.creaseNext).toBe(line);
      }
      const held = p.crease && p.crease.until >= p.turn ? p.crease : null;
      if (held) {
        expect(held.line).toBe(line);
        for (const m of r.crowdAllowed() ?? []) expect(crossesCrease(m, line, fenOfR(r))).toBe(false);
        expect(rageOf(r.boss)).toBe(p.turn === held.at ? 1 : 0);
        if (p.turn > held.at) expect(ragePaused(r.boss)).toBe(true);
      }
      r.deal();
      const allowed = [...(r.crowdAllowed() ?? legalMoves(fenOfR(r)))].sort();
      await r.score(new Map([["h0", { move: allowed[0]!, thinkMs: 1000 }]]));
      if (r.stageComplete() || !r.bossToMove()) continue;
      // Its own moves are never stopped by it (it folds the board toward itself).
      if (held) expect(r.bossAllowed()).toBeNull();
      await r.playBoss();
    }
    expect(kinds.get(2)).toEqual(["warn", "creaseWarn"]);
    expect(kinds.get(3)).toEqual(["crease"]);
    expect(kinds.get(3 + S.creaseTurns)).toContain("creaseEnd");
    expect(r.boss!.powers!.crease ?? null).toBeNull();
  });

  it("a refused move of yours across it says why; your only move across it lifts it for that turn; its own moves cross it freely", () => {
    const fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 30";
    const boss = { id: "folio", crowdSide: "w", crowdMoves: 4, powers: { ...initPowers(1, fen, "w"), turn: 5, crease: { line: "4|5", at: 5, until: 8, side: "w" }, folio: FOLIO_FRESH } } as unknown as BossState;
    expect(stopReason(boss, fen, "a1a8")).toBe("crease");
    expect(crowdAllowed(boss, fen)).not.toContain("a1a8");
    expect(powerTurn(boss)).toBe(true);
    // Your king's only move crosses a|b: the crease lifts for your turn (never no move, never no way out of check).
    const boxed = "8/8/8/8/8/p1k5/P7/K7 w - - 0 50";
    const lifted = { ...boss, powers: { ...boss.powers, crease: { line: "a|b", at: 5, until: 8, side: "w" } } } as unknown as BossState;
    expect(legalMoves(boxed)).toEqual(["a1b1"]);
    expect(crowdAllowed(lifted, boxed)).toBeNull();
    // Its moves across it (Black's, here across d|e): never stopped, never named as stopped.
    const open = "r3k2r/pppq1ppp/2n2n2/3pp3/3PP3/2N2N2/PPPQ1PPP/R3K2R b KQkq - 0 1";
    const his = { ...boss, powers: { ...boss.powers, crease: { line: "d|e", at: 5, until: 8, side: "w" } } } as unknown as BossState;
    expect(legalMoves(open).some((m) => crossesCrease(m, "d|e", open))).toBe(true);
    expect(bossAllowed(his, open)).toBeNull();
    expect(stopReason(his, open, "d7g4")).toBeNull();
  });

  it("the trigger: the line picked with his next move, then it lands without the warning; the meter held empty while it holds", async () => {
    const r = raid({});
    await turn(r);
    expect(r.triggerUltimate()).toBe(true);
    await turn(r);
    const p = r.boss!.powers!;
    expect(p.events.map((e) => e.kind)).toEqual(["crease"]);
    expect(p.warnAt).toBeUndefined();
    expect(p.crease).toMatchObject({ at: p.turn, until: p.turn + S.creaseTurns - 1, side: r.boss!.crowdSide });
    expect(r.triggerUltimate()).toBe(false);
  });
});

describe("Folio's Revision: when", () => {
  it("both conditions: its move cost it revisionDrop or more, and your reply found it", () => {
    // Before its move, your judged score 0.5. Your best reply 0.85 and you found it: it comes.
    expect(revisionMeasure(0.5, { best: 0.85, played: 0.85 }).due).toBe(true);
    // It blundered (your best 0.9), but your reply didn't find it (0.5): no.
    const missed = revisionMeasure(0.5, { best: 0.9, played: 0.5 });
    expect(missed.cost).toBeGreaterThanOrEqual(S.revisionDrop);
    expect(missed.drop).toBeLessThan(S.revisionDrop);
    expect(missed.due).toBe(false);
    // A small slip (0.75 at best): no.
    expect(revisionMeasure(0.5, { best: 0.75, played: 0.75 }).due).toBe(false);
  });

  /** A battle where its last move (g8h8) let your rook in, and your reply (a1a8) is punishment, but not mate: the h-pawn has a square. */
  const punished = (opts: { crowdMoves?: number; base?: string; mine?: string; theirs?: string; test?: string; staggered?: boolean } = {}) => {
    const base = opts.base ?? "6k1/5pp1/7p/8/8/8/5PPP/R5K1 b - - 0 30";
    const b = stub(base, { crowdMoves: (opts.crowdMoves ?? 5) - 1, powers: { judged: 0.5 }, settings: { bossPowerTest: opts.test ?? "" } });
    b.bossLast = { move: opts.mine ?? "g8h7", san: "", ...(opts.staggered ? { staggered: true } : {}) };
    his(b, opts.mine ?? "g8h7");
    return b;
  };

  it("comes on the punishing reply: both moves crossed out, the board back to before its move (a base: the history keeps both)", () => {
    const b = punished();
    const before = fenOf(b);
    crowd(b, "a1a8", { best: 0.9, played: 0.9 });
    const board = b.boards.get(0)!;
    expect(board.history).toEqual(["g8h7", "a1a8"]);
    expect(board.fen).toBe("6k1/5pp1/7p/8/8/8/5PPP/R5K1 b - - 0 30");
    expect(fenAtPly(board.history, 2, board.bases)).toBe(board.fen);
    expect(board.bases!.at(-1)).toEqual({ ply: 2, fen: board.fen });
    expect(before).not.toBe(board.fen);
    const r = folio(b).revision!;
    expect(r).toMatchObject({ at: 5, moves: ["g8h7", "a1a8"], sans: ["Kh7", "Ra8"], ply: 2 });
    expect(r.cost).toBeGreaterThanOrEqual(S.revisionDrop);
    expect(bossOf(b).powers!.events.at(-1)).toEqual({ kind: "revision", turn: 5, moves: ["g8h7", "a1a8"] });
    // Its move now is the engine's best; your crossed-out turn doesn't count for fair play.
    expect(FOLIO.bestReply!(bossOf(b), b.boards.get(0)!)).toBe(true);
    expect(FOLIO.crossedOut!(bossOf(b))).toBe(true);
    // The judged score is back where it was.
    expect(bossOf(b).powers!.judged).toBe(0.5);
    // Its new move, then your turn: named, and done.
    his(b, legalMoves(fenOf(b)).sort()[0]!);
    expect(folio(b).revision!.move).toBeTruthy();
    expect(FOLIO.bestReply!(bossOf(b), b.boards.get(0)!)).toBe(false);
    expect(FOLIO.crossedOut!(bossOf(b))).toBe(false);
  });

  it("never before turn revisionFrom, more than revisionMax a battle, after the God King's move, or on a move his strike staggered", () => {
    const go = (b: Battle, king = false) => {
      crowd(b, "a1a8", { best: 0.9, played: 0.9, ...(king ? { king: true } : {}) });
      return folio(b).revision;
    };
    expect(go(punished({ crowdMoves: 4 }))).toBeNull();
    expect(go(punished({ crowdMoves: 5 }))).not.toBeNull();
    expect(go(punished(), true)).toBeNull();
    expect(go(punished({ staggered: true }))).toBeNull();
    const once = punished();
    once.state = { ...once.state, boss: { ...bossOf(once), powers: { ...bossOf(once).powers!, folio: { ...folio(once), revisions: 1 } } } };
    expect(go(once)).toBeNull();
  });

  it("never after a move that ends the battle: a mate (or a draw on the board), or the move cap", () => {
    // Its king to h8 lets your rook mate: no Revision of a mate.
    const mate = punished({ base: "6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 30", mine: "g8h8" });
    crowd(mate, "a1a8", { best: 0.99, played: 0.99 });
    expect(boardEnd(mate.boards.get(0)!)).toBe("checkmate");
    expect(folio(mate).revision).toBeNull();
    const cap = punished({ crowdMoves: 60 });
    crowd(cap, "a1a8", { best: 0.9, played: 0.9 });
    expect(folio(cap).revision).toBeNull();
  });

  it("?power=revision: at the first crowd move it may follow, whatever the numbers", () => {
    const b = punished({ test: "revision" });
    crowd(b, "a1a2", { best: 0.5, played: 0.5 });
    expect(folio(b).revision).toMatchObject({ at: 5, moves: ["g8h7", "a1a2"], cost: null, drop: null });
  });

  it("a mark, a fold and the crease don't count the crossed-out turn: each lasts one turn more; a mark whose attack the rewind ends goes", () => {
    const b = punished();
    b.state = {
      ...b.state,
      boss: {
        ...bossOf(b),
        powers: {
          ...bossOf(b).powers!,
          crease: { line: "c|d", at: 4, until: 6, side: "w" },
          folio: { ...folio(b), folded: { square: "f2", piece: "p", at: 4, until: 6 }, mark: { square: "h2", piece: "p", attacker: "h7", by: "k", line: [], at: 5, until: 6 } },
        },
      },
    };
    crowd(b, "a1a8", { best: 0.9, played: 0.9 });
    const p = bossOf(b).powers!;
    expect(p.crease!.until).toBe(7);
    expect(folio(b).folded!.until).toBe(7);
    // (Its king on h7 isn't there once the board goes back: the mark's attack has ended.)
    expect(folio(b).mark).toBeNull();
  });
});

// ---------------- The match runner ----------------

const RUY = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { [moves.length]: 0.52 } });
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
/** A stand-in engine (searchmoves kept); `punish`: while it's set, in the crowd's positions its move is worth that, any other 0.5. */
function engine(state: { punish: { move: string; worth: number } | null } = { punish: null }): EngineLike {
  const score = (fen: string, m: string) => (state.punish && sideToMove(fen) === "w" ? (m === state.punish.move ? state.punish.worth : 0.5) : 0.4 + 0.2 * hash(fen + m));
  const ranked = (fen: string, only?: readonly string[]) => (only ?? legalMoves(fen)).map((move) => ({ move, expected: score(fen, move) })).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
  return {
    topMoves: async (fen, n) => ranked(fen).slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    topMovesAt: async (fen, n, _nodes, only) => ranked(fen, only).slice(0, n),
    playAtElo: async (fen) => legalMoves(fen).sort()[0]!,
  };
}
function raid(opts: { test?: string; seed?: number; eng?: EngineLike } = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, raidOpening: true, bossFixedElo: 2000, bossId: "folio", bossUnfinished: true, bossPowerTest: opts.test ?? "", lastStandLoss: 999, lastStandLossFloor: 999 } as Settings;
  return new MatchRunner({ settings, rng: mulberry32(opts.seed ?? 5), engines: [opts.eng ?? engine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
}
const fenOfR = (r: MatchRunner) => r.boards.get(0)!.fen;
/** One crowd turn: your move (or the first allowed), then its reply. Returns the round's report. */
async function turn(r: MatchRunner, move?: string) {
  r.deal();
  const allowed = r.crowdAllowed() ?? legalMoves(fenOfR(r));
  const report = await r.score(new Map([["h0", { move: move ?? [...allowed].sort()[0]!, thinkMs: 1000 }]]));
  if (!r.isOver() && !r.stageComplete() && r.bossToMove()) await r.playBoss();
  return report;
}

describe("Folio's Revision: through the match runner", () => {
  it("?power=revision: after your fifth move, crossed out with its own; its move the engine's best; fair play skips the turn; once", async () => {
    const r = raid({ test: "revision" });
    for (let i = 0; i < 4; i++) await turn(r);
    expect(folioOf(r.boss!.powers).revision).toBeNull();
    const plies = r.boards.get(0)!.history.length;
    const back = fenAtPly(r.boards.get(0)!.history, plies - 1, r.boards.get(0)!.bases);
    r.deal();
    const report = await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOfR(r)))].sort()[0]!, thinkMs: 1000 }]]));
    const rev = folioOf(r.boss!.powers).revision!;
    expect(rev).toMatchObject({ at: 5 });
    expect(fenOfR(r)).toBe(back);
    expect(report.boards[0]!.power).toBe(true);
    expect(r.bossToMove()).toBe(true);
    expect(r.bossMoveKind()).toBe("best");
    expect(r.bossView()!.powers!.revision).toMatchObject({ at: 5, move: null });
    expect(r.bossView()!.powers!.events.map((e) => e.kind)).toContain("revision");
    await r.playBoss();
    expect(folioOf(r.boss!.powers).revision!.move).toBe(r.boards.get(0)!.history.at(-1));
    expect(r.boss!.crowdMoves).toBe(5);
    for (let i = 0; i < 6; i++) await turn(r);
    expect(folioOf(r.boss!.powers).revisions).toBe(1);
  });

  it("by the numbers: your reply that finds its blunder brings it; another reply doesn't", async () => {
    for (const find of [true, false]) {
      const st = { punish: null as { move: string; worth: number } | null };
      const r = raid({ eng: engine(st) });
      for (let i = 0; i < 5; i++) await turn(r);
      r.deal();
      const allowed = [...(r.crowdAllowed() ?? legalMoves(fenOfR(r)))].sort();
      st.punish = { move: allowed[0]!, worth: 0.92 };
      await r.score(new Map([["h0", { move: find ? allowed[0]! : allowed[1]!, thinkMs: 1000 }]]));
      expect(!!folioOf(r.boss!.powers).revision, `found: ${find}`).toBe(find);
    }
  });
});

describe("Folio: a small fuzz (seeded battles with every switch)", () => {
  it("its limits always hold, the replay always matches, a mark always sits on an attacked, defended piece, and at most one Revision", async () => {
    const seen = { folds: 0, answered: 0, creases: 0 };
    for (const [seed, test] of [
      [11, "draft"],
      [12, "crease"],
      [13, "revision"],
      [14, ""],
      [15, "draft"],
      [16, "crease"],
    ] as const) {
      const r = raid({ test, seed, eng: engine() });
      const rng = mulberry32(seed);
      for (let i = 0; i < 40 && !r.stageComplete(); i++) {
        const p = r.boss!.powers!;
        const f = folioOf(p);
        const fen = fenOfR(r);
        const board = r.boards.get(0)!;
        expect(fenAtPly(board.history, board.history.length, board.bases), `${seed}: replay`).toBe(fen);
        if (sideToMove(fen) === "w") {
          const legal = legalMoves(fen);
          const allowed = r.crowdAllowed();
          const folded = f.folded && f.folded.at <= p.turn && f.folded.until >= p.turn ? f.folded.square : null;
          if (allowed) {
            expect(allowed.length).toBeGreaterThan(0);
            for (const m of allowed) {
              expect(m.slice(0, 2), `${seed}: folded ${folded}`).not.toBe(folded);
              expect(crossesCrease(m, p.crease?.line, fen)).toBe(false);
            }
          } else if (folded || p.crease) {
            // (Nothing to stop, or lifted: every legal move would have been stopped.)
            const stopped = legal.filter((m) => m.slice(0, 2) === folded || crossesCrease(m, p.crease?.line, fen)).length;
            expect(stopped === 0 || stopped === legal.length, `${seed}: ${stopped} of ${legal.length} stopped`).toBe(true);
          }
          if (p.events.some((e) => e.kind === "draft")) {
            expect(f.mark).not.toBeNull();
            expect(pieceAt(fen, f.mark!.square)?.color).toBe("w");
            expect(attackStands(fen, f.mark!, "w")).toBe(true);
          }
          // (Never two of its moments at the turn's start but the warning's pair.)
          const kinds = p.events.map((e) => e.kind).filter((k) => k !== "warn");
          expect(kinds.length, `${seed}: ${kinds.join(",")}`).toBeLessThanOrEqual(1);
        }
        r.deal();
        const allowed = [...(r.crowdAllowed() ?? legalMoves(fen))].sort();
        await r.score(new Map([["h0", { move: allowed[Math.floor(rng() * allowed.length)]!, thinkMs: 1000 }]]));
        if (!r.stageComplete() && r.bossToMove()) {
          const pre = fenOfR(r);
          const allowedHis = r.bossAllowed();
          await r.playBoss();
          const m = r.boards.get(0)!.history.at(-1)!;
          expect((allowedHis ?? legalMoves(pre)).includes(m), `${seed}: his move ${m}`).toBe(true);
        }
        if (r.bossKillDue()) r.bossKill();
      }
      expect(folioOf(r.boss!.powers).revisions).toBeLessThanOrEqual(S.revisionMax);
      if (test === "revision") expect(folioOf(r.boss!.powers).revisions).toBe(1);
      if (test === "crease") expect(r.boss!.powers!.ults ?? 0).toBeGreaterThan(0);
      if (test === "draft") expect(folioOf(r.boss!.powers).drafts).toBeGreaterThan(0);
      seen.folds += folioOf(r.boss!.powers).folds;
      seen.answered += folioOf(r.boss!.powers).answered;
      seen.creases += r.boss!.powers!.ults ?? 0;
    }
    // (Each of its powers at work somewhere in the fuzz.)
    expect(seen.folds).toBeGreaterThan(0);
    expect(seen.answered).toBeGreaterThan(0);
    expect(seen.creases).toBeGreaterThan(1);
  }, 60_000);
});
