/**
 * A boss challenged from the town, Pokémon-gym style (Eric, Nov 2; docs/areas/town-square.md, "Challenging a boss"): you and the
 * boss walk into its home, each to a start mark on its battle circle; it says its challenge line; its own animation brings the
 * board in between you (Alfil: a sand pyramid rises, cracks and crumbles, and his table is inside; Timber: he carries a giant log to
 * the middle and gnaws it into the table); its own transition covers the screen (Alfil: a sandstorm) while the battle loads under it; after the battle, its result screen's "Back to town" puts you where
 * you stood. Pure and light: the town imports it to know which bosses have an intro; the art and the drawing load only when you
 * challenge one (shops/intro.ts). No DOM; tested in packages/app/test/boss-challenge.test.ts.
 *
 * An intro as data (shops/timeline.ts: Alfil's, Big Boy's, Timber's and Smudgy's, shops/intros/<boss>.ts) has its beats there; the
 * timing here (introBeats, introAt, introCues) is the default's and the intros still on their own state machines (Hollow's, Wrangler's,
 * Jefferson's, Ginger's, Dash's, Folio's).
 *
 * A boss without an intro here is challenged as before (the Boss raid screen, its tile picked).
 */
import type { HomeId } from "../world.ts";
import { CREW_SHEETS } from "./grex-crew-sheets.ts";
import type { ShopPlace } from "./room.ts";
import { timelineAt, type Timeline, type TimelineNow } from "./timeline.ts";

/** Jefferson's machine guys' step-off and the dozer's wake (their baked sheets' frames: times and cues), for his intro's cues. */
const CREW_SHEET_CUES = { stepOff: CREW_SHEETS.lift.anims.stepOff, wake: CREW_SHEETS["crew-d"].anims.wake };

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
  /**
   * Its line picked at random each time from these (Jefferson's calls to his crew, Nov 4: `lineOf`), `line` the first; none: `line`
   * every time.
   */
  lines?: readonly string[];
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
  /**
   * Its own camera through the challenge (Ginger, Nov 5: his battle spot is his round igloo's middle, and the challenge camera centred
   * on the table keeps both staircases at the catwalk's ends on a phone: the art's INTRO_GINGER_CAM). None: CHALLENGE_FEEL.cam for
   * its layout, as every other boss's (`introCam`).
   */
  cam?: { readonly south: number; readonly west: number; readonly zoom: number };
  /** What its helpers call out as they come (Ginger's board carriers: "Coming, boss!"), in a bubble over them; none: they're quiet. */
  crewLine?: string;
  /**
   * Met inside, not brought in from the town (Don Dough, Nov 11: the kingpin stays in his back room; his challenge starts from his card
   * there, Town.tsx challengeHere): you both come out through the door from the home's other room, beside each other, and walk to your
   * marks in this one (his front room's pad).
   */
  fromDoor?: true;
}

/**
 * The bosses with an intro: every boss whose home has an inside (shops/shops.ts SHOPS; Nov 2, round 2: "for other bosses they should
 * just be swinging for a few seconds like discussed"). Alfil has his own (his pyramid and sandstorm), Big Boy his (his toy blocks
 * and lollipop swirl, Nov 2), Timber his (Nov 3: his log, gnawed into the table, and his sawdust sweep), Hollow his (Nov 3: the darkness
 * ball drinking the cave's light, the dim light, an iris to the board), Dash his (Nov 5: his four dashes and the clock rush); Babur and
 * Puddles the default.
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
  // (Nov 5, round 3: his own, Eric's design (Nov 3): you both walk to your spots and he says his line; he bolts off four times in a
  // trail of dust and races back each time to toss something onto the spot: the shoe-box table, the board, the pieces with a pop,
  // both stools; his brag; the clock rush. docs/decisions/2026-11-05-dash-intro.md. His line is his entrance's first
  // (characters/dash-lines.ts). You both walk on straight to where you stand, clear of the stools, and stay there (`seated`): he at
  // the spot every toss is drawn from, BLITZ_INTRO_DROP_AT (72 of his pixels, 72 / (104 / 3) squares) west of the table's foot.
  // No God King attack was drawn for him: he stands through its beat.)
  dash: {
    name: "Dash",
    line: "Yo yo yo! Dash in the building, fam!",
    layout: "across",
    custom: true,
    seated: true,
    clear: 2.08,
    // His cues, each a sound: his own whoosh as he bolts and zips back, his sneakers' squeak as he skids, his zip as he tosses, a
    // cardboard thud as the shoe boxes land (the table, the board on it, the stools), the app's soft pop as the pieces appear, his
    // brag's brush (dusting off his jacket) and Tick's ding (the glint as he finger-guns you); the clock rush's whirr as it comes in
    // and its tick.
    cues: {
      whoosh: "dashWhoosh",
      skid: "dashSqueak",
      drop: "dashZip",
      thud: "dashThud",
      pop: "pop",
      brush: "dashBrush",
      ding: "dashDing",
      tick: "dashTick",
      storm: "dashWhirr",
    },
    facesLeft: true,
  },
  // (Nov 5: its own, the art's (intro-folio-nov5.md): in its sanctuary you both walk on to the marks on the clean page and it says its
  // entrance line (characters/folio-lines.ts); you both step back a pace; the stools fold themselves up from flat sheets, then the
  // table; a paper aeroplane brings the board folded flat, banks over the table, drops it and flies off; the board unfolds on the table
  // like a map; it bows and says a quiet line (one of five at random: `chant`); then the screen crumples into a ball over black and
  // opens up as the match (the crumple, crumple-gl.ts). docs/decisions/2026-11-05-folio-home.md. It steps back to 2.3 squares from the
  // table's middle (the art's), you to the usual 2.2. No God King attack in it: the crumple is its transition, as Hollow's dark is his.)
  // (Nov 6: his own, the drop cloth whipped off the table (Eric: "He starts out, he pulls the white tablecloth off … to reveal the
  // board. And the stools can just already be there. It doesn't need to be fancy."), then his reveal line, then the splatter. His line
  // is his battle entrance's first (characters/smudgy.ts SMUDGY_LINES); the reveal line Eric's idea in the director's words. Seated:
  // the stools are there already, so you both walk on straight to your marks beside them and stay. No attack: the splatter is his.)
  smudgy: {
    name: "Smudgy",
    line: "Artist at work. Wet paint!",
    layout: "across",
    custom: true,
    seated: true,
    chant: ["Careful, don't get any paint on the pieces!"],
    // His own sounds (characters/smudgy-sounds.ts): the cloth's whoosh as he whips it off, its soft flop as it lands in a heap, a wet
    // splat for each splat of the splatter (a few, faster and faster), and the brush's swipe that wipes it away.
    cues: { whoosh: "smudgyWhoosh", flop: "smudgyFlop", splat: "smudgySplat", swipe: "smudgySwipe" },
  },
  folio: {
    name: "Folio",
    line: "Every game's a draft. Write one?",
    layout: "across",
    custom: true,
    chant: ["It's quiet in here. Stay as long as you like.", "Come back whenever it gets too loud out there.", "Take your time. The page will wait.", "Think as long as you need. I'm in no hurry.", "Quiet helps. So does a clean page."],
    clear: 2.3,
    // Its cues, each a sound of its own (characters/folio-sounds.ts): its crisp fold for each crease of the stools and the table, a soft
    // tap as each stands (set), the plane's glide in, the packet's soft landing on the table, its soft unfold for each of the board's two
    // flaps, a rustle as it bows; the screen crumpled into a ball and opened out flat.
    cues: { fold: "folioFold", set: "folioSet", whoosh: "folioGlide", land: "folioLand", unfold: "folioUnfold", bow: "folioRustle", crumple: "folioBall", open: "folioOpen" },
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
  // (Nov 4: his own, Eric's design: in his firework warehouse he hollers for his crew, who stop work and come round the table to
  // watch; the floor tile at your mark lifts you level with the board on its crates; his brag; the wipe of sparklers and fireworks.
  // docs/decisions/2026-11-04-jefferson-home.md. His call one of four at random, placeholders until Eric's Gemini lines. You both walk
  // on to the marks and stand there: he stands (no stool), you on your lift.)
  // (Nov 5: his own, Eric's design: in his igloo candy shop he charges his candy-cane staff and blasts the air over the battle spot;
  // an icicle forms in the burst and falls point first, stabbing the floor (a crack, a puff of snow): its round flat top is the table.
  // Two elves come out of the stockroom with the board ("Coming, boss!"), run round behind you and toss it up onto it; he casts and
  // the pieces appear from a small white light; his brag; his attack; the blizzard of snowflakes and candy canes.
  // docs/decisions/2026-11-05-ginger-home.md. His line a placeholder until Eric's Gemini lines. You both walk on to the marks and
  // stand there: no stools (the table is 27 px up, a park table's). His own camera, centred on the table.)
  gingerbread: {
    name: "Ginger",
    line: "Cold enough for you?",
    layout: "across",
    custom: true,
    cam: { south: 0.8, west: 0, zoom: 1 },
    crewLine: "Coming, boss!",
    // His cues, each a sound of his own (characters/gingerbread-sounds.ts): his staff's icy hum as it charges, the blast's frosty zap,
    // his whoosh (the blast flying, the board tossed, the wipe's front), the burst's glassy pop, the ice forming (his crackle), the
    // icicle stabbing the floor (the big crunch-crack), the elves' little steps, their "hup" as they toss, the board's clack on the
    // table, his cast's rising shimmer, the twinkle as the pieces appear, his laugh (his jingle) and his cane's thump; the blizzard's
    // wind and a gust over it. (The table's glint is silent.)
    cues: {
      charge: "gingerCharge",
      blast: "gingerBlast",
      whoosh: "gingerWhoosh",
      burst: "gingerBurst",
      freeze: "gingerCrackle",
      crunch: "gingerStab",
      step: "gingerStep",
      heave: "gingerHeave",
      clack: "gingerClack",
      cast: "gingerCast",
      sparkle: "gingerSparkle",
      laugh: "gingerJingle",
      thump: "gingerThump",
      blizzard: "gingerWind",
      gust: "gingerGust",
      storm: "gingerWhoosh",
    },
  },
  grex: {
    name: "Jefferson",
    line: "Boys! We got a challenger!",
    lines: ["Boys! We got a challenger!", "Take five, everybody. We're playing chess.", "Who wants a fifteen-minute break?", "Forks down, boys. Somebody wants a game."],
    layout: "across",
    custom: true,
    // His cues, each a sound of his own (characters/grex-sounds.ts): his holler (twice), his whoosh as he waves them over, a hoof's
    // clop on the concrete for each step (the crew's walks, the machine guys stepping off), the dozer's startled snort, your lift's
    // hydraulic hiss and its clunk as it locks, the crates creaking (soft as they wobble, louder as your lift clunks home), his brag's
    // laugh (his crackle), sparkler fizz and stomp (his poof); and the wipe's rising whistle, a little pop and a soft, muffled bang.
    cues: {
      shout: "grexShout",
      whoosh: "grexWhoosh",
      step: "grexStep",
      snort: "grexSnort",
      hiss: "grexHiss",
      clunk: "grexClunk",
      creak: "grexCreak",
      creakSoft: "grexCreakSoft",
      laugh: "grexCrackle",
      fizz: "grexFizz",
      stomp: "grexPoof",
      whistle: "grexRocket",
      pop: "grexPopSoft",
      bang: "grexBang",
      // (The wipe's front, a wall of sparkler fizz, as it sweeps in.)
      storm: "grexFizz",
    },
  },
  // (Nov 6: Boingo's Funhouse; no custom intro this round (Eric): the default on his carnival mat, his slide whistle as the wipe.)
  clown: {
    name: "Boingo",
    line: "Step right up! Honk honk!",
    layout: "across",
    custom: false,
    cues: { table: "pop", wipe: "clownSlideUp" },
  },
  // (Nov 11: Don Dough, met in his bakery's back room; the fight in its front room, on the pad: shops/intros/zebra.ts. Played once his
  // boss is in the game, from his card there (shops.ts canChallengeInside); his line the art's battle start. You both walk out of the
  // back door to where you stand (`seated`: no hop back) while his goons carry the table, chairs and board out (zebra-scene.ts
  // SetupScene). His camera centred on the table so the five watching behind it show. His sounds a placeholder until his boss's round.)
  zebra: {
    name: "Don Dough",
    line: "Hope you studied. Pop!",
    layout: "across",
    custom: true,
    seated: true,
    fromDoor: true,
    cam: { south: 0.8, west: 0, zoom: 1 },
    cues: { pop: "pop", wipe: "zebraThump" },
  },
};

/** The boss's intro, or null: challenged as before (no intro yet). */
export const introOf = (id: HomeId): BossIntro | null => BOSS_INTROS[id] ?? null;
/** The room's camera through a boss's challenge: its own (Ginger's), or CHALLENGE_FEEL.cam for its layout. */
export const introCam = (def: BossIntro, layout: IntroLayout = def.layout): { readonly south: number; readonly west: number; readonly zoom: number } => def.cam ?? CHALLENGE_FEEL.cam[layout];
/** Its line this time: one of its `lines` (picked by `rand`: Math.random as the room opens), or its `line`. */
export const lineOf = (def: BossIntro, rand: () => number = Math.random): string =>
  def.lines?.length ? def.lines[Math.min(def.lines.length - 1, Math.floor(rand() * def.lines.length))]! : def.line;
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
   * Jefferson's own (Nov 4; Eric's design: "he hollers for his crew. The crew stop what they're doing and come over… they stand round
   * the table behind, watching… The floor tile at your mark rises on its piston and lifts you level with the board"; the art's
   * timeline, intro-grex-nov4.md). After his line (the shared `lineMs`) he hollers (his `call`); `stopMs` into it the crew stop (the
   * machines park where they are, the guys step off, the dozer wakes); he waves them over (his `waveOver`, `waves` loops); `setOffMs`
   * after the stop they set off for their spots round the table (each after the art's INTRO_GREX_CREW_SETOFF, and the machine guys
   * once off, the dozer once awake), round its north side by these waypoints (`via`, squares, each member's), at `speed` squares a
   * second or faster: each is there by the time your lift locks; `walkMs` after they set off your lift rises (its frames), the
   * crates creak as it locks (theirs); his brag (his frames); his attack. Their steps' clop at most one a `stepGapMs`. About 13 s
   * from the marks to the wipe.
   */
  crew: {
    stopMs: 900,
    waves: 2,
    setOffMs: 400,
    walkMs: 4200,
    speed: 3.2,
    stepGapMs: 90,
    via: {
      "lift-guy": [[5.2, 7.6]],
      "fork-guy": [[13.4, 14], [13.4, 10.6]],
      "leaner-a": [[4.6, 14], [5.2, 10.5]],
      "leaner-b": [[4.8, 15], [5.4, 12], [6.2, 8.9], [10.6, 7.9]],
      "crew-c": [[9.5, 5.8]],
      "crew-d": [[5, 13], [6, 8.6]],
      dealer: [[12.5, 5.6]],
    },
  },
  /**
   * Ginger's own (Nov 5; Eric's design, the art's timeline: intro-ginger-nov5.md). After his line he charges his staff (his `charge`)
   * and blasts (his `blast`): the blast leaves his hook on its release frame and flies `flyMs` to over the table's spot (`blastUp` px
   * up, on an arc `flyArc` px high at its middle), and bursts there; `formAfterMs` into the burst the icicle forms (`fallFrom` px up,
   * the burst's middle), hangs `hangMs`, and falls to the floor over `fallMs`, faster and faster; it stabs in (its `land`, the crack and
   * the puff from its first frame) and from its last it's the table (27 px up). `doorAfterMs` on the stockroom door opens (for
   * `doorOpenMs`); `outAfterMs` after that the two carriers come out with the board and run its route at `carrySpeed` squares a second,
   * their line over them from `lineFrom` for `lineMs`; `tossLeadMs` after they're there they toss it (their `toss`), the board leaving
   * their hands on its let-go frame and flying `boardFlyMs` onto the table (`boardArc` px over the straight line at its middle); they
   * cheer `cheerMs` and walk `toWatchMs` to their watch spots. `castLeadMs` after the board lands he casts (his `cast`): on its light
   * frame the white light appears on the board, shines `shineMs` and fades, the pieces coming in as it fades; `bragLeadMs` on, his
   * brag; his attack. About 13.2 s from the marks to the wipe.
   */
  ice: {
    flyMs: 450,
    blastUp: 120,
    flyArc: 30,
    formAfterMs: 120,
    fallFrom: 70,
    hangMs: 170,
    fallMs: 320,
    doorAfterMs: 260,
    doorOpenMs: 1300,
    outAfterMs: 100,
    carrySpeed: 3.5,
    lineFrom: 200,
    lineMs: 1400,
    tossLeadMs: 400,
    boardFlyMs: 450,
    boardArc: 34,
    cheerMs: 500,
    toWatchMs: 500,
    castLeadMs: 220,
    shineMs: 500,
    bragLeadMs: 150,
  },
  /**
   * Dash's own (Nov 5; Eric's design, Nov 3: "u both walk up to the spots, then he suddenly bolts away leaving a train of dust and then
   * comes back very fast drops the board, then again runs off…"; the art's timeline, intro-blitz-nov3.md). His line (`lineMs`: a short
   * one, as Hollow's); then four dashes, each his `bolt` (his art's frames: his dust trail from its launch frame), `awayMs` out of
   * sight, his `arrive` (what he brought lands on its toss frame: the table's `land`, the board falling `boardDropMs` from `dropFrom`
   * squares as Big Boy's, the pop with the pieces from its own frame, both stools' `land`) and `holdMs` standing; his brag; the
   * attack's beat (none was drawn for him: he stands). About 10 s from his line to the cover (the art's 9.0 s had 0.7 s of standing
   * where every boss's attack beat is 1.4 s, and a 0.9 s line).
   */
  blitz: { lineMs: 1800, awayMs: 200, holdMs: 80 },
  /**
   * Folio's own (Nov 5; the art's timeline, intro-folio-nov5.md, its beats 1 to 5). Its line (`lineMs`); you both step back a pace
   * (`backMs`, eased: it glides, you slide, no hop) to the clear places; `stoolLeadMs` on, the west stool folds up from its sheet (its
   * art's frames), the east one `stoolGapMs` after it, the table `tableAfterMs` after that; `planeAfterMs` after the table stands the
   * plane comes in along its route (the art's INTRO_FOLIO_PLANE_ROUTE: its points and times, eased between), banks over the table and
   * lets the board go; the packet falls to the table's top over `fallMs`; `unfoldLeadMs` on, the board unfolds (its frames), and from
   * then on the game's own board is on the table (the unfolded sheet cross-fading into it over `swapMs`: the game draws its boards
   * tilted toward you, the art's sheet lies flat); `bowAfterMs` on, it bows (its frames) and `quietLeadMs` into its bow says its quiet
   * line for `quietMs`; `crumpleAfterMs` after the line has gone, the crumple. About 11.1 s from the marks to the crumple, 13.4 s to
   * the match; about 15.5 s from just inside the door (the art's 14.9 s from its shorter walk-on).
   *
   * The crumple (`crumple`, the art's CRUMPLE_TIMING: crumple-gl.ts): the screen crumpled over black (`crumpleMs`), held as a ball
   * (`holdMs`; longer while the match loads; once it shows, its picture has `maxHoldMs`, or the ball fades through black onto it instead),
   * opened as the match screen
   * (`openMs`), its creases' shade lingering on the flat match (`lingerMs`). Without WebGL (or if it fails), a cross-fade through black:
   * to black over `fadeMs`, held black while the match loads, up from black over `fadeMs`.
   */
  /**
   * Smudgy's intro (Nov 6): on the marks a beat (`faceMs`), his line (`lineMs`), a pause (`grabMs`) and he whips the cloth off (its
   * art's frames: up, sailing west over him, dropped in a heap); a beat (`revealLeadMs`), his reveal line (`revealMs`), a beat
   * (`afterMs`), then the splatter: splats land, faster and faster (a gap of `firstGapMs` between the first two down to `lastGapMs`),
   * `perSplat` at a time, each `minR` to `maxR` of the screen's shorter side, until `coverMs` (the screen is filled under them then,
   * however many landed); held covered at least `holdMinMs` (longer while the match loads); a brush stroke sweeps it away across the
   * screen over `wipeMs`, its band of paint `strokeW` of the screen wide. Never stuck: every phase goes by the clock.
   */
  smudgy: {
    lineMs: 2500,
    grabMs: 300,
    revealLeadMs: 250,
    revealMs: 2400,
    afterMs: 300,
    splat: { coverMs: 1200, firstGapMs: 150, lastGapMs: 12, perSplat: 2, minR: 0.06, maxR: 0.2, holdMinMs: 250, wipeMs: 500, strokeW: 0.12, splatSounds: 6 },
  },
  folio: {
    lineMs: 2200,
    backMs: 400,
    stoolLeadMs: 50,
    stoolGapMs: 350,
    tableAfterMs: 550,
    planeAfterMs: 340,
    fallMs: 280,
    unfoldLeadMs: 90,
    bowAfterMs: 180,
    quietLeadMs: 100,
    quietMs: 2400,
    crumpleAfterMs: 250,
    swapMs: 250,
    crumple: { crumpleMs: 800, holdMs: 400, openMs: 800, lingerMs: 260, maxHoldMs: 3000, fadeMs: 350 },
  },
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
    // (Folio's clean page, `page-<col>-<row>`, is its battle circle.)
    if (!/^(circle|ring|emblem|page)-/.test(p.name)) continue;
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

/** A picture's animations, as the intros' anims need them (characters/sprite.ts Character's: each frame's ms and cue, and its layers' parts and x). */
type ArtLike = { anims: Readonly<Record<string, { frames: readonly { ms: number; cue?: string; layers: readonly { part: string; x: number }[] }[] } | undefined>> };
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
/** Jefferson's moves (characters/grex-intro.ts BOSS_GREX_INTRO): his call to his crew, waving them over, his brag. */
export const CREW_MOVES = ["call", "waveOver", "brag"] as const;
export type CrewMove = (typeof CREW_MOVES)[number];
/**
 * Jefferson's crew (Nov 4; CHALLENGE_FEEL.crew): each frame's ms and cue (the art's) for his moves, your lift's rise (INTRO_GREX_LIFT)
 * and the crate-stack table's wobbles (INTRO_GREX_TABLE: `tableIdle`, and its bigger `creak` as your lift clunks home).
 */
export interface CrewAnims {
  moves: { readonly [m in CrewMove]: readonly number[] };
  rise: readonly number[];
  creak: readonly number[];
  tableIdle: readonly number[];
  cues: { readonly [k in CrewMove | "rise" | "creak" | "tableIdle"]: readonly (string | undefined)[] };
}
/** Jefferson's CrewAnims from his art (shops/grex-intro-art.ts): his moves, your lift, the table. */
export function crewAnims(w: { mover: ArtLike; lift: ArtLike; table: ArtLike }): CrewAnims {
  const fr = (ch: ArtLike, a: string) => ch.anims[a]!.frames;
  const of = <T>(get: (m: CrewMove) => T) => Object.fromEntries(CREW_MOVES.map((m) => [m, get(m)])) as Record<CrewMove, T>;
  return {
    moves: of((m) => fr(w.mover, m).map((f) => f.ms)),
    rise: fr(w.lift, "rise").map((f) => f.ms),
    creak: fr(w.table, "creak").map((f) => f.ms),
    tableIdle: fr(w.table, "idle").map((f) => f.ms),
    cues: { ...of((m) => fr(w.mover, m).map((f) => f.cue)), rise: fr(w.lift, "rise").map((f) => f.cue), creak: fr(w.table, "creak").map((f) => f.cue), tableIdle: fr(w.table, "idle").map((f) => f.cue) },
  };
}
/** Ginger's moves (characters/ginger-intro.ts BOSS_GINGER_INTRO): his staff charging, its blast, his cast at the board, his brag. */
export const ICE_MOVES = ["charge", "blast", "cast", "brag"] as const;
export type IceMove = (typeof ICE_MOVES)[number];
/** His props' animations (shops/ginger-intro-art.ts): the blast, the icicle, the crack, the puff, the table, the light, the board. */
export const ICE_GEAR = ["fly", "burst", "form", "fall", "land", "crack", "puff", "tableIdle", "appear", "shine", "fade", "spin"] as const;
export type IceGear = (typeof ICE_GEAR)[number];
/** The board carriers' (shops/ginger-elves-art.ts NPC_GINGER_ELF_BOARD_A and _B: the same timing). */
export const ICE_ELF = ["carry", "toss", "cheer", "walk", "idle"] as const;
export type IceElf = (typeof ICE_ELF)[number];
/**
 * Ginger's intro (Nov 5; CHALLENGE_FEEL.ice): each frame's ms and cue (the art's) for his moves, his props and the carriers; the frames
 * things happen on (the blast leaving his hook, the board leaving the carriers' hands, the light starting on the board); and the
 * board's route's length (squares, INTRO_GINGER_BOARD_ROUTE).
 */
export interface IceAnims {
  ice: true;
  moves: { readonly [m in IceMove]: readonly number[] };
  gear: { readonly [m in IceGear]: readonly number[] };
  elf: { readonly [m in IceElf]: readonly number[] };
  cues: { moves: { readonly [m in IceMove]: readonly (string | undefined)[] }; gear: { readonly [m in IceGear]: readonly (string | undefined)[] }; elf: { readonly [m in IceElf]: readonly (string | undefined)[] } };
  key: { blast: number; letGo: number; light: number };
  route: number;
}
/** Ginger's IceAnims from his art: his moves, the props (their animations by ICE_GEAR's names), a carrier, and the route's length. */
export function iceAnims(
  w: { mover: ArtLike; blast: ArtLike; shard: ArtLike; crack: ArtLike; puff: ArtLike; table: ArtLike; light: ArtLike; board: ArtLike; carrier: ArtLike },
  letGo: number,
  route: number,
): IceAnims {
  const where: Record<IceGear, [ArtLike, string]> = {
    fly: [w.blast, "fly"],
    burst: [w.blast, "burst"],
    form: [w.shard, "form"],
    fall: [w.shard, "fall"],
    land: [w.shard, "land"],
    crack: [w.crack, "crack"],
    puff: [w.puff, "puff"],
    tableIdle: [w.table, "idle"],
    appear: [w.light, "appear"],
    shine: [w.light, "shine"],
    fade: [w.light, "fade"],
    spin: [w.board, "spin"],
  };
  const fr = (ch: ArtLike, a: string) => ch.anims[a]!.frames;
  const by = <K extends string, T>(keys: readonly K[], get: (k: K) => T) => Object.fromEntries(keys.map((k) => [k, get(k)])) as Record<K, T>;
  const at = (ch: ArtLike, a: string, cue: string) => Math.max(0, fr(ch, a).findIndex((f) => f.cue === cue));
  return {
    ice: true,
    moves: by(ICE_MOVES, (m) => fr(w.mover, m).map((f) => f.ms)),
    gear: by(ICE_GEAR, (g) => fr(...where[g]).map((f) => f.ms)),
    elf: by(ICE_ELF, (e) => fr(w.carrier, e).map((f) => f.ms)),
    cues: { moves: by(ICE_MOVES, (m) => fr(w.mover, m).map((f) => f.cue)), gear: by(ICE_GEAR, (g) => fr(...where[g]).map((f) => f.cue)), elf: by(ICE_ELF, (e) => fr(w.carrier, e).map((f) => f.cue)) },
    key: { blast: at(w.mover, "blast", "blast"), letGo, light: at(w.mover, "cast", "cast") },
    route,
  };
}
/** Dash's moves (characters/dash-intro.ts BOSS_BLITZ_INTRO): bolting off, racing back with a thing and tossing it onto the table, his brag. */
export const BLITZ_MOVES = ["bolt", "arrive", "brag"] as const;
export type BlitzMove = (typeof BLITZ_MOVES)[number];
/**
 * His four dashes, each a beat named for what he brings back (Eric, Nov 3, the art's order): the shoe-box table, the board, the
 * pieces (with a pop), both stools.
 */
export const BLITZ_DASHES = ["dashTable", "dashBoard", "dashPieces", "dashStools"] as const;
/** His props' animations (shops/blitz-intro-art.ts): the table's and a stool's landing, his dust trail, the pieces' pop. */
export const BLITZ_GEAR = ["table", "stool", "dust", "pop"] as const;
export type BlitzGear = (typeof BLITZ_GEAR)[number];
/**
 * Dash's intro (Nov 5; CHALLENGE_FEEL.blitz): each frame's ms and cue (the art's) for his moves and his props', and the frames things
 * happen on: the bolt's launch (his dust trail starts at his spot; from it he's running, off his spot), the arrive's skid (from it
 * he's back on his spot), its toss (what he brought lands: BLITZ_INTRO_DROP_AT, the
 * table's foot), the pop's (the pieces show).
 */
export interface BlitzAnims {
  blitz: true;
  moves: { readonly [m in BlitzMove]: readonly number[] };
  gear: { readonly [g in BlitzGear]: readonly number[] };
  cues: { readonly [k in BlitzMove | BlitzGear]: readonly (string | undefined)[] };
  key: { whoosh: number; skid: number; drop: number; pieces: number };
}
/** Dash's BlitzAnims from his art: his moves (BOSS_BLITZ_INTRO), the table's and a stool's `land`, the dust trail, the pop. */
export function blitzAnims(w: { mover: ArtLike; table: ArtLike; stool: ArtLike; dust: ArtLike; pop: ArtLike }): BlitzAnims {
  const fr = (ch: ArtLike, a: string) => ch.anims[a]!.frames;
  const by = <K extends string, T>(keys: readonly K[], get: (k: K) => T) => Object.fromEntries(keys.map((k) => [k, get(k)])) as Record<K, T>;
  const gear: Record<BlitzGear, [ArtLike, string]> = { table: [w.table, "land"], stool: [w.stool, "land"], dust: [w.dust, "idle"], pop: [w.pop, "idle"] };
  const at = (ch: ArtLike, a: string, cue: string) => Math.max(0, fr(ch, a).findIndex((f) => f.cue === cue));
  return {
    blitz: true,
    moves: by(BLITZ_MOVES, (m) => fr(w.mover, m).map((f) => f.ms)),
    gear: by(BLITZ_GEAR, (g) => fr(...gear[g]).map((f) => f.ms)),
    cues: { ...by(BLITZ_MOVES, (m) => fr(w.mover, m).map((f) => f.cue)), ...by(BLITZ_GEAR, (g) => fr(...gear[g]).map((f) => f.cue)) },
    key: { whoosh: at(w.mover, "bolt", "whoosh"), skid: at(w.mover, "arrive", "skid"), drop: at(w.mover, "arrive", "drop"), pieces: at(w.pop, "idle", "pop") },
  };
}
/** Folio's moves (characters/folio-intro.ts BOSS_FOLIO_INTRO): the glide (its walk-on and its step back), the bow, its idle. */
export const FOLIO_MOVES = ["glide", "bow", "idle"] as const;
export type FolioMove = (typeof FOLIO_MOVES)[number];
/** The plane's animations (shops/folio-intro-art.ts INTRO_FOLIO_PLANE). */
export const FOLIO_PLANE = ["fly", "bank", "drop", "away"] as const;
export type FolioPlane = (typeof FOLIO_PLANE)[number];
/** A point of the plane's route: [column, row, lift in squares] and when it passes (ms from the plane's start). */
export interface FolioRoutePoint {
  readonly at: readonly [number, number, number];
  readonly ms: number;
}
/**
 * Folio's intro (Nov 5; CHALLENGE_FEEL.folio): each frame's ms and cue (the art's) for its moves, a stool's and the table's folding,
 * the plane's, the board's unfolding; and the plane's route.
 */
export interface FolioAnims {
  folio: true;
  moves: { readonly [m in FolioMove]: readonly number[] };
  stool: readonly number[];
  table: readonly number[];
  plane: { readonly [m in FolioPlane]: readonly number[] };
  unfold: readonly number[];
  cues: { bow: readonly (string | undefined)[]; stool: readonly (string | undefined)[]; table: readonly (string | undefined)[]; unfold: readonly (string | undefined)[] };
  route: readonly FolioRoutePoint[];
}
/** Folio's FolioAnims from its art: its moves (BOSS_FOLIO_INTRO), the stool's and table's `fold`, the plane, the board's `unfold`, the route. */
export function folioAnims(w: { mover: ArtLike; stool: ArtLike; table: ArtLike; plane: ArtLike; board: ArtLike; route: readonly FolioRoutePoint[] }): FolioAnims {
  const ms = (ch: ArtLike, a: string) => ch.anims[a]!.frames.map((f) => f.ms);
  const cues = (ch: ArtLike, a: string) => ch.anims[a]!.frames.map((f) => f.cue);
  return {
    folio: true,
    moves: { glide: ms(w.mover, "glide"), bow: ms(w.mover, "bow"), idle: ms(w.mover, "idle") },
    stool: ms(w.stool, "fold"),
    table: ms(w.table, "fold"),
    plane: { fly: ms(w.plane, "fly"), bank: ms(w.plane, "bank"), drop: ms(w.plane, "drop"), away: ms(w.plane, "away") },
    unfold: ms(w.board, "unfold"),
    cues: { bow: cues(w.mover, "bow"), stool: cues(w.stool, "fold"), table: cues(w.table, "fold"), unfold: cues(w.board, "unfold") },
    route: w.route,
  };
}
/**
 * A boss's own art's animations, for an intro still on its own state machine: the dark (Hollow's), the lasso (Wrangler's), the crew
 * (Jefferson's), the icicle (Ginger's), the dashes (Dash's) or the folding (Folio's). (Alfil's, Big Boy's, Timber's and Smudgy's are
 * data: shops/timeline.ts.)
 */
export type IntroAnims = DarkAnims | RopeAnims | CrewAnims | IceAnims | BlitzAnims | FolioAnims;
export const isFolio = (a: IntroAnims): a is FolioAnims => "folio" in a;
export const isBlitz = (a: IntroAnims): a is BlitzAnims => "blitz" in a;
export const isIce = (a: IntroAnims): a is IceAnims => "ice" in a;
export const isDark = (a: IntroAnims): a is DarkAnims => "gutter" in a;
export const isRope = (a: IntroAnims): a is RopeAnims => "release" in a;
export const isCrew = (a: IntroAnims): a is CrewAnims => "creak" in a && "tableIdle" in a;
/**
 * The intro's steps, for the default's and the intros still on their own state machines (an intro as data names its own beats:
 * shops/intros/<boss>.ts). Hollow's own (the dark): after the table, "charge", "swell", "drink" (the drain), "full", "blackout",
 * "black", "dim" (the dim light, his settle) and "iris" (the pool closing on the board). Wrangler's own (the lasso): after the line,
 * "spin", "throw", "catch" (the loop flying to the bale and cinching), "drag" (the yank and the bale's slide), "land" (it lands; the
 * loop flicked free, the line reeled in), "cross" (the cross throw), "haul" (the double yank), "stools" (the buckets tumbling in and
 * landing, the ropes reeled in) and "brag", then the attack. Jefferson's own (the crew): after the line, "call" (he hollers; the crew
 * stop in it), "wave" (he waves them over), "walk" (they walk round to their spots), "lift" (your lift rises), "creak" (the crates
 * wobble as it locks) and "brag", then the attack.
 */
export type IntroStep =
  | "face" | "line" | "pause" | "pop" | "table" | "swing" | "done"
  | "lift" | "carry"
  | "charge" | "swell" | "drink" | "full" | "blackout" | "black" | "dim" | "iris"
  | "spin" | "throw" | "catch" | "drag" | "land" | "cross" | "haul" | "stools" | "brag"
  | "call" | "wave" | "walk" | "creak"
  | "blast" | "fall" | "stab" | "toss" | "cast"
  | (typeof BLITZ_DASHES)[number]
  | "back" | "fold" | "plane" | "unfold" | "bow" | "quiet";
export interface IntroBeat {
  /** Its step (an intro as data names its own: shops/timeline.ts). */
  step: IntroStep | (string & {});
  at: number;
  end: number;
}
const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);
type BeatFeel = Pick<
  typeof CHALLENGE_FEEL,
  "faceMs" | "lineMs" | "afterLineMs" | "tableHoldMs" | "boardDropMs" | "popMs" | "swingMs" | "stormInMs" | "flashMs" | "wipeMs" | "standOff" | "clear" | "dark" | "rope" | "crew" | "ice" | "blitz" | "folio"
>;
/**
 * When things happen in Ginger's intro (ms from the marks; CHALLENGE_FEEL.ice): his charge and blast; the blast flying and bursting;
 * the icicle forming, falling and stabbing in; the table; the door opening and shutting; the carriers setting off, there, tossing (the
 * board let go and landed), cheering and at their watch spots; his cast, the light's appearing, shining and fading (the pieces in by
 * `lit`); his brag; his attack.
 */
export function iceTimes(a: IceAnims, feel: Pick<typeof CHALLENGE_FEEL, "faceMs" | "lineMs" | "ice"> = CHALLENGE_FEEL) {
  const I = feel.ice;
  const charge = feel.faceMs + feel.lineMs;
  const blast = charge + sum(a.moves.charge);
  const fly = blast + sum(a.moves.blast.slice(0, a.key.blast));
  const burst = fly + I.flyMs;
  const form = burst + I.formAfterMs;
  const fall = form + sum(a.gear.form) + I.hangMs;
  const land = fall + I.fallMs;
  const table = land + sum(a.gear.land);
  const door = table + I.doorAfterMs;
  const setOff = door + I.outAfterMs;
  const arrive = setOff + Math.round((a.route / I.carrySpeed) * 1000);
  const toss = arrive + I.tossLeadMs;
  const letGo = toss + sum(a.elf.toss.slice(0, a.key.letGo));
  const landed = letGo + I.boardFlyMs;
  const cheer = toss + sum(a.elf.toss);
  const toWatch = cheer + I.cheerMs;
  const watching = toWatch + I.toWatchMs;
  const cast = landed + I.castLeadMs;
  const light = cast + sum(a.moves.cast.slice(0, a.key.light));
  const shine = light + sum(a.gear.appear);
  const fade = shine + I.shineMs;
  const lit = fade + sum(a.gear.fade);
  const brag = Math.max(cast + sum(a.moves.cast), lit) + I.bragLeadMs;
  return { charge, blast, fly, burst, form, fall, land, table, door, doorShut: door + I.doorOpenMs, setOff, arrive, toss, letGo, landed, cheer, toWatch, watching, cast, light, shine, fade, lit, brag };
}
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
/** The feel the marks are found with (`marksOf`): a boss's own clear place (`own`: its BossIntro's, or its intro data's: Timber's `log.clear`), every other the shared one. */
export const marksFeel = (_a: IntroAnims | null, feel: MarksFeel = CHALLENGE_FEEL, own?: number): MarksFeel =>
  own !== undefined ? { ...feel, clear: { ...feel.clear, boss: own } } : feel;
/** How long the boss's transition takes to cover the screen (ms): its own storm's sweep, or the default's flash and wipe. */
export const coverMs = (custom: boolean, feel: Pick<typeof CHALLENGE_FEEL, "stormInMs" | "flashMs" | "wipeMs"> = CHALLENGE_FEEL): number =>
  custom ? feel.stormInMs : feel.flashMs + feel.wipeMs;
/**
 * The beats, from when you both stand on your marks (Eric, Nov 2: "slowly walk up to the chessboard, then say your line, then the
 * tiles drop down, then the seats drop down. Add a little delay between these things"): facing each other a moment, the line alone,
 * a pause; then the board coming in (the default's table popping in; a boss's own, as its art plays it); then the table on its own a
 * beat, and the attack swung (`swingMs` until the transition has covered the screen); then done (the transition starts). An intro as
 * data has its own (shops/timeline.ts timelineBeats).
 */
export function introBeats(a: IntroAnims | null, feel: BeatFeel = CHALLENGE_FEEL): IntroBeat[] {
  const out: IntroBeat[] = [];
  let t = 0;
  const add = (step: IntroStep, ms: number) => {
    out.push({ step, at: t, end: t + ms });
    t += ms;
  };
  add("face", feel.faceMs);
  if (a && isFolio(a)) {
    // Folio's own: its line; the step back; the stools folding (and the gap to the table); the table folding (and the gap to the
    // plane); the plane in to the packet landing; the board unfolding (and the gap to the bow); the bow's lead; the quiet line (and
    // the gap to the crumple). No attack: the crumple is its transition.
    const T = folioTimes(a, feel);
    add("line", feel.folio.lineMs);
    add("back", feel.folio.backMs);
    add("stools", T.table - T.stoolW + feel.folio.stoolLeadMs);
    add("fold", T.plane - T.table);
    add("plane", T.land - T.plane);
    add("unfold", T.bow - T.land);
    add("bow", T.quiet - T.bow);
    add("quiet", T.crumple - T.quiet);
    out.push({ step: "done", at: t, end: Infinity });
    return out;
  }
  if (a && isBlitz(a)) {
    // Dash's own: his line; his four dashes (each a bolt off, out of sight, back with a thing tossed onto the table, a beat); his
    // brag; the attack's beat. (No pause after the line: he's off.)
    const T = blitzTimes(a, feel);
    add("line", feel.blitz.lineMs);
    T.dashes.forEach((d, i) => add(BLITZ_DASHES[i]!, d.end - d.at));
    add("brag", sum(a.moves.brag));
    add("swing", Math.max(0, feel.swingMs - coverMs(true, feel)));
    out.push({ step: "done", at: t, end: Infinity });
    return out;
  }
  if (a && isIce(a)) {
    // Ginger's own: his line; the charge; the blast (flying, bursting, the icicle forming and hanging); its fall; its stab (from its
    // last frame the table); the carriers coming with the board; their toss (to the board landing); his cast and the light; his
    // brag; the attack. (No pause after the line: the art's timeline.)
    const T = iceTimes(a, feel);
    add("line", feel.lineMs);
    add("charge", T.blast - T.charge);
    add("blast", T.fall - T.blast);
    add("fall", T.land - T.fall);
    add("stab", T.table - T.land);
    add("carry", T.toss - T.table);
    add("toss", T.landed - T.toss);
    add("cast", T.brag - T.landed);
    add("brag", sum(a.moves.brag));
    add("swing", Math.max(0, feel.swingMs - coverMs(true, feel)));
    out.push({ step: "done", at: t, end: Infinity });
    return out;
  }
  if (a && isCrew(a)) {
    // Jefferson's own: his line; his call (the crew stop `stopMs` into it); his wave over; the crew walking round to their spots
    // (they set off `setOffMs` after the stop; your lift rises `walkMs` after that); your lift rising; the crates' creak as it locks;
    // his brag; the attack. (No pause after the line: the art's 2.6 s.)
    const K = feel.crew;
    const M = a.moves;
    add("line", feel.lineMs);
    add("call", sum(M.call));
    add("wave", sum(M.waveOver) * K.waves);
    // (The walk from the call's end: its start is the call's; your lift rises `walkMs` after they set off.)
    add("walk", Math.max(0, K.stopMs + K.setOffMs + K.walkMs - sum(M.call) - sum(M.waveOver) * K.waves));
    add("lift", sum(a.rise));
    add("creak", sum(a.creak));
    add("brag", sum(M.brag));
    add("swing", Math.max(0, feel.swingMs - coverMs(true, feel)));
    out.push({ step: "done", at: t, end: Infinity });
    return out;
  }
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
  // The default's (an intro as data has its own beats: shops/timeline.ts): the line, a pause, the table pops in.
  add("line", feel.lineMs);
  add("pause", feel.afterLineMs);
  add("pop", feel.popMs);
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
  step: IntroBeat["step"];
  /** The table's stools show (with the table). */
  stools: boolean;
  /** The boss's line is over its head (its own beat, alone). */
  line: boolean;
  /** The table and its board show (the default: from its pop on). */
  table: boolean;
  /** The default's pop: how far the table has grown in (0 to 1; 1 once in, and always for a boss's own art). */
  pop: number;
  /** The default's dust puff round the table's foot: how far through it is (0 to 1), or -1: none. */
  puff: number;
  /** The hop back clear of the stools (CHALLENGE_FEEL.clear): how far from the mark to the clear place (0 to 1, eased)... */
  back: number;
  /** ...and how high in it (0 to 1: 1 at its top, `hopUp` squares). */
  hop: number;
  /** The boss's channel line is over its head (Hollow's, from his charge's start for `dark.chantMs`). */
  chant: boolean;
  /** An intro as data (shops/timeline.ts): every actor now (the boss, you, its props); null for every other intro. */
  cast: TimelineNow["cast"] | null;
  /** Hollow's own intro (the dark): what the light and he do now; null for every other intro. */
  dark: DarkNow | null;
  /** Wrangler's own intro (the lasso): what he, his ropes, the bale and the buckets do now; null for every other intro. */
  rope: RopeNow | null;
  /** Jefferson's own intro (the crew): what he, his crew, your lift and the table do now; null for every other intro. */
  crew: CrewNow | null;
  /** Ginger's own intro (the icicle): what he, his props and the board carriers do now; null for every other intro. */
  ice: IceNow | null;
  /** Dash's own intro (his dashes): what he and his props do now; null for every other intro. */
  blitz: BlitzNow | null;
  /** Folio's own intro (the folding, the plane, the board): what it and its props do now; null for every other intro. */
  folio: FolioNow | null;
}
/** A board carrier in Ginger's intro: where (squares), which way, its animation and frame; null: still in the stockroom. */
export interface CarrierNow {
  c: number;
  r: number;
  face: 1 | -1;
  anim: IceElf;
  frame: number;
}
/** Ginger's intro `t` ms in (CHALLENGE_FEEL.ice): see each field. He and you stand on your marks from the start to the end. */
export interface IceNow {
  /** His own move and frame (BOSS_GINGER_INTRO, as drawn), or null: his idle (his town figure's frames). */
  move: { anim: IceMove; frame: number } | null;
  /** The blast: flying (`u` of its way, 0 to 1) or bursting over the table's spot; null: none. */
  blast: { anim: "fly" | "burst"; frame: number; u: number } | null;
  /** The icicle forming, falling and stabbing in (`lift` px over the floor), before it's the table; null: none. */
  shard: { anim: "form" | "fall" | "land"; frame: number; lift: number } | null;
  /** The table (the icicle stabbed into the floor, its round top 27 px up): its idle's frame; -1: not yet. */
  table: number;
  /** The crack round its foot (cracking, then cracked: it stays); null: not yet. */
  crack: { anim: "crack" | "idle"; frame: number } | null;
  /** The puff of snow at its foot: its frame; -1: none. */
  puff: number;
  /** The stockroom door is open. */
  door: boolean;
  /** The two carriers (A the front, B the back), or null: in the stockroom. */
  carriers: readonly [CarrierNow, CarrierNow] | null;
  /** Their line over them. */
  line: boolean;
  /** The board in their hands or flying (its middle, squares; `lift` px over the floor), or null: on the table (`onTable`) or not out yet. */
  board: { c: number; r: number; lift: number; anim: "carry" | "spin"; frame: number } | null;
  onTable: boolean;
  /** The white light on the board, or null. */
  light: { anim: "appear" | "shine" | "fade"; frame: number } | null;
  /** How far the real pieces have come in (0 to 1). */
  pieces: number;
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** A point `d` squares along a route (held at its ends), into `out`, with the way it goes. */
function onRoute(pts: readonly (readonly [number, number])[], d: number, out: { c: number; r: number; face: 1 | -1 }): void {
  let left = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]!;
    const q = pts[i]!;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (left <= L || i === pts.length - 1) {
      const u = L > 0 ? Math.min(1, left / L) : 1;
      out.c = lerp(p[0], q[0], u);
      out.r = lerp(p[1], q[1], u);
      if (q[0] !== p[0]) out.face = q[0] > p[0] ? 1 : -1;
      return;
    }
    left -= L;
  }
}
/**
 * Ginger's intro `t` ms in (his beats; `iceTimes`). The carriers run the board's `route` (its middle), A `spots.carry.a` squares east
 * of it and B `spots.carry.b`, both facing east; toss at its end (the board on their hands, `hands`' heights by frame, until it's let
 * go), cheer, and walk to their watch spots (`spots.watch`). The board flies from the route's end to the table's spot (`table`), from
 * its let-go height up onto the round top (`top` px), on an arc.
 */
export function iceAt(
  a: IceAnims,
  t: number,
  art: {
    route: readonly (readonly [number, number])[];
    table: readonly [number, number];
    top: number;
    hands: { carry: readonly number[]; toss: readonly (number | null)[] };
    spots: { carry: { a: number; b: number }; watch: { a: { at: readonly [number, number]; face: number }; b: { at: readonly [number, number]; face: number } } };
  },
  feel: Pick<typeof CHALLENGE_FEEL, "faceMs" | "lineMs" | "ice"> = CHALLENGE_FEEL,
): IceNow {
  const I = feel.ice;
  const T = iceTimes(a, feel);
  const M = a.moves;
  const G = a.gear;
  let move: IceNow["move"] = null;
  const mv = (anim: IceMove, from: number) => (t >= from && t < from + sum(M[anim]) ? { anim, frame: frameAt(M[anim], t - from, false) } : null);
  move = mv("charge", T.charge) ?? mv("blast", T.blast) ?? mv("cast", T.cast) ?? mv("brag", T.brag);
  const blast: IceNow["blast"] =
    t >= T.fly && t < T.burst ? { anim: "fly", frame: frameAt(G.fly, t - T.fly, true), u: (t - T.fly) / I.flyMs } : t >= T.burst && t < T.burst + sum(G.burst) ? { anim: "burst", frame: frameAt(G.burst, t - T.burst, false), u: 1 } : null;
  let shard: IceNow["shard"] = null;
  if (t >= T.form && t < T.fall) shard = { anim: "form", frame: frameAt(G.form, t - T.form, false), lift: I.fallFrom };
  else if (t >= T.fall && t < T.land) {
    const u = (t - T.fall) / I.fallMs;
    shard = { anim: "fall", frame: frameAt(G.fall, t - T.fall, true), lift: I.fallFrom * (1 - u * u) };
  } else if (t >= T.land && t < T.table) shard = { anim: "land", frame: frameAt(G.land, t - T.land, false), lift: 0 };
  const crack: IceNow["crack"] = t < T.land ? null : t < T.land + sum(G.crack) ? { anim: "crack", frame: frameAt(G.crack, t - T.land, false) } : { anim: "idle", frame: 0 };
  const puff = t >= T.land && t < T.land + sum(G.puff) ? frameAt(G.puff, t - T.land, false) : -1;
  // The carriers and the board.
  let carriers: IceNow["carriers"] = null;
  let board: IceNow["board"] = null;
  const E = a.elf;
  const end = art.route[art.route.length - 1]!;
  const S = art.spots;
  if (t >= T.setOff) {
    const mid = { c: 0, r: 0, face: 1 as 1 | -1 };
    onRoute(art.route, ((t - T.setOff) / 1000) * I.carrySpeed, mid);
    const pair = (anim: IceElf, frame: number, c: number, r: number): [CarrierNow, CarrierNow] => [
      { c: c + S.carry.a, r, face: 1, anim, frame },
      { c: c + S.carry.b, r, face: 1, anim, frame },
    ];
    if (t < T.toss) {
      // (Running with it, then standing a beat behind the table before the toss: their run's first frame.)
      const running = t < T.arrive;
      const fr = running ? frameAt(E.carry, t - T.setOff, true) : 0;
      carriers = pair("carry", fr, mid.c, mid.r);
      board = { c: mid.c, r: mid.r, lift: art.hands.carry[fr] ?? art.hands.carry[0]!, anim: "carry", frame: 0 };
    } else if (t < T.cheer) {
      const fr = frameAt(E.toss, t - T.toss, false);
      carriers = pair("toss", fr, end[0], end[1]);
      if (t < T.letGo) board = { c: end[0], r: end[1], lift: art.hands.toss[fr] ?? 15, anim: "carry", frame: 0 };
    } else if (t < T.toWatch) carriers = pair("cheer", frameAt(E.cheer, t - T.cheer, true), end[0], end[1]);
    else {
      const u = Math.min(1, (t - T.toWatch) / I.toWatchMs);
      const walk = (from: number, w: { at: readonly [number, number]; face: number }): CarrierNow => {
        const c = lerp(end[0] + from, w.at[0], u);
        return u < 1
          ? { c, r: lerp(end[1], w.at[1], u), face: w.at[0] >= end[0] + from ? 1 : -1, anim: "walk", frame: frameAt(E.walk, t - T.toWatch, true) }
          : { c: w.at[0], r: w.at[1], face: w.face < 0 ? -1 : 1, anim: "idle", frame: frameAt(E.idle, t - T.watching, true) };
      };
      carriers = [walk(S.carry.a, S.watch.a), walk(S.carry.b, S.watch.b)];
    }
    if (t >= T.letGo && t < T.landed) {
      const u = (t - T.letGo) / I.boardFlyMs;
      const from = art.hands.toss[a.key.letGo - 1] ?? 15;
      board = { c: lerp(end[0], art.table[0], u), r: lerp(end[1], art.table[1], u), lift: lerp(from, art.top, u) + Math.sin(Math.PI * u) * I.boardArc, anim: "spin", frame: frameAt(G.spin, t - T.letGo, true) };
    }
  }
  const light: IceNow["light"] =
    t < T.light || t >= T.lit ? null : t < T.shine ? { anim: "appear", frame: frameAt(G.appear, t - T.light, false) } : t < T.fade ? { anim: "shine", frame: frameAt(G.shine, t - T.shine, true) } : { anim: "fade", frame: frameAt(G.fade, t - T.fade, false) };
  return {
    move,
    blast,
    shard,
    table: t >= T.table ? frameAt(G.tableIdle, t - T.table, true) : -1,
    crack,
    puff,
    door: t >= T.door && t < T.doorShut,
    carriers,
    line: t >= T.setOff + I.lineFrom && t < T.setOff + I.lineFrom + I.lineMs,
    board,
    onTable: t >= T.landed,
    light,
    pieces: t < T.fade ? 0 : Math.min(1, (t - T.fade) / Math.max(1, T.lit - T.fade)),
  };
}
/**
 * Ginger's cues, and when (CHALLENGE_FEEL.ice): his moves' own on their frames (the charge's hum, the blast's zap, the cast, the brag's
 * laugh and thump); the blast's whoosh as it flies and its burst; the ice forming; the icicle's crunch as it stabs in; the carriers'
 * steps as they run and walk to watch, their heave; the board's whoosh as it's tossed and its clack as it lands; the light's sparkle.
 */
export function iceCues(a: IceAnims, feel: Pick<typeof CHALLENGE_FEEL, "faceMs" | "lineMs" | "ice"> = CHALLENGE_FEEL): { cue: string; at: number }[] {
  const T = iceTimes(a, feel);
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
  const { moves: M, gear: G, elf: E } = a;
  const C = a.cues;
  play(M.charge, C.moves.charge, T.charge, T.blast, false);
  play(M.blast, C.moves.blast, T.blast, T.fall, false);
  play(G.fly, C.gear.fly, T.fly, T.fly + 1, false);
  play(G.burst, C.gear.burst, T.burst, T.form, false);
  play(G.form, C.gear.form, T.form, T.fall, false);
  play(G.land, C.gear.land, T.land, T.table, false);
  play(E.carry, C.elf.carry, T.setOff, T.arrive, true);
  play(E.toss, C.elf.toss, T.toss, T.cheer, false);
  play(G.spin, C.gear.spin, T.letGo, T.letGo + 1, false);
  out.push({ cue: "clack", at: T.landed });
  play(E.walk, C.elf.walk, T.toWatch, T.watching, true);
  play(M.cast, C.moves.cast, T.cast, T.cast + sum(M.cast), false);
  play(G.appear, C.gear.appear, T.light, T.shine, false);
  play(M.brag, C.moves.brag, T.brag, T.brag + sum(M.brag), false);
  return out.sort((x, y) => x.at - y.at);
}
/**
 * When things happen in Dash's intro (ms from the marks; CHALLENGE_FEEL.blitz): each dash's start (his bolt), its launch (his dust
 * trail from his spot), when he's gone (the bolt's end), back (his arrive's start), the toss (what he brought lands) and its end; the
 * board touching down on the table (it falls `boardDropMs` from `dropFrom` squares, as Big Boy's), the pieces there (the pop's own
 * frame), the brag.
 */
export function blitzTimes(a: BlitzAnims, feel: Pick<typeof CHALLENGE_FEEL, "faceMs" | "blitz" | "boardDropMs"> = CHALLENGE_FEEL) {
  const B = feel.blitz;
  const M = a.moves;
  let t = feel.faceMs + B.lineMs;
  const dashes = BLITZ_DASHES.map(() => {
    const at = t;
    const gone = at + sum(M.bolt);
    const back = gone + B.awayMs;
    const end = back + sum(M.arrive) + B.holdMs;
    t = end;
    return { at, launch: at + sum(M.bolt.slice(0, a.key.whoosh)), gone, back, drop: back + sum(M.arrive.slice(0, a.key.drop)), end };
  });
  const drop = dashes.map((d) => d.drop);
  return { dashes, drop, board: drop[1]! + feel.boardDropMs, pieces: drop[2]! + sum(a.gear.pop.slice(0, a.key.pieces)), brag: t };
}
/**
 * Dash's intro `t` ms in (his beats): his move, his dust trail, the table, the board, the pieces' pop, the stools. He stands where he
 * walked on to all through (his `clear` place, BLITZ_INTRO_DROP_AT west of the table's foot), as you do: every bolt leaves from it and
 * every arrive ends on it.
 */
export interface BlitzNow {
  /** His own move and frame (BOSS_BLITZ_INTRO, as drawn: facing you), or null: his town figure, standing. */
  move: { anim: BlitzMove; frame: number } | null;
  /** He's off, out of sight (from his bolt's end to his arrive's start): none of him shows. */
  gone: boolean;
  /**
   * He stands on his spot (not mid-run: his bolt before its launch, his arrive from its skid, his brag, standing): all of him on the
   * screen (Eric, Nov 4), and the town's shadows under him.
   */
  here: boolean;
  /** The dust trail's frame at his spot (INTRO_BLITZ_DUST, from the bolt's launch), or -1: none. */
  dust: number;
  /** The shoe-box table (from the first toss: its `land`, then its `idle`), or null: not yet. */
  table: { anim: "land" | "idle"; frame: number } | null;
  /** The board: how far over its place on the table it is (squares: it falls on from the second toss; 0 on it), or null: not yet. */
  board: number | null;
  /** The pieces are on the board (from the pop's own frame). */
  pieces: boolean;
  /** The pop's frame over the board (from the third toss), or -1: none. */
  pop: number;
  /** Both stools (from the fourth toss: their `land`, then their `idle`), or null: not yet. */
  stools: { anim: "land" | "idle"; frame: number } | null;
}
/** Dash's intro `t` ms in: see BlitzNow. */
export function blitzAt(a: BlitzAnims, t: number, feel: Pick<typeof CHALLENGE_FEEL, "faceMs" | "blitz" | "boardDropMs" | "dropFrom"> = CHALLENGE_FEEL): BlitzNow {
  const T = blitzTimes(a, feel);
  const M = a.moves;
  const G = a.gear;
  let move: BlitzNow["move"] = null;
  let gone = false;
  let dust = -1;
  for (const d of T.dashes) {
    if (t >= d.at && t < d.gone) move = { anim: "bolt", frame: frameAt(M.bolt, t - d.at, false) };
    else if (t >= d.gone && t < d.back) gone = true;
    else if (t >= d.back && t < d.back + sum(M.arrive)) move = { anim: "arrive", frame: frameAt(M.arrive, t - d.back, false) };
    if (t >= d.launch && t < d.launch + sum(G.dust)) dust = frameAt(G.dust, t - d.launch, false);
  }
  if (t >= T.brag && t < T.brag + sum(M.brag)) move = { anim: "brag", frame: frameAt(M.brag, t - T.brag, false) };
  const here = !gone && !(move?.anim === "bolt" && move.frame >= a.key.whoosh) && !(move?.anim === "arrive" && move.frame < a.key.skid);
  const landed = (from: number, ms: readonly number[]) => (t < from ? null : t < from + sum(ms) ? { anim: "land" as const, frame: frameAt(ms, t - from, false) } : { anim: "idle" as const, frame: 0 });
  const [d0, d1, d2, d3] = T.drop as [number, number, number, number];
  const fall = Math.min(1, Math.max(0, (t - d1) / Math.max(1, feel.boardDropMs)));
  return {
    move,
    gone,
    here,
    dust,
    table: landed(d0, G.table),
    board: t < d1 ? null : feel.dropFrom * (1 - fall * fall),
    pieces: t >= T.pieces,
    pop: t >= d2 && t < d2 + sum(G.pop) ? frameAt(G.pop, t - d2, false) : -1,
    stools: landed(d3, G.stool),
  };
}
/**
 * Dash's cues, and when (CHALLENGE_FEEL.blitz): his moves' own on their frames (each bolt's whoosh, each arrive's whoosh, skid and
 * toss, the brag's two brushes and its ding); the table's thud as it lands, the board's as it touches down, the pop as the pieces
 * appear, the stools' thud (both as one: they land together). (The dust trail's own whoosh is the bolt's, on the same frame: once.)
 */
export function blitzCues(a: BlitzAnims, feel: Pick<typeof CHALLENGE_FEEL, "faceMs" | "blitz" | "boardDropMs"> = CHALLENGE_FEEL): { cue: string; at: number }[] {
  const T = blitzTimes(a, feel);
  const out: { cue: string; at: number }[] = [];
  const play = (ms: readonly number[], cues: readonly (string | undefined)[], from: number) => {
    let t = from;
    ms.forEach((m, i) => {
      const cue = cues[i];
      if (cue) out.push({ cue, at: t });
      t += m;
    });
  };
  const { moves: M, gear: G, cues: C } = a;
  for (const d of T.dashes) {
    play(M.bolt, C.bolt, d.at);
    play(M.arrive, C.arrive, d.back);
  }
  play(G.table, C.table, T.drop[0]!);
  out.push({ cue: "thud", at: T.board });
  play(G.pop, C.pop, T.drop[2]!);
  play(G.stool, C.stool, T.drop[3]!);
  play(M.brag, C.brag, T.brag);
  return out.sort((x, y) => x.at - y.at);
}
/**
 * When things happen in Folio's intro (ms from the marks; CHALLENGE_FEEL.folio): its line; the step back; each stool's fold and the
 * table's; the plane's start, its bank, the packet let go and landed; the unfold and the board done; the bow; the quiet line; the
 * crumple.
 */
export function folioTimes(a: FolioAnims, feel: Pick<typeof CHALLENGE_FEEL, "faceMs" | "folio"> = CHALLENGE_FEEL) {
  const F = feel.folio;
  const line = feel.faceMs;
  const back = line + F.lineMs;
  const stoolW = back + F.backMs + F.stoolLeadMs;
  const stoolE = stoolW + F.stoolGapMs;
  const table = stoolE + F.tableAfterMs;
  const tableUp = table + sum(a.table);
  const plane = tableUp + F.planeAfterMs;
  const r = a.route;
  // (The route's points: its third is over the table as it banks, its fourth where the packet is let go.)
  const bank = plane + r[2]!.ms;
  const drop = plane + r[3]!.ms;
  const planeGone = plane + r[r.length - 1]!.ms;
  const land = drop + F.fallMs;
  const unfold = land + F.unfoldLeadMs;
  const board = unfold + sum(a.unfold);
  const bow = board + F.bowAfterMs;
  const quiet = bow + F.quietLeadMs;
  const crumple = quiet + F.quietMs + F.crumpleAfterMs;
  return { line, back, stoolW, stoolE, table, tableUp, plane, bank, drop, planeGone, land, unfold, board, bow, quiet, quietEnd: quiet + F.quietMs, crumple };
}
/** A folding piece of Folio's intro: lying flat (its sheet), folding (its `fold`'s frame), or standing (`idle`). */
export type FoldNow = { anim: "sheet" } | { anim: "fold" | "idle"; frame: number };
/**
 * Folio's intro `t` ms in (its beats): its move; the two stools and the table (each its sheet, folding, or standing); the plane (where
 * it is, `lift` squares up, its animation); the packet falling (where, how high); the board on the table's top (the packet, its
 * unfolding, then the game's own board: `real`).
 */
export interface FolioNow {
  move: { anim: FolioMove; frame: number };
  stools: readonly [FoldNow, FoldNow];
  table: FoldNow;
  plane: { anim: FolioPlane; frame: number; c: number; r: number; lift: number } | null;
  /**
   * The packet falling from the plane to the table's top: `from` the plane's height as it let go (squares over the floor), `u` of its
   * fall (eased in: it speeds up); null: not falling.
   */
  packet: { from: number; u: number } | null;
  /** The board's top-view picture on the table: the packet lying, its unfold's frame; null: none (not landed, or the real board's on). */
  board: { anim: "packet" | "unfold"; frame: number } | null;
  /** The game's own board is on the table (from the unfold's end), coming in over the unfolded sheet (`swap` 0 to 1). */
  real: boolean;
  swap: number;
}
const easeIO = (u: number) => u * u * (3 - 2 * u);
/** Where the plane is `pt` ms along its route (eased between its points, as the art plays it): into `out`. */
export function folioPlaneAt(route: readonly FolioRoutePoint[], pt: number, out: { c: number; r: number; lift: number }): void {
  let k = 0;
  while (k < route.length - 2 && pt > route[k + 1]!.ms) k++;
  const a = route[k]!;
  const b = route[k + 1]!;
  const u = easeIO(Math.min(1, Math.max(0, (pt - a.ms) / (b.ms - a.ms))));
  out.c = a.at[0] + (b.at[0] - a.at[0]) * u;
  out.r = a.at[1] + (b.at[1] - a.at[1]) * u;
  out.lift = a.at[2] + (b.at[2] - a.at[2]) * u;
}
/** Folio's intro `t` ms in: see FolioNow. */
export function folioAt(a: FolioAnims, t: number, feel: Pick<typeof CHALLENGE_FEEL, "faceMs" | "folio"> = CHALLENGE_FEEL): FolioNow {
  const T = folioTimes(a, feel);
  const M = a.moves;
  let move: FolioNow["move"] = { anim: "idle", frame: frameAt(M.idle, t, true) };
  if (t >= T.back && t < T.back + feel.folio.backMs) move = { anim: "glide", frame: frameAt(M.glide, t - T.back, true) };
  else if (t >= T.bow && t < T.bow + sum(M.bow)) move = { anim: "bow", frame: frameAt(M.bow, t - T.bow, false) };
  const fold = (from: number, ms: readonly number[]): FoldNow => (t < from ? { anim: "sheet" } : t < from + sum(ms) ? { anim: "fold", frame: frameAt(ms, t - from, false) } : { anim: "idle", frame: 0 });
  let plane: FolioNow["plane"] = null;
  const pt = t - T.plane;
  if (pt >= 0 && t < T.planeGone) {
    const at = { c: 0, r: 0, lift: 0 };
    folioPlaneAt(a.route, pt, at);
    const P = a.plane;
    const bankAt = T.bank - T.plane;
    const dropAt = T.drop - T.plane;
    const [anim, ms, loop] =
      pt < bankAt ? (["fly", pt, true] as const) : pt < dropAt ? (["bank", pt - bankAt, false] as const) : pt < dropAt + sum(P.drop) ? (["drop", pt - dropAt, false] as const) : (["away", pt, true] as const);
    plane = { anim, frame: frameAt(P[anim], ms, loop), ...at };
  }
  let packet: FolioNow["packet"] = null;
  if (t >= T.drop && t < T.land) {
    const u = (t - T.drop) / (T.land - T.drop);
    packet = { from: a.route[3]!.at[2], u };
  }
  const swap = Math.min(1, Math.max(0, (t - T.board) / feel.folio.swapMs));
  const board: FolioNow["board"] = t < T.land || swap >= 1 ? null : t < T.unfold ? { anim: "packet", frame: 0 } : { anim: "unfold", frame: frameAt(a.unfold, t - T.unfold, false) };
  return { move, stools: [fold(T.stoolW, a.stool), fold(T.stoolE, a.stool)], table: fold(T.table, a.table), plane, packet, board, real: t >= T.board, swap };
}
/**
 * Folio's cues, and when (CHALLENGE_FEEL.folio): each stool's and the table's own on their frames (a fold for each crease, `set` as it
 * stands), the plane's glide in as it starts, the packet's landing, the board's two unfolds on their frames, the bow's on its frame.
 * (The crumple's and the open's are the transition's: crumple-gl.ts.)
 */
export function folioCues(a: FolioAnims, feel: Pick<typeof CHALLENGE_FEEL, "faceMs" | "folio"> = CHALLENGE_FEEL): { cue: string; at: number }[] {
  const T = folioTimes(a, feel);
  const out: { cue: string; at: number }[] = [];
  const play = (ms: readonly number[], cues: readonly (string | undefined)[], from: number) => {
    let t = from;
    ms.forEach((m, i) => {
      const cue = cues[i];
      if (cue) out.push({ cue, at: t });
      t += m;
    });
  };
  play(a.stool, a.cues.stool, T.stoolW);
  play(a.stool, a.cues.stool, T.stoolE);
  play(a.table, a.cues.table, T.table);
  out.push({ cue: "whoosh", at: T.plane });
  out.push({ cue: "land", at: T.land });
  play(a.unfold, a.cues.unfold, T.unfold);
  play(a.moves.bow, a.cues.bow, T.bow);
  return out.sort((x, y) => x.at - y.at);
}
/**
 * Jefferson's intro `t` ms in (CHALLENGE_FEEL.crew): his move, the crew's clock (the room walks each of them), your lift and the table.
 * He and you stand on your marks from the start to the end (he stands; you on your lift).
 */
export interface CrewNow {
  /** His own move and frame (BOSS_GREX_INTRO, as drawn), or null: his idle (his town figure's frames). */
  move: { anim: CrewMove; frame: number } | null;
  /** Ms since the crew stopped work (-1: not yet): the machines parked where they are, the guys stepping off, the dozer waking. */
  stopped: number;
  /** Ms since the crew set off for the table (-1: not yet); each goes after his own delay (the art's INTRO_GREX_CREW_SETOFF). */
  walk: number;
  /** Ms left until your lift locks at the top (each walker is at his spot by then). */
  untilLocked: number;
  /** Your lift (INTRO_GREX_LIFT): flush with the floor (your mark), rising, up. */
  lift: { anim: "flush" | "rise" | "up"; frame: number };
  /** The crate-stack table: its slight wobble, or its bigger one as your lift clunks home. */
  table: { anim: "idle" | "creak"; frame: number };
}
/** When things happen in Jefferson's intro (ms in): the crew stop, they set off, your lift starts rising, it locks. */
export function crewTimes(beats: readonly IntroBeat[], a: CrewAnims, feel: Pick<typeof CHALLENGE_FEEL, "crew"> = CHALLENGE_FEEL) {
  const K = feel.crew;
  const stop = stepAt(beats, "call") + K.stopMs;
  const setOff = stop + K.setOffMs;
  const lift = stepAt(beats, "lift");
  return { stop, setOff, lift, locked: lift + sum(a.rise) };
}
/** Jefferson's intro `t` ms in (his beats, `introBeats`): see CrewNow. */
export function crewAt(beats: readonly IntroBeat[], a: CrewAnims, t: number, feel: Pick<typeof CHALLENGE_FEEL, "crew"> = CHALLENGE_FEEL): CrewNow {
  const at = (s: IntroStep) => stepAt(beats, s);
  const T = crewTimes(beats, a, feel);
  const me = (anim: CrewMove, ms: number, loop: boolean) => ({ anim, frame: frameAt(a.moves[anim], ms, loop) });
  let move: CrewNow["move"] = null;
  if (t >= at("call") && t < at("wave")) move = me("call", t - at("call"), false);
  else if (t >= at("wave") && t < at("walk")) move = me("waveOver", t - at("wave"), true);
  else if (t >= at("brag") && t < at("swing")) move = me("brag", t - at("brag"), false);
  const lift: CrewNow["lift"] = t < T.lift ? { anim: "flush", frame: 0 } : t < T.locked ? { anim: "rise", frame: frameAt(a.rise, t - T.lift, false) } : { anim: "up", frame: 0 };
  const creaking = t >= at("creak") && t < at("creak") + sum(a.creak);
  const table: CrewNow["table"] = creaking ? { anim: "creak", frame: frameAt(a.creak, t - at("creak"), false) } : { anim: "idle", frame: frameAt(a.tableIdle, t, true) };
  return { move, stopped: t >= T.stop ? t - T.stop : -1, walk: t >= T.setOff ? t - T.setOff : -1, untilLocked: T.locked - t, lift, table };
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
const easeOutBack = (u: number) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
/**
 * When you and the boss hop back clear of the stools, ms into the intro: as they come in (the default's pop). An intro as data hops
 * you back in its own beats (shops/intros/common.ts hopBack).
 */
export function hopStart(beats: readonly IntroBeat[], a: IntroAnims | null): number {
  // (Hollow's and Wrangler's: you walked on to your seats, or clear of them; Jefferson's: no stools; nothing to hop back from.)
  // (Dash's: you both walk on to where you stand clear of the stools, and nobody steps after they land.)
  if (a && (isDark(a) || isRope(a) || isCrew(a) || isIce(a) || isBlitz(a))) return Infinity;
  // (Folio's: you both step back a pace after its line, before the stools fold up: introAt eases it, no hop.)
  if (a && isFolio(a)) return stepAt(beats, "back");
  return stepAt(beats, "pop");
}
export function introAt(beats: readonly IntroBeat[], a: IntroAnims | null, t: number, feel: Pick<typeof CHALLENGE_FEEL, "popMs" | "puffMs" | "dropFrom" | "hopMs" | "lineMs" | "dark" | "rope" | "crew"> = CHALLENGE_FEEL): IntroNow {
  const b = beats.find((x) => t < x.end) ?? beats[beats.length - 1]!;
  const h = Math.min(1, Math.max(0, (t - hopStart(beats, a)) / feel.hopMs));
  const base = { step: b.step, pop: 1, puff: -1, line: b.step === "line", back: h * h * (3 - 2 * h), hop: h > 0 && h < 1 ? Math.sin(Math.PI * h) : 0, chant: false, cast: null, dark: null, rope: null, crew: null, ice: null, blitz: null, folio: null };
  if (a && isFolio(a)) {
    // (Folio's: you both step back a pace (no hop) to the clear places; the table (the game's board on it) from the unfold's end, its
    // stools from theirs (each folds up on its own: FolioNow); its quiet line (the `chant`) from `quietLeadMs` into its bow.)
    const T = folioTimes(a);
    const u = Math.min(1, Math.max(0, (t - T.back) / CHALLENGE_FEEL.folio.backMs));
    const z = folioAt(a, t);
    return { ...base, folio: z, back: u * u * (3 - 2 * u), hop: 0, table: z.real, stools: false, chant: t >= T.quiet && t < T.quietEnd };
  }
  if (a && isBlitz(a)) {
    // (Dash's: the table and its board from the board's toss on (the shoe boxes stand from the first, its own lid on top); the stools
    // from the last.)
    const z = blitzAt(a, t);
    return { ...base, blitz: z, table: z.board !== null, stools: z.stools !== null };
  }
  if (a && isIce(a)) {
    // (Ginger's: the icicle is the table once it's stabbed in; no stools. What his props show: the room's iceAt, its art in hand.)
    return { ...base, table: t >= stepAt(beats, "carry"), stools: false };
  }
  if (a && isCrew(a)) {
    // (Jefferson's: the board on its crates is there from the start; no stools: he stands, you on your lift.)
    return { ...base, crew: crewAt(beats, a, t), table: true, stools: false };
  }
  if (a && isRope(a)) {
    // (Wrangler's: the table in its place once the bale lands; the stools once the buckets have.)
    const T = ropeTimes(beats, a);
    return { ...base, rope: ropeAt(beats, a, t), table: t >= stepAt(beats, "land"), stools: t >= T.land };
  }
  if (!a || isDark(a)) {
    const p = t - stepAt(beats, "pop");
    // (Hollow's: the table pops in as the default's, still lit; his channel line from his charge's start.)
    const dark = a && isDark(a) ? { chant: t >= stepAt(beats, "charge") && t < stepAt(beats, "charge") + feel.dark.chantMs, dark: darkAt(beats, a, t, feel) } : null;
    const shown = p >= 0;
    return { ...base, ...dark, table: shown, stools: shown, pop: shown ? easeOutBack(Math.min(1, p / feel.popMs)) : 0, puff: shown && p < feel.puffMs ? p / feel.puffMs : -1 };
  }
  return { ...base, table: false, stools: false };
}
/**
 * An intro as data `t` ms in (shops/timeline.ts), as the room reads an intro: its step, its line and chant, the board and stools, and
 * every actor (`cast`: you and the boss stand where it says, `back` and `hop` unused).
 */
export function castIntroAt(tl: Timeline, t: number): IntroNow {
  const n = timelineAt(tl, t);
  const c = n.cast;
  const on = (k: string) => !!c[k]?.on;
  return { step: n.step, pop: 1, puff: -1, line: on("line"), chant: on("chant"), table: on("board"), stools: on("stools"), back: 0, hop: 0, cast: c, dark: null, rope: null, crew: null, ice: null, blitz: null, folio: null };
}
/**
 * The cue each beat starts on, and when: the default's "table" as it pops in; a boss's own, as its art's frames say (an intro as data:
 * shops/timeline.ts timelineCues).
 */
export function introCues(beats: readonly IntroBeat[], a: IntroAnims | null): { cue: string; at: number }[] {
  const at = (s: IntroStep) => stepAt(beats, s);
  if (!a) return [{ cue: "table", at: at("pop") }];
  if (isDark(a)) return darkCues(beats, a);
  if (isRope(a)) return ropeCues(beats, a);
  if (isCrew(a)) return crewCues(beats, a);
  if (isIce(a)) return iceCues(a);
  if (isBlitz(a)) return blitzCues(a);
  return folioCues(a);
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
 * Jefferson's cues, and when (his intro's beats; CHALLENGE_FEEL.crew): his moves' own on their frames (his two hollers, his whoosh each
 * wave, his brag's laugh, fizz and stomp); the crew stopping: the machine guys' steps as they climb off (their `stepOff`'s, both
 * machines' as one: they step off together), the dozer's snort as he wakes; your lift's hiss and its clunk as it locks; the crates'
 * creak on each wobble (`creakSoft`: their slight one, all through) and the louder one as your lift clunks home. (The crew's steps as
 * they walk are the room's: where each is depends on where his machine stopped.) `stepOff` and `wake`: the frames' times and cues
 * of the machines' step-off and the dozer's wake (the room's baked sheets).
 */
export function crewCues(
  beats: readonly IntroBeat[],
  a: CrewAnims,
  feel: Pick<typeof CHALLENGE_FEEL, "crew"> = CHALLENGE_FEEL,
  sheet: { stepOff: { ms: readonly number[]; cues: readonly (string | null)[] }; wake: { ms: readonly number[]; cues: readonly (string | null)[] } } = CREW_SHEET_CUES,
): { cue: string; at: number }[] {
  const at = (s: IntroStep) => stepAt(beats, s);
  const out: { cue: string; at: number }[] = [];
  const play = (ms: readonly number[], cues: readonly (string | null | undefined)[], from: number, to: number, loop: boolean, rename?: string) => {
    if (sum(ms) <= 0) return;
    let t = from;
    for (let i = 0; t < to; i = (i + 1) % ms.length) {
      const cue = cues[i];
      if (cue) out.push({ cue: rename ?? cue, at: t });
      t += ms[i]!;
      if (!loop && i === ms.length - 1) break;
    }
  };
  const M = a.moves;
  const C = a.cues;
  const T = crewTimes(beats, a, feel);
  play(M.call, C.call, at("call"), at("wave"), false);
  play(M.waveOver, C.waveOver, at("wave"), at("walk"), true);
  play(sheet.stepOff.ms, sheet.stepOff.cues, T.stop, Infinity, false);
  play(sheet.wake.ms, sheet.wake.cues, T.stop, Infinity, false);
  play(a.tableIdle, C.tableIdle, 0, at("creak"), true, "creakSoft");
  play(a.rise, C.rise, T.lift, T.locked + 1, false);
  play(a.creak, C.creak, at("creak"), at("brag"), false);
  play(a.tableIdle, C.tableIdle, at("brag"), at("done"), true, "creakSoft");
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
