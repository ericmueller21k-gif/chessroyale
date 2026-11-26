/**
 * The loading screen's pictures as pure pixel work (Nov 23, Eric: "It sounds like we can use more cores"): what render.ts paints for
 * each picture, with no canvas, so it runs the same on the main thread and in a paint worker (paint.worker.ts). This is the only copy:
 * render.ts's FrameCache and roofs call these too, so a picture painted in a worker is the main thread's byte for byte (its pixels go
 * on a canvas on the main thread either way, by the same `putImageData`). docs/decisions/2026-11-23-town-paint-workers.md.
 */
import { frameKeys, renderFrame, type Character, type Part } from "../characters/sprite.ts";
import { TOWN_FEEL } from "./feel.ts";
import type { LightPool, LightSpot } from "./houses/kit.ts";
import { ATLAS } from "./paint.ts";
import { stepChar } from "./kit/bake.ts";
import type { Cut } from "./kit/bake.ts";
import { roofCuts } from "./box-draw.ts";
import { ROOF_BOX_KEYS, ROOF_INST_KEYS, type RoofBox, type RoofInst } from "./box-geom.ts";

/** A picture's pixels, ImageData-shaped. */
export interface Pixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** A character's idle frame `i` as pixels (render.ts FrameCache: a frame's canvas holds exactly these). */
export function framePixels(ch: Character, i: number): Pixels {
  return renderFrame(ch, ch.anims.idle!.frames[i]!);
}

/**
 * One picture to paint: a character's frame `k` (or one ramp step darker, as render.ts's FrameCache `dark`), or a box's roof for the
 * camera's quarter `q` (box-draw.ts `bakeRoof`: its pixels here, packed onto sheets on the main thread).
 */
export type PaintSpec =
  | { kind: "frame"; ch: Character; k: number; dark: boolean }
  | { kind: "roof"; b: RoofOf; q: number }
  | { kind: "glow"; ch: Character; spots: readonly LightSpot[]; pools: readonly LightPool[] };
/** What a roof is painted from: the box and its art, as much as box-draw.ts `roofCuts` reads (box-geom.ts). */
export type RoofOf = RoofInst & { box: RoofBox };
/** A frame's pixels, a roof's faces' cuts, or a glow's sheet and pieces. */
export type Painted = Pixels | Cut[][] | GlowPixels;

/** Paints one picture (the main thread's code, wherever it runs). */
export function paintSpec(s: PaintSpec): Painted {
  if (s.kind === "frame") return framePixels(s.dark ? stepChar(s.ch, -1) : s.ch, s.k);
  if (s.kind === "glow") return glowPixels(s.ch, s.spots, s.pools);
  return roofCuts(s.b, s.b.box, s.q);
}

// ---- The lights' glows (Nov 26: moved here from render.ts so a first visit bakes them in the paint workers too).

/**
 * A picture's lights at dusk and night (houses/kit.ts LightSpot, LightPool), baked: each spot's lit pixels warm and bright with the glow
 * spilling round them (and a lantern's halo), each pool on the ground; one piece a light, only as big as it needs, all on one sheet
 * GLOW_GAP clear pixels apart (as the atlas pads a picture, so a smoothed draw of one reads the same clear pixels round it as a canvas of
 * its own did). Laid on with "lighter" (render.ts lightUp, lightT).
 */
export interface GlowPixels {
  /** The sheet (null: no piece lit anything). */
  sheet: Pixels | null;
  /** Seven numbers a piece: sx, sy, w, h on the sheet; x, y (its top left in the picture's pixels); 1 if it flickers. */
  pieces: number[];
}
/** Clear pixels between a glow's pieces on its sheet: the atlas's own padding round a picture. */
export const GLOW_GAP = ATLAS.pad;
const rgbOf = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const;
const bandAt = (bands: readonly (readonly [number, number])[], d: number) => {
  for (const [to, a] of bands) if (d <= to) return a;
  return 0;
};
type AddLight = (x: number, y: number, rgb: readonly number[], a: number) => void;
export function glowPixels(ch: Character, spots: readonly LightSpot[], pools: readonly LightPool[]): GlowPixels {
  const f = TOWN_FEEL;
  const spill = Math.ceil(f.lightSpill[f.lightSpill.length - 1]![0]);
  const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
  /** Each piece's light as worked out (r, g, b, premultiplied), before it goes on the glow's one sheet. */
  const made: { x0: number; y0: number; w: number; h: number; flicker: boolean; A: Float32Array }[] = [];
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
    if (any) made.push({ x0, y0, w, h, flicker, A });
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
      }
    const isLit = (x: number, y: number) => x >= s.x && y >= s.y && x < s.x + s.w && y < s.y + s.h && m[(y - s.y) * s.w + x - s.x] === 1;
    const halo = s.halo ?? 0;
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const x0 = Math.min(s.x - spill, Math.floor(cx - halo));
    const y0 = Math.min(s.y - spill, Math.floor(cy - halo));
    const x1 = Math.max(s.x + s.w + spill, Math.ceil(cx + halo) + 1);
    const y1 = Math.max(s.y + s.h + spill, Math.ceil(cy + halo) + 1);
    // How far each pixel of the piece is from the nearest lit one within `spill` across and down (squared): stamped out from the lit
    // pixels (Nov 26: the same numbers as looking round every pixel, which was 2.7 s of the loading screen for the town's 2,551 pieces).
    const PW = x1 - x0;
    const PH = y1 - y0;
    const near = new Float32Array(PW * PH).fill(Infinity);
    for (let v = s.y; v < s.y + s.h; v++)
      for (let u = s.x; u < s.x + s.w; u++) {
        if (m[(v - s.y) * s.w + u - s.x] !== 1) continue;
        for (let dy = -spill; dy <= spill; dy++) {
          const Y = v + dy - y0;
          if (Y < 0 || Y >= PH) continue;
          for (let dx = -spill; dx <= spill; dx++) {
            const X = u + dx - x0;
            if (X < 0 || X >= PW) continue;
            const d = dx * dx + dy * dy;
            if (d < near[Y * PW + X]!) near[Y * PW + X] = d;
          }
        }
      }
    piece(x0, y0, PW, PH, !!s.flicker, (add) => {
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          // Its lit pixels warm and bright; round them, the glow spilling, by how far the nearest lit one is; and its
          // halo in the air (a lantern's, a lamp's), round its box's middle.
          if (isLit(x, y)) {
            add(x, y, rgb, s.strength);
            continue;
          }
          const d2 = near[(y - y0) * PW + x - x0]!;
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
  // The pieces on one sheet (Nov 26: a canvas each was 2,551 canvases, most of the lights' cost on the loading screen), in rows, GLOW_GAP
  // clear pixels apart (as the atlas pads each picture: a smoothed draw of one reads the same clear pixels round it).
  const G = GLOW_GAP;
  let area = 0;
  let widest = 0;
  for (const p of made) {
    const w = Math.trunc(p.w);
    area += (w + G) * (Math.trunc(p.h) + G);
    widest = Math.max(widest, w);
  }
  const rowW = Math.max(widest, Math.ceil(Math.sqrt(area)));
  const at: number[] = [];
  let cx = 0;
  let cy = 0;
  let rowH = 0;
  let sw = 0;
  for (const p of made) {
    const w = Math.trunc(p.w);
    const h = Math.trunc(p.h);
    if (cx > 0 && cx + w > rowW) ((cx = 0), (cy += rowH + G), (rowH = 0));
    at.push(cx, cy);
    sw = Math.max(sw, cx + w);
    cx += w + G;
    rowH = Math.max(rowH, h);
  }
  const pieces: number[] = [];
  if (!made.length) return { sheet: null, pieces };
  const W = Math.max(1, sw);
  const H = Math.max(1, cy + rowH);
  const d = new Uint8ClampedArray(W * H * 4);
  made.forEach((p, k) => {
    const { w, h, A } = p;
    const tw = Math.trunc(w);
    const th = Math.trunc(h);
    const sx = at[2 * k]!;
    const sy = at[2 * k + 1]!;
    // (As a canvas of its own had it, Nov 26: its pixels in order, tw across. Every one of the town's 2,551 matched.)
    for (let i = 0; i < w * h && i < tw * th; i++) {
      const a = Math.min(255, Math.max(A[i * 3]!, A[i * 3 + 1]!, A[i * 3 + 2]!));
      if (a <= 0) continue;
      const o = ((sy + ((i / tw) | 0)) * W + sx + (i % tw)) * 4;
      d[o] = Math.min(255, (A[i * 3]! * 255) / a);
      d[o + 1] = Math.min(255, (A[i * 3 + 1]! * 255) / a);
      d[o + 2] = Math.min(255, (A[i * 3 + 2]! * 255) / a);
      d[o + 3] = a;
    }
    pieces.push(sx, sy, tw, th, p.x0, p.y0, p.flicker ? 1 : 0);
  });
  return { sheet: { w: W, h: H, data: d }, pieces };
}

// ---- What passes between the pool (paint-pool.ts) and a worker (paint.worker.ts).

/**
 * Character `ch` as a worker gets it (as JSON): what painting its idle frames reads (frameKeys, renderFrame, stepChar for a darker
 * step): everything but its other animations and the parts its idle frames don't use. Each part's grid is read here (a part from
 * houses/kit.ts `paint` works its pixels out as it's first read: that stays on the main thread), so the copy is plain data and JSON
 * makes it on its quick path. A part left out shows as the worker's error, and that picture is painted on the main thread.
 */
export function paintCopy(ch: Character): Character {
  const idle = ch.anims.idle!;
  const parts: Record<string, Part> = {};
  for (const f of idle.frames)
    for (const l of f.layers) {
      const p = ch.parts[l.part];
      if (p && !parts[l.part]) parts[l.part] = { ...p };
    }
  return { ...ch, parts, anims: { idle } };
}
/** A roof's box as a worker gets it (as JSON): what `roofCuts` reads (box-geom.ts's lists), its hedge's tile as `paintCopy`. */
export function roofCopy(b: RoofOf): RoofOf {
  const pick = <T extends object, K extends keyof T>(o: T, keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, o[k]])) as Pick<T, K>;
  return { ...pick(b, ROOF_INST_KEYS), tile: b.tile && paintCopy(b.tile), box: pick(b.box, ROOF_BOX_KEYS) };
}

/** A picture for a worker: its index in the loading screen's list and what it's painted from (`ref`: sent once, by number). */
export type Job =
  | { i: number; kind: "frame"; ref: number; k: number; dark: boolean }
  | { i: number; kind: "roof"; ref: number; q: number }
  | { i: number; kind: "glow"; ref: number; spots: readonly LightSpot[]; pools: readonly LightPool[] };
/**
 * A batch of pictures, and the art they're painted from that this worker hasn't had yet: each a character or a box, as JSON (made once
 * on the main thread and handed to any worker that needs it: a tenth of the main thread's time a copy of the objects themselves took,
 * measured Nov 23; read back in the worker). `slow` (tests): see `paintBatch`.
 */
export interface Batch {
  defs: [number, string][];
  jobs: Job[];
  slow: number;
}
/** A worker's answer: the picture's pixels, or why it couldn't. */
export type Reply = { i: number; out: Painted } | { i: number; error: string };

/** The buffers a picture's pixels are in (each once), to hand over rather than copy. */
export function buffersOf(out: Painted): ArrayBuffer[] {
  const bufs = new Set<ArrayBuffer>();
  if ("data" in out) bufs.add(out.data.buffer as ArrayBuffer);
  else if ("pieces" in out) {
    if (out.sheet) bufs.add(out.sheet.data.buffer as ArrayBuffer);
  } else for (const f of out) for (const c of f) bufs.add(c.data.buffer as ArrayBuffer);
  return [...bufs];
}

/** A worker's side: paints a batch's pictures from the art it has (`defs`, by number), each answered (`reply`) as it's done. */
export function paintBatch(defs: Map<number, unknown>, b: Batch, reply: (r: Reply, transfer: ArrayBuffer[]) => void): void {
  for (const [id, json] of b.defs) defs.set(id, JSON.parse(json));
  for (const j of b.jobs) {
    const t0 = performance.now();
    let r: Reply;
    let send: ArrayBuffer[] = [];
    try {
      const o = defs.get(j.ref);
      if (!o) throw new Error("paint worker: art not sent");
      const out = paintSpec(
        j.kind === "frame" ? { kind: "frame", ch: o as Character, k: j.k, dark: j.dark } : j.kind === "glow" ? { kind: "glow", ch: o as Character, spots: j.spots, pools: j.pools } : { kind: "roof", b: o as RoofOf, q: j.q },
      );
      send = buffersOf(out);
      r = { i: j.i, out };
    } catch (err) {
      r = { i: j.i, error: String(err) };
    }
    // (Tests, `?paintslow=K`: each picture takes K times as long, as on a core K times slower: the page's own thread is slowed by CDP's
    // CPU throttling, which doesn't reach workers. Never in play.)
    if (b.slow > 1) for (const until = t0 + (performance.now() - t0) * b.slow; performance.now() < until; );
    reply(r, send);
  }
}
