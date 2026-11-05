/**
 * Folio's challenge-intro moves (BOSS_FOLIO_INTRO, id `folio-intro`; Nov 5, brief-folio-sanctuary-art.md). Folio's drawing
 * is the game's (packages/app/src/characters/folio.ts, FOLIO), so this file adds nothing to it and leaves it as it is: every
 * pose is built with its own rig (`folioLayers`, the same wings, neck, head, tail, body and shadow, painted from their points),
 * and every part is read from FOLIO.parts. Nothing new is drawn on it.
 *
 * Same frame as FOLIO: 97 x 92, foot [52, 86], drawn facing our left, light from the top left. **In the intro it is mirrored**
 * (flip the whole frame) so it faces east, toward the table, from the west mark, as Timber and Dash are.
 *
 * - `glide` (loops, 6 x 120 ms): the walk-on, a hover-glide: wings held out lower and wider and level, the neck reaching
 *   forward, the tail streaming back, the whole crane bobbing a pixel or two over its shadow. Code slides it to its mark.
 * - `bow` (once, 5 frames, 1.06 s): a small bow when the board lands: the neck dips, the head folds down, the eye closes
 *   happily, the wings lower a hair; it holds, and comes back up. Cue `bow` f1.
 * - `idle`: its own idle (FOLIO's, 24 x 200 ms), for code that needs it here.
 * Its palette is FOLIO's but for its shadow (`z`): a warm see-through brown, since the sanctuary's floor is pale paper and
 * FOLIO's near-black shadow (made for the town's dark ground) cut a hard bar under it there.
 */
import { FOLIO, folioLayers, type FolioPose } from "../../../../packages/app/src/characters/folio.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer } from "../../../../packages/app/src/characters/sprite.ts";

const { parts, add } = lazyParts();
/** One of its own parts, by its name (made by its rig on first use). */
const own = (name: string) => add(name, () => FOLIO.parts[name]!);
/** Everything in FOLIO's frame is drawn round its middle and shifted OX px right (folio.ts `shifted`). */
const OX = FOLIO.foot[0] - 46;
const pose = (p: FolioPose): Layer[] => folioLayers(p).map((l) => ({ ...l, part: own(l.part), x: l.x + OX }));
const F = (ms: number, p: FolioPose, more: Partial<Frame> = {}): Frame => ({ ms, layers: pose(p), ...more });

/** The glide: wings out lower and level, the neck forward, the tail back, bobbing over the shadow. */
const BOB = [0, -1, -2, -2, -1, 0];
const glide: Anim = {
  loop: true,
  frames: BOB.map((dy, i) =>
    F(120, {
      dy: dy - 1,
      wingN: [3, 8 + (i % 3 === 1 ? -1 : 0)],
      wingF: [-3, 7 + (i % 3 === 1 ? -1 : 0)],
      neck: [-3, 3],
      tail: [3, 1],
      shadow: 12 + Math.max(0, 2 + dy),
    }),
  ),
};

/** The bow. */
const bow: Anim = {
  loop: false,
  frames: [
    F(140, {}),
    F(120, { neck: [1, 3], head: "dip", wingN: [0, 1], wingF: [0, 1] }, { cue: "bow" }),
    F(460, { neck: [3, 6], head: "dip", eye: "happy", wingN: [1, 2], wingF: [0, 2], dy: 1 }),
    F(140, { neck: [1, 3], head: "dip", eye: "happy", wingN: [0, 1] }),
    F(200, { eye: "happy" }),
  ],
};

/** Its own idle, its parts read from FOLIO. */
const idle: Anim = {
  loop: true,
  frames: FOLIO.anims.idle!.frames.map((f) => ({ ...f, layers: f.layers.map((l) => ({ ...l, part: own(l.part) })) })),
};

export const BOSS_FOLIO_INTRO: Character = {
  id: "folio-intro",
  name: "Folio (its intro)",
  w: FOLIO.w,
  h: FOLIO.h,
  foot: FOLIO.foot,
  // Its shadow (z) a warm see-through brown on the paper floor, not the dark ground's near-black.
  palette: { ...FOLIO.palette, z: "#5e4c3a88" },
  halo: FOLIO.halo,
  parts,
  anims: { glide, bow, idle },
};
