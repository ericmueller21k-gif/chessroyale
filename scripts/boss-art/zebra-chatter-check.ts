/**
 * Checks every chess claim in the zebras' chatter (scripts/boss-art/out/zebra-chatter-nov10.md): each named line is replayed with
 * chess.js (every move legal, every "check" a check), its name looked up in the opening library (packages/chess/data/openings.json:
 * the longest entry the line starts with), and each evaluation or "that loses to ..." claim scored by Stockfish (packages/chess/src/
 * node.ts, the full build) as the mover's expected score (win + half the draws, 0 to 1).
 *
 *   npx tsx scripts/boss-art/zebra-chatter-check.ts [nodes]      (default 3,000,000 nodes a position; about 3 minutes)
 */
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { createNodeEngine, STOCKFISH_FULL_BUILD } from "../../packages/chess/src/node.ts";

type Entry = { name: string; moves: string[] };
const BOOK = JSON.parse(readFileSync("packages/chess/data/openings.json", "utf8")) as Entry[];
const NODES = Number(process.argv[2] ?? 3_000_000);

interface Check {
  id: string;
  /** The moves the line names, in SAN from the start (or from `fen`). */
  san: string;
  fen?: string;
  /** Text the opening library's name must contain, if any. */
  name?: string;
  /** SAN moves that must give check (by their place in `san`, 1-based ply). */
  checks?: number[];
  /** Score claims: after the line (or after `at` plies), the side to move's expected score must be in [lo, hi]. */
  evals?: { at?: number; lo: number; hi: number; say: string }[];
  /** Compare two continuations from the end of the line: `better` must score at least `by` more for the mover than `worse`. */
  compare?: { better: string; worse: string; by: number; say: string };
  /** A pawn or piece of the side to move that "hangs" after the line: attacked by the side that just moved, defended by nobody. */
  hangs?: string;
}

const CHECKS: Check[] = [
  { id: "najdorf", san: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", name: "Najdorf" },
  {
    id: "poisoned-pawn",
    san: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Qb6 Qd2 Qxb2",
    // (The library names only the French Poisoned Pawn; the Sicilian one, 8.Qd2 Qxb2, is ECO B97's standard name. It has Najdorf.)
    name: "Najdorf",
    evals: [{ lo: 0.3, hi: 0.7, say: "after 8...Qxb2 the game is balanced (White to move): Black's pawn grab holds" }],
  },
  { id: "catalan", san: "d4 Nf6 c4 e6 g3 d5 Bg2 dxc4", name: "Catalan" },
  {
    id: "mar-del-plata",
    san: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Be3 f5 f3 f4 Bf2 g5",
    name: "King's Indian",
  },
  { id: "grunfeld-exchange", san: "d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5", name: "Grünfeld" },
  {
    id: "grunfeld-rb1",
    san: "d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5 Rb1 O-O Be2 cxd4 cxd4 Qa5+ Bd2 Qxa2 O-O",
    checks: [20],
    evals: [{ lo: 0.3, hi: 0.7, say: "after 12.O-O (Black to move) it's balanced: White's play for the pawn" }],
  },
  { id: "berlin", san: "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8", name: "Berlin", checks: [15] },
  {
    id: "marshall",
    san: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6",
    name: "Marshall",
    evals: [{ lo: 0.38, hi: 0.68, say: "after 11...c6, a pawn up, White is no better than slightly: Black's attack pays for it" }],
  },
  { id: "anti-marshall-h3", san: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O h3" },
  { id: "anti-marshall-a4", san: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O a4", name: "Ruy Lopez" }, // ("Anti-Marshall": the usual name for 8.a4 and 8.h3; the library has none)
  { id: "sveshnikov", san: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Bxf6 gxf6 Nd5 f5", name: "Sveshnikov" },
  { id: "qga", san: "d4 d5 c4 dxc4 e4", name: "Queen's Gambit Accepted" },
  {
    id: "qga-hold",
    san: "d4 d5 c4 dxc4 e3 b5 a4 c6 axb5 cxb5 Qf3",
    evals: [{ lo: 0.0, hi: 0.3, say: "holding c4 with ...b5 loses to a4 and Qf3 (the rook on a8): Black to move is losing" }],
  },
  {
    id: "yugoslav-rxc3",
    san: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O Rc8 Bb3 Ne5 Kb1 Nc4 Bxc4 Rxc4 g4 Rxc3 bxc3",
    name: "Dragon",
  },
  { id: "caro-advance", san: "e4 c6 d4 d5 e5 Bf5", name: "Caro-Kann" },
  { id: "french-trade", san: "e4 e6 d4 d5 Nc3 Bb4 e5 b6 a3 Bf8 Nf3 Ba6 Bxa6 Nxa6", name: "French" },
  { id: "french-breaks", san: "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 f6", name: "French" },
  {
    id: "exchange-ruy",
    san: "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 Nxe5 Qd4 Nf3 Qxe4+",
    checks: [12],
    evals: [{ lo: 0.3, hi: 0.7, say: "after 6...Qxe4+ (White to move) it's level: the pawn is back" }],
  },
  { id: "exchange-ruy-name", san: "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O", name: "Exchange Variation" },
  {
    id: "two-knights",
    san: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5",
    name: "Two Knights",
    compare: { better: "Na5", worse: "Nxd5", by: 0.03, say: "5...Na5 scores better for Black than 5...Nxd5 (the Fried Liver's door)" },
  },
  { id: "fried-liver", san: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+", name: "Fried Liver", checks: [13] },
  { id: "london-qb6", san: "d4 d5 Nf3 Nf6 Bf4 c5 e3 Nc6 c3 Qb6", name: "London", hangs: "b2" },
  { id: "evans", san: "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3", name: "Evans" },
  { id: "nimzo-name", san: "d4 Nf6 c4 e6 Nc3 Bb4", name: "Nimzo-Indian" },
  { id: "nimzo-samisch", san: "d4 Nf6 c4 e6 Nc3 Bb4 a3 Bxc3+ bxc3", checks: [8] },
  {
    id: "lucena",
    fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
    san: "Rd1+ Ke7 Rd4",
    checks: [1],
    evals: [{ lo: 0.9, hi: 1, at: 0, say: "the Lucena position wins for White (to move)" }, { lo: 0, hi: 0.1, say: "after Rd4 (the bridge's rook on the fourth), Black to move is lost" }],
  },
  {
    id: "philidor",
    fen: "4k3/8/r7/4PK2/8/8/8/7R b - - 0 1",
    san: "Rb6",
    evals: [{ lo: 0.35, hi: 0.65, at: 0, say: "rook on the third rank (the sixth from his side), king in front: a draw" }],
  },
  {
    id: "philidor-behind",
    fen: "4k3/8/4PK2/8/8/8/r7/7R b - - 0 1",
    san: "Rf2+",
    checks: [1],
    evals: [{ lo: 0.35, hi: 0.65, at: 0, say: "once the pawn steps to the sixth, the rook goes behind and checks from the back: still a draw" }],
  },
  {
    id: "opposition",
    fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
    san: "Kd2",
    evals: [{ lo: 0.9, hi: 1, at: 0, say: "king and pawn (Ke1, e2 against Ke8): White to move wins" }],
    compare: { better: "Kd2", worse: "e4", by: 0.3, say: "the king first (Kd2) wins; the pawn first (e4) lets Black take the opposition: a draw" },
  },
];

const engine = await createNodeEngine({ nodes: NODES, hashMb: 64 }, STOCKFISH_FULL_BUILD);
let bad = 0;
for (const c of CHECKS) {
  const g = new Chess(c.fen);
  const startFen = g.fen();
  const uci: string[] = [];
  const notes: string[] = [];
  const fens: string[] = [startFen];
  let ok = true;
  c.san.split(" ").forEach((m, i) => {
    if (!ok) return;
    try {
      const mv = g.move(m);
      uci.push(mv.from + mv.to + (mv.promotion ?? ""));
      fens.push(g.fen());
      if (c.checks?.includes(i + 1) && !g.inCheck()) (ok = false), notes.push(`ply ${i + 1} ${m} is not check`);
    } catch {
      ok = false;
      notes.push(`ILLEGAL at ply ${i + 1}: ${m}`);
    }
  });
  if (ok) notes.push(`legal (${uci.length} plies)`);
  if (!c.fen) {
    // The library entry that agrees with the line move for move (it may stop sooner or go on longer), named as the line says; else the
    // longest that agrees.
    const agrees = (e: Entry) => e.moves.every((m, i) => i >= uci.length || m === uci[i]);
    const want = c.name?.toLowerCase();
    const pool = BOOK.filter(agrees);
    const named = want ? pool.filter((e) => e.name.toLowerCase().includes(want)).sort((a, b) => Math.abs(a.moves.length - uci.length) - Math.abs(b.moves.length - uci.length))[0] : undefined;
    const best = named ?? pool.filter((e) => e.moves.length <= uci.length).sort((a, b) => b.moves.length - a.moves.length)[0];
    if (want && !named) ok = false;
    notes.push(`book: "${best?.name ?? "(none)"}" (${best?.moves.length ?? 0} plies)${want ? (named ? ` has "${c.name}"` : ` MISSING "${c.name}"`) : ""}`);
  }
  for (const e of c.evals ?? []) {
    const fen = fens[e.at ?? fens.length - 1]!;
    const a = await engine.analyse(fen, [], 1);
    const sc = a.best.expected;
    const pass = sc >= e.lo && sc <= e.hi;
    if (!pass) ok = false;
    notes.push(`eval ${pass ? "ok" : "FAILS"}: ${sc.toFixed(2)} for the side to move (${a.best.move}${a.best.mate ? `, mate ${a.best.mate}` : ""}) in [${e.lo}, ${e.hi}]: ${e.say}`);
  }
  if (c.compare) {
    const fen = c.fen ? startFen : fens.at(-1)!;
    const g2 = new Chess(fen);
    const toUci = (s: string) => {
      const m = new Chess(fen).move(s);
      return m.from + m.to;
    };
    void g2;
    const sc = await engine.scoreMoves(fen, [toUci(c.compare.better), toUci(c.compare.worse)]);
    const b = sc.find((x) => x.move === toUci(c.compare!.better))!.expected;
    const w = sc.find((x) => x.move === toUci(c.compare!.worse))!.expected;
    const pass = b - w >= c.compare.by;
    if (!pass) ok = false;
    notes.push(`compare ${pass ? "ok" : "FAILS"}: ${c.compare.better} ${b.toFixed(2)} vs ${c.compare.worse} ${w.toFixed(2)} for the mover: ${c.compare.say}`);
  }
  if (c.hangs) {
    const sq = c.hangs as Parameters<Chess["isAttacked"]>[0];
    const mover = g.turn();
    const other = mover === "w" ? "b" : "w";
    // (The side that just moved attacks it; the side to move, whose it is, doesn't defend it.)
    const pass = g.get(sq)?.color === mover && g.isAttacked(sq, other) && !g.isAttacked(sq, mover);
    if (!pass) ok = false;
    notes.push(`hangs ${pass ? "ok" : "FAILS"}: ${c.hangs} (the side to move's) attacked, defended by nobody`);
  }
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"} ${c.id}: ${notes.join("; ")}`);
}
engine.close();
console.log(bad ? `${bad} FAILED` : "all passed");
process.exit(bad ? 1 : 0);
