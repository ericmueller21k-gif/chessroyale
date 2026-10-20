import { AUTOCHESS, shuffle, weightedIndex, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { adjustBlock, adjustDrop, adjustMove, adjustTargets, dropBlock, dropSquareBlock, startAdjust } from "./adjust.ts";
import { backRank, emptyArmy, halfSquares, legalCounts, placeBlock, priceOf, squareOf } from "./army.ts";
import { newShop, refillSlot, rerollShop } from "./shop.ts";
import { type Army, type Color, type Kind } from "./types.ts";

/**
 * The bot (v5): it buys from its own random shop (the same odds as yours, its own seeded rolls), rerolling now and then when it
 * has gold to spare, locks in at a seeded time, places pawns in front and pieces behind (with some randomness, seeded) up to the
 * board the auto-drop fills, keeps one more on its bench for the adjust drop when it can pay for it, and in the adjust step
 * moves and drops greedily with the engine. It sells nothing. Everything random comes from the round's seed.
 */

/**
 * What it likes among the slots it sees: minor pieces and rooks over pawns (a shop is mostly pawns, so a pawn is the filler),
 * and later rooks and a queen. Weights by kind: [early, late]. (Not pawns first: Eric, Oct 19, it looked like pawn spam.)
 */
const WEIGHTS: Record<Kind, readonly [number, number]> = { p: [1, 1], n: [4, 3], b: [4, 3], r: [3, 4], q: [0, 3] };
/** After this many rounds it buys the late mix. */
const LATE_ROUND = 6;
/** A queen only when this much more is left after it (it buys a queen when rich, not with its last coins). */
const QUEEN_CHANGE = 40;

/** One thing the bot buys: a piece (and its price), or a reroll of its shop. */
export interface BotBuy {
  kind: Kind | "reroll";
  price: number;
}

/**
 * What the bot buys with `gold` in `round`, in the order it buys: pieces from its own shop (five random slots: it picks among
 * what is on offer by its weights, and a bought slot rolls a new piece), and now and then a reroll when it has gold to spare
 * (more often when the shop shows nothing but pawns). It owns at most what the board holds after the auto-drop plus the one
 * piece it may drop in the adjust step, and buys that last piece only if it keeps the drop's gold. Sometimes it keeps a hundred
 * banked for interest.
 */
export function botBuys(gold: number, round: number, rng: Rng, cfg: AutoChessSettings = AUTOCHESS): BotBuy[] {
  const per = cfg.interest.per;
  let budget = gold;
  // (Saving: only when the interest is worth it and a few pieces' worth is left to spend.)
  if (gold >= per + 30 && rng() < cfg.bot.saveChance) budget = gold - Math.min(Math.floor((gold - 30) / per), cfg.interest.max / cfg.interest.gold) * per;
  const t = Math.min(1, (round - 1) / (LATE_ROUND - 1));
  const seed = (rng() * 2 ** 32) >>> 0;
  let shop = newShop(seed, cfg);
  const out: BotBuy[] = [];
  let rerolls = 0;
  let pieces = 0;
  // (What it owns, counted against the same limits the player's shop has.)
  const n: Record<Kind, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const most = Math.min(cfg.boardLimit, cfg.autoDropTo + cfg.adjustDrops);
  for (let looks = 0; looks < 60 && pieces < most; looks++) {
    // (A piece past the auto-drop's number waits for the adjust drop, so it needs that gold kept.)
    const keep = pieces >= cfg.autoDropTo ? cfg.adjustDropCost : 0;
    const options = shop.slots
      .map((k, slot) => ({ k, slot }))
      .filter(({ k }) => {
        if (priceOf(k, cfg) > budget - keep) return false;
        if (k === "q" && (n.q >= cfg.queenLimit || budget < priceOf("q", cfg) + QUEEN_CHANGE)) return false;
        return legalCounts({ ...n, [k]: n[k] + 1 }, cfg);
      });
    const bare = options.every((o) => o.k === "p");
    // Gold to spare: a reroll leaves enough for a knight and the bot has the gold it likes to keep.
    const spare = rerolls < cfg.bot.maxRerolls && budget >= cfg.bot.rerollGold && budget - cfg.shop.rerollCost - keep >= priceOf("n", cfg);
    if (spare && rng() < (bare ? cfg.bot.rerollChanceBare : cfg.bot.rerollChance)) {
      shop = rerollShop(shop, seed, cfg);
      rerolls++;
      budget -= cfg.shop.rerollCost;
      out.push({ kind: "reroll", price: cfg.shop.rerollCost });
      continue;
    }
    if (!options.length) break;
    const pick = options[weightedIndex(rng, options.map(({ k }) => WEIGHTS[k][0] + (WEIGHTS[k][1] - WEIGHTS[k][0]) * t))]!;
    out.push({ kind: pick.k, price: priceOf(pick.k, cfg) });
    n[pick.k]++;
    pieces++;
    budget -= priceOf(pick.k, cfg);
    shop = refillSlot(shop, pick.slot, seed, cfg);
  }
  return out;
}

/** One thing the bot does while buying, `at` seconds into the step: a piece appears on a square (null: it stays on the bench) or the shop is rerolled. */
export interface BotEvent {
  at: number;
  kind: Kind | "reroll";
  square: string | null;
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
 * The bot's whole buy-and-place step: what it buys (pieces and rerolls), where it puts the pieces, and when (seconds into the
 * step, spread over the part of it that isn't locked, in the order it did them), and when it locks in (`lockAt`, seconds into
 * the step; null: never). It puts down as many as the auto-drop would fill the board to; one more, bought to drop in the adjust
 * step, stays on its bench. Its army when it is done is `army`.
 */
export function botPlan(
  color: Color,
  king: string,
  gold: number,
  round: number,
  rng: Rng,
  cfg: AutoChessSettings = AUTOCHESS,
): { events: BotEvent[]; army: Army; spent: number; lockAt: number | null } {
  const buys = botBuys(gold, round, rng, cfg);
  const pieces = buys.flatMap((b) => (b.kind === "reroll" ? [] : [b.kind]));
  const placements = botPlaces(color, king, pieces.slice(0, cfg.autoDropTo), rng, cfg);
  const open = cfg.buySeconds - cfg.lockSeconds - 1;
  // It locks in (its board freezes) at a seeded time in the open part of the step, or now and then never; its last piece goes down a moment before.
  const never = rng() < cfg.bot.neverLockChance;
  const lockAt = never ? null : open * (cfg.bot.lockFrom + (cfg.bot.lockTo - cfg.bot.lockFrom) * rng());
  const span = lockAt === null ? open : lockAt - 0.2;
  const n = buys.length;
  let placed = 0;
  const events: BotEvent[] = buys.map((buy, i) => {
    // (A piece it couldn't place, or the one it keeps for the adjust drop, has no square.)
    const square = buy.kind === "reroll" ? null : (placements[placed++]?.square ?? null);
    return { at: Math.min(span, Math.max(0.5, span * (0.1 + (0.9 * (i + 0.5)) / Math.max(1, n)) + (rng() - 0.5) * 0.04 * span)), kind: buy.kind, square, price: buy.price };
  });
  events.sort((a, b) => a.at - b.at);
  const army: Army = { ...emptyArmy(color, king), board: Object.fromEntries(placements.map((p) => [p.square, p.kind])), bench: pieces.slice(placements.length) };
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
    if (e.square && e.kind !== "reroll") squares[e.square] = e.kind;
    spent += e.price;
  }
  return { squares, spent };
}

/**
 * The bot's adjust step (v5): its one chess move and, when it can afford it, one drop from its bench, each picked greedily with
 * `evaluate` (its chance of winning, 0 to 1, from a small engine search of the position the fight would start from): it tries
 * a few moves (a few squares for each of some pieces) and keeps the best only if it beats standing still; then, with the gold for
 * it, tries its bench pieces on a few squares and keeps the best drop if it beats what it has, or if it isn't already winning. A small search by design: it
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
      // (Better than what it has; or, as the engine's score saturates, not worse when the bot isn't already winning: more material helps.)
      const bar = best < cfg.bot.dropBelow ? best : best + cfg.bot.adjustMargin;
      if (score > (drop?.score ?? bar) || (!drop && score >= bar)) drop = { slot, square, score };
    }
  }
  if (drop && !stop() && !dropSquareBlock(state, drop.slot, drop.square, gold, cfg)) {
    state = adjustDrop(state, drop.slot, drop.square, cfg);
    onChange?.(state.army);
  }
  return state.army;
}
