import { useEffect, useState } from "preact/hooks";
import { BATTLE_TOWER, floorBossCount } from "@chessroyale/core";
import { RESULT_ATTACK_MS } from "../components/ResultDuo.tsx";
import { askFloor, enterTowerFloor, floorOutcome, floorRating, type TowerEnd } from "../tower.ts";
import type { GameView } from "../game.ts";

/** The result's buttons stay greyed while its pictures play (ResultDuo: a beat, then the boss's attack or bow). */
const HOLD_MS = 250 + RESULT_ATTACK_MS;

/**
 * A tower floor's result (PR 10), in place of Boss alone's buttons: its result sent to the server (once), then, won, "Continue" (the
 * next floor, at once) and "Stop here (saved)" (back to the tower's screen: the run waits there), always shown, greyed while the
 * result's pictures play or the server hasn't answered; lost, drawn or left (counted): the run's end, the floor it reached and your
 * best, and back to the tower.
 */
export function TowerResult({ match, onBack }: { match: GameView; onBack: () => void }) {
  const play = match.tower!;
  const [end, setEnd] = useState<TowerEnd | null>(null);
  const [held, setHeld] = useState(true);
  const [going, setGoing] = useState(false);
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
  const busy = !end || held || going;
  const next = async () => {
    setGoing(true);
    const a = await askFloor(Math.max(end?.best ?? 0, play.best));
    if (a.kind === "entry") return enterTowerFloor(a.entry);
    // (Anything to ask first, or no answer: the tower's screen asks it.)
    onBack();
  };
  if (won && end?.status !== "top") {
    const n = floor + 1;
    return (
      <div class="tw-result" data-tower-result="won">
        <p class="tw-result-line">Floor {floor} cleared!</p>
        <p class="tw-result-sub">{end?.error ?? `Next: floor ${n} · ${floorBossCount(n)} ${floorBossCount(n) === 1 ? "boss" : "bosses"} · rating ${floorRating(n)}`}</p>
        <div class="actions">
          <button type="button" class="btn btn-secondary" style={{ whiteSpace: "nowrap" }} disabled={busy} onClick={onBack}>
            Stop here (saved)
          </button>
          <button type="button" class="btn btn-primary" style={{ whiteSpace: "nowrap" }} disabled={busy || !!end?.error} onClick={() => void next()}>
            Continue
          </button>
        </div>
      </div>
    );
  }
  const top = end?.status === "top";
  return (
    <div class="tw-result" data-tower-result={top ? "top" : "out"}>
      <p class="tw-result-line">{top ? `Floor ${BATTLE_TOWER.floors} cleared: the top of the tower!` : `Your run ended on floor ${floor}.`}</p>
      <p class="tw-result-sub">{end ? (end.error ?? `Best solo: ${end.best ? `floor ${end.best}` : "none yet"}`) : "Saving your run…"}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" style={{ whiteSpace: "nowrap" }} disabled={busy} onClick={onBack}>
          Back to the tower
        </button>
      </div>
    </div>
  );
}
