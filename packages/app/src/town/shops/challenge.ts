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
   * Its own board art and transition (shops/intro.ts ART: Alfil's pyramid and sandstorm), or false: the default intro (the table
   * pops in between you, it swings its God King attack in place for a few seconds, then a flash and a wipe to black).
   */
  custom: boolean;
  /** A sound for each cue that has a fitting one (the boss's own pack; the default's "table" pop and "wipe"): none is silent. */
  cues: Readonly<Record<string, string>>;
}

/**
 * The bosses with an intro: every boss whose home has an inside (shops/shops.ts SHOPS; Nov 2, round 2: "for other bosses they should
 * just be swinging for a few seconds like discussed"). Alfil has his own (his pyramid and sandstorm); Babur and Puddles the default.
 * The lines are placeholders until Gemini's lines arrive (Part D), each in its boss's voice (characters/*-lines.ts). Alfil's cues are
 * his own synthesized sounds (characters/alfil-sounds.ts): a low rumble as the pyramid rises, the grinding crunch as it cracks, the
 * ground's thud as it falls, the soft glow as the board shows, and a whoosh as the storm comes in. The default's: the app's soft pop
 * as the table appears, and the boss's own whoosh as the screen flashes.
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
};

/** The boss's intro, or null: challenged as before (no intro yet). */
export const introOf = (id: HomeId): BossIntro | null => BOSS_INTROS[id] ?? null;

/** Every number that shapes the challenge's timing (the whole of it under about 6 s, from the door to the storm covering). */
export const CHALLENGE_FEEL = {
  /** Walking in, you and the boss side by side: ms a square (the boss's own town pace, 420, is too slow for this). */
  walkStepMs: 120,
  /** The last half square onto the middle of a two-square start mark, in ms. */
  settleMs: 140,
  /** The line shows this long (ms) from when you face each other; the pyramid starts to rise `riseAtMs` into it. */
  lineMs: 1800,
  riseAtMs: 400,
  /** The table and its board hold this long after the pyramid has crumbled, before the storm. */
  tableHoldMs: 350,
  /** The storm sweeps in over this long (ms), holds covered at least `coveredMinMs` (longer while the battle loads), and slides out over `stormOutMs`. */
  stormInMs: 600,
  coveredMinMs: 250,
  stormOutMs: 600,
  /**
   * The room's camera through a challenge, by layout: looking at this many squares south of the table (and west of it: the boss is
   * wider than you), at this zoom (0 Close, 1 the town's zoomed-in camera): you, the board and the boss all in view, the boss's line
   * under the chat log.
   */
  cam: { across: { south: 0.8, west: 0.3, zoom: 0.45 }, facing: { south: 1.5, west: 0, zoom: 0.6 } },
  /**
   * How far (squares) each of you stands from the table's middle, by layout: across, just outside your stool (the park table's
   * stools stand `stoolOff` from its middle); facing, on the circle's drawn north and south marks.
   */
  standOff: { across: 1.5, facing: 2.5 },
  /** The park table's stools: this far (squares) from the table's middle (park.ts PARK_TABLE: three squares across). */
  stoolOff: 1,
  /** A circle whose middle has a piece standing in it (Babur's ring, its pedestal): the table stands this many squares south of it. */
  clearOff: 1.5,
  /**
   * The default intro (a boss without its own art): the line from facing each other for `lineMs` (above); the table and its board
   * pop in `popAtMs` into it (growing in over `popMs`, a dust puff round its foot over `puffMs`); from the line's end it swings its
   * God King attack in place for `swingMs`; then the flash and the wipe.
   */
  popAtMs: 450,
  popMs: 220,
  puffMs: 500,
  swingMs: 2000,
  /** The default transition: the screen flashes white `flashes` times over `flashMs`, black bands wipe in over `wipeMs`, and the black fades off over `wipeOutMs`. */
  flashes: 3,
  flashMs: 420,
  wipeMs: 380,
  wipeBands: 8,
  wipeOutMs: 420,
  /**
   * The boss's attack (its kit's `kingAttack`, the one it fires at the God King; Eric, Nov 2: "a few seconds before the screen
   * overlay hits… it continues on until the screen is fully cloaked"): it starts this long before the storm covers the screen,
   * and plays on (its lashes over and over) until the battle takes the screen. A boss without one skips it.
   */
  attackLeadMs: 2000,
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
  /** The way each faces, standing: 1 the screen's right (east), -1 its left; null facing north or south (the sprite as it walked). */
  youFace: 1 | -1 | null;
  bossFace: 1 | -1 | null;
}
/**
 * Where you, the boss, the table and its stools are in a room (its battle circle's middle: the box round its `circle-*` or `ring-*`
 * floor and its emblem; `clearOff` south of it when a piece stands there, as Babur's pedestal does), by layout; null for a room
 * without a circle. The circles' drawn start marks (Alfil's and Puddles') are where the layout puts you (a unit test keeps them so).
 */
export function marksOf(layout: readonly ShopPlace[], how: IntroLayout, feel: Pick<typeof CHALLENGE_FEEL, "standOff" | "stoolOff" | "clearOff"> = CHALLENGE_FEEL): Marks | null {
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
  const boss = across ? { c: table.c - d, r: table.r } : { c: table.c, r: table.r - d };
  const you = across ? { c: table.c + d, r: table.r } : { c: table.c, r: table.r + d };
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

/** The art's animations: each frame's ms (the pyramid's `rise`, `idle`, `crack`, `crumble`), and the crumble frame the table shows on. */
export interface IntroAnims {
  rise: readonly number[];
  idle: readonly number[];
  crack: readonly number[];
  crumble: readonly number[];
  /** The crumble frame (from 0) whose middle is clear: the table and its board show from it on (the art's "table" cue). */
  tableFrame: number;
}
export type IntroStep = "line" | "rise" | "idle" | "crack" | "crumble" | "table" | "swing" | "done";
export interface IntroBeat {
  step: IntroStep;
  at: number;
  end: number;
}
const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);
type BeatFeel = Pick<typeof CHALLENGE_FEEL, "lineMs" | "riseAtMs" | "tableHoldMs" | "swingMs">;
/**
 * The beats. A boss's own art (`a`: Alfil's pyramid): the line alone, the pyramid rising (`riseAtMs` into the line), holding (its
 * idle) until the line is done, cracking, crumbling, the table on its own for a moment; then done (its transition). The default
 * (`a` null): the line (the table pops in `popAtMs` into it), then its attack swung in place for `swingMs`; then done.
 */
export function introBeats(a: IntroAnims | null, feel: BeatFeel = CHALLENGE_FEEL): IntroBeat[] {
  const out: IntroBeat[] = [];
  let t = 0;
  const add = (step: IntroStep, ms: number) => {
    out.push({ step, at: t, end: t + ms });
    t += ms;
  };
  if (!a) {
    add("line", feel.lineMs);
    add("swing", feel.swingMs);
  } else {
    add("line", feel.riseAtMs);
    add("rise", sum(a.rise));
    add("idle", Math.max(0, feel.lineMs - t));
    add("crack", sum(a.crack));
    add("crumble", sum(a.crumble));
    add("table", feel.tableHoldMs);
  }
  out.push({ step: "done", at: t, end: Infinity });
  return out;
}
/** The intro's whole length (ms): when its transition starts. */
export const introLength = (beats: readonly IntroBeat[]): number => beats[beats.length - 1]!.at;

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
  /** The boss's line is over its head (from facing you until the pyramid cracks; the default: until it swings). */
  line: boolean;
  /** The table and its board show (from the crumble's clear frame on; the default: from its pop on). */
  table: boolean;
  /** The crumble's last frame (the low drift of sand) lies over the table's foot: kept, as the art allows, until the storm. */
  drift: boolean;
  /** The default's pop: how far the table has grown in (0 to 1; 1 once in, and always for a boss's own art). */
  pop: number;
  /** The default's dust puff round the table's foot: how far through it is (0 to 1), or -1: none. */
  puff: number;
}
const easeOutBack = (u: number) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
export function introAt(beats: readonly IntroBeat[], a: IntroAnims | null, t: number, feel: Pick<typeof CHALLENGE_FEEL, "popAtMs" | "popMs" | "puffMs"> = CHALLENGE_FEEL): IntroNow {
  const b = beats.find((x) => t < x.end) ?? beats[beats.length - 1]!;
  const into = t - b.at;
  const base = { step: b.step, pyramid: null, drift: false, pop: 1, puff: -1 };
  if (!a) {
    const p = t - feel.popAtMs;
    const shown = p >= 0;
    return { ...base, line: b.step === "line" && t >= 0, table: shown, pop: shown ? easeOutBack(Math.min(1, p / feel.popMs)) : 0, puff: shown && p < feel.puffMs ? p / feel.puffMs : -1 };
  }
  const crackAt = beats.find((x) => x.step === "crack")!.at;
  const line = t >= 0 && t < crackAt;
  switch (b.step) {
    case "line":
      return { ...base, line, table: false };
    case "rise":
    case "crack":
      return { ...base, pyramid: { anim: b.step, frame: frameAt(a[b.step], into, false) }, line, table: false };
    case "idle":
      return { ...base, pyramid: { anim: "idle", frame: frameAt(a.idle, into, true) }, line, table: false };
    case "crumble": {
      const frame = frameAt(a.crumble, into, false);
      return { ...base, pyramid: { anim: "crumble", frame }, line, table: frame >= a.tableFrame };
    }
    default:
      return { ...base, line, table: true, drift: true };
  }
}
/**
 * The cue each beat starts on, and when. A boss's own art: "rumble" as it rises, "crack", "crumble", and "table" on the crumble's
 * clear frame. The default: "table" as it pops in.
 */
export function introCues(beats: readonly IntroBeat[], a: IntroAnims | null, feel: Pick<typeof CHALLENGE_FEEL, "popAtMs"> = CHALLENGE_FEEL): { cue: string; at: number }[] {
  if (!a) return [{ cue: "table", at: feel.popAtMs }];
  const at = (s: IntroStep) => beats.find((x) => x.step === s)!.at;
  return [
    { cue: "rumble", at: at("rise") },
    { cue: "crack", at: at("crack") },
    { cue: "crumble", at: at("crumble") },
    { cue: "table", at: at("crumble") + sum(a.crumble.slice(0, a.tableFrame)) },
  ];
}

// ---- The boss's attack (its God King attack: its kit's `kingAttack`).

/**
 * When the attack starts, ms into the intro. A boss's own art: `attackLeadMs` before its storm covers the screen (never before the
 * intro starts), beside the table. The default: as it swings (the line's end), in place.
 */
export function attackStart(beats: readonly IntroBeat[], feel: Pick<typeof CHALLENGE_FEEL, "stormInMs" | "attackLeadMs"> = CHALLENGE_FEEL): number {
  const swing = beats.find((b) => b.step === "swing");
  if (swing) return swing.at;
  return Math.max(0, introLength(beats) + feel.stormInMs - feel.attackLeadMs);
}
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

