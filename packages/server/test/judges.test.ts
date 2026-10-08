import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, JUDGES, modeSettings, mulberry32, type JudgeConfig, type Settings } from "@chessroyale/core";
import { deepCheck, judgedBoard, legalMoves, runJudgeJob, runQuickJob, sanLineToUci, type EngineLike, type JudgeJob, type JudgeReport, type MoveScore, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord, type ServerScoreRequest } from "../src/lobby.ts";
import { assignJudges, cutBubble, drawJudges, seedFor } from "../src/judges.ts";

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
  unusual: false,
  moves: line,
  namedPlies: 21,
  expected: Object.fromEntries(Array.from({ length: 22 }, (_, n) => [n, 0.5])),
}));

/** The honest engine: each move's score a hash of the position and the move. */
const truth = (fen: string, m: string) => 0.3 + 0.4 * hash(fen + m);
const honest: EngineLike = {
  topMoves: async (fen, n) =>
    legalMoves(fen)
      .map((move) => ({ move, expected: truth(fen, move) }))
      .sort((a, b) => b.expected - a.expected)
      .slice(0, n),
  scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: truth(fen, move) })),
  scoreMovesAt: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: truth(fen, move) })),
};
/** The engine server: the truth, with a little noise (a deeper search never matches a phone's exactly). */
const deep = (fen: string, moves: readonly string[]): MoveScore[] => moves.map((move) => ({ move, expected: Math.min(1, truth(fen, move) + 0.01 * (hash("d" + move) - 0.5)) }));
/** A cheater: its own pick (it knows it) scored as good as the best. */
function cheat(own: string | undefined): (job: JudgeJob, r: JudgeReport) => JudgeReport {
  return (job, r) => {
    const best = Math.max(...r.top.map((m) => m.expected));
    const lift = (list: MoveScore[]) => list.map((m) => (m.move === own ? { ...m, expected: best } : m));
    return { ...r, top: lift(r.top), extra: lift(r.extra), ...(r.deep ? { deep: lift(r.deep) } : {}) };
  };
}

type Msg = ServerMessage;

function setup(opts: { judges?: Partial<JudgeConfig>; server?: boolean; settings?: Partial<Settings> } = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const serverAsks: ServerScoreRequest[] = [];
  const core = new LobbyCore(
    newLobbyRecord("JUDGE", now),
    {
      now: () => now,
      send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]),
      judges: { ...JUDGES, ...opts.judges },
      judgeRng: mulberry32(3),
      serverEngine: !!opts.server,
      serverScore: (req) => void serverAsks.push(req),
    },
    library,
    mulberry32(7),
    // Crowd, everyone moves: one board, every person picks every move.
    { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { crowdTeams: false, augments: false }), roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...opts.settings },
  );
  const take = (id: string, t: Msg["t"]) => {
    const all = inbox.get(id) ?? [];
    inbox.set(id, all.filter((m) => m.t !== t));
    return all.filter((m) => m.t === t);
  };
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const advance = (ms: number) => {
    now += ms;
    while (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  /** A device answers its judge jobs (honestly unless `lie` changes the report). */
  const answer = async (id: string, lie?: (job: JudgeJob, r: JudgeReport) => JudgeReport) => {
    const jobs = (take(id, "judge") as Extract<Msg, { t: "judge" }>[]).flatMap((m) => m.jobs.map((job) => ({ job, key: m.key })));
    for (const { job, key } of jobs) {
      const r = await runJudgeJob(honest, job);
      core.message(id, { t: "judged", key, id: job.id, report: lie ? lie(job, r) : r });
    }
    return jobs.length;
  };
  /**
   * A device answers its jobs as today's app does: the quick part, then (if the job carries one) its re-check.
   * `deepLie` changes the re-check; `noDeep` never sends it.
   */
  const answerSplit = async (id: string, opts: { deepLie?: (d: MoveScore[]) => MoveScore[]; noDeep?: boolean } = {}) => {
    const jobs = (take(id, "judge") as Extract<Msg, { t: "judge" }>[]).flatMap((m) => m.jobs.map((job) => ({ job, key: m.key })));
    for (const { job, key } of jobs) {
      const quick = await runQuickJob(honest, job);
      core.message(id, { t: "judged", key, id: job.id, report: quick });
      const deep = opts.noDeep ? null : await deepCheck(honest, job, quick);
      if (deep) core.message(id, { t: "judgedDeep", key, id: job.id, deep: opts.deepLie ? opts.deepLie(deep) : deep });
    }
    return jobs.map((j) => j.job);
  };
  /** The engine server answers what it was asked (null: it's down). */
  const serve = (down = false) => {
    for (const req of serverAsks.splice(0)) core.serverScored(req.id, down ? null : deep(req.fen, req.moves));
  };
  /** n people join (each reporting its speed unless `old`), the match starts, the first round begins. */
  const begin = (n: number, nps: number[] = [], old: number[] = [], computers: number[] = [0]) => {
    for (let i = 0; i < n; i++) {
      core.connect(undefined, `P${i + 1}`, computers.includes(i) ? "computer" : "phone");
      if (!old.includes(i)) core.message(`p${i + 1}`, { t: "speed", nps: nps[i] ?? 400_000 });
    }
    core.message("p1", { t: "start" });
    for (let i = 0; i < 40 && core.record.phase !== "play"; i++) advance(1000);
    expect(core.record.phase).toBe("play");
  };
  /** Everyone picks: the first legal move unless told otherwise. */
  const pickAll = (n: number, moves: Record<string, string> = {}) => {
    for (let i = 1; i <= n; i++) {
      const id = `p${i}`;
      const r = last(id, "round");
      if (!r?.board || r.watching) continue;
      core.message(id, { t: "pick", key: r.key, move: moves[id] ?? legalMoves(r.board.fen)[0]! });
    }
  };
  const judgesOf = () => Object.values(core.record.judges?.tasks ?? {})[0]?.judges ?? [];
  return { core, take, last, advance, answer, answerSplit, serve, begin, pickAll, judgesOf, serverAsks, inbox, get now() { return now; } };
}

describe("many judges: the lobby", () => {
  it("helpers: draws favour fast devices, never repeat, spread the load; the cut bubble; stable seeds", () => {
    const rng = mulberry32(1);
    const devices = [{ id: "pc", nps: 1_500_000 }, { id: "phone", nps: 250_000 }, { id: "old", nps: 120_000 }];
    const counts: Record<string, number> = { pc: 0, phone: 0, old: 0 };
    for (let i = 0; i < 2000; i++) {
      const two = drawJudges(rng, devices, 2, JUDGES);
      expect(new Set(two).size).toBe(2);
      for (const j of two) counts[j]!++;
    }
    expect(counts.pc).toBeGreaterThan(counts.phone!);
    expect(counts.phone).toBeGreaterThan(counts.old!);
    const plan = assignJudges(rng, Array.from({ length: 8 }, (_, i) => ({ boardId: i, cost: 8 })), devices, 2, JUDGES);
    expect([...plan.values()].every((j) => j.length === 2)).toBe(true);
    const per = [...plan.values()].flat().reduce<Record<string, number>>((a, j) => ({ ...a, [j]: (a[j] ?? 0) + 1 }), {});
    expect(Object.keys(per)).toHaveLength(3);
    const st = [10, 8, 6, 5, 4, -20].map((points, i) => ({ id: `x${i}`, points, out: false }));
    expect([...cutBubble(st, 3, 1)].sort()).toEqual(["x2", "x3"]);
    expect(cutBubble(st, 0, 5).size).toBe(0);
    expect(seedFor("1-1-5", 0)).toBe(seedFor("1-1-5", 0));
    expect(seedFor("1-1-5", 0)).not.toBe(seedFor("1-1-6", 0));
  });

  it("two honest judges agree: their numbers are used, nobody else is asked, and the host isn't sent the old score request", async () => {
    const L = setup();
    L.begin(3, [1_000_000, 300_000, 300_000]);
    // The round's judges were drawn as it started, and told to search the board while players think.
    const plan = L.core.record.judges!.plan!;
    const planned = Object.values(plan.byBoard)[0]!;
    expect(planned).toHaveLength(2);
    for (const id of planned) expect(L.last(id, "prefetch")?.plan?.seed).toBeTypeOf("number");
    L.pickAll(3);
    expect(L.core.record.phase).toBe("scoring");
    expect(L.last("p1", "scoreRequest")).toBeUndefined();
    expect(L.judgesOf()).toEqual(planned);
    // The job names nobody.
    const job = L.last(planned[0]!, "judge")!.jobs[0]!;
    expect(JSON.stringify(job)).not.toMatch(/"p\d"/);
    expect(job.picks).toHaveLength(3);
    for (const id of planned) await L.answer(id);
    expect(L.core.record.phase).toBe("reveal");
    const rev = L.last("p3", "reveal")!;
    expect(rev.judged).toBe(true);
    for (const [m, e] of Object.entries(rev.expectedAfter)) expect(e).toBeCloseTo(truth(job.fen, m), 9);
    expect(L.core.record.judges!.stats).toMatchObject({ jobs: 1, agreed: 1, disagreed: 0, serverVerdict: 0, strikes: 0 });
    expect(L.serverAsks).toHaveLength(0);
  });

  it("a cheater on one of two judges never changes the result: the server's verdict (or two of three devices, if sooner) decides, and the cheater is struck, then benched", async () => {
    const L = setup({ server: true, settings: { firstStageRounds: 12 } });
    L.begin(3, [1_000_000, 900_000, 800_000]);
    let rounds = 0;
    for (let i = 0; i < 400 && rounds < 8 && L.core.record.judges!.devices.p1!.strikes < 2 && L.core.record.phase !== "results"; i++) {
      if (L.core.record.phase !== "play") {
        L.advance(500);
        continue;
      }
      const r = L.last("p1", "round")!;
      if (!r.board) break; // p1 is out
      const fen = r.board.fen;
      // p1 (the fastest, so often a judge) picks a middling move and scores it as the best.
      const ranked = legalMoves(fen).sort((a, b) => truth(fen, b) - truth(fen, a));
      const mine = ranked[4]!;
      L.pickAll(3, { p1: mine });
      const judges = L.judgesOf();
      for (const id of judges) await L.answer(id, id === "p1" ? cheat(mine) : undefined);
      L.serve();
      // Any second opinion (the third device) answers honestly; then the server's re-check or verdict.
      for (const id of ["p1", "p2", "p3"].filter((x) => !judges.includes(x))) await L.answer(id);
      L.serve();
      expect(L.core.record.phase).toBe("reveal");
      const rev = L.last("p2", "reveal")!;
      const p1 = rev.picks.find((p) => p.playerId === "p1")!;
      // Never the cheater's number: p1's pick keeps its true loss (to within the server's noise).
      const best = Math.max(...Object.values(rev.expectedAfter));
      expect(p1.loss!).toBeGreaterThan(1);
      expect(Math.abs(p1.loss! - (best - truth(fen, mine)) * 100)).toBeLessThan(1.5);
      rounds++;
    }
    const stats = L.core.record.judges!.stats;
    expect(rounds).toBeGreaterThanOrEqual(2);
    expect(L.core.record.judges!.devices.p1!.strikes).toBe(2);
    expect(stats.benched).toBe(1);
    expect(stats.disagreed).toBe(stats.serverVerdict);
    expect(L.core.record.judges!.devices.p2!.strikes + L.core.record.judges!.devices.p3!.strikes).toBe(0);
  });

  it("with only two devices and no engine server, a disagreement falls back to the more trusted judge, and the round goes on", async () => {
    const L = setup({ server: false });
    L.begin(2, [1_000_000, 300_000]);
    L.pickAll(2);
    const job = L.last("p1", "judge")!.jobs[0]!;
    expect(job.recheck).toBeTruthy(); // no server: the devices re-check close calls themselves
    await L.answer("p1");
    await L.answer("p2", cheat(job.picks[0]));
    expect(L.core.record.phase).toBe("reveal");
    expect(L.core.record.judges!.stats).toMatchObject({ disagreed: 1, fallback: 1, serverVerdict: 0 });
  });

  it("with no engine server, a disagreement waits for a third device: two of three decide, and the odd one out is struck", async () => {
    const L = setup({ server: false });
    L.begin(3);
    L.pickAll(3);
    const [liar, honestOne] = L.judgesOf() as [string, string];
    const job = L.last(liar, "judge")!.jobs[0]!;
    const worst = [...job.picks].sort((x, y) => truth(job.fen, x) - truth(job.fen, y))[0]!;
    await L.answer(liar, cheat(worst));
    await L.answer(honestOne);
    expect(L.core.record.phase).toBe("scoring");
    const third = ["p1", "p2", "p3"].find((x) => x !== liar && x !== honestOne)!;
    await L.answer(third);
    expect(L.core.record.phase).toBe("reveal");
    expect(L.core.record.judges!.stats).toMatchObject({ disagreed: 1, majority: 1, fallback: 0 });
    expect(L.core.record.judges!.devices[liar]!.strikes).toBe(1);
    const rev = L.last(third, "reveal")!;
    expect(rev.expectedAfter[worst]).toBeCloseTo(truth(job.fen, worst), 9);
  });

  it("a late judge: the first answer is used after the grace time; the late answer is still compared, and a judge that never answers brings a spot check now and then", async () => {
    const L = setup({ server: true, judges: { spotCheckShare: 1, graceMs: 300, graceFactor: 0.5 } });
    L.begin(4);
    L.pickAll(4);
    const [first, late] = L.judgesOf() as [string, string];
    L.advance(1000);
    await L.answer(first);
    expect(L.core.record.phase).toBe("scoring");
    // Grace: the longer of 300 ms and half the first's time (500 ms).
    L.advance(450);
    expect(L.core.record.phase).toBe("scoring");
    L.advance(100);
    L.serve(); // (any re-check of close calls)
    expect(L.core.record.phase).toBe("reveal");
    expect(L.core.record.judges!.stats).toMatchObject({ single: 1, serverSpot: 0 });
    // The late answer arrives after all: compared (it agrees), and the reveal stands.
    expect(await L.answer(late)).toBe(1);
    expect(L.core.record.judges!.stats.lateAgreed).toBe(1);
    expect(L.core.record.phase).toBe("reveal");
    // Next round: the late judge drops out without answering: a spot check (share 1 here) on the one answer used.
    for (let i = 0; i < 60 && L.core.record.phase !== "play"; i++) L.advance(500);
    L.pickAll(4);
    const [f2, l2] = L.judgesOf() as [string, string];
    L.advance(1000);
    await L.answer(f2);
    L.advance(600);
    L.serve();
    expect(L.serverAsks.some((r) => r.id.startsWith("spot:"))).toBe(false);
    L.core.disconnect(l2);
    expect(L.serverAsks.some((r) => r.id.startsWith("spot:"))).toBe(true);
    L.serve();
    expect(L.core.record.judges!.stats.serverSpot).toBe(1);
  });

  it("a cheater whose honest partner was late is caught when the late answer comes", async () => {
    const L = setup({ server: true, judges: { spotCheckShare: 0 } });
    L.begin(3);
    L.pickAll(3);
    const [liar, honestOne] = L.judgesOf() as [string, string];
    const job = L.last(liar, "judge")!.jobs[0]!;
    // The liar lifts the worst pick to the best.
    const worst = [...job.picks].sort((x, y) => truth(job.fen, x) - truth(job.fen, y))[0]!;
    await L.answer(liar, cheat(worst));
    L.advance(5000);
    L.serve(); // (any re-check of close calls)
    expect(L.core.record.phase).not.toBe("scoring");
    await L.answer(honestOne);
    expect(L.core.record.judges!.stats.lateDisagreed).toBe(1);
    // The third device's second opinion, and the server, settle the blame.
    for (const id of ["p1", "p2", "p3"]) await L.answer(id);
    L.serve();
    expect(L.core.record.judges!.devices[liar]!.strikes).toBe(1);
    expect(L.core.record.judges!.devices[honestOne]!.strikes).toBe(0);
  });

  it("a device with a strike is never trusted alone: the job waits for its partner; a benched host stops hosting", async () => {
    const L = setup({ server: false });
    L.begin(3);
    L.pickAll(3);
    const [a, b] = L.judgesOf() as [string, string];
    L.core.record.judges!.devices[a]!.strikes = 1;
    await L.answer(a);
    L.advance(3000);
    expect(L.core.record.phase).toBe("scoring");
    await L.answer(b);
    expect(L.core.record.phase).toBe("reveal");
    expect(L.core.record.judges!.stats.agreed).toBe(1);
    // Benched devices: the host's work goes to someone else.
    for (const id of ["p1", "p2"]) L.core.record.judges!.devices[id]!.strikes = 2;
    for (let i = 0; i < 60 && L.core.record.phase !== "play"; i++) L.advance(500);
    L.pickAll(3);
    expect(L.last("p3", "scoreRequest")).toBeTruthy();
  });

  it("a judge that drops before answering is replaced; one whose answer doesn't hold together is struck and replaced", async () => {
    const L = setup();
    L.begin(4);
    L.pickAll(4);
    const [a, b] = L.judgesOf() as [string, string];
    L.core.disconnect(a);
    const now = L.judgesOf();
    expect(now).not.toContain(a);
    expect(now).toHaveLength(2);
    const fresh = now.find((x) => x !== b)!;
    await L.answer(b, (_job, r) => ({ ...r, top: [] }));
    expect(L.core.record.judges!.devices[b]!.strikes).toBe(1);
    expect(L.core.record.phase).toBe("scoring");
    for (const id of L.judgesOf()) await L.answer(id);
    expect(L.core.record.phase).toBe("reveal");
    expect(L.judgesOf()).toEqual([]);
    expect(fresh).toBeTruthy();
    expect(L.core.record.judges!.stats.replaced).toBeGreaterThanOrEqual(2);
  });

  it("one device that can judge (or an old app that never reported its speed): the host scores as before", () => {
    const L = setup();
    L.begin(2, [], [1]);
    L.pickAll(2);
    expect(L.last("p1", "scoreRequest")).toBeTruthy();
    expect(L.last("p1", "judge")).toBeUndefined();
    const solo = setup();
    solo.begin(1);
    solo.pickAll(1);
    expect(solo.last("p1", "scoreRequest")).toBeTruthy();
  });

  it("the switch: judges off, the host scores", () => {
    const L = setup({ judges: { on: false } });
    L.begin(3);
    L.pickAll(3);
    expect(L.last("p1", "scoreRequest")).toBeTruthy();
    expect(L.core.record.judges?.tasks).toBeUndefined();
  });

  it("the host can't slip its own scores in while judges are at work", async () => {
    const L = setup();
    L.begin(3);
    L.pickAll(3);
    const key = L.core.record.round!.key;
    L.core.message("p1", { t: "scores", key, boards: [{ boardId: 0, bestMove: "a2a3", bestExpected: 0.5, expectedAfter: {}, botPicks: {}, botThinkMs: {} }] });
    expect(L.core.record.phase).toBe("scoring");
    for (const id of L.judgesOf()) await L.answer(id);
    expect(L.core.record.phase).toBe("reveal");
  });

  it("a Crowd bot plan that doesn't follow from the seed earns its sender a strike", async () => {
    const L = setup();
    L.begin(3);
    const prefetch = Object.values(L.core.record.judges!.plan!.byBoard)[0]!;
    const sender = prefetch[0]!;
    const plan = L.last(sender, "prefetch")!.plan!;
    const r = L.last(sender, "round")!;
    const wrong = Object.fromEntries(plan.bots.map((b) => [b.id, legalMoves(r.board!.fen).at(-1)!]));
    L.core.message(sender, { t: "botPlan", key: plan.key, picks: wrong, powerUps: [] });
    L.pickAll(3);
    for (const id of L.judgesOf()) await L.answer(id);
    expect(L.core.record.phase).toBe("reveal");
    expect(L.core.record.judges!.devices[sender]!.strikes).toBe(plan.bots.length ? 1 : 0);
  });

  it("judgedBoard on a report from the honest stand-in holds together (sanity for the fakes above)", async () => {
    const j: JudgeJob = { id: "x", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", picks: ["e2e4"], bots: [{ skill: 4, powerUps: 0 }], seed: 1, rules: { botCandidateMoves: 8, botRandomMoveChance: 0.02, botPowerUpLoss: 15 } };
    expect(judgedBoard(j, await runJudgeJob(honest, j))).toBeTruthy();
  });
});

describe("deep checks on players' computers (the switch on)", () => {
  const on = { deepOnDevices: true };
  /** A deep search that never matches a phone's exactly (as two different devices' re-checks would if one lied). */
  const off = (d: MoveScore[]) => d.map((m, i) => (i === d.length - 1 ? { ...m, expected: Math.max(0, m.expected - 0.2) } : m));

  it("two capable computers judge and re-check the close calls themselves: no engine server at all", async () => {
    const L = setup({ server: true, judges: on });
    L.begin(4, [1_000_000, 900_000, 300_000, 300_000], [], [0, 1]);
    L.pickAll(4, { p3: legalMoves(L.last("p3", "round")!.board!.fen)[5]!, p4: legalMoves(L.last("p4", "round")!.board!.fen)[9]! });
    expect([...L.judgesOf()].sort()).toEqual(["p1", "p2"]);
    const job = L.last("p1", "judge")!.jobs[0]!;
    // The depth both fit in 3 s with headroom: the slower does 900k x 0.85 x 3 = 2.3M, so the server's 2M.
    expect(job.recheck?.recheckNodes).toBe(2_000_000);
    for (const id of ["p1", "p2"]) await L.answerSplit(id);
    expect(L.core.record.phase).toBe("reveal");
    expect(L.serverAsks).toHaveLength(0);
    const st = L.core.record.judges!.stats;
    expect(st.deepJobs).toBe(1);
    expect(st.serverRecheck).toBe(0);
    if (st.deepAgreed) expect(L.last("p3", "reveal")!.judged).toBe(true);
  });

  it("the node count follows the slower computer: 500k nodes/s fits 1.2M in the window", () => {
    const L = setup({ server: true, judges: on });
    L.begin(3, [500_000, 2_000_000, 300_000], [], [0, 1]);
    L.pickAll(3);
    expect(L.last("p1", "judge")!.jobs[0]!.recheck?.recheckNodes).toBe(1_200_000);
  });

  it("phones never re-check, however fast; with one capable computer the engine server re-checks as before", async () => {
    const L = setup({ server: true, judges: on });
    L.begin(3, [1_000_000, 3_000_000, 3_000_000], [], [0]);
    L.pickAll(3);
    const job = L.last(L.judgesOf()[0]!, "judge")!.jobs[0]!;
    expect(job.recheck).toBeUndefined();
    expect(L.core.record.judges!.stats.deepJobs).toBe(0);
  });

  it("re-checks that disagree: the engine server re-checks, and the device further from it is struck", async () => {
    const L = setup({ server: true, judges: on });
    L.begin(4, [1_000_000, 1_000_000, 300_000, 300_000], [], [0, 1]);
    // Picks that are close calls, so there's something to re-check.
    const fen = L.last("p1", "round")!.board!.fen;
    const ranked = legalMoves(fen).sort((a, b) => truth(fen, b) - truth(fen, a));
    L.pickAll(4, { p1: ranked[3]!, p2: ranked[4]!, p3: ranked[5]!, p4: ranked[6]! });
    await L.answerSplit("p1");
    await L.answerSplit("p2", { deepLie: off });
    const st = L.core.record.judges!.stats;
    if (!st.deepJobs || L.core.record.phase === "reveal") return; // (nothing to re-check in this position)
    expect(st.deepDisagreed).toBe(1);
    expect(L.serverAsks.map((r) => r.id)).toEqual([expect.stringMatching(/^recheck:/)]);
    L.serve();
    expect(L.core.record.phase).toBe("reveal");
  });

  it("re-checks that don't come in time: the engine server re-checks", async () => {
    const L = setup({ server: true, judges: on });
    L.begin(4, [1_000_000, 1_000_000, 300_000, 300_000], [], [0, 1]);
    const fen = L.last("p1", "round")!.board!.fen;
    const ranked = legalMoves(fen).sort((a, b) => truth(fen, b) - truth(fen, a));
    L.pickAll(4, { p1: ranked[3]!, p2: ranked[4]!, p3: ranked[5]!, p4: ranked[6]! });
    await L.answerSplit("p1");
    await L.answerSplit("p2", { noDeep: true });
    if (L.core.record.phase === "reveal") return; // (nothing to re-check)
    expect(L.serverAsks).toHaveLength(0);
    L.advance(JUDGES.deepWaitMs + 10);
    expect(L.core.record.judges!.stats.deepLate).toBe(1);
    expect(L.serverAsks.map((r) => r.id)).toEqual([expect.stringMatching(/^recheck:/)]);
    L.serve();
    expect(L.core.record.phase).toBe("reveal");
  });

  it("a knocked-out player's device keeps judging (and re-checking) while its page is open", async () => {
    const L = setup({ server: true, judges: on, settings: { firstStageRounds: 20 } });
    L.begin(3, [1_000_000, 1_000_000, 1_000_000], [], [0, 1, 2]);
    // p3 is out of the match (its page stays open, watching).
    const runner = (L.core as unknown as { runner: { state: { players: { id: string; alive: boolean }[] } } }).runner;
    runner.state.players.find((p) => p.id === "p3")!.alive = false;
    let judged = false;
    let lastKey = "";
    for (let round = 0; round < 12 && !judged; round++) {
      for (let i = 0; i < 120 && !(L.core.record.phase === "play" && L.core.record.round?.key !== lastKey); i++) L.advance(250);
      lastKey = L.core.record.round!.key;
      L.pickAll(3);
      if (round > 0) {
        expect(L.last("p3", "round")?.board ?? null).toBeNull();
        judged = L.judgesOf().includes("p3");
      }
      for (const id of L.judgesOf()) await L.answerSplit(id);
      L.serve();
    }
    expect(judged).toBe(true);
  });

  it("a disagreement with three capable devices: two of three settle score and strike before the server's verdict comes (asked at once, so never slower)", async () => {
    const L = setup({ server: true });
    L.begin(4, [1_000_000, 1_000_000, 1_000_000, 300_000], [], [0, 1, 2]);
    L.pickAll(4);
    const [liar, honestOne] = L.judgesOf() as [string, string];
    const job = L.last(liar, "judge")!.jobs[0]!;
    const worst = [...job.picks].sort((x, y) => truth(job.fen, x) - truth(job.fen, y))[0]!;
    await L.answer(liar, cheat(worst));
    await L.answer(honestOne);
    expect(L.core.record.phase).toBe("scoring");
    const third = ["p1", "p2", "p3"].find((x) => x !== liar && x !== honestOne)!;
    await L.answerSplit(third);
    L.serve();
    expect(L.core.record.phase).toBe("reveal");
    expect(L.core.record.judges!.stats).toMatchObject({ majority: 1, serverVerdict: 1 });
    expect(L.core.record.judges!.devices[liar]!.strikes).toBe(1);
    expect(L.last(third, "reveal")!.expectedAfter[worst]).toBeLessThan(truth(job.fen, worst) + 0.02);
  });

  it("two humans left, both judging their own picks: an honest pair agrees", async () => {
    const L = setup({ server: false });
    L.begin(2, [1_000_000, 300_000]);
    L.pickAll(2);
    expect([...L.judgesOf()].sort()).toEqual(["p1", "p2"]);
    for (const id of ["p1", "p2"]) await L.answerSplit(id);
    expect(L.core.record.phase).toBe("reveal");
    expect(L.core.record.judges!.stats.agreed).toBe(1);
  });
});
