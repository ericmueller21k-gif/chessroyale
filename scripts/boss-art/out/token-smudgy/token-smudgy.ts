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
// A shape filled by `fill`, outlined in k wherever it meets the outside, clipped to the navy middle.
type Is = (x: number, y: number) => boolean;
const outlined = (is: Is, fill: (x: number, y: number) => string): Fn => (x, y) => {
  if (!inside(x, y) || !is(x, y)) return null;
  if (!is(x - 1, y) || !is(x + 1, y) || !is(x, y - 1) || !is(x, y + 1)) return "k";
  return fill(x, y);
};

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

// Shoulders: green, striped orange and teal at the arms, the cream apron bib on brown straps, a paint splat.
const bodyIs: Is = (x, y) => {
  const d = x + 0.5 - C;
  return y >= 26 && Math.abs(d) <= 7 + (y - 26) * 1.6;
};
const body = paint(6, 25, 28, 10, outlined(bodyIs, (x, y) => {
  const d = x + 0.5 - C;
  const hw = 7 + (y - 26) * 1.6;
  if (Math.abs(Math.abs(d) - (3.5 + (30 - y) * 0.9)) < 0.6 && y <= 29) return d < 0 ? "Q" : "L"; // straps
  if (Math.abs(d) < 3.5 + (y >= 31 ? 1 : 0) && y >= 29) {
    if ((x === 17 || x === 18) && (y === 30 || y === 31)) return "R";
    if (x === 18 && y === 29) return "R";
    if (x === 16 && y === 31) return "R";
    if ((x === 22 || x === 23) && y === 32) return "P";
    return d < -1.5 ? "J" : d > 2 ? "H" : "I";
  }
  const o = Math.abs(d) - (hw - 3);
  if (o > 0 && o < 1.6) return d < 0 ? "r" : "q"; // orange stripe on the arm
  if (o >= 1.6) return d < 0 ? "v" : "u"; // teal beyond
  return d < 0 ? "c" : "b";
}));

// The casque: the striped crest behind his head, orange, teal and green.
const casqueIs: Is = (x, y) => Math.hypot((x + 0.5 - 20) / 8.6, (y + 0.5 - 15) / 7.4) < 1;
const STRIPE = [["r", "q", "p"], ["v", "u", "t"], ["d", "c", "b"]];
const casque = paint(11, 6, 18, 14, outlined(casqueIs, (x, y) => {
  const band = (((Math.floor((y - 8 - (x - 20) * 0.35) / 2) % 2) + 2) % 2);
  const lit = -(x + 0.5 - 20) / 8.6 - (y + 0.5 - 15) / 7.4;
  return STRIPE[band][lit > 0.5 ? 0 : lit < -0.4 ? 2 : 1];
}));

// The head: wide and lime green, a long smirking mouth, a yellow-green throat.
const headIs: Is = (x, y) => {
  const dx = Math.abs(x + 0.5 - 20) / 10.6;
  const dy = Math.abs(y + 0.5 - 21.5) / 7;
  return dx ** 2.4 + dy ** 2.4 < 1;
};
const mouthY = (x: number) => (x === 12 ? 23 : x >= 13 && x <= 25 ? 24 : x <= 27 && x >= 26 ? 23 : x === 28 ? 22 : -1);
const head = paint(8, 13, 25, 16, outlined(headIs, (x, y) => {
  if (mouthY(x) === y) return "k";
  if ((x === 18 || x === 22) && y === 21) return "a"; // nostrils
  const dx = (x + 0.5 - 20) / 10.6;
  const dy = (y + 0.5 - 21.5) / 7;
  const my = mouthY(x);
  if (my >= 0 && y > my) return dx < -0.1 ? "m" : "l"; // throat
  if (y === 26 || y === 27) return dx < 0 ? "m" : "l";
  const lit = -dx * 0.7 - dy * 0.9;
  return lit > 0.55 ? "e" : lit > 0.05 ? "d" : lit > -0.45 ? "c" : "b";
}));

// The eyes: big amber eyes in their turrets of skin.
const EYES: [number, number][] = [[12, 17], [28, 17]];
const eyeIs = (cx: number, cy: number): Is => (x, y) => Math.hypot(x - cx, y - cy) < 4.2;
const eye = (cx: number, cy: number) =>
  paint(cx - 5, cy - 5, 11, 11, outlined(eyeIs(cx, cy), (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    if (r < 2.6) {
      if (r < 1.1) return "X";
      if (dx === -1 && dy === -1) return "w";
      return dx + dy < -1 ? "G" : dx + dy > 1 ? "E" : "F";
    }
    if (r < 3.3) return "a"; // the turret's inner fold
    const lit = (-dx - dy) / r;
    return lit > 0.4 ? "e" : lit < -0.5 ? "b" : "d";
  }));
const eyeL = eye(...EYES[0]);
const eyeR = eye(...EYES[1]);

// The beret: deep plum, tipped down to the right over the casque.
const beretIs: Is = (x, y) => {
  const px = x + 0.5 - 24;
  const py = y + 0.5 - 10;
  const t = 0.38;
  const u = px * Math.cos(t) + py * Math.sin(t);
  const v = -px * Math.sin(t) + py * Math.cos(t);
  return (u / 6.6) ** 2 + (v / 3.2) ** 2 < 1;
};
const beret = paint(15, 4, 20, 12, outlined(beretIs, (x, y) => {
  const px = (x + 0.5 - 24) / 6.6;
  const py = (y + 0.5 - 10) / 3.2;
  if (!beretIs(x, y + 2)) return "A"; // the band underneath
  const lit = -px * 0.6 - py;
  return lit > 0.6 ? "o" : lit > -0.2 ? "Z" : "T";
}));

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [
  W("disc", disc.at),
  W("body", body.at),
  W("casque", casque.at),
  W("head", head.at),
  W("eyeL", eyeL.at),
  W("eyeR", eyeR.at),
  W("beret", beret.at),
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

// The blink: lids of skin come down over both eyes, a dark lash line across.
const BLINK: Speck[] = EYES.flatMap(([cx, cy]) => {
  const s: Speck[] = [];
  for (let y = cy - 3; y <= cy + 3; y++)
    for (let x = cx - 3; x <= cx + 3; x++) {
      const r = Math.hypot(x - cx, y - cy);
      if (r >= 3.3) continue;
      s.push([x, y, y === cy + 1 ? "k" : r >= 2.6 ? "a" : y < cy + 1 ? (x - cx + y - cy < 0 ? "e" : "d") : "c"]);
    }
  return s;
});
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_SMUDGY: Character = {
  id: "token-smudgy",
  name: "Smudgy token",
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
    // skin: lime green, dark to light
    a: "#2c5e18",
    b: "#4b9023",
    c: "#74c02c",
    d: "#9fdc43",
    e: "#c9f27a",
    // throat
    l: "#9bb838",
    m: "#c5da55",
    // stripes: orange, teal
    p: "#a93a17",
    q: "#dc5a1e",
    r: "#f5832d",
    t: "#0e5c60",
    u: "#1a8985",
    v: "#34b4a8",
    // eyes
    E: "#9b4f0d",
    F: "#dd8512",
    G: "#ffc437",
    X: "#0a0c07",
    w: "#ffffff",
    // apron, straps
    H: "#b9a37f",
    I: "#e3d4b4",
    J: "#faf1da",
    L: "#35200f",
    Q: "#85501f",
    // beret
    A: "#2a0e34",
    T: "#4a1c58",
    Z: "#6b2f7c",
    o: "#9059a3",
    // paint
    R: "#d9342c",
    P: "#f7c60f",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    body: body.part,
    casque: casque.part,
    head: head.part,
    eyeL: eyeL.part,
    eyeR: eyeR.part,
    beret: beret.part,
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
