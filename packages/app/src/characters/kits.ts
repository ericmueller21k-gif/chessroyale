/**
 * The raid bosses that have a character: its drawing, which animation plays for each moment, its sounds, its
 * lines and its portrait, keyed by the boss's name in packages/core/src/boss.ts. A boss without one keeps its emoji
 * everywhere. A kit whose name isn't a boss there yet is drawn and ready but never shows, except in a test link
 * (`?wip=1&kit=<name>`: its kit in every boss's place): a boss becomes playable once it has both a character and its
 * powers (the power rules add it to boss.ts).
 */
import { BOSS_ROSTER, type BossDef } from "@chessroyale/core";
import type { SoundName } from "../sound.ts";
import type { Beat, BeatLines, Loop, Stage } from "./boss-beats.ts";
import { BIGBOY_ATTACK, BIGBOY_CHANCE, BIGBOY_LINES, BIGBOY_PORTRAIT, BIGBOY_SPRITE } from "./bigboy.ts";
import { CLOWN, CLOWN_ATTACK, CLOWN_CHANCE, CLOWN_LINES, CLOWN_PORTRAIT } from "./clown.ts";
import { GINGER_ATTACK, GINGER_CHANCE, GINGER_LINES, GINGER_PORTRAIT, GINGERBREAD } from "./gingerbread.ts";
import { GREX, GREX_ATTACK, GREX_CHANCE, GREX_LINES, GREX_PORTRAIT } from "./grex.ts";
import { HOLLOW, HOLLOW_ATTACK, HOLLOW_CHANCE, HOLLOW_LINES, HOLLOW_PORTRAIT } from "./hollow.ts";
import { SAWYER, SAWYER_ATTACK, SAWYER_CHANCE, SAWYER_LINES, SAWYER_PORTRAIT } from "./sawyer.ts";
import { PIG, PIG_ATTACK, PIG_CHANCE, PIG_LINES, PIG_PORTRAIT } from "./pig.ts";
import { RECLUSE, RECLUSE_BUST, RECLUSE_BUST_PORTRAIT, RECLUSE_HEADS, RECLUSE_PORTRAIT } from "./recluse.ts";
import { ALFIL, ALFIL_ATTACK, ALFIL_CHANCE, ALFIL_LINES, ALFIL_PORTRAIT } from "./alfil.ts";
import { HOPPER, HOPPER_ATTACK, HOPPER_CHANCE, HOPPER_LINES, HOPPER_PORTRAIT } from "./hopper.ts";
import { SMUDGY_ATTACK, SMUDGY_CHANCE, SMUDGY_LINES, SMUDGY_PORTRAIT, SMUDGY_SPRITE } from "./smudgy.ts";
import { BOARD_FACING, facingAs, type Sprite } from "./sprite-kit.ts";
import { MOO, MOO_ATTACK, MOO_CHANCE, MOO_LINES, MOO_PORTRAIT } from "./moo.ts";
import { GARDENER, GARDENER_ATTACK, GARDENER_PORTRAIT } from "./gardener.ts";
import { GARDENER_BAR } from "./gardener-bar.ts";
import { GARDENER_CHANCE, GARDENER_LINES } from "./gardener-lines.ts";
import { TIGER_ATTACK, TIGER_PORTRAIT } from "./tiger.ts";
import { TIGER_FIGURE } from "./tiger-figure.ts";
import { TIGER_CHANCE, TIGER_LINES } from "./tiger-lines.ts";
import { FOLIO } from "./folio.ts";
import { ATTACK_PER_SQUARE, ATTACK_STAND, FOLIO_ATTACK, FOLIO_PORTRAIT } from "./folio-attack.ts";
import { FOLIO_LINES } from "./folio-lines.ts";
import { TIMBER_FIGURE as TIMBER } from "./timber-figure.ts";
import { BOSS_BEAVER_ATTACK as TIMBER_ATTACK } from "./timber.ts";
import { TIMBER_CHANCE, TIMBER_LINES } from "./timber-lines.ts";
import { BOSS_ZEBRA as ZEBRA, BOSS_ZEBRA_PORTRAIT } from "./zebra.ts";
import { ZEBRA_ATTACK } from "./zebra-figure.ts";
import { ZEBRA_CHANCE, ZEBRA_LINES } from "./zebra-lines.ts";
import { DASH_ATTACK, DASH_FIGURE as DASH } from "./dash-figure.ts";
import { DASH_CHANCE, DASH_LINES } from "./dash-lines.ts";
import { lineSounds } from "../speech.tsx";
import type { Stance } from "./stance.ts";
import { mooPowered } from "./moo-state.ts";
import { RECLUSE_CHILD_LINES, RECLUSE_LINES } from "./recluse-lines.ts";
import { GROWING_HEADS, RECLUSE_GROWING, RECLUSE_GROWING_BUST } from "./recluse-ages.ts";
import { growUpExchange } from "../components/RecluseChild.ts";
import type { BossView } from "../game.ts";
import { mapFrames, type Character } from "./sprite.ts";
import { ankusItem, balloonItem, bonkItem, chipItem, clawItem, darkItem, flourItem, inkItem, carrotItem, frostItem, lashItem, lassoItem, moonItem, paintItem, pieItem, popItem, sawItem, waterItem, type SquareItem } from "./power-art.ts";
import { testSwitchesAllowed } from "../test-switches.ts";

/**
 * A phone's boss bar: how far under its top every boss's figure reaches at most, px (Eric, Nov 12: "every boss as tall as their
 * container… the height, minus a few pixels"). Each kit's barScale, barShift and barName are measured from its art against it
 * (packages/app/test/bar-fit.ts; `npx tsx scripts/bar-fit.ts` prints them after a change).
 */
export const BAR_TOP_GAP = 3;

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
  /** Its animation, the king to our right (or to our left, `facesLeft`); mirrored when the king is on its other side. */
  anim: string;
  /** The same powered up, while the figure is (Moo's Full Moon, `BossKit.powered`): the animation shown then. */
  poweredAnim?: string;
  /** Drawn facing our left, the king on that side (Sawyer, as he always is); else facing our right. */
  facesLeft?: boolean;
  /** Its size on the board: frame pixels to a square. */
  perSquare: number;
  /** Where its feet go: this many squares to the king's side of the king's square's middle. */
  stand: number;
  /** Each hit on the king's square (the shared board canvas): the i-th, coming in from its left or right edge. */
  hit: (square: string, i: number, from: "L" | "R", since: number) => SquareItem;
  /**
   * Its frame cues to sounds, when they aren't the kit's own `sounds` (Timber: his attack's "whack" is his hammer's, while his
   * kit's "whack" is the gnaw as he takes a piece). Undefined: the kit's.
   */
  sounds?: Record<string, SoundName>;
  /**
   * At its mate, what stays on the king's square once the king has toppled, until the result (Hollow: his dark gathers there,
   * darkItem). Undefined: nothing, the square left empty. A boss's own (Eric, Nov 11: Babur's mate showed Hollow's dark).
   */
  mateMark?: (square: string, since: number) => SquareItem;
  /** The color of the king's flash at each hit at its mate (Hollow: his violet). Undefined: white. */
  glow?: string;
}

export interface BossKit extends BeatLines {
  /** Its figure as the board draws it (beside the board, in a phone's bar, casting, the result screen). */
  ch: Character;
  /**
   * Its sprite, on the sprite kit (sprite-kit.ts): its art as drawn (portraits and the select screen draw that), and the way it faces;
   * `ch` is then the same sprite turned to face the board (BOARD_FACING). Undefined: not on the kit yet, `ch` as drawn.
   */
  sprite?: Sprite;
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
  /**
   * A figure whose look changes in the battle (the Hidden Boss: his age, his suit): its portrait is this part of its bar's bust (`bar`)
   * as the bust is drawn now (the loop his figure rests in, his suit), so a computer's face follows him as a phone's bust does
   * (BossFace, Nov 14). Undefined: `portrait`, one picture.
   */
  barFace?: { x: number; y: number; w: number; h: number };
  /**
   * A figure whose height changes with what's drawn (the Hidden Boss's child form, growing up: one drawing for the child, 13, 20 and the
   * man): for each animation, how far above its feet its tallest frame reaches, sprite px (measured from the art: a test checks). Beside
   * the board his words stand on it, so they stay above his head at every size (BossCharacter sets `--bc-head`; styles.css `.bc-heads`).
   * Undefined: the bubble's place is the box's (one size).
   */
  heads?: Readonly<Record<string, number>>;
  /** Taller than the boss bar's usual box (Jefferson's long neck): on a phone the bar grows to hold him. */
  tall?: boolean;
  /** Wider than the boss bar's usual box (Sawyer's saw and tail): on a phone his box is wider, so neither the screen's
   * edge nor the boss's name cuts into him. */
  wide?: boolean;
  /**
   * The figure's size in a phone's boss bar (Eric, Nov 12: "every boss as tall as their container"; Nov 4: every boss whole inside the
   * bar): the largest hundredth at which every frame it rests in (its loops but its victory, the last frame of each one-shot) reaches no
   * higher than BAR_TOP_GAP under the bar's top. Measured from the art (packages/app/test/bar-fit.ts). Undefined: 1.
   * See docs/decisions/2026-11-12-boss-card-height.md.
   */
  barScale?: number;
  /**
   * The drawing's horizontal shift inside a phone's bar, px (+ right): the least that keeps its drawing whole inside the bar's left
   * edge (2 px in) at its size. The feet's box and the bar stay as they are for every boss. Undefined: 0.
   */
  barShift?: number;
  /**
   * The name column's extra room, px (+ right): the name, level, meters and words start this far further right, so a figure that
   * reaches past the column's usual left edge (89 px) keeps 2 px clear of it (Eric, Nov 12: "just shove over his name and stuff").
   * Undefined: 0.
   */
  barName?: number;
  /** A recolor (one of the character's `looks`) from the battle's state: Big Boy's black pawn. */
  lookOf?: (boss: BossView) => string | undefined;
  /** Its attack on a king (the God King's Last Stand, its mate), if it has one: see KingAttackKit. */
  kingAttack?: KingAttackKit;
  /**
   * A look it takes on for a time (Moo & Moon's Full Moon: every animation he plays during it is drawn powered up; the
   * director's call, Oct 20): `on` says from the battle's state and the clock whether it has it now; its animations are then
   * their `p_` twin where the character has one (`p_move` for `move`), and its idle is `idle` here. See `poweredKit`.
   */
  powered?: { on: (boss: Pick<BossView, "id" | "startMove" | "powers">, now: number, stage?: Stage) => boolean; idle: string };
  /** A figure that now and then changes how it rests (Moo hugs the moon, then sits on it): see characters/stance.ts. */
  rest?: Stance;
  /**
   * Wears a suit from a moment on (the Hidden Boss, from his transformation: BossCharacter's `setSuitAt`): the same frames, their
   * parts swapped for the suit's (recluse.ts, `suited`).
   */
  suit?: boolean;
  /**
   * Its drawing faces our left as drawn (not on the sprite kit). On the result screen, where the God King stands to its right, its
   * image is mirrored about its feet (styles.css, `.art-left`); its bubble and words never are. Judged by eye, Nov 8.
   */
  artFacesLeft?: boolean;
}

/**
 * Folio in a phone's boss bar (its kit's `bar`): its drawing without the halo, its frame 5 px narrower on the left, so it stops at a 320 px
 * screen's edge (the only pixels it loses are its victory's tiny crane's as it flies off past that edge).
 */
const FOLIO_BAR: Character = (() => {
  const cut = 5;
  const anims = mapFrames(FOLIO.anims, (f) => ({ ...f, layers: f.layers.map((l) => ({ ...l, x: l.x - cut })), ...(f.specks ? { specks: f.specks.map(([x, y, c]) => [x - cut, y, c] as const).filter(([x]) => x >= 0) } : {}) }));
  return { ...FOLIO, id: "folio-bar", halo: undefined, w: FOLIO.w - cut, foot: [FOLIO.foot[0] - cut, FOLIO.foot[1]], anims };
})();

export const BOSS_KITS: Record<string, BossKit> = {
  "Boingo the Clown": {
    barScale: 1.12,
    barShift: -4,
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
      splat: "clownSplat",
    },
    lines: CLOWN_LINES,
    chance: CLOWN_CHANCE,
    portrait: { ...CLOWN_PORTRAIT, anim: "idle", frame: 4 },
    // He bounces in on his pogo stick and pies the king, pie after pie (clown.ts: CLOWN_ATTACK), a splat on its square
    // each hit (Eric, Oct 18).
    kingAttack: { ch: CLOWN_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, hit: pieItem },
  },
  "Ginger": {
    barScale: 1.45,
    barShift: 19,
    barName: 21,
    ch: GINGERBREAD,
    anims: { strike: "capture", power: "freezeCast", ultimateWarn: "check", ultimate: "blizzard" },
    sounds: { jingle: "gingerJingle", crunch: "gingerCrunch", crackle: "gingerCrackle", freeze: "gingerCrackle", blizzard: "gingerCrackle" },
    lines: GINGER_LINES,
    chance: GINGER_CHANCE,
    portrait: { ...GINGER_PORTRAIT, anim: "idle", frame: 0 },
    // He drops in and jabs the king with his frosted cane, high and low (gingerbread.ts: GINGER_ATTACK; Eric, Oct 18),
    // a frost burst on its square each hit. (His cane reaches 1.08 squares from his feet, his body 0.46: he stands 1 off.)
    kingAttack: { ch: GINGER_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1, hit: frostItem },
  },
  "Jefferson": {
    barScale: 0.97,
    barShift: 9,
    barName: 11,
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
      // (His attack on a king: each fireball popping on the king, a pop and its sparks' crackle in turn.)
      pop: "grexPop",
      sparkle: "grexSparkle",
    },
    lines: GREX_LINES,
    chance: GREX_CHANCE,
    portrait: { ...GREX_PORTRAIT, anim: "idle", frame: 0 },
    tall: true,
    // He drops in, plants his Roman candle and fires at the king, a fireball a beat (grex.ts: GREX_ATTACK; Eric,
    // Oct 18), a firework pop on its square each hit.
    kingAttack: { ch: GREX_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, hit: popItem },
  },
  "Hollow": {
    barScale: 1.2,
    barShift: 14,
    barName: 22,
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
    // At its mate the king's square fades into his dark (`mateMark`), and the king flashes his violet at each lash (`glow`): his alone
    // (Eric, Nov 11: Babur's mate showed it; docs/decisions/2026-11-11-mate-effects-iphone-vibration.md).
    kingAttack: { ch: HOLLOW_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, hit: lashItem, mateMark: (square, since) => darkItem(square, "new", since), glow: "#9c6cff" },
  },
  "Big Boy": {
    barScale: 1.26,
    barShift: 6,
    barName: 4,
    // (On the sprite kit, Nov 7: drawn facing front, never mirrored, so his shirt reads "BIG BOY"; Eric: "just make him face the right way".)
    sprite: BIGBOY_SPRITE,
    ch: facingAs(BIGBOY_SPRITE, BOARD_FACING).ch,
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
    // A tantrum: he drops in and bonks the king with his giant lollipop, overhead and sideways (bigboy.ts:
    // BIGBOY_ATTACK; Eric, Oct 18), a candy-colored bonk on its square each hit. His lollipop is in his hand on our
    // left, so his attack faces our left (`facesLeft`); it reaches 1.13 squares from his feet, his fist 0.62: he
    // stands 1 off.
    kingAttack: { ch: BIGBOY_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1, facesLeft: true, hit: bonkItem },
  },
  "Sawyer": {
    artFacesLeft: true,
    barScale: 1.34,
    barShift: 21,
    barName: 32,
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
    // He drops in and saws at the king nonstop (sawyer.ts: SAWYER_ATTACK), sawdust bursting off its square each hit
    // (Eric, Oct 18). He faces our left, as always. (His saw reaches 1.6 squares from his feet at 36 frame pixels a
    // square, his gloves 1.1: he stands 1.45 off, the blade past the king's middle, his body clear of it.)
    kingAttack: { ch: SAWYER_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.45, facesLeft: true, hit: sawItem },
  },
  "Wrangler": {
    barScale: 1.28,
    barShift: 18,
    barName: 28,
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
      // (His attack on a king: the lasso cracked at the king, a sharp crack and a softer one in turn.)
      crack: "pigYank",
      lash: "pigCatch",
    },
    lines: PIG_LINES,
    chance: PIG_CHANCE,
    portrait: { ...PIG_PORTRAIT, anim: "idle", frame: 0 },
    // His throw's room out to one side (the frame is 115 wide): a wider box on a phone, as Sawyer's.
    wide: true,
    // He drops in and cracks his lasso at the king over and over, its end snapping in the king's square, never
    // wrapping round him (pig.ts: PIG_ATTACK; Eric, Oct 18), a snap on the square each hit. He faces our left, as
    // always, so he throws it that way (`facesLeft`), looking at the king (Eric, Oct 18).
    kingAttack: { ch: PIG_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, facesLeft: true, hit: lassoItem },
  },
  // Alfil, the woolly mammoth (Eric, Oct 17): docs/decisions/2026-10-17-alfil-wired.md.
  "Alfil": {
    artFacesLeft: true,
    barScale: 1.13,
    barShift: 19,
    barName: 17,
    ch: ALFIL,
    anims: {
      strike: "capture",
      // Tusks: the cast (his trunk levels the ankus at the board), then the fusion as his next move.
      power: "tusksCast",
      powerHit: "tusksFuse",
      ultimateWarn: "check",
      ultimate: "mammothSlam",
      // (The pieces landing: he stays where he is; the board shows them coming down.)
      ultimateHit: "idle",
    },
    sounds: {
      rumble: "alfilRumble",
      thud: "alfilThud",
      trumpet: "alfilTrumpet",
      stomp: "alfilStomp",
      oof: "alfilOof",
      clatter: "alfilClatter",
      swing: "alfilWhoosh",
      cast: "alfilGlow",
      snort: "alfilSnort",
      rise: "alfilGlow",
      flash: "alfilCrunch",
      leap: "alfilLeap",
      slam: "alfilThud",
      fly: "alfilWhoosh",
      // (The ground still rumbling as the shadows show where they'll land.)
      shadows: "alfilRumble",
      land: "alfilLand",
      jab: "alfilJab",
    },
    lines: ALFIL_LINES,
    chance: ALFIL_CHANCE,
    portrait: { ...ALFIL_PORTRAIT, anim: "idle", frame: 0 },
    // (His ankus out to his side and his frame 81 wide: the wider box on a phone, as Sawyer's and Wrangler's.)
    wide: true,
    // He hops in beside the king and jabs it with his ankus, high and low (alfil.ts: ALFIL_ATTACK), a gold spike and
    // sparks on its square each hit.
    // (His ankus reaches 2.2 squares from his feet at 36 frame pixels a square: he stands 1.9 off, its tip in the
    // king's square.)
    kingAttack: { ch: ALFIL_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.9, hit: ankusItem },
  },
  // The Hidden Boss (admins only, in Boss alone; DECISIONS.md, "The Hidden Boss, phase 1"). His lines are placeholders for
  // Eric's own, in one table (recluse-lines.ts).
  // Chub & Chirp, a rabbit riding a grasshopper (Eric, Oct 18): docs/decisions/2026-10-18-hopper-wired.md.
  "Chub & Chirp": {
    artFacesLeft: true,
    barScale: 1.15,
    barShift: 11,
    barName: 8,
    ch: HOPPER,
    anims: {
      strike: "capture",
      // Leapfrog: the hop (its pawn leaves its square at `takeoff` and lands beyond yours at `land`).
      power: "leapfrog",
      // (A carrot pulled: the board pops it; he stays where he is.)
      powerHit: "idle",
      ultimateWarn: "check",
      // The Carrot Patch: five bounds, a carrot tossed each (`toss1` to `toss5`), each planted (`plant1` to `plant5`).
      ultimate: "carrotPatch",
      // His spin: the race won (Hopper.tsx picks raceLost when it wasn't).
      ultimateHit: "raceWon",
    },
    sounds: {
      chirp: "hopperChirp",
      thump: "hopperThump",
      squeak: "hopperSqueak",
      oof: "hopperOof",
      flop: "hopperFlop",
      cheer: "hopperCheer",
      sigh: "hopperSigh",
      toss: "hopperToss",
      bonk: "hopperBonk",
      hop: "hopperHop",
      land: "hopperLand",
      takeoff: "hopperHop",
      // (Each carrot tossed, and thunking into its square as it's planted.)
      toss1: "hopperToss",
      toss2: "hopperToss",
      toss3: "hopperToss",
      toss4: "hopperToss",
      toss5: "hopperToss",
      plant1: "hopperThunk",
      plant2: "hopperThunk",
      plant3: "hopperThunk",
      plant4: "hopperThunk",
      plant5: "hopperThunk",
    },
    lines: HOPPER_LINES,
    chance: HOPPER_CHANCE,
    portrait: { ...HOPPER_PORTRAIT, anim: "idle", frame: 0 },
    // (Measured on a phone's bar at 320, 360 and 390 px: in the usual box his scarf and wing tip came within 2 px of his
    // name at rest, and over it in his entrance, move, hurt and victory: the wider box, as Sawyer's, Wrangler's and Alfil's.)
    wide: true,
    // He hops in and Chub pelts the king with carrots from his satchel, one on each hit (hopper.ts: HOPPER_ATTACK), a
    // bonk on its square each hit. (Facing our left, as Sawyer; 36 frame pixels a square, 1.8 off, as Boingo's throw.)
    kingAttack: { ch: HOPPER_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, facesLeft: true, hit: carrotItem },
  },
  // Smudgy, the chameleon painter (Eric, Oct 19): docs/decisions/2026-10-19-smudgy-wired.md.
  "Smudgy": {
    barScale: 1.18,
    // (Facing the board, his tail is on our left: 37 px of him left of his feet, 50 right. Size, shift and name: bar-fit, Nov 12.)
    barShift: 12,
    barName: 32,
    // (On the sprite kit, the pilot, Nov 6: drawn facing our left, turned to face the board; Eric: "in the battle intro he's facing
    // the wrong way when the match starts".)
    sprite: SMUDGY_SPRITE,
    ch: facingAs(SMUDGY_SPRITE, BOARD_FACING).ch,
    anims: {
      // The boss's periodic strike on a piece is his capture cheer. (`strike` the beat is not `strike` the animation: his
      // reveal, which is the rules' moment `unmask` and plays as `powerHit`.)
      strike: "capture",
      // Camouflage: the splash over his pawn row (the paint leaves the brush at `splash`).
      power: "camouflage",
      // The hidden rook revealed by his move: the tail snaps open and the paint drips off the piece (`drip`).
      powerHit: "strike",
      ultimateWarn: "check",
      // Repaint: two strokes, `stroke1` (his pawn goes your color) and `stroke2` (your piece goes his).
      ultimate: "repaint",
      // The crowd takes the hidden rook: his oof.
      ultimateHit: "hurt",
    },
    sounds: {
      drop: "smudgySwish",
      thump: "smudgyThump",
      splat: "smudgySplash",
      giggle: "smudgyGiggle",
      oof: "smudgyOof",
      flop: "smudgyThump",
      swish: "smudgySwish",
      dab: "smudgyDab",
      // (The paint leaving his brush: a fling; it splashes on the board as it lands: the moment's own sound.)
      splash: "smudgySwish",
      drip: "smudgyDrip",
      stroke1: "smudgySwish",
      stroke2: "smudgySwish",
      // (His attack on a king: a flick of the brush and the blob splatting on the king, in turn; he lands; his cheer.)
      flick: "smudgySwish",
      land: "smudgyThump",
      cheer: "smudgyGiggle",
    },
    lines: SMUDGY_LINES,
    chance: SMUDGY_CHANCE,
    portrait: { ...SMUDGY_PORTRAIT, anim: "idle", frame: 0 },
    // (Measured on a phone's bar at 320, 360 and 390 px: the wider box, as Sawyer's, Wrangler's, Alfil's and Chub & Chirp's.)
    wide: true,
    // He drops in and flicks his brush at the king, a blob of yellow paint splatting on its square each hit (smudgy.ts:
    // SMUDGY_ATTACK). Facing our left, as Sawyer; 36 frame pixels a square, 1.8 off, as Chub & Chirp's.
    kingAttack: { ch: SMUDGY_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, facesLeft: true, hit: paintItem },
  },
  // Moo & Moon, a cow and his friend the Moon (Eric, Oct 20): docs/decisions/2026-10-20-moo-wired.md.
  "Moo": {
    artFacesLeft: true,
    barScale: 0.96,
    barShift: 1,
    ch: MOO,
    anims: {
      // The periodic strike on a piece is his capture cheer.
      strike: "capture",
      // Moonbeam: he lifts his snout and moos; at `beam` the beam falls from the sky onto the piece.
      power: "moonbeam",
      // The Full Moon's end: the daze (the aura fizzles; at `calm` his colors go back).
      powerHit: "dazed",
      ultimateWarn: "check",
      // The Full Moon: the moon swells, at `swap` his colors go gold and the aura flares on.
      ultimate: "fullMoon",
      // The flurry: the moon rises over his head and fires five beams, `beam1` to `beam5`.
      ultimateHit: "flurry",
    },
    sounds: {
      // (His entrance's drop and his attack's: a soft slide.)
      drop: "mooSlip",
      thump: "mooThump",
      land: "mooThump",
      // The four moos: a happy one (his entrance, a capture, a check, a win, the attack's last), a soft one (the moonbeam's),
      // the big MOO (the Full Moon's) and a sleepy one (dazed).
      moo: "mooHappy",
      mooSoft: "mooSoft",
      mooBig: "mooBig",
      mooSleepy: "mooSleepy",
      oof: "mooOof",
      flop: "mooFlop",
      // (Hugging and sitting: the moon slipping out of his arms, him plopping onto it; back, the hop and the catch.)
      slip: "mooSlip",
      plop: "mooPlop",
      hop: "mooSlip",
      catch: "mooPlop",
      // The Moon: its hum as the beam gathers (a rising charge), the beam's bright whoosh, the swell as it fills to full, and the
      // aura flaring on at the Full Moon's `swap`.
      hum: "mooHum",
      beam: "mooBeam",
      swell: "mooSwell",
      swap: "mooFlare",
      // The flurry: the moon rising and humming, then its charge climbing under the five beams, a short bright zap each.
      gather: "mooHum",
      charge: "mooCharge",
      beam1: "mooZap",
      beam2: "mooZap",
      beam3: "mooZap",
      beam4: "mooZap",
      beam5: "mooZap",
      // The aura going out, and his colors coming back (a soft slide down).
      fizz: "mooFizz",
      calm: "mooSlip",
      // (His attack on a king: the moon's small beam on each hit, `beam` and `shine` in turn.)
      shine: "mooZap",
    },
    lines: MOO_LINES,
    chance: MOO_CHANCE,
    portrait: { ...MOO_PORTRAIT, anim: "idle", frame: 0 },
    // (Measured on a phone's bar at 320, 360 and 390 px: his idle reaches 26 px left of his feet, past the usual box's 24; his
    // height, 68 px, is Sawyer's and Smudgy's, so no `tall`. His powered glow reaches 34 and 32 either side, past `wide`'s 29: the
    // bar clips it at the box, styles.css `.ch-moo`.)
    wide: true,
    // While the Full Moon lasts (the view's `fullMoon`, until the daze's `calm`) every animation is its powered twin and his idle
    // is `powerIdle` (characters/moo-state.ts, `mooPowered`).
    powered: { on: mooPowered, idle: "powerIdle" },
    // At rest he hugs the moon, now and then lets go and sits on it, then hugs it again.
    rest: { hugMs: 7000, sitMs: 5000, toSit: "toSit", sit: "sit", toHug: "toHug" },
    // The moon shines a small moonbeam at the king, ten in a row, both of them looking at him (moo.ts: MOO_ATTACK). Facing our left,
    // as Sawyer; 36 frame pixels a square, 1.8 off, as Smudgy's.
    kingAttack: { ch: MOO_ATTACK, anim: "kingAttack", poweredAnim: "p_kingAttack", perSquare: 36, stand: 1.8, facesLeft: true, hit: moonItem },
  },
  // Puddles, the hippo gardener (Eric, Oct 20-21): docs/decisions/2026-10-23-gardener-wired.md.
  "Gardener": {
    artFacesLeft: true,
    barScale: 1.15,
    barShift: 3,
    ch: GARDENER,
    // (A phone's bar: the same drawing with the water off, which would run past his box into his name.)
    bar: GARDENER_BAR,
    anims: {
      // The periodic strike on a piece is his capture cheer.
      strike: "capture",
      // Seeds: the opening five (`plantMany`) and one every 30 s (`plant`) are tossed where he stands (components/Gardener.tsx); the
      // `toss` cue is where the seeds leave his hand.
      power: "plant",
      plantMany: "plantMany",
      plant: "plant",
      ultimateWarn: "check",
      // Watering: he hauls the hose out and sprays across the board from the `spray` cue.
      ultimate: "water",
      // What came up: a piece (`cheer`), a queen (`bigCheer`), nothing (`shrug`).
      ultimateHit: "cheer",
      cheer: "cheer",
      bigCheer: "bigCheer",
      shrug: "shrug",
    },
    sounds: {
      // (His entrance's drop and the attack's: a soft whoosh down; his landing and steps: a heavy thump.)
      drop: "gardenerWhoosh",
      thump: "gardenerThump",
      land: "gardenerThump",
      // A friendly grunt (his entrance, a capture, a check, a win, the attack's last), a hurt oof, the flop of his defeat.
      grunt: "gardenerGrunt",
      oof: "gardenerOof",
      flop: "gardenerFlop",
      // The 30 s seed's toss must stay quiet (a soft whiff, no grunt): only this one cue is in `plant` and `plantMany`.
      toss: "gardenerToss",
      // The watering: the hose tugged (a rubbery creak), the spray hissing on, swelling for the sweep and dying to drips.
      tug: "gardenerTug",
      spray: "gardenerSpray",
      sweep: "gardenerSwell",
      stop: "gardenerDrips",
      // His reactions: a happy cheer, the queen's whoop, a shrug (a soft sigh).
      cheer: "gardenerCheer",
      whoop: "gardenerBellow",
      shrug: "gardenerSigh",
      // (His attack on a king: a short squirt a jet, a shorter one a sputter.)
      jet: "gardenerJet",
      spurt: "gardenerSpurt",
    },
    lines: GARDENER_LINES,
    chance: GARDENER_CHANCE,
    portrait: { ...GARDENER_PORTRAIT, anim: "idle", frame: 0 },
    // His frame is 90 x 102 with 28 rows of headroom over his idle for the entrance's drop and the cheers' hops: the bar's tall
    // box; he reaches 28 px left and 25 right of his feet, past the usual box's 24: the wide one (docs/decisions/2026-10-20-gardener-still.md).
    tall: true,
    wide: true,
    // He drops in and sprays the king with his hose, ten jets (gardener.ts: GARDENER_ATTACK), a splash on its square each hit. Facing
    // our left, as Sawyer; 36 frame pixels a square, 1.8 off (the animation decision's suggested values).
    kingAttack: { ch: GARDENER_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, facesLeft: true, hit: waterItem },
  },
  // Babur, the circus tiger (Eric, Oct 23-24): docs/decisions/2026-10-24-tiger-wired.md.
  "Tiger": {
    artFacesLeft: true,
    barScale: 1.26,
    barShift: 8,
    barName: 9,
    ch: TIGER_FIGURE,
    anims: {
      // The periodic strike on a piece is his lazy swat.
      strike: "capture",
      // A new balloon on the pump (components/Tiger.tsx: on a phone his hop along the bar to it and back, `hopTrip`): `place`, the
      // limp balloon on the nozzle at its `touch` cue.
      power: "place",
      place: "place",
      // The warning: a growl he can't be bothered to finish.
      ultimateWarn: "check",
      // Hoops: up on his hind legs, a burning hoop thrown at each `throwN` cue.
      ultimate: "hoops",
      // A balloon landed (`cheer`), a real queen (`bigCheer`), a pop (`wince`).
      ultimateHit: "cheer",
      cheer: "cheer",
      bigCheer: "bigCheer",
      wince: "wince",
    },
    sounds: {
      // (His entrance's drop and the attack's: a whoosh down; his landing, steps and flop: a heavy thump.)
      drop: "tigerWhoosh",
      thump: "tigerThump",
      land: "tigerThump",
      flop: "tigerThump",
      // Where another boss roars he yawns; his check's growl is a half-hearted one; a bored huff.
      yawn: "tigerYawn",
      growl: "tigerGrowl",
      huff: "tigerHuff",
      // A lazy swat of his paw (a capture), a hurt "ugh" (his grumble), his balloons squeaking on their strings.
      swat: "tigerWhoosh",
      oof: "tigerWince",
      squeak: "tigerSqueak",
      // The hop to the pump, the limp balloon out of his vest pocket, and on the nozzle (the pump's own `put` is quiet).
      spring: "tigerSpring",
      rustle: "tigerRustle",
      touch: "tigerSqueak",
      // His reactions, in his grumble: a "heh-heh", a pleased run for a queen, an "ugh" for a pop.
      cheer: "tigerCheer",
      whoop: "tigerWhoop",
      wince: "tigerWince",
      // The hoops: lit, then each thrown (the ring's own flame is its landing's sound).
      flame: "tigerFlame",
      throw1: "tigerWhoosh",
      throw2: "tigerWhoosh",
      throw3: "tigerWhoosh",
      // His attack on a king: a bonk and a pop for each balloon.
      bonk: "tigerBonk",
      pop: "tigerPop",
    },
    lines: TIGER_LINES,
    chance: TIGER_CHANCE,
    portrait: { ...TIGER_PORTRAIT, anim: "idle", frame: 0 },
    // His frame is 76 x 106: 26 rows over the still for the entrance's drop, the hop and his standing poses (victory, the hoops, the
    // big cheer): the bar's tall box, as Puddles' cheers; and the wide box (docs/decisions/2026-10-23-tiger-animations.md).
    tall: true,
    wide: true,
    // He drops in and bats ten balloons at the king (tiger.ts: TIGER_ATTACK), each bonking and popping on its square. Facing our left,
    // as Sawyer; 36 frame pixels a square, 1.8 off (the animation decision's suggested values).
    kingAttack: { ch: TIGER_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, facesLeft: true, hit: balloonItem },
  },
  // Folio, the paper crane (the director's, Oct 26; "it" everywhere): docs/decisions/2026-10-27-folio-wired.md.
  "Folio": {
    artFacesLeft: true,
    barScale: 1.13,
    barShift: 19,
    barName: 26,
    ch: FOLIO,
    // (A phone's boss bar: the same drawing and animations without its faint halo, a pixel to the left, its frame stopping 5 px short
    // on the left where a 320 px screen's edge is. With the halo its idle is 87 px across, the bar's room 85 at full size, and it's
    // never drawn smaller; on the bar's dark ground the halo doesn't show.)
    bar: FOLIO_BAR,
    anims: {
      // (Its periodic strike on a piece, the God King's: its capture, the piece folded into a paper pawn under its wing.)
      strike: "capture",
      // The Draft: it stretches tall, its near wing points at the board, and an ink underline draws itself (the ink lands on the
      // mark at its `ink` cue).
      power: "check",
      // A piece folded: a small polite bow and the glint up its gilt edge (the paper folds over the piece at its `glint`).
      fold: "smug",
      // The Crease's warning: it cocks its head and lines of writing come up its wing (it's thinking where to fold).
      ultimateWarn: "thinking",
      // The Crease: its near wing sweeps across toward the board (the board folds at its `sweep`).
      ultimate: "move",
      // Revision: its wing edges curl, the ink runs (as its moves are struck out); its new move then plays as any move of its.
      revision: "rattled",
    },
    sounds: {
      // Its paper: drifting and settling, each fold, the unfold, a crumple when hurt and smoothed out after.
      rustle: "folioRustle",
      settle: "folioRustle",
      flutter: "folioRustle",
      pick: "folioRustle",
      fold: "folioFold",
      tuck: "folioFold",
      unfold: "folioUnfold",
      smooth: "folioUnfold",
      crumple: "folioCrumple",
      // Its wings: a gentle flap (the sweep toward the board, the stretch up, the launch of its tiny crane, its glide in and out).
      sweep: "folioFlap",
      stretch: "folioFlap",
      launch: "folioFlap",
      flap: "folioFlap",
      // Its pen: the ink's scratch, and a shorter dab (its attack's strokes in turn); its gilt's small glint.
      ink: "folioScratch",
      dab: "folioDab",
      glint: "folioGlint",
      // (Not a cue of its figure's: Revision's page turning as the board goes back, components/Folio.tsx.)
      page: "folioPage",
    },
    lines: FOLIO_LINES,
    // (One line each, said every time: its seven, as written.)
    chance: { entrance: 1, power: 1, fold: 1, ultimateWarn: 1, revision: 1, victory: 1, defeat: 1 },
    portrait: { ...FOLIO_PORTRAIT, anim: "idle", frame: 0 },
    // It glides in, points its wing at the king and flicks ink across it, ten strokes (folio-attack.ts: FOLIO_ATTACK), an ink
    // splash on its square each one. Facing our left; 36 frame pixels a square, 1.7 off (its beak clear of the king's middle).
    kingAttack: { ch: FOLIO_ATTACK, anim: "kingAttack", perSquare: ATTACK_PER_SQUARE, stand: ATTACK_STAND, facesLeft: true, hit: inkItem },
  },
  // Timber, the beaver builder (Eric's idea, Oct 20; approved Nov 1): docs/decisions/2026-11-01-timber.md. His sounds are his own,
  // all wood (Eric, Nov 2: "a gnawing wood sound… Wood knocking, cutting, saw, thumping"): characters/timber-sounds.ts.
  "Timber": {
    artFacesLeft: true,
    barScale: 1.09,
    barShift: 9,
    barName: 21,
    ch: TIMBER,
    anims: {
      // (His periodic strike on a piece, the God King's: his hammer whack.)
      strike: "capture",
      // A piece of his dropped: a plank off his back, shown off, swung down to the board (the piece goes on at its `drop` cue).
      power: "build",
      // The Gnaw's warning: teeth bared, licking his lips (a loop); the Gnaw: four big chomps, a chew and a burp of sawdust.
      ultimateWarn: "gnawWarn",
      ultimate: "gnaw",
      // A piece landed: a proud nod; his queen: a hop with the hammer high.
      cheer: "cheer",
      bigCheer: "bigCheer",
    },
    sounds: {
      // (His entrance: his fall.)
      drop: "timberSwoosh",
      // (A piece of his built: the plank set down. A tap, a whack or a knock, at random: Eric, Nov 2.)
      set: "timberBuild",
      // (He lands on the boards.)
      stomp: "timberThump",
      pat: "timberPat",
      whoosh: "timberSwoosh",
      tap: "timberTap",
      // (He takes your piece: the gnaw. Eric, Nov 2: "when he eats your piece".)
      whack: "timberGnaw",
      // (A knock for emphasis.)
      point: "timberKnock",
      oof: "timberOof",
      thump: "timberThump",
      clatter: "timberClatter",
      // (His happy chitter.)
      cheer: "timberChitter",
      slap: "timberSlap",
      // (A plank slid out of its strap.)
      pull: "timberSlide",
      // (A proud "hup!" as he shows it off.)
      show: "timberHup",
      // (His teeth clacked.)
      clack: "timberClack",
      chomp: "timberChomp",
      // (A burp of sawdust.)
      burp: "timberBurp",
    },
    lines: TIMBER_LINES,
    chance: TIMBER_CHANCE,
    portrait: { x: 14, y: 41, w: 42, h: 36, anim: "idle", frame: 0 },
    // (His frame is 98 x 129, the art's 88 x 88 with room round it for his entrance's drop: timber-figure.ts. The planks on his back and his
    // tail reach past the usual box on both sides.)
    wide: true,
    // He drops in hammer high beside the king, hammers it (overhead whacks and side knocks in turn), bats it with the plank off his
    // back and smashes it down on its head, then chitters and hops off (timber.ts: BOSS_BEAVER_ATTACK; Nov 2, the art's notes:
    // scripts/boss-art/out/timber-king-attack-nov2.md on claude/boss-art). Wood chips off its square each hit (chipItem). Facing our
    // left; 40 frame pixels a square keeps him about Big Boy's size, 1.15 off. His attack's cues are his own wood sounds: its whack
    // is his hammer's (his kit's `whack` is the gnaw as he takes a piece).
    kingAttack: {
      ch: TIMBER_ATTACK,
      anim: "kingAttack",
      perSquare: 40,
      stand: 1.15,
      facesLeft: true,
      hit: chipItem,
      sounds: { swoosh: "timberSwoosh", thump: "timberThump", whack: "timberWhack", knock: "timberKnock", slide: "timberSlide", chitter: "timberChitter", hup: "timberHup" },
    },
  },
  // Dash, the cheetah (Eric's design and art approved Nov 1, his name Nov 3): docs/decisions/2026-11-03-dash.md. His art is the
  // art branch's boss-blitz, as drawn (characters/boss-blitz.ts). His sounds are his own: sneakers and a chess clock
  // (characters/dash-sounds.ts); Tick's ding, chomp and step too.
  "Dash": {
    artFacesLeft: true,
    barScale: 0.98,
    barShift: 5,
    ch: DASH,
    anims: {
      // (His periodic strike on a piece in a raid: his capture's double fist pump.)
      strike: "capture",
      // Clock Slap: the paw high, the slam, a gold clock face zipping from his clock to his chest (your time, stolen).
      power: "clockSlap",
      // Time Scramble's warning: the clock held up, its face tapped twice (its last frame held); the scramble: the clock tossed,
      // spun in a blur, caught and slammed.
      ultimateWarn: "scrambleWarn",
      ultimate: "timeScramble",
      // Your time ran out (a move played for you): his finger gun.
      cheer: "check",
    },
    sounds: {
      // (His entrance: the zip in, the sneakers' skid, the clock's click.)
      zip: "dashZip",
      skid: "dashSqueak",
      click: "dashClick",
      // (Waiting on you: the clock's ticks and his yawn. He never thinks.)
      tick: "dashTick",
      yawn: "dashYawn",
      snap: "dashSnap",
      point: "dashSnap",
      yes: "dashYeah",
      "ta-da": "dashYeah",
      cheer: "dashYeah",
      windup: "dashWhoosh",
      whoosh: "dashWhoosh",
      slam: "dashSlam",
      // (Your time zipping into his chest.)
      steal: "dashSteal",
      warn: "dashTicktock",
      tap: "dashTick",
      whirr: "dashWhirr",
      oof: "dashOof",
      flag: "dashFlag",
      slump: "dashSlump",
      // (Tick's, his tortoise's: his clock's ding, his chew, his plod, his duck into the shell.)
      ding: "dashDing",
      chomp: "dashChomp",
      step: "dashStep",
      poof: "dashStep",
    },
    lines: DASH_LINES,
    chance: DASH_CHANCE,
    portrait: { x: 18, y: 10, w: 38, h: 34, anim: "idle", frame: 0 },
    // His attack on a king (Eric, Nov 6: "when you blunder, all bosses are supposed to jump on the board and attack"): he dashes
    // in from his side with his trail, swipes his claws at it ten times, high and low (a whoosh and a snap in turn), and dashes
    // off (dash-figure.ts: DASH_ATTACK). Facing our left; 48 frame pixels a square (he's lanky), a square off.
    // His claw marks on its square each swipe (clawItem; until Nov 11 Jefferson's fireball pops, popItem: docs/decisions/2026-11-11-mate-effects-iphone-vibration.md).
    kingAttack: { ch: DASH_ATTACK, anim: "kingAttack", perSquare: 48, stand: 1, facesLeft: true, hit: clawItem },
  },
  // Don Dough, the zebra kingpin (Eric's design, Nov 10-11; his art approved Nov 11): docs/decisions/2026-11-11-don-dough.md. His art is
  // the art branch's boss-zebra, as drawn (characters/zebra.ts, on its rig zebra-rig.ts). His sounds are his own: a bread rifle's
  // little pops, crust and flour, a bakery's oven timer and gold glaze (characters/zebra-sounds.ts).
  "Don Dough": {
    barScale: 1.21,
    barShift: 8,
    barName: 31,
    ch: ZEBRA,
    anims: {
      // His battle start (Eric: "he pulls out his bread and holds it like a rifle, pretends to shoot it at you, a little pop, and
      // then he just starts laughing").
      entrance: "breadPop",
      // (His periodic strike on a piece in a raid: the roll pulled, a pop, slung back.)
      strike: "capture",
      // Rising Dough: a lump from his apron pocket, a toss in his hoof, lobbed onto the board.
      power: "drop",
      // Gold Plate's warning: chin up, a chuckle (a loop); the cast: the glaze stirred, three strokes at the board, a chef's kiss.
      ultimateWarn: "smug",
      ultimate: "goldPlate",
      // A lump risen into his piece: two nods and belly pats; a queen: the roll thrust overhead, laughing.
      cheer: "cheer",
      bigCheer: "bigCheer",
      // Your piece squashed his dough: his hat jolted up.
      squashed: "hurt",
    },
    sounds: {
      thud: "zebraThud",
      tip: "zebraTip",
      point: "zebraHm",
      draw: "zebraDraw",
      pop: "zebraPop",
      hurt: "zebraOof",
      cock: "zebraCock",
      chuckle: "zebraChuckle",
      laugh: "zebraLaugh",
      snap: "zebraSnap",
      relax: "zebraRelax",
      tsk: "zebraTsk",
      tap: "zebraTap",
      // (The lump lobbed.)
      drop: "zebraLob",
      volley: "zebraVolley",
      stir: "zebraStir",
      gild: "zebraGild",
      kiss: "zebraKiss",
    },
    lines: ZEBRA_LINES,
    chance: ZEBRA_CHANCE,
    portrait: { ...BOSS_ZEBRA_PORTRAIT, anim: "idle", frame: 0 },
    // His attack on a king (Eric, Nov 10: "it looks like he's just firing off a bunch of shots with this loaf of bread"): he drops in,
    // aims his roll and fires ten shots (his volley), a puff of flour off its square each one, laughs and hops off (zebra-figure.ts:
    // ZEBRA_ATTACK). Facing our right, as drawn; 37 frame pixels a square (the art's room scale), 1.1 off (his roll's end and its
    // puff reach past the king's middle).
    kingAttack: { ch: ZEBRA_ATTACK, anim: "kingAttack", perSquare: 37, stand: 1.1, hit: flourItem },
  },
  "Hidden Boss": {
    barScale: 1.34,
    barShift: -2,
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
      // (His older phase change's frames, kept: his hand raised, his fist closing, up in a rage, the leap, the book thrown, the light.)
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
    // (A computer's face: his bust's, as it's drawn now, so it wears his suit in phase 2.)
    barFace: RECLUSE_BUST_PORTRAIT,
    // (The bust is 50 px wide: the wider box on a phone, as Sawyer's and Wrangler's.)
    wide: true,
    // (Phase 2: his suit and helmet, from his transformation on.)
    suit: true,
    // (His words above his head as it's drawn now, beside the board: kneeling as he mumbles, beaten.)
    heads: RECLUSE_HEADS,
  },
};

/**
 * The Hidden Boss in his child form (BossView.form "child", RECLUSE_CHILD; Nov 13): his growing figure (the child, 13, 20, then his
 * adult look: recluse-ages.ts), the same size and place as his adult kit's in a phone's bar and beside the board, and the kid's lines.
 * His figure follows his age by a figure run (components/RecluseChild.ts); every moment rests in it. Not in BOSS_KITS: a form of the
 * Hidden Boss's, by `bossKitOf`.
 */
const ADULT = BOSS_KITS["Hidden Boss"]!;
export const RECLUSE_CHILD_KIT: BossKit = {
  barScale: ADULT.barScale,
  barShift: ADULT.barShift,
  ch: RECLUSE_GROWING,
  bar: RECLUSE_GROWING_BUST,
  anims: {},
  // (His adult look's idle keeps its sounds; each step up has a shimmer and a flash.)
  sounds: { ...ADULT.sounds, shimmer: "recluseGlow", flash: "recluseSpark" },
  lines: {
    entrance: RECLUSE_CHILD_LINES.intro,
    capture: RECLUSE_CHILD_LINES.capture,
    hurt: RECLUSE_CHILD_LINES.hurt,
    check: RECLUSE_CHILD_LINES.check,
    rattled: RECLUSE_CHILD_LINES.rattled,
    smug: RECLUSE_CHILD_LINES.smug,
    victory: RECLUSE_CHILD_LINES.victory,
    defeat: RECLUSE_CHILD_LINES.beaten,
  },
  chance: { entrance: 1, capture: 0.35, hurt: 0.4, check: 0.5, rattled: 0.3, smug: 0.2, victory: 1, defeat: 1 },
  // (Beaten: the kid's half of this fight's exchange as he grows up, the man answering once grown: RecluseChild.ts. Nov 14.)
  lineOf: (beat, boss) => (beat === "defeat" ? growUpExchange(boss).kid : undefined),
  // (His face as the child: the man's window, moved down to the child's head, 45 px lower in the same drawing space.)
  portrait: { ...ADULT.portrait, y: ADULT.portrait.y + 45, anim: "idle", frame: 0 },
  // (A computer's face follows his age, from each age's bust: 9, 13, 20, then the man.)
  barFace: RECLUSE_BUST_PORTRAIT,
  // (His words above his head at whichever age is drawn now, beside the board: Eric, Nov 14.)
  heads: GROWING_HEADS,
  wide: true,
};

/** A boss's kit for the form it's in: the Hidden Boss's child (RECLUSE_CHILD_KIT), else its own (bossKit). */
export const bossKitOf = (boss: { name: string; form?: string } | null | undefined): BossKit | null =>
  boss?.form === "child" && bossKit(boss.name) === ADULT ? RECLUSE_CHILD_KIT : bossKit(boss?.name);

// Folio's voice (Eric, Oct 27): each of its lines heard as it starts, its chirp (speech.tsx, `lineSounds`).
for (const lines of Object.values(FOLIO_LINES)) for (const line of lines ?? []) lineSounds.set(line, "folioVoice");

/** Every moment a kit may name an animation for (and so every `anims` key a powered twin may replace). */
const BEAT_NAMES = ["entrance", "idle", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "strike", "power", "powerHit", "ultimateWarn", "ultimate", "ultimateHit", "wax", "flurry", "dazed", "plantMany", "plant", "cheer", "bigCheer", "shrug", "place", "wince", "fold", "revision", "gnawNone", "kingAttack"] as const satisfies readonly Beat[];
const LOOP_NAMES = ["idle", "thinking", "smug", "rattled", "defeat", "victory"] as const satisfies readonly Loop[];
const poweredKits = new WeakMap<BossKit, BossKit>();
/**
 * The kit as it draws while it's powered up (`BossKit.powered`): each moment's animation is its `p_` twin where the character
 * has one (`p_move` for `move`; an animation already drawn powered, the transformation's `fullMoon`, stays), and each loop it
 * rests in too, its idle `powered.idle`. Made once a kit.
 */
export function poweredKit(kit: BossKit): BossKit {
  let k = poweredKits.get(kit);
  if (!k) {
    const twin = (name: string) => (kit.ch.anims[`p_${name}`] ? `p_${name}` : name);
    const anims: Partial<Record<Beat, string>> = { ...kit.anims };
    for (const b of BEAT_NAMES) anims[b] = twin(kit.anims[b] ?? b);
    const loops: Partial<Record<Loop, string>> = { ...kit.loops };
    for (const l of LOOP_NAMES) loops[l] = l === "idle" ? kit.powered!.idle : twin(kit.loops?.[l] ?? l);
    poweredKits.set(kit, (k = { ...kit, anims, loops }));
  }
  return k;
}

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
/** A boss's art as drawn (its portrait, the select screen): its sprite's, where it's on the sprite kit; else its board figure. */
export const artOf = (kit: BossKit): Character => kit.sprite?.ch ?? kit.ch;
