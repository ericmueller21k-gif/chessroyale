import { PLAY_COINS, XP } from "./settings.ts";
import { isXpNone, XP_NONE_LINES, type GameXp, type XpGrant, type XpNone } from "./xp.ts";

/**
 * Play coins (Eric, Nov 18; the payments design's section 6, docs/decisions/2026-11-17-payments-design.md; PLAY_COINS in
 * settings.ts; docs/decisions/2026-11-25-play-coins.md): the rules, pure. The server pays them with a game's XP, in the same batch
 * (server/xp.ts grantXp), from its own facts and the day's totals in the ledger; `scripts/coin-report.ts` runs them over a day's play.
 */

/** Why a game paid no coins: XP's reasons for no XP minutes, or fair play holding the player (in review or banned). */
export type CoinNone = XpNone | "held";

/** The result facts the server already has, for the bonus (each the server's own: the match room's, the duel's, the bracket's). */
export interface CoinResult {
  /** XP's win, as XP paid it (its caps: a friends' lobby pays it once an XP day per opponent). Never a Squads lobby's (its placement pays). */
  won?: boolean;
  /** A ranked 1 v 1 draw. */
  draw?: boolean;
  /** One of the first PLAY_COINS.crowdTopPlaces rows of your team's 50 v 50 scoreboard at the end. */
  crowdTop?: boolean;
  /** Squads: your squad's placement (1st, 2nd, 3rd-4th, 5th-8th). */
  squads?: 1 | 2 | 3 | 5;
}

/** One game, as the rules need it. */
export interface CoinGame {
  /** The game's XP before any cap (core's gameXp from the server's facts): its minutes, or why none. The same eligibility as XP's. */
  xp: GameXp;
  /** The minutes XP paid, where a cap trimmed them (a solo game's XP.soloMinutesPerDay). Default: the game's own. */
  paidMinutes?: number;
  /**
   * The device's word stood: a solo game, or an online one that rested on one device's word (XP's "solo" cap). Only the minutes XP
   * paid, with no minimum of 1, and no bonus.
   */
  solo?: boolean;
  /** Fair play is holding the player (in review, or banned): no coins (XP still decides its own). */
  held?: boolean;
  result?: CoinResult;
}

/** The XP day's coins so far: play coins, and the bonus paid (after the steps). */
export interface CoinDay {
  play: number;
  bonus: number;
}

/** One part of a game's bonus, as earned (before the day's steps): "Win" 15, "Top 3" 10, "1st place" 40. */
export interface CoinPart {
  label: string;
  coins: number;
}

/** A game's coins: what it paid, why none, and where the day stands after it. */
export interface PlayCoins {
  /** Play coins paid (the minutes', under the day's PLAY_COINS.perDay). */
  play: number;
  /** Bonus paid (the parts' sum after the day's steps). */
  bonus: number;
  /** The bonus as earned, part by part, before the steps (their sum is `bonus` only in the first step). */
  parts: CoinPart[];
  /**
   * The step of PLAY_COINS.bonusSteps the bonus fell in (where the day's earned bonus stood as this game's began): 0 in full, 1 at
   * half, 2 at a quarter, bonusSteps.length past them (none paid). Null: no bonus earned.
   */
  step: number | null;
  /** The XP day's totals after this game (for "Play today 186/300"). */
  today: CoinDay;
  none?: CoinNone;
}

/** The bonus paid for `earned` bonus coins in a day (cumulative), by the steps: continuous, never past the last step's total. */
export function bonusPaidAt(earned: number, steps = PLAY_COINS.bonusSteps): number {
  let paid = 0;
  let from = 0;
  for (const st of steps) {
    paid += Math.max(0, Math.min(earned, st.upTo) - from) * Math.max(0, st.rate);
    if (earned <= st.upTo) break;
    from = st.upTo;
  }
  return paid;
}

/** The most bonus a day can pay (300 by the design's steps). */
export const bonusMax = (steps = PLAY_COINS.bonusSteps): number => Math.floor(bonusPaidAt(steps.at(-1)?.upTo ?? 0, steps));

/** The earned bonus a day's paid bonus stands for (bonusPaidAt's inverse); Infinity past the steps (nothing more pays). */
export function bonusEarnedAt(paid: number, steps = PLAY_COINS.bonusSteps): number {
  let sum = 0;
  let from = 0;
  for (const st of steps) {
    const rate = Math.max(0, st.rate);
    const top = sum + (st.upTo - from) * rate;
    if (paid < top) return rate > 0 ? from + (paid - sum) / rate : from;
    sum = top;
    from = st.upTo;
  }
  return Infinity;
}

/** Which step the next bonus coin is paid at, with `paid` bonus paid today (bonusSteps.length: past them). */
export function bonusStep(paid: number, steps = PLAY_COINS.bonusSteps): number {
  const e = bonusEarnedAt(paid, steps);
  const i = steps.findIndex((st) => e < st.upTo);
  return i < 0 ? steps.length : i;
}

/**
 * A game's bonus paid, with `paid` bonus already paid today: the day's paid total moves from `paid` to the steps' value at the
 * earned bonus it stands for plus `earned`, rounded (half up). So a game's share is its bonus at the steps' rates from where the day's
 * paid total stands, to within half a coin (a win: 15, then 8 for 7.5, then 4 for 3.75), and the day never passes bonusMax. The
 * rounding isn't carried over (the paid total is the only state): over a day the paid total can run a few coins off the steps' exact
 * curve at the bonus earned, most with many small bonuses (only wins: 300 at the 35th, where the exact curve takes about 37; only
 * draws: up to 16.5 ahead midway, 300 at the 113th, the curve's 110th). The review's m4, Nov 25.
 */
export function bonusFor(paid: number, earned: number, steps = PLAY_COINS.bonusSteps): number {
  const max = bonusMax(steps);
  const p = Math.max(0, Math.floor(paid));
  if (earned <= 0 || p >= max) return 0;
  const to = Math.min(max, Math.round(bonusPaidAt(bonusEarnedAt(p, steps) + earned, steps)));
  return Math.max(0, to - p);
}

/** The play coins a game's minutes earn before the day's cap: `perMinute` a minute, rounded, at least 1 online (none for solo's 0). */
export function playCoinsFor(minutes: number, solo = false, s = PLAY_COINS): number {
  const n = Math.round(s.perMinute * Math.max(0, minutes));
  return solo ? n : Math.max(1, n);
}

const SQUADS_PLACE: Readonly<Record<1 | 2 | 3 | 5, string>> = { 1: "1st place", 2: "2nd place", 3: "3rd-4th place", 5: "5th-8th place" };

/** A game's bonus parts as earned (none for a game the device's word decided). */
export function coinParts(r: CoinResult | undefined, solo = false, s = PLAY_COINS): CoinPart[] {
  if (!r || solo) return [];
  const parts: CoinPart[] = [];
  if (r.squads) parts.push({ label: SQUADS_PLACE[r.squads], coins: s.bonus.squads[r.squads] });
  else if (r.won) parts.push({ label: "Win", coins: s.bonus.win });
  if (r.draw && !r.won && !r.squads) parts.push({ label: "Draw", coins: s.bonus.draw });
  if (r.crowdTop) parts.push({ label: `Top ${s.crowdTopPlaces}`, coins: s.bonus.crowdTop3 });
  return parts.filter((p) => p.coins > 0);
}

/**
 * One game's coins (PLAY_COINS): none for a game XP gives no minutes (its reasons) or a player fair play holds; else its play
 * coins under the day's `perDay` and its bonus by the day's steps. `day`: the XP day's totals before this game.
 */
export function gameCoins(g: CoinGame, day: CoinDay, s = PLAY_COINS): PlayCoins {
  const today = { play: Math.max(0, day.play), bonus: Math.max(0, day.bonus) };
  // (XP's reason first, else fair play's hold: one check, which also tells the type the game has minutes past it.)
  if (g.xp.none !== undefined || g.held) return { play: 0, bonus: 0, parts: [], step: null, today, none: g.xp.none ?? "held" };
  const minutes = Math.max(0, Math.min(g.xp.minutes, g.paidMinutes ?? g.xp.minutes));
  const solo = !!g.solo;
  const play = Math.max(0, Math.min(playCoinsFor(minutes, solo, s), s.perDay - today.play));
  const parts = coinParts(g.result, solo, s);
  const earned = parts.reduce((n, p) => n + p.coins, 0);
  const bonus = bonusFor(today.bonus, earned, s.bonusSteps);
  return {
    play,
    bonus,
    parts,
    step: earned > 0 ? bonusStep(today.bonus, s.bonusSteps) : null,
    today: { play: today.play + play, bonus: today.bonus + bonus },
  };
}

/** A game's coins as stored (JSON on its result row), or none: anything unreadable reads as none. */
export function readPlayCoins(x: unknown): PlayCoins | undefined {
  let v: unknown = x;
  if (typeof x === "string") {
    try {
      v = JSON.parse(x);
    } catch {
      return undefined;
    }
  }
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const whole = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : 0);
  const t = (o.today ?? {}) as Record<string, unknown>;
  const parts = Array.isArray(o.parts)
    ? o.parts.flatMap((p: unknown) => {
        const q = (p ?? {}) as Record<string, unknown>;
        return typeof q.label === "string" ? [{ label: q.label, coins: whole(q.coins) }] : [];
      })
    : [];
  const out: PlayCoins = {
    play: whole(o.play),
    bonus: whole(o.bonus),
    parts,
    step: typeof o.step === "number" && Number.isInteger(o.step) && o.step >= 0 ? o.step : null,
    today: { play: whole(t.play), bonus: whole(t.bonus) },
  };
  if (isXpNone(o.none) || o.none === "held") out.none = o.none;
  return out;
}

// ---- The end screen's coin strip (Nov 25; docs/decisions/2026-11-17-payments-design.md section 11, 2026-11-25-coin-strip.md) ----

/** Why a game paid no coins, in the strip's own words (short: the strip is the XP box's width, in the pixel type). */
export const COIN_NONE_LINES: Readonly<Record<CoinNone, string>> = {
  short: `No coins: under ${XP.minMoves} moves.`,
  resigned: `No coins: resigned before move ${XP.minMoves}.`,
  left: "No coins: you left the match.",
  guest: "Sign in to earn coins.",
  test: "No coins: test game.",
  banned: "No coins: this account is banned.",
  limit: "No coins: daily solo limit reached.",
  paused: "Rewards are paused for a moment.",
  held: "No coins while your account is in review.",
};

/** What the coin strip shows for a game's grant: the total and its parts (in the order they're counted), the day's play, or why none. */
export interface CoinStripView {
  total: number;
  /** Play coins first ("Play"; never the minutes: XP's rule, Nov 9), then the bonus parts as paid (the steps' share of each). */
  parts: { label: string; coins: number }[];
  /** "PLAY TODAY 186/300" or "PLAY TODAY 300/300 · FULL". */
  today: string;
  /** Why none (the strip greyed): null when it pays. */
  why: string | null;
}

/**
 * The strip's view of a game's grant (the result row's first answer: the game's own, never a later replay's day). `none`: the screen's
 * line for a game with no grant (an XP_NONE_LINES line maps to its coins' line). A bonus the day's steps cut is split over its parts
 * by their shares, largest remainder first, so the parts always add up to what was paid.
 */
export function coinStripView(xp: XpGrant | null, none?: string, s = PLAY_COINS): CoinStripView {
  const c = xp?.coins;
  const off = (why: string): CoinStripView => ({ total: 0, parts: [], today: c ? todayLine(c.today.play, s) : "", why });
  if (!xp) {
    const k = (Object.keys(XP_NONE_LINES) as XpNone[]).find((k) => XP_NONE_LINES[k] === none);
    return off(k ? COIN_NONE_LINES[k] : "No coins for this game.");
  }
  const reason = c?.none ?? xp.none;
  if (reason) return off(COIN_NONE_LINES[reason]);
  if (!c) return off("No coins for this game.");
  const total = c.play + c.bonus;
  if (total <= 0) return off(c.today.play >= s.perDay ? `No coins: today's ${s.perDay} play coins are earned.` : "No coins this game.");
  return { total, parts: [...(c.play > 0 ? [{ label: "Play", coins: c.play }] : []), ...splitBonus(c.parts, c.bonus)], today: todayLine(c.today.play, s), why: null };
}

const todayLine = (play: number, s = PLAY_COINS) => `PLAY TODAY ${Math.min(play, s.perDay)}/${s.perDay}${play >= s.perDay ? " · FULL" : ""}`;

/** The bonus paid, split over the parts as earned by their shares (largest remainder), summing to `paid`; parts at 0 left out. */
export function splitBonus(parts: readonly CoinPart[], paid: number): { label: string; coins: number }[] {
  const earned = parts.reduce((n, p) => n + p.coins, 0);
  if (earned <= 0 || paid <= 0) return [];
  const raw = parts.map((p) => (p.coins * paid) / earned);
  const out = raw.map((r, i) => ({ label: parts[i]!.label, coins: Math.floor(r), rem: r - Math.floor(r), i }));
  let left = paid - out.reduce((n, p) => n + p.coins, 0);
  for (const p of [...out].sort((a, b) => b.rem - a.rem || a.i - b.i)) {
    if (left <= 0) break;
    p.coins++;
    left--;
  }
  return out.filter((p) => p.coins > 0).map(({ label, coins }) => ({ label, coins }));
}
