/**
 * Folio's Folded House: the paper crane's home on the town square. A small cottage folded from one giant sheet of
 * Folio's own paper (its palette, FOLIO_PALETTE, copied key for key): the gable end faces us as a kite-shaped flap folded
 * down over the wall like an envelope's, Folio's vermilion seal pressed on its point over the door; the roof a pleated
 * sheet, lit and shaded strips with crisp mountain and valley creases and a zigzag eave; the walls with a fold down the
 * middle, a diagonal crease on the shaded side and a hem folded up along the bottom; the paper's thickness a darker
 * pixel at every cut edge. Faint handwriting in Folio's faded blue ink on the lit and mid faces (none on the shaded). Gilt
 * along the ridge and the roof's front edge; a paper crane perched on the ridge like a weathervane; three small cranes
 * hanging from the eave on ink-blue thread; the door a folded flap standing a little open on warm lamplight; a stack of
 * folded pages and a closed book by the door; a blank sign board on two posts in front (the game writes the name on it).
 * Light from the top left.
 * `idle`: the hanging cranes sway on their threads, each out of step; once in the loop the lamplight flickers.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../../../packages/app/src/characters/sprite.ts";
import { inPoly } from "../../../../packages/app/src/characters/paint.ts";
import { grain, groundShadow, paint, signBoard, signFace, signPost, type Pt } from "../../../../packages/app/src/town/houses/kit.ts";

/** Folio's own colors (scripts/boss-art/out/folio/folio.ts, FOLIO_PALETTE). */
const F_: Record<string, string> = {
  k: "#2b2330",
  A: "#fff7e6",
  B: "#f3e7cc",
  C: "#d3bd95",
  D: "#a58e69",
  E: "#76624c",
  i: "#8a93b8",
  j: "#717898",
  l: "#575c78",
  G: "#f2c14e",
  H: "#fff0b4",
  g: "#b8862a",
  o: "#c9973c",
  q: "#e5ad45",
  v: "#d8432a",
  w: "#a3301e",
};
const PALETTE: Record<string, string> = {
  k: F_.k!, // outline
  A: F_.A!, // paper: highlight, lit face, mid face, shaded face, crease
  B: F_.B!,
  C: F_.C!,
  D: F_.D!,
  E: F_.E!,
  i: F_.i!, // faded ink: on lit paper, on mid paper; deep ink (the book's cover, the threads)
  j: F_.j!,
  l: F_.l!,
  G: F_.G!, // gilt: edge, glint, deep, in shade, warm
  H: F_.H!,
  g: F_.g!,
  o: F_.o!,
  q: F_.q!,
  v: F_.v!, // the seal: vermilion, pressed deeper
  w: F_.w!,
  "1": F_.H!, // lamplight: brightest (Folio's glint), gold, amber, deep
  "2": F_.G!,
  "3": "#d98a3a",
  "4": "#8f5a2e",
  "5": "#4e3a2c", // the sign's wood: dark to light
  "6": "#70543c",
  "7": "#93714f",
  "8": "#b89067",
  "~": "#f2c14e55", // lamplight spilled on the ground (see-through)
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "5678";

const W = 144;
const H = 136;
const FOOT = 132;

// ---- The cottage, in an oblique view: the gable end faces us, its side runs back to the right.

/** The gable wall: its middle, half-width, peak, eave and base (the right half sits a pixel higher: uneven paper). */
const GX = 46;
const HALF = 26;
const PEAK = 34;
const EAVE = 80;
const BASE = 124;
const FR = GX + HALF;
const frontBase = (x: number) => (x + 0.5 > GX + 8 ? BASE - 1 : BASE);
/** Going back one depth: right and up. */
const DX = 34;
const DY = -12;
const SLOPE = DY / DX;
const hw = (Y: number) => (Y < EAVE ? (HALF * (Y - PEAK)) / (EAVE - PEAK) : HALF);

/** The roof's front: its peak, and the front edge running down to the eave at the right. */
const AX = GX;
const AY = 28;
const ROOF_EAVE = 85;
const EX = 31;
const EY = ROOF_EAVE - AY;
const hr = (Y: number) => (EX * (Y - AY)) / EY;
const DET = EX * DY - DX * EY;
/** A point on the roof's right face as (s, t): s from the ridge (0) down to the eave (1), t from the front (0) back (1). */
const roofST = (px: number, py: number): [number, number] => {
  const x = px - AX;
  const y = py - AY;
  return [(DY * x - DX * y) / DET, (-EY * x + EX * y) / DET];
};

/** The roof's pleats: each a lit face rising (valley to crest), then a shaded face falling back. */
const PLEATS = 3;
const LIT = 0.52;
const pleat = (t: number) => {
  const u = t * PLEATS;
  return u - Math.floor(u);
};
/** How far below the straight eave the pleat hangs at t (its crest hangs lowest): the zigzag. */
const ZIG = 3;
const zig = (t: number) => {
  const f = pleat(t);
  return ZIG * (f < LIT ? f / LIT : (1 - f) / (1 - LIT));
};
/** The eave's lowest pixel row under x (on the side). */
const eaveY = (px: number) => {
  const t = (px - (AX + EX)) / DX;
  return ROOF_EAVE + SLOPE * (px - (AX + EX)) + zig(Math.max(0, Math.min(0.999, t)));
};

// ---- Folio's handwriting: 1-px lines, words of small rounded humps every 3-4 px, a blank between words.

const INK = new Set<string>();
function script(x0: number, x1: number, y0: number, slope: number, seed: number) {
  let x = x0;
  for (let n = 0; x <= x1; n++) {
    const wl = 5 + Math.floor(grain(n, seed, 3) * 7);
    const lifts: number[] = [0];
    for (let m = 0; lifts.length < wl; m++) {
      const r = grain(n * 7 + m, seed, 4);
      if (r < 0.45) lifts.push(1, 1, 0, 0);
      else if (r < 0.75) lifts.push(1, 0, 0);
      else if (r < 0.88 && lifts.length > 1) lifts.push(1, 2, 2, 1, 0);
      else lifts.push(0, 1, 1, 0);
    }
    if (lifts[lifts.length - 1] !== 0) lifts.push(0);
    if (x + lifts.length - 1 > x1) break;
    for (const L of lifts) {
      const by = Math.floor(y0 + (x + 0.5 - x0) * slope);
      INK.add(`${x},${by - L}`);
      x++;
    }
    x += grain(n, seed, 5) > 0.8 ? 4 : 2;
  }
}
const inked = (x: number, y: number) => INK.has(`${x},${y}`);
// The flap: three lines on its lit half, two on its mid half.
script(33, 44, 62, 0, 1);
script(28, 44, 68, 0, 2);
script(24, 44, 74, 0, 3);
script(48, 57, 63, 0, 4);
script(48, 64, 69, 0, 5);
// The wall: three lines left of the door, two right of it.
script(22, 36, 93, 0, 6);
script(22, 33, 99, 0, 7);
script(22, 31, 105, 0, 8);
script(56, 70, 95, 0, 9);
script(56, 68, 101, 0, 10);

// ---- The walls: the front lit on its left half and mid on its right; the side shaded, a diagonal crease across it, the
// eave's shadow along its top; a hem folded up along the bottom of both.

/** The flap's bottom edge (a shallow V to its point over the door, a pixel off center: folded by hand). */
const TIP_X = GX + 0.5;
const TIP_Y = 93.5;
const vEdge = (px: number) => (px < TIP_X ? EAVE + ((TIP_Y - EAVE) * (px - (GX - HALF))) / (TIP_X - (GX - HALF)) : EAVE + ((TIP_Y - EAVE) * (FR - px)) / (FR - TIP_X));
/** The side's crease: from high at the front corner to low at the back. */
const creaseY = (px: number) => EAVE + 9 + ((px - FR) / DX) * 11;

const walls = paint(18, PEAK, 92, BASE - PEAK + 1, (x, y) => {
  const px = x + 0.5;
  const py = y + 0.5;
  const X = px - GX;
  if (px <= FR) {
    const base = frontBase(x);
    if (py < PEAK || py > base || Math.abs(X) > hw(py)) return null;
    const lit = X < 0;
    if (py > base - 3) return py < base - 2 ? (lit ? "A" : "B") : lit ? "C" : "D"; // the hem: its fold, then the turned-up strip
    if (py < vEdge(px) + 2.5) return lit ? "C" : "D"; // the flap's shadow
    if (x === 20) return "A"; // the paper's lit edge
    if (inked(x, y)) return lit ? "i" : "j";
    return lit ? "B" : "C";
  }
  const t = (px - FR) / DX;
  if (t > 1) return null;
  const top = EAVE + DY * t;
  const bot = BASE - 1 + DY * t;
  if (py < top || py > bot) return null;
  if (py > bot - 3) return py < bot - 2 ? "C" : "E"; // the hem
  if (py < eaveY(px) + 4) return "E"; // the eave's shadow
  if (x === FR) return "C"; // the corner's fold catching the light
  const c = py - creaseY(px);
  if (Math.abs(c) < 0.5) return "E";
  if (c < -0.5 && c > -1.5) return "C";
  return c > 0 ? "E" : "D";
});

// ---- The flap: the gable folded down over the wall, a kite: lit left, mid right, a crease at the eave where it bends,
// the roof's shadow along its top edges, its cut edge a darker pixel.

const flapPts: Pt[] = [
  [GX, PEAK - 0.5],
  [FR + 0.5, EAVE],
  [TIP_X, TIP_Y + 0.5],
  [GX - HALF - 0.5, EAVE],
];
const inFlap = inPoly(flapPts);
const flap = paint(18, PEAK - 1, 56, 62, (x, y) => {
  if (!inFlap(x, y)) return null;
  const px = x + 0.5;
  const py = y + 0.5;
  const X = px - GX;
  const lit = X < 0;
  if (!inFlap(x, y + 1)) return lit ? "C" : "D"; // the cut edge
  if (py < EAVE && Math.abs(X) > hw(py) - 2.2) return lit ? "C" : "D"; // the roof's shadow
  if (lit && X > -1) return "A"; // the fold down its middle, catching the light
  if (Math.abs(py - (EAVE + 0.5)) < 0.6 && Math.abs(X) < HALF - 2) return lit ? "C" : "D"; // the crease where it bends
  if (inked(x, y)) return lit ? "i" : "j";
  return lit ? "B" : "C";
});

// ---- The roof: a pleated sheet. On its right face lit and shaded strips, a highlight on each crest and a dark valley;
// the zigzag of the pleats along its eave, the paper's thickness under it; gilt on the ridge and the front edge; the
// overhangs under its front edges in shade.

const roof = paint(12, 14, 104, 78, (x, y) => {
  const px = x + 0.5;
  const py = y + 0.5;
  const [s, t] = roofST(px, py);
  if (t >= 0 && t <= 1 && s >= 0) {
    const sMax = 1 + zig(t) / EY;
    if (s <= sMax) {
      if (s * EY < 1.6) return grain(x, 0, 3) > 0.75 ? "H" : "G"; // the ridge
      if (t * DX < 1.3) return grain(y, 1, 3) > 0.8 ? "H" : "G"; // the front edge
      const f = pleat(t);
      const pw = DX / PLEATS; // a pleat's width, in pixels
      const lit = f < LIT;
      if ((sMax - s) * EY < 1.1) return lit ? "C" : "E"; // the paper's thickness at the eave
      if (f * pw < 1 && t * PLEATS > 0.5) return "E"; // a valley
      if (lit && (LIT - f) * pw < 1) return "A"; // a crest
      if (lit && inked(x, y)) return "i";
      return lit ? "B" : "D";
    }
    return null;
  }
  const X = px - GX;
  if (py < AY || py > ROOF_EAVE) return null;
  const outer = hr(py);
  if (Math.abs(X) > outer) return null;
  const inner = py < PEAK ? -1 : hw(py);
  if (Math.abs(X) <= inner) return null;
  if (X < 0) return Math.abs(X) > outer - 1.2 ? "G" : "D"; // the left overhang, gilt on its edge
  return "E"; // under the front edge
});

// ---- The doorway: a pointed opening, warm lamplight inside; the door a folded flap swung a little open.

const DOOR_HALF = 7.5;
const DOOR_TOP = 100;
const DOOR_SHOULDER = 106;
const doorTop = (X: number) => DOOR_TOP + ((DOOR_SHOULDER - DOOR_TOP) * Math.abs(X)) / DOOR_HALF;
const doorway = paint(GX - 8, DOOR_TOP, 17, BASE - DOOR_TOP, (x, y) => {
  const X = x + 0.5 - GX;
  const Y = y + 0.5;
  if (Math.abs(X) > DOOR_HALF || Y < doorTop(X) || Y > BASE) return null;
  if (X < -DOOR_HALF + 2) return Y > 120 ? "3" : "4"; // the jamb's inside
  if (Y < doorTop(X) + 1.5) return "4"; // shade under the top
  if (Y > 121) return "2"; // the floor
  const d = Math.hypot(X - 1, (Y - 114) * 0.8);
  return d < 3 ? "1" : d < 6 ? "2" : "3";
});
const FLAP_X0 = 33;
const FLAP_X1 = 39;
const doorFlap = paint(FLAP_X0, DOOR_TOP, FLAP_X1 - FLAP_X0 + 1, BASE + 3 - DOOR_TOP, (x, y) => {
  const f = (FLAP_X1 + 1 - (x + 0.5)) / (FLAP_X1 + 1 - FLAP_X0); // 0 at the hinge, 1 at the free edge
  const Y = y + 0.5;
  const bot = BASE + 3 * f;
  const top = f < 0.5 ? DOOR_SHOULDER - (DOOR_SHOULDER - DOOR_TOP - 1.5) * (f / 0.5) : DOOR_TOP + 1.5 + (DOOR_SHOULDER + 3 - DOOR_TOP - 1.5) * ((f - 0.5) / 0.5);
  if (Y < top || Y > bot) return null;
  if (x === FLAP_X0 + 1 && Math.abs(Y - 115) < 1) return "G"; // a gilt pull
  if (Y > bot - 1) return f < 0.5 ? "D" : "C"; // its cut edge
  if (Y < top + 1.2 && f >= 0.5) return "A";
  if (x === FLAP_X0 + 3) return "C"; // its own fold
  return f < 0.5 ? "C" : "B";
});

/** Folio's seal on the flap's point: a vermilion stamp, the pawn knocked out to the paper. */
const SEAL = [".vvvvvvv.", "vvvvAvvvw", "vvvAAAvvw", "vvvvAvvvw", "vvvAAAvvw", "vvvAAAvvw", "vvAAAAAvw", "vvvvvvvvw", ".wwwwwww."];
const seal: Part = { grid: SEAL, outline: false };
const SEAL_AT: Pt = [GX - 4, 87];

// ---- By the door: a stack of folded pages and a closed book in Folio's ink blue.

const pages = paint(23, 113, 9, 11, (x, y) => {
  const j = y - 113;
  if (j < 2) {
    const X = x + 0.5 - 27.5; // a folded page standing on top, a little tent
    if (j === 0) return Math.abs(X) < 1 ? "A" : null;
    return Math.abs(X) < 2.5 ? (X < 0 ? "A" : "C") : null;
  }
  const sheet = (j - 2) >> 1;
  const shift = sheet % 2 ? 1 : 0;
  if (x - 23 < shift || x - 23 > 7 + shift) return null;
  if ((j - 2) % 2 === 0) return sheet === 0 && x > 25 && x < 29 ? "i" : x - 23 > 5 + shift ? "B" : "A";
  return "C";
});
const book = paint(9, 118, 13, 6, (x, y) => {
  const i = x - 9;
  const j = y - 118;
  if (j < 3) {
    if (i < j) return null; // the cover, seen from above at a slant
    if (j === 1 && (i === 3 || i === 9)) return "G"; // gilt corners
    return i > 9 ? "l" : "j";
  }
  if (j === 5 || i === 0) return "l"; // the spine
  return j === 3 ? "A" : "C"; // the pages' edge
});

// ---- The crane on the ridge, Folio in small: a V of wings, a long neck to a head with a gold beak, a pointed tail.

/** Faces (a polygon and its key, later over earlier; `hi` along its top and left edges) and loose dots, as a part. */
type Face = { pts: readonly Pt[]; key: string; hi?: string };
function facesPart(faces: readonly Face[], dots: readonly (readonly [number, number, string])[] = []) {
  const all = faces.flatMap((f) => f.pts);
  const x0 = Math.floor(Math.min(...all.map((p) => p[0]))) - 1;
  const y0 = Math.floor(Math.min(...all.map((p) => p[1]))) - 1;
  const x1 = Math.ceil(Math.max(...all.map((p) => p[0]))) + 1;
  const y1 = Math.ceil(Math.max(...all.map((p) => p[1]))) + 1;
  const tests = faces.map((f) => ({ ...f, inside: inPoly(f.pts) }));
  return paint(x0, y0, x1 - x0 + 1, y1 - y0 + 1, (x, y) => {
    const dot = dots.find(([dx, dy]) => dx === x && dy === y);
    let key: string | null = null;
    for (const f of tests) if (f.inside(x, y)) key = f.hi && (!f.inside(x - 1, y) || !f.inside(x, y - 1)) ? f.hi : f.key;
    if (dot && key) return dot[2];
    return key;
  });
}
const RIDGE_T = 0.42;
const RIDGE_X = Math.round(AX + RIDGE_T * DX);
const ridgeY = Math.floor(AY + (RIDGE_X + 0.5 - AX) * SLOPE);
/** Folio's own rest pose (its points, folio.ts), at a quarter size, its keel on a gilt pin over the ridge. */
const S = 0.25;
const KEEL: Pt = [RIDGE_X + 0.5, ridgeY - 2];
const C = (x: number, y: number): Pt => [KEEL[0] + (x - 47) * S, KEEL[1] + (y - 81) * S];
const mid = (a: Pt, b: Pt, t = 0.5): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const px = (p: Pt): [number, number] => [Math.floor(p[0]), Math.floor(p[1])];
const cWingF = facesPart([
  { pts: [C(36, 57), C(34, 8), C(46, 57)], key: "C" },
  { pts: [C(46, 57), C(34, 8), C(58, 56)], key: "D" },
]);
const cNeckA = C(30, 75);
const cNeckB = C(42, 61);
const cNeckT = C(12, 27);
const cTailA = C(51, 61);
const cTailB = C(61, 74);
const cTailT = C(88, 36);
const cWL = C(29, 61);
const cWR = C(64, 59);
const cWT = C(72, 11);
const cWM = mid(cWL, cWR, 0.56);
const cWQ = C(71, 40);
const cBeak = C(2, 31);
const cBody = facesPart(
  [
    { pts: [cNeckA, mid(cNeckA, cNeckB), cNeckT], key: "B", hi: "A" },
    { pts: [mid(cNeckA, cNeckB), cNeckB, cNeckT], key: "C" },
    { pts: [cTailA, mid(cTailA, cTailB), cTailT], key: "B", hi: "A" },
    { pts: [mid(cTailA, cTailB), cTailB, cTailT], key: "C" },
    { pts: [C(28, 59), C(46, 50), C(47, 81)], key: "B", hi: "A" },
    { pts: [C(46, 50), C(64, 58), C(47, 81)], key: "C" },
    { pts: [C(11, 20), C(17, 27), cBeak], key: "B", hi: "A" },
    { pts: [C(17, 27), C(12, 32), cBeak], key: "C" },
    { pts: [cWL, cWT, cWM], key: "B", hi: "q" },
    { pts: [cWM, cWT, cWQ], key: "C" },
    { pts: [cWM, cWQ, cWR], key: "D" },
  ],
  [
    [...px(cBeak), "G"],
    [...px(cTailT), "G"],
  ],
);
const rod: Part = { grid: ["o", "g"] };

// ---- The three small cranes, each on its thread from the eave: a V of wings, a gold head, a tail point.

const CRANE = ["...C...A.", "...CD.AB.", "AB.CDAB.C", "G.BBBBBC.", "...BBCC..", "....kk..."];
const crane: Part = { grid: CRANE, outline: false };
/** Where each thread meets the eave, its length, and whether the crane faces the other way. */
const CRANES: readonly [number, number, boolean][] = [
  [84, 8, false],
  [94, 13, true],
  [104, 6, false],
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
      return [".", ".", "."].map((_, i) => (i === off ? "l" : ".")).join("");
    });
    parts[name] = { grid, outline: false };
  }
  return name;
};

// ---- The sign: a blank board of folded card in a wooden frame, on two posts, front right.

const BOARD: Pt = [98, 104];
const BW = 42;
const BH = 20;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "CBA", "G");
const posts = [signPost(BOARD[0] + 5, BOARD[1] + BH - 4, FOOT, WOOD), signPost(BOARD[0] + BW - 8, BOARD[1] + BH - 4, FOOT, WOOD)];

const shadow = groundShadow(70, BASE + 1.5, 66, 6);
const glow = paint(GX - 10, BASE, 21, 5, (x, y) => {
  const d = ((x + 0.5 - GX) / 10) ** 2 + ((y + 0.5 - BASE - 1) / 3.5) ** 2;
  return d <= 1 ? "~" : null;
}, false);

parts.crane = crane;
parts.seal = seal;
parts.cWingF = cWingF.part;
parts.cBody = cBody.part;
parts.rod = rod;
const back = [add("shadow", shadow), add("walls", walls), add("flap", flap), add("roof", roof), add("glow", glow), add("doorway", doorway), add("doorFlap", doorFlap)];
const backLayers: Layer[] = [
  ...back.map((p) => ({ part: p, x: at[p]![0], y: at[p]![1] })),
  { part: "seal", x: SEAL_AT[0], y: SEAL_AT[1] },
  { part: "rod", x: RIDGE_X, y: ridgeY - 2 },
  { part: "cWingF", x: cWingF.at[0], y: cWingF.at[1] },
  { part: "cBody", x: cBody.at[0], y: cBody.at[1] },
];
const front = [add("book", book), add("pages", pages), add("postL", posts[0]!), add("postR", posts[1]!), add("board", board)];
const frontLayers: Layer[] = front.map((p) => ({ part: p, x: at[p]![0], y: at[p]![1] }));

function craneLayers(f: number): Layer[] {
  const out: Layer[] = [];
  CRANES.forEach(([ax, len, flip], i) => {
    const dx = SWAY[(f + PHASE[i]!) % SWAY.length]!;
    const ay = Math.ceil(eaveY(ax + 0.5)) + 1;
    out.push({ part: threadName(len, dx), x: ax - 1, y: ay });
    out.push({ part: "crane", x: ax + dx - 4, y: ay + len, flipX: flip });
  });
  return out;
}

/** The lamplight dips once in the loop. */
const DIM: Record<string, string> = { "1": "#fbe39a", "2": "#e0aa45", "3": "#c27632", "~": "#f2c14e33" };
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
