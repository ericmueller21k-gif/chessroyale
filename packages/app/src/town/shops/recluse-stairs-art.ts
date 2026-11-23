/**
 * The Hidden Boss's walk-up, below his room (Nov 13; the brief's hall and landing): two small box rooms of 7 x 7 squares, seen as the other
 * rooms are (the camera looks north, things stand upright at their foot, 37 px a square), built as his room is (shops/recluse-art.ts:
 * every piece its own Character, `shop-recluse-<name>`, the layout). Drawn by hand in code. Smaller inside than out, as Eric allowed.
 *
 * - **The hall** (the ground floor, from the street): a tenement lobby's white hexagon mosaic with a black border; walls of dark green
 *   paint to the chair rail, cream plaster over it; two flats' doors you can't open (1A and 1B, in the back wall) with a bank of brass
 *   mailboxes between them; a wall sconce; a radiator; the stairs up at the back right (the door to the landing); the street
 *   door at the front, its glass bright with the day.
 * - **The landing** (the second floor): worn oak boards and a red runner from the stairs down (the front) to the stairs up (the back right);
 *   the same walls; flat 2A's door; a window over the airshaft; a sconce.
 *
 * A room-to-room door (room.ts `door`) is a pair of squares in a wall: the hall's stairs lead to the landing; the landing's stairs down to
 * the hall (its front) and up to the top floor (his room, whose door in its front wall leads back down).
 */
import type { Character, Frame, Part } from "../../characters/sprite.ts";
import type { LightPool, LightSpot } from "../houses/kit.ts";
import { cv, ellipse, face, hash, line, put, rect, shadow, type Cv, type Pt } from "./paper-kit.ts";
import type { ShopPlace } from "./room.ts";
import type { RoomLight } from "../sky.ts";

const T = 37;
/** Each room's size in squares, each way (`RoomArt.n`). */
export const RECLUSE_HALL_N = 7;
const N = RECLUSE_HALL_N;

const PALETTE: Record<string, string> = {
  k: "#1a1210", // outline
  // The hall's mosaic: white, its grout, the black tiles.
  "1": "#ece8de",
  "2": "#c9c3b5",
  "3": "#26221f",
  "4": "#4a443e",
  // The landing's oak boards: the gap, dark, mid, lit; the runner: red, its shade, its border's cream.
  "5": "#3a2416",
  "6": "#6e4428",
  "7": "#865533",
  "8": "#a06a40",
  r: "#8f2a24",
  R: "#6e1f1b",
  q: "#d8c08e",
  // The walls: cream plaster, its shade; the green paint, its shade, its lit edge; the chair rail and the baseboard (dark brown).
  a: "#d9cfb3",
  b: "#c4b994",
  c: "#2f4a3a",
  d: "#243a2d",
  e: "#40604c",
  W: "#3e2616",
  w: "#5e3b22",
  // Doors: dark varnished wood, its panels' shade, its lit edge; brass; the peephole.
  D: "#4a2a18",
  E: "#3a1f10",
  F: "#6a3f22",
  y: "#d8b04a",
  Y: "#8c6a1f",
  // Glass: the street's day (bright), the airshaft's grey light; the dark of the stairwell going up or down.
  s: "#cfe6f2",
  S: "#9cc2da",
  g: "#8d9aa3",
  G: "#b6c1c7",
  z: "#140d0a",
  Z: "#24170f",
  // The stairs: treads, risers, the banister's rail and spindles (dark wood), the newel post's cap.
  t: "#7a4c2c",
  u: "#5a3720",
  v: "#9c6a42",
  // The sconce's glow.
  L: "#ffe2a0",
  // The landing's window over the airshaft: the light from above, the next building's brick close outside, its mortar.
  A: "#b6c1c7",
  B: "#8d9aa3",
  C: "#4a443e",
  // Shadows on the floor (see-through): core, rim.
  "-": "#1a0e0866",
  "+": "#1a0e0833",
};

type Bit = { part: Part; at: Pt };
interface Piece {
  name: string;
  sq: readonly [number, number];
  w: number;
  h: number;
  foot: Pt;
  frames: Bit[][];
}
const PIECES: Record<string, Piece> = {};
function toChar(p: Piece, palette: Record<string, string> = PALETTE): Character {
  const parts: Record<string, Part> = {};
  const frames: Frame[] = p.frames.map((bits, f) => ({
    ms: 1000,
    layers: bits.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] };
    }),
  }));
  return { id: `shop-recluse-${p.name}`, name: `The walk-up: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, c: Cv, outline = false): void {
  PIECES[name] = { name, sq, w, h, foot, frames: [[{ part: { grid: c.map((r) => r.join("")), outline }, at: [0, 0] }]] };
}

// ==== The floors: one picture of each room's floor (7 x 7 squares), cut into its tiles (`floor-<room>-<col>-<row>`).

/** The hall's mosaic: little white hexagons, a black band round the room's edge. */
function hallPx(X: number, Y: number): string {
  const S = N * T;
  const edge = Math.min(X, Y, S - 1 - X, S - 1 - Y);
  // (Hexagons 6 px across, in staggered rows 5 px apart; their grout the gaps.)
  const row = Math.floor(Y / 5);
  const xx = (X + (row % 2) * 3) % 6;
  const yy = Y % 5;
  const grout = yy === 0 || ((xx === 0 || xx === 5) && yy !== 2);
  // The border band, two hexagons deep, a hand from the walls.
  const band = edge >= 8 && edge < 16;
  if (grout) return band ? "4" : "2";
  return band ? "3" : hash(Math.floor((X + (row % 2) * 3) / 6), row, 5) < 0.06 ? "2" : "1";
}
/** Whether a point of the landing's floor (px) is on its runner. */
const inRun = (X: number, Y: number) => {
  const cx = X / T;
  const cy = Y / T;
  return (cx > 2.2 && cx < 3.8 && cy > 0.95 && cy < N) || (cx > 2.2 && cx < 5.8 && cy > 0.95 && cy < 2.0);
};
/** The landing's oak boards running east to west, the red runner from the stairs down (front) to the stairs up (back right). */
function landingPx(X: number, Y: number): string {
  const row = Math.floor(Y / 9.25);
  const yy = Y - Math.floor(row * 9.25);
  const joint = (X + row * 53) % 97 === 0;
  let k = yy === 0 || joint ? "5" : row % 3 === 0 ? "6" : "7";
  if (k !== "5" && yy === 1) k = "8";
  else if (k !== "5" && hash(X >> 2, row, 4) < 0.06) k = "6";
  // The runner: from the stairs down (the front, columns 2-3) straight back, then along before the stairs up (columns 4-5): an L, its
  // cream border round its outside edge only.
  if (inRun(X, Y)) return !inRun(X - 3, Y) || !inRun(X + 3, Y) || !inRun(X, Y - 3) || !inRun(X, Y + 3) ? "q" : (X + Y) % 7 === 0 ? "R" : "r";
  return k;
}
for (const [room, px] of [["hall", hallPx], ["landing", landingPx]] as const)
  for (let row = 0; row < N; row++)
    for (let col = 0; col < N; col++) {
      const c = cv(T, T);
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c[y]![x] = px(col * T + x, row * T + y);
      def(`floor-${room}-${col}-${row}`, [1, 1], T, T, [18, 18], c);
    }

// ==== The walls: cream plaster over a dark green dado, a chair rail between, a baseboard.

const WALL_H = 130;
const WF: Pt = [18, WALL_H - 1];
const RAIL = 70;
function wall(seed: number, w = T): Cv {
  const c = cv(w, WALL_H);
  for (let y = 6; y < WALL_H; y++)
    for (let x = 0; x < w; x++) c[y]![x] = y < RAIL ? (hash(x >> 1, y >> 1, seed) < 0.06 ? "b" : "a") : y < RAIL + 3 ? "w" : (x + seed) % 19 === 0 ? "d" : "c";
  // A crack in the plaster now and then, the cornice line at the top.
  if (seed % 3 === 1) line(c, 6 + seed * 3, 18, 12 + seed * 3, 34, "b");
  rect(c, 0, 6, w, 3, "b");
  rect(c, 0, RAIL - 1, w, 1, "F");
  rect(c, 0, RAIL, w, 3, "w");
  rect(c, 0, RAIL + 3, w, 1, "W");
  rect(c, 0, WALL_H - 9, w, 1, "e");
  rect(c, 0, WALL_H - 8, w, 7, "W");
  rect(c, 0, WALL_H - 1, w, 1, "E");
  return c;
}
const wallDef = (name: string, c: Cv, w = 1) => def(name, [w, 1], w * T, WALL_H, w === 1 ? WF : [Math.floor((w * T) / 2), WALL_H - 1], c);
for (let i = 0; i < 4; i++) wallDef(`wall-${i}`, wall(i + 1));
/** A blank piece: solid, drawn as nothing. */
def("wall-none", [1, 1], 1, 1, [0, 0], cv(1, 1));

/** A flat's door (you can't open it: a short line on its card): varnished panels, brass knob and peephole, a brass number plate. */
{
  const c = wall(5);
  const x0 = 6;
  const w = T - 12;
  const y0 = 32;
  // The frame (dark green trim), the door's four panels, its knob, the peephole, the plate.
  rect(c, x0 - 3, y0 - 3, w + 6, WALL_H - 8 - y0 + 3, "d");
  rect(c, x0 - 2, y0 - 2, w + 4, 1, "e");
  for (let y = y0; y < WALL_H - 8; y++) for (let x = x0; x < x0 + w; x++) c[y]![x] = x === x0 ? "F" : "D";
  for (const [px, py, pw, ph] of [[x0 + 3, y0 + 4, 8, 30], [x0 + w - 11, y0 + 4, 8, 30], [x0 + 3, y0 + 42, 8, 40], [x0 + w - 11, y0 + 42, 8, 40]] as const) {
    rect(c, px, py, pw, ph, "E");
    rect(c, px + 1, py + 1, pw - 2, ph - 2, "D");
    rect(c, px, py, pw, 1, "F");
  }
  ellipse(c, x0 + w - 4, y0 + 46, 1.6, 1.6, "y");
  put(c, x0 + w - 4, y0 + 47, "Y");
  ellipse(c, x0 + w / 2, y0 + 20, 1.2, 1.2, "y");
  rect(c, x0 + w / 2 - 3, y0 + 8, 6, 4, "y");
  rect(c, x0 + w / 2 - 2, y0 + 9, 4, 2, "Y");
  // A worn mat at its foot (on the wall's foot: a dark strip).
  rect(c, x0 - 1, WALL_H - 3, w + 2, 2, "Z");
  wallDef("flat-door", c);
}
/** The mailboxes: a brass bank of six, two rows, their little slots and keyholes, a dented one. */
{
  const c = wall(6);
  const x0 = 6;
  const y0 = 34;
  rect(c, x0 - 1, y0 - 1, T - 10, 30, "Y");
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 3; i++) {
      const bx = x0 + i * 8;
      const by = y0 + j * 14;
      rect(c, bx, by, 7, 13, "y");
      rect(c, bx + 1, by + 2, 5, 1, "Y");
      put(c, bx + 3, by + 8, "Y");
      if (i === 2 && j === 1) put(c, bx + 2, by + 5, "Y");
    }
  // (The hall's sconce over them: its corners are the side walls' now.)
  rect(c, 17, 22, 3, 7, "Y");
  ellipse(c, 18.5, 18, 5, 4, (x, y, d) => (d < 0.4 ? "L" : "G"));
  wallDef("mailboxes", c);
}
/** The sconce: a little brass bracket and a frosted shade, its glow (the room's light). */
{
  const c = wall(7);
  rect(c, 17, 30, 3, 8, "Y");
  ellipse(c, 18.5, 26, 5, 5, (x, y, d) => (d < 0.4 ? "L" : "G"));
  rect(c, 14, 30, 10, 1, "y");
  wallDef("sconce", c);
}
/** The landing's window over the airshaft: grey light, the brick of the next building close outside, a sash. */
{
  const c = wall(8);
  const x0 = 6;
  const w = T - 12;
  rect(c, x0 - 2, 18, w + 4, 50, "F");
  for (let y = 20; y < 66; y++) for (let x = x0; x < x0 + w; x++) c[y]![x] = y < 30 ? "A" : (y % 4 === 0 || (x + ((y >> 2) % 2) * 3) % 6 === 0 ? "C" : "B");
  rect(c, x0, 42, w, 2, "F");
  rect(c, x0 + w / 2, 20, 1, 46, "F");
  rect(c, x0 - 3, 66, w + 6, 3, "w");
  wallDef("window", c);
}

/**
 * The stairs up (2 squares, in the back wall): the flight rising from our left to the upper right into the dark of the floor above, its
 * runner, the banister and its spindles along the open side, the newel post at its foot.
 */
function stairsUp(seed: number): Cv {
  const W = 2 * T;
  const c = wall(seed, W);
  // The stairwell's opening: dark above, the wall's paint going up with the flight.
  for (let y = 8; y < WALL_H - 8; y++) for (let x = 6; x < W - 6; x++) c[y]![x] = y < 30 ? "z" : "Z";
  // Ten steps from the foot (left, low) to the top (right, high).
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const x0 = 6 + Math.round((i * (W - 18)) / steps);
    const top = WALL_H - 10 - Math.round((i + 1) * ((WALL_H - 34) / steps));
    rect(c, x0, top, W - 6 - x0, 3, i % 2 ? "v" : "t");
    rect(c, x0, top + 3, W - 6 - x0, Math.round((WALL_H - 34) / steps) - 3, "u");
    // The runner up its middle (dark red).
    rect(c, x0 + 6, top, 10, 3, "r");
    rect(c, x0 + 6, top + 3, 10, Math.round((WALL_H - 34) / steps) - 3, "R");
  }
  // The banister: its rail sloping up with the flight, spindles down to each tread, the newel post at the foot with its cap.
  line(c, 8, WALL_H - 44, W - 8, 30, "W");
  line(c, 8, WALL_H - 43, W - 8, 31, "w");
  for (let i = 0; i < steps; i++) {
    const x = 9 + Math.round((i * (W - 18)) / steps);
    const top = WALL_H - 10 - Math.round((i + 1) * ((WALL_H - 34) / steps));
    const railY = Math.round(WALL_H - 44 + ((x - 8) * (30 - (WALL_H - 44))) / (W - 16));
    line(c, x, railY, x, top, "W");
  }
  rect(c, 5, WALL_H - 50, 6, 42, "W");
  rect(c, 6, WALL_H - 50, 2, 42, "w");
  rect(c, 4, WALL_H - 53, 8, 4, "v");
  return c;
}
{
  const c = stairsUp(9);
  def("stairs-up", [2, 1], 2 * T, WALL_H, [37, WALL_H - 1], c);
}
/** The stairs down (2 squares, the landing's front wall): the banister's rail and spindles round the stairwell, its dark going down. */
{
  const W = 2 * T;
  const H = 40;
  const c = cv(W, H);
  for (let y = 10; y < H; y++) for (let x = 2; x < W - 2; x++) c[y]![x] = y > H - 6 ? "z" : (y - 10) % 6 === 0 ? "u" : "Z";
  rect(c, 0, 4, W, 3, "W");
  rect(c, 0, 4, W, 1, "v");
  for (let x = 3; x < W - 2; x += 5) rect(c, x, 7, 2, H - 9, "W");
  rect(c, 0, 0, 5, H, "W");
  rect(c, W - 5, 0, 5, H, "W");
  rect(c, 0, 0, 5, 2, "v");
  rect(c, W - 5, 0, 5, 2, "v");
  def("stairs-down", [2, 1], W, H, [37, H - 1], c, true);
}
/** The street door (2 squares, the hall's front wall: the way out): its double doors open, the day bright through the vestibule's glass. */
{
  const EW = 2 * T;
  const EH = 112;
  const EF = EH - 1;
  const c = cv(EW, EH);
  for (let y = 18; y < EF; y++) for (let x = 12; x < EW - 12; x++) c[y]![x] = y < 40 ? "s" : y > EF - 20 ? "2" : (x + y) % 13 === 0 ? "s" : "S";
  rect(c, 2, 12, 10, EF - 12, "d");
  rect(c, 2, 12, 2, EF - 12, "e");
  rect(c, EW - 12, 12, 10, EF - 12, "d");
  rect(c, 0, 6, EW, 7, "c");
  rect(c, 0, 6, EW, 1, "e");
  // The two doors folded back against the jambs, their glass lights.
  face(c, [[12, 18], [20, 24], [20, EF - 6], [12, EF - 2]], "D", { hi: "F", lo: "E" });
  face(c, [[EW - 12, 18], [EW - 20, 24], [EW - 20, EF - 6], [EW - 12, EF - 2]], "D", { hi: "F", lo: "E" });
  rect(c, 14, 30, 4, 34, "s");
  rect(c, EW - 18, 30, 4, 34, "s");
  def("entrance", [2, 1], EW, EH, [37, EF], c, true);
}
/** The front: a low band of the dado under the wall's foot. */
{
  const HEM_H = 22;
  const c = cv(T, HEM_H);
  for (let y = 3; y < HEM_H; y++) for (let x = 0; x < T; x++) c[y]![x] = y < 6 ? "w" : (x + 7) % 19 === 0 ? "d" : "c";
  rect(c, 0, HEM_H - 5, T, 5, "W");
  def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], c);
}
/** A radiator by the wall (the hall's west wall, the landing's east): cast iron painted silver, its fins. */
{
  const W = T;
  const H = 30;
  const c = cv(W, H);
  shadow(c, W / 2, H - 2, W / 2 - 4, 2);
  for (let x = 6; x < W - 6; x += 3) rect(c, x, 4, 2, H - 7, x % 2 ? "G" : "g");
  rect(c, 5, 3, W - 10, 2, "G");
  rect(c, 5, H - 6, W - 10, 2, "g");
  def("radiator", [1, 1], W, H, [18, H - 2], c, true);
}

// ==== The lights: each room's sconce, and the hall's day through the street door.

export const RECLUSE_HALL_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "mailboxes", x: 13, y: 14, w: 11, h: 9, color: "#ffd890", strength: 0.6, halo: 30 },
  { piece: "entrance", x: 12, y: 18, w: 50, h: 60, color: "#e8f4ff", strength: 0.35, halo: 26 },
];
export const RECLUSE_HALL_POOLS: readonly (LightPool & { piece: string })[] = [{ piece: "mailboxes", x: 18, y: WALL_H + 40, rx: 44, ry: 26, color: "#ffd890", strength: 0.22 }];
export const RECLUSE_LANDING_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "sconce", x: 13, y: 21, w: 11, h: 10, color: "#ffd890", strength: 0.6, halo: 30 },
  { piece: "window", x: 6, y: 20, w: 25, h: 46, color: "#dde6ee", strength: 0.25, halo: 18 },
];
export const RECLUSE_LANDING_POOLS: readonly (LightPool & { piece: string })[] = [{ piece: "sconce", x: 18, y: WALL_H + 40, rx: 44, ry: 26, color: "#ffd890", strength: 0.22 }];

// ==== The layouts.

function layoutOf(room: "hall" | "landing"): ShopPlace[] {
  const out: ShopPlace[] = [];
  const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
    const p = PIECES[name];
    if (!p) throw new Error(`no piece ${name}`);
    out.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
  };
  for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) at(`floor-${room}-${col}-${row}`, col, row, false);
  const floors = out.length;
  // -- The back wall: the hall's flats 1A and 1B with the mailboxes (and the sconce over them) between; the landing's flat 2A, the sconce,
  // the window; the stairs up (4-5). Its corners blank: the side walls run from there.
  const back = room === "hall" ? ["wall-none", "flat-door", "mailboxes", "flat-door"] : ["wall-none", "flat-door", "sconce", "window"];
  back.forEach((name, col) => at(name, col, 0, true));
  at("stairs-up", 4, 0, false, { door: room === "hall" ? "landing" : "top" });
  at("wall-none", 6, 0, true);
  // -- The side walls: each ONE surface, as his room's (Eric, Nov 13: "build the walls in the room like we did for his room"), drawn by
  // the room's scene (side-walls.ts, `RECLUSE_STAIRS_WALLS`); here, solid blanks.
  for (let row = 1; row < N - 1; row++) {
    at("wall-none", 0, row, true);
    at("wall-none", N - 1, row, true);
  }
  // -- A radiator by a side wall.
  if (room === "hall") at("radiator", 1, 5, true);
  else at("radiator", 5, 5, true);
  // -- The front: the hall's street door (the way out, columns 2-3); the landing's stairs down (columns 2-3) to the hall.
  for (let col = 0; col < N; col++) if (col !== 2 && col !== 3) at("hem", col, N - 1, true, col >= 4 ? { flip: true } : {});
  if (room === "hall") at("entrance", 2, N - 1, false, { exit: true });
  else at("stairs-down", 2, N - 1, false, { door: "front" });
  return [...out.slice(0, floors), ...out.slice(floors).sort((a, b) => a.row - b.row || a.col - b.col)];
}

/** Where every piece goes in the hall: floor tiles first, then the upright pieces north to south. */
export const RECLUSE_HALL_LAYOUT: readonly ShopPlace[] = layoutOf("hall");
/** And on the landing. */
export const RECLUSE_LANDING_LAYOUT: readonly ShopPlace[] = layoutOf("landing");
/** Every piece of both rooms by its name, each its own Character `shop-recluse-<name>`. */
export const RECLUSE_STAIRS_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));
/** A side wall's picture, one surface `run` squares long (side-walls.ts): the plaster over the green dado, unbroken. */
export function stairsSideWallGrid(west: boolean, run: number): { grid: string[]; palette: Record<string, string> } {
  const c = wall(west ? 3 : 4, run * T);
  return { grid: c.map((r) => r.join("")), palette: PALETTE };
}
/** The height of the walls (room pixels). */
export const RECLUSE_STAIRS_WALL_H = WALL_H;
/** The camera's fixed look at the town's zoom (a small room seen whole). */
export const RECLUSE_HALL_CAM = { x: 3.0, y: 2.6 } as const;
/** The squares where each room's flats' doors are talked to (shops.ts RECLUSE_ROOMS: `talkAt`), in front of each. */
export const RECLUSE_HALL_TALK = [{ c: 1, r: 1 }, { c: 3, r: 1 }] as const;
export const RECLUSE_LANDING_TALK = [{ c: 1, r: 1 }] as const;

/**
 * The walk-up's glass by the time of day (Nov 14, as his room's: recluse-art.ts `recluseLit`): the street door's glass (`s`, `S`) and the
 * landing's window over the airshaft (`A`, `B`, `C`) recolored; the sconces stay lit. Dusk: the glass warm, the light low. Night: the
 * street dark blue through the door, the airshaft near black, the brick barely there; a gentle wash over the room, the sconce over it.
 */
const LIGHT_PALETTE: Readonly<Record<Exclude<RoomLight, "day">, Readonly<Record<string, string>>>> = {
  dusk: { s: "#f6c9a0", S: "#d89a86", A: "#e0a98c", B: "#7c6a6c", C: "#4a3a3a" },
  night: { s: "#2c3a66", S: "#1c2648", A: "#2a3558", B: "#1b2030", C: "#11141f" },
};
/** Each room's lights and wash by the time of day (the day's: as above). */
const LIGHT_OF: Readonly<Record<Exclude<RoomLight, "day">, { hall: readonly (LightSpot & { piece: string })[]; landing: readonly (LightSpot & { piece: string })[]; dim: number; dimRGB: string }>> = {
  dusk: {
    hall: [RECLUSE_HALL_LIGHTS[0]!, { ...RECLUSE_HALL_LIGHTS[1]!, color: "#ffc896", strength: 0.28 }],
    landing: [RECLUSE_LANDING_LIGHTS[0]!, { ...RECLUSE_LANDING_LIGHTS[1]!, color: "#ffcaa0", strength: 0.2 }],
    dim: 0.1,
    dimRGB: "60,30,36",
  },
  night: {
    hall: [RECLUSE_HALL_LIGHTS[0]!, { ...RECLUSE_HALL_LIGHTS[1]!, color: "#8ea4e0", strength: 0.12 }],
    landing: [RECLUSE_LANDING_LIGHTS[0]!, { ...RECLUSE_LANDING_LIGHTS[1]!, color: "#8a9cd0", strength: 0.08 }],
    dim: 0.32,
    dimRGB: "16,26,74",
  },
};
/** The hall and the landing at one time of day: their pieces (both rooms'), each room's lights, the wash (none by day). */
export interface RecluseStairsLit {
  pieces: Readonly<Record<string, Character>>;
  hall: readonly (LightSpot & { piece: string })[];
  landing: readonly (LightSpot & { piece: string })[];
  dim?: number;
  dimRGB?: string;
}
const LIT = new Map<RoomLight, RecluseStairsLit>();
/** The walk-up's hall and landing at one time of day (sky.ts `roomLight`): made the first time it's asked for, then kept. */
export function recluseStairsLit(light: RoomLight): RecluseStairsLit {
  let l = LIT.get(light);
  if (l) return l;
  if (light === "day") l = { pieces: RECLUSE_STAIRS_PIECES, hall: RECLUSE_HALL_LIGHTS, landing: RECLUSE_LANDING_LIGHTS };
  else {
    const palette = { ...PALETTE, ...LIGHT_PALETTE[light] };
    l = { ...LIGHT_OF[light], pieces: { ...RECLUSE_STAIRS_PIECES, entrance: toChar(PIECES.entrance!, palette), window: toChar(PIECES.window!, palette) } };
  }
  LIT.set(light, l);
  return l;
}
