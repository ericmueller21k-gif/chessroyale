/**
 * Rides in the town square (Oct 31; Nov 1, rides v2: docs/decisions/2026-11-01-rides-v2.md): a pawn wearing a ride (crates.ts,
 * the `ride` slot) sits on it, the ride's `idle` standing and its `move` walking, one cycle a square at the walk's own pace;
 * seen from the side walking left or right, from behind walking up the screen and from the front walking down (a ride without
 * those views keeps its side). While you run on a ride with a trail, each square you leave gets its mark instead of the droplets.
 *
 * Nothing about a ride is drawn in the town's frame loop beyond one picture a rider, as a pawn is. Each rider's frames are
 * composed once, as the rider is first needed: every frame of every view, from the ride's own drawing (components/rides/, its
 * own chunk, loaded first if it hasn't: load.ts; as SVG made into an image: draw.tsx) in the ride's colors, at the rider's size, with the rider's pawn on its seat (the ride's
 * back, the pawn, the ride's front), one frame an animation frame, never all at once; then its trail marks the same way. Nothing
 * is fetched (until Nov 1 each ride came as WebP sheets baked in every color: two rides were 2 MB, fifteen with three views
 * would have been about 40 MB). Riders on the same ride, in the same colors and size, with the same pawn share one set of frames,
 * and every set is freed when the town closes (`dropRiders`). Until its frames are ready a person walks on foot as before, in the
 * box and under the tag the rider will have (its numbers are all measured ahead: ride-cells.ts, so nothing moves as it appears). A ride
 * shows its colors, not its copy's blotches or its shine (the frames are shared by color).
 *
 * Its size (Nov 1; components/rides/scale.ts): the ride is drawn at its scale (RIDES.scale, or an admin's `?rideScale=`) about
 * its saddle as its frames are composed, the pawn at its own size on the scaled saddle; nothing of it is worked out per frame.
 */
import { h } from "preact";
import { RIDE_PX, type RideCell, type RideCells } from "./ride-cells.ts";
import { TOWN_FEEL } from "./feel.ts";
import { rideScale, scaledAt, scaledSeat, seatAnchor } from "../components/rides/scale.ts";
import { FACINGS, type RiderDraft, type RiderFacing } from "../components/rides/kit.ts";
import { loadRide, rideCells } from "../components/rides/load.ts";
import { RideLayer, RideMark, svgImage, svgText, type RideColors } from "../components/rides/draw.tsx";

/** The pawn a rider carries: its picture (the square's, dressed or plain), the margin round the pawn's box in it, and its top (a share of the picture, down). */
export interface RiderPawn {
  img: CanvasImageSource & { width: number; height: number };
  pad: number;
  top: number;
}

/** A ride (its item id) and its measured views (ride-cells.ts: all a rider's numbers; its drawing loads as its frames are composed). */
export interface RideArt {
  id: string;
  cells: RideCells;
}

/**
 * One view of a rider (side, back or front): every frame of its idle and move with the pawn on its seat, composed once into a
 * canvas each, and the numbers that place them (all from the view's measured numbers, `m`: none wait for the drawing). All its frames share one box (`x0`, `y0`, `w`, `h`, in the pawn's square's
 * units) round the ride's cell and the raised pawn. The ride is drawn at `k` about its saddle (`seatAnchor`, this view's own),
 * the pawn at its own size on the scaled saddle (`scaledSeat`).
 */
export class RiderView {
  frames: { idle: HTMLCanvasElement[]; move: HTMLCanvasElement[] } = { idle: [], move: [] };
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
  /** Where the ride stands (on the square's middle) and the top of what's drawn standing (its name tag), as shares of the box. */
  readonly footX: number;
  readonly footY: number;
  readonly top: number;
  /** When each idle frame ends (ms from the loop's start), and the loop; where each move frame ends (a share of a step). */
  readonly idleEnds: number[];
  readonly idleLoop: number;
  readonly moveEnds: number[];
  /** The ride's cell on the pawn's square at its scale (x, y, w, h, in units). */
  readonly cell: readonly [number, number, number, number];
  /** Where the pawn sits on each frame at its scale (x, y, tilt, cut: `scaledSeat`). */
  readonly seats: { readonly idle: readonly (readonly number[])[]; readonly move: readonly (readonly number[])[] };
  /** The move's lift on each frame at its scale (units up: the hop). */
  readonly lift: readonly number[];
  constructor(
    readonly facing: RiderFacing,
    m: RideCell,
    readonly pawn: RiderPawn,
    k: number,
    foot: number,
  ) {
    // (A frame's row: [ms, x, y, tilt, cut], a move's then its dy.)
    const seat = (row: readonly number[]) => row.slice(1, 5);
    const a = seatAnchor(seat(m.idle[0]!));
    const [cx, cy, cw, ch] = (this.cell = [scaledAt(m.cell[0], a[0], k), scaledAt(m.cell[1], a[1], k), m.cell[2] * k, m.cell[3] * k]);
    this.seats = { idle: m.idle.map((r) => scaledSeat(seat(r), a, k)), move: m.move.map((r) => scaledSeat(seat(r), a, k)) };
    this.lift = m.move.map((r) => -r[5]! * k);
    const p = 100 * pawn.pad;
    // Room for the pawn's picture raised onto its seat (its items capped 9 units over its square: Items.tsx) and tilted.
    const lift = Math.min(...this.seats.idle.map((s) => s[1]!), ...this.seats.move.map((s) => s[1]!));
    this.x0 = Math.min(cx, -p - 12);
    this.y0 = Math.floor(Math.min(cy, Math.max(-p, -12) + lift - 4));
    this.w = Math.max(cx + cw, 100 + p + 12) - this.x0;
    this.h = cy + ch - this.y0;
    this.footX = (scaledAt(50, a[0], k) - this.x0) / this.w;
    this.footY = (scaledAt(foot, a[1], k) - this.y0) / this.h;
    // Its top standing: the ride's highest drawn row, or its pawn's top raised onto the seat, whichever is higher.
    const rideTop = cy + k * m.top;
    const pawnTop = -p + pawn.top * (100 + 2 * p) + Math.min(...this.seats.idle.map((s) => s[1]!));
    this.top = (Math.min(rideTop, pawnTop) - this.y0) / this.h;
    let t = 0;
    this.idleEnds = m.idle.map((r) => (t += Math.max(16, r[0]!)));
    this.idleLoop = t;
    const total = m.move.reduce((x, r) => x + r[0]!, 0);
    t = 0;
    this.moveEnds = m.move.map((r) => (t += r[0]!) / total);
  }
  /** Its idle's frame `t` ms into the loop. */
  idleIndex(t: number): number {
    const u = ((t % this.idleLoop) + this.idleLoop) % this.idleLoop;
    let i = 0;
    while (i < this.idleEnds.length - 1 && u >= this.idleEnds[i]!) i++;
    return i;
  }
  /** Its move's frame index `t` (0 to 1) through a step. */
  moveIndex(t: number): number {
    let i = 0;
    while (i < this.moveEnds.length - 1 && t >= this.moveEnds[i]!) i++;
    return i;
  }
}

/**
 * A rider's trail mark (the ride's `trail`), composed once: `frames[view][n % 2][f]`, view 0 side (going right: mirrored for
 * left), 1 back (up), 2 front (down); each frame's end (ms after it lands) and its life; its box (units on the pawn's square, at
 * the ride's size); one every `every` squares.
 */
export interface RiderTrail {
  readonly frames: HTMLCanvasElement[][][];
  readonly ends: readonly number[];
  readonly life: number;
  readonly w: number;
  readonly h: number;
  readonly every: number;
}

/** A step of composing: the SVGs it draws from (made in an animation frame), then what it does with them (in the next). */
interface Job {
  make: () => string[];
  done: (imgs: HTMLImageElement[]) => void;
}

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

/**
 * One rider: a pawn on its ride, in its three views (`views[0]` side, `[1]` back, `[2]` front: the side's own when the ride has
 * no such view), and its trail mark if the ride leaves one.
 */
export class Rider {
  readonly views: readonly [RiderView, RiderView, RiderView];
  readonly trail: RiderTrail | null;
  /** Every frame composed: drawn from now on (before, the person walks on foot). */
  ready = false;
  /** Its shadows' size (TOWN_FEEL.rides, at its scale). */
  readonly shadow: number;
  /** How far off the screen's sides it's drawn from (squares): its ride reaches about 1.46 squares from its foot at scale 1. */
  readonly margin: number;
  /** How many people ride on these frames (`shareRider`). */
  users = 0;
  private dead = false;
  private readonly waiting: ((r: Rider) => void)[] = [];
  constructor(
    readonly art: RideArt,
    readonly colors: RideColors,
    readonly pawn: RiderPawn,
    /** Its pawn seen from behind (its face items left off): the back view's. */
    readonly pawnBack: RiderPawn = pawn,
    /** Compose its frames (false: only work its numbers out, for tests). */
    compose = true,
    /** The ride's size under its pawn (RIDES.scale; 1: as drawn). */
    readonly scale = 1,
  ) {
    const { id, cells } = art;
    const k = scale;
    const feel = TOWN_FEEL.rides[id] ?? { foot: 96, shadow: 1 };
    const side = new RiderView("side", cells.side, pawn, k, feel.foot);
    const back = cells.back ? new RiderView("back", cells.back, pawnBack, k, feel.foot) : side;
    const front = cells.front ? new RiderView("front", cells.front, pawn, k, feel.foot) : side;
    this.views = [side, back, front];
    this.shadow = feel.shadow * k;
    this.margin = 1.5 * Math.max(1, k);
    const t = cells.trail;
    let at = 0;
    this.trail = t ? { frames: FACINGS.map(() => [[], []]), ends: t.ms.map((ms) => (at += ms)), life: at, w: t.w * k, h: t.h * k, every: t.every } : null;
    if (compose) this.start();
  }
  /** The ride's item id and color (the test hook). */
  get id(): string {
    return this.art.id;
  }
  /** Its frames are on their way (its drawing loading, or being composed): its person walks on foot meanwhile, in its box. */
  get coming(): boolean {
    return !this.ready && !this.dead;
  }
  get color(): string {
    return this.colors.color;
  }
  /** Calls `f` once its frames are ready (in a moment if they are: never before the caller has its rider in hand). */
  then(f: (r: Rider) => void): void {
    if (this.ready) queueMicrotask(() => f(this));
    else if (!this.dead) this.waiting.push(f);
  }
  /** Loads the ride's drawing (its own chunk, once for everyone: load.ts), then composes its frames from it, one an animation frame; then it's ready. */
  private start(): void {
    void loadRide(this.id)
      .then((d) => {
        // (Its chunk didn't come: as a picture that fails, below.)
        if (!d) throw new Error(`The ride ${this.id}'s drawing didn't load.`);
        return this.compose(this.jobs(d));
      })
      .then(
        () => {
          if (this.dead) return;
          this.ready = true;
          for (const f of this.waiting.splice(0)) f(this);
        },
        () => {
          // (A picture or the drawing didn't come: these frames are forgotten, so a later rider tries again; this one stays on foot.)
          this.drop();
          for (const [key, x] of riders) if (x === this) riders.delete(key);
        },
      );
  }
  /** Its frames' jobs: every frame of every view, then its trail marks, from the ride's drawing `d`. */
  private jobs(d: RiderDraft): Job[] {
    const k = this.scale;
    const s = RIDE_PX;
    const jobs: Job[] = [];
    for (const rv of new Set(this.views)) {
      const cell = this.art.cells[rv.facing]!.cell;
      for (const anim of ["idle", "move"] as const)
        for (let i = 0; i < rv.seats[anim].length; i++) {
          // (The ride's layers drawn at its size, so they're put down pixel for pixel.)
          const layer = (part: "Back" | "Front") => svgText(h(RideLayer, { d, view: rv.facing, c: this.colors, anim, f: i, part }), cell, s * k);
          jobs.push({ make: () => [layer("Back"), layer("Front")], done: ([b, f]) => (rv.frames[anim][i] = this.frame(rv, anim, i, b!, f!)) });
        }
    }
    const tr = this.trail;
    const mark = d.trail;
    if (tr && mark) {
      const box = [-mark.w / 2, -mark.h / 2, mark.w, mark.h] as const;
      for (let v = 0; v < FACINGS.length; v++)
        for (let n = 0; n < 2; n++)
          for (let f = 0; f < mark.ms.length; f++)
            jobs.push({
              make: () => [svgText(h(RideMark, { d, view: FACINGS[v]!, c: this.colors, f, n }), box, s * k)],
              // (As a canvas: an SVG image would be drawn again from its shapes every time it's drawn.)
              done: ([img]) => {
                const c = document.createElement("canvas");
                c.width = img!.width;
                c.height = img!.height;
                c.getContext("2d")!.drawImage(img!, 0, 0);
                tr.frames[v]![n]![f] = c;
              },
            });
    }
    return jobs;
  }
  /** The jobs, one an animation frame: each puts down what the one before made, then makes its own (its images decode in between). */
  private async compose(jobs: Job[]): Promise<void> {
    await nextFrame();
    if (this.dead || !jobs.length) return;
    let next = Promise.all(jobs[0]!.make().map(svgImage));
    for (let j = 0; j < jobs.length; j++) {
      const imgs = await next;
      await nextFrame();
      if (this.dead) return;
      jobs[j]!.done(imgs);
      if (j + 1 < jobs.length) next = Promise.all(jobs[j + 1]!.make().map(svgImage));
    }
  }
  /** Stops composing and frees its frames (no one rides on them any more, or the town closed). */
  drop(): void {
    this.dead = true;
    this.waiting.length = 0;
    for (const rv of new Set(this.views)) {
      for (const c of [...rv.frames.idle, ...rv.frames.move]) if (c) c.width = c.height = 0;
      rv.frames = { idle: [], move: [] };
    }
    if (this.trail) for (const v of this.trail.frames) for (const n of v) for (const c of n.splice(0)) if (c) c.width = c.height = 0;
  }
  /** One frame of a view: the ride's back, the pawn raised onto its seat, tilted and hidden below the seat, the ride's front. */
  private frame(rv: RiderView, anim: "idle" | "move", i: number, back: HTMLImageElement, front: HTMLImageElement): HTMLCanvasElement {
    const s = RIDE_PX;
    const pawn = rv.pawn;
    const c = document.createElement("canvas");
    c.width = Math.ceil(rv.w * s);
    c.height = Math.ceil(rv.h * s);
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    // The ride's cell at its scale (its layers drawn at that size).
    const cx = (rv.cell[0] - rv.x0) * s;
    const cy = (rv.cell[1] - rv.y0) * s;
    g.drawImage(back, cx, cy, rv.cell[2] * s, rv.cell[3] * s);
    const [px, py, tilt, seatCut] = rv.seats[anim][i]! as [number, number, number, number];
    g.save();
    // The pawn's square, on its seat: tilted round its base (50, 88), hidden below the seat's cut.
    g.translate((px - rv.x0) * s, (py - rv.y0) * s);
    if (tilt) {
      g.translate(50 * s, 88 * s);
      g.rotate((tilt * Math.PI) / 180);
      g.translate(-50 * s, -88 * s);
    }
    g.beginPath();
    g.rect(-60 * s, -60 * s, 220 * s, (60 + seatCut) * s);
    g.clip();
    const p = 100 * pawn.pad;
    g.drawImage(pawn.img, -p * s, -p * s, (100 + 2 * p) * s, (100 + 2 * p) * s);
    g.restore();
    g.drawImage(front, cx, cy, rv.cell[2] * s, rv.cell[3] * s);
    return c;
  }
}

/** The riders in the town, by ride, colors, side, scale and pawn (`pawnKey`: the pawn's look), shared by everyone who looks the same. */
const riders = new Map<string, Rider>();

/**
 * A rider for one more person on `art` in `colors` with this pawn (`pawnKey` names its look: the same key, the same
 * pictures): the one already made for that look, or a new one; `done` once its frames are ready. Give it back with
 * `leaveRider` when the person's look changes.
 */
export function shareRider(art: RideArt, colors: RideColors, pawnKey: string, pawn: RiderPawn, pawnBack: RiderPawn, done: (r: Rider) => void): Rider {
  // (Its size as it's made: RIDES.scale, or an admin's `?rideScale=` once it counts.)
  const scale = rideScale(art.id);
  const key = `${art.id}|${colors.color}|${colors.color2}|${colors.side}|${scale}|${pawnKey}`;
  let r = riders.get(key);
  if (!r) riders.set(key, (r = new Rider(art, colors, pawn, pawnBack, true, scale)));
  r.users++;
  r.then(done);
  return r;
}

/** One person fewer rides on `r`: freed once no one does. */
export function leaveRider(r: Rider): void {
  if (--r.users > 0) return;
  for (const [k, x] of riders) if (x === r) riders.delete(k);
  r.drop();
}

/** The town closes: every rider's frames freed. */
export function dropRiders(): void {
  for (const r of riders.values()) r.drop();
  riders.clear();
}

/** (Tests) How many sets of rider frames are held now. */
export const ridersHeld = () => ({ riders: riders.size });

/** A ride's measured views by its item id (undefined: not a ride). */
export function rideArt(def: string | undefined): RideArt | undefined {
  const cells = rideCells(def);
  return def && cells ? { id: def, cells } : undefined;
}
