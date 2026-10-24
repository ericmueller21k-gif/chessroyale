/**
 * The 50 v 50 scoring rework's sim, step 1: recording matches (docs/decisions/2026-10-24-crowd-scoring.md). Step 2,
 * scoring them under each variant, is crowd-scoring-sim.ts.
 *
 *   npx tsx packages/sim/scripts/crowd-scoring-trace.ts <maia|bots> <matches> <seed>
 *       Plays Crowd 50 v 50 games (the usual start) and records every pick: 100 players, 50 a side, each picking every
 *       move of their side. `maia`: each player is Maia at a fixed rating, drawn from MAIA_RATINGS, sampled from Maia's
 *       own probabilities (the human-like main test). `bots`: the game's own bots (botSkillSpread, botChoose). The judge
 *       scores every pick as the runner does (its top moves, then every other pick), the exchange check marks material
 *       slips, and the most popular pick of the side's 50 is played. A game that ends before PLIES starts again from the
 *       start, as the runner's replaceBoard does, and so does a decided one (DECIDED). Rows go to reports/crowd-scoring/<kind>-<seed>.jsonl (gzip them to keep them: the sim reads both).
 *
 * One simplification, the same for every variant: every player keeps picking after a cut, and the move played is the
 * popular pick of all 50, so the games are the same under every scoring (common random numbers: the variants differ
 * only in how they score, which is what is being compared).
 */
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS, bestOf, botChoose, botSkillSpread, modeSettings, mulberry32, shuffle, type Settings } from "@chessroyale/core";
import { applyMove, gameEnd, HumanUciEngine, legalMoves, materialSlips, START_FEN, type UciTransport } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import type { MatchRow, Ply } from "./crowd-scoring-sim.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = root + "reports/crowd-scoring/";
/** Plies recorded per match: the team final's knockouts (20 before the first cut, then 2 a cut) and a few more. */
const PLIES = 46;
/** The Maia players' ratings: about 1100 to 1900, evenly. */
const MAIA_RATINGS = [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900];
const JUDGE_NODES = 150_000;
/**
 * A game the judge calls decided (the side to move at DECIDED or less, or 1 - DECIDED or more, on two plies running)
 * starts again from the start, like a game that ended: in a decided game every pick of the losing side scores 0 under
 * any scoring, so the later cuts would only measure ties. (The game itself plays on; the report says so.)
 */
const DECIDED = 0.05;
const base: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd") };


/** The Maia box as a separate process: text in, text out. */
function maiaProcess(): UciTransport {
  const child = spawn(process.execPath, ["--import", "tsx", root + "packages/maia-worker/src/cli.ts"], { stdio: ["pipe", "pipe", "inherit"] });
  let buffer = "";
  const listeners: ((line: string) => void)[] = [];
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    let i: number;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      for (const l of listeners) l(line);
    }
  });
  return { send: (c) => child.stdin.write(c + "\n"), onLine: (l) => listeners.push(l), close: () => child.kill() };
}

async function trace(kind: "maia" | "bots", matches: number, seed: number) {
  mkdirSync(OUT, { recursive: true });
  const judge = await createNodeEngine({ nodes: JUDGE_NODES, hashMb: 32 });
  const human = kind === "maia" ? new HumanUciEngine(maiaProcess()) : null;
  if (human && !(await human.init())) throw new Error(`Maia didn't load: ${human.error}`);
  for (let m = 0; m < matches; m++) {
    const rng = mulberry32(seed * 1000 + m);
    const skills = shuffle(rng, botSkillSpread(100, base));
    const players = Array.from({ length: 100 }, (_, i) => ({
      team: (i < 50 ? "w" : "b") as "w" | "b",
      rating: kind === "maia" ? MAIA_RATINGS[Math.floor(rng() * MAIA_RATINGS.length)]! : skills[i]!,
    }));
    const t0 = Date.now();
    const plies: Ply[] = [];
    let fen = START_FEN;
    let history: string[] = [];
    let fresh = false;
    let decided = 0;
    for (let ply = 0; ply < PLIES; ply++) {
      // (A game that's over, or decided, starts again: see DECIDED.)
      if (gameEnd(START_FEN, history) || decided >= 2) {
        decided = 0;
        fen = START_FEN;
        history = [];
        fresh = true;
      }
      const side = fen.split(" ")[1] as "w" | "b";
      const legal = legalMoves(fen);
      const top = await judge.topMoves(fen, base.botCandidateMoves);
      const picks: Record<number, string | null> = {};
      if (human) {
        const byRating = new Map<number, { move: string; p: number }[]>();
        for (const r of MAIA_RATINGS) byRating.set(r, (await human.candidates(fen, r, null, { temperature: 0, topP: 1, multipv: 20 }))?.moves.filter((c) => legal.includes(c.move)) ?? []);
        players.forEach((p, i) => {
          if (p.team !== side) return;
          const c = byRating.get(p.rating)!;
          const total = c.reduce((s, x) => s + x.p, 0);
          let r = rng() * total;
          picks[i] = c.find((x) => (r -= x.p) <= 0)?.move ?? c[0]?.move ?? legal[0]!;
        });
      } else {
        const best = top[0]!.expected;
        const candidates = top.map((t) => ({ move: t.move, loss: Math.max(0, (best - t.expected) * 100) }));
        players.forEach((p, i) => {
          if (p.team !== side) return;
          picks[i] = botChoose(rng, candidates, { skill: p.rating, powerUps: 0 }, legal, base).move;
        });
      }
      const known = new Map(top.map((t) => [t.move, t.expected]));
      const missing = [...new Set(Object.values(picks))].filter((x): x is string => !!x && !known.has(x));
      if (missing.length) for (const s of await judge.scoreMoves(fen, missing)) known.set(s.move, s.expected);
      const evaluation = bestOf({ bestMove: top[0]!.move, bestExpected: top[0]!.expected, expectedAfter: Object.fromEntries(known) }, Object.values(picks));
      const distinct = [...new Set(Object.values(picks))].filter((x): x is string => !!x);
      const slips = Object.fromEntries(materialSlips(fen, evaluation.bestMove, distinct, 1));
      const after = Object.fromEntries(distinct.map((x) => [x, +evaluation.expectedAfter[x]!.toFixed(5)]));
      plies.push({ fen, bestMove: evaluation.bestMove, bestExpected: +evaluation.bestExpected.toFixed(5), after, slips, picks, ...(fresh ? { fresh: true } : {}) });
      fresh = false;
      decided = evaluation.bestExpected >= 1 - DECIDED || evaluation.bestExpected <= DECIDED ? decided + 1 : 0;
      // The most popular pick of the side is played (a tie: the first by name, so every run plays the same game).
      const count = new Map<string, number>();
      for (const x of Object.values(picks)) if (x) count.set(x, (count.get(x) ?? 0) + 1);
      const played = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
      fen = applyMove(fen, played);
      history = [...history, played];
    }
    const row: MatchRow = { kind, seed: seed * 1000 + m, players, plies };
    appendFileSync(OUT + `${kind}-${seed}.jsonl`, JSON.stringify(row) + "\n");
    console.log(`${kind} ${seed}: match ${m + 1}/${matches} (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  judge.close();
  human?.close();
}

const [kind, matches, seed] = process.argv.slice(2);
await trace(kind as "maia" | "bots", Number(matches ?? 1), Number(seed ?? 1));
