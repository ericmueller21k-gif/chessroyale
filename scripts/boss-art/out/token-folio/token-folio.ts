import type { Character, Frame, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const C = 20; // the coin's middle (pixel corner)
const rad = (x: number, y: number) => Math.hypot(x + 0.5 - C, y + 0.5 - C);
const inside = (x: number, y: number) => rad(x, y) < 13.6;

type Fn = (x: number, y: number) => string | null;
function paint(x0: number, y0: number, w: number, h: number, fn: Fn) {
  const grid: string[] = [];
  for (let y = y0; y < y0 + h; y++) {
    let row = "";
    for (let x = x0; x < x0 + w; x++) row += fn(x, y) ?? ".";
    grid.push(row);
  }
  return { part: { grid }, at: [x0, y0] as const };
}

// The coin: gold rim with rivets, a dark inner ring, the navy middle (the crest's own build).
const disc = paint(0, 0, 40, 40, (x, y) => {
  const dx = x + 0.5 - C;
  const dy = y + 0.5 - C;
  const r = Math.hypot(dx, dy);
  if (r > 18.4) return null;
  if (r > 15) {
    const lit = (-dx - dy) / (r * Math.SQRT2);
    const a = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const near = Math.abs(a / step - Math.round(a / step)) * step * r < 0.6;
    if (near && r > 16.2 && r < 17.3) return "O";
    if (r > 17.6) return lit < -0.4 ? "O" : "Y";
    return lit > 0.35 ? "y" : lit < -0.45 ? "O" : "Y";
  }
  if (r > 14.2) return "k";
  if (y >= 27) return "n";
  return "N";
});

// --- Folio: flat paper faces from polygons, outlined in k, clipped by the inner ring ---
type P = readonly [number, number];
function inPoly(px: number, py: number, poly: readonly P[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const INK: Record<string, string> = { A: "i", B: "i", C: "j", D: "l" };
function folded(poly: readonly P[], face: Fn, ink: Set<string> = new Set()) {
  const S = (x: number, y: number) => inPoly(x + 0.5, y + 0.5, poly);
  return paint(0, 0, 40, 40, (x, y) => {
    const r = rad(x, y);
    if (r >= 14.6) return null;
    if (S(x, y)) {
      if (!inside(x, y)) return "k";
      const f = face(x, y);
      if (f && ink.has(`${x},${y}`) && INK[f]) return INK[f];
      return f;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]])
      if (S(x + dx, y + dy)) return "k";
    return null;
  });
}
const strokes = (...runs: [number, number, number][]) => {
  const s = new Set<string>();
  for (const [x0, x1, y] of runs) for (let x = x0; x <= x1; x++) s.add(`${x},${y}`);
  return s;
};

// The wing rising behind: a tall fold, its leading edge gilt, the vermilion seal on its lit face.
const WING: P[] = [[20.5, 32], [29.5, 4], [35, 32]];
const wingS = (x: number, y: number) => inPoly(x + 0.5, y + 0.5, WING);
const SEAL = ["vvvv", "vBvv", "BBBw", "vwww"];
const wing = folded(
  WING,
  (x, y) => {
    if (!wingS(x - 1, y) && y < 31) return y < 11 ? "H" : "G";
    if (!wingS(x - 2, y) && y < 31) return "G";
    const sx = x - 25;
    const sy = y - 24;
    if (sx >= 0 && sx < 4 && sy >= 0 && sy < 4) return SEAL[sy][sx];
    const cx = 29.5 + (y - 4) * 0.02; // the crease down the wing
    if (Math.abs(x + 0.5 - cx - 0.5) < 0.5) return "E";
    return x + 0.5 < cx ? "B" : "D";
  },
  strokes([26, 28, 15], [27, 28, 16], [26, 28, 20], [31, 32, 17], [31, 32, 22], [31, 33, 26]),
);

// The body's shoulder folds along the bottom.
const BODY: P[] = [[2, 34], [14, 30.5], [25, 31.5], [38, 34], [38, 41], [2, 41]];
const body = folded(
  BODY,
  (x, y) => (x === 24 && y >= 32 ? "E" : x < 24 ? (y <= 32 && x < 15 ? "A" : "B") : "C"),
  strokes([9, 11, 34], [26, 28, 34]),
);

// The neck: a long spike of two faces, lit left, shaded right.
const NECK: P[] = [[14.5, 16.5], [18.5, 14], [24, 35], [16.5, 35]];
const neckEdge = (y: number) => 16 + (y - 16) * 0.22; // the fold between the two faces
const neck = folded(
  NECK,
  (x, y) => (x + 0.5 < neckEdge(y) ? "B" : "C"),
  strokes([16, 17, 24], [17, 18, 29], [19, 20, 21], [20, 21, 27]),
);

// The head: a folded beak pointing left, a crease along it, the eye and its brow.
const HEAD: P[] = [[6.5, 15.5], [16, 7.5], [21, 10], [20.5, 16.5], [14, 17.5]];
const headS = (x: number, y: number) => inPoly(x + 0.5, y + 0.5, HEAD);
const creaseY = (x: number) => 15.5 + ((12.5 - 15.5) * (x + 0.5 - 6.5)) / 14;
const head = folded(HEAD, (x, y) => {
  if ((x === 15 || x === 16) && (y === 11 || y === 12)) return "x"; // the eye
  if (y === 10 && (x === 14 || x === 15)) return "x"; // its brow
  const c = creaseY(x);
  if (x >= 19) return y < c ? "C" : "D"; // the back of the head folds away
  if (Math.abs(y + 0.5 - c) < 0.6) return "E";
  if (y + 0.5 < c) return headS(x, y - 1) ? "B" : "A";
  return "C";
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [W("disc", disc.at), W("wing", wing.at), W("body", body.at), W("neck", neck.at), W("head", head.at)];

// A glint riding round the rim: four steps from the top left, then rest.
function glint(deg: number): Speck[] {
  const a = deg * (Math.PI / 180);
  const r = 16.7;
  const at = (da: number): [number, number] => [Math.floor(C + r * Math.cos(a + da)), Math.floor(C + r * Math.sin(a + da))];
  const [x, y] = at(0);
  const [x1, y1] = at(0.09);
  const [x2, y2] = at(-0.09);
  return [[x1, y1, "y"], [x2, y2, "y"], [x, y - 2, "y"], [x, y + 2, "y"], [x - 2, y, "y"], [x + 2, y, "y"], [x, y - 1, "M"], [x, y + 1, "M"], [x - 1, y, "M"], [x + 1, y, "M"], [x, y, "M"]];
}

const BLINK: Speck[] = [[15, 11, "B"], [16, 11, "B"]];
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_FOLIO: Character = {
  id: "token-folio",
  name: "Folio token",
  w: 40,
  h: 40,
  foot: [20, 39],
  palette: {
    k: "#2a1c14",
    Y: "#f4b740",
    y: "#ffe08a",
    O: "#b97c10",
    N: "#1f2a44",
    n: "#34466e",
    M: "#fffbea",
    // paper
    A: "#fff7e6",
    B: "#f3e7cc",
    C: "#d3bd95",
    D: "#a58e69",
    E: "#76624c",
    // ink
    i: "#8a93b8",
    j: "#717898",
    l: "#575c78",
    x: "#1c1620",
    // gilt
    G: "#f2c14e",
    H: "#fff0b4",
    // seal
    v: "#d8432a",
    w: "#a3301e",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    wing: wing.part,
    body: body.part,
    neck: neck.part,
    head: head.part,
  },
  anims: {
    idle: {
      loop: true,
      frames: [
        frame(180, glint(-135)),
        frame(180, glint(-75)),
        frame(180, glint(-15)),
        frame(180, glint(45)),
        frame(1400),
        frame(150, BLINK),
      ],
    },
  },
};
