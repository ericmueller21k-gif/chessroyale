import { useEffect, useMemo, useState } from "preact/hooks";
import { applyMove, sideToMove, toSan } from "@chessroyale/chess";
import type { Augment } from "@chessroyale/core";
import { Board } from "../components/Board.tsx";
import { TimerBar, useFrameNow } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { MiniTower } from "../components/MiniTower.tsx";
import { SquareRing } from "../components/ShadeMoves.tsx";
import { CrowdGhosts, type GhostPick } from "../components/CrowdGhosts.tsx";
import { KingSummon, kingSquare } from "../components/GodKing.tsx";
import { crowdAnimations, onPrefsChange } from "../prefs.ts";
import { finalName, myTeam, type BoardView, type GameView, type GroupReveal, type Standing } from "../game.ts";
import { seenKey } from "../hooks.ts";
import { play } from "../sound.ts";
import { Hud } from "./Hud.tsx";
import { ordinal } from "./StageBreak.tsx";

const sideName = (s: "w" | "b") => (s === "w" ? "White" : "Black");

/** The device's Crowd animation setting, kept in sync if it changes. */
export function useCrowdAnimations(): boolean {
  const [on, setOn] = useState(crowdAnimations());
  useEffect(() => onPrefsChange(() => setOn(crowdAnimations())), []);
  return on;
}

/** Picks as ghost pieces with names, ranked by the leaderboard. */
export function ghostPicks(match: GameView, picks: readonly { playerId: string; move: string | null }[]): GhostPick[] {
  const rank = new Map(match.standings().map((s, i) => [s.id, i]));
  return picks.flatMap((p) =>
    p.move ? [{ id: p.playerId, name: match.nameOf(p.playerId), move: p.move, you: match.isYou(p.playerId), rank: rank.get(p.playerId) ?? 999 }] : [],
  );
}

/** The live picks visible right now (each from its moment), as ghosts. */
/** Picks already on screen this turn (by position), so the reveal doesn't animate them a second time. */
const seenLive = { fen: "", ids: new Set<string>() };

export function LiveGhosts({ match, fen, orientation }: { match: GameView; fen: string; orientation: "white" | "black" }) {
  const animate = useCrowdAnimations();
  const now = useFrameNow();
  // Picks made before you could see them catch up in a quick wave from this moment; later ones arrive live.
  const [since] = useState(Date.now());
  const live = match.livePicks();
  if (!live) return null;
  const sorted = [...live].sort((a, b) => a.at - b.at);
  let k = 0;
  const visible = sorted.filter((p) => (p.at <= since ? since + 35 * k++ : p.at) <= now);
  if (seenLive.fen !== fen) {
    seenLive.fen = fen;
    seenLive.ids = new Set();
  }
  for (const p of visible) seenLive.ids.add(p.playerId);
  return <CrowdGhosts fen={fen} picks={ghostPicks(match, visible)} orientation={orientation} animate={animate} faint />;
}
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
            <LiveGhosts match={match} fen={board.fen} orientation={team === "w" ? "white" : "black"} />
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
 * Crowd's reveal. Animations on: every pick comes in as its own ghost piece in
 * quick succession (silently), each move tagged with its top three names and
 * "+N". Animations off: the tags and one still ghost per move at once. Either
 * way the vote bars count up, the winner blinks three times with three tones,
 * and then only the chosen piece moves.
 */
export function CrowdReveal({ match, mine, board, until }: { match: GameView; mine: GroupReveal; board: BoardView; until: number }) {
  const [start] = useState(Date.now());
  const now = useFrameNow();
  const animate = useCrowdAnimations();
  const total = Math.max(2500, until - start);
  const picks = mine.result.players;
  // Every pick, in a mixed order (not grouped by move), for the rapid succession of ghosts.
  const ghosts = useMemo(() => {
    const h = (s: string) => [...s].reduce((a, c) => (Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);
    return ghostPicks(match, picks).sort((a, b) => h(a.id) - h(b.id));
  }, [mine]);
  // Picks you already watched come in live stay where they are; only the rest animate in, one every `step` ms.
  const seen = useMemo(() => {
    const ids = seenLive.fen === mine.fenBefore ? seenLive.ids : new Set<string>();
    return ghosts.filter((g) => ids.has(g.id)).length;
  }, [mine]);
  const ordered = useMemo(() => {
    const ids = seenLive.fen === mine.fenBefore ? seenLive.ids : new Set<string>();
    return [...ghosts.filter((g) => ids.has(g.id)), ...ghosts.filter((g) => !ids.has(g.id))];
  }, [ghosts]);
  const unseen = Math.max(0, ghosts.length - seen);
  const step = Math.max(20, Math.min(60, (total - 2200) / Math.max(1, unseen)));
  const t = now - start;
  const shown = animate ? Math.min(ghosts.length, seen + Math.floor(t / step) + (unseen ? 1 : 0)) : ghosts.length;
  const countEnd = animate ? (unseen ? unseen * step + 350 : 150) : seen === ghosts.length ? 150 : 600;
  const grow = ghosts.length ? (animate ? shown / ghosts.length : Math.min(1, t / countEnd)) : 1;
  const landAt = countEnd + 250;
  // The God King playing the move: his summoning and his bolt come first (about 2.1 s), then the piece moves.
  const playAt = landAt + (mine.king ? 2100 : 750);
  const landed = t >= landAt;
  const played = t >= playAt;
  useEffect(() => {
    match.seen.set(seenKey(board), board.ply + 1);
  }, [board]);

  const fen = mine.fenBefore;
  // The God King: summoned on your king's square, then he plays the move, and leaves as the round ends.
  const godKing = useMemo(() => {
    if (!mine.king) return null;
    const crowd = sideToMove(fen);
    const after = applyMove(fen, mine.result.playedMove);
    const before = kingSquare(fen, crowd);
    const later = kingSquare(after, crowd);
    if (!before || !later) return null;
    const orient = (myTeam(match) ?? crowd) === "w" ? ("white" as const) : ("black" as const);
    const exitAt = Math.max(start + playAt + 2900, until - 900);
    const from = mine.result.playedMove.slice(0, 2);
    return { side: crowd, orientation: orient, kingBefore: before, kingAfter: later, target: from === before ? null : from, mode: "move" as const, startAt: start + landAt, moveAt: start + playAt, exitAt };
  }, [mine, landAt, playAt]);
  const team = myTeam(match);
  const orientation = (team ?? sideToMove(fen)) === "w" ? "white" : "black";
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

  // The ghosts come in silently; the winner gets three tones as it blinks.
  useEffect(() => {
    if (landed) play("select");
  }, [landed]);

  return (
    <div class="screen game crowd" onClick={() => played && match.skipReveal()}>
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">
          <strong>{sideName(sideToMove(fen))}</strong> · {voters} {voters === 1 ? "vote" : "votes"}
        </div>
        {/* Same row as the play screen (eval bar + board), so the board never moves or resizes between phases. */}
        <div class="board-row">
        <EvalBar fen={played ? applyMove(fen, mine.result.playedMove) : fen} orientation={orientation === "white" ? "w" : "b"} evaluate={(f) => match.evaluate(f)} />
        <Board fen={played ? applyMove(fen, mine.result.playedMove) : fen} orientation={orientation} lastMove={played ? mine.result.playedMove : board.lastMove}>
          {!played && (
            <CrowdGhosts
              fen={fen}
              picks={ordered.slice(0, shown)}
              orientation={orientation}
              animate={animate}
              instant={new Set(ordered.slice(0, seen).map((g) => g.id))}
              chosen={landed ? mine.result.playedMove : null}
            />
          )}
          {played && <SquareRing square={mine.result.playedMove.slice(2, 4)} orientation={orientation} />}
          {godKing && t >= godKing.startAt - start && <KingSummon {...godKing} />}
        </Board>
        </div>
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
        {mine.king !== undefined && (mine.kingCalls ?? 0) > 0 && (
          <div class={`poll-row king-row${landed && mine.king ? " win" : ""}`}>
            <span class="poll-move">👑 King</span>
            <span class="poll-bar">
              <i style={{ width: `${Math.min(100, (100 * (mine.kingCalls ?? 0) * grow) / Math.max(1, voters))}%` }} />
            </span>
            <span class="poll-votes">{Math.round((mine.kingCalls ?? 0) * grow)}</span>
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
  stage,
  standings,
  knockedOut,
  youOut,
  until,
  augments,
  moveClock,
}: {
  match: GameView;
  stage: number;
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
  // The last cut: what comes next (team final, boss battle, duel, or the final four).
  const final = stage >= match.settings.knockoutsPerStage.length - 1;
  const next = finalName(match.settings);
  const s = match.settings;
  const clock = moveClock ?? s.moveClockSeconds;
  const at = (step: number) => Math.max(s.clockRange[0], Math.min(s.clockRange[1], clock + step * s.clockStepSeconds));
  return (
    <div class="screen crowd-cut" onClick={() => !match.serverPaced && !augments && match.continueFromBreak()}>
      <div class="cut-head">
        <span class="cut-badge">CUT</span>
        <span>
          {knockedOut.length} out · {aliveAfter} left{final ? ` · the ${next.toLowerCase()} is next` : ""}
        </span>
      </div>
      <p class={youOut ? "out-msg" : "safe-msg"}>
        {youOut
          ? `You're out, in ${match.placement}${ordinal(match.placement ?? 0)} place.`
          : final
            ? next === "Boss battle"
              ? "You face the boss!"
              : next === "Duel"
                ? "You're in the duel!"
                : `You made the ${next.toLowerCase()}!`
            : "You're through."}
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
