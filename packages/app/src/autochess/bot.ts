import { AUTOCHESS, shuffle, weightedIndex, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { adjustBlock, adjustDrop, adjustMove, adjustTargets, dropBlock, dropSquareBlock, startAdjust } from "./adjust.ts";
import { backRank, emptyArmy, halfSquares, legalCounts, placeBlock, priceOf, squareOf } from "./army.ts";
import { KINDS, type Army, type Color, type Kind } from "./types.ts";

/**
 * The bot: it buys by simple rules, places pawns in front and pieces behind (with some randomness, seeded), and in the
 * adjust step moves pieces greedily with the engine. It sells nothing. Everything random comes from the round's seed.
 */

/**
 * Early on it likes minor pieces, with some pawns and rooks; as income grows, rooks and a queen. Weights by kind: [early,
 * late]. (Not pawns first: Eric, Oct 19, it looked like pawn spam.)
 */
const WEIGHTS: Record<Kind, readonly [number, number]> = { p: [2, 1.5], n: [3, 2.5], b: [3, 2.5], r: [2, 3], q: [0, 2] };
/** After this many rounds it buys the late mix. */
const LATE_ROUND = 6;
/** A queen only when this much more is left after it (it buys a queen when rich, not with its last coins). */
const QUEEN_CHANGE = 40;

/** What the bot buys with `gold` in `round`, in the order it buys. Sometimes it keeps a hundred banked for interest. */
export function botBuys(gold: number, round: number, rng: Rng, cfg: AutoChessSettings = AUTOCHESS): Kind[] {
  const per = cfg.interest.per;
  let budget = gold;
  // (Saving: only when the interest is worth it and a few pieces' worth is left to spend.)
  if (gold >= per + 30 && rng() < cfg.bot.saveChance) budget = gold - Math.min(Math.floor((gold - 30) / per), cfg.interest.max / cfg.interest.gold) * per;
  const t = Math.min(1, (round - 1) / (LATE_ROUND - 1));
  const bought: Kind[] = [];
  // (What it owns, counted against the same limits the player's shop has; it never needs a bench.)
  const n: Record<Kind, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  // (Never more than the board holds.)
  while (bought.length < cfg.boardLimit) {
    const options = KINDS.filter((k) => {
      if (priceOf(k, cfg) > budget) return false;
      if (k === "q" && (n.q >= cfg.queenLimit || budget < priceOf("q", cfg) + QUEEN_CHANGE)) return false;
      return legalCounts({ ...n, [k]: n[k] + 1 }, cfg);
    });
    if (!options.length) break;
    const kind = options[weightedIndex(rng, options.map((k) => WEIGHTS[k][0] + (WEIGHTS[k][1] - WEIGHTS[k][0]) * t))]!;
    bought.push(kind);
    n[kind]++;
    budget -= priceOf(kind, cfg);
  }
  return bought;
}

/** One thing the bot does while buying: a piece appears on a square, `at` seconds into the step. */
export interface BotEvent {
  at: number;
  kind: Kind;
  square: string;
  /** Its price (the bot's gold drops by it at that moment). */
  price: number;
}

/**
 * Where the bot puts what it bought: pawns in front (a different file each while there are files, the rank in front of
 * its king's first), pieces behind on its back ranks, never past three pawns a file, never on its king.
 */
export function botPlaces(color: Color, king: string, kinds: readonly Kind[], rng: Rng, cfg: AutoChessSettings = AUTOCHESS): { kind: Kind; square: string }[] {
  const army = emptyArmy(color, king);
  const home = backRank(color);
  const dir = color === "w" ? 1 : -1;
  // Ranks to try, best first: pawns on the third rank from home, then the fourth, then the second; pieces on the back rank, then the second, then the third.
  const pawnRanks = [home + 2 * dir, home + 3 * dir, home + dir];
  const pieceRanks = [home, home + dir, home + 2 * dir];
  const squares = halfSquares(color);
  const out: { kind: Kind; square: string }[] = [];
  let placed: Army = army;
  const files = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const kind of kinds) {
    const ranks = kind === "p" ? pawnRanks : pieceRanks;
    const pawnsIn = (f: number) => Object.entries(placed.board).filter(([sq, k]) => k === "p" && sq.charCodeAt(0) - 97 === f).length;
    const candidates: string[] = [];
    for (const rank of ranks) {
      // (Pawns: the emptiest files first; pieces: any order.)
      const order = kind === "p" ? [...files].sort((a, b) => pawnsIn(a) - pawnsIn(b)) : shuffle(rng, files);
      for (const f of order) candidates.push(squareOf(f, rank));
    }
    const square = [...candidates, ...shuffle(rng, squares)].find((sq) => !placeBlock(placed, kind, sq, undefined, cfg));
    if (!square) continue;
    placed = { ...placed, board: { ...placed.board, [square]: kind } };
    out.push({ kind, square });
  }
  return out;
}

/**
 * The bot's whole buy-and-place step: what it buys, where it puts it, and when (seconds into the step, spread over the part
 * of it that isn't locked, in the order it bought), and when it locks in (`lockAt`, seconds into the step; null: never). Its
 * army when it is done is `army`.
 */
export function botPlan(
  color: Color,
  king: string,
  gold: number,
  round: number,
  rng: Rng,
  cfg: AutoChessSettings = AUTOCHESS,
): { events: BotEvent[]; army: Army; spent: number; lockAt: number | null } {
  const kinds = botBuys(gold, round, rng, cfg);
  const placements = botPlaces(color, king, kinds, rng, cfg);
  const open = cfg.buySeconds - cfg.lockSeconds - 1;
  // It locks in (its board freezes) at a seeded time in the open part of the step, or now and then never; its last piece goes down a moment before.
  const never = rng() < cfg.bot.neverLockChance;
  const lockAt = never ? null : open * (cfg.bot.lockFrom + (cfg.bot.lockTo - cfg.bot.lockFrom) * rng());
  const span = lockAt === null ? open : lockAt - 0.2;
  const n = placements.length;
  const events: BotEvent[] = placements.map((p, i) => ({
    at: Math.min(span, Math.max(0.5, span * (0.1 + (0.9 * (i + 0.5)) / n) + (rng() - 0.5) * 0.04 * span)),
    kind: p.kind,
    square: p.square,
    price: priceOf(p.kind, cfg),
  }));
  events.sort((a, b) => a.at - b.at);
  const army: Army = { ...emptyArmy(color, king), board: Object.fromEntries(placements.map((p) => [p.square, p.kind])) };
  return { events, army, spent: events.reduce((s, e) => s + e.price, 0), lockAt };
}

/** What you see of the bot's board while buying: its pawns as real pawns, every other piece as a plain circle (until the reveal). */
export function botShown(squares: Record<string, Kind>): { pawns: string[]; circles: string[] } {
  const entries = Object.entries(squares);
  return { pawns: entries.filter(([, k]) => k === "p").map(([sq]) => sq), circles: entries.filter(([, k]) => k !== "p").map(([sq]) => sq) };
}

/** What the bot has done by `seconds` into the step: the pieces on the board and the gold it has spent. */
export function botAt(events: readonly BotEvent[], seconds: number): { squares: Record<string, Kind>; spent: number } {
  const squares: Record<string, Kind> = {};
  let spent = 0;
  for (const e of events) {
    if (e.at > seconds) break;
    squares[e.square] = e.kind;
    spent += e.price;
  }
  return { squares, spent };
}

/**
 * The bot's adjust step (v5): its one chess move and, when it can afford it, one drop from its bench, each picked greedily with
 * `evaluate` (its chance of winning, 0 to 1, from a small engine search of the position the fight would start from): it tries
 * a few moves (a few squares for each of some pieces) and keeps the best only if it beats standing still; then, with the gold for
 * it, tries its bench pieces on a few squares and keeps the best drop only if it beats what it has. A small search by design: it
 * shouldn't be unbeatable. `stop` ends it early (the step is over); what it has done by then stands. `onChange`: told of the army
 * after each change it keeps (so a slow engine loses it nothing). `gold`: what it has left (a drop costs `adjustDropCost`).
 */
export async function botAdjust(
  army: Army,
  gold: number,
  evaluate: (army: Army) => Promise<number>,
  rng: Rng,
  stop: () => boolean,
  cfg: AutoChessSettings = AUTOCHESS,
  onChange?: (army: Army) => void,
): Promise<Army> {
  let state = startAdjust(army);
  let best = await evaluate(state.army);
  // The move: most of the tries; the drop has its own.
  const moveTries = Math.max(1, cfg.bot.adjustTries - cfg.bot.dropTries);
  let tries = 0;
  let pick: { from: string; to: string; score: number } | null = null;
  search: for (const from of shuffle(rng, [army.king, ...Object.keys(army.board)])) {
    for (const to of shuffle(rng, adjustTargets(state.army, from)).slice(0, cfg.bot.adjustDestinations)) {
      if (stop() || tries >= moveTries) break search;
      if (adjustBlock(state, from, to, cfg)) continue;
      tries++;
      const score = await evaluate(adjustMove(state, from, to, cfg).army);
      if (score > (pick?.score ?? best + cfg.bot.adjustMargin)) pick = { from, to, score };
    }
  }
  if (pick && !stop() && !adjustBlock(state, pick.from, pick.to, cfg)) {
    state = adjustMove(state, pick.from, pick.to, cfg);
    best = pick.score;
    onChange?.(state.army);
  }
  // The drop: each kind on its bench (the first of each, in bench order) on a few squares of its half.
  if (stop() || dropBlock(state, gold, cfg) !== null) return state.army;
  const slots = state.army.bench.flatMap((k, i) => (state.army.bench.indexOf(k) === i ? [i] : []));
  const perPiece = Math.max(1, Math.floor(cfg.bot.dropTries / Math.max(1, slots.length)));
  let drop: { slot: number; square: string; score: number } | null = null;
  for (const slot of slots) {
    const squares = shuffle(rng, halfSquares(army.color).filter((sq) => !dropSquareBlock(state, slot, sq, gold, cfg))).slice(0, perPiece);
    for (const square of squares) {
      if (stop()) break;
      const score = await evaluate(adjustDrop(state, slot, square, cfg).army);
      if (score > (drop?.score ?? best + cfg.bot.adjustMargin)) drop = { slot, square, score };
    }
  }
  if (drop && !stop() && !dropSquareBlock(state, drop.slot, drop.square, gold, cfg)) {
    state = adjustDrop(state, drop.slot, drop.square, cfg);
    onChange?.(state.army);
  }
  return state.army;
}
