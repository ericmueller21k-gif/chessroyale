import { LEAVES } from "./settings.ts";

/**
 * Leaving ranked games early (phase L1; docs/areas/ranked.md "Leaving", the numbers in LEAVES): pure math the server uses
 * to charge a dodge or a leave, and to decide whether a player may queue now (a lockout) or waits longer to be paired (the
 * delayed queue). Nothing here reads a clock or a database: the caller hands in the player's marks and `now`.
 */

type Leaves = typeof LEAVES;

export type LeaveKind = "dodge" | "leave";

/**
 * One mark on a player's record (a row of ranked_conduct): what it was, when, and how many ranked games the player had
 * played by then (a leave's count includes the game it was left in; a dodge's game never happened, so it adds none).
 */
export interface LeaveMark {
  kind: LeaveKind;
  at: number;
  games: number;
}

const HOUR = 3_600_000;

/**
 * The dodge level each dodge brought, in the order given (oldest first): one more than the level standing just before it,
 * the level dropping by one every `dodgeDecayHours` without a dodge (LoL's rule: an occasional emergency is forgotten
 * quickly, daily dodging reaches the long lockouts).
 */
export function dodgeLevels(times: readonly number[], s: Leaves = LEAVES): number[] {
  const out: number[] = [];
  let level = 0;
  let last: number | null = null;
  for (const t of times) {
    if (last !== null) level = Math.max(0, level - Math.floor(Math.max(0, t - last) / (s.dodgeDecayHours * HOUR)));
    level += 1;
    out.push(level);
    last = t;
  }
  return out;
}

/** The dodge level standing at `now` (0: none), from the dodges' times, oldest first. */
export function dodgeLevelAt(times: readonly number[], now: number, s: Leaves = LEAVES): number {
  const levels = dodgeLevels(times, s);
  if (!levels.length) return 0;
  const last = times[times.length - 1]!;
  return Math.max(0, levels[levels.length - 1]! - Math.floor(Math.max(0, now - last) / (s.dodgeDecayHours * HOUR)));
}

const byLevel = (list: readonly number[], level: number) => list[Math.min(Math.max(level, 1), list.length) - 1] ?? 0;

/** What a dodge that brings this dodge level costs: rank points, and the lockout from ranked (ms). */
export function dodgeCost(level: number, s: Leaves = LEAVES): { rp: number; lockoutMs: number } {
  return { rp: byLevel(s.dodgeRp, level), lockoutMs: byLevel(s.dodgeLockoutMin, level) * 60_000 };
}

/** A ladder after a fee: never below 0 (Wood 5 0); none in placements (no ladder yet). */
export const ladderAfterFee = (ladder: number | null, rp: number): number | null => (ladder === null ? null : Math.max(0, ladder - Math.max(0, rp)));

/** Resigning after this many moves of your own is a plain loss; before it, a leave (a dodge in disguise). */
export const isQuickResign = (movesMade: number, s: Leaves = LEAVES): boolean => movesMade < s.quickResignMoves;

/**
 * How many marks are among the player's latest `window` ranked games and dodges. `marks` newest first; `gamesNow`: the
 * ranked games they've played. A mark's place counting back from now is the games since it, the dodges since it, and itself;
 * each clean game pushes an old mark out (Dota's "finish games", no timer to wait out).
 */
export function marksInWindow(marks: readonly LeaveMark[], gamesNow: number, s: Leaves = LEAVES): number {
  let n = 0;
  let dodgesSince = 0;
  for (const m of marks) {
    const place = Math.max(0, gamesNow - m.games) + dodgesSince + 1;
    if (place <= s.window) n++;
    if (m.kind === "dodge") dodgesSince++;
  }
  return n;
}

/** The delayed queue's extra wait (seconds) for this many marks in the window (0: none). */
export function delayFor(marks: number, s: Leaves = LEAVES): number {
  let wait = 0;
  for (const d of s.delayed) if (marks >= d.at) wait = Math.max(wait, d.waitSec);
  return wait;
}

/** Where a player stands with ranked's leave rules right now (the queue's check, home's line and the confirms' words). */
export interface LeaveStanding {
  /** Marks among the latest LEAVES.window ranked games and dodges. */
  marks: number;
  /** The dodge level now (0: none). */
  level: number;
  /** Ranked is locked until then (null: not locked): `lock` says why (a dodge's lockout, or too many marks). */
  lockedUntil: number | null;
  lock: "dodge" | "leaves" | null;
  /** The delayed queue: a search waits this long (s) before it can be paired (0: none). */
  delaySec: number;
  /** What a dodge now would cost: its rank points (before placements: no points to take) and its lockout (minutes). */
  nextDodge: { rp: number; lockoutMin: number };
}

/** A player's standing at `now` from their marks (newest first) and the ranked games they've played. */
export function leaveStanding(marks: readonly LeaveMark[], gamesNow: number, now: number, s: Leaves = LEAVES): LeaveStanding {
  const dodges = marks.filter((m) => m.kind === "dodge").map((m) => m.at).reverse();
  const levels = dodgeLevels(dodges, s);
  const level = dodgeLevelAt(dodges, now, s);
  const n = marksInWindow(marks, gamesNow, s);
  let lockedUntil: number | null = null;
  let lock: LeaveStanding["lock"] = null;
  if (dodges.length) {
    const until = dodges[dodges.length - 1]! + dodgeCost(levels[levels.length - 1]!, s).lockoutMs;
    if (until > now) [lockedUntil, lock] = [until, "dodge"];
  }
  if (n >= s.lockAt && marks.length) {
    const until = marks[0]!.at + s.lockHours * HOUR;
    if (until > now && (lockedUntil === null || until > lockedUntil)) [lockedUntil, lock] = [until, "leaves"];
  }
  const next = dodgeCost(level + 1, s);
  return { marks: n, level, lockedUntil, lock, delaySec: delayFor(n, s), nextDodge: { rp: next.rp, lockoutMin: next.lockoutMs / 60_000 } };
}

/** The queue's refusal while ranked is locked (the countdown is the app's: home's line above PLAY, from `lockedUntil`). */
export function lockedLine(lock: LeaveStanding["lock"], s: Leaves = LEAVES): string {
  return lock === "leaves"
    ? `Too many ranked games left early: 1 v 1 is locked for ${s.lockHours} hours.`
    : "You left a ranked game before it started: 1 v 1 is locked for a few minutes.";
}

/** Where a player stands with the leave rules, as /api/me and the queue read it: their standing, and home's note after a dodge. */
export interface RankedLeaves extends LeaveStanding {
  /** Their latest dodge, for home's note ("You left before the game started: −5 RP"): within LEAVES.noteMinutes, no game since. */
  dodged: { at: number; rp: number } | null;
}
