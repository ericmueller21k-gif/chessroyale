import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { DASH_STALL, DASH_TAP } from "@chessroyale/core";
import { applyMove, passTurn, stallTimeline } from "@chessroyale/chess";
import { hash } from "../characters/boss-beats.ts";
import { DASH_FIGURE } from "../characters/dash-figure.ts";
import { DASH_STALL_LINES, DASH_TAP_LINES } from "../characters/dash-lines.ts";
import { DASH_LIE } from "../characters/dash-lie.ts";
import { bossKit } from "../characters/kits.ts";
import { CRITICAL, NORMAL, bossVoice } from "../speech.tsx";
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
  const d = stall ? { at: stall.at, until: stall.until } : undefined;
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
    if (!stall || boss?.id !== "dash") return;
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

/**
 * His lying-down clock tap's beats (ms from his lie-down): he zips in and lies down by your clock (`lieDown`), taps his for
 * DASH_TAP.tapMs (`idle`, a tick a tap), then springs up and zips off (`getUp`); his figure where he stands is away meanwhile. Your
 * move cuts it short (he gets up at once).
 */
export function tapTimeline() {
  const upAt = animMs("lieDown") + DASH_TAP.tapMs;
  return { upAt, total: upAt + animMs("getUp") };
}

/**
 * When on this move his clock tap would start (ms of your move's own clock), or null: not on this move (Eric, Nov 17: only when
 * you're slow; DASH_TAP). From crowd move DASH_TAP.fromMove (?power=clocktap: the first), never on a move with another moment of
 * his (an event this turn, a Time Scramble's move, his Scramble Rush's turn) nor the re-pick after the God King's Last Stand: at
 * `afterMs` of a bank's move (`bank`: Boss alone, a party) or `afterShare` of the move's clock (`allowedMs`: a raid, a group
 * battle), and only when all of it ends before his stall skit's slam could come (DASH_STALL; his fake move still to come) and
 * before your time's up. Spent (once a battle) is the screen's to know: tapSpent.
 */
export function tapAt(boss: BossView | null | undefined, allowedMs: number, bank: boolean, test = ""): number | null {
  const p = boss?.id === "dash" ? boss.powers : null;
  const d = p?.dash;
  if (!boss || !p || !d || boss.result || boss.barred) return null;
  const turn = boss.crowdMoves + 1;
  if (turn < (test === "clocktap" ? 1 : DASH_TAP.fromMove) || p.turn !== turn || p.events.length || d.scramble || (d.rush && d.rush.at >= boss.crowdMoves)) return null;
  const at = bank ? DASH_TAP.afterMs : Math.round(allowedMs * DASH_TAP.afterShare);
  const slam = d.stall ? Infinity : test === "stall" ? DASH_STALL.test.slamAt : bank ? DASH_STALL.slamSeconds * 1000 : Math.round(allowedMs * DASH_STALL.slamShare);
  return at + tapTimeline().total <= Math.min(slam, allowedMs) ? at : null;
}

/**
 * The battle his tap came in on this device (its tag: the battle's first move and DashView's `key`), kept across a reload so a
 * reconnect never plays it again; in memory where the browser keeps nothing.
 */
const TAP_KEY = "brc.dashTap";
let tapMemory = "";
export const tapBattle = (boss: BossView): string => `${boss.startMove}:${boss.powers?.dash?.key ?? "?"}`;
export function tapSpent(battle: string): boolean {
  try {
    return (localStorage.getItem(TAP_KEY) ?? tapMemory) === battle;
  } catch {
    return tapMemory === battle;
  }
}
export function spendTap(battle: string) {
  tapMemory = battle;
  try {
    localStorage.setItem(TAP_KEY, battle);
  } catch {
    // (Memory only.)
  }
}

/** Where his lying figure goes: beside your clock (the dock's time), its clock against the time, his feet on its line. */
function placeLie(el: HTMLElement) {
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
  el.style.left = `${mirror ? left : Math.min(window.innerWidth - w - 4, t.right + 4)}px`;
  el.style.top = `${t.bottom + 2 - h * floor}px`;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.classList.toggle("mirror", mirror);
  return true;
}

/**
 * Dash's lying-down clock tap on your move (Eric, Nov 17: "once per game he goes down laying down with his chess clock by your
 * clock… and starts tapping it for a few seconds"; only when you're taking a while: tapAt): beside your clock under the board
 * (DockClock's time, phone and computer alike), never over the board's squares or the time's digits, on the page's top layer (a
 * portal, placed once as it shows, then still). Decided by this screen's own clock, solo and online alike (no rules event): your
 * move's clock (`startsAt`, `frozen`: the King's strike's pause left out) reaching tapAt. Your clock runs as ever. Not with a stall
 * beat of his on this move (`stalled`).
 */
export function DashTap({
  boss,
  startsAt,
  allowedMs,
  bank,
  test,
  frozen,
  stalled,
  waiting,
}: {
  boss: BossView | null | undefined;
  startsAt: number;
  allowedMs: number;
  bank: boolean;
  test: string;
  frozen?: { at: number; until: number };
  stalled: boolean;
  waiting: boolean;
}) {
  const turn = boss?.crowdMoves ?? -1;
  const now = Date.now();
  // (When it came on this move: its lie-down, on the wall clock.)
  const came = useRef<{ turn: number; at: number } | null>(null);
  if (boss && !waiting && !stalled && startsAt > 0 && came.current?.turn !== turn) {
    const at = tapAt(boss, allowedMs, bank, test);
    // (The wall time your move's clock reaches it: a pause of the clock before then pushes it back.)
    let lie = at === null ? 0 : startsAt + at;
    if (lie && frozen && frozen.at >= startsAt && frozen.at < lie) lie += frozen.until - frozen.at;
    const battle = tapBattle(boss);
    // (Only while it's still on: a screen back after its whole tap leaves it armed for a later move.)
    if (lie && now >= lie && now < lie + tapTimeline().upAt && (!frozen || now < frozen.at || now >= frozen.until) && !tapSpent(battle)) {
      spendTap(battle);
      came.current = { turn, at: lie };
    }
  }
  const from = came.current?.turn === turn ? came.current.at : 0;
  const tl = tapTimeline();
  // (Your move went in before he was up: he gets up now.)
  const [cut, setCut] = useState<{ turn: number; at: number } | null>(null);
  useEffect(() => {
    const t = Date.now();
    if (waiting && from && t < from + tl.upAt && cut?.turn !== turn) setCut({ turn, at: t });
  }, [waiting, from]);
  const upAt = cut?.turn === turn ? cut.at : from + tl.upAt;
  const endAt = upAt + animMs("getUp");
  const shown = !!from && now < endAt;
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!from) return;
    const marks = [upAt, endAt].filter((t) => t > Date.now());
    const timers = marks.map((t) => window.setTimeout(() => redraw((n) => n + 1), t - Date.now() + 5));
    return () => timers.forEach(clearTimeout);
  }, [from, upAt]);
  // (His line as he lies down; his figure where he stands away meanwhile.)
  useEffect(() => {
    if (!shown || !boss) return;
    const key = `dash-tap:${boss.startMove}:${turn}`;
    bossVoice.say(DASH_TAP_LINES[hash(key) % DASH_TAP_LINES.length]!, key, NORMAL);
  }, [shown && turn]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("dash-away", shown);
    return () => document.body.classList.remove("dash-away");
  }, [shown]);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (shown && ref.current) placeLie(ref.current);
  }, [shown]);
  if (!shown || typeof document === "undefined") return null;
  const up = now >= upAt;
  return createPortal(
    <div ref={ref} class="dash-lie" aria-hidden="true" data-beat={up ? "up" : "tap"}>
      <SpriteAnim ch={DASH_LIE} anim={up ? "getUp" : "lieDown"} since={up ? upAt : from} then={up ? undefined : "idle"} sounds={bossKit(boss!.name)?.sounds ?? {}} id={`tap:${turn}`} class="dash-lie-sprite" />
    </div>,
    document.body,
  );
}
