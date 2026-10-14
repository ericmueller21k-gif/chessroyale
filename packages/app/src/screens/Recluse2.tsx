import { useLayoutEffect, useState } from "preact/hooks";
import { bankLeft } from "@chessroyale/chess";
import { RECLUSE_BOOK } from "../characters/recluse.ts";
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
import { PHASE_CHANGE } from "../recluse-phase2.ts";
import { play } from "../sound.ts";
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

const BOOK_SOUNDS = { slam: "recluseShut", snap: "recluseShut" } as const;
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

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

/** The phase change on one square stage (PHASE_CHANGE has its beats). Not skippable, like a boss's intro. */
export function PhaseChangeScreen({ match, at }: { match: GameView; at: number }) {
  const v = match.simul;
  const now = useFrameNow();
  const t = now - at;
  const C = PHASE_CHANGE;
  // His word as he snaps upright, the book back in his hand.
  const revived = t >= C.bookGoneAt;
  useLayoutEffect(() => {
    if (revived) bossVoice.say(RECLUSE_LINES.revive[at % RECLUSE_LINES.revive.length]!, `recluse:revive:${at}`, CRITICAL);
  }, [revived]);
  // The pages fluttering as the pieces fly.
  const flipping = t >= C.flipAt;
  useLayoutEffect(() => {
    if (flipping) play("recluseFlip");
  }, [flipping]);
  if (!v) return null;
  const split = t >= C.partAt;
  const shuffled = t >= C.shuffleAt;
  const slamming = t >= C.slamAt + 140 && t < C.slamAt + 420;
  // The book: in flight from his side to the middle (spinning), slammed down, lying there, its pages flipping, shut.
  const fly = ease(Math.min(1, t / C.flyMs));
  const book =
    t < C.slamAt
      ? { anim: "fly", since: at, x: 8 + (50 - 8) * fly, y: -14 + (50 + 14) * fly, size: 0.16 + 0.09 * fly }
      : t < C.flipAt
        ? { anim: "slam", since: at + C.slamAt, then: "idle", x: 50, y: 50, size: 0.25 }
        : t < C.closeAt
          ? { anim: "flip", since: at + C.flipAt, x: 50, y: 50, size: 0.25 }
          : t < C.bookGoneAt
            ? { anim: "close", since: at + C.closeAt, x: 50, y: 50, size: 0.25 }
            : null;
  const cracking = t >= C.crackAt && t < C.growAt;
  return (
    <div class="screen game boss-screen rc-change">
      <Hud match={match} />
      <div class={`board-area${slamming ? " pw-crash" : ""}`}>
        <div class="opening-name">
          <BossHeading side="w" note={split ? "phase 2: Chess960" : "the boss is beaten"} />
        </div>
        <div class="board-row">
          <BossSide match={match} />
          <div class="eval-bar rc-evalgap" aria-hidden="true" />
          <div class="board-wrap rc-stage" data-step={shuffled ? "shuffle" : split ? "split" : cracking ? "crack" : "slam"}>
            {!split ? (
              <div class="rc-cell rc-whole">
                <Board fen={v.from} orientation="white" animate={false} />
              </div>
            ) : (
              QUARTER_BOARD.map((id, q) => (
                <div key={q} class={`rc-cell rc-split rc-q${q}`} style={quarterStyle(q, t)}>
                  <Board fen={shuffled ? v.boards[id]!.fen : v.from} orientation="white" silent />
                </div>
              ))
            )}
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
            {book && (
              <span class="rc-book" style={{ left: `${book.x}%`, top: `${book.y}%`, width: `${book.size * 100}%` }}>
                <SpriteAnim ch={RECLUSE_BOOK} anim={book.anim} then={book.then} since={book.since} sounds={BOOK_SOUNDS} id="rc-book" />
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
              <strong>{t < C.partAt ? "The red book!" : t < C.bannerAt ? "One board becomes four…" : "Phase 2!"}</strong>
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
function Tag({ b, now, playing, small }: { b: SimulBoardView; now: number; playing: boolean; small?: boolean }) {
  const left = bankLeft(b, now);
  const running = playing && b.toMove === "crowd";
  return (
    <span class={`rc-tag${b.you ? " you" : ""}${running ? " running" : ""}${left < 15_000 && running ? " low" : ""}`}>
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

/** One phase 2 board: yours takes moves on your turn. */
function SimulBoard({ match, v, b, now, small }: { match: GameView; v: SimulView; b: SimulBoardView; now: number; small?: boolean }) {
  const mine = b.you && v.playing && b.toMove === "crowd";
  return (
    <Board fen={b.fen} orientation="white" lastMove={b.lastMove} interactive={mine} onMove={(m) => match.simulMove?.(b.id, m)} small={small} silent={!b.you}>
      <Tag b={b} now={now} playing={v.playing} small={small} />
      <Outcome b={b} />
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
    <div class={`screen game boss-screen rc-simul ${computer ? "rc-desk" : "rc-phone"}`}>
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
            </div>
          ) : (
            <SimulBoard key={big.id} match={match} v={v} b={big} now={now} />
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
              ) : (
                `Your clock ${clock(bankLeft(mine, now))} · no added time`
              )}
            </span>
          </>
        }
      />
    </div>
  );
}
