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
import { ALFIL } from "../characters/alfil.ts";
import { BIGBOY } from "../characters/bigboy.ts";
import { CLOWN } from "../characters/clown.ts";
import { GARDENER } from "../characters/gardener.ts";
import { HOPPER } from "../characters/hopper.ts";
import { PIG } from "../characters/pig.ts";
import { SAWYER } from "../characters/sawyer.ts";
import { SMUDGY } from "../characters/smudgy.ts";
import { TIGER_FIGURE } from "../characters/tiger-figure.ts";
import { N, bandOf, clamp, drawable, enterOf, farOf, forEachSquare, hazeMix, newPt, newView, pastCurve, pickSquare, proj, radial, rimYAt, setView, wrapF, type Quad, type View } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";
import { statueSpot } from "./houses/coliseum.ts";
import { COLISEUM_CHIP, artOf } from "./houses/index.ts";
import { CLOSE, QUOTE_INK, STATUE_W, quoteFace, statueArt, statueFrame, statueH, statueSteps } from "./houses/statues.ts";
import { CAP, LEADING, layout, lineWidth, renderLines } from "./sign-font.ts";
import { look, mixMist, mixRGB, mixTint, type SkyWeights } from "./sky.ts";
import { SkyPainter } from "./sky-draw.ts";
import { COLISEUM_PLACE, STATUES, onColiseum, plotAt, type Boss, type Home, type HomeId, type Person, type Place, type Pose, type Statue, type Town } from "./world.ts";

/** Each boss's sprite (its real one: its `idle` frames). */
export const BOSS_ART: Record<HomeId, Character> = {
  tiger: TIGER_FIGURE,
  gingerbread: GINGERBREAD,
  grex: GREX,
  hollow: HOLLOW,
  moo: MOO,
  clown: CLOWN,
  bigboy: BIGBOY,
  sawyer: SAWYER,
  pig: PIG,
  smudgy: SMUDGY,
  hopper: HOPPER,
  gardener: GARDENER,
  alfil: ALFIL,
};
/**
 * Each boss's head in its first idle frame (x, y and a side, in its pixels): what its edge chip shows. (Slice 1 cropped
 * the top of the frame, which showed Babur's balloons, not Babur.)
 */
export const BOSS_FACE: Record<HomeId, readonly [x: number, y: number, size: number]> = {
  tiger: [7, 52, 36],
  gingerbread: [29, 27, 32],
  grex: [22, 29, 40],
  hollow: [28, 18, 44],
  moo: [9, 26, 50],
  clown: [14, 24, 40],
  bigboy: [24, 16, 42],
  sawyer: [18, 0, 40],
  pig: [26, 4, 46],
  smudgy: [28, 8, 44],
  hopper: [22, 4, 36],
  gardener: [24, 22, 46],
  alfil: [10, 16, 38],
};

// ---- Colors (the prototype's, sampled from Eric's reference picture).
const SQ_LIGHT = [238, 197, 139] as const;
const SQ_DARK = [173, 128, 88] as const;
const MIX_STEPS = 64;
const INK = "#1f2530";
const SIGN_INK = "#2a2118";
const FONT = "Archivo, system-ui, sans-serif";
const FONT_BLACK = '"Archivo Black", Archivo, system-ui, sans-serif';

const mix = (a: readonly number[], b: readonly number[], t: number) => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
const rgb = (v: readonly number[]) => `rgb(${v[0]! | 0},${v[1]! | 0},${v[2]! | 0})`;

/** The haze strip's lines under the horizon. */
const HAZE_LINES = 10;
/** The squares' colors (65 steps toward the sky, light or dark, on a plot or not), and at most this many squares a frame. */
const SQ_KEYS = (MIX_STEPS + 1) * 4;
const SQ_MAX = 3000;

/**
 * Everything colored by the sky's horizon (the far ground, its seams, the haze, the skirt under the rim, the far
 * sprites' haze): made again only when the sky's look changes (about once a minute at most), never per frame.
 */
interface GroundColors {
  fill: string[];
  seam: string[];
  haze: string[];
  skirt: string;
  horizon: string;
}
function groundColors(skyh: readonly number[]): GroundColors {
  const fill: string[] = [];
  const seam: string[] = [];
  for (let i = 0; i <= MIX_STEPS; i++)
    for (let alt = 0; alt < 2; alt++)
      for (let plot = 0; plot < 2; plot++) {
        let base: readonly number[] = alt ? SQ_DARK : SQ_LIGHT;
        if (plot) base = base.map((x) => x * 0.9); // a faint darker tint under a home (and the Coliseum)
        const t = i / MIX_STEPS;
        const f = mix(base, skyh, t);
        fill[i * 4 + alt * 2 + plot] = rgb(f);
        seam[i * 4 + alt * 2 + plot] = rgb(f.map((x) => x * (0.86 + 0.14 * t))); // the seam fades out too
      }
  const haze = Array.from({ length: HAZE_LINES }, (_, i) => `rgba(${skyh[0]! | 0},${skyh[1]! | 0},${skyh[2]! | 0},${(0.75 * Math.pow(1 - i / HAZE_LINES, 1.7)).toFixed(3)})`);
  return { fill, seam, haze, skirt: rgb(mix(SQ_LIGHT, skyh, 0.85)), horizon: rgb(skyh) };
}
/** Fonts by whole pixel size (tags, signs). */
const TAG_FONT = Array.from({ length: 16 }, (_, s) => `600 ${s}px ${FONT}`);
/** The homes' floating names (the game's display font), by whole pixel size. */
const NAME_FONT = Array.from({ length: 41 }, (_, s) => `400 ${s}px ${FONT_BLACK}`);
const BUBBLE_FONT = `500 12px ${FONT}`;

// ---- The pawn (cburnett's, as on the boards: src/board/pieces/SOURCES.md), drawn once per look at a good size.
const PAWN_PATH =
  "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z";
export const PAWN_PX = 160;
/** The pawn's head is this far down its box (its top at y 9 of the piece's 45): name tags sit on it. */
const PAWN_HEAD = 9 / 45;
/**
 * And its base's foot (the path's bottom at y 39.5, and half its outline): this point stands on the square's middle, so
 * the base sits on the square. (Slices 1 to 4 stood it at 0.96, about a tenth of a square lower: it seemed to float.)
 */
const PAWN_FOOT = (39.5 + 0.75) / 45;

/** Your own pawn's picture: the plain pawn, or your dressed pawn (`pad`: the margin round the pawn's box for its items). */
export interface YouArt {
  img: HTMLCanvasElement;
  pad: number;
  /** The top of what's drawn (a hat over the head), down its box: your name tag sits on it. */
  top: number;
}
const pawnCache = new Map<string, HTMLCanvasElement>();
export function pawnImage(side: "light" | "dark", tint: string | null): HTMLCanvasElement {
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
  /** Faded out in front of a statue up close: taps go through it. */
  faded: boolean;
}
const newItem = (kind: Item["kind"], i: number): Item => ({ kind, i, dx: 0, dz: 0, on: false, depth: 0, x0: 0, y0: 0, x1: 0, y1: 0, fx: 0, fy: 0, hy: 0, faded: false });

/** An edge chip this frame: which place (a home, or the Coliseum), where on the box's edge, which way its arrow points (degrees). */
export interface Chip {
  place: Place | null;
  x: number;
  y: number;
  angle: number;
}

/** What a tap landed on. */
export type Hit =
  | { kind: "square"; c: number; r: number }
  | { kind: "house"; home: Home }
  | { kind: "coliseum" }
  | { kind: "statue"; statue: Statue }
  | { kind: "boss"; boss: Boss }
  | { kind: "person"; person: Person };

/** A character's first idle frame on a canvas (and, `mask`, which of its pixels are drawn, for taps). */
function canvasOf(ch: Character, mask?: Uint8Array[]): HTMLCanvasElement {
  const { w, h, data } = renderFrame(ch, ch.anims.idle!.frames[0]!);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  if (mask) {
    const m = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) m[i] = data[i * 4 + 3]! > 0 ? 1 : 0;
    mask.push(m);
  }
  return c;
}

/** A quote's lettering at one size: its canvas, `s` device pixels a font pixel, its lines, their pitch and height. */
interface QuoteArt {
  cv: HTMLCanvasElement;
  s: number;
  n: number;
  pitch: number;
  lineH: number;
}

/** A quote wrapped into lines no wider than `maxW` font pixels (null: a word alone is wider). */
function wrapQuote(text: string, maxW: number): string[] | null {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (lineWidth(word) > maxW) return null;
    const t = line ? `${line} ${word}` : word;
    if (line && lineWidth(t) > maxW) {
      lines.push(line);
      line = word;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

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
  readonly chips: Chip[] = Array.from({ length: TOWN_FEEL.maxChips }, () => ({ place: null, x: 0, y: 0, angle: 0 }));
  /** The buttons' box over the world (set by Town.tsx): no chip covers it. */
  readonly keepClear = { x: 0, y: 0, w: 0, h: 0 };
  /** This frame's name tags, homes' names and bubble, as boxes (x, y, w, h each) that no chip may cover. */
  private readonly clearBoxes = new Float32Array(4 * 96);
  private nClear = 0;
  private items: Item[];
  /** Every place the town names: the homes (in the bosses' order), then the Coliseum. */
  private readonly places: readonly Place[];
  /** The places' items, by place (the items themselves are sorted every frame). */
  private readonly houseItems: Item[];
  private readonly bossFrames: FrameCache[];
  private readonly houseFrames: FrameCache[];
  private readonly chipIcon: FrameCache;
  private readonly pose: Pose = { x: 0, y: 0, hop: 0, tilt: 0 };
  private readonly p = newPt();
  private readonly soft = document.createElement("canvas");
  private readonly sg = this.soft.getContext("2d")!;
  private readonly bandCv = document.createElement("canvas");
  private readonly bg = this.bandCv.getContext("2d")!;
  private readonly sky = new SkyPainter();
  /**
   * The close-up on a statue (Town.tsx sets it every frame): which (its index in STATUES; -1: none), how far the camera's
   * glide in has come (0 to 1, eased), and its quote: ms since it began to render in (-1: not yet) and how much of it is
   * left as you leave (1 to 0).
   */
  readonly close = { i: -1, e: 0, quoteMs: -1, quoteLeft: 1 };
  /** This frame's lens (1: none), and the quote's letters' height (CSS pixels; 0: not drawn), for the test hook. */
  lensMag = 1;
  quoteCap = 0;
  /** Where each statue was drawn this frame (screen pixels), for taps, chips and tests. */
  readonly statueBox = STATUES.map(() => ({ on: false, x0: 0, y0: 0, x1: 0, y1: 0 }));
  /** The statues at the world's scale; their close-ups (null until made, a slice a frame) and when each was ready. */
  private readonly statueImg: HTMLCanvasElement[];
  /** Which of each world's-scale statue's pixels are drawn (taps read this, never the canvas: a read-back stalls). */
  private readonly statueMask: Uint8Array[] = [];
  private readonly closeImg: (HTMLCanvasElement | null)[] = STATUES.map(() => null);
  private readonly closeReady: number[] = STATUES.map(() => NaN);
  private closeJob: { i: number; steps: ReturnType<typeof statueSteps>; layers: { part: import("../characters/sprite.ts").Part; at: readonly [number, number] }[] | null; next: number; cv: HTMLCanvasElement | null } | null = null;
  private buildFrom = NaN;
  /** The quotes' lettering, by statue and size (device pixels a font pixel): one canvas, its lines' pitch and height. */
  private readonly quoteArt = new Map<string, QuoteArt>();
  /** How deep (squares ahead of the camera) the statue in close-up stands: the people nearer than it fade. */
  private statueDz = Infinity;
  /** This sprite's fade (the people in front of a statue in close-up), multiplied into its alpha. */
  private fade = 1;
  /** The colors the sky's horizon sets, and the tint over the world (null: none), for the current look. */
  private colors: GroundColors = groundColors(look("day").sky[4]);
  /** Dawn's mist: extra haze over the far ground, into the horizon's own color. */
  private mist = 0;
  private tint: string | null = null;
  /** This frame's name tags and speech bubble, drawn after the world's tint so they stay as easy to read at night. */
  private readonly tags: { text: string; x: number; y: number; gold: boolean; size: number; alpha: number }[] = [];
  private nTags = 0;
  private readonly bubble = { on: false, text: "", x: 0, y: 0 };
  private bandGrad: CanvasGradient | null = null;
  private bandKey = "";
  /** The pressed square (slice 4): where, when the finger went down, when it lifted (-1: still down), and whether it pulses. */
  private readonly pressSq = { on: false, c: 0, r: 0, upAt: -1, pulse: false };
  /** Your trail's droplets (squares, unwrapped near where they fell; t0 -1e9: none), and the square you were last on. */
  private readonly drops = Array.from({ length: 8 }, () => ({ c: 0, r: 0, t0: -1e9 }));
  private dropNext = 0;
  private dropAt = -1e9;
  private lastC = -1;
  private lastR = -1;
  /** The boss's items, by boss (for its card's place). */
  private readonly bossItems: Item[];
  private readonly q4 = new Float64Array(8);
  /** Your dressed pawn (null: the plain pawn): set by Town.tsx when your look changes. */
  youArt: YouArt | null = null;
  /** Tag widths by name and size; sign and bubble layouts by text. */
  private readonly tagW = new Map<string, number[]>();
  private readonly nameW = new Map<string, number[]>();
  /** Each home's sign lettering: laid out once, drawn once per size (in device pixels a font pixel). */
  private readonly signs: { lines: string[]; w: number; h: number; art: HTMLCanvasElement[] }[];
  /** Where each place's name floats this frame (drawn over everything, after the homes): x, the building's top, its fade. */
  private readonly names: { x: number; y: number; a: number; k: number }[];
  private readonly tops: number[] = [];
  private readonly bubbles = new Map<string, { lines: string[]; w: number }>();
  private readonly drawSquare: (c: number, r: number, cu: number, ru: number, q: Quad) => void;
  /** This frame's squares: corners, faces' corners, colors; and a counting sort of them by color. */
  private readonly sqQuad = new Float64Array(SQ_MAX * 8);
  private readonly sqFace = new Float64Array(SQ_MAX * 8);
  private readonly sqKey = new Int16Array(SQ_MAX);
  private readonly sqSeam = new Uint8Array(SQ_MAX);
  private readonly sqOrder = new Int32Array(SQ_MAX);
  private readonly keyStart = new Int32Array(SQ_KEYS + 1);
  private nSq = 0;
  private seamHalf = 0.5;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly town: Town,
    private readonly homes: readonly Home[],
  ) {
    this.places = [...homes, COLISEUM_PLACE];
    this.houseItems = this.places.map((_, i) => newItem("house", i));
    this.names = this.places.map(() => ({ x: 0, y: 0, a: 0, k: 0 }));
    this.signs = this.places.map((h) => {
      const face = artOf(h).sign;
      return { ...layout(h.name, face.w, face.h), art: [] };
    });
    this.bossItems = town.bosses.map((_, i) => newItem("boss", i));
    this.items = [...this.houseItems, ...this.bossItems];
    this.bossFrames = town.bosses.map((b) => new FrameCache(BOSS_ART[b.home.id]));
    this.houseFrames = this.places.map((h) => new FrameCache(artOf(h).ch));
    this.chipIcon = new FrameCache(COLISEUM_CHIP);
    this.statueImg = STATUES.map((st) => canvasOf(statueArt(st.id, 1), this.statueMask));
    // Each square is kept this frame (its corners, its face's corners, its color) and drawn with all the others of its
    // color in one fill (drawGround): a few dozen fills a frame instead of two per square.
    this.drawSquare = (c, r, cu, ru, q) => {
      const n = this.nSq;
      if (n >= SQ_MAX) return;
      const m = Math.round(clamp(hazeMix(this.view, cu - this.camX, ru - this.camY, this.mist), 0, 1) * MIX_STEPS);
      this.sqKey[n] = m * 4 + ((c + r) & 1) * 2 + (plotAt[r * N + c] || onColiseum(c, r) ? 1 : 0);
      const o = n * 8;
      const cx = (q[0]! + q[2]! + q[4]! + q[6]!) / 4;
      const cy = (q[1]! + q[3]! + q[5]! + q[7]!) / 4;
      // A far, small square shows no seam to speak of: it's drawn once, whole, in its own color (half the work).
      const small = q[7]! - q[1]! < TOWN_FEEL.seamMinPx;
      this.sqSeam[n] = small ? 0 : 1;
      const s = small ? 0 : this.seamHalf;
      for (let i = 0; i < 8; i += 2) {
        this.sqQuad[o + i] = q[i]!;
        this.sqQuad[o + i + 1] = q[i + 1]!;
        // The face: its corners pulled toward its middle by half a seam.
        const dx = cx - q[i]!;
        const dy = cy - q[i + 1]!;
        const t = Math.min(0.45, s / (Math.hypot(dx, dy) || 1));
        this.sqFace[o + i] = q[i]! + dx * t;
        this.sqFace[o + i + 1] = q[i + 1]! + dy * t;
      }
      this.nSq = n + 1;
    };
  }

  /** The canvas's box changed (CSS pixels) or the device's pixel ratio did. */
  resize(W: number, H: number, DPR: number): void {
    this.W = W;
    this.H = H;
    this.DPR = DPR;
    this.sky.resize(W, H, DPR);
    for (const s of this.signs) s.art.length = 0;
  }

  /** The sky's look changed (the clock, or `?sky=`): the sky, the horizon's colors and the world's tint follow. */
  setSky(w: SkyWeights): void {
    this.sky.setWeights(w);
    this.colors = groundColors(mixRGB(w, (c) => c.sky[4]!));
    const t = mixTint(w);
    this.tint = t[3] > 0.004 ? `rgba(${t[0] | 0},${t[1] | 0},${t[2] | 0},${t[3].toFixed(3)})` : null;
    this.mist = mixMist(w);
  }

  /** Draws one frame. `zoom`: 0 normal, 1 zoomed out (and between, while it glides); `dt`: seconds since the last. */
  draw(now: number, camX: number, camY: number, zoom: number, dt = 0): void {
    const { ctx, W, H, DPR } = this;
    this.camX = camX;
    this.camY = camY;
    setView(this.view, W, H, zoom);
    this.lens(zoom);
    this.buildCloseUps(now);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    this.sky.draw(ctx, this.view, camX, camY, now, dt);
    this.drawGround();
    this.drawHorizonHaze(); // on the ground, behind every home, boss and pawn
    if (TOWN_FEEL.rimLine) this.drawRimLine();
    this.nTags = 0;
    this.nClear = 0;
    this.bubble.on = false;
    this.drawMarks(now); // on the ground, under everyone: the trail, your destination, the pressed square
    this.drawThings(now);
    // The light of the hour over the world and everything on it: one fill (none by day).
    if (this.tint) {
      ctx.fillStyle = this.tint;
      ctx.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < this.nTags; i++) {
      const t = this.tags[i]!;
      this.drawTag(t.text, t.x, t.y, t.gold, t.size, t.alpha);
    }
    if (TOWN_FEEL.floatingNames) this.drawNames(now);
    if (this.bubble.on) this.drawBubble(this.bubble.text, this.bubble.x, this.bubble.y); // (over a home's name)
    this.placeChips(now);
  }

  // ---- The close-up on a statue: the lens, the close-up drawings (made ahead), the statues, the quote.

  /**
   * The camera's lens for the close-up: the statue and its pedestal, as the plain camera shows them, magnified to fill the
   * box from `closeTop` to `closeBottom` (above the buttons where they'd meet), a longer lens the further the glide has
   * come (M to the power e, so the zoom's pace is even), its middle gliding to the box's.
   */
  private lens(zoom: number): void {
    const { view: v, p, close: c, W, H } = this;
    const f = TOWN_FEEL;
    this.lensMag = 1;
    this.quoteCap = 0;
    this.statueDz = Infinity;
    if (c.i < 0 || c.e <= 0) return;
    const pl = COLISEUM_PLACE;
    const dx = wrapF(pl.cx - this.camX);
    const dz = wrapF(pl.cy - pl.foot - this.camY);
    if (!proj(v, dx, dz, 0, p)) return;
    const id = STATUES[c.i]!.id;
    const ch = artOf(pl).ch;
    const at = statueSpot(id);
    const px = p.k / f.housePxPerSquare;
    const x0 = p.x + (at[0] - ch.foot[0]) * px;
    const y0 = p.y + (at[1] - ch.foot[1]) * px;
    const w = STATUE_W * px;
    const h = statueH(id) * px;
    const T = H * f.closeTop;
    let B = H * f.closeBottom;
    let M = Math.min((B - T) / h, (W * f.closeMaxWidth) / w);
    const kc = this.keepClear;
    const xT = W / 2 + M * (x0 + w / 2 - W / 2);
    if (kc.w > 0 && xT + (M * w) / 2 > kc.x && xT - (M * w) / 2 < kc.x + kc.w && B > kc.y - f.closeAboveButtons) {
      B = kc.y - f.closeAboveButtons;
      M = Math.min((B - T) / h, (W * f.closeMaxWidth) / w);
    }
    M = Math.max(1, M);
    const mag = Math.pow(M, c.e);
    const c1 = y0 + h / 2;
    const cE = c1 + ((T + B) / 2 - c1) * c.e;
    setView(v, W, H, zoom, mag, cE - v.cy - mag * (c1 - v.cy));
    this.lensMag = mag;
    this.statueDz = dz - 0.25;
  }

  /**
   * Makes the statues' close-up drawings ahead, a slice a frame (`closeBuildBudgetMs` of painting, or one layer drawn):
   * starting a little after the page opens, or at once for one the camera is coming in on.
   */
  private buildCloseUps(now: number): void {
    if (!this.closeImg.includes(null)) return;
    const f = TOWN_FEEL;
    if (Number.isNaN(this.buildFrom)) this.buildFrom = now + f.closeBuildAfterMs;
    const want = this.close.i >= 0 && !this.closeImg[this.close.i] ? this.close.i : -1;
    if (now < this.buildFrom && want < 0) return;
    const t0 = performance.now();
    do {
      let job = this.closeJob;
      if (!job) {
        const i = want >= 0 ? want : this.closeImg.indexOf(null);
        job = this.closeJob = { i, steps: statueSteps(STATUES[i]!.id, CLOSE), layers: null, next: 0, cv: null };
      }
      if (!job.layers) {
        const r = job.steps.next();
        if (r.done) job.layers = r.value;
        continue;
      }
      // One layer drawn (outlined and colored) at most a frame.
      const id = STATUES[job.i]!.id;
      if (!job.cv) {
        job.cv = document.createElement("canvas");
        job.cv.width = STATUE_W * CLOSE;
        job.cv.height = statueH(id) * CLOSE;
      }
      job.cv.getContext("2d")!.drawImage(canvasOf(statueFrame(id, CLOSE, [job.layers[job.next]!])), 0, 0);
      if (++job.next === job.layers.length) {
        this.closeImg[job.i] = job.cv;
        this.closeReady[job.i] = now;
        this.closeJob = null;
      }
      return;
    } while (performance.now() - t0 < f.closeBuildBudgetMs);
  }

  /**
   * The statues over the Coliseum's picture (x0, y0 its top left, `px` screen pixels a picture pixel): the world's figure,
   * or the close-up drawing crossfading in as the camera comes in on it (the world's figure fading only once the close-up
   * covers it, so the wall never shows through), and its quote once the camera has arrived.
   */
  private drawStatues(x0: number, y0: number, px: number, alpha: number, soft: number, now: number): void {
    const { ctx, close: c } = this;
    const f = TOWN_FEEL;
    for (let i = 0; i < STATUES.length; i++) {
      const id = STATUES[i]!.id;
      const at = statueSpot(id);
      const sx = x0 + at[0] * px;
      const sy = y0 + at[1] * px;
      const sw = STATUE_W * px;
      const sh = statueH(id) * px;
      const b = this.statueBox[i]!;
      b.on = true;
      b.x0 = sx;
      b.y0 = sy;
      b.x1 = sx + sw;
      b.y1 = sy + sh;
      const close = this.closeImg[i];
      let swap = 0;
      if (c.i === i && close) {
        const [a0, a1] = f.closeSwap;
        const t = clamp((c.e - a0) / (a1 - a0), 0, 1);
        swap = t * t * (3 - 2 * t) * clamp((now - this.closeReady[i]!) / f.closeReadyFadeMs, 0, 1);
      }
      const one = Math.min(1, 2 * (1 - swap));
      const fine = Math.min(1, 2 * swap);
      if (one > 0) {
        ctx.globalAlpha = alpha * one;
        ctx.imageSmoothingEnabled = px < 1.5;
        if (soft > 0.02) this.blitSoft(this.statueImg[i]!, sx, sy, sw, sh, soft, 0.88 * soft);
        else ctx.drawImage(this.statueImg[i]!, sx, sy, sw, sh);
      }
      if (fine > 0 && close) {
        ctx.globalAlpha = alpha * fine;
        ctx.imageSmoothingEnabled = px / CLOSE < 1.5;
        ctx.drawImage(close, sx, sy, sw, sh);
      }
      if (c.i === i) {
        if (c.e > 0.5) this.keepFree(sx, sy, sw, sh); // (no chip over the statue up close)
        if (c.quoteMs >= 0 && c.quoteLeft > 0) this.drawQuote(i, sx, sy, px, alpha);
      }
    }
    ctx.globalAlpha = alpha;
  }

  /**
   * A statue's quote on its pedestal's panel, in the signs' pixel capitals as big as fits in whole device pixels (wrapped
   * to the panel), engraved in the marble or cast in the bronze plaque: line by line, each fading in, all fading as you
   * leave.
   */
  private drawQuote(i: number, sx: number, sy: number, px: number, alpha: number): void {
    const { ctx, DPR, close: c } = this;
    const f = TOWN_FEEL;
    const face = quoteFace(STATUES[i]!.id);
    const fx = sx + face.x * px;
    const fy = sy + face.y * px;
    const fw = face.w * px;
    const fh = face.h * px;
    const q = this.quoteFor(i, fw * DPR, fh * DPR);
    if (!q) return;
    this.quoteCap = (q.s / DPR) * CAP;
    const w = q.cv.width / DPR;
    const h = q.cv.height / DPR;
    const ox = Math.round((fx + (fw - w) / 2) * DPR) / DPR;
    const oy = Math.round((fy + (fh - h) / 2) * DPR) / DPR;
    ctx.imageSmoothingEnabled = false;
    for (let l = 0; l < q.n; l++) {
      const a = clamp((c.quoteMs - l * f.quoteLineMs) / f.quoteFadeMs, 0, 1) * c.quoteLeft;
      if (a <= 0) continue;
      ctx.globalAlpha = alpha * a;
      const y = l * q.pitch;
      ctx.drawImage(q.cv, 0, y, q.cv.width, q.lineH, ox, oy + y / DPR, w, q.lineH / DPR);
    }
  }

  /** The quote's lettering for a panel fw x fh device pixels: the biggest whole size whose wrapped lines fit; cached. */
  private quoteFor(i: number, fw: number, fh: number): QuoteArt | null {
    const st = STATUES[i]!;
    for (let s = Math.floor(fh / CAP); s >= 1; s--) {
      const key = `${i}:${s}`;
      const done = this.quoteArt.get(key);
      const e = Math.max(1, Math.round(s / 3)); // the lettering's lit (or shadowed) edge, down and right
      if (done) {
        if (done.cv.width <= fw && done.cv.height <= fh) return done;
        continue;
      }
      const lines = wrapQuote(st.quote, (fw - e) / s);
      if (!lines) continue;
      const lh = lines.length * CAP + (lines.length - 1) * LEADING;
      if (lh * s + e > fh) continue;
      const lw = Math.max(...lines.map(lineWidth));
      const ink = QUOTE_INK[st.id];
      const cv = document.createElement("canvas");
      cv.width = lw * s + e;
      cv.height = lh * s + e;
      const g = cv.getContext("2d")!;
      g.drawImage(renderLines(lines, lw, lh, s, ink.edge), e, e);
      g.drawImage(renderLines(lines, lw, lh, s, ink.ink), 0, 0);
      const art = { cv, s, n: lines.length, pitch: (CAP + LEADING) * s, lineH: CAP * s + e };
      this.quoteArt.set(key, art);
      return art;
    }
    return null;
  }

  /** A box on the screen no chip may cover this frame (a tag, a home's name, the bubble). */
  private keepFree(x: number, y: number, w: number, h: number): void {
    if (this.nClear * 4 >= this.clearBoxes.length) return;
    const b = this.clearBoxes;
    const k = this.nClear++ * 4;
    b[k] = x;
    b[k + 1] = y;
    b[k + 2] = w;
    b[k + 3] = h;
  }

  /** True if a chip with its middle at (x, y) would cover a box, the buttons, or one of the first `n` chips. */
  private chipBlocked(x: number, y: number, n: number): boolean {
    const r = TOWN_FEEL.chipClear;
    const g = TOWN_FEEL.chipGap;
    const b = this.clearBoxes;
    for (let k = 0; k < this.nClear * 4; k += 4) {
      if (x + r > b[k]! && x - r < b[k]! + b[k + 2]! && y + r > b[k + 1]! && y - r < b[k + 1]! + b[k + 3]!) return true;
    }
    const kc = this.keepClear;
    if (kc.w > 0 && x + r > kc.x && x - r < kc.x + kc.w && y + r > kc.y && y - r < kc.y + kc.h) return true;
    for (let m = 0; m < n; m++) {
      const o = this.chips[m]!;
      if (Math.abs(o.x - x) < g && Math.abs(o.y - y) < g) return true;
    }
    return false;
  }

  /** A name tag to draw after the world's tint (kept in a list this frame: nothing allocated once it has grown). */
  private tag(text: string, x: number, y: number, gold: boolean, size: number, alpha: number): void {
    let t = this.tags[this.nTags];
    if (!t) this.tags.push((t = { text, x, y, gold, size, alpha }));
    t.text = text;
    t.x = x;
    t.y = y;
    t.gold = gold;
    t.size = size;
    t.alpha = alpha;
    this.nTags++;
  }

  /** A dark line along the world's rim (`rimLine` in feel.ts; off by default). */
  private drawRimLine(): void {
    const { ctx, view: v } = this;
    if (v.rimN < 2) return;
    ctx.strokeStyle = TOWN_FEEL.rimLineColor;
    ctx.lineWidth = TOWN_FEEL.rimLineWidth;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(v.rimPx[0]!, v.rimPy[0]!);
    for (let i = 1; i < v.rimN; i++) ctx.lineTo(v.rimPx[i]!, v.rimPy[i]!);
    ctx.stroke();
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
    ctx.fillStyle = this.colors.skirt;
    ctx.fillRect(0, 0, W, H);
    // Half a seam's width, measured along a square's diagonal (the prototype's stroke: kf x 0.022, 0.5 to 1.4 px).
    this.seamHalf = 0.5 * Math.SQRT2 * clamp(v.kf * 0.022, 0.5, 1.4);
    this.nSq = 0;
    forEachSquare(v, this.camX, this.camY, false, this.drawSquare);
    this.fillSquares();
    if (TOWN_FEEL.softenFarBand) this.softenBand();
    ctx.restore();
  }

  /**
   * The squares, by color: all the seams (each square whole, in its seam's color), then all the faces (each inset by
   * half a seam, in its own color). A face lies inside its own square, so the order between colors doesn't matter.
   */
  private fillSquares(): void {
    const { sqKey: key, sqOrder: order, keyStart: start, nSq: n } = this;
    start.fill(0);
    for (let i = 0; i < n; i++) start[key[i]! + 1]!++;
    for (let k = 0; k < SQ_KEYS; k++) start[k + 1]! += start[k]!;
    for (let i = 0; i < n; i++) order[start[key[i]!]!++] = i;
    // (`start[k]` now ends color k's run; it began where color k - 1's ended.)
    this.fillRuns(this.sqQuad, this.colors.seam, true);
    this.fillRuns(this.sqFace, this.colors.fill, false);
  }

  /** One fill per color: every square of that color's quad (from `pts`) in one path (`seams`: only squares with one). */
  private fillRuns(pts: Float64Array, colors: readonly string[], seams: boolean): void {
    const { ctx, sqOrder: order, keyStart: start, sqSeam: seam } = this;
    let i = 0;
    for (let k = 0; k < SQ_KEYS; k++) {
      const end = start[k]!;
      if (i === end) continue;
      ctx.beginPath();
      for (; i < end; i++) {
        if (seams && !seam[order[i]!]) continue;
        const o = order[i]! * 8;
        ctx.moveTo(pts[o]!, pts[o + 1]!);
        ctx.lineTo(pts[o + 2]!, pts[o + 3]!);
        ctx.lineTo(pts[o + 4]!, pts[o + 5]!);
        ctx.lineTo(pts[o + 6]!, pts[o + 7]!);
        ctx.closePath();
      }
      ctx.fillStyle = colors[k]!;
      ctx.fill();
    }
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
      ctx.strokeStyle = this.colors.haze[i]!;
      ctx.beginPath();
      ctx.moveTo(v.rimPx[0]!, v.rimPy[0]! + off);
      for (let j = 1; j < v.rimN; j++) ctx.lineTo(v.rimPx[j]!, v.rimPy[j]! + off);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- The homes, bosses and pawns, far to near.

  private drawThings(now: number): void {
    const { town, view: v, places, pose } = this;
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
      let below = 3.2;
      if (it.kind === "house") {
        const h = places[it.i]!;
        x = h.cx;
        y = h.cy - h.foot; // where the picture's foot stands (a home's: half a square in front of the plot's middle)
        margin = h.half + 1;
        below = h.half > 2 ? 7 : below; // (the Coliseum is tall: its top shows while its foot is well under the box)
      } else {
        const w = it.kind === "boss" ? town.bosses[it.i]!.walker : people[it.i]!.walker;
        w.pose(now, pose);
        x = pose.x;
        y = pose.y;
        if (it.kind === "boss") margin = 2;
      }
      it.dx = wrapF(x - this.camX);
      it.dz = wrapF(y - this.camY);
      it.on = drawable(v, it.dx, it.dz, margin, below);
    }
    items.sort(byFarFirst);
    for (const b of town.bosses) b.onScreen = false;
    for (const b of this.statueBox) b.on = false;
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
        if (town.speech.boss === b) {
          this.bubble.on = true;
          this.bubble.text = town.speech.line;
          this.bubble.x = it.fx;
          this.bubble.y = it.hy;
        }
      } else {
        const person = people[it.i]!;
        const w = person.walker;
        w.pose(now, pose);
        // Up close on a statue, the people in front of it (you, on its square) fade: they'd stand between the camera and it.
        this.fade = it.dz < this.statueDz ? 1 - f.closeNearFade * this.close.e : 1;
        it.faded = this.fade < 0.5;
        if (person.you) {
          // Your shadows are a bot's: sized from the pawn, not from the margin your look's items are drawn in.
          const art = this.youArt;
          const k = 1 + 2 * (art?.pad ?? 0);
          const pad = art?.pad ?? 0;
          this.drawSprite(it, art?.img ?? pawnImage(person.look.side, person.look.tint), f.youSquares * k, 0.5, (pad + PAWN_FOOT) / k, 1, pose.hop * f.youHop, pose.tilt * f.hobbleTilt, w.facing, 1, Math.min(art?.top ?? 1, (pad + PAWN_HEAD) / k), true, 1 / k);
          if (this.fade > 0.02) this.tag(person.name, it.fx, it.hy - 2, true, clamp((11 * this.p.k) / v.kf, 8, 12), this.fade);
        } else {
          this.drawSprite(it, pawnImage(person.look.side, person.look.tint), f.botSquares, 0.5, PAWN_FOOT, 1, pose.hop * f.botHop, pose.tilt * f.hobbleTilt, w.facing, 1, PAWN_HEAD, true);
          // Name tags on the near ones only.
          const far = farOf(v, it.dz);
          if (far < f.tagFar && this.fade > 0.02) this.tag(person.name, it.fx, it.hy - 2, false, clamp((11 * this.p.k) / v.kf, 8, 12), clamp((f.tagFar - far) / 0.12, 0, 1) * this.fade);
        }
        this.fade = 1;
      }
    }
  }

  /**
   * The homes' names, landmark style: white with a dark outline, a little above each building, over everything else.
   * Each fades in (rising a little) as you come within a few squares of its plot and fades out as you leave.
   */
  private drawNames(now: number): void {
    const { ctx, places, pose, view: v } = this;
    const f = TOWN_FEEL;
    const me = this.town.you.walker.pose(now, pose);
    for (let i = 0; i < places.length; i++) {
      const h = places[i]!;
      const it = this.houseItems[i]!;
      const nm = this.names[i]!;
      if (!it.on || nm.a <= 0.01) continue;
      // How far you are from the edge of its ground (a home's plot is 3 squares across, the Coliseum's 6), in squares.
      const d = Math.max(0, Math.abs(wrapF(me.x - h.cx)) - h.half, Math.abs(wrapF(me.y - h.cy)) - h.half);
      const a = nm.a * clamp((f.nameShowFrom - d) / (f.nameShowFrom - f.nameFullAt), 0, 1);
      if (a <= 0.01) continue;
      const size = Math.round(clamp((15 * nm.k) / v.kf, 12, 20));
      const y = nm.y - 6 + (1 - a) * f.nameRise;
      ctx.globalAlpha = a;
      ctx.font = NAME_FONT[size]!;
      let widths = this.nameW.get(h.name);
      if (!widths) this.nameW.set(h.name, (widths = []));
      const tw = widths[size] ?? (widths[size] = ctx.measureText(h.name).width);
      this.keepFree(nm.x - tw / 2 - 2, y - size - 2, tw + 4, size + 4);
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

  /**
   * A sprite standing on the ground: its foot at (fx, fy) of its box, `sq` squares tall; lifted `lift` squares (the
   * hop), tilted `tilt` degrees, flipped to face its walk; a soft shadow under it and a contact shadow right under its
   * base (`pawn`: the base's width, else `shadow` sizes it), both tight and dark standing, smaller and lighter as it
   * lifts. Fills the item's box; its head is `head` of the way down the box; the pawn is `base` of the box's width (less
   * than 1 when the box has a margin for items).
   */
  private drawSprite(it: Item, img: CanvasImageSource, sq: number, fx: number, fy: number, aspect: number, lift: number, tilt: number, flip: number, shadow: number, head = 0, pawn = false, base = 1): void {
    const { ctx, view: v, p } = this;
    if (!proj(v, it.dx, it.dz, 0, p)) return;
    const h = sq * p.k;
    const w = h * aspect;
    const x0 = p.x - fx * w;
    const y0 = p.y - fy * h - lift * p.k;
    const s = bandOf(v, it.dx, it.dz); // in the far band: fade, haze and blur
    const alpha = (1 - TOWN_FEEL.bandFade * s) * enterOf(v, it.dx, it.dz) * this.fade;
    ctx.save();
    // The shadows follow the height: the higher it is, the smaller and lighter they are; gone by the rim.
    const F = TOWN_FEEL;
    const up = Math.max(0, lift);
    const grow = 1 / (1 + up * F.shadowLiftShrink);
    const fade = Math.max(0, 1 - up * F.shadowLiftFade);
    ctx.fillStyle = SHADOW;
    const soft = shadow;
    ctx.globalAlpha = alpha * F.shadowAlpha * (1 - s) * (0.5 + 0.5 * fade);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.min(w * base * 0.42, p.k * 0.42 * soft) * grow, p.k * 0.12 * soft * grow, 0, 0, Math.PI * 2);
    ctx.fill();
    const cw = pawn ? w * base * F.contactShadowW : p.k * F.contactShadowW * 1.45 * Math.min(shadow, 1.2);
    ctx.globalAlpha = alpha * F.contactShadowAlpha * (1 - s) * fade;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, cw * grow, p.k * F.contactShadowDepth * grow, 0, 0, Math.PI * 2);
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
      sg.fillStyle = this.colors.horizon;
      sg.fillRect(0, 0, pw, ph);
    }
    ctx.drawImage(soft, 0, 0, pw, ph, bx - 1 / k, by - 1 / k, pw / k, ph / k);
  }

  /** A home: its picture at the camera's scale, its name written on its sign. */
  private drawHouse(it: Item, now: number): void {
    const { ctx, view: v, p } = this;
    const art = artOf(this.places[it.i]!);
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
    if (TOWN_FEEL.signNames && ta > 0.02) this.writeSign(it.i, x0 + art.sign.x * px, y0 + art.sign.y * px, art.sign.w * px, art.sign.h * px, ta);
    if (it.i === this.homes.length) this.drawStatues(x0, y0, px, alpha, s, now);
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
   * Writes a home's name on its sign's face (fx, fy, fw, fh) in the signs' pixel capitals (sign-font.ts), on one line
   * or two, as big as fits in whole device pixels, and only when its letters are big enough to read (`signMinCap`);
   * else the board stays blank. Each size is drawn once.
   */
  private writeSign(i: number, fx: number, fy: number, fw: number, fh: number, alpha: number): void {
    const { ctx, DPR } = this;
    const sg = this.signs[i]!;
    const fit = Math.min(fw / sg.w, fh / sg.h) * 0.94; // CSS pixels a font pixel
    const s = Math.floor(fit * DPR + 0.25); // device pixels a font pixel, whole, so the letters stay crisp
    if (s < 1 || (s / DPR) * CAP < TOWN_FEEL.signMinCap) return;
    let art = sg.art[s];
    if (!art) art = sg.art[s] = renderLines(sg.lines, sg.w, sg.h, s, SIGN_INK);
    const w = (sg.w * s) / DPR;
    const h = (sg.h * s) / DPR;
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(art, Math.round((fx + (fw - w) / 2) * DPR) / DPR, Math.round((fy + (fh - h) / 2) * DPR) / DPR, w, h);
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
    this.keepFree(ax - w / 2, ay - h, w, h);
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
    this.keepFree(bx, by, b.w, h + 7);
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

  // ---- Taps: the pressed square; what a finger landed on; where a card stands.

  /** A finger went down: `c, r` (the square you'd walk to) presses in and lights up, until `release`. */
  pressSquare(c: number, r: number): void {
    const ps = this.pressSq;
    ps.on = true;
    ps.c = c;
    ps.r = r;
    ps.upAt = -1;
    ps.pulse = false;
  }

  /** The finger lifted: the square releases, with one pulse of its border (`pulse`: you set off) or none (a drag). */
  release(now: number, pulse: boolean): void {
    const ps = this.pressSq;
    if (!ps.on) return;
    ps.upAt = now;
    ps.pulse = pulse;
    if (!pulse) ps.on = false;
  }

  /** Square (c, r)'s corners on the screen, into `q4` (far left, far right, near right, near left), scaled about its middle. */
  private squareQuad(c: number, r: number, scale: number, drop: number): boolean {
    const { view: v, p, q4 } = this;
    const dx = wrapF(c - this.camX);
    const dz = wrapF(r - this.camY);
    if (radial(v, dx, dz) > v.rim) return false;
    const h = 0.5 * scale;
    for (let i = 0; i < 4; i++) {
      if (!proj(v, dx + CORNERS[i * 2]! * h, dz + CORNERS[i * 2 + 1]! * h - drop, 0, p)) return false;
      q4[i * 2] = p.x;
      q4[i * 2 + 1] = p.y;
    }
    return true;
  }

  private quadPath(): void {
    const { ctx, q4 } = this;
    ctx.beginPath();
    ctx.moveTo(q4[0]!, q4[1]!);
    for (let i = 2; i < 8; i += 2) ctx.lineTo(q4[i]!, q4[i + 1]!);
    ctx.closePath();
  }

  /** Pixels across one square at (c, r) (for line widths). */
  private squarePx(c: number, r: number): number {
    return proj(this.view, wrapF(c - this.camX), wrapF(r - this.camY), 0, this.p) ? this.p.k : 0;
  }

  /** Your trail's droplets, your destination's mark, and the pressed square: on the ground, before anyone stands on it. */
  private drawMarks(now: number): void {
    const { ctx, town } = this;
    const f = TOWN_FEEL;
    // A droplet on each square you leave as you run (one at most every trailEveryMs).
    const w = town.you.walker;
    const hc = w.hereC();
    const hr = w.hereR();
    if (hc !== this.lastC || hr !== this.lastR) {
      if (this.lastC >= 0 && now - this.dropAt >= f.trailEveryMs) {
        const d = this.drops[this.dropNext++ % this.drops.length]!;
        d.c = this.lastC;
        d.r = this.lastR;
        d.t0 = now;
        this.dropAt = now;
      }
      this.lastC = hc;
      this.lastR = hr;
    }
    ctx.save();
    for (const d of this.drops) {
      const a = (now - d.t0) / f.trailLifeMs;
      if (a < 0 || a >= 1) continue;
      const dx = wrapF(d.c - this.camX);
      const dz = wrapF(d.r - this.camY);
      if (radial(this.view, dx, dz) > this.view.rim || !proj(this.view, dx, dz, 0, this.p)) continue;
      const rx = this.p.k * f.trailSize * 0.5 * (1 - 0.6 * a);
      ctx.globalAlpha = f.trailAlpha * (1 - a) * (1 - a) * enterOf(this.view, dx, dz);
      ctx.fillStyle = "rgba(110,70,30,0.22)"; // a faint shadow under it (it shows on the light squares too)...
      ctx.beginPath();
      ctx.ellipse(this.p.x, this.p.y + rx * 0.25, rx * 1.5, rx * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)"; // a soft rim...
      ctx.beginPath();
      ctx.ellipse(this.p.x, this.p.y, rx * 1.4, rx * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff"; // ...round a brighter middle
      ctx.beginPath();
      ctx.ellipse(this.p.x, this.p.y, rx, rx * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Your destination: a small gold ring on its square, while you walk there.
    if (w.moving()) {
      const gc = w.goalC();
      const gr = w.goalR();
      const ps = this.pressSq;
      if (!(ps.on && ps.c === gc && ps.r === gr) && proj(this.view, wrapF(gc - this.camX), wrapF(gr - this.camY), 0, this.p)) {
        const k = this.p.k;
        ctx.strokeStyle = f.pressEdge;
        ctx.fillStyle = "rgba(255,215,106,.35)";
        ctx.lineWidth = Math.max(1.5, k * 0.035);
        ctx.beginPath();
        ctx.ellipse(this.p.x, this.p.y, k * f.targetSize * 0.5, k * f.targetSize * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    // The pressed square (Eric's slice 4 test: the border, the seam and an inner line read as layers): its face dims a
    // little and evenly, and one bold gold border lies exactly on its edge, over its seam, with a soft glow outside it
    // only. As the finger lifts, that same border brightens, widens a little and fades.
    const ps = this.pressSq;
    const a = ps.upAt < 0 ? 0 : (now - ps.upAt) / f.pulseMs;
    if (ps.on && a >= 1) ps.on = false;
    if (ps.on && this.squareQuad(ps.c, ps.r, 1, 0)) {
      const k = this.squarePx(ps.c, ps.r);
      const bold = Math.max(f.pressBorderMinPx, k * f.pressBorder);
      {
        const fade = 1 - a;
        if (ps.upAt < 0) {
          this.quadPath();
          ctx.fillStyle = `rgba(40,24,8,${f.pressDarken.toFixed(3)})`;
          ctx.fill();
        }
        ctx.lineJoin = "miter";
        ctx.strokeStyle = ps.upAt < 0 ? f.pressColor : f.pulseColor;
        ctx.lineWidth = bold * (1 + f.pulseWiden * a);
        // The glow, outside the square only: everything but the square is clipped in (even-odd).
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this.W, this.H);
        const q = this.q4;
        ctx.moveTo(q[0]!, q[1]!);
        for (let i = 2; i < 8; i += 2) ctx.lineTo(q[i]!, q[i + 1]!);
        ctx.closePath();
        ctx.clip("evenodd");
        ctx.globalAlpha = fade;
        ctx.shadowColor = f.pressColor;
        ctx.shadowBlur = f.pressGlowPx;
        this.quadPath();
        ctx.stroke();
        ctx.restore();
        // The border itself, crisp, on the edge.
        ctx.globalAlpha = fade;
        this.quadPath();
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  /** Where a card points: over a boss's head or a place's top (`i`: its index in the homes, then the Coliseum), on screen (false: not drawn this frame). */
  anchor(kind: "boss" | "home", i: number, out: { x: number; y: number }): boolean {
    if (kind === "boss") {
      const it = this.bossItems[i]!;
      if (!it.on) return false;
      // The top of its head (its chip's face box, in its picture), not the top of its picture's box.
      const id = this.town.bosses[i]!.home.id;
      out.x = it.fx;
      out.y = it.y0 + (BOSS_FACE[id][1] / BOSS_ART[id].h) * (it.y1 - it.y0) - 4;
      return out.y > 0 && out.y < this.H && out.x > 0 && out.x < this.W;
    }
    const it = this.houseItems[i]!;
    const nm = this.names[i]!;
    if (!it.on) return false;
    // Over the home's floating name (it rises about this high over the building), so the card never covers it.
    out.x = nm.x;
    out.y = nm.y - (TOWN_FEEL.floatingNames ? TOWN_FEEL.cardOverName : 0);
    return out.y > 0 && out.y < this.H && out.x > 0 && out.x < this.W;
  }

  /**
   * A point to tap on a boss (its body's middle) or a place (low on its picture; the Coliseum's gate), on screen, where a
   * tap lands on it: if something nearer stands over that point (a boss in front of its home, a bot at the gate), the
   * first point of a grid over its picture that a tap would hit. False if it isn't drawn or none is clear. (For tests.)
   */
  tapPoint(kind: "boss" | "home" | "statue", i: number, out: { x: number; y: number }): boolean {
    if (kind === "statue") {
      // Its pedestal's middle, or higher up the figure if someone stands in front of that.
      const b = this.statueBox[i];
      if (!b?.on) return false;
      for (const v of [0.82, 0.6, 0.4, 0.25]) {
        out.x = (b.x0 + b.x1) / 2;
        out.y = b.y0 + v * (b.y1 - b.y0);
        const h = out.x > 0 && out.x < this.W && out.y > 0 && out.y < this.H ? this.pick(out.x, out.y) : null;
        if (h?.kind === "statue" && h.statue === STATUES[i]) return true;
      }
      return false;
    }
    const it = kind === "boss" ? this.bossItems[i]! : this.houseItems[i]!;
    if (!it.on) return false;
    const ok = (x: number, y: number) => {
      if (!(x > 0 && x < this.W && y > 0 && y < this.H)) return false;
      const h = this.pick(x, y);
      if (kind === "boss") return h?.kind === "boss" && h.boss === this.town.bosses[i];
      return i >= this.homes.length ? h?.kind === "coliseum" : h?.kind === "house" && h.home === this.homes[i];
    };
    out.x = kind === "boss" ? (it.x0 + it.x1) / 2 : it.fx;
    out.y = kind === "boss" ? it.y0 + 0.6 * (it.y1 - it.y0) : it.y0 + (this.places[it.i] === COLISEUM_PLACE ? 0.88 : 0.8) * (it.y1 - it.y0);
    if (ok(out.x, out.y)) return true;
    for (let v = 0.9; v > 0.2; v -= 0.1)
      for (let u = 0.5, n = 0; n < 9; n++, u = 0.5 + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.08) {
        const x = it.x0 + u * (it.x1 - it.x0);
        const y = it.y0 + v * (it.y1 - it.y0);
        if (ok(x, y)) {
          out.x = x;
          out.y = y;
          return true;
        }
      }
    return false;
  }

  /** What's under (x, y) in the box: a home, a boss or a person (nearest first), else a square, else null (the sky). */
  pick(x: number, y: number): Hit | null {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]!;
      if (!it.on || it.faded || x < it.x0 || x > it.x1 || y < it.y0 || y > it.y1) continue;
      if (it.kind === "house") {
        // A home's picture is wide: only its drawn part (not the sky around its roof) counts.
        if (it.i >= this.homes.length) {
          const st = this.statueHit(x, y);
          if (st) return { kind: "statue", statue: st };
        }
        if (!this.houseHit(it, x, y)) continue;
        if (it.i >= this.homes.length) return { kind: "coliseum" };
        return { kind: "house", home: this.homes[it.i]! };
      }
      if (it.kind === "boss") return { kind: "boss", boss: this.town.bosses[it.i]! };
      return { kind: "person", person: this.town.people[it.i]! };
    }
    const sq = pickSquare(this.view, this.camX, this.camY, x, y);
    return sq ? { kind: "square", c: sq.c, r: sq.r } : null;
  }

  /** The statue (its figure or its pedestal) drawn under (x, y), or null. */
  private statueHit(x: number, y: number): Statue | null {
    for (let i = 0; i < STATUES.length; i++) {
      const b = this.statueBox[i]!;
      if (!b.on || x < b.x0 || x >= b.x1 || y < b.y0 || y >= b.y1) continue;
      const img = this.statueImg[i]!;
      const px = Math.floor(((x - b.x0) / (b.x1 - b.x0)) * img.width);
      const py = Math.floor(((y - b.y0) / (b.y1 - b.y0)) * img.height);
      if (this.statueMask[i]![py * img.width + px]) return STATUES[i]!;
    }
    return null;
  }

  /** Is (x, y) on a drawn pixel of the home's first frame? */
  private houseHit(it: Item, x: number, y: number): boolean {
    const img = this.houseFrames[it.i]!.get(0);
    const px = Math.floor(((x - it.x0) / (it.x1 - it.x0)) * img.width);
    const py = Math.floor(((y - it.y0) / (it.y1 - it.y0)) * img.height);
    const a = img.getContext("2d")!.getImageData(clamp(px, 0, img.width - 1), clamp(py, 0, img.height - 1), 1, 1).data[3]!;
    return a > 0;
  }

  // ---- The edge chips: the places off screen (the boss homes and the Coliseum), nearest to you first; a face (or the
  // Coliseum's crown) at the box's edge pointing there.

  private placeChips(now: number): void {
    const { town, view: v, W, H, p, chips, places } = this;
    const you = town.you.walker.pose(now, this.pose);
    const yx = you.x;
    const yy = you.y;
    let n = 0;
    for (const ch of chips) ch.place = null;
    // Nearest first: a home is left out when its picture or its boss is on screen; the Coliseum when any of it is.
    const order = SCRATCH_ORDER;
    order.length = 0;
    for (let i = 0; i < places.length; i++) {
      const hi = this.houseItems[i]!;
      if (i >= this.homes.length) {
        if (hi.on && hi.x1 > 0 && hi.x0 < W && hi.y0 < H && hi.y1 > 0) continue;
      } else {
        if (hi.on && hi.fx > 0 && hi.fx < W && hi.hy < H) continue;
        if (town.bosses[i]!.onScreen) continue; // (the bosses are in the homes' order: world.ts)
      }
      order.push(i);
    }
    order.sort((a, b) => dist2(places[a]!, yx, yy) - dist2(places[b]!, yx, yy));
    // The Coliseum, when it's among the nearest few, is placed first: it takes its spot before the homes' chips.
    const col = order.indexOf(this.homes.length);
    if (col > 0 && col < chips.length) {
      for (let k = col; k > 0; k--) order[k] = order[k - 1]!;
      order[0] = this.homes.length;
    }
    const M = 44;
    const ox = W / 2;
    const oy = clamp(v.fy, H * 0.4, H * 0.75);
    // Only the nearest few are thought of (`maxChips`): one with no room is left out, not swapped for a farther one.
    for (let o = 0; o < order.length && o < chips.length; o++) {
      const i = order[o]!;
      const h = places[i]!;
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
      const x0 = ox + dx * t;
      const y0 = oy + dy * t;
      // Never over a name tag, a home's name, the bubble, the buttons or a nearer home's chip: slide along the edge it
      // sits on to the nearest clear spot (its arrow still points home); no clear spot, no chip.
      const side = x0 <= M + 1 || x0 >= W - M - 1; // on the left or right edge: slide up or down
      const lo = M;
      const end = side ? H - M : W - M;
      const at0 = side ? y0 : x0;
      const step = TOWN_FEEL.chipSlideStep;
      let found = NaN;
      for (let s = 0; at0 - s * step >= lo || at0 + s * step <= end; s++) {
        const up = at0 + s * step;
        const down = at0 - s * step;
        if (up <= end && !this.chipBlocked(side ? x0 : up, side ? up : y0, n)) {
          found = up;
          break;
        }
        if (s > 0 && down >= lo && !this.chipBlocked(side ? x0 : down, side ? down : y0, n)) {
          found = down;
          break;
        }
      }
      if (Number.isNaN(found)) continue;
      const c = chips[n++]!;
      c.place = h;
      c.x = side ? x0 : found;
      c.y = side ? found : y0;
      c.angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    }
  }

  /** What a place's chip shows: its boss's first idle frame and the box round the boss's head, or the Coliseum's crown. */
  chipFace(place: Place): { img: HTMLCanvasElement; box: readonly [x: number, y: number, size: number] } {
    if (place.id === "coliseum") return { img: this.chipIcon.get(0), box: CHIP_ICON_BOX };
    return { img: this.bossFrames[this.town.bosses.findIndex((b) => b.home.id === place.id)]!.get(0), box: BOSS_FACE[place.id] };
  }
}

const SHADOW = "rgb(60,35,10)";
/** The ring's points round its circle. */
/** A square's corners from its middle, in half-squares: far left, far right, near right, near left. */
const CORNERS = [-1, 1, 1, 1, 1, -1, -1, -1] as const;
const SCRATCH_ORDER: number[] = [];
const byFarFirst = (a: Item, b: Item) => b.dz - a.dz;
const dist2 = (h: Place, x: number, y: number) => wrapF(h.cx - x) ** 2 + wrapF(h.cy - y) ** 2;
/** The Coliseum's chip shows all of its icon. */
const CHIP_ICON_BOX = [0, 0, COLISEUM_CHIP.w] as const;

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

