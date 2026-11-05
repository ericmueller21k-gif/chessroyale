/**
 * The street town's mockup renderer (Nov 5), bundled by view.ts and run in Chromium: the town's own camera (town/camera.ts:
 * the curve, the pitch, the zoomed-in default), its sky (town/sky-draw.ts, with day, dusk and its tint and lights), its real
 * art (the homes, the Colosseum and its statues, the park's trees, benches, lamps, tables and fountain, the bosses, your pawn)
 * at the town's scale, and the rough everyday fronts (facades.ts), on the plan (plan.ts). Mockup only, not game code.
 *
 * What's new against the game's renderer (render.ts), and what a build would need:
 *  - The camera turns: a heading (0 north, 90 east). World squares are turned into the camera's frame before `proj`.
 *  - Buildings are flat fronts standing on their lot's front line (a plane in the world, drawn in thin upright strips so
 *    they follow the curve and foreshorten as the camera turns), not billboards that always face the camera. People, trees
 *    and lamps stay billboards, as today.
 *  - The near side (between the camera and you): `open` draws no buildings there (only low hedges and lamps); `cut` draws a
 *    near row cut away low (its backs), for the comparison.
 */
import { enterOf, hazeMix, newPt, newView, proj, setView, radial, tableLift, type TableLift, type View } from "../../../packages/app/src/town/camera.ts";
import { TOWN_FEEL } from "../../../packages/app/src/town/feel.ts";
import { SkyPainter } from "../../../packages/app/src/town/sky-draw.ts";
import { mixLights, mixMist, mixRGB, mixTint, type SkyWeights } from "../../../packages/app/src/town/sky.ts";
import { frameKeys, renderFrame, type Character } from "../../../packages/app/src/characters/sprite.ts";
import { HOUSES, COLISEUM_ART } from "../../../packages/app/src/town/houses/index.ts";
import { statueSpot } from "../../../packages/app/src/town/houses/coliseum.ts";
import { statueArt } from "../../../packages/app/src/town/houses/statues.ts";
import { PARK_BENCH, PARK_FOUNTAIN, PARK_LAMP, PARK_LAMP_LIGHTS, PARK_TABLE, PARK_TREES, TABLE_BOARD } from "../../../packages/app/src/town/houses/park.ts";
import type { LightSpot } from "../../../packages/app/src/town/houses/kit.ts";
import { GINGERBREAD } from "../../../packages/app/src/characters/gingerbread.ts";
import { GREX } from "../../../packages/app/src/characters/grex.ts";
import { HOLLOW } from "../../../packages/app/src/characters/hollow.ts";
import { MOO } from "../../../packages/app/src/characters/moo.ts";
import { ALFIL } from "../../../packages/app/src/characters/alfil.ts";
import { BIGBOY } from "../../../packages/app/src/characters/bigboy.ts";
import { CLOWN } from "../../../packages/app/src/characters/clown.ts";
import { GARDENER } from "../../../packages/app/src/characters/gardener.ts";
import { HOPPER } from "../../../packages/app/src/characters/hopper.ts";
import { PIG } from "../../../packages/app/src/characters/pig.ts";
import { SAWYER } from "../../../packages/app/src/characters/sawyer.ts";
import { SMUDGY } from "../../../packages/app/src/characters/smudgy.ts";
import { TIGER_FIGURE } from "../../../packages/app/src/characters/tiger-figure.ts";
import { FOLIO } from "../../../packages/app/src/characters/folio.ts";
import { HOUSE_TIMBER, HOUSE_TIMBER_LIGHTS } from "../out/house-timber/house-timber.ts";
import { HOUSE_BLITZ, HOUSE_BLITZ_LIGHTS } from "../out/house-blitz/house-blitz.ts";
import { ARENA, BOARD, COLISEUM, GARDEN, GRASS, HOME_INFO, LOT, LOTS, N, PAVE, PROPS, ground, wrap, wrapF, type HomeId, type Lot } from "./plan.ts";
import { bed, bush, facade, hedge, shed, type Facade } from "./facades.ts";

const SQ = TOWN_FEEL.housePxPerSquare;
const BOSS: Partial<Record<HomeId, Character>> = {
  tiger: TIGER_FIGURE, gingerbread: GINGERBREAD, grex: GREX, hollow: HOLLOW, moo: MOO, clown: CLOWN, bigboy: BIGBOY,
  sawyer: SAWYER, pig: PIG, smudgy: SMUDGY, hopper: HOPPER, gardener: GARDENER, alfil: ALFIL, folio: FOLIO,
};

export interface Scene {
  W: number;
  H: number;
  /** Where you stand (the camera's focus), and the camera's heading in degrees (0 north, 90 east). */
  x: number;
  y: number;
  heading: number;
  sky: SkyWeights;
  near: "open" | "cut";
  /** Extra buildings on the near side for the `cut` comparison (their backs face the camera). */
  nearRow?: Lot[];
  /** Bosses out by their homes, bots: where they stand (squares) and which way they face. */
  bosses?: { id: HomeId; x: number; y: number; flip?: boolean }[];
  bots?: { x: number; y: number; dark?: boolean }[];
  /** Draw the wrap seam as a dotted line on the ground (c = 0 and r = 0 edges). */
  seam?: boolean;
  /** A caption in the top left (mockups only). */
  caption?: string;
}

// ---- Pictures as canvases (made once).
const canv = new Map<string, HTMLCanvasElement>();
function toCanvas(key: string, ch: Character): HTMLCanvasElement {
  let c = canv.get(key);
  if (c) return c;
  const r = renderFrame(ch, ch.anims.idle!.frames[0]!);
  c = document.createElement("canvas");
  c.width = r.w;
  c.height = r.h;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
  canv.set(key, c);
  return c;
}
/** The same picture as a flat silhouette in one color (the haze laid over it). */
function silhouette(key: string, src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const k = `${key}#sil${color}`;
  let c = canv.get(k);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  canv.set(k, c);
  return c;
}
/** A picture's lights (its windows, doorways and lanterns) as a glow canvas: its lit pixels and a soft spill round them. */
function glowOf(key: string, ch: Character, spots: readonly LightSpot[]): HTMLCanvasElement | null {
  const k = `${key}#glow`;
  if (canv.has(k)) return canv.get(k)!;
  if (!spots.length) return null;
  const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
  const lit = document.createElement("canvas");
  lit.width = ch.w;
  lit.height = ch.h;
  const g = lit.getContext("2d")!;
  for (const s of spots) {
    g.fillStyle = s.color;
    g.globalAlpha = Math.min(1, s.strength);
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const kk = keys[s.y + y]?.[s.x + x];
        if (!kk || (s.keys !== undefined && !s.keys.includes(kk))) continue;
        g.fillRect(s.x + x, s.y + y, 1, 1);
      }
  }
  const c = document.createElement("canvas");
  c.width = ch.w;
  c.height = ch.h;
  const h = c.getContext("2d")!;
  h.filter = "blur(3px)";
  h.globalAlpha = 0.9;
  h.drawImage(lit, 0, 0);
  h.filter = "none";
  h.globalAlpha = 1;
  h.drawImage(lit, 0, 0);
  canv.set(k, c);
  return c;
}

/** A plane's picture: its canvas, its foot (picture pixels), its lights, its back (made from its silhouette). */
interface Art {
  key: string;
  img: HTMLCanvasElement;
  foot: readonly [number, number];
  glow: HTMLCanvasElement | null;
  /** Where the game writes a home's name on its sign (picture pixels). */
  sign?: { x: number; y: number; w: number; h: number };
}
function artOfLot(l: Lot): Art {
  if (l.kind === "home") {
    const id = l.id as HomeId;
    const h = id === "timber" ? { ch: HOUSE_TIMBER, lights: HOUSE_TIMBER_LIGHTS } : id === "blitz" ? { ch: HOUSE_BLITZ, lights: HOUSE_BLITZ_LIGHTS } : HOUSES[id as keyof typeof HOUSES];
    const key = `home-${id}`;
    const sign = id === "timber" || id === "blitz" ? undefined : HOUSES[id as keyof typeof HOUSES].sign;
    return { key, img: toCanvas(key, h.ch), foot: h.ch.foot, glow: glowOf(key, h.ch, h.lights), sign };
  }
  const f: Facade = facade(l.id as never, l.w, l.v);
  const key = f.ch.id;
  return { key, img: toCanvas(key, f.ch), foot: f.ch.foot, glow: glowOf(key, f.ch, f.lights) };
}
/** A building's back as the near row's cut-away shows it: its silhouette in a darker wall color, cut off `cut` px above its foot, a lit cap on the cut. */
function backOf(a: Art, cut: number): HTMLCanvasElement {
  const k = `${a.key}#back${cut}`;
  if (canv.has(k)) return canv.get(k)!;
  const src = a.img;
  const w = src.width, h = src.height;
  const d = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  // Its wall color: the commonest light opaque color in its middle band.
  let rs = 0, gs = 0, bs = 0, n = 0;
  for (let y = Math.floor(h * 0.45); y < h * 0.8; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (d[o + 3]! > 200 && d[o]! + d[o + 1]! + d[o + 2]! > 330) (rs += d[o]!, gs += d[o + 1]!, bs += d[o + 2]!, n++); }
  const wall = n ? [rs / n, gs / n, bs / n] : [190, 170, 150];
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const top = a.foot[1] - cut;
  for (let y = Math.max(0, top); y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (d[o + 3]! < 128) continue;
      // Keep only the building's own width (its opaque run in the cut row, so fences and yard bits stay low anyway).
      const edge = x === 0 || x === w - 1 || d[o - 4 + 3]! < 128 || d[o + 4 + 3]! < 128;
      const cap = y - top < 2;
      const sh = y - top < 4 ? 0.8 : 0.72;
      g.fillStyle = edge ? "#2a2118" : cap ? "rgb(247,241,227)" : `rgb(${wall[0]! * sh | 0},${wall[1]! * sh | 0},${wall[2]! * sh | 0})`;
      g.fillRect(x, y, 1, 1);
    }
  canv.set(k, c);
  return c;
}
/** A corner lot's side wall (on Seam Avenue): a plain wall in the building's colors, a window or two, its roof's edge. */
function sideOf(a: Art, depthPx: number): Art {
  const k = `${a.key}#side`;
  if (canv.has(k)) return { key: k, img: canv.get(k)!, foot: [0, a.foot[1]], glow: canv.get(k + "#glow") ?? null };
  const src = a.img;
  const w = src.width, h = src.height;
  const d = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  // Its height: the picture's tallest opaque column in its middle half; its wall color as for the back.
  let top = h;
  for (let y = 0; y < h && top === h; y++) for (let x = Math.floor(w * 0.25); x < w * 0.75; x++) if (d[(y * w + x) * 4 + 3]! > 200) { top = y; break; }
  let rs = 0, gs = 0, bs = 0, n = 0;
  for (let y = Math.floor(h * 0.45); y < h * 0.8; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (d[o + 3]! > 200 && d[o]! + d[o + 1]! + d[o + 2]! > 330) (rs += d[o]!, gs += d[o + 1]!, bs += d[o + 2]!, n++); }
  const wall = n ? [rs / n, gs / n, bs / n] : [190, 170, 150];
  const c = document.createElement("canvas");
  c.width = depthPx;
  c.height = h;
  const g = c.getContext("2d")!;
  const wallTop = top + Math.round((a.foot[1] - top) * 0.28);
  const col = (m: number) => `rgb(${wall[0]! * m | 0},${wall[1]! * m | 0},${wall[2]! * m | 0})`;
  g.fillStyle = "#2a2118";
  g.fillRect(0, wallTop - 1, depthPx, a.foot[1] - wallTop + 2);
  g.fillStyle = col(0.86);
  g.fillRect(1, wallTop, depthPx - 2, a.foot[1] - wallTop);
  // The roof's edge seen from the side: a darker band, a little lighter on top.
  g.fillStyle = "#2a2118";
  g.fillRect(0, top + 4, depthPx, wallTop - top - 3);
  g.fillStyle = "#7a5a48";
  g.fillRect(1, top + 5, depthPx - 2, wallTop - top - 5);
  g.fillStyle = "#9a7660";
  g.fillRect(1, top + 5, depthPx - 2, 2);
  const lit = document.createElement("canvas");
  lit.width = depthPx;
  lit.height = h;
  const lg = lit.getContext("2d")!;
  for (let wy = wallTop + 8; wy < a.foot[1] - 22; wy += 26)
    for (let wx = 10; wx < depthPx - 18; wx += 34) {
      g.fillStyle = "#2a2118";
      g.fillRect(wx - 1, wy - 1, 14, 18);
      g.fillStyle = "#f7f1e3";
      g.fillRect(wx, wy, 12, 16);
      g.fillStyle = "#3b4d6b";
      g.fillRect(wx + 1, wy + 1, 10, 14);
      g.fillStyle = "#8fb4d9";
      g.fillRect(wx + 1, wy + 1, 4, 5);
      lg.fillStyle = "#ffb85c";
      lg.fillRect(wx + 1, wy + 1, 10, 14);
    }
  canv.set(k, c);
  const glow = document.createElement("canvas");
  glow.width = depthPx;
  glow.height = h;
  const gg = glow.getContext("2d")!;
  gg.filter = "blur(3px)";
  gg.drawImage(lit, 0, 0);
  gg.filter = "none";
  gg.drawImage(lit, 0, 0);
  canv.set(k + "#glow", glow);
  return { key: k, img: c, foot: [0, a.foot[1]], glow };
}

// ---- The camera, turned.
const v: View = newView();
const pt = newPt();
let cs = 1, sn = 0, camX = 0, camY = 0;
/** A world point (squares) into the camera's frame: (dx across, dz ahead), the shortest way round the wrap. */
function rel(x: number, y: number): [number, number] {
  const ex = wrapF(x - camX);
  const ey = wrapF(y - camY);
  return [ex * cs - ey * sn, ex * sn + ey * cs];
}
const P = (x: number, y: number, lift = 0) => {
  // (No wrapping here: callers pass points already the nearest way round, or rel's wrap would split a plane at the seam.)
  const ex = x - camX, ey = y - camY;
  const [dx, dz] = Math.abs(ex) > N / 2 || Math.abs(ey) > N / 2 ? rel(x, y) : [ex * cs - ey * sn, ex * sn + ey * cs];
  return proj(v, dx, dz, lift, pt) ? { x: pt.x, y: pt.y, k: pt.k, depth: pt.depth, dx, dz } : null;
};

const SQ_LIGHT = [238, 197, 139], SQ_DARK = [173, 128, 88];
const PAVE_LIGHT = [222, 214, 198], PAVE_DARK = [203, 194, 177];
const GRASS_LIGHT = [128, 184, 84], GRASS_DARK = [113, 170, 74];
const GARDEN_LIGHT = [118, 168, 80], GARDEN_DARK = [108, 158, 72];
const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((x, i) => x + (b[i]! - x) * t);
const rgb = (c: readonly number[]) => `rgb(${c[0]! | 0},${c[1]! | 0},${c[2]! | 0})`;

const sky = new SkyPainter();
let strips = 0;
interface Item {
  depth: number;
  draw: () => void;
}

export async function draw(cv: HTMLCanvasElement, s: Scene): Promise<{ figures: { name: string; x0: number; y0: number; x1: number; y1: number }[] }> {
  const DPR = 2;
  cv.width = s.W * DPR;
  cv.height = s.H * DPR;
  cv.style.width = `${s.W}px`;
  cv.style.height = `${s.H}px`;
  const g = cv.getContext("2d")!;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.imageSmoothingEnabled = false;
  const th = (s.heading * Math.PI) / 180;
  cs = Math.cos(th);
  sn = Math.sin(th);
  camX = s.x;
  camY = s.y;
  setView(v, s.W, s.H, 0);
  const skyh = mixRGB(s.sky, (c) => c.sky[4]!);
  const horizon = rgb(skyh);
  const mist = mixMist(s.sky);
  const lightK = mixLights(s.sky);
  const figures: { name: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  strips = 0;

  // The sky: the town's own. Its clouds slide as the camera turns (as if you'd walked a long way sideways); the sun stays.
  sky.resize(s.W, s.H, DPR);
  sky.setWeights(s.sky);
  const turnShift = ((s.heading / 90) * s.W * 1.3) / (v.kf * TOWN_FEEL.cloudParallax);
  sky.draw(g as never, v, s.x + turnShift, s.y, 0, 0);

  // Under the rim: the skirt (the horizon's color, a little ground in it).
  g.fillStyle = rgb(mix(SQ_LIGHT, skyh, 0.85));
  g.beginPath();
  g.moveTo(-10, s.H + 10);
  for (let i = 0; i < v.rimN; i++) g.lineTo(v.rimPx[i]!, v.rimPy[i]!);
  g.lineTo(s.W + 10, s.H + 10);
  g.closePath();
  g.fill();

  // ---- The ground: every square inside the rim, far rows first.
  const seamHalf = 0.5 * Math.SQRT2 * Math.min(1.4, Math.max(0.5, v.kf * 0.022));
  const squares: { d: number; q: number[]; fill: string; seam: string }[] = [];
  const R = Math.min(22, Math.ceil(v.rim * Math.max(1, v.rimX)) + 2);
  const c0 = Math.round(s.x), r0 = Math.round(s.y);
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      const c = c0 + i, r = r0 + j;
      // Its corners from its middle (unwrapped), so a square never straddles the wrap.
      const ex = c - s.x, ey = r - s.y;
      const T = (ax: number, ay: number): [number, number] => [ax * cs - ay * sn, ax * sn + ay * cs];
      const [mdx, mdz] = T(ex, ey);
      if (radial(v, mdx, mdz) > v.rim + 0.7 || mdz < -v.back - 1) continue;
      const q: number[] = [];
      let ok = true;
      for (const [ox, oy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
        const [dx, dz] = T(ex + ox!, ey + oy!);
        if (!proj(v, dx, dz, 0, pt)) { ok = false; break; }
        q.push(pt.x, pt.y);
      }
      if (!ok) continue;
      // Past the curve (the ground facing away there): its far edge no higher on screen than its near edge.
      const [fdx, fdz] = T(ex + sn * 0.5, ey + cs * 0.5), [ndx, ndz] = T(ex - sn * 0.5, ey - cs * 0.5);
      if (!proj(v, fdx, fdz, 0, pt)) continue;
      const fyy = pt.y;
      if (!proj(v, ndx, ndz, 0, pt) || fyy >= pt.y - 0.15) continue;
      const xs = [q[0]!, q[2]!, q[4]!, q[6]!], ys = [q[1]!, q[3]!, q[5]!, q[7]!];
      if (Math.max(...xs) < 0 || Math.min(...xs) > s.W || Math.min(...ys) > s.H) continue;
      const gk = ground[wrap(r) * N + wrap(c)]!;
      const alt = (wrap(c) + wrap(r)) & 1;
      let base = gk === PAVE ? (alt ? PAVE_DARK : PAVE_LIGHT) : gk === GRASS ? (alt ? GRASS_DARK : GRASS_LIGHT) : gk === GARDEN || gk === LOT ? (alt ? GARDEN_DARK : GARDEN_LIGHT) : alt ? SQ_DARK : SQ_LIGHT;
      if (gk === ARENA) base = base.map((x) => x * 0.9);
      const t = Math.min(1, Math.max(0, hazeMix(v, mdx, mdz, mist)));
      const f = mix(base, skyh, t);
      const dd = gk === GRASS || gk === GARDEN || gk === LOT ? 0.95 : gk === PAVE ? 0.84 : 0.86;
      proj(v, mdx, mdz, 0, pt);
      squares.push({ d: pt.depth, q, fill: rgb(f), seam: rgb(f.map((x) => x * (dd + (1 - dd) * t))) });
    }
  squares.sort((a, b) => b.d - a.d);
  for (const sq of squares) {
    const q = sq.q;
    g.fillStyle = sq.seam;
    g.beginPath();
    g.moveTo(q[0]!, q[1]!);
    g.lineTo(q[2]!, q[3]!);
    g.lineTo(q[4]!, q[5]!);
    g.lineTo(q[6]!, q[7]!);
    g.closePath();
    g.fill();
    if (q[7]! - q[1]! >= TOWN_FEEL.seamMinPx) {
      const cx = (q[0]! + q[2]! + q[4]! + q[6]!) / 4, cy = (q[1]! + q[3]! + q[5]! + q[7]!) / 4;
      g.fillStyle = sq.fill;
      g.beginPath();
      for (let i = 0; i < 8; i += 2) {
        const dx = cx - q[i]!, dy = cy - q[i + 1]!;
        const tt = Math.min(0.45, seamHalf / (Math.hypot(dx, dy) || 1));
        if (i === 0) g.moveTo(q[i]! + dx * tt, q[i + 1]! + dy * tt);
        else g.lineTo(q[i]! + dx * tt, q[i + 1]! + dy * tt);
      }
      g.closePath();
      g.fill();
    }
  }
  // The haze strip under the horizon (as render.ts's drawHorizonHaze).
  {
    const d = s.H * TOWN_FEEL.horizonHaze;
    const L = 10;
    g.lineJoin = "round";
    g.lineWidth = d / L + 0.6;
    for (let i = 0; i < L; i++) {
      const off = ((i + 0.5) * d) / L;
      g.strokeStyle = `rgba(${skyh[0]! | 0},${skyh[1]! | 0},${skyh[2]! | 0},${(0.75 * Math.pow(1 - i / L, 1.7)).toFixed(3)})`;
      g.beginPath();
      g.moveTo(v.rimPx[0]!, v.rimPy[0]! + off);
      for (let j = 1; j < v.rimN; j++) g.lineTo(v.rimPx[j]!, v.rimPy[j]! + off);
      g.stroke();
    }
  }
  if (s.seam) {
    // The wrap seam: where c and r run from 45 back to 0 (mockup mark only: in the game nothing shows).
    g.save();
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 2.5;
    g.setLineDash([7, 6]);
    const lines: ((t: number) => [number, number])[] = [(t) => [-0.5, s.y + t], (t) => [s.x + t, -0.5]];
    for (const line of lines) {
      g.beginPath();
      let on = false;
      for (let t = -16; t <= 16; t += 0.25) {
        const [x, y] = line(t);
        const [dx, dz] = rel(x, y);
        if (radial(v, dx, dz) > v.rim || !proj(v, dx, dz, 0, pt)) { on = false; continue; }
        if (!on) g.moveTo(pt.x, pt.y); else g.lineTo(pt.x, pt.y);
        on = true;
      }
      g.stroke();
    }
    g.restore();
  }

  // ---- Things: planes (fronts, sides, the near row's backs) and billboards (props, people), far to near.
  const items: Item[] = [];
  const glows: (() => void)[] = [];
  const tags: (() => void)[] = [];
  const near = (dz: number) => dz < -0.9; // between the camera and you

  /** A flat picture standing on the line from (ox, oy) along (ux, uy), facing (nx, ny). */
  function plane(a: Art, ox: number, oy: number, ux: number, uy: number, nx: number, ny: number, opts: { back?: boolean; cut?: number; name?: string; lots?: boolean } = {}) {
    const w = a.img.width;
    // Its origin the nearest way round the wrap from the camera (so a plane never straddles the seam: its strips are offsets from it).
    {
      const mx0 = ox + (ux * w) / 2 / SQ, my0 = oy + (uy * w) / 2 / SQ;
      ox += camX + wrapF(mx0 - camX) - mx0;
      oy += camY + wrapF(my0 - camY) - my0;
    }
    const mx = ox + (ux * w) / 2 / SQ, my = oy + (uy * w) / 2 / SQ;
    const m = P(mx, my);
    const [mdx, mdz] = rel(mx, my);
    if (radial(v, mdx, mdz) > v.rim + w / 2 / SQ + 1) return;
    // The camera's position, to tell its front from its back.
    const camWX = camX - sn * v.back, camWY = camY - cs * v.back;
    const facingCam = (mx - camWX) * nx + (my - camWY) * ny < 0;
    if (!opts.back && !facingCam) return;
    if (opts.back && facingCam) return;
    const STEP = 2;
    const depth = m ? m.depth : 1e9;
    items.push({
      depth,
      draw: () => {
        const img = opts.back ? backOf(a, opts.cut ?? 34) : a.img;
        const sil = silhouette(a.key + (opts.back ? "b" : ""), img, `rgb(${skyh[0]! | 0},${skyh[1]! | 0},${skyh[2]! | 0})`);
        let prev: ReturnType<typeof P> = null;
        for (let i = 0; i <= w; i += STEP) {
          const u = opts.back ? w - i : i; // a back is seen mirrored
          const p = P(ox + (ux * u) / SQ, oy + (uy * u) / SQ);
          if (prev && p && Math.abs(p.dx - prev.dx) < 1 && Math.abs(p.dz - prev.dz) < 1) {
            const i0 = opts.back ? u : u - STEP;
            const x0 = Math.min(prev.x, p.x), x1 = Math.max(prev.x, p.x);
            const dzm = (prev.dz + p.dz) / 2, dxm = (prev.dx + p.dx) / 2;
            if (opts.lots !== false && !opts.back && near(dzm)) { prev = p; continue; }
            const enter = enterOf(v, dxm, dzm);
            if (enter <= 0 || dzm < -v.back + 0.6) { prev = p; continue; }
            const sc = (prev.k + p.k) / 2 / SQ;
            const fy = (prev.y + p.y) / 2;
            const y0 = fy - a.foot[1] * sc;
            const hh = img.height * sc;
            const ww = x1 - x0 + 0.6;
            g.globalAlpha = enter;
            g.drawImage(img, i0, 0, STEP, img.height, x0, y0, ww, hh);
            strips++;
            const hz = Math.min(1, Math.max(0, hazeMix(v, dxm, dzm, mist)));
            if (hz > 0.01) {
              g.globalAlpha = enter * hz;
              g.drawImage(sil, i0, 0, STEP, img.height, x0, y0, ww, hh);
            }
          }
          prev = p;
        }
        g.globalAlpha = 1;
      if (a.glow && !opts.back && lightK > 0.01) {
        g.save();
        g.globalCompositeOperation = "lighter";
        let prev: ReturnType<typeof P> = null;
        for (let i = 0; i <= w; i += STEP) {
          const p = P(ox + (ux * i) / SQ, oy + (uy * i) / SQ);
          if (prev && p && Math.abs(p.dx - prev.dx) < 1 && Math.abs(p.dz - prev.dz) < 1) {
            const dzm = (prev.dz + p.dz) / 2;
            if (near(dzm)) { prev = p; continue; }
            const sc = (prev.k + p.k) / 2 / SQ;
            const fy = (prev.y + p.y) / 2;
            g.globalAlpha = lightK * enterOf(v, (prev.dx + p.dx) / 2, dzm);
            g.drawImage(a.glow!, i - STEP, 0, STEP, a.glow!.height, Math.min(prev.x, p.x), fy - a.foot[1] * sc, Math.abs(p.x - prev.x) + 0.6, a.glow!.height * sc);
          }
          prev = p;
        }
      g.restore();
      }
        g.globalAlpha = 1;
      },
    });
    if (opts.name && m && !near(mdz) && Math.hypot(mdx, mdz) < 7.5 && facingCam) {
      const sc = m.k / SQ;
      const top = m.y - a.foot[1] * sc;
      // Its sign: the game writes the name on it.
      if (a.sign) {
        const sg = a.sign;
        const p0 = P(ox + (ux * sg.x) / SQ, oy + (uy * sg.x) / SQ), p1 = P(ox + (ux * (sg.x + sg.w)) / SQ, oy + (uy * (sg.x + sg.w)) / SQ);
        if (p0 && p1) {
          const k = (p0.k + p1.k) / 2 / SQ;
          const fy = (p0.y + p1.y) / 2;
          items.push({ depth: depth - 0.001, draw: () => signText(g, opts.name!, Math.min(p0.x, p1.x), fy - (a.foot[1] - sg.y) * k, Math.abs(p1.x - p0.x), sg.h * k) });
        }
      }
      tags.push(() => nameTag(g, opts.name!, m.x, top - 6));
    }
  }
  function billboard(key: string, ch: Character, x: number, y: number, opts: { squaresTall?: number; flip?: boolean; fade?: boolean; glow?: readonly LightSpot[]; name?: string } = {}) {
    const [dx, dz] = rel(x, y);
    if (radial(v, dx, dz) > v.rim || dz < -v.back + 0.6) return;
    const p = P(x, y);
    if (!p) return;
    const img = toCanvas(key, ch);
    const sc = opts.squaresTall ? (opts.squaresTall * p.k) / ch.h : p.k / SQ;
    let alpha = enterOf(v, dx, dz);
    // Near the camera, a tall thing (a tree) would cover you: it fades out (as the shops' near pieces do).
    if (opts.fade && dz < -0.5) alpha *= Math.max(0, 1 + (dz + 0.5) / 1.5);
    if (alpha <= 0.01) return;
    const x0 = p.x - (opts.flip ? ch.w - ch.foot[0] : ch.foot[0]) * sc;
    const y0 = p.y - ch.foot[1] * sc;
    items.push({
      depth: p.depth,
      draw: () => {
        g.globalAlpha = alpha;
        g.save();
        g.translate(x0, y0);
        if (opts.flip) (g.translate(ch.w * sc, 0), g.scale(-1, 1));
        g.drawImage(img, 0, 0, ch.w * sc, ch.h * sc);
        const hz = Math.min(1, Math.max(0, hazeMix(v, dx, dz, mist)));
        if (hz > 0.01) {
          g.globalAlpha = alpha * hz;
          g.drawImage(silhouette(key, img, horizon), 0, 0, ch.w * sc, ch.h * sc);
        }
        g.restore();
        g.globalAlpha = 1;
      },
    });
    if (opts.glow && lightK > 0.01) {
      const gl = glowOf(key, ch, opts.glow);
      if (gl) glows.push(() => ((g.globalAlpha = lightK * alpha), g.drawImage(gl, x0, y0, ch.w * sc, ch.h * sc)));
    }
    if (opts.name) {
      // Its drawn pixels' box (not its frame's), mirrored if it faces left.
      const d = img.getContext("2d")!.getImageData(0, 0, img.width, img.height).data;
      let bx0 = img.width, by0 = img.height, bx1 = 0, by1 = 0;
      for (let yy = 0; yy < img.height; yy++) for (let xx = 0; xx < img.width; xx++) if (d[(yy * img.width + xx) * 4 + 3]! > 40) ((bx0 = Math.min(bx0, xx)), (by0 = Math.min(by0, yy)), (bx1 = Math.max(bx1, xx + 1)), (by1 = Math.max(by1, yy + 1)));
      const [lx0, lx1] = opts.flip ? [ch.w - bx1, ch.w - bx0] : [bx0, bx1];
      figures.push({ name: opts.name, x0: x0 + lx0 * sc, y0: y0 + by0 * sc, x1: x0 + lx1 * sc, y1: y0 + by1 * sc });
    }
  }

  // The lots: fronts on their front lines (a home's half a square back, so its yard stays off the sidewalk).
  const lots = [...LOTS, ...(s.nearRow ?? [])];
  for (const l of lots) {
    const a = artOfLot(l);
    const w = a.img.width / SQ;
    const inset = l.kind === "home" ? 0.45 : l.kind === "tall" ? 0.3 : 0.12;
    const name = l.kind === "home" ? HOME_INFO[l.id as HomeId].name : undefined;
    if ((l as Lot & { back?: boolean }).back) {
      // A near-row lot (the `cut` comparison): its front faces north, away from the camera; we see its back, cut away.
      const cx = l.c0 + l.w / 2 - 0.5;
      const fy = l.r0 + l.d - 0.5 - inset;
      if (s.near === "cut") plane(a, cx + w / 2, fy, -1, 0, 0, 1, { back: true, cut: 30 });
      continue;
    }
    if (l.facing === "S") {
      const cx = l.c0 + l.w / 2 - 0.5;
      plane(a, cx - w / 2, l.r0 - 0.5 + inset, 1, 0, 0, -1, { name });
      if (l.side) plane(sideOf(a, l.d * SQ), l.c0 - 0.5, l.r0 - 0.5 + l.d, 0, -1, -1, 0, {});
    } else {
      const cy = l.r0 + l.w / 2 - 0.5;
      plane(a, l.c0 - 0.5 + inset, cy + w / 2, 0, -1, -1, 0, { name });
    }
  }
  // The Colosseum: its front on its ground's front edge (r 27.5), its statues on its apron (in its picture, as the game does).
  {
    const key = "coliseum";
    let img = canv.get(key + "#withStatues");
    if (!img) {
      const base = toCanvas(key, COLISEUM_ART.ch);
      img = document.createElement("canvas");
      img.width = base.width;
      img.height = base.height;
      const cg = img.getContext("2d")!;
      cg.drawImage(base, 0, 0);
      for (const id of ["marble", "bronze"] as const) {
        const st = toCanvas(`statue-${id}`, statueArt(id, 1));
        const at = statueSpot(id);
        cg.drawImage(st, at[0], at[1]);
      }
      canv.set(key + "#withStatues", img);
    }
    const a: Art = { key: key + "#withStatues", img, foot: COLISEUM_ART.ch.foot, glow: glowOf(key, COLISEUM_ART.ch, COLISEUM_ART.lights) };
    const cx = COLISEUM.c0 + (COLISEUM.size - 1) / 2;
    plane(a, cx - img.width / 2 / SQ, COLISEUM.r0 - 0.5, 1, 0, 0, -1, { lots: false });
  }
  // The props.
  const trees = PARK_TREES;
  const inNear = (x: number, y: number) => (s.nearRow ?? []).some((l) => wrapF(x - l.c0 + 0.5) >= 0 && wrapF(x - l.c0 + 0.5) <= l.w && wrapF(y - l.r0 + 0.5) >= 0 && wrapF(y - l.r0 + 0.5) <= l.d + 0.5);
  for (const pr of PROPS) {
    if ((pr.kind === "hedge" || pr.kind === "bush" || pr.kind === "shed" || pr.kind === "bed") && inNear(pr.x, pr.y)) continue;
    const [dx, dz] = rel(pr.x, pr.y);
    if (radial(v, dx, dz) > v.rim + 1) continue;
    if (pr.kind === "tree") billboard(`tree${pr.v}`, trees[pr.v]!, pr.x, pr.y, { fade: true });
    else if (pr.kind === "bench") billboard("bench", PARK_BENCH, pr.x, pr.y);
    else if (pr.kind === "table") (billboard("table", PARK_TABLE, pr.x, pr.y), tableTop(pr.x, pr.y));
    else if (pr.kind === "fountain") billboard("fountain", PARK_FOUNTAIN, pr.x, pr.y);
    else if (pr.kind === "lamp") billboard("lamp", PARK_LAMP, pr.x, pr.y, { glow: PARK_LAMP_LIGHTS });
    else if (pr.kind === "hedge") billboard(`hedge${pr.v}`, hedge(pr.v), pr.x, pr.y);
    else if (pr.kind === "bush") billboard(`bush${pr.v}`, bush(pr.v), pr.x, pr.y);
    else if (pr.kind === "shed") billboard(`shed${pr.v}`, shed(pr.v), pr.x, pr.y);
    else if (pr.kind === "bed") billboard(`bed${pr.v}`, bed(pr.v), pr.x, pr.y);
  }
  /** A chess table's top (a stand-in for the game's drawBoard: the slab and the board's 8 x 8 squares, no pieces). */
  function tableTop(x: number, y: number) {
    const [dx, dz] = rel(x, y);
    if (radial(v, dx, dz) > v.rim || dz < -v.back + 0.6) return;
    const L: TableLift = { dz: 0, top: 0, thick: 0, grow: 1 };
    if (!tableLift(v, dx, dz, TABLE_BOARD.top, TABLE_BOARD.thick, L)) return;
    const foot = newPt();
    if (!proj(v, dx, dz, 0, foot)) return;
    const at = newPt();
    if (!proj(v, dx, L.dz, 0, at)) return;
    const m = foot.k / at.k, tx = foot.x - at.x * m, ty = foot.y - at.y * m;
    const corner = (u: number, w: number, lift: number) => (proj(v, dx + u, L.dz + w, lift, pt) ? [pt.x * m + tx, pt.y * m + ty] : null);
    const depth = foot.depth - 0.002;
    items.push({
      depth,
      draw: () => {
        const hs = TABLE_BOARD.half;
        const q = [corner(-hs, hs, L.top), corner(hs, hs, L.top), corner(hs, -hs, L.top), corner(-hs, -hs, L.top)];
        const f = [corner(-hs, -hs, L.top), corner(hs, -hs, L.top), corner(hs, -hs, L.top - L.thick), corner(-hs, -hs, L.top - L.thick)];
        if (q.some((c) => !c) || f.some((c) => !c)) return;
        const poly = (pts: number[][], fill: string) => {
          g.fillStyle = fill;
          g.beginPath();
          pts.forEach(([a, b], i) => (i ? g.lineTo(a!, b!) : g.moveTo(a!, b!)));
          g.closePath();
          g.fill();
          g.strokeStyle = "#2a2118";
          g.lineWidth = 1;
          g.stroke();
        };
        poly(f as number[][], "#9a958c");
        poly(q as number[][], "#d8d2c4");
        const hb = TABLE_BOARD.board, sq = (2 * hb) / 8;
        for (let gi = 0; gi < 8; gi++)
          for (let fi = 0; fi < 8; fi++) {
            const c4 = [corner(-hb + fi * sq, -hb + gi * sq, L.top), corner(-hb + (fi + 1) * sq, -hb + gi * sq, L.top), corner(-hb + (fi + 1) * sq, -hb + (gi + 1) * sq, L.top), corner(-hb + fi * sq, -hb + (gi + 1) * sq, L.top)];
            if (c4.some((c) => !c)) continue;
            g.fillStyle = (fi + gi) % 2 ? "#f6f1e6" : "#6b5a4a";
            g.beginPath();
            c4.forEach((c, i) => (i ? g.lineTo(c![0]!, c![1]!) : g.moveTo(c![0]!, c![1]!)));
            g.closePath();
            g.fill();
          }
      },
    });
  }
  // The Colosseum seen from afar (as render.ts drawFarColiseum): past the rim, sunk behind the curve, only its top over the horizon.
  {
    const cx = COLISEUM.c0 + (COLISEUM.size - 1) / 2, fy = COLISEUM.r0 - 0.5;
    const [dx, dz] = rel(cx, fy);
    const Rr = radial(v, dx, dz);
    if (dz > 0 && Rr > v.rim && Rr <= v.rim + TOWN_FEEL.farReach && cs > 0.7) {
      const t = (v.rim - 0.05) / Rr;
      if (proj(v, dx * t, dz * t, 0, pt)) {
        const k = pt.k * (v.rim / Rr);
        const px = k / SQ;
        const img = canv.get("coliseum#withStatues")!;
        const ch = COLISEUM_ART.ch;
        const x0 = pt.x - ch.foot[0] * px;
        const y0 = pt.y + (Rr - v.rim) * TOWN_FEEL.farSink * k - ch.foot[1] * px;
        items.push({
          depth: 1e6,
          draw: () => {
            g.save();
            g.beginPath();
            g.moveTo(v.rimPx[0]!, -10);
            for (let i = 0; i < v.rimN; i++) g.lineTo(v.rimPx[i]!, v.rimPy[i]!);
            g.lineTo(v.rimPx[v.rimN - 1]!, -10);
            g.closePath();
            g.clip();
            g.globalAlpha = Math.min(1, Math.max(0, (v.rim + TOWN_FEEL.farReach - Rr) / 2));
            g.drawImage(img, x0, y0, ch.w * px, ch.h * px);
            g.globalAlpha *= TOWN_FEEL.farHaze;
            g.drawImage(silhouette("coliseum#withStatues", img, horizon), x0, y0, ch.w * px, ch.h * px);
            g.restore();
          },
        });
      }
    }
  }
  // The bosses by their homes, the bots, you.
  for (const b of s.bosses ?? []) {
    const ch = BOSS[b.id];
    if (!ch) continue;
    billboard(`boss-${b.id}`, ch, b.x, b.y, { squaresTall: TOWN_FEEL.bossSquares * (TOWN_FEEL.bossScale[b.id] ?? 1), flip: b.flip, name: HOME_INFO[b.id].boss });
  }
  const pawn = (x: number, y: number, dark: boolean, you: boolean) => {
    const p = P(x, y);
    if (!p) return;
    const size = (you ? TOWN_FEEL.youSquares : TOWN_FEEL.botSquares) * p.k;
    const u = size / 45;
    const x0 = p.x - 22.5 * u, y0 = p.y - 39.75 * u;
    figures.push({ name: you ? "you" : "bot", x0: x0 + 11 * u, y0: y0 + 9 * u, x1: x0 + 34 * u, y1: p.y });
    items.push({
      depth: p.depth,
      draw: () => {
        g.fillStyle = "rgba(13,14,18,0.3)";
        g.beginPath();
        g.ellipse(p.x, p.y, size * 0.32, size * 0.11, 0, 0, Math.PI * 2);
        g.fill();
        g.save();
        g.translate(x0, y0);
        g.scale(u, u);
        g.fillStyle = dark ? "#1b1b1f" : "#ffffff";
        g.strokeStyle = "#000";
        g.lineWidth = 1.5;
        g.fill(PAWN);
        g.stroke(PAWN);
        g.restore();
      },
    });
    if (you) tags.push(() => youTag(g, p.x, y0 + 9 * u - 4));
  };
  for (const b of s.bots ?? []) pawn(b.x, b.y, !!b.dark, false);
  pawn(s.x, s.y, false, true);

  items.sort((a, b) => b.depth - a.depth);
  for (const it of items) it.draw();
  g.globalAlpha = 1;
  const tint = mixTint(s.sky);
  if (tint[3] > 0.004) {
    g.fillStyle = `rgba(${tint[0] | 0},${tint[1] | 0},${tint[2] | 0},${tint[3].toFixed(3)})`;
    g.fillRect(0, 0, s.W, s.H);
  }
  if (glows.length) {
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const gl of glows) gl();
    g.restore();
  }
  g.globalAlpha = 1;
  for (const t of tags) t();
  if (s.caption) caption(g, s.caption, s.W);
  return { figures, strips, planes: items.length };
}

const PAWN = new Path2D("m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z");
function youTag(g: CanvasRenderingContext2D, x: number, y: number) {
  g.font = "700 12px Archivo, Arial, sans-serif";
  const tw = g.measureText("You").width + 14;
  g.fillStyle = "rgba(255,215,106,0.96)";
  g.beginPath();
  g.roundRect(x - tw / 2, y - 18, tw, 17, 8.5);
  g.fill();
  g.fillStyle = "#1f2530";
  g.textAlign = "center";
  g.fillText("You", x, y - 5.5);
  g.textAlign = "left";
}
function nameTag(g: CanvasRenderingContext2D, text: string, x: number, y: number) {
  g.font = "900 13px 'Archivo Black', Arial Black, Arial, sans-serif";
  const half = g.measureText(text).width / 2 + 6;
  x = Math.max(half, Math.min(g.canvas.width / 2 - half, x));
  g.textAlign = "center";
  g.lineWidth = 4;
  g.strokeStyle = "rgba(31,37,48,0.85)";
  g.strokeText(text, x, y);
  g.fillStyle = "#ffffff";
  g.fillText(text, x, y);
  g.textAlign = "left";
}
function signText(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number) {
  g.save();
  let size = Math.max(4, Math.min(h * 0.62, 14));
  g.font = `900 ${size}px 'Archivo Black', Arial Black, Arial, sans-serif`;
  while (g.measureText(text).width > w * 0.92 && size > 3) (size -= 0.5), (g.font = `900 ${size}px 'Archivo Black', Arial Black, Arial, sans-serif`);
  g.fillStyle = "#2a2118";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x + w / 2, y + h / 2 + 0.5);
  g.restore();
}
function caption(g: CanvasRenderingContext2D, text: string, W: number) {
  g.font = "700 13px Archivo, Arial, sans-serif";
  const lines = text.split("\n");
  const tw = Math.min(W - 16, Math.max(...lines.map((l) => g.measureText(l).width)) + 16);
  g.fillStyle = "rgba(20,22,30,0.72)";
  g.beginPath();
  g.roundRect(8, 8, tw, 10 + lines.length * 17, 8);
  g.fill();
  g.fillStyle = "#fff";
  lines.forEach((l, i) => g.fillText(l, 16, 25 + i * 17));
}

/**
 * The everyday buildings' sheet: each design in two colors (2x, flat front on), then how they tile wall to wall: Seam
 * Street's west row as the plan has it (plus its corner side wall), with the bigger buildings behind it, as an elevation.
 */
export function sheet(cv: HTMLCanvasElement): void {
  const Z = 2;
  const designs = [["cottage", 3], ["townhouse", 2], ["skinny", 3], ["flats", 3], ["bakery", 3], ["shop", 2], ["block", 4], ["tower", 2]] as const;
  const names: Record<string, string> = { cottage: "Cottage (3 wide)", townhouse: "Townhouse (2)", skinny: "Skinny houses (3, or 2)", flats: "Small flats (3)", bakery: "Bakery and cafe (3)", shop: "Corner shop (2)", block: "Big block, behind (4)", tower: "Clock tower, behind (2)" };
  const cellW = 4 * SQ * Z + 24;
  const rowH = 200 * Z + 40;
  const W = 4 * cellW * 2 + 40;
  const elevH = 560;
  const H = 70 + 2 * rowH + elevH + 40;
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#f4efe4";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#2a2a2a";
  g.font = "700 30px Arial, sans-serif";
  g.fillText("Everyday buildings: eight rough fronts (each in two colors), and how they tile", 24, 44);
  designs.forEach(([id, wsq], n) => {
    const col = n % 4, row = Math.floor(n / 4);
    for (let k = 0; k < 2; k++) {
      const f = facade(id, wsq, k * 2 + (n % 2));
      const img = toCanvas(f.ch.id, f.ch);
      const x0 = 20 + (col * 2 + k) * cellW;
      const base = 70 + row * rowH + 200 * Z;
      g.fillStyle = "#d8d4cc";
      g.fillRect(x0, base - 6, cellW - 20, 10);
      g.drawImage(img, x0 + (cellW - 20 - img.width * Z) / 2, base - f.ch.foot[1] * Z, img.width * Z, img.height * Z);
      if (k === 0) {
        g.fillStyle = "#2a2a2a";
        g.font = "700 22px Arial, sans-serif";
        g.fillText(names[id]!, x0, base + 30);
      }
    }
  });
  // The elevation: Seam Street, c 3..20, its row and the bigger buildings behind it (drawn smaller and higher: farther off).
  const ey = 70 + 2 * rowH + elevH - 30;
  g.fillStyle = "#2a2a2a";
  g.font = "700 22px Arial, sans-serif";
  g.fillText("Wall to wall: Seam Street's row from c 3 to c 20 as the plan has it (Puddles' and Smudgy's homes among them), the bigger buildings behind, flat front on", 24, 70 + 2 * rowH + 30);
  const Ze = 1.5;
  const sky = g.createLinearGradient(0, ey - 470, 0, ey);
  sky.addColorStop(0, "#7fb8ee");
  sky.addColorStop(1, "#d4ecfa");
  g.fillStyle = sky;
  g.fillRect(20, ey - 470, 18 * SQ * Ze * 1.55 + 40, 470);
  const ex = (c: number) => 40 + (c - 3) * SQ * Ze * 1.55;
  for (const l of LOTS.filter((l) => l.street === "seam-st" && l.c0 >= 3 && l.c0 + l.w <= 21).sort((a, b) => (a.kind === "tall" ? -1 : 1) - (b.kind === "tall" ? -1 : 1))) {
    const a = artOfLot(l);
    const far = l.kind === "tall" ? 0.85 : 1;
    const s = Ze * 1.55 * far;
    const cx = ex(l.c0 + l.w / 2);
    const fy = l.kind === "tall" ? ey - 38 : ey;
    if (l.kind === "tall") {
      g.globalAlpha = 1;
      g.drawImage(a.img, cx - (a.img.width * s) / 2, fy - a.foot[1] * s, a.img.width * s, a.img.height * s);
    } else g.drawImage(a.img, cx - (a.img.width * s) / 2, fy - a.foot[1] * s, a.img.width * s, a.img.height * s);
  }
  g.fillStyle = "#cfc8b8";
  g.fillRect(20, ey, 18 * SQ * Ze * 1.55 + 40, 14);
  g.fillStyle = "#2a2a2a";
  g.font = "16px Arial, sans-serif";
  for (let c = 3; c <= 21; c++) {
    g.fillRect(ex(c - 0.5), ey + 14, 1, 8);
    if (c <= 20) g.fillText(String(c), ex(c) - 8, ey + 38);
  }
}

(window as unknown as { townStreet: unknown }).townStreet = { draw, facade, toCanvas, hedge, bush, sheet };
