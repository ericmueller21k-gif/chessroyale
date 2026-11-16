import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, rushTimeline, sanLineToUci, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * Dash online (docs/decisions/2026-11-03-dash.md): the server sets every clock against him. A raid's move timer after his slap is
 * slapMoveSeconds shorter; a scrambled move's deadline is scrambleSeconds from its start, and a pick after it (and its grace) is
 * refused; nobody picking in time gets a move played for the crowd from the host's top moves (the flag), never a loss.
 */

type Msg = ServerMessage;
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, eco: "C88", name: `O${i}`, family: `F${i}`, unusual: false, moves: line, namedPlies: line.length, expected: Object.fromEntries(line.map((_, n) => [n, 0.5])) }));

function dashLobby(test: string, players = ["P1", "P2"]) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "dash", bossUnfinished: true, bossStumbleBelow: 0, bossPowerTest: test } as Settings;
  const core = new LobbyCore(newLobbyRecord("DASHX", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]), icon: () => undefined }, library, mulberry32(7), settings);
  for (const [i, id] of players.entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 1500);
  core.message("p1", { t: "start" });
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const drop = (id: string, t: Msg["t"]) => inbox.set(id, (inbox.get(id) ?? []).filter((m) => m.t !== t));
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  const runner = () => (core as unknown as { runner: MatchRunner }).runner;
  /** The host's scores: every legal move scored, the best by a hash; its top moves, best first. */
  const scored = new Map<string, string[]>();
  const hostScores = () => {
    const req = last("p1", "scoreRequest");
    if (!req) return false;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const legal = j.allowed ?? legalMoves(j.fen);
      const exp = Object.fromEntries(legal.map((m) => [m, 0.3 + 0.4 * hash(j.fen + m)]));
      scored.set(j.fen, [...legal].sort((a, b) => exp[b]! - exp[a]!));
      const best = legal.reduce((a, b) => (exp[b]! > exp[a]! ? b : a));
      return { boardId: j.boardId, bestMove: best, bestExpected: exp[best]!, expectedAfter: exp, botPicks: {}, botThinkMs: {} };
    });
    core.message("p1", { t: "scores", key: req.key, boards });
    drop("p1", "scoreRequest");
    return true;
  };
  /** His turn: answered with his first legal move (a capture when he has one, so his slap can come). */
  const hisTurn = () => {
    for (let i = 0; i < 12 && !last("p1", "bossRequest") && core.save().phase !== "play"; i++) advance(5_000);
    const req = last("p1", "bossRequest");
    if (!req) return;
    drop("p1", "bossRequest");
    const fen = runner().boards.get(runner().state.boards[0]!)!.fen;
    const moves = legalMoves(fen);
    const capture = moves.find((m) => fen.split(" ")[0]!.includes("/") && isCapture(fen, m));
    core.message("p1", { t: "bossMove", key: req.key, move: capture ?? moves[0]! });
  };
  const toRound = () => {
    for (let i = 0; i < 20 && core.save().phase !== "play"; i++) {
      if (runner()?.bossToMove()) hisTurn();
      else advance(2_000);
    }
    return last("p1", "round")!;
  };
  const crowdPlays = () => {
    const r = toRound();
    const ok = r.boss?.powers?.allowed ?? legalMoves(r.board!.fen);
    const m = ok.find((x) => x === "b1c3" || x === "g1f3" || x === "b8c6" || x === "g8f6") ?? ok[0]!;
    for (const id of players.map((x) => x.toLowerCase())) core.message(id, { t: "pick", key: last(id, "round")!.key, move: m });
    expect(hostScores()).toBe(true);
  };
  advance(1000);
  advance(60_000);
  return { core, inbox, last, advance, runner, toRound, crowdPlays, hostScores, scored, now: () => now, settings };
}

/** The move takes a piece on `fen` (the square it lands on holds one). */
function isCapture(fen: string, move: string): boolean {
  const rows = fen.split(" ")[0]!.split("/");
  const file = move.charCodeAt(2) - 97;
  const rank = Number(move[3]);
  let x = 0;
  for (const c of rows[8 - rank]!) {
    if (/\d/.test(c)) x += Number(c);
    else {
      if (x === file) return true;
      x++;
    }
  }
  return false;
}

describe("Dash online: the server's clocks", () => {
  it("his slap (the test switch: his first move) makes the raid's next move timer slapMoveSeconds shorter, set by the server", () => {
    const L = dashLobby("clockslap");
    L.crowdPlays();
    const r = L.toRound();
    const d = L.runner().boss!.powers!.dash!;
    expect(d.slap).toMatchObject({ bank: false, ms: BOSS_POWERS.slapMoveSeconds * 1000 });
    expect(r.moveClock).toBe(RAID_SETTINGS.moveClockSeconds! - BOSS_POWERS.slapMoveSeconds);
    expect(r.deadline - r.startsAt).toBeLessThanOrEqual((RAID_SETTINGS.moveClockSeconds! - BOSS_POWERS.slapMoveSeconds) * 1000);
  });

  it("a scrambled move's deadline is 3 s from its start; a pick after it is refused; nobody in time: a move from the host's top moves is played, the battle goes on", () => {
    const L = dashLobby("scramble");
    // (The test switch: its warning as the second turn begins, the scramble as the third does.)
    L.crowdPlays();
    L.crowdPlays();
    const r = L.toRound();
    expect(L.runner().boss!.powers!.events.some((e) => e.kind === "scramble")).toBe(true);
    expect(r.moveClock).toBe(BOSS_POWERS.scrambleSeconds);
    for (const id of ["p1", "p2"]) {
      const mine = L.last(id, "round")!;
      expect(mine.deadline - mine.startsAt).toBe(BOSS_POWERS.scrambleSeconds * 1000);
    }
    // A pick after the deadline and its grace: refused (the server's word, not the device's).
    const fen = r.board!.fen;
    L.advance(BOSS_POWERS.scrambleSeconds * 1000 + L.settings.lateGraceMs + 1);
    L.core.message("p2", { t: "pick", key: r.key, move: legalMoves(fen)[0]! });
    expect(L.hostScores()).toBe(true);
    // Nobody picked in time: the flag's move, one of the host's top flagTop moves, played for the crowd; no loss on time.
    const played = L.runner().boards.get(L.runner().state.boards[0]!)!.history.at(-1);
    const d = L.runner().boss!.powers!.dash!;
    expect(d.flags).toBe(1);
    expect(d.flag!.move).toBe(played);
    expect(L.scored.get(fen)!.slice(0, BOSS_POWERS.flagTop)).toContain(played);
    expect(L.runner().boss!.result ?? null).toBeNull();
    // The next move is scrambled too, its jab first.
    const next = L.toRound();
    expect(next.moveClock).toBe(BOSS_POWERS.scrambleSeconds);
    expect(L.runner().boss!.powers!.events.some((e) => e.kind === "flag")).toBe(true);
  });
});

/**
 * Dash's Scramble Rush online (Nov 6; docs/decisions/2026-11-06-dash-v2.md): the server times it as the crowd's turn begins, keeps
 * each person's placements sent in their ten seconds (none after them), and judges them with the rules' own code as time's up: the
 * crowd's mean under needCorrect, his extra move asked of the host before the crowd's turn. The game's board never changes.
 */
describe("Dash online: the Scramble Rush", () => {
  /** To the Rush (the test switch: warned as the second turn begins, it comes as the third does): its message and the position it froze. */
  function toRush() {
    const L = dashLobby("rush");
    L.crowdPlays();
    // (The warning a turn ahead: the second turn's round as ever, its event out, nothing swept.)
    const warned = L.toRound();
    expect(warned.boss?.powers?.events.some((e) => e.kind === "rushWarn")).toBe(true);
    expect(L.runner().boss!.powers!.dash!.rush ?? null).toBeNull();
    L.crowdPlays();
    for (let i = 0; i < 20 && !L.last("p1", "boss")?.rush; i++) {
      if (L.runner().bossToMove()) {
        const req = L.last("p1", "bossRequest");
        if (req) {
          L.inbox.set("p1", []);
          L.core.message("p1", { t: "bossMove", key: req.key, move: legalMoves(L.runner().boards.get(L.runner().state.boards[0]!)!.fen)[0]! });
          continue;
        }
      }
      L.advance(2_000);
    }
    const msg = L.last("p1", "boss")!;
    expect(msg.rush).toBeTruthy();
    const fen = L.runner().boards.get(L.runner().state.boards[0]!)!.fen;
    return { L, rush: msg.rush!, moves: msg.boss.powers!.dash!.rush!.moves, fen };
  }
  const back = (moves: readonly { from: string }[], n: number) => Object.fromEntries(moves.slice(0, n).map((m) => [m.from, m.from]));

  it("both put 4 back in their ten seconds: held, no extra move, the crowd's turn; a placement before the ten seconds is refused", () => {
    const { L, rush, moves, fen } = toRush();
    const tl = rushTimeline();
    // (Before the ten seconds: not kept.)
    L.core.message("p1", { t: "rushPlace", key: rush.key, places: back(moves, 6) });
    L.advance(tl.placeAt + 500 - (L.now() - rush.at));
    for (const id of ["p1", "p2"]) L.core.message(id, { t: "rushPlace", key: rush.key, places: back(moves, 4) });
    L.advance(tl.placeUntil + L.settings.lateGraceMs + 10 - (L.now() - rush.at));
    const judged = L.runner().boss!.powers!.dash!.rush!;
    expect(judged.correct).toBe(4);
    expect(judged.extra).toBeUndefined();
    expect(L.runner().boards.get(L.runner().state.boards[0]!)!.fen).toBe(fen);
    expect(L.last("p1", "boss")!.boss.powers!.dash!.rush!.correct).toBe(4);
    L.advance(tl.total - tl.placeUntil + 10);
    expect(L.toRound().board!.fen).toBe(fen);
  });

  it("Eric, Nov 6: each piece moved at most movesPerPiece (2) times, kept by the server: a third move of one is refused", () => {
    const { L, rush, moves } = toRush();
    const tl = rushTimeline();
    L.advance(tl.placeAt + 500 - (L.now() - rush.at));
    const [a, b, c] = moves;
    // p1: the first piece onto b's old square, then c's, then home (refused: a third move); p2 puts it home on its first.
    const sends = [{ [a!.from]: b!.from }, { [a!.from]: c!.from }, { [a!.from]: a!.from }];
    for (const places of sends) L.core.message("p1", { t: "rushPlace", key: rush.key, places });
    L.core.message("p2", { t: "rushPlace", key: rush.key, places: { [a!.from]: a!.from } });
    const kept = (L.core as unknown as { r: { rush: { places: Record<string, Record<string, string>>; moved: Record<string, Record<string, number>> } } }).r.rush;
    expect(kept.places.p1![a!.from]).toBe(c!.from);
    expect(kept.moved.p1![a!.from]).toBe(BOSS_POWERS.dashScramble.movesPerPiece);
    expect(kept.places.p2![a!.from]).toBe(a!.from);
    // (Its other pieces still move: p1 puts b home.)
    L.core.message("p1", { t: "rushPlace", key: rush.key, places: { ...kept.places.p1, [b!.from]: b!.from } });
    expect(kept.places.p1![b!.from]).toBe(b!.from);
  });

  it("3 back on average (one 6, one 0), or a late placement: he moves again, asked of the host as his extra move, before the crowd's turn", () => {
    const { L, rush, moves, fen } = toRush();
    const tl = rushTimeline();
    L.advance(tl.placeAt + 500 - (L.now() - rush.at));
    L.core.message("p1", { t: "rushPlace", key: rush.key, places: back(moves, 6) });
    L.advance(tl.placeUntil + L.settings.lateGraceMs + 10 - (L.now() - rush.at));
    // (After the ten seconds and the grace: not kept.)
    L.core.message("p2", { t: "rushPlace", key: rush.key, places: back(moves, 6) });
    expect(L.runner().boss!.powers!.dash!.rush).toMatchObject({ correct: 3, extra: "due" });
    expect(L.runner().boards.get(L.runner().state.boards[0]!)!.fen).toBe(fen);
    L.advance(tl.total - tl.placeUntil + 10);
    const req = L.last("p1", "bossRequest")!;
    expect(req.extra).toBe(true);
  });
});
