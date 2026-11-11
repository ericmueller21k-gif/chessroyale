/**
 * Mockups of the zebras' bakery (Nov 10) through the town's own camera (town/camera.ts, the zoomed-in camera a home starts at), as
 * shop-view.ts drew the other homes: the front in the town, the front room (the shop) and the back room, with the zebras from
 * out/crew-zebra and out/boss-zebra in their places, your pawn, the lights. Not the game: the ceiling, the town ground round the bakery
 * and the computer's side panels are the mockup's own.
 *
 *   npx tsx scripts/boss-art/bakery-view.ts stills <out dir>     outside, front and back, phone (390 x 844) and computer (1440 x 900)
 *   npx tsx scripts/boss-art/bakery-view.ts gif <out.gif>        walking in, through the door, and the talk beat, on a phone
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium, type Page } from "playwright";
import { newPt, newView, proj, setView } from "../../packages/app/src/town/camera.ts";
import { TOWN_FEEL } from "../../packages/app/src/town/feel.ts";
import { renderFrame, type Character } from "../../packages/app/src/characters/sprite.ts";
import { png } from "./render.ts";
import * as Z from "./out/house-shop-zebra/house-shop-zebra.ts";
import { NPC_ZEBRA_CREW_C, NPC_ZEBRA_CREW_D, NPC_ZEBRA_CREW_E, NPC_ZEBRA_GUARD_A, NPC_ZEBRA_GUARD_B, ZEBRA_WATCH_FRAME } from "./out/crew-zebra/crew-zebra.ts";
import { BOSS_ZEBRA } from "./out/boss-zebra/boss-zebra.ts";
import { ARMS, FOOT, frame, H as ZH, PARTS, W as ZW, ZEBRA_PALETTE, type Look } from "./out/crew-zebra/zebra-rig.ts";

const SQ = 37;
const [cmd = "stills", out = "bakery-view"] = process.argv.slice(2);

/** The counter zebra: not drawn yet (a call for Eric). The mockup stands in the crew's rig in a paper cap and a white apron. */
const KEEPER_LOOK: Look = { id: "zck", hat: "paper", top: "apron", seed: 7 };
const KEEPER: Character = {
  id: "stand-in-keeper",
  name: "stand-in: the counter zebra",
  w: ZW,
  h: ZH,
  foot: FOOT,
  palette: ZEBRA_PALETTE,
  parts: PARTS,
  anims: {
    idle: {
      loop: true,
      frames: [
        frame(KEEPER_LOOK, 900, { armF: ARMS.fold, armN: ARMS.foldN, mouth: "smile" }),
        frame(KEEPER_LOOK, 140, { armF: ARMS.fold, armN: ARMS.foldN, mouth: "smile", eyes: "blink" }),
      ],
    },
  },
};

// ---- Pictures: every frame drawn once as a PNG (base64), keyed.

const IMGS: Record<string, { w: number; h: number; foot: readonly [number, number]; b64: string }> = {};
function pic(ch: Character, anim: string, i: number): string {
  const an = ch.anims[anim] ?? ch.anims.idle!;
  const fr = an.frames[((i % an.frames.length) + an.frames.length) % an.frames.length]!;
  const key = `${ch.id}:${anim}:${an.frames.indexOf(fr)}`;
  if (!IMGS[key]) {
    const r = renderFrame(ch, fr);
    IMGS[key] = { w: r.w, h: r.h, foot: ch.foot, b64: png({ w: r.w, h: r.h, data: r.data }).toString("base64") };
  }
  return key;
}
/** An animation's frame at `ms` into it (a one-shot holds its last frame). */
function frameAt(ch: Character, anim: string, ms: number): number {
  const an = ch.anims[anim] ?? ch.anims.idle!;
  const total = an.frames.reduce((a, f) => a + f.ms, 0);
  let t = an.loop ? ((ms % total) + total) % total : Math.min(ms, total - 1);
  for (let i = 0; i < an.frames.length; i++) {
    t -= an.frames[i]!.ms;
    if (t < 0) return i;
  }
  return an.frames.length - 1;
}

// ---- A scene: what stands where, in squares.

type Fig = { ch: Character; anim: string; ms: number; at: readonly [number, number]; flip?: boolean; tag?: [string, string]; bubble?: string; lift?: number };
type Room = { kind: "front" | "back"; layout: readonly Z.ShopPlace[]; n: number };
type Op =
  | { t: "tile"; key: string; q: number[] }
  | { t: "img"; key: string; x: number; y: number; s: number; flip: boolean; a: number; depth: number }
  | { t: "pawn"; x: number; y: number; k: number; depth: number }
  | { t: "tag"; x: number; y: number; text: string; bg: string }
  | { t: "bubble"; x: number; y: number; text: string }
  | { t: "glow"; x: number; y: number; r: number; color: string; a: number }
  | { t: "pool"; x: number; y: number; rx: number; ry: number; color: string; a: number }
  | { t: "sign"; x: number; y: number; w: number; h: number; text: string }
  | { t: "dim"; a: number };
interface Shot {
  W: number;
  H: number;
  ops: Op[];
  ceiling: "front" | "back" | "town";
  dim: number;
  fade: number;
}
const FRONT: Room = { kind: "front", layout: Z.SHOP_ZEBRA_LAYOUT, n: 20 };
const BACK: Room = { kind: "back", layout: Z.SHOP_ZEBRA_BACK_LAYOUT, n: Z.SHOP_ZEBRA_BACK_N };

function shoot(W: number, H: number, cam: readonly [number, number], room: Room | "town", ms: number, figs: Fig[], you: readonly [number, number] | null, fade = 0): Shot {
  const v = newView();
  setView(v, W, H, 0);
  const pt = newPt();
  const P = (c: number, r: number, lift = 0) => (proj(v, c - cam[0], cam[1] - r, lift, pt) ? { ...pt } : null);
  const floor: Op[] = [];
  const up: Op[] = [];
  const glows: Op[] = [];
  const ui: Op[] = [];
  const stand = (key: string, c: number, r: number, flip = false, depthBias = 0, lift = 0) => {
    const p = P(c, r);
    if (!p) return null;
    const s = p.k / SQ;
    const near = Math.min(1, Math.max(0, (p.depth - 2) / (3 - 2)));
    if (near <= 0) return null;
    up.push({ t: "img", key, x: p.x, y: p.y - lift * s, s, flip, a: near, depth: p.depth + depthBias });
    return { p, s };
  };
  if (room === "town") {
    // The town's ground round the bakery: cobbles on the plot and the street, grass beyond (the mockup's, not the game's tiles).
    for (let r = -8; r <= 12; r++)
      for (let c = -8; c <= 8; c++) {
        const cs4 = [P(c - 0.5, r - 0.5), P(c + 0.5, r - 0.5), P(c + 0.5, r + 0.5), P(c - 0.5, r + 0.5)];
        if (cs4.some((q) => !q)) continue;
        const key = Math.abs(c) <= 3 && r >= -1 && r <= 4 ? ((c + r) & 1 ? "town-cobble-b" : "town-cobble") : (c * 3 + r) % 4 ? "town-grass" : "town-grass-b";
        floor.push({ t: "tile", key, q: cs4.flatMap((q) => [q!.x, q!.y]) });
      }
    const ch = Z.HOUSE_ZEBRA;
    const at = stand(pic(ch, "idle", frameAt(ch, "idle", ms)), 0, 0);
    if (at) {
      // The sign's face: the game writes the home's name there (its sign font); the mockup writes Eric's first pick in plain capitals.
      const F = Z.HOUSE_ZEBRA_SIGN;
      const x0 = at.p.x - ch.foot[0] * at.s;
      const y0 = at.p.y - ch.foot[1] * at.s;
      up.push({ t: "sign", x: x0 + F.x * at.s, y: y0 + F.y * at.s, w: F.w * at.s, h: F.h * at.s, text: "ROLLING DOUGH", depth: at.p.depth - 0.001 } as Op & { depth: number });
    }
  } else {
    const pieces = Z.SHOP_ZEBRA_PIECES;
    for (const pl of room.layout) {
      const ch = pieces[pl.name]!;
      const key = pic(ch, "idle", frameAt(ch, "idle", ms + (pl.t0 ?? 0)));
      if (/^(floor|mat|rug|bfloor)/.test(pl.name)) {
        const cs4 = [P(pl.col - 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row + 0.5), P(pl.col - 0.5, pl.row + 0.5)];
        if (cs4.some((q) => !q)) continue;
        floor.push({ t: "tile", key, q: cs4.flatMap((q) => [q!.x, q!.y]) });
        continue;
      }
      const wsq = pl.w ?? 1;
      const fc = pl.col + (wsq - 1) / 2;
      const placed = stand(key, fc, pl.row, !!pl.flip);
      if (!placed) continue;
      // The crate on the counter, at its spot in the counter's pixels.
      if (pl.name === "counter") {
        const cr = pieces.crate!;
        const ck = pic(cr, "idle", frameAt(cr, "idle", ms));
        const s = placed.s;
        const cx = placed.p.x + (Z.SHOP_ZEBRA_CRATE_AT[0] - ch.foot[0]) * s;
        const cy = placed.p.y + (Z.SHOP_ZEBRA_CRATE_AT[1] - ch.foot[1]) * s;
        up.push({ t: "img", key: ck, x: cx, y: cy, s, flip: false, a: 1, depth: placed.p.depth - 0.01 });
      }
      // Lights keyed to this piece: halos and pools.
      const lights = room.kind === "front" ? Z.SHOP_ZEBRA_LIGHTS : Z.SHOP_ZEBRA_BACK_LIGHTS;
      const pools = room.kind === "front" ? Z.SHOP_ZEBRA_POOLS : Z.SHOP_ZEBRA_BACK_POOLS;
      const s = placed.s;
      const x0 = placed.p.x - ch.foot[0] * s;
      const y0 = placed.p.y - ch.foot[1] * s;
      for (const L of lights.filter((l) => l.piece === pl.name))
        glows.push({ t: "glow", x: x0 + (L.x + L.w / 2) * s, y: y0 + (L.y + L.h / 2) * s, r: (L.halo ?? Math.max(L.w, L.h)) * s * 1.6, color: L.color, a: L.strength * 0.55 });
      for (const L of pools.filter((l) => l.piece === pl.name))
        glows.push({ t: "pool", x: x0 + L.x * s, y: y0 + L.y * s, rx: L.rx * s, ry: L.ry * s, color: L.color, a: L.strength });
    }
  }
  for (const f of figs) {
    const key = pic(f.ch, f.anim, frameAt(f.ch, f.anim, f.ms));
    const st = stand(key, f.at[0], f.at[1], !!f.flip, -0.001, f.lift ?? 0);
    if (!st) continue;
    const top = st.p.y - (f.ch.foot[1] - 20) * st.s;
    if (f.tag) ui.push({ t: "tag", x: st.p.x, y: top, text: f.tag[0], bg: f.tag[1] });
    if (f.bubble) ui.push({ t: "bubble", x: st.p.x, y: top - 4, text: f.bubble });
  }
  if (you) {
    const p = P(you[0], you[1]);
    if (p) {
      up.push({ t: "pawn", x: p.x, y: p.y, k: p.k, depth: p.depth });
      ui.unshift({ t: "tag", x: p.x, y: p.y - 1.45 * p.k * 0.69 - 2, text: "You", bg: "rgba(255,215,106,0.96)" });
    }
  }
  up.sort((a, b) => (b as { depth: number }).depth - (a as { depth: number }).depth);
  const dim = room !== "town" && room.kind === "back" ? 0.36 : 0;
  return { W, H, ops: [...floor, ...up, ...(dim ? [{ t: "dim", a: dim } as Op] : []), ...glows.filter((g) => g.t === "pool"), ...glows.filter((g) => g.t === "glow"), ...ui], ceiling: room === "town" ? "town" : room.kind, dim, fade };
}

// ---- The page: draws a shot (or a computer frame round one).

const TOWN_TILES = (() => {
  const t = (seed: number, f: (x: number, y: number, h: number) => string) => {
    const data = new Uint8ClampedArray(SQ * SQ * 4);
    for (let y = 0; y < SQ; y++)
      for (let x = 0; x < SQ; x++) {
        const h = ((Math.imul(x * 73856093 ^ y * 19349663 ^ seed * 83492791, 2654435761) >>> 0) % 1000) / 1000;
        const c = f(x, y, h);
        data.set([parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255], (y * SQ + x) * 4);
      }
    return png({ w: SQ, h: SQ, data }).toString("base64");
  };
  const cob = (x: number, y: number, h: number) => ((x % 9 === 0 || y % 9 === 0) ? "#9a8f7e" : h < 0.1 ? "#b9ae9a" : "#c8bda8");
  const grass = (x: number, y: number, h: number) => (h < 0.12 ? "#5f9a45" : h > 0.92 ? "#8cc865" : "#77b155");
  return {
    "town-cobble": { w: SQ, h: SQ, foot: [18, 18] as const, b64: t(1, cob) },
    "town-cobble-b": { w: SQ, h: SQ, foot: [18, 18] as const, b64: t(2, cob) },
    "town-grass": { w: SQ, h: SQ, foot: [18, 18] as const, b64: t(3, grass) },
    "town-grass-b": { w: SQ, h: SQ, foot: [18, 18] as const, b64: t(4, grass) },
  };
})();
Object.assign(IMGS, TOWN_TILES);

async function openPage(W: number, H: number, dpr: number): Promise<Page> {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  await page.setContent(`<html><body style="margin:0;background:#000"><canvas id=c></canvas></body></html>`);
  await page.evaluate("window.__name = (f) => f");
  await page.evaluate(() => {
    (window as unknown as { IM: Record<string, HTMLImageElement> }).IM = {};
  });
  return page;
}
async function sendImgs(page: Page): Promise<void> {
  const fresh = Object.fromEntries(Object.entries(IMGS).filter(([, v]) => !(v as { sent?: boolean }).sent));
  for (const v of Object.values(fresh)) (v as { sent?: boolean }).sent = true;
  await page.evaluate(async (imgs) => {
    const IM = (window as unknown as { IM: Record<string, HTMLImageElement & { foot?: readonly number[] }> }).IM;
    await Promise.all(
      Object.entries(imgs).map(async ([k, v]) => {
        const im = new Image() as HTMLImageElement & { foot?: readonly number[] };
        im.src = "data:image/png;base64," + v.b64;
        await im.decode();
        im.foot = v.foot;
        IM[k] = im;
      }),
    );
  }, fresh);
}
/** Draws a shot; `frame` puts it in the computer's center column with the side menu and the right column (plain panels) round it. */
async function draw(page: Page, shot: Shot, frameW = 0, frameH = 0, frameX = 0): Promise<void> {
  await sendImgs(page);
  await page.evaluate(
    ({ shot, frameW, frameH, frameX }) => {
      const IM = (window as unknown as { IM: Record<string, HTMLImageElement & { foot: readonly number[] }> }).IM;
      const cv = document.getElementById("c") as HTMLCanvasElement;
      const DPR = window.devicePixelRatio;
      const FW = frameW || shot.W;
      const FH = frameH || shot.H;
      cv.width = FW * DPR;
      cv.height = FH * DPR;
      cv.style.width = FW + "px";
      cv.style.height = FH + "px";
      const g = cv.getContext("2d")!;
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.imageSmoothingEnabled = false;
      if (frameW) {
        // The computer's frame (mockup): the side menu on the left, the right column; the town fills the middle, top to bottom.
        g.fillStyle = "#101318";
        g.fillRect(0, 0, FW, FH);
        g.fillStyle = "#181c23";
        g.fillRect(0, 0, frameX, FH);
        g.fillRect(frameX + shot.W, 0, FW - frameX - shot.W, FH);
        g.fillStyle = "#2a303b";
        for (let i = 0; i < 9; i++) g.fillRect(24, 96 + i * 52, 150, 18);
        g.fillStyle = "#e7c35a";
        g.fillRect(24, 32, 120, 26);
        g.fillStyle = "#2a303b";
        for (let i = 0; i < 6; i++) g.fillRect(frameX + shot.W + 24, 96 + i * 70, FW - frameX - shot.W - 48, 48);
        g.save();
        g.translate(frameX, 0);
        g.beginPath();
        g.rect(0, 0, shot.W, shot.H);
        g.clip();
      }
      const W = shot.W;
      const H = shot.H;
      // The ceiling / sky (mockup only, not drawn art).
      const sky = g.createLinearGradient(0, 0, 0, H * 0.5);
      if (shot.ceiling === "town") {
        sky.addColorStop(0, "#6fb3e6");
        sky.addColorStop(1, "#cde8f6");
      } else if (shot.ceiling === "front") {
        sky.addColorStop(0, "#8a6f4c");
        sky.addColorStop(1, "#e6d1a6");
      } else {
        sky.addColorStop(0, "#0d0907");
        sky.addColorStop(1, "#3a2c1f");
      }
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      if (shot.ceiling !== "town") {
        // Beams running up to the ridge above the screen (pressed tin squares in the front, dark rafters in the back).
        g.strokeStyle = shot.ceiling === "front" ? "rgba(120,90,55,0.55)" : "rgba(0,0,0,0.55)";
        g.lineWidth = shot.ceiling === "front" ? 2 : 6;
        for (let i = -12; i <= 12; i++) {
          g.beginPath();
          g.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
          g.lineTo(W / 2 + i * W * 0.18, H * 0.45);
          g.stroke();
        }
        for (const y of [H * 0.06, H * 0.14, H * 0.24, H * 0.36]) {
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(W, y);
          g.stroke();
        }
      }
      const tri = (img: CanvasImageSource, s: number[][], d: number[][]) => {
        const [[x0, y0], [x1, y1], [x2, y2]] = d as [number[], number[], number[]];
        const [[u0, v0], [u1, v1], [u2, v2]] = s as [number[], number[], number[]];
        g.save();
        g.beginPath();
        const cx = (x0! + x1! + x2!) / 3;
        const cy = (y0! + y1! + y2!) / 3;
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
      const PAWN = new Path2D(
        "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z",
      );
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
      const bubble = (x: number, y: number, text: string) => {
        g.font = "800 14px Arial, sans-serif";
        const lines: string[] = [];
        let cur = "";
        for (const w of text.split(" ")) {
          if (g.measureText(cur + " " + w).width > 190 && cur) (lines.push(cur), (cur = w));
          else cur = cur ? cur + " " + w : w;
        }
        lines.push(cur);
        const bw = Math.max(...lines.map((l) => g.measureText(l).width)) + 20;
        const bh = lines.length * 18 + 12;
        const bx = Math.max(6, Math.min(W - bw - 6, x - bw / 2));
        const by = Math.max(6, y - bh - 12);
        g.fillStyle = "rgba(255,255,255,0.97)";
        g.strokeStyle = "#1f2530";
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(bx, by, bw, bh, 10);
        g.fill();
        g.stroke();
        g.beginPath();
        g.moveTo(Math.min(Math.max(x - 7, bx + 10), bx + bw - 24), by + bh - 1);
        g.lineTo(Math.min(Math.max(x, bx + 14), bx + bw - 14), by + bh + 9);
        g.lineTo(Math.min(Math.max(x + 7, bx + 24), bx + bw - 6), by + bh - 1);
        g.fill();
        g.fillStyle = "#1f2530";
        g.textAlign = "left";
        lines.forEach((l, i) => g.fillText(l, bx + 10, by + 20 + i * 18));
      };
      for (const op of shot.ops as any[]) {
        if (op.t === "tile") {
          const img = IM[op.key]!;
          const w = img.width;
          const src = [[0, 0], [w, 0], [w, w], [0, w]];
          const d = [0, 1, 2, 3].map((i) => [op.q[2 * i], op.q[2 * i + 1]]);
          tri(img, [src[0]!, src[1]!, src[2]!], [d[0]!, d[1]!, d[2]!]);
          tri(img, [src[0]!, src[2]!, src[3]!], [d[0]!, d[2]!, d[3]!]);
        } else if (op.t === "img") {
          const im = IM[op.key]!;
          g.globalAlpha = op.a;
          const fx = op.flip ? im.width - 1 - im.foot[0]! : im.foot[0]!;
          g.save();
          g.translate(op.x - fx * op.s, op.y - im.foot[1]! * op.s);
          if (op.flip) {
            g.translate(im.width * op.s, 0);
            g.scale(-1, 1);
          }
          g.drawImage(im, 0, 0, im.width * op.s, im.height * op.s);
          g.restore();
          g.globalAlpha = 1;
        } else if (op.t === "pawn") {
          const size = 1.45 * op.k;
          const u = size / 45;
          g.fillStyle = "rgba(13,14,18,0.3)";
          g.beginPath();
          g.ellipse(op.x, op.y, size * 0.32, size * 0.11, 0, 0, Math.PI * 2);
          g.fill();
          g.save();
          g.translate(op.x - 22.5 * u, op.y - 39.75 * u);
          g.scale(u, u);
          g.fillStyle = "#ffffff";
          g.strokeStyle = "#000";
          g.lineWidth = 1.5;
          g.fill(PAWN);
          g.stroke(PAWN);
          g.restore();
        } else if (op.t === "tag") tag(op.x, op.y, op.text, op.bg);
        else if (op.t === "bubble") bubble(op.x, op.y, op.text);
        else if (op.t === "sign") {
          g.fillStyle = "#5e3a20";
          g.font = `900 ${Math.round(op.h * 0.78)}px Arial Black, Arial, sans-serif`;
          g.textAlign = "center";
          g.fillText(op.text, op.x + op.w / 2, op.y + op.h * 0.82, op.w * 0.92);
        } else if (op.t === "pool" || op.t === "glow") {
          g.save();
          g.globalCompositeOperation = "lighter";
          if (op.t === "pool") {
            g.translate(op.x, op.y);
            g.scale(1, op.ry / op.rx);
          }
          const r = op.t === "pool" ? op.rx : op.r;
          const gr = g.createRadialGradient(op.t === "pool" ? 0 : op.x, op.t === "pool" ? 0 : op.y, 0, op.t === "pool" ? 0 : op.x, op.t === "pool" ? 0 : op.y, r);
          const hex = op.color;
          const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
          gr.addColorStop(0, `rgba(${rgb},${op.a * 0.6})`);
          gr.addColorStop(1, `rgba(${rgb},0)`);
          g.fillStyle = gr;
          g.beginPath();
          g.arc(op.t === "pool" ? 0 : op.x, op.t === "pool" ? 0 : op.y, r, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
        // (The back room is dim: a dark wash over the room; its lights add on top.)
        else if (op.t === "dim") {
          g.fillStyle = `rgba(10,8,18,${op.a})`;
          g.fillRect(0, 0, W, H);
        }
      }
      if (shot.fade) {
        g.fillStyle = `rgba(0,0,0,${shot.fade})`;
        g.fillRect(0, 0, W, H);
      }
      if (frameW) g.restore();
    },
    { shot, frameW, frameH, frameX },
  );
}

// ---- The people in each room.

const GUARDS = Z.SHOP_ZEBRA_GUARDS;
function frontFigs(ms: number, you: readonly [number, number] | null): Fig[] {
  const figs: Fig[] = [{ ch: KEEPER, anim: "idle", ms, at: Z.SHOP_ZEBRA_KEEPER.at, flip: true, tag: ["Shopkeeper", "rgba(47,127,224,0.95)"] }];
  for (const g of GUARDS) {
    const ch = g.id === "guard-a" ? NPC_ZEBRA_GUARD_A : NPC_ZEBRA_GUARD_B;
    const flip = g.face < 0;
    if (you) {
      // The guard's watch: the frame by where you are (your x minus his, as he faces).
      const dx = (you[0] - g.at[0]) * (flip ? -1 : 1) + (you[1] < g.at[1] - 1.5 ? -2 : 0);
      const an = ch.anims.watch!;
      const i = ZEBRA_WATCH_FRAME(dx);
      figs.push({ ch, anim: "watch", ms: an.frames.slice(0, i).reduce((a, f) => a + f.ms, 0), at: g.at, flip });
    } else figs.push({ ch, anim: "guard", ms: ms + (flip ? 700 : 0), at: g.at, flip });
  }
  return figs;
}
const CREW = [NPC_ZEBRA_CREW_C, NPC_ZEBRA_CREW_D, NPC_ZEBRA_CREW_E];
const SEATS = Z.SHOP_ZEBRA_BACK_SEATS;
/** The back room at rest: the chatter (the crew turned to the kingpin, mirrored; he faces them). */
function backFigs(ms: number, beat?: { crew: string; crewMs: number; crewFlip: boolean; boss: string; bossMs: number; bubble?: [number, string] }): Fig[] {
  const talk = ["sitArgue", "sitListen", "sitTalk"];
  const figs: Fig[] = CREW.map((ch, i) => ({
    ch,
    anim: beat ? beat.crew : talk[(i + Math.floor(ms / 2600)) % 3]!,
    ms: beat ? beat.crewMs : ms + i * 500,
    at: SEATS.crew[i]!.at,
    flip: beat ? beat.crewFlip : true,
    ...(beat?.bubble && beat.bubble[0] === i ? { bubble: beat.bubble[1] } : {}),
  }));
  figs.push({ ch: BOSS_ZEBRA, anim: beat ? beat.boss : Math.floor(ms / 2600) % 2 ? "sitScoff" : "sitTalk", ms: beat ? beat.bossMs : ms, at: SEATS.kingpin.at, ...(beat?.bubble && beat.bubble[0] === 9 ? { bubble: beat.bubble[1] } : {}) });
  return figs;
}

// ---- The cameras.

/** A room's camera follows you; the challenge's (CHALLENGE_FEEL.cam.across: south 0.8, west 0.75 of the table) frames the table. */
const CHALLENGE_CAM: readonly [number, number] = [Z.SHOP_ZEBRA_BACK_MARKS.table[0] - 0.75, Z.SHOP_ZEBRA_BACK_MARKS.table[1] + 0.8];

const PHONE = { W: 390, H: 844 };
const COMPUTER = { W: 1440, H: 900, boxX: 232, boxW: 1440 - 232 - 320 };

if (cmd === "stills") {
  mkdirSync(out, { recursive: true });
  const page = await openPage(COMPUTER.W, COMPUTER.H, 2);
  const shots: [string, (W: number, H: number) => Shot][] = [
    ["outside", (W, H) => shoot(W, H, [0, 2.2], "town", 1300, [], [0.4, 3.2])],
    ["front", (W, H) => shoot(W, H, [9.5, 15.5], FRONT, 400, frontFigs(400, [9.5, 15.5]), [9.5, 15.5])],
    ["front-counter", (W, H) => shoot(W, H, [11, 10], FRONT, 900, frontFigs(900, [11, 10]), [11, 10])],
    ["back", (W, H) => shoot(W, H, CHALLENGE_CAM, BACK, 1200, backFigs(1200), [8.45, 8.6])],
  ];
  for (const [name, mk] of shots) {
    const s = mk(PHONE.W, PHONE.H);
    await page.setViewportSize({ width: PHONE.W, height: PHONE.H });
    await draw(page, s);
    await page.locator("#c").screenshot({ path: `${out}/${name}-phone.png` });
    const c = mk(COMPUTER.boxW, COMPUTER.H);
    await page.setViewportSize({ width: COMPUTER.W, height: COMPUTER.H });
    await draw(page, c, COMPUTER.W, COMPUTER.H, COMPUTER.boxX);
    await page.locator("#c").screenshot({ path: `${out}/${name}-computer.png` });
    console.log(`wrote ${name}`);
  }
  await page.context().browser()!.close();
} else if (cmd === "gif") {
  // Walking in from the town, across the front room past the guards, through the door, round the table; then the talk beat.
  const STEP = 100; // ms a GIF frame
  const tmp = `${out}.frames`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const page = await openPage(PHONE.W, PHONE.H, 1);
  let n = 0;
  const snap = async (s: Shot) => {
    await draw(page, s);
    await page.locator("#c").screenshot({ path: `${tmp}/${String(n++).padStart(4, "0")}.png` });
  };
  const walk = (path: readonly (readonly [number, number])[], msPerSq: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const [a, b] = [path[i]!, path[i + 1]!];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.max(1, Math.round((d * msPerSq) / STEP));
      for (let j = 0; j < k; j++) pts.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
    }
    pts.push([...path.at(-1)!] as [number, number]);
    return pts;
  };
  let ms = 0;
  // 1. The town: up to the door.
  for (const p of walk([[0.6, 4.6], [0.2, 3.4], [0, 2.6]], 260)) await snap(shoot(PHONE.W, PHONE.H, [p[0] * 0.3, 2.2 + (p[1] - 2.6) * 0.5], "town", (ms += STEP), [], p));
  for (let i = 1; i <= 4; i++) await snap(shoot(PHONE.W, PHONE.H, [0, 2.2], "town", (ms += STEP), [], [0, 2.6], i / 4));
  // 2. The front room: in past the guards (they watch), across to the back door.
  const frontPath = walk([[9.5, 18], [9.5, 14.5], [7, 11], [6, 9], [3.5, 7.2], [3.5, 6.4]], 230);
  for (let i = 0; i < frontPath.length; i++) {
    const p = frontPath[i]!;
    const fade = i < 4 ? 1 - i / 4 : i >= frontPath.length - 4 ? (i - (frontPath.length - 4) + 1) / 4 : 0;
    await snap(shoot(PHONE.W, PHONE.H, p, FRONT, (ms += STEP), frontFigs(ms, p), p, fade));
  }
  // 3. The back room: in through the door, round to your end of the table, the camera settling on the challenge's framing.
  const backPath = walk([[3.5, 9.4], [3.5, 9], [8.45, 9], [8.45, 6.75]], 260);
  for (let i = 0; i < backPath.length; i++) {
    const p = backPath[i]!;
    const e = Math.min(1, i / (backPath.length - 1));
    const cam: [number, number] = [p[0] + (CHALLENGE_CAM[0] - p[0]) * e, p[1] + (CHALLENGE_CAM[1] - p[1]) * e];
    await snap(shoot(PHONE.W, PHONE.H, cam, BACK, (ms += STEP), backFigs(ms), p, i < 4 ? 1 - i / 4 : 0));
  }
  // 4. The talk beat: you're at his table. The crew stand up and draw (the crew's line), he waves them down (relax), they lower, his
  // challenge line.
  const YOU: [number, number] = [8.45, 6.75];
  const lines = { crew: "Hey! Who let HIM back here?!", relax: "Relax, relax. Put the bread down.", challenge: "So. You came to play, or to look?" };
  const beat = async (dur: number, f: (t: number) => Parameters<typeof backFigs>[1]) => {
    for (let t = 0; t < dur; t += STEP) await snap(shoot(PHONE.W, PHONE.H, CHALLENGE_CAM, BACK, (ms += STEP), backFigs(ms, f(t)), YOU));
  };
  const up = NPC_ZEBRA_CREW_C.anims.standUp!.frames.reduce((a, f) => a + f.ms, 0);
  const dr = NPC_ZEBRA_CREW_C.anims.draw!.frames.reduce((a, f) => a + f.ms, 0);
  const lw = NPC_ZEBRA_CREW_C.anims.lower!.frames.reduce((a, f) => a + f.ms, 0);
  await beat(800, (t) => ({ crew: "sitListen", crewMs: t, crewFlip: true, boss: "sitTalk", bossMs: t }));
  await beat(up, (t) => ({ crew: "standUp", crewMs: t, crewFlip: false, boss: "sitListen", bossMs: t }));
  await beat(dr, (t) => ({ crew: "draw", crewMs: t, crewFlip: false, boss: "sitListen", bossMs: t }));
  await beat(1800, (t) => ({ crew: "aim", crewMs: t, crewFlip: false, boss: "sitListen", bossMs: t, bubble: [1, lines.crew] }));
  const rl = BOSS_ZEBRA.anims.sitRelax!.frames.reduce((a, f) => a + f.ms, 0);
  await beat(Math.max(rl, 1800), (t) => ({ crew: "aim", crewMs: t + 1800, crewFlip: false, boss: "sitRelax", bossMs: t, bubble: [9, lines.relax] }));
  await beat(lw + 400, (t) => ({ crew: "lower", crewMs: t, crewFlip: false, boss: "sitTalk", bossMs: t }));
  await beat(2200, (t) => ({ crew: "lower", crewMs: lw + t, crewFlip: false, boss: "sitTalk", bossMs: t, bubble: [9, lines.challenge] }));
  await page.context().browser()!.close();
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(1000 / STEP), "-i", `${tmp}/%04d.png`, "-vf", "split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=none", "-loop", "0", out]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${out} (${n} frames)`);
}
