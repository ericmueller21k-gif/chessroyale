/**
 * Dash's moves for his battle intro (BOSS_BLITZ_INTRO, id `blitz-intro`), copied as drawn from the art branch `claude/boss-art`
 * (scripts/boss-art/out/boss-blitz/boss-blitz.ts at 90b3bd56, Nov 3: the lines below its "His battle intro" banner; the notes are
 * scripts/boss-art/out/intro-blitz-nov3.md on that branch). Only the imports changed: his rig (the parts, the poses, the legs,
 * shoes, stars and finger gun) is boss-blitz.ts's, exported for this file; his new parts (stride legs, afterimages, dust) are new
 * names in its parts record, so his town frames draw exactly as before. The ids keep `blitz`. A file of its own so the town doesn't
 * build these frames: it loads only when you challenge him (shops/intro.ts, through shops/blitz-intro-art.ts).
 */
import { lazyAnim, partSize, type Anim, type Character, type Frame, type Layer, type Speck } from "./sprite.ts";
import { BOSS_BLITZ, GROUND, PALETTE, PARTS, POINT, W, add, elbowOf, layers, leg, placed, pointLines, shoe, star, type Pose, type Pt } from "./boss-blitz.ts";

// ================================================================================================================
// ---- His battle intro (BOSS_BLITZ_INTRO, id `blitz-intro`; Eric, Nov 3). Added below; nothing above is changed (his new
// leg, ghost and dust parts are new names in the same parts record, so every older frame draws exactly as before).
// He stands on the left of the table, so he FACES OUR RIGHT (his own frames mirrored). Three or four times he bolts off
// to our left in a burst of dust (`bolt`, where he turns and runs his own way, unmirrored), zips back in from our left in
// a blur, skids to a stop at his spot and tosses what he brought onto the table (`arrive`, cue `drop`). `dashBy` is his
// full-speed run (loops) for code to slide across; `brag` the finish: he dusts off his jacket and finger-guns you.
// ================================================================================================================

/** The intro's frame: his own (72 x 104) mirrored with I_L to its left (room to run off and in) and room for dust on our right. */
const I_L = 64;
const I_T = 4;
const IW = 150;
const IH = 108;
/** His foot in the intro's frame, facing our right; facing our left (his own way) his frame is shifted to keep it there. */
const IFOOT: Pt = [I_L + W - 40, GROUND + I_T];
const NOFF = I_L + W - 2 * 40;
/**
 * Where the dropped thing lands, relative to his foot, in `arrive`'s drop frame: the table's foot (the board, the pieces'
 * pop and the stools all go on the table; the stools at its foot x +- 37). He stands left of his own stool.
 */
export const BLITZ_INTRO_DROP_AT: Pt = [72, 0];

const IPAL: Record<string, string> = {
  ...PALETTE,
  i: "#fbf3df", // dust: lit, mid, shade; see-through thick and faint
  j: "#e6d6b2",
  l: "#bfa57c",
  "~": "#f1e5c8a0",
  "^": "#f1e5c850",
  u: "#eaa14088", // his afterimages: warm (fur, orange) and cool (teal, greys, white); strong and faint
  v: "#2fb3aa88",
  o: "#eaa14040",
  p: "#2fb3aa40",
};
const WARM_KEYS = new Set([..."abcdefghstnmrxwyYEFGHRS"]);
/** A part as a flat see-through afterimage (no outline), warm or cool by each pixel's color. */
function ghostPart(name: string, faint: boolean): string {
  return add(`ghost${faint ? 1 : 0}:${name}`, () => ({
    grid: PARTS[name]!.grid.map((r) => r.replace(/[^. ]/g, (c) => (WARM_KEYS.has(c) ? (faint ? "o" : "u") : faint ? "p" : "v"))),
    outline: false,
  }));
}

/** His legs and lean for a frame: each ankle (his own pixels; on the ground at y 94), a shoe on its toe, the body's lean. */
interface Stride {
  /** Everything above the legs moved this far (his own pixels: negative is forward). */
  lean?: number;
  far?: Pt;
  near?: Pt;
  tipF?: boolean;
  tipN?: boolean;
}
const ANKLE_Y = 94;
/** His own layers with the legs swapped for strides (new parts; his own legs only bend in place). */
function bodyLayers(pose: Pose, g: Stride = {}): Layer[] {
  const lean = g.lean ?? 0;
  const hy = 76 + (pose.sink ?? 0) - (pose.lift ?? 0);
  const legL = (nm: string, hx: number, ank: Pt, dark: number): Layer => {
    const h: Pt = [hx + lean, hy];
    const pl = placed(`i${nm}:${h[0]},${h[1]}>${ank[0]},${ank[1]}`, () => leg(h, elbowOf(h, ank, [10, 10.2], false), ank, dark));
    return { part: pl.name, x: pl.at[0], y: pl.at[1] };
  };
  const shoeL = (nm: string, base: number, ank: Pt, tip: boolean, dark: boolean): Layer => {
    const pl = placed(`${nm}:${tip}`, () => shoe(base, tip, dark));
    return { part: pl.name, x: pl.at[0] + ank[0] - base, y: pl.at[1] + ank[1] - ANKLE_Y };
  };
  const far = g.far ?? [35, ANKLE_Y];
  const near = g.near ?? [45, ANKLE_Y];
  const out: Layer[] = [];
  for (const l of layers(pose)) {
    const p = l.part;
    if (p.startsWith("legF:")) out.push(legL("legF", 37, far, 0.18));
    else if (p.startsWith("shoeF:")) out.push(shoeL("shoeF", 35, far, g.tipF ?? false, true));
    else if (p.startsWith("legN:")) out.push(legL("legN", 44, near, 0));
    else if (p.startsWith("shoeN:")) out.push(shoeL("shoeN", 45, near, g.tipN ?? false, false));
    else if (p === "shadow") out.push(l);
    else out.push({ ...l, x: l.x + lean });
  }
  return out;
}

type Face = "right" | "left";
/** His own layers into the intro's frame: mirrored to face our right, or as drawn (facing our left); moved dx. */
function toIntro(ls: readonly Layer[], face: Face, dx: number): Layer[] {
  return ls.map((l) => {
    if (face === "left") return { ...l, x: l.x + NOFF + dx, y: l.y + I_T };
    const [w] = partSize(PARTS[l.part]!, l.rot ?? 0);
    const rot = l.rot ? (((4 - l.rot) % 4) as 0 | 1 | 2 | 3) : 0;
    return { part: l.part, x: I_L + W - l.x - w + dx, y: l.y + I_T, ...(l.flipX ? {} : { flipX: true }), ...(rot ? { rot } : {}) };
  });
}
const specksTo = (s: readonly Speck[], face: Face, dx: number): Speck[] =>
  s.map(([x, y, k]): Speck => [face === "left" ? x + NOFF + dx : I_L + W - 1 - x + dx, y + I_T, k]);

/** A cartoon dust cloud in the intro's frame: round billows (outlined, lit from the top), or see-through when thin. */
type Blob = readonly [cx: number, cy: number, r: number];
let clouds = 0;
function cloud(blobs: readonly Blob[], thin = 0): Layer {
  const x0 = Math.floor(Math.min(...blobs.map(([x, , r]) => x - r))) - 1;
  const y0 = Math.floor(Math.min(...blobs.map(([, y, r]) => y - r))) - 1;
  const x1 = Math.ceil(Math.max(...blobs.map(([x, , r]) => x + r))) + 1;
  const y1 = Math.ceil(Math.max(...blobs.map(([, y, r]) => y + r))) + 1;
  const grid = Array.from({ length: y1 - y0 }, (_, j) =>
    Array.from({ length: x1 - x0 }, (_, i) => {
      const X = x0 + i + 0.5;
      const Y = y0 + j + 0.5;
      let best: { d: number; b: Blob } | null = null;
      for (const b of blobs) {
        const d = Math.hypot(X - b[0], (Y - b[1]) * 1.15) / b[2];
        if (d <= 1 && (!best || d < best.d)) best = { d, b };
      }
      if (!best) return ".";
      if (thin === 2) return (i * 3 + j * 5) % 4 === 0 ? "~" : (i + j) % 3 === 0 ? "^" : ".";
      if (thin === 1) return best.d > 0.7 ? "^" : "~";
      const up = (Y - best.b[1]) / best.b[2];
      const left = (X - best.b[0]) / best.b[2];
      return up + 0.4 * left < -0.35 ? "i" : up > 0.45 ? "l" : "j";
    }).join(""),
  );
  const name = add(`icloud${clouds++}`, () => ({ grid, outline: !thin }));
  return { part: name, x: x0, y: y0 };
}
/** A speed line in the intro's frame from (x, y), `len` long, running `dir` (1 right, -1 left): bright at its head. */
const istreak = (x: number, y: number, len: number, dir: number): Speck[] =>
  Array.from({ length: len }, (_, i): Speck => [Math.round(x + i * dir), y, i < len * 0.2 ? "O" : i < len * 0.5 ? "N" : i < len * 0.8 ? "M" : "J"]);
/** Grit flung up (intro pixels). */
const grit = (pts: readonly Pt[]): Speck[] => pts.flatMap(([x, y], i): Speck[] => [[x, y, i % 2 ? "l" : "j"], [x + 1, y, "i"]]);

interface IX {
  face?: Face;
  /** Moved this far in the intro's frame (positive: our right). */
  dx?: number;
  g?: Stride;
  /** Afterimages trailing him: 0, 1 or 2, each 9 px further back. */
  ghosts?: number;
  /** Specks in his own pixels (mirrored with him) and in the intro's frame. */
  dspecks?: readonly Speck[];
  specks?: readonly Speck[];
  /** Clouds and such in the intro's frame, over him. */
  over?: readonly Layer[];
  /** Hide him (the bolt's last frame: only his dust is left). */
  gone?: boolean;
  cue?: string;
  shake?: Pt;
}
function ix(ms: number, pose: Pose, o: IX = {}): Frame {
  const face = o.face ?? "right";
  const dx = o.dx ?? 0;
  const own = bodyLayers(pose, o.g);
  const back = face === "right" ? -9 : 9;
  const ghosts: Layer[] = [];
  for (let n = o.ghosts ?? 0; n >= 1; n--) {
    const g = own.filter((l) => l.part !== "shadow").map((l) => ({ ...l, part: ghostPart(l.part, n === 2) }));
    ghosts.push(...toIntro(g, face, dx + back * n));
  }
  const body = o.gone ? [] : toIntro(own, face, dx);
  const shake = o.shake ? ([face === "right" ? -o.shake[0] : o.shake[0], o.shake[1]] as const) : undefined;
  return {
    ms,
    layers: [...(o.gone ? [] : ghosts), ...body, ...(o.over ?? [])],
    specks: [...specksTo(o.dspecks ?? [], face, dx), ...(o.specks ?? [])],
    ...(o.cue ? { cue: o.cue } : {}),
    ...(shake ? { shake } : {}),
  };
}

// ---- The run (4 frames): leaning hard forward, legs in full stride, the near arm pumping against the near leg, ears
// back, tail streaming, a determined grin. Ankles are placed from each hip (his own pixels, forward is to his left).
function run(t: number, extra: Pose = {}): [Pose, Stride] {
  const lean = -6;
  const contact = t % 2 === 0;
  const hf = 37 + lean;
  const hn = 44 + lean;
  const fwd = (hx: number): Pt => [hx - 12, ANKLE_Y];
  const kick = (hx: number): Pt => [hx + 12, ANKLE_Y - 8];
  const under = (hx: number): Pt => [hx + 2, ANKLE_Y];
  const tuck = (hx: number): Pt => [hx - 8, ANKLE_Y - 11];
  const g: Stride =
    t === 0 ? { lean, near: fwd(hn), far: kick(hf), tipF: true }
    : t === 1 ? { lean, near: under(hn), far: tuck(hf), tipF: true, tipN: true }
    : t === 2 ? { lean, far: fwd(hf), near: kick(hn), tipN: true }
    : { lean, far: under(hf), near: tuck(hn), tipN: true, tipF: true };
  const arm: Pt = t === 0 ? [55, 58] : t === 2 ? [31, 47] : t === 1 ? [46, 56] : [40, 52];
  return [{ sink: contact ? 2 : 0, lift: contact ? 0 : 1, tail: contact ? 4 : 3, ears: 2, eyes2: "sly", mouth: "grin", brow: 1, head: [-3, 1], at: arm, ...extra }, g];
}
/** Speed lines trailing him (intro pixels): from just behind his back, running away behind him. */
const RUN_YS = [26, 40, 52, 64, 76, 88, 100];
function trail(face: Face, dx: number, len: number, phase = 0): Speck[] {
  const backX = face === "right" ? 72 + dx : 120 + dx;
  const dir = face === "right" ? -1 : 1;
  return RUN_YS.flatMap((y, i) => istreak(backX + dir * ((i + phase) % 3) * 4, y, Math.round(len * (0.6 + 0.4 * (((i + phase) % 2) ? 1 : 0.6))), dir));
}

// ---- bolt (5 frames, 420 ms): a sly grin at you, he spins to face our left in a crouch, launches (whoosh) in a burst of
// dust, is all but gone, then only his dust cloud and speed lines are left.
const SPOT = IFOOT[0];
const FLOOR = IFOOT[1];
const bolt: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    ix(90, { sink: 2, eyes2: "sly", mouth: "grin", brow: 1, hand: "up", tail: 3 }),
    ix(90, { sink: 5, head: [-2, 1], ears: 2, eyes: "wide", mouth: "grin", brow: 1, tail: 4, at: [53, 58] }, {
      face: "left",
      g: { lean: -3, far: [33, ANKLE_Y], near: [47, ANKLE_Y] },
      specks: grit([[SPOT + 6, FLOOR - 2], [SPOT - 4, FLOOR - 1]]),
    }),
    ix(60, ...((): [Pose, IX] => {
      const [p, g] = run(0, { head: [-3, 2], ears: 3, eyes: "wide", eyes2: undefined });
      return [p, { face: "left", g: { ...g, lean: -8 }, dx: -34, ghosts: 2, cue: "whoosh", over: [cloud([[SPOT, FLOOR - 6, 7], [SPOT - 9, FLOOR - 4, 6], [SPOT + 9, FLOOR - 4, 6]])], specks: [...trail("left", -34, 26), ...grit([[SPOT + 10, FLOOR - 8], [SPOT - 9, FLOOR - 10], [SPOT + 2, FLOOR - 13]])] }];
    })()),
    ix(60, ...((): [Pose, IX] => {
      const [p, g] = run(2, { head: [-3, 2], ears: 3 });
      return [p, { face: "left", g, dx: -100, ghosts: 2, over: [cloud([[SPOT, FLOOR - 10, 10], [SPOT - 13, FLOOR - 8, 8], [SPOT + 12, FLOOR - 8, 7], [SPOT - 25, FLOOR - 4, 6]])], specks: [...trail("left", -100, 60), ...grit([[SPOT + 14, FLOOR - 12], [SPOT - 14, FLOOR - 16], [SPOT + 4, FLOOR - 20]])] }];
    })()),
    ix(120, {}, {
      gone: true,
      over: [cloud([[SPOT, FLOOR - 14, 11], [SPOT - 14, FLOOR - 10, 10], [SPOT + 13, FLOOR - 9, 8], [SPOT - 29, FLOOR - 6, 7], [SPOT - 40, FLOOR - 4, 4]])],
      specks: RUN_YS.flatMap((y, i) => istreak(4 + (i % 3) * 9, y, 30 + (i % 2) * 24, 1).map(([x, yy, k]): Speck => [x, yy, k === "O" ? "M" : k === "N" ? "M" : "J"])),
    }),
  ],
}));

// ---- arrive (7 frames, 730 ms): a blur in from our left (whoosh), a skid past his spot in a spray of dust (skid), a
// wind-up, the toss toward the table (drop: code shows the dropped thing from here), a held "there", and he stands.
const skidDust = (t: number): Layer[] =>
  t === 0 ? [cloud([[SPOT + 21, FLOOR - 6, 6], [SPOT + 30, FLOOR - 4, 4]])]
  : t === 1 ? [cloud([[SPOT + 22, FLOOR - 9, 8], [SPOT + 35, FLOOR - 6, 7], [SPOT + 12, FLOOR - 4, 6]])]
  : t === 2 ? [cloud([[SPOT + 23, FLOOR - 12, 10], [SPOT + 38, FLOOR - 9, 8], [SPOT + 12, FLOOR - 6, 7]], 1)]
  : [cloud([[SPOT + 26, FLOOR - 15, 10], [SPOT + 40, FLOOR - 12, 8], [SPOT + 13, FLOOR - 8, 7]], 2)];
/** The toss: a fan of speed lines off his paw toward the table (intro pixels), and two glints. */
const TOSS_PAW: Pt = [I_L + W - 1 - 17, 52 + I_T];
const tossLines = (t: number): Speck[] => [
  ...istreak(TOSS_PAW[0] + 4 + t * 4, TOSS_PAW[1] - 3, 16 - t * 6, 1),
  ...istreak(TOSS_PAW[0] + 5 + t * 4, TOSS_PAW[1] + 1, 20 - t * 7, 1),
  ...istreak(TOSS_PAW[0] + 4 + t * 4, TOSS_PAW[1] + 5, 12 - t * 4, 1),
  ...star(TOSS_PAW[0] + 22 + t * 3, TOSS_PAW[1] - 6, t === 0),
  ...(t === 0 ? star(TOSS_PAW[0] + 16, TOSS_PAW[1] + 9) : []),
];
const arrive: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    ix(50, ...((): [Pose, IX] => {
      const [p, g] = run(0);
      return [p, { g, dx: -100, ghosts: 2, cue: "whoosh", specks: trail("right", -100, 40) }];
    })()),
    ix(50, ...((): [Pose, IX] => {
      const [p, g] = run(2);
      return [p, { g, dx: -40, ghosts: 2, specks: trail("right", -40, 40, 1) }];
    })()),
    ix(90, { sink: 3, head: [3, -1], ears: 2, eyes: "wide", mouth: "o", brow: 1, tail: 4, hand: "up" }, {
      dx: 5,
      g: { lean: 3, near: [34, ANKLE_Y], far: [44, ANKLE_Y] },
      ghosts: 1,
      cue: "skid",
      shake: [1, 0],
      over: skidDust(0),
      specks: [...trail("right", 5, 14), ...grit([[SPOT + 20, FLOOR - 8], [SPOT + 26, FLOOR - 11], [SPOT + 31, FLOOR - 6]])],
    }),
    ix(80, { sink: 1, head: [1, 0], tail: 3, at: [56, 40], gesture: "open", eyes2: "sly", mouth: "grin", brow: 1 }, {
      dx: 2,
      g: { lean: 1, near: [36, ANKLE_Y], far: [44, ANKLE_Y] },
      over: skidDust(1),
      specks: grit([[SPOT + 30, FLOOR - 14], [SPOT + 36, FLOOR - 9]]),
    }),
    ix(110, { at: [17, 52], gesture: "open", lift: 1, head: [-2, 0], mouth: "wide", eyes2: "us", brow: 2, tail: 2 }, {
      cue: "drop",
      over: skidDust(2),
      specks: tossLines(0),
    }),
    ix(200, { at: [19, 53], gesture: "open", head: [-1, 0], mouth: "grin", eyes2: "sly", brow: 1, tail: 1 }, { over: skidDust(3), specks: tossLines(1) }),
    ix(150, { mouth: "grin", tail: 0 }),
  ],
}));

// ---- dashBy (loop, 4 x 60 ms): the run at full speed, two afterimages, speed lines and a kick of dust off each step.
// Drawn facing our right; mirror it to run left. Code slides it across (about 10 to 14 px a frame looks right).
const dashBy: Anim = lazyAnim(() => ({
  loop: true,
  frames: [0, 1, 2, 3].map((t) => {
    const [p, g] = run(t);
    const stepX = t === 0 ? SPOT + 15 : t === 2 ? SPOT + 8 : SPOT - 6;
    return ix(60, p, {
      g,
      ghosts: 2,
      specks: [...trail("right", 0, 34, t), ...grit([[stepX - 4, FLOOR - 2], [stepX - 9, FLOOR - 4 - (t % 2)], [stepX - 14, FLOOR - 2]])],
      ...(t === 0 ? { cue: "whoosh" } : {}),
    });
  }),
}));

// ---- brag (6 frames, 1030 ms): he dusts off his jacket (puffs off his chest), winds up, and finger-guns you with a wink
// and a glint (ding).
const chestPuff = (x: number, y: number, t: number): Speck[] =>
  [[0, 0], [1, -1], [-1, -1], [2, 0], [0, -2], [-2, 1]].slice(0, 6 - t * 2).map(([a, b], i): Speck => [x + a! - t * 2, y + b! - t, i % 2 ? "j" : "i"]);
const brag: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    ix(110, { at: [38, 57], gesture: "open", eyes: "half", mouth: "smirk", head: [0, 1], tail: 1 }, { cue: "brush", dspecks: chestPuff(33, 58, 0) }),
    ix(110, { at: [33, 51], gesture: "open", eyes: "half", mouth: "smirk", tail: 0 }, { dspecks: [...chestPuff(31, 56, 1), ...chestPuff(30, 50, 0)] }),
    ix(110, { at: [39, 58], gesture: "open", eyes: "half", mouth: "grin", head: [0, 1], tail: -1 }, { cue: "brush", dspecks: [...chestPuff(28, 49, 1), ...chestPuff(34, 59, 0)] }),
    ix(80, { hand: "up", lift: 1, brow: 1, eyes2: "sly", mouth: "grin", tail: 2 }),
    ix(120, { at: POINT, gesture: "point", head: [-1, 0], mouth: "grin", eyes2: "wink", brow: 2, lift: 1, tail: 3 }, { cue: "ding", dspecks: [...pointLines(-1), ...star(POINT[0] - 10, POINT[1] - 1, true)] }),
    ix(500, { at: POINT, gesture: "point", head: [-1, 0], mouth: "wide", eyes2: "sly", brow: 2, tail: 2 }, { dspecks: [...pointLines(0, 0.5), ...star(POINT[0] - 10, POINT[1] - 1)] }),
  ],
}));

/**
 * Dash for his battle intro: his own parts and palette (plus dust and afterimage colors), FACING OUR RIGHT, in a
 * 150 x 108 frame, foot [96, 103]. `bolt`'s turned frames face our left (he runs off his own way).
 */
export const BOSS_BLITZ_INTRO: Character = {
  ...BOSS_BLITZ,
  id: "blitz-intro",
  name: "Dash (his intro)",
  w: IW,
  h: IH,
  foot: IFOOT,
  palette: IPAL,
  anims: { idle: lazyAnim(() => ({ loop: true, frames: [ix(1000, {})] })), bolt, arrive, dashBy, brag },
};
