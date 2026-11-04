// Mockups of Ginger's igloo candy shop and his battle intro (Nov 5) from the challenge camera (CHALLENGE_FEEL.cam.across: 0.75
// squares west and 0.8 south of the table's middle, zoom 1): the room (out/house-shop-ginger) laid out by SHOP_GINGER_LAYOUT, him
// (GINGERBREAD, and his intro moves, out/boss-ginger BOSS_GINGER_INTRO) at his town size (bossSquares tall), your pawn, the elves
// (out/npc-ginger-elf, the shopkeeper) 1:1 at the room's scale on their loops, and the intro's props (out/house-intro-ginger): the
// blast, the falling ice shard, the crack, the ice table, the board the elves carry, the white light, the wipe. The table's slab
// top and the board on it are stand-ins (the game's renderer draws the real ones).
//   npx tsx scripts/boss-art/intro-ginger-view.ts <dir> <phone|computer> <t,t,...>
// One still per time (t<ms>.png); SHEET=<png> COLS=n puts them in one picture. SCENE=room: the room only (no intro), the elves on
// their loops at time t (the back-wall views). CHECK=1: print every resting figure's box on screen and flag any cut off.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { newPt, newView, proj, setView } from "../../packages/app/src/town/camera.ts";
import { TOWN_FEEL } from "../../packages/app/src/town/feel.ts";
import { renderFrame, type Character, type Frame } from "../../packages/app/src/characters/sprite.ts";
import { GINGERBREAD } from "../../packages/app/src/characters/gingerbread.ts";
import * as SHOP from "./out/house-shop-ginger/house-shop-ginger.ts";
import { elvesAt, introAt, restingFigures, type Fig } from "./ginger-place.ts";
import * as IN0 from "./out/house-intro-ginger/house-intro-ginger.ts";

const [dir = ".", device = "phone", timesArg = "0"] = process.argv.slice(2);
const SCENE = process.env.SCENE ?? "intro";
mkdirSync(dir, { recursive: true });
const HEAD = 52;
const [W, H] = device === "phone" ? [390, 844 - HEAD] : [1280, 720 - HEAD];
const SQ = 37;
const TABLE = { c: (SHOP.SHOP_GINGER_MARKS.boss[0] + SHOP.SHOP_GINGER_MARKS.you[0]) / 2, r: (SHOP.SHOP_GINGER_MARKS.boss[1] + SHOP.SHOP_GINGER_MARKS.you[1]) / 2 };
// Ginger's own framing (Nov 5): the challenge camera's 0.8 squares south, but centred on the table (west 0, not 0.75), so the
// centred battle spot and both staircases at the catwalk's ends are in view on the phone (IN.INTRO_GINGER_CAM).
const camX = TABLE.c - IN0.INTRO_GINGER_CAM.west, camY = TABLE.r + IN0.INTRO_GINGER_CAM.south;
const v = newView();
setView(v, W, H, 0);
const pt = newPt();
const P = (c: number, r: number) => (proj(v, c - camX, camY - r, 0, pt) ? { ...pt } : null);
const BOSS_PX = GINGERBREAD.h / (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale.gingerbread ?? 1));

const IN = await import("./out/house-intro-ginger/house-intro-ginger.ts");
const PAIR_T = process.env.PAIR_T ? Number(process.env.PAIR_T) : null;

// ---- Pictures.
type Img = { w: number; h: number; data: string; foot: readonly [number, number]; box: [number, number, number, number] };
const imgs: Record<string, Img> = {};
function pic(ch: Character, anim: string, i: number): string {
  const key = `${ch.id}|${anim}|${i}`;
  if (!imgs[key]) {
    const r = renderFrame(ch, ch.anims[anim]!.frames[i]!);
    // Its drawn box (opaque pixels), for the on-screen check.
    let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.data[(y * r.w + x) * 4 + 3]! > 40) ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)));
    imgs[key] = { w: r.w, h: r.h, data: Buffer.from(r.data).toString("base64"), foot: ch.foot, box: [x0, y0, x1, y1] };
  }
  return key;
}
const lenOf = (ch: Character, a: string) => ch.anims[a]!.frames.reduce((s, f) => s + f.ms, 0);
function frameAt(ch: Character, anim: string, ms: number): { f: Frame; i: number } {
  const a = ch.anims[anim]!;
  const total = lenOf(ch, anim);
  let s = ms >= total ? (a.loop ? ms % total : total - 1) : Math.max(0, ms);
  for (let i = 0; i < a.frames.length; i++) {
    if (s < a.frames[i]!.ms) return { f: a.frames[i]!, i };
    s -= a.frames[i]!.ms;
  }
  return { f: a.frames.at(-1)!, i: a.frames.length - 1 };
}

// ---- The room (static).
type Tile = { img: string; q: number[] };
const tiles: Tile[] = [];
type Up = { img: string; x: number; y: number; s: number; flip: boolean; depth: number; alpha?: number; slabHere?: boolean; shadow?: number; name?: string };
const room: Up[] = [];
const hide = new Set<string>(); // pieces the intro swaps (the stockroom door)
for (const pl of SHOP.SHOP_GINGER_LAYOUT) {
  const ch = SHOP.SHOP_GINGER_PIECES[pl.name]!;
  if (/^(floor|circle)/.test(pl.name)) {
    const cs4 = [P(pl.col - 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row + 0.5), P(pl.col - 0.5, pl.row + 0.5)];
    if (cs4.some((c) => !c)) continue;
    tiles.push({ img: pic(ch, "idle", 0), q: cs4.flatMap((c) => [c!.x, c!.y]) });
    continue;
  }
  if (hide.has(pl.name)) continue;
  // (The crate stands on the stand's top: at the stand's place, lifted to its top.)
  const isCrate = pl.name === "crate";
  const p = P(pl.col + (isCrate ? 0.5 : ((pl.w ?? 1) - 1) / 2), pl.row);
  if (!p) continue;
  const lift = isCrate ? SHOP.SHOP_GINGER_PIECES.counter!.foot[1] - SHOP.SHOP_GINGER_CRATE_AT[1] : 0;
  const dx = isCrate ? SHOP.SHOP_GINGER_CRATE_AT[0] - SHOP.SHOP_GINGER_PIECES.counter!.foot[0] : 0;
  room.push({ img: pic(ch, "idle", 0), x: p.x + dx * (p.k / SQ), y: p.y - lift * (p.k / SQ), s: p.k / SQ, flip: !!pl.flip, depth: p.depth - (isCrate ? 0.001 : 0), name: pl.name });
  pic(SHOP.SHOP_GINGER_PIECES["bay-door-open"]!, "idle", 0);
}

// ---- Figures: a figure at (c, r) lifted `lift` px (the catwalk, the stairs), drawn 1:1 at the room's scale (a boss: his size).
function figUp(f: Fig): Up {
  const p = P(f.at[0], f.at[1])!;
  const s = f.scale ? p.k / f.scale : p.k / SQ;
  const { i } = frameAt(f.ch, f.anim, f.ms);
  // (A figure up on the catwalk or the stairs is drawn just in front of the cards it's on and next to: a row nearer.)
  const depth = f.lift ? P(f.at[0], Math.floor(f.at[1] + 0.5) + 1.01)!.depth : p.depth - 0.002;
  return { img: pic(f.ch, f.anim, i), x: p.x, y: p.y - (f.lift ?? 0) * (p.k / SQ), s, flip: !!f.flip, depth, shadow: f.lift ? p.k / SQ : undefined };
}

type Decal = { img: string; q: number[] };
type Plan = { ups: Up[]; decals: Decal[]; bubble: null | { x: number; y: number; text: string }; pawn: { x: number; y: number; k: number }; wipe: number; slab: null | { x: number; y: number; s: number; top: number } };
function plan(t: number): Plan {
  const intro = SCENE === "intro" ? introAt(t) : null;
  const ups: Up[] = room.map((u) => (intro?.swap[u.name ?? ""] ? { ...u, img: pic(SHOP.SHOP_GINGER_PIECES[intro.swap[u.name!]!]!, "idle", 0) } : u));
  const figs: Fig[] = [...elvesAt(t, !!intro, PAIR_T ?? t)];
  let bubble: Plan["bubble"] = null;
  let wipe = 0;
  let slab: Plan["slab"] = null;
  const decals: Decal[] = [];
  if (intro) {
    figs.push(...intro.figs);
    ups.push(...intro.props.map((pr) => {
      const p = P(pr.at[0], pr.at[1])!;
      const { i } = frameAt(pr.ch, pr.anim, pr.ms);
      return { img: pic(pr.ch, pr.anim, i), x: p.x + (pr.dx ?? 0) * (p.k / SQ), y: p.y - (pr.lift ?? 0) * (p.k / SQ), s: p.k / SQ, flip: false, depth: p.depth + (pr.depthBias ?? 0), alpha: pr.alpha, slabHere: !!pr.slab };
    }));
    for (const d of intro.decals) {
      const { i } = frameAt(d.ch, d.anim, d.ms);
      const [c, r] = d.at;
      const cs4 = [P(c - d.w / 2, r - d.h / 2), P(c + d.w / 2, r - d.h / 2), P(c + d.w / 2, r + d.h / 2), P(c - d.w / 2, r + d.h / 2)];
      decals.push({ img: pic(d.ch, d.anim, i), q: cs4.flatMap((q) => [q!.x, q!.y]) });
    }
    if (intro.bubble) {
      const p = P(intro.bubble.at[0], intro.bubble.at[1])!;
      bubble = { x: p.x, y: p.y - intro.bubble.up * (p.k / SQ), text: intro.bubble.text };
    }
    wipe = intro.wipe;
    if (intro.slab) {
      const p = P(intro.slab[0], intro.slab[1])!;
      slab = { x: p.x, y: p.y, s: p.k / SQ, top: IN.INTRO_GINGER_TABLE_TOP };
    }
  } else {
    figs.push({ ch: GINGERBREAD, anim: "idle", ms: t, at: [SHOP.SHOP_GINGER_MARKS.boss[0], SHOP.SHOP_GINGER_MARKS.boss[1]], scale: BOSS_PX });
  }
  for (const f of figs) ups.push(figUp(f));
  const yp = P(SHOP.SHOP_GINGER_MARKS.you[0], SHOP.SHOP_GINGER_MARKS.you[1])!;
  return { ups: ups.sort((a, b) => b.depth - a.depth), decals, bubble, pawn: { x: yp.x, y: yp.y, k: yp.k }, wipe, slab };
}

if (process.env.CHECK) {
  // Every resting figure (each pause, stop and spot), its drawn box on screen: OK, or CUT (partly off the screen).
  for (const f of restingFigures()) {
    const u = figUp(f);
    const im = imgs[u.img]!;
    const fx = u.flip ? im.w - 1 - im.foot[0] : im.foot[0];
    const bx0 = u.flip ? im.w - 1 - im.box[2] : im.box[0];
    const bx1 = u.flip ? im.w - 1 - im.box[0] : im.box[2];
    const x0 = u.x + (bx0 - fx) * u.s, x1 = u.x + (bx1 - fx) * u.s;
    const y0 = u.y + (im.box[1] - im.foot[1]) * u.s, y1 = u.y + (im.box[3] - im.foot[1]) * u.s;
    const ok = x0 >= 0 && x1 <= W && y0 >= 0 && y1 <= H;
    const off = x1 < 0 || x0 > W || y1 < 0 || y0 > H;
    console.log(`${device} ${ok ? "OK  " : off ? "OUT " : "CUT "} ${f.label ?? f.ch.id} at ${f.at.map((n) => n.toFixed(2)).join(",")} lift ${f.lift ?? 0}: x ${x0.toFixed(0)}-${x1.toFixed(0)} y ${y0.toFixed(0)}-${y1.toFixed(0)}`);
  }
  process.exit(0);
}

const times = timesArg.split(",").map(Number);
const plans = times.map(plan);
const stormAt = times.map((t) => [pic(IN.INTRO_GINGER_STORM, "idle", frameAt(IN.INTRO_GINGER_STORM, "idle", t).i), pic(IN.INTRO_GINGER_FRONT, "idle", frameAt(IN.INTRO_GINGER_FRONT, "idle", t).i)]);
const boardInk = IN.INTRO_GINGER_TABLE_INK;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H + HEAD }, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:#000"><canvas id=c></canvas></body></html>`);
await page.evaluate("window.__name = (f) => f");
await page.evaluate(
  ({ imgs, tiles, W, H, HEAD, ink }) => {
    const w = window as any;
    const cv = document.getElementById("c") as HTMLCanvasElement;
    cv.width = W;
    cv.height = H + HEAD;
    const g = cv.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    const canv: Record<string, HTMLCanvasElement> = {};
    for (const [n, im] of Object.entries(imgs) as [string, any][]) {
      const c = document.createElement("canvas");
      c.width = im.w;
      c.height = im.h;
      const bin = atob(im.data);
      const arr = new Uint8ClampedArray(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      c.getContext("2d")!.putImageData(new ImageData(arr, im.w, im.h), 0, 0);
      canv[n] = c;
    }
    const tri = (img: CanvasImageSource, s: number[][], d: number[][]) => {
      const [[x0, y0], [x1, y1], [x2, y2]] = d as [number[], number[], number[]];
      const [[u0, v0], [u1, v1], [u2, v2]] = s as [number[], number[], number[]];
      g.save();
      g.beginPath();
      const cx = (x0! + x1! + x2!) / 3, cy = (y0! + y1! + y2!) / 3;
      const pad = (x: number, y: number) => [x + Math.sign(x - cx) * 0.6, y + Math.sign(y - cy) * 0.6] as const;
      g.moveTo(...pad(x0!, y0!));
      g.lineTo(...pad(x1!, y1!));
      g.lineTo(...pad(x2!, y2!));
      g.closePath();
      g.clip();
      const den = u0! * (v1! - v2!) + u1! * (v2! - v0!) + u2! * (v0! - v1!);
      const a = (x0! * (v1! - v2!) + x1! * (v2! - v0!) + x2! * (v0! - v1!)) / den;
      const b = (x0! * (u2! - u1!) + x1! * (u0! - u2!) + x2! * (u1! - u0!)) / den;
      const c = (x0! * (u1! * v2! - u2! * v1!) + x1! * (u2! * v0! - u0! * v2!) + x2! * (u0! * v1! - u1! * v0!)) / den;
      const d2 = (y0! * (v1! - v2!) + y1! * (v2! - v0!) + y2! * (v0! - v1!)) / den;
      const e = (y0! * (u2! - u1!) + y1! * (u0! - u2!) + y2! * (u1! - u0!)) / den;
      const f = (y0! * (u1! * v2! - u2! * v1!) + y1! * (u2! * v0! - u0! * v2!) + y2! * (u0! * v1! - u1! * v0!)) / den;
      g.transform(a, d2, b, e, c, f);
      g.drawImage(img, 0, 0);
      g.restore();
    };
    const PAWN = new Path2D("m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z");
    w.draw = (pl: any, storm: string[], title: string) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#f3f1ec";
      g.fillRect(0, 0, W, HEAD);
      g.fillStyle = "#1f2530";
      g.font = "700 16px Arial";
      g.textAlign = "center";
      g.fillText(title, W / 2, HEAD / 2 + 6);
      g.save();
      g.translate(0, HEAD);
      g.beginPath();
      g.rect(0, 0, W, H);
      g.clip();
      // The dome (mockup only, the game draws its roof): ice blocks in arching courses over a deep blue.
      const sky = g.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#3b5a82");
      sky.addColorStop(1, "#7fa2c8");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "#5b7fa8";
      g.lineWidth = 2;
      for (let i = 1; i < 12; i++) {
        g.beginPath();
        g.ellipse(W / 2, H * 0.62, W * (0.18 + i * 0.09), H * (0.18 + i * 0.07), 0, Math.PI, 2 * Math.PI);
        g.stroke();
      }
      for (const t of tiles as any[]) {
        const img = canv[t.img]!;
        const wd = img.width;
        const s = [[0, 0], [wd, 0], [wd, wd], [0, wd]];
        const d = [0, 1, 2, 3].map((i) => [t.q[2 * i], t.q[2 * i + 1]]);
        tri(img, [s[0]!, s[1]!, s[2]!], [d[0]!, d[1]!, d[2]!]);
        tri(img, [s[0]!, s[2]!, s[3]!], [d[0]!, d[2]!, d[3]!]);
      }
      for (const t of pl.decals as any[]) {
        const img = canv[t.img]!;
        const s = [[0, 0], [img.width, 0], [img.width, img.height], [0, img.height]];
        const d = [0, 1, 2, 3].map((i) => [t.q[2 * i], t.q[2 * i + 1]]);
        tri(img, [s[0]!, s[1]!, s[2]!], [d[0]!, d[1]!, d[2]!]);
        tri(img, [s[0]!, s[2]!, s[3]!], [d[0]!, d[2]!, d[3]!]);
      }
      const drawUp = (op: any) => {
        const near = Math.min(1, (op.depth - 2) / 1);
        if (near <= 0) return;
        const im = imgs[op.img]!;
        g.globalAlpha = near * (op.alpha ?? 1);
        if (op.shadow) {
          // A figure up on the catwalk or the stairs: its shadow on the planks under its feet.
          g.fillStyle = "rgba(20,12,4,0.45)";
          g.beginPath();
          g.ellipse(op.x, op.y, 8 * op.shadow, 2.2 * op.shadow, 0, 0, Math.PI * 2);
          g.fill();
        }
        const fx = op.flip ? im.w - 1 - im.foot[0] : im.foot[0];
        g.save();
        g.translate(op.x - fx * op.s, op.y - im.foot[1] * op.s);
        if (op.flip) g.translate(im.w * op.s, 0), g.scale(-1, 1);
        g.drawImage(canv[op.img]!, 0, 0, im.w * op.s, im.h * op.s);
        g.restore();
        g.globalAlpha = 1;
      };
      const slab = (sl: any) => {
        // The stand-in board on the ice table's slab (the renderer draws the real one at INTRO_GINGER_TABLE_TOP).
        const s = sl.s;
        const ty = sl.y - sl.top * s;
        const half = 30 * s, deep = 8 * s; // (the ice slab's top: 77 px across, 9 deep)
        for (let j = 0; j < 8; j++)
          for (let i = 0; i < 8; i++) {
            g.fillStyle = (i + j) % 2 ? ink.dark : ink.light;
            g.fillRect(sl.x - half + (i * 2 * half) / 8, ty - deep + (j * deep) / 8, (2 * half) / 8 + 0.5, deep / 8 + 0.5);
          }
      };
      for (const op of pl.ups) {
        drawUp(op);
        if (op.slabHere && pl.slab) slab(pl.slab);
      }
      // You (on your mark).
      const p = pl.pawn;
      const size = 1.45 * p.k, u = size / 45;
      g.save();
      g.translate(p.x - 22.5 * u, p.y - 39.75 * u);
      g.scale(u, u);
      g.fillStyle = "#fff";
      g.strokeStyle = "#000";
      g.lineWidth = 1.5;
      g.fill(PAWN);
      g.stroke(PAWN);
      g.restore();
      if (pl.bubble) {
        g.font = "700 15px Arial";
        const tw = g.measureText(pl.bubble.text).width + 20;
        const bx = Math.max(6, Math.min(W - tw - 6, pl.bubble.x - tw / 2));
        g.fillStyle = "#fff";
        g.strokeStyle = "#1f2530";
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(bx, pl.bubble.y - 34, tw, 28, 10);
        g.fill();
        g.stroke();
        g.fillStyle = "#1f2530";
        g.fillText(pl.bubble.text, bx + tw / 2, pl.bubble.y - 15);
      }
      if (pl.wipe > 0 && storm.length) {
        const z = 3;
        const edge = -48 * z + (W + 48 * z) * pl.wipe;
        g.save();
        g.beginPath();
        g.rect(0, 0, Math.max(0, edge), H);
        g.clip();
        for (let y = 0; y < H; y += 128 * z) for (let x = Math.floor((edge % (128 * z)) - 128 * z); x < edge; x += 128 * z) g.drawImage(canv[storm[0]!]!, x, y, 128 * z, 128 * z);
        g.restore();
        for (let y = 0; y < H; y += 128 * z) g.drawImage(canv[storm[1]!]!, edge, y, 48 * z, 128 * z);
      }
      g.restore();
    };
  },
  { imgs, tiles, W, H, HEAD, ink: boardInk },
);
const TITLE = "Ginger Igloo";
const SHEET = process.env.SHEET;
if (SHEET) {
  const cols = Number(process.env.COLS ?? times.length);
  const rows = Math.ceil(times.length / cols);
  await page.evaluate(({ W, H, HEAD, cols, rows }) => {
    const sh = document.createElement("canvas");
    sh.id = "sheet";
    sh.width = cols * (W + 8);
    sh.height = rows * (H + HEAD + 22);
    const g = sh.getContext("2d")!;
    g.fillStyle = "#14141a";
    g.fillRect(0, 0, sh.width, sh.height);
    document.body.appendChild(sh);
  }, { W, H, HEAD, cols, rows });
  for (const [n, t] of times.entries()) {
    await page.evaluate(({ pl, storm, n, t, W, H, HEAD, cols, title }) => {
      (window as any).draw(pl, storm, title);
      const sh = document.getElementById("sheet") as HTMLCanvasElement;
      const g = sh.getContext("2d")!;
      const x = (n % cols) * (W + 8);
      const y = Math.floor(n / cols) * (H + HEAD + 22);
      g.drawImage(document.getElementById("c") as HTMLCanvasElement, x, y + 20);
      g.fillStyle = "#fff";
      g.font = "700 14px Arial";
      g.fillText(`${(t / 1000).toFixed(1)} s`, x + 6, y + 15);
    }, { pl: plans[n], storm: stormAt[n]!, n, t, W, H, HEAD, cols, title: TITLE });
  }
  await page.setViewportSize({ width: Math.max(W, cols * (W + 8)), height: H + HEAD + Math.ceil(times.length / cols) * (H + HEAD + 22) });
  await page.locator("#sheet").screenshot({ path: SHEET });
} else
  for (const [n, t] of times.entries()) {
    await page.evaluate(({ pl, storm, title }) => (window as any).draw(pl, storm, title), { pl: plans[n], storm: stormAt[n]!, title: TITLE });
    await page.locator("#c").screenshot({ path: `${dir}/${SCENE === "room" ? "room-" : ""}t${t}.png` });
  }
await browser.close();
console.log(`wrote ${times.length} stills to ${dir}`);
