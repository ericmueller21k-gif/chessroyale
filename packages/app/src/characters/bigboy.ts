/**
 * Big Boy, the baby boss: a chubby bald baby after Eric's reference picture, redrawn. A few hair tufts on top, big ears, half-lidded eyes and big pink lips; a teal crop shirt reading
 * "BIG BOY", a light blue diaper, bare feet, and a swirly rainbow lollipop (his weapon) in his right hand, on our left.
 * Drawn facing front, light from the top left.
 *
 * Rigging: the head (one per face), the shirt, belly, diaper and feet are painted once; the arms (each with its short
 * sleeve) and legs are painted from their pose's points (a shoulder, an elbow, a hand; a hip and a foot), and the
 * lollipop from where his fist holds it and where the candy is. So a new pose is a few numbers.
 *
 * His powers' moments (characters/power-art.ts): `snack` (he waddles over to one of the crowd's centre pawns, grabs it
 * and eats it: nom, nom), `toss` (a toy block thrown at the board), `bigBounce` (on the board: three bounces with squash
 * and stretch, a giant fall, dazed, a giggle, and off again; timed to boss-timing's BOUNCE), and his reactions `lick`
 * (a slurp of the lollipop), `giggle` and `wail` (the tantrum with its wail). Idle, swing and tantrum are as approved.
 */
import { canvas, ellipse, inEllipse, inPoly, roundLight, shade, toGrid, type Canvas } from "./paint.ts";
import { BOUNCE, SNACK } from "@chessroyale/chess";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

export const BIGBOY_PALETTE: Record<string, string> = {
  k: "#2a1712", // outline
  d: "#a8603e", // skin, dark to light
  c: "#d0885c",
  C: "#eba57a",
  h: "#f8c9a2",
  b: "#9a5a35", // brows
  n: "#7a5236", // hair (a lighter brown than the reference's, so it shows on the dark ground)
  w: "#fffaf0", // eye whites
  e: "#2a1712", // pupils
  M: "#9c3a60", // lips: rim, pink, highlight, the line between them
  L: "#e7719a",
  N: "#ffb6cc",
  m: "#5c1834",
  g: "#f0587e", // tongue
  T: "#0f5c63", // the shirt: teal, dark to light
  t: "#178589",
  u: "#23a8a8",
  U: "#4fcfc6",
  r: "#ff4a50", // its letters, and their shadow
  R: "#4a0a10",
  P: "#6f8fb3", // the diaper: light blue, dark to light
  p: "#97b7d6",
  q: "#bcd4ea",
  Q: "#e2eef9",
  v: "#f7f3ea", // the lollipop's stick
  V: "#c8bfb2",
  "1": "#ff3349", // the candy's rainbow
  "2": "#ff8a1a",
  "3": "#ffe23b",
  "4": "#35c94b",
  "5": "#2e86ff",
  "6": "#a24cf5",
  F: "#ffffff",
  j: "#8fd8ff", // tears
  s: "#7d8290", // dust
  S: "#b9bcc6",
  z: "#0d0e12", // ground shadow
  x: "#f4f0e6", // his snack: a white pawn (the crowd's black one: his look `blackPawn`)
  X: "#b8b0a0",
  o: "#f5c983", // a toy block: wood, top to side; its letter's panel and the letter
  O: "#d69c52",
  D: "#9c6a2e",
  a: "#e2483f",
  Y: "#fff4d0",
  y: "#ffd84a", // dazed stars
};

/** Recolours: the crowd's pawn in his hand is black when the crowd plays Black. */
const LOOKS: Record<string, Record<string, string>> = { blackPawn: { x: "#55555f", X: "#26262e" } };

type Pt = readonly [number, number];
const SKIN = "dcCh";

// ---- Head: one face per mood.

export type Mood = "blank" | "blink" | "lick" | "yum" | "fierce" | "grin" | "pout" | "tantrum" | "chew" | "nom" | "ooh" | "squish" | "dazed" | "giggle";

/** The head's grid: 35 x 25, its middle column 17. */
const HEAD_W = 35;
const HEAD_H = 25;

/** Rows stamped onto the head's skin (`.` leaves it); `mirror` flips them for the right side. */
function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number, mirror = false): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      const x = mirror ? x0 + row.length - 1 - i : x0 + i;
      if (cv[y0 + y]?.[x] !== undefined && cv[y0 + y]![x] !== ".") cv[y0 + y]![x] = k;
    }),
  );
}

/** Left-side features (the right side is their mirror). */
const BROWS: Record<string, readonly string[]> = {
  arch: [".bbb.", "b...b"],
  angry: ["bb...", "..bbb"],
  worried: ["...bb", "bbb.."],
};
const EYES: Record<string, readonly string[]> = {
  // Half-lidded, the pupils turned in a little: his blank look in the reference.
  blank: ["kkkkkk", "kwweek", ".dddd."],
  shut: ["......", "kkkkkk", ".dddd."],
  happy: ["..kk..", ".k..k.", "k....k"],
  fierce: ["......", "kkkkkk", "kwweek"],
  squeeze: ["kk....", "..kkk.", "kk...."],
  grin: ["......", "kkkkkk", "dwweed"],
  wet: ["kkkkkk", "kwweek", ".jjjj."],
  /** Round and wide open (in the air). */
  wide: ["kkkkkk", "kweewk", "kwwwwk"],
  /** Dazed after the crash: little crosses. */
  dazed: ["kk..kk", "..kk..", "kk..kk"],
};
const MOUTHS: Record<string, { rows: readonly string[]; y: number }> = {
  // Big pink lips, a little open: the reference.
  pucker: { y: 16, rows: ["..MMM.MMM..", ".MLLLMLLLLM", "MLNNLLLLLLM", "MmmmmmmmmmM", "MLLLLLLLLLM", ".MLNNNLLLM.", "..MMMMMMM.."] },
  lick: { y: 16, rows: ["..MMM.MMM..", ".MLLLMLLLLM", "MLNNLLLLLLM", "MmmmmmmmmmM", "MgggLLLLLLM", "ggNgNNLLLM.", "gggMMMMMM.."] },
  smack: { y: 16, rows: ["...MMMMM...", "..MLNLLLM..", ".MLLLLLLLM.", "..MmmmmmM..", ".MLLLLLLLM.", "..MLNNLLM..", "...MMMMM..."] },
  tight: { y: 17, rows: ["...MMMMM...", ".MMLNLLLMM.", "MmmmmmmmmmM", ".MMLLLLLMM.", "...MMMMM..."] },
  smile: { y: 16, rows: ["M.........M", "LMMMM.MMMML", "MLNNLLLLLLM", ".MmmmmmmmM.", ".MLLLLLLLM.", "..MLNNLLM..", "...MMMMM..."] },
  wobble: { y: 16, rows: ["...........", "..MMMMMMM..", ".MLNLLLLLM.", "MmmmMMMmmmM", "MLLLLLLLLLM", ".MLNNLLLLM.", "..MMMMMMM.."] },
  wail: { y: 15, rows: ["..MMMMMMM..", ".MLNLLLLLM.", "MLmmmmmmmLM", "MmmmggggmmM", "MLmmggggmLM", ".MLNNLLLLM.", "..MMMMMMM.."] },
  /** Chewing his snack: lips pressed, puffed out. */
  chew: { y: 17, rows: ["..MMMMMMM..", ".MLLNNLLLM.", "MLLLLLLLLLM", ".MmmmmmmmM.", "..MLLLLLM..", "...MMMMM..."] },
  /** The bite: wide open, happy. */
  nom: { y: 15, rows: ["..MMMMMMM..", ".MLNLLLLLM.", "MLmmmmmmmLM", "MmmmmmmmmmM", "MLmmmmmmmLM", ".MLLNNLLLM.", "..MMMMMMM.."] },
  /** A small round "oh". */
  o: { y: 17, rows: ["...MMM...", "..MLNLM..", ".MLmmmLM.", "..MLLLM..", "...MMM..."] },
};
const FACES: Record<Mood, { brows: string; eyes: string; mouth: string }> = {
  blank: { brows: "arch", eyes: "blank", mouth: "pucker" },
  blink: { brows: "arch", eyes: "shut", mouth: "pucker" },
  lick: { brows: "arch", eyes: "happy", mouth: "lick" },
  yum: { brows: "arch", eyes: "happy", mouth: "smack" },
  fierce: { brows: "angry", eyes: "fierce", mouth: "tight" },
  grin: { brows: "arch", eyes: "grin", mouth: "smile" },
  pout: { brows: "worried", eyes: "wet", mouth: "wobble" },
  tantrum: { brows: "angry", eyes: "squeeze", mouth: "wail" },
  chew: { brows: "arch", eyes: "happy", mouth: "chew" },
  nom: { brows: "arch", eyes: "happy", mouth: "nom" },
  ooh: { brows: "arch", eyes: "wide", mouth: "o" },
  squish: { brows: "arch", eyes: "squeeze", mouth: "smile" },
  dazed: { brows: "worried", eyes: "dazed", mouth: "o" },
  giggle: { brows: "arch", eyes: "happy", mouth: "smile" },
};

function head(mood: Mood): Part {
  const cv = canvas(HEAD_W, HEAD_H);
  const skull = inEllipse(17.5, 11.9, 13, 11.6);
  const cheeks = inEllipse(17.5, 16.6, 14, 7.6);
  const ears = [inEllipse(3.3, 13, 3.4, 4.6), inEllipse(31.7, 13, 3.4, 4.6)];
  const isHead = (x: number, y: number) => skull(x, y) || cheeks(x, y);
  // The ears first, then the head over them; the ears darker where they meet it, with a curl inside.
  shade(cv, (x, y) => ears.some((e) => e(x, y)), SKIN, (x, y) => (x < 17 ? 0.75 - 0.05 * y : 0.45 - 0.04 * y + 0.2));
  shade(cv, isHead, SKIN, roundLight(16.5, 11, 14.5, 12.5, 0.12));
  for (let y = 0; y < HEAD_H; y++)
    for (let x = 0; x < HEAD_W; x++) if (!isHead(x, y) && cv[y]![x] !== "." && (isHead(x + 1, y) || isHead(x - 1, y))) cv[y]![x] = "d";
  stamp(cv, [".dd", "d..", ".d.", "..d"], 1, 11);
  stamp(cv, ["dd.", "..d", ".d.", "d.."], 31, 11);
  const f = FACES[mood];
  stamp(cv, BROWS[f.brows]!, 9, 7);
  stamp(cv, BROWS[f.brows]!, 21, 7, true);
  stamp(cv, EYES[f.eyes]!, 9, 9);
  stamp(cv, EYES[f.eyes]!, 20, 9, true);
  // A small round nose with its nostrils.
  stamp(cv, [".cCh.", "dc.cd"], 15, 13);
  const mouth = MOUTHS[f.mouth]!;
  stamp(cv, mouth.rows, 17 - Math.floor(mouth.rows[0]!.length / 2), mouth.y);
  // A soft double chin.
  stamp(cv, ["c.....c", ".ccccc."], 14, 23);
  return { grid: toGrid(cv) };
}

/** A few thin tufts on top: behind the head, so its outline closes them off at the scalp. */
const hair: Part = {
  outline: false,
  grid: [
    "......n....", //
    "..n...n..n.",
    ".n....n...n",
    ".n...n...n.",
    "..n..n...n.",
    "..n..n..n..",
    "...n.n..n..",
  ],
};

// ---- Shirt, belly, diaper, feet.

/** The shirt's letters, 4 x 5 (the I and the Y 3 wide), a pixel apart. */
const GLYPHS: Record<string, readonly string[]> = {
  B: ["###.", "#..#", "###.", "#..#", "###."],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  G: [".###", "#...", "#.##", "#..#", ".###"],
  O: [".##.", "#..#", "#..#", "#..#", ".##."],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
};
function word(cv: Canvas, text: string, cx: number, y0: number): void {
  const w = [...text].reduce((s, ch) => s + GLYPHS[ch]![0]!.length + 1, -1);
  let x = Math.round(cx - w / 2);
  const ink: Pt[] = [];
  for (const ch of text) {
    const g = GLYPHS[ch]!;
    g.forEach((row, y) => [...row].forEach((p, i) => p === "#" && ink.push([x + i, y0 + y])));
    x += g[0]!.length + 1;
  }
  // A dark red drop shadow, down and to the right: red and teal are about as light as each other, so without it the
  // letters blur into the shirt at phone size.
  for (const [px, py] of ink) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]] as const) if (cv[py + dy]?.[px + dx] && cv[py + dy]![px + dx] !== ".") cv[py + dy]![px + dx] = "R";
  for (const [px, py] of ink) cv[py]![px] = "r";
}

/** The shirt's grid: 29 x 16, at (20, 26) in his drawing space (its top two rows under his chin). */
function shirt(): Part {
  const cv = canvas(29, 16);
  const outline: Pt[] = [[4, 0], [25, 0], [28.6, 3], [28.4, 15.6], [0.6, 15.6], [0.4, 3]];
  shade(cv, inPoly(outline), "TtuU", (x, y) => 0.95 - 0.022 * x - 0.03 * y);
  // Folds from the armpits.
  for (const [x, y] of [[3, 9], [4, 10], [4, 11], [25, 9], [24, 10], [24, 11]] as const) cv[y]![x] = "T";
  // The neckline (mostly under his chin).
  for (let x = 9; x <= 19; x++) cv[0]![x] = x < 14 ? "u" : "t";
  word(cv, "BIG", 14.5, 3);
  word(cv, "BOY", 14.5, 9);
  return { grid: toGrid(cv) };
}

/** His belly between the shirt and the diaper, with a navel. */
function belly(): Part {
  const cv = canvas(25, 10);
  shade(cv, inEllipse(12.5, 4.5, 12.5, 5.2), SKIN, (x, y) => 1.05 - 0.025 * x - 0.03 * y);
  cv[6]![12] = "d";
  return { grid: toGrid(cv) };
}

/** The diaper: 29 x 13, at (20, 45). Tabs at the sides, a waistband, folds at the legs. */
function diaper(): Part {
  const cv = canvas(29, 13);
  const outline: Pt[] = [[0.6, 0], [28.4, 0], [28.8, 6], [25, 9.5], [19.6, 12.6], [9.4, 12.6], [4, 9.5], [0.2, 6]];
  shade(cv, inPoly(outline), "PpqQ", (x, y) => 0.78 - 0.018 * x - 0.03 * y + (y === 0 ? 0.25 : 0));
  // The tabs.
  for (const x0 of [1, 25]) for (let y = 2; y <= 3; y++) for (let x = x0; x < x0 + 3; x++) cv[y]![x] = x === x0 + 2 || y === 3 ? "q" : "Q";
  // Folds where his legs come out.
  for (const [x, y] of [[6, 8], [7, 9], [8, 10], [22, 8], [21, 9], [20, 10], [14, 9], [14, 10], [14, 11]] as const) cv[y]![x] = "P";
  return { grid: toGrid(cv) };
}

/** A bare foot, 10 x 5, toes along the front; `side` -1 his right (on our left). */
function foot(side: -1 | 1): Part {
  const cv = canvas(10, 5);
  shade(cv, inEllipse(5, 2.6, 5, 2.6), SKIN, roundLight(4.5, 2, 5, 2.6, 0.08));
  // The toes: little gaps along the front, the big toe on the inside.
  const toes = side === -1 ? [3, 5, 7] : [2, 4, 6];
  for (const x of toes) cv[4]![x] = "d";
  for (const x of toes) cv[3]![x] = "c";
  return { grid: toGrid(cv) };
}

function shadow(): Part {
  const cv = canvas(34, 3);
  ellipse(cv, 17, 1.5, 17, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
}

// ---- Limbs: a thick round stroke along a few points, shaded like a cylinder; an arm starts with its sleeve.

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}

interface Box {
  x0: number;
  y0: number;
  w: number;
  h: number;
}
function boxOf(pts: readonly Pt[], pad: number): Box {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  return { x0, y0, w: Math.ceil(Math.max(...xs)) + pad - x0 + 1, h: Math.ceil(Math.max(...ys)) + pad - y0 + 1 };
}

/** A limb along `pts`, `r` thick, its end `endR` round (a fist, a hand); the first `sleeve` pixels are his shirt. */
function paintLimb(pts: readonly Pt[], r: number, endR: number, sleeve: number): Part {
  const sr = r + 0.9;
  const b = boxOf(pts, Math.ceil(Math.max(sr, endR)) + 1);
  const cv = canvas(b.w, b.h);
  const end = pts[pts.length - 1]!;
  const segLen = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const p: Pt = [b.x0 + x + 0.5, b.y0 + y + 0.5];
      let best = { d: Infinity, nx: 0, ny: 0, fromStart: 0 };
      for (let i = 0; i + 1 < pts.length; i++) {
        const n = nearest(p, pts[i]!, pts[i + 1]!);
        if (n.d < best.d) best = { d: n.d, nx: n.nx, ny: n.ny, fromStart: segLen.slice(0, i).reduce((s, l) => s + l, 0) + n.t * segLen[i]! };
      }
      const inSleeve = best.fromStart < sleeve && best.d <= sr;
      const de = Math.hypot(p[0] - end[0], p[1] - end[1]);
      const inLimb = best.d <= r;
      const inEnd = de <= endR;
      if (!inSleeve && !inLimb && !inEnd) continue;
      const [nx, ny, rr] = inEnd && de < best.d + 0.8 ? [p[0] - end[0], p[1] - end[1], endR] : [best.nx, best.ny, inSleeve ? sr : r];
      const light = 0.62 - 0.42 * (nx / rr) - 0.5 * (ny / rr);
      const ramp = inSleeve ? "TtuU" : SKIN;
      cv[y]![x] = ramp[Math.max(0, Math.min(3, Math.floor(light * 4)))]!;
    }
  return { grid: toGrid(cv) };
}

// ---- The lollipop: a swirl of rainbow on a stick.

const CANDY_R = 8.5;
/** The candy, its swirl turned by `spin` sixths of a turn (the colours wind round it, outward). */
function candy(spin: number): Part {
  const S = 18;
  const c = S / 2;
  const cv = canvas(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy);
      if (r > CANDY_R) continue;
      const a = Math.atan2(dy, dx) / (2 * Math.PI);
      const v = a + r / 9.5 + spin / 6;
      cv[y]![x] = "123456"[(((Math.floor(v * 6) % 6) + 6) % 6)]!;
    }
  // A glint up on the left.
  for (const [x, y] of [[4, 5], [5, 4], [4, 6], [6, 3]] as const) cv[y]![x] = "F";
  return { grid: toGrid(cv) };
}

/** The stick from below his fist up into the candy, 2 pixels wide, lit on its left. */
function stick(from: Pt, to: Pt): Part {
  const b = boxOf([from, to], 2);
  const cv = canvas(b.w, b.h);
  const ux = (to[0] - from[0]) / (Math.hypot(to[0] - from[0], to[1] - from[1]) || 1);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const p: Pt = [b.x0 + x + 0.5, b.y0 + y + 0.5];
      const n = nearest(p, from, to);
      if (n.d > 1.05) continue;
      cv[y]![x] = n.nx * (1 - Math.abs(ux)) - n.ny * ux < 0 ? "v" : "V";
    }
  return { grid: toGrid(cv) };
}

// ---- Parts and poses.

// Every part is painted the first time a frame that uses it shows (sprite.ts lazyParts), so he costs nothing at load.
const { parts: PARTS, add } = lazyParts();
add("hair", () => hair);
add("shirt", shirt);
add("belly", belly);
add("diaper", diaper);
add("shadow", shadow);
add("footL", () => foot(-1));
add("footR", () => foot(1));
const MOODS: readonly Mood[] = ["blank", "blink", "lick", "yum", "fierce", "grin", "pout", "tantrum", "chew", "nom", "ooh", "squish", "dazed", "giggle"];
for (const m of MOODS) add(`head:${m}`, () => head(m));
for (let s = 0; s < 12; s++) add(`candy:${s}`, () => candy(s / 2));
/** His snack: a little pawn of the crowd's (white; his look `blackPawn` makes it the crowd's black), whole, then bitten. */
add("pawn", () => ({ grid: ["..xx..", ".xxxX.", ".xxxX.", "..xX..", ".xxxX.", "xxxxXX", "XXXXXX"] }));
add("pawn:bit", () => ({ grid: ["......", "......", ".x.xX.", "..xX..", ".xxxX.", "xxxxXX", "XXXXXX"] }));
add("pawn:crumb", () => ({ grid: ["xxX.", "xXXX"] }));
/** A toy block in his hand (the board's own, characters/effects.ts toyBlock, is bigger): wood, a red panel, a letter. */
add("block", () => ({ grid: [".ooooo..", "ooooooo.", "OOOOOOOD", "OaYYaaOD", "OaYaYaOD", "OaYYaaOD", "OaaaaaOD", "OOOOOOD."] }));

const r1 = (v: number) => Math.round(v * 2) / 2;
function limb(kind: "arm" | "leg", pts: readonly Pt[]): { name: string; at: Pt } {
  const q = pts.map((p): Pt => [r1(p[0]), r1(p[1])]);
  const name = `${kind}:${q.map((p) => p.join(",")).join(";")}`;
  const [r, endR, sleeve] = kind === "arm" ? [2.6, 3.2, 4] : [4.2, 4.2, 0];
  add(name, () => paintLimb(q, r, endR, sleeve));
  const b = boxOf(q, Math.ceil(Math.max(r + 0.9, endR)) + 1);
  return { name, at: [b.x0, b.y0] };
}
function stickPart(from: Pt, to: Pt): { name: string; at: Pt } {
  const a: Pt = [r1(from[0]), r1(from[1])];
  const b: Pt = [r1(to[0]), r1(to[1])];
  const name = `stick:${a.join(",")};${b.join(",")}`;
  add(name, () => stick(a, b));
  const box = boxOf([a, b], 2);
  return { name, at: [box.x0, box.y0] };
}

const SHOULDER_L: Pt = [23.5, 30];
const SHOULDER_R: Pt = [44.5, 30];

/** Where the lollipop arm (his right, on our left) holds it: its elbow and fist, and the candy's middle. */
export type Lolly = "hold" | "toward" | "lick" | "lickUp" | "up" | "waveL" | "waveR" | "windup" | "swing" | "smash" | "shakeUp" | "shakeDown" | "splat";
const LOLLY: Record<Lolly, { elbow: Pt; fist: Pt; candy: Pt; behind?: boolean }> = {
  hold: { elbow: [17, 37], fist: [11.5, 34.5], candy: [10, 21] },
  toward: { elbow: [16, 39], fist: [15.5, 35], candy: [16.5, 22.5] },
  lick: { elbow: [16.5, 40.5], fist: [19.5, 37.5], candy: [20.5, 25] },
  lickUp: { elbow: [16.5, 40], fist: [19.5, 36.5], candy: [20.5, 24] },
  up: { elbow: [16, 26], fist: [14, 19], candy: [12.5, 6] },
  waveL: { elbow: [16, 26], fist: [13.5, 19], candy: [9, 7] },
  waveR: { elbow: [16, 26], fist: [14.5, 19], candy: [17, 6.5] },
  /** Pulled back behind his head (no higher than when he waves it: on a phone the bar's heading is just above). */
  windup: { elbow: [18, 21], fist: [21, 13], candy: [22, 6], behind: true },
  swing: { elbow: [16, 31], fist: [10, 28], candy: [1, 20] },
  smash: { elbow: [18, 41], fist: [16, 46], candy: [9.5, 55.5] },
  shakeUp: { elbow: [16, 31], fist: [11, 26], candy: [9.5, 13] },
  shakeDown: { elbow: [17, 39], fist: [12, 38], candy: [10.5, 25] },
  /** Flung out low to his side as he crashes down (squashed: kept inside his frame). */
  splat: { elbow: [16, 37], fist: [11, 41], candy: [5.5, 49.5] },
};

/** His free arm (his left, on our right). */
export type Free = "hang" | "out" | "fist" | "pump" | "up" | "reach" | "mouth" | "hold" | "back" | "throw";
const FREE: Record<Free, Pt[]> = {
  hang: [SHOULDER_R, [48.5, 37.5], [49.5, 45]],
  out: [SHOULDER_R, [50.5, 33], [55, 30.5]],
  fist: [SHOULDER_R, [50, 30], [51, 22.5]],
  pump: [SHOULDER_R, [49.5, 36.5], [52, 42]],
  /** Up high (in the air, both arms up). */
  up: [SHOULDER_R, [50, 24], [51.5, 15.5]],
  /** Down to his side, reaching for something on the ground (his snack). */
  reach: [SHOULDER_R, [50.5, 39], [54, 47]],
  /** His hand at his mouth (eating; giggling behind it). */
  mouth: [SHOULDER_R, [48.5, 35], [38, 25.5]],
  /** Up by his ear, holding something (the pawn on its way, a block before the throw). */
  hold: [SHOULDER_R, [51, 27.5], [51.5, 19.5]],
  /** Wound back over his shoulder (the throw's wind-up): the arm drawn behind him, what it holds up over his head. */
  back: [SHOULDER_R, [52.5, 25], [50, 13]],
  /** Thrown out towards the board (on our right). */
  throw: [SHOULDER_R, [51.5, 31], [55.5, 33.5]],
};
/** What his free hand holds, drawn at it: the pawn (whole or bitten), or a toy block. */
export type InHand = "pawn" | "pawn:bit" | "block";

export type Feet = "stand" | "rockL" | "rockR" | "liftL" | "liftR" | "wide" | "tuck" | "together";
const FEET: Record<Feet, [Pt, Pt]> = {
  /** Planted wide (a landing's squash). */
  wide: [[23.5, 63], [44.5, 63]],
  /** Knees pulled up (in the air). */
  tuck: [[28, 59], [40, 59]],
  /** Legs straight down, feet together (the stretch). */
  together: [[29.5, 64], [38.5, 64]],
  stand: [[26.5, 63], [41.5, 63]],
  /** Rocking onto his left foot (on our right) or his right: the other heel up a pixel. */
  rockL: [[26.5, 62], [41.5, 63]],
  rockR: [[26.5, 63], [41.5, 62]],
  liftL: [[25.5, 58], [41.5, 63]],
  liftR: [[26.5, 63], [42.5, 58]],
};

/** Where his own drawing space (the ground at y 66) sits on the frame: room above and to the left for the lollipop. */
const OX = 16;
const OY = 20;
const GROUND = 66;

export interface BigBoyPose {
  /** Down at the knees, feet planted: head, body and arms down a pixel or two. */
  bob?: number;
  /** Head, body and arms sideways (a toddler's wobble); the feet stay put. */
  sway?: number;
  /** The head a little further. */
  headDx?: number;
  headDy?: number;
  mood?: Mood;
  lolly?: Lolly;
  /** The candy's swirl turned (0-11, half-sixths of a turn). */
  spin?: number;
  free?: Free;
  feet?: Feet;
  /** Something in his free hand. */
  holding?: InHand;
  /** No ground shadow under him (in the air on the board: the board has its own shadow for him). */
  noShadow?: boolean;
}

export function bigBoyLayers(p: BigBoyPose): Layer[] {
  const bob = p.bob ?? 0;
  const sway = p.sway ?? 0;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX + x, y: OY + y });
  const L = (l: { name: string; at: Pt }) => at(l.name, l.at[0], l.at[1]);
  const up = (q: Pt): Pt => [q[0] + sway, q[1] + bob];
  const [fl, fr] = FEET[p.feet ?? "stand"];
  const legL = limb("leg", [up([29.5, 52]), [fl[0] + 1, fl[1] - 1]]);
  const legR = limb("leg", [up([38.5, 52]), [fr[0] - 1, fr[1] - 1]]);
  const lo = LOLLY[p.lolly ?? "hold"];
  const fist = up(lo.fist);
  const candyAt = up(lo.candy);
  const arm = limb("arm", [up(SHOULDER_L), up(lo.elbow), fist]);
  const freePts = FREE[p.free ?? "hang"].map(up);
  const free = limb("arm", freePts);
  const hand = freePts[freePts.length - 1]!;
  // (The pawn stands on his palm, the block sits in it; at his mouth the pawn is up at his lips.)
  const held: Layer[] = !p.holding
    ? []
    : p.holding === "block"
      ? [at("block", Math.round(hand[0] - 3), Math.round(hand[1] - 7))]
      : p.free === "mouth"
        ? [at(p.holding, Math.round(hand[0] - 5), Math.round(hand[1] - 8))]
        : [at(p.holding, Math.round(hand[0] - 2), Math.round(hand[1] - 8))];
  const behindFree = p.free === "back";
  // The stick runs from the candy's middle through his fist and a little past it.
  const vx = fist[0] - candyAt[0];
  const vy = fist[1] - candyAt[1];
  const vl = Math.hypot(vx, vy) || 1;
  const stk = stickPart(candyAt, [fist[0] + (vx / vl) * 4.5, fist[1] + (vy / vl) * 4.5]);
  const cnd = at(`candy:${((p.spin ?? 0) % 12 + 12) % 12}`, Math.round(candyAt[0] - 9), Math.round(candyAt[1] - 9));
  const lolly = [L(stk), L(arm), cnd];
  return [
    ...(p.noShadow ? [] : [at("shadow", 17, GROUND - 2)]),
    // Wound up behind his head: the lollipop and that arm go behind him (his free arm too, for a throw's wind-up).
    ...(lo.behind ? [L(stk), cnd, L(arm)] : []),
    ...(behindFree ? [L(free)] : []),
    L(legL),
    L(legR),
    at("footL", fl[0] - 5, fl[1] - 2),
    at("footR", fr[0] - 5, fr[1] - 2),
    at("belly", 22 + sway, 37 + bob),
    at("diaper", 20 + sway, 45 + bob),
    at("shirt", 20 + sway, 26 + bob),
    at("hair", 29 + sway + (p.headDx ?? 0), -3 + bob + (p.headDy ?? 0)),
    at(`head:${p.mood ?? "blank"}`, 17 + sway + (p.headDx ?? 0), 3 + bob + (p.headDy ?? 0)),
    ...(behindFree ? held : [L(free), ...held]),
    ...(lo.behind ? [] : lolly),
  ];
}

// ---- Animations.

const f = (ms: number, p: BigBoyPose, extra: Partial<Frame> = {}): Frame => ({ ms, layers: bigBoyLayers(p), ...extra });

/** A four-point star (an impact, a sparkle): a white core and coloured rays. */
const star = (x: number, y: number, k = "3", big = false): Speck[] => [
  [x, y, "F"],
  [x - 1, y, k],
  [x + 1, y, k],
  [x, y - 1, k],
  [x, y + 1, k],
  ...(big ? ([[x - 2, y, k], [x + 2, y, k], [x, y - 2, k], [x, y + 2, k]] as Speck[]) : []),
];
/** Dust kicked up by a stomp at a foot (frame pixels), `t` frames on. */
const dust = ([x, y]: Pt, t: number): Speck[] =>
  [[-1, 0], [1, 0], [-1.6, -0.5], [1.6, -0.5]].flatMap(([vx, vy]): Speck[] => [[Math.round(x + vx! * (3 + t * 2)), Math.round(y + vy! * (1 + t)), "s"]]);
/** Tears flying off his face, `t` frames on. */
const tears = (t: number, hx = 0, hy = 0): Speck[] =>
  [[-1, -0.6], [1, -0.6], [-1.4, 0], [1.4, 0]].flatMap(([vx, vy], i): Speck[] => {
    const x0 = OX + 17 + (vx! < 0 ? 9 : 25) + hx;
    const y0 = OY + 3 + 12 + hy;
    const k = (t + i) % 3;
    return [[Math.round(x0 + vx! * (2 + k * 2)), Math.round(y0 + vy! * (2 + k * 2) + k * k * 0.5), i % 2 ? "j" : "F"]];
  });
/**
 * The swing's rainbow trail: an arc round his shoulder (drawing space) between two angles (degrees, 0 to our right,
 * negative up), six one-pixel bands red on the outside to purple inside, thinning to dots towards its start.
 */
function rainbowArc(c: Pt, r: number, from: number, to: number): Speck[] {
  const out: Speck[] = [];
  const seen = new Set<string>();
  for (let a = from; a >= to; a -= 1.5) {
    const t = (from - a) / (from - to); // 0 at the start, 1 at the candy
    for (let band = 0; band < 6; band++) {
      if (t < 0.35 && (Math.round(a / 1.5) + band) % 3 !== 0) continue;
      const rr = r + 2.5 - band;
      const x = Math.round(c[0] + Math.cos((a * Math.PI) / 180) * rr);
      const y = Math.round(c[1] + Math.sin((a * Math.PI) / 180) * rr);
      if (seen.has(`${x},${y}`)) continue;
      seen.add(`${x},${y}`);
      out.push([OX + x, OY + y, "123456"[band]!]);
    }
  }
  return out;
}
/** The face goes red in a tantrum. */
const RED: Record<string, string> = { c: "#d9705a", C: "#ef8f78", h: "#f9b39c" };

/** The toddler's wobble: side to side, dipping at the knees as his weight shifts. */
const WOBBLE: readonly BigBoyPose[] = [
  { sway: 0 },
  { sway: -1, headDx: -1, feet: "rockR" },
  { sway: -1, headDx: -1, bob: 1, feet: "rockR" },
  { sway: 0, bob: 1 },
  { sway: 0 },
  { sway: 1, headDx: 1, feet: "rockL" },
  { sway: 1, headDx: 1, bob: 1, feet: "rockL" },
  { sway: 0, bob: 1 },
];

/**
 * Idle: he wobbles on his feet, blinks, licks his lollipop (twice, then smacks his lips), and waves it, its swirl
 * spinning. Silent.
 */
const idle: Anim = {
  loop: true,
  frames: [
    ...WOBBLE.map((p) => f(140, p)),
    ...WOBBLE.map((p, i) => f(i === 4 ? 110 : 140, { ...p, mood: i === 4 ? "blink" : "blank" })),
    f(130, { lolly: "toward" }),
    f(150, { lolly: "lick", mood: "lick" }),
    f(130, { lolly: "lickUp", mood: "lick", bob: 1 }),
    f(150, { lolly: "lick", mood: "lick" }),
    f(130, { lolly: "lickUp", mood: "lick", bob: 1 }),
    f(170, { lolly: "toward", mood: "yum" }),
    f(170, { mood: "yum" }),
    ...WOBBLE.map((p, i) => f(i === 2 ? 110 : 140, { ...p, mood: i === 2 ? "blink" : "blank" })),
    f(90, { lolly: "shakeUp", mood: "grin" }),
    f(120, { lolly: "up", mood: "grin" }),
    f(120, { lolly: "waveL", mood: "grin", spin: 2, sway: -1 }),
    f(120, { lolly: "waveR", mood: "grin", spin: 4, sway: 1, headDx: 1 }),
    f(120, { lolly: "waveL", mood: "grin", spin: 6, sway: -1 }),
    f(120, { lolly: "waveR", mood: "grin", spin: 8, sway: 1, headDx: 1 }),
    f(130, { lolly: "up", mood: "grin", spin: 10 }),
    f(90, { lolly: "shakeUp", mood: "grin", spin: 11 }),
    f(160, { mood: "blank" }),
  ],
};

/**
 * Lollipop swing: he raises it, pulls it back behind his head and chops it down at his side, BONK (a rainbow trail
 * behind it), then holds it up, pleased. It never goes higher than his wave, so on a phone it stays under the bar's
 * heading.
 */
const swing: Anim = {
  loop: false,
  frames: [
    f(100, { mood: "fierce", bob: 1 }),
    f(110, { mood: "fierce", lolly: "up", free: "out" }),
    f(150, { mood: "fierce", lolly: "windup", free: "out", sway: 1, headDx: 1, spin: 3 }),
    f(60, { mood: "fierce", lolly: "swing", free: "out", sway: -1, spin: 6 }, { cue: "swing", specks: rainbowArc([SHOULDER_L[0] - 1, SHOULDER_L[1]], 25, -78, -148) }),
    f(90, { mood: "fierce", lolly: "smash", free: "out", bob: 2, sway: -1, spin: 8 }, { cue: "bonk", shake: [0, 1], specks: [...star(OX + 6, OY + 61, "3", true), ...star(OX + 14, OY + 62, "1")] }),
    f(120, { mood: "fierce", lolly: "smash", free: "out", bob: 2, sway: -1, spin: 8 }, { specks: [...star(OX + 4, OY + 58, "5"), ...star(OX + 16, OY + 59, "3")] }),
    f(110, { mood: "grin", lolly: "shakeDown", bob: 1 }),
    f(150, { mood: "grin", lolly: "up", spin: 2 }),
    f(150, { mood: "grin", lolly: "up", spin: 4, bob: 1 }),
    f(200, { mood: "grin" }),
  ],
};

/** Where his feet land, in frame pixels (for the dust). */
const FOOT_L: Pt = [OX + 26, OY + GROUND - 1];
const FOOT_R: Pt = [OX + 42, OY + GROUND - 1];
/** Tantrum: his lip wobbles, then he goes red and stomps, left, right, left, right, shaking the lollipop, wailing. */
const tantrum: Anim = {
  loop: false,
  frames: [
    f(140, { mood: "pout" }),
    f(120, { mood: "pout", bob: 1 }),
    ...[0, 1].flatMap((n) => [
      f(90, { mood: "tantrum", feet: "liftL", lolly: "shakeUp", free: "fist", headDy: -1 }, { pal: RED, specks: tears(n * 4) }),
      f(90, { mood: "tantrum", lolly: "shakeDown", free: "pump", bob: 1 }, { pal: RED, cue: "stomp", shake: [0, 1], specks: [...dust(FOOT_L, 0), ...tears(n * 4 + 1)] }),
      f(90, { mood: "tantrum", feet: "liftR", lolly: "shakeUp", free: "fist", headDy: -1 }, { pal: RED, specks: [...dust(FOOT_L, 1), ...tears(n * 4 + 2)] }),
      f(90, { mood: "tantrum", lolly: "shakeDown", free: "pump", bob: 1 }, { pal: RED, cue: "stomp", shake: [0, 1], specks: [...dust(FOOT_R, 0), ...tears(n * 4 + 3)] }),
    ]),
    f(120, { mood: "tantrum", bob: 1 }, { pal: RED, specks: dust(FOOT_R, 1) }),
    f(160, { mood: "pout" }),
    f(200, { mood: "pout", bob: 1 }),
    f(200, { mood: "blank" }),
  ],
};

// ---- His powers' moments and his reactions (everything above stays as approved).

/** A step of his waddle: weight on one foot, the other lifted, swaying. */
const WADDLE: readonly BigBoyPose[] = [
  { feet: "liftL", sway: -1, headDx: -1 },
  { feet: "stand", bob: 1 },
  { feet: "liftR", sway: 1, headDx: 1 },
  { feet: "stand", bob: 1 },
];
/** Crumbs off his snack, `t` frames on. */
const crumbs = (t: number): Speck[] =>
  [[-1, 0.4], [1, 0.2], [-0.6, 1], [0.8, 1.1]].map(([vx, vy], i): Speck => [Math.round(OX + 38 + vx! * (2 + t * 2)), Math.round(OY + 26 + vy! * (1 + t * 2) + t * t * 0.4), i % 2 ? "x" : "X"]);

/**
 * His snack, before move 1 (SNACK in boss-timing.ts: the board moves him; this is his part): he waddles over (to
 * `grabAt`), reaches down and grabs the crowd's pawn, lifts it to his mouth and bites it twice (a `nom` cue at
 * `nomAt` and one after), smacks his lips and waddles back.
 */
const snackFrames = (): Frame[] => {
  const walk = (n: number, ms: number) => Array.from({ length: n }, (_, i) => f(ms, { ...WADDLE[i % 4]!, mood: "grin" }));
  const frames: Frame[] = [
    ...walk(8, SNACK.walkMs / 8),
    f(150, { free: "reach", bob: 2, mood: "ooh" }),
    f(150, { free: "hold", holding: "pawn", mood: "grin" }),
    f(SNACK.nomAt - SNACK.grabAt - 300, { free: "mouth", holding: "pawn", mood: "nom" }),
    f(200, { free: "mouth", holding: "pawn:bit", mood: "chew", bob: 1 }, { cue: "nom", specks: crumbs(0) }),
    f(200, { free: "mouth", holding: "pawn:bit", mood: "nom" }, { specks: crumbs(1) }),
    f(200, { free: "mouth", mood: "chew", bob: 1 }, { cue: "nom", specks: crumbs(0) }),
    f(150, { free: "pump", mood: "chew" }, { specks: crumbs(2) }),
    f(200, { free: "pump", mood: "yum", bob: 1 }),
  ];
  const used = frames.reduce((t, x) => t + x.ms, 0);
  const back = Math.max(4, Math.round((SNACK.ms - used) / 150));
  return [...frames, ...Array.from({ length: back }, (_, i) => f((SNACK.ms - used) / back, { ...WADDLE[i % 4]!, mood: "yum" }))];
};
const snack: Anim = { loop: false, frames: snackFrames() };

/** Toy block toss (his passive): he pulls out a block, winds up behind his head and throws it (`toss`: it leaves his hand). */
const toss: Anim = {
  loop: false,
  frames: [
    f(140, { free: "hold", holding: "block", mood: "grin" }),
    f(170, { free: "back", holding: "block", mood: "fierce", sway: 1, headDx: 1 }),
    f(80, { free: "throw", mood: "fierce", sway: -1 }, { cue: "toss" }),
    f(160, { free: "throw", mood: "grin", sway: -1 }),
    f(160, { free: "out", mood: "grin" }),
    f(200, { mood: "grin" }),
  ],
};

/** A slurp of his lollipop (his move). */
const lick: Anim = {
  loop: false,
  frames: [
    f(110, { lolly: "toward" }),
    f(160, { lolly: "lick", mood: "lick" }, { cue: "slurp" }),
    f(130, { lolly: "lickUp", mood: "lick", bob: 1 }),
    f(160, { lolly: "lick", mood: "lick" }),
    f(180, { lolly: "toward", mood: "yum" }),
    f(160, { mood: "yum" }),
  ],
};

/** A giggle behind his hand, shoulders bobbing. */
const giggle: Anim = {
  loop: false,
  frames: [
    f(120, { free: "mouth", mood: "giggle" }, { cue: "giggle" }),
    ...[0, 1, 2, 3, 4].map((i) => f(110, { free: "mouth", mood: "giggle", bob: i % 2, headDy: i % 2 ? 1 : 0, sway: i % 2 ? 1 : 0 })),
    f(160, { mood: "grin" }),
    f(160, { mood: "grin", bob: 1 }),
  ],
};

/** The tantrum as approved, with its wail as he goes red. */
const wail: Anim = { loop: false, frames: tantrum.frames.map((fr, i) => (i === 2 ? { ...fr, cue: "wail" } : fr)) };

/** Dazed stars circling his head, `t` steps round. */
const stars = (t: number, bob: number): Speck[] =>
  [0, 1, 2].flatMap((k) => {
    const a = ((t * 50 + k * 120) * Math.PI) / 180;
    return star(Math.round(OX + 34 + Math.cos(a) * 15), Math.round(OY + 1 + bob + Math.sin(a) * 4), "y");
  });
/** The crash's dust round his feet, `t` frames on. */
const crashDust = (t: number): Speck[] =>
  Array.from({ length: 12 }, (_, i): Speck[] => {
    const side = i % 2 ? 1 : -1;
    const d = (i % 6) * 2 + t * 3;
    const x = Math.round(OX + 34 + side * (12 + d));
    // (Inside his frame: the board's own crash throws the dust further.)
    return x < 1 || x > OX + 60 ? [] : [[x, Math.round(OY + GROUND - 1 - (i % 3) - t), i % 3 ? "s" : "S"]];
  }).flat();

/** The bounce's poses: a crouch, the stretch up (or down, falling), tucked in the air, the squash as he lands. */
const CROUCH: BigBoyPose = { bob: 2, feet: "wide", free: "out", mood: "grin", noShadow: true };
const STRETCH: BigBoyPose = { bob: -3, feet: "together", lolly: "up", free: "up", mood: "ooh", noShadow: true };
const AIR: BigBoyPose = { bob: -1, feet: "tuck", lolly: "up", free: "up", mood: "grin", noShadow: true };
const SQUASH: BigBoyPose = { bob: 4, feet: "wide", lolly: "swing", free: "out", mood: "squish", noShadow: true };

/**
 * The Big Bounce, on the board (from BOUNCE.leapAt to its end; the board moves him from spot to spot): a crouch and a
 * leap; three landings (each a squash with its `boing`, a stretch up, a tuck through the air, a stretch down to land);
 * a deep crouch and the big spring up (`whoosh`), falling arms and legs out; the giant crash (`crash`: flat, dust);
 * dazed, stars round his head; a giggle (`giggle`) as the pieces settle; a crouch and a spring off (`boing`).
 */
function bounceFrames(): Frame[] {
  const L = BOUNCE.leapAt;
  const lands = BOUNCE.lands.map((x) => x - L);
  const crash = BOUNCE.crashAt - L;
  const back = BOUNCE.backAt - L;
  const end = BOUNCE.total - L;
  const out: Frame[] = [];
  let t = 0;
  const to = (until: number, p: BigBoyPose, extra: Partial<Frame> = {}) => {
    const ms = Math.round(until - t);
    if (ms <= 0) return;
    out.push(f(ms, p, extra));
    t += ms;
  };
  to(90, CROUCH);
  to(200, STRETCH);
  for (const [i, land] of lands.entries()) {
    to(land - 100, AIR);
    to(land, { ...STRETCH, mood: "grin" });
    to(land + 100, SQUASH, { cue: "boing", shake: [0, 1] });
    if (i < lands.length - 1) to(land + 210, STRETCH);
  }
  // The big one: a deep crouch, the spring up, up and away, then down, arms and legs out.
  to(lands[2]! + 230, { ...SQUASH, bob: 5, mood: "fierce", lolly: "hold", free: "pump" });
  to(lands[2]! + 350, { ...STRETCH, bob: -4, mood: "grin" }, { cue: "whoosh" });
  to(crash - 300, AIR);
  to(crash, { ...STRETCH, feet: "wide", mood: "ooh" });
  to(crash + 100, { ...SQUASH, bob: 5, mood: "tantrum", lolly: "splat" }, { cue: "crash", shake: [0, 2], specks: crashDust(0) });
  to(crash + 250, { ...SQUASH, bob: 5, mood: "dazed", lolly: "splat" }, { specks: crashDust(1) });
  for (let k = 0; t < BOUNCE.settleAt - L + 150; k++) to(t + 200, { ...SQUASH, bob: 4, mood: "dazed", lolly: "splat", headDx: k % 2 ? 1 : -1 }, { specks: stars(k, 4) });
  to(t + 140, { ...SQUASH, bob: 3, mood: "giggle", free: "mouth" }, { cue: "giggle" });
  for (let k = 0; t < back - 120; k++) to(Math.min(back - 120, t + 120), { ...SQUASH, bob: 3 - (k % 2), mood: "giggle", free: "mouth", headDy: k % 2 });
  to(back, CROUCH);
  to(back + 150, STRETCH, { cue: "boing" });
  to(end, AIR);
  return out;
}
const bigBounce: Anim = { loop: false, frames: bounceFrames() };

export const BIGBOY: Character = {
  id: "bigboy",
  name: "Big Boy",
  w: OX + 62,
  h: OY + GROUND + 6,
  foot: [OX + 28, OY + GROUND],
  palette: BIGBOY_PALETTE,
  halo: "#2c2622",
  looks: LOOKS,
  parts: PARTS,
  anims: { idle, swing, tantrum, snack, toss, bigBounce, lick, giggle, wail },
};

/**
 * The bounce's frames by kind, for the board's squash and stretch (components/BigBoy.tsx scales his box a little on
 * top of the pose): which of `bigBounce`'s time windows (ms from its start) are a squash and which a stretch.
 */
export function bounceShape(t: number): "squash" | "stretch" | "crash" | null {
  const L = BOUNCE.leapAt;
  for (const land of BOUNCE.lands) if (t >= land - L && t < land - L + 100) return "squash";
  for (const land of BOUNCE.lands) if ((t >= land - L - 100 && t < land - L) || (t >= land - L + 100 && t < land - L + 210)) return "stretch";
  if (t >= BOUNCE.crashAt - L && t < BOUNCE.crashAt - L + 250) return "crash";
  if (t >= 90 && t < 200) return "stretch";
  return null;
}

/** The part of him a portrait shows (his head and the candy beside it), in frame pixels. */
export const BIGBOY_PORTRAIT = { x: OX, y: OY - 4, w: 54, h: 36 } as const;

/**
 * His lines: short baby talk in his text box (Eric: "Mine!", "Nom nom.", "Waaaah!", "Big boy BOUNCE!"), never
 * instructions, rare (each moment's chance of a line is in BIGBOY_CHANCE), the same for everyone (by the moment).
 */
export const BIGBOY_LINES: Partial<Record<import("./boss-beats.ts").Beat, readonly string[]>> = {
  entrance: ["Big boy here!", "Mine! All mine!", "Wanna play?"],
  snack: ["Nom nom.", "Yummy pawn!", "Snack time!"],
  move: ["Mine!", "Me go!", "Hee hee!", "Big boy move!"],
  capture: ["Mine!", "Gimme!", "Nom nom.", "My toy now!"],
  check: ["Peekaboo!", "Boo!", "Got you!"],
  hurt: ["Waaaah!", "No fair!", "Owie!", "Mine! Give back!"],
  thinking: ["Hmmm…", "Goo?", "Uhhh…"],
  smug: ["Easy peasy!", "Big boy winning!", "Hee hee hee!"],
  rattled: ["Uh-oh.", "Mama?", "No like this…"],
  defeat: ["Waaaah!", "Nap time…", "Not fair…"],
  victory: ["Big boy win!", "Yay! All mine!", "Again! Again!"],
  strike: ["Bonk!", "Time out!", "Bad! Bonk!"],
  power: ["Catch!", "Blocky!", "My toy!", "Stack it!"],
  ultimateWarn: ["Big boy mad!", "Gonna bounce…", "Waaaah!"],
  ultimate: ["Big boy BOUNCE!", "Boing boing!", "Bouncy bouncy!"],
};
export const BIGBOY_CHANCE: Partial<Record<import("./boss-beats.ts").Beat, number>> = {
  entrance: 1,
  snack: 1,
  move: 0.12,
  capture: 0.6,
  check: 0.75,
  hurt: 0.6,
  thinking: 0.08,
  smug: 0.8,
  rattled: 0.8,
  defeat: 1,
  victory: 1,
  strike: 0.8,
  power: 0.5,
  ultimateWarn: 1,
  ultimate: 1,
};
