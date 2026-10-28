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
import { frameKeys, renderFrame, type Character } from "../characters/sprite.ts";
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
import { FOLIO } from "../characters/folio.ts";
import { N, bandOf, clamp, drawable, enterOf, farOf, forEachSquare, hazeMix, newPt, newView, pastCurve, pickSquare, proj, radial, rimYAt, setView, wrapF, type Quad, type View } from "./camera.ts";
import { CHAT_BOX } from "./chat.ts";
import { TOWN_FEEL } from "./feel.ts";
import { statueSpot } from "./houses/coliseum.ts";
import { COLISEUM_CHIP, artOf } from "./houses/index.ts";
import { CLOSE, QUOTE_INK, STATUE_W, quoteFace, statueArt, statueFrame, statueH, statueSteps } from "./houses/statues.ts";
import { CAP, LEADING, layout, lineWidth, renderLines } from "./sign-font.ts";
import { look, mixLights, mixMist, mixRGB, mixTint, type SkyWeights } from "./sky.ts";
import { SkyPainter } from "./sky-draw.ts";
import type { LightPool, LightSpot } from "./houses/kit.ts";
import { PARK_BENCH, PARK_FOUNTAIN, PARK_LAMP, PARK_LAMP_HEAD, PARK_LAMP_LIGHTS, PARK_LAMP_POOLS, PARK_TABLE, PARK_TREES, TABLE_BACK_RANK, TABLE_BOARD, TABLE_CLOCK_INK, TABLE_DIGITS, TABLE_INK, TABLE_PIECES, TABLE_RING, TABLE_TOP } from "./houses/park.ts";
import { COLISEUM_PLACE, GRASS, LAMPS, PAVING, PROPS, STATUES, TABLES, groundAt, onColiseum, plotAt, seated, tableStates, type Boss, type Home, type HomeId, type Person, type Place, type Pose, type Prop, type Statue, type StatueId, type Table, type TableState, type Town } from "./world.ts";

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
  folio: FOLIO,
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
  // (Its head and beak, at its rest.)
  folio: [3, 12, 28],
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
/**
 * The squares' colors: 65 steps toward the sky, light or dark, and the ground (the board, the board under a home or the
 * Colosseum, the park's paving, its grass); and at most this many squares a frame.
 */
const GROUNDS = 4;
const SQ_KEYS = (MIX_STEPS + 1) * GROUNDS * 2;
/** The park's paving (a light stone, two tones) and its grass (two greens, mown in squares). */
const PAVE_LIGHT = [222, 214, 198] as const;
const PAVE_DARK = [203, 194, 177] as const;
const GRASS_LIGHT = [128, 184, 84] as const;
const GRASS_DARK = [113, 170, 74] as const;
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
/** A square's color key: its step toward the sky, its ground (0 board, 1 board under a home, 2 paving, 3 grass), light or dark. */
const sqKeyOf = (mix: number, ground: number, alt: number) => (mix * GROUNDS + ground) * 2 + alt;
function groundColors(skyh: readonly number[]): GroundColors {
  const fill: string[] = [];
  const seam: string[] = [];
  for (let i = 0; i <= MIX_STEPS; i++)
    for (let g = 0; g < GROUNDS; g++)
      for (let alt = 0; alt < 2; alt++) {
        let base: readonly number[] = g === 2 ? (alt ? PAVE_DARK : PAVE_LIGHT) : g === 3 ? (alt ? GRASS_DARK : GRASS_LIGHT) : alt ? SQ_DARK : SQ_LIGHT;
        if (g === 1) base = base.map((x) => x * 0.9); // a faint darker tint under a home (and the Colosseum)
        const t = i / MIX_STEPS;
        const f = mix(base, skyh, t);
        const k = sqKeyOf(i, g, alt);
        fill[k] = rgb(f);
        // The seam fades out too; the grass's is faint (a lawn, not tiles), the paving's a little stronger (its slabs).
        const d = g === 3 ? 0.95 : g === 2 ? 0.84 : 0.86;
        seam[k] = rgb(f.map((x) => x * (d + (1 - d) * t)));
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
  kind: "house" | "boss" | "person" | "prop";
  i: number;
  dx: number;
  dz: number;
  /** Its depth for the drawing order (the park's things a little behind whoever stands on their row: a stool's sitter). */
  sz: number;
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
const newItem = (kind: Item["kind"], i: number): Item => ({ kind, i, dx: 0, dz: 0, sz: 0, on: false, depth: 0, x0: 0, y0: 0, x1: 0, y1: 0, fx: 0, fy: 0, hy: 0, faded: false });

/** An edge chip this frame: which place (a home, or the Colosseum), where on the box's edge, which way its arrow points (degrees). */
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
  | { kind: "table"; table: Table }
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

/** A quote's lettering: its lines in `s` device pixels a font pixel, `lead` font pixels apart, over their edge (e pixels down and right). */
function quoteArt(id: StatueId, lines: string[], s: number, e: number, lead: number): QuoteArt {
  const lh = lines.length * CAP + (lines.length - 1) * lead;
  const lw = Math.max(...lines.map(lineWidth));
  const ink = QUOTE_INK[id];
  const cv = document.createElement("canvas");
  cv.width = lw * s + e;
  cv.height = lh * s + e;
  const g = cv.getContext("2d")!;
  g.drawImage(renderLines(lines, lw, lh, s, ink.edge, lead), e, e);
  g.drawImage(renderLines(lines, lw, lh, s, ink.ink, lead), 0, 0);
  return { cv, s, n: lines.length, pitch: (CAP + lead) * s, lineH: CAP * s + e };
}

/**
 * A picture's lights (Oct 27), made once, the first time it's drawn lit: a small canvas for each of its lights (its lit
 * pixels, the glow spilling round them, its halo) and for each pool of light on the ground, at the picture's own pixels,
 * in pixel-art bands (feel.ts: `lightSpill`, `lightHalo`, `lightPool`), so they're drawn like the picture they sit on,
 * each only as big as it needs (the light layer is touched only there); and which of its pixels are lit (the tests find
 * a lit window by it). Each canvas holds the light to add, laid on with "lighter".
 */
/** A light layer: its canvas (the world's size), and which of its tiles (`lightTilePx` square, nx across, ny down) a light touched. */
interface LightLayer {
  cv: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  tiles: Uint8Array;
  nx: number;
  ny: number;
}
interface GlowPiece {
  cv: HTMLCanvasElement;
  /** Its top left, in the picture's pixels. */
  x: number;
  y: number;
  flicker: boolean;
}
interface Glow {
  pieces: GlowPiece[];
  lit: Uint8Array;
}
const rgbOf = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const;
const bandAt = (bands: readonly (readonly [number, number])[], d: number) => {
  for (const [to, a] of bands) if (d <= to) return a;
  return 0;
};
type AddLight = (x: number, y: number, rgb: readonly number[], a: number) => void;
function bakeGlow(ch: Character, spots: readonly LightSpot[], pools: readonly LightPool[]): Glow {
  const f = TOWN_FEEL;
  const spill = Math.ceil(f.lightSpill[f.lightSpill.length - 1]![0]);
  const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
  const lit = new Uint8Array(ch.w * ch.h);
  const pieces: GlowPiece[] = [];
  /** A piece over (x0, y0, w, h), in the picture's pixels: `fill` adds its light, pixel by pixel (r, g, b, premultiplied). */
  const piece = (x0: number, y0: number, w: number, h: number, flicker: boolean, fill: (add: AddLight) => void) => {
    const A = new Float32Array(w * h * 3);
    let any = false;
    fill((x, y, rgb, a) => {
      const X = x - x0;
      const Y = y - y0;
      if (a <= 0 || X < 0 || Y < 0 || X >= w || Y >= h) return;
      const o = (Y * w + X) * 3;
      A[o] = A[o]! + rgb[0]! * a;
      A[o + 1] = A[o + 1]! + rgb[1]! * a;
      A[o + 2] = A[o + 2]! + rgb[2]! * a;
      any = true;
    });
    if (!any) return;
    const img = new ImageData(w, h);
    const d = img.data;
    for (let i = 0; i < w * h; i++) {
      const a = Math.min(255, Math.max(A[i * 3]!, A[i * 3 + 1]!, A[i * 3 + 2]!));
      if (a <= 0) continue;
      d[i * 4] = Math.min(255, (A[i * 3]! * 255) / a);
      d[i * 4 + 1] = Math.min(255, (A[i * 3 + 1]! * 255) / a);
      d[i * 4 + 2] = Math.min(255, (A[i * 3 + 2]! * 255) / a);
      d[i * 4 + 3] = a;
    }
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    cv.getContext("2d")!.putImageData(img, 0, 0);
    pieces.push({ cv, x: x0, y: y0, flicker });
  };
  for (const s of spots) {
    const rgb = rgbOf(s.color);
    // Its pixels (its keys in its box).
    const m = new Uint8Array(s.w * s.h);
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const k = keys[s.y + y]?.[s.x + x];
        if (!k || (s.keys !== undefined && !s.keys.includes(k))) continue;
        m[y * s.w + x] = 1;
        lit[(s.y + y) * ch.w + s.x + x] = 1;
      }
    const isLit = (x: number, y: number) => x >= s.x && y >= s.y && x < s.x + s.w && y < s.y + s.h && m[(y - s.y) * s.w + x - s.x] === 1;
    const halo = s.halo ?? 0;
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const x0 = Math.min(s.x - spill, Math.floor(cx - halo));
    const y0 = Math.min(s.y - spill, Math.floor(cy - halo));
    const x1 = Math.max(s.x + s.w + spill, Math.ceil(cx + halo) + 1);
    const y1 = Math.max(s.y + s.h + spill, Math.ceil(cy + halo) + 1);
    piece(x0, y0, x1 - x0, y1 - y0, !!s.flicker, (add) => {
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          // Its lit pixels warm and bright; round them, the glow spilling, by how far the nearest lit one is; and its
          // halo in the air (a lantern's, a lamp's), round its box's middle.
          if (isLit(x, y)) {
            add(x, y, rgb, s.strength);
            continue;
          }
          let d2 = Infinity;
          for (let v = y - spill; v <= y + spill; v++) for (let u = x - spill; u <= x + spill; u++) if (isLit(u, v)) d2 = Math.min(d2, (u - x) ** 2 + (v - y) ** 2);
          if (d2 < Infinity) add(x, y, rgb, s.strength * bandAt(f.lightSpill, Math.sqrt(d2)));
          if (halo) add(x, y, rgb, s.strength * bandAt(f.lightHalo, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / halo));
        }
    });
  }
  for (const p of pools) {
    const rgb = rgbOf(p.color);
    const x0 = Math.floor(p.x - p.rx);
    const y0 = Math.floor(p.y - p.ry);
    const x1 = Math.ceil(p.x + p.rx) + 1;
    const y1 = Math.ceil(p.y + p.ry) + 1;
    piece(x0, y0, x1 - x0, y1 - y0, false, (add) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) add(x, y, rgb, p.strength * bandAt(f.lightPool, Math.hypot((x + 0.5 - p.x) / p.rx, (y + 0.5 - p.y) / p.ry)));
    });
  }
  return { pieces, lit };
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

/** A piece on a table's board: its square (f: rank from white's side, g: file), where it slid from, when, and when it's gone. */
interface TablePiece {
  f: number;
  g: number;
  light: boolean;
  kind: string;
  fx: number;
  fg: number;
  t0: number;
  gone: number;
}
/** A table's pieces as a game starts: white's on its two ranks, black's on theirs, the back ranks' shapes from the a-file. */
function setUp(): TablePiece[] {
  const pcs: TablePiece[] = [];
  for (let g = 0; g < 8; g++) {
    const kind = TABLE_BACK_RANK[g]!;
    for (const [f, light, k] of [[0, true, kind], [1, true, "P"], [7, false, kind], [6, false, "P"]] as const) pcs.push({ f, g, light, kind: k, fx: f, fg: g, t0: 0, gone: 0 });
  }
  return pcs;
}

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
  /** Every place the town names: the homes (in the bosses' order), then the Colosseum. */
  private readonly places: readonly Place[];
  /** The places' items, by place (the items themselves are sorted every frame). */
  private readonly houseItems: Item[];
  private readonly bossFrames: FrameCache[];
  private readonly houseFrames: FrameCache[];
  private readonly chipIcon: FrameCache;
  /** The park's things' items, and their pictures (one cache a kind, each tree's own). */
  private readonly propItems: Item[];
  private readonly propFrames: FrameCache[];
  private readonly propTop: number[];
  /** This person sits at a chess table (drawn lower, on its stool). */
  private sitting = false;
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
  /** Each bot's dressed pawn (its crate items, drawn once when the page opens: Town.tsx), by person id; none: plain. */
  readonly botArt = new Map<string, YouArt>();
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
  /**
   * The lights at dusk and night (Oct 27): how strongly they shine now (0: off; nothing is made or drawn for them); each
   * place's and the lamp's (made the first time each is drawn lit); and the light layer: the lights of this frame added
   * up, far to near, each thing drawn in front of a light cutting its shape out of it, laid on the world after its tint
   * with "lighter", tile by tile (only the tiles a light touched), and cleared when its turn comes again.
   */
  private lightK = 0;
  private readonly placeGlow: (Glow | null)[];
  private lampGlow: Glow | null = null;
  /** Two light layers, used in turn (one is laid on the world while the other is cleared and drawn: no copying). */
  private readonly layers: LightLayer[] = [];
  private layer: LightLayer | null = null;
  /** This frame's lights' boxes on the screen (x0, y0, x1, y1 each): what's drawn later over one cuts into it. */
  private readonly litBox = new Float32Array(4 * 128);
  private nLit = 0;

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
    this.propItems = PROPS.map((_, i) => newItem("prop", i));
    this.items = [...this.houseItems, ...this.bossItems, ...this.propItems];
    const trees = PARK_TREES.map((t) => new FrameCache(t));
    const bench = new FrameCache(PARK_BENCH);
    const table = new FrameCache(PARK_TABLE);
    const fountain = new FrameCache(PARK_FOUNTAIN);
    const lamp = new FrameCache(PARK_LAMP);
    this.propFrames = PROPS.map((p) => (p.kind === "tree" ? trees[p.v]! : p.kind === "bench" ? bench : p.kind === "table" ? table : p.kind === "lamp" ? lamp : fountain));
    this.propTop = PROPS.map(() => 0);
    this.bossFrames = town.bosses.map((b) => new FrameCache(BOSS_ART[b.home.id]));
    this.houseFrames = this.places.map((h) => new FrameCache(artOf(h).ch));
    this.placeGlow = this.places.map(() => null);
    this.chipIcon = new FrameCache(COLISEUM_CHIP);
    this.statueImg = STATUES.map((st) => canvasOf(statueArt(st.id, 1), this.statueMask));
    // Each square is kept this frame (its corners, its face's corners, its color) and drawn with all the others of its
    // color in one fill (drawGround): a few dozen fills a frame instead of two per square.
    this.drawSquare = (c, r, cu, ru, q) => {
      const n = this.nSq;
      if (n >= SQ_MAX) return;
      const m = Math.round(clamp(hazeMix(this.view, cu - this.camX, ru - this.camY, this.mist), 0, 1) * MIX_STEPS);
      const gk = groundAt[r * N + c]!;
      this.sqKey[n] = sqKeyOf(m, gk === PAVING ? 2 : gk === GRASS ? 3 : plotAt[r * N + c] || onColiseum(c, r) ? 1 : 0, (c + r) & 1);
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
    this.lightK = mixLights(w);
  }

  /** Draws one frame. `zoom`: 0 normal, 1 zoomed out (and between, while it glides); `dt`: seconds since the last. */
  /** Frames drawn so far (what's worked out once a frame keys on it). */
  private frameNo = 0;
  draw(now: number, camX: number, camY: number, zoom: number, dt = 0): void {
    const { ctx, W, H, DPR } = this;
    this.frameNo++;
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
    const lit = this.beginLights();
    this.drawThings(now);
    // The light of the hour over the world and everything on it: one fill (none by day).
    if (this.tint) {
      ctx.fillStyle = this.tint;
      ctx.fillRect(0, 0, W, H);
    }
    // The lights at dusk and night, over the tint, so they really glow (under the tags, the names and the bubble).
    if (lit) this.layLights();
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
   * box from `closeTop` to `closeBottom`, in its middle; where that would reach the buttons, round them whichever way
   * lets it be bigger (above them, or beside them, moved off the middle). A longer lens the further the glide has come
   * (M to the power e, so the zoom's pace is even), the statue's middle gliding to its place.
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
    let X = W / 2; // where its middle ends up
    const kc = this.keepClear;
    if (kc.w > 0 && X + (M * w) / 2 > kc.x - f.closeBesideButtons && X - (M * w) / 2 < kc.x + kc.w && B > kc.y - f.closeAboveButtons) {
      const above = Math.min((kc.y - f.closeAboveButtons - T) / h, (W * f.closeMaxWidth) / w);
      const beside = Math.min((B - T) / h, (kc.x - f.closeBesideButtons - f.closeSide) / w);
      if (beside > above) {
        M = beside;
        X = Math.min(X, kc.x - f.closeBesideButtons - (M * w) / 2);
      } else ((M = above), (B = kc.y - f.closeAboveButtons));
    }
    M = Math.max(1, M);
    const mag = Math.pow(M, c.e);
    const c1 = y0 + h / 2;
    const cE = c1 + ((T + B) / 2 - c1) * c.e;
    const x1 = x0 + w / 2;
    const xE = x1 + (X - x1) * c.e;
    setView(v, W, H, zoom, mag, cE - v.cy - mag * (c1 - v.cy), xE - W / 2 - mag * (x1 - W / 2));
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
   * The statues over the Colosseum's picture (x0, y0 its top left, `px` screen pixels a picture pixel): the world's figure,
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
   * A statue's quote on its pedestal's panel, written at the screen's own resolution once the camera has arrived: in the
   * signs' pixel capitals as big as fits in whole device pixels (wrapped to the panel), engraved in the marble or cast in
   * the bronze plaque. The panel's squiggles fade under its flat field as the first line comes; then line by line, each
   * fading in; all fading as you leave.
   */
  private drawQuote(i: number, sx: number, sy: number, px: number, alpha: number): void {
    const { ctx, DPR, close: c } = this;
    const f = TOWN_FEEL;
    const id = STATUES[i]!.id;
    const face = quoteFace(id);
    const fx = sx + face.x * px;
    const fy = sy + face.y * px;
    const fw = face.w * px;
    const fh = face.h * px;
    const m = f.quoteInset * px;
    const q = this.quoteFor(i, (fw - 2 * m) * DPR, (fh - 2 * m) * DPR);
    if (!q) return;
    this.quoteCap = (q.s / DPR) * CAP;
    const a0 = clamp(c.quoteMs / f.quoteFadeMs, 0, 1) * c.quoteLeft;
    if (a0 <= 0) return;
    ctx.globalAlpha = alpha * a0;
    ctx.fillStyle = QUOTE_INK[id].field;
    const e = 0.25 * px; // (inside the field: its rim stays as drawn)
    ctx.fillRect(fx + e, fy + e, fw - 2 * e, fh - 2 * e);
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

  /**
   * The quote's lettering for a panel fw x fh device pixels: the biggest whole size whose wrapped lines fit (with the
   * signs' leading, or a pixel less where that lets it be bigger); cached.
   */
  private quoteFor(i: number, fw: number, fh: number): QuoteArt | null {
    const st = STATUES[i]!;
    for (let s = Math.floor(fh / CAP); s >= 1; s--) {
      const e = Math.max(1, Math.round(s / 3)); // the lettering's lit (or shadowed) edge, down and right
      for (const lead of [LEADING, LEADING - 1]) {
        const key = `${i}:${s}:${lead}`;
        let art = this.quoteArt.get(key) ?? null;
        if (!art) {
          const lines = wrapQuote(st.quote, (fw - e) / s);
          if (!lines) continue;
          if ((lines.length * CAP + (lines.length - 1) * lead) * s + e > fh) continue;
          this.quoteArt.set(key, (art = quoteArt(st.id, lines, s, e, lead)));
        }
        if (art.cv.width <= fw && art.cv.height <= fh) return art;
      }
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
    // The chat log's box (chat.ts), always: shown or faded, wherever it has been put, so a chip never jumps when it comes or goes.
    const cb = CHAT_BOX;
    if (cb.w > 0 && x + r > cb.x && x - r < cb.x + cb.w && y + r > cb.y && y - r < cb.y + cb.h) return true;
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
        // (The Colosseum is wide and tall: its sides and top show while its foot is off to the side or well under the box.)
        margin = Math.max(h.half + 1, this.houseFrames[it.i]!.ch.w / 2 / f.housePxPerSquare + 0.5);
        below = h.half > 2 ? 10 : below;
      } else if (it.kind === "prop") {
        const pr = PROPS[it.i]!;
        x = pr.x;
        y = pr.y;
        margin = 2;
      } else {
        const w = it.kind === "boss" ? town.bosses[it.i]!.walker : people[it.i]!.walker;
        w.pose(now, pose);
        x = pose.x;
        y = pose.y;
        if (it.kind === "boss") margin = 2;
      }
      it.dx = wrapF(x - this.camX);
      it.dz = wrapF(y - this.camY);
      it.sz = it.kind === "prop" ? it.dz + 0.05 : it.dz;
      it.on = drawable(v, it.dx, it.dz, margin, below);
    }
    items.sort(byFarFirst);
    for (const b of town.bosses) b.onScreen = false;
    for (const b of this.statueBox) b.on = false;
    for (const nm of this.names) nm.a = 0;
    // The Colosseum past the rim, its top over the horizon (slice 6: the landmark from anywhere), behind everything.
    const col = this.houseItems[this.homes.length]!;
    this.farOn = false;
    if (!col.on) this.drawFarColiseum(col, now);
    for (const it of items) {
      if (!it.on) continue;
      if (it.kind === "house") this.drawHouse(it, now);
      else if (it.kind === "prop") this.drawProp(it, now);
      else if (it.kind === "boss") {
        const b = town.bosses[it.i]!;
        const ch = BOSS_ART[b.home.id];
        const img = this.bossFrames[it.i]!.at(now, it.i * 977);
        b.walker.pose(now, pose);
        this.drawSprite(it, img, f.bossSquares * (f.bossScale[b.home.id] ?? 1), ch.foot[0] / ch.w, ch.foot[1] / ch.h, ch.w / ch.h, 0, 0, b.walker.facing, 1.6);
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
        // Sitting at a chess table: lower, on its stool, facing the board.
        const table = seated(person);
        this.sitting = !!table;
        const facing = table ? (w.c < table.c ? 1 : -1) : w.facing;
        // Up close on a statue, the people in front of it (you, on its square) fade: they'd stand between the camera and it.
        this.fade = it.dz < this.statueDz ? 1 - f.closeNearFade * this.close.e : 1;
        it.faded = this.fade < 0.5;
        if (person.you) {
          // Your shadows are a bot's: sized from the pawn, not from the margin your look's items are drawn in.
          const art = this.youArt;
          const k = 1 + 2 * (art?.pad ?? 0);
          const pad = art?.pad ?? 0;
          this.drawSprite(it, art?.img ?? pawnImage(person.look.side, person.look.tint), f.youSquares * k, 0.5, (pad + PAWN_FOOT) / k, 1, pose.hop * f.youHop, pose.tilt * f.hobbleTilt, facing, 1, Math.min(art?.top ?? 1, (pad + PAWN_HEAD) / k), true, 1 / k, f.youSquares);
          if (this.fade > 0.02) this.tag(person.name, it.fx, it.hy - 2, true, clamp((11 * this.p.k) / v.kf, 8, 12), this.fade);
        } else {
          // A bot's dressed pawn (its one or two crate items, made once), drawn as yours is.
          const art = this.botArt.get(person.id);
          const k = 1 + 2 * (art?.pad ?? 0);
          const pad = art?.pad ?? 0;
          this.drawSprite(it, art?.img ?? pawnImage(person.look.side, person.look.tint), f.botSquares * k, 0.5, (pad + PAWN_FOOT) / k, 1, pose.hop * f.botHop, pose.tilt * f.hobbleTilt, facing, 1, Math.min(art?.top ?? 1, (pad + PAWN_HEAD) / k), true, 1 / k, f.botSquares);
          // Name tags on the near ones only.
          const far = farOf(v, it.dz);
          if (far < f.tagFar && this.fade > 0.02) this.tag(person.name, it.fx, it.hy - 2, false, clamp((11 * this.p.k) / v.kf, 8, 12), clamp((f.tagFar - far) / 0.12, 0, 1) * this.fade);
        }
        this.fade = 1;
        this.sitting = false;
      }
    }
  }

  /**
   * The Colosseum seen from afar (slice 6): when its foot is past the rim, but not more than `farReach` squares past it, its
   * picture stands on the horizon where it lies, smaller with distance, sunk behind the world's curve (`farSink` squares
   * a square past the rim), hazed like the far band. Only its top shows over the horizon, so it looms from across the
   * world. It isn't tapped (its chip is), and it has no floating name.
   */
  private drawFarColiseum(it: Item, now: number): void {
    const { ctx, view: v, p } = this;
    const f = TOWN_FEEL;
    const R = radial(v, it.dx, it.dz);
    if (it.dz <= 0 || R <= v.rim || R > v.rim + f.farReach || v.rimN < 2) return;
    const t = (v.rim - 0.05) / R;
    if (!proj(v, it.dx * t, it.dz * t, 0, p)) return;
    const k = p.k * (v.rim / R);
    const px = k / f.housePxPerSquare;
    const ch = artOf(this.places[it.i]!).ch;
    const w = ch.w * px;
    const h = ch.h * px;
    const x0 = p.x - ch.foot[0] * px;
    if (x0 > this.W || x0 + w < 0) return;
    const y0 = p.y + (R - v.rim) * f.farSink * k - ch.foot[1] * px;
    if (y0 > p.y) return; // (all of it behind the curve)
    // Only above the horizon: the world's curve hides the rest.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(v.rimPx[0]!, -10);
    for (let i = 0; i < v.rimN; i++) ctx.lineTo(v.rimPx[i]!, v.rimPy[i]!);
    ctx.lineTo(v.rimPx[v.rimN - 1]!, -10);
    ctx.closePath();
    ctx.clip();
    // Fading in as it comes within reach, and as hazy as the far band.
    ctx.globalAlpha = (1 - f.bandFade * f.farHaze) * clamp((v.rim + f.farReach - R) / 2, 0, 1);
    this.blitSoft(this.houseFrames[it.i]!.at(now, it.i * 613), x0, y0, w, h, f.farHaze, 0.88 * f.farHaze);
    ctx.restore();
    this.farOn = true;
  }
  /** The Colosseum was drawn from afar this frame (so its chip isn't shown: it's in view). */
  private farOn = false;

  /** One of the park's things: its picture at the camera's scale (the fountain's water moving). */
  private drawProp(it: Item, now: number): void {
    const { ctx, view: v, p } = this;
    if (!proj(v, it.dx, it.dz, 0, p)) return;
    const fc = this.propFrames[it.i]!;
    const ch = fc.ch;
    const px = p.k / TOWN_FEEL.housePxPerSquare;
    const w = ch.w * px;
    const h = ch.h * px;
    const x0 = p.x - ch.foot[0] * px;
    const y0 = p.y - ch.foot[1] * px;
    const s = bandOf(v, it.dx, it.dz);
    const alpha = (1 - 0.6 * s) * enterOf(v, it.dx, it.dz);
    const img = fc.at(now, it.i * 211);
    const prop = PROPS[it.i]!;
    // A table waiting for a game: the ring under its free stool, on the ground under the picture.
    const ts = prop.kind === "table" ? this.tableAt(prop.table) : null;
    if (ts?.kind === "waiting") this.drawRing(it, ts.free, now, alpha * (1 - 0.88 * s));
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = px < 1.5;
    if (s > 0.02) this.blitSoft(img, x0, y0, w, h, s, 0.88 * s);
    else ctx.drawImage(img, x0, y0, w, h);
    ctx.globalAlpha = 1;
    this.cover(img, x0, y0, w, h, alpha);
    // A lamp, lit at dusk and night (fading and hazing in the far band as its picture does).
    if (this.lightK > 0.01 && PROPS[it.i]!.kind === "lamp") this.lightUp((this.lampGlow ??= bakeGlow(PARK_LAMP, PARK_LAMP_LIGHTS, PARK_LAMP_POOLS)), x0, y0, px, alpha * (1 - 0.88 * s), now, it.i * 389);
    this.propTop[it.i] = p.y - (PROPS[it.i]!.kind === "table" ? TABLE_TOP * px : ch.foot[1] * px);
    this.box(it, p.depth, x0, y0, x0 + w, y0 + h, p.x, p.y, y0);
    if (prop.kind === "table") this.drawBoard(it, prop.table, ts!, now, alpha * (1 - 0.88 * s), s);
  }

  // ---- The chess tables' boards (Oct 27; Eric: "even tiny little pieces that look like pieces … facing the right way …
  // random moves back and forth … pieces disappearing … every 7 or 8 moves, it just resets"). Each table's top is a flat
  // slab drawn through the camera with its board, its pieces standing on it, and over a game its clock. Who sits decides
  // what it shows (`tableStates`): two playing, its pieces move and its clock runs; one waiting, a ring under the free stool;
  // otherwise its pieces stand set up. The moves are look only: white and black in turn, a step or three forward each.
  private tables: TableState[] = [];
  private tablesAt = -1;
  private games: ({ pcs: TablePiece[]; moves: number; next: number; since: number } | null)[] = [];
  private pieceImgs = new Map<string, HTMLCanvasElement>();
  private clockImgs = new Map<string, HTMLCanvasElement>();
  private bp = newPt();
  private bq = newPt();
  private grid = Array.from({ length: 81 }, () => newPt());

  /** Table `i`'s state this frame (worked out once a frame, from the people sitting). */
  private tableAt(i: number): TableState {
    if (this.tablesAt !== this.frameNo) {
      this.tables = tableStates(this.town.people);
      this.tablesAt = this.frameNo;
    }
    return this.tables[i] ?? { kind: "still" };
  }

  /** Table `ti`'s game now: started when its two players sat down, gone when they get up. */
  private gameFor(ti: number, playing: boolean, now: number) {
    const f = TOWN_FEEL;
    let game = this.games[ti] ?? null;
    if (!playing) return (this.games[ti] = null);
    if (!game) this.games[ti] = game = { pcs: setUp(), moves: 0, next: now + f.tableMoveMs, since: now };
    if (now < game.next) return game;
    if (game.moves >= f.tableMoves) {
      game.pcs = setUp();
      game.moves = 0;
      game.next = now + f.tableResetMs;
      return game;
    }
    const light = game.moves % 2 === 0;
    const dir = light ? 1 : -1;
    const mine = game.pcs.filter((q) => q.light === light && !q.gone);
    for (let tries = 0; tries < 40 && mine.length; tries++) {
      const q = mine[Math.floor(Math.random() * mine.length)]!;
      const f2 = q.f + dir * (1 + Math.floor(Math.random() * 3));
      const g = q.g + Math.floor(Math.random() * 3) - 1;
      if (f2 < 0 || f2 > 7 || g < 0 || g > 7) continue;
      const there = game.pcs.find((o) => !o.gone && o.f === f2 && o.g === g);
      if (there?.light === light) continue;
      if (there) there.gone = now + f.tableTakeMs;
      q.fx = q.f;
      q.fg = q.g;
      q.f = f2;
      q.g = g;
      q.t0 = now;
      break;
    }
    game.moves++;
    game.next = now + f.tableMoveMs;
    return game;
  }

  /** A piece in pixels (TABLE_PIECES: its fill shaded on the right, an outline round it), made once. */
  private pieceImg(kind: string, light: boolean): HTMLCanvasElement {
    const key = kind + (light ? "l" : "d");
    let c = this.pieceImgs.get(key);
    if (c) return c;
    let rows = TABLE_PIECES[kind]!;
    if (!light && kind === "N") rows = rows.map((r) => [...r].reverse().join("")); // black's knight faces white
    const w = rows[0]!.length + 2;
    const h = rows.length + 2;
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    const ink = TABLE_INK;
    const fill = (x: number, y: number) => rows[y - 1]?.[x - 1] === "#";
    const inside = (x: number, y: number) => fill(x, y) || rows[y - 1]?.[x - 1] === "x";
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let col: string | null = null;
        if (fill(x, y)) col = light ? (fill(x + 1, y) ? ink.light : ink.lightShade) : fill(x - 1, y) ? ink.dark : ink.darkShade;
        else if (inside(x, y) || inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) col = light ? ink.lightLine : ink.darkLine;
        if (col) {
          g.fillStyle = col;
          g.fillRect(x, y, 1, 1);
        }
      }
    this.pieceImgs.set(key, c);
    return c;
  }

  /** The clock's face for `text` (TABLE_DIGITS: black digits, their top edge lighter, a grey side under), made once. */
  private clockImg(text: string): HTMLCanvasElement {
    let c = this.clockImgs.get(text);
    if (c) return c;
    const glyphs = [...text].map((ch) => TABLE_DIGITS[ch]!);
    c = document.createElement("canvas");
    c.width = glyphs.reduce((n, gl) => n + gl[0]!.length + 1, 0) + 1;
    c.height = 7;
    const g = c.getContext("2d")!;
    const ink = TABLE_CLOCK_INK;
    // The side first (a pixel under each lit one), then the face over it.
    for (const side of [true, false]) {
      let x = 0;
      for (const gl of glyphs) {
        gl.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            if (row[i] !== "#") continue;
            g.fillStyle = side ? ink.side : j === 0 || gl[j - 1]![i] !== "#" ? ink.edge : ink.face;
            g.fillRect(x + i, j + (side ? 1 : 0), 1, 1);
          }
        });
        x += gl[0]!.length + 1;
      }
    }
    // (A minute's worth of faces at most: the old ones go.)
    if (this.clockImgs.size > 64) this.clockImgs.clear();
    this.clockImgs.set(text, c);
    return c;
  }

  /** The soft green ring on the ground under a waiting table's free stool (`free`: its index, west 0, east 1). */
  private drawRing(it: Item, free: 0 | 1, now: number, alpha: number): void {
    const { ctx, view: v } = this;
    const f = TOWN_FEEL;
    const a = this.bp;
    const pulse = 0.75 + 0.25 * Math.sin(now / f.tableRingPulseMs);
    const sx = it.dx + (free === 0 ? -1 : 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let n = 0; n <= 32; n++) {
      const an = (n / 32) * Math.PI * 2;
      if (!proj(v, sx + f.tableRingR * Math.cos(an), it.dz + f.tableRingR * Math.sin(an), 0, a)) {
        ctx.restore();
        return;
      }
      if (n === 0) ctx.moveTo(a.x, a.y);
      else ctx.lineTo(a.x, a.y);
    }
    ctx.closePath();
    const [fr, fg, fb] = TABLE_RING.fill;
    const [er, eg, eb] = TABLE_RING.edge;
    ctx.fillStyle = `rgba(${fr}, ${fg}, ${fb}, ${0.22 * pulse})`;
    ctx.fill();
    ctx.shadowColor = TABLE_RING.glow;
    ctx.shadowBlur = 0.25 * a.k;
    ctx.lineWidth = Math.max(1.5, 0.05 * a.k);
    ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, ${0.85 * pulse})`;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Table `ti`'s top: the slab (its front face, its stone top), the board's 8 x 8 squares lying flat (two fills over one
   * 9 x 9 grid of points), its pieces standing up (far ones first), and over a game its clock. `s`: how far into the far
   * band it stands (its pieces and clock are left out far off). While nothing on it moves and the camera holds still, the
   * slab, board and pieces are one picture, made on the second frame alike and reused (`boardCache`): one draw a frame.
   */
  private drawBoard(it: Item, ti: number, state: TableState, now: number, alpha: number, s: number): void {
    const { ctx, view: v } = this;
    const B = TABLE_BOARD;
    const a = this.bp;
    const b = this.bq;
    if (!proj(v, it.dx, it.dz, 0, a) || !proj(v, it.dx, it.dz, 1, b)) return;
    // The top's height in the camera's lift: the picture's pixels over its foot, through its scale.
    const perLift = a.y - b.y;
    const spx = a.k / TOWN_FEEL.housePxPerSquare;
    const top = (B.top * spx) / perLift;
    const thick = (B.thick * spx) / perLift;
    // The world's pictures stand like cut-outs (no lean): the top stays straight over its leg.
    const footX = a.x;
    if (!proj(v, it.dx, it.dz, top, b)) return;
    const shift = b.x - footX;
    const hb = B.board;
    const sq = (2 * hb) / 8;
    for (let gi = 0; gi < 9; gi++)
      for (let fi = 0; fi < 9; fi++) if (!proj(v, it.dx - hb + fi * sq, it.dz - hb + gi * sq, top, this.grid[gi * 9 + fi]!)) return;
    const near = s <= TOWN_FEEL.tableFarCut;
    const game = near ? this.gameFor(ti, state.kind === "playing", now) : null;
    const pcs = near ? (game?.pcs ?? (this.stillSet ??= setUp())) : [];
    const f = TOWN_FEEL;
    const moving = !!game && pcs.some((q) => now - q.t0 < f.tableSlideMs || (q.gone > 0 && now < q.gone));
    const paint = (g: CanvasRenderingContext2D) => this.paintBoard(g, it, top, thick, shift, pcs, game ? now : -1);
    // The same picture as the last frame (camera, alpha and pieces alike): once seen twice, it's kept and reused.
    const c0 = this.grid[0]!;
    const c8 = this.grid[80]!;
    const key = `${Math.round(c0.x * 8)},${Math.round(c0.y * 8)},${Math.round(c8.x * 8)},${Math.round(c8.y * 8)},${Math.round(shift * 8)},${pcs.length},${game?.moves ?? -1},${game ? game.since : 0},${this.DPR}`;
    const cache = (this.boardCache[ti] ??= { key: "", seen: "", cv: null, x: 0, y: 0, w: 0, h: 0 });
    ctx.globalAlpha = alpha;
    if (moving || key !== cache.seen) {
      cache.seen = moving ? "" : key;
      cache.key = "";
      paint(ctx);
    } else {
      if (cache.key !== key) this.cacheBoard(cache, key, it, top, thick, shift, b.k * B.piecePx, paint);
      if (cache.cv) ctx.drawImage(cache.cv, cache.x, cache.y, cache.w, cache.h);
      else paint(ctx);
    }
    // The game's clock, floating over the middle of the board, straight above the leg.
    if (game && proj(v, it.dx, it.dz, top + B.clockLift, a)) {
      const secs = Math.floor((now - game.since) / 1000);
      const img = this.clockImg(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
      const ps = a.k * B.clockPx;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, footX - (img.width * ps) / 2, a.y - img.height * ps, img.width * ps, img.height * ps);
    }
    ctx.globalAlpha = 1;
  }
  private stillSet: TablePiece[] | null = null;
  private boardCache: { key: string; seen: string; cv: HTMLCanvasElement | null; x: number; y: number; w: number; h: number }[] = [];

  /** Paints table's slab, board and pieces into `cache` (its box: the slab's corners and the tallest piece over them). */
  private cacheBoard(cache: (typeof this.boardCache)[number], key: string, it: Item, top: number, thick: number, shift: number, ps: number, paint: (g: CanvasRenderingContext2D) => void): void {
    const { view: v, DPR } = this;
    const a = this.bp;
    const h = TABLE_BOARD.half;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, z, l] of [[-h, -h, top], [h, -h, top], [h, h, top], [-h, h, top], [-h, -h, top - thick], [h, -h, top - thick]] as const) {
      if (!proj(v, it.dx + x, it.dz + z, l, a)) return void (cache.cv = null);
      x0 = Math.min(x0, a.x - shift);
      x1 = Math.max(x1, a.x - shift);
      y0 = Math.min(y0, a.y);
      y1 = Math.max(y1, a.y);
    }
    // (The tallest piece, the king, stands 13 of its pixels over its square.)
    const m = 13 * ps + 2;
    x0 = Math.floor((x0 - 2) * DPR) / DPR;
    y0 = Math.floor((y0 - m) * DPR) / DPR;
    const w = Math.ceil((x1 + 2 - x0) * DPR);
    const hh = Math.ceil((y1 + 2 - y0) * DPR);
    if (w <= 0 || hh <= 0 || w * hh > 4_000_000) return void (cache.cv = null);
    const cv = cache.cv ?? document.createElement("canvas");
    if (cv.width !== w || cv.height !== hh) {
      cv.width = w;
      cv.height = hh;
    }
    const g = cv.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, hh);
    g.setTransform(DPR, 0, 0, DPR, -x0 * DPR, -y0 * DPR);
    paint(g);
    Object.assign(cache, { key, cv, x: x0, y: y0, w: w / DPR, h: hh / DPR });
  }

  /** The slab, the board and `pcs` on it, into `g` in the screen's coordinates (`now` < 0: the pieces at rest). */
  private paintBoard(g: CanvasRenderingContext2D, it: Item, top: number, thick: number, shift: number, pcs: readonly TablePiece[], now: number): void {
    const { view: v } = this;
    const B = TABLE_BOARD;
    const pal = PARK_TABLE.palette;
    const a = this.bp;
    const b = this.bq;
    const quad = (pts: readonly (readonly [number, number, number])[], fill: string) => {
      g.beginPath();
      for (let n = 0; n < pts.length; n++) {
        const [x, z, l] = pts[n]!;
        if (!proj(v, it.dx + x, it.dz + z, l, a)) return;
        if (n === 0) g.moveTo(a.x - shift, a.y);
        else g.lineTo(a.x - shift, a.y);
      }
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    };
    const h = B.half;
    const base = g.globalAlpha;
    quad([[-h, -h, top], [h, -h, top], [h, -h, top - thick], [-h, -h, top - thick]], pal["4"]!);
    quad([[-h, -h, top], [h, -h, top], [h, h, top], [-h, h, top]], pal["2"]!);
    quad([[-h, h, top], [h, h, top], [h, h - 0.03, top], [-h, h - 0.03, top]], pal["1"]!);
    // The board: the light squares in one fill and the dark in another, over the grid's points.
    for (const dark of [false, true]) {
      g.beginPath();
      for (let f = 0; f < 8; f++)
        for (let r = 0; r < 8; r++) {
          if (((f + r) % 2 === 1) !== dark) continue;
          const p0 = this.grid[r * 9 + f]!;
          const p1 = this.grid[r * 9 + f + 1]!;
          const p2 = this.grid[(r + 1) * 9 + f + 1]!;
          const p3 = this.grid[(r + 1) * 9 + f]!;
          g.moveTo(p0.x - shift, p0.y);
          g.lineTo(p1.x - shift, p1.y);
          g.lineTo(p2.x - shift, p2.y);
          g.lineTo(p3.x - shift, p3.y);
          g.closePath();
        }
      g.fillStyle = dark ? pal.D! : pal.L!;
      g.fill();
    }
    // The pieces, far ones first; a move slides with a small hop, a taken piece fades.
    const f = TOWN_FEEL;
    const hb = B.board;
    const sq = (2 * hb) / 8;
    const live = (now < 0 ? [...pcs] : pcs.filter((q) => !q.gone || now < q.gone)).sort((p1, p2) => p2.g - p1.g);
    g.imageSmoothingEnabled = false;
    for (const q of live) {
      const t = now < 0 ? 1 : clamp((now - q.t0) / f.tableSlideMs, 0, 1);
      const e = t * t * (3 - 2 * t);
      const pf = q.fx + (q.f - q.fx) * e;
      const pg = q.fg + (q.g - q.fg) * e;
      const lift = t < 1 ? f.tableHop * Math.sin(Math.PI * t) : 0;
      if (!proj(v, it.dx - hb + (pf + 0.5) * sq, it.dz - hb + (pg + 0.5) * sq, top + lift, b)) continue;
      const img = this.pieceImg(q.kind, q.light);
      const ps = b.k * B.piecePx;
      g.globalAlpha = base * (q.gone && now >= 0 ? clamp((q.gone - now) / f.tableTakeMs, 0, 1) : 1);
      g.drawImage(img, b.x - shift - (img.width * ps) / 2, b.y - (img.height - 1) * ps, img.width * ps, img.height * ps);
    }
    g.globalAlpha = base;
  }

  // ---- The lights at dusk and night (Oct 27): the park's lamps, the homes' windows and doorways, the Colosseum's torches.

  /** Readies the light layer for a frame (false: the lights are off, by day and dawn: nothing to do). */
  private beginLights(): boolean {
    this.nLit = 0;
    if (this.lightK <= 0.01) return false;
    // The layer laid on two frames ago: the world's canvas is done with it by now, so clearing it copies nothing.
    if (this.layers.length < 2) {
      const cv = document.createElement("canvas");
      this.layers.push({ cv, g: cv.getContext("2d")!, tiles: new Uint8Array(0), nx: 0, ny: 0 });
    }
    const L = (this.layer = this.layers[this.layer === this.layers[0] ? 1 : 0] ?? this.layers[0]!);
    const { canvas } = this.ctx;
    // (Sized like the world's canvas; a new size clears it.)
    if (L.cv.width !== canvas.width || L.cv.height !== canvas.height) {
      L.cv.width = canvas.width;
      L.cv.height = canvas.height;
      L.tiles.fill(0);
    }
    this.eachRun(L, this.clearRun, true);
    const T = TOWN_FEEL.lightTilePx;
    const nx = Math.ceil(this.W / T);
    const ny = Math.ceil(this.H / T);
    if (nx !== L.nx || ny !== L.ny) {
      L.tiles = new Uint8Array(nx * ny);
      L.nx = nx;
      L.ny = ny;
    }
    L.g.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    return true;
  }

  private readonly clearRun = (x: number, y: number, w: number, h: number) => this.layer!.g.clearRect(x, y, w, h);
  private readonly layRun = (x: number, y: number, w: number, h: number) => this.ctx.drawImage(this.layer!.cv, x, y, w, h, x, y, w, h);
  /** Each run of a layer's touched tiles in a row, in its device pixels (`clear`: and unmark them). */
  private eachRun(L: LightLayer, fn: (x: number, y: number, w: number, h: number) => void, clear = false): void {
    const { cv, tiles, nx, ny } = L;
    const T = TOWN_FEEL.lightTilePx * this.DPR;
    L.g.setTransform(1, 0, 0, 1, 0, 0);
    L.g.globalCompositeOperation = "source-over";
    for (let ty = 0; ty < ny; ty++) {
      const y = Math.floor(ty * T);
      const h = Math.min(cv.height, ty === ny - 1 ? cv.height : Math.floor((ty + 1) * T)) - y;
      for (let tx = 0; tx < nx; ) {
        if (!tiles[ty * nx + tx]) {
          tx++;
          continue;
        }
        const t0 = tx;
        while (tx < nx && tiles[ty * nx + tx]) {
          if (clear) tiles[ty * nx + tx] = 0;
          tx++;
        }
        const x = Math.floor(t0 * T);
        const w = Math.min(cv.width, tx === nx ? cv.width : Math.floor(tx * T)) - x;
        if (w > 0 && h > 0) fn(x, y, w, h);
      }
    }
  }

  /** A picture's lights (a place's: its index; made the first time it's drawn lit), or null when it has none. */
  private glowOf(i: number): Glow | null {
    let g = this.placeGlow[i];
    if (g === null) {
      const art = artOf(this.places[i]!);
      if (!art.lights.length && !art.pools.length) return null;
      g = this.placeGlow[i] = bakeGlow(art.ch, art.lights, art.pools);
    }
    return g ?? null;
  }

  /** The flicker of a candle's or a torch's light at `now` (1 at its brightest): two slow sways out of step, never a blink. */
  private flicker(now: number, phase: number): number {
    const f = TOWN_FEEL;
    const t = (now + phase) / f.lightFlickerMs;
    return 1 - f.lightFlicker * (0.5 + 0.3 * Math.sin(t * 2 * Math.PI) + 0.2 * Math.sin(t * 3.7 + phase));
  }

  /**
   * A picture's lights, at its place on the screen (x0, y0 its top left, `px` screen pixels a picture pixel), `a` as
   * strong as the picture shows (its fade and haze), times how strongly the lights shine now: each glow (the flickering
   * ones swaying) and its pools on the ground, at its depth (whatever is drawn after, nearer, cuts its shape out of them).
   */
  private lightUp(g: Glow | null, x0: number, y0: number, px: number, a: number, now: number, phase: number): void {
    const k = this.lightK * a;
    if (!g || k <= 0.004) return;
    const crisp = px >= 1.5;
    const fl = this.flicker(now, phase);
    for (let i = 0; i < g.pieces.length; i++) {
      const p = g.pieces[i]!;
      this.light(p.cv, x0 + p.x * px, y0 + p.y * px, p.cv.width * px, p.cv.height * px, p.flicker ? k * fl : k, crisp);
    }
  }

  /** Adds a light to the layer: `img` over (x, y, w, h) on the screen, `a` strong. */
  private light(img: HTMLCanvasElement, x: number, y: number, w: number, h: number, a: number, crisp: boolean): void {
    const L = this.layer!;
    const g = L.g;
    if (a <= 0.004 || x > this.W || y > this.H || x + w < 0 || y + h < 0) return;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = Math.min(1, a);
    g.imageSmoothingEnabled = !crisp;
    g.drawImage(img, x, y, w, h);
    if (this.nLit * 4 < this.litBox.length) {
      const b = this.litBox;
      const k = this.nLit++ * 4;
      b[k] = x;
      b[k + 1] = y;
      b[k + 2] = x + w;
      b[k + 3] = y + h;
    }
    const T = TOWN_FEEL.lightTilePx;
    const tx1 = Math.min(L.nx - 1, Math.floor((x + w) / T));
    const ty1 = Math.min(L.ny - 1, Math.floor((y + h) / T));
    for (let ty = Math.max(0, Math.floor(y / T)); ty <= ty1; ty++) for (let tx = Math.max(0, Math.floor(x / T)); tx <= tx1; tx++) L.tiles[ty * L.nx + tx] = 1;
  }

  /**
   * What was just drawn stands in front of the lights already in the layer: its shape is cut out of them where it
   * overlaps one (`a` as strong as it was drawn; flipped, tilted round (px, py) and cut off below `cut` as it was).
   */
  private cover(img: CanvasImageSource, x: number, y: number, w: number, h: number, a: number, flip = 1, tilt = 0, px = 0, py = 0, cut = Infinity): void {
    if (this.nLit === 0 || a <= 0.02) return;
    // The lights it overlaps: only their boxes are cut (the clip below), so a big picture over a small light (the
    // Colosseum over a far home's window) costs only that light's size.
    const b = this.litBox;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let k = 0; k < this.nLit * 4; k += 4)
      if (x < b[k + 2]! && x + w > b[k]! && y < b[k + 3]! && y + h > b[k + 1]!) {
        x0 = Math.min(x0, b[k]!);
        y0 = Math.min(y0, b[k + 1]!);
        x1 = Math.max(x1, b[k + 2]!);
        y1 = Math.max(y1, b[k + 3]!);
      }
    if (x0 === Infinity) return;
    const g = this.layer!.g;
    g.save();
    g.globalCompositeOperation = "destination-out";
    g.globalAlpha = Math.min(1, a);
    g.beginPath();
    g.rect(x0, y0, x1 - x0, y1 - y0);
    g.clip();
    if (cut < Infinity) {
      g.beginPath();
      g.rect(x - w, y - h, 3 * w, cut - (y - h));
      g.clip();
    }
    if (tilt) {
      g.translate(px, py);
      g.rotate((tilt * Math.PI) / 180);
      g.translate(-px, -py);
    }
    if (flip < 0) {
      g.translate(px, 0);
      g.scale(-1, 1);
      g.translate(-px, 0);
    }
    g.drawImage(img, x, y, w, h);
    g.restore();
  }

  /** Lays the light layer on the world, added onto it, tile by tile where a light touched (cleared when its turn comes again). */
  private layLights(): void {
    const { ctx, layer } = this;
    if (!layer || this.nLit === 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1;
    this.eachRun(layer, this.layRun);
    ctx.restore();
  }

  /** (Tests) Where lamp `i` (its index in LAMPS)'s glass is on the screen now; false when it isn't drawn, or something nearer stands over it. */
  lampAt(i: number, out: { x: number; y: number }): boolean {
    const l = LAMPS[i];
    const k = PROPS.findIndex((p) => p.kind === "lamp" && l !== undefined && p.c === l.c && p.r === l.r);
    const it = this.propItems[k];
    if (!it?.on) return false;
    out.x = it.x0 + (PARK_LAMP_HEAD[0] / PARK_LAMP.w) * (it.x1 - it.x0);
    out.y = it.y0 + (PARK_LAMP_HEAD[1] / PARK_LAMP.h) * (it.y1 - it.y0);
    if (!(out.x > 0 && out.x < this.W && out.y > 0 && out.y < this.H)) return false;
    for (let j = this.items.indexOf(it) + 1; j < this.items.length; j++) {
      const o = this.items[j]!;
      if (o.on && !o.faded && out.x >= o.x0 && out.x <= o.x1 && out.y >= o.y0 && out.y <= o.y1) return false;
    }
    return true;
  }

  /**
   * (Tests) A point on a place's first light (`i`: its index, the homes then the Colosseum) where it shows now: a lit
   * pixel amid lit ones, nothing standing in front of it (the nearest such to the light's middle); false if none.
   */
  lightAt(i: number, out: { x: number; y: number }): boolean {
    const it = this.houseItems[i];
    const g = this.glowOf(i);
    const s = artOf(this.places[i]!).lights[0];
    if (!it?.on || !g || !s) return false;
    const cw = this.houseFrames[i]!.ch.w;
    const px = (it.x1 - it.x0) / cw;
    const amid = (x: number, y: number) => {
      for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (!g.lit[(y + v) * cw + x + u]) return false;
      return true;
    };
    const cands: [number, number][] = [];
    for (let y = s.y + 1; y < s.y + s.h - 1; y++) for (let x = s.x + 1; x < s.x + s.w - 1; x++) if (amid(x, y)) cands.push([x, y]);
    cands.sort((a, b) => Math.hypot(a[0] - s.x - s.w / 2, a[1] - s.y - s.h / 2) - Math.hypot(b[0] - s.x - s.w / 2, b[1] - s.y - s.h / 2));
    for (const [x, y] of cands) {
      out.x = it.x0 + (x + 0.5) * px;
      out.y = it.y0 + (y + 0.5) * px;
      if (!(out.x > 0 && out.x < this.W && out.y > 0 && out.y < this.H)) continue;
      const h = this.pick(out.x, out.y);
      if (i >= this.homes.length ? h?.kind === "coliseum" : h?.kind === "house" && h.home === this.homes[i]) return true;
    }
    return false;
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
      // How far you are from the edge of its ground (a home's plot is 3 squares across, the Colosseum's 6), in squares.
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
  private drawSprite(it: Item, img: CanvasImageSource, sq: number, fx: number, fy: number, aspect: number, lift: number, tilt: number, flip: number, shadow: number, head = 0, pawn = false, base = 1, body = sq): void {
    const { ctx, view: v, p } = this;
    if (!proj(v, it.dx, it.dz, 0, p)) return;
    const h = sq * p.k;
    const w = h * aspect;
    const x0 = p.x - fx * w;
    // Sitting (a pawn on a chess table's stool): the pawn's lower part (`sitCut` of its `body` squares) goes behind the
    // stool, the rest rests on its seat: lower than standing.
    const F0 = TOWN_FEEL;
    const seat = p.y - F0.sitSeat * p.k;
    const drop = this.sitting ? seat + F0.sitCut * body * p.k - p.y : 0;
    const y0 = p.y - fy * h - lift * p.k + drop;
    const s = bandOf(v, it.dx, it.dz); // in the far band: fade, haze and blur
    const alpha = (1 - TOWN_FEEL.bandFade * s) * enterOf(v, it.dx, it.dz) * this.fade;
    ctx.save();
    // The shadows follow the height: the higher it is, the smaller and lighter they are; gone by the rim.
    const F = TOWN_FEEL;
    const up = Math.max(0, lift);
    const grow = 1 / (1 + up * F.shadowLiftShrink);
    const fade = Math.max(0, 1 - up * F.shadowLiftFade);
    ctx.fillStyle = SHADOW;
    const soft = this.sitting ? 0 : shadow; // (sitting: the stool's shadow is its own)
    ctx.globalAlpha = alpha * F.shadowAlpha * (1 - s) * (0.5 + 0.5 * fade);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.min(w * base * 0.42, p.k * 0.42 * soft) * grow, p.k * 0.12 * soft * grow, 0, 0, Math.PI * 2);
    ctx.fill();
    const cw = pawn ? w * base * F.contactShadowW : p.k * F.contactShadowW * 1.45 * Math.min(shadow, 1.2);
    if (!this.sitting) {
      ctx.globalAlpha = alpha * F.contactShadowAlpha * (1 - s) * fade;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, cw * grow, p.k * F.contactShadowDepth * grow, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.rect(x0 - w, y0 - h, 3 * w, seat - (y0 - h));
      ctx.clip();
    }
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
    this.cover(img, x0, y0, w, h, alpha, flip, tilt, p.x, p.y, this.sitting ? seat : Infinity);
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
    this.cover(img, x0, y0, w, h, alpha);
    // Its lights at dusk and night (fading and hazing in the far band as its picture does).
    if (this.lightK > 0.01) this.lightUp(this.glowOf(it.i), x0, y0, px, alpha * (1 - 0.88 * s), now, it.i * 613);
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

  /** Where a card points: over a boss's head or a place's top (`i`: its index in the homes, then the Colosseum), on screen (false: not drawn this frame). */
  anchor(kind: "boss" | "home" | "table" | "person", i: number, out: { x: number; y: number }): boolean {
    if (kind === "person") {
      // Over its name tag (`i`: its index in the people).
      const it = this.personItem(i);
      if (!it?.on) return false;
      out.x = it.fx;
      out.y = it.hy - 18;
      return out.y > 0 && out.y < this.H && out.x > 0 && out.x < this.W;
    }
    if (kind === "table") {
      // Over its board.
      const it = this.propItems[PROPS.findIndex((p) => p.table === i)]!;
      if (!it?.on) return false;
      out.x = it.fx;
      out.y = this.propTop[it.i]! - 4;
      return out.y > 0 && out.y < this.H && out.x > 0 && out.x < this.W;
    }
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
    // A building taller than the view (the Colosseum from the park on a computer): its top is above the box, so the card
    // stands at the box's top, over it.
    if (out.y <= 0 && it.y1 > 0) out.y = 1;
    return out.y > 0 && out.y < this.H && out.x > 0 && out.x < this.W;
  }

  /**
   * A point to tap on a boss (its body's middle) or a place (low on its picture; the Colosseum's gate), on screen, where a
   * tap lands on it: if something nearer stands over that point (a boss in front of its home, a bot at the gate), the
   * first point of a grid over its picture that a tap would hit. False if it isn't drawn or none is clear. (For tests.)
   */
  tapPoint(kind: "boss" | "home" | "statue" | "table" | "person", i: number, out: { x: number; y: number }): boolean {
    if (kind === "person") {
      // Its body's middle, or higher or lower on it if something nearer stands in front.
      const it = this.personItem(i);
      if (!it?.on || it.faded) return false;
      for (const v of [0.6, 0.45, 0.75, 0.3]) {
        out.x = (it.x0 + it.x1) / 2;
        out.y = it.y0 + v * (it.y1 - it.y0);
        const h = out.x > 0 && out.x < this.W && out.y > 0 && out.y < this.H ? this.pick(out.x, out.y) : null;
        if (h?.kind === "person" && h.person === this.town.people[i]) return true;
      }
      return false;
    }
    if (kind === "table") {
      // Its board's middle, or a point on its leg or a stool if someone stands in front of that.
      const it = this.propItems[PROPS.findIndex((p) => p.table === i)];
      if (!it?.on) return false;
      const top = this.propTop[it.i]!;
      for (const [u, y] of [[0, top + 2], [0, (top + it.fy) / 2], [-0.33, it.fy - 3], [0.33, it.fy - 3]] as const) {
        out.x = it.fx + u * (it.x1 - it.x0);
        out.y = y;
        const h = out.x > 0 && out.x < this.W && out.y > 0 && out.y < this.H ? this.pick(out.x, out.y) : null;
        if (h?.kind === "table" && h.table === TABLES[i]) return true;
      }
      return false;
    }
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

  /** A person's item this frame (`i`: its index in the people), or null. */
  private personItem(i: number): Item | null {
    for (const it of this.items) if (it.kind === "person" && it.i === i) return it;
    return null;
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
      if (it.kind === "prop") {
        // A chess table (its stools too): its table. A tree, a bench or the fountain: the square under the tap.
        const pr = PROPS[it.i]!;
        if (pr.kind === "table" && this.propHit(it, x, y)) return { kind: "table", table: TABLES[pr.table]! };
        continue;
      }
      return { kind: "person", person: this.town.people[it.i]! };
    }
    const sq = pickSquare(this.view, this.camX, this.camY, x, y);
    return sq ? { kind: "square", c: sq.c, r: sq.r } : null;
  }

  /** Is (x, y) on a drawn pixel of a park thing's picture? (A mask made once a kind: no read-back per tap.) */
  private propHit(it: Item, x: number, y: number): boolean {
    const fc = this.propFrames[it.i]!;
    let m = this.propMasks.get(fc);
    if (!m) {
      const img = fc.get(0);
      const d = img.getContext("2d")!.getImageData(0, 0, img.width, img.height).data;
      m = new Uint8Array(img.width * img.height);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3]! > 0 ? 1 : 0;
      this.propMasks.set(fc, m);
    }
    const w = fc.ch.w;
    const px = clamp(Math.floor(((x - it.x0) / (it.x1 - it.x0)) * w), 0, w - 1);
    const py = clamp(Math.floor(((y - it.y0) / (it.y1 - it.y0)) * fc.ch.h), 0, fc.ch.h - 1);
    return !!m[py * w + px];
  }
  private readonly propMasks = new Map<FrameCache, Uint8Array>();

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

  // ---- The edge chips: the places off screen (the boss homes and the Colosseum), nearest to you first; a face (or the
  // Colosseum's crown) at the box's edge pointing there.

  private placeChips(now: number): void {
    const { town, view: v, W, H, p, chips, places } = this;
    const you = town.you.walker.pose(now, this.pose);
    const yx = you.x;
    const yy = you.y;
    let n = 0;
    for (const ch of chips) ch.place = null;
    // Nearest first: a home is left out when its picture or its boss is on screen; the Colosseum when any of it is.
    const order = SCRATCH_ORDER;
    order.length = 0;
    for (let i = 0; i < places.length; i++) {
      const hi = this.houseItems[i]!;
      if (i >= this.homes.length) {
        if ((hi.on && hi.x1 > 0 && hi.x0 < W && hi.y0 < H && hi.y1 > 0) || this.farOn) continue;
      } else {
        if (hi.on && hi.fx > 0 && hi.fx < W && hi.hy < H) continue;
        if (town.bosses[i]!.onScreen) continue; // (the bosses are in the homes' order: world.ts)
      }
      order.push(i);
    }
    order.sort((a, b) => dist2(places[a]!, yx, yy) - dist2(places[b]!, yx, yy));
    // The Colosseum, when it's among the nearest few, is placed first: it takes its spot before the homes' chips.
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

  /** What a place's chip shows: its boss's first idle frame and the box round the boss's head, or the Colosseum's crown. */
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
const byFarFirst = (a: Item, b: Item) => b.sz - a.sz;
const dist2 = (h: Place, x: number, y: number) => wrapF(h.cx - x) ** 2 + wrapF(h.cy - y) ** 2;
/** The Colosseum's chip shows all of its icon. */
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

