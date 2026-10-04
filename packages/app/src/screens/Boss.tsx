import { useEffect, useMemo, useState } from "preact/hooks";
import { bossIntroTimeline, fenAfter } from "@chessroyale/chess";
import { FightBanner } from "../components/FightBanner.tsx";
import { Board } from "../components/Board.tsx";
import { useFrameNow } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { MiniTower } from "../components/MiniTower.tsx";
import { SquareRing } from "../components/ShadeMoves.tsx";
import type { BossView, GameView } from "../game.ts";
import { seenKey } from "../hooks.ts";
import { Hud } from "./Hud.tsx";
import { BossDock, Dots } from "../components/BossDock.tsx";
import { BossHeading } from "./Play.tsx";
import { ordinal } from "./StageBreak.tsx";

/** For the raid's opening roulette: famous lines flicking past before the real one lands. */
const ROULETTE = [
  "Queen's Gambit Declined",
  "Sicilian Defense",
  "Ruy Lopez",
  "Italian Game",
  "French Defense",
  "Caro-Kann Defense",
  "King's Indian Defense",
  "London System",
  "Scandinavian Defense",
  "English Opening",
  "Slav Defense",
  "Nimzo-Indian Defense",
];

function OpeningRoulette({ name }: { name: string }) {
  const [start] = useState(Date.now());
  const now = useFrameNow();
  const t = now - start;
  const spinning = t < 1800;
  // Slows down as it goes, like a wheel.
  const i = Math.floor(Math.sqrt(t) / 3);
  return <span class={`opening-roulette${spinning ? " spinning" : " landed"}`}>{spinning ? ROULETTE[i % ROULETTE.length] : name}</span>;
}

/** The boss at a glance: who it is, how scary, when it strikes next. Shown above the board all through the battle. */
export function BossBar({ boss }: { boss: BossView }) {
  return (
    <div class="boss-bar" role="status">
      <span class="boss-icon" aria-hidden="true">
        {boss.icon}
      </span>
      <span class="boss-name">
        <strong>{boss.name}</strong>
        <span class="boss-threat" aria-label={`Threat ${boss.threat} of 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} class={i < boss.threat ? "on" : ""}>
              💀
            </i>
          ))}
        </span>
      </span>
      <span class="boss-next">
        {boss.result
          ? boss.result === "crowd"
            ? "Defeated!"
            : boss.result === "boss"
              ? "The boss won"
              : "A draw"
          : boss.strikeIn !== null
            ? boss.strikeIn <= 1
              ? "Strikes after this move"
              : `Strikes in ${boss.strikeIn} moves`
            : `Move ${Math.min(boss.crowdMoves + 1, boss.maxMoves)} of ${boss.maxMoves}`}
      </span>
    </div>
  );
}

/**
 * Boss battle, between the crowd's moves: the boss thinking, then its move; or
 * the boss striking down the crowd's worst recent mover, with a flash and the
 * victim's name crossed out.
 */
export function BossScreen({ match, boss, until, thinking, intro }: { match: GameView; boss: BossView; until: number; thinking?: boolean; intro?: boolean }) {
  const now = useFrameNow();
  const [mountedAt] = useState(Date.now());
  const victim = boss.justKilled ?? null;
  // The intro: the boss's card over the starting position, the game so far replayed quickly from the start,
  // then "START!".
  const history = boss.board.history;
  const tl = useMemo(() => bossIntroTimeline(history.length), [history.length]);
  const t = now - mountedAt;
  const plies = intro ? Math.max(0, Math.min(history.length, Math.floor((t - tl.replayAt) / Math.max(1, tl.step)))) : history.length;
  const introFen = useMemo(() => (intro ? fenAfter(history.slice(0, plies)) : boss.board.fen), [intro, plies, boss.board.fen]);
  const introLast = intro ? (plies > 0 ? history[plies - 1]! : null) : boss.board.lastMove;
  const showCard = intro && t < tl.replayAt;
  // The boss takes your queen: its banner, face and roar.
  const tookQueen = !intro && !thinking && !victim && boss.lastMove?.captured === "q";
  const left = until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
  const youStruck = victim !== null && match.isYou(victim);
  useEffect(() => {
    match.seen.set(seenKey(boss.board), boss.board.ply);
  }, [boss.board.ply]);
  const name = (id: string) => (match.isYou(id) ? "You" : match.nameOf(id));
  return (
    <div class={`screen game boss-screen${victim ? " striking" : ""}`}>
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">
          <BossHeading side={boss.crowdSide} note={thinking ? "the boss is thinking" : victim ? "the boss strikes" : intro ? undefined : "the boss's move"} />
        </div>
        <div class="board-row">
          <EvalBar fen={boss.board.fen} orientation={boss.crowdSide} evaluate={(f) => match.evaluate(f)} />
          <Board fen={introFen} orientation={boss.crowdSide === "w" ? "white" : "black"} lastMove={introLast}>
            {!thinking && !victim && boss.lastMove && <SquareRing square={boss.lastMove.move.slice(2, 4)} orientation={boss.crowdSide === "w" ? "white" : "black"} />}
            {intro && t >= tl.bannerAt && <FightBanner text="START!" sound="bannerStart" />}
            {tookQueen && <FightBanner tone="boss" face={boss.icon} text="QUEEN DOWN!" sub={`${boss.name} takes your queen`} sound="bossRoar" />}
            {showCard && (
              <div class={`boss-intro${t > tl.replayAt - 350 ? " leaving" : ""}`} role="alert">
                <span class="boss-intro-icon" aria-hidden="true">
                  {boss.icon}
                </span>
                <span class="boss-strike-text">A boss appears</span>
                <strong class="boss-intro-name">{boss.name}</strong>
                {boss.raid && boss.openingName && <OpeningRoulette name={boss.openingName} />}
                <span class="boss-intro-note">
                  {boss.raid
                    ? `It challenges you from this opening, ${boss.startMove - 1} moves in. You play ${boss.crowdSide === "w" ? "White" : "Black"}.`
                    : boss.startMove > 1
                    ? `It takes over your game from move ${boss.startMove}, where it was roughly even. The crowd plays White.`
                    : "A fresh game. The crowd plays White."}
                </span>
              </div>
            )}
            {victim && (
              <div class="boss-strike" role="alert">
                <span class="boss-strike-skull" aria-hidden="true">
                  💀
                </span>
                <span class="boss-strike-text">
                  {boss.icon} {boss.name} struck down
                </span>
                <strong class="boss-strike-name">{name(victim)}</strong>
              </div>
            )}
          </Board>
        </div>
      </div>
      <BossDock
        match={match}
        idle
        status={
          <>
            <span class="dock-line">
              {intro ? (
                <strong>{boss.raid ? "All of you against the boss." : "Ten of you against the boss."}</strong>
              ) : victim ? (
                <strong class="bad">
                  💀 {boss.name} struck down {name(victim)}
                </strong>
              ) : thinking ? (
                <>
                  <Dots /> <strong>{boss.name}</strong> is thinking…
                </>
              ) : boss.lastMove ? (
                <>
                  {boss.icon} <strong>{boss.name}</strong> played <strong>{boss.lastMove.san}</strong>
                </>
              ) : null}
            </span>
            <span class="dock-line muted">
              {intro
                ? `The most popular pick is played. Every ${match.settings.bossKillEvery} moves it strikes down whoever played worst.`
                : victim
                  ? youStruck
                    ? `Your recent moves were the crowd's worst. You finish ${match.placement}${ordinal(match.placement ?? 0)}.`
                    : "The crowd's worst moves since its last strike."
                  : boss.lastMove?.staggered && !thinking
                    ? "Staggered by the God King's strike: a weaker move."
                    : left !== null && left > 0
                      ? `Your move in ${left}`
                      : boss.kills.length
                        ? `Struck down: ${boss.kills.map((k) => name(k.id)).join(", ")}`
                        : ""}
            </span>
          </>
        }
      />
      <MiniTower match={match} />
    </div>
  );
}
