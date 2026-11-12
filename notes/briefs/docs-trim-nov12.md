# Trim the longest decision notes (Nov 12)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Docs only, no code. Read CLAUDE.md first.
Why: every helper working in an area re-reads its decision notes; 116 notes and 34k words were added in 3.5 days, and long notes cost every later job.
Steps:
1. List docs/decisions/*.md by word count (wc -w). Take the 6 longest, which include 2026-11-11-flaky-batch.md (about 2,500 words).
2. For each: keep the date, Eric's words (quoted exactly), the decision and the reason, in at most 150 words. Do not change what was decided.
3. Long design text that is still how things work: move it to that area's page in docs/areas/ (check the page does not already say it; do not duplicate). Fix-by-fix tables and test logs: delete them (git history keeps them); say in the note "Details: git history of this file".
4. Do not touch docs/rules/eric.md, DECISIONS.md, docs/history/, or any code or test.
5. Check every link you touch still points somewhere real (grep for the file names).
Work on branch claude/docs-trim (from origin/main). Run npm run typecheck once at the end (it must still pass). Word counts before and after go in the PR body.
When done: push .pr-body.md (short: what changed and why, player-visible changes, changed checks old -> new, proof, left open), then .done as the last commit. Do not open a PR or wait on CI: the director does. American English. Never include model names in commits.
