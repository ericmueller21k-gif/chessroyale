/**
 * One GIF for a ride (Oct 31): the ride and its pawn running right 3 squares, left 3 (the side view mirrored), up 2 (the
 * back view), down 2 (the front view), then standing in its idle, on a patch of the town's floor at the town's scale,
 * with a plain pawn on foot beside it so the ride's size reads at a glance. A strip along the top names the ride and
 * gives its width in squares (red when wider than `TOO_WIDE`). Its own process, like item-render.ts, with no API key.
 *   npx tsx scripts/boss-art/ride-gif.ts <id | draft.tsx> [color] [--out <file or folder>]
 *   npx tsx scripts/boss-art/ride-gif.ts --all [--out <folder>]
 * The GIF is `scripts/boss-art/out/<id>/preview/ride.gif` (not committed), and a copy at `--out`.
 */
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ITEM_COLORS } from "@chessroyale/core";
import { newPt, newView, proj, setView } from "../../packages/app/src/town/camera.ts";
import { TOWN_FEEL } from "../../packages/app/src/town/feel.ts";
import type { Cell } from "./ride-gif-harness.tsx";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

// ---------------- The scale ----------------

/** Town size: pixels per unit of the pawn's 100-unit square (a pawn about 45 px; item-harness.tsx's town size). Shown 2x, nearest-neighbor. */
const TOWN_SCALE = 0.45;
const SHOW = 2;
/**
 * A town square in town pixels. The town draws your pawn's whole 100-unit square `youSquares` (1.45) squares across, so a
 * square is 100 / 1.45 = 69 units, not 100 (the ride briefs said "100 units is one square"; in the town it is 1.45).
 */
const SQ_W = Math.round((100 * TOWN_SCALE) / TOWN_FEEL.youSquares);
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
/** The widest a ride should be (squares, drawn pixels, all frames, all views). */
const TOO_WIDE = 1.25;
/** The floor (render.ts SQ_LIGHT, SQ_DARK) and its seams (groundColors: the square's color x 0.86). */
const SQ_LIGHT = [238, 197, 139] as const;
const SQ_DARK = [173, 128, 88] as const;
const SEAM = 0.86;

// ---------------- The film ----------------

/** The sequence: squares run each way, the whole GIF's aim, the idle at the end and the shortest and longest pause between runs (ms). */
const RIGHT = 3;
const LEFT = 3;
const UP = 2;
const DOWN = 2;
const AIM_MS = 11_000;
const END_IDLE_MS = 2_500;
const HOLD_MIN_MS = 350;
const HOLD_MAX_MS = 1_000;
const MIN_FRAME_MS = 20;
const MAX_BYTES = 4_000_000;
const CAPTION_H = 34;
/** A ride's pictures are drawn in a cell this big (town pixels) with the pawn's foot in the middle; measured 5x finer. */
const CELL: Cell = { cw: 220, ch: 170, ax: 110, ay: 140, ss: 1 };
const MEASURE: Cell = { ...CELL, ss: 5 };
/** Alpha above this counts as drawn when measuring. */
const DRAWN = 20;

type View = "side" | "front" | "back";
interface Info {
  id: string;
  name: string;
  views: Partial<Record<View, { idleMs: number[]; moveMs: number[]; moveDx: number[] }>>;
}
interface Beat {
  ms: number;
  key: string;
  flip: boolean;
  x: number;
  y: number;
  action: string;
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
  pawn(c: Cell): void;
  caption(w: number, h: number, name: string, width: string, over: boolean, action: string): void;
}
declare global {
  interface Window {
    __RIDE: Api;
  }
}

const color4 = (c: readonly number[], k = 1) => [Math.round(c[0]! * k), Math.round(c[1]! * k), Math.round(c[2]! * k)] as const;

/** Chromium's screenshot of the page's top left, as straight RGBA. */
async function shoot(page: import("playwright").Page, w: number, h: number): Promise<{ data: Buffer; w: number; h: number }> {
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** The box of the drawn pixels (alpha above DRAWN): min and max x and y, or null when nothing's drawn. */
function drawnBox(img: { data: Buffer; w: number; h: number }): { x0: number; x1: number; y0: number; y1: number } | null {
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

// ---------------- One ride ----------------

interface Made {
  id: string;
  widthSq: number;
  widest: string;
  seconds: number;
  bytes: number;
  file: string;
  warnings: string[];
}

async function makeGif(browser: Browser, draft: string, color: string, gifPath: string): Promise<Made> {
  const warnings: string[] = [];
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
    const sprite = (c: Cell, f: Frame) => page.evaluate(([cc, ff, col]) => window.__RIDE.sprite(cc as Cell, (ff as Frame).view, (ff as Frame).anim, (ff as Frame).f, col as string), [c, f, color] as const);
    const frames: Frame[] = [];
    for (const v of ["side", "front", "back"] as const)
      if (has(v))
        for (const anim of ["idle", "move"] as const) for (let f = 0; f < info.views[v]![anim === "idle" ? "idleMs" : "moveMs"].length; f++) frames.push({ view: v, anim, f });

    // Its width: the widest frame of any view, from the drawn pixels (5x finer than the town's, without the pose's dx).
    let widest = { units: 0, at: "" };
    let leftPx = 0;
    let risePx = 0;
    let belowPx = 0;
    let clipped = false;
    for (const f of frames) {
      await sprite(MEASURE, f);
      const img = await shoot(page, MEASURE.cw * MEASURE.ss, MEASURE.ch * MEASURE.ss);
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

    // The plain pawn's pictures (and its height).
    await page.evaluate((c) => window.__RIDE.pawn(c as Cell), CELL);
    const pawnImg = await shoot(page, CELL.cw, CELL.ch);
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

    // The sequence of beats: where the ride stands (the pawn's foot, in town pixels), which picture, for how long.
    const beats: Beat[] = [];
    let x = homeX;
    let y = homeY;
    const idleOf = (v: View) => info.views[v]!.idleMs;
    const moveTotal = (v: View) => info.views[v]!.moveMs.reduce((s, m) => s + Math.max(MIN_FRAME_MS, m), 0);
    const viewFor = (want: View): View => (has(want) ? want : "side");
    const steps = (v: View, n: number) => n * moveTotal(v);
    const total = steps(viewFor("side"), RIGHT + LEFT) + steps(viewFor("back"), UP) + steps(viewFor("front"), DOWN);
    const holdMs = Math.round(Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, (AIM_MS - total - END_IDLE_MS) / 4)));
    const hold = (v: View, flip: boolean, ms: number, action: string) => {
      const idle = idleOf(v);
      for (let left = ms, f = 0; left > 0; f++) {
        let len = Math.min(left, Math.max(MIN_FRAME_MS, idle[f % idle.length]!));
        if (left - len < MIN_FRAME_MS) len = left; // (no sliver of a frame at the end)
        beats.push({ ms: len, key: `${v}:idle:${f % idle.length}`, flip, x, y, action });
        left -= len;
      }
    };
    const run = (want: View, flip: boolean, dx: number, dy: number, n: number, action: string) => {
      const v = viewFor(want);
      const { moveMs, moveDx } = info.views[v]!;
      const T = moveTotal(v);
      for (let j = 0; j < n; j++)
        for (let k = 0, t = 0; k < moveMs.length; k++) {
          const ms = Math.max(MIN_FRAME_MS, moveMs[k]!);
          // The side view travels as it was drawn (dx 0 to 100 a square); the front and back views move in place and the town slides them along evenly.
          const p = v === "side" ? moveDx[k]! / 100 : (t + ms / 2) / T;
          beats.push({ ms, key: `${v}:move:${k}`, flip: v === "side" && flip, x: Math.round(x + dx * (j + p) * SQ_W), y: Math.round(y + dy * (j + p) * SQ_H), action });
          t += ms;
        }
      x += dx * n * SQ_W;
      y += dy * n * SQ_H;
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
    if (ms < 9_000 || ms > 15_000) warnings.push(`${(ms / 1000).toFixed(1)} s long (aimed for 10 to 14)`);

    // The pictures the beats use, the caption strips, then every frame.
    const pictures = new Map<string, { img: Buffer; flipped: Buffer }>();
    for (const b of beats) {
      if (pictures.has(b.key)) continue;
      const [view, anim, f] = b.key.split(":") as [View, "idle" | "move", string];
      await sprite(CELL, { view, anim, f: Number(f) });
      const img = (await shoot(page, CELL.cw, CELL.ch)).data;
      pictures.set(b.key, { img, flipped: mirrorX(img, CELL.cw, CELL.ch) });
    }
    const label = `${widthSq.toFixed(2)} squares wide`;
    const captions = new Map<string, Buffer>();
    for (const b of beats) {
      if (captions.has(b.action)) continue;
      await page.evaluate(([w, h, n, l, o, a]) => window.__RIDE.caption(w as number, h as number, n as string, l as string, o as boolean, a as string), [W * SHOW, CAPTION_H, info.name, label, widthSq > TOO_WIDE, b.action] as const);
      captions.set(b.action, (await shoot(page, W * SHOW, CAPTION_H)).data);
    }
    const FW = W * SHOW;
    const FH = CAPTION_H + H * SHOW;
    const scene = Buffer.alloc(W * H * 4);
    const rgba = Buffer.alloc(FW * FH * 4);
    const stack = Buffer.alloc(FW * FH * 3 * beats.length);
    const delays: number[] = [];
    for (let n = 0, at = 0; n < beats.length; n++) {
      const b = beats[n]!;
      floor.copy(scene);
      const ride = () => {
        const pic = pictures.get(b.key)!;
        blit(scene, W, H, b.flip ? pic.flipped : pic.img, CELL.cw, CELL.ch, b.x - CELL.ax, b.y - CELL.ay);
      };
      const pawn = () => blit(scene, W, H, pawnImg.data, CELL.cw, CELL.ch, pawnX - CELL.ax, homeY - CELL.ay);
      if (b.y < homeY) (ride(), pawn());
      else (pawn(), ride());
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
      // (A GIF's delays are whole hundredths of a second: rounded on the running total, so they don't drift.)
      delays.push(Math.max(MIN_FRAME_MS, (Math.round((at + b.ms) / 10) - Math.round(at / 10)) * 10));
      at += b.ms;
    }
    let bytes = Infinity;
    for (const colours of [256, 128, 64, 32]) {
      await sharp(stack, { raw: { width: FW, height: FH * beats.length, channels: 3, pageHeight: FH } })
        .gif({ delay: delays, loop: 0, colours, dither: 0, effort: 10 })
        .toFile(gifPath);
      bytes = statSync(gifPath).size;
      if (bytes <= MAX_BYTES) break;
      warnings.push(`${(bytes / 1e6).toFixed(1)} MB with ${colours} colors; trying fewer`);
    }
    if (bytes > MAX_BYTES) warnings.push(`${(bytes / 1e6).toFixed(1)} MB: over 4 MB`);
    return { id: info.id, widthSq, widest: widest.at, seconds: delays.reduce((s, d) => s + d, 0) / 1000, bytes, file: gifPath, warnings };
  } finally {
    await page.close();
  }
}

// ---------------- The command line ----------------

/** Rides under out/ with a rider drawing: out/<id>/<id>.tsx that exports a RiderDraft. */
function allRides(): string[] {
  return readdirSync(OUT)
    .filter((id) => existsSync(join(OUT, id, `${id}.tsx`)) && /\bRiderDraft\b/.test(readFileSync(join(OUT, id, `${id}.tsx`), "utf8")))
    .sort();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    const v = args[i + 1];
    args.splice(i, v === undefined || v.startsWith("--") ? 1 : 2);
    return v === undefined || v.startsWith("--") ? "" : v;
  };
  const all = args.includes("--all");
  if (all) args.splice(args.indexOf("--all"), 1);
  const outArg = flag("--out");
  // (`--all` takes no id: its one positional, if any, is the color.)
  const [what, colorArg] = all ? [undefined, args[0]] : args;
  const color = colorArg ?? "red";
  if (!ITEM_COLORS.some((c) => c.id === color)) throw new Error(`no color "${color}"; the colors: ${ITEM_COLORS.map((c) => c.id).join(", ")}`);
  if (!all && !what) throw new Error("usage: npx tsx scripts/boss-art/ride-gif.ts <id | draft.tsx> [color] [--out <file or folder>]   or   --all [--out <folder>]");
  const jobs = (all ? allRides().map((id) => ({ id, draft: join(OUT, id, `${id}.tsx`) })) : [what!].map((w) => (existsSync(w) && w.endsWith(".tsx") ? { id: basename(w, ".tsx"), draft: resolve(w) } : { id: w, draft: join(OUT, w, `${w}.tsx`) })));
  for (const j of jobs) if (!existsSync(j.draft)) throw new Error(`no drawing at ${j.draft}`);
  // (The container's Chromium, when this Playwright's own build isn't installed.)
  const browser = await chromium.launch(existsSync(chromium.executablePath()) ? {} : { executablePath: "/opt/pw-browsers/chromium", args: ["--headless", "--no-sandbox"] });
  const failed: string[] = [];
  try {
    for (const j of jobs) {
      const inOut = dirname(j.draft) === join(OUT, j.id);
      if (!inOut && !outArg) throw new Error(`${j.draft} isn't under out/<id>/: give --out for its GIF`);
      const gif = inOut ? join(OUT, j.id, "preview", "ride.gif") : resolve(outArg!.endsWith(".gif") ? outArg! : join(outArg!, `${j.id}.gif`));
      mkdirSync(dirname(gif), { recursive: true });
      try {
        const m = await makeGif(browser, j.draft, color, gif);
        let copy = "";
        if (outArg && inOut) {
          const to = resolve(!all && outArg.endsWith(".gif") ? outArg : join(outArg, `${j.id}.gif`));
          mkdirSync(dirname(to), { recursive: true });
          copyFileSync(gif, to);
          copy = `, copy at ${to}`;
        }
        console.log(`${m.id}: ${m.widthSq.toFixed(2)} squares wide${m.widthSq > TOO_WIDE ? " (WIDE)" : ""} (widest: ${m.widest}), ${m.seconds.toFixed(1)} s, ${(m.bytes / 1000).toFixed(0)} KB -> ${gif}${copy}`);
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
