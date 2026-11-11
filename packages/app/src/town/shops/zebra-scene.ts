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
 *   listening. **The talk beat** (Eric: "if you walk up to him and talk to him, they all of a sudden all stand guard and draw their
 *   breadsticks … point them at you. And then he tells them all to relax. And then they put them down"): the crew stand up (turned to
 *   you at the table's foot) and draw, aim at you with Fedora's line, Don waves them down with his, they lower, his challenge line. The
 *   chatter stops for it, and stays stopped: the crew stay standing (there's no sit-down animation) until the room loads again.
 */
import { SHOP_FEEL } from "../feel.ts";
import { ZEBRA_WATCH_FRAME } from "./zebra-crew.ts";
import { ZEBRA_CHATTER, ZEBRA_GUARD_LINES, ZEBRA_TALK, type ZebraWho } from "./zebra-lines.ts";

/** A clip as the scene needs it: each frame's ms (the art's), and whether it loops. */
export interface SceneClip {
  readonly ms: readonly number[];
  readonly loop: boolean;
}
/** Every person's animations by name (from their art, as the room loads; the test passes the art's own). */
export type SceneClips = Readonly<Record<string, Readonly<Record<string, SceneClip>>>>;

/** One person to draw this frame: their art's name, its animation and frame, their foot (squares), mirrored (facing west). */
export interface SceneFig {
  name: string;
  anim: string;
  frame: number;
  c: number;
  r: number;
  flip: boolean;
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

/** A guard's `watch` frame for you at (x, y): the art's rule. */
export function watchFrame(g: { readonly at: readonly [number, number]; readonly face: number }, x: number, y: number): number {
  let dx = (x - g.at[0]) * g.face;
  if (y < g.at[1] - 1.5) dx -= 2;
  return ZEBRA_WATCH_FRAME(dx);
}

/** How long a line stays up: a base and a little more for each character (SHOP_FEEL.zebra). */
export const lineMs = (text: string): number => SHOP_FEEL.zebra.lineMs + SHOP_FEEL.zebra.perCharMs * text.length;

/** The front room: the guards watching you, their lines now and then, and the counter zebra's from his Talk. */
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

/** The talk beat's steps, in order (the test hook's names). */
export type BeatStep = "stand" | "draw" | "aim" | "relax" | "lower" | "challenge" | "done";

/** The back room: the chatter's loop, and the talk beat once you talk to him. */
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
  /** The talk beat has started (and the chatter stopped for good). */
  talking(): boolean {
    return this.beatAt !== null;
  }
  /** Talk to him: the beat starts now (once a visit). */
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
  /** The beat's length (ms): from Talk to his challenge line gone. */
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
  /** Don and the crew this frame. Into `out` (cleared). */
  figs(now: number, out: SceneFig[]): SceneFig[] {
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
    // The crew, each a stagger after the last: up (turned to you), draw, aim, lower, then standing easy (`puff`).
    ZEBRA_CREW.forEach((p, i) => {
      const u = t - i * Z.staggerMs;
      const crew = this.clips[p.name]!;
      if (u < 0) return fig(p, "sitListen", now, true);
      if (u < clipLen(crew.standUp)) return fig(p, "standUp", u, false);
      const d = u - clipLen(crew.standUp);
      if (d < clipLen(crew.draw)) return fig(p, "draw", d, false);
      const lo = t - T.lower - i * Z.staggerMs;
      if (lo < 0) return fig(p, "aim", d - clipLen(crew.draw), false);
      if (lo < clipLen(crew.lower)) return fig(p, "lower", lo, false);
      return fig(p, "puff", lo - clipLen(crew.lower) + i * 600, false);
    });
    return out;
  }
}

/** What the goons carry out to the pad: the table, its two chairs and the board. */
export type SetupItem = "table" | "bossChair" | "youChair" | "board";
type Pt2 = { c: number; r: number };
/** A carried item this frame: what, where (the carrier's foot), which way he faces. */
export interface CarriedNow {
  item: SetupItem;
  c: number;
  r: number;
  flip: boolean;
}

/**
 * His challenge's set-up in the front room (Eric, Nov 11: "The main room is still where you fight … 4 of his goons who follow you in carry
 * a chair and a board and a table, 1 item per goon. So the board and chairs are in the back room but brought into the front."). Four goons
 * come out of the back room's door after you and Don, one after another, each carrying one thing round the counter and the mixer to the
 * pad (the room's own way, `path`): the table, Don's chair, yours, then the board onto the table; each sets his down and steps back to
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
    carriers.forEach((k, i) => {
      const start = t0 + S.leadMs + i * S.followMs;
      const there = route(door, k.at);
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
      if (now < r.arrive + S.setMs) {
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
