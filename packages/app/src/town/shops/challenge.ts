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

/** A boss's intro: its challenge line (one per boss: Gemini's lines, Part D, drop in here) and the sounds on its art's cues. */
export interface BossIntro {
  /** Said out loud in a speech bubble over its head (and into the town's chat log) as you face each other. */
  line: string;
  /** A sound for each of the art's cues that has a fitting one (the boss's own pack): none is silent. */
  cues: Readonly<Record<string, string>>;
}

/**
 * The bosses with an intro (Alfil first; the rest plug in here as their art lands). The line is a placeholder until Gemini's
 * lines arrive (Part D). The cues are his own synthesized sounds (characters/alfil-sounds.ts): a low rumble as the pyramid rises,
 * the grinding crunch as it cracks, the ground's thud as it falls, the soft glow as the board shows, and a whoosh as the storm
 * comes in.
 */
export const BOSS_INTROS: Readonly<Partial<Record<HomeId, BossIntro>>> = {
  alfil: {
    line: "I'll show you the power of the old piece.",
    cues: { rumble: "alfilRumble", crack: "alfilCrunch", crumble: "alfilThud", table: "alfilGlow", storm: "alfilWhoosh" },
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

// ---- The marks: where you and the boss stand on the battle circle, and the table between you.

export interface Marks {
  /** The middle of each two-square start mark (its column a half): yours the south one (near the door), the boss's the north. */
  you: { c: number; r: number };
  boss: { c: number; r: number };
  /** The squares each walks to, on its mark (then the last half square onto its middle: `settleMs`). */
  youSq: { c: number; r: number };
  bossSq: { c: number; r: number };
  /** Where the board comes in: halfway between the marks. */
  table: { c: number; r: number };
}
/** The battle circle's start marks from a room's layout (its `circle-mark-*` tiles), or null: a room without them. */
export function marksOf(layout: readonly ShopPlace[]): Marks | null {
  const rows = new Map<number, number[]>();
  for (const p of layout) if (/^circle-mark/.test(p.name)) rows.set(p.row, [...(rows.get(p.row) ?? []), p.col]);
  if (rows.size < 2) return null;
  const rs = [...rows.keys()].sort((a, b) => a - b);
  const north = rs[0]!;
  const south = rs[rs.length - 1]!;
  const mid = (r: number) => {
    const cs = rows.get(r)!;
    return (Math.min(...cs) + Math.max(...cs)) / 2;
  };
  const you = { c: mid(south), r: south };
  const boss = { c: mid(north), r: north };
  return {
    you,
    boss,
    // (You come in on the door's east square and walk straight up; the boss beside you on the west, so neither crosses the other.)
    youSq: { c: Math.ceil(you.c), r: south },
    bossSq: { c: Math.floor(boss.c), r: north },
    table: { c: (you.c + boss.c) / 2, r: (south + north) / 2 },
  };
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
export type IntroStep = "line" | "rise" | "idle" | "crack" | "crumble" | "table" | "done";
export interface IntroBeat {
  step: IntroStep;
  at: number;
  end: number;
}
const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);
/**
 * The beats: the line alone, the pyramid rising (`riseAtMs` into the line), holding (its idle) until the line is done, cracking,
 * crumbling, the table on its own for a moment; then done (the storm).
 */
export function introBeats(a: IntroAnims, feel: Pick<typeof CHALLENGE_FEEL, "lineMs" | "riseAtMs" | "tableHoldMs"> = CHALLENGE_FEEL): IntroBeat[] {
  const out: IntroBeat[] = [];
  let t = 0;
  const add = (step: IntroStep, ms: number) => {
    out.push({ step, at: t, end: t + ms });
    t += ms;
  };
  add("line", feel.riseAtMs);
  add("rise", sum(a.rise));
  add("idle", Math.max(0, feel.lineMs - t));
  add("crack", sum(a.crack));
  add("crumble", sum(a.crumble));
  add("table", feel.tableHoldMs);
  out.push({ step: "done", at: t, end: Infinity });
  return out;
}
/** The intro's whole length (ms): when the storm starts. */
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
  /** The pyramid's animation and frame (null: none shows: before it rises, or once it's crumbled). */
  pyramid: { anim: "rise" | "idle" | "crack" | "crumble"; frame: number } | null;
  /** The boss's line is over its head (from facing you until the pyramid cracks). */
  line: boolean;
  /** The table and its board show (from the crumble's clear frame on). */
  table: boolean;
  /** The crumble's last frame (the low drift of sand) lies over the table's foot: kept, as the art allows, until the storm. */
  drift: boolean;
}
export function introAt(beats: readonly IntroBeat[], a: IntroAnims, t: number): IntroNow {
  const b = beats.find((x) => t < x.end) ?? beats[beats.length - 1]!;
  const into = t - b.at;
  const crackAt = beats.find((x) => x.step === "crack")!.at;
  const line = t >= 0 && t < crackAt;
  switch (b.step) {
    case "line":
      return { step: b.step, pyramid: null, line, table: false, drift: false };
    case "rise":
    case "crack":
      return { step: b.step, pyramid: { anim: b.step, frame: frameAt(a[b.step], into, false) }, line, table: false, drift: false };
    case "idle":
      return { step: b.step, pyramid: { anim: "idle", frame: frameAt(a.idle, into, true) }, line, table: false, drift: false };
    case "crumble": {
      const frame = frameAt(a.crumble, into, false);
      return { step: b.step, pyramid: { anim: "crumble", frame }, line, table: frame >= a.tableFrame, drift: false };
    }
    default:
      return { step: b.step, pyramid: null, line, table: true, drift: true };
  }
}
/** The cue each beat starts on (the art's: "rumble" as it rises, "crack", "crumble", and "table" on the crumble's clear frame), and when. */
export function introCues(beats: readonly IntroBeat[], a: IntroAnims): { cue: string; at: number }[] {
  const at = (s: IntroStep) => beats.find((x) => x.step === s)!.at;
  return [
    { cue: "rumble", at: at("rise") },
    { cue: "crack", at: at("crack") },
    { cue: "crumble", at: at("crumble") },
    { cue: "table", at: at("crumble") + sum(a.crumble.slice(0, a.tableFrame)) },
  ];
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
