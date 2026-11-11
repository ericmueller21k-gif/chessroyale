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
  /** When the talk beat began (-1: not yet). */
  private beatAt = -1;
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
    return this.beatAt >= 0;
  }
  /** Talk to him: the beat starts now (once a visit). */
  talk(now: number): void {
    if (this.beatAt < 0) this.beatAt = now;
  }
  /** Where the beat is `now`, or null: not started. */
  step(now: number): BeatStep | null {
    if (this.beatAt < 0) {
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
    if (this.beatAt >= 0) {
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
    if (this.beatAt < 0) {
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
