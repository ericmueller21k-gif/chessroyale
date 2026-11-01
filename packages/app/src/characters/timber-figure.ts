/**
 * Timber's figure as the game draws it (docs/decisions/2026-11-01-timber.md): his approved drawing and animations (timber.ts),
 * in a frame with room round it: TIMBER_ROOM pixels over his head for his entrance's drop from above (34 rows over the art's
 * 88 x 88 frame at its highest), and a little at the sides and foot. The art's report (Nov 1) said a few hammer points and
 * flying chips touch the frame's edge and that the frame can grow when he's wired in: nothing of his drawing changes, only the
 * room round it (characters.test.ts: nothing cut off at the frame's edge).
 */
import { BOSS_BEAVER } from "./timber.ts";
import type { Anim, Character, Frame } from "./sprite.ts";

/** The room added on each side, in his own pixels. */
export const TIMBER_ROOM = { top: 37, left: 6, right: 4, bottom: 4 } as const;
const R = TIMBER_ROOM;

const moved = (f: Frame): Frame => ({
  ...f,
  layers: f.layers.map((l) => ({ ...l, x: l.x + R.left, y: l.y + R.top })),
  ...(f.specks ? { specks: f.specks.map(([x, y, k]) => [x + R.left, y + R.top, k] as const) } : {}),
});

/** His figure: the approved one in a frame with room round it (98 x 129). */
export const TIMBER_FIGURE: Character = {
  ...BOSS_BEAVER,
  w: BOSS_BEAVER.w + R.left + R.right,
  h: BOSS_BEAVER.h + R.top + R.bottom,
  foot: [BOSS_BEAVER.foot[0] + R.left, BOSS_BEAVER.foot[1] + R.top],
  anims: Object.fromEntries(Object.entries(BOSS_BEAVER.anims).map(([k, a]) => [k, { ...a, frames: a.frames.map(moved) } satisfies Anim])),
};
