/**
 * Birdie (variant A, closer to the photo): a young mourning dove, Eric's own bird, riding a miniature toy diesel
 * locomotive. A real dove's proportions (small round head, plump body, long tapered tail), soft grey-brown plumage
 * with dark-centered, pale-edged scalloped wing feathers, a big dark eye in a pale ring, a small dark beak and coral
 * feet; a navy conductor's cap with a gold band, tipped back a little, and a small burgundy tie. The locomotive is
 * yellow with a dark roof, a thin red stripe, round headlights at its rounded nose and silver trucks, nose to our left,
 * an open hatch in its roof where he perches. Facing our left (toward the board), light from the top left.
 *
 * Rigging: the train is two parts (the hatch's dark inside behind him, the body in front of him), so he can sink into
 * it; his tail, body, head (with its eye open, half or shut, and mirrored to look the other way), cap, tie and feet
 * are parts of their own, placed by `pose()` from a few numbers.
 */
import { canvas, inPoly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1e1511", // outline
  a: "#3a2c25", // plumage: grey-brown, dark to light
  b: "#584638",
  c: "#78614f",
  d: "#977e67",
  e: "#b9a086",
  f: "#9a7a69", // his chest and face: a soft pinkish buff, shade to light
  g: "#bd9d89",
  h: "#d8bea7",
  x: "#120c0a", // his eye, the dark spots on his wing
  w: "#ffffff", // glints
  R: "#c9d3d8", // the pale ring round his eye
  j: "#2e2829", // beak
  J: "#4d4446",
  p: "#e27a6e", // feet: coral, shade, light
  P: "#b0534d",
  q: "#f6a394",
  "1": "#121831", // the cap: navy, dark to light
  "2": "#1f2c55",
  "3": "#30437a",
  "4": "#4b63a3",
  L: "#f2c14e", // gold band: mid, light, dark
  M: "#ffe58a",
  N: "#b4840f",
  r: "#6e1222", // tie: burgundy, dark to light
  s: "#a3203a",
  t: "#d24a5e",
  A: "#9a650c", // the locomotive's yellow: shade to highlight
  B: "#d0921a",
  C: "#f2b81c",
  D: "#ffd447",
  E: "#fff09a",
  G: "#1b1d22", // its roof and underframe: dark to light
  H: "#2f323a",
  I: "#4a4e59",
  S: "#c0242c", // its red stripe
  m: "#555a64", // silver: dark to light
  n: "#868c97",
  o: "#bfc4cc",
  O: "#eef0f3",
  u: "#1c2838", // windows: dark, mid, glint
  v: "#3d6584",
  V: "#9cc2da",
  l: "#fff6c8", // headlight
  z: "#0d0e12", // ground shadow
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;

const W = 100;
const H = 96;
const GROUND = 92;

const E = (cx: number, cy: number, rx: number, ry: number): Inside => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const light = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) =>
  0.5 + bias - 0.42 * ((x + 0.5 - cx) / rx) - 0.5 * ((y + 0.5 - cy) / ry);

/** A part painted in scene coordinates over the box (x0, y0, w, h). */
function painted(
  x0: number,
  y0: number,
  w: number,
  h: number,
  draw: (F: (inside: Inside, key: Key) => void, P: (x: number, y: number, k: string) => void, cv: Canvas) => void,
  outline = true,
): { part: Part; at: Pt } {
  const cv = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const P = (x: number, y: number, k: string) => {
    const X = Math.round(x) - x0;
    const Y = Math.round(y) - y0;
    if (Y >= 0 && Y < h && X >= 0 && X < w) cv[Y]![X] = k;
  };
  draw(F, P, cv);
  return { part: { grid: toGrid(cv), outline }, at: [x0, y0] };
}

const PARTS: Record<string, Part> = {};
const AT: Record<string, Pt> = {};
function reg(name: string, m: { part: Part; at: Pt }) {
  PARTS[name] = m.part;
  AT[name] = m.at;
}

// ---- The locomotive: a toy F-unit diesel, as long as he is.

const HATCH0 = 41; // the hatch in its roof, x from..to
const HATCH1 = 64;
const RIM = 59; // the top row of its near wall at the hatch
const TOP = 56; // its roof's top row

reg("shadow", painted(10, GROUND - 2, 82, 3, (F) => F(E(50, GROUND - 0.5, 39, 1.6), () => "z"), false));

reg(
  "trucks",
  painted(16, 79, 68, 13, (F, P) => {
    for (const cx of [24, 34, 64, 74]) {
      F(E(cx, 87.5, 4.3, 4.3), (x, y) => {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 87.5);
        if (d < 1.3) return "o";
        if (d > 3.3) return "m";
        return x + y < cx + 87 ? "n" : "m";
      });
    }
    // Side frames over the wheels' tops, with axle boxes and a spring between.
    for (const x0 of [18, 58]) {
      F((x, y) => x >= x0 && x <= x0 + 21 && y >= 82 && y <= 85, (x, y) => (y === 82 ? "O" : y === 85 ? "m" : "o"));
      for (const bx of [x0 + 5, x0 + 15]) {
        P(bx, 84, "n");
        P(bx + 1, 84, "n");
        P(bx, 85, "m");
        P(bx + 1, 85, "m");
      }
      P(x0 + 10, 83, "n");
      P(x0 + 11, 83, "n");
      P(x0 + 10, 84, "m");
      P(x0 + 11, 84, "m");
    }
    // The fuel tank between them.
    F((x, y) => x >= 41 && x <= 56 && y >= 80 && y <= 86 && !((x === 41 || x === 56) && y === 86), (x, y) => (y === 81 ? "I" : y >= 85 ? "G" : "H"));
  }),
);

reg(
  "trainBack",
  painted(HATCH0 - 1, TOP - 1, HATCH1 - HATCH0 + 3, RIM - TOP + 2, (F) => {
    F((x, y) => x >= HATCH0 - 1 && x <= HATCH1 + 1 && y >= TOP && y <= RIM, (x, y) => (y === TOP ? "I" : "G"));
  }),
);

const OUTLINE_PTS: Pt[] = [
  [29, TOP - 0.5],
  [84.5, TOP - 0.5],
  [84.5, 81.5],
  [19, 81.5],
  [15.5, 79.5],
  [13, 75],
  [12.3, 69],
  [13.3, 64],
  [16, 60],
  [20, 57],
  [24, 55.8],
];
reg(
  "trainBody",
  painted(10, TOP - 2, 77, 28, (F, P) => {
    const inBody = inPoly(OUTLINE_PTS);
    const body: Inside = (x, y) => inBody(x, y) && !(x >= HATCH0 && x <= HATCH1 && y < RIM);
    // Yellow, lit from the top left: bright up top, shading down to the skirt; the rounded nose lighter at its brow.
    F(body, (x, y) => {
      let l = 0.98 - (y - TOP) / 26;
      if (x < 22) l += 0.1 - (y > 72 ? 0.25 : 0);
      if (x > 82) l -= 0.15;
      return ramp("ABCD", l);
    });
    // Highlights along every top edge, and the nose's rounded front.
    F((x, y) => body(x, y) && (!body(x, y - 1) || (!body(x - 1, y) && y < 72)), () => "E");
    // The windshield, high on the nose, and a side window behind it.
    F((x, y) => body(x, y) && body(x - 1, y - 1) && body(x, y - 1) && !body(x - 4, y - 3) && x >= 14 && y <= 62 && x <= 26, (x, y) => ((x + y) % 7 === 0 ? "v" : "u"));
    P(17, 61, "V");
    P(18, 60, "V");
    for (let y = 59; y <= 62; y++) for (let x = 27; x <= 31; x++) P(x, y, y === 59 || x === 27 ? "u" : "v");
    P(30, 60, "V");
    // The roof: dark, either side of the hatch, from behind the cab to the back.
    F((x, y) => body(x, y) && y < TOP + 3 && x >= 33, (x, y) => (y === TOP ? "I" : y === TOP + 1 ? "H" : "G"));
    for (const fx of [36, 69, 74, 79]) {
      P(fx, TOP, "n");
      P(fx + 1, TOP, "n");
    }
    // The hatch's rim: a silver lip at its ends and along its top.
    for (let y = TOP; y <= RIM + 1; y++) {
      P(HATCH0 - 1, y, y === TOP ? "O" : "n");
      P(HATCH1 + 1, y, y === TOP ? "O" : "n");
    }
    for (let x = HATCH0; x <= HATCH1; x++) P(x, RIM, x < 52 ? "O" : "o");
    // The red stripe along the side, sweeping down at the nose.
    for (let x = 18; x <= 84; x++) P(x, 73, "S");
    for (const [x, y] of [[17, 74], [16, 75], [15, 76]] as Pt[]) P(x, y, "S");
    // Round portholes.
    for (const [cx, cy] of [[35, 65], [75, 65]] as Pt[]) {
      for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]] as Pt[]) P(cx + dx, cy + dy, "u");
      P(cx - 1, cy - 1, "A");
      P(cx + 1, cy + 1, "E");
      P(cx - 1, cy + 1, "B");
      P(cx + 1, cy - 1, "B");
      P(cx, cy, "v");
      P(cx - 1, cy, "V");
    }
    // Panel seams.
    for (const sx of [39, 66, 82]) for (let y = 61; y <= 79; y++) if (y !== 73) P(sx, y, "B");
    // Headlights on the nose, stacked: round, with a silver rim.
    for (const cy of [66, 70]) {
      P(13, cy, "n");
      P(14, cy - 1, "o");
      P(14, cy, "l");
      P(15, cy, "l");
      P(14, cy + 1, "n");
      P(15, cy - 1, "O");
      P(15, cy + 1, "n");
      P(16, cy, "n");
    }
    // The skirt and the pilot under the nose.
    F((x, y) => body(x, y) && y >= 80, (x, y) => (y === 80 ? "H" : "G"));
    F((x, y) => x >= 16 && x <= 20 && y >= 79 && y <= 81, (x, y) => (y === 79 ? "o" : "n"));
  }),
);

// ---- Birdie.

const BODY_C: Pt = [54, 42];
/** One wing feather's tile (7 x 5, offset half a tile row to row): its lit face (T, M), the pale fringe round its end (E), its shadow on the feather below (D). */
const SCALE = ["MTTTTTM", "ETTTTTE", "DEMMMED", "MDEEEDM", "MMDDDMM"];
/** His body as he stands: plump, the buff chest forward; the wing over it with scalloped feathers. */
function bodyPart(breath: number) {
  const [cx, cy] = BODY_C;
  return painted(34, 26, 44, 32, (F, P) => {
    const chest = E(44.5 - breath * 0.5, 42.5, 8.6 + breath * 0.6, 10.5 + breath * 0.3);
    const main = E(cx, cy, 16.5, 13.4);
    const neck = E(43, 33, 6, 6.5);
    const inside: Inside = (x, y) => main(x, y) || chest(x, y) || neck(x, y);
    const L = light(cx - 4, cy - 3, 19, 16);
    F(inside, (x, y) => {
      const l = L(x, y);
      if (x < 51 && y > 32) return ramp("ffgh", l + 0.02);
      return ramp("bcde", l - 0.05);
    });
    // The belly's shade underneath, and his back's highlight.
    F((x, y) => inside(x, y) && !inside(x, y + 2), (x) => (x < 51 ? "f" : "b"));
    F((x, y) => inside(x, y) && !inside(x, y - 1) && x < 64, () => "e");
    // The wing: from the shoulder back to the tips, over the tail's root.
    const wingPts: Pt[] = [
      [47, 32],
      [55, 29],
      [63, 30],
      [71, 35],
      [79, 41],
      [87, 48.5],
      [80, 50.5],
      [70, 52.5],
      [60, 52.5],
      [52.5, 48.5],
      [48.5, 41],
    ];
    const wing = inPoly(wingPts);
    const lw = light(58, 36, 18, 14);
    // The coverts: scallops, overlapping rounded feathers in offset rows (SCALE), a few with a dove's black spot.
    F(wing, (x, y) => {
      const l = lw(x, y);
      // Long flight feathers at the back: dark, with pale edges running back and down.
      if (x - (y - 34) * 1.1 > 66) {
        const s = (((x - y * 1.4) % 6) + 6) % 6;
        return s === 0 ? (l > 0.3 ? "d" : "c") : l > 0.4 ? "b" : "a";
      }
      const row = Math.floor((y - 29) / 5);
      const u = (((x - 46 + (row % 2) * 3) % 7) + 7) % 7;
      const v = (((y - 29) % 5) + 5) % 5;
      const col = Math.floor((x - 46 + (row % 2) * 3) / 7);
      const t = SCALE[v]![u]!;
      if (t === "T" && (col * 5 + row * 3) % 7 === 2 && v >= 1 && u >= 2 && u <= 4) return "x";
      if (t === "T") return l > 0.5 ? "d" : "c";
      if (t === "M") return l > 0.55 ? "c" : "b";
      if (t === "E") return l > 0.42 ? "e" : "d";
      return "a";
    });
    // The wing's front edge, a soft dark line.
    F((x, y) => wing(x, y) && !wing(x - 1, y) && y > 33, () => "a");
  });
}
reg("body0", bodyPart(0));
reg("body1", bodyPart(1));

/** The long tapered tail, from under his wing back over the roof and past the train's end. */
function tailPart() {
  const a: Pt = [66, 41];
  const b: Pt = [96, 50];
  return painted(62, 34, 36, 20, (F) => {
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const len = Math.hypot(vx, vy);
    const at = (x: number, y: number) => {
      const px = x + 0.5 - a[0];
      const py = y + 0.5 - a[1];
      return { t: (px * vx + py * vy) / (len * len), d: (px * -vy + py * vx) / len };
    };
    F(
      (x, y) => {
        const { t, d } = at(x, y);
        if (t < 0 || t > 1) return false;
        const r = 4.8 * (1 - t) + 1.4 * t - (t > 0.88 ? (t - 0.88) * 8 : 0);
        return Math.abs(d) <= r;
      },
      (x, y) => {
        const { t, d } = at(x, y);
        if (t > 0.88) return d > 0 ? "h" : "e";
        if (t > 0.76) return d > 0.5 ? "x" : "a";
        if (d < -1.8) return "d";
        if (d < 0.5) return "c";
        return "b";
      },
    );
  });
}
reg("tail", tailPart());

/** His head, facing our left: small, smooth and round, the big eye in its pale ring, the slim dark beak. */
type Eye = "open" | "half" | "shut";
const HEAD_W = 23;
const HEAD_CX = 12; // the head's center in its own box
const HEAD_CY = 10;
function headPart(eye: Eye) {
  return painted(0, 0, HEAD_W, 20, (F, P) => {
    const cx = HEAD_CX;
    const cy = HEAD_CY;
    const inside = E(cx, cy, 9, 8.8);
    const L = light(cx, cy, 10, 10);
    F(inside, (x, y) => {
      const l = L(x, y);
      // The face and throat a paler buff, the crown and nape grey-brown.
      if (x + (cy - y) * 0.3 < cx + 1 && y > cy - 2) return ramp("fgh", l + 0.15);
      return ramp("bcde", l + 0.08);
    });
    F((x, y) => inside(x, y) && !inside(x, y - 1) && x < cx + 4, () => "e");
    // A mourning dove's small dark cheek mark.
    P(cx + 1, cy + 4, "b");
    P(cx + 2, cy + 4, "b");
    P(cx + 2, cy + 3, "c");
    // The pale ring and the big eye.
    const ex = cx - 3;
    const ey = cy - 1;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3) P(ex + dx, ey + dy, "R");
    if (eye === "open") {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) P(ex + dx, ey + dy, "x");
      P(ex - 1, ey - 1, "w");
      P(ex, ey - 1, "w");
      P(ex + 1, ey + 1, "J");
    } else if (eye === "half") {
      for (let dx = -2; dx <= 2; dx++) P(ex + dx, ey - 1, Math.abs(dx) === 2 ? "a" : "b");
      for (let dx = -1; dx <= 1; dx++) {
        P(ex + dx, ey, "x");
        P(ex + dx, ey + 1, "x");
      }
      P(ex - 1, ey, "w");
    } else {
      for (let dx = -1; dx <= 1; dx++) {
        P(ex + dx, ey - 1, "e");
        P(ex + dx, ey, "d");
      }
      for (const [dx, dy] of [[-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0]] as Pt[]) P(ex + dx, ey + dy, "a");
    }
    // The beak: slim and dark, a pale cere at its root.
    for (const [x, y, k] of [[0, cy + 1, "j"], [1, cy + 1, "j"], [2, cy + 1, "j"], [3, cy + 1, "J"], [1, cy + 2, "j"], [2, cy + 2, "j"], [3, cy + 2, "j"], [3, cy, "R"], [2, cy, "J"]] as [number, number, string][]) P(x, y, k);
  });
}
reg("headOpen", headPart("open"));
reg("headHalf", headPart("half"));
reg("headShut", headPart("shut"));

// The conductor's cap: a short round crown, a gold band, a small stiff visor at the front (our left), tipped back a little.
PARTS.hat = {
  grid: [
    ".....22222222..",
    "....2334444432.",
    "...2344444332..",
    "...2333333332..",
    "...NLMLLLLLLN..",
    "...1222222221..",
    ".233442........",
    "1111111........",
  ],
};
AT.hat = [0, 0];
const HAT_W = 15;

// The tie: a neat knot at his throat and a short blade down his chest.
PARTS.tie = {
  grid: [
    "rsst",
    ".rs.",
    ".rst",
    "rsst",
    "rsst",
    ".rs.",
  ],
};
AT.tie = [0, 0];

// His feet on the hatch's rim, toes over its edge: the far one darker, behind the near one.
PARTS.feet = {
  grid: [
    ".....P......p..",
    ".....P......p..",
    "....PP.....pp..",
    ".PPPPP..qpppp..",
    ".P......p......",
  ],
};
AT.feet = [44, RIM - 4];

// ---- The pose.

interface Pose {
  /** How far he has sunk into the cab (0: perched on the rim). */
  dy?: number;
  /** Breathing: the chest swells. */
  breath?: 0 | 1;
  eye?: Eye;
  /** Looking the other way (our right): the head mirrored. */
  back?: boolean;
  /** The head moved from its place (a dove's bob, a peek). */
  hx?: number;
  hy?: number;
  /** The cap's own bounce. */
  hatY?: number;
}

const HEAD_X = 37 - HEAD_CX; // the head's box, standing
const HEAD_Y = 23 - HEAD_CY;

function pose(p: Pose = {}): Layer[] {
  const dy = p.dy ?? 0;
  const bodyDy = dy > 0 ? Math.min(24, Math.round(dy * 1.25)) : dy;
  const L = (part: string, x: number, y: number): Layer => ({ part, x: AT[part]![0] + x, y: AT[part]![1] + y });
  const layers: Layer[] = [L("shadow", 0, 0), L("trucks", 0, 0), L("trainBack", 0, 0)];
  if (dy < 10) layers.push(L("tail", 0, bodyDy));
  // Deep in the cab his body is out of sight (and would show under the train).
  if (dy < 24) layers.push(L(p.breath ? "body1" : "body0", 0, bodyDy));
  // Sinking, he draws his head back over the middle of the hatch.
  const hx = HEAD_X + (p.hx ?? 0) + Math.round(Math.min(1, Math.max(0, dy) / CROUCH) * 12);
  // Breathing in, his chest swells and his head rises a pixel.
  const hy = HEAD_Y + dy + (p.hy ?? 0) - (p.breath && dy <= 0 ? 1 : 0);
  const head = p.eye === "half" ? "headHalf" : p.eye === "shut" ? "headShut" : "headOpen";
  const back = !!p.back;
  // Mirrored, a part's box flips about its own middle: shift it so the head's round stays in place.
  const shift = 2 * HEAD_CX - (HEAD_W - 1);
  layers.push({ part: head, x: back ? hx + shift : hx, y: hy, ...(back ? { flipX: true } : {}) });
  layers.push(L("tie", hx + 10, hy + 18));
  // The cap sits on the crown of his head, a little back.
  const hatOff = 5;
  const hatX = back ? hx + 2 * HEAD_CX - hatOff - HAT_W + 1 : hx + hatOff;
  layers.push({ part: "hat", x: hatX, y: hy - 6 + (p.hatY ?? 0), ...(back ? { flipX: true } : {}) });
  layers.push(L("trainBody", 0, 0));
  if (dy <= 2) layers.push(L("feet", 0, 0));
  return layers;
}

const f = (ms: number, p: Pose = {}): Frame => ({ ms, layers: pose(p) });

/**
 * Idle, about 6 s: perched, breathing; a dove's head bob; a blink; then he ducks down into the cab until only his
 * head shows over the rim, peeks left, then right, then left again, and pops back up to perch (his cap bouncing).
 */
const CROUCH = 28;
const idle: Anim = {
  loop: true,
  frames: [
    f(400, {}),
    f(400, { breath: 1 }),
    f(300, {}),
    f(160, { hx: -1 }),
    f(160, { hx: -2, hy: 1 }),
    f(220, { hx: 0 }),
    f(350, { breath: 1 }),
    f(80, { eye: "half" }),
    f(110, { eye: "shut" }),
    f(80, { eye: "half" }),
    f(400, {}),
    // Ducking down into the cab.
    f(90, { dy: 1, hy: 1 }),
    f(90, { dy: 9 }),
    f(90, { dy: 20 }),
    f(110, { dy: CROUCH + 1 }),
    f(160, { dy: CROUCH }),
    // Peeking: left, right, left.
    f(400, { dy: CROUCH, hx: -2 }),
    f(120, { dy: CROUCH, hx: -1, eye: "half" }),
    f(450, { dy: CROUCH, hx: 1, back: true }),
    f(300, { dy: CROUCH, hx: 2, back: true, hy: -1 }),
    f(120, { dy: CROUCH, hx: 0, eye: "half" }),
    f(350, { dy: CROUCH, hx: -1 }),
    // Popping back up.
    f(80, { dy: 16 }),
    f(80, { dy: 4 }),
    f(100, { dy: 0, hatY: -2 }),
    f(140, { dy: 0, hatY: -1, breath: 1 }),
    f(300, { breath: 1 }),
    f(300, {}),
  ],
};

export const BIRDIE: Character = {
  id: "boss-birdie-a",
  name: "Birdie",
  w: W,
  h: H,
  foot: [50, GROUND],
  palette: PALETTE,
  halo: "#2a2521",
  parts: PARTS,
  anims: { idle },
};
