// CI's e2e plan (.github/workflows/e2e.yml, the `plan` job): which spec files a run tests, and on how many shards.
// A pull request runs the specs of the areas it changes (e2e/areas.json says which paths belong to which specs) plus
// the smoke set; a shared foundation, or any path the table doesn't know, runs every spec. A push to main, a manual run
// and a pull request with the `full-e2e` label run every spec too. A change to an area named in `webgl` (the town's), or to
// one of its specs, also runs those specs again on a VITE_TOWN_GL=1 build, WebGL the town's default: two more jobs beside
// the shards, one per project (`webgl-phone` and `webgl-desktop` in the shard matrix). Docs: docs/areas/ops.md, "CI e2e".
//
// Usage:
//   node e2e/ci-select.mjs full "<why>" [base]   every spec on 5 shards (a push to main, a manual run, the full-e2e
//                                           label); the WebGL job if what changed from <base> to HEAD touches its
//                                           areas, and always without a base (a manual run tests everything)
//   node e2e/ci-select.mjs diff <base>       the specs for what changed from <base> to HEAD (a pull request: HEAD^1,
//                                           its merge commit's first parent, which is main as it is now)
//   node e2e/ci-select.mjs files <path>...   the same for these paths (to try the table out)
// It writes `specs` (the spec files, space-separated; empty for every spec), `total` (how many shards), `shards` (their
// numbers, then "webgl-phone" and "webgl-desktop" when the WebGL jobs run, as JSON), `webgl` (their spec files; empty:
// none) and `note` (one line) to $GITHUB_OUTPUT, and why each changed path runs what it runs to $GITHUB_STEP_SUMMARY; to
// stdout when they aren't set.
import { execFileSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Shards for every spec (a push to main), as before; a pull request uses as few as its specs need, up to this. */
export const MAX_SHARDS = 5;
/**
 * The test time a pull request's shard aims at: seconds, summed over both projects (ci-timings.json's unit), so about
 * half of it on the clock with 2 workers. With setup, a shard then takes about 5 minutes.
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
 * spec files to run otherwise (smoke set included, sorted); `webgl` the specs to run again on the town's WebGL build
 * (`webgl.specs`, when a path of a `webgl` area or one of those specs changed, whatever `full` says; sorted); `why` says,
 * for each changed path, what it adds.
 */
export function select(changed, areas, existing) {
  const matcher = (globs) => {
    const res = globs.map(globToRegExp);
    return (path) => res.some((re) => re.test(path));
  };
  const isFull = matcher(areas.full);
  const isNone = matcher(areas.none);
  const list = Object.entries(areas.areas).map(([name, a]) => ({ name, test: matcher(a.paths), specs: a.specs }));
  const glAreas = list.filter((a) => (areas.webgl?.areas ?? []).includes(a.name));
  const glSpecs = areas.webgl?.specs ?? [];
  let gl = false;
  const have = new Set(existing);
  const leftOut = new Set(areas.leftOut ?? []);
  const picked = new Set(areas.smoke);
  const why = [];
  let full = null;
  for (const path of [...new Set(changed)].sort()) {
    // (The WebGL jobs: a path of the area's, or one of their specs.)
    if (glAreas.some((a) => a.test(path)) || glSpecs.includes(path)) gl = true;
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
  const webgl = gl ? allWebgl(areas, existing) : [];
  return { full, specs: full ? [] : specs, webgl, why };
}

/** The WebGL jobs' specs (`webgl.specs` that exist), sorted: what they run whenever they run. */
export function allWebgl(areas, existing) {
  const have = new Set(existing);
  return [...new Set(areas.webgl?.specs ?? [])].filter((s) => have.has(s)).sort();
}

/** How many shards `specs` need at SHARD_SECONDS each: at least 1, at most MAX_SHARDS, never more than the files. */
export function shardCount(specs, weight) {
  const seconds = specs.reduce((sum, f) => sum + weight(f), 0);
  return Math.max(1, Math.min(MAX_SHARDS, specs.length, Math.ceil(seconds / SHARD_SECONDS)));
}

/** The WebGL jobs: one per Playwright project (playwright.config.ts), each the `webgl` specs on one worker. */
export const WEBGL_JOBS = ["webgl-phone", "webgl-desktop"];

/** The plan as the workflow's outputs, and the note for the run's page (Markdown). */
export function plan({ full, specs, webgl = [], why }, weight, all) {
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
  if (webgl.length) md.push(`The town on WebGL too: ${webgl.map((s) => `\`${s}\``).join(", ")} again on a \`VITE_TOWN_GL=1\` build, two more jobs beside the shards, the phone's and the computer's (the town's area changed).`, "");
  const shards = [...Array.from({ length: total }, (_, i) => i + 1), ...(webgl.length ? WEBGL_JOBS : [])];
  const outputs = { specs: specs.join(" "), total: String(total), shards: JSON.stringify(shards), webgl: webgl.join(" "), note };
  return { outputs, md: md.join("\n") };
}

/** The paths changed from `base` to HEAD. */
function diffFrom(base) {
  return execFileSync("git", ["diff", "--name-only", "--no-renames", base, "HEAD"], { encoding: "utf8" }).split("\n").filter(Boolean);
}

function main(argv) {
  const [mode, ...rest] = argv;
  const all = specFiles();
  let picked;
  if (mode === "full" && (rest.length === 1 || rest.length === 2)) {
    // (The WebGL job by what changed from the base; without one, a manual run: everything.)
    const webgl = rest[1] ? select(diffFrom(rest[1]), readAreas(), all).webgl : allWebgl(readAreas(), all);
    picked = { full: rest[0], specs: [], webgl, why: [] };
  }
  else if (mode === "diff" && rest.length === 1) picked = select(diffFrom(rest[0]), readAreas(), all);
  else if (mode === "files" && rest.length) picked = select(rest, readAreas(), all);
  else throw new Error('usage: node e2e/ci-select.mjs full "<why>" [base] | diff <base> | files <path>...');
  const { outputs, md } = plan(picked, weigher(readTimings()), all);
  const lines = Object.entries(outputs).map(([k, v]) => `${k}=${v.replace(/\n/g, " ")}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
  console.log(lines.join("\n"));
  console.log(md);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
