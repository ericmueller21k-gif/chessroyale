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
import { ARENA, BOARD, COLISEUM, GARDEN, GRASS, HOME_INFO, LOT, LOTS, N, PAVE, PROPS, ground, wrap, wrapF, type HomeId, type Lot } from "./plan.ts";
import { building, COLOURWAYS, DESIGN_NAMES, type Design } from "../out/town-buildings/buildings.ts";
import { homeBox, HOME_SPECS } from "../out/town-buildings/home-boxes.ts";
import { bed, bush, hedgeFront, hedgeTop, HEDGE, shed, sidewalkTile } from "../out/town-buildings/dressing.ts";
import { roofTile, type Face, type TownBox } from "../out/town-buildings/town-kit.ts";

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
  /** More lots to draw (the sheets' showcases), and `only`: draw just those (no plan, props or Colosseum). */
  lots?: Lot[];
  only?: boolean;
  /** Props to draw in `only` mode; `noYou`: no pawn of yours (the sheets). */
  props?: typeof PROPS;
  noYou?: boolean;
  /** A closer lens (the sheets' showcases: setView's mag). */
  mag?: number;
  /** Bosses out by their homes, bots: where they stand (squares) and which way they face. */
  bosses?: { id: HomeId; x: number; y: number; flip?: boolean }[];
  bots?: { x: number; y: number; dark?: boolean }[];
  /** Draw the wrap seam as a dotted line on the ground (c = 0 and r = 0 edges). */
  seam?: boolean;
  /** The flat fronts only, as the first mockups had them (the before for Eric's comparison). */
  flat?: boolean;
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

/** A plane's picture: its canvas, its foot (picture pixels), its lights. */
interface Art {
  key: string;
  img: HTMLCanvasElement;
  foot: readonly [number, number];
  glow: HTMLCanvasElement | null;
  /** Where the game writes a home's name on its sign (picture pixels). */
  sign?: { x: number; y: number; w: number; h: number };
  box?: TownBox;
}
const artOfBox = (b: TownBox): Art => ({ key: b.id, img: toCanvas(b.id, b.front), foot: b.front.foot, glow: glowOf(b.id, b.front, b.lights), sign: b.sign, box: b });
function artOfLot(l: Lot): Art {
  return artOfBox(l.kind === "home" ? homeBox(l.id as HomeId) : building(l.id as Design, l.w, l.v));
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
let quads = 0;
let fillPx = 0;
interface Item {
  depth: number;
  draw: () => void;
}

export async function draw(cv: HTMLCanvasElement, s: Scene): Promise<{ figures: { name: string; x0: number; y0: number; x1: number; y1: number }[]; strips: number; quads: number; fill: number; planes: number }> {
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
  setView(v, s.W, s.H, 0, s.mag ?? 1);
  const skyh = mixRGB(s.sky, (c) => c.sky[4]!);
  const horizon = rgb(skyh);
  const mist = mixMist(s.sky);
  const lightK = mixLights(s.sky);
  const figures: { name: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  strips = 0;
  quads = 0;
  fillPx = 0;

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
  const squares: { d: number; q: number[]; fill: string; seam: string; kerb?: number[]; kerbFill?: string }[] = [];
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
      // A sidewalk square (dressing.ts sidewalkTile): four slabs, and a granite kerb on any edge it shares with the street.
      let kerb: number[] | undefined;
      if (gk === PAVE) {
        kerb = [];
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dc, dr], e) => { if (ground[wrap(r + dr!) * N + wrap(c + dc!)] === BOARD) kerb!.push(e); });
      }
      squares.push({ d: pt.depth, q, fill: rgb(f), seam: rgb(f.map((x) => x * (dd + (1 - dd) * t))), kerb, kerbFill: rgb(mix([150, 144, 132], skyh, t)) });
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
      if (sq.kerb) {
        const M = (a: number, b: number) => [(q[a * 2]! + q[b * 2]!) / 2, (q[a * 2 + 1]! + q[b * 2 + 1]!) / 2];
        g.strokeStyle = sq.seam;
        g.lineWidth = Math.max(0.6, seamHalf * 1.2);
        g.beginPath();
        const [a0, a1] = [M(0, 1), M(2, 3)], [b0, b1] = [M(1, 2), M(3, 0)];
        g.moveTo(a0[0]!, a0[1]!); g.lineTo(a1[0]!, a1[1]!);
        g.moveTo(b0[0]!, b0[1]!); g.lineTo(b1[0]!, b1[1]!);
        g.stroke();
        for (const e of sq.kerb) {
          const i0 = e, i1 = (e + 1) % 4, i2 = (e + 2) % 4, i3 = (e + 3) % 4;
          const k = 5 / 37;
          const L = (a: number, b: number) => [q[a * 2]! + (q[b * 2]! - q[a * 2]!) * k, q[a * 2 + 1]! + (q[b * 2 + 1]! - q[a * 2 + 1]!) * k];
          const p1 = L(i1, i2), p0 = L(i0, i3);
          g.fillStyle = sq.kerbFill!;
          g.beginPath();
          g.moveTo(q[i0 * 2]!, q[i0 * 2 + 1]!);
          g.lineTo(q[i1 * 2]!, q[i1 * 2 + 1]!);
          g.lineTo(p1[0]!, p1[1]!);
          g.lineTo(p0[0]!, p0[1]!);
          g.closePath();
          g.fill();
        }
      }
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
  let lowOk = false;

  /** A flat picture standing on the line from (ox, oy) along (ux, uy), facing (nx, ny). */
  function plane(a: Art, ox: number, oy: number, ux: number, uy: number, nx: number, ny: number, opts: { back?: boolean; cut?: number; name?: string; lots?: boolean; shade?: number } = {}) {
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
            fillPx += ww * hh;
            if (opts.shade) {
              g.globalAlpha = enter * opts.shade;
              g.drawImage(silhouette(a.key, img, "#1a1410"), i0, 0, STEP, img.height, x0, y0, ww, hh);
            }
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

  /** A roof tile's pixels (its palette's colours), made once per tile and palette. */
  const tilePx = (tex: Face["tex"], pal: Readonly<Record<string, string>>, pkey: string): Uint8ClampedArray => {
    const k = `tile-${tex}-${pkey}`;
    let c = canv.get(k);
    if (!c) {
      const ch = roofTile(tex, { ...pal }, `${tex}-${pkey}`);
      const r = renderFrame(ch, ch.anims.idle!.frames[0]!);
      c = document.createElement("canvas");
      c.width = r.w;
      c.height = r.h;
      c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
      canv.set(k, c);
    }
    return c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  };

  /**
   * A building as a box (town-kit.ts TownBox): its sides (pictures standing back from the front's body edges, shaded as the
   * town is lit: from the top left), a back wall if it has one, its roof faces (each textured with its tile, shaded by which
   * way it faces, sorted far to near). The front's line runs from (ox, oy) along (ux, uy); (bx, by) points back.
   */
  function box(a: Art, ox: number, oy: number, ux: number, uy: number, bx: number, by: number) {
    const B = a.box!;
    const D = B.depth;
    const key = a.key;
    {
      const mx0 = ox + (ux * a.img.width) / 2 / SQ, my0 = oy + (uy * a.img.width) / 2 / SQ;
      ox += camX + wrapF(mx0 - camX) - mx0;
      oy += camY + wrapF(my0 - camY) - my0;
    }
    const x0 = B.body.x0, x1 = B.body.x1;
    const cxp = (x0 + x1) / 2;
    const W = (x: number, t: number): [number, number] => {
      const xx = cxp + (x - cxp) * (1 - t * (1 - B.taper));
      return [ox + (ux * xx) / SQ + bx * t * D, oy + (uy * xx) / SQ + by * t * D];
    };
    const mid = P(...W(cxp, 0.5));
    if (!mid) return;
    const front = P(...W(cxp, 0));
    const nearOk = lowOk;
    const nearB = (dz: number) => !nearOk && near(dz);
    if (!front || nearB(front.dz)) return;
    const camRight = [cs, -sn];
    const shadeOf = (nx: number, ny: number) => (nx * camRight[0]! + ny * camRight[1]! < 0 ? 0.06 : 0.3);
    const wall = (from: [number, number], to: [number, number], ch: Character, lights: readonly LightSpot[], nx: number, ny: number, tag: string, shade?: number) => {
      const L = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const k = L / (ch.w / SQ);
      const sk = `${key}#${tag}`;
      const sa: Art = { key: sk, img: toCanvas(sk, ch), foot: ch.foot[0] ? [0, ch.foot[1]] : ch.foot, glow: glowOf(sk, ch, lights) };
      plane(sa, from[0], from[1], ((to[0] - from[0]) / L) * k, ((to[1] - from[1]) / L) * k, nx, ny, { shade: shade ?? shadeOf(nx, ny) });
    };
    if (B.left) wall(W(x0, 1), W(x0, 0), B.left.ch, B.left.lights, -ux, -uy, "L");
    if (B.right) wall(W(x1, 0), W(x1, 1), B.right.ch, B.right.lights, ux, uy, "R");
    if (B.back) wall(W(x0, 1), W(x1, 1), B.back.ch, B.back.lights, -bx, -by, "B", 0.18);
    // The roof faces.
    const Q = (u: number, t: number, hp: number) => {
      const p = P(...W(u, t));
      if (!p) return null;
      return { x: p.x, y: p.y - (hp * p.k) / SQ, dx: p.dx, dz: p.dz, depth: p.depth };
    };
    const pkey = key;
    const Dpx = D * SQ;
    // The light, in the camera's frame (x right, y ahead, z up): from the top left and a little in front.
    const LX = -0.5, LY = -0.35, LZ = 0.79;
    const faceItems = B.roof.map((f) => {
      const pts = f.pts.length === 3 ? [f.pts[0]!, f.pts[1]!, f.pts[2]!, f.pts[2]!] : f.pts;
      // Its normal in the world (u along the front, t back, h up; squares), oriented up (or toward the camera).
      const wp = pts.map(([u, t, h]) => { const [wx, wy] = W(u, t); return [wx, wy, h / SQ] as const; });
      const e1 = [wp[1]![0] - wp[0]![0], wp[1]![1] - wp[0]![1], wp[1]![2] - wp[0]![2]];
      const e2 = [wp[3]![0] - wp[0]![0], wp[3]![1] - wp[0]![1], wp[3]![2] - wp[0]![2]];
      let n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      if (Math.hypot(n[0]!, n[1]!, n[2]!) < 1e-6) {
        const e3 = [wp[2]![0] - wp[0]![0], wp[2]![1] - wp[0]![1], wp[2]![2] - wp[0]![2]];
        n = [e1[1]! * e3[2]! - e1[2]! * e3[1]!, e1[2]! * e3[0]! - e1[0]! * e3[2]!, e1[0]! * e3[1]! - e1[1]! * e3[0]!];
      }
      const nl = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
      n = n.map((x) => x / nl);
      // Into the camera's frame.
      let ncx = n[0]! * cs - n[1]! * sn, ncy = n[0]! * sn + n[1]! * cs, ncz = n[2]!;
      if (ncz < -0.05 || (Math.abs(ncz) <= 0.05 && ncy > 0)) ((ncx = -ncx), (ncy = -ncy), (ncz = -ncz));
      const lit = Math.max(0.55, Math.min(1.12, 0.74 + 0.36 * (ncx * LX + ncy * LY + ncz * LZ)));
      const cen = pts.reduce((s2, p) => [s2[0]! + p[0] / 4, s2[1]! + p[1] / 4, s2[2]! + p[2] / 4], [0, 0, 0]);
      const cq = Q(cen[0]!, cen[1]!, cen[2]!);
      return { f, pts, lit, depth: cq ? cq.depth : 0 };
    });
    faceItems.sort((p, q) => q.depth - p.depth);
    // (3D lengths of a face's two edges from its first corner, in px: the tile's two axes.)
    const len = (a0: readonly number[], a1: readonly number[]) => Math.hypot(a1[0]! - a0[0]!, (a1[1]! - a0[1]!) * Dpx, a1[2]! - a0[2]!);
    items.push({
      depth: mid.depth,
      draw: () => {
        const hzMid = Math.min(1, Math.max(0, hazeMix(v, mid.dx, mid.dz, mist)));
        const ink = `rgba(42,33,24,${(0.85 * (1 - hzMid)).toFixed(2)})`;
        for (const it of faceItems) {
          const { f, pts, lit } = it;
          const px = tilePx(f.tex, B.roofPal, pkey);
          const lA = len(pts[0]!, pts[1]!), lB = len(pts[0]!, pts[3]!);
          const nA = Math.max(1, Math.min(28, Math.ceil(lA / 3))), nB = Math.max(1, Math.min(28, Math.ceil(lB / 3)));
          const at = (s1: number, r1: number) => {
            const p0 = pts[0]!, p1 = pts[1]!, p2 = pts[2]!, p3 = pts[3]!;
            const lerp = (i: number) => (1 - s1) * (1 - r1) * p0[i]! + s1 * (1 - r1) * p1[i]! + s1 * r1 * p2[i]! + (1 - s1) * r1 * p3[i]!;
            return Q(lerp(0), lerp(1), lerp(2));
          };
          const grid: (ReturnType<typeof Q>)[][] = [];
          for (let i = 0; i <= nA; i++) {
            const row: ReturnType<typeof Q>[] = [];
            for (let j = 0; j <= nB; j++) row.push(at(i / nA, j / nB));
            grid.push(row);
          }
          for (let i = 0; i < nA; i++)
            for (let j = 0; j < nB; j++) {
              const q = [grid[i]![j]!, grid[i + 1]![j]!, grid[i + 1]![j + 1]!, grid[i]![j + 1]!];
              if (q.some((p) => !p || nearB(p.dz) || p.dz < -v.back + 0.6)) continue;
              const qq = q as NonNullable<ReturnType<typeof Q>>[];
              if (Math.max(...qq.map((p) => p.dx)) - Math.min(...qq.map((p) => p.dx)) > 6) continue;
              const dxm = (qq[0]!.dx + qq[2]!.dx) / 2, dzm = (qq[0]!.dz + qq[2]!.dz) / 2;
              const e = enterOf(v, dxm, dzm);
              if (e <= 0) continue;
              // The tile's pixel at the cell's middle: rows along t use edge B as the tile's x.
              const sA = ((i + 0.5) / nA) * lA, sB = ((j + 0.5) / nB) * lB;
              const [tx, ty] = f.rows === "t" ? [sB, sA] : [sA, sB];
              const o = ((((Math.floor(ty) % 37) + 37) % 37) * 37 + (((Math.floor(tx) % 37) + 37) % 37)) * 4;
              if (px[o + 3]! < 10) continue;
              const hz = Math.min(1, Math.max(0, hazeMix(v, dxm, dzm, mist)));
              const col = mix([px[o]! * lit, px[o + 1]! * lit, px[o + 2]! * lit].map((x) => Math.min(255, x)), skyh, hz);
              quads++;
              let area = 0;
              for (let k2 = 0; k2 < 4; k2++) area += qq[k2]!.x * qq[(k2 + 1) % 4]!.y - qq[(k2 + 1) % 4]!.x * qq[k2]!.y;
              fillPx += Math.abs(area) / 2;
              g.globalAlpha = e;
              g.fillStyle = rgb(col);
              g.strokeStyle = rgb(col);
              g.lineWidth = 0.6;
              g.beginPath();
              qq.forEach((p, k2) => (k2 ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
              g.closePath();
              g.fill();
              g.stroke();
            }
          g.globalAlpha = 1;
          // Its ink edge (not on a dome's or a vault's own seams); a flat roof's parapet rim.
          if (!f.soft && enterOf(v, mid.dx, mid.dz) > 0.6) {
            const e = f.pts.map((p) => Q(p[0], p[1], p[2]));
            if (e.every((p) => p && !nearB(p.dz) && p.dz > -v.back + 0.6) && Math.max(...e.map((p) => p!.dx)) - Math.min(...e.map((p) => p!.dx)) < 6) {
              g.strokeStyle = ink;
              g.lineWidth = 1;
              g.beginPath();
              e.forEach((p, k2) => (k2 ? g.lineTo(p!.x, p!.y) : g.moveTo(p!.x, p!.y)));
              g.closePath();
              g.stroke();
              if (f.rim) {
                const cxr = e.reduce((s2, p) => s2 + p!.x, 0) / e.length, cyr = e.reduce((s2, p) => s2 + p!.y, 0) / e.length;
                g.strokeStyle = `rgba(247,241,227,${(0.9 * (1 - hzMid)).toFixed(2)})`;
                g.lineWidth = 1.6;
                g.beginPath();
                e.forEach((p, k2) => { const xx = p!.x + (cxr - p!.x) * 0.06, yy = p!.y + (cyr - p!.y) * 0.12; if (k2) g.lineTo(xx, yy); else g.moveTo(xx, yy); });
                g.closePath();
                g.stroke();
              }
            }
          }
        }
      },
    });
  }

  /**
   * A square of hedge (dressing.ts): its front a plane facing the street, its top a face over its depth, so it turns with
   * the street instead of stepping. `EW`: along an east-west street, its face toward the camera on the south (y - deep); `NS`: along Seam
   * Avenue's west side (its front facing west).
   */
  function hedgeRun(x: number, y: number, hv: number, dir: "EW" | "NS") {
    const fch = hedgeFront(hv);
    const key = `hedge-${hv}`;
    const a: Art = { key, img: toCanvas(key, fch), foot: fch.foot, glow: null };
    const d = HEDGE.deep;
    const tb: TownBox = {
      id: key, front: fch, lights: [], lot: { w: 1, d: 1 }, inset: 0, depth: d, body: { x0: 0, x1: 37 }, left: null, right: null,
      roof: [{ pts: [[0, 0, HEDGE.tall], [37, 0, HEDGE.tall], [37, 1, HEDGE.tall], [0, 1, HEDGE.tall]], tex: "hedge", rows: "u", soft: true }],
      roofPal: hedgeTop(hv).palette, taper: 1,
    };
    a.box = tb;
    if (dir === "EW") {
      plane(a, x - 0.5, y - d, 1, 0, 0, -1, { lots: false });
      boxLow(a, x - 0.5, y - d, 1, 0, 0, 1);
    } else {
      plane(a, x - d, y + 0.5, 0, -1, -1, 0, { lots: false });
      boxLow(a, x - d, y + 0.5, 0, -1, 1, 0);
    }
  }
  /** A low box's roof faces only, drawn on the near side too (a hedge's top). */
  function boxLow(a: Art, ox: number, oy: number, ux: number, uy: number, bx: number, by: number) {
    lowOk = true;
    box(a, ox, oy, ux, uy, bx, by);
    lowOk = false;
  }

  // The lots: fronts on their front lines (inset on the lot: a home's 0.45, so its yard stays off the sidewalk), boxes behind.
  const lots = s.only ? [...(s.lots ?? [])] : [...LOTS, ...(s.lots ?? []), ...(s.nearRow ?? [])];
  for (const l of lots) {
    const a = artOfLot(l);
    const w = a.img.width / SQ;
    const inset = a.box!.inset;
    const name = l.kind === "home" ? HOME_INFO[l.id as HomeId].name : undefined;
    if ((l as Lot & { back?: boolean }).back) {
      const cx = l.c0 + l.w / 2 - 0.5;
      const fy = l.r0 + l.d - 0.5 - inset;
      if (s.near === "cut") plane(a, cx + w / 2, fy, -1, 0, 0, 1, { back: true, cut: 30 });
      continue;
    }
    if (l.facing === "S") {
      const cx = l.c0 + l.w / 2 - 0.5;
      plane(a, cx - w / 2, l.r0 - 0.5 + inset, 1, 0, 0, -1, { name });
      if (s.flat !== true) box(a, cx - w / 2, l.r0 - 0.5 + inset, 1, 0, 0, 1);
    } else {
      const cy = l.r0 + l.w / 2 - 0.5;
      plane(a, l.c0 - 0.5 + inset, cy + w / 2, 0, -1, -1, 0, { name });
      if (s.flat !== true) box(a, l.c0 - 0.5 + inset, cy + w / 2, 0, -1, 1, 0);
    }
  }
  // The Colosseum: its front on its ground's front edge (r 27.5), its statues on its apron (in its picture, as the game does).
  if (!s.only) {
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
  for (const pr of s.only ? (s.props ?? []) : PROPS) {
    if ((pr.kind === "hedge" || pr.kind === "bush" || pr.kind === "shed" || pr.kind === "bed") && inNear(pr.x, pr.y)) continue;
    const [dx, dz] = rel(pr.x, pr.y);
    if (radial(v, dx, dz) > v.rim + 1) continue;
    if (pr.kind === "tree") billboard(`tree${pr.v}`, trees[pr.v]!, pr.x, pr.y, { fade: true });
    else if (pr.kind === "bench") billboard("bench", PARK_BENCH, pr.x, pr.y);
    else if (pr.kind === "table") (billboard("table", PARK_TABLE, pr.x, pr.y), tableTop(pr.x, pr.y));
    else if (pr.kind === "fountain") billboard("fountain", PARK_FOUNTAIN, pr.x, pr.y);
    else if (pr.kind === "lamp") billboard("lamp", PARK_LAMP, pr.x, pr.y, { glow: PARK_LAMP_LIGHTS });
    else if (pr.kind === "hedge") hedgeRun(pr.x, pr.y, pr.v, pr.x === Math.round(pr.x) ? "EW" : "NS");
    else if (pr.kind === "bush") billboard(`bush${pr.v}`, bush(pr.v), pr.x, pr.y);
    else if (pr.kind === "shed") {
      const b = shed(pr.v);
      const a = artOfBox(b);
      const w = a.img.width / SQ;
      plane(a, pr.x - w / 2, pr.y - 0.4, 1, 0, 0, -1); // (between the camera and you it isn't drawn, as the lots aren't)
      box(a, pr.x - w / 2, pr.y - 0.4, 1, 0, 0, 1);
    } else if (pr.kind === "bed") billboard(`bed${pr.v}`, bed(pr.v), pr.x, pr.y);
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
    if (!s.only && dz > 0 && Rr > v.rim && Rr <= v.rim + TOWN_FEEL.farReach && cs > 0.7) {
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
  if (!s.noYou) pawn(s.x, s.y, false, true);

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
  if (!s.noYou) for (const t of tags) t();
  if (s.caption) caption(g, s.caption, s.W);
  return { figures, strips, quads, fill: Math.round(fillPx / (s.W * s.H) * 100) / 100, planes: items.length };
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

/** A showcase: one lot (or props) alone at its plan spot, seen from the street at `heading` (a 3/4 view at 35). */
async function showcase(lot: Lot | null, props: typeof PROPS, x: number, y: number, heading: number, W = 320, H = 280, mag = 1.75, sky: SkyWeights = { dawn: 0, day: 1, dusk: 0, night: 0 }): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  await draw(c, { W, H, x, y, heading, sky, near: "open", only: true, lots: lot ? [lot] : [], props, noYou: true, mag });
  return c;
}
function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, size = 22, bold = true) {
  g.fillStyle = "#2a2a2a";
  g.font = `${bold ? "700 " : ""}${size}px Arial, sans-serif`;
  g.fillText(text, x, y);
}
/** A picture at a whole-number zoom on a ground line, its foot on `base`. */
function pic(g: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, base: number, footY: number, Z: number) {
  g.drawImage(img, x, base - footY * Z, img.width * Z, img.height * Z);
}

/**
 * The everyday buildings' sheet: a row a design: a 3/4 view of the box (its first colourway), its three colourways' fronts
 * at 2x, its two sides at 2x (the material carried round, the windows, the corner trim), its roof tiles at 3x, its lot.
 */
export async function sheetBuildings(cv: HTMLCanvasElement): Promise<void> {
  const designs: [Design, number][] = [["cottage", 3], ["townhouse", 2], ["skinny", 3], ["flats", 3], ["bakery", 3], ["shop", 2], ["block", 4], ["tower", 2]];
  const Z = 2, rowH = 360, W = 2280;
  cv.width = W;
  cv.height = 90 + designs.length * rowH;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f4efe4";
  g.fillRect(0, 0, cv.width, cv.height);
  label(g, "Everyday buildings (final): eight designs, three colourways each, as boxes: front, sides, roof", 24, 46, 32);
  label(g, "Left: each box at 3/4 from the street (by day). Then its three colourways' fronts (2x), its left and right sides (2x), its roof tiles (3x). Every one under 4 squares tall.", 24, 76, 18, false);
  for (let n = 0; n < designs.length; n++) {
    const [id, wsq] = designs[n]!;
    const y0 = 90 + n * rowH;
    const lot: Lot = { kind: DESIGN_LOT_BEHIND[id] ? "tall" : "house", id, v: 0, c0: 20, r0: 41, w: wsq, d: 3, facing: "S", street: "seam-st" };
    const sc = await showcase(lot, [], 20 + wsq / 2 - 2.2, 37.6, 35);
    g.drawImage(sc, 16, y0 + 8, sc.width * 0.55, sc.height * 0.55);
    let x = 16 + sc.width * 0.55 + 24;
    const base = y0 + 300;
    label(g, `${DESIGN_NAMES[id]} (${wsq} x 3)`, 16, y0 + 342, 18);
    for (let v2 = 0; v2 < 3; v2++) {
      const b = building(id, wsq, v2);
      const img = toCanvas(b.id, b.front);
      g.fillStyle = "#d8d4cc";
      g.fillRect(x - 4, base, img.width * Z + 8, 8);
      pic(g, img, x, base, b.front.foot[1], Z);
      label(g, COLOURWAYS[id][v2]!.name, x, base + 32, 16, false);
      x += Math.max(img.width * Z, 150) + 22;
    }
    const b = building(id, wsq, 0);
    for (const sd of [b.left!, b.right!]) {
      const img = toCanvas(sd.ch.id, sd.ch);
      pic(g, img, x, base, sd.ch.foot[1], Z);
      x += img.width * Z + 14;
    }
    label(g, "left side, right side", x - 2 * (b.left!.ch.w * Z + 14), base + 32, 16, false);
    x += 10;
    const texs = [...new Set(b.roof.map((f) => f.tex))];
    texs.forEach((t, i) => {
      const tc = toCanvas(`tile-${t}-${b.id}`, roofTile(t, { ...b.roofPal }, `${t}-${b.id}`));
      g.drawImage(tc, x + i * 125, base - 111, 111, 111);
      label(g, t, x + i * 125, base + 32, 16, false);
    });
  }
}
const DESIGN_LOT_BEHIND: Record<Design, boolean> = { cottage: false, townhouse: false, skinny: false, flats: false, bakery: false, shop: false, block: true, tower: true };

/** The boss homes as boxes: each straight on from its street and at 3/4 (its own sides and roof), by day. */
export async function sheetHomes(cv: HTMLCanvasElement): Promise<void> {
  const homes = LOTS.filter((l) => l.kind === "home");
  const cw = 2 * 300 + 30, ch = 330;
  cv.width = 4 * cw + 30;
  cv.height = 90 + Math.ceil(homes.length / 4) * ch;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f4efe4";
  g.fillRect(0, 0, cv.width, cv.height);
  label(g, "The 16 boss homes as boxes: their own sides and roofs (fronts are the game's)", 24, 46, 32);
  label(g, "Each: straight on from its street, and at 3/4 as the camera turns (35 degrees), alone on its lot, by day.", 24, 76, 18, false);
  for (let n = 0; n < homes.length; n++) {
    const l = homes[n]!;
    const x0 = 20 + (n % 4) * cw, y0 = 90 + Math.floor(n / 4) * ch;
    const cx = l.c0 + l.w / 2 - 0.5;
    const a = await showcase(l, [], cx, l.r0 - 3.2, 0, 270, 250);
    const b = await showcase(l, [], cx - 1.9, l.r0 - 3.0, 35, 270, 250);
    g.drawImage(a, x0, y0, 300, 278);
    g.drawImage(b, x0 + 305, y0, 300, 278);
    const spec = HOME_SPECS[l.id as HomeId];
    label(g, `${HOME_INFO[l.id as HomeId].name}`, x0, y0 + 300, 18);
    label(g, `${spec.side?.mat ?? "no walls"}${spec.eave ? `, walls ${spec.eave[0]} px` : ""}; roof: ${[...new Set(spec.roof.map((f) => f.tex))].join(", ")}`, x0, y0 + 322, 15, false);
  }
}

/** The street dressing: sidewalk tiles, the hedge's front and top, beds, bushes, sheds (front and box), the park's lamp and bench. */
export async function sheetDressing(cv: HTMLCanvasElement): Promise<void> {
  cv.width = 1900;
  cv.height = 820;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#f4efe4";
  g.fillRect(0, 0, cv.width, cv.height);
  label(g, "Street dressing: the sidewalk, the hedge (a plane with a top), the back gardens' things, the park's lamp and bench", 24, 46, 30);
  const Z = 4;
  let x = 24;
  const base = 330;
  const put = (key: string, c: Character, cap: string, z = Z) => {
    const img = toCanvas(key, c);
    pic(g, img, x, base, c.foot[1], z);
    label(g, cap, x, base + 30, 16, false);
    x += Math.max(img.width * z, 120) + 26;
  };
  put("sw0", sidewalkTile(false, 0), "sidewalk");
  put("sw1", sidewalkTile(true, 0), "kerb (street at top)");
  put("hf0", hedgeFront(0), "hedge front");
  put("ht0", hedgeTop(0), "hedge top");
  put("hf1", hedgeFront(1), "(yellow)");
  for (let i = 0; i < 3; i++) put(`bed${i}`, bed(i), `flower bed ${i}`, 3);
  x = 24;
  const base2 = 640;
  const put2 = (key: string, c: Character, cap: string, z = 3) => {
    const img = toCanvas(key, c);
    pic(g, img, x, base2, c.foot[1], z);
    label(g, cap, x, base2 + 30, 16, false);
    x += Math.max(img.width * z, 100) + 26;
  };
  for (let i = 0; i < 3; i++) put2(`bush${i}`, bush(i), `bush ${i}`);
  for (let i = 0; i < 3; i++) put2(`shed${i}`, shed(i).front, `shed ${i}`);
  put2("lamp", PARK_LAMP, "lamp (the park's)", 2);
  put2("bench", PARK_BENCH, "bench (the park's)", 2);
  // A shed as a box, at 3/4.
  const sc = await showcase(null, [{ kind: "shed", x: 20, y: 41, v: 0 }, { kind: "bed", x: 21.2, y: 40.6, v: 1 }, { kind: "bush", x: 18.8, y: 40.8, v: 2 }, { kind: "hedge", x: 19, y: 39.45, v: 0 }, { kind: "hedge", x: 20, y: 39.45, v: 1 }, { kind: "hedge", x: 21, y: 39.45, v: 2 }], 19.2, 38.4, 30, 260, 260);
  g.drawImage(sc, cv.width - 420, 380, 390, 390);
  label(g, "a shed (a box), a bed, a bush, the hedge, at 3/4", cv.width - 420, 800, 16, false);
}

(window as unknown as { townStreet: unknown }).townStreet = { draw, toCanvas, sheetBuildings, sheetHomes, sheetDressing };
