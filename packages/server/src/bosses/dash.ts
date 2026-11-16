/**
 * Dash on the lobby server (his rules: packages/chess/src/bosses/dash.ts): his Scramble Rush, timed here as the crowd's turn
 * begins (nobody's clock running). Each person sends their placements as they make them ("rushPlace"); as time's up (and the
 * late grace) the runner judges them with the same code the screens use (rushJudge, bots' from the seed), everyone sees the
 * verdict, then the match goes on: his extra move if the crowd failed it, else the crowd's turn. The game's board never changes.
 */
import { rushKeep, rushTimeline } from "@chessroyale/chess";
import type { BossLobby } from "./base.ts";

/** The Rush begins: the boss's screen with it to everyone, its end timed here. */
function startRush(lobby: BossLobby) {
  const at = lobby.now();
  lobby.r.phase = "boss";
  lobby.r.rush = { key: `r-${++lobby.r.counter}`, at, places: {} };
  lobby.broadcastBoss(0, { rush: { key: lobby.r.rush.key, at } });
  lobby.setTimer("rush", at + rushTimeline().placeUntil + lobby.settings.lateGraceMs);
}

/** Time's up: every placement judged and the verdict to everyone; then, after it shows, on with the match. */
function rushStep(lobby: BossLobby) {
  const r = lobby.r.rush;
  const runner = lobby.runner;
  if (!r || !runner || lobby.r.phase !== "boss") return;
  if (!r.judged) {
    runner.finishRush(r.places);
    r.judged = true;
    lobby.broadcastBoss(0, { rush: { key: r.key, at: r.at } });
    return lobby.setTimer("rush", Math.max(lobby.now(), r.at + rushTimeline().total + lobby.settings.lateGraceMs));
  }
  lobby.r.rush = undefined;
  lobby.nextRound();
}

/**
 * A player's placements so far, while the second countdown is on for them (and the late grace): kept as sent, only each swept
 * piece's square before the sweep to a square name (rushJudge checks each against the board as it judges), and each piece at most
 * movesPerPiece times (rushKeep).
 */
function rushPlace(lobby: BossLobby, playerId: string, key: string, places: unknown) {
  const r = lobby.r.rush;
  const rush = lobby.runner?.boss?.powers?.dash?.rush;
  if (!r || r.key !== key || r.judged || !rush || lobby.r.phase !== "boss" || !places || typeof places !== "object") return;
  if (!lobby.runner!.alive().some((p) => p.id === playerId && !p.isBot)) return;
  const t = lobby.now() - r.at;
  const tl = rushTimeline();
  if (t < tl.placeAt - 300 || t > tl.placeUntil + lobby.settings.lateGraceMs) return;
  // (Each swept piece moves at most dashScramble.movesPerPiece times: a change past that is refused, the rules' own rushKeep.)
  const kept = rushKeep(rush, r.places[playerId] ?? {}, r.moved?.[playerId] ?? {}, places as Record<string, unknown>);
  r.places[playerId] = kept.places;
  r.moved = { ...r.moved, [playerId]: kept.moved };
}

/** His part on the lobby server. */
export const dashLobby = { startRush, rushStep, rushPlace };
