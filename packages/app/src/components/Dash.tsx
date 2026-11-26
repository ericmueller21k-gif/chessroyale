import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { DASH_ANIM, POWER_FX, fenAtPly, hangOnTimeline, pieceAt, popOffPending, scrambleLeft, scrambleSecondsOf, type DashView } from "@chessroyale/chess";
import { CRITICAL, INTERRUPT } from "../speech.tsx";
import { hash, pickLine } from "../characters/boss-beats.ts";
import { DASH_FIT_LINES, DASH_HANG_ON_LINES, DASH_LOVE_LINES, DASH_POPOFF_LINES, DASH_RUSH_LINES } from "../characters/dash-lines.ts";
import { renderFrame } from "../characters/sprite.ts";
import { sidekickBlitz } from "../characters/sidekicks/blitz.ts";
import { clockShown } from "../clock-text.ts";
import { BOSS_POWERS } from "@chessroyale/core";
import type { BossView } from "../game.ts";
import { InPlace, rageWarn, type BossUi, type Moment, type MomentProps, type MomentUi } from "./PowerParts.tsx";
import { figurePoint } from "./BossCharacter.tsx";
import { DASH_FIGURE as DASH } from "../characters/dash-figure.ts";

/**
 * Dash's powers on screen (his rules: packages/chess/src/bosses/dash.ts; docs/decisions/2026-11-03-dash.md). "Your time" is the
 * clock you already have, at the dock's right on every boss screen (DockClock: the bank in Boss alone and a party, a raid's move
 * timer), so nothing new takes room and nothing shifts.
 * - **Every moment of his plays where he stands** (`inPlace`: his figure in the boss bar on a phone, beside the board on a
 *   computer; `pm-stay`), the RAGE warning's too: he never steps up to the board's corner, so he never covers a square (the
 *   director's review, Nov 3: the corner cast hid a8, b8 and the 7th rank on a phone).
 * - **Clock Slap** (`slap`, as your turn after his capture begins): his clock slap where he stands, and the time he took flying
 *   from your clock to him ("−30s", or "−6s" off a raid's next move), placed once from the two on the page, then CSS.
 * - **Time Scramble** (`scramble`, after the RAGE warning a turn before): banner TIME SCRAMBLE! ("Your next 3 moves: 5 seconds
 *   each" the first time, 3 seconds the second: its seconds by use, from his view), his clock tossed and spun. Then on each scrambled move a big 3-2-1 over the board (`ScrambleCount`, Play.tsx: drawn
 *   again only as the second shown changes, never per frame, and never in the way of a tap), its moves left in Tick's tally.
 * - **Scramble Rush's warning** (`rushWarn`, a turn before it, as any ultimate's): RAGE!, "Next turn: Scramble Rush", his line.
 * - **His flag** (`flag`, as your turn after it begins): your time ran out, a random move was played for you: his finger gun and
 *   his jab, the dock says what happened.
 * - **Clock multi-hit** (`clockFit`, every 4 or 5 of his moves: five quick smacks where he stands, always a line about his clock)
 *   and **pop-off** (his thinking screen, `popOffMoments`: three smacks and "I gotta pop off", then ten fast smacks and a love
 *   line, before his move lands; the crowd's clock starts after his move, as ever); the second one is his **"Hang on"** (Nov 26,
 *   `popOffMoments` too: four beats, hangOnTimeline): your piece slid back (`hangOnFen`), your clock ticking down and given back
 *   (the dock's, a display only: DockClock's `gagAt`), his smacks from slow to cheetah speed, the wind-up and "sorry", your piece
 *   home, then his move. Presentation only: the game's board, clock and result never change for it.
 * - **Tick**, his tortoise, in the boss bar's prop slot (fixed): asleep on his clock; he wakes with a bob at a slap and rattles
 *   through a scramble. Under him, the time Dash has stolen so far, or the scramble's moves left.
 */

/** His moments' beats (ms into each moment's own clock). */
export const DASH_BEATS = {
  /** The slap: his paw slams the clock at slamAt; your time flies from your clock to him from then, landing at his chest. */
  slap: { slamAt: DASH_ANIM.slapHitAt, flyMs: DASH_ANIM.stealAt - DASH_ANIM.slapHitAt },
  /** The scramble: after its banner his clock goes up. */
  scramble: { castAt: 1500 },
} as const;
const B = DASH_BEATS;

/** The words under his banner and in the dock: what each means for you. */
export const DASH_WORDS = {
  scramble: (moves: number, seconds: number) => `Your next ${moves} moves: ${seconds} seconds each`,
  slap: "He stole time off your clock",
  flag: "Out of time: a random move was played for you",
} as const;

/** What a slap took, as the flying chip says it ("−30s"). */
export const slapText = (ms: number): string => `−${Math.round(ms / 1000)}s`;

// ---------------- His moments ----------------

/** His figure as drawn now: the boss bar's on a phone, the one beside the board on a computer (the one with a box). */
function figureEl(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(".boss-char .boss-char-sprite")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * The time he took, flying from your clock (the dock's) to him where he stands: where both are is read once as it shows (the
 * page's own layout), then a CSS animation carries it; nothing runs per frame. On the page's top layer (a portal, fixed), so
 * nothing clips it on its way from under the board to the bar.
 */
function SlapFlight({ ms, startAt, now }: { ms: number; startAt: number; now: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = now >= startAt && now <= startAt + B.slap.flyMs + 200;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const clock = document.querySelector<HTMLElement>(".dk-clock .dk-time") ?? document.querySelector<HTMLElement>(".dk-clock");
    const c = clock?.getBoundingClientRect();
    const d = figureEl();
    // (No clock on the page: it rises from the screen's foot. No figure: to the screen's top-left, where his bar is.)
    const fx = c ? c.left + c.width / 2 : window.innerWidth / 2;
    const fy = c ? c.top + c.height / 2 : window.innerHeight;
    // (To his chest, 45% across his frame and 60% down as drawn, whichever way he faces: figurePoint.)
    const chest = d ? figurePoint(d, DASH, DASH.w * 0.45, DASH.h * 0.6) : { x: 40, y: 60 };
    const tx = chest.x;
    const ty = chest.y;
    el.style.setProperty("--fx", `${fx}px`);
    el.style.setProperty("--fy", `${fy}px`);
    el.style.setProperty("--tx", `${tx - fx}px`);
    el.style.setProperty("--ty", `${ty - fy}px`);
  }, [startAt, shown]);
  if (!shown || typeof document === "undefined") return null;
  return createPortal(
    <span ref={ref} class="dash-fly" aria-hidden="true">
      {slapText(ms)}
    </span>,
    document.body,
  );
}

function slapMoment({ boss, moment, now }: MomentProps) {
  const slap = boss.powers?.dash?.slap;
  return (
    <div class="power-moment pm-slap pm-stay" data-ms={slap?.ms ?? 0} data-bank={slap?.bank ? "1" : "0"}>
      <InPlace runKey={moment.key} anims={["clockSlap"]} since={moment.at} />
      {slap && <SlapFlight ms={slap.ms} startAt={moment.at + B.slap.slamAt} now={now} />}
    </div>
  );
}

function scrambleMoment({ boss, moment, banner }: MomentProps & { moment: Moment }) {
  // (Its seconds by its use this battle: his view's, as the first scrambled move begins.)
  const sc = boss.powers?.dash?.scramble;
  return (
    <div class="power-moment pm-scramble pm-stay" data-turn={moment.key} data-seconds={sc?.seconds ?? scrambleSecondsOf(0)}>
      {banner("TIME SCRAMBLE!", DASH_WORDS.scramble(sc?.moves ?? BOSS_POWERS.scrambleMoves, sc?.seconds ?? scrambleSecondsOf(0)), "dash")}
      <InPlace runKey={moment.key} anims={["timeScramble"]} since={moment.at + B.scramble.castAt} />
    </div>
  );
}

function flagMoment({ moment }: MomentProps) {
  // (His finger gun: the kit's `cheer`, his `check`.)
  return (
    <div class="power-moment pm-flag pm-stay">
      <InPlace runKey={moment.key} anims={["check"]} since={moment.at} />
    </div>
  );
}

/** His clock multi-hit: quick smacks where he stands (dashClockFit.smacks, fit5 by default), and a line about his clock. */
function fitMoment({ moment }: MomentProps) {
  const n = Math.max(3, Math.min(5, moment.count ?? BOSS_POWERS.dashClockFit.smacks));
  return (
    <div class="power-moment pm-fit pm-stay" data-key={moment.key} data-count={n}>
      <InPlace runKey={moment.key} anims={[`fit${n}`]} since={moment.at} />
    </div>
  );
}

/** His pop-off's first beat: three smacks (fit3), "I gotta pop off for a sec". Its second, the fast ten (fit10), comes after. */
function popOffMoment({ moment }: MomentProps) {
  return (
    <div class="power-moment pm-fit pm-stay" data-key={moment.key} data-kind="popOff" data-count={BOSS_POWERS.dashPopOff.smacks}>
      <InPlace runKey={moment.key} anims={["fit3"]} since={moment.at} />
    </div>
  );
}

/** His pop-off's second beat: ten really fast smacks (fit10), then he says how much he loves that clock. */
function popOffFastMoment({ moment }: MomentProps) {
  return (
    <div class="power-moment pm-fit pm-stay" data-key={moment.key} data-kind="popOffFast" data-count={BOSS_POWERS.dashPopOff.hits}>
      <InPlace runKey={moment.key} anims={["fit10"]} since={moment.at} />
    </div>
  );
}

/** His "Hang on"'s beats, each a moment: its slow smacks (hangSlow), cheetah speed (hangFast: it runs on through "almost done"), the wind-up and sorry. */
function hangOnMoment(anims: readonly string[] | null) {
  return ({ moment }: MomentProps) => (
    <div class="power-moment pm-fit pm-stay" data-key={moment.key} data-kind={moment.kind}>
      {anims && <InPlace runKey={moment.key} anims={anims} since={moment.at} />}
    </div>
  );
}

/** When this device first saw each pop-off (a screen drawn again carries on; it doesn't start over). */
const popOffSeen = new Map<string, number>();

/**
 * His pop-off, as his thinking screen's moments (Boss.tsx), from when this device first saw it: the pop-off's two beats, one after
 * the other; or in the second's place his "Hang on" (Nov 26), its four (hangOnTimeline). It plays while he thinks after your move for
 * the turn it comes (popOffPending); popOffMs holds his move for them.
 */
export function popOffMoments(boss: BossView, now = Date.now()): Moment[] {
  const d = boss.id === "dash" ? boss.powers?.dash : null;
  if (!d?.popOff || !popOffPending(boss)) return [];
  const key = `${boss.id}:${d.popOff.hangOn ? "hangOn" : "popOff"}:${d.popOff.at}`;
  const seenKey = `${boss.startMove}:${key}`;
  let at = popOffSeen.get(seenKey);
  if (at === undefined) {
    popOffSeen.set(seenKey, (at = now));
    if (popOffSeen.size > 20) popOffSeen.delete(popOffSeen.keys().next().value!);
  }
  if (d.popOff.hangOn) {
    const tl = hangOnTimeline();
    return [
      { kind: "hangOn", key, at, ms: POWER_FX.hangOn },
      { kind: "hangOnFast", key: `${key}:fast`, at: at + tl.cheetahAt, ms: POWER_FX.hangOnFast },
      { kind: "hangOnAlmost", key: `${key}:almost`, at: at + tl.almostAt, ms: POWER_FX.hangOnAlmost },
      { kind: "hangOnSorry", key: `${key}:sorry`, at: at + tl.windAt, ms: POWER_FX.hangOnSorry },
    ];
  }
  return [
    { kind: "popOff", key, at, ms: POWER_FX.popOff },
    { kind: "popOffFast", key: `${key}:fast`, at: at + POWER_FX.popOff, ms: POWER_FX.popOffFast },
  ];
}

/** When his "Hang on" started on this screen (its first moment's start), or undefined: none playing now. */
export function hangOnAt(moments: readonly Moment[], now: number): number | undefined {
  const m = moments.find((x) => x.kind === "hangOn");
  return m && now >= m.at && now < m.at + hangOnTimeline().total ? m.at : undefined;
}

/** The position before your move, made once a move (a game's whole history replayed: not every frame). */
let before: { key: string; fen: string } | null = null;

/**
 * The board as his "Hang on" shows it: from `backAt` until `returnAt`, your move taken back (the position before it, his move before
 * yours its last), so the board slides your piece back, then home again as it ends; null otherwise (and if the board's last move
 * isn't yours). The game's board is never touched.
 */
export function hangOnFen(boss: BossView, moments: readonly Moment[], now: number): { fen: string; lastMove: string | null } | null {
  const at = hangOnAt(moments, now);
  if (at === undefined) return null;
  const tl = hangOnTimeline();
  const t = now - at;
  if (t < tl.backAt || t >= tl.returnAt) return null;
  const { history, bases, fen } = boss.board;
  const last = history.at(-1);
  if (!last || pieceAt(fen, last.slice(2, 4))?.color !== boss.crowdSide) return null;
  const key = `${boss.startMove}:${history.length}:${fen}`;
  if (before?.key !== key) before = { key, fen: fenAtPly(history, history.length - 1, bases) };
  return { fen: before.fen, lastMove: history.at(-2) ?? null };
}

/** His extra move after a failed Scramble Rush: its own moment as it lands (Hollow's "TWICE!" in his colors; his line came as time was up). */
function rushExtraMoment({ boss, banner }: MomentProps) {
  return <div class="power-moment pm-extra pm-stay">{banner("TWICE!", `${boss.name} moves again`, "dash")}</div>;
}

/** One of his lines for a moment, the same on every screen (by the moment's key). */
const lineOf = (lines: readonly string[], key: string): string => lines[hash(key) % lines.length]!;

const MOMENTS: Record<"slap" | "scramble" | "flag" | "clockFit" | "popOff" | "popOffFast" | "hangOn" | "hangOnFast" | "hangOnAlmost" | "hangOnSorry" | "rushWarn" | "rushExtra", MomentUi> = {
  // (Your time ran out on your last move: first, his jab.)
  flag: { order: 1, kit: "cheer", view: flagMoment, dock: () => DASH_WORDS.flag, line: (kit, m) => (kit ? pickLine(kit, "flag", m.key) : null) },
  slap: { order: 2, kit: "power", lineAt: B.slap.slamAt, view: slapMoment, dock: () => DASH_WORDS.slap },
  scramble: { order: 3, kit: "ultimate", lineAt: B.scramble.castAt, view: (p) => scrambleMoment(p) },
  // (A quirk, not a power: no banner, nothing for you to do; the dock keeps the turn's line.)
  clockFit: { order: 4, kit: "power", view: fitMoment, line: (_kit, m) => lineOf(DASH_FIT_LINES, m.key) },
  // (His pop-off's two beats, while he thinks: its line each, the second his love for the clock.)
  popOff: { order: 1, kit: "power", view: popOffMoment, line: (_kit, m) => lineOf(DASH_POPOFF_LINES, m.key) },
  // (Its love line cuts in on the pop-off line: a line said while one is up waits its turn, and this one must come before his move.)
  popOffFast: { order: 2, kit: "power", view: popOffFastMoment, line: (_kit, m) => lineOf(DASH_LOVE_LINES, m.key), priority: () => CRITICAL },
  // (His "Hang on" in the second pop-off's place, while he thinks: a line a beat, in order, each cutting in at once on the one
  // before (INTERRUPT: one CRITICAL line waits for another to end, which put "Sorry…" after his move). No kit moment: his runs in
  // place are its own.)
  hangOn: { order: 1, view: hangOnMoment(["hangSlow"]), line: () => DASH_HANG_ON_LINES.start, priority: () => INTERRUPT },
  hangOnFast: { order: 2, view: hangOnMoment(["hangFast"]), line: () => DASH_HANG_ON_LINES.cheetah, priority: () => INTERRUPT },
  hangOnAlmost: { order: 3, view: hangOnMoment(null), line: () => DASH_HANG_ON_LINES.almost, priority: () => INTERRUPT },
  hangOnSorry: { order: 4, view: hangOnMoment(["hangWind", "hangSorry"]), lineAt: hangOnTimeline().sorryAt - hangOnTimeline().windAt, line: () => DASH_HANG_ON_LINES.sorry, priority: () => INTERRUPT },
  // (His Scramble Rush a turn ahead, as any ultimate's warning: RAGE!, "Next turn: Scramble Rush", his clock held up, his line.)
  rushWarn: { order: 1, kit: "ultimateWarn", view: (p) => rageWarn(p, "Scramble Rush", undefined, true), line: (_kit, m) => lineOf(DASH_RUSH_LINES.warn, m.key) },
  rushExtra: { order: 3, kit: "ultimateHit", own: (boss) => boss.powers?.dash?.rush?.extra === "played" && boss.powers.events.some((e) => e.kind === "rushExtra"), view: rushExtraMoment, line: () => null },
};

// ---------------- The countdown over the board ----------------

/**
 * A scrambled move's countdown (Play.tsx, over the board on your move): the seconds left, big (3, 2, 1), in his orange (the
 * scramble's moves left are Tick's, in the bar: "3s × 4"). Drawn again only as the second shown changes (a timer set for that),
 * never per frame; it takes no taps (the board under it plays as ever) and takes no room (it's over the board). It stands in for
 * the move's usual "Round end" count (Play.tsx).
 */
export function ScrambleCount({ boss, startsAt, deadline }: { boss: BossView | null | undefined; startsAt: number; deadline: number }) {
  const d = boss?.id === "dash" ? (boss.powers?.dash ?? null) : null;
  const left = d?.scramble ? scrambleLeft({ ultAt: d.scramble.at }, boss!.crowdMoves + 1, { scrambleMoves: d.scramble.moves }) : 0;
  const [, redraw] = useState(0);
  const now = Date.now();
  const secs = Math.max(0, Math.ceil((deadline - Math.max(now, startsAt)) / 1000));
  useEffect(() => {
    if (!left) return;
    const next = Math.max(now, startsAt) + ((deadline - Math.max(now, startsAt)) % 1000 || 1000) + 5;
    if (deadline <= now) return;
    const t = window.setTimeout(() => redraw((n) => n + 1), Math.max(16, next - now));
    return () => clearTimeout(t);
  }, [left, secs, startsAt, deadline]);
  if (!left || !d?.scramble) return null;
  return (
    // (The app's own big 3-2-1, .center-count's .cc-num, in his orange: the round start's count, reused.)
    <div class="center-count dash-count" role="timer" aria-label={`${secs} seconds left. Time Scramble: ${left} of ${d.scramble.moves} moves left`} data-secs={secs} data-left={left}>
      {secs > 0 && (
        <div key={secs} class={`cc-num dc-n${secs <= 1 ? " last" : ""}`} aria-hidden="true">
          {secs}
        </div>
      )}
    </div>
  );
}

// ---------------- Tick, in the boss bar ----------------

/** Tick's still (his idle's first frame), drawn once a page. */
let tickImage: ImageData | null = null;
function TickStill({ mood }: { mood: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    if (!tickImage) {
      const r = renderFrame(sidekickBlitz, sidekickBlitz.anims.idle!.frames[0]!);
      tickImage = new ImageData(new Uint8ClampedArray(r.data), r.w, r.h);
    }
    g.putImageData(tickImage, 0, 0);
  }, []);
  return <canvas ref={cv} class={`tk-still${mood ? ` tk-${mood.split(":")[0]}` : ""}`} width={sidekickBlitz.w} height={sidekickBlitz.h} />;
}

/**
 * Tick and Dash's tally in the boss bar's prop slot (its size fixed): Tick asleep on the clock; at a slap he bobs awake, through a
 * scramble he rattles. Under him the time Dash has stolen ("−1:30", "0:00" greyed before any), or in a scramble its moves left.
 */
export function TickTally({ boss, moments }: { boss: BossView; moments: () => Moment[] }) {
  const d: DashView | null = boss.powers?.dash ?? null;
  if (!d) return null;
  const now = Date.now();
  const playing = moments().find((m) => now >= m.at - (m.lead ?? 0) && now < m.at + m.ms);
  const left = d.scramble ? scrambleLeft({ ultAt: d.scramble.at }, boss.crowdMoves + 1, { scrambleMoves: d.scramble.moves }) : 0;
  const mood = playing?.kind === "slap" ? `ding:${playing.key}` : left ? "rattle" : "";
  return (
    <span class={`tk-tally${left ? " scrambling" : ""}${d.stolen ? "" : " none"}`} role="group" aria-label={left ? `Time Scramble: ${left} moves left` : `Dash has stolen ${clockShown(d.stolen)}`} data-stolen={d.stolen} data-slaps={d.slaps}>
      <span class="tk-tick" aria-hidden="true">
        {/* (A new mood starts its CSS animation again on a new key, his still drawn again: a slap's bob is keyed by the slap.) */}
        <TickStill key={mood} mood={mood} />
      </span>
      <b class="tk-text" aria-hidden="true">
        {left ? `${d.scramble!.seconds}s × ${left}` : `−${clockShown(d.stolen)}`}
      </b>
    </span>
  );
}

export const DASH_UI = {
  id: "dash",
  // (Time Scramble's warning: RAGE!, "Next turn: Time Scramble". His Scramble Rush's: "Next turn: Scramble Rush", `rushWarn`.)
  // (Every moment where he stands, the warning's too: never over the board.)
  inPlace: true,
  ultimate: { name: "Time Scramble" },
  moments: MOMENTS,
  // Tick and the time Dash has stolen, in the boss bar's free room right of his bars.
  barProp: ({ boss, moments }) => <TickTally boss={boss} moments={moments} />,
} satisfies BossUi;
