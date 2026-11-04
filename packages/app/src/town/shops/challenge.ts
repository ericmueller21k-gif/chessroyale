/**
 * A boss challenged from the town, Pokémon-gym style (Eric, Nov 2; docs/areas/town-square.md, "Challenging a boss"): you and the
 * boss walk into its home, each to a start mark on its battle circle; it says its challenge line; its own animation brings the
 * board in between you (Alfil: a sand pyramid rises, cracks and crumbles, and his table is inside; Timber: he carries a giant log to
 * the middle and gnaws it into the table); its own transition covers the screen (Alfil: a sandstorm) while the battle loads under it; after the battle, its result screen's "Back to town" puts you where
 * you stood. Pure and light: the town imports it to know which bosses have an intro; the art and the drawing load only when you
 * challenge one (shops/intro.ts). No DOM; tested in packages/app/test/boss-challenge.test.ts.
 *
 * A boss without an intro here is challenged as before (the Boss raid screen, its tile picked).
 */
import type { HomeId } from "../world.ts";
import type { ShopPlace } from "./room.ts";

/**
 * Where you and the boss stand at the table (Eric, Nov 2, round 2: "I also prefer the normal look is boss on left, you on right, not
 * vertical, but I'm ok if it's some for some bosses and the opposite for others"): "across", the boss on the table's west (the
 * screen's left), you on its east, side by side across the screen (the default); "facing", the boss north of it (behind it, from the
 * camera), you south.
 */
export type IntroLayout = "across" | "facing";

/** A boss's intro: its challenge line (one per boss: Gemini's lines, Part D, drop in here) and the sounds on its art's cues. */
export interface BossIntro {
  /** Its name as its kit knows it (its God King attack comes from there). */
  name: string;
  /** Said out loud in a speech bubble by its head (not the chat log: Eric, Nov 2) as you face each other. */
  line: string;
  /** Where you and it stand at the table. */
  layout: IntroLayout;
  /**
   * Its own board art and transition (shops/intro.ts ART: Alfil's pyramid and sandstorm, Big Boy's toy blocks and lollipop swirl,
   * Timber's log, shavings, table and stumps and his sawdust sweep), or
   * false: the default intro (the table pops in between you, then a flash and a wipe to black). Every intro ends with its God King
   * attack swung in place for a couple of seconds.
   */
  custom: boolean;
  /** A sound for each cue that has a fitting one (the boss's own pack; the default's "table" pop and "wipe"): none is silent. */
  cues: Readonly<Record<string, string>>;
  /**
   * Its town figure faces left as drawn, for a boss whose kit has no God King attack to say so (Dash, Nov 3: none was drawn; his
   * swing's beat he stands in his idle). A boss with an attack faces as its attack's art does.
   */
  facesLeft?: true;
  /**
   * Its own hop-back place, squares from the table's middle, where its figure or its swing reaches further toward its stool than
   * `CHALLENGE_FEEL.clear.boss` allows (Hollow, Nov 3: his strand's lash lies 1.6 squares out in front of his feet). None: the usual.
   */
  clear?: number;
  /**
   * Its second line, said as its own art starts (Hollow's channel lines, Nov 3: one picked at random each time, `chantOf`), in the
   * bubble over its head for `CHALLENGE_FEEL.dark.chantMs`. None: just its entrance line.
   */
  chant?: readonly string[];
  /**
   * You both walk on straight to your seat spots (its `clear` place, yours the usual) and stay there: no hop back as the stools come
   * in (Hollow, Nov 3: "you both walk on straight to your seat spots"; the table and stools come in while it's still lit). `seatedMarks`.
   */
  seated?: true;
}

/**
 * The bosses with an intro: every boss whose home has an inside (shops/shops.ts SHOPS; Nov 2, round 2: "for other bosses they should
 * just be swinging for a few seconds like discussed"). Alfil has his own (his pyramid and sandstorm), Big Boy his (his toy blocks
 * and lollipop swirl, Nov 2), Timber his (Nov 3: his log, gnawed into the table, and his sawdust sweep), Hollow his (Nov 3: the darkness
 * ball drinking the cave's light, the dim light, an iris to the board); Babur, Puddles and Dash (Nov 3, until his own, round 3) the
 * default.
 * The lines are placeholders until Gemini's lines arrive (Part D), each in its boss's voice (characters/*-lines.ts). Alfil's cues are
 * his own synthesized sounds (characters/alfil-sounds.ts): a low rumble as the pyramid rises, the grinding crunch as it cracks, the
 * ground's thud as it falls, the soft glow as the board shows, and a whoosh as the storm comes in. The default's: the app's soft pop
 * as the table appears, and the boss's own whoosh as the screen flashes. Big Boy's are his own toy sounds (characters/bigboy-sounds.ts):
 * a wooden clack as each block lands (a bonk for the top one), his toss as the board drops, a poof as it plops on, a clack for each
 * stool, and his swish as the swirl comes in. Timber's are his own wood sounds (characters/timber-sounds.ts), one for each cue on his
 * art's frames: his "hup" as he heaves the log up, the thump as he stands it on end, his gnaws and chomps, the clatter as the shavings
 * boil up, a saw in the fog, the slide as it settles, a knock as the stumps pop up, the pat as he dusts off his paws, his chitter, and
 * his swoosh as the sawdust sweeps in.
 */
export const BOSS_INTROS: Readonly<Partial<Record<HomeId, BossIntro>>> = {
  alfil: {
    name: "Alfil",
    line: "I'll show you the power of the old piece.",
    layout: "across",
    custom: true,
    cues: { rumble: "alfilRumble", crack: "alfilCrunch", crumble: "alfilThud", table: "alfilGlow", storm: "alfilWhoosh" },
  },
  tiger: {
    name: "Babur",
    line: "Fine. One more show. Then I'm on break.",
    layout: "across",
    custom: false,
    cues: { table: "pop", wipe: "tigerWhoosh" },
  },
  gardener: {
    name: "Puddles",
    line: "Wipe your feet. Then let's see what grows.",
    layout: "across",
    custom: false,
    cues: { table: "pop", wipe: "gardenerWhoosh" },
  },
  bigboy: {
    name: "Big Boy",
    line: "My blocks! My board! Big boy go first!",
    layout: "across",
    custom: true,
    cues: { block: "bigboyClack", "block-top": "bigboyBonk", drop: "bigboyToss", plop: "bigboyPoof", stool: "bigboyClack", storm: "bigboySwish" },
  },
  // (Nov 3: his own, the log he gnaws into the table; his line is his entrance's first, characters/timber-lines.ts.)
  timber: {
    name: "Timber",
    line: "Hard hats on. We're building today.",
    layout: "across",
    custom: true,
    cues: {
      hup: "timberHup",
      thump: "timberThump",
      gnaw: "timberGnaw",
      chomp: "timberChomp",
      clatter: "timberClatter",
      saw: "timberSaw",
      slide: "timberSlide",
      knock: "timberKnock",
      pat: "timberPat",
      chitter: "timberChitter",
      storm: "timberSwoosh",
    },
  },
  // (Nov 3: the default until his own intro, round 3; his line is his entrance's first, characters/dash-lines.ts.)
  dash: {
    name: "Dash",
    line: "Yo yo yo! Dash in the building, fam!",
    layout: "across",
    custom: false,
    cues: { table: "pop", wipe: "dashWhoosh" },
    facesLeft: true,
  },
  // (Nov 3: his own, the darkness ball drinking the cave's light, Eric's design with his changes (docs/decisions/2026-11-03-hollow-intro.md);
  // his entrance line as before (characters/hollow.ts), then a channel line as he starts to charge. His pond is smaller than the other
  // circles: the drawn marks, SHOP_HOLLOW_MARKS, the usual spacing.)
  hollow: {
    name: "Hollow",
    line: "Did you leave a light on?",
    layout: "across",
    custom: true,
    chant: ["The dark is misunderstood.", "It's not the dark you fear. It's not knowing what's in it.", "Shh. The dark never hurt anyone.", "Nobody ever asks the dark how it feels."],
    seated: true,
    // His cues, each a sound of his own (characters/hollow-sounds.ts), but the app's pop as the table appears: his hum as the ball
    // charges (once a loop) and deeper once it's full; his cast, lower, as it swells; a lantern's flame pulled at, then snuffed; the
    // string's dull run, a tick as each bulb goes dark, the star's last muffled tone; a mote's sip as it lands; your pawn's light
    // leaving; the blackout's thoom; the ball settling back into him.
    cues: {
      table: "pop",
      hum: "hollowHum",
      deep: "hollowDeep",
      swell: "hollowSwell",
      gutter: "hollowGutter",
      snuff: "hollowSnuff",
      drain: "hollowDrain",
      tink: "hollowTink",
      star: "hollowStar",
      sip: "hollowSip",
      pawn: "hollowPawn",
      blackout: "hollowBlackout",
      settle: "hollowSettle",
    },
    // (Where he sits: his lash's feet clear of his stool, a tenth from it as every boss's, as when he swung it there; he walks on to it.)
    clear: 2.92,
  },
  // (Nov 4: his own, Eric's design: the lasso, the hay bale with the board dragged to the middle, the buckets yanked in for the stools,
  // and his wipe of spurs, tumbleweeds and cap guns; docs/decisions/2026-11-04-wrangler-home.md. His line a placeholder until Eric's
  // Gemini lines. You both walk on straight to where you stand through it all, clear of the stools (the usual clear places: at the
  // art's 7.2 the rope coil in his other fist hung in front of his bucket): nobody moves when the bale and the buckets come in, nor after.)
  pig: {
    name: "Wrangler",
    line: "Saddle up, partner. The board's comin' to us.",
    layout: "across",
    custom: true,
    seated: true,
    // His cues, each a sound of his own (characters/pig-sounds.ts): the lasso whirling, thrown (twice at once for the cross throw),
    // the loop slapping down on the bale and snapping taut, each yank, the bale's scrape across the straw, the thunk as it and each
    // bucket land, the loop flicked free (his throw), the double lasso winding up, the buckets' clatter, his hat tip, his snorting
    // laugh and snort, his spur stomp; and the wipe's spurs jingling and a toy cap's pop.
    cues: {
      whirl: "pigWhirl",
      throw: "pigThrow",
      catch: "pigCatch",
      snap: "pigTug",
      yank: "pigYank",
      slide: "pigSlide",
      thunk: "pigHop",
      flick: "pigThrow",
      windup: "pigWindup",
      clatter: "pigClatter",
      tip: "pigTip",
      laugh: "pigLaugh",
      snort: "pigSnort",
      stomp: "pigStomp",
      jingle: "pigJingle",
      pop: "pigPop",
    },
  },
};

/** The boss's intro, or null: challenged as before (no intro yet). */
export const introOf = (id: HomeId): BossIntro | null => BOSS_INTROS[id] ?? null;
/** Its channel line this time (one of its `chant`, picked by `rand`: Math.random as the room opens), or null: it has none. */
export const chantOf = (def: BossIntro, rand: () => number = Math.random): string | null =>
  def.chant?.length ? def.chant[Math.min(def.chant.length - 1, Math.floor(rand() * def.chant.length))]! : null;

/**
 * Every number that shapes the challenge's timing and where everyone stands. The pacing (Eric, Nov 2, after Big Boy's live: "it
 * happens so damn fast… Stretch that out a few more seconds: slowly walk up to the chessboard, then say your line, then the tiles
 * drop down, then the seats drop down. Add a little delay between these things"): a walk to the door and in, a beat inside, a slow
 * walk up to the marks, a pause, the line, a pause, each build step with a small gap between, the attack swung, the cover. About
 * 10 to 12 s from Fight to the cover (it was about 5 to 6). Every beat is one number here; the timeline is `introBeats`.
 */
export const CHALLENGE_FEEL = {
  /** In the town, you and the boss walk to its door at this pace (ms a square): the town's walkers' pace (botStepMs), not your run. */
  doorStepMs: 200,
  /** Inside, you both stand just in the door this long (ms, from the room's first frame: its fade-in, then a beat) before walking. */
  insideMs: 400,
  /** Walking up to the marks, side by side: ms a square (a slow walk: the room's squares show bigger than the town's). */
  walkStepMs: 180,
  /** The last half square onto the middle of a two-square start mark, in ms. */
  settleMs: 250,
  /** On the marks, facing each other, this long (ms) before the line. */
  faceMs: 300,
  /** The line in the bubble over the boss's head (ms): long enough to read. */
  lineMs: 2500,
  /**
   * The bubble over the boss's head (his intro's line, Hollow's chant): a speech bubble for his size, just over his drawn head
   * (Eric, Nov 4: it was a name tag's size, far above him). Its text `font` times the boss's drawn height (px), never under `min`
   * (the old 11 px: a far camera, a phone) nor over `max`; its lines wrap at `wrapEm` of its font; its tail's tip `gap` of his height
   * over the top of his drawing. bubbleSize.
   */
  bubble: { font: 0.11, min: 11, max: 32, wrapEm: 12.7, gap: 0.02 },
  /** The pause after the line, before the board starts coming in (ms). */
  afterLineMs: 300,
  /** Alfil's pyramid holds this long (its idle, ms) once it has risen, before it cracks. */
  holdMs: 600,
  /** The small gap between build steps (ms): Big Boy's blocks stacked and the board dropping, the board on and the stools dropping. */
  gapMs: 300,
  /** The finished table (and its stools) on its own this long (ms) before the attack. */
  tableHoldMs: 400,
  /** Toy blocks (Big Boy's): the board falls onto the built table over this long (ms), from `dropFrom` squares above it. */
  boardDropMs: 220,
  dropFrom: 2.5,
  /** The storm sweeps in over this long (ms), holds covered at least `coveredMinMs` (longer while the battle loads), and slides out over `stormOutMs`. */
  stormInMs: 600,
  coveredMinMs: 250,
  stormOutMs: 600,
  /**
   * The room's camera through a challenge, by layout: looking at this many squares south of the table (and west of it: the boss is
   * wider than you, and stands further out), at this zoom (0 Close, 1 the town's zoomed-in camera): you, the table, both stools and
   * the boss all in view, the boss's line under the chat log. Both at 1, as a home starts (Eric, Nov 3: the further out of the two
   * "when you challenge the boss, so you can see everything"; they were 0.8 and 0.6).
   */
  cam: { across: { south: 0.8, west: 0.75, zoom: 1 }, facing: { south: 1.5, west: 0, zoom: 1 } },
  /**
   * How far (squares) each of you stands from the table's middle, by layout, walking in and saying the line: across, on the start
   * marks just outside the stools (the park table's stools stand `stoolOff` from its middle); facing, on the circle's drawn north
   * and south marks.
   */
  standOff: { across: 1.5, facing: 2.5 },
  /**
   * Standing clear (Eric, Nov 2: "Make sure they're not standing where the chair blocks are; that looks like bad design"): as the
   * stools come in, you and the boss each take a little hop back (`hopMs`, `hopUp` squares high at its top) to this far from the
   * table's middle (squares), so no part of you near the floor is in front of a stool (a unit test measures every boss's drawing).
   * Across only (facing, the stools stand between you and the table).
   */
  clear: { you: 2.2, boss: 2.6 },
  hopMs: 320,
  hopUp: 0.3,
  /** The park table's stools: this far (squares) from the table's middle (park.ts PARK_TABLE: three squares across). */
  stoolOff: 1,
  /** A circle whose middle has a piece standing in it (Babur's ring, its pedestal): the table stands this many squares south of it. */
  clearOff: 1.5,
  /**
   * The default intro (a boss without its own art): after the line and its pause, the table and its board pop in (growing over
   * `popMs`, a dust puff round its foot over `puffMs`), the table holds, then it swings its God King attack in place.
   */
  popMs: 300,
  puffMs: 500,
  /**
   * The boss's attack (its kit's `kingAttack`, the one it fires at the God King; Eric, Nov 2: "a few seconds before the screen
   * overlay hits… it continues on until the screen is fully cloaked"): swung where it stands for this long (ms) before its
   * transition has covered the screen, and on (its lashes over and over) until the battle takes the screen. A boss without one
   * skips it (the same time, standing).
   */
  swingMs: 2000,
  /** The default transition: the screen flashes white `flashes` times over `flashMs`, black bands wipe in over `wipeMs`, and the black fades off over `wipeOutMs`. */
  flashes: 3,
  flashMs: 420,
  wipeMs: 380,
  wipeBands: 8,
  wipeOutMs: 420,
  /** The storm's tiles are drawn this many times their size, crisp. */
  stormScale: 3,
  /**
   * Timber's own (Nov 3, Eric: "When he walks in, to the left there's a giant thick wooden log. He picks it up and walks it over… sets
   * it in the middle where the chessboard goes. Then he starts gnawing at it… a big storm of wood shavings and sawdust comes up like a
   * fog, then it falls and dissipates, and you see he's chewed it into a board"; about 12 s): the log lies `at` squares west of the
   * table's middle (on the boss's row, past his mark); his line shows `lineLeadMs` alone before he sets off for it (the bubble stays
   * its `lineMs`, riding his head); he walks there at `walkMs` a square and carries it to the middle at `carryMs` a square (a slower,
   * strained waddle); the shavings' fog holds `holdMs` (its loop twice) while the table and stumps swap in under it. Every other beat
   * is the art's own frames (characters/timber-intro.ts, shops/timber-intro-art.ts). He swings `clear` squares from the table's middle
   * (his `clear.boss`: a tenth further out than the others' 2.6, as his stump's roots spread wider than a stool).
   */
  log: { at: 3.3, lineLeadMs: 800, walkMs: 420, carryMs: 600, holdMs: 960, clear: 2.7 },
  /**
   * Wrangler's own (Nov 4; Eric's design: "he spins his lasso overhead, throws it at the corner, and yanks the hay bale with the board
   * on it into the middle… Then he crosses his arms and throws two ropes at once, one each way, off screen. He yanks, and a white bucket
   * and a black bucket come tumbling in from either side and land upside down as the stools"; the art's timeline, intro-pig-nov4.md).
   * After his line he spins (`spinMs`); throws (his art's frames): the loop leaves his hand on the throw's release frame and flies to
   * the bale on the board's stand over `flyMs`, `flyArc` squares up at its top; it drops over it and cinches (its frames); he yanks,
   * and `yankLeadMs` in the bale slides to the table's place over `slideMs` (eased in and out, a curve whose control point is `bend`,
   * a column and row: down the west side, swung east, behind him), and lands (its frames); `freeAfterMs` on, the loop is flicked free
   * (its frames) and the line reels in to his hand over `reelMs`. The cross throw (his frames): both ropes fly out each way from its
   * release frame over `offMs` (`offArc` squares up), to just off the screen's edges; on the double yank's first heave the buckets
   * tumble in along the floor from there (`tumbleMs`, eased, `tumbleSouth` squares in front of the table's row, to the stools' places)
   * and land upside down (their frames); the knots come untied and the ropes reel in (`reelMs`); his brag (his frames); his attack.
   * About 12 s from the marks to the wipe.
   */
  rope: { spinMs: 1000, flyMs: 440, flyArc: 1.1, yankLeadMs: 100, slideMs: 1600, bend: [5, 9], freeAfterMs: 200, reelMs: 200, offMs: 400, offArc: 0.8, tumbleMs: 760, tumbleSouth: 0.4 },
  /**
   * Hollow's own (Nov 3; Eric's design: "the darkness ball in his belly powers up… It sucks in the light: the lanterns go out one by
   * one, the bulb string's lights are drawn in toward him, light from everything around, even from your own chest piece… Everything goes
   * black. It does NOT all switch back on: darkness everywhere, and a dim, steady light around you, the board and him"; approved with his
   * changes, docs/decisions/2026-11-03-hollow-intro.md). You both walk on to your seats; his line (`lineMs`, a short one); a pause; the
   * table pops in, still lit (the default's `popMs`, `tableHoldMs`); he charges (`chargeMs`), his channel line over his head for
   * `chantMs`; he swells (his art's frames); he drinks the light: the `drain`'s beats as drawn (ms from the drink's start: the lanterns
   * far to near, the string west to east, the tree, his own strand a third at a time, your pawn, full), every gap times `pace` (Eric:
   * "15% faster"); full (`fullMs`); the blackout and the black (the art's INTRO_HOLLOW_DARK); the dim light (`dimMs`, coming up over the
   * art's INTRO_HOLLOW_DIMPOOL.inMs while he settles); the pool closes in on the board (`irisMs`); the match comes up out of the dark
   * (`outMs`). About 15 s from the marks to the board.
   */
  dark: {
    lineMs: 1800,
    chantMs: 2500,
    chargeMs: 2200,
    pace: 0.85,
    drain: { lanterns: [140, 740, 1340, 1840, 2340], string: 2940, stringMs: 1800, tree: 4840, strand: [5540, 5690, 5840], pawn: 6040, end: 6740 },
    /** The lanterns in the order they go out (far to near, the nearest last: the art's call 1), each its column and row in his cave. */
    lanterns: [[9, 5], [11, 8], [9, 11], [17, 12], [13, 16]],
    /** A lantern's share of the dark comes on from this far into its going out, over this long (the art's mockup). */
    lanternDarkAfter: 340,
    lanternDarkMs: 400,
    /** Your pawn's light: a pale glow gathers on it (`pawnGlowMs`) and is drawn off over the rest of `pawnMs`; the pawn greys a touch from `pawnTintAfter` in, over `pawnMs`. */
    pawnMs: 500,
    pawnGlowMs: 150,
    pawnTintAfter: 100,
    /** Your name tag fades as the drain starts (the art's call 10). */
    tagMs: 300,
    fullMs: 700,
    dimMs: 1300,
    /** His eyes in the black fade out over this long as the dim light comes up. */
    eyesOutMs: 400,
    irisMs: 600,
    /** The match screen comes up out of the dark (a fade from black) over this long, once the battle shows. */
    outMs: 600,
    /** The ball's violet glow pulses slowly (0.85 to 1): `sin(t / pulseMs)`. */
    pulseMs: 90,
    /** At most one sip a gap, and one tick along the string (else a buzz). */
    sipGapMs: 80,
    tinkGapMs: 80,
    /**
     * The motes of light (the art's suggestion): `perLantern` from each lantern `every` ms apart from `lead` into its going out; one from
     * each lit bulb as it goes dark; `tree` up the tree `treeEvery` apart, then `star` from its star from `starAt`, `starEvery` apart; one
     * from each of his bulbs, `strandEvery` apart; `pawn` from yours from `pawnLead`, `pawnEvery` apart. Each flies `ms` + `msPerPx` a
     * screen pixel (held between `minMs` and `maxMs`) on a curve bowing up by `bow` of its length, eased in (`ease`: it speeds up into
     * the ball), a soft glow `glowPx` of its pixels round it (`glowA`), and a trail of glows where it was `trail` ms before (`trailA`); a
     * sip (`sipMs`) where every other one lands. Drawn at least `minScale` times its pixels.
     */
    mote: {
      perLantern: 8,
      lead: 40,
      every: 75,
      tree: 16,
      treeEvery: 55,
      star: 3,
      starAt: 880,
      starEvery: 60,
      strandEvery: 12,
      pawn: 6,
      pawnLead: 60,
      pawnEvery: 70,
      ms: 380,
      msPerPx: 1.6,
      minMs: 450,
      maxMs: 1000,
      bow: 0.28,
      ease: 1.7,
      glowPx: 5,
      glowA: 0.5,
      trail: [30, 60, 90],
      trailA: [0.45, 0.28, 0.14],
      sipMs: 150,
      minScale: 1.2,
    },
  },
} as const;

// ---- The flow, from the card's tap to the battle.

/**
 * Where a challenge is: in the town; walking to the home's door (you and the boss); going in (the zoom and the fade, the room
 * loading); walking in to the marks; the intro (the line, the board coming in); the storm sweeping in; covered (the battle
 * loading under it); the storm sliding out over the battle; the battle.
 */
export type ChallengeFlow = "town" | "toDoor" | "goingIn" | "walkIn" | "intro" | "stormIn" | "covered" | "stormOut" | "battle";
export type ChallengeEvent = "fight" | "atDoor" | "inside" | "onMarks" | "introDone" | "stormCovers" | "battleReady" | "stormGone" | "cancel";

const NEXT: Readonly<Partial<Record<ChallengeFlow, Partial<Record<ChallengeEvent, ChallengeFlow>>>>> = {
  town: { fight: "toDoor" },
  toDoor: { atDoor: "goingIn", cancel: "town" },
  goingIn: { inside: "walkIn", cancel: "town" },
  walkIn: { onMarks: "intro", cancel: "town" },
  intro: { introDone: "stormIn", cancel: "town" },
  stormIn: { stormCovers: "covered" },
  covered: { battleReady: "stormOut" },
  stormOut: { stormGone: "battle" },
};
/**
 * The flow after `e` (anything out of turn changes nothing). Going back out ("cancel": the back button, a tap away on the walk to
 * the door, the room not loading) works until the storm starts; from then on the battle is coming.
 */
export function nextFlow(s: ChallengeFlow, e: ChallengeEvent): ChallengeFlow {
  return NEXT[s]?.[e] ?? s;
}

// ---- The marks: where you and the boss stand at the battle circle's table, and its stools.

type Sq = { c: number; r: number };
export interface Marks {
  layout: IntroLayout;
  /** Where each stands (on its mark's middle: half a square between two squares, along the table's axis's cross). */
  you: Sq;
  boss: Sq;
  /** The squares each walks to (the one nearer the door; then the last half square onto its middle: `settleMs`). */
  youSq: Sq;
  bossSq: Sq;
  /** Where the board comes in: the circle's middle, halfway between you. */
  table: Sq;
  /** The table's two stools, one at each player's side (nothing on the empty sides): the boss's and yours. */
  bossStool: Sq;
  youStool: Sq;
  /**
   * Where each stands once the stools are in (the little hop back, CHALLENGE_FEEL.clear): across, a clear step outside its stool,
   * on the same row; facing, its mark (the stools stand between you and the table there).
   */
  youClear: Sq;
  bossClear: Sq;
  /** The way each faces, standing: 1 the screen's right (east), -1 its left; null facing north or south (the sprite as it walked). */
  youFace: 1 | -1 | null;
  bossFace: 1 | -1 | null;
}
/** A room's drawn start marks, the boss's west and yours east (column, row of each middle), as its art exports them (Big Boy's). */
export interface DrawnMarks {
  boss: readonly [number, number];
  you: readonly [number, number];
}
/**
 * Where you, the boss, the table and its stools are in a room (its battle circle's middle: the box round its `circle-*` or `ring-*`
 * floor and its emblem; `clearOff` south of it when a piece stands there, as Babur's pedestal does), by layout; null for a room
 * without a circle. The circles' drawn start marks (Alfil's and Puddles') are where the layout puts you (a unit test keeps them so).
 * A room whose art exports its marks (`drawn`: Big Boy's, west and east) has you stand on them across, the table halfway between.
 */
/** The numbers `marksOf` places you, the boss and the stools by (CHALLENGE_FEEL's, or a boss's own clear place: `marksFeel`). */
export interface MarksFeel {
  standOff: { readonly across: number; readonly facing: number };
  stoolOff: number;
  clearOff: number;
  clear: { readonly you: number; readonly boss: number };
  log: { readonly clear: number };
}
export function marksOf(layout: readonly ShopPlace[], how: IntroLayout, drawn?: DrawnMarks | null, feel: Omit<MarksFeel, "log"> = CHALLENGE_FEEL): Marks | null {
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (const p of layout) {
    if (!/^(circle|ring|emblem)-/.test(p.name)) continue;
    c0 = Math.min(c0, p.col);
    c1 = Math.max(c1, p.col);
    r0 = Math.min(r0, p.row);
    r1 = Math.max(r1, p.row);
  }
  if (c0 > c1) return null;
  const table = { c: (c0 + c1) / 2, r: (r0 + r1) / 2 };
  // (A piece in the circle's middle squares: the table goes in front of it, south.)
  const inMiddle = (p: ShopPlace) => p.solid && p.col <= Math.ceil(table.c) && p.col + (p.w ?? 1) - 1 >= Math.floor(table.c) && p.row >= Math.floor(table.r) && p.row - (p.d ?? 1) + 1 <= Math.ceil(table.r);
  if (layout.some(inMiddle)) table.r += feel.clearOff;
  const d = feel.standOff[how];
  const k = feel.stoolOff;
  const across = how === "across";
  const art = across && drawn ? drawn : null;
  if (art) [table.c, table.r] = [(art.boss[0] + art.you[0]) / 2, (art.boss[1] + art.you[1]) / 2];
  const boss = art ? { c: art.boss[0], r: art.boss[1] } : across ? { c: table.c - d, r: table.r } : { c: table.c, r: table.r - d };
  const you = art ? { c: art.you[0], r: art.you[1] } : across ? { c: table.c + d, r: table.r } : { c: table.c, r: table.r + d };
  // (Each comes up from the door, south: to the mark's south square, the boss on the west of you, so neither crosses the other.)
  return {
    layout: how,
    you,
    boss,
    youSq: { c: Math.ceil(you.c), r: Math.ceil(you.r) },
    bossSq: { c: Math.floor(boss.c), r: Math.ceil(boss.r) },
    table,
    bossStool: across ? { c: table.c - k, r: table.r } : { c: table.c, r: table.r - k },
    youStool: across ? { c: table.c + k, r: table.r } : { c: table.c, r: table.r + k },
    youClear: across ? { c: table.c + Math.max(feel.clear.you, you.c - table.c), r: you.r } : you,
    bossClear: across ? { c: table.c - Math.max(feel.clear.boss, table.c - boss.c), r: boss.r } : boss,
    youFace: across ? -1 : null,
    bossFace: across ? 1 : null,
  };
}

/**
 * A seated intro's marks (BossIntro `seated`, Hollow's): you both walk on straight to where you sit, the clear places, and stand
 * there (the squares each walks to, then the last part of a square onto it, as onto a mark): nothing to hop back from.
 */
export function seatedMarks(m: Marks): Marks {
  return { ...m, you: m.youClear, boss: m.bossClear, youSq: { c: Math.ceil(m.youClear.c), r: Math.ceil(m.youClear.r) }, bossSq: { c: Math.floor(m.bossClear.c), r: Math.ceil(m.bossClear.r) } };
}

/**
 * The board on the table, as each side sees it: where a square's middle is on the table (x east, z north, in squares of the board
 * from its middle: -3.5 to 3.5) for a file (0 the a-file) and rank (0 white's back rank). White's (yours) nearest you, black's
 * (the boss's) nearest it; the a-file on your left. Across (you east, facing west): the ranks run east to west, the a-file nearest
 * the camera (south). Facing (you south, facing north): the ranks run south to north, the a-file west.
 */
export function boardSquare(how: IntroLayout, file: number, rank: number): { x: number; z: number } {
  return how === "across" ? { x: 3.5 - rank, z: file - 3.5 } : { x: file - 3.5, z: rank - 3.5 };
}

// ---- The intro's timeline: from when you face each other on the marks.

/** A pyramid's animations (Alfil's): each frame's ms (its `rise`, `idle`, `crack`, `crumble`), and the crumble frame the table shows on. */
export interface PyramidAnims {
  rise: readonly number[];
  idle: readonly number[];
  crack: readonly number[];
  crumble: readonly number[];
  /** The crumble frame (from 0) whose middle is clear: the table and its board show from it on (the art's "table" cue). */
  tableFrame: number;
}
/**
 * Toy blocks' animations (Big Boy's; Eric, Nov 2: "6 toy blocks drop down and stack to form a 3,2,1 pyramid formation, and the board
 * then plops on top. Then 2 more blocks drop for the chairs"): each frame's ms and cue (the art's) for the table building itself
 * (`build`), the board landing on its top block (`plop`: the code drops the board, `boardDropMs`, so it touches down on its first
 * frame) and the two stools dropping in (`chairs`).
 */
export interface BlocksAnims {
  build: readonly number[];
  plop: readonly number[];
  chairs: readonly number[];
  cues: { readonly build: readonly (string | undefined)[]; readonly plop: readonly (string | undefined)[]; readonly chairs: readonly (string | undefined)[] };
}
/** Timber's moves (characters/timber-intro.ts BOSS_BEAVER_INTRO): his empty-handed waddle, the heave, the carry, the set-down, his gnaw, his dusting off. */
export const LOG_MOVES = ["walk", "lift", "carry", "setDown", "gnaw", "done"] as const;
export type LogMove = (typeof LOG_MOVES)[number];
/** The props' animations Timber's intro plays (shops/timber-intro-art.ts): the log's gnawing, the shavings' fog, a stump's pop. */
export type LogProp = "gnawed" | "rise" | "hold" | "settle" | "pop";
/**
 * Timber's log (Nov 3; CHALLENGE_FEEL.log): each frame's ms and cue (the art's) for his moves and the props', and two places from his
 * art, in squares: `reach`, how far east of his foot the log stands as he sets it down and gnaws it (TIMBER_INTRO_REACH: he works
 * that far west of the table's middle, so the log stands on it), and `back`, how far west his dusting off steps him (his `done`).
 */
export interface LogAnims {
  moves: { readonly [m in LogMove]: readonly number[] };
  props: { readonly [p in LogProp]: readonly number[] };
  cues: { readonly [m in LogMove | LogProp]: readonly (string | undefined)[] };
  reach: number;
  back: number;
}
/** A picture's animations, as LogAnims needs them (characters/sprite.ts Character's: each frame's ms and cue, and its layers' parts and x). */
type ArtLike = { anims: Readonly<Record<string, { frames: readonly { ms: number; cue?: string; layers: readonly { part: string; x: number }[] }[] } | undefined>> };
/**
 * Timber's LogAnims from his art (shops/timber-intro-art.ts): his moves (`mover`, BOSS_BEAVER_INTRO), the log's gnawing, the fog, a
 * stump's pop, and his `reach` (TIMBER_INTRO_REACH), `perSq` of his pixels a square. His dusting off's step back: the way his foot's
 * layer moves from his still to the move's last frame.
 */
export function logAnims(w: { mover: ArtLike; log: ArtLike; fog: ArtLike; stump: ArtLike; reach: readonly [number, number] }, perSq: number): LogAnims {
  const fr = (ch: ArtLike, a: string) => ch.anims[a]!.frames;
  const msOf = (ch: ArtLike, a: string) => fr(ch, a).map((f) => f.ms);
  const cuesOf = (ch: ArtLike, a: string) => fr(ch, a).map((f) => f.cue);
  const footX = (f: { layers: readonly { part: string; x: number }[] }) => f.layers.find((l) => l.part.startsWith("foot"))?.x ?? 0;
  const done = fr(w.mover, "done");
  const of = <T>(get: (m: LogMove) => T) => Object.fromEntries(LOG_MOVES.map((m) => [m, get(m)])) as Record<LogMove, T>;
  return {
    moves: of((m) => msOf(w.mover, m)),
    props: { gnawed: msOf(w.log, "gnawed"), rise: msOf(w.fog, "rise"), hold: msOf(w.fog, "hold"), settle: msOf(w.fog, "settle"), pop: msOf(w.stump, "pop") },
    cues: { ...of((m) => cuesOf(w.mover, m)), gnawed: cuesOf(w.log, "gnawed"), rise: cuesOf(w.fog, "rise"), hold: cuesOf(w.fog, "hold"), settle: cuesOf(w.fog, "settle"), pop: cuesOf(w.stump, "pop") },
    reach: w.reach[0] / perSq,
    back: (footX(fr(w.mover, "idle")[0]!) - footX(done[done.length - 1]!)) / perSq,
  };
}
/** Hollow's moves (characters/hollow-intro.ts BOSS_HOLLOW_INTRO): the ball charging, swelling, drinking the light, full, settling back. */
export const DARK_MOVES = ["charge", "swell", "drink", "full", "settle"] as const;
export type DarkMove = (typeof DARK_MOVES)[number];
/**
 * Hollow's darkness (Nov 3; CHALLENGE_FEEL.dark), from his art (shops/hollow-intro-art.ts): each frame's ms and cue for his moves, a
 * lantern going out (`gutter`, INTRO_HOLLOW_LANTERN_OUT) and the tree (`tree`, INTRO_HOLLOW_SHOWPIECE_OUT's drain); a lantern's light
 * on each gutter frame (INTRO_HOLLOW_LANTERN_GLOW); how many bulbs the string's run has (INTRO_HOLLOW_BULB_RUN); the dark's steps, the
 * blackout and the black, his eyes in it (INTRO_HOLLOW_DARK); how long the dim light takes to come up (INTRO_HOLLOW_DIMPOOL).
 */
export interface DarkAnims {
  moves: { readonly [m in DarkMove]: readonly number[] };
  cues: { readonly [m in DarkMove | "gutter" | "tree"]: readonly (string | undefined)[] };
  gutter: readonly number[];
  tree: readonly number[];
  glow: readonly number[];
  bulbs: number;
  steps: { readonly lantern: number; readonly string: number; readonly tree: number; readonly strand: number; readonly pawn: number };
  blackoutMs: number;
  blackMs: number;
  eyesAlpha: number;
  poolInMs: number;
}
/** Hollow's DarkAnims from his art (shops/hollow-intro-art.ts's exports, as named there). */
export function darkAnims(w: {
  mover: ArtLike;
  lantern: ArtLike;
  tree: ArtLike;
  glow: readonly number[];
  run: readonly unknown[];
  dark: { steps: DarkAnims["steps"]; blackoutMs: number; blackMs: number; eyesAlpha: number };
  pool: { inMs: number };
}): DarkAnims {
  const fr = (ch: ArtLike, a: string) => ch.anims[a]!.frames;
  const of = <T>(get: (m: DarkMove) => T) => Object.fromEntries(DARK_MOVES.map((m) => [m, get(m)])) as Record<DarkMove, T>;
  return {
    moves: of((m) => fr(w.mover, m).map((f) => f.ms)),
    cues: { ...of((m) => fr(w.mover, m).map((f) => f.cue)), gutter: fr(w.lantern, "gutter0").map((f) => f.cue), tree: fr(w.tree, "drain").map((f) => f.cue) },
    gutter: fr(w.lantern, "gutter0").map((f) => f.ms),
    tree: fr(w.tree, "drain").map((f) => f.ms),
    glow: w.glow,
    bulbs: w.run.length,
    steps: w.dark.steps,
    blackoutMs: w.dark.blackoutMs,
    blackMs: w.dark.blackMs,
    eyesAlpha: w.dark.eyesAlpha,
    poolInMs: w.pool.inMs,
  };
}
/** Wrangler's moves (characters/pig-intro.ts BOSS_PIG_INTRO): the spin, the throw, the yank, the cross throw, the double yank, the brag. */
export const ROPE_MOVES = ["spin", "throw", "yank", "crossThrow", "doubleYank", "brag"] as const;
export type RopeMove = (typeof ROPE_MOVES)[number];
/** His props' animations (shops/pig-intro-art.ts): the loop's flight, catch and flick free; the bale's slide and landing; a bucket's tumble and its landing (`drop`). */
export const ROPE_GEAR = ["fly", "catch", "free", "slide", "land", "tumble", "drop"] as const;
export type RopeGear = (typeof ROPE_GEAR)[number];
/**
 * Wrangler's lasso (Nov 4; CHALLENGE_FEEL.rope): each frame's ms and cue (the art's) for his moves and his props', and the frame each
 * throw's rope leaves his sprite and becomes the code's (PIG_INTRO_RELEASE).
 */
export interface RopeAnims {
  moves: { readonly [m in RopeMove]: readonly number[] };
  gear: { readonly [g in RopeGear]: readonly number[] };
  cues: { readonly [k in RopeMove | RopeGear]: readonly (string | undefined)[] };
  release: { readonly throw: number; readonly crossThrow: number };
}
/** Wrangler's RopeAnims from his art (shops/pig-intro-art.ts): his moves, the loop, the bale (the table) and a bucket. */
export function ropeAnims(w: { mover: ArtLike; rope: ArtLike; table: ArtLike; bucket: ArtLike; release: { throw: number; crossThrow: number } }): RopeAnims {
  const fr = (ch: ArtLike, a: string) => ch.anims[a]!.frames;
  const of = <K extends string, T>(keys: readonly K[], get: (k: K) => T) => Object.fromEntries(keys.map((k) => [k, get(k)])) as Record<K, T>;
  const gearOf = (g: RopeGear): readonly { ms: number; cue?: string }[] =>
    g === "fly" || g === "catch" || g === "free" ? fr(w.rope, g) : g === "slide" || g === "land" ? fr(w.table, g) : fr(w.bucket, g === "tumble" ? "tumble" : "land");
  return {
    moves: of(ROPE_MOVES, (m) => fr(w.mover, m).map((f) => f.ms)),
    gear: of(ROPE_GEAR, (g) => gearOf(g).map((f) => f.ms)),
    cues: { ...of(ROPE_MOVES, (m) => fr(w.mover, m).map((f) => f.cue)), ...of(ROPE_GEAR, (g) => gearOf(g).map((f) => f.cue)) },
    release: w.release,
  };
}
/** A boss's own art's animations: a pyramid (Alfil's), toy blocks (Big Boy's), a log (Timber's), the dark (Hollow's) or the lasso (Wrangler's). */
export type IntroAnims = PyramidAnims | BlocksAnims | LogAnims | DarkAnims | RopeAnims;
export const isBlocks = (a: IntroAnims): a is BlocksAnims => "build" in a;
export const isLog = (a: IntroAnims): a is LogAnims => "props" in a;
export const isDark = (a: IntroAnims): a is DarkAnims => "gutter" in a;
export const isRope = (a: IntroAnims): a is RopeAnims => "release" in a;
/**
 * The intro's steps. Timber's own (a log): "toLog" (he walks west to it, his line still over his head), "lift", "carry" (to the middle),
 * "setDown", "gnaw", the shavings' "rise", "hold" (the table and stumps swap in under it) and "settle", the stumps' "pop", "dust" (his
 * `done`: he dusts off his paws) and "toMark" (he walks to where he swings). Hollow's own (the dark): after the table, "charge",
 * "swell", "drink" (the drain), "full", "blackout", "black", "dim" (the dim light, his settle) and "iris" (the pool closing on the board).
 * Wrangler's own (the lasso): after the line, "spin", "throw", "catch" (the loop flying to the bale and cinching), "drag" (the yank and the
 * bale's slide), "land" (it lands; the loop flicked free, the line reeled in), "cross" (the cross throw), "haul" (the double yank), "stools"
 * (the buckets tumbling in and landing, the ropes reeled in) and "brag", then the attack.
 */
export type IntroStep =
  | "face" | "line" | "pause" | "rise" | "idle" | "crack" | "crumble" | "build" | "drop" | "plop" | "chairs" | "pop" | "table" | "swing" | "done"
  | "toLog" | "lift" | "carry" | "setDown" | "gnaw" | "hold" | "settle" | "dust" | "toMark"
  | "charge" | "swell" | "drink" | "full" | "blackout" | "black" | "dim" | "iris"
  | "spin" | "throw" | "catch" | "drag" | "land" | "cross" | "haul" | "stools" | "brag";
export interface IntroBeat {
  step: IntroStep;
  at: number;
  end: number;
}
const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);
type BeatFeel = Pick<
  typeof CHALLENGE_FEEL,
  "faceMs" | "lineMs" | "afterLineMs" | "holdMs" | "gapMs" | "tableHoldMs" | "boardDropMs" | "popMs" | "swingMs" | "stormInMs" | "flashMs" | "wipeMs" | "log" | "standOff" | "clear" | "dark" | "rope"
>;
/** Hollow's drain, ms from the drink's start (CHALLENGE_FEEL.dark.drain as drawn, every gap times `pace`). */
export function drainAt(feel: Pick<typeof CHALLENGE_FEEL, "dark"> = CHALLENGE_FEEL) {
  const D = feel.dark;
  const k = (ms: number) => Math.round(ms * D.pace);
  return {
    lanterns: D.drain.lanterns.map(k),
    string: k(D.drain.string),
    stringMs: k(D.drain.stringMs),
    tree: k(D.drain.tree),
    strand: D.drain.strand.map(k),
    pawn: k(D.drain.pawn),
    end: k(D.drain.end),
  };
}
/**
 * Timber's walks, in squares: from his mark west to the log, carrying it from there to where he works (`reach` west of the table's
 * middle), and from where his dusting off leaves him to where he swings (`log.clear` from the middle). His mark is `standOff.across`
 * from the middle (his room's drawn marks are: a unit test keeps them so).
 */
export function logWalks(a: LogAnims, feel: Pick<typeof CHALLENGE_FEEL, "log" | "standOff" | "clear"> = CHALLENGE_FEEL): { toLog: number; carry: number; toMark: number } {
  return { toLog: feel.log.at - feel.standOff.across, carry: feel.log.at - a.reach, toMark: feel.log.clear - a.reach - a.back };
}
/** The feel the marks are found with (`marksOf`): Timber's log intro has its own clear place for him (`log.clear`), every other the shared one. */
export const marksFeel = (a: IntroAnims | null, feel: MarksFeel = CHALLENGE_FEEL, own?: number): MarksFeel =>
  own !== undefined ? { ...feel, clear: { ...feel.clear, boss: own } } : a && isLog(a) ? { ...feel, clear: { ...feel.clear, boss: feel.log.clear } } : feel;
/** How long the boss's transition takes to cover the screen (ms): its own storm's sweep, or the default's flash and wipe. */
export const coverMs = (custom: boolean, feel: Pick<typeof CHALLENGE_FEEL, "stormInMs" | "flashMs" | "wipeMs"> = CHALLENGE_FEEL): number =>
  custom ? feel.stormInMs : feel.flashMs + feel.wipeMs;
/**
 * The beats, from when you both stand on your marks (Eric, Nov 2: "slowly walk up to the chessboard, then say your line, then the
 * tiles drop down, then the seats drop down. Add a little delay between these things"): facing each other a moment, the line alone,
 * a pause; then the board coming in, a step at a time: Alfil's pyramid rising, holding, cracking, crumbling (the table inside);
 * Big Boy's blocks stacking, a gap, the board dropping and plopping on, a gap, the stools dropping in; the default's table popping
 * in; then the table on its own a beat, and the attack swung (`swingMs` until the transition has covered the screen); then done
 * (the transition starts).
 */
export function introBeats(a: IntroAnims | null, feel: BeatFeel = CHALLENGE_FEEL): IntroBeat[] {
  const out: IntroBeat[] = [];
  let t = 0;
  const add = (step: IntroStep, ms: number) => {
    out.push({ step, at: t, end: t + ms });
    t += ms;
  };
  add("face", feel.faceMs);
  if (a && isRope(a)) {
    // Wrangler's own: his line; the spin; the throw (the loop flies from its release frame and cinches round the bale); the yank and
    // the drag; the bale lands, the loop flicked free and reeled in; the cross throw; the double yank, the buckets tumbling in on its
    // first heave and landing as the stools, the ropes reeled in; his brag; the attack. (No pause after the line: the art's 2.8 s.)
    const R = feel.rope;
    const M = a.moves;
    const G = a.gear;
    add("line", feel.lineMs);
    add("spin", R.spinMs);
    add("throw", sum(M.throw));
    add("catch", sum(M.throw.slice(0, a.release.throw)) + R.flyMs + sum(G.catch) - sum(M.throw));
    add("drag", R.yankLeadMs + R.slideMs);
    add("land", R.freeAfterMs + sum(G.free) + R.reelMs);
    add("cross", sum(M.crossThrow));
    add("haul", sum(M.doubleYank));
    add("stools", M.doubleYank[0]! + R.tumbleMs + sum(G.drop) + R.reelMs - sum(M.doubleYank));
    add("brag", sum(M.brag));
    add("swing", Math.max(0, feel.swingMs - coverMs(true, feel)));
    out.push({ step: "done", at: t, end: Infinity });
    return out;
  }
  if (a && isDark(a)) {
    // Hollow's own: his line, a pause, the table pops in while it's still lit and stands a beat; then the ball charges, swells and
    // drinks the light; full; the blackout, the black; the dim light; the iris to the board. (No attack: the dark is his transition.)
    const D = feel.dark;
    add("line", D.lineMs);
    add("pause", feel.afterLineMs);
    add("pop", feel.popMs);
    add("table", feel.tableHoldMs);
    add("charge", D.chargeMs);
    add("swell", sum(a.moves.swell));
    add("drink", drainAt(feel).end);
    add("full", D.fullMs);
    add("blackout", a.blackoutMs);
    add("black", a.blackMs - a.blackoutMs);
    add("dim", D.dimMs);
    add("iris", D.irisMs);
    out.push({ step: "done", at: t, end: Infinity });
    return out;
  }
  if (a && isLog(a)) {
    // Timber's own: his line, and while it still shows he sets off west for the log; he heaves it up, carries it to the middle, sets
    // it down, gnaws it; the shavings boil up, hold (the table and stumps swap in under them) and settle; the stumps pop up; he dusts
    // off his paws and walks to where he swings; the attack. (No table beat on its own: he's walking away from it.)
    const w = logWalks(a, feel);
    add("line", feel.log.lineLeadMs);
    add("toLog", Math.round(w.toLog * feel.log.walkMs));
    add("lift", sum(a.moves.lift));
    add("carry", Math.round(w.carry * feel.log.carryMs));
    add("setDown", sum(a.moves.setDown));
    add("gnaw", sum(a.props.gnawed));
    add("rise", sum(a.props.rise));
    add("hold", feel.log.holdMs);
    add("settle", sum(a.props.settle));
    add("pop", sum(a.props.pop));
    add("dust", sum(a.moves.done));
    add("toMark", Math.round(w.toMark * feel.log.walkMs));
    add("swing", Math.max(0, feel.swingMs - coverMs(true, feel)));
    out.push({ step: "done", at: t, end: Infinity });
    return out;
  }
  add("line", feel.lineMs);
  add("pause", feel.afterLineMs);
  if (!a) add("pop", feel.popMs);
  else if (isBlocks(a)) {
    add("build", sum(a.build));
    add("pause", feel.gapMs);
    add("drop", feel.boardDropMs);
    add("plop", sum(a.plop));
    add("pause", feel.gapMs);
    add("chairs", sum(a.chairs));
  } else {
    add("rise", sum(a.rise));
    add("idle", feel.holdMs);
    add("crack", sum(a.crack));
    add("crumble", sum(a.crumble));
  }
  add("table", feel.tableHoldMs);
  add("swing", Math.max(0, feel.swingMs - coverMs(!!a, feel)));
  out.push({ step: "done", at: t, end: Infinity });
  return out;
}
/** The intro's whole length (ms): when its transition starts. */
export const introLength = (beats: readonly IntroBeat[]): number => beats[beats.length - 1]!.at;
/** When a step starts (its first beat), ms into the intro. */
const stepAt = (beats: readonly IntroBeat[], s: IntroStep): number => beats.find((x) => x.step === s)!.at;

/** The frame (from 0) showing `t` ms into an animation of these frames: looping, or held on its last. */
export function frameAt(ms: readonly number[], t: number, loop: boolean): number {
  const total = sum(ms);
  if (!ms.length || total <= 0) return 0;
  let u = loop ? ((t % total) + total) % total : Math.max(0, t);
  for (let i = 0; i < ms.length; i++) {
    if (u < ms[i]!) return i;
    u -= ms[i]!;
  }
  return ms.length - 1;
}

/** What shows `t` ms into the intro. */
export interface IntroNow {
  step: IntroStep;
  /** The pyramid's animation and frame (null: none shows: before it rises, once it's crumbled, or the default intro). */
  pyramid: { anim: "rise" | "idle" | "crack" | "crumble"; frame: number } | null;
  /** Toy blocks' animation and frame (null: none shows: before they drop in, or another boss's intro); `idle` once it's all built. */
  blocks: { anim: "build" | "plop" | "chairs" | "idle"; frame: number } | null;
  /** How far above its place on the table the board is, in squares (toy blocks: it drops on; 0 for every other intro). */
  drop: number;
  /** The table's stools show (with the table; toy blocks: from when they drop in). */
  stools: boolean;
  /** The boss's line is over its head (its own beat, alone). */
  line: boolean;
  /** The table and its board show (from the crumble's clear frame on; toy blocks: from the board's drop; the default: from its pop on). */
  table: boolean;
  /** The crumble's last frame (the low drift of sand) lies over the table's foot: kept, as the art allows, until the storm. */
  drift: boolean;
  /** The default's pop: how far the table has grown in (0 to 1; 1 once in, and always for a boss's own art). */
  pop: number;
  /** The default's dust puff round the table's foot: how far through it is (0 to 1), or -1: none. */
  puff: number;
  /** The hop back clear of the stools (CHALLENGE_FEEL.clear): how far from the mark to the clear place (0 to 1, eased)... */
  back: number;
  /** ...and how high in it (0 to 1: 1 at its top, `hopUp` squares). */
  hop: number;
  /** Timber's own intro (his log, gnawed into the table): what he and the props show now; null for every other intro. */
  wood: WoodNow | null;
  /** The boss's channel line is over its head (Hollow's, from his charge's start for `dark.chantMs`). */
  chant: boolean;
  /** Hollow's own intro (the dark): what the light and he do now; null for every other intro. */
  dark: DarkNow | null;
  /** Wrangler's own intro (the lasso): what he, his ropes, the bale and the buckets do now; null for every other intro. */
  rope: RopeNow | null;
}
/**
 * Wrangler's intro `t` ms in (CHALLENGE_FEEL.rope): his move, his ropes, the bale with the board and the buckets. Nobody walks: he and
 * you stand where you walked on to, clear of the stools, from the start to the end.
 */
export interface RopeNow {
  /** His own move and frame (BOSS_PIG_INTRO, as drawn: not mirrored), or null: his idle (his town figure's frames, as drawn). */
  move: { anim: RopeMove; frame: number } | null;
  /** The lasso's loop: flying to the bale (`u` 0 his hand to 1 the bale), dropping over it, cinched round it, flicked free; null: none. */
  lasso: { anim: "fly" | "catch" | "cinched" | "free"; frame: number; u: number } | null;
  /** The loop's line reeling in to his hand once it's free (0 to 1); -1: none. */
  reel: number;
  /** The bale with the board (null: not yet: the room's own board stand stands there): `u` along its drag (0 the stand, 1 the table's place), its animation and frame. */
  bale: { u: number; anim: "idle" | "slide" | "land"; frame: number } | null;
  /** The two ropes thrown out each way: how far out (0 to 1), or -1: not thrown (or reeled in). */
  out: number;
  /** The buckets: `u` along their tumble (0 just off the screen's edge, 1 at the stools' places), their animation and frame; null: not yet. */
  buckets: { u: number; anim: "tumble" | "drop" | "stool"; frame: number } | null;
  /** The ropes on the buckets' handles (tied, until their knots come untied as they land), then reeling in (0 to 1); -1: none. */
  tied: boolean;
  reel2: number;
}
/** Wrangler's intro `t` ms in (his beats, `introBeats`): see RopeNow. */
export function ropeAt(beats: readonly IntroBeat[], a: RopeAnims, t: number, feel: Pick<typeof CHALLENGE_FEEL, "rope"> = CHALLENGE_FEEL): RopeNow {
  const R = feel.rope;
  const M = a.moves;
  const G = a.gear;
  const at = (s: IntroStep) => stepAt(beats, s);
  const me = (anim: RopeMove, ms: number, loop: boolean) => ({ anim, frame: frameAt(M[anim], ms, loop) });
  let move: RopeNow["move"] = null;
  if (t >= at("spin") && t < at("throw")) move = me("spin", t - at("spin"), true);
  else if (t >= at("throw") && t < at("drag")) move = me("throw", t - at("throw"), false);
  else if (t >= at("drag") && t < at("land")) move = me("yank", t - at("drag"), true);
  else if (t >= at("cross") && t < at("haul")) move = me("crossThrow", t - at("cross"), false);
  else if (t >= at("haul") && t < at("brag")) move = me("doubleYank", t - at("haul"), false);
  else if (t >= at("brag") && t < at("swing")) move = me("brag", t - at("brag"), false);
  // The loop: from its release, flying; on the bale, its catch; cinched through the drag; flicked free; its line reeled in.
  const fly = ropeTimes(beats, a, feel);
  let lasso: RopeNow["lasso"] = null;
  if (t >= fly.release && t < fly.arrive) lasso = { anim: "fly", frame: frameAt(G.fly, t - fly.release, true), u: (t - fly.release) / R.flyMs };
  else if (t >= fly.arrive && t < fly.arrive + sum(G.catch)) lasso = { anim: "catch", frame: frameAt(G.catch, t - fly.arrive, false), u: 1 };
  else if (t >= fly.arrive && t < fly.free) lasso = { anim: "cinched", frame: 0, u: 1 };
  else if (t >= fly.free && t < fly.freed) lasso = { anim: "free", frame: frameAt(G.free, t - fly.free, false), u: 1 };
  const reel = t >= fly.freed && t < fly.freed + R.reelMs ? (t - fly.freed) / R.reelMs : -1;
  // The bale: at the stand from the yank (the room's own hidden), sliding, landing in the middle, standing there.
  let bale: RopeNow["bale"] = null;
  if (t >= at("drag")) {
    if (t < fly.slide) bale = { u: 0, anim: "idle", frame: 0 };
    else if (t < at("land")) bale = { u: smooth(ramp(t, fly.slide, R.slideMs)), anim: "slide", frame: frameAt(G.slide, t - fly.slide, true) };
    else if (t < at("land") + sum(G.land)) bale = { u: 1, anim: "land", frame: frameAt(G.land, t - at("land"), false) };
    else bale = { u: 1, anim: "idle", frame: 0 };
  }
  // The ropes out each way, the buckets tumbling in on them and landing upside down, the knots untied, the ropes reeled in.
  const out = t < fly.out ? -1 : t < fly.untie + R.reelMs ? ramp(t, fly.out, R.offMs) : -1;
  let buckets: RopeNow["buckets"] = null;
  if (t >= fly.tumble) {
    if (t < fly.land) buckets = { u: smooth(ramp(t, fly.tumble, R.tumbleMs)), anim: "tumble", frame: frameAt(G.tumble, t - fly.tumble, true) };
    else if (t < fly.land + sum(G.drop)) buckets = { u: 1, anim: "drop", frame: frameAt(G.drop, t - fly.land, false) };
    else buckets = { u: 1, anim: "stool", frame: 0 };
  }
  return { move, lasso, reel, bale, out, buckets, tied: t >= fly.out && t < fly.untie, reel2: t >= fly.untie && t < fly.untie + R.reelMs ? (t - fly.untie) / R.reelMs : -1 };
}
/**
 * When things happen in Wrangler's intro (ms in): the loop leaves his hand (`release`), lands on the bale (`arrive`), the bale starts
 * sliding (`slide`), the loop's flicked free (`free`, `freed` once its frames are done); the ropes fly out (`out`), the buckets start
 * tumbling in (`tumble`: the double yank's first heave), land (`land`) and come untied (`untie`: the knot gone from their landing's
 * third frame).
 */
export function ropeTimes(beats: readonly IntroBeat[], a: RopeAnims, feel: Pick<typeof CHALLENGE_FEEL, "rope"> = CHALLENGE_FEEL) {
  const R = feel.rope;
  const M = a.moves;
  const G = a.gear;
  const at = (s: IntroStep) => stepAt(beats, s);
  const release = at("throw") + sum(M.throw.slice(0, a.release.throw));
  const arrive = release + R.flyMs;
  const free = at("land") + R.freeAfterMs;
  const tumble = at("haul") + M.doubleYank[0]!;
  const land = tumble + R.tumbleMs;
  return {
    release,
    arrive,
    slide: at("drag") + R.yankLeadMs,
    free,
    freed: free + sum(G.free),
    out: at("cross") + sum(M.crossThrow.slice(0, a.release.crossThrow)),
    tumble,
    land,
    untie: land + sum(G.drop.slice(0, 2)),
  };
}
/**
 * Hollow's intro `t` ms in: what he plays and what the light does (CHALLENGE_FEEL.dark; the art's INTRO_HOLLOW_DARK and _DIMPOOL).
 * Only the light changes once the drain starts: nobody moves from their place and nothing new appears (the motes are the light).
 */
export interface DarkNow {
  /** His own move and frame (BOSS_HOLLOW_INTRO), or null: his town figure (his idle) before the charge and once he has settled. */
  move: { anim: DarkMove; frame: number } | null;
  /** His strand's bulbs still lit, in thirds (3 all, 0 none: HOLLOW_LOOKS `bulbs3` to `bulbs0`). */
  bulbs: number;
  /** Each lantern (in `dark.lanterns`' order): ms into its going out (-1: still lit; at or past its `gutter`'s length: out), and its light (1 lit, 0 out). */
  lanterns: { since: number; glow: number }[];
  /** How many of the string's bulbs (INTRO_HOLLOW_BULB_RUN, in its order) have gone dark. */
  run: number;
  /** The tree: its drain's frame (-1: still lit; its frames' count: dark), and how far its light has gone (0 to 1). */
  tree: { frame: number; out: number };
  /** Your pawn: how grey it has gone (0 to 1), and the pale glow gathering on it and drawn off (0 to 1). */
  pawn: { tint: number; glow: number };
  /** Your name tag's alpha (it fades as the drain starts). */
  tag: number;
  /** The dark laid over the room (0 to 1), and how far the blackout has come (0 to 1: everything's light gone from then on). */
  level: number;
  black: number;
  /** His eyes in the black (alpha): two dim violet slits. */
  eyes: number;
  /** The dim light: how far it has come up (0 to 1), and how far it has closed in on the board (0 to 1). */
  pool: number;
  iris: number;
}
/**
 * A cave light's strength in Hollow's intro now (`dn`; null: no intro, the cave as it always is: 1): a lantern's (its place in
 * `dark.lanterns`), a bulb piece's share still lit (`out` of its `of` bulbs dark; the backdrop's all gone with its first, its candle
 * too), the tree's; any other light as it is. None from the blackout on.
 */
export function caveLight(dn: DarkNow | null, role: { lantern: number } | { out: number; of: number; backdrop: boolean } | "tree" | null): number {
  if (!dn) return 1;
  let m = 1;
  if (role === "tree") m = 1 - dn.tree.out;
  else if (role && "lantern" in role) m = dn.lanterns[role.lantern]!.glow;
  else if (role) m = role.backdrop && role.out > 0 ? 0 : 1 - role.out / Math.max(1, role.of);
  return m * (1 - dn.black);
}
const ramp = (t: number, from: number, ms: number) => Math.min(1, Math.max(0, (t - from) / Math.max(1, ms)));
const smooth = (u: number) => u * u * (3 - 2 * u);
/** Hollow's intro `t` ms in (his beats, `introBeats`): see DarkNow. */
export function darkAt(beats: readonly IntroBeat[], a: DarkAnims, t: number, feel: Pick<typeof CHALLENGE_FEEL, "dark"> = CHALLENGE_FEEL): DarkNow {
  const D = feel.dark;
  const at = (s: IntroStep) => beats.find((x) => x.step === s)!.at;
  const drink = at("drink");
  const d = drainAt(feel);
  const gutterMs = sum(a.gutter);
  const lanterns = d.lanterns.map((ms) => {
    const since = t - (drink + ms);
    return since < 0 ? { since: -1, glow: 1 } : { since, glow: since >= gutterMs ? 0 : (a.glow[frameAt(a.gutter, since, false)] ?? 0) };
  });
  const S = drink + d.string;
  const run = t < S ? 0 : Math.min(a.bulbs, Math.floor(((t - S) / Math.max(1, d.stringMs)) * a.bulbs) + 1);
  const T = drink + d.tree;
  const treeMs = sum(a.tree);
  const tree = t < T ? { frame: -1, out: 0 } : { frame: t - T >= treeMs ? a.tree.length : frameAt(a.tree, t - T, false), out: ramp(t, T, treeMs) };
  const strandOut = d.strand.filter((ms) => t >= drink + ms).length;
  const P = drink + d.pawn;
  const glow = t < P ? 0 : t < P + D.pawnGlowMs ? ramp(t, P, D.pawnGlowMs) : 1 - ramp(t, P + D.pawnGlowMs, D.pawnMs - D.pawnGlowMs);
  const st = a.steps;
  const lit =
    st.lantern * d.lanterns.reduce((s, ms) => s + ramp(t, drink + ms + D.lanternDarkAfter, D.lanternDarkMs), 0) +
    st.string * ramp(t, S, d.stringMs) +
    st.tree * tree.out +
    st.strand * (strandOut / d.strand.length) +
    st.pawn * ramp(t, P, D.pawnMs);
  const black = ramp(t, at("blackout"), a.blackoutMs);
  const dim = at("dim");
  // His moves: charging, swelling, drinking (looping), full through the black, settling in the dim light; his idle before and after.
  let move: DarkNow["move"] = null;
  const M = a.moves;
  if (t >= at("charge") && t < at("swell")) move = { anim: "charge", frame: frameAt(M.charge, t - at("charge"), true) };
  else if (t >= at("swell") && t < drink) move = { anim: "swell", frame: frameAt(M.swell, t - at("swell"), false) };
  else if (t >= drink && t < at("full")) move = { anim: "drink", frame: frameAt(M.drink, t - drink, true) };
  else if (t >= at("full") && t < dim) move = { anim: "full", frame: frameAt(M.full, t - at("full"), true) };
  else if (t >= dim && t < dim + sum(M.settle)) move = { anim: "settle", frame: frameAt(M.settle, t - dim, false) };
  return {
    move,
    bulbs: 3 - strandOut,
    lanterns,
    run,
    tree,
    pawn: { tint: t < P ? 0 : ramp(t, P + D.pawnTintAfter, D.pawnMs), glow },
    tag: 1 - ramp(t, drink, D.tagMs),
    level: Math.min(1, lit + (1 - lit) * black),
    black,
    eyes: black > 0 ? black * a.eyesAlpha * (1 - ramp(t, dim, D.eyesOutMs)) : 0,
    pool: ramp(t, dim, a.poolInMs),
    iris: smooth(ramp(t, at("iris"), D.irisMs)),
  };
}
/** Where Timber's foot is through his intro: his mark, the log, where he works (`reach` west of the table's middle), a step back from there (`back`), where he swings (the boss's clear place). */
export type LogPlace = "mark" | "log" | "work" | "stepped" | "clear";
export interface WoodNow {
  /** His own move and frame, mirrored (`flip`: walking west) or not (facing east, the art's way); null: his town figure (on his mark for the line's start, or swinging at the end). */
  move: { anim: LogMove | "idle"; frame: number; flip: boolean } | null;
  /** His foot `u` (0 to 1) of the way from one place to the next (the room puts the places on its floor). */
  from: LogPlace;
  to: LogPlace;
  u: number;
  /** The log on its own: lying where it waits (until he lifts it), or standing and gnawed in front of him on the table's place (until the fog hides it); null: in his paws, or gone. */
  log: { anim: "lying" | "standing" | "gnawed"; frame: number } | null;
  /** The shavings' fog (null: none), and its last frame lying round the table's foot from then on (`ring`, a ring of shavings, kept until the sweep). */
  fog: { anim: "rise" | "hold" | "settle"; frame: number } | null;
  ring: boolean;
  /** The stumps, a seat at each side of the table (null: not yet): popping up out of the floor, then standing. */
  stumps: { anim: "pop" | "idle"; frame: number } | null;
}
const easeOutBack = (u: number) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
/**
 * When you and the boss hop back clear of the stools, ms into the intro: as they come in (the default's pop; Big Boy's stools
 * starting to drop; Alfil's table showing through the crumble).
 */
export function hopStart(beats: readonly IntroBeat[], a: IntroAnims | null): number {
  // (Hollow's and Wrangler's: you walked on to your seats, or clear of them; nothing to hop back from.)
  if (a && (isDark(a) || isRope(a))) return Infinity;
  if (!a || isLog(a)) return stepAt(beats, "pop");
  if (isBlocks(a)) return stepAt(beats, "chairs");
  return stepAt(beats, "crumble") + sum(a.crumble.slice(0, a.tableFrame));
}
/**
 * Timber's intro `t` ms in (his log): on his mark (his town figure) through the line's lead; walking west to the log (mirrored); heaving
 * it up (the lying log hidden from the heave's first frame: it's in his paws, his own frames); carrying it east to where he works;
 * setting it down (the standing log on its own from the set-down's last frame, the art's first without it in his paws); gnawing it (the
 * log's own gnawing, his gnaw looping) and on through the fog's rise; under the fog's hold the log is gone (the table and stumps are
 * in: `introAt`), he stands; it settles, its last frame (a ring of shavings) kept; the stumps pop up; he dusts off his paws; he walks
 * west to where he swings (mirrored); then his town figure again (its attack).
 */
export function woodAt(beats: readonly IntroBeat[], a: LogAnims, t: number): WoodNow {
  const at = (s: IntroStep) => beats.find((x) => x.step === s)!;
  const u = (s: IntroStep) => {
    const b = at(s);
    return Math.min(1, Math.max(0, (t - b.at) / Math.max(1, b.end - b.at)));
  };
  const me = (anim: LogMove | "idle", frame: number, flip = false) => ({ anim, frame, flip });
  const lastOf = (ms: readonly number[]) => ms.length - 1;
  const none = { log: null, fog: null, ring: false, stumps: null };
  const stand = { ...none, ring: true, stumps: { anim: "idle" as const, frame: 0 } };
  const gnawFrame = () => frameAt(a.moves.gnaw, t - at("gnaw").at, true);
  if (t < at("toLog").at) return { ...none, move: null, from: "mark", to: "mark", u: 0, log: { anim: "lying", frame: 0 } };
  if (t < at("lift").at) return { ...none, move: me("walk", frameAt(a.moves.walk, t - at("toLog").at, true), true), from: "mark", to: "log", u: u("toLog"), log: { anim: "lying", frame: 0 } };
  if (t < at("carry").at) return { ...none, move: me("lift", frameAt(a.moves.lift, t - at("lift").at, false)), from: "log", to: "log", u: 0 };
  if (t < at("setDown").at) return { ...none, move: me("carry", frameAt(a.moves.carry, t - at("carry").at, true)), from: "log", to: "work", u: u("carry") };
  if (t < at("gnaw").at) {
    const frame = frameAt(a.moves.setDown, t - at("setDown").at, false);
    return { ...none, move: me("setDown", frame), from: "work", to: "work", u: 0, log: frame === lastOf(a.moves.setDown) ? { anim: "standing", frame: 0 } : null };
  }
  if (t < at("rise").at) return { ...none, move: me("gnaw", gnawFrame()), from: "work", to: "work", u: 0, log: { anim: "gnawed", frame: frameAt(a.props.gnawed, t - at("gnaw").at, false) } };
  if (t < at("hold").at)
    return { ...none, move: me("gnaw", gnawFrame()), from: "work", to: "work", u: 0, log: { anim: "gnawed", frame: lastOf(a.props.gnawed) }, fog: { anim: "rise", frame: frameAt(a.props.rise, t - at("rise").at, false) } };
  if (t < at("settle").at) return { ...none, move: me("idle", 0), from: "work", to: "work", u: 0, fog: { anim: "hold", frame: frameAt(a.props.hold, t - at("hold").at, true) } };
  if (t < at("pop").at) return { ...none, move: me("idle", 0), from: "work", to: "work", u: 0, fog: { anim: "settle", frame: frameAt(a.props.settle, t - at("settle").at, false) } };
  if (t < at("dust").at) return { ...none, ring: true, move: me("idle", 0), from: "work", to: "work", u: 0, stumps: { anim: "pop", frame: frameAt(a.props.pop, t - at("pop").at, false) } };
  if (t < at("toMark").at) return { ...stand, move: me("done", frameAt(a.moves.done, t - at("dust").at, false)), from: "work", to: "work", u: 0 };
  if (t < at("swing").at) return { ...stand, move: me("walk", frameAt(a.moves.walk, t - at("toMark").at, true), true), from: "stepped", to: "clear", u: u("toMark") };
  return { ...stand, move: null, from: "clear", to: "clear", u: 0 };
}
export function introAt(beats: readonly IntroBeat[], a: IntroAnims | null, t: number, feel: Pick<typeof CHALLENGE_FEEL, "popMs" | "puffMs" | "dropFrom" | "hopMs" | "lineMs" | "dark" | "rope"> = CHALLENGE_FEEL): IntroNow {
  const b = beats.find((x) => t < x.end) ?? beats[beats.length - 1]!;
  const h = Math.min(1, Math.max(0, (t - hopStart(beats, a)) / feel.hopMs));
  const base = { step: b.step, pyramid: null, blocks: null, drop: 0, drift: false, pop: 1, puff: -1, line: b.step === "line", back: h * h * (3 - 2 * h), hop: h > 0 && h < 1 ? Math.sin(Math.PI * h) : 0, wood: null, chant: false, dark: null, rope: null };
  if (a && isRope(a)) {
    // (Wrangler's: the table in its place once the bale lands; the stools once the buckets have.)
    const T = ropeTimes(beats, a);
    return { ...base, rope: ropeAt(beats, a, t), table: t >= stepAt(beats, "land"), stools: t >= T.land };
  }
  if (a && isLog(a)) {
    // (Timber's line stays its `lineMs` from its beat's start, over his head as he sets off for the log.)
    const line = stepAt(beats, "line");
    return { ...base, line: t >= line && t < line + feel.lineMs, wood: woodAt(beats, a, t), table: t >= stepAt(beats, "hold"), stools: t >= stepAt(beats, "pop") };
  }
  if (!a || isDark(a)) {
    const p = t - stepAt(beats, "pop");
    // (Hollow's: the table pops in as the default's, still lit; his channel line from his charge's start.)
    const dark = a && isDark(a) ? { chant: t >= stepAt(beats, "charge") && t < stepAt(beats, "charge") + feel.dark.chantMs, dark: darkAt(beats, a, t, feel) } : null;
    const shown = p >= 0;
    return { ...base, ...dark, table: shown, stools: shown, pop: shown ? easeOutBack(Math.min(1, p / feel.popMs)) : 0, puff: shown && p < feel.puffMs ? p / feel.puffMs : -1 };
  }
  if (isBlocks(a)) {
    // (Nothing until the blocks drop in; they stack (held built through the gap), the board falls and plops on (held through the
    // gap), the stools drop in, then it all stands.)
    const blocks = (anim: "build" | "plop" | "chairs" | "idle", frame: number) => ({ ...base, blocks: { anim, frame } });
    const drop = beats.find((x) => x.step === "drop")!;
    if (t < stepAt(beats, "build")) return { ...base, table: false, stools: false };
    if (t < drop.at) return { ...blocks("build", frameAt(a.build, t - stepAt(beats, "build"), false)), table: false, stools: false };
    if (t < drop.end) {
      const u = Math.min(1, (t - drop.at) / Math.max(1, drop.end - drop.at));
      return { ...blocks("build", a.build.length - 1), table: true, stools: false, drop: feel.dropFrom * (1 - u * u) };
    }
    const chairs = stepAt(beats, "chairs");
    if (t < chairs) return { ...blocks("plop", frameAt(a.plop, t - drop.end, false)), table: true, stools: false };
    if (t < chairs + sum(a.chairs)) return { ...blocks("chairs", frameAt(a.chairs, t - chairs, false)), table: true, stools: true };
    return { ...blocks("idle", 0), table: true, stools: true };
  }
  const rise = stepAt(beats, "rise");
  const idle = stepAt(beats, "idle");
  const crack = stepAt(beats, "crack");
  const crumble = stepAt(beats, "crumble");
  if (t < rise) return { ...base, table: false, stools: false };
  if (t < idle) return { ...base, pyramid: { anim: "rise", frame: frameAt(a.rise, t - rise, false) }, table: false, stools: false };
  if (t < crack) return { ...base, pyramid: { anim: "idle", frame: frameAt(a.idle, t - idle, true) }, table: false, stools: false };
  if (t < crumble) return { ...base, pyramid: { anim: "crack", frame: frameAt(a.crack, t - crack, false) }, table: false, stools: false };
  if (t < crumble + sum(a.crumble)) {
    const frame = frameAt(a.crumble, t - crumble, false);
    return { ...base, pyramid: { anim: "crumble", frame }, table: frame >= a.tableFrame, stools: frame >= a.tableFrame };
  }
  return { ...base, table: true, stools: true, drift: true };
}
/**
 * The cue each beat starts on, and when. A pyramid: "rumble" as it rises, "crack", "crumble", and "table" on the crumble's clear
 * frame. Toy blocks: the art's own cues on their frames ("block" as each lands, "block-top", "plop" as the board touches down, "stool"
 * as each stool lands), and "drop" as the board starts to fall. The default: "table" as it pops in.
 */
export function introCues(beats: readonly IntroBeat[], a: IntroAnims | null): { cue: string; at: number }[] {
  const at = (s: IntroStep) => stepAt(beats, s);
  if (!a) return [{ cue: "table", at: at("pop") }];
  if (isDark(a)) return darkCues(beats, a);
  if (isRope(a)) return ropeCues(beats, a);
  if (isLog(a)) {
    // (Timber's: each move's and prop's own cues on their frames, through their beats: looping ones over and over to its end.)
    const out: { cue: string; at: number }[] = [];
    const play = (ms: readonly number[], cues: readonly (string | undefined)[], from: number, to: number, loop: boolean) => {
      if (sum(ms) <= 0) return;
      let t = from;
      for (let i = 0; t < to; i = (i + 1) % ms.length) {
        const cue = cues[i];
        if (cue) out.push({ cue, at: t });
        t += ms[i]!;
        if (!loop && i === ms.length - 1) break;
      }
    };
    const M = a.moves;
    const P = a.props;
    const C = a.cues;
    play(M.lift, C.lift, at("lift"), at("carry"), false);
    play(M.setDown, C.setDown, at("setDown"), at("gnaw"), false);
    // (His teeth's sounds while he gnaws, not the log's own: one sound a bite.)
    play(M.gnaw, C.gnaw, at("gnaw"), at("rise"), true);
    play(P.rise, C.rise, at("rise"), at("hold"), false);
    play(P.hold, C.hold, at("hold"), at("settle"), true);
    play(P.settle, C.settle, at("settle"), at("pop"), false);
    play(P.pop, C.pop, at("pop"), at("dust"), false);
    play(M.done, C.done, at("dust"), at("toMark"), false);
    return out;
  }
  if (isBlocks(a)) {
    const out: { cue: string; at: number }[] = [];
    const frames = (anim: "build" | "plop" | "chairs") => {
      let t = at(anim);
      a[anim].forEach((ms, i) => {
        const cue = a.cues[anim][i];
        if (cue) out.push({ cue, at: t });
        t += ms;
      });
    };
    frames("build");
    out.push({ cue: "drop", at: at("drop") });
    frames("plop");
    frames("chairs");
    return out;
  }
  return [
    { cue: "rumble", at: at("rise") },
    { cue: "crack", at: at("crack") },
    { cue: "crumble", at: at("crumble") },
    { cue: "table", at: at("crumble") + sum(a.crumble.slice(0, a.tableFrame)) },
  ];
}

/**
 * Wrangler's cues, and when (his intro's beats; CHALLENGE_FEEL.rope): his moves' own on their frames (the spin's whirl each loop, the
 * throw, the yank's heaves each loop, the cross throw's wind-up and its two throws a hair apart, the double yank's heaves, the brag's
 * whirl, tip, laugh, snort and stomp); the loop's catch and snap, and its flick free; the bale's scrape each slide loop and its thunk;
 * the buckets' clatter as they tumble and land, and their thunk (both buckets as one: they tumble in step).
 */
export function ropeCues(beats: readonly IntroBeat[], a: RopeAnims, feel: Pick<typeof CHALLENGE_FEEL, "rope"> = CHALLENGE_FEEL): { cue: string; at: number }[] {
  const at = (s: IntroStep) => stepAt(beats, s);
  const out: { cue: string; at: number }[] = [];
  const play = (ms: readonly number[], cues: readonly (string | undefined)[], from: number, to: number, loop: boolean) => {
    if (sum(ms) <= 0) return;
    let t = from;
    for (let i = 0; t < to; i = (i + 1) % ms.length) {
      const cue = cues[i];
      if (cue) out.push({ cue, at: t });
      t += ms[i]!;
      if (!loop && i === ms.length - 1) break;
    }
  };
  const M = a.moves;
  const G = a.gear;
  const C = a.cues;
  const T = ropeTimes(beats, a, feel);
  play(M.spin, C.spin, at("spin"), at("throw"), true);
  play(M.throw, C.throw, at("throw"), at("drag"), false);
  play(G.catch, C.catch, T.arrive, at("drag"), false);
  play(M.yank, C.yank, at("drag"), at("land"), true);
  play(G.slide, C.slide, T.slide, at("land"), true);
  play(G.land, C.land, at("land"), at("cross"), false);
  play(G.free, C.free, T.free, at("cross"), false);
  play(M.crossThrow, C.crossThrow, at("cross"), at("haul"), false);
  // (Two ropes thrown at once: the second throw's whoosh a hair after the first.)
  const second = out.filter((c) => c.cue === "throw" && c.at >= at("cross")).map((c) => ({ cue: "throw", at: c.at + 40 }));
  out.push(...second);
  play(M.doubleYank, C.doubleYank, at("haul"), at("stools"), false);
  play(G.tumble, C.tumble, T.tumble, T.land, true);
  play(G.drop, C.drop, T.land, at("brag"), false);
  play(M.brag, C.brag, at("brag"), at("swing"), false);
  return out.sort((x, y) => x.at - y.at);
}

/**
 * Hollow's cues, and when (his intro's beats; CHALLENGE_FEEL.dark): the table's pop; his moves' own on their frames (his hum each
 * charge loop, the swell, the hum once a full loop: `deep`, lower); each lantern's flutter and snuff on its gutter's frames; the
 * string's run as it starts, a tick as its bulbs go dark (at most one a `tinkGapMs`); the tree's run and its star on its frames; your
 * pawn's light leaving; the blackout; his settle. (A mote's sip is the room's: when one lands, at most one a `sipGapMs`.)
 */
export function darkCues(beats: readonly IntroBeat[], a: DarkAnims, feel: Pick<typeof CHALLENGE_FEEL, "dark"> = CHALLENGE_FEEL): { cue: string; at: number }[] {
  const at = (s: IntroStep) => stepAt(beats, s);
  const out: { cue: string; at: number }[] = [{ cue: "table", at: at("pop") }];
  const play = (ms: readonly number[], cues: readonly (string | undefined)[], from: number, to: number, loop: boolean, as?: string) => {
    let t = from;
    for (let i = 0; t < to; i = (i + 1) % ms.length) {
      const cue = cues[i];
      if (cue) out.push({ cue: as ?? cue, at: t });
      t += ms[i]!;
      if (!loop && i === ms.length - 1) break;
    }
  };
  const M = a.moves;
  const drink = at("drink");
  const d = drainAt(feel);
  play(M.charge, a.cues.charge, at("charge"), at("swell"), true);
  play(M.swell, a.cues.swell, at("swell"), drink, false);
  for (const ms of d.lanterns) play(a.gutter, a.cues.gutter, drink + ms, Infinity, false);
  out.push({ cue: "drain", at: drink + d.string });
  let tink = -Infinity;
  for (let i = 0; i < a.bulbs; i++) {
    const t = drink + d.string + (i * d.stringMs) / a.bulbs;
    if (t - tink >= feel.dark.tinkGapMs) out.push({ cue: "tink", at: (tink = Math.round(t)) });
  }
  play(a.tree, a.cues.tree, drink + d.tree, Infinity, false);
  out.push({ cue: "pawn", at: drink + d.pawn });
  play(M.full, a.cues.full, at("full"), at("blackout"), true, "deep");
  out.push({ cue: "blackout", at: at("blackout") });
  play(M.settle, a.cues.settle, at("dim"), at("iris"), false);
  return out.sort((x, y) => x.at - y.at);
}

// ---- The boss's attack (its God King attack: its kit's `kingAttack`).

/**
 * When the attack starts, ms into the intro: as it swings (after the table's beat on its own), in place where it stands, clear of
 * its stool (every intro since Nov 2's pacing: `attackTime`'s `inPlace`); `swingMs` before its transition has covered the screen.
 */
export const attackStart = (beats: readonly IntroBeat[]): number => beats.find((x) => x.step === "swing")?.at ?? Infinity;
/**
 * Where its animation is, `t` ms into it: as it plays at the God King (its drop-in, its first lashes), and from the moment it would
 * leap off, its lashes again and again (`lashAt` to `leaveAt`), so it keeps on until the screen is covered. `inPlace` (the default
 * intro: just swinging where it stands, Eric, Nov 2): its lashes only, from the first, again and again (no drop-in, no leap).
 */
export function attackTime(t: number, beat: { lashAt: number; leaveAt: number }, inPlace = false): number {
  if (inPlace) return beat.lashAt + (Math.max(0, t) % (beat.leaveAt - beat.lashAt));
  if (t < beat.leaveAt) return Math.max(0, t);
  return beat.lashAt + ((t - beat.lashAt) % (beat.leaveAt - beat.lashAt));
}

// ---- The storm.

/**
 * The storm's edge (screen x) `t` ms into its sweep: in, the storm fills from the left edge up to the edge with its front just
 * ahead (off the left at the start, off the right once it covers); out, it fills from the edge to the right, its front (mirrored)
 * just behind (the screen covered at the start, clear once the front is off the right).
 */
export function stormEdge(dir: "in" | "out", t: number, ms: number, w: number, front: number): number {
  const p = Math.min(1, Math.max(0, t / ms));
  return dir === "in" ? -front + (w + front) * p : (w + front) * p;
}

// ---- The default transition: a flash, then a wipe to black (Pokémon style).

/**
 * The default transition at `t` ms: the screen flashing white (`flash`, 0 or 1: on or off; `flashes` times over `flashMs`), then
 * black bands wiping in, every other one from the other side (`wipe`: 0 to 1, how far across each has come); covered from then on.
 */
export function wipeAt(t: number, feel: Pick<typeof CHALLENGE_FEEL, "flashes" | "flashMs" | "wipeMs"> = CHALLENGE_FEEL): { flash: number; wipe: number } {
  if (t < feel.flashMs) {
    const k = Math.floor((Math.max(0, t) / feel.flashMs) * feel.flashes * 2);
    return { flash: k % 2 === 0 ? 1 : 0, wipe: 0 };
  }
  const u = Math.min(1, (t - feel.flashMs) / feel.wipeMs);
  return { flash: 0, wipe: u * u * (3 - 2 * u) };
}


/**
 * The intro bubble's size for a boss drawn `bossPx` tall on screen (CHALLENGE_FEEL.bubble): its font, the width its lines wrap at, and
 * `s`, its scale against the old 11 px bubble (its padding, line height, corners and tail grow with it); `gap`, px from his drawn head
 * up to the tail's tip.
 */
export function bubbleSize(bossPx: number, feel: Pick<typeof CHALLENGE_FEEL, "bubble"> = CHALLENGE_FEEL): { font: number; wrap: number; s: number; gap: number } {
  const b = feel.bubble;
  const font = Math.round(Math.min(b.max, Math.max(b.min, bossPx * b.font)));
  return { font, wrap: font * b.wrapEm, s: font / 11, gap: Math.round(bossPx * b.gap) };
}

/**
 * The top of a figure's drawing in its frame (a share of the frame's height, 0 its top): the highest row any of its frames has a
 * pixel in. Its intro bubble sits just over it, not over the frame's head room (`pixels`: each frame's RGBA, `w` × `h`).
 */
export function drawnTop(pixels: readonly ArrayLike<number>[], w: number, h: number): number {
  let top = h;
  for (const d of pixels)
    for (let y = 0; y < top; y++) {
      let hit = false;
      for (let x = 0; x < w && !hit; x++) hit = d[(y * w + x) * 4 + 3]! > 0;
      if (hit) {
        top = y;
        break;
      }
    }
  return top >= h ? 0 : top / h;
}
