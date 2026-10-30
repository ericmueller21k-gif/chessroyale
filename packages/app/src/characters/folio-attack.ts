/**
 * Folio's portrait and its attack on a king (Oct 27, the wiring lane's), put together from its approved art's own poses
 * (characters/folio.ts: `folioLayers`), nothing redrawn.
 *
 * Its attack, on the shared beats (KING_ATTACK, boss-timing.ts), the king to our left (where it faces; the board mirrors it when
 * the king is on its right): it glides down from above on its wings (`flap`), settles (`rustle`), then, calm and exact, points its
 * near wing at the king ten times and flicks a stroke of ink across it each time, high then low (cues `ink` and `dab`, the board
 * splashing the king's square: `inkItem`), as if crossing the king out of the page; then a small polite bow, its gilt glinting
 * (`glint`), and it lifts away (`flap`). The last frame is empty. Kit: perSquare 36, stand 1.7, facesLeft.
 */
import { KING_ATTACK } from "@chessroyale/chess";
import { FOLIO, folioLayers, type FolioPose } from "./folio.ts";
import type { Anim, Character, Frame, Speck } from "./sprite.ts";

/** The art's own offset (its frames are drawn OX pixels further right than its poses: folio.ts `shifted`). */
const OX = 6;
/** Room on the left for the ink's reach to the king, and above for its glide down. */
const REACH = 16;
const TOP = 40;
/** Where it stands from the king: frame pixels to a square, squares off. */
export const ATTACK_PER_SQUARE = 36;
export const ATTACK_STAND = 1.7;

/** Its foot in its poses' space (folio.ts: MID 46, GROUND 86). */
const FOOT: readonly [number, number] = [FOLIO.foot[0] - OX, FOLIO.foot[1]];
/** The near wing's tip when it points (folio.ts: the rest tip [72, 11] and the check's POINT [-63, 35], a pixel up). */
const POINT: readonly [number, number] = [-63, 35];
const TIP: readonly [number, number] = [72 + POINT[0], 11 + POINT[1] - 1];
/** Where each stroke lands on the king: its head, then a little lower. */
const KING = (i: number): readonly [number, number] => [FOOT[0] - ATTACK_STAND * ATTACK_PER_SQUARE - 3, FOOT[1] - (i % 2 ? 20 : 27)];

/** A frame of its in the attack's bigger frame. */
const F = (ms: number, p: FolioPose, extra: Partial<Frame> = {}): Frame => ({
  ms,
  layers: folioLayers(p).map((l) => ({ ...l, x: l.x + OX + REACH, y: l.y + TOP })),
  ...extra,
  ...(extra.specks ? { specks: extra.specks.map(([x, y, k]): Speck => [x + OX + REACH, y + TOP, k]) } : {}),
});

/** A stroke of ink from the wing's tip to the king: a line of its ink, two pixels thick near the king, a splash where it lands. */
function inkStroke(i: number): Speck[] {
  const [x0, y0] = TIP;
  const [x1, y1] = KING(i);
  const out: Speck[] = [];
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let s = 0; s <= n; s++) {
    const u = s / n;
    const x = Math.round(x0 + (x1 - x0) * u);
    const y = Math.round(y0 + (y1 - y0) * u - 3 * Math.sin(Math.PI * u));
    out.push([x, y, u < 0.5 ? "U" : "l"]);
    if (u > 0.55) out.push([x, y + 1, "l"]);
  }
  for (const [dx, dy] of [[-1, -1], [-2, 1], [-3, -2], [1, 2]] as const) out.push([x1 + dx, y1 + dy, "l"]);
  return out;
}

/** The pointing pose (its check's), the wing at the king; the next a beat lifted, gathering the next stroke. */
const AIM: FolioPose = { neck: [-2, -10], head: "rest", wingN: POINT, wingF: [3, -2], dy: -1 };
const GATHER: FolioPose = { neck: [-1, -8], head: "rest", wingN: [-48, 24], wingF: [2, -2], dy: -1 };

const kingAttack: Anim = (() => {
  const A = KING_ATTACK;
  const frames: Frame[] = [
    { ms: 100, layers: [] },
    F(120, { dy: -44, wingN: [0, -6], wingF: [0, -6], head: "up", shadow: 6 }, { cue: "flap" }),
    F(120, { dy: -26, wingN: [0, -3], wingF: [0, -3], shadow: 9 }),
    F(A.landAt - 340, { dy: -10, wingN: [0, 1], wingF: [0, 1], shadow: 12 }),
    F(A.lashAt - A.landAt, { neck: [-1, -4], wingN: [-6, -5] }, { cue: "rustle" }),
  ];
  const half = A.lashEveryMs / 2;
  for (let i = 0; i < A.lashes; i++) {
    frames.push(F(half, AIM, { cue: i % 2 ? "dab" : "ink", specks: inkStroke(i), shake: [i % 2 ? 1 : -1, 0] }));
    frames.push(F(A.lashEveryMs - half, GATHER));
  }
  const done = A.leaveAt - (A.lashAt + A.lashes * A.lashEveryMs);
  frames.push(F(done, { neck: [3, 6], head: "dip", eye: "happy", wingN: [0, 1], wingF: [0, 1] }, { cue: "glint" }));
  frames.push(F(150, { dy: -2 }), F(110, { dy: -14, wingN: [0, -4], wingF: [0, -4], shadow: 10 }, { cue: "flap" }), F(A.ms - A.leaveAt - 310, { dy: -32, wingN: [0, -6], wingF: [0, -6], shadow: 7 }), { ms: 50, layers: [] });
  return { loop: false, frames };
})();

/**
 * The crane for its attack on a king: the same drawing, parts and palette, facing our left as always, in a frame `REACH` wider on
 * the left (the ink's reach) and `TOP` taller (its glide down). Its `idle`, one still, is for the preview.
 */
export const FOLIO_ATTACK: Character = {
  ...FOLIO,
  id: "folio-attack",
  name: "Folio (its attack)",
  w: FOLIO.w + REACH,
  h: FOLIO.h + TOP,
  foot: [FOLIO.foot[0] + REACH, FOLIO.foot[1] + TOP],
  anims: { idle: { loop: true, frames: [F(1000, {})] }, kingAttack },
};

/** The part of it a portrait shows (its head and beak, the top of its neck and its near wing's root), in frame pixels. */
export const FOLIO_PORTRAIT = { x: 2, y: 10, w: 40, h: 32 } as const;
