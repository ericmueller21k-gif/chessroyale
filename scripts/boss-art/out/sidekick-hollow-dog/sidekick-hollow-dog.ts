/**
 * Hollow's dog (id "sidekick-hollow-dog"), who keeps the shop in Hollow Peak (out/house-shop-hollow): a dark, shaggy,
 * droopy-eyed, loyal mutt with a pair of antlers tied onto his head with red string, wearing a knitted scarf far too big
 * for him. Charcoal and slate fur (Hollow's world: characters/hollow.ts), warm gold eyes so he reads in the dark, a
 * faint violet halo like Glim's (out/sidekick-hollow). About the size of the other kids. Three-quarters, facing our
 * right, light from the top left.
 *
 * Rigging: every part is painted from a pose (a handful of numbers: the body's bob, the head's offset, each paw's
 * place, the tail's swing, the ears' flop, the antlers' tilt, the face), each part its own outlined layer, back to
 * front; parts are made once per pose and shared between frames.
 */
import { canvas, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#08070c", // outline (Hollow's)
  n: "#121118", // fur: deepest, charcoal dark to slate light
  d: "#22212c",
  c: "#33313f",
  C: "#484558",
  h: "#646079",
  e: "#ffcf3a", // eyes: a warm gold, its bright core, an amber rim
  E: "#fff3b0",
  a: "#c47a1c",
  q: "#9c4652", // the droopy lower lids, the tongue: mid, light
  Q: "#d87a86",
  m: "#050407", // nose, mouth
  M: "#5d5968", // the nose's shine
  "5": "#4a3220", // the antlers' wood: shade, mid, lit, tip
  "6": "#6f4e30",
  "7": "#9a7348",
  "8": "#c49e6c",
  s: "#a8262e", // the red string: mid, lit
  S: "#e05a4e",
  r: "#4a1622", // the scarf's knit: dark, mid, lit; its cream stripes: shade, lit
  R: "#7a2634",
  t: "#a8404a",
  x: "#b8a888",
  X: "#e2d6b8",
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
/** A seeded number in [0, 1) for a pixel. */
const hash = (x: number, y: number, s: number) => (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s, 83492791)) >>> 0) % 10007) / 10007;
/** A triangle wave peaking mid-unit: tufts round an edge. */
const tri = (u: number) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);

const FUR = "ndcCh";
/** Fur by light (0 to 1), `dark` steps darker (the far limbs), with darker strands here and there. */
const fur = (l: number, x: number, y: number, dark = 0, seed = 1): string => {
  let i = Math.floor(Math.max(0, Math.min(0.999, l)) * 4) + 1 - dark;
  if (hash(x, y, seed) < 0.12 || (hash(x, y - 1, seed) < 0.12 && hash(x, y - 1, seed + 1) < 0.5)) i -= 1; // a strand
  return FUR[Math.max(0, Math.min(4, i))]!;
};

/** A shaggy blob: an ellipse whose edge breaks into tufts (longer underneath, where the fur hangs). */
function shag(cv: Canvas, cx: number, cy: number, rx: number, ry: number, o: { tufts?: number; amp?: number; hang?: number; seed?: number; dark?: number; bias?: number } = {}) {
  const { tufts = 9, amp = 0.16, hang = 0.18, seed = 1, dark = 0, bias = 0 } = o;
  for (let y = Math.floor(cy - ry - 4); y <= Math.ceil(cy + ry + 5); y++)
    for (let x = Math.floor(cx - rx - 4); x <= Math.ceil(cx + rx + 4); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const a = Math.atan2(dy, dx);
      const d = Math.hypot(dx, dy);
      const t = tri((a / (2 * Math.PI)) * tufts + seed * 0.37);
      const lim = 1 + amp * (t - 0.5) + (dy > 0 ? hang * Math.max(0, dy) * t : 0);
      if (d > lim) continue;
      put(cv, x, y, fur(0.55 + bias - 0.35 * dx - 0.45 * dy, x, y, dark, seed));
    }
}
/** A shaggy limb along points (a hip, a knee, a paw): `r0` thick at the top, `r1` at the paw. */
function limb(cv: Canvas, pts: readonly Pt[], r0: number, r1: number, dark: number, seed: number) {
  const segs: [Pt, Pt, number, number][] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    segs.push([pts[i - 1]!, pts[i]!, acc / total, (acc + len) / total]);
    acc += len;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let best = Infinity;
      let along = 0;
      let side = 0;
      for (const [a, b, t0, t1] of segs) {
        const vx = b[0] - a[0];
        const vy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x + 0.5 - a[0]) * vx + (y + 0.5 - a[1]) * vy) / (vx * vx + vy * vy || 1)));
        const px = x + 0.5 - (a[0] + t * vx);
        const py = y + 0.5 - (a[1] + t * vy);
        const d = Math.hypot(px, py);
        if (d < best) {
          best = d;
          along = t0 + (t1 - t0) * t;
          side = (px * -vy + py * vx) / (Math.hypot(vx, vy) || 1);
        }
      }
      const r = r0 + (r1 - r0) * along + (tri(along * 4 + seed * 0.3) - 0.5) * 0.9;
      if (best > r) continue;
      put(cv, x, y, fur(0.5 + (side < 0 ? 0.2 : -0.15) - along * 0.15, x, y, dark, seed));
    }
}
/** A paw at (x, y) (its sole on y): a dark shaggy foot, toes marked. */
function paw(cv: Canvas, x: number, y: number, dark: number) {
  stamp(cv, [".ccCc.", "cCCcdd", "dcdcdn"].map((r) => (dark ? r.replace(/C/g, "c").replace(/c/g, "d") : r)), Math.round(x) - 2, Math.round(y) - 2);
}

// ---- A pose: every number that moves.

type Mood = "calm" | "blink" | "happy" | "look";
interface Pose {
  /** The body's bob (down is +). */
  by: number;
  /** The head's offset. */
  hx: number;
  hy: number;
  /** The paws: near front, far front, near hind, far hind ([x, y] at the sole); a raised paw's elbow. */
  nf: Pt;
  ff: Pt;
  nh: Pt;
  fh: Pt;
  elbow?: Pt;
  /** The tail's swing (its tip's x offset), the ears' flop (up is -), the near antler's tilt. */
  tail: number;
  ear: number;
  tilt: number;
  /** The scarf's end, swinging. */
  scarf: number;
  mood: Mood;
  /** Sitting on his haunches (at a table). */
  sit?: boolean;
  tongue?: boolean;
}
const STAND: Pose = { by: 0, hx: 0, hy: 0, nf: [43, 60], ff: [38, 60], nh: [20, 60], fh: [24, 60], tail: 0, ear: 0, tilt: 0, scarf: 0, mood: "calm" };
const key = (p: Pose) => JSON.stringify(p);

/** The face: the near eye and the far one, droopy (a heavy lid, a sagging red lower lid), by mood. */
const EYES: Record<Mood, { near: readonly string[]; far: readonly string[] }> = {
  calm: { near: ["nnnn", "eEee", "aeea", ".qq."], far: ["nn", "ee", "q."] },
  blink: { near: ["....", "nnnn", ".qq.", "...."], far: ["..", "nn", ".."] },
  happy: { near: ["....", ".nn.", "n..n", "...."], far: ["..", "nn", ".."] },
  look: { near: ["nnnn", "eeEe", "aeea", ".qq."], far: ["nn", "ee", "q."] },
};

function layers(p: Pose): Layer[] {
  const id = key(p);
  const out: Layer[] = [];
  const add = (name: string, fn: (cv: Canvas) => void, outline = true) => {
    const { name: n, at } = painted(`${name}:${id}`, fn, outline);
    out.push({ part: n, x: at[0], y: at[1] });
  };
  const by = p.by;
  const hx = p.hx;
  const hy = p.hy + (p.sit ? -5 : 0);
  const HC: Pt = [42 + hx, 25 + hy + by]; // the head's middle
  // Shadow on the ground.
  add("shadow", (cv) => {
    for (let x = 8; x < 54; x++) for (let y = GROUND - 1; y <= GROUND + 1; y++) if (Math.hypot((x + 0.5 - 31) / 23, (y + 0.5 - GROUND) / 2) < 1) put(cv, x, y, "z");
  }, false);
  // The tail: a droopy shaggy plume off his back end.
  add("tail", (cv) => {
    if (p.sit) limb(cv, [[16, 52], [9, 56], [5 + p.tail, 59]], 3.2, 2.4, 0, 7);
    else limb(cv, [[13, 37 + by], [8, 40 + by], [5 + p.tail, 47 + by]], 3.4, 2.2, 0, 7);
  });
  // The far legs, darker.
  add("legs-far", (cv) => {
    if (p.sit) {
      limb(cv, [[35, 44 + by], [p.ff[0], p.ff[1] - 2]], 3, 2.4, 1, 3);
      paw(cv, p.ff[0], p.ff[1], 1);
    } else {
      limb(cv, [[37, 43 + by], [p.ff[0] - 0.5, 52 + by * 0.5], [p.ff[0], p.ff[1] - 2]], 3.2, 2.4, 1, 3);
      limb(cv, [[23, 42 + by], [p.fh[0] - 2, 52], [p.fh[0], p.fh[1] - 2]], 4, 2.4, 1, 4);
      paw(cv, p.ff[0], p.ff[1], 1);
      paw(cv, p.fh[0], p.fh[1], 1);
    }
  });
  // The body: a long shaggy barrel (sitting: upright, on his haunches).
  add("body", (cv) => {
    if (p.sit) {
      shag(cv, 24, 51 + by, 10, 8.5, { seed: 2, tufts: 8 });
      shag(cv, 32, 41 + by, 9.5, 11, { seed: 3, tufts: 9, hang: 0.1, bias: 0.05 });
    } else {
      shag(cv, 27, 39 + by, 15.5, 8.5, { seed: 2, tufts: 11, hang: 0.2 });
      shag(cv, 37, 37 + by, 7.5, 8.5, { seed: 3, tufts: 7, hang: 0.16, bias: 0.08 });
    }
  });
  // The near hind leg: a haunch and the leg down to the paw (sitting: folded under him).
  add("leg-nh", (cv) => {
    if (p.sit) {
      shag(cv, 22, 52 + by, 7.5, 7, { seed: 5, tufts: 6, bias: 0.1 });
      limb(cv, [[22, 56], [27, 59]], 3, 2.6, 0, 5);
      paw(cv, 28, 60, 0);
    } else {
      shag(cv, 19, 43 + by, 6.5, 6.5, { seed: 5, tufts: 6, bias: 0.05 });
      limb(cv, [[18, 46 + by], [p.nh[0] - 3, 53], [p.nh[0], p.nh[1] - 2]], 3.8, 2.6, 0, 5);
      paw(cv, p.nh[0], p.nh[1], 0);
    }
  });
  const antler = (cv: Canvas, base: Pt, dir: number, tilt: number) => {
    // A forked branch of wood: a main beam curving up and out, two tines.
    const beam: Pt[] = [base, [base[0] + dir * 2 + tilt * 0.5, base[1] - 4], [base[0] + dir * 4 + tilt, base[1] - 8], [base[0] + dir * 5 + tilt * 1.4, base[1] - 12]];
    const tines: Pt[][] = [
      [beam[1]!, [beam[1]![0] + dir * 4, beam[1]![1] - 2]],
      [beam[2]!, [beam[2]![0] - dir * 3 + tilt * 0.4, beam[2]![1] - 3]],
    ];
    const draw = (pts: Pt[], r: number) => {
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1]!;
        const [bx, by_] = pts[i]!;
        const n = Math.ceil(Math.hypot(bx - ax, by_ - ay) * 2);
        for (let s = 0; s <= n; s++) {
          const x = ax + ((bx - ax) * s) / n;
          const y = ay + ((by_ - ay) * s) / n;
          for (let j = 0; j < r; j++) put(cv, x + j, y, j === 0 ? "7" : "6");
        }
      }
      const tip = pts[pts.length - 1]!;
      put(cv, tip[0], tip[1], "8");
    };
    draw(beam, 2);
    tines.forEach((t) => draw(t, 1));
    put(cv, base[0], base[1], "5");
    put(cv, base[0] + 1, base[1], "5");
  };
  // The far antler, behind his head.
  add("antler-far", (cv) => antler(cv, [HC[0] - 3, HC[1] - 6], -1, 0));
  // The head: a shaggy round head, a long lighter muzzle with a shaggy beard, a dark nose, droopy eyes under shaggy brows.
  add("head", (cv) => {
    shag(cv, HC[0], HC[1], 8.5, 8, { seed: 11, tufts: 10, amp: 0.18, hang: 0.16, bias: 0.06 });
    shag(cv, HC[0] + 8, HC[1] + 3, 6.5, 4, { seed: 12, tufts: 7, amp: 0.12, hang: 0.45, bias: 0.3 });
    // The bridge of the nose, lit.
    for (let i = 0; i < 6; i++) put(cv, HC[0] + 6 + i, HC[1] - 1 + (i > 3 ? 1 : 0), "h");
    // The nose and the mouth.
    stamp(cv, ["mmM", "mmm", ".m."], HC[0] + 13, HC[1]);
    if (p.tongue) stamp(cv, ["mmmmmm", ".mQQq.", "..QQq.", "..qQ.."], HC[0] + 7, HC[1] + 5);
    else stamp(cv, ["mmm...", "...mmm"], HC[0] + 7, HC[1] + 5);
    // The eyes, and shaggy brows over them.
    const e = EYES[p.mood];
    stamp(cv, e.near, HC[0], HC[1] - 3);
    stamp(cv, e.far, HC[0] + 6, HC[1] - 3);
    for (let i = -1; i < 9; i++) if (i !== 4 && i !== 5) put(cv, HC[0] + i, HC[1] - 4 - (i === 1 || i === 7 ? 1 : 0), i % 2 ? "h" : "C");
  });
  // The near ear: long and floppy, hanging down the side of his head behind the eye.
  add("ear-near", (cv) => limb(cv, [[HC[0] - 4, HC[1] - 5], [HC[0] - 6.5, HC[1] + 2 + p.ear], [HC[0] - 6.5, HC[1] + 10 + p.ear]], 2.8, 3.3, 0, 13));
  // The near antler, tied on a little askew, and the red string holding both on: round his brow, a bow at the side.
  add("antler-near", (cv) => antler(cv, [HC[0] + 2, HC[1] - 7], 1, p.tilt));
  add("string", (cv) => {
    for (let i = -5; i <= 5; i++) put(cv, HC[0] + i, HC[1] - 6 + (Math.abs(i) > 3 ? 1 : 0), i % 2 ? "s" : "S");
    stamp(cv, ["S.S", ".s.", "s.s"], HC[0] - 6, HC[1] - 7);
  }, false);
  // The scarf: chunky knit, far too big, wound round his neck, one long end hanging down his front.
  add("scarf", (cv) => {
    const sx = 32 + hx * 0.5;
    const sy = 30 + by + (p.sit ? -2 : 0) + hy * 0.4;
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 18; x++) {
        const dy = y - 5 + Math.sin((x / 17) * Math.PI) * -1.4;
        if (Math.abs(dy) > 4.4 + (x > 14 ? -1.2 : 0) - (x < 2 ? 1 : 0)) continue;
        const stripe = Math.floor((x + 1) / 5) % 2 === 1;
        const k = stripe ? (dy < -1 ? "X" : "x") : dy < -1.5 ? "t" : dy > 2 ? "r" : "R";
        put(cv, sx + x, sy + y, (x + y) % 2 && !stripe ? (k === "R" ? "t" : k) : k);
      }
  });
  // The near front leg (waving, it's drawn last, in front of the scarf).
  const raised = (cv: Canvas) => {
    limb(cv, [[40, 42 + by], p.elbow!, p.nf], 3.4, 2.8, 0, 15);
    stamp(cv, [".hC.", "hCCc", "Cccd"], Math.round(p.nf[0]) - 2, Math.round(p.nf[1]) - 2);
  };
  add("leg-nf", (cv) => {
    if (p.elbow) {
      return;
    } else {
      limb(cv, [[40, 44 + by], [p.nf[0] - 0.5, 52 + by * 0.5], [p.nf[0], p.nf[1] - 2]], 3.6, 2.6, 0, 15);
      paw(cv, p.nf[0], p.nf[1], 0);
    }
  });
  // The scarf's long end, swinging, its fringe.
  add("scarf-end", (cv) => {
    const x0 = 38 + hx * 0.5;
    const y0 = 37 + by + (p.sit ? -2 : 0) + hy * 0.4;
    const len = p.sit ? 15 : 14;
    for (let j = 0; j < len; j++) {
      const sw = (p.scarf * j) / len;
      for (let i = 0; i < 5; i++) {
        const stripe = Math.floor(j / 4) % 2 === 1;
        put(cv, x0 + i + sw, y0 + j, stripe ? (i === 0 ? "X" : "x") : i === 0 ? "t" : i === 4 ? "r" : "R");
      }
    }
    for (let i = 0; i < 5; i += 2) put(cv, x0 + i + p.scarf, y0 + len, "x"), put(cv, x0 + i + p.scarf, y0 + len + 1, "X");
  });
  if (p.elbow) add("leg-raised", raised);
  return out;
}

const frame = (ms: number, p: Partial<Pose>, more: Partial<Frame> = {}): Frame => ({ ms, layers: layers({ ...STAND, ...p }), ...more });

// ---- The animations.

/** Idle: he breathes slowly, his tail sways, an ear twitches, a slow droopy blink, the near antler wobbles on its string. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    frame(170, {
      by: [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0][i]!,
      tail: [0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, -1][i]!,
      ear: i === 3 || i === 4 ? -1 : 0,
      mood: i === 7 ? "blink" : i === 8 ? "blink" : "calm",
      tilt: i === 9 ? 1 : i === 10 ? -1 : 0,
      hy: i >= 5 && i <= 6 ? 1 : 0,
    }),
  ),
};

/** Walk: a loose, shaggy trot; paws in diagonal pairs, the body bobbing, ears and scarf flopping, the tail swinging. */
const WALK: readonly Partial<Pose>[] = [
  { by: 0, nf: [46, 60], fh: [27, 60], ff: [36, 59], nh: [17, 59], tail: 1, ear: 1, scarf: -1 },
  { by: -1, nf: [44, 58], fh: [25, 58], ff: [37, 60], nh: [19, 60], tail: 0, ear: 0, scarf: 0 },
  { by: 0, nf: [41, 59], fh: [22, 59], ff: [40, 60], nh: [21, 60], tail: -1, ear: -1, scarf: 1 },
  { by: 0, nf: [40, 60], fh: [21, 60], ff: [42, 60], nh: [24, 60], tail: -1, ear: 1, scarf: 1 },
  { by: -1, nf: [41, 60], fh: [22, 60], ff: [41, 58], nh: [23, 58], tail: 0, ear: 0, scarf: 0 },
  { by: 0, nf: [44, 60], fh: [25, 60], ff: [38, 59], nh: [20, 59], tail: 1, ear: -1, scarf: -1 },
];
const walk: Anim = { loop: true, frames: WALK.map((p, i) => frame(110, { ...p, hy: p.by === -1 ? -1 : 0 }, i === 1 || i === 4 ? { cue: "step" } : {})) };

/** Sit (at a table): down on his haunches, front legs straight; he breathes, blinks, tilts his head and thumps his tail. */
const SIT: Partial<Pose> = { sit: true, nf: [40, 60], ff: [36, 60] };
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 10 }, (_, i) =>
    frame(220, {
      ...SIT,
      by: i % 4 === 2 || i % 4 === 3 ? 1 : 0,
      mood: i === 3 ? "blink" : i === 6 || i === 7 ? "look" : "calm",
      hx: i === 6 || i === 7 ? 1 : 0,
      hy: i === 6 || i === 7 ? -1 : 0,
      tilt: i === 7 ? 1 : 0,
      tail: i === 8 ? 2 : i === 9 ? 0 : -1,
      ear: i === 6 ? -1 : 0,
    }),
  ),
};

/** Wave: he lifts a front paw and waves it, happy, tongue out, tail going; then puts it down. */
const WAVE_PAWS: readonly [Pt, Pt][] = [
  [[45, 48], [48, 50]],
  [[47, 44], [52, 41]],
  [[48, 42], [56, 36]],
  [[48, 43], [54, 34]],
  [[48, 42], [57, 37]],
  [[48, 43], [54, 34]],
  [[48, 42], [57, 37]],
  [[47, 45], [53, 43]],
];
const wave: Anim = {
  loop: false,
  frames: [
    ...WAVE_PAWS.map(([elbow, nf], i) => frame(i === 0 ? 130 : 110, { elbow, nf, mood: i === 0 ? "calm" : "happy", tongue: i > 0, tail: i % 2 ? 2 : -2, hy: -1, by: 0, ear: i % 2 ? -1 : 0, scarf: i % 2 ? 1 : 0 })),
    frame(160, { mood: "happy", tongue: true, tail: 1 }),
    frame(260, { mood: "calm" }),
  ],
};

export const sidekickHollowDog: Character = {
  id: "sidekick-hollow-dog",
  name: "Hollow's dog",
  w: W,
  h: H,
  foot: [30, GROUND],
  palette: PALETTE,
  halo: "#5a44a0",
  parts: PARTS,
  anims: { idle, walk, sit, wave },
};
