/**
 * The art for the bosses' powers: what each boss's character plays when a power fires, and the effect sprites for
 * the board. The power rules (which decide when a power fires and what it does) import these; nothing here decides
 * anything.
 *
 * POWER_MOMENTS, per boss (keyed by its name, as BOSS_KITS is):
 *
 *   "Boingo the Clown"
 *     power        "pieThrow"   He pulls a pie up behind his head and throws it. At `release` the pie leaves his
 *                               glove: fly `pieFly` from him to the square, then play `pieSplat`.
 *     ultimateWarn "check"      His honk-honk, for the one-turn warning.
 *     ultimate     "funhouse"   Played ON THE BOARD (hide him in his usual spot meanwhile): his shadow grows, he
 *                               drops in from above, lands, springs into a spin and lands laughing. At `release`
 *                               (the spin) the board flips. The last frame holds until you take him off.
 *   "Ginger"
 *     power        "freezeCast" He raises the cane (it glows ice-blue, his eyes go icy) and thrusts it; at
 *                               `release` the ice bolt leaves its tip: fly `iceBolt` to the square, then play
 *                               `iceOverlay` freeze, frozen (loop) while it lasts, thaw.
 *     ultimateWarn "check"      His frosty cane thrusts, for the warning.
 *     ultimate     "blizzard"   Cane raised high, a whirl of snow round him that bursts outwards at `release`:
 *                               play `blizzardSweep` across the board from then, and ice every piece (iceOverlay)
 *                               as the sweep passes; the queen stays clear.
 *   "G-REX"
 *     power        "ignite"     He winds up the outer sparkler and throws it at the board; at `throw` it leaves his
 *                               hand: fly `sparkFly` to the square, then play `fireTile` ignite (it lands as stage
 *                               1), stage1 (loop). Each turn after, step it up: spread2 then stage2 (loop), spread3
 *                               then stage3 (loop). When it's done: if a piece is on it, `pieceBurn` over the piece
 *                               (its kind, "p" to "q"; take the piece off at `poof`) and the tile's burnOut; if the
 *                               king is on it, the tile's fizzle (he's fireproof); if it's empty, burnOut.
 *     powerHit     "capture"    His laugh, as a piece burns up (lines: `kit.lines.powerHit`).
 *     ultimateWarn "candleWarn" He pulls out the Roman candle, shows it off and taps it; its fuse fizzes.
 *     ultimate     "romanCandle" Played ON THE BOARD, at its middle (hide him in his usual spot meanwhile): his
 *                               shadow grows, he drops in with a roar, raises the candle and fires twelve shots up,
 *                               one every 140 ms, the first at `launch`, each at a `shot` cue (fly a `candleShot`
 *                               up off the board from the candle's top on each, if you like; it pops at `pop`). The
 *                               last frame holds until you take him off. While the shots are up, show
 *                               `candleShots` by the board: `left<n>` for the n still up (12 to 0).
 *     ultimateHit  "capture"    His laugh, as fireballs come down (lines: `kit.lines.ultimateHit`): for each, fly
 *                               `fireballFall` fall from above the board onto its square, play its `land` there,
 *                               then the square is a stage-1 `fireTile` (land ends on stage1's first frame), which
 *                               burns up as the passive's does.
 *
 *   Each moment's animation is in the kit (`BOSS_KITS[name].anims[power | ultimateWarn | ultimate]`), its lines
 *   are `kit.lines.power / ultimateWarn / ultimate` (pick with `pickLine(kit, "power", key)` from boss-beats.ts,
 *   keyed by the moment so every player gets the same line), and its sounds fire from its frames' cues.
 *
 * EFFECTS, each a sprite whose frame is exactly the area it covers (one square, or the whole board), with its
 * animations in the order they play:
 *
 *   iceOverlay     square  freeze, frozen (loop), thaw (ends empty). See-through: the piece shows under it.
 *   iceBolt        square  fly (loop). Points right: rotate it towards its target as it flies.
 *   blizzardSweep  board   sweep (one-shot, about 1.3 s, ends empty). Cloud and snow cross left to right.
 *   pieSplat       square  splat, pied (loop), fade (ends empty). On an empty square.
 *   pieFly         square  fly (loop). A pie tumbling; move it from the boss to the square.
 *   fireTile       square  ignite, stage1 (loop), spread2, stage2 (loop), spread3, stage3 (loop), burnOut (ends
 *                          empty); or fizzle (ends empty) when the king stands on it at the end. The stages read
 *                          on their own (a singe at the borders; more burn, flames up the sides; ablaze), with no
 *                          number: a piece stays visible on it at every stage.
 *   pieceBurn      square  p, n, b, r, q: the piece of that kind burning up (flames engulf it, `poof`: take the
 *                          real piece off, its charred shape crumbles to ash and embers, ends empty); burn: the same
 *                          without a shape.
 *   sparkFly       square  fly (loop). G-REX's sparkler tumbling end over end; move it, no need to turn it.
 *   candleShot     square  fly (loop), pop (ends empty). A Roman candle rocket pointing up; move it up.
 *   fireballFall   square  fall (loop), land (ends on fireTile's stage1 look). Move the falling one down onto
 *                          the square, land it there, then carry on with fireTile stage1.
 *   candleShots    strip   left12 ... left0 (loops), 74 x 11: the shots still up (lit rockets, then spent).
 *                          Size its box to keep its shape (any width; height = width x 11 / 74).
 *
 * Play them with <BossEffect> (components/BossEffect.tsx), which plays their sounds from the frames' cues, once,
 * through the mute switch; or render frames yourself with `renderFrame`.
 */
import type { SoundName } from "../sound.ts";
import { EFFECT_SPRITES } from "./effects.ts";
import type { Anim, Character } from "./sprite.ts";

/** The power moments' animation names, every boss's. */
export const POWER_ANIMS = ["pieThrow", "funhouse", "freezeCast", "blizzard", "ignite", "candleWarn", "romanCandle"] as const;
export type PowerAnim = (typeof POWER_ANIMS)[number];

export interface PowerMoment {
  /** The boss's animation (in its kit's character). */
  anim: PowerAnim | "check" | "capture";
  /** The frame cue that marks the moment's hit (the pie or bolt leaving, the board flipping, the storm bursting). */
  hit?: string;
  /** Played on the board, not in his usual spot. */
  onBoard?: boolean;
  /** The effects that follow, in order. */
  effects?: readonly EffectName[];
}

/**
 * A boss's power moments. `powerHit` and `ultimateHit` are for powers whose payoff lands later than the moment they
 * fire (G-REX's tile burning a piece; his fireballs coming down).
 */
export interface BossPowerMoments {
  power: PowerMoment;
  powerHit?: PowerMoment;
  ultimateWarn: PowerMoment;
  ultimate: PowerMoment;
  ultimateHit?: PowerMoment;
}

export const POWER_MOMENTS: Record<string, BossPowerMoments> = {
  "Boingo the Clown": {
    power: { anim: "pieThrow", hit: "throw", effects: ["pieFly", "pieSplat"] },
    ultimateWarn: { anim: "check" },
    ultimate: { anim: "funhouse", hit: "flip", onBoard: true },
  },
  "Ginger": {
    power: { anim: "freezeCast", hit: "freeze", effects: ["iceBolt", "iceOverlay"] },
    ultimateWarn: { anim: "check" },
    ultimate: { anim: "blizzard", hit: "blizzard", effects: ["blizzardSweep", "iceOverlay"] },
  },
  "G-REX": {
    power: { anim: "ignite", hit: "throw", effects: ["sparkFly", "fireTile"] },
    powerHit: { anim: "capture", effects: ["pieceBurn", "fireTile"] },
    ultimateWarn: { anim: "candleWarn", hit: "fizz" },
    ultimate: { anim: "romanCandle", hit: "launch", onBoard: true, effects: ["candleShot", "candleShots"] },
    ultimateHit: { anim: "capture", effects: ["fireballFall", "fireTile"] },
  },
};

export type EffectName = keyof typeof EFFECT_SPRITES;
export const EFFECT_NAMES = Object.keys(EFFECT_SPRITES) as EffectName[];

export interface Effect {
  ch: Character;
  /** What its frame covers: one board square, the whole board, or a strip of its own size (keep its shape). */
  covers: "square" | "board" | "strip";
  /** Its animations: the one that starts it, the loop while it lasts, the one that ends it (ends on an empty frame). */
  start?: string;
  loop?: string;
  end?: string;
  /** An effect that escalates (the fire tile): each stage's loop, in order, and the one-shot that steps up into it. */
  stages?: readonly { loop: string; into?: string }[];
  /** Other endings, by what happened (the fire tile's `fizzle`, when the fireproof king stands on it). Each ends empty. */
  endings?: Readonly<Record<string, string>>;
  /** One animation per kind of piece (a piece burning up): its charred shape. */
  pieces?: Readonly<Record<"p" | "n" | "b" | "r" | "q", string>>;
  /** A count shown as one loop per number (the shots still up): `${prefix}${n}`, n from 0 to max. */
  counter?: { prefix: string; max: number };
  /** After its end, another effect carries on in the same place (a fireball's landing becomes a fire tile); its end's last frame is that one's first. */
  next?: { effect: EffectName; anim: string };
  /** Frame cues to sounds. */
  sounds: Record<string, SoundName>;
}

export const EFFECTS: Record<EffectName, Effect> = {
  iceOverlay: { ch: EFFECT_SPRITES.iceOverlay, covers: "square", start: "freeze", loop: "frozen", end: "thaw", sounds: { crackle: "gingerCrackle" } },
  iceBolt: { ch: EFFECT_SPRITES.iceBolt, covers: "square", loop: "fly", sounds: {} },
  blizzardSweep: { ch: EFFECT_SPRITES.blizzardSweep, covers: "board", start: "sweep", sounds: { wind: "gingerWind" } },
  pieSplat: { ch: EFFECT_SPRITES.pieSplat, covers: "square", start: "splat", loop: "pied", end: "fade", sounds: { splat: "clownSplat" } },
  pieFly: { ch: EFFECT_SPRITES.pieFly, covers: "square", loop: "fly", sounds: {} },
  fireTile: {
    ch: EFFECT_SPRITES.fireTile,
    covers: "square",
    start: "ignite",
    loop: "stage1",
    end: "burnOut",
    stages: [{ loop: "stage1" }, { into: "spread2", loop: "stage2" }, { into: "spread3", loop: "stage3" }],
    endings: { fizzle: "fizzle" },
    sounds: { crackle: "grexCrackle", fizzle: "grexFizz" },
  },
  pieceBurn: { ch: EFFECT_SPRITES.pieceBurn, covers: "square", start: "burn", pieces: { p: "p", n: "n", b: "b", r: "r", q: "q" }, sounds: { poof: "grexPoof" } },
  sparkFly: { ch: EFFECT_SPRITES.sparkFly, covers: "square", loop: "fly", sounds: {} },
  candleShot: { ch: EFFECT_SPRITES.candleShot, covers: "square", loop: "fly", end: "pop", sounds: {} },
  fireballFall: { ch: EFFECT_SPRITES.fireballFall, covers: "square", loop: "fall", end: "land", next: { effect: "fireTile", anim: "stage1" }, sounds: { land: "grexPoof" } },
  candleShots: { ch: EFFECT_SPRITES.candleShots, covers: "strip", loop: "left12", counter: { prefix: "left", max: 12 }, sounds: {} },
};

/** An animation's length in ms. */
export const animLength = (a: Anim) => a.frames.reduce((s, f) => s + f.ms, 0);

/** When a cue fires in an animation, in ms from its start (the start of its first frame with that cue), or null. */
export function cueAt(a: Anim, cue: string): number | null {
  let t = 0;
  for (const f of a.frames) {
    if (f.cue === cue) return t;
    t += f.ms;
  }
  return null;
}
