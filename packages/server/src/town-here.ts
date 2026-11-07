import { TOWN_AFK, type ItemLook } from "@chessroyale/core";

/**
 * Who's in the town square now, as pure logic (the live hub keeps one, in memory only: a restart forgets it, and each device's
 * next beat brings it back). Each signed-in device in the town sends a beat (POST /api/town/here) every TOWN_AFK.beatSec while
 * its page is visible, at once when something changes, and one as its page goes to the background: its square, how long since
 * its player's last input, and whether it's hidden. Others in the same room get each player's square and whether they're away
 * (the "zzz": Eric, Nov 7).
 *
 * The server drops a pawn by the same numbers the app boots by (TOWN_AFK), so it never depends on the device: a hidden phone
 * runs no timers and sends nothing. No input for `bootAfterSec`, or in the background for `hiddenBootAfterSec`, and it's gone
 * for everyone; a device that stops beating counts as in the background from its last beat (`silentAfterSec`). A beat from a
 * dropped device (back in time, or busy in a challenge) brings its pawn back.
 */

/** What a device says on a beat. */
export interface HereBeat {
  c: number;
  r: number;
  /** How long since its player's last input (0 while a challenge or the claw machine has them busy). */
  idleMs: number;
  hidden: boolean;
  /** Inside a shop: its home's id (others in the town don't see them). */
  shop: string | null;
}

/** The numbers a pawn is dropped by (a test's own, shortened, where the test switches are on). */
export interface HereLimits {
  zzzMs: number;
  bootMs: number;
  hiddenBootMs: number;
  silentMs: number;
}

export const HERE_LIMITS: HereLimits = {
  zzzMs: TOWN_AFK.zzzAfterSec * 1000,
  bootMs: TOWN_AFK.bootAfterSec * 1000,
  hiddenBootMs: TOWN_AFK.hiddenBootAfterSec * 1000,
  silentMs: TOWN_AFK.silentAfterSec * 1000,
};

/** Another player as a device in the town sees them. */
export interface HereOther {
  id: string;
  name: string;
  c: number;
  r: number;
  /** Away (no input for TOWN_AFK.zzzAfterSec): a "zzz" over their pawn. */
  zzz: boolean;
  /** What they wear (their equipped items, as every other screen draws them: Eric, on #542); absent: nothing on. */
  look?: ItemLook;
}

interface Entry {
  id: string;
  name: string;
  room: string;
  c: number;
  r: number;
  shop: string | null;
  idleSince: number;
  hiddenSince: number | null;
  beatAt: number;
  limits: HereLimits;
  look: ItemLook | null;
}

/** The most rooms' worth of players held (a guard: a test makes a room per run). */
const HOLD_MAX = 5000;

export class TownHere {
  private here = new Map<string, Entry>();

  get size(): number {
    return this.here.size;
  }

  /** A device's beat: where its player is now. */
  beat(id: string, name: string, room: string, b: HereBeat, now: number, limits: HereLimits = HERE_LIMITS, look: ItemLook | null = null): void {
    const was = this.here.get(id);
    const hiddenSince = b.hidden ? (was?.hiddenSince ?? now) : null;
    if (!was && this.here.size >= HOLD_MAX) this.sweep(now);
    if (!was && this.here.size >= HOLD_MAX) return;
    this.here.set(id, { id, name, room, c: b.c, r: b.r, shop: b.shop, idleSince: now - Math.max(0, b.idleMs), hiddenSince, beatAt: now, limits, look });
  }

  /** A device left the town (back home, out to a game, the page closed). */
  leave(id: string): void {
    this.here.delete(id);
  }

  /**
   * Whether a pawn is past its limit now: no input for `bootMs`, or in the background for `hiddenBootMs`. A device that stopped
   * beating counts as in the background from its last beat (a phone that hid without a word goes when one that said so would).
   */
  static past(e: Pick<Entry, "idleSince" | "hiddenSince" | "beatAt" | "limits">, now: number): boolean {
    const L = e.limits;
    if (now - e.idleSince >= L.bootMs) return true;
    const awayFrom = e.hiddenSince ?? (now - e.beatAt >= L.silentMs ? e.beatAt : null);
    return awayFrom !== null && now - awayFrom >= L.hiddenBootMs;
  }

  /** Drops every pawn past its limit; answers their ids. */
  sweep(now: number): string[] {
    const gone: string[] = [];
    for (const e of this.here.values()) if (TownHere.past(e, now)) gone.push(e.id);
    for (const id of gone) this.here.delete(id);
    return gone;
  }

  /** Whether this account's pawn is in the town now (after a sweep). */
  has(id: string): boolean {
    return this.here.has(id);
  }

  /**
   * Everyone else in the town square of `room` (not in a shop), after the sweep: at most TOWN_AFK.maxShown. `names` false (a guest
   * watching: Eric, on #542, "maybe nothing" over their heads): no names, their looks still.
   */
  view(room: string, now: number, except: string | null, max: number = TOWN_AFK.maxShown, names = true): HereOther[] {
    this.sweep(now);
    const out: HereOther[] = [];
    for (const e of this.here.values()) {
      if (e.room !== room || e.id === except || e.shop) continue;
      out.push({ id: e.id, name: names ? e.name : "", c: e.c, r: e.r, zzz: now - e.idleSince >= e.limits.zzzMs, ...(e.look ? { look: e.look } : {}) });
      if (out.length >= max) break;
    }
    return out;
  }
}
