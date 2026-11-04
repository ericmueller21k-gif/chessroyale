// Mockup of Jefferson's battle intro (Nov 4) from the challenge camera (CHALLENGE_FEEL.cam.across: 0.75 squares west and 0.8
// south of the table's middle, zoom 1): his warehouse (out/house-shop-grex) laid out by SHOP_GREX_LAYOUT, him (GREX, and his
// moves, out/boss-grex BOSS_GREX_INTRO) at his town size (bossSquares tall), your pawn, the crew (out/npc-grex, the dealer)
// 1:1 at the room's scale walking from their places to their spots round the table, your floor lift and the crate-stack table
// (out/house-intro-grex), the wipe. The slab and board on the crates are stand-ins (the game's renderer draws the real ones).
//   npx tsx scripts/boss-art/intro-grex-view.ts <dir> <phone|computer> <t,t,...>
// One still per time (t<ms>.png). The timeline is out/intro-grex-nov4.md's.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { newPt, newView, proj, setView } from "../../packages/app/src/town/camera.ts";
import { TOWN_FEEL } from "../../packages/app/src/town/feel.ts";
import { renderFrame, type Character, type Frame } from "../../packages/app/src/characters/sprite.ts";
import { GREX } from "../../packages/app/src/characters/grex.ts";
import * as SHOP from "./out/house-shop-grex/house-shop-grex.ts";
import * as IN from "./out/house-intro-grex/house-intro-grex.ts";
import * as BG from "./out/boss-grex/boss-grex.ts";
import * as NPC from "./out/npc-grex/npc-grex.ts";
import { sidekickGrexDealer } from "./out/sidekick-grex-dealer/sidekick-grex-dealer.ts";

const [dir = ".", device = "phone", timesArg = "0"] = process.argv.slice(2);
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

// ---- The timeline (ms).
const T = {
  line: [0, 2500],
  call: 2600,
  stop: 3500, // the crew stop (machines park, the guys step off, the leaners push off the wall, the dozer wakes)
  walk: 3900, // they set off (plus each one's INTRO_GREX_CREW_SETOFF)
  wave: 3700,
  lift: 8300,
  creak: 9500,
  swing: [9700, 11000], // (the code's God King attack swing: his idle here)
  brag: 11000,
  wipe: [12500, 13100],
};
const SPEED = 3.2; // squares a second, walking
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

// ---- The room (static; the stand hidden: the intro's table stands in its place).
type Tile = { img: string; q: number[] };
const tiles: Tile[] = [];
type Up = { img: string; x: number; y: number; s: number; flip: boolean; depth: number; table?: boolean; sway?: number };
const room: Up[] = [];
for (const pl of SHOP.SHOP_GREX_LAYOUT) {
  const ch = SHOP.SHOP_GREX_PIECES[pl.name]!;
  if (/^(floor|circle)/.test(pl.name)) {
    const cs4 = [P(pl.col - 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row + 0.5), P(pl.col - 0.5, pl.row + 0.5)];
    if (cs4.some((c) => !c)) continue;
    tiles.push({ img: pic(ch, "idle", 0), q: cs4.flatMap((c) => [c!.x, c!.y]) });
    continue;
  }
  if (pl.name === "board-stand") continue;
  const p = P(pl.col + ((pl.w ?? 1) - 1) / 2, pl.row);
  if (!p) continue;
  room.push({ img: pic(ch, "idle", 0), x: p.x, y: p.y, s: p.k / SQ, flip: !!pl.flip, depth: p.depth });
}

// ---- Who's where.
type Sq = { c: number; r: number };
const BOSS = { c: SHOP.SHOP_GREX_MARKS.boss[0], r: SHOP.SHOP_GREX_MARKS.boss[1] };
const YOU = { c: SHOP.SHOP_GREX_MARKS.you[0], r: SHOP.SHOP_GREX_MARKS.you[1] };
const BOSS_PX = GREX.h / (TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale.grex ?? 1));
const sq = (a: readonly number[]): Sq => ({ c: a[0]!, r: a[1]! });
const K = SHOP.SHOP_GREX_KEEPER;
const CREW = SHOP.SHOP_GREX_CREW;
const SPOTS = IN.INTRO_GREX_CREW_SPOTS;
const stepOff = (m: Sq, d: readonly number[]): Sq => ({ c: m.c + d[0]! / SQ, r: m.r + d[1]! / SQ });
interface Member {
  key: keyof typeof SPOTS;
  ch: Character;
  home: Sq;
  homeAnim: string;
  homeFace: 1 | -1;
  /** Where he sets off from (beside his machine, or his own place), and the way round: waypoints to his spot. */
  from: Sq;
  via: Sq[];
  watch: string;
  /** Before he walks: his machine's step-off, or the dozer's wake, played from `stop`. */
  pre?: { ch: Character; anim: string };
  machine?: { ch: Character; at: Sq; anim: string };
}
const LIFT_AT = sq(CREW.lift.at);
const FORK_AT = sq(CREW.forklift.at);
const members: Member[] = [
  { key: "lift-guy", ch: NPC.NPC_GREX_LIFT_GUY, home: LIFT_AT, homeAnim: "", homeFace: 1, from: stepOff(LIFT_AT, NPC.NPC_GREX_STEP_OFF.lift), via: [{ c: 5.2, r: 7.6 }], watch: "watch", machine: { ch: NPC.NPC_GREX_LIFT, at: LIFT_AT, anim: "idle" } },
  { key: "fork-guy", ch: NPC.NPC_GREX_FORK_GUY, home: FORK_AT, homeAnim: "", homeFace: 1, from: stepOff(FORK_AT, NPC.NPC_GREX_STEP_OFF.forklift), via: [{ c: 13.4, r: 14 }, { c: 13.4, r: 10.6 }], watch: "watch", machine: { ch: NPC.NPC_GREX_FORKLIFT, at: FORK_AT, anim: "idle" } },
  { key: "leaner-a", ch: NPC.NPC_GREX_LEANER_A, home: sq(CREW["leaner-a"].at), homeAnim: "idle", homeFace: 1, from: sq(CREW["leaner-a"].at), via: [{ c: 4.6, r: 14 }, { c: 5.2, r: 10.5 }], watch: "watch" },
  { key: "leaner-b", ch: NPC.NPC_GREX_LEANER_B, home: sq(CREW["leaner-b"].at), homeAnim: "idle", homeFace: 1, from: sq(CREW["leaner-b"].at), via: [{ c: 4.8, r: 15 }, { c: 5.4, r: 12 }, { c: 6.2, r: 8.9 }, { c: 10.6, r: 7.9 }], watch: "watch" },
  { key: "crew-c", ch: NPC.NPC_GREX_CREW_C, home: sq(CREW["crew-c"].at), homeAnim: "idle", homeFace: 1, from: sq(CREW["crew-c"].at), via: [{ c: 9.5, r: 5.8 }], watch: "watch" },
  { key: "crew-d", ch: NPC.NPC_GREX_CREW_D, home: sq(CREW["crew-d"].at), homeAnim: "idle", homeFace: 1, from: sq(CREW["crew-d"].at), via: [{ c: 5.0, r: 13 }, { c: 6.0, r: 8.6 }], watch: "watch", pre: { ch: NPC.NPC_GREX_CREW_D, anim: "wake" } },
  { key: "dealer", ch: sidekickGrexDealer, home: sq(K.at), homeAnim: "idle", homeFace: -1, from: sq(K.at), via: [{ c: 12.5, r: 5.6 }], watch: "idle" },
];
const dist = (a: Sq, b: Sq) => Math.hypot(a.c - b.c, a.r - b.r);
/** Along his route at time ms after setting off: where, which way he faces, and whether he's arrived. */
function along(m: Member, ms: number): { at: Sq; face: 1 | -1; done: boolean } {
  const pts = [m.from, ...m.via, sq(SPOTS[m.key].at)];
  let d = (ms / 1000) * SPEED;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const L = dist(a, b);
    if (d <= L) {
      const u = d / L;
      return { at: { c: a.c + (b.c - a.c) * u, r: a.r + (b.r - a.r) * u }, face: b.c >= a.c ? 1 : -1, done: false };
    }
    d -= L;
  }
  return { at: pts.at(-1)!, face: SPOTS[m.key].face as 1 | -1, done: true };
}

type Plan = { ups: Up[]; bubble: null | { x: number; y: number }; pawn: { x: number; y: number; k: number; depth: number }; wipe: number; table: { x: number; y: number; s: number; sway: number } };
function plan(t: number): Plan {
  const ups: Up[] = [...room];
  const put = (ch: Character, anim: string, ms: number, at: Sq, flip: boolean, scale?: number) => {
    const p = P(at.c, at.r)!;
    const { i } = frameAt(ch, anim, ms);
    ups.push({ img: pic(ch, anim, i), x: p.x, y: p.y, s: scale ? p.k / scale : p.k / SQ, flip, depth: p.depth });
    return p;
  };
  // Him.
  const B = BG.BOSS_GREX_INTRO;
  let anim = "idle", ms = t, ch: Character = GREX;
  if (t >= T.call && t < T.call + lenOf(B, "call")) (ch = B), (anim = "call"), (ms = t - T.call);
  else if (t >= T.wave && t < T.wave + 2 * lenOf(B, "waveOver")) (ch = B), (anim = "waveOver"), (ms = t - T.wave);
  else if (t >= T.brag && t < T.brag + lenOf(B, "brag")) (ch = B), (anim = "brag"), (ms = t - T.brag);
  const hp = put(ch, anim, ms, BOSS, false, BOSS_PX);
  // The crew.
  for (const m of members) {
    const setoff = T.walk + IN.INTRO_GREX_CREW_SETOFF[m.key] + (m.pre ? lenOf(m.pre.ch, m.pre.anim) : 0);
    if (m.machine) {
      const mach = m.machine;
      const manim = t < T.stop ? mach.anim : t < T.stop + lenOf(mach.ch, "stepOff") ? "stepOff" : "parked";
      put(mach.ch, manim, manim === "stepOff" ? t - T.stop : t, mach.at, false);
      if (t < T.stop + lenOf(mach.ch, "stepOff")) continue;
    } else if (t < setoff) {
      const pre = m.pre && t >= T.stop ? m.pre : null;
      put(pre ? pre.ch : m.ch, pre ? pre.anim : m.homeAnim, pre ? t - T.stop : t, m.home, m.homeFace < 0);
      continue;
    }
    const go = along(m, t - Math.max(setoff, m.machine ? T.stop + lenOf(m.machine.ch, "stepOff") : 0));
    put(m.ch, go.done ? m.watch : "walk", t, go.at, go.face < 0);
  }
  // The table and your lift.
  const tp = P(TABLE.c, TABLE.r)!;
  const tch = IN.INTRO_GREX_TABLE;
  const creak = t >= T.creak && t < T.creak + lenOf(tch, "creak");
  const ta = creak ? "creak" : "idle";
  const ti = frameAt(tch, ta, creak ? t - T.creak : t).i;
  ups.push({ img: pic(tch, ta, ti), x: tp.x, y: tp.y, s: tp.k / SQ, flip: false, depth: tp.depth, table: true });
  const sway = IN.INTRO_GREX_TABLE_SWAY[ta]![ti]![0];
  const L = IN.INTRO_GREX_LIFT;
  const la = t < T.lift ? "flush" : t < T.lift + lenOf(L, "rise") ? "rise" : "up";
  const li = frameAt(L, la, t - T.lift).i;
  const yp = P(YOU.c, YOU.r)!;
  ups.push({ img: pic(L, la, li), x: yp.x, y: yp.y, s: yp.k / SQ, flip: false, depth: yp.depth + 0.001 });
  const h = IN.INTRO_GREX_LIFT_H[la]![li]!;
  return {
    ups: ups.sort((a, b) => b.depth - a.depth),
    bubble: t >= T.line[0]! && t < T.line[1]! ? { x: hp.x, y: hp.y - 100 * (hp.k / BOSS_PX) } : null,
    pawn: { x: yp.x, y: yp.y - h * (yp.k / SQ), k: yp.k, depth: yp.depth },
    wipe: ramp(t, T.wipe[0]!, T.wipe[1]!),
    table: { x: tp.x, y: tp.y, s: tp.k / SQ, sway },
  };
}

const times = timesArg.split(",").map(Number);
const plans = times.map(plan);
const stormAt = times.map((t) => [pic(IN.INTRO_GREX_STORM, "idle", frameAt(IN.INTRO_GREX_STORM, "idle", t).i), pic(IN.INTRO_GREX_FRONT, "idle", frameAt(IN.INTRO_GREX_FRONT, "idle", t).i)]);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H + HEAD }, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:#000"><canvas id=c></canvas></body></html>`);
await page.evaluate("window.__name = (f) => f");
await page.evaluate(
  ({ imgs, tiles, W, H, HEAD, top, line }) => {
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
      g.fillStyle = "#f3f1ec";
      g.fillRect(0, 0, W, HEAD);
      g.fillStyle = "#1f2530";
      g.font = "700 16px Arial";
      g.textAlign = "center";
      g.fillText("Jefferson's Fireworks", W / 2, HEAD / 2 + 6);
      g.save();
      g.translate(0, HEAD);
      g.beginPath();
      g.rect(0, 0, W, H);
      g.clip();
      // A warehouse roof (mockup only): dark steel trusses over the racks.
      const sky = g.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#101116");
      sky.addColorStop(1, "#2c2e36");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "#07080b";
      g.lineWidth = 4;
      for (let i = -14; i <= 14; i++) {
        g.beginPath();
        g.moveTo(W / 2 + i * W * 0.05, -H * 0.5);
        g.lineTo(W / 2 + i * W * 0.18, H * 0.45);
        g.stroke();
      }
      g.lineWidth = 3;
      for (const y of [H * 0.05, H * 0.13]) g.beginPath(), g.moveTo(0, y), g.lineTo(W, y), g.stroke();
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
      // The stand-in slab and board on the crates (the renderer draws the real ones, at INTRO_GREX_TABLE_TOP).
      const slab = (tb: any) => {
        const s = tb.s;
        const cx = tb.x + tb.sway * s, ty = tb.y - top * s;
        const half = 0.4 * 37 * s, deep = 0.22 * 37 * s, th = 3 * s;
        g.fillStyle = "#7a4b28";
        g.fillRect(cx - half, ty, 2 * half, th);
        g.fillStyle = "#c08a50";
        g.fillRect(cx - half, ty - deep, 2 * half, deep);
        const bh = 0.32 * 37 * s, bd = deep * 0.8;
        for (let j = 0; j < 8; j++)
          for (let i = 0; i < 8; i++) {
            g.fillStyle = (i + j) % 2 ? "#cc5a2c" : "#f4e4b8";
            g.fillRect(cx - bh + (i * 2 * bh) / 8, ty - deep + (deep - bd) / 2 + (j * bd) / 8, (2 * bh) / 8 + 0.5, bd / 8 + 0.5);
          }
      };
      for (const op of pl.ups) {
        drawUp(op);
        if (op.table) slab(pl.table);
      }
      // You (on the plate).
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
        const tw = g.measureText(line).width + 20;
        g.fillStyle = "#fff";
        g.strokeStyle = "#1f2530";
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(Math.max(6, pl.bubble.x - tw / 2), pl.bubble.y - 34, tw, 28, 10);
        g.fill();
        g.stroke();
        g.fillStyle = "#1f2530";
        g.fillText(line, Math.max(6, pl.bubble.x - tw / 2) + tw / 2, pl.bubble.y - 15);
      }
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
  { imgs, tiles, W, H, HEAD, top: IN.INTRO_GREX_TABLE_TOP, line: "Boys! We got a challenger!" },
);
// SHEET=<out.png> (and COLS): every still side by side in one picture, each under its time, instead of one file each.
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
    await page.evaluate(({ pl, storm, n, t, W, H, HEAD, cols }) => {
      (window as any).draw(pl, storm);
      const sh = document.getElementById("sheet") as HTMLCanvasElement;
      const g = sh.getContext("2d")!;
      const x = (n % cols) * (W + 8);
      const y = Math.floor(n / cols) * (H + HEAD + 22);
      g.drawImage(document.getElementById("c") as HTMLCanvasElement, x, y + 20);
      g.fillStyle = "#fff";
      g.font = "700 14px Arial";
      g.fillText(`${(t / 1000).toFixed(1)} s`, x + 6, y + 15);
    }, { pl: plans[n], storm: stormAt[n]!, n, t, W, H, HEAD, cols });
  }
  await page.setViewportSize({ width: Math.max(W, cols * (W + 8)), height: H + HEAD + Math.ceil(times.length / cols) * (H + HEAD + 22) });
  await page.locator("#sheet").screenshot({ path: SHEET });
} else
  for (const [n, t] of times.entries()) {
    await page.evaluate(({ pl, storm }) => (window as any).draw(pl, storm), { pl: plans[n], storm: stormAt[n]! });
    await page.locator("#c").screenshot({ path: `${dir}/t${t}.png` });
  }
await browser.close();
console.log(`wrote ${times.length} stills to ${dir}`);
