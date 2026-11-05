/**
 * The street town's minimap (Nov 5, brief-street-controls-map.md; Eric: "on by default … an overlay on the top right, partially
 * see-through, not super big … shows where your guy is … the Colosseum basically outside the map, on the edge … a thin line … so players
 * can see when they run to the top that they're at the top"; "It should be an actual representation of the overhead … no labels").
 *
 * The plan from above, north up, built from the plan's own data (street.ts: `street-plan.json`'s ground, lots, park and Colosseum), so
 * it follows any change to the plan: the streets, the paving, the park's lawns, the gardens, the rows' lots, the homes as soft blocks,
 * the walls as lines, and the Colosseum as a band on the top edge over its columns. Its body runs from the south edge to the last row with
 * anything on it but the grove and the Colosseum; the walls past it (the back wall) are drawn on its top edge.
 *
 * The cost (Eric's frame-rate rule): the static layer is drawn once to a canvas (`drawMap`) when the map's size changes; each frame only
 * your dot moves (`MapDot.place`: a CSS transform, set only when it moves by a quarter pixel or turns by half a degree). Nothing is
 * allocated on a frame. On or off is remembered per device (`mapOn`, on by default).
 */
import { N } from "./camera.ts";
import { STREET_COLISEUM, STREET_GROUND, STREET_GROUND_KEY, STREET_HOMES, STREET_LOTS, STREET_PARK } from "./street.ts";

/** A box in the town's box's pixels (the chips and the test hooks' tap points keep off it). */
export interface MapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** The small map's box, in the town's box (zero while it's off or hidden). render.ts keeps the chips and `pick` off it. */
export const MAP_BOX: MapRect = { x: 0, y: 0, w: 0, h: 0 };

const K = STREET_GROUND_KEY;
/** The map's body: rows 0 .. `top` - 1 (the last row with anything on it but the grove and the Colosseum, and one more). */
export const MAP_TOP: number = (() => {
  let top = 0;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const g = STREET_GROUND[r * N + c];
      if (g !== K.g && g !== K.A) top = r + 1;
    }
  return top;
})();
/** The Colosseum's band on the top edge: its columns, and its height in squares. */
export const MAP_BAND = { c0: STREET_COLISEUM.c0, w: STREET_COLISEUM.size, sq: 1.4 } as const;

/** The map's size in squares: the town's width, and its body's rows with the band over them. */
export const MAP_W = N;
export const MAP_H = MAP_TOP + MAP_BAND.sq;

/** The scale (px a square) a map `width` px wide draws at. */
export const mapScale = (width: number): number => width / MAP_W;
/** A map `width` px wide is this high (px). */
export const mapHeight = (width: number): number => Math.round(mapScale(width) * MAP_H);

/**
 * Where a position (x, y) in squares (a square's middle at whole numbers, y north) is on a map drawn at scale `s` (px a square): x across
 * from its left, y down from its top. East-west wraps, so x is brought into the town; north-south doesn't: past the body's top, it's held
 * on the top edge. Writes into `out`.
 */
export function mapPoint(x: number, y: number, s: number, out: { x: number; y: number }): void {
  const xx = ((((x + 0.5) % N) + N) % N) * s;
  const yy = (MAP_BAND.sq + MAP_TOP - 0.5 - y) * s;
  out.x = xx;
  out.y = Math.max(MAP_BAND.sq * s, Math.min(MAP_H * s, yy));
}

/** The map's colors: the plan's grounds, the homes' blocks, the walls and the Colosseum's band. */
export const MAP_COLORS = {
  ground: { [K["#"]]: "#5c6370", [K["="]]: "#cfc8ba", [K[","]]: "#8fc46c", [K.g]: "#6b9f52", [K.L]: "#d9c7a6", [K.A]: "#c9b48a" } as Record<number, string>,
  home: "#e59a52",
  homeEdge: "#8a4f1c",
  wall: "#4a3f36",
  band: "#b8935a",
  bandEdge: "#6f5530",
} as const;

/**
 * Draws the map onto `g` at scale `s` (px a square; `g` already scaled for the device's pixels): the ground square by square, the homes
 * as soft blocks, the walls as lines, the Colosseum's band. Once a size (never per frame).
 */
export function drawMap(g: CanvasRenderingContext2D, s: number): void {
  const top = MAP_BAND.sq * s;
  g.clearRect(0, 0, MAP_W * s, MAP_H * s + 1);
  // The ground: runs of one ground along a row, one rectangle each (a little over, so no seams show between them).
  for (let r = 0; r < MAP_TOP; r++) {
    const y = top + (MAP_TOP - 1 - r) * s;
    let c = 0;
    while (c < N) {
      const k = STREET_GROUND[r * N + c]!;
      let e = c + 1;
      while (e < N && STREET_GROUND[r * N + e] === k) e++;
      g.fillStyle = MAP_COLORS.ground[k] ?? MAP_COLORS.ground[K.g]!;
      g.fillRect(c * s, y, (e - c) * s + 0.5, s + 0.5);
      c = e;
    }
  }
  // The homes: soft blocks over their lots.
  const rad = Math.max(1, s * 0.6);
  g.lineWidth = Math.max(0.75, s * 0.25);
  for (const l of STREET_HOMES) {
    const across = l.facing === "S" || l.facing === "N";
    const w = (across ? l.w : l.d) * s;
    const h = (across ? l.d : l.w) * s;
    const x = l.c0 * s;
    const y = top + (MAP_TOP - l.r0) * s - h;
    const inset = Math.max(0.5, s * 0.2);
    roundRect(g, x + inset, y + inset, w - 2 * inset, h - 2 * inset, rad);
    g.fillStyle = MAP_COLORS.home;
    g.fill();
    g.strokeStyle = MAP_COLORS.homeEdge;
    g.stroke();
  }
  // The walls: a line along each one's front line (held on the top edge past the body's top: the back wall).
  g.strokeStyle = MAP_COLORS.wall;
  g.lineWidth = Math.max(1, s * 0.5);
  g.lineCap = "butt";
  const p = { x: 0, y: 0 };
  for (const l of STREET_LOTS) {
    if (l.kind !== "wall") continue;
    mapPoint(l.c0 - 0.5, l.r0 - 0.5 + l.inset, s, p);
    const y = Math.max(top + g.lineWidth / 2, p.y);
    g.beginPath();
    g.moveTo(l.c0 * s, y);
    g.lineTo((l.c0 + l.w) * s, y);
    g.stroke();
  }
  // The Colosseum: a band on the top edge, over its columns.
  g.fillStyle = MAP_COLORS.band;
  g.fillRect(MAP_BAND.c0 * s, 0, MAP_BAND.w * s, top);
  g.strokeStyle = MAP_COLORS.bandEdge;
  g.lineWidth = Math.max(0.75, s * 0.25);
  g.strokeRect(MAP_BAND.c0 * s + g.lineWidth / 2, g.lineWidth / 2, MAP_BAND.w * s - g.lineWidth, top - g.lineWidth / 2);
}

/** Where the park's middle and the Colosseum's band's middle are on a map at scale `s` (the large map's icons). */
export function parkPoint(s: number, out: { x: number; y: number }): void {
  const P = STREET_PARK;
  mapPoint(P.c0 + (P.w - 1) / 2, P.r1 - (P.d - 1) / 2, s, out);
}
export function colosseumPoint(s: number, out: { x: number; y: number }): void {
  out.x = (MAP_BAND.c0 + MAP_BAND.w / 2) * s;
  out.y = (MAP_BAND.sq * s) / 2;
}

/**
 * You on a map: a dot (an element) with a small arrow the way the camera faces (degrees from north, clockwise: north is up the map),
 * moved by a transform only when it moves a quarter pixel or turns half a degree.
 */
export class MapDot {
  private x = NaN;
  private y = NaN;
  private h = NaN;
  private readonly p = { x: 0, y: 0 };
  constructor(
    readonly el: HTMLElement,
    public s: number,
  ) {}
  /** You at (x, y) in squares, the camera facing `heading`. */
  place(x: number, y: number, heading: number): void {
    mapPoint(x, y, this.s, this.p);
    const h = ((heading % 360) + 360) % 360;
    if (Math.abs(this.p.x - this.x) < 0.25 && Math.abs(this.p.y - this.y) < 0.25 && Math.abs(h - this.h) < 0.5) return;
    this.x = this.p.x;
    this.y = this.p.y;
    this.h = h;
    this.el.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0) rotate(${h.toFixed(0)}deg)`;
  }
  /** Placed again on the next `place` (a new scale). */
  forget(): void {
    this.x = this.y = this.h = NaN;
  }
}

/** The dots showing now (the small map's, and the large one's while it's open): the town's frame places them all. */
export const MAP_DOTS = new Set<MapDot>();
/** The town's frame: you at (x, y), the camera facing `heading`. */
export function mapFrame(x: number, y: number, heading: number): void {
  for (const d of MAP_DOTS) d.place(x, y, heading);
}

// ---- On or off: per device (localStorage), on by default; the map button turns it.
export const MAP_KEY = "brc.townMap";
let on: boolean | null = null;
const seen = new Set<() => void>();
/** Whether the map shows: the choice remembered on this device (the first time it's asked), else on. */
export function mapOn(): boolean {
  return (on ??= loadMapOn());
}
/** Sets it, remembers it on this device and tells everyone showing it. */
export function setMapOn(v: boolean): void {
  if (v === on) return;
  on = v;
  try {
    localStorage.setItem(MAP_KEY, v ? "1" : "0");
  } catch {
    // (A storage that won't answer: the choice lasts this page.)
  }
  for (const f of seen) f();
}
export function onMapOn(f: () => void): () => void {
  seen.add(f);
  return () => void seen.delete(f);
}
/** The choice remembered on this device: off only when "0" is stored (nothing stored, or a storage that won't answer: on). */
export function loadMapOn(): boolean {
  try {
    return localStorage.getItem(MAP_KEY) !== "0";
  } catch {
    return true;
  }
}
/** (Tests) Forget the choice read, so the next `mapOn` reads the device again. */
export function resetMapOn(): void {
  on = null;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
