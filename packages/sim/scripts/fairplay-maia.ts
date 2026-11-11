/**
 * Strong human-like players for the fair-play simulation: Maia-3's move choices (packages/maia-worker, AGPL-3.0, as its own program:
 * UCI text through src/maia-process.ts) at 2200, 2400, 2500 and 2600 in every position of the bank (fairplay-bank.ts), so fairplay-sim.ts can play honest
 * players who pick as strong people do, not only as Stockfish's limited strength does. Any move Maia would play that the bank's judges
 * didn't score is scored here by the same judge search (the browser engine at the game's budget), as the bank scores every other move.
 *
 *   npx tsx packages/sim/scripts/fairplay-maia.ts      # -> packages/sim/data/fairplay-maia.json.gz (about 10 minutes)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS } from "@chessroyale/core";
import { HumanUciEngine } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { maiaProcess } from "../src/maia-process.ts";
import type { BankGame } from "./fairplay-bank.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
export const MAIA_FILE = root + "packages/sim/data/fairplay-maia.json.gz";
export const MAIA_RATINGS = [2200, 2400, 2500, 2600] as const;
/** Moves kept per position and rating: Maia's likeliest, down to this probability (enough for a draw at top-p 0.95). */
const KEEP_P = 0.005;
const KEEP_MAX = 12;

/** Per position (by FEN): Maia's likeliest moves at each rating ([move, probability], likeliest first), and judge scores the bank lacked. */
export interface MaiaEntry {
  r: Record<number, [string, number][]>;
  extra: Record<string, number>;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = JSON.parse(gunzipSync(readFileSync(root + "packages/sim/data/fairplay-bank.json.gz")).toString()) as BankGame[];
  const maia = new HumanUciEngine(maiaProcess());
  if (!(await maia.init(120_000))) throw new Error(`Maia didn't load: ${maia.error ?? "no reason"}`);
  const judge = await createNodeEngine({ nodes: DEFAULT_SETTINGS.engineNodes, hashMb: DEFAULT_SETTINGS.engineHashMb });
  const out: Record<string, MaiaEntry> = {};
  const t0 = Date.now();
  let n = 0;
  let scored = 0;
  for (const g of games)
    for (const p of g.positions) {
      const entry: MaiaEntry = { r: {}, extra: {} };
      for (const rating of MAIA_RATINGS) {
        const a = await maia.candidates(p.fen, rating, null, { temperature: 0, topP: 1, multipv: KEEP_MAX });
        if (!a?.moves.length) throw new Error(`no answer from Maia at ${p.fen}`);
        entry.r[rating] = a.moves.filter((m, i) => i === 0 || m.p >= KEEP_P).map((m) => [m.move, m.p]);
      }
      const known = new Set([...p.top.map(([m]) => m), ...Object.keys(p.extra)]);
      const missing = [...new Set(Object.values(entry.r).flatMap((ms) => ms.map(([m]) => m)))].filter((m) => !known.has(m));
      if (missing.length) for (const s of await judge.scoreMoves(p.fen, missing)) entry.extra[s.move] = s.expected;
      scored += missing.length;
      out[p.fen] = entry;
      if (++n % 100 === 0) console.log(`${n} positions, ${scored} moves scored, ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  judge.close();
  maia.close();
  writeFileSync(MAIA_FILE, gzipSync(JSON.stringify(out)));
  console.log(`${n} positions, ${scored} extra moves scored -> ${MAIA_FILE}`);
  process.exit(0);
}
