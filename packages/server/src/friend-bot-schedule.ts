import { FRIEND_BOTS, type Activity } from "@chessroyale/core";

/**
 * Friend bots' presence (Eric, Nov 20; docs/decisions/2026-11-20-friend-bots.md): worked out from the time and the bot's id alone, so
 * it costs nothing when nobody looks: no timers, no writes, no live hub. Each bot has its own time zone, its own number of sessions a
 * day and its own favorite modes (all from its id). Time is cut into half-hour slots; a session starts in a slot by a seeded draw,
 * likelier in the bot's evening (FRIEND_BOTS.hourWeights), and lasts 10 to 60 minutes. Inside a session it moves as a player does:
 * the home screen first, then a queue and a match, the town, Auto chess, with the real presence's activities (core's ACTIVITIES), so
 * a bot's line on the friends page is one a real friend shows. Pure: no imports but core's settings (accounts.ts uses it too).
 */

/** A friend bot's account id starts with this (friend-bots.ts makes them; nothing else does). */
export const FRIEND_BOT_PREFIX = "fbot-";
export const isFriendBot = (id: string) => id.startsWith(FRIEND_BOT_PREFIX);

export interface BotPresence {
  online: boolean;
  /** In a match (the dot a real friend in a match shows). */
  busy: boolean;
  doing?: Activity;
  /** Now while online, else when its last session ended. */
  lastSeen: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const SLOT = 30 * MIN;
/** How far back the last session is looked for (a bot has a few sessions a day: one is always found long before this). */
const LOOK_BACK_SLOTS = 14 * 48;

/** A 32-bit hash of a string (FNV-1a, then a final mix so near keys land far apart). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
/** A seeded number in [0, 1). */
const unit = (key: string) => hash(key) / 4_294_967_296;
const between = (key: string, [lo, hi]: readonly [number, number]) => lo + unit(key) * (hi - lo);

const HOUR_SUM = FRIEND_BOTS.hourWeights.reduce((a, b) => a + b, 0);
const MATCHES = ["boss", "crowd", "duel", "squads"] as const satisfies readonly Activity[];
/** A match's length in minutes, by mode. */
const MATCH_MINUTES: Record<(typeof MATCHES)[number], [number, number]> = { boss: [6, 15], crowd: [8, 18], duel: [3, 12], squads: [8, 16] };

interface Persona {
  offsetMs: number;
  perDay: number;
  /** Each match mode's weight (its favorites more). */
  likes: number[];
}

function persona(id: string): Persona {
  const offsets = FRIEND_BOTS.utcOffsets;
  return {
    offsetMs: offsets[Math.floor(unit(`${id}:tz`) * offsets.length)]! * HOUR,
    perDay: between(`${id}:rate`, FRIEND_BOTS.perDay),
    likes: MATCHES.map((m) => 0.2 + unit(`${id}:like:${m}`) ** 2 * 2),
  };
}

interface Session {
  start: number;
  end: number;
}

/** The session that starts in this half-hour slot, if one does. */
function sessionIn(id: string, p: Persona, slot: number): Session | null {
  const local = slot * SLOT + p.offsetMs;
  const hour = (((Math.floor(local / HOUR) % 24) + 24) % 24) as number;
  // (48 slots a day, two an hour: the chances add up to perDay sessions a day.)
  const chance = (p.perDay * FRIEND_BOTS.hourWeights[hour]!) / (2 * HOUR_SUM);
  if (unit(`${id}:s:${slot}`) >= chance) return null;
  const start = slot * SLOT + Math.floor(unit(`${id}:o:${slot}`) * SLOT);
  const [lo, hi] = FRIEND_BOTS.sessionMinutes;
  // (Short sessions more often than long ones.)
  const minutes = lo + unit(`${id}:l:${slot}`) ** 1.5 * (hi - lo);
  return { start, end: start + Math.round(minutes * MIN) };
}

/** What the bot is doing `at` into a session: home first, then queues and matches, the town, Auto chess. */
function activityAt(id: string, p: Persona, s: Session, at: number): { doing: Activity; busy: boolean } {
  const seed = `${id}:${s.start}`;
  const likeSum = p.likes.reduce((a, b) => a + b, 0);
  let t = s.start + between(`${seed}:home`, [0.5, 2.5]) * MIN;
  if (at < t) return { doing: "home", busy: false };
  for (let k = 0; ; k++) {
    const r = unit(`${seed}:${k}`);
    if (r < 0.6) {
      t += between(`${seed}:${k}:q`, [0.4, 2.5]) * MIN;
      if (at < t) return { doing: "queue", busy: false };
      let pick = unit(`${seed}:${k}:m`) * likeSum;
      let i = 0;
      while (i < MATCHES.length - 1 && pick >= p.likes[i]!) pick -= p.likes[i++]!;
      const mode = MATCHES[i]!;
      t += between(`${seed}:${k}:len`, MATCH_MINUTES[mode]) * MIN;
      if (at < t) return { doing: mode, busy: true };
    } else {
      const doing: Activity = r < 0.82 ? "town" : r < 0.92 ? "home" : "autochess";
      t += between(`${seed}:${k}:len`, doing === "autochess" ? [4, 12] : doing === "town" ? [2, 9] : [0.5, 3]) * MIN;
      if (at < t) return { doing, busy: false };
    }
  }
}

/** A friend bot's presence at `now`: online (and what it's doing) inside a session, else when it was last on. */
export function botPresence(id: string, now: number): BotPresence {
  const p = persona(id);
  const cur = Math.floor(now / SLOT);
  // (A session is at most an hour long and starts inside its slot: only the last three slots' can cover now. The earliest wins, so
  // what it's doing carries on when a later one overlaps it.)
  for (let slot = cur - 2; slot <= cur; slot++) {
    const s = sessionIn(id, p, slot);
    if (s && s.start <= now && now < s.end) return { online: true, ...activityAt(id, p, s, now), lastSeen: now };
  }
  let last = 0;
  for (let slot = cur; slot > cur - LOOK_BACK_SLOTS; slot--) {
    // (No earlier slot's session can end later than this one's latest end: stop.)
    if (last && (slot + 1) * SLOT + FRIEND_BOTS.sessionMinutes[1] * MIN < last) break;
    const s = sessionIn(id, p, slot);
    if (s && s.end <= now && s.end > last) last = s.end;
  }
  return { online: false, busy: false, lastSeen: last || now - LOOK_BACK_SLOTS * SLOT };
}
