/**
 * Hollow on the lobby server (his rules: packages/chess/src/bosses/hollow.ts): a move attempt into the dark, judged as
 * it's sent, and Lights out, the memory test the server times round by round at the start of his turn (nobody's clock
 * running). The lobby routes its messages ("darkTry", "lightsTap") and its timer ("lights") here.
 */
import { judgeTaps, lightsDeadline, lightsOutTimeline, lightsRoundEnd, type NetLightsOut } from "@chessroyale/chess";
import type { BossLobby } from "./base.ts";

/**
 * Hollow's dark: a move attempt that touched a dark square, sent unchecked. The runner judges it: a legal move is the
 * player's pick; an illegal one costs points and they pick again, and the last of their tries ends their turn as a
 * missed move. Only the player hears how it went.
 */
function darkTry(lobby: BossLobby, playerId: string, key: string, move: unknown, away?: unknown) {
  const round = lobby.r.round;
  if (lobby.r.phase !== "play" || !round || round.key !== key || lobby.doneThisRound(playerId) || !lobby.runner?.boss || typeof move !== "string") return;
  const now = lobby.now();
  const deadline = round.deadlines?.[playerId] ?? round.deadline;
  if (now > deadline + lobby.settings.lateGraceMs || now < round.startedAt - 500) return;
  const out = lobby.runner.darkTry(playerId, move);
  if (out.kind === "move") {
    lobby.send(playerId, { t: "darkTry", key, move: out.move, ok: true }, false);
    return lobby.pick(playerId, key, out.move, away);
  }
  if (out.kind === "refused") return lobby.send(playerId, { t: "darkTry", key, move, ok: false, refused: true }, false);
  lobby.send(playerId, { t: "darkTry", key, move, ok: false, tries: out.tries, ...(out.out ? { out: true } : {}) }, false);
  if (!out.out) return;
  (round.darkOut ??= {})[playerId] = Math.min(lobby.thinkTime(round, now), lobby.thinkTime(round, deadline));
  for (const h of lobby.r.humans) lobby.send(h.id, { t: "moved", key, playerId }, false);
  lobby.sendTally();
  if (lobby.roundHumans().every((h) => lobby.doneThisRound(h.id))) lobby.lock();
}

// ---------------- Lights out ----------------

/** The test's beats (boss-timing.ts), from its rounds' seconds, the late grace and when the rounds over ended. */
function lightsTimeline(lobby: BossLobby) {
  const ended = lobby.r.lights?.endedAt ?? [];
  return lightsOutTimeline((lobby.runner?.boss?.powers?.lightsOut?.rounds ?? []).map((r, i) => ({ ms: r.ms, endedAt: ended[i] })), lobby.settings.lateGraceMs);
}

/** When the round on is over (ms from the test's start): every person done, by their tries or their own time. */
function roundEndNow(lobby: BossLobby): number {
  const l = lobby.r.lights!;
  const k = l.ended;
  const r = lightsTimeline(lobby).rounds[k]!;
  const pieces = lobby.runner!.boss!.powers!.lightsOut!.rounds[k]!.pieces.length;
  return lightsRoundEnd(r, pieces, Object.values(l.tapAt ?? {}).map((x) => x[k] ?? []), lobby.settings.lateGraceMs);
}

/** Lights out begins at the start of his turn: the game paused, nobody's clock running, the server timing each round. */
function startLights(lobby: BossLobby) {
  const runner = lobby.runner!;
  const test = runner.startLightsOut();
  lobby.r.phase = "boss";
  lobby.r.lights = { key: `l-${++lobby.r.counter}`, at: lobby.now(), ended: 0, endedAt: [], taps: {}, tapAt: {} };
  for (const p of runner.alive())
    if (!p.isBot) {
      lobby.r.lights.taps[p.id] = test.rounds.map(() => []);
      lobby.r.lights.tapAt![p.id] = test.rounds.map(() => []);
    }
  sendLights(lobby);
  armLights(lobby);
}

function armLights(lobby: BossLobby) {
  const l = lobby.r.lights!;
  const tl = lightsTimeline(lobby);
  lobby.setTimer("lights", l.at + (l.ended < tl.rounds.length ? roundEndNow(lobby) : tl.total));
}

/** A round ends (its answers go out, each player's taps judged), or the lights are back: the misses cost, and he moves. */
function lightsStep(lobby: BossLobby) {
  const l = lobby.r.lights;
  const runner = lobby.runner;
  if (!l || !runner || lobby.r.phase !== "boss") return;
  const tl = lightsTimeline(lobby);
  if (l.ended < tl.rounds.length) {
    // (A tap since may have given someone more time.)
    const end = roundEndNow(lobby);
    if (lobby.now() < l.at + end) return armLights(lobby);
    (l.endedAt ??= []).push(Math.max(end, lobby.now() - l.at));
    l.ended++;
    sendLights(lobby);
    return armLights(lobby);
  }
  const missed: Record<string, number> = {};
  for (const id of Object.keys(l.taps)) missed[id] = lightsMine(lobby, id).reduce((n, r, i) => n + (runner.boss!.powers!.lightsOut!.rounds[i]!.pieces.length - r.found.length), 0);
  runner.finishLightsOut(missed);
  lobby.r.lights = undefined;
  lobby.requestBoss();
}

/** A player's taps in Lights out, judged round by round. */
function lightsMine(lobby: BossLobby, playerId: string): { found: string[]; wrong: string[]; used: number }[] {
  const runner = lobby.runner!;
  const test = runner.boss!.powers!.lightsOut!;
  const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
  const side = runner.boss!.crowdSide === "w" ? "b" : "w";
  return test.rounds.map((r, i) => {
    const j = judgeTaps(r, fen, side, lobby.r.lights?.taps[playerId]?.[i] ?? []);
    return { found: j.found, wrong: j.wrong, used: j.used };
  });
}

/** The crowd's count so far, from the server's judging of everyone's taps (bots' as each round ends). */
function lightsCrowd(lobby: BossLobby): NonNullable<NetLightsOut["crowd"]> {
  const l = lobby.r.lights!;
  return lobby.runner!.lightsTally(Object.fromEntries(Object.keys(l.taps).map((id) => [id, lightsMine(lobby, id)])), l.ended);
}

/** The test as each player sees it (their own taps judged; a round's answers once it's over). */
function sendLights(lobby: BossLobby, only?: string) {
  const l = lobby.r.lights!;
  const runner = lobby.runner!;
  const test = runner.boss!.powers!.lightsOut!;
  const boss = runner.bossView()!;
  const standings = lobby.standings();
  const crowd = lightsCrowd(lobby);
  for (const h of lobby.r.humans) {
    if (only && h.id !== only) continue;
    const lights: NetLightsOut = {
      key: l.key,
      at: l.at,
      rounds: test.rounds.map((r, i) => ({ pieces: r.pieces, targets: r.targets, ms: r.ms, ...(i < l.ended ? { answers: r.answers, endedAt: l.endedAt?.[i] } : {}) })),
      mine: lightsMine(lobby, h.id),
      crowd,
    };
    lobby.send(h.id, { t: "lights", lights, boss, standings });
  }
}

/**
 * A tap in Lights out: judged against the round on, while it's open for this player (their own deadline: the round's
 * seconds, a second more for each tap, and the usual late grace) and they have tries left (one per piece). Every
 * tap gives them a second more; once everyone is done, the round is over.
 */
function lightsTap(lobby: BossLobby, playerId: string, key: string, round: unknown, square: unknown) {
  const l = lobby.r.lights;
  if (!l || l.key !== key || lobby.r.phase !== "boss" || typeof round !== "number" || typeof square !== "string" || !/^[a-h][1-8]$/.test(square)) return;
  const taps = l.taps[playerId]?.[round];
  const r = lightsTimeline(lobby).rounds[round];
  if (!taps || !r || round !== l.ended) return;
  const t = lobby.now() - l.at;
  if (t < r.at - 300 || t > lightsDeadline(r, taps.length) + lobby.settings.lateGraceMs) return;
  const pieces = lobby.runner!.boss!.powers!.lightsOut!.rounds[round]!.pieces.length;
  if (taps.length >= pieces || taps.includes(square)) return;
  taps.push(square);
  ((l.tapAt ??= {})[playerId] ??= l.taps[playerId]!.map(() => []))[round]!.push(t);
  sendLights(lobby, playerId);
  // Everyone's meter moves with it (a small message; the tapper's came with their own taps).
  const crowd = lightsCrowd(lobby);
  for (const h of lobby.r.humans) if (h.id !== playerId) lobby.send(h.id, { t: "lightsCrowd", key: l.key, crowd }, false);
  // Done at once if everyone is; otherwise the round may now end later.
  if (roundEndNow(lobby) <= t) return lightsStep(lobby);
  armLights(lobby);
}

/**
 * Crowd: the picks so far, to everyone allowed to see them: players who have
 * picked this round, and the team that's watching. Bots' picks show from the
 * moment each bot finishes thinking. Nobody sees picks before making their own.
 */

/** His part on the lobby server. */
export const hollowLobby = { darkTry, startLights, lightsStep, lightsTap };
