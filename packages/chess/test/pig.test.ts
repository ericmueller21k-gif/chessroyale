import { describe, expect, it, vi } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, isPlayable, mulberry32, type BossPowerState, type BossState, type Settings } from "@chessroyale/core";
import {
  HOLD,
  MatchRunner,
  PIG,
  PULL,
  SHOWDOWN,
  START_FEN,
  applyMove,
  bossMoveFrom,
  bossRules,
  brainLine,
  checkDrag,
  checkLineup,
  crowdAllowed,
  duelReplyDue,
  dragCandidates,
  dragFrom,
  dragOptions,
  edgeInPawns,
  fenAtPly,
  initPowers,
  inCheck,
  kingAttacked,
  lassoSeed,
  legalMoves,
  lineups,
  pickDrag,
  sanLineToUci,
  pieceAt,
  pigTurn,
  powerMomentMs,
  powerTurn,
  prepareTurn,
  pullFrom,
  pullOptions,
  qualifies,
  rankShowdowns,
  searchShowdowns,
  showdownFrom,
  ShowdownScout,
  triggerUltimate,
  sideToMove,
  withPiece,
  withoutPiece,
  type EngineLike,
  type HumanEngineLike,
  type LineupScore,
  type Opening,
} from "../src/index.ts";

/**
 * Wrangler, the cowboy pig (code id `pig`): his long pull (his first move, a center pawn three squares), his lasso drag
 * (a crowd piece dragged a square after his move, costing the crowd a little by the engine's measure) and SHOWDOWN! (three
 * pairs lined up facing each other, the crowd's next move one of the duels). See DECISIONS.md, "Wrangler, built".
 */

// ---------------- Engines for the tests ----------------

const count = (fen: string, c: string) => [...fen.split(" ")[0]!].filter((x) => x === c).length;
/**
 * An engine whose every position is worth `value(fen)` to the side to move (its top move: the first legal one). Each
 * search is counted.
 */
function valueEngine(value: (fen: string) => number, opts: { mate?: (fen: string) => number | undefined } = {}): EngineLike & { searches: number } {
  const e = {
    searches: 0,
    topMoves: async (fen: string, n: number) => {
      e.searches++;
      const mate = opts.mate?.(fen);
      return legalMoves(fen)
        .sort()
        .slice(0, n)
        .map((move) => ({ move, expected: value(fen), ...(mate !== undefined ? { mate } : {}) }));
    },
    topMovesAt: async (fen: string, n: number) => e.topMoves(fen, n),
    scoreMoves: async (fen: string, moves: readonly string[]) => [...new Set(moves)].sort().map((move) => ({ move, expected: 1 - value(applyMove(fen, move)) })),
    playAtElo: async (fen: string) => legalMoves(fen).sort()[0]!,
  };
  return e;
}
/** His expected score for an edge of `pawns` (the measure his powers use). */
const forEdge = (pawns: number) => 1 / (1 + Math.exp(-pawns * BOSS_POWERS.bouncePawnLogit));
/**
 * The crowd White, him Black. A position after a duel (him to move) is worth: +0.5 pawns to him when the crowd took his
 * queen, +3 when it took a rook, `minor` when it took a bishop or knight (so the queens' duel is the crowd's best and a
 * wrong one costs it 2.5 more: Eric's goal); everything else level.
 */
function duelEngine(minor = 3) {
  return valueEngine((fen) => {
    if (fen.split(" ")[1] !== "b") return 0.5;
    if (count(fen, "q") < count(fen, "Q")) return forEdge(0.5);
    if (count(fen, "r") < count(fen, "R")) return forEdge(3);
    if (count(fen, "b") + count(fen, "n") < count(fen, "B") + count(fen, "N")) return forEdge(minor);
    return 0.5;
  });
}

const WORTH: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
/**
 * duelEngine, with his moves (him to move) in an order of their own: his best takes the crowd's most valuable piece with
 * his least valuable one (after the queens' duel: taking back the queen); next, his captures of other crowd pieces, the
 * first 4.5 points worse (in a slip's range, bossSlipLoss), the rest far worse. Each position's worth (all the showdown
 * search reads) is duelEngine's.
 */
function recaptureEngine(): EngineLike {
  const base = duelEngine();
  const order = (fen: string) => {
    const took = (m: string) => WORTH[pieceAt(fen, m.slice(2, 4))?.type ?? ""] ?? 0;
    const by = (m: string) => WORTH[pieceAt(fen, m.slice(0, 2))!.type]!;
    const legal = legalMoves(fen).sort();
    const captures = legal.filter((m) => took(m) > 0).sort((a, b) => took(b) - took(a) || by(a) - by(b));
    const best = captures[0];
    const others = captures.filter((m) => m.slice(2, 4) !== best?.slice(2, 4));
    return [...(best ? [best] : []), ...others, ...legal.filter((m) => m !== best && !others.includes(m))];
  };
  const top = async (fen: string, n: number) => {
    if (fen.split(" ")[1] !== "b") return base.topMoves(fen, n);
    const worth = (await base.topMoves(fen, 1))[0]?.expected ?? 0.5;
    return order(fen)
      .slice(0, n)
      .map((move, i) => ({ move, expected: i === 0 ? worth : Math.max(0.01, worth - (i === 1 ? 0.045 : 0.3)) }));
  };
  return { ...base, topMoves: top, topMovesAt: (fen, n) => top(fen, n) };
}

/**
 * The boss's brain as Eric met it (Maia at 600, no guard), a stand-in: it takes a crowd piece other than the queen when
 * it can (Wrangler took another piece and left the queen), else plays its first legal move. Counts how often it's asked.
 */
function carelessMaia(): HumanEngineLike & { asked: number } {
  const m = {
    asked: 0,
    ready: () => true,
    candidates: async (fen: string, _rating: number, allowed: readonly string[] | null) => {
      m.asked++;
      const legal = [...(allowed ?? legalMoves(fen))].sort();
      const other = legal.find((x) => {
        const t = pieceAt(fen, x.slice(2, 4));
        return !!t && t.type !== "q" && t.color !== sideToMove(fen);
      });
      const pick = other ?? legal[0]!;
      return { best: pick, moves: [{ move: pick, p: 0.9 }], ms: 5 };
    },
  };
  return m;
}

const logit = (x: number) => Math.log(x / (1 - x));
const RUY_LINE = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } });

function raid(opts: { patch?: Partial<Settings>; seed?: number; engine?: EngineLike } = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "pig", lastStandLoss: 999, lastStandLossFloor: 999, lastStandFrom: 999, ...opts.patch } as Settings;
  return new MatchRunner({ settings, rng: mulberry32(opts.seed ?? 5), engines: [opts.engine ?? valueEngine(() => 0.5)], library: [opening(RUY_LINE)], entrants: [{ id: "h0", name: "H", isBot: false }] });
}
const fenOf = (r: MatchRunner) => r.boards.get(0)!.fen;
/** One crowd turn: you play `move` (or the first allowed move), then the boss replies. */
async function turn(r: MatchRunner, move?: string) {
  r.deal();
  const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
  await r.score(new Map([["h0", { move: move && allowed.includes(move) ? move : [...allowed].sort()[0]!, thinkMs: 1000 }]]));
  if (r.isOver() || r.stageComplete()) return;
  await r.playBoss();
}
/** A boss state for the rules alone (the crowd White). */
function bossWith(fen: string, powers: Partial<BossPowerState>, crowdMoves = 5): BossState {
  return { id: "pig", crowdSide: "w", crowdMoves, powers: { ...initPowers(1, fen, "w"), turn: crowdMoves, pull: null, nextPassive: 99, ...powers } } as unknown as BossState;
}

/** A middlegame (the Ruy Lopez, ten moves in), the crowd White to move. */
const RUY = "r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1 w - - 0 10";

describe("Wrangler: who he is", () => {
  it("is on the roster as pig (🤠, Wrangler) with the lasso drag and the showdown, playable, weaker underneath as Big Boy and Sawyer", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "pig")!;
    expect(def).toMatchObject({ name: "Wrangler", icon: "🤠", kit: "Wrangler", offset: -250, powers: { passive: "drag", ultimate: "showdown" } });
    expect(isPlayable(def)).toBe(true);
    expect(BOSS_ROSTER.some((b) => b.id === "wrangler")).toBe(false);
  });

  it("plays from the starting position, Black as every raid boss (the crowd White)", () => {
    const r = raid();
    expect(r.boards.get(0)!.history).toEqual([]);
    expect(fenOf(r)).toBe(START_FEN);
    expect(r.boss!.crowdSide).toBe("w");
    expect(r.boss!.powers!.nextPassive).toBe(BOSS_POWERS.dragFirst);
  });
});

describe("Wrangler's long pull", () => {
  it("only a center pawn (d or e) from its starting square, three squares; never a side pawn", () => {
    expect(pullOptions(START_FEN)).toEqual(["d2d5", "e2e5"]);
    // As Black after the crowd's first move: the pawn the crowd's move blocks is out.
    expect(pullOptions(applyMove(START_FEN, "e2e4"))).toEqual(["d7d4"]);
    expect(pullOptions(applyMove(START_FEN, "d2d4"))).toEqual(["e7e4"]);
    expect(pullOptions(applyMove(START_FEN, "g1f3"))).toEqual(["d7d4", "e7e4"]);
    for (const m of legalMoves(START_FEN)) for (const p of pullOptions(applyMove(START_FEN, m))) expect(["d", "e"]).toContain(p[0]);
  });

  it("is skipped when unsound: its path or square taken, or the pawn simply taken (a crowd pawn on it, more attackers than defenders)", () => {
    // 1.e3 and 1.c3: d4 is attacked by a crowd pawn; 1.d3 and d5 blocks nothing, but 1.Nc3 ... e4 is taken by 1.e4.
    expect(pullOptions(applyMove(START_FEN, "e2e3"))).toEqual(["e7e4"]);
    expect(pullOptions(applyMove(START_FEN, "c2c3"))).toEqual(["e7e4"]);
    // A piece on its path (d6) or its square (d4): no d-pull.
    expect(pullOptions(withPiece(applyMove(START_FEN, "g1f3"), "d6", { color: "b", type: "n" }))).toEqual(["e7e4"]);
    expect(pullOptions(withPiece(applyMove(START_FEN, "g1f3"), "d4", { color: "w", type: "n" }))).toEqual(["e7e4"]);
    // The pawn already moved: none.
    expect(pullOptions(applyMove(applyMove(START_FEN, "e2e4"), "d7d6"))).not.toContain("d7d4");
  });

  it("the engine picks the pawn best for him, and none when every pull costs him more than pullMaxLoss against his best move", async () => {
    const fen = applyMove(START_FEN, "g1f3");
    // Level everywhere: the first of the best (d7d4).
    expect(await pullFrom(valueEngine(() => 0.5), fen, pullOptions(fen))).toBe("d7d4");
    // The e-pull better for him (the crowd worse off after it).
    const e = valueEngine((f) => (pieceAt(f, "e4")?.color === "b" && f.split(" ")[1] === "w" ? 0.45 : 0.5));
    expect(await pullFrom(e, fen, pullOptions(fen))).toBe("e7e4");
    // Every pull loses him a pawn and more against his ordinary move: an ordinary first move.
    const bad = valueEngine((f) => (f.split(" ")[1] === "w" && (pieceAt(f, "d4") || pieceAt(f, "e4")) ? forEdge(1.2) : 0.5));
    expect(await pullFrom(bad, fen, pullOptions(fen))).toBeNull();
    // Inside the cap (half a pawn): still pulled.
    const ok = valueEngine((f) => (f.split(" ")[1] === "w" && (pieceAt(f, "d4") || pieceAt(f, "e4")) ? forEdge(BOSS_POWERS.pullMaxLoss - 0.1) : 0.5));
    expect(await pullFrom(ok, fen, pullOptions(fen))).toBe("d7d4");
  });

  it("in the match: his double step, then the pawn a square further (a base on the board), its moment as the crowd's next turn begins", async () => {
    const r = raid();
    await turn(r, "e2e4");
    const board = r.boards.get(0)!;
    expect(board.history).toEqual(["e2e4", "d7d5"]);
    expect(pieceAt(board.fen, "d4")).toEqual({ color: "b", type: "p" });
    expect(pieceAt(board.fen, "d5")).toBeNull();
    expect(board.bases).toContainEqual({ ply: 2, fen: board.fen });
    // Every replay plays from it.
    expect(fenAtPly(board.history, 2, board.bases)).toBe(board.fen);
    expect(board.lastMove).toBe("d7d4");
    const v = r.bossView()!;
    expect(v.lastMove).toMatchObject({ move: "d7d4", san: "d4" });
    expect(v.powers!.pull).toEqual({ turn: 2, from: "d7", via: "d5", to: "d4" });
    expect(v.powers!.events).toContainEqual({ kind: "pull", turn: 2, square: "d4", squares: ["d7", "d5", "d4"] });
    expect(powerMomentMs(v.powers!.events)).toBeGreaterThanOrEqual(PULL.total);
    // The crowd plays on from it; no en passant against a pull.
    expect(fenOf(r).split(" ")[3]).toBe("-");
    await turn(r);
    expect(r.boards.get(0)!.history.length).toBe(4);
  });

  it("an ordinary first move when none is sound (and only his first move can be one)", async () => {
    const bad = valueEngine((f) => (f.split(" ")[1] === "w" && (pieceAt(f, "d4")?.color === "b" || pieceAt(f, "e4")?.color === "b") ? forEdge(2) : 0.5));
    const r = raid({ engine: bad });
    await turn(r, "g1f3");
    expect(r.boss!.powers!.pull).toBeNull();
    expect(r.bossView()!.powers!.events.map((e) => e.kind)).not.toContain("pull");
    expect(r.boards.get(0)!.history.length).toBe(2);
    // A three-square move later is never a pull.
    const fen = fenOf(r);
    expect(PIG.specialMove!(r.boss!, fen, "e7e4")).toBeNull();
  });

  it("as White (the crowd Black: ?side=b), his very first move", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "pig", lastStandFrom: 999 } as Settings;
    const r = new MatchRunner({ settings, rng: mulberry32(3), engines: [valueEngine(() => 0.5)], library: [opening(RUY_LINE)], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: "b" });
    expect(r.boss!.crowdSide).toBe("b");
    expect(r.bossToMove()).toBe(true);
    expect(r.bossAsks()).toMatchObject({ pull: ["d2d5", "e2e5"] });
    await r.playBoss();
    expect(pieceAt(fenOf(r), "d5")).toEqual({ color: "w", type: "p" });
    expect(r.boss!.powers!.pull).toEqual({ turn: 1, from: "d2", via: "d4", to: "d5" });
  });
});

describe("Wrangler's lasso drag: the rules", () => {
  it("one square up, down, left or right onto an empty square; never the king; a pawn never onto the first or last rank", () => {
    const fen = applyMove(applyMove(START_FEN, "e2e4"), "e7e5");
    const opts = dragOptions(fen);
    expect(opts.length).toBeGreaterThan(0);
    for (const d of opts) {
      expect(pieceAt(fen, d.from)!.color).toBe("w");
      expect(pieceAt(fen, d.from)!.type).not.toBe("k");
      expect(pieceAt(fen, d.to)).toBeNull();
      const df = Math.abs(d.from.charCodeAt(0) - d.to.charCodeAt(0));
      const dr = Math.abs(Number(d.from[1]) - Number(d.to[1]));
      expect(df + dr).toBe(1);
      if (d.piece === "p") expect(["1", "8"]).not.toContain(d.to[1]);
      expect(pieceAt(d.fen, d.to)).toEqual(pieceAt(fen, d.from));
      expect(pieceAt(d.fen, d.from)).toBeNull();
    }
    // A pawn on its second rank can't be dragged back onto its first.
    expect(opts.some((d) => d.from === "a2" && d.to === "a1")).toBe(false);
    expect(opts.some((d) => d.from === "e4" && d.to === "e3")).toBe(true);
  });

  it("never leaves the crowd in check or his king attacked, and never leaves the crowd without a move", () => {
    // A pinned knight (e2, the rook on e8 behind it): dragged off the file, the king would be in check.
    const pin = "4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1";
    const opts = dragOptions(pin);
    expect(opts.some((d) => d.from === "e2" && (d.to === "d2" || d.to === "f2"))).toBe(false);
    expect(opts.some((d) => d.from === "e2" && d.to === "e3")).toBe(true);
    for (const d of opts) {
      expect(inCheck(d.fen)).toBe(false);
      expect(kingAttacked(d.fen, "b")).toBe(false);
    }
    // A rook dragged onto his king's file would give check (him not to move): never.
    const rook = "6k1/8/8/8/8/8/8/R5K1 w - - 0 1";
    expect(dragOptions(rook).some((d) => d.to === "a2")).toBe(true);
    expect(dragOptions("6k1/8/8/8/8/8/8/5RK1 w - - 0 1").some((d) => d.from === "f1" && d.to === "g1")).toBe(false);
    // The crowd's last pawn blocked and its king boxed in: dragging the pawn up (h3) would leave it no move.
    const box = "1b6/8/8/8/7p/8/7P/5k1K w - - 0 1";
    expect(legalMoves(box).length).toBeGreaterThan(0);
    expect(dragOptions(box).some((d) => d.from === "h2" && d.to === "h3")).toBe(false);
    for (const d of dragOptions(box)) expect(legalMoves(d.fen).length).toBeGreaterThan(0);
  });

  it("castling goes with a rook dragged off its corner; the server checks a drag against the rules (checkDrag)", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const d = dragOptions(fen).find((x) => x.from === "h1" && x.to === "g1")!;
    expect(d.fen.split(" ")[2]).toBe("Qkq");
    expect(checkDrag(fen, "h1g1")).toMatchObject({ from: "h1", to: "g1" });
    expect(checkDrag(fen, "e1e2")).toBeNull();
    expect(checkDrag(fen, "h1h3")).toBeNull();
    expect(checkDrag(fen, "a8a7")).toBeNull();
    expect(checkDrag(fen, "")).toBeNull();
  });

  it("its candidates are a seeded sample (the same seed, the same list), none leaving more of the crowd's material hanging", () => {
    const a = dragCandidates(RUY, 11);
    expect(a).toEqual(dragCandidates(RUY, 11));
    expect(a.length).toBeLessThanOrEqual(BOSS_POWERS.dragCandidates);
    expect(a.length).toBeGreaterThan(0);
    // (Here every drag fits in the sample: a smaller one shows the seed choosing.)
    const seeds = new Set(Array.from({ length: 12 }, (_, s) => dragCandidates(RUY, s, { dragCandidates: 6 }).map((d) => d.from + d.to).join()));
    expect(seeds.size).toBeGreaterThan(1);
  });

  it("the pick: inside the loss band, nearest its middle, ties from the seed; none in the band: none", () => {
    const before = 0.5;
    const at = (pawns: number) => 1 / (1 + Math.exp(-(logit(before) - pawns * BOSS_POWERS.bouncePawnLogit)));
    const scored = [
      { drag: "a2a3", crowd: at(0.05) },
      { drag: "b2b3", crowd: at(0.3) },
      { drag: "c2c3", crowd: at(0.55) },
      { drag: "d2d3", crowd: at(1.4) },
      { drag: "e2e3", crowd: at(0.5), mate: true },
    ];
    expect(pickDrag(before, scored, 1)).toEqual({ drag: "c2c3", loss: 0.55 });
    expect(pickDrag(before, [scored[0]!, scored[3]!], 1)).toBeNull();
    // Two as near the middle: the seed picks, the same every time.
    const tie = [
      { drag: "a2a3", crowd: at(0.45) },
      { drag: "h2h3", crowd: at(0.55) },
    ];
    const picks = new Set(Array.from({ length: 16 }, (_, s) => pickDrag(before, tie, s)!.drag));
    expect(picks.size).toBe(2);
    expect(pickDrag(before, tie, 7)).toEqual(pickDrag(before, tie, 7));
  });

  it("dragFrom: the engine's loss for each candidate, the one nearest the band's middle", async () => {
    // Each drag costs the crowd between 0 and 1.5 pawns, by its squares.
    const cost = (f: string) => {
      let h = 0;
      for (const c of f.split(" ")[0]!) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return (h % 150) / 100;
    };
    const e = valueEngine((f) => (f === RUY ? 0.5 : f.split(" ")[1] === "w" ? 1 / (1 + Math.exp(cost(f) * BOSS_POWERS.bouncePawnLogit)) : 0.5));
    const pick = (await dragFrom([e], RUY, 4))!;
    expect(pick).not.toBeNull();
    expect(pick.loss).toBeGreaterThanOrEqual(BOSS_POWERS.dragLoss[0]);
    expect(pick.loss).toBeLessThanOrEqual(BOSS_POWERS.dragLoss[1]);
    expect(await dragFrom([e], RUY, 4)).toEqual(pick);
    // Level everywhere: nothing in the band, no drag.
    expect(await dragFrom([valueEngine(() => 0.5)], RUY, 4)).toBeNull();
  });
});

/** An engine for the match: level, but every drag costs the crowd half a pawn (the one nearest the band's middle wins). */
const dragging = () => {
  const cost = (f: string) => (f.split(" ")[1] === "w" ? forEdge(-0.5) : 0.5);
  return valueEngine((f) => cost(f));
};

describe("Wrangler's lasso drag in the match", () => {
  it("after his move as turn dragFirst begins, then every dragEvery turns: a base on the board, its moment, a power turn", async () => {
    // (Level for the crowd before each drag, half a pawn worse after one: the crowd's positions are all "after".)
    let dragFen = "";
    const e = valueEngine((f) => (f === dragFen ? 0.5 : f.split(" ")[1] === "w" ? forEdge(-0.5) : 0.5));
    const r = raid({ engine: e, patch: { bossMaxMoves: 60 } });
    const asked: number[] = [];
    for (let t = 1; t <= 14 && !r.isOver(); t++) {
      r.deal();
      const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
      await r.score(new Map([["h0", { move: [...allowed].sort()[0]!, thinkMs: 1000 }]]));
      if (r.isOver() || r.stageComplete()) break;
      if (r.bossAsks()?.drag) asked.push(r.boss!.crowdMoves + 1);
      // (The engine reads the position after his move as "before" the drag.)
      const fen = fenOf(r);
      const move = legalMoves(fen).sort()[0]!;
      dragFen = r.bossAsks()?.drag ? applyMove(fen, r.bossAsks()?.pull ? move : move) : "";
      await r.playBoss();
      const p = r.boss!.powers!;
      if (p.drag?.turn === r.boss!.crowdMoves + 1) {
        const board = r.boards.get(0)!;
        expect(board.bases).toContainEqual({ ply: board.history.length, fen: board.fen });
        expect(pieceAt(board.fen, p.drag.to)?.type).toBe(p.drag.piece);
        expect(pieceAt(board.fen, p.drag.from)).toBeNull();
        expect(p.events).toContainEqual({ kind: "drag", turn: p.drag.turn, square: p.drag.to, squares: [p.drag.from, p.drag.to] });
        expect(powerTurn(r.boss)).toBe(true);
      }
    }
    expect(asked[0]).toBe(BOSS_POWERS.dragFirst);
    expect(asked).toContain(BOSS_POWERS.dragFirst + BOSS_POWERS.dragEvery);
    expect(asked.filter((t) => t > BOSS_POWERS.dragFirst && t < BOSS_POWERS.dragFirst + BOSS_POWERS.dragEvery)).toEqual([]);
  });

  it("none in the band (or no answer): no drag that turn, and it doesn't count (he tries after his next move)", () => {
    const fen = applyMove(applyMove(START_FEN, "e2e4"), "e7e5");
    const b = bossWith(fen, { nextPassive: 3 }, 2);
    // Due as turn 3 begins, but no drag was found.
    const next = prepareTurn(b, fen);
    expect(next.powers!.events.map((e) => e.kind)).not.toContain("drag");
    expect(next.powers!.nextPassive).toBe(4);
    // Found: its moment, and the next one dragEvery turns on.
    const found = prepareTurn(bossWith(fen, { nextPassive: 3, drag: { turn: 3, from: "a2", to: "a3", piece: "p" } }, 2), fen);
    expect(found.powers!.events).toContainEqual({ kind: "drag", turn: 3, square: "a3", squares: ["a2", "a3"] });
    expect(found.powers!.nextPassive).toBe(3 + BOSS_POWERS.dragEvery);
    // The test switch (?power=drag): every 2 turns.
    expect(prepareTurn(bossWith(fen, { nextPassive: 3, drag: { turn: 3, from: "a2", to: "a3", piece: "p" } }, 2), fen, "drag").powers!.nextPassive).toBe(5);
  });

  it("a drag the server is sent that the rules don't allow is ignored (the host's word stands only within his rules)", async () => {
    const r = raid({ engine: dragging() });
    await turn(r, "e2e4");
    await turn(r);
    r.deal();
    await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
    expect(r.bossAsks()).toMatchObject({ drag: true });
    const before = fenOf(r);
    const move = legalMoves(before).sort()[0]!;
    // The crowd's king, and a square that isn't next to it: both refused.
    r.applyBossMove(move, false, { drag: "e1e2" });
    expect(r.boss!.powers!.drag ?? null).toBeNull();
    expect(r.boards.get(0)!.fen).toBe(applyMove(before, move));
  });
});

describe("Wrangler's showdown: the line-up", () => {
  const l0 = [...lineups(RUY, 3, 3, 3000)].find(Boolean)!;

  it("three matched pairs (queens, rooks, then a minor), each facing off with nothing or one empty square between, in the middle (b-g, 3-6)", () => {
    const found = [...lineups(RUY, 3, 3, 3000)].filter(Boolean).slice(0, 40);
    expect(found.length).toBeGreaterThan(10);
    for (const l of found) {
      const kinds = l!.pairs.map((p) => p.piece);
      expect(kinds.slice(0, 2)).toEqual(["q", "r"]);
      expect(["b", "n"]).toContain(kinds[2]);
      for (const p of l!.pairs) {
        for (const sq of [p.crowd, p.boss]) {
          expect("bcdefg").toContain(sq[0]);
          expect("3456").toContain(sq[1]);
        }
        expect(pieceAt(l!.fen, p.crowd)).toEqual({ color: "w", type: p.piece });
        expect(pieceAt(l!.fen, p.boss)).toEqual({ color: "b", type: p.piece });
        const df = Math.abs(p.crowd.charCodeAt(0) - p.boss.charCodeAt(0));
        const dr = Math.abs(Number(p.crowd[1]) - Number(p.boss[1]));
        if (p.piece === "n") expect(df * dr).toBe(2);
        else expect(Math.max(df, dr)).toBeLessThanOrEqual(2);
        // Bishops keep their color.
        if (p.piece === "b") {
          const light = (s: string) => (s.charCodeAt(0) - 97 + Number(s[1])) % 2 === 0;
          expect(light(p.crowd)).toBe(light(p.crowdFrom));
          expect(light(p.boss)).toBe(light(p.bossFrom));
        }
      }
      // Every duel is a legal capture, nobody is in check, and the six stand within five files.
      for (const d of l!.duels) expect(legalMoves(l!.fen)).toContain(d);
      expect(inCheck(l!.fen)).toBe(false);
      expect(kingAttacked(l!.fen, "b")).toBe(false);
      const files = l!.pairs.flatMap((p) => [p.crowd.charCodeAt(0), p.boss.charCodeAt(0)]);
      expect(Math.max(...files) - Math.min(...files)).toBeLessThanOrEqual(4);
      // Material and pawns untouched.
      expect(l!.fen.split(" ")[0]!.replace(/[^pP]/g, "").length).toBe(RUY.split(" ")[0]!.replace(/[^pP]/g, "").length);
    }
  });

  it("his three pieces are always protected", () => {
    for (const l of [...lineups(RUY, 9, 3, 3000)].filter(Boolean).slice(0, 30)) {
      for (const p of l!.pairs) {
        // Take his piece with a crowd piece of hers and see that he can take back.
        const after = applyMove(l!.fen, p.crowd + p.boss);
        expect(legalMoves(after).some((m) => m.slice(2, 4) === p.boss), `${l!.spec}: ${p.boss}`).toBe(true);
      }
    }
  });

  it("the same seed and position give the same line-ups, in the same order", () => {
    const a = [...lineups(RUY, 21, 3, 1500)].filter(Boolean).map((l) => l!.spec);
    expect([...lineups(RUY, 21, 3, 1500)].filter(Boolean).map((l) => l!.spec)).toEqual(a);
    expect([...lineups(RUY, 22, 3, 1500)].filter(Boolean).map((l) => l!.spec)).not.toEqual(a);
  });

  it("checkLineup (the server's check): accepts a line-up made here, refuses anything outside his rules", () => {
    expect(checkLineup(RUY, l0.spec)).toMatchObject({ spec: l0.spec, fen: l0.fen });
    const [p0, ...rest] = l0.spec.split(" ");
    const swap = (i: number, sq: string) => [p0!.slice(0, i) + sq + p0!.slice(i + 2), ...rest].join(" ");
    // A king, a pawn, mismatched kinds, a square outside the middle, the same square twice, and nonsense.
    expect(checkLineup(RUY, swap(0, "g1"))).toBeNull();
    expect(checkLineup(RUY, swap(0, "a2"))).toBeNull();
    expect(checkLineup(RUY, swap(2, "h4"))).toBeNull();
    expect(checkLineup(RUY, swap(2, rest[0]!.slice(2, 4)))).toBeNull();
    expect(checkLineup(RUY, "d1d4")).toBeNull();
    expect(checkLineup(RUY, "")).toBeNull();
    expect(checkLineup(RUY, null)).toBeNull();
    // Only the sizes asked for (his last try allows two pairs).
    expect(checkLineup(RUY, l0.spec, [2])).toBeNull();
    const two = [...lineups(RUY, 3, 2, 3000)].find(Boolean)!;
    expect(checkLineup(RUY, two.spec, [3])).toBeNull();
    expect(checkLineup(RUY, two.spec, [3, 2])).not.toBeNull();
    // A bishop pair standing a knight's jump apart, or two squares apart with something between: refused.
    const far = (spec: string) => spec.replace(/^(..)(..)/, (_m, a: string, b: string) => `${a}${b[0]}${Number(b[1]) === 3 ? 6 : 3}`);
    expect(checkLineup(RUY, far(l0.spec))).toBeNull();
  });

  it("an unprotected piece of his, a check, or a pinned duel: refused", () => {
    // (Built by hand in an open position: the queens face off on d4-d5 with nothing guarding his.)
    const open = "4k3/8/8/8/8/8/8/3QK2q w - - 0 1";
    expect(checkLineup(open, "d1d4h1d5", [1, 2, 3])).toBeNull();
  });
});

describe("Wrangler's showdown: Eric's goal", () => {
  const score = (gains: number[], spec = "x", mate = false): LineupScore => ({ spec, duels: gains.length, gains, gain: Math.min(...gains), trap: Math.max(...gains) - Math.min(...gains), mate });

  it("the crowd's best duel gains him showdownEdge pawns, another costs the crowd showdownTrap more, never a mate", () => {
    expect(qualifies(score([0.5, 3, 3]))).toBe(true);
    expect(qualifies(score([0.5, 2.6]))).toBe(true);
    // Too little for him, too much, no trap, a mate.
    expect(qualifies(score([0.05, 3, 3]))).toBe(false);
    expect(qualifies(score([1.5, 4, 4]))).toBe(false);
    expect(qualifies(score([0.5, 1.5, 2]))).toBe(false);
    expect(qualifies(score([0.5, 3, 3], "x", true))).toBe(false);
    // The crowd's best duel is the smallest gain for him, whatever the order.
    expect(qualifies(score([3, 0.4, 2.5]))).toBe(true);
  });

  it("of those that qualify, the one nearest showdownTarget first; ties from the seed", () => {
    const list = [score([0.9, 3], "a"), score([0.45, 3], "b"), score([0.2, 3], "c")];
    expect(rankShowdowns(list, 1).map((x) => x.spec)).toEqual(["b", "c", "a"].sort((x, y) => Math.abs(list.find((l) => l.spec === x)!.gain - 0.5) - Math.abs(list.find((l) => l.spec === y)!.gain - 0.5)));
    const tie = [score([0.4, 3], "p"), score([0.6, 3], "q")];
    expect(new Set(Array.from({ length: 16 }, (_, s) => rankShowdowns(tie, s)[0]!.spec)).size).toBe(2);
    expect(rankShowdowns(tie, 5)[0]!.spec).toBe(rankShowdowns(tie, 5)[0]!.spec);
  });

  it("the search finds a line-up meeting it when one exists (the queens' duel his best, the rooks' and minors' a disaster)", async () => {
    const e = duelEngine();
    const pick = await showdownFrom([e], RUY, 7, false);
    expect(pick).not.toBeNull();
    const l = checkLineup(RUY, pick!.spec)!;
    expect(l.pairs.map((p) => p.piece)).toContain("q");
    expect(pick!.gain).toBeCloseTo(0.5, 1);
    // The same seed and position: the same line-up.
    expect(await showdownFrom([duelEngine()], RUY, 7, false)).toEqual(pick);
  });

  it("none qualifying (a minor's duel the crowd's best): none of three pairs; on his last try, two pairs (queens and rooks)", async () => {
    const e = duelEngine(-3);
    expect(await showdownFrom([e], RUY, 7, false, null, { ...BOSS_POWERS, showdownTurnMs: 2000, showdownSetups: 40 })).toBeNull();
    const last = await showdownFrom([e], RUY, 7, true, null, { ...BOSS_POWERS, showdownTurnMs: 4000, showdownSetups: 40 });
    expect(last).not.toBeNull();
    expect(checkLineup(RUY, last!.spec, [2])!.pairs.map((p) => p.piece)).toEqual(["q", "r"]);
  });

  it("the scout: line-ups found while the crowd thinks are scanned first at his turn, if they still hold", async () => {
    const e = duelEngine();
    const scout = new ShowdownScout(async () => e, { ...BOSS_POWERS, showdownSearchMs: 3000 });
    scout.scout(RUY);
    await new Promise((r) => setTimeout(r, 400));
    scout.stop();
    await scout.idle();
    const carried = scout.carry(3);
    expect(carried.length).toBeGreaterThan(0);
    // His move (a quiet one far from the six) keeps them standing: the first carried one is the line-up.
    const after = applyMove(applyMove(RUY, "a2a3"), "h7h6");
    const still = carried.filter((s) => checkLineup(after, s));
    expect(still.length).toBeGreaterThan(0);
    const r = await searchShowdowns({ engines: [e], fen: after, seed: 1, duels: 3, before: 0, carry: carried, max: 1 });
    expect(r.tried).toBe(1);
    expect(r.found[0]?.spec).toBe(still[0]);
  });
});

describe("Wrangler's showdown in the match", () => {
  /** A raid with the showdown's test switch: warned as turn 2 begins, searched at his turn after the crowd's 2nd move. */
  const showdownRaid = (engine: EngineLike, patch: Partial<Settings> = {}) => raid({ engine, patch: { bossPowerTest: "showdown", ...patch } });
  /** The crowd's move, then (not his turn yet) stop. */
  const crowdOnly = async (r: MatchRunner, move?: string) => {
    r.deal();
    const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
    await r.score(new Map([["h0", { move: move && allowed.includes(move) ? move : [...allowed].sort()[0]!, thinkMs: 1000 }]]));
  };

  it("warned, then at his turn the line-up after his move: a base on the board, its moment, and the crowd's move must be one of the duels", async () => {
    const r = showdownRaid(duelEngine());
    await turn(r, "e2e4");
    expect(r.bossView()!.powers!.warned).toBe(true);
    await crowdOnly(r, "g1f3");
    expect(r.bossAsks()).toMatchObject({ showdown: "try" });
    const ask = r.bossAsks()!;
    expect(ask.seed).toBe(lassoSeed(r.boss!.powers!.seed, 3));
    await r.playBoss();
    const p = r.boss!.powers!;
    expect(p.ultAt).toBe(3);
    expect(p.showdown!.turn).toBe(3);
    expect(p.showdown!.pairs.length).toBe(3);
    const board = r.boards.get(0)!;
    expect(board.bases).toContainEqual({ ply: board.history.length, fen: board.fen });
    expect(p.showdown!.before).toBe(applyMove(fenAtPly(board.history, board.history.length - 1, board.bases), board.history.at(-1)!));
    expect(checkLineup(p.showdown!.before, p.showdown!.pairs.map((x) => `${x.crowdFrom}${x.crowd}${x.bossFrom}${x.boss}`).join(" "))!.fen).toBe(board.fen);
    expect(p.events).toContainEqual({ kind: "showdown", turn: 3, squares: p.showdown!.pairs.flatMap((x) => [x.crowd, x.boss]) });
    expect(powerMomentMs(p.events)).toBeGreaterThanOrEqual(SHOWDOWN.total);
    // The forced duel: only the three captures.
    const duels = p.showdown!.pairs.map((x) => x.crowd + x.boss).sort();
    expect([...crowdAllowed(r.boss, board.fen)!].sort()).toEqual(duels);
    expect(powerTurn(r.boss)).toBe(true);
    // The meter's spent; the duel resolves as a normal move, and after it the game is free again.
    expect(r.bossView()!.powers!.rage).toBe(1);
    await turn(r, duels[0]);
    expect(r.crowdAllowed()).toBeNull();
    expect(r.bossView()!.powers!.rage).toBe(0);
    expect(r.bossView()!.powers!.ultAt).toBeNull();
  });

  it("no legal duel (one pinned, say): the turn is a normal move, so it never locks up", () => {
    const fen = applyMove(START_FEN, "e2e4");
    const b = bossWith(fen, { showdown: { turn: 6, pairs: [{ piece: "q", crowd: "d4", boss: "d5", crowdFrom: "d1", bossFrom: "d8" }], before: fen, edge: null } }, 5);
    // Neither d4 nor d5 holds those pieces here: no duel is legal, so nothing is limited.
    expect(crowdAllowed(b, fen)).toBeNull();
  });

  it("nothing found: \"Not yet...\" for showdownHolds turns, then his last try (two pairs allowed), then a drag; the meter is spent either way", async () => {
    // Nothing ever qualifies, and drags cost the crowd half a pawn.
    const e = valueEngine((f) => (f.split(" ")[1] === "w" && f.split(" ")[0] !== lastBefore ? forEdge(-0.5) : 0.5));
    let lastBefore = "";
    const r = showdownRaid(e, { bossMaxMoves: 30 });
    await turn(r, "e2e4");
    const seen: string[] = [];
    for (let t = 2; t <= 5; t++) {
      await crowdOnly(r);
      const ask = r.bossAsks();
      seen.push(ask?.showdown ?? "-");
      lastBefore = "";
      await r.playBoss();
      const kinds = r.boss!.powers!.events.map((x) => x.kind);
      seen.push(kinds.join("+"));
      if (r.boss!.powers!.ultAt !== undefined) break;
    }
    expect(seen.slice(0, 6)).toEqual(["try", "hold", "try", "hold", "last", seen[5]]);
    const p = r.boss!.powers!;
    expect(p.ultAt).toBe(5);
    expect(p.holds).toBe(0);
    // The last try came to a drag (the passive's band) or, none in it, nothing; either way the ultimate is spent.
    if (p.drag?.turn === 5) {
      expect(p.drag.ult).toBe(true);
      expect(p.events).toContainEqual({ kind: "drag", turn: 5, square: p.drag.to, squares: [p.drag.from, p.drag.to], ult: true });
    } else expect(p.events).toContainEqual({ kind: "hold", turn: 5, ult: true });
    expect(powerMomentMs([{ kind: "hold" }])).toBe(HOLD.total);
  }, 60_000);

  it("the rules alone: holds while warned, then the last try's fallback; the trigger brings it at his next turn without the warning", () => {
    const fen = applyMove(START_FEN, "e2e4");
    let b = bossWith(fen, { warnAt: 4 }, 4);
    b = prepareTurn(b, fen);
    expect(b.powers!.events).toEqual([{ kind: "hold", turn: 5 }]);
    expect(b.powers!.holds).toBe(1);
    b = prepareTurn({ ...b, crowdMoves: 5 }, fen);
    expect(b.powers!.holds).toBe(2);
    b = prepareTurn({ ...b, crowdMoves: 6 }, fen);
    expect(b.powers!.ultAt).toBe(7);
    expect(b.powers!.holds).toBe(0);
    // (Spent with nothing to show: a hold marked as the ultimate's, so his line says so rather than "Not yet...".)
    expect(b.powers!.events).toContainEqual({ kind: "hold", turn: 7, ult: true });
    // The trigger: due at his next turn.
    const t = triggerUltimate(bossWith(fen, {}, 4));
    expect(t.ok).toBe(true);
    expect(PIG.asks!(t.boss!, fen)).toMatchObject({ showdown: "try" });
  });

  it("host and solo agree: the host's answer to the server's request is the line-up solo plays", async () => {
    const make = () => showdownRaid(duelEngine());
    const solo = make();
    const host = make();
    for (const r of [solo, host]) {
      await turn(r, "e2e4");
      await crowdOnly(r, "g1f3");
    }
    // The host's device: the request's fen and asks, its engines, the same pigTurn (as net.ts runs it).
    const asks = host.bossAsks()!;
    const fen = fenOf(host);
    const answer = await pigTurn([duelEngine()], fen, asks, async () => legalMoves(fen).sort()[0]!);
    await solo.playBoss();
    host.applyBossMove(answer.move, false, { showdown: answer.showdown ?? null });
    expect(answer.showdown).toBeTruthy();
    expect(host.boss!.powers!.showdown!.pairs).toEqual(solo.boss!.powers!.showdown!.pairs);
    expect(fenOf(host)).toBe(fenOf(solo));
  });

  /**
   * Eric, Oct 13: the crowd took his queen in the duel and he took another piece instead of taking back (his brain, Maia
   * at 600, no guard): the crowd won a queen. The search scored each duel with his best reply, so that's what he plays.
   * A raid on his brain (Maia at 600) with slips on (every move a stumble), up to the queens' duel.
   */
  const toQueensDuel = async () => {
    const engine = recaptureEngine();
    const r = showdownRaid(engine, { bossStumbleBelow: 9999, bossStumbleMax: 1 });
    const maia = carelessMaia();
    r.humanBrain = { brain: "maia-raw", rating: 600, engine: maia };
    await turn(r, "e2e4");
    await crowdOnly(r, "g1f3");
    await r.playBoss();
    const sd = r.boss!.powers!.showdown!;
    expect(sd.turn).toBe(3);
    const queens = sd.pairs.find((p) => p.piece === "q")!;
    await crowdOnly(r, queens.crowd + queens.boss);
    return { r, engine, maia, queens, fen: fenOf(r) };
  };

  it("his reply to the duel is the engine's best (taking back), never his brain's (Maia at 600) or a slip: solo", async () => {
    const { r, engine, maia, queens, fen } = await toQueensDuel();
    expect(r.bossToMove()).toBe(true);
    expect(duelReplyDue(r.boss!, r.boards.get(0)!)).toBe(true);
    // What the search assumed: his best reply to the queens' duel takes the queen back.
    const [scored] = await engine.topMovesAt!(fen, 1, BOSS_POWERS.showdownConfirmNodes);
    expect(scored!.move.slice(2, 4)).toBe(queens.boss);
    // His brain would take another piece, and so would a slip, as before.
    const elo = r.boss!.elo;
    expect(await bossMoveFrom(engine, fen, elo, DEFAULT_SETTINGS.bossNodes, "stumble", Math.random, [5, 15], undefined, null, { brain: "maia-raw", rating: 600, engine: carelessMaia() })).not.toBe(scored!.move);
    expect(await bossMoveFrom(engine, fen, elo, DEFAULT_SETTINGS.bossNodes, "stumble")).not.toBe(scored!.move);
    // He takes it back. Maia isn't asked, and the admins' debug line says whose move it was.
    const asked = maia.asked;
    await r.playBoss();
    expect(r.boards.get(0)!.history.at(-1)).toBe(scored!.move);
    expect(pieceAt(fenOf(r), queens.boss)?.color).toBe("b");
    expect(maia.asked).toBe(asked);
    expect(r.brainNote).toMatchObject({ brain: "maia-raw", rating: 600, by: "stockfish", why: "power" });
    expect(brainLine(r.brainNote!)).toBe("Maia 600 · no guard · Stockfish's best (power reply)");
    // Only that one move: his next is his brain's again.
    await turn(r);
    expect(r.brainNote).toMatchObject({ by: "maia" });
    expect(maia.asked).toBe(asked + 1);
  }, 60_000);

  it("only right after a duel on the showdown's own turn: not before it, nor after a move the Last Stand took back", async () => {
    const { r, queens, fen } = await toQueensDuel();
    const board = r.boards.get(0)!;
    expect(duelReplyDue(r.boss!, board)).toBe(true);
    // (A turn later, or a move that isn't a duel: his brain's move, as ever.)
    expect(duelReplyDue({ ...r.boss!, crowdMoves: r.boss!.crowdMoves + 1 }, board)).toBe(false);
    expect(duelReplyDue(r.boss!, { history: [...board.history.slice(0, -1), "a2a3"] })).toBe(false);
    // The Last Stand took the duel back: the move count went back one and the duel isn't on the board; the crowd picks again.
    expect(duelReplyDue({ ...r.boss!, crowdMoves: r.boss!.crowdMoves - 1 }, { history: board.history.slice(0, -1) })).toBe(false);
    expect(applyMove(fenAtPly(board.history, board.history.length - 1, board.bases), queens.crowd + queens.boss)).toBe(fen);
    // Wrangler's rules are the only ones that ask for it.
    expect(PIG.bestReply!(r.boss!, board)).toBe(true);
    for (const def of BOSS_ROSTER.filter((b) => b.id !== "pig")) expect(bossRules({ id: def.id })?.bestReply).toBeUndefined();
  }, 60_000);

  it("the King's strike still staggers it (the crowd's own power); the stumble's draw is still made, so nothing else moves", async () => {
    const { r } = await toQueensDuel();
    const draws = vi.spyOn(r, "bossStumbles");
    expect(r.bossMoveKind()).toBe("best");
    expect(draws).toHaveBeenCalledTimes(1);
    r.state = { ...r.state, boss: { ...r.boss!, staggerNext: true } };
    expect(r.bossMoveKind()).toBe("stagger");
  }, 60_000);

  it("the host's path: the server's request (best, no brain) played as net.ts plays it is the reply solo plays", async () => {
    const { r, engine, fen } = await toQueensDuel();
    // The request the server sends (lobby.ts's sendBossRequest), and the host's answer (net.ts's hostBoss).
    const kind = r.bossMoveKind();
    expect(kind).toBe("best");
    const asks = r.bossAsks();
    const ordinary = () => bossMoveFrom(engine, fen, r.boss!.elo, DEFAULT_SETTINGS.bossNodes, kind, Math.random, DEFAULT_SETTINGS.kingStrikeLoss, undefined, r.bossAllowed());
    const answer = asks ? await pigTurn([engine], fen, asks, ordinary) : { move: await ordinary() };
    await r.playBoss();
    expect(answer.move).toBe(r.boards.get(0)!.history.at(-1));
  }, 60_000);
});

describe("Wrangler's moments", () => {
  it("each holds the screen for its beats", () => {
    expect(powerMomentMs([{ kind: "pull" }])).toBe(PULL.total);
    expect(powerMomentMs([{ kind: "showdown" }])).toBe(SHOWDOWN.total);
    expect(SHOWDOWN.pairs.every((t) => t >= SHOWDOWN.cornerAt && t + SHOWDOWN.yankMs <= SHOWDOWN.drawAt)).toBe(true);
    expect(SHOWDOWN.drawAt).toBeLessThan(SHOWDOWN.total);
  });

  it("his edge reads in pawns as Big Boy's bounce measures them", () => {
    expect(edgeInPawns(0.5)).toBe(0);
    expect(edgeInPawns(forEdge(1))).toBeCloseTo(1, 5);
    expect(edgeInPawns(forEdge(-0.4))).toBeCloseTo(-0.4, 5);
    expect(withoutPiece(START_FEN, "e2")).not.toBe(START_FEN);
  });
});
