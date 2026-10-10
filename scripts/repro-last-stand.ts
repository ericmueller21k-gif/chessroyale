// Eric's two Boss alone games, replayed in the real Solo app (the Last Stand's numbers as the game judges them):
//   1. "already losing": moves that give a little away (8 to 20 points each), until the crowd's best move is worth
//      under `hang` percent (35 by default: in PR #129's replay that came at 19%), then a move that hangs the queen;
//   2. a move that hangs the queen on the first move.
// Each crowd move's numbers come from the Solo runner itself (its judge, its bar), logged as it scores the move.
//   npx tsx scripts/repro-last-stand.ts [phone|desktop] [boss] [hang=35]
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { DEFAULT_SETTINGS, lastStandBar } from "@chessroyale/core";
import { applyMove, legalMoves, pieceAt, toSan } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { Chess, type Square } from "chess.js";

const args = process.argv.slice(2).filter((a) => !a.includes("="));
const [which = "desktop", boss = "gingerbread"] = args;
const hangBelow = Number(process.argv.find((a) => a.startsWith("hang="))?.slice(5) ?? 35);
const s = DEFAULT_SETTINGS;
const picker = await createNodeEngine({ nodes: 150_000, hashMb: 16 });

/** The queen, moved to a square where something takes it for free (attacked, and by something cheaper or undefended). */
function hangsQueen(fen: string, move: string): boolean {
  const piece = pieceAt(fen, move.slice(0, 2));
  if (piece?.type !== "q") return false;
  const after = new Chess(applyMove(fen, move));
  const to = move.slice(2, 4) as Square;
  const them = piece.color === "w" ? "b" : "w";
  const attackers = after.attackers(to, them);
  return attackers.length > 0 && (attackers.some((a) => after.get(a as Square)!.type !== "q") || !after.isAttacked(to, piece.color));
}

process.chdir("packages/app");
const server = await createServer({ root: ".", configFile: "vite.config.ts", server: { port: 5193, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls!.local[0]!;
const browser = await chromium.launch();

async function game(name: string, choose: (fen: string, n: number, lastBest: number, barred: string | null) => Promise<string>, maxMoves: number) {
  const ctx = which === "phone" ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 800 } };
  const p = await browser.newPage(ctx);
  await p.goto(`${url}?debug&nolanding&clock=90&boss=${boss}`);
  await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  // Log what the runner judged, as the round is scored (before the move count moves on).
  await p.waitForFunction(() => (window as any).match?.runner?.state?.boss, null, { timeout: 180_000 });
  await p.evaluate(() => {
    const r = (window as any).match.runner;
    const log: unknown[] = ((window as any).__stand = []);
    const orig = r.finishRound.bind(r);
    r.finishRound = (results: any[], ...rest: unknown[]) => {
      const b = r.state.boss;
      for (const x of results) {
        const played = x.result.playedMove;
        const mine = x.scored.find((m: any) => m.move === played);
        const best = Math.max(...x.scored.map((m: any) => m.expected));
        log.push({ crowdMoves: b.crowdMoves, charges: b.kingCharges ?? 0, fallen: !!b.lastStand, fen: x.fenBefore, played, best, after: mine?.expected ?? null, loss: mine?.loss ?? null, stand: !!x.lastStand });
      }
      return orig(results, ...rest);
    };
  });
  const phase = () => p.evaluate(() => (window as any).match?.phase.kind ?? null);
  let lastBest = 0.5;
  // Rows logged so far, and the move he took back (barred from the re-pick).
  let logged = 0;
  let barred: string | null = null;
  console.log(`\n${name} (${boss}, ${which})`);
  console.log("move | played | best (crowd's chances after the best move) | after | loss | bar | position | Last Stand");
  for (let i = 0; i < maxMoves; i++) {
    const t0 = Date.now();
    while ((await phase()) !== "play") {
      if ((await phase()) === "results" || Date.now() - t0 > 240_000) return void (await p.close());
      await p.waitForTimeout(100);
    }
    const { fen, allowed } = await p.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null }));
    const n = await p.evaluate(() => (window as any).match.runner.state.boss.crowdMoves as number);
    let move = await choose(fen, n, lastBest, barred);
    if (allowed && !allowed.includes(move)) move = allowed[0]!;
    await p.waitForTimeout(400);
    await p.evaluate((m) => (window as any).match.submit(m), move);
    await p.waitForFunction((k) => ((window as any).__stand as unknown[]).length > k, logged, { timeout: 120_000 });
    const row = (await p.evaluate((k) => (window as any).__stand[k], logged++)) as { crowdMoves: number; charges: number; fallen: boolean; fen: string; played: string; best: number; after: number; loss: number; stand: boolean };
    const bar = lastStandBar(row.best, row.crowdMoves, row.charges, s);
    const where =
      row.best * 100 < s.lastStandFrom ? `under ${s.lastStandFrom}: already lost`
      : row.best * 100 < s.lastStandShareBelow ? `weak: bar ${s.lastStandShare * 100}% of what's left`
      : "ok";
    console.log(
      `${row.crowdMoves + 1} | ${toSan(row.fen, row.played)} | ${(row.best * 100).toFixed(1)}% | ${(row.after * 100).toFixed(1)}% | ${row.loss.toFixed(1)} | ${bar.toFixed(1)} | ${where} | ${row.stand ? "YES" : row.fallen ? "spent" : "no"}`,
    );
    lastBest = row.best;
    barred = row.stand ? row.played : null;
    if (row.stand) {
      // (He took the move back: one more pick from the same position, the move barred.)
      i--;
    }
    if (name.startsWith("2") && row.stand) break;
    if (name.startsWith("1") && hangsQueen(row.fen, row.played)) break;
  }
  await p.close();
}

/** Every legal move's expected score for the side to move (the picker's own numbers, only to choose a move). */
async function scored(fen: string) {
  const top = await picker.topMoves(fen, 1);
  const all = await picker.scoreMoves(fen, legalMoves(fen));
  const best = Math.max(top[0]!.expected, ...all.map((m) => m.expected));
  return all.map((m) => ({ ...m, loss: (best - m.expected) * 100 }));
}

// 1. Already losing: give a little away each move (8 to 20 points, as Eric's 5, 12 and 20), until the crowd's chances
//    after its best move are under `hang` percent; then hang the queen.
await game(
  "1. Already losing, then the queen hung",
  async (fen, _n, lastBest, barred) => {
    const moves = (await scored(fen)).filter((m) => m.move !== barred);
    if (lastBest * 100 < hangBelow) {
      const q = moves.filter((m) => hangsQueen(fen, m.move)).sort((a, b) => b.loss - a.loss)[0];
      if (q) return q.move;
    }
    const meh = moves.filter((m) => m.loss >= 8 && m.loss <= 20 && !hangsQueen(fen, m.move)).sort((a, b) => b.loss - a.loss);
    return (meh[0] ?? moves.sort((a, b) => a.loss - b.loss)[0]!).move;
  },
  30,
);

// 2. The queen hung at once, from an even position.
await game(
  "2. A bad queen move at the start",
  async (fen, _n, _lastBest, barred) => {
    const moves = (await scored(fen)).filter((m) => m.move !== barred);
    const q = moves.filter((m) => hangsQueen(fen, m.move)).sort((a, b) => b.loss - a.loss)[0];
    return (q ?? moves.sort((a, b) => b.loss - a.loss)[0]!).move;
  },
  2,
);

picker.close();
await browser.close();
await server.close();
