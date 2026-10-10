/**
 * Speech: the one rule for every line a boss or the God King says (Eric, Oct 10, 2026: Ginger's line came and went at
 * once). The numbers are SPEECH in settings.ts.
 *
 * - **Its time.** A line types out, then stays fully readable for a time that grows with its length (`readMs` plus
 *   `perCharMs` a character, at most `maxReadMs`), then fades. Nothing a screen does cuts that short: the line lives
 *   in its speaker's Voice, not in a screen, so the boss's turn ending, the next screen or the next moment don't take
 *   it away (a new screen picks it up where it was).
 * - **Taking turns.** Each speaker (the boss, the God King) has one Voice, and says one line at a time. A line said
 *   while another is up waits its turn, highest priority first, unless it's critical and the one up isn't: then it
 *   cuts in. A line that can't start within `waitMs` of being said is dropped (it would be stale).
 * - **Never hidden by a fit check.** A box that would run off the screen takes a smaller size, a step at a time, and
 *   past the last step is moved back into view (SpeechBox). Its size is settled once per line, before its first paint.
 *
 * A new boss gets all of this by saying its lines into `bossVoice` (the boss screen does it for every power moment
 * from its BossUi, the boss character for its reactions); its words show in its text box beside it, on every screen.
 */
import type { ComponentChildren, JSX } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { SPEECH } from "@chessroyale/core";

/** How much a line matters: only a critical line cuts in on another; the rest wait their turn. */
export const LOW = 0;
export const NORMAL = 1;
export const CRITICAL = 2;
export type Priority = typeof LOW | typeof NORMAL | typeof CRITICAL;

/** A line on screen: its words, its moment (`key`), when it started and when it's gone (its fade included). */
export interface Spoken {
  text: string;
  key: string;
  priority: Priority;
  at: number;
  until: number;
}

/** How long a line takes to type out (ms). */
export const typeMs = (text: string) => text.length * SPEECH.typeMs;
/** How long a line stays fully readable once typed (ms): longer for a longer line, up to a cap. */
export const readMs = (text: string) => Math.min(SPEECH.maxReadMs, SPEECH.readMs + SPEECH.perCharMs * text.length);
/** How long a line is up, from its first letter to the end of its fade (ms). */
export const holdMs = (text: string) => typeMs(text) + readMs(text) + SPEECH.fadeMs;
/** How many of a line's characters have typed out by `now`. */
export const typedCount = (text: string, at: number, now: number) => Math.max(0, Math.min(text.length, Math.floor((now - at) / SPEECH.typeMs) + 1));

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
    if (!cur || at >= cur.until || (priority === CRITICAL && cur.priority < CRITICAL)) this.start({ text, key, priority, saidAt: at }, at);
    else {
      this.queue.push({ text, key, priority, saidAt: at });
      // Highest priority first; in the order said within one.
      this.queue.sort((a, b) => b.priority - a.priority || a.saidAt - b.saidAt);
    }
    for (const f of this.listeners) f();
    return true;
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
    this.now = { text: w.text, key: w.key, priority: w.priority, at, until: at + holdMs(w.text) };
  }

  /**
   * The line up ends at its time; the next in line starts when it's next looked for (a box looks every frame while a
   * line is up), so a busy frame at the handover never eats into it. The one up is never restarted.
   */
  private advance(now: number) {
    if (this.now && now >= this.now.until) this.now = null;
    if (this.now) return;
    // (Stale ones are dropped.)
    this.queue = this.queue.filter((w) => now - w.saidAt <= SPEECH.waitMs);
    const w = this.queue.shift();
    if (w) this.start(w, Math.max(now, w.saidAt));
  }
}

/** The boss's voice (one battle at a time on a device): its powers' lines, its reactions, its intro moments. */
export const bossVoice = new Voice();

/**
 * The line a voice has up, kept current: the box redraws every frame while a line is up (it types and fades), and
 * as soon as one is said; otherwise it rests.
 */
export function useVoice(voice: Voice): { line: Spoken | null; now: number } {
  const [, bump] = useState(0);
  useEffect(() => voice.subscribe(() => bump((n) => n + 1)), [voice]);
  const now = Date.now();
  const line = voice.line(now);
  useEffect(() => {
    if (!line) return;
    const raf = requestAnimationFrame(() => bump((n) => n + 1));
    return () => cancelAnimationFrame(raf);
  });
  return { line, now };
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
export function SpeechBox({ class: cls, text, at, until, now, fits = 0, children, ...rest }: { class: string; text: string; at: number; until: number; now: number; fits?: number; children?: ComponentChildren } & Omit<JSX.HTMLAttributes<HTMLDivElement>, "class">) {
  const el = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ step: number; dx: number; dy: number }>({ step: 0, dx: 0, dy: 0 });
  useLayoutEffect(() => {
    const e = el.current;
    if (!e || fit.dx || fit.dy) return;
    const r = e.getBoundingClientRect();
    const out = r.top < 0 || r.left < 0 || r.right > innerWidth;
    if (!out) return;
    if (fit.step < fits) setFit({ step: fit.step + 1, dx: 0, dy: 0 });
    else setFit({ step: fit.step, dx: r.left < 0 ? -r.left : r.right > innerWidth ? innerWidth - r.right : 0, dy: r.top < 0 ? -r.top : 0 });
  }, [fit]);
  const shown = typedCount(text, at, now);
  const leaving = until - now < SPEECH.fadeMs;
  const style = fit.dx || fit.dy ? { transform: `translate(${Math.round(fit.dx)}px, ${Math.round(fit.dy)}px)` } : undefined;
  return (
    <div ref={el} class={`${cls}${now - at < 200 ? " fresh" : ""}${leaving ? " leaving" : ""}${fit.step ? ` fit${fit.step}` : ""}`} style={style} role="status" aria-label={text} data-fit={fit.step} {...rest}>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      <span class="speech-rest" aria-hidden="true">
        {text.slice(shown)}
      </span>
      {children}
    </div>
  );
}
