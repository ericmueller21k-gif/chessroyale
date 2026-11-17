import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { DASH_STALL, DASH_TAP } from "@chessroyale/core";
import { applyMove, passTurn, stallTimeline } from "@chessroyale/chess";
import { hash } from "../characters/boss-beats.ts";
import { DASH_FIGURE } from "../characters/dash-figure.ts";
import { DASH_STALL_LINES, DASH_TAP_BORED_LINES, DASH_TAP_JOKE_LINES, DASH_TAP_LINES } from "../characters/dash-lines.ts";
import { DASH_LIE } from "../characters/dash-lie.ts";
import { bossKit } from "../characters/kits.ts";
import { CRITICAL, NORMAL, VoiceBubble, bossVoice } from "../speech.tsx";
import { SpriteAnim } from "./BossEffect.tsx";
import type { BossView, StallState, StrikeState } from "../game.ts";
import { playInPlace, stopInPlace } from "./BossCharacter.tsx";

/**
 * Dash's stall skit on your move (Eric, Nov 17; his rules: stallPlan in packages/chess/src/bosses/dash.ts; the beats are timed by
 * solo.ts and the lobby, which stop the move's clock for each, and arrive here as the play phase's `stall`):
 * - **the slam** (DASH_STALL.slamMs): he hammers his clock where he stands (his `slam` loop, a hit and a shake each slam) and
 *   says a hurry-up line;
 * - **his fake second move** (stallTimeline): his move lands on the board (his `move`), he brags (`fakeSmug`, a line), then
 *   "Nahh, jk bro" (`jkLaugh`, a line) and the move slides back. The board takes no move meanwhile.
 * Every part plays where he stands (never over the board's squares) and in the dock clock's pause; nothing else on screen moves.
 */

/** One of his lines for a beat, the same on every screen (by the battle and the move). */
const lineOf = (lines: readonly string[], key: string): string => lines[hash(key) % lines.length]!;

/** Each beat's lines' key: the battle, the move and the beat. */
const keyOf = (boss: BossView, beat: string) => `dash-stall:${boss.startMove}:${boss.crowdMoves}:${beat}`;

/**
 * The window the move's clock stands still now, or last stood still (the King's strike or a stall beat): the dock's clock and the
 * timer bar hold through it (each beat's length is already in the deadline).
 */
export function frozenWindow(strike?: StrikeState, stall?: StallState | null): { at: number; until: number } | undefined {
  const s = strike?.at !== undefined && strike.until !== undefined ? { at: strike.at, until: strike.until } : undefined;
  // (His clock tap stops no clock.)
  const d = stall && stall.beat !== "tap" ? { at: stall.at, until: stall.until } : undefined;
  return s && d ? (d.at >= s.at ? d : s) : (s ?? d);
}

/** The board takes no move: his fake move is on (from its landing to the board as it was). */
export const stallHolding = (stall: StallState | null | undefined, now: number): boolean => stall?.beat === "fake" && now >= stall.at && now < stall.until;

/** A stall beat is on now (the clock stands still). */
export const stallOn = (stall: StallState | null | undefined, now: number): boolean => !!stall && now >= stall.at && now < stall.until;

/**
 * The board as his fake move shows it (`fen`: the position you're picking in), from its landing until it slides back
 * (stallTimeline's backAt): his move played as if you'd passed. Null otherwise.
 */
export function stallBoard(fen: string, stall: StallState | null | undefined, now: number): { fen: string; lastMove: string } | null {
  if (stall?.beat !== "fake" || !stall.move) return null;
  const t = now - stall.at;
  if (t < 0 || t >= stallTimeline().backAt) return null;
  const passed = passTurn(fen);
  if (!passed) return null;
  try {
    return { fen: applyMove(passed, stall.move), lastMove: stall.move };
  } catch {
    return null;
  }
}

/** His `slam` loop as many times as fill the slam (DASH_STALL.slamMs). */
function slamRun(): string[] {
  const one = DASH_FIGURE.anims.slam!.frames.reduce((s, f) => s + f.ms, 0);
  return Array.from({ length: Math.max(1, Math.round(DASH_STALL.slamMs / one)) }, () => "slam");
}

/**
 * The skit's beat where he stands and in his voice (renders nothing): his runs in place and his lines, each at its time. A beat
 * cut short (your move went in during the slam) stops his run there.
 */
export function DashStall({ boss, stall }: { boss: BossView | null | undefined; stall: StallState | null | undefined }) {
  useEffect(() => {
    if (!stall || stall.beat === "tap" || boss?.id !== "dash") return;
    const key = keyOf(boss, stall.beat);
    const timers: number[] = [];
    const at = (t: number, f: () => void) => void timers.push(window.setTimeout(f, Math.max(0, t - Date.now())));
    if (stall.beat === "slam") {
      playInPlace(key, slamRun(), stall.at);
      at(stall.at, () => bossVoice.say(lineOf(DASH_STALL_LINES.slam, key), key, CRITICAL));
    } else {
      const tl = stallTimeline();
      playInPlace(key, ["move", "fakeSmug", "fakeSmug"], stall.at);
      // (His brag up until "jk", which cuts in on it: a line of his own can't cut in on one as important.)
      at(stall.at + tl.bragAt, () => bossVoice.say(lineOf(DASH_STALL_LINES.brag, key), `${key}:brag`, NORMAL, Date.now(), tl.jkAt - tl.bragAt));
      at(stall.at + tl.jkAt, () => {
        playInPlace(`${key}:jk`, ["jkLaugh"], stall.at + tl.jkAt);
        bossVoice.say(lineOf(DASH_STALL_LINES.jk, key), `${key}:jk`, CRITICAL);
      });
    }
    return () => {
      for (const t of timers) clearTimeout(t);
      // (Your move went in mid-slam: the round is over, so is his slamming.)
      if (stall.beat === "slam" && Date.now() < stall.until) stopInPlace(key);
    };
  }, [boss?.id, stall?.beat, stall?.at]);
  return null;
}

// ---------------- His lying-down clock tap ----------------

const animMs = (name: string) => DASH_LIE.anims[name]!.frames.reduce((t, f) => t + f.ms, 0);

/** His lie-down and his getting up (ms): the crawl in always plays to its end (Eric, Nov 17: "let the crawl finish"). */
export const tapLengths = () => ({ down: animMs("lieDown"), up: animMs("getUp") });

/**
 * His clock tap on screen, from his lie-down at `at` (his rules' tap beat, solo's or the server's): down `down` ms later; up when
 * your move is in (`moved`), or, your move in before he was down, after his "just a joke" line (DASH_TAP.jokeMs from his landing,
 * `joke`); gone `up` ms after that. `upAt` Infinity: still lying (your move still open). His "not moving till you do" line at
 * `boredAt`.
 */
export function tapTimeline(at: number, moved: number | undefined) {
  const { down, up } = tapLengths();
  const downAt = at + down;
  const joke = moved !== undefined && moved < downAt;
  const upAt = moved === undefined ? Infinity : joke ? downAt + DASH_TAP.jokeMs : moved;
  return { downAt, joke, upAt, endAt: upAt + up, boredAt: downAt + DASH_TAP.boredMs };
}

/**
 * Where his lying figure goes: beside your clock (the dock's time), its clock against the time, his feet on its line; and the point
 * his words stand on (`say`): over him, centered on him, never lower than the time's top (so never over him or the digits).
 */
function placeLie(el: HTMLElement, say: HTMLElement | null) {
  const time = document.querySelector<HTMLElement>(".dk-clock .dk-time") ?? document.querySelector<HTMLElement>(".dk-clock");
  const t = time?.getBoundingClientRect();
  if (!t || !t.width) return false;
  // (His own pixels at the size his figure stands at; never reaching up over the board's squares.)
  const fig = document.querySelector<HTMLElement>(".boss-char .boss-char-sprite")?.getBoundingClientRect();
  const board = document.querySelector<HTMLElement>(".hb-board")?.getBoundingClientRect();
  let k = fig?.height ? fig.height / DASH_FIGURE.h : 0.7;
  const floor = 57 / DASH_LIE.h;
  // (His cap's top is about 9 of his pixels down the frame.)
  if (board && t.bottom > board.bottom) k = Math.min(k, (t.bottom - board.bottom - 2) / (57 - 9));
  k = Math.max(0.35, Math.min(1.2, k));
  const w = DASH_LIE.w * k;
  const h = DASH_LIE.h * k;
  // (His clock is at his frame's left end: on the time's left he's mirrored, so it ends 4 px short of the digits; no room there,
  // he lies on its right.)
  const left = t.left - 4 - w;
  const mirror = left >= 4;
  const x = mirror ? left : Math.min(window.innerWidth - w - 4, t.right + 4);
  const y = t.bottom + 2 - h * floor;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.classList.toggle("mirror", mirror);
  if (say) {
    say.style.left = `${x + w / 2 - 300}px`;
    say.style.top = `${Math.min(y + 9 * k, t.top)}px`;
  }
  return true;
}

/**
 * Dash's lying-down clock tap (Eric, Nov 17: "once per game he goes down laying down with his chess clock by your clock… and starts
 * tapping it"; only when you're slow: his rules' tap beat, at 10 s of your move or 30% of its clock, solo's or the server's, the
 * play phase's `stall` with beat `tap`). He zips down beside your clock under the board (DockClock's time, phone and computer alike),
 * never over the board's squares or the time's digits, on the page's top layer (a portal, placed once as it shows, then still), and
 * stays there tapping his clock until your move is in ("stay in the crawl position"); then he zips back. His crawl in always
 * finishes: your move in before he's down, "just a joke" first. His words stand over him meanwhile ("his chat box didn't follow
 * him"), his figure and its usual box away. Drawn beside the match's screens, so a move going in (its screen changing) doesn't cut
 * him off. A reconnect mid-tap: he's lying.
 */
export function DashTap({ match }: { match: { boss: BossView | null; phase: { kind: string; stall?: StallState | null } } }) {
  const boss = match.boss;
  const ph = match.phase;
  const live = boss?.id === "dash" && (ph.kind === "play" || ph.kind === "scoring") && ph.stall?.beat === "tap" ? ph.stall : null;
  // (His tap on this move: when he lay down, the move it is, and when your move went in.)
  const tap = useRef<{ at: number; turn: number; moved?: number } | null>(null);
  if (live && boss && tap.current?.at !== live.at) tap.current = { at: live.at, turn: boss.crowdMoves };
  const t = tap.current;
  const now = Date.now();
  if (t && t.moved === undefined && !(ph.kind === "play" && boss?.crowdMoves === t.turn)) t.moved = now;
  const tl = t ? tapTimeline(t.at, t.moved) : null;
  const shown = !!tl && now < tl.endAt;
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!tl || !shown) return;
    const marks = [tl.downAt, tl.upAt, tl.endAt, tl.boredAt].filter((m) => m > Date.now() && m < Infinity);
    const timers = marks.map((m) => window.setTimeout(() => redraw((n) => n + 1), m - Date.now() + 5));
    return () => timers.forEach(clearTimeout);
  }, [t?.at, t?.moved, shown]);
  // (His lines: as he's down, the tap's (or, your move already in, the joke); still lying boredMs later, the bored one.)
  const key = t && boss ? `dash-tap:${boss.startMove}:${t.turn}` : "";
  const down = !!tl && now >= tl.downAt;
  const bored = !!tl && now >= tl.boredAt && now < tl.upAt;
  useEffect(() => {
    if (!down || !tl) return;
    if (tl.joke) bossVoice.say(DASH_TAP_JOKE_LINES[hash(key) % DASH_TAP_JOKE_LINES.length]!, `${key}:joke`, CRITICAL);
    else if (now < tl.upAt) bossVoice.say(DASH_TAP_LINES[hash(key) % DASH_TAP_LINES.length]!, key, NORMAL);
  }, [down && key]);
  useEffect(() => {
    if (bored) bossVoice.say(DASH_TAP_BORED_LINES[hash(key) % DASH_TAP_BORED_LINES.length]!, `${key}:bored`, CRITICAL);
  }, [bored && key]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("dash-away", shown);
    return () => document.body.classList.remove("dash-away");
  }, [shown]);
  const ref = useRef<HTMLDivElement>(null);
  const sayRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (shown && ref.current) placeLie(ref.current, sayRef.current);
  }, [shown]);
  if (!shown || !tl || !t || typeof document === "undefined") return null;
  const up = now >= tl.upAt;
  return createPortal(
    <>
      <div ref={ref} class="dash-lie" aria-hidden="true" data-beat={up ? "up" : "tap"}>
        <SpriteAnim ch={DASH_LIE} anim={up ? "getUp" : "lieDown"} since={up ? tl.upAt : t.at} then={up ? undefined : "idle"} sounds={bossKit(boss?.name ?? "Dash")?.sounds ?? {}} id={`tap:${t.at}`} class="dash-lie-sprite" />
      </div>
      <span ref={sayRef} class="dash-say-at">
        <VoiceBubble voice={bossVoice} class="bc-bubble dash-say" />
      </span>
    </>,
    document.body,
  );
}
