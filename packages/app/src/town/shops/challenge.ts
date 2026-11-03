/**
 * A boss challenged from the town, Pokémon-gym style (Eric, Nov 2; docs/areas/town-square.md, "Challenging a boss"): you and the
 * boss walk into its home, each to a start mark on its battle circle; it says its challenge line; its own animation brings the
 * board in between you (Alfil: a sand pyramid rises, cracks and crumbles, and his table is inside); its own transition covers the
 * screen (Alfil: a sandstorm) while the battle loads under it; after the battle, its result screen's "Back to town" puts you where
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
   * Its own board art and transition (shops/intro.ts ART: Alfil's pyramid and sandstorm, Big Boy's toy blocks and lollipop swirl), or
   * false: the default intro (the table pops in between you, then a flash and a wipe to black). Every intro ends with its God King
   * attack swung in place for a couple of seconds.
   */
  custom: boolean;
  /** A sound for each cue that has a fitting one (the boss's own pack; the default's "table" pop and "wipe"): none is silent. */
  cues: Readonly<Record<string, string>>;
}

/**
 * The bosses with an intro: every boss whose home has an inside (shops/shops.ts SHOPS; Nov 2, round 2: "for other bosses they should
 * just be swinging for a few seconds like discussed"). Alfil has his own (his pyramid and sandstorm), Big Boy his (his toy blocks
 * and lollipop swirl, Nov 2); Babur, Puddles and Timber (Nov 3, until his own) the default.
 * The lines are placeholders until Gemini's lines arrive (Part D), each in its boss's voice (characters/*-lines.ts). Alfil's cues are
 * his own synthesized sounds (characters/alfil-sounds.ts): a low rumble as the pyramid rises, the grinding crunch as it cracks, the
 * ground's thud as it falls, the soft glow as the board shows, and a whoosh as the storm comes in. The default's: the app's soft pop
 * as the table appears, and the boss's own whoosh as the screen flashes. Big Boy's are his own toy sounds (characters/bigboy-sounds.ts):
 * a wooden clack as each block lands (a bonk for the top one), his toss as the board drops, a poof as it plops on, a clack for each
 * stool, and his swish as the swirl comes in.
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
  // (Nov 3: the default until his own intro's art comes; his line is his entrance's first, characters/timber-lines.ts.)
  timber: {
    name: "Timber",
    line: "Hard hats on. We're building today.",
    layout: "across",
    custom: false,
    cues: { table: "pop", wipe: "timberSwoosh" },
  },
};

/** The boss's intro, or null: challenged as before (no intro yet). */
export const introOf = (id: HomeId): BossIntro | null => BOSS_INTROS[id] ?? null;

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
export function marksOf(layout: readonly ShopPlace[], how: IntroLayout, drawn?: DrawnMarks | null, feel: Pick<typeof CHALLENGE_FEEL, "standOff" | "stoolOff" | "clearOff" | "clear"> = CHALLENGE_FEEL): Marks | null {
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
/** A boss's own art's animations: a pyramid (Alfil's) or toy blocks (Big Boy's). */
export type IntroAnims = PyramidAnims | BlocksAnims;
export const isBlocks = (a: IntroAnims): a is BlocksAnims => "build" in a;
export type IntroStep = "face" | "line" | "pause" | "rise" | "idle" | "crack" | "crumble" | "build" | "drop" | "plop" | "chairs" | "pop" | "table" | "swing" | "done";
export interface IntroBeat {
  step: IntroStep;
  at: number;
  end: number;
}
const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);
type BeatFeel = Pick<
  typeof CHALLENGE_FEEL,
  "faceMs" | "lineMs" | "afterLineMs" | "holdMs" | "gapMs" | "tableHoldMs" | "boardDropMs" | "popMs" | "swingMs" | "stormInMs" | "flashMs" | "wipeMs"
>;
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
}
const easeOutBack = (u: number) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
/**
 * When you and the boss hop back clear of the stools, ms into the intro: as they come in (the default's pop; Big Boy's stools
 * starting to drop; Alfil's table showing through the crumble).
 */
export function hopStart(beats: readonly IntroBeat[], a: IntroAnims | null): number {
  if (!a) return stepAt(beats, "pop");
  if (isBlocks(a)) return stepAt(beats, "chairs");
  return stepAt(beats, "crumble") + sum(a.crumble.slice(0, a.tableFrame));
}
export function introAt(beats: readonly IntroBeat[], a: IntroAnims | null, t: number, feel: Pick<typeof CHALLENGE_FEEL, "popMs" | "puffMs" | "dropFrom" | "hopMs"> = CHALLENGE_FEEL): IntroNow {
  const b = beats.find((x) => t < x.end) ?? beats[beats.length - 1]!;
  const h = Math.min(1, Math.max(0, (t - hopStart(beats, a)) / feel.hopMs));
  const base = { step: b.step, pyramid: null, blocks: null, drop: 0, drift: false, pop: 1, puff: -1, line: b.step === "line", back: h * h * (3 - 2 * h), hop: h > 0 && h < 1 ? Math.sin(Math.PI * h) : 0 };
  if (!a) {
    const p = t - stepAt(beats, "pop");
    const shown = p >= 0;
    return { ...base, table: shown, stools: shown, pop: shown ? easeOutBack(Math.min(1, p / feel.popMs)) : 0, puff: shown && p < feel.puffMs ? p / feel.puffMs : -1 };
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

// ---- The boss's attack (its God King attack: its kit's `kingAttack`).

/**
 * When the attack starts, ms into the intro: as it swings (after the table's beat on its own), in place where it stands, clear of
 * its stool (every intro since Nov 2's pacing: `attackTime`'s `inPlace`); `swingMs` before its transition has covered the screen.
 */
export const attackStart = (beats: readonly IntroBeat[]): number => stepAt(beats, "swing");
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

