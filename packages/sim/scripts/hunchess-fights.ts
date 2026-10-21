/**
 * Auto chess fights with the HunChess engine: two bot armies (rounds 1 to 8, as the bot buys them) fought out by the real fight
 * (`playFight`, the fight's rules) with the engine at the fight's node budget for both sides. Reports how fights end, how long
 * they are (moves, and seconds at the fight's pace), cash-ins per fight, and the engine's time a move on this machine.
 *
 *   npx tsx packages/sim/scripts/hunchess-fights.ts fights=60 out=fights.json
 */
import { writeFileSync } from "node:fs";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { HunchessEngine } from "@chessroyale/chess/hunchess";
import { moveMs, playFight, rulesFor } from "../../app/src/autochess/fight.ts";
import { sparseStarts } from "../src/hunchess-starts.ts";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(k + "="))?.slice(k.length + 1) ?? d;
const FIGHTS = Number(arg("fights", "60"));
const NODES = Number(arg("nodes", String(AUTOCHESS.fightNodes)));
const OUT = arg("out", "");
const cfg = { ...AUTOCHESS, fightNodes: NODES };
const rules = rulesFor(cfg);

const ends = new Map<string, number>();
let plies = 0;
let seconds = 0;
let cashIns = 0;
let withCashIn = 0;
let white = 0;
let black = 0;
let draws = 0;
let engineMs = 0;
let engineMoves = 0;
const engine = new HunchessEngine({ nodes: NODES, cashInValue: cfg.cashInValue });
const starts = sparseStarts(FIGHTS, 4242);
for (const [i, s] of starts.entries()) {
  engine.newGame();
  const res = (await playFight(s.fen, {
    pick: async (game) => {
      const t0 = performance.now();
      const r = engine.best({ ...game, rules });
      engineMs += performance.now() - t0;
      engineMoves++;
      return r.move;
    },
    wait: async () => undefined,
    rng: mulberry32(i),
    cfg,
  }))!;
  ends.set(res.end, (ends.get(res.end) ?? 0) + 1);
  plies += res.moves.length;
  for (let p = 0; p < res.moves.length; p++) seconds += moveMs(p, cfg) / 1000;
  const c = res.cashIns.w + res.cashIns.b;
  cashIns += c;
  if (c) withCashIn++;
  if (res.winner === "w") white++;
  else if (res.winner === "b") black++;
  else draws++;
  process.stdout.write(`${i + 1}/${starts.length} ${s.name}: ${res.end} ${res.winner ?? "draw"} in ${res.moves.length} plies, ${c} cash-ins\n`);
}
const n = starts.length;
const summary = {
  fights: n,
  nodes: NODES,
  ends: Object.fromEntries([...ends].sort((a, b) => b[1] - a[1])),
  winners: { white, black, draws },
  pliesPerFight: +(plies / n).toFixed(1),
  secondsPerFight: +(seconds / n).toFixed(1),
  cashInsPerFight: +(cashIns / n).toFixed(2),
  fightsWithACashIn: withCashIn,
  engineMsPerMove: +(engineMs / engineMoves).toFixed(1),
};
console.log(JSON.stringify(summary, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(summary, null, 2));
