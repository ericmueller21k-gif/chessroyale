/**
 * Ginger's elves at work in his igloo (Nov 5; shop-ginger-nov5.md on claude/boss-art, "The elves"): the three walkers on their loops
 * round the battle spot's edge (each pausing at its turns, leaning on its candy cane), and the dispensing pair (elf A with the box,
 * elf B with the notepad) on their loop along the back wall: five stops at the lower row's bins, up the east stairs, five at the upper
 * row's tubes along the catwalk, down the west stairs, then again (about 47.5 s). Each stop A taps the dispenser, holds the box out,
 * fills it and tips it into his sack while B writes it down beside him; between stops B follows A half a square behind.
 *
 * They climb the stairs on the same height curve as you (levels.ts `liftAt`). Before each bit of its way an elf looks along it
 * (`SHOP_FEEL.elves.look` squares ahead): anyone standing there (you, or the boss walking in) and it waits where it is, going on once
 * it's clear (Jefferson's crew's rule, Nov 4: "If you block it, it stops. If you move out of the way, it starts moving again"). The
 * pair wait together. A stop once begun is played out. Every number is in SHOP_FEEL.elves; each client runs them from its own room's
 * clock: no server state. Pure: tested in packages/app/test/shop-ginger.test.ts.
 */
export type Pt = readonly [number, number];

/** A bit of an elf's loop: walking from one point to the next, or standing (`ms`) where it is. */
export type Leg = { kind: "walk"; from: Pt; to: Pt; len: number; ms: number } | { kind: "stand"; at: Pt; ms: number; stop: number };

/** Where an elf is and what it's doing now. */
export interface ElfPose {
  x: number;
  y: number;
  /** 1 faces east (as drawn), -1 west (mirrored). */
  face: 1 | -1;
  /** "walk", "idle" (a walker's pause, a beat), or a stop's job (A: "tap", "boxOut", "fill", "full"; B: "write"). */
  anim: string;
  /** Ms into that animation. */
  t: number;
  /** Waiting for someone in its way. */
  waiting: boolean;
}

const len = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** A walker's loop (the art's waypoints, each with its pause): walk to each in turn at `speed` squares a second, pause, and round again. */
export function walkerLegs(pts: readonly { at: Pt; pause: number }[], speed: number): Leg[] {
  const legs: Leg[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    if (a.pause > 0) legs.push({ kind: "stand", at: a.at, ms: a.pause, stop: -1 });
    const L = len(a.at, b.at);
    if (L > 0) legs.push({ kind: "walk", from: a.at, to: b.at, len: L, ms: (L / speed) * 1000 });
  }
  return legs;
}

/** The art's dispensing path (SHOP_GINGER_DISPENSE_PATH): its waypoints, the stops among them (where A faces, B's place). */
export interface DispenseStop {
  at: Pt;
  stop?: { face: 1 | -1 };
  b?: readonly [number, number, number];
}
/** The pair's loop: walk waypoint to waypoint at `speed`; at each stop stand `stopMs` (A's four jobs and a beat). Stops numbered 0 on. */
export function pairLegs(path: readonly DispenseStop[], speed: number, stopMs: number): Leg[] {
  const legs: Leg[] = [];
  let n = 0;
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    if (p.stop) legs.push({ kind: "stand", at: p.at, ms: stopMs, stop: n++ });
    const q = path[(i + 1) % path.length]!;
    const L = len(p.at, q.at);
    if (L > 0) legs.push({ kind: "walk", from: p.at, to: q.at, len: L, ms: (L / speed) * 1000 });
  }
  return legs;
}

export const loopMs = (legs: readonly Leg[]): number => legs.reduce((s, l) => s + l.ms, 0);

/**
 * An elf (or the pair) on its loop. `update(dt, taken)` runs it `dt` ms on, unless it's walking and `taken(c, r)` is true for a square
 * along its way within `look` squares ahead (then it waits, as it is, and tries again next frame). `pointAt(d)` is the point `d` squares
 * along its way from where it is now (negative: behind it).
 */
export class ElfLoop {
  /** Ms into its loop. */
  t: number;
  waiting = false;
  readonly total: number;
  constructor(
    readonly legs: readonly Leg[],
    start = 0,
  ) {
    this.total = loopMs(legs);
    this.t = ((start % this.total) + this.total) % this.total;
  }
  /** The leg it's on now and ms into it. */
  leg(out: { i: number; u: number } = { i: 0, u: 0 }): { i: number; u: number } {
    let t = this.t;
    for (let i = 0; i < this.legs.length; i++) {
      const l = this.legs[i]!;
      if (t < l.ms || i === this.legs.length - 1) {
        out.i = i;
        out.u = Math.min(t, l.ms);
        return out;
      }
      t -= l.ms;
    }
    return out;
  }
  private at = { i: 0, u: 0 };
  /** The point `d` squares along its way from where it is now (walking legs only count; standing ones are skipped), into `out`. */
  pointAt(d: number, out: { x: number; y: number }): { x: number; y: number } {
    const { i, u } = this.leg(this.at);
    const n = this.legs.length;
    let li = i;
    let l = this.legs[li]!;
    // Where along its walking leg (squares from its start); standing: at its place.
    let s = l.kind === "walk" ? (u / l.ms) * l.len : 0;
    let left = d;
    for (let guard = 0; guard < 4 * n; guard++) {
      if (l.kind === "walk") {
        const to = s + left;
        if (to >= 0 && to <= l.len) {
          const k = to / l.len;
          out.x = l.from[0] + (l.to[0] - l.from[0]) * k;
          out.y = l.from[1] + (l.to[1] - l.from[1]) * k;
          return out;
        }
        if (to > l.len) {
          left = to - l.len;
          li = (li + 1) % n;
        } else {
          left = to;
          li = (li - 1 + n) % n;
        }
      } else {
        if (left === 0) {
          out.x = l.at[0];
          out.y = l.at[1];
          return out;
        }
        li = left > 0 ? (li + 1) % n : (li - 1 + n) % n;
      }
      l = this.legs[li]!;
      s = left > 0 ? 0 : l.kind === "walk" ? l.len : 0;
    }
    out.x = l.kind === "walk" ? l.to[0] : l.at[0];
    out.y = l.kind === "walk" ? l.to[1] : l.at[1];
    return out;
  }
  private p = { x: 0, y: 0 };
  /** Runs it `dt` ms on, or waits: walking, and a square within `look` squares ahead `taken`, it waits. */
  update(dt: number, taken: (x: number, y: number) => boolean, look: readonly number[]): void {
    const { i } = this.leg(this.at);
    if (this.legs[i]!.kind === "walk") {
      for (const d of look) {
        this.pointAt(d, this.p);
        if (taken(this.p.x, this.p.y)) {
          this.waiting = true;
          return;
        }
      }
    }
    this.waiting = false;
    this.t = (this.t + dt) % this.total;
  }
  /** Where it is now and which way it faces (the way it walks, or a stand's: `face` for a stop), into `out`. */
  pose(out: ElfPose, faceAt: (stop: number) => 1 | -1 = () => 1): ElfPose {
    const { i, u } = this.leg(this.at);
    const l = this.legs[i]!;
    out.waiting = this.waiting;
    if (l.kind === "walk") {
      const k = u / l.ms;
      out.x = l.from[0] + (l.to[0] - l.from[0]) * k;
      out.y = l.from[1] + (l.to[1] - l.from[1]) * k;
      if (l.to[0] !== l.from[0]) out.face = l.to[0] > l.from[0] ? 1 : -1;
      out.anim = this.waiting ? "idle" : "walk";
      out.t = this.waiting ? 0 : this.t;
      return out;
    }
    out.x = l.at[0];
    out.y = l.at[1];
    if (l.stop >= 0) out.face = faceAt(l.stop);
    else {
      // (A pause faces the way it came.)
      const prev = this.legs[(i - 1 + this.legs.length) % this.legs.length]!;
      if (prev.kind === "walk" && prev.to[0] !== prev.from[0]) out.face = prev.to[0] > prev.from[0] ? 1 : -1;
    }
    out.anim = "idle";
    out.t = u;
    return out;
  }
}

/** A's jobs at a stop, in order, each its animation's length (ms): tap, boxOut, fill, full; then idle for the beat. */
export function stopJob(jobs: readonly { anim: string; ms: number }[], u: number, out: { anim: string; t: number }): { anim: string; t: number } {
  let t = u;
  for (const j of jobs) {
    if (t < j.ms) {
      out.anim = j.anim;
      out.t = t;
      return out;
    }
    t -= j.ms;
  }
  out.anim = "idle";
  out.t = t;
  return out;
}

/**
 * Elf B, from the pair's loop: half a square (`behind`) back along A's way while A walks; at a stop he walks over to his place for it
 * (`b`) in his first `moveMs`, writes there, and walks back onto A's way in its last `moveMs` (so he never jumps). Into `out` (x, y,
 * the lift his place gives at a stop: `lift`, null: the curve's), with his facing and animation.
 */
export function elfB(
  pair: ElfLoop,
  stops: readonly { face: 1 | -1; b: readonly [number, number, number] }[],
  behind: number,
  moveMs: number,
  out: ElfPose,
): ElfPose {
  const { i, u } = pair.leg();
  const l = pair.legs[i]!;
  const on = { x: 0, y: 0 };
  pair.pointAt(-behind, on);
  out.waiting = pair.waiting;
  if (l.kind === "walk") {
    const ahead = { x: 0, y: 0 };
    pair.pointAt(0, ahead);
    if (Math.abs(ahead.x - on.x) > 1e-6) out.face = ahead.x > on.x ? 1 : -1;
    out.x = on.x;
    out.y = on.y;
    out.anim = pair.waiting ? "idle" : "walk";
    out.t = pair.waiting ? 0 : pair.t;
    return out;
  }
  const st = l.stop >= 0 ? stops[l.stop] : undefined;
  if (!st) {
    out.x = on.x;
    out.y = on.y;
    out.anim = "idle";
    out.t = u;
    return out;
  }
  // (Over to his place and back, eased.)
  const w = Math.min(1, u / moveMs, (l.ms - u) / moveMs);
  const e = w * w * (3 - 2 * w);
  out.x = on.x + (st.b[0] - on.x) * e;
  out.y = on.y + (st.b[1] - on.y) * e;
  out.face = st.face;
  out.anim = w < 1 ? "walk" : "write";
  out.t = w < 1 ? u : u - moveMs;
  return out;
}
