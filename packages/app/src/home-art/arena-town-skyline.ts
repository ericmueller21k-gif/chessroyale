import type { Character, Frame, Layer, Part } from "../characters/sprite.ts";
import { paint, grain } from "../town/houses/kit.ts";

type Key = string | null;
const BASE = 28; // last row of every building
const parts: Record<string, Part> = {};
const order: Layer[] = [];
function add(name: string, p: { part: Part; at: readonly [number, number] }) {
  parts[name] = p.part;
  order.push({ part: name, x: p.at[0], y: p.at[1] });
}

/** A window: glass of group key `g` (2 x 3) in a dark frame; returns the key at (x, y) or null. */
function win(x: number, y: number, wx: number, wy: number, g: string): Key {
  const i = x - wx;
  const j = y - wy;
  if (i < 0 || j < 0 || i > 3 || j > 4) return null;
  if (i === 0 || j === 0 || i === 3 || j === 4) return "k";
  return g;
}
function door(x: number, y: number, dx: number): Key {
  const i = x - dx;
  const j = y - (BASE - 4);
  if (i < 0 || i > 3 || j < -1) return null;
  if (j === -1) return i === 0 || i === 3 ? null : "k";
  if (i === 0 || i === 3) return "k";
  return i === 1 ? "D" : "e";
}

/** A gabled house: walls x0..x0+w-1 from wallTop to the base, a roof of `ramp` (lit, mid, shade) roofH tall. */
function house(x0: number, w: number, wallTop: number, roofH: number, ramp: string, wins: [number, number, string][], doorX: number) {
  const top = wallTop - roofH;
  const cx = x0 + w / 2;
  return paint(x0 - 1, top, w + 2, BASE - top + 1, (x, y) => {
    if (y < wallTop) {
      const j = y - top;
      const half = (w / 2 + 1) * ((j + 1) / roofH);
      const X = x + 0.5 - cx;
      if (Math.abs(X) > half + 0.01) return null;
      if (j === roofH - 1) return ramp[2]!;
      if (j % 2 === 1 && grain(x, y, 3) < 0.25) return ramp[2]!;
      return X < 0 ? ramp[0]! : ramp[1]!;
    }
    if (x < x0 || x > x0 + w - 1) return null;
    for (const [wx, wy, g] of wins) {
      const k = win(x, y, wx, wy, g);
      if (k) return k;
    }
    const d = door(x, y, doorX);
    if (d) return d;
    if (y === wallTop) return "v";
    if (x === x0 + w - 1) return "w";
    if (x === x0) return "M";
    return "W";
  });
}

function tree(cx: number, cy: number, r: number) {
  return paint(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(2 * r) + 1, BASE - Math.floor(cy - r) + 1, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy * 1.1);
    if (d <= r) {
      if (dx + dy < -r * 0.6) return "L";
      if (dx + dy > r * 0.5) return "j";
      return grain(x, y, 7) < 0.15 ? "j" : "l";
    }
    if (y > cy && Math.abs(dx) < 1) return dx < 0 ? "D" : "e";
    return null;
  });
}

// ---- Ground (behind, so the buildings' outlines sit on it).
add("ground", paint(1, 29, 110, 2, (x, y) => (y === 29 ? (grain(x, y, 2) < 0.2 ? "p" : "P") : "p")));

// ---- Left tree and the red house.
add("treeL", tree(6, 20, 4.5));
add("house1", house(13, 14, 19, 7, "Rrd", [[15, 21, "0"], [22, 21, "1"]], 19));

// ---- The church: a nave behind, a tower with a teal spire and a gold cross.
add("nave", house(39, 10, 18, 5, "Rrd", [[43, 21, "2"]], 99));
add("cross", paint(34, 1, 3, 4, (x, y) => (x === 35 || y === 2 ? "Y" : null)));
add("spire", paint(31, 5, 9, 7, (x, y) => {
  const j = y - 5;
  const half = 0.6 + j * 0.65;
  const X = x + 0.5 - 35.5;
  if (Math.abs(X) > half) return null;
  if (j === 6) return "u";
  return X < 0 ? "T" : "t";
}));
add("tower", paint(32, 12, 7, BASE - 12 + 1, (x, y) => {
  const k = win(x, y, 34, 13, "3") ?? door(x, y, 34);
  if (k) return k;
  if (y === 12) return "s";
  if (x === 32) return "S";
  if (x === 38) return "z";
  return (y + (x % 2)) % 4 === 0 ? "s" : "S";
}));

// ---- The rook: the tallest tower, crenellated, a flag on top.
add("pole", paint(56, 1, 1, 6, () => "o"));
add("flag", { part: { grid: ["FFFFF", "FfFFf", "fffff"].map((r) => r) }, at: [57, 1] });
add("rook", paint(49, 7, 16, BASE - 7 + 1, (x, y) => {
  const i = x - 49;
  const j = y - 7;
  // merlons
  if (j <= 1) {
    if (!((i <= 2) || (i >= 6 && i <= 9) || i >= 13)) return null;
    return i === 0 || i === 6 ? "M" : i === 2 || i === 9 || i === 15 ? "z" : "S";
  }
  if (j <= 4) {
    if (j === 4) return "z";
    return i === 0 ? "M" : i === 15 ? "z" : i === 14 ? "s" : "S";
  }
  // body, narrower, a base flare
  const body = y >= BASE - 1 ? i >= 0 && i <= 15 : i >= 2 && i <= 13;
  if (!body) return null;
  if (y === BASE - 1) return i === 0 ? "M" : "s";
  if (y === BASE) return "z";
  const k = win(x, y, 55, 14, "4") ?? win(x, y, 55, 20, "0");
  if (k) return k;
  if (i === 2) return "M";
  if (i === 13) return "z";
  if (i === 12) return "s";
  // brickwork
  const row = y % 3 === 0;
  if (row) return "s";
  const off = Math.floor(y / 3) % 2 ? 0 : 2;
  return (x + off) % 4 === 0 && grain(x, y, 5) < 0.7 ? "s" : "S";
}));

// ---- The teal house, a lamppost, a little red house, a tree.
add("house2", house(68, 14, 17, 7, "Ttu", [[70, 19, "2"], [77, 19, "0"], [70, 24, "1"]], 77));
add("chimney", paint(93, 15, 2, 4, (x) => (x === 93 ? "R" : "d")));
add("house3", house(90, 11, 21, 5, "Rrd", [[96, 23, "3"]], 91));
add("treeR", tree(105, 21, 4));
add("lampPole", paint(85, 18, 1, BASE - 18 + 1, () => "n"));
add("lampHead", paint(84, 14, 3, 4, (x, y) => (y === 14 || y === 17 ? "n" : x === 84 ? "y" : "Y")));

// The front-to-back order: trees behind buildings where they overlap, lamp in front.
const z = ["ground", "treeL", "house1", "nave", "cross", "spire", "tower", "pole", "flag", "rook", "chimney", "house2", "house3", "treeR", "lampPole", "lampHead"];
const layers = z.map((n) => order.find((l) => l.part === n)!);

const DARK = "#3b3550";
const LIT = "#f4b740";
// Which window groups are lit in each frame: "0" always; the others come on one by one, then one blinks off.
const sched = ["1", "12", "123", "1234", "234", "34"];
const frames: Frame[] = sched.map((on, f) => ({
  ms: 300,
  layers: layers.map((l) => (l.part === "flag" ? { ...l, wave: { along: "cols", amp: 1, len: 6, phase: f * (Math.PI / 3), pin: "left" } } : l)),
  pal: Object.fromEntries(["1", "2", "3", "4"].map((g) => [g, on.includes(g) ? LIT : DARK])),
}));

export const ARENA_TOWN_SKYLINE: Character = {
  id: "arena-town-skyline",
  name: "Chess Town skyline",
  w: 112,
  h: 32,
  foot: [56, 31],
  halo: "#f7f4ee22",
  palette: {
    k: "#2a1c14",
    R: "#c0603f",
    r: "#94402b",
    d: "#62261a",
    T: "#5fb3a8",
    t: "#2f7a78",
    u: "#1d5250",
    M: "#f7f4ee",
    W: "#efdcb8",
    w: "#cdb48a",
    v: "#a08660",
    S: "#c9c3b6",
    s: "#9a9384",
    z: "#6c665b",
    o: "#a39b8d",
    D: "#8a5a2e",
    e: "#5a3418",
    L: "#8cc25a",
    l: "#5a9a3c",
    j: "#2f5a24",
    P: "#9a8a6e",
    p: "#6b5c48",
    F: "#e0503c",
    f: "#a8322a",
    Y: "#f4b740",
    y: "#ffe08a",
    n: "#34466e",
    "0": LIT,
    "1": LIT,
    "2": LIT,
    "3": LIT,
    "4": LIT,
  },
  parts,
  anims: { idle: { loop: true, frames } },
};
