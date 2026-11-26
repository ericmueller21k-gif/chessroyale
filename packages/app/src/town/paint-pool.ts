/**
 * Chess Town's first visit paints on more cores (Nov 23, Eric: "It sounds like we can use more cores"). The loading screen's pictures
 * (render.ts `plan`) are pure pixel work (paint-jobs.ts), so a few workers (paint.worker.ts) paint them ahead, in the loading screen's
 * order, while the main thread runs the loading screen's jobs as before: a picture a worker has painted is put on its canvas from the
 * worker's pixels; one no worker has yet is painted here, as before; one a worker is on now waits: meanwhile the main thread hands the
 * workers more (`pump`) and, with them all busy, paints the last pictures no worker has taken (`steal`), so every core works. Each picture is the same either way: the same code makes its
 * pixels, and the main thread puts them on the same canvas.
 *
 * It never breaks the town: no workers in the browser, a worker that fails to load or errors, or a picture that can't be sent (its art
 * not JSON) paints on the main thread as before, silently. The art goes to the workers as JSON: what the paint code reads of it (keys,
 * colors, grids, numbers) is the same after (test/town-paint-workers.test.ts paints every picture of the town both ways). docs/decisions/2026-11-23-town-paint-workers.md.
 */
import { TOWN_PAINT_WORKERS } from "@chessroyale/core";
import { paintCopy, paintSpec, roofCopy, type Batch, type Job, type PaintSpec, type Painted, type Reply } from "./paint-jobs.ts";

/** A worker as the pool uses it (a Web Worker in the browser; tests pass their own). */
export interface PaintWorker {
  postMessage(m: Batch): void;
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
  /** Each piece of art's number, and it as JSON (made once, whichever worker needs it). */
  private readonly ids = new Map<object, number>();
  private readonly json: (string | null)[] = [];
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
    for (const s of this.ws) this.send(s);
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
    this.json.length = 0;
  }

  /** Art's number (-1: it doesn't go into JSON, so its pictures are painted here). */
  private refOf(sp: PaintSpec): number {
    // (A glow's character is a frame's too: its JSON made once for both.)
    const o = sp.kind === "roof" ? sp.b : sp.ch;
    let id = this.ids.get(o);
    if (id === undefined) {
      this.ids.set(o, (id = this.ids.size));
      let js: string | null = null;
      try {
        js = JSON.stringify(sp.kind === "roof" ? roofCopy(sp.b) : paintCopy(sp.ch));
      } catch {
        // (A loop, or a value JSON can't hold.)
      }
      this.json[id] = js;
    }
    return this.json[id] === null ? -1 : id;
  }
  /**
   * (The main thread, as each loading screen slice starts and while it waits) Hands the workers their next pictures, the emptiest first,
   * until each has `ahead` batches or `budgetMs` is spent. (Their art goes as JSON, so a picture's parts are worked out here as it's
   * sent: houses/kit.ts `paint`'s lazy grids can't go to a worker.) Whether any was sent.
   */
  pump(budgetMs: number): boolean {
    const { batch, ahead } = TOWN_PAINT_WORKERS;
    const t0 = performance.now();
    let any = false;
    for (;;) {
      let s: (typeof this.ws)[number] | null = null;
      for (const x of this.ws) if (x.out < batch * ahead && (!s || x.out < s.out)) s = x;
      if (!s || this.dead || !this.send(s)) return any;
      any = true;
      if (performance.now() - t0 > budgetMs) return any;
    }
  }
  /** Hands worker `s` its next `TOWN_PAINT_WORKERS.batch` pictures (false: none left). */
  private send(s: (typeof this.ws)[number]): boolean {
    const { batch } = TOWN_PAINT_WORKERS;
    for (;;) {
      if (this.dead) return false;
      const jobs: Job[] = [];
      const defs: [number, string][] = [];
      const fresh = new Set<number>();
      while (jobs.length < batch) {
        while (this.head < this.tail && this.state[this.head] !== QUEUED) this.head++;
        if (this.head >= this.tail) break;
        const i = this.head++;
        const sp = this.specs[i]!;
        const ref = this.refOf(sp);
        if (ref < 0) {
          this.state[i] = HERE;
          continue;
        }
        if (!s.has.has(ref) && !fresh.has(ref)) fresh.add(ref), defs.push([ref, this.json[ref]!]);
        jobs.push(sp.kind === "frame" ? { i, kind: "frame", ref, k: sp.k, dark: sp.dark } : sp.kind === "glow" ? { i, kind: "glow", ref, spots: sp.spots, pools: sp.pools } : { i, kind: "roof", ref, q: sp.q });
      }
      if (!jobs.length) return false;
      try {
        s.w.postMessage({ defs, jobs, slow: this.slow });
      } catch {
        // (Never expected: it's all strings and numbers. These are painted here, in their turn.)
        for (const j of jobs) this.state[j.i] = HERE;
        continue;
      }
      for (const ref of fresh) s.has.add(ref);
      for (const j of jobs) this.state[j.i] = SENT;
      s.out += jobs.length;
      return true;
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
    // (About to run dry between two slices: its next batch now.)
    if (s.out < TOWN_PAINT_WORKERS.batch) this.send(s);
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
