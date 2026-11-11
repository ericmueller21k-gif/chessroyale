/**
 * The frame report (`/town?report`, anyone's, like `?fps`; Eric, Nov 11: "turning is dropping it to like 40 frames … maybe also
 * loading, when I go to a new spot"). It records every frame of a run (from your first move, for 30 s or until "Done"): the frame's
 * time, the time of each part of the town's frame (the parts below, named from the code), and what was happening (walking, turning
 * and how fast, a zoom, loading: roofs painted, sight lines worked out, textures uploaded, an atlas page started again; a long gap
 * outside our code). Then it shows one panel sized to be screenshotted (frame-report-panel.ts), from `summarize` below.
 *
 * Plain typed arrays made once as the page opens with `?report`; nothing allocated per frame. Without `?report` there's no recorder
 * (`REC` stays null) and the draw's marks are a null check each.
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

/** What was happening in a frame (bits). */
export const F = { walk: 1, turn: 2, zoom: 4, load: 8, upload: 16, gap: 32, reset: 64, sight: 128 } as const;

/** Frames held: 30 s at up to 120 Hz, and room to spare. */
export const MAX_FRAMES = 4096;
/** How long a run records (ms). */
export const RUN_MS = 30_000;
/** Faster than this the camera counts as turning (degrees a second). */
export const TURN_DEG_S = 5;

/** A run's numbers, as recorded (what `summarize` reads). */
export interface RunData {
  n: number;
  /** Each frame's time (ms: since the frame before). */
  total: Float32Array;
  /** Each frame's parts (ms), NP a frame. */
  part: Float32Array;
  flags: Uint8Array;
  /** How fast the camera turned (degrees a second, unsigned). */
  turn: Float32Array;
  /** Pictures uploaded, pictures painted (counts). */
  ups: Uint16Array;
  bakes: Uint16Array;
}

export function newRun(max = MAX_FRAMES): RunData {
  return { n: 0, total: new Float32Array(max), part: new Float32Array(max * NP), flags: new Uint8Array(max), turn: new Float32Array(max), ups: new Uint16Array(max), bakes: new Uint16Array(max) };
}

/**
 * The recorder. A frame: `begin` (the frame's rAF time), `mark(part)` after each part (the time since the last mark is that part's),
 * `take(part, ms)` for work timed where it happens inside another part (taken out of that part), then `end` with what was happening.
 */
export class FrameRec {
  readonly run: RunData = newRun();
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
  /** The run ended (30 s, or Done): the panel's to show. */
  onDone: (() => void) | null = null;
  constructor(private readonly clock: () => number = () => performance.now()) {}

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
  upload(ms: number): void {
    this.take(P.uploads, ms);
    this.ups++;
    this.flags |= F.upload;
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

  /** The frame ends: `walking` (you're moving), the camera's heading (degrees) and zoom now. */
  end(walking: boolean, heading: number, zoom: number): void {
    const now = this.frameNow;
    const dt = this.prevNow < 0 ? 0 : now - this.prevNow;
    this.prevNow = now;
    const work = this.clock() - this.t0;
    const turnRate = dt > 0 && !Number.isNaN(this.heading) ? (Math.abs(((((heading - this.heading) % 360) + 540) % 360) - 180) * 1000) / dt : 0;
    const zoomed = !Number.isNaN(this.zoom) && Math.abs(zoom - this.zoom) > 1e-4;
    this.heading = heading;
    this.zoom = zoom;
    let fl = this.flags;
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
    if (now - this.startAt >= RUN_MS || r.n >= r.total.length) this.finish();
  }
  finish(): void {
    if (this.state === "done") return;
    this.state = "done";
    this.onDone?.();
  }
  /** Again: an empty run, waiting for the first move. */
  again(): void {
    this.run.n = 0;
    this.state = "wait";
    this.prevNow = -1;
    this.heading = this.zoom = NaN;
  }
}

/** The page's recorder (`?report`), or null: what render.ts, paint-gl.ts and Town.tsx's frame mark. */
export let REC: FrameRec | null = null;
export function setRec(r: FrameRec | null): void {
  REC = r;
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
  /** Per part: the mean and the worst (ms). */
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
  /** All, walking, turning, loading. */
  segs: Segment[];
  worst: Worst[];
  /** Where the most time went: overall, and while turning (−1: no turning recorded). */
  top: number;
  topTurn: number;
  /** The fastest turn (degrees a second). */
  maxTurn: number;
  uploads: number;
  bakes: number;
  resets: number;
}

const fpsOf = (ms: number) => (ms > 0 ? 1000 / ms : 0);

/** What was happening in frame `i`, in words ("turning 140°/s · 3 roofs painted · 12 uploads"). */
export function whatOf(r: RunData, i: number): string {
  const f = r.flags[i]!;
  const out: string[] = [];
  if (f & F.walk) out.push("walking");
  if (f & F.turn) out.push(`turning ${Math.round(r.turn[i]!)}°/s`);
  if (f & F.zoom) out.push("zoom");
  if (r.bakes[i]) out.push(`${r.bakes[i]} new picture${r.bakes[i] === 1 ? "" : "s"}`);
  if (f & F.sight) out.push("sight lines");
  if (r.ups[i]) out.push(`${r.ups[i]} upload${r.ups[i] === 1 ? "" : "s"}`);
  if (f & F.reset) out.push("atlas page reset");
  if (f & F.gap) out.push("long gap outside our code");
  return out.length ? out.join(" · ") : "standing";
}

function segment(r: RunData, name: string, keep: (i: number) => boolean): Segment {
  const avg = new Array<number>(NP).fill(0);
  const max = new Array<number>(NP).fill(0);
  const times: number[] = [];
  let sum = 0;
  for (let i = 0; i < r.n; i++) {
    if (!keep(i)) continue;
    times.push(r.total[i]!);
    sum += r.total[i]!;
    for (let k = 0; k < NP; k++) {
      const v = r.part[i * NP + k]!;
      avg[k]! += v;
      if (v > max[k]!) max[k] = v;
    }
  }
  const n = times.length;
  if (n) for (let k = 0; k < NP; k++) avg[k]! /= n;
  times.sort((a, b) => a - b);
  return { name, frames: n, fps: n ? fpsOf(quantile(times, 0.5)) : 0, avg, max, mean: n ? sum / n : 0 };
}

const argmax = (xs: readonly number[]) => xs.reduce((b, x, i) => (x > xs[b]! ? i : b), 0);

export function summarize(r: RunData): Summary {
  const n = r.n;
  const sorted = Array.from(r.total.subarray(0, n)).sort((a, b) => a - b);
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
  const load = F.load | F.upload | F.reset;
  const segs = [
    segment(r, "All", () => true),
    segment(r, "Walk", (i) => !!(r.flags[i]! & F.walk) && !(r.flags[i]! & F.turn)),
    segment(r, "Turn", (i) => !!(r.flags[i]! & F.turn)),
    segment(r, "Load", (i) => !!(r.flags[i]! & load)),
  ];
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => r.total[b]! - r.total[a]! || a - b);
  const worst: Worst[] = [];
  let at = 0;
  const startOf = new Float64Array(n);
  for (let i = 0; i < n; i++) ((startOf[i] = at), (at += r.total[i]!));
  for (const i of order.slice(0, 10)) {
    const parts = Array.from(r.part.subarray(i * NP, i * NP + NP));
    const top = argmax(parts);
    worst.push({ i, ms: r.total[i]!, at: startOf[i]!, what: whatOf(r, i), top, topMs: parts[top]! });
  }
  return {
    frames: n,
    secs: secs / 1000,
    meanFps: secs > 0 ? (n * 1000) / secs : 0,
    p50: fpsOf(quantile(sorted, 0.5)),
    p5: fpsOf(quantile(sorted, 0.95)),
    p1: fpsOf(quantile(sorted, 0.99)),
    over20: n ? sorted.filter((x) => x > 20).length / n : 0,
    over33: n ? sorted.filter((x) => x > 33.4).length / n : 0,
    refresh: refreshOf(sorted),
    segs,
    worst,
    top: n ? argmax(segs[0]!.avg) : -1,
    topTurn: segs[2]!.frames ? argmax(segs[2]!.avg) : -1,
    maxTurn,
    uploads,
    bakes,
    resets,
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
