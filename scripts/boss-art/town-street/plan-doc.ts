/**
 * The street town's plan, exact (Nov 5, final): writes scripts/boss-art/out/town-plan-nov5.md (for people and the layout
 * code) and town-plan-nov5.json (the same data for a machine), from plan.ts, and runs the plan's checks (every home's front
 * seen from its street's camera, nothing blocking a door, a table or the gate, the start reaching everywhere). Exits 1 if
 * a check fails.
 *
 *   npx tsx scripts/boss-art/town-street/plan-doc.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ARENA, BOARD, camAt, COLISEUM, FOUNTAIN, GARDEN, GRASS, ground, HOME_INFO, LOT, LOTS, N, PARK, PARK_PLAN, PAVE, PROPS, START, STATUES, STREETS, TABLES,
  TURN_ZONES, blockedSquares, doorSquare, walkable, wanderBox, wrap, type HomeId, type Lot,
} from "./plan.ts";
import { COLOURWAYS, DEPTH, DESIGN_NAMES, INSET, type Design } from "../out/town-buildings/buildings.ts";
import { HOME_DEPTH, HOME_INSET } from "../out/town-buildings/home-boxes.ts";

const OUT = resolve("scripts/boss-art/out");
const at = (c: number, r: number) => wrap(r) * N + wrap(c);
const blocked = blockedSquares();
const md: string[] = [];
const P = (s = "") => md.push(s);
const fails: string[] = [];

const range = (a: number, b: number) => (a === b ? `${wrap(a)}` : `${wrap(a)}..${wrap(b)}`);
const lotSquares = (l: Lot) => (l.facing === "S" ? { c: [l.c0, l.c0 + l.w - 1], r: [l.r0, l.r0 + l.d - 1] } : { c: [l.c0, l.c0 + l.d - 1], r: [l.r0, l.r0 + l.w - 1] });
const depthOf = (l: Lot) => (l.kind === "home" ? HOME_DEPTH : l.kind === "tall" ? (l.id === "tower" ? 46 / 37 : DEPTH.tall) : DEPTH.house);
const insetOf = (l: Lot) => (l.kind === "home" ? HOME_INSET : l.kind === "tall" ? INSET.tall : INSET.house);
const frontLine = (l: Lot) => (l.facing === "S" ? `y = ${(l.r0 - 0.5 + insetOf(l)).toFixed(2)}` : `x = ${(l.c0 - 0.5 + insetOf(l)).toFixed(2)}`);
const buildingName = (l: Lot) => (l.kind === "home" ? HOME_INFO[l.id as HomeId].name : `${DESIGN_NAMES[l.id as Design]} (${COLOURWAYS[l.id as Design][l.v]!.name})`);
const artId = (l: Lot) => (l.kind === "home" ? `homeBox("${l.id}")` : `building("${l.id}", ${l.w}, ${l.v})`);

// ---- The checks.
// 1. Every home's front, seen from its street's camera: the camera faces the way its front faces it, and from the street's
//    far half to the front every square in front of the home is street or sidewalk (nothing stands between).
const homeChecks: string[] = [];
for (const l of LOTS.filter((x) => x.kind === "home")) {
  const st = STREETS.find((s) => s.id === l.street)!;
  const problems: string[] = [];
  for (let c = l.c0; c < l.c0 + l.w; c++) {
    for (let r = st.r1 - 1; r < l.r0; r++) {
      const g = ground[at(c, r)]!;
      if (g !== BOARD && g !== PAVE) problems.push(`(${wrap(c)}, ${wrap(r)}) isn't open ground`);
      if (r >= st.r0 && r <= st.r1 && camAt(c, r) !== st.cam) problems.push(`(${wrap(c)}, ${wrap(r)}) is in a turn zone`);
    }
    for (const p of PROPS) if ((p.kind === "tree" || p.kind === "shed") && Math.round(p.x) === wrap(c) && p.y > st.r1 - 1 && p.y < l.r0) problems.push(`a ${p.kind} at (${p.x}, ${p.y})`);
  }
  const facingOk = (l.facing === "S" && st.cam === 0) || (l.facing === "W" && st.cam === 90);
  if (!facingOk) problems.push("its front doesn't face its street's camera");
  homeChecks.push(`${HOME_INFO[l.id as HomeId].name}: ${problems.length ? "FAILS: " + problems.join("; ") : "seen whole from " + st.name + " (camera " + (st.cam ? "east" : "north") + ")"}`);
  if (problems.length) fails.push(`home ${l.id}`);
}
// 2. Walking: everywhere from your start (4-way steps, the wrap included).
const seen = new Uint8Array(N * N);
const queue = [at(START.c, START.r)];
seen[queue[0]!] = 1;
while (queue.length) {
  const q = queue.shift()!;
  const c = q % N, r = Math.floor(q / N);
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const n = at(c + dc, r + dr);
    if (!seen[n] && walkable(c + dc, r + dr, blocked)) (seen[n] = 1), queue.push(n);
  }
}
const reach = (c: number, r: number) => !!seen[at(c, r)];
const walkChecks: string[] = [];
if (!walkable(START.c, START.r, blocked)) fails.push("start"), walkChecks.push("FAILS: your start square isn't walkable");
for (const l of LOTS.filter((x) => x.kind === "home")) {
  const d = doorSquare(l);
  const ok = walkable(d.c, d.r, blocked) && reach(d.c, d.r);
  if (!ok) fails.push(`door ${l.id}`);
  walkChecks.push(`${HOME_INFO[l.id as HomeId].boss}'s door square (${d.c}, ${d.r}): ${ok ? "open, reached from the start" : "FAILS (blocked or unreachable)"}`);
}
let stoolsOk = 0;
for (const t of TABLES) for (const dc of [-1, 1]) {
  const c = t.c + dc;
  // A stool square is the table's (blocked to walk through); its player stands on it, so the square must be reachable from a neighbour.
  const nb = [[c + 1, t.r], [c - 1, t.r], [c, t.r + 1], [c, t.r - 1]].some(([a, b]) => reach(a!, b!));
  if (nb) stoolsOk++;
  else fails.push(`stool ${c},${t.r}`);
}
walkChecks.push(`The 12 tables' 24 stools: ${stoolsOk} of 24 reached from a walkable neighbour`);
const gate = [22, 23].every((c) => reach(c, 27));
if (!gate) fails.push("gate");
walkChecks.push(`The Colosseum's gate (22..23, 27): ${gate ? "reached" : "FAILS"}`);
let board = 0, boardReached = 0;
for (let i = 0; i < N * N; i++) if (ground[i] === BOARD) (board++, seen[i] && boardReached++);
if (board !== boardReached) fails.push("streets");
walkChecks.push(`Street (board) squares reached: ${boardReached} of ${board}`);
const lampsOnDoors = PROPS.filter((p) => p.kind === "lamp" && LOTS.some((l) => l.kind === "home" && doorSquare(l).c === wrap(p.x) && doorSquare(l).r === wrap(p.y)));
if (lampsOnDoors.length) fails.push("lamp on a door");
walkChecks.push(`Lamps on a door square: ${lampsOnDoors.length ? lampsOnDoors.map((p) => `(${p.x}, ${p.y})`).join(", ") : "none"}`);
// The bosses' wander boxes: which of their sidewalk squares a lamp stands on (a boss steps round it).
const wanderNotes: string[] = [];
for (const l of LOTS.filter((x) => x.kind === "home")) {
  const lamps = PROPS.filter((p) => p.kind === "lamp" && Math.round(p.y) === wrap(l.r0 - 1) && wrap(p.x - l.c0) < l.w);
  if (lamps.length) wanderNotes.push(`${HOME_INFO[l.id as HomeId].boss}: a lamp at ${lamps.map((p) => `(${p.x}, ${p.y})`).join(", ")}`);
}

// ---- The document.
P("# The street town's plan, exact (Nov 5)");
P();
P("The data the layout code (code round 2) needs, generated from `scripts/boss-art/town-street/plan.ts` by");
P("`npx tsx scripts/boss-art/town-street/plan-doc.ts`, which also writes the same data as [town-plan-nov5.json](town-plan-nov5.json)");
P("and runs the checks at the end. The picture: [town-art/0-plan.png](town-art/0-plan.png). The art each lot names is in");
P("`out/town-buildings/` (`town-art-nov5.md` says how to use it). Eric approved this plan in the mockups (Nov 5); nothing in it");
P("moved since, except the colourways (now three a design), the lamps (now on whole squares) and what's new below (doors, wander");
P("boxes, the start, the walking and the turn zones).");
P();
P("## Squares");
P();
P("- The world is 46 x 46 and wraps (as today). A square is (c, r): c 0..45 west to east, r 0..45 south to north (world.ts's way).");
P("  A range written `44..1` wraps (44, 45, 0, 1).");
P("- A thing's position (x, y) is in squares, a square's middle at whole numbers (a square (c, r) runs from c - 0.5 to c + 0.5).");
P("- Ground: `BOARD` the streets (the chessboard), `PAVE` sidewalks, the park's walks, South Lane and the Colosseum's apron,");
P("  `GRASS` the park's lawns, `GARDEN` back gardens and the grove, `LOT` under a building, `ARENA` the Colosseum.");
P();
P("## Streets and the camera");
P();
P("| Street | Board squares | Sidewalks | Camera faces |");
P("| --- | --- | --- | --- |");
const walks: Record<string, string> = {
  "seam-st": "r 43 (its near side) and r 2 (its fronts' side), all the way round",
  "fountain-st": "r 12 and r 17, c 33..12 (through the park it's the park's walk)",
  "colosseum-row": "r 25, c 33..12 (the plaza's apron in the middle); none on its south side (Fountain Street's lots back onto it)",
  "upper-st": "r 29 and r 34, c 33..12 (it ends at the Colosseum's grove both sides)",
  "seam-ave": "c 43 (its near side) and c 2 (its fronts' side), all the way round",
};
for (const s of STREETS) P(`| ${s.name} | c ${range(s.c0, s.c1)}, r ${range(s.r0, s.r1)} | ${walks[s.id]} | ${s.cam ? "east (90)" : "north (0)"} |`);
P("| South Lane | (paving) c 21..24, r 3..8 | it is paving | north |");
P("| The park, the plaza | see below | | north |");
P();
P("- **Heading:** the camera faces north (0) everywhere except on Seam Avenue (c 43..2), where it faces east (90).");
P("- **Turn zones** (Seam Avenue's four crossings; on these squares of the avenue the camera faces north):");
for (const z of TURN_ZONES) P(`  - ${STREETS.find((s) => s.id === z.street)!.name}: c 43..2, r ${range(z.rows[0], z.rows[1])} (the street and its sidewalks)`);
P("- **The turn:** the target heading is the square you're on's (`camAt`); the camera eases toward it, about you (it keeps");
P("  following you), over about 0.5 s (a run across the crossing's four squares), shortest way round. The sky's clouds slide");
P("  with the heading; the sun stays.");
P("- **The Colosseum** is only drawn from afar (today's `drawFarColiseum`) while the camera faces within 45 degrees of north.");
P("- **Nothing between the camera and you:** fronts, sides and roofs nearer the camera than about 0.9 squares behind you aren't");
P("  drawn (the near side is back gardens and the backs of the next street's lots; their backs are never seen). Low things there");
P("  (hedges, beds, bushes) are drawn; sheds aren't when that near; trees fade out over the last 1.5 squares (as the shops' near");
P("  pieces do now).");
P();
P("## Lots");
P();
P("Every building's lot, its art (`homeBox` from home-boxes.ts, `building` from buildings.ts), which way its front faces, its");
P("front line (where its front picture stands: the lot's front edge plus its inset) and the box's depth back from that line.");
P("A lot facing S has its front on its south edge (row r0), onto an east-west street; facing W, on its west edge (column c0),");
P("onto Seam Avenue. `Corner side` marks a lot whose west side wall faces Seam Avenue (seen from the avenue).");
P();
P("| Street | Building | Art | Squares | Faces | Front line | Depth | Corner side |");
P("| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const l of LOTS) {
  const sq = lotSquares(l);
  const st = STREETS.find((s) => s.id === l.street)!;
  P(`| ${l.kind === "tall" ? st.name + " (behind)" : st.name} | ${buildingName(l)} | \`${artId(l)}\` | c ${range(sq.c[0]!, sq.c[1]!)}, r ${range(sq.r[0]!, sq.r[1]!)} | ${l.facing} | ${frontLine(l)} | ${depthOf(l).toFixed(2)} | ${l.side ? "yes" : ""} |`);
}
P();
P("The bigger buildings behind (`tall`) stand on lots 3 squares behind the front rows; nobody can reach them, and they never");
P("face a camera but north's.");
P();
P("## The boss homes: doors and where the bosses wander");
P();
P("- **Door square:** the sidewalk square in front of the home's door (Eric, Nov 5: a tap on the home walks you there). The");
P("  door's middle on the front picture is `HOME_SPECS[id].door` (px); the front is centred on its lot.");
P("- **Wander box:** the boss's own yard (the strip between the lot's front edge and its front line) and the sidewalk in front,");
P("  its lot's width along; in square coordinates (a boss's foot stays inside).");
P();
P("| Home | Boss | Lot | Door square | Wander box (x, y) |");
P("| --- | --- | --- | --- | --- |");
for (const l of LOTS.filter((x) => x.kind === "home")) {
  const sq = lotSquares(l);
  const d = doorSquare(l);
  const wb = wanderBox(l);
  P(`| ${HOME_INFO[l.id as HomeId].name} | ${HOME_INFO[l.id as HomeId].boss} | c ${range(sq.c[0]!, sq.c[1]!)}, r ${range(sq.r[0]!, sq.r[1]!)} | (${d.c}, ${d.r}) | x ${wb.x0.toFixed(2)}..${wb.x1.toFixed(2)}, y ${wb.y0.toFixed(2)}..${wb.y1.toFixed(2)} |`);
}
if (wanderNotes.length) {
  P();
  P("Lamps stand in some wander boxes' sidewalk (a boss walks round them):");
  for (const n of wanderNotes) P(`- ${n}`);
}
P();
P("## The park (the plus)");
P();
P(`${PARK.w} x ${PARK.d}: c ${PARK.c0}..${PARK.c0 + PARK.w - 1}, r ${PARK.r1 - PARK.d + 1}..${PARK.r1}. A row a line, north at the top; \`=\` paving, \`.\` grass, \`t\` a`);
P("tree, `b` a bench (on grass), `T` a chess table with its stools `s` either side (west and east), `F` the fountain (2 x 2, `f` its");
P("other squares), `L` a lamp (on paving). The promenade (c 21..24) runs north to south, the new walk (Fountain Street's");
P("stretch, r 13..16) east to west, crossing at the fountain.");
P();
P("```");
PARK_PLAN.forEach((line, v) => P(`r ${String(PARK.r1 - v).padStart(2)}  ${line}`));
P(`      ${"c " + PARK.c0}${" ".repeat(PARK.w - 6)}${PARK.c0 + PARK.w - 1}`);
P("```");
P();
P(`- Tables (${TABLES.length}): ${TABLES.map((t) => `(${t.c}, ${t.r})`).join(", ")}; each table's stools on (c - 1, r) and (c + 1, r).`);
P(`- The fountain: ${FOUNTAIN.map((f) => `(${f.c}, ${f.r})`).join(", ")}.`);
P(`- Trees: ${PROPS.filter((p) => p.kind === "tree" && p.x >= PARK.c0 && p.x < PARK.c0 + PARK.w && p.y <= PARK.r1 && p.y > PARK.r1 - PARK.d).map((p) => `(${p.x}, ${p.y})`).join(", ")}.`);
P(`- Benches: ${PROPS.filter((p) => p.kind === "bench").map((p) => `(${p.x}, ${p.y})`).join(", ")}.`);
P(`- Lamps: ${PROPS.filter((p) => p.kind === "lamp" && p.x >= PARK.c0 && p.x < PARK.c0 + PARK.w && p.y <= PARK.r1 && p.y > PARK.r1 - PARK.d).map((p) => `(${p.x}, ${p.y})`).join(", ")}.`);
P("- The four walks lead out: north onto Colosseum Row and the plaza, west and east along Fountain Street, south down South Lane.");
P();
P("## The Colosseum and its grove");
P();
P(`- The Colosseum (as today): c ${COLISEUM.c0}..${COLISEUM.c0 + COLISEUM.size - 1}, r ${COLISEUM.r0}..${COLISEUM.r0 + COLISEUM.size - 1} (\`ARENA\`), its front on y = ${COLISEUM.r0 - 0.5}, facing south, one flat picture (always seen front on).`);
P("- Its apron: c 17..28, r 25..27 (paving), the plaza's sidewalk r 25 from c 13 to 32; the gate at c 22..23 on r 27.");
P(`- Its statues: ${STATUES.map((s) => `(${s.c}, ${s.r})`).join(", ")} (drawn in its picture, as the game does).`);
P(`- The grove (garden, unwalkable), trees at: ${PROPS.filter((p) => p.kind === "tree" && !(p.x >= PARK.c0 && p.x < PARK.c0 + PARK.w && p.y <= PARK.r1 && p.y > PARK.r1 - PARK.d)).map((p) => `(${p.x}, ${p.y})`).join(", ")}.`);
P("- Upper Street ends at the grove on both sides (c 12 and c 33); Seam Street runs behind it facing north (the Colosseum is behind the camera there).");
P();
P("## Street dressing");
P();
const lamps = PROPS.filter((p) => p.kind === "lamp" && !(p.x >= PARK.c0 && p.x < PARK.c0 + PARK.w && p.y <= PARK.r1 && p.y > PARK.r1 - PARK.d));
P(`- Lamps (the park's lamp, each on a whole sidewalk square; ${lamps.length} along the streets): ${lamps.map((p) => `(${p.x}, ${p.y})`).join(", ")}.`);
P("- Hedges: one a square along each near sidewalk's garden (or lot-back) edge: on r 42, 11, 28 and 20 where those squares are garden");
P("  or lot (the hedge's face toward the camera at y = r + 0.05, its top running to r + 0.45), and on c 42 along Seam Avenue (its");
P("  face at x = 42.05). Each is `hedgeFront(v)` standing as a plane plus `hedgeTop(v)` as its top face (`v` = c % 3, or r % 3).");
const gardenProps = PROPS.filter((p) => p.kind === "shed" || p.kind === "bed" || p.kind === "bush");
P(`- Back gardens: ${gardenProps.filter((p) => p.kind === "shed").length} sheds, ${gardenProps.filter((p) => p.kind === "bed").length} flower beds, ${gardenProps.filter((p) => p.kind === "bush").length} bushes, placed by plan.ts's hash (every square in the JSON). Nothing there stands`);
P("  taller than about a square.");
P("- Sidewalk squares get the slabbed tile; a sidewalk square that shares an edge with the street gets the kerb along that edge.");
P();
P("## Walking");
P();
P("- **You and the bots** walk on `BOARD`, `PAVE` and `GRASS` squares, except where a prop stands: a tree, a bench, a lamp, a");
P("  table and its two stools, the fountain's four squares, a shed. Not on lots, gardens, the grove or the Colosseum's ground.");
P("- **Bosses** stay in their wander boxes.");
P(`- **Your start:** (${START.c}, ${START.r}), on the promenade just south of the fountain, facing north (the plaza and the Colosseum ahead).`);
P();
P("The whole world (north at the top; `#` board, `=` paving, `,` grass, `g` garden, `L` lot, `A` arena, `x` a prop on a walkable square,");
P("`D` a door square, `@` your start):");
P();
P("```");
const doors = new Map(LOTS.filter((l) => l.kind === "home").map((l) => { const d = doorSquare(l); return [at(d.c, d.r), l]; }));
for (let r = N - 1; r >= 0; r--) {
  let row = "";
  for (let c = 0; c < N; c++) {
    const i = at(c, r);
    const g = ground[i]!;
    row += c === START.c && r === START.r ? "@" : doors.has(i) ? "D" : (g === BOARD || g === PAVE || g === GRASS) && blocked.has(i) ? "x" : g === BOARD ? "#" : g === PAVE ? "=" : g === GRASS ? "," : g === GARDEN ? "g" : g === LOT ? "L" : g === ARENA ? "A" : "?";
  }
  P(`${String(r).padStart(2)} ${row}`);
}
P(`   ${Array.from({ length: N }, (_, c) => (c % 10 === 0 ? String(c / 10) : " ")).join("")}`);
P(`   ${Array.from({ length: N }, (_, c) => String(c % 10)).join("")}`);
P("```");
P();
P("## Checks");
P();
P("Run by plan-doc.ts each time (it fails if any does).");
P();
P("**Every home's front is seen whole from its street's camera** (the camera faces its front; every square between the street's");
P("far half and its front is street or sidewalk, out of any turn zone, with no tree or shed on it):");
P();
for (const h of homeChecks) P(`- ${h}`);
P();
P("**Nobody's start or path is blocked:**");
P();
for (const w of walkChecks) P(`- ${w}`);
P();
P(fails.length ? `**FAILED:** ${fails.join(", ")}` : "All pass.");
writeFileSync(resolve(OUT, "town-plan-nov5.md"), md.join("\n") + "\n");

// ---- The JSON.
const json = {
  size: N,
  conventions: "squares (c, r): c west to east, r south to north, wrapping; positions (x, y) in squares, a square's middle at whole numbers",
  ground: Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => "#=,gLA"[ground[at(c, r)]!]).join("")),
  groundKey: { "#": "BOARD", "=": "PAVE", ",": "GRASS", g: "GARDEN", L: "LOT", A: "ARENA" },
  streets: STREETS,
  turnZones: TURN_ZONES,
  start: START,
  lots: LOTS.map((l) => ({ ...l, art: artId(l), name: buildingName(l), inset: insetOf(l), depth: +depthOf(l).toFixed(3), ...(l.kind === "home" ? { door: doorSquare(l), wander: wanderBox(l) } : {}) })),
  park: { ...PARK, plan: PARK_PLAN, tables: TABLES, fountain: FOUNTAIN },
  coliseum: { ...COLISEUM, statues: STATUES, gate: [{ c: 22, r: 27 }, { c: 23, r: 27 }] },
  props: PROPS,
};
writeFileSync(resolve(OUT, "town-plan-nov5.json"), JSON.stringify(json, null, 1) + "\n");
console.log(`wrote town-plan-nov5.md and .json; ${fails.length ? "FAILED: " + fails.join(", ") : "all checks pass"}`);
if (fails.length) process.exit(1);
