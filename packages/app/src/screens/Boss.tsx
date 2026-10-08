import { useEffect, useMemo, useState } from "preact/hooks";
import { bossIntroTimeline, fenAfter, inCheck, lastMoveTookQueen } from "@chessroyale/chess";
import { kingSay, resetKingSpeech, type KingCue } from "../godKing.ts";
import { FightBanner } from "../components/FightBanner.tsx";
import { GodKingPortrait } from "../components/GodKing.tsx";
import { Board } from "../components/Board.tsx";
import { useFrameNow } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { UnderBoard } from "../components/QuickChat.tsx";
import { SquareRing } from "../components/ShadeMoves.tsx";
import type { BossView, GameView } from "../game.ts";
import { seenKey } from "../hooks.ts";
import { Hud } from "./Hud.tsx";
import { BossDock, Dots } from "../components/BossDock.tsx";
import { BossCharacter, BossFace, BossSide, hasCharacter } from "../components/BossCharacter.tsx";
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
export function BossBar({ boss, match }: { boss: BossView; match?: GameView }) {
  // A boss with a character stands at the bar's left on a phone (on a computer, by the board: see BossSide), with
  // its portrait in the bar instead.
  const char = !!match && hasCharacter(match);
  return (
    <div class={`boss-bar${char ? " has-char" : ""}`} role="status">
      {char && <BossCharacter match={match!} place="bar" />}
      <span class={`boss-icon${char ? " boss-icon-face" : ""}`} aria-hidden="true">
        <BossFace boss={boss} />
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
  // A new boss battle: the God King starts afresh (he'll introduce himself on your first move).
  useState(() => intro && resetKingSpeech());
  // The God King's word on the boss's move.
  const kingCues = useMemo(() => {
    const m = boss.lastMove;
    if (intro || thinking || victim || !m) return [];
    const key = `boss-${boss.board.fen}`;
    const out: { cue: KingCue; key: string }[] = [];
    if (inCheck(boss.board.fen)) out.push({ cue: "inCheck", key });
    if (m.staggered) out.push({ cue: "staggered", key });
    if (m.captured && m.captured !== "q") out.push({ cue: "bossCapture", key });
    return out;
  }, [boss.board.fen, thinking, intro, victim]);
  // A boss blunder: the engine's numbers before and after its move (the eval bar's, already worked out or cheap).
  useEffect(() => {
    if (intro || thinking || victim || !boss.lastMove || history.length !== boss.board.ply) return;
    let live = true;
    const before = fenAfter(history.slice(0, -1));
    void Promise.all([match.evaluate(before), match.evaluate(boss.board.fen)]).then(([w0, w1]) => {
      if (!live || w0 === null || w1 === null) return;
      const swing = boss.crowdSide === "w" ? w1 - w0 : w0 - w1;
      if (swing >= 0.15) kingSay("bossBlunder", `blunder-${boss.board.fen}`);
    });
    return () => {
      live = false;
    };
  }, [boss.board.fen, thinking]);
  // The boss takes your queen: its banner, face and roar.
  const tookQueen = !intro && !thinking && !victim && boss.lastMove?.captured === "q";
  // You take the boss's queen: your banner (the God King's face), while the boss "thinks" (it waits for it).
  const slewQueen = !intro && !!thinking && !victim && lastMoveTookQueen(history);
  const left = until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
  // A boss raid alone plays like any chess site: the boss's move lands and it's your turn (no ring, no countdown).
  const alone = match.standings().length === 1;
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
          <BossSide match={match} />
          <EvalBar fen={boss.board.fen} orientation={boss.crowdSide} evaluate={(f) => match.evaluate(f)} />
          <Board fen={introFen} orientation={boss.crowdSide === "w" ? "white" : "black"} lastMove={introLast}>
            {!thinking && !victim && !alone && boss.lastMove && <SquareRing square={boss.lastMove.move.slice(2, 4)} orientation={boss.crowdSide === "w" ? "white" : "black"} />}
            {intro && t >= tl.bannerAt && <FightBanner text="START!" sound="bannerStart" />}
            {slewQueen && (
              <FightBanner key={`slew-${history.length}`} tone="hero" face={<GodKingPortrait side={boss.crowdSide} />} text="QUEEN SLAIN!" sub={`You take ${boss.name}'s queen`} sound="bannerStart" />
            )}
            {tookQueen && <FightBanner tone="boss" face={<BossFace boss={boss} />} text="QUEEN DOWN!" sub={`${boss.name} takes your queen`} sound="bossRoar" />}
            {showCard && (
              <div class={`boss-intro${t > tl.replayAt - 350 ? " leaving" : ""}`} role="alert">
                <span class="boss-intro-icon" aria-hidden="true">
                  <BossFace boss={boss} />
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
        side={boss.crowdSide}
        cues={kingCues}
        status={
          <>
            <span class="dock-line">
              {intro ? (
                <strong>{boss.raid ? "All of you vs the boss." : "Ten of you vs the boss."}</strong>
              ) : victim ? (
                <strong class="bad">
                  💀 Struck down: {name(victim)}
                </strong>
              ) : thinking ? (
                <>
                  <Dots /> <strong>The boss</strong> is thinking…
                </>
              ) : boss.lastMove ? (
                <>
                  {boss.icon} Boss plays <strong>{boss.lastMove.san}</strong>
                </>
              ) : null}
            </span>
            <span class="dock-line muted">
              {intro
                ? `Worst mover struck every ${match.settings.bossKillEvery} moves.`
                : victim
                  ? youStruck
                    ? `You played worst. You finish ${match.placement}${ordinal(match.placement ?? 0)}.`
                    : "Worst moves since its last strike."
                  : boss.lastMove?.staggered && !thinking
                    ? "Staggered: a weaker move."
                    : left !== null && left > 0 && !alone
                      ? `Your move in ${left}`
                      : boss.kills.length
                        ? `Struck down: ${boss.kills.map((k) => name(k.id)).join(", ")}`
                        : ""}
            </span>
          </>
        }
      />
      <UnderBoard match={match} />
    </div>
  );
}

