import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { bossThinkMs, gingerTurnMs, legalMoves, sanLineToUci, type BoardScore, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * Ginger's Super Freeze online (Nov 18): its moment at the start of his turn the same for everyone, his move held until it's over
 * (the server times his thinking: gingerTurnMs), the frozen pieces' picks refused for everyone, and a reconnect shows the ice.
 */

type Msg = ServerMessage & { now: number };
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, eco: "C88", name: `O${i}`, family: `F${i}`, unusual: false, moves: line, namedPlies: line.length, expected: Object.fromEntries(line.map((_, n) => [n, 0.5])) }));

function ginger(patch: Partial<Settings> = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "gingerbread", bossKillEvery: 99, bossStumbleBelow: 0, ...patch } as Settings;
  const core = new LobbyCore(newLobbyRecord("GINGR", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]), icon: () => undefined }, library, mulberry32(7), settings);
  for (const [i, id] of ["P1", "P2"].entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 1500);
  core.message("p1", { t: "start" });
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
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
  const toRound = () => {
    for (let i = 0; i < 12 && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "round")!;
  };
  /** Both pick one move (from the position: no repetitions), the host scores, and the reveal plays out to his turn. */
  const crowdPlays = () => {
    const r = toRound();
    const ok = [...(r.boss?.powers?.allowed ?? legalMoves(r.board!.fen))].sort();
    const m = ok[Math.floor(hash(r.board!.fen) * ok.length)]!;
    for (const id of ["p1", "p2"]) core.message(id, { t: "pick", key: last(id, "round")!.key, move: m });
    expect(hostScores()).toBe(true);
    for (let i = 0; i < 20 && !last("p1", "bossRequest"); i++) advance(1_000);
    return r;
  };
  /** The host's answer at once: a move of his, from the position. */
  const answer = () => {
    const req = last("p1", "bossRequest")!;
    inbox.set("p1", (inbox.get("p1") ?? []).filter((x) => x.t !== "bossRequest"));
    const legal = [...(req.allowed ?? legalMoves(req.fen))].sort();
    core.message("p1", { t: "bossMove", key: req.key, move: legal[Math.floor(hash(req.fen) * legal.length)]! });
  };
  advance(1000);
  advance(60_000);
  return { core, inbox, last, advance, toRound, crowdPlays, answer, get now() { return now; } };
}

describe("Ginger's Super Freeze online", () => {
  it("its moment while he thinks, the same for everyone; his move held until it's over; the frozen pieces' picks refused; a reconnect shows the ice", () => {
    const L = ginger({ bossPowerTest: "superfreeze" });
    // His meter as the battle's first turn is picked: full (the switch: it comes as this move lands).
    expect(L.toRound().boss!.powers!.superFreeze).toMatchObject({ meter: 1, used: 0, held: [] });
    L.crowdPlays();
    // While he thinks: SUPER FREEZE! with its middle square and pieces, the same for both, and the ice on them.
    const t1 = L.last("p1", "boss")!;
    const t2 = L.last("p2", "boss")!;
    expect(t1.thinking).toBe(true);
    expect(t1.boss.powers).toEqual(t2.boss.powers);
    const ev = t1.boss.powers!.events.find((e) => e.kind === "superFreeze")!;
    expect(ev.square).toBeTruthy();
    expect(ev.squares!.length).toBeGreaterThan(0);
    expect(t1.boss.powers!.iced).toEqual(expect.arrayContaining(ev.squares!));
    expect(t1.boss.powers!.superFreeze).toMatchObject({ used: 1, meter: 0, target: ev.square });
    // His move, answered at once, shows only once the moment is over: his thinking lasts it all (no clock runs meanwhile).
    const thinkAt = t1.now;
    const minThink = bossThinkMs(t1.boss, false, gingerTurnMs(t1.boss));
    expect(minThink).toBeGreaterThanOrEqual(gingerTurnMs(t1.boss));
    L.answer();
    const shown = () => [...(L.inbox.get("p1") ?? [])].find((m) => m.t === "boss" && !m.thinking && m.now >= thinkAt);
    for (let i = 0; i < 40 && !shown(); i++) L.advance(250);
    expect(shown()!.now - thinkAt).toBeGreaterThanOrEqual(gingerTurnMs(t1.boss) - 250);
    // The crowd's turn: the same pieces held for everyone, out of the allowed moves; a pick of one refused.
    const r2 = L.toRound();
    const p2 = r2.boss!.powers!;
    expect(L.last("p2", "round")!.boss!.powers).toEqual(p2);
    const held = p2.superFreeze!.held;
    expect(held.length).toBeGreaterThan(0);
    for (const sq of held) expect(ev.squares).toContain(sq);
    expect(p2.iced).toEqual(expect.arrayContaining(held));
    expect(p2.allowed!.some((m) => held.includes(m.slice(0, 2)))).toBe(false);
    const frozenMove = legalMoves(r2.board!.fen).find((m) => held.includes(m.slice(0, 2)));
    if (frozenMove) {
      L.core.message("p1", { t: "pick", key: r2.key, move: frozenMove });
      expect(L.core.record.round!.picks.p1).toBeUndefined();
    }
    // P2 drops and comes back with its token: it's sent the round again, the ice and the held pieces with it.
    const token = L.core.record.humans[1]!.token;
    L.core.disconnect("p2");
    L.inbox.set("p2", []);
    L.core.connect(token, undefined, "phone");
    L.core.resendTo("p2");
    const again = L.last("p2", "round")!;
    expect(again.boss!.powers!.superFreeze!.held).toEqual(held);
    expect(again.boss!.powers!.iced).toEqual(p2.iced);
  });
});
