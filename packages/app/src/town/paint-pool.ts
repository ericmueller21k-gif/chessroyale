/**
 * Chess Town's first visit paints on more cores (Nov 23, Eric: "It sounds like we can use more cores"). The loading screen's pictures
 * (render.ts `plan`) are pure pixel work (paint-jobs.ts), so a few workers (paint.worker.ts) paint them ahead, in the loading screen's
 * order, while the main thread runs the loading screen's jobs as before: a picture a worker has painted is put on its canvas from the
 * worker's pixels; one no worker has yet is painted here, as before; one a worker is on now waits, and the main thread paints the last
 * pictures no worker has taken meanwhile (`steal`), so every core works. Each picture is the same either way: the same code makes its
 * pixels, and the main thread puts them on the same canvas.
 *
 * It never breaks the town: no workers in the browser, a worker that fails to load or errors, or a picture that can't be sent (its art
 * not copyable) paints on the main thread as before, silently. docs/decisions/2026-11-23-town-paint-workers.md.
 */
import { TOWN_PAINT_WORKERS } from "@chessroyale/core";
import { paintSpec, type PaintSpec, type Painted } from "./paint-jobs.ts";

/** A picture for a worker: its index in the loading screen's list and what it's painted from (`ref`: sent once, by number). */
export type Job = { i: number; kind: "frame"; ref: number; k: number; dark: boolean } | { i: number; kind: "roof"; ref: number; q: number };
/** A worker's answer: the picture's pixels, or why it couldn't. */
export type Reply = { i: number; out: Painted } | { i: number; error: string };

/** A worker as the pool uses it (a Web Worker in the browser; tests pass their own). */
export interface PaintWorker {
  postMessage(m: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<Reply>) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onmessageerror?: ((e: unknown) => void) | null;
}

/** How many workers paint: the device's cores but the main thread's, at least one and at most `max`. */
export const workerCount = (cores: number | undefined, max: number = TOWN_PAINT_WORKERS.max): number => Math.max(1, Math.min(max, (cores || 2) - 1));

const QUEUED = 0;
const SENT = 1;
const DONE = 2;
const TAKEN = 3;
/** Painted on the main thread when its turn comes (it couldn't be sent, or a worker couldn't paint it). */
const HERE = 4;

export class PaintPool {
  private readonly state: Uint8Array;
  private out: (Painted | undefined)[];
  /** The next picture to hand a worker (from the front), and past the last one the main thread may paint meanwhile (from the back). */
  private head = 0;
  private tail: number;
  private dead = false;
  private readonly ids = new Map<object, number>();
  private readonly ws: { w: PaintWorker; has: Set<number>; out: number }[];
  /** (Tests, the decision's numbers) Pictures painted by the workers and by the main thread while it waited. */
  readonly made = { workers: 0, here: 0 };
  constructor(
    private readonly specs: readonly PaintSpec[],
    workers: readonly PaintWorker[],
    /** (Tests, `?paintslow=`) How much slower the workers' cores are taken to be (1: as they are). */
    private readonly slow = 1,
  ) {
    this.state = new Uint8Array(specs.length);
    this.out = new Array(specs.length);
    this.tail = specs.length;
    this.ws = workers.map((w) => ({ w, has: new Set<number>(), out: 0 }));
    for (const s of this.ws) {
      s.w.onmessage = (e) => this.got(s, e.data);
      s.w.onerror = s.w.onmessageerror = () => this.fail();
    }
    for (const s of this.ws) this.feed(s);
  }
  /** How many workers paint (0 once they've stopped). */
  get workers(): number {
    return this.dead ? 0 : this.ws.length;
  }
  /**
   * Picture `i` as its loading screen job comes to it: its pixels (a worker's, or the main thread's while it waited); "wait" (a worker is
   * painting it now); or null: paint it here, as before.
   */
  take(i: number): Painted | "wait" | null {
    const st = this.state[i];
    if (st === SENT) return "wait";
    this.state[i] = TAKEN;
    if (st !== DONE) return null;
    const r = this.out[i]!;
    this.out[i] = undefined;
    return r;
  }
  /** (The main thread, while a worker paints the picture it waits for) Paints the last picture no worker has taken. False: none left. */
  steal(): boolean {
    while (this.tail > this.head && this.state[this.tail - 1] !== QUEUED) this.tail--;
    if (this.tail <= this.head) return false;
    const i = --this.tail;
    try {
      this.out[i] = paintSpec(this.specs[i]!);
      this.state[i] = DONE;
      this.made.here++;
    } catch {
      // (Painted in its turn instead, where its failure is handled as before.)
      this.state[i] = HERE;
    }
    return true;
  }
  /** Stops the workers (the loading screen is done, or the town closed). */
  close(): void {
    this.dead = true;
    for (const s of this.ws) s.w.terminate();
    this.out = [];
  }

  private refOf(o: object): number {
    let id = this.ids.get(o);
    if (id === undefined) this.ids.set(o, (id = this.ids.size));
    return id;
  }
  /** Hands worker `s` the next pictures, `TOWN_PAINT_WORKERS.batch` a message, until it has `ahead` batches. */
  private feed(s: (typeof this.ws)[number]): void {
    const { batch, ahead } = TOWN_PAINT_WORKERS;
    while (!this.dead && s.out < batch * ahead) {
      const jobs: Job[] = [];
      const defs: [number, unknown][] = [];
      const fresh = new Set<number>();
      while (jobs.length < batch) {
        while (this.head < this.tail && this.state[this.head] !== QUEUED) this.head++;
        if (this.head >= this.tail) break;
        const i = this.head++;
        const sp = this.specs[i]!;
        const o = sp.kind === "frame" ? sp.ch : sp.b;
        const ref = this.refOf(o);
        if (!s.has.has(ref) && !fresh.has(ref)) fresh.add(ref), defs.push([ref, o]);
        jobs.push(sp.kind === "frame" ? { i, kind: "frame", ref, k: sp.k, dark: sp.dark } : { i, kind: "roof", ref, q: sp.q });
      }
      if (!jobs.length) return;
      try {
        s.w.postMessage({ defs, jobs, slow: this.slow });
      } catch {
        // (Something in its art can't be copied to a worker: these are painted here, in their turn.)
        for (const j of jobs) this.state[j.i] = HERE;
        continue;
      }
      for (const ref of fresh) s.has.add(ref);
      for (const j of jobs) this.state[j.i] = SENT;
      s.out += jobs.length;
    }
  }
  private got(s: (typeof this.ws)[number], r: Reply): void {
    s.out--;
    if (this.dead || this.state[r.i] !== SENT) return;
    if ("error" in r) this.state[r.i] = HERE;
    else {
      this.out[r.i] = r.out;
      this.state[r.i] = DONE;
      this.made.workers++;
    }
    this.feed(s);
  }
  /** A worker failed (it didn't load, or broke): every worker stops, and what they hadn't sent back is painted here, as before. */
  private fail(): void {
    if (this.dead) return;
    console.warn("town: a paint worker failed; painting on the main thread");
    this.dead = true;
    for (const s of this.ws) s.w.terminate();
    for (let i = 0; i < this.state.length; i++) if (this.state[i] === SENT) this.state[i] = QUEUED;
  }
}

/** The loading screen's pool of paint workers in the browser (null: no workers here, or none could start: the main thread paints). */
export function domPaintPool(specs: readonly PaintSpec[], count: number = workerCount(globalThis.navigator?.hardwareConcurrency), slow = 1): PaintPool | null {
  if (!TOWN_PAINT_WORKERS.on || typeof Worker === "undefined" || !specs.length || count < 1) return null;
  const ws: Worker[] = [];
  try {
    for (let k = 0; k < count; k++) ws.push(new Worker(new URL("./paint.worker.ts", import.meta.url), { type: "module" }));
  } catch {
    for (const w of ws) w.terminate();
    return null;
  }
  return new PaintPool(specs, ws as unknown as PaintWorker[], slow);
}
