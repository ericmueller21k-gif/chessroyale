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
import { mirrorFor } from "../characters/sprite-kit.ts";
import { artFacing } from "../characters/sprites.ts";
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
import { BOSS_BEAVER } from "../characters/timber.ts";
import { BOSS_BLITZ } from "../characters/boss-blitz.ts";
import { NPC_ZEBRA_GUARD_A } from "./shops/zebra-crew.ts";
import { N, colI, rowI, bandOf, clamp, drawable, enterOf, farOf, forEachSquare, hazeMix, newPt, newView, pastCurve, pickSquare, proj, radial, rel, rimYAt, setHeading, setView, stepCams, tableLift, toCam, wrapF, wrapFX, wrapFY, type Quad, type TableLift, type View } from "./camera.ts";
import { CHAT_BOX } from "./chat.ts";
import { MAP_BOX } from "./minimap.ts";
import { TOWN_FEEL } from "./feel.ts";
import { PIECE_ART, statueSpot } from "./houses/coliseum.ts";
import { COLISEUM_CHIP, artOf } from "./houses/index.ts";
import { CLOSE, QUOTE_INK, STATUE_W, quoteFace, statueArt, statueFrame, statueH, statueSteps } from "./houses/statues.ts";
import { CAP, LEADING, layout, lineWidth, renderLines } from "./sign-font.ts";
import { look, mixLights, mixMist, mixRGB, mixTint, type SkyWeights } from "./sky.ts";
import { SkyPainter } from "./sky-draw.ts";
import type { Ctx, PaintLayer, Painter } from "./paint.ts";
import { art2d } from "./paint.ts";
import type { LightPool, LightSpot } from "./houses/kit.ts";
import { PARK_BENCH, PARK_FOUNTAIN, PARK_LAMP, PARK_LAMP_HEAD, PARK_LAMP_LIGHTS, PARK_LAMP_POOLS, PARK_TABLE, PARK_TREES, TABLE_BACK_RANK, TABLE_BOARD, TABLE_CLOCK_INK, TABLE_DIGITS, TABLE_INK, TABLE_PIECES, TABLE_RING, TABLE_TOP } from "./houses/park.ts";
import type { SidekickSheet } from "./sidekick-sheets.ts";
import type { Rider, RiderTrail } from "./rides.ts";
import { building } from "./buildings.ts";
import type { TownBox } from "./town-kit.ts";
import { HEDGE, bed, bush, hedgeFront, hedgeTop, shed } from "./dressing.ts";
import { ROW_GROUND, STREET_BUILDINGS, STREET_GROUND, STREET_GROUND_KEY, STREET_LOTS } from "./street.ts";
/** The lots' squares (a camera standing in one, backed up to a front, sees from your square only). */
const ROW_LOT = STREET_GROUND.map((g) => +(g === STREET_GROUND_KEY.L));
import { affine, boxPoint, geomOf, lotArt, newPlan, planBox, streetBoxes, type BoxInst, type BoxPlan, type WallPlan } from "./boxes.ts";
import { seenEither, seenFrom, seenReady, seenWorked } from "./seen.ts";
import { P, REC, type PartId } from "./frame-report.ts";
import { bakeRoof, type Piece, type RoofArt } from "./box-draw.ts";
import { stepChar } from "./kit/bake.ts";
import { ARENA, COLISEUM_PLACE, GARDEN, WALL, GRASS, LAMPS, LOT, PAVING, PROPS, STATUES, TABLES, figureName, groundAt, hasTownBoss, isSprite, plotAt, plotDist, seated, spriteAnim, tableStates, type Boss, type SpriteAnim, type Home, type HomeId, type IndoorId, type NoFigureId, type TownBossId, type Person, type Place, type Pose, type Prop, type Statue, type StatueId, type Table, type TableState, type Town, type Walker } from "./world.ts";
import { drawZzz } from "./zzz.ts";
import { TAG_STYLE, TagCache, easeTag, namesMode, tagAlpha, type NamesMode, type TagKind } from "./tags.ts";

/** Each boss's sprite (its real one: its `idle` frames). */
export const BOSS_ART: Record<TownBossId, Character> = {
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
  // (His approved drawing, without the room his game figure keeps over his head for his entrance's drop: timber-figure.ts.)
  timber: BOSS_BEAVER,
  // (Dash as drawn, without the room his game figure keeps on its right for his entrance's zip-in: dash-figure.ts.)
  dash: BOSS_BLITZ,
};
/** A home whose boss is inside: its stand-in's sprite out front (world.ts STAND_IN). Rolling Dough's guard (Nov 11): the front room's
 * flat-cap door guard, his roll at port arms; Don's size, as drawn. */
const STAND_IN_ART: Record<Exclude<IndoorId, NoFigureId>, Character> = { zebra: NPC_ZEBRA_GUARD_A };
/** The town figure's sprite for a home: its boss's, or its stand-in's (a home with nobody out front, world.ts hasFigure, has none). */
const figureArt = (id: HomeId): Character => (id === "zebra" ? STAND_IN_ART[id] : BOSS_ART[id as TownBossId]);
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
  // (His hard hat and face.)
  timber: [14, 5, 40],
  // (His backwards cap and face.)
  dash: [21, 9, 38],
  // (Rolling Dough has no boss in the town, Don Dough being in his back room: its chip shows the bakery's door, the eyes peeking
  // through its blinds, in the home's own picture: chipFace.)
  zebra: [72, 82, 44],
  // (The Walk-up has nobody out front, the Hidden Boss upstairs: its chip shows the top floor's lit window, the child's, under its hood.)
  recluse: [32, 34, 44],
};

// ---- Colors (the prototype's, sampled from Eric's reference picture).
/** (Tests) How far round a test hook's tap point must still be on its target: a tap's whole pixel, and then some (`clearAt`). */
const TAP_ROOM_PX = 2;
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
const GROUNDS = 5;
const SQ_KEYS = (MIX_STEPS + 1) * GROUNDS * 2;
/** The park's paving (a light stone, two tones) and its grass (two greens, mown in squares). */
const PAVE_LIGHT = [222, 214, 198] as const;
const PAVE_DARK = [203, 194, 177] as const;
const GRASS_LIGHT = [128, 184, 84] as const;
const GRASS_DARK = [113, 170, 74] as const;
/** The street town's back gardens, its grove and the lots under its buildings (Nov 5; the art's colors): a deeper, unmown green. */
const GARDEN_LIGHT = [118, 168, 80] as const;
const GARDEN_DARK = [108, 158, 72] as const;
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
/** A square's color key: its step toward the sky, its ground (0 board, 1 board under a home, 2 paving, 3 grass, 4 garden), light or dark. */
const sqKeyOf = (mix: number, ground: number, alt: number) => (mix * GROUNDS + ground) * 2 + alt;
function groundColors(skyh: readonly number[]): GroundColors {
  const fill: string[] = [];
  const seam: string[] = [];
  for (let i = 0; i <= MIX_STEPS; i++)
    for (let g = 0; g < GROUNDS; g++)
      for (let alt = 0; alt < 2; alt++) {
        let base: readonly number[] = g === 2 ? (alt ? PAVE_DARK : PAVE_LIGHT) : g === 3 ? (alt ? GRASS_DARK : GRASS_LIGHT) : g === 4 ? (alt ? GARDEN_DARK : GARDEN_LIGHT) : alt ? SQ_DARK : SQ_LIGHT;
        if (g === 1) base = base.map((x) => x * 0.9); // a faint darker tint under a home (and the Colosseum)
        const t = i / MIX_STEPS;
        const f = mix(base, skyh, t);
        const k = sqKeyOf(i, g, alt);
        fill[k] = rgb(f);
        // The seam fades out too; the grass's is faint (a lawn, not tiles), the paving's a little stronger (its slabs).
        const d = g === 3 || g === 4 ? 0.95 : g === 2 ? 0.84 : 0.86;
        seam[k] = rgb(f.map((x) => x * (d + (1 - d) * t)));
      }
  const haze = Array.from({ length: HAZE_LINES }, (_, i) => `rgba(${skyh[0]! | 0},${skyh[1]! | 0},${skyh[2]! | 0},${(0.75 * Math.pow(1 - i / HAZE_LINES, 1.7)).toFixed(3)})`);
  return { fill, seam, haze, skirt: rgb(mix(SQ_LIGHT, skyh, 0.85)), horizon: rgb(skyh) };
}
/** Fonts by whole pixel size (tags, signs). */
const TAG_FONT = Array.from({ length: 16 }, (_, s) => `600 ${s}px ${FONT}`);
/**
 * A name tag drawn once (`Renderer.tagArtOf`): its canvas (four rows, each `rh` device pixels high, TAG_PAD device pixels
 * round the pill for its shadow's blur, 4), the pill's size, its size and kind (yours, a pawn's or a sidekick's: its colors), the frame it was last drawn.
 */
interface TagArt {
  cv: HTMLCanvasElement;
  w: number;
  h: number;
  rh: number;
  s: number;
  kind: TagKind;
  used: number;
  /** `fontsLoaded` when it was drawn: a tag drawn before its font came is drawn again. */
  fonts: number;
}
const TAG_PAD = 8;
/** Counts the web fonts' loads finished (a tag's font, Archivo, may come after the town opens). */
let fontsLoaded = 0;
if (typeof document !== "undefined" && document.fonts) {
  const loaded = () => void fontsLoaded++;
  document.fonts.addEventListener?.("loadingdone", loaded);
  void document.fonts.ready.then(loaded);
}
/** How far off its canvas a tag's pill is drawn to throw its shadow alone onto it (CSS pixels). */
const TAG_THROW = 1000;
const TAG_ART_MAX = 64;
/** The homes' floating names (the game's display font), by whole pixel size. */
const NAME_FONT = Array.from({ length: 41 }, (_, s) => `400 ${s}px ${FONT_BLACK}`);
const BUBBLE_FONT = `500 12px ${FONT}`;

// ---- The pawn (cburnett's, as on the boards: src/board/pieces/SOURCES.md), drawn once per look at a good size.
export const PAWN_PATH =
  "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z";
export const PAWN_PX = 160;
/** The pawn's head is this far down its box (its top at y 9 of the piece's 45): name tags sit on it. */
export const PAWN_HEAD = 9 / 45;
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
  const g = art2d(c);
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

/** Each frame's canvas, by the cache and frame it came from: so a wall in shade finds its own frame one ramp step darker. */
const frameOf = new WeakMap<HTMLCanvasElement, { fc: FrameCache; i: number }>();
/** A frame's canvas one step darker along its palette's ramps (kit/bake.ts): a wall turned from the light, every pixel a palette color. */
function darkFrame(img: HTMLCanvasElement): HTMLCanvasElement {
  const f = frameOf.get(img);
  return f ? f.fc.dark(f.i) : img;
}

/** A character's frames as canvases, drawn the first time each shows (a frame at a time, never all at once). */
class FrameCache {
  private darker: FrameCache | null = null;
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
    const t0 = REC ? performance.now() : 0;
    const { w, h, data } = renderFrame(this.ch, this.ch.anims.idle!.frames[i]!);
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    art2d(c).putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
    this.frames[i] = c;
    frameOf.set(c, { fc: this, i });
    if (REC) REC.paint(performance.now() - t0);
    return c;
  }
  /** Frame `i` one ramp step darker. */
  dark(i: number): HTMLCanvasElement {
    return (this.darker ??= new FrameCache(stepChar(this.ch, -1))).get(i);
  }
}

const SPRITE_ANIMS: readonly SpriteAnim[] = ["idle", "walk", "sit", "wave"];
/** Each sidekick's sheet (scripts/bake-sidekicks.ts), by its sprite's file name: its picture's address. */
const SHEET_URL: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("./sidekicks/*.png", { eager: true, query: "?url", import: "default" })).map(([path, url]) => [path.replace(/^.*\/|\.png$/g, ""), url]),
);
/**
 * A sidekick's four animations (Oct 28), every frame cut once from its baked sheet into a canvas of its own, never per
 * frame (Eric's frame-rate rule). The sheet is fetched as the town opens and cut when its sidekick first appears (`cut`;
 * Nov 10, phone load: not all 14 sheets into some 875 canvases on entry); until then it isn't drawn. When each frame
 * ends; how tall it stands (its frame's height in squares, so it's a pawn's height from its idle's top to its feet); and
 * where its head is in each animation (its name tag sits there).
 */
class SpriteFrames {
  readonly frames: Record<SpriteAnim, HTMLCanvasElement[]> = { idle: [], walk: [], sit: [], wave: [] };
  readonly ends = {} as Record<SpriteAnim, number[]>;
  readonly top: Record<SpriteAnim, number>;
  readonly squares: number;
  ready = false;
  /** Its sheet didn't load. */
  failed = false;
  private img: HTMLImageElement | null = null;
  constructor(readonly sheet: SidekickSheet) {
    for (const a of SPRITE_ANIMS) {
      let t = 0;
      this.ends[a] = sheet.ms[a].map((ms) => (t += Math.max(16, ms)));
    }
    // (Walking and waving, its head is where it is standing: the tag doesn't jump.)
    const idle = sheet.top.idle / sheet.h;
    this.top = { idle, walk: idle, wave: idle, sit: sheet.top.sit / sheet.h };
    this.squares = TOWN_FEEL.sidekickSquares / (sheet.foot[1] / sheet.h - idle);
    const img = new Image();
    img.src = SHEET_URL[sheet.id.replace(/^sidekick-/, "")]!;
    // (Decoded off the main thread as it loads (Nov 11): cutting its frames, on the town's loading screen, is then quick. A browser
    // that can't decode ahead: as it loads, as before.)
    // (One that fails to load is never drawn, as before; the loading screen doesn't wait for it.)
    const got = () => void (img.naturalWidth ? (this.img = img) : (this.failed = true));
    if (img.decode) img.decode().then(got, () => (img.complete ? got() : ((img.onload = got), (img.onerror = got))));
    else ((img.onload = got), (img.onerror = got));
  }
  /** Its frames cut from its sheet, once, the first time it's drawn (or its face asked for) after the sheet has loaded. */
  cut(): void {
    const img = this.img;
    if (this.ready || !img) return;
    const sheet = this.sheet;
    SPRITE_ANIMS.forEach((a, row) => {
      this.frames[a] = sheet.ms[a].map((_, col) => {
        const c = document.createElement("canvas");
        c.width = sheet.w;
        c.height = sheet.h;
        art2d(c).drawImage(img, col * sheet.w, row * sheet.h, sheet.w, sheet.h, 0, 0, sheet.w, sheet.h);
        return c;
      });
    });
    this.ready = true;
    this.img = null;
  }
  /** Its frame `t` ms into `anim` (looping; the wave holds its last frame). */
  at(anim: SpriteAnim, t: number): HTMLCanvasElement {
    const ends = this.ends[anim];
    const loop = ends[ends.length - 1]!;
    const u = anim === "wave" ? Math.min(t, loop - 1) : ((t % loop) + loop) % loop;
    let i = 0;
    while (i < ends.length - 1 && u >= ends[i]!) i++;
    return this.frames[anim][i]!;
  }
  /** Its idle's first frame cut to what's drawn, as an image's address (the game's strip shows it): made when asked. */
  face(): string | null {
    this.cut();
    const c = this.frames.idle[0];
    if (!c) return null;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width;
    let y0 = c.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3]! > 0) ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)));
    // Square, the figure standing on its bottom in the middle, so it sits in the strip's round spot like a pawn.
    const size = Math.max(x1 - x0, y1 - y0) + 1;
    const out = document.createElement("canvas");
    out.width = out.height = size;
    out.getContext("2d")!.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, Math.floor((size - (x1 - x0 + 1)) / 2), size - (y1 - y0 + 1), x1 - x0 + 1, y1 - y0 + 1);
    return out.toDataURL();
  }
}

/** One thing standing on the ground this frame: where it was drawn (for taps, tags and chips) and how to sort it. */
interface Item {
  /** (`part`: a street-town box's side, back or roof, `i` = its box's index x 4 + 0 left, 1 right, 2 back, 3 roof.) */
  kind: "house" | "boss" | "person" | "prop" | "part";
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
  art2d(c).putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
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
  const g = art2d(cv);
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
/** A light layer: its picture (the world's size; the drawing layer's, paint.ts), and which of its tiles (`lightTilePx` square, nx across, ny down) a light touched. */
interface LightLayer {
  cv: PaintLayer;
  g: Ctx;
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
    art2d(cv).putImageData(img, 0, 0);
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

/** The street town's chase camera (round 4): its phone and computer sets in place of the town's. */
/** The street town's camera this frame: its zoom steps' numbers blended at the step it's at (feel.ts streetZoomSteps). */
const STREET_CAMS = { tall: { ...TOWN_FEEL.camStreetTall }, wide: { ...TOWN_FEEL.camStreetWide } };

/** The most "zzz"s drawn in a frame. */
const ZZZ_MAX = 64;

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
  /** The street town's hedges' tops (a top-down tile each, by its flowers: 0..2), and each front's lights (by its picture). */
  private readonly hedgeTops: FrameCache[];
  private readonly frontGlow = new Map<FrameCache, Glow | null>();
  /** This person sits at a chess table (drawn lower, on its stool). */
  private sitting = false;
  private readonly pose: Pose = { x: 0, y: 0, hop: 0, tilt: 0, step: false, t: 0 };
  private readonly p = newPt();
  /** A world point in the camera's frame (camera.ts `rel`): scratch. */
  private readonly rq = { dx: 0, dz: 0 };
  /**
   * The scratch canvases for softening things in the far band (`blitSoft`): one for each softened this frame, in turn
   * (`nSoft`), each as big as the biggest it has held. (Oct 28: one shared canvas, rewritten for each thing while the
   * world's canvas still held the last one drawn from it, was copied whole each time, at the size of the biggest
   * picture it ever held, such as the far Colosseum: 3.3 million device pixels a frame south of the park, where fifteen
   * or so things are softened, the frames Eric saw drop there.)
   */
  private readonly softs: { cv: HTMLCanvasElement; g: CanvasRenderingContext2D }[] = [];
  private nSoft = 0;
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
  private readonly statueImg: (HTMLCanvasElement | null)[] = STATUES.map(() => null);
  /** Which of each world's-scale statue's pixels are drawn (taps read this, never the canvas: a read-back stalls). */
  private readonly statueMask: (Uint8Array | null)[] = STATUES.map(() => null);
  /** Statue i at the world's scale and its mask, made the first time it's drawn (Nov 10, phone load 3: not all as the town opens). */
  private statueAt(i: number): HTMLCanvasElement {
    let c = this.statueImg[i];
    if (!c) {
      const m: Uint8Array[] = [];
      c = this.statueImg[i] = canvasOf(statueArt(STATUES[i]!.id, 1), m);
      this.statueMask[i] = m[0]!;
    }
    return c;
  }
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
  private readonly tags: { text: string; x: number; y: number; kind: TagKind; size: number; alpha: number; who: number }[] = [];
  private nTags = 0;
  /** This frame's "zzz"s over away players' pawns (afk.ts), drawn with the tags: where, how big, how faded, whose (an index in the people). */
  private readonly zX = new Float32Array(ZZZ_MAX);
  private readonly zY = new Float32Array(ZZZ_MAX);
  private readonly zS = new Float32Array(ZZZ_MAX);
  private readonly zA = new Float32Array(ZZZ_MAX);
  private readonly zP = new Int32Array(ZZZ_MAX);
  private nZzz = 0;
  /** Where you stand, in squares from the camera's focus, this frame (the name tags' near rule, tags.ts), the setting as this frame reads it, and the table you sit at. */
  private youDx = 0;
  private youDz = 0;
  private tagNames: NamesMode = "near";
  private youTable: Table | null = null;
  private readonly bubble = { on: false, text: "", x: 0, y: 0 };
  /** The pressed square (slice 4): where, when the finger went down, when it lifted (-1: still down), and whether it pulses. */
  private readonly pressSq = { on: false, c: 0, r: 0, upAt: -1, pulse: false };
  /** Your trail's droplets (squares, unwrapped near where they fell; t0 -1e9: none), and the square you were last on. */
  private readonly drops = Array.from({ length: 8 }, () => ({ c: 0, r: 0, t0: -1e9 }));
  private dropNext = 0;
  private dropAt = -1e9;
  /**
   * On a ride with a trail (Nov 1, rides v2), its marks instead of the droplets: each one's square, when it landed, which way
   * you were going (`view`: 0 side, 1 back, 2 front; `flip` -1 going left), which mark of the run (`n`) and whose trail it is.
   */
  private readonly marks = Array.from({ length: 24 }, () => ({ c: 0, r: 0, t0: -1e9, view: 0, flip: 1, n: 0, tr: null as RiderTrail | null }));
  private markNext = 0;
  private markRun = 0;
  private lastC = -1;
  private lastR = -1;
  /** The boss's items, by boss (for its card's place). */
  private readonly bossItems: Item[];
  private readonly q4 = new Float64Array(8);
  /** Your dressed pawn (null: the plain pawn): set by Town.tsx when your look changes. */
  youArt: YouArt | null = null;
  /** Each bot's dressed pawn (its crate items, drawn once when the page opens: Town.tsx), by person id; none: plain. */
  readonly botArt = new Map<string, YouArt>();
  /**
   * Your ride with you on it, and anyone else's by person id (Oct 31: rides.ts; set by Town.tsx once every frame is
   * composed, so nothing is made here): drawn in place of the pawn while not seated at a table.
   */
  youRider: Rider | null = null;
  readonly riders = new Map<string, Rider>();
  /**
   * The riders asked for, yours and anyone else's (Nov 1, rides lazy: set by Town.tsx as a look is put on): while one's frames are
   * on their way (its drawing's chunk loading, then its frames composed) its person walks on foot, but in the box and under the tag
   * the rider will have (measured ahead: ride-cells.ts), so nothing moves when the ride appears.
   */
  youSoon: Rider | null = null;
  readonly ridersSoon = new Map<string, Rider>();
  /** (Tests) Your ride as the last frame drew it: the animation ("" on foot), its frame, which way it faced, its view (0 side, 1 back, 2 front). */
  readonly youRide = { anim: "" as "" | "idle" | "move", frame: -1, facing: 1, view: 0 };
  /** Each sidekick's frames, by its sheet: every one cut from it as the town opens (the constructor), never per frame. */
  private readonly spriteArt = new Map<SidekickSheet, SpriteFrames>();
  /** Tag widths by name and size; sign and bubble layouts by text. */
  /**
   * The name tags, each drawn once (its pill, its shadow and its name) at the device's pixels and stamped every frame
   * (Oct 28: a tag's shadow blur and its text, redrawn each frame, were the costliest part of a figure): by name, one
   * per size and color; about TAG_ART_MAX in all, the least lately used making way (its canvas reused).
   */
  private readonly tagArt = new TagCache<TagArt>(TAG_ART_MAX);
  private tagDpr = 0;
  private readonly nameW = new Map<string, number[]>();
  /** Each home's sign lettering: laid out once, drawn once per size (in device pixels a font pixel). */
  private readonly signs: { lines: string[]; w: number; h: number; art: HTMLCanvasElement[] }[];
  /** Where each place's name floats this frame (drawn over everything, after the homes): x, the building's top, its fade. */
  private readonly names: { x: number; y: number; a: number; k: number; eave: number; dz: number }[];
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

  /**
   * The street town's boxes (Nov 5, round 3; boxes.ts): each one, its plan this frame, which is each place's (a home's; null the
   * Colosseum's) and each prop's (an everyday building's front, a shed, a hedge), the sides', backs' and roofs' items, each picture's
   * frames (the sides' and backs'), their lights, and each roof's painting a heading (box-draw.ts: by its art, then "facing:east").
   */
  private readonly boxes: BoxInst[];
  private readonly plans: BoxPlan[];
  /** Each box's footprint's squares (index r * N + c). */
  private readonly boxSq: Int32Array[];
  /**
   * (The street town, round 4) Leave out what the rows hide this frame (at the close zoom steps: in and the default; from higher up you
   * see over the roofs), and the squares seen from where you and the camera stand (seen.ts), and which squares they were worked out for.
   */
  private cull = false;
  private readonly seen = new Uint8Array(N * N);
  private seenKey = -1;
  /** Whether square (x, y) (world, rounded) is seen this frame (always, when nothing is left out). */
  private seenAt(x: number, y: number): boolean {
    if (!this.cull) return true;
    const c = colI(Math.round(x));
    const r = rowI(Math.round(y));
    return c >= 0 && r >= 0 && this.seen[r * N + c] === 1;
  }
  private readonly homeBox: (BoxInst | null)[];
  private readonly propBox: (BoxInst | null)[];
  private readonly partItems: Item[];
  private readonly wallFrames = new Map<Character, FrameCache>();
  private readonly wallGlow = new Map<Character, Glow | null>();
  private readonly roofs = new Map<TownBox, Map<string, RoofArt>>();
  /** The camera's heading this frame (degrees from north: the street town's turn). */
  heading = 0;

  /** What it draws with (paint.ts: Canvas 2D in today's town, WebGL 2 in the street town), and that one's context. */
  private readonly ctx: Ctx;
  constructor(
    private readonly paint: Painter,
    private readonly town: Town,
    private readonly homes: readonly Home[],
  ) {
    this.ctx = paint.ctx;
    this.places = [...homes, COLISEUM_PLACE];
    this.houseItems = this.places.map((_, i) => newItem("house", i));
    this.names = this.places.map(() => ({ x: 0, y: 0, a: 0, k: 0, eave: NaN, dz: 0 }));
    this.signs = this.places.map((h) => {
      const face = artOf(h).sign;
      return { ...layout(h.name, face.w, face.h), art: [] };
    });
    this.bossItems = town.bosses.map((_, i) => newItem("boss", i));
    this.propItems = PROPS.map((_, i) => newItem("prop", i));
    // The street town's boxes (Nov 5, round 3): each lot's, shed's and hedge's; its front is its home's or prop's item, its sides, back
    // and roof items of their own (sorted with everything else); a shed's and a hedge's drawn with their front.
    this.boxes = streetBoxes(PROPS);
    this.plans = this.boxes.map((b) => newPlan(b.box));
    this.warmAt = [new Int32Array(this.boxes.length), new Int32Array(this.boxes.length)];
    // (Each box's footprint's squares: it shows when the rows let you see any of them, seen.ts.)
    const pt = { x: 0, y: 0 };
    this.boxSq = this.boxes.map((b) => {
      const ks = new Set<number>();
      const B = b.box;
      for (let u = 0; u <= B.front.w; u += 6)
        for (const t of [0.02, 0.5, 0.98]) {
          boxPoint(b, B, Math.min(u, B.front.w - 0.5), t, pt);
          const c = colI(Math.round(pt.x));
          const r = rowI(Math.round(pt.y));
          if (c >= 0 && r >= 0) ks.add(r * N + c);
        }
      return Int32Array.from(ks);
    });
    this.homeBox = this.places.map((h) => this.boxes.find((b) => b.home === h.id) ?? null);
    this.propBox = PROPS.map((pr, i) => (pr.kind === "front" ? this.boxes.find((b) => b.kind !== "home" && b.lot === STREET_LOTS.indexOf(STREET_BUILDINGS[pr.lot!]!)) : this.boxes.find((b) => b.prop === i || b.props.includes(i))) ?? null);
    this.partItems = [];
    for (const b of this.boxes) if (b.kind !== "shed" && b.kind !== "hedge") for (let k = 0; k < 4; k++) this.partItems.push(newItem("part", b.i * 4 + k));
    this.items = [...this.houseItems, ...this.bossItems, ...this.propItems, ...this.partItems];
    const trees = PARK_TREES.map((t) => new FrameCache(t));
    const bench = new FrameCache(PARK_BENCH);
    const table = new FrameCache(PARK_TABLE);
    const fountain = new FrameCache(PARK_FOUNTAIN);
    const lamp = new FrameCache(PARK_LAMP);
    // (The street town's, Nov 5: the gardens' hedges, bushes, beds and sheds, and the everyday buildings' fronts, one cache a picture.)
    const street = new Map<string, FrameCache>();
    const art = (key: string, ch: () => Character) => street.get(key) ?? street.set(key, new FrameCache(ch())).get(key)!;
    this.propFrames = PROPS.map((p) => {
      // (The street town's plaza, the north edge round: the chess pieces on their plinths and the statues stand on it as figures.)
      if (p.kind === "piece") return art(`piece${p.v}`, () => PIECE_ART[p.v]!);
      if (p.kind === "statue") return art(`statue${p.v}`, () => statueArt(STATUES[p.v]!.id, 1));
      if (p.kind === "hedge") return art(`hedge${p.v}`, () => hedgeFront(p.v));
      if (p.kind === "bush") return art(`bush${p.v}`, () => bush(p.v));
      if (p.kind === "bed") return art(`bed${p.v}`, () => bed(p.v));
      if (p.kind === "shed") return art(`shed${p.v}`, () => shed(p.v).front);
      if (p.kind === "front") {
        const b = STREET_BUILDINGS[p.lot!]!;
        const box = lotArt(b);
        // (One cache a picture: the Colosseum's stretches share theirs.)
        return art(box.front.id, () => box.front);
      }
      return p.kind === "tree" ? trees[p.v]! : p.kind === "bench" ? bench : p.kind === "table" ? table : p.kind === "lamp" ? lamp : fountain;
    });
    this.hedgeTops = [0, 1, 2].map((v) => new FrameCache(hedgeTop(v)));
    this.propTop = PROPS.map(() => 0);
    this.bossFrames = town.bosses.map((b) => new FrameCache(figureArt(b.home.id)));
    for (const p of town.people) if (isSprite(p.look) && !this.spriteArt.has(p.look.sprite)) this.spriteArt.set(p.look.sprite, new SpriteFrames(p.look.sprite));
    this.houseFrames = this.places.map((h) => new FrameCache(artOf(h).ch));
    this.placeGlow = this.places.map(() => null);
    this.chipIcon = new FrameCache(COLISEUM_CHIP);
    // Each square is kept this frame (its corners, its face's corners, its color) and drawn with all the others of its
    // color in one fill (drawGround): a few dozen fills a frame instead of two per square.
    this.drawSquare = (c, r, cu, ru, q) => {
      const n = this.nSq;
      if (n >= SQ_MAX) return;
      const m = Math.round(clamp(hazeMix(this.view, cu - this.camX, ru - this.camY, this.mist), 0, 1) * MIX_STEPS);
      // (Ground the rows hide, round 4: left out.)
      if (this.cull && r >= 0 && c >= 0 && !this.seen[r * N + c]) return;
      // (Off the world, past the street town's north or south edge: a meadow, nothing on it.)
      if (r < 0 || c < 0) {
        this.sqKey[n] = sqKeyOf(m, 4, (cu + ru) & 1);
      } else {
      const gk = groundAt[r * N + c]!;
      // (The street town's Colosseum, the north edge round: the board's squares under its oval only; round it, behind the back wall, the
      // meadow, as past the edge.)
      this.sqKey[n] = sqKeyOf(m, gk === PAVING || gk === WALL || ROW_GROUND[r * N + c] ? 2 : gk === GRASS ? 3 : gk === GARDEN || gk === LOT ? 4 : gk === ARENA || plotAt[r * N + c] ? 1 : 0, (c + r) & 1);
      }
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

  /**
   * Draws one frame. `zoom`: 0 normal, 1 zoomed out (and between, while it glides); the street town: its zoom step (feel.ts
   * streetZoomSteps: 0 in, 1 the default, 2 out, 3 the overview, 4 the farthest (Nov 13); between, while it glides). `dt`: seconds since the last.
   */
  /** Frames drawn so far (what's worked out once a frame keys on it; the tags drawn once remember when each was last used). */
  private frameNo = 0;
  draw(now: number, camX: number, camY: number, zoom: number, dt = 0, heading = this.heading): void {
    const { ctx, W, H, DPR } = this;
    this.paint.frame();
    this.frameNo++;
    this.nSoft = 0;
    this.camX = camX;
    this.camY = camY;
    this.heading = heading;
    stepCams(TOWN_FEEL.streetZoomSteps, zoom, STREET_CAMS);
    // (The street town's zoom is its steps' blended numbers: no zoom-out factors over them.)
    const z = 0;
    setView(this.view, W, H, z, 1, 0, 0, STREET_CAMS);
    setHeading(this.view, heading);
    this.lens(z);
    // (What the rows let you see, round 4: from your square and the camera's, at the in step and the mockup's (1, round 4's default). Not
    // from the higher steps, which see over the rows: the default since Nov 5 (2, Eric: "number three") draws everything in reach, as
    // round 4's "out" did.)
    this.cull = TOWN_FEEL.streetCull && zoom <= 1.01;
    // (`?report`: the sight lines' time, frame-report.ts.)
    const sightT = REC && this.cull ? performance.now() : 0;
    if (this.cull) {
      // (From where the camera looks: you, as it follows you; wherever it glides to as you look round. Looking from inside a lot (a
      // glide to a home's middle), nothing is left out.)
      const yc = colI(Math.round(camX));
      const yr = rowI(Math.round(camY));
      if (yc < 0 || yr < 0 || ROW_LOT[yr * N + yc]) this.cull = false;
      const v = this.view;
      const cc = colI(Math.round(camX - v.back * v.hs));
      const cr = rowI(Math.round(camY - v.back * v.hc));
      const key = ((yr * N + yc) * N + cc) * N + cr;
      if (this.cull && key !== this.seenKey) {
        this.seenKey = key;
        seenEither(seenFrom(yc, yr), cr >= 0 && cc >= 0 && !ROW_LOT[cr * N + cc] ? seenFrom(cc, cr) : seenFrom(yc, yr), this.seen);
      }
      // (Ahead of need: the square ahead of the focus, then the one ahead of the camera, worked out a frame early, so a step doesn't wait.)
      if (this.cull) {
        const ax = Math.round(v.hs);
        const ay = Math.round(v.hc);
        if (!seenReady(yc + ax, yr + ay)) seenFrom(yc + ax, yr + ay);
        else if (cc >= 0 && cr >= 0 && !seenReady(cc + ax, cr + ay)) seenFrom(cc + ax, cr + ay);
      }
    }
    if (sightT && this.sightN !== seenWorked()) {
      this.sightN = seenWorked();
      REC!.sight(performance.now() - sightT);
    }
    this.buildCloseUps(now);
    REC?.mark(P.camera);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    // (The street town's turn: the clouds slide across as the camera turns; the sun stays put.)
    this.sky.draw(ctx, this.view, camX, camY, now, dt, (heading / 90) * W * TOWN_FEEL.streetTurnClouds);
    REC?.mark(P.sky);
    this.drawGround();
    this.drawHorizonHaze(); // on the ground, behind every home, boss and pawn
    if (TOWN_FEEL.rimLine) this.drawRimLine();
    this.nTags = 0;
    this.nZzz = 0;
    this.nClear = 0;
    this.bubble.on = false;
    this.drawMarks(now); // on the ground, under everyone: the trail, your destination, the pressed square
    REC?.mark(P.ground);
    const lit = this.beginLights();
    REC?.mark(P.lights);
    this.drawThings(now);
    // The light of the hour over the world and everything on it: one fill (none by day).
    if (this.tint) {
      ctx.fillStyle = this.tint;
      ctx.fillRect(0, 0, W, H);
    }
    // The lights at dusk and night, over the tint, so they really glow (under the tags, the names and the bubble).
    if (lit) this.layLights();
    REC?.mark(P.lights);
    for (let i = 0; i < this.nTags; i++) {
      const t = this.tags[i]!;
      this.drawTag(t.text, t.x, t.y, t.kind, t.size, t.alpha);
    }
    for (let i = 0; i < this.nZzz; i++) drawZzz(ctx, this.zX[i]!, this.zY[i]!, this.zS[i]!, now, this.zA[i]!);
    ctx.globalAlpha = 1;
    if (TOWN_FEEL.floatingNames) this.drawNames(now);
    if (this.bubble.on) this.drawBubble(this.bubble.text, this.bubble.x, this.bubble.y); // (over a home's name)
    REC?.mark(P.labels);
    this.paint.done();
    REC?.mark(P.submit);
    this.placeChips(now);
    REC?.mark(P.chips);
  }
  /** (`?report`) seen.ts's count of sight lines worked out, as last seen. */
  private sightN = 0;

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
    const id = STATUES[c.i]!.id;
    // (The street town's statues stand on the plaza, figures of their own: the north edge round.)
    const sp = PROPS.find((q) => q.kind === "statue" && q.v === c.i);
    rel(v, this.camX, this.camY, sp ? sp.x : pl.cx, sp ? sp.y : pl.cy - pl.foot, this.rq);
    const dx = this.rq.dx;
    const dz = this.rq.dz;
    if (!proj(v, dx, dz, 0, p)) return;
    const ch = artOf(pl).ch;
    const at = statueSpot(id);
    const px = p.k / f.housePxPerSquare;
    const x0 = sp ? p.x - (STATUE_W / 2) * px : p.x + (at[0] - ch.foot[0]) * px;
    const y0 = sp ? p.y - statueH(id) * px : p.y + (at[1] - ch.foot[1]) * px;
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
    setView(v, W, H, zoom, mag, cE - v.cy - mag * (c1 - v.cy), xE - W / 2 - mag * (x1 - W / 2), STREET_CAMS);
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
    const { ctx } = this;
    for (let i = 0; i < STATUES.length; i++) {
      const at = statueSpot(STATUES[i]!.id);
      this.drawStatueAt(i, x0 + at[0] * px, y0 + at[1] * px, px, alpha, soft, now);
    }
    ctx.globalAlpha = alpha;
  }
  /** Statue i, its top left at (sx, sy), `px` screen pixels a picture pixel (today's over the Colosseum's picture; the street town's on the plaza). */
  private drawStatueAt(i: number, sx: number, sy: number, px: number, alpha: number, soft: number, now: number): void {
    const { ctx, close: c } = this;
    const f = TOWN_FEEL;
    {
      const id = STATUES[i]!.id;
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
        if (soft > 0.02) this.blitSoft(this.statueAt(i), sx, sy, sw, sh, soft, 0.88 * soft);
        else ctx.drawImage(this.statueAt(i), sx, sy, sw, sh);
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

  /** (Tests) Whether a name tag, a home's name or the bubble drawn this frame covers (x, y), or a pixel round it. */
  private labelOver(x: number, y: number): boolean {
    const b = this.clearBoxes;
    for (let k = 0; k < this.nClear * 4; k += 4) if (x + 2 > b[k]! && x - 2 < b[k]! + b[k + 2]! && y + 2 > b[k + 1]! && y - 2 < b[k + 1]! + b[k + 3]!) return true;
    return false;
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
    // The street town's minimap (TownMap.tsx), while it shows.
    const mb = MAP_BOX;
    if (mb.w > 0 && x + r > mb.x && x - r < mb.x + mb.w && y + r > mb.y && y - r < mb.y + mb.h) return true;
    for (let m = 0; m < n; m++) {
      const o = this.chips[m]!;
      if (Math.abs(o.x - x) < g && Math.abs(o.y - y) < g) return true;
    }
    return false;
  }

  /**
   * (Tests, `__townTags`) The name tags drawn in the last frame: each one's name, kind, alpha, pill and ink (`TAG_STYLE`) and where its
   * pill is on the screen (CSS pixels in the world's box). Allocates its answer, so it's asked only by a test, never in the frame.
   */
  tagList(): { text: string; kind: TagKind; alpha: number; pill: string; ink: string; x: number; y: number; w: number; h: number; who: number }[] {
    const out = [];
    for (let i = 0; i < this.nTags; i++) {
      const t = this.tags[i]!;
      const a = this.tagArt.find(t.text, Math.round(t.size), t.kind);
      const w = a?.w ?? 0;
      const h = a?.h ?? 0;
      out.push({ text: t.text, kind: t.kind, alpha: t.alpha, ...TAG_STYLE[t.kind], x: t.x - w / 2, y: t.y - h, w, h, who: t.who });
    }
    return out;
  }

  /** A "zzz" over person `i`'s head at (x, head y), its tag's size (`size`, 8 to 12), to draw after the tags. */
  private zzz(i: number, x: number, hy: number, size: number, alpha: number): void {
    if (this.nZzz >= ZZZ_MAX) return;
    const n = this.nZzz++;
    const s = size / 11;
    // (Beside the head, to its right, so it's this pawn's and no neighbor's; it drifts off up and right, past its own tag.)
    this.zX[n] = x + 9 * s;
    this.zY[n] = hy + 10 * s;
    this.zS[n] = s;
    this.zA[n] = alpha;
    this.zP[n] = i;
  }

  /** (Tests, `__townZzz`) Whose pawns had a "zzz" in the last frame (indices in the people). Allocates: a test asks, never the frame. */
  zzzList(): number[] {
    return Array.from(this.zP.subarray(0, this.nZzz));
  }

  /** Each figure's tag as last drawn: its alpha and that frame's time (made once a figure). */
  private readonly tagEase = new WeakMap<object, { a: number; at: number }>();
  private tagPrev = NaN;
  private tagNow = NaN;
  /** A figure's tag alpha eased toward `to` (tags.ts easeTag) from where the last frame drew it; `to` if the last frame didn't. */
  private easedTag(key: object, to: number, now: number): number {
    let e = this.tagEase.get(key);
    if (!e) this.tagEase.set(key, (e = { a: to, at: now }));
    e.a = e.at === this.tagPrev ? easeTag(e.a, to, now - e.at) : to;
    e.at = now;
    return e.a;
  }

  /** A name tag to draw after the world's tint (kept in a list this frame: nothing allocated once it has grown). */
  private tag(text: string, x: number, y: number, kind: TagKind, size: number, alpha: number, who = -1): void {
    let t = this.tags[this.nTags];
    if (!t) this.tags.push((t = { text, x, y, kind, size, alpha, who }));
    t.who = who;
    t.text = text;
    t.x = x;
    t.y = y;
    t.kind = kind;
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
    this.tagNames = namesMode();
    this.tagPrev = this.tagNow;
    this.tagNow = now;
    this.youTable = seated(town.you);
    let np = 0;
    for (const it of this.items) if (it.kind === "person") np++;
    if (np !== people.length) {
      this.items = this.items.filter((it) => it.kind !== "person");
      for (let i = 0; i < people.length; i++) this.items.push(newItem("person", i));
    }
    const items = this.items;
    // The street town's boxes this frame (boxes.ts): what of each shows, and how.
    this.planBoxes();
    // Where each one stands relative to the camera, and whether it's drawn at all.
    for (const it of items) {
      if (it.kind === "part") {
        this.partPos(it);
        continue;
      }
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
        // (A hedge's foot is its face, 0.4 of a square before the back of its top, where the plan puts it; Seam Avenue's run north
        // to south, the middle of their top.)
        const side = pr.kind === "hedge" && pr.x !== Math.round(pr.x);
        x = side ? pr.x - HEDGE.deep / 2 : pr.x;
        y = pr.kind === "hedge" && !side ? pr.y - HEDGE.deep : pr.y;
        // (A front is up to 4 squares wide, and up to 4 tall: drawn from that far off the box's sides, its top showing from under it.)
        margin = pr.kind === "front" ? this.propFrames[it.i]!.ch.w / 2 / f.housePxPerSquare + 0.5 : 2;
        if (pr.kind === "front") below = 4.2;
      } else {
        const w = it.kind === "boss" ? town.bosses[it.i]!.walker : people[it.i]!.walker;
        w.pose(now, pose);
        x = pose.x;
        y = pose.y;
        if (it.kind === "boss") margin = 2;
        // (A ride reaches up to about 1.46 squares from its foot at its size as drawn: drawn from that far off the box's sides, more
        // if it's drawn bigger, so it never pops in.)
        else {
          const rd = this.riderOf(people[it.i]!) ?? this.soonOf(people[it.i]!);
          if (rd) margin = rd.margin;
        }
      }
      rel(v, this.camX, this.camY, x, y, it);
      if (it.kind === "person" && people[it.i]!.you) {
        // (Where you stand, from the camera: the name tags near you show, the far ones don't.)
        this.youDx = it.dx;
        this.youDz = it.dz;
      }
      it.sz = it.kind === "prop" ? it.dz + 0.05 : it.dz;
      it.on = drawable(v, it.dx, it.dz, margin, below) && !(it.kind === "person" && people[it.i]!.home);
      // (A street-town box's front, or a shed or hedge whole: where its plan has it.)
      const bx = it.kind === "house" ? this.homeBox[it.i] : it.kind === "prop" ? this.propBox[it.i] : null;
      if (bx) this.frontPos(it, bx);
      // (A tree, lamp, bench, bush or bed the rows hide: left out, round 4.)
      else if (this.cull && it.kind === "prop" && it.on && !this.seenAt(x, y)) it.on = false;
    }
    // The street town's near side (Nov 5): no front (nor shed, nor home) between the camera and you; the trees there fade out.
    this.nearCut(items);
    sortFarFirst(items);
    for (const b of town.bosses) b.onScreen = false;
    for (const b of this.statueBox) b.on = false;
    for (const nm of this.names) nm.a = 0;
    // (The Colosseum, the north edge round, is a solid: its ring's and portal's boxes, drawn where they stand like any other, its walls over
    // the rows' roofs from near enough; past the rim, nothing, as for every building.)
    const rec = REC;
    rec?.mark(P.plan);
    for (const it of items) {
      if (!it.on) continue;
      if (rec) {
        rec.mark(this.partNow);
        this.partNow = it.kind === "house" || it.kind === "part" ? P.buildings : it.kind === "prop" ? (this.propBox[it.i] ? P.buildings : P.props) : it.kind === "boss" ? P.bosses : people[it.i]!.you ? P.you : P.people;
      }
      if (it.kind === "house") {
        const bx = this.homeBox[it.i];
        if (bx) this.drawBoxFront(it, bx, now);
        else this.drawHouse(it, now);
      } else if (it.kind === "prop") {
        const bx = this.propBox[it.i];
        if (!bx) this.drawProp(it, now);
        else if (bx.kind === "shed" || bx.kind === "hedge") this.drawBoxWhole(it, bx, now);
        else this.drawBoxFront(it, bx, now);
      } else if (it.kind === "part") this.drawPart(it, now);
      else if (it.kind === "boss") {
        const b = town.bosses[it.i]!;
        const ch = figureArt(b.home.id);
        const img = this.bossFrames[it.i]!.at(now, it.i * 977);
        b.walker.pose(now, pose);
        // (The street town: a boss whose drawing would reach past the box's foot or side fades out first, so none is ever cut off.)
        this.fade = this.edgeFade(it, (f.bossSquares * (f.bossScale[b.home.id] ?? 1) * ch.w) / ch.h / 2);
        it.faded = this.fade < 0.5;
        this.bossAlpha[it.i] = this.fade;
        // (Turned to face the way it walks: mirrored when its art faces the other way. Its art's facing from the sprite kit, where it's
        // data (sprites.ts: Smudgy's, Alfil's left); else drawn as facing our right, as before.)
        const face = this.faceOf(b.walker);
        const flip = mirrorFor(artFacing(ch.id) ?? "right", face < 0 ? "left" : "right") ? -1 : 1;
        if (this.fade > 0.004) this.drawSprite(it, img, f.bossSquares * (f.bossScale[b.home.id] ?? 1), ch.foot[0] / ch.w, ch.foot[1] / ch.h, ch.w / ch.h, 0, 0, flip, 1.6);
        b.onScreen = !it.faded && it.fx > -40 && it.fx < this.W + 40 && it.fy > 0 && it.hy < this.H && bandOf(v, it.dx, it.dz) < 0.6; // (a boss deep in the haze doesn't talk)
        this.fade = 1;
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
        const facing = table ? (w.c < table.c ? 1 : -1) : this.faceOf(w);
        const wview = this.viewOf(w);
        // Up close on a statue, the people in front of it (you, on its square) fade: they'd stand between the camera and it.
        // A bot coming out from home fades in, one going home fades out (Oct 28: they take turns in the square).
        this.fade = (it.dz < this.statueDz ? 1 - f.closeNearFade * this.close.e : 1) * clamp(Math.min(now - person.came, person.leaves - now) / f.botFadeMs, 0, 1) * (person.you ? 1 : this.edgeFade(it, 0.5));
        it.faded = this.fade < 0.5;
        this.personAlpha[it.i] = this.fade;
        if (person.you) {
          // Your shadows are a bot's: sized from the pawn, not from the margin your look's items are drawn in.
          const art = this.youArt;
          const k = 1 + 2 * (art?.pad ?? 0);
          const pad = art?.pad ?? 0;
          this.youRide.anim = "";
          if (this.youRider && !table) this.drawRider(it, this.youRider, pose, facing, wview, f.youSquares, now, this.youRide);
          else {
            this.drawSprite(it, art?.img ?? (isSprite(person.look) ? pawnImage("light", null) : pawnImage(person.look.side, person.look.tint)), f.youSquares * k, 0.5, (pad + PAWN_FOOT) / k, 1, pose.hop * f.youHop, pose.tilt * f.hobbleTilt, facing, 1, Math.min(art?.top ?? 1, (pad + PAWN_HEAD) / k), true, 1 / k, f.youSquares);
            this.soonBox(it, this.soonOf(person), wview, f.youSquares);
          }
          if (this.fade > 0.02) this.tag(person.name, it.fx, it.hy - 2, "you", clamp((11 * this.p.k) / v.kf, 8, 12), this.fade, it.i);
          if (person.zzz) this.zzz(it.i, it.fx, it.hy, clamp((11 * this.p.k) / v.kf, 8, 12), this.fade);
        } else {
          const lk = person.look;
          if (isSprite(lk)) {
            // A sidekick (Oct 28): its own frames, cut from its sheet the first time it's drawn. It walks, stands, sits (its sit has its own
            // stool, drawn over the table's: not lowered, no shadow) and waves once when tapped. No hop: its walk steps.
            const sp = this.spriteArt.get(lk.sprite)!;
            sp.cut();
            this.sitting = false;
            if (sp.ready) {
              const anim = spriteAnim(person, now);
              const sh = sp.sheet;
              this.drawSprite(it, sp.at(anim, anim === "wave" ? now - person.waved : now + it.i * 613), sp.squares, sh.foot[0] / sh.w, sh.foot[1] / sh.h, sh.w / sh.h, 0, 0, facing, table ? 0 : f.sidekickShadow, sp.top[anim]);
            } else it.on = false; // (its sheet still loading: not drawn, not tapped)
          } else {
            // A bot's dressed pawn (its one or two crate items, made once), drawn as yours is; on its ride if it has one.
            const art = this.botArt.get(person.id);
            const k = 1 + 2 * (art?.pad ?? 0);
            const pad = art?.pad ?? 0;
            const rider = this.riders.get(person.id);
            if (rider && !table) this.drawRider(it, rider, pose, facing, wview, f.botSquares, now + it.i * 577);
            else {
              this.drawSprite(it, art?.img ?? pawnImage(lk.side, lk.tint), f.botSquares * k, 0.5, (pad + PAWN_FOOT) / k, 1, pose.hop * f.botHop, pose.tilt * f.hobbleTilt, facing, 1, Math.min(art?.top ?? 1, (pad + PAWN_HEAD) / k), true, 1 / k, f.botSquares);
              this.soonBox(it, this.soonOf(person), wview, f.botSquares);
            }
          }
          // Name tags on the near ones only: not far toward the rim (as before), and (Oct 28, Eric) not far from you either, by default: within
          // `nameRadius` squares of you in both directions, fading over the last square (tags.ts; "Everyone" in Town settings: no near rule).
          // A figure whose card is open, one at a table with you and one walking to or from a game with you keep theirs wherever they are.
          const far = farOf(v, it.dz);
          // (A real player with no name: a guest's view, Eric on #542, "maybe nothing" over their heads.)
          if (it.on && far < f.tagFar && this.fade > 0.02 && !(person.remote && !person.name)) {
            const always = person === town.hold || person === town.meet?.bot || person === town.leave?.bot || (!!table && table === this.youTable);
            const dist = Math.max(Math.abs(wrapF(it.dx - this.youDx)), Math.abs(wrapF(it.dz - this.youDz)));
            // (Eased toward it over about 150 ms, so a slow frame doesn't pop it: tags.ts easeTag.)
            const a = this.easedTag(person, tagAlpha(this.tagNames, dist, always, clamp((f.tagFar - far) / 0.12, 0, 1)), now);
            if (a > 0.004) this.tag(person.name, it.fx, it.hy - 2, isSprite(lk) ? "sidekick" : "bot", clamp((11 * this.p.k) / v.kf, 8, 12), a * this.fade, it.i);
          }
          // (Away: the "zzz" over the head, near or far, whether or not the tag shows: everyone sees who's away.)
          if (person.zzz && it.on && far < f.tagFar && this.fade > 0.02) this.zzz(it.i, it.fx, it.hy, clamp((11 * this.p.k) / v.kf, 8, 12), this.fade);
        }
        this.fade = 1;
        this.sitting = false;
      }
    }
    if (rec) {
      rec.mark(this.partNow);
      this.partNow = P.plan;
    }
  }
  /** (`?report`) The part the thing being drawn is (frame-report.ts). */
  private partNow: PartId = P.plan;

  // ---- The street town's boxes (Nov 5, round 3): planned each frame (boxes.ts planBox), drawn here (the art's order: each part by its
  // own depth among everything else; a roof's faces far to near; a shed and a hedge whole, with their fronts).

  /** Plans every box near enough to show, and gets the roofs near the camera painted ahead (a little a frame, nearest first). */
  private planBoxes(): void {
    const v = this.view;
    const cut = -TOWN_FEEL.streetNearCut;
    const ahead = this.ahead;
    let na = 0;
    for (const b of this.boxes) {
      const p = this.plans[b.i]!;
      rel(v, this.camX, this.camY, b.fx, b.fy, this.rq);
      const R = radial(v, this.rq.dx, this.rq.dz);
      if (R < v.rim + 6 && na < ahead.length) {
        ahead[na] = b.i;
        this.aheadD[na++] = R;
      }
      // (What the rows hide is left out; a skyline tower no ray reaches shows over them out to `streetTowerReach`, past it in the haze.)
      // (The Colosseum's ring and portal, the north edge round: never left out by the rows; its walls rise over their roofs.)
      const big = b.kind === "ring" || b.kind === "portal";
      if (R > v.rim + 4 || this.rq.dz < -v.back - 4 || (this.cull && !big && !b.open && !this.boxSeen(b.i) && (b.kind !== "tall" || R > TOWN_FEEL.streetTowerReach))) {
        p.on = p.front.on = p.left.on = p.right.on = p.back.on = false;
        p.nOrder = 0;
        continue;
      }
      // (A hedge is low: drawn between the camera and you too, as the art says.)
      // (The Colosseum's ring and portal too, the north edge round: you're always before it, on the plaza, so it never stands between the
      // camera and you; left out, a drag round beside it would look into its bowl.)
      planBox(p, b, b.box, v, this.camX, this.camY, b.kind === "hedge" || big ? -Infinity : cut);
    }
    // Paint ahead (Nov 11, Eric: "turning is dropping it to like 40 frames"): the pictures of the boxes within reach, nearest first,
    // until the frame's budget is spent, in the order they're needed. Always: the roofs for the quarter the camera faces, then the sides'
    // and backs' pictures and their shaded steps (a side shows at the screen's edge as you walk). Mid-turn, the next quarter's roofs.
    // Standing still (when you look round), the rest a look round shows: the fronts' frames and their shaded steps (a front at a slant),
    // and the other quarters' roofs, with a bigger budget while the view is at rest (`boxBakeStillMs`). Before, only the faced quarter's
    // roofs (and the next, mid-turn) were painted ahead, so a first look round painted hundreds of pictures as they showed, up to 20 ms
    // a frame (the frame report, `?report`); painting all of them while walking too cost the walk frames (pictures a walk never shows).
    // (One being drawn this frame and not yet painted is still painted then, whatever the budget.)
    const t0 = performance.now();
    const hq = ((this.heading % 360) + 360) % 360;
    const q0 = Math.floor(hq / 90) % 4;
    const still = !this.town.you.walker.moving();
    const turning = hq - q0 * 90 >= 0.5;
    // (Standing still with the view at rest, a frame has room: a bigger budget.)
    const budget = still && !turning ? TOWN_FEEL.boxBakeStillMs : TOWN_FEEL.boxBakeMs;
    const qs = this.warmQ;
    qs[0] = q0;
    qs[1] = (q0 + 1) % 4;
    qs[2] = (q0 + 3) % 4;
    qs[3] = (q0 + 2) % 4;
    // (Tiers: 0, the faced quarter's roofs; 1, the sides' pictures; 2, the next quarter's roofs; 3, the fronts' pictures; 4 and 5, the
    // other quarters' roofs.)
    for (let tier = 0; tier < 6; tier++) {
      if (tier >= 2 && !still && !(tier === 2 && turning)) break;
      const list = tier === 1 ? 0 : tier === 3 ? 1 : -1;
      const q = qs[tier === 0 ? 0 : tier === 2 ? 1 : tier - 2]!;
      const at = list < 0 ? null : this.warmAt[list as 0 | 1];
      for (;;) {
        let best = -1;
        for (let j = 0; j < na; j++) {
          const b = this.boxes[ahead[j]!]!;
          if (at ? at[b.i]! < 0 : this.instArt[q]![b.i]) continue;
          if (best < 0 || this.aheadD[j]! < this.aheadD[best]!) best = j;
        }
        if (best < 0 || performance.now() - t0 > budget) break;
        const b = this.boxes[ahead[best]!]!;
        if (list >= 0) this.warmNext(b, list);
        else this.roofArt(b, q);
      }
      if (performance.now() - t0 > budget) break;
    }
  }
  /**
   * The town's loading screen (Nov 11, Eric: "I have no issue with doing a loading screen for the town… loads it all in at once and
   * then it stays there"): every picture the street town can show, painted and handed to `keep` (the painter's: uploaded now and
   * kept for good), a slice at a time: each box's sides, back and front frames (and each a step darker), its roof for each of the
   * four quarters, every home's, boss's, prop's and statue's frames, the hedges' tops, the sidekicks' frames. Spends up to `budgetMs` and says how much is
   * done (0 to 1). (Measured Nov 11: nothing else is painted as you then walk and turn; the figures, tags and boards are drawn as
   * before, on the atlas's spare pages.)
   */
  warm(budgetMs: number, keep: (src: CanvasImageSource) => void): number {
    const jobs = (this.warmJobs ??= this.warmPlan(keep));
    const t0 = performance.now();
    while (this.warmAt0 < jobs.length) {
      // (A job that can't be done yet (a sidekick's sheet still loading) waits for the next slice, up to `loadSheetWaitMs` all told.)
      let done: boolean | void = true;
      try {
        done = jobs[this.warmAt0]!();
      } catch (e) {
        console.warn("town warm:", e); // (that one picture is made as it shows instead, as before)
      }
      if (done === false && t0 - (this.warmWait ||= t0) < TOWN_FEEL.loadSheetWaitMs) break;
      this.warmAt0++;
      if (performance.now() - t0 > budgetMs) break;
    }
    return jobs.length ? this.warmAt0 / jobs.length : 1;
  }
  private warmJobs: (() => boolean | void)[] | null = null;
  private warmAt0 = 0;
  private warmWait = 0;
  /** The loading screen's jobs (`warm`): one picture (or one roof) each. */
  private warmPlan(keep: (src: CanvasImageSource) => void): (() => boolean | void)[] {
    const jobs: (() => boolean | void)[] = [];
    const fcs = new Set<FrameCache>();
    const frames = (fc: FrameCache) => {
      if (fcs.has(fc)) return;
      fcs.add(fc);
      for (let k = 0; k < fc.frames.length; k++) jobs.push(() => keep(fc.get(k)));
    };
    const roof = (a: RoofArt) => {
      for (const f of a.faces) {
        keep(f.whole.cv);
        for (const t of f.tris) keep(t.cv);
      }
    };
    for (const b of this.boxes) {
      for (const list of [0, 1]) for (const w of this.warmList(b, list)) jobs.push(() => keep(w.dark ? w.fc.dark(w.k) : w.fc.get(w.k)));
      for (let q = 0; q < 4; q++) jobs.push(() => roof(this.roofArt(b, q)));
    }
    for (const fc of this.hedgeTops) frames(fc);
    for (const fc of this.propFrames) frames(fc);
    for (const fc of this.houseFrames) frames(fc);
    for (const fc of this.bossFrames) frames(fc);
    for (let i = 0; i < STATUES.length; i++) jobs.push(() => keep(this.statueAt(i)));
    // (The sidekicks' frames: cut from their sheets once they've loaded, as the town opens.)
    for (const sp of this.spriteArt.values())
      jobs.push(() => {
        sp.cut();
        if (!sp.ready) return sp.failed ? undefined : false;
        for (const a of SPRITE_ANIMS) for (const c of sp.frames[a]) keep(c);
      });
    // (Painted ahead by planBoxes from here on: nothing left to paint. Marked done so it doesn't walk them again.)
    jobs.push(() => {
      for (const at of this.warmAt) at.fill(-1);
    });
    return jobs;
  }
  /** The quarters in the order they're painted ahead (planBoxes). */
  private readonly warmQ = new Int32Array(4);
  /** Each box's next picture to paint ahead in each of its two lists (warmList); -1: all painted. */
  private warmAt!: [Int32Array, Int32Array];
  private readonly warmLists: ({ fc: FrameCache; k: number; dark: boolean }[] | undefined)[][] = [[], []];
  /**
   * Box `b`'s pictures to paint ahead (made once a box): list 0, its sides' and back's (as drawWall shows them, and a step darker,
   * turned from the light); list 1, its front's frames and each a step darker (a front at a slant: drawBoxFront's drawWall).
   */
  private warmList(b: BoxInst, list: number): { fc: FrameCache; k: number; dark: boolean }[] {
    let l = this.warmLists[list]![b.i];
    if (l) return l;
    l = [];
    if (list === 0) {
      const B = b.box;
      for (const side of [b.hideL ? null : B.left, b.hideR ? null : B.right, B.back ?? B.rear]) {
        if (!side) continue;
        const fc = this.wallFc(side.ch);
        l.push({ fc, k: 0, dark: false }, { fc, k: 0, dark: true });
      }
    } else {
      const hi = b.home ? this.places.findIndex((h) => h.id === b.home) : -1;
      const pi = hi < 0 ? this.propBox.indexOf(b) : -1;
      const fc = hi >= 0 ? this.houseFrames[hi] : pi >= 0 ? this.propFrames[pi] : undefined;
      if (fc) for (let k = 0; k < fc.frames.length; k++) l.push({ fc, k, dark: false }, { fc, k, dark: true });
    }
    this.warmLists[list]![b.i] = l;
    return l;
  }
  /** Paints the next picture of box `b`'s list ahead (one a call: a frame's budget is checked between them). */
  private warmNext(b: BoxInst, list: number): void {
    const l = this.warmList(b, list);
    const at = this.warmAt[list]!;
    const k = at[b.i]!;
    const w = l[k];
    if (w) {
      if (w.dark) w.fc.dark(w.k);
      else w.fc.get(w.k);
    }
    at[b.i] = k + 1 >= l.length ? -1 : k + 1;
  }
  /** Whether any square of box `i`'s footprint is seen this frame. */
  private boxSeen(i: number): boolean {
    const ks = this.boxSq[i]!;
    for (let j = 0; j < ks.length; j++) if (this.seen[ks[j]!]) return true;
    return false;
  }
  private readonly ahead = new Int32Array(512);
  private readonly aheadD = new Float64Array(512);
  /** A box's roof painted for the camera facing north or east (box-draw.ts), made the first time it's asked for (shared by every box of that art facing that way). */
  private roofArt(b: BoxInst, q: number): RoofArt {
    const box = b.box;
    const had = this.instArt[q]![b.i];
    if (had) return had;
    let m = this.roofs.get(box);
    if (!m) this.roofs.set(box, (m = new Map()));
    // (A flat roof is lit the same whichever way the camera faces: one painting serves all four. Round 4's flat fronts are most of them.)
    const flat = geomOf(box).faces.every((f) => f.nz > 0.999);
    const key = flat ? "flat" : `${b.facing}${q}`;
    let a = m.get(key);
    if (!a) {
      const t0 = REC ? performance.now() : 0;
      m.set(key, (a = bakeRoof(b, box, flat ? 0 : q)));
      if (REC) REC.paint(performance.now() - t0);
    }
    this.instArt[q]![b.i] = a;
    return a;
  }
  /** Each box's roof paintings as it last asked for them, by heading (no lookup a frame). */
  private readonly instArt: (RoofArt | undefined)[][] = [[], [], [], []];

  /** A box-backed item's place (its front's; a shed or hedge: the whole box's), from its plan. */
  private frontPos(it: Item, b: BoxInst): void {
    const p = this.plans[b.i]!;
    const v = this.view;
    const whole = b.kind === "shed" || b.kind === "hedge";
    it.dx = p.front.dx;
    it.dz = p.front.dz;
    // (A run of hedge is drawn by its first square's item; the others stand down.)
    it.on = (whole ? p.on : p.front.on) && radial(v, it.dx, it.dz) < v.rim && (b.props.length === 0 || it.i === b.prop);
    it.sz = it.kind === "prop" ? it.dz + 0.05 : it.dz;
  }
  /** A side's, back's or roof's item: its place from its box's plan. */
  private partPos(it: Item): void {
    const b = this.boxes[it.i >> 2]!;
    const p = this.plans[b.i]!;
    const k = it.i & 3;
    const v = this.view;
    if (k === 3) {
      it.dx = p.roofDx;
      it.dz = p.roofDz;
      it.on = p.nOrder > 0;
    } else {
      const w = k === 0 ? p.left : k === 1 ? p.right : p.back;
      it.dx = w.dx;
      it.dz = w.dz;
      it.on = w.on;
    }
    it.on &&= radial(v, it.dx, it.dz) < v.rim + 1;
    it.sz = it.dz;
    it.faded = false;
  }

  /** How strongly a part at (dx, dz) shows (its fade at the rim, the far band's), and the band's softening there. */
  private partAlpha(dx: number, dz: number): number {
    const v = this.view;
    return (1 - 0.6 * bandOf(v, dx, dz)) * enterOf(v, dx, dz);
  }

  /**
   * A home's or an everyday building's front: facing the camera (upright, its foot level: the town's way, as one picture, softened in
   * the far band, its sign written, its lights lit), or at a slant (its strips, shaded as it turns from the camera).
   */
  private drawBoxFront(it: Item, b: BoxInst, now: number): void {
    const home = it.kind === "house";
    const p = this.plans[b.i]!;
    const w = p.front;
    const v = this.view;
    const fc = home ? this.houseFrames[it.i]! : this.propFrames[it.i]!;
    const ch = fc.ch;
    const phase = it.i * (home ? 613 : 389);
    const img = fc.at(now, home ? it.i * 613 : it.i * 211);
    const s = bandOf(v, w.dx, w.dz);
    const alpha = (1 - 0.6 * s) * enterOf(v, w.dx, w.dz);
    const k = (w.k0 + w.k1) / 2;
    const px = k / TOWN_FEEL.housePxPerSquare;
    const fy = (w.y0 + w.y1) / 2;
    const x0 = w.x0;
    const y0 = fy - ch.foot[1] * px;
    const W = w.x1 - w.x0;
    const H = ch.h * px;
    const glow = this.lightK > 0.01 ? (home ? this.glowOf(it.i) : this.frontGlowOf(fc, PROPS[it.i]!.lot!)) : null;
    const sign = home ? artOf(this.places[it.i]!).sign : null;
    if (w.strips === 1 && Math.abs(w.y1 - w.y0) < 0.75 && w.shade < 0.004 && w.s0 === 0 && w.s1 === 1) {
      const { ctx } = this;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = px < 1.5;
      if (s > 0.02) this.blitSoft(img, x0, y0, W, H, s, 0.88 * s);
      else ctx.drawImage(img, x0, y0, W, H);
      const ta = alpha * clamp(1 - 2 * s, 0, 1);
      if (sign && sign.w > 0 && TOWN_FEEL.signNames && ta > 0.02) this.writeSign(it.i, x0 + sign.x * px, y0 + sign.y * px, sign.w * px, sign.h * px, ta);
      ctx.restore();
      this.cover(img, x0, y0, W, H, alpha);
      if (glow) this.lightUp(glow, x0, y0, px, alpha * (1 - 0.88 * s), now, phase);
      this.box(it, k, x0, y0, x0 + W, y0 + H, x0 + W / 2, fy, y0);
    } else {
      this.drawWall(w, img, ch, alpha, glow, false, now, phase);
      const ta = alpha * clamp(1 - 2 * s, 0, 1);
      if (sign && sign.w > 0 && TOWN_FEEL.signNames && ta > 0.02) {
        this.wallAffine(w, ch, sign.x, sign.x + sign.w, false);
        this.writeSignT(it.i, sign, px, ta);
      }
      this.box(it, k, Math.min(w.x0, w.x1), Math.min(w.y0 - (ch.foot[1] * w.k0) / TOWN_FEEL.housePxPerSquare, w.y1 - (ch.foot[1] * w.k1) / TOWN_FEEL.housePxPerSquare), Math.max(w.x0, w.x1), Math.max(w.y0, w.y1) + 3 * px, x0 + W / 2, fy, y0);
    }
    if (home) {
      const nm = this.names[it.i]!;
      nm.x = x0 + W / 2;
      nm.y = p.topY;
      nm.eave = p.eaveY;
      nm.dz = w.dz;
      nm.a = alpha;
      nm.k = k;
    }
  }

  /** A shed or a square of hedge: its sides, its roof (a hedge's top) and its front, together. */
  private drawBoxWhole(it: Item, b: BoxInst, now: number): void {
    const p = this.plans[b.i]!;
    const B = b.box;
    const w = p.front;
    const alpha = this.partAlpha(w.dx, w.dz);
    if (alpha <= 0.004) return;
    if (p.left.on && B.left) this.drawWall(p.left, this.wallFrame(B.left.ch), B.left.ch, alpha, null, true, now, 0);
    if (p.right.on && B.right) this.drawWall(p.right, this.wallFrame(B.right.ch), B.right.ch, alpha, null, true, now, 0);
    this.drawRoof(b, B, p, alpha);
    const fc = this.propFrames[it.i]!;
    if (w.on) this.drawWall(w, fc.at(now, it.i * 211), fc.ch, alpha, null, false, now, 0);
    this.box(it, (w.k0 + w.k1) / 2, p.minX, p.minY, p.maxX, p.maxY, (w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, p.minY);
  }

  /** A box's side, back or roof. */
  private drawPart(it: Item, now: number): void {
    const b = this.boxes[it.i >> 2]!;
    const p = this.plans[b.i]!;
    const B = b.box;
    const k = it.i & 3;
    if (k === 3) {
      this.drawRoof(b, B, p, this.partAlpha(p.roofDx, p.roofDz));
      this.box(it, 1, p.minX, p.minY, p.maxX, p.maxY, (p.minX + p.maxX) / 2, p.maxY, p.minY);
      return;
    }
    const w = k === 0 ? p.left : k === 1 ? p.right : p.back;
    const side = k === 0 ? B.left : k === 1 ? B.right : (B.back ?? B.rear);
    if (!side) return;
    const alpha = this.partAlpha(w.dx, w.dz);
    if (alpha <= 0.004) return;
    const glow = this.lightK > 0.01 ? this.wallGlowOf(side.ch, side.lights) : null;
    this.drawWall(w, this.wallFrame(side.ch), side.ch, alpha, glow, true, now, b.i * 97 + k);
    const bb = this.bb;
    this.box(it, (w.k0 + w.k1) / 2, bb[0]!, bb[1]!, bb[2]!, bb[3]!, (w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, bb[1]!);
  }
  /** A side's or back's picture (one frame), made once. */
  private wallFrame(ch: Character): HTMLCanvasElement {
    return this.wallFc(ch).get(0);
  }
  private wallFc(ch: Character): FrameCache {
    let fc = this.wallFrames.get(ch);
    if (!fc) this.wallFrames.set(ch, (fc = new FrameCache(ch)));
    return fc;
  }
  /** A side's windows lit at dusk and night (the art's: its own lights, baked as a front's are), once a picture. */
  private wallGlowOf(ch: Character, lights: readonly LightSpot[]): Glow | null {
    let g = this.wallGlow.get(ch);
    if (g === undefined) this.wallGlow.set(ch, (g = lights.length ? bakeGlow(ch, lights, []) : null));
    return g;
  }

  /** Where on screen a wall's picture column `s` of the way along stands (perspective-correct between its ends): into wq. */
  private wallAt(w: WallPlan, s0: number): void {
    // (Its drawn part only: a wall cut at the camera's near plane runs s0..s1 of its picture between its ends.)
    const s = (s0 - w.s0) / (w.s1 - w.s0 || 1);
    const a = (1 - s) * w.k0;
    const c = s * w.k1;
    const d = a + c || 1;
    const q = this.wq;
    q[0] = (a * w.x0 + c * w.x1) / d;
    q[1] = (a * w.y0 + c * w.y1) / d;
    q[2] = (w.k0 * w.k1) / ((1 - s) * w.k1 + s * w.k0 || 1);
  }
  private readonly wq = new Float64Array(3);
  /**
   * The affine (this.M) drawing a wall's picture columns u0..u1 between where they stand: its foot exact at both, its height at the
   * nearer end's scale (`tall`: so a strip's top steps up under the roof's eave, never down from it) or their mean.
   */
  private wallAffine(w: WallPlan, ch: Character, u0: number, u1: number, tall: boolean): void {
    const pw = ch.w;
    this.wallAt(w, clamp(u0 / pw, w.s0, w.s1));
    const xa = this.wq[0]!;
    const ya = this.wq[1]!;
    const ka = this.wq[2]!;
    this.wallAt(w, clamp(u1 / pw, w.s0, w.s1));
    const xb = this.wq[0]!;
    const yb = this.wq[1]!;
    const kb = this.wq[2]!;
    const ua = clamp(u0, w.s0 * pw, w.s1 * pw);
    const du = Math.max(1e-3, clamp(u1, w.s0 * pw, w.s1 * pw) - ua);
    const sc = (tall ? Math.max(ka, kb) : (ka + kb) / 2) / TOWN_FEEL.housePxPerSquare;
    const m = this.M;
    m[0] = (xb - xa) / du;
    m[1] = (yb - ya) / du;
    m[2] = 0;
    m[3] = sc;
    m[4] = xa - ua * m[0];
    m[5] = ya - ua * m[1] - ch.foot[1] * sc;
  }
  private readonly M = new Float64Array(6);
  /** The last wall's box on screen (x0, y0, x1, y1). */
  private readonly bb = new Float64Array(4);

  /** A wall in its strips (its shade over each), cutting what it covers out of the lights behind; its own lights. */
  private drawWall(w: WallPlan, img: HTMLCanvasElement, ch: Character, alpha: number, glow: Glow | null, tall: boolean, now: number, phase: number): void {
    const n = w.strips;
    const pw = ch.w;
    // (Its light: the picture as it is, or its frame one ramp step darker, a side turned from the light: kit/bake.ts.)
    const pic = w.step < 0 ? darkFrame(img) : img;
    const bb = this.bb;
    bb[0] = bb[1] = Infinity;
    bb[2] = bb[3] = -Infinity;
    this.ctx.imageSmoothingEnabled = Math.max(w.k0, w.k1) / TOWN_FEEL.housePxPerSquare < 1.5;
    const p0 = w.s0 * pw;
    const pr = (w.s1 - w.s0) * pw;
    for (let j = 0; j < n; j++) {
      const u0 = p0 + (j * pr) / n;
      const u1 = p0 + ((j + 1) * pr) / n;
      this.wallAffine(w, ch, u0, u1, tall);
      const m = this.M;
      this.drawT(pic, m, u0, 0, u1 - u0, ch.h, u0, 0, u1 - u0, ch.h, alpha, j < n - 1);
      this.coverT(img, m, u0, 0, u1 - u0, ch.h, alpha);
      // (Its box: the strip's corners.)
      for (let c = 0; c < 4; c++) {
        const X = c & 1 ? u1 : u0;
        const Y = c & 2 ? ch.h : 0;
        const x = m[0]! * X + m[2]! * Y + m[4]!;
        const y = m[1]! * X + m[3]! * Y + m[5]!;
        if (x < bb[0]!) bb[0] = x;
        if (y < bb[1]!) bb[1] = y;
        if (x > bb[2]!) bb[2] = x;
        if (y > bb[3]!) bb[3] = y;
      }
    }
    this.untransform();
    if (glow && this.lightK * alpha > 0.004) {
      const fl = this.flicker(now, phase);
      const crisp = Math.max(w.k0, w.k1) / TOWN_FEEL.housePxPerSquare >= 1.5;
      for (const pc of glow.pieces) {
        this.wallAffine(w, ch, pc.x, pc.x + pc.cv.width, tall);
        this.lightT(pc.cv, this.M, pc.x, pc.y, pc.cv.width, pc.cv.height, this.lightK * alpha * (pc.flicker ? fl : 1), crisp);
      }
    }
  }

  /** A box's roof: its faces far to near, the north and east paintings blended as the camera turns. */
  private drawRoof(b: BoxInst, B: TownBox, p: BoxPlan, alpha: number): void {
    if (p.nOrder === 0 || alpha <= 0.004) return;
    const g = geomOf(B);
    // (Its painting for the quarter the camera faces to 38 degrees round, the next quarter's from 52, the two blended between: a blend
    // draws twice, so it's kept short.)
    const hq = ((this.heading % 360) + 360) % 360;
    const q0 = Math.floor(hq / 90) % 4;
    const east = clamp((hq - q0 * 90 - 38) / 14, 0, 1);
    const artN = east < 0.996 ? this.roofArt(b, q0) : null;
    const artE = east > 0.004 ? this.roofArt(b, (q0 + 1) % 4) : null;
    for (let o = 0; o < p.nOrder; o++) {
      const i = p.order[o]!;
      const fg = g.faces[i]!;
      const fp = p.faces[i]!;
      for (let pass = 0; pass < 2; pass++) {
        const art = pass ? artE : artN;
        if (!art) continue;
        const a = pass && artN ? alpha * east : alpha;
        const fa = art.faces[i]!;
        if (fp.whole) {
          const l = fg.n - 1;
          if (affine(fg.tx[0]!, fg.ty[0]!, fp.x[0]!, fp.y[0]!, fg.tx[1]!, fg.ty[1]!, fp.x[1]!, fp.y[1]!, fg.tx[l]!, fg.ty[l]!, fp.x[l]!, fp.y[l]!, this.M)) this.drawPiece(fa.whole, a);
        } else
          for (let t = 0; t < fg.n - 2; t++) {
            const c1 = t + 1;
            const c2 = t + 2;
            if (affine(fg.tx[0]!, fg.ty[0]!, fp.x[0]!, fp.y[0]!, fg.tx[c1]!, fg.ty[c1]!, fp.x[c1]!, fp.y[c1]!, fg.tx[c2]!, fg.ty[c2]!, fp.x[c2]!, fp.y[c2]!, this.M)) this.drawPiece(fa.tris[t]!, a);
          }
      }
    }
    this.untransform();
  }
  /** A roof's painted piece through this.M (its texture's points to the screen). */
  private drawPiece(pc: Piece, a: number): void {
    const m = this.M;
    this.ctx.imageSmoothingEnabled = Math.sqrt(Math.abs(m[0]! * m[3]! - m[1]! * m[2]!)) < 1.5;
    this.drawT(pc.cv, m, pc.sx, pc.sy, pc.w, pc.h, pc.sx - pc.ox, pc.sy - pc.oy, pc.w, pc.h, a, false);
    this.coverT(pc.cv, m, pc.sx, pc.sy, pc.w, pc.h, a, pc.sx - pc.ox, pc.sy - pc.oy);
  }

  /** `img`'s (sx, sy, sw, sh) drawn at (dx, dy, dw, dh) through the affine `m` (CSS px), `a` strong (`seam`: half a pixel wider, so strips meet). */
  private drawT(img: CanvasImageSource, m: Float64Array, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number, a: number, seam: boolean): void {
    if (a <= 0.004) return;
    const { ctx, DPR } = this;
    ctx.setTransform(DPR * m[0]!, DPR * m[1]!, DPR * m[2]!, DPR * m[3]!, DPR * m[4]!, DPR * m[5]!);
    ctx.globalAlpha = a;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, seam ? dw + 0.6 / Math.max(0.01, Math.hypot(m[0]!, m[1]!)) : dw, dh);
    // (The transform is left as it is: the caller puts the town's back once its pieces are drawn, `untransform`.)
  }
  /** The town's own transform and full strength back, after pieces drawn through `drawT`. */
  private untransform(): void {
    const { ctx, DPR } = this;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
  }
  /** What was just drawn through `m` cuts its shape out of the lights it covers (as `cover`). */
  private coverT(img: CanvasImageSource, m: Float64Array, sx: number, sy: number, sw: number, sh: number, a: number, dx = sx, dy = sy): void {
    if (this.nLit === 0 || a <= 0.02) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let c = 0; c < 4; c++) {
      const X = c & 1 ? dx + sw : dx;
      const Y = c & 2 ? dy + sh : dy;
      const x = m[0]! * X + m[2]! * Y + m[4]!;
      const y = m[1]! * X + m[3]! * Y + m[5]!;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const b = this.litBox;
    let cx0 = Infinity;
    let cy0 = Infinity;
    let cx1 = -Infinity;
    let cy1 = -Infinity;
    for (let k = 0; k < this.nLit * 4; k += 4)
      if (x0 < b[k + 2]! && x1 > b[k]! && y0 < b[k + 3]! && y1 > b[k + 1]!) {
        cx0 = Math.min(cx0, b[k]!);
        cy0 = Math.min(cy0, b[k + 1]!);
        cx1 = Math.max(cx1, b[k + 2]!);
        cy1 = Math.max(cy1, b[k + 3]!);
      }
    if (cx0 === Infinity) return;
    const { DPR } = this;
    const g = this.layer!.g;
    g.save();
    g.globalCompositeOperation = "destination-out";
    g.globalAlpha = Math.min(1, a);
    g.beginPath();
    g.rect(cx0, cy0, cx1 - cx0, cy1 - cy0);
    g.clip();
    g.setTransform(DPR * m[0]!, DPR * m[1]!, DPR * m[2]!, DPR * m[3]!, DPR * m[4]!, DPR * m[5]!);
    g.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);
    g.restore();
  }
  /** Adds a light through the affine `m` (as `light`): `img` over (x, y, w, h) in the picture's pixels. */
  private lightT(img: HTMLCanvasElement, m: Float64Array, x: number, y: number, w: number, h: number, a: number, crisp: boolean): void {
    if (a <= 0.004) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let c = 0; c < 4; c++) {
      const X = c & 1 ? x + w : x;
      const Y = c & 2 ? y + h : y;
      const sx = m[0]! * X + m[2]! * Y + m[4]!;
      const sy = m[1]! * X + m[3]! * Y + m[5]!;
      x0 = Math.min(x0, sx);
      y0 = Math.min(y0, sy);
      x1 = Math.max(x1, sx);
      y1 = Math.max(y1, sy);
    }
    if (x0 > this.W || y0 > this.H || x1 < 0 || y1 < 0) return;
    const { DPR } = this;
    const L = this.layer!;
    const g = L.g;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = Math.min(1, a);
    g.imageSmoothingEnabled = !crisp;
    g.setTransform(DPR * m[0]!, DPR * m[1]!, DPR * m[2]!, DPR * m[3]!, DPR * m[4]!, DPR * m[5]!);
    g.drawImage(img, x, y, w, h);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    this.markLit(x0, y0, x1 - x0, y1 - y0);
  }
  /** Notes a light's box on the screen (what's drawn later over it cuts into it) and its layer's tiles. */
  private markLit(x: number, y: number, w: number, h: number): void {
    const L = this.layer!;
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

  /** A home's name on its sign, through this.M (a front at a slant): its lettering as `writeSign` sizes it, laid in the sign's middle. */
  private writeSignT(i: number, sign: { x: number; y: number; w: number; h: number }, px: number, alpha: number): void {
    const { ctx, DPR } = this;
    const sg = this.signs[i]!;
    const fit = Math.min((sign.w * px) / sg.w, (sign.h * px) / sg.h) * 0.94;
    const s = Math.floor(fit * DPR + 0.25);
    if (s < 1 || (s / DPR) * CAP < TOWN_FEEL.signMinCap) return;
    let art = sg.art[s];
    if (!art) art = sg.art[s] = renderLines(sg.lines, sg.w, sg.h, s, SIGN_INK);
    // (In the picture's pixels: the lettering's CSS size over the front's scale.)
    const w = (sg.w * s) / DPR / px;
    const h = (sg.h * s) / DPR / px;
    const m = this.M;
    // (Snapped, round 4: the lettering's corner on a whole device pixel, and level when the front's slant over it is under 2%, so the
    // letters stay crisp and don't shimmer as the camera glides; they still lean with a front seen at a slant.)
    const lx = sign.x + (sign.w - w) / 2;
    const ly = sign.y + (sign.h - h) / 2;
    const level = Math.abs(m[1]!) < 0.02 * Math.abs(m[0]!);
    const tx = Math.round(DPR * (m[0]! * lx + m[2]! * ly + m[4]!));
    const ty = Math.round(DPR * (m[1]! * lx + m[3]! * ly + m[5]!));
    ctx.setTransform(DPR * m[0]!, level ? 0 : DPR * m[1]!, DPR * m[2]!, DPR * m[3]!, tx, ty);
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(art, 0, 0, w, h);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
  }

  /**
   * The street town (Nov 5, the art's "nothing between the camera and you"): a building's front, a home's or a shed standing more than
   * `streetNearCut` squares nearer the camera than its focus (you, as it follows you) isn't drawn (nor tapped); a tree there fades out over `streetTreeFade` squares
   * nearer still (`nearFade`, read by drawProp). Hedges, beds and bushes are low: drawn.
   */
  private nearCut(items: Item[]): void {
    const f = TOWN_FEEL;
    // (From the camera's focus, which is you as it follows you; looking round, wherever it looks.)
    const cut = -f.streetNearCut;
    for (const it of items) {
      if (!it.on || it.dz >= cut) continue;
      if (it.kind === "house" && it.i < this.homes.length) it.on = false;
      else if (it.kind === "prop") {
        const k = PROPS[it.i]!.kind;
        if (k === "front" || k === "shed") it.on = false;
      }
    }
  }
  /**
   * A figure's view and facing as the camera sees it (round 4's chase camera, Eric: figures stay billboards with the views we have):
   * the way it last walked turned into the camera's frame, so walking ahead of the camera shows its back, toward it its front, across
   * it its side (flipped to the way it goes).
   */
  private viewOf(w: Walker): 0 | 1 | 2 {
    const v = this.view;
    const across = w.wdc * v.hc - w.wdr * v.hs;
    const ahead = w.wdc * v.hs + w.wdr * v.hc;
    return Math.abs(across) > Math.abs(ahead) + 1e-6 ? 0 : ahead > 0 ? 1 : 2;
  }
  private faceOf(w: Walker): 1 | -1 {
    const v = this.view;
    const across = w.wdc * v.hc - w.wdr * v.hs;
    return Math.abs(across) < 1e-6 ? w.facing : across < 0 ? -1 : 1;
  }
  /** How much of a street-town tree shows, by how far nearer the camera than its focus it stands (1: all). */
  private nearFade(it: Item): number {
    const f = TOWN_FEEL;
    return clamp((it.dz + f.streetNearCut + f.streetTreeFade) / f.streetTreeFade, 0, 1);
  }

  /**
   * The street town (Eric, Nov 4: every figure whole on screen, never cut off by the page's edge): how much of a figure (a boss, a bot,
   * anyone but you) shows, by how near its drawing comes to the box's foot or either side, fading out over the last half square before
   * it would be cut (1: all). `halfW`: half its drawing's width, in squares.
   */
  private edgeFade(it: Item, halfW: number): number {
    const p = this.ep;
    if (!proj(this.view, it.dx, it.dz, 0, p)) return 0;
    const m = 0.5 * p.k;
    return clamp(Math.min(this.H - (p.y + 0.15 * p.k), p.x - halfW * p.k, this.W - (p.x + halfW * p.k)) / m, 0, 1);
  }
  private readonly ep = newPt();

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
    const prop = PROPS[it.i]!;
    // (A tree, and the plaza's statues and chess pieces (the north edge round), nearer the camera than you fade out: never between.)
    const alpha = (1 - 0.6 * s) * enterOf(v, it.dx, it.dz) * (prop.kind === "tree" || prop.kind === "statue" || prop.kind === "piece" ? this.nearFade(it) : 1);
    if (alpha <= 0.004) return;
    // A statue on the street town's plaza (the north edge round): its figure (or its close-up) and its quote, as today's over the
    // Colosseum's picture.
    if (prop.kind === "statue") {
      const sh = statueH(STATUES[prop.v]!.id) * px;
      const sx = p.x - (STATUE_W / 2) * px;
      this.drawStatueAt(prop.v, sx, p.y - sh, px, alpha, s, now);
      ctx.globalAlpha = 1;
      this.box(it, p.depth, sx, p.y - sh, sx + STATUE_W * px, p.y, p.x, p.y, p.y - sh);
      return;
    }
    const img = fc.at(now, it.i * 211);
    // A hedge running north to south (along Seam Avenue): its top and the side the camera sees, laid along the ground.
    if (prop.kind === "hedge" && prop.x !== Math.round(prop.x)) return this.sideHedge(it, img, prop.v, alpha, now);
    // A hedge's top (the street town's): its tile laid flat from its face back over its depth, at its height, before its face.
    if (prop.kind === "hedge") this.hedgeTop(it, prop.v, x0, w, p.y - HEDGE.tall * px, alpha, now);
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
    // A building's front, its windows lit at dusk and night (the street town's: each picture's lights baked once).
    if (this.lightK > 0.01 && prop.kind === "front") this.lightUp(this.frontGlowOf(fc, prop.lot!), x0, y0, px, alpha * (1 - 0.88 * s), now, it.i * 389);
    this.propTop[it.i] = p.y - (PROPS[it.i]!.kind === "table" ? TABLE_TOP * px : ch.foot[1] * px);
    this.box(it, p.depth, x0, y0, x0 + w, y0 + h, p.x, p.y, y0);
    if (prop.kind === "table") this.drawBoard(it, prop.table, ts!, now, alpha * (1 - 0.88 * s), s);
  }

  /** A hedge's top: its tile over the strip from its face (`yFace`, its top's front edge on the screen) back `HEDGE.deep` squares. */
  private hedgeTop(it: Item, v: number, x0: number, w: number, yFace: number, alpha: number, now: number): void {
    const { ctx, view: vw } = this;
    const q = this.bq;
    if (!proj(vw, it.dx, it.dz + HEDGE.deep, 0, q)) return;
    const yBack = q.y - (HEDGE.tall * q.k) / TOWN_FEEL.housePxPerSquare;
    if (yFace - yBack < 0.5) return;
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.hedgeTops[v % 3]!.at(now, 0), x0, yBack, w, yFace - yBack + 0.5);
    ctx.globalAlpha = 1;
  }
  /**
   * A hedge along Seam Avenue (the street town's), which runs north to south, so the north-facing camera sees it end on: its top laid
   * flat over its depth, then the side facing the camera's column, each its tile mapped onto the ground's square (an affine fit).
   */
  private sideHedge(it: Item, face: HTMLCanvasElement, v: number, alpha: number, now: number): void {
    const { ctx, view: vw, DPR } = this;
    const S = TOWN_FEEL.housePxPerSquare;
    const half = HEDGE.deep / 2;
    // (The face nearer the camera's column: its east one when the hedge is left of the camera, else its west one.)
    const near = it.dx < 0 ? it.dx + half : it.dx - half;
    const far = it.dx < 0 ? it.dx - half : it.dx + half;
    const a = this.hA;
    const b = this.hB;
    const c = this.hC;
    if (!proj(vw, near, it.dz - 0.5, 0, a) || !proj(vw, near, it.dz + 0.5, 0, b) || !proj(vw, far, it.dz - 0.5, 0, c)) return;
    const up = (q: { y: number; k: number }) => q.y - (HEDGE.tall * q.k) / S;
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    // Its top: the tile's columns along the avenue (south to north), its rows across its depth.
    const top = this.hedgeTops[v % 3]!.at(now, 0);
    ctx.setTransform((DPR * (b.x - a.x)) / S, (DPR * (up(b) - up(a))) / S, (DPR * (c.x - a.x)) / S, (DPR * (up(c) - up(a))) / S, DPR * a.x, DPR * up(a));
    ctx.drawImage(top, 0, 0);
    // Its side: the face's columns along the avenue, its rows down to the ground (a picture pixel k / 37 screen pixels).
    const k = (a.k + b.k) / 2;
    ctx.setTransform((DPR * (b.x - a.x)) / S, (DPR * (up(b) - up(a))) / S, 0, (DPR * k) / S, DPR * a.x, DPR * up(a));
    ctx.drawImage(face, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    const x0 = Math.min(a.x, b.x, c.x);
    const x1 = Math.max(a.x, b.x, c.x);
    this.box(it, a.depth, x0, Math.min(up(b), up(c)), x1, Math.max(a.y, b.y), (a.x + b.x) / 2, (a.y + b.y) / 2, Math.min(up(b), up(c)));
  }
  private readonly hA = newPt();
  private readonly hB = newPt();
  private readonly hC = newPt();
  /** A front's lights (its building's), baked once a picture; null: none. */
  private frontGlowOf(fc: FrameCache, lot: number): Glow | null {
    let g = this.frontGlow.get(fc);
    if (g === undefined) {
      const box = lotArt(STREET_BUILDINGS[lot]!);
      g = box.lights.length ? bakeGlow(box.front, box.lights, []) : null;
      this.frontGlow.set(fc, g);
    }
    return g;
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
    const g = art2d(c);
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
    const g = art2d(c);
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
    const { ctx, view: v, DPR } = this;
    const B = TABLE_BOARD;
    const a = this.bp;
    const b = this.bq;
    // Where the table's picture stands (its foot), and its top (`tableLift`).
    if (!proj(v, it.dx, it.dz, 0, a)) return;
    const fx = a.x;
    const fy = a.y;
    const fk = a.k;
    // Low on the screen, near the camera, the board is worked out a little farther off and drawn at the picture's own
    // place and scale (`tableLift`: lifted in the camera's true perspective there, it would warp).
    const lift = this.lift;
    if (!tableLift(v, it.dx, it.dz, B.top, B.thick, lift)) return;
    const dz = lift.dz;
    if (dz !== it.dz && !proj(v, it.dx, dz, 0, a)) return;
    // (Screen x and y from where it's worked out: x * m + tx.)
    const m = fk / a.k;
    const tx = fx - a.x * m;
    const ty = fy - a.y * m;
    const { top, thick } = lift;
    // The world's pictures stand like cut-outs (no lean): the top stays straight over its leg.
    const footX = a.x;
    if (!proj(v, it.dx, dz, top, b)) return;
    const shift = b.x - footX;
    const hb = B.board;
    const sq = (2 * hb) / 8;
    for (let gi = 0; gi < 9; gi++)
      for (let fi = 0; fi < 9; fi++) if (!proj(v, it.dx - hb + fi * sq, dz - hb + gi * sq, top, this.grid[gi * 9 + fi]!)) return;
    const near = s <= TOWN_FEEL.tableFarCut;
    const game = near ? this.gameFor(ti, state.kind === "playing", now) : null;
    const pcs = near ? (game?.pcs ?? (this.stillSet ??= setUp())) : [];
    const f = TOWN_FEEL;
    const moving = !!game && pcs.some((q) => now - q.t0 < f.tableSlideMs || (q.gone > 0 && now < q.gone));
    const paint = (g: Ctx) => {
      if (m === 1) return this.paintBoard(g, it.dx, dz, top, thick, shift, pcs, game ? now : -1);
      g.save();
      g.transform(m, 0, 0, m, tx, ty);
      this.paintBoard(g, it.dx, dz, top, thick, shift, pcs, game ? now : -1);
      g.restore();
    };
    // The same picture as the last frame (camera, alpha and pieces alike): once seen twice, it's kept and reused.
    const c0 = this.grid[0]!;
    const c8 = this.grid[80]!;
    const key = `${Math.round((c0.x * m + tx) * 8)},${Math.round((c0.y * m + ty) * 8)},${Math.round((c8.x * m + tx) * 8)},${Math.round((c8.y * m + ty) * 8)},${Math.round(shift * m * 8)},${pcs.length},${game?.moves ?? -1},${game ? game.since : 0},${DPR}`;
    const cache = (this.boardCache[ti] ??= { key: "", seen: "", cv: null, x: 0, y: 0, w: 0, h: 0 });
    ctx.globalAlpha = alpha;
    if (moving || key !== cache.seen) {
      cache.seen = moving ? "" : key;
      cache.key = "";
      paint(ctx);
    } else {
      if (cache.key !== key) this.cacheBoard(cache, key, it.dx, dz, top, thick, shift, b.k * B.piecePx * m, m, tx, ty, paint);
      if (cache.cv) ctx.drawImage(cache.cv, cache.x, cache.y, cache.w, cache.h);
      else paint(ctx);
    }
    // The game's clock, floating over the middle of the board, straight above the leg.
    if (game && proj(v, it.dx, dz, top + B.clockLift, a)) {
      const secs = Math.floor((now - game.since) / 1000);
      const img = this.clockImg(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
      const ps = a.k * m * B.clockPx;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, footX * m + tx - (img.width * ps) / 2, a.y * m + ty - img.height * ps, img.width * ps, img.height * ps);
    }
    ctx.globalAlpha = 1;
  }

  private readonly lift: TableLift = { dz: 0, top: 0, thick: 0, grow: 1 };
  private stillSet: TablePiece[] | null = null;
  private boardCache: { key: string; seen: string; cv: HTMLCanvasElement | null; x: number; y: number; w: number; h: number }[] = [];

  /**
   * Paints table's slab, board and pieces into `cache` (its box: the slab's corners and the tallest piece over them),
   * worked out at (dx, dz) and drawn at x * m + tx, y * m + ty (drawBoard).
   */
  private cacheBoard(cache: (typeof this.boardCache)[number], key: string, dx: number, dz: number, top: number, thick: number, shift: number, ps: number, m: number, tx: number, ty: number, paint: (g: Ctx) => void): void {
    const { view: v, DPR } = this;
    const a = this.bp;
    const h = TABLE_BOARD.half;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, z, l] of [[-h, -h, top], [h, -h, top], [h, h, top], [-h, h, top], [-h, -h, top - thick], [h, -h, top - thick]] as const) {
      if (!proj(v, dx + x, dz + z, l, a)) return void (cache.cv = null);
      x0 = Math.min(x0, (a.x - shift) * m + tx);
      x1 = Math.max(x1, (a.x - shift) * m + tx);
      y0 = Math.min(y0, a.y * m + ty);
      y1 = Math.max(y1, a.y * m + ty);
    }
    // (The tallest piece, the king, stands 13 of its pixels over its square.)
    const king = 13 * ps + 2;
    x0 = Math.floor((x0 - 2) * DPR) / DPR;
    y0 = Math.floor((y0 - king) * DPR) / DPR;
    const w = Math.ceil((x1 + 2 - x0) * DPR);
    const hh = Math.ceil((y1 + 2 - y0) * DPR);
    if (w <= 0 || hh <= 0 || w * hh > 4_000_000) return void (cache.cv = null);
    const cv = cache.cv ?? document.createElement("canvas");
    if (cv.width !== w || cv.height !== hh) {
      cv.width = w;
      cv.height = hh;
    }
    const g = art2d(cv);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, hh);
    g.setTransform(DPR, 0, 0, DPR, -x0 * DPR, -y0 * DPR);
    paint(g);
    this.paint.changed(cv);
    Object.assign(cache, { key, cv, x: x0, y: y0, w: w / DPR, h: hh / DPR });
  }

  /** The slab, the board and `pcs` on it, into `g` in the screen's coordinates (`now` < 0: the pieces at rest). */
  private paintBoard(g: Ctx, dx: number, dz: number, top: number, thick: number, shift: number, pcs: readonly TablePiece[], now: number): void {
    const { view: v } = this;
    const B = TABLE_BOARD;
    const pal = PARK_TABLE.palette;
    const a = this.bp;
    const b = this.bq;
    const quad = (pts: readonly (readonly [number, number, number])[], fill: string) => {
      g.beginPath();
      for (let n = 0; n < pts.length; n++) {
        const [x, z, l] = pts[n]!;
        if (!proj(v, dx + x, dz + z, l, a)) return;
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
      if (!proj(v, dx - hb + (pf + 0.5) * sq, dz - hb + (pg + 0.5) * sq, top + lift, b)) continue;
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
      const cv = this.paint.layer();
      this.layers.push({ cv, g: cv.g, tiles: new Uint8Array(0), nx: 0, ny: 0 });
    }
    const L = (this.layer = this.layers[this.layer === this.layers[0] ? 1 : 0] ?? this.layers[0]!);
    const { canvas } = this.ctx;
    // (Sized like the world's canvas; a new size clears it.)
    if (L.cv.width !== canvas.width || L.cv.height !== canvas.height) {
      L.cv.size(canvas.width, canvas.height);
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
  private readonly layRun = (x: number, y: number, w: number, h: number) => this.ctx.drawImage(this.layer!.cv.src, x, y, w, h, x, y, w, h);
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
    this.markLit(x, y, w, h);
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

  /** (Tests) Where lamp `i` (its index in LAMPS)'s glass is on the screen now; false when it isn't drawn, or something nearer stands (or a name tag lies) over it. */
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
    // (Nor a name tag over it: they're drawn over everything.)
    return !this.labelOver(out.x, out.y);
  }

  /**
   * (Tests) A point on a place's first light (`i`: its index, the homes then the Colosseum) where it shows now: a lit
   * pixel amid lit ones, nothing standing in front of it and no name tag over it (the nearest such to the light's middle);
   * false if none.
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
      if (!(out.x > 0 && out.x < this.W && out.y > 0 && out.y < this.H) || this.labelOver(out.x, out.y)) continue;
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
      const d = Math.max(0, Math.abs(wrapFX(me.x - h.cx)) - h.half, Math.abs(wrapFY(me.y - h.cy)) - h.half);
      const a = nm.a * clamp((f.nameShowFrom - d) / (f.nameShowFrom - f.nameFullAt), 0, 1);
      if (a <= 0.01) continue;
      const size = Math.round(clamp((15 * nm.k) / v.kf, 12, 20));
      ctx.globalAlpha = a;
      ctx.font = NAME_FONT[size]!;
      let widths = this.nameW.get(h.name);
      if (!widths) this.nameW.set(h.name, (widths = []));
      const tw = widths[size] ?? (widths[size] = ctx.measureText(h.name).width);
      let y = nm.y - 6;
      // The street town (Nov 5, round 3): just over its own roof, and lower (down to its eave) while it would lie over a building behind.
      if (!Number.isNaN(nm.eave)) {
        // (Round 4: a name shows only with its home. Not while the home is passing beside the camera (its front cut at the near side,
        // the mockup's ghost "Lodge"), nor where a nearer building stands over the spot it would take.)
        const hb = this.homeBox[i];
        const fp = hb ? this.plans[hb.i]!.front : null;
        if (fp && (!fp.on || fp.s0 > 0.02 || fp.s1 < 0.98)) continue;
        // (Nor cut off at the box's side: a home mostly off screen beside the camera, its name half drawn at the edge.)
        if (nm.x - tw / 2 < 2 || nm.x + tw / 2 > this.W - 2) continue;
        y = nm.y - f.nameOverRoof;
        while (y + f.nameDropStep <= nm.eave && this.overBehind(nm.x - tw / 2 - 2, y - size - 2, tw + 4, size + 4, nm.dz)) y += f.nameDropStep;
        if (this.overNearer(nm.x - tw / 2 - 2, y - size - 2, tw + 4, size + 4, nm.dz)) continue;
      }
      y += (1 - a) * f.nameRise;
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

  /** Whether the box (x, y, w, h) on screen lies under a street-town building standing nearer than `dz` (drawn this frame): it'd hide it. */
  private overNearer(x: number, y: number, w: number, h: number, dz: number): boolean {
    for (const b of this.boxes) {
      if (b.kind === "hedge" || b.kind === "shed") continue;
      const p = this.plans[b.i]!;
      if (!p.on || p.front.dz >= dz - 0.5 || p.maxX < x || p.minX > x + w || p.maxY < y || p.minY > y + h) continue;
      return true;
    }
    return false;
  }
  /** Whether the box (x, y, w, h) on screen lies over a street-town building standing behind `dz` (drawn this frame). */
  private overBehind(x: number, y: number, w: number, h: number, dz: number): boolean {
    for (const b of this.boxes) {
      if (b.kind === "hedge") continue;
      const p = this.plans[b.i]!;
      if (!p.on || p.front.dz <= dz + 0.5 || p.maxX < x || p.minX > x + w || p.maxY < y || p.minY > y + h) continue;
      return true;
    }
    return false;
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

  /**
   * A pawn on its ride (Oct 31, rides.ts): one picture, as a pawn is. Standing, the ride's idle; stepping, its move, one cycle
   * a step (its frames' times scaled to the step: the walk keeps its pace), lifted by the move's hop instead of the hobble. The
   * pawn keeps its size (`box`: its pawn's box in squares). Its name tag (and its card) sits over its top standing and doesn't
   * jump with the hop, as a sidekick's doesn't. Nov 1 (rides v2): seen the way it last walked (`view`: its side, mirrored to
   * face its walk; its back walking up the screen; its front walking down), standing in that view's idle.
   */
  private drawRider(it: Item, rd: Rider, pose: Pose, facing: number, view: 0 | 1 | 2, box: number, t: number, seen?: { anim: "" | "idle" | "move"; frame: number; facing: number; view: number }): void {
    if (!proj(this.view, it.dx, it.dz, 0, this.p)) return;
    const rv = rd.views[view];
    // (Only its side is mirrored: its back and front are drawn as they are.)
    const flip = rv.facing === "side" ? facing : 1;
    const sq = (box * rv.h) / 100;
    let img: HTMLCanvasElement;
    let lift = 0;
    let i: number;
    if (pose.step) {
      i = rv.moveIndex(pose.t);
      img = rv.frames.move[i]!;
      lift = (rv.lift[i]! * box) / 100;
    } else img = rv.frames.idle[(i = rv.idleIndex(t))]!;
    if (seen) {
      seen.anim = pose.step ? "move" : "idle";
      seen.frame = i;
      seen.facing = flip;
      seen.view = rv === rd.views[0] ? 0 : view;
    }
    this.drawSprite(it, img, sq, rv.footX, rv.footY, rv.w / rv.h, lift, 0, flip, rd.shadow, rv.top + lift / sq);
    // Taps: only the pawn's own box across (its picture's, as on foot), not the ride's reach, so a tap on the square beside a
    // rider walks there as it does beside a pawn.
    const half = (box * (1 + 2 * rd.pawn.pad) * this.p.k) / 2;
    it.x0 = Math.max(it.x0, it.fx - half);
    it.x1 = Math.min(it.x1, it.fx + half);
  }

  /** (Tests) Your trail now: the ride's marks showing (by view: side, back, front) and the droplets showing. */
  marksShown(): { side: number; back: number; front: number; drops: number } {
    const now = performance.now();
    const out = { side: 0, back: 0, front: 0, drops: 0 };
    for (const m of this.marks) if (m.tr && now - m.t0 < m.tr.life) out[(["side", "back", "front"] as const)[m.view]!]++;
    for (const d of this.drops) if (now - d.t0 < TOWN_FEEL.trailLifeMs) out.drops++;
    return out;
  }

  /** The rider a person is drawn as now (their ride's frames ready, not seated at a table), or null: on foot. */
  private riderOf(p: Person): Rider | null {
    const rd = p.you ? this.youRider : this.riders.get(p.id);
    return rd && !seated(p) ? rd : null;
  }

  /** The rider a person on foot will be drawn as once its frames come (not seated at a table, none drawn now), or null. */
  private soonOf(p: Person): Rider | null {
    const rd = p.you ? this.youSoon : this.ridersSoon.get(p.id);
    return rd?.coming && !seated(p) && !this.riderOf(p) ? rd : null;
  }

  /**
   * A person on foot whose rider is coming (`soonOf`): their box and tag as the rider's will be, standing in this view (its
   * measured numbers, as drawRider places it), so neither moves when the ride appears. Only the box: the pawn is drawn on foot.
   */
  private soonBox(it: Item, rd: Rider | null, view: 0 | 1 | 2, box: number): void {
    if (!rd) return;
    const rv = rd.views[view];
    const h = ((box * rv.h) / 100) * this.p.k;
    it.y0 = it.fy - rv.footY * h;
    it.y1 = it.y0 + h;
    it.hy = it.y0 + rv.top * h;
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
    const { ctx, DPR } = this;
    const f = 1 / (1 + 0.9 * TOWN_FEEL.bandBlur * s);
    const k = DPR * f;
    // (WebGL: the same shrink, haze and stretch back in one draw, no scratch canvas.)
    if (this.paint.soft) return this.paint.soft(img, bx, by, bw, bh, k, haze, this.colors.horizon);
    const pw = Math.ceil(bw * k) + 2;
    const ph = Math.ceil(bh * k) + 2;
    let sc = this.softs[this.nSoft++];
    if (!sc) {
      const cv = document.createElement("canvas");
      this.softs.push((sc = { cv, g: cv.getContext("2d")! }));
    }
    const { cv: soft, g: sg } = sc;
    if (soft.width < pw || soft.height < ph) {
      soft.width = Math.max(soft.width, pw);
      soft.height = Math.max(soft.height, ph);
    }
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = "source-over";
    sg.globalAlpha = 1;
    // Only the part this picture uses, and two pixels round it: the scaled draws sample a pixel past their edges, and
    // the rest is never read.
    sg.clearRect(0, 0, Math.min(soft.width, pw + 2), Math.min(soft.height, ph + 2));
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
    if (art.sign.w > 0 && TOWN_FEEL.signNames && ta > 0.02) this.writeSign(it.i, x0 + art.sign.x * px, y0 + art.sign.y * px, art.sign.w * px, art.sign.h * px, ta);
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

  /** A name tag over a figure: white for the pawns, gold for you, blue for a boss's sidekick; it shrinks with distance. Stamped from its drawing (`tagArtOf`). */
  private drawTag(text: string, ax: number, ay: number, kind: TagKind, size: number, alpha: number): void {
    const { ctx, DPR } = this;
    const a = this.tagArtOf(text, Math.round(size), kind);
    if (a.fonts !== fontsLoaded) this.paintTag(a, text);
    a.used = this.frameNo;
    this.keepFree(ax - a.w / 2, ay - a.h, a.w, a.h);
    // (On the device's pixel grid, so the drawing lands pixel for pixel.)
    const cw = a.cv.width;
    const x = (Math.round((ax - a.w / 2) * DPR) - TAG_PAD) / DPR;
    const y = (Math.round((ay - a.h) * DPR) - TAG_PAD) / DPR;
    ctx.globalAlpha = alpha;
    if (alpha >= 1) ctx.drawImage(a.cv, 0, 0, cw, a.rh, x, y, cw / DPR, a.rh / DPR);
    // Fading: its shadow, its pill and its name each at that alpha, one over the other, as they were drawn before (the
    // whole tag at that alpha would show less of the pill through the name).
    else for (let r = 1; r < 4; r++) ctx.drawImage(a.cv, 0, r * a.rh, cw, a.rh, x, y, cw / DPR, a.rh / DPR);
  }

  /**
   * A name tag's drawing at size `s` of a kind (drawn by paintTag, as drawTag drew it each frame before): its pill (white, gold for
   * you, blue for a sidekick: `TAG_STYLE`) with its soft shadow and its name; in four rows of its canvas, each `rh` device pixels high:
   * the whole tag, then its shadow alone, its pill alone and its name alone (for a fading tag). One per name, size and kind.
   */
  private tagArtOf(text: string, s: number, kind: TagKind): TagArt {
    const { DPR } = this;
    if (this.tagDpr !== DPR) {
      this.tagArt.clear();
      this.tagDpr = DPR;
    }
    const had = this.tagArt.find(text, s, kind);
    if (had) return had;
    // A new one: a canvas of its own, or the least lately used one's (never one drawn this frame or the last, which
    // this frame may still draw: a crowd of more names than TAG_ART_MAX on screen keeps them all).
    const old = this.tagArt.evict(this.frameNo);
    const a: TagArt = { cv: old?.cv ?? document.createElement("canvas"), w: 0, h: 0, rh: 0, s, kind, used: this.frameNo, fonts: -1 };
    this.tagArt.add(text, a);
    return a;
  }

  /** Draws a tag's four rows (`tagArtOf`) into its canvas, sized to its name in its font. */
  private paintTag(a: TagArt, text: string): void {
    const { DPR } = this;
    const { cv, s } = a;
    a.fonts = fontsLoaded;
    const g = art2d(cv);
    g.font = TAG_FONT[s]!;
    const w = (a.w = g.measureText(text).width + s * 1.25);
    const h = (a.h = s + (8 * s) / 11);
    const rh = (a.rh = Math.ceil(h * DPR) + 2 * TAG_PAD);
    cv.width = Math.ceil(w * DPR) + 2 * TAG_PAD;
    cv.height = 4 * rh;
    const { pill, ink } = TAG_STYLE[a.kind];
    g.font = TAG_FONT[s]!;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let r = 0; r < 4; r++) {
      g.setTransform(DPR, 0, 0, DPR, TAG_PAD, TAG_PAD + r * rh);
      if (r <= 1) {
        g.shadowColor = "rgba(0,0,0,.25)";
        g.shadowBlur = 4;
      }
      // (Its shadow alone: the pill drawn far off the canvas, its shadow thrown back onto it. Shadows' offsets are in
      // the canvas's pixels, whatever the transform.)
      if (r === 1) g.shadowOffsetX = TAG_THROW * DPR;
      if (r <= 2) {
        g.fillStyle = pill;
        roundRect(g, r === 1 ? -TAG_THROW : 0, 0, w, h, h / 2);
        g.fill();
      }
      g.shadowColor = "transparent";
      g.shadowBlur = 0;
      g.shadowOffsetX = 0;
      if (r === 0 || r === 3) {
        g.fillStyle = ink;
        g.fillText(text, w / 2, h / 2);
      }
    }
    this.paint.changed(cv);
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
    const { view: v, p, q4, rq } = this;
    rel(v, this.camX, this.camY, c, r, rq);
    const dx = rq.dx;
    const dz = rq.dz;
    if (radial(v, dx, dz) > v.rim) return false;
    const h = 0.5 * scale;
    // (Its corners are the world's: turned with the camera, far left first as the quarter it faces most nearly has them.)
    const q = ((Math.round(v.heading / 90) % 4) + 4) % 4;
    for (let i = 0; i < 4; i++) {
      const j = (i + q) % 4;
      toCam(v, CORNERS[j * 2]! * h, CORNERS[j * 2 + 1]! * h, rq);
      if (!proj(v, dx + rq.dx, dz + rq.dz - drop, 0, p)) return false;
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
    rel(this.view, this.camX, this.camY, c, r, this.rq);
    return proj(this.view, this.rq.dx, this.rq.dz, 0, this.p) ? this.p.k : 0;
  }

  /** Your trail's droplets, your destination's mark, and the pressed square: on the ground, before anyone stands on it. */
  private drawMarks(now: number): void {
    const { ctx, town } = this;
    const f = TOWN_FEEL;
    // A droplet on each square you leave as you run (one at most every trailEveryMs); on a ride with a trail (Nov 1, rides v2),
    // its mark on each square you leave instead (every `every` squares), pointing the way you went.
    const w = town.you.walker;
    const hc = w.hereC();
    const hr = w.hereR();
    const rd = this.youRider;
    const tr = rd && !seated(town.you) ? rd.trail : null;
    if (!w.moving()) this.markRun = 0;
    if (hc !== this.lastC || hr !== this.lastR) {
      if (this.lastC >= 0 && tr) {
        if (this.markRun++ % tr.every === 0) {
          const m = this.marks[this.markNext++ % this.marks.length]!;
          const dc = wrapFX(hc - this.lastC);
          const dr = wrapFY(hr - this.lastR);
          m.c = this.lastC;
          m.r = this.lastR;
          m.t0 = now;
          m.view = dc ? 0 : dr > 0 ? 1 : 2;
          m.flip = dc < 0 ? -1 : 1;
          m.n = this.markRun - 1;
          m.tr = tr;
        }
      } else if (this.lastC >= 0 && now - this.dropAt >= f.trailEveryMs) {
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
    for (const m of this.marks) {
      const mt = m.tr;
      const age = now - m.t0;
      if (!mt || age < 0 || age >= mt.life) continue;
      let fi = 0;
      while (fi < mt.ends.length - 1 && age >= mt.ends[fi]!) fi++;
      const img = mt.frames[m.view]?.[m.n & 1]?.[fi];
      if (!img || !img.width) continue;
      rel(this.view, this.camX, this.camY, m.c, m.r, this.rq);
      const dx = this.rq.dx;
      const dz = this.rq.dz;
      if (radial(this.view, dx, dz) > this.view.rim || !proj(this.view, dx, dz, 0, this.p)) continue;
      // (Its box is in the pawn's square's units: your pawn's box is youSquares squares across.)
      const u = (this.p.k * f.youSquares) / 100;
      const mw = mt.w * u;
      const mh = mt.h * u;
      ctx.globalAlpha = enterOf(this.view, dx, dz);
      if (m.flip < 0) {
        ctx.save();
        ctx.translate(this.p.x, 0);
        ctx.scale(-1, 1);
        ctx.translate(-this.p.x, 0);
        ctx.drawImage(img, this.p.x - mw / 2, this.p.y - mh / 2, mw, mh);
        ctx.restore();
      } else ctx.drawImage(img, this.p.x - mw / 2, this.p.y - mh / 2, mw, mh);
    }
    for (const d of this.drops) {
      const a = (now - d.t0) / f.trailLifeMs;
      if (a < 0 || a >= 1) continue;
      rel(this.view, this.camX, this.camY, d.c, d.r, this.rq);
      const dx = this.rq.dx;
      const dz = this.rq.dz;
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
      rel(this.view, this.camX, this.camY, gc, gr, this.rq);
      if (!(ps.on && ps.c === gc && ps.r === gr) && proj(this.view, this.rq.dx, this.rq.dz, 0, this.p)) {
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
      const home = this.town.bosses[i]!.home;
      const id = home.id;
      out.x = it.fx;
      // (A stand-in's face box isn't his: Rolling Dough's chip shows its door. The top of his picture.)
      out.y = it.y0 + ((hasTownBoss(home) ? BOSS_FACE[id][1] : 0) / figureArt(id).h) * (it.y1 - it.y0) - 4;
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
        if (this.clearAt(out.x, out.y, (h) => h?.kind === "person" && h.person === this.town.people[i])) return true;
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
        if (this.clearAt(out.x, out.y, (h) => h?.kind === "table" && h.table === TABLES[i])) return true;
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
        if (this.clearAt(out.x, out.y, (h) => h?.kind === "statue" && h.statue === STATUES[i])) return true;
      }
      return false;
    }
    const it = kind === "boss" ? this.bossItems[i]! : this.houseItems[i]!;
    if (!it.on) return false;
    const ok = (x: number, y: number) =>
      this.clearAt(x, y, (h) => (kind === "boss" ? h?.kind === "boss" && h.boss === this.town.bosses[i] : i >= this.homes.length ? h?.kind === "coliseum" : h?.kind === "house" && h.home === this.homes[i]));
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

  /**
   * (Tests, `tapPoint`) Is (x, y) a point a tap reaches `is` at, with room round it: the point and the points `TAP_ROOM_PX` across and
   * along from it all on screen and on it. Nov 14: Glim's point lay 0.2 px above your pawn's box, and the tap's whole pixel (CDP rounds)
   * landed on your pawn: nothing opened.
   */
  private clearAt(x: number, y: number, is: (h: Hit | null) => boolean): boolean {
    const d = TAP_ROOM_PX;
    for (const [u, v] of [[0, 0], [-d, 0], [d, 0], [0, -d], [0, d]] as const) {
      const px = x + u;
      const py = y + v;
      if (!(px > 0 && px < this.W && py > 0 && py < this.H) || !is(this.pick(px, py))) return false;
    }
    return true;
  }

  /** A sidekick's face for the game's strip (its idle's first frame, an image's address), or null for a pawn. */
  spriteFace(p: Person): string | null {
    return isSprite(p.look) ? (this.spriteArt.get(p.look.sprite)?.face() ?? null) : null;
  }

  /** A person's item this frame (`i`: its index in the people), or null. */
  /** Where square (c, r)'s middle is on screen this frame (for tests: a fixed point of the world). False if it isn't on screen. */
  squareAt(c: number, r: number, out: { x: number; y: number }): boolean {
    rel(this.view, this.camX, this.camY, c, r, this.rq);
    if (!proj(this.view, this.rq.dx, this.rq.dz, 0, this.p)) return false;
    out.x = this.p.x;
    out.y = this.p.y;
    return out.x > 0 && out.x < this.W && out.y > 0 && out.y < this.H;
  }
  /**
   * Where a tap on square (c, r) lands this frame (for tests: to walk somewhere): its middle, or, where something stands over that on
   * screen (a figure and its tag, a lamp, a front: a tap there would hit it, round 4's close chase camera puts your own pawn over the
   * squares just ahead), the nearest point of the square a tap reaches as that square. False if no part of it is on screen and clear.
   */
  tapSquareAt(c: number, r: number, out: { x: number; y: number }): boolean {
    const wc = colI(c);
    const wr = rowI(r);
    for (let k = 0; k < SQUARE_SPOTS.length; k += 2) {
      rel(this.view, this.camX, this.camY, c + SQUARE_SPOTS[k]!, r + SQUARE_SPOTS[k + 1]!, this.rq);
      if (!proj(this.view, this.rq.dx, this.rq.dz, 0, this.p)) continue;
      const x = this.p.x;
      const y = this.p.y;
      if (!(x > 0 && x < this.W && y > 0 && y < this.H)) continue;
      const h = this.pick(x, y);
      if (h?.kind !== "square" || h.c !== wc || h.r !== wr) continue;
      out.x = x;
      out.y = y;
      return true;
    }
    return false;
  }

  /** (Tests) Every figure the last frame drew (the bosses, then the people): its name, its box and foot on screen, how strongly it showed. */
  figureBoxes(): { name: string; x0: number; y0: number; x1: number; y1: number; fy: number; alpha: number }[] {
    const out: { name: string; x0: number; y0: number; x1: number; y1: number; fy: number; alpha: number }[] = [];
    for (const it of this.items) {
      if (!it.on || (it.kind !== "boss" && it.kind !== "person")) continue;
      const name = it.kind === "boss" ? figureName(this.town.bosses[it.i]!.home) : this.town.people[it.i]!.name;
      out.push({ name, x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, fy: it.fy, alpha: it.kind === "boss" ? this.bossAlpha[it.i] ?? 1 : this.personAlpha[it.i] ?? 1 });
    }
    return out;
  }
  /**
   * (Tests) The street town's boxes the last frame drew: each one's art, which way it faces, whether its front was drawn and faced you,
   * and how many of its sides were drawn.
   */
  boxDraws(): { id: string; kind: string; facing: "S" | "N" | "W" | "E"; front: boolean; facesYou: boolean; sides: number; x: number; y: number; foot: number[] | null }[] {
    return this.boxes
      .filter((b) => this.plans[b.i]!.on)
      .map((b) => {
        const p = this.plans[b.i]!;
        const f = p.front;
        // (Its front faces you: turned neither way from the camera, so unshaded.)
        // (Its front line's middle in the world, round 5: what stands where.)
        // (The north edge round: its front's foot on screen as drawn, its ends' x and y (s0..s1 of it if cut): where it stands as you turn.)
        return { id: b.box.id, kind: b.kind, facing: b.facing, front: f.on, facesYou: f.on && f.shade < 0.004, sides: +p.left.on + +p.right.on, x: ((b.fx % N) + N) % N, y: b.fy, foot: f.on ? this.footOf(b, f) : null };
      });
  }
  /** (Tests) A box's front's drawn ends on screen and the world points they stand for: [x0, y0, x1, y1, s0, s1, wx0, wy0, wx1, wy1]. */
  private footOf(b: BoxInst, f: WallPlan): number[] {
    const pt = { x: 0, y: 0 };
    const out = [f.x0, f.y0, f.x1, f.y1, f.s0, f.s1];
    for (const s of [f.s0, f.s1]) {
      boxPoint(b, b.box, s * b.box.front.w, 0, pt);
      out.push(((pt.x % N) + N) % N, pt.y);
    }
    return out;
  }
  private readonly bossAlpha: number[] = [];
  private readonly personAlpha: number[] = [];

  /** (Tests) Person i as the last frame drew them: their box on screen, their foot and the top of their head (their tag sits on it). */
  drawnBox(i: number): { x0: number; y0: number; x1: number; y1: number; fx: number; fy: number; hy: number } | null {
    const it = this.personItem(i);
    return it?.on ? { x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, fx: it.fx, fy: it.fy, hy: it.hy } : null;
  }

  private personItem(i: number): Item | null {
    for (const it of this.items) if (it.kind === "person" && it.i === i) return it;
    return null;
  }

  /**
   * What's under (x, y) in the box: a home, a boss or a person (nearest first), else a square, else null (the sky). `skipYou`: your own
   * pawn is see-through to it (what stands or lies under you: Town.tsx `pickTap`).
   */
  pick(x: number, y: number, skipYou = false): Hit | null {
    // (Nothing under the street town's minimap: a tap there is the map's. The test hooks' tap points keep off it this way too.)
    const mb = MAP_BOX;
    if (mb.w > 0 && x >= mb.x && x <= mb.x + mb.w && y >= mb.y && y <= mb.y + mb.h) return null;
    // (A tap on a row's front, or on any building's side, back or roof, never opens something drawn behind it: the street town's
    // Colosseum rises over the rows' roofs (the paused round's guard, the north edge round). Only the ground under the tap is left.)
    let overFront = false;
    // (A home whose picture's box the tap is in, on a see-through pixel: Nov 12, below.)
    let boxOf: Home | null = null;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]!;
      if (!it.on || it.faded || x < it.x0 || x > it.x1 || y < it.y0 || y > it.y1) continue;
      if (overFront) continue;
      if (it.kind === "house") {
        // A home's picture is wide: only its drawn part (not the sky around its roof) counts.
        if (it.i >= this.homes.length) {
          const st = this.statueHit(x, y);
          if (st) return { kind: "statue", statue: st };
        }
        if (!this.houseHit(it, x, y)) {
          if (it.i < this.homes.length) boxOf ??= this.homes[it.i]!;
          continue;
        }
        if (it.i >= this.homes.length) return { kind: "coliseum" };
        return { kind: "house", home: this.homes[it.i]! };
      }
      if (it.kind === "boss") return { kind: "boss", boss: this.town.bosses[it.i]! };
      // (A street-town home's side, back or roof: the home. An everyday building's: the ground behind, as its front.)
      if (it.kind === "part") {
        const b = this.boxes[it.i >> 2]!;
        // (The Colosseum's ring and portal: the Colosseum.)
        if (b.kind === "ring" || b.kind === "portal") return { kind: "coliseum" };
        const home = b.home ? this.homes.find((o) => o.id === b.home) : null;
        if (home) return { kind: "house", home };
        overFront = true;
        continue;
      }
      if (it.kind === "prop") {
        // A chess table (its stools too): its table. A statue: the statue; a chess piece before the Colosseum, or its ring: the Colosseum.
        // A tree, a bench or the fountain: the square under the tap. A building's front: nothing behind it.
        const pr = PROPS[it.i]!;
        if (pr.kind === "table" && this.propHit(it, x, y)) return { kind: "table", table: TABLES[pr.table]! };
        if (pr.kind === "statue") {
          const st = this.statueHit(x, y);
          if (st) return { kind: "statue", statue: st };
          continue;
        }
        if (pr.kind === "piece" && this.propHit(it, x, y)) return { kind: "coliseum" };
        if (pr.kind === "front" && this.propHit(it, x, y)) {
          if (this.propBox[it.i]?.kind === "ring") return { kind: "coliseum" };
          overFront = true;
        }
        continue;
      }
      const person = this.town.people[it.i]!;
      if (skipYou && person.you) continue;
      return { kind: "person", person };
    }
    const sq = pickSquare(this.view, this.camX, this.camY, x, y);
    // (Nov 12, Eric: "more grace where you can click anywhere near or on the building".) A see-through pixel of a home's picture (between
    // its pyramid and its flagpole, round its door) over ground within a square of its plot, and no other home's: that home.
    if (sq && boxOf && plotDist(boxOf, sq.c, sq.r) <= 1 && !plotAt[sq.r * N + sq.c]) return { kind: "house", home: boxOf };
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
      const img = this.statueAt(i);
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
        if ((hi.on && hi.x1 > 0 && hi.x0 < W && hi.y0 < H && hi.y1 > 0)) continue;
      } else {
        if (hi.on && hi.fx > 0 && hi.fx < W && hi.hy < H) continue;
        if (town.bosses[i]?.onScreen) continue; // (the bosses are in the homes' order: world.ts; Rolling Dough's guard, a stand-in, last)
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
      rel(v, this.camX, this.camY, h.cx, h.cy, this.rq);
      const dx0 = this.rq.dx;
      const dz0 = this.rq.dz;
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
    const b = this.town.bosses.findIndex((x) => x.home.id === place.id);
    // (A stand-in's home, Rolling Dough's: its own picture's door, not him.)
    return { img: b < 0 || !hasTownBoss(this.town.bosses[b]!.home) ? this.houseFrames[this.places.indexOf(place)]!.get(0) : this.bossFrames[b]!.get(0), box: BOSS_FACE[place.id] };
  }
}

const SHADOW = "rgb(60,35,10)";
/** The ring's points round its circle. */
/** A square's corners from its middle, in half-squares: far left, far right, near right, near left. */
const CORNERS = [-1, 1, 1, 1, 1, -1, -1, -1] as const;
const SCRATCH_ORDER: number[] = [];
/**
 * The things far to near, in place (Oct 28): an insertion sort, stable like Array.prototype.sort (the same order), and
 * nothing allocated (the engine's sort copies the array each time); the list is nearly in order from the last frame, so
 * it's a pass or so.
 */
function sortFarFirst(a: Item[]): void {
  for (let i = 1; i < a.length; i++) {
    const it = a[i]!;
    let j = i - 1;
    while (j >= 0 && a[j]!.sz < it.sz) {
      a[j + 1] = a[j]!;
      j--;
    }
    a[j + 1] = it;
  }
}
/** Points of a square to tap (offsets from its middle, squares): the middle first, then nearest outward, kept off its edges. */
const SQUARE_SPOTS: readonly number[] = (() => {
  const pts: [number, number][] = [];
  for (const u of [-0.35, -0.2, 0, 0.2, 0.35]) for (const v of [-0.35, -0.2, 0, 0.2, 0.35]) pts.push([u, v]);
  pts.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  return pts.flat();
})();
const dist2 = (h: Place, x: number, y: number) => wrapFX(h.cx - x) ** 2 + wrapFY(h.cy - y) ** 2;
/** The Colosseum's chip shows all of its icon. */
const CHIP_ICON_BOX = [0, 0, COLISEUM_CHIP.w] as const;

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
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

