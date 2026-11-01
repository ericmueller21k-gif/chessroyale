/**
 * Rides in the town square (Oct 31; docs/decisions/2026-10-31-rides.md): a pawn wearing a ride (crates.ts, the `ride` slot)
 * sits on it, the ride's `idle` standing and its `move` walking, one cycle a square at the walk's own pace.
 *
 * Nothing about a ride is drawn in the town's frame loop beyond one picture a rider, as a pawn is. Each ride's frames are
 * baked ahead in every color (`scripts/bake-rides.ts`: `./rides/ride-<ride>-<color>.webp` and `ride-sheets.ts`). The town
 * fetches the one sheet a rider wears (not precached: vite.config.ts) and decodes it off the page's thread
 * (`createImageBitmap`); then each rider's frames are composed straight from it (the ride's back, the rider's pawn on
 * its seat, the ride's front: source rectangles, no copies of the sheet), one frame an animation frame, never all at once.
 * The sheet is let go once no rider is being composed from it (a failed fetch is forgotten too, so a later rider tries
 * again). Riders on the same ride, in the same color, with the same pawn share one set of frames, and every set is freed
 * when the town closes (`dropRiders`). Until its frames are ready a person walks on foot as before. A ride shows its color,
 * not its purity's blotches or its shine (they're each copy's own; the sheets are per color).
 *
 * Its size (Nov 1; components/rides/scale.ts): the ride is drawn at its scale (RIDES.scale, or an admin's `?rideScale=`) about
 * its saddle as its frames are composed, the pawn at its own size on the scaled saddle; nothing of it is worked out per frame.
 */
import { RIDE_PX, RIDE_SHEETS, type RideSheet } from "./ride-sheets.ts";
import { TOWN_FEEL } from "./feel.ts";
import { rideScale, scaledAt, scaledSeat, seatAnchor } from "../components/rides/scale.ts";

/** Each sheet's address, by its name ("ride-moon-ride-cobalt"). */
const SHEET_URL: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("./rides/*.webp", { eager: true, query: "?url", import: "default" })).map(([path, url]) => [path.replace(/^.*\/|\.webp$/g, ""), url]),
);

/** A sheet's picture, decoded. */
type SheetPicture = ImageBitmap | HTMLImageElement;
/** A sheet being used (decoding, or composed from): its picture once decoded, and how many riders still need it. */
interface SheetUse {
  img: Promise<SheetPicture>;
  users: number;
}

/**
 * Fetches a sheet and decodes it off the page's thread: an ImageBitmap (`createImageBitmap`, decoded in full before it's
 * handed over, so drawing from it decodes nothing), or where there's none an image's own `decode()`.
 */
function fetchSheet(url: string): Promise<SheetPicture> {
  if (typeof createImageBitmap === "function" && typeof fetch === "function")
    return fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status}`))))
      .then((b) => createImageBitmap(b));
  const img = new Image();
  img.src = url;
  return img.decode().then(() => img);
}
/** Lets a decoded sheet go (an ImageBitmap's memory at once). */
function closeSheet(use: SheetUse): void {
  void use.img.then((p) => "close" in p && p.close(), () => {});
}
const sheets = new Map<string, SheetUse>();
const sheetKey = (sheet: RideSheet, color: string) => `${sheet.id}|${color}`;

/** The decoded sheet of a ride in a color, for one more rider (`letGo` when done); null if none was baked. */
function takeSheet(sheet: RideSheet, color: string): Promise<SheetPicture> | null {
  const key = sheetKey(sheet, color);
  let use = sheets.get(key);
  if (!use) {
    const url = SHEET_URL[`ride-${sheet.id}-${color}`];
    if (!url) return null;
    const u: SheetUse = { img: fetchSheet(url), users: 0 };
    // (A failed fetch or decode: forgotten, so the next rider in that color fetches it again.)
    u.img.catch(() => sheets.get(key) === u && sheets.delete(key));
    sheets.set(key, (use = u));
  }
  use.users++;
  return use.img;
}
function letGo(sheet: RideSheet, color: string): void {
  const key = sheetKey(sheet, color);
  const use = sheets.get(key);
  if (use && --use.users <= 0) {
    sheets.delete(key);
    closeSheet(use);
  }
}

/** The pawn a rider carries: its picture (the square's, dressed or plain), the margin round the pawn's box in it, and its top (a share of the picture, down). */
export interface RiderPawn {
  img: CanvasImageSource & { width: number; height: number };
  pad: number;
  top: number;
}

/** Each animation frame composes this many of a rider's frames (a canvas and three draws each): a rider never costs a frame. */
const PER_FRAME = 1;

/**
 * One rider: a pawn on its ride, every frame of the ride's idle and move with the pawn on its seat, composed once into a
 * canvas each (the ride's back, the pawn raised onto its seat, tilted and hidden below the seat, the ride's front). All of
 * them share one box (`x0`, `y0`, `w`, `h`, in the pawn's square's units) round the ride's cell and the raised pawn. The ride
 * is drawn at `scale` about its saddle (`seatAnchor`), the pawn at its own size on the scaled saddle (`scaledSeat`).
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
  /** Its shadows' size (TOWN_FEEL.rides, at its scale). */
  readonly shadow: number;
  /** The ride's cell on the pawn's square at its scale (x, y, w, h, in units). */
  readonly cell: readonly [number, number, number, number];
  /** Where the pawn sits on each frame at its scale (x, y, tilt, cut: `scaledSeat`). */
  readonly seats: { readonly idle: readonly (readonly number[])[]; readonly move: readonly (readonly number[])[] };
  /** The move's lift on each frame at its scale (units up: the hop). */
  readonly lift: readonly number[];
  /** How far off the screen's sides it's drawn from (squares): its ride reaches about 1.46 squares from its foot at scale 1. */
  readonly margin: number;
  /** How many people ride on these frames (`shareRider`). */
  users = 0;
  private dead = false;
  private readonly waiting: ((r: Rider) => void)[] = [];
  constructor(
    readonly sheet: RideSheet,
    readonly color: string,
    readonly pawn: RiderPawn,
    /** Compose its frames (false: only work its numbers out, for tests). */
    compose = true,
    /** The ride's size under its pawn (RIDES.scale; 1: as drawn). */
    readonly scale = 1,
  ) {
    // The ride at its scale about its saddle; the pawn's seat on each frame moved with the saddle, the pawn its own size.
    const k = scale;
    const a = seatAnchor(sheet.seat.idle[0]!);
    const [cx, cy, cw, ch] = (this.cell = [scaledAt(sheet.cell[0], a[0], k), scaledAt(sheet.cell[1], a[1], k), sheet.cell[2] * k, sheet.cell[3] * k]);
    this.seats = { idle: sheet.seat.idle.map((s) => scaledSeat(s, a, k)), move: sheet.seat.move.map((s) => scaledSeat(s, a, k)) };
    this.lift = sheet.lift.map((l) => l * k);
    this.margin = 1.5 * Math.max(1, k);
    const p = 100 * pawn.pad;
    // Room for the pawn's picture raised onto its seat (its items capped 9 units over its square: Items.tsx) and tilted.
    const lift = Math.min(...this.seats.idle.map((s) => s[1]!), ...this.seats.move.map((s) => s[1]!));
    this.x0 = Math.min(cx, -p - 12);
    this.y0 = Math.floor(Math.min(cy, Math.max(-p, -12) + lift - 4));
    this.w = Math.max(cx + cw, 100 + p + 12) - this.x0;
    this.h = cy + ch - this.y0;
    const feel = TOWN_FEEL.rides[sheet.id] ?? { foot: 96, shadow: 1 };
    this.footX = (scaledAt(50, a[0], k) - this.x0) / this.w;
    this.footY = (scaledAt(feel.foot, a[1], k) - this.y0) / this.h;
    this.shadow = feel.shadow * k;
    // Its top standing: the ride's highest drawn row, or its pawn's top raised onto the seat, whichever is higher.
    const rideTop = cy + (k * sheet.top) / RIDE_PX;
    const pawnTop = -p + pawn.top * (100 + 2 * p) + Math.min(...this.seats.idle.map((s) => s[1]!));
    this.top = (Math.min(rideTop, pawnTop) - this.y0) / this.h;
    let t = 0;
    this.idleEnds = sheet.ms.idle.map((ms) => (t += Math.max(16, ms)));
    this.idleLoop = t;
    const total = sheet.ms.move.reduce((a, b) => a + b, 0);
    t = 0;
    this.moveEnds = sheet.ms.move.map((ms) => (t += ms) / total);
    if (compose) this.start();
  }
  /** Calls `f` once its frames are ready (in a moment if they are: never before the caller has its rider in hand). */
  then(f: (r: Rider) => void): void {
    if (this.ready) queueMicrotask(() => f(this));
    else if (!this.dead) this.waiting.push(f);
  }
  /** Fetches its sheet, then composes its frames from it, one an animation frame; then it's ready. */
  private start(): void {
    const img = takeSheet(this.sheet, this.color);
    if (!img) return;
    const jobs: ["idle" | "move", number][] = [...this.sheet.ms.idle.map((_, i) => ["idle", i] as ["idle", number]), ...this.sheet.ms.move.map((_, i) => ["move", i] as ["move", number])];
    img.then(
      (sheet) => {
        const step = () => {
          if (this.dead) return letGo(this.sheet, this.color);
          for (const [anim, i] of jobs.splice(0, PER_FRAME)) this.frames[anim][i] = this.frame(sheet, anim, i);
          if (jobs.length) return void requestAnimationFrame(step);
          letGo(this.sheet, this.color);
          this.ready = true;
          for (const f of this.waiting.splice(0)) f(this);
        };
        requestAnimationFrame(step);
      },
      () => {
        // (Its sheet didn't come: it and these frames are forgotten, so a later rider tries again; this one stays on foot.)
        this.dead = true;
        this.waiting.length = 0;
        for (const [k, x] of riders) if (x === this) riders.delete(k);
      },
    );
  }
  /** Stops composing and frees its frames (no one rides on them any more, or the town closed). */
  drop(): void {
    this.dead = true;
    this.waiting.length = 0;
    for (const c of [...this.frames.idle, ...this.frames.move]) if (c) c.width = c.height = 0;
    this.frames.idle = [];
    this.frames.move = [];
  }
  private frame(img: SheetPicture, anim: "idle" | "move", i: number): HTMLCanvasElement {
    const s = RIDE_PX;
    const { sheet, pawn, scale: k } = this;
    const c = document.createElement("canvas");
    c.width = Math.ceil(this.w * s);
    c.height = Math.ceil(this.h * s);
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    // The ride's cell at its scale (its pixels drawn k times their size).
    const cx = (this.cell[0] - this.x0) * s;
    const cy = (this.cell[1] - this.y0) * s;
    const dw = sheet.w * k;
    const dh = sheet.h * k;
    // The sheet's rows: idle back, idle front, move back, move front; a frame a column.
    const row = anim === "idle" ? 0 : 2;
    g.drawImage(img, i * sheet.w, row * sheet.h, sheet.w, sheet.h, cx, cy, dw, dh);
    const [px, py, tilt, seatCut] = this.seats[anim][i]! as [number, number, number, number];
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
    g.drawImage(img, i * sheet.w, (row + 1) * sheet.h, sheet.w, sheet.h, cx, cy, dw, dh);
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

/** The riders in the town, by ride, color, scale and pawn (`pawnKey`: the pawn's look), shared by everyone who looks the same. */
const riders = new Map<string, Rider>();

/**
 * A rider for one more person on `sheet` in `color` with this pawn (`pawnKey` names its look: the same key, the same
 * picture): the one already made for that look, or a new one; `done` once its frames are ready. Give it back with
 * `leaveRider` when the person's look changes.
 */
export function shareRider(sheet: RideSheet, color: string, pawnKey: string, pawn: RiderPawn, done: (r: Rider) => void): Rider {
  // (Its size as it's made: RIDES.scale, or an admin's `?rideScale=` once it counts.)
  const scale = rideScale(sheet.id);
  const key = `${sheet.id}|${color}|${scale}|${pawnKey}`;
  let r = riders.get(key);
  if (!r) riders.set(key, (r = new Rider(sheet, color, pawn, true, scale)));
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

/** The town closes: every rider's frames freed, every sheet let go. */
export function dropRiders(): void {
  for (const r of riders.values()) r.drop();
  riders.clear();
  for (const use of sheets.values()) closeSheet(use);
  sheets.clear();
}

/** (Tests) How many sets of rider frames and sheets are held now. */
export const ridersHeld = () => ({ riders: riders.size, sheets: sheets.size });

/** A ride's sheet by its item id (undefined: not a ride, or none baked). */
export const rideSheet = (def: string | undefined): RideSheet | undefined => (def ? (RIDE_SHEETS as Record<string, RideSheet>)[def] : undefined);
