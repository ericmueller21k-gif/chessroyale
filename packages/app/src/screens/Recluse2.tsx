import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { createPortal, memo } from "preact/compat";
import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { moveLeft } from "@chessroyale/chess";
import { CHANGE_HANDS } from "../characters/recluse-transform.ts";
import { RecluseTransform } from "../components/RecluseTransform.tsx";
import { recluseSceneStand, useRect } from "../components/RecluseCutscene.tsx";
import { play } from "../sound.ts";
import { BOSS_KITS } from "../characters/kits.ts";
import { RECLUSE_LINES } from "../characters/recluse-lines.ts";
import { EFFECTS } from "../characters/power-art.ts";
import { Board } from "../components/Board.tsx";
import { boardSize } from "../board/logic.ts";
import { SpriteAnim } from "../components/BossEffect.tsx";
import { BossSide } from "../components/BossCharacter.tsx";
import { BossDock, clockLeft, type DockClockRun } from "../components/BossDock.tsx";
import { CenterCount, useFrameNow, useTicks } from "../components/Countdown.tsx";
import { FightBanner } from "../components/FightBanner.tsx";
import { COMPUTER_LAYOUT } from "../components/MatchMenu.tsx";
import { BossPanel, STRIP_LAYOUT, besideBoard, useBossLayout } from "../components/MovePanel.tsx";
import { UnderBoard, useMedia } from "../components/QuickChat.tsx";
import type { GameView, SimulBoardView, SimulView } from "../game.ts";
import type { ComponentChildren } from "preact";
import { ARC_LIFE, ARC_REDRAW, ARC_STRIKES, PHASE_CHANGE, phase2UltBannerMs, arcPoints, smoothPath, type ArcStrike } from "../recluse-phase2.ts";
import { CRITICAL, NORMAL, VoiceBubble, bossVoice } from "../speech.tsx";
import { Hud } from "./Hud.tsx";
import { useStillKey } from "../hooks.ts";
import { clockShown } from "../clock-text.ts";
import { evalBarOn, underBoardView } from "../prefs.ts";

/**
 * The Hidden Boss's phase change and his phase 2 (rules: packages/chess/src/bosses/recluse-phase2.ts; the driver:
 * recluse-phase2.ts). Both keep phase 1's whole boss screen (Eric, Nov 14: "the board split only replaces the single board"):
 * the header (a computer's boss bar and tools), his bust or figure, the Moves panel and the chat beside the board (a phone's
 * panel left of the God King), your pawn and your team's, and the God King in his place. Only the board's square changes:
 * one board, then the four boards inside that same square (FOUR).
 *
 * A computer plays the four as a 2x2, the gaps between them and to the square's edges all equal, each board's tag in the gap
 * above it. A phone: your board big at the square's bottom, the other three small in a row above it (tap one to watch it big).
 */

/** Which board each quarter of the square holds (top left, top right, bottom left, bottom right): yours at bottom left. */
const QUARTER_BOARD = [1, 2, 0, 3] as const;

/** Where a board sits in the square: its left and top and its size, as fractions of the square. */
type Slot = { x: number; y: number; s: number };
/** A computer's four boards: each `cell` of the square, the gap between them and to the edges the same (DESK_GAP). */
const DESK_CELL = 0.435;
const DESK_GAP = (1 - 2 * DESK_CELL) / 3;
/**
 * A phone's: the three small boards in a row at the square's top (`mini` of it each, equal gaps across, a `tag` row above them
 * for their clocks), yours big under them at the square's bottom, centered (the slow-move marks in the room at its right).
 */
const PHONE = { tag: 0.06, mini: 0.26, big: 0.65 } as const;
const PHONE_GAP = (1 - 3 * PHONE.mini) / 4;
/**
 * The slots: a computer's by quarter (top left, top right, bottom left, bottom right); a phone's, the big one first, then the
 * three small ones from the left. (A computer's top boards: their tag in the gap above them, as the bottom ones'.)
 */
export const FOUR = {
  desk: [
    { x: DESK_GAP, y: DESK_GAP, s: DESK_CELL },
    { x: 1 - DESK_GAP - DESK_CELL, y: DESK_GAP, s: DESK_CELL },
    { x: DESK_GAP, y: 1 - DESK_GAP - DESK_CELL, s: DESK_CELL },
    { x: 1 - DESK_GAP - DESK_CELL, y: 1 - DESK_GAP - DESK_CELL, s: DESK_CELL },
  ],
  phone: [
    { x: (1 - PHONE.big) / 2, y: 1 - PHONE.big, s: PHONE.big },
    ...[0, 1, 2].map((i) => ({ x: PHONE_GAP + i * (PHONE.mini + PHONE_GAP), y: PHONE.tag, s: PHONE.mini })),
  ],
} as const satisfies Record<string, readonly Slot[]>;
/** A phone's slot for each quarter at the split's end: yours (bottom left) big, the others small in quarter order. */
const PHONE_SLOT_OF_QUARTER = [1, 2, 0, 3] as const;
const slotStyle = (b: Slot) => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.s * 100}%`, height: `${b.s * 100}%` });

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * A quarter's look at `t` (ms into the phase change): its quarter of the whole board, parting from the middle, then
 * growing into a whole board in its slot (its clip opening to the full board as it shrinks into the slot; the board
 * itself keeps its size: only a transform, which it measures without).
 */
function quarterStyle(q: number, t: number, desk: boolean, width: number): Record<string, string> {
  const C = PHASE_CHANGE;
  const right = q % 2 === 1;
  const bottom = q >= 2;
  const part = ease((t - C.partAt) / (C.growAt - C.partAt));
  const grow = ease((t - C.growAt) / C.growMs);
  const gap = (1 - grow) * part * 3;
  const slot = desk ? q : PHONE_SLOT_OF_QUARTER[q]!;
  // (It ends exactly where phase 2 draws that board, its squares and their place in the slot (`playedBox`), so nothing snaps as play
  // starts: Nov 14, the four boards were 3 to 6 px smaller in play than at the split's end.)
  const to = playedBox(desk, slot, width);
  const scale = 1 - (1 - to.s) * grow;
  const half = 50 * (1 - grow);
  const clip = `inset(${bottom ? half : 0}% ${right ? 0 : half}% ${bottom ? 0 : half}% ${right ? half : 0}%)`;
  return {
    clipPath: clip,
    transformOrigin: "0 0",
    transform: `translate(${(right ? gap : -gap) + to.x * 100 * grow}%, ${(bottom ? gap : -gap) + to.y * 100 * grow}%) scale(${scale})`,
  };
}

/**
 * Where phase 2 draws a slot's board in a square `width` px across, for the phase change's quarters (each the board drawn whole in
 * that square, moved and scaled): its place as fractions of the square, its size as one of the whole board's. Its squares a whole multiple of 8 device pixels (board/logic.ts `boardSize`) in the slot's box (a phone's
 * small boards inside their button's 2 px border), placed in it as styles.css's `.rc-played > .board-wrap` translate does (a
 * computer's left and top boards 2/3 of the rest in, its right and bottom ones 1/3; a phone's centered). Unmeasured (width 0): the
 * slot itself.
 */
function playedBox(desk: boolean, slot: number, width: number): Slot {
  const to = desk ? FOUR.desk[slot]! : FOUR.phone[slot]!;
  if (!(width > 0)) return to;
  const dpr = devicePixelRatio || 1;
  const whole = boardSize(width, dpr);
  const border = !desk && slot > 0 ? 2 : 0;
  const inner = to.s * width - 2 * border;
  const b = boardSize(inner, dpr);
  const [ox, oy] = desk ? [slot % 2 ? 1 : 2, slot >= 2 ? 1 : 2] : [1.5, 1.5];
  return { x: (to.x * width + border + ((inner - b) * ox) / 3) / width, y: (to.y * width + border + ((inner - b) * oy) / 3) / width, s: b / whole };
}

/** Sounds and lines of the phase change already started (by its start time and name): each once, as its beat comes. */
const cued = new Set<string>();
/** Runs `fn` once, as `on` turns true (a layout effect: as the beat shows, whatever the screen does next). */
function useCue(on: boolean, key: string, fn: () => void) {
  useLayoutEffect(() => {
    if (!on || cued.has(key)) return;
    cued.add(key);
    if (cued.size > 200) cued.delete(cued.values().next().value!);
    fn();
  }, [on]);
}

/** One arc's path: its main stroke from his hand to the cracks, and now and then a short branch off it. */
function arcShape(s: ArcStrike, from: readonly [number, number], redraw: number) {
  const pts = arcPoints(from, s.to, s.seed * 31 + redraw, 4, s.big ? 0.13 : 0.16);
  const main = smoothPath(pts);
  if (s.seed % 3 === 0) return { main, branch: null };
  // (A branch from about the middle, off at an angle, a third as long.)
  const k = 6 + (s.seed % 5);
  const p = pts[k]!;
  const dx = s.to[0] - from[0];
  const dy = s.to[1] - from[1];
  const turn = (s.seed % 2 ? 1 : -1) * 0.6;
  const end: [number, number] = [p[0] + (dx * Math.cos(turn) - dy * Math.sin(turn)) * 0.3, p[1] + (dx * Math.sin(turn) + dy * Math.cos(turn)) * 0.3];
  return { main, branch: smoothPath(arcPoints(p, end, s.seed + redraw * 7, 3, 0.18)) };
}

/**
 * Blue arcs striking the board as it cracks and splits (Eric, Oct 14: the engine's power splits it; "smoother looking"
 * than the game's earlier bolts): from his raised hands to points along the cracks, each a thin bright core in two soft
 * glows (wide strokes, no filter), its shape drawn again every ARC_REDRAW ms, gone in ARC_LIFE ms; where it lands, a blue
 * flash, and the board pulses blue a little with each. One SVG over the board (its own 0-100 square).
 */
function Arcs({ t, hands }: { t: number; hands: readonly (readonly [number, number])[] }) {
  const live = ARC_STRIKES.filter((s) => t >= s.at && t < s.at + ARC_LIFE);
  let pulse = 0;
  for (const s of live) pulse = Math.max(pulse, (s.big ? 1 : 0.55) * (1 - (t - s.at) / ARC_LIFE));
  return (
    <>
      <span class="rc-zap" style={{ opacity: String(pulse.toFixed(3)) }} />
      <svg class="rc-arcs" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {live.map((s) => {
          const age = t - s.at;
          const o = age < 40 ? 1 : Math.pow(1 - (age - 40) / (ARC_LIFE - 40), 1.6);
          const { main, branch } = arcShape(s, hands[s.hand]!, Math.floor(age / ARC_REDRAW));
          const w = s.big ? 1.3 : 1;
          return (
            <g key={`${s.at}:${s.hand}`} opacity={o.toFixed(3)}>
              <circle class="rc-arc-hit" cx={s.to[0]} cy={s.to[1]} r={(2.4 + 3.6 * (age / ARC_LIFE)) * w} />
              <path class="rc-arc-glow2" d={main} stroke-width={3.2 * w} />
              <path class="rc-arc-glow" d={main} stroke-width={1.3 * w} />
              <path class="rc-arc-core" d={main} stroke-width={0.45 * w} />
              {branch && <path class="rc-arc-glow" d={branch} stroke-width={0.7 * w} />}
              {branch && <path class="rc-arc-core" d={branch} stroke-width={0.25 * w} />}
            </g>
          );
        })}
      </svg>
    </>
  );
}

/** How late a phase change's sound may still start (a frame or a slow phone's few late): later, it's left out. */
const CUE_LATE_MS = 500;
/**
 * The phase change on one square stage (PHASE_CHANGE has its beats): his transformation by the book's light, carrying on from his
 * cutscene (Eric, Nov 14). Not skippable, like a boss's intro. Over the board, RecluseTransform draws the lens, the light, the
 * child and him from the start to his leap home (his place stands empty meanwhile: `rc-away`, his words over his head there); the
 * board's square here: the four quarters (together the whole board until they part; the big board is never drawn behind them), the
 * crack and the blue arcs from his hands as he lands on the music's drop, the shuffle, "PHASE 2". The God King stays in his place,
 * greyed. His suit shows where he stands from the white-out on (solo.ts and recluse-online.ts: setSuitAt).
 */
export function PhaseChangeScreen({ match, at }: { match: GameView; at: number }) {
  const v = match.simul;
  const now = useFrameNow();
  const computer = useMedia(COMPUTER_LAYOUT);
  const t = now - at;
  const C = PHASE_CHANGE;
  const cue = (on: boolean, name: string, fn: () => void) => useCue(on, `${at}:${name}`, fn);
  // (Each at its moment only: a device that joins or reloads later doesn't play it as it comes in. Nov 14 review, m3.)
  cue(t >= C.revealAt && t < C.revealAt + CUE_LATE_MS, "reveal", () => play("recluseSpark"));
  cue(t >= C.arcAt && t < C.arcAt + CUE_LATE_MS, "arcs", () => play("recluseArc"));
  // His two lines (Eric, Nov 13 and 14), each typed at its own pace at its time (`chantLines`): the first with his visor up, the
  // second as the board splits.
  const chantLine = C.chantLines.filter((l) => t >= l.at).length;
  useLayoutEffect(() => {
    const l = C.chantLines[chantLine - 1];
    if (l) bossVoice.sayPaced(l.line, `recluse:chant${chantLine}:${at}`, CRITICAL, at + l.at);
  }, [chantLine]);
  // (The header and the boss's place don't move with the frame: drawn as the match changes, useStillKey.)
  const still = useStillKey(match, now);
  const hud = useMemo(() => <Hud match={match} />, [match, still]);
  const bossSide = useMemo(() => <BossSide match={match} />, [match, still]);
  // (Phase 1's Moves panel and chat, beside the board on a computer, left of the God King on a phone: kept in their places.)
  const layout = useBossLayout();
  const under = useMemo(() => besideBoard(match, layout, <UnderBoard match={match} />), [match, still, layout.strip, layout.computer]);
  const panel = useMemo(() => (layout.strip ? <BossPanel match={match} /> : undefined), [match, still, layout.strip]);
  const strip = layout.strip;
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const rect = useRect(stage);
  if (!v) return null;
  const split = t >= C.partAt;
  const shuffled = t >= C.shuffleAt;
  const away = t < C.homeAt;
  const cracking = t >= C.crackAt && t < C.growAt;
  // (The cutscene's loop of him and the child, carried on: its start, ms into the phase change, from the scene as fitted to its hold.)
  const sceneStand = recluseSceneStand(match.cutscene, at);
  // (No scoreboard here: phase 1's, minimized, gave the board more of a phone's height, so its size is kept until the
  // split by the same rule: styles.css, rc-folded. A phone upright has no scoreboard to minimize in phase 1 since Oct 25,
  // its panel beside the God King keeping one size: there a fold remembered from another match changes nothing.)
  const folded = !strip && !underBoardView().open;
  return (
    <div class={`screen game boss-screen rc-change${away ? " rc-away" : ""}${folded ? " rc-folded" : ""}`}>
      {hud}
      {/* (No line above the board (Eric, Oct 24): the dock's second line says "Freestyle" once the boards split, the variant
          players see: FIDE's name for Chess960.) */}
      <div class={`board-area${t >= C.crackAt && t < C.crackAt + 320 ? " pw-crash" : ""}`}>
        <div class="board-row">
          {bossSide}
          {/* (The eval bar's slot as phase 1 has it: none while it's off, prefs.ts, so the square is phase 1's board's.) */}
          {evalBarOn() && <div class="eval-bar rc-evalgap" aria-hidden="true" />}
          <div
            ref={setStage}
            class="board-wrap rc-stage"
            data-step={shuffled ? "shuffle" : split ? "split" : cracking ? "crack" : t >= C.revealAt ? "revealed" : t >= C.whiteFull ? "white" : t >= C.burstAt ? "light" : "book"}
          >
            {/* (The four boards from the start, each clipped to its quarter: together they are the whole board until they
                part, so the split mounts nothing new on a slow phone.) */}
            {QUARTER_BOARD.map((id, q) => (
              <div key={q} class={`rc-cell rc-split rc-q${q}`} style={quarterStyle(q, t, computer, rect?.width ?? 0)}>
                <Board fen={shuffled ? v.boards[id]!.fen : v.from} orientation="white" silent />
              </div>
            ))}
            {cracking && (
              <>
                <span class="rc-crack">
                  <SpriteAnim ch={EFFECTS.boardGap.ch} anim={t < C.partAt ? "run" : "part"} then="gap" since={at + (t < C.partAt ? C.crackAt : C.partAt)} sounds={EFFECTS.boardGap.sounds} id="rc-v" />
                </span>
                <span class="rc-crack rc-crack-h">
                  <SpriteAnim ch={EFFECTS.boardGap.ch} anim={t < C.partAt ? "run" : "part"} then="gap" since={at + (t < C.partAt ? C.crackAt : C.partAt)} id="rc-h" />
                </span>
              </>
            )}
            {t >= C.arcAt && t < C.arcEnd + ARC_LIFE && <Arcs t={t} hands={CHANGE_HANDS} />}
            {t >= C.bannerAt && <FightBanner text="PHASE 2" sub="Win all four boards" tone="boss" sound="bannerStart" ms={C.bannerMs} />}
          </div>
        </div>
      </div>
      {away && rect && <RecluseTransform at={at} t={t} rect={rect} computer={computer} sceneStand={sceneStand} />}
      <BossDock
        match={match}
        side="w"
        // (The God King stays in his place, greyed, as in phase 2: Eric, Nov 14.)
        king="benched"
        panel={panel}
        // (No move is anyone's during the phase change: no clock.)
        clock={null}
        // (Never what his bubble or the banner says at the same moment, Eric, Oct 15; as the banner shows, the clock you'll have,
        // which nothing else on screen says yet: on two lines, so a phone shows it whole.)
        status={
          <>
            <span class="dock-line">
              <strong>
                {t < C.whiteFull
                  ? "The book's light takes him!"
                  : t < C.crackAt
                    ? "He's transformed!"
                    : t < C.bannerAt
                      ? "One board becomes four…"
                      : `${clockShown(RECLUSE_PHASE2.bankSeconds * 1000)} on your clock`}
              </strong>
            </span>
            {/* (The second line kept, empty until then, so the box keeps its height.) */}
            <span class="dock-line muted">{t >= C.bannerAt ? "No added time." : split ? "Freestyle" : ""}</span>
          </>
        }
      />
      {under}
    </div>
  );
}

const RESULT_WORD = (b: SimulBoardView) => {
  const r = b.result!;
  if (r.winner === "draw") return "Draw";
  const how = r.how === "time" ? " on time" : r.how === "resign" ? ": resigned" : "";
  return r.winner === "crowd" ? "Won" : `Lost${how}`;
};

/**
 * A board's tag: who plays it and their clock. A computer's four boards: in the row above each (DESK), off its back rank;
 * a phone's small boards, just above each, off their pieces (Eric, Oct 15), the name cut short to fit (Nov 14: with the clock alone
 * a player couldn't tell whose board was whose). A phone's big board: none on yours (your clock is the dock's), the player's name on one you're watching.
 */
function Tag({ b, v, now, big }: { b: SimulBoardView; v: SimulView; now: number; big?: boolean }) {
  if (big) return b.you ? null : <span class="rc-tag">{b.name}</span>;
  // (His ultimate: the move's own few seconds, not the bank. Paused online (his move late): where it stood as the pause began.)
  const paused = v.paused ?? null;
  const left = moveLeft(v, b, paused ?? now);
  const running = v.playing && b.toMove === "crowd" && paused === null;
  const low = running && left < (v.ultAt !== null ? 2_000 : 15_000);
  return (
    <span class={`rc-tag${b.you ? " you" : ""}${running ? " running" : ""}${low ? " low" : ""}`}>
      <span class="rc-tag-name">{b.name}</span>{" "}
      <span class="rc-tag-clock">{clockShown(left)}</span>
    </span>
  );
}

/** Online, the fight paused for his late move, or ended with no result: what every board still on says, where a result would. */
export const PAUSED_WORD = "He's thinking…";
export const NO_RESULT_WORD = "No result";
/** The dock's words (and the results screen's) when the fight ended with no result: his move never came from the engine server. */
export const NO_RESULT_LINE = "No result: the Hidden Boss couldn't connect.";

function Outcome({ b, v }: { b: SimulBoardView; v: SimulView }) {
  if (!b.result) return v.noResult ? <span class="rc-result">{NO_RESULT_WORD}</span> : v.paused != null ? <span class="rc-result">{PAUSED_WORD}</span> : null;
  return <span class={`rc-result ${b.result.winner === "crowd" ? "won" : b.result.winner === "boss" ? "lost" : "draw"}`}>{RESULT_WORD(b)}</span>;
}

/** How long a slow move's board flashes its marks and shows its note (ms). */
const SLOW_NOTE_MS = 1800;
/** A pixel X (5 x 5) in a 7 x 7 cell. */
const X_PIXELS = [[1, 1], [5, 1], [2, 2], [4, 2], [3, 3], [2, 4], [4, 4], [1, 5], [5, 5]] as const;

/**
 * The team's slow moves (Eric, Oct 14): a slot each up to his ultimate (RECLUSE_PHASE2.slowMovesForUlt), a red pixel X
 * for each slow move so far, the rest dim; in a column by the right edge of your board only (Eric, Oct 14: the count is the
 * team's, the same on every board, so once is enough), as Jefferson's candle shots stand beside his. On a phone, by the
 * big board (yours, or the one you're watching). They flash at every slow move, whoever's.
 */
function SlowMarks({ n, flash }: { n: number; flash: boolean }) {
  const of = RECLUSE_PHASE2.slowMovesForUlt;
  const cells = Array.from({ length: of }, (_, i) => {
    return (
      <g key={i} transform={`translate(0 ${i * 8})`}>
        <rect width="7" height="7" class="rc-slow-cell" />
        {i < n ? X_PIXELS.map(([px, py]) => <rect key={`${px}${py}`} x={px} y={py} width="1" height="1" class="rc-slow-x" />) : <rect x="2" y="2" width="3" height="3" class="rc-slow-empty" />}
      </g>
    );
  });
  return (
    <span class={`rc-slow col${flash ? " flash" : ""}`} role="img" aria-label={`Slow moves: ${n} of ${of}`} data-slow={n}>
      <span class="rc-slow-label" aria-hidden="true">
        slow
      </span>
      <svg viewBox={`0 0 7 ${of * 8 - 1}`} shape-rendering="crispEdges" aria-hidden="true">
        {cells}
      </svg>
    </span>
  );
}

/**
 * One phase 2 board: yours takes moves on your turn. `marks`: the team's slow moves beside it (one board shows them).
 * `big`: a phone's big board.
 */
function SimulBoard({ match, v, b, now, small, big, marks: withMarks, count, children }: { match: GameView; v: SimulView; b: SimulBoardView; now: number; small?: boolean; big?: boolean; marks?: boolean; count?: number | null; children?: ComponentChildren }) {
  const mine = b.you && v.playing && b.toMove === "crowd" && v.paused == null && !v.decided;
  const recent = !!v.lastSlow && now - v.lastSlow.at < SLOW_NOTE_MS;
  // (The note marks the board the slow move was on; the marks flash at any slow move.)
  const flash = recent && v.lastSlow!.board === b.id;
  const n = Math.min(v.slow, RECLUSE_PHASE2.slowMovesForUlt);
  // (The same element while its count and flash stand: the screen draws every frame, the marks only when they change.)
  const marks = useMemo(() => <SlowMarks n={n} flash={recent} />, [n, recent]);
  return (
    <Board fen={b.fen} orientation="white" lastMove={b.lastMove} interactive={mine} onMove={(m) => match.simulMove?.(b.id, m)} small={small} silent={!b.you}>
      <Tag b={b} v={v} now={now} big={big} />
      <Outcome b={b} v={v} />
      {v.playing && withMarks && marks}
      {/* (Which board the last slow move was on: a small note over its top-right corner, for a moment.) */}
      {flash && <span class="rc-slow-note">slow move</span>}
      {/* (Before the clocks run: the countdown, big on every board; "Get ready" over yours.) */}
      {count != null && count > 0 && <CenterCount label={b.you ? "Get ready" : null} n={count} />}
      {children}
    </Board>
  );
}

/** His phase 2: four boards at once. */
export function SimulScreen({ match }: { match: GameView }) {
  const v = match.simul;
  const now = useFrameNow();
  const computer = useMedia(COMPUTER_LAYOUT);
  const [watch, setWatch] = useState(0);
  // (The header and the boss's place don't move with the frame: drawn as the match changes, useStillKey.)
  const still = useStillKey(match, now);
  const hud = useMemo(() => <Hud match={match} />, [match, still]);
  const bossSide = useMemo(() => <BossSide match={match} />, [match, still]);
  // (The Moves panel and chat in phase 1's places (PhaseChangeScreen); the Moves list your own board now: MovePanel.tsx.)
  const layout = useBossLayout();
  const under = useMemo(() => besideBoard(match, layout, <UnderBoard match={match} />), [match, still, layout.strip, layout.computer]);
  const panel = useMemo(() => (layout.strip ? <BossPanel match={match} /> : undefined), [match, still, layout.strip]);
  // (Back to your board, the first: the same callback every frame, so the dock isn't drawn again for it.)
  const back = useCallback(() => setWatch(match.simul?.boards[0]?.id ?? 0), [match]);
  // The boards set, before the clocks run (Eric, Oct 17: a player who's never seen the split needs a moment): a big 5, 4,
  // 3, 2, 1 on every board, a tick each second, as a round's 3-2-1 (`at`: when the clocks start).
  const clocksAt = match.phase.kind === "simul" ? match.phase.at : 0;
  const counting = !!v && !v.playing && !v.decided && now < clocksAt;
  const count = counting ? Math.ceil((clocksAt - now) / 1000) : null;
  useTicks(count ?? 0, RECLUSE_PHASE2.change.countdownSeconds, counting);
  if (!v) return null;
  const mine = v.boards[0]!;
  const big = v.boards.find((b) => b.id === watch) ?? mine;
  const others = v.boards.filter((b) => b.id !== big.id);
  // (Online a Crowd final's watcher has no board: none is "yours".)
  // (Paused online, his move late: nobody's turn runs; ended with no result: none.)
  const yourTurn = v.playing && mine.you && mine.toMove === "crowd" && v.paused == null && !v.decided;
  // His ultimate as it comes: "5 SECONDS!" over the boards.
  // (On every board at once; nobody waits for it: the 5 s start now.)
  const ultOn = v.ultAt !== null && now - v.ultAt < phase2UltBannerMs();
  // (Its name alone: what it means, "5 s a move, or a random one", is the dock's.)
  const ultBanner = ultOn && <FightBanner text={`${RECLUSE_PHASE2.ultMoveSeconds} SECONDS!`} tone="boss" sound="bannerStart" ms={phase2UltBannerMs()} />;

  // Your board's clock in the dock (DockClock): running on your move, holding (undefined) while he answers, none (null)
  // once your board is decided or before the clocks start.
  const run: DockClockRun | null | undefined =
    mine.result || !v.playing || !mine.you || v.noResult ? null : yourTurn && mine.turnAt !== null ? { startsAt: mine.turnAt, deadline: mine.turnAt + (v.ultAt !== null ? RECLUSE_PHASE2.ultMoveSeconds * 1000 : mine.bankMs) } : undefined;
  // (How many are won: the boss bar's right side.)
  const status = v.noResult
    ? NO_RESULT_LINE
    : v.decided
    ? v.beaten
      ? "All four boards won!"
      : "The boss wins."
    : mine.result
      ? `Your board: ${RESULT_WORD(mine).toLowerCase()}. The others play on.`
      : !v.playing
        ? // (Before the clocks run: the clock you'll have, as "PHASE 2" said it.)
          `${clockShown(RECLUSE_PHASE2.bankSeconds * 1000)} on your clock`
        : v.paused != null
        ? PAUSED_WORD
        : yourTurn
        ? "Your move"
        : "The boss is thinking…";
  return (
    // (The small boards' "5 s!" as his ultimate comes, from the setting: styles.css, .rc-ult .rc-mini.)
    <div class={`screen game boss-screen rc-simul ${computer ? "rc-desk" : "rc-phone"}${ultOn ? " rc-ult" : ""}`} style={{ "--rc-ult-note": `"${RECLUSE_PHASE2.ultMoveSeconds} s!"` }}>
      {hud}
      <div class="board-area">
        <div class="board-row">
          {bossSide}
          {/* (The eval bar's slot as phase 1 has it: none while it's off, prefs.ts, so the square is phase 1's board's.) */}
          {evalBarOn() && <div class="eval-bar rc-evalgap" aria-hidden="true" />}
          {/* (The four boards inside phase 1's one board's square: FOUR.) */}
          <div class="board-wrap rc-stage">
            {computer ? (
              QUARTER_BOARD.map((id, q) => (
                <div key={q} class={`rc-cell rc-q${q} rc-played`} style={slotStyle(FOUR.desk[q]!)}>
                  <SimulBoard match={match} v={v} b={v.boards[id]!} now={now} marks={v.boards[id]!.you} count={count} />
                </div>
              ))
            ) : (
              <>
                <div key={`big${big.id}`} class="rc-cell rc-played rc-big" style={slotStyle(FOUR.phone[0])}>
                  <SimulBoard match={match} v={v} b={big} now={now} big marks count={count} />
                </div>
                {others.map((b, i) => (
                  <button type="button" key={b.id} class={`rc-cell rc-played rc-mini${b.you ? " you" : ""}`} style={slotStyle(FOUR.phone[i + 1]!)} aria-label={b.you ? "Back to your board" : `Watch ${b.name}'s board`} onClick={() => setWatch(b.id)}>
                    <SimulBoard match={match} v={v} b={b} now={now} small count={count} />
                  </button>
                ))}
              </>
            )}
            {ultBanner}
          </div>
        </div>
      </div>
      <SimulDock
        match={match}
        still={still}
        secs={run ? Math.ceil(clockLeft(run, now) / 1000) : null}
        status={status}
        line={!computer && big.id !== mine.id ? "back" : mine.result ? "" : !v.playing && !v.decided ? "ready" : v.ultAt !== null ? "ult" : ""}
        onBack={back}
        runFrom={run ? run.startsAt : null}
        runTo={run ? run.deadline : null}
        held={run === undefined}
        panel={panel}
      />
      {under}
    </div>
  );
}

/**
 * Phase 2's dock, drawn when what it shows changes rather than every frame of the screen: its words, your clock's run,
 * the whole seconds your clock shows at the screen's frame (`secs`, worked out from the same time as the boards' clocks,
 * so the dock's clock and theirs tick in the same frame), and as the match changes and five times a second (`still`,
 * for what the dock's other parts read as they're drawn). docs/decisions/2026-10-16-the-reveal-draws-only-what-changed.md.
 */
const SimulDock = memo(function SimulDock({
  match,
  status,
  line,
  onBack,
  runFrom,
  runTo,
  held,
  panel,
}: {
  match: GameView;
  still: string;
  secs: number | null;
  status: string;
  line: "back" | "ult" | "ready" | "";
  onBack: () => void;
  runFrom: number | null;
  runTo: number | null;
  held: boolean;
  panel?: ComponentChildren;
}) {
  return (
    <BossDock
      match={match}
      side="w"
      // (The God King stays in his place, his powers greyed: he can't be called in phase 2. Eric, Nov 14.)
      king="benched"
      panel={panel}
      // Your board's clock at the box's right: its bank (from his ultimate, the few seconds a move) running on your move,
      // holding while he answers; none once your board is decided or before the clocks start.
      clock={runFrom !== null && runTo !== null ? { startsAt: runFrom, deadline: runTo } : held ? undefined : null}
      status={
        <>
          <span class="dock-line">
            <strong>{status}</strong>
            {/* (Freestyle: FIDE's name for the Chess960 boards, the variant the players see; the line above the board said it.) */}
            <span class="muted"> · Freestyle</span>
          </span>
          <span class="dock-line muted">
            {line === "back" ? (
              <button type="button" class="rc-back" onClick={onBack}>
                Back to my board
              </button>
            ) : line === "ready" ? (
              "No added time."
            ) : line === "ult" ? (
              // (His ultimate: a few seconds a move, then a random one is played for you; the seconds are your clock.)
              `${RECLUSE_PHASE2.ultMoveSeconds} s a move, or a random one`
            ) : (
              // (Your board decided, or the slow moves themselves: the marks beside every board; your time: the clock at
              // the box's right.)
              ""
            )}
          </span>
        </>
      }
    />
  );
});
