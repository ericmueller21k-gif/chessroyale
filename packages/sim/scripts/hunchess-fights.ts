/**
 * Auto chess fights with the HunChess engine: two bot armies (rounds 1 to 8, as the bot buys them) fought out by the real fight
 * (`playFight`, the fight's rules) with the engine at the fight's node budget for both sides. Reports how fights end, how long
 * they are (moves a side, and seconds at the fight's real pace), how the side that started with more material does, the longest
 * stretch where only kings moved, cash-ins, and the engine's time a move on this machine.
 *
 *   npx tsx packages/sim/scripts/hunchess-fights.ts fights=80 out=fights.json [set.decisiveMoves=6 ...]
 */
import { writeFileSync } from "node:fs";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { HunchessEngine } from "@chessroyale/chess/hunchess";
import { playFight, rulesFor } from "../../app/src/autochess/fight.ts";
import { sparseStarts } from "../src/hunchess-starts.ts";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(k + "="))?.slice(k.length + 1) ?? d;
const FIGHTS = Number(arg("fights", "80"));
const NODES = Number(arg("nodes", String(AUTOCHESS.fightNodes)));
const OUT = arg("out", "");
/** Any number in the settings can be tried for a run: `set.decisiveMoves=6 set.decisiveMargin=800`. */
const overrides = Object.fromEntries(
  process.argv.filter((a) => a.startsWith("set.")).map((a) => {
    const [k, v] = a.slice(4).split("=");
    if (typeof (AUTOCHESS as unknown as Record<string, unknown>)[k!] !== "number") throw new Error(`no number setting ${k}`);
    return [k!, Number(v)];
  }),
);
const cfg = { ...AUTOCHESS, fightNodes: NODES, ...overrides };
const rules = rulesFor(cfg);

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
/** Material by the usual values, White and Black. */
function material(fen: string): { w: number; b: number } {
  const out = { w: 0, b: 0 };
  for (const ch of fen.split(" ")[0]!) {
    const v = VALUE[ch.toLowerCase()];
    if (v) out[ch === ch.toLowerCase() ? "b" : "w"] += v;
  }
  return out;
}
/** The piece letter on a square of a FEN ("" if empty). */
function pieceAt(fen: string, square: string): string {
  const row = fen.split(" ")[0]!.split("/")[8 - Number(square[1])]!;
  let f = 0;
  for (const ch of row) {
    if (ch >= "1" && ch <= "8") f += Number(ch);
    else {
      if (f === square.charCodeAt(0) - 97) return ch;
      f++;
    }
  }
  return "";
}

interface Fight {
  name: string;
  end: string;
  winner: string | null;
  plies: number;
  seconds: number;
  cashIns: number;
  /** Who started with more material: "w", "b", or null when equal. */
  ahead: "w" | "b" | null;
  /** The longest run of plies in which only kings moved. */
  kingWalk: number;
  /** The longest run of one side's own moves that were all its king's. */
  kingSteps: number;
  /** A stall's judged score of the final position (centipawns, White's view). */
  score?: number;
  /** What White gained since the start by the judge (a stall's, or "too far ahead"'s). */
  gain?: number;
}

const fights: Fight[] = [];
let engineMs = 0;
let engineMoves = 0;
const engine = new HunchessEngine({ nodes: NODES, cashInValue: cfg.cashInValue });
const starts = sparseStarts(FIGHTS, 4242);
for (const [i, s] of starts.entries()) {
  engine.newGame();
  let seconds = 0;
  let before = s.fen;
  let walk = 0;
  let kingWalk = 0;
  // (One side's own moves in a row that were all its king's, by side: the king walking about while the other side plays on.)
  const sideWalk = { w: 0, b: 0 };
  let kingSteps = 0;
  const res = (await playFight(s.fen, {
    pick: async (game) => {
      const t0 = performance.now();
      const r = engine.best({ ...game, rules });
      engineMs += performance.now() - t0;
      engineMoves++;
      // (With its score, as the screen's engine gives it: it tells a forced win the engine has found.)
      return r.move ? { move: r.move, score: r.score } : null;
    },
    // (The real pace: the fight asks for each move's wait.)
    wait: async (ms) => void (seconds += ms / 1000),
    onStep: (step) => {
      const moved = pieceAt(before, step.move.slice(0, 2));
      const king = moved.toLowerCase() === "k";
      walk = king ? walk + 1 : 0;
      kingWalk = Math.max(kingWalk, walk);
      const side = moved === moved.toUpperCase() ? "w" : "b";
      sideWalk[side] = king ? sideWalk[side] + 1 : 0;
      kingSteps = Math.max(kingSteps, sideWalk[side]);
      before = step.fen;
    },
    rng: mulberry32(i),
    cfg,
  }))!;
  const m = material(s.fen);
  const f: Fight = { name: s.name, end: res.end, winner: res.winner, plies: res.moves.length, seconds, cashIns: res.cashIns.w + res.cashIns.b, ahead: m.w > m.b ? "w" : m.b > m.w ? "b" : null, kingWalk, kingSteps, ...(res.score !== undefined ? { score: res.score } : {}), ...(res.gain !== undefined ? { gain: res.gain } : {}) };
  fights.push(f);
  process.stdout.write(`${i + 1}/${starts.length} ${s.name}: ${res.end} ${res.winner ?? "draw"} in ${f.plies} plies (${f.seconds.toFixed(1)} s), king walk ${kingWalk} plies (one side ${kingSteps} moves), ${f.cashIns} cash-ins\n`);
}

const n = fights.length;
const pct = (k: number) => +((100 * k) / n).toFixed(1);
const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2]! : (a[a.length / 2 - 1]! + a[a.length / 2]!) / 2;
};
const avg = (xs: number[]) => +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
const ends: Record<string, { count: number; pct: number }> = {};
for (const f of fights) ends[f.end] = { count: (ends[f.end]?.count ?? 0) + 1, pct: 0 };
for (const e of Object.values(ends)) e.pct = pct(e.count);
const movesSide = fights.map((f) => f.plies / 2);
const secs = fights.map((f) => f.seconds);
const uneven = fights.filter((f) => f.ahead);
const kingWalks = fights.map((f) => f.kingWalk);
const kingSteps = fights.map((f) => f.kingSteps);
const draws = fights.filter((f) => !f.winner).length;
const summary = {
  fights: n,
  nodes: NODES,
  ...(Object.keys(overrides).length ? { settings: overrides } : {}),
  ends: Object.fromEntries(Object.entries(ends).sort((a, b) => b[1].count - a[1].count)),
  draws: { count: draws, pct: pct(draws) },
  winners: { white: fights.filter((f) => f.winner === "w").length, black: fights.filter((f) => f.winner === "b").length },
  movesASide: { average: avg(movesSide), median: median(movesSide), longest: Math.max(...movesSide) },
  seconds: { average: avg(secs), median: +median(secs).toFixed(1), longest: +Math.max(...secs).toFixed(1) },
  moreMaterial: {
    fights: uneven.length,
    wins: uneven.filter((f) => f.winner === f.ahead).length,
    // (A loss for the bigger army is a win for the side that started behind: placement beating a bigger army.)
    losses: uneven.filter((f) => f.winner && f.winner !== f.ahead).length,
    draws: uneven.filter((f) => !f.winner).length,
    equalStarts: n - uneven.length,
  },
  kingWalkPlies: { average: avg(kingWalks), median: median(kingWalks), longest: Math.max(...kingWalks), fightsWith6Plus: kingWalks.filter((k) => k >= 6).length },
  oneSideKingMoves: { average: avg(kingSteps), median: median(kingSteps), longest: Math.max(...kingSteps), fightsWith5Plus: kingSteps.filter((k) => k >= 5).length, fightsWith10Plus: kingSteps.filter((k) => k >= 10).length },
  cashInsPerFight: +(fights.reduce((a, f) => a + f.cashIns, 0) / n).toFixed(2),
  fightsWithACashIn: fights.filter((f) => f.cashIns).length,
  engineMsPerMove: +(engineMs / engineMoves).toFixed(1),
};
console.log(JSON.stringify(summary, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify({ summary, fights }, null, 2));
