/**
 * The raid bosses that have a character: its drawing, which animation plays for each moment, its sounds, its
 * lines and its portrait, keyed by the boss's name in packages/core/src/boss.ts. A boss without one keeps its emoji
 * everywhere. A kit whose name isn't a boss there yet is drawn and ready but never shows, except in a test link
 * (`?wip=1&kit=<name>`: its kit in every boss's place): a boss becomes playable once it has both a character and its
 * powers (the power rules add it to boss.ts).
 */
import type { SoundName } from "../sound.ts";
import type { Beat, BeatLines } from "./boss-beats.ts";
import { BIGBOY, BIGBOY_CHANCE, BIGBOY_LINES, BIGBOY_PORTRAIT } from "./bigboy.ts";
import { CLOWN, CLOWN_CHANCE, CLOWN_LINES, CLOWN_PORTRAIT } from "./clown.ts";
import { GINGER_CHANCE, GINGER_LINES, GINGER_PORTRAIT, GINGERBREAD } from "./gingerbread.ts";
import { GREX, GREX_CHANCE, GREX_LINES, GREX_PORTRAIT } from "./grex.ts";
import { HOLLOW, HOLLOW_CHANCE, HOLLOW_LINES, HOLLOW_PORTRAIT, bulbsLook } from "./hollow.ts";
import { SAWYER, SAWYER_PORTRAIT } from "./sawyer.ts";
import type { BossView } from "../game.ts";
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
  /** Wider than the boss bar's usual box (Sawyer's saw and tail): on a phone his box is wider, so neither the screen's
   * edge nor the boss's name cuts into him. */
  wide?: boolean;
  /** A recolour (one of the character's `looks`) from the battle's state: Hollow's bulbs still lit. */
  lookOf?: (boss: BossView) => string | undefined;
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
  "Hollow": {
    ch: HOLLOW,
    anims: { strike: "capture", power: "darkCast", darkFirst: "darkCast", ultimateWarn: "check", ultimate: "lightsOut", claim: "claimDark", found: "testFound", missed: "testMiss", lightsBack: "lightsBack" },
    sounds: {
      hum: "hollowHum",
      cast: "hollowCast",
      pop: "hollowPop",
      clink: "hollowClink",
      light: "hollowRelight",
      land: "hollowWhisper",
      smash1: "hollowSmash",
      smash2: "hollowSmash",
      smash3: "hollowSmash",
      tick: "hollowTick",
      relight: "hollowRelight",
    },
    lines: HOLLOW_LINES,
    chance: HOLLOW_CHANCE,
    portrait: { ...HOLLOW_PORTRAIT, anim: "idle", frame: 0 },
    // His strand shows the bulbs still lit before his next cover of the dark (the power rules' `bulbs`, 0-3).
    lookOf: (boss) => {
      const n = (boss.powers as { bulbs?: number } | undefined)?.bulbs;
      return n === undefined ? undefined : bulbsLook(n);
    },
  },
  "Big Boy": {
    ch: BIGBOY,
    anims: {
      entrance: "swing",
      thinking: "idle",
      move: "lick",
      capture: "swing",
      hurt: "wail",
      check: "giggle",
      smug: "idle",
      rattled: "idle",
      defeat: "wail",
      victory: "giggle",
      strike: "swing",
      power: "toss",
      ultimateWarn: "wail",
      ultimate: "bigBounce",
      snack: "snack",
    },
    sounds: {
      swing: "bigboySwish",
      bonk: "bigboyBonk",
      stomp: "bigboyStomp",
      wail: "bigboyWail",
      giggle: "bigboyGiggle",
      slurp: "bigboySlurp",
      nom: "bigboyNom",
      toss: "bigboyToss",
      boing: "bigboyBoing",
      whoosh: "bigboyToss",
      crash: "bigboyCrash",
    },
    lines: BIGBOY_LINES,
    chance: BIGBOY_CHANCE,
    portrait: { ...BIGBOY_PORTRAIT, anim: "idle", frame: 0 },
    // His snack is the crowd's pawn: white, or black when the crowd plays Black.
    lookOf: (boss) => (boss.crowdSide === "b" ? "blackPawn" : undefined),
  },
  // A sprite preview only (?wip=1&kit=Sawyer): no boss, powers, lines or sounds of his own yet. He has three animations,
  // so every moment plays one of them, and his cues borrow quiet sounds as placeholders.
  "Sawyer": {
    ch: SAWYER,
    anims: {
      entrance: "rev",
      thinking: "idle",
      move: "rev",
      capture: "sawDown",
      hurt: "idle",
      check: "rev",
      smug: "idle",
      rattled: "idle",
      defeat: "idle",
      victory: "rev",
      strike: "sawDown",
    },
    sounds: { rev: "grexFizz", swing: "clownSlideDown", cut: "gingerCrunch" },
    lines: {},
    chance: {},
    portrait: { ...SAWYER_PORTRAIT, anim: "idle", frame: 0 },
    wide: true,
  },
};

/** Test links only (?wip=1&kit=<name>): a kit drawn before its boss is playable, shown in every boss's place. */
const WIP_KIT = (() => {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? "");
    return q.get("wip") === "1" ? q.get("kit") : null;
  } catch {
    return null;
  }
})();
/** The kit a test link shows in every boss's place, if any (by its name, spaces optional: `kit=BigBoy`). */
export const wipKit = (): BossKit | null =>
  WIP_KIT ? (BOSS_KITS[WIP_KIT] ?? Object.entries(BOSS_KITS).find(([k]) => k.replace(/\s/g, "") === WIP_KIT.replace(/\s/g, ""))?.[1] ?? null) : null;
/**
 * For a test link's preview of a moment (components/WipPreview.tsx): a look to show instead of the kit's own (his bulbs
 * counting down before the power rules exist).
 */
export const wipLook: { now: (() => string | undefined) | null } = { now: null };

export const bossKit = (name: string | undefined | null): BossKit | null => (name ? ((WIP_KIT && !name.startsWith("original:") ? wipKit() : null) ?? BOSS_KITS[name] ?? null) : null);
