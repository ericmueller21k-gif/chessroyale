/**
 * Builds data/openings.json from the Lichess chess-openings TSVs (CC0) in
 * data/sources/. Each line is played out to openingPlies + 1 plies (short lines
 * are extended with the engine's best moves), then scored at both lengths so a
 * board can start with either side to move. Lines whose ending isn't balanced
 * are dropped. Run: npx tsx packages/chess/scripts/build-openings.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS } from "@chessroyale/core";
import { createNodeEngine } from "../src/node.ts";
import { fenAfter, gameEnd, legalMoves, sanLineToUci } from "../src/rules.ts";
import type { Opening } from "../src/openings.ts";

const settings = DEFAULT_SETTINGS;
const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const PLIES = settings.openingPlies;
const [LO, HI] = settings.openingBalance;

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

interface Row {
  eco: string;
  name: string;
  family: string;
  sans: string[];
}

const rows: Row[] = [];
for (const f of ["a", "b", "c", "d", "e"]) {
  for (const line of readFileSync(`${dataDir}sources/${f}.tsv`, "utf8").split("\n").slice(1)) {
    const [eco, name, pgn] = line.split("\t");
    if (!eco || !name || !pgn) continue;
    const sans = pgn.split(/\s+/).filter((t) => t && !/^\d+\.+$/.test(t));
    rows.push({ eco, name, family: name.split(":")[0]!.split(",")[0]!.trim(), sans });
  }
}

// One candidate per named variation (family plus the first part of the variation), the longest line for each.
const byVariation = new Map<string, Row>();
for (const r of rows) {
  const key = r.name.split(",")[0]!;
  const prev = byVariation.get(key);
  if (!prev || r.sans.length > prev.sans.length) byVariation.set(key, r);
}
const candidates = [...byVariation.values()].filter((r) =>
  UNUSUAL_FAMILIES.has(r.family) ? r.sans.length >= 2 : r.sans.length >= 8,
);
console.log(`${rows.length} named lines, ${candidates.length} candidates`);

const WORKERS = 4;
const engines = await Promise.all(
  Array.from({ length: WORKERS }, () => createNodeEngine({ nodes: settings.engineNodes, hashMb: settings.engineHashMb })),
);

async function build(row: Row, engineIndex: number): Promise<Opening | null> {
  const engine = engines[engineIndex]!;
  let moves = sanLineToUci(row.sans).slice(0, PLIES + 1);
  const namedPlies = moves.length;
  while (moves.length < PLIES + 1) {
    if (gameEnd(fenAfter([]), moves) || !legalMoves(fenAfter(moves)).length) return null;
    const [best] = await engine.topMoves(fenAfter(moves), 1);
    if (!best) return null;
    moves = [...moves, best.move];
  }
  const expected: Record<number, number> = {};
  for (const n of [PLIES, PLIES + 1]) {
    const prefix = moves.slice(0, n);
    if (gameEnd(fenAfter([]), prefix)) continue;
    const a = await engine.analyse(fenAfter(prefix));
    expected[n] = Math.round(a.best.expected * 1000) / 1000;
  }
  const balanced = Object.values(expected).some((e) => e >= LO && e <= HI);
  if (!balanced) return null;
  return {
    id: `${row.eco}-${row.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""),
    eco: row.eco,
    name: row.name,
    family: row.family,
    unusual: UNUSUAL_FAMILIES.has(row.family),
    moves,
    namedPlies,
    expected,
  };
}

const results: Opening[] = [];
let next = 0;
let done = 0;
await Promise.all(
  engines.map(async (_, w) => {
    while (next < candidates.length) {
      const row = candidates[next++]!;
      const o = await build(row, w);
      if (o) results.push(o);
      if (++done % 50 === 0) console.log(`${done}/${candidates.length}`);
    }
  }),
);
engines.forEach((e) => e.close());

results.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(`${dataDir}openings.json`, JSON.stringify(results, null, 1) + "\n");
const classic = results.filter((o) => !o.unusual);
const unusual = results.filter((o) => o.unusual);
console.log(
  `kept ${results.length} of ${candidates.length}: ${classic.length} classic (${new Set(classic.map((o) => o.family)).size} families), ` +
    `${unusual.length} unusual (${new Set(unusual.map((o) => o.family)).size} families)`,
);
