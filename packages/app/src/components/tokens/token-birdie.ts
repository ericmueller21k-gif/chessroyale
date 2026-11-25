// Copied as drawn from the art branch `claude/boss-art` (scripts/boss-art/out/token-birdie/token-birdie.ts at 0746234e, approved Nov 23):
// only the import line changed.
import type { Character, Frame, Part, Speck } from "../../characters/sprite.ts";

const C = 20; // the coin's middle (pixel corner)
const rad = (x: number, y: number) => Math.hypot(x + 0.5 - C, y + 0.5 - C);
const inside = (x: number, y: number) => rad(x, y) < 14.2;

/** A part painted pixel by pixel in frame coordinates. */
function paint(x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => string | null, outline = true) {
  const grid: string[] = [];
  for (let j = 0; j < h; j++) {
    let row = "";
    for (let i = 0; i < w; i++) row += fn(x0 + i, y0 + j) ?? ".";
    grid.push(row);
  }
  return { at: [x0, y0] as const, part: { grid, outline } as Part };
}

// The coin: gold rim with rivets, dark inner ring, navy middle (as the approved tokens).
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
  return "N";
});

// ---- Birdie's face ----
const HX = 20; // head middle
const HY = 20.5;
const HRX = 7.8;
const HRY = 8.2;

/** Scalloped feathers: little U arcs, staggered rows. */
const scallop = (x: number, y: number, y0: number) => {
  const j = (y - y0) % 2;
  const row = Math.floor((y - y0) / 2);
  const i = (x + (row % 2 ? 2 : 0) + 40) % 4;
  return j === 0 ? i === 0 : i === 1 || i === 2;
};
const darker: Record<string, string> = { A: "B", B: "C", C: "D", P: "p", p: "C" };

// The shoulders: buff breast in the middle, grey-brown wings scalloped at the sides.
const body = paint(6, 27, 28, 8, (x, y) => {
  if (!inside(x, y)) return null;
  const nx = (x + 0.5 - HX) / 13;
  const ny = (y + 0.5 - 38) / 11;
  if (nx * nx + ny * ny > 1) return null;
  const d = x + 0.5 - HX;
  const lit = 0.5 - 0.5 * nx - 0.6 * ny;
  let k: string;
  if (Math.abs(d) < 5) k = d < -1.5 ? "P" : "p";
  else k = lit > 0.95 ? "A" : lit > 0.55 ? "B" : "C";
  if (Math.abs(d) >= 5 && scallop(x, y, 28)) k = darker[k]!;
  return k;
});

// The head: soft grey-brown, buff throat, scallops on the cheeks, a small dark beak.
const head = paint(10, 13, 20, 18, (x, y) => {
  if (!inside(x, y)) return null;
  const ny = (y + 0.5 - HY) / HRY;
  const nx = (x + 0.5 - HX) / (HRX * (1 - 0.22 * Math.max(0, ny)));
  if (nx * nx + ny * ny > 1) return null;
  // the beak
  if (y >= 20 && y <= 22 && (x === 19 || x === 20)) return x === 19 ? (y === 20 ? "C" : "H") : "G";
  if (y === 23 && x === 20) return "g";
  const lit = 0.5 - 0.42 * nx - 0.5 * ny;
  let k = lit > 0.78 ? "A" : lit > 0.3 ? "B" : "C";
  // buff throat under the beak
  if (ny > 0.3 && Math.abs(nx) < 0.55 - (ny - 0.3) * 0.3) k = nx < -0.1 ? "P" : "p";
  // scalloped cheeks
  if (y >= 23 && Math.abs(nx) > 0.5 && scallop(x, y, 23)) k = darker[k]!;
  return k;
});

// The eyes: big and dark in a pale ring, a bright catchlight.
const EYES: [number, number][] = [
  [16, 20],
  [24, 20],
];
const eyeRing = (x: number, y: number) => EYES.some(([cx, cy]) => Math.abs(x + 0.5 - cx) < 2.1 && Math.abs(y + 0.5 - cy) < 2.6 && Math.hypot((x + 0.5 - cx) / 2.1, (y + 0.5 - cy) / 2.6) < 1.12);
const eyes = paint(11, 16, 18, 8, (x, y) => {
  if (!eyeRing(x, y)) return null;
  for (const [cx, cy] of EYES) {
    const px = x + 0.5 - cx;
    const py = y + 0.5 - cy;
    if (Math.abs(px) < 1.1 && Math.abs(py) < 1.6) return px < 0 && py < -0.5 ? "M" : "K";
  }
  return "E";
}, false);
// Shut: the pale ring with a happy curve of a lid.
const shut = paint(11, 16, 18, 8, (x, y) => {
  if (!eyeRing(x, y)) return null;
  for (const [cx, cy] of EYES) {
    const px = x + 0.5 - cx;
    const py = y + 0.5 - cy;
    if (Math.abs(px) < 2.2 && Math.abs(py) < 2.7) {
      if (Math.abs(px) < 1.1 && py > 0 && py < 1) return "K";
      if (Math.abs(px) > 1.1 && py > -1 && py < 0) return "K";
    }
  }
  return "E";
}, false);

// The conductor's cap, worn jaunty: crown tilted up to the right, a gold band, a dark visor.
const capBottom = (x: number) => 15.6 - ((x - 11) * 2.6) / 18; // the band's lower edge, tilted
const capTop = (x: number) => (x < 15 ? 11.2 - ((x - 12) * 2) / 3 : x < 25 ? 9.2 - ((x - 15) * 2) / 10 : 7.2 + ((x - 25) * 2) / 3);
const cap = paint(10, 6, 21, 12, (x, y) => {
  if (!inside(x, y)) return null;
  const xc = x + 0.5;
  const yc = y + 0.5;
  if (xc < 11.5 || xc > 29) return null;
  const top = Math.round(capTop(xc));
  const bot = Math.round(capBottom(xc)); // first row of the visor
  if (y < top) return null;
  if (y < bot) {
    if (y >= bot - 2) return xc < 16 ? "y" : xc > 26 ? "O" : "Y"; // the gold band
    if (y === top) return xc < 24 ? "q" : "Q"; // lit crown edge
    return xc < 14 ? "q" : xc > 25.5 ? "V" : "Q";
  }
  // the visor
  if (y === bot) return "v";
  if (y === bot + 1 && xc > 12.5 && xc < 28) return "V";
  return null;
});
// The badge: a plain gold shield on the cap's front.
const badge = paint(19, 9, 3, 3, (x, y) => {
  const g = ["yYY", "YYO", ".O."];
  const k = g[y - 9]![x - 19]!;
  return k === "." ? null : k;
});

// A small burgundy tie at the neck.
const tie = paint(17, 28, 6, 3, (x, y) => {
  const g = ["Tt..tR", "TtTRtR", "Tt..tR"];
  const k = g[y - 28]![x - 17]!;
  return k === "." || !inside(x, y) ? null : k;
});

const W = (part: string, at: readonly [number, number]) => ({ part, x: at[0], y: at[1] });
const layersOpen = [W("disc", disc.at), W("body", body.at), W("head", head.at), W("tie", tie.at), W("eyes", eyes.at), W("cap", cap.at), W("badge", badge.at)];
const layersShut = layersOpen.map((l) => (l.part === "eyes" ? { ...l, part: "shut" } : l));

// A glint riding round the rim, a quarter turn a frame.
function glint(i: number): Speck[] {
  const a = (-135 + i * 90) * (Math.PI / 180);
  const r = 16.7;
  const at = (da: number, rr = r): [number, number] => [Math.floor(C + rr * Math.cos(a + da) - 0.5 + 0.5), Math.floor(C + rr * Math.sin(a + da) - 0.5 + 0.5)];
  const [x, y] = at(0);
  const [x1, y1] = at(0.09);
  const [x2, y2] = at(-0.09);
  return [[x1, y1, "y"], [x2, y2, "y"], [x, y - 2, "y"], [x, y + 2, "y"], [x - 2, y, "y"], [x + 2, y, "y"], [x, y - 1, "M"], [x, y + 1, "M"], [x - 1, y, "M"], [x + 1, y, "M"], [x, y, "M"]];
}

const frames: Frame[] = [
  ...[0, 1, 2, 3].map((i): Frame => ({ layers: layersOpen, ms: 180, specks: glint(i) })),
  { layers: layersOpen, ms: 1400 },
  { layers: layersShut, ms: 150 },
];

export const TOKEN_BIRDIE: Character = {
  id: "token-birdie",
  name: "Birdie token",
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
    // the dove
    A: "#cdbba6",
    B: "#a8937f",
    C: "#7d6b5d",
    D: "#5d4f45",
    P: "#e0bba0",
    p: "#c39a82",
    E: "#efe7da",
    K: "#1c1410",
    G: "#3b3230",
    g: "#2e2624",
    H: "#5e514c",
    // the cap
    q: "#6a84bd",
    Q: "#3f558a",
    V: "#2b3a62",
    v: "#3a3f52",
    // the tie
    T: "#b04257",
    t: "#8a2a3e",
    R: "#5e1a2a",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    body: body.part,
    head: head.part,
    eyes: eyes.part,
    shut: shut.part,
    cap: cap.part,
    badge: badge.part,
    tie: tie.part,
  },
  anims: {
    idle: { loop: true, frames },
  },
};
