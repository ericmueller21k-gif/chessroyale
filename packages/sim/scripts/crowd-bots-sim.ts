/**
 * Eric's check on the bots' strength (Nov 1: "a player making the engine's best moves should finish 1st or 2nd"): Crowd
 * 50 v 50 matches of 99 bots and one player who always picks the judge's best move (its top line), through the real
 * runner (100k nodes, as crowd-sim.ts). Where that player finishes, and how the bots' places follow their strength.
 *
 *   npx tsx packages/sim/scripts/crowd-bots-sim.ts <bots> [matches=10] [seed=1] [help=judge|own]
 *     <bots>: `before` (the bots as they were until Nov 1: temperatures spread evenly on a log scale over 0.25 to 32),
 *             `tuned` (botRoster's: each bot's rating from its name, BOT_MAIA's bell curve, played Stockfish-style at
 *             that rating's temperature: the fallback), `maia` (the same bots picking Maia's moves at their ratings,
 *             as on a device that runs Maia; the Maia box as its own process).
 *     [help]: where the player's best move comes from: `judge`, the judge's own top line (the same search: the best a
 *             player could know), or `own`, its own engine (another Stockfish at the same nodes, its own hash, as a
 *             player's engine help would be: the judge's re-checks of close calls may then name another best).
 *
 * One line per match and a summary go to reports/crowd-bots/<bots>.jsonl; `summary` writes reports/crowd-bots.md.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BOT_LOBBY, DEFAULT_SETTINGS, botRatingForSkill, botSkillSpread, estimateRating, matchLoss, modeSettings, mulberry32, rawLossTotal, shuffle, type Settings } from "@chessroyale/core";
import { MatchRunner, botRoster, type Entrant, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { spearman } from "../src/stats.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = root + "reports/crowd-bots/";
const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
const YOU = "you";

interface MatchRow {
  bots: string;
  seed: number;
  /** The engine-best player's place (1 = won), and the stage it went out in (null: reached the final). */
  place: number;
  outInStage: number | null;
  /** Each bot: its rating (what its temperature plays like, for `before`), its temperature and its place. */
  field: { rating: number; skill: number; place: number; final: boolean; outInStage: number | null; raw?: number; moves?: number; shown?: number | null }[];
  /** `maia`: the bots' picks by Maia, and those that fell back to the Stockfish-style pick. Maia's asks and their time. */
  maia?: { maia: number; fallback: number; asks: number; askMs: number; slowest: number };
  /** The final's eight (the player among them, rating 0): place, matchLoss and raw loss over the match (points per move), moves scored. */
  finalists?: { rating: number; place: number; matchLoss: number; rawPerMove: number; moves: number }[];
  secs: number;
}

async function run(kind: string, matches: number, seed0: number, help: string, tag = "") {
  if (!["before", "tuned", "probe"].includes(kind)) throw new Error(`bots: before | tuned | probe, not ${kind}`);
  mkdirSync(OUT, { recursive: true });
  const engines = await Promise.all(Array.from({ length: 3 }, () => createNodeEngine({ nodes: 100_000, hashMb: 16 })));
  const settings: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd"), engineNodes: 100_000 };
  const own = help === "own" ? await createNodeEngine({ nodes: 100_000, hashMb: 16 }) : null;
  for (let m = 0; m < matches; m++) {
    const seed = seed0 + m;
    const t0 = Date.now();
    const rng = mulberry32(7000 + seed);
    const spread = (lo: number, hi: number) => shuffle(rng, botSkillSpread(99, { ...settings, botSkillRange: [lo, hi] })).map((skill, i) => ({ id: `bot${i}`, name: `B${i}`, isBot: true, skill }));
    const bots: Entrant[] = kind === "before" ? spread(0.25, 32) : kind === "probe" ? spread(4, 1024) : botRoster(rng, 99, settings);
    const entrants = shuffle(rng, [{ id: YOU, name: "Engine", isBot: false }, ...bots]);
    const runner = new MatchRunner({ settings, rng, engines, library, entrants });
    const outIn = new Map<string, number>();
    while (!runner.isOver()) {
      runner.deal();
      runner.prefetch();
      const picks = new Map<string, { move: string; thinkMs: number }>();
      const board = runner.boardOf(YOU);
      if (board && runner.player(YOU).alive) {
        const top = own ? await own.topMoves(board.fen, settings.botCandidateMoves) : await runner.topMovesFor(board.fen);
        if (top[0]) picks.set(YOU, { move: top[0].move, thinkMs: 5000 });
      }
      await runner.score(picks);
      if (runner.stageComplete()) {
        if (runner.isFinal()) runner.finishFinal();
        else {
          const stage = runner.state.stage;
          const before = new Set(runner.alive().map((p) => p.id));
          runner.endStage();
          const after = new Set(runner.alive().map((p) => p.id));
          for (const id of before) if (!after.has(id)) outIn.set(id, stage);
        }
      }
    }
    const ps = runner.state.players;
    const me = ps.find((p) => p.id === YOU)!;
    const row: MatchRow = {
      bots: kind,
      seed,
      place: me.placement!,
      outInStage: outIn.get(YOU) ?? null,
      field: ps
        .filter((p) => p.isBot)
        .map((p) => {
          const losses = p.lossesByStage.flat();
          const raw = Math.round(losses.reduce((a, b) => a + b, 0) * 100) / 100;
          return { rating: botRatingForSkill(p.skill ?? 5), skill: p.skill ?? 5, place: p.placement!, final: !outIn.has(p.id), outInStage: outIn.get(p.id) ?? null, raw, moves: losses.length, shown: estimateRating(losses) };
        }),
      finalists: ps
        .filter((p) => !outIn.has(p.id))
        .sort((a, b) => a.placement! - b.placement!)
        .map((p) => {
          const moves = p.lossesByStage.reduce((s, l) => s + l.length, 0) + (p.misses ?? 0);
          const r = (x: number) => Math.round(x * 100) / 100;
          return { rating: p.isBot ? botRatingForSkill(p.skill ?? 5) : 0, place: p.placement!, matchLoss: r(matchLoss(p, settings)), rawPerMove: r(rawLossTotal(p, settings) / Math.max(1, moves)), moves };
        }),
      secs: Math.round((Date.now() - t0) / 1000),
    };
    appendFileSync(OUT + `${kind}${own ? "-own" : ""}${tag ? `-${tag}` : ""}.jsonl`, JSON.stringify(row) + "\n");
    console.log(`${kind} match ${m + 1}/${matches} (seed ${seed}): engine player ${row.place}${row.outInStage !== null ? ` (out in stage ${row.outInStage + 1})` : ""}, ${row.secs} s`);
  }
  engines.forEach((e) => e.close());
  own?.close();
}

// ---------------- The report ----------------

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pct = (n: number, d: number) => `${Math.round((100 * n) / Math.max(1, d))}%`;

function rowsOf(kind: string): MatchRow[] {
  const f = OUT + `${kind}.jsonl`;
  return existsSync(f) ? readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as MatchRow) : [];
}

function summary() {
  const kinds = ["before", "tuned", "maia", "before-own", "tuned-own", "maia-own"].filter((k) => rowsOf(k).length);
  const label: Record<string, string> = {
    before: "Before (Stockfish-style, temperatures 0.25 to 32)",
    tuned: "Tuned (Stockfish-style at each bot's rating)",
    maia: "Maia (each bot's rating)",
    "before-own": "Before; the player's own engine",
    "tuned-own": "Tuned; the player's own engine",
    "maia-own": "Maia; the player's own engine",
  };
  const out: string[] = [
    "# Crowd 50 v 50: an engine-best player against the bots (Nov 1, 2026)",
    "",
    "Written by `npx tsx packages/sim/scripts/crowd-bots-sim.ts summary` from `reports/crowd-bots/*.jsonl`.",
    "Eric (Nov 1): a player making the engine's best moves should finish 1st or 2nd. 99 bots and one player who always",
    "picks the best move, Crowd's settings (50 v 50, its cuts and its final), the real runner at 100k nodes. The player's",
    "best move: the judge's own top line (the best a player could know), or (\"own engine\") its own Stockfish at the same",
    "nodes with its own hash, as engine help on a player's device would be (the judge's re-checks of close calls may name",
    "another best). Bots:",
    "",
    "- **Before:** the bots until Nov 1: temperatures spread evenly on a log scale from 0.25 to 32 over Stockfish's top 8.",
    `- **Tuned:** each bot's rating from its name (BOT_MAIA: mean ${BOT_MAIA.ratings.mean}, sd ${BOT_MAIA.ratings.sd}, ${BOT_MAIA.ratings.min} to ${BOT_MAIA.ratings.max}), played Stockfish-style at the temperature that loses as much a move (the fallback; and online today).`,
    "- **Maia:** the same bots picking Maia's own moves at their ratings (temperature 0.8, top-p 0.9), as on a device that runs Maia.",
    "",
    "| Bots | Matches | Engine player 1st or 2nd | Its places | Its mean place | Reached the final | Bots: rating vs place (Spearman, higher = stronger bots place better) | Bots 1500+ in the final | Bots under 1000 in the final | Bots out in the first cut | Maia picks (fallback) | Maia per ask (slowest) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const k of kinds) {
    const rows = rowsOf(k);
    const places = rows.map((r) => r.place);
    const rho = mean(rows.map((r) => -spearman(r.field.map((f) => f.rating), r.field.map((f) => f.place))));
    const hi = rows.flatMap((r) => r.field.filter((f) => f.rating >= 1500));
    const lo = rows.flatMap((r) => r.field.filter((f) => f.rating < 1000));
    const all = rows.flatMap((r) => r.field);
    const st = rows.map((r) => r.maia).filter((x): x is NonNullable<MatchRow["maia"]> => !!x);
    const mp = st.reduce((a, s) => a + s.maia, 0);
    const fb = st.reduce((a, s) => a + s.fallback, 0);
    const asks = st.reduce((a, s) => a + s.asks, 0);
    const ms = st.reduce((a, s) => a + s.askMs, 0);
    out.push(
      `| ${label[k]} | ${rows.length} | ${pct(places.filter((p) => p <= 2).length, rows.length)} | ${places.join(", ")} | ${mean(places).toFixed(1)} | ${pct(rows.filter((r) => r.outInStage === null).length, rows.length)} | ${rho.toFixed(2)} | ${pct(hi.filter((f) => f.final).length, hi.length)} of ${hi.length} | ${pct(lo.filter((f) => f.final).length, lo.length)} of ${lo.length} | ${pct(all.filter((f) => f.outInStage === 0).length, all.length)} | ${st.length ? `${pct(mp, mp + fb)} (${pct(fb, mp + fb)})` : "-"} | ${asks ? `${Math.round(ms / asks)} ms (${Math.max(...st.map((s) => s.slowest))} ms)` : "-"} |`,
    );
  }
  out.push("", "Before's \"rating\" is the rating its temperature plays like (botRatingForSkill, held at 2400 above), for the same columns.", "");
  writeFileSync(root + "reports/crowd-bots.md", out.join("\n"));
  console.log(out.join("\n"));
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "summary") summary();
else if (cmd) await run(cmd, Number(args[0] ?? 10), Number(args[1] ?? 1), args[2] ?? "judge", args[3] ?? "");
else console.log("usage: crowd-bots-sim.ts before|tuned|maia [matches] [seed] | summary");
process.exit(0);
