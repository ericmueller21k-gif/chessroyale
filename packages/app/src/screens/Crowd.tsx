import { useEffect, useMemo, useState } from "preact/hooks";
import { applyMove, sideToMove, toSan } from "@chessroyale/chess";
import type { Augment } from "@chessroyale/core";
import { Board, type Arrow } from "../components/Board.tsx";
import { TimerBar, useFrameNow } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { MiniTower } from "../components/MiniTower.tsx";
import { SquareRing } from "../components/ShadeMoves.tsx";
import { myTeam, type BoardView, type GameView, type GroupReveal, type Standing } from "../game.ts";
import { seenKey } from "../hooks.ts";
import { play } from "../sound.ts";
import { Hud } from "./Hud.tsx";
import { ordinal } from "./StageBreak.tsx";

const sideName = (s: "w" | "b") => (s === "w" ? "White" : "Black");
const fmt = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);

/** Crowd 50 v 50: the other team is choosing (or their votes are being counted). You watch. */
export function WatchScreen({
  match,
  board,
  startsAt,
  deadline,
  counting = false,
}: {
  match: GameView;
  board: BoardView;
  startsAt: number;
  deadline: number;
  counting?: boolean;
}) {
  const side = sideToMove(board.fen);
  const team = myTeam(match) ?? (side === "w" ? "b" : "w");
  useEffect(() => {
    match.seen.set(seenKey(board), board.ply);
  }, [board]);
  const choosing = match.standings().filter((s) => !s.out && s.team === side);
  const done = choosing.filter((s) => match.done.has(s.id)).length;
  return (
    <div class="screen game crowd">
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">
          <strong>{sideName(side)} team</strong> is choosing · you're on <strong>{sideName(team)}</strong>
        </div>
        <div class="board-row">
          <EvalBar fen={board.fen} orientation={team} evaluate={(f) => match.evaluate(f)} />
          <Board fen={board.fen} orientation={team === "w" ? "white" : "black"} lastMove={board.lastMove}>
            {!counting && deadline > 0 && <TimerBar startsAt={startsAt} deadline={deadline} total={Math.max(1, deadline - startsAt)} />}
          </Board>
        </div>
      </div>
      <div class="play-footer">
        <div class="waiting-banner" role="status">
          <span class="waiting-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>{counting ? "Counting the votes…" : `${sideName(side)} is voting.`}</strong>{" "}
            {counting ? "" : "Your team moves next."}
          </span>
          {choosing.length > 0 && (
            <span class="waiting-count">
              {done}/{choosing.length}
            </span>
          )}
        </div>
      </div>
      <MiniTower match={match} />
    </div>
  );
}

/**
 * Crowd's reveal: a live poll instead of the shuffle. The most picked moves
 * grow as vote bars (and arrows on the board), the winner blinks three times
 * with three tones, then it's played.
 */
export function CrowdReveal({ match, mine, board, until }: { match: GameView; mine: GroupReveal; board: BoardView; until: number }) {
  const [start] = useState(Date.now());
  const now = useFrameNow();
  const total = Math.max(2500, until - start);
  const growEnd = Math.min(1500, total * 0.32);
  const landAt = growEnd + 250;
  const playAt = landAt + 750;
  const t = now - start;
  const grow = Math.min(1, t / growEnd);
  const landed = t >= landAt;
  const played = t >= playAt;
  useEffect(() => {
    match.seen.set(seenKey(board), board.ply + 1);
  }, [board]);

  const fen = mine.fenBefore;
  const team = myTeam(match);
  const orientation = (team ?? sideToMove(fen)) === "w" ? "white" : "black";
  const picks = mine.result.players;
  const voters = picks.filter((p) => p.move).length;
  const rows = useMemo(() => {
    const byMove = new Map<string, { move: string; votes: number; you: boolean }>();
    for (const p of picks) {
      if (!p.move) continue;
      const r = byMove.get(p.move) ?? { move: p.move, votes: 0, you: false };
      r.votes++;
      r.you ||= match.isYou(p.playerId);
      byMove.set(p.move, r);
    }
    return [...byMove.values()].sort((a, b) => b.votes - a.votes || (a.move === mine.result.playedMove ? -1 : 1)).slice(0, 5);
  }, [mine]);
  const top = rows[0]?.votes ?? 1;
  const me = picks.find((p) => match.isYou(p.playerId));
  const yours = me?.move ?? null;
  const yourRow = yours && !rows.some((r) => r.move === yours) ? { move: yours, votes: picks.filter((p) => p.move === yours).length, you: true } : null;

  // A roulette blip as each bar grows in, then three tones as the winner blinks.
  const step = Math.min(rows.length, Math.floor(grow * rows.length + 0.001));
  useEffect(() => {
    if (step > 0 && !landed) play("reel");
  }, [step]);
  useEffect(() => {
    if (landed) play("select");
  }, [landed]);

  const brushes = ["green", "blue", "yellow"] as const;
  const arrows: Arrow[] = played
    ? []
    : rows.slice(0, 3).map((r, i) => ({
        move: r.move,
        brush: landed ? (r.move === mine.result.playedMove ? "green" : "paleGrey") : brushes[i]!,
        label: String(Math.round(r.votes * grow)),
      }));

  return (
    <div class="screen game crowd" onClick={() => played && match.skipReveal()}>
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">
          <strong>{sideName(sideToMove(fen))}</strong> · {voters} {voters === 1 ? "vote" : "votes"}
        </div>
        <Board fen={played ? applyMove(fen, mine.result.playedMove) : fen} orientation={orientation} lastMove={played ? mine.result.playedMove : board.lastMove} arrows={arrows}>
          {played && <SquareRing square={mine.result.playedMove.slice(2, 4)} orientation={orientation} />}
        </Board>
      </div>
      <div class="poll" role="status">
        {rows.map((r) => {
          const win = landed && r.move === mine.result.playedMove;
          return (
            <div key={r.move} class={`poll-row${win ? " win" : ""}${landed && !win ? " lose" : ""}${r.you ? " you" : ""}`}>
              <span class="poll-move">{toSan(fen, r.move)}</span>
              <span class="poll-bar">
                <i style={{ width: `${(100 * r.votes * grow) / top}%` }} />
              </span>
              <span class="poll-votes">{Math.round(r.votes * grow)}</span>
              {r.you && <span class="poll-you">you</span>}
            </div>
          );
        })}
        {yourRow && (
          <div class="poll-row you">
            <span class="poll-move">{toSan(fen, yourRow.move)}</span>
            <span class="poll-bar">
              <i style={{ width: `${(100 * yourRow.votes * grow) / top}%` }} />
            </span>
            <span class="poll-votes">{Math.round(yourRow.votes * grow)}</span>
            <span class="poll-you">you</span>
          </div>
        )}
        <div class="poll-result">
          {me ? (
            <>
              <span class={`round-score ${me.roundScore >= 0 ? "good" : "bad"}`}>{fmt(me.roundScore)}</span>
              <span class="muted small">
                {me.move ? `you picked ${toSan(fen, me.move)}` : "no move from you"} · best was {toSan(fen, mine.bestMove)}
              </span>
            </>
          ) : (
            <span class="muted small">Your team watched this one · best was {toSan(fen, mine.bestMove)}</span>
          )}
        </div>
      </div>
      <MiniTower match={match} />
    </div>
  );
}

const AUGMENTS: { choice: Augment; title: string; step: number }[] = [
  { choice: "more", title: "More time", step: 1 },
  { choice: "same", title: "Same", step: 0 },
  { choice: "less", title: "Less time", step: -1 },
];

/**
 * Crowd's cut: who went out, whether you're through, and (with augments) a
 * vote on the next round's move clock, as three cards.
 */
export function CrowdCut({
  match,
  standings,
  knockedOut,
  youOut,
  until,
  augments,
  moveClock,
}: {
  match: GameView;
  standings: Standing[];
  knockedOut: Standing[];
  youOut: boolean;
  until?: number;
  augments?: boolean;
  moveClock?: number;
}) {
  const now = useFrameNow();
  const left = until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
  const aliveAfter = standings.filter((s) => !s.out).length - knockedOut.length;
  const final = aliveAfter <= 4;
  const s = match.settings;
  const clock = moveClock ?? s.moveClockSeconds;
  const at = (step: number) => Math.max(s.clockRange[0], Math.min(s.clockRange[1], clock + step * s.clockStepSeconds));
  return (
    <div class="screen crowd-cut" onClick={() => !match.serverPaced && !augments && match.continueFromBreak()}>
      <div class="cut-head">
        <span class="cut-badge">CUT</span>
        <span>
          {knockedOut.length} out · {aliveAfter} left{final ? " · the final is next" : ""}
        </span>
      </div>
      <p class={youOut ? "out-msg" : "safe-msg"}>
        {youOut ? `You're out, in ${match.placement}${ordinal(match.placement ?? 0)} place.` : final ? "You made the final four!" : "You're through."}
      </p>
      <div class="cut-out" aria-label="Knocked out">
        {knockedOut.map((k) => (
          <span key={k.id} class={`cut-name${k.isYou ? " you" : ""}`}>
            {k.isYou ? "You" : k.name}
          </span>
        ))}
      </div>
      {augments && !youOut && (
        <>
          <h2 class="cut-vote-title">
            Next round's clock{" "}
            <span class="muted small">{match.serverPaced ? "· the majority decides" : "· your call"}</span>
          </h2>
          <div class="augments" role="radiogroup" aria-label="Augment: next round's move clock">
            {AUGMENTS.map((a) => (
              <button
                type="button"
                role="radio"
                aria-checked={match.augmentVote === a.choice}
                key={a.choice}
                class={`augment augment-${a.choice}${match.augmentVote === a.choice ? " on" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  match.voteAugment(a.choice);
                }}
              >
                <span class="augment-icon" aria-hidden="true">
                  {a.step > 0 ? "⏳" : a.step < 0 ? "⚡" : "＝"}
                </span>
                <strong>{a.title}</strong>
                <span class="augment-secs">{at(a.step)} s</span>
              </button>
            ))}
          </div>
        </>
      )}
      {left !== null && <p class="muted small cut-timer">Next round in {left}…</p>}
    </div>
  );
}
