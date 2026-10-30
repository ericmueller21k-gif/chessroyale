/**
 * The Colosseum's art (Oct 30, the first look): **every picture the arena draws is made here and nowhere else**, so the API
 * run's art (docs/decisions/2026-10-30-colosseum-look.md, "Placeholder art") replaces one function at a time without touching
 * the renderer. Placeholders built from what the town already has: the town's board colors, the board's own pieces
 * (cburnett), the town's pawns in the crate items bots wear, the sidekicks' baked sheets and the bosses' sprites; the stone,
 * arches, banners, flames and the statue drawn here in a few lines of pixel art.
 *
 * - `sceneArt()`: one canvas for the arena's solid parts (the sand, the wall's arches, the gallery's arches, the banner) and
 *   its regions (`SCENE`), as UV rectangles.
 * - `propArt()`: the big pieces, the torch flame and the statue (`PROPS`), in one canvas.
 * - `crowdArt()`: everyone who sits in the stands (pawns, sidekicks, bosses), one picture a cell, and the players' portraits.
 *
 * **Each role and the one place that makes it** (the API art lands as `Character`s on `claude/colosseum-art`,
 * `scripts/boss-art/out/arena-*`; each swaps in at its line here, its region's size kept or SCENE/PROPS updated with it):
 *
 * | Role | Placeholder made by |
 * | --- | --- |
 * | the arena wall, arched (a slice) | `wallArt` (SCENE.arch) |
 * | the stands (a slice; seat points) | none yet: steps are geometry in arena-gl.ts `buildScene`, seats in arena.ts `seats()` |
 * | the gallery wall at the top | `galleryArt` (SCENE.gallery) |
 * | a pillar with its torch | geometry (`buildScene`) + `flameArt` (PROPS.flame) |
 * | a crown banner | `bannerArt` (SCENE.banner) |
 * | the floor and the board's border | `floorArt` (SCENE.sand) + `SQUARES`, `STONE` (the plinth) |
 * | the six giant pieces, white and black | `PIECE_URL` (the board's cburnett pieces) in `propArt`; in 3D (the gear's "3D pieces"): meshes made once in `pieces3d.ts` |
 * | a statue | `statueArt` (PROPS.statue) |
 * | the railing in front of your seat | none (the wall's top edge) |
 * | pawn backs | none: a front mirrored and darkened in the sprite shader (arena-gl.ts) |
 * | far-crowd figures | none: the same crowd pictures, made smaller by the GPU's mipmaps |
 */
import { botLook, type ItemLook } from "@chessroyale/core";
import { renderFrame } from "../characters/sprite.ts";
import { BOSS_ART, pawnImage } from "../town/render.ts";
import { dressedPawn } from "../town/you-look.ts";
import type { SidekickSheet } from "../town/sidekick-sheets.ts";
import { BOTS, isSprite, type HomeId, type TownBot } from "../town/world.ts";
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

// ---- Colors (placeholders: warm sandstone, as Eric's mockup).
export const STONE = { light: [226, 204, 166], mid: [205, 180, 140], dark: [168, 142, 106], shade: [120, 98, 72] } as const;
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
const css = (v: readonly number[], k = 1) => `rgb(${Math.round(v[0]! * k)},${Math.round(v[1]! * k)},${Math.round(v[2]! * k)})`;

/** The town's pawn's foot, down its box (render.ts: the path's bottom at 39.5 of 45, and half its outline). */
const PAWN_FOOT = 40.25 / 45;

/** A small seeded random (the art is the same every time). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An arch tile in pixel art (`w` × `h` pixels, drawn `k` times bigger): stone blocks round a dark arch with a lit sill. */
function archTile(w: number, h: number, k: number, seed: number, archTop: number): HTMLCanvasElement {
  const { c, g } = pixelCanvas(w * k, h * k);
  const r = rng(seed);
  g.scale(k, k);
  g.fillStyle = css(STONE.mid);
  g.fillRect(0, 0, w, h);
  // Blocks: courses 4 pixels high, joints a shade darker, each block's face a touch lighter or darker.
  for (let y = 0; y < h; y += 4)
    for (let x = (y / 4) % 2 ? -3 : 0; x < w; x += 6) {
      g.fillStyle = css(STONE.mid, 0.94 + r() * 0.12);
      g.fillRect(x, y, 6, 4);
      g.fillStyle = css(STONE.dark);
      g.fillRect(x, y + 3, 6, 1);
      g.fillRect(x + 5, y, 1, 4);
    }
  // The arch: a dark opening, round at the top, its edge in lit stone.
  const cx = w / 2;
  const aw = w * 0.56;
  g.fillStyle = css(STONE.light);
  g.beginPath();
  g.rect(cx - aw / 2 - 1, archTop + aw / 2, aw + 2, h - archTop - aw / 2);
  g.arc(cx, archTop + aw / 2, aw / 2 + 1, Math.PI, 0);
  g.fill();
  g.fillStyle = "rgb(52,38,30)";
  g.beginPath();
  g.rect(cx - aw / 2, archTop + aw / 2, aw, h - archTop - aw / 2);
  g.arc(cx, archTop + aw / 2, aw / 2, Math.PI, 0);
  g.fill();
  // Its depth: a lighter inner side on the left.
  g.fillStyle = "rgb(84,64,48)";
  g.fillRect(cx - aw / 2, archTop + aw / 2, 2, h - archTop - aw / 2);
  // A cornice along the top and a plinth along the foot.
  g.fillStyle = css(STONE.light);
  g.fillRect(0, 0, w, 2);
  g.fillStyle = css(STONE.shade);
  g.fillRect(0, 2, w, 1);
  g.fillRect(0, h - 2, w, 2);
  return c;
}

/** The arena wall's slice (one arch, 256 px square). */
export const wallArt = (): HTMLCanvasElement => archTile(32, 32, 8, 3, 8);
/** The gallery wall's slice at the top of the stands (one arch, 256 px square). */
export const galleryArt = (): HTMLCanvasElement => archTile(32, 32, 8, 5, 5);

/** A crown banner (`w` × `h` pixels, `k` times bigger): royal blue, a gold crown, a gold edge, a swallowtail foot. */
export function bannerArt(w: number, h: number, k: number): HTMLCanvasElement {
  const { c, g } = pixelCanvas(w * k, h * k);
  g.scale(k, k);
  g.fillStyle = "#c9a13a";
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w, 0);
  g.lineTo(w, h);
  g.lineTo(w / 2, h - 5);
  g.lineTo(0, h);
  g.closePath();
  g.fill();
  g.fillStyle = "#24407e";
  g.beginPath();
  g.moveTo(1, 2);
  g.lineTo(w - 1, 2);
  g.lineTo(w - 1, h - 2);
  g.lineTo(w / 2, h - 6);
  g.lineTo(1, h - 2);
  g.closePath();
  g.fill();
  // The rod.
  g.fillStyle = "#5a3d22";
  g.fillRect(0, 0, w, 2);
  // The crown: a band and three points, gold with a darker base.
  const cx = w / 2;
  const cy = h * 0.42;
  g.fillStyle = "#f0c64a";
  g.fillRect(cx - 5, cy, 10, 3);
  for (const dx of [-5, -1, 3]) g.fillRect(cx + dx, cy - 3, 2, 3);
  g.fillRect(cx - 5, cy - 4, 1, 1);
  g.fillRect(cx - 1 + 0.5, cy - 5, 1, 1);
  g.fillRect(cx + 4, cy - 4, 1, 1);
  g.fillStyle = "#b8862a";
  g.fillRect(cx - 5, cy + 2, 10, 1);
  return c;
}

/** The sand: warm grains, a few pebbles. */
export function floorArt(px: number): HTMLCanvasElement {
  const n = 128;
  const { c: small, g } = pixelCanvas(n, n);
  const r = rng(7);
  const d = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const k = 0.92 + r() * 0.12 + (r() < 0.02 ? -0.12 : 0);
    d.data[i * 4] = 222 * k;
    d.data[i * 4 + 1] = 196 * k;
    d.data[i * 4 + 2] = 150 * k;
    d.data[i * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const { c, g: g2 } = pixelCanvas(px, px);
  g2.drawImage(small, 0, 0, px, px);
  return c;
}

/** The scene's canvas size and its regions. */
export const SCENE_PX = 1024;
export const SCENE = {
  /** A white patch: solid parts (steps, the plinth, the board's squares) are vertex colors over it. */
  white: rect(1, 1, 6, 6, SCENE_PX),
  sand: rect(0, 512, 512, 512, SCENE_PX),
  arch: rect(512, 0, 256, 256, SCENE_PX),
  gallery: rect(768, 0, 256, 256, SCENE_PX),
  banner: rect(512, 256, 128, 256, SCENE_PX),
} as const;

/** The scene's canvas (made once). */
export function sceneArt(): HTMLCanvasElement {
  const { c, g } = pixelCanvas(SCENE_PX, SCENE_PX);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 8, 8);
  g.drawImage(floorArt(512), 0, 512);
  g.drawImage(wallArt(), 512, 0);
  g.drawImage(galleryArt(), 768, 0);
  g.drawImage(bannerArt(16, 32, 8), 512, 256);
  return c;
}

// ---- Props: the big pieces, the flame, the statue.

export const PROP_PX = 1024;
/** Each piece's cell (256 px, "wp" … "bk"), the flame's and the statue's; `foot`: where its foot is, down the cell (0 to 1). */
export const PROPS = {
  piece: Object.fromEntries(Object.keys(PIECE_URL).map((k, i) => [k, rect((i % 4) * 256, Math.floor(i / 4) * 256, 256, 256, PROP_PX)])) as Record<string, Rect>,
  pieceFoot: 40.5 / 45,
  flame: rect(0, 768, 128, 256, PROP_PX),
  statue: rect(256, 768, 256, 256, PROP_PX),
} as const;

/** The torch's flame: a pixel flame, white-hot at its root. */
export function flameArt(): HTMLCanvasElement {
  const rows = ["....#....", "...##....", "...###...", "..####...", "..#####..", ".##o###..", ".##oo##..", ".#oooo##.", "##oyyo##.", "#ooyyoo##", "#ooyyyo##", ".#oyyyo#.", ".##ooo##.", "..#####.."];
  const { c, g } = pixelCanvas(128, 256);
  const k = 128 / 9;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      g.fillStyle = ch === "#" ? "#e8601c" : ch === "o" ? "#f7a531" : "#fff1a8";
      g.fillRect(Math.round(x * k), Math.round((y + 4) * k), Math.ceil(k), Math.ceil(k));
    }),
  );
  return c;
}

/** Turns a picture's colors to stone (its shape and shading kept): the statue. */
function toStone(c: HTMLCanvasElement): void {
  const g = c.getContext("2d")!;
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = (d.data[i]! * 0.3 + d.data[i + 1]! * 0.55 + d.data[i + 2]! * 0.15) / 255;
    const k = 0.45 + l * 0.6;
    d.data[i] = STONE.light[0] * k;
    d.data[i + 1] = STONE.light[1] * k;
    d.data[i + 2] = STONE.light[2] * k;
  }
  g.putImageData(d, 0, 0);
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = no;
    img.src = src;
  });

/** The props' canvas: the pieces (when their pictures have loaded), the flame and the statue (a stone pawn in a helm), and where the statue's feet are down its cell. */
export async function propArt(): Promise<{ canvas: HTMLCanvasElement; statueFoot: number }> {
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
  g.imageSmoothingEnabled = false;
  g.drawImage(flameArt(), 0, 768);
  const { c: s, foot: statueFoot } = await statueArt();
  g.drawImage(s, 256, 768);
  return { canvas: c, statueFoot };
}

/** The statue (256 px square) and its feet down the picture: a pawn in a gladiator's helm, in stone (never the town's bronze statue). */
export async function statueArt(): Promise<{ c: HTMLCanvasElement; foot: number }> {
  const look: ItemLook = { head: { def: "viking-helm", color: "yellow", blemish: 0, seed: 3 } };
  const art = await dressedPawn(look, pawnImage("light", "#d8d0c2"), 196);
  const pic = art?.img ?? pawnImage("light", "#d8d0c2");
  const foot = art ? (art.pad + PAWN_FOOT) / (1 + 2 * art.pad) : PAWN_FOOT;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  c.getContext("2d")!.drawImage(pic, 0, 0, 256, 256);
  toStone(c);
  return { c, foot };
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

/** The crowd's art: the canvas, its cells, and the players' portraits (by their index in BOTS: an image's address). */
export interface CrowdArt {
  canvas: HTMLCanvasElement;
  cells: CrowdCell[];
  portraits: Map<number, string>;
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
  return { canvas: c, cells, portraits };
}
