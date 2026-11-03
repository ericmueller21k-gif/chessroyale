// Mockup of Hollow's whole battle intro (Nov 3) from the phone's intro camera (390 x 844): his cave (out/house-shop-hollow)
// through the town's camera framed as a challenge frames it (CHALLENGE_FEEL.cam.across: 0.75 squares west and 0.8 south of
// his pond's middle, the table's (12.5, 11.5); zoom 1, the town's zoomed-in camera), with its lights (SHOP_HOLLOW_LIGHTS'
// halos, SHOP_HOLLOW_POOLS) drawn as ShopRoom draws them; his moves (out/boss-hollow, BOSS_HOLLOW_INTRO) at his town size
// (bossSquares tall), your pawn, and the props (out/house-intro-hollow): the lanterns going out one by one, the string's
// bulbs drained in a run, the tree, his own strand and your pawn, every light's motes flying into the ball, the blackout
// and the dim steady pool. The table and its board are stand-ins (the park table; the game draws the real board).
//   npx tsx scripts/boss-art/intro-hollow-view.ts <dir> [dpr] [t,t,...]
// Without times it writes every frame at 15 a second (f###.png, ms.txt); with times, one still each (t<ms>.png). The GIF:
//   ffmpeg -framerate 15 -i <dir>/f%03d.png -vf "split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" out.gif
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { newPt, newView, proj, setView } from "../../packages/app/src/town/camera.ts";
import { TOWN_FEEL } from "../../packages/app/src/town/feel.ts";
import { PARK_TABLE, TABLE_BOARD } from "../../packages/app/src/town/houses/park.ts";
import { HOLLOW, hollowBuild } from "../../packages/app/src/characters/hollow.ts";
import { frameKeys, renderFrame, type Character, type Frame } from "../../packages/app/src/characters/sprite.ts";
import * as SHOP from "./out/house-shop-hollow/house-shop-hollow.ts";
import * as IN from "./out/house-intro-hollow/house-intro-hollow.ts";
import * as BH from "./out/boss-hollow/boss-hollow.ts";

const [dir = ".", dprArg = "1", timesArg = ""] = process.argv.slice(2);
/** The phone (390 x 844): the room's header (52 px, as in the game's stills) over the room's canvas. */
const W = 390, HEAD = 52, H = 844 - HEAD, DPR = Number(dprArg);
const SQ = 37;
const TABLE = { c: 12.5, r: 11.5 };
const camX = TABLE.c - 0.75, camY = TABLE.r + 0.8;
const v = newView();
setView(v, W, H, 0);
const pt = newPt();
const P = (c: number, r: number) => (proj(v, c - camX, camY - r, 0, pt) ? { ...pt } : null);

// ---- The timeline (ms).
const MARK = { boss: 11, you: 14, r: 11.5 };
const CLEAR = { boss: TABLE.c - 2.92, you: TABLE.c + 2.2 };
const WALK_FROM = 15.5, WALK_MS = 900;
const LINE = [1200, 2700] as const;
const CHARGE = 2800, SWELL = 5000, DRINK = 5460;
const LANTERNS = [
  { col: 9, row: 5, at: 5600 },
  { col: 11, row: 8, at: 6200 },
  { col: 9, row: 11, at: 6800 },
  { col: 17, row: 12, at: 7300 },
  { col: 13, row: 16, at: 7800 },
];
const STRING = 8400, STRING_MS = 1800;
const TREE = 10300;
const STRAND = [11000, 11150, 11300];
const PAWN = 11500;
const FULL = 12200, BLACK = 12900, SWAP = BLACK + 400, DIM = 13800, END = 15800;
const D = IN.INTRO_HOLLOW_DARK, POOL = IN.INTRO_HOLLOW_DIMPOOL;
const ramp = (t: number, a: number, ms: number) => Math.max(0, Math.min(1, (t - a) / ms));

// ---- Pictures: every frame drawn once (its colors, and its lit pixels alone for over the dark).
type Img = { w: number; h: number; data: string; emis: string | null };
const imgs: Record<string, Img> = {};
const lum = (r: number, g: number, b: number) => (0.3 * r + 0.59 * g + 0.11 * b) / 255;
type Spot = { keys: string; x: number; y: number; w: number; h: number };
function picture(key: string, ch: Character, fr: Frame, o: { look?: string; spots?: readonly Spot[]; emisKeys?: string; recolorEmis?: string } = {}): string {
  if (imgs[key]) return key;
  const r = renderFrame(ch, fr, { look: o.look });
  let emis: Uint8ClampedArray | null = null;
  if (o.spots?.length || o.emisKeys) {
    const k = frameKeys(ch, fr);
    emis = new Uint8ClampedArray(r.data.length);
    let any = false;
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        const kk = k[y]![x];
        if (!kk) continue;
        const i = (y * r.w + x) * 4;
        const inSpot = o.emisKeys?.includes(kk) || o.spots?.some((s) => s.keys.includes(kk) && x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
        if (!inSpot || lum(r.data[i]!, r.data[i + 1]!, r.data[i + 2]!) < 0.28) continue;
        if (o.recolorEmis) emis.set([parseInt(o.recolorEmis.slice(1, 3), 16), parseInt(o.recolorEmis.slice(3, 5), 16), parseInt(o.recolorEmis.slice(5, 7), 16), r.data[i + 3]!], i);
        else emis.set(r.data.subarray(i, i + 4), i);
        any = true;
      }
    if (!any) emis = null;
  }
  imgs[key] = { w: r.w, h: r.h, data: Buffer.from(r.data).toString("base64"), emis: emis ? Buffer.from(emis).toString("base64") : null };
  return key;
}
const frameAt = (ch: Character, anim: string, ms: number, hold = true): { f: Frame; i: number } => {
  const a = ch.anims[anim]!;
  const total = a.frames.reduce((s, f) => s + f.ms, 0);
  let s = ms;
  if (s >= total) s = a.loop ? s % total : total - 1;
  for (let i = 0; i < a.frames.length; i++) {
    if (s < a.frames[i]!.ms) return { f: a.frames[i]!, i };
    s -= a.frames[i]!.ms;
  }
  void hold;
  return { f: a.frames.at(-1)!, i: a.frames.length - 1 };
};
const lenOf = (ch: Character, anim: string) => ch.anims[anim]!.frames.reduce((s, f) => s + f.ms, 0);
const spotsOf = (name: string): Spot[] =>
  SHOP.SHOP_HOLLOW_LIGHTS.filter((l) => l.piece === name && !["rock-crack", "crate", "fire-pit"].includes(name)).map((l) => ({ keys: l.keys ?? "", x: l.x, y: l.y, w: l.w, h: l.h }));

// ---- The room: floor tiles (flat), upright pieces (stood at their feet).
type Tile = { img: string; rot: number; q: number[] };
const floor: Tile[] = [];
type Place = { name: string; col: number; row: number; flip: boolean; fc: number; x: number; y: number; s: number; depth: number };
const places: Place[] = [];
for (const pl of SHOP.SHOP_HOLLOW_LAYOUT) {
  const ch = SHOP.SHOP_HOLLOW_PIECES[pl.name]!;
  if (/^(floor|circle)/.test(pl.name)) {
    const cs4 = [P(pl.col - 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row - 0.5), P(pl.col + 0.5, pl.row + 0.5), P(pl.col - 0.5, pl.row + 0.5)];
    if (cs4.some((c) => !c)) continue;
    floor.push({ img: picture(`${pl.name}`, ch, ch.anims.idle!.frames[0]!), rot: pl.rot ?? 0, q: cs4.flatMap((c) => [c!.x, c!.y]) });
    continue;
  }
  if (pl.name === "crate") continue; // (round the bend: out of view)
  const fc = pl.col + ((pl.w ?? 1) - 1) / 2;
  const p = P(fc, pl.row);
  if (!p) continue;
  places.push({ name: pl.name, col: pl.col, row: pl.row, flip: !!pl.flip, fc, x: p.x, y: p.y, s: p.k / SQ, depth: p.depth });
}
/** A piece's pixel (lx, ly) on screen, at its placement. */
const onScreen = (pl: Place, ch: Character, lx: number, ly: number) => ({
  x: pl.x + (pl.flip ? ch.foot[0] - lx + 0.5 : lx + 0.5 - ch.foot[0]) * pl.s,
  y: pl.y + (ly + 0.5 - ch.foot[1]) * pl.s,
});
const placeAt = (name: string, col: number, row: number) => places.find((p) => p.name === name && p.col === col && p.row === row)!;

// ---- The lights going out: when each placement's state changes.
const lanternState = (pl: Place, t: number): { anim: string; ms: number; glow: number } => {
  const L = LANTERNS.find((l) => l.col === pl.col && l.row === pl.row)!;
  if (t < L.at) return { anim: "lit", ms: t, glow: 1 };
  const k = Math.floor(L.at / 170) % 8;
  const into = t - L.at;
  if (into < 6 * 170) return { anim: `gutter${k}`, ms: into, glow: IN.INTRO_HOLLOW_LANTERN_GLOW[Math.floor(into / 170)] ?? 0 };
  return { anim: "idle", ms: t, glow: 0 };
};
const RUN = IN.INTRO_HOLLOW_BULB_RUN;
const bulbAt = (i: number) => STRING + (i * STRING_MS) / RUN.length;
const bulbsGone = (pl: Place, t: number) => RUN.filter((b, i) => b.col === pl.col && b.row === pl.row && b.piece === pl.name && t >= bulbAt(i)).length;
const lanternsOut = (t: number) => LANTERNS.reduce((s, L) => s + ramp(t, L.at + 340, 400), 0);
const treeOut = (t: number) => ramp(t, TREE, lenOf(IN.INTRO_HOLLOW_SHOWPIECE_OUT, "drain"));
const strandOut = (t: number) => STRAND.filter((s) => t >= s).length;
function darkLevel(t: number): number {
  const a = D.steps.lantern * lanternsOut(t) + D.steps.string * ramp(t, STRING, STRING_MS) + D.steps.tree * treeOut(t) + D.steps.strand * (strandOut(t) / 3) + D.steps.pawn * ramp(t, PAWN, 500);
  return Math.min(1, a + (1 - a) * ramp(t, BLACK, D.blackoutMs));
}

// ---- Him: his move at each moment, and where he stands.
const BI = BH.BOSS_HOLLOW_INTRO;
function him(t: number): { ch: Character; anim: string; ms: number; c: number; r: number } {
  const walk = ramp(t, 0, WALK_MS);
  const r = WALK_FROM + (MARK.r - WALK_FROM) * walk;
  const c = t >= SWAP ? CLEAR.boss : MARK.boss;
  if (t < CHARGE) return { ch: HOLLOW, anim: "idle", ms: t, c, r };
  if (t < SWELL) return { ch: BI, anim: "charge", ms: t - CHARGE, c, r };
  if (t < DRINK) return { ch: BI, anim: "swell", ms: t - SWELL, c, r };
  if (t < FULL) return { ch: BI, anim: "drink", ms: t - DRINK, c, r };
  if (t < DIM) return { ch: BI, anim: "full", ms: t - FULL, c, r };
  if (t < DIM + lenOf(BI, "settle")) return { ch: BI, anim: "settle", ms: t - DIM, c, r };
  return { ch: HOLLOW, anim: "idle", ms: t - DIM - lenOf(BI, "settle"), c, r };
}
/** His lit pixels: his eyes, the ball's bright violet and the light landing on it, his strand's bulbs (BULB_KEYS). */
const HIS_LIT = "eEUxab" + Array.from({ length: 40 }, (_, i) => String.fromCharCode(0xc0 + i)).join("");
const lookAt = (t: number) => (["bulbs3", "bulbs2", "bulbs1", "bulbs0"] as const)[strandOut(t)]!;
const BOSS_PX = HOLLOW.h / TOWN_FEEL.bossSquares; // his pixels a square
/** His heart on screen (the ball's middle), and his scale. */
function heartAt(t: number) {
  const h = him(t);
  const p = P(h.c, h.r)!;
  const s = p.k / BOSS_PX;
  const { i } = frameAt(h.ch, h.anim, h.ms);
  const heart = (h.ch === BI ? BH.HOLLOW_INTRO_HEART[h.anim]![i] : null) ?? HOLLOW_HEART_IDLE[i % HOLLOW_HEART_IDLE.length]!;
  const R = (h.ch === BI ? BH.HOLLOW_INTRO_BALL_R[h.anim]![i] : 0) || 5.5;
  return { x: p.x + (heart[0] - HOLLOW.foot[0]) * s, y: p.y + (heart[1] - HOLLOW.foot[1]) * s, s, R: R * s };
}
const HOLLOW_HEART_IDLE = [0, 0, 0, 1, 1, 1, 0, 0].map((b) => hollowBuild({ bob: b }).heart);
const youAt = (t: number) => {
  const walk = ramp(t, 0, WALK_MS);
  return { c: t >= SWAP ? CLEAR.you : MARK.you, r: WALK_FROM + (MARK.r - WALK_FROM) * walk };
};

// ---- The motes: each from its light to the ball.
type Mote = { kind: string; at: number; x: number; y: number; s: number };
const motes: Mote[] = [];
const hash = (n: number) => ((Math.sin(n * 127.1) * 43758.5453) % 1 + 1) % 1;
for (const [li, L] of LANTERNS.entries()) {
  const pl = placeAt(SHOP.SHOP_HOLLOW_LAYOUT.find((p) => p.col === L.col && p.row === L.row && p.name.startsWith("lantern"))!.name, L.col, L.row);
  const ch = SHOP.SHOP_HOLLOW_PIECES[pl.name]!;
  for (let i = 0; i < 8; i++) {
    const o = onScreen(pl, ch, 18 + (hash(li * 9 + i) - 0.5) * 5, 59 + (hash(li * 7 + i + 3) - 0.5) * 5);
    motes.push({ kind: i < 2 ? "warm-l" : i < 5 ? "warm-m" : "warm-s", at: L.at + 40 + i * 75, x: o.x, y: o.y, s: pl.s });
  }
}
{
  // The string's bulbs, each its own color (the key at its middle), the burnt-out ones giving nothing.
  RUN.forEach((b, i) => {
    const pl = placeAt(b.piece, b.col, b.row);
    const ch = SHOP.SHOP_HOLLOW_PIECES[b.piece]!;
    const k = frameKeys(ch, ch.anims.idle!.frames[0]!);
    let key = "";
    for (let dy = -1; dy <= 1 && !key; dy++) for (let dx = -1; dx <= 1 && !key; dx++) {
      const kk = k[Math.round(b.at[1]) + dy]?.[Math.round(b.at[0]) + dx];
      if (kk && IN.INTRO_HOLLOW_BULB_MOTE[kk]) key = kk;
    }
    if (!key) return;
    const o = onScreen(pl, ch, b.at[0], b.at[1]);
    motes.push({ kind: IN.INTRO_HOLLOW_BULB_MOTE[key]! + (i % 3 === 1 ? "-s" : ""), at: bulbAt(i), x: o.x, y: o.y, s: pl.s });
  });
  // The tree: its lights from the bottom up, the star's last.
  const tp = placeAt("showpiece", 14, 8);
  const tc = SHOP.SHOP_HOLLOW_PIECES["showpiece"]!;
  const cols = ["red", "green", "blue", "gold", "orange", "pink"];
  for (let i = 0; i < 16; i++) {
    const u = i / 15;
    const o = onScreen(tp, tc, 15 + hash(i + 50) * 80 * (1 - u * 0.7) + u * 25, 150 - u * 110);
    motes.push({ kind: cols[i % 6]! + (i % 2 ? "-s" : ""), at: TREE + i * 55, x: o.x, y: o.y, s: tp.s });
  }
  for (let i = 0; i < 3; i++) {
    const o = onScreen(tp, tc, IN.INTRO_HOLLOW_STAR_AT[0], IN.INTRO_HOLLOW_STAR_AT[1]);
    motes.push({ kind: i === 0 ? "star" : "gold", at: TREE + 880 + i * 60, x: o.x, y: o.y, s: tp.s });
  }
  // His own strand, a third at a time (bulbs 2, 5, 8; then 1, 4, 7; then the rest).
  STRAND.forEach((at, third) => {
    const h = him(at);
    const p = P(h.c, h.r)!;
    const s = p.k / BOSS_PX;
    const bulbs = hollowBuild({ crouch: 2, feet: "wide", free: "out", arm: "low", mood: "roar" }).bulbs;
    bulbs.forEach((b, n) => {
      if (n % 3 !== 2 - third && !(third === 2 && n % 3 === 0)) return;
      motes.push({ kind: ["red", "gold", "blue"][n % 3]!, at: at + n * 12, x: p.x + (b[0] + 1.5 - HOLLOW.foot[0]) * s, y: p.y + (b[1] + 3 - HOLLOW.foot[1]) * s, s });
    });
  });
  // Your pawn's light, paler.
  const yp = youAt(PAWN);
  const p = P(yp.c, yp.r)!;
  for (let i = 0; i < 6; i++) motes.push({ kind: i % 2 ? "pawn-s" : "pawn", at: PAWN + 60 + i * 70, x: p.x + (hash(i + 90) - 0.5) * 0.4 * p.k, y: p.y - (0.45 + hash(i + 70) * 0.5) * p.k, s: p.k / SQ });
}
/** Where a mote is `ms` after it left: a curve rising then diving into the ball, faster and faster. */
function moteAt(m: Mote, t: number): { x: number; y: number; done: boolean; dur: number } {
  const tgt = heartAt(t);
  const dist = Math.hypot(tgt.x - m.x, tgt.y - m.y);
  const dur = Math.max(450, Math.min(1000, 380 + dist * 1.6));
  const u = Math.max(0, Math.min(1, (t - m.at) / dur));
  const e = u ** 1.7;
  const mx = (m.x + tgt.x) / 2, my = (m.y + tgt.y) / 2;
  const nx = -(tgt.y - m.y) / (dist || 1), ny = (tgt.x - m.x) / (dist || 1);
  const side = ny < 0 ? 1 : -1; // bow upward
  const cx = mx + nx * side * dist * 0.28, cy = my + ny * side * dist * 0.28;
  const x = (1 - e) ** 2 * m.x + 2 * (1 - e) * e * cx + e * e * tgt.x;
  const y = (1 - e) ** 2 * m.y + 2 * (1 - e) * e * cy + e * e * tgt.y;
  // (It vanishes at the ball's rim.)
  const done = u >= 1 || Math.hypot(x - tgt.x, y - tgt.y) < tgt.R * 0.9;
  return { x, y, done, dur };
}

// ---- Each moment's picture: what's drawn where.
type Up = { img: string; x: number; y: number; s: number; flip: boolean; depth: number; alpha: number; emisAlpha: number };
type Glow = { color: string; x: number; y: number; w: number; h: number; a: number };
interface Plan {
  t: number;
  ups: Up[];
  glows: Glow[];
  dark: number;
  pool: null | { x: number; y: number; rx: number; ry: number; a: number };
  pawn: { x: number; y: number; k: number; depth: number; tint: number; glow: number; tag: number };
  motes: { img: string; x: number; y: number; s: number; glow: string; trail: [number, number][] }[];
  bubble: null | { x: number; y: number; a: number };
  table: null | { x: number; y: number; s: number; depth: number };
}
const MOTE = IN.INTRO_HOLLOW_MOTE;
function plan(t: number): Plan {
  const ups: Up[] = [];
  const glows: Glow[] = [];
  const near = (depth: number) => Math.min(1, (depth - 2) / (3 - 2));
  const black = ramp(t, BLACK, D.blackoutMs);
  for (const pl of places) {
    const a = near(pl.depth);
    if (a <= 0) continue;
    let ch: Character = SHOP.SHOP_HOLLOW_PIECES[pl.name]!;
    let anim = "idle", ms = t, mult = 1;
    if (pl.name.startsWith("lantern")) {
      const st = lanternState(pl, t);
      ch = IN.INTRO_HOLLOW_PIECES[pl.name]!;
      anim = st.anim;
      ms = st.ms;
      mult = st.glow;
    } else if (IN.INTRO_HOLLOW_BULB_PIECES[pl.name]) {
      const n = bulbsGone(pl, t);
      ch = IN.INTRO_HOLLOW_BULB_PIECES[pl.name]!;
      anim = `${pl.flip ? "r" : "l"}${n}`;
      const total = RUN.filter((b) => b.col === pl.col && b.row === pl.row && b.piece === pl.name).length;
      mult = 1 - n / Math.max(1, total);
      if (pl.name === "backdrop" && n > 0) mult = 0;
    } else if (pl.name === "showpiece" && t >= TREE) {
      ch = IN.INTRO_HOLLOW_SHOWPIECE_OUT;
      anim = t < TREE + lenOf(ch, "drain") ? "drain" : "idle";
      ms = t - TREE;
      mult = 1 - treeOut(t);
    }
    const { f, i } = frameAt(ch, anim, ms);
    const img = picture(`${ch.id}|${anim}|${i}`, ch, f, { spots: spotsOf(pl.name) });
    ups.push({ img, x: pl.x, y: pl.y, s: pl.s, flip: pl.flip, depth: pl.depth, alpha: a, emisAlpha: 1 - black });
    // Its light: its pool on the floor, its halo in the air (as ShopRoom's drawGlows).
    const src = SHOP.SHOP_HOLLOW_PIECES[pl.name]!;
    for (const l of SHOP.SHOP_HOLLOW_POOLS.filter((q) => q.piece === pl.name)) {
      const o = onScreen(pl, src, l.x - 0.5, l.y - 0.5);
      glows.push({ color: l.color, x: o.x, y: o.y, w: l.rx * 4 * pl.s, h: l.ry * 4 * pl.s, a: l.strength * a * mult });
    }
    for (const l of SHOP.SHOP_HOLLOW_LIGHTS.filter((q) => q.piece === pl.name && q.halo)) {
      const fl = l.flicker ? 0.85 + 0.1 * Math.sin(t / 170 + pl.col) + 0.05 * Math.sin(t / 53 + pl.row) : 1;
      const o = onScreen(pl, src, l.x + l.w / 2 - 0.5, l.y + l.h / 2 - 0.5);
      const r = l.halo! * pl.s;
      glows.push({ color: l.color, x: o.x, y: o.y, w: 2 * r, h: 2 * r, a: 0.35 * l.strength * fl * a * mult });
    }
  }
  // Him.
  const h = him(t);
  const hp = P(h.c, h.r)!;
  const hs = hp.k / BOSS_PX;
  const { f: hf, i: hi } = frameAt(h.ch, h.anim, h.ms);
  const look = lookAt(t);
  const hkey = picture(`${h.ch.id}|${h.anim}|${hi}|${look}`, h.ch, hf, { look, emisKeys: HIS_LIT });
  ups.push({ img: hkey, x: hp.x, y: hp.y, s: hs, flip: false, depth: hp.depth, alpha: 1, emisAlpha: 1 - black });
  if (black > 0 && t < DIM + 400) {
    // In the black: his eyes alone, dim violet slits.
    const ekey = picture(`${h.ch.id}|${h.anim}|${hi}|eyes`, h.ch, hf, { look, emisKeys: "eE", recolorEmis: D.eyes });
    ups.push({ img: ekey, x: hp.x, y: hp.y, s: hs, flip: false, depth: hp.depth - 0.001, alpha: 0, emisAlpha: black * D.eyesAlpha * (1 - ramp(t, DIM, 400)) });
  }
  // The ball's own violet glow (INTRO_HOLLOW_BALL_GLOW), by his move.
  {
    const bg = (IN.INTRO_HOLLOW_BALL_GLOW as unknown as Record<string, { r: number; a: number } | undefined>)[h.anim];
    if (bg && h.ch === BI) {
      const hh = heartAt(t);
      const pulse = 0.85 + 0.15 * Math.sin(t / 90);
      const r = (bg.r + hh.R / hh.s) * hh.s;
      glows.push({ color: IN.INTRO_HOLLOW_BALL_GLOW.color, x: hh.x, y: hh.y, w: 2 * r, h: 2 * r * 0.9, a: bg.a * pulse * (1 - black) });
    }
  }
  // You.
  const yu = youAt(t);
  const yp = P(yu.c, yu.r)!;
  const pawnGlow = t < PAWN ? 0 : t < PAWN + 150 ? ramp(t, PAWN, 150) : 1 - ramp(t, PAWN + 150, 450);
  // The table, set down in the black.
  const tp = t >= SWAP ? P(TABLE.c, TABLE.r)! : null;
  // The motes in flight.
  const ms: Plan["motes"] = [];
  for (const [n, m] of motes.entries()) {
    if (t < m.at) continue;
    const at = moteAt(m, t);
    if (at.done) {
      // Landing: a flick on the ball's rim.
      const since = t - (m.at + at.dur);
      const land = heartAt(t);
      if (since < 150 && since >= -400 && n % 2 === 0) {
        const { f, i } = frameAt(MOTE, "sip", Math.max(0, since));
        ms.push({ img: picture(`mote|sip|${i}`, MOTE, f), x: land.x + (hash(n) - 0.5) * land.R, y: land.y + (hash(n + 1) - 0.5) * land.R, s: land.s, glow: "#9c6cff", trail: [] });
      }
      continue;
    }
    const { f, i } = frameAt(MOTE, m.kind, t - m.at + n * 23);
    const trail: [number, number][] = [30, 60, 90].map((d) => {
      const q = moteAt(m, Math.max(m.at, t - d));
      return [q.x, q.y];
    });
    ms.push({ img: picture(`mote|${m.kind}|${i}`, MOTE, f), x: at.x, y: at.y, s: Math.max(m.s, 1.2), glow: IN.INTRO_HOLLOW_MOTE_GLOW[m.kind]!, trail });
  }
  const pa = ramp(t, DIM, POOL.inMs);
  const poolC = P(TABLE.c - POOL.west, TABLE.r)!;
  return {
    t,
    ups,
    glows,
    dark: darkLevel(t),
    pool: t >= DIM ? { x: poolC.x, y: poolC.y - POOL.lift * poolC.k, rx: POOL.rx * poolC.k, ry: POOL.ry * poolC.k, a: pa } : null,
    pawn: { x: yp.x, y: yp.y, k: yp.k, depth: yp.depth, tint: t < PAWN ? 0 : ramp(t, PAWN + 100, 500), glow: pawnGlow, tag: 1 - ramp(t, DRINK, 300) },
    motes: ms,
    bubble: t >= LINE[0] && t < LINE[1] ? { x: hp.x, y: hp.y - 76 * hs, a: Math.min(ramp(t, LINE[0], 150), 1 - ramp(t, LINE[1] - 150, 150)) } : null,
    table: tp ? { x: tp.x, y: tp.y, s: tp.k / SQ, depth: tp.depth } : null,
  };
}

// ---- Which moments.
const times = timesArg ? timesArg.split(",").map(Number) : Array.from({ length: Math.floor((END * 15) / 1000) }, (_, n) => Math.round((n * 1000) / 15));
const plans = times.map(plan);
picture("table", PARK_TABLE, PARK_TABLE.anims.idle!.frames[0]!);
const tableTop = TABLE_BOARD.top; // (the slab's top over the table's foot, its pixels: for the stand-in board)

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: W, height: H + HEAD }, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:#000"><canvas id=c></canvas></body></html>`);
await page.evaluate("window.__name = (f) => f");
await page.evaluate(
  ({ imgs, floor, W, H, HEAD, DPR, tone, tint, inner, level, tableTop }) => {
    const w = window as any;
    const out = document.getElementById("c") as HTMLCanvasElement;
    out.width = W * DPR;
    out.height = (H + HEAD) * DPR;
    const og = out.getContext("2d")!;
    const cv = document.createElement("canvas");
    cv.width = W * DPR;
    cv.height = H * DPR;
    const g = cv.getContext("2d")!;
    // The room's header, as the game's: a pale bar, the back button, its name.
    const header = () => {
      og.setTransform(DPR, 0, 0, DPR, 0, 0);
      og.fillStyle = "#f3f1ec";
      og.fillRect(0, 0, W, HEAD);
      og.fillStyle = "#d9d4ca";
      og.fillRect(0, HEAD - 1, W, 1);
      og.fillStyle = "#ffffff";
      og.strokeStyle = "#d9d4ca";
      og.beginPath();
      og.arc(32, HEAD / 2, 17, 0, Math.PI * 2);
      og.fill();
      og.stroke();
      og.strokeStyle = "#1f2530";
      og.lineWidth = 2.2;
      og.beginPath();
      og.moveTo(35, HEAD / 2 - 6);
      og.lineTo(29, HEAD / 2);
      og.lineTo(35, HEAD / 2 + 6);
      og.stroke();
      og.fillStyle = "#1f2530";
      og.font = "800 20px Archivo, Arial, sans-serif";
      og.textBaseline = "middle";
      og.fillText("Hollow Peak", 62, HEAD / 2 + 1);
    };
    const can = (wd: number, ht: number, b64: string) => {
      const c = document.createElement("canvas");
      c.width = wd;
      c.height = ht;
      const bin = atob(b64);
      const a = new Uint8ClampedArray(bin.length);
      for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      c.getContext("2d")!.putImageData(new ImageData(a, wd, ht), 0, 0);
      return c;
    };
    const pics: Record<string, { c: HTMLCanvasElement; e: HTMLCanvasElement | null; w: number; h: number }> = {};
    w.add = (more: Record<string, { w: number; h: number; data: string; emis: string | null }>) => {
      for (const [k, im] of Object.entries(more)) pics[k] = { c: can(im.w, im.h, im.data), e: im.emis ? can(im.w, im.h, im.emis) : null, w: im.w, h: im.h };
    };
    w.add(imgs);
    const foot: Record<string, [number, number]> = w.feet ?? {};
    w.setFeet = (f: Record<string, [number, number]>) => Object.assign(foot, f);
    // The cave's roof (the mockup's and the game's): dark stone fading to black, stalactites.
    const roof = document.createElement("canvas");
    roof.width = W * DPR;
    roof.height = H * DPR;
    {
      const r = roof.getContext("2d")!;
      r.scale(DPR, DPR);
      const sky = r.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#050408");
      sky.addColorStop(1, "#1c1a24");
      r.fillStyle = sky;
      r.fillRect(0, 0, W, H);
      r.fillStyle = "#14121a";
      for (let i = 0; i < 26; i++) {
        const x = (((i * 97) % 41) / 41) * W, y = H * (0.04 + (((i * 53) % 37) / 37) * 0.36), sw = 10 + ((i * 31) % 17);
        r.beginPath();
        r.moveTo(x - sw / 2, y - 30);
        r.lineTo(x + sw / 2, y - 30);
        r.lineTo(x + 1, y + sw * 1.6);
        r.closePath();
        r.fill();
      }
    }
    // The floor, drawn once.
    const fl = document.createElement("canvas");
    fl.width = W * DPR;
    fl.height = H * DPR;
    {
      const f = fl.getContext("2d")!;
      f.scale(DPR, DPR);
      f.imageSmoothingEnabled = false;
      f.fillStyle = "#1e1c25";
      const tri = (img: CanvasImageSource, s: number[][], d: number[][]) => {
        const [[x0, y0], [x1, y1], [x2, y2]] = d as [number[], number[], number[]];
        const [[u0, v0], [u1, v1], [u2, v2]] = s as [number[], number[], number[]];
        f.save();
        f.beginPath();
        const cx = (x0! + x1! + x2!) / 3, cy = (y0! + y1! + y2!) / 3;
        const pad = (x: number, y: number) => [x + Math.sign(x - cx) * 0.6, y + Math.sign(y - cy) * 0.6] as const;
        f.moveTo(...pad(x0!, y0!));
        f.lineTo(...pad(x1!, y1!));
        f.lineTo(...pad(x2!, y2!));
        f.closePath();
        f.clip();
        const den = u0! * (v1! - v2!) + u1! * (v2! - v0!) + u2! * (v0! - v1!);
        const a = (x0! * (v1! - v2!) + x1! * (v2! - v0!) + x2! * (v0! - v1!)) / den;
        const b = (x0! * (u2! - u1!) + x1! * (u0! - u2!) + x2! * (u1! - u0!)) / den;
        const c = (x0! * (u1! * v2! - u2! * v1!) + x1! * (u2! * v0! - u0! * v2!) + x2! * (u0! * v1! - u1! * v0!)) / den;
        const d2 = (y0! * (v1! - v2!) + y1! * (v2! - v0!) + y2! * (v0! - v1!)) / den;
        const e = (y0! * (u2! - u1!) + y1! * (u0! - u2!) + y2! * (u1! - u0!)) / den;
        const ff = (y0! * (u1! * v2! - u2! * v1!) + y1! * (u2! * v0! - u0! * v2!) + y2! * (u0! * v1! - u1! * v0!)) / den;
        f.transform(a, d2, b, e, c, ff);
        f.drawImage(img, 0, 0);
        f.restore();
      };
      for (const op of floor as { img: string; rot: number; q: number[] }[]) {
        const img = pics[op.img]!.c;
        const wd = img.width;
        const src = [[0, 0], [wd, 0], [wd, wd], [0, wd]];
        const s = [0, 1, 2, 3].map((i) => src[(i - op.rot + 4) % 4]!);
        const d = [0, 1, 2, 3].map((i) => [op.q[2 * i]!, op.q[2 * i + 1]!]);
        tri(img, [s[0]!, s[1]!, s[2]!], [d[0]!, d[1]!, d[2]!]);
        tri(img, [s[0]!, s[2]!, s[3]!], [d[0]!, d[2]!, d[3]!]);
      }
    }
    const glowOf = new Map<string, HTMLCanvasElement>();
    const glow = (color: string) => {
      let c = glowOf.get(color);
      if (c) return c;
      c = document.createElement("canvas");
      c.width = c.height = 64;
      const gg = c.getContext("2d")!;
      const grad = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      gg.fillStyle = grad;
      gg.fillRect(0, 0, 64, 64);
      glowOf.set(color, c);
      return c;
    };
    const PAWN = new Path2D("m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z");
    const dk = document.createElement("canvas");
    dk.width = W * DPR;
    dk.height = H * DPR;
    const dg = dk.getContext("2d")!;
    w.draw = (p: any) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.drawImage(roof, 0, 0);
      g.drawImage(fl, 0, 0);
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.imageSmoothingEnabled = false;
      // Upright things far to near: pieces, him, you, the table.
      type Item = { depth: number; draw: (emis: boolean) => void };
      const items: Item[] = [];
      const put = (u: any, emis: boolean) => {
        const pic = pics[u.img]!;
        const c = emis ? pic.e : pic.c;
        if (!c) return;
        const ft = foot[u.img.split("|")[0]]!;
        const fx = u.flip ? pic.w - 1 - ft[0] : ft[0];
        g.save();
        g.globalAlpha = emis ? u.emisAlpha * (u.alpha || 1) : u.alpha;
        g.translate(u.x - fx * u.s, u.y - ft[1] * u.s);
        if (u.flip) {
          g.translate(pic.w * u.s, 0);
          g.scale(-1, 1);
        }
        g.drawImage(c, 0, 0, pic.w * u.s, pic.h * u.s);
        g.restore();
      };
      for (const u of p.ups) items.push({ depth: u.depth, draw: (e) => (u.alpha > 0 || e) && put(u, e) });
      const pw = p.pawn;
      items.push({
        depth: pw.depth,
        draw: (e) => {
          if (e) return;
          const size = 1.45 * pw.k, un = size / 45;
          g.fillStyle = "rgba(13,14,18,0.3)";
          g.beginPath();
          g.ellipse(pw.x, pw.y, size * 0.32, size * 0.32 * 0.35, 0, 0, Math.PI * 2);
          g.fill();
          g.save();
          g.translate(pw.x - 22.5 * un, pw.y - 39.75 * un);
          g.scale(un, un);
          const v = Math.round(255 - 38 * pw.tint);
          g.fillStyle = `rgb(${v},${v},${Math.round(255 - 26 * pw.tint)})`;
          g.strokeStyle = "#000";
          g.lineWidth = 1.5;
          g.fill(PAWN);
          g.stroke(PAWN);
          g.restore();
        },
      });
      if (p.table) {
        const tb = p.table;
        items.push({
          depth: tb.depth,
          draw: (e) => {
            if (e) return;
            put({ img: "table", x: tb.x, y: tb.y, s: tb.s, flip: false, alpha: 1 }, false);
            // A stand-in slab and board on it (the game draws the real ones: render.ts drawBoard), seen from above and in
            // front; across, his pieces on its west files, yours on its east.
            const k = tb.s * 37, top = tb.y - tableTop * tb.s;
            const sw = 0.8 * k, sd = 0.24 * k, th = 3 * tb.s;
            g.fillStyle = "#4b4753";
            g.fillRect(tb.x - sw / 2, top - sd, sw, sd);
            g.fillStyle = "#2d2a33";
            g.fillRect(tb.x - sw / 2, top, sw, th);
            const bw = 0.64 * k, bd = 0.19 * k, bx = tb.x - bw / 2, by = top - sd / 2 - bd / 2;
            for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
              g.fillStyle = (i + j) % 2 ? "#5d5968" : "#cfc9dc";
              g.fillRect(bx + (i * bw) / 8, by + (j * bd) / 8, bw / 8 + 0.4, bd / 8 + 0.4);
            }
            for (const [i0, col, line] of [[0, "#2d2c33", "#0c0c10"], [6, "#f6f1e6", "#2b2622"]] as const)
              for (let j = 0; j < 8; j++) for (let i = i0; i < i0 + 2; i++) {
                const px = bx + ((i + 0.5) * bw) / 8, py = by + ((j + 0.8) * bd) / 8;
                const pw2 = Math.max(1.5, bw / 20), ph = Math.max(3, k * (i === (i0 === 0 ? 0 : 7) ? 0.07 : 0.05));
                g.fillStyle = line;
                g.fillRect(px - pw2 / 2 - 0.5, py - ph - 0.5, pw2 + 1, ph + 1);
                g.fillStyle = col;
                g.fillRect(px - pw2 / 2, py - ph, pw2, ph);
              }
          },
        });
      }
      items.sort((a, b) => b.depth - a.depth);
      for (const it of items) it.draw(false);
      // The dark over everything, the dim pool cut out of it.
      if (p.dark > 0) {
        dg.setTransform(1, 0, 0, 1, 0, 0);
        dg.globalCompositeOperation = "source-over";
        dg.clearRect(0, 0, dk.width, dk.height);
        dg.globalAlpha = p.dark;
        dg.fillStyle = tone;
        dg.fillRect(0, 0, dk.width, dk.height);
        dg.globalAlpha = 1;
        if (p.pool && p.pool.a > 0) {
          dg.setTransform(DPR, 0, 0, DPR, 0, 0);
          dg.globalCompositeOperation = "destination-out";
          dg.save();
          dg.translate(p.pool.x, p.pool.y);
          dg.scale(p.pool.rx, p.pool.ry);
          const gr = dg.createRadialGradient(0, 0, 0, 0, 0, 1);
          for (let i = 0; i <= 10; i++) {
            const u = i / 10;
            const s = u <= inner ? 1 : 1 - ((u - inner) / (1 - inner)) ** 2 * (3 - 2 * ((u - inner) / (1 - inner)));
            gr.addColorStop(u, `rgba(0,0,0,${level * p.pool.a * s})`);
          }
          dg.fillStyle = gr;
          dg.beginPath();
          dg.arc(0, 0, 1, 0, Math.PI * 2);
          dg.fill();
          dg.restore();
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(dk, 0, 0);
        g.setTransform(DPR, 0, 0, DPR, 0, 0);
        if (p.pool && p.pool.a > 0) {
          // The pool's cool tint.
          g.save();
          g.globalCompositeOperation = "multiply";
          g.translate(p.pool.x, p.pool.y);
          g.scale(p.pool.rx, p.pool.ry);
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
          gr.addColorStop(0, tint);
          gr.addColorStop(1, "#ffffff");
          g.globalAlpha = p.pool.a;
          g.fillStyle = gr;
          g.beginPath();
          g.arc(0, 0, 1, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      }
      // The lights' glow, then the lit pixels themselves over the dark.
      g.globalCompositeOperation = "lighter";
      for (const l of p.glows) {
        if (l.a <= 0.003) continue;
        g.globalAlpha = Math.min(1, l.a);
        g.drawImage(glow(l.color), l.x - l.w / 2, l.y - l.h / 2, l.w, l.h);
      }
      if (pw.glow > 0) {
        g.globalAlpha = 0.55 * pw.glow;
        const r = pw.k * 0.9;
        g.drawImage(glow("#e4e0ff"), pw.x - r, pw.y - pw.k * 0.75 - r, 2 * r, 2 * r);
      }
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      if (p.dark > 0) for (const it of items) it.draw(true);
      // The motes: a soft glow, a trail, the mote.
      for (const m of p.motes) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.5;
        const r = 5 * m.s;
        g.drawImage(glow(m.glow), m.x - r, m.y - r, 2 * r, 2 * r);
        m.trail.forEach(([x, y]: [number, number], i: number) => {
          g.globalAlpha = [0.45, 0.28, 0.14][i]!;
          const rr = (2.2 - i * 0.4) * m.s;
          g.drawImage(glow(m.glow), x - rr, y - rr, 2 * rr, 2 * rr);
        });
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        put({ img: m.img, x: m.x, y: m.y, s: m.s, flip: false, alpha: 1 }, false);
      }
      // Your tag; his line.
      if (pw.tag > 0) {
        g.globalAlpha = pw.tag;
        const un = (1.45 * pw.k) / 45;
        g.font = "600 12px Archivo, Arial, sans-serif";
        const tw = g.measureText("Player").width + 16;
        const ty = pw.y - 33 * un;
        g.fillStyle = "rgba(255,215,106,0.96)";
        g.beginPath();
        g.roundRect(pw.x - tw / 2, ty - 22, tw, 20, 10);
        g.fill();
        g.fillStyle = "#1f2530";
        g.textAlign = "center";
        g.fillText("Player", pw.x, ty - 8);
        g.globalAlpha = 1;
      }
      if (p.bubble && p.bubble.a > 0) {
        const b = p.bubble;
        g.globalAlpha = b.a;
        g.font = "600 13px Archivo, Arial, sans-serif";
        const text = "Did you leave a light on?";
        const tw = g.measureText(text).width + 22;
        const bx = Math.max(8, Math.min(W - 8 - tw, b.x - tw / 2));
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.roundRect(bx, b.y - 40, tw, 30, 12);
        g.fill();
        g.beginPath();
        g.moveTo(b.x - 6, b.y - 11);
        g.lineTo(b.x + 6, b.y - 11);
        g.lineTo(b.x, b.y - 2);
        g.fill();
        g.fillStyle = "#1f2530";
        g.textAlign = "center";
        g.fillText(text, bx + tw / 2, b.y - 20);
        g.globalAlpha = 1;
      }
      og.setTransform(1, 0, 0, 1, 0, 0);
      og.drawImage(cv, 0, HEAD * DPR);
      header();
      return out.toDataURL("image/png");
    };
  },
  { imgs, floor, W, H, HEAD, DPR, tone: D.tone, tint: POOL.tint, inner: POOL.inner, level: POOL.level, tableTop },
);
// Each picture's foot, by its character id.
const feet: Record<string, readonly [number, number]> = { table: PARK_TABLE.foot, mote: MOTE.foot };
for (const ch of [...Object.values(SHOP.SHOP_HOLLOW_PIECES), ...Object.values(IN.INTRO_HOLLOW_PIECES), HOLLOW, BI]) feet[ch.id] = ch.foot;
await page.evaluate((f) => (window as any).setFeet(f), feet);
const ms: number[] = [];
for (const [n, p] of plans.entries()) {
  const url = (await page.evaluate((p) => (window as any).draw(p), p as never)) as string;
  const name = timesArg ? `t${p.t}` : `f${String(n).padStart(3, "0")}`;
  writeFileSync(`${dir}/${name}.png`, Buffer.from(url.split(",")[1]!, "base64"));
  ms.push(Math.round(1000 / 15));
}
if (!timesArg) writeFileSync(`${dir}/ms.txt`, ms.join("\n"));
await browser.close();
console.log(plans.length, "pictures,", Object.keys(imgs).length, "drawings; ends", END, "ms");
