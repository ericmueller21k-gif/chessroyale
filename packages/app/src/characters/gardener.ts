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
 * This is his still only (docs/decisions/2026-10-20-gardener-still.md): the first frame of `idle`, nothing else; his powers and
 * his animations come later. He isn't in `CHARACTERS`, `BOSS_KITS` or the roster, and nothing in the game draws him yet; the
 * preview draws him with its `extra=` option.
 *
 * Rigging, so the poses that follow are numbers (`GardenerPose`), as the other bosses':
 * - the nozzle hand (`fist`, `elbowN`, `nozzle`: it aims) and the water spray, a part of its own (`spray`: its length, droop
 *   and flicker: it turns on and off and arcs over the board);
 * - the other arm (`hand`, `elbowF`: it holds the hose, lets go, reaches for seeds and tosses them), and the hose, which is
 *   redrawn from the nozzle through that hand wherever they go (`sag`: how far it hangs across his belly), with the spare
 *   behind him (`BACK_LOOP`);
 * - the head moves as one (`head`), with the jaw a part of its own (`jaw`: degrees open, a great yawn or roar), the ears
 *   (`earN`, `earF`: they flick), the eyes (`eyes`) and the tail (`tail`);
 * - his legs step (`stepN`, `stepF`) and he breathes (`bob`).
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
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
const OX = 14;
const OY = 16;
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

export type Eyes = "open" | "half" | "shut" | "wide";
/** An eye: a round dark one with a glint (a pale pixel up and to the left); `w` its width (the far eye, seen at an angle, is narrower). */
function eye(x0: number, y0: number, w: number, lid: Eyes): { part: Part; at: Pt } {
  const rows: Record<Eyes, string[]> = {
    open: w >= 4 ? [".xx.", "xwxx", "xxxx", ".xx."] : [".xx", "xwx", ".xx"],
    half: w >= 4 ? ["xxxx", ".xx."] : ["xxx", ".xx"],
    shut: w >= 4 ? ["xxxx"] : ["xxx"],
    wide: w >= 4 ? [".xxx.", "xwwxx", "xwxxx", ".xxx."] : [".xx.", "xwx.", ".xx."],
  };
  return painted(x0, y0, 5, 5, (_F, S) => S(rows[lid], x0, y0), false);
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
  /** The hose from the nozzle through his other hand and behind him: how far it hangs below the line between the hands. */
  sag?: number;
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
  fist: [16.5, 33] as Pt,
  nozzle: 8,
  spray: 16,
  droop: 6,
  seed: 3,
  sag: 9,
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
 * The hose in front of him: from the nozzle's fitting `butt` sagging `sag` pixels across his belly to his other hand, and from
 * there to where it goes behind him (`WRAP`). It ends just inside his side, so it looks to pass behind.
 */
function hoseFront(butt: Pt, hand: Pt, sag: number): { part: Part; at: Pt } {
  const control: Pt = [(butt[0] + hand[0]) / 2 - 2, Math.max(butt[1], hand[1]) + sag];
  const pts: Pt[] = [
    ...Array.from({ length: 13 }, (_, i) => bez(butt, control, hand, i / 12)),
    ...Array.from({ length: 4 }, (_, i): Pt => [hand[0] + ((WRAP[0] - hand[0]) * (i + 1)) / 4, hand[1] + ((WRAP[1] - hand[1]) * (i + 1)) / 4]),
  ];
  return stroke(pts, pts.map(() => 1.05), (l, _s, across) => (across < -0.3 && l > 0.55 ? "G" : ramp(HOSE, l - 0.18)));
}

/** The spare hose behind him, past his hip. */
function hoseBack(): { part: Part; at: Pt } {
  return stroke(BACK_LOOP, BACK_LOOP.map(() => 1.05), (l, _s, across) => (across < -0.3 && l > 0.55 ? "G" : ramp(HOSE, l - 0.18)));
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
  const shoulderN = up(SHOULDER_N, b);
  const shoulderF = up(SHOULDER_F, b);
  const fistN: Pt = up(p.fist, b);
  const handF: Pt = up(p.hand, b);
  const elbowN = pose.elbowN ? up(pose.elbowN, b) : elbowOf(shoulderN, fistN, BONES_N);
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
    L(placed("hoseBack", hoseBack), b),
    L(placed("torso", torso), b),
    H(placed(`mouthIn:${p.jaw}`, () => mouthIn(p.jaw))),
    H(placed(`jaw:${p.jaw}`, () => jaw(p.jaw))),
    H(placed("head", head)),
    H(placed(`earF:${p.earF}`, () => ear(EAR_F[0], EAR_F[1], p.earF))),
    H(placed(`earN:${p.earN}`, () => ear(EAR_N[0], EAR_N[1], p.earN))),
    H(placed(`eyeF:${p.eyes}`, () => eye(EYE_F[0], EYE_F[1], 3, p.eyes))),
    H(placed(`eyeN:${p.eyes}`, () => eye(EYE_N[0], EYE_N[1], 4, p.eyes))),
    L(placed(`armF:${key([shoulderF, elbowF, handF])}`, () => armF(shoulderF, elbowF, handF))),
    L(placed(`armN:${key([shoulderN, elbowN, fistN])}`, () => armN(shoulderN, elbowN, fistN))),
    L(placed(`hose:${key([hoseEnd, handF])}:${r2(p.sag)}`, () => hoseFront(hoseEnd, handF, p.sag))),
    L(placed(`nozzle:${key([butt, tip])}`, () => nozzle(butt, tip))),
    at("fist", handF[0] - 3, handF[1] - 2),
    at("fist", fistN[0] - 3, fistN[1] - 2.5),
  ];
  if (p.spray > 0) layers.push(L(placed(`spray:${key([tip])}:${p.nozzle}:${p.spray}:${p.droop}:${p.seed}`, () => spray([tip[0] - 1.5, tip[1]], 180 - p.nozzle, p.spray, p.droop, p.seed))));
  // The whole of him moved: sideways, and up (his shadow stays on the ground).
  return p.dx || p.air ? layers.map((l) => (l.part === "shadow" ? { ...l, x: l.x + p.dx } : { ...l, x: l.x + p.dx, y: l.y - p.air })) : layers;
}

const idle: Anim = { loop: true, frames: [{ ms: 1000, layers: gardenerLayers() }] };

export const GARDENER: Character = {
  id: "gardener",
  name: "The Hippo",
  w: W,
  h: H,
  foot: [OX + FOOT_X, OY + GROUND],
  palette: GARDENER_PALETTE,
  halo: "#2c2430",
  parts: PARTS,
  anims: { idle },
};

/** The part of him a portrait shows (his head, muzzle and ears, and a bit of his shoulders), in frame pixels. */
export const GARDENER_PORTRAIT = { x: OX + 5, y: OY - 3, w: 42, h: 33 } as const;
