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
import { BIGBOY, BIGBOY_ATTACK, BIGBOY_CHANCE, BIGBOY_LINES, BIGBOY_PORTRAIT } from "./bigboy.ts";
import { CLOWN, CLOWN_ATTACK, CLOWN_CHANCE, CLOWN_LINES, CLOWN_PORTRAIT } from "./clown.ts";
import { GINGER_ATTACK, GINGER_CHANCE, GINGER_LINES, GINGER_PORTRAIT, GINGERBREAD } from "./gingerbread.ts";
import { GREX, GREX_ATTACK, GREX_CHANCE, GREX_LINES, GREX_PORTRAIT } from "./grex.ts";
import { HOLLOW, HOLLOW_ATTACK, HOLLOW_CHANCE, HOLLOW_LINES, HOLLOW_PORTRAIT } from "./hollow.ts";
import { SAWYER, SAWYER_ATTACK, SAWYER_CHANCE, SAWYER_LINES, SAWYER_PORTRAIT } from "./sawyer.ts";
import { PIG, PIG_ATTACK, PIG_CHANCE, PIG_LINES, PIG_PORTRAIT } from "./pig.ts";
import { RECLUSE, RECLUSE_BUST, RECLUSE_PORTRAIT } from "./recluse.ts";
import { ALFIL, ALFIL_ATTACK, ALFIL_CHANCE, ALFIL_LINES, ALFIL_PORTRAIT } from "./alfil.ts";
import { HOPPER, HOPPER_ATTACK, HOPPER_CHANCE, HOPPER_LINES, HOPPER_PORTRAIT } from "./hopper.ts";
import { SMUDGY, SMUDGY_ATTACK, SMUDGY_CHANCE, SMUDGY_LINES, SMUDGY_PORTRAIT } from "./smudgy.ts";
import { RECLUSE_LINES } from "./recluse-lines.ts";
import type { BossView } from "../game.ts";
import type { Character } from "./sprite.ts";
import { ankusItem, bonkItem, carrotItem, frostItem, lashItem, lassoItem, paintItem, pieItem, popItem, sawItem, type SquareItem } from "./power-art.ts";
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
  /** Its animation, the king to our right (or to our left, `facesLeft`); mirrored when the king is on its other side. */
  anim: string;
  /** Drawn facing our left, the king on that side (Sawyer, as he always is); else facing our right. */
  facesLeft?: boolean;
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
    ch: GINGERBREAD,
    anims: { strike: "capture", power: "freezeCast", ultimateWarn: "check", ultimate: "blizzard" },
    sounds: { jingle: "gingerJingle", crunch: "gingerCrunch", crackle: "gingerCrackle", freeze: "gingerCrackle", blizzard: "gingerCrackle" },
    lines: GINGER_LINES,
    chance: GINGER_CHANCE,
    portrait: { ...GINGER_PORTRAIT, anim: "idle", frame: 0 },
    // She drops in and jabs the king with her frosted cane, high and low (gingerbread.ts: GINGER_ATTACK; Eric, Oct 18),
    // a frost burst on its square each hit. (Her cane reaches 1.08 squares from her feet, her body 0.46: she stands 1 off.)
    kingAttack: { ch: GINGER_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1, hit: frostItem },
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
    // A tantrum: he drops in and bonks the king with his giant lollipop, overhead and sideways (bigboy.ts:
    // BIGBOY_ATTACK; Eric, Oct 18), a candy-colored bonk on its square each hit. His lollipop is in his hand on our
    // left, so his attack faces our left (`facesLeft`); it reaches 1.13 squares from his feet, his fist 0.62: he
    // stands 1 off.
    kingAttack: { ch: BIGBOY_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1, facesLeft: true, hit: bonkItem },
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
    // He drops in and saws at the king nonstop (sawyer.ts: SAWYER_ATTACK), sawdust bursting off its square each hit
    // (Eric, Oct 18). He faces our left, as always. (His saw reaches 1.6 squares from his feet at 36 frame pixels a
    // square, his gloves 1.1: he stands 1.45 off, the blade past the king's middle, his body clear of it.)
    kingAttack: { ch: SAWYER_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.45, facesLeft: true, hit: sawItem },
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
    ch: SMUDGY,
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
