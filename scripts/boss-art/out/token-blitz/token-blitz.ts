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

// Shoulders: the teal track jacket with its orange panels and collar.
const body = paint(6, 27, 28, 8, (x, y) => {
  if (!inside(x, y)) return null;
  const d = x + 0.5 - C;
  const hw = 6 + (y - 28) * 1.6;
  if (y < 28 || Math.abs(d) > hw) return null;
  if (y <= 29 && Math.abs(d) < 3.5) return y === 28 ? "a" : "A"; // collar
  if (Math.abs(d) < 0.6) return "W"; // zip
  if (Math.abs(d) > hw - 2.5) return d < 0 ? "c" : "C"; // orange side panels
  return d < -3 ? "a" : d > 3 ? "Z" : "A";
});

// Ears, peeking out under the cap.
const ear = (cx: number) =>
  paint(cx - 3, 9, 6, 7, (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 12.5);
    if (d > 2.8) return null;
    if (d < 1.5 && y >= 12) return "T";
    return x + 0.5 < cx ? "t" : "f";
  });
const earL = ear(11);
const earR = ear(29);

// The backwards cap's teal brim, sticking out behind to the right.
const brim = paint(22, 8, 13, 6, (x, y) => {
  if (rad(x, y) > 14) return null;
  const j = y - 8;
  if (j > 3) return null;
  const x0 = 23 + j;
  const x1 = 33 - (j === 0 ? 2 : 0);
  if (x < x0 || x > x1) return null;
  return j === 0 ? "a" : j === 3 ? "Z" : "A";
});

// The head: tan fur, black spots, cream muzzle, tear marks, amber eyes, the grin.
const headHalf = (y: number): number => {
  if (y < 12 || y > 29) return -1;
  const d = (y + 0.5 - 20.5) / 9;
  let hw = 9 * Math.sqrt(Math.max(0, 1 - d * d * d * d));
  if (y >= 22 && y <= 26) hw += 1; // cheek ruff
  if (y >= 28) hw = Math.min(hw, y === 28 ? 5 : 3.2);
  return hw;
};
const SPOTS = new Set([
  "12,17", "11,20", "13,22", "11,24", "14,25", "12,26", "15,27",
  "27,17", "28,20", "26,22", "28,24", "25,25", "27,26", "24,27",
  "14,16", "17,16", "22,16", "25,16", "19,17", "11,18", "28,18",
]);
const head = paint(9, 12, 22, 18, (x, y) => {
  const hw = headHalf(y);
  const d = x + 0.5 - C;
  if (hw < 0 || Math.abs(d) > hw) return null;
  // eyes: amber, a dark pupil, a heavy cocky lid
  const lx = x >= 14 && x <= 16 ? x - 14 : x >= 23 && x <= 25 ? x - 23 : -1;
  if (lx >= 0 && y === 18) return "k";
  if (lx >= 0 && (y === 19 || y === 20)) return lx === 1 ? "k" : y === 19 ? (lx === 0 && x < 20 ? "M" : "e") : "E";
  if (y === 18 && (x === 13 || x === 26)) return "k";
  // tear marks: from the inner eye corner down to the mouth
  if ((x === 17 && y >= 19 && y <= 22) || (x === 16 && y >= 21 && y <= 25)) return "k";
  if ((x === 22 && y >= 19 && y <= 22) || (x === 23 && y >= 21 && y <= 24)) return "k";
  // nose
  if (y === 22 && x >= 19 && x <= 20) return "s";
  if (y === 23 && (x === 19 || x === 20)) return x === 19 ? "s" : "k";
  // the cocky grin: lopsided, up on his right (our right), a fang showing
  if (y === 24 && x === 20) return "k";
  if (y === 25 && x >= 18 && x <= 21) return "k";
  if (y === 24 && x >= 22 && x <= 23) return "k";
  if (y === 26 && x === 21) return "W";
  // muzzle
  const md = Math.hypot((x + 0.5 - 20) / 4.2, (y + 0.5 - 24.5) / 3.6);
  if (md < 1 || y >= 27) return y >= 27 && Math.abs(d) < 2.5 ? "w" : md < 1 ? (d > 2 || y >= 27 ? "w" : "W") : "f";
  if (SPOTS.has(`${x},${y}`)) return "s";
  const t = d / hw;
  if (y <= 16 && t < 0.2) return "t";
  return t < -0.45 ? "t" : t > 0.5 ? "T" : "f";
});

// The orange cap, worn backwards: the snapback strap across the forehead.
const cap = paint(10, 7, 20, 10, (x, y) => {
  const dx = (x + 0.5 - 20) / 8.6;
  const dy = (y + 0.5 - 16) / 7.2;
  if (y > 15 || dx * dx + dy * dy > 1) return null;
  if (y === 15) return x < 15 ? "c" : x > 25 ? "Q" : "C";
  // the snap opening: a dark arch with the strap
  if (x >= 18 && x <= 21 && y >= 13) return y === 14 ? "a" : "k";
  if (x >= 19 && x <= 20 && y === 12) return "k";
  const lit = -dx * 0.7 - dy;
  if (x === 20 && y < 12) return "C"; // seam
  return lit > 0.85 ? "p" : lit < 0.15 ? "Q" : "c";
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [
  W("disc", disc.at),
  W("body", body.at),
  W("earL", earL.at),
  W("earR", earR.at),
  W("brim", brim.at),
  W("head", head.at),
  W("cap", cap.at),
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

const BLINK: Speck[] = [14, 15, 16, 23, 24, 25].flatMap((x) => [[x, 19, "k"], [x, 20, "f"], [x, 18, "f"]] as Speck[]);
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_BLITZ: Character = {
  id: "token-blitz",
  name: "Blitz token",
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
    // fur
    t: "#ffd98a",
    f: "#f2b85a",
    T: "#c98a3a",
    w: "#e8d2a8",
    W: "#fff4dc",
    s: "#4a2c1a",
    e: "#ffb02e",
    E: "#e07a1a",
    // cap
    p: "#ffa75a",
    c: "#ef7b2c",
    C: "#c85a1c",
    Q: "#9a4314",
    // teal
    a: "#5fd6c6",
    A: "#25a89c",
    Z: "#17706a",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    body: body.part,
    brim: brim.part,
    earL: earL.part,
    earR: earR.part,
    head: head.part,
    cap: cap.part,
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
