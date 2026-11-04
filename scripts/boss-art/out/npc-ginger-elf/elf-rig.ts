/**
 * Ginger's elves (Nov 5, drawn by hand on the weekly plan usage): one elf, dressed and recolored for each job (the shopkeeper in a
 * Santa hat, the walkers with their big candy canes, the dispensing pair, the two who carry the board in the intro). A happy little
 * elf about a square tall at the room's scale (37 px a square, drawn 1:1): a big round head, a pointed ear, rosy cheeks, a pointed
 * hat with a white band and a pom, a tunic with zigzag points and a belt, striped tights, curly-toed shoes with a bell on each.
 * Three-quarters, facing our right (mirror to face left), light from the top left.
 *
 * Frame: 48 x 64, the foot (the ground between the feet) at [22, 60]. Rigging: each part is painted from a pose (a handful of
 * numbers: the bob, the head's offset, each foot, each arm's hand, the eyes and mouth, what he holds) and a look (the hat, the
 * outfit's three keys), every part its own outlined layer, back to front; parts are made once per pose and shared between frames
 * and between elves (`PARTS`): every elf's outfit is the keys `o`, `O`, `p`, set by his own palette (`elfPalette`).
 */
import type { Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

export type Pt = readonly [number, number];
export const W = 48;
export const H = 64;
export const GROUND = 60;
export const FOOT: Pt = [22, GROUND];
/** An elf's height at rest from his feet to his hat's top (px, 1:1 at the room's 37 a square): for drawing him at his art's size. */
export const ELF_TALL = 37;

const BASE: Record<string, string> = {
  k: "#1d1410", // outline
  s: "#f7cda6", // skin: mid, shade, lit
  S: "#dc9d78",
  L: "#ffe4c8",
  c: "#f2848a", // rosy cheeks
  e: "#2a1810", // eyes
  m: "#8a2a24", // the mouth
  n: "#8c5228", // hair: mid, dark
  N: "#5c321a",
  w: "#fbfaf6", // white trim, fur, the box; its shade
  W: "#d3d0cf",
  b: "#2b1e18", // the belt
  y: "#ffd23a", // gold: buckles, bells; its shade
  Y: "#c58f10",
  q: "#5a3a26", // shoes: mid, dark
  Q: "#3a2416",
  r: "#e02a34", // the Santa hat's red, its shade (and the box's stripe)
  R: "#991a24",
  "~": "#fbfaf3", // the notepad's paper, its lines; the pencil
  "`": "#b9c6d8",
  z: "#ffcf3a",
  Z: "#9a6a3a",
  u: "#c9a46c", // the back sack (burlap): mid, shade, its string
  U: "#957240",
  // Candies (the stream, the full box): red, yellow, green, blue, pink, orange, purple, white.
  "1": "#ff3b45",
  "2": "#ffd83a",
  "3": "#45c25a",
  "4": "#36a8ea",
  "5": "#ff7cc0",
  "6": "#ff9326",
  "7": "#a65ee6",
  "8": "#ffffff",
  "*": "#ffffff", // a sparkle, its ice-blue
  "+": "#9fe0ff",
  "-": "#0b162a66", // the ground shadow
};
/** An elf's outfit: its mid, dark and lit keys (o, O, p). */
export type Outfit = readonly [string, string, string];
export const OUTFITS = {
  red: ["#d8333c", "#8f1d26", "#ff6a6f"],
  green: ["#2f9e48", "#1b622c", "#62d27a"],
  blue: ["#2f7fd8", "#1b4f92", "#69b2ff"],
  purple: ["#8d4fd0", "#55298f", "#b98bf0"],
  yellow: ["#f2b81e", "#b07a0c", "#ffe066"],
  orange: ["#f07a1e", "#a84c0c", "#ffad5c"],
  teal: ["#1fae9e", "#11706a", "#5fe0cf"],
  pink: ["#e8559e", "#a32a68", "#ff92c8"],
} as const satisfies Record<string, Outfit>;
export function elfPalette(o: Outfit): Record<string, string> {
  return { ...BASE, o: o[0], O: o[1], p: o[2] };
}

// ---- A little painter: canvases, filled discs, thick lines, every part cropped and placed.

type Cv = string[][];
const cv = (): Cv => Array.from({ length: H }, () => Array<string>(W).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < H && x >= 0 && x < W) c[y]![x] = k;
};
function disc(c: Cv, cx: number, cy: number, rx: number, ry: number, k: (x: number, y: number, u: number, v: number) => string | null) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      if (u * u + v * v > 1) continue;
      const kk = k(x, y, u, v);
      if (kk) put(c, x, y, kk);
    }
}
/** A thick line through points (a limb), radius `r`; `k(t, side)`: t 0 to 1 along it, side -1 to 1 across it (its lit side negative). */
function limb(c: Cv, pts: readonly Pt[], r: number, k: (t: number, side: number) => string | null) {
  const segs: [Pt, Pt, number, number][] = [];
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    segs.push([pts[i - 1]!, pts[i]!, L, l]);
    L += l;
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys) - r - 1); y <= Math.ceil(Math.max(...ys) + r + 1); y++)
    for (let x = Math.floor(Math.min(...xs) - r - 1); x <= Math.ceil(Math.max(...xs) + r + 1); x++) {
      let best = Infinity;
      let bt = 0;
      let bs = 0;
      for (const [a, b, l0, l] of segs) {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x + 0.5 - a[0]) * dx + (y + 0.5 - a[1]) * dy) / len2));
        const px = a[0] + dx * t;
        const py = a[1] + dy * t;
        const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
        if (d < best) {
          best = d;
          bt = (l0 + t * l) / (L || 1);
          // The side: which way off the line (toward the top left is lit).
          const nx = -dy;
          const ny = dx;
          bs = ((x + 0.5 - px) * nx + (y + 0.5 - py) * ny) / (Math.sqrt(len2) * r || 1);
        }
      }
      if (best > r) continue;
      const kk = k(bt, bs);
      if (kk) put(c, x, y, kk);
    }
}
export const PARTS: Record<string, Part> = {};
/** A canvas cropped to its drawing, stored once by name, as a layer at its place. */
function part(name: string, paint: (c: Cv) => void, outline = true): Layer | null {
  const cached = PLACES.get(name);
  if (cached !== undefined) return cached;
  const c = cv();
  paint(c);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  c.forEach((row, y) => row.forEach((k, x) => k !== "." && ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)))));
  if (x1 < 0) {
    PLACES.set(name, null);
    return null;
  }
  PARTS[name] = { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline };
  const l: Layer = { part: name, x: x0, y: y0 };
  PLACES.set(name, l);
  return l;
}
const PLACES = new Map<string, Layer | null>();

// ---- The pose and the look.

export type Hat = "elf" | "santa";
export interface Look {
  id: string;
  hat: Hat;
  /** A burlap sack on his back (the dispensing elf A, who tips each full box into it). */
  sack?: boolean;
}
export type Hold = "none" | "cane" | "caneUp" | "box" | "boxOut" | "boxTip" | "pad" | "boardBack" | "boardFront";
export interface Pose {
  /** Down a px (a breath, a step's dip); up (negative: a hop). */
  bob?: number;
  /** The whole elf sideways (px). */
  dx?: number;
  /** The head's offset (a look, a nod), and the hat's flop (-1 to 1: its tip swung back or forward). */
  hx?: number;
  hy?: number;
  flop?: number;
  /** Each foot's offset from its place [dx, lift] (far, near). */
  feet?: readonly [Pt, Pt];
  /** Each hand (far, near): where, from the shoulder (px). None: hanging at his side. */
  far?: Pt;
  near?: Pt;
  eyes?: "open" | "blink" | "happy" | "up";
  mouth?: "smile" | "open" | "o" | "grin";
  hold?: Hold;
  /** The box's fill (0 empty to 4 full) and the candy stream (0 none, 1-3: falling, its phase). */
  fill?: number;
  stream?: number;
  /** The pencil's place on the pad (0-3), the cane's sway (deg). */
  pencil?: number;
  sway?: number;
  /** Sat (px up: a stool's seat). */
  sit?: number;
}

const SHOULDER = { far: [21, 42] as Pt, near: [24, 42] as Pt };
const HIP = { far: [21, 50] as Pt, near: [24, 50] as Pt };
const HEAD: Pt = [24, 34]; // the head's middle at rest
const HANG: Record<"far" | "near", Pt> = { far: [-2, 7], near: [-1, 7] };

/** A candy cane held in his hand at (hx, hy): its foot on the ground ahead of him, the hook high over his head, striped white and his outfit's color. */
function paintCane(c: Cv, hx: number, hy: number, up: boolean, sway: number) {
  const a = ((up ? -6 : 8) + sway) * (Math.PI / 180);
  const top = [hx + Math.sin(a) * 16, hy - Math.cos(a) * 16] as const;
  const foot = [hx - Math.sin(a) * (up ? 6 : 15), hy + Math.cos(a) * (up ? 6 : 15)] as const;
  const r = 1.5;
  const hook = 4;
  const pts: [number, number, number][] = [];
  const len = Math.hypot(top[0] - foot[0], top[1] - foot[1]);
  for (let s = 0; s <= len; s += 0.25) pts.push([foot[0] + ((top[0] - foot[0]) * s) / len, foot[1] + ((top[1] - foot[1]) * s) / len, s]);
  const ux = (top[0] - foot[0]) / len;
  const uy = (top[1] - foot[1]) / len;
  // The hook curls forward (toward +x), half a turn.
  const hcx = top[0] - uy * -hook;
  const hcy = top[1] + ux * -hook;
  const a0 = Math.atan2(top[1] - hcy, top[0] - hcx);
  for (let t = 0; t <= Math.PI * 1.1; t += 0.06) pts.push([hcx + Math.cos(a0 + t) * hook, hcy + Math.sin(a0 + t) * hook, len + t * hook]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let best = Infinity;
      let bs = 0;
      let bd = 0;
      for (const [px, py, s] of pts) {
        const d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
        if (d < best) ((best = d), (bs = s), (bd = x + 0.5 - px + (y + 0.5 - py)));
      }
      if (best > r * r) continue;
      const stripe = Math.floor((bs + bd * 0.5) / 2.4) % 2 === 0;
      put(c, x, y, stripe ? (bd > 0.3 ? "O" : "o") : bd > 0.3 ? "W" : "w");
    }
}
/** The candy box: white, a red stripe round it, open at the top, its candies heaped `fill` (0-4) high; its top-left (x, y), 8 x 6. */
function paintBox(c: Cv, x: number, y: number, fill: number, tip = 0) {
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 8; i++) {
      const yy = y + j + (tip ? Math.round(((tip > 0 ? i - 3 : 4 - i) * Math.abs(tip)) / 3) * Math.sign(tip) * (tip > 0 ? -1 : -1) : 0);
      put(c, x + i, yy, j === 0 ? (i === 0 ? "w" : "W") : j === 3 ? "r" : i === 7 ? "W" : "w");
    }
  // The candies inside: a heap over the rim as it fills.
  const inks = "12345678";
  for (let i = 1; i < 7; i++) {
    const hgt = fill <= 0 ? -1 : Math.round(fill / 2 + (fill >= 3 ? 1 - Math.abs(i - 3.5) / 3.5 : 0) * 1.5);
    for (let j = 0; j <= hgt; j++) put(c, x + i, y + 1 - j, inks[(i * 3 + j * 5) % 8]!);
  }
}
function paintPad(c: Cv, x: number, y: number) {
  // A little notepad: a brown back, white paper with lines, a ring binding at its top.
  for (let j = 0; j < 7; j++) for (let i = 0; i < 6; i++) put(c, x + i, y + j, j === 0 ? (i % 2 ? "Y" : "y") : i === 5 || j === 6 ? "`" : j % 2 === 0 && i > 0 && i < 5 ? "`" : "~");
}

/** The elf's layers for a pose and a look, back to front. */
export function build(look: Look, p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const bob = p.bob ?? 0;
  const sit = p.sit ?? 0;
  const up = bob - sit; // the body's shift down
  const [ff, fn] = p.feet ?? [[0, 0], [0, 0]];
  const hx = p.hx ?? 0;
  const hy = p.hy ?? 0;
  const hold = p.hold ?? "none";
  const out: (Layer | null)[] = [];
  const key = (s: string) => s;
  const sh = (s: Pt): Pt => [s[0] + dx, s[1] + up];
  // Hands by what he holds (from the shoulder).
  const HOLD: Partial<Record<Hold, { far?: Pt; near?: Pt }>> = {
    cane: { near: [10, 1] },
    caneUp: { near: [10, -2] },
    box: { near: [3, 6] },
    boxOut: { near: [6, 3], far: [5, 4] },
    boxTip: { far: [-5, -12] },
    pad: { far: [4, 3], near: [5, 1] },
    boardBack: { near: [-7, 1], far: [-8, 2] },
    boardFront: { near: [8, 1], far: [7, 2] },
  };
  const hf = p.far ?? HOLD[hold]?.far ?? HANG.far;
  const hn = p.near ?? HOLD[hold]?.near ?? HANG.near;
  const sf = sh(SHOULDER.far);
  const sn = sh(SHOULDER.near);
  const handF: Pt = [sf[0] + hf[0], sf[1] + hf[1]];
  const handN: Pt = [sn[0] + hn[0], sn[1] + hn[1]];

  // The back sack (behind everything).
  if (look.sack)
    out.push(
      part(key(`sack:${dx}:${up}`), (c) => {
        disc(c, 16 + dx, 43 + up, 5.5, 6.5, (x, y, u, v) => (v < -0.75 ? "U" : u < -0.3 ? "u" : u > 0.5 || v > 0.6 ? "U" : (x + y) % 5 === 0 ? "U" : "u"));
        put(c, 17 + dx, 36 + up, "u"), put(c, 18 + dx, 36 + up, "U"), put(c, 18 + dx, 35 + up, "r");
      }),
    );
  // The far arm (behind the body).
  const arm = (name: string, s: Pt, h: Pt) =>
    part(key(`${name}:${s.join(",")}:${h.join(",")}`), (c) => {
      const mid: Pt = [(s[0] + h[0]) / 2 + (h[1] < s[1] ? 1 : -0.5), (s[1] + h[1]) / 2 + 0.5];
      limb(c, [s, mid, h], 1.6, (t, side) => (t > 0.86 ? (side < 0 ? "s" : "S") : t > 0.72 ? "w" : side < -0.2 ? "p" : side > 0.4 ? "O" : "o"));
      disc(c, h[0], h[1], 1.4, 1.4, (_x, _y, u, v) => (u + v > 0.6 ? "S" : "s"));
    });
  out.push(arm("armF", sf, handF));
  const behind: Layer[] = [];
  // The legs and shoes (far first): striped tights, curly toes with a bell.
  const leg = (name: string, hip: Pt, off: Pt) => {
    const foot: Pt = [hip[0] + off[0] + (name === "legF" ? -1 : 0), GROUND - 1 - off[1] - (sit ? 0 : 0)];
    const h: Pt = [hip[0] + dx, hip[1] + up];
    return part(key(`${name}:${h.join(",")}:${foot.join(",")}:${dx}:${sit}`), (c) => {
      const f: Pt = [foot[0] + dx, sit ? h[1] + 6 : foot[1]];
      const kneeOut: Pt = sit ? [h[0] + 4, h[1] + 1] : [(h[0] + f[0]) / 2, (h[1] + f[1]) / 2];
      limb(c, [h, kneeOut, [f[0], f[1] - 1]], 1.3, (t, side) => {
        const yy = h[1] + (f[1] - h[1]) * t;
        return Math.floor(yy / 2) % 2 ? (side > 0.3 ? "O" : "o") : side > 0.3 ? "W" : "w";
      });
      // The shoe: from the heel forward, its toe curling up, a bell on the tip.
      for (let i = -1; i <= 3; i++) put(c, f[0] + i, f[1], i < 1 ? "Q" : "q"), put(c, f[0] + i, f[1] - 1, i === -1 ? "Q" : "q");
      put(c, f[0] + 4, f[1] - 1, "q");
      put(c, f[0] + 5, f[1] - 2, "q");
      put(c, f[0] + 5, f[1] - 3, "y");
    });
  };
  out.push(leg("legF", HIP.far, ff));
  out.push(leg("legN", HIP.near, fn));
  // The tunic: flared, zigzag points at its hem, a belt and a gold buckle, a zigzag white collar.
  out.push(
    part(key(`tunic:${dx}:${up}`), (c) => {
      for (let y = 40; y <= 52; y++) {
        const t = (y - 40) / 12;
        const x0 = Math.round(19.5 - t * 3.5) + dx;
        const x1 = Math.round(27 + t * 3) + dx;
        for (let x = x0; x <= x1; x++) {
          const zig = y >= 50 && (y - 50) > Math.abs(((x - dx) % 4) - 2);
          if (zig) continue;
          const yy = y + up;
          if (y === 46 || y === 47) put(c, x, yy, x >= x1 - 2 && x <= x1 - 1 + 0 ? "y" : "b");
          else if (y >= 49 && (y - 49) >= Math.abs(((x - dx) % 4) - 2) - 1 && y >= 50) put(c, x, yy, "w");
          else put(c, x, yy, x < x0 + 2 ? "p" : x > x1 - 2 ? "O" : "o");
        }
      }
      // The collar points.
      for (let x = 19; x <= 28; x++) {
        const d = Math.abs((x % 3) - 1);
        for (let j = 0; j <= 1 - d; j++) put(c, x + dx, 40 + up + j, "w");
      }
    }),
  );
  // The head: big and round, a pointed ear back, rosy cheek, eye, nose, mouth; a tuft of hair under the hat.
  const hcx = HEAD[0] + dx + hx;
  const hcy = HEAD[1] + up + hy;
  const eyes = p.eyes ?? "open";
  const mouth = p.mouth ?? "smile";
  out.push(
    part(key(`head:${hcx},${hcy}:${eyes}:${mouth}`), (c) => {
      disc(c, hcx, hcy, 6, 5.6, (_x, _y, u, v) => (u - v * 0.4 > 0.55 && v > 0.2 ? "S" : u < -0.5 && v < -0.2 ? "L" : "s"));
      // The ear: a long point out of the back of his head, up and back (over whatever's there, outside the head).
      for (let j = 0; j < 7; j++) {
        const len = 6 - j * 0.8;
        for (let i = 0; i < len; i++) {
          const x = hcx - 4 - i - j * 0.55;
          const y = hcy + 2 - j * 0.75;
          if (c[Math.round(y)]?.[Math.round(x)] === ".") put(c, x, y, i < 1.5 ? "S" : j < 2 ? "S" : "s");
        }
      }
      // Hair at the back under the hat.
      for (let i = -6; i <= -2; i++) for (let j = -4; j <= -2; j++) if (i + j > -9) put(c, hcx + i, hcy + j, j === -2 && i % 2 ? "N" : "n");
      // The face (to our right).
      if (eyes === "open") put(c, hcx + 2, hcy - 1, "e"), put(c, hcx + 2, hcy, "e"), put(c, hcx + 4, hcy - 1, "e"), put(c, hcx + 4, hcy, "e");
      else if (eyes === "up") put(c, hcx + 2, hcy - 2, "e"), put(c, hcx + 2, hcy - 1, "e"), put(c, hcx + 4, hcy - 2, "e"), put(c, hcx + 4, hcy - 1, "e");
      else if (eyes === "blink") put(c, hcx + 2, hcy, "e"), put(c, hcx + 4, hcy, "e");
      else for (const ex of [2, 4]) put(c, hcx + ex - 0.5, hcy, "e"), put(c, hcx + ex, hcy - 1, "e"), put(c, hcx + ex + 0.6, hcy, "e"); // happy ^ ^
      put(c, hcx + 3, hcy + 2, "c"), put(c, hcx + 4, hcy + 2, "c"), put(c, hcx - 0, hcy + 2, "c");
      put(c, hcx + 6, hcy + 1, "s"), put(c, hcx + 6, hcy, "S"); // the nose
      if (mouth === "smile") put(c, hcx + 2, hcy + 3, "m"), put(c, hcx + 3, hcy + 4, "m"), put(c, hcx + 4, hcy + 4, "m"), put(c, hcx + 5, hcy + 3, "m");
      else if (mouth === "grin") for (let i = 2; i <= 5; i++) put(c, hcx + i, hcy + 3, "m"), put(c, hcx + i, hcy + 4, i === 2 || i === 5 ? "s" : "m"), put(c, hcx + 3, hcy + 3, "w");
      else if (mouth === "open") for (let i = 2; i <= 4; i++) for (let j = 3; j <= 4; j++) put(c, hcx + i + 0.5, hcy + j, "m");
      else put(c, hcx + 3, hcy + 3, "m"), put(c, hcx + 3, hcy + 4, "m");
    }),
  );
  // The hat: an elf's pointed hat (his outfit's color, a white band, a pom on its flopping tip) or the shopkeeper's Santa hat.
  const flop = p.flop ?? 0;
  out.push(
    part(key(`hat:${look.hat}:${hcx},${hcy}:${flop}`), (c) => {
      const santa = look.hat === "santa";
      const ink = santa ? ["r", "R", "r"] : ["o", "O", "p"];
      const by = hcy - 5; // the band's foot
      const baseL = hcx - 6.5;
      const baseR = hcx + 6;
      let tip: Pt;
      if (santa) {
        // A Santa hat: a soft red cone up from the band, its top flopping over and down behind his head, the pom hanging there.
        const path: [number, number, number][] = [
          [hcx, by - 2, 6.4],
          [hcx - 1, by - 5, 5.2],
          [hcx - 3, by - 8, 3.8],
          [hcx - 6 - flop, by - 9, 2.6],
          [hcx - 9 - flop, by - 7, 1.7],
          [hcx - 10 - flop, by - 5, 1.2],
        ];
        for (let i = 1; i < path.length; i++)
          for (let s2 = 0; s2 <= 1; s2 += 0.1) {
            const [x0, y0, r0] = path[i - 1]!;
            const [x1, y1, r1] = path[i]!;
            const x = x0 + (x1 - x0) * s2;
            const y = y0 + (y1 - y0) * s2;
            const r = r0 + (r1 - r0) * s2;
            disc(c, x, y, r, r * (i === 1 ? 0.8 : 1), (_x, _y, u, v) => (u + v * 0.6 > 0.45 ? ink[1]! : ink[0]!));
          }
        tip = [hcx - 10 - flop, by - 4];
      } else {
        tip = [hcx - 7 - flop * 2, hcy - 15 + Math.abs(flop)];
        for (let y = Math.floor(Math.min(tip[1], by - 9)); y <= by; y++)
          for (let x = Math.floor(Math.min(tip[0], baseL) - 2); x <= baseR + 1; x++) {
            // Inside the triangle base-left, base-right, tip, its right edge bowed out (a soft cone).
            const t = (by - y) / (by - tip[1]);
            if (t < 0 || t > 1) continue;
            const l = baseL + (tip[0] - baseL) * t;
            const r = baseR + (tip[0] - baseR) * t + 2.2 * Math.sin(t * Math.PI);
            if (x < l || x > r) continue;
            put(c, x, y, x < l + 1.6 && t < 0.8 ? ink[2]! : x > r - 1.6 ? ink[1]! : ink[0]!);
          }
      }
      // The band (white fur for the Santa hat: thicker).
      for (let x = Math.round(baseL - 1); x <= Math.round(baseR + 1); x++) for (let j = 0; j < (santa ? 3 : 2); j++) put(c, x, by - j, j === 0 ? "W" : "w");
      // The pom.
      disc(c, tip[0] - 0.5, tip[1] + 0.5, santa ? 2.2 : 1.6, santa ? 2.2 : 1.6, (_x, _y, u, v) => (u + v > 0.7 ? "W" : "w"));
    }),
  );
  // What he holds, then the near arm over it (or under it: the box out is held in front of his hand).
  const holdPart = (() => {
    switch (hold) {
      case "cane":
      case "caneUp":
        return part(key(`cane:${handN.join(",")}:${hold}:${p.sway ?? 0}`), (c) => paintCane(c, handN[0], handN[1], hold === "caneUp", p.sway ?? 0));
      case "box":
        return part(key(`box:${handN.join(",")}:${p.fill ?? 0}`), (c) => paintBox(c, handN[0] - 3, handN[1] - 3, p.fill ?? 0));
      case "boxOut":
        return part(key(`boxOut:${handN.join(",")}:${p.fill ?? 0}`), (c) => paintBox(c, handN[0] - 2, handN[1] - 2, p.fill ?? 0));
      case "boxTip":
        return part(key(`boxTip:${handF.join(",")}:${p.fill ?? 0}`), (c) => paintBox(c, handF[0] - 6, handF[1] - 4, p.fill ?? 0, -2));
      case "pad":
        return part(key(`pad:${handF.join(",")}`), (c) => paintPad(c, handF[0] - 1, handF[1] - 5));
      default:
        return null;
    }
  })();
  if (hold === "boxOut" || hold === "box") out.push(holdPart);
  out.push(arm("armN", sn, handN));
  if (hold !== "boxOut" && hold !== "box" && hold !== "boxTip") out.push(holdPart);
  if (hold === "boxTip" && holdPart) behind.push(holdPart);
  if (hold === "pad")
    out.push(
      part(key(`pencil:${handN.join(",")}:${p.pencil ?? 0}`), (c) => {
        const px = handN[0] + (p.pencil ?? 0) % 2;
        const py = handN[1] - 1 - ((p.pencil ?? 0) > 1 ? 1 : 0);
        put(c, px, py, "z"), put(c, px + 1, py - 1, "z"), put(c, px + 2, py - 2, "Z"), put(c, px - 1, py + 1, "e");
      }),
    );
  const list = out.filter((l): l is Layer => l !== null);
  // (The tipped box: drawn just after the far arm, behind his body and head.)
  if (behind.length) list.splice(look.sack ? 2 : 1, 0, ...behind);
  return list;
}

/** A frame: the pose's layers, its time, its specks (clipped to the frame), its cue. */
export function frame(look: Look, ms: number, p: Pose, extra: { specks?: Speck[]; cue?: string } = {}): Frame {
  const layers = [shadow(p.dx ?? 0, p.sit ? 0.8 : 1), ...build(look, p)];
  return { ms, layers, ...(extra.specks ? { specks: extra.specks.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H) } : {}), ...(extra.cue ? { cue: extra.cue } : {}) };
}
function shadow(dx: number, k: number): Layer {
  const name = `shadow:${dx}:${k}`;
  if (!PARTS[name]) {
    const rx = Math.round(8 * k);
    PARTS[name] = { grid: Array.from({ length: 3 }, (_, j) => Array.from({ length: 2 * rx + 1 }, (_, i) => ((i - rx) / rx) ** 2 + ((j - 1) / 1.2) ** 2 <= 1 ? "-" : ".").join("")), outline: false };
  }
  return { part: name, x: FOOT[0] + 1 + dx - Math.round(8 * k), y: GROUND - 2 };
}

/** A walk cycle (6 frames, the feet passing, a bob): far and near feet [dx, lift] and the bob per frame. */
export const WALK: readonly { feet: readonly [Pt, Pt]; bob: number }[] = [
  { feet: [[-4, 0], [4, 0]], bob: 1 },
  { feet: [[-2, 0], [2, 2]], bob: 0 },
  { feet: [[1, 0], [-1, 1]], bob: 0 },
  { feet: [[4, 0], [-4, 0]], bob: 1 },
  { feet: [[2, 2], [-2, 0]], bob: 0 },
  { feet: [[-1, 1], [1, 0]], bob: 0 },
];
/** The arms swinging with the walk (far, near hands from the shoulders). */
export const WALK_ARMS: readonly [Pt, Pt][] = [
  [[1, 7], [-3, 6]],
  [[0, 7], [-1, 7]],
  [[-1, 7], [1, 7]],
  [[-3, 6], [2, 6]],
  [[-1, 7], [1, 7]],
  [[0, 7], [-1, 7]],
];
/** Running (6 frames, 80 ms each): longer strides, a hop. */
export const RUN: readonly { feet: readonly [Pt, Pt]; bob: number }[] = [
  { feet: [[-5, 1], [5, 0]], bob: 0 },
  { feet: [[-2, 0], [3, 3]], bob: -1 },
  { feet: [[2, 2], [-1, 2]], bob: -1 },
  { feet: [[5, 0], [-5, 1]], bob: 0 },
  { feet: [[3, 3], [-2, 0]], bob: -1 },
  { feet: [[-1, 2], [2, 2]], bob: -1 },
];
