// Which spec files shard N of TOTAL runs, as Playwright file filters: the same spread as CI's plan
// (.github/workflows/e2e.yml, whose shards take the plan's `assignment`), for a look from your own checkout.
// Usage: node e2e/ci-shard.mjs N TOTAL [FILE...]
//
// FILE... are the spec files the run tests (a pull request's, from e2e/ci-select.mjs); none means every spec file.
// Whole files are spread by their measured test time in each project (ci-timings.json, or main's last green run in CI;
// a file neither knows counts as the median), so the slowest shard ends soonest, as Playwright runs a shard: each file in
// each project is one job, queued project by project and file by file, on 2 workers (ci-select.mjs, `assign`).
// E2E_LIVE_TIMINGS=<folder of e2e-summary records> overlays those times, as the plan job does.
import { assign, fileFilter, projectWeigher, readTimings, specFiles } from "./ci-select.mjs";

const [n, total] = process.argv.slice(2, 4).map(Number);
if (!(total >= 1 && n >= 1 && n <= total)) throw new Error("usage: node e2e/ci-shard.mjs N TOTAL [FILE...] (1 <= N <= TOTAL)");
const given = process.argv.slice(4);
const files = given.length ? [...given].sort() : specFiles();
const shard = assign(files, projectWeigher(readTimings()), total)[n - 1];
console.error(`Shard ${n} of ${total}: ${shard.files.length} files, about ${Math.round(shard.seconds / 60)} minutes on the clock`);
console.log(shard.files.map(fileFilter).join(" "));
