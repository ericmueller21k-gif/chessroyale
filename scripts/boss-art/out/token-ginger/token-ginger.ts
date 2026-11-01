import type { Character, Frame, Speck, Part } from "../../../../packages/app/src/characters/sprite.ts";

const C = 20;
type Fn = (x: number, y: number) => string | null;
function paint(x0: number, y0: number, w: number, h: number, f: Fn, outline = true): { part: Part; at: [number, number] } {
  const rows: string[] = [];
  for (let y = y0; y < y0 + h; y++) {
    let s = "";
    for (let x = x0; x < x0 + w; x++) s += f(x, y) ?? ".";
    rows.push(s);
  }
  return { part: { grid: rows, outline }, at: [x0, y0] };
}
const rad = (x: number, y: number) => Math.hypot(x + 0.5 - C, y + 0.5 - C);
const inside = (x: number, y: number) => rad(x, y) < 13.6;

// The coin: the crest's gold rim with rivets, its dark ring, a navy middle.
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
    if (r > 17.6) return lit > 0.3 ? "Y" : lit < -0.4 ? "O" : "Y";
    return lit > 0.35 ? "y" : lit < -0.45 ? "O" : "Y";
  }
  if (r > 14.2) return "k";
  if (y >= 27) return "n";
  return "N";
});

// Shading for a round cookie: lit top left, shade bottom right.
const HX = 20, HY = 18.5, HR = 10.3;
function cookie(x: number, y: number, cx: number, cy: number, r: number): string {
  const dx = (x + 0.5 - cx) / r;
  const dy = (y + 0.5 - cy) / r;
  const l = -dx - dy;
  const d = Math.hypot(dx, dy);
  if (d > 0.78 && l < -0.25) return "h";
  if (l > 0.55 && d > 0.45) return "g";
  return "G";
}

// Shoulders and chest, cut by the inner ring.
const body = paint(5, 26, 30, 10, (x, y) => {
  if (!inside(x, y)) return null;
  const hw = 7 + (y - 26) * 1.6;
  const d = x + 0.5 - C;
  if (Math.abs(d) > hw) return null;
  // icing button
  if (x >= 19 && x <= 20 && y >= 33 && y <= 34) return y === 33 && x === 19 ? "p" : "e";
  const t = d / hw;
  if (y === 26 + Math.floor(Math.abs(d) / 1.6) && Math.abs(d) > 7.5) return "g";
  return t < -0.55 ? "g" : t > 0.55 ? "h" : "G";
});

// The green bow tie under the chin.
const bow = paint(15, 27, 10, 5, (x, y) => {
  const d = x + 0.5 - C;
  const j = y - 29;
  if (Math.abs(d) <= 1) return j === 0 ? "v" : null;
  if (Math.abs(d) > 5) return null;
  const spread = (Math.abs(d) - 1) * 0.6;
  if (Math.abs(j + 0.0) > spread) return null;
  return j < 0 || (j === 0 && d < 0) ? "v" : "V";
});

// The head: a big round cookie with icing.
const brows: [number, number][] = [
  [13, 13], [14, 13], [15, 14], [16, 14], [17, 15], [18, 15],
  [26, 13], [25, 13], [24, 14], [23, 14], [22, 15], [21, 15],
];
const mouth: [number, number][] = [[16, 24], [17, 23], [18, 22], [19, 22], [20, 22], [21, 22], [22, 23], [23, 24]];
const eyes: [number, number][] = [[15, 17], [16, 17], [15, 18], [16, 18], [23, 17], [24, 17], [23, 18], [24, 18]];
const has = (l: [number, number][], x: number, y: number) => l.some((p) => p[0] === x && p[1] === y);
const head = paint(9, 8, 22, 22, (x, y) => {
  const dx = x + 0.5 - HX;
  const dy = (y + 0.5 - HY) * 1.04;
  const r = Math.hypot(dx, dy);
  if (r > HR) return null;
  if (has(brows, x, y) || has(mouth, x, y)) return "M";
  if (has(eyes, x, y)) return (x === 15 || x === 23) && y === 17 ? "E" : y === 18 ? "e" : "e";
  // dashed icing trim round the top of the head
  if (r > 8.2 && r < 9.2 && dy < -2) {
    const a = Math.atan2(dy, dx);
    if (Math.floor((a + Math.PI) * 9.2 / 2) % 2 === 0) return "M";
  }
  return cookie(x, y, HX, HY, HR);
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layers = [W("disc", disc.at), W("body", body.at), W("head", head.at), W("bow", bow.at)];

// A glint riding round the rim.
function glint(deg: number): Speck[] {
  const a = deg * (Math.PI / 180);
  const r = 16.7;
  const at = (da: number): [number, number] => [Math.floor(C + r * Math.cos(a + da)), Math.floor(C + r * Math.sin(a + da))];
  const [x, y] = at(0);
  const [x1, y1] = at(0.09);
  const [x2, y2] = at(-0.09);
  return [
    [x1, y1, "y"], [x2, y2, "y"], [x, y - 2, "y"], [x, y + 2, "y"], [x - 2, y, "y"], [x + 2, y, "y"],
    [x, y - 1, "M"], [x, y + 1, "M"], [x - 1, y, "M"], [x + 1, y, "M"], [x, y, "M"],
  ];
}

// A blink: the eyes drop to a dark line of shut lids.
const blink: Speck[] = [
  [15, 17, "G"], [16, 17, "G"], [23, 17, "G"], [24, 17, "G"],
  [15, 18, "k"], [16, 18, "k"], [23, 18, "k"], [24, 18, "k"],
];

const f = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_GINGER: Character = {
  id: "token-ginger",
  name: "Ginger token",
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
    M: "#f7f4ee",
    g: "#e09a5a",
    G: "#bf6e32",
    h: "#8c4a1e",
    e: "#d8352a",
    E: "#ff9a7a",
    p: "#f7f4ee",
    v: "#4cb85a",
    V: "#23803a",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    body: body.part,
    head: head.part,
    bow: bow.part,
  },
  anims: {
    idle: {
      loop: true,
      frames: [
        f(300),
        f(150, glint(-160)),
        f(150, glint(-110)),
        f(150, glint(-60)),
        f(150, glint(-10)),
        f(300, blink),
      ],
    },
  },
};
