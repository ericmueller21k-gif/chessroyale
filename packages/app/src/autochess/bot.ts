import { AUTOCHESS, shuffle, weightedIndex, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { adjustBlock, adjustMove, adjustTargets, startAdjust } from "./adjust.ts";
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
 * The bot's adjust step: it looks at a few moves for each piece, scoring the position each would make with `evaluate`
 * (its chance of winning, 0 to 1, from a small engine search of the position the fight would start from), and keeps a
 * move only if it beats not moving. Every piece moves at most once. A small search by design: it shouldn't be
 * unbeatable. `stop` ends it early (the step is over); what it has done by then stands. `onMove`: told of the army after each
 * move it keeps (so a slow engine loses it nothing).
 */
export async function botAdjust(
  army: Army,
  evaluate: (army: Army) => Promise<number>,
  rng: Rng,
  stop: () => boolean,
  cfg: AutoChessSettings = AUTOCHESS,
  onMove?: (army: Army) => void,
): Promise<Army> {
  let state = startAdjust(army);
  let best = await evaluate(state.army);
  let tries = 0;
  const pieces = shuffle(rng, [army.king, ...Object.keys(army.board)]);
  for (const from of pieces) {
    if (stop() || tries >= cfg.bot.adjustTries) break;
    const targets = shuffle(rng, adjustTargets(state.army, from)).slice(0, cfg.bot.adjustDestinations);
    let pick: { to: string; score: number } | null = null;
    for (const to of targets) {
      if (stop() || tries >= cfg.bot.adjustTries) break;
      if (adjustBlock(state, from, to, cfg)) continue;
      tries++;
      const score = await evaluate(adjustMove(state, from, to).army);
      if (score > (pick?.score ?? best + cfg.bot.adjustMargin)) pick = { to, score };
    }
    if (pick && !stop() && !adjustBlock(state, from, pick.to, cfg)) {
      state = adjustMove(state, from, pick.to);
      best = pick.score;
      onMove?.(state.army);
    }
  }
  return state.army;
}
