/**
 * Eric's check on the bots' strength (Nov 1: "a player making the engine's best moves should finish 1st or 2nd"): Crowd
 * 50 v 50 matches of 99 bots and one player who always picks the judge's best move (its top line), through the real
 * runner (100k nodes, as crowd-sim.ts). Where that player finishes, and how the bots' places follow their strength.
 *
 *   npx tsx packages/sim/scripts/crowd-bots-sim.ts <bots> [matches=10] [seed=1] [help=judge|own] [tag]
 *     <bots>: `before` (the bots as they were until Nov 1: temperatures spread evenly on a log scale over 0.25 to 32),
 *             `tuned` (botRoster's: each bot's rating from its name, BOT_LOBBY's bell curve, at that rating's
 *             temperature), `probe` (temperatures spread over 4 to 1024: what each gives away a move, for
 *             BOT_LOBBY.skillAt).
 *     [help]: where the player's best move comes from: `judge`, the judge's own top line (the same search: the best a
 *             player could know), or `own`, its own engine (another Stockfish at the same nodes, its own hash).
 *     [tag]: added to the file's name (runs side by side; concatenate them after).
 *
 * One line per match goes to reports/crowd-bots/<bots>[-own][-tag].jsonl; `summary` writes reports/crowd-bots.md.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BOT_LOBBY, DEFAULT_SETTINGS, botRatingForSkill, botSkillSpread, estimateRating, matchLoss, modeSettings, mulberry32, rawLossTotal, shuffle, type Settings } from "@chessroyale/core";
import { MatchRunner, botRoster, type Entrant, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";

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
  /** The first try's Maia rows only: picks by Maia, those that fell back to the Stockfish-style pick, Maia's asks and their time. */
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
const quantile = (xs: readonly number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))] ?? 0;

function rowsOf(kind: string): MatchRow[] {
  const f = OUT + `${kind}.jsonl`;
  return existsSync(f) ? readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as MatchRow) : [];
}

function summary() {
  const label: Record<string, string> = {
    before: "**Before** (today's bots: temperatures 0.25 to 32)",
    "wip-maia": "First try: Maia at Maia ratings around 1150",
    "wip-tuned": "First try: Stockfish-style at the temperatures matching those Maia ratings",
    tuned: "**After** (BOT_LOBBY: ratings around 1150, Stockfish-style)",
  };
  const kinds = Object.keys(label).filter((k) => rowsOf(k).length);
  // (Before and after: a bot's rating is the one its temperature plays like today; the first try's kept its own labels.)
  const ratingOf = (k: string, f: MatchRow["field"][number]) => (k.startsWith("wip") ? f.rating : botRatingForSkill(f.skill));
  const out: string[] = [
    "# Crowd 50 v 50: an engine-best player against the bots (Nov 1, 2026)",
    "",
    "Written by `npx tsx packages/sim/scripts/crowd-bots-sim.ts summary` from `reports/crowd-bots/*.jsonl`. Eric (Nov 1): a",
    "player making the engine's best moves should finish 1st or 2nd. 99 bots and one player who always picks the judge's",
    "best move (its top line at 100k nodes), Crowd's settings (50 v 50, its cuts, the team final), the real runner. The",
    "\"first try\" rows are this branch's first version (bots on Maia's rating scale with Maia's moves, and their",
    "Stockfish-style twin), kept for the comparison; the Maia wiring is gone (docs/decisions/2026-11-01-bot-lobby.md).",
    "",
    `After: each bot's rating from its name (mean ${BOT_LOBBY.ratings.mean}, sd ${BOT_LOBBY.ratings.sd}, ${BOT_LOBBY.ratings.min} to ${BOT_LOBBY.ratings.max}), each rating's temperature giving away a Maia player's points a move at that rating (BOT_LOBBY.skillAt).`,
    "",
    "| Bots | Matches | Engine player 1st or 2nd | Its places | Mean place | Bots rated 1500+ in the final | Bots under 1000 in the final | Bots out in the first cut | A 1800+ bot above a 900- one | Bots' scoreboard rating (median, 10th to 90th) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const k of kinds) {
    const rows = rowsOf(k);
    const places = rows.map((r) => r.place);
    const field = rows.flatMap((r) => r.field.map((f) => ({ ...f, r: ratingOf(k, f) })));
    const hi = field.filter((f) => f.r >= 1500);
    const lo = field.filter((f) => f.r < 1000);
    let above = 0;
    let pairs = 0;
    for (const r of rows)
      for (const a of r.field)
        for (const b of r.field)
          if (ratingOf(k, a) >= 1800 && ratingOf(k, b) <= 900) {
            pairs++;
            if (a.place < b.place) above++;
          }
    const shown = field.flatMap((f) => (f.shown ? [f.shown] : []));
    out.push(
      `| ${label[k]} | ${rows.length} | ${places.filter((p) => p <= 2).length} of ${rows.length} (${pct(places.filter((p) => p <= 2).length, rows.length)}) | ${places.join(", ")} | ${mean(places).toFixed(1)} | ${pct(hi.filter((f) => f.final).length, hi.length)} of ${hi.length} | ${pct(lo.filter((f) => f.final).length, lo.length)} of ${lo.length} | ${pct(field.filter((f) => f.outInStage === 0).length, field.length)} | ${pairs ? pct(above, pairs) : "-"} | ${shown.length ? `${quantile(shown, 0.5)} (${quantile(shown, 0.1)} to ${quantile(shown, 0.9)})` : "-"} |`,
    );
  }
  const probe = ["p1", "p2", "p3", "p4", "p5", "p6"].flatMap((t) => rowsOf(`probe-${t}`)).flatMap((r) => r.field);
  if (probe.length) {
    out.push("", "**The probe** (6 matches, bots at temperatures 4 to 1024): points given away a move by temperature, all bots' moves.", "", "| Temperature | Bots | Moves | Points a move |", "| --- | --- | --- | --- |");
    const bands = [4, 8, 16, 32, 64, 128, 256, 1024];
    for (let i = 0; i < bands.length - 1; i++) {
      const fs = probe.filter((f) => f.skill >= bands[i]! && f.skill < bands[i + 1]!);
      const moves = fs.reduce((a, f) => a + (f.moves ?? 0), 0);
      out.push(`| ${bands[i]} to ${bands[i + 1]} | ${fs.length} | ${moves} | ${(fs.reduce((a, f) => a + (f.raw ?? 0), 0) / Math.max(1, moves)).toFixed(2)} |`);
    }
  }
  out.push(
    "",
    "**Why the engine-best player isn't always 1st.** Its only losses come from the judge changing its mind: a bot's pick",
    "outside the top line, searched on its own, or a close call re-checked deeper (700k nodes), can score above the top line",
    "the player took, and then that line counts as a loss (traced in the first try's 3rd and 5th places: one to four such moves). The finalists are ranked",
    "on points given away a move over the whole match, and the luckiest of 50 bots on a team often give away under one.",
    "",
    "**Maia for the bots' moves (measured Nov 1, this machine, Node, the Maia box on one thread):** 73 ms an ask (median;",
    "90th percentile 81 ms); one team turn of 50 bots needs one ask per rating among them (10 for 50 of the bot names), so",
    "0.74 s a turn (most 0.86 s). In the first try's full matches, with the judge's Stockfish busy beside it: 197 ms an",
    "ask on average, the slowest 1.4 s, and 2.2% of picks fell back to Stockfish-style within its 2.5 s budget. A phone",
    "(the CPU slowed 4x, as for the bosses' Maia): about 0.3 s an ask, 3 s a team turn, past that budget. Stockfish-style",
    "picks cost nothing extra: they choose from the judge's top moves, already searched.",
    "",
  );
  writeFileSync(root + "reports/crowd-bots.md", out.join("\n"));
  console.log(out.join("\n"));
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "summary") summary();
else if (cmd) await run(cmd, Number(args[0] ?? 10), Number(args[1] ?? 1), args[2] ?? "judge", args[3] ?? "");
else console.log("usage: crowd-bots-sim.ts before|tuned|probe [matches] [seed] [judge|own] [tag] | summary");
process.exit(0);
