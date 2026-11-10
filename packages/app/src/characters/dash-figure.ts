/**
 * Dash's figure as the game draws it (docs/decisions/2026-11-03-dash.md): his approved drawing and animations (boss-blitz.ts,
 * the art's own name), in a frame with DASH_ROOM pixels more on the right: his entrance's two zip-in frames start partly past
 * the art's 72 x 104 frame on purpose (its notes, "They get it on purpose"), and the game's frames never cut a drawing off at
 * their edge (characters.test.ts). Nothing of his drawing changes and his feet stay where they are; only the room round it.
 *
 * Dash v2 (Eric, Nov 6: "He smacks the clock too much, the noise is distracting. Just have him smack it every time he moves";
 * docs/decisions/2026-11-06-dash-v2.md), built from the same frames and rig:
 * - one smack a move: his move and his check keep their one slap of the clock; his capture's slap goes, as his Clock Slap's slam
 *   is that move's smack; his rest loops (idle, thinking, rattled) never touch the clock;
 * - his clock smacks: the multi-hit (`fit5`, every 4 or 5 of his moves), the pop-off's two beats (`fit3`, then `fit10`), and the
 *   Scramble Rush's countdown (`fit3`, `fit4`);
 * - his Scramble Rush's running copy (DASH_RUN: his zip-in's pose, drawn leaning by the screen);
 * - his attack on a king (DASH_ATTACK: a dash in with his trail, ten claw swipes, a dash off).
 */
import { BOSS_POWERS } from "@chessroyale/core";
import { BOSS_BLITZ, PALETTE, layers, star, type Pose } from "./boss-blitz.ts";
import { moved } from "./attack-frame.ts";
import type { Anim, Character, Frame, Speck } from "./sprite.ts";
import { lazyAnim } from "./sprite.ts";

/** The room added on his right, in his own pixels (his zip-in's blur reaches 32 past the art's frame). */
export const DASH_ROOM = 33;

const A = BOSS_BLITZ.anims;
const F = (ms: number, pose: Pose = {}, extra: Partial<Frame> = {}): Frame => ({ ms, layers: layers(pose), ...extra });
/** Frame `i` of `a` with frame `j`'s drawing (its length kept), no cue. */
const as = (a: Anim, i: number, j: number): Frame => ({ ...a.frames[j]!, ms: a.frames[i]!.ms, cue: undefined });
const noCue = (f: Frame): Frame => (f.cue ? { ...f, cue: undefined } : f);

/**
 * His idle without its two clock slaps (and the flag's wobble after them): those frames drawn as rest frames of the same bounce
 * (the same step of its four).
 */
const idle: Anim = lazyAnim(() => ({
  loop: true,
  frames: A.idle!.frames.map((f, i) => (i >= 4 && i <= 8 ? as(A.idle!, i, i + 8) : i >= 20 && i <= 24 ? as(A.idle!, i, i - 8) : (i >= 9 && i <= 11) || (i >= 25 && i <= 27) ? as(A.idle!, i, i % 4) : noCue(f))),
}));
/** His thinking without the drumming on the clock: each tap drawn as the frame before it; his yawn kept. */
const thinking: Anim = lazyAnim(() => ({
  loop: true,
  frames: A.thinking!.frames.map((f, i) => (i % 2 === 1 && !(i >= 12 && i <= 15) ? as(A.thinking!, i, i - 1) : f)),
}));
/** Rattled without the nervous taps on the clock: each tap drawn as the frame before it (the sweat and the shake kept). */
const rattled: Anim = lazyAnim(() => ({
  loop: true,
  frames: A.rattled!.frames.map((f, i) => (i % 2 === 1 ? { ...as(A.rattled!, i, i - 1), shake: f.shake } : noCue(f))),
}));
/** His capture without its slap: his Clock Slap's slam (as your turn begins) is that move's smack. */
const capture: Anim = lazyAnim(() => ({ loop: false, frames: A.capture!.frames.map((f, i) => (i === 5 ? as(A.capture!, i, 4) : f)) }));

/**
 * A clock multi-hit: `n` quick smacks of the clock, `ms` a smack (his move's slap: the paw up, then down with its click, the up a
 * little under 40%), then a grin. The multi-hit is fit5 (dashClockFit: 5 at smackMs), his pop-off's first beat fit3 (smackMs),
 * its fast second beat fit10 (dashPopOff: 10 at hitMs); the Scramble Rush's countdown smacks are fit3 and fit4 as well.
 */
function fit(n: number, ms: number): Anim {
  const [up, down, high] = [A.move!.frames[3]!, A.move!.frames[4]!, A.move!.frames[5]!];
  const rise = Math.round(ms * 0.4);
  return {
    loop: false,
    frames: [...Array.from({ length: n }, () => [{ ...up, ms: rise }, { ...down, ms: ms - rise }]).flat(), { ...high, ms: 120 }, F(240, { mouth: "grin", brow: 1, eyes2: "sly" })],
  };
}

/** His figure: the approved one in a frame with room on its right (105 x 104), his rest loops quiet, and his clock smacks. */
export const DASH_FIGURE: Character = {
  ...BOSS_BLITZ,
  w: BOSS_BLITZ.w + DASH_ROOM,
  anims: {
    ...A,
    idle,
    thinking,
    rattled,
    capture,
    fit3: fit(3, BOSS_POWERS.dashClockFit.smackMs),
    fit4: fit(4, BOSS_POWERS.dashClockFit.smackMs),
    fit5: fit(BOSS_POWERS.dashClockFit.smacks, BOSS_POWERS.dashClockFit.smackMs),
    fit10: fit(BOSS_POWERS.dashPopOff.hits, BOSS_POWERS.dashPopOff.hitMs),
  },
};

/** The Scramble Rush's running copy: his zip-in's pose (on his toes, ears back, tail out), facing our left; the screen leans it. */
export const DASH_RUN: Frame = F(100, { lift: 2, tail: 4, ears: 2, eyes: "wide", head: [1, 0], hand: "up", mouth: "grin" });

// ---------------- His attack on a king ----------------

/** The attack's frame: his own frame moved `DX` right and `DY` down into one `AW` x `AH` (room for his claws' reach and his zip). */
const AW = 140;
const AH = 108;
const DX = 44;
const DY = 4;
const sp = (x: number, y: number, k: string): Speck => [Math.round(x), Math.round(y), k];
/** Speed lines (in the attack frame's pixels), running to the right from `x0`: bright at their heads, fading into his teal. */
const trail = (x0: number, ys: readonly number[], len: number): Speck[] =>
  ys
    .flatMap((y, i) => Array.from({ length: len - (i % 2) * 6 }, (_, j) => sp(x0 + (i % 3) * 3 + j, y, j < 3 ? "O" : j < len * 0.4 ? "H" : j < len * 0.7 ? "G" : "D")))
    .filter(([x, y]) => x >= 3 && x <= AW - 4 && y >= 3 && y <= AH - 4);
/** His claws' slash at the king (in his own pixels: moved with him), high or low: three streaks out from his paw. */
const slash = (low: boolean): Speck[] => {
  const out: Speck[] = [];
  const y0 = low ? 58 : 36;
  for (let c = 0; c < 3; c++)
    for (let j = 0; j < 22; j++) out.push(sp(6 - j, y0 + c * 4 + (low ? -j * 0.45 : j * 0.45), j < 4 ? "H" : j < 15 ? "O" : "N"));
  return out;
};
/** A swipe: his near paw out at the king, claws open, leaning in; a slash, high then low in turn. */
const swipe = (low: boolean): Frame => F(90, { dx: -2, lift: 1, at: low ? [12, 56] : [12, 42], gesture: "open", head: [-1, 0], eyes2: "sly", mouth: "wide", brow: 2, tail: 3 }, { cue: low ? "snap" : "whoosh", specks: slash(low) });
/** Between swipes: the paw drawn back. */
const recoil = (low: boolean): Frame => F(80, { lift: 1, at: low ? [30, 50] : [30, 44], gesture: "open", eyes2: "sly", mouth: "grin", brow: 1, tail: 2 });
const into = (f: Frame, ground: readonly Speck[] = []) => moved(f, DX, DY, AW, AH, 0, ground);

const kingAttack: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    // He comes in from the right in a blur (his zip-in's speed lines) and skids to a stop beside the king (by 470 ms).
    { ms: 90, layers: [], specks: trail(DX + 60, [30, 42, 54, 66, 78, 90], 26), cue: "zip" },
    into(F(110, { dx: 24, lift: 2, tail: 4, ears: 2, eyes: "wide", head: [1, 0], hand: "up" }), trail(DX + 74, [34, 50, 66, 82], 20)),
    into(F(110, { dx: 10, lift: 1, tail: 4, ears: 2, eyes: "wide", head: [1, 0], hand: "up" }), trail(DX + 62, [40, 60, 80], 14)),
    into(F(100, { dx: -2, sink: 2, head: [2, 0], ears: 1, eyes: "wide", mouth: "o", tail: 3, hand: "up" }, { cue: "skid", shake: [-1, 0] })),
    into(F(60, { sink: 1, tail: 2, hand: "high", eyes2: "sly", brow: 1 })),
    into(F(90, { lift: 1, at: [32, 44], gesture: "open", eyes2: "sly", mouth: "grin", brow: 2, tail: 3 })),
    // Ten swipes on the shared hits (KING_ATTACK: 560 ms on, every 170), high and low in turn.
    ...Array.from({ length: 10 }, (_, i) => [into(swipe(i % 2 === 1)), into(recoil(i % 2 === 1))]).flat(),
    // A grin at us, then he zips off to the right and is gone (by 2780 ms).
    into(F(120, { mouth: "wide", eyes2: "us", brow: 1 }, { specks: star(30, 40) })),
    into(F(120, { dx: 12, lift: 2, tail: 4, ears: 2, head: [1, 0], hand: "up", mouth: "grin" }, { cue: "zip" }), trail(DX + 62, [40, 60, 80], 16)),
    into(F(120, { dx: 26, lift: 2, tail: 4, ears: 2, head: [1, 0], hand: "up", mouth: "grin" }), trail(DX + 76, [36, 52, 68, 84], 18)),
    { ms: 160, layers: [], specks: trail(DX + 80, [44, 64, 84], 12) },
  ],
}));

/** His attack on a king (the kit's `kingAttack`: the God King's Last Stand and his mate): his own parts and palette in a bigger frame. */
export const DASH_ATTACK: Character = { ...BOSS_BLITZ, id: "dash-attack", w: AW, h: AH, foot: [BOSS_BLITZ.foot[0] + DX, BOSS_BLITZ.foot[1] + DY], palette: PALETTE, anims: { kingAttack } };
