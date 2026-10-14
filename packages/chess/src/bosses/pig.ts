/**
 * Wrangler, the cowboy pig with two lassos (BOSS_ROSTER "pig": Eric's name for him on screen, the code id stays `pig`,
 * since "wrangler" is Cloudflare's CLI in this repo): his rules. Eric's design with the director's calls (DECISIONS.md,
 * "Wrangler, built"). Every power is checked by the engine, so it bends the game and never breaks it.
 *
 * - **The long pull** (his opening): his first move is a center pawn's double step, lassoed one square further: three
 *   squares in one move (e2-e5 or d2-d5 as White; d7-d4 or e7-e4 as Black, after the crowd's first move). The engine
 *   picks the d- or e-pawn; none sound (it would hang the pawn, or its path or square is taken): an ordinary first move.
 * - **The lasso drag** (his passive): every few turns, after his move, he ropes one crowd piece (never the king) and
 *   drags it one square up, down, left or right onto an empty square, picked so it costs the crowd a little by the
 *   engine's measure (BOSS_POWERS.dragLoss); none in the band: none that turn.
 * - **SHOWDOWN!** (his ultimate; Eric, Oct 13: "he checks every turn after three or four moves, and the moment it's
 *   ready he fires it with no warning"): his own meter fills over his first showdownMeterTurns moves ("I've got you in
 *   my sights." as it fills); from then on, on the first of his turns where one qualifies, three pairs (a rook, a
 *   bishop and a knight of the crowd's and his: never queens), or two, are lined up facing each other anywhere off the
 *   back ranks, his always protected, and the crowd's next move must be one of the duels: its piece taking his. The
 *   engine picks a line-up where the best duel still leaves him a little ahead and a wrong one costs the crowd dearly;
 *   it searches from his move showdownFrom, while the crowd thinks, so one is usually ready when the meter fills. His
 *   reply to the duel, and his next moves while its tactics are live, are the engine's at full strength
 *   (engineMoveDue), never his brain's. Then the meter empties and fills again, showdownMax a battle.
 *
 * The engine's part runs where the boss's moves are worked out (the host's device online, this device in solo) and
 * reaches everyone through the shared match state (each change is a base on the board); the server checks every
 * answer against the rules here (dragOptions, checkLineup). Numbers: BOSS_POWERS.pull*, drag*, showdown*. His art and
 * moments are the app's (characters/pig.ts, components/Pig.tsx).
 */
import { BOSS_POWERS, mulberry32, type BossPowerSettings, type BossPowerState, type BossState, type LassoDrag, type ShowdownPair, type ShowdownResult } from "@chessroyale/core";
import type { BoardState } from "../boards.ts";
import { applyMove, gameEnd, legalMoves, pieceAt } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import { logit, other, powerRoll, turnOf, type Battle, type BossAsks, type BossMoveExtras, type BossRules, type Side } from "./base.ts";
import { gridAttackers, gridHanging, gridKingAttacked, gridOf, isLight, placementOf, type Grid } from "./grid.ts";

// ---------------- His moments' beats (ms; the app draws them, the server times by POWER_FX) ----------------

/**
 * The long pull, beat by beat (ms into its moment, after his first move (the double step) shows): his banner; he hops
 * from his corner (`hopAt`, landing beside the pawn at `landAt`); his lasso's loop drops over it (`catchAt`: the art's
 * CATCH point on the pawn) and he hauls it one square further (`tugAt`, the art's `tug` cue: it slides for `slideMs`,
 * him stepping with it); he hops back (`backAt`).
 */
export const PULL = { hopAt: 500, landAt: 1000, catchAt: 1775, tugAt: 2035, slideMs: 420, backAt: 2950, total: 3500 } as const;
/** The lasso drag: the same beats as the pull, on the piece he drags one square. */
export const DRAG = PULL;
/**
 * SHOWDOWN!, beat by beat (ms into its moment, as the crowd's turn begins after his move): "SHOWDOWN!" (his banner);
 * he drops into the middle of the board (`dropAt`, landing at `landAt`), both loops spinning (his wind-up, to its
 * throw at `throwAt`), and leaps back to his corner (there at `cornerAt`); from there his ropes yank the pairs into the
 * line-up one at a time (`pairs`, each sliding for `yankMs`); "DRAW!" with a quick-draw sting (`drawAt`); then the
 * crowd picks its duel.
 */
export const SHOWDOWN = { dropAt: 900, landAt: 1400, throwAt: 2400, cornerAt: 2900, pairs: [3000, 3500, 4000] as readonly number[], yankMs: 420, drawAt: 4600, total: 6000 } as const;
/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const PIG_FX = { pull: PULL.total, drag: DRAG.total, showdown: SHOWDOWN.total } as const;

// ---------------- Shared helpers ----------------

const FILES = "abcdefgh";
const file = (sq: string) => sq.charCodeAt(0) - 97;
const rank = (sq: string) => Number(sq[1]);
const square = (f: number, r: number) => `${FILES[f]}${r}`;
const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 1 && r <= 8;
const mineOf = (c: string, side: Side) => (c === c.toUpperCase()) === (side === "w");

/** A pawn of advantage in log-odds of the engine's expected score (the same measure as Big Boy's bounce). */
const pawnLogit = (s: Pick<BossPowerSettings, "bouncePawnLogit">) => s.bouncePawnLogit;
/** The side to move's edge in pawns from its expected score (0.5: level). */
export const edgeInPawns = (expected: number, s: Pick<BossPowerSettings, "bouncePawnLogit"> = BOSS_POWERS): number => logit(expected) / pawnLogit(s);

/** A seeded random source from a seed and what it's for (the same everywhere). */
const rngFor = (seed: number, ...parts: (string | number)[]) => mulberry32(Math.floor(powerRoll(seed, ...parts) * 2 ** 32));

/**
 * The seed his engine work is ordered by for the crowd turn about to begin: drawn from the battle's seed and the turn,
 * so the host's device (which is sent this, never the battle's seed: that would give every power's choices away) and
 * solo order their candidates alike.
 */
export const lassoSeed = (seed: number, turn: number): number => Math.floor(powerRoll(seed, "lasso", turn) * 2 ** 32) >>> 0;

/** A FEN with a grid's placement, castling rights gone with any rook moved off its corner, en passant cleared. */
function fenWith(fen: string, g: Grid, moved: readonly string[]): string {
  const parts = fen.split(" ");
  parts[0] = placementOf(g);
  const corners: Record<string, string> = { a1: "Q", h1: "K", a8: "q", h8: "k" };
  let castling = parts[2] ?? "-";
  for (const sq of moved) if (corners[sq]) castling = castling.replace(corners[sq]!, "");
  // (A king or rook no longer on its square takes its rights too: the engine refuses a position claiming them.)
  const kept = [...castling].filter((c) => {
    const kingSq = c === "K" || c === "Q" ? "e1" : "e8";
    const rookSq = { K: "h1", Q: "a1", k: "h8", q: "a8" }[c];
    const king = c === c.toUpperCase() ? "K" : "k";
    const rook = c === c.toUpperCase() ? "R" : "r";
    return !!rookSq && g.get(kingSq) === king && g.get(rookSq) === rook;
  });
  parts[2] = kept.join("") || "-";
  parts[3] = "-";
  return parts.join(" ");
}

/** Each position's top move at `nodes`, shared out over the engines (each takes the next position as it's free). */
async function topEach(engines: readonly EngineLike[], fens: readonly string[], nodes: number): Promise<(MoveScore | undefined)[]> {
  const best: (MoveScore | undefined)[] = new Array(fens.length);
  let next = 0;
  await Promise.all(
    engines.map(async (e) => {
      while (next < fens.length) {
        const i = next++;
        best[i] = (await (e.topMovesAt ? e.topMovesAt(fens[i]!, 1, nodes) : e.topMoves(fens[i]!, 1)))[0];
      }
    }),
  );
  return best;
}

/**
 * The side to move's expected score in a position, from its top move; a game already over counts as decided (mated:
 * 0; drawn: a half). Null: no answer.
 */
function moverScore(fen: string, m: MoveScore | undefined): { expected: number; mate?: number } | null {
  if (m) return { expected: m.expected, ...(m.mate !== undefined ? { mate: m.mate } : {}) };
  // (No move: the game is over there, or no answer.)
  const end = gameEnd(fen, []);
  if (end === "checkmate") return { expected: 0, mate: 0 };
  return end ? { expected: 0.5 } : null;
}

// ---------------- The long pull ----------------

/**
 * His long pulls in this position (his first move, him to move): the d- and e-pawn on their starting squares whose
 * double step is legal and whose third square is empty too, written as three-square moves ("e2e5", "d7d4"). Never one
 * that would leave the pawn simply taken (attacked by a crowd pawn, or by more crowd pieces than defend it) or give
 * check. Pure: the server, the host and solo work out the same list.
 */
export function pullOptions(fen: string): string[] {
  const me: Side = fen.split(" ")[1] === "b" ? "b" : "w";
  let legal: string[];
  try {
    legal = legalMoves(fen);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const f of ["d", "e"]) {
    const from = `${f}${me === "w" ? 2 : 7}`;
    const via = `${f}${me === "w" ? 4 : 5}`;
    const to = `${f}${me === "w" ? 5 : 4}`;
    if (!legal.includes(from + via) || pieceAt(fen, to)) continue;
    const after = pullFen(fen, from + to);
    if (!after) continue;
    const g = gridOf(after);
    const them = other(me);
    if (gridKingAttacked(g, them)) continue;
    const attackers = gridAttackers(g, to, them);
    const defenders = gridAttackers(g, to, me);
    if (attackers.some((a) => g.get(a)!.toLowerCase() === "p") || attackers.length > defenders.length) continue;
    out.push(from + to);
  }
  return out;
}

/** The double step a long pull starts with ("e2e5" is "e2e4", then lassoed on). */
export const pullStep = (pull: string): string => `${pull.slice(0, 2)}${pull[0]}${pull[1] === "2" ? 4 : 5}`;

/**
 * The position after a long pull (the crowd to move): his double step, then the pawn one square further (no en passant:
 * it's no longer a double step). Null: not a pull from here.
 */
export function pullFen(fen: string, pull: string): string | null {
  const step = pullStep(pull);
  let after: string;
  try {
    after = applyMove(fen, step);
  } catch {
    return null;
  }
  const g = gridOf(after);
  const pawn = g.get(step.slice(2, 4));
  const to = pull.slice(2, 4);
  if (!pawn || pawn.toLowerCase() !== "p" || g.has(to)) return null;
  g.delete(step.slice(2, 4));
  g.set(to, pawn);
  return fenWith(after, g, []);
}

/**
 * Which long pull he plays (Eric: the engine picks the best center pawn for the position): of the pulls (pullOptions),
 * the one whose position is best for him, as long as it costs him no more than pullMaxLoss pawns against his best
 * ordinary move (else it hangs the pawn: no pull). Each position searched at pullNodes. Null: an ordinary first move.
 */
export async function pullFrom(engine: EngineLike, fen: string, options: readonly string[], s: Pick<BossPowerSettings, "pullMaxLoss" | "pullNodes" | "bouncePawnLogit"> = BOSS_POWERS): Promise<string | null> {
  const ok = options.filter((p) => pullOptions(fen).includes(p));
  if (!ok.length) return null;
  const fens = ok.map((p) => pullFen(fen, p)!);
  const [base, ...after] = await topEach([engine], [fen, ...fens], s.pullNodes);
  const mine = moverScore(fen, base);
  if (!mine) return null;
  const pick = ok
    .map((pull, i) => ({ pull, theirs: moverScore(fens[i]!, after[i]) }))
    .filter((x) => x.theirs && x.theirs.mate === undefined)
    .map((x) => ({ pull: x.pull, his: 1 - x.theirs!.expected }))
    .sort((a, b) => b.his - a.his || (a.pull < b.pull ? -1 : 1))[0];
  if (!pick) return null;
  return (logit(mine.expected) - logit(pick.his)) / pawnLogit(s) <= s.pullMaxLoss + 1e-9 ? pick.pull : null;
}

// ---------------- The lasso drag ----------------

/** One lasso drag: the crowd's piece on `from` dragged to the empty `to` beside it, and the position after (the crowd to move). */
export interface DragOption {
  from: string;
  to: string;
  piece: string;
  fen: string;
}

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * Every lasso drag the rules allow now (`fen`: his move just played, the crowd to move): a crowd piece, never the king
 * nor a bishop (it would change color), one square up, down, left or right onto an empty square, a pawn never onto the first or last
 * rank (so never onto its own back rank), never onto the en passant square; never leaving the crowd in check (a piece
 * dragged out of a pin's line) or his king attacked, and never leaving the crowd without a move. Castling rights go
 * with a rook dragged off its corner. Pure: the server checks the host's drag against it.
 */
export function dragOptions(fen: string, opts: { legal?: boolean } = {}): DragOption[] {
  const crowd: Side = fen.split(" ")[1] === "b" ? "b" : "w";
  const g0 = gridOf(fen);
  const ep = fen.split(" ")[3];
  const out: DragOption[] = [];
  for (const [sq, c] of [...g0].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    // (Never the king; never a bishop either, my call: a square up, down or sideways is a square of the other color,
    // and two bishops on one color is a position no game could reach, as Big Boy's bounce keeps them on theirs.)
    if (!mineOf(c, crowd) || c.toLowerCase() === "k" || c.toLowerCase() === "b") continue;
    for (const [df, dr] of ORTHO) {
      const f = file(sq) + df;
      const r = rank(sq) + dr;
      if (!onBoard(f, r)) continue;
      const to = square(f, r);
      if (g0.has(to) || to === ep) continue;
      if (c.toLowerCase() === "p" && (r === 1 || r === 8)) continue;
      const g = new Map(g0);
      g.delete(sq);
      g.set(to, c);
      if (gridKingAttacked(g, crowd) || gridKingAttacked(g, other(crowd))) continue;
      out.push({ from: sq, to, piece: c.toLowerCase(), fen: fenWith(fen, g, [sq]) });
    }
  }
  if (opts.legal === false) return out;
  return out.filter((d) => {
    try {
      return legalMoves(d.fen).length > 0;
    } catch {
      return false;
    }
  });
}

/** A drag as the server is sent it ("c3c4") is one the rules allow now: its option, or null. */
export function checkDrag(fen: string, drag: string | null | undefined): DragOption | null {
  if (!drag || drag.length !== 4) return null;
  const from = drag.slice(0, 2);
  const to = drag.slice(2, 4);
  return dragOptions(fen, { legal: false }).find((d) => d.from === from && d.to === to && (() => {
    try {
      return legalMoves(d.fen).length > 0;
    } catch {
      return false;
    }
  })()) ?? null;
}

/**
 * The drags worth the engine's look (`seed`: lassoSeed for the turn): the allowed ones (dragOptions) that leave no more
 * of the crowd's material hanging than before (he'd simply take it: far past the band), at most dragCandidates of them
 * (a seeded sample, then in square order).
 */
export function dragCandidates(fen: string, seed: number, s: Pick<BossPowerSettings, "dragCandidates"> = BOSS_POWERS): DragOption[] {
  const crowd: Side = fen.split(" ")[1] === "b" ? "b" : "w";
  const hanging = gridHanging(gridOf(fen), crowd);
  const all = dragOptions(fen, { legal: false }).filter((d) => gridHanging(gridOf(d.fen), crowd) <= hanging);
  const rnd = rngFor(seed, "drag-sample");
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const kept = shuffled.slice(0, s.dragCandidates).filter((d) => {
    try {
      return legalMoves(d.fen).length > 0;
    } catch {
      return false;
    }
  });
  return kept.sort((a, b) => (a.from + a.to < b.from + b.to ? -1 : 1));
}

/** Past this many pawns either way the game counts as decided for a drag (its loss can't be read): none. */
const DRAG_DECIDED = 4;

/** A drag as the engine scored it: the crowd's expected score after it (the crowd to move), and whether its line has a forced mate. */
export interface DragScore {
  drag: string;
  crowd: number;
  mate?: boolean;
}

/**
 * The drag he plays (Eric: "only when it's calculated that it drops you less than a pawn... a slight disadvantage"):
 * from the crowd's expected score before it (`before`, the crowd to move) and each candidate's, the loss in pawns
 * nearest the middle of dragLoss, inside it; ties (to a hundredth of a pawn) from the seed. Never a line with a forced
 * mate. Null: none in the band (no drag this turn).
 */
export function pickDrag(before: number, scored: readonly DragScore[], seed: number, s: Pick<BossPowerSettings, "dragLoss" | "bouncePawnLogit"> = BOSS_POWERS): { drag: string; loss: number } | null {
  const [lo, hi] = s.dragLoss;
  const mid = (lo + hi) / 2;
  const ok = scored
    .filter((d) => !d.mate)
    .map((d) => ({ drag: d.drag, loss: (logit(before) - logit(d.crowd)) / pawnLogit(s) }))
    .filter((d) => d.loss >= lo - 1e-9 && d.loss <= hi + 1e-9)
    .map((d) => ({ ...d, off: Math.round(Math.abs(d.loss - mid) * 100), roll: powerRoll(seed, "drag-tie", d.drag) }));
  const pick = ok.sort((a, b) => a.off - b.off || a.roll - b.roll || (a.drag < b.drag ? -1 : 1))[0];
  return pick ? { drag: pick.drag, loss: Math.round(pick.loss * 100) / 100 } : null;
}

/**
 * The lasso drag, from this device's engines (`fen`: his move just played, the crowd to move; `seed`: lassoSeed): a
 * glance at every candidate (dragScreenNodes), a proper look (dragNodes) at the position before and the dragConfirm
 * nearest the band's middle, then pickDrag. About one of his moves' worth of searching, shared out over the engines.
 * Null: none in the band, or no engine.
 */
export async function dragFrom(
  engines: readonly EngineLike[],
  fen: string,
  seed: number,
  s: Pick<BossPowerSettings, "dragCandidates" | "dragScreenNodes" | "dragConfirm" | "dragNodes" | "dragLoss" | "bouncePawnLogit"> = BOSS_POWERS,
): Promise<{ drag: string; loss: number } | null> {
  const list = dragCandidates(fen, seed, s);
  if (!list.length || !engines.length) return null;
  const glance = await topEach(engines, [fen, ...list.map((d) => d.fen)], s.dragScreenNodes);
  const b0 = moverScore(fen, glance[0]);
  // (A game already decided: the engine's numbers there are pinned near 0 or 1 and a loss can't be read. No drag.)
  if (!b0 || Math.abs(edgeInPawns(b0.expected, s)) > DRAG_DECIDED) return null;
  const mid = (s.dragLoss[0] + s.dragLoss[1]) / 2;
  const near = list
    .map((d, i) => ({ d, m: moverScore(d.fen, glance[i + 1]) }))
    .filter((x) => x.m && x.m.mate === undefined)
    .map((x) => ({ d: x.d, off: Math.abs((logit(b0.expected) - logit(x.m!.expected)) / pawnLogit(s) - mid) }))
    .sort((a, b) => a.off - b.off || (a.d.from + a.d.to < b.d.from + b.d.to ? -1 : 1))
    .slice(0, s.dragConfirm)
    .map((x) => x.d);
  if (!near.length) return null;
  const look = await topEach(engines, [fen, ...near.map((d) => d.fen)], s.dragNodes);
  const before = moverScore(fen, look[0]);
  if (!before) return null;
  const scored: DragScore[] = near.flatMap((d, i) => {
    const m = moverScore(d.fen, look[i + 1]);
    return m ? [{ drag: d.from + d.to, crowd: m.expected, ...(m.mate !== undefined ? { mate: true } : {}) }] : [];
  });
  return pickDrag(before.expected, scored, seed, s);
}

// ---------------- The showdown: its line-ups ----------------

/** A line-up, checked: its pairs, the position after it (the crowd to move), and each duel (the crowd's piece taking his). */
export interface Lineup {
  spec: string;
  pairs: ShowdownPair[];
  fen: string;
  duels: string[];
}

/** Where a line-up stands (Eric, Oct 13: anywhere on the board, off both back ranks): ranks 2-7, any file. */
const inZone = (sq: string) => rank(sq) >= 2 && rank(sq) <= 7;

/** The squares strictly between two squares on a line (none for a knight's jump or neighbors). */
function between(a: string, b: string): string[] {
  const df = file(b) - file(a);
  const dr = rank(b) - rank(a);
  if (!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) return [];
  const n = Math.max(Math.abs(df), Math.abs(dr));
  const out: string[] = [];
  for (let k = 1; k < n; k++) out.push(square(file(a) + Math.sign(df) * k, rank(a) + Math.sign(dr) * k));
  return out;
}

/**
 * Two squares face off for a piece of this kind: a rook on a file or rank, a bishop on a diagonal, a queen on either,
 * with nothing or one square between them; knights a knight's jump apart.
 */
function facing(kind: string, a: string, b: string): boolean {
  const df = Math.abs(file(b) - file(a));
  const dr = Math.abs(rank(b) - rank(a));
  if (kind === "n") return (df === 1 && dr === 2) || (df === 2 && dr === 1);
  const straight = (df === 0) !== (dr === 0);
  const diagonal = df === dr && df > 0;
  const ok = kind === "r" ? straight : kind === "b" ? diagonal : kind === "q" ? straight || diagonal : false;
  return ok && Math.max(df, dr) <= 2;
}

/** A line-up written for the server ("d1d4d8d6 a1c3a8c5 c1e4c8f5": each pair's crowd piece from-to, then his from-to). */
export const lineupSpec = (pairs: readonly ShowdownPair[]): string => pairs.map((p) => `${p.crowdFrom}${p.crowd}${p.bossFrom}${p.boss}`).join(" ");

/**
 * Checks a line-up on the grid after it (the crowd to move): each pair faces off with the squares between them empty,
 * his piece protected by another of his, neither king attacked, and each duel legal (the crowd's piece taking his
 * doesn't leave its king attacked). Null when it holds; else why not.
 */
function lineupFault(g: Grid, pairs: readonly ShowdownPair[], crowd: Side): string | null {
  const boss = other(crowd);
  if (gridKingAttacked(g, crowd) || gridKingAttacked(g, boss)) return "check";
  for (const p of pairs) {
    if (!facing(p.piece, p.crowd, p.boss)) return "facing";
    if (between(p.crowd, p.boss).some((sq) => g.has(sq))) return "blocked";
    if (!gridAttackers(g, p.boss, boss).length) return "unprotected";
    const after = new Map(g);
    after.set(p.boss, after.get(p.crowd)!);
    after.delete(p.crowd);
    if (gridKingAttacked(after, crowd)) return "pinned";
  }
  return null;
}

/**
 * A line-up as written (lineupSpec) checked against the rules in this position (`fen`: his move just played, the crowd
 * to move): 2 or 3 pairs (`duels`), each a crowd piece and one of his of the same kind (a rook, bishop or knight: never
 * a queen, king or pawn; Eric, Oct 13), every square moved to on ranks 2-7 (anywhere off the back ranks), each moved
 * piece's from-square its own and no square used twice, bishops on their own color, each pair facing off with nothing
 * or one empty square between (knights a jump apart), his pieces protected, no check either way, and every duel legal.
 * Returns the checked line-up, or null. Pure: the server checks the host's answer with it.
 */
export function checkLineup(fen: string, spec: string | null | undefined, duels: readonly number[] = [2, 3]): Lineup | null {
  if (!spec) return null;
  const crowd: Side = fen.split(" ")[1] === "b" ? "b" : "w";
  const boss = other(crowd);
  const parts = spec.trim().split(/\s+/);
  if (!duels.includes(parts.length) || parts.some((p) => !/^([a-h][1-8]){4}$/.test(p))) return null;
  const g0 = gridOf(fen);
  const g = new Map(g0);
  const pairs: ShowdownPair[] = [];
  const moved: string[] = [];
  for (const p of parts) {
    const [crowdFrom, crowdTo, bossFrom, bossTo] = [p.slice(0, 2), p.slice(2, 4), p.slice(4, 6), p.slice(6, 8)];
    const c = g0.get(crowdFrom);
    const b = g0.get(bossFrom);
    if (!c || !b || !mineOf(c, crowd) || !mineOf(b, boss)) return null;
    const kind = c.toLowerCase();
    if (kind !== b.toLowerCase() || !"rbn".includes(kind)) return null;
    if (!inZone(crowdTo) || !inZone(bossTo)) return null;
    if (kind === "b" && (isLight(crowdFrom) !== isLight(crowdTo) || isLight(bossFrom) !== isLight(bossTo))) return null;
    pairs.push({ piece: kind, crowd: crowdTo, boss: bossTo, crowdFrom, bossFrom });
    moved.push(crowdFrom, bossFrom);
  }
  // Six different pieces to six different squares: each leaves its square, then each lands on one that's empty by then
  // (another moved piece's square will do; a piece may already stand where it's lined up).
  const targets = pairs.flatMap((pr) => [pr.crowd, pr.boss]);
  if (new Set(moved).size !== moved.length || new Set(targets).size !== targets.length) return null;
  for (const sq of moved) g.delete(sq);
  for (const pr of pairs) {
    if (g.has(pr.crowd) || g.has(pr.boss)) return null;
    g.set(pr.crowd, g0.get(pr.crowdFrom)!);
    g.set(pr.boss, g0.get(pr.bossFrom)!);
  }
  if (lineupFault(g, pairs, crowd)) return null;
  const after = fenWith(fen, g, moved);
  const duelMoves = pairs.map((pr) => pr.crowd + pr.boss);
  try {
    const legal = new Set(legalMoves(after));
    if (!duelMoves.every((m) => legal.has(m))) return null;
  } catch {
    return null;
  }
  return { spec: lineupSpec(pairs), pairs, fen: after, duels: duelMoves };
}

/**
 * The kinds of pair a showdown of `n` duels lines up (Eric, Oct 13: a rook, a bishop and a knight, never queens): the
 * rook pair, then the bishop pair (both on one color) and the knight pair (`minor` first: for two pairs, the seed picks
 * which minor joins the rook), each kind once while there are enough kinds; a pair that can't be formed (bishops on
 * different colors or gone, say) is replaced by a second pair of a kind both sides have two of, rooks first, then
 * knights, then bishops (one pair on each color). Null when there aren't `n` pairs to be had (three can't: try two).
 */
function pairKinds(g: Grid, crowd: Side, n: number, minor: "b" | "n"): string[] | null {
  const count = (side: Side, kind: string, light?: boolean) => [...g].filter(([sq, c]) => mineOf(c, side) && c.toLowerCase() === kind && (light === undefined || isLight(sq) === light)).length;
  const both = (kind: string) => Math.min(count(crowd, kind), count(other(crowd), kind));
  const onLight = Math.min(count(crowd, "b", true), count(other(crowd), "b", true));
  const onDark = Math.min(count(crowd, "b", false), count(other(crowd), "b", false));
  // (Bishop pairs: one on each color at most, a light pair and a dark pair.)
  const have: Record<string, number> = { r: both("r"), b: Math.min(1, onLight) + Math.min(1, onDark), n: both("n") };
  const order = ["r", minor, minor === "b" ? "n" : "b"];
  const kinds = order.filter((k) => have[k]! > 0).slice(0, n);
  for (const k of ["r", "n", "b"]) if (kinds.length < n && have[k]! >= 2) kinds.push(k);
  return kinds.length === n ? kinds : null;
}

/** How many pairs a showdown can line up on this board now: 3, else 2 (pairKinds); [] when not even two. */
export function pairSizes(fen: string, crowd: Side): number[] {
  const g = gridOf(fen);
  const can = (n: number) => !!(pairKinds(g, crowd, n, "b") ?? pairKinds(g, crowd, n, "n"));
  return [3, 2].filter(can);
}

const DIRS: Record<string, readonly (readonly [number, number])[]> = {
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  n: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
};

/**
 * One seeded try at a line-up of `n` pairs, a pair at a time: the crowd's piece of the kind to an empty square anywhere
 * on ranks 2-7 (Eric, Oct 13: anywhere on the board), his facing it.
 */
function lineupTry(fen: string, g0: Grid, crowd: Side, n: number, rnd: () => number): { pairs: ShowdownPair[]; ganged: number } | null {
  const boss = other(crowd);
  const kinds = pairKinds(g0, crowd, n, rnd() < 0.5 ? "b" : "n");
  if (!kinds) return null;
  const g = new Map(g0);
  const pairs: ShowdownPair[] = [];
  const taken = new Set<string>();
  for (const kind of kinds) {
    let placed = false;
    for (let a = 0; a < 40 && !placed; a++) {
      const cf = Math.floor(rnd() * 8);
      const cr = 2 + Math.floor(rnd() * 6);
      const c = square(cf, cr);
      const dirs = DIRS[kind]!;
      const [df, dr] = dirs[Math.floor(rnd() * dirs.length)]!;
      const k = kind === "n" ? 1 : rnd() < 0.6 ? 1 : 2;
      if (!onBoard(cf + df * k, cr + dr * k)) continue;
      const h = square(cf + df * k, cr + dr * k);
      if (!inZone(c) || !inZone(h) || g.has(c) || g.has(h) || taken.has(c) || taken.has(h)) continue;
      if (between(c, h).some((sq) => g.has(sq) || taken.has(sq))) continue;
      const pick = (side: Side, at: string) => {
        const options = [...g0].filter(([sq, p]) => mineOf(p, side) && p.toLowerCase() === kind && g.get(sq) === p && !taken.has(sq) && (kind !== "b" || isLight(sq) === isLight(at))).map(([sq]) => sq).sort();
        return options.length ? options[Math.floor(rnd() * options.length)]! : null;
      };
      const cFrom = pick(crowd, c);
      const hFrom = pick(boss, h);
      if (!cFrom || !hFrom) continue;
      const cp = g.get(cFrom)!;
      const hp = g.get(hFrom)!;
      g.delete(cFrom);
      g.delete(hFrom);
      g.set(c, cp);
      g.set(h, hp);
      for (const sq of [c, h, cFrom, hFrom, ...between(c, h)]) taken.add(sq);
      pairs.push({ piece: kind, crowd: c, boss: h, crowdFrom: cFrom, bossFrom: hFrom });
      placed = true;
    }
    if (!placed) return null;
  }
  // (Quick checks on the grid first; checkLineup has the last word.)
  return lineupFault(g, pairs, crowd) ? null : { pairs, ganged: ganged(g, pairs, crowd) };
}

/**
 * How many of his line-up pieces two or more of the crowd's pieces attack. Measured over 1,200 line-ups in 8 middlegames
 * (DECISIONS.md, "Wrangler, built"): with at most one such, 11% met Eric's goal; with two or three, 3%. So the search
 * looks at those first (lineups).
 */
function ganged(g: Grid, pairs: readonly ShowdownPair[], crowd: Side): number {
  return pairs.filter((p) => gridAttackers(g, p.boss, crowd).length >= 2).length;
}

/**
 * The line-ups worth the engine's look in this position (`fen`: the crowd to move), from a seed: plausible ones only
 * (each checked: checkLineup), each once, in the order found. Lazy, and it yields null after each try that came to
 * nothing, so a search can take only as many as it has time for and let the page draw between tries (searchShowdowns);
 * at most `tries` tries in all.
 */
export function* lineups(fen: string, seed: number, n: number, tries = 3000): Generator<Lineup | null> {
  const crowd: Side = fen.split(" ")[1] === "b" ? "b" : "w";
  const g0 = gridOf(fen);
  if (!pairKinds(g0, crowd, n, "b") && !pairKinds(g0, crowd, n, "n")) return;
  const seen = new Set<string>();
  const rnd = rngFor(seed, "showdown", n);
  // (Those with at most one of his pieces ganged up on, while they come at all; then any.)
  let picky = true;
  let since = 0;
  for (let a = 0; a < tries; a++) {
    const t = lineupTry(fen, g0, crowd, n, rnd);
    const key = t ? [...t.pairs.map((p) => `${p.crowdFrom}${p.crowd}${p.bossFrom}${p.boss}`)].sort().join(" ") : "";
    const fits = !!t && !seen.has(key) && (!picky || t.ganged <= 1);
    const lineup = fits ? checkLineup(fen, lineupSpec(t!.pairs), [n]) : null;
    if (t && fits) seen.add(key);
    if (lineup) since = 0;
    else if (picky && ++since >= PICKY_TRIES) picky = false;
    yield lineup;
  }
}
/** Tries without a line-up that suits before the search takes any (lineups). */
const PICKY_TRIES = 1000;

// ---------------- The showdown: the engine's judgment ----------------

/**
 * A line-up as the engine scored it: his edge in pawns after each duel (him to move, against the position before the
 * line-up: what the showdown gains him), the crowd's best duel's (the smallest), how much more the worst one costs the
 * crowd, and whether he has a forced mate after the best one.
 */
export interface LineupScore {
  spec: string;
  duels: number;
  gains: number[];
  gain: number;
  trap: number;
  mate: boolean;
}

type ShowdownSettings = Pick<BossPowerSettings, "showdownEdge" | "showdownTarget" | "showdownTrap" | "showdownNodes" | "showdownConfirmNodes" | "showdownSetups" | "bouncePawnLogit">;

/**
 * Scores line-ups on the engines (one search per duel at `nodes`, shared out), against his edge before the line-up
 * (`before`, in pawns). Null for one the engine had no answer for.
 */
async function scoreLineups(engines: readonly EngineLike[], list: readonly Lineup[], before: number, nodes: number, s: ShowdownSettings): Promise<(LineupScore | null)[]> {
  const fens = list.flatMap((l) => l.duels.map((d) => applyMove(l.fen, d)));
  const tops = await topEach(engines, fens, nodes);
  let i = 0;
  return list.map((l) => {
    const each = l.duels.map(() => {
      const k = i++;
      const sc = moverScore(fens[k]!, tops[k]);
      return sc ? { gain: edgeInPawns(sc.expected, s) - before, mate: sc.mate !== undefined && sc.mate > 0 } : null;
    });
    if (each.some((e) => !e)) return null;
    const gains = each.map((e) => Math.round(e!.gain * 100) / 100);
    const best = Math.min(...gains);
    return { spec: l.spec, duels: l.duels.length, gains, gain: best, trap: Math.round((Math.max(...gains) - best) * 100) / 100, mate: each[gains.indexOf(best)]!.mate };
  });
}

/**
 * A scored line-up meets Eric's goal: the crowd's best duel still gains him showdownEdge pawns over the position before
 * the line-up (my reading of "leaves him slightly ahead": in a level game, as the director's tests were, the same; in a
 * lopsided one an edge measured from level could never be met), another duel costs the crowd showdownTrap more, and he
 * has no forced mate after the best one.
 */
export const qualifies = (x: LineupScore, s: Pick<BossPowerSettings, "showdownEdge" | "showdownTrap"> = BOSS_POWERS): boolean =>
  !x.mate && x.gain >= s.showdownEdge[0] - 1e-9 && x.gain <= s.showdownEdge[1] + 1e-9 && x.trap >= s.showdownTrap - 1e-9;

/**
 * Worth a closer look: near enough the goal at the quick scan's budget (it reads a little rough) that the closer look
 * (showdownConfirmNodes) may find it qualifies.
 */
export const promising = (x: LineupScore, s: Pick<BossPowerSettings, "showdownEdge" | "showdownTrap"> = BOSS_POWERS): boolean =>
  x.gain >= s.showdownEdge[0] - SCAN_SLACK.below && x.gain <= s.showdownEdge[1] + SCAN_SLACK.above && x.trap >= s.showdownTrap - SCAN_SLACK.trap;
/** How far outside the goal a quick scan's numbers may be and still be looked at closely (pawns; measured: none missed). */
const SCAN_SLACK = { below: 0.6, above: 1, trap: 1 } as const;

/**
 * How far a scored line-up is from Eric's goal, in pawns (0: inside the band with the trap; a forced mate for him:
 * never). The test trigger's fallback takes the nearest when none qualifies.
 */
export const missBy = (x: LineupScore, s: Pick<BossPowerSettings, "showdownEdge" | "showdownTrap"> = BOSS_POWERS): number =>
  x.mate ? Infinity : Math.max(0, s.showdownEdge[0] - x.gain, x.gain - s.showdownEdge[1]) + Math.max(0, s.showdownTrap - x.trap);

/** The order he takes line-ups in: nearest showdownTarget, ties from the seed. */
export function rankShowdowns(scored: readonly LineupScore[], seed: number, s: Pick<BossPowerSettings, "showdownTarget"> = BOSS_POWERS): LineupScore[] {
  return scored
    .map((x) => ({ x, off: Math.round(Math.abs(x.gain - s.showdownTarget) * 100), roll: powerRoll(seed, "showdown-tie", x.spec) }))
    .sort((a, b) => a.off - b.off || a.roll - b.roll || (a.x.spec < b.x.spec ? -1 : 1))
    .map(({ x }) => x);
}

/** The side to move has a mate in one. */
function mateInOne(fen: string): boolean {
  try {
    return legalMoves(fen).some((m) => gameEnd(applyMove(fen, m), []) === "checkmate");
  } catch {
    return false;
  }
}

/** His edge in pawns in a position with the crowd to move (one search at `nodes`). Null: no answer. */
async function edgeBefore(engines: readonly EngineLike[], fen: string, nodes: number, s: ShowdownSettings): Promise<number | null> {
  const [m] = await topEach(engines.slice(0, 1), [fen], nodes);
  const sc = moverScore(fen, m);
  return sc ? -edgeInPawns(sc.expected, s) : null;
}

/** How long the line-up tries may run on the page's thread before it draws a frame (ms). */
const SLICE_MS = 6;

export interface ShowdownSearch {
  /** The engines to search on (shared out). */
  engines: readonly EngineLike[];
  /** The position (the crowd to move: his move just played, or the crowd's turn while it thinks). */
  fen: string;
  /** Orders the line-ups tried (lassoSeed for the turn, or any number while scouting). */
  seed: number;
  /** How many pairs. */
  duels: number;
  /** His edge before the line-up, in pawns (edgeBefore). */
  before: number;
  /** Line-ups found earlier (written as lineupSpec), tried first if they still hold here. */
  carry?: readonly string[];
  /** Stop starting new line-ups at this time (`now()`), or after `max` of them (showdownSetups). */
  deadline?: number;
  max?: number;
  now?: () => number;
  /** Stop once this many promising ones are found (0: never early). */
  enough?: number;
  /** Stops it from outside (a scout's turn is over). */
  stopped?: () => boolean;
  /** Each line-up as the quick scan scored it (the test trigger keeps the nearest to the goal). */
  onScored?: (x: LineupScore) => void;
  /** The fresh line-ups to draw from (a search in rounds carries on from where it stopped); else lineups() from the seed. */
  fresh?: Generator<Lineup | null>;
}

/**
 * The quick scan: line-ups for a showdown of `duels` pairs, the carried ones that still hold first, then fresh ones from
 * the seed, each scored by the engine (one search per duel at showdownNodes), a round of as many as there are engines
 * at a time, until the deadline, `max` line-ups or `enough` promising ones. Returns the promising ones in the order
 * he'd take them (rankShowdowns), and how many were tried.
 */
export async function searchShowdowns(q: ShowdownSearch, s: ShowdownSettings = BOSS_POWERS): Promise<{ found: LineupScore[]; tried: number }> {
  const now = q.now ?? (() => performance.now());
  const max = q.max ?? s.showdownSetups;
  const carried = (q.carry ?? []).map((spec) => checkLineup(q.fen, spec, [q.duels])).filter((l): l is Lineup => !!l);
  const fresh = q.fresh ?? lineups(q.fen, q.seed, q.duels);
  const seen = new Set<string>();
  // (The tries run on the page's own thread: after SLICE_MS of them it lets the page draw a frame before going on.)
  let sliceFrom = now();
  const nextLineup = async (): Promise<Lineup | null> => {
    while (carried.length) {
      const l = carried.shift()!;
      if (!seen.has(l.spec)) return (seen.add(l.spec), l);
    }
    for (let r = fresh.next(); !r.done; r = fresh.next()) {
      if (now() - sliceFrom > SLICE_MS) {
        await new Promise((res) => setTimeout(res, 0));
        sliceFrom = now();
        if (q.stopped?.()) return null;
      }
      if (r.value && !seen.has(r.value.spec)) return (seen.add(r.value.spec), r.value);
    }
    return null;
  };
  const found: LineupScore[] = [];
  let tried = 0;
  const per = Math.max(1, q.engines.length);
  while (tried < max && (q.deadline === undefined || now() < q.deadline) && !q.stopped?.()) {
    const batch: Lineup[] = [];
    while (batch.length < per && tried + batch.length < max) {
      const l = await nextLineup();
      if (!l) break;
      batch.push(l);
    }
    if (!batch.length) break;
    tried += batch.length;
    const scored = await scoreLineups(q.engines, batch, q.before, s.showdownNodes, s);
    for (const x of scored) if (x) q.onScored?.(x);
    for (const x of scored) if (x && promising(x, s)) found.push(x);
    if (q.enough && found.length >= q.enough) break;
  }
  return { found: rankShowdowns(found, q.seed, s), tried };
}

/**
 * The closer look: the promising line-ups in turn, each scored again at showdownConfirmNodes and checked for a mate in
 * one for him after the crowd's best duel; the first that qualifies (Eric's goal), or null. At most `tries`, and none
 * started after `deadline`.
 */
export async function confirmShowdown(
  engines: readonly EngineLike[],
  fen: string,
  before: number,
  found: readonly LineupScore[],
  s: ShowdownSettings = BOSS_POWERS,
  opts: { tries?: number; deadline?: number; now?: () => number; all?: boolean; onConfirmed?: (x: LineupScore, ok: boolean) => void } = {},
): Promise<ShowdownPick | null> {
  const now = opts.now ?? (() => performance.now());
  let first: ShowdownPick | null = null;
  for (const x of found.slice(0, opts.tries ?? 4)) {
    if (opts.deadline !== undefined && now() >= opts.deadline) break;
    const l = checkLineup(fen, x.spec, [x.duels]);
    if (!l) continue;
    const [again] = await scoreLineups(engines, [l], before, s.showdownConfirmNodes, s);
    if (!again) continue;
    const ok = qualifies(again, s) && !mateInOne(applyMove(l.fen, l.duels[again.gains.indexOf(again.gain)]!));
    opts.onConfirmed?.(again, ok);
    if (!ok) continue;
    first ??= { spec: l.spec, gain: again.gain, duels: again.duels };
    // (`all`: every one confirmed, as the scout keeps them; else the first that qualifies.)
    if (!opts.all) break;
  }
  return first;
}

/** A showdown he can line up: its line-up (lineupSpec), his edge after the crowd's best duel, and its size. */
export interface ShowdownPick {
  spec: string;
  gain: number;
  duels: number;
  /** The test trigger's line-up outside the band (none inside it found). */
  outside?: true;
}

/**
 * The scout (Eric, Oct 13: "he checks every turn after three or four moves"): on each crowd turn a showdown may follow
 * (from his move showdownFrom, while he has one left), it searches the position then, in the background on an engine of
 * its own, for up to showdownSearchMs: three pairs, then two, the line-ups it kept from earlier turns first (checked
 * again on the new position: dropped once they no longer hold or look promising), then fresh ones; the promising ones
 * are confirmed, and it keeps the best (those that qualify first). His move changes the position, so at his turn the
 * kept ones are checked again on the new one first (showdownFrom). One per device that works out the boss's moves.
 */
export class ShowdownScout {
  private kept = new Map<number, { spec: string; off: number; ok: boolean }[]>();
  private running: { fen: string; stop: boolean } | null = null;
  private busy: Promise<unknown> = Promise.resolve();
  /** How many line-ups it has scanned, and how many it confirmed as qualifying (tests, the sims, the admins' notes). */
  scanned = 0;
  qualified = 0;

  constructor(
    private readonly engine: () => Promise<EngineLike | null>,
    private readonly s: ShowdownSettings & Pick<BossPowerSettings, "showdownSearchMs"> = BOSS_POWERS,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** Scouts this position (the crowd to move) for showdowns of these sizes, until showdownSearchMs or stop(). Once per position. */
  scout(fen: string, sizes: readonly number[] = [3, 2]): void {
    if (this.running?.fen === fen) return;
    this.stop();
    const run = { fen, stop: false };
    this.running = run;
    const seed = Math.floor(powerRoll(0x5c0, fen) * 2 ** 32);
    this.busy = this.busy.then(async () => {
      if (run.stop) return;
      const engine = await this.engine().catch(() => null);
      if (!engine || run.stop) return;
      const deadline = this.now() + this.s.showdownSearchMs;
      const before = await edgeBefore([engine], fen, this.s.showdownConfirmNodes, this.s).catch(() => null);
      if (before === null) return;
      const can = sizes.filter((n) => pairSizes(fen, fen.split(" ")[1] === "b" ? "b" : "w").includes(n));
      for (const [i, n] of can.entries()) {
        if (run.stop) return;
        // (Three pairs the larger share; each size's scan leaves a third of its time for the closer looks.)
        const share = i === can.length - 1 ? deadline : this.now() + (deadline - this.now()) * 0.6;
        const scanUntil = this.now() + (share - this.now()) * 0.65;
        const r = await searchShowdowns({ engines: [engine], fen, seed, duels: n, before, carry: this.carry(n), deadline: scanUntil, max: 10_000, now: this.now, stopped: () => run.stop }, this.s).catch(() => ({ found: [] as LineupScore[], tried: 0 }));
        this.scanned += r.tried;
        const ok = new Set<string>();
        await confirmShowdown([engine], fen, before, r.found, this.s, { tries: 6, deadline: share, now: this.now, all: true, onConfirmed: (x, good) => void (good && ok.add(x.spec)) }).catch(() => null);
        if (run.stop) return;
        this.qualified += ok.size;
        this.keep(n, r.found, ok);
      }
    });
  }

  /** Stops scouting (his turn has come, or the battle moved on). What it found is kept. */
  stop(): void {
    if (this.running) this.running.stop = true;
    this.running = null;
  }

  /** Forgets everything (a new battle). */
  reset(): void {
    this.stop();
    this.kept.clear();
    this.scanned = 0;
    this.qualified = 0;
  }

  /** This position's promising line-ups of a size replace the last (a kept one not among them no longer holds). */
  private keep(n: number, found: readonly LineupScore[], ok: ReadonlySet<string>): void {
    this.kept.set(n, found.map((x) => ({ spec: x.spec, off: Math.abs(x.gain - this.s.showdownTarget), ok: ok.has(x.spec) })).slice(0, 24));
  }

  /** The line-ups kept of a size, those that qualified first, then nearest the target. */
  carry(duels: number): string[] {
    return [...(this.kept.get(duels) ?? [])].sort((a, b) => Number(b.ok) - Number(a.ok) || a.off - b.off).map((x) => x.spec);
  }

  /** How many kept line-ups of a size qualified where they were confirmed. */
  ready(duels: number): number {
    return (this.kept.get(duels) ?? []).filter((x) => x.ok).length;
  }

  /** Waits for the scouting under way to wind down (its current line-up's searches), after stop(). */
  async idle(): Promise<void> {
    await this.busy.catch(() => undefined);
  }
}

/**
 * The showdown at his turn (`fen`: his move just played, the crowd to move; `seed`: lassoSeed): three pairs, then two
 * (Eric, Oct 13: two whenever no three-pair line-up qualifies), each the scout's kept line-ups that still hold first,
 * then fresh ones, scanned and the promising ones confirmed, until one qualifies or showdownTurnMs is up (three pairs
 * the first 60% of it, unless three can't be had). The test trigger (`test`): up to showdownTestMs, and none qualifying,
 * the line-up nearest the goal it saw (marked `outside`). Null: none.
 */
export async function showdownFrom(
  engines: readonly EngineLike[],
  fen: string,
  seed: number,
  opts: { scout?: ShowdownScout | null; test?: boolean } = {},
  s: ShowdownSettings & Pick<BossPowerSettings, "showdownTurnMs" | "showdownTestMs"> = BOSS_POWERS,
  now: () => number = () => performance.now(),
): Promise<ShowdownPick | null> {
  if (!engines.length) return null;
  const scout = opts.scout ?? null;
  scout?.stop();
  await scout?.idle();
  const sizes = pairSizes(fen, fen.split(" ")[1] === "b" ? "b" : "w");
  if (!sizes.length) return null;
  const before = await edgeBefore(engines, fen, s.showdownConfirmNodes, s);
  if (before === null) return null;
  const end = now() + (opts.test ? s.showdownTestMs : s.showdownTurnMs);
  // (The test trigger keeps the line-up nearest the goal it sees, in case none qualifies.)
  const near: { x: LineupScore | null } = { x: null };
  const onScored = opts.test ? (x: LineupScore) => void (missBy(x, s) < (near.x ? missBy(near.x, s) : Infinity) && (near.x = x)) : undefined;
  for (const [i, n] of sizes.entries()) {
    const deadline = i === 0 && sizes.length > 1 ? now() + (end - now()) * 0.6 : end;
    let carry = scout?.carry(n) ?? [];
    let budget = opts.test ? 10_000 : s.showdownSetups;
    const tried = new Set<string>();
    // (One run of fresh line-ups for the size, carried on round after round: none scanned twice.)
    const fresh = lineups(fen, seed, n);
    while (budget > 0 && now() < deadline) {
      const r = await searchShowdowns({ engines, fen, seed, duels: n, before, carry, deadline, max: budget, now, enough: 3, fresh, ...(onScored ? { onScored } : {}) }, s);
      budget -= r.tried;
      carry = [];
      const found = r.found.filter((x) => !tried.has(x.spec));
      for (const x of found) tried.add(x.spec);
      const pick = await confirmShowdown(engines, fen, before, found, s, { tries: 3, deadline: deadline + 1500, now, ...(onScored ? { onConfirmed: (x: LineupScore) => onScored(x) } : {}) });
      if (pick) return pick;
      if (!r.tried) break;
    }
  }
  const x = near.x;
  const l = x ? checkLineup(fen, x.spec, [x.duels]) : null;
  if (!x || !l) return null;
  // (Outside the band, for the admins' test: scored again closely for the edge it reports.)
  const [again] = await scoreLineups(engines, [l], before, s.showdownConfirmNodes, s);
  return { spec: l.spec, gain: again?.gain ?? x.gain, duels: l.duels.length, outside: true };
}

// ---------------- His turn: what it must work out besides his move ----------------

/**
 * What his turn must work out besides his move (the server's request to the host; solo's turn): his long pulls (his
 * first move), then the showdown after his move while his meter is full ("try"; "test": the admins' trigger, the best
 * line-up even outside the band, or a drag standing in when the board can't hold one), and a lasso drag after it when
 * one is due and no showdown comes. `seed`: lassoSeed for the crowd turn after his move.
 */
export type PigAsk = BossAsks;

/**
 * His answer: his move (a long pull is written as its three squares), and the showdown or the drag after it ("" none);
 * `edge`: what the showdown gains him at the crowd's best duel, as this device's engine put it (pawns); `outside`: the
 * test trigger's line-up outside the band.
 */
export interface PigAnswer {
  move: string;
  drag?: string;
  showdown?: string;
  edge?: number;
  outside?: boolean;
}

/**
 * His turn on this device's engines (the host's, or solo's): the long pull if one is sound (pullFrom), else his
 * ordinary move (`move`), then on the position after it the showdown (showdownFrom: the scout's line-ups first), and
 * when none comes the drag (dragFrom), if one is due or (the test trigger) to stand in for it.
 */
export async function pigTurn(engines: readonly EngineLike[], fen: string, ask: PigAsk, move: () => Promise<string>, scout: ShowdownScout | null = null): Promise<PigAnswer> {
  if (ask.pull?.length && engines[0]) {
    const pull = await pullFrom(engines[0], fen, ask.pull).catch(() => null);
    if (pull) return { move: pull };
  }
  const m = await move();
  let after: string;
  try {
    after = applyMove(fen, m);
  } catch {
    return { move: m };
  }
  const test = ask.showdown === "test";
  if (ask.showdown) {
    const pick = await showdownFrom(engines, after, ask.seed, { scout, test }).catch(() => null);
    if (pick) return { move: m, showdown: pick.spec, edge: pick.gain, ...(pick.outside ? { outside: true } : {}) };
  }
  const drag = ask.drag || test ? ((await dragFrom(engines, after, ask.seed).catch(() => null))?.drag ?? "") : undefined;
  return { move: m, ...(ask.showdown ? { showdown: "" } : {}), ...(drag !== undefined ? { drag } : {}) };
}

// ---------------- His meter (Eric, Oct 13) ----------------

/**
 * His meter as crowd turn `turn` is picked (0-1; his own, nothing else adds to it): his moves since it last emptied, of
 * showdownMeterTurns, so the first showdown can come once both sides have made that many moves. Full while the test
 * trigger is pulled. Null once he has had showdownMax: no more this battle (the screens hide it).
 */
export function showdownMeter(p: Pick<BossPowerState, "sdBase" | "ults" | "ultNext">, turn: number, s: Pick<BossPowerSettings, "showdownMeterTurns" | "showdownMax"> = BOSS_POWERS): number | null {
  if (p.ultNext) return 1;
  if ((p.ults ?? 0) >= s.showdownMax) return null;
  return Math.max(0, Math.min(1, (turn - 1 - (p.sdBase ?? 0)) / s.showdownMeterTurns));
}

/** His meter is full and he's waiting to fire (none under way): the fill (its sdBase), for his line and his ready loop; else null. */
export const showdownReady = (p: Pick<BossPowerState, "sdBase" | "ults" | "ultNext" | "ultAt" | "turn">, s: Pick<BossPowerSettings, "showdownMeterTurns" | "showdownMax"> = BOSS_POWERS): number | null =>
  p.ultAt === undefined && (showdownMeter(p, p.turn, s) ?? 0) >= 1 ? (p.sdBase ?? 0) : null;

/**
 * The scout searches while crowd turn `turn` is picked (a showdown may follow before long): from showdownFrom (or once
 * his meter is full), while he has one left and none is under way.
 */
export const showdownScouting = (p: Pick<BossPowerState, "sdBase" | "ults" | "ultNext" | "ultAt">, turn: number, s: Pick<BossPowerSettings, "showdownMeterTurns" | "showdownMax" | "showdownFrom"> = BOSS_POWERS): boolean => {
  const m = showdownMeter(p, turn, s);
  return m !== null && p.ultAt === undefined && (turn >= s.showdownFrom || m >= 1);
};

/**
 * His showdown may come after his move now (`boss`: him to move): "try" with his meter full as the crowd's last turn
 * was picked, "test" with the admins' trigger pulled; null: not now (none under way, he has one left).
 */
export const showdownDue = (boss: BossState | null | undefined): "try" | "test" | null => {
  const p = boss?.powers;
  if (!p || boss!.result || boss!.id !== "pig" || p.ultAt !== undefined) return null;
  if (p.ultNext) return "test";
  return (showdownMeter(p, p.turn) ?? 0) >= 1 ? "try" : null;
};

// ---------------- The rules ----------------

/** His first move is still to come (the long pull's chance). */
const firstMoveDue = (boss: Pick<BossState, "powers">): boolean => boss.powers?.pull === undefined;

/** A lasso drag comes after his move (the crowd turn it sets up is due one), if no showdown does. */
export const dragDue = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  return !!p && !boss!.result && boss!.id === "pig" && !firstMoveDue(boss!) && turnOf(boss!) >= p.nextPassive;
};

/** The drag (or the test trigger's stand-in drag) set up the crowd turn now being picked. */
const dragNow = (boss: BossState): LassoDrag | null => (boss.powers?.drag?.turn === turnOf(boss) ? boss.powers.drag : null);
/** The showdown whose duel the crowd must play now. */
export const showdownNow = (boss: Pick<BossState, "powers" | "crowdMoves"> | null | undefined): ShowdownResult | null =>
  boss?.powers?.showdown && boss.powers.showdown.turn === turnOf(boss) ? boss.powers.showdown : null;

/** The duel moves of a showdown (the crowd's piece taking his, pair by pair). */
export const duelMovesOf = (sd: Pick<ShowdownResult, "pairs">): string[] => sd.pairs.map((p) => p.crowd + p.boss);

/**
 * The line-up's pieces still on the board after the moves played since it went on (`moves`: the crowd's duel first,
 * then his reply, and so on): each side's squares, each piece followed as it moves, gone once taken.
 */
export function lineupSquares(sd: Pick<ShowdownResult, "pairs">, moves: readonly string[]): { crowd: string[]; boss: string[] } {
  let crowd = sd.pairs.map((p) => p.crowd);
  let boss = sd.pairs.map((p) => p.boss);
  moves.forEach((m, i) => {
    const from = m.slice(0, 2);
    const to = m.slice(2, 4);
    if (i % 2 === 0) {
      crowd = crowd.map((q) => (q === from ? to : q));
      boss = boss.filter((q) => q !== to);
    } else {
      boss = boss.map((q) => (q === from ? to : q));
      crowd = crowd.filter((q) => q !== to);
    }
  });
  return { crowd, boss };
}

/**
 * The showdown's tactics are still live (`fen`: him to move): a line-up piece of either side is still attacked by a
 * piece of the other, so a capture inside the line-up is still on (his engine line's next capture is one of these).
 */
export function showdownLive(fen: string, sq: { crowd: readonly string[]; boss: readonly string[] }, crowd: Side): boolean {
  const g = gridOf(fen);
  return sq.crowd.some((x) => gridAttackers(g, x, other(crowd)).length > 0) || sq.boss.some((x) => gridAttackers(g, x, crowd).length > 0);
}

/**
 * His move now is the engine's at full strength (BossRules.bestReply): the showdown's duel was played (a duel the God
 * King's Last Stand took back isn't on the board: it waits for the one that is), and this is his reply to it (the
 * search scored every line-up with it), or one of his next moves while the showdown's tactics are still live
 * (showdownLive: his best reply can be another capture first, the piece taken back a move later), up to
 * showdownEngineMoves in all (Eric, Oct 13: on his brain, Maia at 600, he once took another piece instead of taking
 * back, and the crowd won his queen for free). Then his brain again.
 */
export function engineMoveDue(boss: Pick<BossState, "powers" | "crowdMoves" | "crowdSide">, board: Pick<BoardState, "history" | "fen">, s: Pick<BossPowerSettings, "showdownEngineMoves"> = BOSS_POWERS): boolean {
  const sd = boss.powers?.showdown;
  if (!sd) return false;
  if (sd.ply === undefined) {
    // (A showdown from before its ply was kept: his reply to its duel only.)
    const last = board.history.at(-1)?.slice(0, 4);
    return sd.turn === boss.crowdMoves && !!last && duelMovesOf(sd).includes(last);
  }
  const since = board.history.slice(sd.ply);
  // (The crowd's duel, then a reply of his after each crowd move: him to move after an odd count.)
  if (since.length % 2 === 0 || !duelMovesOf(sd).includes(since[0]!.slice(0, 4))) return false;
  const nth = (since.length + 1) / 2;
  if (nth > s.showdownEngineMoves) return false;
  return nth === 1 || showdownLive(board.fen, lineupSquares(sd, since), boss.crowdSide);
}

/** Wrangler: the long pull, the lasso drag every few turns, and SHOWDOWN! */
export const PIG: BossRules = {
  id: "pig",
  // (The test trigger is worked out at his turn, after his move: kept until then.)
  triggerAtHisTurn: true,
  // SHOWDOWN! (Eric, Oct 13: "the moment it's ready he fires it with no warning"): lined up after his move on his first
  // turn with his meter full where a line-up qualifies (afterBossMove), it comes as the next crowd turn begins; the
  // meter empties. The test trigger's stand-in drag (the board can't hold a line-up) comes the same way.
  ultimate(next, t) {
    const sd = next.showdown?.turn === t.turn ? next.showdown : null;
    const d = next.drag?.turn === t.turn && next.drag.ult ? next.drag : null;
    if (!sd && !d) return false;
    next.ultAt = t.turn;
    delete next.ultNext;
    t.events.push(sd ? { kind: "showdown", turn: t.turn, squares: sd.pairs.flatMap((p) => [p.crowd, p.boss]) } : { kind: "drag", turn: t.turn, square: d!.to, squares: [d!.from, d!.to], ult: true });
    return true;
  },
  // His own meter, not the rage meter (nothing but his moves fills it).
  meter: (p, turn, s) => showdownMeter(p, turn, s),
  // The long pull's moment, as the turn after his first move begins.
  everyTurn(next, t) {
    if (next.pull && next.pull.turn === t.turn) t.events.push({ kind: "pull", turn: t.turn, square: next.pull.to, squares: [next.pull.from, next.pull.via, next.pull.to] });
  },
  // The lasso drag: played after his move when it was due (dragDue) and the engine found one in the band; due but none
  // (or no engine): it doesn't count, and he tries again after his next move.
  passive(next, t) {
    const d = next.drag;
    if (d && d.turn === t.turn && !d.ult) {
      t.events.push({ kind: "drag", turn: t.turn, square: d.to, squares: [d.from, d.to] });
      next.nextPassive = t.turn + (t.test === "drag" ? 2 : t.s.dragEvery);
      return;
    }
    if (t.turn >= next.nextPassive) next.nextPassive = t.turn + 1;
  },
  // The forced duel: the crowd's move must be one of them (none legal: the dispatcher lifts it, a normal move).
  crowdFilter(allowed, boss) {
    const sd = showdownNow(boss);
    if (!sd) return allowed;
    const duels = new Set(duelMovesOf(sd));
    return allowed.filter((m) => duels.has(m.slice(0, 4)));
  },
  // A turn after a drag, and the duel's: the position isn't the crowd's own doing.
  powerTurn: (boss) => !!dragNow(boss) || !!showdownNow(boss),
  // His long pull is his first move written as its three squares: played as the double step (the pawn goes on
  // after it: afterBossMove).
  specialMove(boss, fen, move) {
    if (!firstMoveDue(boss) || !pullOptions(fen).includes(move)) return null;
    return { play: pullStep(move), san: `${move.slice(2, 4)}` };
  },
  // His reply to the showdown's duel, and his next moves while its tactics are live: the engine's, as the search scored it.
  bestReply: (boss, board) => engineMoveDue(boss, board),
  // After his move: his first one, the long pull (or nothing: an ordinary first move); later, the showdown's line-up
  // (his meter full, or the test trigger's, outside the band if the host found none inside), the trigger's stand-in drag,
  // or the lasso drag, each checked against the rules here and put on the board as a base.
  afterBossMove(b, move, extras) {
    const boss = b.state.boss!;
    const p = boss.powers!;
    const id = b.state.boards[0]!;
    const board = b.boards.get(id)!;
    const turn = turnOf(boss);
    const put = (fen: string, lastMove?: string) => {
      const ply = board.history.length;
      b.boards.set(id, { ...board, fen, ...(lastMove ? { lastMove } : {}), bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }] });
    };
    if (firstMoveDue(boss)) {
      const pull = extras?.special && pullStep(extras.special) === move ? extras.special : null;
      const at = pull ? pieceAt(board.fen, pull.slice(2, 4)) : null;
      if (pull && !at) {
        const g = gridOf(board.fen);
        const pawn = g.get(move.slice(2, 4))!;
        g.delete(move.slice(2, 4));
        g.set(pull.slice(2, 4), pawn);
        put(fenWith(board.fen, g, []), pull);
        b.state = { ...b.state, boss: { ...boss, powers: { ...p, pull: { turn, from: pull.slice(0, 2), via: move.slice(2, 4), to: pull.slice(2, 4) } } } };
      } else b.state = { ...b.state, boss: { ...boss, powers: { ...p, pull: null } } };
      return;
    }
    const due = showdownDue(boss);
    if (due) {
      const lineup = checkLineup(board.fen, extras?.showdown, [3, 2]);
      if (lineup) {
        put(lineup.fen);
        const outside = due === "test" && extras?.outside ? { outside: true as const } : {};
        b.state = { ...b.state, boss: { ...boss, powers: { ...p, sdBase: boss.crowdMoves, showdown: { turn, pairs: lineup.pairs, before: board.fen, edge: extras?.edge ?? null, ply: board.history.length, ...outside } } } };
        return;
      }
      // (The test trigger, and the board can't hold a line-up: a drag stands in.)
      const d = due === "test" ? checkDrag(board.fen, extras?.drag) : null;
      if (d) {
        put(d.fen);
        b.state = { ...b.state, boss: { ...boss, powers: { ...p, sdBase: boss.crowdMoves, drag: { turn, from: d.from, to: d.to, piece: d.piece, ult: true } } } };
        return;
      }
    }
    if (dragDue(boss)) {
      const d = checkDrag(board.fen, extras?.drag);
      if (d) {
        put(d.fen);
        b.state = { ...b.state, boss: { ...boss, powers: { ...p, drag: { turn, from: d.from, to: d.to, piece: d.piece } } } };
      }
    }
  },
  // What his turn must work out besides his move: the long pull (his first); then the showdown (his meter full, or
  // the trigger) and a drag when one is due.
  asks(boss, fen) {
    const p = boss.powers!;
    const seed = lassoSeed(p.seed, turnOf(boss));
    if (firstMoveDue(boss)) {
      const pull = pullOptions(fen);
      return pull.length ? { pull, seed } : null;
    }
    const due = showdownDue(boss);
    const showdown = due === "test" || (due === "try" && pairSizes(fen, boss.crowdSide).length > 0) ? due : null;
    const drag = dragDue(boss);
    if (!showdown && !drag) return null;
    return { ...(showdown ? { showdown } : {}), ...(drag ? { drag: true as const } : {}), seed };
  },
  // From the starting position (his long pull needs his center pawns home), sides as usual (a raid's crowd is White:
  // he plays Black); his first drag on turn dragFirst (the test switch ?power=drag: from turn 2, every 2 turns); the
  // test switch ?power=showdown fills his meter from turn 2.
  opening: {
    fromStart: true,
    setUp: (b) => ({
      nextPassive: b.settings.bossPowerTest === "drag" ? 2 : BOSS_POWERS.dragFirst,
      sdBase: b.settings.bossPowerTest === "showdown" ? 1 - BOSS_POWERS.showdownMeterTurns : 0,
    }),
  },
  view: (p) => ({ pull: p.pull ?? null, drag: p.drag ?? null, showdown: p.showdown ?? null, ready: showdownReady(p), scout: showdownScouting(p, p.turn) }),
};

/** His part in the match runner (solo, and the host's answer online). */
export const pigBattle = {
  /** What his turn must work out besides his move now, or null (see PIG.asks). */
  asks(b: Battle): PigAsk | null {
    const boss = b.state.boss;
    if (!boss?.powers || boss.id !== "pig" || !b.bossToMove() || b.finalGameOver()) return null;
    return PIG.asks!(boss, b.boards.get(b.state.boards[0]!)!.fen) as PigAsk | null;
  },
};

export type { BossMoveExtras };
