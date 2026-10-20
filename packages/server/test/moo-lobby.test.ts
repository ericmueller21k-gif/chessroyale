import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { applyMove, legalMoves, pieceAt, sanLineToUci, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * Moo & Moon online (docs/decisions/2026-10-20-moo-rules.md): the boss request asks the host for the crowd's top moves
 * after his move when a Moonbeam lands after it (`beam`), the server takes the host's lines (checked) or, from an older
 * app, goes by value; the Full Moon asks for his move at full strength (`best`, no brain) and the flurry's lines.
 */

type Msg = ServerMessage;
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, eco: "C88", name: `O${i}`, family: `F${i}`, unusual: false, moves: line, namedPlies: line.length, expected: Object.fromEntries(line.map((_, n) => [n, 0.5])) }));

function moo(patch: Partial<Settings> = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "moo", bossUnfinished: true, bossStumbleBelow: 0, ...patch } as Settings;
  const core = new LobbyCore(newLobbyRecord("MOOMO", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]), icon: () => undefined }, library, mulberry32(7), settings);
  for (const [i, id] of ["P1", "P2"].entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 1500);
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
    return last("p1", "bossRequest");
  };
  const toRound = () => {
    for (let i = 0; i < 12 && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "round")!;
  };
  const crowdPlays = () => {
    const r = toRound();
    const ok = r.boss?.powers?.allowed ?? legalMoves(r.board!.fen);
    // (Varied, from the position: no repetition draws.)
    const sorted = [...ok].sort();
    const m = sorted[Math.floor(hash(r.board!.fen) * sorted.length)]!;
    for (const id of ["p1", "p2"]) core.message(id, { t: "pick", key: last(id, "round")!.key, move: m });
    expect(hostScores()).toBe(true);
    return r;
  };
  /** The host's answer: a move of his (from the position), with `beam` lines if given. */
  const answer = (beam?: (after: string) => string[]) => {
    const req = last("p1", "bossRequest")!;
    inbox.set("p1", (inbox.get("p1") ?? []).filter((x) => x.t !== "bossRequest"));
    const legal = [...(req.allowed ?? legalMoves(req.fen))].sort();
    const move = legal[Math.floor(hash(req.fen) * legal.length)]!;
    core.message("p1", { t: "bossMove", key: req.key, move, ...(beam ? { beam: beam(applyMove(req.fen, move)) } : {}) });
    return { req, move };
  };
  advance(1000);
  advance(60_000);
  return { core, inbox, last, advance, runner, asked, toRound, crowdPlays, answer };
}

describe("Moo & Moon online", () => {
  it("the host is asked for the crowd's top moves after his 3rd move (only then), and its best line's piece is stunned for everyone", () => {
    const L = moo();
    expect(L.runner().boss!.id).toBe("moo");
    for (let k = 1; k <= 2; k++) {
      L.crowdPlays();
      expect(L.asked()!.beam).toBeUndefined();
      L.answer();
    }
    L.crowdPlays();
    expect(L.asked()!.beam).toBe(BOSS_POWERS.moonbeamLines);
    // The host's lines: a king move first (never stunned), an illegal one, then a knight's move.
    let knight = "";
    L.answer((after) => {
      const legal = legalMoves(after);
      const king = legal.find((m) => pieceAt(after, m.slice(0, 2))?.type === "k");
      knight = legal.find((m) => pieceAt(after, m.slice(0, 2))?.type === "n")!;
      return [...(king ? [king] : []), "a1a8", knight, ...legal.slice(0, 3)];
    });
    const round = L.toRound();
    const p = round.boss!.powers!;
    expect(p.stunned).toEqual([knight.slice(0, 2)]);
    expect(p.events).toContainEqual({ kind: "moonbeam", turn: p.turn, square: knight.slice(0, 2) });
    expect(p.allowed!.some((m) => m.startsWith(knight.slice(0, 2)))).toBe(false);
    expect(L.last("p2", "round")!.boss!.powers!.stunned).toEqual(p.stunned);
    // The crowd's move: the glow is gone while he thinks.
    L.crowdPlays();
    L.asked();
    expect(L.last("p1", "boss")!.boss.powers!.stunned).toEqual([]);
  });

  it("an older app answers without lines: the beam still lands, by value", () => {
    const L = moo({ bossPowerTest: "moonbeam" });
    L.crowdPlays();
    expect(L.asked()!.beam).toBe(BOSS_POWERS.moonbeamLines);
    L.answer();
    const p = L.toRound().boss!.powers!;
    expect(p.stunned).toHaveLength(1);
    expect(p.events.filter((e) => e.kind === "moonbeam")).toHaveLength(1);
  });

  it("the Full Moon: his transformation while he thinks, his move asked at full strength (no brain) with the flurry's lines", () => {
    const L = moo({ bossPowerTest: "fullmoon" });
    L.crowdPlays();
    expect(L.asked()!.best).toBeUndefined();
    L.answer();
    // Warned as the second turn begins; it comes as the crowd's move lands.
    expect(L.toRound().boss!.powers!.events.some((e) => e.kind === "warn")).toBe(true);
    L.crowdPlays();
    const req = L.asked()!;
    const thinking = L.last("p1", "boss")!;
    expect(thinking.thinking).toBe(true);
    expect(thinking.boss.powers!.events.some((e) => e.kind === "fullMoon")).toBe(true);
    expect(thinking.boss.powers!.fullMoon).toEqual({ left: BOSS_POWERS.fullMoonMoves });
    expect(req.best).toBe(true);
    expect(req.brain).toBeUndefined();
    expect(req.beam).toBe(BOSS_POWERS.moonbeamLines);
    L.answer((after) => legalMoves(after));
    const p = L.toRound().boss!.powers!;
    const flurry = p.events.find((e) => e.kind === "flurry")!;
    expect(flurry.squares!.length).toBeGreaterThan(1);
    expect(flurry.squares!.length).toBeLessThanOrEqual(BOSS_POWERS.flurryBeams);
    expect(p.stunned).toEqual(flurry.squares);
    expect(p.fullMoon).toEqual({ left: BOSS_POWERS.fullMoonMoves - 1 });
    // His next four moves at full strength too, then his own brain again.
    for (let k = 0; k < BOSS_POWERS.fullMoonMoves; k++) {
      L.crowdPlays();
      const r = L.asked()!;
      expect(!!r.best).toBe(k < BOSS_POWERS.fullMoonMoves - 1);
      L.answer();
    }
    const after = L.toRound().boss!.powers!;
    expect(after.fullMoon).toBeNull();
  });
});
