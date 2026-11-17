/**
 * Dash on the lobby server (his rules: packages/chess/src/bosses/dash.ts): his Scramble Rush, timed here as the crowd's turn
 * begins (nobody's clock running). Each person sends their placements as they make them ("rushPlace"); as time's up (and the
 * late grace) the runner judges them with the same code the screens use (rushJudge, bots' from the seed), everyone sees the
 * verdict, then the match goes on: his extra move if the crowd failed it, else the crowd's turn. The game's board never changes.
 */
import { DASH_STALL } from "@chessroyale/core";
import { rushKeep, rushTimeline, stallTimeline } from "@chessroyale/chess";
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

/**
 * His stall skit's next beat, as the move's clock reaches it (the round's "stall" timer; his rules' stallPlan, planned as the round
 * opened): the slam, or his fake second move. While the round is still open (someone still to pick), it begins now: the move clock
 * stands still for its length (every deadline, and every bot still thinking, moves back by that long, as for the King's strike),
 * everyone in the round is told (those who've picked too), and each beat is recorded as it comes (each once a battle, apart:
 * the slam as it starts, the fake move as it lands; after a move made between them the fake move comes alone later). A pick that reaches here during the fake move's hold was made before it (the board takes none then)
 * and counts as ever: nobody's pick is lost. A beat that fires late, with the round's deadline (near) gone, is dropped: the round
 * locks as it would have, and nobody's clock moves back.
 */
function stallBeat(lobby: BossLobby) {
  const round = lobby.r.round;
  const runner = lobby.runner;
  const st = round?.stall;
  if (lobby.r.phase !== "play" || !round || !runner || !st?.next) return;
  const now = lobby.now();
  if (now >= round.deadline - DASH_STALL.marginMs / 2) {
    st.next = undefined;
    return lobby.armRound();
  }
  const beat = st.next;
  const ms = beat === "slam" ? DASH_STALL.slamMs : stallTimeline().total;
  st[beat] = { at: now, until: now + ms };
  st.next = beat === "slam" ? "fake" : undefined;
  round.deadline += ms;
  for (const id of Object.keys(round.deadlines)) round.deadlines[id]! += ms;
  for (const [id, at] of Object.entries(round.botsDoneIn ?? {})) if (round.startedAt + at > now) round.botsDoneIn![id] = at + ms;
  if (beat === "slam") runner.slammed();
  else runner.stalled(st.plan.move);
  const shown = { beat, at: now, until: now + ms, ...(beat === "fake" ? { move: st.plan.move, ...(st.slam ? {} : { alone: true }) } : {}) };
  for (const h of lobby.roundHumans()) {
    const deadline = round.deadlines[h.id] ?? round.deadline;
    lobby.send(h.id, { t: "stall", key: round.key, deadline, ...shown }, false);
    // (A reconnect mid-skit: the round as it's re-sent carries the beat and the deadline it moved to.)
    const last = lobby.r.last[h.id];
    if (last?.t === "round" && last.key === round.key) lobby.r.last[h.id] = { ...last, deadline, stall: shown };
  }
  lobby.sendTally();
  lobby.armRound();
}

/** His part on the lobby server. */
export const dashLobby = { startRush, rushStep, rushPlace, stallBeat };
