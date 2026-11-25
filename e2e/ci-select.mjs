// CI's e2e plan (.github/workflows/e2e.yml, the `plan` job): which spec files a run tests, and on how many shards.
// A pull request runs the specs of the areas it changes (e2e/areas.json says which paths belong to which specs) plus
// the smoke set; a shared foundation, or any path the table doesn't know, runs every spec. A push to main, a manual run
// and a pull request with the `full-e2e` label run every spec too. A `traced` module (every core module
// but index.ts, e2e/helpers.ts, the app's shared modules) is followed through the code instead: what its diff changes, then the files
// that use that, each counted as changed (traceChanges, below). Docs: docs/areas/ops.md, "CI e2e".
//
// Usage:
//   node e2e/ci-select.mjs full "<why>"     every spec on 15 shards (a push to main, a manual run, the full-e2e
//                                           label)
//   node e2e/ci-select.mjs diff <base>       the specs for what changed from <base> to HEAD (a pull request: HEAD^1,
//                                           its merge commit's first parent, which is main as it is now)
//   node e2e/ci-select.mjs files <path>...   the same for these paths (to try the table out; a traced module's change
//                                           is read from where your branch left origin/main to your working tree)
//   node e2e/ci-select.mjs unmapped <base>   fails (exit 1) when a file added from <base> to HEAD under packages/, or a
//                                           new spec, has no entry in e2e/areas.json (the `check` workflow's first step)
// It writes `specs` (the spec files, space-separated; empty for every spec), `total` (how many shards), `shards` (their
// numbers, as JSON) and `note` (one line) to $GITHUB_OUTPUT, and why each changed path runs what it runs to $GITHUB_STEP_SUMMARY; to
// stdout when they aren't set.
import { execFileSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Shards for every spec (a push to main), as before; a pull request uses as few as its specs need, up to this. */
export const MAX_SHARDS = 15;
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

/** Playwright's projects, in playwright.config.ts's order. */
export const PROJECTS = ["phone", "desktop"];
/** Workers per shard: Playwright's default, half the runner's 4 cores. */
export const WORKERS = 2;

/** One file's entry as { phone, desktop } seconds (an older table's single number, both projects, split evenly). */
const perProject = (v) => (typeof v === "number" ? Object.fromEntries(PROJECTS.map((p) => [p, v / PROJECTS.length])) : v);

/**
 * Each spec file's measured test time in one project (ci-timings.json: seconds, by file and project); a file it doesn't
 * know counts as the project's median.
 */
export function projectWeigher(timings) {
  const median = {};
  for (const p of PROJECTS) {
    const known = Object.values(timings).map((v) => perProject(v)[p] ?? 0).sort((a, b) => a - b);
    median[p] = known.length ? known[Math.floor(known.length / 2)] : 30;
  }
  return (file, project) => (timings[file] === undefined ? median[project] : (perProject(timings[file])[project] ?? 0));
}

/** Each spec file's measured test time, both projects; one it doesn't know counts as the median. */
export function weigher(timings) {
  const time = projectWeigher(timings);
  return (file) => PROJECTS.reduce((sum, p) => sum + time(file, p), 0);
}

/**
 * The test times: e2e/ci-timings.json, overlaid with the times in `live` (a folder of e2e-summary records, shard-N.json
 * at any depth: main's last green run, which the plan job downloads) for every file they measured. Records from before
 * the per-project times (no `projects`) are skipped.
 */
export function readTimings(dir = DIR, live = process.env.E2E_LIVE_TIMINGS) {
  const timings = JSON.parse(readFileSync(join(dir, "ci-timings.json"), "utf8"));
  if (live) Object.assign(timings, readLiveTimings(live));
  return timings;
}

/** The per-project test times in a folder of e2e-summary records (empty when there are none). */
export function readLiveTimings(live) {
  const out = {};
  let entries = [];
  try {
    entries = readdirSync(live, { recursive: true }).map(String).filter((f) => /(^|\/)shard-\d+\.json$/.test(f));
  } catch {
    return out;
  }
  for (const f of entries.sort()) {
    try {
      Object.assign(out, JSON.parse(readFileSync(join(live, f), "utf8")).projects ?? {});
    } catch {}
  }
  return out;
}

/**
 * How long one shard's tests take on the clock, as Playwright runs them: each file in each project is one job; jobs
 * queue project by project (config order), each project's files in name order; a free worker takes the next job.
 * So two long files that sort last share no worker time: what spreading by sums alone missed (Nov 6, run 943's shard 3:
 * 45 test-minutes took 25.4 on the clock, as shop's desktop half ran alone at the end).
 */
export function makespan(files, time, workers = WORKERS) {
  const sorted = [...files].sort((a, b) => a.localeCompare(b));
  const busy = Array(workers).fill(0);
  for (const p of PROJECTS)
    for (const f of sorted) {
      const i = busy.indexOf(Math.min(...busy));
      busy[i] += time(f, p);
    }
  return Math.max(...busy);
}

/**
 * Spread `files` over `total` shards so the slowest shard ends soonest (by `makespan`): longest files first, each to the
 * shard it delays least; then, while it helps, move a file off the slowest shard, or swap one with another shard.
 * Deterministic: the same files and times give the same shards. Returns each shard's files and its makespan (seconds).
 */
export function assign(files, time, total, workers = WORKERS) {
  const sum = (f) => PROJECTS.reduce((s, p) => s + time(f, p), 0);
  const shards = Array.from({ length: total }, () => []);
  const span = Array(total).fill(0);
  const load = Array(total).fill(0);
  for (const f of [...files].sort((a, b) => sum(b) - sum(a) || a.localeCompare(b))) {
    let best = 0;
    let bestSpan = Infinity;
    for (let i = 0; i < total; i++) {
      const s = makespan([...shards[i], f], time, workers);
      if (s < bestSpan || (s === bestSpan && load[i] < load[best])) [best, bestSpan] = [i, s];
    }
    shards[best].push(f);
    span[best] = bestSpan;
    load[best] += sum(f);
  }
  for (let round = 0; round < 500; round++) {
    const w = span.indexOf(Math.max(...span));
    let move = null;
    let gain = 0;
    for (let j = 0; j < total; j++) {
      if (j === w) continue;
      for (const f of shards[w]) {
        const rest = shards[w].filter((x) => x !== f);
        // Move f to j, or swap it with one of j's files (g).
        for (const g of [null, ...shards[j]]) {
          const a = g ? [...rest, g] : rest;
          const b = g ? [...shards[j].filter((x) => x !== g), f] : [...shards[j], f];
          const sa = makespan(a, time, workers);
          const sb = makespan(b, time, workers);
          const d = span[w] - Math.max(sa, sb);
          if (d > gain + 1e-9) [move, gain] = [{ j, a, b, sa, sb }, d];
        }
      }
    }
    if (!move) break;
    [shards[w], shards[move.j], span[w], span[move.j]] = [move.a, move.b, move.sa, move.sb];
  }
  return shards.map((f, i) => ({ files: [...f].sort(), seconds: span[i] }));
}

/** A spec file as a Playwright file filter: a regular expression, dots escaped and the end anchored. */
export const fileFilter = (f) => `${f.replaceAll(".", "\\.")}$`;

export function readAreas(dir = DIR) {
  return JSON.parse(readFileSync(join(dir, "areas.json"), "utf8"));
}

const SPEC = /^e2e\/[^/]+\.spec\.ts$/;

/**
 * Traced without a list (Nov 10, audit F3): every module of packages/core's source but its entry, index.ts (that one
 * stays a shared foundation: what it re-exports reaches every package). A new core module is then traced too, instead
 * of running everything until someone adds it to `traced.modules` by hand.
 */
export const TRACED_BY_DEFAULT = /^packages\/core\/src\/(?!index\.ts$)(?:[^/]+\/)*[^/]+\.ts$/;

/** Whether `path` is traced: on the table's `traced.modules` list, or one of TRACED_BY_DEFAULT. */
export function isTraced(path, areas) {
  return TRACED_BY_DEFAULT.test(path) || (areas.traced?.modules ?? []).includes(path);
}

/**
 * What a pull request that changes `changed` (paths from the repo's root) runs, by the table `areas` (e2e/areas.json),
 * given the spec files there are (`existing`). `full` is why every spec runs (null when it doesn't); `specs` are the
 * spec files to run otherwise (smoke set included, sorted); `why` says, for each changed path, what it adds.
 *
 * A `traced` module (areas.json, or any core module: TRACED_BY_DEFAULT), when `repo` can read the change
 * (`repoAt`, `gitRepo`): what its diff changes (`traceModule`) is followed to the files that use it (`usersOf`), and each
 * of those counts as changed (its area's specs, a spec itself, a foundation everything); a change it can't place
 * leaves the module a shared foundation, as before. Without `repo`, every `traced` module is a path like any other.
 */
export function select(changed, areas, existing, repo = null) {
  const matcher = (globs) => {
    const res = globs.map(globToRegExp);
    return (path) => res.some((re) => re.test(path));
  };
  const isFull = matcher(areas.full);
  const isNone = matcher(areas.none);
  const traced = { has: (p) => !!repo && isTraced(p, areas) };
  const hubs = new Set(areas.traced?.hubs ?? []);
  const list = Object.entries(areas.areas).map(([name, a]) => ({ name, test: matcher(a.paths), specs: a.specs }));
  const have = new Set(existing);
  const leftOut = new Set(areas.leftOut ?? []);
  const picked = new Set(areas.smoke);
  const why = [];
  let full = null;
  // What one path adds, as a changed path or as a user of a traced change: { full, runs } (runs: a few words, or null).
  const place = (path) => {
    if (isFull(path)) return { full: "a shared foundation", runs: "every spec: a shared foundation (areas.json, `full`)" };
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
    if (runs.length) return { runs: runs.join("; ") };
    if (isNone(path)) return { runs: null };
    return { full: "not in e2e/areas.json", runs: "every spec: no area in areas.json has it" };
  };
  const tracedWhy = [];
  const t = repo ? traceChanges([...new Set(changed)].filter((p) => traced.has(p)), traced, repo) : null;
  if (t) {
    for (const [path, r] of t) {
      if (r.reason) {
        tracedWhy.push({ path: path + (r.via ? ` (it uses what \`${r.via}\` changes)` : ""), runs: `every spec: ${r.reason}` });
        full ??= `\`${path}\` is a shared foundation and ${r.reason}`;
        continue;
      }
      const parts = [];
      for (const [user, names] of r.users) {
        const u = hubs.has(user) ? { full: "it hands what it gets to every screen (areas.json, `traced.hubs`)" } : traced.has(user) ? { runs: "followed on (below)" } : place(user);
        if (u.full) {
          full ??= `\`${path}\` changes ${names.join(", ")}, which \`${user}\` uses: ${u.full}`;
          parts.push(`\`${user}\` (${names.join(", ")}): every spec, ${u.full}`);
        } else parts.push(`\`${user}\` (${names.join(", ")}): ${u.runs ?? "nothing"}`);
      }
      if (parts.length > 12) parts.splice(12, parts.length, `and ${parts.length - 12} more`);
      const what = r.names.length ? `changes ${r.names.join(", ")}` : "changes nothing that runs (comments, types)";
      const via = r.via ? ` (it uses what \`${r.via}\` changes)` : "";
      tracedWhy.push({ path: path + via, runs: parts.length ? `${what}; used by ${parts.join("; ")}` : `${what}; nothing else uses that` });
    }
  }
  why.push(...tracedWhy);
  for (const path of [...new Set(changed)].sort()) {
    if (t?.has(path)) continue;
    const r = place(path);
    if (r.full === "a shared foundation") full ??= `\`${path}\` is a shared foundation`;
    else if (r.full) full ??= `\`${path}\` isn't in e2e/areas.json`;
    if (r.runs) why.push({ path, runs: r.runs });
    else why.push({ path, runs: "nothing: no browser test needs it (areas.json, `none`)" });
  }
  const specs = [...picked].filter((s) => have.has(s) && !leftOut.has(s)).sort();
  if (!full && !specs.length) full = "no spec was picked";
  return { full, specs: full ? [] : specs, why };
}

/**
 * The files among `added` (a pull request's new paths) that e2e/areas.json doesn't place, so they'd run every spec on
 * every pull request that touches them: a new file under packages/ that no area, `traced`, `none` or `full` entry
 * matches, and a new spec in no area, the smoke set or `leftOut` (it would never run on another pull request). Each as
 * { path, fix } (what to add). The `check` workflow fails on any (Nov 10, audit F3).
 */
export function unmapped(added, areas) {
  const globs = [...areas.full, ...areas.none, ...Object.values(areas.areas).flatMap((a) => a.paths)].map(globToRegExp);
  const named = new Set([...areas.smoke, ...(areas.leftOut ?? []), ...Object.values(areas.areas).flatMap((a) => a.specs)]);
  const out = [];
  for (const path of [...new Set(added)].sort()) {
    if (SPEC.test(path)) {
      if (!named.has(path)) out.push({ path, fix: "add it to its area's `specs` in e2e/areas.json (or to `smoke`)" });
    } else if (path.startsWith("packages/") && !isTraced(path, areas) && !globs.some((re) => re.test(path)))
      out.push({ path, fix: "add it (or a glob) to its area's `paths` in e2e/areas.json, to `none` if no browser test needs it, or to `full` if it's shared by every screen" });
  }
  return out;
}

/** How many shards `specs` need at SHARD_SECONDS each: at least 1, at most MAX_SHARDS, never more than the files. */
export function shardCount(specs, weight) {
  const seconds = specs.reduce((sum, f) => sum + weight(f), 0);
  return Math.max(1, Math.min(MAX_SHARDS, specs.length, Math.ceil(seconds / SHARD_SECONDS)));
}

/**
 * The plan as the workflow's outputs, and the note for the run's page (Markdown). `timings` are the test times
 * (readTimings); `source` says where they came from. `assignment` is each shard's spec files as Playwright filters
 * (a JSON list, shard 1 first), so every shard runs exactly what the plan spread.
 */
export function plan({ full, specs, why }, timings, all, source = "e2e/ci-timings.json") {
  const weight = weigher(timings);
  const total = full ? MAX_SHARDS : shardCount(specs, weight);
  const minutes = (s) => Math.round(s / 60);
  const files = full ? all : specs;
  const seconds = files.reduce((sum, f) => sum + weight(f), 0);
  const shards = assign(files, projectWeigher(timings), total);
  const note = full
    ? `Every spec file (${all.length}) on ${total} shards: ${full.replaceAll("`", "")}.`
    : `${specs.length} of ${all.length} spec files on ${total} shard${total > 1 ? "s" : ""}: the areas this pull request changes, plus the smoke set.`;
  const md = [`## e2e plan: ${note}`, ""];
  md.push(
    `Test time: about ${minutes(seconds)} minutes in all (both projects, by ${source}). On the clock, with ${WORKERS} workers a shard: ` +
      `${shards.map((s) => minutes(s.seconds)).join(", ")} minutes (shard 1 first), plus about a minute of setup.`,
    "",
  );
  if (!full) md.push("To run every spec on this pull request, add the `full-e2e` label (docs/areas/ops.md, \"CI e2e\").", "");
  if (why.length) {
    md.push("| Changed | Runs |", "| --- | --- |");
    for (const w of why.slice(0, 300)) md.push(`| \`${w.path.replace(/\|/g, "\\|")}\` | ${w.runs} |`);
    if (why.length > 300) md.push(`| … and ${why.length - 300} more | |`);
    md.push("");
  }
  if (!full) md.push(`Specs: ${specs.map((s) => `\`${s}\``).join(", ")}`, "");
  const outputs = {
    specs: specs.join(" "),
    total: String(total),
    shards: JSON.stringify(shards.map((_, i) => i + 1)),
    assignment: JSON.stringify(shards.map((s) => s.files.map(fileFilter).join(" "))),
    note,
  };
  return { outputs, md: md.join("\n") };
}

// --- Following a change through the code (areas.json, `traced`) ---
// A traced module's change is placed declaration by declaration: what the diff changes (a top-level function, constant,
// class or import; comments and types don't run), what else in the module uses that, and then which files import the
// module (directly or through its package's entry) and name what changed. Each of those files counts as changed. When
// a module doesn't read cleanly, or code outside any declaration changes or uses what changed (it runs on load), the
// module is a shared foundation as before: every spec. Plain text work, no parser: about a second on the whole repo.

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const DECL_START = /^(?:export|import|function|const|let|var|class|interface|type|enum|declare|async|abstract)\b/;
const WORD_BEFORE_REGEX = /^(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await|instanceof)$/;

/**
 * A module's top-level statements as text: comments dropped (in .tsx/.jsx, where JSX text can hold `//`, only those that
 * start a line outside any bracket) and runs of whitespace outside strings and templates squeezed to one space. A
 * statement starts on a line that begins (column 0, outside any bracket, string, template or comment) with a letter, `_`,
 * `$` or `@`. Null when the file doesn't read cleanly: an unclosed string, template, comment or bracket, or a
 * declaration keyword at column 0 inside brackets.
 */
function scanTop(src, jsx) {
  const out = [];
  let cur = "";
  let depth = 0;
  const tpl = []; // the depth at each open `${`
  let prev = ""; // the last token that decides whether a `/` starts a regular expression
  let multi = false; // a `,` at depth 0 after a `=` at depth 0 (several declarators)
  let eq = false;
  const n = src.length;
  const push = () => {
    if (cur.trim()) out.push({ text: cur.trim(), multi });
    cur = "";
    multi = false;
    eq = false;
  };
  const space = () => {
    if (cur && !cur.endsWith(" ")) cur += " ";
  };
  // A template's text from i (after the backtick, or after a `${…}`'s `}`): to its end (returns the index after the
  // backtick) or to a `${` (pushes it, returns the index after it); -1 if it never ends.
  const template = (i) => {
    while (i < n) {
      const c = src[i];
      if (c === "\\") {
        cur += src.slice(i, i + 2);
        i += 2;
      } else if (c === "`") {
        cur += c;
        return i + 1;
      } else if (c === "$" && src[i + 1] === "{") {
        cur += "${";
        tpl.push(depth);
        depth++;
        return i + 2;
      } else {
        cur += c;
        i++;
      }
    }
    return -1;
  };
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (i === 0 || src[i - 1] === "\n") {
      if (/[A-Za-z_$@]/.test(c)) {
        if (depth === 0) push();
        else if (DECL_START.test(src.slice(i, i + 12))) return null;
      }
    }
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      space();
      i++;
      continue;
    }
    // (In JSX a `//` can be text, so a comment is kept there unless it starts a line outside any bracket.)
    const keep = jsx && !(depth === 0 && (i === 0 || src[i - 1] === "\n"));
    if (c === "/" && src[i + 1] === "/") {
      const end = src.indexOf("\n", i);
      const stop = end < 0 ? n : end;
      if (keep) cur += src.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) return null;
      if (keep) cur += src.slice(i, end + 2);
      else space();
      i = end + 2;
      continue;
    }
    if (c === "'" || c === '"' || (c === "/" && (prev === "" || /^[(,=:[!&|?{;+\-*%<>~^]$/.test(prev) || WORD_BEFORE_REGEX.test(prev)))) {
      // A string, or a regular expression (a `/` where a value starts).
      let j = i + 1;
      let inClass = false;
      for (; j < n; j++) {
        const d = src[j];
        if (d === "\\") j++;
        else if (d === "\n") break;
        else if (c === "/" && d === "[") inClass = true;
        else if (c === "/" && d === "]") inClass = false;
        else if (d === c && !inClass) break;
      }
      if (j >= n || src[j] !== c) {
        // Unclosed on its line: in JSX that's text (an apostrophe, a closing tag's `/`); anywhere else the file doesn't
        // read cleanly.
        if (!jsx) return null;
        cur += c;
        prev = c;
        i++;
        continue;
      }
      if (c === "/") while (/[a-z]/.test(src[j + 1] ?? "")) j++;
      cur += src.slice(i, j + 1);
      prev = "x";
      i = j + 1;
      continue;
    }
    if (c === "`") {
      cur += c;
      i = template(i + 1);
      if (i < 0) return null;
      prev = "x";
      continue;
    }
    if (c === "{" || c === "(" || c === "[") {
      depth++;
      cur += c;
      prev = c;
      i++;
      continue;
    }
    if (c === "}" || c === ")" || c === "]") {
      depth--;
      if (depth < 0) return null;
      if (c === "}" && tpl.length && tpl[tpl.length - 1] === depth) {
        tpl.pop();
        cur += c;
        i = template(i + 1);
        if (i < 0) return null;
        prev = "x";
        continue;
      }
      cur += c;
      prev = c;
      i++;
      continue;
    }
    const word = /^[\w$]+/.exec(src.slice(i, i + 200));
    if (word) {
      cur += word[0];
      prev = word[0];
      i += word[0].length;
      continue;
    }
    if (depth === 0 && c === "=" && src[i + 1] !== "=" && src[i + 1] !== ">" && !/[=!<>]/.test(src[i - 1] ?? "")) eq = true;
    // (A non-null assertion, `x!` or `f()!`, ends a value: a `/` after it divides.)
    const value = c === "!" && src[i + 1] !== "=" && (prev === ")" || prev === "]" || prev === "x" || (/^[\w$]+$/.test(prev) && !WORD_BEFORE_REGEX.test(prev)));
    // (Another declarator: `, b = 2`, not a type's `Map<string, number>`.)
    if (depth === 0 && c === "," && eq && /^\s*[\w$]+\s*(?:=(?![=>])|[,;:]|$)/.test(src.slice(i + 1, i + 200))) multi = true;
    cur += c;
    prev = value ? "x" : c;
    i++;
  }
  if (depth !== 0 || tpl.length) return null;
  push();
  return out;
}

/** One import statement's bindings: [{ local, name, from }] (`name` "*" for a namespace, "default"); type-only ones left out. */
function importBindings(text) {
  const m = /^import\s+([\s\S]*?)\s*from\s*(['"])(.*?)\2/.exec(text);
  if (!m) return null;
  const [, clause, , from] = m;
  if (/^type\b/.test(clause) && !/^type\s*,/.test(clause)) return [];
  const binds = [];
  const ns = /\*\s*as\s+([\w$]+)/.exec(clause);
  if (ns) binds.push({ local: ns[1], name: "*", from });
  const braces = /\{([^}]*)\}/.exec(clause);
  if (braces)
    for (const part of braces[1].split(",")) {
      const p = part.trim();
      if (!p || /^type\s/.test(p)) continue;
      const [name, local = name] = p.split(/\s+as\s+/).map((x) => x.trim());
      binds.push({ local, name, from });
    }
  const def = /^([\w$]+)\s*(?:,|$)/.exec(clause);
  if (def) binds.push({ local: def[1], name: "default", from });
  return binds;
}

/**
 * A module read for tracing: its statements, each { kind, names, exported, text }. kind: "decl" (a function, class,
 * enum, constant or variable: `names`), "import" (`binds`), "reexport" (`export … from`), "type" (no runtime effect:
 * types, interfaces, `declare`), "other" (anything else: it runs when the module loads). Null when it doesn't read cleanly.
 */
export function readModule(src, path = "x.ts") {
  const parts = scanTop(src, /\.[jt]sx$/.test(path));
  if (!parts) return null;
  const stmts = [];
  for (const { text, multi } of parts) {
    let m;
    if (/^import\s+type\b/.test(text) && !/^import\s+type\s*,/.test(text)) stmts.push({ kind: "type", text });
    else if (/^import\b/.test(text)) {
      const binds = importBindings(text);
      stmts.push(binds ? { kind: "import", binds, text } : { kind: "other", text });
    } else if (/^export\s+type\s*[{*]/.test(text) || /^(?:export\s+)?(?:declare\b|(?:type|interface)\s+[\w$]+)/.test(text)) stmts.push({ kind: "type", text });
    else if ((m = /^export\s*(\*(?:\s*as\s+[\w$]+)?|\{([^}]*)\})\s*(?:from\s*(['"])(.*?)\3)?/.exec(text))) {
      const names = m[2] !== undefined ? m[2].split(",").map((p) => p.trim()).filter((p) => p && !/^type\s/.test(p)).map((p) => p.split(/\s+as\s+/).map((x) => x.trim())) : null;
      if (m[4] !== undefined) stmts.push({ kind: "reexport", from: m[4], names, text });
      else if (names) stmts.push({ kind: "exportList", names, text });
      else stmts.push({ kind: "other", text });
    } else if ((m = /^(export\s+)?(default\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)/.exec(text)) || (m = /^(export\s+)?(default\s+)?(?:abstract\s+)?class\s+([\w$]+)/.exec(text)) || (m = /^(export\s+)?()(?:const\s+)?enum\s+([\w$]+)/.exec(text))) {
      stmts.push({ kind: "decl", names: m[2] ? [m[3], "default"] : [m[3]], exported: !!m[1], fn: true, text });
    } else if ((m = /^(export\s+)?(?:const|let|var)\s+([\w$]+)/.exec(text)) && !multi) {
      // (A function kept in a constant runs later too; any other constant or variable is state it might write, except a constant
      // holding a plain value (a string, number, true, false or null), which nothing can write: a key's name, a limit.)
      const fn = /^[^=]*=\s*(?:async\s+)?(?:function\b|(?:\([^)]*\)|[\w$]+)\s*(?::[^=]*)?=>)/.test(text);
      const fixed = !fn && /^(?:export\s+)?const\s+[\w$]+\s*(?::[^=]*)?=\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`$]*`|-?[\d.][\w.]*|true|false|null)\s*(?:as\s+const\s*)?;?$/.test(text);
      stmts.push({ kind: "decl", names: [m[2]], exported: !!m[1], fn, ...(fixed ? { fixed } : {}), text });
    }
    else if (/^export\s+default\b/.test(text)) stmts.push({ kind: "decl", names: ["default"], exported: true, text });
    else stmts.push({ kind: "other", text });
  }
  return stmts;
}

/** Whether code names `name` as a variable: not inside a longer word, and not as another object's property (`env.NAME`). */
const mentions = (text, name) => new RegExp(`(?<![\\w$])(?<![^.]\\.)(?<!^\\.)${name.replace(/\$/g, "\\$")}(?![\\w$])`).test(text);

/**
 * From `seeds` (names in the module whose meaning changed): everything in the module that uses them, to a fixed point.
 * Returns { changed (Set), exported (the changed names other modules can import), reason (why it can't be placed) }.
 */
function spread(stmts, seeds) {
  const changed = new Set(seeds);
  const exported = new Set();
  for (const s of stmts) {
    if (s.kind === "decl" && s.exported) for (const n of s.names) exported.add(n);
    if (s.kind === "exportList") for (const [name, as = name] of s.names) exported.add(name), as !== name && exported.add(`${name}=>${as}`);
  }
  // (A changed function may also write the module's state: its constants and variables that it names change too. Not a constant
  // holding a plain value: it can't be written.)
  const state = stmts.filter((s) => s.kind === "decl" && !s.fn && !s.fixed);
  const wrote = new Set();
  for (let grew = true; grew; ) {
    grew = false;
    for (const s of stmts) {
      if (s.kind !== "decl" && s.kind !== "other") continue;
      if (s.kind === "decl" && s.names.every((n) => changed.has(n))) {
        if (!s.fn || wrote.has(s)) continue;
        wrote.add(s);
        for (const t of state) if (!changed.has(t.names[0]) && mentions(s.text, t.names[0])) changed.add(t.names[0]), (grew = true);
        continue;
      }
      const hit = [...changed].find((n) => mentions(s.text, n));
      if (!hit) continue;
      if (s.kind === "other") return { changed, exported: [], reason: `code that runs when it loads uses ${hit}` };
      for (const n of s.names) changed.add(n);
      grew = true;
    }
  }
  const out = new Set();
  for (const n of changed) if (exported.has(n)) out.add(n);
  // (`export { a as b }`: b is what importers name.)
  for (const e of exported) {
    const [name, as] = e.split("=>");
    if (as && changed.has(name)) out.add(as);
  }
  return { changed, exported: [...out].sort(), reason: null };
}

/**
 * What a traced module's change touches: { names (the exported names whose code changed, sorted), reason } (reason: why
 * the change can't be placed, so everything runs). `before`/`after` are the module's text, null when it didn't or
 * doesn't exist (a new module counts as an empty one before; a removed one runs everything).
 */
export function traceModule(before, after, path = "x.ts") {
  if (after == null) return { names: [], reason: "it's removed" };
  // (A new module: everything it exports is new, so its users are what imports it; code outside a declaration, or a
  // side-effect import, still runs everything, as below.)
  before ??= "";
  const a = readModule(before, path);
  const b = readModule(after, path);
  if (!a || !b) return { names: [], reason: "it doesn't read cleanly as code (no parser here)" };
  const byName = (stmts) => {
    const m = new Map();
    for (const s of stmts) {
      if (s.kind === "decl") for (const n of s.names) m.set(n, (m.get(n) ?? "") + "\n" + s.text);
      if (s.kind === "import") for (const x of s.binds) m.set(x.local, (m.get(x.local) ?? "") + `\nimport ${x.name} from ${x.from}`);
      if (s.kind === "reexport" && s.names) for (const [name, as = name] of s.names) m.set(as, (m.get(as) ?? "") + `\nfrom ${s.from} ${name}`);
      if (s.kind === "exportList") for (const [name, as = name] of s.names) m.set(`export ${as}`, name);
    }
    return m;
  };
  // (Code outside any declaration, a side-effect import, an `export *`: compared as a whole.)
  const loose = (stmts) => stmts.filter((s) => s.kind === "other" || (s.kind === "reexport" && !s.names)).map((s) => s.text).sort().join("\n");
  if (loose(a) !== loose(b)) return { names: [], reason: "code outside any declaration changed (it runs when the module loads)" };
  const ma = byName(a);
  const mb = byName(b);
  const seeds = new Set();
  for (const k of new Set([...ma.keys(), ...mb.keys()])) if (ma.get(k) !== mb.get(k)) seeds.add(k.replace(/^export /, ""));
  const r = spread(b, seeds);
  // (A removed export: nothing can still import it, or the typecheck fails. An added one: nothing imported it before.)
  return { names: r.exported, reason: r.reason };
}

/** The import specifiers in a file's text (static, `export … from`, dynamic with a plain string). */
export function importsOf(src) {
  const out = new Set();
  for (const re of [/(?:^|[\s;])(?:import|export)\s[^'"`;]*?\sfrom\s*(['"])([^'"]+)\1/g, /(?:^|[\s;])import\s*(['"])([^'"]+)\1/g, /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g])
    for (const m of src.matchAll(re)) out.add(m[2]);
  return [...out];
}

const normalize = (p) => {
  const out = [];
  for (const part of p.split("/")) {
    if (part === "..") out.pop();
    else if (part !== "." && part !== "") out.push(part);
  }
  return out.join("/");
};

/** The files an import specifier in `from` can mean (relative ones, and the workspace's `@chessroyale/<pkg>` entries). */
export function resolveImport(from, spec, exportsOf) {
  let base;
  if (spec.startsWith(".")) base = normalize(`${from.slice(0, from.lastIndexOf("/") + 1)}${spec}`);
  else {
    const m = /^@chessroyale\/([\w-]+)(\/.*)?$/.exec(spec);
    if (!m) return [];
    const target = exportsOf(m[1])?.[`.${m[2] ?? ""}`];
    return typeof target === "string" ? [normalize(`packages/${m[1]}/${target}`)] : [];
  }
  const tries = [base, base + ".ts", base + ".tsx", base + ".mts", base + ".mjs", base + ".js", base + "/index.ts", base + "/index.tsx"];
  if (/\.jsx?$/.test(base)) tries.push(base.replace(/\.js(x?)$/, ".ts$1"));
  return tries;
}

/**
 * Which of `names` a file's code uses from the module (`fromIt(specifier)`: whether an import reaches it): the local
 * name each is imported as, named in code that runs (not in comments, types or the import line). A namespace import
 * or a default import can reach any of them; a file that doesn't read cleanly uses every name it mentions anywhere.
 */
function namesUsed(file, text, names, fromIt) {
  const stmts = readModule(text, file);
  if (!stmts) return names.filter((n) => n === "default" || mentions(text, n));
  // (A dynamic import, `await import("./x.ts")`, can reach any of them.)
  for (const m of text.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)) if (fromIt(m[2])) return names;
  const code = stmts.filter((s) => s.kind !== "import" && s.kind !== "type").map((s) => s.text).join("\n");
  const used = new Set();
  for (const s of stmts) {
    if (s.kind === "import")
      for (const b of s.binds) {
        if (!fromIt(b.from) || !mentions(code, b.local)) continue;
        if (b.name === "*") names.forEach((n) => used.add(n));
        else if (names.includes(b.name)) used.add(b.name);
      }
    // (Passed on: `export { X } from "…"`, `export * from "…"`.)
    if (s.kind === "reexport" && fromIt(s.from)) for (const n of names) if (!s.names || s.names.some(([x]) => x === n)) used.add(n);
  }
  return names.filter((n) => used.has(n));
}

/**
 * The files that use `names` from `path`: they import it, or a package entry that re-exports it, and name one of them
 * (the whole import line counts, so `import { X as Y }` is found by X). Returns Map<file, names used>, sorted.
 * `repo.grep(words)` lists the code files that contain any of the words; `repo.after(file)` reads one.
 */
export function usersOf(path, names, repo) {
  const exportsOf = (pkg) => {
    try {
      return JSON.parse(repo.after(`packages/${pkg}/package.json`) ?? "null")?.exports ?? null;
    } catch {
      return null;
    }
  };
  // The package entries that re-export it (one level, then theirs).
  const targets = new Set([path]);
  const pkg = /^packages\/([\w-]+)\//.exec(path)?.[1];
  const entries = pkg ? Object.values(exportsOf(pkg) ?? {}).filter((t) => typeof t === "string" && CODE_FILE.test(t)).map((t) => normalize(`packages/${pkg}/${t}`)) : [];
  for (let grew = true; grew; ) {
    grew = false;
    for (const e of entries) {
      if (targets.has(e)) continue;
      const text = repo.after(e);
      const mod = text && readModule(text, e);
      if (mod?.some((s) => s.kind === "reexport" && resolveImport(e, s.from, exportsOf).some((t) => targets.has(t)) && (!s.names || s.names.some(([n, as = n]) => names.includes(as))))) {
        targets.add(e);
        grew = true;
      }
    }
  }
  const users = new Map();
  const words = names.filter((n) => n !== "default");
  if (names.includes("default")) words.push(path.slice(path.lastIndexOf("/") + 1).replace(/\.\w+$/, ""));
  for (const file of repo.grep(words)) {
    if (targets.has(file) || !CODE_FILE.test(file)) continue;
    const text = repo.after(file);
    if (text == null) continue;
    if (!importsOf(text).some((spec) => resolveImport(file, spec, exportsOf).some((t) => targets.has(t)))) continue;
    const used = namesUsed(file, text, names, (spec) => resolveImport(file, spec, exportsOf).some((t) => targets.has(t)));
    if (used.length) users.set(file, used);
  }
  return new Map([...users].sort(([x], [y]) => (x < y ? -1 : 1)));
}

/**
 * The traced modules among `paths`, followed: Map<module, { names, users: Map<file, names>, reason, via }>. A user that
 * is itself traced is followed too (from the declarations of its own that use what changed: `via` names the module it
 * was reached from) instead of counting as changed whole.
 */
export function traceChanges(paths, traced, repo) {
  const out = new Map();
  const queue = paths.map((p) => ({ path: p, seeds: null, via: null }));
  while (queue.length) {
    const { path, seeds, via } = queue.shift();
    let r;
    if (seeds) {
      const text = repo.after(path);
      const mod = text != null && readModule(text, path);
      if (!mod) r = { names: [], reason: "it doesn't read cleanly as code (no parser here)" };
      else {
        // Its own names bound to what changed (an import of it, or of its package's entry, by name or as a namespace).
        const locals = new Set();
        for (const s of mod) if (s.kind === "import") for (const b of s.binds) if (seeds.has(`${b.from}|${b.name}`) || (b.name === "*" && [...seeds].some((k) => k.startsWith(`${b.from}|`)))) locals.add(b.local);
        const sp = spread(mod, [...locals]);
        r = { names: sp.exported, reason: sp.reason };
      }
    } else r = traceModule(repo.before(path), repo.after(path), path);
    const prior = out.get(path);
    if (prior && !r.reason && r.names.every((n) => prior.names.includes(n))) continue;
    const names = [...new Set([...(prior?.names ?? []), ...r.names])].sort();
    const users = r.reason || !names.length ? new Map() : usersOf(path, names, repo);
    out.set(path, { names, users, reason: prior?.reason ?? r.reason, via: prior ? prior.via : via });
    for (const [user, used] of users) {
      if (!traced.has(user)) continue;
      // (What the user imports, as its import lines say it: every specifier of the user's that reaches this module.)
      const text = repo.after(user) ?? "";
      const keys = new Set();
      for (const spec of importsOf(text)) for (const n of used) keys.add(`${spec}|${n}`);
      queue.push({ path: user, seeds: keys, via: path });
    }
  }
  return out;
}

/**
 * Read access to a change for tracing: `before` from git at `base`, `after` (and `grep`) from git at `head`, or from the
 * working tree when `head` is null (CI's checkout, or your own edits).
 */
export function gitRepo(base, head = null, cwd = join(DIR, "..")) {
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] });
  const show = (rev, p) => {
    try {
      return git(["show", `${rev}:${p}`]);
    } catch {
      return null;
    }
  };
  const cache = new Map();
  return {
    before: (p) => show(base, p),
    after: (p) => {
      if (!cache.has(p)) {
        let text = null;
        if (head) text = show(head, p);
        else
          try {
            text = readFileSync(join(cwd, p), "utf8");
          } catch {}
        cache.set(p, text);
      }
      return cache.get(p);
    },
    grep: (words) => {
      if (!words.length) return [];
      const args = ["grep", "-l", "-w", "-F", ...words.flatMap((w) => ["-e", w])];
      if (head) args.push(head);
      args.push("--", "*.ts", "*.tsx", "*.mts", "*.mjs", "*.js", "*.jsx");
      try {
        return git(args).split("\n").filter(Boolean).map((l) => (head ? l.slice(head.length + 1) : l));
      } catch {
        return []; // (git grep exits 1 when nothing matches)
      }
    },
  };
}

/** The paths changed from `base` to HEAD. */
function diffFrom(base) {
  return execFileSync("git", ["diff", "--name-only", "--no-renames", base, "HEAD"], { encoding: "utf8" }).split("\n").filter(Boolean);
}

/** For `files`: where your branch left main (origin/main), or HEAD when that isn't known. */
function localBase() {
  try {
    return execFileSync("git", ["merge-base", "HEAD", "origin/main"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "HEAD";
  }
}

function main(argv) {
  const [mode, ...rest] = argv;
  if (mode === "unmapped" && rest.length === 1) {
    // (The paths added from <base> to HEAD; a renamed file counts as added.)
    const added = execFileSync("git", ["-c", "core.quotepath=off", "diff", "--name-only", "--no-renames", "--diff-filter=A", rest[0], "HEAD"], { encoding: "utf8" }).split("\n").filter(Boolean);
    const bad = unmapped(added, readAreas());
    for (const b of bad) console.log(`::error file=${b.path}::${b.path} isn't in e2e/areas.json, so every pull request that changes it would run every e2e spec: ${b.fix}.`);
    if (bad.length) process.exit(1);
    console.log(`Every added file is in e2e/areas.json (${added.length} added).`);
    return;
  }
  const all = specFiles();
  let picked;
  if (mode === "full" && rest.length === 1) picked = { full: rest[0], specs: [], why: [] };
  // (A traced module's change is read from git at the base and from the working tree: the checkout.)
  else if (mode === "diff" && rest.length === 1) picked = select(diffFrom(rest[0]), readAreas(), all, gitRepo(rest[0]));
  else if (mode === "files" && rest.length) picked = select(rest, readAreas(), all, gitRepo(localBase()));
  else throw new Error('usage: node e2e/ci-select.mjs full "<why>" | diff <base> | files <path>... | unmapped <base>');
  // (E2E_LIVE_TIMINGS: main's last green run's records, downloaded by the plan job; E2E_LIVE_RUN: that run's number.)
  const live = process.env.E2E_LIVE_TIMINGS ? Object.keys(readLiveTimings(process.env.E2E_LIVE_TIMINGS)).length : 0;
  const source = live ? `main's last green run (#${process.env.E2E_LIVE_RUN ?? "?"}, ${live} file${live === 1 ? "" : "s"}), the rest e2e/ci-timings.json` : "e2e/ci-timings.json";
  const { outputs, md } = plan(picked, readTimings(), all, source);
  const lines = Object.entries(outputs).map(([k, v]) => `${k}=${v.replace(/\n/g, " ")}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
  console.log(lines.join("\n"));
  console.log(md);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
