/**
 * The hippo gardener (Eric, Oct 20: "a hippo who waters plants and plants seeds"; no name yet, his id is `gardener`). After
 * Eric's reference picture, redrawn: an upright hippo with intentionally realistic proportions (a heavy barrel body, short
 * thick legs, a big square muzzle with two nostrils and a soft smile, small round ears, pinkish-grey skin with a pinker
 * belly, throat and cheeks) and no clothes (Eric, second pass: the apron is gone, and the seeds will come from his hand). He
 * holds a garden hose in both hands: the near hand on a brass-and-green spray nozzle with a spray of water coming out of it
 * (toward the board), the other hand, out at his right side, on the hose where it hangs across his belly. The hose is one
 * piece: from the nozzle it sags across his belly through that hand and goes behind him at his hip; the spare hose is looped
 * behind his back, hidden by his body but for a short curve that shows past his hip (it feeds out from there when he pulls on
 * it). Drawn three-quarters on, facing our left (as Alfil, Sawyer, Chub & Chirp, Smudgy and Moo), so he sprays toward the
 * board; light from the top left.
 *
 * His still is the first frame of `idle` (docs/decisions/2026-10-20-gardener-still.md, approved by Eric: a test keeps its pixels), and
 * his animation pack is below (docs/decisions/2026-10-21-gardener-animations.md): every animation the other bosses have, his own
 * moments (planting, the watering, a cheer, a bigger cheer and a shrug for the lottery) and his attack on a king (`GARDENER_ATTACK`).
 * He isn't in `CHARACTERS`, `BOSS_KITS` or the roster, and nothing in the game draws him yet; the preview draws him with its `extra=`
 * option. His board art (the seeds, the watering, the sprout and what it turns into) is `effects/gardener.ts`.
 *
 * Rigging, so the poses that follow are numbers (`GardenerPose`), as the other bosses':
 * - the nozzle hand (`fist`, `elbowN`, `nozzle`: it aims; `grab`: the hand open off the nozzle, which then hangs on its hose) and the
 *   water spray, a part of its own (`spray`: its length, droop and flicker: it turns on and off and arcs over the board, up from a
 *   raised nozzle and down from a lowered one);
 * - the other arm (`hand`, `elbowF`: it holds the hose, hauls it out, lets go, shrugs; `lift`: both shoulders up), and the hose,
 *   which is redrawn from the nozzle through that hand to his hip wherever they go (`sag`: how far it hangs across his belly), with
 *   the spare behind him (`BACK_LOOP`, `loop`: how much of it is still looped there, the rest fed out);
 * - the head moves as one (`head`), with the jaw a part of its own (`jaw`: degrees open, a great yawn or roar), the ears
 *   (`earN`, `earF`: they flick), the eyes (`eyes`) and the tail (`tail`);
 * - his legs step (`stepN`, `stepF`) and he breathes (`bob`).
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { KING_ATTACK } from "@chessroyale/chess";
import { groundShadow, moved } from "./attack-frame.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

export const GARDENER_PALETTE: Record<string, string> = {
  k: "#1d1019", // outline
  a: "#6c404b", // his grey-mauve skin: dark to light
  b: "#8d5762",
  c: "#aa7079",
  d: "#c88f8e",
  e: "#e0aba3",
  f: "#b5545f", // the pink of his belly, throat, cheeks and ears: dark to light
  g: "#d6747b",
  h: "#f0a191",
  i: "#f8c4b0",
  m: "#7d5f6a", // his muzzle, a greyer mauve: dark to light
  n: "#9b7b83",
  o: "#b69498",
  q: "#cdadad",
  u: "#46303c", // nails and knuckles: dark, light
  v: "#7b6068",
  x: "#1b0e15", // eyes
  w: "#ffffff", // glints, petals
  y: "#4a1f2e", // nostrils, the line of his mouth
  X: "#7a2a38", // the inside of his mouth, his tongue, his tusks
  W: "#d4636e",
  T: "#f3ead2",
  t: "#cdbf9f",
  E: "#17483f", // the hose: deep teal green, dark to light
  F: "#22705a",
  G: "#33a479",
  H: "#7fe0ae",
  J: "#7a4f0e", // brass: dark to light (the game's gold at the top)
  K: "#b87a14",
  L: "#f2c14e",
  M: "#ffe58a",
  "1": "#2a6fc2", // water: deep to pale
  "2": "#4fa3ee",
  "3": "#8bcdfb",
  "4": "#d4f0ff",
  "5": "#4a2f1a", // seeds and dirt: dark, mid, light
  "6": "#8a5a2c",
  "7": "#d8a85a",
  z: "#0d0e12", // ground shadow
  "9": "#4d4538", // dust, dark and light
  "0": "#7d705a",
  "~": "#9fd8ff", // sweat
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;

const SKIN = "abcde";
const PINK = "fghi";
const MUZZLE = "mnoq";
const HOSE = "EFGH";
const BRASS = "JKLM";

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const union = (...fs: Inside[]): Inside => (x, y) => fs.some((f) => f(x, y));
const E = inEllipse;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** A patch of pink: an ellipse with a wavering edge, so no patch is a neat oval (`seed` picks the waver). */
function patch(cx: number, cy: number, rx: number, ry: number, seed: number): Inside {
  return (x, y) => {
    const nx = (x + 0.5 - cx) / rx;
    const ny = (y + 0.5 - cy) / ry;
    const a = Math.atan2(ny, nx);
    const r = 1 + 0.12 * Math.sin(3 * a + seed) + 0.07 * Math.sin(5 * a + seed * 2.3);
    return nx * nx + ny * ny <= r * r;
  };
}

// ---- Painting: a part from shapes in the scene's own coordinates (the ground at y `GROUND`), or from strokes.

/** A part painted in the scene: its canvas covers (x0, y0) to (x0 + w, y0 + h). `F` fills where `inside`; `S` stamps pixel rows. */
function painted(
  x0: number,
  y0: number,
  w: number,
  h: number,
  draw: (F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void) => void,
  outline = true,
): { part: Part; at: Pt } {
  const cv: Canvas = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const S = (rows: readonly string[], sx: number, sy: number) =>
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const X = sx + i - x0;
        const Y = sy + j - y0;
        if (k !== "." && cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  draw(F, S);
  return { part: { grid: toGrid(cv), outline }, at: [x0, y0] };
}

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}

/** For a pixel near a stroke: how far along it is (0 to 1), its distance across and the normal, the radius there. */
function along(pts: readonly Pt[], r: readonly number[], p: Pt): { s: number; d: number; nx: number; ny: number; rr: number } {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
  pts.slice(1).forEach((q, i) => {
    const n = nearest(p, pts[i]!, q);
    const rr = r[i]! + (r[i + 1]! - r[i]!) * n.t;
    if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
  });
  return best;
}

/**
 * A stroke through `pts`, `r` its radius at each point; `key` colors a pixel from its light (0 dark to 1 light, lit
 * from the top left across the stroke), how far along it is (0 to 1) and the signed distance across it.
 */
function stroke(pts: readonly Pt[], r: readonly number[], key: (light: number, s: number, across: number) => string, outline = true): { part: Part; at: Pt } {
  const pad = Math.ceil(Math.max(...r)) + 1;
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))) - pad;
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1]))) - pad;
  const w = Math.ceil(Math.max(...pts.map((p) => p[0]))) + pad - x0 + 1;
  const h = Math.ceil(Math.max(...pts.map((p) => p[1]))) + pad - y0 + 1;
  const done = painted(
    x0,
    y0,
    w,
    h,
    (F) => {
      const at = (x: number, y: number) => along(pts, r, [x + 0.5, y + 0.5]);
      F(
        (x, y) => {
          const s = at(x, y);
          return s.d <= s.rr;
        },
        (x, y) => {
          const s = at(x, y);
          const across = s.rr ? (s.nx + s.ny) / (s.rr * Math.SQRT2) : 0;
          return key(0.6 - 0.45 * (s.nx / s.rr) - 0.5 * (s.ny / s.rr), s.s, across);
        },
      );
    },
    outline,
  );
  return done;
}

// ---- Where things are. The scene's ground is at y `GROUND`; the frame adds `OX`, `OY` (room for his poses).

const GROUND = 66;
const OX = 20;
const OY = 30;
const W = OX + 70;
const H = OY + GROUND + 6;
/** The ground point he is placed by (x): between his feet, a little toward his front so the muzzle and the nozzle reach no farther one side than his tail and back do the other. */
const FOOT_X = 35;
/** The middle of his two feet (his shadow's). */
const FEET_X = 35.5;
/** How far his head (the skull, ears, eyes, muzzle and jaw, all painted in one place) stands above where they're painted. */
const HEAD_UP = -2;

// ---- The body: the torso, the legs and feet, the tail.

/** His torso: a barrel, wider at the belly than the chest, the belly bulging toward the front; grey over his back and sides, pink on the belly and throat. */
function torso(): { part: Part; at: Pt } {
  const inside = union(E(38.5, 31, 16.5, 14), E(36.5, 43.5, 19.5, 15));
  const light = roundLight(34, 36, 22, 25, 0.08);
  const belly = patch(30.5, 45.5, 15.5, 12.8, 1.3);
  const throat = patch(31.5, 29.5, 10, 5.5, 2.1);
  return painted(16, 16, 42, 46, (F, S) => {
    F(inside, (x, y) => (belly(x, y) || throat(x, y) ? ramp(PINK, light(x, y) + 0.2) : ramp(SKIN, light(x, y))));
    // The navel: a dark crease and a light touch beside it.
    S(["f", "f"], 31, 50);
    S(["i"], 32, 50);
  });
}

/** The legs' places (x of their middles): the near one in front, the far one behind. */
const LEG_N = 25;
const LEG_F = 46;

/** A leg and its foot, centered at `cx`: a thick column into a wide foot with three nails at the front. `lift` raises the foot. */
function leg(cx: number, lift: number): { part: Part; at: Pt } {
  const column = (x: number, y: number) => Math.abs(x + 0.5 - cx) <= 7 && y >= 52 - lift && y < 60 - lift;
  const foot = E(cx - 0.5, 61.4 - lift, 8.6, 4.2);
  const light = roundLight(cx - 1, 57 - lift, 10, 11, 0.04);
  return painted(Math.floor(cx) - 10, 50 - lift, 21, 20, (F, S) => {
    F(union(column, foot), (x, y) => ramp(SKIN, light(x, y)));
    const x = Math.round(cx) - 8;
    S(["vvv", "uuu"], x, 62 - lift);
    S(["vvv", "uuu"], x + 5, 63 - lift);
    S(["vvv", "uuu"], x + 10, 62 - lift);
  });
}

/** His tail: a short flat paddle off his rump, `swing` pixels up or down at its tip. */
function tail(swing: number): { part: Part; at: Pt } {
  const pts: Pt[] = [[53.5, 48.6], [55.8, 49 + swing * 0.4], [57.6, 49.9 + swing]];
  return stroke(pts, [2, 1.7, 1.4], (l) => ramp(SKIN, l));
}

// ---- His head: the skull and muzzle, the jaw, the mouth inside it, the ears and the eyes.

/** The head's outline: a dome of skull behind, a long square muzzle in front with the nostrils raised on its top. */
const HEAD_POLY: Pt[] = [[26, 5], [31, 4.2], [36, 5], [39.8, 7.8], [41.4, 12], [41, 16.8], [38.6, 20.5], [34.5, 22.8], [28, 23.6], [21, 23.8], [14, 23.6], [10.6, 22.8], [8.8, 20.8], [8.2, 17.6], [8.4, 14.2], [10, 12], [12.6, 11], [15.6, 10.4], [18.6, 9.2], [21.2, 7.2], [23.6, 5.6]];
const NOSE_POLY: Pt[] = [[10.2, 12.6], [11, 10.4], [13.2, 9.8], [14.8, 11.2], [14, 12.8]];
const HEAD_INSIDE = union(inPoly(HEAD_POLY), inPoly(NOSE_POLY));
/** Where the ears and the eyes sit on the skull (their top left). */
const EAR_F: Pt = [24, 2];
const EAR_N: Pt = [36, 3];
const EYE_N: Pt = [33, 9];
const EYE_F: Pt = [25, 8];
/** Where the jaw hinges (under his cheek), and the closed jaw's outline. */
const HINGE: Pt = [33.5, 22.4];
const JAW_POLY: Pt[] = [[11.5, 23.4], [21, 23.9], [28, 23.7], [32, 22.8], [32.4, 25], [30.6, 27.2], [25, 28.4], [19, 28.6], [13.5, 27.2], [10.5, 25]];

/** The skull and the muzzle: grey on top with a greyer muzzle, a soft pink cheek, stubble, two nostrils. */
function head(): { part: Part; at: Pt } {
  const light = roundLight(28, 14, 20, 15, 0.04);
  const cheek = patch(31.4, 17.6, 4.2, 4.5, 0.9);
  // The muzzle is a greyer, darker patch over the front of his face, its edge rounded and not quite regular.
  const snout = union(patch(15.5, 17.6, 11.6, 8.6, 3.1), E(13, 13, 6, 3.6));
  return painted(7, 3, 36, 24, (F, S) => {
    F(HEAD_INSIDE, (x, y) => {
      if (snout(x, y) && x < 26) return ramp(MUZZLE, light(x, y) + (y > 20.5 ? -0.1 : 0.06));
      // The cheek's blush: a patch of pink round his eye and down to the corner of his mouth.
      if (cheek(x, y)) return ramp(PINK, light(x, y) + 0.06);
      return ramp(SKIN, light(x, y) + 0.06);
    });
    // Stubble on the muzzle.
    for (const [x, y] of [[12, 17], [15, 18], [19, 16.5], [11, 20.5], [14.5, 21], [18, 20.5], [21.5, 19], [17, 14]] as Pt[]) S(["m"], x, y);
    // Its nostrils (a pale rim, the dark hole): the one at the tip, and the second behind it.
    S([".nn.", "nyyn", "nyyn"], 9, 10);
    S([".nn.", "nyyn"], 15, 11);
    // A soft smile: his mouth's line curling up into his cheek.
    for (const [x, y] of [[29, 23], [30, 22.4], [31, 22], [32, 21.4], [33, 21], [34, 20.4], [35, 19.6], [35.5, 18.6]] as Pt[]) S(["y"], Math.floor(x), Math.floor(y));
  });
}

/** His lower jaw, hinged at `HINGE`, `open` degrees down: pink at the chin, the lip in the muzzle's grey. */
function jaw(open: number): { part: Part; at: Pt } {
  const th = rad(open);
  const [c, s] = [Math.cos(th), Math.sin(th)];
  const turn = ([x, y]: Pt): Pt => [HINGE[0] + (x - HINGE[0]) * c + (y - HINGE[1]) * s, HINGE[1] - (x - HINGE[0]) * s + (y - HINGE[1]) * c];
  const poly = JAW_POLY.map(turn);
  const inside = inPoly(poly);
  const light = roundLight(22, 24, 14, 8, 0.12);
  const x0 = Math.floor(Math.min(...poly.map((p) => p[0]))) - 1;
  const y0 = Math.floor(Math.min(...poly.map((p) => p[1]))) - 1;
  const x1 = Math.ceil(Math.max(...poly.map((p) => p[0]))) + 1;
  const y1 = Math.ceil(Math.max(...poly.map((p) => p[1]))) + 1;
  return painted(x0, y0, x1 - x0 + 1, y1 - y0 + 1, (F, S) => {
    F(inside, (x, y) => {
      const ux = HINGE[0] + (x + 0.5 - HINGE[0]) * c - (y + 0.5 - HINGE[1]) * s;
      const uy = HINGE[1] + (x + 0.5 - HINGE[0]) * s + (y + 0.5 - HINGE[1]) * c;
      // (In the jaw's own frame: the lip along its top, the chin pink.)
      if (uy < 26 && ux < 29) return ramp(MUZZLE, light(ux, uy) - 0.05);
      return ramp(PINK, light(ux, uy) + 0.1);
    });
    // A tusk standing up from the front of the jaw, once it opens.
    if (open >= 12) {
      const [tx, ty] = turn([14, 24]);
      S(["T", "T", "t"], Math.round(tx), Math.round(ty) - 3);
    }
  });
}

/** The inside of his mouth, behind the jaw and the muzzle: dark, with a tongue along the jaw, only seen as it opens. */
function mouthIn(open: number): { part: Part; at: Pt } {
  const th = rad(open);
  const [c, s] = [Math.cos(th), Math.sin(th)];
  const turn = ([x, y]: Pt): Pt => [HINGE[0] + (x - HINGE[0]) * c + (y - HINGE[1]) * s, HINGE[1] - (x - HINGE[0]) * s + (y - HINGE[1]) * c];
  const tip = turn([11, 24.5]);
  const mid = turn([20, 24.5]);
  const wedge = inPoly([[11, 23.4], [HINGE[0], HINGE[1] - 1.5], [HINGE[0] + 1, HINGE[1] + 1.5], mid, tip]);
  return painted(
    6,
    18,
    36,
    26,
    (F) => F(wedge, (_x, y) => (y > 24.2 + open * 0.2 ? "W" : "X")),
    false,
  );
}

/** An ear, `tilt` pixels leaning (the top of it sliding sideways): grey with pink inside. */
function ear(x0: number, y0: number, tilt: number): { part: Part; at: Pt } {
  return painted(x0 - 2, y0, 9, 8, (F) => {
    const lean = (y: number) => (tilt * (y0 + 5 - y)) / 5;
    const shape: Inside = (x, y) => ((x + 0.5 - (x0 + 2.5) - lean(y)) / 2.6) ** 2 + ((y + 0.5 - (y0 + 3.2)) / 3) ** 2 <= 1;
    const inner: Inside = (x, y) => ((x + 0.5 - (x0 + 2.5) - lean(y)) / 1.3) ** 2 + ((y + 0.5 - (y0 + 3.7)) / 2) ** 2 <= 1;
    F(shape, (x, y) => (inner(x, y) ? ramp(PINK, 0.4 + 0.2 * (1 - (y - y0) / 6)) : ramp(SKIN, 0.55 - 0.05 * (x - x0) + 0.05 * (y0 + 6 - y))));
  });
}

export type Eyes = "open" | "half" | "shut" | "wide" | "joy";
/** An eye: a round dark one with a glint (a pale pixel up and to the left); `w` its width (the far eye, seen at an angle, is narrower). */
function eye(x0: number, y0: number, w: number, lid: Eyes): { part: Part; at: Pt } {
  const rows: Record<Eyes, string[]> = {
    open: w >= 4 ? [".xx.", "xwxx", "xxxx", ".xx."] : [".xx", "xwx", ".xx"],
    half: w >= 4 ? ["xxxx", ".xx."] : ["xxx", ".xx"],
    shut: w >= 4 ? ["xxxx"] : ["xxx"],
    wide: w >= 4 ? [".xxx.", "xwwxx", "xwxxx", ".xxx."] : [".xx.", "xwx.", ".xx."],
    joy: w >= 4 ? [".xx.", "x..x"] : [".x.", "x.x"],
  };
  return painted(x0, y0, 5, 5, (_F, S) => S(rows[lid], x0, y0), false);
}

export type Brows = "none" | "angry" | "worry" | "up";
/** His brows over the eyes (the face has none at rest): slanted down toward his nose (angry), up in the middle (worry), or raised. */
function brows(kind: Exclude<Brows, "none">): { part: Part; at: Pt } {
  const near: Record<typeof kind, Pt[]> = { angry: [[33, 8], [34, 8], [35, 7], [36, 7]], worry: [[33, 7], [34, 7], [35, 8], [36, 8]], up: [[33, 6], [34, 6], [35, 6], [36, 6]] };
  const far: Record<typeof kind, Pt[]> = { angry: [[25, 7], [26, 6], [27, 6]], worry: [[25, 6], [26, 6], [27, 7]], up: [[25, 5], [26, 5], [27, 5]] };
  return painted(24, 4, 15, 6, (_F, S) => [...near[kind], ...far[kind]].forEach(([x, y]) => S(["y"], x, y)), false);
}

// ---- His arms, the hose and the nozzle, the water.

/** The nozzle arm: shoulder, elbow and fist, a thick sausage of skin lit from the top left. */
function armN(s: Pt, e: Pt, f: Pt): { part: Part; at: Pt } {
  return stroke([s, e, f], [4.9, 4.4, 3.7], (l) => ramp(SKIN, l + 0.05));
}

/** The other arm, hanging at his flank: shoulder, elbow, hand. */
function armF(s: Pt, e: Pt, f: Pt): { part: Part; at: Pt } {
  return stroke([s, e, f], [5.4, 4.9, 3.9], (l) => ramp(SKIN, l - 0.02));
}

/** His hand: dark knuckles on top, the fingers curling under. */
function fist(): Part {
  return { grid: ["abbbb.", "bcdccb", "bccccb", "abccba", ".uvvu."] };
}

/** His hand open (the toss): the fingers spread, the palm up. */
function palm(): Part {
  return { grid: ["a.a.a.", "bcdcdb", "bccccb", "abccba", ".uvvu."] };
}

/** The nozzle's axis from `butt` to `tip`: a brass hose fitting, a green grip, a brass collar, a green head, a flared brass cap. */
function nozzle(butt: Pt, tip: Pt): { part: Part; at: Pt } {
  const zones: readonly (readonly [number, number, string, number])[] = [
    [0.0, 0.1, BRASS, 1.7],
    [0.1, 0.5, HOSE, 2.5],
    [0.5, 0.6, BRASS, 3.0],
    [0.6, 0.8, HOSE, 2.3],
    [0.8, 1.0, BRASS, 3.4],
  ];
  const pts: Pt[] = [butt, tip];
  const pad = 5;
  const x0 = Math.floor(Math.min(butt[0], tip[0])) - pad;
  const y0 = Math.floor(Math.min(butt[1], tip[1])) - pad;
  const w = Math.ceil(Math.max(butt[0], tip[0])) + pad - x0 + 1;
  const h = Math.ceil(Math.max(butt[1], tip[1])) + pad - y0 + 1;
  return painted(x0, y0, w, h, (F) => {
    const at = (x: number, y: number) => along(pts, [0, 0], [x + 0.5, y + 0.5]);
    const zoneOf = (s: number) => zones.find(([a, b]) => s >= a && s <= b) ?? zones[zones.length - 1]!;
    // (Where the stroke's nearest point is along it: `s`; its distance across it is `d`, which is the radius test.)
    const len = Math.hypot(tip[0] - butt[0], tip[1] - butt[1]) || 1;
    const along2 = (x: number, y: number) => {
      const ux = (tip[0] - butt[0]) / len;
      const uy = (tip[1] - butt[1]) / len;
      const px = x + 0.5 - butt[0];
      const py = y + 0.5 - butt[1];
      return { s: (px * ux + py * uy) / len, d: Math.abs(-px * uy + py * ux), nx: px - ux * (px * ux + py * uy), ny: py - uy * (px * ux + py * uy) };
    };
    void at;
    F(
      (x, y) => {
        const n = along2(x, y);
        const z = zoneOf(n.s);
        return n.s >= 0 && n.s <= 1 && n.d <= z[3];
      },
      (x, y) => {
        const n = along2(x, y);
        const z = zoneOf(n.s);
        const l = 0.62 - 0.42 * (n.nx / z[3]) - 0.5 * (n.ny / z[3]);
        return ramp(z[2], l);
      },
    );
  });
}

/** A mulberry32 random sequence from a seed (water is never the same twice, and a seed makes it repeat). */
function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The water from the nozzle at `tip`, heading `ang` degrees (180 left, 90 down) for `len` pixels and sagging `droop` pixels
 * by its end: a fan of streaks and drops, a thin stream along its middle near the nozzle. Water has no outline of its own;
 * `seed` picks which streaks, so a flicker is a different seed each frame.
 */
function spray(tip: Pt, ang: number, len: number, droop: number, seed: number): { part: Part; at: Pt } {
  const rnd = noise(seed);
  const pos = (d: number, phi: number): Pt => {
    const a = rad(ang + phi);
    return [tip[0] + Math.cos(a) * d, tip[1] + Math.sin(a) * d + droop * (d / len) ** 2];
  };
  const pad = 6;
  const pts: Pt[] = [pos(0, 0), pos(len, -22), pos(len, 22), pos(len * 0.7, 0)];
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))) - pad;
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1]))) - pad;
  const x1 = Math.ceil(Math.max(...pts.map((p) => p[0]))) + pad;
  const y1 = Math.ceil(Math.max(...pts.map((p) => p[1]))) + pad;
  return painted(
    x0,
    y0,
    x1 - x0 + 1,
    y1 - y0 + 1,
    (_F, S) => {
      const put = (p: Pt, k: string) => S([k], Math.round(p[0]), Math.round(p[1]));
      // Streaks: rays fanning out of the nozzle, each a run of pixels (a bit of water), the ones farther out falling more.
      const rays = Math.max(5, Math.round(len * 0.55));
      for (let i = 0; i < rays; i++) {
        const phi = ((i / (rays - 1)) * 2 - 1) * 17 + (rnd() - 0.5) * 6;
        let d = 1.5 + rnd() * 3;
        while (d < len) {
          const run = 1.5 + rnd() * 3.2;
          for (let e = 0; e < run && d + e < len; e += 0.7) put(pos(d + e, phi), d + e < len * 0.4 ? "3" : rnd() < 0.5 ? "2" : "1");
          // a bright head on the streak, a deeper tail on the far ones
          if (rnd() < 0.3) put(pos(d, phi), "4");
          d += run + 1.6 + rnd() * 3.5 * (d / len + 0.4);
        }
      }
      // The middle stream, thick near the nozzle.
      for (let d = 0; d < len * 0.6; d += 0.7) {
        const p = pos(d, 0);
        put(p, d < len * 0.3 ? "4" : "3");
        if (d < len * 0.35) put([p[0], p[1] + 1], "2");
        if (d < len * 0.2) put([p[0], p[1] - 1], "2");
      }
      // Drops falling away past its end.
      for (let i = 0; i < 4; i++) {
        const p = pos(len * (0.75 + rnd() * 0.35), (rnd() - 0.5) * 40);
        put([p[0], p[1] + 1 + rnd() * 3], rnd() < 0.5 ? "2" : "1");
      }
    },
    false,
  );
}

/** His shadow on the ground, `w` wide. */
function shadow(w: number): Part {
  const cv = canvas(w, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) if (E(w / 2, 2, w / 2, 2.1)(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
}

// ---- Parts and the pose.

const { parts: PARTS, add } = lazyParts();
add("fist", () => fist());
add("palm", () => palm());
add("shadow", () => shadow(54));

type Placed = { name: string; at: Pt };
const placedAt = new Map<string, Pt>();
/** A part painted at a place of its own (its `at`), made the first time it's drawn, by a name that says how. */
function placed(name: string, make: () => { part: Part; at: Pt }): Placed {
  let at = placedAt.get(name);
  if (!at) {
    const m = make();
    add(name, () => m.part);
    placedAt.set(name, (at = m.at));
  }
  return { name, at };
}

const r2 = (v: number) => Math.round(v * 2) / 2;
const key = (pts: readonly Pt[]) => pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join(";");

/** A pose: the numbers that move him (scene pixels). */
export interface GardenerPose {
  /** He sinks this many pixels (a breath, a crouch); his feet stay on the ground. */
  bob?: number;
  /** The whole of him moved sideways, and lifted off the ground (his shadow stays). */
  dx?: number;
  air?: number;
  /** His head (the skull, muzzle, ears and eyes) moved from where it stands: a nod, a lean forward (negative x: to our left). */
  head?: Pt;
  /** The jaw: degrees open (0 closed, about 35 a great yawn). */
  jaw?: number;
  /** The ears' lean, in pixels at the tips (negative: toward his front), and the eyes. */
  earN?: number;
  earF?: number;
  eyes?: Eyes;
  /** His brows (none at rest). */
  brows?: Brows;
  /** The nozzle arm: the fist and the elbow (bent by itself when left out), and the nozzle's tilt (degrees, positive: its tip up). */
  fist?: Pt;
  elbowN?: Pt;
  nozzle?: number;
  /** The water: how long (0 off), how far it droops, which drops (a seed). */
  spray?: number;
  droop?: number;
  seed?: number;
  /** The other hand (out at his right side, on the hose) and its elbow (bent by itself when the hand is given, else as it stands). */
  hand?: Pt;
  elbowF?: Pt;
  /** His other hand open (a toss), and not on the hose (it hangs from the nozzle to his hip by itself). */
  open?: boolean;
  free?: boolean;
  /** The hose from the nozzle through his other hand and behind him: how far it hangs below the line between the hands. */
  sag?: number;
  /** The spare hose behind his hip: 1 as it rests, 0 all fed out (nothing shows), more of it showing above 1. */
  loop?: number;
  /** Both shoulders raised this many pixels (a shrug). */
  lift?: number;
  /**
   * His near hand off the nozzle, open (a toss): where it is. The nozzle then hangs where `fist` puts it, on its hose, and the
   * arm goes to this hand instead.
   */
  grab?: Pt;
  /** The tail's tip, up or down. */
  tail?: number;
  /** The feet's lift (a step). */
  stepN?: number;
  stepF?: number;
}

const REST = {
  bob: 0,
  dx: 0,
  air: 0,
  head: [0, 0] as Pt,
  jaw: 0,
  earN: 0,
  earF: 0,
  eyes: "open" as Eyes,
  brows: "none" as Brows,
  fist: [16.5, 33] as Pt,
  nozzle: 8,
  spray: 16,
  droop: 6,
  seed: 3,
  sag: 9,
  loop: 1,
  open: false,
  free: false,
  lift: 0,
  hand: [47.5, 48.5] as Pt,
  tail: 0,
  stepN: 0,
  stepF: 0,
};

const SHOULDER_N: Pt = [25.5, 31];
const SHOULDER_F: Pt = [51.5, 28.5];
/** His arms' bones: the upper arm and the forearm. */
const BONES_N: Pt = [5.2, 5.2];
const BONES_F: Pt = [11, 11];
const NOZZLE_LEN = 12;
/**
 * The water's launch direction (degrees, 180 is level toward our left, 90 down) is the nozzle's own tilt plus this: it leaves a little
 * below the nozzle's axis, then arcs (`droop`). The still's nozzle (8 degrees up) gives 172, as it was drawn; a nozzle raised higher
 * sends it up (a fountain), a lowered one down (the near squares).
 */
const SPRAY_ANG = 164;
/** How far behind the fist the nozzle's fitting is, and the hose's end behind that. */
const GRIP = 3.5;

/** An elbow for an arm of two bones `l1` and `l2` from `s` to `t`, bent down (or as far out as it reaches). */
function elbowOf(s: Pt, t: Pt, [l1, l2]: Pt, down = true): Pt {
  const dist = Math.hypot(t[0] - s[0], t[1] - s[1]) || 0.01;
  const d = Math.min(dist, l1 + l2 - 0.01);
  const [ux, uy] = [(t[0] - s[0]) / dist, (t[1] - s[1]) / dist];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const [mx, my] = [s[0] + ux * a, s[1] + uy * a];
  const c1: Pt = [mx - uy * h, my + ux * h];
  const c2: Pt = [mx + uy * h, my - ux * h];
  return (c1[1] >= c2[1]) === down ? c1 : c2;
}

/**
 * Where the hose goes behind him at his hip, and the spare hose looped behind his back: drawn behind his body and his leg, so it
 * comes out of them and goes back in, showing as one short curve past his hip.
 */
const WRAP: Pt = [51.8, 52];
const BACK_LOOP: readonly Pt[] = [[50.4, 51.6], [55.2, 52.1], [57.8, 54.4], [56.6, 57.2], [50.2, 58.4]];

/** A point of a quadratic curve from `a` through the control point `c` to `b`, `t` from 0 to 1. */
const bez = (a: Pt, c: Pt, b: Pt, t: number): Pt => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];

/**
 * The hose in front of him: from the nozzle's fitting `butt` sagging `sag` pixels across his belly to his other hand (if it
 * holds the hose), and from there to where it goes behind him (`WRAP`). It ends just inside his side, so it looks to pass behind.
 */
function hoseFront(butt: Pt, hand: Pt | null, sag: number, wrap: Pt = WRAP): { part: Part; at: Pt } {
  const to = hand ?? wrap;
  const control: Pt = [(butt[0] + to[0]) / 2 - 2, Math.max(butt[1], to[1]) + sag];
  const pts: Pt[] = [...Array.from({ length: 13 }, (_, i) => bez(butt, control, to, i / 12))];
  if (hand) pts.push(...Array.from({ length: 4 }, (_, i): Pt => [hand[0] + ((wrap[0] - hand[0]) * (i + 1)) / 4, hand[1] + ((wrap[1] - hand[1]) * (i + 1)) / 4]));
  return stroke(pts, pts.map(() => 1.05), (l, _s, across) => (across < -0.3 && l > 0.55 ? "G" : ramp(HOSE, l - 0.18)));
}

/** The spare hose behind him, past his hip, `loop` of the way out (see `GardenerPose.loop`). */
function hoseBack(loop: number): { part: Part; at: Pt } {
  const pts = BACK_LOOP.map(([x, y], i): Pt => (i === 0 || i === BACK_LOOP.length - 1 ? [x, y] : [BACK_LOOP[0]![0] + (x - BACK_LOOP[0]![0]) * loop, y]));
  return stroke(pts, pts.map(() => 1.05), (l, _s, across) => (across < -0.3 && l > 0.55 ? "G" : ramp(HOSE, l - 0.18)));
}

/** The layers of a pose, back to front. */
export function gardenerLayers(pose: GardenerPose = {}): Layer[] {
  const p = { ...REST, ...pose };
  const b = p.bob;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX + Math.round(x), y: OY + Math.round(y) });
  const L = (pl: Placed, dy = 0, dx = 0) => at(pl.name, pl.at[0] + dx, pl.at[1] + dy);
  /** A part of his head: it moves with it. */
  const H = (pl: Placed, dy = 0, dx = 0) => L(pl, b + HEAD_UP + p.head[1] + dy, p.head[0] + dx);
  const up = (q: Pt, dy: number): Pt => [q[0], q[1] + dy];
  const shoulderN = up(SHOULDER_N, b - p.lift);
  const shoulderF = up(SHOULDER_F, b - p.lift);
  const fistN: Pt = up(p.fist, b);
  const handF: Pt = up(p.hand, b);
  const grabN: Pt | null = pose.grab ? up(pose.grab, b) : null;
  const elbowN = pose.elbowN ? up(pose.elbowN, b) : elbowOf(shoulderN, grabN ?? fistN, BONES_N);
  const elbowF = pose.elbowF ? up(pose.elbowF, b) : pose.hand ? elbowOf(shoulderF, handF, BONES_F, true) : up([55.5, 40], b);
  // The nozzle's axis, from its fitting behind his fist out to its cap, tilted `nozzle` degrees up from level (toward our left).
  const th = rad(p.nozzle);
  const butt: Pt = [fistN[0] + Math.cos(th) * GRIP, fistN[1] + Math.sin(th) * GRIP];
  const tip: Pt = [butt[0] - Math.cos(th) * NOZZLE_LEN, butt[1] - Math.sin(th) * NOZZLE_LEN];
  const hoseEnd: Pt = [butt[0] + Math.cos(th) * 0.6, butt[1] + Math.sin(th) * 0.6];
  const layers: Layer[] = [
    at("shadow", FEET_X - 27, GROUND - 3),
    L(placed(`tail:${r2(p.tail)}`, () => tail(p.tail)), b),
    L(placed(`leg:${LEG_F}:${r2(p.stepF)}`, () => leg(LEG_F, p.stepF))),
    L(placed(`leg:${LEG_N}:${r2(p.stepN)}`, () => leg(LEG_N, p.stepN))),
    ...(p.loop > 0.05 ? [L(placed(`hoseBack:${r2(p.loop)}`, () => hoseBack(r2(p.loop))), b)] : []),
    L(placed("torso", torso), b),
    H(placed(`mouthIn:${p.jaw}`, () => mouthIn(p.jaw))),
    H(placed(`jaw:${p.jaw}`, () => jaw(p.jaw))),
    H(placed("head", head)),
    H(placed(`earF:${p.earF}`, () => ear(EAR_F[0], EAR_F[1], p.earF))),
    H(placed(`earN:${p.earN}`, () => ear(EAR_N[0], EAR_N[1], p.earN))),
    H(placed(`eyeF:${p.eyes}`, () => eye(EYE_F[0], EYE_F[1], 3, p.eyes))),
    H(placed(`eyeN:${p.eyes}`, () => eye(EYE_N[0], EYE_N[1], 4, p.eyes))),
    ...(p.brows !== "none" ? [H(placed(`brows:${p.brows}`, () => brows(p.brows as Exclude<Brows, "none">)))] : []),
    L(placed(`armF:${key([shoulderF, elbowF, handF])}`, () => armF(shoulderF, elbowF, handF))),
    L(placed(`armN:${key([shoulderN, elbowN, grabN ?? fistN])}`, () => armN(shoulderN, elbowN, grabN ?? fistN))),
    L(placed(`hose:${key([hoseEnd, handF])}:${r2(p.sag)}:${p.free ? 1 : 0}:${b}`, () => hoseFront(hoseEnd, p.free ? null : handF, p.sag, up(WRAP, b)))),
    L(placed(`nozzle:${key([butt, tip])}`, () => nozzle(butt, tip))),
    at(p.open ? "palm" : "fist", handF[0] - 3, handF[1] - 2),
    ...(grabN ? [at("palm", grabN[0] - 3, grabN[1] - 2)] : [at("fist", fistN[0] - 3, fistN[1] - 2.5)]),
  ];
  if (p.spray > 0) layers.push(L(placed(`spray:${key([tip])}:${p.nozzle}:${p.spray}:${p.droop}:${p.seed}`, () => spray([tip[0] - 1.5, tip[1]], SPRAY_ANG + p.nozzle, p.spray, p.droop, p.seed))));
  // The whole of him moved: sideways, and up (his shadow stays on the ground).
  return p.dx || p.air ? layers.map((l) => (l.part === "shadow" ? { ...l, x: l.x + p.dx } : { ...l, x: l.x + p.dx, y: l.y - p.air })) : layers;
}

// ---- Things drawn on his frames: sparkles, dust, sweat, drips, thoughts, seeds in the air, the jet at a king.

/** A speck at a scene point (the frame adds its own margins). */
const sp = (x: number, y: number, k: string): Speck => [OX + Math.round(x), OY + Math.round(y), k];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** A gold four-point sparkle, white at its heart. */
const sparkle = (x: number, y: number, big = false): Speck[] => [
  sp(x, y, "w"), sp(x - 1, y, "M"), sp(x + 1, y, "M"), sp(x, y - 1, "M"), sp(x, y + 1, "M"),
  ...(big ? [sp(x - 2, y, "L"), sp(x + 2, y, "L"), sp(x, y - 2, "L"), sp(x, y + 2, "L")] : []),
];
/** Dust kicked up either side of his feet (`t` frames after he lands): `n` puffs a side rolling outward and up. */
const dust = (t: number, n = 3, cx = FEET_X, spread = 24): Speck[] => {
  const out: Speck[] = [];
  for (let side = -1; side <= 1; side += 2)
    for (let i = 0; i < n; i++) {
      const x = Math.round(cx + side * (spread * 0.5 + i * 3.5 + t * (2 + (i % 2))));
      const y = GROUND - 1 - Math.round(t * (0.6 + (i % 3) * 0.5) + (i % 2));
      const cloud: [number, number, string][] = t < 2 ? [[0, 0, "0"], [side, 0, "0"], [0, -1, "9"], [side, -1, "9"]] : [[0, 0, "9"], [side, -1, "0"]];
      for (const [ox, oy, k] of cloud) out.push(sp(x + ox, y + oy, k));
    }
  return out;
};
/** His shadow alone on the ground (he's above the frame, or about to come down), `r` its half-width. */
const shadowOnly = (r: number): Speck[] => groundShadow(OX + FEET_X, OY + GROUND - 1, r);
/** Sweat flying off his head, both ways. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [sp(8 - t, 12 + t * 2, "~"), sp(44 + t, 11 + t * 2, "~")];
};
/** Where his nozzle's cap is (scene pixels), for a pose. */
function nozzleTip(pose: GardenerPose = {}): Pt {
  const p = { ...REST, ...pose };
  const th = rad(p.nozzle);
  return [p.fist[0] + Math.cos(th) * GRIP - Math.cos(th) * NOZZLE_LEN, p.fist[1] + p.bob + Math.sin(th) * GRIP - Math.sin(th) * NOZZLE_LEN];
}
/** A drop forming at the nozzle's cap, then falling (`i` 0 to 2): the cap's own drip. */
const drip = (i: number, pose: GardenerPose = {}): Speck[] => {
  const [x, y] = nozzleTip(pose);
  return i === 0 ? [sp(x, y + 2, "3"), sp(x, y + 3, "2")] : i === 1 ? [sp(x, y + 9, "3"), sp(x, y + 10, "2")] : [sp(x, y + 21, "2"), sp(x, y + 22, "1")];
};
/** Thought bubbles rising off his head, one more each beat (`n` 1 to 3). */
const bubbles = (n: number): Speck[] =>
  ([[47, 1], [51, -5], [56, -12]] as Pt[]).slice(0, n).flatMap(([x, y], i): Speck[] => (i === 2 ? [sp(x, y, "3"), sp(x + 1, y, "4"), sp(x + 2, y, "3"), sp(x, y + 1, "2"), sp(x + 1, y + 1, "3"), sp(x + 2, y + 1, "2"), sp(x, y + 2, "1"), sp(x + 1, y + 2, "2"), sp(x + 2, y + 2, "1")] : [sp(x, y, "4"), sp(x + 1, y, "3"), sp(x, y + 1, "2"), sp(x + 1, y + 1, "2")]));
/** Drops of water thrown up and falling round his head and hands (a cheer), `t` a frame number. */
const splashes = (t: number, n = 5): Speck[] =>
  Array.from({ length: n }, (_, i): Speck => {
    const x = 4 + ((i * 11 + t * 7) % 40);
    const y = -2 + ((i * 7 + t * 5) % 22);
    return sp(x, y, i % 3 === 0 ? "4" : i % 3 === 1 ? "3" : "2");
  });
/** A seed: two pixels across, tan on top and brown below (they have no outline, so they carry on the dark ground and the light). */
const seedAt = (px: number, py: number): Speck[] => [sp(px, py, "7"), sp(px + 1, py, "7"), sp(px, py + 1, "6"), sp(px + 1, py + 1, "5")];
/** Seeds just leaving the packet's mouth at (`x`, `y`): `n` of them in a short arch up and over toward the board (to our left). */
const seedsFrom = (x: number, y: number, n: number): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => seedAt(Math.round(x - 3 * (i + 1) - (i % 2)), Math.round(y - 6 * Math.sin((Math.PI * (i + 0.7)) / (n + 0.4)) + (i % 2) * 2))).flat();

/** A hit: every color goes pale. */
const FLASH: Record<string, string> = Object.fromEntries(
  Object.entries(GARDENER_PALETTE)
    .filter(([k]) => !["k", "z", "~", "9", "0", "w"].includes(k))
    .map(([k, c]) => {
      const n = parseInt(c.slice(1), 16);
      const mix = (v: number) => Math.round(v + (255 - v) * 0.55).toString(16).padStart(2, "0");
      return [k, `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`];
    }),
);

// ---- His animations. Frame counts and times follow the other bosses' (Moo's, Alfil's, Smudgy's); every frame is a pose, so the
// hose, the hands and the loop behind his hip stay together in each.

const F = (ms: number, pose: GardenerPose = {}, extra: Partial<Frame> = {}): Frame => ({ ms, layers: gardenerLayers(pose), ...extra });
const TAU = Math.PI * 2;
const rnd = Math.round;
/** The spray at a length, drooping in proportion, a seed of its own (a different one each frame: it shimmers). */
const jet = (len: number, seed: number, droop = Math.round(len * 0.375)): Pick<GardenerPose, "spray" | "droop" | "seed"> => ({ spray: len, droop, seed });
/** The water from a raised nozzle: it leaves upward and falls back, so it droops a good deal. */
const fount = (len: number, seed: number): Pick<GardenerPose, "spray" | "droop" | "seed"> => jet(len, seed, Math.round(len * 0.62));
/** His nozzle arm raised, the nozzle up: a fountain (a cheer, a call to the board). */
const UP: GardenerPose = { fist: [17.5, 29], nozzle: 40 };
/** The nozzle arm lowered, the water off (thinking, smug, tired). */
const DOWN: GardenerPose = { fist: [16.5, 35], nozzle: -4, spray: 0 };

/**
 * Idle: he breathes slowly, the water from the nozzle runs, thins to a drip, drips, and comes back; an ear flicks, he blinks.
 * Frame 1 is the approved still (the spray at its length 16, drops seed 3).
 */
const IDLE_SPRAY = [16, 16, 16, 16, 16, 12, 8, 4, 0, 0, 0, 0, 4, 8, 12, 15] as const;
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) =>
    F(125, {
      bob: i >= 5 && i <= 12 ? 1 : 0,
      ...jet(IDLE_SPRAY[i]!, i === 0 ? 3 : 3 + i),
      earN: i === 3 ? -2 : i === 4 ? -1 : 0,
      earF: i === 3 ? -1 : 0,
      tail: i >= 9 && i <= 11 ? 2 : 0,
      eyes: i === 11 ? "shut" : i === 12 ? "half" : "open",
      head: [0, i >= 6 && i <= 9 ? 1 : 0],
      nozzle: 8 + (i >= 6 && i <= 8 ? 1 : 0) - (i >= 10 && i <= 11 ? 1 : 0),
      sag: 9 + (i >= 5 && i <= 12 ? 0.5 : 0),
    }, { specks: i >= 8 && i <= 11 ? drip(i - 8, { nozzle: 8 }) : [] }),
  ),
};

/** Entrance: his shadow spreads, he drops in with the hose swinging and lands with a heavy thump, shakes it off, and booms a happy yawn. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: shadowOnly(8), cue: "drop" },
    { ms: 100, layers: [], specks: shadowOnly(18) },
    F(70, { air: 18, eyes: "wide", jaw: 12, earN: -3, earF: -3, tail: 4, spray: 0, loop: 1.3, sag: 13, ...UP }),
    F(70, { air: 6, eyes: "wide", jaw: 8, earN: -2, earF: -2, spray: 0, loop: 1.2, sag: 12 }),
    F(130, { bob: 3, eyes: "shut", earN: 3, earF: 3, spray: 0, loop: 1.3, sag: 13 }, { cue: "thump", shake: [0, 2], specks: dust(0, 3) }),
    F(110, { bob: 1, earN: 1, earF: 1, ...jet(5, 5), sag: 11 }, { specks: dust(1, 3) }),
    F(110, { bob: 0, ...jet(10, 6) }, { specks: dust(2, 3) }),
    F(170, { head: [0, -1], jaw: 22, eyes: "joy", earN: -2, earF: -2, tail: 3, ...UP, ...fount(20, 7) }, { cue: "grunt", specks: [...sparkle(8, 22), ...sparkle(46, 20)] }),
    F(160, { head: [-1, 1], eyes: "shut", jaw: 4, ...jet(14, 8) }),
    F(290, {}),
  ],
};

/** Thinking: he lowers the nozzle, chews, looks at the board; now and then scratches his chin with his free hand; bubbles rise (one, two, three). */
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3].flatMap((n) =>
    [0, 1, 2, 3].map((i) =>
      F(130, {
        ...DOWN,
        head: [-1, i % 2 ? 0 : -1],
        jaw: i % 2 ? 0 : 3,
        eyes: i === 3 ? "half" : "open",
        earN: [0, 1, 0, -1][i]!,
        earF: [0, -1, 0, 1][i]!,
        tail: [0, 2, 3, 2][i]!,
        sag: 11,
        ...(n === 2 ? { free: true, open: false, hand: [37 + (i % 2), 31] as Pt, elbowF: undefined } : {}),
      }, { specks: bubbles(Math.min(3, n + 1)) }),
    ),
  ),
};

/** His move: a crouch, a heavy step (the near foot, then the far one), each with a thump and a puff of dust, and a settle. */
const move: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 2, earN: 3, earF: 3, ...jet(8, 4) }),
    F(90, { stepN: 3, bob: 1, head: [-1, 0], earN: -1, earF: -1, ...jet(12, 5) }),
    F(110, { stepN: 0, bob: 2, ...jet(10, 6) }, { cue: "thump", shake: [0, 1], specks: dust(0, 2) }),
    F(130, { stepF: 3, bob: 1, head: [-1, 0], tail: 2, ...jet(12, 7) }),
    F(120, { stepF: 0, bob: 2, ...jet(8, 8) }, { cue: "thump", shake: [0, 1], specks: dust(1, 2) }),
    F(160, {}),
  ],
};

/** A capture: he cheers, the nozzle up and the water fountaining, his jaw wide, his ears flapping, drops falling, a hop. */
const capture: Anim = {
  loop: false,
  frames: [
    F(90, { bob: 1, earN: 3, earF: 3, ...jet(10, 3) }),
    ...Array.from({ length: 10 }, (_, i) => {
      const odd = i % 2 === 1;
      return F(85, {
        ...UP,
        ...fount(20, 4 + i),
        air: odd ? 0 : 2,
        bob: odd ? 1 : 0,
        head: [0, odd ? 0 : -1],
        jaw: odd ? 8 : 16,
        eyes: "joy",
        earN: odd ? 2 : -3,
        earF: odd ? 2 : -3,
        tail: odd ? 1 : 4,
        sag: odd ? 7 : 11,
      }, { cue: i === 4 ? "grunt" : undefined, specks: [...splashes(i, 4), ...(i < 8 && i % 3 === 0 ? sparkle(46 - ((i * 5) % 14), 8 - (i % 2) * 4, i % 6 === 0) : [])] });
    }),
    F(160, { eyes: "half" }),
  ],
};

/** Hurt: a flash, knocked back with his eyes shut and the nozzle flung up, the water sputtering out; then he glares. */
const hurt: Anim = {
  loop: false,
  frames: [
    F(70, { bob: 2, dx: 1, eyes: "shut", jaw: 18, brows: "worry", earN: -3, earF: -3, tail: 4, ...UP, spray: 0, sag: 12, loop: 1.2 }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: sweat(0) }),
    F(80, { bob: 2, dx: 1, eyes: "shut", jaw: 14, brows: "worry", earN: -2, earF: -2, fist: [16.5, 36], nozzle: -10, ...jet(5, 4), sag: 12 }, { shake: [-1, 0], specks: sweat(1) }),
    F(90, { bob: 1, dx: 2, jaw: 6, eyes: "half", brows: "worry", earN: 3, earF: 3, ...jet(4, 5) }, { specks: sweat(2) }),
    F(90, { bob: 1, dx: 1, brows: "worry", ...jet(8, 6) }),
    F(110, { head: [0, 1], eyes: "half", brows: "worry", jaw: 2, ...jet(10, 7) }),
    F(120, { eyes: "half", brows: "angry", ...jet(12, 8) }),
    F(160, {}),
  ],
};

/** Check: he points the nozzle at the king and sends a hard jet toward the board, grunting, brows down; twice. */
const AIM: GardenerPose = { fist: [17.5, 31], nozzle: 18, brows: "angry", head: [-1, 0] };
const check: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 2, head: [1, 1], earN: 3, earF: 3, spray: 0 }),
    F(120, { ...AIM, ...jet(22, 3), jaw: 6, earN: -1, earF: -1, tail: 3 }, { cue: "grunt", specks: sparkle(2, 28) }),
    F(100, { ...AIM, ...jet(22, 4), jaw: 4, bob: 1 }),
    F(100, { ...AIM, spray: 0, eyes: "half", jaw: 0 }),
    F(120, { ...AIM, ...jet(22, 5), jaw: 6, earN: -1, earF: -1, tail: 3 }, { specks: sparkle(2, 28, true) }),
    F(100, { ...AIM, ...jet(22, 6), jaw: 4, bob: 1 }),
    F(100, { ...AIM, ...jet(6, 7), jaw: 0 }),
    F(210, {}),
  ],
};

/** Smug (loop): head back, heavy-lidded, a lazy trickle from the nozzle, his free hand on his belly, an ear flicking now and then. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    F(150, {
      ...DOWN,
      ...(i % 4 === 1 ? jet(4, i) : {}),
      head: [1, -1],
      eyes: i === 5 ? "shut" : "half",
      jaw: 2,
      free: true,
      hand: [44, 46],
      earN: i === 2 ? -2 : 0,
      earF: i === 3 ? -1 : 0,
      tail: [0, 1, 2, 3, 2, 1, 0, 0][i]!,
      bob: i >= 3 && i <= 6 ? 1 : 0,
      sag: 11,
    }, { specks: i === 2 ? drip(0, DOWN) : i === 3 ? drip(1, DOWN) : [] }),
  ),
};

/** Rattled (loop): shaking, eyes wide, sweat flying, the water wobbling, the hose jiggling. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    F(80, {
      dx: i % 2 ? 1 : -1,
      bob: 1,
      eyes: "wide",
      brows: "worry",
      jaw: 8,
      earN: 3,
      earF: 3,
      ...jet([6, 14, 5, 12, 8, 15, 4, 10][i]!, 20 + i),
      nozzle: 8 + (i % 2 ? 4 : -4),
      sag: i % 2 ? 7 : 11,
      loop: i % 2 ? 1.15 : 0.9,
    }, { specks: sweat(i) }),
  ),
};

/** Defeat: flashes and reels back, the hose goes slack, the nozzle drops to the ground, he sinks onto his haunches, head down, ears limp; held. */
const defeat: Anim = {
  loop: false,
  frames: [
    F(90, { bob: 2, dx: 1, eyes: "shut", jaw: 16, brows: "worry", earN: -3, earF: -3, ...UP, spray: 0, sag: 12, loop: 1.2 }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: sweat(0) }),
    F(160, { bob: 2, dx: 2, eyes: "shut", jaw: 10, brows: "worry", fist: [17.5, 37], nozzle: -25, ...jet(4, 9), free: true, hand: [47.5, 52], sag: 13, earN: 3, earF: 3 }, { specks: sweat(2) }),
    F(210, { bob: 4, dx: 1, head: [1, 2], eyes: "half", brows: "worry", fist: [18, 46], nozzle: -50, spray: 0, free: true, hand: [47.5, 54], sag: 15, loop: 0.6, earN: 3, earF: 3 }, { cue: "flop", shake: [0, 1], specks: dust(0, 2) }),
    F(260, { bob: 5, head: [1, 3], eyes: "shut", jaw: 0, brows: "worry", fist: [18, 48], nozzle: -55, spray: 0, free: true, hand: [47.5, 55], sag: 15, loop: 0.4, earN: 4, earF: 4, tail: -2 }, { specks: dust(1, 2) }),
    F(100, { bob: 5, head: [1, 3], eyes: "shut", fist: [18, 48], nozzle: -55, spray: 0, free: true, hand: [47.5, 55], sag: 15, loop: 0.4, earN: 4, earF: 4 }, { specks: drip(0, { fist: [18, 48], nozzle: -55 }) }),
    F(730, { bob: 5, head: [1, 3], eyes: "shut", brows: "worry", fist: [18, 48], nozzle: -55, spray: 0, free: true, hand: [47.5, 55], sag: 15, loop: 0.4, earN: 4, earF: 4 }, { specks: drip(1, { fist: [18, 48], nozzle: -55 }) }),
  ],
};

/** Victory (loop): both arms up, the nozzle fountaining, his free hand open over his head, hopping, his jaw wide. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const up = i % 2 === 0;
    return F(110, {
      fist: [17.5, 29],
      nozzle: 50,
      ...fount(20, 30 + i),
      free: true,
      open: true,
      hand: [46, up ? 21 : 24],
      air: up ? 3 : 0,
      bob: up ? 0 : 1,
      jaw: up ? 16 : 8,
      eyes: "joy",
      earN: up ? -3 : 2,
      earF: up ? -3 : 2,
      tail: up ? 4 : 1,
      sag: up ? 8 : 12,
    }, { cue: i === 2 ? "grunt" : i === 8 ? "thump" : undefined, specks: [...splashes(i, 5), ...(i % 4 === 1 ? sparkle(44, 4 + (i % 3) * 3) : [])] });
  }),
};

// ---- His own moments.

/** The far hand, free of the hose, open, at a place; the hose then hangs from the nozzle to his hip by itself. */
const HAND = (at: Pt): GardenerPose => ({ free: true, open: true, hand: at });
/** The seeds in his open hand at (`x`, `y`): `n` of them, in a pile. */
const seedsIn = (x: number, y: number, n: number): Speck[] => Array.from({ length: n }, (_, i): Speck[] => seedAt(x - 3 + (i % 3) * 2, y - 2 - Math.floor(i / 3) * 2 - (i % 2))).flat();
/** His near hand off the nozzle, which hangs at his side on its hose, and the other hand holding the hose at his hip. */
const HANGING: GardenerPose = { fist: [18, 41], nozzle: -75, spray: 0, hand: [50, 49], sag: 13 };
/**
 * Planting: he lets the nozzle drop and hang on its hose (the other hand keeps the hose at his hip), shows a handful of seeds in his
 * near hand, draws it back and tosses the seeds out toward the board (cue `toss`: the seeds leave his hand, where the board's seeds
 * start), follows through, and takes the nozzle up again. `n` seeds in the handful (three; five for the game's opening). The seeds are
 * drawn on his frames only while they are in his hand and as they leave it; after the cue the board's seeds fly on their own.
 */
const planting = (n: number, ms: readonly number[]): Anim => ({
  loop: false,
  frames: [
    F(ms[0]!, { ...HANGING, grab: [22, 37], head: [-1, 0], bob: 1 }, { specks: seedsIn(22, 37 + 1, n) }),
    F(ms[1]!, { ...HANGING, grab: [23, 36], head: [-1, 1], eyes: "half", bob: 1 }, { specks: seedsIn(23, 36 + 1, n) }),
    F(ms[2]!, { ...HANGING, grab: [25, 39], head: [-1, 0], bob: 2, earN: 3, earF: 3 }, { specks: seedsIn(25, 39 + 2, n) }),
    F(ms[3]!, { ...HANGING, grab: [15.5, 31], head: [-2, 0], jaw: 4, eyes: "joy", earN: -2, earF: -2, tail: 3, bob: 1 }, { cue: "toss", shake: [-1, 0], specks: seedsFrom(11, 28, n) }),
    F(ms[4]!, { ...HANGING, grab: [14, 30], head: [-1, 0], jaw: 2, bob: 1 }),
    F(ms[5]!, { fist: [16.5, 38], nozzle: -25, spray: 0, head: [-1, 0], sag: 11 }),
    F(ms[6]!, { fist: [16.5, 33], nozzle: 8, spray: 0, eyes: "joy", head: [0, 0] }),
  ],
});
const plant = planting(3, [90, 90, 100, 110, 100, 120, 130]);
const plantMany = planting(5, [110, 100, 120, 110, 100, 120, 140]);

/**
 * Watering (the ultimate's cast): he takes the hose in his other hand at his hip and hauls it out hand over hand (cue `tug`: the spare
 * hose behind his hip feeds out and its loop shrinks to nothing), braces, brings the nozzle up, the water starts (cue `spray`), and he
 * sweeps it from the near squares to the far (cue `sweep`: the board's sweep starts here and runs about as long as the three sweeping
 * frames), the water stops (cue `stop`), and he breathes out as the hose goes slack and the spare hose returns behind him.
 * The hose stays in his hand through the pull: the hose runs from the nozzle through his hand to his hip.
 */
const water: Anim = {
  loop: false,
  frames: [
    F(100, { ...DOWN, hand: [50.5, 49.5], head: [-1, 0], brows: "angry", sag: 11 }),
    F(130, { ...DOWN, hand: [44, 48], head: [-1, 1], brows: "angry", loop: 0.5, sag: 12, bob: 1, jaw: 4 }, { cue: "tug", shake: [1, 0] }),
    F(110, { ...DOWN, hand: [38, 47], head: [-1, 1], eyes: "shut", brows: "angry", loop: 0.1, sag: 14, bob: 2, earN: 3, earF: 3 }, { shake: [-1, 0] }),
    F(120, { fist: [17, 31], nozzle: 10, spray: 0, hand: [40, 47], head: [-1, 0], brows: "angry", loop: 0, sag: 3, bob: 2, jaw: 8 }),
    F(130, { fist: [17, 31], nozzle: 10, ...jet(12, 3), hand: [40, 47], head: [-1, 0], brows: "angry", loop: 0, sag: 4, bob: 2, jaw: 8, earN: -1, earF: -1 }, { cue: "spray" }),
    F(140, { fist: [16.5, 36], nozzle: -12, ...jet(23, 4, 6), hand: [40, 47], head: [-1, 1], brows: "angry", loop: 0, sag: 4, bob: 2, jaw: 6 }, { cue: "sweep", shake: [1, 0] }),
    F(140, { fist: [17, 31], nozzle: 14, ...jet(24, 5, 8), hand: [40, 47], head: [-1, 0], brows: "angry", loop: 0, sag: 4, bob: 2, jaw: 6 }, { shake: [-1, 0] }),
    F(140, { fist: [17.5, 29], nozzle: 36, ...jet(24, 6, 15), hand: [40, 47], head: [-1, -1], brows: "angry", loop: 0, sag: 4, bob: 2, jaw: 6 }, { shake: [1, 0] }),
    F(150, { fist: [17, 31], nozzle: 20, ...jet(6, 7), hand: [47.5, 48.5], head: [0, 0], loop: 0.3, sag: 8, bob: 1, jaw: 10 }, { cue: "stop", specks: drip(0, { nozzle: 20, fist: [17, 31] }) }),
    F(180, { spray: 0, loop: 1, eyes: "half", jaw: 14, bob: 0, head: [0, 1], earN: 2, earF: 2 }, { specks: sweat(1) }),
  ],
};

/** A small cheer (the watering grew him a piece): the nozzle up and a quick fountain, his jaw wide, eyes happy, a hop. */
const cheer: Anim = {
  loop: false,
  frames: [
    F(80, { ...UP, ...fount(14, 3), jaw: 10, eyes: "joy", bob: 1, earN: 2, earF: 2 }),
    ...Array.from({ length: 6 }, (_, i) =>
      F(80, { ...UP, ...fount(20, 4 + i), jaw: i % 2 ? 8 : 16, eyes: "joy", air: i % 2 ? 0 : 2, bob: i % 2 ? 1 : 0, earN: i % 2 ? 2 : -3, earF: i % 2 ? 2 : -3, tail: i % 2 ? 1 : 4 }, { cue: i === 0 ? "cheer" : undefined, specks: [...splashes(i, 4), ...(i === 1 ? sparkle(44, 6) : [])] }),
    ),
    F(160, { jaw: 6, eyes: "joy", ...jet(12, 12) }),
  ],
};

/** A big cheer (the watering grew him a queen): both hands up, the nozzle fountaining high, bigger hops, gold sparkles all round. */
const bigCheer: Anim = {
  loop: false,
  frames: [
    F(90, { ...UP, ...fount(14, 3), jaw: 12, eyes: "wide", bob: 2, earN: -2, earF: -2, ...HAND([46, 24]) }),
    ...Array.from({ length: 9 }, (_, i) => {
      const up = i % 2 === 0;
      return F(90, { fist: [17.5, 29], nozzle: 50, ...fount(22, 4 + i), ...HAND([46, up ? 20 : 24]), air: up ? 4 : 0, bob: up ? 0 : 2, jaw: up ? 20 : 10, eyes: "joy", earN: up ? -3 : 2, earF: up ? -3 : 2, tail: up ? 5 : 1, sag: up ? 8 : 12 },
        { cue: i === 0 ? "cheer" : i === 4 ? "whoop" : undefined, shake: i === 0 ? [0, 1] : undefined, specks: [...splashes(i, 6), ...sparkle(10 + ((i * 9) % 36), 2 + (i % 3) * 5, true), ...sparkle(46 - ((i * 7) % 30), 12 - (i % 2) * 6)] });
    }),
    F(100, { eyes: "joy", jaw: 8, ...jet(14, 14) }, { specks: sparkle(40, 8) }),
    F(200, { eyes: "joy", jaw: 4 }),
  ],
};

/**
 * A shrug (the watering grew nothing): he looks at the wet board, then both shoulders go up, his head sinks and his free hand turns out
 * palm up at his side, the nozzle drooping to a drip; he lets it go.
 */
const SHRUG: GardenerPose = { ...DOWN, lift: 2, head: [0, 2], eyes: "half", brows: "worry", earN: 3, earF: 3, ...HAND([62, 35]), elbowF: [55, 39], fist: [16.5, 34], nozzle: 12, sag: 11 };
const shrug: Anim = {
  loop: false,
  frames: [
    F(90, { ...DOWN, head: [-1, 0], eyes: "wide", brows: "up", sag: 11 }),
    F(90, { ...DOWN, lift: 1, head: [-1, 1], eyes: "half", brows: "worry", sag: 11, ...HAND([56, 38]), elbowF: [54, 38] }),
    F(120, { ...SHRUG, bob: 1, jaw: 3 }, { specks: sweat(0) }),
    F(150, { ...SHRUG, bob: 0, jaw: 5 }, { cue: "shrug" }),
    F(120, { ...SHRUG, lift: 1, bob: 1, eyes: "shut", jaw: 0 }, { specks: drip(0, SHRUG) }),
    F(100, { ...DOWN, head: [0, 1], eyes: "half", sag: 11 }, { specks: drip(1, DOWN) }),
    F(130, { eyes: "half", jaw: 0 }),
  ],
};

export const GARDENER: Character = {
  id: "gardener",
  name: "The Hippo",
  w: W,
  h: H,
  foot: [OX + FOOT_X, OY + GROUND],
  palette: GARDENER_PALETTE,
  halo: "#2c2430",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, plant, plantMany, water, cheer, bigCheer, shrug },
};

// ---- His attack on a king (for his kit's `kingAttack` once he's wired in: perSquare 36, stand 1.8, facesLeft).

/** Room ahead of him (to our left, where he faces) for the jet's reach to the king. */
const ATTACK_REACH = 40;
const AW = W + ATTACK_REACH;
const STAND = 1.8 * 36;
/** Where each jet lands on the king (scene pixels): at his head, or a little lower, in turn. */
const KING_AT = (i: number): Pt => [FOOT_X - STAND - 4, GROUND - 1 - (i % 2 ? 21 : 27)];
/** A frame of his in the attack's wider frame (his own frames already have headroom to drop in from). */
const fa = (fr: Frame): Frame => moved(fr, ATTACK_REACH, 0, AW, H);
const landShadow = (r: number): Speck[] => shadowOnly(r).map(([x, y, k]): Speck => [x + ATTACK_REACH, y, k]);

/**
 * A jet of water from the nozzle at `from` to the king at `to` (scene pixels): a stream two pixels thick on a flat arc, mid blue with a
 * deep edge and a pale glint, drops thrown off it, a splash at the end; `reach` (0 to 1) how far along it has got (a sputter is short
 * and broken: `gaps`). Water has no outline, so the mid and deep blues carry it over the light squares.
 */
function jetAt(from: Pt, to: Pt, i: number, reach = 1, gaps = false): Speck[] {
  const cells = new Map<string, Speck>();
  const put = (x: number, y: number, k: string, rank: number) => {
    const id = `${Math.round(x)},${Math.round(y)}`;
    const old = cells.get(id);
    const oldRank = old ? ["4", "3", "2", "1"].indexOf(old[2]) : 9;
    if (!old || rank < oldRank) cells.set(id, sp(x, y, k));
  };
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const pos = (u: number): Pt => [lerp(from[0], to[0], u), lerp(from[1], to[1], u) - 6 * 4 * u * (1 - u)];
  for (let s = 0; s <= len * reach; s += 0.6) {
    if (gaps && Math.floor(s / 3) % 2) continue;
    const [x, y] = pos(s / len);
    put(x, y, Math.round(s) % 7 === 0 ? "4" : "3", Math.round(s) % 7 === 0 ? 0 : 1);
    put(x, y + 1, "2", 2);
    put(x, y - 1, "2", 2);
    put(x, y + 2, "1", 3);
  }
  // Drops thrown off the stream, falling a little.
  for (let d = 0; d < 9; d++) {
    const u = (0.12 + ((d * 0.37 + i * 0.11) % 0.86)) * reach;
    const [x, y] = pos(u);
    put(x + ((d * 5 + i) % 3) - 1, y + 3 + ((d * 3 + i * 2) % 5), d % 3 === 0 ? "4" : d % 2 ? "3" : "2", 2);
  }
  // The splash where it lands.
  if (reach >= 1)
    for (const [dx, dy, k] of [[0, 0, "4"], [-1, -1, "3"], [1, -1, "3"], [-1, 1, "2"], [1, 1, "2"], [-3, -2, "3"], [3, -3, "3"], [-4, 1, "2"], [3, 3, "1"], [0, -4, "4"]] as const) put(to[0] + dx, to[1] + dy, k, k === "4" ? 0 : 2);
  return [...cells.values()];
}

/** In the attack he stares at the king, brows down, jaw set, the nozzle on him. */
const ON_KING: GardenerPose = { fist: [16.5, 34], nozzle: -3, brows: "angry", head: [-1, 0], eyes: "open", spray: 0 };
/** A beat: a jet of water at the king (the cue frame is where the board splashes his square). */
const jetBeat = (i: number): Frame => {
  const pose: GardenerPose = { ...ON_KING, fist: [16.5 + (i % 2 ? 1 : 0), 34], bob: 1, jaw: 4, earN: -1, earF: -1, tail: i % 2 ? 3 : -1 };
  const fr = fa(F(90, pose, { cue: i % 2 ? "spurt" : "jet", shake: [i % 2 ? -1 : 1, 0] }));
  const [tx, ty] = KING_AT(i);
  const tip = nozzleTip(pose);
  return { ...fr, specks: [...(fr.specks ?? []), ...jetAt([tip[0] - 1, tip[1]], [tx, ty], i).map(([x, y, k]): Speck => [x + ATTACK_REACH, y, k])] };
};
/** Between beats: the water sputters, the stare holds. */
const easeBeat = (i: number): Frame => {
  const pose: GardenerPose = { ...ON_KING, fist: [16.5, 34], bob: 0, jaw: 0, earN: 1, earF: 1, tail: i % 2 ? -1 : 2 };
  const fr = fa(F(80, pose));
  const [tx, ty] = KING_AT(i);
  const tip = nozzleTip(pose);
  return { ...fr, specks: [...(fr.specks ?? []), ...jetAt([tip[0] - 1, tip[1]], [tx, ty], i + 3, 0.45, true).map(([x, y, k]): Speck => [x + ATTACK_REACH, y, k])] };
};

/**
 * His attack on a king, the king to our left (where he faces; the board mirrors him when it's to his right), on the shared beats
 * (KING_ATTACK, boss-timing.ts): his shadow spreads, he drops in (`drop`), lands (`land`), then sprays a jet of water at the king nonstop,
 * ten of them, cues `jet` and `spurt` in turn (the cue frame is where the board splashes the king's square), staring at him, relentless; he
 * grunts once, satisfied (`grunt`), and drops out of the frame. The last frame is empty.
 */
const kingAttack: Anim = (() => {
  const A = KING_ATTACK;
  const frames: Frame[] = [
    { ms: 100, layers: [], specks: landShadow(8) },
    { ms: 100, layers: [], specks: landShadow(18) },
    fa(F(80, { air: 24, eyes: "wide", jaw: 12, earN: -3, earF: -3, tail: 4, spray: 0, sag: 13, loop: 1.3, ...UP }, { cue: "drop" })),
    fa(F(80, { air: 9, eyes: "wide", jaw: 8, earN: -2, earF: -2, spray: 0, sag: 12, loop: 1.2 })),
    fa(F(A.landAt - 360, { bob: 3, eyes: "shut", earN: 3, earF: 3, spray: 0, sag: 13, loop: 1.3 }, { cue: "land", shake: [0, 2], specks: dust(0, 3) })),
    fa(F(A.lashAt - A.landAt, { ...ON_KING, jaw: 0, earN: 1, earF: 1 }, { specks: dust(1, 3) })),
  ];
  for (let i = 0; i < A.lashes; i++) frames.push(jetBeat(i), easeBeat(i));
  const done = A.leaveAt - (A.lashAt + A.lashes * A.lashEveryMs);
  frames.push(fa(F(done, { head: [-1, -1], jaw: 14, eyes: "joy", earN: -2, earF: -2, tail: 4, ...UP, spray: 0 }, { cue: "grunt", specks: sparkle(8, 22) })));
  const leave = A.ms - A.leaveAt;
  frames.push(
    fa(F(leave - 300, { bob: 3, eyes: "half", earN: 3, earF: 3, spray: 0 })),
    fa(F(80, { air: 8, eyes: "joy", jaw: 8, earN: -2, earF: -2, spray: 0, sag: 12 }, { cue: "drop" })),
    fa(F(80, { air: 24, eyes: "joy", jaw: 8, earN: -3, earF: -3, tail: 4, spray: 0, sag: 13, loop: 1.3 })),
    { ms: 80, layers: [], specks: landShadow(10) },
    { ms: 60, layers: [] },
  );
  return { loop: false, frames };
})();

/**
 * The hippo for his attack on a king: the same drawing, parts and palette, facing our left as always (as Moo), in a frame
 * `ATTACK_REACH` wider on the left (the jet's reach). Its `idle`, one still, is for the preview, which starts every reel from one.
 */
export const GARDENER_ATTACK: Character = {
  ...GARDENER,
  id: "gardener-attack",
  name: "The Hippo (his attack)",
  w: AW,
  foot: [GARDENER.foot[0] + ATTACK_REACH, GARDENER.foot[1]],
  anims: { idle: { loop: true, frames: [fa(F(1000))] }, kingAttack },
};

/** The part of him a portrait shows (his head, muzzle and ears, and a bit of his shoulders), in frame pixels. */
export const GARDENER_PORTRAIT = { x: OX + 5, y: OY - 3, w: 42, h: 33 } as const;
