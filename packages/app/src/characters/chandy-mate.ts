/**
 * Chandy's checkmate way into Dodge: the art (Eric, Nov 26: "instead of the game ending right away, it pauses and he jumps onto the
 * center of the board and collapses, and then he reaches his arm out though towards your king, and that's when he zaps it ... and
 * then it starts [the Dodge] ... if you do succeed ... something a little extra too right before it ends, just clearly showing that
 * you win"). Drawn on the board by ChandyDodge.tsx's MateOver at each step of dodgeTimeline's `opening` and on its `win` beat
 * (docs/decisions/2026-11-26-chandy-mate-art.md, 2026-11-26-chandy-mate-art-wired.md).
 *
 * His own rig (chandy.ts `build`), his palette and size, every animation at every rifle stage (`chandyAnim`, as his others: the mate
 * can come before or after his upgrades). In a frame `MATE_TOP` px taller than his (room over his head for the jump's lift) and
 * `MATE_LEFT` px wider (his dropped rifle behind him), so his feet stand at `CHANDY_MATE.foot`. Facing our right as drawn; toward a
 * king on our left the component mirrors the sprite.
 *
 * - `jump`: the crouch, the spring (off the ground, arms up), the tuck in the air. The leap across the screen is the component's
 *   (a translate along an arc); this is the body's part of it. The last frame holds (`air`) until he lands.
 * - `land`: the landing's squash, his knees giving way (the rifle slipping off his shoulder), then flat on his front, chin on the
 *   ground, his rifle on the ground behind him (`slumped` loops: still a long beat, then one breath). `leap` is `jump` then `land`.
 * - `reach<dir>`: he pushes himself up onto his knees, his head comes up and his near arm reaches out toward your king, at one of
 *   `REACH_DIRS` (degrees below level: straight up to straight down), holding (`reaching<dir>` loops). His rifle stays on the ground.
 *   Where he stands and which reach: `mateAim` (a square or two off the center for a king near it, so the bolt runs clear).
 * - `zap<dir>`: his hand charging cyan, the flash, a bolt off his claws along the same direction (the bolt across the board to your
 *   king is the board's: ChandyDodge's `.cd-mate-bolt`, from `mateHand`, at `ZAP_FIRE_MS`), then holding the reach.
 * - `out` (the win beat, after a survived Dodge): his lens sputters and dies, he slumps, and falls flat on his back; `ko` loops,
 *   dizzy stars over his head.
 */
import { lazyAnimsTogether, lieDown, partSize, type Anim, type Character, type Frame, type Layer, type Speck } from "./sprite.ts";
import { ARMS, CHANDY, CHANDY_FOOT, CHANDY_PARTS, REST, STAGES, build, burst, chandyAnim, flare, groundTailPart, type Built, type ChandyPose, type Pt, type RifleStage } from "./chandy.ts";

const lazyAnim = lazyAnimsTogether();

/** Room over his head for the jump (frame px): his frame is this much taller than CHANDY's, everything this much lower. */
export const MATE_TOP = 18;
/** And room under his feet (frame px): slumped, the butt of the rifle on his back sits a little lower than his feet. */
export const MATE_BELOW = 6;
/** And room on our left (frame px): his rifle, dropped, lies on the ground behind him (at full upgrade it's longer than he is). */
export const MATE_LEFT = 46;
/** The jump's frames (ms): the crouch where he stands, the spring and the tuck held in the air. The leap across the screen (the
 *  component's arc) runs from the spring to the landing: `JUMP_MS.spring + JUMP_MS.air` long, `JUMP_MS.crouch` in. */
export const JUMP_MS = { crouch: 150, spring: 100, air: 330 } as const;

type Extra = { specks?: (b: Built) => Speck[]; cue?: string; shake?: readonly [number, number]; pal?: Record<string, string> };
/** A pose with his rifle off his back, on the ground (from the collapse on); his near arm behind his head (reaching up past it). */
type MatePose = ChandyPose & { dropped?: boolean; armBehind?: boolean };
const down = (s: readonly Speck[]): Speck[] => s.map(([x, y, k]) => [x, y + MATE_TOP, k]);
function frame(stage: RifleStage, ms: number, p: MatePose, extra: Extra = {}): Frame {
  const b = build(stage, p.dropped ? { ...p, gun: { slung: true } } : p);
  let layers = b.layers;
  if (p.dropped) layers = [layers[0]!, groundRifle(stage), ...layers.slice(1).filter((l) => !l.part.startsWith("rifle:"))];
  if (p.armBehind) {
    // (The near arm is his rig's last layer: under his head instead.)
    const head = layers.findIndex((l) => l.part.startsWith("head:"));
    layers = [...layers.slice(0, head), layers.at(-1)!, ...layers.slice(head, -1)];
  }
  return {
    ms,
    layers: layers.map((l) => ({ ...l, y: l.y + MATE_TOP })),
    cue: extra.cue,
    shake: extra.shake,
    pal: extra.pal,
    specks: extra.specks ? down(extra.specks(b)) : undefined,
  };
}

/** His rifle lying flat on the ground behind him, its muzzle to our left, away from the board (slid off his back as he goes down; the
 *  KO's too): its butt under his hips, a pixel into the ground. */
function groundRifle(stage: RifleStage): Layer {
  const gun = build(stage, { ...REST, gun: { at: [0, 0], deg: 0, front: false } }).layers.find((l) => l.part.startsWith("rifle:"))!;
  const [gw, gh] = partSize(CHANDY_PARTS[gun.part]!);
  return { part: gun.part, x: CHANDY_FOOT[0] + 14 - gw, y: FOOT_Y + 1 - gh, flipX: true };
}
/** His rig's offset in his frame (chandy.ts OX, OY: his foot is the rig's [46, 106]). */
const OXY: Pt = [CHANDY_FOOT[0] - 46, CHANDY_FOOT[1] - 106];

// ---- The poses (his rig's numbers: frame px before the figure's offset; arms from their shoulders).

/** His knees on the ground, shins back along it (the kneel's legs). */
const KNEEL: Pick<ChandyPose, "legF" | "legN" | "crouch"> = {
  crouch: 7,
  legF: [
    [47, 101],
    [35, 101],
  ],
  legN: [
    [58, 101],
    [46, 101],
  ],
};
const LIMP: readonly [Pt, Pt] = [
  [1, 8],
  [3, 15],
];

export const MATE_POSES = {
  /** The crouch before the spring: low, arms swung back, eyes on the board. */
  crouch: {
    ...REST,
    crouch: 5,
    bob: 4,
    armN: [
      [-4, 7],
      [-10, 12],
    ],
    armF: [
      [-5, 6],
      [-11, 11],
    ],
    head: [1, 2],
    eye: "narrow",
  },
  /** The spring: off the ground, legs straight under him, arms flung up, a grunt. */
  spring: {
    ...REST,
    lift: 8,
    crouch: -2,
    bob: -2,
    legF: [
      [40, 97],
      [41, 104],
    ],
    legN: [
      [52, 97],
      [54, 104],
    ],
    armN: [
      [4, -8],
      [9, -15],
    ],
    armF: [
      [2, -8],
      [4, -15],
    ],
    handN: "open",
    handF: "open",
    sway: 1,
    eye: "wide",
    jaw: 2,
    shadow: false,
  },
  /** In the air: knees tucked up, arms forward, tail up. */
  air: {
    ...REST,
    lift: 14,
    crouch: -1,
    legF: [
      [46, 93],
      [41, 99],
    ],
    legN: [
      [59, 92],
      [55, 99],
    ],
    armN: [
      [7, 3],
      [14, 5],
    ],
    armF: [
      [6, 3],
      [12, 7],
    ],
    handN: "open",
    sway: 1,
    eye: "narrow",
    shadow: false,
  },
  /** The landing's squash: low, arms out for balance, mouth open. */
  land: {
    ...REST,
    crouch: 6,
    bob: 5,
    armN: [
      [6, 2],
      [12, 7],
    ],
    armF: [
      [-6, 2],
      [-12, 6],
    ],
    handN: "open",
    handF: "open",
    eye: "wide",
    jaw: 2,
    head: [1, 1],
  },
  /** His knees giving way: down on them, arms dropping, the rifle slipping off his shoulder, the lens flickering out. */
  buckle: {
    ...REST,
    ...KNEEL,
    bob: 9,
    armN: LIMP,
    armF: ARMS.hang,
    gun: { at: [-22, 12], deg: -150, front: false },
    head: [3, 5],
    eye: "narrow",
    jaw: 1,
    lens: 0,
  },
  /** Pushing himself back up off the ground onto his knees (the reach's start): head low, arms down, his rifle left lying. */
  rise: {
    ...REST,
    ...KNEEL,
    bob: 11,
    armN: LIMP,
    armF: ARMS.hang,
    dropped: true,
    head: [3, 7],
    eye: "blink",
    jaw: 1,
    lens: 0,
  },
} satisfies Record<string, MatePose>;
const P = MATE_POSES;

/** The directions he can reach in, degrees below level, facing our right (mirrored for a king on our left): straight up to straight
 *  down, 30° apart, and 45° down too (the crowd's king is most often down the board from him; between 30 and 60 down the bolt was 17°
 *  off his arm, measured from each reach's own hand). */
export const REACH_DIRS = [-90, -60, -30, 0, 30, 45, 60, 90] as const;
export type ReachDir = (typeof REACH_DIRS)[number];
/** An animation's direction suffix: `U90`, `U60`, `U30`, `0`, `D30`, `D45`, `D60`, `D90`. */
export const reachSuffix = (deg: ReachDir): string => (deg < 0 ? `U${-deg}` : deg === 0 ? "0" : `D${deg}`);

const along = (deg: number, r: number, bend = 0): Pt => {
  const a = (deg * Math.PI) / 180;
  return [Math.round(Math.cos(a) * r - Math.sin(a) * bend), Math.round(Math.sin(a) * r + Math.cos(a) * bend)];
};
/** Kneeling, head up toward the king, the near arm out at `deg` (`full` false: on its way). Reaching steeply up (60° or more), his arm
 *  goes up behind his head, longer, so his claws show over it (in front, it crossed his face: a hand on his snout, not a reach). */
function reachPose(deg: number, full: boolean): MatePose {
  const up = deg <= -60;
  const r = deg === -90 ? 42 : up ? 36 : 21;
  return {
    ...REST,
    ...KNEEL,
    bob: full ? 6 : 8,
    armN: full ? [along(deg, r / 2, -1), along(deg, r)] : [along(deg, 6, 2), along(deg, 12, 1)],
    armBehind: up,
    armF: ARMS.hang,
    handN: "open",
    dropped: true,
    head: full ? [2, 2] : [2, 4],
    eye: full ? "narrow" : "open",
    jaw: full ? 0 : 1,
    lens: full ? 1 : 0,
  };
}

// ---- Specks: dust, the hand's charge, the bolt, the dizzy stars.

const FOOT_Y = CHANDY_FOOT[1];
/** Dust kicked up at his feet: `t` 0 (a low puff) or 1 (spread and thinning). */
function dust(t: 0 | 1): Speck[] {
  const [fx, fy] = CHANDY_FOOT;
  const out: Speck[] = [];
  const spread = t === 0 ? [6, 10, 14] : [10, 16, 22];
  for (const [i, d] of spread.entries())
    for (const side of [-1, 1]) {
      const x = fx + side * d + (side > 0 ? 6 : -2);
      const y = fy - 1 - (t === 0 ? i : i + 1);
      out.push([x, y, t === 0 ? "h" : "g"], [x + side, y + (t === 0 ? 0 : 1), "g"]);
    }
  return out.map(([x, y, k]) => [x, Math.min(y, FOOT_Y - 1), k]);
}
/** The hand charging: a ring of energy round the claws, growing (`r` 1..3), the white-hot middle. */
const charge = (b: Built, deg: number, r: number): Speck[] => {
  const [dx, dy] = along(deg, 4);
  return flare([b.hand[0] + dx, b.hand[1] + dy], r, "Q", "O");
};
/** The bolt off his claws along `deg`: a jagged line, white-hot to cyan, `len` px; `t` 0 fresh, 1 thinning. */
function boltSpecks(b: Built, deg: number, len: number, t: 0 | 1): Speck[] {
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const [hx, hy] = along(deg, 5);
  const x0 = b.hand[0] + hx;
  const y0 = b.hand[1] + hy;
  const out: Speck[] = [];
  const jag = [0, 1, 2, 1, 0, -1, -2, -1];
  for (let i = 0; i < len; i++) {
    const j = jag[Math.floor(i / 2) % jag.length]!;
    const x = Math.round(x0 + ux * i - uy * j);
    const y = Math.round(y0 + uy * i + ux * j);
    if (t === 1 && i % 3 === 2) continue;
    out.push([x, y, t === 0 ? (i < len * 0.6 ? "Q" : "O") : i < len * 0.4 ? "O" : "F"]);
    if (t === 0) out.push([Math.round(x - uy), Math.round(y + ux), "O"]);
  }
  // (Kept a pixel in from his frame's edges: past them the board's bolt carries on.)
  return out.filter(([x, y]) => x > 0 && x < CHANDY.w - 1 && y > 0 && y < CHANDY.h + MATE_BELOW - 1);
}
/** Dizzy stars over his head (the KO), turning: `i` 0 or 1. */
function stars([hx, hy]: Pt, i: 0 | 1): Speck[] {
  const out: Speck[] = [];
  const at: Pt[] =
    i === 0
      ? [
          [-9, -3],
          [0, -6],
          [9, -3],
        ]
      : [
          [-5, -5],
          [5, -5],
          [11, -1],
        ];
  for (const [dx, dy] of at) {
    const x = hx + dx;
    const y = hy + dy;
    out.push([x, y, "w"], [x - 1, y, "Y"], [x + 1, y, "Y"], [x, y - 1, "Y"], [x, y + 1, "Y"]);
  }
  return out;
}

// ---- Lying down: the KO flat on his back, head to our left, feet in the air (the defeat: Ginger's and Grex's way, `lieDown`); the
// collapse flat on his front, head to our right toward the board, his chin on the ground. His tail along the ground either way (its own
// part: turned, it would point into the ground or the sky); on his front, his head unturned (turned, his snout would dig in).

const KO_POSE: ChandyPose = { ...REST, armN: ARMS.hang, armF: ARMS.hang, eye: "blink", lens: 0, jaw: 1, shadow: false };
/** Flopped on his front: the near arm flung out ahead of him (up, standing), the far one back along his side, eyes shut. */
const FLAT_POSE: ChandyPose = {
  ...REST,
  armN: [
    [3, -8],
    [5, -16],
  ],
  armF: ARMS.hang,
  handN: "open",
  eye: "blink",
  lens: 0,
  jaw: 1,
  shadow: false,
};
type Lying = { cue?: string; star?: 0 | 1; shake?: readonly [number, number]; specks?: Speck[]; breath?: number; eye?: ChandyPose["eye"] };
/** His standing figure laid along the ground, `face` up (the KO) or down (the collapse), centered on his foot point. */
function lyingFrame(stage: RifleStage, ms: number, face: "up" | "down", extra: Lying = {}): Frame {
  const pose = face === "up" ? KO_POSE : { ...FLAT_POSE, eye: extra.eye ?? FLAT_POSE.eye };
  const b = build(stage, pose);
  const way = face === "up" ? "left" : "right";
  // (Left out of the turn: his tail, drawn along the ground instead, and his rifle, off his back on the ground; on his front his head.)
  const skip = face === "up" ? /^(tail|rifle):/ : /^(tail|rifle|head):/;
  const lying = lieDown(CHANDY_PARTS, { layers: b.layers.filter((l) => !skip.test(l.part)) }, 0, 0, way).layers;
  const turn = ([x, y]: Pt): Pt => (way === "left" ? [y, -x] : [-y - 1, x]);
  const headL = b.layers.find((l) => l.part.startsWith("head:"))!;
  const [hw, hh] = partSize(CHANDY_PARTS[headL.part]!);
  // On his front: the back of his skull on his neck (the standing [48, 58] turned), his chin on the ground (placed below).
  const neck = turn([NECK_AT[0], NECK_AT[1]]);
  const box = lying.map((l) => {
    const [w, h] = partSize(CHANDY_PARTS[l.part]!, l.rot ?? 0);
    return [l.x, l.y, l.x + w, l.y + h] as const;
  });
  if (face === "down") box.push([neck[0] - 6, 0, neck[0] - 6 + hw, 0]);
  const x0 = Math.min(...box.map((q) => q[0]));
  const x1 = Math.max(...box.map((q) => q[2]));
  const y1 = Math.max(...box.map((q) => q[3]));
  const sx = CHANDY_FOOT[0] - 4 - Math.round((x0 + x1) / 2);
  const ground = FOOT_Y + MATE_TOP;
  const sy = ground - y1 - (extra.breath ?? 0);
  const shadow = build(stage, REST).layers[0]!;
  // His hips (the standing figure's [45, 89] + its offset, turned): the tail runs from there along the ground, away from his head.
  const hip0 = turn([CHANDY_FOOT[0] - 1, CHANDY_FOOT[1] - 31]);
  const hip: Pt = [hip0[0] + sx, hip0[1] + sy];
  const t = face === "up" ? groundTailPart([hip[0] - 2, hip[1] + 3], ground, 1) : groundTailPart([hip[0] + 2, hip[1] + 3], ground, -1);
  const layers: Layer[] = [
    { ...shadow, y: shadow.y + MATE_TOP },
    (({ y, ...g }) => ({ ...g, y: y - 1 + MATE_TOP }))(groundRifle(stage)),
    ...(t ? [{ part: t.name, x: t.at[0], y: t.at[1] }] : []),
    ...lying.map((l) => ({ ...l, x: l.x + sx, y: l.y + sy })),
  ];
  if (face === "down") {
    // His head ahead of his shoulders, chin on the ground; the flung arm (the last layer) over it.
    const arm = layers.pop()!;
    layers.push({ part: headL.part, x: neck[0] + sx - 6, y: ground - hh }, arm);
  }
  // On his back, his head at the left end, snout up (its lens turned with him): the stars circle over the snout's tip.
  const head: Pt = [Math.round(b.lens[1] + sx) + 3, Math.max(8, Math.round(-b.lens[0] + sy) - 36)];
  const specks = [...(extra.star === undefined ? [] : stars(head, extra.star)), ...(extra.specks ?? [])];
  return { ms, layers, cue: extra.cue, shake: extra.shake, specks: specks.length ? specks : undefined };
}
const koFrame = (stage: RifleStage, ms: number, extra: Lying = {}): Frame => lyingFrame(stage, ms, "up", extra);
/** His neck in his frame (the rig's [48, 58] plus its offset). */
const NECK_AT: Pt = [48 + OXY[0], 58 + OXY[1]];

// ---- The animations.

function jumpOf(stage: RifleStage): Anim {
  return {
    loop: false,
    frames: [
      frame(stage, JUMP_MS.crouch, P.crouch, { cue: "unsling" }),
      frame(stage, JUMP_MS.spring, P.spring, { cue: "whoosh", specks: () => dust(0) }),
      frame(stage, JUMP_MS.air, P.air),
    ],
  };
}
/** The flop's dust: puffs along the ground the length of him. */
const flopDust = (t: 0 | 1): Speck[] => [-30, 0, 30].flatMap((dx) => dust(t).map(([x, y, k]): Speck => [x + dx, y, k])).filter(([x]) => x > 0 && x < CHANDY.w - 1);
function landOf(stage: RifleStage): Anim {
  return {
    loop: false,
    frames: [
      frame(stage, 100, P.land, { cue: "unsling", shake: [0, 2], specks: () => dust(0) }),
      frame(stage, 150, P.buckle, { cue: "fizz", specks: () => dust(1) }),
      lyingFrame(stage, 130, "down", { cue: "unsling", shake: [0, 3], breath: 2, specks: down(flopDust(0)) }),
      lyingFrame(stage, 220, "down", { specks: down(flopDust(1)) }),
      lyingFrame(stage, 400, "down"),
    ],
  };
}
/** Flat on the ground and still: a long beat, then one breath. */
const slumpedOf = (stage: RifleStage): Anim => ({
  loop: true,
  frames: [lyingFrame(stage, 1400, "down"), lyingFrame(stage, 500, "down", { breath: 1 })],
});
function reachOf(stage: RifleStage, deg: ReachDir): Anim {
  return {
    loop: false,
    frames: [
      frame(stage, 160, P.rise, { cue: "unsling" }),
      frame(stage, 200, reachPose(deg, false), { cue: "lock" }),
      frame(stage, 400, reachPose(deg, true), { specks: (b) => flare([b.lens[0] - 1, b.lens[1] - 1], 2) }),
    ],
  };
}
const reachingOf = (stage: RifleStage, deg: ReachDir): Anim => ({
  loop: true,
  frames: [frame(stage, 1000, reachPose(deg, true))],
});
function zapOf(stage: RifleStage, deg: ReachDir): Anim {
  const R = reachPose(deg, true);
  const hot = { ...R, lens: 2 as const };
  return {
    loop: false,
    frames: [
      frame(stage, 140, hot, { cue: "aim", specks: (b) => [...charge(b, deg, 1), ...flare([b.lens[0] - 1, b.lens[1] - 1], 3)] }),
      frame(stage, 140, hot, { specks: (b) => charge(b, deg, 2) }),
      frame(stage, 160, hot, { specks: (b) => charge(b, deg, 3) }),
      frame(stage, 90, { ...hot, jaw: 2 }, { cue: "fire", shake: [1, 0], specks: (b) => [...burstAt(b, deg, 0), ...boltSpecks(b, deg, 30, 0)] }),
      frame(stage, 110, hot, { specks: (b) => [...burstAt(b, deg, 1), ...boltSpecks(b, deg, 30, 1)] }),
      frame(stage, 300, R),
    ],
  };
}
/** His muzzle's burst (chandy.ts `burst`) at his claws instead. */
const burstAt = (b: Built, deg: number, t: 0 | 1): Speck[] => {
  const [dx, dy] = along(deg, 3);
  // (`burst` throws its rays to our right: only its ball for any other direction.)
  return burst([b.hand[0] + dx - 2, b.hand[1] + dy], deg === 0 ? t : 1);
};
function outOf(stage: RifleStage): Anim {
  return {
    loop: false,
    frames: [
      frame(stage, 140, { ...reachPose(0, false), lens: 2, eye: "wide" }, { cue: "fizz", specks: (b) => flare([b.lens[0] - 1, b.lens[1] - 1], 3, "O", "F") }),
      frame(stage, 120, { ...reachPose(0, false), lens: 0, eye: "wide" }, { specks: (b) => flare([b.lens[0] - 1, b.lens[1] - 1], 1, "F", "q") }),
      frame(stage, 260, P.rise),
      koFrame(stage, 140, { cue: "unlock", shake: [0, 2] }),
      koFrame(stage, 500, { star: 0 }),
    ],
  };
}
const koOf = (stage: RifleStage): Anim => ({
  loop: true,
  frames: [koFrame(stage, 360, { star: 0 }), koFrame(stage, 360, { star: 1 })],
});
const idleOf = (stage: RifleStage): Anim => ({ loop: true, frames: [frame(stage, 1000, REST)] });

/** An animation drawn in his own frame's numbers, moved MATE_LEFT px right in the mate's wider frame. */
const leftRoom = (a: Anim): Anim => ({
  ...a,
  frames: a.frames.map((f) => ({ ...f, layers: f.layers.map((l) => ({ ...l, x: l.x + MATE_LEFT })), specks: f.specks?.map(([x, y, k]): Speck => [x + MATE_LEFT, y, k]) })),
});
/** The zap's charge (ms): when its bolt leaves his claws, the bolt across the board with it (ChandyDodge). */
export const ZAP_FIRE_MS = 140 + 140 + 160;
/** His reaching hand at `deg` (the bolt's start), in his checkmate frame's px, facing our right. */
export function mateHand(deg: ReachDir): Pt {
  const b = build(0, reachPose(deg, true));
  const [dx, dy] = along(deg, 5);
  return [b.hand[0] + dx + MATE_LEFT, b.hand[1] + dy + MATE_TOP];
}

/** His checkmate figure's art px a board: a board 384 px across draws him a CSS px an art px (ChandyDodge's `.cd-mate-fig`). */
export const MATE_PX = 384;
/** A king within this many squares of the board's center (across, and down the screen, from his square's middle) has him land off
 *  the center; and up the screen, within MATE_NEAR_UP (his reaching hand is high: straight over his head it's 1.7 squares up). */
export const MATE_NEAR = 1.5;
export const MATE_NEAR_UP = 2.5;
/** How far off the center he lands then, in squares, away from the king's side. */
export const MATE_ASIDE = 2;
const FILES = "abcdefgh";
/** A square's middle on the screen, in board sizes from the board's center (x right, y down); the board flipped for the black crowd. */
export function boardPoint(square: string, side: "white" | "black"): Pt {
  const f = FILES.indexOf(square[0]!);
  const r = Number(square[1]) - 1;
  const [c, row] = side === "white" ? [f, 7 - r] : [7 - f, r];
  return [(c + 0.5) / 8 - 0.5, (row + 0.5) / 8 - 0.5];
}
export interface MateAim {
  /** Where his feet stand (board sizes from the center): the center, or MATE_ASIDE squares off it for a king near it. */
  feet: Pt;
  /** Facing our left (the king on his left): the sprite mirrored about his feet. */
  mirror: boolean;
  dir: ReachDir;
  /** His reaching hand (the bolt's start), from the center; and from there to the king's middle. */
  hand: Pt;
  to: Pt;
}
/**
 * Where he lands for your mate and which way he reaches (the director, Nov 26): on the board's center, or, for a king near it (MATE_NEAR,
 * MATE_NEAR_UP), MATE_ASIDE squares across, away from the king's side, so he never stands over the king and the bolt runs clear; facing
 * the king; at the reach whose own hand points nearest the king (the bolt's angle off his arm: 15° at most, every square).
 */
export function mateAim(king: string, side: "white" | "black"): MateAim {
  const k = boardPoint(king, side);
  const near = Math.abs(k[0]) <= MATE_NEAR / 8 && k[1] <= MATE_NEAR / 8 && k[1] >= -MATE_NEAR_UP / 8;
  const feet: Pt = [near ? (k[0] < 0 ? MATE_ASIDE : -MATE_ASIDE) / 8 : 0, 0];
  const mirror = k[0] < feet[0];
  const m = mirror ? -1 : 1;
  const [fx, fy] = CHANDY_MATE.foot;
  let best: MateAim | null = null;
  let off = Infinity;
  for (const dir of REACH_DIRS) {
    const [hx, hy] = mateHand(dir);
    const hand: Pt = [feet[0] + (m * (hx - fx)) / MATE_PX, feet[1] + (hy - fy) / MATE_PX];
    const to: Pt = [k[0] - hand[0], k[1] - hand[1]];
    const d = Math.abs((Math.atan2(to[1], m * to[0]) * 180) / Math.PI - dir);
    if (d < off) [best, off] = [{ feet, mirror, dir, hand, to }, d];
  }
  return best!;
}

const MAKERS: Record<string, (stage: RifleStage) => Anim> = {
  idle: idleOf,
  jump: jumpOf,
  land: landOf,
  /** The jump and the collapse in one (the opening's `jump` step plays it, then `slumped`). */
  leap: (st) => ({ loop: false, frames: [...jumpOf(st).frames, ...landOf(st).frames] }),
  slumped: slumpedOf,
  out: outOf,
  ko: koOf,
  ...Object.fromEntries(
    REACH_DIRS.flatMap((d) => [
      [`reach${reachSuffix(d)}`, (st: RifleStage) => reachOf(st, d)],
      [`reaching${reachSuffix(d)}`, (st: RifleStage) => reachingOf(st, d)],
      [`zap${reachSuffix(d)}`, (st: RifleStage) => zapOf(st, d)],
    ]),
  ),
};
/** The mate's animation names (at rifle stage 0; `chandyAnim(name, stage)` for the others). */
export const MATE_ANIMS = Object.keys(MAKERS);

/** Chandy's checkmate figure: his size and palette, MATE_TOP px taller for the jump, every animation at every rifle stage. */
export const CHANDY_MATE: Character = {
  ...CHANDY,
  id: "chandy-mate",
  name: "Chandy (checkmate)",
  w: CHANDY.w + MATE_LEFT,
  h: CHANDY.h + MATE_TOP + MATE_BELOW,
  foot: [CHANDY_FOOT[0] + MATE_LEFT, CHANDY_FOOT[1] + MATE_TOP],
  looks: undefined,
  anims: Object.fromEntries(STAGES.flatMap((st) => Object.entries(MAKERS).map(([name, make]) => [chandyAnim(name, st), lazyAnim(() => leftRoom(make(st)))]))),
};

/** For the preview only: his base rifle and the full one (`npm run preview:characters -- <dir> extra=<this file> only=chandy-mate-preview`). */
export const CHANDY_MATE_PREVIEW: Character = {
  ...CHANDY_MATE,
  id: "chandy-mate-preview",
  anims: Object.fromEntries(Object.entries(CHANDY_MATE.anims).filter(([k]) => !/_s[1-4]$/.test(k))),
};
