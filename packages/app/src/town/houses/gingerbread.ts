/**
 * Ginger Igloo: the gingerbread man's home on the town square (Eric's reference, docs/mockups/town-square/ginger-igloo.webp;
 * he loves cold things since the North Pole). A gingerbread dome seen from the front and a little above: an icing cap
 * with sprinkles, two icing bands curving round it set with gumdrops, a peppermint on top and one over the door, a
 * candy-cane arch round a dark doorway, lollipops and candy canes standing round it, snow at its foot with gumdrops in
 * it, and a blank sign board on two posts in front (the game writes "Ginger Igloo" on it). His colors
 * (characters/gingerbread.ts). Light from the top left, as the bosses'. `idle`: a snowflake or two drifts down and a
 * glint catches the top peppermint (four frames).
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../characters/sprite.ts";
import { GINGER_PALETTE } from "../../characters/gingerbread.ts";
import { grain, groundShadow, paint, signBoard, signFace, signPost, type Pt } from "./kit.ts";

const G = GINGER_PALETTE;
const PALETTE: Record<string, string> = {
  k: G.k, // outline
  d: G.d, // gingerbread, dark to light
  c: G.c,
  C: G.C,
  h: G.h,
  w: G.w, // icing and snow: white, frost-blue shade, bright
  W: G.W,
  F: G.F,
  f: G.f, // a glint
  m: "#3a1a0c", // the doorway's dark, deep and less deep
  M: "#5a2c14",
  r: G.r, // candy: red, green, yellow, blue, purple, pink, orange (mid, dark)
  R: G.R,
  g: G.g,
  G: G.G,
  y: "#ffd23f",
  Y: "#c99a12",
  I: G.I,
  J: G.J,
  p: "#9150d6",
  P: "#5a2a96",
  q: "#ff8fc0",
  Q: "#d14d8a",
  o: "#ff9a1f",
  O: "#c9661a",
  s: G.s, // candy-cane red and white (lit, shade)
  S: G.S,
  v: G.v,
  V: G.V,
  N: "#4d2813", // the sign's wood: dark to light
  T: "#7a4a22",
  A: "#a8703a",
  B: "#d09a5a",
  K: "#c9a56a", // the sign's face: shadow, board, light
  E: "#e8cc95",
  U: "#f7e4b8",
  L: "#f2c14e", // nails
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "NTAB";

const W = 144;
const H = 120;
const CX = 72;
const FOOT = 114;

/** The dome: its middle at the base line, its half-width and height. */
const BASE = 106;
const RX = 44;
const RY = 68;
const domeHalf = (Y: number) => RX * Math.sqrt(Math.max(0, 1 - ((BASE - Y) / RY) ** 2));
/** A band of icing round the dome at height Y0: from a little above, it curves down toward the middle (the near side). */
const bandY = (Y0: number, X: number) => Y0 + 3 * Math.sqrt(Math.max(0, 1 - (X / Math.max(1, domeHalf(Y0))) ** 2));
const BAND_A = 72;
const BAND_B = 91;
/** The icing cap's lower edge, scalloped. */
const capEdge = (X: number) => 50 + 2.5 * Math.sqrt(Math.max(0, 1 - (X / 30) ** 2)) + 2.2 * Math.abs(Math.sin(X * 0.42));
const SPRINKLES = ["r", "g", "y", "I", "p", "q", "o"];

// ---- The dome: gingerbread lit from the top left, an icing cap with sprinkles, two icing bands.

const dome = paint(CX - RX, BASE - RY, 2 * RX, RY + 1, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  const hw = domeHalf(Y);
  if (Math.abs(X) > hw || Y > BASE + 0.5) return null;
  const nx = X / RX;
  const ny = (BASE - Y) / RY;
  if (Y < capEdge(X)) {
    // The cap: white icing, frost-blue on its shaded side, sprinkles here and there.
    const s = grain(x, y, 11);
    if (s < 0.07) return SPRINKLES[Math.floor(s * 100) % SPRINKLES.length]!;
    return nx > 0.35 && grain(x, y, 4) < 0.6 ? "W" : nx < -0.2 && ny > 0.9 ? "F" : "w";
  }
  for (const b of [BAND_A, BAND_B]) {
    const by = bandY(b, X);
    if (Y > by - 1.2 && Y < by + 1.2 + (Math.abs(Math.sin(X * 0.5)) > 0.85 ? 1.5 : 0)) return nx > 0.4 ? "W" : "w"; // icing, dripping a little
  }
  const l = 0.5 - 0.42 * nx + 0.3 * ny - (Y > BASE - 4 ? 0.25 : 0);
  if (grain(x, y, 7) < 0.04) return "d"; // a baked speckle
  return l < 0.22 ? "d" : l < 0.45 ? "c" : l < 0.75 ? "C" : "h";
});

/** A round candy: a little ball lit from the top left. */
function ball(cx: number, cy: number, r: number, ramp: string) {
  return paint(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(2 * r) + 1, Math.ceil(2 * r) + 1, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    if (d > r) return null;
    if (dx < -r * 0.2 && dy < -r * 0.2 && d < r * 0.75 && d > r * 0.25) return "F";
    return dx + dy > r * 0.5 ? ramp[1]! : ramp[0]!;
  });
}
const RAMPS = ["rR", "gG", "yY", "IJ", "pP", "qQ", "oO"];
const dotsA = [-36, -26, -16, 16, 26, 36].map((X, i) => ball(CX + X, bandY(BAND_A, X) + 0.5, 2.6, RAMPS[i % RAMPS.length]!));
const dotsB = [-38, -30, -22, 22, 30, 38].map((X, i) => ball(CX + X, bandY(BAND_B, X) + 0.5, 2.2, RAMPS[(i + 3) % RAMPS.length]!));

/** A peppermint: a red-and-white swirl, its middle white. */
function peppermint(cx: number, cy: number, r: number) {
  return paint(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(2 * r) + 1, Math.ceil(2 * r) + 1, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    if (d > r) return null;
    if (d < r * 0.28) return "w";
    const a = Math.atan2(dy, dx) + d * 0.22;
    const red = Math.floor(((a + Math.PI * 4) / (Math.PI / 4)) % 2) === 0;
    const lit = dx + dy < 0;
    return red ? (lit ? "s" : "S") : lit ? "v" : "V";
  });
}
const mintTop = peppermint(CX, 31, 7.5);
const mintDoor = peppermint(CX, 64, 5.5);

// ---- The doorway: a candy-cane arch, red and white, round a dark way in.

const DOOR_CY = 85;
const DOOR_OUT = 14;
const DOOR_IN = 9;
const door = paint(CX - DOOR_OUT, DOOR_CY - DOOR_OUT, 2 * DOOR_OUT, FOOT - (DOOR_CY - DOOR_OUT) - 2, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  const d = Y < DOOR_CY ? Math.hypot(X, Y - DOOR_CY) : Math.abs(X);
  if (d > DOOR_OUT || Y > BASE + 4) return null;
  if (d < DOOR_IN) return Y < DOOR_CY - 3 || Math.abs(X) > DOOR_IN - 2.5 ? "m" : "M";
  const red = Math.floor((x + y) / 3) % 2 === 0;
  const lit = X < 0 || Y < DOOR_CY - 6;
  return red ? (lit ? "s" : "S") : lit ? "v" : "V";
});

// ---- Lollipops and candy canes standing round it.

/** A lollipop: a swirl of `colors` on a white stick from its disc down to the ground. */
function lollipop(cx: number, cy: number, r: number, colors: readonly string[], foot: number) {
  return paint(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(2 * r) + 1, foot - Math.floor(cy - r), (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    if (d <= r) {
      const a = Math.atan2(dy, dx);
      const i = Math.floor(((a + Math.PI) / (2 * Math.PI)) * colors.length + d * 0.38) % colors.length;
      return d > r - 1 && dx + dy > 0 ? "V" : colors[i]!;
    }
    if (Math.abs(dx) < 1 && dy > 0) return dx < 0 ? "v" : "V"; // the stick
    return null;
  });
}
const lolliRainbow = lollipop(15, 58, 9.5, ["r", "o", "y", "g", "I", "p"], FOOT - 6);
const lolliPink = lollipop(129, 50, 8.5, ["q", "v", "Q", "v"], FOOT - 8);
const lolliBlue = lollipop(117, 76, 6, ["I", "v", "J", "v"], FOOT - 4);

/** A candy cane: a striped shaft with its hook turned to one side. */
function cane(px: number, top: number, foot: number, toward: 1 | -1) {
  const hx = px + 1.5 + toward * 3.5;
  const hy = top + 5;
  return paint(Math.min(px, Math.floor(hx - 5)), top - 1, 12, foot - top + 1, (x, y) => {
    const X = x + 0.5;
    const Y = y + 0.5;
    const onShaft = X >= px && X <= px + 3 && Y >= hy;
    const d = Math.hypot(X - hx, Y - hy);
    const onHook = Y < hy && d >= 2 && d <= 5;
    const onEnd = Y >= hy && Y < hy + 3 && Math.abs(X - (hx + toward * 3.5)) < 1.5;
    if (!onShaft && !onHook && !onEnd) return null;
    const red = Math.floor((x + y) / 3) % 2 === 0;
    const lit = onShaft ? X < px + 1.5 : X < hx;
    return red ? (lit ? "s" : "S") : lit ? "v" : "V";
  });
}
const caneL = cane(26, 40, FOOT - 6, 1);
const caneR = cane(121, 82, FOOT - 3, -1);

// ---- Snow banked at its foot, gumdrops in it, a candy path to the door; the shadow under it all.

const snow = paint(4, BASE - 8, W - 8, FOOT - BASE + 8, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  const top = BASE - 3 - 3 * Math.abs(Math.sin(X * 0.21)) + (Math.abs(X) > RX ? (Math.abs(X) - RX) * 0.45 : 0);
  if (Y < top || Y > FOOT - 1 + Math.sin(X * 0.3) || Math.abs(X) > 66 - (Y - BASE) * 0.4) return null;
  if (Math.abs(X) < DOOR_IN - 1 && Y < BASE + 2) return null; // the doorway's threshold stays clear
  if (Y < top + 1.5 && X < 10) return "F";
  return X > 20 || Y > FOOT - 3 ? "W" : "w";
});
/** A gumdrop: a sugared dome. */
function gumdrop(cx: number, base: number, w: number, ramp: string) {
  const h = Math.round(w * 0.85);
  return paint(cx - Math.floor(w / 2), base - h, w, h, (x, y) => {
    const X = x + 0.5 - cx;
    const j = base - (y + 0.5);
    if (Math.abs(X) > (w / 2) * Math.sqrt(Math.max(0, 1 - (j / h) ** 2)) + 0.4) return null;
    if (X < -w * 0.15 && j > h * 0.45 && j < h * 0.8) return "F";
    return X > w * 0.15 ? ramp[1]! : ramp[0]!;
  });
}
const drops = [
  gumdrop(25, FOOT - 3, 8, "pP"),
  gumdrop(57, FOOT - 1, 6, "rR"),
  gumdrop(93, FOOT - 1, 7, "gG"),
  gumdrop(104, FOOT - 3, 8, "qQ"),
  gumdrop(130, FOOT - 3, 7, "yY"),
];
const path = (
  [
    [CX - 5, FOOT - 3, "yY"],
    [CX + 2, FOOT - 2, "rR"],
    [CX + 7, FOOT - 4, "IJ"],
    [CX - 1, FOOT - 6, "gG"],
  ] as const
).map(([x, y, r]) => ball(x, y, 1.8, r));
const shadow = groundShadow(CX, FOOT - 1.5, 66, 4.5);

// ---- The sign: a blank board on two posts at its front left. The game writes "Ginger Igloo" on its face.

const BOARD: Pt = [4, 88];
const BW = 50;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "KEU", "L");
const posts = [signPost(BOARD[0] + 5, BOARD[1] + BH - 4, FOOT, WOOD), signPost(BOARD[0] + BW - 8, BOARD[1] + BH - 4, FOOT, WOOD)];

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const order = [
  add("shadow", shadow),
  add("caneL", caneL),
  add("lolliPink", lolliPink),
  add("dome", dome),
  ...dotsA.map((p, i) => add(`dotA${i}`, p)),
  ...dotsB.map((p, i) => add(`dotB${i}`, p)),
  add("mintTop", mintTop),
  add("mintDoor", mintDoor),
  add("door", door),
  add("snow", snow),
  ...path.map((p, i) => add(`path${i}`, p)),
  add("lolliRainbow", lolliRainbow),
  add("lolliBlue", lolliBlue),
  add("caneR", caneR),
  ...drops.map((p, i) => add(`drop${i}`, p)),
  add("postL", posts[0]!),
  add("postR", posts[1]!),
  add("board", board),
];
const layers: Layer[] = order.map((part) => ({ part, x: at[part]![0], y: at[part]![1] }));

/** A snowflake: a little plus of white, its middle bright. */
const flake = (x: number, y: number): Speck[] => [
  [x, y, "F"],
  [x - 1, y, "w"],
  [x + 1, y, "w"],
  [x, y - 1, "w"],
  [x, y + 1, "w"],
];
/** A glint: a sparkle on the top peppermint. */
const glint = (x: number, y: number): Speck[] => [
  [x, y, "F"],
  [x - 1, y, "f"],
  [x + 1, y, "f"],
  [x, y - 1, "f"],
  [x, y + 1, "f"],
  [x - 2, y, "f"],
  [x + 2, y, "f"],
];
const frames: Frame[] = [0, 1, 2, 3].map((i) => ({
  ms: 260,
  layers,
  specks: [...flake(40 + (i % 2), 6 + 7 * i), ...flake(108 - (i >> 1), 14 + 7 * ((i + 2) % 4)), ...(i === 2 ? glint(CX - 3, 27) : [])],
}));

const idle: Anim = { loop: true, frames };

export const HOUSE_GINGER: Character = {
  id: "house-gingerbread",
  name: "Ginger Igloo",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Ginger Igloo" on. */
export const HOUSE_GINGER_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
