import { RANKED_1V1, type DuelControl } from "./settings.ts";

/**
 * Ranked 1 v 1's math (pure; shared by the server, which alone decides ranks, and the app, which shows them):
 * the time-control vote's rule, the hidden rating (Glicko-1), the visible ladder (tiers, divisions, rank points,
 * placements), pairing by rating, and the coins a game pays. Every number is in RANKED_1V1 (settings.ts); see
 * docs/areas/ranked.md and docs/decisions/2026-10-16-ranked-1v1.md.
 */

type Settings = typeof RANKED_1V1;

// ---------------- The time-control vote ----------------

/** The vote's three zones, left to right on every screen: Bullet, Blitz, Rapid. */
export const DUEL_ZONES = ["bullet", "blitz", "rapid"] as const;
export type DuelZone = (typeof DUEL_ZONES)[number];
export const isDuelZone = (z: unknown): z is DuelZone => typeof z === "string" && (DUEL_ZONES as readonly string[]).includes(z);

/** A control by its id; one we don't know (or none) gets the default, never an error. */
export function duelControl(id: string | null | undefined, s: Settings = RANKED_1V1): DuelControl {
  return s.controls.find((c) => c.id === id) ?? s.controls.find((c) => c.id === s.defaultControl) ?? s.controls[0]!;
}

/** A zone's place in the list of controls: Bullet the first, Blitz the middle, Rapid the last. */
function zonePlace(z: DuelZone, n: number): number {
  return z === "bullet" ? 0 : z === "rapid" ? n - 1 : (n - 1) / 2;
}

/** The control a zone stands for (Bullet 1+1, Blitz 3+2, Rapid 10+5). */
export const zoneControl = (z: DuelZone, s: Settings = RANKED_1V1): DuelControl => s.controls[zonePlace(z, s.controls.length)]!;

/**
 * The time control two picks give (Eric, Oct 16): halfway between them. The same pick: that control; picks next to
 * each other: the one between them; Bullet against Rapid: Blitz. A player who didn't pick has no say, so the other's
 * pick counts; neither picked: the default (Blitz).
 */
export function votedControl(white: DuelZone | null | undefined, black: DuelZone | null | undefined, s: Settings = RANKED_1V1): DuelControl {
  const n = s.controls.length;
  const picks = [white, black].filter(isDuelZone).map((z) => zonePlace(z, n));
  if (!picks.length) return duelControl(s.defaultControl, s);
  return s.controls[Math.round(picks.reduce((a, x) => a + x, 0) / picks.length)]!;
}

/** Minutes as chess writes them in a time control ("3" in 3+2; "1.5" for 90 s). */
const minutes = (seconds: number) => String(Math.round((seconds / 60) * 100) / 100);

/** "Blitz 3+2": the control as chess writes it (the overlay is "Timer: " and this). */
export const controlLabel = (c: DuelControl) => `${c.name} ${minutes(c.baseSeconds)}+${c.incrementSeconds}`;

// ---------------- The hidden rating (Glicko-1) ----------------

/** A player's hidden rating and how sure it is (its deviation, RD). */
export interface HiddenRating {
  rating: number;
  rd: number;
}

const Q = Math.LN10 / 400;
const g = (rd: number) => 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));

/** The expected score of `me` against `opp` (0-1), as Glicko-1 has it (the opponent's uncertainty flattens it). */
export function expectedScore(me: HiddenRating, opp: HiddenRating): number {
  return 1 / (1 + 10 ** ((-g(opp.rd) * (me.rating - opp.rating)) / 400));
}

/** The deviation after `days` without a game: it grows back toward the start, as Glicko-1's c does. */
export function rdAfterIdle(rd: number, days: number, s: Settings = RANKED_1V1): number {
  return Math.min(s.rating.startRd, Math.sqrt(rd * rd + s.rating.rdPerDay ** 2 * Math.max(0, days)));
}

/** One game's update (a rating period of one game): `score` 1, ½ or 0 for `me`. The deviation never drops below minRd. */
export function glickoUpdate(me: HiddenRating, opp: HiddenRating, score: number, s: Settings = RANKED_1V1): HiddenRating {
  const gj = g(opp.rd);
  const e = expectedScore(me, opp);
  const d2 = 1 / (Q * Q * gj * gj * e * (1 - e));
  const precision = 1 / (me.rd * me.rd) + 1 / d2;
  return {
    rating: me.rating + (Q / precision) * gj * (score - e),
    rd: Math.max(s.rating.minRd, Math.sqrt(1 / precision)),
  };
}

/** A new player's hidden rating: their account's rating from other modes (clamped), or the start. */
export function seedRating(accountRating: number | null | undefined, s: Settings = RANKED_1V1): number {
  return typeof accountRating === "number" && Number.isFinite(accountRating) ? Math.min(s.rating.seedMax, Math.max(s.rating.seedMin, Math.round(accountRating))) : s.rating.start;
}

// ---------------- The ladder ----------------

/** The ladder's points below the first apex tier (Master): tiers × divisions × points a division (2800). */
export const apexStart = (s: Settings = RANKED_1V1) => s.tiers.length * s.divisions * s.pointsPerDivision;

/** The hidden rating a place on the ladder stands for. */
export const ladderRating = (ladder: number, s: Settings = RANKED_1V1) => s.baseRating + ladder * s.ratingPerPoint;

/** Where the placements put a hidden rating on the ladder: from Iron 4 0 up to placements.maxLadder (Diamond 4 0). */
export function placeLadder(rating: number, s: Settings = RANKED_1V1): number {
  return Math.max(0, Math.min(s.placements.maxLadder, Math.floor((rating - s.baseRating) / s.ratingPerPoint)));
}

/** A player's rank as it shows: in placements, or a tier (and its division, below the apex) with its rank points. */
export interface RankView {
  /** Still in placements: games played of the placements' count. */
  placement: { played: number; of: number } | null;
  /** The tier's name ("Gold", "Master"), or "Placement". */
  tier: string;
  /** 4 (lowest) to 1 in a tier below the apex; null at the apex and in placements. */
  division: number | null;
  /** Rank points: within the division (0-99), or above Master's start at the apex. */
  points: number;
  /** The ladder (null in placements). */
  ladder: number | null;
  color: string;
  /** "Gold 2 · 45 RP", "Master · 120 RP", "Placement 2/5". */
  label: string;
}

const PLACEMENT_COLOR = "#9aa0aa";

/** The rank a player's record shows (no record: placements not started). */
export function rankView(row: { games: number; ladder: number | null } | null | undefined, s: Settings = RANKED_1V1): RankView {
  const games = Math.max(0, row?.games ?? 0);
  const of = s.placements.games;
  if (!row || row.ladder === null || row.ladder === undefined || games < of) {
    const played = Math.min(games, of);
    return { placement: { played, of }, tier: "Placement", division: null, points: 0, ladder: null, color: PLACEMENT_COLOR, label: `Placement ${played}/${of}` };
  }
  const ladder = Math.max(0, Math.floor(row.ladder));
  const top = apexStart(s);
  if (ladder >= top) {
    const points = ladder - top;
    const apex = [...s.apex].reverse().find((a) => points >= a.from) ?? s.apex[0]!;
    return { placement: null, tier: apex.name, division: null, points, ladder, color: apex.color, label: `${apex.name} · ${points} RP` };
  }
  const perTier = s.divisions * s.pointsPerDivision;
  const t = Math.floor(ladder / perTier);
  const within = ladder - t * perTier;
  const division = s.divisions - Math.floor(within / s.pointsPerDivision);
  const points = within % s.pointsPerDivision;
  const tier = s.tiers[t]!;
  return { placement: null, tier: tier.name, division, points, ladder, color: tier.color, label: `${tier.name} ${division} · ${points} RP` };
}

/**
 * The rank points a game gives (after placements): +win, 0 or −loss, plus perRating × (hidden rating after the game −
 * the ladder's rating), that adjustment within ±maxAdjust (a draw: half of it). So wins give 10-30 and losses take
 * 10-30, and a rank below its player's play climbs faster.
 */
export function pointsFor(score: number, ratingAfter: number, ladder: number, s: Settings = RANKED_1V1): number {
  const p = s.points;
  const adjust = Math.max(-p.maxAdjust, Math.min(p.maxAdjust, p.perRating * (ratingAfter - ladderRating(ladder, s))));
  const base = score >= 1 ? p.win : score <= 0 ? -p.loss : 0;
  return Math.round(base + (score > 0 && score < 1 ? adjust / 2 : adjust));
}

/** A player's ranked record (one row of ranked_1v1). */
export interface RankedRecord {
  rating: number;
  rd: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** Null until the placements are done. */
  ladder: number | null;
  /** When their last rated game ended (null: none yet). */
  lastAt: number | null;
}

/** A new player's record. */
export function newRankedRecord(accountRating: number | null | undefined, s: Settings = RANKED_1V1): RankedRecord {
  return { rating: seedRating(accountRating, s), rd: s.rating.startRd, games: 0, wins: 0, losses: 0, draws: 0, ladder: null, lastAt: null };
}

/** What one game did to a player's rank, for the result card. */
export interface RankChange {
  before: RankView;
  after: RankView;
  /** Rank points gained or lost (null in placements, and for the game that places them). */
  points: number | null;
  /** This game finished the placements. */
  placed: boolean;
}

const DAY = 86_400_000;

/** A record's hidden rating as it stands at `now` (its deviation grown by the days since its last game). */
export const ratingNow = (r: RankedRecord, now: number, s: Settings = RANKED_1V1): HiddenRating => ({
  rating: r.rating,
  rd: r.lastAt === null ? r.rd : rdAfterIdle(r.rd, (now - r.lastAt) / DAY, s),
});

/**
 * One rated game for one player: `score` 1, ½ or 0 against `opp` (the opponent's record before the game). The hidden
 * rating moves (Glicko-1), then the ladder: in placements nothing shows until the last of them places the player from
 * the hidden rating; after them, the game's rank points, never below Iron 4 0.
 */
export function rankedGame(me: RankedRecord, opp: RankedRecord, score: number, now: number, s: Settings = RANKED_1V1): { next: RankedRecord; change: RankChange } {
  const hidden = glickoUpdate(ratingNow(me, now, s), ratingNow(opp, now, s), score, s);
  const games = me.games + 1;
  const counts = { wins: me.wins + (score >= 1 ? 1 : 0), losses: me.losses + (score <= 0 ? 1 : 0), draws: me.draws + (score > 0 && score < 1 ? 1 : 0) };
  let ladder = me.ladder;
  let points: number | null = null;
  let placed = false;
  if (ladder === null || me.games < s.placements.games) {
    if (games >= s.placements.games) {
      ladder = placeLadder(hidden.rating, s);
      placed = true;
    }
  } else {
    points = pointsFor(score, hidden.rating, ladder, s);
    ladder = Math.max(0, ladder + points);
  }
  const next: RankedRecord = { rating: hidden.rating, rd: hidden.rd, games, ...counts, ladder, lastAt: now };
  return { next, change: { before: rankView(me, s), after: rankView(next, s), points, placed } };
}

// ---------------- Pairing ----------------

/** How far apart two ratings may be after waiting `waitedMs` (the longer of the two waits). */
export function pairRange(waitedMs: number, s: Settings = RANKED_1V1): number {
  return Math.min(s.match.maxRange, s.match.startRange + (s.match.perSecond * Math.max(0, waitedMs)) / 1000);
}

/** One player in the queue, as pairing needs them: their account, hidden rating and when they started waiting. */
export interface PairingEntry {
  id: string;
  uid: string;
  rating: number;
  at: number;
}

/**
 * Who plays whom now: the longest-waiting first, each with the closest rating within range (the longer wait's
 * range), never their own account. Everyone left over keeps waiting.
 */
export function pairUp<T extends PairingEntry>(entries: readonly T[], now: number, s: Settings = RANKED_1V1): [T, T][] {
  const waiting = [...entries].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const taken = new Set<string>();
  const pairs: [T, T][] = [];
  for (const a of waiting) {
    if (taken.has(a.id)) continue;
    let best: T | null = null;
    for (const b of waiting) {
      if (b === a || taken.has(b.id) || b.uid === a.uid) continue;
      const gap = Math.abs(a.rating - b.rating);
      if (gap > pairRange(now - Math.min(a.at, b.at), s)) continue;
      if (!best || gap < Math.abs(a.rating - best.rating)) best = b;
    }
    if (!best) continue;
    taken.add(a.id);
    taken.add(best.id);
    pairs.push([a, best]);
  }
  return pairs;
}

// ---------------- Coins ----------------

/**
 * The coins a finished ranked game pays one player: perMinute of its length (from its start to its end) by their
 * result, at least 1 and at most maxPerGame; nothing when either side made fewer than minMoves moves.
 */
export function duelCoins(result: "win" | "draw" | "loss", gameMs: number, fewestMoves: number, s: Settings = RANKED_1V1): number {
  if (fewestMoves < s.coins.minMoves) return 0;
  return Math.max(1, Math.min(s.coins.maxPerGame, Math.round((s.coins.perMinute[result] * Math.max(0, gameMs)) / 60_000)));
}
