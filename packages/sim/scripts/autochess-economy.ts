/**
 * Auto chess's economy, measured: whole bot-against-bot matches with real fights (the HunChess engine at the fight's node budget,
 * the screen's own pure code: `beginRound`, `botPlan`, `fightStart`, `playFight`, `settleRound`, run without waiting; no move step).
 * Each side buys with the bot's plan. Reports rounds per game and, by round, each side's level, pieces and stars on the board at the
 * fight, and the gold it had and spent on pieces, star-ups, rolls and XP (docs/decisions/2026-11-01-autochess-tft-economy.md).
 *
 *   npx tsx packages/sim/scripts/autochess-economy.ts matches=10 from=1000 out=a.json [cfg=overrides.json]
 *   npx tsx packages/sim/scripts/autochess-economy.ts summary a.json b.json ...
 *
 * `cfg`: a JSON file of settings merged over `AUTOCHESS` (one level deep), to try numbers without editing settings.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { AUTOCHESS, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { HunchessEngine } from "@chessroyale/chess/hunchess";
import { carryBench, emptyArmy, kingSquares, starUpsIn } from "../../app/src/autochess/army.ts";
import { botPlan } from "../../app/src/autochess/bot.ts";
import { beginRound, matchWinner, newMatch, roundSeed, settleRound, youColor, type MatchState } from "../../app/src/autochess/economy.ts";
import { playFight, rulesFor, starsAfter } from "../../app/src/autochess/fight.ts";
import { fightStart, piecesOn, starUpsByColor } from "../../app/src/autochess/position.ts";
import type { Army, Color } from "../../app/src/autochess/types.ts";

const args = process.argv.slice(2);
const arg = (k: string, d: string) => args.find((a) => a.startsWith(k + "="))?.slice(k.length + 1) ?? d;

interface SideRound {
  level: number;
  pieces: number;
  stars: number;
  gold: number;
  pieceGold: number;
  starGold: number;
  rollGold: number;
  rolls: number;
  xpGold: number;
  left: number;
}
interface RoundRow {
  round: number;
  a: SideRound;
  b: SideRound;
  outcome: "a" | "b" | "draw";
  damage: number;
}
interface MatchRow {
  seed: number;
  rounds: RoundRow[];
}

function overrides(path: string): AutoChessSettings {
  if (!path) return AUTOCHESS;
  const o = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...AUTOCHESS };
  for (const [k, v] of Object.entries(o)) {
    const base = out[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v) && base && typeof base === "object" && !Array.isArray(base) ? { ...base, ...v } : v;
  }
  return out as unknown as AutoChessSettings;
}

async function playMatch(seed: number, cfg: AutoChessSettings, engine: HunchessEngine): Promise<MatchRow> {
  let match: MatchState = newMatch(seed, cfg);
  const rows: RoundRow[] = [];
  const rules = rulesFor(cfg);
  while (!matchWinner(match) && match.round < 30) {
    const begun = beginRound(match, cfg);
    match = begun.match;
    const colorA = youColor(match.round);
    const colorB: Color = colorA === "w" ? "b" : "w";
    const rs = roundSeed(match);
    const kings = kingSquares(rs, cfg);
    const plan = (side: "you" | "bot", color: Color, salt: number) =>
      botPlan(color, kings[color], match[side].gold, match.round, mulberry32((rs ^ salt) >>> 0), cfg, carryBench(match[side].bench), { level: match[side].level, xp: match[side].xp });
    const pa = plan("you", colorA, 0x3c6ef372);
    const pb = plan("bot", colorB, 0x9e3779b9);
    const side = (p: ReturnType<typeof botPlan>, gold: number): SideRound => {
      const sum = (t: string) => p.events.filter((e) => e.type === t).reduce((s, e) => s + e.price, 0);
      return {
        level: p.level.level,
        pieces: Object.keys(p.army.board).length,
        stars: starUpsIn(p.army.stars),
        gold,
        pieceGold: sum("buy") + sum("hold"),
        starGold: sum("starup"),
        rollGold: sum("reroll"),
        rolls: p.events.filter((e) => e.type === "reroll").length,
        xpGold: sum("xp"),
        left: gold - p.spent,
      };
    };
    const a = side(pa, match.you.gold);
    const b = side(pb, match.bot.gold);
    match = {
      ...match,
      you: { ...match.you, gold: a.left, bench: pa.army.bench, level: pa.level.level, xp: pa.level.xp },
      bot: { ...match.bot, gold: b.left, bench: pb.army.bench, level: pb.level.level, xp: pb.level.xp },
    };
    const armyA: Army = pa.army;
    const armyB: Army = pb.army;
    const start = colorA === "w" ? fightStart(armyA, armyB) : fightStart(armyB, armyA);
    let winner: Color | null = null;
    let fen = start.fen;
    let cashIns = { w: 0, b: 0 };
    let moves: string[] = [];
    if (!start.draw) {
      engine.newGame();
      const res = await playFight(start.fen, {
        pick: async (game) => {
          const r = engine.best({ startFen: game.startFen, moves: game.moves, rules }, cfg.fightNodes);
          return r.move ? { move: r.move, score: r.score } : null;
        },
        wait: () => Promise.resolve(),
        rng: mulberry32((rs ^ 0x2545f491) >>> 0),
        cfg,
      });
      winner = res!.winner;
      fen = res!.fen;
      cashIns = res!.cashIns;
      moves = res!.moves;
    }
    const on = piecesOn(fen);
    const ups = starUpsByColor(fen, starsAfter({ ...armyA.stars, ...armyB.stars }, moves));
    const who = winner === null ? "draw" : winner === colorA ? "you" : "bot";
    const settled = settleRound(match, who, { you: on[colorA], bot: on[colorB] }, cfg, { you: cashIns[colorA], bot: cashIns[colorB] }, { you: ups[colorA], bot: ups[colorB] });
    match = settled.match;
    rows.push({ round: match.round, a, b, outcome: who === "you" ? "a" : who === "bot" ? "b" : "draw", damage: settled.result.damage });
  }
  return { seed, rounds: rows };
}

function summary(files: string[]) {
  const matches = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as MatchRow[]);
  const lengths = matches.map((m) => m.rounds.length).sort((x, y) => x - y);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const f1 = (x: number) => x.toFixed(1);
  const f2 = (x: number) => x.toFixed(2);
  const draws = matches.flatMap((m) => m.rounds).filter((r) => r.outcome === "draw").length;
  const allRounds = matches.flatMap((m) => m.rounds).length;
  console.log(`${matches.length} matches: rounds median ${lengths[lengths.length >> 1]}, mean ${f2(mean(lengths))}, ${lengths[0]} to ${lengths[lengths.length - 1]}; 7 to 10 rounds: ${lengths.filter((n) => n >= 7 && n <= 10).length}/${lengths.length}; draws ${draws}/${allRounds}`);
  const sides = matches.flatMap((m) => m.rounds.flatMap((r) => [{ round: r.round, s: r.a }, { round: r.round, s: r.b }]));
  console.log("round | sides | gold at start | level | pieces | stars | on pieces | on star-ups | on rolls (rolls) | on XP | left");
  const max = Math.max(...sides.map((x) => x.round));
  for (let round = 1; round <= Math.min(max, 12); round++) {
    const s = sides.filter((x) => x.round === round).map((x) => x.s);
    if (!s.length) continue;
    const m = (k: keyof SideRound) => mean(s.map((x) => x[k]));
    console.log(`${round} | ${s.length} | ${f1(m("gold"))} | ${f1(m("level"))} | ${f1(m("pieces"))} | ${f2(m("stars"))} | ${f1(m("pieceGold"))} | ${f1(m("starGold"))} | ${f1(m("rollGold"))} (${f2(m("rolls"))}) | ${f1(m("xpGold"))} | ${f1(m("left"))}`);
  }
  const all = sides.map((x) => x.s);
  const tot = (k: keyof SideRound) => all.reduce((sum, x) => sum + x[k], 0);
  const spent = tot("pieceGold") + tot("starGold") + tot("rollGold") + tot("xpGold");
  const share = (k: keyof SideRound) => `${((100 * tot(k)) / spent).toFixed(0)}%`;
  console.log(`spend shares: pieces ${share("pieceGold")}, star-ups ${share("starGold")}, rolls ${share("rollGold")}, XP ${share("xpGold")}; rolls a side-round ${f2(tot("rolls") / all.length)}, rounds with a roll ${((100 * all.filter((x) => x.rolls > 0).length) / all.length).toFixed(0)}%`);
}

if (args[0] === "summary") summary(args.slice(1));
else {
  const cfg = overrides(arg("cfg", ""));
  const n = Number(arg("matches", "10"));
  const from = Number(arg("from", "1000"));
  const out = arg("out", "autochess-economy.json");
  const engine = new HunchessEngine({ nodes: cfg.fightNodes, cashInValue: cfg.cashInValue });
  const rows: MatchRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push(await playMatch(from + i, cfg, engine));
    writeFileSync(out, JSON.stringify(rows));
  }
}
