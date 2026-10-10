/**
 * Squads: full 32-player lobbies played through the real rules (`@chessroyale/chess/squads`) at three skill mixes
 * and every Clock vote. Every seat is a person played by a bot: the bot engine chooses (Stockfish's top moves at
 * `nodes`, then botPick at the player's skill), and a simple model stands in for a person's clock use and misses
 * (below). The rules never ask the engine; the engine also judges which of two picks was better, for this report
 * only.
 *
 * Run: npm run sim:squads -- [lobbies per setting = 8] [nodes = 10000] [clocks, e.g. "2+1,3+2"] (about 15 minutes on
 * 4 cores). Writes reports/squads-sim.md, or the file in SQUADS_SIM_OUT (tuning runs). SQUADS_SIM_MIXES limits the
 * mixes (e.g. "mixed"); SQUADS_SIM_SET overrides settings for a tuning run (JSON merged into SQUADS, e.g.
 * '{"moveCeilingSeconds":20}').
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
  clockName,
  drawBracket,
  formSquads,
  halfDuties,
  lockIn,
  noteActions,
  otherSide,
  planLobby,
  planMatch,
  reportWinner,
  resolveHalf,
  squadBotSkill,
  squadsLegalMoves,
  squadsRng,
  startArmageddon,
  timeLeft,
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

const LOBBIES = Number(process.argv[2] ?? 8);
const NODES = Number(process.argv[3] ?? 10_000);
const WORKERS = 4;
const library = JSON.parse(readFileSync(new URL("../../chess/data/openings.json", import.meta.url), "utf8")) as Opening[];

/** "2+1" or "1:30+1" as a clock (tuning runs try clocks that aren't in settings). */
function parseClock(text: string, i: number): SquadsClock {
  const [bank, inc] = text.split("+");
  const [m, sec] = bank!.split(":");
  return { id: `try${i}`, label: text, bankSeconds: Number(m) * 60 + Number(sec ?? 0), incrementSeconds: Number(inc) };
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
 * Assumptions about people (no real Squads data yet). A person thinks for their bank over MOVES_TO_GO plus
 * INC_SHARE of the increment (low on time, they play at about the increment), times a random factor in THINK_RANGE
 * (mean 1), and never less than MIN_THINK_S (reading the board, tapping). If that's past their deadline they miss it
 * (the ceiling) or run out of time (their bank). They also miss outright with MISS_CHANCE (a distraction).
 */
const MOVES_TO_GO = 25;
const INC_SHARE = 0.8;
const THINK_RANGE = [0.5, 1.5] as const;
const MIN_THINK_S = 2;
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
  /** The winner's clock time left over the loser's (ms), for ties decided by time. */
  timeGap: number;
  armageddon: { seconds: number; turns: number; winner: "w" | "b"; reason: string } | null;
}
interface LobbyStat {
  cfg: Config;
  rounds: MatchStat[][];
  /** Lobby length with each match starting as soon as its two feeder matches are done (and in lockstep rounds). */
  totalSeconds: number;
  lockstepSeconds: number;
  actions: number;
  missed: number;
  ceilingMisses: number;
  replaced: number;
  pairs: PairStat[];
  finals: FinalStat[];
}

const showSeconds: Record<SquadsFormat, (s: SquadsSettings) => number> = {
  relay: (s) => s.moveShowSeconds,
  pairs: (s) => s.pairRevealSeconds,
  final: (s) => s.finalRevealSeconds,
};

async function simLobby(cfg: Config, index: number, lab: Lab, s: SquadsSettings): Promise<LobbyStat> {
  const seed = (index + 1) * 7919 + ALL_MIXES.findIndex((m) => m.id === cfg.mix) * 104729 + cfg.clock.bankSeconds * 31 + cfg.clock.incrementSeconds * 7;
  const rng = squadsRng(seed, "sim");
  const range = ALL_MIXES.find((m) => m.id === cfg.mix)!.range;
  const skills = shuffle(rng, botSkillSpread(32, { ...DEFAULT_SETTINGS, botSkillRange: range }));
  // Every seat a person (so a repeat no-show is handed to a bot), played by a bot at that person's skill.
  const parties = skills.map((skill, i) => ({ id: `p${i}`, members: [{ id: `p${i}`, name: `P${i}`, isBot: false, skill }] }));
  let squads: Squad[] = formSquads(parties, [], rng, s).squads;
  const plan: SquadsPlan = planLobby(seed, { start: (["standard", "same", "random"] as const)[index % 3]!, clock: cfg.clock }, library, s);
  let bracket: Bracket = drawBracket(squads.map((x) => x.id), rng);
  const out: LobbyStat = { cfg, rounds: [], totalSeconds: 0, lockstepSeconds: 0, actions: 0, missed: 0, ceilingMisses: 0, replaced: 0, pairs: [], finals: [] };
  const player = (id: string) => squads.flatMap((x) => x.players).find((p) => p.id === id)!;

  async function play(m0: SquadsMatch): Promise<{ match: SquadsMatch; seconds: number }> {
    let m = m0;
    let seconds = 0;
    while (!m.result) {
      const duties = halfDuties(m, s);
      const fens = m.boards.map((b) => b.fen);
      const acts = duties.duties.flatMap((d) =>
        d.players.map((p, slot) => {
          // Blockers think on the picking side's clock, as if they had one; nobody charges them for it.
          const bank = m.boards[d.board]!.clock[m.half];
          const think = Math.max(MIN_THINK_S * 1000, (bank / MOVES_TO_GO + INC_SHARE * m.incrementMs) * (THINK_RANGE[0] + rng() * (THINK_RANGE[1] - THINK_RANGE[0])));
          const distracted = !player(p).replacedByBot && rng() < MISS_CHANCE;
          const late = think >= d.deadlineMs;
          if (late && d.deadlineMs >= s.moveCeilingSeconds * 1000) out.ceilingMisses++;
          return { d, p, slot, miss: distracted || late, t: distracted || late ? d.deadlineMs : think };
        }),
      );
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
      const before = squads.flatMap((x) => x.players).filter((p) => p.replacedByBot).length;
      squads = noteActions(squads, res.acted, res.missed, s);
      out.replaced += squads.flatMap((x) => x.players).filter((p) => p.replacedByBot).length - before;
      for (const e of res.events) await judge(e, fens);
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

  const matchStat = (m: SquadsMatch, seconds: number): MatchStat => {
    const left = timeLeft(m.boards);
    const w = m.result!.winner ?? 0;
    return {
      seconds,
      turns: Math.ceil(Math.max(...m.boards.map((b) => b.moves.length)) / 2),
      boardMoves: m.boards.map((b) => b.moves.length / 2),
      boardEnds: m.boards.map((b) => (b.result ? (b.result.reason === "flag" && b.result.winner === null ? "flag_draw" : b.result.reason) : "unfinished")),
      how: m.result!.how,
      timeGap: left[w] - left[otherSide(w)],
      armageddon: null,
    };
  };

  // Each match's length, then the lobby's: a match starts as soon as its two feeder matches (and the bracket's show) are done.
  const ends: number[][] = [];
  const votes = 2 * (s.voteSeconds + s.voteResultSeconds);
  for (const round of [0, 1, 2] as SquadsRound[]) {
    const stats: MatchStat[] = [];
    ends.push([]);
    for (const bm of bracket[round]!) {
      const pair = [squads[bm.squads[0]!]!, squads[bm.squads[1]!]!] as const;
      const played = await play(planMatch(plan, round, bm.index, pair, library, s));
      let m = played.match;
      const stat = matchStat(m, played.seconds);
      let seconds = played.seconds;
      if (m.result!.winner === null) {
        const chooser = armageddonChooser(m);
        const white = botArmageddonColour(s) === "w" ? chooser : otherSide(chooser);
        const arm = await play(startArmageddon(m, white, armageddonStart(plan, m, library, s), s));
        const b = arm.match.boards[0]!;
        stat.armageddon = { seconds: arm.seconds, turns: Math.ceil(b.moves.length / 2), winner: arm.match.result!.winner === b.white ? "w" : "b", reason: b.result!.reason };
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
      process.stdout.write(`lobby ${done}/${jobs.length} (${job.cfg.mix}, ${clockName(job.cfg.clock)}) ~${Math.round(eta / 60000)} min left\n`);
    }
  }),
);
engines.forEach((e) => e.close());

// ---- The report ----

const min = (sec: number) => (sec / 60).toFixed(1);
const f1 = (x: number) => x.toFixed(1);
const sel = (p: (r: LobbyStat) => boolean) => results.filter(p);
const clockLabel = (c: SquadsClock) => `${c.label === clockName(c) ? "" : `${c.label} `}${clockName(c)}`;
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
  "the final (Pick and Block), and an Armageddon board after a drawn final. Every board has a chess clock and is played",
  "to the end (the silent safety cap at move 120 aside). Start votes rotate between the normal start, one opening and",
  "random openings.",
  "",
  "**How the seats are played.** Every seat is a person played by a bot: the bot engine (Stockfish 19 lite at",
  `${NODES.toLocaleString("en")} nodes, its top ${SQUADS.bots.candidates} moves) then \`botPick\` at the person's skill, a temperature over each move's loss:`,
  "Strong T 0.25–2, Mixed T 0.25–32 (the usual bot spread), Casual T 4–32. Winning, a bot plays with purpose (the",
  "engine's order breaks ties between moves that all win, and it plays a mate it sees). The rules never ask the engine;",
  "the engine also judges which of two picks was better, for this report only.",
  "",
  "**A person's clock use and misses are assumptions** (there's no real Squads data yet): a person thinks for their",
  `bank / ${MOVES_TO_GO} + ${INC_SHARE} × the increment, times a random factor of ${THINK_RANGE[0]}–${THINK_RANGE[1]}, at least ${MIN_THINK_S} s; past the per-move ceiling`,
  `(${S.moveCeilingSeconds} s) that's a miss, past their bank a flag fall. They also miss outright (a distraction) ${pct(MISS_CHANCE)} of the time. Blockers think the`,
  "same way, on nobody's clock.",
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
  ["Mix", ...CLOCKS.map(clockLabel)],
  MIXES.map((mx) => [mx.label, ...CLOCKS.map((c) => min(quantile(sel((r) => r.cfg.mix === mx.id && r.cfg.clock === c).map((r) => r.totalSeconds), 0.5)))]),
);
push("A match's length (mean minutes, Armageddon included) and its moves per side (its longest board):", "");
table(
  ["Clock", ...roundNames.map((n) => `${n}: min`), ...roundNames.map((n) => `${n}: moves`)],
  CLOCKS.map((c) => {
    const rs = byClock(c);
    return [clockLabel(c), ...[0, 1, 2].map((i) => min(mean(matchesIn(rs, i).map((m) => m.seconds)))), ...[0, 1, 2].map((i) => f1(mean(matchesIn(rs, i).map((m) => m.turns))))];
  }),
);

push("## How boards end", "", "All mixes. A flag is a win on time; a flag against bare material is a draw.", "");
const endKinds = ["checkmate", "draw", "flag", "flag_draw", "safety_cap", "unfinished"] as const;
const endOf = (e: string) => (["stalemate", "repetition", "insufficient_material", "fifty_moves"].includes(e) ? "draw" : e);
table(
  ["Clock", "Round", "Mate", "Draw by the rules", "Flag (win)", "Flag (draw)", "Safety cap", "Left unfinished (clinched)"],
  CLOCKS.flatMap((c) =>
    [0, 1, 2].map((i) => {
      const ends = matchesIn(byClock(c), i).flatMap((m) => m.boardEnds.map(endOf));
      return [clockLabel(c), roundNames[i]!, ...endKinds.map((k) => pct(ends.filter((e) => e === k).length / Math.max(1, ends.length)))];
    }),
  ),
);

push("## Ties", "", "Rounds 1 and 2: a level match goes to the squad with more clock time left (a coin if exactly level). A drawn final goes to Armageddon.", "");
table(
  ["Clock", "R1 clinched early", "R1 level → time", "R2 level → time", "Level → coin", "Median time gap deciding a tie (s)", "Final drawn → Armageddon", "Armageddon won by Black", "Minutes per Armageddon"],
  CLOCKS.map((c) => {
    const rs = byClock(c);
    const share = (i: number, p: (m: MatchStat) => boolean) => {
      const ms = matchesIn(rs, i);
      return pct(ms.filter(p).length / Math.max(1, ms.length));
    };
    const ties = [0, 1].flatMap((i) => matchesIn(rs, i).filter((m) => m.how === "time" || m.how === "coin"));
    const arms = matchesIn(rs, 2).flatMap((m) => (m.armageddon ? [m.armageddon] : []));
    return [
      clockLabel(c),
      share(0, (m) => m.how === "clinch"),
      share(0, (m) => m.how === "time"),
      share(1, (m) => m.how === "time"),
      `${ties.filter((m) => m.how === "coin").length} of ${ties.length}`,
      ties.length ? f1(quantile(ties.filter((m) => m.how === "time").map((m) => m.timeGap / 1000), 0.5)) : "–",
      share(2, (m) => !!m.armageddon),
      arms.length ? `${pct(arms.filter((a) => a.winner === "b").length / arms.length)} of ${arms.length}` : "–",
      arms.length ? min(mean(arms.map((a) => a.seconds))) : "–",
    ];
  }),
);

push("## Clock pressure and missed actions", "");
table(
  ["Clock", "Actions per lobby", "Missed", "…the ceiling reached", "Flag falls per lobby", "Seats handed to a bot, per lobby"],
  CLOCKS.map((c) => {
    const rs = byClock(c);
    const a = rs.reduce((t, r) => t + r.actions, 0);
    const flags = rs.reduce((t, r) => t + r.rounds.flat().reduce((u, m) => u + m.boardEnds.filter((e) => e === "flag" || e === "flag_draw").length, 0), 0);
    return [clockLabel(c), f1(a / rs.length), pct(rs.reduce((t, r) => t + r.missed, 0) / Math.max(1, a)), pct(rs.reduce((t, r) => t + r.ceilingMisses, 0) / Math.max(1, a)), f1(flags / rs.length), f1(rs.reduce((t, r) => t + r.replaced, 0) / rs.length)];
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
