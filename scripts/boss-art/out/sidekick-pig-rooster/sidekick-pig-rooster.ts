/**
 * Wrangler's rooster (id "sidekick-pig-rooster"), who keeps the shop in Wrangler's barn (out/house-shop-pig): a proud,
 * scruffy barn rooster. A russet body, a shaggy gold hackle down his neck (a few feathers sticking out every which way),
 * a big red comb and wattles, a yellow beak, a tall arc of dark green-black sickle feathers for a tail with a green sheen,
 * yellow legs with spurs, and a tiny red bandana knotted round his neck (Wrangler's red, cream dots). Chest out. About the
 * size of the other kids. Three-quarters, facing our right, light from the top left. Drawn by hand (Nov 4).
 *
 * Rigging: every part is painted from a pose (a handful of numbers: the body's bob, the head's offset, each foot's place,
 * the tail's swing, the wing's lift, the beak, the eye), each part its own outlined layer, back to front; parts are made
 * once per pose and shared between frames. Wrangler's piglet (`sidekick-wrangler`) stays as he is and keeps walking the
 * town.
 */
import { canvas, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1d1210", // outline
  a: "#4f1a10", // his russet body: deep, dark, mid, light
  b: "#7e2a15",
  c: "#ad4a1d",
  d: "#d3702c",
  e: "#b86c16", // the hackle's gold: shade, mid, light
  f: "#e39b2e",
  g: "#ffcf63",
  t: "#121c19", // the tail: black-green, dark green, the green sheen
  u: "#1f3a33",
  v: "#3d7a66",
  n: "#2c0f09", // the wing's dark bar, his flight feathers' edges
  r: "#9c1418", // comb and wattles: dark, mid, light
  R: "#dc3128",
  q: "#ff6f5c",
  y: "#c58a14", // beak and legs: shade, mid, light
  Y: "#f0bc36",
  L: "#ffe38a",
  o: "#ff9a1f", // the eye: iris, pupil, a glint
  x: "#120a08",
  w: "#ffffff",
  W: "#efe9dd", // his ear lobe
  s: "#b8322a", // the bandana: mid, dark, its dots
  S: "#7e1d19",
  K: "#f7e4b8",
  z: "#0d0e12", // ground shadow
};

type Pt = readonly [number, number];
const W = 64;
const H = 64;
const GROUND = 61;

const PARTS: Record<string, Part> = {};
const AT = new Map<string, Pt>();
/** A part painted on a frame-sized canvas, cropped, made once by name. */
function painted(name: string, paint: (cv: Canvas) => void, outline = true): { name: string; at: Pt } {
  let at = AT.get(name);
  if (!at) {
    const cv = canvas(W, H);
    paint(cv);
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1;
    let y1 = -1;
    cv.forEach((row, y) =>
      row.forEach((k, x) => {
        if (k === ".") return;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }),
    );
    if (x1 < 0) {
      PARTS[name] = { grid: ["."], outline: false };
      at = [0, 0];
    } else {
      PARTS[name] = { grid: toGrid(cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1))), outline };
      at = [x0, y0];
    }
    AT.set(name, at);
  }
  return { name, at };
}
const put = (cv: Canvas, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (cv[y]?.[x] !== undefined) cv[y]![x] = k;
};
function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) => [...row].forEach((k, i) => k !== "." && put(cv, x0 + i, y0 + y, k)));
}
const hash = (x: number, y: number, s: number) => (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s, 83492791)) >>> 0) % 10007) / 10007;
/** Fills pixels inside `inside` (pixel centers) with key(x, y). */
function area(cv: Canvas, inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string, box: [number, number, number, number] = [0, 0, W, H]) {
  for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) if (inside(x + 0.5, y + 0.5)) put(cv, x, y, key(x, y));
}
const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0) => (x: number, y: number) => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const X = (x - cx) * c + (y - cy) * s;
  const Y = -(x - cx) * s + (y - cy) * c;
  return (X / rx) ** 2 + (Y / ry) ** 2 <= 1;
};
function inPoly(pts: readonly Pt[]) {
  return (x: number, y: number) => {
    let r = false;
    pts.forEach(([ax, ay], i) => {
      const [bx, by] = pts[(i + 1) % pts.length]!;
      if (ay <= y !== by <= y && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) r = !r;
    });
    return r;
  };
}
/** A thick stroke along points, `r0` wide at the start to `r1` at the end, keyed by (along 0..1, across -1..1). */
function stroke(cv: Canvas, pts: readonly Pt[], r0: number, r1: number, key: (t: number, s: number, x: number, y: number) => string | null) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let best = { d: Infinity, t: 0, s: 0 };
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1]!;
        const [bx, by] = pts[i]!;
        const vx = bx - ax;
        const vy = by - ay;
        const len = Math.hypot(vx, vy) || 1;
        const u = Math.max(0, Math.min(1, ((x + 0.5 - ax) * vx + (y + 0.5 - ay) * vy) / (len * len)));
        const px = x + 0.5 - (ax + u * vx);
        const py = y + 0.5 - (ay + u * vy);
        const d = Math.hypot(px, py);
        const t = (acc + u * len) / total;
        const r = r0 + (r1 - r0) * t;
        if (d / r < best.d) best = { d: d / r, t, s: (px * -vy + py * vx) / len / r };
        acc += len;
      }
      if (best.d > 1) continue;
      const k = key(best.t, best.s, x, y);
      if (k) put(cv, x, y, k);
    }
}
/** A quadratic curve's points. */
const curve = (a: Pt, b: Pt, c: Pt, n = 10): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]] as Pt;
  });
const rotAbout = ([x, y]: Pt, [cx, cy]: Pt, a: number): Pt => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];

// ---- The pose.

type Mood = "proud" | "blink" | "crow" | "look";
interface Pose {
  /** The body (and all above the legs) down this many px (a bob, a crouch). */
  by: number;
  /** The head and neck's offset (a strut's pump, a look). */
  hx: number;
  hy: number;
  /** Each foot on the ground (x), and lifted (px). */
  near: number;
  far: number;
  nearUp: number;
  farUp: number;
  /** The tail's swing (radians, + leans it back). */
  tail: number;
  /** The near wing: 0 folded, 1 to 3 raised (a wave's flap). */
  wing: number;
  mood: Mood;
  /** Sitting: the legs folded under, the body down on its belly. */
  sit?: boolean;
}
const STAND: Pose = { by: 0, hx: 0, hy: 0, near: 33, far: 27, nearUp: 0, farUp: 0, tail: 0, wing: 0, mood: "proud" };
const key = (p: Pose) => JSON.stringify(p);

const BODY: Pt = [29, 43];
const RUMP: Pt = [19, 39];

function layers(p: Pose): Layer[] {
  const by = p.by + (p.sit ? 7 : 0);
  const hx = p.hx;
  const hy = p.hy + by;
  const out: Layer[] = [];
  const L = (q: { name: string; at: Pt }) => out.push({ part: q.name, x: q.at[0], y: q.at[1] });
  const id = key(p);

  // The ground shadow.
  L(painted(`shadow:${p.sit ? 1 : 0}`, (cv) => area(cv, ell(30, GROUND, p.sit ? 14 : 12, 1.8), () => "z"), false));
  // The tail: three sickle feathers arcing up and back, two short coverts; a sheen on each feather's top edge.
  L(
    painted(`tail:${p.tail}:${by}`, (cv) => {
      const R: Pt = [RUMP[0], RUMP[1] + by];
      const feathers: [Pt, Pt, Pt, number][] = [
        [[RUMP[0] + 1, RUMP[1]], [10, 4], [3, 27], 2.7],
        [[RUMP[0], RUMP[1] + 2], [4, 12], [2, 36], 2.5],
        [[RUMP[0] + 2, RUMP[1] - 1], [17, 6], [10, 15], 2.2],
        [[RUMP[0], RUMP[1] + 3], [9, 34], [5, 44], 2.2],
      ];
      feathers.forEach(([a, b, c, r], i) => {
        const pts = curve([a[0], a[1] + by], rotAbout([b[0], b[1] + by], R, -p.tail * (0.6 + i * 0.1)), rotAbout([c[0], c[1] + by], R, -p.tail * (1 + i * 0.15)));
        stroke(cv, pts, r + 0.6, 0.9, (t, s) => (s < -0.35 && t > 0.15 ? "v" : s > 0.45 ? "t" : t > 0.85 ? "t" : "u"));
      });
    }),
  );
  // The far leg (darker), behind the body.
  const leg = (foot: number, up: number, near: boolean) =>
    painted(`leg:${near ? "n" : "f"}:${foot}:${up}:${by}:${p.sit ? 1 : 0}`, (cv) => {
      if (p.sit) {
        // Folded under: just the toes peeking out in front.
        stamp(cv, near ? ["yYYL", ".y.y"] : ["yyY", ".y."], foot + 2, GROUND - 2);
        return;
      }
      const hip: Pt = [near ? 32 : 27, 49 + by];
      const fy = GROUND - 1 - up;
      const knee: Pt = [(hip[0] + foot) / 2 + 1.5, (hip[1] + fy) / 2];
      // The thigh: feathered, the body's color.
      area(cv, ell(hip[0], hip[1] + 1, 3.6, 3.2), (x, y) => (near ? (x + y < hip[0] + hip[1] ? "c" : "b") : "a"));
      // The shank: yellow, scaled; a spur behind.
      stroke(cv, [[knee[0], knee[1]], [foot, fy]], 1.4, 1.2, (_t, s) => (near ? (s < 0 ? "L" : "Y") : "y"));
      stroke(cv, [[hip[0], hip[1] + 2], [knee[0], knee[1]]], 1.6, 1.4, (_t, s) => (near ? (s < 0 ? "Y" : "y") : "y"));
      put(cv, foot - 2, fy - 3, near ? "y" : "y");
      // The toes: three forward, one back.
      stamp(cv, near ? ["..YYYL", "yY.Y.Y"] : ["..yyyY", "yy.y.y"], foot - 3, fy - 1 + 1);
    });
  L(leg(p.far, p.farUp, false));
  // The body: a russet egg, chest out; darker underneath; a scruff of feathers at the back.
  L(
    painted(`body:${by}`, (cv) => {
      const inside = (x: number, y: number) => ell(BODY[0], BODY[1] + by, 12.5, 8.6, -0.22)(x, y) || ell(37, 37 + by, 6, 6.5)(x, y) || ell(21, 40 + by, 5, 4.5)(x, y);
      area(cv, inside, (x, y) => {
        const l = 0.65 - (x - 30) * 0.012 - (y - 36 - by) * 0.07 + (hash(x, y, 3) - 0.5) * 0.15;
        return l > 0.72 ? "d" : l > 0.45 ? "c" : l > 0.2 ? "b" : "a";
      });
      // Scruffy feathers sticking out at the back and under.
      for (const [x, y] of [[16, 37], [15, 40], [24, 51], [28, 52], [33, 51]] as const) put(cv, x, y + by, "b");
    }),
  );
  // The wing: folded on his side, a dark bar and the flight feathers' tips toward the tail; or raised in a wave (then
  // drawn in front of his neck, last).
  const wingL = (
    painted(`wing:${p.wing}:${by}`, (cv) => {
      if (p.wing === 0) {
        area(cv, ell(26, 43 + by, 9, 5.2, -0.15), (x, y) => {
          const X = x - 26;
          const Y = y - 43 - by;
          if (Math.abs(Y - X * 0.15 - 0.5) < 0.9 && X > -7) return "n"; // the bar
          if (X < -4 && Y > 0) return (x + y) % 2 ? "a" : "n"; // the flight feathers
          return Y < -1 ? "c" : "b";
        });
      } else {
        // Raised: the wing thrown up and out in front of him, its flight feathers fanned (a wave), its shoulder at (33, 41).
        const sh: Pt = [33, 41 + by];
        const a = -0.25 - p.wing * 0.17;
        for (let i = 4; i >= 0; i--) {
          const ang = a - 0.45 + i * 0.2;
          const len = 15 - i * 1.1;
          const tip: Pt = [sh[0] + Math.cos(ang) * len, sh[1] + Math.sin(ang) * len];
          stroke(cv, [sh, tip], 2.8, 1.4, (t, s) => (t > 0.7 ? (s < 0 ? "b" : "n") : s < -0.2 ? "d" : "c"));
        }
        area(cv, ell(sh[0] + 1, sh[1] - 1, 4.5, 3.8), (x, y) => (x + y < sh[0] + sh[1] - 1 ? "d" : "c"));
      }
    })
  );
  if (p.wing === 0) L(wingL);
  // The near leg.
  L(leg(p.near, p.nearUp, true));
  // The neck: a shaggy gold hackle over the shoulders, its feathers' tips sticking out; the bandana over it.
  L(
    painted(`neck:${hx}:${hy}`, (cv) => {
      const top: Pt = [40 + hx, 23 + hy];
      const pts: Pt[] = [[30, 40 + (hy - hx * 0)], [31.5, 33 + hy * 0.6], [top[0] - 6, top[1] + 1], [top[0] - 2, top[1] - 4], [top[0] + 4, top[1] - 2], [top[0] + 4, top[1] + 6], [41 + hx * 0.5, 38 + hy * 0.6], [36, 42 + hy * 0.4]];
      area(cv, inPoly(pts), (x, y) => {
        const streak = hash(x, Math.floor(y / 2), 7) > 0.7;
        const l = 0.7 - (x - top[0]) * 0.03 - (y - top[1]) * 0.02;
        return streak ? "e" : l > 0.6 ? "g" : "f";
      });
      // The shaggy hem of the hackle: points down over the body.
      for (let i = 0; i < 6; i++) {
        const x = 31 + i * 2 + hx * 0.4;
        const y = 41 + hy * 0.4 + (i % 2);
        put(cv, x, y, i % 2 ? "e" : "f");
        put(cv, x, y + 1, "e");
      }
      // A few feathers sticking out every which way.
      put(cv, top[0] - 7, top[1] + 4, "g");
      put(cv, top[0] - 8, top[1] + 3, "f");
      put(cv, 29, 36 + hy * 0.6, "f");
    }),
  );
  L(
    painted(`bandana:${hx}:${hy}`, (cv) => {
      const y0 = 31 + hy;
      const x0 = 33 + Math.round(hx * 0.8);
      // A band round his neck, a little triangle down his chest, the knot and its ends behind.
      stamp(cv, ["sssssssss", ".SsKsssS.", "..SsssS..", "...SsS...", "....S...."], x0, y0);
      stamp(cv, ["ss", "sS", "S."], x0 - 2, y0 - 1);
      stamp(cv, ["S.", ".S"], x0 - 3, y0 + 1);
    }),
  );
  // The head: comb, beak, wattles, the eye, the white ear lobe.
  L(
    painted(`head:${hx}:${hy}:${p.mood}`, (cv) => {
      const cx = 41 + hx;
      const cy = 21 + hy;
      // The comb: a big red serrated crest from his brow back over his crown, five points.
      const COMB = ["..R.R.R.R..", ".qRqRqRRRr.", "qRRRRRRRRRr", ".RRRRRRRRr.", "..rrrrrr..."];
      stamp(cv, COMB, cx - 6, cy - 9);
      area(cv, ell(cx, cy, 4.8, 4.2), (x, y) => (x + y < cx + cy - 2 ? "R" : x + y > cx + cy + 3 ? "r" : "R"));
      // His face is red-skinned round the eye; the crown feathered gold at the back.
      area(cv, ell(cx - 3, cy - 0.5, 2.4, 3.8), (x, y) => (hash(x, y, 5) > 0.5 ? "f" : "g"));
      // The beak: open to crow, or shut.
      if (p.mood === "crow") stamp(cv, ["LYY..", ".yYYy", ".....", ".yy..", "..yy."], cx + 4, cy - 1);
      else stamp(cv, ["LYYY.", ".yYYy", "..yy."], cx + 4, cy - 1);
      // The wattles under the beak.
      stamp(cv, p.mood === "crow" ? ["Rr.", "RRr", "rRr", ".r."] : ["RR.", "RRr", "RRr", ".r."], cx + 2, cy + 3 + (p.mood === "crow" ? 1 : 0));
      // The ear lobe.
      put(cv, cx - 1, cy + 2, "W");
      put(cv, cx - 1, cy + 3, "W");
      // The eye: a fierce orange iris, looking ahead.
      if (p.mood === "blink") stamp(cv, ["rrr"], cx, cy - 1);
      else {
        stamp(cv, ["oo", "ox"], cx + 1, cy - 2);
        put(cv, cx + 1, cy - 2, p.mood === "look" ? "x" : "w");
      }
    }),
  );
  if (p.wing > 0) L(wingL);
  void id;
  return out;
}

const frame = (ms: number, p: Partial<Pose>, more: Partial<Frame> = {}): Frame => ({ ms, layers: layers({ ...STAND, ...p }), ...more });

// ---- The animations.

/** Idle: chest out, he breathes, his head jerks round to look (as a rooster's does), his tail sways, a blink, a ruffle. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    frame(i === 4 || i === 9 ? 260 : 170, {
      by: [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0][i]!,
      hx: [0, 0, 0, 1, 1, 1, 0, 0, -1, -1, 0, 0][i]!,
      hy: [0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0][i]!,
      tail: [0, 0.04, 0.08, 0.04, 0, -0.04, -0.06, -0.04, 0, 0.04, 0.04, 0][i]!,
      mood: i === 6 ? "blink" : i === 4 || i === 5 ? "look" : "proud",
      wing: i === 10 ? 1 : 0,
    }),
  ),
};

/** Walk: a proud strut, the head pumping forward and back with each step, the tail bobbing. */
const WALK: readonly Partial<Pose>[] = [
  { by: 0, hx: 2, near: 36, far: 25, nearUp: 0, farUp: 0, tail: -0.04 },
  { by: -1, hx: 1, near: 34, far: 27, nearUp: 0, farUp: 3, tail: 0 },
  { by: 0, hx: -1, near: 31, far: 30, nearUp: 0, farUp: 2, tail: 0.04 },
  { by: 0, hx: 2, near: 28, far: 33, nearUp: 0, farUp: 0, tail: -0.04 },
  { by: -1, hx: 1, near: 30, far: 31, nearUp: 3, farUp: 0, tail: 0 },
  { by: 0, hx: -1, near: 33, far: 28, nearUp: 2, farUp: 0, tail: 0.04 },
];
const walk: Anim = { loop: true, frames: WALK.map((p, i) => frame(110, p, i === 0 || i === 3 ? { cue: "step" } : {})) };

/** Sit (at a table): settled down on his belly, his toes tucked under; he breathes, looks round, blinks, flicks his tail. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 10 }, (_, i) =>
    frame(220, {
      sit: true,
      by: i % 4 === 2 || i % 4 === 3 ? 1 : 0,
      hx: i === 5 || i === 6 ? 1 : 0,
      hy: i === 5 || i === 6 ? -1 : 0,
      mood: i === 3 ? "blink" : i === 5 || i === 6 ? "look" : "proud",
      tail: i === 8 ? 0.08 : 0,
    }),
  ),
};

/** Wave: he throws up a wing and flaps it, beak open in a crow, then folds it away. */
const wave: Anim = {
  loop: false,
  frames: [
    frame(120, { wing: 1, hy: -1 }),
    frame(100, { wing: 2, hy: -2, hx: -1, mood: "crow", tail: 0.06 }),
    frame(100, { wing: 3, hy: -2, hx: -1, mood: "crow", tail: 0.08 }),
    frame(100, { wing: 2, hy: -2, hx: -1, mood: "crow", tail: 0.06 }),
    frame(100, { wing: 3, hy: -2, hx: -1, mood: "crow", tail: 0.08 }),
    frame(100, { wing: 2, hy: -1, mood: "crow", tail: 0.04 }),
    frame(140, { wing: 1, hy: -1 }),
    frame(260, {}),
  ],
};

export const sidekickPigRooster: Character = {
  id: "sidekick-pig-rooster",
  name: "Wrangler's rooster",
  w: W,
  h: H,
  foot: [30, GROUND],
  palette: PALETTE,
  halo: "#5a3a2a",
  parts: PARTS,
  anims: { idle, walk, sit, wave },
};
