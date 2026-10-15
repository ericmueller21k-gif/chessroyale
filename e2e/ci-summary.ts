import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, relative } from "node:path";
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from "@playwright/test/reporter";

/**
 * CI's record of one e2e shard (.github/workflows/e2e.yml), as JSON in the file E2E_SUMMARY_FILE names (nothing without
 * it): its label (E2E_SHARD_LABEL), result, counts and time; each failed and each flaky test (failed, then passed on
 * the retry): its `file:line`, project, title, the gist of its error and the line it failed on; and the test time by
 * file (seconds), for rebalancing the shards (e2e/ci-shard.mjs). A shard with flaky tests also gets `<name>.flaky`, so
 * the workflow keeps its report. The `result` job renders every shard's record on the run's page
 * (e2e/ci-summary-merge.mjs).
 */
export default class CiSummary implements Reporter {
  private suite?: Suite;

  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite;
  }

  onEnd(result: FullResult) {
    const out = process.env.E2E_SUMMARY_FILE;
    if (!out || !this.suite) return;
    const file = (t: TestCase) => relative(process.cwd(), t.location.file);
    const tests = this.suite.allTests();
    const ran = tests.filter((t) => t.results.length > 0);
    const of = (outcome: ReturnType<TestCase["outcome"]>) => ran.filter((t) => t.outcome() === outcome);
    const entry = (t: TestCase) => {
      const error = t.results.find((r) => r.error)?.error;
      return {
        where: `${file(t)}:${t.location.line}`,
        project: t.parent.project()?.name ?? "",
        title: t.title,
        error: gist(error?.message ?? ""),
        at: error?.location ? `${basename(error.location.file)}:${error.location.line}` : "",
      };
    };
    // Test time per file, summed over both projects and every attempt.
    const timings: Record<string, number> = {};
    for (const t of ran) timings[file(t)] = (timings[file(t)] ?? 0) + t.results.reduce((ms, r) => ms + r.duration, 0) / 1000;
    for (const f in timings) timings[f] = Math.round(timings[f]!);
    const failed = of("unexpected").map(entry);
    const flaky = of("flaky").map(entry);
    const record = {
      label: process.env.E2E_SHARD_LABEL ?? "e2e",
      status: result.status,
      seconds: Math.round(result.duration / 1000),
      counts: { passed: of("expected").length, failed: failed.length, flaky: flaky.length, skipped: of("skipped").length, notRun: tests.length - ran.length },
      failed,
      flaky,
      timings,
    };
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(record, null, 1));
    if (flaky.length) writeFileSync(out.replace(/\.json$/, "") + ".flaky", "");
  }

  printsToStdio() {
    return false;
  }
}

/** An error's first line, plus its Expected, Received and Locator lines if it has them (colors stripped). */
function gist(message: string) {
  const lines = message.replace(/\u001b\[[0-9;]*m/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  const extra = ["Expected", "Received", "Locator"].map((k) => lines.find((l) => l.startsWith(k))).filter(Boolean);
  return [lines[0]?.replace(/^Error: /, "") ?? "", ...extra].join(" · ").slice(0, 300);
}
