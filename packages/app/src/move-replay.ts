import { SQUADS_LOBBY } from "@chessroyale/core";
import { applyMove } from "@chessroyale/chess";
import type { SquadsEvent } from "@chessroyale/chess/squads";
import { account } from "./account.ts";

/**
 * Move replay in Squads (Eric, Nov 5; docs/decisions/2026-11-05-move-replay.md). When the rotation brings you back to a
 * board (Relay, Pairs), the moves played there since you last played it land one by one, each with its from and to
 * marked and a name tag over the moved piece (who played it), then your free seconds run as usual. The free time grew
 * by the rule's 0.5 s a move (the server's, `NetDuty.freeMs`), replay shown or not; the replay fits inside that extra
 * time. A tap on the board (or a move) skips it at once. The replay button by the gear turns it off (the position just
 * shows). Pure, so it's tested on its own (packages/app/test/move-replay.test.ts), but for the stored settings.
 */

const R = SQUADS_LOBBY.replay;

/** One step of a replay: the position, the move just played (its from and to marked) and who played it. */
export interface ReplayFrame {
  fen: string;
  lastMove: string | null;
  by: readonly string[];
}

/**
 * The replay of a board's last `n` moves: the position before them (its own last move marked), then each one played.
 * `moves` are the board's moves from `startFen`; `by` who played each (unknown: none).
 */
export function replayFrames(startFen: string, moves: readonly string[], by: readonly (readonly string[] | null | undefined)[], n: number): ReplayFrame[] {
  const k = Math.max(0, Math.min(n, moves.length));
  if (!k) return [];
  const from = moves.length - k;
  let fen = startFen;
  for (let i = 0; i < from; i++) fen = applyMove(fen, moves[i]!);
  const out: ReplayFrame[] = [{ fen, lastMove: moves[from - 1] ?? null, by: [] }];
  for (let i = from; i < moves.length; i++) {
    fen = applyMove(fen, moves[i]!);
    out.push({ fen, lastMove: moves[i]!, by: by[i] ?? [] });
  }
  return out;
}

/**
 * When each of `n` replayed moves lands (ms after the half began), inside `totalMs` (the replay's extra free time): the
 * first `firstMs` in, then one every `stepMs` (about 0.45 s), quicker if it must be, so the last is held a beat before
 * the extra time is over.
 */
export function replayTimes(n: number, totalMs: number): number[] {
  if (n <= 0) return [];
  const hold = Math.min(R.stepMs, totalMs * 0.2);
  const step = n > 1 ? Math.max(0, Math.min(R.stepMs, (totalMs - hold - R.firstMs) / (n - 1))) : 0;
  return Array.from({ length: n }, (_, i) => Math.min(totalMs, R.firstMs + i * step));
}

/** The frame to show `t` ms into the half (null: the replay is over). */
export function replayFrameAt(frames: readonly ReplayFrame[], totalMs: number, t: number): ReplayFrame | null {
  if (frames.length < 2 || t >= totalMs || t < 0) return null;
  const landed = replayTimes(frames.length - 1, totalMs).filter((at) => at <= t).length;
  return frames[landed]!;
}

/** Who played each move of a half on board `i`, in the order they were played (a pair's coin: its picker; the same move: both). */
export function byOfHalf(events: readonly SquadsEvent[], i: number): string[][] {
  const out: string[][] = [];
  for (const e of events) {
    if (!("board" in e) || e.board !== i) continue;
    if (e.kind === "relay") out.push([e.player]);
    else if (e.kind === "pair") out.push(e.same || e.coin === null ? [...e.players] : [e.players[e.coin]!]);
    else if (e.kind === "vote") out.push(e.players.filter((_, k) => e.picks[k] === e.move));
    else if (e.kind === "forced") out.push([]);
  }
  return out;
}

/**
 * A name tag's words (Eric, Nov 5): the name whole up to `tagChars` (12) letters; longer, cut with "…" to that many
 * ("Christopher…"). Two players (a pair's same move): both, "Ann + Bo", cut the same way.
 */
export function tagText(names: readonly string[]): string {
  const text = names.join(" + ").trim();
  return text.length > R.tagChars ? `${text.slice(0, R.tagChars - 1).trimEnd()}…` : text;
}

// ---------------- The replay button's three settings, per account ----------------

/**
 * The replay button (Eric, Nov 5, round 2): a tap steps through three settings. "two": the last 2 moves (your teammate's
 * last move on the board and the opponent's reply, then it's your move); "all": every move since you last played the
 * board; "off": none. Off on a device's first match (`SQUADS_LOBBY.replay.mode`).
 */
export type ReplayMode = "off" | "two" | "all";
export const REPLAY_MODES: readonly ReplayMode[] = ["off", "two", "all"];

/** The next setting a tap gives: off → the last 2 → all → off. */
export const nextReplayMode = (m: ReplayMode): ReplayMode => (m === "off" ? "two" : m === "two" ? "all" : "off");

/** How many of the `missed` moves a setting replays. */
export const replayMovesFor = (m: ReplayMode, missed: number): number => (m === "off" ? 0 : m === "two" ? Math.min(2, Math.max(0, missed)) : Math.max(0, missed));

/**
 * Whether a replay plays (Eric, Nov 5, round 2: "replay only when it's your turn"): at the start of your move on a board
 * you've just come to. Never on a board you were already watching when your move there began (you sat there waiting
 * for the opponent, or Quick board jump took you there early: you saw those moves), never when it isn't your move.
 * `arrivedSeq`: the half in which this board came on screen; `dutySeq`: the half of your move on it (null: none).
 */
export const replayDue = (dutySeq: number | null, arrivedSeq: number | null): boolean => dutySeq !== null && arrivedSeq !== null && arrivedSeq >= dutySeq;

/** A stored setting read as today's: "off", "two", "all"; the first button's "1" (on: every move) and "0" (off). */
export function readReplayMode(v: string | null): ReplayMode | null {
  if (v === "off" || v === "two" || v === "all") return v;
  if (v === "1") return "all";
  if (v === "0") return "off";
  return null;
}

/**
 * The app keeps no settings on the account (prefs.ts is per device), so it's kept per account on this device:
 * `brc.squads.replay.<user id>` (a guest's under "guest"), the same key as the first button's on/off.
 */
const who = () => account().profile?.user.id ?? "guest";
const replayKey = () => `brc.squads.replay.${who()}`;
const listeners = new Set<() => void>();
let replayMemory: ReplayMode | null = null;

export function replayMode(): ReplayMode {
  try {
    return readReplayMode(localStorage.getItem(replayKey())) ?? replayMemory ?? R.mode;
  } catch {
    return replayMemory ?? R.mode;
  }
}

export function setReplayMode(m: ReplayMode) {
  replayMemory = m;
  try {
    localStorage.setItem(replayKey(), m);
  } catch {
    // No storage: it lasts until a reload.
  }
  listeners.forEach((l) => l());
}

export function onReplayChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------- First-time tips: the coach marks, once per device ----------------

/**
 * The coach marks (Eric, Nov 5, round 2): three tips one at a time at a player's first Relay, the rest of the screen
 * dimmed, a pointer on one thing, a short line and OK; a tap anywhere or OK goes on. The last has "Don't show these
 * again" by its OK (Eric, Nov 5, his answer): ticked, they never show again on this device (`brc.squads.coach`: "1");
 * not ticked, they show again at the next lobby's Relay. Due in a lobby joined from the queue (the solo queue's PLAY,
 * or its party's), or a test lobby's link with the test switch `?coach`.
 */
export const COACH_MARKS = [
  { id: "settings", target: ".mm-more", text: "Tap here for settings, like Quick board jump." },
  { id: "replay", target: ".rp-btn", text: "Tap to replay moves: the last 2, all of them, or off." },
  { id: "boards", target: ".sq-match.ours", text: "Tap a board to watch it. Tap yours to come back." },
] as const;
export type CoachMark = (typeof COACH_MARKS)[number];

const COACH_KEY = "brc.squads.coach";
let coachFor: string | null = null;

export function coachSeen(): boolean {
  try {
    return localStorage.getItem(COACH_KEY) === "1";
  } catch {
    return false;
  }
}

/** The coach marks are through for this lobby (the last one's OK); with "Don't show these again" ticked, for good. */
export function coachDone(never: boolean) {
  coachFor = null;
  if (!never) return;
  try {
    localStorage.setItem(COACH_KEY, "1");
  } catch {
    // No storage: they show again next time.
  }
}

/** A lobby joined from the queue (or a test lobby with `?coach`): the coach marks may show in its Relay. */
export function queuedSquads(code: string) {
  coachFor = coachSeen() ? null : code.toUpperCase();
}

/** Whether the coach marks are due in this lobby now. */
export const coachDue = (code: string | null | undefined): boolean => !!code && coachFor === code.toUpperCase() && !coachSeen();

/** The coach mark after `i` (null: that was the last). */
export const nextCoachMark = (i: number): number | null => (i + 1 < COACH_MARKS.length ? i + 1 : null);
