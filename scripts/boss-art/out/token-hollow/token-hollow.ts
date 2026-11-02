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

// Hollow's silhouette: a shaggy, spiky head over hunched shaggy shoulders.
const HX = 20;
const HY = 17.5;
const inHead = (x: number, y: number): boolean => {
  let dx = (x + 0.5 - HX) / 8.4;
  const dy = (y + 0.5 - HY) / 8;
  if (dy > 0) dx *= 1 + 0.45 * dy; // the jaw narrows
  const r = Math.hypot(dx, dy);
  const th = Math.atan2(dy, dx);
  let amp = 0;
  if (dy < 0.45) {
    const t = (((th + Math.PI) / (2 * Math.PI)) * 14 + 0.5) % 1;
    const tri = 1 - Math.abs(2 * t - 1);
    amp = (dy < -0.2 ? 0.34 : 0.22) * tri * tri;
  }
  return r < 0.94 + amp;
};
const inBody = (x: number, y: number): boolean => {
  const d = Math.abs(x + 0.5 - C);
  if (y >= 22 && y <= 26 && d < 4.5) return true; // neck
  if (y < 24) return false;
  let hw = 7 + (y - 24) * 3;
  // shaggy tufts along the shoulder line
  if (y <= 27 && (x * 7 + y * 3) % 5 === 0) hw += 1;
  return d < hw;
};
const fig = (x: number, y: number) => inside(x, y) && (inHead(x, y) || inBody(x, y));
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

// eyes: gold slits, slanting in and down (glare)
const EYE: Record<string, string> = {
  "14,17": "e", "15,17": "E", "16,17": "E", "15,18": "e", "16,18": "E", "17,18": "e",
  "23,17": "E", "24,17": "E", "25,17": "e", "22,18": "e", "23,18": "E", "24,18": "e",
};
// the torn seam across his left cheek (our right), bound in violet darkness with pale stitches
const SEAM: Record<string, string> = {
  "22,22": "U", "23,22": "U", "24,21": "U", "25,21": "U", "26,20": "U", "27,20": "u",
  "22,23": "v", "24,22": "v", "25,22": "v", "26,21": "v", "27,21": "v",
  "23,21": "x", "23,23": "x", "26,19": "x", "26,22": "x",
};

const figure = paint(5, 4, 30, 32, (x, y) => {
  if (!inside(x, y)) return null;
  if (!fig(x, y)) {
    // his thin violet edge glow
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (fig(x + ax, y + ay)) return "u";
    for (const [ax, ay] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) if (fig(x + ax, y + ay)) return "v";
    return null;
  }
  for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!fig(x + ax, y + ay) && inside(x + ax, y + ay)) return "k";
  const head = inHead(x, y);
  if (head) {
    const key = `${x},${y}`;
    if (EYE[key]) return EYE[key]!;
    if (SEAM[key]) return SEAM[key]!;
    // heavy brows over the eyes
    if (y === 16 && ((x >= 13 && x <= 17) || (x >= 22 && x <= 26))) return x === 17 || x === 22 ? "k" : "s";
    if (y === 17 && (x === 17 || x === 22)) return "s";
    // nose and mouth, two small fangs
    if (y === 21 && (x === 19 || x === 20)) return "k";
    if (y === 22 && x >= 19 && x <= 20) return "s";
    if (y === 24 && x >= 17 && x <= 23) return "k";
    if (y === 25 && (x === 18 || x === 22)) return "t";
    const dx = (x + 0.5 - HX) / 8.4;
    const dy = (y + 0.5 - HY) / 8;
    const lit = -dx * 0.6 - dy * 0.8;
    if (hash(x, y) % 7 === 0 && (y < 15 || Math.abs(dx) > 0.7)) return "s";
    return lit > 0.4 ? "h" : lit > -0.05 ? "C" : lit > -0.5 ? "c" : "a";
  }
  // shoulders: a dark shadow under the chin, then shaggy fur
  if (inHead(x, y - 1)) return "s";
  const dx = (x + 0.5 - C) / 14;
  const dy = (y + 0.5 - 30) / 6;
  const lit = -dx * 0.8 - dy * 0.6;
  if (hash(x, y) % 7 === 0) return "s";
  return lit > 0.45 ? "C" : lit > -0.2 ? "c" : "a";
});

// A short loop of his Christmas lights across the shoulders.
const wireY = (x: number) => Math.round(29 - 0.04 * (x + 0.5 - C) ** 2);
const BULBS: [number, string, string][] = [
  [10, "r", "R"],
  [15, "g", "G"],
  [20, "b", "B"],
  [25, "r", "R"],
  [30, "g", "G"],
];
const lights = paint(6, 22, 28, 14, (x, y) => {
  if (!inside(x, y)) return null;
  for (const [bx, m, s] of BULBS) {
    const wy = wireY(bx);
    if (x === bx && y === wy + 1) return "w"; // socket
    if (x >= bx - 1 && x <= bx && y >= wy + 2 && y <= wy + 3) {
      if (y === wy + 2) return x === bx - 1 ? "W" : m;
      return x === bx - 1 ? m : s;
    }
    if (y === wy + 4 && x === bx) return null;
  }
  if (x >= 7 && x <= 32 && y === wireY(x)) return "w";
  return null;
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [W("disc", disc.at), W("figure", figure.at), W("lights", lights.at)];

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

// The blink: the gold goes out, a dark lid line where it was.
const BLINK: Speck[] = Object.keys(EYE).map((k) => {
  const [x, y] = k.split(",").map(Number) as [number, number];
  return [x, y, y === 18 ? "s" : "c"] as Speck;
});
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_HOLLOW: Character = {
  id: "token-hollow",
  name: "Hollow token",
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
    // charcoal fur, dark to light, and its darkest strands
    s: "#0f0e13",
    a: "#1a1920",
    c: "#27252e",
    C: "#36333e",
    h: "#4b4756",
    // the darkness: violet-black to bright violet, a pale stitch
    v: "#30194f",
    u: "#5b36a3",
    U: "#9c6cff",
    x: "#e9ddff",
    // eyes
    e: "#ffcf3a",
    E: "#fff5c8",
    t: "#d3ccbd",
    // the strand
    w: "#5d5968",
    W: "#fff4f0",
    r: "#ff4d5e",
    R: "#b8233a",
    g: "#ffd23a",
    G: "#c88a14",
    b: "#4fa4ff",
    B: "#2a5cc8",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    figure: figure.part,
    lights: lights.part,
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
