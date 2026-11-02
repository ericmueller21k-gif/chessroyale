/**
 * Tock, the clockmaker badger (concept, idle only). A stout old badger with the striped black-and-white face, a brass
 * jeweler's loupe screwed into his near eye (the eye magnified behind its glass), a red bow tie, a cream shirt with rolled
 * sleeves, a walnut leather apron with pockets (a screwdriver, a tweezer, a peeking gear), holding up a big brass pocket
 * watch on a chain. Facing our left, light from the top left.
 *
 * Rig: everything is painted in scene coordinates and placed by a pose (bob, head offset, eyes, the watch's tick, the
 * free paw's position, the watch's jiggle, the spring), so a frame is a handful of numbers.
 */
import { canvas, inEllipse, inPoly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;

const PALETTE: Record<string, string> = {
  k: "#1a1210", // outline
  s: "#1c1a20", // badger black: stripes, ears, paws
  t: "#36333d",
  u: "#55515e",
  h: "#a9a49c", // badger white: shadow to light
  i: "#dcd6cb",
  j: "#fbf8f0",
  g: "#5a5763", // grey fur: shadow to light
  G: "#7a7784",
  H: "#a09dab",
  c: "#b9a47c", // cream shirt
  C: "#e3d2a8",
  D: "#fff1d0",
  a: "#3e2314", // walnut leather apron
  b: "#5f3720",
  d: "#86502b",
  e: "#ad7140",
  J: "#6e4a12", // brass
  K: "#b0791c",
  L: "#e3ad3c",
  M: "#ffe08a",
  W: "#fffbe8", // glint
  f: "#f6ecd2", // watch face
  F: "#b8a684",
  x: "#22160f", // hands, pupils
  q: "#6f9aab", // loupe glass
  Q: "#b9dde4",
  r: "#9c2430", // bow tie, screwdriver handle
  R: "#d8434a",
  v: "#6f7884", // steel
  V: "#c3ccd6",
  z: "#0d0e12", // ground shadow
};

const OX = -2;
const OY = -13;
const W = 60;
const H = 72;
const GY = 82;

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const union = (...fs: Inside[]): Inside => (x, y) => fs.some((f) => f(x, y));
const E = inEllipse;
const FUR = "gGH";
const WHITE = "hij";
const CREAM = "cCD";
const LEATHER = "abde";
const BRASS = "JKLM";

function painted(x0: number, y0: number, w: number, h: number, draw: (F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void) => void, outline = true): { part: Part; at: Pt } {
  const cv: Canvas = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const S = (rows: readonly string[], sx: number, sy: number) =>
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const X = Math.round(sx) + i - x0;
        const Y = Math.round(sy) + j - y0;
        if (k !== "." && cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  draw(F, S);
  return { part: { grid: toGrid(cv), outline }, at: [x0, y0] };
}

function nearest(p: Pt, a: Pt, b: Pt) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function along(pts: readonly Pt[], r: readonly number[], p: Pt) {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
  pts.slice(1).forEach((q, i) => {
    const n = nearest(p, pts[i]!, q);
    const rr = r[i]! + (r[i + 1]! - r[i]!) * n.t;
    if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
  });
  return best;
}
const taper = (pts: readonly Pt[], r: readonly number[]): Inside => (x, y) => {
  const a = along(pts, r, [x + 0.5, y + 0.5]);
  return a.d <= a.rr;
};
const tubeLight = (pts: readonly Pt[], r: readonly number[]) => (x: number, y: number) => {
  const a = along(pts, r, [x + 0.5, y + 0.5]);
  return 0.6 - 0.45 * (a.nx / a.rr) - 0.5 * (a.ny / a.rr);
};

function elbowOf(s: Pt, t: Pt, [l1, l2]: Pt, down = true): Pt {
  const dist = Math.hypot(t[0] - s[0], t[1] - s[1]) || 0.01;
  const d = Math.min(dist, l1 + l2 - 0.01);
  const [ux, uy] = [(t[0] - s[0]) / dist, (t[1] - s[1]) / dist];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const [mx, my] = [s[0] + ux * a, s[1] + uy * a];
  const c1: Pt = [mx - uy * h, my + ux * h];
  const c2: Pt = [mx + uy * h, my - ux * h];
  return (c1[1] + c1[0] * 0.6 >= c2[1] + c2[0] * 0.6) === down ? c1 : c2;
}

// ---- The head: a wedge with the snout to our left, two black stripes running back through the eyes to the ears.

type Eyes = "open" | "down" | "side" | "shut" | "smug";
const HEAD_POLY: Pt[] = [[13.6, 34], [15, 31.6], [19, 28.6], [23, 23.6], [28, 19.8], [34, 18.2], [40, 18.8], [45, 21.6], [47.4, 27], [47.2, 33], [44.4, 38], [38.4, 41], [30, 41.2], [23, 39.4], [17, 37.4], [14, 36.2]];
const FAR_STRIPE = taper([[17, 31.2], [21.6, 26.8], [27, 22.2], [32, 19]], [1.1, 2.1, 2.6, 2.4]);
const NEAR_STRIPE = taper([[21.5, 35.4], [27, 31.8], [33.5, 28.6], [40, 24.4], [45.5, 21.4]], [1, 2.4, 3.3, 3.3, 2.8]);
const EYE_C: Pt = [33.5, 29.5];

function head(eyes: Eyes, smile: boolean): { part: Part; at: Pt } {
  const inside = inPoly(HEAD_POLY);
  const light = (x: number, y: number) => 0.66 - 0.36 * ((x + 0.5 - 30) / 16) - 0.5 * ((y + 0.5 - 28) / 11);
  return painted(12, 16, 38, 27, (F, S) => {
    F(inside, (x, y) => {
      const l = light(x, y);
      if (NEAR_STRIPE(x, y) || FAR_STRIPE(x, y)) return l > 0.8 ? "u" : l > 0.45 ? "t" : "s";
      if (x + 0.5 > 41.5 + (y - 30) * 0.2) return ramp(FUR, l + 0.15);
      return ramp(WHITE, l + 0.2);
    });
    // The nose, the mouth line, the loupe's strap back over the stripe.
    S(["ss", "sss", "ss"], 13, 33);
    S(["t"], 14, 32);
    S(smile ? ["t...t", ".ttt."] : ["tttt."], 17, 37);
    for (let x = 37; x <= 46; x++) S(["b"], x, Math.round(28 - (x - 37) * 0.32));
    // The far eye, small, in the far stripe.
    const far: Record<Eyes, [string[], number, number]> = {
      open: [["Ws", "ss"], 22, 25],
      down: [["ss", "Ws"], 21, 25],
      side: [["sW", "ss"], 22, 25],
      shut: [["uu"], 22, 26],
      smug: [["uu", "Ws"], 22, 25],
    };
    const [rows, ex, ey] = far[eyes];
    S(rows, ex, ey);
  });
}

/** The loupe: a brass barrel screwed into the near eye, its glass showing the eye magnified. */
function loupe(eyes: Eyes): { part: Part; at: Pt } {
  const [cx, cy] = EYE_C;
  return painted(27, 23, 13, 14, (F) => {
    const barrel = E(cx - 1.3, cy + 0.8, 4.4, 4.7);
    const ring = E(cx, cy, 4.4, 4.7);
    const glass = E(cx, cy, 2.9, 3.2);
    F(barrel, (x, y) => ((x + y) % 2 ? "J" : "K"));
    F(ring, (x, y) => {
      const l = 0.55 - 0.45 * ((x + 0.5 - cx) / 4.4) - 0.5 * ((y + 0.5 - cy) / 4.7);
      return ramp(BRASS, l);
    });
    const [px, py] = eyes === "down" ? [-1, 1] : eyes === "side" ? [1, 0] : [0, 0];
    F(glass, (x, y) => {
      const X = x + 0.5 - cx;
      const Y = y + 0.5 - cy;
      if (eyes === "shut") return Y > -0.2 && Y < 1 ? "x" : Y <= -0.2 ? "t" : "q";
      if (eyes === "smug" && Y < -0.9) return "t";
      const dx = X - px;
      const dy = Y - py;
      if (dx >= -2 && dx < -1 && dy >= -2 && dy < -1 && eyes !== "smug") return "W";
      if (dx * dx + dy * dy <= 2.6) return dx < -0.5 && dy < -0.5 ? "W" : "x";
      return X + Y < -1.5 ? "Q" : "q";
    });
  });
}

function ear(cx: number, cy: number, rx: number, ry: number): { part: Part; at: Pt } {
  return painted(Math.floor(cx - rx) - 1, Math.floor(cy - ry) - 1, Math.ceil(rx * 2) + 3, Math.ceil(ry * 2) + 3, (F) => {
    const shape = E(cx, cy, rx, ry);
    F(shape, (x, y) => {
      if (!shape(x, y - 1) || !shape(x - 1, y)) return "i";
      return x + 0.5 > cx ? "s" : "t";
    });
  });
}

// ---- The body.

function torso(): { part: Part; at: Pt } {
  return painted(22, 42, 33, 36, (F, S) => {
    F(E(38, 60, 14.5, 15.5), (x, y) => ramp(CREAM, 0.62 - 0.4 * ((x + 0.5 - 38) / 14.5) - 0.45 * ((y + 0.5 - 60) / 15.5)));
    // The collar's points under his chin.
    S(["DD...CC", ".D...C."], 30, 44);
  });
}

const APRON: Pt[] = [[28.6, 46], [40.4, 46], [41.4, 53], [48.6, 56.6], [51.2, 72], [48.4, 77], [26, 77], [23.2, 72], [24.8, 57], [27.6, 53]];
function apron(): { part: Part; at: Pt } {
  const ins = inPoly(APRON);
  return painted(20, 44, 34, 35, (F, S) => {
    F(ins, (x, y) => {
      const l = 0.7 - 0.035 * (x - 28) - 0.012 * (y - 52);
      if (!ins(x, y - 1)) return "e";
      if (y === 56 && x > 27 && x < 48) return "a";
      if (!ins(x + 1, y)) return "a";
      return ramp(LEATHER, l);
    });
    // The straps up to his neck.
    S(["d", "d"], 29, 44);
    S(["b", "b"], 39, 44);
    // Tools in the left pocket: a screwdriver and a tweezer; a gear peeking from the right one.
    S(["R", "r", "r", "V"], 32, 58);
    S(["V", "v", "v"], 29, 59);
    S([".K.K.", "KLMLK"], 41, 60);
    const pocket = (x0: number, x1: number) =>
      F((x, y) => x >= x0 && x <= x1 && y >= 62 && y <= 68, (x, y) => (y === 62 ? "e" : y === 68 || x === x1 ? "a" : (x + y) % 3 === 0 && (x === x0 || y === 63) ? "e" : "b"));
    pocket(26, 33);
    pocket(39, 46);
  });
}

function bowtie(): { part: Part; at: Pt } {
  return painted(30, 41, 7, 4, (_F, S) => S(["Rr.Rr", "RrrRr", "Rr.rr"], 30, 41));
}

function leg(x: number, toe: number): { part: Part; at: Pt } {
  return painted(x - 6, 72, 18, 11, (F) => {
    F((X, Y) => X >= x && X <= x + 4 && Y >= 74 && Y <= 79, (X) => (X === x ? "d" : X === x + 4 ? "a" : "b"));
    F(E(x + 2.5 + toe, 80.6, 4, 1.7), (X, Y) => (Y < 80 && X < x + 3 + toe ? "u" : "s"));
  });
}

/** An arm: a cream sleeve rolled at the elbow, a grey furred forearm and a black paw with pale claws. */
function arm(sh: Pt, paw: Pt, bones: Pt, down = true): { part: Part; at: Pt } {
  const el = elbowOf(sh, paw, bones, down);
  const rl: Pt = [sh[0] + (el[0] - sh[0]) * 0.55, sh[1] + (el[1] - sh[1]) * 0.55];
  const upper = taper([sh, el], [3.1, 2.6]);
  const upperL = tubeLight([sh, el], [3.1, 2.6]);
  const sleeve = taper([sh, rl], [3.4, 3.2]);
  const sleeveL = tubeLight([sh, rl], [3.4, 3.2]);
  const roll = taper([rl, rl], [3.5, 3.5]);
  const fore = taper([el, paw], [2.5, 2.2]);
  const foreL = tubeLight([el, paw], [2.5, 2.2]);
  const pawS = E(paw[0], paw[1], 2.9, 2.7);
  const xs = [sh[0], el[0], paw[0]];
  const ys = [sh[1], el[1], paw[1]];
  const x0 = Math.floor(Math.min(...xs)) - 5;
  const y0 = Math.floor(Math.min(...ys)) - 5;
  const w = Math.ceil(Math.max(...xs)) + 6 - x0;
  const h = Math.ceil(Math.max(...ys)) + 6 - y0;
  const [dx, dy] = [paw[0] - el[0], paw[1] - el[1]];
  const dl = Math.hypot(dx, dy) || 1;
  return painted(x0, y0, w, h, (F, S) => {
    F(fore, (x, y) => ramp(FUR, foreL(x, y)));
    F(upper, (x, y) => ramp(FUR, upperL(x, y)));
    F(sleeve, (x, y) => ramp(CREAM, sleeveL(x, y) + 0.05));
    F(roll, (x, y) => (x + 0.5 - rl[0] + (y + 0.5 - rl[1]) < -1 ? "D" : "c"));
    F(pawS, (x, y) => (x + 0.5 - paw[0] + (y + 0.5 - paw[1]) < -1.5 ? "u" : x + 0.5 - paw[0] + (y + 0.5 - paw[1]) < 0.5 ? "t" : "s"));
    // Claws, at the paw's far end.
    const tx = paw[0] + (dx / dl) * 2.2;
    const ty = paw[1] + (dy / dl) * 2.2;
    S(["i"], Math.floor(tx), Math.floor(ty));
    S(["i"], Math.floor(tx - (dy / dl) * 1.5), Math.floor(ty + (dx / dl) * 1.5));
  });
}

// ---- The watch.

const WATCH_C: Pt = [17.5, 49.5];
function watch(tick: number): { part: Part; at: Pt } {
  const [cx, cy] = WATCH_C;
  return painted(9, 39, 18, 19, (F, S) => {
    F(E(cx, cy, 6.6, 6.6), (x, y) => {
      if (E(cx, cy, 4.9, 4.9)(x, y)) return "f";
      return ramp(BRASS, 0.55 - 0.42 * ((x + 0.5 - cx) / 6.6) - 0.5 * ((y + 0.5 - cy) / 6.6));
    });
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      S([k % 3 === 0 ? "x" : "F"], Math.floor(cx + Math.sin(a) * 4.1), Math.floor(cy - Math.cos(a) * 4.1));
    }
    // The hour hand, still at ten; the minute hand ticks round.
    S(["x"], Math.floor(cx) - 1, Math.floor(cy) - 1);
    const a = (tick * Math.PI) / 6;
    for (let t = 0.6; t <= 3.3; t += 0.5) S(["x"], Math.floor(cx + Math.sin(a) * t), Math.floor(cy - Math.cos(a) * t));
    S(["J"], Math.floor(cx), Math.floor(cy));
    // The bow and the crown on top, the glint on the rim.
    S(["KLK", "K.K"], 16, 39);
    S(["M"], 17, 41);
    S(["W", ".W"], 12, 44);
  });
}

function chain(): { part: Part; at: Pt } {
  return painted(16, 54, 16, 14, (_F, S) => {
    const a: Pt = [17.5, 55.5];
    const c: Pt = [20, 70];
    const b: Pt = [28.5, 62.5];
    let last = "";
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const x = Math.floor((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0]);
      const y = Math.floor((1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]);
      const key = `${x},${y}`;
      if (key === last) continue;
      last = key;
      S([(x + y) % 2 ? "L" : "K"], x, y);
    }
  });
}

// ---- Parts and the pose.

const { parts: PARTS, add } = lazyParts();
const placedAt = new Map<string, Pt>();
function placed(name: string, make: () => { part: Part; at: Pt }): { name: string; at: Pt } {
  let at = placedAt.get(name);
  if (!at) {
    const m = make();
    add(name, () => m.part);
    placedAt.set(name, (at = m.at));
  }
  return { name, at };
}
add("shadow", () => {
  const cv = canvas(34, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 34; x++) if (E(17, 2, 17, 2)(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
});
add("spring", () => ({ grid: ["VVV", "v..", "VVV", "..v", "VVV", "v.."] }));

interface Pose {
  bob?: number;
  head?: Pt;
  eyes?: Eyes;
  smile?: boolean;
  tick?: number;
  pawR?: Pt;
  watchDy?: number;
  spring?: Pt;
}
const SHOULDER_L: Pt = [28, 50];
const SHOULDER_R: Pt = [45, 49];
const PAW_L: Pt = [18.5, 57];
const REST_R: Pt = [46, 64];

function layers(pose: Pose): Layer[] {
  const b = pose.bob ?? 0;
  const [hx, hy] = pose.head ?? [0, 0];
  const eyes = pose.eyes ?? "open";
  const tick = pose.tick ?? 0;
  const pawR = pose.pawR ?? REST_R;
  const wd = pose.watchDy ?? 0;
  const at = (pl: { name: string; at: Pt }, dx = 0, dy = 0): Layer => ({ part: pl.name, x: OX + pl.at[0] + dx, y: OY + pl.at[1] + dy });
  const shR = SHOULDER_R;
  const pR: Pt = [pawR[0], pawR[1] - b];
  const out: Layer[] = [
    { part: "shadow", x: OX + 21, y: OY + GY - 2 },
    at(placed("earF", () => ear(31.5, 18.5, 2.6, 2.6)), hx, hy + b),
    at(placed("earN", () => ear(44, 20.5, 3.2, 3.2)), hx, hy + b),
    at(placed("legL", () => leg(28, -1.5))),
    at(placed("legR", () => leg(39, 0.5))),
    at(placed("torso", torso), 0, b),
    at(placed("apron", apron), 0, b),
    at(placed("chain", chain), 0, b),
    at(placed(`head:${eyes}:${pose.smile ? 1 : 0}`, () => head(eyes, !!pose.smile)), hx, hy + b),
    at(placed(`loupe:${eyes}`, () => loupe(eyes)), hx, hy + b),
    at(placed("bowtie", bowtie), 0, b),
    at(placed(`armL:${wd}`, () => arm(SHOULDER_L, [PAW_L[0], PAW_L[1] + wd], [7.5, 7.5])), 0, b),
    at(placed(`watch:${tick % 12}`, () => watch(tick % 12)), 0, b + wd),
    at(placed(`armR:${pR[0]},${pR[1]}`, () => arm(shR, pR, [9.5, 10.5])), 0, b),
  ];
  if (pose.spring) out.push({ part: "spring", x: OX + pose.spring[0], y: OY + pose.spring[1] + b });
  return out;
}

const sp = (x: number, y: number, k: string): Speck => [OX + x, OY + y, k];
const star = (x: number, y: number, big: boolean): Speck[] =>
  big ? [sp(x, y, "W"), sp(x - 1, y, "M"), sp(x + 1, y, "M"), sp(x, y - 1, "M"), sp(x, y + 1, "M"), sp(x - 2, y, "L"), sp(x + 2, y, "L"), sp(x, y - 2, "L"), sp(x, y + 2, "L")] : [sp(x, y, "W"), sp(x - 1, y, "L"), sp(x + 1, y, "L"), sp(x, y - 1, "L"), sp(x, y + 1, "L")];

/** One frame: a pose and its specks. */
const Fr = (ms: number, pose: Pose, specks: Speck[] = []): Frame => ({ ms, layers: layers(pose), specks });

const MID_R: Pt = [36, 55];
const TAP_UP: Pt = [27, 41.5];
const TAP: Pt = [25.5, 44];
const POCKET: Pt = [43, 61];

/**
 * Idle (24 frames of 180 ms, 4.3 s): the minute hand ticks round twice. He breathes; peers down at the watch through the
 * loupe, taps its rim twice (it jiggles), looks up pleased, the loupe glints. A little spring boings out of his apron
 * pocket; he looks at it, plucks it and tucks it back with a pat; a blink.
 */
const SCRIPT: Pose[] = [
  {},
  { bob: 1 },
  { bob: 1 },
  {},
  { head: [-1, 1], eyes: "down" },
  { head: [-1, 1], eyes: "down" },
  { head: [-1, 1], eyes: "down", pawR: MID_R },
  { head: [-1, 1], eyes: "down", pawR: TAP_UP },
  { head: [-1, 1], eyes: "down", pawR: TAP, watchDy: 1 },
  { head: [-1, 1], eyes: "down", pawR: TAP_UP },
  { head: [-1, 1], eyes: "down", pawR: TAP, watchDy: 1 },
  { eyes: "open", pawR: MID_R, smile: true },
  { eyes: "smug", smile: true },
  { eyes: "smug", smile: true, bob: 1 },
  { bob: 1, spring: [41, 57] },
  { eyes: "down", spring: [38, 49] },
  { eyes: "down", head: [0, 1], spring: [38, 52] },
  { eyes: "down", head: [0, 1], pawR: [42, 56], spring: [39, 53] },
  { eyes: "down", head: [0, 1], pawR: POCKET, spring: [41, 57] },
  { pawR: [43, 63] },
  { smile: true },
  { smile: true, bob: 1 },
  { eyes: "shut", bob: 1 },
  {},
];
const EXTRA: Record<number, Speck[]> = {
  3: star(12, 44, false),
  8: [sp(28, 40, "V"), sp(29, 39, "V"), sp(28, 45, "V")],
  10: [sp(28, 40, "V"), sp(29, 39, "V"), sp(28, 45, "V")],
  12: [...star(32, 28, true), sp(28, 24, "W"), sp(27, 23, "M")],
  13: star(32, 28, false),
  14: [sp(39, 56, "V"), sp(45, 56, "V"), sp(40, 54, "W")],
  15: [sp(36, 48, "W"), sp(42, 48, "W"), sp(37, 46, "V"), sp(41, 46, "V"), sp(39, 56, "v"), sp(39, 58, "v")],
};
const idle: Anim = {
  loop: true,
  frames: SCRIPT.map((p, i) => ({ ...Fr(180, { tick: i, ...p }, EXTRA[i] ?? []), ...(i === 12 ? { pal: { q: "#b9dde4", Q: "#ffffff" } } : {}) })),
};

export const TOCK: Character = {
  id: "boss-tock",
  name: "Tock",
  w: W,
  h: H,
  foot: [OX + 37, OY + GY],
  palette: PALETTE,
  halo: "#3a3026",
  parts: PARTS,
  anims: { idle },
};
