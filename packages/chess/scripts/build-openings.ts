/**
 * Builds data/openings.json from the Lichess chess-openings TSVs (CC0) in
 * data/sources/, for every opening length a lobby can choose: 0 to
 * MAX_OPENING_MOVES moves per side. For each length m it takes the distinct
 * positions that named lines reach after 2m + 1 plies (only named moves, no
 * engine filler), one per named variation, most popular first, up to a cap.
 * Each entry is scored after 2m plies (White to move) and 2m + 1 (Black to
 * move), and named after the longest named line its moves match. Run:
 * npx tsx packages/chess/scripts/build-openings.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS, MAX_OPENING_MOVES } from "@chessroyale/core";
import { createNodeEngine } from "../src/node.ts";
import { fenAfter, legalMoves, sanLineToUci } from "../src/rules.ts";
import type { Opening } from "../src/openings.ts";

const settings = DEFAULT_SETTINGS;
const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
/** Most entries kept per length (classic, unusual). */
const CAP = { classic: 100, unusual: 30 };

// Irregular openings count as "unusual"; everything else is classic.
const UNUSUAL_FAMILIES = new Set([
  "Amar Opening", "Amsterdam Attack", "Anderssen's Opening", "Barnes Defense", "Barnes Opening", "Borg Defense",
  "Carr Defense", "Clemenz Opening", "Creepy Crawly Formation", "Duras Gambit", "Fried Fox Defense", "Global Opening",
  "Goldsmith Defense", "Grob Opening", "Hippopotamus Defense", "Hungarian Opening", "Kádas Opening",
  "Lasker Simul Special", "Lemming Defense", "Lion Defense", "Mieses Opening", "Nimzowitsch Defense", "Owen Defense",
  "Polish Opening", "Rat Defense", "Saragossa Opening", "Sodium Attack", "St. George Defense", "Valencia Opening",
  "Van Geet Opening", "Van't Kruijs Opening", "Ware Defense", "Ware Opening", "Englund Gambit", "Latvian Gambit",
  "Elephant Gambit", "Bongcloud Attack", "Blackmar-Diemer Gambit", "Portuguese Opening", "Center Game",
  "Danish Gambit", "Halloween Gambit", "Jerome Gambit", "Kangaroo Defense", "Mikenas Defense", "Pterodactyl Defense",
  "Bird Opening", "Benko Opening", "Zukertort Opening", "Horwitz Defense", "Queen's Pawn Game",
]);

interface Named {
  eco: string;
  name: string;
  family: string;
  moves: string[];
}

const family = (name: string) => name.split(":")[0]!.split(",")[0]!.trim();
const named: Named[] = [];
for (const f of ["a", "b", "c", "d", "e"]) {
  for (const line of readFileSync(`${dataDir}sources/${f}.tsv`, "utf8").split("\n").slice(1)) {
    const [eco, name, pgn] = line.split("\t");
    if (!eco || !name || !pgn) continue;
    const sans = pgn.split(/\s+/).filter((t) => t && !/^\d+\.+$/.test(t));
    try {
      named.push({ eco, name, family: family(name), moves: sanLineToUci(sans) });
    } catch {
      // A line that doesn't parse is skipped.
    }
  }
}
const byMoves = new Map(named.map((n) => [n.moves.join(" "), n]));
const START: Named = { eco: "", name: "Starting position", family: "Starting position", moves: [] };

/** The longest named line that the moves start with. */
function nameFor(moves: readonly string[]): Named {
  for (let j = moves.length; j > 0; j--) {
    const hit = byMoves.get(moves.slice(0, j).join(" "));
    if (hit) return hit;
  }
  return START;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Choose the lines for each length.
interface Pick { m: number; moves: string[]; popularity: number; label: Named; short: Named }
const picks: Pick[] = [];
for (let m = 0; m <= MAX_OPENING_MOVES; m++) {
  const n = 2 * m + 1;
  const counts = new Map<string, number>();
  for (const l of named) if (l.moves.length >= n) {
    const k = l.moves.slice(0, n).join(" ");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  // One per named variation (the part of the name before any comma), the most travelled first.
  const best = new Map<string, Pick>();
  for (const [k, popularity] of counts) {
    const moves = k.split(" ");
    const label = nameFor(moves);
    const key = label.name.split(",")[0]!;
    const prev = best.get(key);
    if (!prev || popularity > prev.popularity) best.set(key, { m, moves, popularity, label, short: nameFor(moves.slice(0, 2 * m)) });
  }
  // A line that ends in checkmate or stalemate (a trap) can't start a board.
  const playable = (moves: string[]) => legalMoves(fenAfter(moves.slice(0, 2 * m))).length > 0 && legalMoves(fenAfter(moves)).length > 0;
  const sorted = [...best.values()].filter((p) => playable(p.moves)).sort((a, b) => b.popularity - a.popularity);
  const classic = sorted.filter((p) => !UNUSUAL_FAMILIES.has(p.short.family)).slice(0, CAP.classic);
  const unusual = sorted.filter((p) => UNUSUAL_FAMILIES.has(p.short.family)).slice(0, CAP.unusual);
  picks.push(...classic, ...unusual);
  console.log(`${m} moves: ${counts.size} positions, ${best.size} variations, kept ${classic.length} classic + ${unusual.length} unusual`);
}

// Score every distinct position once.
const fens = [...new Set(picks.flatMap((p) => [fenAfter(p.moves.slice(0, 2 * p.m)), fenAfter(p.moves)]))];
console.log(`${picks.length} entries, ${fens.length} positions to score`);
const WORKERS = 4;
const engines = await Promise.all(
  Array.from({ length: WORKERS }, () => createNodeEngine({ nodes: settings.engineNodes, hashMb: settings.engineHashMb })),
);
// Scores are cached by position (same engine settings), so a rebuild only searches new positions.
const cacheFile = `${dataDir}sources/opening-scores.json`;
const cacheKey = `${settings.engineNodes}`;
const cache: Record<string, Record<string, number>> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {};
const scores = new Map<string, number>(Object.entries(cache[cacheKey] ?? {}));
const save = () => writeFileSync(cacheFile, JSON.stringify({ ...cache, [cacheKey]: Object.fromEntries(scores) }) + "\n");
const todo = fens.filter((f) => !scores.has(f));
console.log(`${fens.length - todo.length} cached, ${todo.length} to search`);
let next = 0;
await Promise.all(
  engines.map(async (engine) => {
    while (next < todo.length) {
      const fen = todo[next++]!;
      const a = await engine.analyse(fen);
      scores.set(fen, Math.round(a.best.expected * 1000) / 1000);
      if (scores.size % 100 === 0) {
        console.log(`${scores.size}/${fens.length}`);
        save();
      }
    }
  }),
);
engines.forEach((e) => e.close());
save();

const [LO, HI] = settings.openingBalance;
const results: Opening[] = [];
for (const p of picks) {
  const short = p.moves.slice(0, 2 * p.m);
  const expected = { [2 * p.m]: scores.get(fenAfter(short))!, [2 * p.m + 1]: scores.get(fenAfter(p.moves))! };
  if (!Object.values(expected).some((e) => e >= LO && e <= HI)) continue;
  results.push({
    id: `${p.m}-${slug(p.label.name)}-${slug(p.moves.slice(-2).join(""))}`,
    eco: p.short.eco || p.label.eco,
    name: p.short.name,
    names: { [2 * p.m]: p.short.name, [2 * p.m + 1]: p.label.name },
    family: p.short.family,
    unusual: UNUSUAL_FAMILIES.has(p.short.family),
    moves: p.moves,
    namedPlies: p.moves.length,
    expected,
  });
}
results.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
writeFileSync(`${dataDir}openings.json`, JSON.stringify(results) + "\n");
for (let m = 0; m <= MAX_OPENING_MOVES; m++) {
  const at = results.filter((o) => o.moves.length === 2 * m + 1);
  console.log(`${m} moves: ${at.length} kept, ${new Set(at.map((o) => o.family)).size} families`);
}
