/**
 * The 50 v 50 rework's sim (design only, Nov 16; notes/designs/crowd-rework.md on branch design/crowd-rework). Plays real
 * games of chess on one board, 50 v 50, with the proposed rules, none of which exist in the game yet:
 * - a pick mode, chosen before the game: `strong` (the team's 3 most-picked moves; the best of them by the judge, or one at
 *   random among those within `STRONG_CLOSE` of it), `majority` (the most-picked; ties at random), `chaos` (one of the
 *   team's distinct picks, uniformly at random);
 * - no endings: the game plays to its end, or to the 60-move limit (a draw);
 * - equal cuts from each side (`SCHEDULES`), by score relative to your own team, down to a 1 v 1 that plays to the end;
 * - a soft reset: at each cut a survivor keeps `carry` of their score.
 * Bots of known strength (BOT_LOBBY's temperatures, Crowd's lean: botPickSpread, the game's own code) pick on their
 * team's turns from the judge's top 8 lines (Stockfish 19 lite, `NODES` a position). Each match writes one line to
 * reports/crowd-rework/<mode>-<lobby>-<carry>.jsonl; `summary` reads them all, applies the RP rule (Glicko expected vs
 * actual, with each tie band) and writes reports/crowd-rework.md.
 *
 *   npx tsx packages/sim/scripts/crowd-rework-sim.ts play <strong|majority|chaos> <strong|mixed|weak> [matches] [seed]
 *   npx tsx packages/sim/scripts/crowd-rework-sim.ts summary
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";
import { BOT_LOBBY, CROWD_BOTS, DEFAULT_SETTINGS, botLean, botPickSpread, botSkillForRating, mulberry32, openingAllowance, shuffle, type Rng } from "@chessroyale/core";
import { createNodeEngine } from "@chessroyale/chess/node";
import { spearman } from "../src/stats.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = root + "reports/crowd-rework/";

// ---------------- The proposed rules (the design's numbers) ----------------

type Cuts = readonly { after: number; keep: number }[];
/** Cut schedules (after Black's move `after`, leaving `keep` a side): 50 → 34 → 23 → 15 → 10 → 6 → 4 → 2 → 1. */
export const SCHEDULES: Record<string, Cuts> = {
  /** A: the first cut after move 10, as today; the 1 v 1 from move 39. */
  A: [10, 14, 18, 22, 26, 30, 34, 38].map((after, i) => ({ after, keep: [34, 23, 15, 10, 6, 4, 2, 1][i]! })),
  /** B: the first cut after move 14 (the opening allowance is gone by then); the 1 v 1 from move 40. */
  B: [14, 18, 22, 26, 30, 33, 36, 39].map((after, i) => ({ after, keep: [34, 23, 15, 10, 6, 4, 2, 1][i]! })),
};
/** What the live games use (who is still in picks the played move); the report replays every schedule and carry on them. */
const LIVE = { cuts: SCHEDULES.B!, carry: 0.5 };
/** The move limit: a game still going after Black's 60th move is a draw. */
export const MOVE_LIMIT = 60;
/** Strong: the top-3 moves within this much expected score of the best of them are "close" (one at random). */
export const STRONG_CLOSE = 0.03;
const NODES = 50_000;
const SIDE = 50;
/** Probe players seated in every lobby (2 each): the strong, average and weak player the RP table follows. */
const PROBES = { strong: 1900, average: 1200, weak: 700 } as const;
type Probe = keyof typeof PROBES;
type Mode = "strong" | "majority" | "chaos";
type Lobby = "strong" | "mixed" | "weak";

function lobbyRatings(rng: Rng, lobby: Lobby, n: number): number[] {
  const { min, max, step } = BOT_LOBBY.ratings;
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
  const clamp = (r: number) => Math.max(min, Math.min(max, Math.round(r / step) * step));
  return Array.from({ length: n }, () =>
    lobby === "strong" ? clamp(1750 + 150 * normal()) : lobby === "weak" ? clamp(850 + 150 * normal()) : clamp(min + rng() * (max - min)),
  );
}

/** One live match: the seats, and every seat's raw loss on each of its team's moves (cut or not), so any rule can be replayed. */
export interface MatchRow {
  mode: Mode;
  lobby: Lobby;
  seed: number;
  plies: number;
  result: "w" | "b" | "draw";
  end: string;
  /** Seats 0-49 White, 50-99 Black. */
  ratings: number[];
  probes: Record<number, Probe>;
  /** Per ply: the moving team's 50 raw losses × 10 (rounded), in seat order. */
  loss: number[][];
  /** Per ply: the moving team's seats (0-49 within the team) whose pick was a random legal move. */
  random: number[][];
  /** Per ply: the played move's raw loss × 10. */
  played: number[];
  /** At the move limit: White's expected score by the judge (the verdict an adjudication would give). */
  limitWhite?: number;
  secs: number;
}

/** The team's played move from its picks (move → count) and the judge's numbers (move → mover's expected score). */
export function playedMove(mode: Mode, rng: Rng, counts: Map<string, number>, expected: Map<string, number>): string {
  const moves = [...counts.keys()];
  if (mode === "chaos") return moves[Math.floor(rng() * moves.length)]!;
  if (mode === "majority") {
    const top = Math.max(...counts.values());
    const tied = moves.filter((m) => counts.get(m) === top);
    return tied[Math.floor(rng() * tied.length)]!;
  }
  const top3 = [...moves].sort((a, b) => counts.get(b)! - counts.get(a)! || expected.get(b)! - expected.get(a)!).slice(0, 3);
  const best = Math.max(...top3.map((m) => expected.get(m)!));
  const close = top3.filter((m) => expected.get(m)! >= best - STRONG_CLOSE - 1e-9);
  return close[Math.floor(rng() * close.length)]!;
}

async function play(mode: Mode, lobby: Lobby, matches: number, seed0: number) {
  mkdirSync(OUT, { recursive: true });
  const engine = await createNodeEngine({ nodes: NODES, hashMb: 16 });
  const file = OUT + `${mode}-${lobby}.jsonl`;
  const noRandom = { ...DEFAULT_SETTINGS, botRandomMoveChance: 0 };
  for (let m = 0; m < matches; m++) {
    const seed = seed0 + m;
    const t0 = Date.now();
    const rng = mulberry32(90_000 + seed * 7 + ["strong", "majority", "chaos"].indexOf(mode) * 333 + ["strong", "mixed", "weak"].indexOf(lobby) * 77);
    // (The same lobby for every pick mode at a seed: its ratings and seats come from a source of their own.)
    const seatRng = mulberry32(5_000 + seed * 31 + ["strong", "mixed", "weak"].indexOf(lobby));
    const probeList: { rating: number; probe?: Probe }[] = (Object.keys(PROBES) as Probe[]).flatMap((p) => [
      { rating: PROBES[p], probe: p },
      { rating: PROBES[p], probe: p },
    ]);
    const field: { rating: number; probe?: Probe }[] = shuffle(seatRng, [...probeList, ...lobbyRatings(seatRng, lobby, 2 * SIDE - probeList.length).map((rating) => ({ rating }))]);
    const skills = field.map((f) => botSkillForRating(f.rating));
    const alive = field.map(() => true);
    const score = field.map(() => 0);
    const rawTotal = field.map(() => 0);
    const chess = new Chess();
    let ply = 0;
    let cutIdx = 0;
    const row: MatchRow = {
      mode,
      lobby,
      seed,
      plies: 0,
      result: "draw",
      end: "",
      ratings: field.map((f) => f.rating),
      probes: Object.fromEntries(field.flatMap((f, i) => (f.probe ? [[i, f.probe]] : []))),
      loss: [],
      random: [],
      played: [],
      secs: 0,
    };
    while (true) {
      const fen = chess.fen();
      const side = chess.turn();
      const base = side === "w" ? 0 : SIDE;
      const moveNo = Math.floor(ply / 2) + 1;
      const legal = chess.moves({ verbose: true }).map((x) => x.from + x.to + (x.promotion ?? ""));
      const top = await engine.topMoves(fen, DEFAULT_SETTINGS.botCandidateMoves);
      const expected = new Map(top.map((t) => [t.move, t.expected]));
      let best = Math.max(...top.map((t) => t.expected));
      const lossOf = () => new Map([...expected].map(([mv, e]) => [mv, 100 * (best - e)]));
      let losses = lossOf();
      const cands = top.map((t) => ({ move: t.move, loss: losses.get(t.move)! }));
      const lean = botLean(rng, cands, CROWD_BOTS);
      // Every seat of the team picks (the cut ones too, for the replays); the game's 2% random move, flagged.
      const randoms: number[] = [];
      const picks = Array.from({ length: SIDE }, (_, i) => {
        if (rng() < DEFAULT_SETTINGS.botRandomMoveChance) {
          randoms.push(i);
          return legal[Math.floor(rng() * legal.length)]!;
        }
        return botPickSpread(rng, cands, skills[base + i]!, legal, CROWD_BOTS, lean, noRandom);
      });
      const off = [...new Set(picks.filter((p) => !expected.has(p)))];
      if (off.length) {
        for (const sc of await engine.scoreMoves(fen, off)) expected.set(sc.move, sc.expected);
        for (const p of off) if (!expected.has(p)) expected.set(p, 0);
        best = Math.max(...expected.values());
        losses = lossOf();
      }
      row.loss.push(picks.map((p) => Math.round(10 * losses.get(p)!)));
      row.random.push(randoms);
      // The played move, from the picks of those still in (the live rule).
      const allow = openingAllowance(moveNo);
      const inTeam = picks.map((_, i) => i).filter((i) => alive[base + i]);
      const counted = inTeam.map((i) => Math.max(0, losses.get(picks[i]!)! - allow));
      const avg = counted.reduce((a, b) => a + b, 0) / counted.length;
      inTeam.forEach((i, k) => {
        score[base + i]! += avg - counted[k]!;
        rawTotal[base + i]! += losses.get(picks[i]!)!;
      });
      const counts = new Map<string, number>();
      for (const i of inTeam) counts.set(picks[i]!, (counts.get(picks[i]!) ?? 0) + 1);
      const mv = playedMove(mode, rng, counts, expected);
      row.played.push(Math.round(10 * losses.get(mv)!));
      chess.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] });
      ply++;
      if (chess.isGameOver()) {
        row.end = chess.isCheckmate() ? "mate" : chess.isStalemate() ? "stalemate" : chess.isThreefoldRepetition() ? "repetition" : chess.isInsufficientMaterial() ? "material" : "fifty";
        row.result = chess.isCheckmate() ? side : "draw";
        break;
      }
      if (ply >= 2 * MOVE_LIMIT) {
        row.end = "limit";
        const t = await engine.topMoves(chess.fen(), 1);
        if (t[0]) row.limitWhite = Math.round(1000 * (chess.turn() === "w" ? t[0].expected : 1 - t[0].expected)) / 1000;
        break;
      }
      const cut = LIVE.cuts[cutIdx];
      if (cut && ply === 2 * cut.after) {
        for (const b of [0, SIDE]) {
          const order = shuffle(rng, Array.from({ length: SIDE }, (_, i) => b + i).filter((i) => alive[i])).sort((x, y) => score[y]! - score[x]! || rawTotal[x]! - rawTotal[y]!);
          order.forEach((i, k) => {
            if (k >= cut.keep) alive[i] = false;
            else score[i]! *= LIVE.carry;
          });
        }
        cutIdx++;
      }
    }
    row.plies = ply;
    row.secs = Math.round((Date.now() - t0) / 1000);
    appendFileSync(file, JSON.stringify(row) + "\n");
    console.log(`${mode} ${lobby} #${m + 1}/${matches}: ${row.end} ${row.result} at move ${Math.ceil(ply / 2)}, ${row.secs} s`);
  }
  engine.close();
}

// ---------------- Replaying a match under a rule ----------------

interface Placed {
  r: number;
  team: "w" | "b";
  probe?: Probe;
  place: number;
  cutAt: number | null;
  atCut: number[];
  moves: number;
  counted: number;
  raw: number;
  /** Cut in a round where they played a random move. */
  randomCut: boolean;
}
export interface Replay {
  row: MatchRow;
  players: Placed[];
  /** Cuts made before the game ended; how many a side were still in at the end. */
  cutsMade: number;
  leftAtEnd: number;
  /** Lines decided by an exact tie (the last one through level with the first one out). */
  tiedLines: number;
  lines: number;
}

/** A deterministic 0-1 number for a seat (the replays' last tie-break, instead of a coin). */
const seatHash = (seed: number, i: number) => mulberry32(seed * 1_000 + i)();

/**
 * How a seat's losses are read: `game` as the bots played; `norandom` with the bots' 2% random moves counted as no loss (no
 * real player hands over a move to chance); `wider` scaled by rating, 2^((1150 − r) / 600) (×1.7 at 700, ×0.4 at 1900), as if
 * players' strength showed about four times as much as the bots' compressed spread (a sensitivity check, not a model).
 */
export type Reading = "game" | "norandom" | "wider";

export function replay(row: MatchRow, cuts: Cuts, carry: number, reading: Reading = "game"): Replay {
  const n = row.ratings.length;
  const alive = Array(n).fill(true) as boolean[];
  const score = Array(n).fill(0) as number[];
  const counted = Array(n).fill(0) as number[];
  const raw = Array(n).fill(0) as number[];
  const moves = Array(n).fill(0) as number[];
  const atCut: number[][] = Array.from({ length: n }, () => []);
  const cutAt: (number | null)[] = Array(n).fill(null);
  const randomIn = Array(n).fill(false) as boolean[];
  const randomCut = Array(n).fill(false) as boolean[];
  let cutIdx = 0;
  let tiedLines = 0;
  let lines = 0;
  for (let p = 0; p < row.plies; p++) {
    const base = p % 2 === 0 ? 0 : SIDE;
    const allow = openingAllowance(Math.floor(p / 2) + 1);
    const ls = row.loss[p]!;
    const ins = ls.map((_, i) => i).filter((i) => alive[base + i]);
    const rnd0 = new Set(row.random[p]);
    const lossAt = (i: number) =>
      reading === "norandom" && rnd0.has(i) ? 0 : reading === "wider" ? (ls[i]! / 10) * 2 ** ((1150 - row.ratings[base + i]!) / 600) : ls[i]! / 10;
    const c = ins.map((i) => Math.max(0, lossAt(i) - allow));
    const avg = c.reduce((a, b) => a + b, 0) / c.length;
    const rnd = new Set(row.random[p]);
    ins.forEach((i, k) => {
      const s = base + i;
      score[s]! += avg - c[k]!;
      counted[s]! += c[k]!;
      raw[s]! += lossAt(i);
      moves[s]!++;
      if (rnd.has(i)) randomIn[s] = true;
    });
    const cut = cuts[cutIdx];
    if (cut && p + 1 === 2 * cut.after && p + 1 < row.plies) {
      for (const b of [0, SIDE]) {
        const order = Array.from({ length: SIDE }, (_, i) => b + i)
          .filter((i) => alive[i])
          .sort((x, y) => score[y]! - score[x]! || raw[x]! - raw[y]! || seatHash(row.seed, x) - seatHash(row.seed, y));
        if (order.length > cut.keep) {
          lines++;
          if (Math.abs(score[order[cut.keep - 1]!]! - score[order[cut.keep]!]!) < 1e-9) tiedLines++;
        }
        order.forEach((i, k) => {
          atCut[i]!.push(score[i]!);
          if (k >= cut.keep) {
            alive[i] = false;
            cutAt[i] = cutIdx;
            randomCut[i] = randomIn[i]!;
          } else score[i]! *= carry;
          randomIn[i] = false;
        });
      }
      cutIdx++;
    }
  }
  const side = (i: number): "w" | "b" => (i < SIDE ? "w" : "b");
  const perMove = (i: number) => counted[i]! / Math.max(1, moves[i]!);
  const sideRank = (i: number) => (row.result === "draw" ? 0 : side(i) === row.result ? 0 : 1);
  const order = [
    ...[...Array(n).keys()].filter((i) => alive[i]).sort((a, b) => sideRank(a) - sideRank(b) || score[b]! - score[a]! || perMove(a) - perMove(b)),
    ...[...cuts.keys()].reverse().flatMap((k) =>
      [...Array(n).keys()].filter((i) => cutAt[i] === k).sort((a, b) => atCut[b]![k]! - atCut[a]![k]! || raw[a]! - raw[b]!),
    ),
  ];
  const place = new Map(order.map((s, i) => [s, i + 1]));
  return {
    row,
    cutsMade: cutIdx,
    leftAtEnd: alive.filter((a, i) => a && i < SIDE).length,
    tiedLines,
    lines,
    players: row.ratings.map((r, i) => ({
      r,
      team: side(i),
      ...(row.probes[i] ? { probe: row.probes[i] } : {}),
      place: place.get(i)!,
      cutAt: cutAt[i]!,
      atCut: atCut[i]!,
      moves: moves[i]!,
      counted: counted[i]!,
      raw: raw[i]!,
      randomCut: randomCut[i]!,
    })),
  };
}

// ---------------- The report ----------------

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const q = (xs: readonly number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))] ?? 0;
};
const pct = (x: number) => `${Math.round(100 * x)}%`;
const f1 = (x: number) => x.toFixed(1);
const sgn = (x: number) => `${x >= 0 ? "+" : ""}${f1(x)}`;

/** Glicko-1's expected score of a player rated `a` against `b` (both settled, RD 60). */
const RD = 60;
const gRD = 1 / Math.sqrt(1 + (3 * (Math.log(10) / 400) ** 2 * RD * RD) / Math.PI ** 2);
const expectedScore = (a: number, b: number) => 1 / (1 + 10 ** ((-gRD * (a - b)) / 400));
/** RP for one match: 40 × (actual − expected), averaged over every other player (mode-ranks.md's rule, no catch-up). */
const RP_K = 40;

/** i against j: 1 ahead, 0 behind, ½ when the cut that split them came within `band` points of relative score. */
function pairScore(i: Placed, j: Placed, band: number): number {
  const ahead = i.place < j.place ? 1 : 0;
  if (band <= 0 || i.cutAt === j.cutAt) return ahead;
  const k = Math.min(i.cutAt ?? Infinity, j.cutAt ?? Infinity);
  const a = i.atCut[k];
  const b = j.atCut[k];
  if (a === undefined || b === undefined) return ahead;
  return Math.abs(a - b) <= band + 1e-9 ? 0.5 : ahead;
}
function rpOf(rp: Replay, idx: number, band: number): number {
  const me = rp.players[idx]!;
  let s = 0;
  let e = 0;
  rp.players.forEach((o, j) => {
    if (j === idx) return;
    s += pairScore(me, o, band);
    e += expectedScore(me.r, o.r);
  });
  return (RP_K * (s - e)) / (rp.players.length - 1);
}

/** The best player: lowest counted loss a move among those who survived at least half the cuts made. */
function bestOf(rp: Replay): Placed | null {
  const need = Math.ceil(rp.cutsMade / 2);
  const ok = rp.players.filter((p) => (p.cutAt === null ? rp.cutsMade : p.cutAt) >= need && p.moves > 0);
  return [...ok].sort((a, b) => a.counted / a.moves - b.counted / b.moves)[0] ?? null;
}

function rowsAll(): MatchRow[] {
  if (!existsSync(OUT)) return [];
  return readdirSync(OUT)
    .filter((f) => f.endsWith(".jsonl"))
    .flatMap((f) => readFileSync(OUT + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as MatchRow));
}

/** The recommended rule (the report's sections 3-5 use it). */
const REC = { schedule: "B", carry: 0.5, band: 1 };

function cutStats(rps: Replay[], lobby: Lobby) {
  const rho = mean(rps.map((r) => -spearman(r.players.map((p) => p.r), r.players.map((p) => p.place))));
  let in5 = 0;
  let won = 0;
  let top3 = 0;
  let above = 0;
  let pairs = 0;
  let tied = 0;
  let lines = 0;
  let cut = 0;
  let cutRandom = 0;
  for (const r of rps) {
    const byR = [...r.players].sort((a, b) => b.r - a.r);
    in5 += byR.slice(0, 5).filter((p) => p.cutAt === null).length / 5;
    const topR = byR[0]!.r;
    const strongest = r.players.filter((p) => p.r === topR);
    won += strongest.filter((p) => p.place === 1).length / strongest.length;
    top3 += strongest.filter((p) => p.place <= 3).length / strongest.length;
    if (lobby === "mixed")
      for (const a of r.players)
        if (a.r >= 1800)
          for (const b of r.players)
            if (b.r <= 900) {
              pairs++;
              if (a.place < b.place) above++;
            }
    tied += r.tiedLines;
    lines += r.lines;
    for (const p of r.players)
      if (p.cutAt !== null) {
        cut++;
        if (p.randomCut) cutRandom++;
      }
  }
  return {
    rho,
    in5: in5 / rps.length,
    won: won / rps.length,
    top3: top3 / rps.length,
    above: pairs ? pct(above / pairs) : "-",
    tied: tied / Math.max(1, lines),
    cutRandom: cutRandom / Math.max(1, cut),
  };
}

function summary() {
  const rows = rowsAll();
  const modes: Mode[] = ["strong", "majority", "chaos"];
  const lobbies: Lobby[] = ["mixed", "strong", "weak"];
  const carries = [0, 0.25, 0.5, 0.75, 1];
  const bands = [0, 0.5, 1, 2, 4];
  const rec = (r: MatchRow) => replay(r, SCHEDULES[REC.schedule]!, REC.carry);
  const live = (r: MatchRow) => replay(r, LIVE.cuts, LIVE.carry);
  const sched = (k: string) => SCHEDULES[k]!.map((c) => c.after).join(", ");
  const out: string[] = [
    "# 50 v 50 rework: pick modes, cuts to a 1 v 1, the soft reset, RP (sim, Nov 16, 2026)",
    "",
    "Written by `npx tsx packages/sim/scripts/crowd-rework-sim.ts summary` from `reports/crowd-rework/*.jsonl` (branch",
    "`design/crowd-rework`; none of these rules is in the game). **How:** 100 bots of known rating on one board, 50 a side, real",
    `chess judged by Stockfish 19 lite at ${NODES / 1000}k nodes (the top 8 lines; a pick off them scored on its own). Bots pick as the`,
    "game's 50 v 50 bots do (BOT_LOBBY's temperature for their rating, the team turn's shared lean, `botPickSpread`, a random legal",
    "move 2% of the time). Each lobby seats 6 probe players (2 each at " + `${PROBES.strong}, ${PROBES.average} and ${PROBES.weak}) among 94 from its curve: **mixed** uniform`,
    "600-2200, **strong** N(1750, 150), **weak** N(850, 150). The live games cut by schedule " + `${Object.keys(SCHEDULES).find((k) => SCHEDULES[k] === LIVE.cuts)} with ${pct(LIVE.carry)} carried (who is still in picks`,
    "the played move). Every seat's loss on every one of its team's moves is kept, cut or not, so each schedule, carry and tie band",
    "below is **replayed on the same games** (paired; the played moves stay the live ones). A round score is the team's average",
    "counted loss less yours (counted: after the opening allowance), summed over the round; 50 v 50's soft cap, streaks, rare finds",
    "and shared relief are left out. Cuts leave 34, 23, 15, 10, 6, 4, 2, 1 a side; " + `**A**: after moves ${sched("A")}; **B**: after ${sched("B")}.`,
    `A game still going after move ${MOVE_LIMIT} is a draw. Strong's \"close\": within ${STRONG_CLOSE} expected score of the best of the top 3.`,
    "",
    `Matches: ${rows.length} (${modes.map((m) => `${m} ${rows.filter((r) => r.mode === m).length}`).join(", ")}). Median ${q(rows.map((r) => r.secs), 0.5)} s a match on one core.`,
    "",
    "## 1. The game by pick mode (live games)",
    "",
    "| Pick mode | Lobby | Matches | Over before the 1 v 1 | Draw at move 60 | Mate | Other draw | Median end (move), 10th-90th | Played move's mean loss | Played moves giving 25+ a game |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const m of modes)
    for (const l of lobbies) {
      const rs = rows.filter((r) => r.mode === m && r.lobby === l);
      if (!rs.length) continue;
      const moves = rs.map((r) => Math.ceil(r.plies / 2));
      const early = rs.filter((r) => live(r).leftAtEnd > 1).length;
      const limit = rs.filter((r) => r.end === "limit").length;
      const mates = rs.filter((r) => r.end === "mate").length;
      const pl = rs.map((r) => mean(r.played) / 10);
      out.push(
        `| ${m} | ${l} | ${rs.length} | ${pct(early / rs.length)} | ${pct(limit / rs.length)} | ${pct(mates / rs.length)} | ${pct((rs.length - limit - mates) / rs.length)} | ${q(moves, 0.5)} (${q(moves, 0.1)}-${q(moves, 0.9)}) | ${f1(mean(pl))} | ${f1(mean(rs.map((r) => r.played.filter((x) => x >= 250).length)))} |`,
      );
    }
  const lim = rows.filter((r) => r.end === "limit" && r.limitWhite !== undefined);
  if (lim.length) {
    const clear = (t: number) => lim.filter((r) => Math.abs(r.limitWhite! - 0.5) >= t).length / lim.length;
    out.push(
      "",
      `**At the move limit, the judge's verdict** (${lim.length} games that reached it, from the second batch, which recorded it): one side at`,
      `75%+ expected score in ${pct(clear(0.25))}, 90%+ in ${pct(clear(0.4))}; within 60-40 in ${pct(lim.filter((r) => Math.abs(r.limitWhite! - 0.5) < 0.1).length / lim.length)}.`,
    );
  }
  out.push(
    "",
    "## 2. The cut's luck: schedule and carry (pick modes pooled)",
    "",
    "**Rank corr.**: Spearman's rho of true rating and finish, per match, averaged (1: the field finishes in order of strength).",
    "**Top 5 in**: the lobby's five highest-rated, the share still in when the game ends. **Strongest 1st / top 3**: the highest-rated",
    "player. **1800+ over 900-**: in the mixed lobby, how often a player rated 1800+ finishes above one rated 900 or less. **Tied lines**: a",
    "cut whose line fell between two exactly level scores (decided by the tie-break). **Cut with a random move**: of those cut, the",
    "share who played the bots' 2% random move that round (luck no real player has in that form). Carry 100% is today's rule (scores",
    "carry all game) for comparison.",
    "",
    "| Lobby | Schedule | Carry | Rank corr. | Top 5 in | Strongest 1st / top 3 | 1800+ over 900- | Tied lines | Cut with a random move |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const l of lobbies)
    for (const k of Object.keys(SCHEDULES))
      for (const c of carries) {
        const rs = rows.filter((r) => r.lobby === l);
        if (!rs.length) continue;
        const st = cutStats(rs.map((r) => replay(r, SCHEDULES[k]!, c)), l);
        out.push(`| ${l} | ${k} | ${pct(c)} | ${st.rho.toFixed(2)} | ${pct(st.in5)} | ${pct(st.won)} / ${pct(st.top3)} | ${st.above} | ${pct(st.tied)} | ${pct(st.cutRandom)} |`);
      }
  out.push("", `By pick mode (schedule ${REC.schedule}, carry ${pct(REC.carry)}):`, "", "| Pick mode | Lobby | Rank corr. | Top 5 in | Strongest 1st / top 3 | 1800+ over 900- |", "| --- | --- | --- | --- | --- | --- |");
  for (const m of modes)
    for (const l of lobbies) {
      const rs = rows.filter((r) => r.lobby === l && r.mode === m);
      if (!rs.length) continue;
      const st = cutStats(rs.map(rec), l);
      out.push(`| ${m} | ${l} | ${st.rho.toFixed(2)} | ${pct(st.in5)} | ${pct(st.won)} / ${pct(st.top3)} | ${st.above} |`);
    }
  out.push(
    "",
    `**How much of this is the bots?** The same games, schedule ${REC.schedule}, read two other ways: \`norandom\` (the bots' 2% random moves count as no`,
    "loss) and `wider` (each seat's losses scaled by 2^((1150 − rating) / 600): ×1.7 at 700, ×0.4 at 1900, as if real players' strength",
    "showed about four times more than the bots'; a sensitivity check, not a model of people).",
    "",
    "| Lobby | Reading | Carry | Rank corr. | Top 5 in | Strongest 1st / top 3 | 1800+ over 900- |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const l of lobbies)
    for (const reading of ["norandom", "wider"] as const)
      for (const c of [0, 0.5, 1]) {
        const rs = rows.filter((r) => r.lobby === l);
        if (!rs.length) continue;
        const st = cutStats(rs.map((r) => replay(r, SCHEDULES[REC.schedule]!, c, reading)), l);
        out.push(`| ${l} | ${reading} | ${pct(c)} | ${st.rho.toFixed(2)} | ${pct(st.in5)} | ${pct(st.won)} / ${pct(st.top3)} | ${st.above} |`);
      }
  // Per-move loss by rating: how far apart the bots' play really is.
  out.push("", "What a move gives away, by rating (all seats, all moves, counted after the allowance; the spread a cut has to see through):", "", "| Rating | Moves | Mean counted loss a move | Its sd | Moves giving 25+ |", "| --- | --- | --- | --- | --- |");
  for (const [lo, hi] of [[600, 800], [900, 1100], [1200, 1400], [1500, 1700], [1800, 2000], [2100, 2200]] as const) {
    const xs: number[] = [];
    for (const r of rows)
      for (let p = 0; p < r.plies; p++) {
        const base = p % 2 === 0 ? 0 : SIDE;
        const allow = openingAllowance(Math.floor(p / 2) + 1);
        r.loss[p]!.forEach((x, i) => {
          const rt = r.ratings[base + i]!;
          if (rt >= lo && rt <= hi) xs.push(Math.max(0, x / 10 - allow));
        });
      }
    const mu = mean(xs);
    out.push(`| ${lo}-${hi} | ${xs.length} | ${f1(mu)} | ${f1(Math.sqrt(mean(xs.map((x) => (x - mu) ** 2))))} | ${pct(xs.filter((x) => x >= 25).length / Math.max(1, xs.length))} |`);
  }
  // The podium's two titles.
  out.push("", `## 3. Winner and best player (schedule ${REC.schedule}, carry ${pct(REC.carry)})`, "", "Winner: 1st place of a decided game (a draw has none). Best: the lowest counted loss a move among those who survived at least half the cuts made.", "", "| Lobby | Decided games | Winner's rating (median) | Best player's rating (median) | Best = winner | Best on the podium (top 3) | Best's place (median) |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const l of lobbies) {
    const rps = rows.filter((r) => r.lobby === l).map(rec);
    const winners: number[] = [];
    const bests: Placed[] = [];
    let same = 0;
    for (const r of rps) {
      const b = bestOf(r);
      if (b) bests.push(b);
      if (r.row.result !== "draw") {
        const w = r.players.find((p) => p.place === 1)!;
        winners.push(w.r);
        if (b === w) same++;
      }
    }
    out.push(`| ${l} | ${winners.length} of ${rps.length} | ${winners.length ? q(winners, 0.5) : "-"} | ${q(bests.map((b) => b.r), 0.5)} | ${winners.length ? pct(same / winners.length) : "-"} | ${pct(bests.filter((b) => b.place <= 3).length / Math.max(1, bests.length))} | ${q(bests.map((b) => b.place), 0.5)} |`);
  }
  // RP.
  const gaps: number[] = [];
  for (const r of rows.map(rec))
    for (let k = 0; k < r.cutsMade; k++)
      for (const t of ["w", "b"] as const) {
        const faced = r.players.filter((p) => p.team === t && p.atCut.length > k).map((p) => p.atCut[k]!).sort((a, b) => b - a);
        const keep = SCHEDULES[REC.schedule]![k]!.keep;
        if (faced.length > keep) gaps.push(Math.abs(faced[keep - 1]! - faced[keep]!));
      }
  out.push(
    "",
    "## 4. RP per match",
    "",
    `Glicko-1 expected vs actual against the other 99 (all settled, RD ${RD}), RP = ${RP_K} × (S − E), no catch-up (mode-ranks.md's rule). A pair`,
    "split by a cut scores ½ when their relative scores at that cut were within the **tie band** (points). The gap between the last one",
    `through and the first one out at a cut (schedule ${REC.schedule}, carry ${pct(REC.carry)}): median ${q(gaps, 0.5).toFixed(2)}, 10th ${q(gaps, 0.1).toFixed(2)}, 90th ${q(gaps, 0.9).toFixed(2)} points.`,
    "",
    `Mean RP (10th to 90th) for the probe players, by tie band (schedule ${REC.schedule}, carry ${pct(REC.carry)}):`,
    "",
    `| Lobby | Tie band | Strong (${PROBES.strong}) | Average (${PROBES.average}) | Weak (${PROBES.weak}) | Pairs split by a cut that become draws |`,
    "| --- | --- | --- | --- | --- | --- |",
  );
  const cell = (xs: number[]) => (xs.length ? `${sgn(mean(xs))} (${f1(q(xs, 0.1))} to ${f1(q(xs, 0.9))})` : "-");
  for (const l of lobbies) {
    const rps = rows.filter((r) => r.lobby === l).map(rec);
    for (const b of bands) {
      const by: Record<Probe, number[]> = { strong: [], average: [], weak: [] };
      let split = 0;
      let drawn = 0;
      for (const r of rps) {
        r.players.forEach((p, i) => {
          if (p.probe) by[p.probe].push(rpOf(r, i, b));
        });
        if (b > 0)
          for (let i = 0; i < r.players.length; i++)
            for (let j = i + 1; j < r.players.length; j++) {
              const a = r.players[i]!;
              const c = r.players[j]!;
              if (a.cutAt === c.cutAt) continue;
              split++;
              if (pairScore(a, c, b) === 0.5) drawn++;
            }
      }
      out.push(`| ${l} | ${b} | ${cell(by.strong)} | ${cell(by.average)} | ${cell(by.weak)} | ${b > 0 ? pct(drawn / Math.max(1, split)) : "-"} |`);
    }
  }
  out.push("", `By carry (schedule ${REC.schedule}, tie band ${REC.band}); the last column: RP's spread over the whole field (sd):`, "", `| Lobby | Carry | Strong (${PROBES.strong}) | Average (${PROBES.average}) | Weak (${PROBES.weak}) | Field sd |`, "| --- | --- | --- | --- | --- | --- |");
  for (const l of lobbies)
    for (const c of carries) {
      const rps = rows.filter((r) => r.lobby === l).map((r) => replay(r, SCHEDULES[REC.schedule]!, c));
      const by: Record<Probe, number[]> = { strong: [], average: [], weak: [] };
      const all: number[] = [];
      for (const r of rps)
        r.players.forEach((p, i) => {
          const v = rpOf(r, i, REC.band);
          all.push(v);
          if (p.probe) by[p.probe].push(v);
        });
      const mu = mean(all);
      out.push(`| ${l} | ${pct(c)} | ${cell(by.strong)} | ${cell(by.average)} | ${cell(by.weak)} | ${f1(Math.sqrt(mean(all.map((x) => (x - mu) ** 2))))} |`);
    }
  out.push("", `The probes' RP if strength showed more (the \`wider\` reading of section 2; schedule ${REC.schedule}, carry ${pct(REC.carry)}, tie band ${REC.band}):`, "", `| Lobby | Strong (${PROBES.strong}) | Average (${PROBES.average}) | Weak (${PROBES.weak}) |`, "| --- | --- | --- | --- |");
  for (const l of lobbies) {
    const by: Record<Probe, number[]> = { strong: [], average: [], weak: [] };
    for (const r of rows.filter((x) => x.lobby === l).map((x) => replay(x, SCHEDULES[REC.schedule]!, REC.carry, "wider")))
      r.players.forEach((p, i) => {
        if (p.probe) by[p.probe].push(rpOf(r, i, REC.band));
      });
    out.push(`| ${l} | ${cell(by.strong)} | ${cell(by.average)} | ${cell(by.weak)} |`);
  }
  writeFileSync(root + "reports/crowd-rework.md", out.join("\n") + "\n");
  console.log(out.join("\n"));
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "summary") summary();
else if (cmd === "play") await play(args[0] as Mode, args[1] as Lobby, Number(args[2] ?? 4), Number(args[3] ?? 1));
else console.log("usage: crowd-rework-sim.ts play <strong|majority|chaos> <strong|mixed|weak> [matches] [seed] | summary");
process.exit(0);
