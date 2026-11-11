/**
 * Intros as data (the audit of Nov 6, §5 "Where data cuts most", item 1): a boss's challenge intro is a timeline of beats, played by
 * this one player, and drawn by ShopRoom from the boss's own art. A new boss's intro is a data file (shops/intros/<boss>.ts: its
 * actors' art, its beats), not edits to challenge.ts, intro.ts and ShopRoom.tsx. Pure: no DOM; tested in
 * packages/app/test/intro-timeline.test.ts (each moved intro's beat log against the one recorded on main) and boss-challenge.test.ts.
 *
 * - A **beat** is a named step (`data-intro`, the test hook's `step`) of `ms`, each from where the last ended; its **acts** start
 *   `at` ms into it. The intro's beats (challenge.ts IntroBeat: step, at, end) and its length come from them (`timelineBeats`).
 * - An **act** tells one **actor** what to do from then on, until a later act changes it (the last one wins, channel by channel):
 *   - its look: `play` one of its art's animations (once, held on its last frame, or `loop`; `frame` holds one frame, negative from its
 *     end; `flip` mirrors it), `show` it (an actor drawn without frames of its own: the table, the board, the line), `hide` it, or
 *     `play: null` (the boss and you: back to your own figure); `for` shows it only that long (a line);
 *   - its place: `move` from a place (default: where it is) `to` another over `ms` (default 0: there at once), eased, `hop` squares
 *     high at its middle (the hop back clear of the stools);
 *   - its height: `lift` from one height (squares) to another over `ms` (the board dropping onto Big Boy's blocks).
 *   An act with only a `cue` plays that sound then.
 * - **Cues**: every frame cue of a `play` is played on its frame (looping, again and again) until its beat ends or the actor's next
 *   look, unless the act is `quiet`; plus each act's own `cue`.
 * - The **cast** acts run before the first beat: who is there from the walk in (Timber's log lying by his mark, Smudgy's cloth).
 *
 * Actors: "boss" (its own moves' sheet, or its town figure with `play: null`), "you", "line" and "chant" (the boss's bubbles),
 * "table" (the table's picture), "board" (its slab, board and pieces), "stools" (their place: the table's picture has them), and the
 * boss's own props by the names its data gives them.
 */
import type { Character } from "../../characters/sprite.ts";

/** A place the room knows (ShopRoom `placeOf`): the actor's own mark or clear place (`mark`, `clear`), the table's middle, a stool's. */
export type PlaceName = "mark" | "clear" | "table" | "bossStool" | "youStool";
/** A place, or one of them moved `dc` columns and `dr` rows (Timber's log, `log.at` west of the table's middle). */
export type Place = PlaceName | { readonly at: PlaceName; readonly dc?: number; readonly dr?: number };
/** How a move or a lift goes: evenly, speeding up (`in`: u²), or eased in and out (`smooth`). */
export type Ease = "linear" | "in" | "smooth";

export interface Act {
  /** Who (none: a cue on its own). */
  actor?: string;
  /** Ms into its beat (0). */
  at?: number;
  play?: string | null;
  loop?: boolean;
  frame?: number;
  flip?: boolean;
  show?: true;
  hide?: true;
  for?: number;
  quiet?: true;
  move?: { readonly from?: Place; readonly to: Place; readonly ms?: number; readonly ease?: Ease; readonly hop?: number };
  lift?: { readonly from: number; readonly to: number; readonly ms?: number; readonly ease?: Ease };
  cue?: string;
}
export interface Beat {
  step: string;
  ms: number;
  acts?: readonly Act[];
}
/** An animation's frames: each one's ms and cue (the art's). */
export interface Clip {
  ms: readonly number[];
  cues: readonly (string | undefined)[];
}
export interface Timeline {
  beats: readonly Beat[];
  cast?: readonly Act[];
  /** Each actor's animations, by name (from its art: `clipsOf`). */
  clips: Readonly<Record<string, Readonly<Record<string, Clip>>>>;
}

/** A picture's animations as the timeline needs them (characters/sprite.ts Character's anims: each frame's ms and cue). */
type ArtLike = { anims: Readonly<Record<string, { frames: readonly { ms: number; cue?: string }[] } | undefined>> };
/** Every animation of a picture, as clips. */
export function clipsOf(ch: ArtLike): Record<string, Clip> {
  const out: Record<string, Clip> = {};
  for (const [name, a] of Object.entries(ch.anims)) if (a) out[name] = { ms: a.frames.map((f) => f.ms), cues: a.frames.map((f) => f.cue) };
  return out;
}
const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);
/** An animation's length (ms). */
export const clipMs = (c: Clip): number => sum(c.ms);
/** Ms into an animation that its frame `i` starts (the first frame with cue `cue`, with a string). */
export const frameStart = (c: Clip, i: number | string): number => sum(c.ms.slice(0, typeof i === "string" ? Math.max(0, c.cues.indexOf(i)) : i));

/** The frame (from 0) showing `t` ms into an animation of these frames: looping, or held on its last. */
export function frameOf(ms: readonly number[], t: number, loop: boolean): number {
  const total = sum(ms);
  if (!ms.length || total <= 0) return 0;
  let u = loop ? ((t % total) + total) % total : Math.max(0, t);
  for (let i = 0; i < ms.length; i++) {
    if (u < ms[i]!) return i;
    u -= ms[i]!;
  }
  return ms.length - 1;
}

/** An actor now. */
export interface ActorNow {
  /** Drawn at all. */
  on: boolean;
  /** Its animation (null: none of its own: the boss's and your own figure, or an actor drawn without frames). */
  anim: string | null;
  frame: number;
  flip: boolean;
  /** Its animation (not looping) has played through and is held on its last frame. */
  ended: boolean;
  /** Where it is: `u` (eased, 0 to 1) of the way from one place to another, `hop` squares up. */
  from: Place;
  to: Place;
  u: number;
  hop: number;
  /** How high over its place (squares). */
  lift: number;
}
export interface TimelineNow {
  step: string;
  /** Every actor any act names (never named: off, at its mark). */
  cast: Readonly<Record<string, ActorNow>>;
}

/** An act placed on the intro's clock: when it starts, and when its beat ends (cues stop there). */
interface Placed {
  act: Act;
  start: number;
  beatEnd: number;
}
const ease = (e: Ease | undefined, u: number) => (e === "in" ? u * u : e === "smooth" ? u * u * (3 - 2 * u) : u);
const hasLook = (a: Act) => a.play !== undefined || a.show || a.hide || a.for !== undefined;

/** A timeline ready to play: its acts by actor, in time order, and its beats on the clock. */
export interface Played {
  tl: Timeline;
  beats: { step: string; at: number; end: number }[];
  acts: Map<string, Placed[]>;
  cues: { cue: string; at: number }[];
}
const cache = new WeakMap<Timeline, Played>();
/** The timeline on the clock (made once a timeline). */
export function played(tl: Timeline): Played {
  const hit = cache.get(tl);
  if (hit) return hit;
  const beats: Played["beats"] = [];
  const acts = new Map<string, Placed[]>();
  const loose: Placed[] = [];
  const place = (act: Act, start: number, beatEnd: number) => {
    const p = { act, start, beatEnd };
    if (!act.actor) return void loose.push(p);
    let list = acts.get(act.actor);
    if (!list) acts.set(act.actor, (list = []));
    list.push(p);
    // (`for`: shown that long, then hidden.)
    if (act.for !== undefined) list.push({ act: { actor: act.actor, hide: true }, start: start + act.for, beatEnd });
  };
  for (const a of tl.cast ?? []) place(a, 0, 0);
  let t = 0;
  for (const b of tl.beats) {
    for (const a of b.acts ?? []) place(a, t + (a.at ?? 0), t + b.ms);
    beats.push({ step: b.step, at: t, end: t + b.ms });
    t += b.ms;
  }
  beats.push({ step: "done", at: t, end: Infinity });
  for (const list of acts.values()) list.sort((a, b) => a.start - b.start);
  // The cues: each play's frames' (to its beat's end, or its actor's next look), each act's own; in time order.
  const cues: { cue: string; at: number }[] = [];
  for (const p of loose) if (p.act.cue) cues.push({ cue: p.act.cue, at: p.start });
  for (const [who, list] of acts) {
    list.forEach((p, i) => {
      const a = p.act;
      if (a.cue) cues.push({ cue: a.cue, at: p.start });
      if (!a.play || a.quiet || a.frame !== undefined) return;
      const clip = tl.clips[who]?.[a.play];
      if (!clip || clipMs(clip) <= 0) return;
      const next = list.slice(i + 1).find((q) => hasLook(q.act));
      const to = Math.min(p.beatEnd, next ? next.start : Infinity);
      let at = p.start;
      for (let k = 0; at < to; k = (k + 1) % clip.ms.length) {
        const cue = clip.cues[k];
        if (cue) cues.push({ cue, at });
        at += clip.ms[k]!;
        if (!a.loop && k === clip.ms.length - 1) break;
      }
    });
  }
  cues.sort((a, b) => a.at - b.at);
  const out = { tl, beats, acts, cues };
  cache.set(tl, out);
  return out;
}
/** The intro's beats (challenge.ts IntroBeat), ending with "done". */
export const timelineBeats = (tl: Timeline) => played(tl).beats;
/** Its cues and when (ms into the intro), in order. */
export const timelineCues = (tl: Timeline) => played(tl).cues;

/** One actor `t` ms into the intro (`upTo`: only the acts starting by then; the cast's alone with `castOnly`). */
function actorAt(tl: Timeline, who: string, list: readonly Placed[], t: number, castOnly: boolean): ActorNow {
  const n: ActorNow = { on: false, anim: null, frame: 0, flip: false, ended: false, from: "mark", to: "mark", u: 0, hop: 0, lift: 0 };
  let look: Placed | null = null;
  let move: Placed | null = null;
  let lift: Placed | null = null;
  let here: Place = "mark";
  for (const p of list) {
    if (p.start > t || (castOnly && p.beatEnd > 0)) break;
    if (hasLook(p.act)) look = p;
    if (p.act.move) {
      // (A move from where the last one left it, unless it says.)
      if (move) here = move.act.move!.to;
      move = p;
    }
    if (p.act.lift) lift = p;
  }
  if (look) {
    const a = look.act;
    n.on = !a.hide;
    n.anim = a.hide || a.show ? null : (a.play ?? null);
    n.flip = !!a.flip;
    const clip = n.anim ? tl.clips[who]?.[n.anim] : undefined;
    if (clip && n.on) {
      const len = clip.ms.length;
      if (a.frame !== undefined) n.frame = a.frame < 0 ? Math.max(0, len + a.frame) : a.frame;
      else {
        n.frame = frameOf(clip.ms, t - look.start, !!a.loop);
        n.ended = !a.loop && t - look.start >= clipMs(clip);
      }
    }
  }
  if (move) {
    const m = move.act.move!;
    const ms = m.ms ?? 0;
    const raw = ms <= 0 ? 1 : Math.min(1, Math.max(0, (t - move.start) / Math.max(1, ms)));
    n.from = m.from ?? here;
    n.to = m.to;
    n.u = ease(m.ease, raw);
    n.hop = m.hop && raw > 0 && raw < 1 ? m.hop * Math.sin(Math.PI * raw) : 0;
  }
  if (lift) {
    const l = lift.act.lift!;
    const ms = l.ms ?? 0;
    const raw = ms <= 0 ? 1 : Math.min(1, Math.max(0, (t - lift.start) / Math.max(1, ms)));
    n.lift = l.from + (l.to - l.from) * ease(l.ease, raw);
  }
  return n;
}

/** Everyone `t` ms into the intro, and its step. */
export function timelineAt(tl: Timeline, t: number): TimelineNow {
  const p = played(tl);
  const b = p.beats.find((x) => t < x.end) ?? p.beats[p.beats.length - 1]!;
  const cast: Record<string, ActorNow> = {};
  for (const [who, list] of p.acts) cast[who] = actorAt(tl, who, list, t, false);
  return { step: b.step, cast };
}
/** Who is there from the walk in, before the intro starts (the cast's acts alone). */
export function castBefore(tl: Timeline): Readonly<Record<string, ActorNow>> {
  const p = played(tl);
  const cast: Record<string, ActorNow> = {};
  for (const [who, list] of p.acts) cast[who] = actorAt(tl, who, list, 0, true);
  return cast;
}

/** Where a place is on the room's floor (column, row), for an actor whose own mark and clear place are `mine`. */
export function placeOf(
  p: Place,
  m: { readonly table: { c: number; r: number }; readonly bossStool: { c: number; r: number }; readonly youStool: { c: number; r: number } },
  mine: { readonly mark: { c: number; r: number }; readonly clear: { c: number; r: number } },
): { c: number; r: number } {
  const name = typeof p === "string" ? p : p.at;
  const q = name === "mark" ? mine.mark : name === "clear" ? mine.clear : m[name];
  return typeof p === "string" ? { c: q.c, r: q.r } : { c: q.c + (p.dc ?? 0), r: q.r + (p.dr ?? 0) };
}
/** Where an actor stands now (its foot: column, row), `u` of the way between its places. */
export function standAt(
  a: ActorNow,
  m: Parameters<typeof placeOf>[1],
  mine: Parameters<typeof placeOf>[2],
): { c: number; r: number } {
  const p = placeOf(a.from, m, mine);
  const q = placeOf(a.to, m, mine);
  return { c: p.c + (q.c - p.c) * a.u, r: p.r + (q.r - p.r) * a.u };
}

/** A prop of a boss's intro: its art, where it stands and how it's drawn (ShopRoom `drawCast`). */
export interface Prop {
  /** Its art (its animations are the actor's); none: a part of the room's table ("table": its picture, "board": its slab, board and pieces). */
  ch?: Character;
  /** Its foot at each of these, one drawing each (Timber's stumps, at both stools); none: where its acts move it (from the table). */
  at?: readonly Place[];
  /** Its pixels are the room's (37 a square, the default) or the boss's town figure's (`boss`: Timber's log, the one in his paws). */
  scale?: "room" | "boss";
  /** Its foot this far (its pixels) from its place, by animation (Timber's log: from his foot as he lifts it, and as he works it). */
  off?: Readonly<Record<string, readonly [number, number]>>;
  /** Drawn over everyone (Timber's fog), not with the table by its row. */
  over?: true;
  /** ("board") Its slab rests on the art under it (Big Boy's blocks): lifted until its front is TABLE_BOARD.top over the table's foot. */
  rest?: true;
}
/** A boss's own intro, as data (shops/intros/<boss>.ts), and what the room needs to draw it. */
export interface IntroData {
  /** Its props by actor, drawn in this order (with the table, by its row; then the `over` ones, over everyone). */
  props: Readonly<Record<string, Prop>>;
  /** The boss's own moves' sheet (at its town figure's pixels, facing east as drawn: `flip` faces it west), if it plays any. */
  mover?: Character;
  /**
   * Its figure, for a boss with none in the town (Don Dough, Nov 11: he stays in his bakery's back room, so render.ts BOSS_ART has no
   * picture of him): its idle stands in for the town figure's. None: BOSS_ART's.
   */
  figure?: Character;
  /** Its table's picture (three squares across: a stool, the leg, a stool; default the park table) and its slab's and board's colors. */
  table?: Character;
  palette?: Readonly<Record<string, string>>;
  /** Its storm (the transition: its tile and its front), or `splatter` (Smudgy's); none: the default flash and wipe. */
  storm?: { readonly tile: Character; readonly front: Character };
  splatter?: true;
  /** It swings no God King attack (its transition is its own). */
  noAttack?: true;
  /** The room's pieces it draws in their place (Smudgy's covered table): the room leaves them out in a challenge. */
  stands?: readonly string[];
  /** Its clear place, squares from the table's middle, where it isn't the usual (Timber's: his stump's roots spread wider). */
  clear?: number;
  timeline: Timeline;
  /** What the test hook (`__shopIntro`) shows of it, in the names its e2e reads. */
  view?: (cast: Readonly<Record<string, ActorNow>>) => Record<string, unknown>;
}
/** An intro's data with its clips filled in from its props' art and its mover (the boss's). */
export function defineIntro(d: Omit<IntroData, "timeline"> & { beats: readonly Beat[]; cast?: readonly Act[] }): IntroData {
  const clips: Record<string, Record<string, Clip>> = {};
  for (const [who, p] of Object.entries(d.props)) if (p.ch) clips[who] = clipsOf(p.ch);
  if (d.mover) clips.boss = clipsOf(d.mover);
  const { beats, cast, ...rest } = d;
  return { ...rest, timeline: { beats, cast, clips } };
}
