/**
 * Chess Town's picture service (Nov 28, the town's structure, phase 2: DESIGN.md §2, docs/decisions/2026-11-28-town-picture-service.md):
 * the one door for every picture the device still makes (a name tag, a home's name, a speech bubble, a statue's quote, an outfit, a
 * ride's frames, the sky's sun and clouds). The build bakes what is the same for every player (baked.ts); what depends on who's here
 * is asked for here, ahead of need:
 *
 * - **Asked** by key (`ask`), from the frame or anywhere: nothing is made or uploaded there. The answer is the picture if it's ready,
 *   else null, and whoever draws leaves it out until it is.
 * - **Made and uploaded between frames** (`pump`, a slice of a few ms at a time: Town.tsx runs it when the browser is idle after a
 *   frame; the loading screen runs it under its card until nothing waits). A picture goes to the painter through `keep` and `kept`,
 *   the only way one reaches the GPU: the painter uploads nothing as it draws (paint-gl.ts), so a picture that never came through this
 *   door is simply not drawn, and a new feature can't bring an upload back into a frame by accident.
 * - **Ready** once the GPU holds it. A picture asked again with a new `stamp` (the device's pixel ratio changed, its font came) is made
 *   again while the old one goes on being drawn, and swapped when the new one is ready.
 * - **Let go** by whoever asked (`drop`: a rider gone, a look changed), or, for pictures that can be made again whenever they're
 *   wanted (a tag, a bubble), when their group's pages are full: the one least lately asked for makes room. One with nothing to make
 *   room waits, and is tried again as room comes. No atlas page is ever started again.
 *
 * Groups (`PIC_GROUP`) are the painter's: each has atlas pages of its own, so the text never competes with the outfits for room.
 * Pure but for the painter it's given and the clock: tested without a canvas (test/town-picture-service.test.ts).
 */
import type { Painter } from "./paint.ts";
import { REC } from "./frame-report.ts";

/** The painter's groups of atlas pages: the town's own (the build's baked files), the text (tags, names, bubbles, quotes), the looks (pawns, outfits, rides, the sky). */
export const PIC_GROUP = { town: 0, text: 1, looks: 2 } as const;

/** A picture (or several made together: a ride's frames) as its maker hands it over. */
export type Art = { readonly cv: CanvasImageSource } | { readonly cvs: readonly CanvasImageSource[] };

const srcsOf = (a: Art): readonly CanvasImageSource[] => ("cvs" in a ? a.cvs : [a.cv]);

interface Making {
  stamp: string;
  /** Makes it: the picture, or null after one step of several (called again in the next slice). */
  make: () => Art | null;
  /** Made, handed to the painter, waiting for the GPU. */
  art: Art | null;
}

interface Slot {
  key: string;
  group: number;
  /** What's drawn now (null: nothing yet) and the stamp it was made with. */
  art: Art | null;
  stamp: string;
  /** The one on its way: it takes `art`'s place once the GPU holds it. */
  next: Making | null;
  /** The tick it was last asked for. */
  used: number;
  /** Never let go to make room (its owner drops it). */
  hold: boolean;
  /** Its pictures found no room and nothing could make any: tried again at `retryAt` (a tick), or sooner when one of its group goes. */
  retryAt: number;
  then: (() => void)[];
}

/** How many ticks a picture that found no room waits before it's tried again (a second or so of frames). */
const RETRY_TICKS = 60;
/** How many of the least lately used are let go at once to make room for one. */
const EVICT_MAX = 4;

export class PictureService {
  private readonly slots = new Map<string, Slot>();
  /** Waiting to be made, in order; made and handed to the painter, waiting for the GPU; waiting for room. */
  private readonly toMake: Slot[] = [];
  private readonly sent: Slot[] = [];
  private readonly stuck: Slot[] = [];
  /** How many pictures of the service's each source canvas is (two keys may share one): handed to the painter once, freed with the last. */
  private readonly refs = new Map<CanvasImageSource, number>();
  private tickNo = 0;
  /** (Tests, `?report`) Pictures made and let go to make room, so far. */
  made = 0;
  evicted = 0;

  constructor(
    private readonly painter: Pick<Painter, "keep" | "kept" | "holds" | "free">,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /**
   * Picture `key` of `group`, asked for (ahead of need, and again every frame it's drawn): the picture if it's ready, else null (leave
   * it out). The first asking queues `make` to run between frames; a new `stamp` queues it again, the old picture drawn meanwhile.
   * `hold`: never let go to make room. `make` may return null after one step of a long job: it's called again.
   */
  ask<T extends Art>(group: number, key: string, stamp: string, make: () => T | null, hold = false): T | null {
    let s = this.slots.get(key);
    if (!s) {
      s = { key, group, art: null, stamp: "", next: null, used: this.tickNo, hold, retryAt: 0, then: [] };
      this.slots.set(key, s);
    }
    s.used = this.tickNo;
    if (s.art ? s.stamp !== stamp && s.next?.stamp !== stamp : s.next?.stamp !== stamp) this.queue(s, stamp, make);
    return s.art as T | null;
  }

  /**
   * Pictures already made off the frame (a ride's frames, a dressed pawn's), handed over: uploaded between frames, then `then` is
   * called (drawn from then on, not before). Held until `drop(key)`. Handed over again under the same key: the new ones replace the
   * old once they're ready.
   */
  take(group: number, key: string, cvs: readonly CanvasImageSource[], then?: () => void): void {
    let s = this.slots.get(key);
    if (!s) {
      s = { key, group, art: null, stamp: "", next: null, used: this.tickNo, hold: true, retryAt: 0, then: [] };
      this.slots.set(key, s);
    }
    s.used = this.tickNo;
    const art: Art = { cvs };
    this.queue(s, `take ${++this.takes}`, () => art);
    if (then) s.then.push(then);
  }
  private takes = 0;

  private queue(s: Slot, stamp: string, make: () => Art | null): void {
    // (One on its way with another stamp: this one in its place. What it had handed over is let go.)
    if (s.next?.art) this.letGo(s.next.art);
    for (const l of [this.sent, this.stuck]) {
      const i = l.indexOf(s);
      if (i >= 0) l.splice(i, 1);
    }
    s.next = { stamp, make, art: null };
    if (!this.toMake.includes(s)) this.toMake.push(s);
  }

  /** The ready picture of `key`, without asking for it (null: none, or not ready). */
  get<T extends Art>(key: string): T | null {
    return (this.slots.get(key)?.art as T | undefined) ?? null;
  }

  /** `key` is wanted soon (the camera is coming in on it): made before whatever else waits. */
  hurry(key: string): void {
    const s = this.slots.get(key);
    const i = s ? this.toMake.indexOf(s) : -1;
    if (i > 0) this.toMake.unshift(...this.toMake.splice(i, 1));
  }

  /** Lets `key` go: its pictures leave the GPU, their room free for others; one on its way is never made. */
  drop(key: string): void {
    const s = this.slots.get(key);
    if (!s) return;
    this.slots.delete(key);
    for (const l of [this.toMake, this.sent, this.stuck]) {
      const i = l.indexOf(s);
      if (i >= 0) l.splice(i, 1);
    }
    if (s.next?.art) this.letGo(s.next.art);
    if (s.art) this.letGo(s.art);
    s.next = null;
    s.art = null;
    // (Room has come: whoever of its group waited for some is tried again.)
    for (const o of this.stuck) if (o.group === s.group) o.retryAt = 0;
  }

  /** Lets go every key that starts with `prefix` (a pixel ratio's pictures, a person's). */
  dropAll(prefix: string): void {
    for (const k of [...this.slots.keys()]) if (k.startsWith(prefix)) this.drop(k);
  }

  /** A frame was drawn: what was asked for in it, or the one before, is in use. */
  tick(): void {
    this.tickNo++;
  }

  /** Something waits to be made or uploaded: `pump` has work. (One waiting for room counts only once its turn to be tried again comes.) */
  get busy(): boolean {
    return this.toMake.length > 0 || this.sent.length > 0 || this.stuck.some((s) => s.retryAt <= this.tickNo);
  }
  /** (Tests, the loading screen) Pictures asked for and not ready yet, those waiting for room among them. */
  get waiting(): number {
    return this.toMake.length + this.sent.length + this.stuck.length;
  }

  /**
   * Between frames: makes what's waiting, in order, and hands it to the painter; then (`upload`) has the painter upload, all within
   * `budgetMs` (one step is always made, so a slow device still gets there); then what the GPU holds is ready. The loading screen
   * passes `upload` false (its own loop runs the painter's `kept`, with everything else it keeps) and calls `settle` after it.
   * True: there's more to do.
   */
  pump(budgetMs: number, upload = true): boolean {
    const t0 = this.now();
    // (Those that waited for room and whose turn has come: handed over again.)
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const s = this.stuck[i]!;
      if (s.retryAt > this.tickNo) continue;
      this.stuck.splice(i, 1);
      this.send(s);
    }
    let n = 0;
    while (this.toMake.length) {
      const s = this.toMake[0]!;
      const m = s.next;
      if (!m) {
        this.toMake.shift();
        continue;
      }
      const art = m.make();
      if (art) {
        this.toMake.shift();
        m.art = art;
        this.made++;
        n++;
        this.send(s);
      }
      if (this.now() - t0 >= budgetMs) break;
    }
    if (n && REC) REC.made(n, this.now() - t0);
    if (!upload) return this.toMake.length > 0;
    if (this.sent.length) {
      const done = this.painter.kept?.(Math.max(0, budgetMs - (this.now() - t0))) ?? 1;
      this.settle(done >= 1);
    }
    return this.busy;
  }

  /** Hands a made picture's canvases to the painter (each once, however many keys share it). */
  private send(s: Slot): void {
    for (const cv of srcsOf(s.next!.art!)) {
      const n = this.refs.get(cv) ?? 0;
      this.refs.set(cv, n + 1);
      if (n === 0) this.painter.keep?.(cv, s.group);
    }
    this.sent.push(s);
  }

  /** Lets a made picture's canvases go (each freed with its last key). */
  private letGo(art: Art): void {
    for (const cv of srcsOf(art)) {
      const n = (this.refs.get(cv) ?? 1) - 1;
      if (n > 0) this.refs.set(cv, n);
      else {
        this.refs.delete(cv);
        this.painter.free?.(cv);
      }
    }
  }

  /**
   * What the GPU holds of the pictures handed over is ready: it takes its key's place (the one it replaces let go) and its `then`s
   * run. `all`: the painter has been through everything it was handed, so one not held found no room: the least lately asked for of
   * its group that may go make room (not one asked for in this frame or the last) and it's handed over again; with none to go, it
   * waits (`RETRY_TICKS`, or until one of its group is dropped).
   */
  settle(all: boolean): void {
    for (let i = 0; i < this.sent.length; i++) {
      const s = this.sent[i]!;
      const m = s.next!;
      const cvs = srcsOf(m.art!);
      // (An empty picture has nothing to hold.)
      const held = cvs.every((cv) => (this.painter.holds?.(cv) ?? true) || !(cv as { width?: number }).width);
      if (!held && !all) continue;
      this.sent.splice(i--, 1);
      if (held) {
        const old = s.art;
        s.art = m.art;
        s.stamp = m.stamp;
        s.next = null;
        if (old) this.letGo(old);
        for (const f of s.then.splice(0)) f();
        continue;
      }
      // No room: what it did get is given back, room is made if any can be, and it's handed over again.
      this.letGo(m.art!);
      let room = 0;
      while (room < EVICT_MAX && this.evict(s)) room++;
      if (room) this.send(s);
      else {
        s.retryAt = this.tickNo + RETRY_TICKS;
        this.stuck.push(s);
      }
    }
  }

  /** Lets go the least lately asked for picture of `for_`'s group that may go (not held, ready, not asked for in this frame or the last). */
  private evict(for_: Slot): boolean {
    let old: Slot | null = null;
    for (const s of this.slots.values()) {
      if (s === for_ || s.group !== for_.group || s.hold || !s.art || s.next || s.used >= this.tickNo - 1) continue;
      if (!old || s.used < old.used) old = s;
    }
    if (!old) return false;
    this.evicted++;
    this.drop(old.key);
    return true;
  }

  /** (Tests, `__townPaint`) How many pictures are held, by group, how many wait, how many were made and let go to make room. */
  stats(): { ready: number[]; waiting: number; stuck: number; made: number; evicted: number } {
    const ready: number[] = [];
    for (const s of this.slots.values()) if (s.art) ready[s.group] = (ready[s.group] ?? 0) + 1;
    for (let g = 0; g < ready.length; g++) ready[g] ??= 0;
    return { ready, waiting: this.waiting, stuck: this.stuck.length, made: this.made, evicted: this.evicted };
  }
}
