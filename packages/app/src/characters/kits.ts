/**
 * The raid bosses that have a character: its drawing, which animation plays for each moment, its sounds, its
 * lines and its portrait, keyed by the boss's name in packages/core/src/boss.ts. A boss without one keeps its emoji
 * everywhere. A kit whose name isn't a boss there yet (G-REX) is drawn and ready but never shows: a boss
 * becomes playable once it has both a character and its powers (the power rules add it to boss.ts).
 */
import type { SoundName } from "../sound.ts";
import type { Beat, BeatLines } from "./boss-beats.ts";
import { CLOWN, CLOWN_CHANCE, CLOWN_LINES, CLOWN_PORTRAIT } from "./clown.ts";
import { GINGER_CHANCE, GINGER_LINES, GINGER_PORTRAIT, GINGERBREAD } from "./gingerbread.ts";
import { GREX, GREX_CHANCE, GREX_LINES, GREX_PORTRAIT } from "./grex.ts";
import type { Character } from "./sprite.ts";

export interface BossKit extends BeatLines {
  ch: Character;
  /** The animation for a moment, when it isn't the moment's own name. */
  anims: Partial<Record<Beat, string>>;
  /** Frame cues to sounds. */
  sounds: Record<string, SoundName>;
  /** The part of a frame a portrait shows, and from which animation and frame. */
  portrait: { x: number; y: number; w: number; h: number; anim: string; frame: number };
  /** Taller than the boss bar's usual box (G-REX's long neck): on a phone the bar grows to hold him. */
  tall?: boolean;
}

export const BOSS_KITS: Record<string, BossKit> = {
  "Boingo the Clown": {
    ch: CLOWN,
    anims: { strike: "capture", power: "pieThrow", ultimateWarn: "check", ultimate: "funhouse" },
    sounds: {
      boing: "clownBoing",
      honk: "clownHonk",
      squeak: "clownSqueak",
      slideUp: "clownSlideUp",
      slideDown: "clownSlideDown",
      laugh: "clownLaugh",
      throw: "clownSlideUp",
      flip: "clownFlip",
    },
    lines: CLOWN_LINES,
    chance: CLOWN_CHANCE,
    portrait: { ...CLOWN_PORTRAIT, anim: "idle", frame: 4 },
  },
  "Ginger": {
    ch: GINGERBREAD,
    anims: { strike: "capture", power: "freezeCast", ultimateWarn: "check", ultimate: "blizzard" },
    sounds: { jingle: "gingerJingle", crunch: "gingerCrunch", crackle: "gingerCrackle", freeze: "gingerCrackle", blizzard: "gingerCrackle" },
    lines: GINGER_LINES,
    chance: GINGER_CHANCE,
    portrait: { ...GINGER_PORTRAIT, anim: "idle", frame: 0 },
  },
  "G-REX": {
    ch: GREX,
    anims: { strike: "capture", power: "ignite", powerHit: "capture", ultimateWarn: "candleWarn", ultimate: "romanCandle", ultimateHit: "capture" },
    sounds: {
      fizz: "grexFizz",
      whoosh: "grexWhoosh",
      throw: "grexWhoosh",
      crackle: "grexCrackle",
      poof: "grexPoof",
      roar: "grexRoar",
      slam: "grexSmack",
      launch: "grexWhistle",
      shot: "grexWhistle",
    },
    lines: GREX_LINES,
    chance: GREX_CHANCE,
    portrait: { ...GREX_PORTRAIT, anim: "idle", frame: 0 },
    tall: true,
  },
};

export const bossKit = (name: string | undefined | null): BossKit | null => (name ? (BOSS_KITS[name] ?? null) : null);
