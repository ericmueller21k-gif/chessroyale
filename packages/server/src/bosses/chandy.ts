/**
 * Chandy on the lobby server (his rules: packages/chess/src/bosses/chandy.ts): Dodge, his ultimate, timed here as the crowd's turn
 * begins (nobody's clock running), round by round. Each person sends their vote for the king's square as they tap ("dodgeVote"; a
 * later tap replaces it), and everyone sees the counts move ("dodgeVotes"). The teleports go out as they come (the view is
 * dodgeSeen: nothing shows before its time), and each round closes at its vote's end plus the lag grace (chandy.dodgeGraceMs): the
 * runner tallies it with the bots' votes (finishDodgeRound), everyone sees the result; the second hit ends the battle, his. After the
 * last round's held beams (or the losing hit's kill: dodgeEndAt), on with the match. The game's board never changes. A Dodge from your
 * mate (Eric, Nov 26) is timed the same, its start `dodgeLeadMs` after its message (his opening plays first: dodgeTimeline's `opening`)
 * and its end after the win beat when it's survived (dodgeEndAt): then the battle is decided (the runner's stageComplete: the mate's, or
 * his on the second hit).
 */
import { BOSS_POWERS } from "@chessroyale/core";
import { dodgeArena, dodgeEndAt, dodgeLeadMs, dodgeOver, dodgeTimeline, type NetDodge } from "@chessroyale/chess";
import type { BossLobby } from "./base.ts";

const dodgeOf = (lobby: BossLobby) => lobby.runner?.boss?.powers?.chandy?.dodge ?? null;

/** What everyone gets of the Dodge on: its key, start, the round on and its counts. */
function net(lobby: BossLobby): NetDodge {
  const l = lobby.r.dodge!;
  const counts: Record<string, number> = {};
  for (const sq of Object.values(l.votes)) counts[sq] = (counts[sq] ?? 0) + 1;
  return { key: l.key, at: l.at, round: l.round, votes: counts };
}

/** When the next step is due: the round on's next teleport (it goes out to everyone), its close, or (over) its end (dodgeEndAt). */
function arm(lobby: BossLobby) {
  const l = lobby.r.dodge!;
  const d = dodgeOf(lobby);
  const tl = dodgeTimeline();
  if (!d || dodgeOver(d)) return lobby.setTimer("dodge", l.at + (d ? dodgeEndAt(d) : tl.rounds[0]!.end));
  const r = tl.rounds[d.results.length]!;
  const t = lobby.now() - l.at;
  const next = r.teleports.find((x) => x > t) ?? r.closeAt;
  lobby.setTimer("dodge", l.at + next);
}

/** Dodge begins as the crowd's turn begins (or after your mate, its opening first): the boss's screen with it to everyone, its steps timed here. */
function startDodge(lobby: BossLobby) {
  const at = lobby.now() + dodgeLeadMs(dodgeOf(lobby));
  lobby.r.phase = "boss";
  lobby.r.dodge = { key: `d-${++lobby.r.counter}`, at, round: 0, votes: {} };
  lobby.broadcastBoss(0, { dodge: net(lobby) });
  arm(lobby);
}

/** A step: a teleport (its view to everyone), a round's close (the tally, the result to everyone), or the end (on with the match). */
function dodgeStep(lobby: BossLobby) {
  const l = lobby.r.dodge;
  const runner = lobby.runner;
  const d = dodgeOf(lobby);
  if (!l || !runner || !d || lobby.r.phase !== "boss") return;
  const tl = dodgeTimeline();
  const t = lobby.now() - l.at;
  if (dodgeOver(d)) {
    if (t < dodgeEndAt(d)) return arm(lobby);
    lobby.r.dodge = undefined;
    return lobby.nextRound();
  }
  const r = tl.rounds[d.results.length]!;
  if (t >= r.closeAt) {
    runner.finishDodgeRound(l.votes);
    l.round++;
    l.votes = {};
  }
  lobby.broadcastBoss(0, { dodge: net(lobby) });
  arm(lobby);
}

/**
 * A player's vote in the round on, while its vote is open for them (from just before it opens to its end and the lag grace): a square
 * of the arena; a later vote replaces it. Only those still in the battle vote. Everyone sees the counts move.
 */
function dodgeVote(lobby: BossLobby, playerId: string, key: string, round: unknown, square: unknown) {
  const l = lobby.r.dodge;
  const d = dodgeOf(lobby);
  if (!l || !d || l.key !== key || lobby.r.phase !== "boss" || round !== l.round || typeof square !== "string" || dodgeOver(d)) return;
  if (!dodgeArena(d.center).includes(square)) return;
  if (!lobby.runner!.alive().some((p) => p.id === playerId && !p.isBot)) return;
  const r = dodgeTimeline().rounds[l.round]!;
  const t = lobby.now() - l.at;
  if (t < r.voteAt - 300 || t > r.voteEnd + BOSS_POWERS.chandy.dodgeGraceMs) return;
  if (l.votes[playerId] === square) return;
  l.votes[playerId] = square;
  const counts = net(lobby).votes;
  for (const h of lobby.r.humans) lobby.send(h.id, { t: "dodgeVotes", key: l.key, round: l.round, votes: counts }, false);
}

/** His part on the lobby server. */
export const chandyLobby = { startDodge, dodgeStep, dodgeVote };
