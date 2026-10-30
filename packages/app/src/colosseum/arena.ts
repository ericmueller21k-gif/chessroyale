/**
 * The Colosseum's layout (Oct 30, the first look: docs/decisions/2026-10-30-colosseum-look.md): where everything stands,
 * the ten views and the camera's math. Pure numbers, no drawing, so it's tested on its own (test/colosseum.test.ts).
 *
 * World units are meters, one board square a meter. The board lies in the middle of the floor, its middle at the origin,
 * y up; files run along x (a at -x), ranks along z, White's end at +z (rank 1 at z = 3.5). Angles round the arena are
 * measured from +z (White's end) toward +x.
 */

/** The giant board: 8 squares a side, a meter each, on a stone plinth `rim` wider all round and `lift` high. */
export const BOARD = { half: 4, rim: 0.5, lift: 0.14 } as const;
/** The board's bounding sphere (the squares, the plinth and the tallest piece over them): what must stay on screen. */
export const BOARD_SPHERE = Math.hypot(BOARD.half + BOARD.rim, BOARD.half + BOARD.rim) * 0.92;
/** The sand floor out to the arena wall; the wall's height and its top's depth. */
export const FLOOR_R = 10;
export const WALL_H = 2.6;
export const WALL_TOP = 0.4;

/** The stands: rows of stone steps, the first just behind the wall's top, each `depth` deep and `rise` higher. */
export const STANDS = { rows: 14, r0: FLOOR_R + WALL_TOP, y0: WALL_H + 0.25, depth: 0.9, rise: 0.55, landingAfter: 6, landing: 0.7 } as const;
/** The gallery wall at the back of the top row, with its arches; its height. */
export const GALLERY_H = 3.4;
/** Seats along a row: a pawn every `seatGap` meters, the aisles' stairs at `aisles` angles kept clear, `aisleHalf` meters each side. */
export const SEATING = { seatGap: 0.62, aisles: 8, aisleHalf: 0.45 } as const;

/** Row `k`'s front edge (radius) and its step's height. */
export function rowR(k: number): number {
  return STANDS.r0 + k * STANDS.depth + (k > STANDS.landingAfter ? STANDS.landing : 0);
}
export function rowY(k: number): number {
  return STANDS.y0 + k * STANDS.rise;
}
/** The radius where row `k`'s people sit (the middle of its step) and the gallery wall's radius. */
export const seatR = (k: number): number => rowR(k) + STANDS.depth * 0.5;
export const GALLERY_R = rowR(STANDS.rows - 1) + STANDS.depth;
/** The landing's depth after row `landingAfter` (the walkway between the lower and the upper stands). */
export const landingDepth = (k: number): number => (k === STANDS.landingAfter ? STANDS.landing : 0);

/** The aisles' angles (radians): stairs from the wall to the gallery, kept clear of people. Offset so none is on an axis. */
export const aisleAngle = (i: number): number => ((i + 0.5) / SEATING.aisles) * Math.PI * 2;

/**
 * The pillars on the floor with their torches, between the board's corners and the wall: eight places round it, half-way
 * between the seats' angles (so none stands between a seat and the board), two of them the statues' (a generic stone pawn in a
 * gladiator's helm, on a plinth, never the town's bronze statue).
 */
export const PILLARS = { places: 8, r: 7.7, half: 0.28, h: 2.1, offset: Math.PI / 8 } as const;
const placeAngle = (i: number): number => PILLARS.offset + (i / PILLARS.places) * Math.PI * 2;
/** Which of the eight places are statues (the rest pillars). */
const STATUE_PLACES = [1, 5];
export const PILLAR_ANGLES: readonly number[] = Array.from({ length: PILLARS.places }, (_, i) => i).filter((i) => !STATUE_PLACES.includes(i)).map(placeAngle);
export const STATUE = { r: 8.2, h: 3.0, angles: STATUE_PLACES.map(placeAngle) } as const;
/** The crown banners: on the arena wall between the pillars, and on the gallery wall. */
export const BANNERS = { wall: 8, gallery: 12, wallW: 0.9, wallTop: 2.35, wallBottom: 0.55, galleryW: 1.2 } as const;

/** A person seated in the stands: where (their foot on the step), which way they face (toward the middle), which row. */
export interface Seat {
  x: number;
  y: number;
  z: number;
  /** The angle they face (radians, from +z toward +x): always the middle. */
  face: number;
  row: number;
}

/** Whether angle `a` (radians) is on an aisle's stairs at radius `r` (within `aisleHalf` meters of one). */
export function onAisle(a: number, r: number): boolean {
  const step = (Math.PI * 2) / SEATING.aisles;
  const off = (((a - aisleAngle(0)) % step) + step) % step;
  const d = Math.min(off, step - off) * r;
  return d < SEATING.aisleHalf + SEATING.seatGap * 0.5;
}

/** Every seat in the stands, row by row, each row's seats evenly round it, the aisles left clear. */
export function seats(): Seat[] {
  const out: Seat[] = [];
  for (let k = 0; k < STANDS.rows; k++) {
    const r = seatR(k);
    const n = Math.floor((Math.PI * 2 * r) / SEATING.seatGap);
    for (let i = 0; i < n; i++) {
      // (Each row a half seat round from the one below, so heads show between the heads in front.)
      const a = ((i + (k % 2) * 0.5) / n) * Math.PI * 2;
      if (onAisle(a, r)) continue;
      out.push({ x: Math.sin(a) * r, y: rowY(k), z: Math.cos(a) * r, face: a + Math.PI, row: k });
    }
  }
  return out;
}

/** A view: where the eye is, what it looks at, and the lens (vertical field of view, radians, on a landscape screen). */
export interface View {
  eye: readonly [number, number, number];
  at: readonly [number, number, number];
  fov: number;
}
/** Seated eye height over a step. */
const EYE = 1.0;
/** How much of the lens's height the board (its bounding sphere) takes from a seat. */
const BOARD_SHARE = 0.8;
/**
 * A seat's view: row `row`, `deg` degrees round from White's end, looking at the board's middle; its lens as wide as makes
 * the board take `BOARD_SHARE` of its height (between 24° and 62°): the board fills about the middle third of the view (the
 * director, Oct 30, on Eric's mockup).
 */
function seatView(deg: number, row: number): View {
  const a = (deg * Math.PI) / 180;
  const r = seatR(row) + 0.05;
  const eye = [Math.sin(a) * r, rowY(row) + EYE, Math.cos(a) * r] as const;
  const d = Math.hypot(eye[0], eye[1] - 1.1, eye[2]);
  const fov = Math.min((62 * Math.PI) / 180, Math.max((24 * Math.PI) / 180, (2 * Math.asin(BOARD_SPHERE / d)) / BOARD_SHARE));
  return { eye, at: [0, 1.1, 0], fov };
}
/**
 * The ten views (Eric, Oct 30): eight seats round the stands, lower and higher, each at its own angle (the eight angles
 * between the pillars), all good for watching the board ("Change seat" picks another of them at random); then White's and
 * Black's player views ("as if a real board was in front of you … about 20 feet above the board, in line with your side": 6 m
 * up, behind your own end).
 */
export const VIEWS: readonly View[] = [
  seatView(0, 3),
  seatView(45, 1),
  seatView(90, 6),
  seatView(135, 2),
  seatView(180, 8),
  seatView(225, 0),
  seatView(270, 5),
  seatView(315, 7),
  { eye: [0, 6, 9.4], at: [0, 0, 0.4], fov: (56 * Math.PI) / 180 },
  { eye: [0, 6, -9.4], at: [0, 0, -0.4], fov: (56 * Math.PI) / 180 },
];
export const SEAT_VIEWS = 8;
export const WHITE_VIEW = 8;
export const BLACK_VIEW = 9;

/** Another of the eight seats, picked at random (never the one you're in). `rnd`: 0 to 1. */
export function otherSeat(now: number, rnd: number): number {
  const pick = Math.floor(rnd * (SEAT_VIEWS - 1)) % (SEAT_VIEWS - 1);
  const from = now >= 0 && now < SEAT_VIEWS ? now : -1;
  return from < 0 ? pick : pick >= from ? pick + 1 : pick;
}

/** The view an address asks for: `?view=white` or `?view=black` (the player views' test switch), else a seat. */
export function viewFor(asked: string | null, seat: number): number {
  return asked === "white" ? WHITE_VIEW : asked === "black" ? BLACK_VIEW : seat;
}


/** A screen's lens for a view: the vertical field of view, widened on a tall screen so the board fits across it. */
export function fovFor(v: View, aspect: number): number {
  const minH = (Math.PI * 50) / 180;
  const h = 2 * Math.atan(Math.tan(v.fov / 2) * aspect);
  return h >= minH ? v.fov : 2 * Math.atan(Math.tan(minH / 2) / aspect);
}

/**
 * How far you may turn your view (radians, each way: yaw across, pitch up and down): never so far the board leaves the
 * screen. Its middle may go no further than the lens's half-width less the board's own half-size from the middle (at
 * least a quarter of the half-width, so a close seat can still look round a little).
 */
export function turnLimits(v: View, aspect: number, out: { yaw: number; pitch: number }): { yaw: number; pitch: number } {
  const fov = fovFor(v, aspect);
  const halfV = fov / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const d = Math.hypot(v.eye[0] - v.at[0], v.eye[1] - v.at[1], v.eye[2] - v.at[2]);
  const ang = Math.asin(Math.min(1, BOARD_SPHERE / d));
  out.yaw = Math.max(halfH * 0.25, halfH - ang);
  out.pitch = Math.max(halfV * 0.25, halfV - ang);
  return out;
}

// ---- Matrices (column-major, into arrays made once: nothing allocated a frame).

/** `out` = a perspective projection (WebGL's clip space). */
export function perspective(out: Float32Array, fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

/**
 * `out` = the view matrix for an eye looking at `at`, then turned by `yaw` (to the right) and `pitch` (up) round the eye.
 * `fwd` gets the direction it looks (for the crowd's own-seat check and the tests).
 */
export function lookAt(out: Float32Array, eye: readonly number[], at: readonly number[], yaw: number, pitch: number, fwd: Float32Array): Float32Array {
  let fx = at[0]! - eye[0]!;
  let fy = at[1]! - eye[1]!;
  let fz = at[2]! - eye[2]!;
  const len = Math.hypot(fx, fy, fz) || 1;
  fx /= len;
  fy /= len;
  fz /= len;
  // Turn: the heading round the up axis, then the pitch.
  const head = Math.atan2(fx, fz) - yaw;
  const tilt = Math.asin(Math.max(-1, Math.min(1, fy))) + pitch;
  const lim = Math.PI / 2 - 0.05;
  const p = Math.max(-lim, Math.min(lim, tilt));
  fx = Math.sin(head) * Math.cos(p);
  fy = Math.sin(p);
  fz = Math.cos(head) * Math.cos(p);
  fwd[0] = fx;
  fwd[1] = fy;
  fwd[2] = fz;
  // Right = forward × up; up' = right × forward.
  let rx = -fz;
  let rz = fx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  out[0] = rx;
  out[1] = ux;
  out[2] = -fx;
  out[3] = 0;
  out[4] = 0;
  out[5] = uy;
  out[6] = -fy;
  out[7] = 0;
  out[8] = rz;
  out[9] = uz;
  out[10] = -fz;
  out[11] = 0;
  out[12] = -(rx * eye[0]! + rz * eye[2]!);
  out[13] = -(ux * eye[0]! + uy * eye[1]! + uz * eye[2]!);
  out[14] = fx * eye[0]! + fy * eye[1]! + fz * eye[2]!;
  out[15] = 1;
  return out;
}

/** `out` = a × b. */
export function multiply(out: Float32Array, a: Float32Array, b: Float32Array): Float32Array {
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
      out[c * 4 + r] = s;
    }
  return out;
}

/** Where world point (x, y, z) lands on a w × h screen through `m` (view-projection): [sx, sy, depth], or null behind the eye. */
export function project(m: Float32Array, x: number, y: number, z: number, w: number, h: number): [number, number, number] | null {
  const cx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  const cy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  const cw = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
  if (cw <= 0) return null;
  return [((cx / cw + 1) / 2) * w, ((1 - cy / cw) / 2) * h, cw];
}

/** A square's middle on the floor ("e4" → [x, z]), White's end at +z. */
export function squareXZ(sq: string): [number, number] {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  return [f - 3.5, 3.5 - r];
}

/** A boss's seat and its sidekick's beside it: where each stands, and the seats (indices into `seats()`) they take from the pawns. */
export interface BossSeat {
  boss: Seat;
  kid: Seat;
  taken: readonly number[];
}

/** How big a boss and a sidekick stand (half their width and their height, meters, a jump's height on top): what mustn't cover the board. */
const BOSS_BOX = { hw: 0.8, h: 1.75 } as const;
const KID_BOX = { hw: 0.42, h: 1.0 } as const;

/**
 * Whether a figure standing at `p` (its feet), `hw` wide each way and `h` tall, covers any of the board (its squares and the
 * pieces on them) from view `v`: some line from the eye through the figure meets the board behind it.
 */
export function coversBoard(v: View, p: { x: number; y: number; z: number }, hw: number, h: number): boolean {
  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  const m = new Float32Array(16);
  // (Any lens from the eye gives the same answer: which lines meet what doesn't depend on the lens.)
  perspective(proj, (100 * Math.PI) / 180, 1, 0.1, 200);
  lookAt(view, v.eye, v.at, 0, 0, new Float32Array(3));
  multiply(m, proj, view);
  const B = BOARD.half + BOARD.rim;
  const board: [number, number, number][] = [];
  for (const x of [-B, B]) for (const z of [-B, B]) for (const y of [BOARD.lift, BOARD.lift + 1.3]) board.push([x, y, z]);
  const pb = board.map((q) => project(m, q[0], q[1], q[2], 100, 100)).filter((q): q is [number, number, number] => !!q);
  const mid = project(m, 0, BOARD.lift, 0, 100, 100);
  const dx = v.eye[0] - p.x;
  const dz = v.eye[2] - p.z;
  const l = Math.hypot(dx, dz) || 1;
  const rx = dz / l;
  const rz = -dx / l;
  const fig: [number, number, number][] = [];
  for (const s of [-hw, hw]) for (const y of [p.y, p.y + h]) fig.push([p.x + rx * s, y, p.z + rz * s]);
  const pf = fig.map((q) => project(m, q[0], q[1], q[2], 100, 100));
  // Behind the eye, or farther than the board's middle: it can't stand in front of the board.
  if (pf.some((q) => !q) || !mid || Math.max(...pf.map((q) => q![2])) > mid[2]) return false;
  const box = (q: readonly [number, number, number][]): [number, number, number, number] => [Math.min(...q.map((a) => a[0])), Math.min(...q.map((a) => a[1])), Math.max(...q.map((a) => a[0])), Math.max(...q.map((a) => a[1]))];
  const [a0, b0, a1, b1] = box(pb);
  const [c0, d0, c1, d1] = box(pf as [number, number, number][]);
  return c0 < a1 && c1 > a0 && d0 < b1 && d1 > b0;
}

/**
 * Where the bosses who watch sit (Eric, Oct 30: "the boss and their sidekicks next to each other in the crowd in the first 3
 * rows"): `n` of them, each across two seats with its sidekick in the next, in rows 1 to 3, spread evenly round the ring, at
 * seats that never change (the same in every view, on every load), and never where one would cover the board from any of the
 * ten views (`coversBoard`).
 */
export function bossSeats(n: number): BossSeat[] {
  const all = seats();
  const free = (i: number) => !VIEWS.some((v) => coversBoard(v, all[i]!, KID_BOX.hw, KID_BOX.h));
  // Three seats in a row, side by side (no aisle between): the boss across the first two, its sidekick in the third.
  const triples: { i: number; a: number; row: number; boss: Seat }[] = [];
  for (let i = 0; i + 2 < all.length; i++) {
    const s = all.slice(i, i + 3);
    if (s[0]!.row > 2 || s.some((q) => q.row !== s[0]!.row)) continue;
    const gap = (a: Seat, b: Seat) => Math.hypot(a.x - b.x, a.z - b.z);
    if (gap(s[0]!, s[1]!) > SEATING.seatGap * 1.5 || gap(s[1]!, s[2]!) > SEATING.seatGap * 1.5) continue;
    const boss: Seat = { ...s[0]!, x: (s[0]!.x + s[1]!.x) / 2, z: (s[0]!.z + s[1]!.z) / 2, face: (s[0]!.face + s[1]!.face) / 2 };
    if (VIEWS.some((v) => coversBoard(v, boss, BOSS_BOX.hw, BOSS_BOX.h)) || !free(i + 2)) continue;
    triples.push({ i, a: Math.atan2(boss.x, boss.z), row: s[0]!.row, boss });
  }
  const out: BossSeat[] = [];
  const used = new Set<number>();
  for (let k = 0; k < n; k++) {
    const target = ((k + 0.5) / n) * Math.PI * 2 - Math.PI;
    const row = k % 3;
    const off = (t: (typeof triples)[number]) => Math.abs(Math.atan2(Math.sin(t.a - target), Math.cos(t.a - target))) + (t.row === row ? 0 : 0.2);
    let best: (typeof triples)[number] | null = null;
    // (Never one boss just behind another: at least 9° apart round the ring.)
    const near = (t: (typeof triples)[number]) => out.some((o) => Math.abs(Math.atan2(Math.sin(t.a - Math.atan2(o.boss.x, o.boss.z)), Math.cos(t.a - Math.atan2(o.boss.x, o.boss.z)))) < (9 * Math.PI) / 180);
    for (const t of triples) if (![t.i - 1, t.i, t.i + 1, t.i + 2, t.i + 3].some((j) => used.has(j)) && !near(t) && (!best || off(t) < off(best))) best = t;
    if (!best) break;
    for (const j of [best.i, best.i + 1, best.i + 2]) used.add(j);
    out.push({ boss: best.boss, kid: all[best.i + 2]!, taken: [best.i, best.i + 1, best.i + 2] });
  }
  return out;
}
