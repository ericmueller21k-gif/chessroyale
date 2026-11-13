import { BOSS_BRAIN, BOSS_CHECK, BOSS_POWERS, lossForRating, openingPlies, type BossBrain, type BossPowerSettings, type Rng } from "@chessroyale/core";
import type { BoardSlot, NetBoard } from "./protocol.ts";
import { recentMoves, type BoardState } from "./boards.ts";
import { applyMove, gameEnd, legalMoves, sideToMove } from "./rules.ts";
import type { MoveScore } from "./uci.ts";
import { humanBrainMove, within, type BrainNote, type HumanEngineLike } from "./boss-brain.ts";
import { moveLoss, pullsOf, raceAfter, raceAdjust, raceWorth, topEach, type CarrotRace } from "./boss-powers.ts";

/**
 * The match runner's parts that don't need the runner (runner.ts, which re-exports them): the judge's re-check of close
 * calls, the engine cache, the boss's guards and move, the boards' wire form. Their own file so a page that needs only
 * these (home: the boss rules) doesn't load the runner (Nov 10, phone load).
 */

export interface EngineLike {
  topMoves(fen: string, n: number): Promise<MoveScore[]>;
  scoreMoves(fen: string, moves: readonly string[]): Promise<MoveScore[]>;
  /** A move at a limited strength (the boss); engines without it play their top move. */
  playAtElo?(fen: string, elo: number, nodes?: number, moveMs?: number): Promise<string>;
  /** A deeper search over a few moves (the re-check); engines without it skip the re-check. */
  scoreMovesAt?(fen: string, moves: readonly string[], nodes: number): Promise<MoveScore[]>;
  /** Top moves at another budget (the Big Bounce's quick look at a few positions; `moves`: only those, searchmoves); engines without it use topMoves. */
  topMovesAt?(fen: string, n: number, nodes: number, moves?: readonly string[]): Promise<MoveScore[]>;
}

/** The re-check's settings (see recheckLoss, recheckMax, recheckNodes and recheckCut* in settings). */
export interface RecheckSettings {
  recheckLoss: readonly [number, number];
  recheckMax: number;
  recheckNodes: number;
  /** Picks that can decide a cut (`priority`): re-checked first, over this wider range of losses, up to this many. */
  recheckCutLoss?: readonly [number, number];
  recheckCutMax?: number;
}

type Evaluation = { bestMove: string; bestExpected: number; expectedAfter: Record<string, number> };

/**
 * Which picks the re-check searches again, with the best move (its anchor: the top moves' first line): those losing
 * between recheckLoss[0] and [1] points, the most picked first, up to recheckMax. Picks that can decide a cut
 * (`priority`, from the lobby: players near the cut line) come first, over the wider recheckCutLoss range, up to
 * recheckCutMax of them; the rest fill up to recheckMax. A pick scored above the anchor is searched too, first and on top
 * of those, whenever there's a re-check, and starts one when a pick of the anchor loses to it within those ranges (a
 * close call like any other): every loss is measured from its number, so it's weighed like for like against the anchor
 * before it counts as the best (docs/decisions/2026-10-16-the-best-move-is-the-highest-scored.md).
 * The same choice on every device and on the server (it's how a judge's re-check is verified).
 */
export function recheckTargets(evaluation: Evaluation, picks: readonly (string | null)[], s: RecheckSettings, priority: readonly string[] = []): string[] {
  if (s.recheckMax <= 0) return [];
  const best = Math.max(evaluation.bestExpected, ...picks.flatMap((m) => (m && evaluation.expectedAfter[m] !== undefined ? [evaluation.expectedAfter[m]!] : [])));
  const count = new Map<string, number>();
  for (const m of picks) if (m) count.set(m, (count.get(m) ?? 0) + 1);
  const exp = (m: string) => evaluation.expectedAfter[m] ?? -1;
  const lossOf = (m: string) => {
    const e = evaluation.expectedAfter[m];
    return e === undefined ? 0 : (best - e) * 100;
  };
  const byCount = (a: string, b: string) => count.get(b)! - count.get(a)! || (a < b ? -1 : a > b ? 1 : 0);
  const close = (m: string, [lo, hi]: readonly [number, number]) => lossOf(m) >= lo && lossOf(m) <= hi;
  // Picks scored above the anchor, the highest first.
  const above = [...count.keys()].filter((m) => exp(m) > evaluation.bestExpected).sort((a, b) => exp(b) - exp(a) || (a < b ? -1 : 1));
  const inRange = (m: string, range: readonly [number, number]) => m !== evaluation.bestMove && !above.includes(m) && close(m, range);
  const wanted = new Set(priority);
  const cut = s.recheckCutMax && s.recheckCutLoss ? s.recheckCutLoss : null;
  const first = cut ? [...count.keys()].filter((m) => wanted.has(m) && inRange(m, cut)).sort(byCount).slice(0, s.recheckCutMax) : [];
  const rest = [...count.keys()].filter((m) => !first.includes(m) && inRange(m, s.recheckLoss)).sort(byCount).slice(0, Math.max(0, s.recheckMax - first.length));
  if (!above.length) return [...first, ...rest];
  const anchor = evaluation.bestMove;
  const anchorClose = count.has(anchor) && (close(anchor, s.recheckLoss) || (!!cut && wanted.has(anchor) && close(anchor, cut)));
  return first.length || rest.length || anchorClose ? [...above, ...first, ...rest] : [];
}

/** Puts a re-check's deep numbers in: re-anchored to the deep number for the best move; a move that beats the best becomes it. */
export function applyRecheck(evaluation: Evaluation, flagged: readonly string[], deep: readonly MoveScore[]): Evaluation & { rechecked: string[] } {
  const deepBest = deep.find((m) => m.move === evaluation.bestMove);
  if (!flagged.length || !deepBest) return { ...evaluation, rechecked: [] };
  const shift = evaluation.bestExpected - deepBest.expected;
  const expectedAfter = { ...evaluation.expectedAfter };
  for (const m of deep) if (m.move !== evaluation.bestMove && flagged.includes(m.move)) expectedAfter[m.move] = Math.min(1, Math.max(0, m.expected + shift));
  let bestMove = evaluation.bestMove;
  let bestExpected = evaluation.bestExpected;
  for (const m of flagged) if ((expectedAfter[m] ?? 0) > bestExpected) [bestMove, bestExpected] = [m, expectedAfter[m]!];
  return { bestMove, bestExpected, expectedAfter, rechecked: [...flagged] };
}

/**
 * Re-checks the close calls before they cost anyone. The top-8 search gives each move only an eighth of the
 * budget, so a good move is now and then marked a mistake (reports/judge-accuracy.md). The picks recheckTargets
 * chooses are searched again with the best move, in one search restricted to them at recheckNodes, and those
 * numbers replace the first ones. Big losses are rechecked too (up to recheckLoss[1]): a sacrifice the quick
 * search called a blunder is the worst miss.
 */
export async function recheckCloseCalls(
  engine: EngineLike,
  fen: string,
  evaluation: Evaluation,
  picks: readonly (string | null)[],
  s: RecheckSettings,
  priority: readonly string[] = [],
): Promise<Evaluation & { rechecked: string[] }> {
  const none = { ...evaluation, rechecked: [] as string[] };
  if (!engine.scoreMovesAt) return none;
  const flagged = recheckTargets(evaluation, picks, s, priority);
  if (!flagged.length) return none;
  const deep = await engine.scoreMovesAt(fen, [evaluation.bestMove, ...flagged], s.recheckNodes);
  return applyRecheck(evaluation, flagged, deep);
}


/** Each move's best reply and mate score from a set of searches, for a BoardEvaluation (the first search of a move wins). */
export function repliesFrom(searches: readonly (readonly MoveScore[])[]): { replies: Record<string, string>; mates: Record<string, number> } {
  const replies: Record<string, string> = {};
  const mates: Record<string, number> = {};
  for (const list of searches)
    for (const m of list) {
      if (m.reply && replies[m.move] === undefined) replies[m.move] = m.reply;
      if (m.mate !== undefined && mates[m.move] === undefined) mates[m.move] = m.mate;
    }
  return { replies, mates };
}


/**
 * Top-move searches started early (while players are still thinking), keyed by
 * position. Boards are known when a round starts and the top-moves search
 * doesn't depend on anyone's pick, so only picks outside the top moves need a
 * search after the picks lock.
 */
export class TopMovesCache {
  private searches = new Map<string, Promise<MoveScore[]>>();
  constructor(private readonly n: number) {}

  /** Starts a search for each position, spread across the engines; forgets older positions. */
  prefetch(engines: readonly EngineLike[], fens: readonly string[]): void {
    const keep = new Map<string, Promise<MoveScore[]>>();
    fens.forEach((fen, i) => {
      let search = this.searches.get(fen);
      if (!search) {
        search = engines[i % engines.length]!.topMoves(fen, this.n);
        search.catch(() => this.searches.delete(fen));
      }
      keep.set(fen, search);
    });
    this.searches = keep;
  }

  /** The prefetched search for this position, or a fresh one on `engine`. */
  get(engine: EngineLike, fen: string): Promise<MoveScore[]> {
    return this.searches.get(fen) ?? engine.topMoves(fen, this.n);
  }
}


/**
 * How the boss plays a move (bossMoveFrom): at its strength ("elo"), a slip ("stumble"), the King's strike ("stagger"),
 * or the engine's best at full strength ("best": a power's follow-up its search scored, BossRules.bestReply).
 */
export type BossMoveKind = "elo" | "stumble" | "stagger" | "best";

/**
 * A human-like brain for the boss's move (bossMoveFrom): Maia's own move (maia-raw) or a guarded one, at `rating`.
 * When its engine isn't ready, is slow, or none of its moves is allowed, the move is today's Stockfish move; every
 * candidate vetoed by a guard: Stockfish's best.
 */
export interface BossBrainCall {
  brain: BossBrain;
  rating: number;
  engine: HumanEngineLike;
  /** The bridge band: this share of the moves (drawn per move) is today's Stockfish move, Maia not asked. */
  stockfishShare?: number;
  /** BOSS_BRAIN, unless a test or sim passes its own. */
  settings?: typeof BOSS_BRAIN;
  /** Maia draws with this seed (an online boss move two devices play: BOSS_CHECK); none, at random. */
  seed?: number;
  onNote?(note: BrainNote): void;
}

/** The limits on a boss's moves (see bossSlipLoss, bossMaxLoss and bossMaxLogitLoss in settings). */
export interface BossGuard {
  slipLoss: readonly [number, number];
  maxLoss: number;
  maxLogitLoss: number;
}

/** The mate test's start (settings.bossMateTest): 1.f3 e5 2.g4, and the boss (Black) mates with Qh4. */
export const MATE_TEST_MOVES: readonly string[] = ["f2f3", "e7e5", "g2g4"];
/** Test switch (settings.bossWinTest, ?win=1): 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6, the crowd White to move: Qxf7 mates the boss. */
export const WIN_TEST_MOVES: readonly string[] = ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6"];

export const DEFAULT_BOSS_GUARD: BossGuard = { slipLoss: [2, 7], maxLoss: 10, maxLogitLoss: 1 };

export const bossGuardFrom = (s: { bossSlipLoss: readonly [number, number]; bossMaxLoss: number; bossMaxLogitLoss: number }): BossGuard => ({
  slipLoss: s.bossSlipLoss,
  maxLoss: s.bossMaxLoss,
  maxLogitLoss: s.bossMaxLogitLoss,
});

/** Within the guard: never more than maxLoss points, nor more than maxLogitLoss log-odds (a couple of points is always fine). */
export function withinGuard(loss: { points: number; logit: number }, guard: BossGuard): boolean {
  return loss.points <= guard.maxLoss && (loss.logit <= guard.maxLogitLoss || loss.points <= 2);
}

/** The King's strike's guard: wider, up to its own range of points given away (still never a piece for nothing). */
const strikeGuard = (guard: BossGuard, strikeLoss: readonly [number, number]): BossGuard => ({ ...guard, maxLoss: Math.max(guard.maxLoss, strikeLoss[1]), maxLogitLoss: Math.max(guard.maxLogitLoss, 1.5) });

/**
 * The landing guard's look ahead (Alfil's Slam: its pieces land as the crowd's turn after his move begins;
 * docs/decisions/2026-10-17-alfil-sees-the-landing.md): `after` takes the position after his move to the one the crowd
 * will move in (the pieces down, as the rules put them); his pick and `looks` of his search's best moves are judged
 * there, each searched at `nodes`. `onCheck` hears what the guard did (the sims count it).
 */
export interface BossAhead {
  after(fen: string): string;
  looks: number;
  nodes: number;
  onCheck?(check: LandingCheck): void;
}

/** What the landing guard did: his pick, the move played (the same unless it gave way), the positions searched and the time it took. */
export interface LandingCheck {
  pick: string;
  move: string;
  searched: number;
  ms: number;
}

/**
 * The landing guard (Eric, after playing him: "can we make the engine think, the turn before the pieces land, that
 * they're there?"). His moves always come from the board as it is (`fen`): only their judging looks ahead. His pick and
 * the `ahead.looks` highest scored of `top` (his own search of this board), each one he may play here (`allowed`, else
 * legal; his pick among them is searched once), are played, put through `ahead.after` and searched at `ahead.nodes`
 * with the crowd to move (his score is the rest; a move that ends the game is scored by its ending, as nothing lands
 * then). If his pick gives away more than `guard` allows against the best of them (the blunder guard's measure, after
 * the landing), the best is played; equals go in that order, his pick first. Any of them unscored is left out; his pick
 * unscored, or nothing to weigh it against, and it stands.
 */
export async function landingGuard(
  engine: EngineLike,
  fen: string,
  pick: string,
  top: readonly MoveScore[],
  ahead: BossAhead,
  guard: BossGuard,
  allowed: readonly string[] | null = null,
): Promise<LandingCheck> {
  const t0 = performance.now();
  const ok = new Set(allowed ?? legalMoves(fen));
  const others = [...top].sort((a, b) => b.expected - a.expected).map((m) => m.move).filter((m) => ok.has(m)).slice(0, ahead.looks).filter((m) => m !== pick);
  const moves = ok.has(pick) ? [pick, ...others] : [];
  if (moves.length < 2) return { pick, move: pick, searched: 0, ms: performance.now() - t0 };
  const score = new Map<string, number>();
  const search: { move: string; fen: string }[] = [];
  for (const m of moves) {
    const played = applyMove(fen, m);
    const crowd = sideToMove(played);
    // (The game over after it, or with them down: its ending's score. Nothing lands on a game that's over.)
    const end = gameEnd(played, []);
    const down = end ? played : ahead.after(played);
    const over = end ?? gameEnd(down, []);
    if (over) score.set(m, over === "checkmate" ? (sideToMove(down) === crowd ? 1 : 0) : 0.5);
    else search.push({ move: m, fen: down });
  }
  const tops = await topEach([engine], search.map((x) => x.fen), ahead.nodes);
  search.forEach((x, i) => {
    const t = tops[i];
    if (t) score.set(x.move, 1 - t.expected);
  });
  const mine = score.get(pick);
  let best = pick;
  for (const m of moves) if ((score.get(m) ?? -1) > (score.get(best) ?? -1)) best = m;
  const move = mine === undefined || withinGuard(moveLoss(score.get(best)!, mine), guard) ? pick : best;
  return { pick, move, searched: search.length, ms: performance.now() - t0 };
}

/**
 * His race brain's look (Chub & Chirp's Carrot Patch; docs/decisions/2026-10-18-carrot-patch.md): the race as it stands
 * for his move (`race`: the carrots still in the ground, his count, the moves left, how much the race weighs at his
 * strength), how many of his search's best moves it weighs (`looks`), and the node budget each is searched at. `onCheck`
 * hears what it did (the sims count it).
 */
export interface BossRace {
  race: CarrotRace;
  looks: number;
  nodes: number;
  /** Test switch only (settings.bossCarrotTest, ?carrots=N): he takes a carrot whenever a move of his pulls one. */
  eager?: boolean;
  onCheck?(check: RaceCheck): void;
}

/** What his race brain did: his pick, the move played (the same unless it gave way), the positions searched, the time it took, and whether it was his last carrot. */
export interface RaceCheck {
  pick: string;
  move: string;
  searched: number;
  ms: number;
  won?: true;
}

/**
 * His race brain (Eric's sheet: "Stockfish's top few safe moves are re-scored by the race: his distance to the open
 * carrots and yours, so he also blocks or takes your runners"), as the landing guard looks ahead. A move that pulls his
 * last carrot wins the battle: it's played, as a mate would be (the first such of his pick, his search's order and
 * square order that doesn't stalemate, reach the fifty-move count or leave a dead draw, else the first such: he looks at
 * the position alone, so he can't see a repetition). Else his pick, his search's `looks` best moves within the
 * blunder guard of his best, and the moves that pull a carrot (as many again, his search's order first: a short list of
 * his top moves leaves out moves within the guard, and a pull is the race's move), each one he may play here, are
 * played and searched at `nodes` (the crowd to move: his score the rest; a move that ends the game, its ending's), and
 * scored with the race (raceWorth: what his chances of each carrot make his prize worth; raceAdjust: against the best
 * of them for the race, weighed by `race.weight`). The best so scored replaces his pick only for the race: its race
 * worth at least carrotMinGain pawns above his pick's (so a tiny race gain never lets a stronger chess move in), its own
 * score within the guard of the best searched; equals: his pick. Any unscored is left out; his pick unscored, and it
 * stands.
 */
export async function raceGuard(
  engine: EngineLike,
  fen: string,
  pick: string,
  top: readonly MoveScore[],
  look: BossRace,
  guard: BossGuard,
  allowed: readonly string[] | null = null,
  s: Pick<BossPowerSettings, "carrotCount" | "carrotSharp" | "carrotHurry" | "carrotOdds" | "carrotWinWorth" | "carrotMinGain" | "bouncePawnLogit"> = BOSS_POWERS,
): Promise<RaceCheck> {
  const t0 = performance.now();
  const r = look.race;
  const ok = new Set(allowed ?? legalMoves(fen));
  const done = (move: string, searched: number, won = false): RaceCheck => ({ pick, move, searched, ms: performance.now() - t0, ...(won ? { won: true as const } : {}) });
  if (!ok.has(pick) || !r.open.length) return done(pick, 0);
  const sorted = [...top].sort((a, b) => b.expected - a.expected).filter((m) => ok.has(m.move));
  const order = [...new Set([pick, ...sorted.map((m) => m.move), ...[...ok].sort()])];
  const pulls = order.filter((m) => pullsOf(fen, m, r.open).length > 0);
  // (His last carrot: the battle, even when the same move draws on the board (bossCarrotWin). Given the choice, one that
  // doesn't stalemate, reach the fifty-move count or leave a dead draw, so the board rarely shows a draw as he wins (a
  // repetition isn't seen: the position alone, no history); a mate is his either way.)
  const wins = pulls.filter((m) => r.his + pullsOf(fen, m, r.open).length >= s.carrotCount);
  const win = wins.find((m) => [null, "checkmate"].includes(gameEnd(applyMove(fen, m), []))) ?? wins[0];
  if (win) return done(win, 0, true);
  if (look.eager && pulls.length) return done(pulls[0]!, 0);
  const best = sorted[0]?.expected;
  const safe = best === undefined ? [] : sorted.filter((m) => withinGuard(moveLoss(best, m.expected), guard)).map((m) => m.move);
  const moves = [...new Set([pick, ...safe.slice(0, look.looks), ...pulls.slice(0, look.looks)])];
  if (moves.length < 2) return done(pick, 0);
  const scored = new Map<string, { chess: number; race: number }>();
  const search: { move: string; fen: string; race: number }[] = [];
  for (const m of moves) {
    const after = raceAfter(fen, m, r);
    const race = raceWorth(after.fen, after.race, s);
    const end = gameEnd(after.fen, []);
    if (end) scored.set(m, { chess: end === "checkmate" ? 1 : 0.5, race });
    else search.push({ move: m, fen: after.fen, race });
  }
  const tops = await topEach([engine], search.map((x) => x.fen), look.nodes);
  search.forEach((x, i) => {
    const t = tops[i];
    if (t) scored.set(x.move, { chess: 1 - t.expected, race: x.race });
  });
  const mine = scored.get(pick);
  if (!mine) return done(pick, search.length);
  const all = [...scored.values()];
  const top1 = Math.max(...all.map((x) => x.chess));
  const ref = Math.max(...all.map((x) => x.race));
  const w = Math.max(0, Math.min(1, r.weight ?? 1));
  const total = (x: { chess: number; race: number }) => raceAdjust(x.chess, ref - x.race, w, s);
  let move = pick;
  let at = total(mine);
  for (const m of moves) {
    const x = scored.get(m);
    if (!x || m === pick || x.race < mine.race + s.carrotMinGain || !withinGuard(moveLoss(top1, x.chess), guard)) continue;
    if (total(x) > at + 1e-9) [move, at] = [m, total(x)];
  }
  return done(move, search.length);
}

/** From the top moves, the one nearest the middle of `range` (points lost) that the guard allows; the best if none is in range. */
function pickByLoss(top: readonly MoveScore[], range: readonly [number, number], guard: BossGuard): string {
  const best = top[0]!.expected;
  const scored = top.map((m) => ({ move: m.move, loss: moveLoss(best, m.expected) })).filter((m) => withinGuard(m.loss, guard));
  const [lo, hi] = range;
  const mid = (lo + hi) / 2;
  const inRange = scored.filter((m) => m.loss.points >= lo && m.loss.points <= hi);
  if (!inRange.length) return top[0]!.move;
  return [...inRange].sort((a, b) => Math.abs(a.loss.points - mid) - Math.abs(b.loss.points - mid))[0]!.move;
}

/**
 * The boss's move. "elo": Stockfish at its strength. "stumble" (a weak boss, now and then): a slip, a small
 * deliberate inaccuracy from its top moves. "stagger" (the King struck it): from its top moves, one that gives
 * away `strikeLoss` points: a clear step back. Every move then passes the blunder guard: Stockfish's limited
 * strength picks some moves that hang a piece or the queen; one that gives away more than the guard allows is
 * swapped for a slip. A boss loses on mistakes, never by throwing material away.
 * With a human-like `brain` (Maia, BOSS_BRAIN), its moves replace the "elo" and "stumble" ones (Maia's own mistakes
 * take the slips' place), within what `allowed` leaves; the strike, the bridge band's share and every fallback are
 * Stockfish's, as above. "best" (a power's follow-up its engine search scored: Wrangler's reply to the showdown's
 * duel) is the engine's best move at full strength (bestReplyFrom): never the brain's, a slip or the guard's.
 *
 * `ahead` (Alfil's Slam: its pieces land as the crowd's turn after this move begins): whichever of those picked it
 * (but "best"), the pick is judged with them down too (landingGuard, at the guard of its kind: the strike's own wider
 * one for "stagger"), and gives way to the best of his top moves there if it gives away more than that guard allows.
 * The moves weighed are his on this board, never one that needs a piece still in the air. Null: no look ahead, and no
 * search more than before.
 *
 * Whichever of those picks it, the move is one of `allowed` (the moves the powers leave him; null: any legal move): a
 * pick that isn't (an engine's answer for another position, say) is logged and his best allowed move played instead
 * (the first allowed one if that search fails too), and the admins' debug line says it was replaced.
 *
 * `seeded` (an online move two devices play with one seed, `rng` from it: BOSS_CHECK): Stockfish at a strength draws from the
 * top-8 search with `rng` (eloDraw) in place of UCI_LimitStrength's own draw (seeded by the clock), so two honest devices agree.
 */
export async function bossMoveFrom(
  engine: EngineLike,
  fen: string,
  elo: number,
  nodes: number,
  kind: BossMoveKind | boolean,
  rng: Rng = Math.random,
  strikeLoss: readonly [number, number] = [5, 15],
  guard: BossGuard = DEFAULT_BOSS_GUARD,
  allowed: readonly string[] | null = null,
  brain?: BossBrainCall,
  ahead: BossAhead | null = null,
  race: BossRace | null = null,
  seeded = false,
): Promise<string> {
  const searched: { top: readonly MoveScore[] } = { top: [] };
  let move = await pickBossMove(engine, fen, elo, nodes, kind, rng, strikeLoss, guard, allowed, brain, searched, seeded);
  const k: BossMoveKind = kind === true ? "stumble" : kind === false ? "elo" : kind;
  if (race && k === "elo" && searched.top.length) {
    try {
      const check = await raceGuard(engine, fen, move, searched.top, race, guard, allowed);
      race.onCheck?.(check);
      if (check.move !== move) {
        // (The admins' debug line: the brain's pick gave way to the race.)
        if (brain && brain.brain !== "stockfish") brain.onNote?.({ brain: brain.brain, rating: brain.rating, ...(brain.stockfishShare ? { share: brain.stockfishShare } : {}), by: "stockfish", why: "race" });
        move = check.move;
      }
    } catch (e) {
      // (The race never costs him his move: the pick stands, and the last check below still applies.)
      console.error(`race brain failed in ${fen}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (ahead && k !== "best" && searched.top.length) {
    try {
      const check = await landingGuard(engine, fen, move, searched.top, ahead, k === "stagger" ? strikeGuard(guard, strikeLoss) : guard, allowed);
      ahead.onCheck?.(check);
      if (check.move !== move) {
        // (The admins' debug line: the brain's pick gave way to the landing guard's.)
        if (brain && brain.brain !== "stockfish") brain.onNote?.({ brain: brain.brain, rating: brain.rating, ...(brain.stockfishShare ? { share: brain.stockfishShare } : {}), by: "stockfish", why: "landing" });
        move = check.move;
      }
    } catch (e) {
      // (The look ahead never costs him his move: the pick stands, and the last check below still applies.)
      console.error(`landing guard failed in ${fen}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const ok = allowed ?? legalMoves(fen);
  if (ok.includes(move)) return move;
  console.error(`boss move refused: ${move} isn't one he may play in ${fen}; his best allowed move instead`);
  // (The admins' debug line: the pick it named was replaced, whoever's it was.)
  brain?.onNote?.({ brain: brain.brain, rating: brain.rating, ...(brain.stockfishShare ? { share: brain.stockfishShare } : {}), by: "stockfish", why: "replaced" });
  // (The engine that gave the wrong pick may fail again: if it throws, or names a move outside them, the first allowed.)
  try {
    const best = await bestReplyFrom(engine, fen, nodes, ok);
    return ok.includes(best) ? best : ok[0]!;
  } catch {
    return ok[0]!;
  }
}

/**
 * The boss's move as its brain, the slips, the strike or the engine's best pick it (bossMoveFrom checks it). `searched`
 * gets the top moves it searched on this board, scored (none for "best"), for the landing guard.
 */
async function pickBossMove(
  engine: EngineLike,
  fen: string,
  elo: number,
  nodes: number,
  kind: BossMoveKind | boolean,
  rng: Rng,
  strikeLoss: readonly [number, number],
  guard: BossGuard,
  allowed: readonly string[] | null,
  brain: BossBrainCall | undefined,
  searched: { top: readonly MoveScore[] },
  seeded = false,
): Promise<string> {
  const k: BossMoveKind = kind === true ? "stumble" : kind === false ? "elo" : kind;
  if (k === "best") {
    // (Maia isn't asked. The admins' debug line says whose move it was.)
    if (brain && brain.brain !== "stockfish") brain.onNote?.({ brain: brain.brain, rating: brain.rating, ...(brain.stockfishShare ? { share: brain.stockfishShare } : {}), by: "stockfish", why: "power" });
    return bestReplyFrom(engine, fen, nodes, allowed);
  }
  // A human-like brain (Maia, BOSS_BRAIN) is asked at once, alongside the top-8 search: never waited on to load,
  // never longer than its timeout. The King's strike stays Stockfish's (its own step back), and so does the bridge
  // band's share of moves (drawn first: Maia isn't asked for those).
  const human = brain && brain.brain !== "stockfish" ? brain : null;
  const share = human && k !== "stagger" && (human.stockfishShare ?? 0) > 0 ? rng() < human.stockfishShare! : false;
  const asked = performance.now();
  const ask = human && k !== "stagger" && !share && human.engine.ready() ? human.engine.candidates(fen, human.rating, allowed, { temperature: human.settings?.temperature ?? BOSS_BRAIN.temperature, topP: human.settings?.topP ?? BOSS_BRAIN.topP, multipv: human.settings?.multipv ?? BOSS_BRAIN.multipv, ...(human.seed ? { seed: human.seed } : {}) }) : null;
  // A boss power can stop the boss too (nobody moves onto a pie): it plays the best of what's allowed.
  const all = await engine.topMoves(fen, 8);
  const ok = allowed ? new Set(allowed) : null;
  let top = ok ? all.filter((m) => ok.has(m.move)) : all;
  if (ok && !top.length) top = await engine.scoreMoves(fen, [...ok]);
  if (!top.length) return allowed?.[0] ?? legalMoves(fen)[0]!;
  searched.top = top;
  if (human) {
    const note = { brain: human.brain, rating: human.rating, ...(human.stockfishShare ? { share: human.stockfishShare } : {}) } as const;
    if (k === "stagger") human.onNote?.({ ...note, by: "stockfish", why: "strike" });
    else if (share) human.onNote?.({ ...note, by: "stockfish", why: "share" });
    else if (!ask) human.onNote?.({ ...note, by: "stockfish", why: human.engine.failed?.() ? "failed" : "not ready" });
    else {
      const answer = await within(ask, (human.settings?.timeoutMs ?? BOSS_BRAIN.timeoutMs) - (performance.now() - asked));
      if (!answer) human.onNote?.({ ...note, by: "stockfish", why: "no answer" });
      else {
        const pick = humanBrainMove(human.brain, answer, top, allowed, human.settings);
        if (pick.move) {
          human.onNote?.({ ...note, by: "maia", ...(pick.rank ? { rank: pick.rank } : {}), vetoed: pick.vetoed, ms: answer.ms });
          return pick.move;
        }
        const why = "why" in pick ? pick.why : "guard";
        human.onNote?.({ ...note, by: "stockfish", why, vetoed: pick.vetoed, ms: answer.ms });
        // (Every candidate vetoed by the guard: Stockfish's best, the line with the highest score. None of Maia's
        // moves allowed: today's Stockfish move, below.)
        if (why === "guard") return [...top].sort((a, b) => b.expected - a.expected)[0]!.move;
      }
    }
  }
  const bestMove = top[0]!.move;
  // A move other than the best is checked once more, head to head with the best in one focused search (the
  // eight-line search spreads itself thin and now and then misjudges a move); failing that, the best is played.
  const confirm = async (move: string, g: BossGuard): Promise<string> => {
    if (move === bestMove) return move;
    const scored = await engine.scoreMoves(fen, [bestMove, move]);
    const best = scored.find((m) => m.move === bestMove)?.expected;
    const got = scored.find((m) => m.move === move)?.expected;
    if (best === undefined || got === undefined) return bestMove;
    return withinGuard(moveLoss(Math.max(best, got), got), g) ? move : bestMove;
  };
  if (k === "stumble") return confirm(pickByLoss(top, guard.slipLoss, guard), guard);
  // The King's strike may give away more than a slip, up to its own range (still never a piece for nothing).
  if (k === "stagger") {
    const g = strikeGuard(guard, strikeLoss);
    return confirm(pickByLoss(top, strikeLoss, g), g);
  }
  // (Seeded: drawn from the search with the seed, so the checker plays the same move: BOSS_CHECK.)
  if (!seeded && !engine.playAtElo) return bestMove;
  const move = seeded ? eloDraw(top, elo, rng) : await engine.playAtElo!(fen, elo, nodes);
  if (ok && !ok.has(move)) return confirm(pickByLoss(top, guard.slipLoss, guard), guard);
  const best = top[0]!.expected;
  const got = top.find((m) => m.move === move)?.expected ?? (await engine.scoreMoves(fen, [move]))[0]?.expected ?? 0;
  return confirm(withinGuard(moveLoss(best, got), guard) ? move : pickByLoss(top, guard.slipLoss, guard), guard);
}

/**
 * The boss's move at his strength from every move of the position already scored (the engine server's numbers: the Hidden Boss's
 * phase 1 online when no device answered his move, docs/decisions/2026-11-13-recluse-phase1-pause.md), picked as pickBossMove picks
 * Stockfish's seeded move from its top-8 search: "elo" drawn at `elo` (eloDraw), swapped for a slip if it gives away more than the
 * guard allows; "stumble" a slip; "stagger" the King's strike's step back (its own wider guard); "best" the best. From the 8 best of
 * those he may play (`allowed`; null: any scored). No second, head-to-head look at a move other than the best (pickBossMove's
 * `confirm`): that needs an engine, and every move here was scored at one budget already. Null: nothing scored that he may play.
 */
export function bossMoveFromScores(
  scores: readonly MoveScore[],
  kind: BossMoveKind,
  elo: number,
  rng: Rng,
  strikeLoss: readonly [number, number] = [5, 15],
  guard: BossGuard = DEFAULT_BOSS_GUARD,
  allowed: readonly string[] | null = null,
): string | null {
  const ok = allowed ? new Set(allowed) : null;
  const top = scores.filter((s) => (!ok || ok.has(s.move)) && Number.isFinite(s.expected)).sort((a, b) => b.expected - a.expected).slice(0, 8);
  if (!top.length) return null;
  if (kind === "best") return top[0]!.move;
  if (kind === "stumble") return pickByLoss(top, guard.slipLoss, guard);
  if (kind === "stagger") return pickByLoss(top, strikeLoss, strikeGuard(guard, strikeLoss));
  const move = eloDraw(top, elo, rng);
  const got = top.find((m) => m.move === move)!.expected;
  return withinGuard(moveLoss(top[0]!.expected, got), guard) ? move : pickByLoss(top, guard.slipLoss, guard);
}

/**
 * Stockfish at a strength, drawn from its top moves with a given random source (an online boss move two devices play with one seed:
 * BOSS_CHECK; UCI_LimitStrength draws with the clock): each move weighed exp(−loss ÷ T) (eloDrawT), so the best is the likeliest
 * and a move T points worse about a third as likely. The guard and the head-to-head check after it are the same as for
 * UCI_LimitStrength's move.
 */
export function eloDraw(top: readonly MoveScore[], elo: number, rng: Rng): string {
  const best = top[0]!.expected;
  const t = eloDrawT(elo);
  const weights = top.map((m) => Math.exp(-moveLoss(best, m.expected).points / t));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) {
    r -= weights[i]!;
    if (r < 0) return top[i]!.move;
  }
  return top[0]!.move;
}

/**
 * eloDraw's temperature at a strength: the mean loss a move at that UCI_Elo (RATING_CURVE), times BOSS_CHECK.eloDrawScale's factor
 * (straight between its points, held past its ends), so the seeded draw gives away what UCI_LimitStrength does through the same
 * guard (reports/elo-draw.md).
 */
export function eloDrawT(elo: number): number {
  const pts = BOSS_CHECK.eloDrawScale;
  let k = elo <= pts[0]![0] ? pts[0]![1] : pts[pts.length - 1]![1];
  for (let i = 1; i < pts.length && elo > pts[0]![0]; i++) {
    const [xa, ya] = pts[i - 1]!;
    const [xb, yb] = pts[i]!;
    if (elo <= xb) {
      k = ya + ((elo - xa) * (yb - ya)) / (xb - xa);
      break;
    }
  }
  return Math.max(0.1, lossForRating(elo) * k);
}

/**
 * The engine's best move at full strength (BossMoveKind "best": a power's follow-up its engine search scored, such as
 * Wrangler's reply to the showdown's duel): one line at `nodes` (the boss's own budget, deeper than any power's
 * scoring), so the move is the one the search assumed. A power that limits his moves (`allowed`) and that line's move
 * not one of them, or no line: the best scored of those he may play.
 */
export async function bestReplyFrom(engine: EngineLike, fen: string, nodes: number, allowed: readonly string[] | null = null): Promise<string> {
  const [line] = await (engine.topMovesAt ? engine.topMovesAt(fen, 1, nodes) : engine.topMoves(fen, 1));
  if (line && (!allowed || allowed.includes(line.move))) return line.move;
  const options = allowed ?? legalMoves(fen);
  if (options.length <= 1) return options[0]!;
  const scored = await engine.scoreMoves(fen, options);
  return [...scored].sort((a, b) => b.expected - a.expected)[0]?.move ?? options[0]!;
}

/** A board as sent to (and shown in) the app. */
/** Every board slot (live or closed), in slot order, for the strip of tiny boards. */
export function boardSlots(boards: Map<number, BoardState>, live: number[]): BoardSlot[] {
  return [...boards.values()]
    .sort((a, b) => a.id - b.id)
    .map((b) => ({ id: b.id, fen: b.fen, lastMove: b.lastMove, live: live.includes(b.id) }));
}

export function netBoard(b: BoardState, withOpening = false): NetBoard {
  const recent = recentMoves(b, 5);
  return {
    id: b.id,
    fen: b.fen,
    lastMove: b.lastMove,
    openingName: b.opening.names?.[b.openingPlies] ?? b.opening.name,
    generation: b.generation,
    ply: b.history.length,
    recent: recent.moves,
    recentFrom: recent.from,
    history: [...b.history],
    ...(b.bases?.length ? { bases: b.bases.map((x) => ({ ...x })) } : {}),
    ...(b.captures?.length ? { captures: b.captures.map((x) => ({ ...x })) } : {}),
    ...(withOpening ? { openingMoves: b.history.slice(0, b.openingPlies) } : {}),
  };
}
