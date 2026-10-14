/**
 * The Hidden Boss (working code id `recluse`; Eric will name him later): a chess legend, tall and lanky, with the red
 * book. Drawn after Eric's own reference sprite (the outfit) and a photo Eric sent (the face), as original pixel art.
 * Standing, slim, narrow-shouldered and long-limbed: swept brown hair parted on our left, a loose lock falling to his
 * brow; a long face, a long straight nose, strong cheekbones and a narrow chin; his head tilted down and his eyes rolled
 * up at us from under heavy brows, the whites showing under the irises; thin lips pressed into a knowing half-smirk. A
 * white dress shirt with its sleeves rolled up, a blue tie with light-blue rings and a gold clip, a belt, navy
 * trousers, brown shoes. Clutched at his side, the red book (effects/recluse.ts: a red cloth hardcover of his rival's
 * games, a faint gold band on its spine, a gold border and one gold letter, a Cyrillic "Ш" for chess, on its cover,
 * no other marking); his other arm hangs relaxed at his side (no chess piece: Eric, Oct 14). Drawn facing front, light
 * from the top left.
 *
 * ART ONLY (Oct 14, 2026): he is in no roster, kit or character list, so the game never shows him (a test checks).
 * Eric is still designing him (ROADMAP.md, "The hidden boss"). Previews:
 *   npm run preview:characters -- <dir> extra=packages/app/src/characters/recluse.ts only=recluse,recluse-bust,recluse-book
 *
 * Two drawings from one rig, because the face comes first:
 * - `RECLUSE`: the whole standing figure, taller than the rest of the cast, for a computer (a boss stands at 2x by the
 *   board's corner).
 * - `RECLUSE_BUST`: head, shoulders and the top of the book, cut at the chest, for a phone's boss bar (too short for a
 *   figure his height). The same face and the same animations.
 * And the book alone, one board square across: `RECLUSE_BOOK` (effects/recluse.ts; art only, not shown).
 *
 * His story in two phases (Eric, Oct 14): phase 1 calm, the book clutched at his side; beaten, he `collapse`s to his
 * knees and mumbles (`collapseLoop`); then his phase change (Eric, Oct 14, reworked): up in a `rage`, he leaps onto the
 * board, throws the book down and chants over its light, his hair lifting into phase 2's: his hair streaming in a
 * constant wind, his face in deeper shadow with a glint in his eyes, a wider stance, the book held ready in front of
 * him. Each animation has a phase-2 version (`idle2`, `consult2`...), so once changed his hair never falls calm again.
 *
 * Rigging: the head (one per face, per lift of the hair in the wind and per phase: eyes, brows and mouth stamped on a
 * typed base), the torso, the tie (from its sway), the legs (standing, wide, four steps down to kneeling) and the
 * shoes are painted once; the arms from their points (a shoulder, an elbow and a wrist, the sleeve rolled up below the
 * elbow); the hands are typed; the book from its state. Every part is painted the first time a frame that uses it
 * shows (sprite.ts lazyParts).
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";
import { BOOK_PALETTE, BOOK_SIZE, bookFlat, bookHalf, bookOpen, bookRead, bookTurned, type BookPart } from "./effects/recluse.ts";

export { RECLUSE_BOOK } from "./effects/recluse.ts";

export const RECLUSE_PALETTE: Record<string, string> = {
  ...BOOK_PALETTE,
  k: "#1a1420", // outline
  a: "#6e3420", // skin, dark to light
  b: "#9c522f",
  c: "#c87a4a",
  d: "#e4a06c",
  e: "#f4c493",
  H: "#2a170d", // hair, dark to light
  h: "#4a2c19",
  j: "#6e4529",
  J: "#95663f",
  B: "#1f120b", // brows
  w: "#ece5df", // eye whites, teeth
  x: "#120b09", // irises, the lash line
  m: "#5c2418", // the mouth's line
  X: "#2c0c0e", // inside the mouth
  q: "#7d779f", // shirt: deep shade to light (white, with cool lavender shadows)
  r: "#aaa6c8",
  s: "#d8d6ea",
  t: "#f6f5fc",
  T: "#162a6b", // tie: dark, mid, light, its rings
  U: "#2a4fb8",
  V: "#3f70de",
  o: "#8ccfff",
  N: "#0f1633", // trousers (navy), dark to light
  M: "#1b2756",
  L: "#2a3b7a",
  l: "#3d5299",
  D: "#24110a", // shoes and belt (brown leather), dark to light, the shine
  E: "#43210f",
  F: "#6a3a20",
  G: "#a87452",
  "8": "#fff3b8", // the spell's glow (and the glint in his eyes): pale, gold, ember
  "9": "#ffc44a",
  "0": "#ff7a3c",
};

type Pt = readonly [number, number];
const SHIRT = "qrst";
const NAVY = "NMLl";

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
/** Fills every pixel of `cv` (its top-left at drawing-space (x0, y0)) inside `inside` with `key(x, y)`, in drawing space. */
function fill(cv: Canvas, x0: number, y0: number, inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
}
/** Rows stamped at drawing-space (x, y) onto a canvas whose top-left is (cx0, cy0); `.` leaves a pixel. */
function stamp(cv: Canvas, cx0: number, cy0: number, rows: readonly string[], x: number, y: number): void {
  rows.forEach((row, dy) =>
    [...row].forEach((k, dx) => {
      if (k === ".") return;
      const X = x + dx - cx0;
      const Y = y + dy - cy0;
      if (cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
    }),
  );
}
const mirror = (rows: readonly string[]) => rows.map((r) => [...r].reverse().join(""));

// ---- The head: one per face, typed (the face is what must read, so every pixel of it is placed by hand). Head space:
// 25 x 35 (5 rows on top for the hair lifting in the wind), the face's middle on x 12 (the nose).

export type Eyes = "ahead" | "down" | "readL" | "readR" | "shut" | "hard" | "narrow" | "wild" | "squeeze" | "glare";
export type Brows = "stern" | "hard" | "twitch" | "up" | "wild" | "fury";
export type Mouth = "stern" | "tight" | "grin" | "laugh" | "grit" | "mumble1" | "mumble2" | "mumble3" | "scowl" | "shout";
export interface Face {
  eyes: Eyes;
  brows: Brows;
  mouth: Mouth;
}
const REST_FACE: Face = { eyes: "ahead", brows: "stern", mouth: "stern" };
export type Wind = 0 | 1 | 2 | 3;

/** Rows above the hair, for the wind. */
const LIFT = 5;
/** Where the head's top-left sits in drawing space (the face's middle on x 46; the hair's top at y 1 at rest). */
const HEAD_AT: Pt = [34, 1 - LIFT];

/**
 * The head without its features: thick hair parted on our left and swept across to our right, in clumps; a long face
 * lit from the top left, in shade down our right; the ears set high (his head is tilted down); a long jaw and a narrow
 * chin.
 */
const HEAD_BASE: readonly string[] = [
  "........hhjjjjjjhh.......",
  "......hjjJJJJJjjjjhh.....",
  "....hhjHJJhhhhJJJjjjhh...",
  "...hjjhHJJJJJJhhhhjjjhh..",
  "..hjjhhHjJJJJJJJJjhhhjjhh",
  ".hjjhjhHjjhhhhhJJJjjjhhhH",
  ".hjhjhHjjjjjjjhhhhhjjjhHH",
  "hjhjhHjjjcdddddddhhhhhhHH",
  "hjhHjjhhcdeeeddddcbhhhHHH",
  "hhHhjhhcdeeeddddccbbhhHHh",
  "hHhjhhcddeeddddddccbbhHH.",
  ".Hcbcdddddddddcccccbbba..",
  "..cbdddddddddcccccbbbba..",
  "..cbdddddddddcccccbbbba..",
  "..caddeddddddcccccbbbaa..",
  "..cbdeeddddddcccccbcaba..",
  "..cbdddddddddcccccbbaba..",
  "...bcddddddddcccccbbaa...",
  "....cddddddddccccbbaa....",
  "....ccdddddddccccbbba....",
  "....cccddddddcccbbaaa....",
  ".....cddddddcccccbba.....",
  ".....ccdddddccccbbba.....",
  "......cdddddccccbba......",
  "......ccddddcccbbba......",
  ".......cdddddccbba.......",
  ".......ccdddccbbba.......",
  "........bcdddcbba........",
  ".........bcddcba.........",
  "..........bbbba..........",
];

/** Each brow, 6 wide, rows 9 to 11: the left one (our left) from x 6, the right from x 13 (its mirror unless given). */
const BROWS: Record<Brows, { l: readonly string[]; r?: readonly string[] }> = {
  stern: { l: ["......", "BBBBB.", ".BBBBB"] },
  hard: { l: ["......", "....BB", "BBBBBB"] },
  twitch: { l: ["......", "BBBBB.", ".BBBBB"], r: ["BBBB..", ".BBBBB", "cccccc"] },
  up: { l: [".BBBB.", "B....B", "dddddd"], r: [".BBBB.", "B....B", "cccccc"] },
  wild: { l: [".BBB..", "B...BB", "dddddd"], r: ["..BBBB", "BBB...", "cccccc"] },
  // Rage: drawn down hard to the bridge of his nose, a V.
  fury: { l: ["BB....", "BBBB..", "..BBBB"] },
};
/**
 * Each eye, 4 wide, rows 12 to 15 (the lid, the iris, the white under it, the shade under the eye): the left from x 7,
 * the right from x 14 (the same unless given). At rest his eyes are rolled up at us from under his brows, the iris
 * tucked under the lid and the white showing beneath it: the stare.
 */
const EYES: Record<Eyes, { l: readonly string[]; r?: readonly string[] }> = {
  ahead: { l: ["bxxb", "wxxw", "bwwb", "cbbc"] },
  down: { l: ["bbbb", "xxxx", "wxxw", "cbbc"] },
  readL: { l: ["bbbb", "xxxx", "xxww", "cbbc"] },
  readR: { l: ["bbbb", "xxxx", "wwxx", "cbbc"] },
  shut: { l: ["bbbb", "cccc", "xxxx", "cbbc"] },
  hard: { l: ["bxxb", "wxxw", "wwww", "cbbc"] },
  narrow: { l: ["bbbb", "xxxx", "wxxw", "bbbb"] },
  wild: { l: ["wwww", "wwxw", "wwww", "bwwb"], r: ["wwww", "wxww", "wwww", "bwwb"] },
  squeeze: { l: ["bbbb", "bxxb", "x..x", "cccc"] },
  // Glaring straight at us under the drawn brows: a heavy lid, the iris full, white either side.
  glare: { l: ["bbbb", "wxxw", "wxxw", "cbbc"] },
};
/** The mouth, 7 wide, rows 23 to 27 from x 9: thin lips, at rest pressed into a knowing half-smirk. */
const MOUTHS: Record<Mouth, readonly string[]> = {
  stern: ["......m", "mmmmmm.", ".bddd..", "..bbb.."],
  tight: [".......", "mmmmmmm", ".ddddd.", "..bbb.."],
  grin: [".mmmmm.", "mwwwwwm", ".mmmmm.", "..bbb.."],
  laugh: ["mmmmmmm", "mwwwwwm", "mXXXXXm", ".mXXXm.", "..mmm.."],
  grit: [".mmmmm.", "mwmwmwm", ".mmmmm.", "..bbb.."],
  // Mumbling: the lips working fast, a word at a time.
  mumble1: [".......", ".mmmmm.", ".mXXXm.", "..mmm.."],
  mumble2: [".......", "..mmm..", "..mXm..", "...m..."],
  mumble3: [".......", "mmmmmm.", ".ddddd.", "..bbb.."],
  // Rage: the corners pulled down; and shouting, the mouth wide, the teeth bared.
  scowl: ["..mmm..", ".m...m.", "m.ddd.m", "..bbb.."],
  shout: [".mmmmm.", "mwwwwwm", "mXXXXXm", "mwwwwwm", ".mmmmm."],
};

/**
 * His hair lifting in the wind (phases 1 to 3): locks streaming up and over to our right from the top of his head,
 * swaying phase to phase; the loose lock lifts off his brow and the sides flare.
 */
const WIND: Record<1 | 2 | 3, readonly string[]> = {
  1: [
    "...............h.........",
    "........h.....hj....h....",
    ".......hj....hjJ...hj..h.",
    "...h..hjJ...hjJj..hjj.hj.",
    "...hjhjJj..hjJjhhhjjhhj..",
  ],
  2: [
    "................h........",
    ".........h.....hj.....h..",
    "..h.....hj....hjJ....hj..",
    "..hj...hjJ...hjJj..hhjj..",
    "...hjhhjJj..hjJjhhhjjjh..",
  ],
  3: [
    "..............h..........",
    ".......h.....hj....h.....",
    "......hj....hjJ...hj...h.",
    "..h..hjJj..hjJj..hjj..hj.",
    "...hjhjJjhhjJjhhhjjhhhj..",
  ],
};

/** A head: a face, the hair in the wind or not, and phase 2's deeper shadows and the glint in his eyes. */
function head(face: Face, wind: Wind, dark: boolean): Part {
  const cv: Canvas = [...Array.from({ length: LIFT }, () => ".".repeat(25)), ...HEAD_BASE].map((r) => [...r]);
  const put = (rows: readonly string[], x: number, y: number) => stamp(cv, 0, -LIFT, rows, x, y);
  // The nose: long and straight, its bridge lit, its shade down our right; the tip and the nostrils.
  put(["c", "d", "e", "e", "d", "d", "d", "d"], 12, 12);
  put(["c", "b", "b", "b", "b", "b", "b", "b"], 13, 12);
  put([".deb.", "bdddb", ".bab."], 10, 20);
  if (wind) {
    put(WIND[wind], 0, -LIFT);
    put(["h", "j"], wind === 2 ? 0 : 24, 6);
    put(["..j", ".hJ"], 9, 6);
  } else {
    // The loose lock falling from his part towards his brow.
    put(["..h", ".h.", "h.."], 9, 7);
  }
  const brows = BROWS[face.brows];
  put(brows.l, 6, 9);
  put(brows.r ?? mirror(brows.l), 13, 9);
  const eyes = EYES[face.eyes];
  put(eyes.l, 7, 12);
  put(eyes.r ?? eyes.l, 14, 12);
  put(MOUTHS[face.mouth], 9, 23);
  if (dark) {
    // Deeper shadows: the sockets under his brows, the hollows of his cheeks, the shaded side; a glint in each iris.
    for (let y = 11 + LIFT; y < cv.length; y++)
      for (let x = 0; x < 25; x++) {
        const k = cv[y]![x]!;
        if (k === "b" && (x >= 15 || y === 12 + LIFT || y === 15 + LIFT)) cv[y]![x] = "a";
        else if (k === "c" && x >= 16) cv[y]![x] = "b";
      }
    put(["b", "b", "b"], 6, 18);
    for (const x of [7, 14]) {
      const row = cv[13 + LIFT]!;
      const i = row.indexOf("x", x);
      if (i >= 0 && i < x + 4) row[i] = "8";
    }
  }
  return { grid: toGrid(cv) };
}

// ---- The body, standing (drawing space: the ground at y 128, his middle on x 46).

const GROUND = 128;

/** The torso: the shirt (an open collar; narrow, sloping shoulders, a long waist), the neck, the belt. */
function torso(): Part {
  const X0 = 30;
  const Y0 = 26;
  const cv = canvas(32, 48);
  const F = (inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string) => fill(cv, X0, Y0, inside, key);
  F(inPoly([[42, 26], [50, 26], [50.4, 35], [41.6, 35]]), (x, y) => (y < 31 || x > 48 ? "b" : "c"));
  stamp(cv, X0, Y0, ["aaaaaaaa", ".aaaaaa."], 42, 29);
  const shirt = inPoly([[41, 30.6], [44.6, 34], [47.4, 34], [51, 30.6], [55.4, 32.2], [59, 34.6], [60, 39], [58.8, 50], [57.8, 62], [57.6, 71], [34.4, 71], [34.2, 62], [33.2, 50], [32, 39], [33, 34.6], [36.6, 32.2]]);
  const light = roundLight(40, 40, 16, 30, 0.22);
  F(shirt, (x, y) => ramp(SHIRT, light(x, y) - (y > 64 ? 0.12 : 0)));
  // Folds: down from each armpit, and where the shirt gathers at the belt.
  const fold = (pts: Pt[], k: string) => pts.forEach(([x, y]) => stamp(cv, X0, Y0, [k], x, y));
  fold([[35, 44], [36, 45], [37, 46], [37, 47]], "r");
  fold([[57, 43], [56, 44], [55, 45], [55, 46]], "q");
  fold([[37, 64], [38, 65], [39, 66], [40, 66]], "r");
  fold([[55, 63], [54, 64], [53, 65], [52, 66]], "q");
  fold([[42, 68], [43, 69], [50, 68], [49, 69]], "r");
  // The collar: two stiff points over his collarbones, a shade line under each.
  const collarL = inPoly([[40.4, 29.6], [45.6, 34.6], [43.6, 39.4], [39.4, 36.6], [38.2, 31.6]]);
  const collarR = inPoly([[51.6, 29.6], [53.8, 31.6], [52.6, 36.6], [48.4, 39.4], [46.4, 34.6]]);
  F(collarL, (x, y) => (!collarL(x + 1, y + 1) ? "r" : "t"));
  F(collarR, (x, y) => (!collarR(x - 1, y + 1) ? "q" : x > 51 ? "s" : "t"));
  stamp(cv, X0, Y0, ["b", "b", "a"], 46, 33);
  // The belt: dark leather, a small gold buckle.
  F(inPoly([[34.3, 70], [57.7, 70], [57.7, 73], [34.3, 73]]), (_x, y) => (y < 71 ? "E" : "D"));
  stamp(cv, X0, Y0, ["OYO", "OyO"], 44, 71);
  return { grid: toGrid(cv) };
}

/** The tie: blue, a pattern of light-blue rings, a gold clip; `sway` swings its blade. */
function tie(sway: number): Part {
  const X0 = 40;
  const Y0 = 32;
  const cv = canvas(20, 40);
  const knot = inPoly([[43.4, 33.6], [48.6, 33.6], [47.8, 38], [44.2, 38]]);
  const tip: Pt = [48.4 + sway * 1.2, 69];
  const blade = inPoly([[44, 37.6], [48, 37.6], [49.6 + sway * 0.4, 50], [51.4 + sway * 0.9, 63.6], tip, [45.4 + sway * 0.9, 63.6], [44.2 + sway * 0.4, 50]]);
  fill(cv, X0, Y0, knot, (x, y) => (y < 34.5 ? "V" : x > 46 ? "T" : "U"));
  fill(cv, X0, Y0, blade, (x, y) => (!blade(x + 1, y) ? "T" : !blade(x - 1, y) ? "V" : "U"));
  // The rings: little light-blue rings round a dark middle, staggered down the blade.
  const midX = (y: number) => 46 + ((y - 38) / 26) * (2.4 + sway * 0.9);
  [41.5, 46, 54.5, 59, 63.5].forEach((y, i) => {
    const X = Math.round(midX(y) + (i % 2 ? 1.2 : -1.2));
    const Y = Math.round(y);
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) if (blade(X + dx, Y + dy)) stamp(cv, X0, Y0, ["o"], X + dx, Y + dy);
    if (blade(X, Y)) stamp(cv, X0, Y0, ["T"], X, Y);
  });
  // The gold clip across it.
  for (let x = 42; x <= 54; x++) if (blade(x, 50) || blade(x - 1, 50) || blade(x + 1, 50)) stamp(cv, X0, Y0, [x === Math.round(midX(50)) - 1 ? "y" : "Y", "O"], x, 50);
  return { grid: toGrid(cv) };
}

// ---- Strokes: arms and legs, a thick round stroke along points, shaded like a cylinder.

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function boxOf(pts: readonly Pt[], pad: number): { x0: number; y0: number; w: number; h: number } {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  return { x0, y0, w: Math.ceil(Math.max(...xs)) + pad - x0 + 1, h: Math.ceil(Math.max(...ys)) + pad - y0 + 1 };
}

/**
 * An arm, slim: the sleeve from the shoulder to the elbow, then the rolled-up cuff (a fat band, a crease at each end)
 * over the first part of the forearm, then the bare forearm to the wrist. `fore`: the forearm only (drawn again in
 * front of the book he clutches). `full`: a fuller forearm, for his free arm hanging in full view (the book arm's
 * forearm is mostly behind the book or across it).
 */
function paintArm(sh: Pt, el: Pt, wr: Pt, fore: boolean, full = false): Part {
  const cuff = 0.36;
  const b = boxOf([sh, el, wr], 6);
  const cv = canvas(b.w, b.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const p: Pt = [b.x0 + x + 0.5, b.y0 + y + 0.5];
      const up = nearest(p, sh, el);
      const lo = nearest(p, el, wr);
      const rUp = 3.5 - up.t * 0.5;
      const inCuff = lo.t < cuff;
      const rLo = inCuff ? 3.7 - lo.t * 0.6 : full ? 2.8 - lo.t * 0.4 : 2.2 - lo.t * 0.3;
      const inUp = !fore && up.d <= rUp;
      const inLo = lo.d <= rLo;
      if (!inUp && !inLo) continue;
      const s = inLo && (!inUp || lo.d - rLo < up.d - rUp) ? lo : up;
      const rr = s === lo ? rLo : rUp;
      const l = 0.6 - 0.5 * (s.nx / rr) - 0.4 * (s.ny / rr);
      if (s === lo && !inCuff) cv[y]![x] = ramp("bcd", l);
      else if (s === lo) cv[y]![x] = lo.t > cuff - 0.1 || lo.t < 0.06 ? "q" : ramp("rst", l + 0.1);
      else cv[y]![x] = ramp(SHIRT, l - 0.12);
    }
  return { grid: toGrid(cv) };
}

function paintLimb(pts: readonly Pt[], r: number, r1: number, keys: string, base = 0.62): { cv: Canvas; at: Pt } {
  const b = boxOf(pts, Math.ceil(Math.max(r, r1)) + 1);
  const cv = canvas(b.w, b.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const p: Pt = [b.x0 + x + 0.5, b.y0 + y + 0.5];
      let best = { d: Infinity, nx: 0, ny: 0, rr: r };
      pts.slice(1).forEach((q, i) => {
        const n = nearest(p, pts[i]!, q);
        const rr = r + (r1 - r) * ((i + n.t) / (pts.length - 1));
        if (n.d - rr < best.d - best.rr) best = { d: n.d, nx: n.nx, ny: n.ny, rr };
      });
      if (best.d > best.rr) continue;
      cv[y]![x] = ramp(keys, base - 0.45 * (best.nx / best.rr) - 0.3 * (best.ny / best.rr));
    }
  return { cv, at: [b.x0, b.y0] };
}

export type Stance = "stand" | "wide" | "rise" | "bend" | "low" | "kneel";
/** How far each stance lowers everything above his belt. */
const STANCE_DROP: Record<Stance, number> = { stand: 0, wide: 0, rise: 4, bend: 10, low: 17, kneel: 24 };
/** Each stance's legs: a hip, a knee and an ankle (or the knee on the ground), left then right. */
const STANCE_LEGS: Record<Stance, readonly (readonly Pt[])[]> = {
  stand: [[[40, 78], [39.6, 101], [39.4, 121]], [[52, 78], [52.4, 101], [52.6, 121]]],
  wide: [[[40, 78], [38.4, 101], [37, 121]], [[52, 78], [53.6, 101], [55, 121]]],
  rise: [[[40, 82], [38.4, 103], [39.2, 121]], [[52, 82], [53.6, 103], [52.8, 121]]],
  bend: [[[40, 88], [36.4, 106], [39.2, 121]], [[52, 88], [55.6, 106], [52.8, 121]]],
  low: [[[40, 95], [34.6, 110], [38.6, 121]], [[52, 95], [57.4, 110], [53.4, 121]]],
  kneel: [[[40, 102], [39.4, 124.4]], [[52, 102], [52.6, 124.4]]],
};

/** His hips and both long legs in navy trousers for a stance (one part), a crease down each, the hems. */
function legs(stance: Stance): { part: Part; at: Pt } {
  const X0 = 28;
  const Y0 = 66;
  const cv = canvas(38, 62);
  const dy = STANCE_DROP[stance];
  const hips = inPoly([[34.4, 71 + dy], [57.6, 71 + dy], [58.4, 79 + dy], [54.4, 83 + dy], [46, 80.6 + dy], [37.6, 83 + dy], [33.6, 79 + dy]]);
  fill(cv, X0, Y0, hips, (x, y) => ramp(NAVY, roundLight(42, 72 + dy, 14, 10, 0.1)(x, y)));
  for (const pts of STANCE_LEGS[stance]) {
    const l = paintLimb(pts, 5.4, stance === "kneel" ? 6.2 : 4.4, NAVY, pts[0]![0] < 46 ? 0.66 : 0.5);
    l.cv.forEach((row, y) => row.forEach((k, x) => k !== "." && cv[l.at[1] - Y0 + y]?.[l.at[0] - X0 + x] !== undefined && (cv[l.at[1] - Y0 + y]![l.at[0] - X0 + x] = k)));
  }
  stamp(cv, X0, Y0, ["N", "N", "N", "N", "N"], 46, 79 + dy);
  if (stance === "kneel") {
    // Knees on the ground: the trousers stretched over them, his shins out of sight behind.
    stamp(cv, X0, Y0, [".lll.", "lMMMl"], 37, 118);
    stamp(cv, X0, Y0, [".MMM.", "MNNNM"], 50, 118);
  } else {
    const [l, r] = STANCE_LEGS[stance];
    // The creases down the front, the knees' folds, the hems breaking over the shoes.
    for (const [leg, k] of [[l!, "l"], [r!, "M"]] as const) {
      const [, knee, ankle] = leg as Pt[];
      for (let y = 84 + dy; y < 119; y++) {
        const t = y < knee![1] ? (y - leg[0]![1]) / (knee![1] - leg[0]![1]) : (y - knee![1]) / (ankle![1] - knee![1]);
        const x = y < knee![1] ? leg[0]![0] + (knee![0] - leg[0]![0]) * t : knee![0] + (ankle![0] - knee![0]) * t;
        if (Math.abs(y - knee![1]) > 2) stamp(cv, X0, Y0, [k], Math.round(x) - 1, y);
      }
      stamp(cv, X0, Y0, ["NMN", ".N."], Math.round(knee![0]) - 1, Math.round(knee![1]) - 2);
      stamp(cv, X0, Y0, ["NNNNNNNN"], Math.round(ankle![0]) - 4, 121);
    }
  }
  return { part: { grid: toGrid(cv) }, at: [X0, Y0] };
}

/** A shoe (the left: its toe out to our left), polished brown leather, a shine on the toe cap. */
function shoe(): Part {
  const cv = canvas(13, 6);
  const sh = inPoly([[0.4, 5.8], [0.8, 3.6], [3, 2], [6.4, 1.2], [8.4, 0.2], [12.6, 0.2], [12.8, 5.8]]);
  fill(cv, 0, 0, sh, (x, y) => (y >= 5 ? "D" : ramp("DEF", roundLight(4, 1.5, 7, 4, 0.12)(x, y))));
  stamp(cv, 0, 0, [".GG", "G.."], 2, 2);
  stamp(cv, 0, 0, ["EE"], 9, 1);
  return { grid: toGrid(cv) };
}
/** His soles behind him as he kneels: the shoes' heels, toes down, seen past his knees. */
function heels(): Part {
  return { grid: ["..EFFE", ".DEEEE", "DDDDDD"] };
}

function shadow(): Part {
  const cv = canvas(40, 3);
  fill(cv, 0, 0, inEllipse(20, 1.5, 20, 1.6), () => "Q");
  return { grid: toGrid(cv), outline: false };
}

// ---- Hands.

/** A fist round a book's edge: knuckles to us, the fingers in bands; two ways (his fingers drumming on it). */
const FIST: Record<"a" | "b", readonly string[]> = {
  a: [".cddc.", "cdeedc", "bccccb", "cddddb", "bccccb", ".bbbb."],
  b: ["..cddc", "cdeedc", "bccccb", "cddddb", "bccccb", ".bbbb."],
};
/** His hand clutching the book: fingers curled over its front edge. */
const CLUTCH = ["cddc..", "cdddcb", "bcbcbb", "cdcdcb", ".bbbb."];

/**
 * His free hand (his left, our right), hanging relaxed by his thigh: the back of the hand turned out, the thumb in
 * front of it towards his body (lit, parted from the hand by a shade line), the fingers loosely curled below; `flex`:
 * the fingers curled in a little more (a small, idle movement). It carries its own outline, open at the top, so it
 * runs on from the forearm with no line across the wrist; its top row sits on the wrist, 4 to the left of it.
 */
const HAND: Record<"rest" | "flex", readonly string[]> = {
  rest: [".kcddck.", ".kcdddbk", "kddcddbk", "kdbcddbk", ".kkcddbk", "..kbcdbk", "..kbcbbk", "...kbbk.", "....kk.."],
  flex: [".kcddck.", ".kcdddbk", "kddcddbk", "kdbcddbk", ".kkcddbk", "..kbccbk", "...kbbk.", "....kk..", "........"],
};
/**
 * His left hand (our right) raised open, its palm to us (the chant over the book): the fingers up and together, a shade
 * line between them, the thumb out towards his body; lit on its top left. It carries its own outline, open at the
 * foot, so it runs on from the forearm; its bottom row sits on the wrist, 3 to the left of it. His right hand is its
 * mirror.
 */
const PALM = ["..kkkk.", ".kdeddk", ".kdcdck", ".kdcdck", "kkdcdck", "kdbdddk", "kddddck", ".kdddck", "..kccbk", "..kcbbk"];

// ---- Parts.

const { parts: PARTS, add } = lazyParts();
const STANCES: readonly Stance[] = ["stand", "wide", "rise", "bend", "low", "kneel"];
const LEGS = Object.fromEntries(STANCES.map((s) => [s, legs(s)])) as Record<Stance, { part: Part; at: Pt }>;
for (const s of STANCES) add(`legs:${s}`, () => LEGS[s].part);
add("torso", torso);
add("shoe", shoe);
add("heels", heels);
add("shadow", shadow);
add("fist:a", () => ({ grid: FIST.a }));
add("fist:b", () => ({ grid: FIST.b }));
add("clutch", () => ({ grid: CLUTCH }));
add("hand:rest", () => ({ grid: HAND.rest, outline: false }));
add("hand:flex", () => ({ grid: HAND.flex, outline: false }));
add("hand:palm", () => ({ grid: PALM, outline: false }));
add("book:closed", () => bookTurned(0));
for (const d of [45, 90, 135, 180, 225, 270, 315]) add(`book:spin${d}`, () => bookTurned(d));
add("book:flat", bookFlat);
add("book:half", bookHalf);
add("book:read", bookRead);
add("book:open", () => bookOpen(0));
for (const f of [1, 2, 3] as const) add(`book:flutter${f}`, () => bookOpen(f));

const r2 = (v: number) => Math.round(v * 2) / 2;
const headName = (f: Face, wind: Wind, dark: boolean) => add(`head:${f.eyes}.${f.brows}.${f.mouth}:${wind}${dark ? ":dark" : ""}`, () => head(f, wind, dark));
const tieName = (sway: number) => add(`tie:${sway}`, () => tie(sway));
const ARM_AT = new Map<string, Pt>();
function armPart(sh: Pt, el: Pt, wr: Pt, fore = false, full = false): { name: string; at: Pt } {
  const q = [sh, el, wr].map((p): Pt => [r2(p[0]), r2(p[1])]) as [Pt, Pt, Pt];
  const name = `arm${fore ? "fore" : ""}${full ? "full" : ""}:${q.map((p) => p.join(",")).join(";")}`;
  add(name, () => paintArm(q[0], q[1], q[2], fore, full));
  let at = ARM_AT.get(name);
  if (!at) {
    const b = boxOf(q, 6);
    ARM_AT.set(name, (at = [b.x0, b.y0]));
  }
  return { name, at };
}

// ---- Poses.

/** Where his drawing space sits on the frame: room above for the hair in the wind and the spell's glow. */
const OX = -14;
const OY = 14;
const W = 64;
const H = OY + GROUND + 4;

const SHOULDER_R: Pt = [35, 37];
const SHOULDER_L: Pt = [57, 37];

export type BookState = BookPart | `spin${45 | 90 | 135 | 180 | 225 | 270 | 315}`;
/** Where his hands are and what the book is doing, in drawing space (before the breath, the drop and the shake). */
export interface Hold {
  book: BookState;
  /** The book's middle. */
  at: Pt;
  /** Clutched at his side (behind his forearm), not held out in front of him. */
  clutched?: boolean;
  /** On its own (falling, on the ground, flying back): `at` is where it is, whatever his body does. */
  loose?: boolean;
  /** Held up in his book hand alone (brandished), his free arm left free. */
  oneHand?: boolean;
  /** The book arm (his right, our left): elbow and wrist. */
  elbowR: Pt;
  wristR: Pt;
  /** The free arm (his left, our right): elbow and wrist. */
  elbowL: Pt;
  wristL: Pt;
}
/** Phase 1 at rest: the book clutched against his side under his right arm, his left arm hanging relaxed. */
export const REST: Hold = { book: "closed", at: [33, 50], clutched: true, elbowR: [31, 60], wristR: [41, 62], elbowL: [60, 60], wristL: [60, 81] };
/** The book held upright in front of him, its cover to us, a hand on each side (its middle at height `y`). */
const upHold = (book: BookState, y: number): Partial<Hold> => ({ book, at: [46, y], clutched: false, loose: false, elbowR: [31, 56], wristR: [38, y + 3], elbowL: [61, 56], wristL: [54, y + 3] });
/** Phase 2 at rest: the book held ready in front of him. */
export const REST2: Hold = { ...REST, ...upHold("closed", 54) } as Hold;

export interface ReclusePose {
  /** Phase 2 (revived): deeper shadows on his face, a glint in his eyes, a wider stance, the book held ready. */
  phase?: 1 | 2;
  stance?: Stance;
  face?: Partial<Face>;
  /** The hair in the wind (1 to 3), or at rest. */
  wind?: Wind;
  /** A breath in: everything above his belt up a pixel. */
  breath?: number;
  /** His head dipped (px): the stare looks up from under his brows. */
  dip?: number;
  headDx?: number;
  headDy?: number;
  /** His shoulders shaking or rocking: everything above his belt sideways. */
  shake?: number;
  hold?: Partial<Hold>;
  /** His free hand: on the book, its fingers drumming (`b`); hanging, its fingers curled in a little (`b`). */
  grip?: "a" | "b";
  tie?: number;
  /** His free hand, when it isn't on the book, clenched in a fist (angry). */
  fist?: boolean;
  /** Both hands raised open, palms to us (the chant; the book lies on the ground). */
  palms?: boolean;
  /** Off the ground (a leap): no shadow under his feet (the board draws one where he'll land). */
  air?: boolean;
}

/** Layers for a pose. `bust`: only what the bust shows (no legs, shoes, shadow or a book on the ground). */
export function recluseLayers(p: ReclusePose, bust = false): Layer[] {
  const phase = p.phase ?? 1;
  const h: Hold = { ...(phase === 2 ? REST2 : REST), ...p.hold };
  const stance = p.stance ?? (phase === 2 ? "wide" : "stand");
  const shake = p.shake ?? 0;
  // (The bust sinks only so far as he kneels, so his slumped head stays in the bar.)
  const drop = bust ? Math.min(12, STANCE_DROP[stance]) : STANCE_DROP[stance];
  const upY = drop - (p.breath ?? 0);
  const at = (part: string, x: number, y: number, flipX = false): Layer => ({ part, x: OX + Math.round(x), y: OY + Math.round(y), ...(flipX ? { flipX } : {}) });
  const up = (q: Pt): Pt => [q[0] + shake, q[1] + upY];
  const face: Face = { ...REST_FACE, ...p.face };
  const elR = up(h.elbowR);
  const wrR = up(h.wristR);
  const elL = up(h.elbowL);
  const wrL = up(h.wristL);
  const armR = armPart(up(SHOULDER_R), elR, wrR);
  // His free hand grips the book's edge when he holds it out in front of him; otherwise it hangs (or rests) open.
  const onBook = !h.clutched && !h.loose && !h.oneHand;
  const armL = armPart(up(SHOULDER_L), elL, wrL, false, !onBook);
  const [bw, bh] = h.book.startsWith("spin") ? [25, 25] : BOOK_SIZE[h.book as BookPart];
  const bc = h.loose ? h.at : up(h.at);
  const book = at(`book:${h.book}`, bc[0] - Math.floor(bw / 2), bc[1] - Math.floor(bh / 2));
  const layers: Layer[] = [];
  if (!bust) {
    if (!p.air) layers.push(at("shadow", 26, GROUND - 2));
    if (stance === "kneel") layers.push(at("heels", 27, GROUND - 4), at("heels", 59, GROUND - 4, true));
    layers.push(at(`legs:${stance}`, LEGS[stance].at[0], LEGS[stance].at[1]));
    if (stance !== "kneel") {
      const [l, r] = STANCE_LEGS[stance];
      layers.push(at("shoe", l![2]![0] - 10, GROUND - 6), at("shoe", r![2]![0] - 2, GROUND - 6, true));
    }
    if (h.loose) layers.push(book);
  }
  layers.push(at("torso", 30 + shake, 26 + upY));
  layers.push(at(tieName(Math.max(-1, Math.min(1, p.tie ?? 0))), 40 + shake, 32 + upY));
  layers.push(at(headName(face, p.wind ?? 0, phase === 2), HEAD_AT[0] + shake + (p.headDx ?? 0), HEAD_AT[1] + upY + (p.dip ?? 0) + (p.headDy ?? 0)));
  layers.push(at(armL.name, armL.at[0], armL.at[1]), at(armR.name, armR.at[0], armR.at[1]));
  // Clutched: the book against his side, his forearm across it and his fingers over its edge. Held out: in front of
  // him, his fists on its sides. Loose: his hand empty.
  // (Raised open, palms to us: each hand on its wrist, the right one the left's mirror.)
  const palm = (wr: Pt, right: boolean) => at("hand:palm", wr[0] - (right ? PALM[0]!.length - 4 : 3), wr[1] - PALM.length + 1, right);
  if (h.loose) layers.push(p.palms ? palm(wrR, true) : at("fist:a", wrR[0] - 3, wrR[1] - 1));
  else if (h.clutched) {
    const fore = armPart(up(SHOULDER_R), elR, wrR, true);
    layers.push(book, at(fore.name, fore.at[0], fore.at[1]), at("clutch", wrR[0] - 2, wrR[1] - 3));
  } else layers.push(book, at("fist:a", wrR[0] - 3, wrR[1] - 3));
  if (onBook) layers.push(at(`fist:${p.grip ?? "a"}`, wrL[0] - 3, wrL[1] - 3));
  else if (p.palms) layers.push(palm(wrL, false));
  else if (p.fist) layers.push(at("fist:a", wrL[0] - 3, wrL[1] - 1));
  else layers.push(at(`hand:${p.grip === "b" ? "flex" : "rest"}`, wrL[0] - 4, wrL[1] - 1));
  return layers;
}

// ---- Animations.

/** The frame of a pose; its specks kept a pixel inside the frame. */
const frame = (ms: number, p: ReclusePose, extra: Partial<Frame> = {}, bust = false): Frame => ({
  ms,
  layers: recluseLayers(p, bust),
  ...extra,
  ...(extra.specks ? { specks: extra.specks.filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2) } : {}),
});
const sp = ([x, y]: Pt, k: string): Speck => [OX + Math.round(x), OY + Math.round(y), k];

/** Page dust puffing out of the book as it snaps shut, or off the ground (its middle in drawing space), `t` frames on. */
function puff([x, y]: Pt, t: number, wide = 8): Speck[] {
  return Array.from({ length: 10 }, (_, i): Speck[] => {
    const side = i % 2 ? 1 : -1;
    const d = wide / 2 + 1 + t * (1.1 + (i >> 1) * 0.4);
    if (t > 2 && i % 2) return [];
    return [sp([x + side * d, y - (i % 3) - t * 0.8 + t * t * 0.15], i % 3 ? "A" : "C")];
  }).flat();
}
/**
 * The spell's glow over the open book (its middle in drawing space), at a point of its loop (0 to 7): motes and little
 * four-point stars rising off the pages and drifting, pale to gold to ember as they climb.
 */
function glow([x, y]: Pt, i: number): Speck[] {
  const out: Speck[] = [];
  for (let n = 0; n < 16; n++) {
    const life = (i + n * 3) % 8; // 0 just risen off the pages .. 7 gone
    if (life > 6) continue;
    // Up the sides of the book and past his shoulders, clear of his face; a few straight up off the pages.
    const lane = n % 3 === 0 ? x - 8 + ((n * 5) % 17) : n % 3 === 1 ? x - 16 + ((n * 3) % 7) : x + 10 + ((n * 5) % 7);
    const X = lane + Math.round(Math.sin((life + n) * 1.3) * 1.4);
    const Y = y - 7 - life * (n % 3 === 0 ? 1.4 : 3.2);
    const k = life < 2 ? "8" : life < 5 ? "9" : "0";
    out.push(sp([X, Y], k));
    // Some are little four-point stars while they're bright.
    if (n % 2 === 0 && life > 0 && life < 4) out.push(sp([X - 1, Y], k), sp([X + 1, Y], k), sp([X, Y - 1], k), sp([X, Y + 1], k));
  }
  // The aura: light flickering along the book's top edge and down its sides.
  for (let dx = -12; dx <= 12; dx += 2) if ((dx / 2 + i) % 3) out.push(sp([x + dx + (i % 2), y - 9], (dx / 2 + i) % 3 === 1 ? "9" : "8"));
  for (let dy = -6; dy <= 4; dy += 2) out.push(sp([x - 14, y + dy + (i % 2)], "9"), sp([x + 13, y + dy + ((i + 1) % 2)], "9"));
  return out;
}
/** The pages lit up from within while the spell runs: pale gold, the lines of moves burning gold; a slow pulse. */
const LIT = (i: number): Record<string, string> => (i % 2 ? { "5": "#fff9dc", "6": "#f3d98f", "7": "#e3a238" } : { "5": "#fff3c2", "6": "#e9c86e", "7": "#d48a28" });

type Spec = { ms: number; p: ReclusePose; extra?: Partial<Frame> };
type Ph = 1 | 2;
/** Frames from specs. Phase 2: every frame revived, the hair streaming (changing every other frame) unless set. */
const build = (specs: readonly Spec[], bust: boolean, ph: Ph = 1): Frame[] =>
  specs.map((s, i) => frame(s.ms, ph === 2 ? { phase: 2, wind: ((Math.floor(i / 2) % 3) + 1) as Wind, ...s.p } : s.p, s.extra, bust));

/** The first move off the rest hold: phase 1 lifts the clutched book away from his side; phase 2 lowers it a little. */
const lift = (ph: Ph): Partial<Hold> => (ph === 1 ? { at: [38, 60], elbowR: [31, 60], wristR: [37, 67] } : upHold("closed", 57));

/**
 * Idle (loop, silent): standing, a slow breath; the stare at us, then his eyes drop (to the board) and back up at us;
 * his free hand's fingers curl in a little twice; a blink, and once a brow twitches. Phase 1: 4.8 s, the book
 * clutched at his side.
 */
const IDLE: Spec[] = Array.from({ length: 40 }, (_, i) => {
  const breath = i >= 8 && i < 28 ? 1 : 0;
  const eyes: Eyes = i === 5 || i === 34 ? "shut" : i >= 12 && i < 26 ? "down" : "ahead";
  const brows: Brows = i === 30 || i === 31 ? "twitch" : "stern";
  const flex = (i >= 15 && i < 18) || (i >= 22 && i < 25);
  return { ms: 120, p: { breath, face: { eyes, brows }, grip: flex ? "b" : "a" } };
});
/**
 * Phase 2's idle (loop, 4.7 s): his hair streaming the whole time, the book held ready in front of him, his fingers
 * drumming on its edge; the stare, a glint in his eyes; once his eyes narrow, once a brow twitches.
 */
const IDLE2: Spec[] = Array.from({ length: 36 }, (_, i) => {
  const breath = i >= 6 && i < 24 ? 1 : 0;
  const eyes: Eyes = i === 4 ? "shut" : i >= 14 && i < 20 ? "narrow" : "ahead";
  const brows: Brows = i === 28 || i === 29 ? "twitch" : i >= 14 && i < 20 ? "hard" : "stern";
  const drumming = i >= 20 && i < 32;
  return { ms: 130, p: { breath, face: { eyes, brows }, grip: drumming && i % 2 ? "b" : "a" } };
});

/** Holding the book out in front of him under his chest, both hands on it (its pages' top edge in the bust). */
const READ_AT: Pt = [46, 61];
const readHold = (book: BookState): Partial<Hold> => ({ book, at: READ_AT, clutched: false, elbowR: [32, 57], wristR: [34, 61], elbowL: [60, 57], wristL: [58, 61] });
/**
 * Consult (between moves, thinking): he lifts the book (cue `lift`) out in front of him, opens it (cue `open`), scans a
 * page with a flick of the eyes, a knowing look up at us, snaps it shut (cue `snap`) and takes it back.
 */
const CONSULT = (ph: Ph): Spec[] => [
  { ms: 100, p: { face: { eyes: "down" } } },
  { ms: 90, p: { face: { eyes: "down" }, hold: lift(ph) }, extra: { cue: "lift" } },
  { ms: 90, p: { dip: 1, face: { eyes: "down", mouth: "tight" }, hold: readHold("flat") } },
  { ms: 80, p: { dip: 1, face: { eyes: "down", mouth: "tight" }, hold: { ...readHold("half"), at: [READ_AT[0], READ_AT[1] - 5] } }, extra: { cue: "open" } },
  { ms: 130, p: { dip: 1, face: { eyes: "readL", mouth: "tight" }, hold: readHold("read") } },
  { ms: 110, p: { dip: 1, face: { eyes: "readR", mouth: "tight" }, hold: readHold("read") } },
  { ms: 110, p: { dip: 1, face: { eyes: "readL", mouth: "tight" }, hold: readHold("read") } },
  { ms: 140, p: { dip: 1, face: { eyes: "readR", mouth: "tight" }, hold: readHold("read") } },
  { ms: 300, p: { dip: 1, face: { eyes: "ahead", brows: "twitch" }, hold: readHold("read") } },
  { ms: 70, p: { dip: 1, face: { eyes: "hard", brows: "hard", mouth: "tight" }, hold: readHold("flat") }, extra: { cue: "snap", shake: [0, 1], specks: puff([READ_AT[0], READ_AT[1] - 2], 0) } },
  { ms: 90, p: { face: { eyes: "ahead" }, hold: readHold("flat") }, extra: { specks: puff([READ_AT[0], READ_AT[1] - 2], 1) } },
  { ms: 90, p: { face: { eyes: "ahead" }, hold: lift(ph) }, extra: { specks: puff([READ_AT[0], READ_AT[1] - 2], 2) } },
  { ms: 140, p: {} },
];

/**
 * The stare (his entrance): his eyes drop, his head dips (cue `dip`), then his eyes roll up to us from under his brows
 * and hold, dead still (cue `stare`); then he lifts his head again. The book stays where it is.
 */
const STARE: Spec[] = [
  { ms: 140, p: {} },
  { ms: 110, p: { face: { eyes: "down", mouth: "tight" } } },
  { ms: 110, p: { dip: 1, face: { eyes: "down", mouth: "tight" } }, extra: { cue: "dip" } },
  { ms: 130, p: { dip: 2, face: { eyes: "down", brows: "hard", mouth: "tight" } } },
  { ms: 110, p: { dip: 2, face: { eyes: "ahead", brows: "hard", mouth: "tight" } } },
  { ms: 1300, p: { dip: 2, face: { eyes: "hard", brows: "hard", mouth: "stern" } }, extra: { cue: "stare" } },
  { ms: 110, p: { dip: 1, face: { eyes: "ahead", brows: "hard" } } },
  { ms: 160, p: {} },
];

/** The laugh's beats: head back, shoulders shaking; then forward with a wild-eyed grin. */
const back = (ms: number, shake: number, mouth: Mouth = "laugh"): Spec => ({ ms, p: { headDy: -2, breath: 1, shake, tie: shake, face: { eyes: "squeeze", brows: "up", mouth } } });
const fwd = (ms: number, shake: number, mouth: Mouth = "grin"): Spec => ({ ms, p: { headDy: 1, shake, tie: -shake, face: { eyes: "wild", brows: "wild", mouth } } });
/**
 * The laugh (one-shot): short and a little unhinged. His head goes back (cue `laugh`), shoulders shaking, then forward
 * with a wild-eyed grin (cue `cackle`), still shaking; a beat of that wild look, and he's stern again.
 */
const LAUGH: Spec[] = [
  { ms: 120, p: { face: { eyes: "ahead", brows: "stern", mouth: "tight" } } },
  { ms: 80, p: { headDy: -1, face: { eyes: "squeeze", brows: "up", mouth: "grin" } }, extra: { cue: "laugh" } },
  back(90, 0),
  back(80, 1),
  back(80, -1, "grin"),
  back(80, 1),
  back(80, -1, "grin"),
  back(80, 1),
  fwd(90, 0),
  { ...fwd(80, 1), extra: { cue: "cackle" } },
  fwd(80, -1, "laugh"),
  fwd(80, 1),
  fwd(80, -1, "laugh"),
  fwd(80, 0),
  { ms: 420, p: { headDy: 1, face: { eyes: "wild", brows: "wild", mouth: "grin" } } },
  { ms: 120, p: { face: { eyes: "hard", brows: "hard", mouth: "tight" } } },
  { ms: 160, p: { face: { eyes: "ahead", brows: "stern", mouth: "tight" } } },
];

/** Raised to us like a spell book: in front of his chest, both hands on its lower corners. */
export const SPELL_AT: Pt = [46, 45];
const spellHold = (book: BookState): Partial<Hold> => ({ book, at: SPELL_AT, clutched: false, elbowR: [31, 52], wristR: [34, 52], elbowL: [61, 52], wristL: [58, 52] });
const FLUTTER: readonly BookState[] = ["flutter1", "flutter2", "flutter3", "open"];
const wild = (mouth: Mouth): Partial<Face> => ({ eyes: "wild", brows: "wild", mouth });

/**
 * The spellbook (his ultimate; one-shot, then `spellLoop` for as long as it runs, then `spellClose`): he raises the
 * book (cue `raise`) and it falls open to us like a spell book (cue `open`); its pages flutter, a glow and little stars
 * rise off them, his hair lifts and streams in the wind, his eyes go wide and the unhinged laugh plays over it (cue
 * `laugh`, then `cackle`).
 */
const SPELLBOOK = (ph: Ph): Spec[] => [
  { ms: 110, p: { face: { eyes: "ahead", mouth: "stern" } } },
  { ms: 100, p: { face: { eyes: "hard", brows: "hard", mouth: "tight" }, hold: ph === 1 ? { at: [40, 54], elbowR: [31, 58], wristR: [37, 61] } : upHold("closed", 52) }, extra: { cue: "raise" } },
  { ms: 100, p: { breath: 1, face: { eyes: "hard", brows: "hard", mouth: "tight" }, hold: upHold("closed", 50) } },
  { ms: 90, p: { breath: 1, wind: 1, face: wild("grin"), hold: spellHold("open") }, extra: { cue: "open", specks: glow(SPELL_AT, 0), pal: LIT(0) } },
  { ms: 90, p: { breath: 1, wind: 2, face: wild("laugh"), hold: spellHold("flutter1"), headDy: -1 }, extra: { cue: "laugh", specks: glow(SPELL_AT, 1), pal: LIT(1) } },
  { ms: 90, p: { breath: 1, wind: 3, face: wild("laugh"), hold: spellHold("flutter2"), headDy: -1, shake: 1, tie: 1 }, extra: { specks: glow(SPELL_AT, 2), pal: LIT(2) } },
  { ms: 90, p: { breath: 1, wind: 1, face: wild("grin"), hold: spellHold("flutter3"), headDy: -1, shake: -1, tie: -1 }, extra: { specks: glow(SPELL_AT, 3), pal: LIT(3) } },
  { ms: 90, p: { breath: 1, wind: 2, face: wild("laugh"), hold: spellHold("open"), shake: 1, tie: 1 }, extra: { cue: "cackle", specks: glow(SPELL_AT, 4), pal: LIT(4) } },
  { ms: 90, p: { breath: 1, wind: 3, face: wild("grin"), hold: spellHold("flutter1"), shake: -1, tie: -1 }, extra: { specks: glow(SPELL_AT, 5), pal: LIT(5) } },
  { ms: 90, p: { breath: 1, wind: 1, face: wild("laugh"), hold: spellHold("flutter2") }, extra: { specks: glow(SPELL_AT, 6), pal: LIT(6) } },
  { ms: 90, p: { breath: 1, wind: 2, face: wild("grin"), hold: spellHold("flutter3") }, extra: { specks: glow(SPELL_AT, 7), pal: LIT(7) } },
];
/** The spell held (loop, 0.8 s): the book open and glowing, its pages turning over, his hair streaming, his wild grin. */
const SPELL_LOOP: Spec[] = Array.from({ length: 8 }, (_, i) => ({
  ms: 100,
  p: { breath: 1, wind: ((i % 3) + 1) as Wind, face: wild(i === 2 || i === 6 ? "laugh" : "grin"), hold: spellHold(FLUTTER[i % 4]!), tie: i % 2 ? 1 : 0 },
  extra: { specks: glow(SPELL_AT, i), pal: LIT(i) },
}));
/** The spell's end (one-shot): he slams the book shut (cue `slam`), a puff of page dust; his hair falls (phase 1); a glare. */
const SPELL_CLOSE = (ph: Ph): Spec[] => [
  { ms: 90, p: { breath: 1, wind: 2, face: wild("grin"), hold: spellHold("open") }, extra: { specks: glow(SPELL_AT, 0), pal: LIT(0) } },
  { ms: 70, p: { breath: 1, wind: 3, face: { eyes: "hard", brows: "hard", mouth: "grit" }, hold: upHold("closed", 47) }, extra: { cue: "slam", shake: [0, 1], specks: puff([46, 40], 0, 14) } },
  { ms: 90, p: { wind: 1, face: { eyes: "hard", brows: "hard", mouth: "grit" }, hold: upHold("closed", 48) }, extra: { specks: puff([46, 40], 1, 14) } },
  { ms: 90, p: { face: { eyes: "hard", brows: "hard", mouth: "tight" }, hold: upHold("closed", 49) }, extra: { specks: puff([46, 40], 2, 14) } },
  { ms: 420, p: { dip: 1, face: { eyes: "hard", brows: "hard", mouth: "stern" }, hold: upHold("closed", 50) } },
  { ms: 100, p: { face: { eyes: "ahead" }, hold: ph === 1 ? { at: [40, 54], elbowR: [31, 58], wristR: [37, 61] } : upHold("closed", 52) } },
  { ms: 140, p: {} },
];

/**
 * The slam (a decisive move): he swings the book out in front of him, flips it open (cue `open`), and slams it shut
 * hard (cue `slam`), the frame shaking and page dust puffing out; a hard look at us, and he takes it back.
 */
const SLAM = (ph: Ph): Spec[] => [
  { ms: 100, p: { face: { eyes: "down", mouth: "tight" } } },
  { ms: 90, p: { face: { eyes: "down", brows: "hard", mouth: "tight" }, hold: lift(ph) } },
  { ms: 90, p: { dip: 1, face: { eyes: "down", brows: "hard", mouth: "tight" }, hold: readHold("flat") } },
  { ms: 90, p: { dip: 1, face: { eyes: "down", brows: "hard", mouth: "tight" }, hold: readHold("read") }, extra: { cue: "open" } },
  { ms: 200, p: { dip: 1, face: { eyes: "readR", brows: "hard", mouth: "tight" }, hold: readHold("read") } },
  { ms: 60, p: { breath: 1, face: { eyes: "hard", brows: "hard", mouth: "grit" }, hold: { ...readHold("half"), at: [READ_AT[0], READ_AT[1] - 5] } } },
  { ms: 80, p: { dip: 1, face: { eyes: "hard", brows: "hard", mouth: "grit" }, hold: readHold("flat") }, extra: { cue: "slam", shake: [0, 1], specks: puff([READ_AT[0], READ_AT[1] - 2], 0, 18) } },
  { ms: 90, p: { dip: 1, face: { eyes: "hard", brows: "hard", mouth: "grit" }, hold: readHold("flat") }, extra: { specks: puff([READ_AT[0], READ_AT[1] - 2], 1, 18) } },
  { ms: 90, p: { dip: 1, face: { eyes: "hard", brows: "hard", mouth: "tight" }, hold: readHold("flat") }, extra: { specks: puff([READ_AT[0], READ_AT[1] - 2], 2, 18) } },
  { ms: 420, p: { dip: 1, face: { eyes: "hard", brows: "hard", mouth: "stern" }, hold: readHold("flat") } },
  { ms: 90, p: { face: { eyes: "ahead" }, hold: lift(ph) } },
  { ms: 140, p: {} },
];

/** Kneeling and slumped, his arms limp, hands on his thighs; the book on the ground in front of his knees. */
const ON_GROUND: Pt = [46, 125];
const SLUMP: Partial<Hold> = { book: "flat", at: ON_GROUND, loose: true, clutched: false, elbowR: [32, 58], wristR: [38, 78], elbowL: [60, 58], wristL: [55, 78] };
/**
 * The collapse (phase 1 beaten; one-shot, then `collapseLoop`): stunned, he reels (cue `reel`), his knees buckle and
 * the book slips from under his arm (cue `drop`), he drops to his knees (cue `thud`), the book lands flat beside him
 * (cue `book`) and he slumps forward.
 */
const COLLAPSE: Spec[] = [
  { ms: 140, p: { face: { eyes: "wild", brows: "up", mouth: "tight" } }, extra: { cue: "reel" } },
  { ms: 110, p: { shake: -1, dip: 1, face: { eyes: "wild", brows: "up", mouth: "mumble2" } } },
  { ms: 80, p: { stance: "rise", shake: -1, dip: 2, face: { eyes: "down", brows: "up", mouth: "mumble2" }, hold: { at: [33, 53], elbowR: [32, 60], wristR: [38, 66] } } },
  { ms: 80, p: { stance: "bend", dip: 2, face: { eyes: "down", brows: "up", mouth: "tight" }, hold: { book: "spin45", at: [32, 86], loose: true, elbowR: [32, 58], wristR: [33, 76], elbowL: [61, 58], wristL: [59, 78] } }, extra: { cue: "drop" } },
  { ms: 70, p: { stance: "low", dip: 2, face: { eyes: "shut", brows: "up", mouth: "tight" }, hold: { ...SLUMP, book: "spin90", at: [38, 108] } } },
  { ms: 90, p: { stance: "kneel", dip: 3, face: { eyes: "shut", brows: "up", mouth: "tight" }, hold: { ...SLUMP, book: "spin135", at: [42, 115] } }, extra: { cue: "thud", shake: [0, 1] } },
  { ms: 100, p: { stance: "kneel", dip: 3, face: { eyes: "down", brows: "up", mouth: "tight" }, hold: SLUMP }, extra: { cue: "book", specks: puff(ON_GROUND, 0, 18) } },
  { ms: 100, p: { stance: "kneel", dip: 5, headDy: 1, shake: 0, face: { eyes: "down", brows: "up", mouth: "tight" }, hold: SLUMP }, extra: { specks: puff(ON_GROUND, 1, 18) } },
  { ms: 300, p: { stance: "kneel", dip: 6, face: { eyes: "down", brows: "up", mouth: "mumble3" }, hold: SLUMP }, extra: { specks: puff(ON_GROUND, 2, 18) } },
];
/** Slumped on his knees (loop, 1.4 s): rocking a little, his lips moving fast, mumbling to himself; a twitch, a blink. */
const COLLAPSE_LOOP: Spec[] = Array.from({ length: 16 }, (_, i) => {
  const rock = [0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 1, 1, 0, 0][i]!;
  const mouth = (["mumble1", "mumble3", "mumble2", "mumble3", "mumble1", "mumble2", "tight", "mumble1", "mumble3", "mumble2", "mumble1", "tight", "mumble2", "mumble3", "mumble1", "tight"] as const)[i]!;
  return { ms: 90, p: { stance: "kneel", dip: 6 + (i % 4 === 2 ? 1 : 0), headDx: rock, face: { eyes: i === 9 ? "shut" : "down", brows: i === 5 ? "twitch" : "up", mouth }, hold: SLUMP } };
});

/** The book flying back to his hand as he revives: from the ground, spinning up in an arc. */
const flyBack = (spin: BookState, at: Pt): Partial<Hold> => ({ book: spin, at, loose: true, clutched: false, elbowR: [29, 53], wristR: [28, 62], elbowL: [62, 56], wristL: [60, 72] });
/**
 * The revival (one-shot, into phase 2): he rises slowly from the slump, head down (cue `rise`), then snaps upright (cue
 * `snap`): his hair lifts and starts to stream, his eyes narrow, a glint in them, and the book flies up off the ground
 * spinning into his hand (cue `catch`). It ends in phase 2's rest.
 */
const REVIVE: Spec[] = [
  { ms: 220, p: { stance: "kneel", dip: 6, face: { eyes: "shut", brows: "up", mouth: "tight" }, hold: SLUMP } },
  { ms: 220, p: { stance: "kneel", dip: 4, face: { eyes: "down", brows: "stern", mouth: "tight" }, hold: SLUMP }, extra: { cue: "rise" } },
  { ms: 200, p: { stance: "low", dip: 4, face: { eyes: "down", brows: "stern", mouth: "tight" }, hold: { ...SLUMP, elbowR: [32, 58], wristR: [35, 77], elbowL: [61, 58], wristL: [57, 78] } } },
  { ms: 200, p: { stance: "bend", dip: 3, face: { eyes: "down", brows: "stern", mouth: "tight" }, hold: { ...SLUMP, elbowR: [32, 58], wristR: [33, 76], elbowL: [61, 58], wristL: [59, 78] } } },
  { ms: 180, p: { stance: "rise", dip: 3, face: { eyes: "down", brows: "hard", mouth: "tight" }, hold: { ...SLUMP, elbowR: [32, 59], wristR: [33, 78], elbowL: [60, 59], wristL: [60, 80] } } },
  { ms: 200, p: { stance: "wide", dip: 3, face: { eyes: "down", brows: "hard", mouth: "tight" }, hold: { ...SLUMP, elbowR: [32, 60], wristR: [33, 80], elbowL: [60, 60], wristL: [60, 81] } } },
  { ms: 70, p: { phase: 2, stance: "wide", wind: 1, face: { eyes: "narrow", brows: "hard", mouth: "tight" }, hold: flyBack("spin45", [38, 112]) }, extra: { cue: "snap", shake: [0, -1] } },
  { ms: 70, p: { phase: 2, stance: "wide", wind: 2, face: { eyes: "narrow", brows: "hard", mouth: "tight" }, hold: flyBack("spin135", [30, 98]) } },
  { ms: 70, p: { phase: 2, stance: "wide", wind: 3, face: { eyes: "narrow", brows: "hard", mouth: "tight" }, hold: flyBack("spin225", [29, 82]) } },
  { ms: 70, p: { phase: 2, stance: "wide", wind: 1, face: { eyes: "narrow", brows: "hard", mouth: "stern" }, hold: flyBack("spin315", [31, 68]) } },
  { ms: 90, p: { phase: 2, stance: "wide", wind: 2, face: { eyes: "hard", brows: "hard", mouth: "stern" }, hold: { ...upHold("closed", 56), at: [40, 58], elbowR: [30, 56], wristR: [34, 60] } }, extra: { cue: "catch", shake: [1, 0] } },
  { ms: 130, p: { phase: 2, wind: 3, face: { eyes: "hard", brows: "hard", mouth: "stern" } } },
  { ms: 130, p: { phase: 2, wind: 1, face: { eyes: "ahead", brows: "stern", mouth: "stern" } } },
  { ms: 130, p: { phase: 2, wind: 2 } },
];

// ---- The phase change (Eric, Oct 14): beaten, he gets up in a rage, leaps onto the middle of the board, throws the book
// down at his feet, and chants over it as light pours out of it (his hair lifting: phase 2 begins); the boards crack and
// split; the book flies back up into his hands and he leaps back to his place. The board draws him (Recluse2.tsx);
// only `rage` plays where he stands, so it alone is in the bust too.

const ANGRY: Partial<Face> = { eyes: "glare", brows: "fury", mouth: "scowl" };
/**
 * Up in a rage (one-shot, from `collapseLoop`; his place, both drawings): his brows come down, his head snaps up
 * glaring at us, teeth gritted, shaking (cue `rise`); he gets up, and the book flies up off the ground (cue `snatch`)
 * into his hand, clutched at his side again (cue `catch`); he stands trembling, his free hand a fist.
 */
const RAGE: Spec[] = [
  { ms: 160, p: { stance: "kneel", dip: 6, face: { eyes: "down", brows: "hard", mouth: "tight" }, hold: SLUMP } },
  { ms: 180, p: { stance: "kneel", dip: 3, shake: 1, face: ANGRY, hold: SLUMP }, extra: { cue: "rise" } },
  { ms: 120, p: { stance: "kneel", dip: 3, shake: -1, face: ANGRY, hold: SLUMP } },
  { ms: 110, p: { stance: "low", dip: 2, face: ANGRY, hold: { ...SLUMP, elbowR: [32, 58], wristR: [35, 77], elbowL: [61, 58], wristL: [57, 78] } } },
  { ms: 80, p: { stance: "bend", dip: 1, face: ANGRY, hold: flyBack("spin45", [38, 112]) }, extra: { cue: "snatch" } },
  { ms: 70, p: { stance: "rise", face: ANGRY, hold: flyBack("spin135", [31, 96]) } },
  { ms: 70, p: { face: ANGRY, hold: flyBack("spin225", [29, 80]) } },
  { ms: 90, p: { face: ANGRY, fist: true }, extra: { cue: "catch", shake: [1, 0] } },
  { ms: 150, p: { face: ANGRY, fist: true, shake: 1, breath: 1 } },
  { ms: 150, p: { face: ANGRY, fist: true, shake: -1, breath: 1 } },
  { ms: 150, p: { face: ANGRY, fist: true, shake: 1, breath: 1 } },
];

/** Where his feet raise the dust as he lands. */
const LANDING: Pt = [46, 127];
/**
 * A leap (the board draws it along its arc): a crouch (cue `jump`), off the ground at its end, up and through the air
 * (no shadow under him: the board draws one where he'll come down), landing hard in a deep crouch (cue `land`) with a
 * burst of dust, and up again. Phase 1 (`leap`, onto the middle) in his rage; phase 2 (`leap2`, back to his place) just
 * the crouch and the flight: he's gone before he lands.
 */
const LEAP = (ph: Ph): Spec[] => {
  const f: ReclusePose = { face: ph === 1 ? ANGRY : { eyes: "hard", brows: "hard", mouth: "stern" }, fist: true };
  return [
    { ms: 120, p: { ...f, stance: "bend", dip: 1 }, extra: { cue: "jump" } },
    { ms: 80, p: { ...f, air: true, breath: 1, headDy: -1 } },
    { ms: 480, p: { ...f, air: true, stance: "bend", tie: 1 } },
    { ms: 90, p: { ...f, stance: "low", dip: 1 }, extra: { cue: "land", shake: [0, 1], specks: puff(LANDING, 0, 28) } },
    { ms: 90, p: { ...f, stance: "bend" }, extra: { specks: puff(LANDING, 1, 28) } },
    { ms: 110, p: f, extra: { specks: puff(LANDING, 2, 28) } },
  ];
};

/** Where the book lies open at his feet (a little higher than closed: it is taller, and it lands with a jolt). */
const OPEN_ON_GROUND: Pt = [ON_GROUND[0], ON_GROUND[1] - 2];
/** Brandished over his head in his book hand (his free hand a fist). */
const BRANDISH: Partial<Hold> = { book: "closed", at: [27, 12], clutched: false, loose: false, oneHand: true, elbowR: [24, 32], wristR: [27, 23] };
/** The book lying open on the ground at his feet, his arms down, his hands fists. */
const AT_HIS_FEET: Partial<Hold> = { book: "read", at: OPEN_ON_GROUND, loose: true, clutched: false, elbowR: [31, 60], wristR: [34, 80], elbowL: [61, 60], wristL: [59, 80] };
/**
 * Throwing the book down (one-shot, on the board): he lifts it from his side (cue `raise`) and brandishes it over his
 * head, shaking, shouting at us; then swings it down at his feet (cue `throw`), where it lands open (cue `thud`) in a
 * puff of dust, and he glares down at it.
 */
const DROP: Spec[] = [
  { ms: 100, p: { face: ANGRY, fist: true, hold: { at: [40, 54], elbowR: [31, 58], wristR: [37, 61] } }, extra: { cue: "raise" } },
  { ms: 80, p: { face: ANGRY, fist: true, breath: 1, hold: { ...BRANDISH, at: [30, 32], elbowR: [26, 44], wristR: [30, 43] } } },
  { ms: 240, p: { face: ANGRY, fist: true, breath: 1, shake: 1, hold: BRANDISH } },
  { ms: 130, p: { face: { ...ANGRY, mouth: "shout" }, fist: true, breath: 1, shake: -1, headDy: -1, hold: BRANDISH } },
  { ms: 130, p: { face: ANGRY, fist: true, breath: 1, shake: 1, hold: BRANDISH } },
  { ms: 60, p: { face: ANGRY, fist: true, hold: { book: "spin90", at: [27, 72], loose: true, clutched: false, elbowR: [28, 52], wristR: [31, 66] } }, extra: { cue: "throw" } },
  { ms: 60, p: { face: { ...ANGRY, eyes: "down" }, fist: true, dip: 1, hold: { book: "spin180", at: [38, 104], loose: true, clutched: false, elbowR: [31, 58], wristR: [34, 76] } } },
  { ms: 90, p: { face: { ...ANGRY, eyes: "down" }, fist: true, dip: 2, hold: AT_HIS_FEET }, extra: { cue: "thud", shake: [0, 1], specks: puff(OPEN_ON_GROUND, 0, 26) } },
  { ms: 90, p: { face: { ...ANGRY, eyes: "down" }, fist: true, dip: 2, hold: AT_HIS_FEET }, extra: { specks: puff(OPEN_ON_GROUND, 1, 26) } },
  { ms: 220, p: { face: { ...ANGRY, eyes: "down" }, fist: true, dip: 2, hold: AT_HIS_FEET }, extra: { specks: puff(OPEN_ON_GROUND, 2, 26) } },
];

/**
 * Light rising off the book lying open at his feet (its middle in drawing space), at a point of its loop (0 to 7):
 * motes and little four-point stars climbing in front of his legs, pale to gold to ember as they rise, never as high as
 * his face; a glow along the pages' top edge.
 */
function rising([x, y]: Pt, i: number): Speck[] {
  const out: Speck[] = [];
  for (let n = 0; n < 14; n++) {
    const life = (i + n * 3) % 8; // 0 just off the pages .. 7 gone
    if (life > 6) continue;
    const X = x - 13 + ((n * 7) % 27) + Math.round(Math.sin((life + n) * 1.3) * 1.2);
    const Y = y - 5 - life * (6 + (n % 3) * 2);
    const k = life < 2 ? "8" : life < 5 ? "9" : "0";
    out.push(sp([X, Y], k));
    if (n % 3 === 0 && life > 0 && life < 4) out.push(sp([X - 1, Y], k), sp([X + 1, Y], k), sp([X, Y - 1], k), sp([X, Y + 1], k));
  }
  for (let dx = -12; dx <= 12; dx += 2) if ((dx / 2 + i) % 3) out.push(sp([x + dx + (i % 2), y - 5], (dx / 2 + i) % 3 === 1 ? "9" : "8"));
  return out;
}
/** The book open at his feet, lit from within, his arms raised (elbows out, forearms up) and his hands open. */
const overBook = (elbowR: Pt, wristR: Pt, elbowL: Pt, wristL: Pt): Partial<Hold> => ({ book: "read", at: OPEN_ON_GROUND, loose: true, clutched: false, elbowR, wristR, elbowL, wristL });
/**
 * The chant begins (one-shot, phase 2's face from here: the light is his power coming back): the pages light up (cue
 * `light`), his hair lifts, his eyes go wild, his arms rise.
 */
const CHANT_RAISE: Spec[] = [
  { ms: 110, p: { wind: 1, fist: true, face: { eyes: "wild", brows: "up", mouth: "tight" }, hold: { ...AT_HIS_FEET, elbowR: [29, 56], wristR: [27, 70], elbowL: [63, 56], wristL: [65, 70] } }, extra: { cue: "light", specks: rising(OPEN_ON_GROUND, 0), pal: LIT(0) } },
  { ms: 110, p: { wind: 2, palms: true, face: { eyes: "wild", brows: "up", mouth: "laugh" }, hold: overBook([25, 44], [22, 30], [67, 44], [70, 30]) }, extra: { specks: rising(OPEN_ON_GROUND, 1), pal: LIT(1) } },
];
/** The chant (loop, 0.8 s): his arms raised over the book, swaying, his mouth working, his hair streaming in the light. */
const CHANT: Spec[] = Array.from({ length: 8 }, (_, i) => {
  const sway = [0, 1, 2, 1, 0, -1, -2, -1][i]!;
  return {
    ms: 100,
    p: { wind: ((i % 3) + 1) as Wind, palms: true, headDy: -1, tie: sway > 0 ? 1 : sway < 0 ? -1 : 0, face: { eyes: "wild", brows: "up", mouth: (["laugh", "mumble1", "mumble2", "mumble1"] as const)[i % 4] }, hold: overBook([24, 33 - sway], [22 + sway, 15 - sway], [68, 33 + sway], [70 + sway, 15 + sway]) },
    extra: { specks: rising(OPEN_ON_GROUND, i), pal: LIT(i) },
  };
});
/**
 * The book back in his hands (one-shot, phase 2): his arms come down as the light dies, and the book snaps shut and
 * flies up spinning into his hands (his revive's own frames: cues `snap`, `catch`), held ready in front of him.
 */
const PICKUP: Spec[] = [{ ms: 120, p: { wind: 3, face: { eyes: "narrow", brows: "hard", mouth: "tight" }, hold: { ...AT_HIS_FEET, elbowR: [31, 58], wristR: [33, 78], elbowL: [61, 58], wristL: [59, 78] } }, extra: { pal: LIT(0) } }, ...REVIVE.slice(6)];

/** His leaps' beats (ms into `leap`, `leap2`): off the ground (the crouch's end) and landing (cue `land`). */
export const RECLUSE_JUMP = (() => {
  const specs = LEAP(1);
  const landAt = specs.slice(0, specs.findIndex((s) => s.extra?.cue === "land")).reduce((t, s) => t + s.ms, 0);
  return { upAt: specs[0]!.ms, landAt };
})();

const anims = (bust: boolean): Record<string, Anim> => ({
  idle: { loop: true, frames: build(IDLE, bust) },
  consult: { loop: false, frames: build(CONSULT(1), bust) },
  stare: { loop: false, frames: build(STARE, bust) },
  laugh: { loop: false, frames: build(LAUGH, bust) },
  spellbook: { loop: false, frames: build(SPELLBOOK(1), bust) },
  spellLoop: { loop: true, frames: build(SPELL_LOOP, bust) },
  spellClose: { loop: false, frames: build(SPELL_CLOSE(1), bust) },
  slam: { loop: false, frames: build(SLAM(1), bust) },
  collapse: { loop: false, frames: build(COLLAPSE, bust) },
  collapseLoop: { loop: true, frames: build(COLLAPSE_LOOP, bust) },
  revive: { loop: false, frames: build(REVIVE, bust) },
  idle2: { loop: true, frames: build(IDLE2, bust, 2) },
  consult2: { loop: false, frames: build(CONSULT(2), bust, 2) },
  stare2: { loop: false, frames: build(STARE, bust, 2) },
  laugh2: { loop: false, frames: build(LAUGH, bust, 2) },
  spellbook2: { loop: false, frames: build(SPELLBOOK(2), bust, 2) },
  spellLoop2: { loop: true, frames: build(SPELL_LOOP, bust, 2) },
  spellClose2: { loop: false, frames: build(SPELL_CLOSE(2), bust, 2) },
  slam2: { loop: false, frames: build(SLAM(2), bust, 2) },
  // The phase change: up in a rage where he stands; the rest only on the board, as the whole figure.
  rage: { loop: false, frames: build(RAGE, bust) },
  ...(bust
    ? {}
    : {
        leap: { loop: false, frames: build(LEAP(1), bust) },
        drop: { loop: false, frames: build(DROP, bust) },
        chantRaise: { loop: false, frames: build(CHANT_RAISE, bust, 2) },
        chant: { loop: true, frames: build(CHANT, bust, 2) },
        pickup: { loop: false, frames: build(PICKUP, bust, 2) },
        leap2: { loop: false, frames: build(LEAP(2).slice(0, 3), bust, 2) },
      }),
});
/** The phase change's animations the board plays (the whole figure only). */
export const ON_BOARD_ANIMS = ["leap", "drop", "chantRaise", "chant", "pickup", "leap2"] as const;
/** Where the book lies open at his feet (`drop`, the chant, `pickup`'s start), in the whole figure's frame pixels. */
export const BOOK_ON_GROUND = [OX + OPEN_ON_GROUND[0], OY + OPEN_ON_GROUND[1]] as const;

/** The whole standing figure (a computer, at 2x by the board's corner). */
export const RECLUSE: Character = {
  id: "recluse",
  name: "Hidden Boss",
  w: W,
  h: H,
  foot: [OX + 46, OY + GROUND],
  palette: RECLUSE_PALETTE,
  halo: "#2a2733",
  parts: PARTS,
  anims: anims(false),
};

/** The bust's window on his drawing space: from above his hair (the wind, the glow) down to his chest. */
const BUST = { x0: 21, y0: -10, w: 50, h: 70 } as const;
const toBust = (f: Frame): Frame => {
  const dx = -OX - BUST.x0;
  const dy = -OY - BUST.y0;
  return {
    ...f,
    layers: f.layers.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy })),
    ...(f.specks ? { specks: f.specks.map(([x, y, k]): Speck => [x + dx, y + dy, k]).filter(([x, y]) => x >= 1 && y >= 1 && x <= BUST.w - 2) } : {}),
  };
};

/**
 * The bust (a phone's boss bar): head, shoulders and the top of the book, cut at the chest; the same animations (the
 * book comes and goes at the picture's foot as he lifts it to read; kneeling, he sinks only part of the way).
 */
export const RECLUSE_BUST: Character = {
  id: "recluse-bust",
  name: "Hidden Boss (bust)",
  w: BUST.w,
  h: BUST.h,
  foot: [46 - BUST.x0, BUST.h],
  palette: RECLUSE_PALETTE,
  halo: "#2a2733",
  parts: PARTS,
  anims: Object.fromEntries(Object.entries(anims(true)).map(([n, a]) => [n, { ...a, frames: a.frames.map(toBust) }])),
};

/** The part of him a portrait shows (his face and hair), in the full figure's frame pixels. */
export const RECLUSE_PORTRAIT = { x: OX + HEAD_AT[0] - 2, y: OY - 1, w: 29, h: 36 } as const;
