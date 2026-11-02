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

/** A part from a mask: outlined in k where the mask ends, clipped by the inner ring. */
type Mask = (x: number, y: number) => boolean;
function shape(x0: number, y0: number, w: number, h: number, mask: Mask, col: Fn) {
  return paint(x0, y0, w, h, (x, y) => {
    if (!inside(x, y) || !mask(x, y)) return null;
    if (!mask(x - 1, y) || !mask(x + 1, y) || !mask(x, y - 1) || !mask(x, y + 1)) return "k";
    return col(x, y);
  });
}
function inTri(px: number, py: number, a: number[], b: number[], c: number[]) {
  const s = (p: number[], q: number[]) => (px - q[0]!) * (p[1]! - q[1]!) - (p[0]! - q[0]!) * (py - q[1]!);
  const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

// Shoulders: pink chest in his open brown vest, a gold star on the vest, a rope coil on his shoulder.
const bodyMask: Mask = (x, y) => y >= 28 && Math.abs(x + 0.5 - C) <= 6 + (y - 28) * 1.6;
const body = shape(5, 27, 30, 8, bodyMask, (x, y) => {
  const d = x + 0.5 - C;
  const chest = 1.5 + (y - 28) * 0.5;
  const STAR: Record<string, string> = { "25,29": "y", "24,30": "Y", "25,30": "y", "26,30": "Y", "24,31": "O", "26,31": "O" };
  if (STAR[`${x},${y}`]) return STAR[`${x},${y}`]!;
  if (Math.abs(d) < chest) return d < 0 ? "c" : "b";
  if (Math.abs(d) < chest + 1) return "k";
  return d < -6 ? "j" : d > 6 ? "H" : "h";
});
const coilMask: Mask = (x, y) => {
  const e = Math.hypot((x + 0.5 - 11) / 3.2, (y + 0.5 - 30.5) / 2.6);
  return e < 1.25 && e > 0.35;
};
const coil = shape(6, 26, 11, 8, coilMask, (x, y) => (y + 0.5 < 30.5 ? (x < 11 ? "t" : "R") : x < 11 ? "R" : "r"));

// Pointy pink ears, out from under the brim.
const earMask = (s: number): Mask => (x, y) => {
  const X = s > 0 ? x + 0.5 : 40 - (x + 0.5);
  return inTri(X, y + 0.5, [7, 9], [10, 18], [15, 13]);
};
const ear = (s: number, x0: number) =>
  shape(x0, 8, 9, 11, earMask(s), (x, y) => {
    const X = s > 0 ? x + 0.5 : 40 - (x + 0.5);
    if (inTri(X, y + 0.5, [8.6, 11], [11, 16.5], [13.6, 13.4])) return "m";
    return s > 0 ? "c" : "b";
  });
const earL = ear(1, 5);
const earR = ear(-1, 26);

// The head: pink, angry brows, white eyes, a big snout, a toothy scheming grin.
const headMask: Mask = (x, y) => y >= 12 && Math.hypot((x + 0.5 - C) / 9.6, (y + 0.5 - 20.6) / 8) < 1;
function skin(x: number, y: number): string {
  const dx = (x + 0.5 - C) / 9.6;
  const dy = (y + 0.5 - 20.6) / 8;
  const lit = -dx * 0.6 - dy * 0.8;
  return lit > 0.45 ? "d" : lit > -0.15 ? "c" : lit > -0.6 ? "b" : "a";
}
const snoutIn = (x: number, y: number) => Math.hypot((x + 0.5 - C) / 4.3, (y + 0.5 - 21) / 2.2) < 1;
const FACE: Record<string, string> = {};
const put = (k: string, pts: [number, number][]) => pts.forEach(([x, y]) => (FACE[`${x},${y}`] = k));
// brows, low over the inner eye
put("B", [[12, 14], [13, 14], [14, 14], [14, 15], [15, 15], [16, 15], [17, 15], [16, 16], [17, 16]]);
put("B", [[27, 14], [26, 14], [25, 14], [25, 15], [24, 15], [23, 15], [22, 15], [23, 16], [22, 16]]);
// eyes, narrowed under the brows, glancing in
put("w", [[14, 16], [15, 16], [14, 17], [25, 16], [24, 16], [25, 17]]);
put("x", [[16, 17], [15, 17], [23, 17], [24, 17]]);
// the grin: clenched and toothy, wide, up higher on our right
put("x", [[14, 22], [15, 23], [16, 23], [17, 23], [18, 23], [19, 23], [20, 23], [21, 23], [22, 23], [23, 23], [24, 22], [25, 22], [26, 21]]);
put("x", [[15, 24], [16, 25], [17, 25], [18, 25], [19, 25], [20, 25], [21, 25], [22, 25], [23, 25], [24, 24], [25, 23]]);
put("w", [[16, 24], [17, 24], [19, 24], [20, 24], [22, 24], [23, 24], [24, 23]]);
put("i", [[18, 24], [21, 24]]);
const head = shape(9, 11, 22, 19, headMask, (x, y) => {
  const f = FACE[`${x},${y}`];
  if (f) return f;
  if (snoutIn(x, y)) {
    if (!snoutIn(x - 1, y) || !snoutIn(x + 1, y) || !snoutIn(x, y - 1) || !snoutIn(x, y + 1)) return "m";
    if ((x === 18 || x === 21) && (y === 20 || y === 21)) return "x";
    if (y === 20 && (x === 17 || x === 19)) return "e";
    return y === 21 && x > 20 ? "c" : "d";
  }
  return skin(x, y);
});

// The brown cowboy hat: a dented crown, a dark band, the gold star, a brim curled up at the ends.
const hatMask: Mask = (x, y) => {
  if (y <= 6) return x >= 15 && x <= 24 && !(y === 6 ? false : x >= 19 && x <= 20) && !(y === 5 && (x < 16 || x > 23));
  if (y === 7) return x >= 14 && x <= 25;
  if (y <= 10) return x >= 13 && x <= 26;
  if (y === 11) return x >= 9 && x <= 30;
  if (y === 12) return x >= 10 && x <= 29;
  return false;
};
const curl: Mask = (x, y) => y === 10 && (x === 9 || x === 10 || x === 29 || x === 30);
const hatAll: Mask = (x, y) => hatMask(x, y) || curl(x, y);
const hat = shape(8, 4, 24, 10, hatAll, (x, y) => {
  const STAR: Record<string, string> = { "20,6": "y", "19,7": "y", "20,7": "y", "21,7": "Y", "18,7": "Y", "22,7": "Y", "19,8": "Y", "21,8": "O" };
  const s = STAR[`${x},${y}`];
  if (s) return s;
  if (y === 9) return x < 16 ? "Q" : "q";
  if (y >= 11) return y === 12 ? "H" : x < 16 ? "J" : x > 25 ? "h" : "j";
  if (y === 10) return x < 14 ? "J" : x > 25 ? "h" : "h";
  return x < 16 ? "J" : x < 19 ? "j" : x > 23 ? "H" : "h";
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [
  W("disc", disc.at),
  W("body", body.at),
  W("earL", earL.at),
  W("earR", earR.at),
  W("head", head.at),
  W("hat", hat.at),
];

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

// The blink: eyes shut to a line under a pink lid.
const BLINK: Speck[] = [
  ...[14, 15, 24, 25].map((x) => [x, 16, skin(x, 16)] as Speck),
  ...[14, 15, 16, 23, 24, 25].map((x) => [x, 17, "x"] as Speck),
];
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_PIG: Character = {
  id: "token-pig",
  name: "Wrangler token",
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
    // pink skin
    a: "#c0566a",
    b: "#e47a8a",
    c: "#f7a1aa",
    d: "#ffc9c9",
    e: "#ffe0dc",
    m: "#93354a",
    x: "#170909",
    w: "#ffffff",
    i: "#d8c6c2",
    B: "#331509",
    // leather
    H: "#4a2611",
    h: "#6c3d1c",
    j: "#8f5629",
    J: "#b5733a",
    q: "#2c170e",
    Q: "#4b2c1b",
    // rope
    r: "#8c5a26",
    R: "#c58f4b",
    t: "#ecc47c",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    body: body.part,
    earL: earL.part,
    earR: earR.part,
    head: head.part,
    hat: hat.part,
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
