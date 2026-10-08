/**
 * The raid bosses that have a character: its drawing, which animation plays for each moment, its sounds, its
 * lines and its portrait. A boss without one keeps its emoji everywhere.
 */
import type { SoundName } from "../sound.ts";
import type { Beat, BeatLines } from "./boss-beats.ts";
import { CLOWN, CLOWN_CHANCE, CLOWN_LINES, CLOWN_PORTRAIT } from "./clown.ts";
import type { Character } from "./sprite.ts";

export interface BossKit extends BeatLines {
  ch: Character;
  /** The animation for a moment, when it isn't the moment's own name. */
  anims: Partial<Record<Beat, string>>;
  /** Frame cues to sounds. */
  sounds: Record<string, SoundName>;
  /** The part of a frame a portrait shows, and from which animation and frame. */
  portrait: { x: number; y: number; w: number; h: number; anim: string; frame: number };
}

export const BOSS_KITS: Record<string, BossKit> = {
  "Boingo the Clown": {
    ch: CLOWN,
    anims: { strike: "capture" },
    sounds: { boing: "clownBoing", honk: "clownHonk", squeak: "clownSqueak", slideUp: "clownSlideUp", slideDown: "clownSlideDown", laugh: "clownLaugh" },
    lines: CLOWN_LINES,
    chance: CLOWN_CHANCE,
    portrait: { ...CLOWN_PORTRAIT, anim: "idle", frame: 4 },
  },
};

export const bossKit = (name: string | undefined | null): BossKit | null => (name ? (BOSS_KITS[name] ?? null) : null);
