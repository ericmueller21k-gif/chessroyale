import type { QuestPaid } from "./quests.ts";
import { XP } from "./settings.ts";

/**
 * XP and levels: the rules (XP in settings.ts; docs/decisions/2026-11-09-xp-rules.md). Pure: the server decides a game's XP with
 * these (server/xp.ts), and the app draws its box with them (components/XpResult.tsx), so the two never disagree.
 */

/** Why a game earned no XP. */
export type XpNone = "short" | "resigned" | "left" | "guest" | "test" | "banned" | "limit" | "paused";

/** What each reason says on the result screen, in plain words. */
export const XP_NONE_LINES: Readonly<Record<XpNone, string>> = {
  short: `No XP: the game ended before move ${XP.minMoves}.`,
  resigned: `No XP: you resigned before move ${XP.minMoves}.`,
  left: "No XP: you left the match.",
  guest: "Sign in to earn XP.",
  test: "No XP: test game.",
  banned: "No XP: this account is banned.",
  limit: "No XP: daily solo limit reached.",
  // (The kill switch PAUSE_REWARDS, Nov 9: nothing is granted while it's on; the game still plays and its result is kept.)
  paused: "Rewards are paused for a moment.",
};
/** The daily reward's part in the box ("Daily reward +200"; Nov 9, phase 2). */
export const XP_DAILY = "Daily reward";
/** A solo game's time XP the daily cap (XP.soloMinutesPerDay) trimmed: its part's words. */
export const XP_SOLO_LIMIT = "Daily solo limit";
export const isXpNone = (x: unknown): x is XpNone => typeof x === "string" && Object.hasOwn(XP_NONE_LINES, x);

/** One part of a game's XP ("12 min" +120, "Win" +50); a screen shows them through xpShownParts (never the minutes). */
export interface XpPart {
  label: string;
  xp: number;
}

/**
 * What a game paid beside its XP (Nov 9, phase 2): the daily reward's crate, and each level's crates and key (and every 10th level's
 * boss crate to pick). `crate`: which series the crates are (XP.rewardCrate when paid); `levels`: the levels whose rewards this game
 * paid (a level reached before, while rewards were paused, is paid at the next counted game).
 */
export interface XpRewards {
  crate: string;
  /** The daily reward's crates (0: not today's first counted game of 15 moves). */
  daily: number;
  /** Crates and keys from levels, and boss crates to pick. */
  crates: number;
  keys: number;
  bossPicks: number;
  levels: number[];
  /** Quests this game completed (Nov 9, phase 3): each one's XP (also in the box's "Quest" part), crates and keys. Absent: none. */
  quests?: QuestPaid[];
}

/** A game's XP, as the result screen shows it: your XP before and after, the levels, its parts; or why there was none. */
export interface XpGrant {
  before: number;
  after: number;
  levelBefore: number;
  levelAfter: number;
  parts: XpPart[];
  none?: XpNone;
  /** What else it paid (phase 2): absent when nothing (and on every grant from before). */
  rewards?: XpRewards;
}

/** One level's rewards (XP.levelCrates crates, XP.levelKeys keys, and on every XP.bossCrateEvery-th a boss crate to pick). */
export function levelReward(level: number): { crates: number; keys: number; bossPicks: number } {
  return { crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: level > 1 && level % XP.bossCrateEvery === 0 ? 1 : 0 };
}

/** Whether a grant's rewards hold anything. */
export const hasRewards = (r: XpRewards | undefined | null): r is XpRewards => !!r && (r.daily > 0 || r.crates > 0 || r.keys > 0 || r.bossPicks > 0 || !!r.quests?.length);

/** "1 Winter Crate", "2 Winter Crates" (a crate's name without its series: "Winter Crate · Series 1" says "Winter Crate"). */
export function crateCount(n: number, name: string): string {
  const one = name.split(" · ")[0]!;
  return `${n} ${n === 1 ? one : `${one.replace(/Crate$/, "Crates")}`}`;
}

/** A reward's lines, in plain words: "+1 Winter Crate", "+2 Winter Crates", "+1 crate key", "Choose your boss crate". */
export function rewardLines(r: XpRewards, crateName: string): { daily: string | null; level: string | null; pick: string | null; quests: string[] } {
  const things = (crates: number, keys: number) => [crates ? `+${crateCount(crates, crateName)}` : "", keys ? `+${keys} crate ${keys === 1 ? "key" : "keys"}` : ""].filter(Boolean);
  const level = things(r.crates, r.keys).join(" · ");
  return {
    daily: r.daily ? `+${crateCount(r.daily, crateName)}` : null,
    level: level || null,
    pick: r.bossPicks ? (r.bossPicks === 1 ? "Choose your boss crate" : `Choose your ${r.bossPicks} boss crates`) : null,
    // (Phase 3: "Quest done: Boss Hunter +300 XP · +1 Winter Crate".)
    quests: (r.quests ?? []).map((q) => [`Quest done: ${q.name} +${q.xp.toLocaleString("en-US")} XP`, ...things(q.crates, q.keys)].join(" · ")),
  };
}

/** A grant's rewards from what's stored (JSON), or none: anything unreadable reads as none. */
export function readRewards(x: unknown): XpRewards | undefined {
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
  const n = (k: string) => (typeof o[k] === "number" && Number.isInteger(o[k]) && (o[k] as number) >= 0 ? (o[k] as number) : 0);
  const r: XpRewards = {
    crate: typeof o.crate === "string" ? o.crate : XP.rewardCrate,
    daily: n("daily"),
    crates: n("crates"),
    keys: n("keys"),
    bossPicks: n("bossPicks"),
    levels: Array.isArray(o.levels) ? o.levels.filter((l): l is number => typeof l === "number" && Number.isInteger(l) && l > 1) : [],
  };
  const whole = (x: unknown) => (typeof x === "number" && Number.isInteger(x) && x >= 0 ? x : 0);
  const quests = Array.isArray(o.quests)
    ? o.quests.flatMap((q: unknown) => {
        if (!q || typeof q !== "object") return [];
        const v = q as Record<string, unknown>;
        return typeof v.quest === "string" && typeof v.name === "string" ? [{ quest: v.quest, name: v.name, xp: whole(v.xp), crates: whole(v.crates), keys: whole(v.keys) }] : [];
      })
    : [];
  if (quests.length) r.quests = quests;
  return hasRewards(r) ? r : undefined;
}

/** Your level at this much XP: 1 at 0, one more every XP.perLevel, no top. */
export const levelOf = (xp: number): number => 1 + Math.floor(Math.max(0, xp) / XP.perLevel);
/** XP into your level, and the share of it done (0 to just under 1). */
export const xpInLevel = (xp: number): number => Math.max(0, xp) % XP.perLevel;
export const levelProgress = (xp: number): number => xpInLevel(xp) / XP.perLevel;

/** What the server knows of one player's game (every fact its own: the match room's, or its clock's). */
export interface XpFacts {
  /** Your time in the game, ms. */
  ms: number;
  /** Your own moves that went in. */
  moves: number;
  won: boolean;
  /** You resigned (a game under the minimum then says so). */
  resigned?: boolean;
  /** You left: gone too long, idle, removed (the match room's `abandoned`). */
  abandoned?: boolean;
  /** A guest, where sign-in is set up. */
  guest?: boolean;
  /** A test switch or control touched the game. */
  test?: boolean;
  banned?: boolean;
}

/** A game's XP before any cap: none and why, or its whole minutes, time XP and win XP. */
export type GameXp = { none: XpNone } | { none?: undefined; minutes: number; time: number; win: number };

/** The rules of one game's XP (settings: XP). */
export function gameXp(f: XpFacts): GameXp {
  if (f.guest) return { none: "guest" };
  if (f.banned) return { none: "banned" };
  if (f.test) return { none: "test" };
  if (f.abandoned) return { none: "left" };
  if (!(f.moves >= XP.minMoves)) return { none: f.resigned ? "resigned" : "short" };
  const minutes = Math.min(XP.maxMinutes, Math.floor(Math.max(0, f.ms) / 60_000));
  return { minutes, time: minutes * XP.perMinute, win: f.won ? XP.win : 0 };
}

/**
 * The box's parts: the time ("12 min"), then the win; a win the cap held back says so, at +0. `timePaid`: the time XP actually paid
 * when a cap (solo's daily minutes) trimmed it: "Daily solo limit" at what was left (+0 for none); a held-back win's +0 is then left
 * out, so the line fits a 320 px phone ("Daily solo limit +300 · Win (paid once today) +0" doesn't).
 */
export function xpParts(g: Exclude<GameXp, { none: XpNone }>, winPaid = true, timePaid = g.time): XpPart[] {
  const paid = Math.max(0, Math.min(g.time, timePaid));
  const trimmed = !!g.time && paid < g.time;
  const time = !g.time ? [] : trimmed ? [{ label: XP_SOLO_LIMIT, xp: paid }] : [{ label: `${g.minutes} min`, xp: g.time }];
  return [...time, ...(g.win && (winPaid || !trimmed) ? [winPaid ? { label: "Win", xp: g.win } : { label: "Win (paid once today)", xp: 0 }] : [])];
}

/**
 * The parts as a screen shows them (Eric, Nov 9: "remove the 12 min, we dont want players to know they could just stall to get more
 * XP"): never the time's part; the daily solo limit as its words alone (no number: its XP is time XP); the win's as it is. The
 * total ("+N XP") still counts them all. `xp` null: no number shown. `of`: the part's index in `parts` (its share of the fill).
 */
export function xpShownParts(parts: readonly XpPart[]): { label: string; xp: number | null; of: number }[] {
  return parts.flatMap((p, of) => (/^\d+ min$/.test(p.label) ? [] : [{ label: p.label, xp: p.label === XP_SOLO_LIMIT ? null : p.xp, of }]));
}

/** A grant as the screen shows it, from your XP before and the parts (or the reason there was none). */
export function xpGrant(before: number, parts: readonly XpPart[], none?: XpNone, rewards?: XpRewards): XpGrant {
  const after = before + (none ? 0 : parts.reduce((s, p) => s + p.xp, 0));
  const paid = !none && hasRewards(rewards) ? { rewards } : {};
  return { before, after, levelBefore: levelOf(before), levelAfter: levelOf(after), parts: none ? [] : [...parts], ...(none ? { none } : {}), ...paid };
}

/** The XP day (the win caps): it starts at XP.dayStartUtcHour UTC. Answers when the day holding `t` began. */
export function xpDayStart(t: number): number {
  const shift = XP.dayStartUtcHour * 3_600_000;
  return Math.floor((t - shift) / 86_400_000) * 86_400_000 + shift;
}

/** One stretch of the bar: a level's fill from one share to another (the bar empties between stretches: a level-up). */
export interface XpStretch {
  level: number;
  from: number;
  to: number;
}

/** How the bar moves from `before` to `after`: one stretch per level it passes through (a level-up ends a stretch at 1). */
export function xpStretches(before: number, after: number): XpStretch[] {
  const a = Math.max(0, before);
  const b = Math.max(a, after);
  const out: XpStretch[] = [];
  for (let level = levelOf(a); ; level++) {
    const start = (level - 1) * XP.perLevel;
    const end = level * XP.perLevel;
    const from = (Math.max(a, start) - start) / XP.perLevel;
    if (b < end) {
      out.push({ level, from, to: (b - start) / XP.perLevel });
      return out;
    }
    out.push({ level, from, to: 1 });
    // (Exactly on a level's end: the next level shows, empty.)
    if (b === end) {
      out.push({ level: level + 1, from: 0, to: 0 });
      return out;
    }
  }
}

/** How long the box's fill takes for a gain (ms): XP.fillMs, longer for more XP, between its two ends. */
export function xpFillMs(gain: number): number {
  const { min, max } = XP.fillMs;
  return gain <= 0 ? 0 : Math.round(min + (max - min) * Math.min(1, gain / XP.perLevel));
}

/**
 * Where the box is at `t` ms into its fill (`ms` long, `xpFillMs`): the XP counted so far, the level shown and its bar's share. The
 * XP rises at an even pace (eased at the ends), so the bar never jumps: a level-up reaches the end, then starts again from empty.
 */
export function xpAt(before: number, after: number, t: number, ms = xpFillMs(after - before)): { xp: number; level: number; share: number } {
  const gain = Math.max(0, after - before);
  const k = ms <= 0 || t >= ms ? 1 : t <= 0 ? 0 : t / ms;
  // (Ease in and out: smooth at both ends, never backwards.)
  const eased = k * k * (3 - 2 * k);
  const xp = before + gain * eased;
  const shown = Math.round(xp);
  // (At a level's exact end mid-fill, the bar shows it full; it empties only as the next XP comes.)
  const full = shown > before && shown % XP.perLevel === 0 && shown < after;
  return full ? { xp: shown, level: levelOf(shown) - 1, share: 1 } : { xp: shown, level: levelOf(xp), share: levelProgress(xp) };
}
