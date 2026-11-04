/**
 * Jefferson's battle intro moves (BOSS_GREX_INTRO, id `grex-intro`; Eric's design, Nov 4): in his warehouse he hollers for
 * his crew (a hoof cupped by his mouth), waves them over to the table, and brags. Drawn by hand (Nov 4, weekly plan usage).
 *
 * His drawing is the game's (packages/app/src/characters/grex.ts, GREX): this file adds nothing to it. Every pose is built with
 * his own rig (`grexBuild`: the same head, flames, body, limbs, sparklers), so its parts are his own parts record (GREX.parts,
 * made on first use); his old frames are untouched. Same frame and foot as GREX: 100 x 122, foot [48, 118], three-quarters
 * facing our right, light from the top left. Not mirrored.
 *
 * (The hoof by his mouth: his rig's near arm reaches wherever he grips his Roman candle, so the pose grips an unseen candle
 * at the spot by his muzzle and leaves the candle out: his own arm, painted by his own rig.)
 *
 * - `call` (once, 8 frames, about 1.1 s): he ducks his head a little, cups his near hoof by his muzzle and hollers, the far
 *   sparkler raised high and waved (cue `shout` f1, again f5: two calls), his flames roaring up on the shout.
 * - `waveOver` (loops, 4 x 130 ms): "over here": the near arm swung out and pulled back in toward him, twice a loop, the far
 *   sparkler up, a grin (cue `whoosh` f0, soft).
 * - `brag` (once, 10 frames, about 1.4 s): both sparklers up, a twirl overhead, a laugh with his flames big, a hip-pop and a
 *   point at you (cues `laugh` f2, `fizz` f5, `stomp` f8). It ends on his idle's first frame.
 * - `idle`: his idle's first frame.
 */
import { GREX, grexBuild, sparkSpray, type GrexPose } from "../../../../packages/app/src/characters/grex.ts";
import type { Anim, Character, Frame } from "../../../../packages/app/src/characters/sprite.ts";

type Pt = readonly [number, number];
const OX = 20; // his drawing space on his frame (grex.ts)
const OY = 58;

/** A frame of a pose (his sparklers spitting sparks, seeded), as his own file's `f`; `hoof`: the near hoof by his muzzle. */
function fr(ms: number, p: GrexPose, seed: number, extra: Partial<Frame> = {}, hoof?: Pt): Frame {
  const pose: GrexPose = hoof ? { ...p, candle: { base: [hoof[0], hoof[1] + 20], deg: 0, grip: 20 } } : p;
  const b = grexBuild(pose);
  const layers = hoof ? b.layers.filter((l) => !l.part.startsWith("tube:")) : b.layers;
  const sparks = b.tips.flatMap((t, i) => sparkSpray(t, seed * 7 + i * 3 + 1, p.big ? 1.4 : 1));
  return { ms, layers, ...extra, specks: [...sparks, ...(extra.specks ?? [])] };
}
/** His holler: little sound-lines out from his muzzle (white, three short dashes fanning), `t` frames on. */
const holler = (t: number, dy = 0): Frame["specks"] => {
  const x = OX + 44;
  const y = OY - 2 + dy;
  const lines: Pt[][] = [
    [[0, -4], [2, -5], [3, -6]],
    [[1, 0], [3, 0], [5, 0]],
    [[0, 4], [2, 5], [3, 6]],
  ];
  return lines.flatMap((ln) => ln.map(([dx, dy2]) => [x + dx + t * 2, y + dy2, "t"] as const));
};
/** The near hoof cupped by his muzzle (his drawing space), with his head ducked 6 px and 2 forward. */
const CUP: Pt = [45, 1];
const CALL: GrexPose = { headDy: 6, headDx: 2, mood: "shout", a: "high", feet: "wide" };

const call: Anim = {
  loop: false,
  frames: [
    fr(140, { ...CALL, mood: "grin", headDy: 2, a: "pump", flick: 0 }, 1, {}, [42, 9]),
    fr(160, { ...CALL, big: true, flick: 1 }, 2, { cue: "shout", specks: holler(0) }, CUP),
    fr(130, { ...CALL, big: true, flick: 2, a: "pump" }, 3, { specks: holler(1) }, CUP),
    fr(110, { ...CALL, flick: 3 }, 4, { specks: holler(2) }, CUP),
    fr(120, { ...CALL, mood: "grin", flick: 4, a: "pump" }, 5, {}, [42, 8]),
    fr(160, { ...CALL, big: true, flick: 5 }, 6, { cue: "shout", specks: holler(0) }, CUP),
    fr(130, { ...CALL, big: true, flick: 6, a: "pump" }, 7, { specks: holler(1) }, CUP),
    fr(160, { mood: "grin", flick: 7 }, 8),
  ],
};
const waveOver: Anim = {
  loop: true,
  frames: [
    fr(130, { b: "point", a: "high", mood: "grin", flick: 0 }, 11, { cue: "whoosh" }),
    fr(130, { b: "wind", a: "high", mood: "laugh", flick: 1, bob: 1 }, 12),
    fr(130, { b: "point", a: "pump", mood: "grin", flick: 2 }, 13),
    fr(130, { b: "wind", a: "high", mood: "laugh", flick: 3, bob: 1 }, 14),
  ],
};
const brag: Anim = {
  loop: false,
  frames: [
    fr(120, { a: "high", b: "high", mood: "grin", flick: 0 }, 21),
    fr(110, { a: "high", b: "wind", mood: "grin", flick: 1, big: true }, 22),
    fr(150, { a: "pump", b: "high", mood: "laugh", flick: 2, big: true }, 23, { cue: "laugh" }),
    fr(130, { a: "high", b: "high", mood: "laugh", flick: 3, big: true, bob: 1 }, 24),
    fr(130, { a: "pump", b: "high", mood: "laugh", flick: 4, big: true }, 25),
    fr(120, { a: "high", b: "point", mood: "grin", flick: 5 }, 26, { cue: "fizz" }),
    fr(150, { a: "chin", b: "point", mood: "smug", flick: 6, feet: "stepR" }, 27),
    fr(150, { a: "chin", b: "hip", mood: "smug", flick: 7, feet: "stepR" }, 28),
    fr(160, { a: "cross", b: "out", mood: "grin", flick: 8, crouch: 1 }, 29, { cue: "stomp" }),
    fr(180, { flick: 9 }, 30),
  ],
};

export const BOSS_GREX_INTRO: Character = {
  ...GREX,
  id: "grex-intro",
  name: "Jefferson (his intro)",
  anims: { call, waveOver, brag, idle: { loop: true, frames: [GREX.anims.idle!.frames[0]!] } },
};
