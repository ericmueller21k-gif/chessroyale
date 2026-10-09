/**
 * G-REX, the Fire boss: a cocky giraffe with a mischievous look and a fiery glint in his eyes, flames on his horn tips,
 * down his mane and on the end of his tail, a cheeky grin, a sparkler in each hand and a wide fighting stance, after
 * Eric's reference picture, redrawn. Yellow with orange-brown spots, light from the top left.
 *
 * A giraffe first (Eric, Oct 9): a long neck, so he stands taller than the other bosses (about the God King's height
 * with his wings spread; his frame grows upward), and a typical giraffe face, no sunglasses. The head stays big for
 * a phone, so his eyes, grin and flaming ossicones read. Drawn three-quarters, facing right (our right), as in the
 * reference: the flames (mane, tail) on our left, the sparklers on our right, towards the board.
 *
 * Rigging: the head, torso and hooves are painted once per look; the neck, arms, legs and tail are painted from
 * their pose's points (a shoulder, an elbow, a fist; a hip, a knee, an ankle), and the sparklers from the fist in
 * the arm's direction, so a new pose is a handful of numbers. The flames (horn tips, mane, tail tuft) are small
 * painted parts in three flicker shapes, picked per frame, and the sparklers spit sparks (seeded specks), so every
 * frame crackles without anyone drawing it.
 */
import { canvas, ellipse, flame as flameGrid, inEllipse, inPoly, roundLight, shade, toGrid, type Canvas } from "./paint.ts";
import type { Beat } from "./boss-beats.ts";
import { lieDown, partSize, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

export const GREX_PALETTE = {
  k: "#1e0e05", // outline
  d: "#b0620f", // giraffe yellow, dark to light
  c: "#de8f16",
  C: "#f3b630",
  h: "#ffda5c",
  o: "#b24f16", // spots
  O: "#82340d",
  u: "#fde4a2", // cream: muzzle, belly
  U: "#e6b462",
  b: "#7a4019", // hooves, hands, horn knobs
  B: "#4a230c",
  N: "#a35d2c",
  s: "#17121d", // his pupils, and the fiery glint in them
  e: "#ff5e14",
  E: "#ffe24a",
  m: "#5e1708", // mouth, teeth, tongue
  t: "#fff8e6",
  q: "#e5566a",
  y: "#fff7b8", // flames: core to rim
  Y: "#ffd23a",
  f: "#ff9a1f",
  F: "#f2541b",
  R: "#b3270f",
  x: "#ffffff", // a spark
  w: "#9a9aa6", // sparkler wire
  W: "#55555f",
  g: "#b8b0b8", // smoke, light to dark
  G: "#7d7580",
  v: "#3f74d6", // the Roman candle's bands
  V: "#26458c",
  j: "#7fd3ff", // sweat
  z: "#0d0e12", // ground shadow
} as const;

type Pt = readonly [number, number];

/** Baked spots on yellow: round blobs on a seeded grid, darker on the shadow side. */
function spots(cv: Canvas, seed: number, every = 5.2, r = 1.25): void {
  const H = cv.length;
  const W = cv[0]!.length;
  for (let gy = -1; gy * every < H + every; gy++)
    for (let gx = -1; gx * every < W + every; gx++) {
      const hsh = ((gx * 73856093) ^ (gy * 19349663) ^ (seed * 83492791)) >>> 0;
      if (hsh % 7 === 0) continue;
      const cx = gx * every + (gy % 2 ? every / 2 : 0) + ((hsh >>> 3) % 3) - 1;
      const cy = gy * every + ((hsh >>> 6) % 3) - 1;
      const rx = r + ((hsh >>> 9) % 3) * 0.25;
      for (let y = Math.floor(cy - rx - 1); y <= cy + rx + 1; y++)
        for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
          const k = cv[y]?.[x];
          if (!k || !"dcCh".includes(k)) continue;
          if ((x + 0.5 - cx) ** 2 / (rx * rx) + (y + 0.5 - cy) ** 2 / (r * r * 0.8) <= 1) cv[y]![x] = k === "d" ? "O" : "o";
        }
    }
}

function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number, over = false): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      const X = x0 + i;
      const Y = y0 + y;
      if (cv[Y]?.[X] === undefined) return;
      if (over || cv[Y]![X] !== ".") cv[Y]![X] = k;
    }),
  );
}

// ---- Head: three-quarters, facing right; the eyes and the mouth change per mood.

export type Mood = "grin" | "laugh" | "roar" | "shout" | "hurt" | "smug" | "rattled" | "think" | "out";

/** How an eye looks: open with its lid part-way down (slanted), the pupil looking somewhere; or shut. */
interface EyeLook {
  /** How far the lid comes down, 0 (wide open) to 1 (shut). */
  lid?: number;
  /** The lid's slant: positive, lower at the inner corner (cross); negative, higher there (worried). */
  slant?: number;
  /** Where the pupil looks, -1 to 1 each way. */
  px?: number;
  py?: number;
  /** Shut: a happy arc (laughing), squeezed (hurt), or crossed out. */
  shut?: "arc" | "pinch" | "x";
}

/**
 * A giraffe's eye, `w` x `h`: a white with a dark outline, a big dark pupil with a fiery glint, the lid (his yellow
 * skin) coming down over it, and two lashes at the outer corner (`outer` -1: the left, 1: the right).
 */
function eye(w: number, h: number, look: EyeLook, outer: -1 | 1): readonly string[] {
  const cv = canvas(w + 2, h + 2);
  const ox = 1;
  const oy = 1;
  const inside = inEllipse(ox + w / 2, oy + h / 2, w / 2, h / 2);
  if (look.shut) {
    const mid = oy + Math.floor(h / 2);
    for (let x = ox; x < ox + w; x++) {
      const t = (x - ox) / Math.max(1, w - 1);
      if (look.shut === "arc") cv[mid - Math.round(Math.sin(Math.PI * t) * 1.5)]![x] = "k";
      else if (look.shut === "pinch") cv[mid + Math.round((t < 0.5 ? t : 1 - t) * 3) - 1]![x] = "k";
      else {
        cv[oy + Math.round(t * (h - 1))]![x] = "k";
        cv[oy + h - 1 - Math.round(t * (h - 1))]![x] = "k";
      }
    }
    return toGrid(cv);
  }
  const lidAt = (x: number) => oy + (look.lid ?? 0) * h + (look.slant ?? 0) * ((x - ox) / (w - 1) - 0.5) * -outer;
  for (let y = 0; y < h + 2; y++)
    for (let x = 0; x < w + 2; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const lid = y + 0.5 < lidAt(x);
      cv[y]![x] = edge ? "k" : lid ? "C" : y + 0.5 < lidAt(x) + 1 ? "k" : "t";
    }
  // The pupil: 2 x 2 (3 tall on a big eye), where it looks, only where the white shows.
  const pxC = Math.round(ox + (w - 2) / 2 + (look.px ?? 0) * ((w - 2) / 2 - 0.5));
  const pyC = Math.round(oy + (h - 2) / 2 + (look.py ?? 0) * ((h - 2) / 2 - 0.5) + (look.lid ?? 0) * 1.2);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) if (cv[pyC + dy]?.[pxC + dx] === "t") cv[pyC + dy]![pxC + dx] = dx === 0 && dy === 0 ? "e" : "s";
  // Lashes at the outer corner, flicking up and out.
  const lx = outer === -1 ? ox : ox + w - 1;
  const ly = Math.round(lidAt(lx)) - 1;
  if (cv[ly]?.[lx + outer] !== undefined) cv[ly]![lx + outer] = "k";
  if (cv[ly - 1]?.[lx + outer * 1] !== undefined && (look.lid ?? 0) < 0.6) cv[ly - 1]![lx] = "k";
  return toGrid(cv);
}

/** Each mood's eyes (the near one, on our left, and the far one by the bridge of his nose), mouth and brow. */
const FACES: Record<Mood, { eyes: EyeLook; far?: EyeLook; mouth: string; brow?: "up" | "worried" }> = {
  grin: { eyes: { lid: 0.42, slant: 0.6, px: 0.7, py: 0.2 }, mouth: "grin" },
  laugh: { eyes: { shut: "arc" }, mouth: "laugh" },
  roar: { eyes: { lid: 0.3, slant: 2, px: 0.5 }, mouth: "roar" },
  shout: { eyes: { lid: 0.32, slant: 2, px: 0.8 }, mouth: "shout" },
  hurt: { eyes: { shut: "pinch" }, mouth: "o" },
  smug: { eyes: { lid: 0.6, slant: 0, px: 0.8, py: 0.6 }, mouth: "smirk", brow: "up" },
  rattled: { eyes: { lid: 0, slant: -1, px: -0.2, py: 0 }, mouth: "wavy", brow: "worried" },
  think: { eyes: { lid: 0.2, px: -0.5, py: -1 }, mouth: "flat" },
  out: { eyes: { shut: "x" }, mouth: "wavy" },
};

const MOUTHS: Record<string, readonly string[]> = {
  // A cheeky grin, curling up into his cheek, a row of teeth.
  grin: ["kk..........", ".kk.........", "..kkk.....kk", "..ttkkkkkkk."],
  laugh: ["kk..........", ".kkkkkkkkkkk", "..kmmmmmmmk.", "..kmmqqqmk..", "...kkkkkk..."],
  roar: ["kkttttttkk", "kmmmmmmmmk", "kmmqqqqmmk", "kmmqqqqmk.", ".kmmmmmk..", "..kkkkk..."],
  shout: [".kttttkk", "kmmmmmmk", "kmqqqmk.", ".kkkkk.."],
  smirk: ["...........k", "..........k.", "kkkkkkkkkk.."],
  wavy: ["..kk..kk..", ".k..kk..k.", "k........."],
  o: ["..kkk.", ".kmmmk", ".kmqmk", "..kkk."],
  flat: ["kkkkkkk"],
};

/** The top of his long neck, at rest, in his drawing space (the head sits on it). */
const NECK_TOP: Pt = [20, -2];
/** The head's grid size, and where on it the neck joins (the head part is placed so this sits on the neck's top). */
const HEAD_W = 32;
const HEAD_H = 23;
const HEAD_SOCKET: Pt = [13, 18];
/** The horn knobs' tops on the head grid (the flames sit on them). */
const HORNS: readonly Pt[] = [[11, 0], [17, 0]];

function head(mood: Mood): Part {
  const cv = canvas(HEAD_W, HEAD_H);
  // Horns (ossicones): short stalks with brown knobs.
  for (const [hx, hy] of HORNS) {
    for (let y = hy + 2; y <= 7; y++) for (const dx of [0, 1]) cv[y]![hx + dx] = dx ? "c" : "C";
    for (const [dx, dy, k] of [[-1, 0, "b"], [0, 0, "N"], [1, 0, "b"], [2, 0, "B"], [-1, 1, "B"], [0, 1, "b"], [1, 1, "b"], [2, 1, "B"]] as const) cv[hy + dy]![hx + dx] = k;
  }
  // Ears: the far one out to the left, the near one up and right behind the horns.
  const earL: Pt[] = [[0, 7], [6, 6.5], [9, 9], [6, 11.2], [1, 9.6]];
  const earR: Pt[] = [[21, 5.5], [27, 2], [29.5, 3], [26.5, 7.2], [22, 8.8]];
  shade(cv, inPoly(earL), "dcC", (_, y) => 1.0 - 0.065 * y);
  shade(cv, inPoly(earR), "dcC", (x, y) => 1.1 - 0.09 * y - 0.02 * x);
  for (const [x, y] of [[3, 8], [4, 8], [5, 9], [24, 4], [25, 4], [23, 5]] as const) cv[y]![x] = "U";
  // Skull and a long snout tapering to a round nose, lit from the top left.
  const skull = inEllipse(12.5, 11.5, 8.2, 7.4);
  const snout = inPoly([[11, 5.2], [19, 6.6], [28, 10], [30.6, 12.4], [30.6, 16], [28, 18.6], [21, 20.4], [12, 18.8]]);
  const nose = inEllipse(27.5, 14.3, 3.6, 4.4);
  const inside = (x: number, y: number) => skull(x, y) || snout(x, y) || nose(x, y);
  shade(cv, inside, "dcCh", roundLight(16, 11, 12, 9, 0.16));
  // Spots on his cheek, the back of his head and his forehead.
  for (const [x, y, w] of [[5, 13, 3], [6, 14, 2], [9, 16, 3], [10, 17, 2], [4, 10, 2], [15, 18, 3], [16, 19, 1], [13, 5, 2], [14, 6, 1], [21, 9, 2]] as const) for (let i = 0; i < w; i++) if ("dcCh".includes(cv[y]![x + i]!)) cv[y]![x + i] = cv[y]![x + i] === "d" ? "O" : "o";
  // The muzzle is cream, a nostril near its tip.
  const muzzle = inEllipse(27.2, 14.6, 5.6, 5.4);
  shade(cv, (x, y) => inside(x, y) && muzzle(x, y), "Uuu", (x, y) => 1.05 - 0.07 * (y - 10) - 0.015 * (x - 22));
  for (const [x, y] of [[28, 12], [29, 12], [29, 13]] as const) cv[y]![x] = "B";
  const f = FACES[mood];
  // The near eye big on the side of his head, the far one smaller by the bridge of his nose.
  stamp(cv, eye(7, 6, f.eyes, -1), 5, 7, true);
  stamp(cv, eye(5, 5, f.far ?? f.eyes, 1), 14, 7, true);
  if (f.brow === "up") stamp(cv, ["..kkk", ".k...", "k...."], 6, 4, true);
  if (f.brow === "worried") stamp(cv, ["k....", ".kk..", "...kk"], 6, 5, true);
  const mouth = MOUTHS[f.mouth]!;
  const mx = f.mouth === "grin" || f.mouth === "laugh" ? 17 : f.mouth === "smirk" ? 17 : f.mouth === "flat" ? 21 : 20;
  stamp(cv, mouth, mx, f.mouth === "flat" || f.mouth === "wavy" ? 17 : 15, true);
  return { grid: toGrid(cv) };
}

// ---- Torso: upright, a cream belly on the near side, spots.

const TORSO_AT: Pt = [19, 22];
const torso: Part = (() => {
  const cv = canvas(20, 22);
  const shape: Pt[] = [[5, 0.5], [14, 0.5], [18, 5], [19.5, 13], [17, 20], [10, 21.5], [3, 20], [0.5, 12], [1.5, 5]];
  shade(cv, inPoly(shape), "dcCh", (x, y) => 0.98 - 0.035 * x - 0.02 * y);
  spots(cv, 9, 6, 1.9);
  shade(cv, (x, y) => inPoly(shape)(x, y) && inEllipse(13.5, 13.5, 4.6, 7.6)(x, y), "Uuu", (x, y) => 1.05 - 0.05 * x - 0.01 * y);
  return { grid: toGrid(cv) };
})();

const shadow: Part = (() => {
  const cv = canvas(46, 3);
  ellipse(cv, 23, 1.5, 23, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

/** A hoof seen from the side, toe forward (`dir` 1 to our right). */
function hoof(dir: 1 | -1): Part {
  const rows = [".bbbb..", "bNbbbb.", "bbbbbbB", "BBBBBBB"];
  return { grid: dir === 1 ? rows : rows.map((r) => [...r].reverse().join("")) };
}

// ---- Limbs: a round stroke along a few points, cylinder-shaded, spotted along its length; a fist or nothing at the end.

interface Painted {
  part: Part;
  at: Pt;
}

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number; side: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t, side: Math.sign(vx * ny - vy * nx) };
}

/**
 * A limb along `pts`, `r` thick: spots every few pixels along it, alternating sides (so they stay put on the limb
 * however it bends); `fist` a brown ball at the end (`endR` across), or none.
 */
function paintLimb(pts: readonly Pt[], r: number, opts: { endR?: number; fist?: boolean; spotEvery?: number; spotFrom?: number } = {}): Painted {
  const endR = opts.endR ?? r;
  const pad = Math.ceil(Math.max(r, endR)) + 1;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  const w = Math.ceil(Math.max(...xs)) + pad - x0 + 1;
  const h = Math.ceil(Math.max(...ys)) + pad - y0 + 1;
  const cv = canvas(w, h);
  const end = pts[pts.length - 1]!;
  const segLen = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  const every = opts.spotEvery ?? 4.6;
  const from = opts.spotFrom ?? 2.2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p: Pt = [x0 + x + 0.5, y0 + y + 0.5];
      let best = { d: Infinity, nx: 0, ny: 0, s: 0, side: 0 };
      for (let i = 0; i + 1 < pts.length; i++) {
        const n = nearest(p, pts[i]!, pts[i + 1]!);
        if (n.d < best.d) best = { d: n.d, nx: n.nx, ny: n.ny, s: segLen.slice(0, i).reduce((a, l) => a + l, 0) + n.t * segLen[i]!, side: n.side };
      }
      const de = Math.hypot(p[0] - end[0], p[1] - end[1]);
      const inEnd = opts.fist && de <= endR;
      if (best.d > r && !inEnd) continue;
      if (inEnd && de < best.d + 1) {
        const light = 0.62 - 0.42 * ((p[0] - end[0]) / endR) - 0.5 * ((p[1] - end[1]) / endR);
        cv[y]![x] = "BbN"[Math.max(0, Math.min(2, Math.floor(light * 3)))]!;
        continue;
      }
      const light = 0.62 - 0.42 * (best.nx / r) - 0.5 * (best.ny / r);
      let k = "dcCh"[Math.max(0, Math.min(3, Math.floor(light * 4)))]!;
      // A spot: centred every `every` pixels along the limb, on alternate sides of its middle.
      const n = Math.round((best.s - from) / every);
      const sc = from + n * every;
      const across = best.d * best.side;
      const want = (n % 2 ? 1 : -1) * Math.min(1, r * 0.35);
      if (n >= 0 && best.s < segLen.reduce((a, l) => a + l, 0) - 1.2 && (best.s - sc) ** 2 / 3.4 + (across - want) ** 2 / 2.2 <= 1) k = k === "d" ? "O" : "o";
      cv[y]![x] = k;
    }
  return { part: { grid: toGrid(cv) }, at: [x0, y0] };
}

// ---- Fire: flame tongues (painted by paint.ts `flame`), tufts of them, the mane.

/** One flame tongue as a part: no outline of its own (its dark red rim is part of it), so it glows rather than sits. */
const flame = (w: number, h: number, seed: number, lean = 0): Part => ({ grid: flameGrid(w, h, seed, lean), outline: false });

/** A tuft of flames (the mane, the tail's end): several tongues side by side, tips leaning one way. */
function flameTuft(w: number, h: number, seed: number, lean: number, tongues: number): Part {
  const cv = canvas(w, h);
  for (let n = 0; n < tongues; n++) {
    const hsh = ((n + 1) * 2654435761 + seed * 40503) >>> 0;
    const tw = Math.max(3, Math.round(w / tongues) + 2);
    const th = Math.round(h * (0.55 + ((hsh % 100) / 100) * 0.45));
    const tongue = flame(tw, th, seed + n * 1.7, lean).grid;
    const ox = Math.round((n * (w - tw)) / Math.max(1, tongues - 1));
    tongue.forEach((row, y) =>
      [...row].forEach((k, x) => {
        if (k === ".") return;
        const Y = h - th + y;
        const cur = cv[Y]?.[ox + x];
        if (cur === undefined) return;
        // Hotter colours win where tongues overlap.
        if (cur === "." || "RFfYy".indexOf(k) > "RFfYy".indexOf(cur)) cv[Y]![ox + x] = k;
      }),
    );
  }
  return { grid: toGrid(cv), outline: false };
}

/** Where the mane's grid sits in his drawing space, and its size. */
const MANE_AT: Pt = [1, -26];
/**
 * The mane: flames licking up and back from behind his neck and head, `seed` its flicker, `big` roaring. Drawn behind
 * him, so only the tongues show, rooted along the back of his neck from the shoulders up behind his ears.
 */
function mane(seed: number, big = false): Part {
  const cv = canvas(26, 58);
  const roots: Pt[] = [[23, 27], [22, 22], [21, 17], [19, 12], [18, 7], [17, 2], [15, -3], [12, -8], [11, -13]];
  roots.forEach(([rx, ry], n) => {
    const hsh = ((n + 3) * 2654435761 + seed * 977) >>> 0;
    const th = (big ? 11 : 8) + (hsh % 3);
    const tw = (big ? 6 : 5) + ((hsh >>> 4) % 2);
    const tongue = flame(tw, th, seed * 1.3 + n * 2.2, big ? -6 : -5).grid;
    tongue.forEach((row, y) =>
      [...row].forEach((k, x) => {
        if (k === ".") return;
        const X = rx - MANE_AT[0] - tw + 2 + x;
        const Y = ry - MANE_AT[1] - th + 2 + y;
        const cur = cv[Y]?.[X];
        if (cur === undefined) return;
        if (cur === "." || "RFfYy".indexOf(k) > "RFfYy".indexOf(cur)) cv[Y]![X] = k;
      }),
    );
  });
  return { grid: toGrid(cv), outline: false };
}

// ---- Parts.

const PARTS: Record<string, Part> = { shadow, hoofL: hoof(-1), hoofR: hoof(1) };

/**
 * His torso and neck as one part (one outline round both, no seam where the neck meets the shoulders), the neck's
 * top `nx`, `ny` pixels from where it rests (his head nodding). Painted once per neck position.
 */
const BODIES = new Map<string, Painted>();
function bodyPart(nx: number, ny: number): { name: string; at: Pt } {
  const name = `body:${nx},${ny}`;
  let l = BODIES.get(name);
  if (!l) {
    const neck = paintLimb([[27, 27], [25, 18], [22, 8], [NECK_TOP[0] + nx, NECK_TOP[1] + ny]], 3.6, { spotEvery: 5, spotFrom: 1.5 });
    const x0 = Math.min(neck.at[0], TORSO_AT[0]);
    const y0 = Math.min(neck.at[1], TORSO_AT[1]);
    const tg = torso.grid;
    const w = Math.max(neck.at[0] + neck.part.grid[0]!.length, TORSO_AT[0] + tg[0]!.length) - x0;
    const h = Math.max(neck.at[1] + neck.part.grid.length, TORSO_AT[1] + tg.length) - y0;
    const cv = canvas(w, h);
    stamp(cv, neck.part.grid, neck.at[0] - x0, neck.at[1] - y0, true);
    stamp(cv, tg, TORSO_AT[0] - x0, TORSO_AT[1] - y0, true);
    l = { part: { grid: toGrid(cv) }, at: [x0, y0] };
    BODIES.set(name, l);
    PARTS[name] = l.part;
  }
  return { name, at: l.at };
}
const MOODS: readonly Mood[] = ["grin", "laugh", "roar", "shout", "hurt", "smug", "rattled", "think", "out"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);
for (const s of [0, 1, 2]) {
  PARTS[`mane:${s}`] = mane(s);
  PARTS[`maneBig:${s}`] = mane(s, true);
  PARTS[`horn:${s}`] = flame(6, 9, s * 1.9 + 0.4, s === 1 ? 1 : -1);
  PARTS[`hornBig:${s}`] = flame(8, 13, s * 1.9 + 0.4, s === 1 ? 1.5 : -1.5);
  PARTS[`tail:${s}`] = flameTuft(10, 13, s, -1.5 + s, 3);
  PARTS[`tailBig:${s}`] = flameTuft(12, 17, s, -1.5 + s, 4);
}

/** A puff of smoke (his flames gone out), `seed` its shape. */
function puff(seed: number): Part {
  const cv = canvas(6, 5);
  ellipse(cv, 3, 2.6, 2.6 + (seed % 2) * 0.4, 2.1, "G");
  ellipse(cv, 2.4 + (seed % 3) * 0.3, 2, 1.5, 1.3, "g");
  return { grid: toGrid(cv), outline: false };
}
for (const s of [0, 1, 2]) PARTS[`puff:${s}`] = puff(s);
/** A wall of flame round his feet as he lands in it (entrance, the Roman candle), roaring then dying down. */
PARTS["burst:0"] = flameTuft(50, 16, 3, 0, 9);
PARTS["burst:1"] = flameTuft(46, 9, 5, 0, 8);

/** The Roman candle: a cardboard tube, red and cream stripes, two blue bands, a grey end. Upright. */
PARTS.candle = (() => {
  const cv = canvas(6, 20);
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 6; x++)
      cv[y]![x] = y === 0 ? (x === 0 || x === 5 ? "W" : "w") : y === 4 || y === 5 || y === 13 || y === 14 ? (x < 3 ? "v" : "V") : (x + y) % 4 < 2 ? (x >= 4 ? "m" : "q") : x >= 4 ? "U" : "t";
  return { grid: toGrid(cv) };
})();

const LIMBS = new Map<string, Painted>();
type LimbKind = "arm" | "leg" | "neck" | "tail";
function limb(kind: LimbKind, pts: readonly Pt[]): { name: string; at: Pt } {
  const name = `${kind}:${pts.map((p) => p.join(",")).join(";")}`;
  let l = LIMBS.get(name);
  if (!l) {
    l =
      kind === "arm"
        ? paintLimb(pts, 2.3, { fist: true, endR: 2.9, spotEvery: 5 })
        : kind === "leg"
          ? paintLimb(pts, 2.7, { spotEvery: 5.4 })
          : kind === "neck"
            ? paintLimb(pts, 3.7, { spotEvery: 4.2, spotFrom: 1.5 })
            : paintLimb(pts, 1.1, { spotEvery: 99 });
    LIMBS.set(name, l);
    PARTS[name] = l.part;
  }
  return { name, at: l.at };
}

/** A sparkler's wire from the fist to its burning tip (1 pixel, outlined). */
const WIRES = new Map<string, Painted>();
function wire(from: Pt, to: Pt): { name: string; at: Pt } {
  const name = `wire:${from.join(",")}:${to.join(",")}`;
  let l = WIRES.get(name);
  if (!l) {
    const x0 = Math.min(from[0], to[0]);
    const y0 = Math.min(from[1], to[1]);
    const cv = canvas(Math.abs(to[0] - from[0]) + 1, Math.abs(to[1] - from[1]) + 1);
    // A Bresenham line; its last two pixels (the tip) glow.
    let [x, y] = [from[0] - x0, from[1] - y0];
    const [x1, y1] = [to[0] - x0, to[1] - y0];
    const dx = Math.abs(x1 - x);
    const dy = -Math.abs(y1 - y);
    const sx = x < x1 ? 1 : -1;
    const sy = y < y1 ? 1 : -1;
    let err = dx + dy;
    const path: Pt[] = [];
    for (;;) {
      path.push([x, y]);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) (err += dy), (x += sx);
      if (e2 <= dx) (err += dx), (y += sy);
    }
    path.forEach(([px, py], i) => (cv[py]![px] = i >= path.length - 2 ? "f" : i % 3 === 2 ? "W" : "w"));
    l = { part: { grid: toGrid(cv) }, at: [x0, y0] };
    WIRES.set(name, l);
    PARTS[name] = l.part;
  }
  return { name, at: l.at };
}

// ---- Poses.

/** Where his own drawing space (56 x 60, the ground at y 60) sits on the frame (with room above for jumps and rockets). */
const OX = 20;
const OY = 58;
const GROUND = 60;

/** An arm: shoulder, elbow, fist, and the sparkler's direction and length from the fist (0: no sparkler shown). */
interface ArmSpec {
  pts: readonly [Pt, Pt, Pt];
  dir: Pt;
  len: number;
  /** Drawn behind the torso. */
  back?: boolean;
}
const SHOULDER_A: Pt = [26, 28];
const SHOULDER_B: Pt = [34, 27];

/** The arm on his far side (his right), the sparkler up by his face, as in the reference. */
export type ArmA = "cross" | "high" | "chin" | "flick" | "pump" | "down" | "candle";
const ARM_A: Record<ArmA, ArmSpec> = {
  cross: { pts: [[30, 28], [39, 34], [38, 25]], dir: [0.4, -1], len: 11, back: true },
  high: { pts: [[25, 27], [16, 20], [13, 8]], dir: [-0.3, -1], len: 11, back: true },
  chin: { pts: [SHOULDER_A, [33, 31], [28, 17]], dir: [0.9, -1], len: 8 },
  flick: { pts: [[30, 28], [39, 33], [46, 32]], dir: [1, 0.3], len: 11, back: true },
  pump: { pts: [[25, 27], [16, 26], [13, 16]], dir: [-0.45, -1], len: 11, back: true },
  down: { pts: [[29, 28], [31, 35], [34, 41]], dir: [0.5, 1], len: 7, back: true },
  candle: { pts: [SHOULDER_A, [35, 30], [42, 17]], dir: [0, -1], len: 0 },
};
/** The arm on his near side (his left), held out to the side, the sparkler up and out. */
export type ArmB = "out" | "high" | "wind" | "flick" | "hip" | "point" | "down" | "show" | "candle";
const ARM_B: Record<ArmB, ArmSpec> = {
  out: { pts: [SHOULDER_B, [44, 37], [49, 30]], dir: [0.6, -1], len: 11 },
  high: { pts: [SHOULDER_B, [42, 22], [44, 12]], dir: [0.3, -1], len: 11 },
  wind: { pts: [SHOULDER_B, [42, 24], [40, 15]], dir: [-0.5, -1], len: 11 },
  flick: { pts: [SHOULDER_B, [42, 33], [50, 35]], dir: [1, 0.45], len: 11 },
  hip: { pts: [SHOULDER_B, [41, 33], [38, 39]], dir: [1, 0.8], len: 7 },
  point: { pts: [SHOULDER_B, [42, 31], [51, 29]], dir: [1, -0.2], len: 11 },
  down: { pts: [SHOULDER_B, [40, 36], [42, 42]], dir: [0.5, 1], len: 7 },
  show: { pts: [SHOULDER_B, [44, 31], [46, 19]], dir: [0, -1], len: 0 },
  candle: { pts: [SHOULDER_B, [41, 24], [43, 11]], dir: [0, -1], len: 0 },
};

export type Feet = "stand" | "wide" | "narrow" | "stepR" | "kick";
const FEET: Record<Feet, [Pt, Pt]> = {
  stand: [[12, 57], [45, 57]],
  wide: [[8, 57], [49, 57]],
  narrow: [[17, 57], [40, 57]],
  stepR: [[12, 57], [48, 54]],
  kick: [[12, 57], [50, 49]],
};

/** Where the Roman candle stands (its top-left, upright) when he shows it off and when he fires it. */
const CANDLE: Record<"show" | "aim", Pt> = { show: [44, 6], aim: [41, -3] };

export interface GrexPose {
  /** Off the ground (a jump), the whole of him. */
  air?: number;
  /** Down at the hips, hooves planted. */
  crouch?: number;
  /** Head, neck, body and arms down a pixel (a bob to the beat). */
  bob?: number;
  /** Sideways, the whole of him. */
  dx?: number;
  mood?: Mood;
  /** The head on the neck: a nod forward (dx), up or down (dy). */
  headDx?: number;
  headDy?: number;
  a?: ArmA;
  b?: ArmB;
  feet?: Feet;
  /** The flames' flicker shape (any number; 0-2 by remainder) and whether they roar (bigger). */
  flick?: number;
  big?: boolean;
  /** His flames gone out: smoke puffs where they were (defeat). */
  smoking?: boolean;
  /** Sparklers lit (spitting sparks), seeded per frame. False: out. */
  lit?: boolean;
  /** A hand with no sparkler (thrown, or not drawn yet). */
  empty?: "b" | "both";
  /** The Roman candle: shown off in one hand, or held up in both and fired. */
  candle?: "show" | "aim";
  /** A wall of flame round his feet (0 roaring, 1 dying down). */
  burst?: 0 | 1;
}

interface Built {
  layers: Layer[];
  /** Where each lit sparkler's tip is, in frame pixels (its sparks come from there). */
  tips: Pt[];
}

export function grexBuild(p: GrexPose): Built {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const crouch = p.crouch ?? 0;
  const body = crouch + (p.bob ?? 0) - air;
  const hips = crouch - air;
  const fl = ((p.flick ?? 0) % 3 + 3) % 3;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX + x + dx, y: OY + y });
  const L = (l: { name: string; at: Pt }) => at(l.name, l.at[0], l.at[1]);
  const down = (pts: readonly Pt[], by = body): Pt[] => pts.map((q): Pt => [q[0], q[1] + by]);
  const [footL, footR] = FEET[p.feet ?? "stand"];
  const ankle = (f: Pt): Pt => [f[0], f[1] - 1 - air];
  // Legs bend at the knee, knees out (a wide, springy stance).
  const knee = (hip: Pt, f: Pt, out: number): Pt => [Math.round((hip[0] + f[0]) / 2 + out), Math.round((hip[1] + hips + f[1] - air) / 2 - 1)];
  const hipL: Pt = [24, 41];
  const hipR: Pt = [33, 41];
  const legL = limb("leg", [[hipL[0], hipL[1] + hips], knee(hipL, footL, -2), ankle(footL)]);
  const legR = limb("leg", [[hipR[0], hipR[1] + hips], knee(hipR, footR, 2), ankle(footR)]);
  const torsoNeck = bodyPart(p.headDx ?? 0, p.headDy ?? 0);
  const tailEnd: Pt = [8, 37 + hips + (fl === 1 ? 1 : 0)];
  const tail = limb("tail", [[21, 38 + hips], [15, 41 + hips], tailEnd]);
  const hx = NECK_TOP[0] - HEAD_SOCKET[0] + (p.headDx ?? 0);
  const hy = NECK_TOP[1] - HEAD_SOCKET[1] + body + (p.headDy ?? 0);
  const armA = p.candle === "aim" ? "candle" : (p.a ?? "cross");
  const armB = p.candle ? (p.candle === "aim" ? "candle" : "show") : (p.b ?? "out");
  const arms = [ARM_A[armA], ARM_B[armB]].map((spec, i) => {
    const pts = down(spec.pts);
    const arm = limb("arm", pts);
    const fist = pts[2]!;
    const n = Math.hypot(spec.dir[0], spec.dir[1]);
    const len = p.empty === "both" || (p.empty === "b" && i === 1) ? 0 : spec.len;
    // The wire starts at the far side of the fist and runs `len` pixels out.
    const from: Pt = [Math.round(fist[0] + (spec.dir[0] / n) * 2), Math.round(fist[1] + (spec.dir[1] / n) * 2)];
    const tip: Pt = [Math.round(fist[0] + (spec.dir[0] / n) * (len + 2)), Math.round(fist[1] + (spec.dir[1] / n) * (len + 2))];
    const w = len ? wire(from, tip) : null;
    return { spec, arm, w, len, tip: [OX + tip[0] + dx, OY + tip[1]] as Pt };
  });
  const [A, B] = arms as [(typeof arms)[0], (typeof arms)[0]];
  const big = p.big ? "Big" : "";
  const hornLayers = HORNS.map(([kx, ky], i) => {
    const part = p.smoking ? `puff:${(fl + i) % 3}` : `horn${big}:${(fl + i) % 3}`;
    const [fw, fh] = partSize(PARTS[part]!);
    return at(part, hx + kx + 1 - Math.floor(fw / 2), hy + ky - fh + 1);
  });
  const tailPart = p.smoking ? `puff:${fl}` : `tail${big}:${fl}`;
  const [tw, th] = partSize(PARTS[tailPart]!);
  const wireL = (a: typeof A) => (a.w ? [L(a.w)] : []);
  const candle = p.candle ? [at("candle", CANDLE[p.candle][0], CANDLE[p.candle][1] + body)] : [];
  return {
    layers: [
      at("shadow", 5, GROUND - 2),
      at(tailPart, tailEnd[0] - Math.floor(tw / 2), tailEnd[1] - th + 2),
      L(tail),
      ...(A.spec.back ? [...wireL(A), L(A.arm)] : []),
      L(legL),
      L(legR),
      at("hoofL", footL[0] - 4, footL[1] - air - 2),
      at("hoofR", footR[0] - 2, footR[1] - air - 2),
      ...(p.burst === undefined ? [] : [at(`burst:${p.burst}`, p.burst ? 5 : 3, GROUND - (p.burst ? 9 : 16) + 1)]),
      at(torsoNeck.name, torsoNeck.at[0], torsoNeck.at[1] + body),
      ...(p.smoking ? [] : [at(`mane${big}:${fl}`, MANE_AT[0], MANE_AT[1] + body)]),
      ...hornLayers,
      at(`head:${p.mood ?? "grin"}`, hx, hy),
      ...candle,
      ...(A.spec.back ? [] : [...wireL(A), L(A.arm)]),
      ...wireL(B),
      L(B.arm),
    ],
    tips: p.lit === false ? [] : arms.filter((a) => a.len).map((a) => a.tip),
  };
}

// ---- Sparks, embers, smoke, rockets: specks drawn on his frames.

/** A seeded random number generator (the same sparks every time a frame is drawn). */
function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}

/**
 * A sparkler's burning head spitting sparks: a white-hot core, four long rays (crossed or diagonal, turning frame to
 * frame) and a spray of loose sparks, seeded per frame, so it never fizzes the same way twice running.
 */
export function sparkSpray([x, y]: Pt, seed: number, size = 1): Speck[] {
  const rnd = seeded(seed);
  const out: Speck[] = [];
  const diag = seed % 2 === 1;
  const reach = Math.round(2 + size * 2 + rnd() * 1.5);
  const rays: readonly Pt[] = diag ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of rays)
    for (let d = 1; d <= reach; d++) out.push([x + dx * d, y + dy * d, d === reach ? "f" : d === 1 ? "y" : "Y"]);
  const n = Math.round(7 + 5 * size);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 2.5 + rnd() * 5 * size;
    const k = d > 5 * size ? "F" : d > 3.5 ? "f" : "Y";
    out.push([Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), k]);
  }
  out.push([x, y, "x"], [x + 1, y, "x"], [x, y - 1, "y"], [x - 1, y, "y"], [x, y + 1, "y"]);
  return out;
}

/** Embers drifting up (`t` frames in), seeded, around a column centred on `cx`. */
function embers(cx: number, yBase: number, t: number, n = 6, spread = 14, rise = 30): Speck[] {
  return Array.from({ length: n }, (_, i): Speck => {
    const h = ((i + 1) * 2654435761) >>> 0;
    const x = Math.round(cx + ((h % 100) / 100 - 0.5) * spread * 2 + Math.sin(t * 0.8 + i) * 1.5);
    const y = Math.round(yBase - ((((h >>> 7) % rise) + t * 2.5) % rise));
    return [x, y, i % 3 === 0 ? "Y" : i % 3 === 1 ? "f" : "F"];
  });
}

/** A thrown sparkler tumbling through the air: its wire (5 pixels at one of four angles) and its fizzing head. */
function thrown([x, y]: Pt, turn: number, seed: number): Speck[] {
  const dirs: Pt[] = [[1, 0], [1, 1], [0, 1], [-1, 1]];
  const [ux, uy] = dirs[turn % 4]!;
  const wire: Speck[] = [0, 1, 2, 3, 4].map((d): Speck => [x - ux * d, y - uy * d, d % 2 ? "W" : "w"]);
  return [...wire, ...sparkSpray([x + ux, y + uy], seed, 0.8)];
}

/** A little flame tongue as specks: `h` pixels tall, two wide at the base, hottest at the bottom. */
function tongue(x: number, yBase: number, h: number): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < h; i++) {
    const t = i / Math.max(1, h - 1);
    const k = t < 0.25 ? "y" : t < 0.5 ? "Y" : t < 0.8 ? "f" : "F";
    out.push([x, yBase - i, k]);
    if (t < 0.6) out.push([x + 1, yBase - i, t < 0.3 ? "Y" : "f"]);
  }
  out.push([x + (h % 2), yBase - h, "R"]);
  return out;
}

/** Flames bursting out round his feet as he lands (`r` how far). */
function flameRing(r: number, n = 12): Speck[] {
  return Array.from({ length: n }, (_, i): Speck[] => {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(OX + 28 + Math.cos(a) * r * 1.6);
    const y = Math.round(OY + GROUND - 2 + Math.sin(a) * r * 0.2);
    return tongue(x, y, 2 + ((i * 7 + r) % 4) + Math.round(r / 5));
  }).flat();
}

/** A fireball streaking down (his entrance): a white-hot core, flames and a ragged trail above it. */
function fireball(cx: number, cy: number): Speck[] {
  const out: Speck[] = [];
  for (let t = 4; t < 20; t++) {
    const w = Math.max(0, 3 - Math.floor(t / 6));
    for (let x = -w; x <= w; x++) if ((t + x) % 3 !== 0 || x === 0) out.push([cx + x + ((t * 7) % 3) - 1, cy - t, t < 8 ? "f" : t < 13 ? "F" : "R"]);
  }
  for (let y = -5; y <= 5; y++)
    for (let x = -5; x <= 5; x++) {
      const d = Math.hypot(x, y * 1.1);
      if (d <= 5.2) out.push([cx + x, cy + y, d < 1.8 ? "x" : d < 3 ? "y" : d < 4.2 ? "Y" : "f"]);
    }
  return out;
}

/** A shadow on the ground growing as he drops in (his drop to the board). */
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [OX + 28 - r + i, OY + GROUND - 1, "z"]);

/** Smoke wisps rising (`t` frames in) from a point. */
function wisps([x, y]: Pt, t: number, n = 3): Speck[] {
  return Array.from({ length: n }, (_, i): Speck[] => {
    const yy = y - ((t * 2 + i * 4) % 12);
    const xx = x + Math.round(Math.sin(t * 0.9 + i * 2) * 1.5);
    return [[xx, yy, i % 2 ? "g" : "G"], [xx + 1, yy - 1, "G"]];
  }).flat();
}

/** Rockets from the Roman candle: each a white-hot head and a sparkling trail, `age` frames after it left the muzzle. */
function rockets(muzzle: Pt, ages: readonly number[]): Speck[] {
  return ages.flatMap((age, n): Speck[] => {
    const y = Math.round(muzzle[1] - 4 - age * 13);
    const x = muzzle[0] + ((n * 5) % 3) - 1;
    if (y < 3) return [];
    const rim = (["Y", "f", "y"] as const)[n % 3]!;
    return [
      [x, y - 1, rim],
      [x - 1, y, rim],
      [x, y, "x"],
      [x + 1, y, "x"],
      [x + 2, y, rim],
      [x, y + 1, "x"],
      [x + 1, y + 1, "y"],
      [x + 1, y - 1, rim],
      ...[2, 3, 4, 5, 6, 7, 8, 9].map((d): Speck => [x + (d % 2), y + d, d < 4 ? "Y" : d < 6 ? "f" : d < 8 ? "F" : "R"]),
      [x - 1, y + 5, "Y"],
      [x + 2, y + 7, "f"],
      [x - 1, y + 9, "F"],
    ];
  });
}
/** The candle's muzzle flash. */
const muzzleFlash = ([x, y]: Pt, big: boolean): Speck[] => [
  [x, y, "x"],
  [x + 1, y, "x"],
  [x - 1, y, "y"],
  [x + 2, y, "y"],
  [x, y - 1, "y"],
  [x + 1, y - 1, "y"],
  [x - 1, y - 1, "f"],
  [x + 2, y - 1, "f"],
  ...(big ? ([[x - 2, y, "f"], [x + 3, y, "f"], [x, y - 2, "Y"], [x + 1, y - 2, "Y"]] as Speck[]) : []),
];

/** Sweat flying off him (rattled). */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [
    [OX + 9 - t, OY - 14 + t, "j"],
    [OX + 9 - t, OY - 13 + t, "x"],
    [OX + 33 + t, OY - 16 + t, "j"],
    [OX + 33 + t, OY - 15 + t, "x"],
  ];
};

const f = (ms: number, p: GrexPose, extra: Partial<Frame> = {}, seed = 0): Frame => {
  const b = grexBuild(p);
  const sparks = b.tips.flatMap((t, i) => sparkSpray(t, seed * 7 + i * 3 + 1, p.big ? 1.4 : 1));
  return { ms, layers: b.layers, ...extra, specks: [...sparks, ...(extra.specks ?? [])] };
};

/** Sparkler tips in a pose, in frame pixels (the ignite throw leaves from the outer one). */
export function sparklerTips(p: GrexPose): Pt[] {
  return grexBuild(p).tips;
}

// ---- Palette flashes.

/** His eyes flare: the pupils glow fiery orange, the glint white-hot. */
const EYES_HOT = { s: "#d8400e", e: "#ffffff" };
/** A white flash for the frame he's hit. */
const FLASH: Record<string, string> = { d: "#e9a24a", c: "#ffd27a", C: "#fff0b8", h: "#ffffff", o: "#e08a4a", O: "#c06a30" };

// ---- Animations.

/** The beat he bobs to while idle: [bob] per frame. */
const GROOVE = [0, 0, 1, 1, 0, 0, 1, 1] as const;

/**
 * Idle: he crackles. The flames flicker (three shapes, never in step), both sparklers spit sparks, and he bobs his
 * head to a beat only he can hear; every 6 s or so he twirls the outer sparkler over his head and laughs. Silent.
 */
const idle: Anim = {
  loop: true,
  frames: [
    ...Array.from({ length: 6 }, (_, n) => GROOVE.map((bob, i) => f(110, { bob, flick: n * 8 + i }, {}, n * 8 + i))).flat(),
    f(100, { b: "high", flick: 0, mood: "laugh" }, {}, 50),
    f(100, { b: "point", flick: 1, mood: "laugh" }, {}, 51),
    f(100, { b: "high", flick: 2, mood: "laugh", bob: 1 }, {}, 52),
    f(140, { flick: 0, mood: "grin" }, {}, 53),
  ],
};

/** Entrance: a fireball streaks down, bursts on the ground, and there he is, crouched in the flames; the sparklers fizz alight, he twirls one and strikes a pose. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: fireball(OX + 28, OY - 6), cue: "whoosh" },
    { ms: 80, layers: [], specks: fireball(OX + 28, OY + 22) },
    f(100, { crouch: 4, big: true, lit: false, feet: "wide", mood: "roar", flick: 0, burst: 0 }, { shake: [0, 1], specks: flameRing(8) }),
    f(100, { crouch: 2, big: true, lit: false, feet: "wide", mood: "grin", flick: 1, burst: 1 }, { specks: embers(OX + 28, OY + 50, 1, 8, 20) }),
    f(110, { big: true, flick: 2, mood: "grin" }, { cue: "fizz", specks: embers(OX + 28, OY + 48, 2, 8, 20) }, 1),
    f(100, { b: "high", flick: 3, mood: "laugh" }, { specks: embers(OX + 28, OY + 44, 3, 6, 20) }, 2),
    f(100, { b: "point", flick: 4, mood: "laugh" }, {}, 3),
    f(110, { a: "high", b: "high", big: true, flick: 5, mood: "laugh", crouch: 1 }, { pal: EYES_HOT }, 4),
    f(110, { a: "high", b: "high", big: true, flick: 6, mood: "laugh" }, {}, 5),
    f(320, { flick: 7 }, {}, 6),
  ],
};

/** Smoke-ring thoughts: little flames popping up beside his head, one by one. */
const thoughtFlames = (n: number, i: number): Speck[] =>
  ([[OX + 42, OY - 18], [OX + 47, OY - 23], [OX + 53, OY - 28]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const big = k === 2;
    return [[x, y, "Y"], [x, y - 1, (i + k) % 2 ? "f" : "y"], ...(big ? ([[x - 1, y, "f"], [x + 1, y, "f"], [x, y + 1, "F"], [x, y - 2, "F"]] as Speck[]) : [[x, y + 1, "F"] as Speck])];
  });
/** Thinking: a hoof scratching his long neck, eyes rolled up, tapping a foot, little flames for thoughts. */
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3].flatMap((n) => [0, 1, 2, 3].map((i) => f(130, { mood: "think", a: "chin", b: "down", feet: i % 2 ? "stepR" : "stand", bob: i === 2 ? 1 : 0, flick: n * 4 + i }, { specks: thoughtFlames(n, i) }, n * 4 + i))),
};

/** Smug: a fist on his hip, a brow up, eyes half shut, a slow nod. */
const smug: Anim = {
  loop: true,
  frames: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => f(150, { mood: "smug", b: "hip", bob: i % 4 === 1 ? 1 : 0, headDx: i < 4 ? 0 : 1, flick: i }, {}, i)),
};

/** Rattled: wide eyes and worried brows, sweat flying, shaking where he stands, the sparklers sputtering. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const b = grexBuild({ mood: "rattled", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, flick: i, a: "down", b: "down" });
    return { ms: 80, layers: b.layers, specks: [...b.tips.flatMap((t, k) => sparkSpray(t, i * 5 + k, 0.4)), ...sweat(i)] };
  }),
};

/** His move: a step towards the board and a flourish of the sparkler at it. */
const move: Anim = {
  loop: false,
  frames: [
    f(100, { crouch: 1, flick: 0 }, {}, 1),
    f(100, { feet: "stepR", b: "high", flick: 1 }, {}, 2),
    f(90, { crouch: 2, feet: "stepR", b: "point", mood: "shout", big: true, flick: 2 }, { cue: "fizz", shake: [0, 1] }, 3),
    f(130, { crouch: 1, feet: "stepR", b: "point", flick: 3 }, {}, 4),
    f(150, { feet: "stepR", b: "point", mood: "laugh", flick: 4 }, {}, 5),
    f(110, { crouch: 1, flick: 5 }, {}, 6),
    f(160, { flick: 6 }, {}, 7),
  ],
};

/** A capture: he laughs, bouncing, both sparklers up, his flames roaring. */
const capture: Anim = {
  loop: false,
  frames: [
    f(90, { crouch: 1, flick: 0 }, {}, 1),
    ...Array.from({ length: 12 }, (_, i) =>
      f(80, { mood: "laugh", a: "pump", b: "high", big: true, headDy: i % 2 ? -1 : 0, bob: i % 4 === 0 ? 1 : 0, air: i % 4 === 2 ? 2 : 0, flick: i + 1 }, i === 0 ? { cue: "crackle" } : { specks: embers(OX + 20, OY + 10, i, 5, 14, 24) }, i + 2),
    ),
    f(140, { mood: "smug", flick: 13 }, {}, 20),
  ],
};

/** Hurt: hit, he screws his eyes shut, embers knocked off, a flinch; then he shakes it off with a fist up and grins. */
const embersOff = (t: number): Speck[] =>
  [[-1, -1], [1, -1.4], [1.6, -0.6], [-1.7, -0.5], [0.5, -1.8]].flatMap(([vx, vy], i): Speck[] => {
    const x = Math.round(OX + 22 + vx! * t * 2.4);
    const y = Math.round(OY - 12 + vy! * t * 2.4 + 0.5 * t * t);
    return [[x, y, i % 2 ? "Y" : "f"], [x + 1, y, "F"]];
  });
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { crouch: 3, mood: "hurt", a: "down", b: "down", flick: 0 }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: embersOff(0) }, 1),
    f(80, { crouch: 3, mood: "hurt", a: "down", b: "down", flick: 1 }, { shake: [-1, 0], specks: embersOff(1) }, 2),
    f(90, { crouch: 2, mood: "hurt", a: "down", b: "down", dx: -1, flick: 2 }, { specks: embersOff(2) }, 3),
    f(100, { crouch: 1, mood: "rattled", dx: -1, flick: 3 }, { specks: embersOff(3) }, 4),
    f(110, { mood: "hurt", a: "pump", flick: 4 }, {}, 5),
    f(120, { mood: "grin", a: "pump", flick: 5 }, {}, 6),
    f(160, { mood: "grin", flick: 6 }, {}, 7),
  ],
};

/** Check: two jabs of both sparklers at the board, his flames flaring and his eyes glowing. */
const JAB: GrexPose = { crouch: 2, feet: "stepR", a: "flick", b: "flick", mood: "shout", big: true };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { crouch: 1, feet: "stepR", b: "high", flick: 0 }, {}, 1),
    f(110, { ...JAB, flick: 1 }, { cue: "whoosh", pal: EYES_HOT }, 2),
    f(90, { ...JAB, flick: 2, crouch: 1 }, {}, 3),
    f(110, { crouch: 1, feet: "stepR", b: "high", flick: 3 }, {}, 4),
    f(110, { ...JAB, flick: 4 }, { cue: "whoosh", pal: EYES_HOT }, 5),
    f(90, { ...JAB, flick: 5, crouch: 1 }, {}, 6),
    f(150, { feet: "stepR", b: "point", mood: "laugh", flick: 6 }, {}, 7),
    f(160, { mood: "smug", flick: 7 }, {}, 8),
  ],
};

/** Defeat: hit, his eyes cross, his flames go out in puffs of smoke, he totters and keels over (the last frame holds). */
function fallen(mood: Mood, t: number): Partial<Frame> & { layers: Layer[] } {
  const standing = grexBuild({ mood, smoking: true, lit: false, a: "down", b: "down", empty: "both", feet: "narrow", flick: t }).layers.filter((l) => l.part !== "shadow");
  // On his side, head to the right, his back on the ground, in the middle of the frame.
  const lying = lieDown(PARTS, { layers: standing }, 0, 0, "left").layers;
  const box = lying.map((l) => {
    const [w, h] = partSize(PARTS[l.part]!, l.rot ?? 0);
    return [l.x, l.y, l.x + w, l.y + h] as const;
  });
  const x0 = Math.min(...box.map((b) => b[0]));
  const x1 = Math.max(...box.map((b) => b[2]));
  const y1 = Math.max(...box.map((b) => b[3]));
  const sx = OX + 28 - Math.round((x0 + x1) / 2);
  const sy = OY + GROUND - 1 - y1;
  return { layers: [{ part: "shadow", x: OX + 5, y: OY + GROUND - 2 }, ...lying.map((l) => ({ ...l, x: l.x + sx, y: l.y + sy }))] };
}
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { crouch: 3, mood: "hurt", a: "down", b: "down", flick: 0 }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: embersOff(0) }, 1),
    f(90, { crouch: 2, mood: "out", a: "down", b: "down", dx: -1, smoking: true, lit: false }, { specks: [...wisps([OX + 22, OY - 22], 1)] }),
    f(110, { crouch: 1, mood: "out", dx: 1, smoking: true, lit: false, a: "down", b: "down" }, { specks: [...wisps([OX + 22, OY - 22], 2)] }),
    f(110, { crouch: 2, mood: "out", dx: 2, smoking: true, lit: false, a: "high", b: "high", empty: "both" }, { specks: [...wisps([OX + 22, OY - 22], 3)] }),
    { ms: 120, cue: "poof", shake: [0, 1], ...fallen("out", 0), specks: wisps([OX + 60, OY + 40], 0, 4) },
    { ms: 160, ...fallen("out", 1), specks: wisps([OX + 60, OY + 40], 1, 4) },
    { ms: 200, ...fallen("out", 2), specks: wisps([OX + 60, OY + 40], 2, 4) },
    { ms: 1000, ...fallen("out", 0), specks: wisps([OX + 60, OY + 40], 3, 2) },
  ],
};

/** Victory: jumping for joy, both sparklers high and roaring, embers everywhere. Then again. */
const victory: Anim = {
  loop: true,
  frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
    const air = [0, 3, 6, 7, 6, 3, 0, 0, 0, 0, 0, 0][i]!;
    return f(110, { mood: "laugh", a: "high", b: "high", big: true, air, crouch: i === 0 || i === 6 ? 2 : 0, feet: air > 3 ? "wide" : "stand", headDy: i % 2 ? -1 : 0, flick: i }, { specks: embers(OX + 28, OY + 50, i, 10, 26, 50), cue: i === 2 ? "fizz" : undefined, pal: air > 5 ? EYES_HOT : undefined }, i);
  }),
};

/**
 * His passive power, igniting a tile: he winds up the outer sparkler behind his head, it flares, and he throws it at
 * the board (the frame with the "throw" cue: it leaves his hand there, and the board's sparkFly takes over), laughs,
 * and a fresh sparkler fizzes alight in his hand.
 */
const THROW_FROM: Pt = [OX + 52, OY + 33];
const ignite: Anim = {
  loop: false,
  frames: [
    f(110, { crouch: 1, b: "wind", flick: 0 }, {}, 1),
    f(110, { crouch: 1, b: "wind", mood: "shout", big: true, flick: 1 }, { pal: EYES_HOT }, 2),
    f(80, { crouch: 2, feet: "stepR", b: "flick", mood: "shout", big: true, empty: "b", flick: 2 }, { cue: "throw", shake: [-1, 0], specks: thrown(THROW_FROM, 1, 3) }, 3),
    f(70, { crouch: 2, feet: "stepR", b: "flick", empty: "b", flick: 3 }, { specks: thrown([THROW_FROM[0] + 6, THROW_FROM[1] + 4], 2, 4) }, 4),
    f(70, { crouch: 1, feet: "stepR", b: "point", empty: "b", mood: "laugh", flick: 4 }, { specks: thrown([THROW_FROM[0] + 12, THROW_FROM[1] + 9], 3, 5) }, 5),
    f(120, { feet: "stepR", b: "point", empty: "b", mood: "laugh", flick: 5 }, {}, 6),
    f(120, { b: "out", empty: "b", mood: "laugh", flick: 6 }, {}, 7),
    f(110, { b: "out", mood: "grin", flick: 7 }, { cue: "fizz" }, 8),
    f(160, { mood: "grin", flick: 8 }, {}, 9),
  ],
};

/** The candle's top in a pose, in frame pixels (where its shots leave). */
const muzzle = (p: GrexPose): Pt => {
  const body = (p.crouch ?? 0) + (p.bob ?? 0) - (p.air ?? 0);
  const c = CANDLE[p.candle ?? "aim"];
  return [OX + c[0] + 2 + (p.dx ?? 0), OY + c[1] + body - 2];
};

/** The ultimate's warning: he pulls out the Roman candle, shows it off, taps it, and its fuse fizzes. */
const SHOW: GrexPose = { candle: "show", mood: "smug" };
const candleWarn: Anim = {
  loop: false,
  frames: [
    f(110, { crouch: 1, b: "down", flick: 0 }, {}, 1),
    f(120, { ...SHOW, flick: 1 }, {}, 2),
    f(120, { ...SHOW, headDx: 1, mood: "grin", flick: 2 }, {}, 3),
    f(100, { ...SHOW, a: "pump", mood: "laugh", flick: 3 }, { cue: "fizz", specks: sparkSpray(muzzle(SHOW), 4, 0.5) }, 4),
    f(100, { ...SHOW, a: "pump", mood: "laugh", bob: 1, flick: 4 }, { specks: sparkSpray(muzzle({ ...SHOW, bob: 1 }), 5, 0.5) }, 5),
    f(100, { ...SHOW, mood: "laugh", flick: 5 }, { specks: sparkSpray(muzzle(SHOW), 6, 0.4) }, 6),
    f(260, { ...SHOW, flick: 6 }, {}, 7),
  ],
};

/**
 * His ultimate, the Roman candle, played ON THE BOARD: his shadow grows, he drops onto the middle of the board in a
 * burst of flame with a roar, holds the candle up in both hooves and fires twelve shots into the sky, one every
 * 140 ms (the first frame of the volley has the "launch" cue, every shot a "shot" cue), then laughs. The last frame
 * holds until he's taken off.
 */
const AIM: GrexPose = { candle: "aim", mood: "grin", big: true, feet: "wide" };
const SHOTS = 12;
const romanCandle: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: dropShadow(4), cue: "whoosh" },
    { ms: 100, layers: [], specks: dropShadow(9) },
    f(80, { air: 22, candle: "show", mood: "laugh", feet: "wide", big: true, flick: 0 }, {}, 1),
    f(80, { air: 12, candle: "show", mood: "laugh", feet: "wide", big: true, flick: 1 }, {}, 2),
    f(110, { crouch: 4, candle: "show", mood: "roar", feet: "wide", big: true, flick: 2, burst: 0 }, { cue: "roar", shake: [0, 1], specks: flameRing(9, 14), pal: EYES_HOT }, 3),
    f(110, { crouch: 3, candle: "show", mood: "roar", feet: "wide", big: true, flick: 3, burst: 1 }, { specks: embers(OX + 28, OY + 50, 1, 10, 26), pal: EYES_HOT }, 4),
    f(120, { crouch: 2, candle: "show", mood: "roar", feet: "wide", big: true, flick: 4 }, { specks: embers(OX + 28, OY + 46, 2, 10, 26) }, 5),
    f(120, { ...AIM, crouch: 1, flick: 5 }, { specks: sparkSpray(muzzle({ ...AIM, crouch: 1 }), 6, 0.4) }, 6),
    ...Array.from({ length: SHOTS * 2 }, (_, i) => {
      const shot = Math.floor(i / 2);
      const kick = i % 2 === 0;
      const p: GrexPose = { ...AIM, crouch: kick ? 1 : 0, flick: 6 + i, mood: shot > 5 ? "laugh" : "grin" };
      const ages = Array.from({ length: shot + 1 }, (_, n) => (i - n * 2) / 2 + 0.5).filter((a) => a >= 0);
      return f(70, p, { cue: kick ? (shot === 0 ? "launch" : "shot") : undefined, specks: [...(kick ? muzzleFlash(muzzle(p), shot % 3 === 0) : []), ...rockets(muzzle(p), ages)], pal: kick && shot % 4 === 0 ? EYES_HOT : undefined }, 10 + i);
    }),
    f(140, { ...AIM, mood: "laugh", flick: 31 }, { specks: [...rockets(muzzle(AIM), [12.5, 13]), ...wisps(muzzle(AIM), 1)] }, 40),
    f(140, { ...AIM, mood: "laugh", headDy: -1, flick: 32 }, { specks: wisps(muzzle(AIM), 2) }, 41),
    f(400, { ...AIM, mood: "grin", flick: 33 }, { specks: wisps(muzzle(AIM), 3, 2) }, 42),
  ],
};

export const GREX: Character = {
  id: "grex",
  name: "G-REX",
  w: OX + 56 + 24,
  h: OY + GROUND + 4,
  foot: [OX + 28, OY + GROUND],
  palette: GREX_PALETTE,
  halo: "#2e2218",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, ignite, candleWarn, romanCandle },
};

/** The part of him a portrait shows (his head and flaming ossicones), in frame pixels. */
export const GREX_PORTRAIT = { x: OX + 5, y: OY - 28, w: 38, h: 32 } as const;

/**
 * His lines: a cocky show-off with fire puns and the odd dinosaur joke (a giraffe named like a T-Rex), short, never
 * instructions, rare (each moment's chance of a line is in GREX_CHANCE). `power` is a tile set alight (the sparkler
 * thrown), `powerHit` a piece burnt up, `ultimateWarn` the Roman candle coming, `ultimate` its launch, `ultimateHit`
 * the fireballs coming down.
 */
export const GREX_LINES: Partial<Record<Beat, readonly string[]>> = {
  entrance: ["G-REX in the house!", "Feel the heat!", "Rawr! I mean… hi.", "Hot stuff coming through!"],
  move: ["Sizzlin'!", "Too hot to handle?", "Smokin'!", "Watch and learn."],
  capture: ["Toast!", "Extra crispy!", "Burnt to a crisp!", "Well done. Very well done."],
  check: ["Check! Feeling warm?", "Your king's toast!", "Hot seat, your majesty!", "Check! Getting hot?"],
  hurt: ["Hey! Not the face!", "Ow! That's hot!", "You singed me!", "Rude!"],
  thinking: ["Let it simmer…", "Slow roast…", "Warming up…"],
  smug: ["Too hot to handle?", "Tiny arms? Not me!", "Burn, baby, burn!", "Neck and neck? Nope!"],
  rattled: ["Is it hot in here?", "My neck's sweating!", "Not cool. Not cool!"],
  defeat: ["Burnt out…", "Extinct… again…", "My flame… fizzled…"],
  victory: ["Too hot for you!", "Rawr! Champion!", "Hottest neck in town!", "Fire it up!"],
  strike: ["Torched!", "Flame on!"],
  power: ["Catch!", "Hot potato!", "Light it up!", "Heads up!", "Spark it!"],
  powerHit: ["Toasty!", "Ashes to ashes!", "Poof! Crispy!", "Smells like victory!"],
  ultimateWarn: ["Got a big one for you…", "Wanna see a trick?", "Lighting the fuse…", "Big bang coming…"],
  ultimate: ["ROMAN CANDLE!", "Fireworks time!", "Ooh! Aah! Ha!", "Look up! Way up!"],
  ultimateHit: ["Incoming!", "It's raining fire!", "Hot rain! Ha!", "Here they come!"],
};
export const GREX_CHANCE: Partial<Record<Beat, number>> = {
  entrance: 1,
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
  powerHit: 0.7,
  ultimateWarn: 1,
  ultimate: 1,
  ultimateHit: 0.6,
};
