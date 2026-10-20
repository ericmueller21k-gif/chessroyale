import { AUTOCHESS, mulberry32, shuffle, weightedIndex, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { adjustBlock, adjustMove, adjustTargets, startAdjust } from "./adjust.ts";
import { boardCount, buyBlock, buyOffer, emptyArmy, heldBlock, holdBlock, holdOffer, placeHeld, priceOf } from "./army.ts";
import { addXp, buyXp, xpBlock, type Level } from "./level.ts";
import { newShop, refillSlot, replaceTaken, rerollShop } from "./shop.ts";
import { type Army, type Color, type Kind, type Offer } from "./types.ts";

/**
 * The bot (v6): it plays the same shop you do. Its own offers (the same odds, its own seeded rolls) each name a piece and a
 * square on its half; it picks among what it sees by simple weights, rerolling now and then when it has gold to spare, locks in
 * at a seeded time, and in the adjust step moves greedily with the engine. What it held from an earlier round goes down first,
 * free; it buys XP now and then (when that gives it a level), and when its board is full (its level's limit) it holds a good piece
 * on its bench for the next round. It sells nothing. Everything random comes from the round's seed.
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

/** What the bot does: buys a piece onto its board, holds one on its bench, places a held one (free), rerolls its shop, or buys XP. */
export type BotAct = "buy" | "hold" | "place" | "reroll" | "xp";

/** One thing the bot does: a piece (and its price, 0 for a held piece placed) on a square, a reroll of its shop, or XP. */
export interface BotBuy {
  type: BotAct;
  kind: Kind | "reroll" | "xp";
  price: number;
  square: string | null;
}

/**
 * What the bot does with `gold` in `round`, in order: it places what it held (where the squares and its board's room allow), then
 * buys from its own shop (a piece on a square of its half: it picks among what is on offer by its weights, and a bought slot rolls
 * a new offer), now and then rerolling when it has gold to spare (more often when the shop shows nothing but pawns). It buys XP now
 * and then, when that would give it a level (room for another piece) or it is rich; with its board full (its level's number of pieces)
 * it may hold a good piece on its bench instead (not a pawn). Sometimes it keeps a hundred banked for interest. `army`: its army
 * when it is done, bench included; `level`: its level and XP after what it bought (`from`: what it had).
 */
export function botBuys(
  start: Army,
  gold: number,
  round: number,
  rng: Rng,
  cfg: AutoChessSettings = AUTOCHESS,
  from: Level = { level: cfg.levels.start, xp: 0 },
): { buys: BotBuy[]; army: Army; level: Level } {
  const per = cfg.interest.per;
  let budget = gold;
  // (Saving: only when the interest is worth it and a few pieces' worth is left to spend.)
  if (gold >= per + 30 && rng() < cfg.bot.saveChance) budget = gold - Math.min(Math.floor((gold - 30) / per), cfg.interest.max / cfg.interest.gold) * per;
  const t = Math.min(1, (round - 1) / (LATE_ROUND - 1));
  const seed = (rng() * 2 ** 32) >>> 0;
  let army = start;
  let level = from;
  const out: BotBuy[] = [];
  let xpBuys = 0;
  /** XP, when it is worth it (it gives a level, or the bot is rich), the bot can pay, and it hasn't bought its share: `chance` of the time. */
  const tryXp = (chance: number) => {
    const worth = addXp(level, cfg.levels.buyXp, cfg).level > level.level || budget >= cfg.bot.xpRichGold;
    if (xpBuys >= cfg.bot.maxXpBuys || xpBlock(level, budget, cfg) || !worth || rng() >= chance) return false;
    const next = buyXp(level, budget, cfg);
    level = { level: next.level, xp: next.xp };
    budget = next.gold;
    out.push({ type: "xp", kind: "xp", price: cfg.levels.buyXpCost, square: null });
    xpBuys++;
    return true;
  };
  // What it held goes down first, for nothing, wherever its square is free and the board has room.
  for (let i = 0; i < army.bench.length; ) {
    const held = army.bench[i]!;
    if (heldBlock(army, i, cfg, level.level)) i++;
    else {
      out.push({ type: "place", kind: held.kind, price: 0, square: held.square });
      army = placeHeld(army, i);
    }
  }
  // A level first, now and then, when there is gold for it and more besides.
  if (budget >= cfg.bot.xpGold) tryXp(cfg.bot.xpChance);
  let shop = newShop(seed, army, cfg);
  let rerolls = 0;
  let holds = 0;
  for (let looks = 0; looks < 60; looks++) {
    // (A full board only holds, a full bench only buys; neither: done.)
    const boardRoom = boardCount(army) < level.level;
    const holding = !boardRoom;
    // A full board: a level makes room, when it comes to that; else a good piece goes to the bench.
    if (holding && tryXp(cfg.bot.xpChanceFull)) continue;
    if (holding && (army.bench.length >= cfg.benchSlots || holds >= cfg.bot.maxHolds)) break;
    const options = shop.slots
      .map((offer, slot) => ({ offer, slot }))
      .filter(({ offer }) => {
        if (holding ? offer.kind === "p" || holdBlock(army, budget, offer, cfg) : buyBlock(army, budget, offer, cfg, level.level)) return false;
        return !(offer.kind === "q" && budget < priceOf("q", cfg) + QUEEN_CHANGE);
      });
    const bare = options.every((o) => o.offer.kind === "p");
    // Gold to spare: a reroll leaves enough for a knight and the bot has the gold it likes to keep.
    const spare = rerolls < cfg.bot.maxRerolls && budget >= cfg.bot.rerollGold && budget - cfg.shop.rerollCost >= priceOf("n", cfg);
    if (spare && rng() < (bare && boardRoom ? cfg.bot.rerollChanceBare : cfg.bot.rerollChance)) {
      shop = rerollShop(shop, seed, army, cfg);
      rerolls++;
      budget -= cfg.shop.rerollCost;
      out.push({ type: "reroll", kind: "reroll", price: cfg.shop.rerollCost, square: null });
      continue;
    }
    if (!options.length) break;
    // (A held piece is a choice, not the rule: it keeps its gold, now and then, for the interest.)
    if (holding && rng() >= cfg.bot.holdChance) break;
    const pick = options[weightedIndex(rng, options.map(({ offer }) => WEIGHTS[offer.kind][0] + (WEIGHTS[offer.kind][1] - WEIGHTS[offer.kind][0]) * t))]!;
    const price = priceOf(pick.offer.kind, cfg);
    out.push({ type: holding ? "hold" : "buy", kind: pick.offer.kind, price, square: pick.offer.square });
    budget -= price;
    if (holding) {
      army = holdOffer(army, pick.offer);
      holds++;
      shop = refillSlot(shop, pick.slot, seed, army, cfg);
    } else {
      army = buyOffer(army, pick.offer);
      shop = replaceTaken(refillSlot(shop, pick.slot, seed, army, cfg), seed, army, cfg).shop;
    }
  }
  return { buys: out, army, level: { level: level.level, xp: level.xp } };
}

/** One thing the bot does while buying, `at` seconds into the step: a piece appears on a square, is held, the shop is rerolled, or XP is bought. */
export interface BotEvent {
  at: number;
  type: BotAct;
  kind: Kind | "reroll" | "xp";
  /** Where the piece lands (a held one: where it will land): null for a reroll or XP. */
  square: string | null;
  /** Its price (the bot's gold drops by it at that moment). */
  price: number;
}

/**
 * The bot's whole buy-and-place step: what it does (and when: seconds into the step, spread over the part of it that isn't
 * locked, in the order it did them), and when it locks in (`lockAt`, seconds into the step; null: never). Its army when it is
 * done is `army`, the bench it carries into the next round included, and its level and XP after what it bought is `level`.
 * `bench`: what it held coming in; `from`: its level and XP coming in.
 */
export function botPlan(
  color: Color,
  king: string,
  gold: number,
  round: number,
  rng: Rng,
  cfg: AutoChessSettings = AUTOCHESS,
  bench: Offer[] = [],
  from: Level = { level: cfg.levels.start, xp: 0 },
): { events: BotEvent[]; army: Army; level: Level; spent: number; lockAt: number | null } {
  // (Its lock-in time comes from a draw of its own, so changing how it buys never moves it: the e2e tests pick seeds by it.)
  const lockRng = mulberry32((rng() * 2 ** 32) >>> 0);
  const { buys, army, level } = botBuys(emptyArmy(color, king, bench), gold, round, rng, cfg, from);
  const open = cfg.buySeconds - cfg.lockSeconds - 1;
  // It locks in (its board freezes) at a seeded time in the open part of the step, or now and then never; its last piece goes down a moment before.
  const never = lockRng() < cfg.bot.neverLockChance;
  const lockAt = never ? null : open * (cfg.bot.lockFrom + (cfg.bot.lockTo - cfg.bot.lockFrom) * lockRng());
  const span = lockAt === null ? open : lockAt - 0.2;
  // Its pieces go down evenly from a second in until `placeBy` of the way through (so there is something on its board to reveal early
  // and the circles show up over the first part of the step); a reroll or XP comes a moment before the piece it was for.
  const pieces = buys.filter((b) => b.type !== "reroll" && b.type !== "xp").length;
  const first = Math.min(1, span / 4);
  const last = Math.max(first, span * cfg.bot.placeBy);
  let slot = 0;
  const events: BotEvent[] = buys.map((buy) => {
    const piece = buy.type !== "reroll" && buy.type !== "xp";
    const base = first + ((last - first) * (slot + 0.5)) / Math.max(1, pieces);
    if (piece) slot++;
    const at = piece ? base : base - 0.3 - rng() * 0.2;
    return { at: Math.min(span, Math.max(0.5, at + (rng() - 0.5) * 0.04 * span)), type: buy.type, kind: buy.kind, square: buy.square, price: buy.price };
  });
  events.sort((a, b) => a.at - b.at);
  return { events, army, level, spent: events.reduce((sum, e) => sum + e.price, 0), lockAt };
}

/** What the bot has done by `seconds` into the step: the pieces on the board, the gold it has spent and the XP it has bought (times). */
export function botAt(events: readonly BotEvent[], seconds: number): { squares: Record<string, Kind>; spent: number; xpBuys: number } {
  const squares: Record<string, Kind> = {};
  let spent = 0;
  let xpBuys = 0;
  for (const e of events) {
    if (e.at > seconds) break;
    // (A held piece isn't on the board: you see where pieces stand, not what is on its bench.)
    if ((e.type === "buy" || e.type === "place") && e.square && e.kind !== "reroll" && e.kind !== "xp") squares[e.square] = e.kind;
    spent += e.price;
    if (e.type === "xp") xpBuys++;
  }
  return { squares, spent, xpBuys };
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
