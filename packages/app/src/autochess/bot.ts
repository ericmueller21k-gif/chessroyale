import { AUTOCHESS, mulberry32, shuffle, weightedIndex, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { adjustBlock, adjustMove, adjustTargets, startAdjust } from "./adjust.ts";
import { boardCount, buyBlock, buyOffer, emptyArmy, priceOf } from "./army.ts";
import { newShop, refillSlot, replaceTaken, rerollShop } from "./shop.ts";
import { type Army, type Color, type Kind } from "./types.ts";

/**
 * The bot (v6): it plays the same shop you do. Its own offers (the same odds, its own seeded rolls) each name a piece and a
 * square on its half; it picks among what it sees by simple weights, rerolling now and then when it has gold to spare, locks in
 * at a seeded time, and in the adjust step moves greedily with the engine. It sells nothing. Everything random comes from the
 * round's seed.
 */

/**
 * What it likes among the offers it sees: minor pieces and rooks over pawns (a shop is mostly pawns, so a pawn is the filler),
 * and later rooks and a queen. Weights by kind: [early, late]. (Not pawns first: Eric, Oct 19, it looked like pawn spam.)
 */
const WEIGHTS: Record<Kind, readonly [number, number]> = { p: [1, 1], n: [4, 3], b: [4, 3], r: [3, 4], q: [0, 3] };
/** After this many rounds it buys the late mix. */
const LATE_ROUND = 6;
/** A queen only when this much more is left after it (it buys a queen when rich, not with its last coins). */
const QUEEN_CHANGE = 40;

/** One thing the bot buys: a piece on a square (and its price), or a reroll of its shop. */
export interface BotBuy {
  kind: Kind | "reroll";
  price: number;
  square: string | null;
}

/**
 * What the bot buys with `gold` in `round`, in the order it buys: offers from its own shop (a piece on a square of its half: it
 * picks among what is on offer by its weights, and a bought slot rolls a new offer), and now and then a reroll when it has gold
 * to spare (more often when the shop shows nothing but pawns). It stops at the board's limit. Sometimes it keeps a hundred
 * banked for interest. `army`: its army when it is done.
 */
export function botBuys(start: Army, gold: number, round: number, rng: Rng, cfg: AutoChessSettings = AUTOCHESS): { buys: BotBuy[]; army: Army } {
  const per = cfg.interest.per;
  let budget = gold;
  // (Saving: only when the interest is worth it and a few pieces' worth is left to spend.)
  if (gold >= per + 30 && rng() < cfg.bot.saveChance) budget = gold - Math.min(Math.floor((gold - 30) / per), cfg.interest.max / cfg.interest.gold) * per;
  const t = Math.min(1, (round - 1) / (LATE_ROUND - 1));
  const seed = (rng() * 2 ** 32) >>> 0;
  let army = start;
  let shop = newShop(seed, army, cfg);
  const out: BotBuy[] = [];
  let rerolls = 0;
  for (let looks = 0; looks < 60 && boardCount(army) < cfg.boardLimit; looks++) {
    const options = shop.slots
      .map((offer, slot) => ({ offer, slot }))
      .filter(({ offer }) => {
        if (buyBlock(army, budget, offer, cfg)) return false;
        return !(offer.kind === "q" && budget < priceOf("q", cfg) + QUEEN_CHANGE);
      });
    const bare = options.every((o) => o.offer.kind === "p");
    // Gold to spare: a reroll leaves enough for a knight and the bot has the gold it likes to keep.
    const spare = rerolls < cfg.bot.maxRerolls && budget >= cfg.bot.rerollGold && budget - cfg.shop.rerollCost >= priceOf("n", cfg);
    if (spare && rng() < (bare ? cfg.bot.rerollChanceBare : cfg.bot.rerollChance)) {
      shop = rerollShop(shop, seed, army, cfg);
      rerolls++;
      budget -= cfg.shop.rerollCost;
      out.push({ kind: "reroll", price: cfg.shop.rerollCost, square: null });
      continue;
    }
    if (!options.length) break;
    const pick = options[weightedIndex(rng, options.map(({ offer }) => WEIGHTS[offer.kind][0] + (WEIGHTS[offer.kind][1] - WEIGHTS[offer.kind][0]) * t))]!;
    out.push({ kind: pick.offer.kind, price: priceOf(pick.offer.kind, cfg), square: pick.offer.square });
    army = buyOffer(army, pick.offer);
    budget -= priceOf(pick.offer.kind, cfg);
    shop = replaceTaken(refillSlot(shop, pick.slot, seed, army, cfg), seed, army, cfg).shop;
  }
  return { buys: out, army };
}

/** One thing the bot does while buying, `at` seconds into the step: a piece appears on a square or the shop is rerolled. */
export interface BotEvent {
  at: number;
  kind: Kind | "reroll";
  square: string | null;
  /** Its price (the bot's gold drops by it at that moment). */
  price: number;
}

/**
 * The bot's whole buy-and-place step: what it buys (pieces and rerolls) and when (seconds into the step, spread over the part
 * of it that isn't locked, in the order it did them), and when it locks in (`lockAt`, seconds into the step; null: never).
 * Its army when it is done is `army`.
 */
export function botPlan(
  color: Color,
  king: string,
  gold: number,
  round: number,
  rng: Rng,
  cfg: AutoChessSettings = AUTOCHESS,
): { events: BotEvent[]; army: Army; spent: number; lockAt: number | null } {
  // (Its lock-in time comes from a draw of its own, so changing how it buys never moves it: the e2e tests pick seeds by it.)
  const lockRng = mulberry32((rng() * 2 ** 32) >>> 0);
  const { buys, army } = botBuys(emptyArmy(color, king), gold, round, rng, cfg);
  const open = cfg.buySeconds - cfg.lockSeconds - 1;
  // It locks in (its board freezes) at a seeded time in the open part of the step, or now and then never; its last piece goes down a moment before.
  const never = lockRng() < cfg.bot.neverLockChance;
  const lockAt = never ? null : open * (cfg.bot.lockFrom + (cfg.bot.lockTo - cfg.bot.lockFrom) * lockRng());
  const span = lockAt === null ? open : lockAt - 0.2;
  const n = buys.length;
  const events: BotEvent[] = buys.map((buy, i) => ({
    at: Math.min(span, Math.max(0.5, span * (0.1 + (0.9 * (i + 0.5)) / Math.max(1, n)) + (rng() - 0.5) * 0.04 * span)),
    kind: buy.kind,
    square: buy.square,
    price: buy.price,
  }));
  events.sort((a, b) => a.at - b.at);
  return { events, army, spent: events.reduce((sum, e) => sum + e.price, 0), lockAt };
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
 * The bot's adjust step: its one chess move, picked greedily with `evaluate` (its chance of winning, 0 to 1, from a small
 * engine search of the position the fight would start from): it tries a few moves (a few squares for each of some pieces) and
 * keeps the best only if it beats standing still. A small search by design: it shouldn't be unbeatable. `stop` ends it early (the
 * step is over); what it has done by then stands. `onChange`: told of the army after the change it keeps (so a slow engine
 * loses it nothing).
 */
export async function botAdjust(
  army: Army,
  evaluate: (army: Army) => Promise<number>,
  rng: Rng,
  stop: () => boolean,
  cfg: AutoChessSettings = AUTOCHESS,
  onChange?: (army: Army) => void,
): Promise<Army> {
  let state = startAdjust(army);
  const best = await evaluate(state.army);
  let tries = 0;
  let pick: { from: string; to: string; score: number } | null = null;
  search: for (const from of shuffle(rng, [army.king, ...Object.keys(army.board)])) {
    for (const to of shuffle(rng, adjustTargets(state.army, from)).slice(0, cfg.bot.adjustDestinations)) {
      if (stop() || tries >= cfg.bot.adjustTries) break search;
      if (adjustBlock(state, from, to, cfg)) continue;
      tries++;
      const score = await evaluate(adjustMove(state, from, to).army);
      if (score > (pick?.score ?? best + cfg.bot.adjustMargin)) pick = { from, to, score };
    }
  }
  if (pick && !stop() && !adjustBlock(state, pick.from, pick.to, cfg)) {
    state = adjustMove(state, pick.from, pick.to);
    onChange?.(state.army);
  }
  return state.army;
}
