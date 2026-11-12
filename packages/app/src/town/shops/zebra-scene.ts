/**
 * Rolling Dough's people (Nov 11; Eric's design, notes/zebra-eric.md), pure: who stands where in each room, which of their animations
 * shows, and who's talking. ShopRoom draws them (their frames drawn once as the room loads) and the speech bubbles; nothing here
 * touches the page. Tested in packages/app/test/shop-zebra.test.ts.
 *
 * - **The front room:** the two door guards just inside the door, flanking the walkway. Their `watch` follows you (the art's rule,
 *   shop-zebra-nov10.md): `dx` your column less his (negated for the mirrored one), two squares less once you're more than 1.5 rows north
 *   of him (past him, he looks back over his shoulder), its frame `ZEBRA_WATCH_FRAME(dx)`. Now and then one says his next "nothing here
 *   but a bakery" line, sooner while you stand near them or by the back door. The counter zebra's lines come from his Talk.
 * - **The back room:** Don Dough in his wingback at the head of the table, the crew on the bench along its north side turned to him. The
 *   chatter loops in bubbles (the crew argue, he one-ups them: zebra-lines.ts), each speaker on his talking or arguing loop, the others
 *   listening. **The challenge beat** (Eric: "if you walk up to him and talk to him, they all of a sudden all stand guard and draw their
 *   breadsticks … point them at you. And then he tells them all to relax. And then they put them down"; Nov 11: "when you hit challenge,
 *   it just goes through the talk animation no matter what"): his card's Challenge starts it. The crew stand up and draw, aim at you
 *   with Fedora's line (each turned to your side and his roll at the angle nearest you, following you as you move: `aimAt`), Don waves
 *   them down with his, they lower, his challenge line. The chatter stops for good. Then **the walk-out** (`WalkOut`; Eric: "watch all
 *   of them walk out, like pick up the stuff in the back and walk out"): four goons each pick up one thing of the set kept in the
 *   room (`ZEBRA_BACK_SET`) and carry it out through the back door, Don and you following; the front room's `SetupScene` goes on.
 */
import { SHOP_FEEL } from "../feel.ts";
import { ZEBRA_AIM_ANGLES, ZEBRA_AIM_LOOP, ZEBRA_WATCH_FRAME } from "./zebra-crew.ts";
import { ZEBRA_CHATTER, ZEBRA_GUARD_LINES, ZEBRA_TALK, type ZebraWho } from "./zebra-lines.ts";

/** A clip as the scene needs it: each frame's ms (the art's), and whether it loops. */
export interface SceneClip {
  readonly ms: readonly number[];
  readonly loop: boolean;
}
/** Every person's animations by name (from their art, as the room loads; the test passes the art's own). */
export type SceneClips = Readonly<Record<string, Readonly<Record<string, SceneClip>>>>;

/**
 * One person to draw this frame: their art's name, its animation and frame, their foot (squares), mirrored (facing west); how solid
 * (`a`, 1 unless they're going or coming through a door) and lifted (`up`, the room's pixels: Don's step).
 */
export interface SceneFig {
  name: string;
  anim: string;
  frame: number;
  c: number;
  r: number;
  flip: boolean;
  a?: number;
  up?: number;
}
/** Who says what now (a speech bubble over them). */
export interface SceneSay {
  who: ZebraWho;
  text: string;
}

/** The front room's guards: their art, foot and resting facing (the art's SHOP_ZEBRA_GUARDS). */
export const ZEBRA_GUARDS = [
  { who: "guard-a", name: "guard-a", at: [8, 17.2], face: 1 },
  { who: "guard-b", name: "guard-b", at: [11, 17.2], face: -1 },
] as const;
/** The back room: Don Dough in his wingback (facing east, as drawn), the crew on the bench turned to him (the art's SHOP_ZEBRA_BACK_SEATS). */
export const ZEBRA_DON = { who: "don", name: "don", at: [4.3, 6.82], face: 1 } as const;
export const ZEBRA_CREW = [
  { who: "crew-c", name: "crew-c", at: [5.15, 5.06], face: -1 },
  { who: "crew-d", name: "crew-d", at: [6.15, 5.06], face: -1 },
  { who: "crew-e", name: "crew-e", at: [7.15, 5.06], face: -1 },
] as const;

const sum = (ms: readonly number[]) => ms.reduce((a, b) => a + b, 0);
/** The frame `t` ms into a clip: looping, or held on its last. */
export function clipFrame(c: SceneClip | undefined, t: number): number {
  if (!c || !c.ms.length) return 0;
  const total = sum(c.ms);
  let u = c.loop ? ((t % total) + total) % total : Math.max(0, t);
  for (let i = 0; i < c.ms.length; i++) {
    if (u < c.ms[i]!) return i;
    u -= c.ms[i]!;
  }
  return c.ms.length - 1;
}
/** A clip's length (ms). */
export const clipLen = (c: SceneClip | undefined): number => (c ? sum(c.ms) : 0);

/**
 * Which way a standing crew member at `at` points his roll at you at (x, y) (your foot, squares): mirrored when you're west of him,
 * and the index into ZEBRA_AIM_ANGLES nearest the angle down to your middle on screen (your rows toward the camera are `aimRowK` of
 * a column; his roll is `aimDrop` squares above your middle). Plain arithmetic: called per draw, nothing kept.
 */
export function aimAt(at: readonly [number, number], x: number, y: number): { i: number; flip: boolean } {
  const B = SHOP_FEEL.zebra.beat;
  const dx = x - at[0];
  const deg = (Math.atan2((y - at[1]) * B.aimRowK + B.aimDrop, Math.max(0.25, Math.abs(dx))) * 180) / Math.PI;
  let i = 0;
  for (let k = 1; k < ZEBRA_AIM_ANGLES.length; k++) if (Math.abs(ZEBRA_AIM_ANGLES[k]! - deg) < Math.abs(ZEBRA_AIM_ANGLES[i]! - deg)) i = k;
  return { i, flip: dx < 0 };
}

/** A guard's `watch` frame for you at (x, y): the art's rule. */
export function watchFrame(g: { readonly at: readonly [number, number]; readonly face: number }, x: number, y: number): number {
  let dx = (x - g.at[0]) * g.face;
  if (y < g.at[1] - 1.5) dx -= 2;
  return ZEBRA_WATCH_FRAME(dx);
}

/** How long a line stays up: a base and a little more for each character (SHOP_FEEL.zebra). */
export const lineMs = (text: string): number => SHOP_FEEL.zebra.lineMs + SHOP_FEEL.zebra.perCharMs * text.length;

/** The front room: the guards watching you, their lines now and then and when tapped, and the counter zebra's from his Talk. */
export class FrontScene {
  private next = 0;
  private lineI = 0;
  private say: { who: ZebraWho; text: string; until: number } | null = null;
  constructor(
    private readonly clips: SceneClips,
    private readonly rand: () => number = Math.random,
    now = 0,
  ) {
    this.next = now + this.wait(false);
  }
  private wait(near: boolean): number {
    const [a, b] = near ? SHOP_FEEL.zebra.guardNearMs : SHOP_FEEL.zebra.guardMs;
    return a + this.rand() * (b - a);
  }
  /**
   * A frame on, you at (x, y), `near` (beside the guards, or by the back door: their lines come sooner). A guard says his next line
   * when one is due and nobody's talking.
   */
  step(now: number, near: boolean): void {
    if (this.say && now >= this.say.until) this.say = null;
    // (Near them, the next line is never further off than a near wait.)
    if (near) this.next = Math.min(this.next, now + SHOP_FEEL.zebra.guardNearMs[1]);
    if (now < this.next || this.say) return;
    const l = ZEBRA_GUARD_LINES[this.lineI % ZEBRA_GUARD_LINES.length]!;
    this.lineI++;
    this.say = { who: l.who, text: l.text, until: now + lineMs(l.text) };
    this.next = this.say.until + this.wait(near);
  }
  /** The counter zebra says `text` now (his Talk): over anyone else's. */
  keeper(now: number, text: string): void {
    this.say = { who: "keeper", text, until: now + lineMs(text) };
    this.next = Math.max(this.next, this.say.until + SHOP_FEEL.zebra.guardNearMs[0]);
  }
  /** A guard you tapped says `text` now ("He's in the back."): over anyone else's. */
  guard(now: number, who: "guard-a" | "guard-b", text: string): void {
    this.say = { who, text, until: now + lineMs(text) };
    this.next = Math.max(this.next, this.say.until + SHOP_FEEL.zebra.guardNearMs[0]);
  }
  saying(): SceneSay | null {
    return this.say ? { who: this.say.who, text: this.say.text } : null;
  }
  /** The guards this frame, you at (x, y): each on his `watch` frame. Into `out` (cleared). */
  figs(now: number, x: number, y: number, out: SceneFig[]): SceneFig[] {
    out.length = 0;
    for (const g of ZEBRA_GUARDS) out.push({ name: g.name, anim: "watch", frame: watchFrame(g, x, y), c: g.at[0], r: g.at[1], flip: g.face < 0 });
    void now;
    void this.clips;
    return out;
  }
}

/** The challenge beat's steps, in order (the test hook's names). */
export type BeatStep = "stand" | "draw" | "aim" | "relax" | "lower" | "challenge" | "done";

/** The back room: the chatter's loop, and the challenge beat once you press his Challenge. */
export class BackScene {
  /** Where in the chatter (exchange, line) and when that line started. */
  private ex = 0;
  private li = 0;
  private lineAt: number;
  /** When the talk beat began (null: not yet). */
  private beatAt: number | null = null;
  /** Its moments (ms from its start), from the art's frames. */
  private readonly T: { up: number; drawn: number; line: number; relax: number; lower: number; lowered: number; challenge: number; end: number };
  constructor(
    private readonly clips: SceneClips,
    now = 0,
    /** Where the chatter starts (an exchange's index): a test plays one from the top. */
    start = 0,
  ) {
    this.ex = start % ZEBRA_CHATTER.length;
    this.lineAt = now + SHOP_FEEL.zebra.firstMs;
    const crew = clips["crew-d"]!;
    const Z = SHOP_FEEL.zebra.beat;
    const up = clipLen(crew.standUp) + Z.staggerMs * 2;
    const drawn = up + clipLen(crew.draw);
    const line = drawn + Z.aimLeadMs;
    const relax = line + lineMs(ZEBRA_TALK.draw.text);
    const lower = relax + Z.lowerAfterMs;
    const lowered = lower + clipLen(crew.lower) + Z.staggerMs * 2;
    const challenge = Math.max(relax + lineMs(ZEBRA_TALK.relax.text), lowered) + Z.gapMs;
    const end = challenge + lineMs(ZEBRA_TALK.challenge.text);
    this.T = { up, drawn, line, relax, lower, lowered, challenge, end };
  }
  /** The challenge beat has started (and the chatter stopped for good). */
  talking(): boolean {
    return this.beatAt !== null;
  }
  /** His Challenge: the beat starts now (once a visit). */
  talk(now: number): void {
    if (this.beatAt === null) this.beatAt = now;
  }
  /** Where the beat is `now`, or null: not started. */
  step(now: number): BeatStep | null {
    if (this.beatAt === null) {
      this.stepChatter(now);
      return null;
    }
    const t = now - this.beatAt;
    const T = this.T;
    return t < T.up ? "stand" : t < T.drawn ? "draw" : t < T.relax ? "aim" : t < T.lower ? "relax" : t < T.challenge ? "lower" : t < T.end ? "challenge" : "done";
  }
  /** The beat's length (ms): from Challenge to his challenge line gone. */
  beatLength(): number {
    return this.T.end;
  }
  private stepChatter(now: number): void {
    const Z = SHOP_FEEL.zebra;
    for (;;) {
      const ex = ZEBRA_CHATTER[this.ex]!;
      const l = ex[this.li]!;
      const end = this.lineAt + lineMs(l.text);
      const gap = this.li < ex.length - 1 ? Z.lineGapMs : Z.exchangeGapMs;
      if (now < end + gap) return;
      this.lineAt = end + gap;
      if (++this.li >= ex.length) {
        this.li = 0;
        this.ex = (this.ex + 1) % ZEBRA_CHATTER.length;
      }
    }
  }
  /** The chatter's place now (the test hook's). */
  where(): { exchange: number; line: number } {
    return { exchange: this.ex, line: this.li };
  }
  /** Who's saying what now: a chatter line while it's up, the beat's lines in it; null between lines. */
  saying(now: number): SceneSay | null {
    if (this.beatAt !== null) {
      const t = now - this.beatAt;
      const T = this.T;
      const on = (at: number, text: string) => t >= at && t < at + lineMs(text);
      if (on(T.line, ZEBRA_TALK.draw.text)) return { who: ZEBRA_TALK.draw.who, text: ZEBRA_TALK.draw.text };
      if (on(T.relax, ZEBRA_TALK.relax.text)) return { who: "don", text: ZEBRA_TALK.relax.text };
      if (on(T.challenge, ZEBRA_TALK.challenge.text)) return { who: "don", text: ZEBRA_TALK.challenge.text };
      return null;
    }
    const l = ZEBRA_CHATTER[this.ex]![this.li]!;
    return now >= this.lineAt && now < this.lineAt + lineMs(l.text) ? { who: l.who, text: l.text } : null;
  }
  /** Don and the crew this frame, you at (x, y) (they stand turned to you and aim at you). Into `out` (cleared). */
  figs(now: number, out: SceneFig[], x = 99, y = 7): SceneFig[] {
    out.length = 0;
    const say = this.saying(now);
    const fig = (p: { readonly name: string; readonly at: readonly [number, number] }, anim: string, t: number, flip: boolean) =>
      out.push({ name: p.name, anim, frame: clipFrame(this.clips[p.name]?.[anim], t), c: p.at[0], r: p.at[1], flip });
    if (this.beatAt === null) {
      // The chatter: the speaker on his loop (a crew member arguing or talking; Don scoffing or talking), the rest listening.
      const l = ZEBRA_CHATTER[this.ex]![this.li]!;
      const t = now - this.lineAt;
      fig(ZEBRA_DON, say?.who === "don" ? (l.scoff ? "sitScoff" : "sitTalk") : "sitListen", say?.who === "don" ? t : now, false);
      ZEBRA_CREW.forEach((p, i) => {
        const speaking = say?.who === p.who;
        // (Fedora puffs on his breadstick while the others talk, every other exchange.)
        const idle = p.who === "crew-d" && this.ex % 2 === 1 ? "sitPuff" : "sitListen";
        fig(p, speaking ? (l.argue ? "sitArgue" : "sitTalk") : idle, speaking ? t : now + i * 700, true);
      });
      return out;
    }
    const t = now - this.beatAt;
    const T = this.T;
    const Z = SHOP_FEEL.zebra.beat;
    // Don: listening, then waving them down (`sitRelax`, once), then his challenge (talking), then listening.
    if (t < T.relax) fig(ZEBRA_DON, "sitListen", now, false);
    else if (t < T.challenge) fig(ZEBRA_DON, "sitRelax", t - T.relax, false);
    else if (t < T.end) fig(ZEBRA_DON, "sitTalk", t - T.challenge, false);
    else fig(ZEBRA_DON, "sitListen", now, false);
    // The crew, each a stagger after the last: up (turned to you), draw, aim at you, lower, then standing easy (`puff`). Each faces
    // your side all through, and while he aims his roll points at you (`aimAt`'s frame for your angle, on the aim loop's beat),
    // from the draw's swing on; his lower starts from about the angle he held.
    ZEBRA_CREW.forEach((p, i) => {
      const u = t - i * Z.staggerMs;
      const crew = this.clips[p.name]!;
      if (u < 0) return fig(p, "sitListen", now, true);
      const aim = aimAt(p.at, x, y);
      if (u < clipLen(crew.standUp)) return fig(p, "standUp", u, aim.flip);
      const d = u - clipLen(crew.standUp);
      if (d < swingMs(crew.draw)) return fig(p, "draw", d, aim.flip);
      const lo = t - T.lower - i * Z.staggerMs;
      if (lo < 0) {
        const f = clipFrame(crew.aim, d - swingMs(crew.draw));
        return out.push({ name: p.name, anim: "aimAt", frame: aim.i * ZEBRA_AIM_LOOP + f, c: p.at[0], r: p.at[1], flip: aim.flip });
      }
      // (Held at 20 degrees or more, his lower starts at its second frame (25), at 30 or more its third (50).)
      const skip = crew.lower ? crew.lower.ms.slice(0, ZEBRA_AIM_ANGLES[aim.i]! >= 30 ? 2 : ZEBRA_AIM_ANGLES[aim.i]! >= 20 ? 1 : 0).reduce((a, b) => a + b, 0) : 0;
      if (lo + skip < clipLen(crew.lower)) return fig(p, "lower", lo + skip, aim.flip);
      return fig(p, "puff", lo - clipLen(crew.lower) + i * 600, aim.flip);
    });
    return out;
  }
}
/** The draw's swing (its first three frames: from his side, up, round); the aim takes over from there. */
const swingMs = (c: SceneClip | undefined): number => (c ? sum(c.ms.slice(0, 3)) : 0);

/**
 * The set kept in the back room (Eric, Nov 11: "the board and chairs are in the back room but brought into the front"): your chair
 * nearest the door, Don's, then the table with the board lying on it, along the rug's front before the big table (squares: each one's
 * foot; row 8, as a computer's view of the room ends at row 9). Its squares are solid. Who carries which, in the order: ZEBRA_OUT.
 */
export const ZEBRA_BACK_SET: Readonly<Record<SetupItem, readonly [number, number]>> = {
  youChair: [5.3, 8.3],
  bossChair: [6.2, 8.3],
  table: [7.1, 8.3],
  board: [7.1, 8.3],
};
/** The set's squares (solid: nobody walks through it). */
export const ZEBRA_BACK_SET_SQUARES = [
  { c: 5, r: 8 },
  { c: 6, r: 8 },
  { c: 7, r: 8 },
] as const;
type P2 = readonly [number, number];
/**
 * The walk-out's goons (their art's names), what each carries and his way (squares, a figure's foot): from where he stands to just above
 * his thing (row 9, the free row between the set and the room's front wall), then west along it and out of the door (columns 3-4, row 10).
 * The crew file off the bench east (the table blocks the way south), down past the table's east end (column 9, clear of you at its foot)
 * and back west; the flat-cap door guard comes in through the door for your chair. The board before the table: it lies on it.
 */
const EXIT: readonly P2[] = [
  [4.4, 9],
  [4.1, 9.6],
  [4.1, 11],
];
const LANE: readonly P2[] = [
  [9.1, 5.1],
  [9.1, 9],
];
export const ZEBRA_OUT: readonly { name: string; item: SetupItem; start: number; to: readonly P2[] }[] = [
  { name: "guard-a", item: "youChair", start: 0, to: [[4.1, 11], [4.1, 9.6], [5.3, 9]] },
  { name: "crew-e", item: "bossChair", start: 0, to: [[7.15, 5.06], ...LANE, [6.2, 9]] },
  { name: "crew-d", item: "board", start: 1, to: [[6.15, 5.06], ...LANE, [7.1, 9]] },
  { name: "crew-c", item: "table", start: 2, to: [[5.15, 5.06], ...LANE, [7.1, 9]] },
];
/**
 * Don's way out: up out of his wingback and forward off it, down to the door and through. (The door's east half, as everyone's: its
 * west half is at a phone's edge.)
 */
const DON_OUT: readonly P2[] = [ZEBRA_DON.at, [4.2, 7.9], [4.1, 9.6], [4.1, 11]];
const lenOfPts = (pts: readonly P2[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]), 0);
/** `u` squares along a polyline: where, and its leg's east-west way. Into `o`. */
function along(pts: readonly P2[], u: number, o: { c: number; r: number; dc: number }): void {
  let left = Math.max(0, u);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= d || i === pts.length - 1) {
      const k = d ? Math.min(1, left / d) : 1;
      o.c = a[0] + (b[0] - a[0]) * k;
      o.r = a[1] + (b[1] - a[1]) * k;
      o.dc = b[0] - a[0];
      return;
    }
    left -= d;
  }
}
/** How solid a figure is at row `r` in the back room: fading out through the door (SHOP_FEEL.zebra.out.fade). */
export const doorAlpha = (r: number): number => {
  const [a, b] = SHOP_FEEL.zebra.out.fade;
  return Math.max(0, Math.min(1, (b - r) / (b - a)));
};

/**
 * The walk-out (Nov 11), from the moment his challenge line ends (`t0`): the goons pick up the set and carry it out of the back door
 * (ZEBRA_OUT; the flat-cap door guard comes in for your chair), Don gets up and follows, then you (ShopRoom walks you: `youAt`). The
 * camera holds the room; once you're through the door the room fades to the front room (Town.tsx challengeHere). Pure; times are ms.
 */
export class WalkOut {
  private readonly runs: { name: string; item: SetupItem; start: number; to: readonly P2[]; there: number; pick: number; out: readonly P2[]; gone: number }[];
  /** When Don gets up, and when you set off. */
  readonly donAt: number;
  readonly youAt: number;
  private readonly o = { c: 0, r: 0, dc: 0 };
  constructor(
    private readonly clips: SceneClips,
    private readonly t0: number,
  ) {
    const O = SHOP_FEEL.zebra.out;
    this.runs = ZEBRA_OUT.map((k) => {
      const start = t0 + k.start * O.followMs;
      const there = start + lenOfPts(k.to) * O.stepMs;
      const pick = there + O.pickMs;
      const out = [k.to[k.to.length - 1]!, ...EXIT];
      return { ...k, start, there, pick, out, gone: pick + lenOfPts(out) * O.stepMs };
    });
    this.donAt = Math.max(...this.runs.map((r) => r.pick)) + O.donAfterMs;
    this.youAt = this.donAt + O.youAfterMs;
  }
  /** When the last goon is through the door, and when Don is. */
  goonsGone(): number {
    return Math.max(...this.runs.map((r) => r.gone));
  }
  donGone(): number {
    return this.donAt + lenOfPts(DON_OUT) * SHOP_FEEL.zebra.out.donStepMs;
  }
  /** The set's things still where they're kept at `now`. */
  kept(now: number, out: SetupItem[]): SetupItem[] {
    out.length = 0;
    for (const r of this.runs) if (now < r.there + SHOP_FEEL.zebra.out.pickMs / 2) out.push(r.item);
    return out;
  }
  /** Who stands where this frame and what's carried (into `out` and `carried`, both cleared). Don's on his seat until he gets up. */
  figs(now: number, out: SceneFig[], carried: CarriedNow[]): void {
    out.length = 0;
    carried.length = 0;
    const O = SHOP_FEEL.zebra.out;
    const o = this.o;
    const clip = (n: string, a: string) => this.clips[n]?.[a];
    // Don: seated (listening) until he gets up; then his standing figure stepping out to the door, a little hop a step.
    if (now < this.donAt) out.push({ name: "don", anim: "sitListen", frame: clipFrame(clip("don", "sitListen"), now), c: ZEBRA_DON.at[0], r: ZEBRA_DON.at[1], flip: false });
    else {
      const u = (now - this.donAt) / O.donStepMs;
      along(DON_OUT, u, o);
      const a = doorAlpha(o.r);
      if (a > 0) out.push({ name: "don", anim: "idle", frame: clipFrame(clip("don", "idle"), now), c: o.c, r: o.r, flip: o.dc < 0, a, up: Math.abs(Math.sin(Math.PI * u)) * 3 });
    }
    for (const r of this.runs) {
      if (now < r.start) {
        // (The crew standing easy where the beat left them; the guard still out front.)
        if (r.name !== "guard-a") out.push({ name: r.name, anim: "puff", frame: clipFrame(clip(r.name, "puff"), now), c: r.to[0]![0], r: r.to[0]![1], flip: false });
        continue;
      }
      if (now < r.there) {
        along(r.to, (now - r.start) / O.stepMs, o);
        const a = doorAlpha(o.r);
        if (a > 0) out.push({ name: r.name, anim: "walk", frame: clipFrame(clip(r.name, "walk"), now - r.start), c: o.c, r: o.r, flip: o.dc < 0, a });
        continue;
      }
      if (now < r.pick) {
        // (Bent to it, facing the way out: west.)
        const p = r.to[r.to.length - 1]!;
        out.push({ name: r.name, anim: "carry", frame: 0, c: p[0], r: p[1], flip: true });
        if (now >= r.there + O.pickMs / 2) carried.push({ item: r.item, c: p[0], r: p[1], flip: true });
        continue;
      }
      if (now < r.gone) {
        along(r.out, (now - r.pick) / O.stepMs, o);
        const a = doorAlpha(o.r);
        if (a <= 0) continue;
        out.push({ name: r.name, anim: "carry", frame: clipFrame(clip(r.name, "carry"), now - r.pick), c: o.c, r: o.r, flip: o.dc <= 0, a });
        carried.push({ item: r.item, c: o.c, r: o.r, flip: o.dc <= 0, a });
      }
    }
    void this.t0;
  }
}

/** What the goons carry out to the pad: the table, its two chairs and the board. */
export type SetupItem = "table" | "bossChair" | "youChair" | "board";
type Pt2 = { c: number; r: number };
/** A carried item this frame: what, where (the carrier's foot), which way he faces; how solid (through a door). */
export interface CarriedNow {
  item: SetupItem;
  c: number;
  r: number;
  flip: boolean;
  a?: number;
}

/**
 * His challenge's set-up in the front room (Eric, Nov 11: "The main room is still where you fight … 4 of his goons who follow you in carry
 * a chair and a board and a table, 1 item per goon. So the board and chairs are in the back room but brought into the front."). Four goons
 * come through the back room's door after you and Don (from behind it: the walk-out's other side), one after another, each carrying one
 * thing round the counter and the mixer to the pad (the room's own way, `path`): the table, Don's chair, yours, then the board onto the
 * table; each sets his down and steps back to
 * watch behind the table, the fifth (the door guard in the paper cap) walking over from the door to stand with them. Everyone ends on his
 * watch spot facing the table, in a row `watchBack` behind it, so the board, Don and you stay clear. Pure; times are ms.
 */
export class SetupScene {
  private readonly runs: {
    name: string;
    item: SetupItem | null;
    start: number;
    /** The way there (squares, then the exact spot), its end time, when the item is set, the way back to watch, its end. */
    there: Pt2[];
    arrive: number;
    set: number;
    back: Pt2[];
    done: number;
    idle: string;
  }[] = [];
  constructor(
    private readonly clips: SceneClips,
    /** The room's way from one square to another (room.ts findPath: the squares after `from`), or null. */
    path: (from: Pt2, to: Pt2) => Pt2[] | null,
    m: { table: Pt2; bossStool: Pt2; youStool: Pt2 },
    /** The square just inside the back door (where you come out), and the paper-cap guard's post. */
    door: Pt2,
    post: readonly [number, number],
    /** When you start walking out (the room's first frame, plus its beat just inside). */
    t0: number,
  ) {
    const S = SHOP_FEEL.zebra.setup;
    const T = m.table;
    const row = T.r - S.watchBack;
    const watch = (k: number): Pt2 => ({ c: T.c + k * S.watchGap, r: row });
    const sqOf = (p: Pt2) => ({ c: Math.round(p.c), r: Math.round(p.r) });
    /** From `from` to `to`: the room's squares, then the exact spot. */
    const route = (from: Pt2, to: Pt2): Pt2[] => {
      const a = sqOf(from);
      const b = sqOf(to);
      return [from, ...(path(a, b) ?? [b]), to];
    };
    const carriers: { name: string; item: SetupItem; at: Pt2; watch: number }[] = [
      { name: "crew-c", item: "table", at: { c: T.c, r: T.r - 1 }, watch: 0 },
      { name: "crew-e", item: "bossChair", at: { c: m.bossStool.c, r: T.r - 1 }, watch: -1 },
      { name: "guard-a", item: "youChair", at: { c: m.youStool.c, r: T.r - 1 }, watch: 1 },
      { name: "crew-d", item: "board", at: { c: T.c, r: T.r - 1 }, watch: -2 },
    ];
    const len = (pts: Pt2[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.c - pts[i]!.c, p.r - pts[i]!.r), 0);
    // (Each comes through the door: from behind it, out of sight behind the wall until he steps through, so nobody pops in.)
    const through = { c: door.c - 0.4, r: door.r - 1.6 };
    carriers.forEach((k, i) => {
      const start = t0 + S.leadMs + i * S.followMs;
      const there = [through, ...route(door, k.at)];
      const arrive = start + len(there) * S.stepMs;
      const back = [k.at, watch(k.watch)];
      const done = arrive + S.setMs + len(back) * S.backMs;
      this.runs.push({ name: k.name, item: k.item, start, there, arrive, set: arrive + S.setMs / 2, back, done, idle: k.name === "guard-a" ? "guard" : "puff" });
    });
    // (The paper-cap guard walks over from his post by the door, his roll at port, as the first goon comes out.)
    const from = { c: post[0], r: post[1] };
    const there = route(from, watch(2));
    const start = t0 + S.leadMs;
    const arrive = start + len(there) * S.stepMs;
    this.runs.push({ name: "guard-b", item: null, start, there, arrive, set: arrive, back: [], done: arrive, idle: "guard" });
    this.table = T;
  }
  private readonly table: Pt2;
  /** When the last of them is on his watch spot. */
  end(): number {
    return Math.max(...this.runs.map((r) => r.done));
  }
  /** Each item set down by `now`. */
  placed(now: number): SetupItem[] {
    return this.runs.filter((r) => r.item && now >= r.set).map((r) => r.item!);
  }
  /** Who stands where this frame, and what's being carried (into `out` and `carried`, both cleared). */
  figs(now: number, out: SceneFig[], carried: CarriedNow[]): void {
    out.length = 0;
    carried.length = 0;
    const at = (pts: Pt2[], u: number): { c: number; r: number; dc: number } => {
      // (`u` squares along the polyline; its last leg's direction.)
      let left = u;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const d = Math.hypot(b.c - a.c, b.r - a.r);
        if (left <= d || i === pts.length - 1) {
          const k = d ? Math.min(1, left / d) : 1;
          return { c: a.c + (b.c - a.c) * k, r: a.r + (b.r - a.r) * k, dc: b.c - a.c };
        }
        left -= d;
      }
      const p = pts[pts.length - 1]!;
      return { c: p.c, r: p.r, dc: 0 };
    };
    const S = SHOP_FEEL.zebra.setup;
    const faceTable = (c: number) => c > this.table.c + 0.01;
    for (const r of this.runs) {
      const clip = (a: string) => this.clips[r.name]?.[a];
      if (now < r.start) {
        // (Still in the back room; the guard at his post.)
        if (r.name === "guard-b") out.push({ name: r.name, anim: "guard", frame: clipFrame(clip("guard"), now), c: r.there[0]!.c, r: r.there[0]!.r, flip: true });
        continue;
      }
      if (now < r.arrive) {
        const p = at(r.there, (now - r.start) / S.stepMs);
        const anim = r.item ? "carry" : "walk";
        out.push({ name: r.name, anim, frame: clipFrame(clip(anim), now - r.start), c: p.c, r: p.r, flip: p.dc < 0 });
        if (r.item) carried.push({ item: r.item, c: p.c, r: p.r, flip: p.dc < 0 });
        continue;
      }
      // (Setting his thing down; the paper-cap guard has none: he's straight on his watch.)
      if (r.item && now < r.arrive + S.setMs) {
        const p = r.there[r.there.length - 1]!;
        out.push({ name: r.name, anim: "carry", frame: 0, c: p.c, r: p.r, flip: faceTable(p.c) });
        if (r.item && now < r.set) carried.push({ item: r.item, c: p.c, r: p.r, flip: faceTable(p.c) });
        continue;
      }
      if (now < r.done) {
        // (Stepping back to watch, facing the table.)
        const p = at(r.back, (now - r.arrive - S.setMs) / S.backMs);
        out.push({ name: r.name, anim: "walk", frame: clipFrame(clip("walk"), now), c: p.c, r: p.r, flip: faceTable(p.c) });
        continue;
      }
      const p = r.back.length ? r.back[r.back.length - 1]! : r.there[r.there.length - 1]!;
      out.push({ name: r.name, anim: r.idle, frame: clipFrame(clip(r.idle), now + r.start), c: p.c, r: p.r, flip: faceTable(p.c) });
    }
  }
}
