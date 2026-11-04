// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/boss-ginger/boss-ginger.ts at 6ef02ce9, Nov 5, 2026; Eric approved the design Nov 5): only the
// import paths changed. Notes: scripts/boss-art/out/shop-ginger-nov5.md and intro-ginger-nov5.md on that branch.
/**
 * Ginger's battle intro moves (BOSS_GINGER_INTRO, id `ginger-intro`; Eric's design, Nov 5): in his igloo he draws power with his
 * magic candy-cane staff (a glow gathering round its hook), shoots a blast up over the battle spot (the ice shard drops: the
 * props, house-intro-ginger), casts once more for the pieces' white light, and brags. Drawn by hand (Nov 5, weekly plan usage).
 *
 * His drawing is the game's (packages/app/src/characters/gingerbread.ts, GINGERBREAD): this file adds nothing to it. Every pose is
 * built with his own rig (`gingerLayers`: the same head, bow tie, body, limbs and cane), so its parts are his own parts record
 * (GINGERBREAD.parts, filled as poses are made); his old frames are untouched. Same frame and foot as GINGERBREAD: 84 x 93, foot
 * [43, 88], facing front, the cane in his right hand (on our left), light from the top left. Not mirrored.
 *
 * - `charge` (once, 9 frames, about 1.1 s): he lifts the cane high, its stripes glow ice-blue and his eyes go icy, frost swirls in
 *   round the hook in three tightening rings, sparkles gathering, a shiver at the end (cue `charge` f1).
 * - `blast` (once, 7 frames, about 0.75 s): the cane thrust up overhead, a flash at the hook and the first of the blast leaving it
 *   up and to the right (cue `blast` f1: the props' blast flies on from INTRO_GINGER_BLAST_FROM), a recoil, the glow fading.
 * - `cast` (once, 8 frames, about 0.9 s): the cane swung down and pointed at the board to his right (our right), glowing, a white
 *   sparkle leaving its tip (cue `cast` f3: the pieces' white light starts on the board), back to the cane at rest.
 * - `brag` (once, 9 frames, about 1.2 s): a cackle, a fist up, the cane thumped on the floor in a puff of frost (cues `laugh` f1,
 *   `thump` f5). It ends on his idle's first frame.
 * - `idle`: his idle's first frame.
 */
import { caneTip, GINGERBREAD, gingerLayers, type GingerPose } from "./gingerbread.ts";
import type { Anim, Character, Frame, Speck } from "./sprite.ts";

type Pt = readonly [number, number];
const OX = 14; // his drawing space on his frame (gingerbread.ts)
const OY = 30;
const GROUND = 58;
const f = (ms: number, p: GingerPose, extra: Partial<Frame> = {}): Frame => ({ ms, layers: gingerLayers(p), ...extra });

// His own glow colors (gingerbread.ts: the cane's stripes ice-blue, his eyes icy), as his freeze and blizzard use them.
const ICY_EYES = { e: "#9ff0ff", E: "#ffffff" };
const GLOW_HALF = { v: "#dff6ff", V: "#9fd8f5" };
const GLOW_PULSE = { s: "#7fe0ff", S: "#2f9be0", v: "#f0fdff", V: "#b5ecff" };
const GLOW_BRIGHT = { s: "#b5f0ff", S: "#5cc8ff", v: "#ffffff", V: "#dff6ff" };

const sparkle = (x: number, y: number, big = false): Speck[] => [
  [x, y, "F"],
  [x - 1, y, "I"],
  [x + 1, y, "I"],
  [x, y - 1, "I"],
  [x, y + 1, "I"],
  ...(big ? ([[x - 2, y, "f"], [x + 2, y, "f"], [x, y - 2, "f"], [x, y + 2, "f"]] as Speck[]) : []),
];
/** Frost swirling in round a point: `n` flakes on a ring of radius r, turned `turn` (0-1). */
const ring = ([x, y]: Pt, r: number, turn: number, n = 8): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const a = (i / n + turn) * Math.PI * 2;
    const px = Math.round(x + Math.cos(a) * r);
    const py = Math.round(y + Math.sin(a) * r * 0.85);
    return i % 3 === 0 ? sparkle(px, py) : [[px, py, i % 2 ? "F" : "i"], [px + 1, py, "I"]];
  }).flat();
/** The hook's top (frame px) in a pose: its tip's opposite end, `up` px past the grip along the cane. */
const RAISE: GingerPose = { crouch: 1, cane: "raise", glow: true, mood: "shout", free: "out" };
const OVER: GingerPose = { cane: "overhead", free: "up", glow: true, mood: "shout", feet: "wide" };
const HOOK_RAISE: Pt = [OX + 17, OY + 3];
const HOOK_OVER: Pt = [OX + 15, OY - 9];
/** Where the blast leaves him (frame px): the props' blast (INTRO_GINGER_BLAST) flies on from here, up and to our right. */
export const INTRO_GINGER_BLAST_FROM: Pt = [HOOK_OVER[0] + 3, HOOK_OVER[1] - 2];
/** The blast's first stretch, on his frame: a bright shard of frost leaving the hook up and to the right, a trail behind it. */
const beam = (t: number): Speck[] => {
  const out: Speck[] = [];
  const [x0, y0] = INTRO_GINGER_BLAST_FROM;
  const len = 6 + t * 9;
  for (let s = 0; s < len; s++) {
    const x = Math.round(x0 + s * 0.8);
    const y = Math.round(y0 - s * 0.6);
    if (y < 0) break;
    const hot = s > len - 4;
    out.push([x, y, hot ? "F" : s % 2 ? "i" : "I"], [x, y + 1, hot ? "i" : "J"]);
    if (hot) out.push([x + 1, y, "F"], [x, y - 1, "F"]);
  }
  return out;
};
const frostBurst = ([x, y]: Pt, r: number): Speck[] =>
  Array.from({ length: 8 }, (_, i): Speck[] => {
    const a = (i / 8) * Math.PI * 2;
    const px = Math.round(x + Math.cos(a) * r * 1.4);
    const py = Math.min(y + 1, Math.round(y + Math.sin(a) * r * 0.6) - 1);
    return i % 2 ? [[px, py, "I"]] : sparkle(px, py);
  }).flat();

const charge: Anim = {
  loop: false,
  frames: [
    f(110, { crouch: 1, cane: "lift", mood: "angry" }),
    f(120, { ...RAISE, glow: false, mood: "angry" }, { cue: "charge", specks: ring(HOOK_RAISE, 13, 0, 6) }),
    f(120, RAISE, { pal: GLOW_HALF, specks: ring(HOOK_RAISE, 11, 0.12, 8) }),
    f(120, RAISE, { pal: { ...GLOW_HALF, ...ICY_EYES }, specks: [...ring(HOOK_RAISE, 9, 0.24, 8), ...sparkle(HOOK_RAISE[0] + 12, HOOK_RAISE[1] + 6)] }),
    f(120, { ...RAISE, headDy: -1 }, { pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: [...ring(HOOK_RAISE, 7, 0.36, 8), ...ring(HOOK_RAISE, 12, 0.5, 6)] }),
    f(120, RAISE, { pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: [...ring(HOOK_RAISE, 5, 0.48, 6), ...ring(HOOK_RAISE, 10, 0.62, 8)] }),
    f(110, { ...RAISE, crouch: 2 }, { pal: { ...GLOW_BRIGHT, ...ICY_EYES }, specks: [...ring(HOOK_RAISE, 3, 0.6, 6), ...ring(HOOK_RAISE, 7, 0.74, 8), ...sparkle(...HOOK_RAISE, true)], shake: [1, 0] }),
    f(110, { ...RAISE, crouch: 2 }, { pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: [...ring(HOOK_RAISE, 4, 0.8, 8), ...sparkle(...HOOK_RAISE, true)], shake: [-1, 0] }),
    f(120, { ...RAISE, crouch: 1 }, { pal: { ...GLOW_BRIGHT, ...ICY_EYES }, specks: [...sparkle(...HOOK_RAISE, true), ...sparkle(HOOK_RAISE[0] - 5, HOOK_RAISE[1] + 4), ...sparkle(HOOK_RAISE[0] + 5, HOOK_RAISE[1] - 3)] }),
  ],
};
const blast: Anim = {
  loop: false,
  frames: [
    f(90, { ...OVER, crouch: 1 }, { pal: { ...GLOW_BRIGHT, ...ICY_EYES }, specks: sparkle(...HOOK_OVER, true) }),
    f(90, OVER, { cue: "blast", pal: { ...GLOW_BRIGHT, ...ICY_EYES, w: "#ffffff", W: "#e6f8ff" }, specks: [...sparkle(...HOOK_OVER, true), ...beam(0)], shake: [0, -1] }),
    f(90, { ...OVER, headDy: -1 }, { pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: [...sparkle(HOOK_OVER[0], HOOK_OVER[1]), ...beam(1)] }),
    f(100, { ...OVER, crouch: 2 }, { pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: beam(2).filter((_, i) => i > 6) }),
    f(110, { ...OVER, crouch: 2, mood: "laugh" }, { pal: GLOW_HALF, specks: [[HOOK_OVER[0] + 2, HOOK_OVER[1] - 1, "I"], [HOOK_OVER[0] - 1, HOOK_OVER[1] + 2, "i"]] }),
    f(120, { ...OVER, crouch: 1, mood: "laugh", glow: false }),
    f(150, { crouch: 1, cane: "lift", mood: "smug" }),
  ],
};
const CAST: GingerPose = { crouch: 2, feet: "wide", cane: "thrust", free: "up", glow: true, mood: "shout" };
const castTip = caneTip(CAST);
/** The cast's white light leaving the cane's tip toward the board (to our right): a white mote and its sparkle trail. */
const mote = (t: number): Speck[] => {
  const x = castTip[0] + 3 + t * 6;
  const y = castTip[1] - t;
  return [...sparkle(x, y, t < 2), [x - 3, y + 1, "F"], [x - 6, y + 1, "i"], [x - 9, y + 2, "I"]];
};
const cast: Anim = {
  loop: false,
  frames: [
    f(110, { crouch: 1, cane: "lift", mood: "angry" }),
    f(110, { ...RAISE, glow: true }, { pal: GLOW_HALF, specks: ring(HOOK_RAISE, 8, 0.1, 6) }),
    f(100, { ...CAST, glow: true }, { pal: { ...GLOW_PULSE, ...ICY_EYES }, specks: sparkle(castTip[0] + 1, castTip[1], true) }),
    f(100, CAST, { cue: "cast", pal: { ...GLOW_BRIGHT, ...ICY_EYES }, specks: mote(0), shake: [-1, 0] }),
    f(100, { ...CAST, dx: -1 }, { pal: GLOW_PULSE, specks: mote(1) }),
    f(110, { ...CAST, dx: -1, mood: "laugh" }, { pal: GLOW_HALF, specks: mote(2) }),
    f(130, { ...CAST, glow: false, mood: "laugh", crouch: 1 }),
    f(150, { crouch: 1, cane: "lift", mood: "smug" }),
  ],
};
const brag: Anim = {
  loop: false,
  frames: [
    f(120, { mood: "smug", free: "hip" }),
    f(140, { mood: "laugh", free: "up", headDy: -1 }, { cue: "laugh" }),
    f(120, { mood: "laugh", free: "up", bob: 1 }),
    f(130, { mood: "laugh", free: "up", headDy: -1 }),
    f(110, { mood: "shout", cane: "lift", crouch: 1, free: "out" }),
    f(90, { mood: "shout", cane: "rest", free: "out" }, { cue: "thump", specks: frostBurst([OX + 10, OY + GROUND - 1], 2), shake: [0, 1] }),
    f(110, { mood: "smug", cane: "rest", free: "hip" }, { specks: frostBurst([OX + 10, OY + GROUND - 1], 4) }),
    f(140, { mood: "smug", cane: "rest", free: "hip" }, { specks: frostBurst([OX + 10, OY + GROUND - 2], 5).filter((_, i) => i % 2 === 0) }),
    f(200, {}),
  ],
};

export const BOSS_GINGER_INTRO: Character = {
  ...GINGERBREAD,
  id: "ginger-intro",
  name: "Ginger (his intro)",
  anims: { charge, blast, cast, brag, idle: { loop: true, frames: [GINGERBREAD.anims.idle!.frames[0]!] } },
};
