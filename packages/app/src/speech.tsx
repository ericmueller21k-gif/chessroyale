/**
 * Speech: the one rule for every line a boss or the God King says (Eric, Oct 10, 2026: Ginger's line came and went at
 * once). The numbers are SPEECH in settings.ts.
 *
 * - **Its time.** A line types out, then stays fully readable for a time that grows with its length (`readMs` plus
 *   `perCharMs` a character, and `longExtraMs` more past `longChars`, at most `maxReadMs`; a tester's `?talkplus=` adds
 *   to it), then fades. Nothing a screen does cuts that short: the line lives in its speaker's Voice, not in a screen,
 *   so the boss's turn ending, the next screen or the next moment don't take it away (a new screen picks it up where
 *   it was). Eric, Oct 24: "I couldn't even see what the heck he was saying… because it was so fast. And it shouldn't
 *   linger forever… they need to be like a second longer if they're like two rows or more than a certain number of
 *   words, and then even… sit out a little bit longer."
 * - **Taking turns.** Each speaker (the boss, the God King) has one Voice, and says one line at a time. A line said
 *   while another is up waits its turn, highest priority first, unless it's critical and the one up isn't: then it
 *   cuts in. A line that can't start within `waitMs` of being said is dropped (it would be stale). Chatter (the
 *   lowest, the Hidden Boss's muttering in phase 2) is said only when nothing else is (its caller checks), and any
 *   other line cuts in on it.
 * - **Never taken off unread.** Once a line has started, nothing takes it off before it has typed out and been fully
 *   readable for `minReadMs`: a line that would cut in sooner waits for that, then cuts in (still dropped after
 *   `waitMs`). (Oct 24: Babur's thinking line, which had waited its turn behind his balloon's cheer, was up for a
 *   quarter of a second when his hoops' line, critical, cut in.)
 * - **Never hidden by a fit check.** A box that would run off the screen takes a smaller size, a step at a time, and
 *   past the last step is moved back into view (SpeechBox). Its size is settled once per line, before its first paint.
 *
 * A new boss gets all of this by saying its lines into `bossVoice` (the boss screen does it for every power moment
 * from its BossUi, the boss character for its reactions); its words show in its text box beside it, on every screen.
 */
import type { ComponentChildren, JSX } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { SPEECH } from "@chessroyale/core";
import { talkPlusMs, testSwitchesAllowed } from "./test-switches.ts";
import { useFrameNow } from "./components/Countdown.tsx";
import { lineLength, plainLine, sliceLine, type LineSeg } from "./speech-icons.ts";
import { mooIconSprite, type MooIconId } from "./characters/moo.ts";
import { renderFrame } from "./characters/sprite.ts";

/** How much a line matters: only a critical line cuts in on another (and any line on chatter); the rest wait their turn. */
export const CHATTER = -1;
export const LOW = 0;
export const NORMAL = 1;
export const CRITICAL = 2;
export type Priority = typeof CHATTER | typeof LOW | typeof NORMAL | typeof CRITICAL;

/**
 * A line on screen: its words, its moment (`key`), when it started and when it's gone (its fade included), and the
 * soonest another may cut in on it (`firm`: typed out and readable for SPEECH.minReadMs).
 */
export interface Spoken {
  text: string;
  key: string;
  priority: Priority;
  at: number;
  until: number;
  firm: number;
}

/** How long a line takes to type out (ms; an icon in it, Moo's `{heart}`, counts as one character: speech-icons.ts). */
export const typeMs = (text: string) => lineLength(text) * SPEECH.typeMs;
/**
 * How long a line stays fully readable once typed (ms): longer for a longer line, a second more past one row of the
 * bubble (`longChars`), up to a cap; and a tester's `?talkplus=`.
 */
export const readMs = (text: string) => {
  const n = lineLength(text);
  return Math.min(SPEECH.maxReadMs, SPEECH.readMs + SPEECH.perCharMs * n + (n > SPEECH.longChars ? SPEECH.longExtraMs : 0)) + talkPlusMs();
};
/** How long a line is up, from its first letter to the end of its fade (ms). */
export const holdMs = (text: string) => typeMs(text) + readMs(text) + SPEECH.fadeMs;
/** How many of a line's characters have typed out by `now`. */
export const typedCount = (text: string, at: number, now: number) => Math.max(0, Math.min(lineLength(text), Math.floor((now - at) / SPEECH.typeMs) + 1));

interface Waiting {
  text: string;
  key: string;
  priority: Priority;
  saidAt: number;
}

/** One speaker's lines: one at a time, each for its time; see the top of this file. */
export class Voice {
  private now: Spoken | null = null;
  private queue: Waiting[] = [];
  private said = new Set<string>();
  private listeners = new Set<() => void>();

  /**
   * Says `text` for the moment `key` (a moment said again, e.g. by a second screen, is ignored), at `at` (now: a line's
   * time runs from when this device says it, as a boss's animations run from when it first saw their moment, so a
   * busy frame never eats into it). Returns whether it was taken (shown now, or waiting its turn).
   */
  say(text: string | null | undefined, key: string, priority: Priority = NORMAL, at = Date.now()): boolean {
    if (!text || this.said.has(key)) return false;
    this.said.add(key);
    if (this.said.size > 400) this.said.delete(this.said.values().next().value!);
    this.advance(at);
    const cur = this.now;
    if (!cur || at >= cur.until || (cutsIn(priority, cur) && at >= cur.firm)) this.start({ text, key, priority, saidAt: at }, at);
    else {
      this.queue.push({ text, key, priority, saidAt: at });
      // Highest priority first; in the order said within one.
      this.queue.sort((a, b) => b.priority - a.priority || a.saidAt - b.saidAt);
    }
    for (const f of this.listeners) f();
    return true;
  }

  /**
   * A test's line (the boss-bar check's `sayBoss` hook, test switches only): it replaces the line up now and the queue, whatever
   * their priority, so each line of a boss is drawn in its own box in turn (e2e/boss-bar-same.spec.ts). The one exception to
   * "never taken off unread": a test hook, which the game never calls.
   */
  replace(text: string, key: string, priority: Priority = CRITICAL, at = Date.now()): boolean {
    this.now = null;
    this.queue = [];
    return this.say(text, key, priority, at);
  }

  /** The line up at `now`, if any (the next one in line starts as the last ends). */
  line(now = Date.now()): Spoken | null {
    this.advance(now);
    return this.now && now >= this.now.at ? this.now : null;
  }

  /** Called when a line is said (for a box to start drawing it). */
  subscribe(f: () => void): () => void {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }

  /** A new battle: nothing said yet. */
  reset() {
    this.now = null;
    this.queue = [];
    this.said.clear();
    for (const f of this.listeners) f();
  }

  private start(w: Waiting, at: number) {
    this.now = { text: w.text, key: w.key, priority: w.priority, at, until: at + holdMs(w.text), firm: at + typeMs(w.text) + SPEECH.minReadMs };
  }

  /**
   * The line up ends at its time, or once it's firm when the first in line cuts in on it (cutsIn); the next in line
   * starts when it's next looked for (a box looks every frame while a line is up), so a busy frame at the handover
   * never eats into it. The one up is never restarted.
   */
  private advance(now: number) {
    if (this.now && now >= this.now.until) this.now = null;
    // (Stale ones are dropped.)
    if (this.queue.length) this.queue = this.queue.filter((w) => now - w.saidAt <= SPEECH.waitMs);
    const w = this.queue[0];
    if (!w || (this.now && !(cutsIn(w.priority, this.now) && now >= this.now.firm))) return;
    this.queue.shift();
    this.start(w, Math.max(now, w.saidAt));
  }
}

/** Whether a line cuts in on the one up (once that one is firm): a critical one on any but a critical one, any on chatter. */
const cutsIn = (priority: Priority, cur: Spoken) => (priority === CRITICAL && cur.priority < CRITICAL) || (cur.priority === CHATTER && priority > CHATTER);

/** The boss's voice (one battle at a time on a device): its powers' lines, its reactions, its intro moments. */
export const bossVoice = new Voice();

/**
 * The line a voice has up, kept current: the box redraws every frame while a line is up (it types and fades), and
 * as soon as one is said; otherwise it rests. It keeps itself current, whatever draws the screen around it (a boss
 * screen draws its header and the boss's figure only now and then: useStillKey).
 */
export function useVoice(voice: Voice): { line: Spoken | null; now: number } {
  const [, bump] = useState(0);
  const now = Date.now();
  const line = voice.line(now);
  const shown = line?.key ?? null;
  // (Before the paint; and a line said before this listened, in the same drawing, is drawn too.)
  useLayoutEffect(() => {
    const off = voice.subscribe(() => bump((n) => n + 1));
    if ((voice.line()?.key ?? null) !== shown) bump((n) => n + 1);
    return off;
  }, [voice]);
  useFrameNow(!!line);
  return { line, now };
}

/**
 * A voice's line in its box (SpeechBox), keeping itself current (useVoice): the figure it stands by isn't drawn again
 * for it. `hidden`: not shown just now (it's still looked at, so its lines keep their time and their turns).
 */
export function VoiceBubble({ voice, class: cls, hidden = false, balanced = false }: { voice: Voice; class: string; hidden?: boolean; balanced?: boolean }) {
  const { line, now } = useVoice(voice);
  // A test hook (test switches only): `sayBoss(text)` says any line in the boss's voice at once, so the boss-bar check
  // (e2e/boss-bar-same.spec.ts) can put every line of every boss into its bubble and measure it.
  useEffect(() => {
    if (voice === bossVoice && testSwitchesAllowed()) (globalThis as { sayBoss?: (text: string) => boolean }).sayBoss = (text) => voice.replace(text, `test:${Date.now()}:${text}`);
  }, [voice]);
  return line && !hidden ? <SpeechBox key={line.key} class={cls} text={line.text} at={line.at} until={line.until} now={now} fits={1} balanced={balanced} /> : null;
}

/**
 * A boss's bar bubble, fitted to its line (SpeechBox's `balanced`; Eric, Oct 24: "two rows is better than one row, but 1.5 rows is
 * better than 4 small rows"; the box must use its own width): null when the line is one row (at most half the room its box's parent
 * offers: the box's own width); else two rows of about the same length when two fit the room (the box half the line plus its frame,
 * `text-wrap: balance`); else three rows, the box as wide as the room and the text wrapped to fill it (`wide3`). The line's width is
 * measured in the box itself, in the page's font.
 */
function bubbleFit(e: HTMLElement): { width: number; three: boolean } | null {
  const room = e.parentElement?.clientWidth ?? 0;
  if (!room) return null;
  const cs = getComputedStyle(e);
  const frame = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  // (The box's one row: set to its widest and measured, then its width put back.)
  const was = e.style.width;
  const wasMax = e.style.maxWidth;
  e.style.width = "max-content";
  e.style.maxWidth = "none";
  // (offsetWidth, not its box: the box's entrance scales it for a moment, and a scaled box would read as a short line.)
  const one = e.offsetWidth;
  e.style.width = was;
  e.style.maxWidth = wasMax;
  if (one <= room / 2) return null;
  const text = one - frame;
  const char = parseFloat(cs.fontSize);
  const two = Math.ceil(text / 2) + char + frame;
  if (two <= room) return { width: Math.ceil(two), three: false };
  return { width: room, three: true };
}

/** Says a line into a voice once, as it's first drawn (a moment's line from inside its screen); draws nothing. */
export function Say({ voice, text, sayKey, priority = NORMAL }: { voice: Voice; text: string | null | undefined; sayKey: string; priority?: Priority }) {
  useLayoutEffect(() => void voice.say(text, sayKey, priority), [sayKey]);
  return null;
}

/**
 * A speech box: the words typing out, at the box's full size from its first frame (the words not typed yet hold their
 * place, unseen), fading over its last moments. Its fit is settled once per line, before its first paint: a box that
 * would run off the screen takes a smaller size (`fits` steps: its CSS's `.fit1`…), and past the last step is moved
 * back into view. It's never hidden.
 */
export function SpeechBox({ class: cls, text, at, until, now, fits = 0, balanced = false, children, ...props }: { class: string; text: string; at: number; until: number; now: number; fits?: number; /** Fitted to its line, two balanced rows or three (bubbleFit): a boss's bar. */ balanced?: boolean; children?: ComponentChildren } & Omit<JSX.HTMLAttributes<HTMLDivElement>, "class">) {
  const el = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ step: number; dx: number; dy: number }>({ step: 0, dx: 0, dy: 0 });
  const [fitted, setFitted] = useState<{ width: number; three: boolean } | null>(null);
  useLayoutEffect(() => {
    const e = el.current;
    if (!balanced || !e) return;
    setFitted(bubbleFit(e));
    // (The pixel font may still be loading (font-display: swap): measure again once it's in, so the box fits the font it's drawn in.)
    let live = true;
    void document.fonts?.load(`${getComputedStyle(e).fontSize} "Press Start 2P"`).then(
      () => {
        if (live && el.current) setFitted(bubbleFit(el.current));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [text, balanced]);
  useLayoutEffect(() => {
    const e = el.current;
    if (!e || fit.dx || fit.dy) return;
    const r = e.getBoundingClientRect();
    const out = r.top < 0 || r.left < 0 || r.right > innerWidth;
    if (!out) return;
    if (fit.step < fits) setFit({ step: fit.step + 1, dx: 0, dy: 0 });
    else setFit({ step: fit.step, dx: r.left < 0 ? -r.left : r.right > innerWidth ? innerWidth - r.right : 0, dy: r.top < 0 ? -r.top : 0 });
  }, [fit]);
  const { shown, rest } = sliceLine(text, typedCount(text, at, now));
  const leaving = until - now < SPEECH.fadeMs;
  const move = fit.dx || fit.dy ? `translate(${Math.round(fit.dx)}px, ${Math.round(fit.dy)}px)` : null;
  const style = fitted || move ? { ...(fitted ? { width: `${fitted.width}px` } : {}), ...(move ? { transform: move } : {}) } : undefined;
  return (
    <div ref={el} class={`${cls}${now - at < 200 ? " fresh" : ""}${leaving ? " leaving" : ""}${fit.step ? ` fit${fit.step}` : ""}${fitted?.three ? " wide3" : ""}`} style={style} role="status" aria-label={plainLine(text)} data-fit={fit.step} {...props}>
      <span aria-hidden="true">
        <LineText segs={shown} />
      </span>
      <span class="speech-rest" aria-hidden="true">
        <LineText segs={rest} />
      </span>
      {children}
    </div>
  );
}

/** A line's words and icons (speech-icons.ts), the icons drawn inline at text height. */
function LineText({ segs }: { segs: readonly LineSeg[] }) {
  return (
    <>
      {segs.map((s, i) => (s.icon ? <LineIcon key={i} id={s.icon} /> : s.text))}
    </>
  );
}

/** One of Moo's icons as it's drawn in a line: a pixel image, cropped to its pixels and its outline, one pixel to a pixel. */
const iconImages = new Map<MooIconId, { url: string; w: number; h: number }>();
function iconImage(id: MooIconId): { url: string; w: number; h: number } {
  let im = iconImages.get(id);
  if (!im) {
    const ch = mooIconSprite(id);
    const r = renderFrame(ch, ch.anims.idle!.frames[0]!);
    let [x0, y0, x1, y1] = [r.w, r.h, -1, -1];
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++)
        if (r.data[(y * r.w + x) * 4 + 3]! > 0) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    const [w, h] = [x1 - x0 + 1, y1 - y0 + 1];
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    cv.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), -x0, -y0, x0, y0, w, h);
    iconImages.set(id, (im = { url: cv.toDataURL(), w, h }));
  }
  return im;
}
export function LineIcon({ id }: { id: MooIconId }) {
  const { url, w, h } = iconImage(id);
  return <img class="line-icon" src={url} width={w} height={h} alt="" aria-hidden="true" draggable={false} data-icon={id} />;
}
