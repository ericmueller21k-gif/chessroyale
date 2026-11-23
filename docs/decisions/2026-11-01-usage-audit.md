# The Nov 1 usage audit, and what came of it (Nov 1, 2026)

**Eric:** "Do we still occasionally run that to make sure that everything's moving efficiently through the pipelines and
that there's not just a bunch of checks and balances and things just unnecessary running?" The usage check of
`2026-10-17-working-lean.md` had lapsed after Oct 18; run again, it showed a new waste pattern, so an audit helper ran
(read-only, `medium`). Eric, on its findings: "go ahead… I'll let you orchestrate the fixes you think will help".

**What it found** (125 helpers, Oct 18 – Nov 1; 968 CI runs):
- `helper-usage.py` counted each reply about 1.8 times (one reply spans several transcript lines): 7.2 billion tokens
  re-read, not 13.0. Fixed here; it also counts `Monitor` calls as waits now.
- Waiting was 16% of helper usage. A helper can't sit idle, so it re-armed `Monitor` hundreds of times, every few seconds
  (one: 336 times in 3 hours, behind another helper's e2e lock).
- Seven of the ten costliest helpers had been resumed for more rounds or a new job instead of starting fresh.
- 72% of PR e2e runs ran the whole suite (34 min) instead of the selected 7–8 min, mostly because `settings.ts`,
  `e2e/helpers.ts` and a few shared modules send everything; main's full run grew from 22 to 44 min.

**Adopted:**
- `CLAUDE.md`, "Working lean": a fresh helper for every new round or job; helpers wait in one foreground Bash call, never
  `Monitor`, never polling more often than every 30 s; helpers push and report, and the director opens the PR and
  watches CI; locally only the tests being written or changed; about 10 images a job.
- The PR e2e selection made to fit, and one main run at a time: `2026-11-01-ci-selection.md` (its own PR).

**Not now:**
- Slimming the four slowest specs (`autochess`, `boss-bar-same`, `formats`, `recluse`: 26% of the suite's time): later,
  as a speed-up that keeps every check.
- Running `check` on main less often (it never failed in 164 runs): kept, since it checks the merged result.
