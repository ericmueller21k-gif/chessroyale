/**
 * A mockup of standing inside Babur's shop, through the town's own camera (town/camera.ts, zoomed in): the room's pieces
 * (out/house-shop-babur) laid out by SHOP_BABUR_LAYOUT, the floor tiles on the curved ground, each upright piece stood at
 * its foot at the town's scale (37 px a square), Stripes behind the counter and your pawn, drawn far to near.
 *
 *   npx tsx scripts/boss-art/shop-view.ts <out.png> [col] [row] [W] [H]
 */
import { chromium } from "playwright";
import { newPt, newView, proj, setView } from "../../packages/app/src/town/camera.ts";
import { TOWN_FEEL } from "../../packages/app/src/town/feel.ts";
import { SIDEKICK_SHEETS } from "../../packages/app/src/town/sidekick-sheets.ts";
import { renderFrame } from "../../packages/app/src/characters/sprite.ts";
// SHOP: which shop (babur, puddles, ...): its drawing out/house-shop-<shop>, its kid's sheet, where the kid stands.
const SHOP = process.env.SHOP ?? "babur";
const U = SHOP.toUpperCase();
const mod = (await import(`./out/house-shop-${SHOP}/house-shop-${SHOP}.ts`)) as Record<string, unknown>;
const SHOP_BABUR_LAYOUT = mod[`SHOP_${U}_LAYOUT`] as readonly { name: string; col: number; row: number; rot?: number; flip?: boolean; w?: number }[];
const SHOP_BABUR_PIECES = mod[`SHOP_${U}_PIECES`] as Record<string, import("../../packages/app/src/characters/sprite.ts").Character>;
const SHOP_BABUR_CRATE_AT = mod[`SHOP_${U}_CRATE_AT`] as readonly [number, number];
import { readFileSync } from "node:fs";

const [out = "shop-view.png", cs = "10", rs = "16", ws = "390", hs = "844", cam = "town"] = process.argv.slice(2);
/**
 * `close` (Eric, Nov 2: a second, much closer zoom inside the shop, "resembling normal 3rd person sizing", about 3x the
 * town's zoomed-in view): the camera comes down and in behind you and looks more ahead than down. Overrides for camTall.
 */
const CLOSE = { h: Number(process.env.CLOSE_H ?? 3.2), back: Number(process.env.CLOSE_BACK ?? 2.4), th: Number(process.env.CLOSE_TH ?? 24), cy: Number(process.env.CLOSE_CY ?? 0.3) };
if (cam === "close") Object.assign(TOWN_FEEL.camTall, CLOSE), Object.assign(TOWN_FEEL.camWide, CLOSE);
const PC = Number(cs), PR = Number(rs), W = Number(ws), H = Number(hs);
const DPR = 2;
const SQ = TOWN_FEEL.housePxPerSquare;

const v = newView();
setView(v, W, H, 0);
const pt = newPt();

// Each piece's first idle frame as RGBA.
const imgs: Record<string, { w: number; h: number; data: number[]; foot: readonly [number, number] }> = {};
for (const [name, ch] of Object.entries(SHOP_BABUR_PIECES)) {
  const fr = (ch.anims.idle ?? Object.values(ch.anims)[0]!).frames;
  // FRAME: which frame of each piece's idle (for an animated view: one picture per frame).
  const r = renderFrame(ch, fr[Number(process.env.FRAME ?? 0) % fr.length]!);
  imgs[name] = { w: r.w, h: r.h, data: Array.from(r.data), foot: ch.foot };
}

type Op =
  | { t: "tile"; img: string; rot: number; q: number[] }
  | { t: "img"; img: string; x: number; y: number; s: number; flip: boolean; depth: number }
  | { t: "pawn"; x: number; y: number; k: number; depth: number }
  | { t: "kid"; x: number; y: number; s: number; depth: number; tag: string };
const floor: Op[] = [];
const up: Op[] = [];

const P = (c: number, r: number, lift = 0) => (proj(v, c - PC, PR - r, lift, pt) ? { ...pt } : null);

for (const pl of SHOP_BABUR_LAYOUT) {
  const im = imgs[pl.name]!;
  const flat = pl.name.startsWith("floor") || pl.name.startsWith("ring");
  if (flat) {
    // Corners: north-west, north-east, south-east, south-west (north is up the picture).
    const cs4 = [P(pl.col - 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row + 0.5), P(pl.col - 0.5, pl.row + 0.5)];
    if (cs4.some((c) => !c)) continue;
    floor.push({ t: "tile", img: pl.name, rot: pl.rot ?? 0, q: cs4.flatMap((c) => [c!.x, c!.y]) });
    continue;
  }
  const wsq = pl.w ?? 1;
  let fc = pl.col + (wsq - 1) / 2;
  let fr = pl.row;
  let ox = 0, oy = 0;
  if (pl.name === "crate") {
    // On the counter, at SHOP_BABUR_CRATE_AT in the counter's pixels.
    const cp = imgs["counter"]!;
    ox = SHOP_BABUR_CRATE_AT[0] - cp.foot[0];
    oy = SHOP_BABUR_CRATE_AT[1] - cp.foot[1];
    fc = pl.col + 1.5;
  }
  const p = P(fc, fr);
  if (!p) continue;
  const s = p.k / SQ;
  up.push({ t: "img", img: pl.name, x: p.x + ox * s, y: p.y + oy * s, s, flip: !!pl.flip, depth: p.depth + (pl.name === "crate" ? -0.01 : 0) });
}
// Stripes behind the counter (row 2, middle), and you.
const sheet = SIDEKICK_SHEETS[SHOP as keyof typeof SIDEKICK_SHEETS];
// Beside the counter's east end, a little behind it (behind the counter itself the 58 px counter hides it).
const [kc, kr] = (process.env.KID ?? (SHOP === "babur" ? "12.6,2.6" : "9.5,2")).split(",").map(Number) as [number, number];
const kid = P(kc, kr)!;
const kidSquares = TOWN_FEEL.sidekickSquares / (sheet.foot[1] / sheet.h - sheet.top.idle / sheet.h);
up.push({ t: "kid", x: kid.x, y: kid.y, s: (kidSquares * kid.k) / sheet.h, depth: kid.depth, tag: "Shopkeeper" });
const me = P(PC, PR)!;
up.push({ t: "pawn", x: me.x, y: me.y, k: me.k, depth: me.depth });
up.sort((a, b) => (b as { depth: number }).depth - (a as { depth: number }).depth);

const kidPng = readFileSync("packages/app/src/town/sidekicks/babur.png").toString("base64");

const html = `<html><body style="margin:0;background:#000"><canvas id=c></canvas></body></html>`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
await page.setContent(html);
await page.evaluate("window.__name = (f) => f");
await page.evaluate(
  async ({ imgs, floor, up, W, H, DPR, kidPng, sheet }) => {
    const cv = document.getElementById("c") as HTMLCanvasElement;
    cv.width = W * DPR;
    cv.height = H * DPR;
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    const g = cv.getContext("2d")!;
    g.scale(DPR, DPR);
    g.imageSmoothingEnabled = false;
    // Above the walls: the tent's shaded canvas roof, dim toward the peak.
    const sky = g.createLinearGradient(0, 0, 0, H * 0.5);
    sky.addColorStop(0, "#2a0d10");
    sky.addColorStop(1, "#5a1a1e");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // The big top's ceiling (mockup only, not drawn art): dim red and cream canvas stripes running up to a peak above the screen.
    const peakX = W / 2, peakY = -H * 0.9;
    for (let i = -24; i <= 24; i++) {
      const x0 = W / 2 + i * W * 0.09, x1 = W / 2 + (i + 1) * W * 0.09;
      g.beginPath();
      g.moveTo(peakX, peakY);
      g.lineTo(x0, H * 0.45);
      g.lineTo(x1, H * 0.45);
      g.closePath();
      const st = g.createLinearGradient(0, 0, 0, H * 0.45);
      st.addColorStop(0, i & 1 ? "#1c0a0b" : "#2a1512");
      st.addColorStop(1, i & 1 ? "#6e1a20" : "#8a7a68");
      g.fillStyle = st;
      g.fill();
    }
    const canv: Record<string, HTMLCanvasElement> = {};
    for (const [n, im] of Object.entries(imgs)) {
      const c = document.createElement("canvas");
      c.width = im.w;
      c.height = im.h;
      c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(im.data), im.w, im.h), 0, 0);
      canv[n] = c;
    }
    // A floor tile: its picture (turned) mapped on the projected square as two triangles.
    const tri = (img: CanvasImageSource, s: number[][], d: number[][]) => {
      const [[x0, y0], [x1, y1], [x2, y2]] = d as [number[], number[], number[]];
      const [[u0, v0], [u1, v1], [u2, v2]] = s as [number[], number[], number[]];
      g.save();
      g.beginPath();
      // Pad a little outward so neighboring triangles leave no seam.
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
    for (const op of floor as { img: string; rot: number; q: number[] }[]) {
      const img = canv[op.img]!;
      const w = img.width;
      // Source corners NW, NE, SE, SW, turned `rot` quarter turns clockwise.
      const src = [[0, 0], [w, 0], [w, w], [0, w]];
      const s = [0, 1, 2, 3].map((i) => src[(i - op.rot + 4) % 4]!);
      const d = [0, 1, 2, 3].map((i) => [op.q[2 * i]!, op.q[2 * i + 1]!]);
      tri(img, [s[0]!, s[1]!, s[2]!], [d[0]!, d[1]!, d[2]!]);
      tri(img, [s[0]!, s[2]!, s[3]!], [d[0]!, d[2]!, d[3]!]);
    }
    const kidImg = new Image();
    kidImg.src = "data:image/png;base64," + kidPng;
    await kidImg.decode();
    const PAWN = new Path2D("m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z");
    const tag = (x: number, y: number, text: string, bg: string) => {
      g.font = "900 12px Arial Black, Arial, sans-serif";
      const tw = g.measureText(text).width + 14;
      g.fillStyle = bg;
      g.beginPath();
      g.roundRect(x - tw / 2, y - 22, tw, 18, 9);
      g.fill();
      g.fillStyle = "#1f2530";
      g.textAlign = "center";
      g.fillText(text, x, y - 9);
    };
    const shadow = (x: number, y: number, rx: number) => {
      g.fillStyle = "rgba(13,14,18,0.3)";
      g.beginPath();
      g.ellipse(x, y, rx, rx * 0.35, 0, 0, Math.PI * 2);
      g.fill();
    };
    for (const op of up as any[]) {
      if (op.t === "img") {
        const im = imgs[op.img]!;
        const fx = op.flip ? im.w - 1 - im.foot[0] : im.foot[0];
        g.save();
        g.translate(op.x - fx * op.s, op.y - im.foot[1] * op.s);
        if (op.flip) {
          g.translate(im.w * op.s, 0);
          g.scale(-1, 1);
        }
        g.drawImage(canv[op.img]!, 0, 0, im.w * op.s, im.h * op.s);
        g.restore();
      } else if (op.t === "kid") {
        shadow(op.x, op.y, sheet.w * op.s * 0.28);
        g.drawImage(kidImg, 0, 0, sheet.w, sheet.h, op.x - sheet.foot[0] * op.s, op.y - sheet.foot[1] * op.s, sheet.w * op.s, sheet.h * op.s);
        tag(op.x, op.y - (sheet.foot[1] - sheet.top.idle) * op.s - 2, op.tag, "rgba(47,127,224,0.95)");
      } else if (op.t === "pawn") {
        const size = 1.45 * op.k;
        const u = size / 45;
        shadow(op.x, op.y, size * 0.32);
        g.save();
        g.translate(op.x - 22.5 * u, op.y - 39.75 * u);
        g.scale(u, u);
        g.fillStyle = "#ffffff";
        g.strokeStyle = "#000";
        g.lineWidth = 1.5;
        g.fill(PAWN);
        g.stroke(PAWN);
        g.restore();
        tag(op.x, op.y - 31 * u, "You", "rgba(255,215,106,0.96)");
      }
    }
  },
  { imgs, floor, up, W, H, DPR, kidPng, sheet },
);
await page.locator("#c").screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);
