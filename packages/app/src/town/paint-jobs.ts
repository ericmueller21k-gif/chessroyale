/**
 * The loading screen's pictures as pure pixel work (Nov 23, Eric: "It sounds like we can use more cores"): what render.ts paints for
 * each picture, with no canvas, so it runs the same on the main thread and in a paint worker (paint.worker.ts). This is the only copy:
 * render.ts's FrameCache and roofs call these too, so a picture painted in a worker is the main thread's byte for byte (its pixels go
 * on a canvas on the main thread either way, by the same `putImageData`). docs/decisions/2026-11-23-town-paint-workers.md.
 */
import { renderFrame, type Character, type Part } from "../characters/sprite.ts";
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
export type PaintSpec = { kind: "frame"; ch: Character; k: number; dark: boolean } | { kind: "roof"; b: RoofOf; q: number };
/** What a roof is painted from: the box and its art, as much as box-draw.ts `roofCuts` reads (box-geom.ts). */
export type RoofOf = RoofInst & { box: RoofBox };
/** A frame's pixels, or a roof's faces' cuts. */
export type Painted = Pixels | Cut[][];

/** Paints one picture (the main thread's code, wherever it runs). */
export function paintSpec(s: PaintSpec): Painted {
  if (s.kind === "frame") return framePixels(s.dark ? stepChar(s.ch, -1) : s.ch, s.k);
  return roofCuts(s.b, s.b.box, s.q);
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
export type Job = { i: number; kind: "frame"; ref: number; k: number; dark: boolean } | { i: number; kind: "roof"; ref: number; q: number };
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
  else for (const f of out) for (const c of f) bufs.add(c.data.buffer as ArrayBuffer);
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
      const out = paintSpec(j.kind === "frame" ? { kind: "frame", ch: o as Character, k: j.k, dark: j.dark } : { kind: "roof", b: o as RoofOf, q: j.q });
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
