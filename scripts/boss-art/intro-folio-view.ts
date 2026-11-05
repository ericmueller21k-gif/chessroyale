// Mockups of Folio's sanctuary (out/house-shop-folio) and its challenge intro (Nov 5, brief-folio-sanctuary-art.md), through the
// town's own camera: the room laid out by SHOP_FOLIO_LAYOUT (floor tiles on the curved ground, upright pieces stood at their
// feet, near ones fading as ShopRoom fades them), the stained-glass windows' coloured pools on the floor drifting with the sun
// (SHOP_FOLIO_POOLS, their `drift`) and the panes' halos (SHOP_FOLIO_LIGHTS), the shopkeeper (out/sidekick-folio-turtle) behind
// the counter, your pawn; for the intro, Folio's moves (out/boss-folio BOSS_FOLIO_INTRO, mirrored to face east, at its town
// size), the props (out/house-intro-folio): the sheets folding into the stools and the table, the paper aeroplane, the board
// unfolding on the table (its top-view picture laid on the table's top through the camera), the bubbles, and the crumple
// (crumple.ts) over black into a stand-in match screen. The ceiling is the mockup's (folded paper), not the art.
//
//   npx tsx scripts/boss-art/intro-folio-view.ts room <out.png> <col> <row> [close|town] [phone|computer] [t ms]
//   npx tsx scripts/boss-art/intro-folio-view.ts intro <dir> [phone|computer] [t,t,...]   (no times: every frame at 15 fps, f###.png)
//   CHECK=1 npx tsx scripts/boss-art/intro-folio-view.ts intro - [phone|computer]   (every resting figure's box on screen)
//   npx tsx scripts/boss-art/intro-folio-view.ts crumple <dir> [phone]   (the crumple alone: frames at 20 fps, c###.png)
// The GIFs:
//   ffmpeg -framerate 15 -i <dir>/f%03d.png -vf "split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" view-intro-sequence.gif
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { newPt, newView, proj, setView } from "../../packages/app/src/town/camera.ts";
import { SHOP_FEEL, TOWN_FEEL } from "../../packages/app/src/town/feel.ts";
import { FOLIO } from "../../packages/app/src/characters/folio.ts";
import { renderFrame, type Character, type Frame } from "../../packages/app/src/characters/sprite.ts";
import * as SHOP from "./out/house-shop-folio/house-shop-folio.ts";
import * as IN from "./out/house-intro-folio/house-intro-folio.ts";
import { BOSS_FOLIO_INTRO as BF } from "./out/boss-folio/boss-folio.ts";
import { sidekickFolioTurtle as TURTLE } from "./out/sidekick-folio-turtle/sidekick-folio-turtle.ts";
import { crumpleAt, crumpleMesh, CRUMPLE_DEFAULTS, CRUMPLE_TIMING } from "./out/house-intro-folio/crumple.ts";

const [mode = "room", outArg = ".", ...rest] = process.argv.slice(2);
const HEAD = 52;
const SQ = 37;
const LINE1 = "Every game is a draft. Shall we write one?";
const LINE2 = "Take your time. The page will wait.";

// ---- The timeline (ms). Every beat numbered as in intro-folio-nov5.md.
export const TL = {
  // 1. The walk-on, and its entrance line.
  walkFrom: 15.6,
  walkMs: 900,
  line1: [1100, 3300] as const,
  // 2. The furniture folds itself: you both step back a pace to make room, then the stools (west, east), then the table.
  stepBack: [3300, 3700] as const,
  stoolW: 3750,
  stoolE: 4100,
  table: 4650,
  // 3. The board arrives: the plane's route, the packet let go, landing, unfolding.
  plane: 5900,
  // 4. The bow, and the quiet line.
  bow: 9150,
  line2: [9250, 11650] as const,
  // 5. Into the match: the crumple.
  crumple: 11900,
};
const MARK = { boss: SHOP.SHOP_FOLIO_MARKS.boss, you: SHOP.SHOP_FOLIO_MARKS.you };
/** Where you both stand once you've stepped back (squares): Folio 2.3 west of the table's middle, you 2.3 east. */
export const CLEAR = { boss: IN.INTRO_FOLIO_TABLE_AT[0] - 2.3, you: IN.INTRO_FOLIO_TABLE_AT[0] + 2.3 };
const lenOf = (ch: Character, a: string) => ch.anims[a]!.frames.reduce((s, f) => s + f.ms, 0);
const route = IN.INTRO_FOLIO_PLANE_ROUTE;
const DROP_AT = route[3]!.ms; // the packet let go over the table
const FALL_MS = 280;
const LAND = TL.plane + DROP_AT + FALL_MS;
const UNFOLD = LAND + 90;
const CRUMPLE_END = TL.crumple + CRUMPLE_TIMING.crumple + CRUMPLE_TIMING.hold + CRUMPLE_TIMING.open + CRUMPLE_TIMING.creaseLinger;
const END = CRUMPLE_END + 700;

const ramp = (t: number, a: number, ms: number) => Math.max(0, Math.min(1, (t - a) / ms));
const ease = (u: number) => u * u * (3 - 2 * u);
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

// ---- The camera.
const device = mode === "room" ? (rest[3] ?? "phone") : (rest[0] ?? "phone");
const [W, H] = device === "phone" ? [390, 844 - HEAD] : [1280, 720 - HEAD];
const cam = mode === "room" ? (rest[2] ?? "close") : "town";
if (cam === "close") Object.assign(TOWN_FEEL.camTall, SHOP_FEEL.close), Object.assign(TOWN_FEEL.camWide, SHOP_FEEL.close);
const TABLE = { c: IN.INTRO_FOLIO_TABLE_AT[0], r: IN.INTRO_FOLIO_TABLE_AT[1] };
const [camX, camY] = mode === "room" ? [Number(rest[0] ?? 9.5), Number(rest[1] ?? 15)] : [TABLE.c - 0.75, TABLE.r + 0.8];
const v = newView();
setView(v, W, H, 0);
const pt = newPt();
const P = (c: number, r: number, lift = 0) => (proj(v, c - camX, camY - r, lift, pt) ? { ...pt } : null);
const BOSS_PX = FOLIO.h / TOWN_FEEL.bossSquares;

// ---- Pictures.
type Img = { w: number; h: number; data: string; foot: readonly [number, number]; box: [number, number, number, number] };
const imgs: Record<string, Img> = {};
function pic(ch: Character, anim: string, i: number): string {
  const key = `${ch.id}|${anim}|${i}`;
  if (!imgs[key]) {
    const r = renderFrame(ch, ch.anims[anim]!.frames[i]!);
    let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.data[(y * r.w + x) * 4 + 3]! > 40) ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)));
    imgs[key] = { w: r.w, h: r.h, data: Buffer.from(r.data).toString("base64"), foot: ch.foot, box: [x0, y0, x1, y1] };
  }
  return key;
}

// ---- The room.
type Up = { img: string; x: number; y: number; s: number; flip: boolean; depth: number; alpha?: number; tag?: string; tagColor?: string; tagUp?: number; name?: string };
type Quad = { img: string; q: number[] };
const tiles: Quad[] = [];
type Place = { name: string; col: number; row: number; flip: boolean; fc: number };
const places: Place[] = [];
for (const pl of SHOP.SHOP_FOLIO_LAYOUT) {
  const ch = SHOP.SHOP_FOLIO_PIECES[pl.name]!;
  if (/^(floor|page)/.test(pl.name)) {
    const cs4 = [P(pl.col - 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row + 0.5), P(pl.col - 0.5, pl.row + 0.5)];
    if (cs4.some((c) => !c)) continue;
    tiles.push({ img: pic(ch, "idle", 0), q: cs4.flatMap((c) => [c!.x, c!.y]) });
    continue;
  }
  places.push({ name: pl.name, col: pl.col, row: pl.row, flip: !!pl.flip, fc: pl.col + ((pl.w ?? 1) - 1) / 2 });
}
function roomUps(t: number): Up[] {
  const out: Up[] = [];
  for (const pl of places) {
    const ch = SHOP.SHOP_FOLIO_PIECES[pl.name]!;
    const isCrate = pl.name === "crate";
    const p = P(isCrate ? pl.col + 1.5 : pl.fc, pl.row);
    if (!p) continue;
    const s = p.k / SQ;
    const cp = SHOP.SHOP_FOLIO_PIECES.counter!;
    const dx = isCrate ? SHOP.SHOP_FOLIO_CRATE_AT[0] - cp.foot[0] : 0;
    const dy = isCrate ? SHOP.SHOP_FOLIO_CRATE_AT[1] - cp.foot[1] : 0;
    const { i } = frameAt(ch, "idle", t);
    out.push({ img: pic(ch, "idle", i), x: p.x + dx * s, y: p.y + dy * s, s, flip: pl.flip, depth: p.depth - (isCrate ? 0.001 : 0), name: pl.name });
  }
  return out;
}
/** The pools on the floor at time t (each projected as a polygon), and the panes' halos in the air. */
type Pool = { pts: number[]; color: string; a: number };
type Halo = { x: number; y: number; r: number; color: string; a: number };
function lights(t: number): { pools: Pool[]; halos: Halo[] } {
  const pools: Pool[] = [];
  const halos: Halo[] = [];
  for (const pl of places) {
    const ch = SHOP.SHOP_FOLIO_PIECES[pl.name]!;
    const mir = (x: number) => (pl.flip ? ch.w - 1 - x : x) - (pl.flip ? ch.w - 1 - ch.foot[0] : ch.foot[0]);
    for (const po of SHOP.SHOP_FOLIO_POOLS.filter((q) => q.piece === pl.name)) {
      const d = po.drift;
      const ph = d ? Math.sin(2 * Math.PI * (t / d.ms + d.phase)) : 0;
      const px = po.x + (d ? d.dx * ph : 0);
      const py = po.y + (d ? d.dy * ph : 0);
      const cx = pl.fc + mir(px) / SQ;
      const cy = pl.row + (py - ch.foot[1]) / SQ;
      const pts: number[] = [];
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * 2 * Math.PI;
        const q = P(cx + (Math.cos(a) * po.rx) / SQ, cy + (Math.sin(a) * po.ry) / SQ);
        if (q) pts.push(q.x, q.y);
      }
      if (pts.length > 12) pools.push({ pts, color: po.color, a: po.strength });
    }
    for (const sp of SHOP.SHOP_FOLIO_LIGHTS.filter((q) => q.piece === pl.name && q.halo)) {
      const p = P(pl.fc, pl.row);
      if (!p) continue;
      const s = p.k / SQ;
      halos.push({ x: p.x + mir(sp.x + sp.w / 2) * s, y: p.y + (sp.y + sp.h / 2 - ch.foot[1]) * s, r: (sp.halo ?? 20) * s * 1.4, color: sp.color, a: sp.strength * 0.35 });
    }
  }
  return { pools, halos };
}

// ---- The figures.
type Fig = { ch: Character; anim: string; ms: number; at: readonly [number, number]; flip?: boolean; boss?: boolean; lift?: number; label?: string };
const KID_AT: [number, number] = [9.5, 2.4];
function kidUp(t: number): Up {
  const p = P(KID_AT[0], KID_AT[1])!;
  const { i } = frameAt(TURTLE, "idle", t);
  const key = pic(TURTLE, "idle", i);
  const top = imgs[pic(TURTLE, "idle", 0)]!.box[1];
  const kidSquares = TOWN_FEEL.sidekickSquares / (TURTLE.foot[1] / TURTLE.h - top / TURTLE.h);
  const s = (kidSquares * p.k) / TURTLE.h;
  return { img: key, x: p.x, y: p.y, s, flip: false, depth: p.depth + 0.2, tag: "Shopkeeper", tagColor: "rgba(47,127,224,0.95)", tagUp: (TURTLE.foot[1] - top) * s + 2 };
}
function figUp(f: Fig): Up {
  const p = P(f.at[0], f.at[1], f.lift ?? 0)!;
  const s = f.boss ? p.k / BOSS_PX : p.k / SQ;
  const { i } = frameAt(f.ch, f.anim, f.ms);
  const base = P(f.at[0], f.at[1])!;
  return { img: pic(f.ch, f.anim, i), x: p.x, y: p.y, s, flip: !!f.flip, depth: base.depth - 0.002 - (f.lift ? 0.5 : 0) };
}

type Plan = { ups: Up[]; decals: (Quad & { depth: number })[]; pools: Pool[]; halos: Halo[]; bubble: null | { x: number; y: number; text: string }; pawn: null | { x: number; y: number; k: number; depth: number }; crumple: number };

/** The board's top-view picture laid on the table's top, through the camera (lifted to the top's height). */
function boardQuad(img: string, half: number, cx: number, cy: number): Quad & { depth: number } {
  const lift = IN.INTRO_FOLIO_TABLE_TOP / SQ;
  const cs4 = [P(cx - half, cy - half, lift), P(cx + half, cy - half, lift), P(cx + half, cy + half, lift), P(cx - half, cy + half, lift)];
  return { img, q: cs4.flatMap((q) => [q!.x, q!.y]), depth: P(TABLE.c, TABLE.r)!.depth - 0.004 };
}
function planAt(t: number): Plan {
  const ups = roomUps(t);
  const { pools, halos } = lights(t);
  const decals: Plan["decals"] = [];
  let bubble: Plan["bubble"] = null;
  let pawn: Plan["pawn"] = null;
  if (mode === "room") {
    ups.push(kidUp(t));
    const me = P(camX, camY)!;
    pawn = { x: me.x, y: me.y, k: me.k, depth: me.depth };
    return { ups, decals, pools, halos, bubble, pawn, crumple: 0 };
  }
  ups.push(kidUp(t));
  // 1. Walk-on; 2. stepping back a pace.
  const walk = ease(ramp(t, 0, TL.walkMs));
  const back = ease(ramp(t, TL.stepBack[0], TL.stepBack[1] - TL.stepBack[0]));
  const row = TL.walkFrom + (MARK.boss[1] - TL.walkFrom) * walk;
  const bossC = MARK.boss[0] + (CLEAR.boss - MARK.boss[0]) * back;
  const youC = MARK.you[0] + (CLEAR.you - MARK.you[0]) * back;
  let anim = "idle";
  let ms = t;
  if (t < TL.walkMs + 120 || (t >= TL.stepBack[0] && t < TL.stepBack[1])) (anim = "glide"), (ms = t);
  else if (t >= TL.bow && t < TL.bow + lenOf(BF, "bow")) (anim = "bow"), (ms = t - TL.bow);
  const folio: Fig = { ch: BF, anim, ms, at: [bossC, row], flip: true, boss: true };
  ups.push(figUp(folio));
  const yp = P(youC, row)!;
  pawn = { x: yp.x, y: yp.y, k: yp.k, depth: yp.depth };
  // 2. The sheets, folding.
  const sheet = (ch: Character, kind: "stool" | "table", at: readonly [number, number], start: number) => {
    const into = t - start;
    if (into < 0) {
      // Lying flat: its top-view picture on the floor, through the camera.
      const [sw, sh] = IN.INTRO_FOLIO_SHEET_SQUARES[kind];
      const cs4 = [P(at[0] - sw / 2, at[1] - sh / 2), P(at[0] + sw / 2, at[1] - sh / 2), P(at[0] + sw / 2, at[1] + sh / 2), P(at[0] - sw / 2, at[1] + sh / 2)];
      decals.push({ img: pic(IN.INTRO_FOLIO_SHEETS, kind, 0), q: cs4.flatMap((q) => [q!.x, q!.y]), depth: 1e6 });
      return;
    }
    ups.push(figUp({ ch, anim: into < lenOf(ch, "fold") ? "fold" : "idle", ms: into, at }));
  };
  sheet(IN.INTRO_FOLIO_STOOL, "stool", IN.INTRO_FOLIO_STOOLS_AT[0], TL.stoolW);
  sheet(IN.INTRO_FOLIO_STOOL, "stool", IN.INTRO_FOLIO_STOOLS_AT[1], TL.stoolE);
  sheet(IN.INTRO_FOLIO_TABLE, "table", [TABLE.c, TABLE.r], TL.table);
  // 3. The plane along its route; the packet falling; the board unfolding.
  const pt0 = t - TL.plane;
  if (pt0 >= 0 && pt0 < route.at(-1)!.ms) {
    let k = 0;
    while (k < route.length - 2 && pt0 > route[k + 1]!.ms) k++;
    const a = route[k]!;
    const b = route[k + 1]!;
    const u = ease((pt0 - a.ms) / (b.ms - a.ms));
    const at: [number, number] = [a.at[0] + (b.at[0] - a.at[0]) * u, a.at[1] + (b.at[1] - a.at[1]) * u];
    const lift = a.at[2] + (b.at[2] - a.at[2]) * u;
    const bankAt = route[2]!.ms;
    const pa = pt0 < bankAt ? "fly" : pt0 < DROP_AT ? "bank" : pt0 < DROP_AT + lenOf(IN.INTRO_FOLIO_PLANE, "drop") ? "drop" : "away";
    const pms = pa === "fly" ? pt0 : pa === "bank" ? pt0 - bankAt : pa === "drop" ? pt0 - DROP_AT : pt0;
    // Facing: it flies west (our left) all the way: its own drawing, unmirrored.
    ups.push(figUp({ ch: IN.INTRO_FOLIO_PLANE, anim: pa, ms: pms, at, lift }));
  }
  const B = IN.INTRO_FOLIO_BOARD;
  const half = IN.INTRO_FOLIO_BOARD_SQUARES / 2;
  if (t >= TL.plane + DROP_AT && t < LAND) {
    // The packet falling: the board's NW quarter, from the plane's height to the table's top, a little sway.
    const u = (t - TL.plane - DROP_AT) / FALL_MS;
    const lift0 = route[3]!.at[2] - IN.INTRO_FOLIO_TABLE_TOP / SQ;
    const p = P(TABLE.c - half / 2, TABLE.r - half / 2, IN.INTRO_FOLIO_TABLE_TOP / SQ + lift0 * (1 - u * u))!;
    const pk = pic(B, "packet", 0);
    ups.push({ img: pk, x: p.x + Math.sin(u * 6) * 2, y: p.y, s: (p.k * IN.INTRO_FOLIO_BOARD_SQUARES) / IN.INTRO_FOLIO_BOARD.w, flip: false, depth: P(TABLE.c, TABLE.r)!.depth - 0.5, name: "packet" });
  } else if (t >= LAND) {
    const into = t - UNFOLD;
    const img = into < 0 ? pic(B, "packet", 0) : into < lenOf(B, "unfold") ? pic(B, "unfold", frameAt(B, "unfold", into).i) : pic(B, "full", 0);
    decals.push(boardQuad(img, half, TABLE.c, TABLE.r));
  }
  // The bubbles: over Folio's head.
  const bub = (text: string) => {
    const p = P(bossC, row)!;
    return { x: p.x, y: p.y - (FOLIO.foot[1] - 8) * (p.k / BOSS_PX), text };
  };
  if (t >= TL.line1[0] && t < TL.line1[1]) bubble = bub(LINE1);
  if (t >= TL.line2[0] && t < TL.line2[1]) bubble = bub(LINE2);
  return { ups, decals, pools, halos, bubble, pawn, crumple: t >= TL.crumple ? t - TL.crumple : 0 };
}

// ---- CHECK: every resting figure's drawn box on screen (Folio and you at your marks and clear places, the stools, the
// table, the plane at the bank, the board).
if (process.env.CHECK) {
  const rests: [string, Fig][] = [
    ["Folio at its mark", { ch: BF, anim: "idle", ms: 0, at: [MARK.boss[0], MARK.boss[1]], flip: true, boss: true }],
    ["Folio stepped back", { ch: BF, anim: "idle", ms: 0, at: [CLEAR.boss, MARK.boss[1]], flip: true, boss: true }],
    ["Folio bowing", { ch: BF, anim: "bow", ms: 700, at: [CLEAR.boss, MARK.boss[1]], flip: true, boss: true }],
    ["the west stool", { ch: IN.INTRO_FOLIO_STOOL, anim: "idle", ms: 0, at: IN.INTRO_FOLIO_STOOLS_AT[0] }],
    ["the east stool", { ch: IN.INTRO_FOLIO_STOOL, anim: "idle", ms: 0, at: IN.INTRO_FOLIO_STOOLS_AT[1] }],
    ["the table", { ch: IN.INTRO_FOLIO_TABLE, anim: "idle", ms: 0, at: [TABLE.c, TABLE.r] }],
    ["the plane, banking", { ch: IN.INTRO_FOLIO_PLANE, anim: "bank", ms: 300, at: [route[3]!.at[0], route[3]!.at[1]], lift: route[3]!.at[2] }],
    ["the shopkeeper", { ch: TURTLE, anim: "idle", ms: 0, at: KID_AT }],
  ];
  for (const [label, f] of rests) {
    const u = figUp(f);
    const im = imgs[u.img]!;
    const fx = u.flip ? im.w - 1 - im.foot[0] : im.foot[0];
    const bx0 = u.flip ? im.w - 1 - im.box[2] : im.box[0];
    const bx1 = u.flip ? im.w - 1 - im.box[0] : im.box[2];
    const x0 = u.x + (bx0 - fx) * u.s, x1 = u.x + (bx1 - fx) * u.s;
    const y0 = u.y + (im.box[1] - im.foot[1]) * u.s, y1 = u.y + (im.box[3] - im.foot[1]) * u.s;
    const ok = x0 >= 0 && x1 <= W && y0 >= 0 && y1 <= H;
    console.log(`${device} ${ok ? "OK " : "CUT"} ${label}: x ${x0.toFixed(0)}-${x1.toFixed(0)} y ${y0.toFixed(0)}-${y1.toFixed(0)} (screen ${W} x ${H})`);
  }
  for (const [label, c, r] of [["you at your mark", MARK.you[0], MARK.you[1]], ["you stepped back", CLEAR.you, MARK.you[1]]] as const) {
    const p = P(c, r)!;
    const size = 1.45 * p.k;
    const x0 = p.x - size / 2, x1 = p.x + size / 2, y0 = p.y - size;
    console.log(`${device} ${x0 >= 0 && x1 <= W && y0 >= 0 && p.y <= H ? "OK " : "CUT"} ${label}: x ${x0.toFixed(0)}-${x1.toFixed(0)} y ${y0.toFixed(0)}-${p.y.toFixed(0)}`);
  }
  process.exit(0);
}

// ---- The stand-in match screen for the crumple's open (mockup only: the game's real battle screen is the sheet).
const times: number[] =
  mode === "room" ? [Number(rest[4] ?? 0)] : mode === "crumple" ? [] : rest[1] ? rest[1].split(",").map(Number) : Array.from({ length: Math.ceil(END / (1000 / 15)) }, (_, i) => Math.round((i * 1000) / 15));
const plans = times.map(planAt);
/** The intro's last still before the crumple (made now, so its pictures go to the page with the rest). */
const STILL_PLAN = mode === "room" ? null : planAt(TL.crumple);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H + HEAD }, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:#000"><canvas id=c></canvas><canvas id=still></canvas><canvas id=match></canvas></body></html>`);
await page.evaluate("window.__name = (f) => f");
await page.evaluate(
  ({ imgs, tiles, W, H, HEAD }) => {
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
    // An image (sw x sh) mapped on a triangle by its three corners (an affine map), padded a hair so neighbours leave no seam.
    const tri = (gg: CanvasRenderingContext2D, img: CanvasImageSource, s: number[][], d: number[][], pad = 0.6) => {
      const [[x0, y0], [x1, y1], [x2, y2]] = d as [number[], number[], number[]];
      const [[u0, v0], [u1, v1], [u2, v2]] = s as [number[], number[], number[]];
      gg.save();
      gg.beginPath();
      const cx = (x0! + x1! + x2!) / 3, cy = (y0! + y1! + y2!) / 3;
      // Grown away from its middle (not by the signs of x and y: that leaves a right triangle's long edge where it was).
      const pd = (x: number, y: number) => {
        const l = Math.hypot(x - cx, y - cy) || 1;
        return [x + ((x - cx) / l) * pad * 2, y + ((y - cy) / l) * pad * 2] as const;
      };
      gg.moveTo(...pd(x0!, y0!));
      gg.lineTo(...pd(x1!, y1!));
      gg.lineTo(...pd(x2!, y2!));
      gg.closePath();
      gg.clip();
      const den = u0! * (v1! - v2!) + u1! * (v2! - v0!) + u2! * (v0! - v1!);
      if (Math.abs(den) < 1e-6) return gg.restore();
      const a = (x0! * (v1! - v2!) + x1! * (v2! - v0!) + x2! * (v0! - v1!)) / den;
      const b = (x0! * (u2! - u1!) + x1! * (u0! - u2!) + x2! * (u1! - u0!)) / den;
      const c = (x0! * (u1! * v2! - u2! * v1!) + x1! * (u2! * v0! - u0! * v2!) + x2! * (u0! * v1! - u1! * v0!)) / den;
      const d2 = (y0! * (v1! - v2!) + y1! * (v2! - v0!) + y2! * (v0! - v1!)) / den;
      const e = (y0! * (u2! - u1!) + y1! * (u0! - u2!) + y2! * (u1! - u0!)) / den;
      const f = (y0! * (u1! * v2! - u2! * v1!) + y1! * (u2! * v0! - u0! * v2!) + y2! * (u0! * v1! - u1! * v0!)) / den;
      gg.transform(a, d2, b, e, c, f);
      gg.drawImage(img, 0, 0);
      gg.restore();
    };
    w.tri = tri;
    const quad = (img: HTMLCanvasElement, q: number[]) => {
      const s = [[0, 0], [img.width, 0], [img.width, img.height], [0, img.height]];
      const d = [0, 1, 2, 3].map((i) => [q[2 * i]!, q[2 * i + 1]!]);
      tri(g, img, [s[0]!, s[1]!, s[2]!], [d[0]!, d[1]!, d[2]!]);
      tri(g, img, [s[0]!, s[2]!, s[3]!], [d[0]!, d[2]!, d[3]!]);
    };
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
    w.draw = (pl: any, title: string) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
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
      // The ceiling (mockup only): folded paper, pale, its pleats running up to a fold far overhead, fading to blank.
      const sky = g.createLinearGradient(0, 0, 0, H * 0.5);
      sky.addColorStop(0, "#e9dfc9");
      sky.addColorStop(1, "#f7f0e0");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(165,142,105,0.35)";
      g.lineWidth = 1.5;
      for (let i = -14; i <= 14; i++) {
        g.beginPath();
        g.moveTo(W / 2 + i * W * 0.02, -H * 0.3);
        g.lineTo(W / 2 + i * W * 0.16, H * 0.5);
        g.stroke();
      }
      for (const t of tiles as any[]) quad(canv[t.img]!, t.q);
      // The windows' pools on the floor: their colour laid over the paper (multiply), soft-edged (three rings).
      g.globalCompositeOperation = "multiply";
      for (const po of pl.pools) {
        const xs: number[] = [], ys: number[] = [];
        for (let i = 0; i < po.pts.length; i += 2) xs.push(po.pts[i]), ys.push(po.pts[i + 1]);
        const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
        for (const sc of [1, 0.78, 0.55]) {
          g.fillStyle = po.color;
          g.globalAlpha = po.a * 0.55;
          g.beginPath();
          xs.forEach((x, i) => (i ? g.lineTo(mx + (x - mx) * sc, my + (ys[i]! - my) * sc) : g.moveTo(mx + (x - mx) * sc, my + (ys[i]! - my) * sc)));
          g.closePath();
          g.fill();
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      const items: any[] = [...pl.ups.map((u: any) => ({ ...u, t: "up" })), ...pl.decals.map((d: any) => ({ ...d, t: "decal" }))];
      if (pl.pawn) items.push({ ...pl.pawn, t: "pawn" });
      items.sort((a, b) => b.depth - a.depth);
      for (const op of items) {
        if (op.t === "decal") {
          quad(canv[op.img]!, op.q);
          continue;
        }
        if (op.t === "pawn") {
          const size = 1.45 * op.k, u = size / 45;
          g.fillStyle = "rgba(118,98,76,0.3)";
          g.beginPath();
          g.ellipse(op.x, op.y, size * 0.32, size * 0.11, 0, 0, Math.PI * 2);
          g.fill();
          g.save();
          g.translate(op.x - 22.5 * u, op.y - 39.75 * u);
          g.scale(u, u);
          g.fillStyle = "#fff";
          g.strokeStyle = "#000";
          g.lineWidth = 1.5;
          g.fill(PAWN);
          g.stroke(PAWN);
          g.restore();
          tag(op.x, op.y - 31 * u, "You", "rgba(255,215,106,0.96)");
          continue;
        }
        const near = Math.min(1, (op.depth - 2) / 1);
        if (near <= 0) continue;
        const im = imgs[op.img]!;
        g.globalAlpha = near * (op.alpha ?? 1);
        const fx = op.flip ? im.w - 1 - im.foot[0] : im.foot[0];
        g.save();
        g.translate(op.x - fx * op.s, op.y - im.foot[1] * op.s);
        if (op.flip) g.translate(im.w * op.s, 0), g.scale(-1, 1);
        g.drawImage(canv[op.img]!, 0, 0, im.w * op.s, im.h * op.s);
        g.restore();
        g.globalAlpha = 1;
        if (op.tag) tag(op.x, op.y - op.tagUp, op.tag, op.tagColor);
      }
      // The panes' halos in the air (soft, additive).
      g.globalCompositeOperation = "lighter";
      for (const h of pl.halos) {
        const gr = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
        gr.addColorStop(0, h.color + "55");
        gr.addColorStop(1, h.color + "00");
        g.globalAlpha = h.a;
        g.fillStyle = gr;
        g.fillRect(h.x - h.r, h.y - h.r, 2 * h.r, 2 * h.r);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      if (pl.bubble) {
        g.font = "700 14px Arial";
        const tw = Math.min(W - 12, g.measureText(pl.bubble.text).width + 20);
        const bx = Math.max(6, Math.min(W - tw - 6, pl.bubble.x - tw / 2));
        g.fillStyle = "#fff";
        g.strokeStyle = "#1f2530";
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(bx, pl.bubble.y - 34, tw, 28, 10);
        g.fill();
        g.stroke();
        g.fillStyle = "#1f2530";
        g.fillText(pl.bubble.text, bx + tw / 2, pl.bubble.y - 15, tw - 12);
      }
      g.restore();
    };
    // The stand-in match screen (mockup only): the header, Folio's bar, the board (8 x 8, cream and ink), your bar.
    w.drawMatch = () => {
      const m = document.getElementById("match") as HTMLCanvasElement;
      m.width = W;
      m.height = H + HEAD;
      const q = m.getContext("2d")!;
      q.fillStyle = "#f3f1ec";
      q.fillRect(0, 0, W, H + HEAD);
      q.fillStyle = "#1f2530";
      q.font = "700 16px Arial";
      q.textAlign = "center";
      q.fillText("Folio", W / 2, HEAD / 2 + 6);
      const bar = (y: number, name: string, col: string) => {
        q.fillStyle = "#fffaf0";
        q.strokeStyle = "#d3bd95";
        q.lineWidth = 2;
        q.beginPath();
        q.roundRect(12, y, W - 24, 64, 12);
        q.fill();
        q.stroke();
        q.fillStyle = col;
        q.beginPath();
        q.arc(46, y + 32, 20, 0, 7);
        q.fill();
        q.fillStyle = "#1f2530";
        q.textAlign = "left";
        q.font = "700 16px Arial";
        q.fillText(name, 76, y + 30);
        q.font = "400 13px Arial";
        q.fillStyle = "#6a6e80";
        q.fillText("10:00", 76, y + 48);
      };
      bar(HEAD + 40, "Folio", "#d8432a");
      const bs = W - 24, by = HEAD + 130, sq = bs / 8;
      for (let j = 0; j < 8; j++)
        for (let i = 0; i < 8; i++) {
          q.fillStyle = (i + j) % 2 ? "#575c78" : "#f6efdf";
          q.fillRect(12 + i * sq, by + j * sq, sq, sq);
        }
      const back = ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"];
      q.font = `${sq * 0.8}px serif`;
      q.textAlign = "center";
      for (let i = 0; i < 8; i++) {
        q.fillStyle = "#1c1620";
        q.fillText(back[i]!, 12 + (i + 0.5) * sq, by + sq * 0.78);
        q.fillText("♟", 12 + (i + 0.5) * sq, by + sq * 1.78);
        q.fillStyle = "#fffaf0";
        q.strokeStyle = "#1c1620";
        q.lineWidth = 1;
        q.fillText("♟", 12 + (i + 0.5) * sq, by + sq * 6.78);
        q.strokeText("♙", 12 + (i + 0.5) * sq, by + sq * 6.78);
        q.fillText(back[i]!, 12 + (i + 0.5) * sq, by + sq * 7.78);
        q.strokeText(["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"][i]!, 12 + (i + 0.5) * sq, by + sq * 7.78);
      }
      bar(by + bs + 24, "You", "#f2c14e");
      q.fillStyle = "#a58e69";
      q.font = "400 12px Arial";
      q.fillText("(stand-in match screen, mockup only)", W / 2, H + HEAD - 14);
    };
    // The crumple: the still (or the match screen) on the mesh's triangles, shaded; the paper's back where it's turned over.
    w.drawCrumple = (tris: any[], mix: number, still: string, flat: boolean) => {
      const sc = document.getElementById(still) as HTMLCanvasElement;
      const mc = document.getElementById("match") as HTMLCanvasElement;
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (flat) {
        // A flat frame (before it starts, once it's open and smoothed): the plain image, no mesh.
        g.globalAlpha = 1;
        g.drawImage(mix > 0 ? mc : sc, 0, 0);
        return;
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "#000";
      g.fillRect(0, 0, W, H + HEAD);
      // The shade goes to buffers of its own, each triangle opaque (grown a hair, painted far to near, so a nearer one simply
      // covers), then onto the picture once: multiplied (shade under 1) and screened (a warm sheen over 1). Drawn straight on
      // the picture, neighbours' soft edges would leave a faint lattice.
      const mk = (fillc: string) => {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H + HEAD;
        const x = c.getContext("2d")!;
        x.fillStyle = fillc;
        x.fillRect(0, 0, W, H + HEAD);
        return [c, x] as const;
      };
      const [shC, sh] = mk("#fff");
      const [hlC, hl] = mk("#000");
      for (const t of tris) {
        const d = t.s;
        const cx = (d[0][0] + d[1][0] + d[2][0]) / 3, cy = (d[0][1] + d[1][1] + d[2][1]) / 3;
        const pd = (x: number, y: number) => {
          const l = Math.hypot(x - cx, y - cy) || 1;
          return [x + ((x - cx) / l) * 2.4, y + ((y - cy) / l) * 2.4] as [number, number];
        };
        const path = (x: CanvasRenderingContext2D) => {
          x.beginPath();
          x.moveTo(...pd(d[0][0], d[0][1]));
          x.lineTo(...pd(d[1][0], d[1][1]));
          x.lineTo(...pd(d[2][0], d[2][1]));
          x.closePath();
        };
        if (t.back) {
          // The paper's back: cream-grey, the screen faintly through it.
          g.save();
          path(g);
          g.fillStyle = "#e3dccd";
          g.fill();
          g.restore();
        }
        const a = t.back ? 0.13 : 1;
        if (mix < 1) (g.globalAlpha = a * (1 - mix)), tri(g, sc, t.uv, t.s, 1.2);
        if (mix > 0) (g.globalAlpha = a * (mix < 1 ? mix : 1)), tri(g, mc, t.uv, t.s, 1.2);
        g.globalAlpha = 1;
        const lo = Math.round(255 * Math.min(1, t.shade));
        path(sh);
        sh.fillStyle = `rgb(${lo},${Math.round(lo * 0.97)},${Math.round(lo * 0.99)})`;
        sh.fill();
        const hi = Math.max(0, Math.min(1, (t.shade - 1) * 1.6));
        path(hl);
        hl.fillStyle = `rgb(${Math.round(255 * hi)},${Math.round(248 * hi)},${Math.round(232 * hi)})`;
        hl.fill();
      }
      g.globalCompositeOperation = "multiply";
      g.drawImage(shC, 0, 0);
      g.globalCompositeOperation = "screen";
      g.drawImage(hlC, 0, 0);
      g.globalCompositeOperation = "source-over";
    };
    w.snapshot = (id: string) => {
      const s = document.getElementById(id) as HTMLCanvasElement;
      s.width = W;
      s.height = H + HEAD;
      s.getContext("2d")!.drawImage(cv, 0, 0);
    };
  },
  { imgs, tiles, W, H, HEAD },
);
const TITLE = "Folded House";
if (mode === "room") {
  await page.evaluate(({ pl, title }) => (window as any).draw(pl, title), { pl: plans[0], title: TITLE });
  await page.locator("#c").screenshot({ path: outArg });
  console.log(`wrote ${outArg}`);
} else if (mode === "intro") {
  mkdirSync(outArg, { recursive: true });
  await page.evaluate(() => (window as any).drawMatch());
  const stillT = TL.crumple;
  let haveStill = false;
  const single = !!rest[1];
  for (const [n, t] of times.entries()) {
    const pl = plans[n]!;
    if (t >= stillT && !haveStill) {
      await page.evaluate(({ pl, title }) => ((window as any).draw(pl, title), (window as any).snapshot("still")), { pl: STILL_PLAN, title: TITLE });
      haveStill = true;
    }
    if (t >= stillT) {
      const c = crumpleAt(t - stillT);
      const tris = crumpleMesh(c.p, W, H + HEAD, { ...CRUMPLE_DEFAULTS, turn: c.turn }, c.p === 0 ? 0.1 * c.linger : c.p);
      const flat = c.p === 0 && (t - stillT < 1 || c.linger === 0);
      await page.evaluate(({ tris, mix, flat }) => (window as any).drawCrumple(tris, mix, "still", flat), { tris, mix: c.mix, flat });
    } else await page.evaluate(({ pl, title }) => (window as any).draw(pl, title), { pl, title: TITLE });
    await page.locator("#c").screenshot({ path: single ? `${outArg}/t${t}.png` : `${outArg}/f${String(n).padStart(3, "0")}.png` });
  }
  if (!single) writeFileSync(`${outArg}/ms.txt`, `${times.length} frames at 15 fps, ${END} ms\n`);
  console.log(`wrote ${times.length} frames to ${outArg} (END ${END} ms; the crumple at ${TL.crumple}, the land ${LAND}, the unfold ${UNFOLD})`);
} else if (mode === "crumple") {
  // The crumple alone, on the intro's last still before it (the board on the table), at 20 fps, with a lead-in and an end hold.
  mkdirSync(outArg, { recursive: true });
  await page.evaluate(() => (window as any).drawMatch());
  await page.evaluate(({ pl, title }) => ((window as any).draw(pl, title), (window as any).snapshot("still")), { pl: STILL_PLAN, title: TITLE });
  const total = CRUMPLE_TIMING.crumple + CRUMPLE_TIMING.hold + CRUMPLE_TIMING.open + CRUMPLE_TIMING.creaseLinger;
  const LEAD = 500, TAIL = 700;
  let n = 0;
  for (let ms = -LEAD; ms <= total + TAIL; ms += 50) {
    const c = crumpleAt(Math.max(0, ms));
    const tris = crumpleMesh(ms < 0 ? 0 : c.p, W, H + HEAD, { ...CRUMPLE_DEFAULTS, turn: c.turn }, c.p === 0 ? (ms < 0 ? 0 : 0.1 * c.linger) : c.p);
    const flat = ms <= 0 || (c.p === 0 && c.linger === 0);
    await page.evaluate(({ tris, mix, flat }) => (window as any).drawCrumple(tris, mix, "still", flat), { tris, mix: ms < 0 ? 0 : c.mix, flat });
    await page.locator("#c").screenshot({ path: `${outArg}/c${String(n++).padStart(3, "0")}.png` });
  }
  console.log(`wrote ${n} crumple frames to ${outArg}`);
}
await browser.close();
