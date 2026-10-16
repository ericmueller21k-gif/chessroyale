/**
 * The raid bosses that have a character: its drawing, which animation plays for each moment, its sounds, its
 * lines and its portrait, keyed by the boss's name in packages/core/src/boss.ts. A boss without one keeps its emoji
 * everywhere. A kit whose name isn't a boss there yet is drawn and ready but never shows, except in a test link
 * (`?wip=1&kit=<name>`: its kit in every boss's place): a boss becomes playable once it has both a character and its
 * powers (the power rules add it to boss.ts).
 */
import { BOSS_ROSTER, type BossDef } from "@chessroyale/core";
import type { SoundName } from "../sound.ts";
import type { Beat, BeatLines, Loop } from "./boss-beats.ts";
import { BIGBOY, BIGBOY_CHANCE, BIGBOY_LINES, BIGBOY_PORTRAIT } from "./bigboy.ts";
import { CLOWN, CLOWN_CHANCE, CLOWN_LINES, CLOWN_PORTRAIT } from "./clown.ts";
import { GINGER_CHANCE, GINGER_LINES, GINGER_PORTRAIT, GINGERBREAD } from "./gingerbread.ts";
import { GREX, GREX_CHANCE, GREX_LINES, GREX_PORTRAIT } from "./grex.ts";
import { HOLLOW, HOLLOW_ATTACK, HOLLOW_CHANCE, HOLLOW_LINES, HOLLOW_PORTRAIT } from "./hollow.ts";
import { SAWYER, SAWYER_CHANCE, SAWYER_LINES, SAWYER_PORTRAIT } from "./sawyer.ts";
import { PIG, PIG_CHANCE, PIG_LINES, PIG_PORTRAIT } from "./pig.ts";
import { RECLUSE, RECLUSE_BUST, RECLUSE_PORTRAIT } from "./recluse.ts";
import { RECLUSE_LINES } from "./recluse-lines.ts";
import type { BossView } from "../game.ts";
import type { Character } from "./sprite.ts";
import { lashItem, type SquareItem } from "./power-art.ts";
import { testSwitchesAllowed } from "../test-switches.ts";

/**
 * A boss's attack on a king (Eric, Oct 10: Hollow first): played on the board beside the God King in his Last Stand
 * (the blow meant for the piece) and beside the crowd's king when the boss mates it, before the result. Its beats are
 * shared (KING_ATTACK in boss-timing.ts: the drop, the hits, the leap off), so its animation lands each hit on them;
 * the screen adds a "−N" off the king for each hit and plays `hit` on the king's square. A boss with one is listed in
 * KING_ATTACKERS (boss-timing.ts) too, so the server waits for it at a mate.
 */
export interface KingAttackKit {
  /** The character it's drawn from (the boss's own parts; its frame may be wider than its usual one). */
  ch: Character;
  /** Its animation, the king to our right; mirrored when the king is to its left. */
  anim: string;
  /** Its size on the board: frame pixels to a square. */
  perSquare: number;
  /** Where its feet go: this many squares to the king's side of the king's square's middle. */
  stand: number;
  /** Each hit on the king's square (the shared board canvas): the i-th, coming in from its left or right edge. */
  hit: (square: string, i: number, from: "L" | "R", since: number) => SquareItem;
}

export interface BossKit extends BeatLines {
  ch: Character;
  /**
   * The drawing in a phone's boss bar, when it isn't `ch` (the Hidden Boss: his full figure is too tall for the bar, so the
   * bar has his bust, cut from the same rig with the same animations; a computer and the results have `ch`).
   */
  bar?: Character;
  /** The animation for a moment, when it isn't the moment's own name. */
  anims: Partial<Record<Beat, string>>;
  /** The animation for a loop it rests in, when it isn't the loop's own name (the Hidden Boss beaten: `collapseLoop`). */
  loops?: Partial<Record<Loop, string>>;
  /**
   * Beaten: lines it says one after another once its defeat's animation is over, each as the last one goes (the Hidden
   * Boss's mumbling as he slumps), on the board and on into the result screen.
   */
  fall?: readonly string[];
  /**
   * A line of its own for a moment, from the battle, instead of one of its kit's lines (the Hidden Boss's entrance when
   * he's White and the game opened 1.e4: his real quote that reads right only then). Undefined: the kit's lines.
   */
  lineOf?: (beat: Beat, boss: BossView) => string | undefined;
  /** Frame cues to sounds. */
  sounds: Record<string, SoundName>;
  /** The part of a frame a portrait shows, and from which animation and frame. */
  portrait: { x: number; y: number; w: number; h: number; anim: string; frame: number };
  /** Taller than the boss bar's usual box (Jefferson's long neck): on a phone the bar grows to hold him. */
  tall?: boolean;
  /** Wider than the boss bar's usual box (Sawyer's saw and tail): on a phone his box is wider, so neither the screen's
   * edge nor the boss's name cuts into him. */
  wide?: boolean;
  /** A recolor (one of the character's `looks`) from the battle's state: Big Boy's black pawn. */
  lookOf?: (boss: BossView) => string | undefined;
  /** Its attack on a king (the God King's Last Stand, its mate), if it has one: see KingAttackKit. */
  kingAttack?: KingAttackKit;
  /**
   * A half-engine look that comes on over its drawing (the Hidden Boss, from his phase change: components/Recluse.tsx's
   * EngineOverlay, placed on his head frame by frame; BossCharacter's `setEngineAt`). An overlay, never its frames.
   */
  engine?: boolean;
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
  "Jefferson": {
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
      lash: "hollowLash",
    },
    lines: HOLLOW_LINES,
    chance: HOLLOW_CHANCE,
    portrait: { ...HOLLOW_PORTRAIT, anim: "idle", frame: 0 },
    // (No `lookOf`: his strand is lit in full in every pose, Eric, Oct 16. The countdown to his next cover is the strip
    // of three bulbs by the boss bar alone: docs/decisions/2026-10-16-hollow-full-strand.md.)
    // He drops in beside the king and whips his strand at it (hollow.ts: kingAttack), a lash of color on its square each hit.
    kingAttack: { ch: HOLLOW_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, hit: lashItem },
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
      power: "sawDown",
      ultimateWarn: "rev",
      ultimate: "boardSaw",
      split: "sawDown",
    },
    sounds: {
      rev: "sawyerRev",
      swing: "sawyerSwing",
      cut: "sawyerCut",
      hop: "sawyerHop",
      bigsaw: "sawyerBigSaw",
    },
    lines: SAWYER_LINES,
    chance: SAWYER_CHANCE,
    portrait: { ...SAWYER_PORTRAIT, anim: "idle", frame: 0 },
    wide: true,
  },
  "Wrangler": {
    ch: PIG,
    anims: {
      entrance: "taunt",
      thinking: "idle",
      move: "idle",
      capture: "lasso",
      hurt: "idle",
      check: "taunt",
      smug: "taunt",
      rattled: "idle",
      defeat: "idle",
      victory: "taunt",
      strike: "lasso",
      power: "lasso",
      ultimateWarn: "taunt",
      ultimate: "windup",
      pull: "lasso",
      tug: "lasso",
      ready: "ready",
    },
    sounds: {
      whirl: "pigWhirl",
      throw: "pigThrow",
      catch: "pigCatch",
      tug: "pigTug",
      tip: "pigTip",
      laugh: "pigLaugh",
      snort: "pigSnort",
      stomp: "pigStomp",
      windup: "pigWindup",
      hop: "pigHop",
      // (Played by his showdown on the board: the quick-draw sting and each pair yanked in.)
      draw: "pigDraw",
      yank: "pigYank",
    },
    lines: PIG_LINES,
    chance: PIG_CHANCE,
    portrait: { ...PIG_PORTRAIT, anim: "idle", frame: 0 },
    // His throw's room out to one side (the frame is 115 wide): a wider box on a phone, as Sawyer's.
    wide: true,
  },
  // The Hidden Boss (admins only, in Boss alone; DECISIONS.md, "The Hidden Boss, phase 1"). His lines are placeholders for
  // Eric's own, in one table (recluse-lines.ts).
  "Hidden Boss": {
    ch: RECLUSE,
    // (A phone's boss bar: his bust, head and shoulders, the same animations.)
    bar: RECLUSE_BUST,
    anims: {
      // The stare is his entrance; behind on material he consults the red book; beaten he collapses (then slumps,
      // mumbling: `loops.defeat`); winning, the unhinged laugh. His ultimate's spellbook and the slam as he mocks the God
      // King's help play where he stands (components/Recluse.tsx, playInPlace).
      entrance: "stare",
      thinking: "idle",
      move: "idle",
      capture: "idle",
      hurt: "idle",
      check: "idle",
      smug: "idle",
      rattled: "consult",
      defeat: "collapse",
      victory: "laugh",
      strike: "idle",
      power: "idle",
      ultimateWarn: "idle",
      ultimate: "spellbook",
    },
    loops: { defeat: "collapseLoop" },
    // (Every cue has a sound; his laugh is breath, no voice.)
    sounds: {
      dip: "recluseRustle",
      stare: "recluseHum",
      lift: "recluseRustle",
      open: "recluseFlip",
      snap: "recluseShut",
      laugh: "recluseHuff",
      cackle: "recluseHuff",
      raise: "recluseRustle",
      slam: "recluseShut",
      reel: "recluseRustle",
      drop: "recluseRustle",
      thud: "recluseShut",
      book: "recluseShut",
      rise: "recluseRustle",
      catch: "recluseShut",
      // (The phase change: his hand raised to the God King, his fist closing on his power as the engine in him ignites,
      // up in a rage, the leap onto the board, the book thrown down, the chant's light.)
      reach: "recluseRustle",
      grab: "recluseSpark",
      snatch: "recluseRustle",
      jump: "recluseRustle",
      land: "recluseThump",
      throw: "recluseRustle",
      light: "recluseGlow",
    },
    lines: { entrance: RECLUSE_LINES.intro, rattled: RECLUSE_LINES.rattled, victory: RECLUSE_LINES.victory, ultimate: RECLUSE_LINES.bullet },
    chance: { entrance: 1, rattled: 0.3, victory: 1 },
    fall: RECLUSE_LINES.fall,
    // (His real "Best by test.", word for word: only when he's White and the battle's game opened 1.e4.)
    lineOf: (beat, boss) => (beat === "entrance" && boss.crowdSide === "b" && boss.board.history[0] === "e2e4" ? RECLUSE_LINES.introE4 : undefined),
    portrait: { ...RECLUSE_PORTRAIT, anim: "idle", frame: 0 },
    // (The bust is 50 px wide: the wider box on a phone, as Sawyer's and Wrangler's.)
    wide: true,
    // (Phase 2: one eye glowing cold blue, faint circuit lines down that side of his face: the God King's power, absorbed.)
    engine: true,
  },
};

/**
 * Test links only (?wip=1&kit=<name>, a test switch: test-switches.ts): a kit drawn before its boss is playable, shown
 * in every boss's place. (The address is read once; whether you may use it, each time.)
 */
const WIP_KIT_ASKED = (() => {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? "");
    return q.get("wip") === "1" ? q.get("kit") : null;
  } catch {
    return null;
  }
})();
const wipKitName = () => (WIP_KIT_ASKED && testSwitchesAllowed() ? WIP_KIT_ASKED : null);
/** The kit a test link shows in every boss's place, if any (by its name, spaces optional: `kit=BigBoy`). */
export const wipKit = (): BossKit | null => {
  const name = wipKitName();
  return name ? (BOSS_KITS[name] ?? Object.entries(BOSS_KITS).find(([k]) => k.replace(/\s/g, "") === name.replace(/\s/g, ""))?.[1] ?? null) : null;
};
/**
 * A boss's kit by the name its screens have (the boss view's `name`): the kit of that name, or else the kit the roster
 * gives the boss of that name (BossDef.kit). So a boss renamed in the roster keeps its kit: renaming one (the Hidden Boss,
 * whose name Eric will change) is one edit, his `name` in BOSS_ROSTER.
 */
export const kitName = (name: string, roster: readonly BossDef[] = BOSS_ROSTER): string => (BOSS_KITS[name] ? name : (roster.find((b) => b.name === name)?.kit ?? name));
export const bossKit = (name: string | undefined | null): BossKit | null => (name ? ((WIP_KIT_ASKED && !name.startsWith("original:") ? wipKit() : null) ?? BOSS_KITS[kitName(name)] ?? null) : null);
