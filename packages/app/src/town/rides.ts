/**
 * Rides in the town square (Oct 31; docs/decisions/2026-10-31-rides.md): a pawn wearing a ride (crates.ts, the `ride` slot)
 * sits on it, the ride's `idle` standing and its `move` walking, one cycle a square at the walk's own pace.
 *
 * Nothing about a ride is drawn in the town's frame loop beyond one picture a rider, as a pawn is. Each ride's frames are
 * baked ahead in every color (`scripts/bake-rides.ts`: `./rides/ride-<ride>-<color>.png` and `ride-sheets.ts`); the town
 * fetches the one sheet a rider wears (not precached: vite.config.ts), cuts it into its frames' backs and fronts once
 * (`RideCut`, shared by every rider in that color), and puts each rider's pawn (as the square draws it: dressed or plain)
 * between them once, every frame of its idle and move into a canvas of its own (`Rider`), a few frames at a time off the
 * frame loop. Until that's done the person walks on foot as before. A ride shows its color, not its purity's blotches
 * or its shine (they're each copy's own; the sheets are per color).
 */
import { RIDE_PX, RIDE_SHEETS, type RideSheet } from "./ride-sheets.ts";
import { TOWN_FEEL } from "./feel.ts";

/** Each sheet's address, by its name ("ride-moon-ride-cobalt"). */
const SHEET_URL: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("./rides/*.png", { eager: true, query: "?url", import: "default" })).map(([path, url]) => [path.replace(/^.*\/|\.png$/g, ""), url]),
);

/** A ride's sheet in one color, cut into its frames (backs and fronts, idle and move) once its picture has loaded. */
class RideCut {
  readonly back: { idle: HTMLCanvasElement[]; move: HTMLCanvasElement[] } = { idle: [], move: [] };
  readonly front: { idle: HTMLCanvasElement[]; move: HTMLCanvasElement[] } = { idle: [], move: [] };
  ready = false;
  failed = false;
  private readonly waiting: (() => void)[] = [];
  constructor(readonly sheet: RideSheet, color: string) {
    const url = SHEET_URL[`ride-${sheet.id}-${color}`];
    if (!url) {
      this.failed = true;
      return;
    }
    const img = new Image();
    img.onload = () => {
      (["idle", "move"] as const).forEach((anim, a) =>
        (["back", "front"] as const).forEach((part, b) => {
          this[part][anim] = sheet.ms[anim].map((_, col) => {
            const c = document.createElement("canvas");
            c.width = sheet.w;
            c.height = sheet.h;
            c.getContext("2d")!.drawImage(img, col * sheet.w, (2 * a + b) * sheet.h, sheet.w, sheet.h, 0, 0, sheet.w, sheet.h);
            return c;
          });
        }),
      );
      this.ready = true;
      for (const f of this.waiting.splice(0)) f();
    };
    img.onerror = () => void (this.failed = true);
    img.src = url;
  }
  /** Calls `f` once the frames are cut (at once if they are). */
  then(f: () => void): void {
    if (this.ready) f();
    else if (!this.failed) this.waiting.push(f);
  }
}
const cuts = new Map<string, RideCut>();
function cutOf(sheet: RideSheet, color: string): RideCut {
  const key = `${sheet.id}|${color}`;
  let c = cuts.get(key);
  if (!c) cuts.set(key, (c = new RideCut(sheet, color)));
  return c;
}

/** The pawn a rider carries: its picture (the square's, dressed or plain), the margin round the pawn's box in it, and its top (a share of the picture, down). */
export interface RiderPawn {
  img: CanvasImageSource & { width: number; height: number };
  pad: number;
  top: number;
}

/** Frames composed in each slice of the work (each a canvas and three draws), a beat apart, so a rider never costs a frame. */
const PER_SLICE = 3;

/**
 * One rider: a pawn on its ride, every frame of the ride's idle and move with the pawn on its seat, composed once into a
 * canvas each (the ride's back, the pawn raised onto its seat, tilted and hidden below the seat, the ride's front). All of
 * them share one box (`x0`, `y0`, `w`, `h`, in the pawn's square's units) round the ride's cell and the raised pawn.
 */
export class Rider {
  readonly frames: { idle: HTMLCanvasElement[]; move: HTMLCanvasElement[] } = { idle: [], move: [] };
  /** Every frame composed: drawn from now on (before, the person walks on foot). */
  ready = false;
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
  /** Its shadows' size (TOWN_FEEL.rides). */
  readonly shadow: number;
  private dead = false;
  constructor(
    readonly sheet: RideSheet,
    readonly color: string,
    readonly pawn: RiderPawn,
    /** Called once every frame is composed (not if dropped first). */
    private readonly onReady?: (r: Rider) => void,
  ) {
    const [cx, cy, cw, ch] = sheet.cell;
    const p = 100 * pawn.pad;
    // Room for the pawn's picture raised onto its seat (its items capped 9 units over its square: Items.tsx) and tilted.
    const lift = Math.min(...sheet.seat.idle.map((s) => s[1]!), ...sheet.seat.move.map((s) => s[1]!));
    this.x0 = Math.min(cx, -p - 12);
    this.y0 = Math.floor(Math.min(cy, Math.max(-p, -12) + lift - 4));
    this.w = Math.max(cx + cw, 100 + p + 12) - this.x0;
    this.h = cy + ch - this.y0;
    const feel = TOWN_FEEL.rides[sheet.id] ?? { foot: 96, shadow: 1 };
    this.footX = (50 - this.x0) / this.w;
    this.footY = (feel.foot - this.y0) / this.h;
    this.shadow = feel.shadow;
    // Its top standing: the ride's highest drawn row, or its pawn's top raised onto the seat, whichever is higher.
    const rideTop = cy + sheet.top / RIDE_PX;
    const pawnTop = -p + pawn.top * (100 + 2 * p) + Math.min(...sheet.seat.idle.map((s) => s[1]!));
    this.top = (Math.min(rideTop, pawnTop) - this.y0) / this.h;
    let t = 0;
    this.idleEnds = sheet.ms.idle.map((ms) => (t += Math.max(16, ms)));
    this.idleLoop = t;
    const total = sheet.ms.move.reduce((a, b) => a + b, 0);
    t = 0;
    this.moveEnds = sheet.ms.move.map((ms) => (t += ms) / total);
    cutOf(sheet, color).then(() => this.compose());
  }
  /** Stops composing (its person's look changed or the town closed). */
  drop(): void {
    this.dead = true;
  }
  /** Composes its frames a slice at a time, a beat apart (never in the town's frame loop), then it's ready. */
  private compose(): void {
    const cut = cutOf(this.sheet, this.color);
    const jobs: ["idle" | "move", number][] = [...this.sheet.ms.idle.map((_, i) => ["idle", i] as ["idle", number]), ...this.sheet.ms.move.map((_, i) => ["move", i] as ["move", number])];
    const step = () => {
      if (this.dead) return;
      for (const [anim, i] of jobs.splice(0, PER_SLICE)) this.frames[anim][i] = this.frame(cut, anim, i);
      if (jobs.length) setTimeout(step, 0);
      else {
        this.ready = true;
        this.onReady?.(this);
      }
    };
    step();
  }
  private frame(cut: RideCut, anim: "idle" | "move", i: number): HTMLCanvasElement {
    const s = RIDE_PX;
    const { sheet, pawn } = this;
    const c = document.createElement("canvas");
    c.width = Math.ceil(this.w * s);
    c.height = Math.ceil(this.h * s);
    const g = c.getContext("2d")!;
    const cx = (sheet.cell[0] - this.x0) * s;
    const cy = (sheet.cell[1] - this.y0) * s;
    g.drawImage(cut.back[anim][i]!, cx, cy, sheet.w, sheet.h);
    const [px, py, tilt, seatCut] = sheet.seat[anim][i]! as [number, number, number, number];
    g.save();
    // The pawn's square, on its seat: tilted round its base (50, 88), hidden below the seat's cut.
    g.translate((px - this.x0) * s, (py - this.y0) * s);
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
    g.drawImage(cut.front[anim][i]!, cx, cy, sheet.w, sheet.h);
    return c;
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

/** A ride's sheet by its item id (undefined: not a ride, or none baked). */
export const rideSheet = (def: string | undefined): RideSheet | undefined => (def ? (RIDE_SHEETS as Record<string, RideSheet>)[def] : undefined);
