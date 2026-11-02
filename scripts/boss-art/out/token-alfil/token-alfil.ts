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

// Fur: banded, lit from the top left, with shaggy lock streaks.
const FUR = "abcde";
const fur = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, bias = 0) => {
  const l = (-(x + 0.5 - cx) / rx) * 0.55 - ((y + 0.5 - cy) / ry) * 0.75 + 0.45 + bias;
  let i = Math.max(0, Math.min(4, Math.floor(l * 4.2)));
  if ((x * 3 + Math.floor(y / 2) * 2) % 7 === 0 && i > 0) i--; // a darker lock
  return FUR[i]!;
};

// Shoulders: a shaggy mass of fur under the head, cut off by the ring.
const body = paint(6, 22, 28, 12, (x, y) => {
  if (!inside(x, y)) return null;
  const d = x + 0.5 - C;
  const hw = 5 + (y - 26) * 1.8;
  if (y < 26 || Math.abs(d) > hw) return null;
  return fur(x, y, 20, 24, 12, 10, -0.35);
});

// Ears: broad flaps at the sides of the head.
const ear = (cx: number) =>
  paint(cx - 4, 9, 8, 12, (x, y) => {
    if (!inside(x, y)) return null;
    const d = Math.hypot((x + 0.5 - cx) / 3.4, (y + 0.5 - 14.5) / 4.6);
    if (d > 1) return null;
    if (d < 0.5) return "a";
    return fur(x, y, cx, 14.5, 3.4, 4.6, cx < 20 ? -0.35 : -0.6);
  });
const earL = ear(11);
const earR = ear(29);

// The head: a high shaggy dome, angry brows, the eyes.
const headIn = (x: number, y: number) => {
  const dx = (x + 0.5 - 20) / 8.4;
  const dy = (y + 0.5 - 14.4) / 8.8;
  if (dx * dx + dy * dy <= 1) return true;
  // shaggy locks hanging under the cheeks
  return y >= 21 && y <= 23 && Math.abs(x + 0.5 - 20) < 8 - (y - 21) * 1.5 && (x + y) % 2 === 0;
};
const headFur = (x: number, y: number) => fur(x, y, 20, 14, 8.4, 8, 0.45);
const EYES = new Map<string, string>();
for (const ex of [14, 23]) {
  const m = ex < 20; // left eye
  // whites, then the pupil toward the middle (glaring forward)
  for (const [x, y] of [[0, 16], [1, 16], [2, 16], [0, 17], [1, 17], [2, 17]] as const) EYES.set(`${ex + x},${y}`, "w");
  EYES.set(`${ex + (m ? 2 : 0)},16`, "x");
  EYES.set(`${ex + (m ? 2 : 0)},17`, "x");
  EYES.set(`${ex + 1},17`, "x");
  EYES.set(`${ex + (m ? 1 : 1)},16`, "v");
}
const BROWS = new Set(["12,14", "13,14", "14,15", "15,15", "16,15", "17,16", "27,14", "26,14", "25,15", "24,15", "23,15", "22,16"]);
const head = paint(10, 6, 20, 18, (x, y) => {
  if (!headIn(x, y)) return null;
  if (BROWS.has(`${x},${y}`)) return "x";
  const e = EYES.get(`${x},${y}`);
  if (e) return e;
  return headFur(x, y);
});

// The Nettipattam on his brow: red, a blue diamond, gold trim, coming to a point.
const netti = paint(12, 8, 17, 8, (x, y) => {
  const d = x + 0.5 - 20.5;
  const hw = y < 9 ? 0 : y <= 12 ? 6.5 : 6.5 - (y - 12) * 2.2;
  if (hw <= 0 || Math.abs(d) > hw) return null;
  const hwNext = y + 1 <= 12 ? 6.5 : 6.5 - (y + 1 - 12) * 2.2;
  if (y === 9 || Math.abs(d) > hw - 1 || Math.abs(d) > hwNext) return d < -2 ? "y" : d > 3 ? "O" : "Y";
  const dd = Math.abs(d) + Math.abs(y + 0.5 - 11.5);
  if (dd < 1) return "y";
  if (dd < 2.6) return d < 0 && y < 11 ? "B" : "L";
  if (y === 11 && Math.abs(Math.abs(d) - 4.5) < 0.6) return "B";
  return d < -1 && y < 11 ? "R" : "r";
});

// The trunk: down the middle, wrinkled, its tip curling up to our right.
const trunk = paint(17, 16, 9, 15, (x, y) => {
  let on = false;
  const d = x + 0.5 - 20;
  const hw = y < 22 ? 2 : y < 26 ? 1.6 : 1.2;
  if (y <= 28 && Math.abs(d) <= hw) on = true;
  // the curl: a little loop up to the right at the tip
  const cr = Math.hypot(x + 0.5 - 22, y + 0.5 - 27.5);
  if (y >= 26 && x >= 20 && cr >= 0.6 && cr < 2.1) on = true;
  if (!on) return null;
  if (!inside(x, y)) return null;
  if (y >= 19 && y % 2 === 0 && x >= 19 && x <= 21 && y <= 26) return "b"; // wrinkles
  if (x >= 21 && y >= 26) return y === 26 ? "d" : "b";
  return d < -1 ? "e" : d < 0.5 ? "d" : "c";
});

// The tusks: big ivory curves from beside the trunk, sweeping out and up.
const TUSK: [number, number, number][] = [
  [16.6, 21.0, 1.7],
  [15.0, 24.6, 1.65],
  [12.2, 26.8, 1.5],
  [9.0, 26.0, 1.35],
  [7.0, 23.2, 1.15],
  [6.4, 19.6, 0.95],
  [7.2, 16.2, 0.7],
];
const inTusk = (x: number, y: number, flip: boolean) => {
  const px = flip ? 40 - (x + 0.5) : x + 0.5;
  const py = y + 0.5;
  for (let i = 0; i < TUSK.length - 1; i++) {
    const [ax, ay, ar] = TUSK[i]!;
    const [bx, by, br] = TUSK[i + 1]!;
    const vx = bx - ax;
    const vy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
    const r = ar + (br - ar) * t;
    if (Math.hypot(px - ax - vx * t, py - ay - vy * t) <= r) return true;
  }
  return false;
};
const tusk = (flip: boolean) =>
  paint(flip ? 20 : 5, 14, 15, 14, (x, y) => {
    if (!inTusk(x, y, flip) || rad(x, y) > 14.4) return null;
    const up = inTusk(x, y - 1, flip);
    const dn = inTusk(x, y + 1, flip);
    if (!up) return flip ? "t" : "T";
    if (!dn) return flip ? "V" : "U";
    return flip ? "U" : "t";
  });
const tuskL = tusk(false);
const tuskR = tusk(true);

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [
  W("disc", disc.at),
  W("body", body.at),
  W("earL", earL.at),
  W("earR", earR.at),
  W("head", head.at),
  W("netti", netti.at),
  W("trunk", trunk.at),
  W("tuskL", tuskL.at),
  W("tuskR", tuskR.at),
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

// The blink: the eyes shut to a dark line under fur lids.
const BLINK: Speck[] = [...EYES.keys()].map((k) => {
  const [x, y] = k.split(",").map(Number) as [number, number];
  return [x, y, y === 17 ? "x" : headFur(x, y)] as Speck;
});
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_ALFIL: Character = {
  id: "token-alfil",
  name: "Alfil token",
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
    // fur (Alfil's warm reddish brown)
    a: "#4a2a17",
    b: "#6f4124",
    c: "#94592f",
    d: "#b8743f",
    e: "#d39257",
    // ivory
    T: "#fffaea",
    t: "#ece0c1",
    U: "#c9b78f",
    V: "#9a8762",
    // eyes
    w: "#fbf7ee",
    v: "#ffffff",
    x: "#0c0806",
    // the Nettipattam
    R: "#e0312a",
    r: "#a51d24",
    B: "#2f63cc",
    L: "#1d3d8c",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    body: body.part,
    earL: earL.part,
    earR: earR.part,
    head: head.part,
    netti: netti.part,
    trunk: trunk.part,
    tuskL: tuskL.part,
    tuskR: tuskR.part,
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
