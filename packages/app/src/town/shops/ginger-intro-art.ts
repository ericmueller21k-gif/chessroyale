// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-intro-ginger/house-intro-ginger.ts at 6ef02ce9, Nov 5, 2026; Eric approved the design Nov 5): only the
// import paths changed. Notes: scripts/boss-art/out/shop-ginger-nov5.md and intro-ginger-nov5.md on that branch.
/**
 * Ginger's battle intro props (Eric's design, Nov 5), drawn by hand (weekly plan usage). The boss is on the left and you on the
 * right, on the battle spot's glossy ice in his igloo (out/house-shop-ginger).
 *
 * 1. INTRO_GINGER_BLAST: his staff's blast, a spinning comet of frost (`fly`) shot from his cane's hook up over the battle spot,
 *    where it bursts (`burst`) and the ice shard forms in it.
 * 2. INTRO_GINGER_SHARD: the ice shard, one big icicle, tall and pointed, with a round flat top: `form` in the burst, `fall`
 *    (it plummets point first: the code drops it), `land` (it stabs into the floor and settles, chips flying). It is the table.
 * 3. INTRO_GINGER_CRACK (flat, laid on the floor at the table's spot) and INTRO_GINGER_PUFF (a puff of snow round its foot): the
 *    icy ground cracking where it lands.
 * 4. INTRO_GINGER_TABLE: the icicle stabbed into the cracked ice, its round flat top INTRO_GINGER_TABLE_TOP (27 px, the park
 *    table's) over the floor; frost glints run over it (`idle`). The renderer draws the board on it (INTRO_GINGER_TABLE_INK).
 * 5. INTRO_GINGER_BOARD: the board the two elves carry out of the stockroom and toss up onto the table (a flat board, its squares
 *    ice-blue and white, `carry` and `spin`).
 * 6. INTRO_GINGER_LIGHT: the small white magic light his cast makes on the board, out of which the pieces appear (`appear`,
 *    `shine`, `fade`: the code draws the real pieces as it fades).
 * 7. INTRO_GINGER_STORM (128 x 128, tiles both ways) and INTRO_GINGER_FRONT (48 x 128): the wipe, a blizzard of snowflakes with
 *    candy canes of every color tumbling in it, played as Alfil's sandstorm and Jefferson's fireworks are.
 * 8. Where things go (squares, and px over the floor): INTRO_GINGER_BLAST_TO, INTRO_GINGER_BOARD_ROUTE, INTRO_GINGER_ELF_SPOTS.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../characters/sprite.ts";
import { CANDY_PALETTE, caneOn, cv, hash, put, type Bit, type Cv, type Key, type Pt } from "./candy-kit.ts";

const PALETTE: Record<string, string> = {
  ...CANDY_PALETTE,
  // The blizzard's haze: deep, mid, pale; the flakes are "*" and "~".
  d: "#a9c0dc",
  D: "#c4d5ea",
  K: "#dce7f4",
};
const L = (part: string, at: Pt): Layer => ({ part, x: at[0], y: at[1] });
function framesOf(prefix: string, parts: Record<string, Part>, list: { bits: (Bit | null)[]; ms: number; cue?: string; specks?: Speck[] }[]): Frame[] {
  return list.map((f, i) => {
    const layers: Layer[] = [];
    f.bits.forEach((b, j) => {
      if (!b) return;
      const n = `${prefix}${i}-${j}`;
      parts[n] = b.part;
      layers.push(L(n, b.at));
    });
    return { ms: f.ms, layers, ...(f.cue ? { cue: f.cue } : {}), ...(f.specks ? { specks: f.specks } : {}) };
  });
}
const cropped = (c: Cv, outline = true): Bit | null => {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  c.forEach((row, y) => row.forEach((k, x) => k !== "." && ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)))));
  if (x1 < 0) return null;
  return { part: { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline }, at: [x0, y0] };
};
const sparkle = (c: Cv, x: number, y: number, big = false) => {
  put(c, x, y, "*");
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(c, x + a, y + b, "~");
  if (big) for (const [a, b] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) put(c, x + a, y + b, "7");
};

// ================================================================================================================
// 1. The blast: a spinning comet of frost (its foot is its middle).
// ================================================================================================================

const BLW = 40;
const blastParts: Record<string, Part> = {};
function comet(f: number): Cv {
  const c = cv(BLW, BLW);
  const cx = 20, cy = 20;
  // A bright core, four spinning points, a tail of sparkles trailing down and to the left (it flies up and right).
  for (let y = 0; y < BLW; y++)
    for (let x = 0; x < BLW; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) + f * (Math.PI / 4);
      const star = r < 5 + 7 * Math.abs(Math.cos(2 * a)) ** 6;
      if (r < 3.6) c[y]![x] = "*";
      else if (star && r < 12) c[y]![x] = r < 6 ? "~" : r < 9 ? "8" : "7";
      else if (r < 7.5) c[y]![x] = "8";
    }
  for (let s = 0; s < 20; s++) {
    const tx = cx - 7 - s * 0.85;
    const ty = cy + 6 + s * 0.65;
    for (const w of [-1, 0, 1]) if (hash(s, f + w, 3) < 0.8 - s * 0.03) put(c, tx + w + Math.round(Math.sin(s + f) * 1.5), ty - w, s < 6 ? "*" : s < 12 ? "~" : "8");
  }
  return c;
}
function burstPic(t: number): Cv {
  const c = cv(BLW + 30, BLW + 30);
  const cx = 35, cy = 35;
  const R = [5, 10, 15, 19, 22, 24][t]!;
  for (let y = 0; y < c.length; y++)
    for (let x = 0; x < c[0]!.length; x++) {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * 1.15;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const rays = R * (0.8 + 0.25 * Math.abs(Math.cos(3 * a)) ** 4);
      if (r < R * 0.35 && t < 3) c[y]![x] = "*";
      else if (Math.abs(r - rays) < (t < 4 ? 1.6 : 0.9) && hash(x, y, t) < (t < 4 ? 0.9 : 0.5)) c[y]![x] = t < 3 ? "~" : "8";
      else if (r < rays && t < 2) c[y]![x] = "8";
    }
  // Flakes flung out.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    sparkle(c, Math.round(cx + Math.cos(a) * (R + 3)), Math.round(cy + Math.sin(a) * (R + 3) * 0.87), t < 3);
  }
  return c;
}
export const INTRO_GINGER_BLAST: Character = {
  id: "intro-ginger-blast",
  name: "Ginger's staff blast",
  w: BLW + 30,
  h: BLW + 30,
  foot: [35, 35],
  palette: PALETTE,
  parts: blastParts,
  anims: {
    /** Flying (loops, 4 x 60 ms): the comet spinning, its sparkle tail (cue `whoosh` f0, soft). Move it along its arc. */
    fly: { loop: true, frames: framesOf("b-fly-", blastParts, [0, 1, 2, 3].map((f) => ({ bits: [{ ...cropped(comet(f), false)!, at: [cropped(comet(f), false)!.at[0] + 15, cropped(comet(f), false)!.at[1] + 15] }], ms: 60, ...(f === 0 ? { cue: "whoosh" } : {}) }))) },
    /** Bursting where it stops (once, 6 x 70 ms): a ring of frost flung out, flakes; the shard forms in it (cue `burst` f0). */
    burst: { loop: false, frames: framesOf("b-burst-", blastParts, [0, 1, 2, 3, 4, 5].map((t) => ({ bits: [cropped(burstPic(t), false)], ms: 70, ...(t === 0 ? { cue: "burst" } : {}) }))) },
  },
};

// ================================================================================================================
// 2. The ice shard (the table): one big icicle, tall and pointed, with a round flat top (the table's surface is a circle; Eric,
//    Nov 5). 111 x 112, its foot [55, 106]: where its point touches the floor as it falls (lift 0 there), and where the table
//    stands once it has stabbed in.
// ================================================================================================================

const SW = 111;
const SH = 112;
const SF = 106; // the foot row
const SX = 55;
const DISC = { rx: 34, deep: 9, rim: 5 } as const; // the round top: 69 px across, its top seen 9 px deep, a 5 px rim
const BODY = { r: 20, len: 84 } as const; // the icicle under it: 40 px across at the top, 84 px down to its point
/** Its round top's height over the floor once it has stabbed in: the park table's (27), so no step is needed for you. */
export const INTRO_GINGER_TABLE_TOP = 27;
const FALL_TOP = BODY.len + DISC.rim; // its top's height over its point as it falls: 89
const SUNK = FALL_TOP - INTRO_GINGER_TABLE_TOP; // how far it stabs into the floor: 62 px
/** The icicle's half-width `t` of the way down its body (0 under the top, 1 its point): a long concave point. */
const bodyR = (t: number) => BODY.r * Math.pow(Math.max(0, 1 - t), 1.35);
/** The icicle with its top's front edge `top` px over the foot; `cut`: nothing under the floor's line (stabbed in). */
function shardPic(top: number, opts: { cut?: boolean; glint?: number; frost?: number; form?: number } = {}): Cv {
  const c = cv(SW, SH);
  const form = opts.form ?? 1;
  const yTop = SF - top; // the top's front edge (the rim's top)
  const yBody = yTop + DISC.rim; // where the body starts, under the rim
  const len = Math.round(BODY.len * form);
  // The body: clear ice lit on the left, ridges running down it, a bright edge, darker toward the point and the right.
  for (let j = 0; j <= len; j++) {
    const y = yBody + j;
    if (opts.cut && y > SF) break;
    const t = j / len;
    const half = bodyR(t) * (0.6 + 0.4 * form);
    for (let x = Math.round(SX - half); x <= Math.round(SX + half); x++) {
      const u = (x + 0.5 - (SX - half)) / (2 * half + 0.01);
      const ridge = Math.abs(Math.sin(u * Math.PI * 4 + t * 2)) < 0.12;
      let k = u < 0.12 ? "9" : u < 0.3 ? "8" : u < 0.62 ? "7" : u < 0.88 ? "6" : "/";
      if (ridge && u > 0.12 && u < 0.88) k = u < 0.5 ? "9" : "/";
      if (t > 0.8 && u > 0.5) k = "/";
      put(c, x, y, k);
    }
    if (j % 9 === 4 && t < 0.7) put(c, Math.round(SX - half * 0.55), y, "*"); // a glint down its lit side
  }
  // The round flat top: its rim (a 5 px band round the front, curving down at the sides), then its top face (an ellipse).
  const rx = Math.round(DISC.rx * (0.55 + 0.45 * form));
  for (let x = SX - rx; x <= SX + rx; x++) {
    const u = (x + 0.5 - SX) / rx;
    if (Math.abs(u) > 1) continue;
    const front = Math.round(DISC.deep / 2 * Math.sqrt(1 - u * u)); // the top face's front edge, below its middle line
    const yMid = yTop - Math.round(DISC.deep / 2);
    // The top face: the ellipse from its back edge to its front edge.
    for (let y = yMid - front; y <= yMid + front; y++) {
      const v = (y - yMid) / (front || 1);
      put(c, x, y, v < -0.6 ? "9" : u < -0.55 ? "9" : (x - y * 2) % 19 === 0 ? "9" : v > 0.75 ? "~" : "8");
    }
    // The rim below its front edge.
    for (let j = 1; j <= DISC.rim; j++) put(c, x, yMid + front + j, j === 1 ? "*" : u < -0.6 ? "8" : u > 0.65 ? "6" : j === DISC.rim ? "/" : "7");
  }
  if (opts.glint !== undefined) {
    const gx = SX - rx + 6 + ((opts.glint * 13) % (2 * rx - 12));
    sparkle(c, gx, yTop + 2, true);
  }
  if (opts.frost) for (let i = 0; i < opts.frost * 6; i++) sparkle(c, SX - rx + Math.floor(hash(i, 1, 7) * 2 * rx), yTop - DISC.deep + Math.floor(hash(i, 2, 7) * (DISC.deep + 30)));
  return c;
}
const shardParts: Record<string, Part> = {};
/** Ice chips flung out as it stabs in, `t` frames on (frame px). */
const chips = (t: number): Speck[] =>
  [[-1, -1.2], [1.1, -1.4], [-1.6, -0.6], [1.7, -0.7], [-0.6, -1.8], [0.5, -1.7], [-2, -0.3], [2, -0.4]].flatMap(([vx, vy], i): Speck[] => {
    const x = Math.round(SX + (i % 2 ? 12 : -12) + vx! * (8 + t * 7));
    const y = Math.round(SF - 2 + vy! * (6 + t * 6) + t * t * 1.6);
    return y < SF ? [[x, y, i % 3 ? "8" : "*"], [x + 1, y, "~"]] : [];
  });
/** Its top's height over the floor through `land`, per frame: it stabs in fast, jolts and settles at 27. */
const LAND_TOP = [56, 34, 25, 28, 27] as const;
export const INTRO_GINGER_SHARD: Character = {
  id: "intro-ginger-shard",
  name: "Ginger's ice shard: a big icicle with a round flat top (it becomes the table)",
  w: SW,
  h: SH,
  foot: [SX, SF],
  palette: PALETTE,
  parts: shardParts,
  anims: {
    /** Forming in the burst (once, 4 x 80 ms): the frost packs into the icicle, its point growing (cue `freeze` f0). */
    form: { loop: false, frames: framesOf("s-form-", shardParts, [0.3, 0.55, 0.8, 1].map((fm, i) => ({ bits: [cropped(shardPic(FALL_TOP, { form: fm, frost: 3 - i }))], ms: 80, ...(i === 0 ? { cue: "freeze" } : {}) }))) },
    /** Falling point first (loops, 2 x 60 ms): speed streaks over its top. Drop it from INTRO_GINGER_BLAST_TO's lift less 40 to 0. */
    fall: {
      loop: true,
      frames: framesOf("s-fall-", shardParts, [0, 1].map((f) => ({ bits: [cropped(shardPic(FALL_TOP))], ms: 60, specks: [-26, -13, 0, 13, 26].flatMap((dx, i): Speck[] => Array.from({ length: 6 + ((i + f) % 3) * 2 }, (_, j): Speck => [SX + dx + ((i + f) % 2), SF - FALL_TOP - DISC.deep - 3 - j * 2 - f, j < 2 ? "~" : "8"])) }))),
    },
    /** Stabbing in (once, 5 frames, 0.42 s): the point drives into the floor (cut at the floor line), a jolt, chips flung out (cue `crunch` f0). */
    land: { loop: false, frames: framesOf("s-land-", shardParts, LAND_TOP.map((top, i) => ({ bits: [cropped(shardPic(top, { cut: true }))], ms: [60, 70, 80, 90, 120][i]!, specks: chips(i), ...(i === 0 ? { cue: "crunch" } : {}) }))) },
  },
};
/** How far its point stabs into the floor as it lands (px), and its top's height over the floor through `land`, per frame. */
export const INTRO_GINGER_SHARD_SINK = { sunk: SUNK, landTop: LAND_TOP } as const;

// ================================================================================================================
// 3. The crack in the ice (flat: lay it on the floor centred on the table's spot, 3 squares by 2) and the puff of snow (upright).
// ================================================================================================================

const CKW = 111;
const CKH = 74;
const crackParts: Record<string, Part> = {};
/** The cracks: lines from the middle out (seen from above, the top-down floor's px), growing `t` 0-3, a crushed white middle. */
function crackPic(t: number): Cv {
  const c = cv(CKW, CKH);
  const cx = CKW / 2, cy = CKH / 2;
  const reach = [14, 26, 36, 42][t]!;
  // The crushed ice round the spikes (white, broken).
  for (let y = 0; y < CKH; y++)
    for (let x = 0; x < CKW; x++) {
      const r = Math.hypot((x + 0.5 - cx) / 1.4, y + 0.5 - cy);
      if (r < 6 + t * 1.5 && hash(x, y, 5) < 0.75) c[y]![x] = hash(x, y, 6) < 0.4 ? "9" : "8";
    }
  // Ten jagged cracks.
  for (let i = 0; i < 10; i++) {
    let a = (i / 10) * Math.PI * 2 + hash(i, 0, 9) * 0.4;
    let x = cx, y = cy;
    const len = reach * (0.6 + hash(i, 1, 9) * 0.5);
    for (let s = 0; s < len; s++) {
      a += (hash(i, s, 11) - 0.5) * 0.35;
      x += Math.cos(a) * 1.4;
      y += Math.sin(a) * 0.95;
      put(c, x, y, s < len * 0.7 ? "0" : "/");
      if (s < len * 0.5) put(c, x + 1, y, "/");
      put(c, x - 1, y - 1, "9"); // the lit edge along it
      // A branch now and then.
      if (s % 9 === 5 && s < len - 6) {
        let bx = x, by = y, ba = a + (hash(i, s, 13) < 0.5 ? 0.8 : -0.8);
        for (let k = 0; k < 6; k++) (bx += Math.cos(ba) * 1.3), (by += Math.sin(ba) * 0.9), put(c, bx, by, "/");
      }
    }
  }
  return c;
}
export const INTRO_GINGER_CRACK: Character = {
  id: "intro-ginger-crack",
  name: "The cracked ice under the table (flat)",
  w: CKW,
  h: CKH,
  foot: [CKW / 2, CKH / 2],
  palette: PALETTE,
  parts: crackParts,
  anims: {
    /** Cracking out (once, 4 x 70 ms, from the landing's f0). */
    crack: { loop: false, frames: framesOf("c-", crackParts, [0, 1, 2, 3].map((t) => ({ bits: [cropped(crackPic(t), false)], ms: 70 }))) },
    /** Cracked (1 frame): it stays under the table through the match. */
    idle: { loop: true, frames: framesOf("ci-", crackParts, [{ bits: [cropped(crackPic(3), false)], ms: 1000 }]) },
  },
};
const PFW = 111;
const PFH = 56;
const puffParts: Record<string, Part> = {};
function puffPic(t: number): Cv {
  const c = cv(PFW, PFH);
  const cx = PFW / 2;
  const base = PFH - 4;
  // Billows of snow out from the foot both ways, rising and thinning.
  const n = 9;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const d = (8 + (i >> 1) * 9) * (0.5 + t * 0.22);
    const bx = cx + side * d;
    const by = base - 3 - t * 2 - (i >> 1) * 1.5 - hash(i, 3, 3) * 4;
    const r = (4 + hash(i, 4, 3) * 3) * (1 + t * 0.15) * (t > 3 ? 0.8 : 1);
    for (let y = Math.floor(by - r); y <= by + r; y++)
      for (let x = Math.floor(bx - r * 1.3); x <= bx + r * 1.3; x++) {
        const u = (x + 0.5 - bx) / (r * 1.3), v = (y + 0.5 - by) / r;
        if (u * u + v * v > 1) continue;
        if (t > 3 && hash(x, y, t) < 0.35 + (t - 4) * 0.25) continue;
        put(c, x, y, v < -0.3 && u < 0.2 ? "*" : v > 0.4 ? "4" : "5");
      }
  }
  return c;
}
export const INTRO_GINGER_PUFF: Character = {
  id: "intro-ginger-puff",
  name: "The puff of snow as the shard lands",
  w: PFW,
  h: PFH,
  foot: [PFW / 2, PFH - 4],
  palette: PALETTE,
  parts: puffParts,
  anims: {
    /** Once, 6 x 80 ms, from the landing's f0: snow billowing out both ways from the table's foot, thinning away. */
    puff: { loop: false, frames: framesOf("p-", puffParts, [0, 1, 2, 3, 4, 5].map((t) => ({ bits: [cropped(puffPic(t))], ms: 80 }))) },
  },
};

// ================================================================================================================
// 4. The ice table: the shard landed (its slab's top 27 px over the floor), frost glints running over it.
// ================================================================================================================

const tableParts: Record<string, Part> = {};
export const INTRO_GINGER_TABLE: Character = {
  id: "intro-ginger-table",
  name: "Ginger's ice table",
  w: SW,
  h: SH,
  foot: [SX, SF],
  palette: PALETTE,
  parts: tableParts,
  anims: {
    /** Standing (loops, 6 x 220 ms): a frost glint running along its slab's face now and then (cue `glint` f2, very soft). */
    idle: { loop: true, frames: framesOf("t-", tableParts, [-1, -1, 0, 2, 4, -1].map((g, i) => ({ bits: [cropped(shardPic(INTRO_GINGER_TABLE_TOP, { cut: true, ...(g >= 0 ? { glint: g } : {}) }))], ms: 220, ...(i === 2 ? { cue: "glint" } : {}) }))) },
  },
};
/** The slab (keys "1" top edge to "5" deep, as the renderer reads them): frosted ice; the board's squares ice-white and blue. */
export const INTRO_GINGER_TABLE_PALETTE: Record<string, string> = {
  k: PALETTE.k!,
  "1": "#f4fcff",
  "2": "#d6eefb",
  "3": "#b2dcf5",
  "4": "#8cc6ea",
  "5": "#5f9fd2",
  L: "#eaf6ff",
  D: "#7fb2dc",
  P: "#fbfbf6",
  Q: "#262321",
};
/** The board's squares: ice-white and a mid ice-blue (the town's charcoal and cream pieces read on both). */
export const INTRO_GINGER_TABLE_INK = {
  light: "#eaf6ff",
  lightShade: "#cfe6f6",
  lightLine: "#9cc4e2",
  dark: "#7fb2dc",
  darkShade: "#679ccb",
  darkLine: "#3f75a8",
} as const;

// ================================================================================================================
// 5. The board the elves carry: a flat wooden board, its squares ice-blue and white, seen from a little above. 40 x 14, its foot
//    the middle of its underside [20, 11] (lift it to the carriers' hands: ELF_BOARD_HANDS).
// ================================================================================================================

const BW = 40;
const BH = 14;
const boardParts: Record<string, Part> = {};
function boardPic(tilt: number): Cv {
  const c = cv(BW, BH);
  const x0 = 4, x1 = 35;
  const top = 3, deep = 6;
  for (let y = top; y < top + deep + 2; y++)
    for (let x = x0; x <= x1; x++) {
      const sk = Math.round(((x - (x0 + x1) / 2) * tilt) / 16);
      const yy = y + sk;
      if (y >= top + deep) put(c, x, yy, y === top + deep ? "u" : "w"); // its edge: wood
      else {
        const i = Math.floor(((x - x0) / (x1 - x0 + 1)) * 8);
        const j = Math.floor(((y - top) / deep) * 4);
        put(c, x, yy, (i + j) % 2 ? "6" : "8");
      }
    }
  return c;
}
export const INTRO_GINGER_BOARD: Character = {
  id: "intro-ginger-board",
  name: "The board the elves carry",
  w: BW,
  h: BH,
  foot: [20, 11],
  palette: PALETTE,
  parts: boardParts,
  anims: {
    /** Carried (1 frame). */
    carry: { loop: true, frames: framesOf("bd-c-", boardParts, [{ bits: [cropped(boardPic(0))], ms: 1000 }]) },
    /** In the air, tossed (loops, 4 x 70 ms): it tips one way and back as it flies (cue `whoosh` f0, soft); lands with `clack`. */
    spin: { loop: true, frames: framesOf("bd-s-", boardParts, [2, 4, 2, -1].map((t, i) => ({ bits: [cropped(boardPic(t))], ms: 70, ...(i === 0 ? { cue: "whoosh" } : {}) }))) },
  },
};

// ================================================================================================================
// 6. The white light on the board (its foot its middle: put it on the board's middle, at the slab's top).
// ================================================================================================================

const LW = 48;
const lightParts: Record<string, Part> = {};
function lightPic(r: number, rays: number, turn: number, fade = 1): Cv {
  const c = cv(LW, LW);
  const cx = LW / 2, cy = LW / 2;
  for (let y = 0; y < LW; y++)
    for (let x = 0; x < LW; x++) {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * 1.2;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) + turn;
      const ray = d < rays * (0.35 + 0.65 * Math.abs(Math.cos(2 * a)) ** 12);
      if (d < r * 0.5) c[y]![x] = "*";
      else if (d < r) c[y]![x] = hash(x, y, 3) < fade ? "~" : ".";
      else if (ray && hash(x, y, 4) < fade) c[y]![x] = d < rays * 0.6 ? "~" : "8";
    }
  return c;
}
const motes = (n: number, R: number, turn: number): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const a = (i / n) * Math.PI * 2 + turn;
    const x = Math.round(LW / 2 + Math.cos(a) * R);
    const y = Math.round(LW / 2 + Math.sin(a) * R * 0.55 - (i % 3));
    return [[x, y, "*"], [x + 1, y, "~"], [x, y - 1, "~"]];
  }).flat();
export const INTRO_GINGER_LIGHT: Character = {
  id: "intro-ginger-light",
  name: "The white magic light the pieces appear from",
  w: LW,
  h: LW,
  foot: [LW / 2, LW / 2],
  palette: PALETTE,
  parts: lightParts,
  anims: {
    /** Appearing (once, 4 x 70 ms): a mote that swells to a soft white glow (cue `sparkle` f0). */
    appear: { loop: false, frames: framesOf("l-a-", lightParts, [[1.5, 0], [3, 4], [5, 8], [6, 12]].map(([r, ry], i) => ({ bits: [cropped(lightPic(r!, ry!, i * 0.2), false)], ms: 70, ...(i === 0 ? { cue: "sparkle" } : {}) }))) },
    /** Shining (loops, 4 x 90 ms): its rays turning, sparkles circling out over the board. */
    shine: { loop: true, frames: framesOf("l-s-", lightParts, [0, 1, 2, 3].map((i) => ({ bits: [cropped(lightPic(6.5, 14, i * 0.39), false)], ms: 90, specks: motes(6, 14 + (i % 2) * 3, i * 0.5) }))) },
    /** Fading (once, 5 x 90 ms) as the pieces appear: it thins to sparkles drifting up and out (the code shows the real pieces). */
    fade: { loop: false, frames: framesOf("l-f-", lightParts, [0, 1, 2, 3, 4].map((i) => ({ bits: [cropped(lightPic(6 - i * 1.3, 14 - i * 2.5, i * 0.4, 1 - i * 0.2), false)], ms: 90, specks: motes(8, 15 + i * 3, i * 0.4).map(([x, y, k]) => [x, y - i * 2, k] as const) }))) },
  },
};

// ================================================================================================================
// 7. The wipe: a blizzard with candy canes. 128 x 128, tiling; 6 x 70 ms, looping. Snow in driving streaks on a pale icy haze,
//    big flakes, and candy canes of every color tumbling across in it. No flashing: the haze never changes brightness.
// ================================================================================================================

const ST = 128;
const FW = 48;
const mod = (a: number, m: number) => ((a % m) + m) % m;
function haze(x: number, y: number): string {
  // Soft bands of blowing snow slanting down to the right (no blotches): mostly pale, a darker gust band.
  const v = Math.sin((2 * Math.PI * (2 * y - x)) / ST) + 0.35 * Math.sin((2 * Math.PI * 3 * (2 * y - x)) / ST + 1);
  return v > -0.1 ? "K" : v > -0.9 ? "D" : "d";
}
/** Driving snow: streaks slanting down to the right, moving a step a frame (the tile scrolls with them). */
function streakKey(x: number, y: number, f: number): Key {
  for (let n = 0; n < 44; n++) {
    const sx = Math.floor(hash(n, 1, 81) * ST);
    const sy = Math.floor(hash(n, 2, 81) * ST);
    const len = 5 + Math.floor(hash(n, 3, 81) * 7);
    const px = mod(x - sx - f * 4, ST);
    const py = mod(y - sy - f * 2, ST);
    const t = px;
    if (t < len && Math.abs(py - t * 0.45) < 0.6) return t > len - 3 ? "*" : "~";
  }
  return null;
}
/** Big flakes: six-armed stars, a few at a time, turning. */
function flakeKey(x: number, y: number, f: number): Key {
  for (let n = 0; n < 7; n++) {
    const sx = mod(Math.floor(hash(n, 4, 81) * ST) + f * 3, ST);
    const sy = mod(Math.floor(hash(n, 5, 81) * ST) + f * 2, ST);
    const dx = mod(x - sx + 64, ST) - 64;
    const dy = mod(y - sy + 64, ST) - 64;
    const r = Math.hypot(dx, dy);
    if (r > 4.5) continue;
    if (r < 1) return "*";
    const a = Math.atan2(dy, dx) + n + f * 0.25;
    const arm = Math.abs(Math.sin(3 * a)) < 0.22;
    if (arm) return r < 3 ? "*" : "~";
  }
  return null;
}
/** The candy canes tumbling across: five, each a color, at its own place and turn (one turn over the loop). */
const CANES: { x: number; y: number; ink: [string, string]; spin: number }[] = [
  { x: 24, y: 22, ink: ["r", "R"], spin: 0 },
  { x: 88, y: 40, ink: ["g", "G"], spin: 2 },
  { x: 52, y: 84, ink: ["t", "T"], spin: 4 },
  { x: 108, y: 102, ink: ["p", "P"], spin: 1 },
  { x: 14, y: 110, ink: ["h", "H"], spin: 3 },
];
function canesLayer(f: number): Cv {
  const c = cv(ST + 40, ST + 40);
  for (const cn of CANES) {
    const a = ((f + cn.spin) / 6) * Math.PI * 2;
    const cx = cn.x + 20 + f * 4, cy = cn.y + 20 + f * 2;
    const L = 9;
    caneOn(c, cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L, cn.ink, 1.6, 3.5, 1);
  }
  // Fold it back onto the tile (it wraps both ways).
  const t = cv(ST, ST);
  c.forEach((row, y) => row.forEach((k, x) => k !== "." && (t[mod(y - 20, ST)]![mod(x - 20, ST)] = k)));
  return t;
}
const CANE_LAYERS = [0, 1, 2, 3, 4, 5].map(canesLayer);
function stormKey(x: number, y: number, f: number): string {
  const cn = CANE_LAYERS[f]![y]![x]!;
  if (cn !== ".") return cn;
  return flakeKey(x, y, f) ?? streakKey(x, y, f) ?? haze(x, y);
}
const full = (fn: (x: number, y: number) => Key, w: number, h: number): Part => ({ grid: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y) ?? ".").join("")), outline: false });
const stormParts: Record<string, Part> = {};
const STORM_CUES: Record<number, string> = { 0: "blizzard", 3: "gust" };
const stormFrames: Frame[] = Array.from({ length: 6 }, (_, f) => {
  stormParts[`s${f}`] = full((x, y) => stormKey(x, y, f), ST, ST);
  return { ms: 70, layers: [L(`s${f}`, [0, 0])], ...(STORM_CUES[f] ? { cue: STORM_CUES[f] } : {}) };
});
export const INTRO_GINGER_STORM: Character = {
  id: "intro-ginger-storm",
  name: "Ginger's wipe: a blizzard with candy canes (tile)",
  w: ST,
  h: ST,
  foot: [ST / 2, ST - 1],
  palette: PALETTE,
  parts: stormParts,
  anims: { idle: { loop: true, frames: stormFrames } },
};
/** The leading edge: the blizzard on its left (it meets STORM with no seam), then a wall of dense white snow, flakes flying ahead. */
function edgeX(y: number, f: number): number {
  const ph = (2 * Math.PI * f) / 6;
  return 20 + 4 * Math.sin((2 * Math.PI * 2 * y) / ST + ph) + 2 * Math.sin((2 * Math.PI * 5 * y) / ST - ph * 2);
}
function frontKey(x: number, y: number, f: number): Key {
  const e = edgeX(y, f);
  if (x < e - 9) return stormKey(x, y, f);
  if (x < e) {
    const u = (x - (e - 9)) / 9;
    const h = hash(x, y, f + 3);
    if (h < 0.3 + u * 0.6) return "*";
    if (h < 0.6 + u * 0.3) return "~";
    return u < 0.4 ? stormKey(x, y, f) : "K";
  }
  // Flakes and puffs blown out ahead.
  const dx = x - e;
  if (hash(x, y, f * 13 + 5) < 0.09 - dx * 0.004) return dx < 6 ? "*" : "~";
  return null;
}
const frontParts: Record<string, Part> = {};
const frontFrames: Frame[] = Array.from({ length: 6 }, (_, f) => {
  frontParts[`f${f}`] = full((x, y) => frontKey(x, y, f), FW, ST);
  return { ms: 70, layers: [L(`f${f}`, [0, 0])], ...(f === 0 ? { cue: "whoosh" } : {}) };
});
export const INTRO_GINGER_FRONT: Character = {
  id: "intro-ginger-front",
  name: "Ginger's wipe (its leading edge)",
  w: FW,
  h: ST,
  foot: [0, ST - 1],
  palette: PALETTE,
  parts: frontParts,
  anims: { idle: { loop: true, frames: frontFrames } },
};

// ================================================================================================================
// 8. Where things go (squares; lifts in the room's px over the floor).
// ================================================================================================================

/**
 * Ginger's challenge camera (a new BossIntro field for the code: CHALLENGE_FEEL.cam.across's south and zoom, but centred on the
 * table, west 0 rather than 0.75): his battle spot is the round room's middle, and this keeps both staircases at the catwalk's
 * ends in the phone's narrow view (Eric, Nov 5: "keep the east staircase on screen ... by the camera framing").
 */
export const INTRO_GINGER_CAM = { south: 0.8, west: 0, zoom: 1 } as const;
/** The blast flies from his hook (BOSS_GINGER_INTRO's INTRO_GINGER_BLAST_FROM, on his frame) to here: over the table's spot, 120 px up. */
export const INTRO_GINGER_BLAST_TO = { at: [9.5, 9.5], lift: 120 } as const;
/** The shard forms there and falls from that lift to 0 (its spikes' tips on the floor), then lands at the table's spot. */
export const INTRO_GINGER_TABLE_AT = [9.5, 9.5] as const;
/**
 * The board carriers' route (the board's middle; elf A, the front, 0.4 squares east of it, elf B 0.4 west, both facing east):
 * out of the stockroom door (bay-door at (8, 4): swap it for `bay-door-open` while they come out), south down column 8 past the stand,
 * east along row 7 (behind the battle spot's ice), to the toss spot just behind the table. At 3.5 squares a second, `carry`.
 */
export const INTRO_GINGER_BOARD_ROUTE = [
  [8, 4.75],
  [8, 7.0],
  [9.5, 7.0],
  [9.5, 8.2],
] as const;
/** The carriers either side of the board (squares from its middle) and where they go to watch once it's on (each faces the table). */
export const INTRO_GINGER_ELF_SPOTS = {
  carry: { a: 0.4, b: -0.4 },
  watch: { a: { at: [11.3, 7.9], face: -1 }, b: { at: [7.0, 7.9], face: 1 } },
} as const;
