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

/** Harlequin diamonds: true on the purple ones. */
const diamond = (x: number, y: number, size = 4) => ((Math.floor((x + y) / size) + Math.floor((x - y + 64) / size)) & 1) === 1;

// Shoulders: the red and purple harlequin suit.
const body = paint(5, 27, 30, 9, (x, y) => {
  if (!inside(x, y)) return null;
  const d = x + 0.5 - C;
  const hw = 9 + (y - 27) * 1.5;
  if (Math.abs(d) > hw) return null;
  const purple = diamond(x + 2, y, 4);
  const dark = d > 4 || y >= 32;
  return purple ? (dark ? "P" : "p") : dark ? "R" : "r";
});

// The white ruff, pleated, scalloped at the bottom.
const ruff = paint(7, 24, 26, 5, (x, y) => {
  const d = x + 0.5 - C;
  const hw = 7 + (y - 24) * 1.5;
  if (Math.abs(d) > hw) return null;
  if (y === 28 && (x & 1) === 0) return null;
  if (y >= 27 && (x & 1) === 0) return "X";
  if ((x & 1) === 1 && y >= 25) return d > 4 ? "X" : "W";
  return d > 5 ? "W" : "w";
});

// Gold pompoms at the shoulders.
const pom = (cx: number) =>
  paint(cx - 2, 25, 4, 4, (x, y) => {
    const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - 27);
    if (dd > 1.9) return null;
    return x + 0.5 - cx + (y + 0.5 - 27) < -0.5 ? "y" : x + 0.5 - cx + (y + 0.5 - 27) > 0.6 ? "G" : "g";
  });
const pomL = pom(9);
const pomR = pom(31);

// Red hair tufts, spiky, out to each side.
const tuft = (side: -1 | 1) => {
  const x0 = side < 0 ? 5 : 26;
  return paint(x0, 11, 9, 13, (x, y) => {
    if (!inside(x, y)) return null;
    const out = side < 0 ? 13.5 - (x + 0.5) : x + 0.5 - 26.5; // how far out from the head
    const j = y - 11; // 0..12
    if (j < 1 || j > 11) return null;
    const spike = j % 3 === 1 ? 7.5 : j % 3 === 2 ? 5.5 : 4;
    const taper = j < 3 ? 2 : j > 9 ? 2 : 0;
    const len = spike - taper;
    if (out < 0 || out > len) return null;
    const top = j <= 4;
    if (side < 0) return top ? "r" : out > len - 1.5 ? "R" : "r";
    return top ? "R" : out > len - 1.5 ? "q" : "R";
  });
};
const hairL = tuft(-1);
const hairR = tuft(1);

// The head: white face paint, red eyes, the red nose, the wide grin.
const head = paint(11, 10, 18, 17, (x, y) => {
  const dx = (x + 0.5 - 20) / 8;
  const dy = (y + 0.5 - 18.5) / 7.6;
  if (dx * dx + dy * dy > 1) return null;
  // brows, slanted down to the middle: wicked
  if ((y === 15 && (x === 14 || x === 15 || x === 24 || x === 25)) || (y === 16 && (x === 16 || x === 17 || x === 22 || x === 23))) return "k";
  // eyes: red, a glint at the top left, dark rims
  if (y === 17 && ((x >= 15 && x <= 17) || (x >= 22 && x <= 24))) return x === 15 || x === 22 ? "E" : "e";
  if (y === 18 && ((x >= 15 && x <= 17) || (x >= 22 && x <= 24))) return x === 17 || x === 24 ? "R" : "e";
  if (y === 17 && (x === 14 || x === 25)) return "k";
  if (y === 19 && ((x >= 15 && x <= 17) || (x >= 22 && x <= 24))) return "X";
  // the round red nose
  if (y === 19 && (x === 19 || x === 20)) return x === 19 ? "E" : "r";
  if (y === 20 && x >= 18 && x <= 21) return x === 21 ? "R" : "r";
  if (y === 21 && (x === 19 || x === 20)) return "R";
  // the grin: corners curling up, a row of teeth
  if (y === 20 && (x === 13 || x === 26)) return "R";
  if (y === 21 && x >= 13 && x <= 26) {
    if (x === 13 || x === 26) return "k";
    if (x === 14 || x === 25) return "r";
  }
  if (y === 22 && x >= 14 && x <= 25) return x === 14 || x === 25 ? "r" : x === 15 || x === 24 ? "d" : x === 18 || x === 21 ? "D" : "M";
  if (y === 23 && x >= 15 && x <= 24) return x === 15 || x === 24 ? "r" : "d";
  if (y === 24 && x >= 16 && x <= 23) return x >= 21 ? "R" : "r";
  // face paint, shaded from the top left
  const lit = -dx * 0.8 - dy * 0.6;
  return lit < -0.55 ? "X" : lit < -0.05 ? "W" : "w";
});

// The little cone hat: red and purple stripes, a gold pompom on top.
const hat = paint(13, 5, 14, 9, (x, y) => {
  if (!inside(x, y)) return null;
  if (y <= 7) {
    const dd = Math.hypot(x + 0.5 - 20, y + 0.5 - 7);
    if (dd > 1.6) return null;
    return x < 20 && y < 7 ? "y" : x >= 20 && y >= 7 ? "G" : "g";
  }
  const j = y - 8; // 0..5
  if (j > 4) return null;
  const hw = 1 + j * 0.9;
  const d = x + 0.5 - 20;
  if (Math.abs(d) > hw) return null;
  const purple = Math.floor((x - y + 40) / 2) % 2 === 0;
  const dark = d > hw - 1.2 && d > 0;
  if (j === 4) return dark ? "q" : "R";
  return purple ? (dark ? "P" : "p") : dark ? "R" : "r";
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [
  W("disc", disc.at),
  W("body", body.at),
  W("hairL", hairL.at),
  W("hairR", hairR.at),
  W("ruff", ruff.at),
  W("pomL", pomL.at),
  W("pomR", pomR.at),
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

// The blink: lids of face paint, a dark lash line.
const BLINK: Speck[] = [15, 16, 17, 22, 23, 24].flatMap((x) => [[x, 17, "W"], [x, 18, "k"]] as Speck[]);
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_CLOWN: Character = {
  id: "token-clown",
  name: "Boingo token",
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
    // face paint and ruff
    w: "#f6f1ea",
    W: "#d8cbc6",
    X: "#a39294",
    // suit and hair
    r: "#e2343b",
    R: "#a3202b",
    q: "#5c1521",
    p: "#7d3b93",
    P: "#4b2161",
    // pompoms
    g: "#f2c14e",
    G: "#b58430",
    // eyes, mouth
    e: "#ff4434",
    E: "#ffe3d6",
    d: "#2b0d13",
    D: "#d8cbc6",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    body: body.part,
    hairL: hairL.part,
    hairR: hairR.part,
    ruff: ruff.part,
    pomL: pomL.part,
    pomR: pomR.part,
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
