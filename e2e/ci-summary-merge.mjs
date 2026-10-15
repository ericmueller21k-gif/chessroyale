// CI's e2e summary (.github/workflows/e2e.yml, the `result` job): every shard's record (e2e/ci-summary.ts writes
// shard-N.json) as one Markdown page for the run: flaky tests first (failed, then passed on the retry: kept in view
// until they're fixed), then failed tests, both with their shard; then each shard's counts and time; then the test
// time by file as a ready-made e2e/ci-timings.json. A shard with no record stopped before its tests ended.
// Usage: node e2e/ci-summary-merge.mjs SHARDS DIR >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [total, dir] = [Number(process.argv[2]), process.argv[3]];
const shards = Array.from({ length: total }, (_, i) => {
  const path = join(dir, `shard-${i + 1}.json`);
  return { n: i + 1, record: existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null };
});
const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const time = (s) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
const all = (key) => shards.flatMap(({ n, record }) => (record?.[key] ?? []).map((t) => ({ n, ...t })));
const flaky = all("flaky");
const failed = all("failed");
const missing = shards.filter((s) => !s.record);
const red = failed.length > 0 || missing.length > 0 || shards.some((s) => s.record && s.record.status !== "passed");

const out = [];
const head = [red ? "❌ red" : "✅ green", failed.length && `${failed.length} failed`, flaky.length && `${flaky.length} flaky`, missing.length && `${missing.length} shard(s) without results`];
out.push(`## e2e: ${head.filter(Boolean).join(", ")}`, "");
const table = (title, list, how) => {
  out.push(`### ${title} (${list.length})`, "", how, "", "| Shard | Test | Project | Error |", "| --- | --- | --- | --- |");
  for (const t of list) out.push(`| ${t.n} | \`${t.where}\` ${cell(t.title)} | ${t.project} | ${cell(t.error)}${t.at ? ` (at ${t.at})` : ""} |`);
  out.push("");
};
if (flaky.length) table("⚠️ Flaky: failed, then passed on the retry", flaky, "CI retries a failed test once (until the flaky tests are fixed; the goal is no retries). These passed the second time.");
if (failed.length) table("❌ Failed", failed, "Failed twice. Run one alone: `npx playwright test <file:line> --project <project>`.");
out.push("### Shards", "", "| Shard | Result | Passed | Failed | Flaky | Skipped | Time |", "| --- | --- | --- | --- | --- | --- | --- |");
for (const { n, record: r } of shards) {
  if (!r) out.push(`| ${n} | ❌ no results: it stopped before its tests ended (see its log) | | | | | |`);
  else out.push(`| ${n} | ${r.status === "passed" ? "✅" : "❌"} ${r.status} | ${r.counts.passed} | ${r.counts.failed} | ${r.counts.flaky} | ${r.counts.skipped}${r.counts.notRun ? ` (+${r.counts.notRun} not run)` : ""} | ${time(r.seconds)} |`);
}
out.push("", "A failed or flaky shard's report, with the retried tests' traces: the run's artifacts (`e2e-report-shard-N`); open it with `npx playwright show-report <folder>`.", "");
const timings = Object.fromEntries(
  shards
    .flatMap((s) => Object.entries(s.record?.timings ?? {}))
    .sort(([a], [b]) => a.localeCompare(b)),
);
out.push("<details><summary>Test time by file (seconds), as e2e/ci-timings.json for rebalancing the shards</summary>", "", "```json", JSON.stringify(timings, null, 2), "```", "", "</details>");
console.log(out.join("\n"));
