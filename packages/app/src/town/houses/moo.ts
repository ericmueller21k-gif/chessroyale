/**
 * Moo & Moon Meadow: the calf and his moon's home on the town square (Eric's reference,
 * docs/mockups/town-square/moo-meadow.webp). A little round meadow seen from the front and a little above: a grassy mound
 * inside a wooden fence, hay bales at its back left, daisies, a flowering bush and two rocks; at its back right a
 * wooden post with an arm, a crescent moon and a star hanging from it on strings and a lantern on a hook; a blank sign
 * board on the front fence (the game writes "Moo & Moon Meadow" on it). The moon's colors are Moo's
 * (characters/moo.ts). Light from the top left, as the bosses'. `idle`: the moon and the star sway a little and the
 * lantern flickers (four frames).
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { MOO_PALETTE } from "../../characters/moo.ts";
import { grain, groundShadow, paint, signBoard, signFace, type Pt } from "./kit.ts";

const M_ = MOO_PALETTE;
const PALETTE: Record<string, string> = {
  k: M_.k!, // outline
  g: "#5cbf4a", // grass: mid, dark, light
  G: "#2f8a3a",
  j: "#9be36a",
  "1": "#4a2a17", // wood: dark to light
  "2": "#7a4a22",
  "3": "#a8703a",
  "4": "#d09a5a",
  y: "#e8b83a", // hay: mid, dark, light; its twine
  Y: "#b8862a",
  h: "#ffe08a",
  u: "#7a4a22",
  M: M_.M!, // the moon (Moo's): yellow, shade, mid, light, rim
  N: M_.N!,
  O: M_.O!,
  P: M_.P!,
  Q: M_.Q!,
  r: "#9a9aa6", // rocks: mid, dark, light
  R: "#5f5f6c",
  L: "#c8c8d2",
  F: "#ffffff", // daisies: petals, middles
  e: "#ffd23f",
  n: "#2b2530", // the lantern's iron, its glass lit (bright, warm)
  l: "#ffe9a0",
  m: "#ffb340",
  s: "#5a4a3a", // strings
  x: "#c9a56a", // the sign's face: shadow, board, light; its nails
  X: "#e8cc95",
  z: "#f7e4b8",
  a: "#f2c14e",
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};

const W = 144;
const H = 120;
const CX = 72;
const FOOT = 114;
/** The mound: an oval of grass, its middle and half-axes. */
const MY = 92;
const RX = 62;
const RY = 19;
const edge = (X: number) => RY * Math.sqrt(Math.max(0, 1 - (X / RX) ** 2));
const backY = (X: number) => MY - edge(X);
const frontY = (X: number) => MY + edge(X);

// ---- The meadow: grass lit from the top left, darker toward its front rim, tufts along its edge.

const meadow = paint(CX - RX - 1, MY - RY - 3, 2 * RX + 2, 2 * RY + 6, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  const tuft = Math.abs(Math.sin(X * 0.9)) > 0.75 ? 2 : 0; // blades poking up along the back edge
  if (Math.abs(X) > RX || Y < backY(X) - tuft || Y > frontY(X) + 1) return null;
  if (Y < backY(X)) return "g";
  const ny = (Y - MY) / RY;
  const l = 0.6 - 0.35 * (X / RX) - 0.45 * Math.max(0, ny) + (grain(x, y, 2) - 0.5) * 0.3;
  if (Y > frontY(X) - 2) return "G";
  return l > 0.72 ? "j" : l > 0.35 ? "g" : "G";
});

// ---- The fence: a back run behind the meadow and a front run before it, posts and two rails following the oval.

function fence(front: boolean) {
  const yAt = front ? frontY : backY;
  const postH = front ? 15 : 12;
  return paint(CX - RX - 2, MY - RY - postH - 2, 2 * RX + 4, 2 * RY + postH + 6, (x, y) => {
    const X = x + 0.5 - CX;
    if (Math.abs(X) > RX - 1) return null;
    const g = yAt(X);
    const Y = y + 0.5;
    // Posts every 17 pixels (at the oval's ends too); rails between them.
    const p = Math.abs(((X + RX - 3) % 17) - 1.5);
    if (p < 2 && Y < g + 1 && Y > g - postH) return Y < g - postH + 1.5 ? "4" : p < 0.8 ? "3" : "2";
    for (const r of front ? [postH - 4, postH - 9] : [postH - 3, postH - 7]) {
      const ry = g - r;
      if (Y > ry - 1 && Y < ry + 1.2) return Y < ry ? "3" : "2";
    }
    return null;
  });
}
const fenceBack = fence(false);
const fenceFront = fence(true);

// ---- Hay bales at its back left: blocks with a lit top and a shaded side, straw lines and twine.

function bale(x0: number, y0: number, w: number, h: number) {
  const top = 4;
  const side = 4;
  return paint(x0, y0 - top, w + side, h + top, (x, y) => {
    const i = x - x0;
    const j = y - (y0 - top);
    const fy = j - top; // in the front face
    // The top face: a parallelogram leaning right; the side face: one leaning up.
    if (fy < 0) return i >= top - j - 1 + 1 && i < w + top - j ? (grain(x, y, 9) < 0.3 ? "y" : "h") : null;
    if (i >= w) return i - w < side && fy < h - (i - w) ? "Y" : null;
    if (i === 5 || i === w - 6) return "u"; // the twine
    return grain(x, y, 4) < 0.25 || fy % 4 === 0 ? "Y" : "y";
  });
}
const baleL = bale(12, 72, 24, 13);
const baleR = bale(33, 69, 22, 13);

// ---- The post and its arm, the moon and star on strings, the lantern on its hook.

const POST = 108;
const ARM_Y = 12;
const post = paint(POST, ARM_Y - 2, 6, Math.round(backY(POST + 3 - CX)) + 2 - (ARM_Y - 2), (x) => (x === POST ? "4" : x === POST + 5 ? "1" : x === POST + 1 ? "3" : "2"));
const arm = paint(78, ARM_Y, 40, 5, (x, y) => (x === 78 ? "2" : y === ARM_Y ? "4" : y === ARM_Y + 4 ? "1" : "3"));
const brace = paint(101, ARM_Y + 4, 8, 8, (x, y) => {
  const j = y - (ARM_Y + 4);
  const i = x - 101;
  const d = i - j; // along the diagonal from the arm down to the post
  return d >= 0 && d < 3 ? (d === 0 ? "3" : "2") : null;
});
const string = (sx: number, top: number, len: number) => paint(sx, top, 1, len, () => "s", false);
const MOON: Pt = [86, 33];
const moon = paint(MOON[0] - 11, MOON[1] - 11, 22, 22, (x, y) => {
  const dx = x + 0.5 - MOON[0];
  const dy = y + 0.5 - MOON[1];
  if (Math.hypot(dx, dy) > 10.5 || Math.hypot(dx - 5, dy - 3.5) < 8.2) return null; // a crescent opening to the right
  const l = -dx * 0.08 - dy * 0.06 + (Math.hypot(dx, dy) > 9 ? -0.4 : 0);
  return l > 0.45 ? "P" : l > 0.05 ? "O" : l > -0.35 ? "N" : "M";
});
const STAR: Pt = [96, 30];
const star = paint(STAR[0] - 5, STAR[1] - 5, 11, 11, (x, y) => {
  const dx = x + 0.5 - STAR[0];
  const dy = y + 0.5 - STAR[1];
  const a = Math.atan2(dy, dx) + Math.PI / 2;
  const t = Math.abs(((((a * 5) / (2 * Math.PI)) % 1) + 1) % 1 - 0.5) * 2;
  if (Math.hypot(dx, dy) > 5 - 2.8 * t) return null;
  return dx + dy < 0 ? "P" : "O";
});
const LANTERN: Pt = [117, 36];
const lantern = paint(LANTERN[0], LANTERN[1], 8, 12, (x, y) => {
  const i = x - LANTERN[0];
  const j = y - LANTERN[1];
  if (j === 0) return i >= 3 && i <= 4 ? "n" : null; // the ring
  if (j === 1 || j === 11) return i >= 1 && i <= 6 ? "n" : null; // its cap and base
  if (i === 0 || i === 7) return null;
  if (i === 1 || i === 6) return "n";
  return j < 5 && i < 4 ? "l" : "m"; // the glass, lit
});
const hook = paint(114, 33, 4, 4, (x, y) => (y === 33 ? (x < 118 ? "n" : null) : x === 117 && y < 36 ? "n" : null), false);

// ---- A flowering bush by the post, daisies in the grass, rocks at the front.

const bush = paint(92, 70, 24, 14, (x, y) => {
  const dx = (x + 0.5 - 104) / 12;
  const dy = (y + 0.5 - 79) / 8;
  if (dx * dx + dy * dy > 1 + 0.15 * Math.sin(x * 1.3)) return null;
  if (grain(x, y, 12) < 0.09) return "F";
  return dx + dy < -0.3 ? "j" : dx + dy < 0.5 ? "g" : "G";
});
const daisy = (cx: number, cy: number) => paint(cx - 1, cy - 1, 3, 3, (x, y) => (x === cx && y === cy ? "e" : x === cx || y === cy ? "F" : null));
const daisies = (
  [
    [40, 92],
    [56, 84],
    [66, 98],
    [88, 88],
    [24, 99],
    [112, 96],
    [78, 104],
  ] as const
).map(([x, y]) => daisy(x, y));
const rock = (cx: number, cy: number, rx: number, ry: number) =>
  paint(Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(2 * rx) + 1, Math.ceil(2 * ry) + 1, (x, y) => {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy > 1) return null;
    return dx + dy < -0.6 ? "L" : dx + dy < 0.4 ? "r" : "R";
  });
const rocks = [rock(12, 104, 7, 4.5), rock(131, 101, 6, 4)];
const shadow = groundShadow(CX, FOOT - 2, 66, 4.5);

// ---- The sign on the front fence: blank; the game writes "Moo & Moon Meadow" on it.

const BOARD: Pt = [CX - 30, 91];
const BW = 60;
const BH = 20;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, "1234", "xXz", "a");

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
add("stringMoon", string(MOON[0], ARM_Y + 5, MOON[1] - 10 - (ARM_Y + 5)));
add("stringStar", string(STAR[0], ARM_Y + 5, STAR[1] - 5 - (ARM_Y + 5)));
add("moon", moon);
add("star", star);
const still = [
  add("shadow", shadow),
  add("fenceBack", fenceBack),
  add("post", post),
  add("arm", arm),
  add("brace", brace),
  add("hook", hook),
  add("lantern", lantern),
  add("meadow", meadow),
  add("baleR", baleR),
  add("baleL", baleL),
  add("bush", bush),
  ...daisies.map((p, i) => add(`daisy${i}`, p)),
  ...rocks.map((p, i) => add(`rock${i}`, p)),
  add("fenceFront", fenceFront),
  add("board", board),
];
const L = (part: string, dx = 0): Layer => ({ part, x: at[part]![0] + dx, y: at[part]![1] });

/** The moon and star sway a pixel either way, out of step; the lantern's glass flickers warm and bright. */
const SWAY: readonly [number, number, Record<string, string>][] = [
  [0, 0, {}],
  [1, -1, { l: "#fff3c4", m: "#ffc25a" }],
  [0, 0, {}],
  [-1, 1, { l: "#ffe08a", m: "#f5a030" }],
];
const frames: Frame[] = SWAY.map(([m, s, pal]) => ({
  ms: 340,
  pal,
  layers: [
    ...still.slice(0, 7).map((p) => L(p)),
    L("stringMoon", m),
    L("moon", m),
    L("stringStar", s),
    L("star", s),
    ...still.slice(7).map((p) => L(p)),
  ],
}));

const idle: Anim = { loop: true, frames };

export const HOUSE_MOO: Character = {
  id: "house-moo",
  name: "Moo & Moon Meadow",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Moo & Moon Meadow" on. */
export const HOUSE_MOO_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
