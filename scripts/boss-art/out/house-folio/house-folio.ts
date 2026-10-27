/**
 * Folio's Folded House: the paper crane's home on the town square. A small cottage folded from one giant sheet of its
 * own paper: a steep two-faced roof and walls with crisp creases, each face lit, mid or shaded the way Folio's paper is;
 * faint old handwriting in its soft faded blue ink across them; a thin gilt edge along the ridge and the roof's front
 * edge; the door a folded flap standing a little open on warm lamplight; Folio's vermilion seal (the pawn knocked out)
 * over it; three small paper cranes hanging from the eave; a stack of folded pages and a closed book by the door; and a
 * blank sign board of folded card on two posts in front (the game writes the name on it). Light from the top left.
 * `idle`: the cranes sway on their threads, each out of step; once in the loop the lamplight flickers.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../../../packages/app/src/characters/sprite.ts";
import { grain, groundShadow, paint, signBoard, signFace, signPost, tuft, type Pt } from "../../../../packages/app/src/town/houses/kit.ts";

const PALETTE: Record<string, string> = {
  k: "#1f1c2c", // outline: Folio's ink-dark
  a: "#fdfaf1", // paper: highlight, lit, mid, shaded, deep shade
  b: "#efe9da",
  c: "#d3ccbc",
  d: "#a8a3ae",
  e: "#86829a",
  i: "#8a93b8", // faded ink: on lit, on mid, on shaded paper
  j: "#717898",
  m: "#575c78",
  g: "#e2b64c", // gilt: mid, light
  G: "#fbe28e",
  r: "#d9472f", // the seal's vermilion: mid, dark
  R: "#a3301f",
  "1": "#fff2b8", // lamplight: brightest to deep amber
  "2": "#ffcb63",
  "3": "#e9923e",
  "4": "#a95a2b",
  n: "#363d68", // the book's blue cover: dark, light
  o: "#58629c",
  t: "#6b6680", // thread
  "5": "#4e3a2c", // the sign's wood: dark to light
  "6": "#70543c",
  "7": "#93714f",
  "8": "#b89067",
  S: "#cfc6b2", // the sign's face (folded card): shadow, board, light
  T: "#e8e0cc",
  U: "#f8f2e3",
  v: "#7fae55", // grass: lit, shaded
  V: "#4f7d3a",
  "~": "#ffcf6a55", // lamplight spilled on the ground (see-through)
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "5678";

const W = 144;
const H = 128;
const FOOT = 124;

// ---- The cottage, in an oblique view: the gable end faces us, its side runs back to the right.

/** The gable wall: its middle, half-width, peak, eave and base. */
const GX = 49;
const HALF = 27;
const PEAK = 24;
const EAVE = 72;
const BASE = 116;
const FR = GX + HALF;
/** Going back one depth: right and up. */
const DX = 32;
const DY = -12;
const SLOPE = DY / DX;
const hw = (Y: number) => (Y < EAVE ? (HALF * (Y - PEAK)) / (EAVE - PEAK) : HALF);

/** The roof's front: its peak, and the front edge running down to the eave at the right. */
const AX = GX;
const AY = 19;
const ROOF_EAVE = 75;
const EX = 31.5;
const EY = ROOF_EAVE - AY;
const hr = (Y: number) => (EX * (Y - AY)) / EY;
const DET = EX * DY - DX * EY;
/** A point on the roof's right face as (s, t): s from the ridge (0) down to the eave (1), t from the front (0) back (1). */
const roofST = (px: number, py: number): [number, number] => {
  const x = px - AX;
  const y = py - AY;
  return [(DY * x - DX * y) / DET, (-EY * x + EX * y) / DET];
};
const eaveY = (px: number) => ROOF_EAVE + SLOPE * (px - (AX + EX));

// ---- The handwriting: short broken lines in faded ink, words of a few pixels, a letter rising here and there.

interface Line {
  x0: number;
  x1: number;
  y0: number;
  slope: number;
  on: number[];
}
function line(x0: number, x1: number, y0: number, slope: number, id: number): Line {
  const n = x1 - x0 + 1;
  const on: number[] = [];
  let w = 0;
  while (on.length < n) {
    const len = 1 + Math.floor(grain(w, id, 7) * 4);
    for (let k = 0; k < len && on.length < n; k++) {
      const g = grain(on.length, id, 9);
      on.push(g > 0.72 ? -1 : g < 0.1 ? NaN : 0);
    }
    const gap = grain(w, id, 8) > 0.5 ? 2 : 1;
    for (let k = 0; k < gap && on.length < n; k++) on.push(NaN);
    w++;
  }
  return { x0, x1, y0, slope, on };
}
const inked = (lines: readonly Line[], x: number, y: number): boolean =>
  lines.some((L) => {
    if (x < L.x0 || x > L.x1) return false;
    const off = L.on[x - L.x0]!;
    if (Number.isNaN(off)) return false;
    return y === Math.floor(L.y0 + (x + 0.5 - L.x0) * L.slope) + off;
  });

const FRONT_LINES = [
  line(38, 47, 50, 0, 1),
  line(34, 45, 57, 0, 3),
  line(26, 42, 78, 0, 4),
  line(26, 37, 85, 0, 5),
  line(51, 59, 52, 0, 11),
  line(51, 63, 59, 0, 13),
  line(56, 72, 78, 0, 14),
  line(56, 68, 85, 0, 15),
  line(59, 72, 102, 0, 16),
];
const SIDE_LINES = [line(79, 100, 88.5, SLOPE, 21), line(79, 95, 95.5, SLOPE, 22), line(79, 90, 102.5, SLOPE, 24)];
/** On the roof: lines running back along it, starting a little in from its front edge. */
const ROOF_LINES = [0.24, 0.4, 0.56, 0.72].map((s, i) => {
  const t0 = 0.12;
  const t1 = 0.62 + grain(i, 0, 31) * 0.25;
  const x0 = AX + s * EX + t0 * DX;
  const y0 = AY + s * EY + t0 * DY;
  return line(Math.round(x0), Math.round(x0 + (t1 - t0) * DX), y0, SLOPE, 31 + i);
});

// ---- The walls: the gable lit on its left half and mid on its right (a soft mountain fold down its middle), the side
// shaded, the roof's shadow under its edges.

const walls = paint(20, 22, 92, 96, (x, y) => {
  const X = x + 0.5 - GX;
  const Y = y + 0.5;
  if (x + 0.5 <= FR) {
    if (Y > BASE || Y < PEAK) return null;
    const h = hw(Y);
    if (Math.abs(X) > h) return null;
    const lit = X < 0;
    const shadowed = Y < EAVE + 1.5 && Math.abs(X) > h - 1.8;
    if (inked(FRONT_LINES, x, y)) return lit && !shadowed ? "i" : "j";
    if (shadowed) return lit ? "c" : "d";
    if (X > HALF - 1 && Y > EAVE + 3) return "b"; // the corner's fold catching the light
    return lit ? "b" : "c";
  }
  const t = (x + 0.5 - FR) / DX;
  if (t > 1) return null;
  const top = EAVE + DY * t;
  const bot = BASE + DY * t;
  if (Y < top || Y > bot) return null;
  if (Y < eaveY(x + 0.5) + 3) return "e";
  if (inked(SIDE_LINES, x, y)) return "m";
  return "d";
});

// ---- The roof: its right face mid, a crease across it; its front edge folded under (shaded) beside the gable; gilt
// along the ridge and the front edge.

const CREASE = (px: number) => AY + ((ROOF_EAVE + DY - AY) / (EX + DX)) * (px - AX);
const roof = paint(14, 5, 102, 72, (x, y) => {
  const px = x + 0.5;
  const py = y + 0.5;
  const [s, t] = roofST(px, py);
  if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
    if (s * EY < 1.6) return grain(x, 0, 3) > 0.7 ? "G" : "g"; // the ridge
    if (t * DX < 1.3) return "g"; // the front edge
    const upper = py < CREASE(px); // the crease from the front peak back to the far eave: two facets
    if (Math.abs(py - CREASE(px)) < 0.5 && s > 0.08) return "a"; // the crease's edge
    if (inked(ROOF_LINES, x, y)) return upper ? "i" : "j";
    return upper ? "b" : "c";
  }
  const X = px - GX;
  if (py < AY || py > ROOF_EAVE) return null;
  const outer = hr(py);
  if (Math.abs(X) > outer) return null;
  const inner = py < PEAK ? -1 : hw(py);
  if (Math.abs(X) <= inner) return null;
  if (X < 0 && Math.abs(X) > outer - 1.2) return "g";
  return "d";
});

// ---- The doorway: a pointed opening (a folded corner over it), warm lamplight inside.

const DOOR_HALF = 7.5;
const DOOR_TOP = 91;
const DOOR_SHOULDER = 97;
const doorTop = (X: number) => DOOR_TOP + ((DOOR_SHOULDER - DOOR_TOP) * Math.abs(X)) / DOOR_HALF;
const doorway = paint(GX - 8, DOOR_TOP, 17, BASE - DOOR_TOP, (x, y) => {
  const X = x + 0.5 - GX;
  const Y = y + 0.5;
  if (Math.abs(X) > DOOR_HALF || Y < doorTop(X) || Y > BASE) return null;
  if (X < -DOOR_HALF + 2) return Y > 112 ? "3" : "4"; // the jamb's inside
  if (Y < doorTop(X) + 1.5) return "4"; // shade under the top
  if (Y > 113) return "2"; // the floor
  const d = Math.hypot(X - 1, (Y - 106) * 0.8);
  return d < 3 ? "1" : d < 6 ? "2" : "3";
});

/** The door: a folded flap on its left hinge, swung a little open toward us. */
const FLAP_X0 = 35;
const FLAP_X1 = 41;
const flap = paint(FLAP_X0, DOOR_TOP, FLAP_X1 - FLAP_X0 + 1, BASE + 3 - DOOR_TOP, (x, y) => {
  const f = (FLAP_X1 + 1 - (x + 0.5)) / (FLAP_X1 + 1 - FLAP_X0); // 0 at the hinge, 1 at the free edge
  const Y = y + 0.5;
  const bot = BASE + 3 * f;
  const top = f < 0.5 ? DOOR_SHOULDER - (DOOR_SHOULDER - DOOR_TOP - 1.5) * (f / 0.5) : DOOR_TOP + 1.5 + (DOOR_SHOULDER + 3 - DOOR_TOP - 1.5) * ((f - 0.5) / 0.5);
  if (Y < top || Y > bot) return null;
  if (x === FLAP_X0 + 1 && Math.abs(Y - 108) < 1) return "g"; // a gilt pull
  if (Y < top + 1.2 && f >= 0.5) return "a";
  return f < 0.5 ? "c" : "b";
});

/** Folio's seal over the door: a vermilion stamp, the pawn knocked out to the paper. */
const SEAL = [
  ".rrrrrrr.",
  "rrrrarrrR",
  "rrraaarrR",
  "rrrrarrrR",
  "rrraaarrR",
  "rrraaarrR",
  "rraaaaarR",
  "rrrrrrrrR",
  ".RRRRRRR.",
];
const SEAL_AT: Pt = [GX - 4, 80];
const seal: Part = { grid: SEAL, outline: false };

// ---- By the door: a stack of folded pages and a closed book.

const pages = paint(24, 105, 9, 11, (x, y) => {
  const j = y - 105;
  if (j < 2) {
    // a folded page standing on top, a little tent
    const X = x + 0.5 - 28.5;
    if (j === 0) return Math.abs(X) < 1 ? "a" : null;
    return Math.abs(X) < 2.5 ? (X < 0 ? "a" : "c") : null;
  }
  const sheet = (j - 2) >> 1;
  const shift = sheet % 2 ? 1 : 0;
  if (x - 24 < shift || x - 24 > 7 + shift) return null;
  if ((j - 2) % 2 === 0) return sheet === 0 && x > 26 && x < 30 ? "i" : "a";
  return "c";
});
const book = paint(12, 110, 13, 6, (x, y) => {
  const i = x - 12;
  const j = y - 110;
  if (j < 3) {
    if (i < j) return null; // the cover, seen from above at a slant
    if (j === 1 && (i === 3 || i === 9)) return "g"; // gilt corners
    return i > 9 ? "n" : "o";
  }
  if (j === 5) return "n";
  if (i === 0) return "n"; // the spine
  return j === 3 ? "a" : "c"; // the pages' edge
});

// ---- The three cranes, each on its thread from the eave.

const CRANE = [".....a.....", "....abc....", "g...abc...c", ".b..abc..c.", "..bbbbcccc.", "....bcc...."];
const crane: Part = { grid: CRANE };
/** Where each thread meets the eave, its length, and whether the crane faces the other way. */
const CRANES: readonly [number, number, boolean][] = [
  [86, 9, false],
  [96, 15, true],
  [106, 7, false],
];
const SWAY = [0, 1, 1, 0, -1, -1];
const PHASE = [0, 2, 5];

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);

const threadName = (len: number, dx: number) => {
  const name = `thread${len}_${dx}`;
  if (!parts[name]) {
    const grid = Array.from({ length: len }, (_, j) => {
      const off = Math.round((dx * (j + 1)) / len) + 1;
      return [".", ".", "."].map((_, i) => (i === off ? "t" : ".")).join("");
    });
    parts[name] = { grid, outline: false };
  }
  return name;
};

// ---- The sign: a blank board of folded card in a wooden frame, on two posts, front right.

const BOARD: Pt = [94, 95];
const BW = 46;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "STU", "g");
const posts = [signPost(BOARD[0] + 5, BOARD[1] + BH - 4, FOOT, WOOD), signPost(BOARD[0] + BW - 8, BOARD[1] + BH - 4, FOOT, WOOD)];

const shadow = groundShadow(72, BASE + 1.5, 64, 6);
const glow = paint(GX - 10, BASE, 21, 5, (x, y) => {
  const d = ((x + 0.5 - GX) / 10) ** 2 + ((y + 0.5 - BASE - 1) / 3.5) ** 2;
  return d <= 1 ? "~" : null;
}, false);

parts.crane = crane;
parts.seal = seal;
const back = [add("shadow", shadow), add("walls", walls), add("roof", roof), add("glow", glow), add("doorway", doorway), add("flap", flap)];
const backLayers: Layer[] = [...back.map((p) => ({ part: p, x: at[p]![0], y: at[p]![1] })), { part: "seal", x: SEAL_AT[0], y: SEAL_AT[1] }];
const tufts = [tuft(8, BASE + 2, 7, "vV"), tuft(65, BASE + 2, 6, "vV"), tuft(89, FOOT, 7, "vV"), tuft(130, FOOT + 1, 6, "vV")];
const front = [...tufts.map((p, i) => add(`tuft${i}`, p)), add("book", book), add("pages", pages), add("postL", posts[0]!), add("postR", posts[1]!), add("board", board)];
const frontLayers: Layer[] = front.map((p) => ({ part: p, x: at[p]![0], y: at[p]![1] }));

function craneLayers(f: number): Layer[] {
  const out: Layer[] = [];
  CRANES.forEach(([ax, len, flip], i) => {
    const dx = SWAY[(f + PHASE[i]!) % SWAY.length]!;
    const ay = Math.ceil(eaveY(ax + 0.5)) + 1;
    out.push({ part: threadName(len, dx), x: ax - 1, y: ay });
    out.push({ part: "crane", x: ax + dx - 5, y: ay + len, flipX: flip });
  });
  return out;
}

/** The lamplight dips once in the loop. */
const DIM: Record<string, string> = { "1": "#ffdf8a", "2": "#f2b050", "3": "#d27c34", "~": "#ffcf6a33" };
const frames: Frame[] = SWAY.map((_, f) => ({
  ms: 320,
  layers: [...backLayers, ...craneLayers(f), ...frontLayers],
  pal: f === 3 ? DIM : undefined,
}));

const idle: Anim = { loop: true, frames };

export const HOUSE_FOLIO: Character = {
  id: "house-folio",
  name: "Folio's Folded House",
  w: W,
  h: H,
  foot: [72, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Folio's Folded House" on. */
export const HOUSE_FOLIO_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
