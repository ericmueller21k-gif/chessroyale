import { describe, expect, it, vi } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, isPlayable, mulberry32, type BossPowerState, type BossState, type Settings } from "@chessroyale/core";
import {
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
  engineMoveDue,
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
  missBy,
  pairSizes,
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
  showdownHopeless,
  showdownLive,
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
 * The crowd White, him Black. A position after a duel (him to move) is worth, to him, `gain.r` pawns when the crowd took
 * his rook, `gain.b` his bishop, `gain.n` his knight (by default the rooks' duel is the crowd's best, +0.5 for him, and a
 * wrong one costs it 2.5 more: Eric's goal); everything else level.
 */
function duelEngine(gain: Partial<Record<"r" | "b" | "n", number>> = {}) {
  const g = { r: 0.5, b: 3, n: 3, ...gain };
  return valueEngine((fen) => {
    if (fen.split(" ")[1] !== "b") return 0.5;
    if (count(fen, "r") < count(fen, "R")) return forEdge(g.r);
    if (count(fen, "b") < count(fen, "B")) return forEdge(g.b);
    if (count(fen, "n") < count(fen, "N")) return forEdge(g.n);
    return 0.5;
  });
}

const WORTH: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
/**
 * duelEngine, with his moves (him to move) in an order of their own: his best takes the crowd's most valuable piece with
 * his least valuable one (after the rooks' duel: taking back the rook), or a knight first when `first` is "n" (the
 * rook taken back a move later); next, his captures of other crowd pieces, the first 4.5 points worse (in a slip's
 * range, bossSlipLoss), the rest far worse. Each position's worth (all the showdown search reads) is duelEngine's.
 */
function recaptureEngine(first?: "n"): EngineLike {
  const base = duelEngine();
  const order = (fen: string) => {
    const took = (m: string) => {
      const t = pieceAt(fen, m.slice(2, 4))?.type ?? "";
      return t === first ? 50 : (WORTH[t] ?? 0);
    };
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
 * The boss's brain as Eric met it (Maia at 600, no guard), a stand-in: it takes a crowd piece other than a rook when it
 * can (Wrangler took another piece and left the crowd's piece standing on his), else plays its first legal move; `blind`:
 * it never captures (a quiet move each time). Counts how often it's asked.
 */
function carelessMaia(blind = false): HumanEngineLike & { asked: number } {
  const m = {
    asked: 0,
    ready: () => true,
    candidates: async (fen: string, _rating: number, allowed: readonly string[] | null) => {
      m.asked++;
      const legal = [...(allowed ?? legalMoves(fen))].sort();
      const other = legal.find((x) => {
        const t = pieceAt(fen, x.slice(2, 4));
        return !blind && !!t && t.type !== "r" && t.color !== sideToMove(fen);
      });
      const quiet = legal.find((x) => !pieceAt(fen, x.slice(2, 4)));
      const pick = other ?? (blind ? (quiet ?? legal[0]!) : legal[0]!);
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
    // (His meter full from turn 6 and no line-up ever qualifying here: each of his turns searches its showdownTurnMs.)
  }, 60_000);

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
  const light = (s: string) => (s.charCodeAt(0) - 97 + Number(s[1])) % 2 === 0;

  it("a rook, a bishop and a knight pair (never queens), each facing off with nothing or one empty square between, anywhere on ranks 2-7", () => {
    const found = [...lineups(RUY, 3, 3, 3000)].filter(Boolean).slice(0, 40);
    expect(found.length).toBeGreaterThan(10);
    const files = new Set<string>();
    for (const l of found) {
      expect(l!.pairs.map((p) => p.piece).sort()).toEqual(["b", "n", "r"]);
      for (const p of l!.pairs) {
        for (const sq of [p.crowd, p.boss]) {
          expect("234567").toContain(sq[1]);
          files.add(sq[0]!);
        }
        expect(pieceAt(l!.fen, p.crowd)).toEqual({ color: "w", type: p.piece });
        expect(pieceAt(l!.fen, p.boss)).toEqual({ color: "b", type: p.piece });
        const df = Math.abs(p.crowd.charCodeAt(0) - p.boss.charCodeAt(0));
        const dr = Math.abs(Number(p.crowd[1]) - Number(p.boss[1]));
        if (p.piece === "n") expect(df * dr).toBe(2);
        else expect(Math.max(df, dr)).toBeLessThanOrEqual(2);
        // Bishops keep their color.
        if (p.piece === "b") {
          expect(light(p.crowd)).toBe(light(p.crowdFrom));
          expect(light(p.boss)).toBe(light(p.bossFrom));
        }
      }
      // Every duel is a legal capture, nobody is in check; the queens stay where they were.
      for (const d of l!.duels) expect(legalMoves(l!.fen)).toContain(d);
      expect(inCheck(l!.fen)).toBe(false);
      expect(kingAttacked(l!.fen, "b")).toBe(false);
      expect(pieceAt(l!.fen, "d1")).toEqual({ color: "w", type: "q" });
      expect(pieceAt(l!.fen, "d8")).toEqual({ color: "b", type: "q" });
      expect(l!.fen.split(" ")[0]!.replace(/[^pP]/g, "").length).toBe(RUY.split(" ")[0]!.replace(/[^pP]/g, "").length);
    }
    // Anywhere: over most of the board's width, not just its middle.
    expect(files.size).toBeGreaterThanOrEqual(6);
  });

  it("two pairs: the rook pair and a minor's (the seed picks which)", () => {
    const kinds = new Set([...lineups(RUY, 5, 2, 3000)].filter(Boolean).slice(0, 40).map((l) => l!.pairs.map((p) => p.piece).sort().join("")));
    expect([...kinds].sort()).toEqual(["br", "nr"]);
  });

  it("a pair that can't be formed is replaced: a second rook pair, then a second knight pair; else two pairs only", () => {
    // Bishops on different colors (his light one and the crowd's dark one gone): no bishop pair, a second rook pair.
    const noBishops = withoutPiece(withoutPiece(RUY, "c1"), "c8");
    expect(pairSizes(noBishops, "w")).toEqual([3, 2]);
    const a = [...lineups(noBishops, 4, 3, 3000)].filter(Boolean).slice(0, 10);
    expect(a.length).toBeGreaterThan(0);
    for (const l of a) expect(l!.pairs.map((p) => p.piece).sort()).toEqual(["n", "r", "r"]);
    // One rook each too: a second knight pair.
    const oneRook = withoutPiece(withoutPiece(noBishops, "a1"), "a8");
    for (const l of [...lineups(oneRook, 4, 3, 3000)].filter(Boolean).slice(0, 10)) expect(l!.pairs.map((p) => p.piece).sort()).toEqual(["n", "n", "r"]);
    // One knight each as well: two pairs only. Fewer than that: none.
    const twoOnly = withoutPiece(withoutPiece(oneRook, "b1"), "c6");
    expect(pairSizes(twoOnly, "w")).toEqual([2]);
    expect(pairSizes(withoutPiece(withoutPiece(twoOnly, "f3"), "f6"), "w")).toEqual([]);
    // The queens never pair, whatever is left.
    expect(pairSizes("3qk3/8/8/8/8/8/8/3QK3 w - - 0 1", "w")).toEqual([]);
  });

  it("his pieces are always protected", () => {
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
    // A king, a pawn, mismatched kinds, the same square twice, and nonsense.
    expect(checkLineup(RUY, swap(0, "g1"))).toBeNull();
    expect(checkLineup(RUY, swap(0, "a2"))).toBeNull();
    expect(checkLineup(RUY, swap(2, rest[0]!.slice(2, 4)))).toBeNull();
    expect(checkLineup(RUY, "d1d4")).toBeNull();
    expect(checkLineup(RUY, "")).toBeNull();
    expect(checkLineup(RUY, null)).toBeNull();
    // A back rank, and the queens: refused (they'd make a legal line-up otherwise).
    expect(checkLineup("4k3/8/8/2r5/8/2R5/8/4K3 w - - 0 1", "c3c1c5c8 c3c1c5c8", [2])).toBeNull();
    expect(checkLineup("3qk3/2r5/8/8/8/8/2R5/3QK3 w - - 0 1", "d1d4d8d6 c2c3c7c5", [2])).toBeNull();
    // Only the sizes asked for.
    expect(checkLineup(RUY, l0.spec, [2])).toBeNull();
    const two = [...lineups(RUY, 3, 2, 3000)].find(Boolean)!;
    expect(checkLineup(RUY, two.spec, [3])).toBeNull();
    expect(checkLineup(RUY, two.spec, [3, 2])).not.toBeNull();
  });

  it("an unprotected piece of his, a check, or a pinned duel: refused", () => {
    // (Built by hand in an open position: the rooks face off on d4-d5 with nothing guarding his.)
    const open = "4k3/8/8/8/8/8/8/3RK2r w - - 0 1";
    expect(checkLineup(open, "d1d4h1d5", [1, 2, 3])).toBeNull();
  });
});

describe("Wrangler's showdown: Eric's goal", () => {
  const score = (gains: number[], spec = "x", mate = false): LineupScore => ({ spec, duels: gains.length, gains, gain: Math.min(...gains), trap: Math.max(...gains) - Math.min(...gains), mate });
  const [lo, hi] = BOSS_POWERS.showdownEdge;
  const trap = BOSS_POWERS.showdownTrap;

  it("the crowd's best duel gains him showdownEdge pawns, another costs the crowd showdownTrap more, never a mate", () => {
    expect(qualifies(score([0.5, 3, 3]))).toBe(true);
    expect(qualifies(score([lo, lo + trap]))).toBe(true);
    expect(qualifies(score([hi, hi + trap, 0 + hi + trap]))).toBe(true);
    // Too little for him, too much, too small a trap, a mate.
    expect(qualifies(score([lo - 0.05, 3, 3]))).toBe(false);
    expect(qualifies(score([hi + 0.05, 4, 4]))).toBe(false);
    expect(qualifies(score([0.5, 0.5 + trap - 0.1]))).toBe(false);
    expect(qualifies(score([0.5, 3, 3], "x", true))).toBe(false);
    // The crowd's best duel is the smallest gain for him, whatever the order.
    expect(qualifies(score([3, 0.4, 2.5]))).toBe(true);
    // How far one is from it (the test trigger's fallback takes the nearest).
    expect(missBy(score([0.5, 3]))).toBe(0);
    expect(missBy(score([lo - 1, lo - 1 + trap]))).toBeCloseTo(1, 9);
    expect(missBy(score([0.5, 0.5 + trap - 0.5]))).toBeCloseTo(0.5, 9);
    expect(missBy(score([0.5, 3], "x", true))).toBe(Infinity);
  });

  it("of those that qualify, the one nearest showdownTarget first; ties from the seed", () => {
    const list = [score([0.9, 3], "a"), score([0.45, 3], "b"), score([0.2, 3], "c")];
    expect(rankShowdowns(list, 1).map((x) => x.spec)).toEqual(["b", "c", "a"].sort((x, y) => Math.abs(list.find((l) => l.spec === x)!.gain - 0.5) - Math.abs(list.find((l) => l.spec === y)!.gain - 0.5)));
    const tie = [score([0.4, 3], "p"), score([0.6, 3], "q")];
    expect(new Set(Array.from({ length: 16 }, (_, s) => rankShowdowns(tie, s)[0]!.spec)).size).toBe(2);
    expect(rankShowdowns(tie, 5)[0]!.spec).toBe(rankShowdowns(tie, 5)[0]!.spec);
  });

  it("the search finds a line-up meeting it when one exists (the rooks' duel his best, the minors' a disaster): three pairs first", async () => {
    const pick = await showdownFrom([duelEngine()], RUY, 7);
    expect(pick).not.toBeNull();
    expect(pick!.duels).toBe(3);
    expect(checkLineup(RUY, pick!.spec)!.pairs.map((p) => p.piece).sort()).toEqual(["b", "n", "r"]);
    expect(pick!.gain).toBeCloseTo(0.5, 1);
    expect(pick!.outside).toBeUndefined();
    // The same seed and position: the same line-up.
    expect(await showdownFrom([duelEngine()], RUY, 7)).toEqual(pick);
  });

  it("no three-pair line-up qualifies: two pairs, the same rule (Eric: the 2-pair showdown by default)", async () => {
    // (The knights' duel throws the game his way at once: any line-up with knights fails; rook and bishop pairs don't.)
    const pick = await showdownFrom([duelEngine({ n: -3 })], RUY, 7, {}, { ...BOSS_POWERS, showdownTurnMs: 4000 });
    expect(pick).not.toBeNull();
    expect(pick!.duels).toBe(2);
    expect(checkLineup(RUY, pick!.spec, [2])!.pairs.map((p) => p.piece).sort()).toEqual(["b", "r"]);
  });

  it("none qualifying: none for a player; the test trigger gets the nearest, outside the band", async () => {
    const e = duelEngine({ r: -3 });
    const s = { ...BOSS_POWERS, showdownTurnMs: 1500, showdownTestMs: 2500 };
    expect(await showdownFrom([e], RUY, 7, {}, s)).toBeNull();
    const test = await showdownFrom([e], RUY, 7, { test: true }, s);
    expect(test).toMatchObject({ outside: true });
    expect(test!.gain).toBeLessThan(lo);
    expect(checkLineup(RUY, test!.spec, [3, 2])).not.toBeNull();
    // Not even two pairs on the board: nothing to fire, whatever.
    expect(await showdownFrom([e], "3qk3/8/8/8/8/8/8/3QK3 w - - 0 1", 7, { test: true }, s)).toBeNull();
  });

  it("his turn's search in rounds carries its line-ups on: each round scans new ones, none twice (the cause of \"Not yet...\")", async () => {
    // Every line-up promising at the quick scan and none qualifying at the closer look (all level there): round after
    // round, until his time is up. Each scanned line-up's duel positions are recorded.
    const scan = duelEngine();
    const level = valueEngine(() => 0.5);
    const scanned: string[] = [];
    const e: EngineLike = {
      ...scan,
      topMovesAt: async (fen, n, nodes) => {
        if (nodes !== BOSS_POWERS.showdownNodes) return level.topMoves(fen, n);
        scanned.push(fen);
        return scan.topMoves(fen, n);
      },
    };
    expect(await showdownFrom([e], RUY, 7, {}, { ...BOSS_POWERS, showdownTurnMs: 1500 })).toBeNull();
    // Many rounds (three promising a round, three duels each), and no duel position scanned twice.
    expect(scanned.length).toBeGreaterThan(4 * 3 * 3);
    expect(new Set(scanned).size).toBe(scanned.length);
  });

  it("a battle already decided his way: no search (no duel could cost the crowd more), but the admins' trigger still looks", async () => {
    // Past the engine's top score for him everywhere: every duel reads the same, so no line-up can meet the goal.
    const e = valueEngine((fen) => (fen.split(" ")[1] === "b" ? 0.9995 : 0.0005));
    expect(showdownHopeless(5.9)).toBe(false);
    expect(showdownHopeless(6)).toBe(true);
    // His turn: only the position before is searched; the scout the same.
    expect(await showdownFrom([e], RUY, 7)).toBeNull();
    expect(e.searches).toBe(1);
    const scout = new ShowdownScout(async () => e, BOSS_POWERS);
    scout.scout(RUY);
    await scout.idle();
    expect(scout.scanned).toBe(0);
    expect(e.searches).toBe(2);
    expect(await showdownFrom([e], RUY, 7, { test: true }, { ...BOSS_POWERS, showdownTestMs: 800 })).toMatchObject({ outside: true });
  });

  it("the scout: line-ups of both sizes, kept from turn to turn (those that qualified first) and scanned first at his turn if they still hold", async () => {
    const e = duelEngine();
    const scout = new ShowdownScout(async () => e, { ...BOSS_POWERS, showdownSearchMs: 1500 });
    scout.scout(RUY);
    await scout.idle();
    expect(scout.scanned).toBeGreaterThan(0);
    expect(scout.ready(3)).toBeGreaterThan(0);
    expect(scout.ready(2)).toBeGreaterThan(0);
    expect(scout.qualified).toBeGreaterThan(0);
    const carried = scout.carry(3);
    // His move (a quiet one far from the six) keeps them standing: the first carried one is scanned first.
    const after = applyMove(applyMove(RUY, "a2a3"), "h7h6");
    const still = carried.filter((s) => checkLineup(after, s, [3]));
    expect(still.length).toBeGreaterThan(0);
    const r = await searchShowdowns({ engines: [e], fen: after, seed: 1, duels: 3, before: 0, carry: carried, max: 1 });
    expect(r.tried).toBe(1);
    expect(r.found[0]?.spec).toBe(still[0]);
    // On a new position, what no longer qualifies is dropped (here, nothing does: the rooks' duel now a disaster too).
    const worse = new ShowdownScout(async () => duelEngine({ r: 3 }), { ...BOSS_POWERS, showdownSearchMs: 800 });
    worse.scout(RUY);
    await worse.idle();
    expect(worse.ready(3)).toBe(0);
  });
});

describe("Wrangler's showdown in the match", () => {
  /** A raid with the showdown's test switch: his meter full from turn 2, the line-up searched at his turn after the crowd's 2nd move. */
  const showdownRaid = (engine: EngineLike, patch: Partial<Settings> = {}) => raid({ engine, patch: { bossPowerTest: "showdown", ...patch } });
  /** The crowd's move, then (not his turn yet) stop. */
  const crowdOnly = async (r: MatchRunner, move?: string) => {
    r.deal();
    const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
    await r.score(new Map([["h0", { move: move && allowed.includes(move) ? move : [...allowed].sort()[0]!, thinkMs: 1000 }]]));
  };
  const kinds = (r: MatchRunner) => r.boss!.powers!.events.map((e) => e.kind);

  it("his meter: his moves fill it over showdownMeterTurns, nothing else (not a strike, not his material); his line once it's full; the scout from showdownFrom", async () => {
    // (Nothing ever qualifies here: every duel level.)
    const r = raid({ engine: valueEngine(() => 0.5) });
    const fills: (number | null)[] = [];
    const scouts: boolean[] = [];
    for (let t = 1; t <= 8; t++) {
      fills.push(r.bossView()!.powers!.rage);
      scouts.push(!!r.bossView()!.powers!.scout);
      if (t === 2) {
        // The King's strike: nothing on his meter.
        r.deal();
        const before = r.bossView()!.powers!.rage;
        expect(r.callStrike("h0").struck).toBe(true);
        expect(r.bossView()!.powers!.rage).toBe(before);
        await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
        await r.playBoss();
      } else await turn(r);
      expect(kinds(r)).not.toContain("warn");
    }
    const n = BOSS_POWERS.showdownMeterTurns;
    expect(fills).toEqual(Array.from({ length: 8 }, (_, i) => Math.min(1, i / n)));
    expect(scouts).toEqual(Array.from({ length: 8 }, (_, i) => i + 1 >= BOSS_POWERS.showdownFrom || i >= n));
    // Full: "ready" from the crowd turn after his showdownMeterTurns-th move, the same fill all along.
    expect(r.bossView()!.powers!.ready).toBe(0);
    expect(r.boss!.powers!.showdown ?? null).toBeNull();
  }, 60_000);

  it("full, he fires on his first turn where one qualifies: the line-up after his move, no warning; the forced duel; the meter empties and fills again", async () => {
    const r = raid({ engine: duelEngine() });
    const n = BOSS_POWERS.showdownMeterTurns;
    for (let t = 1; t <= n; t++) {
      expect(r.bossAsks()?.showdown).toBeUndefined();
      await turn(r);
      expect(kinds(r)).not.toContain("warn");
    }
    // Full as crowd turn n + 1 begins: at his turn after it, the showdown is asked for and lined up.
    await crowdOnly(r);
    expect(r.bossAsks()).toMatchObject({ showdown: "try" });
    expect(r.bossAsks()!.seed).toBe(lassoSeed(r.boss!.powers!.seed, n + 2));
    await r.playBoss();
    const p = r.boss!.powers!;
    expect(p.ultAt).toBe(n + 2);
    expect(p.showdown).toMatchObject({ turn: n + 2, ply: r.boards.get(0)!.history.length });
    expect(p.events).toContainEqual({ kind: "showdown", turn: n + 2, squares: p.showdown!.pairs.flatMap((x) => [x.crowd, x.boss]) });
    expect(powerMomentMs(p.events)).toBeGreaterThanOrEqual(SHOWDOWN.total);
    const board = r.boards.get(0)!;
    expect(board.bases).toContainEqual({ ply: board.history.length, fen: board.fen });
    expect(p.showdown!.before).toBe(applyMove(fenAtPly(board.history, board.history.length - 1, board.bases), board.history.at(-1)!));
    // The forced duel: only the captures.
    const duels = p.showdown!.pairs.map((x) => x.crowd + x.boss).sort();
    expect([...crowdAllowed(r.boss, board.fen)!].sort()).toEqual(duels);
    expect(powerTurn(r.boss)).toBe(true);
    // Its turn: the meter's spent (the screens show it full as it comes); then it fills again from empty.
    expect(r.bossView()!.powers!.ultAt).toBe(n + 2);
    expect(r.bossView()!.powers!.ready).toBeNull();
    await turn(r, duels[0]);
    expect(r.crowdAllowed()).toBeNull();
    expect(r.bossView()!.powers!.ultAt).toBeNull();
    expect(r.bossView()!.powers!.rage).toBe(1 / n);
    expect(r.boss!.powers!.ults).toBe(1);
  }, 60_000);

  it("full but nothing qualifies: he plays on (no warning, no \"Not yet...\"), his line said once; he fires the moment one does", async () => {
    const gain = { r: -3 };
    const e = valueEngine((fen) => (fen.split(" ")[1] !== "b" ? 0.5 : count(fen, "r") < count(fen, "R") ? forEdge(gain.r) : count(fen, "b") < count(fen, "B") || count(fen, "n") < count(fen, "N") ? forEdge(3) : 0.5));
    const r = showdownRaid(e);
    await turn(r, "e2e4");
    // The test switch: full as turn 2 begins.
    expect(r.bossView()!.powers!.ready).toBe(1 - BOSS_POWERS.showdownMeterTurns);
    for (let t = 0; t < 2; t++) {
      expect(r.bossAsks()?.showdown).toBeUndefined();
      await crowdOnly(r);
      expect(r.bossAsks()?.showdown).toBe("try");
      await r.playBoss();
      expect(r.boss!.powers!.showdown ?? null).toBeNull();
      expect(kinds(r).filter((k) => k === "showdown" || k === "warn")).toEqual([]);
      expect(r.bossView()!.powers!.ready).toBe(1 - BOSS_POWERS.showdownMeterTurns);
    }
    gain.r = 0.5;
    await crowdOnly(r);
    await r.playBoss();
    expect(r.boss!.powers!.showdown?.turn).toBe(r.boss!.powers!.turn);
    expect(kinds(r)).toContain("showdown");
  }, 60_000);

  it("at most showdownMax a battle: then no meter (none shown), and none is asked for", async () => {
    const r = showdownRaid(duelEngine(), { bossMaxMoves: 60 });
    await turn(r, "e2e4");
    let fired = 0;
    for (let t = 0; t < 30 && fired < BOSS_POWERS.showdownMax; t++) {
      await crowdOnly(r);
      await r.playBoss();
      if (r.boss!.powers!.showdown?.turn === r.boss!.powers!.turn) {
        fired++;
        await turn(r, r.crowdAllowed()![0]);
      }
    }
    expect(fired).toBe(BOSS_POWERS.showdownMax);
    expect(r.bossView()!.powers!.rage).toBeNull();
    for (let t = 0; t < BOSS_POWERS.showdownMeterTurns + 2; t++) {
      expect(r.bossAsks()?.showdown).toBeUndefined();
      await turn(r);
    }
    expect(r.bossView()!.powers!.ready).toBeNull();
  }, 120_000);

  it("the admins' test trigger: his meter full at once, fired at his next turn, even outside the band (marked so); with no pairs, a drag stands in", async () => {
    const was = { ...BOSS_POWERS };
    Object.assign(BOSS_POWERS as unknown as Record<string, number>, { showdownTestMs: 2500 });
    try {
      const r = raid({ engine: duelEngine({ r: -3 }) });
      await turn(r, "e2e4");
      await turn(r);
      expect(r.triggerUltimate()).toBe(true);
      expect(r.bossView()!.powers!.rage).toBe(1);
      await crowdOnly(r);
      expect(r.bossAsks()).toMatchObject({ showdown: "test" });
      await r.playBoss();
      const p = r.boss!.powers!;
      expect(p.showdown).toMatchObject({ turn: p.turn, outside: true });
      expect(p.showdown!.edge!).toBeLessThan(BOSS_POWERS.showdownEdge[0]);
      expect(p.ultNext).toBeUndefined();
      expect(r.bossView()!.powers!.showdown!.outside).toBe(true);
      // A player's showdown is never marked outside, even if a host says so.
      const q = raid({ engine: duelEngine() });
      for (let t = 0; t < BOSS_POWERS.showdownMeterTurns; t++) await turn(q);
      await crowdOnly(q);
      const fen = fenOf(q);
      const move = legalMoves(fen).sort()[0]!;
      const l = [...lineups(applyMove(fen, move), 1, 3, 3000)].find(Boolean)!;
      q.applyBossMove(move, false, { showdown: l.spec, outside: true });
      expect(q.boss!.powers!.showdown).toMatchObject({ pairs: l.pairs });
      expect(q.boss!.powers!.showdown!.outside).toBeUndefined();
    } finally {
      Object.assign(BOSS_POWERS as unknown as Record<string, number>, was);
    }
  }, 60_000);

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
   * at 600, no guard): the crowd won it for free. The search scored each duel with his best reply, so that's what he
   * plays. A raid on his brain (Maia at 600) with slips on (every move a stumble), up to the rooks' duel.
   */
  const toRooksDuel = async () => {
    const engine = recaptureEngine();
    const r = showdownRaid(engine, { bossStumbleBelow: 9999, bossStumbleMax: 1 });
    const maia = carelessMaia();
    r.humanBrain = { brain: "maia-raw", rating: 600, engine: maia };
    await turn(r, "e2e4");
    await crowdOnly(r, "g1f3");
    await r.playBoss();
    const sd = r.boss!.powers!.showdown!;
    expect(sd.turn).toBe(3);
    const rooks = sd.pairs.find((p) => p.piece === "r")!;
    await crowdOnly(r, rooks.crowd + rooks.boss);
    return { r, engine, maia, rooks, fen: fenOf(r) };
  };

  it("his reply to the duel is the engine's best (taking back), never his brain's (Maia at 600) or a slip: solo", async () => {
    const { r, engine, maia, rooks, fen } = await toRooksDuel();
    expect(r.bossToMove()).toBe(true);
    expect(engineMoveDue(r.boss!, r.boards.get(0)!)).toBe(true);
    // What the search assumed: his best reply to the rooks' duel takes the rook back.
    const [scored] = await engine.topMovesAt!(fen, 1, BOSS_POWERS.showdownConfirmNodes);
    expect(scored!.move.slice(2, 4)).toBe(rooks.boss);
    // His brain would take another piece, and so would a slip, as before.
    const elo = r.boss!.elo;
    expect(await bossMoveFrom(engine, fen, elo, DEFAULT_SETTINGS.bossNodes, "stumble", Math.random, [5, 15], undefined, null, { brain: "maia-raw", rating: 600, engine: carelessMaia() })).not.toBe(scored!.move);
    expect(await bossMoveFrom(engine, fen, elo, DEFAULT_SETTINGS.bossNodes, "stumble")).not.toBe(scored!.move);
    // He takes it back. Maia isn't asked, and the admins' debug line says whose move it was.
    const asked = maia.asked;
    await r.playBoss();
    expect(r.boards.get(0)!.history.at(-1)).toBe(scored!.move);
    expect(pieceAt(fenOf(r), rooks.boss)?.color).toBe("b");
    expect(maia.asked).toBe(asked);
    expect(r.brainNote).toMatchObject({ brain: "maia-raw", rating: 600, by: "stockfish", why: "power" });
    expect(brainLine(r.brainNote!)).toBe("Maia 600 · no guard · Stockfish's best (power reply)");
  }, 60_000);

  it("after the duel the engine plays his moves while the showdown's tactics are live, up to showdownEngineMoves: a weak brain completes the line", async () => {
    // (His engine's best after the rooks' duel: the crowd's knight first, the rook taken back a move later.)
    const knightsFirst = recaptureEngine("n");
    const r = showdownRaid(knightsFirst, { bossStumbleBelow: 9999, bossStumbleMax: 1 });
    // (A brain that misses every capture: a quiet move each time.)
    const blind = carelessMaia(true);
    r.humanBrain = { brain: "maia-raw", rating: 600, engine: blind };
    await turn(r, "e2e4");
    await crowdOnly(r, "g1f3");
    await r.playBoss();
    const sd = r.boss!.powers!.showdown!;
    const rooks = sd.pairs.find((p) => p.piece === "r")!;
    const knights = sd.pairs.find((p) => p.piece === "n")!;
    await crowdOnly(r, rooks.crowd + rooks.boss);
    const byEngine: boolean[] = [];
    // His reply, then a quiet crowd move (it leaves its rook where his protector can take it), then his next move...
    for (let i = 0; i < BOSS_POWERS.showdownEngineMoves + 1 && !r.isOver(); i++) {
      byEngine.push(r.bossBestReply());
      await r.playBoss();
      if (i === 0) expect(r.boards.get(0)!.history.at(-1)!.slice(2, 4)).toBe(knights.crowd);
      if (i === 1) expect(r.boards.get(0)!.history.at(-1)!.slice(2, 4)).toBe(rooks.boss);
      const quiet = (r.crowdAllowed() ?? legalMoves(fenOf(r))).filter((m) => !pieceAt(fenOf(r), m.slice(2, 4)) && /^[a-h]2[a-h][34]$/.test(m)).sort()[0];
      await crowdOnly(r, quiet);
    }
    // The engine's two captures (his reply, then the rook taken back), his brain's after the tactics are over or the cap.
    expect(byEngine.slice(0, 2)).toEqual([true, true]);
    expect(byEngine.filter(Boolean).length).toBeLessThanOrEqual(BOSS_POWERS.showdownEngineMoves);
    expect(byEngine.at(-1)).toBe(false);
    expect(pieceAt(fenOf(r), rooks.boss)?.color).toBe("b");
  }, 60_000);

  it("only after a duel on the showdown's own turn: not before it, nor after a move the Last Stand took back; the tactics over, his brain", async () => {
    const { r, rooks, fen } = await toRooksDuel();
    const board = r.boards.get(0)!;
    expect(engineMoveDue(r.boss!, board)).toBe(true);
    // A move that isn't a duel from the line-up, or none played yet (the Last Stand took it back): his brain's.
    const sd = r.boss!.powers!.showdown!;
    expect(engineMoveDue(r.boss!, { history: [...board.history.slice(0, -1), "a2a3"], fen: board.fen })).toBe(false);
    expect(engineMoveDue(r.boss!, { history: board.history.slice(0, sd.ply), fen: sd.before })).toBe(false);
    expect(applyMove(fenAtPly(board.history, sd.ply!, board.bases), rooks.crowd + rooks.boss)).toBe(fen);
    // The tactics over (no line-up piece attacked): his brain, even within the cap.
    expect(showdownLive("4k3/8/8/8/8/8/8/R3K3 b - - 0 1", { crowd: ["a1"], boss: [] }, "w")).toBe(false);
    expect(showdownLive("4k3/8/8/8/8/8/4K3/r6R b - - 0 1", { crowd: ["h1"], boss: [] }, "w")).toBe(true);
    expect(showdownLive("4k3/8/8/8/8/8/4K3/r6R b - - 0 1", { crowd: [], boss: ["a1"] }, "w")).toBe(true);
    // Wrangler's rules ask for it, and Moo & Moon's for his Full Moon (moo.test.ts); no other boss's.
    expect(PIG.bestReply!(r.boss!, board)).toBe(true);
    for (const def of BOSS_ROSTER.filter((b) => b.id !== "pig" && b.id !== "moo")) expect(bossRules({ id: def.id })?.bestReply).toBeUndefined();
  }, 60_000);

  it("the King's strike still staggers it (the crowd's own power); the stumble's draw is still made, so nothing else moves", async () => {
    const { r } = await toRooksDuel();
    const draws = vi.spyOn(r, "bossStumbles");
    expect(r.bossMoveKind()).toBe("best");
    expect(draws).toHaveBeenCalledTimes(1);
    r.state = { ...r.state, boss: { ...r.boss!, staggerNext: true } };
    expect(r.bossMoveKind()).toBe("stagger");
  }, 60_000);

  it("the host's path: the server's request (best, no brain) played as net.ts plays it is the reply solo plays", async () => {
    const { r, engine, fen } = await toRooksDuel();
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
