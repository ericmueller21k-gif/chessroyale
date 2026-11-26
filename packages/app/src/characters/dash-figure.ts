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
import { BOSS_POWERS, DASH_HANG_ON } from "@chessroyale/core";
import { BOSS_BLITZ, PALETTE, bigClick, layers, star, type Pose } from "./boss-blitz.ts";
import { moved } from "./attack-frame.ts";
import type { Anim, Character, Frame, Speck } from "./sprite.ts";
import { frameKeys, lazyAnim } from "./sprite.ts";

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

// ---------------- His "Hang on" (Eric, Nov 26; DASH_HANG_ON) ----------------
// Built from his rig's own poses and his stall skit's slam (the paw wound up high, hammered onto the button, the sparks, the flag
// jumping), nothing new drawn. Round 2 (Eric, Nov 26: "he wasn't pressing it"): the round-1 smacks were his move's slap, the paw
// going 10 of his 104 pixels between his chin and the button and held at his chin most of each smack, a few screen pixels in a
// phone's bar; now each smack comes from over his head and lands on the button, and cheetah speed has his head thrown back
// (Pose.back: his snout pointed up) with a second paw's blur, the fastest smacks he has (hitMs, under every other smack's).

/** Cheetah speed's face: eyes shut, mouth wide open (his head thrown back by headBack). */
const HEAD_BACK: Pose = { eyes2: "joy", mouth: "wide", brow: 2, lift: 1 };
/** The parts that make his head (its face, ears and cap): headBack turns them together. */
const HEAD_PARTS = /^(earF|earN|head|mouth:|eyes:|brow|cap)/;
/**
 * A frame of his with the head thrown back (Eric, Nov 26: "he should have his head like up and then like lean back, so clearly his
 * like mouth is pointed up into the air"): his head drawn alone, turned `deg` back about his neck (`neck`, his pixels; nearest
 * pixel, no new drawing), moved `shift`, and laid over the rest of him as its own pixels. Made once a drawing (lazy anims).
 */
function headBack(ms: number, pose: Pose, extra: Partial<Frame> = {}, deg = HANG_TILT.deg): Frame {
  const all = layers(pose);
  const headOnly = frameKeys(DASH_FIGURE, { ms, layers: all.filter((l) => HEAD_PARTS.test(l.part)) });
  const [cx, cy] = HANG_TILT.neck;
  const [mx, my] = HANG_TILT.shift;
  const a = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const head: Speck[] = [];
  for (let y = 0; y < headOnly.length; y++)
    for (let x = 0; x < headOnly[0]!.length; x++) {
      // (Each pixel where it lands: the one it comes from, turned back the other way.)
      const [u, v] = [x - mx - cx, y - my - cy];
      const k = headOnly[Math.round(cy + -u * s + v * c)]?.[Math.round(cx + u * c + v * s)];
      if (k) head.push([x, y, k]);
    }
  return { ms, layers: all.filter((l) => !HEAD_PARTS.test(l.part)), ...extra, specks: [...head, ...(extra.specks ?? [])] };
}
/** How far back his head goes at cheetah speed (degrees), the point it turns about (his neck) and where it's moved to (back and up). */
const HANG_TILT = { deg: 50, neck: [37, 41] as [number, number], shift: [3, -1] as [number, number] };
/** A happy slam: on the button, the clock pressed, the flag jumping, sparks; `big` the slow smacks' bigger burst and shake. */
const smackDown = (ms: number, pose: Pose, big: boolean): Frame =>
  F(ms, { at: [25.5, 54], gesture: "open", press: true, sink: big ? 2 : 1, flag: 1, flagY: big ? 3 : 2, tail: -2, ...pose }, { cue: "click", shake: big ? [0, 2] : [0, 1], specks: bigClick(big ? 2 : 1, 0) });

/** Its slow smacks speeding up: from slowFrom ms a smack down to slowTo (each a little quicker), filling slowMs from his landing; each wound up over his head, then slammed. */
const hangSlow: Anim = lazyAnim(() => {
  const s = DASH_HANG_ON;
  const frames: Frame[] = [];
  const face: Pose = { eyes2: "sly", mouth: "grin", brow: 1 };
  let t = 0;
  const fill = s.slowMs - s.jumpMs;
  for (let ms: number = s.slowFrom; t + ms <= fill; ms = Math.max(s.slowTo, Math.round(ms * 0.85))) {
    // (Up high, the slam (at most 160 ms), and the rebound; a quick one is the wind-up and the slam.)
    const hit = Math.min(160, Math.round(ms * 0.45));
    const back = Math.min(120, ms - hit - 40);
    const up = ms - hit - Math.max(0, back);
    frames.push(F(up, { at: [57, 24], gesture: "open", lift: 2, head: [1, -1], tail: 3, ...face }), smackDown(hit, { mouth: "wide", brow: 1 }, true));
    if (back > 0) frames.push(F(back, { at: [30, 44], gesture: "open", lift: 1, tail: 1, ...face }));
    t += ms;
  }
  if (t < fill) frames.push(F(fill - t, { at: [57, 24], gesture: "open", lift: 2, head: [1, -1], tail: 3, ...face }));
  return { loop: false, frames };
});

/** Cheetah speed: a smack every hitMs, the paw high and down with a second paw's blur, his head thrown back, for fastMs (two drawings, drawn once each). */
const hangFast: Anim = lazyAnim(() => {
  const s = DASH_HANG_ON;
  // (The paw up in front of his chest, not his face: his face is the joke.)
  const UP: [number, number] = [38, 44];
  const rise = Math.floor(s.hitMs / 2);
  const upF = headBack(rise, { ...HEAD_BACK, at: UP, blur: [27, 50], gesture: "open", tail: 4 });
  const down = smackDown(s.hitMs - rise, { ...HEAD_BACK, blur: UP, tail: 2 }, false);
  const downF = headBack(down.ms, { ...HEAD_BACK, at: [25.5, 54], gesture: "open", press: true, sink: 1, flag: 1, flagY: 2, blur: UP, tail: 2 }, { cue: down.cue, shake: down.shake, specks: down.specks });
  const n = Math.floor(s.fastMs / s.hitMs);
  return { loop: false, frames: [...Array.from({ length: n }, () => [upF, downF]).flat(), ...(s.fastMs > n * s.hitMs ? [headBack(s.fastMs - n * s.hitMs, { ...HEAD_BACK, at: UP, gesture: "open" })] : [])] };
});

/** The wind-up: his paw on the clock's front, winding it round twice (its whirr), his eyes on it; windMs long. */
const hangWind: Anim = lazyAnim(() => {
  const s = DASH_HANG_ON;
  const spots: [number, number][] = [[24, 57], [22, 58], [23, 60], [25, 59]];
  const step = Math.floor(s.windMs / 8);
  const turn = spots.map((at, i) => F(step, { at, gesture: "fist", eyes2: "down", mouth: "grin", brow: 1, tail: 1 }, i === 0 ? { cue: "whirr" } : {}));
  return { loop: false, frames: [...turn, ...turn, F(s.windMs - 8 * step, { hand: "high", eyes2: "down", mouth: "grin" })] };
});

/** The wind-up done, a press of the clock (Eric: "he like presses it"), its click; then "Sorry about that, bro": an open paw raised to us, a sheepish grin; then his idle's first pose until his move. */
const hangSorry: Anim = lazyAnim(() => {
  const s = DASH_HANG_ON;
  const press = { ...A.move!.frames[4]!, ms: 140 };
  // (Then his zip back to his spot, returnMs: on his toes, ears back, tail out, its zip.)
  return { loop: false, frames: [press, F(s.sorryMs - press.ms, { at: [36, 40], gesture: "open", eyes2: "us", mouth: "grin", brow: 1, tail: 1 }), { ...DASH_RUN, ms: s.returnMs, cue: "zip" }] };
});

/** His jump onto the board's middle, jumpMs (the screen moves him: DashHangOn): a crouch, then up on his toes, airborne, its whoosh; the clock with him. */
const hangJump: Anim = lazyAnim(() => {
  const s = DASH_HANG_ON;
  const crouch = Math.round(s.jumpMs * 0.2);
  return { loop: false, frames: [F(crouch, { sink: 2, eyes2: "sly", mouth: "grin", brow: 1, tail: 1 }), F(s.jumpMs - crouch, { lift: 3, tail: 4, ears: 2, hand: "up", eyes: "wide", mouth: "grin" }, { cue: "whoosh" })] };
});

/** The section of the routine each of `hangOn`'s frames comes from (hangJump, hangSlow, …), for a test's count of his smacks. */
export const HANG_SECTION = new WeakMap<Frame, string>();
/**
 * His whole "Hang on" on the board's middle as one run (DashHangOn plays it from the gag's start): the jump, the slow smacks, cheetah
 * speed, the wind-up, the press and "sorry", the zip back. Its length is hangOnTimeline().total (dash-clock.test.ts).
 */
const hangOn: Anim = lazyAnim(() => {
  const frames: Frame[] = [];
  for (const [name, a] of [["hangJump", hangJump], ["hangSlow", hangSlow], ["hangFast", hangFast], ["hangWind", hangWind], ["hangSorry", hangSorry]] as const) {
    for (const f of a.frames) {
      const own = { ...f };
      HANG_SECTION.set(own, name);
      frames.push(own);
    }
  }
  return { loop: false, frames };
});

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
    fit3: lazyAnim(() => fit(3, BOSS_POWERS.dashClockFit.smackMs)),
    fit4: lazyAnim(() => fit(4, BOSS_POWERS.dashClockFit.smackMs)),
    fit5: lazyAnim(() => fit(BOSS_POWERS.dashClockFit.smacks, BOSS_POWERS.dashClockFit.smackMs)),
    fit10: lazyAnim(() => fit(BOSS_POWERS.dashPopOff.hits, BOSS_POWERS.dashPopOff.hitMs)),
    hangOn,
    hangJump,
    hangSlow,
    hangFast,
    hangWind,
    hangSorry,
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
