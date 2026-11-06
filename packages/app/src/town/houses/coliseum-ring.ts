/**
 * The street town's Colosseum as a solid (Nov 5, the north edge round; Eric: "we probably have to actually draw the Colosseum out, at least
 * on the sides, because the way it's glitching right now looks really sloppy"). Round 5's was one picture standing up: turned, a tilted
 * card. This one is a ring of wall faces round its oval (the plan's `coliseum.oval`), each a box the box renderer (boxes.ts) draws from any
 * heading, and a portal standing before its front, the Colosseum's own box (its tablet, "The Colosseum" written by the game).
 *
 * - **The ring:** RING_M straight stretches of equal length round the oval, the first centred on its front. Each is a box: its front the
 *   outer wall seen square on (three tiers of arches, marble pawns in the middle tier's, a tier of windows, the attic's checkered band
 *   of the board's light and dark squares, as today's picture has them; a long banner on the four either side of the portal; a flag over
 *   the one behind it), and its roof three faces: the rim on top, the seats stepping down inside (the cavea) and the podium's checkered
 *   wall round the arena, whose floor is the ground's own squares (a chessboard). Seen from the streets you see its outer wall; from the
 *   overview, into the bowl.
 * - **About twice as tall as round 5's wall** (262 px, 7 squares, where today's is 150 px): the paused round's call (Eric: "make it taller
 *   and bigger, so it really feels like a true overwhelmingly large kind of building"). Its oval is 14.8 squares across, 11.8 deep.
 * - **The portal:** a frontispiece of dressed stone four squares wide on the front line, lower than the wall: the gate (a dark tunnel, the
 *   portcullis raised, the sunlit floor at its end), the tablet over it and the relief of chess pieces over that.
 *
 * Its palette and light are today's picture's (coliseum.ts). Pure data and pictures: no canvas.
 */
import type { Character, Layer, Part } from "../../characters/sprite.ts";
import { box, character, flatRoof, quadF, sideArt, type Face, type Piece, type TownBox } from "../town-kit.ts";
import { signFace, TORCH, type LightPool, type LightSpot } from "./kit.ts";
import { COLISEUM_PALETTE, COLISEUM_PARTS, COLISEUM_SIZES } from "./coliseum.ts";
import { CAVEA, CHORD, COL_SCALE, RING, RING_M, RING_PX, RING_W, WALL_H, PORTAL_DEPTH, PORTAL_W } from "./coliseum-shape.ts";
export { CAVEA, CHORD, OVAL, RING, RING_M, RING_PX, WALL_H, PORTAL_DEPTH, PORTAL_W, type RingSeg } from "./coliseum-shape.ts";

const SQ = 37;
const W = RING_W;
/** The rim's depth (squares) and the podium's height (px). */
const RIM = 0.35;
const PODIUM = 26;

// ---- The palette: today's picture's (travertine, the board's squares, navy and gold, marble, bronze), with the kit's wall and trim keys
// (a b c, g G) on its stone, so the kit's sides and the roof tiles paint in it.
const PAL: Record<string, string> = {
  ...COLISEUM_PALETTE,
  a: COLISEUM_PALETTE["4"]!,
  b: COLISEUM_PALETTE["3"]!,
  c: COLISEUM_PALETTE["2"]!,
  g: COLISEUM_PALETTE["1"]!,
  G: COLISEUM_PALETTE["3"]!,
  i: "#34466a",
  j: "#8fb4d9",
  I: "#d9ecfb",
};

// ---- The outer wall, square on: two bays a stretch.

/** Its tiers (px over its foot): each starts, its arches' height and half width, its cornice's foot. */
const TIERS = [
  { h0: 8, arch: 58, r: 13.5, top: 72 },
  { h0: 80, arch: 50, r: 12.5, top: 140 },
  { h0: 148, arch: 44, r: 11.5, top: 200 },
] as const;
const ATTIC0 = 206;
const CHECK0 = 238;
const CHECK = 8;
const LIP0 = 254;
const BAYS = 2;
const BAY = W / BAYS;

/** Is (ax, h) inside an arch of half width r, its foot at h0 and its crown at top? (ax: across from its middle.) */
const inArch = (ax: number, h: number, h0: number, top: number, r: number) => h >= h0 && (h < top - r ? Math.abs(ax) < r : ax * ax + (h - (top - r)) ** 2 < r * r);
/** A small marble pawn standing in an arch (`ax` across its arch's middle, `j` up from the arch's foot). */
function archPawn(ax: number, j: number): string | null {
  const w = j < 3 ? 6 : j < 10 ? 6 - (j - 3) * 0.45 : j < 12 ? 5 : j < 13 ? 2.5 : j < 21 ? Math.sqrt(Math.max(0, 16 - (j - 16.5) ** 2)) : 0;
  if (w <= 0 || Math.abs(ax) > w) return null;
  return ax < -w * 0.35 ? "M" : ax > w * 0.4 ? "o" : "m";
}

/** The wall's key at (x, h): x px from the stretch's left, h up from its foot. `bay0`: the first bay's number round the ring. */
function wallKey(x: number, h: number, bay0: number): string | null {
  const bi = Math.floor(x / BAY);
  const bx = x - bi * BAY;
  const ax = bx + 0.5 - BAY / 2;
  const stone = (base: string) => (h % 9 === 0 ? "4" : (Math.floor(x / 4) + Math.floor(h / 9)) % 7 === 0 && h % 9 > 5 ? "3" : base);
  if (h < 0) return null;
  if (h < 8) return h < 2 ? "5" : h % 3 === 0 ? "4" : "3"; // the steps
  if (h >= LIP0) return h >= WALL_H - 1 ? "k" : h >= WALL_H - 3 ? "1" : h === LIP0 ? "5" : "2"; // the lip
  if (h >= CHECK0) return (Math.floor(x / CHECK) + Math.floor((h - CHECK0) / CHECK)) % 2 ? "L" : "D"; // the attic's checkered band
  // The engaged columns on the piers: lit on their left.
  const col = Math.min(bx, BAY - bx);
  const onCol = col < 4.5;
  for (const t of TIERS) {
    if (h >= t.top && h < t.top + 8) return h - t.top < 2 ? "1" : h - t.top === 7 ? "5" : (Math.floor(x / 3) % 2 && h - t.top === 5 ? "3" : "2"); // a cornice
    if (h < t.h0 || h >= t.top) continue;
    if (inArch(ax, h, t.h0, t.h0 + t.arch, t.r)) {
      // Inside: dark, its right jamb lit (the light from the left), and a marble pawn in every other of the middle tier's.
      if (t === TIERS[1] && (bay0 + bi) % 2 === 0) {
        const p = archPawn(ax, h - t.h0);
        if (p) return p;
      }
      return ax > t.r - 3 ? "X" : "x";
    }
    // The arch's ring of stones (lit above left), the pier.
    if (inArch(ax, h, t.h0, t.h0 + t.arch + 3, t.r + 3)) return h > t.h0 + t.arch - t.r ? (ax < 0 ? "1" : "3") : ax < 0 ? "2" : "4";
    if (onCol) return bx < BAY / 2 ? (col < 1 ? "4" : "3") : col < 1.5 ? "1" : "2";
    return stone("2");
  }
  // The attic: pilasters over the columns, a small square window in each bay.
  if (h >= ATTIC0) {
    if (onCol) return bx < BAY / 2 ? "3" : "1";
    if (Math.abs(ax) < 5 && h >= ATTIC0 + 10 && h < ATTIC0 + 24) return ax > 2 ? "X" : "x";
    return stone("2");
  }
  return stone("2");
}

/** The banner's place (px from the stretch's left) on the four stretches either side of the portal: on the pier between its two bays. */
const BAN_X = BAY;
/** Which stretches carry a banner (either side of the front, two each), and the one with the flag (the front's, behind the portal). */
export const BANNER_SEGS: ReadonlySet<number> = new Set([1, 2, RING_M - 1, RING_M - 2]);
const FLAG_SEG = 0;
const FLAG_UP = 84;

const fronts = new Map<string, Character>();
/** A stretch's outer wall (its banner or flag as it has them), shared by every stretch that looks the same. */
function frontOf(k: number): Character {
  const banner = BANNER_SEGS.has(k);
  const flagged = k === FLAG_SEG;
  const bay0 = (k * BAYS) % 2;
  const key = `ring-front-${banner ? "b" : flagged ? "f" : "p"}${bay0}`;
  const had = fronts.get(key);
  if (had) return had;
  const up = flagged ? FLAG_UP : 0;
  const H = WALL_H + up + 3;
  const F = H - 3;
  const parts: Record<string, Part> = {};
  const layers: (Layer & { wave?: unknown })[] = [];
  const wall = box(0, F - WALL_H, W, WALL_H, (_i, _j, x, y) => wallKey(x, F - 1 - y, bay0), false);
  parts.wall = wall.part;
  layers.push({ part: "wall", x: wall.at[0], y: wall.at[1] });
  const frames = [0, 1, 2, 3].map((f) => ({ ms: 260, layers: [...layers] as Layer[], ph: (f * Math.PI) / 2 }));
  if (banner) {
    const [bw, bh] = COLISEUM_SIZES.banner;
    parts.banner = COLISEUM_PARTS.banner;
    // Hung from the attic's foot down over the upper tiers, scaled to the taller wall: the same banner, twice (one under the other)
    // would read as two; one long banner reads as today's.
    for (const fr of frames)
      fr.layers.push({ part: "banner", x: Math.round(BAN_X - bw / 2), y: F - ATTIC0 + 2, wave: { along: "rows", amp: 1.4, len: 48, phase: fr.ph + k * 1.4, pin: "top" } } as Layer);
    void bh;
  }
  if (flagged) {
    // The flag on its mast over the rim, behind the portal.
    const mast = box(W / 2 - 1, F - WALL_H - FLAG_UP, 2, FLAG_UP, (_i, j, x) => (j < 2 ? "y" : x === Math.floor(W / 2 - 1) ? "w" : "W"), false);
    parts.mast = mast.part;
    parts.flag = COLISEUM_PARTS.flag;
    for (const fr of frames) {
      fr.layers.push({ part: "mast", x: mast.at[0], y: mast.at[1] });
      fr.layers.push({ part: "flag", x: Math.round(W / 2 + 1), y: F - WALL_H - FLAG_UP + 1, wave: { along: "cols", amp: 2.4, len: 34, phase: fr.ph + 0.6, pin: "left" } } as Layer);
    }
  }
  const ch: Character = {
    id: key,
    name: "The Colosseum",
    w: W,
    h: H,
    foot: [Math.floor(W / 2), F],
    palette: PAL,
    parts,
    anims: { idle: { loop: true, frames: frames.map((fr) => ({ ms: banner || flagged ? fr.ms : 1000, layers: fr.layers })).slice(0, banner || flagged ? 4 : 1) } },
  };
  fronts.set(key, ch);
  return ch;
}

/**
 * Stretch k as a box: its outer wall, and its roof: the rim on top, the seats stepping down inward to the podium, the podium's wall. Its
 * inner edges are cut to meet its neighbours' (the ring turns at each corner), so the seats run round unbroken. Its own box: px a square
 * W / CHORD, no sides (its neighbours butt against it), no taper (the faces carry the cut).
 */
const ringBoxes: TownBox[] = [];
export function ringBox(k: number): TownBox {
  const had = ringBoxes[k];
  if (had) return had;
  const s = RING[k]!;
  const D = CAVEA;
  // How far in from each end (px along the front) an inner edge `d` squares in starts: the corner's mitre.
  const inL = (d: number) => Math.tan(s.turnL / 2) * d * RING_PX;
  const inR = (d: number) => W - Math.tan(s.turnR / 2) * d * RING_PX;
  const tr = RIM / D;
  const faces: Face[] = [
    // The rim: flat, on top.
    quadF([0, 0, WALL_H], [W, 0, WALL_H], [inR(RIM), tr, WALL_H], [inL(RIM), tr, WALL_H], "wallstone", "u", false),
    // The seats: from the rim down to the podium's top.
    quadF([inL(RIM), tr, WALL_H - 6], [inR(RIM), tr, WALL_H - 6], [inR(D), 1, PODIUM], [inL(D), 1, PODIUM], "seats", "u"),
    // The podium's wall, facing the arena.
    quadF([inR(D), 1, 0], [inL(D), 1, 0], [inL(D), 1, PODIUM], [inR(D), 1, PODIUM], "podium", "u"),
  ];
  const tb: TownBox = {
    id: `ring-${k}`, front: frontOf(k), lights: [], lot: { w: Math.ceil(CHORD), d: Math.ceil(D) }, inset: 0, depth: D, body: { x0: 0, x1: W },
    left: null, right: null, roof: faces, roofPal: PAL, taper: 1, px: RING_PX,
  };
  ringBoxes[k] = tb;
  return tb;
}

// ---- The portal: before the front of the oval, on the plaza's back line, the Colosseum's own box.

/** Its height (px over its foot). */
const PORTAL_H = 206;
const PCX = PORTAL_W / 2;
const GATE_R = 27;
const GATE_H = 100;
const [TW, TH] = COLISEUM_SIZES.tablet;
const [RW, RH] = COLISEUM_SIZES.relief;

function portalFront(): { ch: Character; sign: { x: number; y: number; w: number; h: number }; lights: LightSpot[]; pools: LightPool[] } {
  const H = PORTAL_H + 3;
  const F = H - 3;
  const P: Piece[] = [];
  const tabY = F - GATE_H - 14 - TH;
  const relY = tabY - 8 - RH;
  P.push(
    box(0, F - PORTAL_H, PORTAL_W, PORTAL_H, (i, j) => {
      const h = F - 1 - (F - PORTAL_H + j);
      const ax = i + 0.5 - PCX;
      // The top: a cornice and a low attic band of the board's squares.
      if (h >= PORTAL_H - 4) return h === PORTAL_H - 1 ? "k" : "1";
      if (h >= PORTAL_H - 16) return (Math.floor(i / 6) + Math.floor((h - (PORTAL_H - 16)) / 6)) % 2 ? "L" : "D";
      if (h >= PORTAL_H - 22) return h === PORTAL_H - 22 ? "5" : "2";
      if (h < 8) return h < 2 ? "5" : h % 3 === 0 ? "4" : "3";
      // The gate: a dark tunnel, the portcullis raised (its spikes over the opening), the sunlit board at its end.
      if (inArch(ax, h, 8, 8 + GATE_H, GATE_R)) {
        if (h > 8 + GATE_H - 18 && Math.abs(ax) % 6 < 1.5) return h < 8 + GATE_H - 14 ? "y" : "k";
        if (h < 22 && Math.abs(ax) < GATE_R - 8) return (Math.floor((ax + 40) / 5) + Math.floor(h / 5)) % 2 ? "L" : "D";
        if (h < 34 && Math.abs(ax) < GATE_R - 6) return "X";
        return ax > GATE_R - 4 ? "X" : "z";
      }
      // Its ring of dressed stones, a keystone.
      if (inArch(ax, h, 8, 8 + GATE_H + 6, GATE_R + 6)) return h > 8 + GATE_H - GATE_R ? (Math.abs(ax) < 4 ? "1" : ax < 0 ? "1" : "3") : ax < 0 ? "2" : "4";
      // Two pairs of pilasters, lit on their left.
      for (const px of [10, 26, PORTAL_W - 26, PORTAL_W - 10]) if (Math.abs(i + 0.5 - px) < 5) return i + 0.5 < px - 2 ? "1" : i + 0.5 > px + 2 ? "4" : "2";
      // Dressed stone courses.
      return h % 10 === 0 ? "4" : (Math.floor(i / 12) + Math.floor(h / 10)) % 5 === 0 && h % 10 > 6 ? "3" : "2";
    }, false),
  );
  const parts: Record<string, Part> = {};
  const layers: Layer[] = [];
  P.forEach((p, n) => {
    parts[`p${n}`] = p.part;
    layers.push({ part: `p${n}`, x: p.at[0], y: p.at[1] });
  });
  parts.tablet = COLISEUM_PARTS.tablet;
  parts.relief = COLISEUM_PARTS.relief;
  const tx = Math.round(PCX - TW / 2);
  layers.push({ part: "tablet", x: tx, y: tabY }, { part: "relief", x: Math.round(PCX - RW / 2), y: relY });
  const ch: Character = {
    id: "coliseum-portal", name: "The Colosseum", w: PORTAL_W, h: H, foot: [Math.floor(PCX), F], palette: PAL, parts,
    anims: { idle: { loop: true, frames: [{ ms: 1000, layers }] } },
  };
  return {
    ch,
    sign: signFace(tx, tabY, TW, TH),
    lights: [{ x: PCX - GATE_R, y: F - 8 - GATE_H, w: 2 * GATE_R + 1, h: GATE_H, keys: "zxXLD", color: TORCH, strength: 0.85, flicker: true }],
    pools: [{ x: PCX, y: F - 1, rx: 34, ry: 8, color: TORCH, strength: 0.3 }],
  };
}
export const PORTAL = portalFront();
/** The portal's box: its front, its stone sides, a flat roof. */
export const PORTAL_BOX: TownBox = (() => {
  const D = Math.round((PORTAL_DEPTH * SQ) / COL_SCALE);
  const side = { mat: "stone" as const, rows: [], trim: [0, 30] };
  return {
    id: "coliseum-portal", front: PORTAL.ch, lights: PORTAL.lights, sign: PORTAL.sign, lot: { w: 4, d: 1 }, inset: 0, depth: PORTAL_DEPTH,
    body: { x0: 0, x1: PORTAL_W }, left: sideArt("coliseum-portal-L", PAL, side, D, PORTAL_H - 4, true), right: sideArt("coliseum-portal-R", PAL, side, D, PORTAL_H - 4, false),
    roof: flatRoof(0, PORTAL_W, PORTAL_H - 3, "wallstone"), roofPal: PAL, taper: 1, px: SQ / COL_SCALE,
  };
})();
