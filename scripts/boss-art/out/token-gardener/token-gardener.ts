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

// Light from the top left: a value in about -1..1 for a point on a round shape.
const lit = (dx: number, dy: number) => (-dx * 0.7 - dy) / 1.2;

// Shoulders: bare mauve skin, a pink throat and chest in the middle.
const body = paint(6, 26, 28, 9, (x, y) => {
  if (!inside(x, y)) return null;
  const d = x + 0.5 - C;
  const hw = 9 + (y - 26) * 2.2;
  if (Math.abs(d) > hw) return null;
  if (Math.abs(d) < 5 - (y - 29) * 0.5) return d < -1.5 ? "h" : "g";
  const t = d / hw;
  return t < -0.6 ? "d" : t > 0.55 ? "b" : "c";
});

// Small round ears, high on the head, pink inside.
const ear = (cx: number) =>
  paint(cx - 3, 6, 6, 6, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - 9;
    const d = Math.hypot(dx, dy);
    if (d > 2.4) return null;
    if (d < 1.2) return "g";
    return lit(dx, dy) > 0.2 ? "d" : "c";
  });
const earL = ear(13);
const earR = ear(27);

// The head's dome: eyes high up, pink cheeks at the sides.
const head = paint(11, 7, 18, 16, (x, y) => {
  const dx = x + 0.5 - 20;
  const dy = y + 0.5 - 15;
  const ex = dx / 8.4;
  const ey = dy / 7.6;
  if (ex * ex + ey * ey > 1) return null;
  // eyes: small and dark, a glint top left
  for (const cx of [15, 23]) {
    if (x >= cx && x <= cx + 1 && y >= 12 && y <= 13) return x === cx && y === 12 ? "w" : "x";
  }
  // cheeks
  for (const cx of [13.2, 26.8]) {
    const cd = Math.hypot((x + 0.5 - cx) / 2.4, (y + 0.5 - 18) / 1.7);
    if (cd < 1) return cd < 0.5 && cx < 20 ? "i" : "h";
  }
  const l = lit(ex, ey);
  return l > 0.45 ? "e" : l > -0.2 ? "d" : l > -0.6 ? "c" : "b";
});

// The big square muzzle: greyer mauve, two nostrils on top, a soft smile.
const muzzle = paint(9, 18, 22, 11, (x, y) => {
  const dx = (x + 0.5 - 20) / 10.4;
  const dy = (y + 0.5 - 23.6) / 5.2;
  if (dx ** 4 + dy ** 4 > 1) return null;
  // nostrils
  if (y === 20 && (x === 16 || x === 17 || x === 23 || x === 24)) return "z";
  if (y === 21 && (x === 16 || x === 24)) return "z";
  if (y === 19 && (x === 16 || x === 24)) return "p";
  // the smile: turned up at both ends
  if (y === 25 && (x === 13 || x === 27)) return "z";
  if (y === 26 && x >= 14 && x <= 26) return "z";
  if (y === 27 && x >= 17 && x <= 23) return "g"; // a hint of lower lip
  const l = lit(dx, dy * 1.3);
  return l > 0.5 ? "q" : l > -0.15 ? "o" : l > -0.7 ? "p" : "m";
});

// The hose hanging down from his fist, out of the coin.
const hose = paint(7, 26, 7, 8, (x, y) => {
  if (!inside(x, y)) return null;
  const cx = 10 + (y - 26) * 0.35;
  const d = x + 0.5 - cx;
  if (Math.abs(d) > 1.1) return null;
  return d < 0 ? "G" : "F";
});

// His fist round the nozzle, up by his cheek.
const fist = paint(6, 21, 7, 7, (x, y) => {
  const dx = x + 0.5 - 9.5;
  const dy = y + 0.5 - 24.2;
  if (Math.hypot(dx, dy * 1.1) > 3.1) return null;
  if ((y === 23 || y === 25) && x >= 10 && x <= 11) return "b"; // finger creases
  const l = lit(dx / 3, dy / 3);
  return l > 0.4 ? "e" : l > -0.3 ? "d" : "c";
});

// The spray nozzle: green grip, brass collar and tip, pointing up.
const nozzle = paint(8, 13, 4, 9, (x, y) => {
  if (y <= 15) {
    if (x < 9 || x > 10) return null;
    return y === 13 ? (x === 9 ? "M" : "L") : x === 9 ? "L" : "K";
  }
  if (y === 16) return x === 8 ? "L" : x === 11 ? "J" : "K";
  return x === 8 ? "H" : x === 9 ? "G" : x === 10 ? "F" : "E";
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [
  W("disc", disc.at),
  W("body", body.at),
  W("earL", earL.at),
  W("earR", earR.at),
  W("head", head.at),
  W("muzzle", muzzle.at),
  W("hose", hose.at),
  W("nozzle", nozzle.at),
  W("fist", fist.at),
];

// A few water drops puffing up from the nozzle.
const DROPS: Speck[] = [
  [9, 10, "4"], [9, 11, "3"],
  [11, 8, "4"], [11, 9, "3"],
  [7, 13, "3"],
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

// The blink: the eyes close to a dark line under a lid of skin.
const BLINK: Speck[] = [15, 16, 23, 24].flatMap((x) => [[x, 12, "d"], [x, 13, "x"]] as Speck[]);
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks: [...DROPS, ...specks] });

export const TOKEN_GARDENER: Character = {
  id: "token-gardener",
  name: "Puddles token",
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
    // skin: grey-mauve, dark to light
    b: "#8d5762",
    c: "#aa7079",
    d: "#c88f8e",
    e: "#e0aba3",
    // pink: cheeks, ears, throat
    g: "#d6747b",
    h: "#f0a191",
    i: "#f8c4b0",
    // muzzle: greyer mauve, dark to light
    m: "#7d5f6a",
    p: "#9b7b83",
    o: "#b69498",
    q: "#cdadad",
    x: "#1b0e15",
    w: "#ffffff",
    z: "#4a1f2e",
    // hose
    E: "#17483f",
    F: "#22705a",
    G: "#33a479",
    H: "#7fe0ae",
    // brass
    J: "#7a4f0e",
    K: "#b87a14",
    L: "#f2c14e",
    // water
    "2": "#4fa3ee",
    "3": "#8bcdfb",
    "4": "#d4f0ff",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    body: body.part,
    earL: earL.part,
    earR: earR.part,
    head: head.part,
    muzzle: muzzle.part,
    hose: hose.part,
    nozzle: nozzle.part,
    fist: fist.part,
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
