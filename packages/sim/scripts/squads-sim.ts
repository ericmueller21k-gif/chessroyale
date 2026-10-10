/**
 * Squads, phase 1: full 32-player lobbies played through the real rules (`@chessroyale/chess/squads`) at three skill
 * mixes and every Pace and Length vote. Every seat is a person played by a bot: the bot engine chooses (Stockfish's
 * top moves at `nodes`, then botPick at the player's skill), and a simple model stands in for a person's clock and
 * misses (below). The rules never ask the engine; the engine also judges which of two picks was better, for this
 * report only.
 *
 * Run: npm run sim:squads -- [lobbies per setting = 6] [nodes = 10000] (about 30 minutes on 4 cores). Writes reports/squads-sim.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_SETTINGS, SQUADS, botSkillSpread, shuffle, type Candidate } from "@chessroyale/core";
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
  noteActions,
  otherSide,
  planLobby,
  planMatch,
  reportWinner,
  resolveHalf,
  squadsLegalMoves,
  squadsRng,
  startArmageddon,
  visibleChoices,
  winnerSquad,
  type Bracket,
  type Squad,
  type SquadsEvent,
  type SquadsFormat,
  type SquadsLength,
  type SquadsMatch,
  type SquadsPlan,
  type SquadsRound,
} from "@chessroyale/chess/squads";
import { mean, pct, quantile } from "../src/stats.ts";

const LOBBIES = Number(process.argv[2] ?? 6);
const NODES = Number(process.argv[3] ?? 10_000);
const WORKERS = 4;
const library = JSON.parse(readFileSync(new URL("../../chess/data/openings.json", import.meta.url), "utf8")) as Opening[];

// ---- What's simulated ----

const MIXES = [
  { id: "strong", label: "Strong", range: [0.25, 2] as const },
  { id: "mixed", label: "Mixed", range: [0.25, 32] as const },
  { id: "casual", label: "Casual", range: [4, 32] as const },
] as const;
type MixId = (typeof MIXES)[number]["id"];
const LENGTHS: readonly SquadsLength[] = ["cap", "end"];
const PACES = SQUADS.paceSeconds;
/** Assumption (no real data yet): the chance a person misses an action, by pace. */
const MISS_CHANCE: Record<number, number> = { 10: 0.04, 15: 0.02, 25: 0.01 };
/** Assumption: a person who acts uses a random share of the clock, uniform in this range. */
const THINK_SHARE = [0.25, 1] as const;

interface Config {
  mix: MixId;
  pace: number;
  length: SquadsLength;
  /** A tuning check: another move cap for rounds 1 and 2 (and their Armageddons). */
  moveCap?: number;
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

  async candidates(fen: string): Promise<Candidate[]> {
    return candidatesFrom(await this.topMoves(fen));
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
  armageddon: { seconds: number; turns: number; winner: "w" | "b"; reason: string } | null;
}
interface LobbyStat {
  cfg: Config;
  rounds: { seconds: number; full: number; matches: MatchStat[] }[];
  totalSeconds: number;
  fullClockSeconds: number;
  actions: number;
  missed: number;
  replaced: number;
  pairs: PairStat[];
  finals: FinalStat[];
}

const showSeconds: Record<SquadsFormat, number> = { relay: SQUADS.moveShowSeconds, pairs: SQUADS.pairRevealSeconds, final: SQUADS.finalRevealSeconds };

async function simLobby(cfg: Config, index: number, lab: Lab): Promise<LobbyStat> {
  const seed = (index + 1) * 7919 + MIXES.findIndex((m) => m.id === cfg.mix) * 104729 + cfg.pace * 31 + (cfg.length === "cap" ? 0 : 17) + (cfg.moveCap ?? 0) * 7;
  const rng = squadsRng(seed, "sim");
  const range = MIXES.find((m) => m.id === cfg.mix)!.range;
  const s = cfg.moveCap ? { ...SQUADS, moveCap: cfg.moveCap } : SQUADS;
  const skills = shuffle(rng, botSkillSpread(32, { ...DEFAULT_SETTINGS, botSkillRange: range }));
  // Every seat a person (so a repeat no-show is handed to a bot), played by a bot at that person's skill.
  const parties = skills.map((skill, i) => ({ id: `p${i}`, members: [{ id: `p${i}`, name: `P${i}`, isBot: false, skill }] }));
  let squads: Squad[] = formSquads(parties, [], rng).squads;
  const plan: SquadsPlan = planLobby(seed, { start: (["standard", "same", "random"] as const)[index % 3]!, paceSeconds: cfg.pace, length: cfg.length }, library);
  let bracket: Bracket = drawBracket(squads.map((s) => s.id), rng);
  const out: LobbyStat = { cfg, rounds: [], totalSeconds: 0, fullClockSeconds: 0, actions: 0, missed: 0, replaced: 0, pairs: [], finals: [] };
  const player = (id: string) => squads.flatMap((s) => s.players).find((p) => p.id === id)!;

  async function play(m0: SquadsMatch): Promise<{ match: SquadsMatch; seconds: number; full: number }> {
    let m = m0;
    let seconds = 0;
    let full = 0;
    while (!m.result) {
      const duties = halfDuties(m);
      const fens = m.boards.map((b) => b.fen);
      const clock = m.paceSeconds;
      const acts = duties.duties.flatMap((d) =>
        d.players.map((p, slot) => {
          const who = player(p);
          const miss = !who.replacedByBot && rng() < (MISS_CHANCE[cfg.pace] ?? 0.02);
          return { d, p, slot, miss, t: miss ? clock : clock * (THINK_SHARE[0] + rng() * (THINK_SHARE[1] - THINK_SHARE[0])) };
        }),
      );
      acts.sort((a, b) => a.t - b.t);
      let inputs = NO_INPUTS;
      const think: Record<string, number> = {};
      for (const a of acts) {
        if (a.miss) continue;
        const fen = fens[a.d.board]!;
        const legal = squadsLegalMoves(fen);
        const cands = await lab.candidates(fen);
        const who = player(a.p);
        const skill = who.replacedByBot ? SQUADS.replacementBotSkill : (who.skill ?? SQUADS.replacementBotSkill);
        const partner = a.d.players[1 - a.slot] ?? null;
        const partnerChoice = partner ? (inputs.choices[partner] ?? null) : null;
        let move: string;
        if (a.d.role === "move") move = botRelayMove(rng, cands, skill, legal);
        else if (m.format === "pairs") move = botPairPick(rng, cands, skill, legal, partnerChoice);
        else if (a.d.role === "pick") {
          const seen = visibleChoices(m, inputs, a.d.side);
          const blockers = duties.duties.find((x) => x.role === "block")?.players ?? [];
          move = botFinalPick(rng, cands, skill, legal, partnerChoice, blockers.flatMap((b) => (seen[b] ? [seen[b]!] : [])));
        } else move = botFinalBlock(rng, cands, skill, legal, partnerChoice);
        const r = choose(m, inputs, a.p, move);
        if ("inputs" in r) {
          inputs = lockIn(r.inputs, a.p);
          think[a.p] = Math.round(a.t * 1000);
        }
      }
      const slowest = acts.length ? Math.max(...acts.map((a) => a.t)) : 0;
      seconds += Math.min(clock, slowest) + showSeconds[m.format];
      full += (acts.length ? clock : 0) + showSeconds[m.format];
      const res = resolveHalf(m, inputs, think);
      out.actions += res.acted.length + res.missed.length;
      out.missed += res.missed.length;
      const before = squads.flatMap((s) => s.players).filter((p) => p.replacedByBot).length;
      squads = noteActions(squads, res.acted, res.missed);
      out.replaced += squads.flatMap((s) => s.players).filter((p) => p.replacedByBot).length - before;
      for (const e of res.events) await judge(e, fens);
      m = res.match;
    }
    return { match: m, seconds, full };
  }

  async function judge(e: SquadsEvent, fens: readonly string[]) {
    if (e.kind === "pair" && e.picks) {
      const [e0, e1] = await lab.expected(fens[e.board]!, e.picks);
      const played = e.coin === 0 ? e0! : e1!;
      const other = e.coin === 0 ? e1! : e0!;
      out.pairs.push({ diff: Math.abs(e0! - e1!) * 100, weakerPlayed: played < other, missedSlot: e.missed.some(Boolean) });
    }
    if (e.kind === "pickblock" && e.picks) {
      const [e0, e1] = await lab.expected(fens[e.board]!, e.picks);
      const exp = [e0!, e1!];
      const placed = e.blocks.filter((b): b is string => !!b);
      const playedIdx = e.picks.indexOf(e.move);
      out.finals.push({
        mercy: e.mercy !== null,
        blocks: placed.length,
        blockHits: placed.filter((b) => e.picks!.includes(b)).length,
        anyHit: placed.some((b) => e.picks!.includes(b)),
        activeHit: e.hit !== null,
        activeHitBetter: e.hit !== null && exp[e.hit]! - exp[1 - e.hit]! >= 0.01,
        activeHitWorse: e.hit !== null && exp[1 - e.hit]! - exp[e.hit]! >= 0.01,
        cancelled: e.cancelled,
        forfeits: e.blockMissed.filter(Boolean).length,
        worsePlayed: exp[1 - playedIdx]! - exp[playedIdx]! >= 0.01,
      });
    }
  }

  const matchStat = (m: SquadsMatch, seconds: number): MatchStat => ({
    seconds,
    turns: Math.ceil(Math.max(...m.boards.map((b) => b.moves.length)) / 2),
    boardMoves: m.boards.map((b) => b.moves.length / 2),
    boardEnds: m.boards.map((b) => b.result?.reason ?? "unfinished"),
    how: m.result!.how,
    armageddon: null,
  });

  for (const round of [0, 1, 2] as SquadsRound[]) {
    const stats: MatchStat[] = [];
    let slowest = 0;
    let slowestFull = 0;
    for (const bm of bracket[round]!) {
      const pair = [squads[bm.squads[0]!]!, squads[bm.squads[1]!]!] as const;
      const played = await play(planMatch(plan, round, bm.index, pair, library, s));
      let m = played.match;
      const stat = matchStat(m, played.seconds);
      let seconds = played.seconds;
      let full = played.full;
      if (m.result!.winner === null) {
        const chooser = armageddonChooser(m);
        const white = botArmageddonColour() === "w" ? chooser : otherSide(chooser);
        const arm = await play(startArmageddon(m, white, armageddonStart(plan, m, library), s));
        const b = arm.match.boards[0]!;
        stat.armageddon = { seconds: arm.seconds, turns: Math.ceil(b.moves.length / 2), winner: arm.match.result!.winner === b.white ? "w" : "b", reason: b.result!.reason };
        seconds += SQUADS.armageddonIntroSeconds + arm.seconds;
        full += SQUADS.armageddonIntroSeconds + arm.full;
        m = arm.match;
      }
      stats.push(stat);
      slowest = Math.max(slowest, seconds);
      slowestFull = Math.max(slowestFull, full);
      bracket = reportWinner(bracket, round, bm.index, winnerSquad(m)!);
    }
    out.rounds.push({ seconds: slowest, full: slowestFull, matches: stats });
  }
  const votes = 3 * (SQUADS.voteSeconds + SQUADS.voteResultSeconds);
  out.totalSeconds = votes + out.rounds.reduce((s, r) => s + r.seconds, 0) + 2 * SQUADS.roundBreakSeconds;
  out.fullClockSeconds = votes + out.rounds.reduce((s, r) => s + r.full, 0) + 2 * SQUADS.roundBreakSeconds;
  return out;
}

// ---- Run every setting ----

/** The tuning check: a shorter cap, Mixed players, at the two faster paces. */
const TUNING_CAP = 25;
const configs: Config[] = [
  ...LENGTHS.flatMap((length) => PACES.flatMap((pace) => MIXES.map((m) => ({ mix: m.id, pace, length })))),
  ...[10, 15].map((pace) => ({ mix: "mixed" as MixId, pace, length: "cap" as SquadsLength, moveCap: TUNING_CAP })),
];
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
      results.push(await simLobby(job.cfg, job.i, lab));
      const done = results.length;
      const eta = ((Date.now() - started) / done) * (jobs.length - done);
      process.stdout.write(`lobby ${done}/${jobs.length} (${job.cfg.mix}, ${job.cfg.pace} s, ${job.cfg.length}) ~${Math.round(eta / 60000)} min left\n`);
    }
  }),
);
engines.forEach((e) => e.close());

// ---- The report ----

const min = (s: number) => (s / 60).toFixed(1);
const f1 = (x: number) => x.toFixed(1);
const sel = (p: (r: LobbyStat) => boolean) => results.filter((r) => !r.cfg.moveCap && p(r));
const tuning = results.filter((r) => r.cfg.moveCap);
const lengthName = (l: SquadsLength) => (l === "cap" ? `${SQUADS.moveCap}-move cap` : "To the end");
const mixName = (id: MixId) => MIXES.find((m) => m.id === id)!.label;
const roundNames = ["Round 1 (Relay)", "Round 2 (Pairs)", "Final"];
const allMatches = (rs: LobbyStat[], r: number) => rs.flatMap((x) => x.rounds[r]!.matches);

const lines: string[] = [];
const push = (...l: string[]) => lines.push(...l);
const table = (head: string[], rows: string[][]) => push(`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`), "");

push(
  "# Squads: bot simulation (phase 1)",
  "",
  `${results.length - tuning.length} full lobbies of 32 (8 squads of 4), ${LOBBIES} for every skill mix × Pace × Length (and ${tuning.length} more for a tuning check), from`,
  "`packages/sim/scripts/squads-sim.ts` (`npm run sim:squads`), through the real rules in `packages/chess/src/squads/`.",
  `Each lobby plays the whole bracket: round 1 Relay (4 matches on 4 boards), round 2 Pairs (2 matches on 2 boards),`,
  "the final (Pick and Block), and an Armageddon board after any tie. Start votes rotate between the normal start,",
  "one opening and random openings.",
  "",
  "**How the seats are played.** Every seat is a person played by a bot: the bot engine (Stockfish 19 lite at",
  `${NODES.toLocaleString("en")} nodes, its top ${SQUADS.bots.candidates} moves) then \`botPick\` at the person's skill, a temperature over each move's loss:`,
  "Strong T 0.25–2, Mixed T 0.25–32 (the usual bot spread), Casual T 4–32. The rules never ask the engine (legal",
  "moves and mate in one come from chess.js; a cap is decided by material). The engine also judges which of two",
  "picks was better, for this report only.",
  "",
  "**A person's clock and misses are assumptions** (there's no real Squads data yet): someone who acts uses a random",
  `share of the clock (uniform ${THINK_SHARE[0] * 100}%–${THINK_SHARE[1] * 100}%), and misses an action with chance ${Object.entries(MISS_CHANCE).map(([p, c]) => `${pct(c)} at ${p} s`).join(", ")}.`,
  "A half lasts as long as its slowest player (at most the clock), plus the show: " +
    `${SQUADS.moveShowSeconds} s for a Relay half's moves, ${SQUADS.pairRevealSeconds} s for the pair's reveal, ${SQUADS.finalRevealSeconds} s for the final's reveal.`,
  `The bracket waits for the slowest match of a round; ${SQUADS.roundBreakSeconds} s between rounds, ${f1(3 * (SQUADS.voteSeconds + SQUADS.voteResultSeconds))} s of votes before.`,
  "",
);

// Time.
push("## How long a lobby takes", "", "Minutes, averaged over the skill mixes (the bracket waits for each round's slowest match, Armageddon included).", "");
table(
  ["Length", "Pace", "Round 1", "Round 2", "Final", "Total", "Total, 90th pct", "Longest", "Total if every half ran the full clock"],
  LENGTHS.flatMap((l) =>
    PACES.map((p) => {
      const rs = sel((r) => r.cfg.length === l && r.cfg.pace === p);
      const tot = rs.map((r) => r.totalSeconds);
      return [
        lengthName(l),
        `${p} s`,
        ...[0, 1, 2].map((i) => min(mean(rs.map((r) => r.rounds[i]!.seconds)))),
        min(mean(tot)),
        min(quantile(tot, 0.9)),
        min(Math.max(...tot)),
        min(mean(rs.map((r) => r.fullClockSeconds))),
      ];
    }),
  ),
);
push("By skill mix (all paces):", "");
table(
  ["Length", "Mix", "Round 1", "Round 2", "Final", "Total (at 10 s)", "Total (at 15 s)", "Total (at 25 s)"],
  LENGTHS.flatMap((l) =>
    MIXES.map((mx) => {
      const rs = sel((r) => r.cfg.length === l && r.cfg.mix === mx.id);
      return [
        lengthName(l),
        mx.label,
        ...[0, 1, 2].map((i) => min(mean(rs.map((r) => r.rounds[i]!.seconds)))),
        ...PACES.map((p) => min(mean(rs.filter((r) => r.cfg.pace === p).map((r) => r.totalSeconds)))),
      ];
    }),
  ),
);

// Lengths in moves.
push("## Game lengths in moves", "", "Moves per side. A match's length is its longest board; boards left unfinished by a clinch count the moves they had.", "");
table(
  ["Length", "Mix", "R1 match", "R1 board", "R2 match", "R2 board", "Final", "Final, 90th pct", "Armageddon"],
  LENGTHS.flatMap((l) =>
    MIXES.map((mx) => {
      const rs = sel((r) => r.cfg.length === l && r.cfg.mix === mx.id);
      const fin = allMatches(rs, 2).map((m) => m.turns);
      const arm = [0, 1, 2].flatMap((i) => allMatches(rs, i).flatMap((m) => (m.armageddon ? [m.armageddon.turns] : [])));
      return [
        lengthName(l),
        mx.label,
        f1(mean(allMatches(rs, 0).map((m) => m.turns))),
        f1(mean(allMatches(rs, 0).flatMap((m) => m.boardMoves))),
        f1(mean(allMatches(rs, 1).map((m) => m.turns))),
        f1(mean(allMatches(rs, 1).flatMap((m) => m.boardMoves))),
        f1(mean(fin)),
        f1(quantile(fin, 0.9)),
        arm.length ? f1(mean(arm)) : "–",
      ];
    }),
  ),
);
push("How boards end (all mixes and paces):", "");
const endKinds = ["checkmate", "draw", "move_cap", "safety_cap", "unfinished"] as const;
const endOf = (e: string) => (["stalemate", "repetition", "insufficient_material", "fifty_moves"].includes(e) ? "draw" : e);
table(
  ["Length", "Round", "Mate", "Draw by the rules", "Move cap (material)", "Safety cap", "Left unfinished (clinched)"],
  LENGTHS.flatMap((l) =>
    [0, 1, 2].map((i) => {
      const ends = allMatches(sel((r) => r.cfg.length === l), i).flatMap((m) => m.boardEnds.map(endOf));
      return [lengthName(l), roundNames[i]!, ...endKinds.map((k) => pct(ends.filter((e) => e === k).length / Math.max(1, ends.length)))];
    }),
  ),
);

// Clinches and ties.
push("## Clinches and Armageddon", "");
table(
  ["Length", "Mix", "R1 clinched early", "R1 tied → Armageddon", "R2 tied → Armageddon", "Final drawn → Armageddon", "Armageddon won by Black", "Minutes per Armageddon"],
  LENGTHS.flatMap((l) =>
    MIXES.map((mx) => {
      const rs = sel((r) => r.cfg.length === l && r.cfg.mix === mx.id);
      const share = (i: number, p: (m: MatchStat) => boolean) => {
        const ms = allMatches(rs, i);
        return pct(ms.filter(p).length / Math.max(1, ms.length));
      };
      const arms = [0, 1, 2].flatMap((i) => allMatches(rs, i).flatMap((m) => (m.armageddon ? [m.armageddon] : [])));
      return [
        lengthName(l),
        mx.label,
        share(0, (m) => m.how === "clinch"),
        share(0, (m) => !!m.armageddon),
        share(1, (m) => !!m.armageddon),
        share(2, (m) => !!m.armageddon),
        arms.length ? `${pct(arms.filter((a) => a.winner === "b").length / arms.length)} of ${arms.length}` : "–",
        arms.length ? min(mean(arms.map((a) => a.seconds))) : "–",
      ];
    }),
  ),
);

// Pairs.
push(
  "## Round 2: how often the coin plays the weaker pick",
  "",
  "Per pair move (forced moves left out). \"Weaker\" is by the engine's expected score after each pick (1 point = 0.01).",
  "",
);
table(
  ["Mix", "Pair moves", "Picks 1+ point apart", "Coin played the weaker pick (1+ point)", "…weaker by 5+ points", "…weaker by 20+ points", "Moves with a missed slot"],
  MIXES.map((mx) => {
    const ps = sel((r) => r.cfg.mix === mx.id).flatMap((r) => r.pairs);
    const n = Math.max(1, ps.length);
    const weaker = (d: number) => pct(ps.filter((p) => p.weakerPlayed && p.diff >= d).length / n);
    return [mx.label, String(ps.length), pct(ps.filter((p) => p.diff >= 1).length / n), weaker(1), weaker(5), weaker(20), pct(ps.filter((p) => p.missedSlot).length / n)];
  }),
);

// The final.
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

// The tuning check.
push(
  `## Tuning check: a ${TUNING_CAP}-move cap`,
  "",
  `Mixed players, the cap at ${TUNING_CAP} moves for rounds 1 and 2 and their Armageddons (the final unchanged), against the ${SQUADS.moveCap}-move cap above.`,
  "",
);
table(
  ["Cap", "Pace", "Lobbies", "Round 1", "Round 2", "Final", "Total", "Total, 90th pct", "R1 tied", "R2 tied", "Boards decided by material (R1, R2)"],
  [10, 15].flatMap((p) =>
    [SQUADS.moveCap, TUNING_CAP].map((cap) => {
      const rs = cap === TUNING_CAP ? tuning.filter((r) => r.cfg.pace === p) : sel((r) => r.cfg.mix === "mixed" && r.cfg.pace === p && r.cfg.length === "cap");
      const tot = rs.map((r) => r.totalSeconds);
      const tied = (i: number) => {
        const ms = rs.flatMap((r) => r.rounds[i]!.matches);
        return pct(ms.filter((m) => m.armageddon).length / Math.max(1, ms.length));
      };
      const ends = rs.flatMap((r) => [0, 1].flatMap((i) => r.rounds[i]!.matches.flatMap((m) => m.boardEnds)));
      return [
        `${cap} moves`,
        `${p} s`,
        String(rs.length),
        ...[0, 1, 2].map((i) => min(mean(rs.map((r) => r.rounds[i]!.seconds)))),
        min(mean(tot)),
        min(quantile(tot, 0.9)),
        tied(0),
        tied(1),
        pct(ends.filter((e) => e === "move_cap").length / Math.max(1, ends.length)),
      ];
    }),
  ),
);

// Missed actions.
const actions = results.reduce((t, r) => t + r.actions, 0);
push("## Missed actions", "");
table(
  ["Pace", "Actions per lobby", "Missed", "Seats handed to a bot (3 misses in a row), per lobby"],
  PACES.map((p) => {
    const rs = sel((r) => r.cfg.pace === p);
    const a = rs.reduce((s, r) => s + r.actions, 0);
    return [`${p} s`, f1(a / rs.length), pct(rs.reduce((s, r) => s + r.missed, 0) / Math.max(1, a)), f1(rs.reduce((s, r) => s + r.replaced, 0) / rs.length)];
  }),
);
push(`(${actions} actions in all.) The "what this means for fun" section is written by hand below this line.`, "", "<!-- squads-sim: end of generated tables -->", "");

const path = new URL("../../../reports/squads-sim.md", import.meta.url);
let tail = "";
try {
  const old = readFileSync(path, "utf8");
  const at = old.indexOf("<!-- squads-sim: end of generated tables -->");
  if (at >= 0) tail = old.slice(at + "<!-- squads-sim: end of generated tables -->".length).replace(/^\n+/, "");
} catch {
  // A first run: no notes yet.
}
writeFileSync(path, lines.join("\n") + (tail ? `\n${tail}` : ""));
console.log(`Wrote reports/squads-sim.md (${Math.round((Date.now() - started) / 60000)} min)`);
