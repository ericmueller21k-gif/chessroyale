import { useEffect, useRef, useState } from "preact/hooks";
import type { GameView, Standing } from "../game.ts";
import { clockText } from "./RaceTower.tsx";

/** Seconds left on your move at which the small clock turns red. */
export const URGENT_SECONDS = 5;
/** Your bank (time left in the game) shows red below this. */
const LOW_BANK_MS = 60_000;

/** A move clock that's running: its start and deadline, and whether it's yours (your team's turn). */
export interface TurnClock {
  startsAt: number;
  deadline: number;
  /** Your own move clock (your turn): it goes red near zero and your bank runs down with it. */
  yours: boolean;
  /** You've moved: your bank stops where it was, and the seconds left are only the others' (never red). */
  done?: boolean;
}

/**
 * The small clock at the board's top right, in the line above the board (never over the squares): the seconds left on
 * this move and your bank, your time left in the game (the leaderboard's BANK). The seconds turn red under 5 s on your
 * own move; the bank under a minute. With no move clock running (the reveal), only the bank shows, in the same place.
 * No labels (they didn't fit beside the line above the board): "12s" and "9:50" read apart by their formats, and the
 * bank is the same number as the leaderboard's BANK column. The full words are its title and label.
 */
export function BoardClock({ match, you, turn }: { match: GameView; you: Standing | undefined; turn: TurnClock | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!turn) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [!!turn]);
  // Your bank stops when you move (what's left of your thinking time is kept).
  const doneAt = useRef<number | null>(null);
  if (turn?.done && doneAt.current === null) doneAt.current = Math.min(now, turn.deadline);
  if (!turn?.done) doneAt.current = null;

  // (Your row comes from the screen, which reads the standings anyway: this redraws ten times a second.)
  const me = you;
  const runs = !!turn?.yours && !!me && !me.out;
  const thought = runs ? Math.max(0, (doneAt.current ?? now) - turn!.startsAt) : 0;
  // (Each move adds a few seconds to the bank before its clock starts, as the scoreboard's Bank does.)
  const bank = !me || me.out ? null : runs ? Math.max(0, me.bankMs + match.settings.timeIncrementSeconds * 1000 - thought) : me.bankMs;
  const secs = turn ? Math.max(0, Math.ceil((turn.deadline - Math.max(now, turn.startsAt)) / 1000)) : null;
  const urgent = secs !== null && runs && !turn!.done && secs <= URGENT_SECONDS;
  const low = bank !== null && bank < LOW_BANK_MS;
  if (secs === null && bank === null) return null;
  const label = [secs !== null ? `${secs} s left on this move` : null, bank !== null ? `${clockText(bank)} left in your bank` : null].filter(Boolean).join(", ");
  return (
    <div class={`board-clock${urgent ? " urgent" : ""}${turn && !runs ? " theirs" : ""}${turn?.done ? " done" : ""}`} title={label} aria-label={label}>
      {secs !== null && (
        <span class="bc-turn">
          {secs}
          <small>s</small>
        </span>
      )}
      {bank !== null && (
        <span class={`bc-bank${low ? " low" : ""}`}>{clockText(bank)}</span>
      )}
    </div>
  );
}
