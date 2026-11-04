// Mockup of Wrangler's battle intro (Nov 4) from the challenge camera (CHALLENGE_FEEL.cam.across: 0.75 squares west and 0.8
// south of the table's middle, zoom 1): his barn (out/house-shop-pig) laid out by SHOP_PIG_LAYOUT, his moves
// (out/boss-pig, BOSS_PIG_INTRO) at his town size (bossSquares x bossScale tall), your pawn, the props (out/house-intro-pig):
// the lasso thrown to the board's hay bale in the north-west corner, the bale dragged to the middle, two ropes thrown off
// screen and the buckets tumbling in, the brag and the wipe. The slab and board on the bale are stand-ins (the game's
// renderer draws the real ones); the ropes' lines are drawn as INTRO_PIG_ROPE_INK says.
//   npx tsx scripts/boss-art/intro-pig-view.ts <dir> <phone|computer> <t,t,...>
// One still per time (t<ms>.png).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { newPt, newView, proj, setView } from "../../packages/app/src/town/camera.ts";
import { TOWN_FEEL } from "../../packages/app/src/town/feel.ts";
import { renderFrame, type Character, type Frame } from "../../packages/app/src/characters/sprite.ts";
import { PIG } from "../../packages/app/src/characters/pig.ts";
import * as SHOP from "./out/house-shop-pig/house-shop-pig.ts";
import * as IN from "./out/house-intro-pig/house-intro-pig.ts";
import * as BP from "./out/boss-pig/boss-pig.ts";

const [dir = ".", device = "phone", timesArg = "1000"] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const HEAD = 52;
const [W, H] = device === "phone" ? [390, 844 - HEAD] : [1280, 720 - HEAD];
const SQ = 37;
const TABLE = { c: 9.5, r: 10.5 };
const camX = TABLE.c - 0.75, camY = TABLE.r + 0.8;
const v = newView();
setView(v, W, H, 0);
const pt = newPt();
const P = (c: number, r: number) => (proj(v, c - camX, camY - r, 0, pt) ? { ...pt } : null);

// ---- The timeline (ms): see out/intro-pig-nov4.md.
const T = {
  line: [0, 2500],
  spin: 2800,
  throw: 3800,
  fly: [3890, 4400],
  catch: 4400,
  yank: 4750,
  slide: [4850, 6450],
  land: 6450,
  free: 6650,
  cross: 7100,
  out: [7750, 8150],
  dyank: 8200,
  tumble: [8340, 9100],
  bland: 9100,
  brag: 9650,
  wipe: [11200, 11800],
};
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
const ramp = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const ease = (u: number) => u * u * (3 - 2 * u);

// ---- Pictures.
type Img = { w: number; h: number; data: string; foot: readonly [number, number] };
const imgs: Record<string, Img> = {};
function pic(ch: Character, anim: string, i: number): string {
  const key = `${ch.id}|${anim}|${i}`;
  if (!imgs[key]) {
    const r = renderFrame(ch, ch.anims[anim]!.frames[i]!);
    imgs[key] = { w: r.w, h: r.h, data: Buffer.from(r.data).toString("base64"), foot: ch.foot };
  }
  return key;
}

// ---- The room (static, the stand hidden: the intro's table stands in its place).
type Tile = { img: string; q: number[] };
const tiles: Tile[] = [];
type Up = { img: string; x: number; y: number; s: number; flip: boolean; depth: number; alpha?: number };
const room: Up[] = [];
for (const pl of SHOP.SHOP_PIG_LAYOUT) {
  const ch = SHOP.SHOP_PIG_PIECES[pl.name]!;
  if (/^(floor|circle)/.test(pl.name)) {
    const cs4 = [P(pl.col - 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row + 0.5), P(pl.col - 0.5, pl.row + 0.5)];
    if (cs4.some((c) => !c)) continue;
    tiles.push({ img: pic(ch, "idle", 0), q: cs4.flatMap((c) => [c!.x, c!.y]) });
    continue;
  }
  if (pl.name === "board-stand") continue;
  let fc = pl.col + ((pl.w ?? 1) - 1) / 2;
  let ox = 0, oy = 0;
  if (pl.name === "crate") {
    const cp = SHOP.SHOP_PIG_PIECES["counter"]!;
    ox = SHOP.SHOP_PIG_CRATE_AT[0] - cp.foot[0];
    oy = SHOP.SHOP_PIG_CRATE_AT[1] - cp.foot[1];
    fc = pl.col + 1.5;
  }
  const p = P(fc, pl.row);
  if (!p) continue;
  const s = p.k / SQ;
  room.push({ img: pic(ch, "idle", 0), x: p.x + ox * s, y: p.y + oy * s, s, flip: !!pl.flip, depth: p.depth - (pl.name === "crate" ? 0.01 : 0) });
}

// ---- Where things are.
const BOSS = { c: 7.2, r: 10.5 };
const YOU = { c: 11.6, r: 10.5 };
const BOSS_PX = PIG.h / (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale.pig ?? 1));
const STAND = { c: SHOP.SHOP_PIG_BOARD_AT.col, r: SHOP.SHOP_PIG_BOARD_AT.row };
const CTRL = { c: 5, r: 9 };
/** The bale's spot (squares) along its drag: a curve from the corner down the west side, swung east into the middle. */
function baleAt(t: number): { c: number; r: number } {
  const u = ease(ramp(t, T.slide[0]!, T.slide[1]!));
  const q = (a: number, b: number, c: number) => (1 - u) ** 2 * a + 2 * (1 - u) * u * b + u * u * c;
  return { c: q(STAND.c, CTRL.c, TABLE.c), r: q(STAND.r, CTRL.r, TABLE.r) };
}
const STOOL = { b: { c: TABLE.c - 1, r: TABLE.r }, w: { c: TABLE.c + 1, r: TABLE.r } };
const BUCKET_FROM = { b: { c: TABLE.c - 7, r: TABLE.r + 0.4 }, w: { c: TABLE.c + 7, r: TABLE.r + 0.4 } };
function bucketAt(side: "b" | "w", t: number): { c: number; r: number } {
  const u = ease(ramp(t, T.tumble[0]!, T.tumble[1]!));
  const a = BUCKET_FROM[side], b = STOOL[side];
  return { c: a.c + (b.c - a.c) * u, r: a.r + (b.r - a.r) * u };
}

function him(t: number): { anim: string; ms: number; ch: Character } {
  const B = BP.BOSS_PIG_INTRO;
  if (t < T.spin) return { ch: PIG, anim: "idle", ms: t };
  if (t < T.throw) return { ch: B, anim: "spin", ms: t - T.spin };
  if (t < T.yank) return { ch: B, anim: "throw", ms: t - T.throw };
  if (t < T.land) return { ch: B, anim: "yank", ms: t - T.yank };
  if (t < T.cross) return { ch: PIG, anim: "idle", ms: t - T.land };
  if (t < T.dyank) return { ch: B, anim: "crossThrow", ms: t - T.cross };
  if (t < T.brag) return { ch: B, anim: "doubleYank", ms: t - T.dyank };
  if (t < T.brag + lenOf(B, "brag")) return { ch: B, anim: "brag", ms: t - T.brag };
  return { ch: PIG, anim: "idle", ms: t };
}

type Line = { pts: number[]; w: number };
type Plan = { ups: Up[]; lines: Line[]; table: null | { x: number; y: number; s: number; lift: number }; bubble: null | { x: number; y: number }; pawn: { x: number; y: number; k: number; depth: number }; wipe: number };
function plan(t: number): Plan {
  const ups: Up[] = [...room];
  const lines: Line[] = [];
  // Him, and where his hands are on screen.
  const h = him(t);
  const hp = P(BOSS.c, BOSS.r)!;
  const hs = hp.k / BOSS_PX;
  const { i: hi } = frameAt(h.ch, h.anim, h.ms);
  ups.push({ img: pic(h.ch, h.anim, hi), x: hp.x, y: hp.y, s: hs, flip: false, depth: hp.depth });
  const hand = (n: 1 | 2) => {
    const g = (n === 1 ? BP.PIG_INTRO_HANDS : BP.PIG_INTRO_HANDS2)[h.anim]?.[hi];
    return g ? { x: hp.x + (g[0] - PIG.foot[0]) * hs, y: hp.y + (g[1] - PIG.foot[1]) * hs } : null;
  };
  const rs = (k: number) => k / SQ;
  // The bale (the table), the rope's loop on it.
  const b = baleAt(t);
  const bp = P(b.c, b.r)!;
  const tch = IN.INTRO_PIG_TABLE;
  let tanim = "idle", tms = t, lift = 0;
  if (t >= T.slide[0]! && t < T.land) {
    tanim = "slide";
    tms = t - T.slide[0]!;
    lift = IN.INTRO_PIG_TABLE_LIFT.slide![frameAt(tch, "slide", tms).i]!;
  } else if (t >= T.land && t < T.land + lenOf(tch, "land")) {
    tanim = "land";
    tms = t - T.land;
  }
  ups.push({ img: pic(tch, tanim, frameAt(tch, tanim, tms).i), x: bp.x, y: bp.y, s: rs(bp.k), flip: false, depth: bp.depth });
  const R = IN.INTRO_PIG_ROPE;
  const ropeAt = (anim: string, ms: number, x: number, y: number, s: number, depth: number) => {
    const { i } = frameAt(R, anim, ms);
    ups.push({ img: pic(R, anim, i), x, y, s, flip: false, depth: depth - 0.02 });
    const k = IN.INTRO_PIG_ROPE_KNOT[anim]![i]!;
    return { x: x + (k[0] - R.foot[0]) * s, y: y + (k[1] - R.foot[1]) * s };
  };
  // Rope 1: flying to the corner, catching, cinched through the drag, shaken free.
  const h1 = hand(1);
  if (t >= T.fly[0]! && t < T.catch && h1) {
    const u = ramp(t, T.fly[0]!, T.fly[1]!);
    const sp = P(STAND.c, STAND.r)!;
    const x = h1.x + (sp.x - h1.x) * u;
    const y = h1.y + (sp.y - 14 * rs(sp.k) - h1.y) * u - Math.sin(Math.PI * u) * 40;
    const kp = ropeAt("fly", t, x, y + 10 * rs(sp.k), rs(sp.k), sp.depth);
    lines.push({ pts: [h1.x, h1.y, (h1.x + kp.x) / 2, (h1.y + kp.y) / 2 + 10, kp.x, kp.y], w: rs(hp.k) });
  } else if (t >= T.catch && t < T.free + lenOf(R, "free") && h1) {
    const anim = t < T.yank ? "catch" : t < T.free ? "cinched" : "free";
    const ms = anim === "catch" ? t - T.catch : anim === "free" ? t - T.free : 0;
    const kp = ropeAt(anim, ms, bp.x, bp.y - lift * rs(bp.k), rs(bp.k), bp.depth);
    lines.push({ pts: [h1.x, h1.y, (h1.x + kp.x) / 2, (h1.y + kp.y) / 2 + (anim === "catch" ? 6 : 0), kp.x, kp.y], w: rs(hp.k) });
  }
  // The two ropes off screen each way, then the buckets tumbling in on them.
  for (const side of ["b", "w"] as const) {
    const hd = hand(side === "b" ? 2 : 1); // the rope going to our left is his left hand's (crossed), to our right his lasso arm's
    const ch = side === "b" ? IN.INTRO_PIG_BUCKET_B : IN.INTRO_PIG_BUCKET_W;
    if (t >= T.tumble[0]!) {
      const at = bucketAt(side, t);
      const p = P(at.c, at.r)!;
      const s = rs(p.k);
      let anim = "tumble", ms = t - T.tumble[0]!;
      if (t >= T.bland) (anim = t < T.bland + lenOf(ch, "land") ? "land" : "stool"), (ms = t - T.bland);
      const { i } = frameAt(ch, anim, ms);
      ups.push({ img: pic(ch, anim, i), x: p.x, y: p.y, s, flip: false, depth: p.depth });
      const g = IN.INTRO_PIG_BUCKET_HANDLE[`${side}:${anim}`]?.[i];
      if (g && hd && (anim === "tumble" || i < 2)) {
        const gx = p.x + (g[0] - ch.foot[0]) * s, gy = p.y + (g[1] - ch.foot[1]) * s;
        lines.push({ pts: [hd.x, hd.y, (hd.x + gx) / 2, (hd.y + gy) / 2 + 3, gx, gy], w: rs(hp.k) });
      }
    } else if (t >= T.out[0]! && hd) {
      const far = P(BUCKET_FROM[side].c, BUCKET_FROM[side].r)!;
      const u = ramp(t, T.out[0]!, T.out[1]!);
      const ex = hd.x + (far.x - hd.x) * u, ey = hd.y + (far.y - 20 - hd.y) * u - Math.sin(Math.PI * u) * 30;
      lines.push({ pts: [hd.x, hd.y, (hd.x + ex) / 2, (hd.y + ey) / 2 + 8, ex, ey], w: rs(hp.k) });
      if (u < 1) ropeAt("fly", t, ex, ey + 10 * rs(far.k), rs(far.k), far.depth);
    }
  }
  const yp = P(YOU.c, YOU.r)!;
  return {
    ups: ups.sort((a, b) => b.depth - a.depth),
    lines,
    table: { x: bp.x, y: bp.y, s: rs(bp.k), lift },
    bubble: t >= T.line[0]! && t < T.line[1]! ? { x: hp.x, y: hp.y - PIG.foot[1] * hs - 8 } : null,
    pawn: { x: yp.x, y: yp.y, k: yp.k, depth: yp.depth },
    wipe: ramp(t, T.wipe[0]!, T.wipe[1]!),
  };
}

const times = timesArg.split(",").map(Number);
const plans = times.map(plan);
for (const ch of [IN.INTRO_PIG_STORM, IN.INTRO_PIG_FRONT]) for (const t of times) pic(ch, "idle", frameAt(ch, "idle", t).i);
const stormAt = times.map((t) => [pic(IN.INTRO_PIG_STORM, "idle", frameAt(IN.INTRO_PIG_STORM, "idle", t).i), pic(IN.INTRO_PIG_FRONT, "idle", frameAt(IN.INTRO_PIG_FRONT, "idle", t).i)]);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H + HEAD }, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:#000"><canvas id=c></canvas></body></html>`);
await page.evaluate("window.__name = (f) => f");
await page.evaluate(
  ({ imgs, tiles, W, H, HEAD, ink, top }) => {
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
    w.draw = (pl: any, storm: string[]) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      // The header, as the game's room header.
      g.fillStyle = "#f3f1ec";
      g.fillRect(0, 0, W, HEAD);
      g.fillStyle = "#1f2530";
      g.font = "700 16px Arial";
      g.textAlign = "center";
      g.fillText("Wrangler's Barn", W / 2, HEAD / 2 + 6);
      g.save();
      g.translate(0, HEAD);
      g.beginPath();
      g.rect(0, 0, W, H);
      g.clip();
      // The barn's roof (mockup only): dark rafters.
      const sky = g.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#1e120b");
      sky.addColorStop(1, "#5a3a22");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "#140c07";
      g.lineWidth = 6;
      for (let i = -14; i <= 14; i++) {
        g.beginPath();
        g.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
        g.lineTo(W / 2 + i * W * 0.18, H * 0.45);
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
      const drawUp = (op: any) => {
        const near = Math.min(1, (op.depth - 2) / 1);
        if (near <= 0) return;
        const im = imgs[op.img]!;
        g.globalAlpha = near;
        const fx = op.flip ? im.w - 1 - im.foot[0] : im.foot[0];
        g.save();
        g.translate(op.x - fx * op.s, op.y - im.foot[1] * op.s);
        if (op.flip) g.translate(im.w * op.s, 0), g.scale(-1, 1);
        g.drawImage(canv[op.img]!, 0, 0, im.w * op.s, im.h * op.s);
        g.restore();
        g.globalAlpha = 1;
      };
      // The stand-in slab and board on the bale: drawn right after the table.
      const slab = (tb: any) => {
        const s = tb.s;
        const cx = tb.x, ty = tb.y - (top + tb.lift) * s;
        const half = 0.4 * 37 * s, deep = 0.22 * 37 * s, th = 3 * s;
        g.fillStyle = "#7a4b28";
        g.fillRect(cx - half, ty, 2 * half, th);
        g.fillStyle = "#c08a50";
        g.fillRect(cx - half, ty - deep, 2 * half, deep);
        const bh = 0.32 * 37 * s, bd = deep * 0.8;
        for (let j = 0; j < 8; j++)
          for (let i = 0; i < 8; i++) {
            g.fillStyle = (i + j) % 2 ? "#b5523a" : "#efd9a4";
            g.fillRect(cx - bh + (i * 2 * bh) / 8, ty - deep + (deep - bd) / 2 + (j * bd) / 8, (2 * bh) / 8 + 0.5, bd / 8 + 0.5);
          }
      };
      for (const op of pl.ups) {
        drawUp(op);
        if (op.img.startsWith("intro-pig-table")) slab(pl.table);
      }
      // The ropes' lines (INTRO_PIG_ROPE_INK): an outline, the cord, a twist tick every 3 art px.
      for (const ln of pl.lines) {
        const [ax, ay, bx, by, cx2, cy2] = ln.pts;
        const path = new Path2D();
        path.moveTo(ax, ay);
        path.quadraticCurveTo(bx, by, cx2, cy2);
        g.lineCap = "round";
        g.strokeStyle = ink.outline;
        g.lineWidth = (ink.width + 1.6) * ln.w;
        g.stroke(path);
        g.strokeStyle = ink.mid;
        g.lineWidth = ink.width * ln.w;
        g.stroke(path);
        g.setLineDash([ln.w, ink.twist * ln.w - ln.w]);
        g.strokeStyle = ink.dark;
        g.stroke(path);
        g.setLineDash([]);
      }
      // You.
      const p = pl.pawn;
      const size = 1.45 * p.k, u = size / 45;
      g.fillStyle = "rgba(13,14,18,0.3)";
      g.beginPath();
      g.ellipse(p.x, p.y, size * 0.32, size * 0.11, 0, 0, Math.PI * 2);
      g.fill();
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
        const txt = "Saddle up!";
        const tw = g.measureText(txt).width + 20;
        g.fillStyle = "#fff";
        g.strokeStyle = "#1f2530";
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(pl.bubble.x - tw / 2, pl.bubble.y - 34, tw, 28, 10);
        g.fill();
        g.stroke();
        g.fillStyle = "#1f2530";
        g.fillText(txt, pl.bubble.x, pl.bubble.y - 15);
      }
      // The wipe: the tile at 3x behind its front, sweeping in from the left.
      if (pl.wipe > 0) {
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
  { imgs, tiles, W, H, HEAD, ink: IN.INTRO_PIG_ROPE_INK, top: 27 },
);
for (const [n, t] of times.entries()) {
  await page.evaluate(({ pl, storm }) => (window as any).draw(pl, storm), { pl: plans[n], storm: stormAt[n]! });
  await page.locator("#c").screenshot({ path: `${dir}/t${t}.png` });
}
await browser.close();
console.log(`wrote ${times.length} stills to ${dir}`);
