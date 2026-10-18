// CI's e2e plan (.github/workflows/e2e.yml, the `plan` job): which spec files a run tests, and on how many shards.
// A pull request runs the specs of the areas it changes (e2e/areas.json says which paths belong to which specs) plus
// the smoke set; a shared foundation, or any path the table doesn't know, runs every spec. A push to main, a manual run
// and a pull request with the `full-e2e` label run every spec too. Docs: docs/areas/ops.md, "CI e2e".
//
// Usage:
//   node e2e/ci-select.mjs full "<why>"      every spec on 5 shards (a push to main, a manual run, the full-e2e label)
//   node e2e/ci-select.mjs diff <base>       the specs for what changed from <base> to HEAD (a pull request: HEAD^1,
//                                           its merge commit's first parent, which is main as it is now)
//   node e2e/ci-select.mjs files <path>...   the same for these paths (to try the table out)
// It writes `specs` (the spec files, space-separated; empty for every spec), `total` (how many shards), `shards` (their
// numbers, as JSON) and `note` (one line) to $GITHUB_OUTPUT, and why each changed path runs what it runs to
// $GITHUB_STEP_SUMMARY; to stdout when they aren't set.
import { execFileSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Shards for every spec (a push to main), as before; a pull request uses as few as its specs need, up to this. */
export const MAX_SHARDS = 5;
/**
 * The test time a pull request's shard aims at: seconds, summed over both projects (ci-timings.json's unit), so about
 * half of it on the clock with 2 workers. With setup, a shard then takes about 6 minutes.
 */
export const SHARD_SECONDS = 600;

const DIR = dirname(fileURLToPath(import.meta.url));

/** A glob as a regular expression over a path from the repo's root: `*` within a folder, `**` across folders. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      // "**/" is any number of folders (none included); a "**" at the end is anything below.
      if (glob[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** Every spec file in e2e/, as `e2e/name.spec.ts`, sorted. */
export function specFiles(dir = DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".spec.ts"))
    .map((f) => `e2e/${f}`)
    .sort();
}

/** Each spec file's measured test time (ci-timings.json, seconds, both projects); one it doesn't know counts as the median. */
export function weigher(timings) {
  const known = Object.values(timings).sort((a, b) => a - b);
  const median = known.length ? known[Math.floor(known.length / 2)] : 60;
  return (file) => timings[file] ?? median;
}

export function readTimings(dir = DIR) {
  return JSON.parse(readFileSync(join(dir, "ci-timings.json"), "utf8"));
}

export function readAreas(dir = DIR) {
  return JSON.parse(readFileSync(join(dir, "areas.json"), "utf8"));
}

const SPEC = /^e2e\/[^/]+\.spec\.ts$/;

/**
 * What a pull request that changes `changed` (paths from the repo's root) runs, by the table `areas` (e2e/areas.json),
 * given the spec files there are (`existing`). `full` is why every spec runs (null when it doesn't); `specs` are the
 * spec files to run otherwise (smoke set included, sorted); `why` says, for each changed path, what it adds.
 */
export function select(changed, areas, existing) {
  const matcher = (globs) => {
    const res = globs.map(globToRegExp);
    return (path) => res.some((re) => re.test(path));
  };
  const isFull = matcher(areas.full);
  const isNone = matcher(areas.none);
  const list = Object.entries(areas.areas).map(([name, a]) => ({ name, test: matcher(a.paths), specs: a.specs }));
  const have = new Set(existing);
  const leftOut = new Set(areas.leftOut ?? []);
  const picked = new Set(areas.smoke);
  const why = [];
  let full = null;
  for (const path of [...new Set(changed)].sort()) {
    if (isFull(path)) {
      why.push({ path, runs: "every spec: a shared foundation (areas.json, `full`)" });
      full ??= `\`${path}\` is a shared foundation`;
      continue;
    }
    const hit = list.filter((a) => a.test(path));
    for (const a of hit) for (const s of a.specs) picked.add(s);
    const runs = hit.map((a) => a.name);
    if (SPEC.test(path)) {
      // A changed spec runs itself; a removed one, nothing.
      if (have.has(path)) {
        picked.add(path);
        runs.unshift("itself");
      } else if (!runs.length) runs.push("nothing (removed)");
    }
    if (runs.length) why.push({ path, runs: runs.join("; ") });
    else if (isNone(path)) why.push({ path, runs: "nothing: no browser test needs it (areas.json, `none`)" });
    else {
      why.push({ path, runs: "every spec: no area in areas.json has it" });
      full ??= `\`${path}\` isn't in e2e/areas.json`;
    }
  }
  const specs = [...picked].filter((s) => have.has(s) && !leftOut.has(s)).sort();
  if (!full && !specs.length) full = "no spec was picked";
  return { full, specs: full ? [] : specs, why };
}

/** How many shards `specs` need at SHARD_SECONDS each: at least 1, at most MAX_SHARDS, never more than the files. */
export function shardCount(specs, weight) {
  const seconds = specs.reduce((sum, f) => sum + weight(f), 0);
  return Math.max(1, Math.min(MAX_SHARDS, specs.length, Math.ceil(seconds / SHARD_SECONDS)));
}

/** The plan as the workflow's outputs, and the note for the run's page (Markdown). */
export function plan({ full, specs, why }, weight, all) {
  const total = full ? MAX_SHARDS : shardCount(specs, weight);
  const minutes = (s) => Math.round(s / 60);
  const seconds = (full ? all : specs).reduce((sum, f) => sum + weight(f), 0);
  const note = full
    ? `Every spec file (${all.length}) on ${total} shards: ${full.replaceAll("`", "")}.`
    : `${specs.length} of ${all.length} spec files on ${total} shard${total > 1 ? "s" : ""}: the areas this pull request changes, plus the smoke set.`;
  const md = [`## e2e plan: ${note}`, ""];
  md.push(`Test time: about ${minutes(seconds)} minutes in all (both projects, by e2e/ci-timings.json), so about ${minutes(seconds / total / 2)} on the clock per shard (2 workers each), plus about a minute of setup.`, "");
  if (!full) md.push("To run every spec on this pull request, add the `full-e2e` label (docs/areas/ops.md, \"CI e2e\").", "");
  if (why.length) {
    md.push("| Changed | Runs |", "| --- | --- |");
    for (const w of why.slice(0, 300)) md.push(`| \`${w.path.replace(/\|/g, "\\|")}\` | ${w.runs} |`);
    if (why.length > 300) md.push(`| … and ${why.length - 300} more | |`);
    md.push("");
  }
  if (!full) md.push(`Specs: ${specs.map((s) => `\`${s}\``).join(", ")}`, "");
  const outputs = { specs: specs.join(" "), total: String(total), shards: JSON.stringify(Array.from({ length: total }, (_, i) => i + 1)), note };
  return { outputs, md: md.join("\n") };
}

function main(argv) {
  const [mode, ...rest] = argv;
  const all = specFiles();
  let picked;
  if (mode === "full" && rest.length === 1) picked = { full: rest[0], specs: [], why: [] };
  else if (mode === "diff" && rest.length === 1) {
    const out = execFileSync("git", ["diff", "--name-only", "--no-renames", rest[0], "HEAD"], { encoding: "utf8" });
    picked = select(out.split("\n").filter(Boolean), readAreas(), all);
  } else if (mode === "files" && rest.length) picked = select(rest, readAreas(), all);
  else throw new Error('usage: node e2e/ci-select.mjs full "<why>" | diff <base> | files <path>...');
  const { outputs, md } = plan(picked, weigher(readTimings()), all);
  const lines = Object.entries(outputs).map(([k, v]) => `${k}=${v.replace(/\n/g, " ")}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
  console.log(lines.join("\n"));
  console.log(md);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
