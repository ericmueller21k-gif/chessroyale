import { Chess } from "chess.js";
import { SQUADS, type MercItem, type Rng, type SquadsSettings } from "@chessroyale/core";
import type { MoveScore } from "../uci.ts";
import { allowedMoves, piecesOf } from "./blocks.ts";
import type { BoardResult, Colour } from "./board.ts";

/**
 * Mercenary mode's economy (Eric, Oct 12; DECISIONS.md, "Squads modes: Mercenary"), pure: what a squad earns, its
 * wallet, the team shop, and the items it brings to its next match. Every number is `SQUADS.mercenary`.
 *
 * - **Earning** (Eric, Oct 13: shaped like Counter-Strike's or Valorant's economy). Most of it is a steady base: every
 *   match a squad plays pays it, win or lose, and winning pays more. Play adds a smaller layer: a capture by the piece
 *   taken, a board won (more for a checkmate) or drawn, and a brilliant move (judged later from the judge's top moves;
 *   at most a few a match). The match's rules emit each as a "coins" event (match.ts); the lobby adds them to the
 *   squad's wallet. Between rounds the squad that has earned less than its next opponent gets catch-up coins (the loss
 *   bonus's job: keeping the squads still in close).
 * - **The shop.** One wallet per squad, shared by its players, carried from round to round. After each round, a squad
 *   still in may buy items for its next match: each item's price rises by `priceStep` for every one of it the squad has
 *   already bought this tournament (the Time chip: its own price list), and at most `cap` of an item go into one round.
 *   What's bought (the cart) is that match's kit, used there or lost; Time chips are kept (at most `cap` held).
 * - **The items.** A Stockfish token (your own top moves for one decision, on your own device; never theirs), block
 *   points (more block bank), a shield (the next block against you that would take effect is canceled, its points
 *   still spent) and Time chips (Eric, Oct 13: tapped on a move for more time on it, kept until used). Items since
 *   taken out (the Breather; the time coin, which became the Time chip) are read away from stored lobbies by
 *   `itemCounts` and `upgradeWallet`.
 */

/** The items in the shop's order: strongest first. */
export const MERC_ITEMS: readonly MercItem[] = ["stockfish", "blocks", "shield", "chip"];
export type ItemCounts = Readonly<Record<MercItem, number>>;
export const NO_ITEMS: ItemCounts = { stockfish: 0, blocks: 0, shield: 0, chip: 0 };
export const isMercItem = (x: unknown): x is MercItem => typeof x === "string" && (MERC_ITEMS as readonly string[]).includes(x);

/**
 * Counts of today's items only, from a stored record that may hold an item since taken out (the Breather and the time
 * coin, Oct 13) or miss one: unknown items dropped, missing ones 0. A kit or cart stored before a deploy never crashes
 * the rules.
 */
export function itemCounts(x: unknown): ItemCounts {
  const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return { stockfish: n(r.stockfish), blocks: n(r.blocks), shield: n(r.shield), chip: n(r.chip) };
}

// ---------------- Earning ----------------

/** Why coins came in: play (counted in a squad's `earned`), or catch-up and a test lobby's wallet (not counted). */
export type CoinWhy = "played" | "capture" | "board_win" | "mate" | "board_draw" | "match_win" | "brilliant" | "catch_up" | "test";
/** Coins from play: what catch-up compares. */
export const fromPlay = (why: CoinWhy): boolean => why !== "catch_up" && why !== "test";

export type CapturePiece = "p" | "n" | "b" | "r" | "q";

/** The piece a move (UCI) takes in a position, or null: what's on its target square, or a pawn taken en passant. */
export function capturedPiece(fen: string, move: string): CapturePiece | null {
  const board = piecesOf(fen);
  const from = board.get(move.slice(0, 2));
  const target = board.get(move.slice(2, 4));
  if (!from) return null;
  const white = from === from.toUpperCase();
  if (target) {
    const t = target.toLowerCase();
    if ((target === target.toUpperCase()) === white || t === "k") return null;
    return t as CapturePiece;
  }
  // En passant: a pawn moving diagonally onto the en passant square.
  if (from.toLowerCase() === "p" && move[0] !== move[2] && fen.split(" ")[3] === move.slice(2, 4)) return "p";
  return null;
}

/**
 * A board's coins in a round (captures, its win, mate and draw) are the base times `roundScale[round]`: fewer boards
 * a round, more each (Relay 4 boards, Pairs 2, the final 1), so every round pays about the same (Eric, Oct 13: about
 * 500-800 coins a squad a round). Armageddon is the final's round.
 */
export const roundScale = (round: number, s: SquadsSettings = SQUADS): number => s.mercenary.roundScale[round] ?? 1;

/** The coins a capture earns in a round. */
export const captureCoins = (piece: CapturePiece, round: number, s: SquadsSettings = SQUADS): number => Math.round(s.mercenary.capture[piece] * roundScale(round, s));

/** What a finished board earns in a round: the winning color its win (and the mate bonus), or each color the draw. */
export function boardCoins(result: BoardResult, round: number, s: SquadsSettings = SQUADS): { colour: Colour; coins: number; why: CoinWhy }[] {
  const c = s.mercenary;
  const k = roundScale(round, s);
  const draw = Math.round(c.boardDraw * k);
  if (result.winner === null) {
    return draw ? [{ colour: "w", coins: draw, why: "board_draw" }, { colour: "b", coins: draw, why: "board_draw" }] : [];
  }
  const out = [{ colour: result.winner, coins: Math.round(c.boardWin * k), why: "board_win" as CoinWhy }];
  if (result.reason === "checkmate" && c.mate) out.push({ colour: result.winner, coins: Math.round(c.mate * k), why: "mate" });
  return out;
}

// ---------------- Brilliant moves ----------------

/** A move played that may have been brilliant: where, the position, the move, who found it (none with a token). */
export interface BrilliantCandidate {
  board: number;
  /** The side that played it (side of the match). */
  side: 0 | 1;
  fen: string;
  move: string;
  /** Plies from the board's start position. */
  ply: number;
  /** Who picked it without a Stockfish token's lines on screen. */
  finders: readonly string[];
  /** Moves blocks took away then (not theirs to play). */
  blocked: readonly string[];
}

/**
 * Whether a move could be brilliant before asking the judge: from ply `fromPly`, not a capture (taking a loose piece
 * is often the only move, and capturing already pays), not out of check (an answer to a check is often forced), with
 * at least one finder who had no Stockfish token's lines.
 */
export function brilliantCandidate(c: Omit<BrilliantCandidate, never>, s: SquadsSettings = SQUADS): boolean {
  if (!c.finders.length || c.ply < s.mercenary.brilliant.fromPly) return false;
  if (capturedPiece(c.fen, c.move)) return false;
  try {
    if (new Chess(c.fen).inCheck()) return false;
  } catch {
    return false;
  }
  return allowedMoves(c.fen, c.blocked).length > 1;
}

/**
 * The judge's verdict: brilliant if the move was the best of the moves that could be played (blocked ones left out)
 * and beat every other the judge listed by at least `brilliant.gap` of expected score, in a position still in the
 * balance (the best's expected score at least `decided` from either end), with at least two lines to compare. No
 * judge (null): not brilliant.
 */
export function isBrilliant(c: Pick<BrilliantCandidate, "fen" | "move" | "blocked">, top: readonly MoveScore[] | null, s: SquadsSettings = SQUADS): boolean {
  const b = s.mercenary.brilliant;
  if (!top || top.length < 2) return false;
  const allowed = new Set(allowedMoves(c.fen, c.blocked));
  const lines = top.filter((t) => allowed.has(t.move)).sort((x, y) => y.expected - x.expected);
  const best = lines[0];
  if (!best || best.move !== c.move || lines.length < 2) return false;
  if (best.expected >= 1 - b.decided || best.expected <= b.decided) return false;
  return best.expected - lines[1]!.expected >= b.gap - 1e-9;
}

/**
 * What a brilliant move pays its squad when the squad has already been paid for `paid` of them in this match (a
 * bracket match: Armageddon counts with the final it settles): `brilliant.coins` until `capPerMatch`, then nothing
 * (`capped`: still announced, "no coins").
 */
export function brilliantPay(paid: number, s: SquadsSettings = SQUADS): { coins: number; capped: boolean } {
  const b = s.mercenary.brilliant;
  return paid < b.capPerMatch ? { coins: b.coins, capped: false } : { coins: 0, capped: true };
}

// ---------------- Wallets and the shop ----------------

/** A squad's wallet for the tournament (shared by its players; everyone may see every squad's). */
export interface Wallet {
  squadId: number;
  coins: number;
  /** Coins earned by play this tournament (catch-up and a test wallet not counted): what catch-up compares. */
  earned: number;
  /** Earned by play in each round (round 1, round 2, the final). */
  byRound: readonly [number, number, number];
  /** Catch-up coins received this tournament. */
  catchUp: number;
  /** Bought this tournament, by item: each one raises the next one's price. */
  bought: ItemCounts;
  /** Bought for the next match (the shop's cart): that match's kit. */
  cart: ItemCounts;
  /** Time chips the squad holds between matches (in a match they're the match's, `SquadsMatch.chips`, until it ends). */
  chips: number;
}

export function newWallet(squadId: number): Wallet {
  return { squadId, coins: 0, earned: 0, byRound: [0, 0, 0], catchUp: 0, bought: NO_ITEMS, cart: NO_ITEMS, chips: 0 };
}

/**
 * An item's price when the squad has already bought `before` of it this tournament: its first price plus `priceStep`
 * for each, or its own price list (the Time chip: 25, 25, 50, 50, then 50 each; the last repeats).
 */
export function itemPrice(item: MercItem, before: number, s: SquadsSettings = SQUADS): number {
  const it = s.mercenary.items[item];
  const n = Math.max(0, before);
  if (it.prices?.length) return it.prices[Math.min(n, it.prices.length - 1)]!;
  return it.price + s.mercenary.priceStep * n;
}

/** How many of an item one more would make, against its cap: in the cart (the Time chip: held and in the cart). */
export const capCount = (w: Pick<Wallet, "cart" | "chips">, item: MercItem): number => w.cart[item] + (item === "chip" ? (w.chips ?? 0) : 0);

/** What the next one of an item costs this squad. */
export const nextPrice = (w: Pick<Wallet, "bought">, item: MercItem, s: SquadsSettings = SQUADS): number => itemPrice(item, w.bought[item], s);

/** Coins into a wallet (play counts in `earned` and the round's tally; catch-up in `catchUp`). */
export function earn(w: Wallet, coins: number, why: CoinWhy, round: 0 | 1 | 2): Wallet {
  if (!coins) return w;
  const play = fromPlay(why);
  const byRound: [number, number, number] = [...w.byRound];
  if (play) byRound[round] += coins;
  return { ...w, coins: w.coins + coins, earned: w.earned + (play ? coins : 0), byRound, catchUp: w.catchUp + (why === "catch_up" ? coins : 0) };
}

/** closed: no shop now (the squad is playing, or out); cap: as many as one round allows; coins: not enough. */
export type ShopError = "closed" | "unknown_item" | "cap" | "coins" | "none";

/** Buys one of an item for the next match, from the wallet: at its price now, within the round's cap. */
export function buyItem(w: Wallet, item: MercItem, s: SquadsSettings = SQUADS): { wallet: Wallet; price: number } | { error: ShopError } {
  if (!isMercItem(item)) return { error: "unknown_item" };
  if (capCount(w, item) >= s.mercenary.items[item].cap) return { error: "cap" };
  const price = nextPrice(w, item, s);
  if (w.coins < price) return { error: "coins" };
  return { wallet: { ...w, coins: w.coins - price, bought: { ...w.bought, [item]: w.bought[item] + 1 }, cart: { ...w.cart, [item]: w.cart[item] + 1 } }, price };
}

/** Puts one back (a change of mind while the shop is open): the last one bought, refunded at what it cost. */
export function unbuyItem(w: Wallet, item: MercItem, s: SquadsSettings = SQUADS): { wallet: Wallet; refund: number } | { error: ShopError } {
  if (!isMercItem(item)) return { error: "unknown_item" };
  if (w.cart[item] <= 0) return { error: "none" };
  const refund = itemPrice(item, w.bought[item] - 1, s);
  return { wallet: { ...w, coins: w.coins + refund, bought: { ...w.bought, [item]: w.bought[item] - 1 }, cart: { ...w.cart, [item]: w.cart[item] - 1 } }, refund };
}

/**
 * The shop closes as the next match starts: the cart becomes that match's kit, and the wallet's cart empties. The Time
 * chips the squad holds go into the match with the ones just bought (the kit's `chip`: all it brings).
 */
export function takeCart(w: Wallet): { wallet: Wallet; kit: ItemCounts } {
  return { wallet: { ...w, cart: NO_ITEMS, chips: 0 }, kit: { ...w.cart, chip: w.cart.chip + (w.chips ?? 0) } };
}

/** A match ends: the Time chips its squad didn't use come back to the wallet, kept for the next round. */
export const returnChips = (w: Wallet, chips: number): Wallet => ({ ...w, chips: (w.chips ?? 0) + Math.max(0, chips) });

/** The first prices of items since taken out (Oct 13), each then up by the price step for every one bought. */
const GONE_ITEMS: Readonly<Record<string, number>> = { breather: 150, time: 75 };

/**
 * A wallet stored by an earlier version (a lobby in play across a deploy): an item since taken out (the Breather; the
 * time coin, now the Time chip) still in the cart (the shop open) is refunded at what it cost, and dropped from the
 * counts; a wallet from before the Time chip holds none. Others come back as they were.
 */
export function upgradeWallet(w: Wallet, s: SquadsSettings = SQUADS): Wallet {
  const bought = w.bought as Partial<Record<string, number>>;
  const cart = w.cart as Partial<Record<string, number>>;
  const gone = Object.keys(GONE_ITEMS).filter((k) => k in bought || k in cart);
  if (!gone.length && typeof w.chips === "number" && "chip" in bought && "chip" in cart) return w;
  let refund = 0;
  for (const k of gone) {
    const inCart = Math.max(0, cart[k] ?? 0);
    const before = Math.max(0, (bought[k] ?? 0) - inCart);
    for (let i = 0; i < inCart; i++) refund += GONE_ITEMS[k]! + s.mercenary.priceStep * (before + i);
  }
  return { ...w, coins: w.coins + refund, bought: itemCounts(w.bought), cart: itemCounts(w.cart), chips: typeof w.chips === "number" ? w.chips : 0 };
}

/**
 * Catch-up as a match of round 2 or the final is set: the squad that has earned fewer coins by play this tournament
 * gets `share` of the difference (to the nearest `round`, at most `max`); the other none. Spending never counts, so
 * spending first can't earn it.
 */
export function catchUpCoins(earned: readonly [number, number], s: SquadsSettings = SQUADS): [number, number] {
  const c = s.mercenary.catchUp;
  const gap = Math.abs(earned[0] - earned[1]);
  const coins = Math.min(c.max, Math.round((gap * c.share) / c.round) * c.round);
  if (!coins) return [0, 0];
  return earned[0] < earned[1] ? [coins, 0] : [0, coins];
}

// ---------------- Bots ----------------

/**
 * A bot squad's shopping (nobody playing on it): before the final it saves everything with `saveChance`; otherwise it
 * spends up to a share of its wallet in `spend` (the final, the last chance: all of it), one item at a time, each drawn
 * by `weights` among those it can still afford and hasn't capped. Sensible, not perfect: blocks and chips most, a
 * Stockfish token now and then; Time chips up to what it may hold. Returns the items in the order to buy them.
 */
export function botShop(rng: Rng, w: Wallet, final: boolean, s: SquadsSettings = SQUADS): MercItem[] {
  const b = s.mercenary.bots;
  if (!final && rng() < b.saveChance) return [];
  const budget = final ? w.coins : Math.floor(w.coins * (b.spend[0] + rng() * (b.spend[1] - b.spend[0])));
  const out: MercItem[] = [];
  let wallet = w;
  let spent = 0;
  for (let guard = 0; guard < 20; guard++) {
    const open = MERC_ITEMS.filter((it) => capCount(wallet, it) < s.mercenary.items[it].cap && nextPrice(wallet, it, s) <= Math.min(wallet.coins, budget - spent));
    const total = open.reduce((t, it) => t + b.weights[it], 0);
    if (!open.length || total <= 0) break;
    let r = rng() * total;
    const item = open.find((it) => (r -= b.weights[it]) < 0) ?? open[open.length - 1]!;
    const got = buyItem(wallet, item, s);
    if ("error" in got) break;
    wallet = got.wallet;
    spent += got.price;
    out.push(item);
  }
  return out;
}

/**
 * Whether a bot uses one of its squad's Stockfish tokens on this decision: with `stockfishSharp` when the engine's
 * best beats the next by `sharpGap` (a moment that matters), else with `stockfishChance`.
 */
export function botUsesStockfish(rng: Rng, top: readonly MoveScore[], s: SquadsSettings = SQUADS): boolean {
  const b = s.mercenary.bots;
  const sorted = [...top].sort((x, y) => y.expected - x.expected);
  const sharp = sorted.length > 1 && sorted[0]!.expected - sorted[1]!.expected >= b.sharpGap - 1e-9;
  return rng() < (sharp ? b.stockfishSharp : b.stockfishChance);
}

// ---------------- The Stockfish token's lines ----------------

/** One line a Stockfish token shows: your move and its evaluation for you. Never their reply. */
export interface TokenLine {
  move: string;
  expected: number;
  mate?: number;
}

/**
 * What a Stockfish token shows from the engine's top moves in your position (your side to move): your best `lines`
 * moves that may be played (blocked ones left out), best first, each with its evaluation, and nothing else: no
 * reply, no line beyond your move (Eric: their moves are "too broken").
 */
export function tokenLines(top: readonly MoveScore[], blocked: readonly string[], s: SquadsSettings = SQUADS): TokenLine[] {
  const off = new Set(blocked.map((m) => m.slice(0, 4)));
  return [...top]
    .filter((t) => !off.has(t.move.slice(0, 4)))
    .sort((a, b) => b.expected - a.expected)
    .slice(0, s.mercenary.stockfish.lines)
    .map((t) => ({ move: t.move, expected: t.expected, ...(t.mate !== undefined ? { mate: t.mate } : {}) }));
}

/**
 * Whether a bot squad taps one of its Time chips on a move (one a move), and when (ms into the move): in sudden death
 * with `chip.suddenDeath`, with its bank under `chip.lowBankSeconds` with `chip.lowBank`, else never. Not perfect: a
 * chip now and then where a person might, never all of them at once.
 */
export function botChipTap(rng: Rng, bankMs: number, s: SquadsSettings = SQUADS): number | null {
  const c = s.mercenary.bots.chip;
  const p = bankMs <= 0 ? c.suddenDeath : bankMs < c.lowBankSeconds * 1000 ? c.lowBank : 0;
  if (!p || rng() >= p) return null;
  return Math.round(c.tapMs[0] + rng() * (c.tapMs[1] - c.tapMs[0]));
}
