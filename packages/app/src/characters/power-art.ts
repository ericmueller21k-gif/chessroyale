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
 *
 * Play them with <BossEffect> (components/BossEffect.tsx), which plays their sounds from the frames' cues, once,
 * through the mute switch; or render frames yourself with `renderFrame`.
 */
import type { SoundName } from "../sound.ts";
import { EFFECT_SPRITES } from "./effects.ts";
import type { Anim, Character } from "./sprite.ts";

/** The power moments' animation names, every boss's. */
export const POWER_ANIMS = ["pieThrow", "funhouse", "freezeCast", "blizzard"] as const;
export type PowerAnim = (typeof POWER_ANIMS)[number];

export interface PowerMoment {
  /** The boss's animation (in its kit's character). */
  anim: PowerAnim | "check";
  /** The frame cue that marks the moment's hit (the pie or bolt leaving, the board flipping, the storm bursting). */
  hit?: string;
  /** Played on the board, not in his usual spot. */
  onBoard?: boolean;
  /** The effects that follow, in order. */
  effects?: readonly EffectName[];
}

export const POWER_MOMENTS: Record<string, { power: PowerMoment; ultimateWarn: PowerMoment; ultimate: PowerMoment }> = {
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
};

export type EffectName = keyof typeof EFFECT_SPRITES;
export const EFFECT_NAMES = Object.keys(EFFECT_SPRITES) as EffectName[];

export interface Effect {
  ch: Character;
  /** What its frame covers: one board square, or the whole board. */
  covers: "square" | "board";
  /** Its animations: the one that starts it, the loop while it lasts, the one that ends it (ends on an empty frame). */
  start?: string;
  loop?: string;
  end?: string;
  /** Frame cues to sounds. */
  sounds: Record<string, SoundName>;
}

export const EFFECTS: Record<EffectName, Effect> = {
  iceOverlay: { ch: EFFECT_SPRITES.iceOverlay, covers: "square", start: "freeze", loop: "frozen", end: "thaw", sounds: { crackle: "gingerCrackle" } },
  iceBolt: { ch: EFFECT_SPRITES.iceBolt, covers: "square", loop: "fly", sounds: {} },
  blizzardSweep: { ch: EFFECT_SPRITES.blizzardSweep, covers: "board", start: "sweep", sounds: { wind: "gingerWind" } },
  pieSplat: { ch: EFFECT_SPRITES.pieSplat, covers: "square", start: "splat", loop: "pied", end: "fade", sounds: { splat: "clownSplat" } },
  pieFly: { ch: EFFECT_SPRITES.pieFly, covers: "square", loop: "fly", sounds: {} },
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
