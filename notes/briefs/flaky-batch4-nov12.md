# Main's e2e, batch 4 (Nov 12)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (tests and app bugs, no stored data or rules).
Read CLAUDE.md, .claude/LESSONS.md, docs/areas/ops.md ("CI e2e"), and docs/decisions/2026-11-11-flaky-batch.md (batches 1-3: what was
found and how) before starting.

Main's full run turns red when a test passes only on its retry (Nov 10 rule). Batch 3 (PR #650, merged edb8cac) fixed zebra-home:93 and
boss-challenge:155. These are still open. Fix each at its CAUSE: no added retries, no skips, no longer sleeps as the fix (a longer wait
only for a real, slow, legitimate thing, and say what). If the cause is an app bug, fix the app and say so plainly.

1. boss-bar.spec.ts:204: batch 3 saw the level badge replaced mid-Full-Moon, maybe a real flicker that replays the pop. First: is it a
   real bug a player would see? If so, fix it (it's the most important one here).
2. town-leave.spec.ts:148 [phone]: "inside a room: the back button goes out to the square... the back gesture asks, Stay stays in the
   room": toHaveCount (main run 43129402289, shard 13, passed on retry).
3. global-chat.spec.ts:116 [desktop]: "under load: past the server's line the sender sees 'Chat is busy, try again'": toHaveText (run
   43129402289, shard 1). Also global-chat:46 seen earlier.
4. autochess-board.spec.ts:248/274/373 [desktop]: page didn't load in 5 s, three in a row (run 43115844651).
5. shop.spec.ts:870 (Ginger Igloo), multiplayer.spec.ts:18 [desktop] (run 43117506733).
Traces: each shard's e2e-report artifact on the run (gh is not available; use the GitHub MCP tools or curl the public API).

Testing budget: reproduce locally with --repeat-each (both projects where the failure was), show the failure before and the pass after,
under the shared e2e lock. Locally Playwright may look for chromium_headless_shell-1194: if so, run
`mkdir -p /opt/pw-browsers/chromium_headless_shell-1194 && ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64 /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux && ln -sfn chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/headless_shell`.
Run typecheck. Aim for about an hour and a half; if one test eats the time, push what's fixed and list the rest.

Work on branch claude/main-red-batch4 (from origin/main). Push at each real step. Add a "Batch 4" section to
docs/decisions/2026-11-11-flaky-batch.md; lessons to .claude/LESSONS.md and docs/history/lessons.md only for an app bug that slipped.
When done: push .pr-body.md (what changed and why per test, player-visible changes, changed checks old -> new, proof runs, left open),
then .done as the last commit. Don't open a PR or wait on CI: the director does. American English. Never include model names in commits.
