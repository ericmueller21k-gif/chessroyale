import { useEffect, useState } from "preact/hooks";
import { Board } from "../components/Board.tsx";
import { useFrameNow } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { MiniTower } from "../components/MiniTower.tsx";
import { SquareRing } from "../components/ShadeMoves.tsx";
import type { BossView, GameView } from "../game.ts";
import { seenKey } from "../hooks.ts";
import { Hud } from "./Hud.tsx";
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
  const victim = boss.justKilled ?? null;
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
          <strong>BOSS BATTLE</strong> · the crowd plays {boss.crowdSide === "w" ? "White" : "Black"}
        </div>
        <div class="board-row">
          <EvalBar fen={boss.board.fen} orientation={boss.crowdSide} evaluate={(f) => match.evaluate(f)} />
          <Board fen={boss.board.fen} orientation={boss.crowdSide === "w" ? "white" : "black"} lastMove={boss.board.lastMove}>
            {!thinking && !victim && boss.lastMove && <SquareRing square={boss.lastMove.move.slice(2, 4)} orientation={boss.crowdSide === "w" ? "white" : "black"} />}
            {intro && (
              <div class="boss-intro" role="alert">
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
      <div class="boss-panel">
        <div class="boss-status" role="status">
          {intro ? (
            <span>
              {boss.raid ? "All of you against the boss." : "Ten of you against the boss."} The most popular pick is played. Every {match.settings.bossKillEvery} moves it strikes down
              whoever played worst since its last strike.
            </span>
          ) : victim ? (
            youStruck ? (
              <span class="out-msg">
                Your recent moves were the crowd's worst. You finish {match.placement}
                {ordinal(match.placement ?? 0)}.
              </span>
            ) : (
              <span>
                <strong>{name(victim)}</strong> made the crowd's worst moves since the last strike.
              </span>
            )
          ) : thinking ? (
            <>
              <span class="waiting-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>{" "}
              <strong>{boss.name}</strong> is thinking…
            </>
          ) : boss.lastMove ? (
            <span>
              {boss.icon} <strong>{boss.name}</strong> {boss.lastMove.staggered ? "staggered from the King's strike and played" : "played"}{" "}
              <strong>{boss.lastMove.san}</strong>
            </span>
          ) : null}
          {left !== null && left > 0 && <span class="muted small"> · your move in {left}</span>}
        </div>
        <div class="boss-king">
          <span class="boss-king-crowns" aria-hidden="true">{"👑".repeat(Math.max(0, boss.kingCharges)) || "—"}</span>
          <span class="muted small">
            {boss.kingCharges > 0
              ? `The God King: ${boss.kingCharges} ${boss.kingCharges === 1 ? "charge" : "charges"}${boss.raid ? "" : " (your leftover power-ups)"}. Summon him to play a move at full strength instead of picking one, or to strike the boss right away so its next move is weaker (the clock stops while he strikes; then you pick as usual). More than half the crowd has to call.`
              : "The God King has spent his charges."}
          </span>
        </div>
        {boss.kills.length > 0 && (
          <div class="boss-fallen" aria-label="Struck down">
            <span class="muted small">Struck down:</span>
            {boss.kills.map((k) => (
              <span key={k.id} class={`boss-fallen-name${match.isYou(k.id) ? " you" : ""}`}>
                {name(k.id)}
              </span>
            ))}
          </div>
        )}
      </div>
      <MiniTower match={match} />
    </div>
  );
}
