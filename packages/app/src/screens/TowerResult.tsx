import { useEffect, useState } from "preact/hooks";
import { BATTLE_TOWER, floorBossCount } from "@chessroyale/core";
import { RESULT_ATTACK_MS } from "../components/ResultDuo.tsx";
import { floorOutcome, floorRating, type TowerEnd } from "../tower.ts";
import type { GameView } from "../game.ts";

/** The result's button stays greyed while its pictures play (ResultDuo: a beat, then the boss's attack or bow). */
const HOLD_MS = 250 + RESULT_ATTACK_MS;

/**
 * A tower floor's result (PR 10; PR 11b, Eric, Nov 19: "After the round ends, it's like a victory or defeat screen, like it normally is.
 * And then it takes you back."): the game's own result screen, the floor and the run in its line, its result sent to the server (once),
 * and one button, "Back to the tower" (greyed while the result's pictures play and the server answers), into the floor room: won, the
 * elevator open to the next floor; lost, drawn or left (counted), the run over.
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
  const top = end?.status === "top";
  const n = floor + 1;
  const line = won && !top ? `Floor ${floor} cleared!` : top ? `Floor ${BATTLE_TOWER.floors} cleared: the top of the tower!` : `Your run ended on floor ${floor}.`;
  const sub = !end
    ? "Saving your run…"
    : (end.error ??
      (won && !top ? `Next: floor ${n} · ${floorBossCount(n)} ${floorBossCount(n) === 1 ? "boss" : "bosses"} · rating ${floorRating(n)}` : `Best solo: ${end.best ? `floor ${end.best}` : "none yet"}`));
  return (
    <div class="tw-result" data-tower-result={won && !top ? "won" : top ? "top" : "out"}>
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
