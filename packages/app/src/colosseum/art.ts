/**
 * The Colosseum's art: **every picture the arena draws is made here and nowhere else**, so each role swaps in at its one
 * place without touching the renderer. Since Oct 31 the arena's own pictures are the API run's drawings
 * (`claude/colosseum-art`, `scripts/boss-art/out/arena-*`, copied into `sprites/`), each a `Character` in the game's sprite
 * format drawn once with `renderFrame` at whole-pixel scales (the scene's and the crowd's textures magnify with nearest-
 * neighbor, so a drawing's pixels stay square however close you sit). The crowd is still the town's own pawns, sidekicks
 * and bosses; the giant pieces are still the board's own (cburnett).
 *
 * - `sceneArt()`: one canvas for the arena's solid parts (the floor, the board's border, the wall's arches, the stands' steps)
 *   and its regions (`SCENE`), as UV rectangles. Each repeating drawing is laid in with a margin of itself round it, so the
 *   smaller copies a far wall is drawn from don't bleed in a neighbor.
 * - `propArt()`: the big pieces (`PROPS`), in one canvas.
 * - `crowdArt()`: everyone who sits in the stands (pawns, sidekicks, bosses), one picture a cell, the players' portraits, and
 *   the arena's standing figures (the torch pillars, the banners, the statue: `figures`), each frame of their loops a cell.
 * - `railingArt()`: the stone railing in front of your seat, a strip along the arena's foot (an image, not a draw call).
 *
 * **Each role and the one place that makes it:**
 *
 * | Role | Made by |
 * | --- | --- |
 * | the arena wall, arched (a slice), and the gallery wall at the top | `arena-wall` (`sprites/arena-wall.ts`): `sceneArt` (SCENE.arch) |
 * | the stands (a slice; seat points) | `arena-stands` (`sprites/arena-stands.ts`): `sceneArt` (SCENE.stepTop, SCENE.riser, SCENE.wallTop, SCENE.parapet); its seat points (16 px apart, 9 px sunk) set where and how low the crowd sits (`SEAT_SINK`) |
 * | a pillar with its torch (5 frames, its flame flickering) | `arena-pillar` (`sprites/arena-pillar.ts`): `crowdArt` (`figures.pillar`) |
 * | a crown banner (6 frames, swaying) | `arena-banner` (`sprites/arena-banner.ts`): `crowdArt` (`figures.banner`) |
 * | the floor and the board's border | `arena-floor` (`sprites/arena-floor.ts`, `floor`, `side`, `corner`): `sceneArt` (SCENE.floor, SCENE.sideTop, SCENE.sideFace, SCENE.corner); the squares `SQUARES` |
 * | the six giant pieces, white and black | `PIECE_URL` (the board's cburnett pieces) in `propArt`; in 3D (the gear's "3D pieces"): meshes made once in `pieces3d.ts` (Eric: the game's basic pieces; `arena-pieces` and `arena-pieces-2` are not used) |
 * | a statue | `arena-statue` (`sprites/arena-statue.ts`): `crowdArt` (`figures.statue`) |
 * | the railing in front of your seat | `arena-railing` (`sprites/arena-railing.ts`): `railingArt` |
 * | pawn backs | none: a front mirrored and darkened in the sprite shader (arena-gl.ts); `arena-crowd-back`'s plain pawns would hide the crate items |
 * | far-crowd figures | none: the same crowd pictures, made smaller by the GPU's mipmaps (the far stands face you) |
 */
import { botLook, type ItemLook } from "@chessroyale/core";
import { renderFrame, type Character } from "../characters/sprite.ts";
import { BOSS_ART, pawnImage } from "../town/render.ts";
import { dressedPawn } from "../town/you-look.ts";
import type { SidekickSheet } from "../town/sidekick-sheets.ts";
import { BOTS, isSprite, type HomeId, type TownBot } from "../town/world.ts";
import { ARENA_BANNER } from "./sprites/arena-banner.ts";
import { ARENA_FLOOR } from "./sprites/arena-floor.ts";
import { ARENA_PILLAR } from "./sprites/arena-pillar.ts";
import { ARENA_RAILING } from "./sprites/arena-railing.ts";
import { ARENA_STANDS, ARENA_STANDS_FRONT, ARENA_STANDS_ROWS, ARENA_STANDS_SEATS } from "./sprites/arena-stands.ts";
import { ARENA_STATUE } from "./sprites/arena-statue.ts";
import { ARENA_WALL } from "./sprites/arena-wall.ts";
import wp from "../board/pieces/cburnett/Chess_plt45.svg?url";
import wn from "../board/pieces/cburnett/Chess_nlt45.svg?url";
import wb from "../board/pieces/cburnett/Chess_blt45.svg?url";
import wr from "../board/pieces/cburnett/Chess_rlt45.svg?url";
import wq from "../board/pieces/cburnett/Chess_qlt45.svg?url";
import wk from "../board/pieces/cburnett/Chess_klt45.svg?url";
import bp from "../board/pieces/cburnett/Chess_pdt45.svg?url";
import bn from "../board/pieces/cburnett/Chess_ndt45.svg?url";
import bb from "../board/pieces/cburnett/Chess_bdt45.svg?url";
import br from "../board/pieces/cburnett/Chess_rdt45.svg?url";
import bq from "../board/pieces/cburnett/Chess_qdt45.svg?url";
import bk from "../board/pieces/cburnett/Chess_kdt45.svg?url";

/** A picture's place in its canvas, as texture coordinates (0 to 1, from the top left). */
export interface Rect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}
const rect = (x: number, y: number, w: number, h: number, size: number): Rect => ({ u0: x / size, v0: y / size, u1: (x + w) / size, v1: (y + h) / size });

/** The board's pieces (cburnett, as on every board in the game): by color and kind ("wp" … "bk"), their pictures' addresses. */
export const PIECE_URL: Record<string, string> = { wp, wn, wb, wr, wq, wk, bp, bn, bb, br, bq, bk };

// ---- Colors.
const rgb = (hex: string): readonly [number, number, number] => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** The stone's flat colors (the wall's top, the aisles' stairs): the drawings' own sandstone keys (lit to shade). */
export const STONE = {
  light: rgb(ARENA_WALL.palette["2"]!),
  mid: rgb(ARENA_WALL.palette["3"]!),
  dark: rgb(ARENA_WALL.palette["4"]!),
  shade: rgb(ARENA_WALL.palette["5"]!),
  /** The aisles' stairs: the brightest key. */
  pale: rgb(ARENA_WALL.palette["1"]!),
} as const;
/** The giant board's squares: the town's table squares (render.ts's SQ_LIGHT, SQ_DARK). */
export const SQUARES = { light: [238, 197, 139], dark: [173, 128, 88] } as const;
/** The sky over the open top. */
export const SKY = [0.55, 0.7, 0.86] as const;

const pixelCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return { c, g };
};

/** The town's pawn's foot, down its box (render.ts: the path's bottom at 39.5 of 45, and half its outline). */
const PAWN_FOOT = 40.25 / 45;

/** A drawing's frame (an animation's `i`th, or a still's) as a canvas at 1:1. */
export function frameCanvas(ch: Character, anim = "idle", i = 0): HTMLCanvasElement {
  const { w, h, data } = renderFrame(ch, ch.anims[anim]!.frames[i]!);
  const { c, g } = pixelCanvas(w, h);
  g.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  return c;
}

/**
 * Lays `src`'s band (sx, sy, w, h) into `g` at (x, y), with a `m`-pixel margin of itself round it: across, the band's own
 * other end (it repeats side by side), or its edge pixels stretched (`wrapX` false); up and down, its edge rows. A far
 * wall is drawn from smaller copies of the texture, which mix each pixel with its neighbors: the margin makes those the
 * band's own.
 */
function laid(g: CanvasRenderingContext2D, src: CanvasImageSource, sx: number, sy: number, w: number, h: number, x: number, y: number, m: number, wrapX = true): void {
  const cols = wrapX
    ? ([[sx + w - m, m, x - m], [sx, w, x], [sx, m, x + w]] as const)
    : ([[sx, 1, x - m, m], [sx, w, x, w], [sx + w - 1, 1, x + w, m]] as const);
  for (const col of cols) {
    const [cx, cw, dx] = col;
    const dw = col.length === 4 ? col[3] : cw;
    g.drawImage(src, cx, sy, cw, h, dx, y, dw, h);
    g.drawImage(src, cx, sy, cw, 1, dx, y - m, dw, m);
    g.drawImage(src, cx, sy + h - 1, cw, 1, dx, y + h, dw, m);
  }
}

/** The scene's canvas size and its regions. */
export const SCENE_PX = 1024;
/** The floor's flags: one 32 px tile a meter (a board square), 20 m of it across the floor's disc. */
export const FLOOR_PX = 32;
const FLOOR_AT = [32, 352] as const;
/** Where each drawing lies in the scene's canvas (pixels): x, y, w, h. */
const AT = {
  arch: [744, 8, 64, 64],
  stands: [744, 96, 64, 88],
  side: [840, 8, 32, 12],
  corner: [840, 40, 12, 12],
} as const;
const sub = (k: keyof typeof AT, y0: number, y1: number, x0 = 0, x1: number = AT[k][2]) => rect(AT[k][0] + x0, AT[k][1] + y0, x1 - x0, y1 - y0 + 1, SCENE_PX);
/** The stands' bands (arena-stands, its third row): a step's top (its back edge's line to the bench's front) and its riser (the lit lip to its foot). */
const ROW = ARENA_STANDS_ROWS[2]!;
export const SCENE = {
  /** A white patch: solid parts (the squares, the wall's top, the aisles) are vertex colors over it. */
  white: rect(1, 1, 6, 6, SCENE_PX),
  /** The floor's flags, 20 m across (the floor's disc, FLOOR_R 10 m). */
  floor: rect(FLOOR_AT[0], FLOOR_AT[1], FLOOR_PX * 20, FLOOR_PX * 20, SCENE_PX),
  /** One arch, the wall's and the gallery's (64 px, a slice that repeats side by side). */
  arch: rect(...AT.arch, SCENE_PX),
  /** A step's top and a riser (64 px across: four seats, 16 px each, a seat point in each one's middle). */
  stepTop: sub("stands", ROW.top, ROW.top + 5),
  riser: sub("stands", ROW.top + 6, ROW.bottom - 1),
  /** The lowest row's front (it sits on the wall's top): its coping over the wall's top, its face up to the first row. */
  wallTop: sub("stands", ARENA_STANDS_FRONT.top, ARENA_STANDS_FRONT.top + 4),
  parapet: sub("stands", ARENA_STANDS_FRONT.top + 5, ARENA_STANDS_FRONT.bottom),
  /** The board's border (arena-floor `side`, 32 px a meter): its top (the outer edge to the squares) and its outer face. */
  sideTop: sub("side", 0, 6),
  sideFace: sub("side", 7, 11),
  /** Its corner's top (arena-floor `corner`'s mitred corner, turned for each corner). */
  corner: sub("corner", 0, 6, 0, 7),
} as const;
/** Seats a stands slice holds across (arena-stands: its seat points every 16 px). */
export const STANDS_SEATS = ARENA_STANDS.w / (ARENA_STANDS_SEATS[1]![0] - ARENA_STANDS_SEATS[0]![0]);
/**
 * How far a seated figure's feet sit below its step's top, as a share of a pawn's height: arena-stands puts each seat
 * point 9 px into the bench in front (its pawns 20 px tall), so the bench hides a seated pawn's foot and the crowd sits on
 * the benches rather than standing on them. (Kept to the base: below the art's 9 of 20, so a pawn's crate items still show.)
 */
export const SEAT_SINK = 0.25;

/** The scene's canvas (made once). */
export function sceneArt(): HTMLCanvasElement {
  const { c, g } = pixelCanvas(SCENE_PX, SCENE_PX);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 8, 8);
  // The floor: its tile repeated over the region and a tile's margin round it.
  const tile = frameCanvas(ARENA_FLOOR, "floor");
  for (let y = FLOOR_AT[1] - FLOOR_PX; y < SCENE_PX; y += FLOOR_PX) for (let x = FLOOR_AT[0] - FLOOR_PX; x < FLOOR_AT[0] + FLOOR_PX * 21; x += FLOOR_PX) g.drawImage(tile, x, y);
  const wall = frameCanvas(ARENA_WALL);
  laid(g, wall, 0, 0, 64, 64, AT.arch[0], AT.arch[1], 8);
  const stands = frameCanvas(ARENA_STANDS);
  laid(g, stands, 0, 0, 64, 88, AT.stands[0], AT.stands[1], 8);
  laid(g, frameCanvas(ARENA_FLOOR, "side"), 0, 0, 32, 12, AT.side[0], AT.side[1], 8);
  laid(g, frameCanvas(ARENA_FLOOR, "corner"), 0, 0, 12, 12, AT.corner[0], AT.corner[1], 6, false);
  return c;
}

// ---- Props: the big pieces.

export const PROP_PX = 1024;
/** Each piece's cell (256 px, "wp" … "bk"); `pieceFoot`: where its foot is, down the cell (0 to 1). */
export const PROPS = {
  piece: Object.fromEntries(Object.keys(PIECE_URL).map((k, i) => [k, rect((i % 4) * 256, Math.floor(i / 4) * 256, 256, 256, PROP_PX)])) as Record<string, Rect>,
  pieceFoot: 40.5 / 45,
} as const;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = no;
    img.src = src;
  });

/** The props' canvas: the pieces (when their pictures have loaded). */
export async function propArt(): Promise<HTMLCanvasElement> {
  const { c, g } = pixelCanvas(PROP_PX, PROP_PX);
  g.imageSmoothingEnabled = true;
  await Promise.all(
    Object.entries(PIECE_URL).map(async ([k, url]) => {
      const img = await loadImage(url);
      const r = PROPS.piece[k]!;
      g.drawImage(img, r.u0 * PROP_PX, r.v0 * PROP_PX, 256, 256);
      // Black's pieces in a dark slate, not pure black, so their shapes read on the floor from far away.
      if (k[0] === "b") {
        const d = g.getImageData(r.u0 * PROP_PX, r.v0 * PROP_PX, 256, 256);
        for (let i = 0; i < d.data.length; i += 4) {
          const l = d.data[i]! / 255;
          d.data[i] = 52 + l * 200;
          d.data[i + 1] = 55 + l * 190;
          d.data[i + 2] = 68 + l * 160;
        }
        g.putImageData(d, r.u0 * PROP_PX, r.v0 * PROP_PX);
      }
    }),
  );
  return c;
}

// ---- The railing in front of your seat.

/** The railing's strip (arena-railing: 128 x 32, repeating side by side, its foot the screen's foot), as an image's address. */
export const RAIL = { w: ARENA_RAILING.w, h: ARENA_RAILING.h } as const;
export function railingArt(): string {
  return frameCanvas(ARENA_RAILING).toDataURL();
}

// ---- The crowd.

/** One picture of the crowd: its cell, where its feet are down the cell (0 to 1), and the cell's height in meters. */
export interface CrowdCell {
  rect: Rect;
  foot: number;
  meters: number;
  /** What it is: a pawn (plain or in crate items), a boss's sidekick, or a boss (drawn a little bigger, beside its sidekick). */
  kind: CrowdKind;
  /** A boss's, or a sidekick's boss's, home. */
  home?: HomeId;
}
export type CrowdKind = "pawn" | "sidekick" | "boss";
export const CROWD_PX = 2048;
const CELL = 128;
const PER_ROW = CROWD_PX / CELL;
/** How tall each kind stands, meters from its head to its feet (a pawn's base a step's width). */
const PAWN_M = 0.62;
const SIDEKICK_M = 0.64;
/** (Eric, Oct 30: "the bosses' sprites are expected to be a little bigger": 1.15 before.) */
const BOSS_M = 1.4;
/** What the pawn's box covers of it: its head at 9 and its foot at 40.25 of 45. */
const PAWN_SPAN = (40.25 - 9) / 45;

/**
 * One of the arena's standing figures (a pillar, a banner, the statue) in the crowd's canvas: its first frame's cell (the
 * drawing's own frame, 1:1), its foot down the frame (0 to 1), its width over its height, its height in pixels, and its
 * loop (`frames` cells side by side, `FIGURE_STRIDE` apart, `ms` each; 1: a still).
 */
export interface Figure {
  rect: Rect;
  foot: number;
  aspect: number;
  px: number;
  frames: number;
  ms: number;
}
/** How far apart a figure's frames lie across the crowd's canvas (texture coordinates: a cell). */
export const FIGURE_STRIDE = CELL / CROWD_PX;
/** The pillar's capital's top, down its drawing (arena-pillar: the abacus at row 28): the pillar's height (arena.ts PILLARS.h) is there. */
export const PILLAR_TOP_PX = 28;

/** The crowd's art: the canvas, its cells, the players' portraits (by their index in BOTS: an image's address), and the arena's figures. */
export interface CrowdArt {
  canvas: HTMLCanvasElement;
  cells: CrowdCell[];
  portraits: Map<number, string>;
  figures: { pillar: Figure; banner: Figure; statue: Figure };
}

const SHEET_URL: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("../town/sidekicks/*.png", { eager: true, query: "?url", import: "default" })).map(([path, url]) => [path.replace(/^.*\/|\.png$/g, ""), url]),
);

/** A picture cut to what's drawn in it, square, standing on its foot in the middle: a portrait for a player's card. */
function portraitOf(c: HTMLCanvasElement): string {
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3]! > 24) ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)));
  if (x1 < 0) return c.toDataURL();
  const size = Math.max(x1 - x0, y1 - y0) + 1;
  const out = document.createElement("canvas");
  out.width = out.height = size;
  const g = out.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, Math.floor((size - (x1 - x0 + 1)) / 2), size - (y1 - y0 + 1), x1 - x0 + 1, y1 - y0 + 1);
  return out.toDataURL();
}

/** A pawn's picture (dressed, or plain), its feet and size. */
async function pawnPicture(side: "light" | "dark", tint: string | null, look: ItemLook | null): Promise<{ c: HTMLCanvasElement; foot: number; meters: number }> {
  const plain = pawnImage(side, tint);
  const art = look ? await dressedPawn(look, plain, Math.round(CELL / 1.3)) : null;
  if (art) {
    const span = 1 + 2 * art.pad;
    return { c: art.img, foot: (art.pad + PAWN_FOOT) / span, meters: (PAWN_M / PAWN_SPAN) * span };
  }
  return { c: plain, foot: PAWN_FOOT, meters: PAWN_M / PAWN_SPAN };
}

/** A sidekick's idle first frame, from its baked sheet. */
async function sidekickPicture(sheet: SidekickSheet): Promise<{ c: HTMLCanvasElement; foot: number; meters: number }> {
  const img = await loadImage(SHEET_URL[sheet.id.replace(/^sidekick-/, "")]!);
  const s = Math.max(sheet.w, sheet.h);
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  // (Its feet in the middle across, its frame at the foot of the square.)
  const dx = Math.round(s / 2 - sheet.foot[0]);
  const dy = s - sheet.h;
  g.drawImage(img, 0, 0, sheet.w, sheet.h, dx, dy, sheet.w, sheet.h);
  return { c, foot: (dy + sheet.foot[1]) / s, meters: (SIDEKICK_M * s) / (sheet.foot[1] - sheet.top.idle) };
}

/** A boss's idle first frame (its sprite), standing on what's drawn. */
function bossPicture(id: HomeId): { c: HTMLCanvasElement; foot: number; meters: number } {
  const ch = BOSS_ART[id];
  const { w, h, data } = renderFrame(ch, ch.anims.idle!.frames[0]!);
  let y0 = h;
  let y1 = -1;
  let x0 = w;
  let x1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3]! > 0) ((y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)), (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)));
  const fw = x1 - x0 + 1;
  const fh = y1 - y0 + 1;
  const s = Math.max(fw, fh);
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  tmp.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  c.getContext("2d")!.drawImage(tmp, x0, y0, fw, fh, Math.floor((s - fw) / 2), s - fh, fw, fh);
  return { c, foot: 1, meters: (BOSS_M * s) / fh };
}

/** The bosses that come to watch: every boss with a sidekick (each sits once, its sidekick beside it: arena.ts `bossSeats`). */
const WATCHING: readonly HomeId[] = BOTS.flatMap((b) => (isSprite(b.look) && b.boss ? [b.boss] : []));
/** The pawn tints of the crowd's plain pawns (the town's bots' tints, and a few more). */
const TINTS: readonly (string | null)[] = [null, "#ffb3c6", "#9fd3ff", "#3c6e5a", "#c9a46b", "#b48ad6", "#f2d16b"];
/** How many crowd pawns in crate items (looks seeded the way every bot's is: `botLook`). */
const DRESSED = 40;

/**
 * Everyone who watches: plain pawns in the town's tints, pawns in bots' crate items (`botLook`), the town bots in their own
 * looks, the bosses' sidekicks and their bosses, one picture a cell; and each player-bot's portrait (BOTS' index).
 */
export async function crowdArt(): Promise<CrowdArt> {
  const pics: { c: HTMLCanvasElement; foot: number; meters: number; kind: CrowdKind; bot?: number; home?: HomeId }[] = [];
  for (const t of TINTS) for (const side of ["light", "dark"] as const) pics.push({ ...(await pawnPicture(side, t, null)), kind: "pawn" });
  for (let i = 0, n = 0; n < DRESSED && i < DRESSED * 4; i++) {
    const look = botLook(`colosseum-${i}`).look;
    if (!look) continue;
    n++;
    pics.push({ ...(await pawnPicture(i % 3 ? "light" : "dark", TINTS[i % TINTS.length]!, look)), kind: "pawn" });
  }
  // (In BOTS' order, whichever picture loads first: the same cells on every load.)
  const bots = await Promise.all(BOTS.map((b: TownBot) => (isSprite(b.look) ? sidekickPicture(b.look.sprite) : pawnPicture(b.look.side, b.look.tint, b.look.wear))));
  bots.forEach((p, i) => {
    const b = BOTS[i]!;
    pics.push({ ...p, kind: isSprite(b.look) ? "sidekick" : "pawn", bot: i, home: isSprite(b.look) ? b.boss : undefined });
  });
  for (const id of WATCHING) pics.push({ ...bossPicture(id), kind: "boss", home: id });

  const { c, g } = pixelCanvas(CROWD_PX, CROWD_PX);
  const cells: CrowdCell[] = [];
  const portraits = new Map<number, string>();
  pics.forEach((p, i) => {
    const x = (i % PER_ROW) * CELL;
    const y = Math.floor(i / PER_ROW) * CELL;
    // (A pixel's margin round each, so the smaller copies a far crowd is drawn from don't bleed into the next cell.)
    g.drawImage(p.c, x + 2, y + 2, CELL - 4, CELL - 4);
    cells.push({ rect: rect(x + 2, y + 2, CELL - 4, CELL - 4, CROWD_PX), foot: p.foot, meters: p.meters, kind: p.kind, home: p.home });
    if (p.bot !== undefined) portraits.set(p.bot, portraitOf(p.c));
  });
  // The arena's figures, on the row after the people's: each frame of a loop in its own cell, drawn 1:1 in its middle.
  let cell = Math.ceil(pics.length / PER_ROW) * PER_ROW;
  const figure = (ch: Character): Figure => {
    const anim = ch.anims.idle!;
    const x0 = (cell % PER_ROW) * CELL + Math.floor((CELL - ch.w) / 2);
    const y0 = Math.floor(cell / PER_ROW) * CELL + Math.floor((CELL - ch.h) / 2);
    anim.frames.forEach((_, i) => g.drawImage(frameCanvas(ch, "idle", i), x0 + i * CELL, y0));
    cell += anim.frames.length;
    // (Its foot: a pillar's and the statue's the bottom row's foot; the banner's its rod's top, where it hangs.)
    return { rect: rect(x0, y0, ch.w, ch.h, CROWD_PX), foot: ch.foot[1] >= ch.h - 1 ? 1 : ch.foot[1] / ch.h, aspect: ch.w / ch.h, px: ch.h, frames: anim.frames.length, ms: anim.frames[0]!.ms };
  };
  const figures = { pillar: figure(ARENA_PILLAR), banner: figure(ARENA_BANNER), statue: figure(ARENA_STATUE) };
  return { canvas: c, cells, portraits, figures };
}
