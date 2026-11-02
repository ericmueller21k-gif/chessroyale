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

// A small hand-drawn grid stamped at a place, clipped to the navy middle.
function stamp(x0: number, y0: number, rows: string[]) {
  return paint(x0, y0, rows[0].length, rows.length, (x, y) => {
    const ch = rows[y - y0][x - x0];
    if (ch === "." || !inside(x, y)) return null;
    return ch;
  });
}

// Giraffe fur shading: lit on the left, shade on the right.
const fur = (t: number) => (t < -0.55 ? "h" : t > 0.6 ? "d" : t > 0.2 ? "c" : "C");

// The neck: long, spotted, leaving the bottom of the coin.
const NECK_SPOTS = new Set(["14,28", "14,31", "24,29", "25,32", "16,32", "22,31"]);
const neck = paint(11, 26, 19, 13, (x, y) => {
  if (!inside(x, y)) return null;
  const hw = 6 + (y - 26) * 0.3;
  const d = x + 0.5 - 20;
  if (Math.abs(d) > hw) return null;
  if (NECK_SPOTS.has(`${x},${y}`) || NECK_SPOTS.has(`${x - 1},${y}`)) return "o";
  return fur(d / hw);
});

// The mane: two flame tongues licking up behind the neck, on our left.
const maneL = stamp(9, 22, [
  "F....",
  "Ff...",
  ".fF..",
  ".fYF.",
  "FfYfF",
  "fYlYf",
  "fYlYf",
  "FfYfF",
  ".fYf.",
  ".FfF.",
]);
const maneR = stamp(27, 25, [
  "...F",
  "..fF",
  ".FYf",
  "FYlf",
  "fYlf",
  "FfYf",
  ".FfF",
]);

// Ears: leaves sticking out sideways, pink-cream inside.
const earL = stamp(7, 14, [
  "..hhC",
  "hhuUC",
  ".cCCc",
]);
const earR = stamp(28, 14, [
  "Cc...",
  "cUuCd",
  "cdd..",
]);

// Ossicones: short furry stalks with dark knobs, flames on top.
const ossL = stamp(15, 10, ["bB", "hC", "hC", "Cc"]);
const ossR = stamp(23, 10, ["bB", "Cc", "Cc", "cd"]);
const FLAME = [
  ".F.",
  "FfF",
  "fYf",
  "flf",
];
const flameL = stamp(15, 7, [".F.", "fYF", "flf"]);
const flameR = stamp(23, 7, [".F.", "FYf", "flf"]);

// The head: a wide brow with the eyes on its sides, a long muzzle down to a cream nose, the cheeky grin.
const headHalf = (y: number): number =>
  [4, 6, 7, 7.5, 7.5, 7.5, 7.5, 7.5, 7, 6.2, 5.5, 5, 5, 5, 5, 5, 4.4, 3.4][y - 12] ?? -1;
const SPOTS = new Set([
  "15,14", "16,14", "19,13", "20,13", "24,14", "25,14", "17,19", "18,19", "18,20", "22,20", "23,20", "23,21",
  "14,20", "13,19", "26,19", "20,22", "16,22", "17,22", "24,23", "15,24",
]);
const head = paint(11, 12, 18, 18, (x, y) => {
  const hw = headHalf(y);
  const d = x + 0.5 - 20;
  if (hw < 0 || Math.abs(d) > hw) return null;
  // eyes: a heavy cocky lid, a dark pupil with a fiery glint
  if (y === 16 && ((x >= 13 && x <= 16) || (x >= 23 && x <= 26))) return "k";
  if ((y === 17 || y === 18) && ((x >= 14 && x <= 16) || (x >= 23 && x <= 25))) {
    const inner = x === 16 || x === 23;
    const mid = x === 15 || x === 24;
    if (y === 17) return mid ? "s" : inner ? "e" : "E";
    return mid ? "s" : inner ? "s" : "e";
  }
  // nostrils
  if (y === 25 && (x === 17 || x === 22)) return "B";
  if (y === 24 && (x === 17 || x === 22)) return "U";
  // the grin: lopsided, up on our right, a tooth showing
  if (y === 27 && x >= 17 && x <= 21) return "m";
  if (y === 26 && x === 22) return "m";
  if (y === 25 && x === 23) return "m";
  if (y === 26 && x === 16) return "m";
  if (y === 28 && x >= 18 && x <= 20) return x === 20 ? "t" : "m";
  // the cream muzzle end
  const md = Math.hypot((x + 0.5 - 20) / 5.2, (y + 0.5 - 27) / 4);
  if (md < 1) return d < -2 && y < 27 ? "u" : d > 2.5 ? "U" : "u";
  if (SPOTS.has(`${x},${y}`)) return "o";
  return fur(d / hw);
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [
  W("disc", disc.at),
  W("maneL", maneL.at),
  W("maneR", maneR.at),
  W("neck", neck.at),
  W("ossL", ossL.at),
  W("ossR", ossR.at),
  W("flameL", flameL.at),
  W("flameR", flameR.at),
  W("earL", earL.at),
  W("earR", earR.at),
  W("head", head.at),
];
void FLAME;

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

// The blink: lids down over the eyes.
const BLINK: Speck[] = [14, 15, 16, 23, 24, 25].flatMap((x) => [[x, 17, "k"], [x, 18, "C"]] as Speck[]);
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_GREX: Character = {
  id: "token-grex",
  name: "Jefferson token",
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
    // giraffe yellow, dark to light
    d: "#b0620f",
    c: "#de8f16",
    C: "#f3b630",
    h: "#ffda5c",
    o: "#b24f16",
    u: "#fde4a2",
    U: "#e6b462",
    b: "#7a4019",
    B: "#4a230c",
    // eyes and mouth
    s: "#17121d",
    e: "#ff5e14",
    E: "#ffe24a",
    m: "#5e1708",
    t: "#fff8e6",
    q: "#e5566a",
    // flames: core to rim
    l: "#fff7b8",
    f: "#ff9a1f",
    F: "#f2541b",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    maneL: maneL.part,
    maneR: maneR.part,
    neck: neck.part,
    ossL: ossL.part,
    ossR: ossR.part,
    flameL: flameL.part,
    flameR: flameR.part,
    earL: earL.part,
    earR: earR.part,
    head: head.part,
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
