/**
 * The Hidden Boss's building (Nov 13, Eric's 1940s photo, notes/mockups/2026-11-12-eric-hidden-boss-building-ref.webp): an old Brooklyn
 * corner walk-up, drawn by hand in code in the homes' pixel style. 144 x 224, foot [72, 218]. Four stories of red-brown brick with stone
 * quoins; a bracketed cornice with dentils and a raised middle pediment; every upper window under an arched stone hood with its keystone
 * (the top floor's windows round-headed, as the photo's); a stone belt course over the ground floor; a black iron fire escape zigzagging
 * down the east bays (a balcony at each upper floor, a stair between, the drop ladder hung over the sidewalk); on the ground floor a
 * little shop under a green-and-cream striped awning (west), the stoop and the building's arched front door (its middle at x 90), and a
 * barred window (east). No address plate, no name on it (Eric): its sign is no sign (`HOUSE_RECLUSE_SIGN` is empty: the game writes
 * nothing). Idle: 4 frames (2.4 s): the lace curtain in the top floor's lit window stirs.
 */
import type { Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import type { LightPool, LightSpot } from "./kit.ts";
import { bits, blob, cropBit, cv, hash, line, put, rect, type Bit, type Cv } from "../shops/bakery-kit.ts";

const PALETTE: Record<string, string> = {
  k: "#1d1210", // outline
  // Brick: mortar, dark, mid, light (red-brown), a darker burnt header now and then.
  a: "#6e4a3c",
  b: "#7a3326",
  c: "#93412f",
  d: "#a8523b",
  e: "#5e261d",
  // Brownstone trim (quoins, hoods, sills, the belt course, the cornice): deep, mid, light, lit.
  s: "#5d4636",
  t: "#87684f",
  u: "#a88a6b",
  v: "#c9ad8a",
  // The cornice's sheet metal (painted dark green-grey): deep, mid, light.
  m: "#2c3330",
  n: "#46504a",
  o: "#68746b",
  // Window glass: dark, its glint; lit (warm), lit bright; the lace curtain.
  g: "#1e2630",
  h: "#4a5a6a",
  "8": "#6b4a2a",
  "9": "#e8b25a",
  w: "#efe6d2",
  W: "#cfc3a8",
  // Window sashes and the door: painted cream; the door's dark green and its shade; brass.
  f: "#e6dcc4",
  F: "#b9ac90",
  q: "#24402f",
  Q: "#173022",
  y: "#d8b04a",
  // Iron (the fire escape, the grille): black, its lit edge.
  i: "#14161a",
  j: "#3c424a",
  // The awning: green, its shade, cream, its shade.
  G: "#2f6b45",
  H: "#24533a",
  C: "#efe3c2",
  D: "#cdbd98",
  // The shop's window: its goods (cans, apples, a sack), its dark inside.
  r: "#b8432e",
  R: "#e0a23a",
  p: "#7a8f3a",
  P: "#2a2420",
  // Sidewalk step, stoop.
  z: "#8d8a82",
  Z: "#b2aea3",
  // Ground shadow (see-through).
  "`": "#0d0e1280",
};

const HW = 144;
const HH = 224;
const HCX = 72;
const HFOOT = 218;
/** The body's walls (px). */
const L = 8;
const R = HW - 8;
/** The cornice's top line, the frieze's foot, each upper floor's height and the first's top, the belt course, the ground floor. */
const CORNICE = 10;
const FRIEZE = 30;
const FLOOR_H = 44;
const FLOORS = 3;
const FLOOR0 = FRIEZE + 2;
const BELT = FLOOR0 + FLOORS * FLOOR_H;
const GROUND = BELT + 5;
/** The window bays' middles (px), and a window's width. The fire escape hangs over the east pair. */
const BAYS = [26, 54, 90, 118] as const;
const WIN_W = 14;
const WIN_H = 25;
/** The front door's middle (px): home-boxes.ts HOME_SPECS.recluse.door. */
export const HOUSE_RECLUSE_DOOR = 90;
/** The fire escape's span (px). */
const FE = { x0: 74, x1: 134 } as const;

/** The top of an upper floor's windows (`k` 0: the top floor). */
const winTop = (k: number) => FLOOR0 + k * FLOOR_H + 11;

function brick(c: Cv, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const row = Math.floor(y / 3);
      if (y % 3 === 2) {
        put(c, x, y, "a");
        continue;
      }
      const off = (row % 2) * 3;
      if ((x + off) % 6 === 0) {
        put(c, x, y, "a");
        continue;
      }
      const n = hash(Math.floor((x + off) / 6), row, 7);
      put(c, x, y, n < 0.07 ? "e" : n < 0.4 ? "b" : n < 0.9 ? "c" : "d");
    }
}

/** A window: its brownstone sill, cream sash, the glass (dark, a glint; lit for `lit`), its arched or segmental hood with a keystone. */
function window(c: Cv, cx: number, top: number, round: boolean, lit: boolean): void {
  const x0 = cx - WIN_W / 2;
  // The hood: a stone arch over the opening (round-headed windows' follows their head), its keystone.
  const r = WIN_W / 2 + 3;
  const hy = top + (round ? 6 : 3);
  for (let y = hy - r; y <= hy; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - hy) * (round ? 1 : 1.6));
      if (d <= r && d > r - 3) put(c, x, y, d > r - 1 ? "s" : y < hy - r + 2 ? "v" : "u");
    }
  rect(c, cx - 2, hy - r - 1, 4, 5, (i, j) => (j === 0 ? "v" : i === 3 ? "s" : "u"));
  // The opening: the sash's frame, two panes over two; a round head's glass follows the arch.
  for (let y = top; y < top + WIN_H; y++)
    for (let x = x0; x < x0 + WIN_W; x++) {
      const head = round && y < top + 6 && Math.hypot(x + 0.5 - cx, y + 0.5 - (top + 6)) > WIN_W / 2;
      if (head) continue;
      const frame = x === x0 || x === x0 + WIN_W - 1 || y === top + WIN_H - 1 || y === top + 12 || (round && y === top) || (!round && y === top) || x === cx;
      if (frame) put(c, x, y, x === x0 ? "F" : "f");
      else put(c, x, y, lit ? (y < top + 6 ? "9" : "8") : (x - x0 + y) % 11 === 0 || (x === x0 + 2 && y < top + 9) ? "h" : "g");
    }
  // The sill.
  rect(c, x0 - 2, top + WIN_H, WIN_W + 4, 2, (i, j) => (j === 0 ? "v" : "t"));
}

/** The iron fire escape: a balcony under each upper floor's east windows, a stair between, the drop ladder. */
function fireEscape(c: Cv): void {
  const levels = Array.from({ length: FLOORS }, (_, k) => winTop(k) + WIN_H + 2);
  for (const y of levels) {
    // The platform (seen a little from below: two rows), its railing (a top rail, bars), the brackets under it.
    rect(c, FE.x0, y, FE.x1 - FE.x0, 2, (i, j) => (j === 0 ? "j" : "i"));
    rect(c, FE.x0, y - 9, FE.x1 - FE.x0, 1, "i");
    rect(c, FE.x0, y - 5, FE.x1 - FE.x0, 1, "i");
    for (let x = FE.x0; x < FE.x1; x += 3) rect(c, x, y - 9, 1, 9, "i");
    put(c, FE.x0, y - 10, "j");
    put(c, FE.x1 - 1, y - 10, "j");
    for (const bx of [FE.x0 + 4, FE.x1 - 5]) line(c, bx, y + 2, bx + (bx < HCX + 40 ? 4 : -4), y + 6, "i");
  }
  // The stairs zigzag: from each balcony down to the next, alternating which way they run.
  for (let k = 0; k < FLOORS - 1; k++) {
    const yA = levels[k]! + 1;
    const yB = levels[k + 1]! - 1;
    const [xA, xB] = k % 2 === 0 ? [FE.x0 + 6, FE.x1 - 16] : [FE.x1 - 8, FE.x0 + 14];
    line(c, xA, yA, xB, yB, "i", 2);
    line(c, xA, yA - 5, xB, yB - 5, "i");
    const n = 7;
    for (let s = 1; s < n; s++) {
      const x = xA + ((xB - xA) * s) / n;
      const y = yA + ((yB - yA) * s) / n;
      line(c, x, y, x, y - 5, "j");
    }
  }
  // The drop ladder, hung from the lowest balcony, its foot well over the sidewalk.
  const y = levels[FLOORS - 1]! + 2;
  const lx = FE.x1 - 12;
  rect(c, lx, y, 1, 12, "i");
  rect(c, lx + 6, y, 1, 12, "i");
  for (let r = y + 2; r < y + 12; r += 3) rect(c, lx, r, 7, 1, "j");
}

function makeHouse(): Character {
  const frames: Bit[][] = [];
  for (let f = 0; f < 4; f++) {
    const c = cv(HW, HH);
    // ---- The walls: brick from the frieze to the ground; stone quoins at both corners.
    brick(c, L, FRIEZE - 6, R, HFOOT);
    for (let y = FRIEZE - 6; y < BELT; y++)
      for (const [x0, x1] of [[L, L + 6], [R - 6, R]] as const) {
        const block = Math.floor((y - FRIEZE) / 7);
        const long = block % 2 === 0;
        for (let x = x0; x < x1; x++) {
          const edgeX = x0 === L ? x - x0 : x1 - 1 - x;
          if (!long && edgeX > 3) continue;
          put(c, x, y, (y - FRIEZE) % 7 === 6 ? "s" : edgeX === 0 ? "s" : edgeX === 1 ? "v" : "u");
        }
      }
    // ---- The cornice: a cap, deep sheet-metal brackets with shadows between, dentils, the frieze with its panels.
    rect(c, L - 4, CORNICE, R - L + 8, 3, (i, j) => (j === 0 ? "o" : "n"));
    rect(c, L - 3, CORNICE + 3, R - L + 6, 6, (i, j) => (i % 9 < 3 ? (j < 5 ? "o" : "n") : j < 2 ? "m" : "n"));
    rect(c, L - 2, CORNICE + 9, R - L + 4, 3, (i, j) => (j === 2 ? "m" : i % 3 === 0 ? "m" : "o"));
    rect(c, L - 1, CORNICE + 12, R - L + 2, 2, "s");
    // The frieze: brownstone with a row of sunk panels and small round bosses.
    rect(c, L, CORNICE + 14, R - L, FRIEZE - CORNICE - 14, (i, j) => (j === 0 ? "v" : "u"));
    for (let x = L + 4; x < R - 10; x += 14) {
      rect(c, x, CORNICE + 16, 10, 3, (i, j) => (j === 0 || i === 0 ? "s" : "t"));
      blob(c, x + 12, CORNICE + 17.5, 1.6, 1.6, () => "v");
    }
    rect(c, L, FRIEZE - 1, R - L, 1, "s");
    // The raised middle: a little segmental pediment over the cornice's middle, its tympanum with a sunburst, two finials at the ends.
    for (let y = 0; y < CORNICE; y++)
      for (let x = HCX - 24; x <= HCX + 24; x++) {
        const top = CORNICE - Math.round(Math.sqrt(Math.max(0, 1 - ((x - HCX) / 24) ** 2)) * (CORNICE - 1));
        if (y < top) continue;
        put(c, x, y, y === top ? "o" : y < top + 2 ? "n" : (Math.atan2(CORNICE - y, x - HCX) * 6) % 1 < 0.45 ? "u" : "t");
      }
    for (const x of [L - 3, R + 1]) {
      rect(c, x, CORNICE - 6, 2, 6, (i) => (i === 0 ? "o" : "n"));
      put(c, x, CORNICE - 7, "o");
      put(c, x + 1, CORNICE - 7, "n");
    }
    // ---- The upper floors' windows: the top floor's round-headed, the others' under segmental hoods. A few windows lit; the top
    // floor's west-middle one (the child's room) is lit warm, its lace curtain stirring.
    for (let k = 0; k < FLOORS; k++)
      BAYS.forEach((bx, i) => {
        const lit = (k === 0 && i === 1) || (k === 1 && i === 3) || (k === 2 && i === 0);
        window(c, bx, winTop(k), k === 0, lit);
      });
    {
      // The lace curtain in the child's window: hung from the head, drawn back to one side, its hem swaying (frames 0 to 3).
      const top = winTop(0);
      const x0 = BAYS[1] - WIN_W / 2 + 1;
      const sway = [0, 1, 2, 1][f]!;
      for (let y = top + 3; y < top + WIN_H - 2; y++) {
        const w = 3 + Math.round(((y - top) / WIN_H) * 2) + (y > top + 15 ? sway : 0);
        for (let x = x0; x < x0 + w; x++) if (c[y]![x] !== "f" && c[y]![x] !== "F") put(c, x, y, (x + y) % 3 === 0 ? "W" : "w");
      }
    }
    // ---- The belt course over the ground floor.
    rect(c, L - 2, BELT, R - L + 4, 5, (i, j) => (j === 0 ? "v" : j === 4 ? "s" : "u"));
    // ---- The ground floor (brownstone-faced): the shop (west), the stoop and the front door, the barred window (east).
    for (let y = GROUND; y < HFOOT; y++) for (let x = L; x < R; x++) put(c, x, y, (y - GROUND) % 6 === 5 ? "s" : hash(x >> 2, y, 3) < 0.05 ? "v" : "u");
    // The shop: its big window, the goods behind the glass, a door at its east end.
    const SH = { x0: L + 4, x1: 72, y0: GROUND + 14, y1: HFOOT - 4 };
    rect(c, SH.x0 - 2, SH.y0 - 2, SH.x1 - SH.x0 + 4, SH.y1 - SH.y0 + 4, "s");
    rect(c, SH.x0, SH.y0, SH.x1 - SH.x0, SH.y1 - SH.y0, (i, j) => (j > SH.y1 - SH.y0 - 8 ? (j === SH.y1 - SH.y0 - 8 ? "F" : "f") : "P"));
    // (The goods: a pyramid of cans, a crate of apples, a sack; a hanging sign's blank card.)
    for (let r = 0; r < 3; r++) for (let i = 0; i <= r; i++) rect(c, SH.x0 + 9 - r * 3 + i * 6, SH.y1 - 14 + r * 4 - 8, 5, 4, (u, v) => (v === 0 ? "R" : "r"));
    for (let i = 0; i < 5; i++) blob(c, SH.x0 + 26 + i * 4, SH.y1 - 11, 2.2, 2, (dx, dy) => (dy < -0.3 ? "R" : "r"));
    rect(c, SH.x0 + 24, SH.y1 - 9, 20, 2, "8");
    blob(c, SH.x0 + 51, SH.y1 - 13, 5, 6, (dx, dy) => (dx < -0.2 ? "D" : "C"));
    line(c, SH.x0 + 2, SH.y0 + 14, SH.x0 + 9, SH.y0 + 2, "h");
    line(c, SH.x0 + 34, SH.y0 + 16, SH.x0 + 41, SH.y0 + 4, "h");
    rect(c, SH.x1 - 1, SH.y0, 1, SH.y1 - SH.y0, "F");
    // The awning: green and cream stripes sloping out over the shop, a scalloped valance.
    const AW = { x0: L - 2, x1: 76, y0: GROUND + 1, y1: GROUND + 13 };
    for (let y = AW.y0; y <= AW.y1 + 3; y++)
      for (let x = AW.x0; x < AW.x1; x++) {
        const reach = (x - AW.x0) % 8;
        if (y > AW.y1 && Math.hypot(reach - 4, (y - AW.y1) * 1.3) > 4) continue;
        const stripe = Math.floor((x - AW.x0) / 4) % 2 === 0;
        put(c, x, y, y === AW.y0 ? "H" : stripe ? (y > AW.y1 - 2 ? "H" : "G") : y > AW.y1 - 2 ? "D" : "C");
      }
    // The stoop and the front door: a brownstone arch with its keystone, the dark green double door with two glass lights, the transom.
    const D = { cx: HOUSE_RECLUSE_DOOR, w: 16, y0: GROUND + 9 };
    const dx0 = D.cx - D.w / 2;
    for (let y = D.y0 - 9; y < HFOOT - 4; y++)
      for (let x = dx0 - 4; x < dx0 + D.w + 4; x++) {
        const arch = y < D.y0 ? Math.hypot(x + 0.5 - D.cx, y + 0.5 - D.y0) : 0;
        if (y < D.y0 && arch > D.w / 2 + 4) continue;
        const inner = y < D.y0 ? arch <= D.w / 2 : x >= dx0 && x < dx0 + D.w;
        if (!inner) put(c, x, y, x === dx0 - 4 || (y < D.y0 && arch > D.w / 2 + 3) ? "s" : "v");
        else if (y < D.y0) put(c, x, y, (Math.round(x - D.cx) % 3 === 0) ? "f" : "g");
        else if (y === D.y0) put(c, x, y, "f");
        else put(c, x, y, x === dx0 || x === D.cx ? "Q" : (y > D.y0 + 3 && y < D.y0 + 14 && (x - dx0) % 8 > 1 && (x - dx0) % 8 < 6) ? "h" : "q");
      }
    rect(c, D.cx - 2, D.y0 - 14, 4, 5, (i, j) => (j === 0 ? "v" : "u"));
    put(c, D.cx - 2, D.y0 + 18, "y");
    put(c, D.cx + 1, D.y0 + 18, "y");
    // Two steps up to it.
    rect(c, dx0 - 6, HFOOT - 4, D.w + 12, 2, (i, j) => (j === 0 ? "Z" : "z"));
    rect(c, dx0 - 8, HFOOT - 2, D.w + 16, 2, (i, j) => (j === 0 ? "Z" : "z"));
    // An iron railing each side of the stoop.
    for (const x of [dx0 - 6, dx0 + D.w + 5]) {
      rect(c, x, HFOOT - 13, 1, 9, "i");
      put(c, x, HFOOT - 14, "j");
    }
    // The barred window (east): its glass, the iron grille.
    const BW = { x0: 108, x1: R - 8, y0: GROUND + 8, y1: HFOOT - 10 };
    rect(c, BW.x0 - 2, BW.y0 - 2, BW.x1 - BW.x0 + 4, BW.y1 - BW.y0 + 4, "s");
    rect(c, BW.x0, BW.y0, BW.x1 - BW.x0, BW.y1 - BW.y0, (i, j) => ((i + j) % 9 === 0 ? "h" : "g"));
    for (let x = BW.x0 + 2; x < BW.x1; x += 4) rect(c, x, BW.y0 - 1, 1, BW.y1 - BW.y0 + 1, "i");
    rect(c, BW.x0 - 1, BW.y0 + 6, BW.x1 - BW.x0 + 2, 1, "i");
    rect(c, BW.x0 - 2, BW.y1 + 2, BW.x1 - BW.x0 + 4, 2, (i, j) => (j === 0 ? "v" : "t"));
    // ---- The fire escape, over the east bays.
    fireEscape(c);
    // ---- The ground shadow.
    const sh = cv(HW, HH);
    blob(sh, HCX, HFOOT, 68, 4, (dx, dy) => (dy > -0.1 ? "`" : null));
    frames.push(bits(cropBit(sh, false), cropBit(c, true)));
  }
  const parts: Record<string, Part> = {};
  const fr: Frame[] = frames.map((bs, f) => ({
    ms: 600,
    layers: bs.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] } as Layer;
    }),
  }));
  return { id: "house-recluse", name: "The walk-up", w: HW, h: HH, foot: [HCX, HFOOT], palette: PALETTE, parts, anims: { idle: { loop: true, frames: fr } } };
}

/** The walk-up in the town: 144 x 224, its foot [72, 218]. Idle: 4 frames (2.4 s): the top floor's lace curtain stirs. */
export const HOUSE_RECLUSE: Character = makeHouse();
/** No sign (Eric, Nov 12: "no address plate or name on it"): an empty face, so the game writes nothing on it (render.ts). */
export const HOUSE_RECLUSE_SIGN = { x: 0, y: 0, w: 0, h: 0 } as const;
/** Its lit windows' warm light at dusk and night (the child's window on the top floor brightest), the shop's window and the transom. */
export const HOUSE_RECLUSE_LIGHTS: readonly LightSpot[] = [
  { x: BAYS[1] - WIN_W / 2, y: winTop(0), w: WIN_W, h: WIN_H, keys: "89w", color: "#ffc070", strength: 0.9, halo: 10 },
  { x: BAYS[3] - WIN_W / 2, y: winTop(1), w: WIN_W, h: WIN_H, keys: "89", color: "#ffb85c", strength: 0.7 },
  { x: BAYS[0] - WIN_W / 2, y: winTop(2), w: WIN_W, h: WIN_H, keys: "89", color: "#ffb85c", strength: 0.7 },
  { x: L + 4, y: GROUND + 14, w: 64, h: HFOOT - GROUND - 26, keys: "P", color: "#ffcf80", strength: 0.55 },
  { x: HOUSE_RECLUSE_DOOR - 8, y: GROUND, w: 16, h: 9, keys: "g", color: "#ffd08a", strength: 0.6 },
];
/** The pool its shop window lays on the sidewalk at night. */
export const HOUSE_RECLUSE_POOLS: readonly LightPool[] = [{ x: 40, y: HFOOT + 2, rx: 30, ry: 4, color: "#ffcf80", strength: 0.35 }];
