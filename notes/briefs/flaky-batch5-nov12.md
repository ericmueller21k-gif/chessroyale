# Main's e2e, batch 5 + long timeouts (Nov 12)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (tests and app bugs, no stored data or rules).
Read CLAUDE.md, .claude/LESSONS.md, docs/areas/ops.md ("CI e2e"), and skim docs/decisions/2026-11-11-flaky-batch.md (batches 1-4: what was found and how).
Background: notes/pipeline-audit-2026-11-12.md on branch claude/director-notes (L1, L5, Q3).

Main's full run turns red when a test passes only on its retry (Nov 10 rule); 60% of main runs were red, mostly these. Fix each at its CAUSE: no added retries, no skips, no longer sleeps as the fix (a longer wait only for a real, slow, legitimate thing, and say what). If the cause is an app bug, fix the app and say so plainly. Most important first:
1. colosseum.spec.ts:42 (x4), tiger.spec.ts:305 (x3), matchmaking.spec.ts:22 (x3; 5,289 ms against a 5 s budget: is the budget or the app wrong?), gardener.spec.ts:229 [desktop] (x3).
2. dash.spec.ts:241 (open since Nov 9), sawyer.spec.ts:113, recluse.spec.ts:824, search-home.spec.ts:61, town.spec.ts:865 [phone] (the bots walking home, PR #666's run).
3. If batch 4 did not close them: global-chat.spec.ts:266, autochess-board [desktop], shop.spec.ts:870, multiplayer.spec.ts:18.
Find the runs: list recent e2e.yml runs on main (curl the public API) and each run's result summary / e2e-report artifacts.

Also, in the same PR:
- Long timeouts (L5): 23 tests set test.setTimeout >= 400 s (boss-bar-same 1,200, town-rows 900). One stalled shard ran 50 min (main run 1235). Set each to about 2x its measured time (the e2e-summary artifacts have durations), so a stall fails fast.
- A lint against the lost-Escape pattern: a check (in the typecheck or unit step) that flags keydown listeners added in useEffect without the agreed pattern (see batches 1-4; found in 9 pop-ups). 30 min at most.
- Q3: the result job's summary title says "red: flaky only (N)" or "red: N failed" (e2e/ci-summary-merge.mjs and the final step), so a retry-pass red is told apart from a real failure at a glance.

Testing budget: reproduce locally with --repeat-each (the project where it failed), show the failure before and the pass after, under the shared e2e lock. Locally Playwright may look for chromium_headless_shell-1194: if so, run `mkdir -p /opt/pw-browsers/chromium_headless_shell-1194 && ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64 /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux && ln -sfn chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/headless_shell`. Run typecheck. Aim for about two hours; if one test eats the time, push what's fixed and list the rest.

Work on branch claude/main-red-batch5 (from origin/main). Push at each real step. Write a NEW decision note docs/decisions/2026-11-12-flaky-batch-5.md of at most 120 words (the table of fixes goes in the PR body, not the note; do not append to the Nov 11 note). Lessons only for an app bug that slipped.
When done: push .pr-body.md (short: what changed and why, player-visible changes, changed checks old -> new, proof, left open), then .done as the last commit. Do not open a PR or wait on CI: the director does. American English. Never include model names in commits.
