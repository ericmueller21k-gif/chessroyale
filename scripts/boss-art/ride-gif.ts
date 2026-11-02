/**
 * One GIF for a ride (Oct 31): the ride and its pawn running right 3 squares, left 3 (the side view mirrored), up 2 (the
 * back view), down 2 (the front view), then standing in its idle, on a patch of the town's floor at the town's scale,
 * with a plain pawn on foot beside it so the ride's size reads at a glance. While it runs it drops its trail marks on the
 * squares it leaves, fading as the town would (the town's white droplets for a ride with no trail mark yet); none while
 * it stands. A strip along the top names the ride and gives its width in squares and drawing units (red when wider than
 * `TOO_WIDE_UNITS`). Its own process, like item-render.ts, with no API key.
 *   npx tsx scripts/boss-art/ride-gif.ts <id | draft.tsx> [color] [--out <file or folder>] [--strip <png>]
 *   npx tsx scripts/boss-art/ride-gif.ts --all [--out <folder>]
 *   npx tsx scripts/boss-art/ride-gif.ts --trail-check <before.tsx> <after.tsx> [--out <folder>]
 * The GIF is `scripts/boss-art/out/<id>/preview/ride.gif` (not committed), and a copy at `--out`. `--strip` also writes
 * a few of its frames stacked in one PNG (the runner's look at a trail). `--trail-check` compares a ride before and after
 * its trail was added (run.ts `--rider-trail`) and prints one line of JSON.
 */
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ITEM_COLORS } from "@chessroyale/core";
import { newPt, newView, proj, setView } from "../../packages/app/src/town/camera.ts";
import { TOWN_FEEL } from "../../packages/app/src/town/feel.ts";
import type { Cell, Droplet } from "./ride-gif-harness.tsx";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

// ---------------- The scale ----------------

/** Town size: pixels per unit of the pawn's 100-unit square (a pawn about 45 px; item-harness.tsx's town size). Shown 2x, nearest-neighbor. */
const TOWN_SCALE = 0.45;
const SHOW = 2;
/** Units in one town square: the town draws your pawn's whole 100-unit box `youSquares` (1.45) squares across. */
const SQ_UNITS = 100 / TOWN_FEEL.youSquares;
/** A town square in town pixels (100 / 1.45 = 69 units, 31 px). */
const SQ_W = Math.round(SQ_UNITS * TOWN_SCALE);
/** A square's depth on screen, as the town's camera shows it on a phone zoomed out (the town's default), against its width. */
function floorAspect(): number {
  const v = newView();
  setView(v, 390, 844, 1);
  const mid = newPt();
  const near = newPt();
  const far = newPt();
  proj(v, 0, 0, 0, mid);
  proj(v, 0, -0.5, 0, near);
  proj(v, 0, 0.5, 0, far);
  return (near.y - far.y) / mid.k;
}
const SQ_H = Math.round(SQ_W * floorAspect());
/** The widest a ride should be, in drawing units (drawn pixels, every frame of every view): 125, about 1.8 town squares. */
const TOO_WIDE_UNITS = 125;
/** The floor (render.ts SQ_LIGHT, SQ_DARK) and its seams (groundColors: the square's color x 0.86). */
const SQ_LIGHT = [238, 197, 139] as const;
const SQ_DARK = [173, 128, 88] as const;
const SEAM = 0.86;

// ---------------- The film ----------------

/**
 * The sequence: squares run each way; each square takes a bot's step (200 ms, `botStepMs`: your own 90 hides the animation),
 * the ride's move frames scaled to fit, as the town would; the whole GIF's aim, the idle at the end (the ride's own
 * timing) and the shortest and longest pause between runs (ms).
 */
const RIGHT = 3;
const LEFT = 3;
const UP = 2;
const DOWN = 2;
const SQUARE_MS = TOWN_FEEL.botStepMs;
const AIM_MS = 10_000;
const END_IDLE_MS = 2_500;
const HOLD_MIN_MS = 350;
const HOLD_MAX_MS = 1_500;
const MIN_FRAME_MS = 20;
const MAX_BYTES = 4_000_000;
const CAPTION_H = 34;
/** A ride's pictures are drawn in a cell this big (town pixels) with the pawn's foot in the middle; measured 5x finer. */
const CELL: Cell = { cw: 220, ch: 170, ax: 110, ay: 140, ss: 1 };
const MEASURE: Cell = { ...CELL, ss: 5 };
/** A trail mark's cell (town pixels, the spot it lands on in the middle; mirrored about that column): room for twice its largest box. */
const MARK_CELL: Cell = { cw: 41, ch: 31, ax: 20, ay: 15, ss: 1 };
/** The town's droplet, for a ride with no trail mark yet, drawn at this many ages over its life. */
const DROP_FRAMES = 8;
/** Alpha above this counts as drawn when measuring. */
const DRAWN = 20;

type View = "side" | "front" | "back";
interface TrailInfo {
  ms: number[];
  every: number;
  w: number;
  h: number;
}
interface Info {
  id: string;
  name: string;
  views: Partial<Record<View, { idleMs: number[]; moveMs: number[]; moveDx: number[] }>>;
  trail: TrailInfo | null;
  /** A trail mark's limits (item-kit.tsx TRAIL_MAX). */
  trailMax: { w: number; h: number };
}
interface Beat {
  /** When it starts, from the GIF's start (ms). */
  t: number;
  ms: number;
  key: string;
  flip: boolean;
  x: number;
  y: number;
  action: string;
}
/** A trail mark on the floor: where it landed (town pixels), when, which way the ride was going, and its number in the run. */
interface Drop {
  t0: number;
  x: number;
  y: number;
  view: View;
  flip: boolean;
  n: number;
}
interface Frame {
  view: View;
  anim: "idle" | "move";
  f: number;
}
/** The harness' api (ride-gif-harness.tsx), as called from here. */
interface Api {
  info(): Info | { error: string };
  sprite(c: Cell, v: View, anim: "idle" | "move", f: number, color: string): void;
  mark(c: Cell, v: View, f: number, n: number, color: string, drop?: Droplet): void;
  pawn(c: Cell): void;
  caption(w: number, h: number, name: string, width: string, over: boolean, action: string): void;
}
declare global {
  interface Window {
    __RIDE: Api;
  }
}

const color4 = (c: readonly number[], k = 1) => [Math.round(c[0]! * k), Math.round(c[1]! * k), Math.round(c[2]! * k)] as const;

interface Img {
  data: Buffer;
  w: number;
  h: number;
}

/** Chromium's screenshot of the page's top left, as straight RGBA. */
async function shoot(page: Page, w: number, h: number): Promise<Img> {
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** The box of the drawn pixels (alpha above DRAWN): min and max x and y, or null when nothing's drawn. */
function drawnBox(img: Img): { x0: number; x1: number; y0: number; y1: number } | null {
  let x0 = img.w;
  let x1 = -1;
  let y0 = img.h;
  let y1 = -1;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (img.data[(y * img.w + x) * 4 + 3]! > DRAWN) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0, x1, y0, y1 };
}

/** `src` (sw x sh, straight RGBA) over `dst` (opaque RGBA) at (ox, oy), clipped to dst. */
function blit(dst: Buffer, dw: number, dh: number, src: Buffer, sw: number, sh: number, ox: number, oy: number): void {
  for (let y = 0; y < sh; y++) {
    const ty = oy + y;
    if (ty < 0 || ty >= dh) continue;
    for (let x = 0; x < sw; x++) {
      const tx = ox + x;
      if (tx < 0 || tx >= dw) continue;
      const s = (y * sw + x) * 4;
      const a = src[s + 3]!;
      if (!a) continue;
      const d = (ty * dw + tx) * 4;
      if (a === 255) {
        dst[d] = src[s]!;
        dst[d + 1] = src[s + 1]!;
        dst[d + 2] = src[s + 2]!;
      } else {
        dst[d] = Math.round((src[s]! * a + dst[d]! * (255 - a)) / 255);
        dst[d + 1] = Math.round((src[s + 1]! * a + dst[d + 1]! * (255 - a)) / 255);
        dst[d + 2] = Math.round((src[s + 2]! * a + dst[d + 2]! * (255 - a)) / 255);
      }
      dst[d + 3] = 255;
    }
  }
}

/** A picture turned to face the other way, about the cell's middle column (the foot's). */
function mirrorX(img: Buffer, w: number, h: number): Buffer {
  const out = Buffer.alloc(img.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.copy(out, (y * w + (w - 1 - x)) * 4, (y * w + x) * 4, (y * w + x) * 4 + 4);
  return out;
}

// ---------------- A ride's page ----------------

interface RidePage {
  page: Page;
  info: Info;
  has(v: View): boolean;
  /** Every frame of every view it has: its idle, then its move. */
  frames(): Frame[];
  sprite(c: Cell, f: Frame, color: string): Promise<Img>;
  mark(c: Cell, v: View, f: number, n: number, color: string, drop?: Droplet): Promise<Img>;
  close(): Promise<void>;
}

/** The drawing bundled with the harness, on a page of its own. */
async function openRide(browser: Browser, draft: string): Promise<RidePage> {
  const js = (
    await build({
      entryPoints: [resolve(HERE, "ride-gif-harness.tsx")],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      jsx: "automatic",
      jsxImportSource: "preact",
      logLevel: "silent",
      plugins: [{ name: "draft", setup: (b) => b.onResolve({ filter: /^virtual:draft$/ }, () => ({ path: draft })) }],
    }).catch((e: { errors?: { text: string; location?: { file: string; line: number } }[] }) => {
      throw new Error(`the drawing doesn't compile: ${e.errors ? e.errors.slice(0, 5).map((x) => `${x.location ? `${basename(x.location.file)}:${x.location.line}: ` : ""}${x.text}`).join("; ") : String(e)}`);
    })
  ).outputFiles[0]!.text;
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  try {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style></head><body><div id="app"></div><script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`);
    await page.waitForFunction(() => (window as unknown as { __RIDE?: unknown }).__RIDE, null, { timeout: 30_000 }).catch(() => {
      throw new Error(`the page never started${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    });
    const info = await page.evaluate(() => window.__RIDE.info());
    if ("error" in info) throw new Error(info.error);
    const has = (v: View) => !!info.views[v];
    return {
      page,
      info,
      has,
      frames() {
        const out: Frame[] = [];
        for (const v of ["side", "front", "back"] as const)
          if (has(v)) for (const anim of ["idle", "move"] as const) for (let f = 0; f < info.views[v]![anim === "idle" ? "idleMs" : "moveMs"].length; f++) out.push({ view: v, anim, f });
        return out;
      },
      async sprite(c, f, color) {
        await page.evaluate(([cc, ff, col]) => window.__RIDE.sprite(cc as Cell, (ff as Frame).view, (ff as Frame).anim, (ff as Frame).f, col as string), [c, f, color] as const);
        return shoot(page, c.cw * c.ss, c.ch * c.ss);
      },
      async mark(c, v, f, n, color, drop) {
        await page.evaluate(([cc, vv, ff, nn, col, dd]) => window.__RIDE.mark(cc as Cell, vv as View, ff as number, nn as number, col as string, (dd ?? undefined) as Droplet | undefined), [c, v, f, n, color, drop ?? null] as const);
        return shoot(page, c.cw * c.ss, c.ch * c.ss);
      },
      close: () => page.close(),
    };
  } catch (e) {
    await page.close();
    throw e;
  }
}

// ---------------- One ride ----------------

interface Made {
  id: string;
  widthSq: number;
  widthUnits: number;
  widest: string;
  seconds: number;
  bytes: number;
  file: string;
  /** Its own trail mark, or the town's droplets (no trail mark yet). */
  trail: "mark" | "droplets";
  warnings: string[];
}

async function makeGif(browser: Browser, draft: string, color: string, gifPath: string, stripPath?: string): Promise<Made> {
  const warnings: string[] = [];
  const ride = await openRide(browser, draft);
  try {
    const { info, has } = ride;

    // Its width: the widest frame of any view, from the drawn pixels (5x finer than the town's, without the pose's dx).
    // (Only the ride and its pawn: its trail marks are drawn apart, on the floor, and never measured.)
    let widest = { units: 0, at: "" };
    let leftPx = 0;
    let risePx = 0;
    let belowPx = 0;
    let clipped = false;
    for (const f of ride.frames()) {
      const img = await ride.sprite(MEASURE, f, color);
      const box = drawnBox(img);
      if (!box) continue;
      const units = (box.x1 - box.x0 + 1) / (TOWN_SCALE * MEASURE.ss);
      if (units > widest.units) widest = { units, at: `${f.view} ${f.anim} ${f.f}` };
      leftPx = Math.max(leftPx, (MEASURE.ax * MEASURE.ss - box.x0) / MEASURE.ss);
      risePx = Math.max(risePx, (MEASURE.ay * MEASURE.ss - box.y0) / MEASURE.ss);
      belowPx = Math.max(belowPx, (box.y1 + 1 - MEASURE.ay * MEASURE.ss) / MEASURE.ss);
      if (box.x0 === 0 || box.y0 === 0 || box.x1 === img.w - 1 || box.y1 === img.h - 1) clipped = true;
    }
    if (clipped) warnings.push("a frame reaches the edge of the picture box (about 3 squares round the pawn's foot): it is cut, and its width understated");
    const widthSq = (widest.units / 100) * TOWN_FEEL.youSquares;
    const widthUnits = Math.round(widest.units);

    // The plain pawn's pictures (and its height).
    await ride.page.evaluate((c) => window.__RIDE.pawn(c as Cell), CELL);
    const pawnImg = await shoot(ride.page, CELL.cw, CELL.ch);
    const pawnBox = drawnBox(pawnImg);
    risePx = Math.max(risePx, pawnBox ? CELL.ay - pawnBox.y0 : 0);

    // The patch of floor: a column for the ride's start, its three squares of run, the pawn's and one more, and room to its left.
    const lcols = Math.max(1, Math.ceil(leftPx / SQ_W - 0.5));
    const cols = lcols + RIGHT + 3;
    const W = cols * SQ_W;
    const homeX = lcols * SQ_W + Math.floor(SQ_W / 2);
    const homeY = Math.ceil(risePx) + UP * SQ_H + 2;
    const H = homeY + Math.max(Math.ceil(belowPx) + 2, Math.round(SQ_H * 0.75));
    const pawnX = homeX + (RIGHT + 1) * SQ_W;
    const floor = Buffer.alloc(W * H * 4);
    const rowOrigin = homeY - Math.floor(SQ_H / 2);
    for (let y = 0; y < H; y++) {
      const row = Math.floor((y - rowOrigin) / SQ_H);
      const seamY = (((y - rowOrigin) % SQ_H) + SQ_H) % SQ_H === 0;
      for (let x = 0; x < W; x++) {
        const col = Math.floor(x / SQ_W);
        const base = (col + row) & 1 ? SQ_DARK : SQ_LIGHT;
        const c = color4(base, seamY || x % SQ_W === 0 ? SEAM : 1);
        const i = (y * W + x) * 4;
        floor[i] = c[0];
        floor[i + 1] = c[1];
        floor[i + 2] = c[2];
        floor[i + 3] = 255;
      }
    }

    // Its trail: its own mark, or the town's droplets (TOWN_FEEL trailLifeMs, drawn at DROP_FRAMES ages).
    const trail: TrailInfo = info.trail ?? { ms: Array.from({ length: DROP_FRAMES }, () => TOWN_FEEL.trailLifeMs / DROP_FRAMES), every: 1, w: 0, h: 0 };
    if (!trail.ms.length || trail.ms.some((m) => !(m > 0))) throw new Error(`trail.ms must be one or more lengths in ms, each above 0 (it is [${trail.ms.join(", ")}])`);
    const every = Math.max(1, Math.round(trail.every || 1));
    /** When each of the mark's frames ends, from when it landed. */
    const ends = trail.ms.reduce<number[]>((a, m) => [...a, (a[a.length - 1] ?? 0) + m], []);

    // The sequence of beats: where the ride stands (the pawn's foot, in town pixels), which picture, from when, for how
    // long; and the marks it drops on the way.
    const beats: Beat[] = [];
    const drops: Drop[] = [];
    let now = 0;
    let x = homeX;
    let y = homeY;
    let left = 0;
    let lastDrop = -Infinity;
    const runEnds: number[] = [];
    const idleOf = (v: View) => info.views[v]!.idleMs;
    const viewFor = (want: View): View => (has(want) ? want : "side");
    const holdMs = Math.round(Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, (AIM_MS - (RIGHT + LEFT + UP + DOWN) * SQUARE_MS - END_IDLE_MS) / 4)));
    const hold = (v: View, flip: boolean, ms: number, action: string) => {
      const idle = idleOf(v);
      for (let rest = ms, f = 0; rest > 0; f++) {
        let len = Math.min(rest, Math.max(MIN_FRAME_MS, idle[f % idle.length]!));
        if (rest - len < MIN_FRAME_MS) len = rest; // (no sliver of a frame at the end)
        beats.push({ t: now, ms: len, key: `${v}:idle:${f % idle.length}`, flip, x, y, action });
        rest -= len;
        now += len;
      }
    };
    const run = (want: View, flip: boolean, dx: number, dy: number, n: number, action: string) => {
      const v = viewFor(want);
      const { moveMs, moveDx } = info.views[v]!;
      // One square takes SQUARE_MS: the move's frames keep their proportions but are scaled to fit.
      const raw = moveMs.reduce((s, m) => s + m, 0);
      const fit = raw > 0 ? SQUARE_MS / raw : 1;
      for (let j = 0; j < n; j++) {
        // The town drops a mark on the square you leave as the step onto the next begins (render.ts drawMarks: at most
        // one every trailEveryMs), here every `every` squares; it faces the way the ride is going.
        if (left++ % every === 0 && now - lastDrop >= TOWN_FEEL.trailEveryMs) {
          drops.push({ t0: now, x: Math.round(x + dx * j * SQ_W), y: Math.round(y + dy * j * SQ_H), view: want, flip: want === "side" && flip, n: drops.length });
          lastDrop = now;
        }
        for (let k = 0, t = 0; k < moveMs.length; k++) {
          const ms = moveMs[k]! * fit;
          // The side view travels as it was drawn (dx 0 to 100 a square); the front and back views move in place and the town slides them along evenly.
          const p = v === "side" ? moveDx[k]! / 100 : (t + ms / 2) / SQUARE_MS;
          beats.push({ t: now, ms, key: `${v}:move:${k}`, flip: v === "side" && flip, x: Math.round(x + dx * (j + p) * SQ_W), y: Math.round(y + dy * (j + p) * SQ_H), action });
          t += ms;
          now += ms;
        }
      }
      x += dx * n * SQ_W;
      y += dy * n * SQ_H;
      runEnds.push(now);
    };
    if (!has("front")) warnings.push("no front view: the side view stands in for running down (run --rider-views to draw it)");
    if (!has("back")) warnings.push("no back view: the side view stands in for running up (run --rider-views to draw it)");
    hold("side", false, holdMs, "idle");
    run("side", false, 1, 0, RIGHT, "run right");
    hold("side", true, holdMs, "idle");
    run("side", true, -1, 0, LEFT, "run left");
    hold(viewFor("back"), false, holdMs, "idle");
    run("back", false, 0, -1, UP, `run up (${has("back") ? "back" : "side"} view)`);
    hold(viewFor("front"), false, holdMs, "idle");
    run("front", false, 0, 1, DOWN, `run down (${has("front") ? "front" : "side"} view)`);
    hold("side", false, END_IDLE_MS, "idle");
    const ms = beats.reduce((s, b) => s + b.ms, 0);
    if (ms < 8_000 || ms > 15_000) warnings.push(`${(ms / 1000).toFixed(1)} s long (aimed for about 10)`);

    // The GIF's frames: each beat, cut where a mark on the floor turns to its next frame or goes (no piece under MIN_FRAME_MS).
    const cuts = [...new Set(drops.flatMap((d) => ends.map((e) => d.t0 + e)))].sort((a, b) => a - b);
    const pieces: { b: Beat; t: number; ms: number }[] = [];
    for (const b of beats) {
      let t = b.t;
      for (const c of cuts) if (c - t >= MIN_FRAME_MS && b.t + b.ms - c >= MIN_FRAME_MS) (pieces.push({ b, t, ms: c - t }), (t = c));
      pieces.push({ b, t, ms: b.t + b.ms - t });
    }
    /** Each mark on the floor at a moment, with the frame it's on. */
    const onFloor = (t: number) =>
      drops.flatMap((d) => {
        const f = ends.findIndex((e) => t - d.t0 < e);
        return t >= d.t0 && f >= 0 ? [{ d, f }] : [];
      });

    // The pictures the beats and marks use, the caption strips, then every frame.
    const pictures = new Map<string, { img: Buffer; flipped: Buffer }>();
    for (const b of beats) {
      if (pictures.has(b.key)) continue;
      const [view, anim, f] = b.key.split(":") as [View, "idle" | "move", string];
      const img = (await ride.sprite(CELL, { view, anim, f: Number(f) }, color)).data;
      pictures.set(b.key, { img, flipped: mirrorX(img, CELL.cw, CELL.ch) });
    }
    const markKey = (d: Drop, f: number) => (info.trail ? `${d.view}:${f}:${d.n}` : `drop:${f}`);
    const marks = new Map<string, { img: Buffer; flipped: Buffer }>();
    for (const p of pieces)
      for (const { d, f } of onFloor(p.t)) {
        const key = markKey(d, f);
        if (marks.has(key)) continue;
        const drop: Droplet | undefined = info.trail ? undefined : { a: (f + 0.5) / DROP_FRAMES, sq: SQ_UNITS, size: TOWN_FEEL.trailSize, alpha: TOWN_FEEL.trailAlpha };
        const img = (await ride.mark(MARK_CELL, d.view, f, d.n, color, drop)).data;
        marks.set(key, { img, flipped: mirrorX(img, MARK_CELL.cw, MARK_CELL.ch) });
      }
    const label = `${widthSq.toFixed(2)} squares (${widthUnits} units)`;
    const captions = new Map<string, Buffer>();
    for (const b of beats) {
      if (captions.has(b.action)) continue;
      await ride.page.evaluate(([w, h, n, l, o, a]) => window.__RIDE.caption(w as number, h as number, n as string, l as string, o as boolean, a as string), [W * SHOW, CAPTION_H, info.name, label, widthUnits > TOO_WIDE_UNITS, b.action] as const);
      captions.set(b.action, (await shoot(ride.page, W * SHOW, CAPTION_H)).data);
    }
    const FW = W * SHOW;
    const FH = CAPTION_H + H * SHOW;
    const scene = Buffer.alloc(W * H * 4);
    const rgba = Buffer.alloc(FW * FH * 4);
    const stack = Buffer.alloc(FW * FH * 3 * pieces.length);
    const delays: number[] = [];
    for (let n = 0, target = 0, real = 0; n < pieces.length; n++) {
      const { b, t, ms: len } = pieces[n]!;
      floor.copy(scene);
      // On the floor, under everyone: the marks it has left.
      for (const { d, f } of onFloor(t)) {
        const m = marks.get(markKey(d, f))!;
        blit(scene, W, H, d.flip ? m.flipped : m.img, MARK_CELL.cw, MARK_CELL.ch, d.x - MARK_CELL.ax, d.y - MARK_CELL.ay);
      }
      const drawRide = () => {
        const pic = pictures.get(b.key)!;
        blit(scene, W, H, b.flip ? pic.flipped : pic.img, CELL.cw, CELL.ch, b.x - CELL.ax, b.y - CELL.ay);
      };
      const pawn = () => blit(scene, W, H, pawnImg.data, CELL.cw, CELL.ch, pawnX - CELL.ax, homeY - CELL.ay);
      if (b.y < homeY) (drawRide(), pawn());
      else (pawn(), drawRide());
      // 2x, nearest-neighbor, under the strip.
      for (let yy = 0; yy < H * SHOW; yy++)
        for (let xx = 0; xx < FW; xx++) {
          const s = (Math.floor(yy / SHOW) * W + Math.floor(xx / SHOW)) * 4;
          scene.copy(rgba, ((CAPTION_H + yy) * FW + xx) * 4, s, s + 4);
        }
      captions.get(b.action)!.copy(rgba, 0, 0, FW * CAPTION_H * 4);
      for (let i = 0, o = n * FW * FH * 3; i < FW * FH; i++, o += 3) {
        stack[o] = rgba[i * 4]!;
        stack[o + 1] = rgba[i * 4 + 1]!;
        stack[o + 2] = rgba[i * 4 + 2]!;
      }
      // (A GIF's delays are whole hundredths of a second, at least 2: each is rounded on the running total, so they don't drift.)
      target += len;
      const d = Math.max(MIN_FRAME_MS, Math.round(target / 10) * 10 - real);
      delays.push(d);
      real += d;
    }
    let bytes = Infinity;
    for (const colours of [256, 128, 64, 32]) {
      await sharp(stack, { raw: { width: FW, height: FH * pieces.length, channels: 3, pageHeight: FH } })
        .gif({ delay: delays, loop: 0, colours, dither: 0, effort: 10 })
        .toFile(gifPath);
      bytes = statSync(gifPath).size;
      if (bytes <= MAX_BYTES) break;
      warnings.push(`${(bytes / 1e6).toFixed(1)} MB with ${colours} colors; trying fewer`);
    }
    if (bytes > MAX_BYTES) warnings.push(`${(bytes / 1e6).toFixed(1)} MB: over 4 MB`);

    // The strip: a few of its frames stacked (the end of the run right, a moment into the stand after it as the marks
    // fade, the end of the run up and of the run down).
    if (stripPath) {
      const at = [runEnds[0]! - 1, runEnds[0]! + 300, runEnds[2]! - 1, runEnds[3]! - 1].map((t) => pieces.findIndex((p) => t >= p.t && t < p.t + p.ms)).filter((i) => i >= 0);
      const GAP = 6;
      const SH = at.length * FH + (at.length - 1) * GAP;
      const strip = Buffer.alloc(FW * SH * 3, 0x30);
      at.forEach((i, k) => stack.copy(strip, k * (FH + GAP) * FW * 3, i * FW * FH * 3, (i + 1) * FW * FH * 3));
      mkdirSync(dirname(stripPath), { recursive: true });
      await sharp(strip, { raw: { width: FW, height: SH, channels: 3 } }).png().toFile(stripPath);
    }
    return { id: info.id, widthSq, widthUnits, widest: widest.at, seconds: delays.reduce((s, d) => s + d, 0) / 1000, bytes, file: gifPath, trail: info.trail ? "mark" : "droplets", warnings };
  } finally {
    await ride.close();
  }
}

// ---------------- The trail check (run.ts --rider-trail) ----------------

/** The ride's frames are compared this much finer than the town's. */
const CHECK: Cell = { ...CELL, ss: 2 };
/** A trail mark is measured in a cell this big (town pixels, room for three times its largest box), this much finer. */
const MARK_MEASURE: Cell = { cw: 61, ch: 45, ax: 30, ay: 22, ss: 4 };
/** Colors the frames are compared in. */
const CHECK_COLORS = ["red", "cobalt"];
/** How far a drawn edge may be off its box (units), for its outline. */
const BOX_SLACK = 2;

interface Compare {
  /** Pixels that were drawn and now aren't (taken away into empty ground). */
  cleared: number;
  /** Pixels that changed next to what was taken away (what was under it, the edges that touched it). */
  near: number;
  /** Pixels that changed with nothing taken away nearby: the ride itself was changed. */
  changed: number;
  /** Pixels drawn now where nothing was. */
  added: number;
  /** The before, after and the difference, side by side (gray: unchanged; magenta: taken away; orange: changed next to it; red: changed or added). */
  pic: Img | null;
}

/** Two pictures of one frame (straight RGBA): what changed, by kind (see Compare). */
function compare(a: Img, b: Img): Compare {
  const { w, h } = a;
  const N = w * h;
  const pm = (img: Img, i: number, c: number) => (img.data[i * 4 + c]! * img.data[i * 4 + 3]!) / 255;
  // 0: same, 1: cleared, 2: changed, 3: added.
  const kind = new Uint8Array(N);
  let any = false;
  for (let i = 0; i < N; i++) {
    const aa = a.data[i * 4 + 3]!;
    const ba = b.data[i * 4 + 3]!;
    const diff = Math.max(Math.abs(aa - ba), Math.abs(pm(a, i, 0) - pm(b, i, 0)), Math.abs(pm(a, i, 1) - pm(b, i, 1)), Math.abs(pm(a, i, 2) - pm(b, i, 2)));
    if (diff <= 4) continue;
    any = true;
    kind[i] = aa > 8 && ba <= 8 ? 1 : aa <= 8 && ba > 24 ? 3 : 2;
  }
  if (!any) return { cleared: 0, near: 0, changed: 0, added: 0, pic: null };
  // Groups of changed pixels (touching within 2 px): a group with something taken away is the trail and what it covered.
  const group = new Int32Array(N).fill(-1);
  const hasCleared: boolean[] = [];
  for (let s = 0; s < N; s++) {
    if (!kind[s] || group[s]! >= 0) continue;
    const g = hasCleared.length;
    hasCleared.push(false);
    const todo = [s];
    group[s] = g;
    while (todo.length) {
      const i = todo.pop()!;
      if (kind[i] === 1) hasCleared[g] = true;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (kind[j] && group[j]! < 0) ((group[j] = g), todo.push(j));
        }
    }
  }
  const r = { cleared: 0, near: 0, changed: 0, added: 0 };
  const diffPic = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const k = kind[i]!;
    let c: readonly number[];
    if (k === 1) (r.cleared++, (c = [230, 40, 220]));
    else if (k === 3) (r.added++, (c = [255, 30, 30]));
    else if (k === 2 && hasCleared[group[i]!]) (r.near++, (c = [255, 150, 30]));
    else if (k === 2) (r.changed++, (c = [255, 30, 30]));
    else {
      const v = b.data[i * 4 + 3]! > 8 ? 150 : 70;
      c = [v, v, v];
    }
    diffPic[i * 4] = c[0]!;
    diffPic[i * 4 + 1] = c[1]!;
    diffPic[i * 4 + 2] = c[2]!;
    diffPic[i * 4 + 3] = 255;
  }
  // Before | after | the difference, each over a mid gray, cropped round what's drawn in either (twice the town's scale).
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let i = 0; i < N; i++)
    if (a.data[i * 4 + 3]! > 8 || b.data[i * 4 + 3]! > 8) {
      const x = i % w;
      const y = (i - x) / w;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  const M = 8;
  [x0, y0, x1, y1] = [Math.max(0, x0 - M), Math.max(0, y0 - M), Math.min(w - 1, x1 + M), Math.min(h - 1, y1 + M)];
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const GAP = 4;
  const pw = cw * 3 + GAP * 2;
  const pic = Buffer.alloc(pw * ch * 4, 0x20);
  [a.data, b.data, diffPic].forEach((img, k) => {
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        const s = ((y0 + y) * w + x0 + x) * 4;
        const d = (y * pw + k * (cw + GAP) + x) * 4;
        const al = img[s + 3]!;
        for (let c = 0; c < 3; c++) pic[d + c] = Math.round((img[s + c]! * al + 96 * (255 - al)) / 255);
        pic[d + 3] = 255;
      }
  });
  return { ...r, pic: { data: pic, w: pw, h: ch } };
}

/**
 * A ride before and after its trail mark was added (run.ts --rider-trail): whether only the left-behind trail was taken
 * out of its frames (every view, idle and move, two colors), its timing and travel are the same, and its trail mark is
 * there and within its limits. Writes `trail-check.png` (the frames that changed: before, after, the difference) to `outDir`.
 */
async function trailCheck(browser: Browser, before: string, after: string, outDir: string): Promise<object> {
  const problems: string[] = [];
  const a = await openRide(browser, before);
  let b: RidePage;
  try {
    b = await openRide(browser, after);
  } catch (e) {
    await a.close();
    return { ok: false, problems: [`the drawing doesn't render: ${e instanceof Error ? e.message : String(e)}`] };
  }
  try {
    // The timing and the travel: the same views, frame lengths and move dx.
    for (const v of ["side", "front", "back"] as const) {
      const was = a.info.views[v];
      const now = b.info.views[v];
      if (!was && now) problems.push(`it gained a ${v} view: a trail run adds only the trail mark`);
      else if (was && !now) problems.push(`its ${v} view is gone`);
      else if (was && now)
        for (const k of ["idleMs", "moveMs", "moveDx"] as const)
          if (JSON.stringify(was[k]) !== JSON.stringify(now[k])) problems.push(`the ${v} view's ${k === "moveDx" ? "move's dx" : k === "idleMs" ? "idle.ms" : "move.ms"} changed ([${was[k].join(", ")}] to [${now[k].join(", ")}]): keep its timing and travel`);
    }

    // The trail mark: there, its numbers sane, within its limits, and inside its box on every frame.
    const t = b.info.trail;
    const trail: Record<string, unknown> = {};
    if (!t) problems.push("it has no trail mark yet (the RiderDraft's `trail`)");
    else {
      if (!Array.isArray(t.ms) || !t.ms.length || t.ms.some((m) => !(m > 0))) problems.push(`trail.ms must be one or more frame lengths in ms, each above 0 (it is ${JSON.stringify(t.ms)})`);
      const max = b.info.trailMax;
      if (!(t.w > 0 && t.h > 0) || t.w > max.w || t.h > max.h) problems.push(`trail.w and trail.h must be above 0 and at most ${max.w} and ${max.h} (they are ${t.w} and ${t.h})`);
      if (!(Number.isInteger(t.every) && t.every >= 1)) problems.push(`trail.every must be a whole number of squares, 1 or more (it is ${t.every})`);
      Object.assign(trail, { frames: t.ms?.length ?? 0, lifeMs: (t.ms ?? []).reduce((s, m) => s + m, 0), every: t.every, w: t.w, h: t.h });
      if (!problems.length) {
        let reach = { x: 0, y: 0 };
        const out: string[] = [];
        for (const v of ["side", "back", "front"] as const)
          for (let f = 0; f < t.ms.length; f++)
            for (const n of [0, 1]) {
              const box = drawnBox(await b.mark(MARK_MEASURE, v, f, n, "red"));
              if (!box) {
                if (f === 0) out.push(`its ${v} mark ${n} draws nothing on frame 0`);
                continue;
              }
              const k = TOWN_SCALE * MARK_MEASURE.ss;
              const x0 = (box.x0 - MARK_MEASURE.ax * MARK_MEASURE.ss) / k;
              const x1 = (box.x1 + 1 - MARK_MEASURE.ax * MARK_MEASURE.ss) / k;
              const y0 = (box.y0 - MARK_MEASURE.ay * MARK_MEASURE.ss) / k;
              const y1 = (box.y1 + 1 - MARK_MEASURE.ay * MARK_MEASURE.ss) / k;
              reach = { x: Math.max(reach.x, -x0, x1), y: Math.max(reach.y, -y0, y1) };
              if (-x0 > t.w / 2 + BOX_SLACK || x1 > t.w / 2 + BOX_SLACK || -y0 > t.h / 2 + BOX_SLACK || y1 > t.h / 2 + BOX_SLACK)
                out.push(`its ${v} mark ${n}, frame ${f}, reaches x ${x0.toFixed(0)} to ${x1.toFixed(0)}, y ${y0.toFixed(0)} to ${y1.toFixed(0)}: past its box (±${t.w / 2}, ±${t.h / 2})`);
            }
        problems.push(...out.slice(0, 6));
        trail.drawn = `${(reach.x * 2).toFixed(0)} x ${(reach.y * 2).toFixed(0)} units at most`;
      }
    }

    // The frames: only taken away from, never changed or added to.
    const changedFrames: { at: string; cleared: number; bad: number; pic: Img }[] = [];
    const added: string[] = [];
    const changed: string[] = [];
    let most = 0;
    let compared = 0;
    for (const f of a.frames()) {
      if (!b.has(f.view)) continue;
      const nb = b.info.views[f.view]![f.anim === "idle" ? "idleMs" : "moveMs"].length;
      if (f.f >= nb) continue;
      for (const color of CHECK_COLORS) {
        const c = compare(await a.sprite(CHECK, f, color), await b.sprite(CHECK, f, color));
        compared++;
        if (!c.pic) continue;
        const at = `${f.view} ${f.anim} ${f.f} (${color})`;
        const bad = c.changed + c.added;
        if (c.added) added.push(at);
        if (c.changed) changed.push(at);
        most = Math.max(most, bad);
        if (color === CHECK_COLORS[0] || bad) changedFrames.push({ at, cleared: c.cleared + c.near, bad, pic: c.pic });
      }
    }
    const list = (xs: string[]) => `${xs.slice(0, 8).join(", ")}${xs.length > 8 ? ` and ${xs.length - 8} more` : ""}`;
    if (added.length) problems.push(`something is drawn where there was nothing in ${list(added)}: add nothing to the ride's frames`);
    if (changed.length) problems.push(`the ride itself changed where nothing was taken away in ${list(changed)} (up to ${most} px a frame): put the ride back as it was, and take out only what's left behind`);

    // The frames that changed: before | after | the difference, worst first, at most 8, under a key.
    let file: string | null = null;
    const shown = [...changedFrames].sort((x, y) => y.bad - x.bad).slice(0, 8);
    if (shown.length) {
      const LABEL = 18;
      const text = (str: string, width: number, red = false) =>
        Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${LABEL}"><rect width="100%" height="100%" fill="#14161b"/><text x="4" y="13" font-family="sans-serif" font-size="12" fill="${red ? "#ff5a4d" : "#d1d5db"}">${str.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></svg>`);
      const W = Math.max(640, ...shown.map((x) => x.pic.w));
      const layers: NonNullable<Parameters<ReturnType<typeof sharp>["composite"]>[0]> = [{ input: text("before | after | difference: magenta taken away, orange next to it, red changed", W), top: 0, left: 0 }];
      let top = LABEL;
      for (const x of shown) {
        layers.push({ input: text(`${x.at}: ${x.cleared} px taken away${x.bad ? `, ${x.bad} px changed or added` : ""}`, W, !!x.bad), top, left: 0 });
        layers.push({ input: x.pic.data, raw: { width: x.pic.w, height: x.pic.h, channels: 4 }, top: top + LABEL, left: 0 });
        top += LABEL + x.pic.h + 4;
      }
      mkdirSync(outDir, { recursive: true });
      file = join(outDir, "trail-check.png");
      await sharp({ create: { width: W, height: top, channels: 4, background: "#14161b" } }).composite(layers).png().toFile(file);
    }
    return {
      ok: !problems.length,
      problems: problems.slice(0, 20),
      compared,
      removed: changedFrames.filter((c) => !c.bad).map((c) => `${c.at}: ${c.cleared} px`),
      trail,
      file,
    };
  } finally {
    await a.close();
    await b.close();
  }
}

// ---------------- The command line ----------------

/** Rides under out/ with a rider drawing: out/<id>/<id>.tsx that exports a RiderDraft. */
function allRides(): string[] {
  return readdirSync(OUT)
    .filter((id) => existsSync(join(OUT, id, `${id}.tsx`)) && /\bRiderDraft\b/.test(readFileSync(join(OUT, id, `${id}.tsx`), "utf8")))
    .sort();
}

/** The container's Chromium, when this Playwright's own build isn't installed. */
const launch = () => chromium.launch(existsSync(chromium.executablePath()) ? {} : { executablePath: "/opt/pw-browsers/chromium", args: ["--headless", "--no-sandbox"] });

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    const v = args[i + 1];
    args.splice(i, v === undefined || v.startsWith("--") ? 1 : 2);
    return v === undefined || v.startsWith("--") ? "" : v;
  };
  const outArg = flag("--out");
  const stripArg = flag("--strip");
  if (args[0] === "--trail-check") {
    const [, before, after] = args;
    if (!before || !after || !existsSync(before) || !existsSync(after)) throw new Error("usage: npx tsx scripts/boss-art/ride-gif.ts --trail-check <before.tsx> <after.tsx> [--out <folder>]");
    const browser = await launch();
    try {
      console.log(JSON.stringify(await trailCheck(browser, resolve(before), resolve(after), resolve(outArg || dirname(after)))));
    } catch (e) {
      console.log(JSON.stringify({ ok: false, problems: [e instanceof Error ? e.message : String(e)] }));
    } finally {
      await browser.close();
    }
    return;
  }
  const all = args.includes("--all");
  if (all) args.splice(args.indexOf("--all"), 1);
  // (`--all` takes no id: its one positional, if any, is the color.)
  const [what, colorArg] = all ? [undefined, args[0]] : args;
  const color = colorArg ?? "red";
  if (!ITEM_COLORS.some((c) => c.id === color)) throw new Error(`no color "${color}"; the colors: ${ITEM_COLORS.map((c) => c.id).join(", ")}`);
  if (!all && !what) throw new Error("usage: npx tsx scripts/boss-art/ride-gif.ts <id | draft.tsx> [color] [--out <file or folder>] [--strip <png>]   or   --all [--out <folder>]");
  if (all && stripArg !== undefined) throw new Error("--strip is for one ride");
  const jobs = (all ? allRides().map((id) => ({ id, draft: join(OUT, id, `${id}.tsx`) })) : [what!].map((w) => (existsSync(w) && w.endsWith(".tsx") ? { id: basename(w, ".tsx"), draft: resolve(w) } : { id: w, draft: join(OUT, w, `${w}.tsx`) })));
  for (const j of jobs) if (!existsSync(j.draft)) throw new Error(`no drawing at ${j.draft}`);
  const browser = await launch();
  const failed: string[] = [];
  try {
    for (const j of jobs) {
      const inOut = dirname(j.draft) === join(OUT, j.id);
      if (!inOut && !outArg) throw new Error(`${j.draft} isn't under out/<id>/: give --out for its GIF`);
      const gif = inOut ? join(OUT, j.id, "preview", "ride.gif") : resolve(outArg!.endsWith(".gif") ? outArg! : join(outArg!, `${j.id}.gif`));
      mkdirSync(dirname(gif), { recursive: true });
      try {
        const m = await makeGif(browser, j.draft, color, gif, stripArg ? resolve(stripArg) : undefined);
        let copy = "";
        if (outArg && inOut) {
          const to = resolve(!all && outArg.endsWith(".gif") ? outArg : join(outArg, `${j.id}.gif`));
          mkdirSync(dirname(to), { recursive: true });
          copyFileSync(gif, to);
          copy = `, copy at ${to}`;
        }
        console.log(`${m.id}: ${m.widthSq.toFixed(2)} squares (${m.widthUnits} units)${m.widthUnits > TOO_WIDE_UNITS ? " WIDE (over 125 units)" : ""} (widest: ${m.widest}), ${m.seconds.toFixed(1)} s, ${(m.bytes / 1000).toFixed(0)} KB -> ${gif}${copy}`);
        if (m.trail === "droplets") console.log(`  note: ${m.id}: no trail mark yet, so it drops the town's droplets (add one with --rider-trail)`);
        for (const w of m.warnings) console.warn(`  warning: ${m.id}: ${w}`);
      } catch (e) {
        failed.push(j.id);
        console.error(`${j.id}: failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failed.length) process.exitCode = 1;
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
