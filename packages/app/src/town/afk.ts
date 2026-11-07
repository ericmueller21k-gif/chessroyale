import { TOWN_AFK } from "@chessroyale/core";

/**
 * Away in the town square and its rooms (Eric, Nov 7; TOWN_AFK in settings.ts; docs/decisions/2026-11-07-town-afk.md): no input
 * for `zzzAfterSec`, a "zzz" floats over your pawn for everyone; no input for `bootAfterSec`, or the page in the background for
 * `hiddenBootAfterSec` without a break, and you're out: home, with a small "You were away". Any input counts as being there: a tap,
 * a drag (looking around too), a key, the wheel, and walking (a held arrow). While a boss's challenge plays (its walk in, intro and
 * transition) or the claw machine is open, the clock holds (`busy`): nothing there is idle presence. Pure: Town.tsx feeds it.
 *
 * The clock is the device's wall clock (Date.now()), so a phone whose timers stopped in the background still knows, the moment it's
 * back, how long it was gone. The server drops your pawn by the same numbers from your beats (server/src/town-here.ts).
 */

export interface AwayLimits {
  zzzMs: number;
  bootMs: number;
  hiddenBootMs: number;
}

export type AwayState = "here" | "zzz" | "out";

export const AWAY_LIMITS: AwayLimits = {
  zzzMs: TOWN_AFK.zzzAfterSec * 1000,
  bootMs: TOWN_AFK.bootAfterSec * 1000,
  hiddenBootMs: TOWN_AFK.hiddenBootAfterSec * 1000,
};

/**
 * The test switch `?townafk=` (test switches only): `off` turns the away rule off (a test that idles on purpose, or jumps the
 * clock), or `zzz,boot,hidden` in seconds shortens it for a test (`?townafk=2,5,4`). Null: as settings.ts says. `undefined` from
 * a bad value: ignored.
 */
export function readAwaySwitch(v: string | null): AwayLimits | null | undefined {
  if (v === null) return undefined;
  if (v === "off" || v === "0") return null;
  const n = v.split(",").map(Number);
  if (n.length !== 3 || n.some((x) => !Number.isFinite(x) || x <= 0 || x > 3600)) return undefined;
  return { zzzMs: n[0]! * 1000, bootMs: n[1]! * 1000, hiddenBootMs: n[2]! * 1000 };
}

export class AwayClock {
  private lastInput: number;
  private hiddenAt: number | null = null;
  private busy = false;

  /** `limits` null: the rule is off (always "here"). */
  constructor(
    now: number,
    readonly limits: AwayLimits | null = AWAY_LIMITS,
  ) {
    this.lastInput = now;
  }

  /** Any input: a tap, a drag, a key, the wheel, a step. */
  act(now: number): void {
    this.lastInput = Math.max(this.lastInput, now);
  }

  /** The page went to the background (its clock starts) or came back (call `state` first: coming back may be too late). */
  hidden(on: boolean, now: number): void {
    if (on) this.hiddenAt ??= now;
    else this.hiddenAt = null;
  }

  /** A challenge or the claw machine has you (true), or let you go (false: the clock starts again from then). */
  setBusy(on: boolean, now: number): void {
    if (this.busy !== on) this.lastInput = now;
    this.busy = on;
  }

  /** How long since your last input (0 while busy): each beat sends it. */
  idleMs(now: number): number {
    return this.busy ? 0 : Math.max(0, now - this.lastInput);
  }

  /** Here, away (the zzz), or out (boot). */
  state(now: number): AwayState {
    const L = this.limits;
    if (!L || this.busy) return "here";
    if (this.hiddenAt !== null && now - this.hiddenAt >= L.hiddenBootMs) return "out";
    const idle = now - this.lastInput;
    if (idle >= L.bootMs) return "out";
    return idle >= L.zzzMs ? "zzz" : "here";
  }
}
