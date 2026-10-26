/**
 * The town square's drawing, on one 2D canvas: the sky and its clouds, the curved ground cut at the rim, the haze at
 * the far edge, then the homes, bosses and people (you and the bots: `town.people`, the only list of them it reads), far
 * to near, with name tags, the homes' names and the one speech bubble. Ported
 * from the prototype Eric tested (docs/mockups/town-square/prototype.html), with its look kept: things in the far band
 * fade, haze and blur (a shrink and a stretch back, which needs no ctx.filter); sprites are drawn only once their square
 * is inside the rim, always whole, fading in; the haze strip is drawn behind them.
 *
 * Everything that can be made ahead is cached (square colors, fonts, the clouds, each boss's and home's frames, drawn
 * once with renderFrame the first time they show, the pawns), so a frame allocates nothing on its hot path.
 */
import { renderFrame, type Character } from "../characters/sprite.ts";
import { GINGERBREAD } from "../characters/gingerbread.ts";
import { GREX } from "../characters/grex.ts";
import { HOLLOW } from "../characters/hollow.ts";
import { MOO } from "../characters/moo.ts";
import { TIGER_FIGURE } from "../characters/tiger-figure.ts";
import { N, bandOf, clamp, drawable, enterOf, farOf, forEachSquare, hazeMix, newPt, newView, pastCurve, pickSquare, proj, radial, rimYAt, setView, wrapF, type Quad, type View } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";
import { HOUSES } from "./houses/index.ts";
import { plotAt, type Boss, type Home, type HomeId, type Person, type Pose, type Town } from "./world.ts";

/** Each boss's sprite (its real one: its `idle` frames). */
export const BOSS_ART: Record<HomeId, Character> = { tiger: TIGER_FIGURE, gingerbread: GINGERBREAD, grex: GREX, hollow: HOLLOW, moo: MOO };

// ---- Colors (the prototype's, sampled from Eric's reference picture).
const SQ_LIGHT = [238, 197, 139] as const;
const SQ_DARK = [173, 128, 88] as const;
/** The sky's color at the horizon (the bottom of the sky's gradient). */
const SKYH = [214, 230, 246] as const;
const SKYH_CSS = "#d6e6f6";
const MIX_STEPS = 64;
const INK = "#1f2530";
const SIGN_INK = "#2a2118";
const FONT = "Archivo, system-ui, sans-serif";
const FONT_BLACK = '"Archivo Black", Archivo, system-ui, sans-serif';

const mix = (a: readonly number[], b: readonly number[], t: number) => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
const rgb = (v: readonly number[]) => `rgb(${v[0]! | 0},${v[1]! | 0},${v[2]! | 0})`;

/** A square's fill and seam, by (light or dark, on a plot or not, how far toward the sky): made once each. */
const SQ_FILL: string[] = [];
const SQ_SEAM: string[] = [];
for (let i = 0; i <= MIX_STEPS; i++)
  for (let alt = 0; alt < 2; alt++)
    for (let plot = 0; plot < 2; plot++) {
      let base: readonly number[] = alt ? SQ_DARK : SQ_LIGHT;
      if (plot) base = base.map((x) => x * 0.9); // a faint darker tint under a home
      const t = i / MIX_STEPS;
      const f = mix(base, SKYH, t);
      SQ_FILL[i * 4 + alt * 2 + plot] = rgb(f);
      SQ_SEAM[i * 4 + alt * 2 + plot] = rgb(f.map((x) => x * (0.86 + 0.14 * t))); // the seam fades out too
    }
/** The haze strip's lines under the horizon, made once. */
const HAZE_LINES = 10;
const HAZE_STROKE = Array.from({ length: HAZE_LINES }, (_, i) => `rgba(${SKYH[0]},${SKYH[1]},${SKYH[2]},${(0.75 * Math.pow(1 - i / HAZE_LINES, 1.7)).toFixed(3)})`);
/** Fonts by whole pixel size (tags, signs). */
const TAG_FONT = Array.from({ length: 16 }, (_, s) => `600 ${s}px ${FONT}`);
/** The homes' floating names (the game's display font) and their signs' (the game's pixel font), by whole pixel size. */
const NAME_FONT = Array.from({ length: 41 }, (_, s) => `400 ${s}px ${FONT_BLACK}`);
const PIXEL_FONT = Array.from({ length: 41 }, (_, s) => `400 ${s}px "Press Start 2P", ui-monospace, monospace`);
const BUBBLE_FONT = `500 12px ${FONT}`;

// ---- The pawn (cburnett's, as on the boards: src/board/pieces/SOURCES.md), drawn once per look at a good size.
const PAWN_PATH =
  "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z";
const PAWN_PX = 160;
/** The pawn's head is this far down its box (its top at y 9 of the piece's 45): name tags sit on it. */
const PAWN_HEAD = 9 / 45;
const pawnCache = new Map<string, HTMLCanvasElement>();
function pawnImage(side: "light" | "dark", tint: string | null): HTMLCanvasElement {
  const key = side + (tint ?? "");
  let c = pawnCache.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = PAWN_PX;
  const g = c.getContext("2d")!;
  g.scale(PAWN_PX / 45, PAWN_PX / 45);
  const p = new Path2D(PAWN_PATH);
  g.fillStyle = tint ?? (side === "light" ? "#ffffff" : "#000000");
  g.fill(p);
  g.lineWidth = 1.5;
  g.lineCap = "round";
  g.strokeStyle = "#000000";
  g.stroke(p);
  pawnCache.set(key, c);
  return c;
}

/** A character's frames as canvases, drawn the first time each shows (a frame at a time, never all at once). */
class FrameCache {
  readonly frames: (HTMLCanvasElement | null)[];
  /** When each frame ends, from the loop's start; and the loop's length. */
  readonly ends: number[];
  readonly loop: number;
  constructor(readonly ch: Character) {
    const idle = ch.anims.idle!;
    this.frames = idle.frames.map(() => null);
    let t = 0;
    this.ends = idle.frames.map((f) => (t += Math.max(16, f.ms)));
    this.loop = t;
  }
  /** The frame showing at `now` (each copy offset by `phase` ms, so two never move together). */
  at(now: number, phase: number): HTMLCanvasElement {
    const t = (now + phase) % this.loop;
    let i = 0;
    while (i < this.ends.length - 1 && t >= this.ends[i]!) i++;
    return this.get(i);
  }
  get(i: number): HTMLCanvasElement {
    let c = this.frames[i];
    if (c) return c;
    const { w, h, data } = renderFrame(this.ch, this.ch.anims.idle!.frames[i]!);
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
    this.frames[i] = c;
    return c;
  }
}

/** One thing standing on the ground this frame: where it was drawn (for taps, tags and chips) and how to sort it. */
interface Item {
  kind: "house" | "boss" | "person";
  i: number;
  dx: number;
  dz: number;
  /** Drawn this frame (inside the rim, on screen). */
  on: boolean;
  depth: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Its foot and the top of its head, on screen. */
  fx: number;
  fy: number;
  hy: number;
}
const newItem = (kind: Item["kind"], i: number): Item => ({ kind, i, dx: 0, dz: 0, on: false, depth: 0, x0: 0, y0: 0, x1: 0, y1: 0, fx: 0, fy: 0, hy: 0 });

/** An edge chip this frame: which home, where on the box's edge, which way its arrow points (degrees). */
export interface Chip {
  home: Home | null;
  x: number;
  y: number;
  angle: number;
}

/** What a tap landed on. */
export type Hit = { kind: "square"; c: number; r: number } | { kind: "house"; home: Home } | { kind: "boss"; boss: Boss } | { kind: "person"; person: Person };

// Can the canvas blur (not in older iOS Safari; there the shrink alone does the work)?
const BLUR_OK = (() => {
  try {
    const c = document.createElement("canvas").getContext("2d")!;
    c.filter = "blur(2px)";
    return c.filter === "blur(2px)";
  } catch {
    return false;
  }
})();

export class Renderer {
  readonly view: View = newView();
  W = 1;
  H = 1;
  DPR = 1;
  camX = 0;
  camY = 0;
  readonly chips: Chip[] = [0, 1, 2, 3].map(() => ({ home: null, x: 0, y: 0, angle: 0 }));
  private items: Item[];
  /** The homes' items, by home (the items themselves are sorted every frame). */
  private readonly houseItems: Item[];
  private readonly bossFrames: FrameCache[];
  private readonly houseFrames: FrameCache[];
  private readonly pose: Pose = { x: 0, y: 0, hop: 0, tilt: 0 };
  private readonly p = newPt();
  private readonly soft = document.createElement("canvas");
  private readonly sg = this.soft.getContext("2d")!;
  private readonly bandCv = document.createElement("canvas");
  private readonly bg = this.bandCv.getContext("2d")!;
  private clouds: HTMLCanvasElement | null = null;
  private cloudW = 0;
  private cloudH = 0;
  private sky: CanvasGradient | null = null;
  private skyHy = NaN;
  private bandGrad: CanvasGradient | null = null;
  private bandKey = "";
  private readonly ripples = [0, 1, 2].map(() => ({ x: 0, y: 0, t0: -1e9 }));
  private rippleNext = 0;
  /** Tag widths by name and size; sign and bubble layouts by text. */
  private readonly tagW = new Map<string, number[]>();
  private readonly signLayout = new Map<string, { one: number; l1: string; l2: string; two: number }>();
  /** Where each home's name floats this frame (drawn over everything, after the homes): x, the building's top, its fade. */
  private readonly names: { x: number; y: number; a: number; k: number }[];
  private readonly tops: number[] = [];
  private readonly bubbles = new Map<string, { lines: string[]; w: number }>();
  private readonly drawSquare: (c: number, r: number, cu: number, ru: number, q: Quad) => void;
  private seamHalf = 0.5;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly town: Town,
    private readonly homes: readonly Home[],
  ) {
    this.houseItems = homes.map((_, i) => newItem("house", i));
    this.names = homes.map(() => ({ x: 0, y: 0, a: 0, k: 0 }));
    this.items = [...this.houseItems, ...town.bosses.map((_, i) => newItem("boss", i))];
    this.bossFrames = town.bosses.map((b) => new FrameCache(BOSS_ART[b.home.id]));
    this.houseFrames = homes.map((h) => new FrameCache(HOUSES[h.id].ch));
    this.drawSquare = (c, r, cu, ru, q) => {
      const g = this.ctx;
      const m = Math.round(clamp(hazeMix(this.view, cu - this.camX, ru - this.camY), 0, 1) * MIX_STEPS);
      const key = m * 4 + ((c + r) & 1) * 2 + (plotAt[r * N + c] ? 1 : 0);
      // The square in its seam's color, then its face inset by half a seam: the seams without a stroke (strokes cost
      // several times a fill on a phone's software path).
      g.beginPath();
      g.moveTo(q[0]!, q[1]!);
      g.lineTo(q[2]!, q[3]!);
      g.lineTo(q[4]!, q[5]!);
      g.lineTo(q[6]!, q[7]!);
      g.closePath();
      g.fillStyle = SQ_SEAM[key]!;
      g.fill();
      const cx = (q[0]! + q[2]! + q[4]! + q[6]!) / 4;
      const cy = (q[1]! + q[3]! + q[5]! + q[7]!) / 4;
      const s = this.seamHalf;
      g.beginPath();
      for (let i = 0; i < 8; i += 2) {
        const dx = cx - q[i]!;
        const dy = cy - q[i + 1]!;
        const t = Math.min(0.45, s / (Math.hypot(dx, dy) || 1));
        if (i) g.lineTo(q[i]! + dx * t, q[i + 1]! + dy * t);
        else g.moveTo(q[i]! + dx * t, q[i + 1]! + dy * t);
      }
      g.closePath();
      g.fillStyle = SQ_FILL[key]!;
      g.fill();
    };
  }

  /** The canvas's box changed (CSS pixels) or the device's pixel ratio did. */
  resize(W: number, H: number, DPR: number): void {
    this.W = W;
    this.H = H;
    this.DPR = DPR;
    this.clouds = null;
  }

  /** Draws one frame. `zoom`: 0 normal, 1 zoomed out (and between, while it glides). */
  draw(now: number, camX: number, camY: number, zoom: number): void {
    const { ctx, W, H, DPR } = this;
    this.camX = camX;
    this.camY = camY;
    setView(this.view, W, H, zoom);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    this.drawSky();
    this.drawGround();
    this.drawHorizonHaze(); // on the ground, behind every home, boss and pawn
    this.drawThings(now);
    this.drawRipples(now);
    this.placeChips(now);
  }

  // ---- The sky: a gradient, and a strip of clouds along the horizon that drifts as you walk (parallax).

  private drawSky(): void {
    const { ctx, W, H, view: v } = this;
    if (!this.sky || Math.abs(this.skyHy - v.hy) > 0.5) {
      const g = ctx.createLinearGradient(0, 0, 0, Math.max(10, v.hy));
      g.addColorStop(0, "#68b2f6");
      g.addColorStop(0.65, "#9fd0fb");
      g.addColorStop(1, SKYH_CSS);
      this.sky = g;
      this.skyHy = v.hy;
    }
    ctx.fillStyle = this.sky;
    ctx.fillRect(0, 0, W, H);
    if (!this.clouds) this.buildClouds();
    const w = this.cloudW;
    const h = this.cloudH;
    const off = (((-this.camX * v.kf * TOWN_FEEL.cloudParallax - this.camY * TOWN_FEEL.cloudParallaxAhead) % w) + w) % w;
    const y = v.hy - h + h * 0.18; // the bank sits on the horizon, partly behind it
    for (let x = off - w; x < W; x += w) ctx.drawImage(this.clouds!, x, y, w, h);
  }

  private buildClouds(): void {
    const { W, H, DPR } = this;
    const cw = Math.max(900, Math.round(W * 1.7));
    const ch = Math.round(clamp(Math.max(W * 0.15, H * 0.13), 80, 170));
    const c = document.createElement("canvas");
    c.width = Math.round(cw * DPR);
    c.height = Math.round(ch * DPR);
    const g = c.getContext("2d")!;
    g.scale(DPR, DPR);
    let s = 77;
    const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296);
    const unit = ch / 2.8;
    // A bank of puffs on the strip's bottom, taller in places, with lone clouds higher up.
    const puffs: { x: number; y: number; rad: number }[] = [];
    for (let x = -unit; x < cw + unit; x += unit * (0.6 + r() * 0.6)) {
      const tall = 0.5 + 0.9 * Math.pow(r(), 1.6);
      puffs.push({ x, y: ch - unit * 0.35, rad: unit * (0.55 + 0.35 * r()) * tall });
      if (r() < 0.55) puffs.push({ x: x + unit * 0.3, y: ch - unit * (0.6 + 0.8 * tall), rad: unit * (0.35 + 0.3 * r()) * tall });
    }
    for (let i = 0; i < 6; i++) {
      const x = r() * cw;
      const y = ch * (0.18 + 0.3 * r());
      const w = unit * (0.9 + r());
      for (let j = 0; j < 4; j++) puffs.push({ x: x + (j - 1.5) * w * 0.35, y: y + (j % 2 ? -w * 0.12 : 0), rad: w * (0.22 + 0.12 * (j % 2)) });
    }
    // The strip wraps, so it tiles seamlessly.
    const all = puffs.flatMap((p) => [p, { ...p, x: p.x - cw }, { ...p, x: p.x + cw }]);
    // A soft blue-grey underside first, then the white tops, both a little soft.
    if (BLUR_OK) g.filter = `blur(${(unit * 0.08).toFixed(1)}px)`;
    g.fillStyle = "rgba(160,188,222,.6)";
    for (const p of all) (g.beginPath(), g.arc(p.x + p.rad * 0.05, p.y + p.rad * 0.16, p.rad, 0, Math.PI * 2), g.fill());
    if (BLUR_OK) g.filter = `blur(${(unit * 0.025).toFixed(1)}px)`;
    g.fillStyle = "#ffffff";
    for (const p of all) (g.beginPath(), g.arc(p.x - p.rad * 0.04, p.y - p.rad * 0.04, p.rad * 0.9, 0, Math.PI * 2), g.fill());
    if (BLUR_OK) g.filter = "none";
    this.clouds = c;
    this.cloudW = cw;
    this.cloudH = ch;
  }

  // ---- The ground: rows of squares, far to near, clipped to the rim; its far band softened.

  private clipToGround(): void {
    const { ctx, H, view: v } = this;
    ctx.beginPath();
    ctx.moveTo(v.rimPx[0]!, H + 60);
    for (let i = 0; i < v.rimN; i++) ctx.lineTo(v.rimPx[i]!, v.rimPy[i]!);
    ctx.lineTo(v.rimPx[v.rimN - 1]!, H + 60);
    ctx.closePath();
    ctx.clip();
  }

  private drawGround(): void {
    const { ctx, W, H, view: v } = this;
    if (v.rimN < 2) return;
    ctx.save();
    this.clipToGround();
    // A sky-colored skirt under the rim, so any gap at the edge reads as haze.
    ctx.fillStyle = SKY_SKIRT;
    ctx.fillRect(0, 0, W, H);
    // Half a seam's width, measured along a square's diagonal (the prototype's stroke: kf x 0.022, 0.5 to 1.4 px).
    this.seamHalf = 0.5 * Math.SQRT2 * clamp(v.kf * 0.022, 0.5, 1.4);
    forEachSquare(v, this.camX, this.camY, false, this.drawSquare);
    this.softenBand();
    ctx.restore();
  }

  /**
   * The far band of ground, softened: a copy of that strip of the canvas at a third of the size (blurred a little more
   * where the filter exists), laid back over it, fully at the horizon and fading out to where the band starts.
   */
  private softenBand(): void {
    const { ctx, W, H, DPR, view: v, p } = this;
    let top = Infinity;
    for (let i = 0; i < v.rimN; i++) if (v.rimPx[i]! >= -20 && v.rimPx[i]! <= W + 20) top = Math.min(top, v.rimPy[i]!);
    const b0 = TOWN_FEEL.bandStart;
    let botC = v.hy;
    if (proj(v, 0, v.rim * b0, 0, p)) botC = p.y;
    let botE = -Infinity;
    for (let i = 0; i <= 32; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 32;
      if (proj(v, v.rim * b0 * v.rimX * Math.sin(a), v.rim * b0 * Math.cos(a), 0, p) && p.x >= 0 && p.x <= W) botE = Math.max(botE, p.y);
    }
    const bot = Math.min(botC + (Math.max(botC, botE) - botC) * 0.5, top + H * 0.3);
    const y0 = Math.max(0, Math.floor(top - 6));
    const y1 = Math.min(H, Math.ceil(bot));
    if (!isFinite(top) || y1 - y0 < 6) return;
    const bw = Math.max(1, Math.ceil(W / 3));
    const bh = Math.max(1, Math.ceil((y1 - y0) / 3));
    const g = this.bg;
    if (this.bandCv.width !== bw || this.bandCv.height !== bh) {
      this.bandCv.width = bw;
      this.bandCv.height = bh;
      this.bandKey = "";
    } else g.clearRect(0, 0, bw, bh);
    g.globalCompositeOperation = "source-over";
    if (BLUR_OK) g.filter = "blur(0.7px)";
    g.drawImage(ctx.canvas, 0, Math.round(y0 * DPR), ctx.canvas.width, Math.round((y1 - y0) * DPR), 0, 0, bw, bh);
    if (BLUR_OK) g.filter = "none";
    g.globalCompositeOperation = "destination-in";
    const stop = clamp((v.hy + 2 - y0) / (y1 - y0), 0, 1);
    // (The fade's gradient changes only with the view: made again only then.)
    if (this.bandGrad === null || this.bandKey !== `${bh}:${stop.toFixed(3)}`) {
      const gr = g.createLinearGradient(0, 0, 0, bh);
      gr.addColorStop(0, "rgba(0,0,0,1)");
      gr.addColorStop(stop, "rgba(0,0,0,1)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      this.bandGrad = gr;
      this.bandKey = `${bh}:${stop.toFixed(3)}`;
    }
    g.fillStyle = this.bandGrad;
    g.fillRect(0, 0, bw, bh);
    g.globalCompositeOperation = "source-over";
    ctx.drawImage(this.bandCv, 0, y0, W, y1 - y0);
  }

  /** A soft haze strip just under the horizon, fading out downward. Drawn before the homes, bosses and pawns. */
  private drawHorizonHaze(): void {
    const { ctx, H, view: v } = this;
    if (v.rimN < 2) return;
    const d = H * TOWN_FEEL.horizonHaze;
    ctx.save();
    this.clipToGround();
    ctx.lineJoin = "round";
    ctx.lineWidth = d / HAZE_LINES + 0.6;
    for (let i = 0; i < HAZE_LINES; i++) {
      const off = ((i + 0.5) * d) / HAZE_LINES;
      ctx.strokeStyle = HAZE_STROKE[i]!;
      ctx.beginPath();
      ctx.moveTo(v.rimPx[0]!, v.rimPy[0]! + off);
      for (let j = 1; j < v.rimN; j++) ctx.lineTo(v.rimPx[j]!, v.rimPy[j]! + off);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- The homes, bosses and pawns, far to near.

  private drawThings(now: number): void {
    const { town, view: v, homes, pose } = this;
    const f = TOWN_FEEL;
    // One item per person in the square (the list can change: people come and go).
    const people = town.people;
    let np = 0;
    for (const it of this.items) if (it.kind === "person") np++;
    if (np !== people.length) {
      this.items = this.items.filter((it) => it.kind !== "person");
      for (let i = 0; i < people.length; i++) this.items.push(newItem("person", i));
    }
    const items = this.items;
    // Where each one stands relative to the camera, and whether it's drawn at all.
    for (const it of items) {
      let x: number;
      let y: number;
      let margin = 1;
      if (it.kind === "house") {
        const h = homes[it.i]!;
        x = h.cx;
        y = h.cy - 0.5; // the picture's foot stands half a square in front of the plot's middle
        margin = 2.5;
      } else {
        const w = it.kind === "boss" ? town.bosses[it.i]!.walker : people[it.i]!.walker;
        w.pose(now, pose);
        x = pose.x;
        y = pose.y;
        if (it.kind === "boss") margin = 2;
      }
      it.dx = wrapF(x - this.camX);
      it.dz = wrapF(y - this.camY);
      it.on = drawable(v, it.dx, it.dz, margin);
    }
    items.sort(byFarFirst);
    for (const b of town.bosses) b.onScreen = false;
    for (const nm of this.names) nm.a = 0;
    for (const it of items) {
      if (!it.on) continue;
      if (it.kind === "house") this.drawHouse(it, now);
      else if (it.kind === "boss") {
        const b = town.bosses[it.i]!;
        const ch = BOSS_ART[b.home.id];
        const img = this.bossFrames[it.i]!.at(now, it.i * 977);
        b.walker.pose(now, pose);
        this.drawSprite(it, img, f.bossSquares, ch.foot[0] / ch.w, ch.foot[1] / ch.h, ch.w / ch.h, 0, 0, b.walker.facing, 1.6);
        b.onScreen = it.fx > -40 && it.fx < this.W + 40 && it.fy > 0 && it.hy < this.H && bandOf(v, it.dx, it.dz) < 0.6; // (a boss deep in the haze doesn't talk)
        if (town.speech.boss === b) this.drawBubble(town.speech.line, it.fx, it.hy);
      } else {
        const person = people[it.i]!;
        const w = person.walker;
        w.pose(now, pose);
        if (person.you) {
          this.drawRing(it);
          this.drawSprite(it, pawnImage(person.look.side, person.look.tint), f.youSquares, 0.5, 0.96, 1, pose.hop * f.youHop, pose.tilt * f.hobbleTilt, w.facing, 0.6, PAWN_HEAD);
          this.drawTag(person.name, it.fx, it.hy - 2, true, clamp((11 * this.p.k) / v.kf, 8, 12), 1);
        } else {
          this.drawSprite(it, pawnImage(person.look.side, person.look.tint), f.botSquares, 0.5, 0.96, 1, pose.hop * f.botHop, pose.tilt * f.hobbleTilt, w.facing, 1, PAWN_HEAD);
          // Name tags on the near ones only.
          const far = farOf(v, it.dz);
          if (far < f.tagFar) this.drawTag(person.name, it.fx, it.hy - 2, false, clamp((11 * this.p.k) / v.kf, 8, 12), clamp((f.tagFar - far) / 0.12, 0, 1));
        }
      }
    }
    if (f.floatingNames) this.drawNames(now);
  }

  /**
   * The homes' names, landmark style: white with a dark outline, a little above each building, over everything else.
   * Each fades in (rising a little) as you come within a few squares of its plot and fades out as you leave.
   */
  private drawNames(now: number): void {
    const { ctx, homes, pose, view: v } = this;
    const f = TOWN_FEEL;
    const me = this.town.you.walker.pose(now, pose);
    for (let i = 0; i < homes.length; i++) {
      const h = homes[i]!;
      const it = this.houseItems[i]!;
      const nm = this.names[i]!;
      if (!it.on || nm.a <= 0.01) continue;
      // How far you are from the plot's edge (it's 3 squares across), in squares.
      const d = Math.max(0, Math.abs(wrapF(me.x - h.cx)) - 1.5, Math.abs(wrapF(me.y - h.cy)) - 1.5);
      const a = nm.a * clamp((f.nameShowFrom - d) / (f.nameShowFrom - f.nameFullAt), 0, 1);
      if (a <= 0.01) continue;
      const size = Math.round(clamp((15 * nm.k) / v.kf, 12, 20));
      const y = nm.y - 6 + (1 - a) * f.nameRise;
      ctx.globalAlpha = a;
      ctx.font = NAME_FONT[size]!;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = INK;
      ctx.strokeText(h.name, nm.x, y);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(h.name, nm.x, y);
    }
    ctx.globalAlpha = 1;
  }

  /** Your gold ring on the ground, under your pawn. */
  private drawRing(it: Item): void {
    const { ctx, view: v, p } = this;
    if (!proj(v, it.dx, it.dz, 0, p)) return;
    ctx.save();
    ctx.globalAlpha = enterOf(v, it.dx, it.dz);
    ctx.fillStyle = "rgba(255,215,106,.45)";
    ctx.strokeStyle = "#c9962a";
    ctx.lineWidth = Math.max(1.5, p.k * 0.06);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.k * 0.42, p.k * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * A sprite standing on the ground: its foot at (fx, fy) of its box, `sq` squares tall; lifted `lift` squares (the
   * hop), tilted `tilt` degrees, flipped to face its walk; a soft shadow under it. Fills the item's box; its head is
   * `head` of the way down the box.
   */
  private drawSprite(it: Item, img: CanvasImageSource, sq: number, fx: number, fy: number, aspect: number, lift: number, tilt: number, flip: number, shadow: number, head = 0): void {
    const { ctx, view: v, p } = this;
    if (!proj(v, it.dx, it.dz, 0, p)) return;
    const h = sq * p.k;
    const w = h * aspect;
    const x0 = p.x - fx * w;
    const y0 = p.y - fy * h - lift * p.k;
    const s = bandOf(v, it.dx, it.dz); // in the far band: fade, haze and blur
    const alpha = (1 - TOWN_FEEL.bandFade * s) * enterOf(v, it.dx, it.dz);
    ctx.save();
    ctx.globalAlpha = alpha * 0.22 * (1 - s); // the shadow, gone by the rim (no shadows on the sky)
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.min(w * 0.42, p.k * 0.42 * shadow), p.k * 0.12 * shadow, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    if (tilt) {
      ctx.translate(p.x, p.y);
      ctx.rotate((tilt * Math.PI) / 180);
      ctx.translate(-p.x, -p.y);
    }
    if (flip < 0) {
      ctx.translate(p.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-p.x, 0);
    }
    // Pixel art stays crisp when it's drawn bigger than its pixels, smooth when smaller.
    ctx.imageSmoothingEnabled = h < (img as HTMLCanvasElement).height * 1.5;
    if (s > 0.02) this.blitSoft(img, x0, y0, w, h, s, 0.75 * s);
    else ctx.drawImage(img, x0, y0, w, h);
    ctx.restore();
    this.box(it, p.depth, x0, y0, x0 + w, y0 + h, p.x, p.y, y0 + head * h);
  }

  private box(it: Item, depth: number, x0: number, y0: number, x1: number, y1: number, fx: number, fy: number, hy: number): void {
    it.depth = depth;
    it.x0 = x0;
    it.y0 = y0;
    it.x1 = x1;
    it.y1 = y1;
    it.fx = fx;
    it.fy = fy;
    it.hy = hy;
  }

  /**
   * Draws an image through a small scratch canvas: painted smaller, hazed toward the sky there, then scaled back up.
   * The shrink is the blur: it works without ctx.filter, and costs two image draws instead of a filter pass.
   */
  private blitSoft(img: CanvasImageSource, bx: number, by: number, bw: number, bh: number, s: number, haze: number): void {
    const { ctx, sg, soft, DPR } = this;
    const f = 1 / (1 + 0.9 * TOWN_FEEL.bandBlur * s);
    const k = DPR * f;
    const pw = Math.ceil(bw * k) + 2;
    const ph = Math.ceil(bh * k) + 2;
    if (soft.width < pw || soft.height < ph) {
      soft.width = Math.max(soft.width, pw);
      soft.height = Math.max(soft.height, ph);
    }
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = "source-over";
    sg.globalAlpha = 1;
    sg.clearRect(0, 0, soft.width, soft.height); // all of it: the scaled draw samples a pixel past its edges
    sg.imageSmoothingEnabled = true;
    sg.drawImage(img, 1, 1, bw * k, bh * k);
    if (haze > 0) {
      sg.globalCompositeOperation = "source-atop";
      sg.globalAlpha = haze;
      sg.fillStyle = SKYH_CSS;
      sg.fillRect(0, 0, pw, ph);
    }
    ctx.drawImage(soft, 0, 0, pw, ph, bx - 1 / k, by - 1 / k, pw / k, ph / k);
  }

  /** A home: its picture at the camera's scale, its name written on its sign. */
  private drawHouse(it: Item, now: number): void {
    const { ctx, view: v, p } = this;
    const home = this.homes[it.i]!;
    const art = HOUSES[home.id];
    const ch = art.ch;
    if (!proj(v, it.dx, it.dz, 0, p)) return;
    const px = p.k / TOWN_FEEL.housePxPerSquare; // screen pixels per picture pixel
    const w = ch.w * px;
    const h = ch.h * px;
    const x0 = p.x - ch.foot[0] * px;
    const y0 = p.y - ch.foot[1] * px;
    const s = bandOf(v, it.dx, it.dz);
    const alpha = (1 - 0.6 * s) * enterOf(v, it.dx, it.dz);
    const img = this.houseFrames[it.i]!.at(now, it.i * 613);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = px < 1.5;
    if (s > 0.02) this.blitSoft(img, x0, y0, w, h, s, 0.88 * s);
    else ctx.drawImage(img, x0, y0, w, h);
    // The name on the sign, written by the game (fading out in the far band, where it's too small to read anyway).
    const ta = alpha * clamp(1 - 2 * s, 0, 1);
    if (TOWN_FEEL.signNames && ta > 0.02) this.writeSign(home.name, x0 + art.sign.x * px, y0 + art.sign.y * px, art.sign.w * px, art.sign.h * px, ta);
    ctx.restore();
    const nm = this.names[it.i]!;
    nm.x = p.x;
    nm.y = y0 + this.houseTop(it.i) * px;
    nm.a = alpha;
    nm.k = p.k;
    this.box(it, p.depth, x0, y0, x0 + w, y0 + h, p.x, p.y, y0);
  }

  /** The first row of a home's picture with anything drawn in it (its building's top), found once. */
  private houseTop(i: number): number {
    let t = this.tops[i];
    if (t === undefined) {
      const img = this.houseFrames[i]!.get(0);
      const d = img.getContext("2d")!.getImageData(0, 0, img.width, img.height).data;
      let first = d.length;
      for (let j = 3; j < d.length; j += 4)
        if (d[j]! > 0) {
          first = j;
          break;
        }
      this.tops[i] = t = Math.floor(first / 4 / img.width);
    }
    return t;
  }

  /**
   * Writes a home's name on its sign's face (fx, fy, fw, fh) in the game's pixel font, on one line or two, whichever is
   * bigger; only when it's big enough to read (else the board stays blank). The font's letters are all 1 em wide, so
   * nothing needs measuring.
   */
  private writeSign(text: string, fx: number, fy: number, fw: number, fh: number, alpha: number): void {
    const { ctx } = this;
    let lay = this.signLayout.get(text);
    if (!lay) {
      // The whole name in letters, and its best split into two lines (the longer line's letters).
      const words = text.split(" ");
      let best = { l1: text, l2: "", two: Infinity };
      for (let i = 1; i < words.length; i++) {
        const l1 = words.slice(0, i).join(" ");
        const l2 = words.slice(i).join(" ");
        const two = Math.max(l1.length, l2.length);
        if (two < best.two) best = { l1, l2, two };
      }
      lay = { one: text.length, ...best };
      this.signLayout.set(text, lay);
    }
    const one = Math.min(fh * 0.62, (fw * 0.94) / lay.one);
    const two = Math.min(fh / 2.5, (fw * 0.94) / lay.two);
    const size = Math.floor(Math.max(one, two));
    if (size < TOWN_FEEL.signMinPx) return;
    ctx.globalAlpha = alpha;
    ctx.font = PIXEL_FONT[Math.min(40, size)]!;
    ctx.fillStyle = SIGN_INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = Math.round(fx + fw / 2);
    const cy = Math.round(fy + fh / 2);
    if (one >= two) ctx.fillText(text, cx, cy);
    else {
      ctx.fillText(lay.l1, cx, cy - Math.round(size * 0.65));
      ctx.fillText(lay.l2, cx, cy + Math.round(size * 0.65));
    }
  }

  /** A name tag over a pawn: white for the bots, gold for you; it shrinks with distance. */
  private drawTag(text: string, ax: number, ay: number, gold: boolean, size: number, alpha: number): void {
    const { ctx } = this;
    const s = Math.round(size);
    let widths = this.tagW.get(text);
    if (!widths) this.tagW.set(text, (widths = []));
    ctx.font = TAG_FONT[s]!;
    const tw = widths[s] ?? (widths[s] = ctx.measureText(text).width);
    const w = tw + s * 1.25;
    const h = s + (8 * s) / 11;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gold ? "rgba(255,215,106,.96)" : "rgba(255,255,255,.92)";
    ctx.shadowColor = "rgba(0,0,0,.25)";
    ctx.shadowBlur = 4;
    roundRect(ctx, ax - w / 2, ay - h, w, h, h / 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, ax, ay - h / 2);
    ctx.restore();
  }

  /** The speech bubble: white, rounded, its tail pointing down at the speaker's head. */
  private drawBubble(text: string, ax: number, ay: number): void {
    const { ctx, W } = this;
    ctx.font = BUBBLE_FONT;
    let b = this.bubbles.get(text);
    if (!b) {
      const words = text.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const t = line ? `${line} ${w}` : w;
        if (ctx.measureText(t).width > 176 && line) {
          lines.push(line);
          line = w;
        } else line = t;
      }
      if (line) lines.push(line);
      b = { lines, w: Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20 };
      this.bubbles.set(text, b);
    }
    const lh = 16;
    const h = b.lines.length * lh + 10;
    const bx = clamp(ax - b.w / 2, 6, W - b.w - 6);
    const by = Math.max(6, ay - h - 9);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.shadowColor = "rgba(0,0,0,.25)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "#fff";
    roundRect(ctx, bx, by, b.w, h, 12);
    ctx.fill();
    const tx = clamp(ax, bx + 14, bx + b.w - 14);
    ctx.beginPath();
    ctx.moveTo(tx - 6, by + h - 1);
    ctx.lineTo(tx + 6, by + h - 1);
    ctx.lineTo(tx, by + h + 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#1d1b19";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < b.lines.length; i++) ctx.fillText(b.lines[i]!, bx + b.w / 2, by + 5 + lh / 2 + i * lh);
  }

  // ---- Taps: a ripple where the finger landed; what it landed on.

  ripple(x: number, y: number, now: number): void {
    const r = this.ripples[this.rippleNext++ % this.ripples.length]!;
    r.x = x;
    r.y = y;
    r.t0 = now;
  }

  private drawRipples(now: number): void {
    const { ctx } = this;
    for (const r of this.ripples) {
      const a = (now - r.t0) / 700;
      if (a < 0 || a >= 1) continue;
      ctx.globalAlpha = 1 - a;
      ctx.strokeStyle = "#c9962a";
      ctx.fillStyle = "#c9962a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 8 + a * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r.x, r.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** What's under (x, y) in the box: a home, a boss or a person (nearest first), else a square, else null (the sky). */
  pick(x: number, y: number): Hit | null {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]!;
      if (!it.on || x < it.x0 || x > it.x1 || y < it.y0 || y > it.y1) continue;
      if (it.kind === "house") {
        // A home's picture is wide: only its drawn part (not the sky around its roof) counts.
        if (!this.houseHit(it, x, y)) continue;
        return { kind: "house", home: this.homes[it.i]! };
      }
      if (it.kind === "boss") return { kind: "boss", boss: this.town.bosses[it.i]! };
      return { kind: "person", person: this.town.people[it.i]! };
    }
    const sq = pickSquare(this.view, this.camX, this.camY, x, y);
    return sq ? { kind: "square", c: sq.c, r: sq.r } : null;
  }

  /** Is (x, y) on a drawn pixel of the home's first frame? */
  private houseHit(it: Item, x: number, y: number): boolean {
    const img = this.houseFrames[it.i]!.get(0);
    const px = Math.floor(((x - it.x0) / (it.x1 - it.x0)) * img.width);
    const py = Math.floor(((y - it.y0) / (it.y1 - it.y0)) * img.height);
    const a = img.getContext("2d")!.getImageData(clamp(px, 0, img.width - 1), clamp(py, 0, img.height - 1), 1, 1).data[3]!;
    return a > 0;
  }

  // ---- The edge chips: the boss homes off screen, nearest to you first; a face at the box's edge pointing there.

  private placeChips(now: number): void {
    const { town, view: v, W, H, p, chips } = this;
    const you = town.you.walker.pose(now, this.pose);
    const yx = you.x;
    const yy = you.y;
    let n = 0;
    for (const ch of chips) ch.home = null;
    // Up to four, nearest first: a home is left out when its picture or its boss is on screen.
    const order = SCRATCH_ORDER;
    order.length = 0;
    for (let i = 0; i < this.homes.length; i++) {
      const hi = this.houseItems[i]!;
      if (hi.on && hi.fx > 0 && hi.fx < W && hi.hy < H) continue;
      if (town.bosses[i]!.onScreen) continue; // (the bosses are in the homes' order: world.ts)
      order.push(i);
    }
    order.sort((a, b) => dist2(this.homes[a]!, yx, yy) - dist2(this.homes[b]!, yx, yy));
    const M = 44;
    const ox = W / 2;
    const oy = clamp(v.fy, H * 0.4, H * 0.75);
    for (const i of order) {
      if (n >= chips.length) break;
      const h = this.homes[i]!;
      const dx0 = wrapF(h.cx - this.camX);
      const dz0 = wrapF(h.cy - this.camY);
      // Aim along the drawn ground when the home is ahead and before the curve; otherwise by its map direction.
      let dx: number;
      let dy: number;
      if (dz0 > -v.back + 1 && radial(v, dx0, dz0) < v.rim && proj(v, dx0, dz0, 0, p) && !pastCurve(v, dx0, dz0)) {
        dx = p.x - ox;
        dy = p.y - oy;
      } else {
        dx = dx0 * v.kf;
        dy = -dz0 * v.kf * 0.6;
      }
      let t = Infinity;
      if (dx > 0) t = Math.min(t, (W - M - ox) / dx);
      else if (dx < 0) t = Math.min(t, (M - ox) / dx);
      if (dy > 0) t = Math.min(t, (H - M - oy) / dy);
      else if (dy < 0) t = Math.min(t, (M - oy) / dy);
      if (!isFinite(t)) t = 1;
      const c = chips[n++]!;
      c.home = h;
      c.x = ox + dx * t;
      c.y = oy + dy * t;
      c.angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    }
  }

  /** A boss's first idle frame (for its chip's face). */
  bossFace(id: HomeId): HTMLCanvasElement {
    return this.bossFrames[this.town.bosses.findIndex((b) => b.home.id === id)]!.get(0);
  }
}

const SKY_SKIRT = rgb(mix(SQ_LIGHT, SKYH, 0.85));
const SHADOW = "rgb(60,35,10)";
const SCRATCH_ORDER: number[] = [];
const byFarFirst = (a: Item, b: Item) => b.dz - a.dz;
const dist2 = (h: Home, x: number, y: number) => wrapF(h.cx - x) ** 2 + wrapF(h.cy - y) ** 2;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

