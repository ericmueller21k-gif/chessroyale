import { MODE_RANKS, RANKED_1V1, botSkillForRating } from "./settings.ts";
import {
  GLICKO_Q,
  expectedScore,
  glickoG,
  ladderRating,
  placeLadder,
  rankView,
  rdAfterIdle,
  seedRating,
  type HiddenRating,
  type RankChange,
} from "./ranked.ts";

/**
 * The mode ranks' math (pure; the server alone decides ranks): 50 v 50 ("crowd") and Squads each keep a rank of their own on
 * 1 v 1's tiers, ladder and hidden-rating scale. A match is one Glicko-1 rating period against the field: every real player
 * outside your party (50 v 50), or every other squad with a real player in it (Squads). Your result against each is placement
 * and engine score (50 v 50) or placement alone (Squads); the expected result is Glicko-1's from the two hidden ratings, so a
 * strong lobby costs little to finish low in. Every number is in MODE_RANKS (settings.ts); the design: docs/ideas/mode-ranks.md.
 */

export type RankMode = keyof typeof MODE_RANKS;
export const RANK_MODES = Object.keys(MODE_RANKS) as RankMode[];
export type ModeRankRules = (typeof MODE_RANKS)[RankMode];
type RankSettings = typeof RANKED_1V1;

/** A mode's rank settings: 1 v 1's, with the mode's own placements and points a match (so rankView and placeLadder take them). */
export function modeRankSettings(mode: RankMode, m: ModeRankRules = MODE_RANKS[mode], base: RankSettings = RANKED_1V1): RankSettings {
  return { ...base, placements: { ...base.placements, games: m.placements }, points: { ...base.points, perGame: m.perMatch } };
}

/** A player's record in one mode (one row of ranked_modes). */
export interface ModeRecord {
  rating: number;
  rd: number;
  /** Counted matches (a match with nobody to compare against isn't one). */
  games: number;
  /** 1st places (the podium's winner; a squad's 1st). */
  wins: number;
  /** Null until the placements are done. */
  ladder: number | null;
  /** The highest ladder reached (null before one). */
  peak: number | null;
  /** When their last counted match ended (null: none yet). */
  lastAt: number | null;
}

/** What a player's other ratings are, for a new mode record's seed (each null when there's none). */
export interface KnownRatings {
  /** The account's move-quality Rating (users.rating). */
  account?: number | null;
  /** The 1 v 1 hidden rating. */
  duel?: number | null;
  /** The 50 v 50 hidden rating. */
  crowd?: number | null;
}

/**
 * A new player's hidden rating in a mode (anti-smurf: from what they've shown elsewhere, clamped as 1 v 1's seed): 50 v 50 from the
 * account's Rating, else the 1 v 1 rating; Squads from the 50 v 50 rating, else the 1 v 1 rating, else the account's Rating; else 1500.
 */
export function seedModeRating(mode: RankMode, known: KnownRatings, s: RankSettings = RANKED_1V1): number {
  const order = mode === "crowd" ? [known.account, known.duel] : [known.crowd, known.duel, known.account];
  return seedRating(order.find((r) => typeof r === "number" && Number.isFinite(r)), s);
}

/** A new player's record in a mode. */
export function newModeRecord(mode: RankMode, known: KnownRatings = {}, s: RankSettings = RANKED_1V1): ModeRecord {
  return { rating: seedModeRating(mode, known, s), rd: s.rating.startRd, games: 0, wins: 0, ladder: null, peak: null, lastAt: null };
}

const DAY = 86_400_000;

/** A mode record's hidden rating as it stands at `now` (its deviation grown by the days since its last match). */
export const modeRatingNow = (r: ModeRecord, now: number, s: RankSettings = RANKED_1V1): HiddenRating => ({
  rating: r.rating,
  rd: r.lastAt === null ? r.rd : rdAfterIdle(r.rd, (now - r.lastAt) / DAY, s),
});

/** One opponent in a match's field: their hidden rating (a squad's: its strength) and your result against them (0-1). */
export interface FieldOpponent {
  rating: HiddenRating;
  score: number;
}

/**
 * Glicko-1's update with a whole field as one rating period, each opponent weighted min(1, fullField / n): a match is worth about
 * `fullField` games however many play. `as` is the rating the expected results are worked from (a squad's strength for its
 * members; yourself otherwise); the deviation and the change are yours. The deviation never drops below minRd.
 */
export function fieldUpdate(me: HiddenRating, field: readonly FieldOpponent[], fullField: number, s: RankSettings = RANKED_1V1, as: HiddenRating = me): HiddenRating {
  if (field.length === 0) return me;
  const w = Math.min(1, fullField / field.length);
  let info = 0;
  let sum = 0;
  for (const o of field) {
    const gj = glickoG(o.rating.rd);
    const e = expectedScore(as, o.rating);
    info += w * GLICKO_Q * GLICKO_Q * gj * gj * e * (1 - e);
    sum += w * gj * (o.score - e);
  }
  const precision = 1 / (me.rd * me.rd) + info;
  return { rating: me.rating + (GLICKO_Q / precision) * sum, rd: Math.max(s.rating.minRd, Math.sqrt(1 / precision)) };
}

/**
 * A match's rank points: 2 × perMatch × (your result − the expected), both the field's averages, plus 1 v 1's catch-up
 * (perRating × (hidden rating after − the ladder's rating), within ±maxAdjust); all scaled by min(1, n / fullField), so a match with
 * one other real player moves a third. Finishing above the expected never takes points, below never gives them, and a 1st place
 * never loses any.
 */
export function modePoints(
  result: number,
  expected: number,
  opponents: number,
  ratingAfter: number,
  ladder: number,
  first: boolean,
  m: ModeRankRules,
  s: RankSettings = RANKED_1V1,
): number {
  const p = s.points;
  const scale = Math.min(1, opponents / m.fullField);
  const adjust = Math.max(-p.maxAdjust, Math.min(p.maxAdjust, p.perRating * (ratingAfter - ladderRating(ladder, s))));
  const raw = Math.round((2 * m.perMatch * (result - expected) + adjust) * scale);
  const signed = result >= expected ? Math.max(0, raw) : Math.min(0, raw);
  return first ? Math.max(0, signed) : signed;
}

/** What one match did to a player's mode rank, for the result screen: RankChange, plus how many opponents counted. */
export interface ModeChange extends RankChange {
  opponents: number;
}

/**
 * One counted match for one player: their record before it (as read at join), the field with their result against each, whether
 * they came 1st, and (Squads) the rating their expected results come from. Null when the field is empty: no other real player to
 * compare with, so nothing changes and it isn't a placement match. In placements nothing shows until the last of them places the
 * player from the hidden rating; after them, the match's rank points, never below Wood 5 0.
 */
export function modeMatch(
  me: ModeRecord,
  field: readonly FieldOpponent[],
  first: boolean,
  now: number,
  mode: RankMode,
  opts: { as?: HiddenRating; m?: ModeRankRules; s?: RankSettings } = {},
): { next: ModeRecord; change: ModeChange } | null {
  if (field.length === 0) return null;
  const m = opts.m ?? MODE_RANKS[mode];
  const s = opts.s ?? modeRankSettings(mode, m);
  const mine = modeRatingNow(me, now, s);
  const as = opts.as ?? mine;
  const hidden = fieldUpdate(mine, field, m.fullField, s, as);
  const result = field.reduce((t, o) => t + o.score, 0) / field.length;
  const expected = field.reduce((t, o) => t + expectedScore(as, o.rating), 0) / field.length;
  const games = me.games + 1;
  let ladder = me.ladder;
  let points: number | null = null;
  let placed = false;
  if (ladder === null || me.games < s.placements.games) {
    if (games >= s.placements.games) {
      ladder = placeLadder(hidden.rating, s);
      placed = true;
    }
  } else {
    points = modePoints(result, expected, field.length, hidden.rating, ladder, first, m, s);
    ladder = Math.max(0, ladder + points);
  }
  const peak = ladder === null ? me.peak : Math.max(me.peak ?? 0, ladder);
  const next: ModeRecord = { rating: hidden.rating, rd: hidden.rd, games, wins: me.wins + (first ? 1 : 0), ladder, peak, lastAt: now };
  return { next, change: { before: rankView(me, s), after: rankView(next, s), points, placed, opponents: field.length } };
}

// ---------------- 50 v 50 ----------------

/** A seat in a finished 50 v 50, as the server's record has it. */
export interface CrowdEntrant {
  id: string;
  /** The player's record in 50 v 50 as read when they joined; null for a bot (never an opponent, never rated). */
  record: ModeRecord | null;
  /** The party they queued with (null: alone). Party members aren't in each other's field. */
  party: string | null;
  /** The match's place (1 is best; equal places allowed). */
  place: number;
  /** The judge's points lost a move (the results' perMove; lower is better); null: none. */
  perMove: number | null;
  /** Their counted moves. */
  moves: number;
  /** Left or was removed (resign, away): their result is the place part only. */
  left: boolean;
}

const EPS = 1e-9;

/**
 * Your result against one opponent in a 50 v 50 (0-1; theirs against you is 1 minus it): placeWeight × the place part (ahead 1,
 * equal ½, behind 0) + the rest × the score part (points a move lower by more than scoreBand 1, within it ½, higher 0). The score
 * part is the place part when either left, has no score, or played fewer than scoreMinMoves counted moves.
 */
export function crowdPairScore(me: CrowdEntrant, opp: CrowdEntrant, m: ModeRankRules = MODE_RANKS.crowd): number {
  const place = me.place < opp.place ? 1 : me.place > opp.place ? 0 : 0.5;
  let score = place;
  const scored = !me.left && !opp.left && me.perMove !== null && opp.perMove !== null && me.moves >= m.scoreMinMoves && opp.moves >= m.scoreMinMoves;
  if (scored) {
    const d = opp.perMove! - me.perMove!;
    score = d > m.scoreBand + EPS ? 1 : d < -m.scoreBand - EPS ? 0 : 0.5;
  }
  return m.placeWeight * place + (1 - m.placeWeight) * score;
}

/** The field a real player in a 50 v 50 is measured against: every other real player outside their party, at `now`. */
export function crowdField(me: CrowdEntrant, entrants: readonly CrowdEntrant[], now: number, m: ModeRankRules = MODE_RANKS.crowd, s: RankSettings = modeRankSettings("crowd", m)): FieldOpponent[] {
  return entrants
    .filter((o) => o.record !== null && o.id !== me.id && (me.party === null || o.party !== me.party))
    .map((o) => ({ rating: modeRatingNow(o.record!, now, s), score: crowdPairScore(me, o, m) }));
}

/** A finished 50 v 50's rank changes: one per real player who had someone to compare with (the rest: absent, nothing changes). */
export function crowdRanks(entrants: readonly CrowdEntrant[], now: number, m: ModeRankRules = MODE_RANKS.crowd): Map<string, { next: ModeRecord; change: ModeChange }> {
  const s = modeRankSettings("crowd", m);
  const out = new Map<string, { next: ModeRecord; change: ModeChange }>();
  for (const me of entrants) {
    if (me.record === null) continue;
    const done = modeMatch(me.record, crowdField(me, entrants, now, m, s), me.place === 1, now, "crowd", { m, s });
    if (done) out.set(me.id, done);
  }
  return out;
}

// ---------------- Squads ----------------

/** A squad in a finished Squads lobby: its place of 8 (1, 2, 3 = 3rd-4th, 5 = 5th-8th), its people and its bots' fixed ratings. */
export interface SquadEntrant {
  id: string;
  place: number;
  /** Its real players, each with their Squads record as read when they joined. */
  people: readonly { id: string; record: ModeRecord }[];
  /** Its bots' ratings (botRatingOf), counted in its strength only. */
  bots: readonly number[];
}

/**
 * A squad's strength: the mean hidden rating of its seats (a person's Squads rating at `now`, a bot's fixed rating), and the root
 * mean square of their deviations (a bot's strength is known: minRd).
 */
export function squadStrength(squad: SquadEntrant, now: number, s: RankSettings = modeRankSettings("squads")): HiddenRating {
  const seats = [...squad.people.map((p) => modeRatingNow(p.record, now, s)), ...squad.bots.map((rating) => ({ rating, rd: s.rating.minRd }))];
  if (seats.length === 0) return { rating: s.rating.start, rd: s.rating.startRd };
  return {
    rating: seats.reduce((t, x) => t + x.rating, 0) / seats.length,
    rd: Math.sqrt(seats.reduce((t, x) => t + x.rd * x.rd, 0) / seats.length),
  };
}

/**
 * A finished Squads lobby's rank changes, one per real player who had another real squad to compare with. Each squad is measured
 * against every other squad with a real player in it, by place alone (ahead 1, equal ½, behind 0: every member the same); the
 * expected results come from the squads' strengths, the change is each member's own.
 */
export function squadsRanks(squads: readonly SquadEntrant[], now: number, m: ModeRankRules = MODE_RANKS.squads): Map<string, { next: ModeRecord; change: ModeChange }> {
  const s = modeRankSettings("squads", m);
  const strength = new Map(squads.map((q) => [q.id, squadStrength(q, now, s)]));
  const out = new Map<string, { next: ModeRecord; change: ModeChange }>();
  for (const mine of squads) {
    const field = squads
      .filter((o) => o.id !== mine.id && o.people.length > 0)
      .map((o) => ({ rating: strength.get(o.id)!, score: mine.place < o.place ? 1 : mine.place > o.place ? 0 : 0.5 }));
    for (const p of mine.people) {
      const done = modeMatch(p.record, field, mine.place === 1, now, "squads", { m, s, as: strength.get(mine.id)! });
      if (done) out.set(p.id, done);
    }
  }
  return out;
}

// ---------------- Leavers ----------------

/** The temperature of the bot that takes a ranked leaver's seat (Eric, Nov 9: "a bot at their level"): it plays like their mode rating. */
export const leaverBotSkill = (rating: number): number => botSkillForRating(rating);
