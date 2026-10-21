/**
 * Starting positions for measuring the HunChess engine: normal openings (the repo's opening library) and Auto-chess-like sparse
 * positions (both kings and the armies the Auto chess bot buys, 4 to 10 pieces a side), all seeded.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AUTOCHESS, mulberry32, shuffle, type Rng } from "@chessroyale/core";
import { fenAfter, type Opening } from "@chessroyale/chess";
import { botBuys } from "../../app/src/autochess/bot.ts";
import { emptyArmy, kingSquares } from "../../app/src/autochess/army.ts";
import { incomeFor } from "../../app/src/autochess/economy.ts";
import { fightStart } from "../../app/src/autochess/position.ts";
import type { Army } from "../../app/src/autochess/types.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface Start {
  kind: "opening" | "sparse";
  name: string;
  fen: string;
}

/** `n` normal openings: distinct library lines (not the unusual ones), 6 to 10 plies in. */
export function openingStarts(n: number, seed: number): Start[] {
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const lines = shuffle(mulberry32(seed), library.filter((o) => !o.unusual && o.moves.length >= 6));
  return lines.slice(0, n).map((o) => ({ kind: "opening" as const, name: o.name, fen: fenAfter(o.moves.slice(0, 10), START) }));
}

/** An Auto chess army the bot would buy in `round` (its board only), on its half, with its king. */
function botArmy(color: "w" | "b", king: string, round: number, rng: Rng): Army {
  const level = { level: Math.min(AUTOCHESS.levels.max, AUTOCHESS.levels.start + Math.floor(round / 2)), xp: 0 };
  return { ...botBuys(emptyArmy(color, king), incomeFor(round) + 30 * (round - 1), round, rng, AUTOCHESS, level).army, bench: [] };
}

/** `n` sparse positions: kings and 4 to 10 pieces a side, as the Auto chess bot buys them in rounds 1 to 8. */
export function sparseStarts(n: number, seed: number): Start[] {
  const rng = mulberry32(seed);
  const out: Start[] = [];
  for (let tries = 0; out.length < n && tries < n * 20; tries++) {
    const round = 1 + Math.floor(rng() * 8);
    const kings = kingSquares((rng() * 2 ** 32) >>> 0);
    const w = botArmy("w", kings.w, round, rng);
    const b = botArmy("b", kings.b, round, rng);
    const nw = Object.keys(w.board).length;
    const nb = Object.keys(b.board).length;
    if (nw < 4 || nb < 4 || nw > 10 || nb > 10) continue;
    const start = fightStart(w, b);
    if (start.draw) continue;
    out.push({ kind: "sparse", name: `round ${round}: ${nw} v ${nb}`, fen: start.fen });
  }
  return out;
}
