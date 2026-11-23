import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { BIRDIE_BEATS, birdieImpactMs, birdieTurnMs, legalMoves, lineSquares, powerWinShowMs, sanLineToUci, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * Birdie online (docs/decisions/2026-11-23-birdie-rules.md): the one thing his rules ask of the server besides the shared runner (which
 * the boss kit's parity test runs both ways): his train on your king wins the battle at the start of his turn, and the server holds the
 * board as he "thinks" for its ride (powerWinShowMs), the same as solo, before the results. And a warned turn's score job carries the
 * warned square (`train`), so the judges' devices count a piece left there as gone.
 */

type Msg = ServerMessage;
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, eco: "C88", name: `O${i}`, family: `F${i}`, unusual: false, moves: line, namedPlies: line.length, expected: Object.fromEntries(line.map((_, n) => [n, 0.5])) }));

function birdieLobby(power = "train") {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const log: { id: string; at: number; msg: Msg }[] = [];
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "birdie", bossUnfinished: true, bossStumbleBelow: 0, bossPowerTest: power } as Settings;
  const send = (id: string, msg: unknown) => {
    inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]);
    log.push({ id, at: now, msg: msg as Msg });
  };
  const core = new LobbyCore(newLobbyRecord("BIRDY", now), { now: () => now, send, icon: () => undefined }, library, mulberry32(7), settings);
  for (const [i, id] of ["P1", "P2"].entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 1500);
  core.message("p1", { t: "start" });
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const drop = (id: string, t: Msg["t"]) => inbox.set(id, (inbox.get(id) ?? []).filter((m) => m.t !== t));
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  const runner = () => (core as unknown as { runner: MatchRunner }).runner;
  const hostScores = () => {
    const req = last("p1", "scoreRequest");
    if (!req) return null;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const legal = j.allowed ?? legalMoves(j.fen);
      const exp = Object.fromEntries(legal.map((m, i) => [m, 0.4 + 0.01 * (i % 7)]));
      const best = legal.reduce((a, b) => (exp[b]! > exp[a]! ? b : a));
      return { boardId: j.boardId, bestMove: best, bestExpected: exp[best]!, expectedAfter: exp, botPicks: {}, botThinkMs: {} };
    });
    core.message("p1", { t: "scores", key: req.key, boards });
    drop("p1", "scoreRequest");
    return req;
  };
  const hisTurn = () => {
    for (let i = 0; i < 12 && !last("p1", "bossRequest") && core.save().phase !== "play"; i++) advance(5_000);
    const req = last("p1", "bossRequest");
    if (!req) return;
    drop("p1", "bossRequest");
    core.message("p1", { t: "bossMove", key: req.key, move: legalMoves(req.fen)[0]! });
  };
  const toPlay = () => {
    for (let i = 0; i < 20 && core.save().phase !== "play"; i++) {
      if (runner()?.bossToMove()) hisTurn();
      else advance(2_000);
    }
  };
  advance(1000);
  advance(60_000);
  return { core, log, advance, runner, hostScores, toPlay, last, drop, now: () => now };
}

describe("Birdie online", () => {
  it("a warned turn's score job names the warned square; your king left on the line: the board holds for his train's ride, then the results", () => {
    const l = birdieLobby();
    // (The test switch warns every turn from the second: play the first turn, then the second is warned.)
    l.toPlay();
    for (const id of ["p1", "p2"]) l.core.message(id, { t: "pick", key: l.last(id, "round")!.key, move: (l.last(id, "round")!.boss?.powers?.allowed ?? legalMoves(l.last(id, "round")!.board!.fen))[0]! });
    expect(l.hostScores()).toBeTruthy();
    l.drop("p1", "round");
    l.drop("p2", "round");
    l.toPlay();
    const r = l.runner();
    expect(r.boss!.powers!.birdie?.warn?.turn).toBe(r.boss!.crowdMoves + 1);
    // Your king the warned piece: its line, the only piece of yours on it (the board as the warning found it: the rules' test of a line
    // is theirs, chess/test/birdie.test.ts).
    const p = r.boss!.powers!;
    const id = r.state.boards[0]!;
    const b = r.boards.get(id)!;
    const fen = b.fen;
    const king = [..."abcdefgh"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${f}${n}`)).find((sq) => {
      const rows = fen.split(" ")[0]!.split("/");
      const row = rows[8 - Number(sq[1])]!.replace(/\d/g, (d) => ".".repeat(Number(d)));
      return row[sq.charCodeAt(0) - 97] === (r.boss!.crowdSide === "w" ? "K" : "k");
    })!;
    r.state = { ...r.state, boss: { ...r.boss!, powers: { ...p, birdie: { ...p.birdie!, warn: { turn: p.turn, line: king[0]!, squares: lineSquares(king[0]!, r.boss!.crowdSide), square: king, piece: "k" } } } } };
    const round = l.last("p1", "round")!;
    const move = legalMoves(round.board!.fen).find((m) => !m.startsWith(king))!;
    for (const pid of ["p1", "p2"]) l.core.message(pid, { t: "pick", key: l.last(pid, "round")!.key, move });
    const req = l.hostScores();
    expect(req?.jobs[0]?.train).toBe(king);
    // The win: after your move's reveal, a boss message as he thinks, his train's win among its events; no results before its ride's length.
    const isHeld = (x: { msg: Msg }) => x.msg.t === "boss" && "thinking" in x.msg && !!x.msg.thinking && !!x.msg.boss?.powers?.events.some((e) => e.kind === "trainWin");
    for (let i = 0; i < 40 && !l.log.some(isHeld); i++) l.advance(500);
    const held = l.log.find(isHeld);
    expect(held).toBeTruthy();
    expect(l.log.some((x) => x.msg.t === "results")).toBe(false);
    const at = held!.at;
    const ms = powerWinShowMs((held!.msg as Extract<Msg, { t: "boss" }>).boss!);
    expect(ms).toBeGreaterThan(0);
    l.advance(ms - 100);
    expect(l.log.some((x) => x.at >= at && x.msg.t === "results")).toBe(false);
    for (let i = 0; i < 5 && !l.log.some((x) => x.msg.t === "results"); i++) l.advance(1_000);
    const results = l.log.find((x) => x.msg.t === "results");
    expect(results).toBeTruthy();
    expect(results!.at - at).toBeGreaterThanOrEqual(ms);
    expect(r.boss!.result).toBe("boss");
  });

  it("his fall (Nov 23): his thinking holds for his ult's piece, its start and the train's impact sent with every message of it (turnAt), his move after the impact", () => {
    const l = birdieLobby("fall");
    const isFall = (x: { msg: Msg }) => x.msg.t === "boss" && "thinking" in x.msg && !!x.msg.thinking && !!x.msg.boss?.powers?.events.some((e) => e.kind === "birdieFall");
    // (The test switch: his fall after the crowd's second move. Pick, score and let him reply until it comes.)
    for (let turn = 0; turn < 4 && !l.log.some(isFall); turn++) {
      l.toPlay();
      const round = l.last("p1", "round");
      if (!round) break;
      for (const id of ["p1", "p2"]) l.core.message(id, { t: "pick", key: l.last(id, "round")!.key, move: (l.last(id, "round")!.boss?.powers?.allowed ?? legalMoves(l.last(id, "round")!.board!.fen))[0]! });
      l.hostScores();
      l.drop("p1", "round");
      l.drop("p2", "round");
      for (let i = 0; i < 20 && !l.log.some(isFall) && !l.last("p1", "bossRequest"); i++) l.advance(500);
      if (!l.log.some(isFall)) l.toPlay();
    }
    const held = l.log.find(isFall);
    expect(held).toBeTruthy();
    const view = (held!.msg as Extract<Msg, { t: "boss" }>).boss!;
    const sent = view.powers!.birdie!.turnAt!;
    expect(sent.turn).toBe(view.powers!.turn);
    expect(sent.at).toBe(held!.at);
    expect(sent.dropAt).toBe(held!.at + birdieImpactMs(view)!);
    expect(sent.dropAt! - held!.at).toBeGreaterThanOrEqual(BIRDIE_BEATS.fall.impactAt);
    // (His move asked for and answered at once: it shows only once his thinking's hold is over, past the impact.)
    const req = l.last("p1", "bossRequest");
    if (req) {
      l.drop("p1", "bossRequest");
      l.core.message("p1", { t: "bossMove", key: req.key, move: legalMoves(req.fen)[0]! });
    }
    const shown = (x: { at: number; msg: Msg }) => x.at >= held!.at && x.msg.t === "boss" && !("thinking" in x.msg && x.msg.thinking);
    for (let i = 0; i < 60 && !l.log.some(shown); i++) l.advance(500);
    const move = l.log.find(shown);
    expect(move).toBeTruthy();
    expect(move!.at).toBeGreaterThanOrEqual(sent.dropAt!);
    expect(move!.at - held!.at).toBeGreaterThanOrEqual(birdieTurnMs(view));
    // (Every message of his thinking carried the same start: a device back from a reload carries his fall on from it.)
    for (const x of l.log.filter((y) => y.at >= held!.at && y.at < move!.at && y.msg.t === "boss")) expect((x.msg as Extract<Msg, { t: "boss" }>).boss?.powers?.birdie?.turnAt).toEqual(sent);
  });
});
