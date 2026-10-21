/**
 * How long the HunChess engine takes a move at the fight's node budget: in Node on this machine, and in Chromium (the same V8 as a
 * phone's Chrome) with the CPU unthrottled and throttled 4x (Playwright, CDP), against the fight's 350 ms a move (175 ms in the
 * fast late fight). Positions: the moves of real fights (Auto chess armies the bot buys) played by the engine itself.
 *
 *   npx tsx packages/sim/scripts/hunchess-speed.ts nodes=60000 fights=12 out=speed.json
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { chromium } from "@playwright/test";
import { AUTOCHESS } from "@chessroyale/core";
import { fightRules, gameResult, HunchessEngine } from "@chessroyale/chess/hunchess";
import { sparseStarts } from "../src/hunchess-starts.ts";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(k + "="))?.slice(k.length + 1) ?? d;
const NODES = (arg("nodes", String(AUTOCHESS.fightNodes)).split(",")).map(Number);
const FIGHTS = Number(arg("fights", "12"));
const OUT = arg("out", "");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const rules = fightRules(AUTOCHESS);

// Positions: the engine plays real fights (at the first budget); every position it moved in is kept.
const games: { startFen: string; moves: string[] }[] = [];
const engine = new HunchessEngine({ nodes: NODES[0]!, cashInValue: AUTOCHESS.cashInValue });
for (const s of sparseStarts(FIGHTS, 99)) {
  engine.newGame();
  const moves: string[] = [];
  for (;;) {
    const game = { startFen: s.fen, moves: [...moves], rules };
    if (gameResult(game)) break;
    games.push({ startFen: s.fen, moves: [...moves] });
    moves.push(engine.best(game).move!);
  }
}

function stats(ms: number[]) {
  const a = [...ms].sort((x, y) => x - y);
  const q = (p: number) => a[Math.min(a.length - 1, Math.floor(p * a.length))]!;
  return { mean: Math.round(a.reduce((s, v) => s + v, 0) / a.length), median: Math.round(q(0.5)), p95: Math.round(q(0.95)), max: Math.round(a[a.length - 1]!) };
}

const out: Record<string, unknown> = { positions: games.length, fights: FIGHTS };

// The engine for the page: one script, bundled.
const bundle = buildSync({
  stdin: { contents: `import { HunchessEngine, fightRules } from "./packages/chess/src/hunchess/index.ts"; (globalThis as any).Hun = { HunchessEngine, fightRules };`, resolveDir: root, loader: "ts" },
  bundle: true,
  format: "iife",
  write: false,
  minify: true,
}).outputFiles[0]!.text;

const browser = await chromium.launch();
for (const nodes of NODES) {
  // Node, this machine (each move from a fresh engine per fight, as the fight does: its table carries over between moves).
  const node: number[] = [];
  let last = "";
  const e = new HunchessEngine({ nodes, cashInValue: AUTOCHESS.cashInValue });
  for (const g of games) {
    if (g.startFen !== last) e.newGame();
    last = g.startFen;
    const t0 = performance.now();
    e.best({ ...g, rules });
    node.push(performance.now() - t0);
  }
  const row: Record<string, unknown> = { node: stats(node) };
  for (const throttle of [1, 4]) {
    const page = await browser.newPage();
    await page.addScriptTag({ content: bundle });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    const ms = await page.evaluate(
      ({ games, nodes, cfg }) => {
        const H = (globalThis as any).Hun;
        const rules = H.fightRules(cfg);
        const e = new H.HunchessEngine({ nodes, cashInValue: cfg.cashInValue });
        const out: number[] = [];
        let last = "";
        for (const g of games) {
          if (g.startFen !== last) e.newGame();
          last = g.startFen;
          const t0 = performance.now();
          e.best({ ...g, rules });
          out.push(performance.now() - t0);
        }
        return out;
      },
      { games, nodes, cfg: { checksToWin: AUTOCHESS.checksToWin, quietCap: AUTOCHESS.quietCap, moveCap: AUTOCHESS.moveCap, cashInValue: AUTOCHESS.cashInValue } },
    );
    row[`chromium x${throttle}`] = { ...stats(ms), over350: ms.filter((v) => v > 350).length, over175: ms.filter((v) => v > 175).length };
    await page.close();
  }
  out[String(nodes)] = row;
  console.log(nodes, JSON.stringify(row));
}
await browser.close();
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`${games.length} positions from ${FIGHTS} fights`);
