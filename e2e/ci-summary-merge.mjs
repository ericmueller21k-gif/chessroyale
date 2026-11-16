// CI's e2e summary (.github/workflows/e2e.yml, the `result` job): every shard's record (e2e/ci-summary.ts writes
// shard-N.json) as one Markdown page for the run: flaky tests first (failed, then passed on the retry: kept in view
// until they're fixed), then failed tests, both with their shard; then each shard's counts and time; then the test
// time by file and project as a ready-made e2e/ci-timings.json. A shard with no record
// stopped before its tests ended. NOTE, if given, goes under the heading (the plan's one line: what this run tests and
// why).
// Usage: node e2e/ci-summary-merge.mjs SHARDS DIR [NOTE] >> "$GITHUB_STEP_SUMMARY"
// SHARDS: how many (1 to N), or the plan's list as JSON ([1, 2, 3]).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [arg, dir, note] = [process.argv[2], process.argv[3], process.argv[4]];
const names = arg.trim().startsWith("[") ? JSON.parse(arg) : Array.from({ length: Number(arg) }, (_, i) => i + 1);
const shards = names.map((n) => {
  const path = join(dir, `shard-${n}.json`);
  return { n, record: existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null };
});
const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const time = (s) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
const all = (key) => shards.flatMap(({ n, record }) => (record?.[key] ?? []).map((t) => ({ n, ...t })));
const flaky = all("flaky");
const failed = all("failed");
const missing = shards.filter((s) => !s.record);
const red = failed.length > 0 || missing.length > 0 || shards.some((s) => s.record && s.record.status !== "passed");

const out = [];
// The title tells a retry-pass red from a real failure at a glance (audit Q3, Nov 12): "red: N failed" is a test that failed twice
// or a shard that stopped (look for the cause, or revert); "red: flaky only (N)" is main's run red only because tests passed on their
// retry (Nov 10: fix each at its cause). FLAKY_RED=true (the workflow's, for main) makes a flaky test red; a pull request isn't held up.
const flakyRed = process.env.FLAKY_RED === "true";
const head = red
  ? [`❌ red: ${failed.length} failed`, flaky.length && `${flaky.length} flaky`, missing.length && `${missing.length} shard(s) without results`]
  : flaky.length && flakyRed
    ? [`❌ red: flaky only (${flaky.length})`]
    : ["✅ green", flaky.length && `${flaky.length} flaky`];
out.push(`## e2e: ${head.filter(Boolean).join(", ")}`, "");
if (note) out.push(note, "");
const table = (title, list, how) => {
  out.push(`### ${title} (${list.length})`, "", how, "", "| Shard | Test | Project | Error |", "| --- | --- | --- | --- |");
  for (const t of list) out.push(`| ${t.n} | \`${t.where}\` ${cell(t.title)} | ${t.project} | ${cell(t.error)}${t.at ? ` (at ${t.at})` : ""} |`);
  out.push("");
};
if (flaky.length) table("⚠️ Flaky: failed, then passed on the retry", flaky, "CI retries a failed test once, for its trace. These passed the second time: on main that turns the run red (Nov 10).");
if (failed.length) table("❌ Failed", failed, "Failed twice. Run one alone: `npx playwright test <file:line> --project <project>`.");
out.push("### Shards", "", "| Shard | Result | Passed | Failed | Flaky | Skipped | Time |", "| --- | --- | --- | --- | --- | --- | --- |");
for (const { n, record: r } of shards) {
  if (!r) out.push(`| ${n} | ❌ no results: it stopped before its tests ended (see its log) | | | | | |`);
  else out.push(`| ${n} | ${r.status === "passed" ? "✅" : "❌"} ${r.status} | ${r.counts.passed} | ${r.counts.failed} | ${r.counts.flaky} | ${r.counts.skipped}${r.counts.notRun ? ` (+${r.counts.notRun} not run)` : ""} | ${time(r.seconds)} |`);
}
out.push("", "A failed or flaky shard's report, with the retried tests' traces: the run's artifacts (`e2e-report-shard-N`); open it with `npx playwright show-report <folder>`.", "");
// (By project, each test's last attempt: ci-timings.json's form. The plans read main's last green run's records
// themselves; the committed file is their fallback, worth refreshing from here now and then.)
const timings = shards.flatMap((s) => Object.entries(s.record?.projects ?? {})).sort(([a], [b]) => a.localeCompare(b));
const json = `{\n${timings.map(([f, p]) => `  ${JSON.stringify(f)}: { ${Object.entries(p).map(([k, v]) => `${JSON.stringify(k)}: ${v}`).join(", ")} }`).join(",\n")}\n}`;
out.push("<details><summary>Test time by file and project (seconds), as e2e/ci-timings.json</summary>", "", "```json", json, "```", "", "</details>");
console.log(out.join("\n"));
