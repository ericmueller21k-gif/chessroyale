import { useEffect } from "preact/hooks";
import { DASH_STALL } from "@chessroyale/core";
import { applyMove, passTurn, stallTimeline } from "@chessroyale/chess";
import { hash } from "../characters/boss-beats.ts";
import { DASH_FIGURE } from "../characters/dash-figure.ts";
import { DASH_STALL_LINES } from "../characters/dash-lines.ts";
import { CRITICAL, bossVoice } from "../speech.tsx";
import type { BossView, StallState, StrikeState } from "../game.ts";
import { playInPlace, stopInPlace } from "./BossCharacter.tsx";

/**
 * Dash's stall skit on your move (Eric, Nov 17; his rules: stallPlan in packages/chess/src/bosses/dash.ts; the beats are timed by
 * solo.ts and the lobby, which stop the move's clock for each, and arrive here as the play phase's `stall`):
 * - **the slam** (DASH_STALL.slamMs): he hammers his clock where he stands (his `slam` loop, a hit and a shake each slam) and
 *   says a hurry-up line;
 * - **his fake second move** (stallTimeline): his move lands on the board (his `move`), he brags (`fakeSmug`, a line), then
 *   "Nahh, jk bro" (`jkLaugh`, a line) and the move slides back. The board takes no move meanwhile.
 * Every part plays where he stands (never over the board's squares) and in the dock clock's pause; nothing else on screen moves.
 */

/** One of his lines for a beat, the same on every screen (by the battle and the move). */
const lineOf = (lines: readonly string[], key: string): string => lines[hash(key) % lines.length]!;

/** Each beat's lines' key: the battle, the move and the beat. */
const keyOf = (boss: BossView, beat: string) => `dash-stall:${boss.startMove}:${boss.crowdMoves}:${beat}`;

/**
 * The window the move's clock stands still now, or last stood still (the King's strike or a stall beat): the dock's clock and the
 * timer bar hold through it (each beat's length is already in the deadline).
 */
export function frozenWindow(strike?: StrikeState, stall?: StallState | null): { at: number; until: number } | undefined {
  const s = strike?.at !== undefined && strike.until !== undefined ? { at: strike.at, until: strike.until } : undefined;
  const d = stall ? { at: stall.at, until: stall.until } : undefined;
  return s && d ? (d.at >= s.at ? d : s) : (s ?? d);
}

/** The board takes no move: his fake move is on (from its landing to the board as it was). */
export const stallHolding = (stall: StallState | null | undefined, now: number): boolean => stall?.beat === "fake" && now >= stall.at && now < stall.until;

/** A stall beat is on now (the clock stands still). */
export const stallOn = (stall: StallState | null | undefined, now: number): boolean => !!stall && now >= stall.at && now < stall.until;

/**
 * The board as his fake move shows it (`fen`: the position you're picking in), from its landing until it slides back
 * (stallTimeline's backAt): his move played as if you'd passed. Null otherwise.
 */
export function stallBoard(fen: string, stall: StallState | null | undefined, now: number): { fen: string; lastMove: string } | null {
  if (stall?.beat !== "fake" || !stall.move) return null;
  const t = now - stall.at;
  if (t < 0 || t >= stallTimeline().backAt) return null;
  const passed = passTurn(fen);
  if (!passed) return null;
  try {
    return { fen: applyMove(passed, stall.move), lastMove: stall.move };
  } catch {
    return null;
  }
}

/** His `slam` loop as many times as fill the slam (DASH_STALL.slamMs). */
function slamRun(): string[] {
  const one = DASH_FIGURE.anims.slam!.frames.reduce((s, f) => s + f.ms, 0);
  return Array.from({ length: Math.max(1, Math.round(DASH_STALL.slamMs / one)) }, () => "slam");
}

/**
 * The skit's beat where he stands and in his voice (renders nothing): his runs in place and his lines, each at its time. A beat
 * cut short (your move went in during the slam) stops his run there.
 */
export function DashStall({ boss, stall }: { boss: BossView | null | undefined; stall: StallState | null | undefined }) {
  useEffect(() => {
    if (!stall || boss?.id !== "dash") return;
    const key = keyOf(boss, stall.beat);
    const timers: number[] = [];
    const at = (t: number, f: () => void) => void timers.push(window.setTimeout(f, Math.max(0, t - Date.now())));
    if (stall.beat === "slam") {
      playInPlace(key, slamRun(), stall.at);
      at(stall.at, () => bossVoice.say(lineOf(DASH_STALL_LINES.slam, key), key, CRITICAL));
    } else {
      const tl = stallTimeline();
      playInPlace(key, ["move", "fakeSmug", "fakeSmug"], stall.at);
      at(stall.at + tl.bragAt, () => bossVoice.say(lineOf(DASH_STALL_LINES.brag, key), `${key}:brag`, CRITICAL));
      at(stall.at + tl.jkAt, () => {
        playInPlace(`${key}:jk`, ["jkLaugh"], stall.at + tl.jkAt);
        bossVoice.say(lineOf(DASH_STALL_LINES.jk, key), `${key}:jk`, CRITICAL);
      });
    }
    return () => {
      for (const t of timers) clearTimeout(t);
      // (Your move went in mid-slam: the round is over, so is his slamming.)
      if (stall.beat === "slam" && Date.now() < stall.until) stopInPlace(key);
    };
  }, [boss?.id, stall?.beat, stall?.at]);
  return null;
}
