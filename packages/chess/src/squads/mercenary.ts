import { Chess } from "chess.js";
import { SQUADS, type MercItem, type Rng, type SquadsSettings } from "@chessroyale/core";
import type { MoveScore } from "../uci.ts";
import { allowedMoves, piecesOf } from "./blocks.ts";
import type { BoardResult, Colour } from "./board.ts";

/**
 * Mercenary mode's economy (Eric, Oct 12; DECISIONS.md, "Squads modes: Mercenary"), pure: what a squad earns, its
 * wallet, the team shop, and the items it brings to its next match. Every number is `SQUADS.mercenary`.
 *
 * - **Earning.** A squad earns coins by play: a capture by the piece taken, a board won (more for a checkmate) or
 *   drawn, a match won, and a brilliant move (judged later from the judge's top moves). The match's rules emit each as a
 *   "coins" event (match.ts); the lobby adds them to the squad's wallet. Between rounds the squad that has earned less
 *   than its next opponent gets catch-up coins.
 * - **The shop.** One wallet per squad, shared by its players, carried from round to round. After each round, a squad
 *   still in may buy items for its next match: each item's price rises by `priceStep` for every one of it the squad has
 *   already bought this tournament, and at most `cap` of an item go into one round. What's bought (the cart) is that
 *   match's kit, used there or lost.
 * - **The items.** A Stockfish token (your own top moves for one decision, on your own device; never theirs), a
 *   breather (the free seconds a move multiplied), block points (more block bank), a shield (the next block against you
 *   that would take effect is cancelled, its points still spent) and a time coin (more team bank).
 */

/** The items in the shop's order: strongest first. */
export const MERC_ITEMS: readonly MercItem[] = ["stockfish", "breather", "blocks", "shield", "time"];
export type ItemCounts = Readonly<Record<MercItem, number>>;
export const NO_ITEMS: ItemCounts = { stockfish: 0, breather: 0, blocks: 0, shield: 0, time: 0 };
export const isMercItem = (x: unknown): x is MercItem => typeof x === "string" && (MERC_ITEMS as readonly string[]).includes(x);

// ---------------- Earning ----------------

/** Why coins came in: play (counted in a squad's `earned`), or catch-up and a test lobby's wallet (not counted). */
export type CoinWhy = "capture" | "board_win" | "mate" | "board_draw" | "match_win" | "brilliant" | "catch_up" | "test";
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

/** The coins a capture earns. */
export const captureCoins = (piece: CapturePiece, s: SquadsSettings = SQUADS): number => s.mercenary.capture[piece];

/** What a finished board earns: the winning colour its win (and the mate bonus), or each colour the draw. */
export function boardCoins(result: BoardResult, s: SquadsSettings = SQUADS): { colour: Colour; coins: number; why: CoinWhy }[] {
  const c = s.mercenary;
  if (result.winner === null) {
    return c.boardDraw ? [{ colour: "w", coins: c.boardDraw, why: "board_draw" }, { colour: "b", coins: c.boardDraw, why: "board_draw" }] : [];
  }
  const out = [{ colour: result.winner, coins: c.boardWin, why: "board_win" as CoinWhy }];
  if (result.reason === "checkmate" && c.mate) out.push({ colour: result.winner, coins: c.mate, why: "mate" });
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
}

export function newWallet(squadId: number): Wallet {
  return { squadId, coins: 0, earned: 0, byRound: [0, 0, 0], catchUp: 0, bought: NO_ITEMS, cart: NO_ITEMS };
}

/** An item's price when the squad has already bought `before` of it this tournament. */
export const itemPrice = (item: MercItem, before: number, s: SquadsSettings = SQUADS): number => s.mercenary.items[item].price + s.mercenary.priceStep * Math.max(0, before);

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
  if (w.cart[item] >= s.mercenary.items[item].cap) return { error: "cap" };
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

/** The shop closes as the next match starts: the cart becomes that match's kit, and the wallet's cart empties. */
export function takeCart(w: Wallet): { wallet: Wallet; kit: ItemCounts } {
  return { wallet: { ...w, cart: NO_ITEMS }, kit: w.cart };
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
 * by `weights` among those it can still afford and hasn't capped. Sensible, not perfect: blocks and time most, a
 * Stockfish token now and then. Returns the items in the order to buy them.
 */
export function botShop(rng: Rng, w: Wallet, final: boolean, s: SquadsSettings = SQUADS): MercItem[] {
  const b = s.mercenary.bots;
  if (!final && rng() < b.saveChance) return [];
  const budget = final ? w.coins : Math.floor(w.coins * (b.spend[0] + rng() * (b.spend[1] - b.spend[0])));
  const out: MercItem[] = [];
  let wallet = w;
  let spent = 0;
  for (let guard = 0; guard < 20; guard++) {
    const open = MERC_ITEMS.filter((it) => wallet.cart[it] < s.mercenary.items[it].cap && nextPrice(wallet, it, s) <= Math.min(wallet.coins, budget - spent));
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
