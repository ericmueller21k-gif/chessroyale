/**
 * Birdie's Station's birds at the bar (Nov 26; docs/decisions/2026-11-26-birdie-room-birds.md). Eric: "I want like 50 birds at the bar ...
 * they're all nibbling on bird feed, and it's like a cycle ... a fixed script where when they all like fly, kind of keep flying back and
 * forth onto the bar, and the bartender keeps scooping up more bird feed ... and then they nibble on it ... some sitting on the chairs that
 * jump up on the table, and then they fly away ... if you run up to the bar, then they all fly away, and then they don't come back for a
 * little bit ... they fly up into the ceiling and kind of disappear onto the left and right of the room ... then gradually flying back in."
 *
 * The room's scene (ShopRoom's RoomFx, given by Town.tsx as the room loads), kept simple and cheap (Eric: "easier code and less lag"):
 * - **One sheet, baked once** (the first time the room loads, behind its fade, and kept for the page): one small bird drawn in nine poses
 *   (idle, a look up, two pecks, a crouch and a hop, three wingbeats), in four colors (two mourning doves, two sparrows), each facing both
 *   ways, and the run's seed piles in three sizes. Nothing is drawn into a canvas while you're in the room.
 * - **A fixed loop each** (`SHOP_FEEL.birds.seed`): every bird has a home (on the bar's run or arms, on the floor by the stools, or on a
 *   stool) and a loop of legs made once, as the room loads: sit and peck in bouts, a little hop along the bar and back, off up into the
 *   ceiling to its side of the room, away a while, back in to its home; a stool bird hops up onto the bar first. Where a bird is is a pure
 *   function of the clock (`poseAt`): no randomness while you watch.
 * - **The bartender's scoop**: his idle (sidekick-sheets.ts `birdiebartender`, 5.1 s) dips in the vat and pours; each pour fills the next
 *   of the run's seed piles, which is then eaten down. A run bird pecks while its nearest pile has seed (the art's own heap always has).
 * - **You at the bar**: within `nearSquares` of it, every bird flies up and away from where it is; none come back until `scatterAwayMs`
 *   after you've gone, then they fly back in a few at a time over `returnSpreadMs`, each to where its loop has it then.
 * - **One draw pass**: the piles, then the birds far to near, all from the one sheet, drawn as one figure among the room's pieces (z 5.5:
 *   after the front stools' row, before the crossing gate's), so the gates and you in front draw over them.
 *
 * Positions are the art's picture's pixels (the 444 x 527 lobby, birdie-lobby-art.ts) and the room row the thing stands on (`R`), drawn as
 * the room draws a piece: its foot at that row's middle, the picture keeping the art's pixel place round it. On the bar's arms (counters,
 * standing in slices along their depth) the row is the arm top's own depth, 36 px up; on the run, row 4; on a stool, its row; on the floor,
 * where the bird stands.
 */
import { renderFrame, type Character, type Frame, type Part } from "../../characters/sprite.ts";
import { canvas, ellipse, poly, toGrid, type Canvas } from "../../characters/paint.ts";
import { newPt, proj } from "../camera.ts";
import { SHOP_FEEL } from "../feel.ts";
import { SIDEKICK_SHEETS } from "../sidekick-sheets.ts";
import { testSwitchesAllowed } from "../../test-switches.ts";
import { SHOP_BIRDIE_SQUARE as T, SHOP_BIRDIE_WALL as Y0 } from "./birdie-lobby-art.ts";
import type { FxDraw, RoomFx } from "./ShopRoom.tsx";

const F = SHOP_FEEL.birds;

// ---------------------------------------------------------------- the sheet

/** The poses, in the sheet's columns. */
export const BIRD_POSES = ["idle", "look", "peck", "peck2", "crouch", "air", "up", "level", "down"] as const;
type PoseName = (typeof BIRD_POSES)[number];
const PI = Object.fromEntries(BIRD_POSES.map((p, i) => [p, i])) as Record<PoseName, number>;
const FLAP = [PI.up, PI.level, PI.down, PI.level] as const;
/** A cell of the sheet (a bird's part, 16 x 11, inside its outline), and the bird's feet in it. */
const CW = 18;
const CH = 14;
const FOOT_X = 8;
const FOOT_Y = 12;
/** The colors (B body, C breast, D wing and tail, F wing marks, H head, b beak, E feet; k the outline, the art's dark brown). */
export const BIRD_LOOKS: readonly Readonly<Record<string, string>>[] = [
  { B: "#b09684", C: "#d9c3ab", D: "#8a735f", F: "#2e2622", H: "#a39791", b: "#3b302c", E: "#c77d7d" }, // a mourning dove
  { B: "#c0a893", C: "#e6d6c2", D: "#9a836d", F: "#3a302a", H: "#b4a89f", b: "#3b302c", E: "#c77d7d" }, // a paler dove
  { B: "#9a6a40", C: "#ddcfb2", D: "#5c3a20", F: "#efe2c6", H: "#8e9196", b: "#e0a33d", E: "#d9a066" }, // a house sparrow (gray crown)
  { B: "#a87b50", C: "#cfc0a3", D: "#6a4428", F: "#f0e4c8", H: "#b2683a", b: "#e0a33d", E: "#d9a066" }, // a sparrow (rufous cap)
];

/** One pose of the bird, facing west (its beak on the left), its feet on row 10. */
function birdGrid(p: PoseName): Canvas {
  const cv = canvas(16, 11);
  const fly = p === "up" || p === "level" || p === "down";
  const dy = p === "crouch" ? 1 : fly ? -1 : 0;
  const head = p === "peck" ? [3.2, 6.6] : p === "peck2" ? [2.8, 8.0] : p === "look" ? [4.3, 2.8] : [4.3, 3.6 + dy];
  const tailUp = p === "peck" || p === "peck2";
  poly(cv, tailUp ? [[11, 5], [15.5, 2], [15.5, 4], [12, 7.5]] : [[11, 6 + dy], [15.5, 4.5 + dy], [15.5, 6.5 + dy], [12, 8.5 + dy]], "D");
  ellipse(cv, 8.6, 6.6 + dy, 4.4, 2.7, "B");
  ellipse(cv, 6.6, 7.3 + dy, 2.5, 1.9, "C");
  if (p === "up") poly(cv, [[7, 6], [9.5, -0.5], [12.5, -0.5], [11, 6]], "D");
  else if (p === "level") ellipse(cv, 10, 5.6, 5.8, 1.3, "D");
  else if (p === "down") poly(cv, [[7, 6], [8.5, 11], [11.5, 11], [11, 6]], "D");
  else ellipse(cv, 9.8, p === "air" ? 5.2 : 5.9 + dy, 3.2, p === "air" ? 2.1 : 1.6, "D");
  if (!fly) {
    cv[Math.round(5.6 + dy)]![9] = "F";
    cv[Math.round(5 + dy)]![11] = "F";
  }
  ellipse(cv, head[0]!, head[1]!, 2.2, 1.9, "H");
  const hx = Math.floor(head[0]!);
  const hy = Math.floor(head[1]!);
  cv[hy - 1]![hx - 1] = "k";
  cv[hy]![hx - 3] = "b";
  cv[hy]![hx - 2] = "b";
  if (p !== "air" && !fly) {
    const leg = p === "crouch" ? [10] : [9, 10];
    for (const y of leg) {
      cv[y]![7] = "E";
      cv[y]![9] = "E";
    }
  }
  return cv;
}
/** A seed pile on the bar, `size` 3 (fresh) to 1 (nearly gone). */
function pileGrid(size: number): Canvas {
  const [w, h] = size === 3 ? [12, 5] : size === 2 ? [9, 4] : [6, 3];
  const cv = canvas(16, 11);
  const cx = 8;
  const base = 10;
  for (let y = base - h + 1; y <= base; y++)
    for (let x = Math.floor(cx - w / 2); x < Math.ceil(cx + w / 2); x++) {
      const nx = (x + 0.5 - cx) / (w / 2);
      const ny = (base + 1 - (y + 0.5)) / h;
      if (nx * nx + ny * ny > 1) continue;
      const n = (x * 7 + y * 13 + size * 5) % 9;
      cv[y]![x] = n < 2 ? "q" : n < 5 ? "Z" : "r";
    }
  return cv;
}
const PILE_PAL = { Z: "#7a4a22", r: "#a8743c", q: "#d8b067" };

/** The sheet's rows: each look facing west, then east; then the piles (columns 0 to 2: sizes 1 to 3). */
const PILE_ROW = BIRD_LOOKS.length * 2;
/** The sheet's pixels (pure: the tests and previews read them): every look's poses facing west, then east, then the piles. */
export function sheetPixels(): { w: number; h: number; data: Uint8ClampedArray } {
  const parts: Record<string, Part> = {};
  for (const p of BIRD_POSES) parts[p] = { grid: toGrid(birdGrid(p)) };
  for (const s of [1, 2, 3]) parts[`pile${s}`] = { grid: toGrid(pileGrid(s)), outline: false };
  const ch: Character = { id: "shop-birdie-bird", name: "Birdie's birds", w: CW, h: CH, foot: [FOOT_X, FOOT_Y], palette: { k: "#3a2c26", ...BIRD_LOOKS[0], ...PILE_PAL }, parts, anims: {} };
  const w = CW * BIRD_POSES.length;
  const h = CH * (PILE_ROW + 1);
  const data = new Uint8ClampedArray(w * h * 4);
  const put = (part: string, pal: Readonly<Record<string, string>>, flip: boolean, col: number, row: number) => {
    const fr: Frame = { ms: 0, pal, layers: [{ part, x: 1, y: 1, ...(flip ? { flipX: true } : {}) }] };
    const f = renderFrame(ch, fr);
    for (let y = 0; y < f.h; y++) data.set(f.data.subarray(y * f.w * 4, (y + 1) * f.w * 4), ((row * CH + y) * w + col * CW) * 4);
  };
  BIRD_LOOKS.forEach((look, l) => BIRD_POSES.forEach((p, i) => [false, true].forEach((flip, f) => put(p, look, flip, i, l * 2 + f))));
  [1, 2, 3].forEach((s) => put(`pile${s}`, PILE_PAL, false, s - 1, PILE_ROW));
  return { w, h, data };
}
let sheet: HTMLCanvasElement | null = null;
/** The sheet, drawn the first time the room loads (behind its fade) and kept for the page: one canvas, 162 x 126. */
export function birdSheet(): HTMLCanvasElement {
  if (sheet) return sheet;
  const { w, h, data } = sheetPixels();
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  sheet = c;
  return c;
}

// ---------------------------------------------------------------- the room's places (the art's pixels)

/** Where a bird stands: its feet in the art's picture (x, Y), the room row it stands on (R), what's there to peck. */
export interface Spot {
  x: number;
  Y: number;
  R: number;
  /** "run": the bar's front run; "arm": an arm's top (its feeders); "floor": spilled seed by the stools; "stool": a seat (nothing). */
  on: "run" | "arm" | "floor" | "stool";
  /** (The run) its nearest seed pile (PILES), or -1: the art's own heap, always full. */
  pile: number;
}
const rowMid = (R: number) => Y0 + (R + 0.5) * T;
/** A spot on the arms' tops (their depth's row, 36 px under the top), the floor (where it stands), the run (row 4) or a stool (its row). */
const spot = (on: Spot["on"], x: number, Y: number, R = on === "arm" ? (Y + 36 - Y0) / T - 0.5 : on === "floor" ? (Y - Y0) / T - 0.5 : 4, pile = -1): Spot => ({ x, Y, R, on, pile });
/** The bar's run's top, clear of the crate (x 229 to 259) and the pour's feeder (274 to 292) by a bird's half width: its feet's band. */
const RUN_X: readonly (readonly [number, number])[] = [[189, 222], [266, 268], [298, 330]];
const RUN_Y = [201, 226] as const;
/** The arms' tops (x), the floor beside the stools west and east (x), their depth (Y). */
const ARM_X: readonly (readonly [number, number])[] = [[190, 218], [300, 328]];
const ARM_Y = [92, 190] as const;
const FLOOR_X: readonly (readonly [number, number])[] = [[138, 160], [357, 382]];
const FLOOR_Y = [176, 228] as const;
/** The stools (the art's: the arms' along their outsides, rows 1 to 3; the run's four on row 5): a bird on the seat, 29 px over its foot. */
const STOOLS: readonly Spot[] = [
  ...[1, 2, 3].flatMap((r) => [spot("stool", 176, Y0 + 37 * r + 4, r), spot("stool", 342, Y0 + 37 * r + 4, r)]),
  ...[5, 6, 7, 8].map((c) => spot("stool", 37 * c + 18, 272, 5)),
];
/** Where each stool's bird hops up to: the arm top beside it, or the run's front lip before it. */
const VISITS: readonly Spot[] = [
  ...[1, 2, 3].flatMap((r) => [spot("arm", 194, Y0 + 37 * r - 14), spot("arm", 324, Y0 + 37 * r - 14)]),
  ...[5, 6, 7, 8].map((c) => spot("run", [203, 226, 266, 314][c - 5]!, 226)),
];
/** The run's seed piles the bartender fills in turn (their feet). The art's own heap (x 294 to 318) stays full. */
export const PILES: readonly { x: number; Y: number }[] = [
  { x: 198, Y: 214 },
  { x: 266, Y: 224 },
  { x: 216, Y: 225 },
  { x: 326, Y: 213 },
];
const ART_HEAP = { x: 306, Y: 218 };
/** A run spot's pile: the nearest, or -1 when the art's heap is nearer. */
const pileOf = (x: number, Y: number) => {
  let best = -1;
  let d = Math.hypot(x - ART_HEAP.x, Y - ART_HEAP.Y);
  PILES.forEach((p, i) => {
    const e = Math.hypot(x - p.x, Y - p.Y);
    if (e < d) [best, d] = [i, e];
  });
  return best;
};
for (const v of VISITS) if (v.on === "run") v.pile = pileOf(v.x, v.Y);

/** A seeded random number in [0, 1) (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the loops

const SIT = 0;
const HOP = 1;
const OUT = 2;
const AWAY = 3;
const IN = 4;
/** A leg of a bird's loop: what (SIT ...), when it ends (ms into the loop), from where to where, which way it faces. */
interface Leg {
  k: number;
  end: number;
  a: Spot;
  b: Spot;
  face: 1 | -1;
}
export interface Bird {
  home: Spot;
  /** Its colors (BIRD_LOOKS). */
  look: number;
  /** Its side of the room: up and away to the west (-1) or the east (1). */
  side: 1 | -1;
  legs: Leg[];
  /** The loop's length, and where in it this bird is at the clock's 0. */
  loop: number;
  off: number;
  /** Its peck bouts: a bout and a rest, and where in it it starts. */
  bout: number;
  boutOff: number;
}
/** The flock's homes, in turn round the places (so a smaller `count` thins them all alike): the run, the arms, the floor, the stools. */
function homes(r: () => number): { home: Spot; visit: Spot | null }[] {
  const pick = (xs: readonly (readonly [number, number])[], ys: readonly [number, number], on: Spot["on"], n: number, taken: Spot[]) => {
    const out: Spot[] = [];
    const span = xs.reduce((s, [a, b]) => s + b - a, 0);
    for (let tries = 0; out.length < n && tries < 400; tries++) {
      let u = r() * span;
      let x = xs[0]![0];
      for (const [a, b] of xs) {
        if (u <= b - a) {
          x = a + u;
          break;
        }
        u -= b - a;
      }
      const Y = ys[0] + r() * (ys[1] - ys[0]);
      if ([...taken, ...out].some((q) => Math.abs(q.x - x) < 10 && Math.abs(q.Y - Y) < 6)) continue;
      const s = spot(on, Math.round(x), Math.round(Y));
      if (on === "run") s.pile = pileOf(s.x, s.Y);
      out.push(s);
    }
    return out;
  };
  const taken: Spot[] = [...VISITS];
  const run = pick(RUN_X, RUN_Y, "run", 16, taken);
  taken.push(...run);
  const armW = pick([ARM_X[0]!], ARM_Y, "arm", 9, taken);
  taken.push(...armW);
  const armE = pick([ARM_X[1]!], ARM_Y, "arm", 9, taken);
  const floorW = pick([FLOOR_X[0]!], FLOOR_Y, "floor", 6, []);
  const floorE = pick([FLOOR_X[1]!], FLOOR_Y, "floor", 6, []);
  const lists: { home: Spot; visit: Spot | null }[][] = [run, armW, armE, floorW, floorE].map((l) => l.map((home) => ({ home, visit: null })));
  lists.push(STOOLS.map((home, i) => ({ home, visit: VISITS[i]! })));
  const out: { home: Spot; visit: Spot | null }[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]!);
  return out;
}
/** The most birds the room has homes for. */
export const BIRD_HOMES = homes(rng(F.seed)).length;

/** The flock's loops (made once: pure, from the seed). */
export function makeFlock(count = F.count, seed = F.seed): Bird[] {
  const r = rng(seed);
  const between = (lo: number, hi: number) => lo + r() * (hi - lo);
  const all = homes(r).slice(0, count);
  return all.map(({ home, visit }, i) => {
    const side: 1 | -1 = home.x < 222 ? -1 : 1;
    const face = (): 1 | -1 => (r() < 0.5 ? -1 : 1);
    const toward = (a: Spot, b: Spot): 1 | -1 => (b.x > a.x ? 1 : b.x < a.x ? -1 : face());
    const legs: Leg[] = [];
    let t = 0;
    const add = (k: number, ms: number, a: Spot, b: Spot, f: 1 | -1) => legs.push({ k, end: (t += ms), a, b, face: f });
    const flyOff = (from: Spot) => {
      add(OUT, F.flyMs, from, from, side);
      add(AWAY, between(F.awayMs[0], F.awayMs[1]), from, from, side);
      add(IN, F.flyMs, home, home, side < 0 ? 1 : -1);
    };
    if (visit) {
      // (A stool bird: a while on its seat, a hop up onto the bar and pecking there, sometimes back down to its seat; then off.)
      add(SIT, between(F.stoolSitMs[0], F.stoolSitMs[1]), home, home, face());
      add(HOP, F.hopMs * 1.4, home, visit, toward(home, visit));
      add(SIT, between(F.sitMs[0], F.sitMs[1]) * 0.6, visit, visit, face());
      if (r() < 0.5) {
        add(HOP, F.hopMs * 1.4, visit, home, toward(visit, home));
        add(SIT, between(F.stoolSitMs[0], F.stoolSitMs[1]), home, home, face());
        flyOff(home);
      } else flyOff(visit);
    } else {
      // (A bar or floor bird: pecking at home, a little hop along and back, then off.)
      const dx = (r() < 0.5 ? -1 : 1) * Math.round(between(6, 10));
      const nudged = spot(home.on, home.x + dx, home.Y + Math.round(between(-3, 3)), home.on === "run" ? 4 : undefined, home.pile);
      const sit = between(F.sitMs[0], F.sitMs[1]);
      add(SIT, sit * 0.45, home, home, face());
      add(HOP, F.hopMs, home, nudged, toward(home, nudged));
      add(SIT, sit * 0.3, nudged, nudged, face());
      add(HOP, F.hopMs, nudged, home, toward(nudged, home));
      add(SIT, sit * 0.25, home, home, face());
      flyOff(home);
    }
    return { home, look: i % BIRD_LOOKS.length, side, legs, loop: t, off: r() * t, bout: between(F.boutMs[0], F.boutMs[1]), boutOff: r() * 4000 };
  });
}

/** The bartender's idle (his dip and pour), as ShopRoom plays it, and when in it his pour lands (frame 7: the seed falling). */
const BARTENDER_MS = SIDEKICK_SHEETS.birdiebartender.ms.idle.map((ms) => Math.max(16, ms));
export const POUR_LOOP = BARTENDER_MS.reduce((a, b) => a + b, 0);
export const POUR_AT = BARTENDER_MS.slice(0, 7).reduce((a, b) => a + b, 0) + 60;
/** Pile `k`'s size at `now`: 3 just filled, down to 1, then 0 (eaten) until his next pour onto it. */
export function pileSize(k: number, now: number): number {
  const K = PILES.length;
  const n = Math.floor((now - POUR_AT) / POUR_LOOP);
  const m = n - ((((n - k) % K) + K) % K);
  const age = now - (m * POUR_LOOP + POUR_AT);
  return age < F.pileEatMs / 3 ? 3 : age < (2 * F.pileEatMs) / 3 ? 2 : age < F.pileEatMs ? 1 : 0;
}
const canPeck = (s: Spot, now: number) => (s.on === "stool" ? false : s.on !== "run" || s.pile < 0 ? true : pileSize(s.pile, now) > 0);

/** A bird's pose (written into `out`): its feet (x, Y), its row (R), its cell (BIRD_POSES), facing, how solid, and its leg's kind. */
export interface BirdPose {
  x: number;
  Y: number;
  R: number;
  cell: number;
  face: 1 | -1;
  alpha: number;
  k: number;
}
export const newPose = (): BirdPose => ({ x: 0, Y: 0, R: 0, cell: 0, face: 1, alpha: 1, k: SIT });
const flapAt = (now: number) => FLAP[Math.floor(now / F.flapMs) % FLAP.length]!;
/** Off its side of the room, up in the ceiling: where a bird flies off to (and back in from). */
const OFF_X = (side: number) => (side < 0 ? -60 : 504);
const OFF_Y = -150;
/** On the way from (x, Y, R) up and out to its side, `u` of the way (0 to 1): the rise first, fading out over the last of it. */
function flight(out: BirdPose, x: number, Y: number, R: number, side: number, u: number) {
  out.x = x + (OFF_X(side) - x) * u ** 1.4;
  out.Y = Y + (OFF_Y - Y) * (1 - (1 - u) ** 2);
  out.R = R * (1 - u);
  out.alpha = u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45);
}
/** Where bird `b`'s loop has it at `now`. */
export function poseAt(b: Bird, now: number, out: BirdPose): BirdPose {
  const t = (((now + b.off) % b.loop) + b.loop) % b.loop;
  let i = 0;
  while (i < b.legs.length - 1 && t >= b.legs[i]!.end) i++;
  const L = b.legs[i]!;
  const start = i ? b.legs[i - 1]!.end : 0;
  const u = Math.min(1, (t - start) / Math.max(1, L.end - start));
  out.k = L.k;
  out.face = L.face;
  out.alpha = 1;
  if (L.k === SIT) {
    out.x = L.a.x;
    out.Y = L.a.Y;
    out.R = L.a.R;
    const v = (now + b.boutOff) % b.bout;
    const peck = canPeck(L.a, now) && v < b.bout * 0.55;
    out.cell = peck ? (Math.floor(v / F.peckMs) % 2 ? PI.peck2 : PI.peck) : v > b.bout - 260 ? PI.look : PI.idle;
  } else if (L.k === HOP) {
    out.x = L.a.x + (L.b.x - L.a.x) * u;
    out.R = L.a.R + (L.b.R - L.a.R) * u;
    out.Y = L.a.Y + (L.b.Y - L.a.Y) * u - F.hopPx * 4 * u * (1 - u);
    out.cell = u < 0.15 || u > 0.88 ? PI.crouch : PI.air;
  } else if (L.k === OUT || L.k === IN) {
    flight(out, L.a.x, L.a.Y, L.a.R, b.side, L.k === OUT ? u : 1 - u);
    out.cell = flapAt(now);
  } else {
    out.alpha = 0;
    out.cell = PI.idle;
  }
  return out;
}

// ---------------------------------------------------------------- the flock in the room

/** A bird's state: on its loop, fled (flying off, then away), or flying back in to its loop. */
const LOOPING = 0;
const FLED = 1;
const BACK = 2;
/**
 * The flock: each bird's loop, and the scatter (you at the bar). `step(now, you)` moves it on and writes every bird's pose; `draw` draws
 * the piles and the birds in one pass. Nothing allocated after it's made.
 */
export class Flock {
  readonly birds: Bird[];
  readonly poses: BirdPose[];
  private readonly st: Uint8Array;
  private readonly t0: Float64Array;
  /** Where each fled bird flew off from, or where a returning one lands (x, Y, R). */
  private readonly px: Float64Array;
  private readonly pY: Float64Array;
  private readonly pR: Float64Array;
  private readonly order: Int16Array;
  /** Each bird's place in the return (0 to 1: when it comes back after the wait). */
  private readonly ret: Float64Array;
  private lastNear = -Infinity;
  private readonly tmp = newPose();
  constructor(count = F.count, seed = F.seed) {
    this.birds = makeFlock(count, seed);
    const n = this.birds.length;
    this.poses = this.birds.map(() => newPose());
    this.st = new Uint8Array(n);
    this.t0 = new Float64Array(n);
    this.px = new Float64Array(n);
    this.pY = new Float64Array(n);
    this.pR = new Float64Array(n);
    this.order = Int16Array.from({ length: n }, (_, i) => i);
    const r = rng(seed ^ 0x5ca7);
    this.ret = Float64Array.from({ length: n }, () => r());
  }
  /** You within `nearSquares` of the bar (the run and arms' squares: cols 5 to 8, rows 1 to 4), you at (c, r) in the room's squares. */
  static near(c: number, r: number): boolean {
    const dc = Math.max(4.5 - c, 0, c - 8.5);
    const dr = Math.max(0.5 - r, 0, r - 4.5);
    return Math.hypot(dc, dr) <= F.nearSquares;
  }
  /** Moves the flock to `now` (`near`: you're at the bar now) and writes each bird's pose. */
  step(now: number, near: boolean): void {
    if (near) this.lastNear = now;
    const back = this.lastNear + F.scatterAwayMs;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i]!;
      const p = this.poses[i]!;
      if (near && this.st[i] !== FLED) {
        // (Off from wherever it is now; one already away or flying off stays gone.)
        const was = this.st[i];
        const cur = was === BACK ? this.backPose(i, now, this.tmp) : poseAt(b, now, this.tmp);
        this.st[i] = FLED;
        const gone = cur.alpha === 0 || (was === LOOPING && cur.k === OUT);
        this.t0[i] = gone ? -Infinity : now;
        this.px[i] = cur.x;
        this.pY[i] = cur.Y;
        this.pR[i] = cur.R;
      }
      if (this.st[i] === FLED && !near && now >= back + this.ret[i]! * F.returnSpreadMs) {
        // (Back: in to where its loop will have it as it lands; on its loop at once if that's off or flying.)
        const land = poseAt(b, now + F.flyMs, this.tmp);
        if (land.k === SIT || land.k === HOP) {
          this.st[i] = BACK;
          this.t0[i] = now;
          this.px[i] = land.x;
          this.pY[i] = land.Y;
          this.pR[i] = land.R;
        } else this.st[i] = LOOPING;
      }
      if (this.st[i] === BACK && now >= this.t0[i]! + F.flyMs) this.st[i] = LOOPING;
      if (this.st[i] === LOOPING) poseAt(b, now, p);
      else if (this.st[i] === BACK) this.backPose(i, now, p);
      else {
        const u = (now - this.t0[i]!) / F.flyMs;
        p.k = u < 1 ? OUT : AWAY;
        if (u < 1) {
          flight(p, this.px[i]!, this.pY[i]!, this.pR[i]!, this.px[i]! < 222 ? -1 : 1, u);
          p.face = this.px[i]! < 222 ? -1 : 1;
          p.cell = flapAt(now);
        } else p.alpha = 0;
      }
    }
    // (Far to near: by row, then by depth in the picture; nearly sorted from the last frame, so a pass or two.)
    const o = this.order;
    for (let i = 1; i < o.length; i++) {
      const v = o[i]!;
      const kv = this.poses[v]!.R * 1000 + this.poses[v]!.Y;
      let j = i - 1;
      while (j >= 0 && this.poses[o[j]!]!.R * 1000 + this.poses[o[j]!]!.Y > kv) {
        o[j + 1] = o[j]!;
        j--;
      }
      o[j + 1] = v;
    }
  }
  private backPose(i: number, now: number, out: BirdPose): BirdPose {
    const side = this.px[i]! < 222 ? -1 : 1;
    const u = Math.min(1, (now - this.t0[i]!) / F.flyMs);
    flight(out, this.px[i]!, this.pY[i]!, this.pR[i]!, side, 1 - u);
    out.k = IN;
    out.face = side < 0 ? 1 : -1;
    out.cell = flapAt(now);
    return out;
  }
  /** (Tests) What the last step had: birds on show (sitting or hopping), flying, away, pecking, fled; and the piles' sizes. */
  counts(now: number) {
    let shown = 0, flying = 0, away = 0, pecking = 0, fled = 0;
    for (let i = 0; i < this.poses.length; i++) {
      const p = this.poses[i]!;
      if (this.st[i] === FLED) fled++;
      if (p.alpha === 0) away++;
      else if (p.k === OUT || p.k === IN) flying++;
      else shown++;
      if (p.alpha > 0 && (p.cell === PI.peck || p.cell === PI.peck2)) pecking++;
    }
    return { n: this.poses.length, shown, flying, away, pecking, fled, piles: PILES.map((_, k) => pileSize(k, now)) };
  }
  /** The piles, then the birds far to near: one pass, all from the sheet. */
  draw(d: FxDraw, now: number, img: HTMLCanvasElement): void {
    const g = d.g;
    g.imageSmoothingEnabled = false;
    for (let k = 0; k < PILES.length; k++) {
      const s = pileSize(k, now);
      if (s) this.put(d, img, (s - 1) * CW, PILE_ROW * CH, PILES[k]!.x, PILES[k]!.Y, 4);
    }
    for (let j = 0; j < this.order.length; j++) {
      const i = this.order[j]!;
      const p = this.poses[i]!;
      if (p.alpha <= 0) continue;
      if (p.alpha < 1) g.globalAlpha = p.alpha;
      this.put(d, img, p.cell * CW, (this.birds[i]!.look * 2 + (p.face > 0 ? 1 : 0)) * CH, p.x, p.Y, p.R);
      if (p.alpha < 1) g.globalAlpha = 1;
    }
  }
  /** One cell of the sheet, its feet at the art's (x, Y), standing on row R. */
  private put(d: FxDraw, img: HTMLCanvasElement, sx: number, sy: number, x: number, Y: number, R: number) {
    if (!proj(d.v, x / T - 0.5 - d.camX, d.camY - R, 0, pt)) return;
    const s = pt.k / T;
    const fy = pt.y + (Y - rowMid(R)) * s;
    d.g.drawImage(img, sx, sy, CW, CH, pt.x - FOOT_X * s, fy - FOOT_Y * s, CW * s, CH * s);
  }
}
const pt = newPt();

/**
 * The room's scene (Town.tsx gives it to the room as it loads): the flock, its sheet baked now, behind the room's fade. `you`: where you
 * stand in the room's squares (ShopCtl.youAt), read every `checkMs`.
 */
export function birdieFx(you: () => { c: number; r: number } | null): RoomFx {
  const img = birdSheet();
  const flock = new Flock();
  /** Whether you're near the pile (checked every `F.checkMs`) and when the flock was last drawn. */
  const seen = { near: false, at: 0 };
  let checked = -Infinity;
  const fig = {
    z: 5.5,
    draw: (d: FxDraw, now: number) => {
      if (now - checked >= F.checkMs) {
        checked = now;
        const at = you();
        seen.near = !!at && Flock.near(at.c, at.r);
      }
      flock.step(now, seen.near);
      flock.draw(d, now, img);
      seen.at = now;
    },
  };
  const list = [fig];
  if (testSwitchesAllowed()) hookBirds(flock, seen);
  return { figures: () => list };
}

/**
 * (Tests) The flock's counts. Made outside `birdieFx`, so the hook (never taken off: a room's effects have no end) holds the flock and
 * its two numbers only, never the room's `you` and through it the room and the town (Nov 27, window-hooks.ts).
 */
function hookBirds(flock: Flock, seen: { near: boolean; at: number }) {
  (window as unknown as { __birdieBirds?: () => ReturnType<Flock["counts"]> & { near: boolean } }).__birdieBirds = () => ({ ...flock.counts(seen.at), near: seen.near });
}
