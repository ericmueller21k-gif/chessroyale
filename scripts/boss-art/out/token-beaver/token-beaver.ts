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

// A wooden plank, poking up over a shoulder, top end leaning outward.
const plank = (side: -1 | 1) =>
  paint(side < 0 ? 5 : 21, 10, 14, 22, (x, y) => {
    if (!inside(x, y)) return null;
    // axis from the top end (tx, ty) down toward the middle of the back
    const tx = side < 0 ? 8.4 : 31.6;
    const ty = 16.2;
    const ux = -side * 0.26;
    const uy = 0.966;
    const px = x + 0.5 - tx;
    const py = y + 0.5 - ty;
    const t = px * ux + py * uy;
    const s = px * -uy + py * ux; // across the plank
    if (t < 0 || t > 20 || Math.abs(s) > 2.1) return null;
    if (t < 1.1) return "j"; // the sawn end grain
    const ss = s * -side; // outward side is lit on the left plank
    if (Math.round(t) % 5 === 3 && Math.abs(s) < 0.6) return "G"; // grain
    return ss > 0.7 ? (side < 0 ? "j" : "J") : ss < -0.7 ? "G" : "J";
  });
const plankL = plank(-1);
const plankR = plank(1);

// Shoulders: brown fur chest, the orange safety vest, the yellow harness straps.
const body = paint(6, 26, 28, 9, (x, y) => {
  if (!inside(x, y)) return null;
  const d = x + 0.5 - C;
  const hw = 7 + (y - 28) * 1.7;
  if (y < 27 || Math.abs(d) > hw) return null;
  const ad = Math.abs(d);
  if (ad < 2 + (y - 27) * 0.5) return y <= 28 ? "b" : d < 0 ? "b" : "B"; // fur chest
  if (ad > 3.2 + (y - 27) * 0.5 && ad < 4.9 + (y - 27) * 0.5) return d < 0 ? "h" : "H"; // harness straps
  if (y === 31 && ad > 5) return "g"; // reflective stripe
  return d < -4 ? "v" : d > 5 ? "V" : "v";
});

// Small round ears at the sides of the head, under the hat brim.
const ear = (cx: number) =>
  paint(cx - 3, 12, 6, 6, (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 15);
    if (d > 2.3) return null;
    if (d < 1.1) return "s";
    return x + 0.5 < cx ? "u" : "U";
  });
const earL = ear(11);
const earR = ear(29);

// The head: round brown beaver, tan muzzle, dark nose, the big buck teeth.
const headHalf = (y: number): number => {
  if (y < 12 || y > 29) return -1;
  const d = (y + 0.5 - 20.5) / 9;
  let hw = 8.8 * Math.sqrt(Math.max(0, 1 - d * d * d * d));
  if (y >= 21 && y <= 25) hw += 0.8; // full cheeks
  if (y >= 28) hw = Math.min(hw, y === 28 ? 6 : 4);
  return hw;
};
const head = paint(9, 12, 22, 18, (x, y) => {
  const hw = headHalf(y);
  const d = x + 0.5 - C;
  if (hw < 0 || Math.abs(d) > hw) return null;
  // eyes: black, a bright catch-light top left
  const ex = x >= 14 && x <= 15 ? x - 14 : x >= 24 && x <= 25 ? x - 24 : -1;
  if (ex >= 0 && (y === 17 || y === 18)) return ex === 0 && y === 17 ? "M" : "k";
  // nose: a wide dark button
  if (y === 20 && x >= 18 && x <= 21) return x === 18 ? "i" : "k";
  if (y === 21 && x >= 19 && x <= 20) return "k";
  // mouth: a little line under the nose, curling to the cheeks
  if (y === 22 && x >= 19 && x <= 20) return "k";
  if (y === 23 && x >= 17 && x <= 22) return "k";
  if (y === 22 && (x === 16 || x === 23)) return "k";
  // buck teeth
  if (y >= 24 && y <= 26 && x >= 17 && x <= 22) {
    if (x === 19 || x === 20) return x === 19 ? "w" : "k";
    return x === 17 || x === 21 ? "W" : "w";
  }
  if (y === 27 && x >= 17 && x <= 22 && x !== 20) return "k";
  if (y === 27 && x === 20) return "k";
  // whiskers: pale lines across the cheeks
  if ((y === 22 || y === 24) && ((x >= 12 && x <= 14) || (x >= 25 && x <= 27))) return "M";
  // muzzle
  const md = Math.hypot((x + 0.5 - 20) / 5.4, (y + 0.5 - 23.5) / 4);
  if (md < 1) return d < -2.5 && y < 23 ? "m" : d > 3 || y >= 26 ? "q" : "m";
  const t = d / hw;
  if (y <= 15 && t < 0.3) return "u";
  return t < -0.5 ? "u" : t > 0.5 ? "R" : "r";
});

// Whiskers: pale lines out past the cheeks.
const whisk = paint(6, 21, 28, 5, (x, y) => {
  const ok = (y === 23 || y === 25) && ((x >= 9 && x <= 10) || (x >= 29 && x <= 30));
  if (!ok) return null;
  return "M";
});

// The orange hard hat: a dome with a raised ridge, a wide brim.
const hat = paint(8, 5, 24, 11, (x, y) => {
  if (y === 14 || y === 15) {
    const hw = y === 14 ? 11 : 10;
    if (Math.abs(x + 0.5 - 20) > hw) return null;
    if (y === 15) return "Q";
    return x < 14 ? "p" : x > 26 ? "C" : "c";
  }
  const dx = (x + 0.5 - 20) / 8.4;
  const dy = (y + 0.5 - 14) / 7.4;
  if (y > 13 || dx * dx + dy * dy > 1) return null;
  if (x >= 19 && x <= 20 && y >= 7) return x === 19 ? "p" : "c"; // ridge
  const lit = -dx * 0.7 - dy;
  return lit > 0.9 ? "p" : lit < 0.25 ? "C" : "c";
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [
  W("disc", disc.at),
  W("plankL", plankL.at),
  W("plankR", plankR.at),
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

const BLINK: Speck[] = [14, 15, 24, 25].flatMap((x) => [[x, 18, "k"], [x, 17, x < 20 ? "u" : "r"]] as Speck[]);
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_BEAVER: Character = {
  id: "token-beaver",
  name: "Timber token",
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
    u: "#9a6a40",
    r: "#7a4e2c",
    R: "#5a361e",
    U: "#5a361e",
    s: "#3a2216",
    m: "#d8b48a",
    q: "#b48c64",
    b: "#c9a27a",
    B: "#a8805a",
    i: "#5a4a48",
    w: "#e8d2a8",
    W: "#fff4dc",
    // hard hat
    p: "#ffa75a",
    c: "#ef7b2c",
    C: "#c85a1c",
    Q: "#9a4314",
    // vest and harness
    v: "#f0601c",
    V: "#b8420e",
    g: "#d8dce4",
    h: "#ffd23a",
    H: "#d9a400",
    // planks
    j: "#ffe2a4",
    J: "#eab866",
    G: "#b07a36",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    plankL: plankL.part,
    plankR: plankR.part,
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
