import { describe, expect, it } from "vitest";
import { BOSS_POWERS, CROWD_KNOCKOUTS, DEFAULT_SETTINGS, RECLUSE_CHILD, RECLUSE_PHASE2, bossDef, childRating, crowdFinalists, fixedLevel, levelForMaia, maiaTopRating, modeSettings, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, sanLineToUci, type BoardScore, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord, type LobbyIO } from "../src/lobby.ts";

/**
 * The Crowd's boss final online (Eric, Oct 14): always the Hidden Boss, the top 4 against him, his phase 1 run by the
 * lobby as solo runs it (his brain on the host's device, his powers, his collapse); since Nov 13 phase 1 won brings his
 * phase 2 online (his phase change and the four boards, the server's: bosses/recluse.ts), as his room's fight does.
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
 * (Ann, the host, and Bo) and 98 bots. `script`: the crowd's moves once the battle is on, each picked by everyone. `o.worst`: people
 * who pick the hash's worst move (cut early, then watching); `o.io`: more of the lobby's io (an engine server for phase 2).
 */
function crowdFinal(patch: Partial<Settings> = {}, seed = 7, o: { worst?: string[]; io?: Partial<LobbyIO> } = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const core = new LobbyCore(
    newLobbyRecord("ABCDE", now),
    { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]), icon: () => undefined, ...o.io },
    library,
    mulberry32(seed),
    {
      ...DEFAULT_SETTINGS,
      ...modeSettings("crowd", { augments: false }),
      finalFormat: "boss",
      knockoutsPerStage: CROWD_KNOCKOUTS.boss,
      // (Two rounds a stage: with one, the team that hasn't moved yet is all tied at the first cut.)
      stageRounds: [],
      firstStageRounds: 2,
      roundsPerStage: 2,
      boardIntroSeconds: 0,
      // (At his adult form, as `?form=adult`: these tests are about it. His child form comes first otherwise, Nov 13: recluse-online.test.ts.)
      recluseChild: false,
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
        if (!miss && r?.board && !r.watching && r.alive && round?.key === r.key && !round.picks[id]) {
          const fen = r.board.fen;
          const move = o.worst?.includes(id) ? legalMoves(fen).reduce((a, b) => (exp(fen, b) < exp(fen, a) ? b : a)) : crowdPick(fen);
          core.message(id, { t: "pick", key: r.key, move });
        }
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
    // His moves: asked at his fixed strength (Stockfish's while Maia loads), on his brain once the host's Maia is loaded (N1).
    L.core.message(L.core.record.hostId!, { t: "maiaReady" });
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
    // (Nobody picks, on purpose: 50 v 50's AFK rule off, CrowdMisses, as the ?afk=0 switch; it would remove them at the 4th miss.)
    const L = crowdFinal({ bossPowerTest: "bullet", crowdMisses: null });
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

  it("beaten online: the board holds for his fall (`fall`, phase 2's, `toPhase2`), then his phase 2 for the top 4 (Nov 13: as his room's fight); its boards decide it", () => {
    const L = crowdFinal();
    // Scholar's mate: the crowd (White) plays it, everyone picking it; the host plays his replies into it.
    L.script = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]).filter((_, i) => i % 2 === 0);
    L.bossScript = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"]).filter((_, i) => i % 2 === 1);
    let fall: Extract<Msg, { t: "boss" }> | undefined;
    for (let i = 0; i < 2000 && !fall; i++) {
      L.step();
      fall = L.all("p2", "boss").find((m) => m.fall);
    }
    expect(fall).toBeTruthy();
    expect(fall!.boss.result).toBe("crowd");
    // (Not the results: his phase change follows, after phase 2's shorter fall.)
    expect(fall!.toPhase2).toBe(true);
    expect(fall!.until - fall!.now).toBe(RECLUSE_PHASE2.change.fallMs);
    expect(L.core.record.phase).toBe("boss");
    for (let i = 0; i < 10 && L.core.record.phase === "boss"; i++) L.advance(1000);
    expect(L.core.record.phase).toBe("phase2");
    const p2 = L.last("p2", "phase2")!.p2;
    // The top 4 on its four boards (the two people among them: everyone reached the final here), the same view for everyone.
    expect(p2.boards).toHaveLength(RECLUSE_PHASE2.boards);
    expect(new Set(p2.boards.map((b) => b.player)).size).toBe(RECLUSE_PHASE2.boards);
    expect(L.last("p1", "phase2")!.p2.clocksAt).toBe(p2.clocksAt);
    // Nobody moves (the host's device is asked for his and the bots' moves and never answers: the server's quick moves): every
    // board runs out of time, so he wins, and the results say how many of the four were won.
    for (let i = 0; i < 2000 && L.core.record.phase !== "results"; i++) L.advance(1000);
    expect(L.core.record.phase).toBe("results");
    const res = L.last("p2", "results")!;
    expect(res.bossResult).toBe("boss");
    expect(res.simul).toEqual({ won: 0, of: 4 });
    expect(res.now).toBeGreaterThanOrEqual(p2.clocksAt);
  });

  it("no result in phase 2 (his move never came from the engine server): its board players' results none; a watcher's stands at their place, the boss's part none (the review of #683, M3)", () => {
    const searches: { id: string; boss?: true }[] = [];
    // (Bo picks the worst move all along: cut early, Bo watches the final. An engine server that never answers.)
    const L = crowdFinal({}, 7, { worst: ["p2"], io: { phase2Search: (req) => void searches.push(req), warmEngine: () => undefined } });
    L.script = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]).filter((_, i) => i % 2 === 0);
    L.bossScript = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"]).filter((_, i) => i % 2 === 1);
    for (let i = 0; i < 2000 && L.core.record.phase !== "phase2"; i++) L.step();
    expect(L.core.record.phase).toBe("phase2");
    const p2 = L.core.record.recluse2!;
    expect(Object.keys(p2.names)).toContain("p1");
    expect(Object.keys(p2.names)).not.toContain("p2");
    for (let i = 0; i < 2000 && L.core.record.phase !== "results"; i++) L.advance(1000);
    expect(L.core.record.phase).toBe("results");
    expect(p2.done ?? L.core.record.recluse2!.done).toMatchObject({ noResult: true });
    expect(searches.some((s) => s.boss)).toBe(true);
    // (Ann played a board: nothing counts. Bo watched: Bo's place stands, ranked as the match is; the boss's part is nobody's.)
    expect(L.last("p1", "results")).toMatchObject({ noResult: "board", ranked: false, bossResult: "draw" });
    const bo = L.last("p2", "results")!;
    expect(bo).toMatchObject({ noResult: "watched", bossResult: "draw", ranked: L.core.ranked() });
    const results = L.core.humanResults();
    const ann = results.find((r) => r.playerId === "p1")!;
    const boRow = results.find((r) => r.playerId === "p2")!;
    expect(ann).toMatchObject({ noResult: true, ranked: false, teamWon: null });
    expect(boRow.noResult).toBeUndefined();
    expect(boRow.teamWon).toBeNull();
    expect(boRow.placement).toBe(L.core.record.placements["p2"]);
    expect(boRow.placement).toBeGreaterThan(crowdFinalists("boss"));
  });

  it("the child first (Nov 13; the review of the child form online, m3): mated, his fall (not phase 2's), then one new match against the man from the start, at the man's strength; mated, phase 2, the results", () => {
    const L = crowdFinal({ recluseChild: true });
    expect(L.last("p2", "boss")!.boss).toMatchObject({ form: "child", formStep: 0 });
    expect(L.last("p2", "boss")!.boss.powers).toBeUndefined();
    // (The host's Maia loaded: his moves go out as Maia's, with their rating.)
    L.core.message(L.core.record.hostId!, { t: "maiaReady" });
    // Scholar's mate on each, the crowd White; the host plays his replies into it.
    L.script = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]).filter((_, i) => i % 2 === 0);
    L.bossScript = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"]).filter((_, i) => i % 2 === 1);
    let fall: Extract<Msg, { t: "boss" }> | undefined;
    for (let i = 0; i < 2000 && !fall; i++) (L.step(), (fall = L.all("p2", "boss").find((m) => m.fall)));
    expect(fall!.boss).toMatchObject({ form: "child", result: "crowd" });
    expect(fall!.toPhase2).toBeUndefined();
    expect(fall!.until - fall!.now).toBe(RECLUSE_CHILD.fallMs);
    // (The child's moves at his rating as it rises, Maia's and Stockfish's stand-in alike: the host and its checker play the same.)
    const plyOf = (fen: string) => { const [, side, , , , full] = fen.split(" "); return (Number(full) - 1) * 2 + (side === "b" ? 1 : 0); };
    const childAsked = [...L.bossRequests];
    expect(childAsked.length).toBeGreaterThanOrEqual(3);
    for (const a of childAsked) {
      expect(a.brain?.rating).toBe(childRating(plyOf(a.fen)));
      expect(a.elo).toBe(levelForMaia(childRating(plyOf(a.fen))));
    }
    expect(childAsked[0]!.brain!.rating).toBe(RECLUSE_CHILD.startRating);
    let fall2: Extract<Msg, { t: "boss" }> | undefined;
    for (let i = 0; i < 3000 && !fall2; i++) (L.step(), (fall2 = L.all("p2", "boss").find((m) => m.fall && !m.boss.form)));
    // (One new match, one intro: the man's, from the start.)
    expect(L.all("p2", "boss").filter((m) => m.intro).map((m) => m.boss.form ?? "adult")).toEqual(["child", "adult"]);
    const manAsked = L.bossRequests.slice(childAsked.length);
    expect(manAsked[0]!.fen.split(" ")[5]).toBe("1");
    for (const a of manAsked) expect(a).toMatchObject({ elo: fixedLevel(), brain: { rating: maiaTopRating() } });
    expect(fall2!.toPhase2).toBe(true);
    for (let i = 0; i < 20 && L.core.record.phase === "boss"; i++) L.advance(1000);
    expect(L.core.record.phase).toBe("phase2");
    for (let i = 0; i < 2000 && L.core.record.phase !== "results"; i++) L.advance(1000);
    const res = L.last("p2", "results")!;
    expect(res.bossResult).toBe("boss");
    expect(Object.keys(res.placements)).toHaveLength(100);
  });

  it("the man's intro after the child's tells no more devices to load Maia: those told at the child's intro stand (the review of the child form online, n1)", () => {
    const L = crowdFinal({ recluseChild: true });
    L.core.message(L.core.record.hostId!, { t: "maiaReady" });
    L.script = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]).filter((_, i) => i % 2 === 0);
    L.bossScript = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"]).filter((_, i) => i % 2 === 1);
    for (let i = 0; i < 2000 && !L.all("p2", "boss").some((m) => m.fall); i++) L.step();
    // (In his fall, Bo's phone comes back able to check, its Maia saved: one the man's intro would have told to load it.)
    const bo = L.core.record.humans.find((h) => h.id === "p2")!;
    expect(bo.id).not.toBe(L.core.record.hostId);
    L.core.connect(bo.token, "Bo", "phone", false, null, undefined, undefined, null, null, false, {}, true);
    L.core.message("p2", { t: "speed", nps: 300_000, maiaSaved: true });
    const told = () => L.all("p2", "bossBrain").filter((m) => m.check).length;
    expect(told()).toBe(0);
    for (let i = 0; i < 100 && !L.all("p2", "boss").some((m) => m.intro && !m.boss.form); i++) L.advance(1000);
    expect(L.all("p2", "boss").filter((m) => m.intro).map((m) => m.boss.form ?? "adult")).toEqual(["child", "adult"]);
    expect(told()).toBe(0);
  });
});
