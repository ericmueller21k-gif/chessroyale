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

// Shoulders: gray-brown fur with a cream chest.
const body = paint(6, 27, 28, 8, (x, y) => {
  if (!inside(x, y)) return null;
  const d = x + 0.5 - C;
  const hw = 6 + (y - 28) * 1.8;
  if (y < 28 || Math.abs(d) > hw) return null;
  if (Math.abs(d) < 3.2 + (y - 28) * 0.3) return d > 1.5 ? "e" : "f"; // cream chest
  return d < -hw + 2.5 ? "d" : d > hw - 2.5 ? "b" : "c";
});

// Round ears with pale rims, peeking out beside the hard hat.
const ear = (cx: number) =>
  paint(cx - 3, 9, 6, 7, (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 12.5);
    if (d > 2.8) return null;
    if (d < 1.5) return "a";
    return x + 0.5 < cx ? "f" : "e";
  });
const earL = ear(11);
const earR = ear(29);

// The head: gray-brown fur, pale brows, the bold black bandit mask, cream cheeks and muzzle, the toothy grin.
const headHalf = (y: number): number => {
  const T: Record<number, number> = {
    13: 7.5, 14: 8.5, 15: 9.2, 16: 9.6, 17: 10, 18: 10.4, 19: 10.6, 20: 10.6, 21: 10.4,
    22: 10.4, 23: 10.8, 24: 10, 25: 9, 26: 7.6, 27: 6.2, 28: 4.6,
  };
  return T[y] ?? -1;
};
const head = paint(9, 13, 22, 16, (x, y) => {
  const hw = headHalf(y);
  const d = x + 0.5 - C;
  if (hw < 0 || Math.abs(d) > hw) return null;
  const ad = Math.abs(d);
  // eyes: white, a sly pupil glancing to our right, a cocky slanted lid
  const lx = x >= 14 && x <= 16 ? x - 14 : x >= 23 && x <= 25 ? x - 23 : -1;
  if (lx >= 0 && (y === 19 || y === 20)) {
    if (y === 19 && ((x === 14) || (x === 25))) return "m"; // the lid slants down at the outer corners
    return lx === 2 ? "x" : "w";
  }
  // the bandit mask: a wide band across the eyes, dipping at the outer ends
  const maskTop = ad < 1.6 ? 19 : 18;
  const maskBot = ad < 1.6 ? 20 : ad > 7.5 ? 22 : 21;
  if (y >= maskTop && y <= maskBot) return "m";
  // nose
  if (y === 22 && x >= 18 && x <= 21) return "x";
  if (y === 23 && x >= 19 && x <= 20) return "x";
  // the grin: wide, corners up, a row of teeth
  if (y === 23 && (x === 14 || x === 25)) return "x";
  if (y === 24 && x >= 15 && x <= 24) return "x";
  if (y === 25 && (x === 15 || x === 24)) return "x";
  if (y === 25 && x >= 16 && x <= 23) return x === 18 || x === 21 ? "e" : "w";
  if (y === 26 && (x === 16 || x === 23)) return "x";
  if (y === 26 && x >= 17 && x <= 22) return "u";
  if (y === 27 && x >= 17 && x <= 22) return "x";
  // pale brows above the mask
  if (y === 17 && ad > 1.6 && ad < 8.5) return d < 0 ? "g" : "f";
  if (y === 16 && ad > 2.6 && ad < 7.5) return d < 0 ? "g" : "f";
  // forehead stripe
  if (ad < 1.1 && y >= 14 && y <= 18) return "b";
  // cream cheeks and muzzle below the mask
  if (y >= 22) {
    if (ad > hw - 2.2 && y <= 24) return d < 0 ? "c" : "b"; // gray cheek tufts
    return d > 4 ? "e" : d < -3 ? "g" : "f";
  }
  const t = d / hw;
  return t < -0.45 ? "d" : t > 0.5 ? "b" : "c";
});

// The yellow hard hat: a dome with a raised ridge, and a wide brim.
const hat = paint(8, 5, 24, 11, (x, y) => {
  const d = x + 0.5 - C;
  if (y >= 14) {
    const hw = y === 14 ? 11 : 10;
    if (Math.abs(d) > hw) return null;
    return y === 14 ? (d < -4 ? "L" : d > 5 ? "H" : "h") : d > 4 ? "q" : "P";
  }
  const dx = d / 8;
  const dy = (y + 0.5 - 14) / 7.6;
  if (dx * dx + dy * dy > 1) return null;
  if (Math.abs(d) < 1.1 && y < 14) return d < 0 ? "L" : "h"; // the ridge
  const lit = -dx * 0.7 - dy;
  if (lit > 1.05 && d < 0) return "L";
  return lit > 0.7 ? "h" : lit < 0.1 ? "P" : "H";
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

// The blink: the eyes shut inside the mask, a gray lash line.
const BLINK: Speck[] = [14, 15, 16, 23, 24, 25].flatMap((x) => [[x, 19, "m"], [x, 20, "b"]] as Speck[]);
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_SAWYER: Character = {
  id: "token-sawyer",
  name: "Sawyer token",
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
    // fur (SAWYER_PALETTE)
    a: "#44322e",
    b: "#5f4843",
    c: "#7e635e",
    d: "#a08883",
    e: "#c0aea5",
    f: "#e3d5cb",
    g: "#f8f1ea",
    m: "#140e0e",
    x: "#050303",
    w: "#ffffff",
    u: "#6b1f24",
    // hard hat
    L: "#fff3ad",
    h: "#ffe05a",
    H: "#f6c21c",
    P: "#d39a0b",
    q: "#946404",
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
