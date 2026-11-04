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

// ---------------- The replay button and the first-time tip, per account ----------------

/**
 * The app keeps no settings on the account (prefs.ts is per device), so both are kept per account on this device:
 * `brc.squads.replay.<user id>` ("1" on, "0" off; unset: on) and `brc.squads.tip.<user id>` ("1": don't show the tip
 * again). A guest's under "guest".
 */
const who = () => account().profile?.user.id ?? "guest";
const replayKey = () => `brc.squads.replay.${who()}`;
const tipKey = () => `brc.squads.tip.${who()}`;
const listeners = new Set<() => void>();
let replayMemory: boolean | null = null;

export function replayOn(): boolean {
  try {
    const v = localStorage.getItem(replayKey());
    return v === null ? (replayMemory ?? R.on) : v === "1";
  } catch {
    return replayMemory ?? R.on;
  }
}

export function setReplayOn(on: boolean) {
  replayMemory = on;
  try {
    localStorage.setItem(replayKey(), on ? "1" : "0");
  } catch {
    // No storage: it lasts until a reload.
  }
  listeners.forEach((l) => l());
}

export function onReplayChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** "Don't show this again" was ticked on the tip (this account, this device). */
export function tipDismissed(): boolean {
  try {
    return localStorage.getItem(tipKey()) === "1";
  } catch {
    return false;
  }
}

export function dismissTip() {
  try {
    localStorage.setItem(tipKey(), "1");
  } catch {
    // No storage: it shows the next time.
  }
}

/**
 * The first-time tip shows the first time this account queues for Squads (the solo queue's PLAY, or its party's), on
 * the first screen of that lobby with the gear and the replay button (the votes, or a match), once per queue, until
 * it's dismissed with "Don't show this again" ticked. `queued`: a lobby joined from the queue (or a test lobby's link
 * with the test switch `?replaytip`).
 */
let tipFor: string | null = null;

export function queuedSquads(code: string) {
  tipFor = tipDismissed() ? null : code.toUpperCase();
}

/** Whether the tip is due in this lobby now. */
export const tipDue = (code: string | null | undefined): boolean => !!code && tipFor === code.toUpperCase() && !tipDismissed();

/** The tip's OK: gone for this queue; with the box ticked, for good (this account, this device). */
export function closeTip(never: boolean) {
  tipFor = null;
  if (never) dismissTip();
}
