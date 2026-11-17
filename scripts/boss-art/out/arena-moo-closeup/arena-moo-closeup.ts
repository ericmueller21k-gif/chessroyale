/**
 * Moo & Moon's full moon, scene B: the close-up. A full-bleed cinematic picture (200 x 260, opaque): Moo and his Moon
 * in side profile, facing our left and gazing up at the giant full moon off frame (upper left). A glistening radiance
 * streams onto them from there: diagonal shafts of pale light in the night sky, sparkles drifting down them, and a pale
 * rim light along the faces, snout, horns and ear on the side toward it; the rest of them in cool night shade.
 *
 * Rig: every part is painted in frame coordinates (placed at 0, 0) so a frame only picks parts and numbers: the sky
 * (its shafts are their own palette keys, so a frame's `pal` brightens them), the head, ear (two poses: a twitch),
 * horn, snout, Moo's eye and the Moon's eye (five whitening stages each), their glows, and sparkles as specks.
 * `idle`: 4 frames, eyes normal. `whiten`: 5 frames, the eyes fill with white from the light's side and glow.
 */
import { canvas, edge, inPoly, line, poly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const W = 200;
const H = 260;

type In = (x: number, y: number) => boolean;
type Pt = readonly [number, number];

const PALETTE: Record<string, string> = {
  k: "#1a0f16", // outline
  G: "#4f4c7c", // cream in night shade (cool violet), then lilac, then Moo's warm creams
  H: "#8e87ab",
  C: "#c9b39b",
  D: "#e0c8a2",
  E: "#f5e6c6",
  F: "#fff6e0",
  A: "#1e1424", // his patches, ear, hooves: cool dark, then Moo's browns
  a: "#37201a",
  b: "#552f27",
  c: "#744339",
  d: "#92594a",
  o: "#7a4262", // pink in shade, then Moo's pinks
  p: "#b95a63",
  q: "#dd7b80",
  r: "#f19c96",
  s: "#ffc1b2",
  n: "#4a1a28", // nostril
  R: "#6e5448", // horn in shade, then Moo's tans
  h: "#a9773e",
  i: "#d3a25c",
  j: "#efcb8c",
  e: "#b07240", // iris mid, dark, light; pupil; glint; the eye's white in night
  f: "#6e3c20",
  g: "#dc9e5e",
  x: "#1f0f0a",
  w: "#ffffff",
  W: "#cfcde6",
  Q: "#c9801f", // the Moon
  M: "#e3a22b",
  N: "#f8c744",
  O: "#ffdc6c",
  P: "#fff0a8",
  u: "#6a3714",
  v: "#f08e80",
  V: "#ffb1a4",
  L: "#fffbe6", // the moonlight: rim, glow near, glow far, whitening edge
  Y: "#fff3b0",
  Z: "#ffd860",
  y: "#fff8d8",
  "0": "#070920", // the sky, dark (lower right) to light (upper left)
  "1": "#0c1030",
  "2": "#121842",
  "3": "#1a2256",
  "4": "#232d6a",
  "5": "#2c3878", // the shafts: edge, body, core
  "6": "#3c4b90",
  "7": "#5869ac",
  "8": "#9aa6e0", // stars, dim and bright
  "9": "#ffffff",
  l: "#08130f", // grass: dark, mid, tip, tip in the light
  m: "#132a22",
  T: "#2a5242",
  U: "#8fb8a4",
};

// ---------------------------------------------------------------- shapes and light

const ell = (cx: number, cy: number, rx: number, ry: number, deg = 0): In => {
  const a = (deg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const u = dx * ca + dy * sa;
    const v = -dx * sa + dy * ca;
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
  };
};
const any = (...fs: In[]): In => (x, y) => fs.some((f) => f(x, y));
const tri = (pts: readonly Pt[]): In => inPoly(pts);

/** The shafts of moonlight: centered on lines along (0.6, 0.8), at these offsets across them, and widths. */
const SHAFTS: readonly (readonly [number, number])[] = [
  [-78, 16],
  [-34, 10],
  [12, 20],
  [62, 9],
  [108, 16],
  [150, 8],
];
const across = (x: number, y: number) => x * 0.8 - y * 0.6;
const along = (x: number, y: number) => x * 0.6 + y * 0.8;
const shaftAt = (x: number, y: number) => SHAFTS.find(([c, w]) => Math.abs(across(x, y) - c) < w / 2);

/** Light from the upper left on a round mass, plus a lift where a shaft falls on it. */
const lightOf = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => {
  const nx = (x + 0.5 - cx) / rx;
  const ny = (y + 0.5 - cy) / ry;
  return 0.5 + bias - 0.45 * nx - 0.55 * ny;
};

/** A round mass: center, radii, tilt in degrees. */
type Mass = readonly [number, number, number, number, number?];
const LD = (() => {
  const v = [-0.55, -0.65, 0.55];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((c) => c / n) as [number, number, number];
})();
/** Lambert light on a set of round masses (the brightest mass under a pixel wins), so bands follow the form. */
const formLight = (masses: readonly Mass[], bias = 0, contrast = 1) => (x: number, y: number) => {
  let best = -9;
  let fallback = -9;
  for (const [cx, cy, rx, ry, deg = 0] of masses) {
    const a = (deg * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    let u = (dx * ca + dy * sa) / rx;
    let v = (-dx * sa + dy * ca) / ry;
    let d = u * u + v * v;
    const inside = d <= 1;
    if (!inside) {
      const s = Math.sqrt(d);
      u /= s;
      v /= s;
      d = 1;
    }
    const nz = Math.sqrt(Math.max(0, 1 - d));
    const nx = u * ca - v * sa;
    const ny = u * sa + v * ca;
    const l = nx * LD[0] + ny * LD[1] + nz * LD[2];
    if (inside) best = Math.max(best, l);
    fallback = Math.max(fallback, l);
  }
  const l = best > -9 ? best : fallback;
  return 0.5 + bias + 0.5 * contrast * l;
};

function paintIn(cv: Canvas, inside: In, ramp: (x: number, y: number) => string, light: (x: number, y: number) => number) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      const r = ramp(x, y);
      const l = Math.max(0, Math.min(0.999, light(x, y)));
      cv[y]![x] = r[Math.floor(l * r.length)]!;
    }
}

const put = (cv: Canvas, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && y >= 0 && x < W && y < H) cv[y]![x] = k;
};

/** The rim of moonlight: the edges facing up and left, in `key`. */
function rim(cv: Canvas, key = "L", leftDepth = 2) {
  edge(cv, -1, 0, "*", key, leftDepth);
  edge(cv, 0, -1, "*", key, 1);
  edge(cv, -1, -1, "*", key, 1);
}

const CREAM = "GHCDEF";
const BROWN = "Aabcd";
const PINK = "opqrs";
const HORN = "Rhij";
const MOONR = "QMNOP";

// ---------------------------------------------------------------- the sky

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function sky(): Part {
  const cv = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 1 - along(x, y) / 328 + 0.012 * Math.sin(x * 0.13 + y * 0.05);
      v = Math.max(0, Math.min(0.999, v * 1.05));
      let k = "01234"[Math.floor(v * 5)]!;
      const s = shaftAt(x, y);
      if (s) {
        const t = along(x, y);
        const d = Math.abs(across(x, y) - s[0]) / (s[1] / 2);
        const fade = t / 300; // stronger near the source
        if (fade < 1) {
          if (d < 0.35 && fade < 0.45) k = "7";
          else if (d < 0.6 && fade < 0.85) k = "6";
          else k = "5";
        }
      }
      // the glare of the full moon, just off the corner
      const g = Math.hypot(x + 14, y + 10) + 2.5 * Math.sin(Math.atan2(y + 10, x + 14) * 11);
      if (g < 30) k = "W";
      else if (g < 44) k = "7";
      else if (g < 62 && k !== "7") k = "6";
      else if (g < 80 && !"67".includes(k)) k = "5";
      cv[y]![x] = k;
    }
  // stars, not in the shafts' cores
  seed = 11;
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * 230);
    const k = cv[y]![x]!;
    if ("67".includes(k)) continue;
    put(cv, x, y, i % 9 === 0 ? "9" : "8");
    if (i % 9 === 0 && i % 2 === 0) {
      put(cv, x - 1, y, "8");
      put(cv, x + 1, y, "8");
      put(cv, x, y - 1, "8");
      put(cv, x, y + 1, "8");
    }
  }
  return { grid: toGrid(cv), outline: false };
}

// ---------------------------------------------------------------- Moo

/** The head's round masses: cranium, face (the forehead's line rising to the poll), cheek and jaw, chin, muzzle. */
const CRANIUM: Mass = [120, 82, 37, 40];
const FACE: Mass = [92, 62, 38, 22, -8];
const BRIDGE: Mass = [69, 62, 18, 16, -4];
const BROW: Mass = [97, 58, 17, 9, -12];
const CHEEK: Mass = [102, 98, 30, 20, 30];
const CHIN: Mass = [64, 80, 9, 7, 25];
const MUZZLE: Mass = [54, 63, 16, 14, 15];
const ellM = ([cx, cy, rx, ry, deg = 0]: Mass) => ell(cx, cy, rx, ry, deg);
const IN_MUZZLE = ellM(MUZZLE);
const HEAD_IN = any(
  ellM(CRANIUM),
  ellM(FACE),
  ellM(BRIDGE),
  ellM(CHEEK),
  ellM(CHIN),
  IN_MUZZLE,
  // the tuft on his poll
  tri([[96, 44], [99, 31], [106, 39], [110, 26], [116, 38], [122, 30], [126, 46]]),
);
const HEAD_PATCH = any(ell(98, 74, 19, 17, -15), ell(113, 58, 13, 11, 20));
const EYE: Pt = [96, 74];
const EYE_R: Pt = [11, 13];

function head(): Part {
  const cv = canvas(W, H);
  const skin = formLight([CRANIUM, FACE, BRIDGE, BROW, CHEEK, CHIN, MUZZLE], 0.04, 1.1);
  const nose = skin;
  paintIn(
    cv,
    HEAD_IN,
    (x, y) => (IN_MUZZLE(x, y) ? PINK : HEAD_PATCH(x, y) ? "abccd" : CREAM),
    (x, y) => (IN_MUZZLE(x, y) ? nose(x, y) : skin(x, y)),
  );
  rim(cv);
  // the heavy upper lid and lashes, swept back
  const [ex, ey] = EYE;
  for (let x = ex - 10; x <= ex + 11; x++) {
    const t = (x + 0.5 - ex) / 11.5;
    if (Math.abs(t) > 1) continue;
    const yy = ey - Math.sqrt(1 - t * t) * (EYE_R[1] + 1.2);
    put(cv, x, yy, "k");
    if (t > -0.5) put(cv, x, yy - 1, "k");
  }
  line(cv, ex + 6, ey - 12, ex + 10, ey - 17, "k");
  line(cv, ex + 9, ey - 10, ex + 15, ey - 14, "k");
  line(cv, ex + 11, ey - 6, ex + 17, ey - 8, "k");
  // a brow ridge above, catching light
  for (let x = ex - 8; x <= ex + 8; x++) put(cv, x, ey - 19 + Math.round(((x - ex) / 8) ** 2 * 3), "d");
  // the mouth: from under the muzzle's front, back along its lower edge, a small upturn at the end
  line(cv, 47, 74, 54, 78, "k");
  line(cv, 55, 79, 61, 81, "k");
  put(cv, 62, 81, "k");
  put(cv, 63, 80, "k");
  return { grid: toGrid(cv) };
}

/** The muzzle's details over the head: a nostril on its front and a soft shine (no outline, part of the face). */
function snout(): Part {
  const cv = canvas(W, H);
  // nostril: a comma on the front, curving back
  for (const [x, y] of [[44, 57], [45, 57], [43, 58], [44, 58], [45, 58], [43, 59], [44, 59], [44, 60], [45, 60], [46, 60]] as Pt[])
    put(cv, x + 1, y, "n");
  put(cv, 47, 59, "o");
  // shine, up toward the light
  for (const [x, y] of [[49, 52], [50, 52], [51, 52], [48, 53], [49, 53], [52, 51], [53, 51]] as Pt[]) put(cv, x, y, "s");
  put(cv, 49, 52, "w");
  put(cv, 50, 52, "w");
  return { grid: toGrid(cv), outline: false };
}

function horn(dx: number, dy: number, far: boolean): Part {
  const cv = canvas(W, H);
  const pts: Pt[] = [[120, 52], [122, 40], [128, 30], [138, 21], [146, 17], [148, 20], [143, 30], [141, 40], [141, 50]].map(
    ([x, y]) => [x + dx, y + dy] as Pt,
  );
  paintIn(cv, inPoly(pts), () => (far ? "Rh" : HORN), lightOf(132 + dx, 34 + dy, 14, 18, far ? -0.25 : 0.05));
  if (!far) {
    rim(cv, "L", 1);
    // ridges on the horn
    for (const y of [40, 33]) for (let x = 121; x < 146; x++) if (cv[y + dy]![x + dx] === "i") cv[y + dy]![x + dx] = "h";
  }
  return { grid: toGrid(cv) };
}

function ear(lift: number): Part {
  const cv = canvas(W, H);
  const bend = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x, y - Math.max(0, (x - 150) / 46) * lift] as Pt);
  const outer = bend([[138, 68], [148, 63], [160, 62], [172, 66], [182, 73], [190, 83], [196, 96], [199, 110], [198, 122], [194, 130], [187, 128], [178, 118], [166, 107], [152, 99], [141, 93]]);
  const inner = bend([[152, 84], [168, 86], [182, 97], [190, 112], [191, 124], [183, 118], [170, 104], [157, 96]]);
  paintIn(cv, inPoly(outer), () => BROWN, lightOf(160, 80, 40, 30, 0.08));
  paintIn(cv, inPoly(inner), () => PINK, lightOf(176, 100, 20, 12, -0.15));
  rim(cv, "L", 1);
  // a fold line down the ear
  const fold = bend([[146, 78], [178, 88]]);
  line(cv, Math.round(fold[0]![0]), Math.round(fold[0]![1]), Math.round(fold[1]![0]), Math.round(fold[1]![1]), "a");
  return { grid: toGrid(cv) };
}

/** Holstein patches: his browns, lit like the cream ("a" only at the darkest). */
const PATCH = "abbccd";

function body(): Part {
  const cv = canvas(W, H);
  const inB = inPoly([[82, 100], [140, 104], [176, 94], [200, 88], [200, 260], [26, 260], [30, 232], [42, 192], [58, 146], [72, 116]]);
  const patch = any(
    ell(172, 184, 17, 23, 20),
    ell(160, 204, 11, 9, -10),
    ell(186, 166, 9, 8),
    ell(198, 236, 10, 16),
    ell(150, 130, 8, 6, 25),
    ell(158, 128, 6, 7),
  );
  const light = formLight([[120, 160, 92, 110], [96, 136, 40, 48, 25]], -0.5, 1.45);
  // the head casts a soft shadow down the throat, just under the jaw
  const shadow = (x: number, y: number) => HEAD_IN(x + 3, y - 7) && !HEAD_IN(x, y);
  paintIn(cv, inB, (x, y) => (patch(x, y) ? PATCH : CREAM), (x, y) => light(x, y) - (shadow(x, y) ? 0.3 : 0));
  rim(cv, "L", 1);
  return { grid: toGrid(cv) };
}

/** His front leg, up from his chest across the Moon's belly, the hoof curled round her lower horn. */
const LEG_A: Pt = [128, 262];
const LEG_B: Pt = [42, 214];
function leg(): Part {
  const cv = canvas(W, H);
  const [ax, ay] = LEG_A;
  const [bx, by] = LEG_B;
  const len = Math.hypot(bx - ax, by - ay);
  const [dx, dy] = [(bx - ax) / len, (by - ay) / len];
  const [px, py] = [dy, -dx]; // across the leg, toward its top side
  const rad = (t: number) => 17 - 6 * t;
  const at = (x: number, y: number) => {
    const rx = x + 0.5 - ax;
    const ry = y + 0.5 - ay;
    const t = Math.max(0, Math.min(1, (rx * dx + ry * dy) / len));
    const s = (rx * px + ry * py) / rad(t);
    return { t, s, inside: Math.hypot(rx - t * len * dx, ry - t * len * dy) <= rad(t) };
  };
  const patch = any(ell(112, 250, 13, 12, 25));
  paintIn(
    cv,
    (x, y) => at(x, y).inside,
    (x, y) => (patch(x, y) ? PATCH : CREAM),
    (x, y) => {
      const { s } = at(x, y);
      const nz = Math.sqrt(Math.max(0, 1 - s * s));
      const l = s * (px * LD[0] + py * LD[1]) + nz * LD[2];
      return 0.3 + 0.6 * l;
    },
  );
  // the hoof: dark, two-toed, curled up round the Moon's horn tip
  const toes = any(ell(28, 203, 7, 10, 25), ell(37, 199, 7, 10, 35), ell(37, 211, 10, 8, 0));
  paintIn(cv, toes, () => "abcd", formLight([[33, 204, 12, 13, 30]], 0.05, 1.1));
  rim(cv, "L", 1);
  // the cleft between the toes
  line(cv, 32, 196, 33, 208, "k");
  return { grid: toGrid(cv) };
}

/** Moo's eye at a stage of whitening: 0 his warm brown, 4 pure glowing white. */
function mooEye(stage: number): Part {
  const cv = canvas(W, H);
  const [cx, cy] = EYE;
  const inEye = ell(cx, cy, EYE_R[0], EYE_R[1], -10);
  const fill = [-1, 0.38, 0.75, 2, 2][stage]!;
  for (let y = cy - 15; y <= cy + 15; y++)
    for (let x = cx - 13; x <= cx + 13; x++) {
      if (!inEye(x, y)) continue;
      const ix = x + 0.5 - (cx - 2);
      const iy = y + 0.5 - (cy - 1);
      let k: string;
      if (Math.hypot(ix, iy) > 10.5) k = "W";
      else {
        k = iy < -5 ? "f" : iy > 4.5 ? "g" : "e";
        if (Math.hypot(x + 0.5 - (cx - 3), y + 0.5 - (cy - 3)) < 5.5) k = "x";
      }
      const q = ((x + 0.5 - cx) * 0.6 + (y + 0.5 - cy) * 0.8) / 13;
      const front = -1 + 2 * fill;
      if (q < front - 0.18) k = "w";
      else if (q < front) k = "y";
      cv[y]![x] = k;
    }
  if (stage < 3) {
    // glints: a big one up front, a small one low
    for (const [x, y] of [[-7, -9], [-6, -9], [-8, -8], [-7, -8], [-6, -8], [-5, -8], [-7, -7], [-6, -7], [1, 3], [2, 4]] as Pt[])
      if (cv[cy + y]![cx + x] !== ".") cv[cy + y]![cx + x] = "w";
  }
  if (stage === 3) {
    // all white but a pale gold ring where the iris was
    for (let y = cy - 15; y <= cy + 15; y++)
      for (let x = cx - 13; x <= cx + 13; x++) {
        if (!inEye(x, y)) continue;
        const d = Math.hypot(x + 0.5 - (cx - 2), y + 0.5 - (cy - 1));
        cv[y]![x] = d > 8 && d < 10.5 ? "y" : "w";
      }
  }
  return { grid: toGrid(cv) };
}

/** A glow round an eye: bands of light past its outline and short rays. */
function glow(cx: number, cy: number, rx: number, ry: number, size: number, rays: number, keys: string): Part {
  const cv = canvas(W, H);
  paintIn(cv, ell(cx, cy, rx + size, ry + size), () => keys[0]!, () => 0);
  paintIn(cv, ell(cx, cy, rx + size * 0.55, ry + size * 0.55), () => keys[1]!, () => 0);
  paintIn(cv, ell(cx, cy, rx + size * 0.25, ry + size * 0.25), () => "L", () => 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.39;
    const r0 = Math.max(rx, ry) + size * 0.8;
    const r1 = r0 + rays * (i % 2 ? 0.55 : 1);
    line(cv, Math.round(cx + Math.cos(a) * r0), Math.round(cy + Math.sin(a) * r0), Math.round(cx + Math.cos(a) * r1), Math.round(cy + Math.sin(a) * r1), i % 2 ? keys[0]! : "L");
  }
  return { grid: toGrid(cv), outline: false };
}

// ---------------------------------------------------------------- the Moon

const C1 = { x: 66, y: 184, r: 44 };
const C2 = { x: 46, y: 162, r: 39 };
const onFace = (deg: number, depth: number): Pt => {
  const a = (deg * Math.PI) / 180;
  return [C2.x + (C2.r + depth) * Math.cos(a), C2.y + (C2.r + depth) * Math.sin(a)];
};
const MEYE = onFace(34, 6);

function moon(): Part {
  const cv = canvas(W, H);
  const inC1 = ell(C1.x, C1.y, C1.r, C1.r);
  const inC2 = ell(C2.x, C2.y, C2.r, C2.r);
  paintIn(cv, (x, y) => inC1(x, y) && !inC2(x, y), () => MOONR, (x, y) => {
    // brighter toward the hollow, which faces the light
    const d = Math.hypot(x + 0.5 - C2.x, y + 0.5 - C2.y) - C2.r;
    return 0.95 - d / 30 + (shaftAt(x, y) ? 0.08 : 0);
  });
  edge(cv, 1, 0, "*", "Q", 1);
  edge(cv, 0, 1, "*", "Q", 1);
  rim(cv, "L", 1);
  // cheek
  const [chx, chy] = onFace(54, 13);
  paintIn(cv, ell(chx, chy, 4.5, 3.2, 35), () => "v", () => 0);
  put(cv, chx - 2, chy - 1, "V");
  put(cv, chx - 1, chy - 1, "V");
  // a small smile
  const [mx, my] = onFace(64, 5);
  for (const [x, y] of [[-3, -2], [-2, -1], [-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0]] as Pt[]) put(cv, mx + x, my + y, "u");
  return { grid: toGrid(cv) };
}

/** The Moon's open eye, looking up, at a stage of whitening. */
function moonEye(stage: number): Part {
  const cv = canvas(W, H);
  const [cx, cy] = MEYE;
  const inE = ell(cx, cy, 4.2, 5.4, 30);
  const fill = [-1, 0.4, 0.8, 2, 2][stage]!;
  for (let y = Math.floor(cy) - 6; y <= cy + 6; y++)
    for (let x = Math.floor(cx) - 6; x <= cx + 6; x++) {
      if (!inE(x, y)) continue;
      const q = ((x + 0.5 - cx) * 0.6 + (y + 0.5 - cy) * 0.8) / 4.6;
      let k = q < -1 + 2 * fill ? "w" : "u";
      if (stage >= 3) k = "w";
      cv[y]![x] = k;
    }
  if (stage < 3) {
    put(cv, cx - 2, cy - 2, "w");
    put(cv, cx - 1, cy - 2, "w");
    put(cv, cx - 2, cy - 1, "w");
  }
  // a lash at the back, and an outline when it's white
  line(cv, Math.round(cx + 3), Math.round(cy - 3), Math.round(cx + 6), Math.round(cy - 5), "u");
  if (stage >= 3) {
    const src = cv.map((r) => [...r]);
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++)
        if (src[y]![x] === "." && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => src[y + dy]![x + dx] === "w")) cv[y]![x] = "u";
  }
  return { grid: toGrid(cv), outline: false };
}

// ---------------------------------------------------------------- grass

function grass(): Part {
  const cv = canvas(W, H);
  seed = 5;
  for (let bx = -4; bx < W + 4; bx += 3 + Math.floor(rnd() * 4)) {
    const h = 8 + Math.floor(rnd() * 18) + (bx < 40 || bx > 170 ? 6 : 0);
    const lean = Math.round((rnd() - 0.3) * 10);
    const tip: Pt = [bx + lean, H - h];
    poly(cv, [[bx - 3, H], [bx + 3, H], tip], "l");
    line(cv, bx - 2, H - 1, tip[0], tip[1], "m");
    const lit = shaftAt(tip[0], tip[1]);
    put(cv, tip[0], tip[1], lit ? "U" : "T");
    put(cv, tip[0] + (lean > 0 ? -1 : 1) * 0, tip[1] + 1, "T");
  }
  return { grid: toGrid(cv), outline: false };
}

// ---------------------------------------------------------------- the rig

const PARTS: Record<string, Part> = {
  sky: sky(),
  hornFar: horn(13, 5, true),
  body: body(),
  moon: moon(),
  leg: leg(),
  head: head(),
  ear0: ear(0),
  ear1: ear(4),
  snout: snout(),
  horn: horn(0, 0, false),
  grass: grass(),
  glowMoo3: glow(EYE[0], EYE[1], EYE_R[0], EYE_R[1], 4, 4, "ZY"),
  glowMoo4: glow(EYE[0], EYE[1], EYE_R[0], EYE_R[1], 9, 9, "ZY"),
  glowMoon3: glow(MEYE[0], MEYE[1], 4.2, 5.4, 3, 3, "YL"),
  glowMoon4: glow(MEYE[0], MEYE[1], 4.2, 5.4, 6, 6, "YL"),
};
for (let s = 0; s < 5; s++) {
  PARTS[`eye${s}`] = mooEye(s);
  PARTS[`moonEye${s}`] = moonEye(s);
}

/** Sparkles riding the shafts: [shaft, start along it, phase]. */
const SPARKS: readonly (readonly [number, number, number])[] = [
  [0, 150, 0],
  [0, 205, 2],
  [1, 120, 1],
  [1, 190, 3],
  [2, 40, 2],
  [2, 210, 0],
  [3, 60, 1],
  [3, 150, 3],
  [4, 70, 0],
  [4, 135, 2],
  [5, 110, 1],
  [2, 95, 3],
];
/** More that join while the eyes whiten. */
const EXTRA: readonly (readonly [number, number, number])[] = [
  [0, 105, 1],
  [1, 160, 0],
  [2, 160, 1],
  [3, 105, 2],
  [4, 100, 3],
  [5, 150, 0],
  [2, 260, 2],
  [0, 250, 3],
];

function sparkles(list: readonly (readonly [number, number, number])[], f: number, big: boolean): Speck[] {
  const out: Speck[] = [];
  for (const [si, t0, ph] of list) {
    const life = (f + ph) % 4;
    const c = SHAFTS[si]![0];
    const t = t0 + life * 6;
    const x = Math.round(c * 0.8 + t * 0.6);
    const y = Math.round(-c * 0.6 + t * 0.8);
    const add = (dx: number, dy: number, k: string) => out.push([x + dx, y + dy, k]);
    if (life === 0) {
      add(0, 0, "L");
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(dx!, dy!, "Z");
    } else if (life === 1) {
      add(0, 0, "w");
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(dx!, dy!, "L");
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) add(dx!, dy!, "Y");
      for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) add(dx!, dy!, "Z");
    } else if (life === 2) {
      add(0, 0, "w");
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(dx!, dy!, "L");
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) add(dx!, dy!, "Y");
      if (big) for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) add(dx!, dy!, "Z");
    } else add(0, 0, "L");
  }
  return out;
}

interface Pose {
  ear: 0 | 1;
  eye: number;
  /** Specks' clock and how many sparkle sets. */
  tick: number;
  extra: boolean;
  pal: Record<string, string>;
}

function frame(p: Pose, ms: number): Frame {
  const layers: Layer[] = [
    { part: "sky", x: 0, y: 0 },
    { part: "hornFar", x: 0, y: 0 },
    { part: "body", x: 0, y: 0 },
    { part: "moon", x: 0, y: 0 },
  ];
  if (p.eye >= 3) layers.push({ part: `glowMoon${p.eye}`, x: 0, y: 0 });
  layers.push(
    { part: `moonEye${p.eye}`, x: 0, y: 0 },
    { part: "leg", x: 0, y: 0 },
    { part: "head", x: 0, y: 0 },
    { part: `ear${p.ear}`, x: 0, y: 0 },
    { part: "snout", x: 0, y: 0 },
    { part: "horn", x: 0, y: 0 },
  );
  if (p.eye >= 3) layers.push({ part: `glowMoo${p.eye}`, x: 0, y: 0 });
  layers.push({ part: `eye${p.eye}`, x: 0, y: 0 }, { part: "grass", x: 0, y: 0 });
  const specks = [...sparkles(SPARKS, p.tick, p.extra), ...(p.extra ? sparkles(EXTRA, p.tick, true) : [])];
  return { layers, ms, pal: p.pal, specks };
}

const IDLE_PAL: Record<string, string>[] = [
  {},
  { "5": "#303d80", "6": "#4859a2", "7": "#6e80c0", L: "#ffffff" },
  { "8": "#c8d0ff", "6": "#405094" },
  { "5": "#2a3574", "6": "#364484", "7": "#4f5fa0" },
];
const WHITEN_PAL: Record<string, string>[] = [
  {},
  { "5": "#33408a", "6": "#4a5ba4", "7": "#6a7cc0" },
  { "5": "#3a4a96", "6": "#566ab4", "7": "#8094d2", L: "#ffffff" },
  { "5": "#44559f", "6": "#6378c0", "7": "#98aae0", L: "#ffffff" },
  { "5": "#4d60a8", "6": "#7488cc", "7": "#b2c2ec", L: "#ffffff", "4": "#28337a" },
];

export const ARENA_MOO_CLOSEUP: Character = {
  id: "arena-moo-closeup",
  name: "Moo and Moon close-up",
  w: W,
  h: H,
  foot: [100, 255],
  palette: PALETTE,
  parts: PARTS,
  anims: {
    idle: {
      loop: true,
      frames: [0, 1, 2, 3].map((f) => frame({ ear: f === 2 ? 1 : 0, eye: 0, tick: f, extra: false, pal: IDLE_PAL[f]! }, 300)),
    },
    whiten: {
      loop: false,
      frames: [0, 1, 2, 3, 4].map((s) =>
        frame({ ear: 0, eye: s, tick: s, extra: s > 0, pal: s === 0 ? IDLE_PAL[0]! : WHITEN_PAL[s]! }, s === 4 ? 400 : 220),
      ),
    },
  },
};
