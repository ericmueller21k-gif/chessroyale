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

// ---- The face: shapes painted back to front, each with its own k outline, clipped by the inner ring.
const S = 40;
const cv: (string | null)[][] = Array.from({ length: S }, () => Array<string | null>(S).fill(null));
type Shape = { has: (x: number, y: number) => boolean; col: (x: number, y: number) => string };
function draw({ has, col }: Shape, outline = true) {
  const inS = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && has(x, y);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!inside(x, y)) continue;
      if (inS(x, y)) cv[y][x] = col(x, y);
      else if (outline && (inS(x - 1, y) || inS(x + 1, y) || inS(x, y - 1) || inS(x, y + 1))) cv[y][x] = "k";
    }
}
const ell = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
// cream shading from the top left
const cream = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => {
  const u = (x + 0.5 - cx) / rx;
  const v = (y + 0.5 - cy) / ry;
  const lit = -u * 0.7 - v * 0.7;
  return lit > 0.55 ? "F" : lit < -0.6 ? "C" : lit < -0.15 ? "D" : "E";
};

// Moo's shoulders: cream with a brown patch.
draw({
  has: (x, y) => y >= 28 && Math.abs(x + 0.5 - 24) <= 6 + (y - 28) * 1.5,
  col: (x, y) => {
    const d = x + 0.5 - 24;
    if (Math.hypot(d - 6, y - 32) < 3.6) return d > 7 ? "b" : "c";
    return d < -4 ? "E" : d > 4 ? "C" : "D";
  },
});

// Floppy ears: brown, pink inside.
const ear = (cx: number, cy: number, dir: number) => {
  const e = ell(cx, cy, 4, 2.3);
  const inner = ell(cx + dir * 0.6, cy + 0.5, 2.4, 1.1);
  draw({ has: e, col: (x, y) => (inner(x, y) ? (y + 0.5 < cy + 0.5 ? "r" : "q") : y + 0.5 < cy - 0.8 ? "d" : y + 0.5 > cy + 1 ? "b" : "c") });
};
ear(15.5, 16.5, -1);
ear(32.5, 17.5, 1);

// Small tan horns.
const horn = (pts: [number, number][]) => {
  const set = new Set(pts.map(([x, y]) => `${x},${y}`));
  draw({ has: (x, y) => set.has(`${x},${y}`), col: (x, y) => (y <= pts[0][1] ? "j" : x < 23 ? "i" : "h") });
};
horn([[18, 10], [19, 11], [20, 11], [19, 12], [20, 12]]);
horn([[30, 10], [28, 11], [29, 11], [28, 12], [29, 12]]);

// The moon: a crescent rising on our left, in front of his ear, its face against Moo's cheek.
const MX = 13.5, MY = 21.5, MR = 6.4, MRY = 8;
const moonOut = ell(MX, MY, MR, MRY);
const moonIn = ell(19.5, 15.5, 6.2, 6.6);
draw({
  has: (x, y) => moonOut(x, y) && !moonIn(x, y),
  col: (x, y) => {
    const u = (x + 0.5 - MX) / MR;
    const v = (y + 0.5 - MY) / MRY;
    const lit = -u * 0.7 - v * 0.7;
    if (Math.hypot(u, v) > 0.8 && lit < -0.1) return "Q";
    return lit > 0.55 ? "P" : lit > 0.1 ? "I" : lit > -0.45 ? "H" : "G";
  },
});
// its closed happy eyes, small smile and pink cheeks
const MOON_FACE: [number, number, string][] = [
  [8, 21, "u"], [9, 20, "u"], [10, 21, "u"],
  [12, 21, "u"], [13, 20, "u"],
  [8, 23, "v"], [13, 23, "v"],
  [10, 24, "u"], [11, 24, "u"], [9, 23, "u"], [12, 23, "u"],
];
for (const [x, y, c] of MOON_FACE) if (inside(x, y)) cv[y][x] = c;

// The head: round and cream.
const headE = ell(24, 20, 7.2, 7.6);
draw({ has: headE, col: cream(23, 19, 7.2, 7.6) });

// The big brown patch over his far eye (our right).
const patch = (x: number, y: number) => ell(28, 18.5, 3.6, 3.4)(x, y) || ell(30.5, 15.5, 1.8, 1.5)(x, y);
draw({ has: (x, y) => patch(x, y) && headE(x, y), col: (x, y) => (x + y < 43 ? "c" : x + y > 48 ? "a" : "b") }, false);

// The pink snout.
const snoutE = ell(24, 25, 5.5, 3);
draw({
  has: snoutE,
  col: (x, y) => {
    if (y === 25 && (x === 21 || x === 26)) return "n";
    const u = (x + 0.5 - 24) / 5.5;
    const v = (y + 0.5 - 25) / 3;
    const lit = -u * 0.6 - v * 0.8;
    return lit > 0.55 ? "s" : lit > 0 ? "r" : lit > -0.55 ? "q" : "p";
  },
});

// Big brown eyes.
const EYES: [number, number, string][] = [];
for (const ex of [20, 27]) {
  EYES.push([ex, 18, "w"], [ex + 1, 18, "x"], [ex, 19, "x"], [ex + 1, 19, "x"], [ex, 20, "e"], [ex + 1, 20, "e"]);
  EYES.push([ex - 1, 18, "k"], [ex - 1, 19, "k"], [ex + 2, 18, "k"], [ex + 2, 19, "k"], [ex, 17, "k"], [ex + 1, 17, "k"]);
}
for (const [x, y, c] of EYES) cv[y][x] = c;

// The cream tuft between the horns.
const TUFT: [number, number, string][] = [
  [22, 11, "k"], [23, 10, "k"], [24, 11, "k"], [25, 10, "k"], [26, 11, "k"],
  [23, 11, "F"], [24, 12, "E"], [25, 11, "E"], [23, 12, "F"], [25, 12, "E"],
];
for (const [x, y, c] of TUFT) cv[y][x] = c;

const face = paint(0, 0, S, S, (x, y) => cv[y][x]);

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [W("disc", disc.at), W("face", face.at)];

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

// Moo blinks (the moon's eyes are closed already): lids of the skin round each eye, a dark lash line.
const BLINK: Speck[] = [
  [20, 18, "E"], [21, 18, "E"], [20, 19, "k"], [21, 19, "k"], [20, 20, "E"], [21, 20, "D"],
  [27, 18, "b"], [28, 18, "b"], [27, 19, "k"], [28, 19, "k"], [27, 20, "b"], [28, 20, "a"],
];
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_MOO: Character = {
  id: "token-moo",
  name: "Moo & Moon token",
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
    // Moo's cream
    C: "#bf9f78",
    D: "#e0c8a2",
    E: "#f5e6c6",
    F: "#fff6e0",
    // brown
    a: "#37201a",
    b: "#552f27",
    c: "#744339",
    d: "#92594a",
    // pink
    p: "#b95a63",
    q: "#dd7b80",
    r: "#f19c96",
    s: "#ffc1b2",
    // horns
    h: "#a9773e",
    i: "#d3a25c",
    j: "#efcb8c",
    // eyes
    e: "#b07240",
    x: "#1f0f0a",
    w: "#ffffff",
    // the moon
    G: "#e3a22b",
    H: "#f8c744",
    I: "#ffdc6c",
    P: "#fff0a8",
    Q: "#c9801f",
    u: "#6a3714",
    v: "#f08e80",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    face: face.part,
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
