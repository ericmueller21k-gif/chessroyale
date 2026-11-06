/**
 * Inside Smudgy's Art Gallery: his paint studio and shop (house-shop-smudgy, Nov 6). A box room of 20 x 20 squares seen as the town
 * square is seen (the camera looks north, things stand upright at their foot, 37 px a square), built as Folio's and Hollow's shops
 * are: every piece its own Character (`shop-smudgy-<name>`), the layout. Drawn by hand in code with the paint kit (paint-kit.ts).
 *
 * Eric, Nov 6: "A paint studio, tarps or canvases, a lot of different colors … darker teal, blue, darker reds, purples … as opposed to
 * a very bright clownish feel … every wall is just splattered with canvas … a lot of layers of paint … kind of abstract." So: dark
 * stained plank floors under drips and drop cloths; walls of dark teal plaster hung edge to edge with big canvases, each its own
 * layered abstract of poured skeins, splats and drips in teal, blue, oxblood and plum with a few warm highlights; easels, paint pots
 * and brush jars; the Colosseum's pixel chess pieces as sculptures on plinths round the room.
 *
 * **The life class** (Eric: "a knight standing on a rotating platform, and around it 8 [chameleons] sitting on stools … painting the
 * horse … they all do the same drawing but start at different times … a little paint thing next to them … dip their paintbrush"): the
 * Colosseum's knight (its 3D model, turned) on a round platform that turns slowly, in the middle of the room's back half; eight
 * art-student chameleons (Dabble's rig, sidekicks/smudgy.ts, in smocks, four colors) on stools in a ring round it, each at an easel
 * facing it, a paint table beside them. One loop of 32 frames for every painter (paint, paint, dip; the canvas building up blank,
 * outline, blocked colors, finished), three pieces (their colors) shared by all eight, each placed `t0` into the loop.
 *
 * **The battle spot**: a big drop cloth (tarp) on the floor in the front half, `circle-<col>-<row>` tiles (marksOf's battle circle),
 * its two marks painted on it; on it the round table under its white cloth (`table`, the intro's INTRO_SMUDGY_TABLE under its drape),
 * its stools already at it. **The shop**: a low counter at the back with a blank plaque, the gallery owner behind it
 * (sidekicks/smudgykeeper.ts), Smudgy's Boss Crate (paint-splattered wood) at its east end; behind it a wall of paint shelves.
 *
 * Footing as the other shops: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on its row). Floor
 * tiles are flat, 37 x 37, foot at their middle, and seamless. The east wall's pieces are the west's mirrored.
 */
import { frameKeys, type Character, type Frame, type Layer, type Part } from "../../characters/sprite.ts";
import { signFace, type LightPool, type LightSpot } from "../houses/kit.ts";
import { DABBLE_GROUND, DABBLE_PARTS, DABBLE_SIT, dabbleLayers, SIDEKICK_PALETTE } from "../../characters/sidekicks/smudgy.ts";
import { MODELS, drawModel, type Kind, type Model, type Side } from "../../colosseum/pieces-gba.ts";
import { PAINT_PALETTE, PAINTS, abstract, cv, drip, ellipse, face, frame, get, hash, line, put, rect, shadow, skein, splat, type Cv, type Pt } from "./paint-kit.ts";
import { coveredTableCv, stool, STOOL_SEAT, TCX, TFOOT } from "./smudgy-intro-art.ts";

const T = 37;
type Bit = { part: Part; at: Pt };
interface Piece {
  name: string;
  sq: readonly [number, number];
  w: number;
  h: number;
  foot: Pt;
  frames: Bit[][];
  ms: number;
  palette: Record<string, string>;
}
const PIECES: Record<string, Piece> = {};

/** The statues' and painters' keys (each its own, outside the paint palette's), added to it. */
const STATUE_KEYS: Record<string, string> = { "#": "#fcf8ec", $: "#eedec2", "%": "#ccb494", "&": "#967a60", "*": "#ffde8c", "<": "#e4a848", ">": "#966426", "@": "#2e211a", "^": "#646a84", _: "#3c3e4e", "=": "#242530", "|": "#141216" };
const ARENA_TO: Record<string, string> = { W: "#", w: "$", c: "%", C: "&", Y: "*", G: "<", g: ">", k: "@", B: "^", b: "_", d: "=", K: "|" };
const PALETTE: Record<string, string> = { ...PAINT_PALETTE, ...STATUE_KEYS };

function toChar(p: Piece): Character {
  const parts: Record<string, Part> = {};
  const frames: Frame[] = p.frames.map((bits, f) => ({
    ms: p.ms,
    layers: bits.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] };
    }),
  }));
  return { id: `shop-smudgy-${p.name}`, name: `Smudgy's studio: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: p.palette, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000, palette = PALETTE): Character {
  PIECES[name] = { name, sq, w, h, foot, frames, ms, palette };
  return toChar(PIECES[name]!);
}
const whole = (c: Cv, outline = false): Bit => ({ part: { grid: c.map((r) => r.join("")), outline }, at: [0, 0] });

// ==== The floor: dark stained planks running east-west (four to a tile), drips and spatters of old paint on some.

function planks(c: Cv, ox: number, oy: number, w: number, h: number, seed: number) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gy = oy + y;
      const gx = ox + x;
      const row = Math.floor(gy / 9.25);
      const yy = gy - Math.floor(row * 9.25);
      // A plank's end joint, staggered row to row.
      const joint = (gx + row * 23) % 74 === 0;
      let k = yy === 0 || joint ? "1" : (row % 2 ? "2" : "3");
      if (k !== "1" && yy === 1) k = "4";
      else if (k !== "1" && hash(gx >> 2, row, seed) < 0.08) k = "4";
      else if (k !== "1" && hash(gx, gy, seed + 3) < 0.04) k = "2";
      c[y]![x] = k;
    }
}
const tile = (name: string, fn: (c: Cv) => void) => {
  const c = cv(T, T);
  fn(c);
  return def(name, [1, 1], T, T, [18, 18], [[whole(c)]]);
};
tile("floor-a", (c) => planks(c, 0, 0, T, T, 1));
tile("floor-b", (c) => {
  planks(c, 0, 0, T, T, 2);
  splat(c, 12, 20, 2.2, "P", "p", 21);
  splat(c, 27, 8, 1.4, "T", "t", 22);
});
tile("floor-c", (c) => {
  planks(c, 0, 0, T, T, 3);
  for (let i = 0; i < 14; i++) put(c, hash(i, 1, 31) * T, hash(i, 2, 31) * T, PAINTS[i % 4]![1]);
  splat(c, 22, 26, 1.8, "R", "r", 23);
});
/** A spill: a pot's worth of paint poured out, a dark pool with a lit rim, flecks. */
tile("floor-spill", (c) => {
  planks(c, 0, 0, T, T, 4);
  ellipse(c, 18, 20, 11, 6, (x, y) => (hash(x, y, 4) < 0.9 ? "B" : "b"));
  ellipse(c, 15, 18, 5, 2, "b");
  splat(c, 28, 10, 1.6, "B", "b", 24);
});
/** A drop cloth left on the floor (by the walls and the easels): canvas cream, folds, paint over it. */
for (const [name, seed] of [["floor-tarp", 5], ["floor-tarp-b", 6]] as const)
  tile(name, (c) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c[y]![x] = (x + y * 2 + seed) % 23 === 0 ? "7" : Math.sin(x * 0.2 + y * 0.1 + seed) > 0.7 ? "6" : "5";
    for (let i = 0; i < 3; i++) {
      const [d, l] = PAINTS[(i + seed) % PAINTS.length]!;
      splat(c, 6 + hash(i, 3, seed) * 25, 6 + hash(i, 4, seed) * 25, 1.5 + hash(i, 5, seed) * 2, d, l, seed * 9 + i);
    }
  });

// ==== The battle spot: a big drop cloth on the floor, 8 x 3 squares (columns 6 to 13, rows 13 to 15), its edges a little rumpled,
// splattered all over; its two marks painted on it on its middle line: Smudgy's (west, column 7) a plum ring with a brush's swirl,
// yours (east, column 12) an ochre ring with a pawn. The planks show round its ragged edge.

const TP = { c0: 6, r0: 13, w: 8, d: 3 } as const;
/** The start marks, in squares (as the other shops give them): the middle of their squares, on the cloth's middle line. */
export const SHOP_SMUDGY_MARKS = { boss: [7, 14], you: [12, 14] } as const;
/** The table's middle, in squares: halfway between the marks. */
export const SHOP_SMUDGY_TABLE_AT = { c: 9.5, r: 14 } as const;
{
  const W = TP.w * T;
  const H = TP.d * T;
  const c = cv(W, H);
  planks(c, TP.c0 * T, TP.r0 * T, W, H, 9);
  const inTarp = (x: number, y: number) => {
    const e = 3 + Math.sin(x * 0.21) * 1.5 + Math.sin(y * 0.33) * 1.2;
    return x > e && x < W - 1 - e && y > e && y < H - 1 - e;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inTarp(x, y)) continue;
      // Creases: long thin diagonal lines, a lit strip beside each.
      const f = (x * 0.55 + y * 1.3 + Math.sin(y * 0.1) * 6) % 58;
      const g = (x * 1.2 - y * 0.4 + 400) % 83;
      c[y]![x] = f < 1.1 || g < 1 ? "7" : f < 2.6 ? "6" : "5";
      if (!inTarp(x, y - 1) || !inTarp(x - 1, y)) c[y]![x] = "6";
      if (!inTarp(x, y + 1) || !inTarp(x + 1, y)) c[y]![x] = "8";
    }
  // Layers of paint on it: splats, drips and thin skeins, in the room's deep colors.
  for (let i = 0; i < 26; i++) {
    const [d, l] = PAINTS[i % PAINTS.length]!;
    const x = 8 + hash(i, 1, 77) * (W - 16);
    const y = 8 + hash(i, 2, 77) * (H - 16);
    if (Math.hypot(x - 55, (y - 55) * 1.2) < 20 || Math.hypot(x - 240, (y - 55) * 1.2) < 20) continue;
    splat(c, x, y, 1.2 + hash(i, 3, 77) * 2.6, d, l, 300 + i, inTarp);
  }
  for (let i = 0; i < 5; i++) skein(c, 6, 6, W - 7, H - 7, PAINTS[(i * 3) % 4]![i % 2]!, 400 + i, 90, (x, y) => inTarp(x, y) && Math.hypot(x - 148, y - 55) > 44);
  // The marks: rings of paint, a brush's swirl (his) and a pawn (yours) inside.
  const ring = (cx: number, cy: number, deep: string, lit: string) =>
    ellipse(c, cx, cy, 15, 15, (x, y, d) => (d > 0.62 ? (x + y < cx + cy - 10 ? lit : deep) : null));
  ring(55.5, 55.5, "P", "p");
  ring(240.5, 55.5, "Y", "y");
  for (let a = 0; a < 5.5; a += 0.08) put(c, 55.5 + Math.cos(a) * a * 1.4, 55.5 + Math.sin(a) * a * 1.4, a > 4 ? "p" : "P");
  const PAWN = ["..##..", ".####.", ".####.", "..##..", ".####.", "######"];
  PAWN.forEach((r, j) => [...r].forEach((k, i) => k === "#" && put(c, 238 + i, 52 + j, j < 2 ? "y" : "Y")));
  for (let r = 0; r < TP.d; r++)
    for (let col = 0; col < TP.w; col++) {
      const t = cv(T, T);
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) t[y]![x] = c[r * T + y]![col * T + x]!;
      def(`circle-${TP.c0 + col}-${TP.r0 + r}`, [1, 1], T, T, [18, 18], [[whole(t)]]);
    }
}

// ==== The walls: dark teal plaster, every bit of it hung with canvases (Eric: "every wall is just splattered with canvas"): big and
// small, overlapping, each a layered abstract of its own; drips run down the plaster between them. 37 x 130, as the other shops'.

const WALL_H = 130;
const WF: Pt = [18, WALL_H - 1];
function plaster(seed: number): Cv {
  const c = cv(T, WALL_H);
  for (let y = 10; y < WALL_H; y++)
    for (let x = 0; x < T; x++) c[y]![x] = y >= WALL_H - 10 ? (y === WALL_H - 10 ? "W" : y > WALL_H - 3 ? "v" : "V") : hash(x >> 1, y >> 1, seed) < 0.12 ? "!" : hash(x, y, seed + 1) < 0.05 ? "9" : "0";
  for (let i = 0; i < 3; i++) drip(c, Math.round(2 + hash(i, 1, seed) * 32), 12 + Math.round(hash(i, 2, seed) * 60), 8 + Math.round(hash(i, 3, seed) * 30), PAINTS[(i + seed) % PAINTS.length]![0], (x, y) => y < WALL_H - 11);
  return c;
}
/** Hangs a canvas (x, y, w, h) on a wall: its stretcher's edge, its abstract, a little shadow under it. */
function hang(c: Cv, x: number, y: number, w: number, h: number, seed: number, ground?: string) {
  rect(c, x + 1, y + h + 1, w, 1, "9");
  abstract(c, x, y, w, h, seed, ground ?? ["B", "P", "T", "R", "9"][seed % 5]);
  frame(c, x, y, w, h);
}
/**
 * A gallery picture light at the top of a panel (Eric, Nov 6: "lighting that comes down on the walls like in an art gallery"): a small
 * brass hood on a short arm, its bulb strip under it (`L`, the light's keys), and its warm wash baked into the panel below it: a cone
 * widening down the wall in which the plaster and the canvases' paints go a shade lighter (dithered at its edge), so the canvases glow
 * where it falls. The room's light (SHOP_SMUDGY_LIGHTS) and the wash's soft glow (SHOP_SMUDGY_POOLS) are at every placement.
 */
export const PICTURE_LIGHT = { x: 18, bulbY: 15, top: 16, bottom: 104, w0: 5, w1: 15 } as const;
const LIGHTER: Record<string, string> = { "9": "0", "0": "!", T: "t", B: "b", R: "r", P: "p", Y: "y", O: "y", V: "W", v: "V", g: "G" };
function pictureLight(c: Cv) {
  const L = PICTURE_LIGHT;
  for (let y = L.top; y < L.bottom; y++) {
    const u = (y - L.top) / (L.bottom - L.top);
    const half = L.w0 + (L.w1 - L.w0) * u;
    for (let x = 0; x < T; x++) {
      const d = Math.abs(x + 0.5 - L.x) / half;
      if (d > 1) continue;
      // (Strongest near the lamp and the cone's middle; its edge and its far end dithered off.)
      const keep = 1 - d * d * 0.7 - u * 0.5;
      if (keep < 0.5 && hash(x, y, 99) > keep * 1.6) continue;
      const k = c[y]![x]!;
      if (LIGHTER[k]) c[y]![x] = LIGHTER[k]!;
    }
  }
  rect(c, L.x - 1, 9, 2, 3, "M");
  rect(c, L.x - 7, 11, 14, 3, "g");
  rect(c, L.x - 7, 11, 14, 1, "G");
  rect(c, L.x - 6, 14, 12, 1, "L");
}
const wallDef = (name: string, c: Cv) => def(name, [1, 1], T, WALL_H, WF, [[whole(c)]]);
for (let i = 0; i < 6; i++) {
  const c = plaster(10 + i);
  // Each panel: one big canvas and one or two smaller ones overlapping it, laid out by the seed.
  const big = i % 2 ? [3, 16, 30, 46] : [5, 24, 28, 38];
  hang(c, big[0]!, big[1]!, big[2]!, big[3]!, 30 + i * 7);
  hang(c, (i * 7) % 12 + 2, 72 + (i % 3) * 4, 20 + (i % 3) * 4, 22, 50 + i * 5);
  if (i % 3 !== 1) hang(c, 18 - (i % 2) * 12, 100 - (i % 2) * 6, 14, 14, 70 + i);
  pictureLight(c);
  wallDef(`wall-${i}`, c);
}
/** One canvas so big it runs across two panels (the back wall's centerpieces): the west half and the east. */
for (const [n, seed] of [["wall-wide", 91], ["wall-wide-b", 92]] as const) {
  const W = 2 * T;
  const c = cv(W, WALL_H);
  const a = plaster(seed);
  const b = plaster(seed + 1);
  for (let y = 0; y < WALL_H; y++) for (let x = 0; x < W; x++) c[y]![x] = (x < T ? a[y]![x] : b[y]![x - T])!;
  hang(c, 5, 14, W - 10, 70, seed, n === "wall-wide" ? "T" : "P");
  hang(c, 10, 92, 22, 18, seed + 5);
  hang(c, 42, 90, 24, 22, seed + 6);
  for (let half = 0; half < 2; half++) {
    const p = cv(T, WALL_H);
    for (let y = 0; y < WALL_H; y++) for (let x = 0; x < T; x++) p[y]![x] = c[y]![x + half * T]!;
    pictureLight(p);
    wallDef(`${n}-${half}`, p);
  }
}

// -- The front: a low band of plaster under a rail, and the way out in its middle.
{
  const HEM_H = 22;
  const c = cv(T, HEM_H);
  for (let y = 3; y < HEM_H; y++) for (let x = 0; x < T; x++) c[y]![x] = y === 3 ? "W" : y < 6 ? "V" : hash(x, y, 71) < 0.1 ? "!" : "0";
  drip(c, 12, 6, 6, "R");
  def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c)]]);
}
{
  const EW = 2 * T;
  const EH = 112;
  const EF = EH - 1;
  const c = cv(EW, EH);
  // Outside: the town square in daylight through the open door.
  for (let y = 22; y < EF; y++) for (let x = 12; x < EW - 12; x++) put(c, x, y, y < 58 ? (y < 40 ? "b" : "q") : hash(x, y, 3) < 0.4 ? "C" : "c");
  face(c, [[12, 58], [22, 48], [30, 58]], "p");
  face(c, [[36, 58], [44, 46], [EW - 12, 52], [EW - 12, 58]], "t");
  // The door frame: dark wood, splattered; the door swung open against the east post.
  rect(c, 2, 12, 10, EF - 12, "V");
  rect(c, 2, 12, 2, EF - 12, "W");
  rect(c, EW - 12, 12, 10, EF - 12, "v");
  rect(c, 0, 6, EW, 8, "V");
  rect(c, 0, 6, EW, 2, "W");
  face(c, [[EW - 12, 24], [EW - 24, 34], [EW - 24, 100], [EW - 12, EF - 2]], "R", { hi: "r", lo: "R" });
  for (let i = 0; i < 6; i++) splat(c, 4 + hash(i, 1, 81) * (EW - 8), 8 + hash(i, 2, 81) * 90, 1.2, PAINTS[i % 6]![0], PAINTS[i % 6]![1], 81 + i, (x, y) => get(c, x, y) === "V" || get(c, x, y) === "v" || get(c, x, y) === "W" || get(c, x, y) === "R");
  def("entrance", [2, 1], EW, EH, [37, EF], [[whole(c, true)]]);
}

// ==== The backdrop behind the counter (4 squares): a wall of rough shelves of paint (pots and tins in every deep color, jars of
// brushes, rolled canvases) round a lamp-lit canvas in a gilt frame, the gallery's best piece.

const BDW = 4 * T;
const BDH = 150;
const LAMP = { x: 74, y: 30 } as const;
export const SHOP_SMUDGY_BACKDROP = (() => {
  const c = cv(BDW, BDH);
  for (let y = 8; y < BDH; y++) for (let x = 0; x < BDW; x++) c[y]![x] = hash(x >> 1, y >> 1, 5) < 0.1 ? "!" : "0";
  // Shelves: dark boards, the outer quarters, four high.
  const pot = (x: number, y: number, w: number, h: number, deep: string, lit: string) => {
    rect(c, x, y - h, w, h, deep);
    rect(c, x, y - h, 1, h, lit);
    rect(c, x, y - h - 1, w, 1, "m");
    drip(c, x + 1 + (w > 3 ? 1 : 0), y - h, 2, lit);
  };
  for (const x0 of [2, 106])
    for (const [j, y] of [44, 76, 108, 140].entries()) {
      rect(c, x0, y, 36, 2, "W");
      rect(c, x0, y + 2, 36, 2, "v");
      for (let i = 0; i < 5; i++) {
        const [d, l] = PAINTS[(i + j * 2 + (x0 > 50 ? 3 : 0)) % PAINTS.length]!;
        if ((i + j) % 4 === 3) {
          // A jar of brushes.
          rect(c, x0 + 2 + i * 7, y - 8, 5, 8, "Q");
          rect(c, x0 + 2 + i * 7, y - 8, 1, 8, "q");
          for (let b = 0; b < 3; b++) line(c, x0 + 3 + i * 7 + b, y - 9, x0 + 2 + i * 7 + b * 2, y - 16, b % 2 ? "W" : "V");
        } else pot(x0 + 2 + i * 7, y, 5, 6 + ((i * 3 + j) % 4), d, l);
      }
    }
  // The best piece: a big canvas in a gilt frame, under a little brass lamp.
  rect(c, 41, 39, 62, 82, "g");
  rect(c, 42, 40, 60, 80, "G");
  rect(c, 43, 41, 58, 1, "L");
  abstract(c, 45, 43, 54, 74, 333, "P");
  rect(c, LAMP.x - 8, LAMP.y, 17, 3, "G");
  rect(c, LAMP.x - 1, LAMP.y - 6, 3, 6, "g");
  rect(c, LAMP.x - 6, LAMP.y + 3, 13, 1, "L");
  return def("backdrop", [4, 1], BDW, BDH, [74, BDH - 1], [[whole(c, true)]]);
})();

// ==== The counter (4 squares): low, of dark wood, splattered; its blank plaque on a little stand at its west end (the game writes on
// it), a palette and a jar of brushes; Smudgy's Boss Crate at the east end; the middle clear for the gallery owner behind.

const CW = 4 * T;
const CH = 40;
const CFOOT = CH - 3;
const CTOP = 18;
const PLQ = { x: 8, y: 3, w: 44, h: 13 } as const;
export const SHOP_SMUDGY_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
export const SHOP_SMUDGY_CRATE_AT: Pt = [122, CTOP + 3];
export const SHOP_SMUDGY_COUNTER = (() => {
  const c = cv(CW, CH);
  shadow(c, CW / 2, CFOOT, CW / 2 + 2, 3);
  face(c, [[4, CTOP], [CW - 4, CTOP], [CW - 2, CTOP + 5], [2, CTOP + 5]], "W", { lo: "V" });
  for (let y = CTOP + 6; y < CFOOT; y++) for (let x = 2; x < CW - 2; x++) put(c, x, y, (x - 2) % 18 === 0 ? "v" : y === CTOP + 6 ? "v" : "V");
  rect(c, 2, CFOOT - 2, CW - 4, 2, "v");
  for (let i = 0; i < 9; i++) {
    const [d, l] = PAINTS[i % PAINTS.length]!;
    splat(c, 6 + hash(i, 1, 61) * (CW - 12), CTOP + 8 + hash(i, 2, 61) * 10, 1 + hash(i, 3, 61) * 1.6, d, l, 61 + i, (x, y) => y > CTOP + 5 && y < CFOOT - 2);
  }
  // The plaque: a little gilt-framed card on a stand.
  rect(c, PLQ.x - 1, PLQ.y - 1, PLQ.w + 2, PLQ.h + 2, "g");
  rect(c, PLQ.x - 1, PLQ.y - 1, PLQ.w + 2, 1, "G");
  rect(c, PLQ.x, PLQ.y, PLQ.w, PLQ.h, "c");
  rect(c, PLQ.x + PLQ.w / 2 - 1, PLQ.y + PLQ.h + 1, 3, CTOP - PLQ.y - PLQ.h, "v");
  // A palette with its dabs, a jar of brushes.
  ellipse(c, 70, CTOP + 2, 9, 3, "W");
  for (const [i, k] of ["T", "R", "Y", "P", "b"].entries()) put(c, 64 + i * 3, CTOP + 1 + (i % 2), k);
  rect(c, 96, CTOP - 7, 6, 9, "Q");
  rect(c, 96, CTOP - 7, 1, 9, "q");
  for (let b = 0; b < 3; b++) line(c, 97 + b * 2, CTOP - 8, 95 + b * 3, CTOP - 15, b % 2 ? "W" : "V");
  return def("counter", [4, 1], CW, CH, [74, CFOOT], [[whole(c, true)]]);
})();

// ==== Smudgy's Boss Crate: a wooden crate, its slats splattered and dripping; idle, a drip runs down its front now and then.

const XW = 32;
const XH = 30;
const XF = XH - 2;
function crateCv(dripAt: number): Cv {
  const c = cv(XW, XH);
  shadow(c, 16, XF, 15, 2);
  face(c, [[3, 9], [25, 9], [25, XF], [3, XF]], "V", { hi: "W", lo: "v" });
  face(c, [[25, 9], [29, 5], [29, XF - 4], [25, XF]], "v");
  face(c, [[3, 9], [7, 5], [29, 5], [25, 9]], "W");
  for (const y of [15, 21]) rect(c, 3, y, 22, 1, "v");
  line(c, 3, 9, 25, XF, "v");
  for (const [i, k] of ["P", "T", "R", "Y", "b"].entries()) splat(c, 6 + i * 4.5, 8 + (i % 3) * 5, 1.4, k, PAINTS.find((p) => p[0] === k)?.[1] ?? k, 90 + i, (x, y) => get(c, x, y) !== "." && get(c, x, y) !== "-" && get(c, x, y) !== "+");
  if (dripAt >= 0) drip(c, 10, 12, dripAt, "p");
  return c;
}
const CRATE_DRIP = [-1, -1, -1, -1, 2, 4, 6, 7, 7, -1];
export const SHOP_SMUDGY_CRATE = def("crate", [1, 1], XW, XH, [16, XF], CRATE_DRIP.map((d) => [whole(crateCv(d), true)]), 220);

// ==== The sculptures and the life class's knight: the Colosseum's pixel pieces (colosseum/pieces-gba.ts, its 3D models), drawn here
// with the arena's own palette.

/** A model turned `a` radians about its upright axis (the life class's knight on its platform). */
const turned = (m: Model, a: number): Model => ({
  inside: (x, y, z) => m.inside(x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a)),
});
/** Draws a piece into `c` with its foot at (fx, fy), `k` canvas pixels a model pixel. */
function pieceOn(c: Cv, m: Model, side: Side, pitch: number, fx: number, fy: number, k = 1) {
  const s = drawModel(m, side, pitch);
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const key = s.keys[y]![x];
      if (!key) continue;
      const to = ARENA_TO[key] ?? "@";
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) put(c, fx + (x - s.ax) * k + i, fy + (y - s.ay) * k + j, to);
    }
}
/** A plinth: a dark stone block, lit on the left, splashed. */
function plinth(c: Cv, cx: number, foot: number, w: number, h: number) {
  shadow(c, cx + 1, foot, w / 2 + 3, 3);
  face(c, [[cx - w / 2, foot - h], [cx + w / 2, foot - h], [cx + w / 2, foot], [cx - w / 2, foot]], "!", { hi: "0", lo: "9" });
  rect(c, cx - w / 2 - 1, foot - h - 2, w + 2, 2, "0");
  splat(c, cx - 2, foot - h / 2, 1.4, "R", "r", cx);
}
const SC_W = 40;
const SC_H = 64;
for (const [kind, side] of [["r", "b"], ["q", "w"], ["b", "b"], ["p", "w"], ["k", "w"]] as const) {
  const c = cv(SC_W, SC_H);
  plinth(c, 20, SC_H - 3, 18, 16);
  pieceOn(c, MODELS[kind as Kind], side, 0.35, 20, SC_H - 21);
  def(`sculpture-${kind}`, [1, 1], SC_W, SC_H, [20, SC_H - 3], [[whole(c, true)]]);
}

/** The platform's turn: frames, ms each (one turn in 16 x 375 ms = 6 s). */
export const KNIGHT_TURN = { frames: 16, ms: 375 } as const;
const PLW = 2 * T;
const PLH = 84;
const PLF = PLH - 6;
{
  const frames: Bit[][] = [];
  for (let f = 0; f < KNIGHT_TURN.frames; f++) {
    const c = cv(PLW, PLH);
    const cx = PLW / 2;
    shadow(c, cx + 1, PLF, 30, 5);
    // The round platform: its rim (marks on it go round), its top.
    ellipse(c, cx, PLF - 3, 28, 7, (x) => (x < cx - 8 ? "V" : "v"));
    for (let i = 0; i < 8; i++) {
      const a = ((i + f / KNIGHT_TURN.frames) / 8) * Math.PI * 2;
      if (Math.sin(a) < 0.1) continue;
      const x = cx + Math.cos(a) * 27;
      line(c, x, PLF - 3, x, PLF + 1, "W");
    }
    ellipse(c, cx, PLF - 6, 28, 7, (x, y, d) => (d > 0.8 ? "V" : x + y < cx + PLF - 14 ? "y" : "W"));
    pieceOn(c, turned(MODELS.n, (f / KNIGHT_TURN.frames) * Math.PI * 2), "w", 0.35, cx, PLF - 7, 2);
    frames.push([whole(c, true)]);
  }
  def("platform", [2, 1], PLW, PLH, [PLW / 2 - 1, PLF], frames, KNIGHT_TURN.ms);
}

// ==== The life class's painters: art-student chameleons (Dabble's rig, sitting) in smocks, four colors, each on a stool at an easel
// facing east (the east side's are mirrored to face west), a paint table beside it. Their loop: 32 frames of 250 ms (8 s); in each of
// the 4 stages of the canvas (blank, outline, blocked colors, finished), 5 frames painting, 3 dipping the brush in the paint table.

export const PAINTER_LOOP = { frames: 32, ms: 250, stage: 8, dip: 5 } as const;
/** Dabble's keys to the station's (the paint palette's where one fits; the skin, belly and smock keys its color's own). */
const DK: Record<string, string> = {
  k: "k", a: "a", b: "d", c: "e", d: "f", e: "j", l: "l", m: "o", n: "s", p: "O", q: "O", r: "Y", s: "y", t: "T", u: "t", v: "t", x: "t",
  h: "w", S: "C", E: "O", F: "Y", G: "y", X: "k", w: "h", L: "v", M: "v", N: "V", Q: "W", f: "M", g: "m", i: "n", j: "n", U: "V", V: "W", W: "y",
  P: "Y", R: "y", K: "y", B: "v", C: "V", D: "W", Y: "y", y: "y", O: "Y", "1": "r", "2": "r", z: "-", "~": "q", "9": "8", "0": "7",
};
/** The painters' colors: skin dark to light (a, d, e, f, j), belly (l, o, s) and smock (z lit, x mid, u shade). */
const PAINTER_COLORS: readonly Record<string, string>[] = [
  { a: "#2c5e18", d: "#4b9023", e: "#74c02c", f: "#9fdc43", j: "#c9f27a", l: "#9bb838", o: "#c5da55", s: "#e6ee86", z: "#e6dcc6", x: "#c4b89e", u: "#958b77" },
  { a: "#12494f", d: "#1f6f73", e: "#2f9a96", f: "#5cc4b8", j: "#9fe3d6", l: "#7fb7a8", o: "#a9d6c6", s: "#d2efe3", z: "#9cb4d4", x: "#6f8db8", u: "#4c6a96" },
  { a: "#6a3410", d: "#9a5418", e: "#c77a26", f: "#e3a447", j: "#f3cf86", l: "#d8b276", o: "#ead09a", s: "#f6e6c0", z: "#d9c3cf", x: "#b597ab", u: "#8a6a83" },
  { a: "#3e2147", d: "#613470", e: "#8a4f9a", f: "#b07cbe", j: "#d6b0dc", l: "#c4a3c4", o: "#dcc2da", s: "#efe0ec", z: "#e6dcc6", x: "#c4b89e", u: "#958b77" },
];
const DAB: Character = { id: "dabble", name: "Dabble", w: 64, h: 64, foot: [26, DABBLE_GROUND], palette: SIDEKICK_PALETTE, parts: DABBLE_PARTS, anims: {} };
/** Dabble's layers drawn into `c` at (ox, oy), its keys mapped (DK); the stool's layer left out (the station draws its own). */
function dabbleInto(c: Cv, layers: readonly Layer[], ox: number, oy: number) {
  const keys = frameKeys(DAB, { ms: 0, layers: layers.filter((l) => l.part !== "stool" && l.part !== "shadowSit") });
  for (let y = 0; y < keys.length; y++)
    for (let x = 0; x < keys[y]!.length; x++) {
      const k = keys[y]![x];
      if (k) put(c, ox + x, oy + y, DK[k] ?? "k");
    }
}
/** A smock over the body layer `b` (Dabble's body at its x, y): cream canvas to the knees, a pocket, paint on it. */
function smockOn(c: Cv, bx: number, by: number, seed: number) {
  const cx = bx + 11;
  const cy = by + 11;
  ellipse(c, cx, cy, 10.5, 8.5, "k");
  ellipse(c, cx, cy, 9.5, 7.5, (x, y) => (x + 0.5 < cx - 4 ? "z" : x + 0.5 > cx + 5 || y + 0.5 > cy + 5 ? "u" : "x"));
  rect(c, cx - 2, cy + 1, 5, 4, "u");
  for (let i = 0; i < 4; i++) put(c, cx - 7 + hash(i, 1, seed) * 14, cy - 5 + hash(i, 2, seed) * 10, PAINTS[(i + seed) % 4]![1]);
}
/** The canvas on the easel: the knight in profile, as far along as `stage` (0 blank, 1 outline, 2 blocked colors, 3 finished). */
const KNIGHT_PROFILE: readonly Pt[] = [[6, 15], [14, 15], [13, 12], [14, 8], [13, 4], [10, 1], [7, 2], [4, 5], [2, 8], [3, 10], [6, 9], [7, 11], [6, 13]];
function easelCanvas(c: Cv, x0: number, y0: number, stage: number, seed: number) {
  const w = 18;
  const h = 18;
  rect(c, x0, y0, w, h, "c");
  rect(c, x0 + w - 1, y0, 1, h, "C");
  if (stage === 0) return;
  const ins = (x: number, y: number) => {
    let inside = false;
    const px = x + 0.5;
    const py = y + 0.5;
    for (let i = 0, j = KNIGHT_PROFILE.length - 1; i < KNIGHT_PROFILE.length; j = i++) {
      const [xi, yi] = KNIGHT_PROFILE[i]!;
      const [xj, yj] = KNIGHT_PROFILE[j]!;
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = ins(x - 1, y - 1);
      const edge = i && (!ins(x - 2, y - 1) || !ins(x, y - 1) || !ins(x - 1, y - 2) || !ins(x - 1, y));
      if (stage >= 2) {
        if (!i) put(c, x0 + x, y0 + y, stage === 3 && y > 13 ? "O" : y < 6 ? "b" : "B");
        else put(c, x0 + x, y0 + y, stage === 3 ? (x < 9 && y < 9 ? "$" : x > 11 ? "&" : "%") : "%");
      }
      if (edge && stage !== 2) put(c, x0 + x, y0 + y, stage === 3 ? "@" : "v");
    }
  if (stage === 3) {
    put(c, x0 + 8, y0 + 4, "@");
    drip(c, x0 + 3, y0 + 9, 4, "B");
    splat(c, x0 + 14, y0 + 4, 1, "y", "y", seed);
  }
}
/** The station's frame (painter facing east): the stool, the paint table, the painter (pose), the easel and its canvas. */
const STW = 96;
const STH = 72;
const SFX = 26;
const SFY = 66;
function stationCv(stage: number, pose: Parameters<typeof dabbleLayers>[0], seed: number): Cv {
  const c = cv(STW, STH);
  // The paint table: a little three-legged taboret in front of the painter, pots and a palette of the room's paints on it.
  const tx = 52;
  const ty = SFY - 1;
  shadow(c, tx + 1, ty, 9, 2);
  for (const lx of [tx - 6, tx + 6, tx]) line(c, lx, ty - 10, lx, ty, "v");
  ellipse(c, tx, ty - 11, 8, 2.5, "V");
  ellipse(c, tx, ty - 12, 8, 2.5, "W");
  rect(c, tx - 6, ty - 17, 4, 5, "B");
  rect(c, tx - 6, ty - 17, 1, 5, "b");
  rect(c, tx - 1, ty - 16, 4, 4, "R");
  rect(c, tx + 4, ty - 15, 3, 3, "T");
  // The stool, and the painter on it (Dabble's sitting rig, its foot at the station's).
  stool(c, SFX - 6, SFY);
  const L = dabbleLayers({ ...DABBLE_SIT, ...pose });
  const ox = SFX - 26 + 0;
  const oy = SFY - DABBLE_GROUND - (STOOL_SEAT - 8);
  const bodyAt = L.layers.findIndex((l) => l.part === "body");
  dabbleInto(c, L.layers.slice(0, bodyAt + 1), ox, oy);
  const b = L.layers[bodyAt]!;
  smockOn(c, ox + b.x, oy + b.y, seed);
  dabbleInto(c, L.layers.slice(bodyAt + 1), ox, oy);
  // The easel: an A-frame of three legs, its ledge, the canvas on it, facing the knight.
  const ex = 68;
  shadow(c, ex + 2, SFY, 10, 2);
  line(c, ex - 7, SFY, ex - 1, SFY - 50, "V");
  line(c, ex + 9, SFY, ex + 3, SFY - 50, "v");
  line(c, ex + 1, SFY - 2, ex + 1, SFY - 46, "v");
  easelCanvas(c, ex - 8, SFY - 46, stage, seed);
  rect(c, ex - 10, SFY - 27, 22, 2, "W");
  return c;
}
/** A painter's poses through the loop: painting (the brush to the canvas, a stroke up and down), then dipping (down to the pots). */
export function painterPose(f: number): { fist: Pt; tilt: number; dip: boolean } {
  const i = f % PAINTER_LOOP.stage;
  if (i < PAINTER_LOOP.dip) return { fist: [44 - (i % 2), 40 + (i % 2) * 3 - (i === 2 ? 2 : 0)], tilt: 72 + (i % 2) * 8, dip: false };
  // Down to the paint table: reach, dab, back up.
  const j = i - PAINTER_LOOP.dip;
  return { fist: ([[44, 41], [45, 43], [44, 41]] as Pt[])[j]!, tilt: [115, 122, 110][j]!, dip: true };
}
/** Which canvas stage frame `f` of the loop shows (0 blank to 3 finished). */
export const stageOf = (f: number) => Math.floor((f % PAINTER_LOOP.frames) / PAINTER_LOOP.stage);
for (const [v, colors] of PAINTER_COLORS.entries()) {
  const frames: Bit[][] = [];
  for (let f = 0; f < PAINTER_LOOP.frames; f++) {
    const p = painterPose(f);
    const lid = f % 11 === 7 ? "shut" : undefined;
    const c = stationCv(stageOf(f), { fist: p.fist, tilt: p.tilt, gazeN: p.dip ? [0.6, 1] : [1.2, 0.1], gazeF: p.dip ? [0.5, 1] : [1.1, 0.1], ...(lid ? { lidN: lid, lidF: lid } : {}), paint: p.dip && f % PAINTER_LOOP.stage === PAINTER_LOOP.dip ? "smear" : "full" } as Parameters<typeof dabbleLayers>[0], v * 13 + 5);
    frames.push([whole(c)]);
  }
  def(`painter-${"abcd"[v]}`, [1, 1], STW, STH, [SFX, SFY], frames, PAINTER_LOOP.ms, { ...PALETTE, ...colors });
}

// ==== Easels with big canvases, a canvas stack, paint pots and brush jars, round the room.

{
  const c = cv(60, 96);
  shadow(c, 31, 92, 18, 3);
  line(c, 18, 92, 26, 10, "V");
  line(c, 44, 92, 36, 10, "v");
  line(c, 31, 90, 31, 14, "v");
  hang(c, 10, 18, 40, 48, 711, "T");
  rect(c, 8, 67, 44, 3, "W");
  def("easel", [1, 1], 60, 96, [31, 92], [[whole(c, true)]]);
  const d = cv(60, 96);
  shadow(d, 31, 92, 18, 3);
  line(d, 18, 92, 26, 10, "V");
  line(d, 44, 92, 36, 10, "v");
  line(d, 31, 90, 31, 14, "v");
  hang(d, 12, 22, 36, 44, 712, "R");
  rect(d, 8, 67, 44, 3, "W");
  def("easel-b", [1, 1], 60, 96, [31, 92], [[whole(d, true)]]);
}
{
  const c = cv(52, 64);
  shadow(c, 26, 60, 22, 3);
  for (let i = 0; i < 4; i++) {
    const x = 4 + i * 5;
    const h = 46 - i * 6;
    hang(c, x, 60 - h, 26, h - 2, 720 + i);
  }
  def("canvases", [1, 1], 52, 64, [26, 60], [[whole(c, true)]]);
}
{
  const c = cv(44, 40);
  shadow(c, 22, 36, 18, 3);
  const pots: readonly (readonly [number, number, number, string, string])[] = [[4, 12, 10, "T", "t"], [14, 9, 12, "R", "r"], [24, 11, 9, "P", "p"], [32, 8, 7, "Y", "y"], [10, 8, 6, "B", "b"]];
  for (const [x, w, h, d, l] of pots) {
    const y = x === 10 ? 36 : 35;
    rect(c, x, y - h, w, h, "M");
    rect(c, x, y - h, 2, h, "m");
    rect(c, x, y - h - 1, w, 2, d);
    rect(c, x + 1, y - h - 1, 2, 1, l);
    drip(c, x + w - 3, y - h, 3 + (w % 3), d);
  }
  def("pots", [1, 1], 44, 40, [22, 36], [[whole(c, true)]]);
}
{
  const c = cv(30, 44);
  shadow(c, 15, 40, 11, 2);
  for (const [x, h] of [[4, 12], [16, 10]] as const) {
    rect(c, x, 40 - h, 10, h, "Q");
    rect(c, x, 40 - h, 2, h, "q");
    rect(c, x, 40 - h, 10, 1, "q");
    for (let b = 0; b < 4; b++) {
      const top = 40 - h - 10 - (b % 2) * 5;
      line(c, x + 2 + b * 2, 40 - h, x + b * 3 - 1, top, b % 2 ? "W" : "V");
      put(c, x + b * 3 - 1, top, PAINTS[b % 4]![1]);
    }
  }
  def("jars", [1, 1], 30, 44, [15, 40], [[whole(c, true)]]);
}
/** The battle spot's table under its cloth (the room's own; in the intro the cloth is whipped off it: smudgy-intro-art.ts). */
def("table", [2, 1], 3 * T, 60, [TCX, TFOOT], [[whole(coveredTableCv(), true)]]);

// ==== Lights: the lamp over the backdrop's best piece; every wall panel's picture light and its wash; a warm pool on the life class's
// platform (a skylight's), one by the counter.

const WARM = "#ffd38a";
/** Every wall panel (the back wall's and the side walls'), each with its picture light. */
export const WALL_PANELS: readonly string[] = [...[0, 1, 2, 3, 4, 5].map((i) => `wall-${i}`), "wall-wide-0", "wall-wide-1", "wall-wide-b-0", "wall-wide-b-1"];
const PL = PICTURE_LIGHT;
export const SHOP_SMUDGY_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "backdrop", x: LAMP.x - 8, y: LAMP.y + 2, w: 17, h: 3, keys: "GL", color: WARM, strength: 0.6, halo: 26 },
  // (Each panel's picture light: its bulb strip, a small halo round it.)
  ...WALL_PANELS.map((piece) => ({ piece, x: PL.x - 6, y: PL.bulbY - 1, w: 12, h: 1, keys: "L", color: WARM, strength: 0.5, halo: 9 })),
];
export const SHOP_SMUDGY_POOLS: readonly (LightPool & { piece: string })[] = [
  // (Each picture light's wash down its panel: a tall soft glow over the lit cone, on the wall.)
  ...WALL_PANELS.map((piece) => ({ piece, x: PL.x, y: Math.round((PL.top + PL.bottom) / 2) - 8, rx: 11, ry: 30, color: "#ffd9a0", strength: 0.22 })),
  { piece: "platform", x: PLW / 2, y: PLF - 4, rx: 70, ry: 34, color: "#ffe2b0", strength: 0.28 },
  { piece: "backdrop", x: BDW / 2, y: BDH + 10, rx: 46, ry: 10, color: WARM, strength: 0.16 },
];

// ==== The layout.

export interface ShopPlace {
  name: string;
  col: number;
  row: number;
  solid: boolean;
  rot?: 0 | 1 | 2 | 3;
  flip?: boolean;
  w?: number;
  d?: number;
  exit?: boolean;
  /** How far into its loop it stands (ms; the life class's painters, each starting at its own time). */
  t0?: number;
}
const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (!p) throw new Error(`no piece ${name}`);
  LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};
const SPILLS = new Set(["4,6", "15,9", "11,17", "5,12"]);
const TARPS = new Set(["2,7", "2,8", "3,7", "3,8", "16,10", "16,11", "17,10", "17,11", "15,4", "16,4", "3,15", "4,15"]);
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    const k = `${col},${row}`;
    if (col >= TP.c0 && col < TP.c0 + TP.w && row >= TP.r0 && row < TP.r0 + TP.d) at(`circle-${col}-${row}`, col, row, false);
    else if (TARPS.has(k)) at((col + row) % 2 ? "floor-tarp" : "floor-tarp-b", col, row, false);
    else if (SPILLS.has(k)) at("floor-spill", col, row, false);
    else {
      const h = hash(col, row, 17);
      at(h < 0.18 ? "floor-b" : h < 0.3 ? "floor-c" : "floor-a", col, row, false);
    }
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The back wall (row 0): canvas-hung panels, the two wide centerpieces, the backdrop behind the counter.
for (let col = 0; col < 20; col++) {
  if (col >= 8 && col <= 11) {
    if (col === 8) at("backdrop", 8, 0, true);
    continue;
  }
  if (col === 4 || col === 5) at(`wall-wide-${col - 4}`, col, 0, true);
  else if (col === 14 || col === 15) at(`wall-wide-b-${col - 14}`, col, 0, true);
  else at(`wall-${(col * 5) % 6}`, col, 0, true, col >= 12 ? { flip: true } : {});
}
// -- The side walls: every panel hung with canvases.
for (let row = 1; row < 19; row++) {
  at(`wall-${(row * 7) % 6}`, 0, row, true);
  at(`wall-${(row * 7 + 3) % 6}`, 19, row, true, { flip: true });
}
// -- The front: the low band, and the way out in its middle.
for (let col = 0; col < 20; col++) if (col !== 9 && col !== 10) at("hem", col, 19, true, col >= 10 ? { flip: true } : {});
at("entrance", 9, 19, false, { exit: true });

// -- The shop.
at("counter", 8, 3, true);
at("crate", 8, 3, false); // on the counter (see SHOP_SMUDGY_CRATE_AT): its place is the counter's

// -- The life class: the knight on its platform, the eight painters in a ring round it (west faces east, east faces west), each
// starting its loop at its own time (an eighth of the loop apart, in the ring's order).
export const LIFE_CLASS = { c: 9.5, r: 8 } as const;
export const PAINTERS: readonly { col: number; row: number; flip: boolean; v: number }[] = [
  { col: 7, row: 5, flip: false, v: 0 },
  { col: 12, row: 5, flip: true, v: 1 },
  { col: 14, row: 7, flip: true, v: 2 },
  { col: 14, row: 9, flip: true, v: 3 },
  { col: 12, row: 11, flip: true, v: 0 },
  { col: 7, row: 11, flip: false, v: 1 },
  { col: 5, row: 9, flip: false, v: 2 },
  { col: 5, row: 7, flip: false, v: 3 },
];
at("platform", 9, 8, true);
PAINTERS.forEach((p, i) => at(`painter-${"abcd"[p.v]}`, p.col, p.row, true, { flip: p.flip, t0: Math.round((i * PAINTER_LOOP.frames * PAINTER_LOOP.ms) / PAINTERS.length) }));

// -- The battle spot: the covered table on the drop cloth, halfway between the marks.
at("table", 9, 14, true);

// -- Sculptures on plinths, easels, canvases, pots and jars round the edges.
at("sculpture-r", 2, 4, true);
at("sculpture-q", 17, 4, true);
at("sculpture-b", 2, 16, true);
at("sculpture-p", 17, 16, true);
at("sculpture-k", 15, 13, true);
at("easel", 3, 8, true);
at("easel-b", 16, 11, true, { flip: true });
at("canvases", 4, 2, true);
at("canvases", 15, 2, true, { flip: true });
at("pots", 3, 12, true);
at("pots", 16, 15, true, { flip: true });
at("jars", 16, 6, true);
at("jars", 5, 16, true);

/** Where every piece goes: name, column (its west-most square), row, solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_SMUDGY_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

/** Every piece by its name (as SHOP_SMUDGY_LAYOUT names them), each its own Character `shop-smudgy-<name>`. */
export const SHOP_SMUDGY_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));

export type { LightPool, LightSpot };
