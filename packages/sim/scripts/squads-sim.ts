/**
 * Squads: full 32-player lobbies played through the real rules (`@chessroyale/chess/squads`) at three skill mixes
 * and every Clock option. Every seat is a person played by a bot: the bot engine chooses (Stockfish's top moves at
 * `nodes`, then botPick at the player's skill), and a simple model stands in for how a person uses the team clock and
 * how often they miss (below). The rules never ask the engine; the engine also judges which of two picks was better,
 * for this report only.
 *
 * Run: npm run sim:squads -- [lobbies per setting = 12] [nodes = 10000] [clocks: "bank|top-up|free|increment,..." with
 * the bank and top-up as m:ss, e.g. "6:00|1:00|5|0"] (about 35 minutes on 4 cores). Writes reports/squads-sim.md, or the
 * file in SQUADS_SIM_OUT (tuning runs). SQUADS_SIM_MIXES limits the mixes (e.g. "mixed"); SQUADS_SIM_SET overrides
 * settings for a tuning run (JSON merged into SQUADS, e.g. '{"moveCeilingSeconds":20}').
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_SETTINGS, SQUADS, botSkillSpread, shuffle, type Candidate, type SquadsClock, type SquadsSettings } from "@chessroyale/core";
import type { MoveScore, Opening, UciEngine } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import {
  NO_INPUTS,
  armageddonChooser,
  armageddonStart,
  botArmageddonColour,
  botFinalBlock,
  botFinalPick,
  botPairPick,
  botRelayMove,
  candidatesFrom,
  choose,
  drawBracket,
  formSquads,
  halfDuties,
  lockIn,
  minutesName,
  noteActions,
  otherSide,
  planLobby,
  planMatch,
  reportWinner,
  resolveHalf,
  settleTeamClocks,
  squadBotSkill,
  squadsLegalMoves,
  squadsRng,
  startArmageddon,
  startTeamClocks,
  teamClockLine,
  visibleChoices,
  winnerSquad,
  type Bracket,
  type Squad,
  type SquadsEvent,
  type SquadsFormat,
  type SquadsMatch,
  type SquadsPlan,
  type SquadsRound,
} from "@chessroyale/chess/squads";
import { mean, pct, quantile } from "../src/stats.ts";

const LOBBIES = Number(process.argv[2] ?? 12);
const NODES = Number(process.argv[3] ?? 10_000);
const WORKERS = 4;
const library = JSON.parse(readFileSync(new URL("../../chess/data/openings.json", import.meta.url), "utf8")) as Opening[];

/** A tuning run's option: "6:00|1:00|5|0" (the bank and top-up as m:ss, then free seconds and increment). */
function parseClock(text: string, i: number): SquadsClock {
  const secs = (t: string) => {
    const [m, sec] = t.split(":");
    return Number(m) * 60 + Number(sec ?? 0);
  };
  const [bank, topUp, delay, inc] = text.split("|");
  return { id: `try${i}`, label: `#${i + 1}`, bankSeconds: secs(bank!), topUpSeconds: secs(topUp!), delaySeconds: Number(delay), incrementSeconds: Number(inc ?? 0) };
}
const S: SquadsSettings = { ...SQUADS, ...(process.env.SQUADS_SIM_SET ? (JSON.parse(process.env.SQUADS_SIM_SET) as Partial<SquadsSettings>) : {}) };
const CLOCKS: readonly SquadsClock[] = process.argv[4] ? process.argv[4].split(",").map(parseClock) : S.clocks;
const OUT = process.env.SQUADS_SIM_OUT ? new URL(`file://${process.env.SQUADS_SIM_OUT}`) : new URL("../../../reports/squads-sim.md", import.meta.url);

// ---- What's simulated ----

const ALL_MIXES = [
  { id: "strong", label: "Strong", range: [0.25, 2] as const },
  { id: "mixed", label: "Mixed", range: [0.25, 32] as const },
  { id: "casual", label: "Casual", range: [4, 32] as const },
] as const;
const MIXES = ALL_MIXES.filter((m) => !process.env.SQUADS_SIM_MIXES || process.env.SQUADS_SIM_MIXES.split(",").includes(m.id));
type MixId = (typeof ALL_MIXES)[number]["id"];
/**
 * Assumptions about people (no real Squads data yet).
 * - With bank left, a person thinks for their squad's bank over BANK_MOVES, plus INC_SHARE of the free seconds and the
 *   increment, times a random factor in THINK_RANGE (mean 1), never less than MIN_THINK_S.
 * - In sudden death they try to beat the free seconds: a share of them in SD_RANGE (at least 1 s); past them, it's
 *   missed.
 * - Past the ceiling it's missed. They also miss outright with MISS_CHANCE (a distraction).
 */
const BANK_MOVES = 40;
const INC_SHARE = 0.8;
const THINK_RANGE = [0.5, 1.5] as const;
const MIN_THINK_S = 2;
const SD_RANGE = [0.4, 1.05] as const;
const MISS_CHANCE = 0.02;

interface Config {
  mix: MixId;
  clock: SquadsClock;
}

// ---- The engine: bots' candidates, and judging picks ----

/** Searches every lobby shares: the openings' first positions repeat on every board. */
const sharedTop = new Map<string, Promise<MoveScore[]>>();

class Lab {
  private top = new Map<string, Promise<MoveScore[]>>();
  private scored = new Map<string, number>();
  constructor(private readonly engine: UciEngine) {}

  topMoves(fen: string): Promise<MoveScore[]> {
    const early = Number(fen.split(" ")[5]) <= 8;
    const cache = early ? sharedTop : this.top;
    let p = cache.get(fen);
    if (!p) {
      p = this.engine.topMoves(fen, SQUADS.bots.candidates);
      cache.set(fen, p);
    }
    return p;
  }

  /** The mover's expected score after each move (the judge for "better" and "weaker" picks; not used by the rules). */
  async expected(fen: string, moves: readonly string[]): Promise<number[]> {
    const top = await this.topMoves(fen);
    for (const m of top) this.scored.set(`${fen}|${m.move}`, m.expected);
    const missing = [...new Set(moves.filter((m) => !this.scored.has(`${fen}|${m}`)))];
    if (missing.length) for (const m of await this.engine.scoreMoves(fen, missing)) this.scored.set(`${fen}|${m.move}`, m.expected);
    return moves.map((m) => this.scored.get(`${fen}|${m}`) ?? 0.5);
  }
}

// ---- One lobby ----

interface PairStat {
  /** How far apart the picks were, in points, and whether the coin played the weaker one. */
  diff: number;
  weakerPlayed: boolean;
  missedSlot: boolean;
}
interface FinalStat {
  mercy: boolean;
  blocks: number;
  blockHits: number;
  anyHit: boolean;
  activeHit: boolean;
  /** The active block hit the better pick (by 1+ point), the worse one, or picks level with each other. */
  activeHitBetter: boolean;
  activeHitWorse: boolean;
  cancelled: boolean;
  forfeits: number;
  worsePlayed: boolean;
}
interface MatchStat {
  seconds: number;
  turns: number;
  boardMoves: number[];
  boardEnds: string[];
  how: string;
  /** Each squad's bank (ms) at the start and the end of the match, side by side, and who won (side). */
  banksIn: readonly [number, number];
  banksOut: readonly [number, number];
  winner: 0 | 1;
  /** The winner's bank left over the loser's (ms), for ties decided by bank. */
  timeGap: number;
  armageddon: { seconds: number; turns: number; winner: "w" | "b"; reason: string } | null;
}
interface LobbyStat {
  cfg: Config;
  rounds: MatchStat[][];
  totalSeconds: number;
  lockstepSeconds: number;
  actions: number;
  missed: number;
  timeouts: number;
  replaced: number;
  /** Draining moves (Relay moves, pairs, the final's picks) by round, and how many were made with the squad in sudden death. */
  drainMoves: [number, number, number];
  sdMoves: [number, number, number];
  /** For each squad: the round it first reached sudden death (null: never), and the last round it played. */
  suddenDeath: { round: number | null; lastRound: number }[];
  pairs: PairStat[];
  finals: FinalStat[];
}

const showSeconds: Record<SquadsFormat, (s: SquadsSettings) => number> = {
  relay: (s) => s.moveShowSeconds,
  pairs: (s) => s.pairRevealSeconds,
  final: (s) => s.finalRevealSeconds,
};

async function simLobby(cfg: Config, index: number, lab: Lab, s: SquadsSettings): Promise<LobbyStat> {
  const c = cfg.clock;
  const seed = (index + 1) * 7919 + ALL_MIXES.findIndex((m) => m.id === cfg.mix) * 104729 + c.bankSeconds * 31 + c.topUpSeconds * 7 + c.delaySeconds * 3 + c.incrementSeconds;
  const rng = squadsRng(seed, "sim");
  const range = ALL_MIXES.find((m) => m.id === cfg.mix)!.range;
  const skills = shuffle(rng, botSkillSpread(32, { ...DEFAULT_SETTINGS, botSkillRange: range }));
  // Every seat a person (so a repeat no-show is handed to a bot), played by a bot at that person's skill.
  const parties = skills.map((skill, i) => ({ id: `p${i}`, members: [{ id: `p${i}`, name: `P${i}`, isBot: false, skill }] }));
  let squads: Squad[] = startTeamClocks(formSquads(parties, [], rng, s).squads, c);
  const plan: SquadsPlan = planLobby(seed, { start: (["standard", "same", "random"] as const)[index % 3]!, clock: c }, library, s);
  let bracket: Bracket = drawBracket(squads.map((x) => x.id), rng);
  const out: LobbyStat = {
    cfg,
    rounds: [],
    totalSeconds: 0,
    lockstepSeconds: 0,
    actions: 0,
    missed: 0,
    timeouts: 0,
    replaced: 0,
    drainMoves: [0, 0, 0],
    sdMoves: [0, 0, 0],
    suddenDeath: squads.map(() => ({ round: null, lastRound: 0 })),
    pairs: [],
    finals: [],
  };
  const player = (id: string) => squads.flatMap((x) => x.players).find((p) => p.id === id)!;

  async function play(m0: SquadsMatch): Promise<{ match: SquadsMatch; seconds: number }> {
    let m = m0;
    let seconds = 0;
    while (!m.result) {
      const duties = halfDuties(m, s);
      const fens = m.boards.map((b) => b.fen);
      const acts = duties.duties.flatMap((d) =>
        d.players.map((p, slot) => {
          // Blockers think as their opponents would, on nobody's clock.
          const clockSide = d.role === "block" ? otherSide(d.side) : d.side;
          const bank = m.banks[clockSide];
          const sudden = bank <= 0 && d.role !== "block";
          const think = sudden
            ? Math.max(1_000, m.delayMs * (SD_RANGE[0] + rng() * (SD_RANGE[1] - SD_RANGE[0])))
            : Math.max(MIN_THINK_S * 1000, (bank / BANK_MOVES + INC_SHARE * (m.delayMs + m.incrementMs)) * (THINK_RANGE[0] + rng() * (THINK_RANGE[1] - THINK_RANGE[0])));
          const distracted = !player(p).replacedByBot && rng() < MISS_CHANCE;
          const late = think > d.deadlineMs;
          return { d, p, slot, miss: distracted || late, t: distracted || late ? d.deadlineMs : think };
        }),
      );
      for (const d of duties.duties) {
        if (d.role === "block") continue;
        out.drainMoves[m.round]++;
        if (m.banks[d.side] <= 0) out.sdMoves[m.round]++;
      }
      acts.sort((a, b) => a.t - b.t);
      let inputs = NO_INPUTS;
      const think: Record<string, number> = {};
      for (const a of acts) {
        if (a.miss) continue;
        const fen = fens[a.d.board]!;
        const legal = squadsLegalMoves(fen);
        const top = await lab.topMoves(fen);
        const cands: Candidate[] = candidatesFrom(top, s);
        const who = player(a.p);
        const skill = squadBotSkill(top, who.replacedByBot ? s.replacementBotSkill : (who.skill ?? s.replacementBotSkill), s);
        const partner = a.d.players[1 - a.slot] ?? null;
        const partnerChoice = partner ? (inputs.choices[partner] ?? null) : null;
        let move: string;
        if (a.d.role === "move") move = botRelayMove(rng, cands, skill, legal);
        else if (m.format === "pairs") move = botPairPick(rng, cands, skill, legal, partnerChoice);
        else if (a.d.role === "pick") {
          const seen = visibleChoices(m, inputs, a.d.side, s);
          const blockers = duties.duties.find((x) => x.role === "block")?.players ?? [];
          move = botFinalPick(rng, cands, skill, legal, partnerChoice, blockers.flatMap((b) => (seen[b] ? [seen[b]!] : [])), s);
        } else move = botFinalBlock(rng, cands, skill, legal, partnerChoice);
        const r = choose(m, inputs, a.p, move, s);
        if ("inputs" in r) {
          inputs = lockIn(r.inputs, a.p);
          think[a.p] = Math.round(a.t);
        }
      }
      // A half lasts as long as its slowest player (each at most their deadline), then the show.
      seconds += (acts.length ? Math.max(...acts.map((a) => a.t)) / 1000 : 0) + showSeconds[m.format](s);
      const res = resolveHalf(m, inputs, think, s);
      out.actions += res.acted.length + res.missed.length;
      out.missed += res.missed.length;
      out.timeouts += res.timeouts.length;
      const before = squads.flatMap((x) => x.players).filter((p) => p.replacedByBot).length;
      // (A slow move in sudden death isn't a no-show: only true misses count towards a bot taking the seat.)
      squads = noteActions(squads, res.acted, res.missed.filter((p) => !res.timeouts.includes(p)), s);
      out.replaced += squads.flatMap((x) => x.players).filter((p) => p.replacedByBot).length - before;
      for (const e of res.events) {
        if (e.kind === "sudden_death" && !m.armageddon) {
          const sd = out.suddenDeath[m.sides[e.side].squadId]!;
          sd.round ??= m.round;
        }
        await judge(e, fens);
      }
      m = res.match;
    }
    return { match: m, seconds };
  }

  async function judge(e: SquadsEvent, fens: readonly string[]) {
    if (e.kind === "pair") {
      const [e0, e1] = await lab.expected(fens[e.board]!, e.picks);
      const played = e.coin === 0 ? e0! : e1!;
      const other = e.coin === 0 ? e1! : e0!;
      out.pairs.push({ diff: Math.abs(e0! - e1!) * 100, weakerPlayed: played < other, missedSlot: e.missed.some(Boolean) });
    }
    if (e.kind === "pickblock") {
      const [e0, e1] = await lab.expected(fens[e.board]!, e.picks);
      const exp = [e0!, e1!];
      const placed = e.blocks.filter((b): b is string => !!b);
      const playedIdx = e.picks.indexOf(e.move);
      out.finals.push({
        mercy: e.mercy !== null,
        blocks: placed.length,
        blockHits: placed.filter((b) => e.picks.includes(b)).length,
        anyHit: placed.some((b) => e.picks.includes(b)),
        activeHit: e.hit !== null,
        activeHitBetter: e.hit !== null && exp[e.hit]! - exp[1 - e.hit]! >= 0.01,
        activeHitWorse: e.hit !== null && exp[1 - e.hit]! - exp[e.hit]! >= 0.01,
        cancelled: e.cancelled,
        forfeits: e.blockMissed.filter(Boolean).length,
        worsePlayed: exp[1 - playedIdx]! - exp[playedIdx]! >= 0.01,
      });
    }
  }

  // Each match's length, then the lobby's: a match starts as soon as its two feeder matches (and the bracket's show) are done.
  const ends: number[][] = [];
  const votes = 2 * (s.voteSeconds + s.voteResultSeconds);
  for (const round of [0, 1, 2] as SquadsRound[]) {
    const stats: MatchStat[] = [];
    ends.push([]);
    for (const bm of bracket[round]!) {
      const pair = [squads[bm.squads[0]!]!, squads[bm.squads[1]!]!] as const;
      for (const sq of pair) out.suddenDeath[sq.id]!.lastRound = round;
      const planned = planMatch(plan, round, bm.index, pair, library, s);
      const played = await play(planned);
      let m = played.match;
      squads = settleTeamClocks(squads, m);
      const left = m.banks;
      const w = (m.result!.winner ?? 0) as 0 | 1;
      const stat: MatchStat = {
        seconds: played.seconds,
        turns: Math.ceil(Math.max(...m.boards.map((b) => b.moves.length)) / 2),
        boardMoves: m.boards.map((b) => b.moves.length / 2),
        boardEnds: m.boards.map((b) => b.result?.reason ?? "unfinished"),
        how: m.result!.how,
        banksIn: planned.banks,
        banksOut: m.banks,
        winner: w,
        timeGap: left[w] - left[otherSide(w)],
        armageddon: null,
      };
      let seconds = played.seconds;
      if (m.result!.winner === null) {
        const chooser = armageddonChooser(m);
        const white = botArmageddonColour(s) === "w" ? chooser : otherSide(chooser);
        const arm = await play(startArmageddon(m, white, armageddonStart(plan, m, library, s), s));
        const b = arm.match.boards[0]!;
        stat.armageddon = { seconds: arm.seconds, turns: Math.ceil(b.moves.length / 2), winner: arm.match.result!.winner === b.white ? "w" : "b", reason: b.result!.reason };
        stat.winner = arm.match.result!.winner as 0 | 1;
        seconds += s.armageddonIntroSeconds + arm.seconds;
        m = arm.match;
      }
      stat.seconds = seconds;
      stats.push(stat);
      const startAt = round === 0 ? votes : Math.max(ends[round - 1]![2 * bm.index]!, ends[round - 1]![2 * bm.index + 1]!) + s.roundBreakSeconds;
      ends[round]!.push(startAt + seconds);
      bracket = reportWinner(bracket, round, bm.index, winnerSquad(m)!);
    }
    out.rounds.push(stats);
  }
  out.totalSeconds = ends[2]![0]!;
  out.lockstepSeconds = votes + out.rounds.reduce((t, r) => t + Math.max(...r.map((x) => x.seconds)), 0) + 2 * s.roundBreakSeconds;
  return out;
}

// ---- Run every setting ----

const configs: Config[] = CLOCKS.flatMap((clock) => MIXES.map((m) => ({ mix: m.id, clock })));
const jobs = configs.flatMap((cfg) => Array.from({ length: LOBBIES }, (_, i) => ({ cfg, i })));
const results: LobbyStat[] = [];
const engines = await Promise.all(Array.from({ length: WORKERS }, () => createNodeEngine({ nodes: NODES, hashMb: 16 })));
const started = Date.now();
let next = 0;
await Promise.all(
  engines.map(async (engine) => {
    const lab = new Lab(engine);
    while (next < jobs.length) {
      const job = jobs[next++]!;
      results.push(await simLobby(job.cfg, job.i, lab, S));
      const done = results.length;
      const eta = ((Date.now() - started) / done) * (jobs.length - done);
      process.stdout.write(`lobby ${done}/${jobs.length} (${job.cfg.mix}, ${job.cfg.clock.label}) ~${Math.round(eta / 60000)} min left\n`);
    }
  }),
);
engines.forEach((e) => e.close());

// ---- The report ----

const min = (sec: number) => (sec / 60).toFixed(1);
const f1 = (x: number) => x.toFixed(1);
const sel = (p: (r: LobbyStat) => boolean) => results.filter(p);
const clockLabel = (c: SquadsClock) => `${c.label} (${minutesName(c.bankSeconds)}, +${minutesName(c.topUpSeconds)}, ${c.delaySeconds} s free${c.incrementSeconds ? `, +${c.incrementSeconds} s` : ""})`;
const byClock = (c: SquadsClock) => sel((r) => r.cfg.clock === c);
const roundNames = ["Round 1 (Relay)", "Round 2 (Pairs)", "Final"];
const matchesIn = (rs: LobbyStat[], r: number) => rs.flatMap((x) => x.rounds[r]!);

const lines: string[] = [];
const push = (...l: string[]) => lines.push(...l);
const table = (head: string[], rows: string[][]) => push(`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`), "");

push(
  "# Squads: bot simulation",
  "",
  `${results.length} full lobbies of 32 (8 squads of 4), ${LOBBIES} for every skill mix × Clock option, from`,
  "`packages/sim/scripts/squads-sim.ts` (`npm run sim:squads`), through the real rules in `packages/chess/src/squads/`.",
  "Each lobby plays the whole bracket: round 1 Relay (4 matches on 4 boards), round 2 Pairs (2 matches on 2 boards),",
  "the final (Pick and Block), and an Armageddon board after a drawn final. Every game is played to the end (the silent",
  "safety cap at move 120 aside). Start votes rotate between the normal start, one opening and random openings.",
  "",
  "**The team clock.** Each squad has one bank for the whole tournament, carried from round to round and topped up",
  "when it advances. Each of its moves being thought about drains it past the free seconds (a Relay mover, a pair, the",
  "final's pickers; two at once drain it twice as fast). At zero it's sudden death: every move within the free seconds,",
  "or it's a random move. No flag falls. The options:",
  ...CLOCKS.map((c) => `- ${c.label}: ${teamClockLine(c)}.`),
  "",
  "**How the seats are played.** Every seat is a person played by a bot: the bot engine (Stockfish 19 lite at",
  `${NODES.toLocaleString("en")} nodes, its top ${SQUADS.bots.candidates} moves) then \`botPick\` at the person's skill, a temperature over each move's loss:`,
  "Strong T 0.25–2, Mixed T 0.25–32 (the usual bot spread), Casual T 4–32. Winning, a bot plays with purpose (the",
  "engine's order breaks ties between moves that all win, and it plays a mate it sees). The rules never ask the engine;",
  "the engine also judges which of two picks was better, for this report only.",
  "",
  "**A person's clock use and misses are assumptions** (there's no real Squads data yet):",
  `- With bank left, a person thinks for their squad's bank / ${BANK_MOVES} + ${INC_SHARE} × (the free seconds + any increment), times a`,
  `  random factor of ${THINK_RANGE[0]}–${THINK_RANGE[1]}, at least ${MIN_THINK_S} s.`,
  `- In sudden death they try to beat the free seconds: ${SD_RANGE[0]}–${SD_RANGE[1]} of them, at least 1 s; past them it's missed.`,
  `- Past the per-move ceiling (${S.moveCeilingSeconds} s) it's missed. They also miss outright (a distraction) ${pct(MISS_CHANCE)} of the time.`,
  "- Blockers think the same way, on nobody's clock.",
  "",
  `A half lasts as long as its slowest player, plus the show: ${S.moveShowSeconds} s for a Relay half's moves, ${S.pairRevealSeconds} s for the pair's reveal,`,
  `${S.finalRevealSeconds} s for the final's reveal. A match starts as soon as its two feeder matches are done, after ${S.roundBreakSeconds} s of bracket; ${f1(2 * (S.voteSeconds + S.voteResultSeconds))} s of votes come first.`,
  "",
);

push("## How long a lobby takes", "", "Minutes from the votes to the final's last move (Armageddon included).", "");
table(
  ["Clock", "Median", "90th percentile", "Longest", "Shortest", "Median if rounds ran in lockstep"],
  CLOCKS.map((c) => {
    const tot = byClock(c).map((r) => r.totalSeconds);
    return [clockLabel(c), min(quantile(tot, 0.5)), min(quantile(tot, 0.9)), min(Math.max(...tot)), min(Math.min(...tot)), min(quantile(byClock(c).map((r) => r.lockstepSeconds), 0.5))];
  }),
);
push("By skill mix (median minutes):", "");
table(
  ["Mix", ...CLOCKS.map((c) => c.label)],
  MIXES.map((mx) => [mx.label, ...CLOCKS.map((c) => min(quantile(sel((r) => r.cfg.mix === mx.id && r.cfg.clock === c).map((r) => r.totalSeconds), 0.5)))]),
);
push("A match's length (mean minutes, Armageddon included) and its moves per side (its longest board):", "");
table(
  ["Clock", ...roundNames.map((n) => `${n}: min`), ...roundNames.map((n) => `${n}: moves`)],
  CLOCKS.map((c) => {
    const rs = byClock(c);
    return [c.label, ...[0, 1, 2].map((i) => min(mean(matchesIn(rs, i).map((m) => m.seconds)))), ...[0, 1, 2].map((i) => f1(mean(matchesIn(rs, i).map((m) => m.turns))))];
  }),
);

const sdShare = (rs: LobbyStat[], rounds: number[]) => {
  const sum = (f: (r: LobbyStat) => number[]) => rs.reduce((t, r) => t + rounds.reduce((u, i) => u + f(r)[i]!, 0), 0);
  return pct(sum((r) => r.sdMoves) / Math.max(1, sum((r) => r.drainMoves)));
};
push("## Sudden death", "", "A squad whose bank reaches zero plays every move within the free seconds from then on (or it's a random move).", "");
table(
  ["Clock", "Squads that reach it", "…first in round 1", "…in round 2", "…in the final", "Moves made in sudden death", "…round 1", "…round 2", "…final", "Moves out of time (random)"],
  CLOCKS.map((c) => {
    const rs = byClock(c);
    const sq = rs.flatMap((r) => r.suddenDeath);
    const reached = sq.filter((x) => x.round !== null);
    const share = (r: number) => {
      const played = sq.filter((x) => x.lastRound >= r).length;
      return pct(reached.filter((x) => x.round === r).length / Math.max(1, played));
    };
    return [
      c.label,
      pct(reached.length / Math.max(1, sq.length)),
      share(0),
      share(1),
      share(2),
      sdShare(rs, [0, 1, 2]),
      sdShare(rs, [0]),
      sdShare(rs, [1]),
      sdShare(rs, [2]),
      pct(rs.reduce((t, r) => t + r.timeouts, 0) / Math.max(1, rs.reduce((t, r) => t + r.actions, 0))),
    ];
  }),
);

push("## Bank carried forward", "", "Round 1 winners, split at the median length of their round 1 match: the bank they bring to round 2 (before its top-up), and how often the squad with more bank wins.", "");
table(
  ["Clock", "Bank left, faster R1 wins", "Bank left, slower R1 wins", "Faster R1 matches (min)", "Slower R1 matches (min)", "R2: more bank wins", "Final: more bank wins"],
  CLOCKS.map((c) => {
    const rs = byClock(c);
    const r1 = matchesIn(rs, 0);
    const cut = quantile(r1.map((m) => m.seconds), 0.5);
    const fast = r1.filter((m) => m.seconds <= cut);
    const slow = r1.filter((m) => m.seconds > cut);
    const left = (ms: MatchStat[]) => `${f1(mean(ms.map((m) => m.banksOut[m.winner] / 1000)))} s`;
    const moreWins = (r: number) => {
      const ms = matchesIn(rs, r).filter((m) => m.banksIn[0] !== m.banksIn[1]);
      return `${pct(ms.filter((m) => (m.banksIn[0] > m.banksIn[1] ? 0 : 1) === m.winner).length / Math.max(1, ms.length))} of ${ms.length}`;
    };
    return [c.label, left(fast), left(slow), min(mean(fast.map((m) => m.seconds))), min(mean(slow.map((m) => m.seconds))), moreWins(1), moreWins(2)];
  }),
);

push("## How boards end", "", "All mixes.", "");
const endKinds = ["checkmate", "draw", "safety_cap", "unfinished"] as const;
const endOf = (e: string) => (["stalemate", "repetition", "insufficient_material", "fifty_moves"].includes(e) ? "draw" : e);
table(
  ["Clock", "Round", "Mate", "Draw by the rules", "Safety cap", "Left unfinished (clinched)"],
  CLOCKS.flatMap((c) =>
    [0, 1, 2].map((i) => {
      const ends = matchesIn(byClock(c), i).flatMap((m) => m.boardEnds.map(endOf));
      return [c.label, roundNames[i]!, ...endKinds.map((k) => pct(ends.filter((e) => e === k).length / Math.max(1, ends.length)))];
    }),
  ),
);

push("## Ties", "", "Rounds 1 and 2: a level match goes to the squad with more team bank left (a coin if exactly level). A drawn final goes to Armageddon.", "");
table(
  ["Clock", "R1 clinched early", "R1 level → bank", "R2 level → bank", "Level → coin", "Median bank gap deciding a tie (s)", "Final drawn → Armageddon", "Armageddon won by Black"],
  CLOCKS.map((c) => {
    const rs = byClock(c);
    const share = (i: number, p: (m: MatchStat) => boolean) => {
      const ms = matchesIn(rs, i);
      return pct(ms.filter(p).length / Math.max(1, ms.length));
    };
    const ties = [0, 1].flatMap((i) => matchesIn(rs, i).filter((m) => m.how === "time" || m.how === "coin"));
    const arms = matchesIn(rs, 2).flatMap((m) => (m.armageddon ? [m.armageddon] : []));
    return [
      c.label,
      share(0, (m) => m.how === "clinch"),
      share(0, (m) => m.how === "time"),
      share(1, (m) => m.how === "time"),
      `${ties.filter((m) => m.how === "coin").length} of ${ties.length}`,
      ties.some((m) => m.how === "time") ? f1(quantile(ties.filter((m) => m.how === "time").map((m) => m.timeGap / 1000), 0.5)) : "–",
      share(2, (m) => !!m.armageddon),
      arms.length ? `${pct(arms.filter((a) => a.winner === "b").length / arms.length)} of ${arms.length}` : "–",
    ];
  }),
);

push("## Missed actions", "");
table(
  ["Clock", "Actions per lobby", "Missed (absent or out of time)", "Seats handed to a bot, per lobby"],
  CLOCKS.map((c) => {
    const rs = byClock(c);
    const a = rs.reduce((t, r) => t + r.actions, 0);
    return [c.label, f1(a / rs.length), pct(rs.reduce((t, r) => t + r.missed, 0) / Math.max(1, a)), f1(rs.reduce((t, r) => t + r.replaced, 0) / rs.length)];
  }),
);

push("## Round 2: how often the coin plays the weaker pick", "", "Per pair move (forced moves left out). \"Weaker\" is by the engine's expected score after each pick (1 point = 0.01).", "");
table(
  ["Mix", "Pair moves", "Picks 1+ point apart", "Coin played the weaker pick (1+ point)", "…weaker by 5+ points", "…weaker by 20+ points", "Moves with a missed slot"],
  MIXES.map((mx) => {
    const ps = sel((r) => r.cfg.mix === mx.id).flatMap((r) => r.pairs);
    const n = Math.max(1, ps.length);
    const weaker = (d: number) => pct(ps.filter((p) => p.weakerPlayed && p.diff >= d).length / n);
    return [mx.label, String(ps.length), pct(ps.filter((p) => p.diff >= 1).length / n), weaker(1), weaker(5), weaker(20), pct(ps.filter((p) => p.missedSlot).length / n)];
  }),
);

push("## The final: picks, blocks and the mercy rules", "", "Per move of the final (and its Armageddon), forced moves left out.", "");
table(
  ["Mix", "Moves", "No blocks (3 or fewer legal moves)", "A block hits a pick", "Blocks that hit a pick", "Active block hits a pick", "…the better pick", "…the worse pick", "…picks level", "Block cancelled (mate in one)", "Forfeited blocks", "The worse pick played (1+ point)"],
  MIXES.map((mx) => {
    const fs = sel((r) => r.cfg.mix === mx.id).flatMap((r) => r.finals);
    const n = Math.max(1, fs.length);
    const placed = fs.reduce((t, f) => t + f.blocks, 0);
    const hits = fs.filter((f) => f.activeHit);
    const better = hits.filter((f) => f.activeHitBetter).length;
    const worse = hits.filter((f) => f.activeHitWorse).length;
    const slots = fs.filter((f) => !f.mercy).length * 2;
    const cancelled = fs.filter((f) => f.cancelled).length;
    return [
      mx.label,
      String(fs.length),
      pct(fs.filter((f) => f.mercy).length / n),
      pct(fs.filter((f) => f.anyHit).length / n),
      pct(fs.reduce((t, f) => t + f.blockHits, 0) / Math.max(1, placed)),
      pct(hits.length / n),
      pct(better / n),
      pct(worse / n),
      pct((hits.length - better - worse) / n),
      `${cancelled} (${pct(cancelled / n)})`,
      pct(fs.reduce((t, f) => t + f.forfeits, 0) / Math.max(1, slots)),
      pct(fs.filter((f) => f.worsePlayed).length / n),
    ];
  }),
);
push("The \"what this means for fun\" section is written by hand below this line.", "", "<!-- squads-sim: end of generated tables -->", "");

let tail = "";
try {
  const old = readFileSync(OUT, "utf8");
  const at = old.indexOf("<!-- squads-sim: end of generated tables -->");
  if (at >= 0) tail = old.slice(at + "<!-- squads-sim: end of generated tables -->".length).replace(/^\n+/, "");
} catch {
  // A first run: no notes yet.
}
writeFileSync(OUT, lines.join("\n") + (tail ? `\n${tail}` : ""));
console.log(`Wrote ${OUT.pathname} (${Math.round((Date.now() - started) / 60000)} min)`);
