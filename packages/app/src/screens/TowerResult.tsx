import { useEffect, useState } from "preact/hooks";
import { BATTLE_TOWER, floorBossCount } from "@chessroyale/core";
import { RESULT_ATTACK_MS } from "../components/ResultDuo.tsx";
import { floorOutcome, floorRating, livesOf, lostWords, notWon, spentLine, type TowerEnd } from "../tower.ts";
import type { GameView } from "../game.ts";

/** The result's button stays greyed while its pictures play (ResultDuo: a beat, then the boss's attack or bow). */
const HOLD_MS = 250 + RESULT_ATTACK_MS;

/** The next floor's line: "Next: floor 9 · 2 bosses · rating 1270". */
const nextLine = (n: number) => `Next: floor ${n} · ${floorBossCount(n)} ${floorBossCount(n) === 1 ? "boss" : "bosses"} · rating ${floorRating(n)}`;

/**
 * A tower floor's result (PR 10; PR 11b, Eric, Nov 19: "After the round ends, it's like a victory or defeat screen, like it normally is.
 * And then it takes you back."): the game's own result screen, the floor and the run in its line, its result sent to the server (once),
 * and one button, "Back to the tower" (greyed while the result's pictures play and the server answers), into the floor room: won, the
 * elevator open to the next floor. Lost, drawn or left (counted) with a life to spend (Eric, Nov 20: "it just takes you on to the next
 * match, and it just counts"): "You lost floor 8. It still counts: 1 life left.", the elevator open too; with none, the run over, its
 * floors lost listed (the recap). Until the server answers, the run's lives going in say which (the server's word then stands).
 */
export function TowerResult({ match, onBack }: { match: GameView; onBack: () => void }) {
  const play = match.tower!;
  const [end, setEnd] = useState<TowerEnd | null>(null);
  const [held, setHeld] = useState(true);
  useEffect(() => {
    let on = true;
    void play.settle().then((e) => on && setEnd(e));
    const t = setTimeout(() => setHeld(false), HOLD_MS);
    return () => {
      on = false;
      clearTimeout(t);
    };
  }, [play]);
  const p = match.phase;
  const left = p.kind === "results" && !!p.left;
  const won = !left && p.kind === "results" && !!p.bossResult && floorOutcome(p.bossResult) === "won";
  const floor = play.floor;
  // (Resigning after your 2nd move is a loss as the tower counts it: "You lost floor 8.")
  const outcome = p.kind === "results" && p.bossResult && !left ? floorOutcome(p.bossResult) : "lost";
  // (The run after this floor: the server's word once it has taken the result; until then (or if it couldn't be sent), as the lives
  // going in say.)
  const said = end && !end.error ? end : null;
  const lives = said ? said.lives : won ? play.lives : Math.max(0, play.lives - 1);
  const on = won || play.lives > 0;
  const status = said ? said.status : on && floor >= BATTLE_TOWER.floors ? "top" : on ? "open" : "out";
  const n = floor + 1;
  const line =
    status === "top"
      ? won
        ? `Floor ${BATTLE_TOWER.floors} cleared: the top of the tower!`
        : `${notWon(outcome, floor)} It still counts: the top of the tower!`
      : status === "open"
        ? won
          ? `Floor ${floor} cleared!`
          : spentLine(outcome, floor, lives)
        : `Your run ended on floor ${floor}.`;
  const best = end ? `Best solo: ${end.best ? `floor ${end.best}` : "none yet"}` : "";
  const sub = !end ? "Saving your run…" : (end.error ?? (status === "open" ? nextLine(n) : [lostWords(end.lost), best].filter(Boolean).join(". ")));
  return (
    <div class="tw-result" data-tower-result={status === "open" ? (won ? "won" : "lost") : status}>
      <p class="tw-result-line">{line}</p>
      <p class="tw-result-sub">{sub}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" style={{ whiteSpace: "nowrap" }} disabled={!end || held} onClick={onBack}>
          Back to the tower
        </button>
      </div>
    </div>
  );
}

/**
 * A party floor's result (Nov 20; docs/decisions/2026-11-20-tower-party.md): the game's own result screen, the floor in its line (the
 * party's win, its loss or draw, or your leave), and one button, "Back to the tower": into the floor room with your party (its room
 * has written every member's copy: town/Town.tsx reads yours there).
 */
export function TowerPartyResult({ match, onBack }: { match: GameView; onBack: () => void }) {
  const [held, setHeld] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHeld(false), HOLD_MS);
    return () => clearTimeout(t);
  }, []);
  const p = match.phase;
  const left = p.kind === "results" && !!p.left;
  const outcome = p.kind === "results" && p.bossResult ? floorOutcome(p.bossResult) : "lost";
  const won = !left && outcome === "won";
  const floor = match.towerParty!.floor;
  // (The party's lives after this floor (Nov 20): the room writes the party's result to every copy, one life spent on each for a loss or
  // a draw. Your own leave: free or counted by your moves, your copy's alone (the floor room reads it).)
  const going = livesOf(match.towerParty!.lives);
  const lives = won ? going : going - 1;
  const top = floor >= BATTLE_TOWER.floors && lives >= 0;
  const n = floor + 1;
  const line = left
    ? `You left floor ${floor}.`
    : top && won
      ? `Floor ${BATTLE_TOWER.floors} cleared: the top of the tower!`
      : won
        ? `Floor ${floor} cleared!`
        : lives >= 0
          ? spentLine(outcome, floor, lives, "Your party")
          : `Your party's climb ended on floor ${floor}.`;
  const sub = !left && !top && lives >= 0 ? nextLine(n) : "Every member's climb is saved with the party's result.";
  return (
    <div class="tw-result" data-tower-result={left ? "out" : top ? "top" : won ? "won" : lives >= 0 ? "lost" : "out"} data-tower-party="">
      <p class="tw-result-line">{line}</p>
      <p class="tw-result-sub">{sub}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" style={{ whiteSpace: "nowrap" }} disabled={held} onClick={onBack}>
          Back to the tower
        </button>
      </div>
    </div>
  );
}
