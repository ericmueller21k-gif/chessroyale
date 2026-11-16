/**
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/npc-grex/npc-grex.ts at 0e4f6482, Nov 4, 2026; Eric approved the build Nov 4).
 * Changed: the import paths. The notes: scripts/boss-art/out/shop-grex-nov4.md and intro-grex-nov4.md on that branch.
 */
/**
 * Jefferson's warehouse crew (Eric's design, Nov 4; drawn by hand on the weekly plan usage): giraffes who run his shady
 * firework warehouse (out/house-shop-grex). All one giraffe (giraffe-rig.ts), dressed each his own way; only Jefferson looks
 * unique. Room scale, 1:1 (37 px a square). Facing our right; mirror any of them to face left.
 *
 * - `npc-grex-lift-guy`: the lift guy (a yellow hard hat with his ossicones through it, a lime hi-vis vest).
 * - `npc-grex-fork-guy`: the forklift guy (a blue cap, an orange hi-vis vest).
 * - `npc-grex-leaner-a`: a shady giraffe leaning on the wall (a flat cap, a dark bomber jacket): a sparkler in place of a
 *   cigarette, held at his side, lifted to his mouth, a little smoke puff out.
 * - `npc-grex-leaner-b`: the other (a red beanie, a denim vest, shades): his sparkler kept in his mouth, fizzing.
 * - `npc-grex-crew-c`: the clipboard guy (a lime vest), checking boxes on a pallet.
 * - `npc-grex-crew-d`: the dozer (a hard hat tipped over his eyes, an orange vest), asleep on a pallet, Z's.
 *   Every one: `idle` (his own loop where he stands), `walk` (to come over in the intro), `watch` (round the table).
 * - `npc-grex-lift`: the scissor lift with the lift guy on it, its platform barely raised (he doesn't need it): `idle`,
 *   `drive` (wheels turning, the beacon going round), `up` / `upIdle` / `down` (the platform up a few px and back), `stepOff`
 *   (he climbs off the back), `parked` (no one on it, the beacon off).
 * - `npc-grex-forklift`: the forklift with the forklift guy in it (his neck up through the overhead guard): `idle`, `drive`,
 *   `reverse`, `forksDown`, `forksUp` (to carry), `raise` / `raisePallet` (to the shelf, without or with a pallet: the
 *   pallet's weight dips its rear), `set` / `lift` (down onto the shelf, up off it), `lower` (back to carry), `stepOff`, `parked`.
 * - `npc-grex-pallet`: the loose pallet the code hands from the floor to the forks to the shelf slot (a wooden pallet, two
 *   cartons of MOON SHOT on it, shrink-wrapped).
 * NPC_GREX_FORK_AT gives, per forklift frame, where the pallet's foot goes (on the forks); NPC_GREX_RISE the lift's platform
 * height; NPC_GREX_STEP_OFF where each guy stands on the ground once off (from the machine's foot).
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../characters/sprite.ts";
import { ARMS, build, clipboard, CREW_PALETTE, FOOT, frame, GROUND, H, PARTS, smoke, sparkler, W, WALK, WALK_ARMS, zzz, type Look, type Pose, type Pt } from "./giraffe-rig.ts";
import { cv as wcv, load, WAREHOUSE_PALETTE, whole } from "./warehouse-kit.ts";

// ---- The looks.

export const LOOKS = {
  lift: { id: "lift", hat: "hard", top: "vest-lime", seed: 3 },
  fork: { id: "fork", hat: "cap", top: "vest-orange", seed: 4 },
  leanerA: { id: "leanerA", hat: "flat", top: "jacket", seed: 5 },
  leanerB: { id: "leanerB", hat: "beanie", top: "denim", shades: true, seed: 6 },
  crewC: { id: "crewC", hat: "none", top: "vest-lime", seed: 9 },
  crewD: { id: "crewD", hat: "hard", top: "vest-orange", seed: 10 },
} as const satisfies Record<string, Look>;

const char = (id: string, name: string, anims: Record<string, Anim>, extra: Partial<Character> = {}): Character => ({
  id,
  name,
  w: W,
  h: H,
  foot: FOOT,
  palette: CREW_PALETTE,
  halo: "#3a2a1c",
  parts: PARTS,
  anims,
  ...extra,
});

/** A walk: 6 x 110 ms, a `step` cue on f0 and f3; `p` the rest of his pose (what he carries), `specks` his props per frame. */
function walkAnim(look: Look, p: Pose = {}, specks?: (i: number) => Speck[], arms = true): Anim {
  return {
    loop: true,
    frames: WALK.map((w, i) =>
      frame(look, 110, { ...p, feet: w.feet, bob: w.bob, ...(arms ? { armF: WALK_ARMS[i]![0], armN: WALK_ARMS[i]![1] } : {}) }, { ...(specks ? { specks: specks(i) } : {}), ...(i === 0 || i === 3 ? { cue: "step" } : {}) }),
    ),
  };
}
/** Watching round the table: 8 frames, a slow breath, a nod on f4-f5, a blink on f7. */
function watchAnim(look: Look, p: Pose, specks?: (i: number) => Speck[]): Anim {
  return {
    loop: true,
    frames: Array.from({ length: 8 }, (_, i) =>
      frame(look, 180, { ...p, bob: i >= 2 && i <= 3 ? 1 : 0, hy: i === 4 ? 2 : i === 5 ? 1 : 0, hx: i === 4 ? 1 : 0, eyes: i === 7 ? "blink" : p.eyes }, specks ? { specks: specks(i) } : {}),
    ),
  };
}
const mouthOf = (look: Look, p: Pose) => build(look, p).mouth;
const hoofOf = (look: Look, p: Pose) => build(look, p).hoofN;

// ---- The lift guy and the forklift guy (on foot).

export const NPC_GREX_LIFT_GUY = char("npc-grex-lift-guy", "The lift guy", {
  idle: watchAnim(LOOKS.lift, { armF: ARMS.hip, armN: ARMS.hip, mouth: "flat" }),
  walk: walkAnim(LOOKS.lift),
  watch: watchAnim(LOOKS.lift, { armF: ARMS.hip, armN: ARMS.hip, mouth: "smile" }),
});
export const NPC_GREX_FORK_GUY = char("npc-grex-fork-guy", "The forklift guy", {
  idle: watchAnim(LOOKS.fork, { armF: ARMS.cross, armN: ARMS.crossN }),
  walk: walkAnim(LOOKS.fork),
  watch: watchAnim(LOOKS.fork, { armF: ARMS.cross, armN: ARMS.crossN, mouth: "smirk" }),
});

// ---- The two leaners (against the wall on their left: `lean` 4).

const LEAN = 8;
/** Leaner A's sparkler, held at his side (near hoof), up and forward, like a cigarette between two fingers. */
const sideSpark = (look: Look, p: Pose, seed: number): Speck[] => sparkler(hoofOf(look, p), [1, -0.9], 7, seed);
/** At his mouth: the head ducked down to the hoof raised. */
const DRAG: Pose = { lean: LEAN, armF: ARMS.fold, armN: [[7, -2], [12, -12]], hx: -1, hy: 8, eyes: "half", mouth: "o" };
const SIDE: Pose = { lean: LEAN, armF: ARMS.fold, armN: ARMS.side, eyes: "half", mouth: "smirk", feet: [[-1, 0], [7, 0]] };
export const NPC_GREX_LEANER_A = char("npc-grex-leaner-a", "A shady giraffe (sparkler at his side)", {
  /**
   * 12 frames, about 2.3 s: the sparkler fizzing at his side (f0-f3), lifted (f4), at his mouth (f5-f6, ducked down to it), lowered
   * (f7), a little smoke puff out of his mouth rising (f7-f10), back at his side (f11). Cue `fizz` f0, `puff` f7.
   */
  idle: {
    loop: true,
    frames: [
      ...[0, 1, 2, 3].map((i) => frame(LOOKS.leanerA, 190, { ...SIDE, bob: i === 2 ? 1 : 0, eyes: i === 3 ? "blink" : "half" }, { specks: sideSpark(LOOKS.leanerA, SIDE, i), ...(i === 0 ? { cue: "fizz" } : {}) })),
      frame(LOOKS.leanerA, 150, { ...SIDE, armN: [[7, 2], [11, -4]], hy: 3, hx: 0 }, { specks: sparkler(hoofOf(LOOKS.leanerA, { ...SIDE, armN: [[7, 2], [11, -4]], hy: 3 }), [1, -1], 7, 4) }),
      ...[5, 6].map((i) => frame(LOOKS.leanerA, 260, DRAG, { specks: sparkler(hoofOf(LOOKS.leanerA, DRAG), [1, -0.4], 6, i, 0.7) })),
      ...[7, 8, 9, 10].map((i) => {
        const p: Pose = { ...SIDE, mouth: i === 7 ? "o" : "smirk", eyes: i === 9 ? "shut" : "half" };
        const m = mouthOf(LOOKS.leanerA, p);
        return frame(LOOKS.leanerA, 170, p, { specks: [...sideSpark(LOOKS.leanerA, p, i), ...smoke([m[0] + 1, m[1] - 1], i - 7)], ...(i === 7 ? { cue: "puff" } : {}) });
      }),
      frame(LOOKS.leanerA, 190, SIDE, { specks: sideSpark(LOOKS.leanerA, SIDE, 11) }),
    ],
  },
  walk: walkAnim(LOOKS.leanerA, { eyes: "half", mouth: "smirk" }, (i) => sparkler(build(LOOKS.leanerA, { feet: WALK[i]!.feet, bob: WALK[i]!.bob, armF: WALK_ARMS[i]![0], armN: WALK_ARMS[i]![1] }).hoofN, [1, -1], 7, i)),
  watch: watchAnim(LOOKS.leanerA, { armF: ARMS.fold, armN: ARMS.side, eyes: "half", mouth: "smirk" }, (i) => sparkler(hoofOf(LOOKS.leanerA, { armF: ARMS.fold, armN: ARMS.side, bob: i >= 2 && i <= 3 ? 1 : 0 }), [1, -0.9], 7, i)),
});
/** Leaner B's sparkler, kept in his mouth (out of its corner, up and forward), fizzing. */
const mouthSpark = (look: Look, p: Pose, seed: number): Speck[] => {
  const m = mouthOf(look, p);
  return sparkler([m[0] - 1, m[1]], [1, -0.55], 8, seed);
};
const LB: Pose = { lean: LEAN, armF: ARMS.cross, armN: ARMS.crossN, mouth: "flat", feet: [[-1, 0], [7, 0]] };
export const NPC_GREX_LEANER_B = char("npc-grex-leaner-b", "A shady giraffe (sparkler in his mouth)", {
  /** 8 frames, about 1.6 s: arms crossed, the sparkler in his mouth fizzing (a new spray each frame), a slow nod to himself (f4-f5). Cue `fizz` f0. */
  idle: {
    loop: true,
    frames: Array.from({ length: 8 }, (_, i) => {
      const p: Pose = { ...LB, bob: i >= 2 && i <= 3 ? 1 : 0, hy: i === 4 ? 1 : 0 };
      return frame(LOOKS.leanerB, 200, p, { specks: mouthSpark(LOOKS.leanerB, p, i + 20), ...(i === 0 ? { cue: "fizz" } : {}) });
    }),
  },
  walk: walkAnim(LOOKS.leanerB, {}, (i) => mouthSpark(LOOKS.leanerB, { feet: WALK[i]!.feet, bob: WALK[i]!.bob }, i + 30)),
  watch: watchAnim(LOOKS.leanerB, { armF: ARMS.cross, armN: ARMS.crossN }, (i) => mouthSpark(LOOKS.leanerB, { bob: i >= 2 && i <= 3 ? 1 : 0, hy: i === 4 ? 2 : i === 5 ? 1 : 0, hx: i === 4 ? 1 : 0 }, i + 40)),
});

// ---- The clipboard guy and the dozer.

/** The clipboard held in his far hoof, in front of his chest; the pencil in his near hoof. */
const clipAt = (look: Look, p: Pose): Pt => {
  const f = build(look, p).hoofF;
  return [f[0] - 3, f[1] - 9];
};
const pencil = (h: Pt): Speck[] => [[h[0] + 1, h[1] - 1, "y"], [h[0] + 2, h[1] - 2, "y"], [h[0] + 3, h[1] - 3, "Y"], [h[0], h[1], "s"]];
const CC: Pose = { armF: ARMS.clip, armN: ARMS.pencil, hy: 3, hx: 1, eyes: "open" };
export const NPC_GREX_CREW_C = char("npc-grex-crew-c", "The clipboard guy", {
  /**
   * 10 frames, about 2 s: looking down at his clipboard (f0-f1), up at the pallet beside him (f2-f4, the pencil up), back down
   * and a tick (f5-f6, cue `tick` f6), a breath (f7-f9). The ticks build up on the paper and start again.
   */
  idle: {
    loop: true,
    frames: Array.from({ length: 10 }, (_, i) => {
      const up = i >= 2 && i <= 4;
      const p: Pose = { ...CC, hy: up ? -1 : 3, hx: up ? 2 : 1, eyes: up ? "up" : "open", armN: up ? ARMS.pencilUp : ARMS.pencil, bob: i >= 7 && i <= 8 ? 1 : 0, mouth: i === 6 ? "smile" : "flat" };
      const b = build(LOOKS.crewC, p);
      const tick = i >= 6 ? 3 : i >= 2 ? 2 : 1;
      return frame(LOOKS.crewC, i === 6 ? 260 : 190, p, { specks: [...clipboard(clipAt(LOOKS.crewC, p), tick), ...pencil(b.hoofN)], ...(i === 6 ? { cue: "tick" } : {}) });
    }),
  },
  walk: walkAnim(LOOKS.crewC, { armF: ARMS.clip }, (i) => clipboard(clipAt(LOOKS.crewC, { armF: ARMS.clip, bob: WALK[i]!.bob }), 2), false),
  watch: watchAnim(LOOKS.crewC, { armF: ARMS.clip, armN: ARMS.hangN }, (i) => clipboard(clipAt(LOOKS.crewC, { armF: ARMS.clip, bob: i >= 2 && i <= 3 ? 1 : 0 }), 3)),
});
/** The dozer's pallet seat height (SHOP_GREX_PALLET_SEAT_H). */
const SEAT = 9;
const DZ: Pose = { sit: SEAT, armF: ARMS.fold, armN: ARMS.foldN, eyes: "shut", mouth: "o", hy: 4, hx: -1, tipped: true, feet: [[2, 0], [5, 0]] };
export const NPC_GREX_CREW_D = char("npc-grex-crew-d", "The dozer", {
  /** 8 frames x 260 ms: asleep on his pallet, arms folded, hard hat tipped over his eyes, breathing, Z's drifting up (cue `snore` f0). */
  idle: {
    loop: true,
    frames: Array.from({ length: 8 }, (_, i) => {
      const p: Pose = { ...DZ, bob: i >= 3 && i <= 5 ? 1 : 0 };
      const m = mouthOf(LOOKS.crewD, p);
      return frame(LOOKS.crewD, 260, p, { specks: zzz([m[0] - 2, m[1] - 12], i), ...(i === 0 ? { cue: "snore" } : {}) });
    }),
  },
  /** Woken (once, 4 frames, 560 ms): a start (cue `snort` f0), the hat pushed back, eyes open, up on his hooves. */
  wake: {
    loop: false,
    frames: [
      frame(LOOKS.crewD, 120, { ...DZ, eyes: "open", mouth: "open", hy: 0, hx: 0, bob: -1 }, { cue: "snort" }),
      frame(LOOKS.crewD, 140, { ...DZ, tipped: false, eyes: "open", mouth: "flat", hy: 0, hx: 1, armN: ARMS.hangN }),
      frame(LOOKS.crewD, 140, { tipped: false, eyes: "blink", armF: ARMS.hang, armN: ARMS.hangN, bob: 3, feet: [[-2, 0], [4, 0]] }),
      frame(LOOKS.crewD, 160, { tipped: false, eyes: "open", armF: ARMS.hang, armN: ARMS.hangN }),
    ],
  },
  walk: walkAnim(LOOKS.crewD, { eyes: "half" }),
  watch: watchAnim(LOOKS.crewD, { armF: ARMS.fold, armN: ARMS.foldN, eyes: "half", mouth: "flat" }),
});
/** Where the dozer sits: the seat's height over the ground (his pallet's `SHOP_GREX_PALLET_SEAT_H`). */
export const NPC_GREX_CREW_D_SEAT = SEAT;

// ==== The machines (room scale, side on, facing our right).

const VW = 112;
const VH = 144;
const VG = 128; // the ground (the first row under the wheels); 16 px below it for a guy stepped off in front
const VPAL: Record<string, string> = { ...CREW_PALETTE };
/** A guy on a machine: his layers moved so his foot is at (x, y) in the machine's frame. */
const moved = (layers: Layer[], x: number, y: number): Layer[] => layers.map((l) => ({ ...l, x: l.x + x - FOOT[0], y: l.y + y - FOOT[1] }));
const MPARTS: Record<string, Part> = {};
/** The machines' parts and the guys' (filled once every frame is built, at the end of this file). */
const VPARTS: Record<string, Part> = {};
type Cv = string[][];
const vcv = (): Cv => Array.from({ length: VH }, () => Array<string>(VW).fill("."));
const vput = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < VH && x >= 0 && x < VW) c[y]![x] = k;
};
function vcrop(name: string, c: Cv, outline = true): Layer | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  c.forEach((row, y) => row.forEach((k, x) => k !== "." && ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)))));
  if (x1 < 0) return null;
  MPARTS[name] = { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline };
  return { part: name, x: x0, y: y0 };
}
const vpart = (name: string, paint: (c: Cv) => void, outline = true): Layer | null => {
  const c = vcv();
  paint(c);
  return vcrop(name, c, outline);
};
/** A wheel at (cx, cy), radius r, turned `turn` (0-3: its hub's spokes): rubber, a lit edge, a steel hub. */
function wheel(c: Cv, cx: number, cy: number, r: number, turn: number) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r) continue;
      const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
      let k = d > r - 1.2 ? (a < -Math.PI / 2 ? "l" : "T") : d > r * 0.55 ? "T" : d > r * 0.45 ? "S" : "8";
      if (d <= r * 0.45 && Math.abs(Math.sin(2 * a - (turn * Math.PI) / 4)) < 0.3) k = "M";
      if (d > r * 0.55 && d <= r - 1.2 && Math.abs(Math.sin(4 * a - (turn * Math.PI) / 4)) < 0.15) k = "l"; // tread marks
      vput(c, x, y, k);
    }
  vput(c, cx, cy, "S");
}
/** A beacon (amber dome) at (x, y): `on` 0 off, 1-3 the bright side going round. */
function beacon(c: Cv, x: number, y: number, on: number) {
  for (let j = 0; j < 4; j++) for (let i = -2; i <= 2; i++) if (Math.abs(i) <= 2 - (j === 0 ? 1 : 0)) vput(c, x + i, y + j, on === 0 ? (i < 0 ? "Y" : "E") : i === on - 2 || i === on - 3 ? "1" : "3");
  for (let i = -3; i <= 3; i++) vput(c, x + i, y + 4, "S");
}
const glow = (x: number, y: number, on: number): Speck[] =>
  on === 0 ? [] : [[x - 4 + on, y - 1, "2"], [x - 3 + on * 2, y - 2, "3"], [x + on, y + 1, "4"], [x - 4, y + 2, on === 2 ? "3" : "4"]];

// -- The scissor lift: an orange chassis on four little wheels (two seen), the folded scissor stack, a deck with a railing
// round it, a control box on the front rail, an amber beacon on the rear post.
const LX0 = 28; // the chassis, its x range and top
const LX1 = 84;
const L_CH = VG - 15; // the chassis's top
export const NPC_GREX_LIFT_FOOT: Pt = [56, VG];
/** The platform's deck top over the ground, at rest (the scissor folded down to 3 px; `up` raises it by NPC_GREX_RISE). */
const DECK0 = 15 + 3 + 4;
function liftFrame(rise: number, turn: number, on: number, who: "on" | "off" | Layer[]): Frame {
  const L: Layer[] = [];
  const add = (l: Layer | null) => l && L.push(l);
  add(vpart("lift:shadow", (c) => {
    for (let x = LX0 - 2; x <= LX1 + 2; x++) vput(c, x, VG - 1, x < LX0 + 3 || x > LX1 - 3 ? "+" : "-");
  }, false));
  const deckTop = VG - DECK0 - rise;
  // The rear rail (behind him): a top rail and a mid rail, darker.
  add(vpart(`lift:railBack:${rise}`, (c) => {
    for (let x = LX0; x <= LX1; x++) {
      vput(c, x, deckTop - 18, "E");
      vput(c, x, deckTop - 9, "E");
    }
    for (const x of [LX0, LX1]) for (let y = deckTop - 18; y < deckTop; y++) vput(c, x, y, "E");
  }));
  const guy = who === "on" ? moved(build(LOOKS.lift, { armF: ARMS.rail, armN: ARMS.rail, hy: turn % 2, bob: rise > 0 && rise < 6 ? 1 : 0, mouth: rise >= 6 ? "smile" : "flat" }).layers.slice(1), 52, deckTop + 1) : Array.isArray(who) ? who : [];
  L.push(...guy);
  // The scissor stack: crossed steel arms between the chassis and the deck.
  add(vpart(`lift:scissor:${rise}`, (c) => {
    const y0 = L_CH - 1;
    const y1 = deckTop + 3;
    const hgt = y0 - y1;
    for (let x = LX0 + 4; x <= LX1 - 4; x++) {
      const u = (x - LX0 - 4) / (LX1 - LX0 - 8);
      const ya = Math.round(y1 + hgt * u);
      const yb = Math.round(y0 - hgt * u);
      vput(c, x, ya, "M");
      vput(c, x, yb, "S");
      if (hgt > 4) vput(c, x, Math.round((ya + yb) / 2), x % 6 === 0 ? "8" : ".");
    }
    vput(c, Math.round((LX0 + LX1) / 2), Math.round((y0 + y1) / 2), "8");
  }));
  // The chassis: orange, a dark band of hazard stripes along its foot, the wheels.
  add(vpart(`lift:chassis:${turn}`, (c) => {
    for (let y = L_CH; y < VG - 4; y++)
      for (let x = LX0; x <= LX1; x++) {
        let k = y === L_CH ? "F" : x === LX1 ? "E" : y > VG - 7 ? (Math.floor((x + y) / 3) % 2 ? "s" : "y") : "e";
        if (x === LX0 + 18 && y > L_CH + 1 && y < VG - 7) k = "E"; // a panel line
        vput(c, x, y, k);
      }
    // A label on its side: a little white plate.
    for (let y = L_CH + 2; y < L_CH + 5; y++) for (let x = LX0 + 4; x < LX0 + 13; x++) vput(c, x, y, "t");
    wheel(c, LX0 + 9, VG - 5, 5, turn);
    wheel(c, LX1 - 9, VG - 5, 5, turn);
  }));
  // The deck and the front rail (in front of him): the toe board, the rails, the posts, the control box.
  add(vpart(`lift:deck:${rise}:${on}`, (c) => {
    for (let x = LX0 - 2; x <= LX1 + 2; x++) for (let y = deckTop; y < deckTop + 4; y++) vput(c, x, y, y === deckTop ? "8" : "M");
    for (let x = LX0; x <= LX1; x++) {
      for (let y = deckTop - 4; y < deckTop; y++) vput(c, x, y, y === deckTop - 4 ? "F" : "e"); // the toe board
      vput(c, x, deckTop - 19, "F");
      vput(c, x, deckTop - 18, "e");
      vput(c, x, deckTop - 10, "e");
    }
    for (const x of [LX0, LX0 + 1, Math.round((LX0 + LX1) / 2), LX1 - 1, LX1]) for (let y = deckTop - 19; y < deckTop; y++) vput(c, x, y, x === LX1 ? "E" : "e");
    // The control box on the front rail.
    for (let y = deckTop - 23; y < deckTop - 17; y++) for (let x = LX1 - 10; x < LX1 - 3; x++) vput(c, x, y, y === deckTop - 23 ? "M" : "S");
    vput(c, LX1 - 7, deckTop - 21, "v");
    vput(c, LX1 - 5, deckTop - 21, "r");
    beacon(c, LX0 + 1, deckTop - 24, on);
  }));
  return { ms: 120, layers: L, ...(on ? { specks: glow(LX0 + 1, deckTop - 22, on) } : {}) };
}
const RISE = { up: [2, 4, 6, 7], down: [6, 4, 2, 0] };
const liftAnims: Record<string, Anim> = {
  /** Idle (6 x 200 ms): standing at his rail, a look round (his head bobs a px). */
  idle: { loop: true, frames: [0, 0, 1, 0, 0, 1].map((t) => ({ ...liftFrame(0, t, 0, "on"), ms: 200 })) },
  /** Driving (4 x 120 ms): the wheels turn, the beacon goes round (cue `beep` f0, soft). */
  drive: { loop: true, frames: [0, 1, 2, 3].map((t) => ({ ...liftFrame(0, t, (t % 3) + 1, "on"), ...(t === 0 ? { cue: "beep" } : {}) })) },
  /** Up (once, 4 x 150 ms, cue `whir` f0): the platform rises 7 px. That's all. He nods, satisfied. */
  up: { loop: false, frames: RISE.up.map((r, i) => ({ ...liftFrame(r, 0, 0, "on"), ms: 150, ...(i === 0 ? { cue: "whir" } : {}) })) },
  /** Held up (4 x 220 ms): he looks at the stock, smiling. */
  upIdle: { loop: true, frames: [0, 1, 0, 0].map((t) => ({ ...liftFrame(7, t, 0, "on"), ms: 220 })) },
  /** Down (once, 4 x 150 ms, cue `whir` f0). */
  down: { loop: false, frames: RISE.down.map((r, i) => ({ ...liftFrame(r, 0, 0, "on"), ms: 150, ...(i === 0 ? { cue: "whir" } : {}) })) },
  /** Parked (1 frame): nobody on it, the beacon off. */
  parked: { loop: true, frames: [{ ...liftFrame(0, 0, 0, "off"), ms: 1000 }] },
};
/** The platform's rise over rest per frame of `up` / `upIdle` / `down` (px; 0 elsewhere). */
export const NPC_GREX_RISE: Readonly<Record<string, readonly number[]>> = { up: RISE.up, upIdle: [7, 7, 7, 7], down: RISE.down };
// Stepping off: he turns to the near side (f0), steps over the toe board (f1) and hops down in front of the lift (f2-f3), to the
// ground on its near side, NPC_GREX_STEP_OFF.lift from its foot (drawn in front of it).
const OFF_Y = 11; // a third of a square in front of (south of) the machine's foot
{
  const deckTop = VG - DECK0;
  const g = (p: Pose, x: number, y: number, shadow = false) => moved(build(LOOKS.lift, p).layers.slice(shadow ? 0 : 1), x, y);
  const front = (who: Layer[]): Frame => {
    const f = liftFrame(0, 0, 0, "off");
    return { ...f, layers: [...f.layers, ...who] };
  };
  liftAnims.stepOff = {
    loop: false,
    frames: [
      { ...liftFrame(0, 0, 0, g({ armF: ARMS.rail, armN: ARMS.hangN, hx: 1, bob: 1 }, 52, deckTop + 1)), ms: 140 },
      { ...front(g({ armF: ARMS.wave, armN: ARMS.rail, feet: [[-4, 0], [3, 6]], bob: -1 }, 54, deckTop + 4)), ms: 140, cue: "step" },
      { ...front(g({ armF: ARMS.wave, armN: ARMS.waveOut, feet: [[-3, 2], [3, 2]], bob: -1 }, 56, VG + OFF_Y - 9)), ms: 110 },
      { ...front(g({ bob: 2, feet: [[-4, 0], [4, 0]] }, 56, VG + OFF_Y, true)), ms: 140, cue: "step" },
    ],
  };
}
export const NPC_GREX_LIFT: Character = { id: "npc-grex-lift", name: "The scissor lift (with the lift guy)", w: VW, h: VH, foot: NPC_GREX_LIFT_FOOT, palette: VPAL, halo: "#3a2a1c", parts: VPARTS, anims: liftAnims };

// -- The forklift: a yellow body, the counterweight at the rear, the seat, an overhead guard (his neck up through it), the mast
// at the front, the forks on their carriage, a big front wheel and a smaller rear one, a beacon on the guard.
const FX0 = 18; // the body's rear and front
const FX1 = 70;
const F_TOP = VG - 30; // the body's top (the seat's cushion on it)
const MAST = 74; // the mast's x
export const NPC_GREX_FORK_FOOT: Pt = [46, VG];
/** The forks' heights (px over the ground, the tines' top): down, carry, at the shelf (level 1: 46), set down onto it. */
export const NPC_GREX_FORK_H = { down: 1, carry: 5, shelf: 47, set: 43 } as const;
const FORK_AT: Record<string, Pt[]> = {};
function forkFrame(h: number, turn: number, on: number, who: "on" | "off" | Layer[], dip = 0): Frame {
  const L: Layer[] = [];
  const add = (l: Layer | null) => l && L.push(l);
  add(vpart("fork:shadow", (c) => {
    for (let x = FX0 - 2; x <= FX1 + 22; x++) vput(c, x, VG - 1, x < FX0 + 3 || x > FX1 + 18 ? "+" : "-");
  }, false));
  // The mast's back upright and the overhead guard's rear post (behind him).
  add(vpart(`fork:back:${dip}`, (c) => {
    for (let y = VG - 68; y < F_TOP + 2; y++) for (const x of [FX0 + 10, FX0 + 11]) vput(c, x, y + dip, "S");
    for (let y = VG - 74; y < VG - 6; y++) vput(c, MAST - 3, y, "S");
  }));
  const seated: Pose = { sit: 30, armF: ARMS.wheel, armN: ARMS.wheel, feet: [[-6, 16], [-4, 16]], hy: turn % 2 };
  const guy = who === "on" ? moved(build(LOOKS.fork, seated).layers.slice(1), 30, VG + dip) : Array.isArray(who) ? who : [];
  L.push(...guy);
  // The body: the counterweight's round rear, the hood, a dark step, the wheels.
  add(vpart(`fork:body:${turn}:${dip}`, (c) => {
    for (let y = F_TOP; y < VG - 3; y++)
      for (let x = FX0; x <= FX1; x++) {
        const rear = x < FX0 + 8 && Math.hypot(x - (FX0 + 8), y - (F_TOP + 8)) > 8 && y < F_TOP + 8;
        if (rear) continue;
        let k = y === F_TOP ? "L" : y > VG - 8 ? "S" : x < FX0 + 3 ? "y" : x > FX1 - 2 ? "Y" : y > VG - 12 ? "Y" : "y";
        if (x === FX0 + 14 && y > F_TOP + 2 && y < VG - 9) k = "Y";
        if (y >= F_TOP + 4 && y <= F_TOP + 6 && x > FX0 + 2 && x < FX0 + 12) k = (x + y) % 3 ? "s" : "y"; // the counterweight's stripes
        vput(c, x, y + dip, k);
      }
    // The seat's back, black.
    for (let y = F_TOP - 12; y < F_TOP; y++) for (let x = FX0 + 12; x < FX0 + 16; x++) vput(c, x, y + dip, y === F_TOP - 12 ? "l" : "S");
    wheel(c, FX0 + 10, VG - 6, 6, turn);
    wheel(c, FX1 - 6, VG - 7, 7, turn);
  }));
  // The overhead guard's front post and roof (in front of his neck), the steering column, the beacon.
  add(vpart(`fork:guard:${on}:${dip}`, (c) => {
    const roof = VG - 70 + dip;
    for (let x = FX0 + 9; x <= FX1 - 4; x++) {
      vput(c, x, roof, "8");
      vput(c, x, roof + 1, "S");
    }
    for (let x = FX0 + 12; x <= FX1 - 6; x += 5) vput(c, x, roof + 2, "S");
    for (let y = roof; y < F_TOP + dip; y++) for (const x of [FX1 - 5, FX1 - 4]) vput(c, x, y, x === FX1 - 5 ? "M" : "S");
    // The steering column: up from the dash toward him, a wheel at its top.
    for (let j = 0; j < 12; j++) vput(c, FX1 - 8 - j * 0.6, F_TOP - j + dip, "S");
    for (let i = -3; i <= 3; i++) vput(c, FX1 - 15 + i, F_TOP - 12 + dip + Math.round(i * 0.4), "l");
    beacon(c, FX0 + 12, roof - 5, on);
  }));
  // The mast's front upright, the carriage at height h, the tines.
  add(vpart(`fork:mast:${h}`, (c) => {
    const ext = Math.max(0, h - 36);
    for (let y = VG - 74 - ext; y < VG - 4; y++) for (let x = MAST - 1; x <= MAST + 1; x++) vput(c, x, y, x === MAST - 1 ? "M" : y < VG - 74 ? "8" : "S");
    const ty = VG - 1 - h; // the tines' top
    for (let y = ty - 14; y <= ty; y++) for (let x = MAST + 2; x <= MAST + 4; x++) vput(c, x, y, x === MAST + 2 ? "M" : "S");
    for (let x = MAST + 2; x <= MAST + 27; x++) {
      vput(c, x, ty, x > MAST + 25 ? "M" : "8");
      vput(c, x, ty + 1, "S");
    }
    // The lift chains up the mast.
    for (let y = ty - 14; y > VG - 74 - ext; y -= 2) vput(c, MAST, y, "8");
  }));
  FORK_AT.__last = [[MAST + 15, VG - 1 - h]];
  return { ms: 120, layers: L, ...(on ? { specks: glow(FX0 + 12, VG - 73 + dip, on) } : {}) };
}
const forkAnims: Record<string, Anim> = {};
function forkAnim(name: string, loop: boolean, list: { h: number; turn?: number; on?: number; ms?: number; cue?: string; dip?: number; who?: "on" | "off" | Layer[] }[]) {
  FORK_AT[name] = [];
  forkAnims[name] = {
    loop,
    frames: list.map((f) => {
      const fr = forkFrame(f.h, f.turn ?? 0, f.on ?? 0, f.who ?? "on", f.dip ?? 0);
      FORK_AT[name]!.push(FORK_AT.__last![0]!);
      return { ...fr, ms: f.ms ?? 120, ...(f.cue ? { cue: f.cue } : {}) };
    }),
  };
}
const HF = NPC_GREX_FORK_H;
const steps = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => Math.round(a + ((b - a) * (i + 1)) / n));
forkAnim("idle", true, [0, 1, 0, 1].map((t) => ({ h: HF.carry, turn: 0, ms: 160, ...(t ? { dip: 0 } : {}) })));
forkAnim("drive", true, [0, 1, 2, 3].map((t) => ({ h: HF.carry, turn: t, on: (t % 3) + 1, ...(t === 0 ? { cue: "engine" } : {}) })));
forkAnim("reverse", true, [3, 2, 1, 0].map((t, i) => ({ h: HF.carry, turn: t, on: (t % 3) + 1, ...(i === 0 ? { cue: "beep" } : {}) })));
forkAnim("forksDown", false, steps(HF.carry, HF.down, 3).map((h, i) => ({ h, ms: 110, ...(i === 0 ? { cue: "hydraulic" } : {}) })));
forkAnim("forksUp", false, steps(HF.down, HF.carry, 3).map((h, i) => ({ h, ms: 110, ...(i === 0 ? { cue: "hydraulic" } : {}) })));
forkAnim("raise", false, steps(HF.carry, HF.shelf, 7).map((h, i) => ({ h, ms: 130, ...(i === 0 ? { cue: "hydraulic" } : {}) })));
forkAnim("raisePallet", false, steps(HF.carry, HF.shelf, 7).map((h, i) => ({ h, ms: 140, dip: i % 2, ...(i === 0 ? { cue: "hydraulic" } : {}) })));
forkAnim("set", false, steps(HF.shelf, HF.set, 2).map((h, i) => ({ h, ms: 150, ...(i === 1 ? { cue: "clunk" } : {}) })));
forkAnim("lift", false, steps(HF.set, HF.shelf, 2).map((h, i) => ({ h, ms: 150, dip: 1, ...(i === 0 ? { cue: "creak" } : {}) })));
forkAnim("lower", false, steps(HF.shelf, HF.carry, 7).map((h, i) => ({ h, ms: 120, ...(i === 0 ? { cue: "hydraulic" } : {}) })));
forkAnim("lowerFrom", false, steps(HF.set, HF.carry, 6).map((h, i) => ({ h, ms: 120, ...(i === 0 ? { cue: "hydraulic" } : {}) })));
forkAnim("parked", true, [{ h: HF.down, ms: 1000, who: "off" }]);
{
  // He swings his legs out to the near side (f0), stands on the step (f1), hops down (f2) and stands in front of it (f3).
  const g = (p: Pose, x: number, y: number, shadow = false) => moved(build(LOOKS.fork, p).layers.slice(shadow ? 0 : 1), x, y);
  const front = (who: Layer[], h: number): Frame => {
    const f = forkFrame(h, 0, 0, "off");
    return { ...f, layers: [...f.layers, ...who] };
  };
  FORK_AT.stepOff = [];
  const fr0 = forkFrame(HF.down, 0, 0, g({ sit: 30, armF: ARMS.wheel, armN: ARMS.hangN, feet: [[-2, 12], [2, 12]], hx: 1 }, 32, VG));
  FORK_AT.stepOff.push(FORK_AT.__last![0]!);
  const rest = [
    { ...front(g({ armF: ARMS.wave, armN: ARMS.hangN, feet: [[-3, 0], [3, 0]], bob: 2 }, 36, VG - 10), HF.down), ms: 140, cue: "step" },
    { ...front(g({ armF: ARMS.wave, armN: ARMS.waveOut, feet: [[-3, 2], [3, 2]], bob: -1 }, 40, VG + OFF_Y - 7), HF.down), ms: 110 },
    { ...front(g({ bob: 2 }, 40, VG + OFF_Y, true), HF.down), ms: 140, cue: "step" },
  ];
  for (let i = 0; i < rest.length; i++) FORK_AT.stepOff.push(FORK_AT.__last![0]!);
  forkAnims.stepOff = { loop: false, frames: [{ ...fr0, ms: 140 }, ...rest] };
}
delete FORK_AT.__last;
/** Where the pallet's foot (its bottom middle) goes, per forklift animation and frame, in the forklift's pixels: on the tines. */
export const NPC_GREX_FORK_AT: Readonly<Record<string, readonly Pt[]>> = FORK_AT;
export const NPC_GREX_FORKLIFT: Character = { ...NPC_GREX_LIFT, id: "npc-grex-forklift", name: "The forklift (with the forklift guy)", foot: NPC_GREX_FORK_FOOT, anims: forkAnims };
/**
 * Where each guy stands on the ground once off his machine (the last frame of its `stepOff`), from the machine's foot (px, x
 * then y: y is south, so he's in front of it), facing right: put his own figure there (walk, watch), drawn in front of the
 * machine. Mirror x when the machine faces left.
 */
export const NPC_GREX_STEP_OFF = { lift: [56 - NPC_GREX_LIFT_FOOT[0], OFF_Y], forklift: [40 - NPC_GREX_FORK_FOOT[0], OFF_Y] } as const;

// ---- The loose pallet: a wooden pallet, two MOON SHOT cartons on it, shrink-wrapped. 36 x 36, its foot (bottom middle) [18, 35].

export const NPC_GREX_PALLET: Character = (() => {
  const c = wcv(36, 36);
  load(c, 18, 36, 34, [["moon", 14], ["moon", 13]], 41);
  return { id: "npc-grex-pallet", name: "A pallet of MOON SHOT", w: 36, h: 36, foot: [18, 35] as Pt, palette: WAREHOUSE_PALETTE, parts: { p: whole(c, true).part }, anims: { idle: { loop: true, frames: [{ ms: 1000, layers: [{ part: "p", x: 0, y: 0 }] }] } } };
})();

Object.assign(VPARTS, PARTS, MPARTS);

/** Every crew figure, by its id. */
export const NPC_GREX: Readonly<Record<string, Character>> = Object.fromEntries(
  [NPC_GREX_LIFT_GUY, NPC_GREX_FORK_GUY, NPC_GREX_LEANER_A, NPC_GREX_LEANER_B, NPC_GREX_CREW_C, NPC_GREX_CREW_D, NPC_GREX_LIFT, NPC_GREX_FORKLIFT, NPC_GREX_PALLET].map((c) => [c.id, c]),
);
export { GROUND };
