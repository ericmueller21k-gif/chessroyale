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

// Shoulders: the teal crop shirt (no letters), its round collar.
const body = paint(6, 26, 28, 9, (x, y) => {
  if (!inside(x, y)) return null;
  const d = x + 0.5 - 21;
  const hw = 7 + (y - 27) * 1.8;
  if (y < 27 || Math.abs(d) > hw) return null;
  if (y === 27 && Math.abs(d) < 4) return "t"; // collar
  if (Math.abs(d) > hw - 2) return d < 0 ? "U" : "T"; // sleeves
  return d < -3 ? "u" : d > 3 ? "t" : "u";
});

// Big ears.
const ear = (cx: number) =>
  paint(cx - 4, 14, 8, 9, (x, y) => {
    const d = Math.hypot((x + 0.5 - cx) / 3.1, (y + 0.5 - 18.5) / 3.6);
    if (d > 1 || !inside(x, y)) return null;
    if (d < 0.5 && Math.abs(x + 0.5 - cx) < 1) return "d";
    return x + 0.5 < cx ? "C" : "c";
  });
const earL = ear(11);
const earR = ear(31);

// The head: chubby, bald, round cheeks; half-lidded eyes, brows, button nose, big pink lips.
const HX = 21;
const headHalf = (y: number): number => {
  if (y < 9 || y > 28) return -1;
  const t = (y + 0.5 - 18.5) / 10;
  let hw = 8.6 * Math.sqrt(Math.max(0, 1 - t * t * t * t * (y < 18 ? 1.4 : 1)));
  if (y < 18) hw = 8.6 * Math.sqrt(Math.max(0, 1 - t * t));
  if (y >= 26) hw = Math.min(hw, y === 26 ? 7.5 : y === 27 ? 6 : 4);
  return hw;
};
const head = paint(11, 9, 20, 20, (x, y) => {
  const hw = headHalf(y);
  const d = x + 0.5 - HX;
  if (hw < 0 || Math.abs(d) > hw) return null;
  // brows
  if (y === 15 && ((x >= 15 && x <= 18) || (x >= 23 && x <= 26))) return "b";
  // eyes: a heavy lid line, then the white and the pupil under it
  const lx = x >= 15 && x <= 18 ? x - 15 : x >= 23 && x <= 26 ? x - 23 : -1;
  if (lx >= 0 && y === 17) return "k"; // the heavy lid
  if (lx >= 0 && (y === 18 || y === 19)) return lx === 1 || lx === 2 ? "e" : "w";
  if (lx >= 0 && y === 20 && lx > 0 && lx < 3) return "c";
  if (y === 18 && (x === 14 || x === 27)) return "k";
  // nose
  if (y === 20 && x === 21) return "h";
  if (y === 21 && (x === 20 || x === 22)) return "d";
  // big pink lips
  if (y >= 22 && y <= 25 && x >= 17 && x <= 25) {
    const ly = y - 22;
    const lw = ly === 0 ? 2.6 : ly === 3 ? 2.8 : 4.4;
    const ld = x + 0.5 - HX;
    if (Math.abs(ld) <= lw) {
      if (ly === 1 && Math.abs(ld) < 3.6) return "m"; // the line between them
      if (ly === 0) return ld < 0 ? "P" : "L";
      if (ly === 2) return ld < -1 ? "P" : "L";
      return "l";
    }
  }
  // cheeks and shading, lit from the top left
  const t = d / hw;
  if (y >= 19 && y <= 23 && (Math.abs(d + 5) < 1.5 || Math.abs(d - 5) < 1.5) && y >= 20 && y <= 21) return "h";
  if (y <= 12 && t < 0.1) return "h";
  return t < -0.55 ? "h" : t > 0.5 || y >= 26 ? "c" : "C";
});

// A few hair tufts on top.
const hair = paint(17, 6, 8, 4, (x, y) => {
  const TUFT = new Set(["18,7", "19,8", "19,9", "21,6", "20,7", "21,8", "21,9", "23,7", "23,8", "22,9"]);
  return TUFT.has(`${x},${y}`) ? "H" : null;
});
(hair.part as { outline?: boolean }).outline = false;

// The swirly rainbow lollipop held up beside his cheek: candy, stick, his fist.
const LX = 11.5, LY = 13.5, LR = 4.6;
const candy = paint(6, 8, 12, 12, (x, y) => {
  const dx = x + 0.5 - LX;
  const dy = y + 0.5 - LY;
  const r = Math.hypot(dx, dy);
  if (r > LR) return null;
  if (r < 1.4 && dx < 0.6 && dy < 0.6 && dx < 0 && dy < 0) return "F";
  const a = Math.atan2(dy, dx) / (2 * Math.PI);
  const band = Math.floor((a * 6 + r * 1.3) % 6 + 6) % 6;
  return String(band + 1);
});
const stick = paint(10, 17, 3, 8, (x, y) => {
  if (x !== 11 || y < 18) return null;
  return "v";
});
const fist = paint(9, 22, 5, 5, (x, y) => {
  const d = Math.hypot(x + 0.5 - 11.5, y + 0.5 - 24.2);
  if (d > 2.2 || !inside(x, y)) return null;
  return x < 11 && y < 24 ? "h" : x > 11 || y > 24 ? "c" : "C";
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [
  W("disc", disc.at),
  W("body", body.at),
  W("earL", earL.at),
  W("earR", earR.at),
  W("head", head.at),
  W("hair", hair.at),
  W("stick", stick.at),
  W("candy", candy.at),
  W("fist", fist.at),
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

// The blink: the lids shut, a dark lash line under them.
const BLINK: Speck[] = [15, 16, 17, 18, 23, 24, 25, 26].flatMap((x) => [[x, 17, "c"], [x, 18, "c"], [x, 19, "k"]] as Speck[]);
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_BIGBOY: Character = {
  id: "token-bigboy",
  name: "Big Boy token",
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
    // skin, dark to light
    d: "#a8603e",
    c: "#d0885c",
    C: "#eba57a",
    h: "#f8c9a2",
    b: "#9a5a35",
    H: "#7a5236",
    w: "#fffaf0",
    e: "#2a1712",
    // lips
    l: "#9c3a60",
    L: "#e7719a",
    P: "#ffb6cc",
    m: "#5c1834",
    // shirt
    T: "#0f5c63",
    t: "#178589",
    u: "#23a8a8",
    U: "#4fcfc6",
    // lollipop
    v: "#f7f3ea",
    "1": "#ff3349",
    "2": "#ff8a1a",
    "3": "#ffe23b",
    "4": "#35c94b",
    "5": "#2e86ff",
    "6": "#a24cf5",
    F: "#ffffff",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    body: body.part,
    earL: earL.part,
    earR: earR.part,
    head: head.part,
    hair: hair.part,
    stick: stick.part,
    candy: candy.part,
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
