/**
 * The frame report (`/town?report`, anyone's, like `?fps`; Eric, Nov 11: "turning is dropping it to like 40 frames … maybe also
 * loading, when I go to a new spot"). It records every frame of a run (from your first move, for 30 s or until "Done"): the frame's
 * time, the time of each part of the town's frame (the parts below, named from the code), and what was happening (walking, turning
 * and how fast, a zoom, loading: new pictures painted, sight lines worked out, textures uploaded, an atlas page started again; a long gap
 * outside our code). Then it shows one panel sized to be screenshotted (frame-report-panel.ts), from `summarize` below.
 *
 * Plain typed arrays made once as the page opens with `?report`; nothing allocated per frame. Without `?report` there's no recorder
 * (`REC` stays null) and the draw's marks are a null check each.
 *
 * Inside a building (Nov 11, Eric's iPhone: "inside shop rooms … 42-44 fps … never climbs"; "exiting ANY building drops to 2-4 fps"):
 * the room's own loop (shops/ShopRoom.tsx) records into the same run, its parts under the town's names (its ceiling as the sky, its
 * floor as the ground, its pieces as props, the Shopkeeper and its people as other players), each frame marked "in a room"; the frames
 * from a home's "Go in" until the room's black lifts are "going in", from "Go out" until the town's zoom out ends "going out". The
 * `?fps` pill (FpsCount below) counts the room's frames too: before, it stood still on the town's last reading inside a room, and its
 * first readings out spanned the whole visit.
 */

/** The parts of a frame, in the order the frame does them (their names on the panel: PART_NAMES). */
export const P = {
  /** Town.tsx's frame before the drawing: input, the walkers, bots and bosses (world.ts tick), the camera's spring and turn. */
  logic: 0,
  /** render.ts draw's set-up: the camera's numbers, the lens, the statues' close-ups made ahead. */
  camera: 1,
  /** The sky (sky-draw.ts). */
  sky: 2,
  /** The ground's squares, the horizon's haze, the rim, the marks on the ground. */
  ground: 3,
  /** Placing and sorting what's drawn: the boxes' plans (boxes.ts), each thing's place, the near cut, the sort far to near. */
  plan: 4,
  /** The buildings: homes, everyday fronts, sides, backs and roofs, sheds and hedges. */
  buildings: 5,
  /** The props: trees, lamps, benches, tables and their boards, the fountain, statues. */
  props: 6,
  /** The bosses (and their stand-ins). */
  bosses: 7,
  /** You: your figure or your ride. */
  you: 8,
  /** Everyone else: the bots, their rides, the sidekicks, real players. */
  people: 9,
  /** The light of the hour (the tint) and the lights at dusk and night. */
  lights: 10,
  /** Name tags, the "zzz", the homes' floating names, a speech bubble. */
  labels: 11,
  /** WebGL: the frame's batched triangles sent to the GPU (paint-gl.ts done). */
  submit: 12,
  /** The chips on the edge and the open card (placed in the page). */
  chips: 13,
  /** The minimap's dot. */
  minimap: 14,
  /** Loading: pictures painted the first time they show (a roof for a heading: box-draw.ts bakeRoof; a wall's, a home's or a
   * figure's frame: render.ts FrameCache), wherever in the frame it happens. */
  paint: 15,
  /** Loading: what the rows let you see from a new square (seen.ts), wherever it happens. */
  sight: 16,
  /** Loading: pictures uploaded to the GPU (paint-gl.ts upload), wherever it happens. */
  uploads: 17,
  /** The rest of the frame's time: the browser's own work, the GPU, garbage collection (the frame's time less ours). */
  outside: 18,
} as const;
export type PartId = (typeof P)[keyof typeof P];
export const NP = 19;
export const PART_NAMES: readonly string[] = [
  "Town logic",
  "Camera",
  "Sky",
  "Ground",
  "Placing & sorting",
  "Buildings",
  "Props",
  "Bosses",
  "You",
  "Other players",
  "Lights & tint",
  "Labels & bubbles",
  "WebGL submit",
  "Chips & card",
  "Minimap",
  "New pictures",
  "Sight lines",
  "Texture uploads",
  "Outside our code",
];
/** The same, short (the worst frames' lines). */
export const PART_SHORT: readonly string[] = ["Logic", "Camera", "Sky", "Ground", "Placing", "Buildings", "Props", "Bosses", "You", "Others", "Lights", "Labels", "Submit", "Chips", "Minimap", "Painting", "Sight", "Uploads", "Outside"];

/**
 * (Nov 27) The summary's parts: the recorded ones, but "outside our code" split in two. Eric's laptop, Nov 27: "Most time: Outside our
 * code 14 of 20 ms" was mostly the wait for the screen's next refresh (our 6 ms done, the 60 Hz screen's 16.7 ms not yet up), told apart
 * from real stalls only by the worst frames. Now: `STALL` (P.outside's place), the part of a frame past one refresh interval, the frames
 * the screen showed nothing new (the browser's own work, the GPU, garbage collection, another task on the page); and `WAIT` (after it),
 * the idle rest of a frame on time, nobody's cost. Worked out from each frame's time and its outside part at the summary, with the run's
 * refresh: nothing more recorded a frame.
 */
export const STALL = P.outside;
export const WAIT = NP;
export const NS = NP + 1;
export const SUM_NAMES: readonly string[] = [...PART_NAMES.slice(0, P.outside), "Stalls outside our code", "Waiting for the screen"];
export const SUM_SHORT: readonly string[] = [...PART_SHORT.slice(0, P.outside), "Stall", "Waiting"];


/** What was happening in a frame (bits). */
export const F = { walk: 1, turn: 2, zoom: 4, load: 8, upload: 16, gap: 32, reset: 64, sight: 128, room: 256, goIn: 512, goOut: 1024 } as const;

/** Frames held: 30 s at up to 120 Hz, and room to spare. */
export const MAX_FRAMES = 4096;
/** How long a run records (ms), unless the page asks for another length (`?report=S`: reportMs). */
export const RUN_MS = 30_000;
/**
 * A run's length from `?report=S` (seconds; Nov 26): 5 to 300, anything else (or `?report` alone) RUN_MS. The night town guard
 * (e2e/town-street.spec.ts) roams across the town for about 25 s on a fast machine, but the town's frame steps are capped (0.1 s), so
 * at the 4 fps of a CI runner drawing two software-WebGL towns at once the same roam takes 40 s: past 30 s the run ended itself and
 * the rest went unrecorded. It asks for 120 s and checks the run still records when it presses Done.
 */
export const reportMs = (asked: string | null): number => {
  const s = asked !== null && /^\d+$/.test(asked) ? Number(asked) : NaN;
  return s >= 5 && s <= 300 ? s * 1000 : RUN_MS;
};
/** Faster than this the camera counts as turning (degrees a second). */
export const TURN_DEG_S = 5;

/** A run's numbers, as recorded (what `summarize` reads). */
export interface RunData {
  n: number;
  /** Each frame's time (ms: since the frame before). */
  total: Float32Array;
  /** Each frame's parts (ms), NP a frame. */
  part: Float32Array;
  flags: Uint16Array;
  /** How fast the camera turned (degrees a second, unsigned). */
  turn: Float32Array;
  /** Pictures uploaded, pictures painted (counts). */
  ups: Uint16Array;
  bakes: Uint16Array;
  /** (Nov 26) The run's uploads by what each picture is (`upName`: "glow", "tag", "bubble"…; a reason after it: "glow (redrawn)"). */
  upsBy: Map<string, number>;
  /** (Nov 27) The browser's long animation frames in the run (`watchLongFrames`; where it has them): what the main thread did. */
  long: LongFrames;
}
/**
 * (Nov 27) The run's long animation frames as the browser times them (Chrome and Edge: PerformanceObserver "long-animation-frame", each
 * frame over 50 ms): how many, the time their scripts other than a frame's own callbacks took (a request's answer, a timer, an input
 * handler, the chat's), their style and layout, and the other scripts by what ran them, so a stall tells the page's own work from the
 * GPU's or garbage collection's (neither is in them). `seen`: the browser reports them at all.
 */
export interface LongFrames {
  seen: boolean;
  n: number;
  ms: number;
  scripts: number;
  layout: number;
  by: Map<string, number>;
}

export function newRun(max = MAX_FRAMES): RunData {
  return { n: 0, total: new Float32Array(max), part: new Float32Array(max * NP), flags: new Uint16Array(max), turn: new Float32Array(max), ups: new Uint16Array(max), bakes: new Uint16Array(max), upsBy: new Map(), long: { seen: false, n: 0, ms: 0, scripts: 0, layout: 0, by: new Map() } };
}

/**
 * The recorder. A frame: `begin` (the frame's rAF time), `mark(part)` after each part (the time since the last mark is that part's),
 * `take(part, ms)` for work timed where it happens inside another part (taken out of that part), then `end` with what was happening.
 */
export class FrameRec {
  readonly run: RunData;
  /** "wait": for the first move; "rec": recording; "done": the run is over (the panel shows). */
  state: "wait" | "rec" | "done" = "wait";
  startAt = 0;
  private prevNow = -1;
  private last = 0;
  private t0 = 0;
  private stolen = 0;
  private readonly cur = new Float64Array(NP);
  private ups = 0;
  private bakes = 0;
  private flags = 0;
  private heading = NaN;
  private zoom = NaN;
  /** The run ended (30 s or `runMs`, or Done): the panel's to show. */
  onDone: (() => void) | null = null;
  /** A new second of the run (0 the first recorded frame's): the pill's count, from whichever loop records (the town's or a room's). */
  onSec: ((sec: number) => void) | null = null;
  private sec = -1;
  /** Going in or out of a building (F.goIn, F.goOut; 0: neither): Town.tsx sets it, every frame meanwhile carries it. */
  door = 0;
  /** `runMs`: how long a run records (RUN_MS, or `?report=S`'s: reportMs); its frames held, at up to 120 Hz and room to spare. */
  constructor(
    private readonly clock: () => number = () => performance.now(),
    readonly runMs = RUN_MS,
  ) {
    this.run = newRun(Math.max(MAX_FRAMES, Math.ceil((runMs / 1000) * 136)));
  }

  begin(now: number): void {
    this.t0 = this.last = this.clock();
    this.stolen = 0;
    this.cur.fill(0);
    this.ups = this.bakes = this.flags = 0;
    this.frameNow = now;
  }
  private frameNow = 0;
  mark(p: PartId): void {
    const t = this.clock();
    this.cur[p] = this.cur[p]! + t - this.last - this.stolen;
    this.stolen = 0;
    this.last = t;
  }
  /** `ms` of work timed inside whatever part is under way: it's `p`'s, not that part's. */
  take(p: PartId, ms: number): void {
    this.cur[p] = this.cur[p]! + ms;
    this.stolen += ms;
  }
  /** A picture uploaded (`src`: which, named by `upName`; `why`: "redrawn", "after a lost context"…, or none for a first upload). */
  upload(ms: number, src?: object, why = ""): void {
    this.take(P.uploads, ms);
    this.ups++;
    this.flags |= F.upload;
    if (this.state !== "rec") return;
    // (Uploads are rare once the town has loaded: a string and a map entry each is fine. The panel names the sources, Nov 26.)
    const sz = src as { width?: number; height?: number } | undefined;
    const name = (src && UP_NAMES.get(src)) ?? (sz?.width !== undefined ? `other ${sz.width}×${sz.height}` : "other");
    const k = why ? `${name} (${why})` : name;
    const by = this.run.upsBy;
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  /** A picture painted the first time it shows (a roof, a wall, a figure's frame). */
  paint(ms: number): void {
    this.take(P.paint, ms);
    this.bakes++;
    this.flags |= F.load;
  }
  sight(ms: number): void {
    this.take(P.sight, ms);
    this.flags |= F.load | F.sight;
  }
  reset(): void {
    this.flags |= F.reset | F.load;
  }

  /**
   * The frame ends: `walking` (you're moving), the camera's heading (degrees) and zoom now (NaN: neither counted, a room's), and what
   * else marks it (F.room).
   */
  end(walking: boolean, heading: number, zoom: number, more = 0): void {
    const now = this.frameNow;
    const dt = this.prevNow < 0 ? 0 : now - this.prevNow;
    this.prevNow = now;
    // (The first frame after a pause, a shop or a hidden tab: its time is the pause's, not a frame's.)
    if (dt === 0 && this.state === "rec") {
      this.heading = heading;
      this.zoom = zoom;
      return;
    }
    const work = this.clock() - this.t0;
    const turnRate = dt > 0 && !Number.isNaN(this.heading) && !Number.isNaN(heading) ? (Math.abs(((((heading - this.heading) % 360) + 540) % 360) - 180) * 1000) / dt : 0;
    const zoomed = !Number.isNaN(this.zoom) && Math.abs(zoom - this.zoom) > 1e-4;
    this.heading = heading;
    this.zoom = zoom;
    let fl = this.flags | more | this.door;
    if (walking) fl |= F.walk;
    if (turnRate > TURN_DEG_S) fl |= F.turn;
    if (zoomed) fl |= F.zoom;
    if (this.state === "wait") {
      if (!(fl & (F.walk | F.turn | F.zoom))) return;
      this.state = "rec";
      this.startAt = now;
      return; // (the first frame's time is the wait's: the next one is the first recorded)
    }
    if (this.state !== "rec") return;
    const r = this.run;
    const i = r.n;
    // (Outside our code: the frame's time less our work; a long one, more than a frame and a half of it beyond ours, is a gap.)
    const outside = Math.max(0, dt - work);
    this.cur[P.outside] = outside;
    if (outside > 25 && dt > 1.5 * 16.7) fl |= F.gap;
    r.total[i] = dt;
    for (let k = 0; k < NP; k++) r.part[i * NP + k] = this.cur[k]!;
    r.flags[i] = fl;
    r.turn[i] = turnRate;
    r.ups[i] = this.ups;
    r.bakes[i] = this.bakes;
    r.n = i + 1;
    const sec = Math.floor((now - this.startAt) / 1000);
    if (sec !== this.sec) {
      this.sec = sec;
      this.onSec?.(sec);
    }
    if (now - this.startAt >= this.runMs || r.n >= r.total.length) this.finish();
  }
  finish(): void {
    if (this.state === "done") return;
    this.state = "done";
    this.endAt = this.frameNow;
    this.onDone?.();
  }
  private endAt = Infinity;
  /**
   * (Nov 27) One of the browser's long animation frames (`watchLongFrames`): counted if it falls in the run. Its scripts but the frames'
   * own callbacks ("FrameRequestCallback": the town's or a room's frame, timed as our parts) are the page's other work.
   */
  longFrame(e: { startTime: number; duration: number; styleAndLayoutStart?: number; scripts?: readonly { invoker?: string; duration: number }[] }): void {
    if (this.state === "wait" || e.startTime < this.startAt || e.startTime > this.endAt) return;
    const L = this.run.long;
    L.n++;
    L.ms += e.duration;
    if (e.styleAndLayoutStart && e.styleAndLayoutStart > e.startTime) L.layout += Math.max(0, Math.min(e.duration, e.startTime + e.duration - e.styleAndLayoutStart));
    for (const x of e.scripts ?? []) {
      const k = x.invoker || "script";
      if (k === "FrameRequestCallback") continue;
      L.scripts += x.duration;
      if (L.by.has(k) || L.by.size < 24) L.by.set(k, (L.by.get(k) ?? 0) + x.duration);
    }
  }
  /** The frames stop (a hidden tab, a test's hold): the next one starts afresh. (Not between the town and a room: that wait is seen.) */
  pause(): void {
    this.prevNow = -1;
  }
  /** Again: an empty run, waiting for the first move. */
  again(): void {
    this.run.n = 0;
    this.run.upsBy.clear();
    const L = this.run.long;
    L.n = L.ms = L.scripts = L.layout = 0;
    L.by.clear();
    this.endAt = Infinity;
    this.sec = -1;
    this.state = "wait";
    this.prevNow = -1;
    this.heading = this.zoom = NaN;
  }
}

/** The page's recorder (`?report`), or null: what render.ts, paint-gl.ts and Town.tsx's frame mark. */
export let REC: FrameRec | null = null;

/**
 * (`?report`, Nov 26) What each picture is, for the panel's uploads by source: named where it's made ("glow", "tag", "bubble", "board"…),
 * only with `?report` (a WeakMap entry each; without it, a check of a flag). Eric's laptop, Nov 26: 1,211 uploads in 16.7 s
 * of walking that the report couldn't place (they were the windows' lights, baked as each first shone).
 */
const UP_NAMES = new WeakMap<object, string>();
/** (Named from the first recorder on, between runs too: a picture made then may upload in the next run.) */
let naming = false;
export function upName<T extends object>(src: T, name: string): T {
  if (naming) UP_NAMES.set(src, name);
  return src;
}
export function setRec(r: FrameRec | null): void {
  REC = r;
  if (r) naming = true;
}

/** (Nov 27) The browser's long animation frames into `rec`'s runs, where it has them (Chrome, Edge); the returned function stops it. */
export function watchLongFrames(rec: FrameRec): () => void {
  const PO = globalThis.PerformanceObserver;
  if (!PO || !PO.supportedEntryTypes?.includes("long-animation-frame")) return () => undefined;
  rec.run.long.seen = true;
  const o = new PO((list) => {
    for (const e of list.getEntries()) rec.longFrame(e as unknown as Parameters<FrameRec["longFrame"]>[0]);
  });
  o.observe({ type: "long-animation-frame", buffered: false });
  return () => o.disconnect();
}

/**
 * The `?fps` pill's count ("60 fps · 16.7 ms": the frames of the last two half seconds and their mean time, the text set twice a
 * second). The town's frames and a room's both tick it, so inside a building it reads the room (Nov 11: it stood still on the
 * town's last reading there). A hidden tab or a test's hold restarts it, so no reading spans a pause; the black between the town and
 * a room doesn't (the wait as a room loads is real). Plain counters, nothing per frame but the text twice a second.
 */
export class FpsCount {
  private n = 0;
  private prev = 0;
  private at = 0;
  private prevAt = 0;
  constructor(private readonly el: { textContent: string | null; dataset: DOMStringMap }) {}
  tick(now: number): void {
    this.n++;
    if (!this.at) this.at = this.prevAt = now;
    else if (now - this.at >= 500) {
      const n = this.n + this.prev;
      const ms = now - this.prevAt;
      this.el.textContent = `${Math.round((n * 1000) / ms)} fps · ${(ms / n).toFixed(1)} ms`;
      this.el.dataset.fps = String(Math.round((n * 1000) / ms));
      this.prev = this.n;
      this.n = 0;
      this.prevAt = this.at;
      this.at = now;
    }
  }
  restart(): void {
    this.n = this.prev = this.at = this.prevAt = 0;
  }
}
/** The page's `?fps` count, or null: what Town.tsx's and a room's frames tick. */
export let FPS: FpsCount | null = null;
export function setFps(c: FpsCount | null): void {
  FPS = c;
}

// ---- The summary (pure: the panel's numbers, unit-tested).

/** The value at fraction `q` (0 to 1) of the sorted list, by nearest rank. */
export function quantile(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (!n) return 0;
  const i = Math.min(n - 1, Math.max(0, Math.ceil(q * n) - 1));
  return sorted[i]!;
}

/** The screen's refresh from the frame times (the fast end of them), snapped to a usual rate if near one. */
export function refreshOf(sortedMs: ArrayLike<number>): number {
  if (!sortedMs.length) return 0;
  const p = quantile(sortedMs, 0.1);
  if (p <= 0) return 0;
  const hz = 1000 / p;
  for (const r of [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240]) if (Math.abs(hz - r) / r < 0.06) return r;
  return Math.round(hz);
}

export interface Segment {
  name: string;
  frames: number;
  /** The median frames a second over these frames. */
  fps: number;
  /** Per part (the summary's NS: SUM_NAMES): the mean and the worst (ms). */
  avg: number[];
  max: number[];
  /** The mean frame time (ms). */
  mean: number;
}
export interface Worst {
  /** Its index in the run, its time and when (ms from the start). */
  i: number;
  ms: number;
  at: number;
  /** What was happening, in words. */
  what: string;
  /** Its biggest part and that part's time. */
  top: number;
  topMs: number;
}
export interface Summary {
  frames: number;
  /** Seconds recorded. */
  secs: number;
  /** Frames a second: the mean, the median frame's, the 5th and 1st percentile's (the slow end). */
  meanFps: number;
  p50: number;
  p5: number;
  p1: number;
  /** Shares of frames over 20 ms and over 33 ms. */
  over20: number;
  over33: number;
  refresh: number;
  /** All, walking, turning, loading (the town's), in a room, going in or out. */
  segs: Segment[];
  worst: Worst[];
  /** Where the most time went: overall, and while turning (−1: no turning recorded); and of our own parts (the outside part left out). */
  top: number;
  topTurn: number;
  ours: number;
  oursTurn: number;
  /** The fastest turn (degrees a second). */
  maxTurn: number;
  uploads: number;
  /** (Nov 26) The uploads by source, most first. */
  uploadsBy: [string, number][];
  bakes: number;
  resets: number;
  /** (Nov 27) The browser's long animation frames (null: it doesn't report them): count, ms, other scripts, style and layout, top scripts. */
  long: { n: number; ms: number; scripts: number; layout: number; by: [string, number][] } | null;
}

const fpsOf = (ms: number) => (ms > 0 ? 1000 / ms : 0);

/** What was happening in frame `i`, in a few words ("turning 140°/s · 3 painted · 12 uploads"). */
export function whatOf(r: RunData, i: number): string {
  const f = r.flags[i]!;
  const out: string[] = [];
  if (f & F.walk) out.push("walking");
  if (f & F.turn) out.push(`turning ${Math.round(r.turn[i]!)}°/s`);
  if (f & F.zoom) out.push("zoom");
  if (r.bakes[i]) out.push(`${r.bakes[i]} painted`);
  if (f & F.sight) out.push("sight lines");
  if (r.ups[i]) out.push(`${r.ups[i]} upload${r.ups[i] === 1 ? "" : "s"}`);
  if (f & F.room) out.push("in a room");
  if (f & F.goIn) out.push("going in");
  if (f & F.goOut) out.push("going out");
  if (f & F.reset) out.push("atlas reset");
  if (f & F.gap) out.push("gap");
  return out.length ? out.join(" · ") : "standing";
}

function segment(r: RunData, parts: Float32Array, name: string, keep: (i: number) => boolean): Segment {
  const avg = new Array<number>(NS).fill(0);
  const max = new Array<number>(NS).fill(0);
  const times: number[] = [];
  let sum = 0;
  for (let i = 0; i < r.n; i++) {
    if (!keep(i)) continue;
    times.push(r.total[i]!);
    sum += r.total[i]!;
    for (let k = 0; k < NS; k++) {
      const v = parts[i * NS + k]!;
      avg[k]! += v;
      if (v > max[k]!) max[k] = v;
    }
  }
  const n = times.length;
  if (n) for (let k = 0; k < NS; k++) avg[k]! /= n;
  times.sort((a, b) => a - b);
  return { name, frames: n, fps: n ? fpsOf(quantile(times, 0.5)) : 0, avg, max, mean: n ? sum / n : 0 };
}

const argmax = (xs: readonly number[], n = xs.length) => xs.reduce((b, x, i) => (i < n && x > xs[b]! ? i : b), 0);

/**
 * (Nov 27) Each frame's parts as the summary has them (NS a frame): the recorded ones, the outside part split into its stall (past one
 * refresh interval of `refreshMs`) and its wait (the rest: the screen's next refresh not yet due when our work was done).
 */
export function splitParts(r: RunData, refreshMs: number): Float32Array {
  const out = new Float32Array(r.n * NS);
  for (let i = 0; i < r.n; i++) {
    for (let k = 0; k < NP; k++) out[i * NS + k] = r.part[i * NP + k]!;
    const outside = r.part[i * NP + P.outside]!;
    const ours = r.total[i]! - outside;
    const wait = Math.min(outside, Math.max(0, refreshMs - ours));
    out[i * NS + STALL] = outside - wait;
    out[i * NS + WAIT] = wait;
  }
  return out;
}

export function summarize(r: RunData): Summary {
  const n = r.n;
  const sorted = Array.from(r.total.subarray(0, n)).sort((a, b) => a - b);
  const refresh = refreshOf(sorted);
  const parts = splitParts(r, refresh ? 1000 / refresh : 1000 / 60);
  let secs = 0;
  let resets = 0;
  let uploads = 0;
  let bakes = 0;
  let maxTurn = 0;
  for (let i = 0; i < n; i++) {
    secs += r.total[i]!;
    if (r.flags[i]! & F.reset) resets++;
    uploads += r.ups[i]!;
    bakes += r.bakes[i]!;
    if (r.turn[i]! > maxTurn) maxTurn = r.turn[i]!;
  }
  // (Loading: pictures painted, sight lines, an atlas reset. Not a plain upload: since Nov 25 the labels are made on the loading screen, and
  // an upload while walking is someone new or a line said.)
  const load = F.load;
  const town = (i: number) => !(r.flags[i]! & (F.room | F.goIn | F.goOut));
  const segs = [
    segment(r, parts, "All", () => true),
    segment(r, parts, "Walk", (i) => town(i) && !!(r.flags[i]! & F.walk) && !(r.flags[i]! & F.turn)),
    segment(r, parts, "Turn", (i) => town(i) && !!(r.flags[i]! & F.turn)),
    segment(r, parts, "Load", (i) => town(i) && !!(r.flags[i]! & load)),
    segment(r, parts, "Room", (i) => (r.flags[i]! & (F.room | F.goIn | F.goOut)) === F.room),
    segment(r, parts, "In/out", (i) => !!(r.flags[i]! & (F.goIn | F.goOut))),
  ];
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => r.total[b]! - r.total[a]! || a - b);
  const worst: Worst[] = [];
  let at = 0;
  const startOf = new Float64Array(n);
  for (let i = 0; i < n; i++) ((startOf[i] = at), (at += r.total[i]!));
  for (const i of order.slice(0, 10)) {
    const fp = Array.from(parts.subarray(i * NS, i * NS + NS));
    // (Its biggest part, the wait for the screen left out: nobody's cost.)
    const top = argmax(fp, WAIT);
    worst.push({ i, ms: r.total[i]!, at: startOf[i]!, what: whatOf(r, i), top, topMs: fp[top]! });
  }
  const L = r.long;
  return {
    frames: n,
    secs: secs / 1000,
    meanFps: secs > 0 ? (n * 1000) / secs : 0,
    p50: fpsOf(quantile(sorted, 0.5)),
    p5: fpsOf(quantile(sorted, 0.95)),
    p1: fpsOf(quantile(sorted, 0.99)),
    over20: n ? sorted.filter((x) => x > 20).length / n : 0,
    over33: n ? sorted.filter((x) => x > 33.4).length / n : 0,
    refresh,
    segs,
    worst,
    // (Where the most time went: the wait for the screen left out; of ours, the stalls too.)
    top: n ? argmax(segs[0]!.avg, WAIT) : -1,
    topTurn: segs[2]!.frames ? argmax(segs[2]!.avg, WAIT) : -1,
    ours: n ? argmax(segs[0]!.avg, P.outside) : -1,
    oursTurn: segs[2]!.frames ? argmax(segs[2]!.avg, P.outside) : -1,
    maxTurn,
    uploads,
    uploadsBy: [...r.upsBy].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
    bakes,
    resets,
    long: L.seen ? { n: L.n, ms: L.ms, scripts: L.scripts, layout: L.layout, by: [...L.by].sort((a, b) => b[1] - a[1]).slice(0, 4) } : null,
  };
}

/** The browser and device from a user agent, short ("Safari 18.1 · iPhone"; "Chrome 131 · Android"). */
export function browserOf(ua: string): string {
  const dev = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const m =
    /(Edg|EdgiOS)\/(\d+)/.exec(ua) ??
    /(CriOS|Chrome)\/(\d+)/.exec(ua) ??
    /(FxiOS|Firefox)\/(\d+)/.exec(ua) ??
    /Version\/(\d+(?:\.\d+)?).*(Safari)/.exec(ua);
  let name = "";
  if (m) {
    if (m[2] === "Safari") name = `Safari ${m[1]}`;
    else {
      const k = m[1]!;
      name = `${k === "Edg" || k === "EdgiOS" ? "Edge" : k === "CriOS" || k === "Chrome" ? "Chrome" : "Firefox"} ${m[2]}`;
    }
  }
  if (/HeadlessChrome\/(\d+)/.test(ua)) name = `Headless Chrome ${/HeadlessChrome\/(\d+)/.exec(ua)![1]}`;
  return [name, dev].filter(Boolean).join(" · ") || "unknown browser";
}

/** The clock's step (ms): the smallest nonzero difference between readings, over a few (Safari's is coarse). */
export function timerStep(clock: () => number = () => performance.now()): number {
  let step = Infinity;
  let prev = clock();
  for (let k = 0, got = 0; k < 200000 && got < 5; k++) {
    const t = clock();
    if (t > prev) {
      step = Math.min(step, t - prev);
      prev = t;
      got++;
    }
  }
  return Number.isFinite(step) ? step : 0;
}
