// CI's e2e shards (.github/workflows/e2e.yml): which spec files shard N of TOTAL runs, as Playwright file filters.
// Usage: node e2e/ci-shard.mjs N TOTAL
//
// Whole files are spread by their measured test time (ci-timings.json: seconds, both projects, from a CI run), the
// longest first, each to the shard with the least so far. Playwright's own --shard splits by test count instead, which
// left one shard with formats, crowd and crowd-hidden (21 minutes against 15 for the others). Every spec file goes to
// exactly one shard; a file the table doesn't know yet counts as the table's median. Inside a file the tests run in
// order on one worker, as they do locally. Refresh the table from the e2e run's summary ("Test time by file, as
// ci-timings.json") when the shards drift apart.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [n, total] = process.argv.slice(2).map(Number);
if (!(total >= 1 && n >= 1 && n <= total)) throw new Error("usage: node e2e/ci-shard.mjs N TOTAL (1 <= N <= TOTAL)");
const dir = dirname(fileURLToPath(import.meta.url));
const timings = JSON.parse(readFileSync(join(dir, "ci-timings.json"), "utf8"));
const known = Object.values(timings).sort((a, b) => a - b);
const median = known.length ? known[Math.floor(known.length / 2)] : 60;
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".spec.ts"))
  .map((f) => `e2e/${f}`)
  .sort();
const weight = (f) => timings[f] ?? median;
const load = Array(total).fill(0);
const mine = [];
for (const f of [...files].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b))) {
  const i = load.indexOf(Math.min(...load));
  load[i] += weight(f);
  if (i === n - 1) mine.push(f);
}
// (A filter is a regular expression matched against the file's path: dots escaped and the end anchored, so each
// picks exactly its own file.)
console.log(mine.map((f) => `${f.replaceAll(".", "\\.")}$`).join(" "));
