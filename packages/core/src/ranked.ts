import { RANKED_1V1, type DuelControl } from "./settings.ts";
import type { ItemLook } from "./crates.ts";

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

/** The ladder's points in the tiers with divisions (Wood 5 0 to Radiant 1 79): tiers × divisions × points a division (2800). */
export const divisionsEnd = (s: Settings = RANKED_1V1) => s.tiers.length * s.divisions * s.pointsPerDivision;

/** The hidden rating a place on the ladder stands for. */
export const ladderRating = (ladder: number, s: Settings = RANKED_1V1) => s.baseRating + ladder * s.ratingPerPoint;

/** Where the placements put a hidden rating on the ladder: from Wood 5 0 up to placements.maxLadder (Radiant 5 0). */
export function placeLadder(rating: number, s: Settings = RANKED_1V1): number {
  return Math.max(0, Math.min(s.placements.maxLadder, Math.floor((rating - s.baseRating) / s.ratingPerPoint)));
}

/**
 * A ladder that might be in a top tier (Pearlescent, Transcendent): at the floor or above. Only these need a place
 * among the top ladders (the server counts it; below the floor nobody asks).
 */
export const mayBeTop = (ladder: number | null | undefined, s: Settings = RANKED_1V1): ladder is number => typeof ladder === "number" && ladder >= s.topFloor;

/** A player's rank as it shows: in placements, or a tier (and its division, below the top tiers) with its rank points. */
export interface RankView {
  /** Still in placements: games played of the placements' count. */
  placement: { played: number; of: number } | null;
  /** The tier's name ("Gold", "Transcendent"), or "Placement". */
  tier: string;
  /** 5 (lowest) to 1 in a tier with divisions; null in a top tier and in placements. */
  division: number | null;
  /** Rank points: within the division (0-79; Radiant 1's count on past 79 at the floor and above), or above the floor in a top tier. */
  points: number;
  /** The ladder (null in placements). */
  ladder: number | null;
  color: string;
  /** The emblem's id in the baked set ("gold-d3", "transcendent"); null in placements (and for a bot). */
  emblem: string | null;
  /**
   * The rank pill's words, everywhere it shows (Eric, Nov 25: "remove RP next to names and use Roman ... like Paragon IV - 50"): the tier,
   * its division in Roman numerals, an en dash and the points: "Gold II – 45", "Radiant I – 95"; a top tier "Transcendent – 120";
   * "Placement 2/5". (Was "Gold 2 · 45 RP".)
   */
  label: string;
}

const PLACEMENT_COLOR = "#9aa0aa";

/** A division in Roman numerals, as every rank shows it (Eric, Nov 25: "remove RP next to names and use Roman"): 5 → "V", 4 → "IV". */
export function romanDivision(n: number): string {
  let out = "";
  for (const [v, r] of [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]] as const) for (; n >= v; n -= v) out += r;
  return out;
}

/** A rank's tier and division, as shown: "Gold III", "Transcendent" (a top tier has no division), "Placement" (in placements). */
export const divisionTitle = (v: Pick<RankView, "tier" | "division">) => (v.division === null ? v.tier : `${v.tier} ${romanDivision(v.division)}`);

/** A tier's emblem id: "gold-d3" (a tier with divisions), "transcendent" (a top tier). */
export const emblemId = (tier: string, division: number | null) => (division === null ? tier.toLowerCase() : `${tier.toLowerCase()}-d${division}`);

/**
 * The rank a player's record shows (no record: placements not started). `place`: where their ladder stands among the
 * top ladders (1 + how many are higher), which only the server knows; it counts only at `topFloor` or above. Without
 * it (or outside every top tier's `top`), a ladder at the floor or above is Radiant 1 with its RP counting on past 80.
 */
export function rankView(row: { games: number; ladder: number | null; place?: number | null } | null | undefined, s: Settings = RANKED_1V1): RankView {
  const games = Math.max(0, row?.games ?? 0);
  const of = s.placements.games;
  if (!row || row.ladder === null || row.ladder === undefined || games < of) {
    const played = Math.min(games, of);
    return { placement: { played, of }, tier: "Placement", division: null, points: 0, ladder: null, color: PLACEMENT_COLOR, emblem: null, label: `Placement ${played}/${of}` };
  }
  const ladder = Math.max(0, Math.floor(row.ladder));
  const place = row.place;
  if (ladder >= s.topFloor && typeof place === "number") {
    const top = [...s.topTiers].sort((a, b) => a.top - b.top).find((t) => place <= t.top);
    if (top) {
      const points = ladder - s.topFloor;
      return { placement: null, tier: top.name, division: null, points, ladder, color: top.color, emblem: emblemId(top.name, null), label: `${top.name} – ${points}` };
    }
  }
  const perTier = s.divisions * s.pointsPerDivision;
  // (Past the divisions' end: Radiant 1, the RP counting on.)
  const last = divisionsEnd(s) - 1;
  const at = Math.min(ladder, last);
  const t = Math.floor(at / perTier);
  const within = at - t * perTier;
  const division = s.divisions - Math.floor(within / s.pointsPerDivision);
  const points = within % s.pointsPerDivision + (ladder - at);
  const tier = s.tiers[t]!;
  return { placement: null, tier: tier.name, division, points, ladder, color: tier.color, emblem: emblemId(tier.name, division), label: `${divisionTitle({ tier: tier.name, division })} – ${points}` };
}

/** One rank in the Ranks pop-up's list: its title ("Gold III", "Transcendent"), emblem, color and the ladder RP it starts at. */
export interface RankStep {
  title: string;
  emblem: string;
  color: string;
  /** The ladder points the rank starts at (Wood V 0, Wood IV 80, … the top tiers `topFloor`). */
  from: number;
  /** A top tier's place among the highest ladders (500, 100); null below. */
  top: number | null;
  /**
   * A rough Elo for the rank (Eric, Nov 27: "a conversion range next to each... ELO approximation... it just helps to kind of get a
   * rough idea"): the ladder's rating (ladderRating, the scale the hidden rating pulls the ladder to) at the rank's start and at the
   * next one's, to the nearest 10; `to` null for a top tier (its floor and up).
   */
  elo: { from: number; to: number | null };
}

/** A ladder's rating to the nearest 10, for the Ranks list's rough Elo. */
const roughElo = (ladder: number, s: Settings) => Math.round(ladderRating(ladder, s) / 10) * 10;

/** Every rank, lowest first: each tier's divisions 5 → 1, then the top tiers (the widest `top` first). */
export function rankSteps(s: Settings = RANKED_1V1): RankStep[] {
  const out: RankStep[] = [];
  s.tiers.forEach((t, i) => {
    for (let d = s.divisions; d >= 1; d--)
    {
      const from = (i * s.divisions + (s.divisions - d)) * s.pointsPerDivision;
      out.push({ title: divisionTitle({ tier: t.name, division: d }), emblem: emblemId(t.name, d), color: t.color, from, top: null, elo: { from: roughElo(from, s), to: roughElo(from + s.pointsPerDivision, s) } });
    }
  });
  for (const t of [...s.topTiers].sort((a, b) => b.top - a.top)) out.push({ title: t.name, emblem: emblemId(t.name, null), color: t.color, from: s.topFloor, top: t.top, elo: { from: roughElo(s.topFloor, s), to: null } });
  return out;
}

/**
 * The rank points a game gives (after placements): 2 × perGame × (score − the expected score), so ±perGame between
 * equals, more for beating a stronger player and less for beating a weaker one (Elo's rule, on the ladder); plus
 * perRating × (hidden rating after the game − the ladder's rating), that adjustment within ±maxAdjust (a draw: half of
 * it), so a rank below its player's play climbs faster and ranks settle where the hidden rating says. A win never
 * takes points and a loss never gives them.
 */
export function pointsFor(score: number, expected: number, ratingAfter: number, ladder: number, s: Settings = RANKED_1V1): number {
  const p = s.points;
  const adjust = Math.max(-p.maxAdjust, Math.min(p.maxAdjust, p.perRating * (ratingAfter - ladderRating(ladder, s))));
  const draw = score > 0 && score < 1;
  const points = Math.round(2 * p.perGame * (score - expected) + (draw ? adjust / 2 : adjust));
  return score >= 1 ? Math.max(0, points) : score <= 0 ? Math.min(0, points) : points;
}

/** One of a player's recent ranked games, from their side (never the hidden rating). */
export interface RankedRecentGame {
  /** When it ended (ms since 1970). */
  at: number;
  /** The other player: their account's id ("deleted" for a deleted account), name and look (null when gone). */
  opponent: { id: string; name: string; look: ItemLook | null };
  result: "win" | "loss" | "draw";
  /** The rank points it moved for this player: null in placements, for a game fair play held, and for games before Oct 28, 2026. */
  points: number | null;
}

/**
 * What a profile shows of a player's ranked 1 v 1 (the server's rankedSummary; /api/me and /api/profile/:id): the rank
 * shown everywhere, the record, the highest rank reached (`peak`: kept from Oct 28, 2026; null before a ladder), the
 * current run of wins (`streak`: a loss or a draw ends it; counted from Oct 28), and the last 5 games kept, newest first.
 */
export interface RankedSummary {
  rank: RankView;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  peak: RankView | null;
  streak: number;
  recent: RankedRecentGame[];
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
 * the hidden rating; after them, the game's rank points, never below Wood 5 0.
 */
export function rankedGame(me: RankedRecord, opp: RankedRecord, score: number, now: number, s: Settings = RANKED_1V1): { next: RankedRecord; change: RankChange } {
  const mine = ratingNow(me, now, s);
  const theirs = ratingNow(opp, now, s);
  const hidden = glickoUpdate(mine, theirs, score, s);
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
    points = pointsFor(score, expectedScore(mine, theirs), hidden.rating, ladder, s);
    ladder = Math.max(0, ladder + points);
  }
  const next: RankedRecord = { rating: hidden.rating, rd: hidden.rd, games, ...counts, ladder, lastAt: now };
  return { next, change: { before: rankView(me, s), after: rankView(next, s), points, placed } };
}

// ---------------- Pairing ----------------

/** How far apart two ratings may be after waiting `waitedMs` (the longer of the two waits), the less certain of the two deviations `rd`. */
export function pairRange(waitedMs: number, rd = 0, s: Settings = RANKED_1V1): number {
  return Math.min(s.match.maxRange, s.match.startRange + (s.match.perSecond * Math.max(0, waitedMs)) / 1000 + s.match.perRd * Math.max(0, rd));
}

/**
 * One player in the queue, as pairing needs them: their account, hidden rating (and its deviation, if known), when
 * they started waiting, and their device's marker (a hash of fair play's device cookie, if it has one).
 */
export interface PairingEntry {
  id: string;
  uid: string;
  rating: number;
  rd?: number;
  at: number;
  device?: string | null;
}

/** Two entries that may never meet: the same account (two tabs), or the same device (two accounts on one phone). */
const sameOwner = (a: PairingEntry, b: PairingEntry) => a.uid === b.uid || (!!a.device && a.device === b.device);

/**
 * Who plays whom now: the longest-waiting first, each with the closest rating within range (the longer wait's
 * range), never their own account nor another account on their own device. Everyone left over keeps waiting.
 */
export function pairUp<T extends PairingEntry>(entries: readonly T[], now: number, s: Settings = RANKED_1V1): [T, T][] {
  const waiting = [...entries].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const taken = new Set<string>();
  const pairs: [T, T][] = [];
  for (const a of waiting) {
    if (taken.has(a.id)) continue;
    let best: T | null = null;
    for (const b of waiting) {
      if (b === a || taken.has(b.id) || sameOwner(a, b)) continue;
      const gap = Math.abs(a.rating - b.rating);
      if (gap > pairRange(now - Math.min(a.at, b.at), Math.max(a.rd ?? 0, b.rd ?? 0), s)) continue;
      if (!best || gap < Math.abs(a.rating - best.rating)) best = b;
    }
    if (!best) continue;
    taken.add(a.id);
    taken.add(best.id);
    pairs.push([a, best]);
  }
  return pairs;
}

// ---------------- Colors ----------------

/** A side of the board, as a ranked game stores it (White: "w"). */
export type SeatColor = "w" | "b";

/** How many of a player's last ranked games pairing reads for their colors (enough for both rules of firstGetsWhite). */
export const colorHistoryGames = (s: Settings = RANKED_1V1): number => Math.max(s.colors.recentGames, s.colors.maxInRow);

/**
 * Who gets White as a pair is seated (true: the first player). Each player's colors in their last ranked games, newest first (the
 * server reads colorHistoryGames with the ticket). In order (Eric, Nov 25; RANKED_1V1.colors):
 *   1. nobody plays one color more than `maxInRow` games in a row when the other can take it: whoever had Black in each of their last
 *      `maxInRow` gets White, whoever had White in each gets Black (both in the same bind: one of them has to; the longer run
 *      switches first, so a run that couldn't be helped ends next time; the same length: on to 2);
 *   2. the larger (Black games − White games) over the last `recentGames` gets White;
 *   3. a tie: the one who had Black in their last game (and someone with no games before someone who had White);
 *   4. still tied: `coin()`.
 */
export function firstGetsWhite(a: readonly SeatColor[], b: readonly SeatColor[], coin: () => boolean, s: Settings = RANKED_1V1): boolean {
  const { recentGames, maxInRow } = s.colors;
  const key = (h: readonly SeatColor[]): number[] => {
    // (The run of one color up to the last game: + for Black, − for White, counted once it reaches maxInRow.)
    const end = h.findIndex((c) => c !== h[0]);
    const run = end === -1 ? h.length : end;
    const stuck = maxInRow > 0 && run >= maxInRow ? (h[0] === "b" ? run : -run) : 0;
    const recent = h.slice(0, recentGames);
    const balance = recent.filter((c) => c === "b").length - recent.filter((c) => c === "w").length;
    const last = h[0] === "b" ? 1 : h[0] === "w" ? -1 : 0;
    return [stuck, balance, last];
  };
  const [ka, kb] = [key(a), key(b)];
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i]! > kb[i]!;
  return coin();
}

// (Ranked's own coins (duelCoins: 2.4/1.6/0.8 a minute, 20 games a day) are gone since Nov 25: a ranked game pays PLAY_COINS with
// its XP, as every counted game does: play-coins.ts, server/xp.ts.)
