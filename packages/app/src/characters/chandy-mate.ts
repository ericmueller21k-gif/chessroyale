/**
 * Chandy's checkmate way into Dodge: the art (Eric, Nov 26: "instead of the game ending right away, it pauses and he jumps onto the
 * center of the board and collapses, and then he reaches his arm out though towards your king, and that's when he zaps it ... and
 * then it starts [the Dodge] ... if you do succeed ... something a little extra too right before it ends, just clearly showing that
 * you win"). Phase 1: the poses only, not wired to the rules job's timeline yet (docs/decisions/2026-11-26-chandy-mate-art.md).
 *
 * His own rig (chandy.ts `build`), his palette and size, every animation at every rifle stage (`chandyAnim`, as his others: the mate
 * can come before or after his upgrades). In a frame `MATE_TOP` px taller than his (room over his head for the jump's lift), so his
 * feet stand at `CHANDY_MATE.foot`. Facing our right as drawn; toward a king on our left the component mirrors the sprite.
 *
 * - `jump`: the crouch, the spring (off the ground, arms up), the tuck in the air. The leap across the screen is the component's
 *   (a translate along an arc); this is the body's part of it. The last frame holds (`air`) until he lands.
 * - `land`: the landing's squash, his knees giving way, slumped on his knees (`slumped` loops: his shoulders heaving, his lens dark).
 * - `reach<dir>`: from the slump his head comes up and his near arm reaches out toward your king, at one of `REACH_DIRS` (degrees
 *   below level: -30 up and forward to 90 straight down), holding (`reaching<dir>` loops).
 * - `zap<dir>`: his hand charging cyan, the flash, a bolt off his claws along the same direction (the bolt across the board to your
 *   king is the board's: the Lock-on Shot's round, effects/chandy.ts `PIERCING_ROUND`), then holding the reach.
 * - `out` (the win beat, after a survived Dodge): his lens sputters and dies, he slumps, and falls flat on his face; `ko` loops,
 *   dizzy stars over his head.
 */
import { lazyAnimsTogether, lieDown, partSize, type Anim, type Character, type Frame, type Layer, type Speck } from "./sprite.ts";
import { ARMS, CHANDY, CHANDY_FOOT, CHANDY_PARTS, REST, STAGES, build, burst, chandyAnim, flare, groundTailPart, type Built, type ChandyPose, type Pt, type RifleStage } from "./chandy.ts";

const lazyAnim = lazyAnimsTogether();

/** Room over his head for the jump (frame px): his frame is this much taller than CHANDY's, everything this much lower. */
export const MATE_TOP = 18;
/** And room under his feet (frame px): slumped, the butt of the rifle on his back sits a little lower than his feet. */
export const MATE_BELOW = 6;

type Extra = { specks?: (b: Built) => Speck[]; cue?: string; shake?: readonly [number, number]; pal?: Record<string, string> };
const down = (s: readonly Speck[]): Speck[] => s.map(([x, y, k]) => [x, y + MATE_TOP, k]);
function frame(stage: RifleStage, ms: number, p: ChandyPose, extra: Extra = {}): Frame {
  const b = build(stage, p);
  return {
    ms,
    layers: b.layers.map((l) => ({ ...l, y: l.y + MATE_TOP })),
    cue: extra.cue,
    shake: extra.shake,
    pal: extra.pal,
    specks: extra.specks ? down(extra.specks(b)) : undefined,
  };
}

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
  /** His knees giving way: down on them, arms dropping, the lens flickering out. */
  buckle: {
    ...REST,
    ...KNEEL,
    bob: 7,
    armN: LIMP,
    armF: ARMS.hang,
    gun: { slung: true, dy: 1 },
    head: [2, 3],
    eye: "narrow",
    jaw: 1,
    lens: 0,
  },
  /** Slumped on his knees, head hung, eyes shut, the lens dark: the pose to hold. */
  slump: {
    ...REST,
    ...KNEEL,
    bob: 11,
    armN: LIMP,
    armF: ARMS.hang,
    gun: { slung: true, dy: 2 },
    head: [3, 7],
    eye: "blink",
    jaw: 1,
    lens: 0,
  },
} satisfies Record<string, ChandyPose>;
const P = MATE_POSES;

/** The directions he can reach in, degrees below level, facing our right (mirrored for a king on our left). */
export const REACH_DIRS = [-30, 0, 30, 60] as const;
export type ReachDir = (typeof REACH_DIRS)[number];
/** An animation's direction suffix: `U30`, `0`, `D30`, `D60` (a king straight below: D60, the board's bolt bends the rest). */
export const reachSuffix = (deg: ReachDir): string => (deg < 0 ? `U${-deg}` : deg === 0 ? "0" : `D${deg}`);
/** The nearest of REACH_DIRS to a direction (degrees below level, facing his way): the component's pick for a king. */
export const nearestReach = (deg: number): ReachDir => REACH_DIRS.reduce((a, b) => (Math.abs(b - deg) < Math.abs(a - deg) ? b : a));

const along = (deg: number, r: number, bend = 0): Pt => {
  const a = (deg * Math.PI) / 180;
  return [Math.round(Math.cos(a) * r - Math.sin(a) * bend), Math.round(Math.sin(a) * r + Math.cos(a) * bend)];
};
/** Kneeling, head up toward the king, the near arm out at `deg` (`full` false: on its way). */
function reachPose(deg: number, full: boolean): ChandyPose {
  return {
    ...REST,
    ...KNEEL,
    bob: full ? 6 : 8,
    armN: full ? [along(deg, 10, -1), along(deg, 21)] : [along(deg, 6, 2), along(deg, 12, 1)],
    armF: ARMS.hang,
    handN: "open",
    gun: { slung: true, dy: 1 },
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

// ---- The KO: flat on his back, head to our left, feet in the air (the defeat: Ginger's and Grex's way, `lieDown`); his tail
// along the ground (its own part: turned, it would point into the ground).

const KO_POSE: ChandyPose = { ...REST, armN: ARMS.hang, armF: ARMS.hang, eye: "blink", lens: 0, jaw: 1, shadow: false };
/** The KO's frame: his standing figure laid down on its front along the ground, centered on his foot point. */
function koFrame(stage: RifleStage, ms: number, extra: { cue?: string; star?: 0 | 1; shake?: readonly [number, number] } = {}): Frame {
  const b = build(stage, KO_POSE);
  // (Left out of the turn: his tail, drawn along the ground instead, and his rifle, knocked off his back to lie flat behind him.)
  const lying = lieDown(CHANDY_PARTS, { layers: b.layers.filter((l) => !/^(tail|rifle):/.test(l.part)) }, 0, 0, "left").layers;
  const box = lying.map((l) => {
    const [w, h] = partSize(CHANDY_PARTS[l.part]!, l.rot ?? 0);
    return [l.x, l.y, l.x + w, l.y + h] as const;
  });
  const x0 = Math.min(...box.map((q) => q[0]));
  const x1 = Math.max(...box.map((q) => q[2]));
  const y1 = Math.max(...box.map((q) => q[3]));
  const sx = CHANDY_FOOT[0] - 4 - Math.round((x0 + x1) / 2);
  const sy = FOOT_Y + MATE_TOP - y1;
  const shadow = build(stage, REST).layers[0]!;
  const gun = build(stage, { ...KO_POSE, gun: { at: [0, 0], deg: 0, front: false } }).layers.find((l) => l.part.startsWith("rifle:"))!;
  const [, gh] = partSize(CHANDY_PARTS[gun.part]!);
  // His hips (the standing figure's [45, 89] + its offset, turned): the tail runs from there to our right along the ground.
  const [hx, hy] = [CHANDY_FOOT[0] - 1, CHANDY_FOOT[1] - 31];
  const hip: Pt = [hy + sx, -hx + sy];
  const t = groundTailPart([hip[0] - 2, hip[1] + 3], FOOT_Y + MATE_TOP, 1);
  const layers: Layer[] = [
    { ...shadow, y: shadow.y + MATE_TOP },
    { part: gun.part, x: 4, y: FOOT_Y + MATE_TOP - gh },
    ...(t ? [{ part: t.name, x: t.at[0], y: t.at[1] }] : []),
    ...lying.map((l) => ({ ...l, x: l.x + sx, y: l.y + sy })),
  ];
  // His head at the left end, snout up (its lens turned with him): the stars circle over the snout's tip.
  const head: Pt = [Math.round(b.lens[1] + sx) + 3, Math.max(8, Math.round(-b.lens[0] + sy) - 36)];
  return { ms, layers, cue: extra.cue, shake: extra.shake, specks: extra.star === undefined ? undefined : stars(head, extra.star) };
}

// ---- The animations.

function jumpOf(stage: RifleStage): Anim {
  return {
    loop: false,
    frames: [
      frame(stage, 180, P.crouch, { cue: "unsling" }),
      frame(stage, 110, P.spring, { cue: "whoosh", specks: () => dust(0) }),
      frame(stage, 400, P.air),
    ],
  };
}
function landOf(stage: RifleStage): Anim {
  return {
    loop: false,
    frames: [
      frame(stage, 120, P.land, { cue: "unsling", shake: [0, 2], specks: () => dust(0) }),
      frame(stage, 160, P.buckle, { cue: "fizz", specks: () => dust(1) }),
      frame(stage, 600, P.slump),
    ],
  };
}
const slumpedOf = (stage: RifleStage): Anim => ({
  loop: true,
  frames: [frame(stage, 700, P.slump), frame(stage, 600, { ...P.slump, bob: 12 })],
});
function reachOf(stage: RifleStage, deg: ReachDir): Anim {
  return {
    loop: false,
    frames: [
      frame(stage, 220, reachPose(deg, false), { cue: "lock" }),
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
      frame(stage, 260, P.slump),
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

const MAKERS: Record<string, (stage: RifleStage) => Anim> = {
  idle: idleOf,
  jump: jumpOf,
  land: landOf,
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
  h: CHANDY.h + MATE_TOP + MATE_BELOW,
  foot: [CHANDY_FOOT[0], CHANDY_FOOT[1] + MATE_TOP],
  looks: undefined,
  anims: Object.fromEntries(STAGES.flatMap((st) => Object.entries(MAKERS).map(([name, make]) => [chandyAnim(name, st), lazyAnim(() => make(st))]))),
};

/** For the preview only: his base rifle and the full one (`npm run preview:characters -- <dir> extra=<this file> only=chandy-mate-preview`). */
export const CHANDY_MATE_PREVIEW: Character = {
  ...CHANDY_MATE,
  id: "chandy-mate-preview",
  anims: Object.fromEntries(Object.entries(CHANDY_MATE.anims).filter(([k]) => !/_s[1-4]$/.test(k))),
};
