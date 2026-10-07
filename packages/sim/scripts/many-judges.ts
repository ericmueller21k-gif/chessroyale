/**
 * Many judges, tested against liars: the real lobby logic (LobbyCore) runs whole online Crowd matches with simulated
 * devices, scored by real Stockfish (the Node transport, the same lite build the browsers run). Devices can be honest,
 * slow, dropping out, or cheating:
 *   - inflate: scores its own pick as good as the best move
 *   - noise:   adds random noise (about 3 points) to every score
 *   - rubber:  answers without looking: every move as good as the best ("always agree")
 *   - lazy:    answers from a tiny search (5k nodes) instead of the real one
 * Cheaters also claim to be very fast (3M nodes/s), so they're drawn as judges as often as possible.
 * The engine server is the full-network build (a stand-in for the container's Stockfish 17.1), answering after the
 * time the real one takes. Every scenario also runs the old way (one host scores) for comparison.
 *
 * Time is simulated: the lobby's clock jumps from event to event, and a device's answer arrives after the time its
 * searches would take at its speed (nodes / nodes per second), so the round timings are what players would see.
 *
 *   npx tsx packages/sim/scripts/many-judges.ts run <scenario|all> <seeds> [firstSeed]
 *   npx tsx packages/sim/scripts/many-judges.ts summary
 */
import { DEFAULT_SETTINGS, JUDGES, modeSettings, mulberry32, type JudgeConfig, type Settings } from "@chessroyale/core";
import {
  applyRecheck,
  judgedBoard,
  legalMoves,
  recheckTargets,
  runJudgeJob,
  type BoardScore,
  type JudgedBoard,
  type JudgeJob,
  type JudgeReport,
  type MoveScore,
  type Opening,
  type ScoreJob,
  type ServerMessage,
  type UciEngine,
} from "@chessroyale/chess";
import { STOCKFISH_FULL_BUILD, createNodeEngine } from "@chessroyale/chess/node";
import { LobbyCore, newLobbyRecord, type ServerScoreRequest } from "../../server/src/lobby.ts";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = root + "reports/many-judges/";
const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];

type Kind = "honest" | "slow" | "drop" | "inflate" | "noise" | "rubber" | "lazy";
const CHEATS: Kind[] = ["inflate", "noise", "rubber", "lazy"];
interface DeviceSpec {
  kind: Kind;
  /** Real speed (nodes/s in the browser's lite build): a computer about 1.1M, a phone 350k, an old phone 90k. */
  nps: number;
}
interface Scenario {
  name: string;
  devices: DeviceSpec[];
  server: boolean;
  /** Judges' settings for this scenario (else JUDGES). */
  judges?: Partial<JudgeConfig>;
}

const pc = (kind: Kind = "honest"): DeviceSpec => ({ kind, nps: 1_100_000 });
const phone = (kind: Kind = "honest"): DeviceSpec => ({ kind, nps: 350_000 });
const SCENARIOS: Scenario[] = [
  { name: "honest", devices: [pc(), pc(), phone(), phone(), phone(), phone()], server: true },
  { name: "inflate", devices: [pc("inflate"), pc(), phone(), phone(), phone(), phone()], server: true },
  { name: "noise", devices: [pc("noise"), pc(), phone(), phone(), phone(), phone()], server: true },
  { name: "rubber", devices: [pc("rubber"), pc(), phone(), phone(), phone(), phone()], server: true },
  { name: "lazy", devices: [phone("lazy"), pc(), phone(), phone(), phone(), phone()], server: true },
  { name: "flaky", devices: [pc("inflate"), pc(), phone(), phone("drop"), phone("drop"), { kind: "slow", nps: 90_000 }], server: true },
  { name: "pair", devices: [pc("inflate"), phone()], server: true },
  { name: "no-server", devices: [pc("inflate"), pc(), phone(), phone(), phone(), phone()], server: false },
];

/** The engine server's time for one search (2M nodes at about 700k nodes/s on one core), shared by the round's boards. */
const SERVER_MS = 3000;
const LATENCY_MS = 60;

interface RoundRow {
  scenario: string;
  seed: number;
  mode: "judges" | "host";
  round: string;
  /** Lock to reveal (ms, simulated). */
  scoringMs: number;
  /** How the job was settled, by whom, and whether a cheater was among its judges. */
  how?: string;
  judges?: Kind[];
  cheaterJudged?: boolean;
  /** The applied numbers equal the honest devices' exactly; equal the engine server's verdict. */
  honestTruth?: boolean;
  serverTruth?: boolean;
  /** Cheaters' own picks: true loss (honest devices') and the loss actually applied, summed over cheaters this round. */
  cheatTrue?: number;
  cheatApplied?: number;
  /** The largest change to any pick's loss from what honest devices would have given, beyond the server's own (points). */
  worstShift?: number;
}

interface MatchRow {
  scenario: string;
  seed: number;
  mode: "judges" | "host";
  rounds: number;
  stats: Record<string, number> | null;
  strikes: Record<Kind, number[]>;
  benchedAtRound: Record<string, number | null>;
  serverCalls: number;
}

class Pool {
  private next = 0;
  constructor(readonly engines: UciEngine[]) {}
  get(): UciEngine {
    return this.engines[this.next++ % this.engines.length]!;
  }
}

/** Honest answers, computed once per job (the engine is deterministic: reports/judge-determinism.md). */
class Honest {
  private tops = new Map<string, Promise<MoveScore[]>>();
  private reports = new Map<string, Promise<JudgeReport>>();
  constructor(private readonly pool: Pool) {}
  top(fen: string): Promise<MoveScore[]> {
    let t = this.tops.get(fen);
    if (!t) this.tops.set(fen, (t = this.pool.get().topMoves(fen, DEFAULT_SETTINGS.botCandidateMoves)));
    return t;
  }
  report(job: JudgeJob): Promise<JudgeReport> {
    const key = JSON.stringify({ ...job, id: "" });
    let r = this.reports.get(key);
    if (!r) this.reports.set(key, (r = runJudgeJob(this.pool.get(), job, this.top(job.fen))));
    return r;
  }
}

/**
 * A cheater's answer: the lie, made consistent as a careful cheater would (any bot pick the lie moves outside the
 * scored moves gets scored, and lied about the same way), so the lobby can't tell it from the report alone.
 */
async function cheat(kind: Kind, job: JudgeJob, r: JudgeReport, ownPick: string | undefined, rng: () => number, engine: UciEngine): Promise<JudgeReport> {
  const lied = lie(kind, job, r, ownPick, rng);
  if (judgedBoard(job, lied)) return lied;
  const { judgeBotPicks } = await import("@chessroyale/chess");
  const have = new Set([...lied.top, ...lied.extra].map((m) => m.move));
  const missing = [...new Set([...job.picks, ...judgeBotPicks(job, lied.top).picks])].filter((m) => !have.has(m)).sort();
  const more = lie(kind, job, { top: [], extra: await engine.scoreMoves(job.fen, missing) }, ownPick, rng).extra;
  return { ...lied, extra: [...lied.extra, ...more] };
}

function lie(kind: Kind, job: JudgeJob, r: JudgeReport, ownPick: string | undefined, rng: () => number): JudgeReport {
  const map = (f: (m: MoveScore) => MoveScore) => ({ top: r.top.map(f), extra: r.extra.map(f), ...(r.deep ? { deep: r.deep.map(f) } : {}) });
  const best = Math.max(0, ...r.top.map((m) => m.expected), ...r.extra.map((m) => m.expected));
  if (kind === "inflate") return ownPick ? map((m) => (m.move === ownPick ? { ...m, expected: best } : m)) : r;
  if (kind === "noise") return map((m) => ({ ...m, expected: Math.min(1, Math.max(0, m.expected + (rng() + rng() + rng() - 1.5) * 0.06)) }));
  if (kind === "rubber") return map((m) => ({ ...m, expected: best }));
  return r;
}

/** One online Crowd match (50 v 50) with these devices, scored by judges or (mode "host") the old way. */
async function playMatch(sc: Scenario, seed: number, mode: "judges" | "host", honest: Honest, lazyEngine: UciEngine, server: UciEngine, lazyCheck: UciEngine): Promise<{ rounds: RoundRow[]; match: MatchRow }> {
  const rng = mulberry32(seed * 7919);
  let now = 1_000_000;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { crowdTeams: true, augments: false }) };
  type Ev = { at: number; seq: number; fn: () => Promise<void> | void };
  const queue: Ev[] = [];
  let seq = 0;
  const at = (t: number, fn: Ev["fn"]) => {
    queue.push({ at: t, seq: seq++, fn });
    queue.sort((a, b) => a.at - b.at || a.seq - b.seq);
  };
  const ids = sc.devices.map((_, i) => `p${i + 1}`);
  const spec = new Map(ids.map((id, i) => [id, sc.devices[i]!]));
  const tokens = new Map<string, string>();
  const connected = new Set<string>();
  const serverAsks: ServerScoreRequest[] = [];
  let serverCalls = 0;
  const core = new LobbyCore(
    newLobbyRecord("SIMUL", now),
    {
      now: () => now,
      send: (id, msg) => at(now + LATENCY_MS, () => onMessage(id, { ...msg, now } as ServerMessage)),
      judges: { ...JUDGES, on: mode === "judges", ...sc.judges },
      judgeRng: mulberry32(seed * 31 + 5),
      serverEngine: sc.server,
      serverScore: (req) => {
        serverAsks.push(req);
        serverCalls++;
        at(now + SERVER_MS / Math.max(1, req.boards) + LATENCY_MS, async () => {
          const moves = await server.scoreMovesAt(req.fen, req.moves, 1_000_000);
          verdicts.set(req.id, moves);
          core.serverScored(req.id, moves);
        });
      },
      settled: (jobs) => {
        const ms = now - lockedAt;
        const lock = picksAtLock;
        at(now, () => measure(jobs, ms, lock));
      },
    },
    library,
    mulberry32(seed),
    settings,
  );
  const verdicts = new Map<string, MoveScore[]>();
  // The current round, as each device sees it, and its pick.
  const picks = new Map<string, string>();
  let lockedAt = 0;
  let roundKey = "";
  const rows: RoundRow[] = [];
  const strikesAt: Record<string, number | null> = Object.fromEntries(ids.map((id) => [id, null]));
  let roundsDone = 0;
  /** The jobs as sent (by job id), and everyone's picks when the round locked. */
  const sentJobs = new Map<string, JudgeJob>();
  let picksAtLock = new Map<string, string>();

  const computeMs = (id: string, nodes: number) => LATENCY_MS + (nodes / spec.get(id)!.nps) * 1000;
  /** When each device's prefetch of a position finishes (the top-moves search runs while players think). */
  const prefetched = new Map<string, number>();

  async function onMessage(id: string, m: ServerMessage) {
    if (!connected.has(id)) return;
    const kind = spec.get(id)!.kind;
    switch (m.t) {
      case "welcome":
        tokens.set(id, m.token);
        return;
      case "round": {
        roundKey = m.key;
        picks.delete(id);
        if (!m.board || m.watching || !m.alive) return;
        const fen = m.board.fen;
        const think = 1500 + rng() * Math.max(500, m.deadline - m.startsAt - 3000);
        if (rng() < 0.03) return; // a miss
        const top = await honest.top(fen);
        const x = rng();
        const legal = legalMoves(fen);
        const move = x < 0.55 ? top[Math.floor(rng() * Math.min(3, top.length))]!.move : x < 0.85 ? top[Math.min(top.length - 1, 3 + Math.floor(rng() * 5))]!.move : legal[Math.floor(rng() * legal.length)]!;
        at(m.startsAt + think, () => {
          picks.set(id, move);
          core.message(id, { t: "pick", key: m.key, move });
        });
        return;
      }
      case "locked":
        if (id === ids.find((x) => connected.has(x))) {
          lockedAt = now;
          picksAtLock = new Map(picks);
        }
        return;
      case "prefetch": {
        // Searches these boards now (one after another), and in Crowd plans the bots' picks.
        let t = now;
        for (const fen of m.fens) {
          t += computeMs(id, DEFAULT_SETTINGS.engineNodes);
          prefetched.set(`${id}|${fen}`, t);
        }
        if (m.plan) {
          const plan = m.plan;
          const top = await honest.top(plan.fen);
          at(t, async () => {
            const { judgeBotPicks } = await import("@chessroyale/chess");
            const bots = plan.bots.map((b) => ({ skill: b.skill, powerUps: b.powerUps ?? 0 }));
            const chosen = plan.seed !== undefined && plan.rules ? judgeBotPicks({ fen: plan.fen, bots, seed: plan.seed, rules: plan.rules, ...(plan.barred ? { barred: plan.barred } : {}) } as JudgeJob, top) : { picks: plan.bots.map(() => top[0]!.move), powerUps: [] };
            core.message(id, { t: "botPlan", key: plan.key, picks: Object.fromEntries(plan.bots.map((b, i) => [b.id, chosen.picks[i]!])), powerUps: chosen.powerUps.map((i) => plan.bots[i]!.id) });
          });
        }
        return;
      }
      case "judge": {
        // A dropping device sometimes leaves just as a job arrives, and comes back a few seconds later.
        if (kind === "drop" && rng() < 0.3) {
          connected.delete(id);
          core.disconnect(id);
          at(now + 4000 + rng() * 6000, () => {
            connected.add(id);
            core.connect(tokens.get(id), id);
          });
          return;
        }
        let t = now;
        for (const job of m.jobs) {
          const ready = prefetched.get(`${id}|${job.fen}`);
          const nodes = (ready !== undefined ? 0 : DEFAULT_SETTINGS.engineNodes) + DEFAULT_SETTINGS.engineNodes + (job.recheck ? job.recheck.recheckNodes : 0);
          t = Math.max(t, ready ?? t) + computeMs(id, nodes);
          const base = kind === "lazy" ? await runJudgeJob(lazyEngine, job) : await honest.report(job);
          const report = CHEATS.includes(kind) ? await cheat(kind, job, base, picks.get(id), rng, lazyCheck) : base;
          if (!job.id.endsWith("~ref") && !sentJobs.has(job.id)) sentJobs.set(job.id, job);
          at(t, () => core.message(id, { t: "judged", key: m.key, id: job.id, report }));
        }
        return;
      }
      case "scoreRequest": {
        // The old way: this device is the host and scores every board (bots picking at random, as before).
        const key = m.key;
        const boards: BoardScore[] = [];
        const settled: { id: string; how: string; judges: string[]; board: JudgedBoard }[] = [];
        let t = now;
        for (const sj of m.jobs) {
          const job = legacyJob(sj, rng, !m.serverRecheck);
          sentJobs.set(`${key}/${sj.boardId}`, job);
          const ready = prefetched.get(`${id}|${job.fen}`);
          t = Math.max(t, ready ?? t) + computeMs(id, (ready !== undefined ? 0 : DEFAULT_SETTINGS.engineNodes) + DEFAULT_SETTINGS.engineNodes + (job.recheck ? job.recheck.recheckNodes : 0));
          const base = kind === "lazy" ? await runJudgeJob(lazyEngine, job) : await honest.report(job);
          const report = CHEATS.includes(kind) ? await cheat(kind, job, base, picks.get(id), rng, lazyCheck) : base;
          const judgedNow = judgedBoard(job, report);
          if (!judgedNow) {
            writeFileSync(`${out}debug-host.json`, JSON.stringify({ job, report, base }, null, 1));
            throw new Error("host report didn't hold together");
          }
          let b = judgedNow;
          // As the Durable Object does: the engine server re-checks the host's close calls before the lobby uses them.
          if (m.serverRecheck && job.picks.length) {
            const flagged = recheckTargets(b, [...job.picks, ...b.botPicks], DEFAULT_SETTINGS, sj.priority ?? []);
            if (flagged.length) {
              serverCalls++;
              t += SERVER_MS / m.jobs.length + LATENCY_MS;
              const deep = await server.scoreMovesAt(job.fen, [b.bestMove, ...flagged], 1_000_000);
              verdicts.set(`recheck:${key}/${sj.boardId}`, deep);
              const c = applyRecheck(b, flagged, deep);
              b = { ...b, ...c };
            }
          }
          boards.push({ boardId: sj.boardId, bestMove: b.bestMove, bestExpected: b.bestExpected, expectedAfter: b.expectedAfter, botPicks: Object.fromEntries(sj.bots.map((x, i) => [x.id, b.botPicks[i]!])), botThinkMs: {}, botPowerUps: b.botPowerUps.map((i) => sj.bots[i]!.id), replies: b.replies, mates: b.mates });
          settled.push({ id: `${key}/${sj.boardId}`, how: "host", judges: [id], board: b });
        }
        at(t, async () => {
          const ms = now - lockedAt;
          core.message(id, { t: "scores", key, boards });
          await measure(settled, ms, picksAtLock);
        });
        return;
      }
      case "results":
        finished = true;
        return;
    }
  }
  let finished = false;

  /** A job as the host's old ScoreJob, for the honest truth and the old way. */
  function legacyJob(sj: ScoreJob, r: () => number, recheck: boolean): JudgeJob {
    return {
      id: sj.boardId.toString(),
      fen: sj.fen,
      picks: Object.values(sj.humanPicks).filter((m): m is string => !!m).sort(),
      bots: sj.bots.map((b) => ({ skill: b.skill, powerUps: b.powerUps })),
      seed: Math.floor(r() * 2 ** 31),
      rules: { botCandidateMoves: DEFAULT_SETTINGS.botCandidateMoves, botRandomMoveChance: settings.botRandomMoveChance, botPowerUpLoss: settings.botPowerUpLoss },
      ...(sj.barred ? { barred: sj.barred } : {}),
      ...(recheck && Object.values(sj.humanPicks).some((m) => m) ? { recheck: DEFAULT_SETTINGS } : {}),
      ...(sj.priority ? { priority: sj.priority } : {}),
    };
  }

  /**
   * After a reveal: how the round's job was settled, against the honest truth: what honest devices give for the exact
   * job sent (the same bots' seed), with the same engine-server re-check of close calls applied where there was one.
   */
  async function measure(jobs: { id: string; how: string; judges: string[]; board: JudgedBoard }[], scoringMs: number, picksAtLock: Map<string, string>) {
    roundsDone++;
    const key = jobs[0]?.id.split("/")[0] ?? "";
    for (const id of ids) if (strikesAt[id] === null && (core.record.judges?.devices[id]?.strikes ?? 0) >= JUDGES.strikes) strikesAt[id] = roundsDone;
    for (const s of jobs) {
      const judgeKinds = s.judges.map((j) => spec.get(j)!.kind);
      const row: RoundRow = { scenario: sc.name, seed, mode, round: key, scoringMs, how: s.how, judges: judgeKinds, cheaterJudged: judgeKinds.some((k) => CHEATS.includes(k)) };
      const job = sentJobs.get(s.id);
      if (job) {
        const base = judgedBoard(job, await honest.report(job))!;
        let truth: JudgedBoard = base;
        const rc = verdicts.get(`recheck:${s.id}`);
        if (rc) {
          const flagged = recheckTargets(base, [...job.picks, ...base.botPicks], settings, job.priority ?? []);
          truth = { ...base, ...applyRecheck(base, flagged, rc) };
        }
        const lossIn = (b: JudgedBoard, mv: string) => Math.max(0, (Math.max(b.bestExpected, ...Object.values(b.expectedAfter)) - (b.expectedAfter[mv] ?? NaN)) * 100);
        row.honestTruth = job.picks.every((mv) => Math.abs((s.board.expectedAfter[mv] ?? -1) - (truth.expectedAfter[mv] ?? -2)) < 1e-9);
        const verdict = verdicts.get(`verdict:${s.id}`);
        row.serverTruth = !!verdict && job.picks.every((mv) => verdict.some((v) => v.move === mv && Math.abs(v.expected - (s.board.expectedAfter[mv] ?? -1)) < 1e-9));
        row.worstShift = Math.max(0, ...job.picks.map((mv) => Math.abs(lossIn(s.board, mv) - lossIn(truth, mv))).filter(Number.isFinite));
        let ct = 0;
        let ca = 0;
        for (const [pid, d] of spec) {
          const mv = picksAtLock.get(pid);
          if (!CHEATS.includes(d.kind) || !mv || !Number.isFinite(lossIn(truth, mv))) continue;
          ct += lossIn(truth, mv);
          ca += lossIn(s.board, mv);
        }
        row.cheatTrue = ct;
        row.cheatApplied = ca;
      }
      rows.push(row);
    }
    if (!jobs.length) rows.push({ scenario: sc.name, seed, mode, round: key, scoringMs });
  }

  // Everyone joins; devices report their speed (cheaters claim 3M nodes/s to be drawn as often as possible).
  for (const id of ids) {
    connected.add(id);
    core.connect(undefined, id, spec.get(id)!.nps > 500_000 ? "computer" : "phone");
    const d = spec.get(id)!;
    core.message(id, { t: "speed", nps: CHEATS.includes(d.kind) ? 3_000_000 : d.nps });
  }
  core.message("p1", { t: "start" });
  let guard = 0;
  while (!finished && guard++ < 200_000) {
    const alarm = core.nextAlarm;
    const ev = queue[0];
    if (alarm !== null && (!ev || alarm <= ev.at)) {
      now = Math.max(now, alarm);
      core.alarm();
      continue;
    }
    if (!ev) break;
    queue.shift();
    now = Math.max(now, ev.at);
    await ev.fn();
    if (core.record.phase === "results") finished = true;
  }
  void roundKey;
  void serverAsks;
  const strikes = Object.fromEntries(["honest", "slow", "drop", ...CHEATS].map((k) => [k, ids.filter((id) => spec.get(id)!.kind === k).map((id) => core.record.judges?.devices[id]?.strikes ?? 0)])) as Record<Kind, number[]>;
  return {
    rounds: rows,
    match: { scenario: sc.name, seed, mode, rounds: roundsDone, stats: (core.record.judges?.stats as unknown as Record<string, number>) ?? null, strikes, benchedAtRound: strikesAt, serverCalls },
  };
}

async function run(which: string, seeds: number, first: number) {
  mkdirSync(out, { recursive: true });
  const pool = new Pool(await Promise.all([1, 2].map(() => createNodeEngine({ nodes: DEFAULT_SETTINGS.engineNodes, hashMb: DEFAULT_SETTINGS.engineHashMb }))));
  const lazy = await createNodeEngine({ nodes: 5000, hashMb: 16 });
  const server = await createNodeEngine({ nodes: 1_000_000, hashMb: 64 }, STOCKFISH_FULL_BUILD);
  const honest = new Honest(pool);
  for (const sc of SCENARIOS.filter((s) => which === "all" || s.name === which)) {
    for (let seed = first; seed < first + seeds; seed++) {
      for (const mode of (process.env.MODES ?? "judges,host").split(",") as ("judges" | "host")[]) {
        const t = Date.now();
        const { rounds, match } = await playMatch(sc, seed, mode, honest, lazy, server, pool.engines[0]!);
        appendFileSync(`${out}rounds.jsonl`, rounds.map((r) => JSON.stringify(r)).join("\n") + "\n");
        appendFileSync(`${out}matches.jsonl`, JSON.stringify(match) + "\n");
        console.log(`${sc.name} seed ${seed} ${mode}: ${match.rounds} rounds, server ${match.serverCalls}, strikes ${JSON.stringify(match.strikes)} (${Math.round((Date.now() - t) / 1000)} s)`);
      }
    }
  }
  for (const e of [...pool.engines, lazy, server]) e.close();
}

// ---------------- Summary ----------------

function pct(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : 0;
}

function summary() {
  const rounds = readFileSync(`${out}rounds.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l) as RoundRow);
  const matches = readFileSync(`${out}matches.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l) as MatchRow);
  const names = [...new Set(matches.map((m) => m.scenario))];
  const desc: Record<string, string> = {
    honest: "6 honest devices (2 computers, 4 phones)",
    inflate: "1 cheater (a computer) scores its own pick as the best; 5 honest",
    noise: "1 cheater adds random noise (about 3 points) to every score; 5 honest",
    rubber: "1 cheater answers without looking: every move as good as the best; 5 honest",
    lazy: "1 cheater (a phone) answers from a 5k-node search; 5 honest",
    flaky: "1 inflating cheater, 2 phones that drop out (30% of jobs), 1 old phone (90k nodes/s), 2 honest",
    pair: "2 devices only: an inflating cheater and an honest phone (no third device for a second opinion)",
    "no-server": "as inflate, with the engine server down",
  };
  const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "–");
  let md = `# Many judges: the harness

\`packages/sim/scripts/many-judges.ts\` plays whole online Crowd matches (50 v 50, 100 players) through the real lobby
logic (\`LobbyCore\`), with simulated devices scored by real Stockfish (the Node transport, the browsers' lite build) and
the engine server stood in for by the full-network build. Time is simulated: a device answers after its searches
would take at its speed (computer 1.1M nodes/s, phone 350k, old phone 90k), the engine server after 3 s a search.
Cheaters claim 3M nodes/s, so they're drawn as judges as often as the lobby allows. Each scenario also runs the old
way (one host scores every round, the engine server re-checking its close calls) with the same devices.

Scenarios: ${names.map((n) => `**${n}**: ${desc[n] ?? n}`).join("; ")}.

`;
  // Results and truth.
  md += `## Do the scores match the truth?

Per job (a round's board). *Honest*: every person's pick scored exactly as honest devices score it. *Server*: the
engine server's verdict used. *Cheater's*: a job a cheater judged whose numbers were used (alone, or as the fallback
with no server). *Worst shift*: the most any pick's loss moved from the honest devices' (points), over the matches.

| Scenario | Way | Jobs | Agreed | Server verdict | Two of three | One judge | Fallback | Honest numbers | Cheater's numbers used | Worst shift |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
`;
  for (const n of names)
    for (const mode of ["judges", "host"] as const) {
      const rs = rounds.filter((r) => r.scenario === n && r.mode === mode && r.how);
      const c = (f: (r: RoundRow) => boolean) => rs.filter(f).length;
      const cheaterUsed = c((r) => !!r.cheaterJudged && (r.how === "single" || r.how === "fallback" || r.how === "host") && r.honestTruth === false);
      md += `| ${n} | ${mode === "judges" ? "judges" : "old (host)"} | ${rs.length} | ${c((r) => r.how === "agreed")} | ${c((r) => r.how === "verdict")} | ${c((r) => r.how === "majority")} | ${c((r) => r.how === "single")} | ${c((r) => r.how === "fallback")} | ${c((r) => !!r.honestTruth)} | ${cheaterUsed} | ${fmt(Math.max(0, ...rs.filter((r) => r.how !== "verdict").map((r) => r.worstShift ?? 0)))} |\n`;
    }
  md += `
(A job settled by the server's verdict differs from the honest devices' by the server's deeper view, not by any
cheater: its numbers are the server's own, for every pick.)

## What cheating gained

The cheaters' own picks: their true loss (honest devices' numbers) against the loss applied, summed over every round
they picked in. A positive gain is points the cheat was worth.

| Scenario | Way | Rounds | True loss | Applied loss | Gain |
|---|---|---:|---:|---:|---:|
`;
  for (const n of names.filter((x) => x !== "honest"))
    for (const mode of ["judges", "host"] as const) {
      const rs = rounds.filter((r) => r.scenario === n && r.mode === mode && r.cheatTrue !== undefined && r.how !== "verdict");
      const vs = rounds.filter((r) => r.scenario === n && r.mode === mode && r.how === "verdict");
      const t = rs.reduce((s, r) => s + r.cheatTrue!, 0);
      const a = rs.reduce((s, r) => s + r.cheatApplied!, 0);
      md += `| ${n} | ${mode === "judges" ? "judges" : "old (host)"} | ${rs.length}${vs.length ? ` (+${vs.length} verdicts)` : ""} | ${fmt(t)} | ${fmt(a)} | ${fmt(t - a)} |\n`;
    }
  md += `
(Rounds settled by a verdict are left out of the sums: there the applied numbers are the server's, which differ
from the lite engine's for everyone alike.)

## Are cheaters caught?

Strikes per match (two strikes: no more jobs that match), and the round the cheater was benched.

| Scenario | Matches | Cheater's strikes (each match) | Benched at round | Honest devices struck |
|---|---:|---|---|---:|
`;
  for (const n of names) {
    const ms = matches.filter((m) => m.scenario === n && m.mode === "judges");
    const cheat = ms.map((m) => CHEATS.flatMap((k) => m.strikes[k] ?? []).join("+") || "–").join(", ");
    const benched = ms.map((m) => {
      const ids = Object.entries(m.benchedAtRound).filter(([, r]) => r !== null);
      return ids.length ? ids.map(([id, r]) => `${id}@${r}`).join(" ") : "–";
    });
    const honestStruck = ms.reduce((s, m) => s + ["honest", "slow", "drop"].flatMap((k) => m.strikes[k as Kind] ?? []).reduce((a, b) => a + b, 0), 0);
    md += `| ${n} | ${ms.length} | ${cheat} | ${benched.join(", ")} | ${honestStruck} |\n`;
  }
  md += `
## Timing: never slower

Lock to reveal (ms, simulated), per round.

| Scenario | Way | Rounds | Median | 95th | Max |
|---|---|---:|---:|---:|---:|
`;
  for (const n of names)
    for (const mode of ["judges", "host"] as const) {
      const xs = [...new Map(rounds.filter((r) => r.scenario === n && r.mode === mode).map((r) => [`${r.seed}|${r.round}`, r.scoringMs])).values()];
      md += `| ${n} | ${mode === "judges" ? "judges" : "old (host)"} | ${xs.length} | ${Math.round(pct(xs, 0.5))} | ${Math.round(pct(xs, 0.95))} | ${Math.round(Math.max(0, ...xs))} |\n`;
    }
  md += `
## Engine server calls per match

| Scenario | Way | Matches | Rounds/match | Verdicts | Spot checks | Close-call re-checks | All calls/match |
|---|---|---:|---:|---:|---:|---:|---:|
`;
  for (const n of names)
    for (const mode of ["judges", "host"] as const) {
      const ms = matches.filter((m) => m.scenario === n && m.mode === mode);
      const avg = (f: (m: MatchRow) => number) => ms.reduce((s, m) => s + f(m), 0) / Math.max(1, ms.length);
      md += `| ${n} | ${mode === "judges" ? "judges" : "old (host)"} | ${ms.length} | ${fmt(avg((m) => m.rounds))} | ${mode === "judges" ? fmt(avg((m) => m.stats?.serverVerdict ?? 0)) : "–"} | ${mode === "judges" ? fmt(avg((m) => m.stats?.serverSpot ?? 0)) : "–"} | ${mode === "judges" ? fmt(avg((m) => m.stats?.serverRecheck ?? 0)) : fmt(avg((m) => m.serverCalls))} | ${fmt(avg((m) => m.serverCalls))} |\n`;
    }
  writeFileSync(root + "reports/many-judges.md", md);
  console.log(md);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "run") await run(args[0] ?? "all", Number(args[1] ?? 1), Number(args[2] ?? 1));
else if (cmd === "summary") summary();
else console.log("usage: many-judges.ts run <scenario|all> <seeds> [firstSeed] | summary");
void readdirSync;
