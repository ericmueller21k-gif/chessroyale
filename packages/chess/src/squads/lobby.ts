import { SQUADS, mulberry32, shuffle, type Rng, type SquadsSettings } from "@chessroyale/core";

/**
 * Squads' lobby: parties and solo players formed into 8 squads of 4 (bots in every empty seat, teammates included),
 * the bracket (round 1: 4 matches; round 2: 2; the final), placements, each player's record of missed actions, and
 * the mode's seeded randomness. Pure.
 */

/**
 * The mode's randomness: one stream per decision, from the lobby's seed and the decision's name (the match, turn,
 * half, board and what's drawn). The server can replay any decision from the seed alone, and a new kind of draw
 * never moves the others (.claude/LESSONS.md, "Tests that leaned on a lucky seed").
 */
export function squadsRng(seed: number, ...parts: readonly (string | number)[]): Rng {
  let h = 2166136261;
  for (const c of `${seed >>> 0}|${parts.join("|")}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  // (A finaliser, so names one character apart give unrelated streams.)
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return mulberry32(h >>> 0);
}

/** A fair coin: 0 or 1. */
export const coin = (rng: Rng): 0 | 1 => (rng() < 0.5 ? 0 : 1);

export interface SquadsEntrant {
  id: string;
  name: string;
  isBot: boolean;
  /** A bot's skill (a temperature: lower is stronger); null for a person. */
  skill: number | null;
}

/** People who queue together (an invite link or code), or one player on their own: 1 to `partyMax`. */
export interface Party {
  id: string;
  members: readonly SquadsEntrant[];
}

export interface SquadPlayer extends SquadsEntrant {
  /** The party they came with (null for a bot). */
  partyId: string | null;
  /** Missed actions this lobby (every one is logged), and in a row. */
  misses: number;
  missStreak: number;
  /** A repeat no-show whose seat a bot now plays. */
  replacedByBot: boolean;
}

export interface Squad {
  id: number;
  /** In seat order: seat 0 is the rules' "player 1". */
  players: readonly SquadPlayer[];
}

/** Whether a seat is played by a bot (a bot, or a no-show's seat taken over). */
export const playsAsBot = (p: Pick<SquadPlayer, "isBot" | "replacedByBot">) => p.isBot || p.replacedByBot;

/** The skill a seat's bot plays at. */
export const botSkillOf = (p: Pick<SquadPlayer, "skill">, s: SquadsSettings = SQUADS) => p.skill ?? s.replacementBotSkill;

const seat = (e: SquadsEntrant, partyId: string | null): SquadPlayer => ({ ...e, partyId, misses: 0, missStreak: 0, replacedByBot: false });

/**
 * Forms the lobby's squads. Parties keep together: largest first (ties in a seeded order), each into the squad with
 * the fewest free seats it still fits in, so people end up with people (a solo player joins a party of 3 before an
 * empty squad). Parties that don't fit wait for the next lobby. Bots fill every empty seat, in the order given; each
 * squad's seats are then shuffled.
 */
export function formSquads(
  parties: readonly Party[],
  bots: readonly SquadsEntrant[],
  rng: Rng,
  s: SquadsSettings = SQUADS,
): { squads: Squad[]; waiting: Party[] } {
  const seats: SquadPlayer[][] = Array.from({ length: s.squadCount }, () => []);
  const waiting: Party[] = [];
  const order = shuffle(rng, parties).sort((a, b) => b.members.length - a.members.length);
  for (const party of order) {
    const size = party.members.length;
    let best = -1;
    seats.forEach((sq, i) => {
      const free = s.squadSize - sq.length;
      if (free >= size && (best < 0 || free < s.squadSize - seats[best]!.length)) best = i;
    });
    if (size < 1 || size > s.partyMax || best < 0) {
      waiting.push(party);
      continue;
    }
    seats[best]!.push(...party.members.map((m) => seat(m, party.id)));
  }
  let next = 0;
  for (const sq of seats) {
    while (sq.length < s.squadSize) {
      const bot = bots[next++];
      if (!bot) throw new Error("Not enough bots to fill the squads");
      sq.push(seat({ ...bot, isBot: true }, null));
    }
  }
  return { squads: seats.map((players, id) => ({ id, players: shuffle(rng, players) })), waiting };
}

/** Records who acted and who missed: every miss is logged, and `noShowsBeforeBot` in a row hands the seat to a bot. */
export function noteActions(squads: readonly Squad[], acted: readonly string[], missed: readonly string[], s: SquadsSettings = SQUADS): Squad[] {
  const did = new Set(acted);
  const not = new Set(missed);
  return squads.map((sq) => ({
    ...sq,
    players: sq.players.map((p) => {
      if (not.has(p.id)) {
        const missStreak = p.missStreak + 1;
        return { ...p, misses: p.misses + 1, missStreak, replacedByBot: p.replacedByBot || (!p.isBot && missStreak >= s.noShowsBeforeBot) };
      }
      return did.has(p.id) && p.missStreak ? { ...p, missStreak: 0 } : p;
    }),
  }));
}

// ---- The bracket ----

/** Round 0 is Relay, round 1 Pairs, round 2 the final. */
export type SquadsRound = 0 | 1 | 2;
export type SquadsFormat = "relay" | "pairs" | "final";
export const ROUND_FORMAT: Readonly<Record<SquadsRound, SquadsFormat>> = { 0: "relay", 1: "pairs", 2: "final" };

export interface BracketMatch {
  round: SquadsRound;
  index: number;
  /** The two squads (ids); null until the round before decides them. */
  squads: readonly [number | null, number | null];
  winner: number | null;
}

/** The bracket, by round: 4 matches, 2, then the final. */
export type Bracket = readonly (readonly BracketMatch[])[];

/** Draws the bracket: the squads in a seeded random order, paired off (unranked, so no seeding by strength). */
export function drawBracket(squadIds: readonly number[], rng: Rng): Bracket {
  const rounds = Math.log2(squadIds.length);
  if (rounds !== 3) throw new Error("A Squads bracket has 8 squads");
  const order = shuffle(rng, squadIds);
  return [0, 1, 2].map((r) =>
    Array.from({ length: squadIds.length >> (r + 1) }, (_, index) => ({
      round: r as SquadsRound,
      index,
      squads: r === 0 ? ([order[2 * index]!, order[2 * index + 1]!] as const) : ([null, null] as const),
      winner: null,
    })),
  );
}

/** Records a match's winner and moves them into their slot in the next round. */
export function reportWinner(bracket: Bracket, round: SquadsRound, index: number, winner: number): Bracket {
  const m = bracket[round]?.[index];
  if (!m || !m.squads.includes(winner)) throw new Error(`Squad ${winner} isn't in round ${round} match ${index}`);
  if (m.winner !== null) throw new Error(`Round ${round} match ${index} is already decided`);
  return bracket.map((matches, r) =>
    matches.map((x) => {
      if (r === round && x.index === index) return { ...x, winner };
      if (r === round + 1 && x.index === index >> 1) {
        const squads: [number | null, number | null] = [...x.squads];
        squads[index & 1] = winner;
        return { ...x, squads };
      }
      return x;
    }),
  );
}

/** Whether every match of a round has a winner (the next round starts when it has). */
export const roundDecided = (bracket: Bracket, round: SquadsRound) => bracket[round]!.every((m) => m.winner !== null);

/**
 * Placements so far, for rewards: 1 (won the final), 2 (lost it), 3 (out in round 2: 3rd-4th), 5 (out in round 1:
 * 5th-8th). Squads still playing aren't listed.
 */
export function placements(bracket: Bracket): Map<number, 1 | 2 | 3 | 5> {
  const out = new Map<number, 1 | 2 | 3 | 5>();
  const lostIn: readonly (2 | 3 | 5)[] = [5, 3, 2];
  bracket.forEach((matches, r) => {
    for (const m of matches) {
      if (m.winner === null) continue;
      for (const sq of m.squads) if (sq !== null && sq !== m.winner) out.set(sq, lostIn[r]!);
      if (r === bracket.length - 1) out.set(m.winner, 1);
    }
  });
  return out;
}
