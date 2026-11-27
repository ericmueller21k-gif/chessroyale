import { useEffect, useState } from "preact/hooks";
import { BATTLE_TOWER, floorBossCount } from "@chessroyale/core";
import { floorOutcome, floorRating, livesLeftWords, livesOf, lostWords, type FloorOutcome, type TowerEnd } from "../tower.ts";
import type { GameView } from "../game.ts";
import { unlockedNow, unlocksNow, unlocksToTell, wonUnlockFloor } from "../unlocks.ts";

/** The next floor's line: "Next: floor 9 · 2 bosses · rating 1270". */
const nextLine = (n: number) => `Next: floor ${n} · ${floorBossCount(n)} ${floorBossCount(n) === 1 ? "boss" : "bosses"} · rating ${floorRating(n)}`;

/** A floor not won, short, for the end screen's headline line (Eric, Nov 20): "Floor 4 lost · 1 life left". */
const shortNotWon = (outcome: FloorOutcome | "left", floor: number, lives: number) =>
  `Floor ${floor} ${outcome === "drawn" ? "drawn" : outcome === "left" ? "left" : "lost"} · ${livesLeftWords(lives)}`;

/** A tower floor's end, as its end screen shows it: the headline's line and tone, the line under it, the result's state. */
export interface TowerEndView {
  /** The headline's line: "Floor 3 cleared!", "Floor 4 lost · 1 life left" (never the tower's floor count). */
  line: string;
  tone: "win" | "loss" | "draw";
  /** Under it, by the button: "Next: floor 4 · 3 bosses · rating 660", the recap, or "Saving your run…". */
  sub: string;
  /** The result's state, for its box's `data-tower-result`. */
  state: string;
  party: boolean;
  /** The button waits for the server's word (a solo floor's). */
  waiting: boolean;
}

/**
 * A tower floor's result (PR 10; PR 11b, Eric, Nov 19: "After the round ends, it's like a victory or defeat screen, like it normally is.
 * And then it takes you back."; the end screen, Nov 20: its line in the headline): the floor and the run, its result sent to the server
 * (once), and one button, "Back to the Battle Tower" (Eric, Nov 22: not "the tower", which could read as leaving it; greyed until the server answers), into the floor room: won, the elevator open to the next
 * floor. Lost, drawn or left (counted) with a life to spend (Eric, Nov 20: "it just takes you on to the next match, and it just
 * counts"): "Floor 8 lost · 1 life left", the elevator open too; with none, the run over, its floors lost listed (the recap). Until the
 * server answers, the run's lives going in say which (the server's word then stands). A leave the server made free: "Floor 8 left · it
 * waits", back to the lobby. Null for a match that isn't a tower floor.
 */
export function useTowerEnd(match: GameView): TowerEndView | null {
  const play = match.tower;
  const [end, setEnd] = useState<TowerEnd | null>(null);
  useEffect(() => {
    if (!play) return;
    let on = true;
    // (A floor whose win could unlock a boss not yet said on this device, the Stranger's: the server's unlocks read first, so his
    // notice comes only when this result is what unlocked him. unlocks.ts.)
    const ph = match.phase;
    const may = ph.kind === "results" && !ph.left && ph.bossResult && floorOutcome(ph.bossResult) === "won" ? unlocksToTell(play.floor, play.bosses) : [];
    void (may.length ? unlocksNow() : Promise.resolve(null)).then((before) =>
      play.settle().then((e) => {
        if (may.length && e.outcome === "won" && !e.error) wonUnlockFloor(play.floor, play.bosses, before);
        if (on) setEnd(e);
      }),
    );
    return () => {
      on = false;
    };
  }, [play]);
  const p = match.phase;
  const left = p.kind === "results" && !!p.left;
  // (A party's floor: its room has written the result; won, the same notice, by what this device last knew of your unlocks.)
  const party = match.towerParty && !play ? match.towerParty : null;
  const partyWon = !!party && p.kind === "results" && !left && !!p.bossResult && floorOutcome(p.bossResult) === "won";
  useEffect(() => {
    if (party && partyWon) wonUnlockFloor(party.floor, party.bosses, unlockedNow());
  }, [party?.floor, partyWon]);
  if (match.towerParty && !play) return partyEnd(match, left);
  if (!play) return null;
  const floor = play.floor;
  // (The run after this floor, and the floor's result: the server's word once it has taken the result (a floor counted lost on another
  // device while this one won it stays lost: the review of #839, finding 2); until then (or if it couldn't be sent), the match's, and
  // as the lives going in say. Resigning after your 2nd move is a loss as the tower counts it.)
  const said = end && !end.error ? end : null;
  const played = p.kind === "results" && p.bossResult && !left ? floorOutcome(p.bossResult) : "lost";
  const outcome = said && said.outcome !== "left" ? said.outcome : played;
  const won = !left && outcome === "won";
  // (A leave the server made free (the floor's bosses rested since it began: the review of #839, finding 6): nothing spent, the same
  // floor waits; Town takes you to the lobby.)
  const free = left && !!said?.free;
  const lives = said ? said.lives : won ? play.lives : Math.max(0, play.lives - 1);
  const on = won || play.lives > 0;
  const status = said ? said.status : on && floor >= BATTLE_TOWER.floors ? "top" : on ? "open" : "out";
  const n = floor + 1;
  const line = free
    ? `Floor ${floor} left · it waits`
    : status === "top"
      ? won
        ? "Top of the tower!"
        : `Floor ${floor} ${outcome === "drawn" ? "drawn" : "lost"} · the top!`
      : status === "open"
        ? won
          ? `Floor ${floor} cleared!`
          : shortNotWon(outcome, floor, lives)
        : `Run over on floor ${floor}`;
  const best = end ? `Best solo: ${end.best ? `floor ${end.best}` : "none yet"}` : "";
  const sub = !end ? "Saving your run…" : (end.error ?? (status === "open" ? nextLine(free ? floor : n) : [lostWords(end.lost), best].filter(Boolean).join(". ")));
  return {
    line,
    tone: won ? "win" : outcome === "drawn" && !left ? "draw" : "loss",
    sub,
    state: free ? "free" : status === "open" ? (won ? "won" : "lost") : status,
    party: false,
    waiting: !end,
  };
}

/**
 * A party floor's end (Nov 20; docs/decisions/2026-11-20-tower-party.md): the floor in its line (the party's win, its loss or draw, or
 * your leave), and one button, "Back to the Battle Tower": into the floor room with your party (its room has written every member's copy:
 * town/Town.tsx reads yours there).
 */
function partyEnd(match: GameView, left: boolean): TowerEndView {
  const p = match.phase;
  const outcome = p.kind === "results" && p.bossResult ? floorOutcome(p.bossResult) : "lost";
  const won = !left && outcome === "won";
  const floor = match.towerParty!.floor;
  // (The party's lives after this floor (Nov 20): the room writes the party's result to every copy, one life spent on each for a loss or
  // a draw. Your own leave: free or counted by your moves, your copy's alone (the floor room reads it).)
  const going = livesOf(match.towerParty!.lives);
  const lives = won ? going : going - 1;
  const top = floor >= BATTLE_TOWER.floors && lives >= 0;
  const line = left
    ? `You left floor ${floor}`
    : top && won
      ? "Top of the tower!"
      : won
        ? `Floor ${floor} cleared!`
        : lives >= 0
          ? shortNotWon(outcome, floor, lives)
          : `Climb over on floor ${floor}`;
  const sub = !left && !top && lives >= 0 ? nextLine(floor + 1) : "Every member's climb is saved with the party's result.";
  return {
    line,
    tone: won ? "win" : outcome === "drawn" && !left ? "draw" : "loss",
    sub,
    state: left ? "out" : top ? "top" : won ? "won" : lives >= 0 ? "lost" : "out",
    party: true,
    waiting: false,
  };
}

/** The floor's line under the rewards and its one button (live as soon as the server has the result: Eric, "buttons work at all times"). */
export function TowerResult({ end, onBack }: { end: TowerEndView; onBack: () => void }) {
  return (
    <div class="tw-result" data-tower-result={end.state} data-tower-party={end.party ? "" : undefined}>
      <p class="tw-result-sub">{end.sub}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" style={{ whiteSpace: "nowrap" }} disabled={end.waiting} onClick={onBack}>
          Back to the Battle Tower
        </button>
      </div>
    </div>
  );
}
