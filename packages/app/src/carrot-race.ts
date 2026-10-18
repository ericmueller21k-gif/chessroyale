/**
 * Chub & Chirp's Carrot Patch in words and on the reel, from the settings (BOSS_POWERS.carrotOdds, carrotCount), so the
 * ladder, the reel and the FAQ always say what the rules do (docs/decisions/2026-10-18-hopper-wired.md). Pure: no
 * screen, no clock.
 */
import { BOSS_POWERS, type BossPowerSettings } from "@chessroyale/core";

type Odds = Pick<BossPowerSettings, "carrotOdds" | "carrotCount">;

const ONE: Record<string, string> = { p: "a pawn", n: "a knight", b: "a bishop", r: "a rook", q: "a queen" };
const BARE: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };
const MANY: Record<string, string> = { p: "pawns", n: "knights", b: "bishops", r: "rooks", q: "queens" };
const COUNT = ["no", "one", "two", "three", "four"];
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

/** A prize's key, its pieces sorted ("" for nothing): two prizes are the same when their keys are. */
export const prizeKey = (prize: readonly string[]): string => [...prize].sort().join("");

/** A prize in words: "nothing", "a knight", "two pawns", "a queen and a rook". */
export function prizeWords(prize: readonly string[]): string {
  if (!prize.length) return "nothing";
  const kinds = [...new Set(prize)].sort((a, b) => VALUE[b]! - VALUE[a]!);
  return kinds
    .map((k) => {
      const n = prize.filter((x) => x === k).length;
      return n === 1 ? ONE[k]! : `${COUNT[n] ?? n} ${MANY[k]}`;
    })
    .join(" and ");
}

const worth = (prize: readonly string[]) => prize.reduce((t, x) => t + VALUE[x]!, 0);

/**
 * His ladder's line for a count of carrots (Eric's sheet: "0: nothing · 1: a pawn or two · 2: up to a knight or bishop ·
 * 3: up to a queen and a rook · 4: two queens · 5: he wins"), from the odds: one prize, its name; one kind of piece in
 * several counts, "a pawn or two"; else "up to" the best prize (those tied for best: "a knight or bishop"). The count
 * that wins the battle: "they win".
 */
export function ladderWords(tier: number, s: Odds = BOSS_POWERS): string {
  if (tier >= s.carrotCount) return "they win";
  const row = s.carrotOdds[Math.min(tier, s.carrotOdds.length - 1)]!.map((x) => x.prize);
  const keys = [...new Set(row.map(prizeKey))];
  if (keys.length === 1) return prizeWords(row[0]!);
  const kinds = new Set(row.flat());
  if (kinds.size === 1 && row.every((p) => p.length)) {
    const k = [...kinds][0]!;
    const most = Math.max(...row.map((p) => p.length));
    return `${ONE[k]} or ${COUNT[most] ?? most}`;
  }
  const best = Math.max(...row.map(worth));
  const top = row.filter((p) => worth(p) === best);
  // (Tied for best, each a single piece: "a knight or bishop".)
  if (top.length > 1 && top.every((p) => p.length === 1)) return `up to ${ONE[top[0]![0]!]} or ${top.slice(1).map((p) => BARE[p[0]!]).join(" or ")}`;
  return `up to ${prizeWords(top[0]!)}`;
}

/** Each count's prizes and their odds, in words, for the FAQ: "a pawn 60%, two pawns 40%"; "two queens, every time". */
export function oddsWords(tier: number, s: Odds = BOSS_POWERS): string {
  if (tier >= s.carrotCount) return "they win the battle on the spot";
  const row = s.carrotOdds[Math.min(tier, s.carrotOdds.length - 1)]!;
  if (row.length === 1) return row[0]!.prize.length ? `${prizeWords(row[0]!.prize)}, every time` : "nothing: every card on the reel is blank";
  return row.map((x) => `${prizeWords(x.prize)} ${Math.round(x.p * 100)}%`).join(", ");
}

/** What a count's spin is worth on average, in pawns (a pawn 1, a knight or bishop 3, a rook 5, a queen 9). */
export function averageWorth(tier: number, s: Odds = BOSS_POWERS): number {
  if (tier >= s.carrotCount) return 0;
  return s.carrotOdds[Math.min(tier, s.carrotOdds.length - 1)]!.reduce((t, x) => t + x.p * worth(x.prize), 0);
}

// ---------------- The reel ----------------

/** The reel: `cards` cards in its strip (each prize as often as its odds), passing the line `turns` times over before it stops. */
export const REEL = { cards: 20, turns: 1 } as const;

/**
 * The reel's strip for a count of carrots: REEL.cards cards, each a prize (pieces as letters; [] a blank card), each
 * prize as often as its odds for that count (largest remainders when the odds don't divide evenly), spread out evenly
 * (smooth weighted round robin: the same strip every time, whatever was rolled). No carrots: every card blank; four:
 * every card two queens.
 */
export function reelStrip(tier: number, s: Odds = BOSS_POWERS, cards: number = REEL.cards): string[][] {
  const row = tier >= s.carrotCount ? [{ prize: [] as readonly string[], p: 1 }] : s.carrotOdds[Math.min(Math.max(0, tier), s.carrotOdds.length - 1)]!;
  const exact = row.map((x) => x.p * cards);
  const count = exact.map(Math.floor);
  const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; count.reduce((a, b) => a + b, 0) < cards; k++) count[order[k % order.length]![1]]!++;
  const cw = row.map(() => 0);
  const out: string[][] = [];
  for (let i = 0; i < cards; i++) {
    let pick = 0;
    for (let j = 0; j < row.length; j++) {
      cw[j]! += count[j]!;
      if (cw[j]! > cw[pick]!) pick = j;
    }
    cw[pick]! -= cards;
    out.push([...row[pick]!.prize]);
  }
  return out;
}

/** A small, stable hash (FNV-1a), so every screen picks the same card. */
const hash = (s: string) => [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/**
 * Where the reel stops: on a card showing what was rolled, one of those picked by the moment's key alone (the same on
 * every screen; never by what's next to it, so never a stop chosen just past the jackpot), after REEL.turns full turns of
 * the strip. Returns how many cards it travels (from card 0 on the line) and that card's index in the strip.
 */
export function reelStop(strip: readonly (readonly string[])[], rolled: readonly string[], key: string): { travel: number; card: number } {
  const want = prizeKey(rolled);
  const matches = strip.flatMap((p, i) => (prizeKey(p) === want ? [i] : []));
  // (A prize the strip can't show, which the rules never roll: the first card.)
  const card = matches.length ? matches[hash(key) % matches.length]! : 0;
  return { travel: REEL.turns * strip.length + card, card };
}

/** How far the reel has gone at `u` (0 to 1 of its run), in cards: fast at first, slowing to a stop (an ease-out cubic). */
export const reelAt = (travel: number, u: number): number => travel * (1 - (1 - Math.max(0, Math.min(1, u))) ** 3);
