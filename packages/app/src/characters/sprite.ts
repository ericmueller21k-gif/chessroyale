/**
 * Boss characters as code-drawn pixel art.
 *
 * A character is a palette, a set of parts (small pixel grids, one character per pixel, each character a palette
 * key) and animations. A frame stacks parts back to front at whole-pixel positions; a part can be rotated by quarter
 * turns, mirrored, or rippled (a cape or a plume: each row or column slides by whole pixels, more towards its free
 * end). Every part gets a 1-pixel dark outline of its own, so a part in front of another is always cut out from it,
 * however the parts move. Nothing is ever smoothed: frames are drawn on the grid and scaled up with nearest-neighbour.
 *
 * Frames carry `cue`s (sound and game hooks: "thrust", "impact") that fire when the frame shows, and recolours are
 * palette swaps (a whole look, or one frame's flash).
 */

/** Rows of pixels; each character is a palette key. `.` and space are transparent. */
export type Grid = readonly string[];

export interface Part {
  grid: Grid;
  /** Draw the 1-pixel outline around this part (default true). Glows and effects turn it off. */
  outline?: boolean;
}

/** A ripple: each row (or column) of a part slides sideways (or up and down) by whole pixels. */
export interface Wave {
  along: "rows" | "cols";
  /** The largest slide, in pixels, at the free end. */
  amp: number;
  /** Wavelength in pixels along the part. */
  len: number;
  /** Phase in radians; animate it to make the ripple travel. */
  phase: number;
  /** The pinned end, which never moves (rows: top or bottom; cols: left or right). */
  pin: "top" | "bottom" | "left" | "right";
}

export interface Layer {
  part: string;
  /** Top-left of the part's pixels (not its outline) on the frame. */
  x: number;
  y: number;
  /** Quarter turns clockwise. */
  rot?: 0 | 1 | 2 | 3;
  flipX?: boolean;
  wave?: Wave;
}

/** A loose pixel drawn on top, without an outline: a spark, a speck of dust, a chip of stone. */
export type Speck = readonly [x: number, y: number, key: string];

export interface Frame {
  layers: readonly Layer[];
  ms: number;
  /** A sound or game hook fired when this frame shows ("thrust", "impact", "step"). */
  cue?: string;
  /** Moves the whole picture (a hit's shudder). */
  shake?: readonly [number, number];
  /** Palette changes for this frame only (an eye flash, a pulsing glow). */
  pal?: Readonly<Record<string, string>>;
  specks?: readonly Speck[];
}

export interface Anim {
  frames: readonly Frame[];
  loop: boolean;
}

export interface Character {
  id: string;
  name: string;
  /** Frame size in pixels. */
  w: number;
  h: number;
  /** Where the character stands (the ground between its feet), in frame pixels: for placing it on screen. */
  foot: readonly [number, number];
  /** Palette: key -> #rrggbb (or #rrggbbaa, see-through). `k` is the outline colour and must be present. */
  palette: Readonly<Record<string, string>>;
  /** A faint 1-pixel backlight around the whole silhouette, so a dark boss still reads on the dark ground. */
  halo?: string;
  /** Named recolours (palette changes) for whole looks: "frozen", "enraged". */
  looks?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  parts: Readonly<Record<string, Part>>;
  anims: Readonly<Record<string, Anim>>;
}

/** Palette keys that mean "nothing here". */
const EMPTY = new Set([".", " "]);
const OUTLINE = "k";
const HALO = "@";

type Cells = (string | null)[][];

function toCells(grid: Grid): Cells {
  const w = Math.max(0, ...grid.map((r) => r.length));
  return grid.map((row) => Array.from({ length: w }, (_, x) => (x < row.length && !EMPTY.has(row[x]!) ? row[x]! : null)));
}

function rotate(cells: Cells, quarter: number): Cells {
  let out = cells;
  for (let q = 0; q < ((quarter % 4) + 4) % 4; q++) {
    const h = out.length;
    const w = out[0]?.length ?? 0;
    const src = out;
    out = Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => src[h - 1 - x]![y]!));
  }
  return out;
}

/** The slide for position `i` of `n` along a ripple. */
function waveShift(wave: Wave, i: number, n: number): number {
  const t = n <= 1 ? 1 : i / (n - 1);
  const weight = wave.pin === "top" || wave.pin === "left" ? t : 1 - t;
  return Math.round(wave.amp * weight * Math.sin(wave.phase + (2 * Math.PI * i) / wave.len));
}

/** Applies a ripple. The part grows by `amp` on each side so nothing is cut off; returns the cells and that margin. */
function ripple(cells: Cells, wave: Wave): { cells: Cells; pad: number } {
  const pad = Math.ceil(Math.abs(wave.amp));
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  const out: Cells = Array.from({ length: h + 2 * pad }, () => Array<string | null>(w + 2 * pad).fill(null));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = cells[y]![x];
      if (!c) continue;
      const dx = wave.along === "rows" ? waveShift(wave, y, h) : 0;
      const dy = wave.along === "cols" ? waveShift(wave, x, w) : 0;
      out[y + pad + dy]![x + pad + dx] = c;
    }
  }
  return { cells: out, pad };
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Rings the filled cells with `key` (4-neighbour), growing the part by one pixel each side. */
function ring(cells: Cells, key: string): Cells {
  const h = cells.length;
  const w = cells[0]?.length ?? 0;
  const out: Cells = Array.from({ length: h + 2 }, (_, y) => Array.from({ length: w + 2 }, (_, x) => cells[y - 1]?.[x - 1] ?? null));
  for (let y = 0; y < h + 2; y++) {
    for (let x = 0; x < w + 2; x++) {
      if (out[y]![x]) continue;
      if (N4.some(([dx, dy]) => cells[y - 1 + dy]?.[x - 1 + dx])) out[y]![x] = key;
    }
  }
  return out;
}

/** A frame as palette keys (null = transparent), before colours. */
export function frameKeys(ch: Character, frame: Frame): Cells {
  const canvas: Cells = Array.from({ length: ch.h }, () => Array<string | null>(ch.w).fill(null));
  // Pixels of outlined parts: the halo rings these only, not a ground shadow or a glow.
  const solid = Array.from({ length: ch.h }, () => Array<boolean>(ch.w).fill(false));
  const [sx, sy] = frame.shake ?? [0, 0];
  const put = (x: number, y: number, c: string, isSolid: boolean) => {
    const X = x + sx;
    const Y = y + sy;
    if (X < 0 || Y < 0 || X >= ch.w || Y >= ch.h) return;
    canvas[Y]![X] = c;
    solid[Y]![X] = isSolid;
  };
  for (const layer of frame.layers) {
    const part = ch.parts[layer.part];
    if (!part) throw new Error(`${ch.id}: no part "${layer.part}"`);
    let cells = toCells(part.grid);
    if (layer.flipX) cells = cells.map((r) => [...r].reverse());
    if (layer.rot) cells = rotate(cells, layer.rot);
    let ox = layer.x;
    let oy = layer.y;
    if (layer.wave) {
      const r = ripple(cells, layer.wave);
      cells = r.cells;
      ox -= r.pad;
      oy -= r.pad;
    }
    const outlined = part.outline !== false;
    if (outlined) {
      cells = ring(cells, OUTLINE);
      ox -= 1;
      oy -= 1;
    }
    cells.forEach((row, y) => row.forEach((c, x) => c && put(ox + x, oy + y, c, outlined)));
  }
  let out = canvas;
  if (ch.halo) {
    out = canvas.map((row, y) =>
      row.map((c, x) => c ?? (N4.some(([dx, dy]) => solid[y + dy]?.[x + dx]) ? HALO : null)),
    );
  }
  for (const [x, y, k] of frame.specks ?? []) {
    const X = x + sx;
    const Y = y + sy;
    if (X >= 0 && Y >= 0 && X < ch.w && Y < ch.h) out[Y]![X] = k;
  }
  return out;
}

/** `#rrggbb`, or `#rrggbbaa` for a see-through colour (ice over a piece, a cloud): [r, g, b, a]. */
function hex(c: string): [number, number, number, number] {
  const s = c.replace("#", "");
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, s.length === 8 ? parseInt(s.slice(6), 16) : 255];
}

/**
 * Draws one frame as RGBA pixels (ImageData-shaped): `bg` fills the empty pixels (transparent if left out);
 * `look` picks a recolour.
 */
export function renderFrame(ch: Character, frame: Frame, opts: { bg?: string; look?: string } = {}): { w: number; h: number; data: Uint8ClampedArray } {
  const pal: Record<string, string> = { ...ch.palette, ...(opts.look ? ch.looks?.[opts.look] : {}), ...frame.pal };
  if (ch.halo) pal[HALO] = ch.halo;
  const keys = frameKeys(ch, frame);
  const data = new Uint8ClampedArray(ch.w * ch.h * 4);
  const bg = opts.bg ? hex(opts.bg) : null;
  keys.forEach((row, y) =>
    row.forEach((k, x) => {
      const i = (y * ch.w + x) * 4;
      const colour = k ? pal[k] : undefined;
      if (k && !colour) throw new Error(`${ch.id}: no colour for "${k}"`);
      const c = colour ? hex(colour) : null;
      const rgb = c && bg && c[3] < 255 ? ([0, 1, 2].map((j) => Math.round(c[j]! * (c[3] / 255) + bg[j]! * (1 - c[3] / 255))) as number[]) : (c ?? bg);
      if (!rgb) return;
      data[i] = rgb[0]!;
      data[i + 1] = rgb[1]!;
      data[i + 2] = rgb[2]!;
      // A see-through colour keeps its alpha, unless it was laid over `bg`.
      data[i + 3] = c && !bg ? c[3] : 255;
    }),
  );
  return { w: ch.w, h: ch.h, data };
}

/** A part's size in pixels as a layer draws it (after its own quarter turns, before any ripple or outline). */
export function partSize(part: Part, rot = 0): [number, number] {
  const w = Math.max(0, ...part.grid.map((r) => r.length));
  const h = part.grid.length;
  return rot % 2 ? [h, w] : [w, h];
}

/**
 * The same picture lying on its side (a fallen figure): every layer and speck turned a quarter about the pixel
 * corner (cx, cy), the head to the left (counter-clockwise) or to the right. Each part turns with its own quarter
 * turns, so its outline stays right. Ripples are dropped (cloth lies still).
 */
export function lieDown(
  parts: Readonly<Record<string, Part>>,
  frame: { layers: readonly Layer[]; specks?: readonly Speck[] },
  cx: number,
  cy: number,
  head: "left" | "right" = "left",
): { layers: Layer[]; specks: Speck[] } {
  const layers = frame.layers.map((l): Layer => {
    const part = parts[l.part];
    if (!part) throw new Error(`no part "${l.part}"`);
    const [w, h] = partSize(part, l.rot ?? 0);
    const left = head === "left";
    return {
      part: l.part,
      flipX: l.flipX,
      x: left ? cx + l.y - cy : cx + cy - l.y - h,
      y: left ? cy + cx - l.x - w : cy + l.x - cx,
      rot: (((l.rot ?? 0) + (left ? 3 : 1)) % 4) as 0 | 1 | 2 | 3,
    };
  });
  const specks = (frame.specks ?? []).map(([x, y, k]): Speck => (head === "left" ? [cx + y - cy, cy + cx - x - 1, k] : [cx + cy - y - 1, cy + x - cx, k]));
  return { layers, specks };
}
