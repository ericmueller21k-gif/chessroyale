import { useLayoutEffect, useState } from "preact/hooks";
import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { moveLeft } from "@chessroyale/chess";
import { RECLUSE, RECLUSE_JUMP } from "../characters/recluse.ts";
import { BOSS_KITS } from "../characters/kits.ts";
import { RECLUSE_LINES } from "../characters/recluse-lines.ts";
import { EFFECTS } from "../characters/power-art.ts";
import { Board } from "../components/Board.tsx";
import { SpriteAnim } from "../components/BossEffect.tsx";
import { BossSide } from "../components/BossCharacter.tsx";
import { BossDock } from "../components/BossDock.tsx";
import { useFrameNow } from "../components/Countdown.tsx";
import { FightBanner } from "../components/FightBanner.tsx";
import { COMPUTER_LAYOUT } from "../components/MatchMenu.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import type { GameView, SimulBoardView, SimulView } from "../game.ts";
import type { ComponentChildren } from "preact";
import { PHASE2_ULT_BANNER_MS, PHASE_CHANGE } from "../recluse-phase2.ts";
import { CRITICAL, bossVoice } from "../speech.tsx";
import { Hud } from "./Hud.tsx";
import { BossHeading } from "./Play.tsx";

/**
 * The Hidden Boss's phase change and his phase 2 (rules: packages/chess/src/bosses/recluse-phase2.ts; the driver:
 * recluse-phase2.ts). Both keep the boss screen's frame (the header and his bust on a phone, his figure by the board on a
 * computer, the God King's dock below), so nothing jumps from phase 1's board.
 *
 * The four boards sit in the board's own square as a 2x2, each at its corner (a computer plays them there, as the phase
 * change leaves them). On a phone your board is big and the other three are small above it; tap one to watch it big.
 */

/** Which board each quarter of the square holds (top left, top right, bottom left, bottom right): yours at bottom left. */
const QUARTER_BOARD = [1, 2, 0, 3] as const;
/** Each board's share of the square once split (the rest is the cross between them). */
const CELL = 0.48;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * A quarter's look at `t` (ms into the phase change): its quarter of the whole board, parting from the middle, then
 * growing into a whole board at its corner (its clip opening to the full board as it shrinks toward its corner; the board
 * itself keeps its size: only a transform, which it measures without).
 */
function quarterStyle(q: number, t: number): Record<string, string> {
  const C = PHASE_CHANGE;
  const right = q % 2 === 1;
  const bottom = q >= 2;
  const part = ease((t - C.partAt) / (C.growAt - C.partAt));
  const grow = ease((t - C.growAt) / C.growMs);
  const gap = (1 - grow) * part * 3;
  const scale = 1 - (1 - CELL) * grow;
  const half = 50 * (1 - grow);
  const clip = `inset(${bottom ? half : 0}% ${right ? 0 : half}% ${bottom ? 0 : half}% ${right ? half : 0}%)`;
  return {
    clipPath: clip,
    transformOrigin: `${right ? "100%" : "0"} ${bottom ? "100%" : "0"}`,
    transform: `translate(${right ? gap : -gap}%, ${bottom ? gap : -gap}%) scale(${scale})`,
  };
}

type Pt = { x: number; y: number };
/** His whole figure on the board: its width (% of the board; about his own 2x by a computer's board, larger than his bust on a phone). */
const FIG_W = 24;
const FIG_H = (FIG_W * RECLUSE.h) / RECLUSE.w;
/** Where his feet land, in the middle of the board (% of it); the book lies open just in front of them. */
const MIDDLE: Pt = { x: 50, y: 60 };
/** Where he leaps from and back to (his feet), by his place: a phone's boss bar above the board's top left; a computer's figure by its bottom left. */
const PLACE = { phone: { x: 10, y: 38 }, computer: { x: -12, y: 100 } } as const;
const FLIGHT = RECLUSE_JUMP.landAt - RECLUSE_JUMP.upAt;
/** A leap from `a` to `b`, off the ground at `upAt` (ms into the phase change): where his feet are. */
function leapAt(t: number, a: Pt, b: Pt, upAt: number): Pt {
  const u = clamp01((t - upAt) / FLIGHT);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - 22 * 4 * u * (1 - u) };
}
/** The light's strength at `t`: rising out of the book as he begins to chant, dying as the boards settle. */
function lightAt(t: number): number {
  const C = PHASE_CHANGE;
  return Math.min(clamp01((t - C.chantAt) / C.lightMs), 1 - clamp01((t - (C.growAt + C.growMs - 300)) / 500));
}

/**
 * The phase change on one square stage (PHASE_CHANGE has its beats). Not skippable, like a boss's intro. His place
 * (BossCharacter, from the figure run solo.ts sets) plays his rage; from the leap to his return the board draws his whole
 * figure instead (RECLUSE's on-board animations) and his place stands empty (`rc-away`), his words still beside it.
 */
export function PhaseChangeScreen({ match, at }: { match: GameView; at: number }) {
  const v = match.simul;
  const now = useFrameNow();
  const computer = useMedia(COMPUTER_LAYOUT);
  const t = now - at;
  const C = PHASE_CHANGE;
  // His chant over the book as the light comes (one line, picked by the phase change), and his word as the book is back
  // in his hands.
  const chanting = t >= C.chantAt;
  useLayoutEffect(() => {
    if (chanting) bossVoice.say(RECLUSE_LINES.chant[at % RECLUSE_LINES.chant.length]!, `recluse:chant:${at}`, CRITICAL);
  }, [chanting]);
  const revived = t >= C.catchAt;
  useLayoutEffect(() => {
    if (revived) bossVoice.say(RECLUSE_LINES.revive[at % RECLUSE_LINES.revive.length]!, `recluse:revive:${at}`, CRITICAL);
  }, [revived]);
  if (!v) return null;
  const split = t >= C.partAt;
  const shuffled = t >= C.shuffleAt;
  const away = t >= C.leapAt && t < C.homeAt;
  // (The board jolts as he lands.)
  const jolt = t >= C.landAt && t < C.landAt + 320;
  const place = computer ? PLACE.computer : PLACE.phone;
  // His figure on the board: the leap in, the book thrown down, the chant, the book back in his hands, the leap back.
  const fig =
    t < C.leapAt || t >= C.homeAt
      ? null
      : t < C.dropAt
        ? { anim: "leap", since: at + C.leapAt, feet: leapAt(t, place, MIDDLE, C.upAt) }
        : t < C.chantAt
          ? { anim: "drop", since: at + C.dropAt, feet: MIDDLE }
          : t < C.pickupAt
            ? { anim: "chantRaise", then: "chant", since: at + C.chantAt, feet: MIDDLE }
            : t < C.backAt
              ? { anim: "pickup", since: at + C.pickupAt, feet: MIDDLE }
              : { anim: "leap2", since: at + C.backAt, feet: leapAt(t, MIDDLE, place, C.backAt + RECLUSE_JUMP.upAt) };
  // (His shadow where he'll come down: on the way in only, since on the way back he's gone before he lands.)
  const flying = fig?.anim === "leap" && t >= C.upAt && t < C.landAt;
  const light = lightAt(t);
  const cracking = t >= C.crackAt && t < C.growAt;
  return (
    <div class={`screen game boss-screen rc-change${away ? " rc-away" : ""}`}>
      <Hud match={match} />
      <div class={`board-area${jolt ? " pw-crash" : ""}`}>
        <div class="opening-name">
          <BossHeading side="w" note={split ? "phase 2: Chess960" : "the boss is beaten"} />
        </div>
        <div class="board-row">
          <BossSide match={match} />
          <div class="eval-bar rc-evalgap" aria-hidden="true" />
          <div class="board-wrap rc-stage" data-step={shuffled ? "shuffle" : split ? "split" : cracking ? "crack" : t >= C.chantAt ? "chant" : t >= C.dropAt ? "drop" : t >= C.leapAt ? "leap" : "rage"}>
            {/* (The four boards from the start, each clipped to its quarter: together they are the whole board until they
                part, so the split mounts nothing new on a slow phone.) */}
            {QUARTER_BOARD.map((id, q) => (
              <div key={q} class={`rc-cell rc-split rc-q${q}`} style={quarterStyle(q, t)}>
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
            {light > 0 && (
              <>
                {/* The light pouring up out of the book: behind him a pulsing cone of it, in front a glow on the pages. */}
                <span class="rc-light" style={{ left: `${MIDDLE.x}%`, top: `${MIDDLE.y - 1}%`, opacity: String(light), transform: `scaleY(${0.3 + 0.7 * light})` }} />
                <span class="rc-glow" style={{ left: `${MIDDLE.x}%`, top: `${MIDDLE.y - 1}%`, opacity: String(light) }} />
              </>
            )}
            {flying && <span class="rc-shadow" style={{ left: `${MIDDLE.x}%`, top: `${MIDDLE.y}%` }} />}
            {fig && (
              <span
                class="rc-fig"
                data-anim={fig.anim}
                style={{ width: `${FIG_W}%`, transform: `translate(${(fig.feet.x - (FIG_W * RECLUSE.foot[0]) / RECLUSE.w).toFixed(2)}cqw, ${(fig.feet.y - (FIG_H * RECLUSE.foot[1]) / RECLUSE.h).toFixed(2)}cqw)` }}
              >
                <SpriteAnim ch={RECLUSE} anim={fig.anim} then={fig.then} since={fig.since} sounds={BOSS_KITS["Hidden Boss"]!.sounds} id="rc-fig" />
              </span>
            )}
            {t >= C.bannerAt && <FightBanner text="PHASE 2" sub="Chess960 · win all four boards" tone="boss" sound="bannerStart" />}
          </div>
        </div>
      </div>
      <BossDock
        match={match}
        side="w"
        status={
          <>
            <span class="dock-line">
              <strong>{t < C.chantAt ? "The boss rises!" : t < C.bannerAt ? "One board becomes four…" : "Phase 2!"}</strong>
            </span>
            <span class="dock-line muted">{t < C.bannerAt ? "" : "Every board must be won."}</span>
          </>
        }
      />
    </div>
  );
}

/** m:ss. */
const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const RESULT_WORD = (b: SimulBoardView) => {
  const r = b.result!;
  if (r.winner === "draw") return "Draw";
  const how = r.how === "time" ? " on time" : r.how === "resign" ? ": resigned" : "";
  return r.winner === "crowd" ? "Won" : `Lost${how}`;
};

/** A board's tag over its corner: who plays it and their clock (or its result). */
function Tag({ b, v, now, small }: { b: SimulBoardView; v: SimulView; now: number; small?: boolean }) {
  // (His ultimate: the move's own few seconds, not the bank.)
  const left = moveLeft(v, b, now);
  const running = v.playing && b.toMove === "crowd";
  const low = running && left < (v.ultAt !== null ? 2_000 : 15_000);
  return (
    <span class={`rc-tag${b.you ? " you" : ""}${running ? " running" : ""}${low ? " low" : ""}`}>
      {/* (A phone's small boards: the clock only; the board's button says whose it is.) */}
      {!small && <span class="rc-tag-name">{b.name} </span>}
      <span class="rc-tag-clock">{clock(left)}</span>
    </span>
  );
}

function Outcome({ b }: { b: SimulBoardView }) {
  if (!b.result) return null;
  return <span class={`rc-result ${b.result.winner === "crowd" ? "won" : b.result.winner === "boss" ? "lost" : "draw"}`}>{RESULT_WORD(b)}</span>;
}

/** How long a slow move's board flashes its marks and shows its note (ms). */
const SLOW_NOTE_MS = 1800;
/** A pixel X (5 x 5) in a 7 x 7 cell. */
const X_PIXELS = [[1, 1], [5, 1], [2, 2], [4, 2], [3, 3], [2, 4], [4, 4], [1, 5], [5, 5]] as const;

/**
 * The team's slow moves (Eric, Oct 14): a slot each up to his ultimate (RECLUSE_PHASE2.slowMovesForUlt), a red pixel X
 * for each slow move so far, the rest dim; beside every board, as Jefferson's candle shots stand beside his: a column by
 * its right edge, or a row above a phone's small boards (no room beside them). The board the last one was on flashes.
 */
function SlowMarks({ n, flash, row }: { n: number; flash: boolean; row?: boolean }) {
  const of = RECLUSE_PHASE2.slowMovesForUlt;
  const cells = Array.from({ length: of }, (_, i) => {
    const [x, y] = row ? [i * 8, 0] : [0, i * 8];
    return (
      <g key={i} transform={`translate(${x} ${y})`}>
        <rect width="7" height="7" class="rc-slow-cell" />
        {i < n ? X_PIXELS.map(([px, py]) => <rect key={`${px}${py}`} x={px} y={py} width="1" height="1" class="rc-slow-x" />) : <rect x="2" y="2" width="3" height="3" class="rc-slow-empty" />}
      </g>
    );
  });
  return (
    <span class={`rc-slow ${row ? "row" : "col"}${flash ? " flash" : ""}`} role="img" aria-label={`Slow moves: ${n} of ${of}`} data-slow={n}>
      <span class="rc-slow-label" aria-hidden="true">
        slow
      </span>
      <svg viewBox={row ? `0 0 ${of * 8 - 1} 7` : `0 0 7 ${of * 8 - 1}`} shape-rendering="crispEdges" aria-hidden="true">
        {cells}
      </svg>
    </span>
  );
}

/** One phase 2 board: yours takes moves on your turn. Beside it, the team's slow moves. */
function SimulBoard({ match, v, b, now, small, children }: { match: GameView; v: SimulView; b: SimulBoardView; now: number; small?: boolean; children?: ComponentChildren }) {
  const mine = b.you && v.playing && b.toMove === "crowd";
  const flash = !!v.lastSlow && v.lastSlow.board === b.id && now - v.lastSlow.at < SLOW_NOTE_MS;
  return (
    <Board fen={b.fen} orientation="white" lastMove={b.lastMove} interactive={mine} onMove={(m) => match.simulMove?.(b.id, m)} small={small} silent={!b.you}>
      <Tag b={b} v={v} now={now} small={small} />
      <Outcome b={b} />
      {v.playing && <SlowMarks n={Math.min(v.slow, RECLUSE_PHASE2.slowMovesForUlt)} flash={flash} row={small} />}
      {/* (Which board the last slow move was on: a small note over its top-right corner, for a moment.) */}
      {flash && <span class="rc-slow-note">slow move</span>}
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
  if (!v) return null;
  const mine = v.boards[0]!;
  const big = v.boards.find((b) => b.id === watch) ?? mine;
  const others = v.boards.filter((b) => b.id !== big.id);
  const yourTurn = v.playing && mine.toMove === "crowd";
  // His ultimate as it comes: "5 SECONDS!" over the boards.
  // (On every board at once, held a second longer than a banner usually is; nobody waits for it: the 5 s start now.)
  const ultOn = v.ultAt !== null && now - v.ultAt < PHASE2_ULT_BANNER_MS;
  const ultBanner = ultOn && <FightBanner text={`${RECLUSE_PHASE2.ultMoveSeconds} SECONDS!`} sub="A move every 5 s, or a random one" tone="boss" sound="bannerStart" long />;

  const status = v.decided
    ? v.beaten
      ? "All four boards won!"
      : `${v.won} of ${v.of} won: the boss wins`
    : mine.result
      ? `Your board: ${RESULT_WORD(mine).toLowerCase()}. The others play on.`
      : yourTurn
        ? "Your move"
        : "The boss is thinking…";
  return (
    <div class={`screen game boss-screen rc-simul ${computer ? "rc-desk" : "rc-phone"}${ultOn ? " rc-ult" : ""}`}>
      <Hud match={match} />
      {!computer && (
        <div class="rc-minis" role="list" aria-label="The other boards">
          {others.map((b) => (
            <button type="button" key={b.id} role="listitem" class={`rc-mini${b.you ? " you" : ""}`} aria-label={b.you ? "Back to your board" : `Watch ${b.name}'s board`} onClick={() => setWatch(b.id)}>
              <SimulBoard match={match} v={v} b={b} now={now} small />
            </button>
          ))}
        </div>
      )}
      <div class="board-area">
        <div class="opening-name">
          <BossHeading side="w" note={`Chess960 · ${v.won} of ${v.of} won`} />
        </div>
        <div class="board-row">
          <BossSide match={match} />
          <div class="eval-bar rc-evalgap" aria-hidden="true" />
          {computer ? (
            <div class="board-wrap rc-stage">
              {QUARTER_BOARD.map((id, q) => (
                <div key={q} class={`rc-cell rc-q${q} rc-played`}>
                  <SimulBoard match={match} v={v} b={v.boards[id]!} now={now} />
                </div>
              ))}
              {ultBanner}
            </div>
          ) : (
            <SimulBoard key={big.id} match={match} v={v} b={big} now={now}>
              {ultBanner}
            </SimulBoard>
          )}
        </div>
      </div>
      <BossDock
        match={match}
        side="w"
        canCall={v.playing && !v.decided}
        status={
          <>
            <span class="dock-line">
              <strong>{status}</strong>
            </span>
            <span class="dock-line muted">
              {!computer && big.id !== mine.id ? (
                <button type="button" class="rc-back" onClick={() => setWatch(mine.id)}>
                  Back to my board
                </button>
              ) : mine.result ? (
                ""
              ) : v.ultAt !== null ? (
                // (His ultimate: a few seconds a move, then a random one is played for you.)
                `${RECLUSE_PHASE2.ultMoveSeconds} s a move · ${yourTurn ? `${(moveLeft(v, mine, now) / 1000).toFixed(1)} s left` : "then a random move"}`
              ) : (
                // (The slow moves themselves: the marks beside every board.)
                `Your clock ${clock(moveLeft(v, mine, now))}`
              )}
            </span>
          </>
        }
      />
    </div>
  );
}
