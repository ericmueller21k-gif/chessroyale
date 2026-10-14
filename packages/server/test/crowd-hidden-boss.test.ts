import { describe, expect, it } from "vitest";
import { BOSS_POWERS, CROWD_KNOCKOUTS, DEFAULT_SETTINGS, bossDef, crowdFinalists, fixedLevel, maiaTopRating, modeSettings, mulberry32, type Settings } from "@chessroyale/core";
import { RECLUSE_FALL_MS, legalMoves, sanLineToUci, type BoardScore, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * The Crowd's boss final online (Eric, Oct 14): always the Hidden Boss, the top 4 against him, his phase 1 run by the
 * lobby as solo runs it (his brain on the host's device, his powers, his collapse); phase 2 isn't online yet, so phase 1
 * won is the crowd's victory.
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O", "h3", "Nb8", "d4", "Nbd7", "c4"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({
  id: `o${i}`,
  eco: "C95",
  name: `Opening ${i}`,
  family: `Family ${i}`,
  unusual: i >= 25,
  moves: line,
  namedPlies: 21,
  expected: Object.fromEntries(Array.from({ length: 22 }, (_, n) => [n, 0.5])),
}));

type Msg = ServerMessage;
/** The scoring "engine": a hash of the position and the move. */
const exp = (fen: string, m: string) => 0.3 + 0.4 * hash(fen + m);
const hashBest = (fen: string) => legalMoves(fen).reduce((a, b) => (exp(fen, b) > exp(fen, a) ? b : a));

/**
 * A fake lobby (clock, outboxes, a host that scores with the hash), Crowd 50 v 50 ending in the boss final, two people
 * (Ann, the host, and Bo) and 98 bots. `script`: the crowd's moves once the battle is on, each picked by everyone.
 */
function crowdFinal(patch: Partial<Settings> = {}, seed = 7) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const core = new LobbyCore(
    newLobbyRecord("ABCDE", now),
    { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]), icon: () => undefined },
    library,
    mulberry32(seed),
    {
      ...DEFAULT_SETTINGS,
      ...modeSettings("crowd", { crowdTeams: true, augments: false }),
      finalFormat: "boss",
      knockoutsPerStage: CROWD_KNOCKOUTS.boss,
      // (Two rounds a stage: with one, the team that hasn't moved yet is all tied at the first cut.)
      firstStageRounds: 2,
      roundsPerStage: 2,
      boardIntroSeconds: 0,
      ...patch,
    },
  );
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const all = <T extends Msg["t"]>(id: string, t: T) => (inbox.get(id) ?? []).filter((m) => m.t === t) as Extract<Msg, { t: T }>[];
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  const people = ["p1", "p2"];
  /** The crowd's move in the battle: everyone's pick (a script), else each picks the hash's best. */
  let script: string[] = [];
  const crowdPick = (fen: string) => {
    const s = script.find((m) => legalMoves(fen).includes(m));
    return s ?? hashBest(fen);
  };
  /** The host scores every board: bots pick the script's move in the battle, else a spread of moves. */
  const hostScores = () => {
    for (const host of people) {
      const req = last(host, "scoreRequest");
      if (!req) continue;
      const boards: BoardScore[] = req.jobs.map((j) => {
        const legal = legalMoves(j.fen);
        const e = Object.fromEntries(legal.map((m) => [m, exp(j.fen, m)]));
        const best = hashBest(j.fen);
        const scripted = script.find((m) => legal.includes(m));
        return {
          boardId: j.boardId,
          bestMove: best,
          bestExpected: e[best]!,
          expectedAfter: e,
          botPicks: Object.fromEntries(j.bots.map((b, i) => [b.id, scripted ?? legal[i % legal.length]!])),
          botThinkMs: Object.fromEntries(j.bots.map((b) => [b.id, 4000])),
        };
      });
      core.message(host, { t: "scores", key: req.key, boards });
      inbox.set(host, (inbox.get(host) ?? []).filter((m) => m.t !== "scoreRequest"));
      return true;
    }
    return false;
  };
  /** The boss's moves the host plays: a script's (in order), else the first legal one. */
  let bossScript: string[] = [];
  const bossRequests: Extract<Msg, { t: "bossRequest" }>[] = [];
  /** One step: people pick (unless `miss`), the host scores and plays the boss, or time passes. */
  const step = (miss = false) => {
    const phase = core.record.phase;
    if (phase === "play") {
      for (const id of people) {
        const r = last(id, "round");
        const round = core.record.round;
        if (!miss && r?.board && !r.watching && r.alive && round?.key === r.key && !round.picks[id]) core.message(id, { t: "pick", key: r.key, move: crowdPick(r.board.fen) });
      }
      advance(1000);
    } else if (phase === "scoring") {
      if (!hostScores()) advance(1000);
    } else if (phase === "boss" && core.record.bossKey) {
      const host = people.find((id) => last(id, "bossRequest")?.key === core.record.bossKey);
      const req = host ? last(host, "bossRequest")! : undefined;
      if (req && host) {
        bossRequests.push(req);
        const legal = req.allowed ?? legalMoves(req.fen);
        const move = bossScript.find((m) => legal.includes(m)) ?? legal[0]!;
        core.message(host, { t: "bossMove", key: req.key, move });
      } else advance(1000);
    } else advance(1000);
  };
  core.connect(undefined, "Ann", "computer");
  core.connect(undefined, "Bo", "phone");
  core.message("p1", { t: "start" });
  advance(1000);
  // The knockouts, to the boss final's intro (after the last cut's screen).
  for (let i = 0; i < 4000 && !last("p1", "boss"); i++) step();
  return {
    core,
    last,
    all,
    advance,
    step,
    bossRequests,
    get now() {
      return now;
    },
    set script(s: string[]) {
      script = s;
    },
    set bossScript(s: string[]) {
      bossScript = s;
    },
  };
}

describe("the Crowd's boss final online: always the Hidden Boss (Eric, Oct 14)", () => {
  it("the top 4 meet him, named from the roster, from the starting position; the host is told his brain (Maia at its top, raw) and asked for his moves at his fixed strength", () => {
    const L = crowdFinal();
    const runner = L.core.save().runner!;
    expect(runner.state.boss!.id).toBe("recluse");
    expect(runner.state.players.filter((p) => p.alive)).toHaveLength(crowdFinalists("boss"));
    // The intro: everyone sees him, by his roster name; the battle from the starting position.
    const intro = L.last("p2", "boss")!;
    expect(intro.boss.id).toBe("recluse");
    expect(intro.boss.name).toBe(bossDef("recluse")!.name);
    expect(intro.boss.board.ply).toBe(0);
    expect(intro.boss.powers).toMatchObject({ passive: "nohelp", ultimate: "bullet" });
    // His brain, decided as the battle begins: Maia at its top rating, raw (his fixed brain), told to the host only.
    expect(L.core.record.bossBrain).toEqual({ brain: "maia-raw", rating: maiaTopRating() });
    expect(L.last(L.core.record.hostId!, "bossBrain")!.brain).toEqual({ brain: "maia-raw", rating: maiaTopRating() });
    // His moves: asked at his fixed strength (Stockfish's while Maia loads), on his brain.
    for (let i = 0; i < 400 && !L.bossRequests.length; i++) L.step();
    expect(L.bossRequests[0]).toMatchObject({ elo: fixedLevel(), brain: { brain: "maia-raw", rating: maiaTopRating() } });
    expect(L.bossRequests[0]!.stumble).toBeUndefined();
  });

  it("a call for the God King against him is never a turn or a strike: the caller still picks, nothing is sent about it, and each try spends a charge (as solo's)", () => {
    const L = crowdFinal();
    // Past the intro, to the crowd's first move of the battle.
    for (let i = 0; i < 100 && !(L.core.record.phase === "play" && L.core.save().runner!.state.boss!.crowdMoves === 0); i++) L.advance(1000);
    expect(L.core.record.phase).toBe("play");
    const runner = L.core.save().runner!;
    const me = ["p1", "p2"].find((id) => runner.state.players.find((p) => p.id === id)!.alive);
    expect(me, "a person reached the final").toBeTruthy();
    const key = L.core.record.round!.key;
    const strikes = L.all("p1", "strike").length + L.all("p2", "strike").length;
    const charges = () => L.core.save().runner!.state.boss!.kingCharges!;
    const before = charges();
    expect(before).toBeGreaterThanOrEqual(1);
    L.core.message(me!, { t: "king", key });
    expect(charges()).toBe(before - 1);
    L.core.message(me!, { t: "king", key, strike: true });
    expect(charges()).toBe(Math.max(0, before - 2));
    // (Never below none.)
    for (let i = 0; i < 4; i++) L.core.message(me!, { t: "king", key });
    expect(charges()).toBe(0);
    expect(L.core.record.round!.kingCalls).toBeUndefined();
    expect(L.core.record.round!.kingStrikes).toBeUndefined();
    expect(L.all("p1", "strike").length + L.all("p2", "strike").length).toBe(strikes);
    // Still their move: their pick counts.
    const fen = L.last(me!, "round")!.board!.fen;
    L.core.message(me!, { t: "pick", key, move: hashBest(fen) });
    expect(L.core.record.round!.picks[me!]).toBeTruthy();
  });

  it("his bullet clock online (?power=bullet: from turn 2): each person's deadline is their bank, the bullet bank, with no cap; everyone out of time, he wins on time (the results say so)", () => {
    const L = crowdFinal({ bossPowerTest: "bullet" });
    let deadline: number | null = null;
    let plus: { allowed: number; bank: number } | null = null;
    for (let i = 0; i < 6000 && L.core.record.phase !== "results"; i++) {
      const b = L.core.save().runner!.state.boss!;
      const round = L.core.record.round;
      const id = ["p1", "p2"].find((x) => L.core.save().runner!.state.players.find((p) => p.id === x)!.alive);
      const turn = b.crowdMoves + 1;
      if (L.core.record.phase === "play" && round && b.powers?.ultAt !== undefined && id) {
        // The turn it came: every bank was set to the bullet bank; a person's deadline is all of it (no increment yet).
        if (deadline === null && turn === b.powers.ultAt) deadline = round.deadlines[id]! - round.startedAt;
        // Its first moves played (1+0), each move adds the increment (1+2): the bank and the increment, still no cap.
        if (plus === null && turn === b.powers.ultAt + BOSS_POWERS.bulletPlainMoves) {
          plus = { allowed: round.deadlines[id]! - round.startedAt, bank: L.core.save().runner!.state.players.find((p) => p.id === id)!.bankMs };
          expect(b.powers.events.some((e) => e.kind === "bulletPlus")).toBe(true);
        }
      }
      // (Nobody picks in the battle: each person's whole bank goes on a missed move.)
      L.step(!!L.core.save().runner?.state.boss && L.core.record.phase === "play");
    }
    expect(deadline).toBe(BOSS_POWERS.bulletBankSeconds * 1000);
    expect(plus).not.toBeNull();
    expect(plus!.allowed).toBe(plus!.bank + BOSS_POWERS.bulletIncrementSeconds * 1000);
    expect(L.core.record.phase).toBe("results");
    const res = L.last("p1", "results")!;
    expect(res.bossResult).toBe("boss");
    expect(res.timeout).toBe(true);
    expect(Object.keys(res.placements)).toHaveLength(100);
  });

  it("beaten online: the board holds for his fall (`fall`, as long as solo's), then the results, the crowd's victory: no phase 2 online", () => {
    const L = crowdFinal();
    // Scholar's mate: the crowd (White) plays it, everyone picking it; the host plays his replies into it.
    L.script = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]).filter((_, i) => i % 2 === 0);
    L.bossScript = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"]).filter((_, i) => i % 2 === 1);
    let fall: Extract<Msg, { t: "boss" }> | undefined;
    let fallAt = 0;
    for (let i = 0; i < 2000 && L.core.record.phase !== "results"; i++) {
      L.step();
      const f = L.all("p2", "boss").find((m) => m.fall);
      if (f && !fall) {
        fall = f;
        fallAt = L.now;
        // Meanwhile nothing else: the match is over, the board holds.
        expect(L.core.record.phase).toBe("boss");
        expect(L.last("p2", "results")).toBeUndefined();
      }
    }
    expect(fall).toBeTruthy();
    expect(fall!.boss.result).toBe("crowd");
    expect(fall!.until - fall!.now).toBe(RECLUSE_FALL_MS);
    expect(L.core.record.phase).toBe("results");
    const res = L.last("p2", "results")!;
    expect(res.bossResult).toBe("crowd");
    expect(res.timeout).toBeUndefined();
    expect(res.now - fallAt).toBeLessThanOrEqual(RECLUSE_FALL_MS + 1000);
    expect(res.now).toBeGreaterThanOrEqual(fall!.until);
    // Those who fought him share the win on their records.
    for (const r of L.core.humanResults()) if (r.placement <= crowdFinalists("boss")) expect(r.survived).toBe(true);
  });
});
