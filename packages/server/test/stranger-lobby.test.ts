import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { applyMove, legalMoves, sanLineToUci, stormAnswer, stormCheck, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
import { fakeEngine } from "../../chess/test/boss-kit-lib.ts";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * The Stranger's storm online (docs/decisions/2026-11-27-stranger-storm.md): each of its turns' pick asked of the host with his move
 * before it (`storm`: the turn's kind and the order ties break in), checked by the server (stormCheck): junk makes that turn calm,
 * nothing frozen or marked; an answer the rules allow is the turn's pick.
 */

type Msg = ServerMessage;
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, eco: "C88", name: `O${i}`, family: `F${i}`, unusual: false, moves: line, namedPlies: line.length, expected: Object.fromEntries(line.map((_, n) => [n, 0.5])) }));

function stranger(patch: Partial<Settings> = {}) {
  let now = 1_000_000;
  const players = ["P1", "P2"];
  const inbox = new Map<string, Msg[]>();
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "stranger", bossUnfinished: true, bossStumbleBelow: 0, raidOpening: true, ...patch } as Settings;
  const core = new LobbyCore(newLobbyRecord("STRAN", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]), icon: () => undefined }, library, mulberry32(7), settings);
  for (const [i, id] of players.entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 1500);
  core.message("p1", { t: "start" });
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  const runner = () => (core as unknown as { runner: MatchRunner }).runner;
  const hostScores = () => {
    const req = last("p1", "scoreRequest");
    if (!req) return false;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const legal = j.allowed ?? legalMoves(j.fen);
      const exp = Object.fromEntries(legal.map((m) => [m, 0.3 + 0.4 * hash(j.fen + m)]));
      const best = legal.reduce((a, b) => (exp[b]! > exp[a]! ? b : a));
      return { boardId: j.boardId, bestMove: best, bestExpected: exp[best]!, expectedAfter: exp, botPicks: {}, botThinkMs: {} };
    });
    core.message("p1", { t: "scores", key: req.key, boards });
    inbox.set("p1", (inbox.get("p1") ?? []).filter((m) => m.t !== "scoreRequest"));
    return true;
  };
  const asked = () => {
    for (let i = 0; i < 12 && !last("p1", "bossRequest") && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "bossRequest")!;
  };
  const toRound = () => {
    for (let i = 0; i < 12 && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "round")!;
  };
  const crowdPlays = () => {
    const r = toRound();
    const ok = r.boss?.powers?.allowed ?? legalMoves(r.board!.fen);
    const m = [...ok].sort()[0]!;
    for (const id of players.map((x) => x.toLowerCase())) core.message(id, { t: "pick", key: last(id, "round")!.key, move: m });
    expect(hostScores()).toBe(true);
  };
  const answer = (move: string, storm?: string) => {
    const req = last("p1", "bossRequest")!;
    inbox.set("p1", (inbox.get("p1") ?? []).filter((x) => x.t !== "bossRequest"));
    core.message("p1", { t: "bossMove", key: req.key, move, ...(storm !== undefined ? { storm } : {}) });
  };
  advance(1000);
  advance(60_000);
  return { core, last, advance, runner, asked, toRound, crowdPlays, answer };
}

describe("the Stranger online: his storm's turns from the host", () => {
  it("?power=storm: asked with his move before its first turn and each after; junk: a calm turn; an answer the rules allow: the turn's pick", async () => {
    const L = stranger({ bossPowerTest: "storm" });
    // (Turn 1, his reply: no storm asked yet. Turn 2 begins with the warning; his move after it asks for the storm's first turn.)
    L.crowdPlays();
    expect(L.asked().storm).toBeUndefined();
    L.answer((L.asked().allowed ?? legalMoves(L.asked().fen)).sort()[0]!);
    const warned = L.toRound();
    expect(warned.boss!.powers!.events.map((e) => e.kind)).toContain("warn");
    L.crowdPlays();
    const first = L.asked();
    expect(first.storm).toMatchObject({ kind: expect.stringMatching(/^(fire|ice)$/), order: expect.any(Number) });
    L.answer((first.allowed ?? legalMoves(first.fen)).sort()[0]!, "z9 e4 e4");
    const calm = L.toRound();
    expect(calm.boss!.powers!.events.map((e) => e.kind)).toEqual(["storm", first.storm!.kind === "ice" ? "stormIce" : "stormFire"]);
    expect(calm.boss!.powers!.stranger!.pick).toMatchObject({ kind: first.storm!.kind, squares: [], calm: true });
    L.crowdPlays();
    const next = L.asked();
    expect(next.storm?.kind).toBe(first.storm!.kind === "ice" ? "fire" : "ice");
    const move = (next.allowed ?? legalMoves(next.fen)).sort()[0]!;
    const code = await stormAnswer([fakeEngine()], applyMove(next.fen, move), next.storm!);
    const ok = stormCheck(applyMove(next.fen, move), next.storm!.kind, code)!;
    expect(ok.squares.length).toBeGreaterThan(0);
    L.answer(move, code);
    const turn = L.toRound();
    expect(turn.boss!.powers!.stranger!.pick).toMatchObject({ kind: next.storm!.kind, squares: ok.squares });
    expect(turn.boss!.powers!.events.map((e) => e.kind)).toEqual([next.storm!.kind === "ice" ? "stormIce" : "stormFire"]);
  });
});
