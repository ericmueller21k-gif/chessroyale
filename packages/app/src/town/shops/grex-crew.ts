/**
 * Jefferson's warehouse crew, pure (Nov 4; docs/decisions/2026-11-04-jefferson-home.md): the two machines on their loops and the
 * crew's walk over to the table in his intro. No DOM; tested in packages/app/test/shop-grex.test.ts. The room (ShopRoom.tsx) draws
 * them from their baked sheets (grex-crew-sheets.ts).
 *
 * The machines (Eric, Nov 4: "If you block it, it stops. If you move out of the way, it starts moving again"): the scissor lift
 * shuttles along its row and the forklift works its corner (the art's SHOP_GREX_LIFT_PATH and SHOP_GREX_FORK_PATH), a square at a
 * time at a slow walk (SHOP_FEEL.crew). Each loop is a list of legs: a step from one square to the next (driving; the forklift backs up
 * west, as it always faces east) or a beat in place (the lift's platform up and down; the forklift's forks down, up, onto the shelf
 * and off it). Before each step a machine looks at the square it's stepping onto and the one after it: anyone standing there (you,
 * or any figure) and it waits; once they're clear it goes on. It blocks your walking where it stands (`occupies`). Each client runs
 * them from its own room's clock: no server state.
 */
import { CREW_SHEETS, type CrewName } from "./grex-crew-sheets.ts";

export interface Sq {
  c: number;
  r: number;
}
/** Where the loose pallet is: on the floor, on the forks or on the shelf slot. */
export type PalletAt = "floor" | "forks" | "shelf";
/** One leg of a machine's loop. */
export interface Leg {
  /** A step to the next square (`from` to `to`, adjacent), or a beat in place (`from` = `to`). */
  from: Sq;
  to: Sq;
  ms: number;
  /** Its animation (the machine's sheet's), from its first frame (`once`: held on its last), or held on one frame (`still`). */
  anim: string;
  still?: number;
  /** Mirrored (facing west): the lift going west; the forklift never (it backs up). */
  flip: boolean;
  /** The pallet goes here `palletMs` into the leg (the forklift's). */
  pallet?: PalletAt;
  palletMs?: number;
}
/** A waypoint of the art's loops. */
export interface Waypoint {
  readonly at: readonly [number, number];
  readonly beat: string;
}
/** The loops' numbers (SHOP_FEEL.crew). */
export interface CrewFeel {
  stepMs: number;
  upHoldMs: number;
  endMs: number;
  homeMs: number;
}
const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);
const animMs = (who: CrewName, anim: string): readonly number[] => (CREW_SHEETS[who].anims as Record<string, { ms: readonly number[] }>)[anim]!.ms;
const sq = (a: readonly [number, number]): Sq => ({ c: a[0], r: a[1] });

/** The squares from `a` to `b` (one row or one column apart), a step at a time (not `a` itself). */
function stepsBetween(a: Sq, b: Sq): Sq[] {
  const out: Sq[] = [];
  const dc = Math.sign(b.c - a.c);
  const dr = Math.sign(b.r - a.r);
  let c = a.c;
  let r = a.r;
  for (let i = 0; i < 64 && (c !== b.c || r !== b.r); i++) {
    if (c !== b.c) c += dc;
    else r += dr;
    out.push({ c, r });
  }
  return out;
}

/**
 * The scissor lift's loop: along its row, a step a square (`drive`, mirrored going west), each `up` stop raising its platform a hair
 * (`up`, `upIdle` for `upHoldMs`, `down`), and a rest at its start (`idle`, `endMs`).
 */
export function liftLegs(path: readonly Waypoint[], feel: CrewFeel): Leg[] {
  const legs: Leg[] = [];
  let flip = false;
  for (let i = 0; i < path.length; i++) {
    const w = path[i]!;
    const at = sq(w.at);
    if (w.beat === "start") legs.push({ from: at, to: at, ms: feel.endMs, anim: "idle", flip });
    if (w.beat === "up") {
      legs.push({ from: at, to: at, ms: sum(animMs("lift", "up")), anim: "up", flip });
      legs.push({ from: at, to: at, ms: feel.upHoldMs, anim: "upIdle", flip });
      legs.push({ from: at, to: at, ms: sum(animMs("lift", "down")), anim: "down", flip });
    }
    const next = path[i + 1];
    if (!next) break;
    let from = at;
    for (const to of stepsBetween(at, sq(next.at))) {
      if (to.c !== from.c) flip = to.c < from.c;
      legs.push({ from, to, ms: feel.stepMs, anim: "drive", flip });
      from = to;
    }
  }
  return legs;
}

/**
 * The forklift's loop, two laps (the art's): it drives forward east and backs up west (`reverse`), keeping whichever it was playing
 * going north or south; at `pick` its forks go down under the floor pallet and up with it; at `stack` they raise it to the shelf
 * and set it down on the beam; at `unstack` they rise empty and lift it off; at `drop` they set it down on the floor (and come up
 * empty). Backing out of the slot it keeps its forks where they were (its last frame held) until it has backed off, then lowers them.
 * A rest at home between laps (`homeMs`).
 */
export function forkLegs(path: readonly Waypoint[], feel: CrewFeel): Leg[] {
  const legs: Leg[] = [];
  const beat = (at: Sq, anim: string, extra: Partial<Leg> = {}) => legs.push({ from: at, to: at, ms: sum(animMs("forklift", anim)), anim, flip: false, ...extra });
  let drive = "drive";
  /** After the shelf: backing out with the forks held up (its last frame), lowered at the next waypoint. */
  let held: { anim: string; then: string } | null = null;
  for (let i = 0; i < path.length; i++) {
    const w = path[i]!;
    const at = sq(w.at);
    if (held && w.beat === "back") {
      beat(at, held.then);
      held = null;
    }
    if (w.beat === "pick") {
      beat(at, "forksDown");
      beat(at, "forksUp", { pallet: "forks", palletMs: 0 });
    } else if (w.beat === "stack") {
      beat(at, "raisePallet");
      beat(at, "set", { pallet: "shelf", palletMs: animMs("forklift", "set")[0]! });
      held = { anim: "set", then: "lowerFrom" };
    } else if (w.beat === "unstack") {
      beat(at, "raise");
      beat(at, "lift", { pallet: "forks", palletMs: 0 });
      held = { anim: "lift", then: "lower" };
    } else if (w.beat === "drop") {
      beat(at, "forksDown", { pallet: "floor", palletMs: sum(animMs("forklift", "forksDown")) });
      beat(at, "forksUp");
    } else if (w.beat === "home" && i > 0) legs.push({ from: at, to: at, ms: feel.homeMs, anim: "idle", flip: false });
    const next = path[i + 1];
    if (!next) break;
    let from = at;
    for (const to of stepsBetween(at, sq(next.at))) {
      if (to.c !== from.c) drive = to.c > from.c ? "drive" : "reverse";
      const h = held ? animMs("forklift", held.anim).length - 1 : undefined;
      legs.push({ from, to, ms: feel.stepMs, anim: held ? held.anim : drive, ...(h !== undefined ? { still: h } : {}), flip: false });
      from = to;
    }
  }
  return legs;
}

/** What a machine shows now: where its foot is (squares), its animation and frame, mirrored or not, and whether it's waiting. */
export interface MachinePose {
  c: number;
  r: number;
  anim: string;
  frame: number;
  flip: boolean;
  waiting: boolean;
}

/** The frame (from 0) `t` ms into frames of these times: looping, or held on its last. */
export function frameOf(ms: readonly number[], t: number, loop: boolean): number {
  const total = sum(ms);
  if (!ms.length || total <= 0) return 0;
  let u = loop ? ((t % total) + total) % total : Math.max(0, t);
  for (let i = 0; i < ms.length; i++) {
    if (u < ms[i]!) return i;
    u -= ms[i]!;
  }
  return ms.length - 1;
}

/**
 * A machine on its loop. `update(dt, taken)` runs it on `dt` ms: a step begins only when `taken(c, r)` is false for the square it's
 * stepping onto and the one after it (its way); otherwise it waits there, its animation its idle, and tries again next frame. Once
 * a step or a beat has begun it finishes. `stop()` parks it where it is (the intro: its guy steps off).
 */
export class Machine {
  i = 0;
  t = 0;
  /** Ms into the animation playing (drive's frames run on across steps). */
  private animT = 0;
  waiting = false;
  stopped = false;
  /** Where the pallet is (the forklift's), and when it last changed hands (ms on the machine's own clock). */
  pallet: PalletAt = "floor";
  palletSince = -Infinity;
  /** The machine's own clock (ms run). */
  clock = 0;
  constructor(
    readonly who: "lift" | "forklift",
    readonly legs: readonly Leg[],
  ) {}
  private sheetAnim(a: string) {
    return (CREW_SHEETS[this.who].anims as Record<string, { ms: readonly number[]; loop: boolean }>)[a]!;
  }
  update(dt: number, taken: (c: number, r: number) => boolean): void {
    if (this.stopped) return;
    let left = Math.max(0, dt);
    for (let guard = 0; guard < 64 && left > 0; guard++) {
      const leg = this.legs[this.i]!;
      if (this.t === 0 && (leg.from.c !== leg.to.c || leg.from.r !== leg.to.r)) {
        const dc = leg.to.c - leg.from.c;
        const dr = leg.to.r - leg.from.r;
        if (taken(leg.to.c, leg.to.r) || taken(leg.to.c + dc, leg.to.r + dr)) {
          // (Waiting: its own clock and its idle run on; the loop doesn't.)
          this.waiting = true;
          this.clock += left;
          this.animT += left;
          return;
        }
      }
      this.waiting = false;
      const take = Math.min(left, leg.ms - this.t);
      const before = this.t;
      this.t += take;
      this.clock += take;
      this.animT += take;
      left -= take;
      if (leg.pallet && before <= (leg.palletMs ?? 0) && this.t >= (leg.palletMs ?? 0) && this.pallet !== leg.pallet) {
        this.pallet = leg.pallet;
        this.palletSince = this.clock - (this.t - (leg.palletMs ?? 0));
      }
      if (this.t >= leg.ms) {
        this.i = (this.i + 1) % this.legs.length;
        this.t = 0;
        const next = this.legs[this.i]!;
        if (next.anim !== leg.anim || next.still !== undefined || !this.sheetAnim(next.anim).loop) this.animT = 0;
      }
    }
  }
  /** Parks it where it is (its guy steps off in the intro). */
  stop(): void {
    this.stopped = true;
  }
  /** Its pose now, into `out`. */
  pose(out: MachinePose): MachinePose {
    const leg = this.legs[this.i]!;
    const u = leg.ms > 0 ? this.t / leg.ms : 0;
    out.c = leg.from.c + (leg.to.c - leg.from.c) * u;
    out.r = leg.from.r + (leg.to.r - leg.from.r) * u;
    out.flip = leg.flip;
    out.waiting = this.waiting;
    // (Waiting: its idle, as it stands; the forklift with its forks held up keeps them held.)
    const anim = this.waiting && leg.still === undefined ? "idle" : leg.anim;
    const a = this.sheetAnim(anim);
    out.anim = anim;
    out.frame = leg.still !== undefined ? leg.still : frameOf(a.ms, this.waiting ? this.clock : this.animT, a.loop);
    return out;
  }
  /**
   * The squares it blocks for walkers now: the square under its foot, and the one it's stepping onto; the forklift its forks' square
   * ahead (east) of each too.
   */
  occupies(c: number, r: number): boolean {
    const leg = this.legs[this.i]!;
    const stepping = this.t > 0 || this.waiting === false;
    const on = (s: Sq) => (s.c === c || (this.who === "forklift" && s.c + 1 === c)) && s.r === r;
    if (this.stopped) {
      const p = this.pose(scratch);
      return on({ c: Math.round(p.c), r: Math.round(p.r) });
    }
    return on(leg.from) || (stepping && on(leg.to));
  }
}
const scratch: MachinePose = { c: 0, r: 0, anim: "", frame: 0, flip: false, waiting: false };

/** Where a walk along `pts` (squares) is `ms` in at `speed` squares a second: the point, the way it faces (1 east, -1 west), done. */
export function along(pts: readonly Sq[], speed: number, ms: number, out: { c: number; r: number; face: 1 | -1; done: boolean }): typeof out {
  let d = (Math.max(0, ms) / 1000) * speed;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const L = Math.hypot(b.c - a.c, b.r - a.r);
    if (d <= L && L > 0) {
      const u = d / L;
      out.c = a.c + (b.c - a.c) * u;
      out.r = a.r + (b.r - a.r) * u;
      if (b.c !== a.c) out.face = b.c > a.c ? 1 : -1;
      out.done = false;
      return out;
    }
    d -= L;
    if (b.c !== a.c) out.face = b.c > a.c ? 1 : -1;
  }
  const last = pts[pts.length - 1]!;
  out.c = last.c;
  out.r = last.r;
  out.done = true;
  return out;
}
/** A walk's length (squares). */
export const routeLength = (pts: readonly Sq[]): number => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.c - pts[i - 1]!.c, p.r - pts[i - 1]!.r) : 0), 0);
