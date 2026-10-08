/**
 * The Black Knight (boss tier 4, from 1900): a dark armoured knight with a plumed helm, a winged spear and a ragged
 * cape, after Eric's reference picture. Drawn facing left, light from the top left.
 */
import { canvas, edge, ellipse, line, poly, tint, toGrid } from "./paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "./sprite.ts";

const PALETTE = {
  k: "#0b0b0f", // outline, seams
  a: "#141316", // armour: deepest shadow
  b: "#1f1d20", // dark
  c: "#2f2b2c", // mid (warm, like the reference)
  d: "#4a413c", // light
  e: "#8b7d74", // warm rim
  f: "#d2bcad", // bright rim
  j: "#0b0b0f", // eyes, dark until they flash
  J: "#0b0b0f", // their cores
  m: "#18171b", // cape and plume: darkest
  n: "#27252b", // dark
  o: "#363339", // mid
  p: "#5a5459", // lit edge
  s: "#3a2c23", // spear shaft
  t: "#5f4838", // shaft, lit side
  w: "#e6dfd8", // blade, bright edge
  x: "#a59d98", // blade, shaded edge
  y: "#4e535c", // blade's fuller
  r: "#8c3a2c", // red binding
  R: "#c4573f",
  E: "#ff5a3c", // eye glow
  F: "#ffd9b0",
  g: "#f2c14e", // gold spark
  G: "#fff1c4",
  q: "#9aa3b5", // motion streak
  z: "#0d0e12", // ground shadow
} as const;

const SHAFT = "....ts....";
const spear: Part = {
  grid: [
    "....wx....",
    "....wx....",
    "...wwyx...",
    "...wyyx...",
    "...wyyx...",
    "..wwyyxx..",
    "..wwyyxx..",
    "..wwyyxx..",
    ".wwwyyxxx.",
    ".wwwyyxxx.",
    "wwwxyyxxxx",
    "ww..yy..xx",
    "w...yy...x",
    "....ss....",
    "...Rrrr...",
    "...Rrrr...",
    ...Array<string>(46).fill(SHAFT),
  ],
};

const helmet: Part = {
  grid: [
    ".......cddccb.......",
    ".....ccdeedccbbb....",
    "....cdeffedcbbbbb...",
    "...cdeffedccbbbbba..",
    "..ccdeedcccbbbbbbaa.",
    "..cddedccbbbbbbbbaa.",
    ".ccddeccbbbbbbbbbbaa",
    ".cddeccbbbbbbbbbbbaa",
    "ccdeeeeeeeeeeeeedcba",
    "cfkjJkkkkkkjJkkkkeba",
    "cekjjkkkkkkjjkkkkdba",
    "cdfeeefkkfeeeeeedbaa",
    "cddcccekkecbbbbbbbaa",
    "cddccdekkecbbbbbbbaa",
    "ccdccdekkecbbbbbbaaa",
    ".ccccdekkecbbbbbbaa.",
    ".cccceeffeecbbbbbaa.",
    "..ccccdeedcbbbbbaa..",
    "...cccccbbbbbbbaa...",
    ".....ccbbbbbbba.....",
  ],
};

/** The plume, painted: a tuft from the crown that curls forward, then streams back and down to frayed tips. */
const plume: Part = (() => {
  const cv = canvas(27, 19);
  poly(cv, [[5, 10], [3, 6], [1, 5], [0, 3], [2, 1], [6, 0], [11, 0], [16, 2], [20, 5], [23, 9], [26, 14], [22, 12], [23, 18], [19, 12], [16, 8], [12, 6], [8, 6], [8, 10]], "n");
  line(cv, 3, 2, 10, 2, "o");
  line(cv, 11, 2, 18, 5, "o");
  line(cv, 19, 6, 22, 10, "o");
  line(cv, 9, 4, 14, 4, "m");
  edge(cv, 0, -1, "*", "p");
  edge(cv, 0, 1, "n", "m");
  edge(cv, 0, 1, "o", "m");
  return { grid: toGrid(cv) };
})();

/** The cape, painted: it hangs from the far shoulder and streams out to the right, ragged at the hem. */
const cape: Part = (() => {
  const cv = canvas(39, 37);
  poly(cv, [[8, 3], [22, 2], [30, 2], [34, 3], [35, 5], [34, 8], [30, 10], [27, 14], [24, 20], [23, 26], [24, 31], [23, 35], [21, 32], [19, 36], [17, 32], [15, 35], [13, 31], [11, 34], [9, 30], [7, 26], [6, 10]], "n");
  // Mostly flat and dark, like the reference: a lit band along the top, one soft fold, a lit outer edge.
  for (const [k, pts] of [
    ["o", [[33, 4], [27, 5], [22, 4], [9, 4]]],
    ["m", [[32, 7], [27, 10], [23, 15], [20, 22], [19, 30]]],
    ["o", [[30, 7], [25, 10], [21, 15], [18, 22], [17, 29]]],
  ] as const)
    pts.slice(1).forEach(([x, y], i) => line(cv, pts[i]![0], pts[i]![1], x, y, k));
  edge(cv, 0, -1, "*", "p");
  edge(cv, 1, 0, "n", "o");
  edge(cv, 0, 1, "*", "m");
  return { grid: toGrid(cv) };
})();

const torso: Part = {
  grid: [
    "....bcccccccbbbbba....",
    "...bcdddcccccbbbbbaa..",
    "..bcddeddcccbbbbbbbaa.",
    ".bcddeeddcccbbbbbbbbaa",
    ".bcdeeedccccbbbbbbbbaa",
    ".bcddeddcccbbbbbbbbbaa",
    ".bccdddcccbbbbbbbbbbaa",
    "..bcccccccbbbbbbbbbaa.",
    "..kkkkkkkkkkkkkkkkkkk.",
    "..cdeeeddccbbbbbbbbaa.",
    "..bcccccbbbbbbbbbbbaa.",
    "...kkkkkkkkkkkkkkkkk..",
    "...cdeedccbbbbbbbbaa..",
    "...bccccbbbbbbbbbbaa..",
    "....bbbbbbbbbbbbbaa...",
    "....bbbbbbbbbbbbaa....",
  ],
};

const pauldronL: Part = {
  grid: [
    "...cdddcc...",
    "..cdeffedcb.",
    ".cdffeeddcbb",
    "cdeeddcccbba",
    "cddcccbbbbba",
    "kffeeeeddcbk",
    "bcddcccbbbaa",
    ".kffeeedcbk.",
    ".bcddcbbbaa.",
    "..bbbbbaaa..",
  ],
};

const pauldronR: Part = {
  grid: [
    "...ccddccb...",
    ".ccdeeeddcbb.",
    "cddeffeedcbba",
    "cdeffeddccbba",
    "cddeddccbbbaa",
    "cdddccbbbbbaa",
    "kffeeeeddcbbk",
    "bcccccccbbbaa",
    ".kffeeeddcbk.",
    ".bcccbbbbbaa.",
    "..bbbbbbaaa..",
  ],
};

const armL: Part = {
  grid: ["...ccdcb", "..cddcbb", ".cddcbba", "cddcbba.", "cdcbbaa.", "ccbbaa..", ".bbaa..."],
};

const fist: Part = {
  grid: [
    "..cdddcc..",
    ".cdeeddcb.",
    "cdeffedcbb",
    "kkkkkkkkbb",
    "cdeeeddcbb",
    "kkkkkkkkba",
    "cddddccbba",
    ".bcccbbba.",
    "..bbbaa...",
  ],
};

/** The forearm, level, for a held-out spear. */
const forearm: Part = { grid: ["cdddddccbb", "cdeeeddcbb", "bcccccbbba", "bbbbbbbbaa"] };

const armR: Part = {
  grid: [
    ".ccccb..",
    "cddccbb.",
    "cdccbba.",
    "cdccbba.",
    "kfeedck.",
    "ccccbba.",
    "cdccbba.",
    "cdccbba.",
    ".cdddcb.",
    "cdeedcbb",
    "cdddccba",
    "kkkkkkba",
    "cdddcbba",
    ".bbbbba.",
  ],
};

const hips: Part = {
  grid: [
    "bcddccccccbbbbbbbaa",
    "kfeeeeeeeeeedccbbak",
    "bcdddccckbbbbbbbbaa",
    "bcddcccckcbbbbbbbaa",
    "kfeeeedckfeeedcbbak",
    ".bcddccbkbcccbbbaa.",
    "..bbbbbb.bbbbbbaa..",
  ],
};

const legL: Part = {
  grid: [
    "...bcccbb..",
    "...cddccb..",
    "..cdeedcbb.",
    "..deffedcb.",
    "..cdeedccb.",
    "...bcccbb..",
    "...cddcbb..",
    "...cddcbb..",
    "...cdccbb..",
    "..ccdcccbb.",
    ".cdeeddccba",
    "cdeeddcccba",
    "bbbbbbbbbba",
  ],
};

const legR: Part = {
  grid: [
    "..bcccbba..",
    "..cddcbba..",
    ".bcdddcbba.",
    ".cdeedcbba.",
    ".bcddccbba.",
    "..bccbba...",
    "..cdcbbba..",
    "..cdcbbba..",
    "..cccbbba..",
    ".bcccbbbaa.",
    "bcddcccbba.",
    "cdddcccbbaa",
    "bbbbbbbbaa.",
  ],
};

const shadow: Part = (() => {
  const cv = canvas(38, 5);
  ellipse(cv, 19, 2.5, 19, 2.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

const PARTS = { spear, helmet, plume, cape, torso, pauldronL, pauldronR, armL, forearm, fist, armR, hips, legL, legR, shadow };

/** Where the knight's own drawing space (64 x 62, spear tip at the top left) sits on the frame. */
const OX = 54;
const OY = 3;
/** How far behind the tip the fist holds a level spear. */
const GRIP = 36;

interface Pose {
  /** Whole body sideways (a lunge leans: the legs go half as far) and the upper body down (breath, crouch). */
  dx?: number;
  bob?: number;
  /** Spear upright in the fist (lifted by `lift`), or level and pointing left, the fist `reach` pixels forward. */
  spear?: { level: false; lift: number } | { level: true; reach: number };
  capePhase: number;
  capeAmp?: number;
  plumePhase: number;
}

const L = (part: keyof typeof PARTS, x: number, y: number, extra: Partial<Layer> = {}): Layer => ({ part, x: OX + x, y: OY + y, ...extra });

/** A level spear's fist and tip (frame pixels), for sparks and speed lines. */
function levelSpear(dx: number, bob: number, reach: number) {
  const fistX = 4 + dx - reach;
  const spearX = fistX + 4 - GRIP;
  return { fistX, spearX, y: 34 + bob, tip: [OX + spearX, OY + 34 + bob + 4] as const };
}

function pose(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const b = p.bob ?? 0;
  const legs = Math.round(dx / 2);
  const up = (x: number, y: number) => [dx + x, b + y] as const;
  const sp = p.spear ?? { level: false, lift: 0 };
  const layers: Layer[] = [
    L("shadow", 11 + legs, 59),
    L("cape", ...up(28, 20), { wave: { along: "cols", amp: p.capeAmp ?? 2, len: 30, phase: p.capePhase, pin: "left" } }),
    L("plume", ...up(20, 1), { wave: { along: "cols", amp: 1.4, len: 20, phase: p.plumePhase, pin: "left" } }),
    L("legR", 30 + legs, 48),
    L("legL", 15 + legs, 48),
    L("hips", 19 + Math.round((dx + legs) / 2), 43),
  ];
  if (!sp.level) {
    layers.push(
      L("armR", ...up(37, 33)),
      L("torso", ...up(17, 28)),
      L("pauldronR", ...up(34, 24)),
      L("helmet", ...up(17, 10)),
      L("pauldronL", ...up(11, 24)),
      L("armL", ...up(9, 31)),
      L("spear", 2 + dx, -sp.lift),
      L("fist", ...up(2, 32 - sp.lift)),
    );
  } else {
    // Level: turned a quarter (tip first, lit side up), its butt end passing behind the body.
    const s = levelSpear(dx, b, sp.reach);
    layers.push(
      L("spear", s.spearX, s.y, { flipX: true, rot: 3 }),
      L("armR", ...up(37, 33)),
      L("torso", ...up(17, 28)),
      L("pauldronR", ...up(34, 24)),
      L("helmet", ...up(17, 10)),
      L("pauldronL", ...up(11, 24)),
      L("armL", 9 + dx - Math.round(sp.reach / 3), b + 32),
      L("forearm", s.fistX + 5, s.y + 3),
      L("fist", s.fistX, s.y),
    );
  }
  return layers;
}

const TAU = Math.PI * 2;
const BREATH = [0, 0, 0, 1, 1, 1, 1, 0];

const idle: Anim = {
  loop: true,
  frames: BREATH.map((bob, i): Frame => ({ ms: 140, layers: pose({ bob, capePhase: (TAU * i) / 8, plumePhase: (TAU * i) / 8 + 1.2 }) })),
};

/** His eyes light in the visor as he winds up, white-hot at the strike. */
const EYES = { j: PALETTE.E, J: PALETTE.E };
const EYES_HOT = { j: PALETTE.E, J: PALETTE.F };

/** Speed lines along a thrusting spear, from just behind the tip back to the fist. */
function streaks(dx: number, bob: number, reach: number): Speck[] {
  const s = levelSpear(dx, bob, reach);
  const out: Speck[] = [];
  for (const [row, from, len] of [[-3, 14, 12], [-2, 22, 10], [3, 12, 14], [4, 24, 8]] as const)
    for (let i = 0; i < len; i++) out.push([s.tip[0] + from + i, s.tip[1] + row, "q"]);
  return out;
}

/** A burst of sparks at the spear's tip: a white-hot centre, gold rays, a few loose flecks. */
function spark(dx: number, bob: number, reach: number): Speck[] {
  const [tx, ty] = levelSpear(dx, bob, reach).tip;
  const cx = tx - 3;
  const out: Speck[] = [];
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) out.push([cx + x!, ty + y!, "G"]);
  for (let d = 2; d <= 6; d++) {
    const k = d <= 3 ? "G" : "g";
    out.push([cx - d + 1, ty, k], [cx - d + 1, ty + 1, k]);
    if (d <= 5) out.push([cx, ty - d + 1, k], [cx + 1, ty - d + 1, k], [cx, ty + d, k], [cx + 1, ty + d, k]);
    if (d <= 4) out.push([cx - d + 1, ty - d + 1, "g"], [cx - d + 1, ty + d, "g"], [cx + d, ty - d + 1, "g"], [cx + d, ty + d, "g"]);
  }
  out.push([cx - 8, ty - 3, "g"], [cx - 7, ty + 5, "g"], [cx + 4, ty - 6, "G"], [cx - 3, ty + 7, "G"]);
  return out;
}

const attack: Anim = {
  loop: false,
  frames: [
    { ms: 110, layers: pose({ capePhase: 0, plumePhase: 1.2 }) },
    // Wind-up: the spear comes level and draws back, he sinks, his eyes light.
    { ms: 140, cue: "windup", pal: EYES, layers: pose({ dx: 2, bob: 1, spear: { level: true, reach: -4 }, capePhase: 0.5, plumePhase: 1.7 }) },
    { ms: 200, pal: EYES, layers: pose({ dx: 3, bob: 2, spear: { level: true, reach: -7 }, capePhase: 0.9, plumePhase: 2.1 }) },
    // Thrust: a lunge, a blur, then the strike.
    { ms: 60, cue: "thrust", pal: EYES_HOT, layers: pose({ dx: -3, spear: { level: true, reach: 3 }, capePhase: 2.2, capeAmp: 3, plumePhase: 3.4 }), specks: streaks(-3, 0, 3) },
    { ms: 120, cue: "hit", pal: EYES_HOT, shake: [-1, 0], layers: pose({ dx: -4, spear: { level: true, reach: 6 }, capePhase: 2.8, capeAmp: 3, plumePhase: 4 }), specks: spark(-4, 0, 6) },
    { ms: 220, pal: EYES, layers: pose({ dx: -4, spear: { level: true, reach: 6 }, capePhase: 3.4, capeAmp: 3, plumePhase: 4.6 }) },
    // Recover.
    { ms: 140, layers: pose({ dx: -2, spear: { level: true, reach: 0 }, capePhase: 4.2, plumePhase: 5.4 }) },
    { ms: 140, layers: pose({ capePhase: 5, plumePhase: 6.2 }) },
  ],
};

export const BLACK_KNIGHT: Character = {
  id: "black-knight",
  name: "The Black Knight",
  w: 126,
  h: 68,
  foot: [OX + 28, OY + 61],
  palette: PALETTE,
  halo: "#2a2f3b",
  parts: PARTS,
  anims: { idle, attack },
};
