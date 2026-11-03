/**
 * Timber's moves for his battle intro (BOSS_BEAVER_INTRO, id `timber-intro`), copied as drawn from the art branch `claude/boss-art`
 * (scripts/boss-art/out/boss-beaver/boss-beaver.ts, Nov 3: the lines that run added there; the notes are
 * scripts/boss-art/out/intro-timber-nov3.md on that branch). Only the imports changed: his rig (the parts, the poses, `f`, the
 * specks) is timber.ts's, exported for this file; the cheeks' `puff` (his strain under the log) was added there with these lines.
 * A file of its own so the town doesn't build these frames: it loads only when you challenge him (shops/intro.ts, through
 * shops/timber-intro-art.ts).
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "./sprite.ts";
import { BOSS_BEAVER, OY, PALETTE, PARTS, W, f, feetDust, puff, px, type Arm, type Pose, type Pt } from "./timber.ts";

// ---- His battle intro (BOSS_BEAVER_INTRO, id `timber-intro`): he works on the left of the board, so he FACES OUR RIGHT
// (his own frames mirrored). He walks to the giant log, heaves it up, carries it to the middle, stands it on end in
// front of him (our right), gnaws it, and dusts off his paws. The log is house-intro-timber's INTRO_TIMBER_LOG, its
// pixels worked out here by the very same code (its bark, rings and grain at the same picture pixels), so it matches.
// ================================================================================================================

// ---- The log (copied from house-intro-timber.ts: same palette keys, same functions, same picture coordinates).

/** A small seeded hash of a pixel, in [0, 1) (kit.ts's grain). */
function lgrain(x: number, y: number, seed = 1): number {
  let h = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35) ^ Math.imul(seed, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
const lclamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lramp = (keys: string, l: number) => keys[Math.floor(lclamp(l, 0, 0.999) * keys.length)]!;
function barkKey(l: number, t: number, s: number, x: number, y: number): string {
  const band = t * 3.4 + 0.1 * Math.sin(s * 0.3 + Math.floor(t * 3.4) * 1.9);
  const fr = band - Math.floor(band);
  if (fr < 0.17) l -= 0.34;
  else if (fr < 0.3) l += 0.12;
  if (lgrain(x, y, 17) > 0.92) l -= 0.14;
  const plate = Math.floor(t * 3.4);
  const sc = s / 9 + plate * 0.45;
  if (Math.floor(sc) !== Math.floor(sc - 1 / 9) && fr > 0.35 && fr < 0.85 && lgrain(plate, Math.floor(sc), 5) > 0.55) l -= 0.26;
  return lramp("abcde", l);
}
function ringKey(d: number, r: number, lit: number, ang: number): string {
  if (d > r - 1.2) return lit > 0.45 ? "d" : "c";
  if (d > r - 2.4) return "p";
  if (d < 1.3) return "J";
  if (Math.abs(ang - 0.6) < 0.09 && d < r * 0.7) return "J";
  for (const rr of [r * 0.3, r * 0.56, r * 0.8]) if (Math.abs(d - rr) < 0.55) return "j";
  return lit > 0.55 ? "H" : "h";
}
/** The log's picture: 80 x 70, foot [40, 64] (its bottom middle). */
const LOG_W = 80;
const LOG_H = 70;
const LOG_FOOT: Pt = [40, 64];
function lyingKey(x: number, y: number): string | null {
  const X = x + 0.5;
  const v = (y + 0.5 - 49) / 15;
  if (Math.abs(v) >= 1) return null;
  const sq = Math.sqrt(1 - v * v);
  const fx = (X - 14) / 6;
  if (fx * fx + v * v <= 1) return ringKey(Math.hypot(fx, v) * 15, 15, 0.55 - 0.5 * fx - 0.5 * v, Math.atan2(v, fx));
  if (X < 14 || X > 66 + 6 * sq) return null;
  for (const [kx, ky, kr] of [[44, 41, 2.6], [29, 56, 2]] as const) {
    const kd = Math.hypot((X - kx) / kr, (y + 0.5 - ky) / (kr * 0.65));
    if (kd < 0.55) return "j";
    if (kd < 1) return "a";
  }
  let l = 0.66 - 0.6 * v - 0.06 * ((X - 40) / 32);
  if (X > 66 + 6 * sq - 1.5) l -= 0.15;
  return barkKey(l, Math.asin(v) / Math.PI + 0.5, X, x, y);
}
/** The log stood on end, not yet bitten (INTRO_TIMBER_LOG's `standing`). */
function standKey(x: number, y: number): string | null {
  const SR = 16;
  const ERY = 7;
  const YT = 19;
  const YB = 57;
  const X = x + 0.5 - 40;
  const Y = y + 0.5;
  const tn = (X / SR) ** 2 + ((Y - YT) / ERY) ** 2;
  const inTop = tn <= 1;
  const nx = lclamp(X / SR, -1, 1);
  const inBody = Y >= YT && Math.abs(X) < SR && Y <= YB + ERY * Math.sqrt(1 - nx * nx);
  if (!inTop && !inBody) return null;
  if (inTop) return ringKey(Math.sqrt(tn) * SR, SR, 0.6 - 0.4 * (X / SR) - 0.6 * ((Y - YT) / ERY), Math.atan2((Y - YT) / ERY, X / SR));
  const bottom = YB + ERY * Math.sqrt(1 - nx * nx);
  const l = 0.66 - 0.55 * nx - (Y > bottom - 2 ? 0.16 : 0) - (Y < YT + ERY * Math.sqrt(1 - (X / SR) ** 2) + 2 ? 0.12 : 0);
  return barkKey(l, Math.asin(nx) / Math.PI + 0.5, Y, x, y);
}
const gridOf = (w: number, h: number, fn: (x: number, y: number) => string | null) =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y) ?? ".").join(""));
const shadowGrid = (cx: number, cy: number, rx: number, ry: number) => {
  const x0 = Math.floor(cx - rx);
  const y0 = Math.floor(cy - ry);
  return {
    at: [x0, y0] as Pt,
    part: {
      grid: gridOf(Math.ceil(2 * rx) + 1, Math.ceil(2 * ry) + 1, (x, y) => {
        const d = ((x + x0 + 0.5 - cx) / rx) ** 2 + ((y + y0 + 0.5 - cy) / ry) ** 2;
        return d > 1 ? null : d > 0.55 ? "+" : "-";
      }),
      outline: false,
    } as Part,
  };
};
const LOG_PARTS: Record<string, Part> = {
  "log:lying": { grid: gridOf(LOG_W, LOG_H, lyingKey) },
  "log:standing": { grid: gridOf(LOG_W, LOG_H, standKey) },
};
const LY_SHADOW = shadowGrid(41, 63, 33, 5);
const ST_SHADOW = shadowGrid(42, 62, 21, 6);
LOG_PARTS["log:lyShadow"] = LY_SHADOW.part;
LOG_PARTS["log:stShadow"] = ST_SHADOW.part;
/** The lying log turned `deg` degrees clockwise about its middle (it swings its right end down to stand on it). */
const TILT_BOX = 96;
function tiltLog(deg: number): string {
  const name = `log:tilt${deg}`;
  if (!LOG_PARTS[name]) {
    const a = (deg * Math.PI) / 180;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    LOG_PARTS[name] = {
      grid: gridOf(TILT_BOX, TILT_BOX, (x, y) => {
        const du = x + 0.5 - TILT_BOX / 2;
        const dv = y + 0.5 - TILT_BOX / 2;
        return lyingKey(Math.floor(40 + du * c + dv * s), Math.floor(49 - du * s + dv * c));
      }),
    };
  }
  return name;
}

// ---- His frames, mirrored into the intro's frame.

/** The intro's frame: his own mirrored (facing our right), I_L to its left, room on our right for the log he stands up. */
const I_L = 4;
const I_T = 4;
const IW = 118;
const IH = 98;
/** His foot in the intro's frame. */
const IFOOT: Pt = [I_L + W - BOSS_BEAVER.foot[0], BOSS_BEAVER.foot[1] + I_T];
/** The log lying at his feet (its foot, the lying piece's bottom middle) as he bends to it: just in front of him. */
const LOG_DOWN: Pt = [IFOOT[0], IFOOT[1] + 2];
/** Where the log stands, relative to his foot, from setDown's last frame and in gnaw (in front of him, our right). */
export const TIMBER_INTRO_REACH: Pt = [34, -2];
const LOG_STOOD: Pt = [IFOOT[0] + TIMBER_INTRO_REACH[0], IFOOT[1] + TIMBER_INTRO_REACH[1]];
/** Where the lying log's foot sits relative to his foot in lift's first frame (code puts him there over it). */
export const TIMBER_INTRO_LIFT_AT: Pt = [LOG_DOWN[0] - IFOOT[0], LOG_DOWN[1] - IFOOT[1]];

type LogAt = { kind: "lying" | "standing"; foot: Pt; shadow?: boolean } | { kind: "tilt"; mid: Pt; deg: number };
interface IX {
  /** Each foot (near, far) moved this far, in his own pixels (a step); the thigh goes half as far. */
  feet?: readonly [Pt, Pt];
  log?: LogAt;
  /** Specks in his own (unmirrored) pixels, and in the intro's frame. */
  dspecks?: Speck[];
  specks?: Speck[];
  cue?: string;
  shake?: readonly [number, number];
  /** (Review only: the standing log piece drawn behind him, as code will.) */
  behind?: boolean;
}
const REVIEW = false;
/** A paw at intro-frame pixel (xs, ys), for a pose (its lean, breath, crouch and shift taken off). */
const pawAt = (p: Pose, xs: number, ys: number): Arm => ({
  h: [I_L + W - 1 - xs - (p.lean ?? 0) - (p.dx ?? 0), ys - OY - I_T + (p.breath ?? 0) - (p.sink ?? 0) + (p.air ?? 0)],
});
const paws = (p: Pose, near: Pt, far: Pt): Pose => ({ ...p, armL: pawAt(p, near[0], near[1]), armR: pawAt(p, far[0], far[1]) });

function intro(ms: number, p: Pose, x: IX = {}): Frame {
  const fr = f(ms, p, { specks: x.dspecks ?? [] });
  const off: Record<string, Pt> = {};
  if (x.feet) {
    const half = (q: Pt): Pt => [Math.round(q[0] / 2), Math.round(q[1] / 2)];
    off.footL = x.feet[0];
    off.thighL = half(x.feet[0]);
    off.footR = x.feet[1];
    off.thighR = half(x.feet[1]);
  }
  const layers: Layer[] = fr.layers.map((l) => {
    const o = off[l.part] ?? [0, 0];
    const g = PARTS[l.part]!.grid;
    const w = l.rot && l.rot % 2 ? g.length : Math.max(...g.map((r) => r.length));
    const rot = l.rot ? (((4 - l.rot) % 4) as 0 | 1 | 2 | 3) : 0;
    return { part: l.part, x: I_L + W - (l.x + o[0]) - w, y: l.y + o[1] + I_T, ...(l.flipX ? {} : { flipX: true }), ...(rot ? { rot } : {}) };
  });
  if (x.behind) layers.splice(1, 0, { part: "log:standing", x: LOG_STOOD[0] - LOG_FOOT[0], y: LOG_STOOD[1] - LOG_FOOT[1] });
  if (x.log) {
    const lg = x.log;
    const logL: Layer =
      lg.kind === "tilt"
        ? { part: tiltLog(lg.deg), x: lg.mid[0] - TILT_BOX / 2, y: lg.mid[1] - TILT_BOX / 2 }
        : { part: `log:${lg.kind}`, x: lg.foot[0] - LOG_FOOT[0], y: lg.foot[1] - LOG_FOOT[1] };
    // In front of his body and legs, behind his arms (they hug it), paws and head.
    const i = layers.findIndex((l) => l.part.startsWith("arm"));
    layers.splice(i < 0 ? layers.length : i, 0, logL);
    if (lg.kind !== "tilt" && lg.shadow) {
      const sh = lg.kind === "lying" ? LY_SHADOW : ST_SHADOW;
      layers.splice(1, 0, { part: `log:${lg.kind === "lying" ? "lyShadow" : "stShadow"}`, x: lg.foot[0] - LOG_FOOT[0] + sh.at[0], y: lg.foot[1] - LOG_FOOT[1] + sh.at[1] });
    }
  }
  const specks = [...(fr.specks ?? []).map(([sx, sy, k]): Speck => [I_L + W - 1 - sx, sy + I_T, k]), ...(x.specks ?? [])].filter(
    ([sx, sy]) => sx >= 1 && sy >= 1 && sx <= IW - 2 && sy <= IH - 2,
  );
  return { ms, layers, specks, ...(x.cue ? { cue: x.cue } : {}), ...(x.shake ? { shake: [-x.shake[0], x.shake[1]] as const } : {}) };
}

// ---- walk (loop, 6 x 110 ms): a waddle, empty-handed. Each foot lifts and steps forward (our right) in turn, his body
// sways onto the planted foot and bobs up over it, his arms swing against his feet, his tail wags behind.

/** The near (front) and far foot through the stride: [dx, dy] in his own pixels (negative dx: forward). */
const STEP_NEAR: Pt[] = [[3, -1], [0, -4], [-3, -1], [-3, 0], [0, 0], [3, 0]];
const STEP_FAR: Pt[] = [[-3, 0], [0, 0], [3, 0], [3, -1], [0, -4], [-3, -1]];
const SWAY = [2, 1, 0, -2, -1, 0];
const BOB = [0, 1, 0, 0, 1, 0];
const WAG = [-6, -10, -12, -10, -6, -4];
const walk: Anim = {
  loop: true,
  frames: [0, 1, 2, 3, 4, 5].map((t) =>
    intro(110, {
      lean: SWAY[t],
      breath: BOB[t],
      tail: WAG[t],
      mood: "smile",
      mouth: "grin",
      armL: { h: [30 - STEP_NEAR[t]![0], 46 - (t === 1 ? 1 : 0)] },
      armR: { h: [47 - STEP_FAR[t]![0], 46 - (t === 4 ? 1 : 0)] },
    }, { feet: [STEP_NEAR[t]!, STEP_FAR[t]!] }),
  ),
};

// ---- lift (600 ms): he bends and hugs the log at his feet, squeezes, and heaves it up (`hup`) across his chest.

const logUp = (up: number, dx = 0): LogAt => ({ kind: "lying", foot: [LOG_DOWN[0] + dx, LOG_DOWN[1] - up] });
/** Carrying: the log across his chest (16 px off the floor), his paws on its front, cheeks puffed. */
const CARRY_UP = 16;
const STRAIN: Pose = { mood: "squint", brows: "worry", mouth: "frown", puff: 2 };
const carryPose = (p: Pose, bob = 0): Pose => paws(p, [69, 52 - bob], [37, 52 - bob]);
const lift: Anim = {
  loop: false,
  frames: [
    intro(100, paws({ sink: 5, lean: -1, mood: "squint", brows: "angry", tail: -10 }, [70, 63], [36, 63]), { log: { kind: "lying", foot: LOG_DOWN, shadow: true } }),
    intro(100, paws({ sink: 9, lean: -1, mood: "shut", brows: "angry", mouth: "frown", puff: 2, tail: -4 }, [71, 64], [35, 64]), { log: { kind: "lying", foot: LOG_DOWN, shadow: true } }),
    intro(90, paws({ sink: 5, mood: "squint", brows: "angry", mouth: "open", jaw: 3, tail: -14 }, [70, 58], [36, 58]), { log: logUp(6), cue: "hup", dspecks: feetDust(0) }),
    intro(90, paws({ sink: 1, mood: "squint", brows: "angry", mouth: "open", jaw: 2, tail: -18 }, [70, 51], [36, 51]), { log: logUp(13), dspecks: feetDust(1) }),
    intro(110, paws({ breath: 1, headDy: -1, mood: "wide", brows: "up", mouth: "open", jaw: 2, tail: -16 }, [69, 47], [37, 47]), { log: logUp(18) }),
    intro(110, carryPose({ ...STRAIN, tail: -10 }), { log: logUp(CARRY_UP) }),
  ],
};

// ---- carry (loop, 6 x 110 ms): the same waddle under the log, strained (cheeks puffed, eyes squeezed, a drop of
// sweat), the log bobbing a beat behind his steps.

const LOG_BOB = [0, 1, 2, 0, 1, 2];
const carry: Anim = {
  loop: true,
  frames: [0, 1, 2, 3, 4, 5].map((t) =>
    intro(
      110,
      carryPose({ ...STRAIN, mood: t === 2 || t === 5 ? "shut" : "squint", lean: SWAY[t], breath: BOB[t], tail: WAG[t] }, LOG_BOB[t]! - BOB[t]!),
      { feet: [STEP_NEAR[t]!, STEP_FAR[t]!], log: logUp(CARRY_UP + LOG_BOB[t]!), dspecks: t % 3 === 1 ? [px(57, 19, "~"), px(57, 20, "~")] : t % 3 === 2 ? [px(59, 22, "~"), px(59, 23, "~")] : [] },
    ),
  ),
};

// ---- setDown (500 ms): a heave up and over to our right, the log swings down, stands on end (`thump`), a pat, let go.

/** Puffs of sawdust at the standing log's foot, in his own pixels (they're mirrored with him). */
const logFootPuffs = (t: number): Speck[] => {
  const d = (xs: number): number => I_L + W - 1 - xs;
  const y = LOG_STOOD[1] - OY - I_T - 1;
  return [...puff(d(LOG_STOOD[0] - 18), y, t), ...puff(d(LOG_STOOD[0] + 18), y, t)];
};
const STOOD: LogAt = { kind: "standing", foot: LOG_STOOD, shadow: true };
const setDown: Anim = {
  loop: false,
  frames: [
    intro(110, paws({ ...STRAIN, mood: "squint", brows: "angry", lean: -1, breath: 1, tail: -14 }, [76, 46], [45, 46]), { log: logUp(22, 6) }),
    intro(90, paws({ mood: "squint", brows: "angry", mouth: "open", jaw: 2, lean: -2, sink: 2, tail: -18 }, [74, 50], [60, 44]), { log: { kind: "tilt", mid: [77, 54], deg: 42 } }),
    intro(120, paws({ mood: "shut", brows: "angry", mouth: "grin", lean: -2, sink: 3, tail: 0 }, [73, 58], [49, 55]), { log: STOOD, cue: "thump", shake: [0, 1], dspecks: logFootPuffs(0) }),
    intro(90, paws({ mood: "proud", mouth: "grin", lean: -2, sink: 2, breath: 1, tail: -4 }, [73, 56], [48, 53]), { log: STOOD, dspecks: logFootPuffs(1) }),
    intro(90, paws({ mood: "proud", mouth: "grin", lean: -1, sink: 1, tail: -8 }, [69, 58], [47, 54]), { dspecks: logFootPuffs(2) }),
  ],
};

// ---- gnaw (loop, 8 x 90 ms): crouched at the log, a paw on it, he chatters at it: jaw open, teeth shut (`gnaw`,
// `chomp` in turn), his head bobbing in, chips and sawdust spraying from his teeth.

const GN: Pose = { mood: "squint", brows: "angry", lean: -3, sink: 9, tail: -6 };
/** His teeth, in his own pixels, as he bites (for the chips). */
const TEETH: Pt = [12, 47];
/** A spray of chips from his teeth (intro-frame pixels), `t` frames after bite `j`: a fan up and out both ways, falling. */
const MOUTH_AT: Pt = [I_L + W - 1 - TEETH[0], TEETH[1] + OY + I_T];
const biteChips = (j: number, t: number): Speck[] => {
  const out: Speck[] = [];
  for (let i = 0; i < 12; i++) {
    const g = lgrain(i, j, 41);
    const vx = (i % 3 === 0 ? -1 : 1) * (1.6 + g * 4.4);
    const vy = -(5.5 + lgrain(i, j, 42) * 4.5);
    const x = Math.round(MOUTH_AT[0] + 2 + vx * (t + 1));
    const y = Math.round(MOUTH_AT[1] - 2 + vy * (t + 1) + 1.1 * (t + 1) * (t + 1));
    // Each chip a light face and a dark edge, so it shows on the log's pale top and its bark alike.
    const [k1, k2] = (["pJ", "HJ", "hb", "cb", "Hj", "pj"] as const)[(i + j) % 6]!;
    out.push([x, y, k1!], [x + (i % 2 ? 1 : 0), y + (i % 2 ? 0 : 1), k2!]);
    if (i % 4 === 0) out.push([x - 1, y, k1!]);
  }
  return out;
};
const gnawAnim: Anim = {
  loop: true,
  frames: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const open = i % 2 === 0;
    const jaw = [4, 0, 3, 0, 5, 0, 3, 0][i]!;
    const nod = i % 4 === 0 ? -1 : 0;
    const p: Pose = open
      ? { ...GN, mouth: "open", jaw, head: [-4 + nod, 2] }
      : { ...GN, mood: "shut", mouth: "grin", head: [-5, 4] };
    // The chips of each bite (frames 1, 3, 5, 7) flying on for three frames.
    const sp: Speck[] = [];
    for (const b of [1, 3, 5, 7]) {
      const t = (i - b + 8) % 8;
      if (t <= 3) sp.push(...biteChips(b, t));
    }
    const near = paws({ ...p, tail: open ? -6 : -10 }, [75, 66], [0, 0]);
    return intro(90, { ...near, armR: undefined }, {
      cue: open ? undefined : i % 4 === 1 ? "gnaw" : "chomp",
      shake: open ? undefined : [-1, 0],
      dspecks: open ? [] : puff(TEETH[0] - 2, TEETH[1], 0),
      specks: sp,
      behind: REVIEW,
    });
  }),
};

// ---- done (800 ms): a step back from his work, he dusts off his paws (puffs of sawdust), and grins with a chitter.

const dustOff = (t: number, a: Pt): Speck[] => puff(a[0], a[1], t);
const done: Anim = {
  loop: false,
  frames: [
    intro(100, { dx: 2, sink: 1, mood: "smile", mouth: "grin", tail: -12 }, { feet: [[3, -3], [0, 0]] }),
    intro(110, { dx: 3, mood: "squint", mouth: "grin", armL: { h: [32, 52] }, armR: { h: [43, 44] }, tail: -8 }, { cue: "pat", dspecks: [...dustOff(0, [36, 46]), ...dustOff(1, [30, 52])] }),
    intro(110, { dx: 3, mood: "squint", mouth: "grin", armL: { h: [34, 43] }, armR: { h: [41, 53] }, tail: -10 }, { dspecks: [...dustOff(2, [36, 46]), ...dustOff(0, [37, 50]), ...dustOff(1, [44, 44])] }),
    intro(150, { dx: 3, mood: "proud", mouth: "open", jaw: 3, head: [1, -2], hat: [0, -1], armL: { h: [29, 52] }, armR: { h: [47, 52] }, tail: -14 }, { cue: "chitter", dspecks: dustOff(2, [38, 50]) }),
    intro(130, { dx: 3, mood: "proud", mouth: "grin", breath: 1, armL: { h: [29, 52] }, armR: { h: [47, 52] }, tail: -18 }),
    intro(200, { dx: 3, mood: "wink", mouth: "grin", head: [0, -1], armL: { h: [29, 52] }, armR: { h: [47, 52] }, tail: -8 }),
  ],
};

/**
 * Timber for his battle intro: his own parts and palette (plus the log's pale sapwood `p` and its see-through shadow),
 * FACING OUR RIGHT, in a 118 x 98 frame, foot [52, 88]. The log in his paws is INTRO_TIMBER_LOG itself. Its `idle` (one
 * still, standing) is for the preview.
 */
export const BOSS_BEAVER_INTRO: Character = {
  ...BOSS_BEAVER,
  id: "timber-intro",
  name: "Timber (his intro)",
  w: IW,
  h: IH,
  foot: IFOOT,
  palette: { ...PALETTE, p: "#fff0c8", "-": "#0d0e1280", "+": "#0d0e1244" },
  parts: { ...PARTS, ...LOG_PARTS },
  anims: { idle: { loop: true, frames: [intro(1000, {})] }, walk, lift, carry, setDown, gnaw: gnawAnim, done },
};
