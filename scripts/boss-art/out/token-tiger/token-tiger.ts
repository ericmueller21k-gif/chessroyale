import type { Character, Frame, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const C = 20; // the coin's middle (pixel corner)
const rad = (x: number, y: number) => Math.hypot(x + 0.5 - C, y + 0.5 - C);
const inside = (x: number, y: number) => rad(x, y) < 13.6;

type Fn = (x: number, y: number) => string | null;
function paint(x0: number, y0: number, w: number, h: number, fn: Fn, outline = true) {
  const grid: string[] = [];
  for (let y = y0; y < y0 + h; y++) {
    let row = "";
    for (let x = x0; x < x0 + w; x++) row += fn(x, y) ?? ".";
    grid.push(row);
  }
  return { part: { grid, outline }, at: [x0, y0] as const };
}

// The coin: gold rim with rivets, a dark inner ring, the navy middle (the approved tokens' own build).
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

// Shoulders: the red ringmaster's vest, gold edging and buttons, his cream chest fur in the V.
const body = paint(6, 27, 28, 8, (x, y) => {
  if (!inside(x, y)) return null;
  const d = x + 0.5 - C;
  const hw = 6 + (y - 28) * 1.7;
  if (y < 28 || Math.abs(d) > hw) return null;
  const v = 1.6 + (y - 28) * 0.45; // the V of the chest
  if (Math.abs(d) < v) return d < -0.5 ? "i" : d > 0.8 ? "w" : "W";
  if (Math.abs(d) < v + 1) return d < 0 ? "L" : "J"; // gold edging
  const bx = v + 2.3;
  if ((y === 30 || y === 32) && Math.abs(Math.abs(d) - bx) < 0.6) return "L"; // buttons
  if (Math.abs(d) > hw - 1.5) return d < 0 ? "C" : "A";
  return d < -4 ? "D" : d > 4 ? "B" : "C";
});

// One small pawn balloon on its string, beside him (blue, shiny).
const balloon = paint(7, 13, 4, 8, (x, y) => {
  const lx = x - 7;
  const j = y - 13;
  if (j <= 2) {
    // the round head
    if (lx === 0) return null;
    if (j === 0 && lx === 1) return "j";
    if (j === 0 && lx === 3) return "U";
    if (j === 1 && lx === 1) return "j";
    return lx === 3 ? "u" : "U";
  }
  if (j === 3) return lx === 1 || lx === 2 ? (lx === 1 ? "U" : "u") : null; // neck
  if (j <= 5) return lx === 0 ? (j === 4 ? "j" : "U") : lx === 3 ? "u" : "U"; // the base
  if (j === 6) return lx === 1 || lx === 2 ? "u" : null; // knot
  return null;
});
const string = paint(9, 20, 2, 9, (x, y) => (x === 9 + (y > 24 ? 1 : 0) ? "g" : null), false);

// The head: orange fur, black stripes, cream cheek ruff and muzzle, amber eyes.
const headHalf = (y: number): number => {
  if (y < 12 || y > 28) return -1;
  const T: Record<number, number> = { 12: 5, 13: 7, 14: 8, 21: 8.7, 22: 9.6, 23: 9.8, 24: 9.8, 25: 9.4, 26: 8.4, 27: 6.6, 28: 4.4 };
  return T[y] ?? 8.4;
};
const fur = (x: number, y: number): string => {
  const d = x + 0.5 - C;
  const t = d / 8.4;
  if (y <= 13 && t < 0.3) return "p";
  return t < -0.5 ? "p" : t > 0.5 ? "q" : "o";
};
const STRIPES = new Set([
  // forehead bars
  "18,13", "19,13", "20,13", "21,13", "19,15", "20,15", "16,14", "16,15", "23,14", "23,15",
  // sides of the head
  "12,15", "13,15", "13,16", "27,15", "26,15", "26,16", "12,17", "27,17",
  // the cheek ruff
  "11,22", "12,22", "12,23", "28,22", "27,22", "27,23", "11,25", "12,25", "28,25", "27,25",
]);
const head = paint(10, 12, 20, 17, (x, y) => {
  const hw = headHalf(y);
  const d = x + 0.5 - C;
  if (hw < 0 || Math.abs(d) > hw) return null;
  // eyes: amber, a dark slit pupil, a heavy calm lid
  const lx = x >= 14 && x <= 16 ? x - 14 : x >= 23 && x <= 25 ? x - 23 : -1;
  if (lx >= 0 && y === 18) return "k";
  if (lx >= 0 && (y === 19 || y === 20)) return lx === 1 ? "x" : y === 19 ? "E" : "e";
  if (y === 19 && (x === 13 || x === 26)) return "k";
  // the white brows over the eyes
  if (y === 17 && ((x >= 14 && x <= 15) || (x >= 24 && x <= 25))) return "i";
  // dark lines from the inner eye corners
  if ((x === 17 && y >= 19 && y <= 21) || (x === 22 && y >= 19 && y <= 21)) return "s";
  // nose
  if (y === 21 && x >= 18 && x <= 21) return x === 21 ? "R" : "r";
  if (y === 22 && (x === 19 || x === 20)) return x === 19 ? "r" : "R";
  // mouth
  if (y === 23 && (x === 19 || x === 20)) return "k";
  if (y === 24 && (x === 17 || x === 18 || x === 21 || x === 22)) return "k";
  // whisker dots
  if ((y === 23 || y === 25) && (x === 16 || x === 23)) return "v";
  // muzzle and chin
  const md = Math.hypot((x + 0.5 - 20) / 4.4, (y + 0.5 - 23.6) / 3.4);
  if (md < 1 || y >= 27) return d > 2 ? "w" : d < -1.5 && y < 26 ? "i" : "W";
  // the cheek ruff
  if (y >= 21 && Math.abs(d) > 5.8) {
    if (STRIPES.has(`${x},${y}`)) return "s";
    return d < 0 ? (y <= 23 ? "i" : "W") : y <= 22 ? "W" : "w";
  }
  if (STRIPES.has(`${x},${y}`)) return "s";
  return fur(x, y);
});

// Ears: round, orange, cream inside.
const ear = (cx: number) =>
  paint(cx - 3, 9, 6, 7, (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 12.5);
    if (d > 2.8) return null;
    if (d < 1.5 && y >= 12) return "w";
    return x + 0.5 < cx ? "p" : "q";
  });
const earL = ear(13);
const earR = ear(27);

// His small black top hat, red band, tipped to our right.
const hat = paint(15, 6, 13, 7, (x, y) => {
  if (!inside(x, y)) return null;
  if (y === 11) return x >= 16 && x <= 25 ? (x <= 18 ? "4" : x >= 24 ? "2" : "3") : null; // brim
  if (y === 12) return x >= 23 && x <= 26 ? (x === 26 ? "1" : "2") : null; // the brim dips on the tipped side
  const sh = y <= 8 ? 1 : 0;
  const x0 = 19 + sh;
  const x1 = 23 + sh;
  if (y < 7 || x < x0 || x > x1) return null;
  if (y === 10) return x === x0 ? "7" : x === x1 ? "5" : "6"; // band
  return x === x0 ? "4" : x === x1 ? "1" : x === x0 + 1 ? "3" : "2";
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [
  W("disc", disc.at),
  W("string", string.at),
  W("balloon", balloon.at),
  W("body", body.at),
  W("earL", earL.at),
  W("earR", earR.at),
  W("head", head.at),
  W("hat", hat.at),
];

// Whiskers poking out past the cheek ruff.
const WHISKERS: Speck[] = [
  [8, 23, "v"], [9, 23, "v"], [8, 25, "v"], [9, 26, "v"],
  [31, 23, "v"], [30, 23, "v"], [31, 25, "v"], [30, 26, "v"],
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

const BLINK: Speck[] = [14, 15, 16, 23, 24, 25].flatMap((x) => [[x, 18, fur(x, 18)], [x, 19, "k"], [x, 20, fur(x, 20)]] as Speck[]);
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks: [...WHISKERS, ...specks] });

export const TOKEN_TIGER: Character = {
  id: "token-tiger",
  name: "Babur token",
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
    // orange fur
    p: "#f5ad55",
    o: "#e8892a",
    q: "#c0601a",
    s: "#2a160f",
    // cream
    i: "#fff8e8",
    W: "#f3e6c8",
    w: "#d4bd96",
    v: "#e8e0cc",
    // nose
    r: "#e0837e",
    R: "#8c3b3d",
    // eyes
    E: "#ffd45a",
    e: "#f3a81f",
    x: "#140a08",
    // hat
    "1": "#0f0e14",
    "2": "#22212b",
    "3": "#3b3948",
    "4": "#62607a",
    "5": "#7d1220",
    "6": "#c0242c",
    "7": "#ee5a4f",
    // vest
    A: "#6a0e1c",
    B: "#a31a28",
    C: "#cf2f38",
    D: "#ef5c56",
    L: "#f2c14e",
    J: "#b87a14",
    // balloon
    u: "#1a4fa8",
    U: "#3d7fe0",
    j: "#a8d0ff",
    g: "#9a7a56",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    string: string.part,
    balloon: balloon.part,
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
